import React from 'react';
import {StyleSheet, View} from 'react-native';

// The margin mark for a verse or stanza that has a note: a small filled
// square with two written lines, drawn from Views like the menu icons.
export const NoteGlyph: React.FC<{color: string; size?: number}> = ({color, size = 12}) => (
  <View
    style={[
      styles.glyph,
      {width: size, height: size, borderRadius: size / 4, paddingLeft: size * 0.2, backgroundColor: color},
    ]}
  >
    <View style={[styles.line, {width: size * 0.55}]} />
    <View style={[styles.line, {width: size * 0.35, marginTop: size * 0.15}]} />
  </View>
);

const styles = StyleSheet.create({
  glyph: {
    justifyContent: 'center',
  },
  line: {
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
});
