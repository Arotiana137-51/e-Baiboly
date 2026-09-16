import React, {useEffect, useMemo, useRef} from 'react';
import {
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../contexts/ThemeContext';
import {t} from '../i18n/strings';
import {
  PRIMARY_COLOR_OPTIONS,
  DEFAULT_PRIMARY_COLOR_ID,
  type PrimaryColorOption,
} from '../theme/personalizationPalette';
import type {RootStackParamList} from '../navigation/RootNavigator';

const SWATCH_SIZE = 44;
const LOGO_SIZE = 64;
// Brief tactile delay so the selected color paints before we leave the screen.
const APPLY_DELAY_MS = 450;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type PersonalizationRouteProp = RouteProp<RootStackParamList, 'Personalization'>;

const PersonalizationScreen = () => {
  const {theme, primaryColor, setPrimaryColor} = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<PersonalizationRouteProp>();

  const isFirstRun = route.params?.firstRun === true;
  const accent = primaryColor ?? theme.colors.navBackground;
  const applyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isFirstRun) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      sub.remove();
    };
  }, [isFirstRun]);

  useEffect(
    () => () => {
      if (applyTimer.current) clearTimeout(applyTimer.current);
    },
    [],
  );

  const selectedHex = useMemo(() => {
    if (primaryColor) return primaryColor.toLowerCase();
    const def = PRIMARY_COLOR_OPTIONS.find(o => o.id === DEFAULT_PRIMARY_COLOR_ID);
    return def ? def.hex.toLowerCase() : null;
  }, [primaryColor]);

  const activeName = useMemo(() => {
    const found = PRIMARY_COLOR_OPTIONS.find(o => o.hex.toLowerCase() === selectedHex);
    return found?.name ?? '';
  }, [selectedHex]);

  const goToHome = () => {
    if (isFirstRun) {
      // Next first-run step: "do you already know the app?" — that screen
      // resets to Home itself once answered.
      navigation.reset({index: 0, routes: [{name: 'OnboardingGate'}]});
    } else {
      navigation.navigate('Home');
    }
  };

  const handleSelect = (option: PrimaryColorOption) => {
    setPrimaryColor(option.id === DEFAULT_PRIMARY_COLOR_ID ? null : option.hex);
    // Let the theme repaint under the finger, then transition.
    if (applyTimer.current) clearTimeout(applyTimer.current);
    applyTimer.current = setTimeout(goToHome, APPLY_DELAY_MS);
  };

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.container, {backgroundColor: theme.colors.backgroundPrimary}]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Brand column — first launch only. The hamburger "Loko manokana" route
            reuses this screen and shows just the color selection, no logo. */}
        {isFirstRun ? (
          <View style={styles.brand}>
            <View style={styles.logoWrap}>
              <Image source={require('../components/shared/appIcon.png')} style={styles.logo} />
            </View>

            <Text style={[styles.wordmark, {color: theme.colors.textPrimary}]}>e-Baiboly</Text>

            <View style={[styles.badge, {backgroundColor: accent + '1A'}]}>
              <Text style={[styles.badgeText, {color: accent}]}>
                {t('personalization.brandBadge')}
              </Text>
            </View>

            <View style={styles.descBox}>
              <Text style={[styles.welcome, {color: theme.colors.textPrimary}]}>
                {t('personalization.firstRunWelcome')}
              </Text>
              <View style={[styles.descRule, {backgroundColor: theme.colors.divider}]} />
              <Text style={[styles.desc, {color: theme.colors.textSecondary}]}>
                {t('personalization.firstRunDesc')}
              </Text>
              <View style={[styles.descRule, {backgroundColor: theme.colors.divider}]} />
            </View>
          </View>
        ) : null}

        {/* Active color name. */}
        {activeName ? (
          <View style={styles.activeRow}>
            <View style={[styles.activeDot, {backgroundColor: '#3BD16F'}]} />
            <Text style={[styles.activeName, {color: accent}]}>{activeName}</Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          {PRIMARY_COLOR_OPTIONS.map(option => {
            const isSelected = selectedHex === option.hex.toLowerCase();
            return (
              <Pressable
                key={option.id}
                onPress={() => handleSelect(option)}
                style={({pressed}) => [styles.cell, pressed && {opacity: 0.7}]}
                accessibilityRole="button"
                accessibilityLabel={option.name}
                accessibilityState={{selected: isSelected}}>
                <View
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: option.hex,
                      borderColor: isSelected ? accent : theme.colors.divider,
                      borderWidth: isSelected ? 3 : 1,
                    },
                  ]}>
                  {isSelected ? <Text style={styles.check}>✓</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Home-screen widget look lives on its own screen — not part of
            the first-run flow. Placeholder MG copy — user-owned. */}
        {!isFirstRun ? (
          <Pressable
            onPress={() => navigation.navigate('WidgetLook')}
            style={[styles.widgetRow, {backgroundColor: theme.colors.backgroundSecondary}]}
            accessibilityRole="button">
            <View style={styles.widgetRowText}>
              <Text style={[styles.widgetTitle, {color: theme.colors.textPrimary}]}>
                Sakafom-panahy (widget)
              </Text>
              <Text style={[styles.widgetHint, {color: theme.colors.textSecondary}]}>
                Ny lokon'ny andinin-teny eo amin'ny efijery fandraisana.
              </Text>
            </View>
            <Text style={[styles.widgetChevron, {color: accent}]}>›</Text>
          </Pressable>
        ) : null}

        {/* Footer hint pill. */}
        <View style={styles.footer}>
          <View style={[styles.hintPill, {backgroundColor: theme.colors.backgroundSecondary}]}>
            <View style={[styles.hintDot, {backgroundColor: accent}]} />
            <Text style={[styles.hintText, {color: accent}]}>{t('personalization.hint')}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  scroll: {padding: 24, paddingBottom: 32, minHeight: 500},
  brand: {alignItems: 'center', marginTop: 12},
  logoWrap: {alignItems: 'center', justifyContent: 'center'},
  // Apple-style squircle: ~22% corner radius, no border (the icon is a finished tile).
  logo: {width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: LOGO_SIZE * 0.22, resizeMode: 'cover'},
  wordmark: {fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginTop: 16},
  badge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase'},
  descBox: {alignItems: 'center', marginTop: 16, paddingHorizontal: 12},
  welcome: {fontSize: 15, textAlign: 'center', marginBottom: 12},
  descRule: {height: StyleSheet.hairlineWidth, alignSelf: 'stretch'},
  desc: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
    paddingVertical: 10,
    opacity: 0.9,
  },
  activeRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24},
  activeDot: {width: 8, height: 8, borderRadius: 4, marginRight: 6},
  activeName: {fontSize: 13, fontWeight: '700'},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
  },
  cell: {padding: 6},
  widgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    padding: 14,
    borderRadius: 12,
  },
  widgetRowText: {flex: 1},
  widgetTitle: {fontSize: 15, fontWeight: '700'},
  widgetHint: {fontSize: 13, marginTop: 4},
  widgetChevron: {fontSize: 26, fontWeight: '300', marginLeft: 8},
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {color: '#FFFFFF', fontSize: 18, fontWeight: '700'},
  footer: {alignItems: 'center', marginTop: 24},
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  hintDot: {width: 7, height: 7, borderRadius: 3.5, marginRight: 8},
  hintText: {fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase'},
});

export default PersonalizationScreen;
