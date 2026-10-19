import React, {useEffect, useState} from 'react';
import {BackHandler, Image, Platform, Pressable, StyleSheet, Switch, Text, View, useColorScheme} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useEarthTheme} from '../hooks/useEarthTheme';
import {LookGrid} from '../components/LookPicker';
import {ScrollViewWithThumb} from '../components/ScrollViewWithThumb';
import {SegmentedToggle} from '../components/SegmentedToggle';
import {SheetButton} from '../components/SheetModal';
import {bibleDatabaseService} from '../services/database/DatabaseService';
import {verseForDate} from '../services/reminders/readingReminder';
import {dailyVerseFor} from '../constants/dailyVerses';
import {
  CALENDAR_LABEL,
  DEFAULT_WIDGET_TEXT,
  TRANSLATION,
  WIDGET_TEXT_SCALES,
  dateLabel,
  getWidgetFollowDark,
  getWidgetLook,
  getWidgetText,
  getWidgetToday,
  setWidgetFollowDark,
  setWidgetLook,
  setWidgetText,
  verseKey,
  type WidgetDay,
  type WidgetFont,
  type WidgetText,
} from '../services/widget/dailyVerseWidget';
import {
  lookForImage,
  nightLook,
  pickBackgroundImage,
  widgetInk,
  type ShareCardLook,
  type Veil,
  type WidgetInk,
} from '../utils/shareCard';
import {hexToRgba} from '../utils/colorUtils';
import type {RootStackParamList} from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type WidgetLookRouteProp = RouteProp<RootStackParamList, 'WidgetLook'>;

const SERIF = Platform.select({ios: 'Georgia', default: 'serif'});

// Placeholder MG copy — user-owned.
const INKS: ReadonlyArray<{id: WidgetInk; label: string; swatch?: string}> = [
  {id: 'auto', label: 'Ho azy'},
  {id: 'white', label: 'Fotsy', swatch: '#FFFFFF'},
  {id: 'dark', label: 'Mainty', swatch: '#1B1B1B'},
];
const FONTS: ReadonlyArray<{id: WidgetFont; label: string}> = [
  {id: 'serif', label: 'Klasika'},
  {id: 'sans', label: 'Maoderina'},
  {id: 'italic', label: 'Mitongilana'},
];
const SIZE_LABELS = ['A−', 'A', 'A+', 'A++'];

// The background first: it is what people come here to change.
type Tab = 'fond' | 'soratra';
const TABS: ReadonlyArray<{key: Tab; label: string}> = [
  {key: 'fond', label: 'Fond'},
  {key: 'soratra', label: 'Soratra'},
];

// The widget's own settings glyph, the Material "tune" sliders of
// android/.../drawable/ic_widget_tune.xml, as its nine rectangles on the same
// 24-unit grid, so the preview shows what the widget shows.
const TUNE_SIZE = 14;
const TUNE_BARS = [
  [3, 5, 10, 2], [15, 3, 2, 6], [17, 5, 4, 2],
  [3, 11, 4, 2], [7, 9, 2, 6], [11, 11, 10, 2],
  [3, 17, 6, 2], [11, 15, 2, 6], [13, 17, 8, 2],
].map(([x, y, w, h]) => {
  const unit = TUNE_SIZE / 24;
  return {position: 'absolute' as const, left: x * unit, top: y * unit, width: w * unit, height: h * unit};
});

const TuneIcon = ({color}: {color: string}) => (
  <View style={styles.tune}>
    {TUNE_BARS.map((bar, i) => (
      <View key={i} style={[bar, {backgroundColor: color}]} />
    ))}
  </View>
);

const fontStyleFor = (font: WidgetFont) =>
  font === 'sans' ? styles.sans : font === 'italic' ? styles.italic : styles.serif;

