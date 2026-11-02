// Diacritics- and punctuation-insensitive search highlighting helpers.
// Mirrors the FTS normalization used at index/query time so visual
// highlights line up with what the search actually matched.

export const normalizeForHighlight = (value: string): string => {
  if (typeof value !== 'string' || !value) return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export type HighlightRange = { start: number; end: number };

// Find ranges in `text` (in its ORIGINAL form) that match any token of
// `normalizedQuery`, ignoring diacritics and punctuation.
// `wholeWord`: only words that are a token exactly ("tia", not "tiako"), as
// the whole-word search matched them.
export const findHighlightRanges = (
  text: string,
  normalizedQuery: string,
  wholeWord = false,
): HighlightRange[] => {
  if (!text || !normalizedQuery) return [];
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  // Build a folded representation of `text`, char-by-char, while remembering
  // the original index each folded character originated from.
  let flat = '';
  const folded: string[] = new Array(text.length);
  const offsets: number[] = new Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const stripped = ch
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const safe = /[a-z0-9]/i.test(stripped) ? stripped : ' ';
    folded[i] = safe;
    offsets[i] = flat.length;
    flat += safe;
  }

  // offsets is non-decreasing; binary search to map flat index -> original index.
  const flatToOrig = (flatIdx: number): number => {
    let lo = 0;
    let hi = offsets.length - 1;
    let ans = offsets.length;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid] <= flatIdx) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  };

  const raw: HighlightRange[] = [];
  for (const token of tokens) {
    if (!token) continue;
    let from = 0;
    while (from <= flat.length) {
      const idx = flat.indexOf(token, from);
      if (idx < 0) break;
      const startOrig = flatToOrig(idx);
      const endOrig = flatToOrig(idx + token.length - 1) + 1;
      // Grow to whole words: a bold slice inside a word renders as mixed
      // fonts on iOS (semibold glyphs next to regular ones).
      let start = startOrig;
      let end = endOrig;
      while (start > 0 && folded[start - 1] !== ' ') start--;
      while (end < text.length && folded[end] !== ' ') end++;
      if (end > start && (!wholeWord || (start === startOrig && end === endOrig))) raw.push({ start, end });
      from = idx + token.length;
    }
  }

  if (raw.length === 0) return [];

  raw.sort((a, b) => a.start - b.start);
  const merged: HighlightRange[] = [];
  for (const r of raw) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ start: r.start, end: r.end });
    }
  }
  return merged;
};

// Split `text` into alternating non-match / match segments.
export type HighlightSegment = { text: string; match: boolean };

export const segmentTextForHighlight = (
  text: string,
  ranges: HighlightRange[],
): HighlightSegment[] => {
  if (!ranges.length) return [{ text, match: false }];
  const out: HighlightSegment[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) {
      out.push({ text: text.slice(cursor, r.start), match: false });
    }
    out.push({ text: text.slice(r.start, r.end), match: true });
    cursor = r.end;
  }
  if (cursor < text.length) {
    out.push({ text: text.slice(cursor), match: false });
  }
  return out;
};
