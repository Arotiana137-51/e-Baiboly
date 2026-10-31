// Where the highlight bubble goes over a selection, next to the phone's own
// selection menu (Copy, Translate, Share...), which stays on screen with it.
// Neither Android's floating toolbar nor the iOS edit menu can be told where to
// go: both sit above the selection when there is room under the top of the
// screen, else just under it. The bubble takes the side the menu leaves free.

// Room for the system menu with its margins: Android's toolbar is 48dp tall
// with 8dp above and under it, iOS's edit menu a little less with its arrow.
export const SYSTEM_MENU_ROOM = 64;
// Room under a selection for Android's handles.
export const HANDLE_ROOM = 30;
export const BUBBLE_MARGIN = 8;
// Between the bubble's arrow and the words it points at.
const ARROW_GAP = 4;

export type BubbleSize = {width: number; height: number; arrow: number};

export type PlacementInput = {
  // The selected words in the reader: the middle of their line, their top and
  // bottom, in dp from the reader's top-left.
  x: number;
  top: number;
  bottom: number;
  // How far the reader's top is under the top of the screen the system menu
  // may use (below the status bar / notch).
  readerTopOnScreen: number;
  readerWidth: number;
  readerHeight: number;
};

export type Placement = {
  left: number;
  top: number;
  arrowX: number;
  // Under the selection rather than above it: the arrow points up.
  below: boolean;
};

// Whether the system menu goes above the selection (it has the room there).
export const systemMenuAbove = (selectionTopOnScreen: number): boolean =>
  selectionTopOnScreen >= SYSTEM_MENU_ROOM;

export const placeBubble = (input: PlacementInput, size: BubbleSize): Placement => {
  const {x, top, bottom, readerTopOnScreen, readerWidth, readerHeight} = input;
  const menuAbove = systemMenuAbove(readerTopOnScreen + top);

  // Under the words, clear of the handles; under the menu too when it went
  // below them.
  const underTop = bottom + HANDLE_ROOM + (menuAbove ? 0 : SYSTEM_MENU_ROOM);
  const fitsUnder = underTop + size.height <= readerHeight - BUBBLE_MARGIN;
  // Over the words, and over the menu when it is there.
  const overTop = top - size.arrow / 2 - ARROW_GAP - size.height - (menuAbove ? SYSTEM_MENU_ROOM : 0);
  const fitsOver = overTop >= BUBBLE_MARGIN;

  // Under first: the menu usually takes the space above. With room on
  // neither side (a selection as tall as the reader), under, kept in view.
  const below = fitsUnder || !fitsOver;
  const rawTop = below ? underTop : overTop;
  const left = Math.min(
    Math.max(x - size.width / 2, BUBBLE_MARGIN),
    readerWidth - size.width - BUBBLE_MARGIN,
  );
  return {
    left,
    top: Math.max(BUBBLE_MARGIN, Math.min(rawTop, readerHeight - size.height - BUBBLE_MARGIN)),
    arrowX: Math.min(Math.max(x - left, 18), size.width - 18),
    below,
  };
};
