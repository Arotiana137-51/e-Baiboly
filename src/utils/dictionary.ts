/**
 * Headwords, search and tappable links for the Bible dictionary (Diksionera
 * amin' ny Baiboly).
 *
 * The book cites verses as "Genesisy 17 : 5" or "II Samoela 15 : 1 - 4", often
 * several in a row where only the first names the book: "(Marka 14 : 36 ;
 * 15 : 2 ; Romana 8 : 15)". A bare "4 : 15" with no book before it means the
 * entry's own book, so it stays plain text. "Jereo Vatosoa" points to another
 * entry.
 */
import {BOOKS, escapeRegex} from './bibleRefs';
import {normalizeForHighlight} from './searchHighlight';

export type DictionaryWord = {id: number; word: string};

export type IndexedWord = DictionaryWord & {
  // "ABAGITA (Estera 1 : 10)" -> main "ABAGITA", detail "(Estera 1 : 10)".
  main: string;
  detail: string;
  // Normalized spellings, each once, the whole headword first: "ADONIRAMA,
  // na ADORAMA" gives ["adonirama na adorama", "adonirama", "adorama"],
  // "ABAGITA" just ["abagita"].
  keys: string[];
};

export type DictionaryRef = {
  bookId: number;
  bookName: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
};

export type DictionarySegment =
  | {kind: 'plain'; text: string}
  | ({kind: 'ref'; text: string} & DictionaryRef)
  | {kind: 'entry'; text: string; entryId: number};

// A range that runs into the next chapter ("2 : 4 - 3 : 24") is shown to the
// end of its first chapter; no chapter has this many verses.
export const END_OF_CHAPTER = 999;

const SPELLINGS = /(\s*,\s*(?:na\s+)?|\s+(?:na|sy)\s+)/;

// The other spellings are the parts after "na", or in capitals like the
// headword: "ADONIRAMA, na ADORAMA", "VOLON-JAVATRA sy SORA-JAVATRA". A part
// in small letters otherwise describes the word ("JEREMIA, Mpaminany",
// "MPANJAKA, Ny bokin'ny") and must not stand for it in a "Jereo" link.
const spellings = (main: string): string[] => {
  const parts = main.split(SPELLINGS);
  const kept = [parts[0]];
  for (let i = 2; i < parts.length; i += 2) {
    if (/\bna\b/.test(parts[i - 1]) || parts[i] === parts[i].toUpperCase()) kept.push(parts[i]);
  }
  return kept;
};

export const indexDictionaryWords = (words: DictionaryWord[]): IndexedWord[] =>
  words.map(w => {
    const paren = w.word.indexOf(' (');
    const main = paren === -1 ? w.word : w.word.slice(0, paren);
    const detail = paren === -1 ? '' : w.word.slice(paren + 1);
    const keys = [...new Set([main, ...spellings(main)].map(normalizeForHighlight))].filter(Boolean);
    return {...w, main, detail, keys};
  });

// Headwords that start with the query first, then those that contain it, each
// in the book's A to Z order.
export const searchDictionary = (words: IndexedWord[], query: string): IndexedWord[] => {
  const q = normalizeForHighlight(query);
  if (!q) return words;
  const starts: IndexedWord[] = [];
  const contains: IndexedWord[] = [];
  for (const w of words) {
    if (w.keys.some(k => k.startsWith(q))) starts.push(w);
    else if (w.keys[0].includes(q)) contains.push(w);
  }
  return [...starts, ...contains];
};

// Letters to change, add or drop to turn a into b, or max + 1 as soon as it
// can't be max or less: it runs on every keystroke, over the whole book.
const editDistance = (a: string, b: string, max: number): number => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
};

// Typo tolerance like the Bible search's, used when nothing matches: the
// headwords within a letter or two of what was typed, against the whole word
// or its start ("abrahma" finds ABRAHAMA), closest first.
export const fuzzyDictionary = (words: IndexedWord[], query: string, limit = 20): IndexedWord[] => {
  const q = normalizeForHighlight(query);
  if (q.length < 4) return [];
  const max = q.length <= 5 ? 1 : 2;
  const close: Array<{w: IndexedWord; d: number}> = [];
  for (const w of words) {
    let d = Infinity;
    for (const k of w.keys) d = Math.min(d, editDistance(q, k, max), editDistance(q, k.slice(0, q.length), max));
    if (d <= max) close.push({w, d});
  }
  return close
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map(c => c.w);
};

const firstLetter = (w: IndexedWord) => w.keys[0].charAt(0).toUpperCase();

