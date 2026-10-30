import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Animated, Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../contexts/ThemeContext';
import {useEarthTheme} from '../hooks/useEarthTheme';
import {WIDGET_GUIDE, WIDGET_PICTURE, type WidgetGuideStep} from '../tutorials/widgetGuide';
import {SegmentedToggle} from '../components/SegmentedToggle';
import {Pill, StepFooter} from '../components/EarthSteps';
import {pinWidget} from '../services/widget/dailyVerseWidget';
import {useWidgetPlacement} from '../hooks/useWidgetPlacement';
import type {RootStackParamList} from '../navigation/RootNavigator';

const RING = '#FF3B30';
// What the widget is and does, true of every size on both platforms, before
// the steps: many people don't know the word. (The colour shortcut is left
// out: the small and lock-screen sizes don't have it.) TEMP: Malagasy wording
// to be written by the owner.
const WHAT_IT_DOES = [
  "Efajoro kely eo amin'ny écran d'accueil-n'ny findainao, eo akaikin'ny kisarin'ireo app.",
  "Miova isan'andro ny andinin-teny, na tsy sokafanao aza ny e-Baiboly, ary tsy mila internet.",
  "Raha tsindrinao ny widget dia manokatra ny app e-Baiboly.",
];
// iPhone: home screen / lock screen. Android has one section, no tabs.
const SECTION_OPTIONS = WIDGET_GUIDE.sections.map((s, index) => ({key: String(index), label: s.title}));

// A finger on the place to tap, over the whole screenshot, so the picture says
// where before the words do: it taps, or for a long press stays down while
// the circle grows. Points up from below, or down from above near the bottom
// so it stays in the picture. Still on low-end phones.
const TapFinger = ({tap, still}: {tap: NonNullable<WidgetGuideStep['tap']>; still: boolean}) => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const duration = tap.hold ? 1200 : 600;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 1, duration, useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 0, duration: 400, useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, still, tap.hold]);
  const fromAbove = tap.y > 0.7;
  const scale = pulse.interpolate({inputRange: [0, 1], outputRange: tap.hold ? [0.6, 1.5] : [1, 1.3]});
  const press = pulse.interpolate({inputRange: [0, 1], outputRange: [0, fromAbove ? 6 : -6]});
  return (
    <View pointerEvents="none" style={[styles.tapPoint, {left: `${tap.x * 100}%`, top: `${tap.y * 100}%`}]}>
      <Animated.View style={[styles.tapCircle, {transform: [{scale}]}]} />
      <Animated.Text
        style={[styles.finger, fromAbove ? styles.fingerAbove : styles.fingerBelow, {transform: [{translateY: press}]}]}>
        {fromAbove ? '👇' : '👆'}
      </Animated.Text>
      {tap.hold ? (
        <Text style={[styles.holdChip, fromAbove ? styles.chipAbove : styles.chipBelow]}>Tsindrio ela</Text>
      ) : null}
    </View>
  );
};

