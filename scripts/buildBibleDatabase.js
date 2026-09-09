// scripts/buildBibleDatabase.js
//
// Builds ONLY the Bible database (dev .db + prod .zip) and copies it into the
// android and ios asset folders. Hymns artifacts are left untouched.
//
// Run:  yarn build:bible

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const {
  getAssetsPaths,
  getSourceDataPaths,
  getDatabasePaths,
  ensureDirectory,
  copyFileSafe,
  normalizePathForDisplay,
} = require('./utils/paths');

const {
  cleanDisplayText,
  normalizeForFtsContent,
  addToVocabulary,
  writeVocabulary,
  runAsync,
  finalizeAsync,
  closeAsync,
  applyBuildPragmas,
  stampUserVersion,
  createZipFromDb,
  reportSize,
  sqlite3,
} = require('./utils/buildDb');

const { planVersion, commitVersion } = require('./utils/autoVersion');

// Resolve the Bible source files used for both building and content hashing.
// Prefers the YAML set (bible_book/version + 66 verse files); falls back to the
// legacy MG65 JSON. Mirrors the usingYamlSource detection inside buildBible so
// the hash covers exactly the inputs that produced the DB.
function getBibleSourceFiles() {
  const sourcePaths = getSourceDataPaths();
  const databasePaths = getDatabasePaths();
  const yamlSourceDir = path.join(sourcePaths.bible, 'Yaml_Zo_Source');
  const yamlBooksFile = path.join(yamlSourceDir, 'bible_book.yaml');
  const yamlVersionFile = path.join(yamlSourceDir, 'bible_version.yaml');

  const usingYamlSource =
    fs.existsSync(yamlSourceDir) &&
    fs.existsSync(yamlBooksFile) &&
    fs.existsSync(yamlVersionFile);

  if (!usingYamlSource) {
    return [databasePaths.bible.source];
  }

  const files = [yamlBooksFile, yamlVersionFile];
  for (let bookId = 1; bookId <= 66; bookId += 1) {
    files.push(path.join(yamlSourceDir, `bible_verse_mg1865_mg_${bookId}.yaml`));
  }
  return files;
}

