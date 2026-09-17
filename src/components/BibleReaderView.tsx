import React, {useCallback, useMemo, useRef} from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform, ListRenderItemInfo } from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import { BibleVerse } from '../hooks/useBibleData';
import { useTheme, useLowEndMode } from '../contexts/ThemeContext';
import { TEXT_STYLES, scaleFontSize } from '../constants/Typography';
import {
  extractBracketFootnotes,
  flattenBibleTextForReader,
  renderBibleLineForReader,
  processBibleTextWithMetadataForReader,
} from '../utils/bibleTextUtils';
import type {InlineBibleRef} from '../utils/bibleRefs';
import {
  buildChapterDisplay,
  buildLineSegments,
  buildVerseLineOffsets,
  intersectMarksWithSpan,
  type ChapterMark,
  type MarkStyle,
  type VerseSpan,
} from '../utils/chapterMarks';
import {useJesusName} from '../contexts/JesusNameContext';
import {dimHighlightForDarkMode, dimHighlightForLightMode} from '../utils/colorUtils';

const BIBLE_VERSE_LINE_HEIGHT_MULTIPLIER = 1.3;
const BIBLE_VERSE_BLOCK_MARGIN = 7;
const BIBLE_BASE_BOTTOM_PADDING = 28;
const DOUBLE_TAP_DELAY_MS = 280;

const PSALMS_BOOK_ID = 19;
const PROVERBS_BOOK_ID = 20;

const FLOATING_BOTTOM_NAV_SPACER = {
  offsetFromBottom: 15,
  containerPaddingTop: 8,
  segmentHeight: 42,
  trackPaddingVertical: 4 * 2,
  extraMargin: 16,
} as const;

const EMPTY_MARKS: ChapterMark[] = [];

export type SelectedVerseRange = {start: number; end: number} | null;

const styleToTextStyle = (
  marks: ChapterMark[],
): {fontWeight?: 'bold'; fontStyle?: 'italic'; textDecorationLine?: 'underline'} => {
  const out: any = {};
  for (const m of marks) {
    if (m.style === 'bold') out.fontWeight = 'bold';
    if (m.style === 'italic') out.fontStyle = 'italic';
    if (m.style === 'underline') out.textDecorationLine = 'underline';
  }
  return out;
};

