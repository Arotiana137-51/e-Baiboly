import {accentFill, contrastRatio, readableAccent} from '../src/utils/colorUtils';
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