async function buildBible(dbPath, version) {
  console.log('📖 Building Bible...');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const db = new sqlite3.Database(dbPath);
  await applyBuildPragmas(db);

  await runAsync(db, `CREATE TABLE Books (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    testament TEXT NOT NULL CHECK (testament IN ('old', 'new')),
    chapters INTEGER NOT NULL,
    filename TEXT NOT NULL
  )`);

  await runAsync(db, `CREATE TABLE Verses (
    id INTEGER PRIMARY KEY,
    book_id INTEGER NOT NULL,
    chapter INTEGER NOT NULL,
    verse_number INTEGER NOT NULL,
    text TEXT NOT NULL,
    title TEXT,
    FOREIGN KEY (book_id) REFERENCES Books (id) ON DELETE CASCADE,
    UNIQUE(book_id, chapter, verse_number) ON CONFLICT REPLACE
  )`);

  // Contentless FTS5 — only the inverted index, no _content shadow table.
  await runAsync(db, `CREATE VIRTUAL TABLE VersesFts USING fts5(
    text_plain,
    tokenize='unicode61 remove_diacritics 2',
    prefix='2 3 4',
    content=''
  )`);

  // Typo correction works off the corpus VOCABULARY, not the verse text.
  // Indexing every 3-char window of all 31k verses cost 10.4 MB — larger than
  // the entire word index — and every user paid it in download size. The
  // distinct words are ~225 KB of text instead, and correcting a misspelled
  // WORD against real words is more precise than character-matching a whole
  // verse anyway: find the closest real word, then re-run the normal ranked
  // search with it.
  //
  // Two tables because the lookups differ: `Vocabulary` answers "is this an
  // exact word?" (used to test elision splits like aminny -> amin + ny),
  // `VocabularyTrigram` answers "what real words look like this typo?".
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

  // ---- Source: prefer YAML, fallback to legacy MG65 JSON ----
  const sourcePaths = getSourceDataPaths();
  const databasePaths = getDatabasePaths();
  const yamlSourceDir = path.join(sourcePaths.bible, 'Yaml_Zo_Source');
  const yamlBooksFile = path.join(yamlSourceDir, 'bible_book.yaml');
  const yamlVersionFile = path.join(yamlSourceDir, 'bible_version.yaml');
  const yamlVersesPrefix = 'bible_verse_mg1865_mg_';
  const mg65JsonPath = databasePaths.bible.source;

  const usingYamlSource =
    fs.existsSync(yamlSourceDir) &&
    fs.existsSync(yamlBooksFile) &&
    fs.existsSync(yamlVersionFile);

  if (!usingYamlSource && !fs.existsSync(mg65JsonPath)) {
    throw new Error('No Bible source found (YAML or legacy MG65 JSON).');
  }

  console.log(`  source: ${usingYamlSource ? 'YAML' : 'legacy JSON'}`);

  // ---- Books ----
  if (usingYamlSource) {
    const booksYaml = yaml.load(fs.readFileSync(yamlBooksFile, 'utf8')) || {};
    for (const [key, value] of Object.entries(booksYaml)) {
      const raw = String(value?.book_number ?? value?.book_id ?? key);
      const m = raw.match(/^(?:mg_)?(\d+)$/i);
      const bookId = m ? Number(m[1]) : null;
      if (!bookId) continue;
      const name = String(value?.book_name || '').trim();
      const chapters = Number(value?.book_chapter_count) || 0;
      const filename = String(value?.book_id || key || '');
      const testament = bookId <= 39 ? 'old' : 'new';
      await runAsync(
        db,
        `INSERT OR REPLACE INTO Books (id, name, testament, chapters, filename) VALUES (?, ?, ?, ?, ?)`,
        [bookId, name, testament, chapters, filename]
      );
    }
  } else {
    const mg65 = JSON.parse(fs.readFileSync(mg65JsonPath, 'utf8'));
    const tables = (mg65.objects || []).filter((o) => o.type === 'table');
    const booksTable = tables.find((t) => t.name === 'books');
    if (!booksTable) throw new Error('MG65 JSON missing books table');
    const cols = (booksTable.columns || []).map((c) => c.name);
    const bBookNum = cols.indexOf('book_number');
    const bLong = cols.indexOf('long_name');
    const versesTable = tables.find((t) => t.name === 'verses');
    const vCols = (versesTable.columns || []).map((c) => c.name);
    const vBook = vCols.indexOf('book_number');
    const vChapter = vCols.indexOf('chapter');
    const sortedBookNumbers = [
      ...new Set((booksTable.rows || []).map((r) => Number(r[bBookNum]))),
    ].sort((a, b) => a - b);
    const bookNumberToId = new Map(sortedBookNumbers.map((bn, i) => [bn, i + 1]));
    const maxChapterByBook = new Map();
    for (const r of versesTable.rows || []) {
      const bn = Number(r[vBook]);
      const ch = Number(r[vChapter]);
      if (ch > (maxChapterByBook.get(bn) || 0)) maxChapterByBook.set(bn, ch);
    }
    for (const r of booksTable.rows || []) {
      const bn = Number(r[bBookNum]);
      const id = bookNumberToId.get(bn);
      if (!id) continue;
      const name = String(r[bLong] || '');
      const testament = bn < 400 ? 'old' : 'new';
      const chapters = maxChapterByBook.get(bn) || 0;
      await runAsync(
        db,
        `INSERT OR REPLACE INTO Books (id, name, testament, chapters, filename) VALUES (?, ?, ?, ?, ?)`,
        [id, name, testament, chapters, '']
      );
    }
  }

  // ---- Verses + FTS ----
  const insertVerse = db.prepare(
    `INSERT OR REPLACE INTO Verses (id, book_id, chapter, verse_number, text, title) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertFts = db.prepare(`INSERT INTO VersesFts(rowid, text_plain) VALUES (?, ?)`);

  const insVerseAsync = (p) =>
    new Promise((res, rej) => insertVerse.run(p, (e) => (e ? rej(e) : res())));
  const insFtsAsync = (p) =>
    new Promise((res, rej) => insertFts.run(p, (e) => (e ? rej(e) : res())));

  // Tallied while walking the verses, written once at the end.
  const vocabulary = new Map();
  let verseId = 1;

  if (usingYamlSource) {
    for (let bookId = 1; bookId <= 66; bookId += 1) {
      const file = path.join(yamlSourceDir, `${yamlVersesPrefix}${bookId}.yaml`);
      if (!fs.existsSync(file)) {
        throw new Error(`Missing YAML verses file for book ${bookId}`);
      }
      const versesYaml = yaml.load(fs.readFileSync(file, 'utf8')) || {};
      const rows = [];
      for (const value of Object.values(versesYaml)) {
        const raw = String(value?.verse_book || '');
        const m = raw.match(/^(?:mg_)?(\d+)$/i);
        const vBook = m ? Number(m[1]) : null;
        const chapter = Number(value?.verse_chapter);
        const verseNumber = Number(value?.verse_number);
        const text = String(value?.verse_text || '');
        const title = value?.verse_title == null ? null : String(value.verse_title);
        if (vBook !== bookId || !text || !Number.isFinite(chapter) || !Number.isFinite(verseNumber)) {
          continue;
        }
        rows.push({ chapter, verseNumber, text, title });
      }
      rows.sort((a, b) => a.chapter - b.chapter || a.verseNumber - b.verseNumber);
      for (const row of rows) {
        const display = cleanDisplayText(row.text);
        const plain = normalizeForFtsContent(display);
        await insVerseAsync([verseId, bookId, row.chapter, row.verseNumber, display, row.title]);
        await insFtsAsync([verseId, plain]);
        addToVocabulary(vocabulary, plain);
        verseId += 1;
      }
    }
  } else {
    const mg65 = JSON.parse(fs.readFileSync(mg65JsonPath, 'utf8'));
    const tables = (mg65.objects || []).filter((o) => o.type === 'table');
    const versesTable = tables.find((t) => t.name === 'verses');
    const cols = (versesTable.columns || []).map((c) => c.name);
    const vBook = cols.indexOf('book_number');
    const vChapter = cols.indexOf('chapter');
    const vVerse = cols.indexOf('verse');
    const vText = cols.indexOf('text');
    const sortedBookNumbers = [
      ...new Set((versesTable.rows || []).map((r) => Number(r[vBook]))),
    ].sort((a, b) => a - b);
    const bookNumberToId = new Map(sortedBookNumbers.map((bn, i) => [bn, i + 1]));
    for (const r of versesTable.rows || []) {
      const bn = Number(r[vBook]);
      const id = bookNumberToId.get(bn);
      if (!id) continue;
      const chapter = Number(r[vChapter]);
      const verseNumber = Number(r[vVerse]);
      const display = cleanDisplayText(String(r[vText] || ''));
      const plain = normalizeForFtsContent(display);
      await insVerseAsync([verseId, id, chapter, verseNumber, display, null]);
      await insFtsAsync([verseId, plain]);
      addToVocabulary(vocabulary, plain);
      verseId += 1;
    }
  }

  await finalizeAsync(insertVerse);
  await finalizeAsync(insertFts);

  const vocabularySize = await writeVocabulary(db, vocabulary);

  console.log(`  ↳ ${verseId - 1} verses indexed, ${vocabularySize} distinct words`);

  console.log('  optimizing FTS + VACUUM ...');
  await runAsync(db, `INSERT INTO VersesFts(VersesFts) VALUES('optimize')`);
  await runAsync(db, `INSERT INTO VocabularyTrigram(VocabularyTrigram) VALUES('optimize')`);
  await runAsync(db, `ANALYZE`);
  await runAsync(db, `VACUUM`);

  // Stamp content version AFTER VACUUM so the value lands in the final header.
  // The value is resolved by planVersion() in main() — content-hash based.
  await stampUserVersion(db, version);

  await closeAsync(db);
  console.log(`✅ Bible built: ${normalizePathForDisplay(dbPath)}`);
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

  const bibleDev = databasePaths.bible.dev;
  const bibleProd = databasePaths.bible.prod;

  // Resolve the content version BEFORE building (pure decision, no writes).
  const { version, changed, newHash } = planVersion({
    target: 'bible',
    sourceFiles: getBibleSourceFiles(),
  });
  console.log(
    changed
      ? `🔖 Bible content changed → new version ${version}`
      : `🔖 Bible content unchanged → reusing version ${version}`,
  );

  // Wipe ONLY Bible artifacts.
  for (const p of [
    bibleDev,
    bibleProd,
    databasePaths.bible.androidDev,
    databasePaths.bible.androidProd,
    databasePaths.bible.iosDev,
    databasePaths.bible.iosProd,
  ]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  await buildBible(bibleDev, version);

  console.log('\n📦 Copying dev DB to platform asset folders...');
  copyFileSafe(bibleDev, databasePaths.bible.androidDev);
  copyFileSafe(bibleDev, databasePaths.bible.iosDev);

  console.log('🗜️  Creating max-compression ZIP for prod...');
  await createZipFromDb(bibleDev, bibleProd);

  console.log('📦 Copying prod ZIP to platform asset folders...');
  copyFileSafe(bibleProd, databasePaths.bible.androidProd);
  copyFileSafe(bibleProd, databasePaths.bible.iosProd);

  console.log('\n📊 Bible size audit\n');
  reportSize('Bible.db (root)', bibleDev);
  reportSize('Bible.db (android)', databasePaths.bible.androidDev);
  reportSize('Bible.db (ios)', databasePaths.bible.iosDev);
  reportSize('Bible.zip (root)', bibleProd);
  reportSize('Bible.zip (android)', databasePaths.bible.androidProd);
  reportSize('Bible.zip (ios)', databasePaths.bible.iosProd);

  // Persist the bump ONLY after a fully successful build + copy, so the version
  // files never get ahead of the shipped artifacts.
  if (changed) {
    commitVersion({ target: 'bible', version, newHash });
    console.log(`\n🔖 dbVersions + manifest updated → BIBLE_DB_VERSION = ${version}`);
  }

  console.log(`\n⏱️  Bible build done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Bible build failed:', err);
    process.exit(1);
  });
}

module.exports = { buildBible, main };
