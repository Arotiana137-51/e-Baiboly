import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppMode } from '../screens/MainScreen';
import {useTheme} from '../contexts/ThemeContext';
import { useAdaptiveInsets } from '../hooks/useAdaptiveInsets';
import { SPACING, useResponsive } from '../theme/responsive';
import { useTutorialTarget } from '../contexts/TutorialContext';
import { useSlidingPill } from '../hooks/useSlidingPill';
import { SegmentLabel } from './SegmentedToggle';

// segmentedTrack padding + border width.
const TRACK_INSET = 5;

interface CustomBottomNavProps {
  activeMode: AppMode;
  onTabPress: (mode: AppMode) => void;
  compact?: boolean;
}

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  const parsed =
    normalized.length === 3
      ? normalized
          .split('')
          .map(ch => ch + ch)
          .join('')
      : normalized;

  const int = parseInt(parsed, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const CustomBottomNav: React.FC<CustomBottomNavProps> = ({ activeMode, onTabPress, compact = false }) => {
  const insets = useAdaptiveInsets();
  const {theme} = useTheme();
  const navTargetRef = useTutorialTarget('bottomNav');
  const hymnTabTargetRef = useTutorialTarget('bottomNavHymnTab');
  const bibleTabTargetRef = useTutorialTarget('bottomNavBibleTab');
  const { verticalScale, fontFor, isSmall } = useResponsive();
  const segmentHeight = compact
    ? Math.max(30, verticalScale(34))
    : Math.max(38, verticalScale(42));
  const labelFontSize = compact
    ? fontFor(isSmall ? 12 : 13)
    : fontFor(isSmall ? 14 : 16);
  const trackMaxWidth = compact ? 240 : 380;
  const trackHorizontalMargin = compact ? 72 : 0;

  const trackBackground = theme.isDark
    ? hexToRgba(theme.colors.readerBackground, 0.85)
    : hexToRgba(theme.colors.readerBackground, 0.85);

  const trackBorder = theme.isDark
    ? hexToRgba(theme.colors.divider, 0.38)
    : hexToRgba(theme.colors.divider, 0.5);

  const inactivePressed = theme.isDark
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(0,0,0,0.06)';

  const { segmentWidth, translateX, pillStyle, onLayout } = useSlidingPill(
    activeMode === 'bible' ? 0 : 1,
    2,
    TRACK_INSET,
  );

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          backgroundColor: 'transparent',
          bottom: insets.bottom + SPACING.md,
          paddingBottom: 0,
        },
      ]}
    >
      <View
        ref={navTargetRef}
        collapsable={false}
        onLayout={onLayout}
        style={[
          styles.segmentedTrack,
          {
            backgroundColor: trackBackground,
            borderColor: trackBorder,
            maxWidth: trackMaxWidth,
            marginHorizontal: trackHorizontalMargin,
          },
        ]}
      >
        {segmentWidth > 0 && (
          <Animated.View
            style={[
              styles.pill,
              { width: segmentWidth, backgroundColor: theme.colors.navBackground },
              pillStyle,
            ]}
          />
        )}
        <Pressable
          ref={bibleTabTargetRef}
          collapsable={false}
          onPress={() => onTabPress('bible')}
          style={({pressed}) => [
            styles.segment,
            { height: segmentHeight },
            // Until the track is measured there is no pill yet.
            segmentWidth === 0 && activeMode === 'bible'
              ? {backgroundColor: theme.colors.navBackground}
              : null,
            pressed && activeMode !== 'bible'
              ? {backgroundColor: inactivePressed}
              : null,
          ]}
        >
          <SegmentLabel
            label="Baiboly"
            index={0}
            active={activeMode === 'bible'}
            segmentWidth={segmentWidth}
            translateX={translateX}
            inactiveColor={theme.colors.textPrimary}
            fontSize={labelFontSize}
          />
        </Pressable>

        <Pressable
          ref={hymnTabTargetRef}
          collapsable={false}
          onPress={() => onTabPress('hymnal')}
          style={({pressed}) => [
            styles.segment,
            { height: segmentHeight },
            // Until the track is measured there is no pill yet.
            segmentWidth === 0 && activeMode === 'hymnal'
              ? {backgroundColor: theme.colors.navBackground}
              : null,
            pressed && activeMode !== 'hymnal'
              ? {backgroundColor: inactivePressed}
              : null,
          ]}
        >
          <SegmentLabel
            label="Fihirana"
            index={1}
            active={activeMode === 'hymnal'}
            segmentWidth={segmentWidth}
            translateX={translateX}
            inactiveColor={theme.colors.textPrimary}
            fontSize={labelFontSize}
          />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  segmentedTrack: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    elevation: 7,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 8},
  },
  segment: {
    flex: 1,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 999,
  },
});

export default CustomBottomNav;
