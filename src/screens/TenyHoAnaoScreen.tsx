import React, {useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '../contexts/ThemeContext';
import {useTenyHoAnao} from '../hooks/useTenyHoAnao';
import {
  LIFE_SITUATIONS,
  type LifeSituation,
  type SituationId,
  type SituationKind,
} from '../constants/lifeSituations';
import {situationById} from '../utils/lifeSituations';

// All copy on this screen is placeholder MG — user-owned.

const KIND_SECTIONS: Array<{kind: SituationKind; title: string}> = [
  {kind: 'short', title: 'Fotoana fohy'},
  {kind: 'season', title: 'Vanim-potoana'},
  {kind: 'long', title: 'Ady maharitra'},
];

const lengthLabel = (situation: LifeSituation): string =>
  situation.days
    ? `${situation.days} andro`
    : `Tsy misy farany · fanontaniana isaky ny ${situation.checkEvery} andro`;

// "Teny ho anao": the person says which situations they are living through,
// ranks them, and the widget and verse notifications follow those plans
// instead of the general calendar (see utils/lifeSituations).
const TenyHoAnaoScreen = () => {
  const {theme} = useTheme();
  const {state, loaded, due, add, remove, move, stillIn, setOnWidget, setInReminders, clearAll} =
    useTenyHoAnao();
  const [confirmClear, setConfirmClear] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const pickerY = useRef(0);

  const colors = theme.colors;
  const chosen = new Set(state.situations.map(s => s.id));
  const needsSafetyNote = state.situations.some(s => situationById(s.id)?.safetyNote);

  // "Toe-javatra hafa": this one ends, and the list to pick another opens.
  const switchSituation = (id: SituationId) => {
    remove(id);
    scrollRef.current?.scrollTo({y: pickerY.current, animated: true});
  };

  if (!loaded) {
    return <SafeAreaView edges={['bottom']} style={[styles.container, {backgroundColor: colors.backgroundPrimary}]} />;
  }

  const cardStyle = [styles.card, {backgroundColor: colors.backgroundSecondary, borderColor: colors.divider}];

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, {backgroundColor: colors.backgroundPrimary}]}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        <Text style={[styles.question, {color: colors.textPrimary}]}>
          Inona no iainanao amin'izao fotoana izao?
        </Text>
        <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
          Safidio izay mety aminao, dia ho tonga isan'andro ao amin'ny widget sy ny
          fampahatsiahivana ny andininy mifanaraka amin'izany. Ato amin'ny findainao
          ihany no voatahiry izany, ary tsy hiseho na aiza na aiza ny anaran'ny
          toe-javatra.
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
                  onPress={() => switchSituation(active.id)}
                >
                  <Text style={[styles.answerText, {color: colors.accentBlue}]}>Toe-javatra hafa</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {state.situations.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>Ny ahy</Text>
            <Text style={[styles.rowHint, styles.sectionHint, {color: colors.textSecondary}]}>
              Alaharo araka ny maha-mavesatra azy aminao. Andininy iray isan'andro,
              mifandimby araka io filaharana io.
            </Text>
            <View style={cardStyle}>
              {state.situations.map((active, index) => {
                const situation = situationById(active.id);
                if (!situation) return null;
                return (
                  <View key={active.id}>
                    {index > 0 ? <View style={[styles.divider, {backgroundColor: colors.divider}]} /> : null}
                    <View style={styles.row}>
                      <Text style={[styles.rank, {color: colors.accentBlue}]}>{index + 1}</Text>
                      <View style={styles.rowText}>
                        <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>{situation.label}</Text>
                        <Text style={[styles.rowHint, {color: colors.textSecondary}]}>
                          {lengthLabel(situation)}
                        </Text>
                      </View>
                      <Pressable
                        hitSlop={8}
                        disabled={index === 0}
                        onPress={() => move(active.id, -1)}
                        style={[styles.iconButton, index === 0 && styles.disabled]}
                        accessibilityLabel="Atsangano"
                      >
                        <Text style={[styles.iconText, {color: colors.textSecondary}]}>▲</Text>
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        disabled={index === state.situations.length - 1}
                        onPress={() => move(active.id, 1)}
                        style={[styles.iconButton, index === state.situations.length - 1 && styles.disabled]}
                        accessibilityLabel="Ampidino"
                      >
                        <Text style={[styles.iconText, {color: colors.textSecondary}]}>▼</Text>
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() => remove(active.id)}
                        style={styles.iconButton}
                        accessibilityLabel="Esory"
                      >
                        <Text style={[styles.iconText, {color: colors.textSecondary}]}>✕</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {needsSafetyNote ? (
          // NOTE: confirm 117 (national emergency number) before release.
          <Text style={[styles.safety, {color: colors.textPrimary, borderColor: colors.divider}]}>
            Raha mavesatra loatra izany, mitenena amin'ny pasitera na olona itokisanao.
            Raha misy loza: 117.
          </Text>
        ) : null}

        <View onLayout={event => (pickerY.current = event.nativeEvent.layout.y)}>
          {KIND_SECTIONS.map(section => (
            <View key={section.kind}>
              <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>{section.title}</Text>
              <View style={cardStyle}>
                {LIFE_SITUATIONS.filter(s => s.kind === section.kind).map((situation, index) => {
                  const isChosen = chosen.has(situation.id);
                  return (
                    <View key={situation.id}>
                      {index > 0 ? <View style={[styles.divider, {backgroundColor: colors.divider}]} /> : null}
                      <Pressable
                        disabled={isChosen}
                        onPress={() => add(situation.id)}
                        style={styles.row}
                        accessibilityState={{selected: isChosen}}
                      >
                        <View style={styles.rowText}>
                          <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>{situation.label}</Text>
                          <Text style={[styles.rowHint, {color: colors.textSecondary}]}>
                            {lengthLabel(situation)}
                          </Text>
                        </View>
                        <Text style={[styles.iconText, {color: colors.accentBlue}]}>{isChosen ? '✓' : '+'}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

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
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  scroll: {padding: 16, paddingBottom: 32},
  question: {fontSize: 18, fontWeight: '700', marginBottom: 8},
  subtitle: {fontSize: 14, marginBottom: 16, lineHeight: 20},
  sectionTitle: {fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5},
  sectionHint: {marginBottom: 8},
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
  answerRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'flex-end'},
  answerButton: {paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10},
  answerOutline: {borderWidth: 1},
  answerPrimaryText: {fontSize: 14, fontWeight: '700', color: '#FFFFFF'},
  answerText: {fontSize: 14, fontWeight: '700'},
  textButton: {paddingVertical: 9, paddingHorizontal: 10},
  safety: {fontSize: 13, lineHeight: 19, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 14},
  clearButton: {alignItems: 'center', paddingVertical: 12},
});

export default TenyHoAnaoScreen;
