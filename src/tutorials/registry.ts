import type {TutorialIconName} from '../components/TutorialIcons';

// Tutorial data — pure, append-only. To add a mini-tutorial later: append a
// Tutorial object here (+ its steps). No engine change needed.
//
// `text` is the Malagasy coach-mark copy shown next to the highlighted element.
// It's kept inline (not in i18n/strings.ts) on purpose: that module is a strict
// union type where every key must be declared, and this copy is tutorial-local
// data. Overwrite the placeholders below with the final wording.

// Every spotlightable UI element registers itself under one of these ids via
// useTutorialTarget(id). null target = a centered card (welcome / done), no hole.
export type TargetId =
  | 'bottomNav'         // Baiboly ↔ Fihirana toggle (CustomBottomNav)
  | 'bottomNavHymnTab'  // just the "Fihirana" segment of that toggle
  | 'bottomNavBibleTab' // just the "Baiboly" segment of that toggle
  | 'topbarTitle'       // tap to open book/hymn selector
  | 'topbarPrev'        // ‹‹ chevron (previous chapter/hymn)
  | 'topbarNext'        // › chevron (next chapter/hymn)
  | 'topbarMenu'        // hamburger
  | 'cultMenuItem'      // "Fotoam-pivavahana" cell inside the hamburger popover
  | 'selBookTab'        // Boky tab inside BibleSelectionModal's SelectionTopBar
  | 'selChapterGrid'    // Toko grid
  | 'selVerseGrid'      // Andininy grid
  | 'hymnCategoryTabs'  // category strip inside HymnSelectionModal
  | 'hymnKeypad'        // numeric keypad
  | 'cultAddButtons'    // Hampio Baiboly / Fihirana row on CultModeScreen
  | 'cultFlashRow'      // the just-added playlist row (spotlit + blinks post-add)
  | 'cultList'          // the playlist itself (what-to-read, drag to reorder)
  | 'cultActivateToggle'// Velomy ny fotoana switch row on CultModeScreen
  | 'cultReaderNav'     // ‹ playlist chevron in the reader (Home) once active
  | 'cultReaderNavNext' // › playlist chevron (paired with cultReaderNav)
  | 'cultStopButton'    // ■ stop button in the reader transport bar (Home)
  // Highlight tutorial — targets inside the ChapterEditorModal (a native RN
  // Modal; the verse text is a WebView, everything else is native RN Views).
  | 'hlReaderArea'      // the normal Bible reader (hole = real long-press to open the menu)
  | 'hlVerseText'       // the WebView chapter body (hole = real press-drag selection)
  | 'hlColorPicker'     // the highlight-color swatch row
  | 'hlEraseBtn'        // "Fafao" footer button (erase the selected highlight)
  | 'hlSaveBtn';        // "Tahirizo" footer button (commit)

// A side-effect the engine performs when the step becomes active — it drives
// the REAL app UI (opens the actual modal, switches mode) so the user learns
// the true gesture, not a fake.
export type DriveVerb =
  | 'openBookSelector'
  | 'openHymnSelector'
  | 'switchToBible'
  | 'switchToHymnal'
  | 'openMenu'
  // Cult tutorial: go back to the reader (Home) and force-show the playlist
  // ‹ › chevrons so the last step can spotlight the real control.
  | 'showCultReaderNav'
  // Highlight tutorial: make sure we're on the Bible reader so the user can
  // perform the real long-press that opens the highlight menu themselves. Used
  // both to open the menu the first time and to reopen it for the delete drill.
  | 'showBibleReader';

// When does the step advance to the next one?
//  - 'tap'         : user taps the coach card's Next button
//  - 'targetEvent' : the driven UI fires its real progress callback
//                    (e.g. BibleSelectionModal.onProgressChange reaches 'verse')
export type AdvanceOn = 'tap' | 'targetEvent';

// Which overlay hierarchy the target lives in. RN <Modal> renders in a separate
// native tree, so a step targeting the selection grids must be drawn by the
// overlay mounted INSIDE that modal, not the screen-level one.
export type TargetScope = 'screen' | 'modal' | 'cult';

