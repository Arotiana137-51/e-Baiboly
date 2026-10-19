import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import {useCultMode} from '../contexts/CultModeContext';
import {
  CultEntry,
  buildBibleLabel,
  buildHymnLabel,
  isWholeChapterEntry,
} from '../types/cultMode';
import {useTheme} from '../contexts/ThemeContext';
import {RootStackParamList} from '../navigation/RootNavigator';
import {TEXT_STYLES} from '../constants/Typography';
import {t} from '../i18n/strings';
import BibleSelectionModal, {
  VerseSelection,
} from '../components/BibleSelectionModal';
import HymnSelectionModal from '../components/HymnSelectionModal';
import {MenuIcon} from '../components/MenuIcons';
import {useHymnsData} from '../hooks/useHymnsData';
import {useTutorial, useTutorialTarget} from '../contexts/TutorialContext';
import TutorialOverlay from '../components/TutorialOverlay';

type CultModeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'CultMode'
>;

const DELETE_RED = '#D32F2F';

// Two-line row text, music-app style: what it is, then where it comes from.
// A hymn whose title lookup failed falls back to its reference alone.
const describeEntry = (entry: CultEntry) => {
  if (entry.type === 'hymn') {
    const ref = `${entry.category} ${entry.hymnNumber}`;
    return entry.title
      ? {title: entry.title, subtitle: ref}
      : {title: ref, subtitle: ''};
  }
  let subtitle = t('cultMode.wholeChapter');
  if (!isWholeChapterEntry(entry)) {
    const range =
      entry.verseStart === entry.verseEnd
        ? `${entry.verseStart}`
        : `${entry.verseStart}-${entry.verseEnd}`;
    subtitle = t('cultMode.verses', {range});
  }
  return {title: `${entry.bookName} ${entry.chapter}`, subtitle};
};

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
    currentIndex,
    goTo,
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

  // Empty list: no summary line, the empty state below already says what to do.
  const bibleCount = entries.filter(e => e.type === 'bible').length;
  const summary =
    entries.length === 0
      ? ''
      : t('cultMode.summary', {
          bible: bibleCount,
          hymns: entries.length - bibleCount,
        });

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

  // Play → jump to the reader; Pause → stay put. Stopping happens here or on
  // the reader's ■, never through a stray reader tap.
  const handlePlayPause = () => {
    if (isActive) {
      toggleActive(false);
      return;
    }
    toggleActive(true);
    tutorial.notifyProgress('cultActivated');
    // Skip the jump during the tutorial: its next step drives Home
    // itself (showCultReaderNav).
    if (!tutorial.activeTutorial) navigation.navigate('Home');
  };

  // Like tapping a track in a music app: during a session, a row tap moves
  // the session to that entry and shows it in the reader.
  const jumpTo = useCallback(
    (index: number) => {
      goTo(index);
      navigation.navigate('Home');
    },
    [goTo, navigation],
  );

  const renderItem = useCallback(
    ({item, drag, getIndex, isActive: dragActive}: RenderItemParams<CultEntry>) => {
      const index = getIndex() ?? 0;
      const isCurrent = isActive && index === currentIndex;
      const {title, subtitle} = describeEntry(item);
      const isHighlighted = item.id === highlightId;
      return (
        <ScaleDecorator>
          <Swipeable
            enabled={!dragActive}
            friction={2}
            rightThreshold={40}
            renderRightActions={() => (
              <Pressable
                onPress={() => removeEntry(item.id)}
                accessibilityRole="button"
                style={styles.deleteAction}>
                <Text style={styles.deleteActionText}>{t('common.remove')}</Text>
              </Pressable>
            )}>
            <Pressable
              ref={isHighlighted ? flashRowRef : undefined}
              collapsable={false}
              onPress={isActive ? () => jumpTo(index) : undefined}
              onLongPress={drag}
              delayLongPress={200}
              // Swipe-to-delete is invisible to screen readers.
              accessibilityActions={[{name: 'delete', label: t('common.remove')}]}
              onAccessibilityAction={e => {
                if (e.nativeEvent.actionName === 'delete') removeEntry(item.id);
              }}
              style={[
                styles.itemContainer,
                {backgroundColor: theme.colors.backgroundPrimary},
                dragActive && [
                  styles.itemDragging,
                  {backgroundColor: theme.colors.backgroundSecondary},
                ],
                isHighlighted && {
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderColor: theme.colors.navBackground,
                },
              ]}>
              <Text
                style={[styles.dragHandleText, {color: theme.colors.textSecondary}]}>
                ☰
              </Text>
              {/* The current entry gets a solid tile, the rest a light tint. */}
              <View style={styles.itemIcon}>
                <View
                  style={[
                    styles.itemIconTint,
                    isCurrent ? styles.tintSolid : styles.tintLight,
                    {backgroundColor: theme.colors.navBackground},
                  ]}
                />
                <MenuIcon
                  name={item.type === 'bible' ? 'bible' : 'note'}
                  color={isCurrent ? '#FFFFFF' : theme.colors.accentBlue}
                />
                <Text
                  style={[styles.itemIndexText, {color: theme.colors.textSecondary}]}>
                  {index + 1}
                </Text>
              </View>
              <View style={styles.itemContent}>
                <Text
                  style={[
                    styles.itemTitle,
                    {
                      color: isCurrent
                        ? theme.colors.accentBlue
                        : theme.colors.textPrimary,
                    },
                  ]}
                  numberOfLines={1}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text
                    style={[
                      styles.itemSubtitle,
                      {color: theme.colors.textSecondary},
                    ]}
                    numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {/* No confirmation: an entry only points at bundled Bible or
                  hymn text, so re-adding it restores it exactly. */}
              <Pressable
                onPress={() => removeEntry(item.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('common.remove')}
                style={styles.trashButton}>
                <MenuIcon name="trash" color={theme.colors.textSecondary} />
              </Pressable>
            </Pressable>
          </Swipeable>
        </ScaleDecorator>
      );
    },
    [
      theme.colors,
      highlightId,
      flashRowRef,
      isActive,
      currentIndex,
      jumpTo,
      removeEntry,
    ],
  );

  const playDisabled = entries.length === 0;

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
        style={[styles.actions, {borderBottomColor: theme.colors.divider}]}>
        <View style={styles.sessionRow}>
          <View style={styles.sessionText}>
            <Text
              style={[styles.sessionLabel, {color: theme.colors.textPrimary}]}>
              {isActive ? t('cultMode.deactivate') : t('cultMode.activate')}
            </Text>
            {summary ? (
              <Text
                style={[styles.sessionMeta, {color: theme.colors.textSecondary}]}>
                {summary}
              </Text>
            ) : null}
          </View>
          <Pressable
            ref={activateRowRef}
            collapsable={false}
            onPress={handlePlayPause}
            disabled={playDisabled}
            accessibilityRole="button"
            accessibilityLabel={
              isActive ? t('cultMode.deactivate') : t('cultMode.activate')
            }
            style={[
              styles.playButton,
              {backgroundColor: theme.colors.navBackground},
              playDisabled && styles.playButtonDisabled,
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

        <View ref={addButtonsRef} collapsable={false} style={styles.addButtonsRow}>
          {[
            {label: t('cultMode.addBible'), onPress: () => setBibleModalVisible(true)},
            {label: t('cultMode.addHymn'), onPress: () => setHymnModalVisible(true)},
          ].map(button => (
            <Pressable
              key={button.label}
              onPress={button.onPress}
              style={[
                styles.addButton,
                {backgroundColor: theme.colors.navBackground},
              ]}>
              <Text style={styles.addButtonPlus}>+</Text>
              <Text style={styles.addButtonText} numberOfLines={1}>
                {button.label}
              </Text>
            </Pressable>
          ))}
        </View>
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcons}>
                <MenuIcon name="bible" color={theme.colors.textSecondary} />
                <MenuIcon name="note" color={theme.colors.textSecondary} />
              </View>
              <Text
                style={[styles.emptyText, {color: theme.colors.textPrimary}]}>
                {t('cultMode.emptyState')}
              </Text>
              <Text
                style={[
                  styles.introText,
                  {color: theme.colors.textSecondary},
                ]}>
                {t('cultMode.intro')}
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
          style={[
            styles.container,
            {backgroundColor: theme.colors.backgroundPrimary},
          ]}>
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

const PLAY_SIZE = 56;
const ICON_TILE = 40;

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
  actions: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sessionRow: {flexDirection: 'row', alignItems: 'center'},
  sessionText: {flex: 1, paddingRight: 12},
  sessionLabel: {fontSize: 18, fontWeight: '700'},
  sessionMeta: {fontSize: 13, marginTop: 4},
  playButton: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: PLAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 2},
  },
  playButtonDisabled: {opacity: 0.35, elevation: 0, shadowOpacity: 0},
  // Play triangle drawn with borders: a right-pointing triangle is a box with
  // transparent top/bottom borders and a solid left border. Nudged right to
  // optically center it in the circle.
  playTriangle: {
    width: 0,
    height: 0,
    marginLeft: 5,
    borderTopWidth: 11,
    borderBottomWidth: 11,
    borderLeftWidth: 18,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
  },
  pauseIcon: {flexDirection: 'row', gap: 6},
  pauseBar: {width: 6, height: 22, borderRadius: 1, backgroundColor: '#FFFFFF'},
  addButtonsRow: {flexDirection: 'row', gap: 8, marginTop: 14},
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addButtonPlus: {color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginRight: 6, lineHeight: 20},
  addButtonText: {color: '#FFFFFF', fontSize: 14, fontWeight: '600', flexShrink: 1},
  listWrap: {flex: 1},
  listContent: {paddingVertical: 8, paddingBottom: 24},
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  itemDragging: {
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 3},
  },
  dragHandleText: {fontSize: 18, paddingLeft: 4, paddingRight: 10, opacity: 0.6},
  itemIcon: {
    width: ICON_TILE,
    height: ICON_TILE,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The theme colour is a plain hex the user may personalise, so the tint is
  // an opacity layer rather than an alpha suffix on the colour.
  itemIconTint: {...StyleSheet.absoluteFillObject, borderRadius: 8},
  tintSolid: {opacity: 1},
  tintLight: {opacity: 0.12},
  // Position in the running order, set like a subscript off the tile's
  // bottom-right corner.
  itemIndexText: {
    position: 'absolute',
    right: -10,
    bottom: -4,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  itemContent: {flex: 1},
  itemTitle: {fontSize: 16, fontWeight: '600'},
  itemSubtitle: {fontSize: 13, marginTop: 2},
  trashButton: {padding: 8, marginLeft: 4},
  deleteAction: {
    backgroundColor: DELETE_RED,
    justifyContent: 'center',
    alignItems: 'center',
    width: 96,
    marginRight: 8,
    borderRadius: 10,
  },
  deleteActionText: {color: '#FFFFFF', fontSize: 14, fontWeight: '700'},
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  emptyIcons: {flexDirection: 'row', gap: 12, marginBottom: 16, opacity: 0.7},
  emptyText: {fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 12},
  introText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});

export default CultModeScreen;
