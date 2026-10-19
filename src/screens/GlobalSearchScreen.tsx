import React, { useEffect, useLayoutEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { BibleSearchResult } from '../hooks/useBibleSearch';
import { HymnSearchResult } from '../hooks/useHymnSearch';
import { useTheme } from '../contexts/ThemeContext';
import { RootStackParamList } from '../navigation/RootNavigator';
import { getBibleBookShortName } from '../utils/bibleBookNames';
import { hexToRgba } from '../utils/colorUtils';
import { responsiveFontSize } from '../constants/Typography';
import {
  normalizeForHighlight,
  findHighlightRanges,
  segmentTextForHighlight,
} from '../utils/searchHighlight';
import { t } from '../i18n/strings';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Simple View-drawn magnifier — no icon lib.
const MagnifyingGlass = ({ color, size = 18 }: { color: string; size?: number }) => (
  <View style={{ width: size, height: size }}>
    <View
      style={{
        position: 'absolute',
        borderWidth: 2,
        borderRadius: 50,
        borderColor: color,
        width: size * 0.8,
        height: size * 0.8,
        top: 0,
        left: 0,
      }}
    />
    <View
      style={{
        position: 'absolute',
        backgroundColor: color,
        width: size * 0.3,
        height: size * 0.15,
        bottom: -size * 0.05,
        right: -size * 0.05,
        borderRadius: 2,
        transform: [{ rotate: '45deg' }],
      }}
    />
  </View>
);

// One flat, virtualized list standing in for a nested accordion: Baiboly /
// Fihirana totals -> Testament / hymn category -> genre / theme (where we
// have one) -> individual book or hymn. A FlatList of typed rows is simpler
// than nesting SectionLists, and lets each level's expand state
// independently hide/show the next.
type FlatRow =
  | { kind: 'topHeader'; id: 'baiboly' | 'fihirana'; title: string; count: number }
  | { kind: 'groupHeader'; id: string; title: string; count: number; depth: 1 | 2 }
  | { kind: 'bible'; data: BibleSearchResult; depth: 2 | 3 }
  | { kind: 'hymn'; data: HymnSearchResult; depth: 2 | 3 };

// Groups items by key, in the given display order, appending any leftover
// keys (not in `order`) alphabetically at the end. Shared by every level of
// the accordion below — testament, Bible genre, hymn category, FFPM theme.
const groupInOrder = <T,>(items: T[], keyFor: (item: T) => string, order: string[]): Array<[string, T[]]> => {
  const grouped = new Map<string, T[]>();
  items.forEach(item => {
    const key = keyFor(item);
    (grouped.get(key) ?? grouped.set(key, []).get(key)!).push(item);
  });
  const result: Array<[string, T[]]> = [];
  order.forEach(key => {
    const g = grouped.get(key);
    if (g?.length) result.push([key, g]);
  });
  Array.from(grouped.keys())
    .filter(key => !order.includes(key))
    .sort()
    .forEach(key => result.push([key, grouped.get(key)!]));
  return result;
};

const HYMN_CATEGORY_TITLE = (categoryRaw: string) => {
  const c = (categoryRaw || '').trim().toLowerCase();
  if (c === 'ffpm' || c === 'ffpm hymns') return 'FFPM';
  if (c === 'fifo') return 'F. Fifohazana';
  if (c === 'ff') return 'F. Fanampiny';
  if (c === 'antema') return 'Antema';
  return categoryRaw || 'Fihirana';
};

const HYMN_ORDER = ['FFPM', 'F. Fifohazana', 'F. Fanampiny', 'Antema'];

// Genre divisions by book ID, verified against Books.id in
// scripts/source-data/bible/Yaml_Zo_Source/bible_book.yaml (book_number 1-66)
// and the Malagasy-Wikipedia articles for Testamenta Taloha/Vaovao.
const BIBLE_GENRE_RANGES: Array<{ title: string; min: number; max: number }> = [
  { title: 'Pentateoka', min: 1, max: 5 },
  { title: 'Boky ara-tantara', min: 6, max: 17 },
  { title: 'Bokim-pahendrena', min: 18, max: 22 },
  { title: 'Mpaminany lehibe', min: 23, max: 27 },
  { title: 'Mpaminany madinika', min: 28, max: 39 },
  { title: 'Filazantsara', min: 40, max: 43 },
  { title: "Asan'ny Apostoly", min: 44, max: 44 },
  { title: "Epistily nosoratan'i Paoly", min: 45, max: 57 },
  { title: 'Taratasy Ankapobeny', min: 58, max: 65 },
  { title: 'Apokalipsy', min: 66, max: 66 },
];
const BIBLE_GENRE_ORDER = BIBLE_GENRE_RANGES.map(g => g.title);
const bibleGenreFor = (bookId: number): string =>
  BIBLE_GENRE_RANGES.find(g => bookId >= g.min && bookId <= g.max)?.title ?? 'Hafa';

// FFPM theme sections, verified against fihirana.org (cross-checked hymn
// #11/#12/#20's lyrics against our own data to confirm the numbering lines
// up). Only covers hymns 1-216 — past that point fihirana.org's own category
// pages show themes interleaved rather than in clean number blocks, so
// there's no reliable range for the rest; those hymns stay unthemed, same as
// before.
const FFPM_THEME_RANGES: Array<{ title: string; min: number; max: number }> = [
  { title: 'Andriamanitra Ray', min: 1, max: 36 },
  { title: 'Jesosy Kristy Tompo', min: 37, max: 173 },
  { title: 'Ny Fanahy Masina', min: 174, max: 189 },
  { title: 'Ny telo izay iray', min: 190, max: 204 },
  { title: 'Ny soratra masina', min: 205, max: 216 },
];
const FFPM_THEME_ORDER = FFPM_THEME_RANGES.map(g => g.title);
const ffpmThemeFor = (hymnNumber: number): string | null =>
  FFPM_THEME_RANGES.find(g => hymnNumber >= g.min && hymnNumber <= g.max)?.title ?? null;

export const __test__groupInOrder = groupInOrder;
export const __test__bibleGenreFor = bibleGenreFor;
export const __test__ffpmThemeFor = ffpmThemeFor;

const clamp = (value: number, min: number, max: number) => Math.round(Math.min(Math.max(value, min), max));

const GlobalSearchScreen = () => {
  const navigation = useNavigation<NavProp>();
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  // The search box auto-focuses, so the keyboard is very often up while
  // these tiles are visible — track its height so tile sizing responds to
  // the space actually left over, not just the device's full screen height.
  const keyboardHeight = useKeyboardHeight();

  const { search, isLoading } = useGlobalSearch();
  const [query, setQuery] = useState('');
  const [bible, setBible] = useState<BibleSearchResult[]>([]);
  const [hymns, setHymns] = useState<HymnSearchResult[]>([]);

  // Estimating "available height" from window/keyboard/chrome math never
  // actually matched the real card (header height, safe-area insets, the
  // search bar's real rendered height none of it was accounted for) — so
  // instead measure the tile's real rendered height via onLayout and derive
  // every font size AND the spacing between them from that, proportionally.
  // That keeps text and gaps in the same ratio to the card no matter what
  // the card's actual size ends up being (keyboard up/down, device, tablet).
  const [tileHeight, setTileHeight] = useState(0);
  const onTileLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    setTileHeight(e.nativeEvent.layout.height);
  }, []);
  const bigTileSizes = useMemo(() => {
    // Before the first layout pass, fall back to a plausible guess so the
    // very first paint isn't shrunk to the clamp floor.
    const h = tileHeight || 220;
    const widthCeiling = (base: number) => responsiveFontSize(base, 1, windowWidth);
    return {
      title: clamp(h * 0.16, 14, widthCeiling(28)),
      titleMargin: clamp(h * 0.06, 4, 16),
      count: clamp(h * 0.12, 13, widthCeiling(22)),
      countPillPaddingH: clamp(h * 0.07, 8, 20),
      countPillPaddingV: clamp(h * 0.03, 3, 10),
      caption: clamp(h * 0.08, 11, widthCeiling(15)),
      captionMargin: clamp(h * 0.05, 4, 12),
      chevron: clamp(h * 0.11, 13, widthCeiling(24)),
      chevronMargin: clamp(h * 0.06, 6, 14),
    };
  }, [tileHeight, windowWidth]);
  // Accordion state: every level (the two top totals, and each hymn category
  // once Fihirana is open) starts COLLAPSED, so a broad query that matches
  // dozens of books/hymns shows just two rows first instead of a long scroll.
  // Keyed by header id, so an expand/collapse choice carries over as the
  // user refines their query.
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const toggleSection = useCallback((id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Two ways to read the same results, because testers split on it. The
  // toggle governs exactly ONE level — the innermost grouping:
  //   Tsotra:          Baiboly -> Testamenta -> book
  //                    Fihirana -> hymn book -> hymn
  //   Isan-tsokajiny:  Baiboly -> Testamenta -> genre -> book
  //                    Fihirana -> hymn book -> FFPM theme -> hymn
  // The Testamenta split and the hymn-book classification stay in BOTH — only
  // the genre/theme layer is opt-in. Switching never changes what matched or
  // any count, just how many taps deep a result sits. Tsotra is the default.
  const [categorized, setCategorized] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setBible([]);
      setHymns([]);
      return;
    }
    // A search still running when the query changes must not land after the
    // newer one: clearing the timer can't stop it, so its results are dropped.
    let cancelled = false;
    const id = setTimeout(async () => {
      const res = await search(query);
      if (cancelled) return;
      setBible(res.bible);
      setHymns(res.hymns);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, search]);

  // The toggle lives in the native header next to the "Fikarohana" title, so
  // neither label repeats that word. White-on-teal segmented control: the
  // header is navBackground with white text (see RootNavigator's
  // headerOptions), so the selected half inverts to a white pill rather than
  // using an accent color that would blend into the bar.
  const headerRight = useCallback(
    () => (
      <View style={styles.modeToggle}>
        {([false, true] as const).map(isCategorized => {
          const selected = categorized === isCategorized;
          return (
            <Pressable
              key={String(isCategorized)}
              onPress={() => setCategorized(isCategorized)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              style={[styles.modeOption, selected && styles.modeOptionSelected]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.modeOptionText,
                  { color: selected ? theme.colors.navBackground : '#FFFFFF' },
                ]}
              >
                {t(isCategorized ? 'search.categorized' : 'search.simple')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ),
    [categorized, theme.colors.navBackground],
  );

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight });
  }, [navigation, headerRight]);

  const normalizedHighlight = useMemo(() => normalizeForHighlight(query), [query]);

  const highlight = useCallback(
    (text: string, baseColor: string) => {
      if (!text) return null;
      if (!normalizedHighlight) return <Text style={{ color: baseColor }}>{text}</Text>;
      const ranges = findHighlightRanges(text, normalizedHighlight);
      const segments = segmentTextForHighlight(text, ranges);
      return segments.map((seg, i) => (
        <Text
          key={i}
          style={seg.match ? { color: theme.colors.accentBlue, fontWeight: '600' } : { color: baseColor }}
        >
          {seg.text}
        </Text>
      ));
    },
    [normalizedHighlight, theme.colors.accentBlue],
  );

  // Flatten into the accordion: Baiboly / Fihirana totals, then Testament or
  // hymn category with their own totals, then — where we actually have a
  // verified breakdown (Bible genre always; FFPM theme only for hymns 1-216)
  // — a further genre/theme level, then finally the individual books/hymns.
  // A collapsed header's children are simply never pushed — no separate
  // "visible" pass needed like a SectionList would require.
  const rows = useMemo<FlatRow[]>(() => {
    const out: FlatRow[] = [];

    if (bible.length) {
      const totalVerseCount = bible.reduce((sum, b) => sum + b.verseCount, 0);
      out.push({ kind: 'topHeader', id: 'baiboly', title: t('tabs.bible'), count: totalVerseCount });
      if (expandedSections.baiboly) {
        const testamentGroups = groupInOrder(bible, b => (b.testament === 'new' ? 'new' : 'old'), ['old', 'new']);
        testamentGroups.forEach(([testament, testamentItems]) => {
          const testamentId = `testament:${testament}`;
          const testamentCount = testamentItems.reduce((sum, b) => sum + b.verseCount, 0);
          const testamentTitle = testament === 'old' ? t('bible.oldTestament') : t('bible.newTestament');
          out.push({ kind: 'groupHeader', id: testamentId, title: testamentTitle, count: testamentCount, depth: 1 });
          if (!expandedSections[testamentId]) return;

          // Tsotra: books straight under the testament. The genre level
          // (Pentateoka, Bokim-pahendrena, Mpaminany...) is the ONLY thing
          // the toggle adds — the testament split stays either way.
          if (!categorized) {
            testamentItems.forEach(data => out.push({ kind: 'bible', data, depth: 2 }));
            return;
          }

          const genreGroups = groupInOrder(testamentItems, b => bibleGenreFor(b.bookId), BIBLE_GENRE_ORDER);
          genreGroups.forEach(([genreTitle, genreItems]) => {
            const genreId = `${testamentId}:${genreTitle}`;
            const genreCount = genreItems.reduce((sum, b) => sum + b.verseCount, 0);
            out.push({ kind: 'groupHeader', id: genreId, title: genreTitle, count: genreCount, depth: 2 });
            if (expandedSections[genreId]) {
              genreItems.forEach(data => out.push({ kind: 'bible', data, depth: 3 }));
            }
          });
        });
      }
    }

    if (hymns.length) {
      out.push({ kind: 'topHeader', id: 'fihirana', title: t('tabs.hymns'), count: hymns.length });
      if (expandedSections.fihirana) {
        const categoryGroups = groupInOrder(hymns, h => HYMN_CATEGORY_TITLE(h.category), HYMN_ORDER);
        categoryGroups.forEach(([categoryTitle, categoryItems]) => {
          const categoryId = `category:${categoryTitle}`;
          out.push({ kind: 'groupHeader', id: categoryId, title: categoryTitle, count: categoryItems.length, depth: 1 });
          if (!expandedSections[categoryId]) return;

          // Hymns straight under their hymn book — in Tsotra always, and in
          // Isan-tsokajiny for every category except FFPM, the only one with
          // a verified theme breakdown. The hymn-book split itself stays in
          // both modes; only the theme level is the toggle's business.
          if (!categorized || categoryTitle !== 'FFPM') {
            categoryItems.forEach(data => out.push({ kind: 'hymn', data, depth: 2 }));
            return;
          }

          // FFPM only: theme the hymns we have a verified range for. The rest
          // (past #216 — no reliable range, see FFPM_THEME_RANGES) get their
          // own "Hafa" group instead of appearing as bare, shallower-indented
          // cards — same fallback label bibleGenreFor uses, and it keeps
          // every hymn nested at a consistent depth under FFPM.
          const themed = categoryItems.filter(h => ffpmThemeFor(h.number) !== null);
          const unthemed = categoryItems.filter(h => ffpmThemeFor(h.number) === null);
          const themeGroups = groupInOrder(themed, h => ffpmThemeFor(h.number)!, FFPM_THEME_ORDER);
          themeGroups.forEach(([themeTitle, themeItems]) => {
            const themeId = `${categoryId}:${themeTitle}`;
            out.push({ kind: 'groupHeader', id: themeId, title: themeTitle, count: themeItems.length, depth: 2 });
            if (expandedSections[themeId]) {
              themeItems.forEach(data => out.push({ kind: 'hymn', data, depth: 3 }));
            }
          });
          if (unthemed.length) {
            const otherId = `${categoryId}:Hafa`;
            out.push({ kind: 'groupHeader', id: otherId, title: 'Hafa', count: unthemed.length, depth: 2 });
            if (expandedSections[otherId]) {
              unthemed.forEach(data => out.push({ kind: 'hymn', data, depth: 3 }));
            }
          }
        });
      }
    }

    return out;
  }, [bible, hymns, expandedSections, categorized]);

  const openBible = useCallback(
    (item: BibleSearchResult) => {
      navigation.navigate('VerseList', {
        bookId: item.bookId,
        bookName: item.bookName,
        query,
      });
    },
    [navigation, query],
  );

  const openHymn = useCallback(
    (item: HymnSearchResult) => {
      navigation.navigate('Home', { mode: 'hymnal', selectedHymnId: item.id });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: FlatRow }) => {
      if (item.kind === 'topHeader' || item.kind === 'groupHeader') {
        const isExpanded = !!expandedSections[item.id];
        const isTop = item.kind === 'topHeader';
        const textStyle = isTop
          ? styles.topHeaderText
          : item.depth === 1
            ? styles.groupHeaderDepth1Text
            : styles.groupHeaderDepth2Text;
        const headerColor = isTop ? theme.colors.textPrimary : theme.colors.textSecondary;
        return (
          <Pressable
            onPress={() => toggleSection(item.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ expanded: isExpanded }}
            accessibilityLabel={`${item.title}, ${item.count}`}
            style={({ pressed }) => [
              styles.sectionHeader,
              isTop && styles.topHeader,
              item.kind === 'groupHeader' && item.depth === 1 && styles.groupHeaderDepth1,
              item.kind === 'groupHeader' && item.depth === 2 && styles.groupHeaderDepth2,
              { backgroundColor: isTop ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary },
              pressed && { backgroundColor: theme.colors.accentBlue + '1A' },
            ]}
          >
            {/* Title and count are two separate Text nodes, not one string,
                so a long title never truncates the count off-screen — matters
                a lot once someone's cranked their system font size up. */}
            <Text style={[textStyle, { color: headerColor, flexShrink: 1 }]} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.headerRightGroup}>
              <View style={[styles.countPill, { backgroundColor: theme.colors.accentBlue + '1A' }]}>
                <Text style={[styles.countPillText, { color: theme.colors.accentBlue }]}>{item.count}</Text>
              </View>
              <Text style={[styles.sectionChevron, { color: theme.colors.textSecondary }]}>
                {isExpanded ? '▾' : '▸'}
              </Text>
            </View>
          </Pressable>
        );
      }
      if (item.kind === 'bible') {
        const b = item.data;
        const bibleCountLabel = t('search.resultCount', { count: b.verseCount });
        return (
          <Pressable
            style={({ pressed }) => [
              styles.card,
              item.depth === 2 ? styles.cardIndentDepth2 : styles.cardIndentDepth3,
              { backgroundColor: theme.colors.backgroundSecondary },
              pressed && { backgroundColor: theme.colors.accentBlue + '1A' },
            ]}
            android_ripple={{ color: theme.colors.accentBlue + '20' }}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`${getBibleBookShortName(b.bookName, b.bookId)}, ${bibleCountLabel}`}
            onPress={() => openBible(b)}
          >
            <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
              {getBibleBookShortName(b.bookName, b.bookId)}
            </Text>
            <Text style={[styles.cardCount, { color: theme.colors.accentBlue }]}>
              {bibleCountLabel}
            </Text>
            {b.matchedText ? (
              <Text style={[styles.hymnSnippet, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                {b.matchedChapter && b.matchedVerseNumber ? `${b.matchedChapter}:${b.matchedVerseNumber} — ` : ''}
                {highlight(b.matchedText, theme.colors.textSecondary)}
              </Text>
            ) : null}
          </Pressable>
        );
      }
      const h = item.data;
      return (
        <Pressable
          style={({ pressed }) => [
            styles.card,
            item.depth === 2 ? styles.cardIndentDepth2 : styles.cardIndentDepth3,
            { backgroundColor: theme.colors.backgroundSecondary },
            pressed && { backgroundColor: theme.colors.accentBlue + '1A' },
          ]}
          android_ripple={{ color: theme.colors.accentBlue + '20' }}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`${h.number}, ${h.title}`}
          onPress={() => openHymn(h)}
        >
          <View style={styles.hymnHeader}>
            <Text style={[styles.hymnBadge, { backgroundColor: theme.colors.accentBlue }]}>{h.number}</Text>
            <Text style={[styles.cardTitle, { color: theme.colors.textPrimary, flex: 1 }]} numberOfLines={2}>
              {h.title ? highlight(h.title, theme.colors.textPrimary) : h.title}
            </Text>
          </View>
          {h.matchedVerse ? (
            <Text style={[styles.hymnSnippet, { color: theme.colors.textSecondary }]} numberOfLines={3}>
              {highlight(h.matchedVerse, theme.colors.textSecondary)}
            </Text>
          ) : null}
        </Pressable>
      );
    },
    [theme.colors, openBible, openHymn, highlight, expandedSections, toggleSection],
  );

  const hasResults = bible.length > 0 || hymns.length > 0;

  // The very first look at results (nothing unfolded yet) is just 1-2 thin
  // rows over an otherwise empty screen. Blow those up into big tiles that
  // use the free space instead — the instant either one is tapped, this
  // reverts to the normal compact accordion below, unchanged.
  const topHeaderRows = useMemo(
    () => rows.filter((r): r is Extract<FlatRow, { kind: 'topHeader' }> => r.kind === 'topHeader'),
    [rows],
  );
  const allTopCollapsed = topHeaderRows.length > 0 && topHeaderRows.every(r => !expandedSections[r.id]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.backgroundPrimary }]}>
      <View style={styles.searchBarWrap}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.divider },
          ]}
        >
          <MagnifyingGlass color={theme.colors.textSecondary} size={18} />
          <TextInput
            style={[styles.input, { color: theme.colors.textPrimary }]}
            placeholder={t('search.placeholderBible')}
            // Faded further than plain textSecondary (used solid elsewhere,
            // e.g. the search icon) — a placeholder should read as a hint,
            // not as regular secondary text.
            placeholderTextColor={hexToRgba(theme.colors.textSecondary, 0.5)}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        </View>
      </View>


      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.accentBlue} />
        </View>
      ) : hasResults && allTopCollapsed ? (
        // marginBottom ties the card area itself to the tracked keyboard
        // height (see the keyboardWillShow/DidShow listener above) — without
        // it the tiles keep sizing themselves for the full screen and the
        // keyboard just overlaps/covers whatever ends up at the bottom.
        <View style={[styles.bigTileContainer, { marginBottom: keyboardHeight }]}>
          {topHeaderRows.map(r => (
            <Pressable
              key={r.id}
              onPress={() => toggleSection(r.id)}
              onLayout={onTileLayout}
              accessibilityRole="button"
              accessibilityLabel={`${r.title}, ${r.count}`}
              style={({ pressed }) => [
                styles.bigTile,
                { flex: 2, backgroundColor: theme.colors.backgroundSecondary },
                pressed && { backgroundColor: theme.colors.accentBlue + '1A' },
              ]}
            >
              <Text
                style={[
                  styles.bigTileTitle,
                  { fontSize: bigTileSizes.title, marginBottom: bigTileSizes.titleMargin, color: theme.colors.textPrimary },
                ]}
              >
                {r.title}
              </Text>
              <View
                style={[
                  styles.countPill,
                  styles.bigTileCountPill,
                  {
                    paddingHorizontal: bigTileSizes.countPillPaddingH,
                    paddingVertical: bigTileSizes.countPillPaddingV,
                    backgroundColor: theme.colors.accentBlue + '1A',
                  },
                ]}
              >
                <Text
                  style={[styles.countPillText, { fontSize: bigTileSizes.count, color: theme.colors.accentBlue }]}
                >
                  {r.count}
                </Text>
              </View>
              <Text
                style={[
                  styles.bigTileCaption,
                  { fontSize: bigTileSizes.caption, marginTop: bigTileSizes.captionMargin, color: theme.colors.accentBlue },
                ]}
              >
                teny hita
              </Text>
              {/* Still the same dropdown affordance as the compact headers —
                  always the "closed" glyph here since a tile only renders
                  while its section is collapsed. */}
              <Text
                style={[
                  styles.sectionChevron,
                  {
                    fontSize: bigTileSizes.chevron,
                    marginLeft: 0,
                    marginTop: bigTileSizes.chevronMargin,
                    color: theme.colors.textSecondary,
                  },
                ]}
              >
                ▾
              </Text>
            </Pressable>
          ))}
          {/* Soaks up exactly the third of the space each tile above gave
              back — flex:2 per tile + flex:N spacer keeps every tile at 2/3
              of what it'd be if they filled the container entirely. */}
          <View style={{ flex: topHeaderRows.length }} />
        </View>
      ) : hasResults ? (
        <FlatList
          data={rows}
          keyExtractor={(item, index) => {
            if (item.kind === 'topHeader' || item.kind === 'groupHeader') return `h:${item.id}`;
            return item.kind === 'bible' ? `b:${item.data.bookId}:${index}` : `hy:${item.data.id}:${index}`;
          }}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
        />
      ) : query.trim() ? (
        <View style={styles.loading}>
          <Text style={{ color: theme.colors.textSecondary }}>{t('search.noResultsBible')}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBarWrap: { padding: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: { flex: 1, marginLeft: 10, fontSize: 16, paddingVertical: 2 },
  // Sits in the header bar, so it has to stay narrow enough to leave the
  // "Fikarohana" title room — hence the small type and tight padding, with
  // hitSlop on each half making up the tap area the visual size gives up.
  modeToggle: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    padding: 2,
    marginRight: 4,
  },
  modeOption: {
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOptionSelected: { backgroundColor: '#FFFFFF' },
  modeOptionText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2, textAlign: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  listContent: { paddingBottom: 24 },
  bigTileContainer: { flex: 1, padding: 12, gap: 12 },
  bigTile: {
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  bigTileTitle: { fontWeight: '700', textAlign: 'center' },
  bigTileCountPill: { borderRadius: 14, marginLeft: 0 },
  bigTileCaption: { fontWeight: '500' },
  // Header hierarchy: the top level (Baiboly/Fihirana) reads as a real
  // section — bigger, tinted, more breathing room — and each level below it
  // steps down in size/weight/indent so depth is legible at a glance without
  // leaning on ALL-CAPS, which just hurts long Malagasy phrases. Every row is
  // at least ~48dp tall (the accessible tap-target minimum) since this app's
  // users range from young children to elderly readers with less precise,
  // less steady taps.
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topHeader: { minHeight: 56, paddingVertical: 15, marginTop: 8, borderRadius: 10, marginHorizontal: 8 },
  topHeaderText: { fontSize: 17, fontWeight: '700' },
  groupHeaderDepth1: { paddingLeft: 32 },
  groupHeaderDepth1Text: { fontSize: 15, fontWeight: '600' },
  groupHeaderDepth2: { paddingLeft: 52 },
  groupHeaderDepth2Text: { fontSize: 14, fontWeight: '500' },
  headerRightGroup: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  countPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 10 },
  countPillText: { fontSize: 13, fontWeight: '700' },
  sectionChevron: { fontSize: 18, fontWeight: '700', marginLeft: 10 },
  card: {
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
    padding: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  // Leaf rows line their left edge up with the header text of whichever
  // level they're actually nested under (depth1's 32 / depth2's 52 above).
  cardIndentDepth2: { marginLeft: 32 },
  cardIndentDepth3: { marginLeft: 52 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardCount: { fontSize: 13, marginTop: 2 },
  hymnHeader: { flexDirection: 'row', alignItems: 'center' },
  hymnBadge: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    minWidth: 28,
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 10,
    overflow: 'hidden',
  },
  hymnSnippet: { fontSize: 14, lineHeight: 20, marginTop: 8 },
});

export default GlobalSearchScreen;
