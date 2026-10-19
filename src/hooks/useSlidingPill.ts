import {useEffect, useRef, useState} from 'react';
import {LayoutChangeEvent} from 'react-native';
import {Easing, useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';

// Drives the pill that slides behind the selected segment of a toggle.
// `inset` is the track's padding + border width on each side.
export const useSlidingPill = (selectedIndex: number, count: number, inset: number) => {
  const [segmentWidth, setSegmentWidth] = useState(0);
  const translateX = useSharedValue(0);
  const placedWidth = useRef(0);

  useEffect(() => {
    if (segmentWidth === 0) {
      return;
    }
    const target = selectedIndex * segmentWidth;
    // First layout or a resize: jump, so the pill doesn't sweep in on open.
    if (placedWidth.current !== segmentWidth) {
      placedWidth.current = segmentWidth;
      translateX.value = target;
      return;
    }
    // withTiming honours the OS "reduce motion" setting and jumps instead.
    translateX.value = withTiming(target, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [selectedIndex, segmentWidth, translateX]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value}],
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    setSegmentWidth((event.nativeEvent.layout.width - 2 * inset) / count);
  };

  return {segmentWidth, translateX, pillStyle, onLayout};
};
