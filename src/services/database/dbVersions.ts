/**
 * Database content versions — single source of truth.
 *
 * Bump the relevant constant whenever the source YAML/JSON for that database
 * changes (typo fix, new verse, schema tweak). The build scripts read this
 * file via the CJS shim at `scripts/utils/dbVersions.js` and stamp the value
 * into the built .db via `PRAGMA user_version`. The app imports it directly
 * and, on launch, compares against the user's writable copy — if the bundled
 * version is newer, the writable copy is deleted and re-extracted from
 * assets.
 *
 * Convention: YYYYMMDD. Pick the date you actually rebuild the DB; it makes
 * "which day's data is in this device" answerable at a glance.
 *
 * IMPORTANT: keep this in sync with scripts/utils/dbVersions.js. Use the
 * `yarn bump:db-version` script — it updates both files atomically.
 */

export const BIBLE_DB_VERSION = 20260909;
export const HYMNS_DB_VERSION = 20260909;