export type CoachStep = {
  id: string;
  targetId: TargetId | null;
  // Extra targets to spotlight alongside targetId in the SAME step (multiple
  // holes, one card). Same scope as targetId. Used e.g. to highlight both
  // chapter-navigation chevrons at once.
  extraTargetIds?: TargetId[];
  scope?: TargetScope;          // default 'screen'
  text: string;                 // MG coach-mark copy (placeholder — replace)
  placement?: 'top' | 'bottom' | 'auto'; // default 'auto'
  drive?: DriveVerb;
  advanceOn?: AdvanceOn;        // default 'tap'
  // For 'targetEvent' steps: the progress key the driven UI must reach to
  // advance. Bible: 'chapter' | 'verse' | 'selected'. Hymn: 'category' | 'selected'.
  awaitProgress?: string;
  // For a step whose real outcome forks the rest of the tutorial (e.g. the
  // user tapping Baiboly vs Fihirana at modeToggle). Keyed by the progress
  // value; the matching array REPLACES every step after this one, so the
  // steps immediately following always match what the user actually picked
  // instead of assuming one path. A key with no entry here (but matching
  // `awaitProgress`) falls through to the plain default order below.
  branches?: Record<string, CoachStep[]>;
  // Optional animated gesture hint drawn over the spotlight hole — a
  // fingertip emoji (bare glyph, no skin-tone modifier — that flat
  // cartoon-yellow IS Unicode's neutral default) with a native-style motion
  // cue. 'longPress' = press-and-hold in place, with an expanding ring.
  // 'swipeHorizontal' = slides left-right for a scrollable strip, no ring (a
  // ring there reads as "hold still", contradicting a swipe). 'dragVertical'
  // = press-and-hold (ring, same as longPress) THEN slides up-down — for
  // grab-and-reorder rows.
  gesture?: 'longPress' | 'swipeHorizontal' | 'dragVertical';
  // Destination-confirmation steps: card floats mid-right, tinted with the
  // theme accent color at partial opacity instead of the usual opaque
  // hole-relative card, so the spotlit content shows through it too.
  peekCard?: boolean;
};

export type Tutorial = {
  id: string;
  title: string;                // MG, shown in the Help/Toro-lalana quest log
  icon: TutorialIconName;       // drawn by components/TutorialIcons — no icon lib
  autoStart?: boolean;
  order: number;
  // Which screen the Help quest-log sends the user to before starting. Defaults
  // to 'Home' (where the screen-scope overlay lives). Set to 'CultMode' etc. for
  // tutorials whose targets live on another screen.
  launchRoute?: 'Home' | 'CultMode';
  steps: CoachStep[];
};

export const ONBOARDING_ID = 'onboarding';
export const CULT_TUTORIAL_ID = 'cultMode';
export const HIGHLIGHT_TUTORIAL_ID = 'highlight';

// Onboarding's two mid-tutorial drills. Defined once, reused in whichever
// order the user actually picks at `modeToggle` below — never assumed.

// --- Bible drill: reach any verse in 3 taps ---
const ONBOARDING_BIBLE_DRILL: CoachStep[] = [
  {
    id: 'openSelector',
    targetId: 'topbarTitle',
    text: "Tsindrio ny lohateny hitadiavana boky, toko, andininy anaty Baiboly na Fihirana arakaraky ny safidinao teny ambany.",
    advanceOn: 'targetEvent',
    awaitProgress: 'open',
  },
  {
    id: 'pickBook',
    targetId: 'selBookTab',
    scope: 'modal',
    text: 'Safidio ny boky hovakiana — ohatra: Jaona.',
    peekCard: true,
    advanceOn: 'targetEvent',
    awaitProgress: 'chapter',
  },
  {
    id: 'pickChapter',
    targetId: 'selChapterGrid',
    scope: 'modal',
    text: 'Safidio ny toko .',
    advanceOn: 'targetEvent',
    awaitProgress: 'verse',
  },
  {
    id: 'pickVerse',
    targetId: 'selVerseGrid',
    scope: 'modal',
    text: "Safidio ny andininy hanombohana sy hamaranana  ny famakiana teny (ao anatin'ny toko nosafidiana) ",
    advanceOn: 'targetEvent',
    awaitProgress: 'selected',
  },
  {
    // Confirmation beat: selecting closes the modal, but the very next step
    // (chevron intro, or a mode-switch/done card) would otherwise cover the
    // reader immediately — a null-target step dims the whole screen, and even
    // nextChapter's chevron holes leave the verse content dimmed outside them.
    // Reusing hlReaderArea (already registered on the whole reader view for
    // the highlight tutorial) spotlights the live verse instead of hiding it,
    // so the user actually sees they landed where they asked to.
    id: 'confirmBibleLanding',
    targetId: 'hlReaderArea',
    text: 'Indro ny andininy nofidianao!',
    peekCard: true,
  },
  {
    id: 'nextChapter',
    targetId: 'topbarNext',
    extraTargetIds: ['topbarPrev'],
    text: "Ireo teboka ‹‹ sy ›› ireo no ifindrana toko: ‹‹ mankany amin'ny toko teo aloha, ›› mankany amin'ny toko manaraka.",
  },
];

