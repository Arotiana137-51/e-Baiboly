import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, Text, View, StyleSheet, Modal, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BibleVerse } from '../hooks/useBibleData';
import { useTheme } from '../contexts/ThemeContext';
import { useTutorialTarget } from '../contexts/TutorialContext';
import TutorialOverlay from './TutorialOverlay';
import { MenuIcon } from './MenuIcons';
import { ShareIcon } from './ShareIcon';
import { readableAccent } from '../utils/colorUtils';
import {t} from '../i18n/strings';

interface VerseActionPopoverProps {
  visible: boolean;
  verse: BibleVerse | null;
  verseBookName?: string;
  // The verse already starts a note: the item opens it instead of a new one.
  hasNote?: boolean;
  onClose: () => void;
  // The sheet's height once laid out, so the reader can keep the verse above it.
  onSheetLayout?: (height: number) => void;
  onNote: (verse: BibleVerse) => void;
  onViewCorrespondence: (verse: BibleVerse) => void;
  onAddToFavorites: (verse: BibleVerse) => void;
  onShare: (verse: BibleVerse) => void;
  onReportIssue: (verse: BibleVerse) => void;
}

// The sheet floats this far from the screen's sides and from the bottom
// (above the system bar).
const SHEET_INSET = 12;
// At most this share of the screen's height, so the reader keeps room above
// for the verse (a phone on its side, big text): the rows scroll instead.
const SHEET_MAX_SHARE = 0.6;
// A drag down this far (pt), or a flick this fast (pt/ms), closes the sheet;
// anything less and it springs back.
const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 0.8;

