// A note belongs to verses, not to character positions: it survives the
// Jesoa/Jesosy switch and OTA text patches, which shift character offsets.
export type BibleNoteAnchor = {
  kind: 'bible';
  bookId: number;
  chapter: number;
  verseStart: number;
  verseEnd: number;
};

// stanza 0 is the chorus; null is a note on the whole hymn (key, tempo,
// when it is sung).
export type HymnNoteAnchor = {
  kind: 'hymn';
  hymnId: string;
  stanza: number | null;
};

export type NoteAnchor = BibleNoteAnchor | HymnNoteAnchor;

export type Note = {
  id: string;
  anchor: NoteAnchor;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export const generateNoteId = (): string =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

// Two anchors open the same note when they start at the same place: same
// first verse in the same chapter, or the same stanza (or whole hymn).
export const sameAnchorStart = (a: NoteAnchor, b: NoteAnchor): boolean => {
  if (a.kind === 'bible' && b.kind === 'bible') {
    return a.bookId === b.bookId && a.chapter === b.chapter && a.verseStart === b.verseStart;
  }
  if (a.kind === 'hymn' && b.kind === 'hymn') {
    return a.hymnId === b.hymnId && a.stanza === b.stanza;
  }
  return false;
};

// Identifies where a note starts, whatever its end verse.
export const anchorStartKey = (a: NoteAnchor): string =>
  a.kind === 'bible'
    ? `bible:${a.bookId}:${a.chapter}:${a.verseStart}`
    : `hymn:${a.hymnId}:${a.stanza ?? 'whole'}`;

export const chapterNotes =(notes: Note[], bookId: number, chapter: number): Note[] =>
  notes.filter(
    n => n.anchor.kind === 'bible' && n.anchor.bookId === bookId && n.anchor.chapter === chapter,
  );

export const hymnNotes = (notes: Note[], hymnId: string): Note[] =>
  notes.filter(n => n.anchor.kind === 'hymn' && n.anchor.hymnId === hymnId);

// Bible order (book, chapter, verse), then hymns; a whole-hymn note comes
// before its stanza notes.
export const compareNotes = (a: Note, b: Note): number => {
  const x = a.anchor;
  const y = b.anchor;
  if (x.kind !== y.kind) return x.kind === 'bible' ? -1 : 1;
  if (x.kind === 'bible' && y.kind === 'bible') {
    return x.bookId - y.bookId || x.chapter - y.chapter || x.verseStart - y.verseStart;
  }
  if (x.kind === 'hymn' && y.kind === 'hymn') {
    return x.hymnId.localeCompare(y.hymnId) || (x.stanza ?? -1) - (y.stanza ?? -1);
  }
  return 0;
};

export type VerseNoteMarks = {
  // The margin bracket through this verse. Where notes overlap, the one that
  // starts latest owns the verse.
  bracket: {noteId: string; isStart: boolean; isEnd: boolean} | null;
  // A note starting here: the verse number turns into its button.
  startNoteId: string | null;
  // Notes ending here: the start of each is written under the verse.
  previews: Array<{noteId: string; snippet: string}>;
};

export const firstLineOf = (text: string): string => text.trim().split('\n')[0].trim();

export type SnippetBudget = {maxWords: number; maxChars: number};

// How much of a note the reader shows under its verse: a few words, so a
// long note never takes over the page. Sized on the width, since that is what
// limits a single line: phones in portrait, large phones, then tablets and
// phones in landscape.
export const noteSnippetBudget = (width: number): SnippetBudget =>
  width < 400
    ? {maxWords: 3, maxChars: 28}
    : width < 600
    ? {maxWords: 4, maxChars: 36}
    : {maxWords: 6, maxChars: 52};

// The first words of a note's first line, with "…" whenever something was
// left out (more words, more lines, or a word cut short). Splits on plain
// whitespace only, so Malagasy apostrophes and accents stay inside words.
export const noteSnippet = (text: string, {maxWords, maxChars}: SnippetBudget): string => {
  const trimmed = text.trim();
  const words = firstLineOf(trimmed).split(/\s+/).filter(Boolean);
  let out = words.slice(0, maxWords).join(' ');
  let cut = words.length > maxWords || trimmed.includes('\n');
  if (out.length > maxChars) {
    const lastSpace = out.lastIndexOf(' ', maxChars);
    out = lastSpace > 0 ? out.slice(0, lastSpace) : out.slice(0, maxChars);
    cut = true;
  }
  return cut ? `${out}…` : out;
};

// What each verse of a chapter shows for its notes, by verse number.
export const noteMarksForVerses = (
  notes: Note[],
  budget: SnippetBudget,
): Record<number, VerseNoteMarks> => {
  const out: Record<number, VerseNoteMarks> = {};
  const at = (v: number) => (out[v] ??= {bracket: null, startNoteId: null, previews: []});
  const bible = notes
    .flatMap(n => (n.anchor.kind === 'bible' ? [{note: n, a: n.anchor}] : []))
    .sort((x, y) => x.a.verseStart - y.a.verseStart);
  for (const {note, a} of bible) {
    for (let v = a.verseStart; v <= a.verseEnd; v += 1) {
      at(v).bracket = {noteId: note.id, isStart: v === a.verseStart, isEnd: v === a.verseEnd};
    }
    at(a.verseStart).startNoteId ??= note.id;
    at(a.verseEnd).previews.push({noteId: note.id, snippet: noteSnippet(note.text, budget)});
  }
  return out;
};

// "13/10/2026": Hermes' toLocaleDateString ignores the device locale.
export const formatNoteDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};