const VerseItem = React.memo(
  ({
    item,
    theme,
    fontScale,
    transformText,
    selectedVerseNumber,
    selectedVerseRange,
    verseMarks,
    isScrollingRef,
    onVerseDoubleTap,
    onVerseLongPress,
    onInlineRefPress,
    onNotePress,
  }: {
    item: BibleVerse;
    theme: any;
    fontScale: number;
    jesusNameVariant: string;
    transformText: (text: string) => string;
    selectedVerseNumber?: number | null;
    selectedVerseRange?: SelectedVerseRange;
    verseMarks: ChapterMark[];
    isScrollingRef: React.MutableRefObject<boolean>;
    onVerseDoubleTap?: (verse: BibleVerse) => void;
    onVerseLongPress?: (verse: BibleVerse) => void;
    onInlineRefPress?: (ref: InlineBibleRef) => void;
    onNotePress?: (verse: BibleVerse) => void;
  }) => {
    const isPsalmsOrProverbs = item.book_id === PSALMS_BOOK_ID || item.book_id === PROVERBS_BOOK_ID;
    const hasTitle = typeof item.title === 'string' && item.title.trim().length > 0;

    const baseText = transformText(item.text);
    const readerText = !isPsalmsOrProverbs && !hasTitle ? flattenBibleTextForReader(baseText) : baseText;
    const { textWithoutFootnotes, footnotes } = extractBracketFootnotes(readerText);
    const { lines, italicLines } = processBibleTextWithMetadataForReader(textWithoutFootnotes);

    const lineOffsets = useMemo(() => buildVerseLineOffsets(lines), [lines]);
    const hasMarks = verseMarks.length > 0;
    const hasNote = verseMarks.some(m => m.style === 'note');

    // A range selection already filters the reader down to just those verses,
    // so the filtered view itself is the emphasis — no per-verse highlight.
    // Single-verse selection still gets the highlight + scroll.
    const isSelected =
      typeof selectedVerseNumber === 'number' &&
      item.verse_number === selectedVerseNumber;

    const verseFontSize = scaleFontSize(TEXT_STYLES.body.fontSize, fontScale);
    const verseLineHeight = Math.round(verseFontSize * BIBLE_VERSE_LINE_HEIGHT_MULTIPLIER) + 3;

    const lastTapRef = useRef(0);

    const handleInlineRefPress = useCallback(
      (ref: InlineBibleRef) => {
        // Avoid treating a ref tap as the first half of a verse double-tap.
        lastTapRef.current = 0;
        onInlineRefPress?.(ref);
      },
      [onInlineRefPress],
    );

    const handlePress = () => {
      if (isScrollingRef.current) return;
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY_MS) {
        lastTapRef.current = 0;
        onVerseDoubleTap?.(item);
        return;
      }
      lastTapRef.current = now;
    };

    const handleLongPress = () => {
      if (isScrollingRef.current) return;
      onVerseLongPress?.(item);
    };

    return (
      <Pressable
        style={[styles.bibleVerseBlock, isSelected && styles.selectedVerseBlock]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={400}
        disabled={!onVerseDoubleTap && !onVerseLongPress}
      >
        <Text
          maxFontSizeMultiplier={1.3}
          style={[
            TEXT_STYLES.body,
            {
              fontSize: verseFontSize,
              lineHeight: verseLineHeight,
              // iOS breaks lines greedily with no hyphenation, so justify
              // stretches long Malagasy words into wide gaps. Android balances
              // line breaks and justifies cleanly.
              textAlign: Platform.OS === 'ios' ? 'left' : 'justify',
              color: theme.colors.readerText,
              ...(Platform.OS === 'android' ? { includeFontPadding: true } : null),
            },
          ]}
        >
          {hasTitle ? (
            <Text
              style={{
                fontStyle: 'italic',
                fontWeight: '200',
                letterSpacing: 1.2,
                fontSize: Math.round(verseFontSize * 1.03),
                color:
                  theme.colors.textSecondary ??
                  theme.colors.textWatermark ??
                  theme.colors.readerText,
                opacity: 0.62,
                lineHeight: verseLineHeight,
                transform: [{ skewX: '-8deg' }],
              }}
            >
              {transformText(item.title!.trim())}
              {'\n'}
            </Text>
          ) : null}

          <Text
            style={[
              TEXT_STYLES.verseNumber,
              {
                fontSize: scaleFontSize(TEXT_STYLES.verseNumber.fontSize, fontScale),
                lineHeight: verseLineHeight,
                color: theme.colors.verseNumber,
                transform: [
                  {
                    translateY: (styles.verseNumber.transform?.[0] as any)?.translateY * fontScale,
                  },
                ],
              },
            ]}
          >
            {item.verse_number}
            {hasNote ? (
              <Text
                onPress={(e) => {
                  e.stopPropagation?.();
                  onNotePress?.(item);
                }}
                suppressHighlighting
                style={{
                  fontSize: scaleFontSize(TEXT_STYLES.verseNumber.fontSize * 0.85, fontScale),
                  color: theme.colors.verseNumber,
                }}>
                {' ✎'}
              </Text>
            ) : null}
            {' '}
          </Text>

          {lines.map((line, idx) => {
            const isBlockItalic = italicLines.has(idx);
            const lineStyle = isBlockItalic
              ? {
                  color: theme.colors.textWatermark,
                  fontStyle: 'italic' as const,
                  lineHeight: verseLineHeight,
                }
              : { lineHeight: verseLineHeight };

            if (hasMarks) {
              const segments = buildLineSegments(line, lineOffsets[idx], verseMarks);
              return (
                <Text key={`bible-line-${item.id}-${idx}`} style={lineStyle}>
                  {idx === 0 ? '' : '\n'}
                  {segments.map((seg, segIdx) => {
                    const markStyles = styleToTextStyle(
                      seg.marks.map(s => ({
                        id: '',
                        start: 0,
                        end: 0,
                        style: s,
                        createdAt: '',
                      })),
                    );
                    const hasHighlight = seg.marks.includes('highlight' as MarkStyle);
                    return (
                      <Text
                        key={`seg-${segIdx}`}
                        style={[
                          seg.italic ? {fontStyle: 'italic'} : null,
                          markStyles,
                          hasHighlight && seg.highlightColor
                            ? {
                                backgroundColor: theme.isDark
                                  ? dimHighlightForDarkMode(seg.highlightColor)
                                  : dimHighlightForLightMode(seg.highlightColor),
                              }
                            : null,
                        ]}
                      >
                        {seg.text}
                      </Text>
                    );
                  })}
                </Text>
              );
            }

            return (
              <Text key={`bible-line-${item.id}-${idx}`} style={lineStyle}>
                {idx === 0 ? '' : '\n'}
                {renderBibleLineForReader(line, {
                  baseTextStyle: { lineHeight: verseLineHeight },
                  footnoteTextStyle: {
                    opacity: 0.72,
                    fontSize: Math.max(10, Math.round(verseFontSize * 0.92)),
                    fontStyle: 'italic',
                  },
                  refTextStyle: onInlineRefPress
                    ? {
                        fontStyle: 'italic',
                        color: theme.colors.accentBlue ?? theme.colors.verseNumber,
                      }
                    : undefined,
                  onRefPress: handleInlineRefPress,
                })}
              </Text>
            );
          })}

          {footnotes.map((footnote, idx) => (
            <Text
              key={`bible-footnote-${item.id}-${idx}`}
              style={{
                color: theme.colors.textWatermark,
                fontStyle: 'italic',
                lineHeight: verseLineHeight,
              }}
            >
              {'\n'}
              {footnote}
            </Text>
          ))}
        </Text>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item.text === next.item.text &&
    prev.item.verse_number === next.item.verse_number &&
    prev.fontScale === next.fontScale &&
    prev.jesusNameVariant === next.jesusNameVariant &&
    prev.selectedVerseNumber === next.selectedVerseNumber &&
    prev.selectedVerseRange?.start === next.selectedVerseRange?.start &&
    prev.selectedVerseRange?.end === next.selectedVerseRange?.end &&
    prev.onInlineRefPress === next.onInlineRefPress &&
    prev.onNotePress === next.onNotePress &&
    prev.verseMarks === next.verseMarks &&
    prev.theme.colors.textPrimary === next.theme.colors.textPrimary &&
    prev.theme.colors.verseNumber === next.theme.colors.verseNumber &&
    prev.theme.colors.textWatermark === next.theme.colors.textWatermark
);

interface BibleReaderViewProps {
  verses: BibleVerse[];
  isLoading: boolean;
  fontScale?: number;
  onVerseDoubleTap?: (verse: BibleVerse) => void;
  onVerseLongPress?: (verse: BibleVerse) => void;
  selectedVerseNumber?: number | null;
  selectedVerseRange?: SelectedVerseRange;
  onInlineRefPress?: (ref: InlineBibleRef) => void;
  onNotePress?: (verse: BibleVerse) => void;
  flatListRef?: React.RefObject<FlatList<any> | null>;
  headerText?: string | null;
  chapterMarks?: ChapterMark[];
  onClearRange?: () => void;
  currentBookName?: string | null;
}

const BibleReaderView: React.FC<BibleReaderViewProps> = ({
  verses,
  isLoading,
  fontScale = 1,
  onVerseDoubleTap,
  onVerseLongPress,
  selectedVerseNumber,
  selectedVerseRange,
  onInlineRefPress,
  onNotePress,
  flatListRef,
  headerText,
  chapterMarks,
  onClearRange,
  currentBookName,
}) => {
  const { theme } = useTheme();
  const { isLowEndMode } = useLowEndMode();
  const {variant: jesusNameVariant, transformText} = useJesusName();
  const insets = useSafeAreaInsets();
  const isScrollingRef = useRef(false);

  const visibleVerses = useMemo(() => {
    if (!selectedVerseRange) return verses;
    return verses.filter(
      v =>
        v.verse_number >= selectedVerseRange.start &&
        v.verse_number <= selectedVerseRange.end,
    );
  }, [verses, selectedVerseRange]);

  const rangeSuffix = useMemo(() => {
    if (!selectedVerseRange || verses.length === 0) return null;
    return selectedVerseRange.start === selectedVerseRange.end
      ? `:${selectedVerseRange.start}`
      : `:${selectedVerseRange.start}–${selectedVerseRange.end}`;
  }, [selectedVerseRange, verses.length]);

  const verseSpans: VerseSpan[] = useMemo(() => {
    if (!verses.length) return [];
    return buildChapterDisplay(verses, transformText).verseSpans;
  }, [verses, transformText]);

  const marksByVerseId = useMemo(() => {
    const map: Record<number, ChapterMark[]> = {};
    if (!chapterMarks?.length || !verseSpans.length) return map;
    for (const span of verseSpans) {
      const local = intersectMarksWithSpan(chapterMarks, span);
      if (local.length) {
        map[span.verseId] = local;
      }
    }
    return map;
  }, [chapterMarks, verseSpans]);

  // Low-end mode: fewer items rendered, lighter batching
  const listProps = isLowEndMode
    ? {
        initialNumToRender: 10,
        maxToRenderPerBatch: 6,
        updateCellsBatchingPeriod: 60,
        windowSize: 6,
        removeClippedSubviews: false,
      }
    : {
        initialNumToRender: 18,
        maxToRenderPerBatch: 12,
        updateCellsBatchingPeriod: 40,
        windowSize: 10,
        // Off on Android: removeClippedSubviews races on Fabric (new arch) and
        // crashes as ReactClippingViewManager.addView IndexOutOfBoundsException /
        // SurfaceMountingManager RetryableMountingLayerException. Fabric recycles
        // views anyway, so the perf gain here is negligible.
        removeClippedSubviews: false,
      };

  const bottomScrollSpacer =
    Math.max(insets.bottom, 0) +
    FLOATING_BOTTOM_NAV_SPACER.offsetFromBottom +
    FLOATING_BOTTOM_NAV_SPACER.containerPaddingTop +
    FLOATING_BOTTOM_NAV_SPACER.segmentHeight +
    FLOATING_BOTTOM_NAV_SPACER.trackPaddingVertical +
    FLOATING_BOTTOM_NAV_SPACER.extraMargin;

  const bottomScrollSpacerAdjusted = Math.round(bottomScrollSpacer * 0.5) + 7;

  const keyExtractor = useCallback((item: BibleVerse) => item.id.toString(), []);

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<BibleVerse>) => {
      const verseMarks = marksByVerseId[item.id] ?? EMPTY_MARKS;
      return (
        <VerseItem
          item={item}
          theme={theme}
          fontScale={fontScale}
          jesusNameVariant={jesusNameVariant}
          transformText={transformText}
          selectedVerseNumber={selectedVerseNumber}
          selectedVerseRange={selectedVerseRange}
          verseMarks={verseMarks}
          isScrollingRef={isScrollingRef}
          onVerseDoubleTap={onVerseDoubleTap}
          onVerseLongPress={onVerseLongPress}
          onInlineRefPress={onInlineRefPress}
          onNotePress={onNotePress}
        />
      );
    },
    [
      theme,
      fontScale,
      jesusNameVariant,
      transformText,
      selectedVerseNumber,
      selectedVerseRange,
      marksByVerseId,
      onVerseDoubleTap,
      onVerseLongPress,
      onInlineRefPress,
      onNotePress,
    ],
  );

  const onScrollToIndexFailed = useCallback(
    (info: {index: number}) => {
      setTimeout(() => {
        // The list may have shrunk (range filter / chapter change) between the
        // failed scroll and this retry — clamp to the current length so the
        // retry can't throw "scrollToIndex out of range". Skip if now empty.
        const last = visibleVerses.length - 1;
        if (last < 0) return;
        flatListRef?.current?.scrollToIndex({
          index: Math.min(info.index, last),
          animated: true,
          viewPosition: 0.2,
        });
      }, 220);
    },
    [flatListRef, visibleVerses.length],
  );

  const onScrollBeginDrag = useCallback(() => {
    isScrollingRef.current = true;
  }, []);
  const onMomentumScrollEnd = useCallback(() => {
    isScrollingRef.current = false;
  }, []);
  const onScrollEndDrag = useCallback(() => {
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 80);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={visibleVerses}
      keyExtractor={keyExtractor}
      contentContainerStyle={[
        styles.contentContainer,
        {paddingBottom: BIBLE_BASE_BOTTOM_PADDING + bottomScrollSpacerAdjusted},
      ]}
      ListHeaderComponent={
        <View>
          {headerText ? (
            <View style={styles.headerContainer}>
              <Text style={[styles.headerText, {color: theme.colors.textPrimary}]}>
                {headerText}
                {rangeSuffix ? (
                  <Text style={{color: theme.colors.accentBlue}}>
                    {' '}
                    {rangeSuffix}
                  </Text>
                ) : null}
              </Text>
            </View>
          ) : null}
          {rangeSuffix && onClearRange ? (
            <View
              style={[
                styles.rangeBanner,
                {backgroundColor: 'rgba(10, 132, 255, 0.10)'},
              ]}>
              <Pressable onPress={onClearRange} style={styles.rangeClearButton}>
                <Text
                  style={[
                    styles.rangeClearText,
                    {color: theme.colors.accentBlue},
                  ]}>
                  Asehoy ny toko manontolo
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      }
      onScrollToIndexFailed={onScrollToIndexFailed}
      onScrollBeginDrag={onScrollBeginDrag}
      onScrollEndDrag={onScrollEndDrag}
      onMomentumScrollEnd={onMomentumScrollEnd}
      renderItem={renderItem}
      {...listProps}
      style={[styles.container, { backgroundColor: theme.colors.readerBackground }]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  contentContainer: {
    paddingBottom: BIBLE_BASE_BOTTOM_PADDING,
  },
  headerContainer: {
    paddingBottom: 10,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verseNumber: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#3A86FF',
    transform: [{ translateY: -3 }],
  },
  bracketText: {
    fontStyle: 'italic',
    color: '#3a3a3a',
  },
  bibleVerseBlock: {
    marginBottom: BIBLE_VERSE_BLOCK_MARGIN,
  },
  selectedVerseBlock: {
    backgroundColor: 'rgba(10, 132, 255, 0.16)',
    borderRadius: 12,
    padding: 12,
  },
  rangeBanner: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 10,
  },
  rangeClearButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  rangeClearText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default BibleReaderView;
