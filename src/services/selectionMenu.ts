import {
  type EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  Platform,
  findNodeHandle,
} from 'react-native';
import type {TextLine} from '../utils/chapterPassage';

// The phone's own text selection on the reader's passages (native module
// SelectionMenu): long-press a word, then drag the handles. The system menu
// stays empty and the app shows its own highlight bubble instead; a double-tap
// is kept for the app's verse menu. On iOS the selectable text is the
// UITextView of @bsky.app/react-native-uitextview: a React Native <Text>
// there can only copy its whole text.

const {SelectionMenu} = NativeModules;
const emitter = SelectionMenu ? new NativeEventEmitter(SelectionMenu) : null;

// iOS 15 has no way for the app to empty the system menu, which would sit on
// top of the bubble: it keeps the app's own double-tap / long-press menus, as
// does a build without the module (or Jest).
const IOS_TOO_OLD = Platform.OS === 'ios' && parseFloat(String(Platform.Version)) < 16;

// True where the reader uses native selection.
export const NATIVE_SELECTION = !!SelectionMenu?.attach && !IOS_TOO_OLD;

// A selection on screen. `start`/`end` index the whole <Text> it is in;
// x / top / bottom are dp from that Text's top-left.
export type NativeSelection = {
  tag: number;
  start: number;
  end: number;
  x: number;
  top: number;
  bottom: number;
};

// Hooks one selectable text; returns its tag so the caller can tell which text
// an event came from. Missing module: no-op.
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

// Each change of a text's selection, and null once that text's selection
// ends (by tag: a late end from one text says nothing of another's).
export const onSelectionChange = (
  listener: (tag: number, selection: NativeSelection | null) => void,
): (() => void) => {
  const shown = emitter?.addListener('SelectionMenuShown', (selection: NativeSelection) =>
    listener(selection.tag, selection),
  );
  const hidden = emitter?.addListener('SelectionMenuHidden', ({tag}: {tag: number}) =>
    listener(tag, null),
  );
  return () => {
    shown?.remove();
    hidden?.remove();
  };
};

// A double-tap on a selectable text, with the character it landed on.
export const onTextDoubleTap = (
  listener: (tap: {tag: number; offset: number}) => void,
): EmitterSubscription | null => emitter?.addListener('SelectionMenuDoubleTap', listener) ?? null;

// iOS: the library's onTextLayout doesn't say where its lines sit, so the
// native module sends them after each layout. Kept for the last few texts, so
// a reader registering a text after its layout still gets them; subscribed
// here at load so none is missed.
const LINES_KEPT = 24;
const linesByTag = new Map<number, TextLine[]>();
const linesListeners = new Set<(tag: number, lines: TextLine[]) => void>();
if (Platform.OS === 'ios') {
  emitter?.addListener('SelectionMenuLines', ({tag, lines}: {tag: number; lines: TextLine[]}) => {
    linesByTag.delete(tag);
    linesByTag.set(tag, lines);
    if (linesByTag.size > LINES_KEPT) {
      linesByTag.delete(linesByTag.keys().next().value as number);
    }
    linesListeners.forEach(listener => listener(tag, lines));
  });
}

export const onTextLines = (listener: (tag: number, lines: TextLine[]) => void): (() => void) => {
  linesListeners.add(listener);
  return () => {
    linesListeners.delete(listener);
  };
};

export const textLinesFor = (tag: number): TextLine[] | undefined => linesByTag.get(tag);

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

// Whether some text is selected, from its first word until it is cleared,
// e.g. to pause swipes that would fight the handles.
export const onSelectionActive = (listener: (active: boolean) => void): (() => void) => {
  selectionListeners.add(listener);
  const stop = onSelectionChange((tag, selection) => reportSelection(tag, selection != null));
  return () => {
    selectionListeners.delete(listener);
    stop();
  };
};
