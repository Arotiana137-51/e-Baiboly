import fs from 'fs';
import path from 'path';

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
