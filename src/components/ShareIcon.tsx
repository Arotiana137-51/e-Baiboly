// The Feather "share-2" glyph (three hollow circles joined by two strokes),
// drawn from plain Views like TutorialIcons — no icon library, no native
// rebuild. Geometry is the SVG's 24-unit viewBox scaled to SIZE:
//   circles r=3 at (18,5) (6,12) (18,19), stroke 2, round caps
//   lines (8.59,13.51)-(15.42,17.49) and (15.41,6.51)-(8.59,10.49)
import React from 'react';
import {StyleSheet, View} from 'react-native';

// ponytail: fixed 22px box, the one size the editor toolbar uses. Parameterise
// on size if a second caller ever needs another.
const SIZE = 22;
const UNIT = SIZE / 24;
const STROKE = 2 * UNIT;
const CIRCLE = 8 * UNIT; // r=3 plus half the stroke on each side

const circleAt = (cx: number, cy: number) => ({
  left: cx * UNIT - CIRCLE / 2,
  top: cy * UNIT - CIRCLE / 2,
});

// A stroke between two SVG points: a thin View centred on the midpoint,
// rotated about its centre.
const lineBetween = (x1: number, y1: number, x2: number, y2: number) => {
  const length = Math.hypot(x2 - x1, y2 - y1) * UNIT;
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return {
    width: length,
    left: ((x1 + x2) / 2) * UNIT - length / 2,
    top: ((y1 + y2) / 2) * UNIT - STROKE / 2,
    transform: [{rotate: `${angle}deg`}],
  };
};

export const ShareIcon = ({color}: {color: string}) => (
  <View style={styles.box}>
    <View style={[styles.line, styles.lineDown, {backgroundColor: color}]} />
    <View style={[styles.line, styles.lineUp, {backgroundColor: color}]} />
    <View style={[styles.circle, styles.circleTop, {borderColor: color}]} />
    <View style={[styles.circle, styles.circleLeft, {borderColor: color}]} />
    <View style={[styles.circle, styles.circleBottom, {borderColor: color}]} />
  </View>
);

const styles = StyleSheet.create({
  box: {
    width: SIZE,
    height: SIZE,
  },
  circle: {
    position: 'absolute',
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: STROKE,
  },
  circleTop: circleAt(18, 5),
  circleLeft: circleAt(6, 12),
  circleBottom: circleAt(18, 19),
  line: {
    position: 'absolute',
    height: STROKE,
    borderRadius: STROKE / 2,
  },
  lineDown: lineBetween(8.59, 13.51, 15.42, 17.49),
  lineUp: lineBetween(8.59, 10.49, 15.41, 6.51),
});
