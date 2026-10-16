import fs from 'fs';
import path from 'path';
import {BIBLE_DB_VERSION, HYMNS_DB_VERSION} from '../src/services/database/dbVersions';

// The app trusts dbVersions.ts to know which DB it ships. A constant ahead of
// the file (`yarn bump:db-version` without a rebuild) makes every launch
// replace the user's DB with the same older one, and a schema change then
// fails with "no such table".
//
// The prod ZIPs are stored, not deflated, so the DB header sits in them as is:
// its user_version is the 4 bytes at offset 60.
const stampedVersion = (file: string) => {
  const bytes = fs.readFileSync(path.join(__dirname, '..', file));
  const header = bytes.indexOf('SQLite format 3\0');
  return header < 0 ? -1 : bytes.readUInt32BE(header + 60);
};

describe('dbVersions', () => {
  it.each([
    ['assets/data/dev/BibleMG65.db', BIBLE_DB_VERSION],
    ['assets/data/prod/BibleMG65.zip', BIBLE_DB_VERSION],
    ['ios/SmartBaibolyYarn/Resources/data/prod/BibleMG65.zip', BIBLE_DB_VERSION],
    ['assets/data/dev/Hymns.db', HYMNS_DB_VERSION],
    ['assets/data/prod/Hymns.zip', HYMNS_DB_VERSION],
    ['ios/SmartBaibolyYarn/Resources/data/prod/Hymns.zip', HYMNS_DB_VERSION],
  ])('%s carries the version the app expects', (file, version) => {
    expect(stampedVersion(file)).toBe(version);
  });
});
