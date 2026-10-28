#!/usr/bin/env node
/**
 * Build an OTA patch file from a row-level diff of the YAML/JSON source
 * data between a previous git commit and the current working tree.
 *
 * Why: shipping a 3-word typo fix as a full APK update is wasteful for our
 * Madagascar users where data is expensive. This script emits a tiny JSON
 * file (~200 bytes per typo) that the on-device PatchManager will fetch
 * from GitHub Pages and apply via UPDATE statements.
 *
 * Usage:
 *   node scripts/buildPatch.js --target=bible  --since=<git-ref>  --version=20260605
 *   node scripts/buildPatch.js --target=hymns  --since=v1.2.0     --version=20260610
 *
 * Arguments:
 *   --target   bible | hymns                            (required)
 *   --since    any git ref: SHA, tag, branch name, or
 *              HEAD~N. Compared against the working tree
 *              to discover changed rows.                (required)
 *   --version  the version `yarn build:<target>` just
 *              stamped into dbVersions.ts.              (required)
 *   --dry-run  print the diff but do not write files.   (optional)
 *
 * Output:
 *   docs/patches/<target>/<version>.json   (the patch payload)
 *   docs/patches/<target>/index.json       (updated, version appended)
 *
 * Workflow (docs/patches/README.md):
 *   1. yarn build:<target>            (bumps the version when the content
 *                                       changed and prints it)
 *   2. yarn build:patch  -- --target=<target> --since=<prev> --version=<printed>
 *   3. git add docs/patches/... && git push
 *      GitHub Pages republishes → connected users pick it up.
 */

const fs = require('fs');
const path = require('path');
const {execFileSync, execSync} = require('child_process');
const yaml = require('js-yaml');

const {getSourceDataPaths} = require('./utils/paths');
const PATCH_FLOORS = require('./utils/patchFloors');
const DB_VERSIONS = require('./utils/dbVersions');
const {cleanDisplayText, normalizeForFtsContent, normalizeHymnAuthors} = require('./utils/buildDb');
const {
  createJsonHymnLoader,
} = require('./source-data/hymns/loaders/jsonHymnLoader');
const {
  createYamlHymnLoader,
} = require('./source-data/hymns/loaders/yamlHymnLoader');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCS_PATCHES_DIR = path.join(REPO_ROOT, 'docs', 'patches');

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') {
      out['dry-run'] = '1';
      continue;
    }
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
}

/**
 * Read a file at a specific git ref. Returns null if the file didn't
 * exist at that ref (newly added files have no "before" state to diff).
 */
