// scripts/utils/paths.js
/**
 * Cross-platform path utilities for Node.js scripts
 * This centralizes all path handling to ensure compatibility across
 * Windows, macOS, and Linux development environments
 */

const path = require('path');
const fs = require('fs');

// Get the project root directory
const getProjectRoot = () => {
  return path.resolve(__dirname, '../..');
};

// Cross-platform asset paths with dev/prod separation
const getAssetsPaths = () => {
  const projectRoot = getProjectRoot();
  
  return {
    root: path.join(projectRoot, 'assets', 'data'),
    dev: path.join(projectRoot, 'assets', 'data', 'dev'),
    prod: path.join(projectRoot, 'assets', 'data', 'prod'),
    // No android entry on purpose: gradle points each variant's assets.srcDirs
    // straight at assets/data/{dev,prod} above, so copying the DBs under
    // android/app/src/main/assets only shipped a second, dead copy to users.
    ios: {
      root: path.join(projectRoot, 'ios', 'SmartBaibolyYarn', 'Resources', 'data'),
      dev: path.join(projectRoot, 'ios', 'SmartBaibolyYarn', 'Resources', 'data', 'dev'),
      prod: path.join(projectRoot, 'ios', 'SmartBaibolyYarn', 'Resources', 'data', 'prod'),
    },
  };
};

// Cross-platform source data paths
const getSourceDataPaths = () => {
  const projectRoot = getProjectRoot();
  
  return {
    bible: path.join(projectRoot, 'scripts', 'source-data', 'bible'),
    hymns: path.join(projectRoot, 'scripts', 'source-data', 'hymns'),
  };
};

// Database file paths with dev/prod separation
const getDatabasePaths = () => {
  const assets = getAssetsPaths();
  
  return {
    bible: {
      source: path.join(getSourceDataPaths().bible, 'Bible_MG65.json'),
      crossReferences: path.join(getSourceDataPaths().bible, 'cross_references.txt'),
      // Dev mode: uncompressed .db files
      dev: path.join(assets.dev, 'BibleMG65.db'),
      iosDev: path.join(assets.ios.dev, 'BibleMG65.db'),
      // Prod mode: compressed .zip files
      prod: path.join(assets.prod, 'BibleMG65.zip'),
      iosProd: path.join(assets.ios.prod, 'BibleMG65.zip'),
    },
    hymns: {
      source: getSourceDataPaths().hymns,
      // Dev mode: uncompressed .db files
      dev: path.join(assets.dev, 'Hymns.db'),
      iosDev: path.join(assets.ios.dev, 'Hymns.db'),
      // Prod mode: compressed .zip files
      prod: path.join(assets.prod, 'Hymns.zip'),
      iosProd: path.join(assets.ios.prod, 'Hymns.zip'),
    },
  };
};

// Ensure directory exists (cross-platform).
// Accepts a string path, or an object with string fields {root, dev, prod}
// so callers can pass either getAssetsPaths().ios or getAssetsPaths().ios.dev.
const ensureDirectory = (dirPath) => {
  if (typeof dirPath === 'string') {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${dirPath}`);
    }
    return;
  }

  if (dirPath && typeof dirPath === 'object') {
    for (const key of ['root', 'dev', 'prod']) {
      const value = dirPath[key];
      if (typeof value === 'string') {
        if (!fs.existsSync(value)) {
          fs.mkdirSync(value, { recursive: true });
          console.log(`📁 Created directory: ${value}`);
        }
      }
    }
    return;
  }

  throw new TypeError(
    `ensureDirectory expected a string path or {root,dev,prod} object, got ${typeof dirPath}`
  );
};

// Copy file cross-platform with error handling
const copyFileSafe = (source, destination) => {
  try {
    fs.copyFileSync(source, destination);
    console.log(`📋 Copied: ${source} -> ${destination}`);
  } catch (error) {
    console.error(`❌ Failed to copy ${source} to ${destination}:`, error.message);
    throw error;
  }
};

// Get file stats safely
const getFileStats = (filePath) => {
  try {
    return fs.statSync(filePath);
  } catch (error) {
    console.warn(`⚠️ Cannot get stats for ${filePath}:`, error.message);
    return null;
  }
};

// Normalize path for display (handles different OS path separators)
const normalizePathForDisplay = (filePath) => {
  return path.relative(getProjectRoot(), filePath).replace(/\\/g, '/');
};

module.exports = {
  getProjectRoot,
  getAssetsPaths,
  getSourceDataPaths,
  getDatabasePaths,
  ensureDirectory,
  copyFileSafe,
  getFileStats,
  normalizePathForDisplay,
};