// The A to Z buttons: only the letters the headwords start with (the text
// both apps carry has no P or R), sorted.
export const dictionaryLetters = (words: IndexedWord[]): string[] =>
  [...new Set(words.map(firstLetter))].filter(Boolean).sort();

export const wordsUnderLetter = (words: IndexedWord[], letter: string): IndexedWord[] =>
  words.filter(w => firstLetter(w) === letter);

// One section per letter, A to Z, each in the book's order: the headers that
// stay pinned at the top of the list while it scrolls.
export const groupByLetter = (words: IndexedWord[]): Array<{title: string; data: IndexedWord[]}> => {
  const groups = new Map<string, IndexedWord[]>();
  for (const w of words) {
    const letter = firstLetter(w);
    const group = groups.get(letter);
    if (group) group.push(w);
    else groups.set(letter, [w]);
  }
  return [...groups.keys()].sort().map(title => ({title, data: groups.get(title)!}));
};

// "Vatosoa" -> the entry it names. Whole headwords win over the alternative
// spellings, and the first entry of a name (book order) over its homonyms.
export const buildEntryFinder = (words: IndexedWord[]) => {
  const byKey = new Map<string, number>();
  for (const pass of [0, 1]) {
    for (const w of words) {
      const keys = pass === 0 ? w.keys.slice(0, 1) : w.keys.slice(1);
      for (const k of keys) if (!byKey.has(k)) byKey.set(k, w.id);
    }
  }
  return (phrase: string) => byKey.get(normalizeForHighlight(phrase));
};

// Books.name, plus the dictionary's "Fitomaniana Jeremia" for Lamentations.
// Longest first so "II Samoela" wins over "I Samoela" and "Fitomaniana
// Jeremia" over "Jeremia".
const BOOK_NAMES = [...BOOKS, {id: 25, name: 'Fitomaniana Jeremia'}].sort(
  (a, b) => b.name.length - a.name.length,
);
const BOOK_ID = new Map(BOOK_NAMES.map(b => [b.name, b.id]));
const BOOK_NAME = new Map(BOOKS.map(b => [b.id, b.name]));

// chapter : verse, then an optional "- verse" or "- chapter : verse".
const RANGE = '(\\d{1,3})\\s*:\\s*(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3})(?:\\s*:\\s*(\\d{1,3}))?)?';
// The book must start a word: "Rota" is not the end of "Karota". A captured
// leading character instead of a lookbehind.
const REF = new RegExp(
  `(^|[^A-Za-zÀ-ÖØ-öø-ÿ'’-])(${BOOK_NAMES.map(b => escapeRegex(b.name)).join('|')})\\s+${RANGE}`,
  'g',
);
const NEXT_REF = new RegExp(`^(\\s*;\\s*)${RANGE}`);
const SEE_ALSO = /\b[Jj]ereo(?:\s+koa)?(?:\s+ny\s+hoe)?\s+[«"“]?\s*/g;
// What can follow a linked name to list another: "Jereo Debora sy Jaela",
// "Jereo X, Y na Z".
const LIST_NEXT = /\s*,\s*(?:sy\s+|na\s+)?|\s+(?:sy|na)\s+/y;
const PHRASE_END = /[.,;:()[\]«»"“”\n]/;
const WORD = /\S+/g;
// Headwords are at most a few words long.
const MAX_SEE_ALSO_WORDS = 4;
const MAX_SEE_ALSO_CHARS = 60;

const toRef = (bookId: number, groups: Array<string | undefined>): DictionaryRef => {
  const [chapter, verse, end, endVerse] = groups;
  const verseStart = Number(verse);
  let verseEnd = verseStart;
  if (endVerse === undefined) {
    if (end !== undefined) verseEnd = Math.max(verseStart, Number(end));
  } else if (Number(end) === Number(chapter)) {
    // "41 : 7 - 41 : 15" only names its own chapter again.
    verseEnd = Math.max(verseStart, Number(endVerse));
  } else {
    verseEnd = END_OF_CHAPTER;
  }
  return {bookId, bookName: BOOK_NAME.get(bookId) ?? '', chapter: Number(chapter), verseStart, verseEnd};
};

// The longest run of words at the start of text that names an entry, up to
// the first punctuation.
const entryAtStart = (
  text: string,
  findEntry: (phrase: string) => number | undefined,
): {phrase: string; entryId: number} | null => {
  const stop = text.search(PHRASE_END);
  const run = text.slice(0, Math.min(stop === -1 ? text.length : stop, MAX_SEE_ALSO_CHARS));
  const wordEnds: number[] = [];
  WORD.lastIndex = 0;
  let w: RegExpExecArray | null;
  while ((w = WORD.exec(run)) !== null && wordEnds.length < MAX_SEE_ALSO_WORDS) {
    wordEnds.push(w.index + w[0].length);
  }
  for (let n = wordEnds.length; n > 0; n -= 1) {
    const phrase = run.slice(0, wordEnds[n - 1]);
    const entryId = findEntry(phrase);
    if (entryId !== undefined) return {phrase, entryId};
  }
  return null;
};

// "Jereo X" -> the longest run of words after it that names an entry, then
// each one listed after it ("Jereo Debora sy Jaela").
const linkSeeAlso = (
  text: string,
  findEntry: (phrase: string) => number | undefined,
): DictionarySegment[] => {
  const segments: DictionarySegment[] = [];
  let plainStart = 0;
  SEE_ALSO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SEE_ALSO.exec(text)) !== null) {
    let phraseStart = m.index + m[0].length;
    let found = entryAtStart(text.slice(phraseStart), findEntry);
    while (found) {
      if (phraseStart > plainStart) segments.push({kind: 'plain', text: text.slice(plainStart, phraseStart)});
      segments.push({kind: 'entry', text: found.phrase, entryId: found.entryId});
      plainStart = phraseStart + found.phrase.length;
      LIST_NEXT.lastIndex = plainStart;
      const next = LIST_NEXT.exec(text);
      if (!next) break;
      phraseStart = plainStart + next[0].length;
      found = entryAtStart(text.slice(phraseStart), findEntry);
    }
    SEE_ALSO.lastIndex = Math.max(SEE_ALSO.lastIndex, plainStart);
  }
  if (plainStart < text.length) segments.push({kind: 'plain', text: text.slice(plainStart)});
  return segments;
};