// --- Hymn drill: jump to any hymn by number ---
const ONBOARDING_HYMN_DRILL: CoachStep[] = [
  {
    id: 'openHymnSelector',
    targetId: 'topbarTitle',
    text: "Tahaka ny tao amin' ny Baiboly ihany, tsindrio eto isafidianana ny hira.",
    advanceOn: 'targetEvent',
    awaitProgress: 'open',
  },
  {
    id: 'pickCategory',
    targetId: 'hymnCategoryTabs',
    scope: 'modal',
    gesture: 'swipeHorizontal',
    text: "Akisaho mianavanana na miankavia ny karazana boky fihirana ery ambony, avy eo tsindrio izay tianao hikarohana hira hirana mialohan'ny hanindrinao ny laharan-kira.",
    advanceOn: 'targetEvent',
    awaitProgress: 'category',
  },
  {
    // The example number must exist in every category, not just the one the
    // user happened to land on (pickCategory runs first and its choice isn't
    // fixed) — 12 is safe because Antema, the smallest book, only goes up to
    // 24 (ffpm/fanampiny/fifohazana all run into the hundreds).
    id: 'typeNumber',
    targetId: 'hymnKeypad',
    scope: 'modal',
    placement: 'top',
    text: 'Soraty ny laharana — ohatra: 12 — dia OK.',
    advanceOn: 'targetEvent',
    awaitProgress: 'selected',
  },
  {
    // Same confirmation beat as the Bible drill's — this is the last step of
    // the hymn drill either way (whichever order the user picked), so without
    // it the very next card (mode-switch transition, or done) would cover the
    // hymn immediately via a full-dim or partial-dim scrim before it's shown.
    id: 'confirmHymnLanding',
    targetId: 'hlReaderArea',
    text: 'Indro ny hira nofidianao!',
    peekCard: true,
  },
];

// Transition between the two drills: real gesture, no `drive` — the user's
// own tap on the OTHER bottom-nav segment switches the mode. Same pattern
// on both sides so it works symmetrically whichever drill ran first.
const ONBOARDING_TO_HYMNAL: CoachStep = {
  id: 'switchHymnal',
  targetId: 'bottomNavHymnTab',
  text: 'Andao ho any amin\'ny Fihirana.',
  advanceOn: 'targetEvent',
  awaitProgress: 'choseHymnal',
};

// NOTE: mirrors ONBOARDING_TO_HYMNAL's wording with the other noun — flag
// for review, this text is a placeholder mirror, not authored copy.
const ONBOARDING_TO_BIBLE: CoachStep = {
  id: 'switchBible',
  targetId: 'bottomNavBibleTab',
  text: 'Andao ho any amin\'ny Baiboly.',
  advanceOn: 'targetEvent',
  awaitProgress: 'choseBible',
};

const ONBOARDING_DONE: CoachStep = {
  id: 'done',
  targetId: null,
  text: "Vita! Azonao averina foana ao amin'ny Toro-lalana.",
};

