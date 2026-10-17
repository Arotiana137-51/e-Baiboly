import React, {useEffect, useState} from 'react';
import {BackHandler, Image, Platform, StyleSheet, Switch, Text, View, useColorScheme} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../contexts/ThemeContext';
import {LookGrid} from '../components/LookPicker';
import {ScrollViewWithThumb} from '../components/ScrollViewWithThumb';
import {SheetButton} from '../components/SheetModal';
import {bibleDatabaseService} from '../services/database/DatabaseService';
import {verseForDate, type DailyVerse} from '../services/reminders/readingReminder';
import {
  getWidgetFollowDark,
  getWidgetLook,
  setWidgetFollowDark,
  setWidgetLook,
} from '../services/widget/dailyVerseWidget';
import {lookForImage, nightLook, pickBackgroundImage, type ShareCardLook} from '../utils/shareCard';
import type {RootStackParamList} from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type WidgetLookRouteProp = RouteProp<RootStackParamList, 'WidgetLook'>;

// The home-screen widget's look: a live preview pinned on top, every look
// in a grid under it, and a "done" button. Reached from the widget's own Loko shortcut
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
  const [followDark, setFollowDark] = useState(false);
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

  const toggleFollowDark = (on: boolean) => {
    setFollowDark(on);
    setWidgetFollowDark(on);
  };

  // What the home screen shows right now: the night version while the phone
  // is in dark mode, if the widget follows it.
  const shown = look && followDark && scheme === 'dark' ? nightLook(look) : look;

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

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.container, {backgroundColor: theme.colors.backgroundPrimary}]}
    >
      {/* The preview stays in view while the grid scrolls, so every pick
          shows on it at once. */}
      <View style={styles.top}>
        {/* Placeholder MG copy — user-owned. */}
        <Text style={[styles.hint, {color: theme.colors.textSecondary}]}>
          Safidio ny lokon'ny andinin-teny eo amin'ny écran fandraisana.
        </Text>

        {shown ? (
          <View style={[styles.preview, {backgroundColor: shown.background}]}>
            {shown.imageUri ? (
              <>
                <Image source={{uri: shown.imageUri}} style={styles.previewImage} />
                <View style={styles.previewScrim} />
              </>
            ) : null}
            <View style={styles.previewContent}>
              <Text style={[styles.previewVerse, {color: shown.text}]} numberOfLines={4}>
                {verse?.body ?? ''}
              </Text>
              <View style={styles.previewRefRow}>
                <View style={[styles.previewRule, {backgroundColor: shown.accent}]} />
                <Text style={[styles.previewRef, {color: shown.accent}]}>{verse?.ref ?? ''}</Text>
              </View>
            </View>
          </View>
        ) : null}
      </View>

      <ScrollViewWithThumb style={styles.list} contentContainerStyle={styles.scroll}>
        {/* Placeholder MG copy — user-owned. */}
        <View style={[styles.darkRow, {backgroundColor: theme.colors.backgroundSecondary}]}>
          <View style={styles.darkText}>
            <Text style={[styles.darkTitle, {color: theme.colors.textPrimary}]}>Mode sombre</Text>
            <Text style={[styles.hint, styles.darkHint, {color: theme.colors.textSecondary}]}>
              Maizina koa ny widget rehefa mode sombre ny finday.
            </Text>
          </View>
          <Switch
            value={followDark}
            onValueChange={toggleFollowDark}
            trackColor={{false: theme.colors.divider, true: theme.colors.accentBlue}}
            thumbColor="#FFFFFF"
          />
        </View>
        {look ? <LookGrid look={look} photoUri={photoUri} onSelect={apply} onPickPhoto={pickPhoto} /> : null}
      </ScrollViewWithThumb>

      <View style={[styles.footer, {borderTopColor: theme.colors.divider}]}>
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
  hint: {fontSize: 14, lineHeight: 20, marginBottom: 12},
  darkRow: {flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 14, marginBottom: 20},
  darkText: {flex: 1},
  darkTitle: {fontSize: 15, fontWeight: '700'},
  darkHint: {marginBottom: 0, marginTop: 2},
  preview: {borderRadius: 24, overflow: 'hidden', minHeight: 150},
  previewImage: {...StyleSheet.absoluteFillObject, width: undefined, height: undefined, resizeMode: 'cover'},
  previewScrim: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.45)'},
  previewContent: {flex: 1, justifyContent: 'space-between', padding: 16, gap: 10},
  previewVerse: {
    fontFamily: Platform.select({ios: 'Georgia', default: 'serif'}),
    fontSize: 15,
    lineHeight: 21,
  },
  previewRefRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  previewRule: {width: 20, height: 1.5},
  previewRef: {fontSize: 12, fontWeight: '700'},
});

export default WidgetLookScreen;
