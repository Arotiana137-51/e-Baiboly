import {accentFill, byHue, contrastRatio, desaturateHex, HIGHLIGHT_ALPHA, readableAccent, translucentHighlight} from '../src/utils/colorUtils';
import {PRIMARY_COLOR_OPTIONS} from '../src/theme/personalizationPalette';

// Teny ho anao takes its accent from the reader's theme color, so every color
// of the palette has to give readable buttons and links on the earth grounds.
const GROUNDS = ['#F3ECE2', '#FBF7F1', '#F1E8DC', '#EADFD1', '#1E1A16', '#2A241F', '#332C25', '#3A3129'];

describe('accent colors', () => {
  it.each(PRIMARY_COLOR_OPTIONS.map(o => [o.name, o.hex]))('%s fills a readable button', (_name, hex) => {
    const {fill, text} = accentFill(hex);
    expect(contrastRatio(fill, text)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PRIMARY_COLOR_OPTIONS.map(o => [o.name, o.hex]))('%s reads as text on every ground', (_name, hex) => {
    for (const ground of GROUNDS) {
      expect(contrastRatio(readableAccent(hex, ground), ground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps a color that already reads, and only adjusts the others', () => {
    expect(accentFill('#007991')).toEqual({fill: '#007991', text: '#FFFFFF'});
    expect(accentFill('#D4AF37')).toEqual({fill: '#D4AF37', text: '#2E2924'});
    expect(accentFill('#BE5A38').fill).not.toBe('#BE5A38');
    expect(readableAccent('#2E2924', '#F3ECE2')).toBe('#2E2924');
  });
});

describe('byHue', () => {
  it('goes round the rainbow and leaves the greys for last', () => {
    const sorted = ['#000000', '#0A84FF', '#22C55E', '#545E56', '#F97316', '#C8102E'].sort(byHue);
    expect(sorted).toEqual(['#C8102E', '#F97316', '#22C55E', '#0A84FF', '#545E56', '#000000']);
  });
});

describe('translucentHighlight (iOS, where the text selection is drawn under the text)', () => {
  test('keeps the hue and lets the page, and the selection, show through', () => {
    expect(translucentHighlight('#2196F3', false)).toBe(`rgba(33, 150, 243, ${HIGHLIGHT_ALPHA})`);
    expect(HIGHLIGHT_ALPHA).toBeGreaterThan(0);
    expect(HIGHLIGHT_ALPHA).toBeLessThan(1);
  });

  test('dark mode uses the same desaturated hue as the opaque version', () => {
    const desaturated = desaturateHex('#E91E63', 0.25).replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(desaturated.slice(i, i + 2), 16));
    expect(translucentHighlight('#E91E63', true)).toBe(`rgba(${r}, ${g}, ${b}, ${HIGHLIGHT_ALPHA})`);
  });

  test('anything that is not hex is left alone', () => {
    expect(translucentHighlight('rgba(0, 0, 0, 0.2)', false)).toBe('rgba(0, 0, 0, 0.2)');
  });
});
