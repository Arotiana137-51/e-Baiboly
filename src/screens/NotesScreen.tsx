import React, {useCallback, useMemo, useState} from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import {useTheme} from '../contexts/ThemeContext';
import {useNotes} from '../contexts/NotesContext';
import {useNoteDetails} from '../hooks/useNoteDetails';
import {RootStackParamList} from '../navigation/RootNavigator';
import {TEXT_STYLES} from '../constants/Typography';
import {SegmentedToggle} from '../components/SegmentedToggle';
import {UndoBar} from '../components/UndoBar';
import {MenuIcon} from '../components/MenuIcons';
import {ShareIcon} from '../components/ShareIcon';
import {compareNotes, formatNoteDate, type Note} from '../types/notes';
import {
  findHighlightRanges,
  normalizeForHighlight,
  segmentTextForHighlight,
} from '../utils/searchHighlight';
import {shareText} from '../utils/shareCard';
import {t} from '../i18n/strings';

type NotesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'all' | 'bible' | 'hymn';

const DELETE_RED = '#D32F2F';

// Note text with the search words marked.
const Highlighted = ({text, query, style, matchStyle, numberOfLines}: {
  text: string;
  query: string;
  style: StyleProp<TextStyle>;
  matchStyle: StyleProp<TextStyle>;
  numberOfLines: number;
}) => (
  <Text style={style} numberOfLines={numberOfLines}>
    {segmentTextForHighlight(text, query ? findHighlightRanges(text, query) : []).map((seg, i) => (
      <Text key={i} style={seg.match ? matchStyle : undefined}>
        {seg.text}
      </Text>
    ))}
  </Text>
);

