import React, { useState, useMemo, useCallback, memo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import { useBibleData } from '../hooks/useBibleData';
import { useBibleSearch, BibleSearchResult } from '../hooks/useBibleSearch';
import {useTheme} from '../contexts/ThemeContext';
import {getBibleBookShortName} from '../utils/bibleBookNames';
import TutorialOverlay from './TutorialOverlay';

type SelectionStep = 'book' | 'chapter' | 'verse';

export type VerseSelection =
  | {kind: 'single'; verse: number}
  | {kind: 'range'; start: number; end: number}
  | {kind: 'whole'; verseCount: number};

interface BibleSelectionModalOptimizedProps {
  onClose: () => void;
  onBibleSelect: (
    bookId: number,
    bookName: string,
    chapter: number,
    selection: VerseSelection,
  ) => void;
  requestedStep?: SelectionStep | null;
  initialBook?: {id: number; name: string; chapters: number} | null;
  initialChapter?: number | null;
  onProgressChange?: (progress: {
    step: SelectionStep;
    selectedBook: {id: number; name: string} | null;
    selectedChapter: number | null;
  }) => void;
}

const BibleSelectionModalOptimized: React.FC<BibleSelectionModalOptimizedProps> = ({
  onClose,
  onBibleSelect,
  requestedStep = null,
  initialBook = null,
  initialChapter = null,
  onProgressChange,
}) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const { books, isLoading, getVerseCount } = useBibleData();

  // Always land on the book step. The initial book/chapter are just
  // "remembered" so the Toko/Andininy tabs in SelectionTopBar can jump
  // directly to those steps via requestedStep.
  const [currentStep, setCurrentStep] = useState<SelectionStep>('book');
  const [selectedBook, setSelectedBook] = useState<{ id: number; name: string; chapters: number } | null>(initialBook);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(
    initialBook && initialChapter != null ? initialChapter : null,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [verseCount, setVerseCount] = useState(0);
  // Range is picked on ONE grid: first tap arms the start (highlighted), second
  // tap resolves and closes immediately — same verse → single, a different verse
  // → the n–m range. No confirm step.
  const [pendingStartVerse, setPendingStartVerse] = useState<number | null>(null);

  // Content search fallback: the book-name filter above only helps when you
  // already know which book you want. Typing actual verse words runs the
  // same robust FTS + fuzzy-typo engine as the main search screens, so a
  // remembered phrase can jump straight to the chapter/verse instead of
  // requiring a manual book → chapter → verse drill-down.
  const [contentResults, setContentResults] = useState<BibleSearchResult[]>([]);
  const { searchBible, isLoading: isContentSearching } = useBibleSearch();

  useEffect(() => {
    if (currentStep !== 'book' || !searchQuery.trim()) {
      setContentResults([]);
      return;
    }
    const id = setTimeout(async () => {
      const results = await searchBible(searchQuery);
      setContentResults(results);
    }, 300);
    return () => clearTimeout(id);
  }, [currentStep, searchQuery, searchBible]);

  const bottomScrollSpacer =
    Math.max(insets.bottom, 0) +
    15 +
    8 +
    42 +
    4 * 2 +
    16;

  const bottomScrollSpacerAdjusted = Math.round(bottomScrollSpacer * 0.5) + 7;

  const selectedBookShortName = useMemo(() => {
    return selectedBook ? getBibleBookShortName(selectedBook.name, selectedBook.id) : '';
  }, [selectedBook]);

  // Memoize filtered books
  const filteredBooks = useMemo(() => {
    if (!searchQuery.trim()) return books;
    const q = searchQuery.toLowerCase();
    return books.filter(book => {
      const longName = book.name.toLowerCase();
      const shortName = getBibleBookShortName(book.name, book.id).toLowerCase();
      return longName.includes(q) || shortName.includes(q);
    });
  }, [books, searchQuery]);

  // Separate old and new testament books
  const oldTestament = useMemo(() => {
    return filteredBooks.filter(book => book.testament === 'old');
  }, [filteredBooks]);

  const newTestament = useMemo(() => {
    return filteredBooks.filter(book => book.testament === 'new');
  }, [filteredBooks]);

  // Generate chapter numbers
  const chapters = useMemo(() => {
    if (!selectedBook) return [];
    return Array.from({ length: selectedBook.chapters }, (_, i) => i + 1);
  }, [selectedBook]);

  useEffect(() => {
    setPendingStartVerse(null);
  }, [selectedBook?.id, selectedChapter]);

  useEffect(() => {
    let cancelled = false;

    if (currentStep !== 'verse' || !selectedBook || selectedChapter === null) {
      setVerseCount(0);
      return;
    }

    (async () => {
      const count = await getVerseCount(selectedBook.id, selectedChapter);
      if (!cancelled) {
        setVerseCount(count);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentStep, getVerseCount, selectedBook, selectedChapter]);

  const verses = useMemo(() => {
    if (selectedChapter === null || verseCount <= 0) {
      return [];
    }
    return Array.from({ length: verseCount }, (_, i) => i + 1);
  }, [selectedChapter, verseCount]);

  const handleBookPress = useCallback((bookId: number, bookName: string, chapters: number) => {
    setSelectedBook({ id: bookId, name: bookName, chapters });
    setSelectedChapter(null);
    setPendingStartVerse(null);
    setCurrentStep('chapter');
  }, []);

  const handleChapterPress = useCallback((chapter: number) => {
    setSelectedChapter(chapter);
    setPendingStartVerse(null);
    setCurrentStep('verse');
  }, []);

  // A content-search hit jumps straight to its chapter with the matched
  // verse pre-armed as the pending start — tapping that SAME verse number in
  // the grid adds it immediately (single verse), or a different one forms a
  // range, exactly like the existing two-tap flow.
  const handleContentResultPress = useCallback(
    (result: BibleSearchResult) => {
      if (!result.matchedChapter || !result.matchedVerseNumber) return;
      const book = books.find(b => b.id === result.bookId);
      if (!book) return;
      setSelectedBook({ id: book.id, name: book.name, chapters: book.chapters });
      setSelectedChapter(result.matchedChapter);
      setPendingStartVerse(result.matchedVerseNumber);
      setCurrentStep('verse');
    },
    [books],
  );

  const handleClose = useCallback(() => {
    setCurrentStep('book');
    setSelectedBook(null);
    setSelectedChapter(null);
    setSearchQuery('');
    setVerseCount(0);
    setPendingStartVerse(null);
    onClose();
  }, [onClose]);

  // First tap arms the start; second tap resolves immediately — same verse →
  // single, a different verse → the n–m range. No confirm.
  const handleVersePress = useCallback((verse: number) => {
    if (!selectedBook || selectedChapter === null) return;

    if (pendingStartVerse === null) {
      setPendingStartVerse(verse);
      return;
    }

    if (verse === pendingStartVerse) {
      onBibleSelect(selectedBook.id, selectedBook.name, selectedChapter, {
        kind: 'single',
        verse,
      });
    } else {
      onBibleSelect(selectedBook.id, selectedBook.name, selectedChapter, {
        kind: 'range',
        start: Math.min(pendingStartVerse, verse),
        end: Math.max(pendingStartVerse, verse),
      });
    }
    handleClose();
  }, [selectedBook, selectedChapter, pendingStartVerse, onBibleSelect, handleClose]);

  const handleWholeChapterPress = useCallback(() => {
    if (!selectedBook || selectedChapter === null || verseCount <= 0) return;
    onBibleSelect(selectedBook.id, selectedBook.name, selectedChapter, {
      kind: 'whole',
      verseCount,
    });
    handleClose();
  }, [selectedBook, selectedChapter, verseCount, onBibleSelect, handleClose]);

  const onProgressChangeRef = useRef(onProgressChange);
  useEffect(() => {
    onProgressChangeRef.current = onProgressChange;
  }, [onProgressChange]);

  useEffect(() => {
    onProgressChangeRef.current?.({
      step: currentStep,
      selectedBook: selectedBook ? {id: selectedBook.id, name: selectedBook.name} : null,
      selectedChapter,
    });
  }, [currentStep, selectedBook, selectedChapter]);

  useEffect(() => {
    if (!requestedStep) return;
    if (requestedStep === currentStep) return;

    if (requestedStep === 'book') {
      setCurrentStep('book');
      return;
    }

    if (requestedStep === 'chapter') {
      if (selectedBook) {
        setCurrentStep('chapter');
      }
      return;
    }

    if (requestedStep === 'verse') {
      if (selectedBook && selectedChapter !== null) {
        setCurrentStep('verse');
      }
    }
  }, [currentStep, requestedStep, selectedBook, selectedChapter]);

  const handleBack = useCallback(() => {
    setPendingStartVerse(null);
    if (currentStep === 'verse') {
      setCurrentStep('chapter');
    } else if (currentStep === 'chapter') {
      setCurrentStep('book');
    }
  }, [currentStep]);

  // Returns the header label as { title, subtitle }. Subtitle is rendered on
  // its own line below the title so long references (e.g. "Marka 16
  // (manomboka 15)") don't overflow and get clipped behind the × close
  // button on narrower screens.
  const getStepTitle = useCallback((): {title: string; subtitle: string | null} => {
    switch (currentStep) {
      case 'book':
        return {title: 'Fisafidianana boky', subtitle: null};
      case 'chapter':
        return {
          title: 'Fisafidianana toko',
          subtitle: selectedBook ? selectedBookShortName : null,
        };
      case 'verse': {
        if (!selectedBook || selectedChapter === null) {
          return {title: 'Fisafidianana andininy', subtitle: null};
        }
        const base = `${selectedBookShortName} ${selectedChapter}`;
        if (pendingStartVerse !== null) {
          return {
            title: 'Fisafidianana andininy farany',
            subtitle: `${base} (manomboka ${pendingStartVerse})`,
          };
        }
        return {title: 'Fisafidianana andininy', subtitle: base};
      }
      default:
        return {title: 'Fisafidianana boky', subtitle: null};
    }
  }, [currentStep, selectedBook, selectedBookShortName, selectedChapter, pendingStartVerse]);

  // Book step renders Old Testament on the left, New Testament on the right
  // as parallel single-column lists of theme-colored buttons. Each column
  // scrolls independently so long lists (39 books in the Old vs 27 in the
  // New) don't force one side to be padded out.
  const renderBookButton = (item: {id: number; name: string; chapters: number}) => (
    <Pressable
      key={item.id}
      style={[
        styles.bookButton,
        {backgroundColor: theme.colors.backgroundTertiary},
      ]}
      onPress={() => handleBookPress(item.id, item.name, item.chapters)}>
      <Text
        style={[styles.bookButtonText, {color: theme.colors.textPrimary}]}
        numberOfLines={1}>
        {getBibleBookShortName(item.name, item.id)}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.screen, {backgroundColor: theme.colors.backgroundSecondary}]}>
      {/* Header */}
      <View style={[styles.header, {borderBottomColor: theme.colors.divider}]}>
        <Pressable
          style={[
            styles.backButton,
            currentStep === 'book' && styles.backButtonDisabled,
          ]}
          onPress={handleBack}
          disabled={currentStep === 'book'}>
          <Text
            style={[
              styles.backButtonText,
              {color: theme.colors.accentBlue},
              currentStep === 'book' && styles.backButtonTextDisabled,
            ]}>
            ←
          </Text>
        </Pressable>
        {(() => {
          const {title, subtitle} = getStepTitle();
          return (
            <View style={styles.headerTitleBlock}>
              <Text
                style={[styles.headerTitle, {color: theme.colors.textPrimary}]}
                numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text
                  style={[
                    styles.headerSubtitle,
                    {color: theme.colors.textSecondary},
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {subtitle}
                </Text>
              ) : null}
            </View>
          );
        })()}
        <Pressable style={styles.closeButton} onPress={handleClose}>
          <Text style={[styles.closeButtonText, {color: theme.colors.textPrimary}]}>×</Text>
        </Pressable>
      </View>

      {/* Search input for book selection */}
      {currentStep === 'book' && (
        <View style={[styles.searchContainer, {borderBottomColor: theme.colors.divider}]}> 
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.colors.backgroundTertiary,
                color: theme.colors.textPrimary,
              },
            ]}
            placeholder="Anaran'ny boky karohana..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>
      )}

      {/* Verse-content search results — a phrase the user actually remembers
          jumps straight to chapter/verse instead of requiring the book name. */}
      {currentStep === 'book' && searchQuery.trim() ? (
        isContentSearching ? (
          <View style={styles.contentSearchLoading}>
            <ActivityIndicator color={theme.colors.accentBlue} />
          </View>
        ) : contentResults.length > 0 ? (
          <View style={[styles.contentResultsWrap, {borderBottomColor: theme.colors.divider}]}>
            <FlatList
              data={contentResults}
              keyExtractor={item => `content-${item.bookId}`}
              style={styles.contentResultsList}
              keyboardShouldPersistTaps="handled"
              renderItem={({item}) => (
                <Pressable
                  style={({pressed}) => [
                    styles.contentResultRow,
                    {borderBottomColor: theme.colors.divider},
                    pressed && {opacity: 0.7},
                  ]}
                  onPress={() => handleContentResultPress(item)}
                >
                  <Text style={[styles.contentResultRef, {color: theme.colors.accentBlue}]}>
                    {getBibleBookShortName(item.bookName, item.bookId)} {item.matchedChapter}:{item.matchedVerseNumber}
                  </Text>
                  {item.matchedText ? (
                    <Text
                      style={[styles.contentResultSnippet, {color: theme.colors.textSecondary}]}
                      numberOfLines={2}
                    >
                      {item.matchedText}
                    </Text>
                  ) : null}
                </Pressable>
              )}
            />
          </View>
        ) : null
      ) : null}

      {/* Content */}
      {currentStep === 'book' ? (
        oldTestament.length === 0 && newTestament.length === 0 ? (
          <View style={styles.content}>
            <Text
              style={[styles.infoText, {color: theme.colors.textSecondary}]}>
              {isLoading ? 'Mitady...' : 'Tsy misy valiny.'}
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.twoColumnRow,
              {paddingBottom: 12 + bottomScrollSpacerAdjusted},
            ]}>
            <View style={styles.column}>
              <Text
                style={[
                  styles.testamentTitle,
                  {color: theme.colors.textSecondary},
                ]}>
                Testamenta Taloha
              </Text>
              <FlatList
                key="ot-col"
                data={oldTestament}
                keyExtractor={item => item.id.toString()}
                renderItem={({item}) => renderBookButton(item)}
                contentContainerStyle={styles.columnContent}
                showsVerticalScrollIndicator={false}
              />
            </View>
            <View style={styles.column}>
              <Text
                style={[
                  styles.testamentTitle,
                  {color: theme.colors.textSecondary},
                ]}>
                Testamenta Vaovao
              </Text>
              <FlatList
                key="nt-col"
                data={newTestament}
                keyExtractor={item => item.id.toString()}
                renderItem={({item}) => renderBookButton(item)}
                contentContainerStyle={styles.columnContent}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        )
      ) : currentStep === 'chapter' && selectedBook ? (
        <FlatList
          key={`chapter-grid-${selectedBook.id}`}
          data={chapters}
          keyExtractor={(item) => item.toString()}
          style={styles.content}
          contentContainerStyle={[
            styles.gridContentContainer,
            {paddingBottom: 16 + bottomScrollSpacerAdjusted},
          ]}
          numColumns={6}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.chapterButton, {backgroundColor: theme.colors.backgroundTertiary}]}
              onPress={() => handleChapterPress(item)}
            >
              <Text style={[styles.chapterNumber, {color: theme.colors.textPrimary}]}>{item}</Text>
            </Pressable>
          )}
        />
      ) : currentStep === 'verse' && selectedBook && selectedChapter !== null ? (
        <FlatList
          key={`verse-grid-${selectedBook.id}-${selectedChapter}`}
          data={verses}
          keyExtractor={(item) => item.toString()}
          style={styles.content}
          contentContainerStyle={[
            styles.gridContentContainer,
            {paddingBottom: 16 + bottomScrollSpacerAdjusted},
          ]}
          numColumns={7}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            verseCount > 0 ? (
              <View style={styles.verseHeader}>
                <Text
                  style={[
                    styles.verseHint,
                    {color: theme.colors.textSecondary},
                  ]}>
                  {pendingStartVerse === null
                    ? 'Tsindrio ny andininy voalohany.'
                    : 'Tsindrio ny andininy farany (na ny voalohany indray raha andininy tokana).'}
                </Text>
                {pendingStartVerse === null ? (
                  <Pressable
                    style={[
                      styles.wholeChapterButton,
                      {backgroundColor: theme.colors.accentBlue},
                    ]}
                    onPress={handleWholeChapterPress}>
                    <Text style={styles.wholeChapterText}>
                      Toko manontolo (1–{verseCount})
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <Text style={[styles.infoText, {color: theme.colors.textSecondary}]}>
              {verseCount === 0 ? 'Mitady...' : 'Tsy misy andininy.'}
            </Text>
          }
          renderItem={({ item }) => {
            const isPendingStart = pendingStartVerse === item;
            return (
              <Pressable
                style={[
                  styles.verseButton,
                  {backgroundColor: theme.colors.backgroundTertiary},
                  isPendingStart && {backgroundColor: theme.colors.accentBlue},
                ]}
                onPress={() => handleVersePress(item)}>
                <Text
                  style={[
                    styles.verseNumber,
                    {color: theme.colors.textPrimary},
                    isPendingStart && styles.verseNumberPending,
                  ]}>
                  {item}
                </Text>
              </Pressable>
            );
          }}
        />
      ) : null}
      <TutorialOverlay scope="modal" />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  backButton: {
    width: 56,
    height: 56,
    marginTop: -15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonDisabled: {},
  backButtonText: {
    color: '#1982C4',
    fontSize: 52,
    lineHeight: 52,
    fontWeight: '900',
    width: 56,
    height: 56,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  backButtonTextDisabled: {
    opacity: 0.25,
  },
  headerTitleBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerTitle: {
    color: '#111111',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
    includeFontPadding: false,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#111111',
    fontSize: 26,
    lineHeight: 26,
    fontWeight: '600',
    width: 40,
    height: 40,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  searchInput: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#111111',
  },
  searchPlaceholder: {
    color: 'rgba(0,0,0,0.45)',
  },
  contentSearchLoading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  contentResultsWrap: {
    maxHeight: 240,
    borderBottomWidth: 1,
  },
  contentResultsList: {
    flexGrow: 0,
  },
  contentResultRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contentResultRef: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  contentResultSnippet: {
    fontSize: 13,
    lineHeight: 18,
  },
  content: {
    flex: 1,
  },
  twoColumnRow: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  column: {
    flex: 1,
  },
  columnContent: {
    paddingBottom: 8,
  },
  testamentTitle: {
    color: '#1982C4',
    fontSize: 15,
    fontWeight: '800',
    paddingTop: 4,
    paddingBottom: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookButton: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    minHeight: 44,
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoText: {
    paddingVertical: 18,
    color: 'rgba(0,0,0,0.55)',
    textAlign: 'center',
  },
  gridContentContainer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    rowGap: 10,
  },
  chapterButton: {
    flex: 1,
    margin: 6,
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 50,
  },
  chapterNumber: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '700',
  },
  verseButton: {
    flex: 1,
    margin: 6,
    backgroundColor: 'rgba(77, 150, 255, 0.12)',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 45,
  },
  verseNumber: {
    color: '#3A86FF',
    fontSize: 14,
    fontWeight: '700',
  },
  verseNumberPending: {
    color: '#ffffff',
  },
  verseHeader: {
    paddingHorizontal: 6,
    paddingBottom: 12,
    gap: 8,
  },
  wholeChapterButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  wholeChapterText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  verseHint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 6,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
});

export default memo(BibleSelectionModalOptimized);