// About 1% of the book's refs cite a verse MG1865 doesn't have ("Nomery 37 :
// 12"): those stay plain text. A range past the chapter's end stops at its
// last verse. chapterSizes maps "bookId:chapter" to the chapter's last verse.
export const resolveRef = (
  ref: DictionaryRef,
  chapterSizes: Map<string, number>,
): DictionaryRef | null => {
  const last = chapterSizes.get(`${ref.bookId}:${ref.chapter}`);
  if (last === undefined || ref.verseStart < 1 || ref.verseStart > last) return null;
  return ref.verseEnd > last ? {...ref, verseEnd: last} : ref;
};

// The app's own "Genesisy 17:5-9", not the book's "Genesisy 17 : 5 - 9".
export const formatRef = (ref: DictionaryRef): string =>
  `${ref.bookName} ${ref.chapter}:${ref.verseStart}` +
  (ref.verseEnd > ref.verseStart ? `-${ref.verseEnd}` : '');

// Every entry the text sends to with "Jereo X", once each, in reading order:
// gathered at the end like a dictionary's "see also".
export const linkedEntries = (paragraphs: DictionarySegment[][], selfId: number): number[] => {
  const ids: number[] = [];
  for (const segments of paragraphs) {
    for (const s of segments) {
      if (s.kind === 'entry' && s.entryId !== selfId && !ids.includes(s.entryId)) ids.push(s.entryId);
    }
  }
  return ids;
};

/**
 * Split one paragraph into plain text, Bible refs and links to other entries.
 * Concatenating every segment's text gives the paragraph back unchanged.
 */
export const parseDictionaryParagraph = (
  text: string,
  findEntry: (phrase: string) => number | undefined,
): DictionarySegment[] => {
  const segments: DictionarySegment[] = [];
  let plainStart = 0;
  const pushPlain = (end: number) => {
    if (end > plainStart) segments.push(...linkSeeAlso(text.slice(plainStart, end), findEntry));
  };

  REF.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REF.exec(text)) !== null) {
    const bookId = BOOK_ID.get(m[2]) ?? 0;
    const refStart = m.index + m[1].length;
    pushPlain(refStart);
    segments.push({kind: 'ref', text: text.slice(refStart, REF.lastIndex), ...toRef(bookId, m.slice(3))});

    // "; 15 : 2" right after a ref: the same book.
    let end = REF.lastIndex;
    let next: RegExpExecArray | null;
    while ((next = NEXT_REF.exec(text.slice(end))) !== null) {
      segments.push({kind: 'plain', text: next[1]});
      segments.push({
        kind: 'ref',
        text: next[0].slice(next[1].length),
        ...toRef(bookId, next.slice(2)),
      });
      end += next[0].length;
    }
    plainStart = end;
    REF.lastIndex = end;
  }
  pushPlain(text.length);
  return segments;
};
