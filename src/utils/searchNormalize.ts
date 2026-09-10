// General-purpose search normalization for Bible + Hymn FTS queries.
//
// Index-time pipeline (scripts/utils/buildDb.js#normalizeForFtsContent) and
// query-time pipeline MUST produce the same string for identical input —
// that's the contract that lets `*_plain` columns match user queries even
// when the user types rough variants (different case, missing diacritics,
// stray apostrophes/commas, extra spaces, words in any order).
//
// No dataset-specific magic lives here. If a particular word needs aliasing,
// add it to a data file, not this module.

// lowercase → NFD strip combining marks → punctuation/quotes/symbols become
// spaces → collapse whitespace. Never use `\w` here — it drops non-ASCII
// letters (the Malagasy `ô` etc.) and silently breaks diacritic-insensitive
// matching.
export const normalizeForFtsQuery = (value: unknown): string => {
  const raw = (value ?? '').toString();
  if (!raw) return '';
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// A token expander lets callers add dataset-specific synonyms WITHOUT this
// generic module knowing about them. Given one normalized token, it returns the
// alternative base words to also try (the builder appends `*` and substitutes
// the token IN PLACE), or null when the token has no synonyms. See
// src/utils/searchSynonyms.ts for the Malagasy Jesus-name expander.
export type TokenExpander = (token: string) => string[] | null;

// Build the FTS5 MATCH expression for a normalized query. Each token becomes
// a prefix (`tok*`) joined with AND, so:
//   - word order doesn't matter
//   - partial words still match (e.g. "loharanon" matches "loharanonaina")
//   - punctuation/diacritics are already gone from the normalized form
//
// Extra OR branch: when a multi-token query contains a very short token
// (≤2 chars), also try the collapsed variant (handles a stray space that
// the user inserted mid-word).
//
// Optional `expandToken`: when a token has synonyms, we add ONE extra branch
// per synonym with that token swapped in place (keeping the other tokens'
// AND constraints). We never emit a synonym as a standalone whole-corpus
// branch — `(jesosy*)` alone matches hundreds of rows and buries the real hit.
export const makeFtsPrefixQuery = (
  normalized: string,
  expandToken?: TokenExpander,
): string => {
  const rawTokens = normalized.split(/\s+/).filter(Boolean);
  const meaningful = rawTokens
    // Single-character tokens (e.g. "o") are extremely common and make FTS
    // return huge candidate sets, which can cause relevant results to be
    // excluded by LIMIT.
    .filter(t => t.length > 1);

  // If the user typed ONLY a single-character query (e.g. "o"), we must not
  // drop it — otherwise diacritic-insensitive single-letter searches ("o" → "ô")
  // would never match anything.
  const tokens = meaningful.length > 0 ? meaningful : rawTokens.slice(0, 1);
  if (tokens.length === 0) return '';

  const baseTokens = tokens.map(tok => `${tok}*`).join(' AND ');
  const branches = new Set<string>([baseTokens]);

  const collapsed = tokens.join('');
  if (tokens.length > 1 && tokens.some(t => t.length <= 2)) {
    branches.add(`${collapsed}*`);
  }

  // Synonym branches: for each token that has synonyms, emit a variant of the
  // FULL query with just that token replaced. Tokens keep their AND join, so a
  // 3-word query stays a 3-word query — only the synonym token changes.
  if (expandToken) {
    tokens.forEach((tok, idx) => {
      const synonyms = expandToken(tok);
      if (!synonyms || synonyms.length === 0) return;
      for (const synonym of synonyms) {
        const replaced = tokens
          .map((t, i) => (i === idx ? `${synonym}*` : `${t}*`))
          .join(' AND ');
        branches.add(replaced);
      }
    });
  }

  const list = Array.from(branches).filter(Boolean);
  return list.length === 1 ? list[0] : list.map(s => `(${s})`).join(' OR ');
};

// Run an FTS5 query, falling back to a LIKE query on ANY failure (missing
// fts5 module, missing table, a malformed MATCH expression, a query-builder
// bug — anything). We used to only fall back for specific error strings
// ('no such module: fts5' / 'no such table'), which meant a differently-worded
// SQL error (e.g. referencing a JOIN alias instead of the FTS5 table's real
// name in a MATCH clause) silently re-threw, was swallowed by the caller's
// try/catch, and returned zero results with no visible error — exactly what
// happened to Bible search. LIKE is a strict, always-available superset
// fallback (slower, less precise, but correct), so degrading to it on any FTS
// failure is strictly safer than re-throwing.
type QueryRunner = {
  executeQuerySilent: <T = any>(sql: string, params: any[]) => Promise<{rows: T[]}>;
  executeQuery: <T = any>(sql: string, params: any[]) => Promise<{rows: T[]}>;
};
export const execWithLikeFallback = async (
  service: QueryRunner,
  fts: {sql: string; params: any[]},
  like: {sql: string; params: any[]},
): Promise<{rows: any[]}> => {
  try {
    return await service.executeQuerySilent(fts.sql, fts.params);
  } catch (e: any) {
    console.warn('FTS query failed, falling back to LIKE:', e?.message ?? e);
    return service.executeQuery(like.sql, like.params);
  }
};

// ---------------------------------------------------------------------------
// Typo tolerance — spelling correction against the corpus vocabulary.
//
// The strict AND-of-prefixes query above needs every token to be a prefix of
// some indexed word; it has no tolerance for a misspelled letter, a
// missing/extra one, or a Malagasy elision typed as one merged word (e.g.
// "aminny" for "amin'ny", which the index stores as two tokens "amin" + "ny").
//
// So when the strict query finds NOTHING, we correct the QUERY rather than
// fuzzy-matching the content: look each unknown token up against the corpus
// vocabulary (`Vocabulary` + its trigram index, built in scripts/utils/
// buildDb.js), swap in the closest real word, then re-run the ordinary ranked
// search. Correcting the word and reusing the real search beats scoring
// content by character overlap on every axis — the comparison is word-to-word
// instead of word-to-whole-verse so it is far more precise, results come back
// through normal bm25 ranking, and indexing ~23k distinct words costs 0.5 MB
// where trigram-indexing every verse cost 10.4 MB of the user's download.

// Every overlapping 3-char window of an already-normalized string. Strings
// shorter than 3 chars can't form a trigram; use the whole string as its own
// single "trigram" so short queries still produce a queryable term.
export const generateTrigrams = (normalized: string): string[] => {
  const s = normalized;
  if (s.length < 3) return s ? [s] : [];
  const out = new Set<string>();
  for (let i = 0; i <= s.length - 3; i++) {
    out.add(s.slice(i, i + 3));
  }
  return Array.from(out);
};

// Build the FTS5 MATCH expression for a trigram-tokenized table: each
// trigram double-quoted (trigrams routinely contain a space, which would
// otherwise be parsed as a token separator) and OR'd together, so a row
// matches if it shares ANY trigram with the query — bm25() then ranks rows
// that share MORE (and rarer) trigrams higher.
export const makeTrigramMatchQuery = (trigrams: string[]): string =>
  trigrams.map(tg => `"${tg.replace(/"/g, '""')}"`).join(' OR ');

// Precision filter over the words the trigram index hands back: bm25 there
// rewards sharing rare trigrams, which is not the same as "looks like the
// typo". Re-score each candidate by the fraction of the typo's trigrams it
// actually contains, and drop anything below TRIGRAM_MIN_OVERLAP.
export const trigramOverlapScore = (
  queryTrigrams: string[],
  candidateNormalizedText: string,
): number => {
  if (queryTrigrams.length === 0) return 0;
  const candidateSet = new Set(generateTrigrams(candidateNormalizedText));
  let hits = 0;
  for (const tg of queryTrigrams) {
    if (candidateSet.has(tg)) hits += 1;
  }
  return hits / queryTrigrams.length;
};

export const TRIGRAM_MIN_OVERLAP = 0.5;

// Hands control back to the JS event loop. React Native's JS thread is
// separate from Android's main thread, so a long synchronous loop here can't
// trigger a system ANR — but it DOES block React from processing state
// updates or touch input for its whole duration, which reads to the user as
// "the app stopped responding" just the same. `setTimeout(resolve, 0)` is the
// standard cooperative-yield trick: it lets anything already queued (a
// pending re-render, a tap) run before the next chunk starts.
const yieldToEventLoop = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

// Scores every item in `items` via `score` (returning null to drop it),
// yielding to the event loop every `chunkSize` items. The correction lookup
// is uncapped, and a typo made of common Malagasy syllables can match a large
// slice of the vocabulary — for a small pool this is one pass with no
// yielding at all.
export const scoreInChunks = async <T, R>(
  items: T[],
  score: (item: T) => R | null,
  chunkSize = 2000,
): Promise<R[]> => {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, items.length);
    for (let j = i; j < end; j++) {
      const scored = score(items[j]);
      if (scored !== null) out.push(scored);
    }
    if (end < items.length) {
      await yieldToEventLoop();
    }
  }
  return out;
};

