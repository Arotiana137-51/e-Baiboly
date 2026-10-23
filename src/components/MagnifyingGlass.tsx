import React from 'react';
import {StyleSheet, View} from 'react-native';

// Simple View-drawn magnifier, no icon lib: the lens and a handle at 45°.
// Shared by the search fields (global search, dictionary).
export const MagnifyingGlass = ({color, size = 18}: {color: string; size?: number}) => (
  <View style={{width: size, height: size}}>
    <View style={[styles.lens, {borderColor: color, width: size * 0.8, height: size * 0.8}]} />
    <View
      style={[
        styles.handle,
        {
          backgroundColor: color,
          width: size * 0.3,
          height: size * 0.15,
          bottom: -size * 0.05,
          right: -size * 0.05,
        },
      ]}
    />
  </View>
);

const styles = StyleSheet.create({
  lens: {position: 'absolute', top: 0, left: 0, borderWidth: 2, borderRadius: 50},
  handle: {position: 'absolute', borderRadius: 2, transform: [{rotate: '45deg'}]},
});
