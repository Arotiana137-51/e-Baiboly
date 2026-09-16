import React, {useCallback, useMemo, useRef} from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
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
import {dimHighlightForDarkMode, dimHighlightForLightMode} from '../utils/colorUtils';

const DOUBLE_TAP_DELAY_MS = 300;
const EMPTY_MARKS: ChapterMark[] = [];

// Hymn-specific spacing configuration
const HYMN_LINE_HEIGHT_MULTIPLIER = 1.7; // More relaxed spacing for hymns
const HYMN_STANZA_MARGIN = 20;
const HYMN_BASE_BOTTOM_PADDING = 28;

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  const parsed =
    normalized.length === 3
      ? normalized
          .split('')
          .map(ch => ch + ch)
          .join('')
      : normalized;

  const int = parseInt(parsed, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

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
  onNotePress?: (stanzaNumber: number) => void;
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
  onNotePress?: (stanzaNumber: number) => void;
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
  onNotePress,
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
  const hasNote = stanzaMarks.some(m => m.style === 'note');

  // Same double-tap detection as the Bible reader's verses.
  const lastTapRef = useRef(0);
  const handlePress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY_MS) {
      lastTapRef.current = 0;
      onHymnDoubleTap?.(item.verseNumber, stanzaText);
      return;
    }
    lastTapRef.current = now;
  };

  return (
    <View style={styles.stanzaBlock}>
      <Pressable
        style={[styles.hymnStanza, {backgroundColor: stanzaCardBackground}]}
        onPress={handlePress}
        onLongPress={() => onHymnLongPress?.(item.verseNumber, stanzaText)}
        delayLongPress={400}
        disabled={!onHymnLongPress && !onHymnDoubleTap}
      >
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
          {hasNote ? (
            <Text
              onPress={e => {
                e.stopPropagation?.();
                onNotePress?.(item.verseNumber);
              }}
              suppressHighlighting
            >
              {' ✎'}
            </Text>
          ) : null}
        </Text>
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
        </View>
      </Pressable>

      {chorusLines.length > 0 ? (
        <View style={[styles.chorusBlock, {backgroundColor: chorusBackground}]}>
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
          <View style={styles.chorusTextContainer}>
            <MarkedLines
              text={chorusText}
              marks={chorusMarks}
              isDark={isDark}
              style={[...lineStyle, styles.chorusLine]}
              keyPrefix={`chorus-${item.verseNumber}`}
            />
          </View>
        </View>
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
  prev.onNotePress === next.onNotePress
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
  onNotePress,
}) => {
  const { theme } = useTheme();
  const { isLowEndMode } = useLowEndMode();
  const insets = useSafeAreaInsets();

  const hasTitle = typeof hymnTitle === 'string' && hymnTitle.trim().length > 0;
  const headerNote = hymnNote?.trim() || '';
  const headerAuthors = (hymnAuthors ?? []).map(a => a.trim()).filter(Boolean).join(', ');
  const hasHeader = hasTitle || headerNote.length > 0 || headerAuthors.length > 0;

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
        onNotePress={onNotePress}
      />
    ),
    [
      fontScale,
      theme.colors.readerText,
      theme.colors.textSecondary,
      theme.colors.verseNumber,
      theme.isDark,
      stanzaCardBackground,
      chorusBackground,
      chorusLines,
      marksByVerseNumber,
      onHymnLongPress,
      onHymnDoubleTap,
      onNotePress,
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
      data={hymnStanzas}
      keyExtractor={keyExtractor}
      contentContainerStyle={{paddingBottom: HYMN_BASE_BOTTOM_PADDING + bottomScrollSpacerAdjusted}}
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
    marginBottom: 6,
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