const NotesScreen = () => {
  const navigation = useNavigation<NotesScreenNavigationProp>();
  const {theme} = useTheme();
  const {notes, saveNote, removeNote} = useNotes();
  const details = useNoteDetails(notes);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [deletedNote, setDeletedNote] = useState<Note | null>(null);
  const clearDeleted = useCallback(() => setDeletedNote(null), []);

  const normalizedQuery = normalizeForHighlight(query);

  // Bible order then hymns, filtered by kind and by every search word over the
  // note and its reference (accents and punctuation ignored).
  const visible = useMemo(() => {
    const tokens = normalizedQuery.split(' ').filter(Boolean);
    return [...notes]
      .sort(compareNotes)
      .filter(n => filter === 'all' || n.anchor.kind === filter)
      .filter(n => {
        if (tokens.length === 0) return true;
        const hay = normalizeForHighlight(`${n.text} ${details.get(n.id)?.reference ?? ''}`);
        return tokens.every(tok => hay.includes(tok));
      });
  }, [notes, filter, normalizedQuery, details]);

  const filterOptions = useMemo(
    () => [
      {key: 'all' as const, label: t('history.filterAll')},
      {key: 'bible' as const, label: t('tabs.bible')},
      {key: 'hymn' as const, label: t('tabs.hymns')},
    ],
    [],
  );

  const deleteNote = (note: Note) => {
    removeNote(note.id);
    setDeletedNote(note);
  };

  // A note is read and edited where it belongs: next to its verse, in the
  // reader, with its bubble already open.
  const openNote = (note: Note) => {
    const anchor = note.anchor;
    if (anchor.kind === 'hymn') {
      navigation.navigate('Home', {
        mode: 'hymnal',
        selectedHymnId: anchor.hymnId,
        openNoteId: note.id,
      });
      return;
    }
    navigation.navigate('Home', {
      mode: 'bible',
      selectedBook: {id: anchor.bookId, name: details.get(note.id)?.bookName ?? ''},
      selectedChapter: anchor.chapter,
      selectedVerse: anchor.verseStart,
      openNoteId: note.id,
    });
  };

  // Every note as plain text, in Bible order then hymns.
  const exportAll = () => {
    const body = [...notes]
      .sort(compareNotes)
      .map(n => {
        const info = details.get(n.id);
        const quote = info?.quote ? `\n“${info.quote}”` : '';
        return `${info?.reference ?? ''} (${formatNoteDate(n.updatedAt)})${quote}\n${n.text}`;
      })
      .join('\n\n———\n\n');
    shareText(`${t('notes.exportTitle')}\n\n${body}`);
  };

  const renderItem = ({item}: {item: Note}) => {
    const info = details.get(item.id);
    return (
      <Swipeable
        friction={2}
        rightThreshold={40}
        renderRightActions={() => (
          <Pressable
            onPress={() => deleteNote(item)}
            accessibilityRole="button"
            style={styles.deleteAction}
          >
            <Text style={styles.deleteActionText}>{t('common.remove')}</Text>
          </Pressable>
        )}
      >
        <Pressable
          onPress={() => openNote(item)}
          accessibilityActions={[{name: 'delete', label: t('common.remove')}]}
          onAccessibilityAction={e => {
            if (e.nativeEvent.actionName === 'delete') deleteNote(item);
          }}
          style={[styles.item, {backgroundColor: theme.colors.backgroundSecondary}]}
        >
          <View style={styles.itemContent}>
            <View style={styles.itemHeader}>
              <Text style={[styles.itemTitle, {color: theme.colors.textPrimary}]} numberOfLines={1}>
                {info?.shortReference ?? ''}
              </Text>
              <Text style={[styles.itemDate, {color: theme.colors.textSecondary}]}>
                {formatNoteDate(item.updatedAt)}
              </Text>
            </View>
            {info?.quote ? (
              <Text style={[styles.itemQuote, {color: theme.colors.textSecondary}]} numberOfLines={2}>
                {info.quote}
              </Text>
            ) : null}
            <Highlighted
              text={item.text}
              query={normalizedQuery}
              numberOfLines={3}
              style={[styles.itemText, {color: theme.colors.textPrimary}]}
              matchStyle={[styles.match, {backgroundColor: theme.colors.accentGold}]}
            />
          </View>
          <Pressable
            onPress={() => deleteNote(item)}
            hitSlop={8}
            style={styles.trashButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.remove')}
          >
            <MenuIcon name="trash" color={theme.colors.textSecondary} />
          </Pressable>
        </Pressable>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.backgroundPrimary}]}>
      <View style={[styles.header, {backgroundColor: theme.colors.navBackground}]}>
        <Text style={[TEXT_STYLES.heading, styles.headerTitle]}>{t('notes.title')}</Text>
        {notes.length > 0 ? (
          <Pressable
            onPress={exportAll}
            hitSlop={8}
            style={styles.exportButton}
            accessibilityRole="button"
            accessibilityLabel={t('notes.exportAll')}
          >
            <ShareIcon color="#FFFFFF" />
            <Text style={styles.exportText}>{t('notes.exportAll')}</Text>
          </Pressable>
        ) : null}
      </View>

      {notes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, {color: theme.colors.textSecondary}]}>
            {t('notes.empty')}
          </Text>
        </View>
      ) : (
        <>
          <SegmentedToggle options={filterOptions} selected={filter} onChange={setFilter} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('notes.search')}
            placeholderTextColor={theme.colors.textSecondary}
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={[
              styles.search,
              {
                color: theme.colors.textPrimary,
                backgroundColor: theme.colors.backgroundSecondary,
                borderColor: theme.colors.divider,
              },
            ]}
          />
          <FlatList
            data={visible}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[styles.noResults, {color: theme.colors.textSecondary}]}>
                {t('notes.noResults')}
              </Text>
            }
          />
        </>
      )}

      <UndoBar
        item={deletedNote}
        message={t('notes.deleted')}
        onUndo={note => {
          saveNote(note);
          setDeletedNote(null);
        }}
        onDismiss={clearDeleted}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerTitle: {flex: 1, color: '#FFFFFF'},
  exportButton: {flexDirection: 'row', alignItems: 'center', gap: 6},
  exportText: {color: '#FFFFFF', fontSize: 14, fontWeight: '600'},
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  list: {flex: 1},
  listContent: {paddingBottom: 96},
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
  },
  itemContent: {flex: 1},
  itemHeader: {flexDirection: 'row', alignItems: 'baseline', gap: 8},
  itemTitle: {flex: 1, fontSize: 16, fontWeight: '700'},
  itemDate: {fontSize: 12},
  itemQuote: {fontSize: 13, lineHeight: 19, fontStyle: 'italic', marginTop: 4},
  itemText: {fontSize: 15, lineHeight: 21, marginTop: 6},
  match: {color: '#1C1C1E', borderRadius: 2},
  trashButton: {padding: 6, marginLeft: 8},
  deleteAction: {
    backgroundColor: DELETE_RED,
    justifyContent: 'center',
    alignItems: 'center',
    width: 96,
    marginVertical: 4,
    marginRight: 16,
    borderRadius: 10,
  },
  deleteActionText: {color: '#FFFFFF', fontSize: 14, fontWeight: '700'},
  emptyContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40},
  emptyText: {fontSize: 16, textAlign: 'center'},
  noResults: {fontSize: 15, textAlign: 'center', marginTop: 32, paddingHorizontal: 24},
});

export default NotesScreen;
