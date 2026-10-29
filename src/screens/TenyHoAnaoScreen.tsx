import React, {useCallback, useEffect, useLayoutEffect, useMemo, useState} from 'react';
import {Image, Pressable, ScrollView, StyleSheet, Switch, Text, View, type ImageSourcePropType} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ScrollViewWithThumb} from '../components/ScrollViewWithThumb';
import {MenuIcon} from '../components/MenuIcons';
import {Pill, StepFooter} from '../components/EarthSteps';
import {useEarthTheme, type EarthTheme} from '../hooks/useEarthTheme';
import {useTenyHoAnao} from '../hooks/useTenyHoAnao';
import {
  FEELINGS,
  LIFE_SITUATIONS,
  SITUATION_THEME,
  SITUATION_THEMES,
  type FeelingId,
  type LifeSituation,
  type SituationId,
  type SituationTheme,
} from '../constants/lifeSituations';
import {todaysWidgetRef, useVerse} from '../hooks/useSituationVerse';
import {dailyVerseFor} from '../constants/dailyVerses';
import type {DailyVerse} from '../services/reminders/readingReminder';
import {planPosition, situationById, type ActiveSituation} from '../utils/lifeSituations';
import {mixHex} from '../utils/colorUtils';
import {pinWidget} from '../services/widget/dailyVerseWidget';
import {useWidgetPlacement} from '../hooks/useWidgetPlacement';
import {WIDGET_PICTURE} from '../tutorials/widgetGuide';
import type {RootStackParamList} from '../navigation/RootNavigator';

// All copy on this screen is placeholder MG — user-owned.

const FEELING_ART: Record<FeelingId, ImageSourcePropType> = {
  afraid: require('../components/shared/illustrations/feeling-afraid.png'),
  sad: require('../components/shared/illustrations/feeling-sad.png'),
  discouraged: require('../components/shared/illustrations/feeling-discouraged.png'),
  angry: require('../components/shared/illustrations/feeling-angry.png'),
  ashamed: require('../components/shared/illustrations/feeling-ashamed.png'),
  thankful: require('../components/shared/illustrations/feeling-thankful.png'),
};

// Earth tones taken from the illustrations, one per theme.
const THEME_DOT: Record<SituationTheme, string> = {
  heart: '#C49A86',
  family: '#C8A96E',
  health: '#A3AE96',
  life: '#B9A58C',
  hardship: '#B5735A',
  faith: '#8F9A63',
  joy: '#E2B07A',
};

// Under the feeling question, small and in italics so the answers still
// follow the question closely (MG1865 text, as in the reader).
const INVITATION = {
  body: 'Mankanesa aty amiko, ianareo rehetra izay miasa fatratra sy mavesatra entana, fa Izaho no hanome anareo fitsaharana.',
  ref: 'Matio 11:28',
};

// A reading column: on a tablet, a foldable or a phone on its side the cards
// stay phone-width and centred instead of stretching edge to edge.
const COLUMN = {width: '100%', maxWidth: 560, alignSelf: 'center'} as const;

type Step = 'intro' | 'feeling' | 'choose' | 'order' | 'place';

const lengthLabel = (situation: LifeSituation): string =>
  situation.days
    ? `${situation.days} andro`
    : `Tsy misy farany · fanontaniana isaky ny ${situation.checkEvery} andro`;

// Top half of a circle: an outline, or filled.
const HalfCircle = ({r, color, filled}: {r: number; color: string; filled?: boolean}) => (
  <View style={[styles.half, {left: 80 - r, width: 2 * r, height: r}]}>
    <View
      style={[
        {width: 2 * r, height: 2 * r, borderRadius: r},
        filled ? {backgroundColor: color} : [styles.halfLine, {borderColor: color}],
      ]}
    />
  </View>
);

// The intro's rising sun, washed from the theme color into the ground so it
// belongs to whatever color the reader picked.
const Sunrise = ({earth}: {earth: EarthTheme}) => {
  const tone = (t: number) => mixHex(earth.ground, earth.accentText, t);
  return (
    <View style={styles.sunrise}>
      <HalfCircle r={75} color={tone(0.25)} />
      <HalfCircle r={55} color={tone(0.45)} />
      <HalfCircle r={32} color={tone(0.3)} filled />
      <View style={[styles.horizon, {backgroundColor: tone(0.45)}]} />
    </View>
  );
};

