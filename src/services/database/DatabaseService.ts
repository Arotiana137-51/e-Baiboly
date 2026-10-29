// src/services/database/DatabaseService.ts
import { open } from 'react-native-quick-sqlite';
import {
  getDatabasePath,
  copyDatabaseFromAssets,
  fileExistsSafe,
  getDatabaseAssetPath,
  excludeDatabaseDirFromBackup,
  isTruncatedDatabase
} from '../../utils/paths';
import * as FileSystem from 'react-native-fs';
import { BIBLE_DB_VERSION, HYMNS_DB_VERSION } from './dbVersions';
import { normalizeForFtsContent } from '../../utils/searchNormalize';

type QueryResult<T = any> = {
  rows?: { _array: T[]; length: number };
  insertId?: number;
  rowsAffected: number;
};

type QuickSQLiteDatabase = ReturnType<typeof open>;

// Database configuration
type DatabaseServiceConfig = {
  dbName: string;
  /**
   * Bundled content version (YYYYMMDD) stamped into the asset DB via
   * `PRAGMA user_version` at build time. The writable copy is replaced
   * whenever the bundled version is strictly newer than what's on disk.
   */
  contentVersion: number;
};

class DatabaseService {
  private db: QuickSQLiteDatabase | null = null;
  private dbName: string;
  private contentVersion: number;
  private initPromise: Promise<void> | null = null;

  constructor(config: DatabaseServiceConfig) {
    this.dbName = config.dbName;
    this.contentVersion = config.contentVersion;
  }

  /**
   * Read PRAGMA user_version from the writable copy on disk without
   * disturbing the long-lived handle. Returns 0 if the DB cannot be
   * opened or the pragma read fails — both treated as "stale" so the
   * next step replaces the file.
   */
  private async readOnDiskContentVersion(): Promise<number> {
    let probe: QuickSQLiteDatabase | null = null;
    try {
      probe = open({ name: this.dbName, location: 'default' });
      const result = probe.execute('PRAGMA user_version') as QueryResult<{
        user_version: number;
      }>;
      const row = result.rows?._array?.[0];
      return Number(row?.user_version ?? 0) || 0;
    } catch (error) {
      console.warn(
        `[${this.dbName}] could not read user_version, treating as stale:`,
        error
      );
      return 0;
    } finally {
      if (probe) {
        try {
          probe.close();
        } catch {
          // best-effort
        }
      }
    }
  }

  /**
   * Delete the writable DB and its WAL/SHM sidecars so a clean re-extract
   * from assets can happen. Missing files are ignored.
   */
  private async deleteWritableDb(dbPath: string): Promise<void> {
    for (const suffix of ['', '-wal', '-shm']) {
      const p = `${dbPath}${suffix}`;
      try {
        if (await fileExistsSafe(p)) {
          await FileSystem.unlink(p);
        }
      } catch (error) {
        console.warn(`[${this.dbName}] failed to remove ${p}:`, error);
      }
    }
  }

  // Initialize the database connection
  public async initDatabase(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      return;
    }
    if (this.db) {
      return;
    }

