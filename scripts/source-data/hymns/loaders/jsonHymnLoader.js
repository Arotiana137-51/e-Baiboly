// scripts/source-data/hymns/loaders/jsonHymnLoader.js
//
// JSON source format used by the three original hymn categories
// (ffpm, ff, antema). Top-level keys are the hymn ids; each value carries
// laharana/sokajy/lohateny/mpanoratra/hira[]. This loader is the lifted
// version of the inline parse loop that used to live in
// scripts/buildHymnsDatabase.js. See loaders/types.js for the contract.

const fs = require('fs');

// FFPM hymns have no title in the book: they go by their first line. Without
// this, favorites, search results and the action popover show a blank.
function firstLineTitle(verses) {
  const first = verses
    .filter((v) => !v.isChorus && v.text.trim())
    .sort((a, b) => a.number - b.number)[0];
  return first ? first.text.trim().split('\n')[0].trim().replace(/[\s,;:]+$/, '') : '';
}

/**
 * @param {string} filePath
 * @param {string} fallbackCategory  Used when a hymn's `sokajy` field is
 *   absent or blank. The existing files all carry it, but defending here
 *   keeps the builder honest if a future JSON drops it.
 * @returns {import('./types').HymnLoader}
 */
function* parseJsonHymns(text, fallbackCategory) {
  if (!text) return;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return;
  }
  for (const [hymnId, hymn] of Object.entries(data)) {
    const authors = Array.isArray(hymn.mpanoratra) ? hymn.mpanoratra : [];
    const verses = (hymn.hira || []).map((v) => ({
      number: Number(v.andininy) || 0,
      heading: String(v.lohateny || ''),
      text: String(v.tononkira || ''),
      isChorus: !!v.fiverenany,
    }));
    yield {
      id: hymnId,
      number: parseInt(hymn.laharana, 10) || 0,
      category: hymn.sokajy || fallbackCategory,
      title: hymn.lohateny || firstLineTitle(verses),
      note: String(hymn.fanamarihana || ''),
      authors,
      verses,
    };
  }
}

function createJsonHymnLoader(filePath, fallbackCategory) {
  return {
    sourcePath: filePath,
    parse: (text) => parseJsonHymns(text, fallbackCategory),
    load() {
      return parseJsonHymns(fs.readFileSync(filePath, 'utf8'), fallbackCategory);
    },
  };
}

module.exports = { createJsonHymnLoader, parseJsonHymns };
