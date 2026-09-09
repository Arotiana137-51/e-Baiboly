// scripts/buildHymnsDatabase.js
//
// Builds ONLY the Hymns database (dev .db + prod .zip) and copies it into the
// android and ios asset folders. Bible artifacts are left untouched.
//
// Run:  yarn build:hymns

const fs = require('fs');
const path = require('path');

const {
  getAssetsPaths,
  getSourceDataPaths,
  getDatabasePaths,
  ensureDirectory,
  copyFileSafe,
  normalizePathForDisplay,
} = require('./utils/paths');

const {
  normalizeForFtsContent,
  normalizeHymnAuthors,
  addToVocabulary,
  writeVocabulary,
  runAsync,
  allAsync,
  finalizeAsync,
  closeAsync,
  applyBuildPragmas,
  stampUserVersion,
  createZipFromDb,
  reportSize,
  sqlite3,
} = require('./utils/buildDb');

const { planVersion, commitVersion } = require('./utils/autoVersion');

const {
  createJsonHymnLoader,
} = require('./source-data/hymns/loaders/jsonHymnLoader');
const {
  createYamlHymnLoader,
} = require('./source-data/hymns/loaders/yamlHymnLoader');

// The hymn source files, used for both loading and content hashing. Order here
// is irrelevant to the hash (hashSources sorts), but kept aligned with the
// loaders inside buildHymns for readability.
function getHymnSourceFiles() {
  const hymnsDir = getSourceDataPaths().hymns;
  return [
    path.join(hymnsDir, '01_fihirana_ffpm.json'),
    path.join(hymnsDir, '02_fihirana_fanampiny.json'),
    path.join(hymnsDir, '03_antema.json'),
    path.join(hymnsDir, 'song_song_fifohazana.yaml'),
  ];
}

