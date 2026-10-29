import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {UITextView} from '@bsky.app/react-native-uitextview';
import { HymnVerse } from '../hooks/useHymnsData';
import { useTheme, useLowEndMode } from '../contexts/ThemeContext';
import {
  buildHymnDisplay,
  buildLineSegments,
  buildVerseLineOffsets,
  HYMN_CHORUS_LABEL,
  intersectMarksWithSpan,
  type ChapterMark,
  type VerseLineSegment,
} from '../utils/chapterMarks';
import {NATIVE_SELECTION, clearSelection, skipLines} from '../services/selectionMenu';
import {SelectionHighlightBubble} from './HighlightBubble';
import {highlightStyle} from './BibleReaderView';
import {useSelectionBubble} from '../hooks/useSelectionBubble';
import {useSheetRoom} from '../hooks/useSheetRoom';
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
const SelectableText = UITextView as React.ComponentType<
  React.ComponentProps<typeof UITextView> & {ref?: React.Ref<unknown>}
>;
// Behind the stanza the action sheet is for, as behind a Bible verse.
const SELECTED_STANZA_BACKGROUND = 'rgba(10, 132, 255, 0.16)';
// Between that stanza and the sheet under it.
const REVEAL_MARGIN = 12;

// What a selectable text holds: its stanza (0 = chorus) and its words.
type StanzaText = {stanza: number; text: string};

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
  chorusLines: HymnVerse[];
  stanzaMarks: ChapterMark[];
  chorusMarks: ChapterMark[];
  isDark: boolean;
  onHymnLongPress?: (stanzaNumber: number, stanzaText: string) => void;
  // A double-tap on a card: its key (`s-<n>` a stanza, `c-<n>` the chorus
  // after stanza n), its stanza (0 = chorus) and words.
  onBlockDoubleTap?: (block: string, stanzaNumber: number, stanzaText: string) => void;
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
  // The card's view (by its block key), to bring it above the action sheet.
  onBlockRef: (block: string, instance: View | null) => void;
  isSelected: boolean;
  chorusSelected: boolean;
}

