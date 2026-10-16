import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../contexts/ThemeContext';
import {ScrollViewWithThumb} from '../components/ScrollViewWithThumb';
import {useTenyHoAnao} from '../hooks/useTenyHoAnao';
import {
  FEELINGS,
  LIFE_SITUATIONS,
  SITUATION_THEME,
  SITUATION_THEMES,
  type FeelingId,
  type LifeSituation,
  type SituationId,
} from '../constants/lifeSituations';
import {todaysWidgetRef, useVerse} from '../hooks/useSituationVerse';
import type {DailyVerse} from '../services/reminders/readingReminder';
import {situationById, type ActiveSituation} from '../utils/lifeSituations';
import type {RootStackParamList} from '../navigation/RootNavigator';

// All copy on this screen is placeholder MG — user-owned.

const STEP_COUNT = 3;

const lengthLabel = (situation: LifeSituation): string =>
  situation.days
    ? `${situation.days} andro`
    : `Tsy misy farany · fanontaniana isaky ny ${situation.checkEvery} andro`;

type Colors = ReturnType<typeof useTheme>['theme']['colors'];

// The person's situations in their order, with ▲ ▼ (and ✕ when given).
const RankedList = ({
  situations,
  colors,
  onMove,
  onRemove,
}: {
  situations: ActiveSituation[];
  colors: Colors;
  onMove: (id: SituationId, delta: -1 | 1) => void;
  onRemove?: (id: SituationId) => void;
}) => (
  <View style={[styles.card, {backgroundColor: colors.backgroundSecondary, borderColor: colors.divider}]}>
    {situations.map((active, index) => {
      const situation = situationById(active.id);
      if (!situation) return null;
      const first = index === 0;
      const last = index === situations.length - 1;
      return (
        <View key={active.id}>
          {index > 0 ? <View style={[styles.divider, {backgroundColor: colors.divider}]} /> : null}
          <View style={styles.row}>
            <Text style={[styles.rank, {color: colors.accentBlue}]}>{index + 1}</Text>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>{situation.label}</Text>
              <Text style={[styles.rowHint, {color: colors.textSecondary}]}>{lengthLabel(situation)}</Text>
            </View>
            <Pressable
              hitSlop={8}
              disabled={first}
              onPress={() => onMove(active.id, -1)}
              style={[styles.iconButton, first && styles.disabled]}
              accessibilityLabel="Atsangano"
            >
              <Text style={[styles.iconText, {color: colors.textSecondary}]}>▲</Text>
            </Pressable>
            <Pressable
              hitSlop={8}
              disabled={last}
              onPress={() => onMove(active.id, 1)}
              style={[styles.iconButton, last && styles.disabled]}
              accessibilityLabel="Ampidino"
            >
              <Text style={[styles.iconText, {color: colors.textSecondary}]}>▼</Text>
            </Pressable>
            {onRemove ? (
              <Pressable
                hitSlop={8}
                onPress={() => onRemove(active.id)}
                style={styles.iconButton}
                accessibilityLabel="Esory"
              >
                <Text style={[styles.iconText, {color: colors.textSecondary}]}>✕</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      );
    })}
  </View>
);

// A step's buttons: the next step as a wide button, the quiet way back as
// text under it. Both centred, so either thumb reaches them.
const StepFooter = ({
  colors,
  backLabel,
  onBack,
  nextLabel,
  onNext,
  nextDisabled,
}: {
  colors: Colors;
  backLabel: string;
  onBack: () => void;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
}) => (
  <View style={[styles.footer, {backgroundColor: colors.backgroundPrimary}]}>
    <Pressable
      disabled={nextDisabled}
      style={[styles.nextButton, {backgroundColor: colors.accentBlue}, nextDisabled && styles.disabled]}
      onPress={onNext}
      accessibilityRole="button"
    >
      <Text style={styles.nextText}>{nextLabel}</Text>
    </Pressable>
    <Pressable style={styles.backButton} onPress={onBack} accessibilityRole="button">
      <Text style={[styles.answerText, {color: colors.textSecondary}]}>{backLabel}</Text>
    </Pressable>
  </View>
);

// A verse quoted on the screen: a plan's first one under "Ohatra", today's
// one on the summary.
const QuotedVerse = ({verse, colors}: {verse: DailyVerse; colors: Colors}) => (
  <View style={[styles.quote, {backgroundColor: colors.readerBackground, borderLeftColor: colors.accentBlue}]}>
    <Text style={[styles.quoteText, {color: colors.textPrimary}]}>{verse.body}</Text>
    <Text style={[styles.quoteRef, {color: colors.accentBlue}]}>{verse.ref}</Text>
  </View>
);

// One situation to choose. The row ticks it; "Ohatra" is its own button (so it
// doesn't tick) and opens the plan's first verse under the row, outside it,
// so touching the verse doesn't tick either.
const SituationRow = ({
  situation,
  chosen,
  sample,
  onToggle,
  onSample,
  colors,
}: {
  situation: LifeSituation;
  chosen: boolean;
  // undefined: closed; null: open, the verse still loading.
  sample: DailyVerse | null | undefined;
  onToggle: () => void;
  onSample: () => void;
  colors: Colors;
}) => (
  <View>
    <Pressable
      onPress={onToggle}
      style={styles.row}
      accessibilityRole="checkbox"
      accessibilityState={{checked: chosen}}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>{situation.label}</Text>
        <Text style={[styles.rowHint, {color: colors.textSecondary}]}>{lengthLabel(situation)}</Text>
        <Pressable onPress={onSample} hitSlop={8} style={styles.sampleLink} accessibilityRole="button">
          <Text style={[styles.sampleLinkText, {color: colors.accentBlue}]}>
            {sample === undefined ? 'Ohatra ▸' : 'Ohatra ▾'}
          </Text>
        </Pressable>
      </View>
      <View style={[styles.check, {borderColor: colors.accentBlue}, chosen && {backgroundColor: colors.accentBlue}]}>
        {chosen ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
    </Pressable>
    {sample ? <QuotedVerse verse={sample} colors={colors} /> : null}
  </View>
);

// "Teny ho anao" (menu "Widget"): the person can choose words for the widget
// that fit what they are living through. Gentle by design, after
// trauma-informed guidance: an explanation instead of a question, at most
// three steps, each one leavable, then a summary. The widget and verse
// notifications follow those plans instead of the general calendar (see
// utils/lifeSituations).
const TenyHoAnaoScreen = () => {
  const {theme} = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    state,
    loaded,
    due,
    remove,
    move,
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
  const [step, setStep] = useState<'choose' | 'order'>('choose');
  const [confirmClear, setConfirmClear] = useState(false);
  const [feeling, setFeeling] = useState<FeelingId | null>(null);
  const [sampleId, setSampleId] = useState<SituationId | null>(null);
  const sample = useVerse(sampleId ? situationById(sampleId)?.verses[0] ?? null : null);
  // Only the summary shows it.
  const todayVerse = useVerse(loaded && !draft && state.situations.length > 0 ? todaysWidgetRef(state) : null);

  const colors = theme.colors;
  const cardStyle = [styles.card, {backgroundColor: colors.backgroundSecondary, borderColor: colors.divider}];

  if (!loaded) {
    return <SafeAreaView edges={['bottom']} style={[styles.container, {backgroundColor: colors.backgroundPrimary}]} />;
  }

  const leave = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({index: 0, routes: [{name: 'Home'}]});
  };
  const edit = () => {
    startEditing();
    setStep('choose');
  };
  const view = draft ? step : state.situations.length > 0 ? 'summary' : 'intro';

  const stepCounter = (n: number) => (
    <Text style={[styles.stepCounter, {color: colors.textSecondary}]}>
      {n} / {STEP_COUNT}
    </Text>
  );

  if (view === 'intro') {
    return (
      <SafeAreaView edges={['bottom']} style={[styles.container, {backgroundColor: colors.backgroundPrimary}]}>
        {/* Short text and its buttons together mid-screen, in the thumb's
            natural reach, not split between the top and the bottom edge. */}
        <ScrollView contentContainerStyle={[styles.scroll, styles.introScroll]}>
          {stepCounter(1)}
          <Text style={[styles.introText, {color: colors.textPrimary}]}>
            Eto no misafidy ny teny hiseho ao amin'ny widget. Teny ampaherezana anao
            mifanaraka amin'izay toe-javatra hiainanao.
          </Text>
          <StepFooter colors={colors} backLabel="Tsy izao" onBack={leave} nextLabel="Hanohy" onNext={edit} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (view === 'choose' && draft) {
    const chosen = new Set(draft.situations.map(s => s.id));
    const count = draft.situations.length;
    const matches = (FEELINGS.find(f => f.id === feeling)?.situations ?? [])
      .map(situationById)
      .filter((s): s is LifeSituation => !!s);
    const renderRows = (list: ReadonlyArray<LifeSituation>) =>
      list.map((situation, index) => (
        <View key={situation.id}>
          {index > 0 ? <View style={[styles.divider, {backgroundColor: colors.divider}]} /> : null}
          <SituationRow
            situation={situation}
            chosen={chosen.has(situation.id)}
            sample={sampleId === situation.id ? sample : undefined}
            onToggle={() => toggleDraft(situation.id)}
            onSample={() => setSampleId(id => (id === situation.id ? null : situation.id))}
            colors={colors}
          />
        </View>
      ));
    return (
      <SafeAreaView edges={['bottom']} style={[styles.container, {backgroundColor: colors.backgroundPrimary}]}>
        <ScrollViewWithThumb style={styles.list} contentContainerStyle={styles.scroll}>
          {stepCounter(2)}
          <Text style={[styles.title, {color: colors.textPrimary}]}>
            Safidio ny karazana teny fampaherezana tianao hiseho eo amin'ny widget
          </Text>
          <Text style={[styles.welcome, {color: colors.textPrimary}]}>
            Ara-dalàna ny mahatsiaro ho mavesatra. Tsy voatery hanazava zavatra ianao.
          </Text>
          <Text style={[styles.body, {color: colors.textSecondary}]}>Azonao atao ny misafidy maromaro.</Text>

          {/* Optional: a feeling brings what may fit to the top, ticks nothing. */}
          <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>Manao ahoana ny fonao ankehitriny?</Text>
          <View style={styles.feelings}>
            {FEELINGS.map(f => {
              const on = feeling === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setFeeling(on ? null : f.id)}
                  style={[styles.feeling, {borderColor: colors.accentBlue}, on && {backgroundColor: colors.accentBlue}]}
                  accessibilityRole="button"
                  accessibilityState={{selected: on}}
                >
                  <Text style={[styles.feelingText, on ? styles.feelingTextOn : {color: colors.textPrimary}]}>
                    {f.emoji} {f.label}
                  </Text>
                </Pressable>
              );
            })}
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
              <Text style={[styles.answerText, {color: colors.accentBlue}]}>Tsy fantatro</Text>
              <Text style={[styles.rowHint, {color: colors.textSecondary}]}>
                Ny teny isan'andro mahazatra no hiseho eo amin'ny widget.
              </Text>
            </Pressable>
          ) : null}

          {matches.length > 0 ? (
            <View>
              <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>Mety aminao</Text>
              <View style={[...cardStyle, {borderColor: colors.accentBlue}]}>{renderRows(matches)}</View>
            </View>
          ) : null}

          {SITUATION_THEMES.map(section => (
            <View key={section.theme}>
              <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>{section.title}</Text>
              <View style={cardStyle}>
                {renderRows(LIFE_SITUATIONS.filter(s => SITUATION_THEME[s.id] === section.theme))}
              </View>
            </View>
          ))}
        </ScrollViewWithThumb>
        <StepFooter
          colors={colors}
          backLabel="Hiverina"
          onBack={cancelEditing}
          // With one situation there is nothing to order: finish here.
          nextLabel={count > 1 ? 'Manaraka' : 'Vita'}
          onNext={() => (count > 1 ? setStep('order') : commitDraft())}
          nextDisabled={count === 0}
        />
      </SafeAreaView>
    );
  }

  if (view === 'order' && draft) {
    return (
      <SafeAreaView edges={['bottom']} style={[styles.container, {backgroundColor: colors.backgroundPrimary}]}>
        <ScrollViewWithThumb style={styles.list} contentContainerStyle={styles.scroll}>
          {stepCounter(3)}
          <Text style={[styles.title, {color: colors.textPrimary}]}>Alaharo araka izay tianao</Text>
          <Text style={[styles.body, {color: colors.textSecondary}]}>
            Andininy iray isan'andro, mifandimby araka io filaharana io.
          </Text>
          <RankedList situations={draft.situations} colors={colors} onMove={moveDraft} />
        </ScrollViewWithThumb>
        <StepFooter
          colors={colors}
          backLabel="Hiverina"
          onBack={() => setStep('choose')}
          nextLabel="Vita"
          onNext={commitDraft}
        />
      </SafeAreaView>
    );
  }

  const needsSafetyNote = state.situations.some(s => situationById(s.id)?.safetyNote);

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, {backgroundColor: colors.backgroundPrimary}]}>
      <ScrollViewWithThumb style={styles.list} contentContainerStyle={styles.scroll}>
        {todayVerse ? (
          <View>
            <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>Ny teny anio</Text>
            <QuotedVerse verse={todayVerse} colors={colors} />
          </View>
        ) : null}
        <Text style={[styles.body, {color: colors.textSecondary}]}>
          Ireto no hiseho ao amin'ny widget: andininy iray isan'andro, mifandimby araka
          ity filaharana ity.
        </Text>

        {due.map(active => {
          const situation = situationById(active.id);
          if (!situation) return null;
          return (
            <View key={`due-${active.id}`} style={[styles.card, {backgroundColor: colors.backgroundSecondary, borderColor: colors.accentBlue}]}>
              <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>
                Mbola ao amin'ny « {situation.label} » ve ianao?
              </Text>
              <View style={styles.answerRow}>
                <Pressable
                  style={[styles.answerButton, {backgroundColor: colors.accentBlue}]}
                  onPress={() => stillIn(active.id)}
                >
                  <Text style={styles.answerPrimaryText}>Mbola eo</Text>
                </Pressable>
                <Pressable
                  style={[styles.answerButton, {borderColor: colors.accentBlue}, styles.answerOutline]}
                  onPress={() => remove(active.id)}
                >
                  <Text style={[styles.answerText, {color: colors.accentBlue}]}>Efa nihatsara</Text>
                </Pressable>
                <Pressable
                  style={[styles.answerButton, {borderColor: colors.accentBlue}, styles.answerOutline]}
                  // This one ends, and the list opens to choose another.
                  onPress={() => {
                    remove(active.id);
                    edit();
                  }}
                >
                  <Text style={[styles.answerText, {color: colors.accentBlue}]}>Toe-javatra hafa</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>Ny teninao</Text>
        <RankedList situations={state.situations} colors={colors} onMove={move} onRemove={remove} />
        <Pressable style={[styles.answerButton, styles.answerOutline, styles.editButton, {borderColor: colors.accentBlue}]} onPress={edit}>
          <Text style={[styles.answerText, {color: colors.accentBlue}]}>Ovay</Text>
        </Pressable>

        {needsSafetyNote ? (
          // NOTE: confirm 117 (national emergency number) before release.
          <Text style={[styles.safety, {color: colors.textPrimary, borderColor: colors.divider}]}>
            Raha mavesatra loatra izany, mitenena amin'ny pasitera na olona itokisanao.
            Raha misy loza: 117.
          </Text>
        ) : null}

        <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>Aiza no hisehoany?</Text>
        <View style={cardStyle}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>Ao amin'ny widget</Text>
            </View>
            <Switch
              value={state.onWidget}
              onValueChange={setOnWidget}
              trackColor={{false: '#767577', true: colors.accentBlue}}
              thumbColor={state.onWidget ? '#FFFFFF' : '#F4F3F4'}
            />
          </View>
          <View style={[styles.divider, {backgroundColor: colors.divider}]} />
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>Ao amin'ny fampahatsiahivana</Text>
              <Text style={[styles.rowHint, {color: colors.textSecondary}]}>
                Ho an'ny fampahatsiahivana « Sakafom-panahy » ao amin'ny Ora famakiana tiana.
              </Text>
            </View>
            <Switch
              value={state.inReminders}
              onValueChange={setInReminders}
              trackColor={{false: '#767577', true: colors.accentBlue}}
              thumbColor={state.inReminders ? '#FFFFFF' : '#F4F3F4'}
            />
          </View>
        </View>

        {/* A quiet way to the widget's look, not a step: nothing is asked. */}
        <Pressable style={[...cardStyle, styles.row]} onPress={() => navigation.navigate('WidgetLook')}>
          <Text style={[styles.rowTitle, styles.rowText, {color: colors.textPrimary}]}>Lokon'ny widget</Text>
          <Text style={[styles.iconText, {color: colors.textSecondary}]}>›</Text>
        </Pressable>

        {confirmClear ? (
          <View style={cardStyle}>
            <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>
              Hofafana daholo ve ny toe-javatra rehetra voafidy?
            </Text>
            <View style={styles.answerRow}>
              <Pressable style={styles.textButton} onPress={() => setConfirmClear(false)}>
                <Text style={[styles.answerText, {color: colors.textPrimary}]}>Aoka izay</Text>
              </Pressable>
              <Pressable
                style={[styles.answerButton, {backgroundColor: colors.accentBlue}]}
                onPress={() => {
                  setConfirmClear(false);
                  clearAll();
                }}
              >
                <Text style={styles.answerPrimaryText}>Fafao</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.clearButton} onPress={() => setConfirmClear(true)}>
            <Text style={[styles.answerText, {color: colors.textSecondary}]}>Fafao ny zava-drehetra</Text>
          </Pressable>
        )}
      </ScrollViewWithThumb>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  // Fills the space above the step footer; its thumb says when more is below.
  list: {flex: 1},
  scroll: {padding: 16, paddingBottom: 32},
  stepCounter: {fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8},
  title: {fontSize: 20, fontWeight: '700', marginBottom: 10},
  body: {fontSize: 15, lineHeight: 22, marginBottom: 14},
  sectionTitle: {fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5},
  card: {borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 14},
  divider: {height: StyleSheet.hairlineWidth, marginVertical: 10},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  rowText: {flex: 1},
  rank: {fontSize: 16, fontWeight: '700', width: 20, fontVariant: ['tabular-nums']},
  rowTitle: {fontSize: 15, fontWeight: '700'},
  rowHint: {marginTop: 2, fontSize: 12, lineHeight: 17},
  iconButton: {paddingHorizontal: 6, paddingVertical: 4},
  iconText: {fontSize: 16, fontWeight: '700'},
  disabled: {opacity: 0.3},
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {color: '#FFFFFF', fontSize: 13, fontWeight: '700'},
  introScroll: {flexGrow: 1, justifyContent: 'center', paddingBottom: 64},
  introText: {fontSize: 18, lineHeight: 27, marginBottom: 28},
  footer: {paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, gap: 4},
  nextButton: {borderRadius: 999, minHeight: 50, alignItems: 'center', justifyContent: 'center'},
  nextText: {color: '#FFFFFF', fontSize: 16, fontWeight: '700'},
  backButton: {alignItems: 'center', paddingVertical: 12},
  answerRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'flex-end'},
  answerButton: {paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10},
  answerOutline: {borderWidth: 1},
  answerPrimaryText: {fontSize: 14, fontWeight: '700', color: '#FFFFFF'},
  answerText: {fontSize: 14, fontWeight: '700'},
  editButton: {alignSelf: 'flex-start', marginTop: -4, marginBottom: 14},
  textButton: {paddingVertical: 9, paddingHorizontal: 10},
  safety: {fontSize: 13, lineHeight: 19, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 14},
  clearButton: {alignItems: 'center', paddingVertical: 12},
  welcome: {fontSize: 16, lineHeight: 23, marginBottom: 8},
  feelings: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14},
  feeling: {borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center'},
  feelingText: {fontSize: 15, fontWeight: '600'},
  feelingTextOn: {color: '#FFFFFF'},
  unsure: {paddingVertical: 10, marginBottom: 14},
  sampleLink: {alignSelf: 'flex-start', paddingVertical: 6, marginTop: 2},
  sampleLinkText: {fontSize: 14, fontWeight: '700'},
  quote: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 14,
  },
  quoteText: {fontSize: 15, lineHeight: 22},
  quoteRef: {marginTop: 6, fontSize: 13, fontWeight: '700'},
});

export default TenyHoAnaoScreen;
