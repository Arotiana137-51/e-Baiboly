import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import { HymnVerse } from '../hooks/useHymnsData';
import { useTheme, useLowEndMode } from '../contexts/ThemeContext';
import {
  buildHymnDisplay,
  buildLineSegments,
  buildVerseLineOffsets,
  HYMN_CHORUS_LABEL,
  intersectMarksWithSpan,
  type ChapterMark,
} from '../utils/chapterMarks';
import {dimHighlightForDarkMode, dimHighlightForLightMode, hexToRgba} from '../utils/colorUtils';
import {useKeyboardHeight} from '../hooks/useKeyboardHeight';
import {noteSnippet, noteSnippetBudget, type Note} from '../types/notes';

// A note shown on a stanza: its id (to open it) and its first words (the
// preview under the text).
type StanzaNote = {id: string; snippet: string};
import {t} from '../i18n/strings';
import {NoteGlyph} from './NoteGlyph';

const DOUBLE_TAP_DELAY_MS = 300;
const EMPTY_MARKS: ChapterMark[] = [];

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
}

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
            {buildLineSegments(line, offsets[idx], marks).map((seg, segIdx) => {
              const hasHighlight = seg.marks.includes('highlight');
              return (
                <Text
                  key={`seg-${segIdx}`}
                  style={[
                    seg.marks.includes('bold') ? styles.markBold : null,
                    seg.marks.includes('italic') ? styles.markItalic : null,
                    seg.marks.includes('underline') ? styles.markUnderline : null,
                    hasHighlight && seg.highlightColor
                      ? {
                          backgroundColor: isDark
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
        style={[styles.hymnStanza, {backgroundColor: stanzaCardBackground}]}
        onPress={() => doubleTap(lastTapRef, item.verseNumber, stanzaText)}
        onLongPress={() => onHymnLongPress?.(item.verseNumber, stanzaText)}
        delayLongPress={400}
        disabled={!onHymnLongPress && !onHymnDoubleTap}
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
          <MarkedLines
            text={stanzaText}
            marks={stanzaMarks}
            isDark={isDark}
            style={lineStyle}
            keyPrefix={`stanza-${item.verseNumber}`}
          />
          {notePreview(stanzaNote)}
        </View>
      </Pressable>

      {chorusLines.length > 0 ? chorusBubble : null}
      {chorusLines.length > 0 ? (
        <Pressable
          style={[styles.chorusBlock, {backgroundColor: chorusBackground}]}
          onPress={() => doubleTap(lastChorusTapRef, 0, chorusText)}
          onLongPress={() => onHymnLongPress?.(0, chorusText)}
          delayLongPress={400}
          disabled={!onHymnLongPress && !onHymnDoubleTap}
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
            <MarkedLines
              text={chorusText}
              marks={chorusMarks}
              isDark={isDark}
              style={[...lineStyle, styles.chorusLine]}
              keyPrefix={`chorus-${item.verseNumber}`}
            />
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
  prev.chorusBubble === next.chorusBubble
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
}) => {
  const { theme } = useTheme();
  const { isLowEndMode } = useLowEndMode();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<HymnStanza>>(null);
  const keyboardHeight = useKeyboardHeight();

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

  // Marks are stored as offsets into the whole hymn text; slice them per stanza
  // (verse_number 0 = chorus) so each item only gets its own.
  const marksByVerseNumber = useMemo(() => {
    const map: Record<number, ChapterMark[]> = {};
    if (!marks?.length || hymnVerses.length === 0) return map;
    for (const span of buildHymnDisplay(hymnVerses, HYMN_CHORUS_LABEL).verseSpans) {
      const local = intersectMarksWithSpan(marks, span);
      if (local.length > 0) map[span.verseNumber] = local;
    }
    return map;
  }, [marks, hymnVerses]);

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
      />
    ),
    [
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
    <FlatList
      ref={listRef}
      data={hymnStanzas}
      keyExtractor={keyExtractor}
      contentContainerStyle={{
        paddingBottom:
          HYMN_BASE_BOTTOM_PADDING +
          bottomScrollSpacerAdjusted +
          (noteBubbleStanza != null ? keyboardHeight : 0),
      }}
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
  );
};

const styles = StyleSheet.create({
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
