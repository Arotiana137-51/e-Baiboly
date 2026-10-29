import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextStyle,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {UITextView} from '@bsky.app/react-native-uitextview';
import { HymnVerse } from '../hooks/useHymnsData';
import { useTheme, useLowEndMode } from '../contexts/ThemeContext';
import {
  applyMarkToRange,
  buildHymnDisplay,
  buildLineSegments,
  buildVerseLineOffsets,
  eraseMarksInRange,
  HYMN_CHORUS_LABEL,
  intersectMarksWithSpan,
  rangeStyles,
  type ChapterMark,
  type MarkRange,
  type VerseLineSegment,
  type VerseSpan,
} from '../utils/chapterMarks';
import {dimHighlightForDarkMode, dimHighlightForLightMode, hexToRgba, translucentHighlight} from '../utils/colorUtils';
import {
  NATIVE_SELECTION,
  attachSelectionMenu,
  clearSelection,
  onSelectionChange,
  onTextDoubleTap,
  reportSelection,
  type NativeSelection,
} from '../services/selectionMenu';
import {BUBBLE_ARROW, BUBBLE_HEIGHT, BUBBLE_WIDTH, HighlightBubble} from './HighlightBubble';
import {useKeyboardHeight} from '../hooks/useKeyboardHeight';
import {noteSnippet, noteSnippetBudget, type Note} from '../types/notes';

// A note shown on a stanza: its id (to open it) and its first words (the
// preview under the text).
type StanzaNote = {id: string; snippet: string};
import {t} from '../i18n/strings';
import {NoteGlyph} from './NoteGlyph';

const DOUBLE_TAP_DELAY_MS = 300;
const EMPTY_MARKS: ChapterMark[] = [];

// iOS with native selection: the selectable text and its spans are the
// library's UITextViews, as in the Bible reader (a <Text> there can only copy
// its whole text). The lib hands `ref` on, but its props type leaves it out.
const IOS_NATIVE_SELECTION = NATIVE_SELECTION && Platform.OS === 'ios';
const SelectableText = UITextView as React.ComponentType<
  React.ComponentProps<typeof UITextView> & {ref?: React.Ref<unknown>}
>;
// Behind the stanza the action sheet is for, as behind a Bible verse.
const SELECTED_STANZA_BACKGROUND = 'rgba(10, 132, 255, 0.16)';
// Between that stanza and the sheet under it.
const REVEAL_MARGIN = 12;
// Room under a selection for Android's handles, when the bubble goes below.
const HANDLE_ROOM = 30;
const BUBBLE_MARGIN = 8;

// The selected words (hymn offsets) and where the highlight bubble sits.
type BubbleState = {range: MarkRange; left: number; top: number; arrowX: number; below: boolean};
type Measurable = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

// Hymn-specific spacing configuration
const HYMN_LINE_HEIGHT_MULTIPLIER = 1.7; // More relaxed spacing for hymns
const HYMN_STANZA_MARGIN = 20;
const HYMN_BASE_BOTTOM_PADDING = 28;

const FLOATING_BOTTOM_NAV_SPACER = {
  offsetFromBottom: 15,
  containerPaddingTop: 8,
  segmentHeight: 42,
  trackPaddingVertical: 4 * 2,
  extraMargin: 16,
} as const;

interface HymnReaderViewProps {
  hymnVerses: HymnVerse[];
  isLoading: boolean;
  hymnTitle?: string | null;
  // Hymnbook annotation ("Maintimolaly") and author credit, shown as muted
  // lines under the title — labels, never part of the sung text.
  hymnNote?: string | null;
  hymnAuthors?: string[];
  fontScale?: number;
  // Highlights / notes saved from the chapter editor, offsets into the text
  // built by buildHymnDisplay (same contract as BibleReaderView.chapterMarks).
  marks?: ChapterMark[];
  onHymnLongPress?: (stanzaNumber: number, stanzaText: string) => void;
  onHymnDoubleTap?: (stanzaNumber: number, stanzaText: string) => void;
  // This hymn's notes: stanza notes get a bracket, a whole-hymn note a chip
  // under the title.
  notes?: Note[];
  onNoteMarkPress?: (noteId: string) => void;
  // The open note bubble: a stanza number (0 = chorus) or 'whole' for the
  // whole-hymn note in the header. `onFocus` is for its text field.
  noteBubbleStanza?: number | 'whole' | null;
  renderNoteBubble?: (onFocus: () => void) => React.ReactNode;
  // The stanza the action sheet is for (0 = chorus), kept above the sheet.
  selectedStanza?: number | null;
  sheetHeight?: number;
  // The hymn's marks after a colour or style from the highlight bubble. Given,
  // the words are selectable (long-press) where the phone allows it.
  onMarksChange?: (next: ChapterMark[]) => void;
}

interface HymnStanza {
  verseNumber: number;
  heading: string | null;
  lines: HymnVerse[];
}

