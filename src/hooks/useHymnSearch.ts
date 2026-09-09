import { useCallback, useState } from 'react';
import { hymnsDatabaseService } from '../services/database/DatabaseService';
import {t} from '../i18n/strings';
import {
  normalizeForFtsQuery,
  makeFtsPrefixQuery,
  execWithLikeFallback,
  correctQueryViaVocabulary,
} from '../utils/searchNormalize';
import {
  JESUS_VARIANTS,
  expandJesusToken,
  containsJesusNameVariant,
  looksLikeJesusPrefix,
  makeJesusNameLikeParams,
} from '../utils/searchSynonyms';

export type HymnSearchOptions = {
  matchWholeWord?: boolean;
};

// Whole-word search builds a quoted phrase rather than per-token prefixes.
// Mirrors the prefix builder's Jesus-name expansion (in place, no standalone
// branch): the dataset stores "Jesoa"/"Jesosy", never bare "Jeso", so a quoted
// phrase starting with "jeso ..." would otherwise miss those titles.
const makeFtsWholeWordQuery = (normalized: string) => {
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';

  const phrases = new Set<string>([`"${tokens.join(' ')}"`]);

  if (containsJesusNameVariant(normalized)) {
    for (const variant of JESUS_VARIANTS) {
      const replaced = tokens
        .map(tok => (looksLikeJesusPrefix(tok) ? variant : tok))
        .join(' ');
      phrases.add(`"${replaced}"`);
    }
  }

  const list = Array.from(phrases).filter(Boolean);
  return list.length === 1 ? list[0] : list.join(' OR ');
};

export interface HymnMatchedVerse {
  verseNumber: number;
  text: string;
}

export interface HymnSearchResult {
  id: string;
  number: number;
  category: string;
  title: string;
  authors: string;
  // Best (highest-ranked) matched verse — drives the collapsed card snippet.
  matchedVerse?: string;
  verseNumber?: number;
  // Every matched verse for this hymn, ordered by verse number — feeds the
  // accordion expansion. Empty when only the title/authors matched.
  matchedVerses: HymnMatchedVerse[];
  matchCount: number;
}

