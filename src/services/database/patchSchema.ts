/**
 * Patch file schema — shared by the on-device PatchManager and the
 * `scripts/buildPatch.js` builder. Hand-mirrored into the JS builder by
 * eye, because the builder is plain CJS and pulling TS into Node isn't
 * worth the toolchain cost for ~30 lines.
 *
 * Versioning: every file is identified by a YYYYMMDD integer (same scheme
 * as BIBLE_DB_VERSION / HYMNS_DB_VERSION). PRAGMA user_version on the
 * device tracks the latest patch applied.
 */

export type PatchTarget = 'bible' | 'hymns';

export interface PatchIndex {
  /** Highest patch version currently published. */
  latest: number;
  /** All published patch versions, ascending. Sparse is fine. */
  patches: number[];
  /**
   * The oldest content version from which incremental patches can still
   * carry a device forward. Devices below this should wait for the next
   * APK refresh instead of trying to patch — avoids unbounded chains.
   */
  minBaseline: number;
}

export interface BibleVersePatchRow {
  book_id: number;
  chapter: number;
  verse_number: number;
  text: string;
  /** Pre-normalized FTS payload — the builder runs the same
   *  normalizeForFtsContent the build script uses. The app never
   *  re-normalizes, so any future tokenizer change ships in the patch
   *  builder, not the app. */
  text_plain: string;
  /** Optional verse-level heading. `null` clears an existing title. */
  title: string | null;
}

export interface BibleBookPatchRow {
  id: number;
  name: string;
  testament: 'old' | 'new';
  chapters: number;
  filename: string;
}

export interface BiblePatchFile {
  version: number;
  appliesTo: 'bible';
  verses: BibleVersePatchRow[];
  books: BibleBookPatchRow[];
}

export interface HymnPatchRow {
  id: string;
  number: number;
  category: string;
  title: string;
  /** Pre-normalized for HymnsFts.title_plain. */
  title_plain: string;
  /** JSON-encoded array (matches the existing Hymns.authors column). */
  authors: string | null;
  authors_plain: string;
  /** Hymnbook annotation under the number ("Maintimolaly"). `null` clears. */
  note: string | null;
}

export interface HymnVersePatchRow {
  hymn_id: string;
  verse_number: number;
  /** Cue printed above the stanza ("Fizarana II"). `null` clears. */
  heading: string | null;
  text: string;
  text_plain: string;
  is_chorus: 0 | 1;
}

export interface HymnsPatchFile {
  version: number;
  appliesTo: 'hymns';
  hymns: HymnPatchRow[];
  hymnVerses: HymnVersePatchRow[];
}

export type PatchFile = BiblePatchFile | HymnsPatchFile;

// ---------------------------------------------------------------------------
// Runtime validators — defensive parsing so a corrupt/spoofed patch can't
// drive arbitrary SQL. We hand-check every field; unknown keys are ignored.
// ---------------------------------------------------------------------------

function isIntInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

function isYyyymmdd(v: unknown): v is number {
  return isIntInRange(v, 20000000, 99999999);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

export function isValidPatchIndex(raw: unknown): raw is PatchIndex {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  if (!isYyyymmdd(r.latest)) return false;
  if (!isYyyymmdd(r.minBaseline)) return false;
  if (!Array.isArray(r.patches)) return false;
  return r.patches.every(p => isYyyymmdd(p));
}

function isValidBibleRow(raw: unknown): raw is BibleVersePatchRow {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return (
    isIntInRange(r.book_id, 1, 66) &&
    isIntInRange(r.chapter, 1, 200) &&
    isIntInRange(r.verse_number, 1, 200) &&
    typeof r.text === 'string' &&
    typeof r.text_plain === 'string' &&
    (r.title === null || typeof r.title === 'string')
  );
}

function isValidHymnVerseRow(raw: unknown): raw is HymnVersePatchRow {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return (
    isNonEmptyString(r.hymn_id) &&
    isIntInRange(r.verse_number, 1, 50) &&
    // Patches published before the column existed carry no `heading` key.
    (r.heading == null || typeof r.heading === 'string') &&
    typeof r.text === 'string' &&
    typeof r.text_plain === 'string' &&
    (r.is_chorus === 0 || r.is_chorus === 1)
  );
}

export function parsePatchFile(
  raw: unknown,
  expectedTarget: PatchTarget,
  expectedVersion: number,
): PatchFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.appliesTo !== expectedTarget) return null;
  if (r.version !== expectedVersion) return null;

  if (expectedTarget === 'bible') {
    const verses = Array.isArray(r.verses) ? r.verses : [];
    const books = Array.isArray(r.books) ? r.books : [];
    if (!verses.every(isValidBibleRow)) return null;
    // books are rare; we validate minimally and tolerate empty
    return {
      version: expectedVersion,
      appliesTo: 'bible',
      verses: verses as BibleVersePatchRow[],
      books: books as BibleBookPatchRow[],
    };
  }

  const hymnVerses = Array.isArray(r.hymnVerses) ? r.hymnVerses : [];
  const hymns = Array.isArray(r.hymns) ? r.hymns : [];
  if (!hymnVerses.every(isValidHymnVerseRow)) return null;
  return {
    version: expectedVersion,
    appliesTo: 'hymns',
    hymns: hymns as HymnPatchRow[],
    hymnVerses: hymnVerses as HymnVersePatchRow[],
  };
}
