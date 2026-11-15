// Last-resort Bible search for a phrase remembered not quite word for word.
//
// The strict search wants every typed word to start some word of the verse.
// A sentence quoted from memory rarely manages that:
//   - words joined or split differently: "naha toy" for "nahatoy";
//   - another possessive: "fahasoavanao" (your grace) for
//     "fahasoavan'Andriamanitra" (God's grace);
//   - a word or two remembered wrong.
// Every one of those words is real, so the typo correction has nothing to fix
// either, and the search came back empty.
//
// So when both find nothing for a phrase, fetch the verses sharing its rarer
// words, then keep those that hold most of the phrase, most first.

import {normalizeForFtsContent} from './searchNormalize';

// Malagasy possessive endings, longest first: "fahasoavanao" → "fahasoava",
// a prefix of "fahasoavana" and of "fahasoavan'…" alike.
const POSSESSIVE_SUFFIXES = ['ntsika', 'nareo', 'nay', 'nao', 'ko', 'ny'];
const MIN_STEM = 4;

// Fewer words than this and the strict search is the right answer: there is
// no phrase to be loose about.
export const LOOSE_MIN_TOKENS = 3;

// Share of the phrase, by weight, a verse must hold to be offered.
export const LOOSE_MIN_COVERAGE = 0.7;

// How many verses, best first, the retrieval hands to the scorer.
export const LOOSE_CANDIDATE_LIMIT = 300;

const tokensOf = (normalized: string): string[] => normalized.split(' ').filter(Boolean);

// The word itself, plus its stem without a possessive ending.
export const wordForms = (token: string): string[] => {
  const forms = [token];
  for (const suffix of POSSESSIVE_SUFFIXES) {
    if (token.endsWith(suffix) && token.length - suffix.length >= MIN_STEM) {
      forms.push(token.slice(0, -suffix.length));
      break;
    }
  }
  return forms;
};

// FTS5 MATCH expression for the retrieval: any of the phrase's words, stems or
// adjacent pairs written as one word. Two-letter words ("fa", "ny", "no") are
// left out: in nearly every verse, they would only slow it down. bm25 ranks
// verses sharing more, and rarer, of the rest first. Null when the phrase is
// too short to be loose about.
export const makeLooseFtsQuery = (normalized: string): string | null => {
  const tokens = tokensOf(normalized);
  if (tokens.length < LOOSE_MIN_TOKENS) return null;

  const terms = new Set<string>();
  tokens.forEach((token, i) => {
    if (token.length >= 3) wordForms(token).forEach(form => terms.add(`${form}*`));
    const next = tokens[i + 1];
    if (next) terms.add(`${token}${next}*`);
  });
  return terms.size > 0 ? Array.from(terms).join(' OR ') : null;
};

// Two-letter words count for half: they are in almost every verse.
const weightOf = (token: string) => (token.length <= 2 ? 0.5 : 1);

// Shortest word that also counts at the end of a verse word.
const MIN_TAIL = 3;

// Share of the phrase (0–1, by weight) found in the verse. A word counts when
// a verse word starts with it or its stem, or ends with it, prefixed
// ("toy" in "nahatoy"); two neighbours count together when the verse writes
// them as one word ("naha toy" in "nahatoy").
export const looseCoverage = (normalizedQuery: string, verseText: string): number => {
  const tokens = tokensOf(normalizedQuery);
  if (tokens.length === 0) return 0;
  const words = tokensOf(normalizeForFtsContent(verseText));
  const startsSomeWord = (prefix: string) => words.some(w => w.startsWith(prefix));
  const endsSomeWord = (tail: string) =>
    tail.length >= MIN_TAIL && words.some(w => w.length > tail.length && w.endsWith(tail));

  const found = tokens.map(token => wordForms(token).some(startsSomeWord) || endsSomeWord(token));
  tokens.forEach((token, i) => {
    const next = tokens[i + 1];
    if (next && startsSomeWord(`${token}${next}`)) {
      found[i] = true;
      found[i + 1] = true;
    }
  });

  let total = 0;
  let hit = 0;
  tokens.forEach((token, i) => {
    total += weightOf(token);
    if (found[i]) hit += weightOf(token);
  });
  return hit / total;
};

// The verses holding enough of the phrase, best first: the share held, then
// the retrieval's own order (bm25), kept by a stable sort.
export const rankLooseMatches = <T extends {text: string}>(
  normalizedQuery: string,
  rows: T[],
): Array<T & {coverage: number}> =>
  rows
    .map(row => ({...row, coverage: looseCoverage(normalizedQuery, row.text)}))
    .filter(row => row.coverage >= LOOSE_MIN_COVERAGE)
    .sort((a, b) => b.coverage - a.coverage);
