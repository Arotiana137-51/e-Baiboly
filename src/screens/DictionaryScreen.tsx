import React, {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {t} from '../i18n/strings';
import {useTheme} from '../contexts/ThemeContext';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {useDictionaryWords} from '../hooks/useDictionary';
import {searchDictionary, type IndexedWord} from '../utils/dictionary';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// The book's headwords A to Z, filtered as you type. A word opens its entry.
const DictionaryScreen = () => {
  const {theme} = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const {words, failed} = useDictionaryWords();
  const [query, setQuery] = useState('');

  const results = useMemo(() => (words ? searchDictionary(words, query) : []), [words, query]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {flex: 1, backgroundColor: theme.colors.backgroundPrimary},
        search: {
          margin: 16,
          marginBottom: 8,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 12,
          fontSize: 16,
          color: theme.colors.textPrimary,
          backgroundColor: theme.colors.backgroundSecondary,
        },
        row: {
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.divider,
        },
        rowPressed: {backgroundColor: theme.colors.divider},
        main: {fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary},
        detail: {fontSize: 14, marginTop: 2, color: theme.colors.textSecondary},
        message: {padding: 24, textAlign: 'center', fontSize: 15, color: theme.colors.textSecondary},
        loading: {marginTop: 32},
      }),
    [theme],
  );

  const renderItem = useCallback(
    ({item}: {item: IndexedWord}) => (
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.push('DictionaryEntry', {id: item.id, word: item.main})}
        style={({pressed}) => [styles.row, pressed ? styles.rowPressed : null]}>
        <Text style={styles.main}>{item.main}</Text>
        {item.detail ? (
          <Text style={styles.detail} numberOfLines={2}>
            {item.detail}
          </Text>
        ) : null}
      </Pressable>
    ),
    [navigation, styles],
  );

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('dictionary.search')}
        placeholderTextColor={theme.colors.textSecondary}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={styles.search}
      />
      {words === null && !failed ? (
        <ActivityIndicator style={styles.loading} color={theme.colors.textSecondary} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
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
