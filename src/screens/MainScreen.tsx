import React, {useCallback, useEffect, useMemo, useState, useRef} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Dimensions,
  FlatList,
  Platform,
  AppState,
  PanResponder,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TopBar from '../components/TopBar';
import BibleReaderView, {type SelectedVerseRange} from '../components/BibleReaderView';
import HymnReaderView from '../components/HymnReaderView';
import BibleSelectionModal, {type VerseSelection} from '../components/BibleSelectionModal';
import HymnSelectionModal from '../components/HymnSelectionModal';
import CustomBottomNav from '../components/CustomBottomNav';
import ReportIssueModal from '../components/ReportIssueModal';
import SelectionTopBar from '../components/SelectionTopBar';
import VerseActionPopover from '../components/VerseActionPopover';
import ChapterEditorModal from '../components/ChapterEditorModal';
import HymnActionPopover from '../components/HymnActionPopover';
import {ShareCardModal} from '../components/ShareCardModal';
import {
  buildBibleShareItems,
  buildHymnShareItems,
  type ShareCardData,
  type ShareReference,
} from '../utils/shareCard';
import {useChapterMarks, useHymnMarks} from '../hooks/useChapterMarks';
import {useJesusName} from '../contexts/JesusNameContext';
import {
  buildChapterDisplay,
  buildHymnDisplay,
  HYMN_CHORUS_LABEL,
  type ChapterMark,
} from '../utils/chapterMarks';
import {BibleCrossReference, BibleVerse, useBibleData} from '../hooks/useBibleData';
import { useHymnsData, Hymn } from '../hooks/useHymnsData';
import { useFavorites } from '../hooks/useFavorites';
import { useHymnFavorites } from '../hooks/useHymnFavorites';
import { useBibleHistory } from '../hooks/useBibleHistory';
import { useHymnHistory } from '../hooks/useHymnHistory';
import { useKeepAwake } from '../hooks/useKeepAwake';
import HamburgerMenuPopover, {
  HamburgerMenuItemKey,
} from '../components/HamburgerMenuPopover';
import {useTheme} from '../contexts/ThemeContext';
import {useCultMode} from '../contexts/CultModeContext';
import {WHOLE_CHAPTER_VERSE_END} from '../types/cultMode';
import {useTutorial, useTutorialTarget, isOnboardingDone} from '../contexts/TutorialContext';
import {ONBOARDING_ID, CULT_TUTORIAL_ID, HIGHLIGHT_TUTORIAL_ID} from '../tutorials/registry';
import TutorialOverlay from '../components/TutorialOverlay';
import type {DriveVerb} from '../tutorials/registry';
import { RootStackParamList } from '../navigation/RootNavigator';
import { TEXT_STYLES, scaleFontSize } from '../constants/Typography';
import { ISSUE_REPORT_ENDPOINT_URL } from '../constants/reporting';
import { useResponsive } from '../theme/responsive';
import {getBibleBookShortName} from '../utils/bibleBookNames';
import {t} from '../i18n/strings';
import {hexToRgba} from '../utils/colorUtils';
import type {InlineBibleRef} from '../utils/bibleRefs';
import {
  enqueueIssueReport,
  flushIssueReports,
  IssueReport,
} from '../services/reporting/issueReportQueue';

// Persisted last-read Bible position, restored on launch instead of the
// hardcoded Marka 16 default. {bookId, bookName, chapter}.
const LAST_READ_BIBLE_KEY = 'last_read_bible';
// Persisted last-read mode ('bible' | 'hymnal') and hymn id, so a user who
// closed the app on a hymn reopens on that hymn, not the Bible default.
const LAST_READ_MODE_KEY = 'last_read_mode';
const LAST_READ_HYMN_KEY = 'last_read_hymn';
// Persisted in-app font scale so the reader size survives a relaunch.
const FONT_SCALE_KEY = 'font_scale';
const USER_FONT_SCALE_MIN = 0.8;
const USER_FONT_SCALE_MAX = 1.6;

const TOP_BAR_TOOLBAR_BASE = Platform.OS === 'android' ? 56 : 44;
const TOP_BAR_EXTRA_TOP_PADDING = 6;
const HAMBURGER_CARET_HEIGHT = 12;
// Clears CustomBottomNav's own height (not measured — it sizes itself) plus
// a visible gap, so the transport controls float just above the tab bar.
const CULT_PLAYER_BAR_LIFT = 88;
// Shared translucency for the prev/stop/next pills AND their icon glyphs, so
// the verse/hymn text keeps showing through the controls while reading.
const CULT_PLAYER_BUTTON_ALPHA = 0.48;

export type AppMode = 'bible' | 'hymnal';

// Process-lifetime guard: onboarding auto-starts at most once per app run, so
// Home remounting (returning from another screen) can't relaunch the tutorial.
let onboardingAutoStarted = false;

type MainScreenProps = {
  navigation: any;
};

