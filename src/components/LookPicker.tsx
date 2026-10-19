import React from 'react';
import {Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../contexts/ThemeContext';
import {useEarthTheme} from '../hooks/useEarthTheme';
import {PRIMARY_COLOR_OPTIONS} from '../theme/personalizationPalette';
import {byHue} from '../utils/colorUtils';
import {lookForColor, PRESET_LOOKS, type ShareCardLook} from '../utils/shareCard';

// The app's colour palette in rainbow order, so a colour is easy to find.
const COLOR_LOOKS = [...PRIMARY_COLOR_OPTIONS]
  .sort((a, b) => byHue(a.hex, b.hex))
  .map(option => ({name: option.name, look: lookForColor(option.hex)}));

// The designed looks first, then the palette.
const SWATCH_LOOKS: ShareCardLook[] = [...PRESET_LOOKS, ...COLOR_LOOKS.map(c => c.look)];

type LookPickerProps = {
  look: ShareCardLook;
  // The photo currently available for the photo tile (chosen earlier, or the
  // one the look already uses).
  photoUri: string | null;
  onSelect: (look: ShareCardLook) => void;
  onPickPhoto: () => void;
};

// Selection is by background colour, so a look re-created from storage still
// reads as selected.
const isChosen = (look: ShareCardLook, swatch: ShareCardLook) =>
  !look.imageUri && look.background === swatch.background;

// Horizontal swatch row for the share card sheet: a photo tile, then the
// preset and palette looks.
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
              borderColor: isChosen(look, swatch) ? theme.colors.accentBlue : theme.colors.divider,
            },
          ]}
        />
      ))}
    </ScrollView>
  );
};

// Every look at once, for the widget screen: a labelled photo row, the
// designed looks as small cards that show their text and reference colours,
// then the whole palette as a grid of circles, like the app's own colour screen.
// In the earth colours of Teny ho anao, like the screen it sits on.
export const LookGrid = ({
  look,
  photoUri,
  onSelect,
  onPickPhoto,
  photoLabel,
}: LookPickerProps & {photoLabel: string}) => {
  const earth = useEarthTheme();
  const ring = (on: boolean) =>
    on ? [styles.ringOn, {borderColor: earth.accentText}] : {borderColor: earth.line};
  return (
    <View style={styles.grid}>
      <Pressable
        onPress={onPickPhoto}
        style={[styles.photoRow, {backgroundColor: earth.card}, ring(!!look.imageUri)]}
        accessibilityRole="button"
        accessibilityLabel={photoLabel}
        accessibilityState={{selected: !!look.imageUri}}
      >
        <View style={[styles.photoRowThumb, {backgroundColor: earth.chip}]}>
          {photoUri ? (
            <Image source={{uri: photoUri}} style={styles.photoThumb} />
          ) : (
            <Text style={[styles.photoPlus, {color: earth.ink}]}>+</Text>
          )}
        </View>
        <Text style={[styles.photoRowLabel, {color: earth.ink}]}>{photoLabel}</Text>
      </Pressable>
      <View style={styles.cards}>
        {PRESET_LOOKS.map(preset => (
          <Pressable
            key={preset.background}
            onPress={() => onSelect(preset)}
            style={[styles.card, {backgroundColor: preset.background}, ring(isChosen(look, preset))]}
            accessibilityRole="button"
            accessibilityState={{selected: isChosen(look, preset)}}
          >
            <View style={[styles.cardLine, {backgroundColor: preset.text}]} />
            <View style={[styles.cardRef, {backgroundColor: preset.accent}]} />
          </Pressable>
        ))}
      </View>
      <View style={styles.circles}>
        {COLOR_LOOKS.map(({name, look: swatch}) => {
          const on = isChosen(look, swatch);
          return (
            <Pressable
              key={swatch.background}
              onPress={() => onSelect(swatch)}
              style={[styles.circle, {backgroundColor: swatch.background}, ring(on)]}
              accessibilityRole="button"
              accessibilityLabel={name}
              accessibilityState={{selected: on}}
            >
              {on ? <Text style={[styles.check, {color: swatch.text}]}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
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
  grid: {gap: 20},
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  photoRowThumb: {
    width: 56,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRowLabel: {flex: 1, fontSize: 15, fontWeight: '600'},
  cards: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  card: {
    width: 62,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  cardLine: {width: 30, height: 4, borderRadius: 2},
  cardRef: {width: 16, height: 4, borderRadius: 2},
  ringOn: {borderWidth: 3},
  circles: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {fontSize: 18, fontWeight: '700'},
});
