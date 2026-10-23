// Icons for the hamburger menu (and the Fotoam-pivavahana rows), drawn from plain Views like
// TutorialIcons and ShareIcon — no icon library, no native rebuild (the
// heart and the praying hands are tinted images). Each is a single colour
// with no cut-outs, so it reads on any cell background (except the colour
// picker, which shows colours).
import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';

export type MenuIconName =
  | 'heart'
  | 'history'
  | 'notes'
  | 'hands'
  | 'book'
  | 'bubble'
  | 'bell'
  | 'palette'
  | 'signpost'
  | 'note'
  | 'bible'
  | 'dictionary'
  | 'trash';

// NOTE: geometry is hardcoded to a 24px box (the one size the menu grid
// uses). Parameterise on size if a second caller ever needs another.
const SIZE = 24;
const STROKE = 2;

type IconProps = {color: string};

// Filled heart from SVG Repo (heart-svgrepo-com.svg), rendered with a 1/16
// margin to 24/48/72px PNGs and tinted like the others.
const Heart: React.FC<IconProps> = ({color}) => (
  <Image source={require('./shared/heart.png')} style={[styles.box, {tintColor: color}]} />
);

// A clock face: ring plus hour and minute hands.
const History: React.FC<IconProps> = ({color}) => (
  <View style={styles.box}>
    <View style={[styles.clockRing, {borderColor: color}]} />
    <View style={[styles.clockHour, {backgroundColor: color}]} />
    <View style={[styles.clockMinute, {backgroundColor: color}]} />
  </View>
);

// A ruled page with a pencil laid across its lower-right corner.
const Notes: React.FC<IconProps> = ({color}) => (
  <View style={styles.box}>
    <View style={[styles.page, {borderColor: color}]}>
      <View style={[styles.pageLine, {backgroundColor: color}]} />
      <View style={[styles.pageLine, {backgroundColor: color}]} />
      <View style={[styles.pageLine, styles.pageLineShort, {backgroundColor: color}]} />
    </View>
    <View style={[styles.pencil, {backgroundColor: color}]} />
    <View style={[styles.pencilTip, {borderTopColor: color}]} />
  </View>
);

// Praying hands are too organic to draw from Views, so this one is an image:
// a 512px line drawing (hands.png), cropped, its lines thickened (max
// filter 9) so they hold up at 24dp, scaled to 24/48/72px and tinted.
const Hands: React.FC<IconProps> = ({color}) => (
  <Image source={require('./shared/handsPraying.png')} style={[styles.box, {tintColor: color}]} />
);

// An open book: two outlined pages meeting at the spine.
const Book: React.FC<IconProps> = ({color}) => (
  <View style={styles.box}>
    <View style={[styles.bookPage, styles.bookPageLeft, {borderColor: color}]} />
    <View style={[styles.bookPage, styles.bookPageRight, {borderColor: color}]} />
  </View>
);

// A speech bubble with a tail at the bottom left.
const Bubble: React.FC<IconProps> = ({color}) => (
  <View style={styles.box}>
    <View style={[styles.bubble, {borderColor: color}]} />
    <View style={[styles.bubbleTail, {backgroundColor: color}]} />
  </View>
);

// Bell: outlined dome, rim and clapper.
const Bell: React.FC<IconProps> = ({color}) => (
  <View style={styles.box}>
    <View style={[styles.bellDome, {borderColor: color}]} />
    <View style={[styles.bellRim, {backgroundColor: color}]} />
    <View style={[styles.bellClapper, {backgroundColor: color}]} />
  </View>
);

// Colour picker: a wheel of four of the app's own colours, ringed in the
// menu colour. The one multicolour icon, on purpose: it stands for colours.
const PALETTE_COLORS = ['#C8102E', '#D4AF37', '#007991', '#006747']; // red, gold, teal, green
const Palette: React.FC<IconProps> = ({color}) => (
  <View style={styles.box}>
    <View style={[styles.wheel, {borderColor: color}]}>
      {PALETTE_COLORS.map(hex => (
        <View key={hex} style={[styles.wheelQuarter, {backgroundColor: hex}]} />
      ))}
    </View>
  </View>
);

