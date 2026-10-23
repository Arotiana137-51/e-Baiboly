import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {t} from '../i18n/strings';
import {useTheme} from '../contexts/ThemeContext';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {MagnifyingGlass} from '../components/MagnifyingGlass';
import {hexToRgba, readableAccent} from '../utils/colorUtils';
import {useDictionaryWords, useRecentLookups} from '../hooks/useDictionary';
import {
  dictionaryLetters,
  fuzzyDictionary,
  groupByLetter,
  searchDictionary,
  wordsUnderLetter,
  type IndexedWord,
} from '../utils/dictionary';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SIDE = 16;
const GAP = 8;
const LETTER_COLUMNS = 6;

// Laid out like the dictionary apps people know: the search field on top
// with its magnifier, results as you type, and before anything is typed the
// words looked up lately and big A to Z buttons for those who'd rather tap
// than type. The list keeps its letter pinned at the top as it scrolls. The
// search field matches the global search's.
const DictionaryScreen = () => {
  const {theme, primaryColor} = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const {width} = useWindowDimensions();
  const {words, failed} = useDictionaryWords();
  const {recent, clear: clearRecent} = useRecentLookups();
  const [query, setQuery] = useState('');
  const [letter, setLetter] = useState<string | null>(null);

  const searching = query.trim().length > 0;
  const letters = useMemo(() => (words ? dictionaryLetters(words) : []), [words]);
  const sections = useMemo(() => {
    if (!words) return [];
    if (searching) {
      // Nothing spelled that way: the nearest headwords, as the Bible search does.
      const exact = searchDictionary(words, query);
      const found = exact.length ? exact : fuzzyDictionary(words, query);
      // No section at all, or SectionList won't show its empty message.
      return found.length ? [{title: '', data: found}] : [];
    }
    return groupByLetter(letter ? wordsUnderLetter(words, letter) : words);
  }, [words, searching, query, letter]);
  const resultCount = searching ? sections[0]?.data.length ?? 0 : 0;

  // Full-width grid: the buttons line up with the search field's edges.
  const letterSize = Math.floor((width - 2 * SIDE - (LETTER_COLUMNS - 1) * GAP) / LETTER_COLUMNS);
  const accent = primaryColor ?? theme.colors.navBackground;
  const accentInk = readableAccent(accent, theme.colors.backgroundPrimary);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {flex: 1, backgroundColor: theme.colors.backgroundPrimary},
        searchBarWrap: {paddingHorizontal: SIDE, paddingTop: 12, paddingBottom: 8},
        searchBar: {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 12,
          borderWidth: 1,
          paddingLeft: 12,
          backgroundColor: theme.colors.backgroundSecondary,
          borderColor: theme.colors.divider,
        },
        input: {flex: 1, marginLeft: 10, fontSize: 17, paddingVertical: 10, color: theme.colors.textPrimary},
        clear: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
        clearText: {fontSize: 22, color: theme.colors.textSecondary},
        sectionRow: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: SIDE, marginTop: 8},
        sectionTitle: {flex: 1, fontSize: 13, fontWeight: '700', letterSpacing: 0.4, color: theme.colors.textSecondary},
        sectionAction: {fontSize: 14, fontWeight: '600', color: accentInk, paddingVertical: 6},
        chips: {flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: SIDE, paddingVertical: 8},
        chip: {
          minHeight: 40,
          justifyContent: 'center',
          paddingHorizontal: 14,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: hexToRgba(accent, 0.45),
        },
        chipText: {fontSize: 15, fontWeight: '600', color: accentInk},
        letters: {flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: SIDE, paddingTop: 10, paddingBottom: 14},
        letter: {
          width: letterSize,
          height: 48,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hexToRgba(accent, theme.isDark ? 0.22 : 0.12),
        },
        letterOn: {backgroundColor: accent},
        letterText: {fontSize: 19, fontWeight: '700', color: accentInk},
        letterTextOn: {color: '#FFFFFF'},
        count: {paddingHorizontal: SIDE, paddingVertical: 8, fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary},
        header: {
          paddingHorizontal: SIDE,
          paddingVertical: 6,
          backgroundColor: theme.colors.backgroundPrimary,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.divider,
        },
        headerText: {fontSize: 15, fontWeight: '800', color: accentInk},
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: SIDE,
          paddingRight: 12,
          paddingVertical: 13,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.divider,
        },
        rowPressed: {backgroundColor: theme.colors.divider},
        rowBody: {flex: 1},
        main: {fontSize: 17, fontWeight: '600', letterSpacing: 0.2, color: theme.colors.textPrimary},
        detail: {fontSize: 14, marginTop: 2, color: theme.colors.textSecondary},
        chevron: {fontSize: 24, marginLeft: 8, color: theme.colors.textSecondary},
        message: {padding: 24, textAlign: 'center', fontSize: 15, color: theme.colors.textSecondary},
        loading: {marginTop: 32},
      }),
    [theme, accent, accentInk, letterSize],
  );

  // The field keeps its focus under the pushed entry: drop the keyboard first.
  const open = useCallback(
    (id: number) => {
      Keyboard.dismiss();
      navigation.push('DictionaryEntry', {id});
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({item}: {item: IndexedWord}) => (
      <Pressable
        accessibilityRole="button"
        onPress={() => open(item.id)}
        style={({pressed}) => [styles.row, pressed ? styles.rowPressed : null]}>
        <View style={styles.rowBody}>
          <Text style={styles.main}>{item.main}</Text>
          {item.detail ? (
            <Text style={styles.detail} numberOfLines={2}>
              {item.detail}
            </Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    ),
    [open, styles],
  );

  const renderSectionHeader = useCallback(
    ({section}: {section: {title: string}}) =>
      section.title ? (
        <View style={styles.header}>
          <Text style={styles.headerText}>{section.title}</Text>
        </View>
      ) : null,
    [styles],
  );

  // While typing: how many words match. Before: recent words, then letters.
  const listHeader = searching ? (
    <Text style={styles.count}>{t('search.resultCount', {count: resultCount})}</Text>
  ) : (
    <View>
      {recent.length > 0 ? (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{t('dictionary.recent')}</Text>
            <Pressable accessibilityRole="button" onPress={clearRecent} hitSlop={8}>
              <Text style={styles.sectionAction}>{t('common.clear')}</Text>
            </Pressable>
          </View>
          <View style={styles.chips}>
            {recent.map(r => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                onPress={() => open(r.id)}
                style={({pressed}) => [styles.chip, pressed ? styles.rowPressed : null]}>
                <Text style={styles.chipText}>{r.word}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <View style={styles.letters}>
        {letters.map(l => (
          <Pressable
            key={l}
            accessibilityRole="button"
            accessibilityState={{selected: l === letter}}
            onPress={() => setLetter(current => (current === l ? null : l))}
            style={[styles.letter, l === letter ? styles.letterOn : null]}>
            <Text style={[styles.letterText, l === letter ? styles.letterTextOn : null]}>{l}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <MagnifyingGlass color={theme.colors.textSecondary} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('dictionary.search')}
            placeholderTextColor={hexToRgba(theme.colors.textSecondary, 0.5)}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={styles.input}
          />
          {/* clearButtonMode is iOS-only: one × for both platforms. */}
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.clear')}
              onPress={() => setQuery('')}
              style={styles.clear}>
              <Text style={styles.clearText}>×</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {words === null && !failed ? (
        <ActivityIndicator style={styles.loading} color={theme.colors.textSecondary} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          // Pinned letters are on by default on iOS only.
          stickySectionHeadersEnabled
          initialNumToRender={20}
          ListHeaderComponent={listHeader}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View>
              <Text style={styles.message}>{t('dictionary.empty')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default DictionaryScreen;
