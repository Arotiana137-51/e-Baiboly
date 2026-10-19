/**
 * Typography System for SmartBaibolyYarn
 * Based on mobile best practices and accessibility guidelines
 */
import { Platform } from 'react-native';

export const TYPOGRAPHY_SCALE = {
  // Base font size (minimum for accessibility)
  base: 16,
  
  // Heading sizes (1.3x ratio for hierarchy)
  h1: 24,    // 1.5x base - Display headings
  h2: 20,    // 1.25x base - Major headings
  h3: 18,    // 1.125x base - Subheadings
  
  // Body text
  body: 18,   // Base size - Main content
  bodyLarge: 20, // Emphasized body
  
  // Small text
  small: 14,   // 0.875x base - Secondary info
  tiny: 12,    // 0.75x base - Metadata, timestamps
  
  // Specialized sizes
  caption: 14, // Image captions, labels
  footnote: 12, // Footnotes, references
} as const;

export const LINE_HEIGHTS = {
  tight: 1.2,    // Headings
  normal: 1.65,   // Body text
  relaxed: 1.8,  // Long-form content
} as const;

export const LETTER_SPACING = {
  tight: -0.5,   // Headings
  normal: 0,     // Body text
  relaxed: 0.5,  // Emphasized text
} as const;

export const FONT_FAMILIES = {
  // Use platform-specific system fonts for optimal performance
  primary: Platform.OS === 'ios' ? 'System' : 'Roboto',
} as const;

// Typography styles for common use cases
export const TEXT_STYLES = {
  // Headings
  heading: {
    fontFamily: FONT_FAMILIES.primary,
    fontSize: TYPOGRAPHY_SCALE.h2,
    lineHeight: LINE_HEIGHTS.tight * TYPOGRAPHY_SCALE.h2,
    letterSpacing: LETTER_SPACING.tight,
    fontWeight: '600',
    color: '#1c1c1c',
  },
  
  // Body text
  body: {
    fontFamily: FONT_FAMILIES.primary,
    fontSize: TYPOGRAPHY_SCALE.body,
    lineHeight: LINE_HEIGHTS.normal * TYPOGRAPHY_SCALE.body,
    letterSpacing: LETTER_SPACING.normal,
    fontWeight: '400',
    color: '#1c1c1c',
  },
  
  // Bible verse numbers — color is supplied at runtime from theme.colors.verseNumber.
  verseNumber: {
    fontFamily: FONT_FAMILIES.primary,
    fontSize: TYPOGRAPHY_SCALE.small,
    lineHeight: LINE_HEIGHTS.tight * TYPOGRAPHY_SCALE.small,
    letterSpacing: LETTER_SPACING.normal,
    fontWeight: '700',
  },
} as const;

// Helper function to scale font sizes based on user preference
export const scaleFontSize = (baseSize: number, scale: number = 1) => {
  return Math.round(baseSize * scale);
};

/**
 * Device-aware font scaling.
 * Combines design base size with user pref AND device width, so the same
 * 18pt body text isn't crushed on a 320dp phone or stretched on a tablet.
 * Width factor is clamped to [0.85, 1.25]; user scale capped at 2.0.
 */
export const responsiveFontSize = (
  baseSize: number,
  userScale: number = 1,
  deviceWidth: number = 375,
) => {
  const widthFactor = Math.min(Math.max(deviceWidth / 375, 0.85), 1.25);
  const cappedUser = Math.min(Math.max(userScale, 0.5), 2);
  return Math.max(12, Math.round(baseSize * cappedUser * widthFactor));
};
