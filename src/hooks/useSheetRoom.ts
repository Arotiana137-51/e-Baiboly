import {useCallback, useLayoutEffect, useRef, useState, type MutableRefObject} from 'react';
import type {NativeScrollEvent, NativeSyntheticEvent} from 'react-native';

// Room under a reader's text for the action sheet, so even the last verse or
// stanza can rise above it. When the sheet closes, the part the reader is
// scrolled into stays (taking it away would make the text jump); the end of
// each later scroll gives back what is out of view. The reader keeps its
// scroll offset, viewport and content heights in the refs given; scroll ends
// note the offset here.
export const useSheetRoom = (
  sheetHeight: number,
  scrollY: MutableRefObject<number>,
  viewportHeight: MutableRefObject<number>,
  contentHeight: MutableRefObject<number>,
) => {
  const [sheetRoom, setSheetRoom] = useState(0);
  const sheetOpen = useRef(false);
  const roomInView = useCallback(
    (room: number) =>
      Math.min(room, Math.max(0, Math.ceil(scrollY.current + viewportHeight.current - (contentHeight.current - room)))),
    [scrollY, viewportHeight, contentHeight],
  );

  // A layout effect: the room must be set before its size change comes back
  // from the native side.
  useLayoutEffect(() => {
    sheetOpen.current = sheetHeight > 0;
    setSheetRoom(room => sheetHeight || roomInView(room));
  }, [sheetHeight, roomInView]);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = e.nativeEvent.contentOffset.y;
      if (!sheetOpen.current) setSheetRoom(roomInView);
    },
    [scrollY, roomInView],
  );

  return {sheetRoom, onScrollEnd};
};
