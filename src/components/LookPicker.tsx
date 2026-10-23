import React, {useMemo, useRef, useState} from 'react';
import {Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../contexts/ThemeContext';
import {t} from '../i18n/strings';
import {MenuIcon} from './MenuIcons';
import {useEarthTheme} from '../hooks/useEarthTheme';
import {PRIMARY_COLOR_OPTIONS} from '../theme/personalizationPalette';
import {accentFill, byHue} from '../utils/colorUtils';
import {lookForColor, PRESET_LOOKS, type ShareCardLook} from '../utils/shareCard';

// The app's colour palette in rainbow order, so a colour is easy to find.
const SORTED_PALETTE = [...PRIMARY_COLOR_OPTIONS].sort((a, b) => byHue(a.hex, b.hex));
const COLOR_LOOKS = SORTED_PALETTE.map(option => ({name: option.name, look: lookForColor(option.hex)}));

type Swatch = {look: ShareCardLook; name?: string};

// The share sheet's colours: the default look and the dark one, then the
// palette from its bright hues, so colour shows on the first page (four
// neutral looks in front read as "no colours here"); the two earth tones
// close the list. The card's verse is big, so the palette takes white ink
// wherever it reads. Palette colours keep their names for screen readers.
const SWATCHES: Swatch[] = [
  {look: PRESET_LOOKS[0]},
  {look: PRESET_LOOKS[1]},
  ...SORTED_PALETTE.map(option => ({look: lookForColor(option.hex, 'large'), name: option.name})),
  ...PRESET_LOOKS.slice(2).map(look => ({look})),
];

type LookPickerProps = {
  look: ShareCardLook;
  // The photo currently available for the photo tile (chosen earlier, or the
  // one the look already uses).
  photoUri: string | null;
  onSelect: (look: ShareCardLook) => void;
  onPickPhoto: () => void;
};

// Selection is by background colour, so a look re-created from storage still
// reads as selected.
const isChosen = (look: ShareCardLook, swatch: ShareCardLook) =>
  !look.imageUri && look.background === swatch.background;

const chosenIndex = (look: ShareCardLook) => SWATCHES.findIndex(s => isChosen(look, s.look));

// Each swatch's fill and tick colour, made once.
const SWATCH_STYLES = SWATCHES.map(({look}) =>
  StyleSheet.create({fill: {backgroundColor: look.background}, check: {color: look.text}}),
);

// Nine colours a page, three by three: big enough to hit, few enough to take
// in at a glance.
const PAGE_SIZE = 9;
const PAGE_COUNT = Math.ceil(SWATCHES.length / PAGE_SIZE);

// The page the chosen colour is on (the first for a photo or a preset).
export const pageOf = (look: ShareCardLook): number => Math.max(0, Math.floor(chosenIndex(look) / PAGE_SIZE));

// Which swatches the strip shows: the first `fit`, except that a colour
// picked further on (from the grid) takes the last place, so the choice shows.
export const stripSlots = (fit: number, chosen: number): number[] =>
  Array.from({length: fit}, (_, i) => (i === fit - 1 && chosen >= fit ? chosen : i));

// The theme colour, darkened just enough for white to read on a light one:
// the strip's "Loko" tile, the pager's arrows and dots, and the share
// screen's buttons all take it, so they match.
export const themeFill = (navBackground: string) => accentFill(navBackground, WHITE).fill;

type LookStripProps = LookPickerProps & {onMore: () => void; photoLabel: string; moreLabel: string};

// Under the share card: the photo button, the first few colours and a button
// that opens them all (LookPager), so the card keeps the screen and every
// colour is one tap away. The photo button has a picture and its name ("+"
// alone was not read as "a photo from the phone"). As many colours as the
// strip's measured width holds, four on a 384dp phone.
export const LookStrip = ({
  look,
  photoUri,
  onSelect,
  onPickPhoto,
  onMore,
  photoLabel,
  moreLabel,
}: LookStripProps) => {
  const {theme} = useTheme();
  const [width, setWidth] = useState(0);
  // The first frame, before the strip is measured, shows the minimum.
  const fit = Math.max(MIN_FIT, Math.floor((width - 2 * TILE_COLUMN - STRIP_GAP) / (CIRCLE + STRIP_GAP)));
  const shown = stripSlots(fit, chosenIndex(look));
  const photoOn = !!look.imageUri;
  const themed = useMemo(() => {
    const fill = themeFill(theme.colors.navBackground);
    return StyleSheet.create({
      tile: {backgroundColor: theme.colors.backgroundTertiary, borderColor: theme.colors.divider},
      more: {backgroundColor: fill, borderColor: fill},
      on: {borderColor: theme.colors.accentBlue, borderWidth: 3},
      off: {borderColor: theme.colors.divider},
      label: {color: theme.colors.textPrimary},
    });
  }, [theme]);
  return (
    <View style={styles.strip} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <Pressable
        onPress={onPickPhoto}
        style={styles.tileButton}
        accessibilityRole="button"
        accessibilityLabel={photoLabel}
        accessibilityState={{selected: photoOn}}
      >
        <View style={[styles.tile, themed.tile, photoOn ? themed.on : null]}>
          {photoUri ? (
            <Image source={{uri: photoUri}} style={styles.photoThumb} />
          ) : (
            <MenuIcon name="photo" color={theme.colors.textPrimary} />
          )}
        </View>
        <Text style={[styles.tileLabel, themed.label]} numberOfLines={1}>
          {photoLabel}
        </Text>
      </Pressable>
      {shown.map(index => {
        const swatch = SWATCHES[index];
        const on = isChosen(look, swatch.look);
        return (
          <Pressable
            key={swatch.look.background}
            onPress={() => onSelect(swatch.look)}
            style={[styles.stripCircle, SWATCH_STYLES[index].fill, on ? themed.on : themed.off]}
            accessibilityRole="button"
            accessibilityLabel={swatch.name}
            accessibilityState={{selected: on}}
          >
            {on ? <Text style={[styles.check, SWATCH_STYLES[index].check]}>✓</Text> : null}
          </Pressable>
        );
      })}
      {/* A grid of dots on the theme colour: "every colour". */}
      <Pressable onPress={onMore} style={styles.tileButton} accessibilityRole="button" accessibilityLabel={moreLabel}>
        <View style={[styles.tile, themed.more]}>
          <View style={styles.dotGrid}>
            {Array.from({length: 9}, (_, i) => (
              <View key={i} style={styles.gridDot} />
            ))}
          </View>
        </View>
        <Text style={[styles.tileLabel, themed.label]} numberOfLines={1}>
          {moreLabel}
        </Text>
      </Pressable>
    </View>
  );
};

// Every colour, three by three, a page at a time: theme-coloured arrows on
// both sides turn the pages (a tap is easier than a swipe for many), and dots
// under the grid show how many pages there are and which one is open. Few
// people guess that a row scrolls (Baymard); pages with dots are a sign
// everyone knows. Opens on the page of the colour already chosen.
export const LookPager = ({look, onSelect}: Pick<LookPickerProps, 'look' | 'onSelect'>) => {
  const {theme} = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [page, setPage] = useState(() => pageOf(look));
  const opened = useRef(false);

  const themed = useMemo(() => {
    const fill = themeFill(theme.colors.navBackground);
    return StyleSheet.create({
      on: {borderColor: theme.colors.accentBlue, borderWidth: 3},
      off: {borderColor: theme.colors.divider},
      arrow: {backgroundColor: fill},
      dotOn: {backgroundColor: fill},
      dotOff: {backgroundColor: theme.colors.divider},
    });
  }, [theme]);
  const sized = useMemo(() => StyleSheet.create({page: {width: pageWidth}}), [pageWidth]);

  const goTo = (target: number) => {
    const next = Math.max(0, Math.min(PAGE_COUNT - 1, target));
    scrollRef.current?.scrollTo({x: next * pageWidth, animated: true});
    setPage(next);
  };

  // Faded, not hidden, at the first and last page, so the grid never moves.
  const arrow = (direction: -1 | 1) => {
    const off = direction < 0 ? page === 0 : page === PAGE_COUNT - 1;
    return (
      <Pressable
        onPress={() => goTo(page + direction)}
        disabled={off}
        style={({pressed}) => [styles.arrow, themed.arrow, off ? styles.arrowOff : null, pressed ? styles.pressed : null]}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t(direction < 0 ? 'share.prevPage' : 'share.nextPage')}
        accessibilityState={{disabled: off}}
      >
        <View style={[styles.chevron, direction < 0 ? styles.chevronBack : null]} />
      </Pressable>
    );
  };

  return (
    <View style={styles.picker}>
      <View style={styles.pager}>
        {arrow(-1)}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.pages}
          onLayout={e => setPageWidth(e.nativeEvent.layout.width)}
          // The chosen colour's page can only be scrolled to once the pages
          // have their width: before that the content is 0 wide.
          onContentSizeChange={contentWidth => {
            if (opened.current || !pageWidth || contentWidth < PAGE_COUNT * pageWidth) return;
            opened.current = true;
            scrollRef.current?.scrollTo({x: page * pageWidth, animated: false});
          }}
          onMomentumScrollEnd={e => {
            if (pageWidth) setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
          }}
        >
          {Array.from({length: PAGE_COUNT}, (_, p) => (
            <View key={p} style={[styles.page, sized.page]}>
              {SWATCHES.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE).map((swatch, i) => {
                const index = p * PAGE_SIZE + i;
                const on = isChosen(look, swatch.look);
                return (
                  <View key={swatch.look.background} style={styles.cell}>
                    <Pressable
                      onPress={() => onSelect(swatch.look)}
                      style={[styles.gridCircle, SWATCH_STYLES[index].fill, on ? themed.on : themed.off]}
                      accessibilityRole="button"
                      accessibilityLabel={swatch.name}
                      accessibilityState={{selected: on}}
                    >
                      {on ? <Text style={[styles.check, SWATCH_STYLES[index].check]}>✓</Text> : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
        {arrow(1)}
      </View>
      <View style={styles.dots}>
        {Array.from({length: PAGE_COUNT}, (_, p) => (
          <View key={p} style={[styles.dot, p === page ? themed.dotOn : themed.dotOff]} />
        ))}
      </View>
    </View>
  );
};

// Every look at once, for the widget screen: a labelled photo row, the
// designed looks as small cards that show their text and reference colours,
// then the whole palette as a grid of circles, like the app's own colour screen.
// In the earth colours of Teny ho anao, like the screen it sits on.
export const LookGrid = ({
  look,
  photoUri,
  onSelect,
  onPickPhoto,
  photoLabel,
}: LookPickerProps & {photoLabel: string}) => {
  const earth = useEarthTheme();
  const ring = (on: boolean) =>
    on ? [styles.ringOn, {borderColor: earth.accentText}] : {borderColor: earth.line};
  return (
    <View style={styles.grid}>
      <Pressable
        onPress={onPickPhoto}
        style={[styles.photoRow, {backgroundColor: earth.card}, ring(!!look.imageUri)]}
        accessibilityRole="button"
        accessibilityLabel={photoLabel}
        accessibilityState={{selected: !!look.imageUri}}
      >
        <View style={[styles.photoRowThumb, {backgroundColor: earth.chip}]}>
          {photoUri ? (
            <Image source={{uri: photoUri}} style={styles.photoThumb} />
          ) : (
            <Text style={[styles.photoPlus, {color: earth.ink}]}>+</Text>
          )}
        </View>
        <Text style={[styles.photoRowLabel, {color: earth.ink}]}>{photoLabel}</Text>
      </Pressable>
      <View style={styles.cards}>
        {PRESET_LOOKS.map(preset => (
          <Pressable
            key={preset.background}
            onPress={() => onSelect(preset)}
            style={[styles.card, {backgroundColor: preset.background}, ring(isChosen(look, preset))]}
            accessibilityRole="button"
            accessibilityState={{selected: isChosen(look, preset)}}
          >
            <View style={[styles.cardLine, {backgroundColor: preset.text}]} />
            <View style={[styles.cardRef, {backgroundColor: preset.accent}]} />
          </Pressable>
        ))}
      </View>
      <View style={styles.circles}>
        {COLOR_LOOKS.map(({name, look: swatch}) => {
          const on = isChosen(look, swatch);
          return (
            <Pressable
              key={swatch.background}
              onPress={() => onSelect(swatch)}
              style={[styles.circle, {backgroundColor: swatch.background}, ring(on)]}
              accessibilityRole="button"
              accessibilityLabel={name}
              accessibilityState={{selected: on}}
            >
              {on ? <Text style={[styles.check, {color: swatch.text}]}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const GRID_CIRCLE = 48;
const CIRCLE = 44;
const TILE = 52;
const TILE_COLUMN = 56;
const STRIP_GAP = 8;
// Colours the strip shows at least, before it is measured or on a narrow screen.
const MIN_FIT = 3;
const WHITE = '#FFFFFF';

const styles = StyleSheet.create({
  // Circles sit level with the tiles; the tiles' labels hang below.
  strip: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between'},
  tileButton: {width: TILE_COLUMN, alignItems: 'center'},
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {fontSize: 13, fontWeight: '600', marginTop: 4},
  stripCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 1,
    marginTop: (TILE - CIRCLE) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotGrid: {width: 21, flexDirection: 'row', flexWrap: 'wrap', gap: 3},
  gridDot: {width: 5, height: 5, borderRadius: 2.5, backgroundColor: WHITE},
  picker: {gap: 12},
  pager: {flexDirection: 'row', alignItems: 'center', gap: 6},
  pages: {flex: 1},
  page: {flexDirection: 'row', flexWrap: 'wrap'},
  cell: {width: '33.333%', alignItems: 'center', paddingVertical: 4},
  gridCircle: {
    width: GRID_CIRCLE,
    height: GRID_CIRCLE,
    borderRadius: GRID_CIRCLE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A rounded square, so it is not taken for one more colour.
  arrow: {
    width: 36,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: {width: 0, height: 1},
  },
  arrowOff: {opacity: 0.3, elevation: 0},
  // A drawn chevron, crisper than the "›" glyph: two sides of a square turned
  // 45°, nudged back so its point sits in the middle.
  chevron: {
    width: 12,
    height: 12,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: WHITE,
    marginRight: 4,
    transform: [{rotate: '45deg'}],
  },
  chevronBack: {marginRight: 0, marginLeft: 4, transform: [{rotate: '-135deg'}]},
  pressed: {opacity: 0.6},
  dots: {flexDirection: 'row', justifyContent: 'center', gap: 8},
  dot: {width: 8, height: 8, borderRadius: 4},
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  photoPlus: {
    fontSize: 18,
    fontWeight: '700',
  },
  grid: {gap: 20},
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  photoRowThumb: {
    width: 56,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRowLabel: {flex: 1, fontSize: 15, fontWeight: '600'},
  cards: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  card: {
    width: 62,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  cardLine: {width: 30, height: 4, borderRadius: 2},
  cardRef: {width: 16, height: 4, borderRadius: 2},
  ringOn: {borderWidth: 3},
  circles: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {fontSize: 18, fontWeight: '700'},
});