// The search itself matches on prefixes, so a token is "known" when it starts
// ANY real word — "andriaman" needs no correcting even though it isn't a word
// on its own. Expressed as a range scan rather than LIKE/GLOB so it always
// rides Vocabulary.word's UNIQUE index.
const isKnownPrefix = async (service: QueryRunner, token: string): Promise<boolean> => {
  const upper = token.slice(0, -1) + String.fromCodePoint(token.codePointAt(token.length - 1)! + 1);
  const {rows} = await service.executeQuerySilent(
    'SELECT 1 FROM Vocabulary WHERE word >= ? AND word < ? LIMIT 1',
    [token, upper],
  );
  return rows.length > 0;
};

// Malagasy elisions get typed as one word ("aminny" for "amin'ny", stored as
// "amin" + "ny"). Try every split point in a single query and keep the most
// balanced pair of real words — "amin"+"ny" rather than "a"+"minny".
const splitIntoKnownWords = async (
  service: QueryRunner,
  token: string,
): Promise<string[] | null> => {
  if (token.length < 4) return null;

  const parts: string[] = [];
  for (let i = 2; i <= token.length - 2; i++) {
    parts.push(token.slice(0, i), token.slice(i));
  }
  const {rows} = await service.executeQuerySilent<{word: string}>(
    `SELECT word FROM Vocabulary WHERE word IN (${parts.map(() => '?').join(',')})`,
    parts,
  );
  const known = new Set(rows.map(r => r.word));

  let best: string[] | null = null;
  for (let i = 2; i <= token.length - 2; i++) {
    const head = token.slice(0, i);
    const tail = token.slice(i);
    if (!known.has(head) || !known.has(tail)) continue;
    if (!best || Math.min(head.length, tail.length) > Math.min(best[0].length, best[1].length)) {
      best = [head, tail];
    }
  }
  return best;
};

