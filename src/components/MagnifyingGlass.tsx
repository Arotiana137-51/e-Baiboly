import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';

// Simple View-drawn magnifier, no icon lib: the lens and a handle at 45°.
// Shared by the search fields (global search, dictionary).
export const MagnifyingGlass = ({color, size = 18}: {color: string; size?: number}) => {
  const sized = useMemo(
    () =>
      StyleSheet.create({
        box: {width: size, height: size},
        lens: {borderColor: color, width: size * 0.8, height: size * 0.8},
        handle: {
          backgroundColor: color,
          width: size * 0.3,
          height: size * 0.15,
          bottom: -size * 0.05,
          right: -size * 0.05,
        },
      }),
    [color, size],
  );
  return (
    <View style={sized.box}>
      <View style={[styles.lens, sized.lens]} />
      <View style={[styles.handle, sized.handle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  lens: {position: 'absolute', top: 0, left: 0, borderWidth: 2, borderRadius: 50},
  handle: {position: 'absolute', borderRadius: 2, transform: [{rotate: '45deg'}]},
});
