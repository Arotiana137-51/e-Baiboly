import * as FileSystem from 'react-native-fs';
import {unzip} from 'react-native-zip-archive';
import {copyDatabaseFromAssets, isTruncatedDatabase} from '../src/utils/paths';

const fs = FileSystem as unknown as Record<string, jest.Mock>;
const DIR = '/mock/documents/default';
const TARGET = `${DIR}/BibleMG65.db`;

// A tiny in-memory file tree: path -> size (directories have no size).
let files: Map<string, number | 'dir'>;
const childrenOf = (dir: string) =>
  [...files.keys()].filter(p => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/'));

beforeEach(() => {
  jest.clearAllMocks();
  files = new Map([[DIR, 'dir']]);
  fs.exists.mockImplementation(async (p: string) => files.has(p));
  fs.mkdir.mockImplementation(async (p: string) => {
    files.set(p, 'dir');
  });
  fs.copyFile.mockImplementation(async (_from: string, to: string) => {
    files.set(to, 9);
  });
  fs.unlink.mockImplementation(async (p: string) => {
    [...files.keys()].filter(k => k === p || k.startsWith(`${p}/`)).forEach(k => files.delete(k));
  });
  fs.moveFile.mockImplementation(async (from: string, to: string) => {
    files.set(to, files.get(from) as number);
    files.delete(from);
  });
  fs.readDir.mockImplementation(async (dir: string) =>
    childrenOf(dir).map(p => ({
      path: p,
      name: p.split('/').pop(),
      isFile: () => files.get(p) !== 'dir',
      isDirectory: () => files.get(p) === 'dir',
    })),
  );
  (unzip as jest.Mock).mockImplementation(async (_zip: string, to: string) => {
    files.set(`${to}/BibleMG65.db`, 21);
  });
});

describe('copyDatabaseFromAssets', () => {
  it('unzips into a scratch folder and moves the DB into place once complete', async () => {
    await copyDatabaseFromAssets('BibleMG65.zip', TARGET);

    const [, unzipTo] = (unzip as jest.Mock).mock.calls[0];
    expect(unzipTo).toBe(`${DIR}/.extract-BibleMG65.db`);
    expect(fs.moveFile).toHaveBeenCalledWith(`${unzipTo}/BibleMG65.db`, TARGET);
    expect([...files.keys()].sort()).toEqual([DIR, TARGET]);
  });

  it('leaves no DB behind when the copy is cut short', async () => {
    (unzip as jest.Mock).mockImplementation(async (_zip: string, to: string) => {
      files.set(`${to}/BibleMG65.db`, 3); // half written...
      throw new Error('ENOSPC: no space left on device');
    });

    await expect(copyDatabaseFromAssets('BibleMG65.zip', TARGET)).rejects.toThrow('ENOSPC');
    expect(fs.moveFile).not.toHaveBeenCalled();
    expect([...files.keys()]).toEqual([DIR]);
  });

  it('clears what an earlier cut-short copy left', async () => {
    files.set(`${TARGET}.zip`, 21);
    files.set(`${DIR}/.extract-BibleMG65.db`, 'dir');
    files.set(`${DIR}/.extract-BibleMG65.db/BibleMG65.db`, 4);

    await copyDatabaseFromAssets('BibleMG65.zip', TARGET);
    expect([...files.keys()].sort()).toEqual([DIR, TARGET]);
  });
});

describe('isTruncatedDatabase', () => {
  // A 100-byte SQLite header: 4096-byte pages, 10 pages, counters in sync.
  const header = (pageCount = 10, validFor = 5) => {
    const b = new Uint8Array(100);
    b.set([...'SQLite format 3'].map(c => c.charCodeAt(0)));
    b.set([0x10, 0x00], 16);
    b.set([0, 0, 0, 5], 24);
    b.set([0, 0, 0, pageCount], 28);
    b.set([0, 0, 0, validFor], 92);
    return Buffer.from(b).toString('base64');
  };
  const disk = (dbSize: number, walSize?: number) => {
    fs.read.mockImplementation(async () => header());
    fs.exists.mockImplementation(async (p: string) => p.endsWith('-wal') ? walSize !== undefined : true);
    fs.stat.mockImplementation(async (p: string) => ({size: p.endsWith('-wal') ? walSize : dbSize}));
  };

  it('spots a file shorter than its header says', async () => {
    disk(8192);
    expect(await isTruncatedDatabase(TARGET)).toBe(true);
  });

  it('accepts a complete file, also next to the empty -wal a killed session leaves', async () => {
    disk(40960);
    expect(await isTruncatedDatabase(TARGET)).toBe(false);
    disk(8192, 0);
    expect(await isTruncatedDatabase(TARGET)).toBe(true);
  });

  it('trusts SQLite while the -wal holds data, and an unreliable size field', async () => {
    disk(8192, 4120);
    expect(await isTruncatedDatabase(TARGET)).toBe(false);
    disk(8192);
    fs.read.mockImplementation(async () => header(10, 4));
    expect(await isTruncatedDatabase(TARGET)).toBe(false);
  });
});
