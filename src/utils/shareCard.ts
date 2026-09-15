import type {View} from 'react-native';
import {captureRef, releaseCapture} from 'react-native-view-shot';
import Share from 'react-native-share';
import {launchImageLibrary} from 'react-native-image-picker';
import type {BibleVerse} from '../hooks/useBibleData';
import type {HymnVerse} from '../hooks/useHymnsData';
import {buildHymnDisplay, buildVerseDisplay, type ChapterDisplay} from './chapterMarks';
import {getRelativeLuminance} from './colorUtils';

export type ShareCardItem = {label: string; text: string};

export type ShareCardData = {
  reference: string;
  // Bible: reference is "Book ch:" and the verse range is appended.
  // Hymn: reference is complete, the labels sit inline on the card.
  appendRange: boolean;
  // true: `items` are candidates starting at the tapped verse/stanza and the
  // modal's stepper picks how many to show. false: `items` are shown as-is
  // (an editor selection — the user already chose exactly what to share).
  rangeStepper: boolean;
  items: ShareCardItem[];
};

export type ShareReference = Pick<ShareCardData, 'reference' | 'appendRange'>;

// What the card is painted with. `imageUri` (a photo the user picked) sits
// under a dark scrim, so its text/accent are always the light pair.
export type ShareCardLook = {
  background: string;
  text: string;
  accent: string;
  imageUri?: string;
};

export const PRESET_LOOKS: ShareCardLook[] = [
  {background: '#F6EBD9', text: '#2B2116', accent: '#007991'},
  {background: '#0B0B0C', text: '#F2E6D5', accent: '#FFD60A'},
];

const LIGHT_INK = {text: '#FFFFFF', accent: '#FFD60A'};
const DARK_INK = {text: '#1B1B1B', accent: '#004E64'};

export const lookForColor = (hex: string): ShareCardLook => ({
  background: hex,
  ...(getRelativeLuminance(hex) < 0.4 ? LIGHT_INK : DARK_INK),
});

export const lookForImage = (imageUri: string): ShareCardLook => ({
  background: '#000000',
  ...LIGHT_INK,
  imageUri,
});

export const MAX_SHARE_ITEMS = 5;

// Output size of the shared PNG (Instagram/Facebook story native size).
export const SHARE_IMAGE_WIDTH = 1080;
export const SHARE_IMAGE_HEIGHT = 1920;

// Let the user pick a photo for the card background. Resolves null on cancel
// or failure. The picker returns a downscaled copy, so a 12 MP shot never has
// to be decoded at full size.
export const pickBackgroundImage = async (): Promise<string | null> => {
  try {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      maxWidth: SHARE_IMAGE_WIDTH,
      maxHeight: SHARE_IMAGE_HEIGHT,
      quality: 0.9,
    });
    return result.assets?.[0]?.uri ?? null;
  } catch (error) {
    console.error('Error picking background image:', error);
    return null;
  }
};

export const buildShareReference = (data: ShareCardData, count: number): string => {
  const shown = data.items.slice(0, count);
  if (!data.appendRange || shown.length === 0) return data.reference;
  const first = shown[0].label;
  const last = shown[shown.length - 1].label;
  return first === last ? `${data.reference}${first}` : `${data.reference}${first}-${last}`;
};

export const buildShareText = (data: ShareCardData, count: number): string => {
  const shown = data.items.slice(0, count);
  const body =
    shown.length === 1 && data.appendRange
      ? shown[0].text
      : shown.map(item => `${item.label} ${item.text}`).join('\n');
  return `${body}\n\n${buildShareReference(data, count)}`;
};

export const buildBibleShareItems = (
  verses: BibleVerse[],
  startIndex: number,
  transformText: (text: string) => string,
): ShareCardItem[] =>
  verses.slice(startIndex, startIndex + MAX_SHARE_ITEMS).map(verse => ({
    label: String(verse.verse_number),
    text: buildVerseDisplay(verse, transformText).displayText,
  }));

// Tapped stanza first, then the chorus once (if any), then the following
// stanzas — the order a hymn is sung in, so "+" adds the refrain first.
export const buildHymnShareItems = (
  hymnVerses: HymnVerse[],
  stanzaNumber: number,
  chorusLabel: string,
): ShareCardItem[] => {
  const display = buildHymnDisplay(hymnVerses, chorusLabel).verses;
  const chorus = display.find(v => v.verseNumber === 0);
  const stanzas = display.filter(v => v.verseNumber >= stanzaNumber && v.verseNumber !== 0);
  if (stanzas.length === 0) return [];

  const ordered = [stanzas[0], ...(chorus ? [chorus] : []), ...stanzas.slice(1)];
  return ordered.slice(0, MAX_SHARE_ITEMS).map(v => ({
    label: v.verseNumber === 0 ? chorusLabel : String(v.verseNumber),
    text: v.displayText,
  }));
};

// An editor selection [start, end) in chapterText, split per verse it touches
// so the card can label each piece. Partial verses keep only the selected
// slice.
export const buildSelectionShareItems = (
  chapter: ChapterDisplay,
  start: number,
  end: number,
): ShareCardItem[] => {
  const chorusLabel = chapter.verses.find(v => v.verseNumber === 0)?.title ?? '0';
  return chapter.verseSpans
    .filter(span => span.start < end && span.end > start)
    .map(span => ({
      label: span.verseNumber === 0 ? chorusLabel : String(span.verseNumber),
      text: chapter.chapterText
        .slice(Math.max(start, span.start), Math.min(end, span.end))
        .trim(),
    }))
    .filter(item => item.text.length > 0);
};

// Rasterize the card view and hand the PNG to the OS share sheet. Resolves
// false on cancel or failure so the modal can stay open.
export const shareImage = async (view: View): Promise<boolean> => {
  let uri: string | null = null;
  try {
    uri = await captureRef(view, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      width: SHARE_IMAGE_WIDTH,
      height: SHARE_IMAGE_HEIGHT,
    });
    const result = await Share.open({url: uri, type: 'image/png', failOnCancel: false});
    // Not released on success: the receiving app may still be reading the
    // file. It lives in the cache dir and is gone on next app start anyway.
    if (result.success) return true;
    releaseCapture(uri);
    return false;
  } catch (error) {
    if (uri) releaseCapture(uri);
    console.error('Error sharing verse image:', error);
    return false;
  }
};

export const shareText = async (message: string): Promise<boolean> => {
  try {
    const result = await Share.open({message, failOnCancel: false});
    return result.success;
  } catch (error) {
    console.error('Error sharing verse text:', error);
    return false;
  }
};
