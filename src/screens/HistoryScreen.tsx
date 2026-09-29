import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBibleHistory, BibleHistoryItem } from '../hooks/useBibleHistory';
import { useHymnHistory, HymnHistoryItem } from '../hooks/useHymnHistory';
import { useTheme } from '../contexts/ThemeContext';
import { RootStackParamList } from '../navigation/RootNavigator';
import {t} from '../i18n/strings';
import { SegmentedToggle } from '../components/SegmentedToggle';

type HistoryScreenRouteProp = RouteProp<RootStackParamList, 'History'>;
type HistoryNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type HistoryKind = 'bible' | 'hymnal';
type HistoryFilter = 'all' | HistoryKind;
type HistoryItem = (BibleHistoryItem | HymnHistoryItem) & { kind: HistoryKind };

const FILTER_OPTIONS: ReadonlyArray<{ key: HistoryFilter; label: string }> = [
  { key: 'all', label: t('history.filterAll') },
  { key: 'bible', label: t('tabs.bible') },
  { key: 'hymnal', label: t('tabs.hymns') },
];

const HistoryScreen = () => {
  const route = useRoute<HistoryScreenRouteProp>();
  const navigation = useNavigation<HistoryNavigationProp>();
  const [filter, setFilter] = useState<HistoryFilter>(route.params.mode);
  const {
    history: bibleHistory,
    clearHistory: clearBibleHistory,
    removeItem: removeBibleItem,
  } = useBibleHistory();
  const {
    history: hymnHistory,
    clearHistory: clearHymnHistory,
    removeItem: removeHymnItem,
  } = useHymnHistory();
  const { theme } = useTheme();

  const history = useMemo<HistoryItem[]>(() => {
    const bible = bibleHistory.map(item => ({ ...item, kind: 'bible' as const }));
    const hymnal = hymnHistory.map(item => ({ ...item, kind: 'hymnal' as const }));
    if (filter === 'bible') {
      return bible;
    }
    if (filter === 'hymnal') {
      return hymnal;
    }
    return [...bible, ...hymnal].sort((a, b) => b.lastAccessed - a.lastAccessed);
  }, [filter, bibleHistory, hymnHistory]);

  const clearHistoryFn = useCallback(() => {
    if (filter !== 'hymnal') {
      clearBibleHistory();
    }
    if (filter !== 'bible') {
      clearHymnHistory();
    }
  }, [filter, clearBibleHistory, clearHymnHistory]);

  const removeItemFn = (item: HistoryItem) =>
    item.kind === 'bible' ? removeBibleItem(item.id) : removeHymnItem(item.id);

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      t('history.clearTitle'),
      t('history.clearMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.clear'), 
          style: 'destructive',
          onPress: clearHistoryFn
        }
      ]
    );
  }, [clearHistoryFn]);

  const hasHistory = history.length > 0;
  const title =
    filter === 'all'
      ? t('menu.history')
      : filter === 'bible'
      ? t('history.titleBible')
      : t('history.titleHymnal');

  // Title and "Fafao daholo" live in the stack header so the toggle sits right
  // under it. Outlined white, not accentBlue: with a custom color accentBlue is
  // the header color itself and the button would vanish into the bar.
  const headerRight = useCallback(
    () =>
      hasHistory ? (
        <Pressable
          style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
          onPress={handleClearHistory}
          accessibilityRole="button"
        >
          <Text style={styles.clearButtonText}>{t('history.clearAll')}</Text>
        </Pressable>
      ) : null,
    [hasHistory, handleClearHistory],
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title, headerRight });
  }, [navigation, title, headerRight]);

  const handlePress = (item: HistoryItem) => {
    if (item.kind === 'bible') {
      // id shape: "<book_id>-<chapter>-<verse_number>"
      // title shape: "<bookName> <chapter>:<verse_number>"
      const parts = item.id.split('-');
      if (parts.length < 3) {
        return;
      }
      const bookId = Number(parts[0]);
      const chapter = Number(parts[1]);
      const verseNumber = Number(parts[2]);
      if (
        !Number.isFinite(bookId) ||
        !Number.isFinite(chapter) ||
        !Number.isFinite(verseNumber)
      ) {
        return;
      }
      // Recover the book name from the title (strip trailing " C:V").
      const trailing = ` ${chapter}:${verseNumber}`;
      const bookName = item.title.endsWith(trailing)
        ? item.title.slice(0, -trailing.length)
        : item.title;

      navigation.navigate('Home', {
        mode: 'bible',
        selectedBook: { id: bookId, name: bookName },
        selectedChapter: chapter,
        selectedVerse: verseNumber,
      });
    } else {
      navigation.navigate('Home', {
        mode: 'hymnal',
        selectedHymnId: item.id,
      });
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('mg-MG', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderHistoryItem = ({ item }: { item: HistoryItem }) => {
    return (
      <Pressable
        style={[styles.itemContainer, { backgroundColor: theme.colors.backgroundSecondary }]}
        onPress={() => handlePress(item)}
      >
        <View style={styles.itemContent}>
          <Text style={[styles.itemTitle, { color: theme.colors.textPrimary }]}>
            {item.title}
          </Text>
          <Text style={[styles.itemDate, { color: theme.colors.textSecondary }]}>
            {filter === 'all'
              ? `${item.kind === 'bible' ? t('tabs.bible') : t('tabs.hymns')} · `
              : ''}
            {formatDate(item.lastAccessed)}
          </Text>
        </View>
        <Pressable
          // Stop the parent row from receiving the press.
          onPress={() => removeItemFn(item)}
          hitSlop={8}
          style={styles.deleteButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.remove')}
        >
          <Text style={styles.deleteIcon}>×</Text>
        </Pressable>
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      // The native header already covers the top inset.
      edges={['bottom', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.backgroundPrimary }]}
    >
      <SegmentedToggle options={FILTER_OPTIONS} selected={filter} onChange={setFilter} />

      {history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            {filter === 'all'
              ? t('history.emptyAll')
              : filter === 'bible'
              ? t('history.emptyBible')
              : t('history.emptyHymnal')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item: HistoryItem) => `${item.kind}-${item.id}`}
          renderItem={renderHistoryItem}
          style={styles.list}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  clearButtonPressed: {
    opacity: 0.6,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  itemContainer: {
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  deleteIcon: {
    fontSize: 22,
    lineHeight: 22,
    color: '#9E9E9E',
    fontWeight: '400',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 14,
    lineHeight: 20,
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
});

export default HistoryScreen;