interface HymnStanzaItemProps {
  item: HymnStanza;
  fontScale: number;
  readerText: string;
  labelColor: string;
  verseNumberColor: string;
  stanzaCardBackground: string;
  chorusBackground: string;
  chorusLines: HymnVerse[];
  stanzaMarks: ChapterMark[];
  chorusMarks: ChapterMark[];
  isDark: boolean;
  onHymnLongPress?: (stanzaNumber: number, stanzaText: string) => void;
  onHymnDoubleTap?: (stanzaNumber: number, stanzaText: string) => void;
  stanzaNote: StanzaNote | null;
  chorusNote: StanzaNote | null;
  // The chorus repeats after every stanza; its preview line shows once.
  showChorusPreview: boolean;
  noteColor: string;
  onNoteMarkPress?: (noteId: string) => void;
  // The open note bubble, drawn above the stanza card or above the chorus.
  stanzaBubble?: React.ReactNode;
  chorusBubble?: React.ReactNode;
  // The phone's own word selection instead of the app's long-press editor.
  nativeSelection: boolean;
  onSelectableRef: (blockKey: string, stanza: number, text: string, instance: unknown) => void;
  // The card's view, to bring it above the action sheet.
  onBlockRef: (stanza: number, instance: View | null) => void;
  isSelected: boolean;
  chorusSelected: boolean;
}

const segmentStyle = (seg: VerseLineSegment, isDark: boolean, translucent: boolean): TextStyle[] => {
  const style: TextStyle[] = [];
  if (seg.marks.includes('bold')) style.push(styles.markBold);
  if (seg.marks.includes('italic')) style.push(styles.markItalic);
  if (seg.marks.includes('underline')) style.push(styles.markUnderline);
  if (seg.marks.includes('highlight') && seg.highlightColor) {
    style.push({
      // iOS draws its selection under the text: see-through there, so a
      // selection on highlighted words stays visible.
      backgroundColor: translucent
        ? translucentHighlight(seg.highlightColor, isDark)
        : isDark
          ? dimHighlightForDarkMode(seg.highlightColor)
          : dimHighlightForLightMode(seg.highlightColor),
    });
  }
  return style;
};

// A stanza's lines as one selectable text, so the phone's selection runs
// across them; its marks drawn as spans inside it.
const SelectableLines = ({
  text,
  marks,
  isDark,
  style,
  selectableRef,
}: {
  text: string;
  marks: ChapterMark[];
  isDark: boolean;
  style: any;
  selectableRef: (instance: unknown) => void;
}) => {
  const lines = useMemo(() => text.split('\n'), [text]);
  const offsets = useMemo(() => buildVerseLineOffsets(lines), [lines]);
  return (
    <SelectableText ref={selectableRef} selectable uiTextView maxFontSizeMultiplier={1.3} style={style}>
      {lines.map((line, idx) => (
        <UITextView key={idx}>
          {idx > 0 ? '\n' : null}
          {buildLineSegments(line, offsets[idx], marks).map((seg, segIdx) => (
            <UITextView key={segIdx} style={segmentStyle(seg, isDark, IOS_NATIVE_SELECTION)}>
              {seg.text}
            </UITextView>
          ))}
        </UITextView>
      ))}
    </SelectableText>
  );
};

// A stanza's lines with its marks applied — the hymn counterpart of the
// segment rendering in BibleReaderView (hymns have no italic markers).
const MarkedLines = ({
  text,
  marks,
  isDark,
  style,
  keyPrefix,
}: {
  text: string;
  marks: ChapterMark[];
  isDark: boolean;
  style: any;
  keyPrefix: string;
}) => {
  const lines = useMemo(() => text.split('\n'), [text]);
  const offsets = useMemo(() => buildVerseLineOffsets(lines), [lines]);
  return (
    <>
      {lines.map((line, idx) => {
        if (marks.length === 0) {
          return (
            <Text key={`${keyPrefix}-${idx}`} maxFontSizeMultiplier={1.3} style={style}>
              {line}
            </Text>
          );
        }
        return (
          <Text key={`${keyPrefix}-${idx}`} maxFontSizeMultiplier={1.3} style={style}>
            {buildLineSegments(line, offsets[idx], marks).map((seg, segIdx) => (
              <Text key={`seg-${segIdx}`} style={segmentStyle(seg, isDark, false)}>
                {seg.text}
              </Text>
            ))}
          </Text>
        );
      })}
    </>
  );
};

