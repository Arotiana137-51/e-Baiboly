/**
 * Adaptive sizing system for SmartBaibolyYarn.
 *
 * Goal: stop hard-coded paddings/fonts from overflowing on small Android (≤360dp)
 * and from blowing up on tablets. Baseline is 375pt wide; scales clamp to
 * [0.85, 1.25] so layouts never collapse or balloon.
 *
 * iOS is deliberately NOT width-scaled. The HIG uses the same point sizes on
 * every iPhone (44pt bars, 17pt titles on an SE and a Pro Max alike); only
 * Dynamic Type (`fontScale`) and the safe-area insets vary per model. Wider
 * screens just get more room for content, not bigger chrome.
 *
 * iPhone widths the app can land on (deployment target iOS 15.1), in points:
 *   320  SE 1st gen                     home button, top inset 20  → xsmall
 *   375  6s/7/8, SE 2/3                 home button, top inset 20  → regular
 *   375  X/XS/11 Pro, 12/13 mini        notch,       top inset 44–47
 *   390  12/13/14, 17e                  notch / Dynamic Island (59)
 *   393  15/16                          Dynamic Island             → regular
 *   402  16 Pro, 17, 17 Pro             Dynamic Island             → large
 *   414  XR/11, 11 Pro Max              notch
 *   428–430  14 Plus, 15/16 Plus & Pro Max                         → large
 *   440  16/17 Pro Max                  Dynamic Island             → xlarge
 *   466  Duo outer (iOS 27)             Dynamic Island             → xlarge
 *   626  Duo inner (iOS 27)             island off to the side, regular
 *        size classes both ways — counts as `isTablet` here.
 * The cutouts are the safe-area hook's problem (react-native-safe-area-context
 * reports them per model); this file only decides sizes.
 *
 * Pure JS — no native deps beyond `useWindowDimensions` (RN core).
 */
import { useMemo } from 'react';
import { Dimensions, Platform, useWindowDimensions } from 'react-native';

export const BASE_WIDTH = 375;
export const BASE_HEIGHT = 812;

const MIN_SCALE = 0.85;
const MAX_SCALE = 1.25;
const MAX_FONT_SCALE = 1.3; // cap system "Largest font" so wrapping stays sane

export type ScreenClass = 'xsmall' | 'small' | 'regular' | 'large' | 'xlarge';

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const isIOS = Platform.OS === 'ios';

// Single scaling rule shared by the static helpers and the hook.
const scaleBy = (size: number, actual: number, base: number) =>
  isIOS
    ? size
    : Math.round(clamp((size * actual) / base, size * MIN_SCALE, size * MAX_SCALE));

const classify = (width: number): ScreenClass => {
  if (width <= 320) return 'xsmall';
  if (width <= 360) return 'small';
  if (width <= 400) return 'regular';
  if (width <= 430) return 'large';
  return 'xlarge';
};

/**
 * Static helpers for use outside React (StyleSheet.create, constants, etc.).
 * Reads Dimensions once — won't react to orientation changes. Prefer the hook
 * for anything rendered.
 */
const initial = Dimensions.get('window');

export const scale = (size: number, w: number = initial.width) =>
  scaleBy(size, w, BASE_WIDTH);

export const verticalScale = (size: number, h: number = initial.height) =>
  scaleBy(size, h, BASE_HEIGHT);

/** Moderate scale — dampens by `factor` (default 0.5). Good for fontSize. */
export const moderateScale = (
  size: number,
  factor: number = 0.5,
  w: number = initial.width,
) => Math.round(size + (scale(size, w) - size) * factor);

/**
 * Hook variant — re-runs on orientation change, Android split-screen, and
 * iPad multitasking. Use this from components.
 */
export const useResponsive = () => {
  const { width, height, fontScale } = useWindowDimensions();

  return useMemo(() => {
    const screenClass = classify(width);
    const isSmall = width <= 360;
    const isXSmall = width <= 320;
    const isTablet = width >= 600;
    const cappedFontScale = Math.min(fontScale, MAX_FONT_SCALE);

    const s = (n: number) => scaleBy(n, width, BASE_WIDTH);
    const vs = (n: number) => scaleBy(n, height, BASE_HEIGHT);
    const ms = (n: number, factor: number = 0.5) =>
      Math.round(n + (s(n) - n) * factor);

    // Effective font size combines design size, optional user pref, and
    // system fontScale (capped). Floor at 12 so things never become unreadable.
    // On iOS that reduces to design size × Dynamic Type, as the HIG expects.
    const fontFor = (size: number, userScale: number = 1) =>
      Math.max(12, Math.round(ms(size) * userScale * cappedFontScale));

    return {
      width,
      height,
      fontScale: cappedFontScale,
      screenClass,
      isSmall,
      isXSmall,
      isTablet,
      isIOS,
      isAndroid: Platform.OS === 'android',
      scale: s,
      verticalScale: vs,
      moderateScale: ms,
      fontFor,
    };
  }, [width, height, fontScale]);
};
