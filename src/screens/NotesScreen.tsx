import React, {useCallback} from 'react';
import {StyleSheet, Text, View, FlatList, Pressable, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useAllNotes, NoteEntry} from '../hooks/useAllNotes';
import {useTheme} from '../contexts/ThemeContext';
import {RootStackParamList} from '../navigation/RootNavigator';
import {TEXT_STYLES} from '../constants/Typography';
import {getBibleBookShortName} from '../utils/bibleBookNames';
import {HYMN_CHORUS_LABEL} from '../utils/chapterMarks';
import {t} from '../i18n/strings';

type NotesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const NotesScreen = () => {
  const navigation = useNavigation<NotesScreenNavigationProp>();
  const {entries, removeNote, reload} = useAllNotes();
  const {theme} = useTheme();

  // Notes are authored/edited on other screens (the reader's chapter editor),
  // so refresh the list every time this screen regains focus rather than only
  // on mount.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const handleRemoveNote = (entry: NoteEntry) => {
    Alert.alert(t('notes.removeTitle'), t('notes.removeMessage'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: () => removeNote(entry),
      },
    ]);
  };

  const handlePress = (entry: NoteEntry) => {
    if (entry.hymnId) {
      navigation.navigate('Home', {mode: 'hymnal', selectedHymnId: entry.hymnId});
      return;
    }
    navigation.navigate('Home', {
      mode: 'bible',
      selectedBook: {id: entry.bookId, name: entry.bookName},
      selectedChapter: entry.chapter,
      selectedVerse: entry.verseNumber,
    });
  };

  // "FFPM 312 · 2" for a hymn stanza (chorus shows its label), else the usual
  // "Book chapter:verse".
  const noteTitle = (item: NoteEntry) =>
    item.hymnId
      ? `${item.hymnLabel} · ${item.verseNumber === 0 ? HYMN_CHORUS_LABEL : item.verseNumber}`
      : `${getBibleBookShortName(item.bookName, item.bookId)} ${item.chapter}:${item.verseNumber}`;

  const renderNoteItem = ({item}: {item: NoteEntry}) => (
    <View
      style={[
        styles.itemContainer,
        {backgroundColor: theme.colors.backgroundSecondary},
      ]}>
      <Pressable style={styles.pressableContent} onPress={() => handlePress(item)}>
        <View style={styles.itemContent}>
          <Text style={[styles.itemTitle, {color: theme.colors.textPrimary}]}>
            {noteTitle(item)}
          </Text>
          <Text style={[styles.itemText, {color: theme.colors.textSecondary}]}>
            {item.noteText.length > 100
              ? `${item.noteText.substring(0, 100)}...`
              : item.noteText}
          </Text>
        </View>
      </Pressable>
      <Pressable
        style={[styles.removeButton, {backgroundColor: 'transparent'}]}
        onPress={() => handleRemoveNote(item)}>
        <Text
          style={[styles.removeButtonText, {color: theme.colors.textSecondary}]}>
          ×
        </Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView
      style={[
        styles.container,
        {backgroundColor: theme.colors.backgroundPrimary},
      ]}>
      <View style={[styles.header, {backgroundColor: theme.colors.navBackground}]}>
        <Text style={[TEXT_STYLES.heading, {color: '#FFFFFF'}]}>
          {t('notes.title')}
        </Text>
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, {color: theme.colors.textSecondary}]}>
            {t('notes.empty')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          renderItem={renderNoteItem}
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  list: {
    flex: 1,
  },
  itemContainer: {
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    position: 'relative',
  },
  pressableContent: {
    flex: 1,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemText: {
    fontSize: 14,
    lineHeight: 20,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  removeButtonText: {
    fontSize: 20,
    fontWeight: '300',
    lineHeight: 24,
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

export default NotesScreen;
