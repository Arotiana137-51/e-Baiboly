// scripts/buildBibleDatabase.js
//
// Builds ONLY the Bible database (dev .db + prod .zip) into assets/data/ and
// copies it into the ios Resources folder. Android reads assets/data directly
// (see the sourceSets block in android/app/build.gradle), so there is no
// android copy. Hymns artifacts are left untouched.
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
  if (fs.existsSync(databasePaths.bible.crossReferences)) {
    files.push(databasePaths.bible.crossReferences);
  }
  return files;
}

// ---- Cross references (OpenBible.info, CC-BY) ----
//
// cross_references.txt is "From Verse<TAB>To Verse<TAB>Votes" with OSIS refs
// (Gen.1.1, Joel.2.28-Joel.2.32) in English numbering. MG1865 numbers most of
// the Old Testament the Hebrew way (Psalms excepted): Gen 31:55 is MG 32:1,
// Joel 2:28 is MG 3:1, Malachi has no chapter 4. Every ref is converted to
// MG numbering here, so the reader can query with the verse it shows.

// Index + 1 = Books.id (canonical order).
const OSIS_BOOKS = [
  'Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam',
  '1Kgs', '2Kgs', '1Chr', '2Chr', 'Ezra', 'Neh', 'Esth', 'Job', 'Ps', 'Prov',
  'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos',
  'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal', 'Matt',
  'Mark', 'Luke', 'John', 'Acts', 'Rom', '1Cor', '2Cor', 'Gal', 'Eph', 'Phil',
  'Col', '1Thess', '2Thess', '1Tim', '2Tim', 'Titus', 'Phlm', 'Heb', 'Jas', '1Pet',
  '2Pet', '1John', '2John', '3John', 'Jude', 'Rev',
];

// Chapters where MG merged or split a verse, so the counts differ without the
// difference moving to a neighbouring chapter. Checked against the MG text.
// "book:English chapter" -> English verse -> [MG chapter, MG verse].
const MG_MERGES_AND_SPLITS = {
  // Deut 5:17-20 (the four short commandments) are the single MG 5:17.
  '5:5': (v) => (v < 17 ? [5, v] : v <= 20 ? [5, 17] : [5, v - 3]),
  // Josh 17:18 is the end of MG 17:17.
  '6:17': (v) => [17, Math.min(v, 17)],
  // The end of English 1 Sam 20:42 is MG 21:1.
  '9:21': (v) => [21, v + 1],
  // English 1 Kgs 22:43 is MG 22:43-44.
  '11:22': (v) => [22, v <= 43 ? v : v + 1],
  // 1 Chr 27:34 is the end of MG 27:33.
  '13:27': (v) => [27, Math.min(v, 33)],
  // Isa 64:1 is the end of MG 63:19.
  '23:64': (v) => (v === 1 ? [63, 19] : [64, v - 1]),
};

const parseOsisRef = (ref) => {
  const m = /^(\w+)\.(\d+)\.(\d+)$/.exec(ref);
  const book = m ? OSIS_BOOKS.indexOf(m[1]) + 1 : 0;
  return book ? { book, chapter: Number(m[2]), verse: Number(m[3]) } : null;
};

// English -> MG verse mapping. Outside MG_MERGES_AND_SPLITS both numberings
// hold the same verses in the same order and only the chapter breaks move, so
// over each run of neighbouring chapters whose verse counts differ, the n-th
// English verse is the n-th MG verse. English counts come from the refs
// themselves (the highest verse cited in each chapter).
function buildVersification(engCounts, mgCounts) {
  const shifted = new Map();
  const count = (counts, book, ch) => counts.get(`${book}:${ch}`) || 0;

  const alignRun = (book, first, last) => {
    const eng = [];
    const mg = [];
    for (let ch = first; ch <= last; ch += 1) {
      for (let v = 1; v <= count(engCounts, book, ch); v += 1) eng.push(`${book}:${ch}:${v}`);
      for (let v = 1; v <= count(mgCounts, book, ch); v += 1) mg.push([ch, v]);
    }
    if (eng.length === mg.length) {
      eng.forEach((key, i) => shifted.set(key, mg[i]));
      return;
    }
    for (let ch = first; ch <= last; ch += 1) {
      if (!MG_MERGES_AND_SPLITS[`${book}:${ch}`]) {
        throw new Error(
          `${OSIS_BOOKS[book - 1]} ${ch}: MG has ${count(mgCounts, book, ch)} verses, English ` +
            `${count(engCounts, book, ch)}, and no rule maps them; add one to MG_MERGES_AND_SPLITS.`
        );
      }
    }
  };

  for (let book = 1; book <= 66; book += 1) {
    let lastChapter = 0;
    for (const counts of [engCounts, mgCounts]) {
      while (count(counts, book, lastChapter + 1) > 0) lastChapter += 1;
    }
    let runStart = 0;
    for (let ch = 1; ch <= lastChapter + 1; ch += 1) {
      const differs = ch <= lastChapter && count(engCounts, book, ch) !== count(mgCounts, book, ch);
      if (differs && !runStart) runStart = ch;
      if (!differs && runStart) {
        alignRun(book, runStart, ch - 1);
        runStart = 0;
      }
    }
  }

  return ({ book, chapter, verse }) => {
    const rule = MG_MERGES_AND_SPLITS[`${book}:${chapter}`];
    if (rule) return rule(verse);
    return shifted.get(`${book}:${chapter}:${verse}`) || [chapter, verse];
  };
}