// A segment's marks, from shared style objects as in the Bible reader.
const segmentStyle = (seg: VerseLineSegment, isDark: boolean): StyleProp<TextStyle> => [
  seg.marks.includes('bold') && styles.markBold,
  seg.marks.includes('italic') && styles.markItalic,
  seg.marks.includes('underline') && styles.markUnderline,
  seg.marks.includes('highlight') && seg.highlightColor ? highlightStyle(seg.highlightColor, isDark) : null,
];

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
  style: StyleProp<TextStyle>;
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
            <UITextView key={segIdx} style={segmentStyle(seg, isDark)}>
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
  style: StyleProp<TextStyle>;
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
              <Text key={`seg-${segIdx}`} style={segmentStyle(seg, isDark)}>
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
  chorusLines,
  stanzaMarks,
  chorusMarks,
  isDark,
  onHymnLongPress,
  onBlockDoubleTap,
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
  // text and card, all of them stanza 0.
  const stanzaKey = `s-${item.verseNumber}`;
  const chorusKey = `c-${item.verseNumber}`;
  const stanzaSelectable = useCallback(
    (instance: unknown) => onSelectableRef(stanzaKey, item.verseNumber, stanzaText, instance),
    [onSelectableRef, stanzaKey, item.verseNumber, stanzaText],
  );
  const chorusSelectable = useCallback(
    (instance: unknown) => onSelectableRef(chorusKey, 0, chorusText, instance),
    [onSelectableRef, chorusKey, chorusText],
  );
  const stanzaBlockRef = useCallback(
    (instance: View | null) => onBlockRef(stanzaKey, instance),
    [onBlockRef, stanzaKey],
  );
  const chorusBlockRef = useCallback(
    (instance: View | null) => onBlockRef(chorusKey, instance),
    [onBlockRef, chorusKey],
  );
  const longPress = nativeSelection ? undefined : onHymnLongPress;

  // Same double-tap detection as the Bible reader's verses. The chorus has its
  // own, as stanza 0, so it can carry a note too.
  const lastTapRef = useRef(0);
  const lastChorusTapRef = useRef(0);
  const doubleTap = (ref: React.MutableRefObject<number>, block: string, stanza: number, text: string) => {
    const now = Date.now();
    if (now - ref.current < DOUBLE_TAP_DELAY_MS) {
      ref.current = 0;
      onBlockDoubleTap?.(block, stanza, text);
      return;
    }
    ref.current = now;
  };
  const tapStanza = () => doubleTap(lastTapRef, stanzaKey, item.verseNumber, stanzaText);
  const tapChorus = () => doubleTap(lastChorusTapRef, chorusKey, 0, chorusText);
  // With native selection the words take their own taps (the native module
  // reports the double-taps); the number, heading and chorus label stay the
  // app's, as the card's are without it.
  const labelTaps = nativeSelection && !!onBlockDoubleTap;

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
          isDark ? styles.stanzaCardDark : styles.stanzaCardLight,
          isSelected && styles.selectedBlock,
        ]}
        onPress={nativeSelection ? undefined : tapStanza}
        onLongPress={longPress ? () => longPress(item.verseNumber, stanzaText) : undefined}
        delayLongPress={400}
        disabled={nativeSelection || (!longPress && !onBlockDoubleTap)}
      >
        {noteBracket(stanzaNote)}
        <Pressable style={styles.numberColumn} onPress={tapStanza} disabled={!labelTaps} accessible={false}>
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
        </Pressable>
        <View style={styles.hymnTextContainer}>
          {item.heading ? (
            <Text
              maxFontSizeMultiplier={1.3}
              onPress={labelTaps ? tapStanza : undefined}
              style={[...labelStyle, styles.stanzaHeading]}
            >
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
            isDark ? styles.chorusCardDark : styles.chorusCardLight,
            chorusSelected && styles.selectedBlock,
          ]}
          onPress={nativeSelection ? undefined : tapChorus}
          onLongPress={longPress ? () => longPress(0, chorusText) : undefined}
          delayLongPress={400}
          disabled={nativeSelection || (!longPress && !onBlockDoubleTap)}
        >
          {noteBracket(chorusNote)}
          <Pressable style={styles.chorusLabelRow} onPress={tapChorus} disabled={!labelTaps} accessible={false}>
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
          </Pressable>
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
  prev.chorusLines === next.chorusLines &&
  prev.stanzaMarks === next.stanzaMarks &&
  prev.chorusMarks === next.chorusMarks &&
  prev.isDark === next.isDark &&
  prev.onHymnLongPress === next.onHymnLongPress &&
  prev.onBlockDoubleTap === next.onBlockDoubleTap &&
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

  // --- The sheet opens on a double-tap, for the card tapped: a copy of the
  // chorus other than the first is the one tinted and kept in view. ---
  const rootRef = useRef<View>(null);
  const isScrollingRef = useRef(false);
  const [chorusBlock, setChorusBlock] = useState<string | null>(null);
  const openSheet = useCallback(
    (block: string, stanza: number, text: string) => {
      if (stanza === 0) setChorusBlock(block);
      onHymnDoubleTap?.(stanza, text);
    },
    [onHymnDoubleTap],
  );
  const firstStanzaNumber = hymnStanzas[0]?.verseNumber;
  const selectedBlock =
    selectedStanza == null
      ? null
      : selectedStanza !== 0
        ? `s-${selectedStanza}`
        : chorusBlock ?? `c-${firstStanzaNumber}`;

  // --- The highlight bubble over a native selection, as in BibleReaderView:
  // each stanza's text by its React tag, so an event leads back to the stanza
  // and the bubble can be placed by it. ---
  const {bubble, register, forgetPlace, dismiss} = useSelectionBubble<StanzaText>({
    enabled: nativeSelection,
    rootRef,
    // A stanza's selection as offsets into the whole hymn text.
    toRange: ({data}, selection) => {
      const span = verseSpans.find(s => s.verseNumber === data.stanza);
      if (!span) return null;
      const start = span.start + Math.max(0, selection.start);
      const end = Math.min(span.end, span.start + selection.end);
      return end > start ? {start, end} : null;
    },
    // A double-tap opens the stanza's sheet, as a verse's in the Bible.
    onDoubleTap: ({key, data}) => {
      if (isScrollingRef.current) return;
      clearSelection();
      openSheet(key, data.stanza, data.text);
    },
  });

  // iOS reports each text's lines after layout, for the Bible's brackets;
  // nothing here reads them, so the stanzas' are switched off.
  const quietTags = useRef(new Map<string, number>());
  const onSelectableRef = useCallback(
    (blockKey: string, stanza: number, text: string, instance: unknown) => {
      const old = quietTags.current.get(blockKey);
      if (old != null) {
        skipLines(old, false);
        quietTags.current.delete(blockKey);
      }
      const tag = register(blockKey, instance, {stanza, text});
      if (tag != null) {
        skipLines(tag, true);
        quietTags.current.set(blockKey, tag);
      }
    },
    [register],
  );

  // --- The stanza the action sheet is for: kept above the sheet. ---
  const {height: windowHeight} = useWindowDimensions();
  const blockRefs = useRef(new Map<string, View>());
  const onBlockRef = useCallback((block: string, instance: View | null) => {
    if (instance) blockRefs.current.set(block, instance);
    else blockRefs.current.delete(block);
  }, []);
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);
  const contentHeight = useRef(0);
  const pendingReveal = useRef(false);
  const revealContext = useRef({sheetHeight, selectedBlock, windowHeight});
  revealContext.current = {sheetHeight, selectedBlock, windowHeight};

  // Just far enough: the stanza right above the sheet, or at the top when it
  // was above the view or is too long to fit. Until the room under the last
  // stanza is laid out it stays pending, and the size change tries again.
  const revealStanza = useCallback(() => {
    const {sheetHeight: covered, selectedBlock: key, windowHeight: screen} = revealContext.current;
    const block = key != null ? blockRefs.current.get(key) : undefined;
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
        forgetPlace();
        listRef.current?.scrollToOffset({offset: target, animated: true});
      });
    });
  }, [forgetPlace]);

  const {sheetRoom, onScrollEnd: noteScrollEnd} = useSheetRoom(sheetHeight, scrollY, viewportHeight, contentHeight);

  // After the room's: the stanza is measured once the sheet's room is set.
  useLayoutEffect(() => {
    pendingReveal.current = sheetHeight > 0 && selectedBlock != null;
    const frame = requestAnimationFrame(revealStanza);
    return () => cancelAnimationFrame(frame);
  }, [sheetHeight, selectedBlock, revealStanza]);

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
      // The stanzas may have moved: the bubble's measured place no longer holds.
      forgetPlace();
      revealStanza();
    },
    [forgetPlace, revealStanza],
  );

  // Only to a stanza the list still holds: the hymn can change between
  // scheduling a scroll and running it, and scrollToIndex past the end is a
  // fatal crash (the 1.4.2 Bible reader's "scrollToIndex out of range").
  const scrollToStanza = useCallback((index: number) => {
    const list = listRef.current;
    if (list && index >= 0 && index < (list.props.data?.length ?? 0)) {
      forgetPlace();
      list.scrollToIndex({index, viewPosition: 0, animated: true});
    }
  }, [forgetPlace]);

  // Brings the bubble to the top of the reader, above where the keyboard
  // rises. The chorus bubble sits after the first stanza; the whole-hymn one
  // in the header.
  const scrollBubbleToTop = useCallback(() => {
    if (noteBubbleStanza == null) return;
    setTimeout(() => {
      if (noteBubbleStanza === 'whole') {
        forgetPlace();
        listRef.current?.scrollToOffset({offset: 0, animated: true});
        return;
      }
      scrollToStanza(
        noteBubbleStanza === 0 ? 0 : hymnStanzas.findIndex(s => s.verseNumber === noteBubbleStanza),
      );
    }, 120);
  }, [noteBubbleStanza, hymnStanzas, scrollToStanza, forgetPlace]);

  useEffect(() => {
    scrollBubbleToTop();
  }, [scrollBubbleToTop]);
  useEffect(() => {
    if (keyboardHeight > 0) scrollBubbleToTop();
  }, [keyboardHeight, scrollBubbleToTop]);

  const noteBubbleElement =
    noteBubbleStanza != null && renderNoteBubble ? renderNoteBubble(scrollBubbleToTop) : null;

  const keyExtractor = useCallback((item: HymnStanza) => item.verseNumber.toString(), []);

  const renderItem = useCallback(
    ({item}: {item: HymnStanza}) => (
      <HymnStanzaItem
        item={item}
        fontScale={fontScale}
        readerText={theme.colors.readerText}
        labelColor={theme.colors.textSecondary}
        verseNumberColor={theme.colors.verseNumber}
        chorusLines={chorusLines}
        stanzaMarks={marksByVerseNumber[item.verseNumber] ?? EMPTY_MARKS}
        chorusMarks={marksByVerseNumber[0] ?? EMPTY_MARKS}
        isDark={theme.isDark}
        onHymnLongPress={onHymnLongPress}
        onBlockDoubleTap={onHymnDoubleTap ? openSheet : undefined}
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
        isSelected={selectedBlock === `s-${item.verseNumber}`}
        // The chorus is marked once, on the copy the sheet was opened from.
        chorusSelected={selectedBlock === `c-${item.verseNumber}`}
      />
    ),
    [
      nativeSelection,
      onSelectableRef,
      onBlockRef,
      selectedBlock,
      openSheet,
      noteBubbleStanza,
      noteBubbleElement,
      firstStanzaNumber,
      fontScale,
      theme.colors.readerText,
      theme.colors.textSecondary,
      theme.colors.verseNumber,
      theme.colors.accentBlue,
      theme.isDark,
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
      // Sizes changed (rotation, keyboard): measure again for the bubble.
      onLayout={forgetPlace}
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
      {bubble && onMarksChange ? (
        <SelectionHighlightBubble
          placement={bubble}
          marks={marks ?? EMPTY_MARKS}
          onMarksChange={onMarksChange}
          onDone={dismiss}
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
  stanzaCardLight: {backgroundColor: 'rgba(0, 0, 0, 0.01)'},
  stanzaCardDark: {backgroundColor: 'rgba(255, 255, 255, 0.015)'},
  chorusCardLight: {backgroundColor: 'rgba(0, 0, 0, 0.015)'},
  chorusCardDark: {backgroundColor: 'rgba(255, 255, 255, 0.02)'},
  // The card the action sheet is for, as a Bible verse is.
  selectedBlock: {backgroundColor: SELECTED_STANZA_BACKGROUND},
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
