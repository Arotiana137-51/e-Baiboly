// src/components/HymnSelectionModal.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Hymn } from '../hooks/useHymnsData';
import { useTheme } from '../contexts/ThemeContext';
import { useAdaptiveInsets } from '../hooks/useAdaptiveInsets';
import { useResponsive } from '../theme/responsive';
import { useTutorial, useTutorialTarget } from '../contexts/TutorialContext';
import TutorialOverlay from './TutorialOverlay';

interface HymnSelectionModalProps {
  visible: boolean;
  hymns: Hymn[];
  currentCategory: string | null;
  onClose: () => void;
  onHymnSelect: (hymnId: string, category: string, number: number) => void;
}

// Order is the order shown in the horizontally-scrollable tab strip.
// Fihirana stays first (most-used). F. Fifohazana joined as the second
// category; F. Fanampiny and Antema follow.
const CATEGORIES = [
  { key: 'ffpm', label: 'Fihirana' },
  { key: 'fifo', label: 'F. Fifohazana' },
  { key: 'ff', label: 'F. Fanampiny' },
  { key: 'antema', label: 'Antema' },
];

// Lighten a hex color by mixing it with white
const lightenColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  const newR = R < 255 ? (R < 1 ? 0 : R) : 255;
  const newG = G < 255 ? (G < 1 ? 0 : G) : 255;
  const newB = B < 255 ? (B < 1 ? 0 : B) : 255;
  return `#${(0x1000000 + newR * 0x10000 + newG * 0x100 + newB).toString(16).slice(1)}`;
};

const CHIP_HEIGHT = 44;
const CHIP_GAP = 8;
const CATEGORY_BAR_PADDING = 10;
// Extra room under the status bar on every phone, so the pills never crowd
// the Dynamic Island / notch / camera hole.
const CATEGORY_BAR_TOP_GAP = 10;
// Fixed line height (and no font scaling) on the range line so the bar's
// height stays predictable for the keypad offset below it.
const RANGE_LINE_HEIGHT = 18;
const RANGE_GAP = 6;
// On tablets the single row of pills stops growing past this width.
const CATEGORY_CHIPS_MAX_WIDTH = 840;

const categoryBarHeight = (rows: number) =>
  CATEGORY_BAR_TOP_GAP +
  CATEGORY_BAR_PADDING +
  CHIP_HEIGHT * rows +
  CHIP_GAP * (rows - 1) +
  RANGE_GAP +
  RANGE_LINE_HEIGHT +
  CATEGORY_BAR_PADDING;