// Closest real word to a typo, by trigram overlap. Ties break on corpus
// frequency, so a typo equally close to a common and an obscure word picks
// the one the user more likely meant.
const closestKnownWord = async (
  service: QueryRunner,
  token: string,
): Promise<string | null> => {
  const trigrams = generateTrigrams(token);
  if (trigrams.length === 0) return null;

  const {rows} = await service.executeQuerySilent<{word: string; freq: number}>(
    `SELECT v.word AS word, v.freq AS freq
     FROM VocabularyTrigram t
     JOIN Vocabulary v ON v.id = t.rowid
     WHERE VocabularyTrigram MATCH ?`,
    [makeTrigramMatchQuery(trigrams)],
  );

  const scored = await scoreInChunks(rows, row => {
    const overlap = trigramOverlapScore(trigrams, row.word);
    return overlap >= TRIGRAM_MIN_OVERLAP ? {word: row.word, overlap, freq: row.freq} : null;
  });
  if (scored.length === 0) return null;

  scored.sort((a, b) => b.overlap - a.overlap || b.freq - a.freq);
  return scored[0].word;
};

// Rewrites a query whose strict search found nothing, correcting only the
// tokens that match no real word. Returns null when nothing was changed —
// then there is no point re-running the search. Never throws: a missing
// Vocabulary table (older DB not yet re-extracted) just means no correction.
export const correctQueryViaVocabulary = async (
  service: QueryRunner,
  normalizedQuery: string,
): Promise<string | null> => {
  const tokens = normalizedQuery.split(' ').filter(t => t.length > 1);
  if (tokens.length === 0) return null;

  try {
    const out: string[] = [];
    let changed = false;

    for (const token of tokens) {
      if (await isKnownPrefix(service, token)) {
        out.push(token);
        continue;
      }
      const split = await splitIntoKnownWords(service, token);
      if (split) {
        out.push(...split);
        changed = true;
        continue;
      }
      const closest = await closestKnownWord(service, token);
      if (closest && closest !== token) {
        out.push(closest);
        changed = true;
        continue;
      }
      out.push(token);
    }

    return changed ? out.join(' ') : null;
  } catch (e: any) {
    console.warn('Vocabulary correction unavailable:', e?.message ?? e);
    return null;
  }
};