const HymnStanzaItem = React.memo<HymnStanzaItemProps>(({
  item,
  fontScale,
  readerText,
  labelColor,
  verseNumberColor,
  stanzaCardBackground,
  chorusBackground,
  chorusLines,
  stanzaMarks,
  chorusMarks,
  isDark,
  onHymnLongPress,
  onHymnDoubleTap,
  stanzaNote,
  chorusNote,
  showChorusPreview,
  noteColor,
  onNoteMarkPress,
  stanzaBubble,
  chorusBubble,
  nativeSelection,
  onSelectableRef,
  onBlockRef,
  isSelected,
  chorusSelected,
}) => {
  const stanzaText = useMemo(
    () => item.lines.map(line => line.text).join('\n').trim(),
    [item.lines],
  );
  const chorusText = useMemo(
    () => chorusLines.map(line => line.text).join('\n').trim(),
    [chorusLines],
  );
  const lineHeight = Math.round(
    styles.hymnText.fontSize * fontScale * HYMN_LINE_HEIGHT_MULTIPLIER,
  );
  const lineFontSize = styles.hymnText.fontSize * fontScale;
  const lineStyle = [styles.hymnText, {fontSize: lineFontSize, lineHeight, color: readerText}];
  const labelStyle = [styles.label, {fontSize: styles.label.fontSize * fontScale, color: labelColor}];

  // With native selection the long-press selects words (the highlight
  // bubble); the app's double-tap stays. Each copy of the chorus is its own
  // text, all of them stanza 0.
  const stanzaSelectable = useCallback(
    (instance: unknown) => onSelectableRef(`s-${item.verseNumber}`, item.verseNumber, stanzaText, instance),
    [onSelectableRef, item.verseNumber, stanzaText],
  );
  const chorusSelectable = useCallback(
    (instance: unknown) => onSelectableRef(`c-${item.verseNumber}`, 0, chorusText, instance),
    [onSelectableRef, item.verseNumber, chorusText],
  );
  const stanzaBlockRef = useCallback(
    (instance: View | null) => onBlockRef(item.verseNumber, instance),
    [onBlockRef, item.verseNumber],
  );
  // The chorus is brought into view by its first copy.
  const chorusBlockRef = useCallback(
    (instance: View | null) => {
      if (showChorusPreview) onBlockRef(0, instance);
    },
    [onBlockRef, showChorusPreview],
  );
  const longPress = nativeSelection ? undefined : onHymnLongPress;

  // Same double-tap detection as the Bible reader's verses. The chorus has its
  // own, as stanza 0, so it can carry a note too.
  const lastTapRef = useRef(0);
  const lastChorusTapRef = useRef(0);
  const doubleTap = (ref: React.MutableRefObject<number>, stanza: number, text: string) => {
    const now = Date.now();
    if (now - ref.current < DOUBLE_TAP_DELAY_MS) {
      ref.current = 0;
      onHymnDoubleTap?.(stanza, text);
      return;
    }
    ref.current = now;
  };

  // The bar along the card's left edge, like the Bible reader's margin
  // bracket. Tapping it opens the note.
  const noteBracket = (note: StanzaNote | null) =>
    note ? (
      <Pressable
        onPress={() => onNoteMarkPress?.(note.id)}
        style={styles.noteGutter}
        accessibilityRole="button"
        accessibilityLabel={t('notes.open')}
      >
        <View style={[styles.noteBar, {backgroundColor: noteColor}]} />
      </Pressable>
    ) : null;

  // The note's first line under the text, like a pencilled line in the
  // margin. Tap to read it all.
  const notePreview = (note: StanzaNote | null) =>
    note ? (
      <Pressable
        onPress={() => onNoteMarkPress?.(note.id)}
        style={styles.notePreview}
        accessibilityRole="button"
        accessibilityLabel={t('notes.open')}
      >
        <NoteGlyph color={noteColor} size={14} />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          maxFontSizeMultiplier={1.3}
          style={[styles.notePreviewText, {color: noteColor, fontSize: 15 * fontScale}]}
        >
          {note.snippet}
        </Text>
      </Pressable>
    ) : null;

  return (
    <View style={styles.stanzaBlock}>
      {stanzaBubble}
      <Pressable
        ref={stanzaBlockRef}
        collapsable={false}
        style={[
          styles.hymnStanza,
          {backgroundColor: isSelected ? SELECTED_STANZA_BACKGROUND : stanzaCardBackground},
        ]}
        // With native selection the double-tap comes from the native module,
        // as in the Bible reader: the text takes the taps.
        onPress={nativeSelection ? undefined : () => doubleTap(lastTapRef, item.verseNumber, stanzaText)}
        onLongPress={longPress ? () => longPress(item.verseNumber, stanzaText) : undefined}
        delayLongPress={400}
        disabled={nativeSelection || (!longPress && !onHymnDoubleTap)}
      >
        {noteBracket(stanzaNote)}
        <View style={styles.numberColumn}>
          {/* A stanza with a note gets its number on a pill, as YouVersion
              does for verses: tap it to open the note. */}
          {stanzaNote ? (
            <Pressable
              onPress={() => onNoteMarkPress?.(stanzaNote.id)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('notes.open')}
              style={[styles.numberPill, {backgroundColor: noteColor}]}
            >
              <Text
                maxFontSizeMultiplier={1.3}
                style={[
                  styles.hymnNumber,
                  styles.numberPillText,
                  {fontSize: styles.hymnNumber.fontSize * fontScale},
                ]}>
                {item.verseNumber}
              </Text>
            </Pressable>
          ) : (
            <Text
              maxFontSizeMultiplier={1.3}
              style={[
                styles.hymnNumber,
                {
                  fontSize: styles.hymnNumber.fontSize * fontScale,
                  color: verseNumberColor,
                },
              ]}>
              {item.verseNumber}
            </Text>
          )}
        </View>
        <View style={styles.hymnTextContainer}>
          {item.heading ? (
            <Text maxFontSizeMultiplier={1.3} style={[...labelStyle, styles.stanzaHeading]}>
              {item.heading}
            </Text>
          ) : null}
          {nativeSelection ? (
            <SelectableLines
              text={stanzaText}
              marks={stanzaMarks}
              isDark={isDark}
              style={lineStyle}
              selectableRef={stanzaSelectable}
            />
          ) : (
            <MarkedLines
              text={stanzaText}
              marks={stanzaMarks}
              isDark={isDark}
              style={lineStyle}
              keyPrefix={`stanza-${item.verseNumber}`}
            />
          )}
          {notePreview(stanzaNote)}
        </View>
      </Pressable>

      {chorusLines.length > 0 ? chorusBubble : null}
      {chorusLines.length > 0 ? (
        <Pressable
          ref={chorusBlockRef}
          collapsable={false}
          style={[
            styles.chorusBlock,
            {backgroundColor: chorusSelected ? SELECTED_STANZA_BACKGROUND : chorusBackground},
          ]}
          onPress={nativeSelection ? undefined : () => doubleTap(lastChorusTapRef, 0, chorusText)}
          onLongPress={longPress ? () => longPress(0, chorusText) : undefined}
          delayLongPress={400}
          disabled={nativeSelection || (!longPress && !onHymnDoubleTap)}
        >
          {noteBracket(chorusNote)}
          <View style={styles.chorusLabelRow}>
            {chorusNote ? (
              <Pressable
                onPress={() => onNoteMarkPress?.(chorusNote.id)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t('notes.open')}
                style={[styles.chorusPill, {backgroundColor: noteColor}]}
              >
                <Text
                  maxFontSizeMultiplier={1.3}
                  style={[
                    styles.chorusLabel,
                    styles.numberPillText,
                    {fontSize: styles.chorusLabel.fontSize * fontScale},
                  ]}
                >
                  {HYMN_CHORUS_LABEL}
                </Text>
              </Pressable>
            ) : (
              <Text
                maxFontSizeMultiplier={1.3}
                style={[
                  styles.chorusLabel,
                  {
                    fontSize: styles.chorusLabel.fontSize * fontScale,
                    color: verseNumberColor,
                  },
                ]}
              >
                {HYMN_CHORUS_LABEL}
              </Text>
            )}
          </View>
          <View style={styles.chorusTextContainer}>
            {nativeSelection ? (
              <SelectableLines
                text={chorusText}
                marks={chorusMarks}
                isDark={isDark}
                style={[...lineStyle, styles.chorusLine]}
                selectableRef={chorusSelectable}
              />
            ) : (
              <MarkedLines
                text={chorusText}
                marks={chorusMarks}
                isDark={isDark}
                style={[...lineStyle, styles.chorusLine]}
                keyPrefix={`chorus-${item.verseNumber}`}
              />
            )}
            {/* The chorus repeats after every stanza; its preview shows once. */}
            {showChorusPreview ? notePreview(chorusNote) : null}
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}, (prev, next) =>
  prev.item === next.item &&
  prev.fontScale === next.fontScale &&
  prev.readerText === next.readerText &&
  prev.labelColor === next.labelColor &&
  prev.verseNumberColor === next.verseNumberColor &&
  prev.stanzaCardBackground === next.stanzaCardBackground &&
  prev.chorusBackground === next.chorusBackground &&
  prev.chorusLines === next.chorusLines &&
  prev.stanzaMarks === next.stanzaMarks &&
  prev.chorusMarks === next.chorusMarks &&
  prev.isDark === next.isDark &&
  prev.onHymnLongPress === next.onHymnLongPress &&
  prev.onHymnDoubleTap === next.onHymnDoubleTap &&
  prev.stanzaNote === next.stanzaNote &&
  prev.chorusNote === next.chorusNote &&
  prev.showChorusPreview === next.showChorusPreview &&
  prev.noteColor === next.noteColor &&
  prev.onNoteMarkPress === next.onNoteMarkPress &&
  prev.stanzaBubble === next.stanzaBubble &&
  prev.chorusBubble === next.chorusBubble &&
  prev.nativeSelection === next.nativeSelection &&
  prev.onSelectableRef === next.onSelectableRef &&
  prev.onBlockRef === next.onBlockRef &&
  prev.isSelected === next.isSelected &&
  prev.chorusSelected === next.chorusSelected
);

const HymnReaderView: React.FC<HymnReaderViewProps> = ({
  hymnVerses,
  isLoading,
  hymnTitle,
  hymnNote,
  hymnAuthors,
  fontScale = 1,
  marks,
  onHymnLongPress,
  onHymnDoubleTap,
  notes,
  onNoteMarkPress,
  noteBubbleStanza,
  renderNoteBubble,
  selectedStanza = null,
  sheetHeight = 0,
  onMarksChange,
}) => {
  const { theme } = useTheme();
  const { isLowEndMode } = useLowEndMode();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<HymnStanza>>(null);
  const keyboardHeight = useKeyboardHeight();
  const nativeSelection = NATIVE_SELECTION && !!onMarksChange;

  // stanza -> its note (0 = chorus), plus the whole-hymn note. Stable objects,
  // so untouched stanzas skip re-rendering. The preview's length follows the
  // window width, as in the Bible reader.
  const {width: windowWidth} = useWindowDimensions();
  const snippetBudget = useMemo(() => noteSnippetBudget(windowWidth), [windowWidth]);
  const {noteByStanza, wholeHymnNote} = useMemo(() => {
    const byStanza: Record<number, StanzaNote> = {};
    let whole: StanzaNote | null = null;
    for (const n of notes ?? []) {
      if (n.anchor.kind !== 'hymn') continue;
      const entry = {id: n.id, snippet: noteSnippet(n.text, snippetBudget)};
      if (n.anchor.stanza === null) whole = entry;
      else byStanza[n.anchor.stanza] = entry;
    }
    return {noteByStanza: byStanza, wholeHymnNote: whole};
  }, [notes, snippetBudget]);

  const hasTitle = typeof hymnTitle === 'string' && hymnTitle.trim().length > 0;
  const headerNote = hymnNote?.trim() || '';
  const headerAuthors = (hymnAuthors ?? []).map(a => a.trim()).filter(Boolean).join(', ');
  const hasHeader =
    hasTitle ||
    headerNote.length > 0 ||
    headerAuthors.length > 0 ||
    wholeHymnNote !== null ||
    noteBubbleStanza === 'whole';

  const bottomScrollSpacer =
    Math.max(insets.bottom, 0) +
    FLOATING_BOTTOM_NAV_SPACER.offsetFromBottom +
    FLOATING_BOTTOM_NAV_SPACER.containerPaddingTop +
    FLOATING_BOTTOM_NAV_SPACER.segmentHeight +
    FLOATING_BOTTOM_NAV_SPACER.trackPaddingVertical +
    FLOATING_BOTTOM_NAV_SPACER.extraMargin;

  const bottomScrollSpacerAdjusted = Math.round(bottomScrollSpacer * 0.5) + 7;

  const {chorusLines, hymnStanzas} = useMemo(() => {
    const chorus = hymnVerses.filter(verse => verse.is_chorus);
    const stanzaOnly = hymnVerses.filter(verse => !verse.is_chorus);

    const grouped = stanzaOnly.reduce<Record<number, HymnVerse[]>>(
      (accumulator, verse) => {
        const bucket = accumulator[verse.verse_number] ?? [];
        bucket.push(verse);
        accumulator[verse.verse_number] = bucket;
        return accumulator;
      },
      {},
    );

    const stanzas = Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([verseNumber, stanzaVerses]) => ({
        verseNumber: Number(verseNumber),
        heading: stanzaVerses[0].heading || null,
        lines: stanzaVerses,
      }));

    return {chorusLines: chorus, hymnStanzas: stanzas};
  }, [hymnVerses]);

  const stanzaCardBackground = theme.isDark
    ? hexToRgba('#FFFFFF', 0.015)
    : hexToRgba('#000000', 0.01);

  const chorusBackground = theme.isDark
    ? hexToRgba('#FFFFFF', 0.02)
    : hexToRgba('#000000', 0.015);

  // Each stanza's place in the whole hymn text (verse_number 0 = chorus).
  const verseSpans = useMemo(
    () => (hymnVerses.length ? buildHymnDisplay(hymnVerses, HYMN_CHORUS_LABEL).verseSpans : []),
    [hymnVerses],
  );

  // Marks are stored as offsets into the whole hymn text; slice them per stanza
  // so each item only gets its own.
  const marksByVerseNumber = useMemo(() => {
    const map: Record<number, ChapterMark[]> = {};
    if (!marks?.length) return map;
    for (const span of verseSpans) {
      const local = intersectMarksWithSpan(marks, span);
      if (local.length > 0) map[span.verseNumber] = local;
    }
    return map;
  }, [marks, verseSpans]);

  // --- The highlight bubble over a native selection, as in BibleReaderView:
  // each stanza's text by its React tag, so an event leads back to the stanza
  // and the bubble can be placed by it. ---
  const rootRef = useRef<View>(null);
  const isScrollingRef = useRef(false);
  const [bubble, setBubble] = useState<BubbleState | null>(null);
  // Bumped by every selection event, so a measurement that comes back after a
  // newer event, or after the selection ended, is dropped.
  const selectionSeq = useRef(0);
  // The text whose selection the bubble is for: only its own end hides it.
  const bubbleTag = useRef<number | null>(null);
  // Where that text and the reader sit on screen, measured once per selection
  // and forgotten whenever the text could have moved.
  const selectionOrigin = useRef<{tag: number; x: number; y: number; width: number; height: number} | null>(null);
  const selectableTexts = useRef(
    new Map<number, {blockKey: string; stanza: number; text: string; instance: unknown}>(),
  );
  const onSelectableRef = useCallback(
    (blockKey: string, stanza: number, text: string, instance: unknown) => {
      const texts = selectableTexts.current;
      for (const [tag, entry] of texts) {
        if (entry.blockKey !== blockKey) continue;
        texts.delete(tag);
        reportSelection(tag, false);
        // Its selection went with it: so does the bubble.
        if (bubbleTag.current === tag) {
          bubbleTag.current = null;
          selectionOrigin.current = null;
          setBubble(null);
        }
      }
      if (!instance) return;
      const tag = attachSelectionMenu(instance);
      if (tag != null) texts.set(tag, {blockKey, stanza, text, instance});
    },
    [],
  );

  // Read at event time, so the subscriptions below stay put.
  const eventContext = useRef({verseSpans, onHymnDoubleTap});
  eventContext.current = {verseSpans, onHymnDoubleTap};

  useEffect(() => {
    if (!nativeSelection) return;
    const showBubble = (range: MarkRange, selection: NativeSelection) => {
      const origin = selectionOrigin.current;
      if (!origin) return;
      // The text's top-left in the reader.
      const x = origin.x + selection.x;
      // Above the words when it fits, else under them, clear of the handles.
      const above = origin.y + selection.top - BUBBLE_ARROW / 2 - 4 - BUBBLE_HEIGHT;
      const below = above < BUBBLE_MARGIN;
      const top = below ? origin.y + selection.bottom + HANDLE_ROOM : above;
      const left = Math.min(
        Math.max(x - BUBBLE_WIDTH / 2, BUBBLE_MARGIN),
        origin.width - BUBBLE_WIDTH - BUBBLE_MARGIN,
      );
      setBubble({
        range,
        left,
        top: Math.max(BUBBLE_MARGIN, Math.min(top, origin.height - BUBBLE_HEIGHT - BUBBLE_MARGIN)),
        arrowX: Math.min(Math.max(x - left, 18), BUBBLE_WIDTH - 18),
        below,
      });
    };

    // A stanza's selection as offsets into the whole hymn text.
    const hymnRange = (stanza: number, selection: NativeSelection): MarkRange | null => {
      const span: VerseSpan | undefined = eventContext.current.verseSpans.find(s => s.verseNumber === stanza);
      if (!span) return null;
      const start = span.start + Math.max(0, selection.start);
      const end = Math.min(span.end, span.start + selection.end);
      return end > start ? {start, end} : null;
    };

    const placeBubble = (tag: number, selection: NativeSelection | null) => {
      // A late end from another text leaves this selection's bubble alone.
      if (!selection && tag !== bubbleTag.current) return;
      const seq = ++selectionSeq.current;
      bubbleTag.current = selection ? tag : null;
      const entry = selection ? selectableTexts.current.get(tag) : undefined;
      const range = selection && entry ? hymnRange(entry.stanza, selection) : null;
      if (!selection || !entry || !range) {
        if (!selection) selectionOrigin.current = null;
        setBubble(null);
        return;
      }
      if (selectionOrigin.current?.tag === tag) {
        showBubble(range, selection);
        return;
      }
      (entry.instance as Measurable).measureInWindow((textX, textY) => {
        rootRef.current?.measureInWindow((rootX, rootY, rootWidth, rootHeight) => {
          if (bubbleTag.current !== tag) return;
          selectionOrigin.current = {tag, x: textX - rootX, y: textY - rootY, width: rootWidth, height: rootHeight};
          if (seq === selectionSeq.current) showBubble(range, selection);
        });
      });
    };

    const stopSelection = onSelectionChange(placeBubble);
    // A double-tap opens the stanza's sheet, as a verse's in the Bible.
    const doubleTaps = onTextDoubleTap(({tag}) => {
      if (isScrollingRef.current) return;
      const entry = selectableTexts.current.get(tag);
      if (!entry) return;
      clearSelection();
      eventContext.current.onHymnDoubleTap?.(entry.stanza, entry.text);
    });
    return () => {
      stopSelection();
      doubleTaps?.remove();
    };
  }, [nativeSelection]);

  const bubbleStyles = useMemo(
    () => (bubble ? rangeStyles(marks ?? [], bubble.range) : null),
    [bubble, marks],
  );

  // A colour or style lands on the words at once; the selection then ends.
  const editBubbleRange = (edit: (current: ChapterMark[], range: MarkRange) => ChapterMark[]) => {
    if (!bubble) return;
    onMarksChange?.(edit(marks ?? [], bubble.range));
    clearSelection();
    setBubble(null);
  };

  // --- The stanza the action sheet is for: kept above the sheet. ---
  const {height: windowHeight} = useWindowDimensions();
  const blockRefs = useRef(new Map<number, View>());
  const onBlockRef = useCallback((stanza: number, instance: View | null) => {
    if (instance) blockRefs.current.set(stanza, instance);
    else blockRefs.current.delete(stanza);
  }, []);
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);
  const contentHeight = useRef(0);
  const pendingReveal = useRef(false);
  const revealContext = useRef({sheetHeight, selectedStanza, windowHeight});
  revealContext.current = {sheetHeight, selectedStanza, windowHeight};

  // Just far enough: the stanza right above the sheet, or at the top when it
  // was above the view or is too long to fit. Until the room under the last
  // stanza is laid out it stays pending, and the size change tries again.
  const revealStanza = useCallback(() => {
    const {sheetHeight: covered, selectedStanza: stanza, windowHeight: screen} = revealContext.current;
    const block = stanza != null ? blockRefs.current.get(stanza) : undefined;
    const root = rootRef.current;
    if (!pendingReveal.current || !covered || !block || !root) return;
    block.measureInWindow((_bx, blockTop, _bw, blockHeight) => {
      root.measureInWindow((_rx, rootTop, _rw, rootHeight) => {
        const visibleBottom = Math.min(rootTop + rootHeight, screen - covered);
        let delta = 0;
        if (blockTop < rootTop + REVEAL_MARGIN) {
          delta = blockTop - rootTop - REVEAL_MARGIN;
        } else if (blockTop + blockHeight > visibleBottom - REVEAL_MARGIN) {
          delta = Math.min(blockTop + blockHeight + REVEAL_MARGIN - visibleBottom, blockTop - rootTop - REVEAL_MARGIN);
        }
        const target = Math.max(0, scrollY.current + delta);
        if (Math.abs(delta) >= 1 && target > contentHeight.current - viewportHeight.current + 1) return;
        pendingReveal.current = false;
        if (Math.abs(delta) < 1) return;
        scrollY.current = target;
        listRef.current?.scrollToOffset({offset: target, animated: true});
      });
    });
  }, []);

  // Room under the hymn for the sheet, so even the last stanza can rise above
  // it. When the sheet closes, the part the reader is scrolled into stays
  // (taking it away would make the text jump); later scrolls give back what
  // is out of view.
  const [sheetRoom, setSheetRoom] = useState(0);
  const sheetOpen = useRef(false);
  const roomInView = useCallback(
    (room: number) =>
      Math.min(room, Math.max(0, Math.ceil(scrollY.current + viewportHeight.current - (contentHeight.current - room)))),
    [],
  );
  useLayoutEffect(() => {
    sheetOpen.current = sheetHeight > 0;
    setSheetRoom(room => sheetHeight || roomInView(room));
    pendingReveal.current = sheetHeight > 0 && selectedStanza != null;
    const frame = requestAnimationFrame(revealStanza);
    return () => cancelAnimationFrame(frame);
  }, [sheetHeight, selectedStanza, roomInView, revealStanza]);

  const noteScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = e.nativeEvent.contentOffset.y;
      if (!sheetOpen.current) setSheetRoom(roomInView);
    },
    [roomInView],
  );
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);
  const onScrollBeginDrag = useCallback(() => {
    isScrollingRef.current = true;
    // The bubble stays where it was drawn, so scrolling ends the selection.
    if (NATIVE_SELECTION) clearSelection();
  }, []);
  const onScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      noteScrollEnd(e);
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 80);
    },
    [noteScrollEnd],
  );
  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      isScrollingRef.current = false;
      noteScrollEnd(e);
    },
    [noteScrollEnd],
  );
  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentHeight.current = height;
      revealStanza();
    },
    [revealStanza],
  );

  // Only to a stanza the list still holds: the hymn can change between
  // scheduling a scroll and running it, and scrollToIndex past the end is a
  // fatal crash (the 1.4.2 Bible reader's "scrollToIndex out of range").
  const scrollToStanza = useCallback((index: number) => {
    const list = listRef.current;
    if (list && index >= 0 && index < (list.props.data?.length ?? 0)) {
      list.scrollToIndex({index, viewPosition: 0, animated: true});
    }
  }, []);

  // Brings the bubble to the top of the reader, above where the keyboard
  // rises. The chorus bubble sits after the first stanza; the whole-hymn one
  // in the header.
  const scrollBubbleToTop = useCallback(() => {
    if (noteBubbleStanza == null) return;
    setTimeout(() => {
      if (noteBubbleStanza === 'whole') {
        listRef.current?.scrollToOffset({offset: 0, animated: true});
        return;
      }
      scrollToStanza(
        noteBubbleStanza === 0 ? 0 : hymnStanzas.findIndex(s => s.verseNumber === noteBubbleStanza),
      );
    }, 120);
  }, [noteBubbleStanza, hymnStanzas, scrollToStanza]);

  useEffect(() => {
    scrollBubbleToTop();
  }, [scrollBubbleToTop]);
  useEffect(() => {
    if (keyboardHeight > 0) scrollBubbleToTop();
  }, [keyboardHeight, scrollBubbleToTop]);

  const noteBubbleElement =
    noteBubbleStanza != null && renderNoteBubble ? renderNoteBubble(scrollBubbleToTop) : null;
  const firstStanzaNumber = hymnStanzas[0]?.verseNumber;

  const keyExtractor = useCallback((item: HymnStanza) => item.verseNumber.toString(), []);

  const renderItem = useCallback(
    ({item}: {item: HymnStanza}) => (
      <HymnStanzaItem
        item={item}
        fontScale={fontScale}
        readerText={theme.colors.readerText}
        labelColor={theme.colors.textSecondary}
        verseNumberColor={theme.colors.verseNumber}
        stanzaCardBackground={stanzaCardBackground}
        chorusBackground={chorusBackground}
        chorusLines={chorusLines}
        stanzaMarks={marksByVerseNumber[item.verseNumber] ?? EMPTY_MARKS}
        chorusMarks={marksByVerseNumber[0] ?? EMPTY_MARKS}
        isDark={theme.isDark}
        onHymnLongPress={onHymnLongPress}
        onHymnDoubleTap={onHymnDoubleTap}
        stanzaNote={noteByStanza[item.verseNumber] ?? null}
        chorusNote={noteByStanza[0] ?? null}
        showChorusPreview={item.verseNumber === firstStanzaNumber}
        noteColor={theme.colors.accentBlue}
        onNoteMarkPress={onNoteMarkPress}
        stanzaBubble={noteBubbleStanza === item.verseNumber ? noteBubbleElement : undefined}
        // The chorus repeats after every stanza; its bubble shows once.
        chorusBubble={
          noteBubbleStanza === 0 && item.verseNumber === firstStanzaNumber
            ? noteBubbleElement
            : undefined
        }
        nativeSelection={nativeSelection}
        onSelectableRef={onSelectableRef}
        onBlockRef={onBlockRef}
        isSelected={selectedStanza === item.verseNumber}
        // The chorus is marked once, on its first copy, like its note.
        chorusSelected={selectedStanza === 0 && item.verseNumber === firstStanzaNumber}
      />
    ),
    [
      nativeSelection,
      onSelectableRef,
      onBlockRef,
      selectedStanza,
      noteBubbleStanza,
      noteBubbleElement,
      firstStanzaNumber,
      fontScale,
      theme.colors.readerText,
      theme.colors.textSecondary,
      theme.colors.verseNumber,
      theme.colors.accentBlue,
      theme.isDark,
      stanzaCardBackground,
      chorusBackground,
      chorusLines,
      marksByVerseNumber,
      onHymnLongPress,
      onHymnDoubleTap,
      noteByStanza,
      onNoteMarkPress,
    ],
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Mirror BibleReaderView's tuning so low-end phones get the same treatment.
  // Hymn stanza counts are small (typically 4-8), so high values won't hurt either.
  const listProps = isLowEndMode
    ? {
        initialNumToRender: 6,
        maxToRenderPerBatch: 4,
        updateCellsBatchingPeriod: 60,
        windowSize: 5,
        removeClippedSubviews: false,
      }
    : {
        initialNumToRender: 10,
        maxToRenderPerBatch: 8,
        updateCellsBatchingPeriod: 40,
        windowSize: 8,
        // Off on Android: see BibleReaderView — removeClippedSubviews races on
        // Fabric and crashes in the clipping/mounting managers.
        removeClippedSubviews: false,
      };

  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={styles.root}
      onLayout={() => {
        // Sizes changed (rotation, keyboard): measure again for the bubble.
        selectionOrigin.current = null;
      }}
    >
      <FlatList
        ref={listRef}
        data={hymnStanzas}
        keyExtractor={keyExtractor}
        contentContainerStyle={{
          paddingBottom:
            HYMN_BASE_BOTTOM_PADDING +
            bottomScrollSpacerAdjusted +
            (noteBubbleStanza != null ? keyboardHeight : 0) +
            sheetRoom,
        }}
        onLayout={e => {
          viewportHeight.current = e.nativeEvent.layout.height;
        }}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onContentSizeChange={onContentSizeChange}
        onScrollToIndexFailed={info => setTimeout(() => scrollToStanza(info.index), 220)}
        ListHeaderComponent={
          <View>
            {hasHeader ? (
              <View style={styles.headerContainer}>
                {hasTitle ? (
                  <Text
                    maxFontSizeMultiplier={1.3}
                    style={[
                      styles.headerTitle,
                      {
                        color: theme.colors.readerText,
                        fontSize: styles.headerTitle.fontSize * fontScale,
                      },
                    ]}
                  >
                    {hymnTitle!.trim()}
                  </Text>
                ) : null}
                {headerNote ? (
                  <Text
                    maxFontSizeMultiplier={1.3}
                    style={[
                      styles.label,
                      styles.headerLabel,
                      {fontSize: styles.label.fontSize * fontScale, color: theme.colors.textSecondary},
                    ]}
                  >
                    {headerNote}
                  </Text>
                ) : null}
                {headerAuthors ? (
                  <Text
                    maxFontSizeMultiplier={1.3}
                    style={[
                      styles.label,
                      styles.headerLabel,
                      {fontSize: styles.label.fontSize * fontScale, color: theme.colors.textSecondary},
                    ]}
                  >
                    {headerAuthors}
                  </Text>
                ) : null}
                {noteBubbleStanza === 'whole' ? (
                  <View style={styles.headerBubble}>{noteBubbleElement}</View>
                ) : null}
                {/* The whole-hymn note, first line under the title. */}
                {wholeHymnNote && noteBubbleStanza !== 'whole' ? (
                  <Pressable
                    onPress={() => onNoteMarkPress?.(wholeHymnNote.id)}
                    style={[styles.notePreview, styles.headerNotePreview]}
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
                        {color: theme.colors.accentBlue, fontSize: 15 * fontScale},
                      ]}
                    >
                      {wholeHymnNote.snippet}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        renderItem={renderItem}
        {...listProps}
        style={[styles.container, { backgroundColor: theme.colors.readerBackground }]}
      />
      {bubble && bubbleStyles ? (
        <HighlightBubble
          left={bubble.left}
          top={bubble.top}
          arrowX={bubble.arrowX}
          below={bubble.below}
          current={bubbleStyles}
          onColor={color =>
            editBubbleRange((current, range) => applyMarkToRange(current, range, 'highlight', color))
          }
          onStyle={style => editBubbleRange((current, range) => applyMarkToRange(current, range, style))}
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
  headerContainer: {
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight:24,
  },
  // Muted italic used for every non-sung label: the hymnbook note and author
  // credit under the title, and a cue printed above a stanza.
  label: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  headerLabel: {
    marginTop: 6,
  },
  stanzaHeading: {
    marginBottom: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stanzaBlock: {
    marginBottom: HYMN_STANZA_MARGIN,
  },
  hymnStanza: {
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  hymnNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#005a9e',
    width: 24,
  },
  numberColumn: {
    width: 24,
  },
  // The card's left padding holds the bracket: a tap strip with the bar in it.
  noteGutter: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 10,
  },
  noteBar: {
    position: 'absolute',
    left: 3,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 1.5,
    opacity: 0.55,
  },
  // A stanza (or chorus) with a note: its number on a pill, tap to open.
  numberPill: {
    alignSelf: 'flex-start',
    minWidth: 26,
    borderRadius: 13,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  numberPillText: {
    width: undefined,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  chorusPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  chorusLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  // The note's first words under the text, like a pencilled margin line:
  // quieter than the lyrics (0.7) and only as wide as those words.
  notePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: 6,
    marginTop: 6,
    paddingVertical: 4,
    opacity: 0.7,
  },
  notePreviewText: {
    flexShrink: 1,
    fontStyle: 'italic',
  },
  headerNotePreview: {
    marginTop: 10,
  },
  headerBubble: {
    marginTop: 12,
  },
  hymnTextContainer: {
    flex: 1,
    paddingLeft: 8,
  },
  hymnText: {
    fontSize: 18,
    lineHeight: 32,
    color: '#1c1c1c',
  },
  chorusBlock: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  chorusLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  chorusTextContainer: {
    paddingLeft: 8,
  },
  markBold: {fontWeight: 'bold'},
  markItalic: {fontStyle: 'italic'},
  markUnderline: {textDecorationLine: 'underline'},
  chorusLine: {
    // The refrain is set in italics so it reads as a sung aside, visually
    // distinct from the numbered stanzas around it.
    fontStyle: 'italic',
  },
});

export default HymnReaderView;
