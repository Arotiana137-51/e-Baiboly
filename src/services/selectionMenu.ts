import type {SelectionChangeEvent} from '@bsky.app/react-native-uitextview';
import {
  type EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  Platform,
  findNodeHandle,
} from 'react-native';

// The phone's own text-selection menu, with the app's actions added in front
// (native module SelectionMenu). The selection itself, its handles and
// Copy / Translate stay the system's. On iOS the selectable text is the
// UITextView of @bsky.app/react-native-uitextview: a React Native <Text>
// there can only copy its whole text.

export type SelectionMenuItem = {
  key: string;
  label: string;
  // Shown in the menu bar itself; the others go to the top of its overflow.
  primary?: boolean;
};

// `start`/`end` index the whole <Text> the selection is in, not just the
// verse text: callers subtract what comes before it (title, number).
export type SelectionMenuAction = {tag: number; key: string; start: number; end: number};

const {SelectionMenu} = NativeModules;
const emitter = SelectionMenu ? new NativeEventEmitter(SelectionMenu) : null;

// True where the reader uses native selection instead of the app's own
// double-tap / long-press handlers.
export const NATIVE_SELECTION = !!SelectionMenu?.attach;

export const setSelectionMenuItems = (items: SelectionMenuItem[]): void => {
  SelectionMenu?.setItems?.(items);
};

// Hooks one selectable text (on iOS every one already is); returns its tag so
// the caller can tell which text an action came from. Missing module (Jest,
// stale build): no-op.
export const attachSelectionMenu = (instance: unknown): number | null => {
  if (!NATIVE_SELECTION || instance == null) return null;
  const tag = findNodeHandle(instance as Parameters<typeof findNodeHandle>[0]);
  if (tag == null) return null;
  SelectionMenu.attach(tag);
  return tag;
};

export const onSelectionMenuAction = (
  listener: (action: SelectionMenuAction) => void,
): EmitterSubscription | null => emitter?.addListener('SelectionMenuAction', listener) ?? null;

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
