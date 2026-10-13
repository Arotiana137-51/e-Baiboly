// Icons for the hamburger menu's quick row (Ankafizina / Tsiahy / Naoty),
// drawn from plain Views like TutorialIcons and ShareIcon — no icon library,
// no native rebuild.
import React from 'react';
import {StyleSheet, View} from 'react-native';

export type MenuIconName = 'heart' | 'history' | 'notes';

// NOTE: geometry is hardcoded to a 22px box (the one size the quick row
// uses). Parameterise on size if a second caller ever needs another.
const SIZE = 22;
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

// A page with three ruled lines.
const Notes: React.FC<IconProps> = ({color}) => (
  <View style={styles.box}>
    <View style={[styles.page, {borderColor: color}]}>
      <View style={[styles.pageLine, {backgroundColor: color}]} />
      <View style={[styles.pageLine, {backgroundColor: color}]} />
      <View style={[styles.pageLine, styles.pageLineShort, {backgroundColor: color}]} />
    </View>
  </View>
);

const ICONS: Record<MenuIconName, React.FC<IconProps>> = {
  heart: Heart,
  history: History,
  notes: Notes,
};

export const MenuIcon: React.FC<IconProps & {name: MenuIconName}> = ({name, color}) => {
  const Icon = ICONS[name];
  return <Icon color={color} />;
};

const LOBE = 11;
const CLOCK = 18;

const styles = StyleSheet.create({
  box: {width: SIZE, height: SIZE},
  heartLobe: {position: 'absolute', top: 3, width: LOBE, height: LOBE, borderRadius: LOBE / 2},
  heartLobeLeft: {left: 1},
  heartLobeRight: {right: 1},
  heartPoint: {
    position: 'absolute',
    left: (SIZE - 11) / 2,
    top: 6.5,
    width: 11,
    height: 11,
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
  clockHour: {position: 'absolute', left: SIZE / 2 - STROKE / 2, top: 6, width: STROKE, height: 6, borderRadius: 1},
  clockMinute: {position: 'absolute', left: SIZE / 2 - STROKE / 2, top: SIZE / 2 - STROKE / 2, width: 6, height: STROKE, borderRadius: 1},
  page: {
    position: 'absolute',
    left: 3,
    top: 1,
    width: 16,
    height: 20,
    borderWidth: STROKE,
    borderRadius: 3,
    paddingHorizontal: 2,
    paddingTop: 3,
    gap: 2.5,
  },
  pageLine: {height: STROKE, borderRadius: 1},
  pageLineShort: {width: 5},
});
