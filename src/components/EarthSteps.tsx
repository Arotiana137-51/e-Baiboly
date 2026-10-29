import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {EarthTheme} from '../hooks/useEarthTheme';

// The step buttons of the sand-and-paper screens: Teny ho anao and the widget
// guide it leads to.

// A wide pill: the step's action filled, the others outlined ('quiet' for
// the one that changes nothing).
export const Pill = ({
  label,
  onPress,
  earth,
  kind = 'filled',
  disabled,
}: {
  label: string;
  onPress: () => void;
  earth: EarthTheme;
  kind?: 'filled' | 'outline' | 'quiet';
  disabled?: boolean;
}) => {
  const filled = kind === 'filled';
  const color = filled ? earth.onAccent : kind === 'outline' ? earth.accentText : earth.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{disabled: !!disabled}}
      style={({pressed}) => [
        styles.pill,
        filled
          ? {backgroundColor: earth.accent}
          : [styles.pillOutline, {borderColor: kind === 'outline' ? earth.accentText : earth.edge}],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.pillText, {color}]}>{label}</Text>
    </Pressable>
  );
};

const StepDots = ({count, current, earth}: {count: number; current: number; earth: EarthTheme}) => (
  <View style={styles.dots} accessibilityLabel={`${current + 1} / ${count}`}>
    {Array.from({length: count}, (_, i) => (
      <View
        key={i}
        style={[styles.dot, i === current && styles.dotOn, {backgroundColor: i === current ? earth.accentText : earth.edge}]}
      />
    ))}
  </View>
);

// A step's buttons: the next step as a wide pill, the quiet way back as text
// under it. Both centred, so either thumb reaches them.
export const StepFooter = ({
  earth,
  dots,
  nextLabel,
  onNext,
  nextDisabled,
  backLabel,
  onBack,
}: {
  earth: EarthTheme;
  dots: {count: number; current: number};
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  backLabel: string;
  onBack: () => void;
}) => (
  <View style={[styles.footer, {backgroundColor: earth.ground}]}>
    <StepDots count={dots.count} current={dots.current} earth={earth} />
    <Pill label={nextLabel} onPress={onNext} earth={earth} disabled={nextDisabled} />
    <Pressable style={styles.backButton} onPress={onBack} accessibilityRole="button">
      <Text style={[styles.backText, {color: earth.muted}]}>{backLabel}</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  pill: {minHeight: 54, borderRadius: 27, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center'},
  pillOutline: {borderWidth: 1.5},
  pillText: {fontSize: 17, fontWeight: '700'},
  pressed: {opacity: 0.85},
  disabled: {opacity: 0.35},
  dots: {flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12},
  dot: {width: 6, height: 6, borderRadius: 3},
  dotOn: {width: 20},
  footer: {width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 14, paddingBottom: 12},
  backButton: {alignItems: 'center', justifyContent: 'center', minHeight: 48},
  backText: {fontSize: 16, fontWeight: '600'},
});
