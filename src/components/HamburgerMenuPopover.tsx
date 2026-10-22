import React, {useEffect, useMemo, useRef} from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {t} from '../i18n/strings';
import {useTheme} from '../contexts/ThemeContext';
import {useTutorialTarget} from '../contexts/TutorialContext';
import TutorialOverlay from './TutorialOverlay';
import ToggleThemeButton from './ToggleThemeButton';
import {useJesusName} from '../contexts/JesusNameContext';
import {getRelativeLuminance, lightenHex} from '../utils/colorUtils';
import {MenuIcon, type MenuIconName} from './MenuIcons';
import {useResponsive} from '../theme/responsive';

// Jesosy/Jesoa slide toggle geometry — a two-label pill with a knob that
// covers exactly one half and slides between them.
const VARIANT_SEGMENT_WIDTH = 74;
const VARIANT_KNOB_WIDTH = VARIANT_SEGMENT_WIDTH;
const VARIANT_TRACK_PAD = 3;

// Design sizes at the 375dp baseline, scaled per screen in the component.
// The width fits the longest row label ("Ora famakiana tiana") on one line at
// the normal font size; larger system fonts end it with "…" (never wraps).
const MENU_WIDTH = 260;
const TILE_MIN_HEIGHT = 60;
// Must match styles.caret's borderBottomWidth.
const CARET_HEIGHT = 12;
// Breathing room kept below the card when it has to scroll.
const MENU_BOTTOM_GAP = 24;

export type HamburgerMenuItemKey =
  | 'favorites'
  | 'history'
  | 'misc'
  | 'notes'
  | 'personalization'
  | 'readingReminder'
  | 'tenyHoAnao'
  | 'cultMode'
  | 'dictionary'
  | 'help';

type MenuEntry = {key: HamburgerMenuItemKey; label: string; icon: MenuIconName};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (key: HamburgerMenuItemKey) => void;
  onAbout: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: (enabled: boolean) => void;
  fontScale?: number;
  topInset?: number;
  menuTop?: number;
  menuRight?: number;
  caretRightOffset?: number;
  fontControlsTop?: number;
  fontControlsRight?: number;
  onIncreaseFont?: () => void;
  onDecreaseFont?: () => void;
};

