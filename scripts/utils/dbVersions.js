// CJS shim of src/services/database/dbVersions.ts so the Node build scripts
// can read the same constants the app reads. Keep the two files in sync via
// `yarn bump:db-version` — never edit either by hand.

module.exports = {
  BIBLE_DB_VERSION: 20260909,
  HYMNS_DB_VERSION: 20260909,
};