// The double-tapped verse's actions, in a sheet along the bottom. The verse
// itself stays highlighted in the reader above, so the sheet only names it.
const VerseActionPopover: React.FC<VerseActionPopoverProps> = ({
  visible,
  verse,
  verseBookName,
  hasNote,
  onClose,
  onSheetLayout,
  onNote,
  onViewCorrespondence,
  onAddToFavorites,
  onShare,
  onReportIssue,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const bottomGap = insets.bottom + SHEET_INSET;
  const noteItemRef = useTutorialTarget('noteActionItem');

  // Rows that don't fit scroll, and a drag on them then scrolls; the handle
  // and the reference still drag the sheet down.
  const [rowsScroll, setRowsScroll] = useState(false);
  const rowsScrollRef = useRef(false);
  rowsScrollRef.current = rowsScroll;
  const rowsHeight = useRef({ view: 0, content: 0 });
  const measureRows = () => setRowsScroll(rowsHeight.current.content > rowsHeight.current.view + 1);

  // Dragging the sheet down closes it, as the handle on top suggests.
  const dragY = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const drag = useMemo(() => {
    const springBack = () => Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
    return PanResponder.create({
      // Taps on the sheet's own padding stop here instead of closing it.
      onStartShouldSetPanResponder: () => true,
      // Taken from a row only once the finger clearly moves down.
      onMoveShouldSetPanResponderCapture: (_e, g) => !rowsScrollRef.current && g.dy > 6 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => dragY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy < DISMISS_DISTANCE && g.vy < DISMISS_VELOCITY) {
          springBack();
          return;
        }
        Animated.timing(dragY, { toValue: sheetHeight.current, duration: 150, useNativeDriver: true }).start(() =>
          onCloseRef.current(),
        );
      },
      onPanResponderTerminate: springBack,
    });
  }, [dragY]);

  // A sheet closed mid-drag or mid-spring keeps its offset (its animation
  // stops with it): each one opens in place.
  useLayoutEffect(() => {
    if (visible) dragY.setValue(0);
  }, [visible, dragY]);

  const { textPrimary, textSecondary, divider, backgroundSecondary } = theme.colors;
  const accent = readableAccent(theme.colors.accentBlue, backgroundSecondary);
  const themed = useMemo(
    () =>
      StyleSheet.create({
        backdrop: { paddingBottom: bottomGap },
        sheet: {
          backgroundColor: backgroundSecondary,
          maxHeight: windowHeight * SHEET_MAX_SHARE,
          transform: [{ translateY: dragY }],
        },
        fill: { backgroundColor: divider },
        line: { borderBottomColor: divider },
        accentFill: { backgroundColor: accent },
        accent: { color: accent },
        text: { color: textPrimary },
        quiet: { color: textSecondary },
      }),
    [bottomGap, backgroundSecondary, windowHeight, dragY, divider, accent, textPrimary, textSecondary],
  );

  if (!verse) return null;

  const handleNote = () => {
    onClose();
    onNote(verse);
  };

  const handleViewCorrespondence = () => {
    onViewCorrespondence(verse);
    onClose();
  };

  const handleAddToFavorites = () => {
    onAddToFavorites(verse);
    onClose();
  };

  const handleShare = () => {
    onShare(verse);
    onClose();
  };

  const handleReportIssue = () => {
    onReportIssue(verse);
    onClose();
  };

  // Icons in the theme colour, like the hamburger menu's.
  const actions = [
    { key: 'note', label: hasNote ? t('actions.noteOpen') : t('actions.noteAdd'), icon: <MenuIcon name="notes" color={accent} />, onPress: handleNote },
    { key: 'concordance', label: t('actions.viewConcordance'), icon: <MenuIcon name="arrows" color={accent} />, onPress: handleViewCorrespondence },
    { key: 'favorite', label: t('actions.addToFavorites'), icon: <MenuIcon name="heart" color={accent} />, onPress: handleAddToFavorites },
    { key: 'share', label: t('actions.share'), icon: <ShareIcon color={accent} />, onPress: handleShare },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={[styles.backdrop, themed.backdrop]} onPress={onClose}>
        <Animated.View
          style={[styles.sheet, themed.sheet]}
          {...drag.panHandlers}
          // The gap under the sheet hides the reader too.
          onLayout={e => {
            sheetHeight.current = e.nativeEvent.layout.height + bottomGap;
            onSheetLayout?.(sheetHeight.current);
          }}
        >
          <View style={[styles.handle, themed.fill]} />
          <View style={[styles.reference, themed.line]}>
            <View style={[styles.referenceRule, themed.accentFill]} />
            <Text style={[styles.referenceText, themed.accent]}>
              {verseBookName || ''} {verse.chapter}:{verse.verse_number}
            </Text>
          </View>

          <ScrollView
            style={styles.menuItems}
            scrollEnabled={rowsScroll}
            onLayout={e => {
              rowsHeight.current.view = e.nativeEvent.layout.height;
              measureRows();
            }}
            onContentSizeChange={(_width, height) => {
              rowsHeight.current.content = height;
              measureRows();
            }}
          >
            {actions.map((action, index) => (
              <Pressable
                key={action.key}
                ref={action.key === 'note' ? noteItemRef : undefined}
                collapsable={false}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.menuItem,
                  index < actions.length - 1 && [styles.menuItemLine, themed.line],
                  pressed && styles.pressed,
                ]}
                onPress={action.onPress}
              >
                <View style={styles.icon}>{action.icon}</View>
                <Text style={[styles.menuItemText, themed.text]}>{action.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={[styles.footerLine, themed.fill]} />
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.report, pressed && styles.pressed]}
            onPress={handleReportIssue}
          >
            <Text style={[styles.reportText, themed.quiet]}>{t('actions.reportQuestion')}</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
      {/* Notes tutorial spotlights the Naoty item from inside this modal. */}
      <TutorialOverlay scope="modal" />
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Lightly dimmed: the highlighted verse above the sheet stays readable.
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    justifyContent: 'flex-end',
    paddingHorizontal: SHEET_INSET,
  },
  sheet: {
    borderRadius: 24,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  reference: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 4,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  referenceRule: {
    width: 24,
    height: 1.5,
  },
  referenceText: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Only as tall as its rows, and the part of the sheet that gives way under
  // its maxHeight.
  menuItems: {
    flexGrow: 0,
    flexShrink: 1,
    marginTop: 4,
    marginHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 52,
  },
  menuItemLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // ShareIcon is drawn in 22pt, the others in 24: same column for the labels.
  icon: {
    width: 24,
    alignItems: 'center',
  },
  menuItemText: {
    flexShrink: 1,
    fontSize: 16,
  },
  footerLine: {
    height: StyleSheet.hairlineWidth,
    marginTop: 4,
    marginBottom: 2,
  },
  report: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportText: {
    fontSize: 15,
  },
  pressed: {
    opacity: 0.6,
  },
});

export default VerseActionPopover;
