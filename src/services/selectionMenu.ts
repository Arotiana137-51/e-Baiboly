import type {SelectionChangeEvent} from '@bsky.app/react-native-uitextview';
import {
  type EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  Platform,
  findNodeHandle,
} from 'react-native';

// The phone's own text selection on the reader's verses (native module
// SelectionMenu): long-press a word, then drag the handles. The system menu
// stays empty and the app shows its own highlight bubble instead; a double-tap
// is kept for the app's verse menu.

const {SelectionMenu} = NativeModules;
const emitter = SelectionMenu ? new NativeEventEmitter(SelectionMenu) : null;

// True where the reader uses native selection. Android only for now: iOS
// keeps the app's own double-tap / long-press menus.
export const NATIVE_SELECTION = Platform.OS === 'android' && !!SelectionMenu?.attach;

// A selection on screen. `start`/`end` index the verse's whole <Text> (title
// and number included); x / top / bottom are dp from that Text's top-left.
export type NativeSelection = {
  tag: number;
  start: number;
  end: number;
  x: number;
  top: number;
  bottom: number;
};

// Hooks one selectable text; returns its tag so the caller can tell which text
// an event came from. Missing module (Jest, stale build): no-op.
export const attachSelectionMenu = (instance: unknown): number | null => {
  if (!NATIVE_SELECTION || instance == null) return null;
  const tag = findNodeHandle(instance as Parameters<typeof findNodeHandle>[0]);
  if (tag == null) return null;
  SelectionMenu.attach(tag);
  return tag;
};

// Ends the selection on screen, if any.
export const clearSelection = (): void => {
  SelectionMenu?.clearSelection?.();
};

// Each change of the selection on screen, and null once it ends.
export const onSelectionChange = (
  listener: (selection: NativeSelection | null) => void,
): (() => void) => {
  const shown = emitter?.addListener('SelectionMenuShown', listener);
  const hidden = emitter?.addListener('SelectionMenuHidden', () => listener(null));
  return () => {
    shown?.remove();
    hidden?.remove();
  };
};

export const onVerseDoubleTap = (listener: (tag: number) => void): EmitterSubscription | null =>
  emitter?.addListener('SelectionMenuDoubleTap', ({tag}) => listener(tag)) ?? null;

const selectedTags = new Set<number>();
const selectionListeners = new Set<(active: boolean) => void>();

// One text's selection started (active) or was cleared. Also called when a
// text unmounts, so a selection that never got cleared can't stick.
export const reportSelection = (tag: number, active: boolean): void => {
  const wasActive = selectedTags.size > 0;
  if (active) {
    selectedTags.add(tag);
  } else {
    selectedTags.delete(tag);
  }
  const isActive = selectedTags.size > 0;
  if (isActive !== wasActive) {
    selectionListeners.forEach(listener => listener(isActive));
  }
};

// iOS: the text views report each selection change themselves.
export const onTextSelectionChange = ({nativeEvent}: SelectionChangeEvent): void =>
  reportSelection(nativeEvent.target, nativeEvent.end > nativeEvent.start);

// Whether some text is selected, from its first word until it is cleared,
// e.g. to pause swipes that would fight the handles. Android's action mode
// lives exactly that long; iOS hides its menu while a handle is dragged, so
// there the text views report their selection instead.
export const onSelectionActive = (listener: (active: boolean) => void): (() => void) => {
  selectionListeners.add(listener);
  const subscriptions =
    Platform.OS === 'android'
      ? [
          emitter?.addListener('SelectionMenuShown', ({tag}) => reportSelection(tag, true)),
          emitter?.addListener('SelectionMenuHidden', ({tag}) => reportSelection(tag, false)),
        ]
      : [];
  return () => {
    selectionListeners.delete(listener);
    subscriptions.forEach(subscription => subscription?.remove());
  };
};
