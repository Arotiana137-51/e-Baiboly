import React, {useLayoutEffect, useState} from 'react';
import {Image, Pressable, ScrollView, StyleSheet, Switch, Text, View, type ImageSourcePropType} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ScrollViewWithThumb} from '../components/ScrollViewWithThumb';
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
import type {DailyVerse} from '../services/reminders/readingReminder';
import {planPosition, situationById, type ActiveSituation} from '../utils/lifeSituations';
import {mixHex} from '../utils/colorUtils';
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
};

// Under the feeling question (MG1865 text, as in the reader).
const INVITATION = {
  body: 'Mankanesa aty amiko, ianareo rehetra izay miasa fatratra sy mavesatra entana, fa Izaho no hanome anareo fitsaharana.',
  ref: 'Matio 11:28',
};

type Step = 'intro' | 'feeling' | 'choose' | 'order';
type Feeling = (typeof FEELINGS)[number];

const lengthLabel = (situation: LifeSituation): string =>
  situation.days
    ? `${situation.days} andro`
    : `Tsy misy farany · fanontaniana isaky ny ${situation.checkEvery} andro`;

// A wide pill: the step's action filled, the others outlined ('quiet' for
// the one that changes nothing).
const Pill = ({
  label,
  onPress,
  earth,
  kind = 'filled',
  disabled,
}: {
  label: string;
  onPress: () => void;
  earth: EarthTheme;
  kind?: 'filled' | 'outline' | 'quiet';
  disabled?: boolean;
}) => {
  const filled = kind === 'filled';
  const color = filled ? earth.onAccent : kind === 'outline' ? earth.accentText : earth.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{disabled: !!disabled}}
      style={({pressed}) => [
        styles.pill,
        filled
          ? {backgroundColor: earth.accent}
          : [styles.pillOutline, {borderColor: kind === 'outline' ? earth.accentText : earth.edge}],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.pillText, {color}]}>{label}</Text>
    </Pressable>
  );
};

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

const StepDots = ({count, current, earth}: {count: number; current: number; earth: EarthTheme}) => (
  <View style={styles.dots} accessibilityLabel={`${current + 1} / ${count}`}>
    {Array.from({length: count}, (_, i) => (
      <View
        key={i}
        style={[styles.dot, i === current && styles.dotOn, {backgroundColor: i === current ? earth.accentText : earth.edge}]}
      />
    ))}
  </View>
);

// A step's buttons: the next step as a wide pill, the quiet way back as text
// under it. Both centred, so either thumb reaches them.
const StepFooter = ({
  earth,
  dots,
  nextLabel,
  onNext,
  nextDisabled,
  backLabel,
  onBack,
}: {
  earth: EarthTheme;
  dots: {count: number; current: number};
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  backLabel: string;
  onBack: () => void;
}) => (
  <View style={[styles.footer, {backgroundColor: earth.ground}]}>
    <StepDots count={dots.count} current={dots.current} earth={earth} />
    <Pill label={nextLabel} onPress={onNext} earth={earth} disabled={nextDisabled} />
    <Pressable style={styles.backButton} onPress={onBack} accessibilityRole="button">
      <Text style={[styles.backText, {color: earth.muted}]}>{backLabel}</Text>
    </Pressable>
  </View>
);

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

const FeelingTile = ({
  feeling,
  on,
  onPress,
  earth,
}: {
  feeling: Feeling;
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
      on
        ? {borderColor: earth.accentText, backgroundColor: earth.accentTint}
        : {borderColor: earth.line, backgroundColor: earth.card},
    ]}
  >
    <View style={styles.tileTop}>
      <Image source={FEELING_ART[feeling.id]} style={styles.tileArt} />
      {on ? <Text style={[styles.tileTick, {color: earth.accentText}]}>✓</Text> : null}
    </View>
    <Text style={[styles.tileLabel, {color: earth.ink}]}>{feeling.label}</Text>
  </Pressable>
);

