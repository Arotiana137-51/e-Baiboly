import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform, ListRenderItemInfo, useWindowDimensions } from 'react-native';
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
  buildVerseDisplay,
  buildLineSegments,
  buildVerseLineOffsets,
  intersectMarksWithSpan,
  type ChapterMark,
  type MarkStyle,
  type VerseSpan,
} from '../utils/chapterMarks';
import {useJesusName} from '../contexts/JesusNameContext';
import {useTutorialTarget} from '../contexts/TutorialContext';
import {useKeyboardHeight} from '../hooks/useKeyboardHeight';
import {dimHighlightForDarkMode, dimHighlightForLightMode} from '../utils/colorUtils';
import {
  noteMarksForVerses,
  noteSnippetBudget,
  type Note,
  type VerseNoteMarks,
} from '../types/notes';
import {t} from '../i18n/strings';
import {NoteGlyph} from './NoteGlyph';
import {UITextView} from '@bsky.app/react-native-uitextview';
import {
  NATIVE_SELECTION,
  attachSelectionMenu,
  onSelectionMenuAction,
  onTextSelectionChange,
  reportSelection,
} from '../services/selectionMenu';
import {
  SPAN_LONG_PRESS,
  selectionToVerseRange,
  verseNumberLabel,
  verseTextPrefixLength,
} from '../utils/verseSelection';

const BIBLE_VERSE_LINE_HEIGHT_MULTIPLIER = 1.3;
const BIBLE_VERSE_BLOCK_MARGIN = 7;
// Width of the margin a noted verse reaches into for its bracket: the whole
// left padding of the list (16), so the text itself never moves.
const NOTE_GUTTER = 16;
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

// A verse's text. On iOS, when selectable, a UITextView: a React Native
// <Text> there can only copy its whole text, not select words. Its spans
// must then be UITextView too (elsewhere it's a plain <Text>). The lib hands
// `ref` on to the native view, but its props type leaves it out.
const VerseText = UITextView as React.ComponentType<
  React.ComponentProps<typeof UITextView> & {ref?: React.Ref<unknown>}
>;

export type SelectedVerseRange = {start: number; end: number} | null;

