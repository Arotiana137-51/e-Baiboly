// Icons for the hamburger menu's grid, drawn from plain Views like
// TutorialIcons and ShareIcon — no icon library, no native rebuild. Each is
// a single colour with no cut-outs, so it reads on any cell background.
import React from 'react';
import {StyleSheet, View} from 'react-native';

export type MenuIconName =
  | 'heart'
  | 'history'
  | 'notes'
  | 'church'
  | 'book'
  | 'bubble'
  | 'bell'
  | 'drop'
  | 'signpost';

// NOTE: geometry is hardcoded to a 24px box (the one size the menu grid
// uses). Parameterise on size if a second caller ever needs another.
const SIZE = 24;
const STROKE = 2;

type IconProps = {color: string};

// Classic two-lobe heart: two circles over a square turned 45°.
const Heart: React.FC<IconProps> = ({color}) => (
  <View style={styles.box}>
    <View style={[styles.heartLobe, styles.heartLobeLeft, {backgroundColor: color}]} />
    <View style={[styles.heartLobe, styles.heartLobeRight, {backgroundColor: color}]} />
    <View style={[styles.heartPoint, {backgroundColor: color}]} />
  </View>
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

// Cross, triangular roof and an outlined nave.
const Church: React.FC<IconProps> = ({color}) => (
  <View style={styles.box}>
    <View style={[styles.crossStem, {backgroundColor: color}]} />
    <View style={[styles.crossArm, {backgroundColor: color}]} />
    <View style={[styles.churchRoof, {borderBottomColor: color}]} />
    <View style={[styles.churchBody, {borderColor: color}]} />
  </View>
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

// A drop of colour: a rounded square turned 45° with one sharp corner up.
const Drop: React.FC<IconProps> = ({color}) => (
  <View style={styles.box}>
    <View style={[styles.drop, {borderColor: color}]} />
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

const ICONS: Record<MenuIconName, React.FC<IconProps>> = {
  heart: Heart,
  history: History,
  notes: Notes,
  church: Church,
  book: Book,
  bubble: Bubble,
  bell: Bell,
  drop: Drop,
  signpost: Signpost,
};

export const MenuIcon: React.FC<IconProps & {name: MenuIconName}> = ({name, color}) => {
  const Icon = ICONS[name];
  return <Icon color={color} />;
};

const LOBE = 12;
const CLOCK = 20;
const DROP = 13;

const styles = StyleSheet.create({
  box: {width: SIZE, height: SIZE},

  heartLobe: {position: 'absolute', top: 4, width: LOBE, height: LOBE, borderRadius: LOBE / 2},
  heartLobeLeft: {left: 1},
  heartLobeRight: {right: 1},
  heartPoint: {
    position: 'absolute',
    left: (SIZE - LOBE) / 2,
    top: 7.5,
    width: LOBE,
    height: LOBE,
    transform: [{rotate: '45deg'}],
  },

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

  crossStem: {position: 'absolute', left: SIZE / 2 - 1, top: 0, width: STROKE, height: 7},
  crossArm: {position: 'absolute', left: SIZE / 2 - 3, top: 2, width: 6, height: STROKE},
  churchRoof: {
    position: 'absolute',
    left: 3,
    top: 6,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  churchBody: {position: 'absolute', left: 5, top: 13, width: 14, height: 10, borderWidth: STROKE},

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

  drop: {
    position: 'absolute',
    left: (SIZE - DROP) / 2,
    top: 8,
    width: DROP,
    height: DROP,
    borderWidth: STROKE,
    borderRadius: DROP / 2,
    borderTopLeftRadius: 0,
    transform: [{rotate: '45deg'}],
  },

  pole: {position: 'absolute', left: SIZE / 2 - 1, top: 2, width: STROKE, height: 21},
  sign: {position: 'absolute', width: 10, height: 7, borderWidth: STROKE, borderRadius: 2},
  signRight: {left: SIZE / 2 + 1, top: 3},
  signLeft: {left: SIZE / 2 - 11, top: 11},
});
