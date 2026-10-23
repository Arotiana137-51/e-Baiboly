import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {useTheme} from '../contexts/ThemeContext';
import {canPinWidget, pinWidget} from '../services/widget/dailyVerseWidget';
import {WIDGET_GUIDE, type WidgetGuideStep} from '../tutorials/widgetGuide';
import {SegmentedToggle} from '../components/SegmentedToggle';

const RING = '#FF3B30';
// iPhone: home screen / lock screen. Android has one section, no tabs.
const SECTION_OPTIONS = WIDGET_GUIDE.sections.map((s, index) => ({key: String(index), label: s.title}));

// A pulsing ring over the place to tap, so the picture says where before the
// words do. Still on low-end phones.
const TapRing = ({box, still}: {box: NonNullable<WidgetGuideStep['highlight']>; still: boolean}) => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 1, duration: 700, useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 0, duration: 700, useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, still]);
  const scale = pulse.interpolate({inputRange: [0, 1], outputRange: [1, 1.08]});
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          left: `${box.x * 100}%`,
          top: `${box.y * 100}%`,
          width: `${box.w * 100}%`,
          height: `${box.h * 100}%`,
          transform: [{scale}],
        },
      ]}
    />
  );
};

// Adding the widget happens on the phone's home screen, outside the app, so
// nothing can be spotlit. On Android the app asks the launcher to add it (one
// tap on the system's own card); the steps, one at a time with a screenshot,
// are there for everyone else. WIDGET_GUIDE is this platform's own.
const WidgetGuideScreen = () => {
  const {theme, primaryColor, isLowEndMode} = useTheme();
  const navigation = useNavigation();
  const accent = primaryColor ?? theme.colors.navBackground;
  const [canPin, setCanPin] = useState(false);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    canPinWidget().then(setCanPin, () => setCanPin(false));
  }, []);

  const section = WIDGET_GUIDE.sections[sectionIndex];
  const step = section.steps[stepIndex];
  const isLast = stepIndex === section.steps.length - 1;

  const themed = useMemo(
    () =>
      StyleSheet.create({
        container: {backgroundColor: theme.colors.backgroundPrimary},
        intro: {color: theme.colors.textSecondary},
        pinButton: {backgroundColor: accent},
        counter: {color: theme.colors.textSecondary},
        stepText: {color: theme.colors.textPrimary},
        back: {borderColor: accent},
        backText: {color: accent},
        next: {backgroundColor: accent},
        tip: {color: theme.colors.textSecondary, backgroundColor: theme.colors.backgroundSecondary},
        // Each picture keeps its own shape.
        imageFrame: {backgroundColor: theme.colors.backgroundSecondary, aspectRatio: step.aspect ?? 1},
      }),
    [theme, accent, step.aspect],
  );

  const pickSection = (index: number) => {
    setSectionIndex(index);
    setStepIndex(0);
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, themed.container]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.intro, themed.intro]}>{WIDGET_GUIDE.intro}</Text>

        {canPin ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => pinWidget()}
            style={({pressed}) => [styles.pinButton, themed.pinButton, pressed ? styles.pressed : null]}>
            <Text style={styles.pinText}>Apetraho eo amin'ny écran ny widget</Text>
          </Pressable>
        ) : null}

        {SECTION_OPTIONS.length > 1 ? (
          // The toggle brings its own screen margins; the scroll has them already.
          <View style={styles.sections}>
            <SegmentedToggle
              options={SECTION_OPTIONS}
              selected={String(sectionIndex)}
              onChange={key => pickSection(Number(key))}
            />
          </View>
        ) : null}

        <Text style={[styles.counter, themed.counter]}>
          {stepIndex + 1} / {section.steps.length}
        </Text>

        {/* What to do first, where second: the words stay in view even when
            the picture runs below the fold. */}
        <Text style={[styles.stepText, themed.stepText]}>{step.text}</Text>

        {step.image ? (
          <View style={[styles.imageFrame, themed.imageFrame]}>
            <Image source={step.image} style={styles.image} resizeMode="contain" />
            {step.highlight ? <TapRing key={`${sectionIndex}-${stepIndex}`} box={step.highlight} still={isLowEndMode} /> : null}
          </View>
        ) : null}

        {step.tip ? <Text style={[styles.tip, themed.tip]}>{step.tip}</Text> : null}
      </ScrollView>

      {/* Fixed under the scroll: the pictures differ in height, and a button
          that moves from step to step is the one older users miss. */}
      <View style={[styles.footer, themed.container]}>
        <View style={styles.nav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="←"
            disabled={stepIndex === 0}
            onPress={() => setStepIndex(i => i - 1)}
            style={({pressed}) => [
              styles.back,
              themed.back,
              stepIndex === 0 ? styles.disabled : null,
              pressed ? styles.pressed : null,
            ]}>
            <Text style={[styles.backText, themed.backText]}>←</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => (isLast ? navigation.goBack() : setStepIndex(i => i + 1))}
            style={({pressed}) => [styles.next, themed.next, pressed ? styles.pressed : null]}>
            <Text style={styles.nextText}>{isLast ? 'Vita ✓' : 'Manaraka →'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  scroll: {padding: 16, paddingBottom: 32},
  intro: {fontSize: 15, lineHeight: 22, marginBottom: 16},
  pinButton: {borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18, marginBottom: 20, alignItems: 'center'},
  pinText: {color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center'},
  sections: {marginHorizontal: -16, marginTop: -12, marginBottom: 8},
  counter: {fontSize: 14, fontWeight: '600', marginBottom: 8},
  imageFrame: {width: '100%', borderRadius: 12, overflow: 'hidden', marginBottom: 14},
  image: {width: '100%', height: '100%'},
  ring: {position: 'absolute', borderWidth: 4, borderColor: RING, borderRadius: 16},
  stepText: {fontSize: 20, lineHeight: 29, fontWeight: '600', marginBottom: 14},
  footer: {paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12},
  nav: {flexDirection: 'row', gap: 12},
  back: {width: 64, borderWidth: 2, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  backText: {fontSize: 24, fontWeight: '700'},
  next: {flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: 'center'},
  nextText: {color: '#FFFFFF', fontSize: 18, fontWeight: '700'},
  tip: {fontSize: 15, lineHeight: 22, padding: 14, borderRadius: 12},
  disabled: {opacity: 0.35},
  pressed: {opacity: 0.85},
});

export default WidgetGuideScreen;