export type VerseSelectionAction = {
  verse: BibleVerse;
  key: string;
  range: {start: number; end: number} | null;
  text: string;
};

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
    noteMarks,
    noteMarkerRef,
    onNoteMarkPress,
    noteBubble,
    nativeSelection,
    onSelectableRef,
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
    noteMarks: VerseNoteMarks | null;
    // Notes tutorial spotlight, set on one verse only.
    noteMarkerRef?: React.RefObject<View | null>;
    onNoteMarkPress?: (noteId: string) => void;
    // The open note bubble, given only to the verse it points at.
    noteBubble?: React.ReactNode;
    // The phone's own selection (double-tap / long-press a word, then its
    // menu) replaces the app's double-tap and long-press on the verse.
    nativeSelection: boolean;
    onSelectableRef?: (verseNumber: number, instance: unknown) => void;
  }) => {
    const isPsalmsOrProverbs = item.book_id === PSALMS_BOOK_ID || item.book_id === PROVERBS_BOOK_ID;
    const hasTitle = typeof item.title === 'string' && item.title.trim().length > 0;

    const baseText = transformText(item.text);
    const readerText = !isPsalmsOrProverbs && !hasTitle ? flattenBibleTextForReader(baseText) : baseText;
    const { textWithoutFootnotes, footnotes } = extractBracketFootnotes(readerText);
    const { lines, italicLines } = processBibleTextWithMetadataForReader(textWithoutFootnotes);

    const lineOffsets = useMemo(() => buildVerseLineOffsets(lines), [lines]);
    const hasMarks = verseMarks.length > 0;

    // A range selection already filters the reader down to just those verses,
    // so the filtered view itself is the emphasis — no per-verse highlight.
    // Single-verse selection still gets the highlight + scroll.
    const isSelected =
      typeof selectedVerseNumber === 'number' &&
      item.verse_number === selectedVerseNumber;

    const verseFontSize = scaleFontSize(TEXT_STYLES.body.fontSize, fontScale);
    const verseLineHeight = Math.round(verseFontSize * BIBLE_VERSE_LINE_HEIGHT_MULTIPLIER) + 3;

    const lastTapRef = useRef(0);

    const selectableRef = useCallback(
      (instance: unknown) => onSelectableRef?.(item.verse_number, instance),
      [onSelectableRef, item.verse_number],
    );

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

    const bracket = noteMarks?.bracket ?? null;
    const startNoteId = noteMarks?.startNoteId ?? null;
    const previews = noteMarks?.previews ?? [];

    const verseBlock = (
      <Pressable
        ref={noteMarkerRef}
        collapsable={noteMarkerRef ? false : undefined}
        style={[
          styles.bibleVerseBlock,
          bracket && styles.notedVerseBlock,
          isSelected && styles.selectedVerseBlock,
        ]}
        onPress={nativeSelection ? undefined : handlePress}
        onLongPress={nativeSelection ? undefined : handleLongPress}
        delayLongPress={400}
        disabled={nativeSelection || (!onVerseDoubleTap && !onVerseLongPress)}
      >
        {/* A note's bracket in the margin, like a pen line beside the verses
            on paper, from its first verse down to its last. */}
        {bracket ? (
          <Pressable
            onPress={() => onNoteMarkPress?.(bracket.noteId)}
            style={styles.noteGutter}
            accessibilityRole="button"
            accessibilityLabel={t('notes.open')}
          >
            <View
              style={[
                styles.noteBar,
                {backgroundColor: theme.colors.accentBlue},
                bracket.isStart && styles.noteBarStart,
                !bracket.isEnd && styles.noteBarContinues,
              ]}
            />
          </Pressable>
        ) : null}
        <VerseText
          ref={nativeSelection ? selectableRef : undefined}
          selectable={nativeSelection}
          uiTextView
          onSelectionChange={onTextSelectionChange}
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
            <UITextView
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
            </UITextView>
          ) : null}

          {/* A note starting here turns the number into its button, as
              YouVersion does: white on the accent colour, tap to open. */}
          <UITextView
            onPress={
              startNoteId
                ? e => {
                    e.stopPropagation?.();
                    onNoteMarkPress?.(startNoteId);
                  }
                : undefined
            }
            // Without it, a long-press that selects the number would also
            // open the note on release.
            onLongPress={startNoteId ? SPAN_LONG_PRESS : undefined}
            suppressHighlighting
            accessibilityRole={startNoteId ? 'button' : undefined}
            accessibilityLabel={startNoteId ? t('notes.open') : undefined}
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
              startNoteId ? [styles.verseNumberOnNote, {backgroundColor: theme.colors.accentBlue}] : null,
            ]}
          >
            {verseNumberLabel(item.verse_number, !!startNoteId)}
          </UITextView>
          {' '}

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
                <UITextView key={`bible-line-${item.id}-${idx}`} style={lineStyle}>
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
                      <UITextView
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
                      </UITextView>
                    );
                  })}
                </UITextView>
              );
            }

            return (
              <UITextView key={`bible-line-${item.id}-${idx}`} style={lineStyle}>
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
              </UITextView>
            );
          })}

          {footnotes.map((footnote, idx) => (
            <UITextView
              key={`bible-footnote-${item.id}-${idx}`}
              style={{
                color: theme.colors.textWatermark,
                fontStyle: 'italic',
                lineHeight: verseLineHeight,
              }}
            >
              {'\n'}
              {footnote}
            </UITextView>
          ))}
        </VerseText>
        {/* The start of the note under the verses it covers, a few words and
            "…", like a pencilled line in the margin. Tap to read it all. */}
        {previews.map(p => (
          <Pressable
            key={p.noteId}
            onPress={() => onNoteMarkPress?.(p.noteId)}
            style={styles.notePreview}
            accessibilityRole="button"
            accessibilityLabel={t('notes.open')}
          >
            <NoteGlyph color={theme.colors.accentBlue} size={14} />
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              maxFontSizeMultiplier={1.3}
              style={[
                styles.notePreviewText,
                {
                  color: theme.colors.accentBlue,
                  fontSize: scaleFontSize(TEXT_STYLES.body.fontSize * 0.88, fontScale),
                },
              ]}
            >
              {p.snippet}
            </Text>
          </Pressable>
        ))}
      </Pressable>
    );

    // The bubble sits right above the verse it belongs to.
    return noteBubble ? (
      <View>
        {noteBubble}
        {verseBlock}
      </View>
    ) : (
      verseBlock
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
    prev.noteMarks === next.noteMarks &&
    prev.noteMarkerRef === next.noteMarkerRef &&
    prev.onNoteMarkPress === next.onNoteMarkPress &&
    prev.noteBubble === next.noteBubble &&
    prev.nativeSelection === next.nativeSelection &&
    prev.onSelectableRef === next.onSelectableRef &&
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
  // This chapter's notes, drawn as brackets in the margin.
  notes?: Note[];
  onNoteMarkPress?: (noteId: string) => void;
  // The open note bubble: drawn above this verse, scrolled clear of the
  // keyboard. `onFocus` is for the bubble's text field.
  noteBubbleVerse?: number | null;
  renderNoteBubble?: (onFocus: () => void) => React.ReactNode;
  // An item of the phone's selection menu was chosen on a verse. `range` is
  // the selection within the verse text, null when only the number or title
  // was selected.
  onSelectionAction?: (action: VerseSelectionAction) => void;
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
  notes,
  onNoteMarkPress,
  noteBubbleVerse,
  renderNoteBubble,
  onSelectionAction,
  flatListRef,
  headerText,
  chapterMarks,
  onClearRange,
  currentBookName,
}) => {
  const { theme } = useTheme();
  const noteMarkerRef = useTutorialTarget('noteMarker');
  const keyboardHeight = useKeyboardHeight();
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

  // verse_number -> its bracket, coloured number and previews (stable objects,
  // so untouched verses skip re-rendering). The preview's length follows the
  // window width, read once here so a rotation recomputes it once.
  const {width: windowWidth} = useWindowDimensions();
  const snippetBudget = useMemo(() => noteSnippetBudget(windowWidth), [windowWidth]);
  const noteMarksByVerse = useMemo(
    () => noteMarksForVerses(notes ?? [], snippetBudget),
    [notes, snippetBudget],
  );

  // Native selection: which verse each selectable <Text> (by its React tag)
  // shows, so a menu action can be traced back to its verse.
  const selectableTags = useRef(new Map<number, number>());
  const onSelectableRef = useCallback((verseNumber: number, instance: unknown) => {
    const tags = selectableTags.current;
    if (!instance) {
      for (const [tag, v] of tags) {
        if (v === verseNumber) {
          tags.delete(tag);
          reportSelection(tag, false);
        }
      }
      return;
    }
    const tag = attachSelectionMenu(instance);
    if (tag != null) tags.set(tag, verseNumber);
  }, []);

  // Read at event time, so the subscription below stays put.
  const selectionContext = useRef({verses, transformText, noteMarksByVerse, onSelectionAction});
  selectionContext.current = {verses, transformText, noteMarksByVerse, onSelectionAction};

  useEffect(() => {
    if (!NATIVE_SELECTION) return;
    const sub = onSelectionMenuAction(({tag, key, start, end}) => {
      const now = selectionContext.current;
      const verseNumber = selectableTags.current.get(tag);
      const verse = now.verses.find(v => v.verse_number === verseNumber);
      if (!verse) return;
      // Rebuild exactly what the verse's <Text> shows, to take the title and
      // the number off the selection.
      const display = buildVerseDisplay(verse, now.transformText);
      const label = verseNumberLabel(
        verse.verse_number,
        !!now.noteMarksByVerse[verse.verse_number]?.startNoteId,
      );
      const range = selectionToVerseRange(
        start,
        end,
        verseTextPrefixLength(display.title, label),
        display.displayText.length,
      );
      now.onSelectionAction?.({
        verse,
        key,
        range,
        text: range ? display.displayText.slice(range.start, range.end) : '',
      });
    });
    return () => sub?.remove();
  }, []);

  // Brings the bubble's verse to the top of the reader, above where the
  // keyboard rises (the window doesn't shrink for it on edge-to-edge Android).
  const scrollBubbleToTop = useCallback(() => {
    if (noteBubbleVerse == null) return;
    const index = visibleVerses.findIndex(v => v.verse_number === noteBubbleVerse);
    if (index < 0) return;
    setTimeout(
      () => flatListRef?.current?.scrollToIndex({index, viewPosition: 0, animated: true}),
      120,
    );
  }, [noteBubbleVerse, visibleVerses, flatListRef]);

  // When the bubble opens, and again once the keyboard is up (the extra
  // bottom room below lets even the last verse rise that far).
  useEffect(() => {
    scrollBubbleToTop();
  }, [scrollBubbleToTop]);
  useEffect(() => {
    if (keyboardHeight > 0) scrollBubbleToTop();
  }, [keyboardHeight, scrollBubbleToTop]);

  const noteBubbleElement =
    noteBubbleVerse != null && renderNoteBubble ? renderNoteBubble(scrollBubbleToTop) : null;

  // The tutorial points at the bracket of the note edited last.
  const markerVerse = useMemo(() => {
    let latest: Note | null = null;
    for (const n of notes ?? []) {
      if (n.anchor.kind === 'bible' && (!latest || n.updatedAt > latest.updatedAt)) latest = n;
    }
    return latest?.anchor.kind === 'bible' ? latest.anchor.verseStart : null;
  }, [notes]);

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
          noteMarks={noteMarksByVerse[item.verse_number] ?? null}
          noteMarkerRef={item.verse_number === markerVerse ? noteMarkerRef : undefined}
          onNoteMarkPress={onNoteMarkPress}
          noteBubble={item.verse_number === noteBubbleVerse ? noteBubbleElement : undefined}
          nativeSelection={NATIVE_SELECTION}
          onSelectableRef={onSelectableRef}
        />
      );
    },
    [
      onSelectableRef,
      noteBubbleVerse,
      noteBubbleElement,
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
      noteMarksByVerse,
      markerVerse,
      noteMarkerRef,
      onNoteMarkPress,
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
        {
          paddingBottom:
            BIBLE_BASE_BOTTOM_PADDING +
            bottomScrollSpacerAdjusted +
            (noteBubbleVerse != null ? keyboardHeight : 0),
        },
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
  // A noted verse reaches into the list's left padding for its bracket, so
  // the bracket stays inside the verse's own bounds and stays tappable (a
  // child outside its parent's bounds gets no touches on Android).
  notedVerseBlock: {
    marginLeft: -NOTE_GUTTER,
    paddingLeft: NOTE_GUTTER,
  },
  noteGutter: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: NOTE_GUTTER,
  },
  noteBar: {
    position: 'absolute',
    left: 6,
    width: 3,
    top: 0,
    bottom: 4,
    borderRadius: 1.5,
    opacity: 0.55,
  },
  noteBarStart: {
    top: 4,
  },
  // Runs through the gap to the next verse so the bracket reads as one line.
  noteBarContinues: {
    bottom: -BIBLE_VERSE_BLOCK_MARGIN,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  // White number on the accent colour: the verse starts a note.
  verseNumberOnNote: {
    color: '#FFFFFF',
  },
  // Quieter than the verse (0.7) and only as wide as its few words, so it
  // reads as a margin note, not as text of the chapter.
  notePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: 6,
    marginTop: 4,
    paddingVertical: 4,
    opacity: 0.7,
  },
  notePreviewText: {
    flexShrink: 1,
    fontStyle: 'italic',
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
