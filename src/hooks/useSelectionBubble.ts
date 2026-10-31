import {useCallback, useEffect, useRef, useState, type RefObject} from 'react';
import type {View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {BUBBLE_ARROW, BUBBLE_HEIGHT, BUBBLE_WIDTH} from '../components/HighlightBubble';
import {placeBubble as placeNextToMenu} from '../utils/bubblePlacement';
import type {MarkRange} from '../utils/chapterMarks';
import {
  attachSelectionMenu,
  clearSelection,
  onSelectionChange,
  onTextDoubleTap,
  reportSelection,
  type NativeSelection,
} from '../services/selectionMenu';

const BUBBLE_SIZE = {width: BUBBLE_WIDTH, height: BUBBLE_HEIGHT, arrow: BUBBLE_ARROW};

// The selected words (offsets into the chapter or the hymn) and where the
// highlight bubble sits in the reader.
export type BubbleState = {
  range: MarkRange;
  left: number;
  top: number;
  arrowX: number;
  below: boolean;
};

// One selectable text of the reader, under the key the reader drew it with.
export type SelectableEntry<T> = {key: string; instance: unknown; data: T};

type Measurable = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

type Options<T> = {
  enabled: boolean;
  rootRef: RefObject<View | null>;
  // A text's selection as offsets into the chapter or hymn; null when it
  // can't be placed (its passage is gone, nothing selected).
  toRange: (entry: SelectableEntry<T>, selection: NativeSelection) => MarkRange | null;
  // A double-tap on a text, with the character it landed on.
  onDoubleTap: (entry: SelectableEntry<T>, offset: number) => void;
};

// The phone's own word selection on a reader's texts, shared by the Bible
// and hymn readers: each text by its React tag, so an event leads back to the
// text, and the highlight bubble placed by the selected words, on the side the
// phone's own menu (Copy, Translate...) leaves free.
export const useSelectionBubble = <T>({enabled, rootRef, toRange, onDoubleTap}: Options<T>) => {
  const [bubble, setBubble] = useState<BubbleState | null>(null);
  // The top of the screen the system menu may use, under the status bar.
  const safeTop = useSafeAreaInsets().top;
  const texts = useRef(new Map<number, SelectableEntry<T>>());
  // Bumped by every selection event, so a measurement that comes back after a
  // newer event, or after the selection ended, is dropped.
  const selectionSeq = useRef(0);
  // The text whose selection the bubble is for: only its own end hides it.
  const bubbleTag = useRef<number | null>(null);
  // Where that text and the reader sit on screen, measured once per selection
  // (iOS reports every step of a handle drag); forgotten whenever the text
  // could have moved: a scroll, a new size (forgetPlace).
  // `screenY` is the reader's top under the safe top of the screen.
  const origin = useRef<{
    tag: number;
    x: number;
    y: number;
    width: number;
    height: number;
    screenY: number;
  } | null>(null);
  // Read at event time, so the subscriptions stay put.
  const latest = useRef({toRange, onDoubleTap, safeTop});
  latest.current = {toRange, onDoubleTap, safeTop};

  // Registers the text drawn under `key`, or forgets it (no instance): its
  // selection, and the bubble over it, go with it. Returns its tag.
  const register = useCallback((key: string, instance: unknown, data: T): number | null => {
    for (const [tag, entry] of texts.current) {
      if (entry.key !== key) continue;
      texts.current.delete(tag);
      reportSelection(tag, false);
      if (bubbleTag.current === tag) {
        bubbleTag.current = null;
        origin.current = null;
        setBubble(null);
      }
    }
    if (!instance) return null;
    const tag = attachSelectionMenu(instance);
    if (tag != null) texts.current.set(tag, {key, instance, data});
    return tag;
  }, []);

  const forgetPlace = useCallback(() => {
    origin.current = null;
  }, []);

  // Ends the selection and the bubble, once a colour or style is applied.
  const dismiss = useCallback(() => {
    clearSelection();
    setBubble(null);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const showBubble = (range: MarkRange, selection: NativeSelection) => {
      const place = origin.current;
      if (!place) return;
      setBubble({
        range,
        ...placeNextToMenu(
          {
            // The selection in the reader, from its text's top-left.
            x: place.x + selection.x,
            top: place.y + selection.top,
            bottom: place.y + selection.bottom,
            readerTopOnScreen: place.screenY,
            readerWidth: place.width,
            readerHeight: place.height,
          },
          BUBBLE_SIZE,
        ),
      });
    };

    const placeBubble = (tag: number, selection: NativeSelection | null) => {
      // A late end from another text (say the one selected before) leaves
      // this selection's bubble alone.
      if (!selection && tag !== bubbleTag.current) return;
      const seq = ++selectionSeq.current;
      bubbleTag.current = selection ? tag : null;
      const entry = selection ? texts.current.get(tag) : undefined;
      const range = selection && entry ? latest.current.toRange(entry, selection) : null;
      if (!selection || !entry || !range) {
        if (!selection) origin.current = null;
        setBubble(null);
        return;
      }
      if (origin.current?.tag === tag) {
        showBubble(range, selection);
        return;
      }
      (entry.instance as Measurable).measureInWindow((textX, textY) => {
        rootRef.current?.measureInWindow((rootX, rootY, rootWidth, rootHeight) => {
          // Kept while the selection lasts, even when a newer step of the
          // drag arrived meanwhile; only the bubble for an old step is dropped.
          if (bubbleTag.current !== tag) return;
          origin.current = {
            tag,
            x: textX - rootX,
            y: textY - rootY,
            width: rootWidth,
            height: rootHeight,
            screenY: rootY - latest.current.safeTop,
          };
          if (seq === selectionSeq.current) showBubble(range, selection);
        });
      });
    };

    const stopSelection = onSelectionChange(placeBubble);
    const doubleTaps = onTextDoubleTap(({tag, offset}) => {
      const entry = texts.current.get(tag);
      if (entry) latest.current.onDoubleTap(entry, offset);
    });
    return () => {
      stopSelection();
      doubleTaps?.remove();
    };
  }, [enabled, rootRef]);

  return {bubble, texts, register, forgetPlace, dismiss};
};
