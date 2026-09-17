import React, {useEffect, useState} from 'react';
import {BackHandler, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../contexts/ThemeContext';
import {LookPicker} from '../components/LookPicker';
import {bibleDatabaseService} from '../services/database/DatabaseService';
import {verseForDate, type DailyVerse} from '../services/reminders/readingReminder';
import {getWidgetLook, setWidgetLook} from '../services/widget/dailyVerseWidget';
import {lookForImage, pickBackgroundImage, type ShareCardLook} from '../utils/shareCard';
import type {RootStackParamList} from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type WidgetLookRouteProp = RouteProp<RootStackParamList, 'WidgetLook'>;

// The home-screen widget's look: a live preview, the share card's swatches
// and a "done" button. Reached from the widget's own Loko shortcut
// (fromWidget) or from Safidio ny loko. Every pick is saved and pushed to the
// real widget immediately (setWidgetLook), so the preview and the widget
// change together.
const WidgetLookScreen = () => {
  const {theme} = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<WidgetLookRouteProp>();
  const fromWidget = route.params?.fromWidget === true;

  const [look, setLookState] = useState<ShareCardLook | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [verse, setVerse] = useState<DailyVerse | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWidgetLook().then(stored => {
      if (cancelled) return;
      setLookState(stored);
      setPhotoUri(stored.imageUri ?? null);
    });
    bibleDatabaseService
      .initDatabase()
      .then(() => verseForDate(new Date()))
      .then(today => {
        if (!cancelled) setVerse(today);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  const accent = theme.colors.accentBlue;

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.container, {backgroundColor: theme.colors.backgroundPrimary}]}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Placeholder MG copy — user-owned. */}
        <Text style={[styles.hint, {color: theme.colors.textSecondary}]}>
          Safidio ny lokon'ny andinin-teny eo amin'ny efijery fandraisana.
        </Text>

        {look ? (
          <View style={[styles.preview, {backgroundColor: look.background}]}>
            {look.imageUri ? (
              <>
                <Image source={{uri: look.imageUri}} style={styles.previewImage} />
                <View style={styles.previewScrim} />
              </>
            ) : null}
            <View style={styles.previewContent}>
              <Text style={[styles.previewBadge, {color: look.text, backgroundColor: look.text + '26'}]}>
                {verse ? verse.ref.toUpperCase() : 'SAKAFOM-PANAHY'}
              </Text>
              <Text style={[styles.previewVerse, {color: look.text}]} numberOfLines={4}>
                {verse ? `“${verse.body}”` : ''}
              </Text>
              <View style={[styles.previewRule, {backgroundColor: look.text + '33'}]} />
              <Text style={[styles.previewRef, {color: look.accent}]}>{verse?.ref ?? ''}</Text>
            </View>
          </View>
        ) : null}

        {look ? <LookPicker look={look} photoUri={photoUri} onSelect={apply} onPickPhoto={pickPhoto} /> : null}

        <Pressable onPress={done} style={[styles.doneButton, {backgroundColor: accent}]} accessibilityRole="button">
          <Text style={styles.doneText}>Vita</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  scroll: {padding: 16, paddingBottom: 32},
  hint: {fontSize: 14, lineHeight: 20, marginBottom: 16},
  preview: {borderRadius: 24, overflow: 'hidden', minHeight: 150},
  previewImage: {...StyleSheet.absoluteFillObject, width: undefined, height: undefined, resizeMode: 'cover'},
  previewScrim: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.45)'},
  previewContent: {padding: 14},
  previewBadge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  previewVerse: {
    fontFamily: Platform.select({ios: 'Georgia', default: 'serif'}),
    fontSize: 15,
    lineHeight: 21,
    marginTop: 10,
  },
  previewRule: {height: StyleSheet.hairlineWidth, marginTop: 10},
  previewRef: {fontSize: 12, fontWeight: '700', marginTop: 6},
  doneButton: {borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8},
  doneText: {color: '#FFFFFF', fontSize: 16, fontWeight: '700'},
});

export default WidgetLookScreen;
