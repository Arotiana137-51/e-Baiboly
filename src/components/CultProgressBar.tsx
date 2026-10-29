import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTheme} from '../contexts/ThemeContext';
import {accentShade, hexToRgba} from '../utils/colorUtils';
import {t} from '../i18n/strings';

type CultProgressBarProps = {
  // 0-based index of the entry on screen.
  current: number;
  count: number;
};

// Where the session is in the playlist: one segment per entry, filled up to
// the one on screen. Laid over the top edge of the reader, 2 dp under the top
// nav, in a shade of the theme color that stands apart from it.
export const CultProgressBar = ({current, count}: CultProgressBarProps) => {
  const {theme} = useTheme();
  const tint = useMemo(() => {
    const ink = accentShade(theme.colors.navBackground, theme.colors.readerBackground);
    return StyleSheet.create({
      done: {backgroundColor: ink},
      todo: {backgroundColor: hexToRgba(ink, 0.22)},
    });
  }, [theme.colors.navBackground, theme.colors.readerBackground]);

  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('cultMode.title')}
      accessibilityValue={{min: 1, max: count, now: current + 1, text: `${current + 1} / ${count}`}}
      style={styles.bar}
    >
      {Array.from({length: count}, (_, i) => (
        <View key={i} style={[styles.segment, i <= current ? tint.done : tint.todo]} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 2,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 2,
    height: 4,
  },
  segment: {flex: 1},
});
