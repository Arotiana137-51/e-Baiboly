// scripts/source-data/hymns/loaders/types.js
//
// JSDoc-only "interface" for hymn source loaders. There's no runtime code
// here — this file exists so the rest of the build pipeline has a single,
// documented contract to refer to. Each loader for a given source format
// (JSON, YAML, …) returns an iterable of HymnRecord values that the builder
// can blindly insert.
//
// Interface segregation: the builder depends ONLY on { sourcePath, load() }.
// It doesn't import js-yaml, JSON.parse, or any format-specific concerns —
// those live behind each loader.

/**
 * @typedef {Object} HymnVerseRecord
 * @property {number} number    Verse number ("andininy"). Use 0 for choruses
 *                              so the existing reader keeps treating
 *                              `is_chorus` rows as repeatable refrains
 *                              irrespective of position.
 * @property {string} [heading] Cue printed above this stanza ("Fizarana II",
 *                              "Vakiteny 3", "Manaraka ny faharoa"). Not
 *                              lyrics; the reader renders it as a label.
 * @property {string} text      Verse/chorus body. Internal line breaks
 *                              preserved as `\n`.
 * @property {boolean} isChorus True when this block should render as a
 *                              chorus/refrain ("fiverenany").
 */

/**
 * @typedef {Object} HymnRecord
 * @property {string} id           e.g. 'ffpm_42', 'fifo_1'. Unique across all
 *                                 categories — used as the Hymns.id primary
 *                                 key.
 * @property {number} number       1-based hymn number within its category.
 * @property {string} category     'ffpm' | 'ff' | 'antema' | 'fifo'.
 * @property {string} title        Display title ("lohateny").
 * @property {string} [note]       Hymn-level annotation ("Maintimolaly",
 *                                 "Hira Paska", "Hira Antandroy") — printed
 *                                 under the number in the hymnbook, never
 *                                 sung. JSON: `fanamarihana`; YAML:
 *                                 `song_comment`.
 * @property {string[]} authors    Author list; may be empty.
 * @property {HymnVerseRecord[]} verses Ordered verses + choruses as they
 *                                 should appear in the reader.
 */

/**
 * @typedef {Object} HymnLoader
 * @property {string} sourcePath  Absolute path to the source file. Builder
 *                                checks fs.existsSync(sourcePath) before
 *                                calling load(), so a missing file is a
 *                                no-op rather than a crash.
 * @property {() => Iterable<HymnRecord>} load  Pull records lazily from
 *                                sourcePath. Generator functions are fine —
 *                                the builder just for-of's the result.
 * @property {(text: string) => Iterable<HymnRecord>} parse  Same shape as
 *                                load(), but accepts the source as a string.
 *                                Used by the OTA patch builder, which has to
 *                                diff a git-show'd previous version against
 *                                the working tree.
 */

module.exports = {};