// Cult tutorial: everything after both an entry has been added, regardless
// of which order they were added in — reused by both the default (Bible
// first) path and the branch below (Fihirana first).
const CULT_AFTER_ADD_STEPS: CoachStep[] = [
  {
    id: 'cultList',
    targetId: 'cultList',
    scope: 'cult',
    placement: 'bottom',
    text: "Ireo teny sy hira nampidirinao dia miseho eto amin'ny lisitra, araka ny filaharana hovakiana.",
  },
  {
    id: 'cultReorderList',
    targetId: 'cultList',
    scope: 'cult',
    placement: 'top',
    gesture: 'dragVertical',
    text: "Hanova ny filaharana: tsindrio ela ny mari-pisintonana ☰ eo anilan'ny anarana, dia sintony miakatra na midina.",
  },
  {
    id: 'cultActivate',
    targetId: 'cultActivateToggle',
    scope: 'cult',
    placement: 'bottom',
    text: "Rehefa voalahatrao ireo teny sy hira, dia velomy ity teboka PLAY ity. Avy eo dia misesy ao amin'ny ecran principal ny teny sy hira nalahatrao ",
    advanceOn: 'targetEvent',
    awaitProgress: 'cultActivated',
  },
  {
    id: 'cultReaderNav',
    targetId: 'cultReaderNav',
    extraTargetIds: ['cultReaderNavNext'],
    scope: 'screen',
    drive: 'showCultReaderNav',
    placement: 'top',
    text: "Velona ny fotoana! Tsindrio  ny teboka < (prev) na > (next) ahafahanao mifindra amin'ny teny na ny hira nalahatrao.",
    advanceOn: 'targetEvent',
    awaitProgress: 'cultNavStepped',
  },
  {
    id: 'cultStop',
    targetId: 'cultStopButton',
    scope: 'screen',
    placement: 'top',
    text: "Rehefa vita ny famakiana, tsindrio ny teboka ■ eo afovoan'ireo tsindry, hampitsaharana ny Fotoam-pivavahana.",
    advanceOn: 'targetEvent',
    awaitProgress: 'cultStopped',
  },
  {
    id: 'cultDone',
    targetId: null,
    scope: 'screen',
    text: "Vita! Azonao averina foana ao amin'ny Toro-lalana.",
  },
];

