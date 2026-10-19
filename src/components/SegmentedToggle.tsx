import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import Animated, {
  type SharedValue,
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {useTheme} from '../contexts/ThemeContext';
import {useSlidingPill} from '../hooks/useSlidingPill';
import {useResponsive} from '../theme/responsive';
import {hexToRgba} from '../utils/colorUtils';

const TRACK_PADDING = 4;
const TRACK_BORDER = 1;
const ACTIVE_TEXT = '#FFFFFF';

export interface SegmentedToggleOption<T extends string> {
  key: T;
  label: string;
}

interface SegmentedToggleProps<T extends string> {
  options: ReadonlyArray<SegmentedToggleOption<T>>;
  selected: T;
  onChange: (key: T) => void;
}

interface SegmentLabelProps {
  label: string;
  index: number;
  active: boolean;
  segmentWidth: number;
  translateX: SharedValue<number>;
  inactiveColor: string;
  fontSize: number;
}

// The label turns white as the pill slides under it, so it never shows white
// text on the light track while the pill is still on its way.
export const SegmentLabel: React.FC<SegmentLabelProps> = ({
  label,
  index,
  active,
  segmentWidth,
  translateX,
  inactiveColor,
  fontSize,
}) => {
  const colorStyle = useAnimatedStyle(() => {
    const distance =
      segmentWidth > 0
        ? Math.min(Math.abs(translateX.value / segmentWidth - index), 1)
        : active
        ? 0
        : 1;
    return {
      color: interpolateColor(distance, [0, 1], [ACTIVE_TEXT, inactiveColor]),
    };
  });

  return (
    <Animated.Text
      numberOfLines={1}
      style={[
        styles.text,
        active ? styles.textActive : styles.textInactive,
        {fontSize},
        colorStyle,
      ]}
    >
      {label}
    </Animated.Text>
  );
};

function SegmentedToggleInner<T extends string>({
  options,
  selected,
  onChange,
}: SegmentedToggleProps<T>) {
  const {theme} = useTheme();
  const {fontFor, isSmall} = useResponsive();
  const selectedIndex = Math.max(
    0,
    options.findIndex(option => option.key === selected),
  );
  const {segmentWidth, translateX, pillStyle, onLayout} = useSlidingPill(
    selectedIndex,
    options.length,
    TRACK_PADDING + TRACK_BORDER,
  );

  const trackBorder = hexToRgba(theme.colors.divider, theme.isDark ? 0.38 : 0.5);

  return (
    <View
      accessibilityRole="tablist"
      onLayout={onLayout}
      style={[
        styles.track,
        {
          backgroundColor: hexToRgba(theme.colors.readerBackground, 0.85),
          borderColor: trackBorder,
        },
      ]}
    >
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            styles.pill,
            {width: segmentWidth, backgroundColor: theme.colors.navBackground},
            pillStyle,
          ]}
        />
      )}
      {options.map((option, index) => {
        const active = index === selectedIndex;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{selected: active}}
            onPress={() => onChange(option.key)}
            style={({pressed}) => [
              styles.segment,
              // Until the track is measured there is no pill yet.
              active && segmentWidth === 0 && {backgroundColor: theme.colors.navBackground},
              pressed && !active && styles.pressed,
            ]}
          >
            <SegmentLabel
              label={option.label}
              index={index}
              active={active}
              segmentWidth={segmentWidth}
              translateX={translateX}
              inactiveColor={theme.colors.textPrimary}
              fontSize={fontFor(isSmall ? 13 : 15)}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 999,
    padding: TRACK_PADDING,
    borderWidth: TRACK_BORDER,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  pill: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderRadius: 999,
  },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  pressed: {
    opacity: 0.6,
  },
  text: {
    textAlign: 'center',
  },
  textActive: {
    fontWeight: '700',
  },
  textInactive: {
    fontWeight: '600',
  },
});

export const SegmentedToggle = React.memo(SegmentedToggleInner) as typeof SegmentedToggleInner;