// A verse in the phone's serif, its reference after a short accent rule.
const VerseQuote = ({
  verse,
  earth,
  size = 'medium',
}: {
  verse: Pick<DailyVerse, 'body' | 'ref'>;
  earth: EarthTheme;
  size?: keyof typeof VERSE_SIZE;
}) => (
  <View style={styles.verse}>
    <Text style={[VERSE_SIZE[size], {color: earth.ink, fontFamily: earth.serif}]}>
      {verse.body}
    </Text>
    <View style={styles.refRow}>
      <View style={[styles.refRule, {backgroundColor: earth.accentText}]} />
      <Text style={[styles.refText, {color: earth.accentText}]}>{verse.ref}</Text>
    </View>
  </View>
);

// A choice on the feeling step: a picture and its word, centred, ticked in
// the corner when chosen. `hint` makes it full width, as for "Misafidy ny tsy
// hilaza".
const FeelingTile = ({
  label,
  art,
  hint,
  on,
  onPress,
  earth,
}: {
  label: string;
  art?: React.ReactNode;
  hint?: string;
  on: boolean;
  onPress: () => void;
  earth: EarthTheme;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{selected: on}}
    style={[
      styles.tile,
      hint ? styles.tileWide : null,
      on
        ? {borderColor: earth.accentText, backgroundColor: earth.accentTint}
        : {borderColor: earth.line, backgroundColor: earth.card},
    ]}
  >
    {art}
    <Text style={[styles.tileLabel, {color: earth.ink}]}>{label}</Text>
    {hint ? <Text style={[styles.tileHint, {color: earth.muted}]}>{hint}</Text> : null}
    {on ? <Text style={[styles.tileTick, {color: earth.accentText}]}>✓</Text> : null}
  </Pressable>
);

// One situation to choose, as its own card or as a row in a theme. The top
// ticks it; "Ohatra" is its own button (so it doesn't tick) and opens the
// plan's first verse underneath, outside the tick area.
const SituationChoice = ({
  label,
  hint,
  chosen,
  sample,
  onToggle,
  onSample,
  earth,
  framed,
}: {
  label: string;
  hint: string;
  chosen: boolean;
  // undefined: closed; null: open, the verse still loading.
  sample: DailyVerse | null | undefined;
  onToggle: () => void;
  onSample: () => void;
  earth: EarthTheme;
  framed?: boolean;
}) => (
  <View
    style={
      framed
        ? [styles.choiceCard, {backgroundColor: earth.card, borderColor: chosen ? earth.accentText : earth.line}]
        : [styles.choiceRow, {borderTopColor: earth.line}]
    }
  >
    <Pressable
      onPress={onToggle}
      style={styles.choiceMain}
      accessibilityRole="checkbox"
      accessibilityState={{checked: chosen}}
    >
      <View style={styles.flex}>
        <Text style={[styles.itemTitle, {color: earth.ink}]}>{label}</Text>
        <Text style={[styles.hint, {color: earth.muted}]}>{hint}</Text>
      </View>
      <View
        style={[
          styles.check,
          chosen ? {backgroundColor: earth.accent, borderColor: earth.accent} : {borderColor: earth.accentText},
        ]}
      >
        {chosen ? <Text style={[styles.checkMark, {color: earth.onAccent}]}>✓</Text> : null}
      </View>
    </Pressable>
    <Pressable
      onPress={onSample}
      hitSlop={8}
      style={styles.sampleLink}
      accessibilityRole="button"
      accessibilityState={{expanded: sample !== undefined}}
    >
      <Text style={[styles.sampleText, {color: earth.accentText}]}>
        {sample === undefined ? 'Ohatra ▸' : 'Ohatra ▾'}
      </Text>
    </Pressable>
    {sample ? (
      <View style={[styles.quoteBox, {backgroundColor: earth.quote}]}>
        <VerseQuote verse={sample} earth={earth} />
      </View>
    ) : null}
  </View>
);

// The person's situations in their order, with ▲ ▼ as 44pt targets.
const RankedList = ({
  situations,
  earth,
  onMove,
}: {
  situations: ActiveSituation[];
  earth: EarthTheme;
  onMove: (id: SituationId, delta: -1 | 1) => void;
}) => (
  <View style={[styles.card, {backgroundColor: earth.card}]}>
    {situations.map((active, index) => {
      const situation = situationById(active.id);
      if (!situation) return null;
      const first = index === 0;
      const last = index === situations.length - 1;
      return (
        <View key={active.id} style={[styles.rankRow, index > 0 && [styles.rowLine, {borderTopColor: earth.line}]]}>
          <Text style={[styles.rank, {color: earth.accentText}]}>{index + 1}</Text>
          <View style={styles.flex}>
            <Text style={[styles.itemTitle, {color: earth.ink}]}>{situation.label}</Text>
            <Text style={[styles.hint, {color: earth.muted}]}>{lengthLabel(situation)}</Text>
          </View>
          <Pressable
            disabled={first}
            onPress={() => onMove(active.id, -1)}
            style={[styles.arrow, first && styles.disabled]}
            accessibilityLabel="Atsangano"
          >
            <Text style={[styles.arrowText, {color: earth.muted}]}>▲</Text>
          </Pressable>
          <Pressable
            disabled={last}
            onPress={() => onMove(active.id, 1)}
            style={[styles.arrow, last && styles.disabled]}
            accessibilityLabel="Ampidino"
          >
            <Text style={[styles.arrowText, {color: earth.muted}]}>▼</Text>
          </Pressable>
        </View>
      );
    })}
  </View>
);