// Adding the widget happens on the phone's home screen, outside the app, so
// nothing can be spotlit. One page at a time, in Teny ho anao's sand-and-paper
// look and with its step buttons: first what a widget is (with the one-tap add
// where the launcher can do it), then each step with its screenshot.
// WIDGET_GUIDE is this platform's own.
const WidgetGuideScreen = () => {
  const earth = useEarthTheme();
  const {isLowEndMode} = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Offered even when the widget looks placed: Android can count one a
  // launcher left behind, and a second one on another page is fine.
  const {canPin} = useWidgetPlacement();
  const [sectionIndex, setSectionIndex] = useState(0);
  // Page 0 is "what is a widget"; page n is step n of the section.
  const [page, setPage] = useState(0);
  const [area, setArea] = useState<{width: number; height: number} | null>(null);

  // The same header as Teny ho anao, which opens this screen.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: {backgroundColor: earth.ground},
      headerTintColor: earth.ink,
      headerTitleStyle: {color: earth.ink, fontSize: 18, fontWeight: '700'},
      headerShadowVisible: false,
      statusBarStyle: earth.isDark ? 'light' : 'dark',
    });
  }, [navigation, earth]);

  const section = WIDGET_GUIDE.sections[sectionIndex];
  const step = page > 0 ? section.steps[page - 1] : null;
  const pageCount = section.steps.length + 1;
  const isLast = page === pageCount - 1;
  const picture = step ? step.image : WIDGET_PICTURE.image;
  const aspect = step ? step.aspect ?? 1 : WIDGET_PICTURE.aspect;
  // The picture gets the room the words leave, whole, so a page only scrolls
  // on a tiny screen (the area never goes under its minHeight).
  const frameWidth = area ? Math.min(area.width, area.height * aspect) : 0;

  const themed = useMemo(
    () =>
      StyleSheet.create({
        container: {backgroundColor: earth.ground},
        heading: {color: earth.ink, fontFamily: earth.serif},
        intro: {color: earth.muted},
        ink: {color: earth.ink},
        bullet: {color: earth.accentText},
        tip: {color: earth.ink, backgroundColor: earth.chip},
        // Each picture keeps its own shape.
        imageFrame: {
          backgroundColor: earth.card,
          width: frameWidth,
          height: frameWidth / aspect,
        },
      }),
    [earth, frameWidth, aspect],
  );

  const pickSection = (index: number) => {
    setSectionIndex(index);
    setPage(1);
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, themed.container]}>
      <ScrollView contentContainerStyle={styles.page}>
        {step && SECTION_OPTIONS.length > 1 ? (
          // The toggle brings its own screen margins; the page has them already.
          <View style={styles.sections}>
            <SegmentedToggle
              options={SECTION_OPTIONS}
              selected={String(sectionIndex)}
              onChange={key => pickSection(Number(key))}
            />
          </View>
        ) : null}

        {/* What to do first, where second: the words stay on top. */}
        {step ? (
          <>
            <Text style={[styles.stepText, themed.ink]}>{step.text}</Text>
            {step.tip ? <Text style={[styles.tip, themed.tip]}>{step.tip}</Text> : null}
          </>
        ) : (
          <Text style={[styles.heading, themed.heading]}>Inona ilay widget?</Text>
        )}

        {picture ? (
          <View
            style={[styles.pictureArea, step ? null : styles.centered]}
            onLayout={e => setArea(e.nativeEvent.layout)}>
            {frameWidth > 0 ? (
              <View style={[styles.imageFrame, themed.imageFrame]}>
                <Image source={picture} style={styles.image} resizeMode="contain" accessibilityIgnoresInvertColors />
                {step?.tap ? (
                  <TapFinger key={`${sectionIndex}-${page}`} tap={step.tap} still={isLowEndMode} />
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {step ? null : (
          <>
            <Text style={[styles.intro, themed.intro]}>{WIDGET_GUIDE.intro}</Text>
            <View style={styles.points}>
              {WHAT_IT_DOES.map(line => (
                <View key={line} style={styles.point}>
                  <Text style={[styles.bullet, themed.bullet]}>•</Text>
                  <Text style={[styles.pointText, themed.ink]}>{line}</Text>
                </View>
              ))}
            </View>
            {canPin ? (
              <View style={styles.pin}>
                <Pill
                  label="Apetraho eo amin'ny écran ny widget"
                  onPress={() => pinWidget()}
                  earth={earth}
                  kind="outline"
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Fixed under the page: a button that moves from page to page is the
          one older users miss. */}
      <StepFooter
        earth={earth}
        dots={{count: pageCount, current: page}}
        nextLabel={isLast ? 'Vita' : 'Manaraka'}
        onNext={() => (isLast ? navigation.goBack() : setPage(p => p + 1))}
        backLabel="Hiverina"
        onBack={() => (page === 0 ? navigation.goBack() : setPage(p => p - 1))}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  page: {flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16},
  heading: {fontSize: 23, lineHeight: 30, fontWeight: '600', marginBottom: 14},
  pictureArea: {flex: 1, minHeight: 160, alignItems: 'center', marginBottom: 14},
  centered: {justifyContent: 'center'},
  points: {gap: 8},
  point: {flexDirection: 'row', gap: 10},
  bullet: {fontSize: 16, lineHeight: 23, fontWeight: '700'},
  pointText: {flex: 1, fontSize: 16, lineHeight: 23},
  pin: {marginTop: 20},
  intro: {fontSize: 16, lineHeight: 24, marginBottom: 12},
  sections: {marginHorizontal: -24, marginBottom: 8},
  imageFrame: {borderRadius: 16, overflow: 'hidden'},
  image: {width: '100%', height: '100%'},
  // A zero-size anchor on the point; everything is laid out around it.
  tapPoint: {position: 'absolute', width: 0, height: 0},
  tapCircle: {
    position: 'absolute',
    left: -22,
    top: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: RING,
    backgroundColor: 'rgba(255, 59, 48, 0.25)',
  },
  // The fingertip is the top (or bottom) middle of the glyph.
  finger: {position: 'absolute', left: -22, width: 44, fontSize: 38, lineHeight: 46, textAlign: 'center'},
  fingerBelow: {top: 2},
  fingerAbove: {top: -48},
  holdChip: {
    position: 'absolute',
    left: -50,
    width: 100,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: RING,
    borderRadius: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  chipBelow: {top: 52},
  chipAbove: {top: -78},
  stepText: {fontSize: 20, lineHeight: 29, fontWeight: '600', marginBottom: 14},
  tip: {fontSize: 15, lineHeight: 22, padding: 14, borderRadius: 16, marginBottom: 14},
});

export default WidgetGuideScreen;