// One situation to choose, as its own card or as a row in a theme. The top
// ticks it; "Ohatra" is its own button (so it doesn't tick) and opens the
// plan's first verse underneath, outside the tick area.
const SituationChoice = ({
  situation,
  chosen,
  sample,
  onToggle,
  onSample,
  earth,
  framed,
}: {
  situation: LifeSituation;
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
        <Text style={[styles.itemTitle, {color: earth.ink}]}>{situation.label}</Text>
        <Text style={[styles.hint, {color: earth.muted}]}>{lengthLabel(situation)}</Text>
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
    toggleDraft,
    moveDraft,
    commitDraft,
  } = useTenyHoAnao();
  const [step, setStep] = useState<Exclude<Step, 'intro'>>('feeling');
  const [confirmClear, setConfirmClear] = useState(false);
  const [feeling, setFeeling] = useState<FeelingId | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [openTheme, setOpenTheme] = useState<SituationTheme | null>(null);
  const [sampleId, setSampleId] = useState<SituationId | null>(null);
  const sample = useVerse(sampleId ? situationById(sampleId)?.verses[0] ?? null : null);
  // Only the summary shows it.
  const todayVerse = useVerse(loaded && !draft && state.situations.length > 0 ? todaysWidgetRef(state) : null);

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

  if (!loaded) {
    return <SafeAreaView edges={['bottom']} style={ground} />;
  }

  const leave = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({index: 0, routes: [{name: 'Home'}]});
  };
  const edit = (from: 'feeling' | 'choose') => {
    startEditing();
    setStep(from);
  };
  const view: Step | 'summary' = draft ? step : state.situations.length > 0 ? 'summary' : 'intro';

  // The dots count only the steps this person will actually see.
  const count = draft?.situations.length ?? 0;
  const steps: Step[] = [
    ...(state.situations.length === 0 ? (['intro'] as const) : []),
    'feeling',
    'choose',
    ...(count > 1 ? (['order'] as const) : []),
  ];
  const dots = (s: Step) => ({count: steps.length, current: steps.indexOf(s)});

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
          <VerseQuote verse={INVITATION} earth={earth} size="small" />
          {/* Optional: a feeling brings what may fit to the top, ticks nothing. */}
          <View style={styles.tiles}>
            {FEELINGS.map(f => (
              <FeelingTile
                key={f.id}
                feeling={f}
                on={feeling === f.id}
                earth={earth}
                onPress={() => {
                  setFeeling(feeling === f.id ? null : f.id);
                  setShowAll(false);
                }}
              />
            ))}
          </View>
          {/* Nobody has to name what hurts. Only before a first choice, so it
              never drops plans already chosen. */}
          {state.situations.length === 0 ? (
            <Pressable
              onPress={() => {
                cancelEditing();
                leave();
              }}
              style={styles.unsure}
              accessibilityRole="button"
            >
              <Text style={[styles.unsureTitle, {color: earth.accentText}]}>Tsy fantatro</Text>
              <Text style={[styles.hint, {color: earth.muted}]}>
                Ny teny isan'andro mahazatra no hiseho eo amin'ny widget.
              </Text>
            </Pressable>
          ) : null}
        </ScrollViewWithThumb>
        <StepFooter
          earth={earth}
          dots={dots('feeling')}
          nextLabel="Manaraka"
          onNext={() => setStep('choose')}
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
        situation={situation}
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

          {picked ? (
            <>
              <Pressable
                onPress={() => setStep('feeling')}
                style={[styles.feelingChip, {backgroundColor: earth.chip}]}
                accessibilityRole="button"
              >
                <Image source={FEELING_ART[picked.id]} style={styles.chipArt} />
                <Text style={[styles.chipText, {color: earth.ink}]}>Mety aminao · {picked.label}</Text>
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
          nextLabel={count > 1 ? 'Manaraka' : 'Vita'}
          onNext={() => (count > 1 ? setStep('order') : commitDraft())}
          nextDisabled={count === 0}
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
          nextLabel="Vita"
          onNext={commitDraft}
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
          <Text style={[styles.sectionTitle, {color: earth.ink}]}>Ny teninao</Text>
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
            Raha mavesatra loatra izany, mitenena amin'ny pasitera na olona itokisanao.
            Raha misy loza: 117.
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
  scroll: {paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32, gap: 12},
  // The feeling step is meant to fit a usual phone without scrolling.
  scrollTight: {paddingBottom: 12},
  headingLarge: {fontSize: 25, lineHeight: 31, fontWeight: '600'},
  heading: {fontSize: 23, lineHeight: 30, fontWeight: '600'},
  lead: {fontSize: 16, lineHeight: 24, marginBottom: 8},
  hint: {fontSize: 14, lineHeight: 19},
  itemTitle: {fontSize: 17, lineHeight: 22, fontWeight: '700'},
  pill: {height: 54, borderRadius: 27, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center'},
  pillOutline: {borderWidth: 1.5},
  pillText: {fontSize: 17, fontWeight: '700'},
  pressed: {opacity: 0.85},
  disabled: {opacity: 0.35},
  dots: {flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12},
  dot: {width: 6, height: 6, borderRadius: 3},
  dotOn: {width: 20},
  footer: {paddingHorizontal: 24, paddingTop: 14, paddingBottom: 12},
  backButton: {alignItems: 'center', justifyContent: 'center', minHeight: 48},
  backText: {fontSize: 16, fontWeight: '600'},
  introScroll: {flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, gap: 18},
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
    height: 88,
    borderWidth: 2,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  tileTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  tileArt: {width: 44, height: 44},
  tileTick: {fontSize: 18, fontWeight: '700'},
  tileLabel: {fontSize: 17, lineHeight: 22, fontWeight: '700'},
  unsure: {paddingVertical: 4, gap: 3},
  unsureTitle: {fontSize: 16, fontWeight: '700'},
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
  verseSmall: {fontSize: 15, lineHeight: 22},
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
});

const VERSE_SIZE = {small: styles.verseSmall, medium: styles.verseText, large: styles.verseLarge};

export default TenyHoAnaoScreen;
