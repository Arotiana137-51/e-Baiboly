// scripts/source-data/hymns/loaders/yamlHymnLoader.js
//
// YAML source format used by the Fifohazana revival corpus. Top-level keys
// are `<book>::<N>` (e.g. `fifohazana::1`), values carry song_book /
// song_number / song_name / song_author / song_text / song_chapter /
// song_date_revised. song_text packs verses and choruses into `{ … }`
// blocks; see splitTextIntoBlocks() below for the parser.
//
// Choices documented inline at each judgment call:
//   - `{{ … }}` (double braces) marks a chorus block. Used in ~150 entries.
//   - `N.` prefix marks a numbered verse (andininy = N).
//   - In hymns that mix numbered and unnumbered blocks, the unnumbered ones
//     are also choruses (the source uses `{ … }` with no number for the
//     refrain in roughly half the call/response entries).
//   - `[FIV.]` lines are stripped — they're back-references ("repeat the
//     chorus here") that the reader doesn't expand; the chorus already
//     lives in the corpus as its own row, so leaving them in would just
//     show literal "[FIV.]" text.
//   - `«` and `»` are NOT chorus markers. They're the source's way of
//     escaping the lyrics' own quotation marks at the start/end of a verse;
//     stripping them as chorus would mis-classify ~123 entries.
//   - song_chapter (roman-numeral section group) and song_date_revised are
//     intentionally dropped — the Hymns schema has no field for them and
//     none of the existing categories carry them either.

const fs = require('fs');
const yaml = require('js-yaml');

/**
 * Strip back-reference markers like `[FIV.]` from a verse body. They
 * tell a human singer "now repeat the chorus" — the reader doesn't expand
 * them, so leaving them in would just show literal "[FIV.]" text.
 *
 * @param {string} text
 */
