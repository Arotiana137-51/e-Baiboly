import React, {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {t} from '../i18n/strings';
import {useTheme} from '../contexts/ThemeContext';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {SheetButton, SheetModal} from '../components/SheetModal';
import {readableAccent} from '../utils/colorUtils';
import {
  loadDictionaryPassage,
  useChapterSizes,
  useDictionaryEntry,
  useDictionaryWords,
  type PassageVerse,
} from '../hooks/useDictionary';
import {
  formatRef,
  parseDictionaryParagraph,
  resolveRef,
  type DictionaryRef,
  type DictionarySegment,
} from '../utils/dictionary';

type Props = NativeStackScreenProps<RootStackParamList, 'DictionaryEntry'>;

// One entry, a paragraph per list row: the longest (JESOSY KRISTY) runs to
// about 30 printed pages. A Bible ref opens its verses in a sheet with a way
// into the reader; "Jereo X" opens entry X on top of this one.
const DictionaryEntryScreen = ({route, navigation}: Props) => {
  const {theme} = useTheme();
  const {entry, failed} = useDictionaryEntry(route.params.id);
  const {findEntry} = useDictionaryWords();
  const chapterSizes = useChapterSizes();
  const [passage, setPassage] = useState<{ref: DictionaryRef; verses: PassageVerse[] | null} | null>(
    null,
  );

  const paragraphs = useMemo(
    () =>
      entry
        ? entry.text
            .split('\n')
            .filter(p => p.trim())
            .map(p => parseDictionaryParagraph(p, findEntry))
        : [],
    [entry, findEntry],
  );

  const link = readableAccent(theme.colors.accentBlue, theme.colors.backgroundPrimary);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {flex: 1, backgroundColor: theme.colors.backgroundPrimary},
        content: {paddingHorizontal: 16, paddingBottom: 24},
        headword: {
          fontSize: 22,
          fontWeight: '700',
          color: theme.colors.textPrimary,
          paddingTop: 16,
          paddingBottom: 8,
        },
        paragraph: {fontSize: 16, lineHeight: 25, color: theme.colors.textPrimary, marginBottom: 12},
        link: {color: link, fontWeight: '600'},
        message: {padding: 24, textAlign: 'center', fontSize: 15, color: theme.colors.textSecondary},
        loading: {marginTop: 32},
        verse: {fontSize: 16, lineHeight: 24, color: theme.colors.textPrimary, marginBottom: 8},
        verseNumber: {fontWeight: '700', color: theme.colors.verseNumber},
      }),
    [theme, link],
  );

  const openRef = useCallback((ref: DictionaryRef) => {
    setPassage({ref, verses: null});
    loadDictionaryPassage(ref).then(
      verses => setPassage(current => (current?.ref === ref ? {ref, verses} : current)),
      error => {
        console.error('Error loading dictionary passage:', error);
        setPassage(null);
      },
    );
  }, []);

  const closePassage = () => setPassage(null);

  const readInBible = () => {
    if (!passage) return;
    const {ref} = passage;
    setPassage(null);
    navigation.navigate('Home', {
      mode: 'bible',
      selectedBook: {id: ref.bookId, name: ref.bookName},
      selectedChapter: ref.chapter,
      selectedVerse: ref.verseStart,
    });
  };

  const renderSegment = (segment: DictionarySegment, index: number) => {
    if (segment.kind === 'plain') return segment.text;
    if (segment.kind === 'entry') {
      return (
        <Text
          key={index}
          style={styles.link}
          onPress={() => navigation.push('DictionaryEntry', {id: segment.entryId, word: segment.text})}>
          {segment.text}
        </Text>
      );
    }
    const ref = chapterSizes ? resolveRef(segment, chapterSizes) : null;
    if (!ref) return segment.text;
    return (
      <Text key={index} style={styles.link} onPress={() => openRef(ref)}>
        {segment.text}
      </Text>
    );
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      {entry ? (
        <FlatList
          data={paragraphs}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={styles.content}
          initialNumToRender={8}
          ListHeaderComponent={<Text style={styles.headword}>{entry.word}</Text>}
          renderItem={({item}) => <Text style={styles.paragraph}>{item.map(renderSegment)}</Text>}
        />
      ) : failed ? (
        <View>
          <Text style={styles.message}>{t('dictionary.empty')}</Text>
        </View>
      ) : (
        <ActivityIndicator style={styles.loading} color={theme.colors.textSecondary} />
      )}

      <SheetModal
        visible={passage !== null}
        title={passage ? formatRef(passage.ref) : undefined}
        onClose={closePassage}
        footer={
          <>
            <SheetButton label={t('common.close')} onPress={closePassage} />
            <SheetButton label={t('dictionary.read')} variant="filled" onPress={readInBible} />
          </>
        }>
        {passage?.verses ? (
          <ScrollView>
            {passage.verses.map(v => (
              <Text key={v.verse_number} style={styles.verse}>
                <Text style={styles.verseNumber}>{v.verse_number} </Text>
                {v.text}
              </Text>
            ))}
          </ScrollView>
        ) : (
          <ActivityIndicator style={styles.loading} color={theme.colors.textSecondary} />
        )}
      </SheetModal>
    </SafeAreaView>
  );
};

export default DictionaryEntryScreen;