// A signpost: pole with one sign pointing right and one pointing left.
const Signpost: React.FC<IconProps> = ({color}) => (
  <View style={styles.box}>
    <View style={[styles.pole, {backgroundColor: color}]} />
    <View style={[styles.sign, styles.signRight, {borderColor: color}]} />
    <View style={[styles.sign, styles.signLeft, {borderColor: color}]} />
  </View>
);

// An eighth note: tilted filled head, stem, and a flag sloping off the top.
const Note: React.FC<IconProps> = ({color}) => (
  <View style={styles.box}>
    <View style={[styles.noteHead, {backgroundColor: color}]} />
    <View style={[styles.noteStem, {backgroundColor: color}]} />
    <View style={[styles.noteFlag, {backgroundColor: color}]} />
  </View>
);

// A closed book with a filled spine and a cross on the cover.
const Bible: React.FC<IconProps> = ({color}) => (
  <View style={styles.box}>
    <View style={[styles.bibleCover, {borderColor: color}]} />
    <View style={[styles.bibleSpine, {backgroundColor: color}]} />
    <View style={[styles.bibleCrossV, {backgroundColor: color}]} />
    <View style={[styles.bibleCrossH, {backgroundColor: color}]} />
  </View>
);

// The Bible's closed book with "Aa" on the cover instead of the cross: the
// usual mark of a dictionary, and unlike search's magnifier.
const Dictionary: React.FC<IconProps> = ({color}) => (
  <View style={styles.box}>
    <View style={[styles.bibleCover, {borderColor: color}]} />
    <View style={[styles.bibleSpine, {backgroundColor: color}]} />
    <Text style={[styles.dictionaryLetters, {color}]} allowFontScaling={false}>
      Aa
    </Text>
  </View>
);

// Trash can: handle, lid, open-topped body with two ribs.
const Trash: React.FC<IconProps> = ({color}) => (
  <View style={styles.box}>
    <View style={[styles.trashHandle, {borderColor: color}]} />
    <View style={[styles.trashLid, {backgroundColor: color}]} />
    <View style={[styles.trashBody, {borderColor: color}]} />
    <View style={[styles.trashRib, styles.trashRibLeft, {backgroundColor: color}]} />
    <View style={[styles.trashRib, styles.trashRibRight, {backgroundColor: color}]} />
  </View>
);

const ICONS: Record<MenuIconName, React.FC<IconProps>> = {
  heart: Heart,
  history: History,
  notes: Notes,
  hands: Hands,
  book: Book,
  bubble: Bubble,
  bell: Bell,
  palette: Palette,
  signpost: Signpost,
  note: Note,
  bible: Bible,
  dictionary: Dictionary,
  trash: Trash,
};

export const MenuIcon: React.FC<IconProps & {name: MenuIconName}> = ({name, color}) => {
  const Icon = ICONS[name];
  return <Icon color={color} />;
};

const CLOCK = 20;
const WHEEL = 22;

