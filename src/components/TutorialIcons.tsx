// Quest-log icons for the Toro-lalana screen, drawn from plain Views the same
// way MoonIcon is in ToggleThemeButton — no icon library, no native rebuild.
// `backgroundColor` must match the surface behind the icon: the cutout pieces
// (rocket window, church door) are painted with it rather than being real holes.
import React from 'react';
import {StyleSheet, View} from 'react-native';

export type TutorialIconName = 'rocket' | 'church' | 'highlighter';

// Cutout pieces (rocket window, church door) are painted with the surface
// colour rather than being real holes, so callers pass both.
type ShapeProps = {
  color: string;
  backgroundColor: string;
};

// NOTE: geometry is hardcoded to a 28px box (the one size the quest log
// uses). Parameterise on size if a second caller ever needs another.
const SIZE = 28;

const Rocket: React.FC<ShapeProps> = ({color, backgroundColor}) => (
  <View style={styles.box}>
    <View style={[styles.rocketFinLeft, {borderBottomColor: color}]} />
    <View style={[styles.rocketFinRight, {borderBottomColor: color}]} />
    <View style={[styles.rocketBody, {backgroundColor: color}]} />
    <View style={[styles.rocketWindow, {backgroundColor}]} />
    <View style={[styles.rocketFlame, {backgroundColor: color}]} />
  </View>
);

const Church: React.FC<ShapeProps> = ({color, backgroundColor}) => (
  <View style={styles.box}>
    <View style={[styles.crossStem, {backgroundColor: color}]} />
    <View style={[styles.crossArm, {backgroundColor: color}]} />
    <View style={[styles.churchRoof, {borderBottomColor: color}]} />
    <View style={[styles.churchBody, {backgroundColor: color}]} />
    <View style={[styles.churchDoor, {backgroundColor}]} />
  </View>
);

const Highlighter: React.FC<ShapeProps> = ({color, backgroundColor}) => (
  <View style={styles.box}>
    <View style={[styles.penStroke, {backgroundColor: color}]} />
    <View style={styles.penGroup}>
      <View style={[styles.penBarrel, {backgroundColor: color}]} />
      <View style={[styles.penCollar, {backgroundColor}]} />
      <View style={[styles.penTip, {borderTopColor: color}]} />
    </View>
  </View>
);

const ICONS: Record<TutorialIconName, React.FC<ShapeProps>> = {
  rocket: Rocket,
  church: Church,
  highlighter: Highlighter,
};

export const TutorialIcon: React.FC<ShapeProps & {name: TutorialIconName}> = ({
  name,
  ...colors
}) => {
  const Icon = ICONS[name];
  return <Icon {...colors} />;
};

// Upward triangle via the standard RN transparent-border trick — the colored
// edge is set by the caller so the shape can follow the accent.
const upTriangle = (halfBase: number, height: number) => ({
  width: 0,
  height: 0,
  borderLeftWidth: halfBase,
  borderRightWidth: halfBase,
  borderBottomWidth: height,
  borderLeftColor: 'transparent',
  borderRightColor: 'transparent',
  backgroundColor: 'transparent',
});

const styles = StyleSheet.create({
  box: {
    width: SIZE,
    height: SIZE,
  },

  rocketBody: {
    position: 'absolute',
    left: 9,
    top: 1,
    width: 10,
    height: 19,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  rocketWindow: {
    position: 'absolute',
    left: 11,
    top: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rocketFinLeft: {
    ...upTriangle(4, 9),
    position: 'absolute',
    left: 2,
    top: 11,
    transform: [{rotate: '-18deg'}],
  },
  rocketFinRight: {
    ...upTriangle(4, 9),
    position: 'absolute',
    right: 2,
    top: 11,
    transform: [{rotate: '18deg'}],
  },
  rocketFlame: {
    position: 'absolute',
    left: 11,
    top: 21,
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.55,
  },

  crossStem: {
    position: 'absolute',
    left: 13,
    top: 0,
    width: 2,
    height: 7,
  },
  crossArm: {
    position: 'absolute',
    left: 11,
    top: 2,
    width: 6,
    height: 2,
  },
  churchRoof: {
    ...upTriangle(11, 9),
    position: 'absolute',
    left: 3,
    top: 7,
  },
  churchBody: {
    position: 'absolute',
    left: 5,
    top: 16,
    width: 18,
    height: 12,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  churchDoor: {
    position: 'absolute',
    left: 11,
    top: 20,
    width: 6,
    height: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },

  penStroke: {
    position: 'absolute',
    left: 3,
    bottom: 1,
    width: 22,
    height: 5,
    borderRadius: 2,
    opacity: 0.35,
  },
  penGroup: {
    position: 'absolute',
    left: 9,
    top: 0,
    width: 10,
    height: 22,
    transform: [{rotate: '32deg'}],
  },
  penBarrel: {
    width: 10,
    height: 14,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  penCollar: {
    width: 10,
    height: 2,
  },
  penTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    backgroundColor: 'transparent',
  },
});