const MainScreen = ({navigation}: MainScreenProps) => {
  const route = useRoute<RouteProp<RootStackParamList, 'Home'>>();
  const {theme, isDarkMode, setDarkMode} = useTheme();
  const insets = useSafeAreaInsets();
  useKeepAwake();
  const { scale: rScale, isAndroid: rIsAndroid } = useResponsive();
  const TOP_BAR_TOOLBAR_HEIGHT = Math.max(TOP_BAR_TOOLBAR_BASE, rScale(rIsAndroid ? 52 : 44));
  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height);
  const flatListRef = useRef<FlatList>(null);
  const [shouldScrollToVerse, setShouldScrollToVerse] = useState<number | null>(null);
  // Set to true by the topnav chevrons after they advance the chapter, so
  // the Bible reader scrolls back to verse 1 once the new chapter's verses
  // render. Intentionally narrow: inline-ref taps and cult-mode entries
  // use `shouldScrollToVerse` for their own scroll target and never set
  // this flag, so the two paths cannot collide.
  const [shouldScrollToTop, setShouldScrollToTop] = useState(false);
  // Set right before restoring the last-read book/chapter or hymn from
  // storage on launch, so the history-logging effect below can tell "the app
  // reopened here" apart from "the user actually navigated here" and skip
  // logging the former. Without this, reopening the app re-logs (and so
  // resurrects) whatever history entry the user deleted for the last-read
  // item, since restoring position and logging a visit shared one effect.
  const skipNextHistoryLogRef = useRef(false);

  const appState = useRef(AppState.currentState);

  // Calculate adaptive safe area padding (1.5% of screen height, but only if inset is significant)
  const maxPadding = screenHeight * 0.015;
  const minSignificantInset = 20; // Only apply padding if inset is more than 20px
  const proportionalTopPadding = insets.top > minSignificantInset ? Math.min(insets.top, maxPadding) : 0;
  const proportionalBottomPadding = insets.bottom > minSignificantInset ? Math.min(insets.bottom, maxPadding) : 0;

  // Update screen height on orientation change
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenHeight(window.height);
    });
    return () => subscription?.remove();
  }, []);

  const [mode, setMode] = useState<AppMode>(route.params?.mode || 'bible');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [currentBook, setCurrentBook] = useState<{ id: number; name: string } | null>(
    route.params?.selectedBook || null
  );
  const [currentChapter, setCurrentChapter] = useState<number>(
    route.params?.selectedChapter || 16
  );
  const [selectedVerseNumber, setSelectedVerseNumber] = useState<number | null>(
    route.params?.selectedVerse || null
  );
  const [selectedVerseRange, setSelectedVerseRange] = useState<SelectedVerseRange>(null);
  const [bibleSelectionVisible, setBibleSelectionVisible] = useState(false);

  const [bibleSelectionProgress, setBibleSelectionProgress] = useState<{
    step: 'book' | 'chapter' | 'verse';
    selectedBook: {id: number; name: string} | null;
    selectedChapter: number | null;
  }>({step: 'book', selectedBook: null, selectedChapter: null});
  const [requestedBibleSelectionStep, setRequestedBibleSelectionStep] = useState<
    'book' | 'chapter' | 'verse' | null
  >(null);

  const [currentHymnId, setCurrentHymnId] = useState<string | null>(
    route.params?.selectedHymnId || null
  );
  const [currentHymnNumber, setCurrentHymnNumber] = useState<number | null>(null);
  const [currentHymnCategory, setCurrentHymnCategory] = useState<string | null>(null);

  useEffect(() => {
    const params = route.params;
    if (!params) {
      return;
    }

    if (params.mode) {
      setMode(params.mode);
    }

    // React Navigation merges (not replaces) params when navigating back to a
    // screen already in the stack, so a stale Bible or hymn field from an
    // earlier visit can still be sitting in `params`. Gate each side on the
    // incoming `mode` so a leftover field never overrides the field the
    // caller actually meant to set.
    if (params.mode !== 'hymnal') {
      if (params.selectedBook) {
        setMode('bible');
        setCurrentBook(params.selectedBook);
      }

      if (typeof params.selectedChapter === 'number') {
        setMode('bible');
        setCurrentChapter(params.selectedChapter);
      }

      if (typeof params.selectedVerse === 'number') {
        setMode('bible');
        setSelectedVerseRange(null);
        setSelectedVerseNumber(params.selectedVerse);
        setShouldScrollToVerse(params.selectedVerse);
      }
    }

    if (params.mode !== 'bible' && params.selectedHymnId) {
      setMode('hymnal');
      setCurrentHymnId(params.selectedHymnId);
    }
  }, [route.params]);

  const { books, verses, loadVerses, isLoading, getCrossReferences } = useBibleData();
  const {
    hymns,
    verses: hymnVerses,
    loadHymnVerses,
    isLoading: isHymnsLoading,
  } = useHymnsData();
  const { addToFavorites: addToBibleFavorites } = useFavorites();
  const { addToFavorites: addToHymnFavorites } = useHymnFavorites();
  const { logAccess: logBibleAccess } = useBibleHistory();
  const { logAccess: logHymnAccess } = useHymnHistory();
  const cultMode = useCultMode();
  const tutorial = useTutorial();
  const hlReaderAreaRef = useTutorialTarget('hlReaderArea');
  const cultReaderNavRef = useTutorialTarget('cultReaderNav');
  const cultReaderNavNextRef = useTutorialTarget('cultReaderNavNext');
  const cultStopButtonRef = useTutorialTarget('cultStopButton');

  const [crossRefModalVisible, setCrossRefModalVisible] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<BibleVerse | null>(null);
  const [crossRefs, setCrossRefs] = useState<BibleCrossReference[]>([]);
  const [isCrossRefsLoading, setIsCrossRefsLoading] = useState(false);

  // Verse action popover state
  const [verseActionVisible, setVerseActionVisible] = useState(false);
  const [selectedVerseForAction, setSelectedVerseForAction] = useState<BibleVerse | null>(null);

  // Share card modal — non-null while open
  const [shareCard, setShareCard] = useState<ShareCardData | null>(null);

  // Chapter editor modal state
  const [chapterEditorVisible, setChapterEditorVisible] = useState(false);
  const [chapterEditorScrollVerseNumber, setChapterEditorScrollVerseNumber] =
    useState<number | null>(null);
  const {transformText} = useJesusName();
  const {marks: chapterMarks, setAllMarks, clearChapter} = useChapterMarks(
    currentBook?.id ?? null,
    currentChapter ?? null,
  );
  // Same editor and mark model as the Bible, stored per hymn.
  const {
    marks: hymnMarks,
    setAllMarks: setAllHymnMarks,
    clearChapter: clearHymnMarks,
  } = useHymnMarks(mode === 'hymnal' ? currentHymnId : null);

  // Hymn action popover state
  const [hymnActionVisible, setHymnActionVisible] = useState(false);

  const [selectedHymnStanzaNumber, setSelectedHymnStanzaNumber] = useState<number | null>(null);
  const [selectedHymnStanzaText, setSelectedHymnStanzaText] = useState<string | null>(null);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReference, setReportReference] = useState('');
  const [reportText, setReportText] = useState('');
  const [reportType, setReportType] = useState<'bible' | 'hymn'>('bible');

  // Hymn selection modal state
  const [hymnSelectionVisible, setHymnSelectionVisible] = useState(false);

  const swipeResponder = useMemo(() => {
    const SWIPE_MIN_DX = 60;
    const SWIPE_ACTIVATION_DX = 18;
    const SWIPE_MAX_DY = 80;

    const isSwipeEligible = () => {
      if (isMenuOpen) return false;
      if (bibleSelectionVisible) return false;
      if (verseActionVisible) return false;
      if (hymnActionVisible) return false;
      if (crossRefModalVisible) return false;
      if (reportModalVisible) return false;
      if (hymnSelectionVisible) return false;
      if (chapterEditorVisible) return false;
      return true;
    };

    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (!isSwipeEligible()) return false;

        const dx = gestureState.dx;
        const dy = gestureState.dy;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDy > SWIPE_MAX_DY) return false;

        return absDx > SWIPE_ACTIVATION_DX && absDx > absDy * 1.35;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!isSwipeEligible()) return;

        const dx = gestureState.dx;
        const absDy = Math.abs(gestureState.dy);
        if (absDy > SWIPE_MAX_DY) return;

        if (dx >= SWIPE_MIN_DX) {
          if (mode !== 'hymnal') setMode('hymnal');
          return;
        }

        if (dx <= -SWIPE_MIN_DX) {
          if (mode !== 'bible') setMode('bible');
        }
      },
      onPanResponderTerminate: () => {
        return;
      },
    });
  }, [
    bibleSelectionVisible,
    crossRefModalVisible,
    hymnActionVisible,
    hymnSelectionVisible,
    isMenuOpen,
    mode,
    reportModalVisible,
    verseActionVisible,
    chapterEditorVisible,
  ]);

  // Initial Bible position: restore the user's last-read book+chapter from
  // storage; fall back to Marka 16 only when there's nothing saved. Skipped
  // when a book is already set (deep link / route param).
  // Restore last-read mode once on launch, unless a route param already forced
  // one (deep link / explicit navigation).
  const didRestoreMode = useRef(false);
  useEffect(() => {
    if (didRestoreMode.current) return;
    didRestoreMode.current = true;
    if (route.params?.mode) return;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LAST_READ_MODE_KEY);
        if (stored === 'hymnal' || stored === 'bible') setMode(stored);
      } catch {}
    })();
  }, [route.params?.mode]);

  // Restore the font scale once, then persist every change. The ref keeps the
  // initial default from overwriting the stored value before the read lands.
  const didRestoreFontScale = useRef(false);
  useEffect(() => {
    (async () => {
      try {
        const stored = parseFloat((await AsyncStorage.getItem(FONT_SCALE_KEY)) ?? '');
        if (stored >= USER_FONT_SCALE_MIN && stored <= USER_FONT_SCALE_MAX) setFontScale(stored);
      } catch {}
      didRestoreFontScale.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!didRestoreFontScale.current) return;
    AsyncStorage.setItem(FONT_SCALE_KEY, String(fontScale)).catch(() => {});
  }, [fontScale]);

  const didRestoreBible = useRef(false);
  useEffect(() => {
    if (didRestoreBible.current || books.length === 0) {
      return;
    }
    if (currentBook) {
      didRestoreBible.current = true;
      return;
    }
    didRestoreBible.current = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LAST_READ_BIBLE_KEY);
        if (stored) {
          const {bookId, bookName, chapter} = JSON.parse(stored);
          if (books.find(b => b.id === bookId)) {
            skipNextHistoryLogRef.current = true;
            setCurrentBook({id: bookId, name: bookName});
            setCurrentChapter(chapter);
            return;
          }
        }
      } catch (error) {
        console.error('Error restoring last-read Bible position:', error);
      }
      const defaultBook = books.find(b => b.name === 'Marka') ?? books[0];
      skipNextHistoryLogRef.current = true;
      setCurrentBook({id: defaultBook.id, name: defaultBook.name});
    })();
  }, [books, currentBook]);

  const didRestoreHymn = useRef(false);
  useEffect(() => {
    if (mode !== 'hymnal' || hymns.length === 0 || currentHymnId) return;

    const applyHymn = (id: string) => {
      const hymn = hymns.find(h => h.id === id);
      if (!hymn) return false;
      setCurrentHymnId(hymn.id);
      setCurrentHymnNumber(hymn.number);
      setCurrentHymnCategory(hymn.category || null);
      return true;
    };

    const ffpm1 = hymns.find(h => h.id === 'ffpm_1' || (h.category === 'ffpm' && h.number === 1));
    const firstFfpm = hymns
      .filter(h => h.category === 'ffpm')
      .sort((a, b) => a.number - b.number)[0];
    const defaultHymn = ffpm1 ?? firstFfpm ?? hymns[0];

    if (didRestoreHymn.current) {
      applyHymn(defaultHymn.id);
      return;
    }
    didRestoreHymn.current = true;
    // Restore last-read hymn; fall back to FFPM 1 if nothing saved or it's gone.
    (async () => {
      try {
        const storedId = await AsyncStorage.getItem(LAST_READ_HYMN_KEY);
        if (storedId) {
          skipNextHistoryLogRef.current = true;
          if (applyHymn(storedId)) return;
          skipNextHistoryLogRef.current = false;
        }
      } catch {}
      skipNextHistoryLogRef.current = true;
      applyHymn(defaultHymn.id);
    })();
  }, [mode, hymns, currentHymnId]);

  useEffect(() => {
    if (mode === 'hymnal' && currentHymnId) {
      loadHymnVerses(currentHymnId);
    }
  }, [mode, currentHymnId, loadHymnVerses]);

  useEffect(() => {
    if (mode === 'bible' && currentBook) {
      loadVerses(currentBook.id, currentChapter);
    } else if (mode === 'hymnal' && currentHymnId) {
      loadHymnVerses(currentHymnId);
    }
  }, [mode, currentBook, currentChapter, currentHymnId, loadVerses, loadHymnVerses]);

  useEffect(() => {
    if (mode !== 'hymnal') {
      return;
    }

    if (!currentHymnId || hymns.length === 0) {
      return;
    }

    const hymn = hymns.find(h => h.id === currentHymnId);
    if (!hymn) {
      return;
    }

    if (currentHymnNumber !== hymn.number) {
      setCurrentHymnNumber(hymn.number);
    }

    const nextCategory = hymn.category || null;
    if (currentHymnCategory !== nextCategory) {
      setCurrentHymnCategory(nextCategory);
    }
  }, [mode, currentHymnCategory, currentHymnId, currentHymnNumber, hymns]);

  // Auto-scroll to selected verse when verses are loaded
  useEffect(() => {
    if (shouldScrollToVerse === null || verses.length === 0) {
      return;
    }

    // When a range is active, the reader filters its FlatList down to just
    // the range, so the target verse is at index 0 — no scroll needed, and
    // scrolling against the full-chapter index would crash with
    // "scrollToIndex out of range" because the visible list is shorter.
    if (selectedVerseRange) {
      setShouldScrollToVerse(null);
      return;
    }

    const verseIndex = verses.findIndex(
      verse => verse.verse_number === shouldScrollToVerse,
    );
    if (verseIndex === -1) {
      // Target verse missing in this chapter — unblock future scroll requests.
      setShouldScrollToVerse(null);
      return;
    }

    if (!flatListRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: verseIndex,
        viewPosition: 0.2, // Position verse at 20% from top
        animated: true,
      });
      setShouldScrollToVerse(null);
    }, 100);

    return () => clearTimeout(timer);
  }, [verses, shouldScrollToVerse, selectedVerseRange]);

  // Chevron-driven scroll-to-top: wait until the new chapter's verses have
  // loaded before scrolling, otherwise the call lands on the previous
  // chapter's FlatList contents. Mirrors the shouldScrollToVerse effect
  // above but without an index — we use scrollToOffset(0) so it's safe even
  // if the list is empty mid-transition.
  useEffect(() => {
    if (!shouldScrollToTop) return;
    if (mode !== 'bible') {
      setShouldScrollToTop(false);
      return;
    }
    if (verses.length === 0) return;
    if (!flatListRef.current) {
      setShouldScrollToTop(false);
      return;
    }
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToOffset({offset: 0, animated: true});
      setShouldScrollToTop(false);
    }, 50);
    return () => clearTimeout(timer);
  }, [verses, shouldScrollToTop, mode]);

  useEffect(() => {
    if (mode === 'bible' && currentBook && verses.length > 0) {
      if (skipNextHistoryLogRef.current) {
        skipNextHistoryLogRef.current = false;
      } else {
        logBibleAccess(
          { book_id: currentBook.id, chapter: currentChapter, verse_number: 1, text: '', id: 0 } as BibleVerse,
          currentBook.name
        );
      }
      // Remember where we are, so the next launch reopens here (not Marka 16).
      AsyncStorage.setItem(
        LAST_READ_BIBLE_KEY,
        JSON.stringify({bookId: currentBook.id, bookName: currentBook.name, chapter: currentChapter}),
      ).catch(() => {});
      AsyncStorage.setItem(LAST_READ_MODE_KEY, 'bible').catch(() => {});
    } else if (mode === 'hymnal' && currentHymnId && hymnVerses.length > 0) {
      const currentHymn = hymns.find(h => h.id === currentHymnId);
      if (currentHymn) {
        if (skipNextHistoryLogRef.current) {
          skipNextHistoryLogRef.current = false;
        } else {
          logHymnAccess(currentHymn);
        }
      }
      AsyncStorage.setItem(LAST_READ_MODE_KEY, 'hymnal').catch(() => {});
      AsyncStorage.setItem(LAST_READ_HYMN_KEY, currentHymnId).catch(() => {});
    }
  }, [mode, currentBook, currentChapter, currentHymnId, verses, hymnVerses, hymns, logBibleAccess, logHymnAccess]);

  useEffect(() => {
    if (mode !== 'bible') {
      setBibleSelectionVisible(false);
      setSelectedVerseNumber(null);
      setSelectedVerseRange(null);
    }
  }, [mode]);

  const bibleTitleShort = currentBook
    ? `${getBibleBookShortName(currentBook.name, currentBook.id)} ${currentChapter}`.trim()
    : `${currentChapter}`.trim();

  const getChapterText = (chapter: number) => chapter === 1 ? 'voalohany' : `faha-${chapter}`;

  const bibleTitleLong = currentBook
    ? (
        currentBook.id === 18 ||
        currentBook.id === 19 ||
        currentBook.id === 20 ||
        currentBook.id === 21 ||
        currentBook.id === 22 ||
        currentBook.id === 25
          ? `${getBibleBookShortName(currentBook.name, currentBook.id)} ${getChapterText(currentChapter)}`
          : `${currentBook.name}\nToko ${getChapterText(currentChapter)}`
      ).trim()
    : `${currentChapter}`.trim();

  const title =
    mode === 'bible'
      ? bibleTitleShort
      : `${
          currentHymnCategory
            ? currentHymnCategory === 'ff'
              ? 'F.Fanampiny '
              : currentHymnCategory === 'fifo'
                ? 'F. Fifohazana '
                : `${currentHymnCategory.toUpperCase()} `
            : 'Fihirana '
        }${currentHymnNumber ?? ''}`.trim();

  const handleInlineBibleRefPress = useCallback((ref: InlineBibleRef) => {
    setMode('bible');
    setSelectedVerseNumber(null);
    setSelectedVerseRange({start: ref.verseStart, end: ref.verseEnd});
    setCurrentBook({id: ref.bookId, name: ref.bookName});
    setCurrentChapter(ref.chapter);
    // Reset then re-set so repeated taps to the same verse still scroll.
    setShouldScrollToVerse(null);
    setTimeout(() => setShouldScrollToVerse(ref.verseStart), 0);
  }, []);

  // Cult mode propagator: when the active entry changes, drive the reader
  // (mode + book/chapter/range or hymn id/number/category) from it.
  // Whole-chapter Bible entries translate back to a null range so no banner
  // shows. The verseEnd>=WHOLE_CHAPTER_VERSE_END fallback covers entries
  // saved before isWholeChapter existed.
  useEffect(() => {
    if (!cultMode.isActive || !cultMode.currentEntry) return;
    const entry = cultMode.currentEntry;
    if (entry.type === 'bible') {
      setMode('bible');
      setCurrentBook({id: entry.bookId, name: entry.bookName});
      setCurrentChapter(entry.chapter);
      setSelectedVerseNumber(null);
      const isWholeChapter =
        entry.isWholeChapter ?? entry.verseEnd >= WHOLE_CHAPTER_VERSE_END;
      if (isWholeChapter) {
        setSelectedVerseRange(null);
        setShouldScrollToVerse(null);
      } else {
        setSelectedVerseRange({
          start: entry.verseStart,
          end: entry.verseEnd,
        });
        // Re-set so repeated steps to the same verse still scroll.
        setShouldScrollToVerse(null);
        setTimeout(() => setShouldScrollToVerse(entry.verseStart), 0);
      }
    } else {
      setMode('hymnal');
      setCurrentHymnId(entry.hymnId);
      setCurrentHymnNumber(entry.hymnNumber);
      setCurrentHymnCategory(entry.category || null);
    }
  }, [cultMode.isActive, cultMode.currentEntry]);

  // Topnav chevrons always navigate chapters (Bible) or hymns within the
  // current category (hymnal) — even when cult mode is active. Playlist
  // navigation lives on the dedicated bottom overlay (`‹` / `›`) rendered
  // below; the two controls are deliberately separate so the user keeps
  // free chapter-by-chapter browsing during a prayer session.
  const handlePreviousChapter = () => {
    if (mode === 'bible' && currentBook) {
      setSelectedVerseRange(null);
      setSelectedVerseNumber(null);
      if (currentChapter > 1) {
        setCurrentChapter(currentChapter - 1);
        setShouldScrollToTop(true);
      } else {
        // At chapter 1 → jump to last chapter of previous book
        const prevBook = books.find(b => b.id === currentBook.id - 1);
        if (prevBook) {
          setCurrentBook({ id: prevBook.id, name: prevBook.name });
          setCurrentChapter(prevBook.chapters);
          setShouldScrollToTop(true);
        }
      }
    } else if (mode === 'hymnal' && currentHymnNumber && currentHymnCategory && currentHymnNumber > 1) {
      // Find previous hymn within the same category
      const prevHymn = hymns.find(h => h.category === currentHymnCategory && h.number === currentHymnNumber - 1);
      if (prevHymn) {
        setCurrentHymnId(prevHymn.id);
        setCurrentHymnNumber(prevHymn.number);
        setCurrentHymnCategory(prevHymn.category || null);
      }
    }
  };

  const handleNextChapter = () => {
    if (mode === 'bible' && currentBook) {
      setSelectedVerseRange(null);
      setSelectedVerseNumber(null);
      const currentBookMeta = books.find(b => b.id === currentBook.id);
      const lastChapter = currentBookMeta?.chapters ?? currentChapter;
      if (currentChapter < lastChapter) {
        setCurrentChapter(currentChapter + 1);
        setShouldScrollToTop(true);
      } else {
        // At last chapter → jump to chapter 1 of next book
        const nextBook = books.find(b => b.id === currentBook.id + 1);
        if (nextBook) {
          setCurrentBook({ id: nextBook.id, name: nextBook.name });
          setCurrentChapter(1);
          setShouldScrollToTop(true);
        }
      }
    } else if (mode === 'hymnal' && currentHymnNumber && currentHymnCategory) {
      // Find next hymn within the same category
      const nextHymn = hymns.find(h => h.category === currentHymnCategory && h.number === currentHymnNumber + 1);
      if (nextHymn) {
        setCurrentHymnId(nextHymn.id);
        setCurrentHymnNumber(nextHymn.number);
        setCurrentHymnCategory(nextHymn.category || null);
      }
    }
  };

  const handleMenuSelect = (key: HamburgerMenuItemKey) => {
    setIsMenuOpen(false);

    switch (key) {
      case 'favorites':
        navigation.navigate('Favorites', { mode });
        return;
      case 'history':
        navigation.navigate('History', { mode });
        return;
      case 'misc':
        navigation.navigate('Misc');
        return;
      case 'notes':
        navigation.navigate('Notes');
        return;
      case 'personalization':
        // Explicit firstRun:false so the brand logo/welcome (first-launch only)
        // never leak in via the route's initialParams when the color picker is
        // reopened from this menu.
        navigation.navigate('Personalization', {firstRun: false});
        return;
      case 'cultMode':
        tutorial.notifyProgress('cultMenuSelected');
        navigation.navigate('CultMode');
        return;
      case 'help':
        navigation.navigate('Help');
        return;
      case 'readingReminder':
        navigation.navigate('ReadingReminder');
        return;
      default: {
        const _exhaustiveCheck: never = key;
        return _exhaustiveCheck;
      }
    }
  };

  const handleHymnStanzaDoubleTap = (stanzaNumber: number, stanzaText: string) => {
    setSelectedHymnStanzaNumber(stanzaNumber);
    setSelectedHymnStanzaText(stanzaText);
    setHymnActionVisible(true);
  };

  // Long-press opens the highlight editor on that stanza, mirroring the Bible
  // reader (long-press = editor, double-tap = action popover).
  const handleHymnStanzaLongPress = (stanzaNumber: number) => {
    setChapterEditorScrollVerseNumber(stanzaNumber);
    setChapterEditorVisible(true);
  };

  const handleAddHymnToFavorites = () => {
    if (currentHymnId) {
      const currentHymn = hymns.find(h => h.id === currentHymnId);
      if (currentHymn) {
        addToHymnFavorites(currentHymn);
      }
    }
  };

  const getCurrentHymn = (): Hymn | null => {
    if (currentHymnId) {
      return hymns.find(h => h.id === currentHymnId) || null;
    }
    return null;
  };

  const closeHymnAction = () => {
    setHymnActionVisible(false);
  };

  const closeReportModal = () => {
    setReportModalVisible(false);
  };

  const openBibleReportModal = (verse: BibleVerse) => {
    const ref = `${currentBook?.name ?? ''} ${verse.chapter}:${verse.verse_number}`.trim();
    setReportType('bible');
    setReportReference(ref);
    setReportText(verse.text);
    setReportModalVisible(true);
  };

  const openHymnReportModal = (payload: { stanzaNumber: number; stanzaText: string }) => {
    const hymn = getCurrentHymn();
    const titleRef = `Fihirana ${hymn?.number ?? ''}${hymn?.category ? ` (${hymn.category.toUpperCase()})` : ''}`.trim();
    const ref = `${titleRef} - Couplet ${payload.stanzaNumber}`.trim();

    setReportType('hymn');
    setReportReference(ref);
    setReportText(payload.stanzaText);
    setReportModalVisible(true);
  };

  // "Book ch:" — the verse range is appended by the share card.
  const bibleShareReference = (chapter: number): ShareReference => ({
    reference: `${currentBook?.name ?? ''} ${chapter}:`.trimStart(),
    appendRange: true,
  });

  const hymnShareReference = (hymn: Hymn): ShareReference => {
    const category = hymn.category ? ` (${hymn.category.toUpperCase()})` : '';
    const title = hymn.title.trim() ? ` · ${hymn.title.trim()}` : '';
    return {reference: `Fihirana ${hymn.number}${category}${title}`, appendRange: false};
  };

  const openBibleShare = (verse: BibleVerse) => {
    const startIndex = verses.findIndex(v => v.id === verse.id);
    if (startIndex < 0) return;
    setShareCard({
      ...bibleShareReference(verse.chapter),
      rangeStepper: true,
      items: buildBibleShareItems(verses, startIndex, transformText),
    });
  };

  const openHymnShare = (stanzaNumber: number) => {
    const hymn = getCurrentHymn();
    const items = buildHymnShareItems(hymnVerses, stanzaNumber, HYMN_CHORUS_LABEL);
    if (!hymn || items.length === 0) return;
    setShareCard({...hymnShareReference(hymn), rangeStepper: true, items});
  };

  const maybeFlushReports = async () => {
    if (!ISSUE_REPORT_ENDPOINT_URL || ISSUE_REPORT_ENDPOINT_URL.includes('PUT_YOUR_APPS_SCRIPT_WEBAPP_URL_HERE')) {
      return;
    }

    try {
      await flushIssueReports(ISSUE_REPORT_ENDPOINT_URL);
    } catch (e) {
      // Keep queue for later retry
      if (__DEV__) console.log('flushIssueReports failed:', e);
    }
  };

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected) {
        maybeFlushReports();
      }
    });

    const appStateSub = AppState.addEventListener('change', nextAppState => {
      const prev = appState.current;
      appState.current = nextAppState;
      if (prev.match(/inactive|background/) && nextAppState === 'active') {
        maybeFlushReports();
      }
    });

    return () => {
      unsub();
      appStateSub.remove();
    };
  }, []);

  const handleVerseLongPress = (verse: BibleVerse) => {
    setSelectedVerseForAction(verse);
    setVerseActionVisible(true);
  };

  const chapterDisplay = useMemo(() => {
    if (!chapterEditorVisible) return null;
    if (mode === 'hymnal') {
      return hymnVerses.length > 0 ? buildHymnDisplay(hymnVerses, HYMN_CHORUS_LABEL) : null;
    }
    return verses.length > 0 ? buildChapterDisplay(verses, transformText) : null;
  }, [chapterEditorVisible, mode, hymnVerses, verses, transformText]);

  const editorHymn = mode === 'hymnal' ? getCurrentHymn() : null;
  const chapterEditorReference = editorHymn
    ? `${editorHymn.category ? `${editorHymn.category.toUpperCase()} ` : ''}${editorHymn.number}`
    : currentBook
    ? `${currentBook.name} ${currentChapter}`
    : `${currentChapter}`;
  const editorShareReference =
    mode === 'hymnal'
      ? editorHymn
        ? hymnShareReference(editorHymn)
        : undefined
      : currentBook
      ? bibleShareReference(currentChapter)
      : undefined;

  const handleChapterMarksSave = (next: ChapterMark[]) => {
    if (mode === 'hymnal') {
      setAllHymnMarks(next);
    } else {
      setAllMarks(next);
    }
    setChapterEditorVisible(false);
    // Advance the highlight tutorial's "Tahirizo" step off the real save.
    tutorial.notifyProgress('editorSaved');
  };

  const handleChapterMarksClear = () => {
    if (mode === 'hymnal') {
      clearHymnMarks();
    } else {
      clearChapter();
    }
  };

  const handleViewCorrespondence = (verse: BibleVerse) => {
    openCrossReferences(verse);
  };

  const handleAddToFavorites = (verse: BibleVerse) => {
    if (currentBook) {
      addToBibleFavorites(verse, currentBook.name);
    }
  };

  const closeVerseAction = () => {
    setVerseActionVisible(false);
    setSelectedVerseForAction(null);
  };

  const openCrossReferences = async (verse: BibleVerse) => {
    if (!currentBook) {
      return;
    }

    setSelectedVerse(verse);
    setCrossRefs([]);
    setCrossRefModalVisible(true);
    setIsCrossRefsLoading(true);
    try {
      const refs = await getCrossReferences(verse.book_id, verse.chapter, verse.verse_number);
      setCrossRefs(refs);
    } finally {
      setIsCrossRefsLoading(false);
    }
  };

  const closeCrossReferences = () => {
    setCrossRefModalVisible(false);
    setSelectedVerse(null);
    setCrossRefs([]);
    setIsCrossRefsLoading(false);
  };

  const handleCrossRefPress = (ref: BibleCrossReference) => {
    setMode('bible');
    setCurrentBook({ id: ref.to_book_id, name: ref.to_book_name });
    setCurrentChapter(ref.to_chapter);
    closeCrossReferences();
  };

  const handleHymnSelect = (hymnId: string, category: string, number: number) => {
    setCurrentHymnId(hymnId);
    setCurrentHymnNumber(number);
    setCurrentHymnCategory(category);
    tutorial.notifyProgress('selected');
  };

  // Tutorial: drive the REAL selection UI when a step asks for it, so the
  // walkthrough teaches the genuine gesture. Registered once; the engine calls
  // it as steps become active. 'open' progress is emitted when the driven modal
  // actually mounts (see the visibility effect below).
  useEffect(() => {
    const handler = (verb: DriveVerb) => {
      switch (verb) {
        case 'switchToBible':
          setMode('bible');
          return;
        case 'switchToHymnal':
          setMode('hymnal');
          return;
        case 'openBookSelector':
          setMode('bible');
          setBibleSelectionVisible(true);
          if (currentBook) {
            setBibleSelectionProgress({
              step: 'book',
              selectedBook: {id: currentBook.id, name: currentBook.name},
              selectedChapter: currentChapter ?? null,
            });
          }
          return;
        case 'openHymnSelector':
          setMode('hymnal');
          setHymnSelectionVisible(true);
          return;
        case 'showCultReaderNav':
          // Cult mode is genuinely active by this step, so the real ‹ ›
          // chevrons render on the reader — just return there to show them.
          navigation.navigate('Home');
          return;
        case 'showBibleReader':
          // Highlight tutorial: just make sure we're on the Bible reader. The
          // user performs the real long-press to open the menu themselves — we
          // never force it open, so they learn the genuine gesture.
          setMode('bible');
          return;
        default:
          return;
      }
    };
    tutorial.setDriveHandler(handler);
    return () => tutorial.setDriveHandler(null);
  }, [tutorial, currentBook, currentChapter, navigation]);

  // Auto-start onboarding on first launch (after OnboardingGateScreen resets
  // us to Home having chosen "show me"). Gate on the persisted flag; 400ms
  // settle lets the reader paint. The module-level guard makes this fire once
  // per app process — Home remounts (e.g. returning from the CultMode screen)
  // must NOT relaunch onboarding, which was the source of the tutorial
  // "looping back". When the gate screen's "already know" choice ran instead,
  // it stamped both tutorials done, so isOnboardingDone() here is true and
  // this is a no-op.
  useEffect(() => {
    if (onboardingAutoStarted) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    isOnboardingDone().then(done => {
      if (done || cancelled) return;
      onboardingAutoStarted = true;
      timer = setTimeout(() => tutorial.start('onboarding'), 400);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tutorial chaining + isolation, keyed on the tutorial id transition so each
  // edge acts exactly once:
  //   null → cult       : isolate the playlist onto a throwaway slate so the
  //                        walkthrough's demo entries never touch the real one.
  //   onboarding → null : offer the Fotoam-pivavahana tutorial (CultIntro),
  //                        don't force it — mental-overload avoidance after a
  //                        12-step walkthrough. Declining loses nothing: it's
  //                        still queued in the Toro-lalana quest log (Help).
  //   cult       → null : tutorial finished/skipped — restore the real playlist
  //                        (the demo entries were never persisted). No relaunch.
  const prevTutorialId = useRef<string | null>(null);
  useEffect(() => {
    const active = tutorial.activeTutorial?.id ?? null;
    const prev = prevTutorialId.current;
    prevTutorialId.current = active;
    if (active === prev) return;

    if (active === CULT_TUTORIAL_ID) {
      cultMode.beginTutorial();
      return;
    }
    if (active !== null) return;

    if (prev === ONBOARDING_ID) {
      navigation.navigate('CultIntro');
    } else if (prev === CULT_TUTORIAL_ID) {
      cultMode.endTutorial();
    } else if (prev === HIGHLIGHT_TUTORIAL_ID) {
      // Skipping/finishing the highlight walkthrough also dismisses the editor
      // it opened, so "Ampiasa avy hatrany" leaves the user on the clean reader.
      setChapterEditorVisible(false);
    }
  }, [tutorial.activeTutorial, tutorial, navigation, cultMode]);

  // Babysitting drill for the reader ‹ › step: the user must page all the way
  // to the last entry, THEN all the way back to the first, before the step
  // advances (n entries ⇒ n-1 › taps then n-1 ‹ taps). Two phases tracked via
  // ref; reset whenever the step (re)starts.
  const navDrill = useRef<'toEnd' | 'toStart' | 'done'>('toEnd');
  const onCultNavStep =
    tutorial.activeTutorial?.id === CULT_TUTORIAL_ID &&
    tutorial.step?.id === 'cultReaderNav';
  useEffect(() => {
    if (onCultNavStep) navDrill.current = 'toEnd';
  }, [onCultNavStep]);
  useEffect(() => {
    if (!onCultNavStep) return;
    // Single-entry playlists can't be paged — let the step advance immediately.
    if (cultMode.entries.length <= 1) {
      tutorial.notifyProgress('cultNavStepped');
      return;
    }
    if (navDrill.current === 'toEnd' && cultMode.isLast) {
      navDrill.current = 'toStart';
    } else if (navDrill.current === 'toStart' && cultMode.isFirst) {
      navDrill.current = 'done';
      tutorial.notifyProgress('cultNavStepped');
    }
  }, [onCultNavStep, cultMode.currentIndex, cultMode.isFirst, cultMode.isLast, cultMode.entries.length, tutorial]);

  // Tell the tutorial the driven selector actually opened → advances the
  // 'openBookSelector'/'openHymnSelector' steps (awaitProgress: 'open').
  useEffect(() => {
    if (bibleSelectionVisible || hymnSelectionVisible) {
      tutorial.notifyProgress('open');
    }
  }, [bibleSelectionVisible, hymnSelectionVisible, tutorial]);

  // Onboarding: report a genuine Baiboly↔Fihirana mode switch (tap OR swipe)
  // as tutorial progress. Edge-detected against the previous mode — not a
  // plain `mode === 'hymnal'` check — so this never fires on mount just
  // because the default mode already matches; it only fires on an actual
  // change the user made. Drives both `modeToggle`'s branch choice and the
  // switchHymnal/switchBible transition steps off the same real gesture.
  const prevModeRef = useRef(mode);
  useEffect(() => {
    const prevMode = prevModeRef.current;
    prevModeRef.current = mode;
    if (mode === prevMode) return;
    tutorial.notifyProgress(mode === 'hymnal' ? 'choseHymnal' : 'choseBible');
  }, [mode, tutorial]);

  // Cult tutorial lead-in: advance the 'tap the hamburger' step once the menu
  // actually opens (the real gesture, same pattern as the selectors above).
  useEffect(() => {
    if (isMenuOpen) tutorial.notifyProgress('menuOpened');
  }, [isMenuOpen, tutorial]);

  // Highlight tutorial: advance the 'long-press to open the menu' step when the
  // editor actually opens from the user's own long-press (never a forced open).
  useEffect(() => {
    if (chapterEditorVisible) tutorial.notifyProgress('highlightMenuOpened');
  }, [chapterEditorVisible, tutorial]);

  const handleTitlePress = () => {
    if (mode === 'hymnal') {
      setHymnSelectionVisible(true);
      return;
    }

    if (mode === 'bible') {
      // When opening, pre-seed the SelectionTopBar's known state so the
      // Toko/Andininy tabs are immediately tappable (same-book switching).
      // The modal itself receives initialBook/initialChapter below.
      setBibleSelectionVisible(visible => {
        const next = !visible;
        if (next && currentBook) {
          setBibleSelectionProgress({
            step: 'book',
            selectedBook: {id: currentBook.id, name: currentBook.name},
            selectedChapter: currentChapter ?? null,
          });
        }
        return next;
      });
    }
  };

  // Same alpha as the transport buttons' own background, so the glyphs fade
  // together with the pill instead of sitting fully opaque on top of it.
  // Applied as a View `opacity` (not a translucent border/fill color): the
  // prev/next glyph is a triangle built from the border-trick (transparent
  // top/bottom borders + a solid side border on a 0x0 box) — giving that
  // border color its own alpha leaves a faint seam where it meets the
  // transparent borders, visible as a small polygon around the triangle.
  // Opacity fades the whole already-rendered (opaque, seamless) icon instead.
  const cultPlayerIconStyle = {opacity: CULT_PLAYER_BUTTON_ALPHA};
  // A dark drop shadow reads as depth on a light background but disappears
  // (or muddies) on a dark one — swap it for a gentle light glow instead.
  // elevation: 0 matters here too — same Android quirk as the tutorial cards
  // (TutorialOverlay's peekCard/modalCard): elevation assumes an opaque
  // surface, so combined with these buttons' translucent backgroundColor it
  // rendered the pill (and the white triangle/bar glyph inside it) as a
  // washed-out white blob instead of the intended translucent teal circle.
  // Dropping elevation keeps the iOS shadow* props (unaffected) and just
  // loses the Android drop shadow.
  const cultPlayerShadow = {
    elevation: 0,
    shadowColor: isDarkMode ? '#FFFFFF' : '#000000',
    shadowOpacity: isDarkMode ? 0.18 : 0.25,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
  };

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.container, {backgroundColor: theme.colors.readerBackground}]}
    >
      {mode === 'bible' && bibleSelectionVisible ? (
        <SelectionTopBar
          tabs={[
            {key: 'book' as const, label: 'Boky'},
            {key: 'chapter' as const, label: 'Toko'},
            {key: 'verse' as const, label: 'Andininy'},
          ]}
          activeKey={bibleSelectionProgress.step}
          onTabPress={(key) => {
            if (key === 'chapter' && !bibleSelectionProgress.selectedBook) {
              return;
            }
            if (
              key === 'verse' &&
              (!bibleSelectionProgress.selectedBook ||
                bibleSelectionProgress.selectedChapter === null)
            ) {
              return;
            }
            setRequestedBibleSelectionStep(key);
          }}
        />
      ) : (
        <TopBar
          appMode={mode}
          title={title}
          isMenuOpen={isMenuOpen}
          onMenuPress={() => setIsMenuOpen(open => !open)}
          onTitlePress={handleTitlePress}
          onPreviousPress={handlePreviousChapter}
          onNextPress={handleNextChapter}
          onSearchPress={() => navigation.navigate('GlobalSearch')}
        />
      )}
      <Pressable
        ref={hlReaderAreaRef}
        collapsable={false}
        android_ripple={null}
        style={styles.readerContainer}
        {...swipeResponder.panHandlers}>
        {mode === 'bible' && bibleSelectionVisible ? (
          <BibleSelectionModal
            onClose={() => {
              setBibleSelectionVisible(false);
              setRequestedBibleSelectionStep(null);
              setBibleSelectionProgress({step: 'book', selectedBook: null, selectedChapter: null});
            }}
            onBibleSelect={(bookId, bookName, chapter, selection: VerseSelection) => {
              setMode('bible');
              setCurrentBook({ id: bookId, name: bookName });
              setCurrentChapter(chapter);

              if (selection.kind === 'single') {
                setSelectedVerseRange(null);
                setSelectedVerseNumber(selection.verse);
                setShouldScrollToVerse(selection.verse);
              } else if (selection.kind === 'range') {
                setSelectedVerseNumber(null);
                setSelectedVerseRange({start: selection.start, end: selection.end});
                setShouldScrollToVerse(selection.start);
              } else {
                // whole chapter
                setSelectedVerseRange(null);
                setSelectedVerseNumber(null);
                setShouldScrollToVerse(null);
              }

              setBibleSelectionVisible(false);
              setRequestedBibleSelectionStep(null);
              tutorial.notifyProgress('selected');
            }}
            requestedStep={requestedBibleSelectionStep}
            initialBook={(() => {
              if (!currentBook) return null;
              const match = books.find(b => b.id === currentBook.id);
              if (!match) return null;
              return {id: match.id, name: match.name, chapters: match.chapters};
            })()}
            initialChapter={currentChapter ?? null}
            onProgressChange={(progress) => {
              setBibleSelectionProgress((prev) => {
                if (
                  prev.step === progress.step &&
                  prev.selectedChapter === progress.selectedChapter &&
                  (prev.selectedBook?.id ?? null) === (progress.selectedBook?.id ?? null)
                ) {
                  return prev;
                }
                return progress;
              });
              setRequestedBibleSelectionStep((prev) =>
                prev === progress.step ? null : prev,
              );
              // Advance the Bible drill (pickBook→chapter, pickChapter→verse).
              tutorial.notifyProgress(progress.step);
            }}
          />
        ) : (
          mode === 'bible' ? (
            <BibleReaderView
              verses={verses}
              isLoading={isLoading}
              fontScale={fontScale}
              onVerseDoubleTap={handleVerseLongPress}
              onVerseLongPress={(verse) => {
                setChapterEditorScrollVerseNumber(verse.verse_number);
                setChapterEditorVisible(true);
              }}
              onNotePress={(verse) => {
                // Tapping the ✎ glyph opens the chapter editor scrolled to the
                // verse, where the note span is visible (dotted underline) and
                // tappable to read/edit. Same open path as long-press.
                setChapterEditorScrollVerseNumber(verse.verse_number);
                setChapterEditorVisible(true);
              }}
              selectedVerseNumber={selectedVerseNumber}
              selectedVerseRange={selectedVerseRange}
              onInlineRefPress={handleInlineBibleRefPress}
              flatListRef={flatListRef}
              headerText={mode === 'bible' ? bibleTitleLong : null}
              chapterMarks={chapterMarks}
              currentBookName={currentBook?.name ?? null}
              onClearRange={() => setSelectedVerseRange(null)}
            />
          ) : (
            <HymnReaderView
              hymnVerses={hymnVerses}
              isLoading={isHymnsLoading}
              hymnTitle={getCurrentHymn()?.title ?? null}
              hymnNote={getCurrentHymn()?.note ?? null}
              hymnAuthors={getCurrentHymn()?.authors}
              fontScale={fontScale}
              marks={hymnMarks}
              onHymnLongPress={handleHymnStanzaLongPress}
              onHymnDoubleTap={handleHymnStanzaDoubleTap}
              onNotePress={handleHymnStanzaLongPress}
            />
          )
        )}

      </Pressable>
      <CustomBottomNav
        activeMode={mode}
        onTabPress={(m) => {
          setMode(m);
          // Fires on every tap, even re-tapping the already-active segment
          // (mode won't change then, so the mode-diff effect above alone
          // would never advance a step that's waiting on this exact tap).
          tutorial.notifyProgress(m === 'hymnal' ? 'choseHymnal' : 'choseBible');
        }}
      />
      {cultMode.isActive ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.cultPlayerBar,
            {bottom: insets.bottom + CULT_PLAYER_BAR_LIFT},
          ]}>
          <Pressable
            ref={cultReaderNavRef}
            collapsable={false}
            onPress={cultMode.goPrev}
            disabled={cultMode.isFirst}
            hitSlop={12}
            style={[
              styles.cultPlayerChevron,
              {backgroundColor: hexToRgba(theme.colors.navBackground, CULT_PLAYER_BUTTON_ALPHA)},
              cultPlayerShadow,
              cultMode.isFirst && styles.cultPlayerButtonDisabled,
            ]}>
            <View style={[styles.skipIconRow, cultPlayerIconStyle]}>
              <View style={styles.skipBar} />
              <View style={styles.triangleLeft} />
            </View>
          </Pressable>
          <Pressable
            ref={cultStopButtonRef}
            collapsable={false}
            onPress={() => {
              cultMode.toggleActive(false);
              tutorial.notifyProgress('cultStopped');
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('cultMode.deactivate')}
            style={[
              styles.cultPlayerStopButton,
              {backgroundColor: hexToRgba(theme.colors.navBackground, CULT_PLAYER_BUTTON_ALPHA)},
              cultPlayerShadow,
            ]}>
            <View style={[styles.cultPlayerStopIcon, cultPlayerIconStyle]} />
          </Pressable>
          <Pressable
            ref={cultReaderNavNextRef}
            collapsable={false}
            onPress={cultMode.goNext}
            disabled={cultMode.isLast}
            hitSlop={12}
            style={[
              styles.cultPlayerChevron,
              {backgroundColor: hexToRgba(theme.colors.navBackground, CULT_PLAYER_BUTTON_ALPHA)},
              cultPlayerShadow,
              cultMode.isLast && styles.cultPlayerButtonDisabled,
            ]}>
            <View style={[styles.skipIconRow, cultPlayerIconStyle]}>
              <View style={styles.triangleRight} />
              <View style={styles.skipBar} />
            </View>
          </Pressable>
        </View>
      ) : null}

      <ReportIssueModal
        visible={reportModalVisible}
        reference={reportReference}
        text={reportText}
        onClose={closeReportModal}
        onSubmit={async (comment) => {
          const report: IssueReport = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            createdAt: new Date().toISOString(),
            type: reportType,
            reference: reportReference,
            text: reportText,
            comment,
          };

          closeReportModal();
          await enqueueIssueReport(report);
          await maybeFlushReports();
        }}
      />

      <Modal
        visible={crossRefModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCrossReferences}
      >
        <Pressable style={[styles.modalBackdrop]} onPress={closeCrossReferences}>
          <Pressable
            style={[
              styles.modalCard,
              {backgroundColor: theme.colors.backgroundSecondary},
            ]}
            onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, {color: theme.colors.textPrimary}]}> 
                {selectedVerse
                  ? `${currentBook?.name ?? ''} ${selectedVerse.chapter}:${selectedVerse.verse_number}`
                  : 'Cross references'}
              </Text>
              <Pressable onPress={closeCrossReferences}>
                <Text style={[styles.modalClose, {color: theme.colors.accentBlue}]}>HIDY</Text>
              </Pressable>
            </View>

            {isCrossRefsLoading ? (
              <Text style={[styles.modalHint, {color: theme.colors.readerText}]}>Mitady...</Text>
            ) : crossRefs.length === 0 ? (
              <Text style={[styles.modalHint, {color: theme.colors.readerText}]}>Tsy misy cross-reference.</Text>
            ) : (
              <View>
                {crossRefs.slice(0, 200).map(ref => {
                  const rangeText =
                    ref.to_verse_start === ref.to_verse_end
                      ? `${ref.to_verse_start}`
                      : `${ref.to_verse_start}-${ref.to_verse_end}`;
                  return (
                    <Pressable
                      key={ref.id}
                      style={[styles.crossRefRow, {borderTopColor: theme.colors.divider}]}
                      onPress={() => handleCrossRefPress(ref)}
                    >
                      <Text style={[styles.crossRefText, {color: theme.colors.readerText}]}> 
                        {ref.to_book_name} {ref.to_chapter}:{rangeText}
                      </Text>
                      <Text style={[styles.crossRefVotes, {color: theme.colors.textSecondary}]}>{ref.votes}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <HamburgerMenuPopover
        visible={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onSelect={handleMenuSelect}
        onAbout={() => {
          setIsMenuOpen(false);
          navigation.navigate('About');
        }}
        isDarkMode={isDarkMode}
        onToggleDarkMode={setDarkMode}
        fontScale={fontScale}
        topInset={insets.top + TOP_BAR_EXTRA_TOP_PADDING + TOP_BAR_TOOLBAR_HEIGHT}
        menuTop={
          insets.top +
          TOP_BAR_EXTRA_TOP_PADDING +
          TOP_BAR_TOOLBAR_HEIGHT -
          HAMBURGER_CARET_HEIGHT
        }
        menuRight={12}
        caretRightOffset={12}
        fontControlsTop={insets.top + TOP_BAR_EXTRA_TOP_PADDING}
        fontControlsRight={56}
        onIncreaseFont={() =>
          setFontScale(scale => Math.min(USER_FONT_SCALE_MAX, Math.round((scale + 0.1) * 10) / 10))
        }
        onDecreaseFont={() =>
          setFontScale(scale => Math.max(USER_FONT_SCALE_MIN, Math.round((scale - 0.1) * 10) / 10))
        }
      />

      <HymnSelectionModal
        visible={hymnSelectionVisible}
        hymns={hymns}
        currentCategory={currentHymnCategory}
        currentNumber={currentHymnNumber}
        onClose={() => setHymnSelectionVisible(false)}
        onHymnSelect={handleHymnSelect}
      />

      <VerseActionPopover
        visible={verseActionVisible}
        verse={selectedVerseForAction}
        verseBookName={currentBook?.name}
        onClose={closeVerseAction}
        onViewCorrespondence={handleViewCorrespondence}
        onAddToFavorites={handleAddToFavorites}
        onShare={openBibleShare}
        onReportIssue={openBibleReportModal}
      />

      <ChapterEditorModal
        visible={chapterEditorVisible}
        reference={chapterEditorReference}
        chapter={chapterDisplay}
        initialMarks={mode === 'hymnal' ? hymnMarks : chapterMarks}
        initialScrollVerseNumber={chapterEditorScrollVerseNumber}
        fontScale={fontScale}
        highlightColor={theme.colors.markerHighlight}
        shareReference={editorShareReference}
        onSave={handleChapterMarksSave}
        onClear={handleChapterMarksClear}
        onClose={() => {
          setChapterEditorVisible(false);
          setChapterEditorScrollVerseNumber(null);
        }}
      />

      <HymnActionPopover
        visible={hymnActionVisible}
        hymn={getCurrentHymn()}
        stanzaNumber={selectedHymnStanzaNumber}
        stanzaText={selectedHymnStanzaText}
        onClose={closeHymnAction}
        onAddToFavorites={handleAddHymnToFavorites}
        onShare={openHymnShare}
        onReportIssue={openHymnReportModal}
      />

      {shareCard ? (
        <ShareCardModal data={shareCard} onClose={() => setShareCard(null)} />
      ) : null}

      <TutorialOverlay scope="screen" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  readerContainer: {
    flex: 1,
    paddingBottom: 24,
  },
  // Positioned above CustomBottomNav (which keeps its normal, unmodified
  // layout) instead of flanking it, so the transport controls sit in the
  // thumb-reachable zone of the screen while holding the phone one-handed.
  cultPlayerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  cultPlayerChevron: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor is set inline from theme.colors.navBackground at ~75%
    // alpha so the pill follows the active theme (teal in both modes today,
    // any future theme override automatically) with a slight see-through.
  },
  cultPlayerButtonDisabled: {opacity: 0.35},
  // Classic "skip to previous/next track" glyph (iOS Control Center, Apple
  // Music, Spotify): a triangle butted against a vertical bar, not a bare
  // chevron — the shape users already recognize as media transport controls.
  skipIconRow: {flexDirection: 'row', alignItems: 'center', gap: 2},
  skipBar: {width: 3, height: 16, borderRadius: 1, backgroundColor: '#FFFFFF'},
  triangleRight: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 13,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
  },
  triangleLeft: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 13,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#FFFFFF',
  },
  cultPlayerStopButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    // elevation/shadow* are applied inline (cultPlayerShadow) — shared with
    // the prev/next buttons and swapped for dark mode.
  },
  cultPlayerStopIcon: {
    width: 18,
    height: 18,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    flex: 1,
    paddingRight: 12,
  },
  modalClose: {
    fontSize: 12,
    fontWeight: '700',
    color: '#005a9e',
  },
  modalHint: {
    paddingVertical: 12,
    color: '#444',
  },
  crossRefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
  },
  crossRefText: {
    flex: 1,
    color: '#111',
    paddingRight: 12,
  },
  crossRefVotes: {
    color: '#666',
    fontVariant: ['tabular-nums'],
  },
});

export default MainScreen;