// The home-screen widget's look: a live preview and the Fond / Soratra tabs
// pinned on top, the chosen tab's settings under them, and a "done" button. Reached from the
// widget's own sliders shortcut (fromWidget) or from Safidio ny loko. Every pick is
// saved and pushed to the real widget immediately, so the preview and the
// widget change together.
const WidgetLookScreen = () => {
  const earth = useEarthTheme();
  const navigation = useNavigation<NavigationProp>();
  const [tab, setTab] = useState<Tab>('fond');
  const route = useRoute<WidgetLookRouteProp>();
  const fromWidget = route.params?.fromWidget === true;

  const [look, setLookState] = useState<ShareCardLook | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  // What the widget shows today: its own feed entry, so a Teny ho anao plan
  // day or a check-in previews as it is on the home screen.
  const [today, setToday] = useState<Pick<WidgetDay, 'ref' | 'text' | 'label' | 'key' | 'fav'> | null>(null);
  const [followDark, setFollowDark] = useState(false);
  const [text, setTextState] = useState<WidgetText>(DEFAULT_WIDGET_TEXT);
  const scheme = useColorScheme();

  useEffect(() => {
    let cancelled = false;
    getWidgetLook().then(stored => {
      if (cancelled) return;
      setLookState(stored);
      setPhotoUri(stored.imageUri ?? null);
    });
    getWidgetFollowDark().then(on => {
      if (!cancelled) setFollowDark(on);
    });
    getWidgetText().then(stored => {
      if (!cancelled) setTextState(stored);
    });
    // Before the first sync there is no feed yet: the calendar verse.
    getWidgetToday()
      .then(
        async day =>
          day ??
          bibleDatabaseService
            .initDatabase()
            .then(() => verseForDate(new Date()))
            .then(verse => {
              const key = verseKey(dailyVerseFor(new Date()));
              return verse && {ref: verse.ref, text: verse.body, label: CALENDAR_LABEL, key, fav: false};
            }),
      )
      .then(day => {
        if (!cancelled) setToday(day);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // The same header as Teny ho anao, which opens this screen.
  useEffect(() => {
    navigation.setOptions({
      headerStyle: {backgroundColor: earth.ground},
      headerTintColor: earth.ink,
      headerTitleStyle: {color: earth.ink, fontSize: 18, fontWeight: '700'},
      headerShadowVisible: false,
      statusBarStyle: earth.isDark ? 'light' : 'dark',
    });
  }, [navigation, earth]);

  const toggleFollowDark = (on: boolean) => {
    setFollowDark(on);
    setWidgetFollowDark(on);
  };

  const changeText = (next: Partial<WidgetText>) => {
    const merged = {...text, ...next};
    setTextState(merged);
    setWidgetText(merged);
  };

  // What the home screen shows right now: the night version while the phone
  // is in dark mode, if the widget follows it, else the look in the chosen ink.
  const shown: (ShareCardLook & {veil?: Veil}) | null =
    look && followDark && scheme === 'dark' && !look.imageUri ? nightLook(look) : look && widgetInk(look, text.ink);
  const veil = shown?.veil;

  const apply = (next: ShareCardLook) => {
    setLookState(next);
    setWidgetLook(next);
  };

  const pickPhoto = async () => {
    if (picking) return;
    if (photoUri && !look?.imageUri) {
      apply(lookForImage(photoUri));
      return;
    }
    setPicking(true);
    const uri = await pickBackgroundImage();
    setPicking(false);
    if (!uri) return;
    setPhotoUri(uri);
    apply(lookForImage(uri));
  };

  // From the widget, "done" means back to the home screen where the widget
  // is. Android can close the app for that; iOS never lets an app dismiss
  // itself, so the best it can do is return to Home (the widget is already
  // updated behind it).
  const done = () => {
    if (fromWidget && Platform.OS === 'android') {
      BackHandler.exitApp();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({index: 0, routes: [{name: 'Home'}]});
    }
  };

  // Same cards as Teny ho anao: the accent's outline and wash when chosen.
  const ring = (on: boolean) => ({
    borderColor: on ? earth.accentText : earth.line,
    backgroundColor: on ? earth.accentTint : earth.card,
  });

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, {backgroundColor: earth.ground}]}>
      {/* The preview and the tabs stay in view while the settings scroll, so
          every pick shows on it at once. */}
      <View style={styles.top}>
        {shown ? (
          <View style={[styles.preview, {backgroundColor: shown.background}]}>
            {shown.imageUri ? (
              <>
                <Image source={{uri: shown.imageUri}} style={styles.previewImage} />
                {veil ? (
                  <View style={[styles.previewVeil, {backgroundColor: hexToRgba(veil.color, veil.alpha)}]} />
                ) : null}
              </>
            ) : null}
            <View style={styles.previewContent}>
              <View style={styles.previewTop}>
                <Text style={[styles.badge, {color: shown.text, backgroundColor: hexToRgba(shown.text, 0.15)}]}>
                  {dateLabel(new Date()).toUpperCase()}
                </Text>
                {today?.key ? <Text style={[styles.heart, {color: shown.text}]}>{today.fav ? '♥' : '♡'}</Text> : null}
              </View>
              <Text
                style={[
                  styles.previewVerse,
                  fontStyleFor(text.font),
                  {color: shown.text, fontSize: 15 * text.scale, lineHeight: 21 * text.scale},
                ]}
                // The medium widget's own cap: the whole verse, as on the home screen.
                numberOfLines={7}
              >
                {today ? (today.key ? `“${today.text}”` : today.text) : ''}
              </Text>
              <View style={[styles.previewRule, {backgroundColor: hexToRgba(shown.text, 0.2)}]} />
              <View style={styles.previewBottom}>
                <Text style={[styles.previewRef, {color: shown.accent}]}>{today?.ref ?? ''}</Text>
                <Text style={[styles.tag, {color: shown.text, backgroundColor: hexToRgba(shown.text, 0.1)}]}>
                  {TRANSLATION}
                </Text>
                <Text style={[styles.mode, {color: hexToRgba(shown.text, 0.7)}]} numberOfLines={1}>
                  {today?.label.toUpperCase()}
                </Text>
                <TuneIcon color={hexToRgba(shown.text, 0.7)} />
              </View>
            </View>
          </View>
        ) : null}
        <View style={styles.tabs}>
          <SegmentedToggle options={TABS} selected={tab} onChange={setTab} />
        </View>
      </View>

      {/* Keyed by tab, so each one opens at its top. */}
      <ScrollViewWithThumb key={tab} style={styles.list} contentContainerStyle={styles.scroll}>
        {tab === 'fond' ? (
          <View style={styles.stack}>
            {look ? (
              <LookGrid
                look={look}
                photoUri={photoUri}
                onSelect={apply}
                onPickPhoto={pickPhoto}
                photoLabel="Misafidiana sary atao fond ny widget"
              />
            ) : null}
            <View style={[styles.darkRow, {backgroundColor: earth.card, borderColor: earth.line}]}>
              <View style={styles.darkText}>
                <Text style={[styles.darkTitle, {color: earth.ink}]}>Mode sombre</Text>
                <Text style={[styles.darkHint, {color: earth.muted}]}>
                  Maizina koa ny widget rehefa mode sombre ny finday.
                </Text>
              </View>
              <Switch
                value={followDark}
                onValueChange={toggleFollowDark}
                trackColor={{false: earth.edge, true: earth.accentText}}
                thumbColor={earth.card}
              />
            </View>
          </View>
        ) : (
          <>
            {/* Placeholder MG copy — user-owned. */}
            <Text style={[styles.sectionTitle, {color: earth.ink}]}>Karazana soratra</Text>
            <View style={styles.row}>
              {FONTS.map(option => (
                <Pressable
                  key={option.id}
                  onPress={() => changeText({font: option.id})}
                  style={[styles.tile, ring(text.font === option.id)]}
                  accessibilityRole="button"
                  accessibilityState={{selected: text.font === option.id}}
                >
                  <Text style={[styles.tileSample, fontStyleFor(option.id), {color: earth.ink}]}>Abc</Text>
                  <Text style={[styles.tileLabel, {color: earth.muted}]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sectionTitle, {color: earth.ink}]}>Haben'ny soratra</Text>
            <View style={styles.row}>
              {WIDGET_TEXT_SCALES.map((scale, i) => (
                <Pressable
                  key={scale}
                  onPress={() => changeText({scale})}
                  style={[styles.choice, ring(text.scale === scale)]}
                  accessibilityRole="button"
                  accessibilityLabel={`${Math.round(scale * 100)}%`}
                  accessibilityState={{selected: text.scale === scale}}
                >
                  <Text style={[styles.choiceText, SIZE_STYLES[i], {color: earth.ink}]}>{SIZE_LABELS[i]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sectionTitle, {color: earth.ink}]}>Lokon'ny soratra</Text>
            <View style={styles.row}>
              {INKS.map(option => (
                <Pressable
                  key={option.id}
                  onPress={() => changeText({ink: option.id})}
                  style={[styles.choice, ring(text.ink === option.id)]}
                  accessibilityRole="button"
                  accessibilityState={{selected: text.ink === option.id}}
                >
                  {option.swatch ? (
                    <View style={[styles.swatch, {backgroundColor: option.swatch, borderColor: earth.edge}]} />
                  ) : null}
                  <Text style={[styles.choiceText, {color: earth.ink}]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollViewWithThumb>

      <View style={[styles.footer, {borderTopColor: earth.line}]}>
        <SheetButton label="Vita" onPress={done} variant="filled" />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  // Same 560pt column as Teny ho anao on tablets and sideways phones.
  top: {width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8},
  list: {flex: 1},
  scroll: {width: '100%', maxWidth: 560, alignSelf: 'center', padding: 16, paddingBottom: 24},
  footer: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabs: {marginTop: 12},
  stack: {gap: 20},
  sectionTitle: {fontSize: 15, fontWeight: '700', marginBottom: 8},
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20},
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  choiceText: {fontSize: 15, fontWeight: '600'},
  size0: {fontSize: 13},
  size1: {fontSize: 15},
  size2: {fontSize: 17},
  size3: {fontSize: 19},
  swatch: {width: 16, height: 16, borderRadius: 8, borderWidth: 1},
  tile: {flexGrow: 1, flexBasis: '28%', alignItems: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 1.5},
  tileSample: {fontSize: 20},
  tileLabel: {fontSize: 12, marginTop: 2},
  serif: {fontFamily: SERIF},
  sans: {},
  italic: {fontFamily: SERIF, fontStyle: 'italic'},
  darkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  darkText: {flex: 1},
  darkTitle: {fontSize: 15, fontWeight: '700'},
  darkHint: {fontSize: 14, lineHeight: 20, marginTop: 2},
  preview: {borderRadius: 24, overflow: 'hidden', minHeight: 160},
  previewImage: {...StyleSheet.absoluteFillObject, width: undefined, height: undefined, resizeMode: 'cover'},
  previewVeil: {...StyleSheet.absoluteFillObject},
  // flexGrow, not flex: 1, whose zero basis kept the card at its 160pt
  // minimum and clipped the verse's end and the reference.
  previewContent: {flexGrow: 1, padding: 14},
  previewTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  badge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  heart: {fontSize: 16},
  previewVerse: {marginVertical: 10},
  previewRule: {height: StyleSheet.hairlineWidth},
  previewBottom: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6},
  previewRef: {fontSize: 12, fontWeight: '700'},
  tag: {fontSize: 9, fontWeight: '600', letterSpacing: 0.5, paddingHorizontal: 3, borderRadius: 4, overflow: 'hidden'},
  mode: {flex: 1, fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textAlign: 'right'},
  tune: {width: TUNE_SIZE, height: TUNE_SIZE},
});

// "A−" to "A++", each drawn a step larger.
const SIZE_STYLES = [styles.size0, styles.size1, styles.size2, styles.size3];

export default WidgetLookScreen;