    this.initPromise = (async () => {
      try {
        // Check if we need to copy pre-built database from assets
        // IMPORTANT: The copied DB must be placed in the same directory used by react-native-quick-sqlite.
        const dbPath = getDatabasePath(this.dbName);

        // iOS: keep the bundled DBs out of iCloud backups. Creates the dir if
        // missing and (re)applies the flag every launch; no-op on Android.
        await excludeDatabaseDirFromBackup();

        let exists = await fileExistsSafe(dbPath);

        // Copies cut short before the copy became atomic (app killed, phone
        // full) kept a valid header, so they passed the version check below
        // and stayed broken for good.
        if (exists && (await isTruncatedDatabase(dbPath))) {
          console.warn(`[${this.dbName}] truncated writable copy; refreshing from assets`);
          await this.deleteWritableDb(dbPath);
          exists = false;
        }

        // If a writable copy already exists, check whether the bundled asset
        // is newer (content version stamped via PRAGMA user_version at build
        // time). Strictly `<`: if the on-disk version is *equal or greater*,
        // we keep it. Greater happens when OTA patches (PatchManager) have
        // advanced user_version past the bundled baseline between APK
        // releases — we must not wipe those user-fetched updates.
        if (exists) {
          const onDisk = await this.readOnDiskContentVersion();
          if (onDisk < this.contentVersion) {
            console.log(
              `[${this.dbName}] stale writable copy (on-disk=${onDisk}, bundled=${this.contentVersion}); refreshing from assets`
            );
            await this.deleteWritableDb(dbPath);
            exists = false;
          } else if (onDisk > this.contentVersion) {
            console.log(
              `[${this.dbName}] on-disk=${onDisk} ahead of bundled=${this.contentVersion} (OTA patches applied); keeping writable copy`
            );
          }
        }

        if (!exists) {
          try {
            await copyDatabaseFromAssets(getDatabaseAssetPath(this.dbName), dbPath);
            await FileSystem.stat(dbPath);
          } catch (error) {
            console.error('Failed to copy database from assets:', error);
            throw error;
          }

          // contentVersion comes with the JS, the DB file with the native
          // build. A JS-only reload after `yarn build:bible`, or a release
          // whose constant was bumped without rebuilding the DB, copies an
          // older file than announced, and copies it again on every launch.
          const copied = await this.readOnDiskContentVersion();
          if (copied < this.contentVersion) {
            console.warn(
              `[${this.dbName}] this build ships DB ${copied} but dbVersions.ts expects ${this.contentVersion}: rebuild the native app so it packages the new DB`
            );
          }
        }

        // Open the database (either copied or existing)
        this.db = open({
          name: this.dbName,
          location: 'default',
        });

        await this.executeQuery('PRAGMA foreign_keys = ON');
        // WAL gives concurrent readers and faster commits; safe with synchronous=NORMAL.
        await this.executeQuerySilent('PRAGMA journal_mode = WAL');
        await this.executeQuerySilent('PRAGMA synchronous = NORMAL');
        await this.executeQuerySilent('PRAGMA temp_store = MEMORY');
        // 64 MB mmap is free on Android and cuts cold reads on the FTS shadow tables.
        await this.executeQuerySilent('PRAGMA mmap_size = 67108864');
        // Negative = KiB; -8000 = 8 MB page cache.
        await this.executeQuerySilent('PRAGMA cache_size = -8000');

      } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
      } finally {
        this.initPromise = null;
      }
    })();

    await this.initPromise;
  }

  // Execute a query with parameters
  private async executeQueryInternal<T>(
    query: string,
    params: any[] = [],
    logError: boolean
  ): Promise<{ rows: T[]; insertId?: number; rowsAffected: number }> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = this.db.execute(query, params) as QueryResult<T>;
      return {
        rows: result.rows?._array || [],
        insertId: result.insertId,
        rowsAffected: result.rowsAffected || 0,
      };
    } catch (error) {
      if (logError) {
        console.error('Database query error:', error, '\nQuery:', query);
      }
      throw error;
    }
  }

  async executeQuery<T>(
    query: string,
    params: any[] = []
  ): Promise<{ rows: T[]; insertId?: number; rowsAffected: number }> {
    return this.executeQueryInternal<T>(query, params, true);
  }

  // Execute a query but do not log errors (useful when caller handles expected failures)
  async executeQuerySilent<T>(
    query: string,
    params: any[] = []
  ): Promise<{ rows: T[]; insertId?: number; rowsAffected: number }> {
    return this.executeQueryInternal<T>(query, params, false);
  }

  // Execute a transaction
  async executeTransaction<T>(
    callback: (tx: QuickSQLiteDatabase) => Promise<T>
  ): Promise<T> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Start transaction
      this.db.execute('BEGIN TRANSACTION');
      
      try {
        // Execute the callback with the db instance
        const result = await callback(this.db);
        
        // If we get here, commit the transaction
        this.db.execute('COMMIT');
        return result;
      } catch (error) {
        // If any error occurs, rollback the transaction
        this.db.execute('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Transaction error:', error);
      throw error;
    }
  }

  /**
   * Returns the content version stamped into this DB (PRAGMA user_version).
   * Used by PatchManager to decide whether to fetch any OTA patches.
   * Returns 0 if the DB isn't open or the read fails.
   */
  async getOnDiskUserVersion(): Promise<number> {
    if (!this.db) return 0;
    try {
      const result = await this.executeQuerySilent<{user_version: number}>(
        'PRAGMA user_version'
      );
      return Number(result.rows?.[0]?.user_version ?? 0) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Apply a single OTA patch atomically: update or add the content rows,
   * reindex them, and bump PRAGMA user_version to the patch's version — all
   * inside one BEGIN/COMMIT. If anything throws, the whole patch is rolled
   * back and user_version stays where it was.
   *
   * The verse indexes are contentless FTS5 tables: SQLite refuses a DELETE
   * on them, so a row's old entry goes through the 'delete' command with
   * the text it was indexed with (the stored text, normalized as the build
   * did). The new entry is computed the same way here, never taken from the
   * patch's text_plain, so the next 'delete' always matches it. Parent rows are upserted, never INSERT OR REPLACE: REPLACE deletes
   * the row first and ON DELETE CASCADE takes its verses with it.
   *
   * The patch is trusted only after `parsePatchFile` has validated it
   * upstream — this method does NOT re-validate, it just executes.
   */
  async applyBiblePatch(patch: {
    version: number;
    verses: Array<{
      book_id: number;
      chapter: number;
      verse_number: number;
      text: string;
      text_plain: string;
      title: string | null;
    }>;
    books: Array<{
      id: number;
      name: string;
      testament: 'old' | 'new';
      chapters: number;
      filename: string;
    }>;
  }): Promise<void> {
    await this.executeTransaction(async tx => {
      for (const b of patch.books) {
        tx.execute(
          `INSERT INTO Books (id, name, testament, chapters, filename)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, testament=excluded.testament,
             chapters=excluded.chapters, filename=excluded.filename`,
          [b.id, b.name, b.testament, b.chapters, b.filename]
        );
      }
      for (const v of patch.verses) {
        const lookup = tx.execute(
          `SELECT id, text FROM Verses WHERE book_id=? AND chapter=? AND verse_number=?`,
          [v.book_id, v.chapter, v.verse_number]
        ) as QueryResult<{id: number; text: string}>;
        const old = lookup.rows?._array?.[0];

        let id: number | undefined;
        if (old) {
          id = old.id;
          tx.execute(
            `INSERT INTO VersesFts(VersesFts, rowid, text_plain) VALUES ('delete', ?, ?)`,
            [id, normalizeForFtsContent(old.text)]
          );
          tx.execute(`UPDATE Verses SET text=?, title=? WHERE id=?`, [v.text, v.title, id]);
        } else {
          id = (tx.execute(
            `INSERT INTO Verses (book_id, chapter, verse_number, text, title) VALUES (?, ?, ?, ?, ?)`,
            [v.book_id, v.chapter, v.verse_number, v.text, v.title]
          ) as QueryResult).insertId;
        }
        if (id == null) throw new Error(`No row id for verse ${v.book_id} ${v.chapter}:${v.verse_number}`);
        tx.execute(`INSERT INTO VersesFts(rowid, text_plain) VALUES (?, ?)`, [id, normalizeForFtsContent(v.text)]);
      }
      // PRAGMA user_version doesn't accept bound params — interpolate the
      // already-validated integer literally.
      tx.execute(`PRAGMA user_version = ${patch.version}`);
    });
  }

  /**
   * Apply a single Hymns OTA patch atomically. Same contract as
   * applyBiblePatch — see that method's comment.
   */
  async applyHymnsPatch(patch: {
    version: number;
    hymns: Array<{
      id: string;
      number: number;
      category: string;
      title: string;
      title_plain: string;
      authors: string | null;
      authors_plain: string;
      note?: string | null;
    }>;
    hymnVerses: Array<{
      hymn_id: string;
      verse_number: number;
      heading?: string | null;
      text: string;
      text_plain: string;
      is_chorus: 0 | 1;
    }>;
  }): Promise<void> {
    await this.executeTransaction(async tx => {
      for (const h of patch.hymns) {
        tx.execute(
          `INSERT INTO Hymns (id, number, category, title, authors, note)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET number=excluded.number, category=excluded.category,
             title=excluded.title, authors=excluded.authors, note=excluded.note`,
          [h.id, h.number, h.category, h.title, h.authors, h.note ?? null]
        );

        // HymnsFts is NOT contentless; rowid follows Hymns table insertion
        // order. Look up the rowid we just touched.
        const rowidLookup = tx.execute(
          `SELECT rowid FROM Hymns WHERE id=?`,
          [h.id]
        ) as QueryResult<{rowid: number}>;
        const rowid = rowidLookup.rows?._array?.[0]?.rowid;
        if (rowid != null) {
          tx.execute(`DELETE FROM HymnsFts WHERE rowid=?`, [rowid]);
          tx.execute(
            `INSERT INTO HymnsFts(rowid, title_plain, authors_plain, hymn_id, number, category)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [rowid, h.title_plain, h.authors_plain, h.id, h.number, h.category]
          );
        }
      }

      for (const v of patch.hymnVerses) {
        const lookup = tx.execute(
          `SELECT id, text FROM HymnVerses WHERE hymn_id=? AND verse_number=?`,
          [v.hymn_id, v.verse_number]
        ) as QueryResult<{id: number; text: string}>;
        const old = lookup.rows?._array?.[0];

        let id: number | undefined;
        if (old) {
          id = old.id;
          tx.execute(
            `INSERT INTO HymnVersesFts(HymnVersesFts, rowid, text_plain) VALUES ('delete', ?, ?)`,
            [id, normalizeForFtsContent(old.text)]
          );
          tx.execute(
            `UPDATE HymnVerses SET text=?, is_chorus=?, heading=? WHERE id=?`,
            [v.text, v.is_chorus, v.heading ?? null, id]
          );
        } else {
          id = (tx.execute(
            `INSERT INTO HymnVerses (hymn_id, verse_number, heading, text, is_chorus) VALUES (?, ?, ?, ?, ?)`,
            [v.hymn_id, v.verse_number, v.heading ?? null, v.text, v.is_chorus]
          ) as QueryResult).insertId;
        }
        if (id == null) throw new Error(`No row id for ${v.hymn_id} verse ${v.verse_number}`);
        tx.execute(`INSERT INTO HymnVersesFts(rowid, text_plain) VALUES (?, ?)`, [id, normalizeForFtsContent(v.text)]);
      }

      tx.execute(`PRAGMA user_version = ${patch.version}`);
    });
  }
}

export const bibleDatabaseService = new DatabaseService({
  dbName: 'BibleMG65.db',
  contentVersion: BIBLE_DB_VERSION,
});

export const hymnsDatabaseService = new DatabaseService({
  dbName: 'Hymns.db',
  contentVersion: HYMNS_DB_VERSION,
});