async function importCrossReferences(db, crossRefsPath) {
  if (!fs.existsSync(crossRefsPath)) {
    console.log('  ⚠️ cross_references.txt not found, no cross references');
    return;
  }

  // Books.id is the canonical book number, so refs store it directly. Keyed by
  // the verse the reader looks up; WITHOUT ROWID makes that key the table
  // itself, with no separate index: 6 MB less than a rowid table + index.
  await runAsync(db, `CREATE TABLE CrossReferences (
    from_book INTEGER NOT NULL,
    from_chapter INTEGER NOT NULL,
    from_verse INTEGER NOT NULL,
    to_book INTEGER NOT NULL,
    to_chapter INTEGER NOT NULL,
    to_verse_start INTEGER NOT NULL,
    to_verse_end INTEGER NOT NULL,
    votes INTEGER NOT NULL,
    PRIMARY KEY (from_book, from_chapter, from_verse, to_book, to_chapter, to_verse_start, to_verse_end)
  ) WITHOUT ROWID`);

  const mgCounts = new Map();
  await new Promise((resolve, reject) =>
    db.each(
      `SELECT book_id, chapter, MAX(verse_number) AS n FROM Verses GROUP BY book_id, chapter`,
      (err, row) => {
        if (!err) mgCounts.set(`${row.book_id}:${row.chapter}`, row.n);
      },
      (err) => (err ? reject(err) : resolve())
    )
  );

  const refs = [];
  const engCounts = new Map();
  const cite = (ref) => {
    const key = `${ref.book}:${ref.chapter}`;
    engCounts.set(key, Math.max(engCounts.get(key) || 0, ref.verse));
  };
  let unreadable = 0;
  const lines = fs.readFileSync(crossRefsPath, 'utf8').split(/\r?\n/);
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const [fromCol, toCol, votesCol] = line.split('\t');
    const [toStartCol, toEndCol] = String(toCol || '').split('-');
    const from = parseOsisRef(String(fromCol || '').trim());
    const toStart = parseOsisRef(toStartCol.trim());
    const toEnd = toEndCol ? parseOsisRef(toEndCol.trim()) : toStart;
    const votes = Number(votesCol);
    if (!from || !toStart || !toEnd || !Number.isFinite(votes)) {
      unreadable += 1;
      continue;
    }
    [from, toStart, toEnd].forEach(cite);
    refs.push({ from, toStart, toEnd, votes: Math.trunc(votes) });
  }

  const toMg = buildVersification(engCounts, mgCounts);
  const lastVerse = (book, chapter) => mgCounts.get(`${book}:${chapter}`) || 0;

  // Merged MG verses turn several English refs into the same one: keep it once,
  // with its best vote count.
  const rows = new Map();
  let dropped = 0;
  for (const { from, toStart, toEnd, votes } of refs) {
    const [fromChapter, fromVerse] = toMg(from);
    const [toChapter, toVerseStart] = toMg(toStart);
    const [endChapter, endVerse] = toMg(toEnd);
    // The reader shows a single-chapter range: one that runs into the next
    // chapter stops at the end of its first one.
    const toVerseEnd =
      toEnd.book === toStart.book && endChapter === toChapter ? endVerse : lastVerse(toStart.book, toChapter);
    const resolves =
      fromVerse >= 1 &&
      fromVerse <= lastVerse(from.book, fromChapter) &&
      toVerseStart >= 1 &&
      toVerseEnd >= toVerseStart &&
      toVerseEnd <= lastVerse(toStart.book, toChapter);
    const pointsAtItself =
      from.book === toStart.book && fromChapter === toChapter && fromVerse === toVerseStart && fromVerse === toVerseEnd;
    if (!resolves || pointsAtItself) {
      dropped += 1;
      continue;
    }
    const row = [from.book, fromChapter, fromVerse, toStart.book, toChapter, toVerseStart, toVerseEnd, votes];
    const key = row.slice(0, 7).join(':');
    const kept = rows.get(key);
    if (!kept || kept[7] < votes) rows.set(key, row);
  }

  const insert = db.prepare(
    `INSERT INTO CrossReferences (from_book, from_chapter, from_verse, to_book, to_chapter, to_verse_start, to_verse_end, votes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  await runAsync(db, 'BEGIN');
  for (const row of rows.values()) {
    await new Promise((res, rej) => insert.run(row, (e) => (e ? rej(e) : res())));
  }
  await runAsync(db, 'COMMIT');
  await finalizeAsync(insert);

  console.log(
    `  ↳ ${rows.size} cross references (${refs.length} read, ${refs.length - rows.size - dropped} merged, ` +
      `${dropped} unresolvable, ${unreadable} unreadable)`
  );
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

  await importCrossReferences(db, databasePaths.bible.crossReferences);

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
    databasePaths.bible.iosDev,
    databasePaths.bible.iosProd,
  ]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  await buildBible(bibleDev, version);

  console.log('\n📦 Copying dev DB to the iOS asset folder...');
  copyFileSafe(bibleDev, databasePaths.bible.iosDev);

  console.log('🗜️  Creating stored ZIP for prod...');
  await createZipFromDb(bibleDev, bibleProd);

  console.log('📦 Copying prod ZIP to the iOS asset folder...');
  copyFileSafe(bibleProd, databasePaths.bible.iosProd);

  console.log('\n📊 Bible size audit\n');
  reportSize('Bible.db (root)', bibleDev);
  reportSize('Bible.db (ios)', databasePaths.bible.iosDev);
  reportSize('Bible.zip (root)', bibleProd);
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