// "Teny ho anao" (menu "Widget"): the person can choose words for the widget
// that fit what they are living through. Gentle by design, after
// trauma-informed guidance: one question per screen, every step leavable and
// the feeling optional, then a summary. The widget and verse notifications
// follow those plans instead of the general calendar (see
// utils/lifeSituations).
const TenyHoAnaoScreen = () => {
  const earth = useEarthTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    state,
    loaded,
    due,
    remove,
    stillIn,
    setOnWidget,
    setInReminders,
    clearAll,
    draft,
    startEditing,
    cancelEditing,
    clearDraft,
    toggleDraft,
    moveDraft,
    commitDraft,
  } = useTenyHoAnao();
  const [step, setStep] = useState<Exclude<Step, 'intro' | 'place'>>('feeling');
  // The widget step, once the choice is saved: where to go after it.
  const [placing, setPlacing] = useState<'summary' | 'leave' | null>(null);
  // Whether these steps started with nothing chosen, kept from the start:
  // saving the choice fills the list, and the dots and the widget step must
  // not move with it.
  const [startedEmpty, setStartedEmpty] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // Turning the widget switch off: how to take it off, since the app can't.
  const [removeHint, setRemoveHint] = useState(false);
  // 'unsure': "Misafidy ny tsy hilaza", which keeps the Fampaherezana tsotra.
  const [feeling, setFeeling] = useState<FeelingId | 'unsure' | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [openTheme, setOpenTheme] = useState<SituationTheme | null>(null);
  // 'default': the Fampaherezana tsotra card, whose sample is today's calendar verse.
  const [sampleId, setSampleId] = useState<SituationId | 'default' | null>(null);
  const sample = useVerse(
    sampleId === 'default' ? dailyVerseFor(new Date()) : sampleId ? situationById(sampleId)?.verses[0] ?? null : null,
  );
  // Only the summary shows it.
  const todayVerse = useVerse(loaded && !draft && state.situations.length > 0 ? todaysWidgetRef(state) : null);
  // Android only: iOS can't add a widget for the person.
  const {canPin, placed} = useWidgetPlacement();

  // A calm header on the sand ground, for this screen only.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: {backgroundColor: earth.ground},
      headerTintColor: earth.ink,
      headerTitleStyle: {color: earth.ink, fontSize: 18, fontWeight: '700'},
      headerShadowVisible: false,
      statusBarStyle: earth.isDark ? 'light' : 'dark',
    });
  }, [navigation, earth]);

  const ground = [styles.container, {backgroundColor: earth.ground}];
  // The widget's own bits (its card, the "what is it?" link, its step).
  const tinted = useMemo(
    () =>
      StyleSheet.create({
        card: {backgroundColor: earth.card},
        ink: {color: earth.ink},
        muted: {color: earth.muted},
        accent: {color: earth.accentText},
        title: {color: earth.ink, fontFamily: earth.serif},
        badge: {backgroundColor: earth.accentTint},
        line: {borderTopColor: earth.line},
      }),
    [earth],
  );

  const leave = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({index: 0, routes: [{name: 'Home'}]});
  }, [navigation]);

  // Added by hand meanwhile (from the guide): nothing left to ask.
  useEffect(() => {
    if (!placing || !placed) return;
    setPlacing(null);
    if (placing === 'leave') leave();
  }, [placing, placed, leave]);

  if (!loaded) {
    return <SafeAreaView edges={['bottom']} style={ground} />;
  }

  const edit = (from: 'feeling' | 'choose') => {
    setStartedEmpty(state.situations.length === 0);
    startEditing();
    setStep(from);
  };
  const view: Step | 'summary' = draft ? step : state.situations.length > 0 ? 'summary' : 'intro';

  const firstSetup = draft || placing ? startedEmpty : state.situations.length === 0;
  // First setup only: one yes/no question, the last step, to put the widget
  // on the home screen (the launcher shows its own "add?" card). No just
  // moves on; later the summary's switch shows it missing.
  const placeNext = canPin && !placed && firstSetup;
  // The dots count only the steps this person will actually see. Once saved,
  // the choice is in `state`.
  const count = (draft ?? state).situations.length;
  const steps: Step[] = [
    ...(firstSetup ? (['intro'] as const) : []),
    'feeling',
    // "Misafidy ny tsy hilaza" ends after the feeling.
    ...(feeling === 'unsure' ? [] : (['choose'] as const)),
    ...(count > 1 ? (['order'] as const) : []),
    ...(placeNext || placing ? (['place'] as const) : []),
  ];
  const dots = (s: Step) => ({count: steps.length, current: steps.indexOf(s)});
  const finish = (then: 'summary' | 'leave') => {
    if (placeNext) setPlacing(then);
    else if (then === 'leave') leave();
  };

  // Many people don't know the word: the guide shows a widget, then how to add it.
  const whatIsWidget = (
    <Pressable style={styles.whatLink} onPress={() => navigation.navigate('WidgetGuide')} accessibilityRole="link">
      <Text style={[styles.whatLinkText, tinted.accent]}>Inona ilay widget? ›</Text>
    </Pressable>
  );

  if (placing) {
    const done = () => {
      setPlacing(null);
      if (placing === 'leave') leave();
    };
    return (
      <SafeAreaView edges={['bottom']} style={ground}>
        <ScrollView contentContainerStyle={styles.introScroll}>
          <Image source={WIDGET_PICTURE.image} style={styles.placeArt} accessibilityIgnoresInvertColors />
          <Text style={[styles.placeTitle, tinted.title]}>Apetraho eo amin'ny écran d'accueil ny widget?</Text>
          {whatIsWidget}
        </ScrollView>
        <StepFooter
          earth={earth}
          dots={dots('place')}
          nextLabel="Eny"
          onNext={() => {
            pinWidget();
            done();
          }}
          backLabel="Tsia"
          onBack={done}
        />
      </SafeAreaView>
    );
  }

  if (view === 'intro') {
    return (
      <SafeAreaView edges={['bottom']} style={ground}>
        <ScrollView contentContainerStyle={styles.introScroll}>
          <Sunrise earth={earth} />
          <Text style={[styles.introTitle, {color: earth.ink, fontFamily: earth.serif}]}>Teny ho anao</Text>
          <Text style={[styles.introText, {color: earth.ink}]}>
            Eto no misafidy ny teny hiseho ao amin'ny widget. Teny ampaherezana anao
            mifanaraka amin'izay toe-javatra hiainanao.
          </Text>
          {whatIsWidget}
        </ScrollView>
        <StepFooter
          earth={earth}
          dots={dots('intro')}
          nextLabel="Hanohy"
          onNext={() => edit('feeling')}
          backLabel="Tsy izao"
          onBack={leave}
        />
      </SafeAreaView>
    );
  }

  if (view === 'feeling' && draft) {
    return (
      <SafeAreaView edges={['bottom']} style={ground}>
        <ScrollViewWithThumb style={styles.list} contentContainerStyle={[styles.scroll, styles.scrollTight]}>
          <Text style={[styles.headingLarge, {color: earth.ink, fontFamily: earth.serif}]}>
            Manahoana ny toe-ponao ankehitriny?
          </Text>
          <Text style={[styles.epigraph, {color: earth.muted, fontFamily: earth.serif}]}>
            “{INVITATION.body}” <Text style={styles.epigraphRef}>{INVITATION.ref}</Text>
          </Text>
          {/* People know how they feel; some choose not to say, and that
              choice comes first. Only before a first choice, so it never
              drops plans already chosen. MG copy is the user's. */}
          {state.situations.length === 0 ? (
            <FeelingTile
              label="Misafidy ny tsy hilaza"
              hint="Ny programa tsotra no hiseho eo amin'ny widget."
              on={feeling === 'unsure'}
              earth={earth}
              onPress={() => setFeeling(feeling === 'unsure' ? null : 'unsure')}
            />
          ) : null}
          {/* Optional: a feeling brings what may fit to the top, ticks nothing. */}
          <View style={styles.tiles}>
            {FEELINGS.map(f => (
              <FeelingTile
                key={f.id}
                label={f.label}
                art={<Image source={FEELING_ART[f.id]} style={styles.tileArt} />}
                on={feeling === f.id}
                earth={earth}
                onPress={() => {
                  setFeeling(feeling === f.id ? null : f.id);
                  setShowAll(false);
                }}
              />
            ))}
          </View>
        </ScrollViewWithThumb>
        <StepFooter
          earth={earth}
          dots={dots('feeling')}
          // Choosing not to say ends here, keeping the Fampaherezana tsotra.
          nextLabel={feeling === 'unsure' && !placeNext ? 'Vita' : 'Manaraka'}
          onNext={() => {
            if (feeling !== 'unsure') {
              setStep('choose');
              return;
            }
            cancelEditing();
            finish('leave');
          }}
          backLabel="Hiverina"
          onBack={cancelEditing}
        />
      </SafeAreaView>
    );
  }

  if (view === 'choose' && draft) {
    const chosen = new Set(draft.situations.map(s => s.id));
    const picked = FEELINGS.find(f => f.id === feeling);
    const matches = (picked?.situations ?? []).map(situationById).filter((s): s is LifeSituation => !!s);
    const renderChoice = (situation: LifeSituation, framed: boolean) => (
      <SituationChoice
        key={situation.id}
        label={situation.label}
        hint={lengthLabel(situation)}
        chosen={chosen.has(situation.id)}
        sample={sampleId === situation.id ? sample : undefined}
        onToggle={() => toggleDraft(situation.id)}
        onSample={() => setSampleId(id => (id === situation.id ? null : situation.id))}
        earth={earth}
        framed={framed}
      />
    );
    return (
      <SafeAreaView edges={['bottom']} style={ground}>
        <ScrollViewWithThumb style={styles.list} contentContainerStyle={styles.scroll}>
          <Text style={[styles.heading, {color: earth.ink, fontFamily: earth.serif}]}>
            Safidio ny karazana teny fampaherezana tianao hiseho eo amin'ny widget
          </Text>
          <Text style={[styles.lead, {color: earth.muted}]}>Azonao atao ny misafidy maromaro.</Text>

          {/* The general calendar: ticked until a situation is chosen, and
              ticking it again clears them. Placeholder MG copy — user-owned. */}
          <SituationChoice
            label="Fampaherezana tsotra"
            hint="Andininy iray isan'andro"
            chosen={count === 0}
            sample={sampleId === 'default' ? sample : undefined}
            onToggle={clearDraft}
            onSample={() => setSampleId(id => (id === 'default' ? null : 'default'))}
            earth={earth}
            framed
          />

          {picked ? (
            <>
              <Pressable
                onPress={() => setStep('feeling')}
                style={[styles.feelingChip, {backgroundColor: earth.chip}]}
                accessibilityRole="button"
              >
                <Image source={FEELING_ART[picked.id]} style={styles.chipArt} />
                <Text style={[styles.chipText, {color: earth.ink}]}>Ny safidinao · {picked.label}</Text>
              </Pressable>
              {matches.map(s => renderChoice(s, true))}
              {!showAll ? (
                <Pressable
                  onPress={() => setShowAll(true)}
                  style={[styles.showAll, {borderColor: earth.edge}]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.itemTitle, {color: earth.ink}]}>Hijery ny toe-javatra rehetra</Text>
                  <Text style={[styles.arrowText, {color: earth.muted}]}>▾</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {/* Every situation, by theme, one theme open at a time. */}
          {!picked || showAll
            ? SITUATION_THEMES.map(section => {
                const list = LIFE_SITUATIONS.filter(s => SITUATION_THEME[s.id] === section.theme);
                const ticked = list.filter(s => chosen.has(s.id)).length;
                const open = openTheme === section.theme;
                return (
                  <View key={section.theme} style={[styles.themeCard, {backgroundColor: earth.card, borderColor: earth.line}]}>
                    <Pressable
                      onPress={() => setOpenTheme(open ? null : section.theme)}
                      style={styles.themeHead}
                      accessibilityRole="button"
                      accessibilityState={{expanded: open}}
                    >
                      <View style={[styles.themeDot, {backgroundColor: THEME_DOT[section.theme]}]} />
                      <Text style={[styles.itemTitle, styles.flex, {color: earth.ink}]}>{section.title}</Text>
                      <Text style={[styles.hint, {color: ticked > 0 ? earth.accentText : earth.muted}]}>
                        {ticked > 0 ? `${ticked} / ${list.length}` : list.length}
                      </Text>
                    </Pressable>
                    {open ? <View style={styles.themeBody}>{list.map(s => renderChoice(s, false))}</View> : null}
                  </View>
                );
              })
            : null}
        </ScrollViewWithThumb>
        <StepFooter
          earth={earth}
          dots={dots('choose')}
          // With one situation there is nothing to order: finish here.
          nextLabel={count > 1 || placeNext ? 'Manaraka' : 'Vita'}
          onNext={() => {
            if (count > 1) {
              setStep('order');
              return;
            }
            commitDraft();
            // Fampaherezana tsotra: no plan to sum up, back where the person came from.
            finish(count === 0 ? 'leave' : 'summary');
          }}
          backLabel="Hiverina"
          onBack={() => setStep('feeling')}
        />
      </SafeAreaView>
    );
  }

  if (view === 'order' && draft) {
    return (
      <SafeAreaView edges={['bottom']} style={ground}>
        <ScrollViewWithThumb style={styles.list} contentContainerStyle={styles.scroll}>
          <Text style={[styles.heading, {color: earth.ink, fontFamily: earth.serif}]}>Alaharo araka izay tianao</Text>
          <Text style={[styles.lead, {color: earth.muted}]}>
            Andininy iray isan'andro, mifandimby araka io filaharana io.
          </Text>
          <RankedList situations={draft.situations} earth={earth} onMove={moveDraft} />
        </ScrollViewWithThumb>
        <StepFooter
          earth={earth}
          dots={dots('order')}
          nextLabel={placeNext ? 'Manaraka' : 'Vita'}
          onNext={() => {
            commitDraft();
            finish('summary');
          }}
          backLabel="Hiverina"
          onBack={() => setStep('choose')}
        />
      </SafeAreaView>
    );
  }

  const today = new Date();
  const needsSafetyNote = state.situations.some(s => situationById(s.id)?.safetyNote);
  const progress = (id: SituationId) => {
    const {shown, days} = planPosition(id, state.situations, today, state.since);
    return {days, shown, label: days ? `${shown} / ${days} andro` : 'Tsy misy farany'};
  };
  const switchTrack = {false: earth.edge, true: earth.accentText};

  return (
    <SafeAreaView edges={['bottom']} style={ground}>
      <ScrollViewWithThumb style={styles.list} contentContainerStyle={styles.scroll}>
        {/* Is the widget on the home screen? On adds it (the launcher's own
            card). Android has no call to take it off, so off only says how: a
            long press on the home screen. TEMP: Malagasy status lines and hint
            to be written by the owner. */}
        {canPin ? (
          <View style={[styles.card, tinted.card]}>
            <View style={styles.switchRow}>
              <View style={[styles.widgetBadge, tinted.badge]}>
                <MenuIcon name="bubble" color={earth.accentText} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.itemTitle, tinted.ink]}>Widget</Text>
                <Text style={[styles.hint, placed ? tinted.accent : tinted.muted]}>
                  {placed ? "✓ Eo amin'ny écran d'accueil" : "Tsy eo amin'ny écran d'accueil"}
                </Text>
              </View>
              <Switch
                value={placed}
                onValueChange={on => {
                  setRemoveHint(!on);
                  if (on) pinWidget();
                }}
                trackColor={switchTrack}
                thumbColor={earth.card}
              />
            </View>
            {placed && removeHint ? (
              <Text style={[styles.hint, styles.widgetHint, styles.rowLine, tinted.muted, tinted.line]}>
                Raha hanala azy: tsindrio ela ilay widget eo amin'ny écran d'accueil.
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* A check-in takes the place of the verse: the widget opens here on
            those days. */}
        {due.map(active => {
          const situation = situationById(active.id);
          if (!situation) return null;
          return (
            <View key={`due-${active.id}`} style={[styles.hero, {backgroundColor: earth.card}]}>
              <Text style={[styles.question, {color: earth.ink, fontFamily: earth.serif}]}>
                Mbola ao amin'ny « {situation.label} » ve ianao?
              </Text>
              <Text style={[styles.questionMeta, {color: earth.muted}]}>{progress(active.id).label}</Text>
              <View style={styles.stack}>
                <Pill label="Mbola eo" onPress={() => stillIn(active.id)} earth={earth} />
                <Pill label="Efa nihatsara" onPress={() => remove(active.id)} earth={earth} kind="outline" />
                <Pill
                  label="Toe-javatra hafa"
                  // This one ends, and the steps open to choose another.
                  onPress={() => {
                    remove(active.id);
                    edit('feeling');
                  }}
                  earth={earth}
                  kind="quiet"
                />
              </View>
            </View>
          );
        })}

        {todayVerse ? (
          <View style={[styles.hero, {backgroundColor: earth.card}]}>
            <Text style={[styles.eyebrow, {color: earth.muted}]}>Ny teny anio</Text>
            <VerseQuote verse={todayVerse} earth={earth} size="large" />
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, {color: earth.ink}]}>Ny karazana teny ho anao</Text>
          <Pressable onPress={() => edit('choose')} style={styles.sectionLink} accessibilityRole="button">
            <Text style={[styles.sectionTitle, {color: earth.accentText}]}>Ovay</Text>
          </Pressable>
        </View>
        <View style={[styles.card, {backgroundColor: earth.card}]}>
          {state.situations.map((active, index) => {
            const situation = situationById(active.id);
            if (!situation) return null;
            const {days, shown, label} = progress(active.id);
            return (
              <View key={active.id} style={[styles.planRow, index > 0 && [styles.rowLine, {borderTopColor: earth.line}]]}>
                <View style={styles.planHead}>
                  <Text style={[styles.itemTitle, styles.flex, {color: earth.ink}]}>{situation.label}</Text>
                  <Text style={[styles.hint, {color: earth.muted}]}>{label}</Text>
                </View>
                {days ? (
                  <View style={[styles.track, {backgroundColor: earth.line}]}>
                    <View style={[styles.bar, {backgroundColor: earth.accentText, width: `${(100 * shown) / days}%`}]} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {needsSafetyNote ? (
          // NOTE: confirm 117 (national emergency number) before release.
          <Text style={[styles.safety, {color: earth.ink, backgroundColor: earth.chip}]}>
            Raha mavesatra loatra ny alahelo na olana manjo anao, manantona mpitsabo na mpitondra
            fivavahana, na antsoy ny 117.
          </Text>
        ) : null}

        <Text style={[styles.sectionTitle, styles.sectionGap, {color: earth.ink}]}>Aiza no hisehoany?</Text>
        <View style={[styles.card, {backgroundColor: earth.card}]}>
          <View style={styles.switchRow}>
            <Text style={[styles.itemTitle, styles.flex, {color: earth.ink}]}>Ao amin'ny widget</Text>
            <Switch value={state.onWidget} onValueChange={setOnWidget} trackColor={switchTrack} thumbColor={earth.card} />
          </View>
          <View style={[styles.switchRow, styles.rowLine, {borderTopColor: earth.line}]}>
            <View style={styles.flex}>
              <Text style={[styles.itemTitle, {color: earth.ink}]}>Ao amin'ny fampahatsiahivana</Text>
              <Text style={[styles.hint, {color: earth.muted}]}>
                Ho an'ny fampahatsiahivana « Sakafom-panahy » ao amin'ny Ora famakiana tiana.
              </Text>
            </View>
            <Switch
              value={state.inReminders}
              onValueChange={setInReminders}
              trackColor={switchTrack}
              thumbColor={earth.card}
            />
          </View>
        </View>

        {/* A quiet way to the widget's look, not a step: nothing is asked. */}
        <Pressable
          style={[styles.card, styles.linkRow, {backgroundColor: earth.card}]}
          onPress={() => navigation.navigate('WidgetLook')}
          accessibilityRole="button"
        >
          <Text style={[styles.itemTitle, styles.flex, {color: earth.ink}]}>Lokon'ny widget</Text>
          <Text style={[styles.arrowText, {color: earth.muted}]}>›</Text>
        </Pressable>
        <Pressable
          style={[styles.card, styles.linkRow, tinted.card]}
          onPress={() => navigation.navigate('WidgetGuide')}
          accessibilityRole="button"
        >
          <Text style={[styles.itemTitle, styles.flex, tinted.ink]}>Inona ilay widget?</Text>
          <Text style={[styles.arrowText, tinted.muted]}>›</Text>
        </Pressable>

        {confirmClear ? (
          <View style={[styles.hero, {backgroundColor: earth.card}]}>
            <Text style={[styles.itemTitle, {color: earth.ink}]}>
              Hofafana daholo ve ny toe-javatra rehetra voafidy?
            </Text>
            <View style={styles.stack}>
              <Pill
                label="Fafao"
                onPress={() => {
                  setConfirmClear(false);
                  clearAll();
                }}
                earth={earth}
              />
              <Pill label="Aoka izay" onPress={() => setConfirmClear(false)} earth={earth} kind="quiet" />
            </View>
          </View>
        ) : (
          <Pressable style={styles.backButton} onPress={() => setConfirmClear(true)} accessibilityRole="button">
            <Text style={[styles.backText, {color: earth.muted}]}>Fafao ny zava-drehetra</Text>
          </Pressable>
        )}
      </ScrollViewWithThumb>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  flex: {flex: 1},
  // Fills the space above the step footer; its thumb says when more is below.
  list: {flex: 1},
  scroll: {...COLUMN, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32, gap: 12},
  // The feeling step is meant to fit a usual phone without scrolling.
  scrollTight: {paddingBottom: 12, gap: 10},
  headingLarge: {fontSize: 25, lineHeight: 31, fontWeight: '600'},
  epigraph: {fontSize: 13, lineHeight: 19, fontStyle: 'italic'},
  epigraphRef: {fontWeight: '700'},
  heading: {fontSize: 23, lineHeight: 30, fontWeight: '600'},
  lead: {fontSize: 16, lineHeight: 24, marginBottom: 8},
  hint: {fontSize: 14, lineHeight: 19},
  itemTitle: {fontSize: 17, lineHeight: 22, fontWeight: '700'},
  disabled: {opacity: 0.35},
  backButton: {alignItems: 'center', justifyContent: 'center', minHeight: 48},
  backText: {fontSize: 16, fontWeight: '600'},
  introScroll: {...COLUMN, flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, gap: 18},
  sunrise: {width: 160, height: 92, marginBottom: 12},
  half: {position: 'absolute', bottom: 1.5, overflow: 'hidden'},
  halfLine: {borderWidth: 1.5},
  horizon: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 1.5},
  introTitle: {fontSize: 34, lineHeight: 40, fontWeight: '600', textAlign: 'center'},
  introText: {fontSize: 18, lineHeight: 28, textAlign: 'center'},
  tiles: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  tile: {
    flexBasis: '45%',
    flexGrow: 1,
    minHeight: 76,
    borderWidth: 2,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tileArt: {width: 40, height: 40},
  tileTick: {position: 'absolute', top: 6, right: 10, fontSize: 18, fontWeight: '700'},
  tileLabel: {fontSize: 17, lineHeight: 22, fontWeight: '700', textAlign: 'center'},
  tileWide: {flexBasis: 'auto', minHeight: 0, paddingVertical: 10, paddingHorizontal: 28},
  tileHint: {fontSize: 13, lineHeight: 17, textAlign: 'center'},
  feelingChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: 20,
  },
  chipArt: {width: 28, height: 28},
  chipText: {fontSize: 14, fontWeight: '700'},
  choiceCard: {borderWidth: 2, borderRadius: 18, paddingLeft: 18, paddingRight: 16, paddingTop: 12, paddingBottom: 10},
  choiceRow: {borderTopWidth: 1, paddingTop: 10, paddingBottom: 8},
  choiceMain: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44},
  check: {width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  checkMark: {fontSize: 15, fontWeight: '700'},
  sampleLink: {alignSelf: 'flex-start', paddingVertical: 6},
  sampleText: {fontSize: 14, fontWeight: '700'},
  quoteBox: {borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginTop: 4, marginBottom: 6},
  verse: {gap: 10},
  verseText: {fontSize: 17, lineHeight: 26},
  verseLarge: {fontSize: 23, lineHeight: 33},
  refRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  refRule: {width: 24, height: 1.5},
  refText: {fontSize: 14, fontWeight: '700'},
  showAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  themeCard: {borderWidth: 1.5, borderRadius: 18},
  themeHead: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 18},
  themeDot: {width: 12, height: 12, borderRadius: 6},
  themeBody: {paddingHorizontal: 18, paddingBottom: 6},
  card: {borderRadius: 20, paddingHorizontal: 18},
  rankRow: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8},
  rowLine: {borderTopWidth: 1},
  rank: {width: 24, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums']},
  arrow: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  arrowText: {fontSize: 16, fontWeight: '700'},
  hero: {borderRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 22, gap: 16},
  eyebrow: {fontSize: 13, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase'},
  question: {fontSize: 24, lineHeight: 32, fontWeight: '600', textAlign: 'center'},
  questionMeta: {fontSize: 15, lineHeight: 22, textAlign: 'center'},
  stack: {gap: 12},
  sectionHead: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 4},
  sectionTitle: {fontSize: 15, fontWeight: '700', letterSpacing: 0.4},
  sectionGap: {marginTop: 8, paddingHorizontal: 4},
  sectionLink: {minHeight: 44, justifyContent: 'center', paddingHorizontal: 4},
  planRow: {paddingVertical: 14, gap: 10},
  planHead: {flexDirection: 'row', alignItems: 'baseline', gap: 12},
  track: {height: 6, borderRadius: 3, overflow: 'hidden'},
  bar: {height: 6, borderRadius: 3},
  safety: {fontSize: 14, lineHeight: 21, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14},
  switchRow: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8},
  linkRow: {flexDirection: 'row', alignItems: 'center', minHeight: 56},
  whatLink: {minHeight: 44, justifyContent: 'center', paddingHorizontal: 8},
  whatLinkText: {fontSize: 16, fontWeight: '600'},
  placeArt: {width: '100%', height: undefined, aspectRatio: WIDGET_PICTURE.aspect, borderRadius: 16},
  placeTitle: {fontSize: 25, lineHeight: 31, fontWeight: '600', textAlign: 'center'},
  widgetBadge: {width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center'},
  widgetHint: {paddingVertical: 12},
});

const VERSE_SIZE = {medium: styles.verseText, large: styles.verseLarge};

export default TenyHoAnaoScreen;
