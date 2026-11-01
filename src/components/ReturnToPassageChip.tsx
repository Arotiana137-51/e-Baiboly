import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../contexts/ThemeContext';
import {t} from '../i18n/strings';
import {formatReaderSpot, type ReaderSpot} from '../utils/returnTrail';

type Props = {
  // Where the back step lands; nothing shows without one.
  spot: ReaderSpot | null;
  onReturn: () => void;
  onDismiss: () => void;
};

// After a tap on a Bible reference: a pill over the top of the reader naming
// the verse the user came from. Tap it to go back there, × to drop the trail.
export const ReturnToPassageChip = ({spot, onReturn, onDismiss}: Props) => {
  const {theme} = useTheme();
  if (!spot) return null;
  const label = formatReaderSpot(spot);

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={[styles.chip, {backgroundColor: theme.colors.navBackground}]}>
        <Pressable
          onPress={onReturn}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('reader.returnTo', {place: label})}
          style={styles.back}
        >
          <Text style={styles.arrow}>‹</Text>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('reader.returnDismiss')}
          style={styles.close}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    // Under the cult mode progress bar, which sits 2 dp from the top.
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '80%',
    borderRadius: 18,
    minHeight: 36,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: {width: 0, height: 2},
  },
  back: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 6,
  },
  arrow: {color: '#FFFFFF', fontSize: 22, lineHeight: 24, marginRight: 6},
  label: {flexShrink: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '600'},
  divider: {width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 8, backgroundColor: 'rgba(255,255,255,0.5)'},
  close: {paddingLeft: 10, paddingRight: 12, paddingVertical: 6},
  closeText: {color: '#FFFFFF', fontSize: 18, lineHeight: 20},
});