async function buildHymns(dbPath, version) {
  console.log('🎵 Building Hymns...');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const db = new sqlite3.Database(dbPath);
  await applyBuildPragmas(db);

  await runAsync(db, `CREATE TABLE Hymns (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL,
    category TEXT,
    title TEXT,
    authors TEXT
  )`);

  await runAsync(db, `CREATE TABLE HymnVerses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hymn_id TEXT NOT NULL,
    verse_number INTEGER NOT NULL,
    text TEXT NOT NULL,
    is_chorus BOOLEAN NOT NULL DEFAULT 0,
    FOREIGN KEY (hymn_id) REFERENCES Hymns (id) ON DELETE CASCADE,
    UNIQUE(hymn_id, verse_number) ON CONFLICT REPLACE
  )`);

  // Hymns metadata FTS keeps small UNINDEXED columns so the search hook can
  // resolve hymn_id without a second join.
  await runAsync(db, `CREATE VIRTUAL TABLE HymnsFts USING fts5(
    title_plain,
    authors_plain,
    hymn_id UNINDEXED,
    number UNINDEXED,
    category UNINDEXED,
    tokenize='unicode61 remove_diacritics 2',
    prefix='2 3 4'
  )`);

  // Verses FTS is contentless to save the most space (verse text is the bulk).
  await runAsync(db, `CREATE VIRTUAL TABLE HymnVersesFts USING fts5(
    text_plain,
    tokenize='unicode61 remove_diacritics 2',
    prefix='2 3 4',
    content=''
  )`);

  // Typo correction runs off the corpus vocabulary rather than trigram copies
  // of every hymn/verse — see the same pair in buildBibleDatabase.js for why.
  // `Vocabulary` answers "is this an exact word?", `VocabularyTrigram`
  // answers "what real words look like this typo?".
  await runAsync(db, `CREATE TABLE Vocabulary (
    id INTEGER PRIMARY KEY,
    word TEXT NOT NULL UNIQUE,
    freq INTEGER NOT NULL
  )`);
  await runAsync(db, `CREATE VIRTUAL TABLE VocabularyTrigram USING fts5(
    word,
    tokenize='trigram',
    content=''
  )`);

  // ---- Import hymns ----
  //
  // Source loaders implement a tiny shared interface ({ sourcePath, load() }
  // yielding HymnRecord values; see scripts/source-data/hymns/loaders/types.js).
  // The builder doesn't know or care about format — adding a new category in
  // a new format means: write a loader, append it here. The insert / FTS /
  // VACUUM logic below stays identical regardless of source.
  const [ffpmPath, ffPath, antemaPath, fifoPath] = getHymnSourceFiles();
  const loaders = [
    createJsonHymnLoader(ffpmPath, 'ffpm'),
    createJsonHymnLoader(ffPath, 'ff'),
    createJsonHymnLoader(antemaPath, 'antema'),
    createYamlHymnLoader(fifoPath, 'fifo'),
  ];

  const insHymn = db.prepare(
    `INSERT OR REPLACE INTO Hymns (id, number, category, title, authors) VALUES (?, ?, ?, ?, ?)`
  );
  const insVerse = db.prepare(
    `INSERT OR REPLACE INTO HymnVerses (hymn_id, verse_number, text, is_chorus) VALUES (?, ?, ?, ?)`
  );
  const insHymnAsync = (p) =>
    new Promise((res, rej) => insHymn.run(p, (e) => (e ? rej(e) : res())));
  const insVerseAsync = (p) =>
    new Promise((res, rej) => insVerse.run(p, (e) => (e ? rej(e) : res())));

  for (const loader of loaders) {
    if (!fs.existsSync(loader.sourcePath)) continue;
    for (const hymn of loader.load()) {
      const authors = hymn.authors.length > 0 ? JSON.stringify(hymn.authors) : null;
      await insHymnAsync([
        hymn.id,
        hymn.number,
        hymn.category || '',
        hymn.title,
        authors,
      ]);
      for (const verse of hymn.verses) {
        await insVerseAsync([
          hymn.id,
          verse.number,
          verse.text,
          verse.isChorus ? 1 : 0,
        ]);
      }
    }
  }

  await finalizeAsync(insHymn);
  await finalizeAsync(insVerse);

  // ---- Populate FTS ----
  const hymnRows = await allAsync(
    db,
    `SELECT rowid, id, number, category, title, authors FROM Hymns`
  );
  const insHymnsFts = db.prepare(
    `INSERT INTO HymnsFts(rowid, title_plain, authors_plain, hymn_id, number, category) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insHymnsFtsAsync = (p) =>
    new Promise((res, rej) => insHymnsFts.run(p, (e) => (e ? rej(e) : res())));

  // Tallied across titles, authors and verses, written once at the end.
  const vocabulary = new Map();

  for (const h of hymnRows) {
    const titlePlain = normalizeForFtsContent(String(h.title || ''));
    const authorsPlain = normalizeForFtsContent(
      normalizeHymnAuthors(String(h.authors || ''))
    );
    await insHymnsFtsAsync([
      h.rowid,
      titlePlain,
      authorsPlain,
      h.id,
      Number(h.number) || 0,
      String(h.category || ''),
    ]);
    addToVocabulary(vocabulary, titlePlain);
    addToVocabulary(vocabulary, authorsPlain);
  }
  await finalizeAsync(insHymnsFts);

  const verseRows = await allAsync(db, `SELECT id, text FROM HymnVerses`);
  const insVersesFts = db.prepare(`INSERT INTO HymnVersesFts(rowid, text_plain) VALUES (?, ?)`);
  const insVersesFtsAsync = (p) =>
    new Promise((res, rej) => insVersesFts.run(p, (e) => (e ? rej(e) : res())));
  for (const r of verseRows) {
    const plain = normalizeForFtsContent(String(r.text || ''));
    await insVersesFtsAsync([r.id, plain]);
    addToVocabulary(vocabulary, plain);
  }
  await finalizeAsync(insVersesFts);

  const vocabularySize = await writeVocabulary(db, vocabulary);

  console.log(
    `  ↳ ${hymnRows.length} hymns, ${verseRows.length} verses indexed, ${vocabularySize} distinct words`
  );

  console.log('  optimizing FTS + VACUUM ...');
  await runAsync(db, `INSERT INTO HymnsFts(HymnsFts) VALUES('optimize')`);
  await runAsync(db, `INSERT INTO HymnVersesFts(HymnVersesFts) VALUES('optimize')`);
  await runAsync(db, `INSERT INTO VocabularyTrigram(VocabularyTrigram) VALUES('optimize')`);
  await runAsync(db, `ANALYZE`);
  await runAsync(db, `VACUUM`);

  // Stamp content version AFTER VACUUM so the value lands in the final header.
  // The value is resolved by planVersion() in main() — content-hash based.
  await stampUserVersion(db, version);

  await closeAsync(db);
  console.log(`✅ Hymns built: ${normalizePathForDisplay(dbPath)}`);
}

async function main() {
  const startedAt = Date.now();

  const assetsPaths = getAssetsPaths();
  const databasePaths = getDatabasePaths();

  ensureDirectory(assetsPaths.dev);
  ensureDirectory(assetsPaths.prod);
  ensureDirectory(assetsPaths.android.dev);
  ensureDirectory(assetsPaths.android.prod);
  ensureDirectory(assetsPaths.ios.dev);
  ensureDirectory(assetsPaths.ios.prod);

  const hymnsDev = databasePaths.hymns.dev;
  const hymnsProd = databasePaths.hymns.prod;

  // Resolve the content version BEFORE building (pure decision, no writes).
  const { version, changed, newHash } = planVersion({
    target: 'hymns',
    sourceFiles: getHymnSourceFiles(),
  });
  console.log(
    changed
      ? `🔖 Hymns content changed → new version ${version}`
      : `🔖 Hymns content unchanged → reusing version ${version}`,
  );

  // Wipe ONLY Hymns artifacts.
  for (const p of [
    hymnsDev,
    hymnsProd,
    databasePaths.hymns.androidDev,
    databasePaths.hymns.androidProd,
    databasePaths.hymns.iosDev,
    databasePaths.hymns.iosProd,
  ]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  await buildHymns(hymnsDev, version);

  console.log('\n📦 Copying dev DB to platform asset folders...');
  copyFileSafe(hymnsDev, databasePaths.hymns.androidDev);
  copyFileSafe(hymnsDev, databasePaths.hymns.iosDev);

  console.log('🗜️  Creating max-compression ZIP for prod...');
  await createZipFromDb(hymnsDev, hymnsProd);

  console.log('📦 Copying prod ZIP to platform asset folders...');
  copyFileSafe(hymnsProd, databasePaths.hymns.androidProd);
  copyFileSafe(hymnsProd, databasePaths.hymns.iosProd);

  console.log('\n📊 Hymns size audit\n');
  reportSize('Hymns.db (root)', hymnsDev);
  reportSize('Hymns.db (android)', databasePaths.hymns.androidDev);
  reportSize('Hymns.db (ios)', databasePaths.hymns.iosDev);
  reportSize('Hymns.zip (root)', hymnsProd);
  reportSize('Hymns.zip (android)', databasePaths.hymns.androidProd);
  reportSize('Hymns.zip (ios)', databasePaths.hymns.iosProd);

  // Persist the bump ONLY after a fully successful build + copy, so the version
  // files never get ahead of the shipped artifacts.
  if (changed) {
    commitVersion({ target: 'hymns', version, newHash });
    console.log(`\n🔖 dbVersions + manifest updated → HYMNS_DB_VERSION = ${version}`);
  }

  console.log(`\n⏱️  Hymns build done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Hymns build failed:', err);
    process.exit(1);
  });
}

module.exports = { buildHymns, main };