const styles = StyleSheet.create({
  box: {width: SIZE, height: SIZE},

  clockRing: {
    position: 'absolute',
    left: (SIZE - CLOCK) / 2,
    top: (SIZE - CLOCK) / 2,
    width: CLOCK,
    height: CLOCK,
    borderRadius: CLOCK / 2,
    borderWidth: STROKE,
  },
  // Hour hand points up from the centre, minute hand to the right.
  clockHour: {position: 'absolute', left: SIZE / 2 - STROKE / 2, top: 6, width: STROKE, height: 7, borderRadius: 1},
  clockMinute: {position: 'absolute', left: SIZE / 2 - STROKE / 2, top: SIZE / 2 - STROKE / 2, width: 7, height: STROKE, borderRadius: 1},

  page: {
    position: 'absolute',
    left: 2,
    top: 1,
    width: 15,
    height: 20,
    borderWidth: STROKE,
    borderRadius: 3,
    paddingHorizontal: 2,
    paddingTop: 3,
    gap: 2.5,
  },
  pageLine: {height: STROKE, borderRadius: 1},
  pageLineShort: {width: 4},
  pencil: {
    position: 'absolute',
    left: 14,
    top: 8,
    width: 4,
    height: 13,
    borderRadius: 1,
    transform: [{rotate: '40deg'}],
  },
  pencilTip: {
    position: 'absolute',
    left: 9.5,
    top: 19.5,
    width: 0,
    height: 0,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{rotate: '40deg'}],
  },


  bookPage: {position: 'absolute', top: 4, width: 11, height: 16, borderWidth: STROKE},
  bookPageLeft: {left: 1, borderTopLeftRadius: 3, borderBottomLeftRadius: 3},
  bookPageRight: {right: 1, borderTopRightRadius: 3, borderBottomRightRadius: 3},

  bubble: {position: 'absolute', left: 1, top: 3, width: 22, height: 15, borderRadius: 5, borderWidth: STROKE},
  bubbleTail: {position: 'absolute', left: 5, top: 15, width: 6, height: 6, transform: [{rotate: '45deg'}]},

  bellDome: {
    position: 'absolute',
    left: 5,
    top: 2,
    width: 14,
    height: 15,
    borderWidth: STROKE,
    borderBottomWidth: 0,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  bellRim: {position: 'absolute', left: 2, top: 17, width: 20, height: STROKE, borderRadius: 1},
  bellClapper: {position: 'absolute', left: SIZE / 2 - 2, top: 19, width: 4, height: 4, borderRadius: 2},

  wheel: {
    position: 'absolute',
    left: (SIZE - WHEEL) / 2,
    top: (SIZE - WHEEL) / 2,
    width: WHEEL,
    height: WHEEL,
    borderRadius: WHEEL / 2,
    borderWidth: STROKE,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wheelQuarter: {width: '50%', height: '50%'},

  pole: {position: 'absolute', left: SIZE / 2 - 1, top: 2, width: STROKE, height: 21},
  sign: {position: 'absolute', width: 10, height: 7, borderWidth: STROKE, borderRadius: 2},
  signRight: {left: SIZE / 2 + 1, top: 3},
  signLeft: {left: SIZE / 2 - 11, top: 11},

  noteHead: {position: 'absolute', left: 4, top: 15, width: 10, height: 7, borderRadius: 5, transform: [{rotate: '-20deg'}]},
  noteStem: {position: 'absolute', left: 12, top: 3, width: STROKE, height: 16},
  noteFlag: {position: 'absolute', left: 12, top: 5, width: 8, height: 3, borderRadius: 1, transform: [{rotate: '35deg'}]},

  bibleCover: {position: 'absolute', left: 4, top: 2, width: 17, height: 20, borderWidth: STROKE, borderRadius: 2},
  bibleSpine: {position: 'absolute', left: 4, top: 2, width: 4, height: 20, borderTopLeftRadius: 2, borderBottomLeftRadius: 2},
  bibleCrossV: {position: 'absolute', left: 13, top: 6, width: STROKE, height: 10},
  bibleCrossH: {position: 'absolute', left: 10.5, top: 8.5, width: 7, height: STROKE},
  // Centred in the cover between the spine (x 8) and the right edge (x 19).
  dictionaryLetters: {
    position: 'absolute',
    left: 8,
    top: 6,
    width: 11,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: -0.3,
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
  },

  trashHandle: {position: 'absolute', left: 9, top: 2, width: 6, height: 4, borderWidth: STROKE, borderBottomWidth: 0, borderTopLeftRadius: 1, borderTopRightRadius: 1},
  trashLid: {position: 'absolute', left: 3, top: 5, width: 18, height: STROKE, borderRadius: 1},
  trashBody: {position: 'absolute', left: 5, top: 8, width: 14, height: 14, borderWidth: STROKE, borderTopWidth: 0, borderBottomLeftRadius: 2, borderBottomRightRadius: 2},
  trashRib: {position: 'absolute', top: 10, width: STROKE, height: 8},
  trashRibLeft: {left: 9},
  trashRibRight: {left: 13},
});