function gitShow(ref, repoRelativePath) {
  try {
    // The forward-slash form is what git wants on every platform, even
    // when the on-disk path uses backslashes on Windows.
    const gitPath = repoRelativePath.split(path.sep).join('/');
    return execSync(`git show ${ref}:${gitPath}`, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Bible diff
// ---------------------------------------------------------------------------

function loadBibleVersesYaml(yamlText) {
  if (!yamlText) return new Map();
  const raw = yaml.load(yamlText) || {};
  const rows = new Map(); // key: `${book}|${chapter}|${verse}` -> {text, title}
  for (const value of Object.values(raw)) {
    const rawBook = String(value?.verse_book || '');
    const m = rawBook.match(/^(?:mg_)?(\d+)$/i);
    const bookId = m ? Number(m[1]) : null;
    if (!bookId) continue;
    const chapter = Number(value?.verse_chapter);
    const verseNumber = Number(value?.verse_number);
    if (!Number.isFinite(chapter) || !Number.isFinite(verseNumber)) continue;
    const text = String(value?.verse_text || '');
    const title =
      value?.verse_title == null ? null : String(value.verse_title);
    rows.set(`${bookId}|${chapter}|${verseNumber}`, {
      book_id: bookId,
      chapter,
      verse_number: verseNumber,
      text,
      title,
    });
  }
  return rows;
}

function diffBibleVerses(sinceRef) {
  const sourcePaths = getSourceDataPaths();
  const yamlDir = path.join(sourcePaths.bible, 'Yaml_Zo_Source');
  const changed = [];

  for (let bookId = 1; bookId <= 66; bookId += 1) {
    const fileName = `bible_verse_mg1865_mg_${bookId}.yaml`;
    const abs = path.join(yamlDir, fileName);
    const repoRel = path.relative(REPO_ROOT, abs);

    if (!fs.existsSync(abs)) continue;
    const currentText = fs.readFileSync(abs, 'utf8');
    const previousText = gitShow(sinceRef, repoRel);

    const current = loadBibleVersesYaml(currentText);
    const previous = loadBibleVersesYaml(previousText);

    for (const [key, row] of current) {
      const prev = previous.get(key);
      if (!prev || prev.text !== row.text || prev.title !== row.title) {
        changed.push(row);
      }
    }
  }
  return changed;
}

function buildBiblePatch(sinceRef, version) {
  // The text as buildBibleDatabase stores and indexes it.
  const verses = diffBibleVerses(sinceRef).map(v => {
    const text = cleanDisplayText(v.text);
    return {
      book_id: v.book_id,
      chapter: v.chapter,
      verse_number: v.verse_number,
      text,
      text_plain: normalizeForFtsContent(text),
      title: v.title,
    };
  });
  return {
    version,
    appliesTo: 'bible',
    verses,
    // Books table changes (chapter count, name) are rare; not diffed in v1.
    // Anything structural goes through an APK release anyway.
    books: [],
  };
}

// ---------------------------------------------------------------------------
// Hymns diff
// ---------------------------------------------------------------------------

// Same loader registry as buildHymnsDatabase.js — keep the two lists in
// sync so the patch builder sees every source file. Each loader knows how
// to parse its format from either disk (`load()`) or a string from
// `git show` (`parse(text)`).
function getHymnLoaders() {
  const sourcePaths = getSourceDataPaths();
  const hymnsDir = sourcePaths.hymns;
  return [
    createJsonHymnLoader(path.join(hymnsDir, '01_fihirana_ffpm.json'), 'ffpm'),
    createJsonHymnLoader(path.join(hymnsDir, '02_fihirana_fanampiny.json'), 'ff'),
    createJsonHymnLoader(path.join(hymnsDir, '03_antema.json'), 'antema'),
    createYamlHymnLoader(path.join(hymnsDir, 'song_song_fifohazana.yaml'), 'fifo'),
  ];
}

// Flatten an iterable of HymnRecord into the two row-shaped maps the
// patch diff downstream expects.
function indexHymnRecords(records) {
  const hymns = new Map();
  const verses = new Map();
  for (const r of records) {
    const authors = r.authors.length > 0 ? JSON.stringify(r.authors) : null;
    hymns.set(r.id, {
      id: r.id,
      number: r.number,
      category: r.category,
      title: r.title,
      authors,
      note: r.note || null,
    });
    for (const v of r.verses) {
      verses.set(`${r.id}|${v.number}`, {
        hymn_id: r.id,
        verse_number: v.number,
        heading: v.heading || null,
        text: v.text,
        is_chorus: v.isChorus ? 1 : 0,
      });
    }
  }
  return {hymns, verses};
}

function diffHymns(sinceRef) {
  const changedHymns = [];
  const changedVerses = [];

  for (const loader of getHymnLoaders()) {
    const abs = loader.sourcePath;
    const repoRel = path.relative(REPO_ROOT, abs);
    if (!fs.existsSync(abs)) continue;

    const currentText = fs.readFileSync(abs, 'utf8');
    const previousText = gitShow(sinceRef, repoRel);

    const current = indexHymnRecords(loader.parse(currentText));
    const previous = indexHymnRecords(loader.parse(previousText || ''));

    for (const [id, hymn] of current.hymns) {
      const prev = previous.hymns.get(id);
      if (
        !prev ||
        prev.number !== hymn.number ||
        prev.category !== hymn.category ||
        prev.title !== hymn.title ||
        prev.authors !== hymn.authors ||
        prev.note !== hymn.note
      ) {
        changedHymns.push(hymn);
      }
    }
    for (const [key, verse] of current.verses) {
      const prev = previous.verses.get(key);
      if (
        !prev ||
        prev.text !== verse.text ||
        prev.is_chorus !== verse.is_chorus ||
        prev.heading !== verse.heading
      ) {
        changedVerses.push(verse);
      }
    }
  }

  return {changedHymns, changedVerses};
}

function buildHymnsPatch(sinceRef, version) {
  const {changedHymns, changedVerses} = diffHymns(sinceRef);
  return {
    version,
    appliesTo: 'hymns',
    hymns: changedHymns.map(h => ({
      id: h.id,
      number: h.number,
      category: h.category,
      title: h.title,
      title_plain: normalizeForFtsContent(h.title),
      authors: h.authors,
      authors_plain: normalizeForFtsContent(
        normalizeHymnAuthors(h.authors || '')
      ),
      note: h.note,
    })),
    hymnVerses: changedVerses.map(v => ({
      hymn_id: v.hymn_id,
      verse_number: v.verse_number,
      heading: v.heading,
      text: v.text,
      text_plain: normalizeForFtsContent(v.text),
      is_chorus: v.is_chorus,
    })),
  };
}

// ---------------------------------------------------------------------------
// index.json management
// ---------------------------------------------------------------------------

function loadIndex(target) {
  const indexPath = path.join(DOCS_PATCHES_DIR, target, 'index.json');
  if (!fs.existsSync(indexPath)) {
    return {latest: 0, patches: [], minBaseline: 0};
  }
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch {
    return {latest: 0, patches: [], minBaseline: 0};
  }
}

function writeIndex(target, idx) {
  const dir = path.join(DOCS_PATCHES_DIR, target);
  ensureDir(dir);
  fs.writeFileSync(
    path.join(dir, 'index.json'),
    JSON.stringify(idx, null, 2) + '\n',
    'utf8'
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv);
  const target = (args.target || '').toLowerCase();
  if (!['bible', 'hymns'].includes(target)) {
    console.error('Error: --target=bible | hymns is required.');
    process.exit(1);
  }
  const sinceRef = args.since;
  if (!sinceRef) {
    console.error('Error: --since=<git-ref> is required.');
    process.exit(1);
  }
  // gitShow reads a missing ref as "no file", which would emit every row.
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${sinceRef}^{commit}`], {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
  } catch {
    console.error(`Error: --since=${sinceRef} is not a commit in this repo.`);
    process.exit(1);
  }
  const versionKey = `${target.toUpperCase()}_DB_VERSION`;
  const version = Number(args.version);
  // Phones that apply the patch are stamped with this version and then keep
  // their copy against an APK of the same version, so it must be the one the
  // bundled DB carries.
  if (version !== DB_VERSIONS[versionKey]) {
    console.error(
      `Error: --version=${args.version} is not the bundled ${target} version ` +
        `(${DB_VERSIONS[versionKey]}). Run yarn build:${target} first and pass the version it prints.`
    );
    process.exit(1);
  }
  const idx = loadIndex(target);
  const patchRel = `docs/patches/${target}/${version}.json`;
  // GitHub Pages serves main: what is published is what origin/main holds now.
  try {
    execFileSync('git', ['fetch', '--quiet', 'origin', 'main'], {cwd: REPO_ROOT, stdio: 'ignore'});
  } catch {
    console.warn('Warning: could not fetch origin/main; checking against the last fetched state.');
  }
  if (version < idx.latest || gitShow('origin/main', patchRel) !== null) {
    console.error(
      `Error: ${version} is older than the latest patch (${idx.latest}) or already published. ` +
        `Change the source, rebuild with yarn build:${target} and use the new version.`
    );
    process.exit(1);
  }
  const dryRun = args['dry-run'] === '1';

  const patch =
    target === 'bible'
      ? buildBiblePatch(sinceRef, version)
      : buildHymnsPatch(sinceRef, version);

  const rowCount =
    target === 'bible'
      ? patch.verses.length + patch.books.length
      : patch.hymns.length + patch.hymnVerses.length;

  if (rowCount === 0) {
    console.log(
      `No changes detected between ${sinceRef} and working tree for ${target}.`
    );
    console.log('Nothing to publish.');
    return;
  }

  console.log(
    `Found ${rowCount} changed row(s) for ${target} since ${sinceRef}:`
  );
  if (target === 'bible') {
    for (const v of patch.verses) {
      console.log(`  Verses ${v.book_id} ${v.chapter}:${v.verse_number}`);
    }
  } else {
    for (const h of patch.hymns) console.log(`  Hymns ${h.id}`);
    for (const v of patch.hymnVerses) {
      console.log(`  HymnVerses ${v.hymn_id} v${v.verse_number}`);
    }
  }

  if (dryRun) {
    console.log('\n--dry-run: not writing files.');
    return;
  }

  const targetDir = path.join(DOCS_PATCHES_DIR, target);
  ensureDir(targetDir);
  const patchPath = path.join(targetDir, `${version}.json`);
  fs.writeFileSync(patchPath, JSON.stringify(patch, null, 2) + '\n', 'utf8');

  // A --since newer than the latest patch means some content reached phones
  // only by APK; a phone below it would apply this patch and be stamped
  // current without those changes.
  const sinceVersions = gitShow(sinceRef, 'src/services/database/dbVersions.ts') || '';
  const sinceVersion = Number((sinceVersions.match(new RegExp(`${versionKey} = (\\d+)`)) || [])[1]) || 0;
  const gapFloor = sinceVersion > idx.latest ? sinceVersion : 0;

  if (!idx.patches.includes(version)) {
    idx.patches = [...new Set([...idx.patches, version])].sort((a, b) => a - b);
  }
  idx.latest = Math.max(idx.latest, version);
  if (!idx.minBaseline) {
    // First patch ever: declare the floor as the version we're patching from.
    // If `since` is a YYYYMMDD-ish tag we can parse, use it; otherwise leave
    // 0 and the maintainer can hand-edit. The on-device check skips patching
    // when onDisk < minBaseline, so a too-low value just means more devices
    // qualify for incremental patches.
    const maybe = Number(sinceRef);
    if (Number.isInteger(maybe) && maybe >= 20000000 && maybe <= 99999999) {
      idx.minBaseline = maybe;
    }
  }
  // This patch is built against today's DB: devices older than the last
  // change a patch can't carry wait for the APK instead.
  idx.minBaseline = Math.max(idx.minBaseline || 0, PATCH_FLOORS[target], gapFloor);
  writeIndex(target, idx);

  console.log(`\nWrote ${path.relative(REPO_ROOT, patchPath)}`);
  console.log(`Updated ${target}/index.json (latest=${idx.latest}, minBaseline=${idx.minBaseline})`);
  console.log('\nNext:');
  console.log(`  git add docs/patches/${target}/ src/services/database/dbVersions.ts scripts/utils/ assets/ ios/`);
  console.log(`  git commit && git push    # GitHub Pages republishes`);
}

if (require.main === module) {
  main();
}

module.exports = {buildBiblePatch, buildHymnsPatch};