const HamburgerMenuPopover: React.FC<Props> = ({
  visible,
  onClose,
  onSelect,
  onAbout,
  isDarkMode,
  onToggleDarkMode,
  fontScale = 1,
  topInset = 0,
  menuTop,
  menuRight = 12,
  caretRightOffset = 12,
  fontControlsTop = 0,
  fontControlsRight = 68,
  onIncreaseFont,
  onDecreaseFont,
}) => {
  const {theme, isLowEndMode} = useTheme();
  const {variant: jesusNameVariant, setVariant: setJesusNameVariant} = useJesusName();
  const cultItemRef = useTutorialTarget('cultMenuItem');

  // In dark mode the menu card uses backgroundSecondary (#1C1C1E), so an accent
  // like Deep Navy or Espresso reads as dark-on-dark. Lighten the accent only
  // for text/marks inside this menu, only in dark mode. Light mode is untouched.
  const menuAccent = useMemo(() => {
    if (!theme.isDark) return theme.colors.navBackground;
    const luminance = getRelativeLuminance(theme.colors.navBackground);
    // Darker accents need more lift; cap so it never becomes fluorescent.
    const amount = luminance < 0.05 ? 0.55 : luminance < 0.12 ? 0.45 : 0.3;
    return lightenHex(theme.colors.navBackground, amount);
  }, [theme.isDark, theme.colors.navBackground]);

  const menuCheckAccent = useMemo(() => {
    if (!theme.isDark) return theme.colors.accentBlue;
    const luminance = getRelativeLuminance(theme.colors.accentBlue);
    const amount = luminance < 0.05 ? 0.55 : luminance < 0.12 ? 0.45 : 0.3;
    return lightenHex(theme.colors.accentBlue, amount);
  }, [theme.isDark, theme.colors.accentBlue]);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  // Sliding-knob toggle for the Jesosy/Jesoa name, mirroring ToggleThemeButton.
  // jesosy → left (0), jesoa → right (1).
  const variantSlide = useRef(
    new Animated.Value(jesusNameVariant === 'jesoa' ? 1 : 0),
  ).current;
  useEffect(() => {
    Animated.timing(variantSlide, {
      toValue: jesusNameVariant === 'jesoa' ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [jesusNameVariant, variantSlide]);
  const variantKnobTranslate = variantSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, VARIANT_KNOB_WIDTH],
  });

  // Stop all in-flight animations on unmount so the native driver doesn't detach
  // an interpolation node mid-run (InterpolationAnimatedNode.onDetached crash).
  useEffect(
    () => () => {
      opacity.stopAnimation();
      scale.stopAnimation();
      variantSlide.stopAnimation();
    },
    [opacity, scale, variantSlide],
  );

  const fontPercent = Math.round(fontScale * 100);

  useEffect(() => {
    if (visible) {
      if (isLowEndMode) {
        opacity.stopAnimation();
        scale.stopAnimation();
        opacity.setValue(1);
        scale.setValue(1);
      } else {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 140,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            speed: 20,
            bounciness: 6,
            useNativeDriver: true,
          }),
        ]).start();
      }
      return;
    }

    if (isLowEndMode) {
      opacity.stopAnimation();
      scale.stopAnimation();
      opacity.setValue(0);
      scale.setValue(0.96);
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.96,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacity, scale, isLowEndMode]);

  // Platform menu pattern: icon + label tiles for the most used actions
  // (like the top row of UIMenu's "medium" element size on iOS; four don't
  // fit one row with whole labels, so they sit two by two), then full-width
  // rows with a leading icon, grouped by purpose with dividers (Material's
  // drawer/menu list). Labels stay on one line; help comes last.
  const quickItems = useMemo(
    () =>
      [
        {key: 'favorites' as const, label: t('menu.favorites'), icon: 'heart' as const},
        {key: 'history' as const, label: t('menu.history'), icon: 'history' as const},
        // Short label here; the Notes screen keeps "Ireo Naoty".
        {key: 'notes' as const, label: 'Naoty', icon: 'notes' as const},
        // Short label here too; the screen keeps "Loko manokana".
        {key: 'personalization' as const, label: 'Loko', icon: 'palette' as const},
      ] satisfies MenuEntry[],
    []
  );
  const rowGroups = useMemo(
    () =>
      [
        [
          {key: 'cultMode' as const, label: t('menu.cultMode'), icon: 'hands' as const},
          {key: 'misc' as const, label: t('menu.misc'), icon: 'book' as const},
          {key: 'dictionary' as const, label: t('dictionary.menu'), icon: 'bible' as const},
        ],
        [
          // "Widget" is the word in most languages; the feature itself is
          // still "Teny ho anao" on the screen and on the widget's check-in.
          {key: 'tenyHoAnao' as const, label: 'Widget', icon: 'bubble' as const},
          {key: 'readingReminder' as const, label: 'Ora famakiana tiana', icon: 'bell' as const},
        ],
        [{key: 'help' as const, label: 'Toro-lalana', icon: 'signpost' as const}],
      ] satisfies MenuEntry[][],
    []
  );

  // Card, tiles and rows follow the screen width like the top and bottom
  // bars (theme/responsive: Android only, clamped; iOS keeps fixed points),
  // and labels follow the phone's font size capped at 130%.
  const {scale: rScale, fontFor, height: windowHeight} = useResponsive();
  const menuWidth = rScale(MENU_WIDTH);
  const tileMinHeight = rScale(TILE_MIN_HEIGHT);
  const tileFontSize = fontFor(12);
  const rowFontSize = fontFor(16);
  const cellBackground = (pressed: boolean) =>
    pressed
      ? theme.colors.divider
      : theme.isDark
        ? theme.colors.backgroundTertiary
        : theme.colors.backgroundPrimary;

  // Small phones can't fit the whole card below the top bar: cap it at the
  // space left and let it scroll instead of cutting the last rows off.
  const menuTopValue = menuTop ?? styles.menuContainer.top;
  const menuMaxHeight = windowHeight - menuTopValue - CARET_HEIGHT - MENU_BOTTOM_GAP;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}>
      <View style={styles.root} pointerEvents="box-none">
        <Pressable
          style={[styles.headerCloseHotspot, {height: topInset, right: menuRight}]}
          onPress={onClose}
        />
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
        />

        <Animated.View
          style={[
            styles.fontControlsContainer,
            {
              top: fontControlsTop,
              right: fontControlsRight,
              opacity,
              transform: [{scale}],
            },
          ]}>
          <View
            style={[
              styles.fontControlsCard,
              {
                backgroundColor: theme.colors.navBackground,
              },
            ]}
          >
            <Pressable
              style={({pressed}) => [
                styles.fontControlButton,
                pressed ? styles.fontControlButtonPressed : null,
              ]}
              accessibilityLabel="Increase font size"
              onPress={onIncreaseFont}>
              <Text style={styles.fontControlText}>{t('font.increase')}</Text>
            </Pressable>
            <View style={styles.fontControlDivider} />
            <View
              style={[
                styles.fontControlValue,
                {backgroundColor: theme.colors.readerBackground},
              ]}
              pointerEvents="none"
            >
              <Text
                style={[
                  styles.fontControlValueText,
                  {color: theme.colors.textPrimary},
                ]}
                allowFontScaling={false}
              >
                {fontPercent}%
              </Text>
            </View>
            <View style={styles.fontControlDivider} />
            <Pressable
              style={({pressed}) => [
                styles.fontControlButton,
                pressed ? styles.fontControlButtonPressed : null,
              ]}
              accessibilityLabel="Decrease font size"
              onPress={onDecreaseFont}>
              <Text style={styles.fontControlText}>{t('font.decrease')}</Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.menuContainer,
            {
              top: menuTopValue,
              right: menuRight,
              opacity,
              transform: [{scale}],
            },
          ]}>
          <View
            style={[
              styles.caret,
              {marginRight: caretRightOffset, borderBottomColor: theme.colors.backgroundSecondary},
            ]}
          />
          <View
            style={[
              styles.menuCard,
              {
                width: menuWidth,
                backgroundColor: theme.colors.backgroundSecondary,
                borderColor: theme.colors.divider,
              },
            ]}>
            <ScrollView
              style={{maxHeight: menuMaxHeight}}
              bounces={false}
              showsVerticalScrollIndicator>
              {/* fontFor already applies the phone's font size (capped), so
                  the labels below opt out of a second system scaling. */}
              <View style={styles.quickRow}>
                {quickItems.map(item => (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    onPress={() => onSelect(item.key)}
                    style={({pressed}) => [
                      styles.quickTile,
                      {minHeight: tileMinHeight, backgroundColor: cellBackground(pressed)},
                    ]}>
                    <MenuIcon name={item.icon} color={menuAccent} />
                    <Text
                      style={[styles.quickTileText, {color: menuAccent, fontSize: tileFontSize}]}
                      numberOfLines={1}
                      allowFontScaling={false}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {rowGroups.map(group => (
                <View key={group[0].key}>
                  <View style={[styles.groupDivider, {backgroundColor: theme.colors.divider}]} />
                  {group.map(item => (
                    <Pressable
                      key={item.key}
                      // Tutorial spotlights the Fotoam-pivavahana row via this ref.
                      ref={item.key === 'cultMode' ? cultItemRef : undefined}
                      collapsable={false}
                      accessibilityRole="button"
                      onPress={() => onSelect(item.key)}
                      style={({pressed}) => [
                        styles.menuRow,
                        pressed ? {backgroundColor: theme.colors.divider} : null,
                      ]}>
                      <MenuIcon name={item.icon} color={menuAccent} />
                      <Text
                        style={[styles.menuRowText, {color: menuAccent, fontSize: rowFontSize}]}
                        numberOfLines={1}
                        allowFontScaling={false}>
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}

              <View style={[styles.menuDivider, {backgroundColor: theme.colors.divider}]} />

              <View style={styles.variantSection}>
                <Text style={[styles.variantTitle, {color: theme.colors.textSecondary}]}>
                  Anaran'ny Tompo
                </Text>

                {/* Sliding-knob toggle, mirroring the dark/light theme switch. */}
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{checked: jesusNameVariant === 'jesoa'}}
                  accessibilityLabel="Anaran'ny Tompo"
                  onPress={() =>
                    setJesusNameVariant(jesusNameVariant === 'jesoa' ? 'jesosy' : 'jesoa')
                  }
                  style={({pressed}) => [pressed ? {opacity: 0.9} : null]}>
                  <View
                    style={[
                      styles.variantTrack,
                      {
                        backgroundColor: theme.colors.backgroundTertiary,
                        borderColor: theme.isDark ? '#FFFFFF20' : '#00000020',
                      },
                    ]}>
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.variantKnob,
                        {
                          backgroundColor: menuCheckAccent,
                          transform: [{translateX: variantKnobTranslate}],
                        },
                      ]}
                    />
                    {(['jesosy', 'jesoa'] as const).map(variant => {
                      const active = jesusNameVariant === variant;
                      return (
                        <View key={variant} style={styles.variantSegment} pointerEvents="none">
                          <Text
                            style={[
                              styles.variantSegmentText,
                              {color: active ? '#FFFFFF' : menuAccent},
                            ]}>
                            {variant === 'jesosy' ? 'Jesosy' : 'Jesoa'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Pressable>
              </View>

              <View style={[styles.menuDivider, {backgroundColor: theme.colors.divider}]} />

              <View style={styles.themeRow}>
                <ToggleThemeButton
                  isDarkMode={isDarkMode}
                  onToggle={onToggleDarkMode}
                />
                <Pressable
                  accessibilityLabel={t('menu.about')}
                  onPress={onAbout}
                  style={({pressed}) => [
                    styles.aboutButton,
                    {borderColor: menuAccent},
                    pressed ? styles.aboutButtonPressed : null,
                  ]}>
                  <Text style={[styles.aboutButtonText, {color: menuAccent}]}>?</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </Animated.View>

        {/* Tutorial spotlight for the 'tap Fotoam-pivavahana' step — lives inside
            the popover's own native tree, same pattern as the selection modals. */}
        <TutorialOverlay scope="modal" />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerCloseHotspot: {
    position: 'absolute',
    top: 0,
    width: 56,
    zIndex: 10,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  menuContainer: {
    position: 'absolute',
    top: 58,
    right: 12,
    alignItems: 'flex-end',
  },
  fontControlsContainer: {
    position: 'absolute',
  },
  fontControlsCard: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#3b72b9',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  fontControlButton: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontControlButtonPressed: {
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  fontControlDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  fontControlText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  fontControlValue: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontControlValueText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  caret: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(255,255,255,0.85)',
  },
  menuCard: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#2c7fb8',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
  },
  themeRow: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aboutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutButtonPressed: {
    opacity: 0.6,
  },
  aboutButtonText: {
    fontSize: 20,
    fontWeight: '700',
  },
  variantSection: {
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  variantTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  variantTrack: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    padding: VARIANT_TRACK_PAD,
    overflow: 'hidden',
  },
  variantKnob: {
    position: 'absolute',
    top: VARIANT_TRACK_PAD,
    left: VARIANT_TRACK_PAD,
    bottom: VARIANT_TRACK_PAD,
    width: VARIANT_KNOB_WIDTH,
    borderRadius: 999,
  },
  variantSegment: {
    width: VARIANT_SEGMENT_WIDTH,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantSegmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    padding: 10,
  },
  quickTile: {
    width: '48.5%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  quickTileText: {
    fontWeight: '600',
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginVertical: 4,
  },
  // 44pt is Apple's minimum touch target; Material lists use 16dp sides.
  menuRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
  },
  menuRowText: {
    flex: 1,
    fontWeight: '500',
  },
});

export default HamburgerMenuPopover;
