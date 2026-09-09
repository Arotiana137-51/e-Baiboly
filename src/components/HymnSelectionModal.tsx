// src/components/HymnSelectionModal.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
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
  currentNumber: number | null;
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

const TAB_ROW_BASE_HEIGHT = 60;

const CATEGORY_MAX: Record<string, number> = {
  ffpm: 827,
  ff: 54,
  antema: 24,
  fifo: 370,
};

const HymnSelectionModal: React.FC<HymnSelectionModalProps> = ({
  visible,
  hymns,
  currentCategory,
  currentNumber,
  onClose,
  onHymnSelect,
}) => {
  const { theme } = useTheme();
  const tutorial = useTutorial();
  const categoryTabsRef = useTutorialTarget('hymnCategoryTabs');
  const keypadRef = useTutorialTarget('hymnKeypad');
  const insets = useAdaptiveInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { verticalScale, fontFor, isSmall } = useResponsive();
  const tabsTopInset = insets.top;
  const tabRowHeight = Math.max(TAB_ROW_BASE_HEIGHT - (isSmall ? 8 : 0), verticalScale(TAB_ROW_BASE_HEIGHT));
  const inputFieldHeight = Math.max(44, verticalScale(56));
  const tabFontSize = fontFor(isSmall ? 15 : 18);
  const inputFontSize = fontFor(isSmall ? 20 : 22);
  const keypadFontSize = fontFor(22);
  const [selectedCategory, setSelectedCategory] = useState<string>(currentCategory || 'ffpm');
  const [inputNumber, setInputNumber] = useState<string>('');

  const maxNumber = CATEGORY_MAX[selectedCategory] ?? 9999;
  const maxDigits = String(maxNumber).length;

  const keypadWidth = useMemo(() => {
    return Math.min(320, Math.floor(windowWidth * 0.75));
  }, [windowWidth]);

  const keypadButtonSize = useMemo(() => {
    const base = Math.min(80, Math.floor(windowWidth * 0.22));
    return Math.max(52, Math.floor(base * 0.8));
  }, [windowWidth]);

  const actionButtonColor = useMemo(
    () => lightenColor(theme.colors.accentBlue, 15),
    [theme.colors.accentBlue],
  );

  const filteredHymns = useMemo(() => {
    return hymns
      .filter(hymn => hymn.category === selectedCategory)
      .sort((a, b) => a.number - b.number);
  }, [hymns, selectedCategory]);

  const currentHymn = useMemo(() => {
    return filteredHymns.find(h => h.number === currentNumber);
  }, [filteredHymns, currentNumber]);

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
          <View key={rowIndex} style={styles.keypadRow}>
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
      onRequestClose={handleClose}
    >
      <Pressable style={[styles.modalBackdrop, { backgroundColor: 'rgba(0, 0, 0, 0.15)' }]} onPress={handleClose}>
        <View style={styles.modalContent} pointerEvents="box-none">
          <View ref={categoryTabsRef} collapsable={false} style={[styles.categoryTabsSafeArea, { paddingTop: tabsTopInset, backgroundColor: theme.colors.navBackground }]}>
            {/*
              4 categories no longer fit comfortably as flex:1 on narrow
              phones (each tab would shrink to ~90px and clip the longer
              labels). Wrap in a horizontal ScrollView and give each tab a
              fixed min-width so ~3 fit per page and the 4th peeks in,
              signaling that the strip scrolls.
            */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{height: tabRowHeight}}
              contentContainerStyle={styles.categoryTabsRow}
            >
              {CATEGORIES.map((category) => (
                <Pressable
                  key={category.key}
                  style={({pressed}) => [
                    styles.categoryTab,
                    {
                      borderRightColor: 'rgba(255,255,255,0.4)',
                      minWidth: Math.max(110, Math.floor(windowWidth / 3.5)),
                      height: tabRowHeight,
                    },
                    selectedCategory === category.key && { backgroundColor: lightenColor(theme.colors.accentBlue, 25) },
                    pressed && { opacity: 0.9 },
                  ]}
                  android_ripple={{
                    color: lightenColor(theme.colors.accentBlue, 40) + '60',
                    borderless: true,
                  }}
                  onPress={() => handleCategoryChange(category.key)}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    style={[
                      styles.categoryTabText,
                      { color: '#FFFFFF', fontSize: tabFontSize },
                    ]}
                  >
                    {category.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View
            style={[
              styles.keypadPanel,
              { top: tabsTopInset + tabRowHeight },
            ]}
            pointerEvents="box-none"
          >
            <Pressable ref={keypadRef} collapsable={false} style={styles.keypadCard} onPress={() => {}}>
              <View style={[styles.inputContainer, { width: keypadWidth }]}>
                <View style={[
                  styles.inputField,
                  {
                    height: inputFieldHeight,
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
  categoryTabsRow: {
    flexDirection: 'row',
    height: TAB_ROW_BASE_HEIGHT,
  },
  categoryTab: {
    // No flex: 1 — sized by minWidth at render time so the horizontal
    // ScrollView can scroll. justifyContent/alignItems still center the
    // label text inside whatever width the tab ends up at.
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
    // borderRightColor and backgroundColor set dynamically
  },
  categoryTabText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  keypadPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: TAB_ROW_BASE_HEIGHT,
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
  keypadSpecialText: {
    fontSize: 20,
  },
});

export default HymnSelectionModal;
