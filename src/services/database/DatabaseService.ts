// src/services/database/DatabaseService.ts
import { open } from 'react-native-quick-sqlite';
import {
  getDatabasePath,
  copyDatabaseFromAssets,
  fileExistsSafe,
  getDatabaseAssetPath,
  excludeDatabaseDirFromBackup
} from '../../utils/paths';
import * as FileSystem from 'react-native-fs';
import { BIBLE_DB_VERSION, HYMNS_DB_VERSION } from './dbVersions';

type QueryResult<T = any> = {
  rows?: { _array: T[]; length: number };
  insertId?: number;
  rowsAffected: number;
};

type QuickSQLiteDatabase = ReturnType<typeof open>;

// Types for our database schema
export interface Book {
  id: number;
  name: string;
  testament: 'old' | 'new';
  chapters: number;
  filename: string;
}

export interface Verse {
  id: number;
  book_id: number;
  chapter: number;
  verse_number: number;
  text: string;
}

export interface Hymn {
  id: string;
  number: number;
  category?: string;
  title: string;
  authors: string;
}

export interface HymnVerse {
  id: number;
  hymn_id: string;
  verse_number: number;
  text: string;
  is_chorus: boolean;
}

// Database configuration
type DatabaseServiceConfig = {
  dbName: string;
  assetPath: string;
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
  private assetPath: string;
  private contentVersion: number;
  private initPromise: Promise<void> | null = null;

  constructor(config: DatabaseServiceConfig) {
    this.dbName = config.dbName;
    this.assetPath = config.assetPath;
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
          const assetPath = __DEV__ ? getDatabaseAssetPath(this.dbName) : (this.assetPath || getDatabaseAssetPath(this.dbName));

          try {
            await copyDatabaseFromAssets(assetPath, dbPath);
            await FileSystem.stat(dbPath);
          } catch (error) {
            console.error('Failed to copy database from assets:', error);
            throw error;
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
   * Apply a single OTA patch atomically: UPDATE the content rows, rebuild
   * the affected FTS rowids, and bump PRAGMA user_version to the patch's
   * version — all inside one BEGIN/COMMIT. If anything throws, the whole
   * patch is rolled back and user_version stays where it was.
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
          `INSERT OR REPLACE INTO Books (id, name, testament, chapters, filename)
           VALUES (?, ?, ?, ?, ?)`,
          [b.id, b.name, b.testament, b.chapters, b.filename]
        );
      }
      for (const v of patch.verses) {
        // Find the existing rowid via the UNIQUE (book_id, chapter, verse_number)
        // tuple so we can rebuild the contentless FTS index correctly.
        const idLookup = tx.execute(
          `SELECT id FROM Verses WHERE book_id=? AND chapter=? AND verse_number=?`,
          [v.book_id, v.chapter, v.verse_number]
        ) as QueryResult<{id: number}>;
        const existingId = idLookup.rows?._array?.[0]?.id;

        tx.execute(
          `UPDATE Verses SET text=?, title=?
           WHERE book_id=? AND chapter=? AND verse_number=?`,
          [v.text, v.title, v.book_id, v.chapter, v.verse_number]
        );

        if (existingId != null) {
          tx.execute(`DELETE FROM VersesFts WHERE rowid=?`, [existingId]);
          tx.execute(
            `INSERT INTO VersesFts(rowid, text_plain) VALUES (?, ?)`,
            [existingId, v.text_plain]
          );
        }
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
          `INSERT OR REPLACE INTO Hymns (id, number, category, title, authors, note)
           VALUES (?, ?, ?, ?, ?, ?)`,
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
        const idLookup = tx.execute(
          `SELECT id FROM HymnVerses WHERE hymn_id=? AND verse_number=?`,
          [v.hymn_id, v.verse_number]
        ) as QueryResult<{id: number}>;
        const existingId = idLookup.rows?._array?.[0]?.id;

        tx.execute(
          `UPDATE HymnVerses SET text=?, is_chorus=?, heading=?
           WHERE hymn_id=? AND verse_number=?`,
          [v.text, v.is_chorus, v.heading ?? null, v.hymn_id, v.verse_number]
        );

        if (existingId != null) {
          tx.execute(`DELETE FROM HymnVersesFts WHERE rowid=?`, [existingId]);
          tx.execute(
            `INSERT INTO HymnVersesFts(rowid, text_plain) VALUES (?, ?)`,
            [existingId, v.text_plain]
          );
        }
      }

      tx.execute(`PRAGMA user_version = ${patch.version}`);
    });
  }

  // Close the database connection
  async closeDatabase(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const bibleDatabaseService = new DatabaseService({
  dbName: 'BibleMG65.db',
  assetPath: getDatabaseAssetPath('BibleMG65.db'),
  contentVersion: BIBLE_DB_VERSION,
});

export const hymnsDatabaseService = new DatabaseService({
  dbName: 'Hymns.db',
  assetPath: getDatabaseAssetPath('Hymns.db'),
  contentVersion: HYMNS_DB_VERSION,
});

export const databaseService = bibleDatabaseService;
export default bibleDatabaseService;