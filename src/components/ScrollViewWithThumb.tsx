import React, {useRef, useState} from 'react';
import {Animated, StyleSheet, View, type ScrollViewProps} from 'react-native';

const INSET = 4;
const MIN_THUMB = 28;

// Thumb height and how far it travels down the track, for a view of
// `viewHeight` showing `contentHeight`; no thumb when everything fits.
export const thumbFor = (viewHeight: number, contentHeight: number) => {
  const track = viewHeight - 2 * INSET;
  if (track <= 0 || contentHeight - viewHeight <= 1) {
    return {height: 0, travel: 0};
  }
  const height = Math.min(track, Math.max(MIN_THUMB, (track * viewHeight) / contentHeight));
  return {height, travel: track - height};
};

type Props = ScrollViewProps & {
  thumbColor: string;
  trackColor: string;
};

// A ScrollView with its own thumb on a track along the right edge, drawn as
// long as the content is taller than the view. The platforms' bars are
// hair-thin (Samsung) or only show mid-scroll (iOS), so a reader couldn't
// tell that more rows sat below.
export const ScrollViewWithThumb = ({
  thumbColor,
  trackColor,
  style,
  children,
  onLayout,
  onContentSizeChange,
  ...rest
}: Props) => {
  const [viewHeight, setViewHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;

  const thumb = thumbFor(viewHeight, contentHeight);
  const translateY = scrollY.interpolate({
    inputRange: [0, Math.max(1, contentHeight - viewHeight)],
    outputRange: [0, thumb.travel],
    extrapolate: 'clamp',
  });

  return (
    <View style={style}>
      <Animated.ScrollView
        {...rest}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {
          useNativeDriver: true,
        })}
        onLayout={e => {
          setViewHeight(e.nativeEvent.layout.height);
          onLayout?.(e);
        }}
        onContentSizeChange={(w, h) => {
          setContentHeight(h);
          onContentSizeChange?.(w, h);
        }}
      >
        {children}
      </Animated.ScrollView>
      {thumb.height > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.track, {backgroundColor: trackColor}]}
        >
          <Animated.View
            style={[
              styles.thumb,
              {
                height: thumb.height,
                backgroundColor: thumbColor,
                transform: [{translateY}],
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  // Sized by its content, shrunk by the parent when that is limited.
  scroll: {flexGrow: 0, flexShrink: 1},
  track: {
    position: 'absolute',
    top: INSET,
    bottom: INSET,
    right: INSET,
    width: 6,
    borderRadius: 3,
  },
  thumb: {width: 6, borderRadius: 3},
});