export const TUTORIALS: Tutorial[] = [
  {
    id: ONBOARDING_ID,
    title: 'Fampidirana', // Getting started
    icon: 'rocket',
    autoStart: true,
    order: 0,
    // Default order below is Bible-first — matches `branches.choseHymnal`'s
    // absence of a mirrored `choseBible` entry (falls through to this array
    // via `awaitProgress` instead), so picking Baiboly costs no re-splice.
    steps: [
      {
        id: 'welcome',
        targetId: null,
        text: 'Tongasoa! Andao hianarantsika haingana ny fomba fampiasa ny e-Baiboly.',
      },
      {
        // Real gesture: the hole falls on the whole toggle, and whichever
        // segment the user actually taps decides which drill runs first
        // (`branches`, keyed off the same choseBible/choseHymnal progress the
        // transition steps below use). Picking Fihirana here splices in the
        // hymn drill immediately instead of walking a Bible drill the user
        // never asked for.
        id: 'modeToggle',
        targetId: 'bottomNav',
        text: 'Eto ianao no misafidy: Baiboly na Fihirana hovakiana.',
        advanceOn: 'targetEvent',
        awaitProgress: 'choseBible',
        branches: {
          choseHymnal: [
            ...ONBOARDING_HYMN_DRILL,
            ONBOARDING_TO_BIBLE,
            ...ONBOARDING_BIBLE_DRILL,
            ONBOARDING_DONE,
          ],
        },
      },
      ...ONBOARDING_BIBLE_DRILL,
      ONBOARDING_TO_HYMNAL,
      ...ONBOARDING_HYMN_DRILL,
      ONBOARDING_DONE,
    ],
  },
  {
    id: CULT_TUTORIAL_ID,
    title: 'Fotoam-pivavahana', // Worship-service playlist
    icon: 'church',
    order: 1,
    launchRoute: 'Home',
    steps: [
      {
        id: 'cultOpenMenu',
        targetId: 'topbarMenu',
        scope: 'screen',
        text: "Ny Fotoam-pivavahana dia hita ao anaty menio. Tsindrio ny kisary ☰ eto an-tampony.",
        advanceOn: 'targetEvent',
        awaitProgress: 'menuOpened',
      },
      {
        id: 'cultPickMenuItem',
        targetId: 'cultMenuItem',
        scope: 'modal',
        text: "Tsindrio \"Fotoam-pivavahana\" ao anaty menio.",
        advanceOn: 'targetEvent',
        awaitProgress: 'cultMenuSelected',
      },
      {
        id: 'cultWelcome',
        targetId: null,
        scope: 'cult',
        text: "Ny Fotoam-pivavahana dia ahafahanao manomana mialoha lisitry ny Baiboly sy hira harahina mandritra ny fotoana.",
      },
      {
        // Branch point, same pattern as onboarding's modeToggle: the row has
        // both "Hampio Baiboly" and "Hampio Fihirana", and whichever the user
        // taps first decides the order — text is neutral (not "tap Baiboly"),
        // so a tap on Fihirana isn't treated as a wrong move. Default
        // (Bible-first) falls through to cultAddHymn below via awaitProgress;
        // Fihirana-first splices in the mirrored step + the same shared tail.
        id: 'cultAddFirst',
        targetId: 'cultAddButtons',
        scope: 'cult',
        placement: 'bottom',
        text: "Ampio ao anaty lisitra ny voalohany: tsindrio \"Hampio Baiboly\" na \"Hampio Fihirana\".",
        advanceOn: 'targetEvent',
        awaitProgress: 'cultBibleAdded',
        branches: {
          cultHymnAdded: [
            {
              id: 'cultAddSecondBible',
              targetId: 'cultAddButtons',
              // Spotlight the just-added Fihirana row, same reasoning as
              // cultAddHymn's extraTargetIds below, mirrored.
              extraTargetIds: ['cultFlashRow'],
              scope: 'cult',
              placement: 'top',
              text: "Ampio andininy Baiboly izao: tsindrio \"Hampio Baiboly\" dia safidio boky, toko ary andininy.",
              advanceOn: 'targetEvent',
              awaitProgress: 'cultBibleAdded',
            },
            ...CULT_AFTER_ADD_STEPS,
          ],
        },
      },
      {
        id: 'cultAddHymn',
        targetId: 'cultAddButtons',
        // Also spotlight the just-added Bible row: punching it out of the scrim
        // keeps it bright (not darkened) and the hole-pulse makes it blink, so
        // the user sees where their verse landed. Card on top so it doesn't
        // cover the row; skip pill auto-relocates to a bottom corner.
        extraTargetIds: ['cultFlashRow'],
        scope: 'cult',
        placement: 'top',
        text: "Ampio hira izao: tsindrio \"Hampio Fihirana\" dia soraty ny laharan-kira.",
        advanceOn: 'targetEvent',
        awaitProgress: 'cultHymnAdded',
      },
      ...CULT_AFTER_ADD_STEPS,
    ],
  },
  {
    id: HIGHLIGHT_TUTORIAL_ID,
    title: 'Manasongadina teny', // Highlighting words
    icon: 'highlighter',
    order: 2,
    launchRoute: 'Home',
    steps: [
      {
        id: 'hlIntro',
        targetId: null,
        scope: 'screen',
        text: "Azonao asongadinana loko ny teny, andianteny na ampahany amin'ny toko iray.",
      },
      {
        // Real gesture: the hole falls on the normal Bible reader, so the user's
        // own long-press opens the highlight menu (no force-open). We only drive
        // 'showBibleReader' to make sure we're on the Bible tab first. Advances
        // when the editor actually opens (awaitProgress: 'highlightMenuOpened').
        id: 'hlOpenMenu',
        targetId: 'hlReaderArea',
        scope: 'screen',
        drive: 'showBibleReader',
        gesture: 'longPress',
        text: 'Tsindrio ela (long press) andininy iray eto amin\'ny famakiana mba hisokafan\'ny fitaovana fanasongadinana.',
        advanceOn: 'targetEvent',
        awaitProgress: 'highlightMenuOpened',
      },
      {
        // Gentle intro to the menu that just opened — no hole yet (targetId
        // null in modal scope → floating card over the real editor), so the
        // user first sees "this is the highlighting tool" before being asked to
        // do anything inside it.
        id: 'hlMenuIntro',
        targetId: null,
        scope: 'modal',
        text: "Ity ny fitaovana fanasongadinana. Eto no anasongadinanao teny, misafidy loko, ary mitahiry. Andao hozahantsika tsikelikely.",
      },
      {
        // Now inside the real ChapterEditorModal: the hole falls on the verse
        // text (WebView) so the genuine Android press-and-drag selection works.
        // Same long-press hand hint as the open-menu step so the gesture is
        // obvious — the user presses, then drags to extend the selection.
        // Tap-advance, NOT auto: a press-and-drag fires a selection event on the
        // first partial selection mid-drag, which would advance before the user
        // finished picking the words. Let them select fully, then tap Manaraka.
        id: 'hlSelect',
        targetId: 'hlVerseText',
        scope: 'modal',
        gesture: 'longPress',
        text: 'Tsindrio ela dia sintony (press-and-drag) hisafidianana ny teny tianao hasongadinina, avy eo tsindrio "Manaraka →".',
      },
      {
        // Card BELOW the swatch row: the color picker sits high in the sheet
        // (header → toolbar → colors), so there's no room to fit the card above
        // it — a 'top' card clamps down onto the swatches and hides them. The
        // large WebView area is right below the row, so drop the card there; the
        // colors stay fully visible with the card pointing up at them.
        id: 'hlPickColor',
        targetId: 'hlColorPicker',
        scope: 'modal',
        placement: 'bottom',
        text: 'Rehefa voafidy ny teny, tsindrio ny loko iray eto.',
      },
      {
        id: 'hlSave',
        targetId: 'hlSaveBtn',
        scope: 'modal',
        placement: 'top',
        text: 'Tsindrio "Tahirizo" hitehirizana ny fanasongadinana.',
        advanceOn: 'targetEvent',
        awaitProgress: 'editorSaved',
      },
      // --- Delete drill: don't assume the user knows how to remove a highlight.
      // Saving closed the editor, so we walk them back in and spotlight each
      // real control one at a time. ---
      {
        id: 'hlDeleteIntro',
        targetId: null,
        scope: 'screen',
        text: "Tsara! Voatahiry ny fanasongadinana. Ankehitriny hianarantsika ny fomba hamafana azy raha diso na tsy ilaina intsony.",
      },
      {
        // Reopen the editor on the same chapter (drive), then ask for the real
        // long-press on the highlighted verse.
        id: 'hlDeleteReopen',
        targetId: 'hlReaderArea',
        scope: 'screen',
        drive: 'showBibleReader',
        gesture: 'longPress',
        text: "Hidiro indray ny fitaovana: tsindrio ela ilay andininy nasongadinao teo.",
        advanceOn: 'targetEvent',
        awaitProgress: 'highlightMenuOpened',
      },
      {
        // Re-select the highlighted words with the same press-and-drag gesture.
        id: 'hlDeleteSelect',
        targetId: 'hlVerseText',
        scope: 'modal',
        gesture: 'longPress',
        text: "Tsindrio ela dia sintony (press-and-drag) ilay teny voasongadina mba hifidianana azy indray, avy eo tsindrio \"Manaraka →\".",
      },
      {
        // Spotlight the real Fafao button in the footer.
        id: 'hlDeleteErase',
        targetId: 'hlEraseBtn',
        scope: 'modal',
        placement: 'top',
        text: 'Tsindrio "Fafao" hanesorana ny loko tamin\'ny teny voafidy.',
      },
      {
        // Erasing only stages the change; Tahirizo commits it, same as adding.
        id: 'hlDeleteSave',
        targetId: 'hlSaveBtn',
        scope: 'modal',
        placement: 'top',
        text: 'Tsindrio "Tahirizo" hitehirizana ny fanesorana. Izay ihany — mora, sa tsy izany?',
        advanceOn: 'targetEvent',
        awaitProgress: 'editorSaved',
      },
      {
        id: 'hlDone',
        targetId: null,
        scope: 'screen',
        text: "Vita! Azonao averina foana ao amin'ny Toro-lalana.",
      },
    ],
  },
];

export const getTutorial = (id: string): Tutorial | undefined =>
  TUTORIALS.find(tu => tu.id === id);