function stripFivMarkers(text) {
  return text.replace(/\[\s*FIV\.?\s*\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Split a song_text payload into ordered blocks, each tagged as chorus or
 * verse based on the bracing convention.
 *
 * Format conventions in this corpus:
 *   - `{ … }`  single-braced block  → verse (or chorus, if mixed-context)
 *   - `{{ … }}` double-braced block → explicit chorus
 *
 * We scan brace-by-brace rather than line-by-line because a verse may
 * legitimately contain blank lines inside the braces. The double-brace
 * case is detected by looking ahead one char at each open / one char
 * before each close.
 *
 * @param {string} text
 * @returns {Array<{ body: string, doubleBraced: boolean }>}
 */
function splitTextIntoBlocks(text) {
  const blocks = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '{') { i += 1; continue; }

    // Detect `{{` (chorus) vs `{` (verse).
    const isDouble = text[i + 1] === '{';
    const openLen = isDouble ? 2 : 1;
    const contentStart = i + openLen;

    // Walk to the matching closer. Inside a single-brace block we still
    // need to balance any further `{` / `}` pairs the source happens to
    // include; inside a double-brace block we close on the matching `}}`
    // (depth balanced against the inner braces).
    let depth = 1;
    let j = contentStart;
    let closeLen = openLen;
    while (j < text.length) {
      if (isDouble && text[j] === '}' && text[j + 1] === '}') {
        depth -= 1;
        if (depth === 0) { closeLen = 2; break; }
        j += 2; continue;
      }
      if (text[j] === '{') depth += 1;
      else if (text[j] === '}') {
        depth -= 1;
        if (depth === 0) { closeLen = 1; break; }
      }
      j += 1;
    }
    if (j >= text.length) break;  // unclosed brace — bail rather than guess.

    const body = text.slice(contentStart, j).trim();
    if (body.length > 0) {
      blocks.push({ body, doubleBraced: isDouble });
    }
    i = j + closeLen;
  }
  return blocks;
}

/**
 * Classify a single extracted block. Returns the cleaned text plus an
 * optional explicit verse number (from a `N.` prefix). Does NOT decide
 * chorus-vs-verse on its own — that's a per-hymn decision the caller
 * makes once it has seen every block (so it can apply the "unnumbered
 * blocks in a mixed hymn are choruses" rule).
 *
 * @param {{ body: string, doubleBraced: boolean }} block
 * @returns {{ text: string, doubleBraced: boolean, explicitNumber: number | null }}
 */
function classifyBlock(block) {
  const trimmed = block.body.trim();

  // Numbered verse: `1.`, `2.`, … at the start of the block. We tolerate
  // whitespace after the dot.
  const numbered = trimmed.match(/^(\d+)\.\s*([\s\S]*)$/);
  if (numbered) {
    return {
      text: stripFivMarkers(numbered[2]),
      doubleBraced: block.doubleBraced,
      explicitNumber: parseInt(numbered[1], 10),
    };
  }

  return {
    text: stripFivMarkers(trimmed),
    doubleBraced: block.doubleBraced,
    explicitNumber: null,
  };
}

/**
 * Strip a leading "N. " or "N.\t" prefix from a hymn title so it matches
 * the existing JSONs (which carry the number separately in `laharana`).
 *
 * @param {string} title
 * @returns {string}
 */
function stripTitleNumberPrefix(title) {
  return title.replace(/^\s*\d+\.\s*/, '').trim();
}

function* parseYamlHymns(text, category) {
  if (!text) return;
  let data;
  try {
    data = yaml.load(text) || {};
  } catch {
    return;
  }

  for (const value of Object.values(data)) {
    const songNumber = Number(value?.song_number);
    if (!Number.isFinite(songNumber) || songNumber <= 0) continue;

    const songText = String(value?.song_text || '');
    const classified = splitTextIntoBlocks(songText).map(classifyBlock);

    // Chorus decision per hymn:
    //   - `{{ … }}` is always a chorus.
    //   - If the hymn mixes numbered and unnumbered blocks, the
    //     unnumbered ones are choruses (call/response structure).
    //   - If the hymn has only unnumbered blocks, they're verses (the
    //     `{ … }` wrapping doesn't carry any chorus signal on its own).
    const hasNumbered = classified.some((c) => c.explicitNumber != null);

    let nextSequential = 1;
    const verses = [];
    for (const block of classified) {
      const isChorus =
        block.doubleBraced || (hasNumbered && block.explicitNumber == null);

      if (isChorus) {
        // Choruses pin andininy to 0 so the reader's is_chorus styling
        // keeps working regardless of position.
        verses.push({ number: 0, text: block.text, isChorus: true });
        continue;
      }

      const number =
        block.explicitNumber != null ? block.explicitNumber : nextSequential;
      verses.push({ number, text: block.text, isChorus: false });
      nextSequential = Math.max(nextSequential, number) + 1;
    }

    const author = value?.song_author;
    const authors =
      author == null || String(author).trim() === ''
        ? []
        : [String(author).trim()];

    // song_comment is the hymn-level annotation ("(Hira Antandroy)",
    // "(Isaia 35)", …); the source wraps some in parens, some not.
    const note = String(value?.song_comment || '')
      .trim()
      .replace(/^\(\s*/, '')
      .replace(/\s*\)$/, '')
      .trim();

    yield {
      id: `${category}_${songNumber}`,
      number: songNumber,
      category,
      title: stripTitleNumberPrefix(String(value?.song_name || '')),
      note,
      authors,
      verses,
    };
  }
}

/**
 * @param {string} filePath
 * @param {string} category
 * @returns {import('./types').HymnLoader}
 */
function createYamlHymnLoader(filePath, category) {
  return {
    sourcePath: filePath,
    parse: (text) => parseYamlHymns(text, category),
    load() {
      return parseYamlHymns(fs.readFileSync(filePath, 'utf8'), category);
    },
  };
}

module.exports = {
  createYamlHymnLoader,
  parseYamlHymns,
  // Exported for unit-testing / one-off CLI sanity checks.
  splitTextIntoBlocks,
  classifyBlock,
  stripTitleNumberPrefix,
};
