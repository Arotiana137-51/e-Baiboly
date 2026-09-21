import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
  Modal,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import {useCultMode} from '../contexts/CultModeContext';
import {
  CultEntry,
  buildBibleLabel,
  buildHymnLabel,
} from '../types/cultMode';
import {useTheme} from '../contexts/ThemeContext';
import {RootStackParamList} from '../navigation/RootNavigator';
import {TEXT_STYLES} from '../constants/Typography';
import {t} from '../i18n/strings';
import BibleSelectionModal, {
  VerseSelection,
} from '../components/BibleSelectionModal';
import HymnSelectionModal from '../components/HymnSelectionModal';
import {useHymnsData} from '../hooks/useHymnsData';
import {useTutorial, useTutorialTarget} from '../contexts/TutorialContext';
import TutorialOverlay from '../components/TutorialOverlay';

type CultModeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'CultMode'
>;

const CultModeScreen = () => {
  const navigation = useNavigation<CultModeScreenNavigationProp>();
  const {theme} = useTheme();
  const {
    entries,
    addEntry,
    removeEntry,
    reorderEntries,
    isActive,
    toggleActive,
  } = useCultMode();
  const {hymns} = useHymnsData();
  const tutorial = useTutorial();
  const addButtonsRef = useTutorialTarget('cultAddButtons');
  const flashRowRef = useTutorialTarget('cultFlashRow');
  const listRef = useTutorialTarget('cultList');
  const activateRowRef = useTutorialTarget('cultActivateToggle');

  const [bibleModalVisible, setBibleModalVisible] = useState(false);
  const [hymnModalVisible, setHymnModalVisible] = useState(false);

  // Briefly highlight a row right after it's added, so the user sees where the
  // verse/hymn landed in the playlist. Cleared after the flash.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashEntry = useCallback(
    (id: string) => {
      setHighlightId(id);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      // During the tutorial the overlay spotlights + pulses this row for the
      // whole step, so keep it referenced (don't auto-clear) or the hole would
      // vanish mid-step and drop the row back under the scrim.
      if (tutorial.activeTutorial) return;
      highlightTimer.current = setTimeout(() => setHighlightId(null), 1600);
    },
    [tutorial.activeTutorial],
  );
  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    [],
  );

  const handleBibleSelect = useCallback(
    (
      bookId: number,
      bookName: string,
      chapter: number,
      selection: VerseSelection,
    ) => {
      let verseStart = 1;
      let verseEnd = 1;
      let isWholeChapter = false;
      if (selection.kind === 'single') {
        verseStart = selection.verse;
        verseEnd = selection.verse;
      } else if (selection.kind === 'range') {
        verseStart = selection.start;
        verseEnd = selection.end;
      } else {
        // 'whole' chapter — verseEnd is the chapter's real last verse, so
        // the label shows the correct range.
        verseStart = 1;
        verseEnd = selection.verseCount;
        isWholeChapter = true;
      }
      const id = addEntry({
        type: 'bible',
        bookId,
        bookName,
        chapter,
        verseStart,
        verseEnd,
        isWholeChapter,
        label: buildBibleLabel(bookName, chapter, verseStart, verseEnd),
      });
      setBibleModalVisible(false);
      flashEntry(id);
      tutorial.notifyProgress('cultBibleAdded');
    },
    [addEntry, flashEntry, tutorial],
  );

  const handleHymnSelect = useCallback(
    (hymnId: string, category: string, number: number) => {
      // HymnSelectionModal's callback doesn't include the title, so look it up.
      const hymn = hymns.find(h => h.id === hymnId);
      const title = hymn?.title ?? '';
      const id = addEntry({
        type: 'hymn',
        hymnId,
        category,
        hymnNumber: number,
        title,
        label: buildHymnLabel(category, number, title),
      });
      setHymnModalVisible(false);
      flashEntry(id);
      tutorial.notifyProgress('cultHymnAdded');
    },
    [addEntry, flashEntry, hymns, tutorial],
  );

  const handleRemove = useCallback(
    (entry: CultEntry) => {
      Alert.alert(t('cultMode.deleteTitle'), t('cultMode.deleteMessage'), [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => removeEntry(entry.id),
        },
      ]);
    },
    [removeEntry],
  );

  const renderItem = useCallback(
    ({item, drag, isActive: dragActive}: RenderItemParams<CultEntry>) => (
      <ScaleDecorator>
        <Pressable
          ref={item.id === highlightId ? flashRowRef : undefined}
          collapsable={false}
          onLongPress={drag}
          delayLongPress={200}
          style={[
            styles.itemContainer,
            {backgroundColor: theme.colors.backgroundSecondary},
            dragActive && styles.itemActive,
            item.id === highlightId && [
              styles.itemHighlight,
              {borderColor: theme.colors.navBackground},
            ],
          ]}>
          <View style={styles.dragHandle}>
            <Text
              style={[
                styles.dragHandleText,
                {color: theme.colors.textSecondary},
              ]}>
              ☰
            </Text>
          </View>
          <View style={styles.itemContent}>
            <Text
              style={[styles.itemTitle, {color: theme.colors.textPrimary}]}
              numberOfLines={2}>
              {item.label}
            </Text>
            <Text
              style={[styles.itemType, {color: theme.colors.textSecondary}]}>
              {item.type === 'bible' ? 'Baiboly' : 'Fihirana'}
            </Text>
          </View>
          <Pressable
            style={styles.removeButton}
            onPress={() => handleRemove(item)}
            hitSlop={8}>
            <Text
              style={[
                styles.removeButtonText,
                {color: theme.colors.textSecondary},
              ]}>
              ×
            </Text>
          </Pressable>
        </Pressable>
      </ScaleDecorator>
    ),
    [theme.colors, handleRemove, highlightId, flashRowRef],
  );

  const headerComponent = useMemo(
    () => (
      <View style={styles.addSection}>
        <View ref={addButtonsRef} collapsable={false} style={styles.addButtonsRow}>
          <Pressable
            onPress={() => setBibleModalVisible(true)}
            style={[
              styles.addButton,
              {backgroundColor: theme.colors.navBackground},
            ]}>
            <Text style={styles.addButtonText}>
              {t('cultMode.addBible')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setHymnModalVisible(true)}
            style={[
              styles.addButton,
              {backgroundColor: theme.colors.navBackground},
            ]}>
            <Text style={styles.addButtonText}>
              {t('cultMode.addHymn')}
            </Text>
          </Pressable>
        </View>
      </View>
    ),
    [theme.colors, addButtonsRef],
  );

  return (
    <SafeAreaView
      style={[
        styles.container,
        {backgroundColor: theme.colors.backgroundPrimary},
      ]}>
      <View
        style={[styles.header, {backgroundColor: theme.colors.navBackground}]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={8}>
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <Text style={[TEXT_STYLES.heading, styles.headerTitle]}>
          {t('cultMode.title')}
        </Text>
      </View>

      <View
        ref={activateRowRef}
        collapsable={false}
        style={[
          styles.activateRow,
          {backgroundColor: theme.colors.backgroundSecondary},
        ]}>
        <View style={{flex: 1}}>
          <Text
            style={[styles.activateLabel, {color: theme.colors.textPrimary}]}>
            {isActive ? t('cultMode.deactivate') : t('cultMode.activate')}
          </Text>
          {entries.length === 0 ? (
            <Text
              style={[
                styles.activateHint,
                {color: theme.colors.textSecondary},
              ]}>
              {t('cultMode.cannotActivateEmpty')}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => {
            // Stopping happens here, in the menu — never in the reader, so the
            // session can't be killed by a stray reader tap. Play → jump to the
            // reader; Pause → stay put.
            if (isActive) {
              toggleActive(false);
              return;
            }
            toggleActive(true);
            tutorial.notifyProgress('cultActivated');
            // Skip the jump during the tutorial: its next step drives Home
            // itself (showCultReaderNav).
            if (!tutorial.activeTutorial) navigation.navigate('Home');
          }}
          disabled={entries.length === 0}
          accessibilityRole="button"
          accessibilityLabel={
            isActive ? t('cultMode.deactivate') : t('cultMode.activate')
          }
          style={[
            styles.playButton,
            {backgroundColor: theme.colors.navBackground},
            entries.length === 0 && styles.playButtonDisabled,
          ]}>
          {isActive ? (
            <View style={styles.pauseIcon}>
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </View>
          ) : (
            <View style={styles.playTriangle} />
          )}
        </Pressable>
      </View>

      {/*
        Always render DraggableFlatList — never swap component types at this
        position. Swapping FlatList ⇄ DraggableFlatList when entries
        transition from empty → non-empty caused a Fabric mount-item race
        ("Unable to find viewState for tag …"). The single component handles
        both states via ListEmptyComponent.
      */}
      <View ref={listRef} collapsable={false} style={styles.listWrap}>
        <DraggableFlatList
          data={entries}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          onDragEnd={({from, to}) => {
            if (from !== to) reorderEntries(from, to);
          }}
          ListHeaderComponent={headerComponent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text
                style={[
                  styles.introText,
                  {color: theme.colors.textSecondary},
                ]}>
                {t('cultMode.intro')}
              </Text>
              <Text
                style={[
                  styles.emptyText,
                  {color: theme.colors.textSecondary},
                ]}>
                {t('cultMode.emptyState')}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      </View>


      <Modal
        visible={bibleModalVisible}
        animationType="slide"
        onRequestClose={() => setBibleModalVisible(false)}>
        <SafeAreaView
          style={{flex: 1, backgroundColor: theme.colors.backgroundPrimary}}>
          <BibleSelectionModal
            onClose={() => setBibleModalVisible(false)}
            onBibleSelect={handleBibleSelect}
          />
        </SafeAreaView>
      </Modal>

      <HymnSelectionModal
        visible={hymnModalVisible}
        hymns={hymns}
        currentCategory={null}
        currentNumber={null}
        onClose={() => setHymnModalVisible(false)}
        onHymnSelect={handleHymnSelect}
      />

      {/* Hide the coach overlay while an add-modal is open: the hymn modal is a
          transparent native Modal, so the card would otherwise bleed through
          behind it. Nothing to coach while the modal is up anyway. */}
      {!bibleModalVisible && !hymnModalVisible ? (
        <TutorialOverlay scope="cult" />
      ) : null}
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
  headerTitle: {color: '#FFFFFF', marginLeft: 8},
  backButton: {paddingHorizontal: 4},
  backButtonText: {color: '#FFFFFF', fontSize: 28, lineHeight: 30},
  activateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  activateLabel: {fontSize: 15, fontWeight: '600'},
  activateHint: {fontSize: 12, marginTop: 2, fontStyle: 'italic'},
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonDisabled: {opacity: 0.4},
  // Play triangle drawn with borders: a right-pointing triangle is a box with
  // transparent top/bottom borders and a solid left border. Nudge right 2px to
  // optically center it in the circle.
  playTriangle: {
    width: 0,
    height: 0,
    marginLeft: 4,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderLeftWidth: 15,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
  },
  pauseIcon: {flexDirection: 'row', gap: 5},
  pauseBar: {width: 5, height: 18, borderRadius: 1, backgroundColor: '#FFFFFF'},
  addSection: {paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8},
  addButtonsRow: {flexDirection: 'row', gap: 8},
  addButton: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {color: '#FFFFFF', fontSize: 14, fontWeight: '600'},
  listWrap: {flex: 1},
  listContent: {paddingBottom: 24},
  itemContainer: {
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  itemActive: {opacity: 0.85},
  itemHighlight: {borderWidth: 2},
  dragHandle: {paddingRight: 12},
  dragHandleText: {fontSize: 18},
  itemContent: {flex: 1},
  itemTitle: {fontSize: 16, fontWeight: '600', marginBottom: 4},
  itemType: {fontSize: 12, fontStyle: 'italic'},
  removeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    marginLeft: 8,
  },
  removeButtonText: {fontSize: 22, fontWeight: '300', lineHeight: 24},
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  introText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyText: {fontSize: 16, textAlign: 'center'},
});

export default CultModeScreen;
