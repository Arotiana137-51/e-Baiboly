// src/utils/paths.ts
import { Platform } from 'react-native';
import * as FileSystem from 'react-native-fs';

/**
 * Cross-platform path utilities for SmartBaibolyYarn
 * This centralizes all path handling to ensure compatibility across
 * Windows, macOS, and development environments
 */

export const isAndroid = Platform.OS === 'android';
export const isIOS = Platform.OS === 'ios';
export const isDevelopment = __DEV__;

export const getDatabaseAssetPath = (dbName: string): string => {
  const ext = __DEV__ ? '.db' : '.zip';
  const fileName = dbName.replace(/\.db$/i, ext);
  // Android: gradle sourceSets in android/app/build.gradle map the variant's
  // data/<mode> directory onto the asset root, so the packaged assets are
  // flat (BibleMG65.db at the top of the assets folder).
  // iOS: only Resources/data/prod is added to the target as a folder
  // reference, so the bundle keeps the prod/ prefix and nothing else from the
  // data tree ships. Dev DBs are not bundled on iOS — a Debug build there
  // would find no asset, which is moot while the app can only be built for
  // iOS in CI.
  if (Platform.OS === 'android') {
    return fileName;
  }
  const subdir = __DEV__ ? 'dev' : 'prod';
  return `${subdir}/${fileName}`;
};

// Base paths for different platforms
export const basePaths = {
  // React Native app paths
  documentDirectory: FileSystem.DocumentDirectoryPath,
  mainBundlePath: FileSystem.MainBundlePath,
  
  // Asset paths (relative to app assets)
  assets: {
    bible: 'data/bible',
    hymns: 'data/hymns',
    databases: 'data',
  },
  
  // Database asset paths
  databaseAssets: {
    bible: getDatabaseAssetPath('BibleMG65.db'),
    hymns: getDatabaseAssetPath('Hymns.db'),
  },
};

/**
 * Gets the platform-specific database directory path.
 *
 * Both platforms resolve to <DocumentDirectory>/default: react-native-quick-sqlite
 * opens with location:'default', which the native layer expands to
 * <DocumentDirectory>/default, so the copied asset must land in that same subdir.
 * On iOS this dedicated subdir is also the unit we exclude from iCloud backup
 * (see excludeDatabaseDirFromBackup) — keeping the DBs out of Documents' root means
 * the exclusion never touches anything else the user expects to be backed up.
 */
export const getDatabaseDirectory = (): string => {
  return `${FileSystem.DocumentDirectoryPath}/default`;
};

/**
 * iOS only: flag the database directory with NSURLIsExcludedFromBackupKey so the
 * bundled Bible/Hymns SQLite files (and their WAL/SHM sidecars) are NOT copied into
 * iCloud / Finder backups. They re-extract from the app bundle on launch, so backing
 * them up just wastes the user's iCloud quota — and Apple's storage guidelines reject
 * apps that back up re-downloadable content.
 *
 * AsyncStorage (favorites, notes, highlights) lives under Application Support, a
 * separate tree, so it is unaffected and still gets backed up. This mirrors the
 * Android <exclude domain="file" path="default/"/> backup rules. No-op on Android,
 * where exclusion is declared in XML.
 *
 * Idempotent and best-effort: mkdir on an existing directory just (re)applies the
 * attribute, and a failure is non-fatal — the DBs still work, they'd only be backed
 * up needlessly.
 */
export const excludeDatabaseDirFromBackup = async (): Promise<void> => {
  if (!isIOS) {
    return;
  }
  try {
    await FileSystem.mkdir(getDatabaseDirectory(), {
      NSURLIsExcludedFromBackupKey: true,
    });
  } catch (error) {
    console.warn('Failed to exclude database directory from iCloud backup:', error);
  }
};

/**
 * Gets the full path for a database file
 */
export const getDatabasePath = (dbName: string): string => {
  const dbDirectory = getDatabaseDirectory();
  return `${dbDirectory}/${dbName}`;
};

/**
 * Gets the base path for Bible data files
 */
export const getBibleDataPath = (): string => {
  return isAndroid 
    ? basePaths.assets.bible 
    : `${FileSystem.MainBundlePath}/src/data/bible`;
};

/**
 * Gets the base path for Hymns data files
 */
export const getHymnsDataPath = (): string => {
  return isAndroid 
    ? basePaths.assets.hymns 
    : `${FileSystem.MainBundlePath}/src/data/hymns`;
};

/**
 * Platform-safe file reading function
 */
