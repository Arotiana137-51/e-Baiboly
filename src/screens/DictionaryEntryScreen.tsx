import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {t} from '../i18n/strings';
import {useTheme} from '../contexts/ThemeContext';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {SheetButton, SheetModal} from '../components/SheetModal';
import {readableAccent} from '../utils/colorUtils';
import {
  addRecentLookup,
  loadDictionaryPassage,
  useChapterSizes,
  useDictionaryEntry,
  useDictionaryWords,
  useReaderFontScale,
  type PassageVerse,
} from '../hooks/useDictionary';
import {TEXT_STYLES, scaleFontSize} from '../constants/Typography';
import {
  formatRef,
  indexDictionaryWords,
  linkedEntries,
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
  const {theme, primaryColor} = useTheme();
  const {entry, failed} = useDictionaryEntry(route.params.id);
  const {words, findEntry} = useDictionaryWords();
  const fontScale = useReaderFontScale();
  const chapterSizes = useChapterSizes();
  const [passage, setPassage] = useState<{ref: DictionaryRef; verses: PassageVerse[] | null} | null>(
    null,
  );

  // "ABAGITA (Estera 1 : 10)" -> main "ABAGITA", detail "(Estera 1 : 10)".
  const headword = useMemo(
    () => (entry ? indexDictionaryWords([{id: route.params.id, word: entry.word}])[0] : null),
    [entry, route.params.id],
  );

  // Into the list's "recent" row, under its main headword.
  useEffect(() => {
    if (headword) addRecentLookup({id: headword.id, word: headword.main});
  }, [headword]);

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

  // The entries the text points to, gathered under "Jereo koa" at the end.
  const seeAlso = useMemo(
    () =>
      linkedEntries(paragraphs, route.params.id)
        .map(id => words?.[id - 1])
        .filter((w): w is NonNullable<typeof w> => !!w),
    [paragraphs, route.params.id, words],
  );

  // Body text at the reader's A+ / A- size and line spacing, so an entry
  // reads like the Bible next to it.
  const bodySize = scaleFontSize(TEXT_STYLES.body.fontSize, fontScale);
  const bodyLine = Math.round(bodySize * 1.3) + 3;

  // Links in the app's link colour (the reader's own colour once one is
  // picked), like the search results.
  const link = readableAccent(theme.colors.accentBlue, theme.colors.backgroundPrimary);
  const accent = primaryColor ?? theme.colors.navBackground;
  const accentInk = readableAccent(accent, theme.colors.backgroundPrimary);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {flex: 1, backgroundColor: theme.colors.backgroundPrimary},
        content: {paddingHorizontal: 16, paddingBottom: 24},
        head: {paddingTop: 20, paddingBottom: 4},
        headword: {fontSize: Math.round(bodySize * 1.5), fontWeight: '800', letterSpacing: 0.3, color: accentInk},
        detail: {
          fontSize: bodySize - 1,
          lineHeight: bodyLine - 1,
          fontStyle: 'italic',
          marginTop: 4,
          color: theme.colors.textSecondary,
        },
        rule: {width: 44, height: 3, borderRadius: 2, backgroundColor: accent, marginTop: 14, marginBottom: 18},
        paragraph: {fontSize: bodySize, lineHeight: bodyLine, color: theme.colors.textPrimary, marginBottom: 14},
        seeAlso: {
          marginTop: 12,
          paddingTop: 14,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.divider,
        },
        seeAlsoTitle: {fontSize: 13, fontWeight: '700', letterSpacing: 0.4, color: theme.colors.textSecondary},
        chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10},
        chip: {
          minHeight: 40,
          justifyContent: 'center',
          paddingHorizontal: 14,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: link,
        },
        chipText: {fontSize: 15, fontWeight: '600', color: link},
        pressed: {opacity: 0.6},
        link: {color: link, fontWeight: '600'},
        message: {padding: 24, textAlign: 'center', fontSize: 15, color: theme.colors.textSecondary},
        loading: {marginTop: 32},
        // The sheet's 20pt inset, like its title and footer.
        passage: {paddingHorizontal: 20, paddingVertical: 16},
        verse: {fontSize: bodySize, lineHeight: bodyLine, color: theme.colors.textPrimary, marginBottom: 8},
        verseNumber: {fontWeight: '700', color: theme.colors.verseNumber},
      }),
    [theme, link, accent, accentInk, bodySize, bodyLine],
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
          onPress={() => navigation.push('DictionaryEntry', {id: segment.entryId})}>
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
          ListHeaderComponent={
            headword ? (
              <View style={styles.head}>
                <Text style={styles.headword}>{headword.main}</Text>
                {/* "(Estera 1 : 10)" opens its verse like the refs below. */}
                {headword.detail ? (
                  <Text style={styles.detail}>
                    {parseDictionaryParagraph(headword.detail, findEntry).map(renderSegment)}
                  </Text>
                ) : null}
                <View style={styles.rule} />
              </View>
            ) : null
          }
          renderItem={({item}) => <Text style={styles.paragraph}>{item.map(renderSegment)}</Text>}
          ListFooterComponent={
            seeAlso.length ? (
              <View style={styles.seeAlso}>
                <Text style={styles.seeAlsoTitle}>{t('dictionary.seeAlso')}</Text>
                <View style={styles.chips}>
                  {seeAlso.map(w => (
                    <Pressable
                      key={w.id}
                      accessibilityRole="button"
                      onPress={() => navigation.push('DictionaryEntry', {id: w.id})}
                      style={({pressed}) => [styles.chip, pressed ? styles.pressed : null]}>
                      <Text style={styles.chipText}>{w.main}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
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
          <ScrollView contentContainerStyle={styles.passage}>
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
