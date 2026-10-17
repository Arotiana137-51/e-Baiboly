import {useMemo} from 'react';
import {Platform} from 'react-native';
import {useTheme} from '../contexts/ThemeContext';
import {accentFill, mixHex, readableAccent} from '../utils/colorUtils';

// The calm sand-and-paper palette of Teny ho anao. Only the accent follows the
// reader's theme color.
const LIGHT = {
  ground: '#F3ECE2',
  card: '#FBF7F1',
  quote: '#F1E8DC',
  chip: '#EADFD1',
  ink: '#2E2924',
  muted: '#6B5F53',
  line: '#E7DCCD',
  // Quiet outlines and the step dots still to come.
  edge: '#D2C2AE',
};

const DARK: typeof LIGHT = {
  ground: '#1E1A16',
  card: '#2A241F',
  quote: '#332C25',
  chip: '#3A3129',
  ink: '#EDE4D8',
  muted: '#B5A898',
  line: '#3E352D',
  edge: '#5A4E43',
};

export type EarthTheme = typeof LIGHT & {
  isDark: boolean;
  // Button fill and the text on it.
  accent: string;
  onAccent: string;
  // The accent as text or an outline on the cards.
  accentText: string;
  // A light wash of the accent behind a selected card.
  accentTint: string;
  // The phone's own serif, for verses.
  serif: string;
};

export const useEarthTheme = (): EarthTheme => {
  const {theme} = useTheme();
  const color = theme.colors.accentBlue;
  return useMemo(() => {
    const palette = theme.isDark ? DARK : LIGHT;
    // Checked on the chip, the surface closest to the text's own tone, so it
    // reads on every other one.
    const accentText = readableAccent(color, palette.chip);
    // In dark mode the buttons take the lightened accent too: a dark theme
    // color (black, violet…) would draw a pill that vanishes into the ground.
    const {fill, text} = accentFill(theme.isDark ? accentText : color);
    return {
      ...palette,
      isDark: theme.isDark,
      accent: fill,
      onAccent: text,
      accentText,
      accentTint: mixHex(palette.card, color, theme.isDark ? 0.2 : 0.12),
      serif: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    };
  }, [color, theme.isDark]);
};
