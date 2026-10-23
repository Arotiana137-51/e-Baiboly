import fs from 'fs';
import path from 'path';
import {
  buildEntryFinder,
  dictionaryLetters,
  END_OF_CHAPTER,
  fuzzyDictionary,
  groupByLetter,
  indexDictionaryWords,
  linkedEntries,
  parseDictionaryParagraph,
  resolveRef,
  searchDictionary,
  wordsUnderLetter,
  type DictionaryRef,
} from '../src/utils/dictionary';

// The real book: 3167 entries, about 20 000 Bible refs and 600 "Jereo" links.
const entries: Array<{word: string; text: string}> = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../scripts/source-data/bible/diksionera.json'), 'utf8'),
);
const words = indexDictionaryWords(entries.map((e, i) => ({id: i + 1, word: e.word})));
const findEntry = buildEntryFinder(words);
const noEntry = () => undefined;

const refs = (text: string) =>
  parseDictionaryParagraph(text, noEntry)
    .filter((s): s is Extract<typeof s, {kind: 'ref'}> => s.kind === 'ref')
    .map(s => `${s.bookId}:${s.chapter}:${s.verseStart}-${s.verseEnd}`);

describe('dictionary paragraphs', () => {
  it('give back every paragraph of the book unchanged', () => {
    const changed = entries
      .flatMap(e => e.text.split('\n'))
      .filter(p => parseDictionaryParagraph(p, findEntry).map(s => s.text).join('') !== p);
    expect(changed).toEqual([]);
  });

  it('read a ref list where only the first names the book', () => {
    expect(refs('(Marka 14 : 36 ; 15 : 2 ; Romana 8 : 15)')).toEqual([
      '41:14:36-36',
      '41:15:2-2',
      '45:8:15-15',
    ]);
  });

  it('keep ranges, and stop one that runs into the next chapter at its end', () => {
    expect(refs('Genesisy 2 : 4 - 7')).toEqual(['1:2:4-7']);
    expect(refs('Genesisy 2 : 4 - 3 : 24')).toEqual([`1:2:4-${END_OF_CHAPTER}`]);
  });

  it('only take a book name that starts a word', () => {
    expect(refs('Karota 1 : 2')).toEqual([]);
    expect(refs('Rota 1 : 2')).toEqual(['8:1:2-2']);
    expect(refs('Fitomaniana Jeremia 3 : 22')).toEqual(['25:3:22-22']);
  });

  it('link "Jereo X" to entry X', () => {
    const link = parseDictionaryParagraph('Jereo Babela.', findEntry).find(s => s.kind === 'entry');
    expect(link).toEqual({kind: 'entry', text: 'Babela', entryId: 457});
  });
});

describe('dictionary refs', () => {
  const sizes = new Map([['4:36', 13]]);
  const ref = (chapter: number, verseStart: number, verseEnd: number): DictionaryRef => ({
    bookId: 4,
    bookName: 'Nomery',
    chapter,
    verseStart,
    verseEnd,
  });

  it('drop the misprints MG1865 has no verse for', () => {
    expect(resolveRef(ref(37, 12, 12), sizes)).toBeNull();
    expect(resolveRef(ref(36, 14, 14), sizes)).toBeNull();
  });

  it('stop a range at the last verse of its chapter', () => {
    expect(resolveRef(ref(36, 10, END_OF_CHAPTER), sizes)).toEqual(ref(36, 10, 13));
    expect(resolveRef(ref(36, 2, 5), sizes)).toEqual(ref(36, 2, 5));
  });
});

describe('dictionary letters', () => {
  it('offers only the letters the headwords start with, in order', () => {
    expect(dictionaryLetters(words)).toEqual(
      ['A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'S', 'T', 'V', 'Z'],
    );
  });

  it('groups the whole book into one section per letter, losing no word', () => {
    const sections = groupByLetter(words);
    expect(sections.map(s => s.title)).toEqual(dictionaryLetters(words));
    expect(sections.reduce((n, s) => n + s.data.length, 0)).toBe(words.length);
  });

  it('lists every headword under its letter, none under another', () => {
    const underB = wordsUnderLetter(words, 'B');
    expect(underB).toHaveLength(234);
    expect(underB.every(w => w.main.toUpperCase().startsWith('B'))).toBe(true);
  });
});

describe('dictionary search', () => {
  it('finds an entry by its other spelling, words starting with the query first', () => {
    const found = searchDictionary(words, 'adoram').map(w => w.id);
    expect(found[0]).toBe(72); // ADONIRAMA, na ADORAMA
  });
});

describe('dictionary typo tolerance', () => {
  const mains = (query: string) => fuzzyDictionary(words, query).map(w => w.main);

  it('finds a headword with a letter wrong, missing or swapped', () => {
    expect(mains('abrahma')).toContain('ABRAHAMA');
    expect(mains('babila')).toContain('BABELA');
  });

  it('stays quiet on short queries, where one letter off matches too much', () => {
    expect(mains('abx')).toEqual([]);
  });
});

describe('dictionary see also', () => {
  it('lists each linked entry once, never the entry itself', () => {
    const paragraphs = ['Jereo Babela. Jereo koa Babela.', 'Jereo Babylona.'].map(p =>
      parseDictionaryParagraph(p, findEntry),
    );
    const ids = linkedEntries(paragraphs, 1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(457);
    expect(linkedEntries(paragraphs, 457)).not.toContain(457);
  });
});
