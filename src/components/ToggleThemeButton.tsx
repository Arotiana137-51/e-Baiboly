import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import {useLowEndMode} from '../contexts/ThemeContext';

type Props = {
  isDarkMode: boolean;
  onToggle: (nextIsDarkMode: boolean) => void;
  disabled?: boolean;
};

const TRACK_WIDTH = 112;
const TRACK_HEIGHT = 42;
const KNOB_SIZE = 38;
const KNOB_PADDING = 2;

const TRACK_ICON_SIZE = 24;
const KNOB_ICON_SIZE = 20;

type IconProps = {size: number; color: string; backgroundColor: string; opacity?: number};

// Four bars through the centre give eight rays; a disc in the surface colour
// masks their inner ends so they read as detached from the core.
const SUN_RAY_ANGLES = [0, 45, 90, 135];

// Drawn from Views rather than a text glyph: a glyph sits on the font's
// baseline, which iOS and Android place differently, so it never centred on
// both (includeFontPadding/textAlignVertical are Android-only).
const SunIcon: React.FC<IconProps> = ({size, color, backgroundColor, opacity = 1}) => {
  const core = Math.round(size * 0.46);
  const gap = Math.round(size * 0.66);
  const ray = Math.max(2, Math.round(size * 0.1));

  return (
    <View style={[styles.iconBox, {width: size, height: size, opacity}]}>
      {SUN_RAY_ANGLES.map(deg => (
        <View
          key={deg}
          style={[
            styles.centered,
            {
              width: size,
              height: ray,
              borderRadius: ray / 2,
              backgroundColor: color,
              transform: [{rotate: `${deg}deg`}],
            },
          ]}
        />
      ))}
      <View style={[styles.centered, {width: gap, height: gap, borderRadius: gap / 2, backgroundColor}]} />
      <View style={[styles.centered, {width: core, height: core, borderRadius: core / 2, backgroundColor: color}]} />
    </View>
  );
};

const MoonIcon: React.FC<IconProps> = ({
  size,
  color,
  backgroundColor,
  opacity = 1,
}) => {
  const cutoutSize = Math.round(size * 0.78);
  const cutoutOffsetX = Math.round(size * 0.36);
  const cutoutOffsetY = Math.round(size * 0.04);

  return (
    <View style={{width: size, height: size, opacity}}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: cutoutOffsetX,
          top: cutoutOffsetY,
          width: cutoutSize,
          height: cutoutSize,
          borderRadius: cutoutSize / 2,
          backgroundColor,
        }}
      />
    </View>
  );
};

const ToggleThemeButton: React.FC<Props> = ({isDarkMode, onToggle, disabled}) => {
  const translateX = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;
  const {isLowEndMode} = useLowEndMode();

  useEffect(() => {
    translateX.stopAnimation();
    if (isLowEndMode) {
      translateX.setValue(isDarkMode ? 1 : 0);
      return;
    }

    Animated.timing(translateX, {
      toValue: isDarkMode ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isDarkMode, translateX, isLowEndMode]);

  // Stop any in-flight animation on unmount so the native driver doesn't detach
  // the interpolation node mid-run (InterpolationAnimatedNode.onDetached crash).
  useEffect(() => () => translateX.stopAnimation(), [translateX]);

  const knobTranslate = useMemo(() => {
    const maxX = TRACK_WIDTH - KNOB_SIZE - KNOB_PADDING * 2;
    return translateX.interpolate({
      inputRange: [0, 1],
      outputRange: [0, maxX],
    });
  }, [translateX]);

  const trackBackground = useMemo(() => {
    return isDarkMode ? '#111111' : '#FFFFFF';
  }, [isDarkMode]);

  const borderColor = useMemo(() => {
    return isDarkMode ? '#00000040' : '#00000020';
  }, [isDarkMode]);

  const knobBackground = useMemo(() => {
    return isDarkMode ? '#2A2A2A' : '#F3E7D6';
  }, [isDarkMode]);

  const iconBaseColor = useMemo(() => {
    return isDarkMode ? '#EDEDED' : '#2B2116';
  }, [isDarkMode]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{checked: isDarkMode, disabled: !!disabled}}
      accessibilityLabel="Toggle theme"
      disabled={disabled}
      onPress={() => onToggle(!isDarkMode)}
      style={({pressed}) => [styles.root, pressed ? styles.rootPressed : null]}
    >
      <View
        style={[
          styles.track,
          {
            backgroundColor: trackBackground,
            borderColor,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <View style={styles.trackIcons} pointerEvents="none">
          <SunIcon
            size={TRACK_ICON_SIZE}
            color={iconBaseColor}
            backgroundColor={trackBackground}
            opacity={isDarkMode ? 0.35 : 1}
          />
          <MoonIcon
            size={TRACK_ICON_SIZE}
            color={iconBaseColor}
            backgroundColor={trackBackground}
            opacity={isDarkMode ? 1 : 0.35}
          />
        </View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.knob,
            {
              backgroundColor: knobBackground,
              transform: [{translateX: knobTranslate}],
            },
          ]}
        >
          {!isDarkMode ? (
            <SunIcon size={KNOB_ICON_SIZE} color={iconBaseColor} backgroundColor={knobBackground} />
          ) : (
            <MoonIcon size={KNOB_ICON_SIZE} color={iconBaseColor} backgroundColor={knobBackground} />
          )}
        </Animated.View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: {
    alignSelf: 'flex-start',
  },
  rootPressed: {
    opacity: 0.9,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: 1,
    padding: KNOB_PADDING,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackIcons: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Absolute children with no offsets are placed by the parent's
  // alignItems/justifyContent, so every layer lands on the box centre.
  centered: {
    position: 'absolute',
  },
});

export default ToggleThemeButton;
