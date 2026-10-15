import React, {useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import { BibleVerse } from '../hooks/useBibleData';
import { useTheme, useLowEndMode } from '../contexts/ThemeContext';
import { TEXT_STYLES, scaleFontSize } from '../constants/Typography';
import {renderBibleLineForReader} from '../utils/bibleTextUtils';
import type {InlineBibleRef} from '../utils/bibleRefs';
import {
  applyMarkToRange,
  buildChapterDisplay,
  buildLineSegments,
  buildVerseLineOffsets,
  eraseMarksInRange,
  intersectMarksWithSpan,
  rangeStyles,
  type ChapterMark,
  type MarkRange,
  type MarkStyle,
  type VerseSpan,
} from '../utils/chapterMarks';
import {
  buildPassages,
  passageRangeToChapterRange,
  verseAtOffset,
  verseExtent,
  type Passage,
  type PassagePiece,
  type PassageVerse,
  type TextLine,
} from '../utils/chapterPassage';
import {useJesusName} from '../contexts/JesusNameContext';
import {useTutorialTarget} from '../contexts/TutorialContext';
import {useKeyboardHeight} from '../hooks/useKeyboardHeight';
import {dimHighlightForDarkMode, dimHighlightForLightMode, hexToRgba} from '../utils/colorUtils';
import {
  noteMarksForVerses,
  noteSnippetBudget,
  type Note,
  type VerseNoteMarks,
} from '../types/notes';
import {t} from '../i18n/strings';
import {
  BUBBLE_ARROW,
  BUBBLE_HEIGHT,
  BUBBLE_WIDTH,
  HighlightBubble,
} from './HighlightBubble';
import {UITextView} from '@bsky.app/react-native-uitextview';
import {
  NATIVE_SELECTION,
  attachSelectionMenu,
  clearSelection,
  onSelectionChange,
  onTextDoubleTap,
  onTextSelectionChange,
  reportSelection,
  type NativeSelection,
} from '../services/selectionMenu';
import {SPAN_LONG_PRESS} from '../utils/verseSelection';

const BIBLE_VERSE_LINE_HEIGHT_MULTIPLIER = 1.3;
const BIBLE_VERSE_BLOCK_MARGIN = 7;
// Width of the margin a note's bracket sits in: the whole left padding of the
// reader (16), so the text itself never moves.
const NOTE_GUTTER = 16;
const BIBLE_BASE_BOTTOM_PADDING = 28;
const DOUBLE_TAP_DELAY_MS = 280;
// Verses drawn as one text: nearly every chapter fits, and the cap keeps the
// longest (Salamo 119) quick to lay out.
const PASSAGE_MAX_VERSES = 50;
const PASSAGE_MAX_VERSES_LOW_END = 25;
// Where a verse the reader jumps to lands: 20 % from the top.
const JUMP_VIEW_POSITION = 0.2;
// Behind the words of the verse a search or a link landed on.
const SELECTED_VERSE_BACKGROUND = 'rgba(10, 132, 255, 0.16)';

const FLOATING_BOTTOM_NAV_SPACER = {
  offsetFromBottom: 15,
  containerPaddingTop: 8,
  segmentHeight: 42,
  trackPaddingVertical: 4 * 2,
  extraMargin: 16,
} as const;

const EMPTY_MARKS: ChapterMark[] = [];

// A passage's text. On iOS, when selectable, a UITextView: a React Native
// <Text> there can only copy its whole text, not select words. Its spans
// must then be UITextView too (elsewhere it's a plain <Text>). The lib hands
// `ref` on to the native view, but its props type leaves it out.
const VerseText = UITextView as React.ComponentType<
  React.ComponentProps<typeof UITextView> & {ref?: React.Ref<unknown>}
>;

export type SelectedVerseRange = {start: number; end: number} | null;

// What the screen can ask of the reader.
export type BibleReaderHandle = {
  scrollToVerse: (verseNumber: number) => void;
  scrollToTop: () => void;
};

// Room under a selection for Android's handles, when the bubble goes below.
const HANDLE_ROOM = 30;
const BUBBLE_MARGIN = 8;

// The selected words (chapter offsets) and where the highlight bubble sits.
type BubbleState = {
  range: MarkRange;
  left: number;
  top: number;
  arrowX: number;
  below: boolean;
};

type Measurable = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
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

// Sizes every verse of the reader shares.
type VerseMetrics = {fontSize: number; lineHeight: number; fontScale: number};

// One verse inside its passage's <Text>: title, number, words, footnotes and
// note previews, drawn from the passage's pieces. Its own component so a
// highlight redraws only the verses it touches.
const VerseSpans = React.memo(
  ({
    pv,
    pieces,
    theme,
    metrics,
    verseMarks,
    isSelected,
    onInlineRefPress,
    onNoteMarkPress,
    onVersePress,
    onVerseLongPress,
  }: {
    pv: PassageVerse;
    pieces: PassagePiece[];
    theme: any;
    metrics: VerseMetrics;
    verseMarks: ChapterMark[];
    isSelected: boolean;
    onInlineRefPress?: (ref: InlineBibleRef) => void;
    onNoteMarkPress?: (noteId: string) => void;
    // Without native selection (iOS for now): the app's own double-tap and
    // long-press on the verse.
    onVersePress?: (verse: BibleVerse) => void;
    onVerseLongPress?: (verse: BibleVerse) => void;
  }) => {
    const {verse, display} = pv;
    const {lines, italicLines} = display;
    const {fontSize, lineHeight, fontScale} = metrics;
    const lineOffsets = useMemo(() => buildVerseLineOffsets(lines), [lines]);
    const hasMarks = verseMarks.length > 0;

    const renderPiece = (piece: PassagePiece) => {
      switch (piece.kind) {
        case 'title':
          return (
            <UITextView
              key="title"
              style={{
                fontStyle: 'italic',
                fontWeight: '200',
                letterSpacing: 1.2,
                fontSize: Math.round(fontSize * 1.03),
                color:
                  theme.colors.textSecondary ??
                  theme.colors.textWatermark ??
                  theme.colors.readerText,
                opacity: 0.62,
                lineHeight,
                transform: [{ skewX: '-8deg' }],
              }}
            >
              {piece.text}
            </UITextView>
          );
        case 'number': {
          // A note starting here turns the number into its button, as
          // YouVersion does: white on the accent colour, tap to open.
          const noteId = pv.noteStartId;
          return (
            <UITextView
              key="number"
              onPress={
                noteId
                  ? e => {
                      e.stopPropagation?.();
                      onNoteMarkPress?.(noteId);
                    }
                  : undefined
              }
              // Without it, a long-press that selects the number would also
              // open the note on release.
              onLongPress={noteId ? SPAN_LONG_PRESS : undefined}
              suppressHighlighting
              accessibilityRole={noteId ? 'button' : undefined}
              accessibilityLabel={noteId ? t('notes.open') : undefined}
              style={[
                TEXT_STYLES.verseNumber,
                {
                  fontSize: scaleFontSize(TEXT_STYLES.verseNumber.fontSize, fontScale),
                  lineHeight,
                  color: theme.colors.verseNumber,
                  transform: [
                    {
                      translateY: (styles.verseNumber.transform?.[0] as any)?.translateY * fontScale,
                    },
                  ],
                },
                noteId ? [styles.verseNumberOnNote, {backgroundColor: theme.colors.accentBlue}] : null,
              ]}
            >
              {piece.text}
            </UITextView>
          );
        }
        case 'text':
          return lines.map((line, idx) => {
            const isBlockItalic = italicLines.has(idx);
            const lineStyle = isBlockItalic
              ? {
                  color: theme.colors.textWatermark,
                  fontStyle: 'italic' as const,
                  lineHeight,
                }
              : { lineHeight };

            if (hasMarks) {
              const segments = buildLineSegments(line, lineOffsets[idx], verseMarks);
              return (
                <UITextView key={`line-${idx}`} style={lineStyle}>
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
              <UITextView key={`line-${idx}`} style={lineStyle}>
                {idx === 0 ? '' : '\n'}
                {renderBibleLineForReader(line, {
                  baseTextStyle: { lineHeight },
                  footnoteTextStyle: {
                    opacity: 0.72,
                    fontSize: Math.max(10, Math.round(fontSize * 0.92)),
                    fontStyle: 'italic',
                  },
                  refTextStyle: onInlineRefPress
                    ? {
                        fontStyle: 'italic',
                        color: theme.colors.accentBlue ?? theme.colors.verseNumber,
                      }
                    : undefined,
                  onRefPress: onInlineRefPress,
                })}
              </UITextView>
            );
          });
        case 'footnote':
          return (
            <UITextView
              key={`footnote-${piece.start}`}
              style={{
                color: theme.colors.textWatermark,
                fontStyle: 'italic',
                lineHeight,
              }}
            >
              {piece.text}
            </UITextView>
          );
        case 'preview': {
          // The start of a note under the verses it covers, a few words and
          // "…", like a pencilled line in the margin. Tap to read it all.
          const noteId = piece.noteId;
          return (
            <UITextView
              key={`preview-${piece.start}`}
              onPress={noteId ? () => onNoteMarkPress?.(noteId) : undefined}
              onLongPress={SPAN_LONG_PRESS}
              suppressHighlighting
              accessibilityRole="button"
              accessibilityLabel={t('notes.open')}
              style={[
                styles.notePreview,
                {
                  color: hexToRgba(theme.colors.accentBlue, 0.7),
                  fontSize: scaleFontSize(TEXT_STYLES.body.fontSize * 0.88, fontScale),
                  lineHeight,
                },
              ]}
            >
              {piece.text}
            </UITextView>
          );
        }
        default:
          return piece.text;
      }
    };

    return (
      <UITextView
        onPress={onVersePress ? () => onVersePress(verse) : undefined}
        onLongPress={onVerseLongPress ? () => onVerseLongPress(verse) : undefined}
        suppressHighlighting
        style={isSelected ? styles.selectedVerse : undefined}
      >
        {pieces.map(renderPiece)}
      </UITextView>
    );
  },
);

type PassageViewProps = {
  passage: Passage;
  theme: any;
  metrics: VerseMetrics;
  marksByVerseId: Record<number, ChapterMark[]>;
  noteMarksByVerse: Record<number, VerseNoteMarks>;
  selectedVerseNumber?: number | null;
  nativeSelection: boolean;
  lines?: TextLine[];
  // The note the notes tutorial points at, and its target.
  markerNoteId: string | null;
  noteMarkerRef?: React.RefObject<View | null>;
  onSelectableRef: (passageKey: string, instance: unknown) => void;
  onLines: (passageKey: string, lines: TextLine[]) => void;
  onLayoutY: (passageKey: string, y: number) => void;
  onInlineRefPress?: (ref: InlineBibleRef) => void;
  onNoteMarkPress?: (noteId: string) => void;
  onVersePress?: (verse: BibleVerse) => void;
  onVerseLongPress?: (verse: BibleVerse) => void;
};

// Consecutive verses as one <Text>, so the phone's selection runs across
// them; the notes' brackets sit beside it, placed from its laid-out lines.
const PassageView = React.memo(
  ({
    passage,
    theme,
    metrics,
    marksByVerseId,
    noteMarksByVerse,
    selectedVerseNumber,
    nativeSelection,
    lines,
    markerNoteId,
    noteMarkerRef,
    onSelectableRef,
    onLines,
    onLayoutY,
    onInlineRefPress,
    onNoteMarkPress,
    onVersePress,
    onVerseLongPress,
  }: PassageViewProps) => {
    const {key} = passage;

    const selectableRef = useCallback(
      (instance: unknown) => onSelectableRef(key, instance),
      [onSelectableRef, key],
    );

    const handleTextLayout = useCallback(
      (e: NativeSyntheticEvent<TextLayoutEventData>) =>
        onLines(
          key,
          e.nativeEvent.lines.map(line => ({text: line.text, y: line.y, height: line.height})),
        ),
      [onLines, key],
    );

    // A note's bracket in the margin, like a pen line beside the verses on
    // paper, from its first verse down to its last.
    const brackets = useMemo(() => {
      if (!lines) return [];
      const bars: {noteId: string; top: number; bottom: number; lastIndex: number}[] = [];
      passage.verses.forEach((pv, index) => {
        const bracket = noteMarksByVerse[pv.verse.verse_number]?.bracket;
        const extent = bracket && verseExtent(lines, pv);
        if (!bracket || !extent) return;
        const top = extent.top + (bracket.isStart ? 4 : 0);
        const bottom = extent.bottom - (bracket.isEnd ? 4 : 0);
        const last = bars[bars.length - 1];
        if (last && last.noteId === bracket.noteId && last.lastIndex === index - 1) {
          last.bottom = bottom;
          last.lastIndex = index;
        } else {
          bars.push({noteId: bracket.noteId, top, bottom, lastIndex: index});
        }
      });
      return bars;
    }, [lines, passage, noteMarksByVerse]);

    const piecesByVerse = useMemo(
      () =>
        passage.verses.map(pv =>
          passage.pieces.filter(p => p.start >= pv.start && p.start < pv.end),
        ),
      [passage],
    );

    return (
      <View
        style={styles.passage}
        onLayout={(e: LayoutChangeEvent) => onLayoutY(key, e.nativeEvent.layout.y)}
      >
        {brackets.map((bar, index) => (
          <Pressable
            key={`${bar.noteId}-${index}`}
            ref={bar.noteId === markerNoteId ? noteMarkerRef : undefined}
            collapsable={false}
            onPress={() => onNoteMarkPress?.(bar.noteId)}
            style={[styles.noteGutter, {top: bar.top, height: Math.max(bar.bottom - bar.top, 8)}]}
            accessibilityRole="button"
            accessibilityLabel={t('notes.open')}
          >
            <View style={[styles.noteBar, {backgroundColor: theme.colors.accentBlue}]} />
          </Pressable>
        ))}
        <VerseText
          ref={nativeSelection ? selectableRef : undefined}
          selectable={nativeSelection}
          uiTextView
          onSelectionChange={onTextSelectionChange}
          onTextLayout={handleTextLayout}
          maxFontSizeMultiplier={1.3}
          style={[
            TEXT_STYLES.body,
            {
              fontSize: metrics.fontSize,
              lineHeight: metrics.lineHeight,
              // iOS breaks lines greedily with no hyphenation, so justify
              // stretches long Malagasy words into wide gaps. Android balances
              // line breaks and justifies cleanly.
              textAlign: Platform.OS === 'ios' ? 'left' : 'justify',
              color: theme.colors.readerText,
              ...(Platform.OS === 'android' ? { includeFontPadding: true } : null),
            },
          ]}
        >
          {passage.verses.map((pv, index) => [
            // The end of the previous verse's last line, then a short empty
            // line: the gap between two verses.
            index > 0 ? (
              <UITextView key={`gap-${pv.verse.id}`}>
                {'\n'}
                <UITextView style={styles.verseGap}>{'\n'}</UITextView>
              </UITextView>
            ) : null,
            <VerseSpans
              key={pv.verse.id}
              pv={pv}
              pieces={piecesByVerse[index]}
              theme={theme}
              metrics={metrics}
              verseMarks={marksByVerseId[pv.verse.id] ?? EMPTY_MARKS}
              isSelected={pv.verse.verse_number === selectedVerseNumber}
              onInlineRefPress={onInlineRefPress}
              onNoteMarkPress={onNoteMarkPress}
              onVersePress={onVersePress}
              onVerseLongPress={onVerseLongPress}
            />,
          ])}
        </VerseText>
      </View>
    );
  },
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
  // The chapter's marks after a colour or style from the highlight bubble.
  onChapterMarksChange?: (next: ChapterMark[]) => void;
  // Jump to a verse, back to the top.
  handleRef?: React.Ref<BibleReaderHandle>;
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
  onChapterMarksChange,
  handleRef,
  headerText,
  chapterMarks,
  onClearRange,
  currentBookName,
}) => {
  const { theme } = useTheme();
  const noteMarkerRef = useTutorialTarget('noteMarker');
  const keyboardHeight = useKeyboardHeight();
  const { isLowEndMode } = useLowEndMode();
  const {transformText} = useJesusName();
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

  // Offsets over the whole chapter, even when only a range is shown, so a
  // highlight lands on the same words in both views.
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

  // verse_number -> its bracket, coloured number and previews. The preview's
  // length follows the window width, read once here so a rotation recomputes
  // it once.
  const {width: windowWidth} = useWindowDimensions();
  const snippetBudget = useMemo(() => noteSnippetBudget(windowWidth), [windowWidth]);
  const noteMarksByVerse = useMemo(
    () => noteMarksForVerses(notes ?? [], snippetBudget),
    [notes, snippetBudget],
  );

  // The open note bubble sits between two passages, above its verse.
  const bubbleVerse =
    noteBubbleVerse != null && renderNoteBubble && visibleVerses.some(v => v.verse_number === noteBubbleVerse)
      ? noteBubbleVerse
      : null;

  const passages = useMemo(
    () =>
      buildPassages(visibleVerses, transformText, noteMarksByVerse, {
        breakBefore: bubbleVerse,
        maxVerses: isLowEndMode ? PASSAGE_MAX_VERSES_LOW_END : PASSAGE_MAX_VERSES,
      }),
    [visibleVerses, transformText, noteMarksByVerse, bubbleVerse, isLowEndMode],
  );

  const metrics = useMemo<VerseMetrics>(() => {
    const fontSize = scaleFontSize(TEXT_STYLES.body.fontSize, fontScale);
    return {
      fontSize,
      lineHeight: Math.round(fontSize * BIBLE_VERSE_LINE_HEIGHT_MULTIPLIER) + 3,
      fontScale,
    };
  }, [fontScale]);

  // Each passage's laid-out lines (for the brackets and jumps) and its place
  // in the scroll view. Lines also live in a ref, for the jumps.
  const [linesByPassage, setLinesByPassage] = useState<Record<string, TextLine[]>>({});
  const linesRef = useRef<Record<string, TextLine[]>>({});
  const passageY = useRef<Record<string, number>>({});

  // --- Jumps: to a verse (search, links, the picker...) or to the top. ---
  const scrollRef = useRef<ScrollView>(null);
  const viewportHeight = useRef(0);
  const pendingVerse = useRef<number | null>(null);
  const passagesRef = useRef(passages);
  passagesRef.current = passages;

  // Forget the layout of passages no longer shown.
  useEffect(() => {
    const keys = new Set(passages.map(p => p.key));
    for (const key of Object.keys(passageY.current)) {
      if (!keys.has(key)) delete passageY.current[key];
    }
    for (const key of Object.keys(linesRef.current)) {
      if (!keys.has(key)) delete linesRef.current[key];
    }
  }, [passages]);

  // Scrolls to the pending verse once its passage is laid out; until then it
  // stays pending and each layout tries again.
  const scrollToPendingVerse = useCallback(() => {
    const verseNumber = pendingVerse.current;
    if (verseNumber == null) return;
    const passage = passagesRef.current.find(p => p.verses.some(v => v.verse.verse_number === verseNumber));
    if (!passage) {
      pendingVerse.current = null;
      return;
    }
    const y = passageY.current[passage.key];
    const lines = linesRef.current[passage.key];
    const pv = passage.verses.find(v => v.verse.verse_number === verseNumber);
    const extent = lines && pv ? verseExtent(lines, pv) : null;
    if (y == null || !extent) return;
    pendingVerse.current = null;
    scrollRef.current?.scrollTo({
      y: Math.max(0, y + extent.top - viewportHeight.current * JUMP_VIEW_POSITION),
      animated: true,
    });
  }, []);

  useImperativeHandle(
    handleRef,
    () => ({
      scrollToVerse: verseNumber => {
        pendingVerse.current = verseNumber;
        scrollToPendingVerse();
      },
      scrollToTop: () => scrollRef.current?.scrollTo({y: 0, animated: true}),
    }),
    [scrollToPendingVerse],
  );

  const onLines = useCallback(
    (key: string, lines: TextLine[]) => {
      linesRef.current[key] = lines;
      setLinesByPassage(prev => {
        const old = prev[key];
        const same =
          old &&
          old.length === lines.length &&
          old.every((line, i) => line.y === lines[i].y && line.text === lines[i].text);
        return same ? prev : {...prev, [key]: lines};
      });
      scrollToPendingVerse();
    },
    [scrollToPendingVerse],
  );

  const onLayoutY = useCallback(
    (key: string, y: number) => {
      passageY.current[key] = y;
      scrollToPendingVerse();
    },
    [scrollToPendingVerse],
  );

  // --- The open note bubble: brought to the top of the reader, above where
  // the keyboard rises (the window doesn't shrink for it on edge-to-edge
  // Android). ---
  const noteBubbleY = useRef<number | null>(null);
  const bubbleScrollPending = useRef(false);
  const scrollBubbleToTop = useCallback(() => {
    if (noteBubbleY.current == null) {
      bubbleScrollPending.current = true;
      return;
    }
    const y = noteBubbleY.current;
    setTimeout(() => scrollRef.current?.scrollTo({y, animated: true}), 120);
  }, []);

  useEffect(() => {
    if (bubbleVerse == null) {
      noteBubbleY.current = null;
      return;
    }
    scrollBubbleToTop();
  }, [bubbleVerse, scrollBubbleToTop]);
  useEffect(() => {
    if (keyboardHeight > 0 && bubbleVerse != null) scrollBubbleToTop();
  }, [keyboardHeight, bubbleVerse, scrollBubbleToTop]);

  const noteBubbleElement = bubbleVerse != null && renderNoteBubble ? renderNoteBubble(scrollBubbleToTop) : null;

  // The notes tutorial points at the bracket of the note edited last.
  const markerNoteId = useMemo(() => {
    let latest: Note | null = null;
    for (const n of notes ?? []) {
      if (n.anchor.kind === 'bible' && (!latest || n.updatedAt > latest.updatedAt)) latest = n;
    }
    return latest?.id ?? null;
  }, [notes]);

  // --- Without native selection (iOS for now): the app's own double-tap
  // (verse menu) and long-press (chapter editor) on a verse. ---
  const lastTap = useRef<{verse: number; at: number} | null>(null);
  const contextRef = useRef({onVerseDoubleTap, onVerseLongPress, onInlineRefPress});
  contextRef.current = {onVerseDoubleTap, onVerseLongPress, onInlineRefPress};

  const handleVersePress = useCallback((verse: BibleVerse) => {
    if (isScrollingRef.current) return;
    const now = Date.now();
    const last = lastTap.current;
    if (last && last.verse === verse.verse_number && now - last.at < DOUBLE_TAP_DELAY_MS) {
      lastTap.current = null;
      contextRef.current.onVerseDoubleTap?.(verse);
      return;
    }
    lastTap.current = {verse: verse.verse_number, at: now};
  }, []);

  const handleVerseLongPress = useCallback((verse: BibleVerse) => {
    if (isScrollingRef.current) return;
    contextRef.current.onVerseLongPress?.(verse);
  }, []);

  // A reference tap is never the first half of a double-tap.
  const handleInlineRefPress = useCallback((ref: InlineBibleRef) => {
    lastTap.current = null;
    contextRef.current.onInlineRefPress?.(ref);
  }, []);

  // --- Native selection: each passage's <Text> by its React tag, so an event
  // can be traced back to its passage and the bubble placed by it. ---
  const selectableTexts = useRef(new Map<number, {passageKey: string; instance: unknown}>());
  const onSelectableRef = useCallback((passageKey: string, instance: unknown) => {
    const texts = selectableTexts.current;
    if (!instance) {
      for (const [tag, text] of texts) {
        if (text.passageKey === passageKey) {
          texts.delete(tag);
          reportSelection(tag, false);
        }
      }
      return;
    }
    const tag = attachSelectionMenu(instance);
    if (tag != null) texts.set(tag, {passageKey, instance});
  }, []);

  const rootRef = useRef<View>(null);
  const [bubble, setBubble] = useState<BubbleState | null>(null);
  // Bumped by every selection event, so a measurement that comes back after a
  // newer event, or after the selection ended, is dropped.
  const selectionSeq = useRef(0);

  // Read at event time, so the subscriptions below stay put.
  const selectionContext = useRef({verseSpans});
  selectionContext.current = {verseSpans};

  useEffect(() => {
    if (!NATIVE_SELECTION) return;
    const findPassage = (tag: number) => {
      const text = selectableTexts.current.get(tag);
      const passage = text && passagesRef.current.find(p => p.key === text.passageKey);
      return text && passage ? {passage, instance: text.instance as Measurable} : null;
    };

    const placeBubble = (selection: NativeSelection | null) => {
      const seq = ++selectionSeq.current;
      const found = selection && findPassage(selection.tag);
      const range =
        selection && found
          ? passageRangeToChapterRange(
              found.passage,
              selection.start,
              selection.end,
              selectionContext.current.verseSpans,
            )
          : null;
      if (!selection || !found || !range) {
        setBubble(null);
        return;
      }
      found.instance.measureInWindow((textX, textY) => {
        rootRef.current?.measureInWindow((rootX, rootY, rootWidth, rootHeight) => {
          if (seq !== selectionSeq.current) return;
          const x = textX - rootX + selection.x;
          // Above the words when it fits, else under them, clear of the handles.
          const above = textY - rootY + selection.top - BUBBLE_ARROW / 2 - 4 - BUBBLE_HEIGHT;
          const below = above < BUBBLE_MARGIN;
          const top = below ? textY - rootY + selection.bottom + HANDLE_ROOM : above;
          const left = Math.min(
            Math.max(x - BUBBLE_WIDTH / 2, BUBBLE_MARGIN),
            rootWidth - BUBBLE_WIDTH - BUBBLE_MARGIN,
          );
          setBubble({
            range,
            left,
            top: Math.max(BUBBLE_MARGIN, Math.min(top, rootHeight - BUBBLE_HEIGHT - BUBBLE_MARGIN)),
            arrowX: Math.min(Math.max(x - left, 18), BUBBLE_WIDTH - 18),
            below,
          });
        });
      });
    };

    const stopSelection = onSelectionChange(placeBubble);
    // A double-tap opens the tapped verse's menu, as it always has.
    const doubleTaps = onTextDoubleTap(({tag, offset}) => {
      const found = findPassage(tag);
      const verse = found && verseAtOffset(found.passage, offset);
      if (!verse) return;
      clearSelection();
      contextRef.current.onVerseDoubleTap?.(verse);
    });
    return () => {
      stopSelection();
      doubleTaps?.remove();
    };
  }, []);

  const bubbleStyles = useMemo(
    () => (bubble ? rangeStyles(chapterMarks ?? [], bubble.range) : null),
    [bubble, chapterMarks],
  );

  // A colour or style lands on the words at once; the selection then ends.
  const editBubbleRange = (edit: (marks: ChapterMark[], range: MarkRange) => ChapterMark[]) => {
    if (!bubble) return;
    onChapterMarksChange?.(edit(chapterMarks ?? [], bubble.range));
    clearSelection();
    setBubble(null);
  };

  const bottomScrollSpacer =
    Math.max(insets.bottom, 0) +
    FLOATING_BOTTOM_NAV_SPACER.offsetFromBottom +
    FLOATING_BOTTOM_NAV_SPACER.containerPaddingTop +
    FLOATING_BOTTOM_NAV_SPACER.segmentHeight +
    FLOATING_BOTTOM_NAV_SPACER.trackPaddingVertical +
    FLOATING_BOTTOM_NAV_SPACER.extraMargin;

  const bottomScrollSpacerAdjusted = Math.round(bottomScrollSpacer * 0.5) + 7;

  const onScrollBeginDrag = useCallback(() => {
    isScrollingRef.current = true;
    // The bubble stays where it was drawn, so scrolling ends the selection.
    if (NATIVE_SELECTION) clearSelection();
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
    <View ref={rootRef} collapsable={false} style={styles.root}>
      <ScrollView
        ref={scrollRef}
        onLayout={e => {
          viewportHeight.current = e.nativeEvent.layout.height;
        }}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingBottom:
              BIBLE_BASE_BOTTOM_PADDING +
              bottomScrollSpacerAdjusted +
              (bubbleVerse != null ? keyboardHeight : 0),
          },
        ]}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={[styles.container, { backgroundColor: theme.colors.readerBackground }]}
      >
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
        {passages.map(passage => (
          <React.Fragment key={passage.key}>
            {/* The open note bubble, right above the verse it belongs to. */}
            {noteBubbleElement && passage.verses[0].verse.verse_number === bubbleVerse ? (
              <View
                onLayout={e => {
                  noteBubbleY.current = e.nativeEvent.layout.y;
                  if (bubbleScrollPending.current) {
                    bubbleScrollPending.current = false;
                    scrollBubbleToTop();
                  }
                }}
              >
                {noteBubbleElement}
              </View>
            ) : null}
            <PassageView
              passage={passage}
              theme={theme}
              metrics={metrics}
              marksByVerseId={marksByVerseId}
              noteMarksByVerse={noteMarksByVerse}
              selectedVerseNumber={selectedVerseNumber}
              nativeSelection={NATIVE_SELECTION}
              lines={linesByPassage[passage.key]}
              markerNoteId={markerNoteId}
              noteMarkerRef={noteMarkerRef}
              onSelectableRef={onSelectableRef}
              onLines={onLines}
              onLayoutY={onLayoutY}
              onInlineRefPress={onInlineRefPress ? handleInlineRefPress : undefined}
              onNoteMarkPress={onNoteMarkPress}
              onVersePress={!NATIVE_SELECTION && onVerseDoubleTap ? handleVersePress : undefined}
              onVerseLongPress={!NATIVE_SELECTION && onVerseLongPress ? handleVerseLongPress : undefined}
            />
          </React.Fragment>
        ))}
      </ScrollView>
      {bubble && bubbleStyles ? (
        <HighlightBubble
          left={bubble.left}
          top={bubble.top}
          arrowX={bubble.arrowX}
          below={bubble.below}
          current={bubbleStyles}
          onColor={color =>
            editBubbleRange((marks, range) => applyMarkToRange(marks, range, 'highlight', color))
          }
          onStyle={style => editBubbleRange((marks, range) => applyMarkToRange(marks, range, style))}
          onErase={() => editBubbleRange(eraseMarksInRange)}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1},
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
  // The passage reaches into the reader's left padding, where the notes'
  // brackets go, so the text itself stays put and the brackets stay tappable
  // (a child outside its parent's bounds gets no touches on Android).
  passage: {
    marginLeft: -NOTE_GUTTER,
    paddingLeft: NOTE_GUTTER,
    marginBottom: BIBLE_VERSE_BLOCK_MARGIN,
  },
  // The short empty line between two verses: their old block margin.
  verseGap: {
    fontSize: 4,
    lineHeight: BIBLE_VERSE_BLOCK_MARGIN,
  },
  selectedVerse: {
    backgroundColor: SELECTED_VERSE_BACKGROUND,
  },
  noteGutter: {
    position: 'absolute',
    left: 0,
    width: NOTE_GUTTER,
  },
  noteBar: {
    position: 'absolute',
    left: 6,
    width: 3,
    top: 0,
    bottom: 0,
    borderRadius: 1.5,
    opacity: 0.55,
  },
  // White number on the accent colour: the verse starts a note.
  verseNumberOnNote: {
    color: '#FFFFFF',
  },
  // Quieter than the verse and only a few words long, so it reads as a margin
  // note, not as text of the chapter.
  notePreview: {
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