export const useHymnSearch = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchHymns = useCallback(async (query: string, options?: HymnSearchOptions): Promise<HymnSearchResult[]> => {
    if (!query.trim()) {
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      await hymnsDatabaseService.initDatabase();

      const matchWholeWord = options?.matchWholeWord === true;

      const normalizedQuery = normalizeForFtsQuery(query);
      if (!normalizedQuery) {
        return [];
      }

      // Substring: prefix query per token; Whole word: quoted phrase (with Jesus-name expansion).
      // expandJesusToken tames the Jesus-name aliasing: it swaps the matching token
      // in place (jeso→jesosy/jesoa) instead of adding standalone whole-corpus
      // branches, which used to balloon "jeso vato fehizoro" from 6 to 604 rows.
      const ftsParam = matchWholeWord
        ? makeFtsWholeWordQuery(normalizedQuery)
        : makeFtsPrefixQuery(normalizedQuery, expandJesusToken);

      // Title matches are far more relevant than verse matches, so push them to
      // the top by subtracting a large constant from their bm25 score (bm25 is
      // negative; lower = better, so a big subtraction guarantees titles sort
      // first). Verse rows keep their raw bm25(HymnVersesFts) score.
      const TITLE_SCORE_BOOST = 1000;

      // HymnVersesFts is contentless: hymn_id/verse_number live on HymnVerses
      // and must be read through the rowid join, not selected from f.*.
      const ftsSearchQuery = `
        SELECT
          id,
          number,
          category,
          title,
          authors,
          matched_verse,
          verse_number,
          MIN(score) as score
        FROM (
          SELECT
            h.id,
            h.number,
            h.category,
            h.title,
            h.authors,
            v.text as matched_verse,
            v.verse_number,
            bm25(HymnVersesFts) as score
          FROM HymnVersesFts f
          JOIN HymnVerses v ON v.rowid = f.rowid
          JOIN Hymns h ON h.id = v.hymn_id
          WHERE HymnVersesFts MATCH ?

          UNION ALL

          SELECT
            h.id,
            h.number,
            h.category,
            h.title,
            h.authors,
            NULL as matched_verse,
            NULL as verse_number,
            bm25(HymnsFts) - ${TITLE_SCORE_BOOST} as score
          FROM HymnsFts hf
          JOIN Hymns h ON h.id = hf.hymn_id
          WHERE HymnsFts MATCH ?
        )
        GROUP BY id, verse_number
        ORDER BY score ASC
      `;

      // LIKE fallback (no fts5): mirror the Jesus-name expansion by trying each
      // variant param against text/title/authors. Each variant fills three
      // placeholders.
      const likeParams = makeJesusNameLikeParams(query);
      const likeWhere = likeParams
        .map(
          () =>
            '(lower(v.text) LIKE lower(?) OR lower(h.title) LIKE lower(?) OR lower(h.authors) LIKE lower(?))',
        )
        .join(' OR ');
      const likeSearchQuery = `
        SELECT DISTINCT
          h.id,
          h.number,
          h.category,
          h.title,
          h.authors,
          v.text as matched_verse,
          v.verse_number
        FROM Hymns h
        JOIN HymnVerses v ON h.id = v.hymn_id
        WHERE ${likeWhere}
        ORDER BY h.number, v.verse_number
      `;

      let resultRows = (
        await execWithLikeFallback(
          hymnsDatabaseService,
          {sql: ftsSearchQuery, params: [ftsParam, ftsParam]},
          {sql: likeSearchQuery, params: likeParams.flatMap(p => [p, p, p])},
        )
      ).rows as any[];

      // Strict search found nothing: correct the query's spelling against the
      // hymn corpus vocabulary and run the SAME search again, so a typo still
      // finds the hymn — through the normal title-boosted ranking rather than
      // a separate fuzzy score.
      if (resultRows.length === 0 && !matchWholeWord && normalizedQuery.length >= 3) {
        const corrected = await correctQueryViaVocabulary(hymnsDatabaseService, normalizedQuery);
        if (corrected) {
          const correctedParam = makeFtsPrefixQuery(corrected, expandJesusToken);
          resultRows = (
            await execWithLikeFallback(
              hymnsDatabaseService,
              {sql: ftsSearchQuery, params: [correctedParam, correctedParam]},
              {sql: likeSearchQuery, params: likeParams.flatMap(p => [p, p, p])},
            )
          ).rows as any[];
        }
      }

      // Collapse the per-verse rows (already ordered best-score-first) into one
      // result per hymn. The first row seen for a hymn is its best match, so it
      // drives the card snippet; subsequent verse rows accumulate into
      // matchedVerses for the accordion. Insertion order preserves the score
      // ranking across hymns.
      const byHymn = new Map<string, HymnSearchResult>();

      for (const row of resultRows) {
        const existing = byHymn.get(row.id);
        const hasVerse =
          row.matched_verse !== null && row.matched_verse !== undefined;

        if (!existing) {
          byHymn.set(row.id, {
            id: row.id,
            number: row.number,
            category: row.category || '',
            title: row.title,
            authors: row.authors || '',
            matchedVerse: hasVerse ? row.matched_verse : undefined,
            verseNumber: hasVerse ? row.verse_number : undefined,
            matchedVerses: hasVerse
              ? [{ verseNumber: row.verse_number, text: row.matched_verse }]
              : [],
            matchCount: hasVerse ? 1 : 0,
          });
          continue;
        }

        // A title-only arm (no verse) for an already-seen hymn adds nothing to
        // the verse list; only verse rows accumulate.
        if (hasVerse) {
          existing.matchedVerses.push({
            verseNumber: row.verse_number,
            text: row.matched_verse,
          });
          existing.matchCount = existing.matchedVerses.length;
          // If the hymn was first seen via a title-only row, adopt this verse
          // as the collapsed snippet so the card isn't left blank.
          if (existing.matchedVerse === undefined) {
            existing.matchedVerse = row.matched_verse;
            existing.verseNumber = row.verse_number;
          }
        }
      }

      // Sort each hymn's verses by verse number for stable accordion display
      // (collection order followed score, not verse order).
      const searchResults = Array.from(byHymn.values());
      for (const result of searchResults) {
        result.matchedVerses.sort((a, b) => a.verseNumber - b.verseNumber);
      }

      return searchResults;
    } catch (err) {
      setError(t('errors.hymnSearch'));
      console.error('Hymn search error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    searchHymns,
    isLoading,
    error,
  };
};
