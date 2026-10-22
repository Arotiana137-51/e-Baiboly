import fs from 'fs';
import path from 'path';
import {parseJsonHymns} from '../scripts/source-data/hymns/loaders/jsonHymnLoader';
import {parseYamlHymns} from '../scripts/source-data/hymns/loaders/yamlHymnLoader';

// The hymn JSON sources were scraped from a hymnbook layout, and layout
// artefacts kept landing inside the lyrics: "(Maintimolaly)" as stanza 1,
// section headers glued to the last stanza, author credits as a trailing
// line, choruses numbered like stanzas. Each of those has a proper field
// now; this test keeps a future re-scrape from putting them back.

interface SourceVerse {
  andininy: number;
  lohateny?: string;
  tononkira: string;
  fiverenany: boolean;
}

interface SourceHymn {
  laharana: string;
  fanamarihana?: string;
  hira: SourceVerse[];
}

const HYMNS_DIR = path.join(__dirname, '..', 'scripts', 'source-data', 'hymns');
const FILES = ['01_fihirana_ffpm.json', '02_fihirana_fanampiny.json', '03_antema.json'];

const isLabel = (s: unknown) => typeof s === 'string' && s.trim().length > 0 && !/[()]/.test(s);

describe.each(FILES)('%s', file => {
  const data = JSON.parse(fs.readFileSync(path.join(HYMNS_DIR, file), 'utf8')) as Record<
    string,
    SourceHymn
  >;
  const problems: string[] = [];

  for (const [id, hymn] of Object.entries(data)) {
    if (hymn.fanamarihana !== undefined && !isLabel(hymn.fanamarihana)) {
      problems.push(`${id}: fanamarihana must be a bare label`);
    }
    let expected = 0;
    for (const v of hymn.hira) {
      const t = v.tononkira;
      const where = `${id} v${v.andininy}`;
      if (!t.trim()) problems.push(`${where}: empty stanza`);
      if (/^\s*\([^()]*\)\s*$/.test(t)) problems.push(`${where}: annotation stored as a stanza`);
      if (/\n[ \t]*\n[^a-zà-ÿ\n]+$/.test(t)) problems.push(`${where}: trailing section header`);
      if (t.includes('|')) problems.push(`${where}: layout pipe in lyrics`);
      if (v.lohateny !== undefined && !isLabel(v.lohateny)) problems.push(`${where}: lohateny must be a bare label`);
      if (v.fiverenany) {
        if (v.andininy !== 0) problems.push(`${where}: chorus must be numbered 0`);
      } else if (v.andininy !== ++expected) {
        problems.push(`${where}: expected stanza ${expected}`);
      }
    }
  }

  it('keeps labels, cues and credits out of the lyrics', () => {
    expect(problems).toEqual([]);
  });
});

// What the build actually inserts. HymnVerses has UNIQUE(hymn_id,
// verse_number) ON CONFLICT REPLACE, so two stanzas with the same number lose
// the first one without a word: 36 call-and-response choruses of the
// Fifohazana went missing that way.
describe('hymn loaders', () => {
  const read = (file: string) => fs.readFileSync(path.join(HYMNS_DIR, file), 'utf8');
  const hymns = [
    ...parseJsonHymns(read('01_fihirana_ffpm.json'), 'ffpm'),
    ...parseJsonHymns(read('02_fihirana_fanampiny.json'), 'ff'),
    ...parseJsonHymns(read('03_antema.json'), 'antema'),
    ...parseYamlHymns(read('song_song_fifohazana.yaml'), 'fifo'),
  ];
  const withLyrics = hymns.filter(h => h.verses.some(v => v.text.trim()));

  it('never gives two stanzas of a hymn the same number', () => {
    const clashes = hymns
      .filter(h => new Set(h.verses.map(v => v.number)).size !== h.verses.length)
      .map(h => h.id);
    expect(clashes).toEqual([]);
  });

  it('keeps each call-and-response chorus with its stanza', () => {
    const fifo80 = hymns.find(h => h.id === 'fifo_80')!;
    expect(fifo80.verses.map(v => v.number)).toEqual([1, 2, 3, 4]);
    expect(fifo80.verses[1].text).toContain('Fiadanana no any');
  });

  it('titles every hymn that has lyrics, FFPM by its first line', () => {
    expect(withLyrics.filter(h => !h.title.trim()).map(h => h.id)).toEqual([]);
    expect(hymns.find(h => h.id === 'ffpm_10')!.title).toBe('Ry Tomponay Tsitoha ô!');
  });

  it('keeps the Fanampiny psalm songs whole, not just their first verse', () => {
    const ff56 = hymns.find(h => h.id === 'ff_56')!;
    expect(ff56.verses[0].text).toContain('Ampahafantaro ny lalanao aho'); // Sal 25:4
  });

  it('has every Fanampiny number, psalm songs included', () => {
    const numbers = hymns.filter(h => h.category === 'ff').map(h => h.number);
    expect(numbers).toEqual(Array.from({length: 91}, (_, i) => i + 1));
  });

  it('loads lyrics for every hymn', () => {
    expect(hymns.filter(h => !withLyrics.includes(h)).map(h => h.id)).toEqual([]);
  });
});
