import React from 'react';
import {Image, Pressable, ScrollView, StyleSheet, Text} from 'react-native';
import {useTheme} from '../contexts/ThemeContext';
import {PRIMARY_COLOR_OPTIONS} from '../theme/personalizationPalette';
import {lookForColor, PRESET_LOOKS, type ShareCardLook} from '../utils/shareCard';

// The two designed looks first, then the app's own colour palette.
export const SWATCH_LOOKS: ShareCardLook[] = [
  ...PRESET_LOOKS,
  ...PRIMARY_COLOR_OPTIONS.map(option => lookForColor(option.hex)),
];

type LookPickerProps = {
  look: ShareCardLook;
  // The photo currently available for the photo tile (chosen earlier, or the
  // one the look already uses).
  photoUri: string | null;
  onSelect: (look: ShareCardLook) => void;
  onPickPhoto: () => void;
};

// Horizontal swatch row shared by the share card and the widget setting: a
// photo tile, then the preset and palette looks. Selection is by background
// colour, so a look re-created from storage still reads as selected.
export const LookPicker = ({look, photoUri, onSelect, onPickPhoto}: LookPickerProps) => {
  const {theme} = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatches}>
      <Pressable
        onPress={onPickPhoto}
        style={[
          styles.swatch,
          styles.photoSwatch,
          {
            backgroundColor: theme.colors.backgroundTertiary,
            borderColor: look.imageUri ? theme.colors.accentBlue : theme.colors.divider,
          },
        ]}
      >
        {photoUri ? (
          <Image source={{uri: photoUri}} style={styles.photoThumb} />
        ) : (
          <Text style={[styles.photoPlus, {color: theme.colors.textPrimary}]}>+</Text>
        )}
      </Pressable>
      {SWATCH_LOOKS.map(swatch => (
        <Pressable
          key={swatch.background}
          onPress={() => onSelect(swatch)}
          style={[
            styles.swatch,
            {
              backgroundColor: swatch.background,
              borderColor:
                !look.imageUri && look.background === swatch.background
                  ? theme.colors.accentBlue
                  : theme.colors.divider,
            },
          ]}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  swatches: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
  },
  photoSwatch: {
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  photoPlus: {
    fontSize: 18,
    fontWeight: '700',
  },
});