const HymnSelectionModal: React.FC<HymnSelectionModalProps> = ({
  visible,
  hymns,
  currentCategory,
  onClose,
  onHymnSelect,
}) => {
  const { theme } = useTheme();
  const tutorial = useTutorial();
  const categoryTabsRef = useTutorialTarget('hymnCategoryTabs');
  const keypadRef = useTutorialTarget('hymnKeypad');
  const insets = useAdaptiveInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { verticalScale, fontFor, isSmall, isTablet, height: windowHeight } = useResponsive();
  const tabsTopInset = insets.top;
  // 600+ wide (tablets, and phones in landscape): the four pills fit one row.
  const singleRowChips = isTablet;
  const barHeight = categoryBarHeight(singleRowChips ? 1 : 2);
  // Landscape phones are short: tighten the keypad's gaps so it fits under
  // the bar instead of spilling over it.
  const isShort = windowHeight < 500;
  const keypadRowGap = isShort ? 6 : 12;
  const inputMarginTop = isShort ? 6 : 24;
  const inputMarginBottom = isShort ? 6 : 12;
  const inputFieldHeight = Math.max(44, verticalScale(56));
  const tabFontSize = fontFor(isSmall ? 15 : 17);
  const inputFontSize = fontFor(isSmall ? 20 : 22);
  const keypadFontSize = fontFor(22);
  const [selectedCategory, setSelectedCategory] = useState<string>(currentCategory || 'ffpm');
  const [inputNumber, setInputNumber] = useState<string>('');

  const filteredHymns = useMemo(() => {
    return hymns
      .filter(hymn => hymn.category === selectedCategory)
      .sort((a, b) => a.number - b.number);
  }, [hymns, selectedCategory]);

  // The book's last number comes from the data, so the range and the keypad
  // limit follow new hymns (a hardcoded 54 hid the Fanampiny psalm songs).
  const maxNumber = filteredHymns.length ? filteredHymns[filteredHymns.length - 1].number : 9999;
  const maxDigits = String(maxNumber).length;

  const keypadWidth = useMemo(() => {
    return Math.min(320, Math.floor(windowWidth * 0.75));
  }, [windowWidth]);

  // Width picks the comfortable size; height caps it so the input row plus the
  // four keypad rows (five rows of this size) always fit under the bar. Only
  // landscape phones ever hit the cap.
  const keypadButtonSize = useMemo(() => {
    const base = Math.min(80, Math.floor(windowWidth * 0.22));
    const byWidth = Math.max(52, Math.floor(base * 0.8));
    const available = windowHeight - tabsTopInset - barHeight - insets.bottom - 16;
    const byHeight = Math.floor(
      (available - inputMarginTop - inputMarginBottom - 4 * keypadRowGap) / 5,
    );
    return Math.max(36, Math.min(byWidth, byHeight));
  }, [
    windowWidth,
    windowHeight,
    tabsTopInset,
    barHeight,
    insets.bottom,
    inputMarginTop,
    inputMarginBottom,
    keypadRowGap,
  ]);

  const actionButtonColor = useMemo(
    () => lightenColor(theme.colors.accentBlue, 15),
    [theme.colors.accentBlue],
  );

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
    setInputNumber('');
    tutorial.notifyProgress('category');
  }, [tutorial]);

  const handleNumberInput = useCallback((num: string) => {
    setInputNumber(prev => {
      if (prev.length >= maxDigits) {
        return prev;
      }

      const next = prev + num;
      const nextValue = parseInt(next, 10);
      if (!Number.isNaN(nextValue) && nextValue > maxNumber) {
        return prev;
      }

      return next;
    });
  }, [maxDigits, maxNumber]);

  const handleBackspace = useCallback(() => {
    setInputNumber(prev => prev.slice(0, -1));
  }, []);

  const handleOk = useCallback(() => {
    const number = parseInt(inputNumber, 10);
    if (Number.isNaN(number) || number <= 0) {
      return;
    }

    if (number > maxNumber) {
      Alert.alert('Tsy hita', "Tsy misy an'io hira io anaty fihirana");
      return;
    }

    const hymn = filteredHymns.find(h => h.number === number);
    if (!hymn) {
      Alert.alert('Tsy hita', "Tsy misy an'io hira io anaty fihirana");
      return;
    }

    onHymnSelect(hymn.id, hymn.category || '', hymn.number);
    onClose();
  }, [inputNumber, filteredHymns, maxNumber, onHymnSelect, onClose]);

  const handleClose = useCallback(() => {
    setInputNumber('');
    onClose();
  }, [onClose]);

  React.useEffect(() => {
    if (!visible) {
      setInputNumber('');
    }
  }, [visible]);

  const renderKeypad = () => {
    const buttons = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['0', 'OK'],
    ];

    return (
      <View style={[styles.keypadContainer, { width: keypadWidth }]}>
        {buttons.map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.keypadRow, { marginBottom: keypadRowGap }]}>
            {row.map((button) => (
              <Pressable
                key={button}
                style={({pressed}) => [
                  styles.keypadButton,
                  { 
                    height: keypadButtonSize, 
                    borderRadius: Math.max(8, Math.floor(keypadButtonSize * 0.12)),
                    backgroundColor: theme.colors.navBackground,
                  },
                  button === 'OK' && { backgroundColor: actionButtonColor },
                  button === 'OK' && styles.doubleWidthButton,
                  pressed && { opacity: 0.8 },
                ]}
                android_ripple={{
                  color: theme.colors.accentBlue + '40',
                  borderless: true,
                }}
                onPress={() => {
                  if (button === 'OK') handleOk();
                  else handleNumberInput(button);
                }}
              >
                <Text
                  style={[
                    styles.keypadText,
                    { color: '#FFFFFF', fontSize: button === 'OK' ? Math.round(keypadFontSize * 0.85) : keypadFontSize },
                  ]}
                >
                  {button}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // iOS modals default to portrait only, which swung a landscape iPhone
      // back upright whenever the picker opened.
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={handleClose}
    >
      <Pressable style={[styles.modalBackdrop, { backgroundColor: 'rgba(0, 0, 0, 0.15)' }]} onPress={handleClose}>
        <View style={styles.modalContent} pointerEvents="box-none">
          <View
            ref={categoryTabsRef}
            collapsable={false}
            style={[
              styles.categoryTabsSafeArea,
              {
                paddingTop: tabsTopInset,
                // Landscape iPhones put the Dynamic Island / notch on a side.
                paddingLeft: insets.left,
                paddingRight: insets.right,
                backgroundColor: theme.colors.navBackground,
              },
            ]}
          >
            {/*
              4 categories don't fit one row on narrow phones without
              clipping the longer labels, so there they sit in a 2x2 grid of
              pills; tablets and landscape phones get one row. Every category
              visible and one tap away, no scrolling. The selected one takes
              the reader's page colour, like a segmented control.
            */}
            <View style={styles.categoryChips}>
              {CATEGORIES.map((category) => {
                const selected = selectedCategory === category.key;
                return (
                  <Pressable
                    key={category.key}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={({pressed}) => [
                      styles.categoryChip,
                      singleRowChips && styles.categoryChipSingleRow,
                      selected
                        ? [
                            styles.categoryChipSelected,
                            {
                              backgroundColor: theme.colors.readerBackground,
                              borderColor: theme.colors.readerBackground,
                            },
                          ]
                        : styles.categoryChipIdle,
                      pressed && !selected && styles.categoryChipPressed,
                    ]}
                    onPress={() => handleCategoryChange(category.key)}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={[
                        styles.categoryChipText,
                        selected ? { color: theme.colors.readerText } : styles.categoryChipTextIdle,
                        { fontSize: tabFontSize },
                      ]}
                    >
                      {category.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {/* The selected book's valid numbers, so it's clear why a
                bigger number can't be typed. */}
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={styles.categoryRange}
            >
              {`Hira 1 – ${maxNumber}`}
            </Text>
          </View>

          <View
            style={[
              styles.keypadPanel,
              { top: tabsTopInset + barHeight },
            ]}
            pointerEvents="box-none"
          >
            <Pressable ref={keypadRef} collapsable={false} style={styles.keypadCard} onPress={() => {}}>
              <View
                style={[
                  styles.inputContainer,
                  { width: keypadWidth, marginTop: inputMarginTop, marginBottom: inputMarginBottom },
                ]}
              >
                <View style={[
                  styles.inputField,
                  {
                    // Never taller than the keypad keys, which shrink in landscape.
                    height: Math.min(inputFieldHeight, keypadButtonSize),
                    marginRight: Math.max(8, Math.floor(keypadButtonSize * 0.12)),
                    backgroundColor: theme.colors.backgroundPrimary,
                    borderColor: theme.colors.divider,
                  }
                ]}>
                  <Text style={[styles.inputText, { color: theme.colors.textPrimary, fontSize: inputFontSize }]}>
                    {inputNumber}
                  </Text>
                </View>
                <Pressable
                  style={({pressed}) => [
                    styles.backspaceButton,
                    {
                      width: Math.round(keypadButtonSize * 1.3),
                      height: keypadButtonSize,
                      backgroundColor: actionButtonColor,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                  android_ripple={{
                    color: theme.colors.accentBlue + '40',
                    borderless: true,
                  }}
                  onPress={handleBackspace}
                >
                  <Text style={[styles.backspaceIcon, { color: '#FFFFFF' }]}>⌫</Text>
                </Pressable>
              </View>

              {renderKeypad()}
            </Pressable>
          </View>
        </View>
      </Pressable>
      <TutorialOverlay scope="modal" />
    </Modal>
  );
 };

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  modalContent: {
    flex: 1,
  },
  categoryTabsSafeArea: {
    // backgroundColor set dynamically via theme
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CHIP_GAP,
    width: '100%',
    maxWidth: CATEGORY_CHIPS_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingTop: CATEGORY_BAR_TOP_GAP + CATEGORY_BAR_PADDING,
    paddingBottom: RANGE_GAP,
  },
  categoryChip: {
    flexGrow: 1,
    flexBasis: '40%',
    height: CHIP_HEIGHT,
    borderRadius: CHIP_HEIGHT / 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  categoryChipSingleRow: {flexBasis: '20%'},
  // Translucent white reads on any personalised bar colour.
  categoryChipIdle: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  categoryChipPressed: {backgroundColor: 'rgba(255,255,255,0.25)'},
  // Background and border come from the reader's page colour at render time.
  categoryChipSelected: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  categoryChipText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  categoryChipTextIdle: {color: '#FFFFFF'},
  categoryRange: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: RANGE_LINE_HEIGHT,
    height: RANGE_LINE_HEIGHT,
    textAlign: 'center',
    marginBottom: CATEGORY_BAR_PADDING,
  },
  keypadPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // top set at render time, under the category bar
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadCard: {
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
  },
  inputField: {
    flexGrow: 0,
    flexShrink: 1,
    width: '55%',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  inputText: {
    fontSize: 22,
    fontWeight: '700',
  },
  backspaceButton: {
    width: 100,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  backspaceIcon: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 28,
  },
  keypadContainer: {
    alignItems: 'center',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  keypadButton: {
    flex: 1,
    height: 80,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  doubleWidthButton: {
    flex: 2,
  },
  keypadText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default HymnSelectionModal;
