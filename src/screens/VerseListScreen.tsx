import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBibleSearch, BibleVerseResult } from '../hooks/useBibleSearch';
import { useTheme } from '../contexts/ThemeContext';
import { useJesusName } from '../contexts/JesusNameContext';
import { RootStackParamList } from '../navigation/RootNavigator';
import { getBibleBookShortName } from '../utils/bibleBookNames';
import { processBibleTextWithMetadataForReader } from '../utils/bibleTextUtils';
import {
  normalizeForHighlight,
  findHighlightRanges,
  segmentTextForHighlight,
} from '../utils/searchHighlight';
import {t} from '../i18n/strings';

type VerseListScreenRouteProp = RouteProp<RootStackParamList, 'VerseList'>;
type VerseListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const VerseListScreen = () => {
  const route = useRoute<VerseListScreenRouteProp>();
  const navigation = useNavigation<VerseListScreenNavigationProp>();
  const { bookId, bookName, query, matchWholeWord } = route.params;
  const { theme } = useTheme();
  const {transformText} = useJesusName();
  
  const [verses, setVerses] = useState<BibleVerseResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const { getVersesForBook, error } = useBibleSearch();

  useEffect(() => {
    const loadVerses = async () => {
      setIsLoading(true);
      try {
        const results = await getVersesForBook(bookId, query, { matchWholeWord });
        setVerses(results);
      } catch (err) {
        console.error('Error loading verses:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadVerses();
  }, [bookId, query, getVersesForBook, matchWholeWord]);

  const handleVersePress = useCallback(
    (verse: BibleVerseResult) => {
      navigation.navigate('Home', {
        mode: 'bible',
        selectedBook: { id: verse.bookId, name: verse.bookName },
        selectedChapter: verse.chapter,
        selectedVerse: verse.verseNumber,
      });
    },
    [navigation]
  );

  const normalizedHighlightQuery = useMemo(
    () => normalizeForHighlight(query),
    [query]
  );

  const highlightText = useCallback(
    (text: string) => {
      if (!text) return null;
      if (!normalizedHighlightQuery) {
        return <Text>{text}</Text>;
      }
      const ranges = findHighlightRanges(text, normalizedHighlightQuery);
      const segments = segmentTextForHighlight(text, ranges);
      return (
        <Text>
          {segments.map((seg, idx) => (
            <Text
              key={idx}
              style={
                seg.match
                  ? { color: theme.colors.accentBlue, fontWeight: '700' }
                  : undefined
              }
            >
              {seg.text}
            </Text>
          ))}
        </Text>
      );
    },
    [normalizedHighlightQuery, theme.colors.accentBlue]
  );

  const renderVerse = useCallback(
    ({ item }: { item: BibleVerseResult }) => {
      const { lines, italicLines } = processBibleTextWithMetadataForReader(
        transformText(item.text)
      );

      const renderLineWithInlineFootnotes = (line: string) => {
        const regex = /(\[\*[^\]]+\])/g;
        const parts = line.split(regex);

        return (
          <Text>
            {parts.map((part, idx) => {
              if (!part) return null;
              const isFootnote = part.startsWith('[*') && part.endsWith(']');
              if (isFootnote) {
                return (
                  <Text
                    key={`fn-${idx}`}
                    style={{ opacity: 0.72, fontStyle: 'italic', fontSize: 15 }}
                  >
                    {part}
                  </Text>
                );
              }
              return <Text key={`tx-${idx}`}>{highlightText(part)}</Text>;
            })}
          </Text>
        );
      };

      return (
        <Pressable
          style={[styles.verseItem, { backgroundColor: theme.colors.backgroundSecondary }]}
          onPress={() => handleVersePress(item)}
        >
          <View style={styles.verseHeader}>
            <Text style={[styles.verseReference, { color: theme.colors.textPrimary }]}>
              {getBibleBookShortName(bookName, bookId)} {item.chapter}:{item.verseNumber}
            </Text>
          </View>
          <View style={styles.verseContent}>
            {lines.map((line, lineIndex) => (
              <Text
                key={lineIndex}
                style={{
                  fontSize: 16,
                  lineHeight: 24,
                  marginBottom: 4,
                  textAlign: 'justify',
                  fontStyle: italicLines.has(lineIndex) ? 'italic' : 'normal',
                  color: italicLines.has(lineIndex)
                    ? theme.colors.textWatermark
                    : theme.colors.textPrimary,
                }}
              >
                {renderLineWithInlineFootnotes(line)}
              </Text>
            ))}
          </View>
        </Pressable>
      );
    },
    [bookId, bookName, handleVersePress, highlightText, theme.colors, transformText]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.backgroundPrimary }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.navBackground }]}>
        <Text style={[styles.title, { color: '#FFFFFF' }]}>
          {getBibleBookShortName(bookName, bookId)}
        </Text>
        <Text style={[styles.subtitle, { color: '#FFFFFF' }]}>
          {t('verseList.searchLabel', {query})}
        </Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: '#ff4444' }]}>
            {error}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accentBlue} />
        </View>
      ) : verses.length > 0 ? (
        <FlatList
          data={verses}
          keyExtractor={(item) => `${item.chapter}-${item.verseNumber}`}
          renderItem={renderVerse}
          style={styles.versesList}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            {t('verseList.empty', {query, book: getBibleBookShortName(bookName, bookId)})}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  versesList: {
    flex: 1,
  },
  verseItem: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    padding: 16,
  },
  verseHeader: {
    marginBottom: 8,
  },
  verseContent: {
    paddingLeft: 8,
  },
  verseReference: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#fee',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default VerseListScreen;
