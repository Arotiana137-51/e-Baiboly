import {
  makeFtsPrefixQuery,
  normalizeForFtsQuery,
  generateTrigrams,
  makeTrigramMatchQuery,
  trigramOverlapScore,
  scoreInChunks,
  correctQueryViaVocabulary,
} from '../src/utils/searchNormalize';

// `title_plain` is what the FTS5 index actually stores. It is produced by
// scripts/utils/buildDb.js#normalizeForFtsContent, which runs the SAME
// pipeline as normalizeForFtsQuery. We re-use normalizeForFtsQuery here as
// the index-time stand-in — if these ever drift, the contract is broken.
const indexedTitlePlain = (raw: string) => normalizeForFtsQuery(raw);

// Approximate what `<col> MATCH 'a* AND b* AND ...'` would do: every token
// (sans trailing `*`) must appear as a substring of the indexed text. AND/OR
// branches are joined with `(...) OR (...)` in makeFtsPrefixQuery, so split
// on top-level OR and accept any branch.
const ftsExpressionMatches = (
  ftsExpression: string,
  indexedText: string,
): boolean => {
  if (!ftsExpression) return false;
  const branches: string[] = [];
  if (ftsExpression.includes(' OR ')) {
    let depth = 0;
    let start = 0;
    for (let i = 0; i < ftsExpression.length; i++) {
      const ch = ftsExpression[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (
        depth === 0 &&
        ftsExpression.slice(i, i + 4) === ' OR ' &&
        ftsExpression[i - 1] === ')'
      ) {
        branches.push(ftsExpression.slice(start, i));
        start = i + 4;
        i += 3;
      }
    }
    branches.push(ftsExpression.slice(start));
  } else {
    branches.push(ftsExpression);
  }

  return branches.some(branch => {
    const inner = branch.startsWith('(') && branch.endsWith(')')
      ? branch.slice(1, -1)
      : branch;
    const tokens = inner.split(' AND ').map(s => s.replace(/\*$/, '').trim());
    return tokens.every(tok => tok.length > 0 && indexedText.includes(tok));
  });
};

describe('normalizeForFtsQuery', () => {
  it('lowercases, strips diacritics, and removes punctuation', () => {
    expect(normalizeForFtsQuery('Jeso ô, Mpitia anay')).toBe('jeso o mpitia anay');
  });

  it('treats curly and straight apostrophes the same way', () => {
    expect(normalizeForFtsQuery("Loharanon'aina")).toBe('loharanon aina');
    expect(normalizeForFtsQuery('Loharanon\u2019aina')).toBe('loharanon aina');
  });

  it('collapses runs of whitespace', () => {
    expect(normalizeForFtsQuery('Ry   Jeso\tLoharanon\u2019aina')).toBe(
      'ry jeso loharanon aina',
    );
  });

  it('handles non-string input gracefully', () => {
    expect(normalizeForFtsQuery(undefined)).toBe('');
    expect(normalizeForFtsQuery(null)).toBe('');
    expect(normalizeForFtsQuery(123)).toBe('123');
  });
});

describe('makeFtsPrefixQuery + ftsExpressionMatches contract', () => {
  it('matches the rough variant against the canonical title (example #1)', () => {
    const userInput = 'Jeso o mpitia anay';
    const titleRaw = 'Jeso ô, Mpitia anay';

    const expression = makeFtsPrefixQuery(normalizeForFtsQuery(userInput));
    expect(ftsExpressionMatches(expression, indexedTitlePlain(titleRaw))).toBe(true);
  });

  it("matches an apostrophe-bearing title from a non-apostrophe query (example #2)", () => {
    const userInput = "ry jeso loharanon'aina";
    const titleRaw = "Ry Jeso Loharanon'aina";

    const expression = makeFtsPrefixQuery(normalizeForFtsQuery(userInput));
    expect(ftsExpressionMatches(expression, indexedTitlePlain(titleRaw))).toBe(true);
  });

  it('matches when the user reorders words', () => {
    const expression = makeFtsPrefixQuery(normalizeForFtsQuery('mpitia anay jeso'));
    expect(ftsExpressionMatches(expression, indexedTitlePlain('Jeso ô, Mpitia anay'))).toBe(true);
  });

  it('matches when the user types only a partial subset of words', () => {
    const expression = makeFtsPrefixQuery(normalizeForFtsQuery('loharanon'));
    expect(ftsExpressionMatches(expression, indexedTitlePlain("Ry Jeso Loharanon'aina"))).toBe(true);
  });

  it('does NOT match an unrelated title', () => {
    const expression = makeFtsPrefixQuery(normalizeForFtsQuery('Jeso o mpitia anay'));
    expect(ftsExpressionMatches(expression, indexedTitlePlain('Endrey ny hatsaranao'))).toBe(false);
  });

  it('returns empty for an empty/whitespace query', () => {
    expect(makeFtsPrefixQuery(normalizeForFtsQuery(''))).toBe('');
    expect(makeFtsPrefixQuery(normalizeForFtsQuery('   '))).toBe('');
  });
});

describe('trigram fuzzy-fallback helpers', () => {
  it('generates every overlapping 3-char window, deduplicated', () => {
    expect(generateTrigrams('jeso')).toEqual(
      expect.arrayContaining(['jes', 'eso']),
    );
    expect(generateTrigrams('jeso')).toHaveLength(2);
    // "aaaa" only has one distinct trigram ("aaa") despite two windows.
    expect(generateTrigrams('aaaa')).toEqual(['aaa']);
  });

  it('treats a too-short string as its own single term instead of dropping it', () => {
    expect(generateTrigrams('jo')).toEqual(['jo']);
    expect(generateTrigrams('')).toEqual([]);
  });

  it('quotes every trigram so ones containing a space stay one MATCH term', () => {
    const expr = makeTrigramMatchQuery(['abc', 'b c']);
    expect(expr).toBe('"abc" OR "b c"');
  });

  it('scores full overlap as 1 and no overlap as 0', () => {
    const trigrams = generateTrigrams('jeso');
    expect(trigramOverlapScore(trigrams, 'jeso vato fehizoro')).toBe(1);
    expect(trigramOverlapScore(trigrams, 'zzzzzzzz')).toBe(0);
  });

  it('recovers a typo and a merged Malagasy elision above the 0.5 overlap floor', () => {
    // Missing one letter ("adriamanitra" for "andriamanitra").
    const typoTrigrams = generateTrigrams(normalizeForFtsQuery('adriamanitra'));
    expect(
      trigramOverlapScore(typoTrigrams, normalizeForFtsQuery('Andriamanitra')),
    ).toBeGreaterThanOrEqual(0.5);

    // Apostrophe/space dropped entirely — the index stores "amin ny" as two
    // tokens, but the merged query still shares most of its trigrams with it.
    const mergedTrigrams = generateTrigrams(normalizeForFtsQuery('aminny'));
    expect(
      trigramOverlapScore(mergedTrigrams, normalizeForFtsQuery("amin'ny")),
    ).toBeGreaterThanOrEqual(0.5);
  });
});

describe('scoreInChunks', () => {
  it('scores every item across multiple chunks, preserving order', async () => {
    const items = Array.from({length: 25}, (_, i) => i);
    const result = await scoreInChunks(items, n => n * 2, 7);
    expect(result).toEqual(items.map(n => n * 2));
  });

  it('drops items the scorer maps to null', async () => {
    const items = [1, 2, 3, 4, 5, 6];
    const result = await scoreInChunks(items, n => (n % 2 === 0 ? n : null), 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it('does nothing for an empty input', async () => {
    const result = await scoreInChunks([] as number[], n => n, 10);
    expect(result).toEqual([]);
  });

  it('handles an input smaller than the chunk size in one pass', async () => {
    const result = await scoreInChunks([1, 2, 3], n => n + 1, 100);
    expect(result).toEqual([2, 3, 4]);
  });
});

// A stand-in for the DatabaseService: `words` is the corpus vocabulary, and
// the three query shapes correctQueryViaVocabulary issues are answered from
// it — the prefix range scan, the exact-match IN list used for elision
// splits, and the trigram candidate join.
const makeVocabularyService = (words: Record<string, number>) => ({
  executeQuery: async () => ({rows: []}),
  executeQuerySilent: async (sql: string, params: any[]) => {
    if (sql.includes('word >= ?')) {
      const [lower, upper] = params as [string, string];
      const hit = Object.keys(words).some(w => w >= lower && w < upper);
      return {rows: hit ? [{1: 1}] : []};
    }
    if (sql.includes('word IN')) {
      return {rows: (params as string[]).filter(p => p in words).map(word => ({word}))};
    }
    // Trigram candidates: the real table filters by shared trigram, but
    // handing back the whole vocabulary is a superset — the overlap filter
    // in the function under test is what actually decides.
    return {rows: Object.entries(words).map(([word, freq]) => ({word, freq}))};
  },
});

describe('correctQueryViaVocabulary', () => {
  const vocabulary = {andriamanitra: 500, amin: 900, ny: 9000, fitiavana: 120, vehivavy: 40};

  it('leaves a query alone when every token already starts a real word', async () => {
    const service = makeVocabularyService(vocabulary);
    expect(await correctQueryViaVocabulary(service, 'andriamanitra vehivavy')).toBeNull();
    // A partial word is fine too — the search matches on prefixes.
    expect(await correctQueryViaVocabulary(service, 'andriaman')).toBeNull();
  });

  it('corrects a misspelled token to the closest real word', async () => {
    const service = makeVocabularyService(vocabulary);
    expect(await correctQueryViaVocabulary(service, 'adriamanitr')).toBe('andriamanitra');
  });

  it('splits a merged Malagasy elision into its two real words', async () => {
    const service = makeVocabularyService(vocabulary);
    expect(await correctQueryViaVocabulary(service, 'aminny')).toBe('amin ny');
  });

  it('corrects only the broken token, leaving the rest untouched', async () => {
    const service = makeVocabularyService(vocabulary);
    expect(await correctQueryViaVocabulary(service, 'vehivavy adriamanitr')).toBe(
      'vehivavy andriamanitra',
    );
  });

  it('gives up rather than forcing gibberish onto an unrelated word', async () => {
    const service = makeVocabularyService(vocabulary);
    expect(await correctQueryViaVocabulary(service, 'zzzqqqxx')).toBeNull();
  });

  it('returns null instead of throwing when the vocabulary table is missing', async () => {
    const broken = {
      executeQuery: async () => ({rows: []}),
      executeQuerySilent: async () => {
        throw new Error('no such table: Vocabulary');
      },
    };
    expect(await correctQueryViaVocabulary(broken, 'adriamanitr')).toBeNull();
  });
});