export const readFileSafe = async (path: string, encoding: 'utf8' | 'base64' = 'utf8'): Promise<string> => {
  return isAndroid 
    ? FileSystem.readFileAssets(path, encoding)
    : FileSystem.readFile(path, encoding);
};

/**
 * Platform-safe directory reading function
 */
export const readDirSafe = async (path: string): Promise<any[]> => {
  return isAndroid 
    ? FileSystem.readDirAssets(path)
    : FileSystem.readDir(path);
};

/**
 * Platform-safe file existence check
 */
export const fileExistsSafe = async (path: string): Promise<boolean> => {
  try {
    return await FileSystem.exists(path);
  } catch {
    return false;
  }
};

/**
 * Gets the full path for a specific Bible testament
 */
export const getTestamentPath = (testament: 'old_testament' | 'new_testament'): string => {
  const basePath = getBibleDataPath();
  return `${basePath}/${testament}`;
};

/**
 * Gets the full path for a specific hymn file
 */
export const getHymnFilePath = (fileName: string): string => {
  const basePath = getHymnsDataPath();
  return `${basePath}/${fileName}`;
};

/**
 * Ensures a directory exists (platform-safe)
 */
export const ensureDirectoryExists = async (path: string): Promise<void> => {
  try {
    await FileSystem.mkdir(path);
  } catch (error) {
    // Directory might already exist, which is fine
    if (__DEV__) {
      console.log(`Directory ${path} already exists or creation failed:`, error);
    }
  }
};

/**
 * Copies database from assets to device storage
 */
/**
 * Copy a bundled asset onto a writable path.
 *
 * react-native-fs implements copyFileAssets/readFileAssets on Android only —
 * on iOS the native module has no such method and the JS layer throws
 * "readFileAssets is not available on this platform". iOS therefore reads the
 * file out of the main bundle by absolute path instead.
 */
const copyBundledAsset = async (
  assetPath: string,
  targetPath: string
): Promise<void> => {
  if (isAndroid) {
    await FileSystem.copyFileAssets(assetPath, targetPath);
    return;
  }

  // copyFile rejects if the destination already exists, unlike the
  // writeFile call this replaced.
  if (await fileExistsSafe(targetPath)) {
    await FileSystem.unlink(targetPath);
  }
  await FileSystem.copyFile(
    `${FileSystem.MainBundlePath}/${assetPath}`,
    targetPath
  );
};

export const copyDatabaseFromAssets = async (
  assetPath: string,
  targetPath: string
): Promise<void> => {
  const dbDirectory = getDatabaseDirectory();
  await ensureDirectoryExists(dbDirectory);

  if (assetPath.toLowerCase().endsWith('.zip')) {
    const zipTargetPath = `${targetPath}.zip`;
    try {
      await copyBundledAsset(assetPath, zipTargetPath);
    } catch (error) {
      const fallbackAssetPath = assetPath.replace(/\.zip$/i, '.db');
      console.warn(
        `Failed to copy ZIP database asset (${assetPath}). Falling back to DB asset (${fallbackAssetPath}).`,
        error
      );
      await copyBundledAsset(fallbackAssetPath, targetPath);
      return;
    }

    try {
      const zipArchive: any = require('react-native-zip-archive');
      await zipArchive.unzip(zipTargetPath, dbDirectory);

      const expectedExists = await fileExistsSafe(targetPath);
      if (!expectedExists) {
        const expectedFileName = targetPath.split('/').pop();

        if (expectedFileName) {
          const entries = await FileSystem.readDir(dbDirectory);
          const directMatch = entries.find(
            e => e.isFile() && e.name === expectedFileName
          );

          if (directMatch) {
            await FileSystem.moveFile(directMatch.path, targetPath);
          } else {
            for (const entry of entries) {
              if (!entry.isDirectory()) {
                continue;
              }
              const subEntries = await FileSystem.readDir(entry.path);
              const nestedMatch = subEntries.find(
                e => e.isFile() && e.name === expectedFileName
              );
              if (nestedMatch) {
                await FileSystem.moveFile(nestedMatch.path, targetPath);
                break;
              }
            }
          }
        }
      }
    } finally {
      try {
        await FileSystem.unlink(zipTargetPath);
      } catch {
        // ignore
      }
    }
    return;
  }
  
  await copyBundledAsset(assetPath, targetPath);
};

// Export commonly used paths for convenience
export const paths = {
  database: {
    directory: getDatabaseDirectory(),
    bible: getDatabasePath('BibleMG65.db'),
    hymns: getDatabasePath('Hymns.db'),
  },
  data: {
    bible: getBibleDataPath(),
    hymns: getHymnsDataPath(),
  },
  assets: basePaths.assets,
};
