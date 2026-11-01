import React, {useMemo, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../contexts/ThemeContext';
import {useTutorialTarget} from '../contexts/TutorialContext';
import {dimHighlightForDarkMode, dimHighlightForLightMode} from '../utils/colorUtils';
import {
  applyMarkToRange,
  eraseMarksInRange,
  rangeStyles,
  type ChapterMark,
  type MarkRange,
} from '../utils/chapterMarks';
import {performMenuAction, type MenuAction} from '../services/selectionMenu';
import {t} from '../i18n/strings';

// The pen colours: six of the old editor's twelve, the most distinct ones.
// Highlights already made in the others still show.
export const HIGHLIGHT_COLORS = ['#FFEB3B', '#4CAF50', '#2196F3', '#E91E63', '#FF9800', '#9C27B0'];

export type TextStyleKey = 'bold' | 'italic' | 'underline';

const STYLE_BUTTONS: {style: TextStyleKey; label: string; a11y: 'highlight.bold' | 'highlight.italic' | 'highlight.underline'}[] = [
  {style: 'bold', label: 'B', a11y: 'highlight.bold'},
  {style: 'italic', label: 'I', a11y: 'highlight.italic'},
  {style: 'underline', label: 'U', a11y: 'highlight.underline'},
];

const SWATCH = 30;
const GAP = 8;
const PAD = 10;
const BUTTON = 34;
const ACTIONS = 34;
export const BUBBLE_ARROW = 12;
// Fixed size, so the reader can place the bubble without measuring it first.
// The phone's actions keep their row even before they arrive (iOS sends
// them just after the selection).
export const BUBBLE_WIDTH = PAD * 2 + HIGHLIGHT_COLORS.length * SWATCH + (HIGHLIGHT_COLORS.length - 1) * GAP;
export const BUBBLE_HEIGHT = PAD * 2 + ACTIONS + GAP + SWATCH + GAP + BUTTON;

type Props = {
  // Top-left corner in the reader.
  left: number;
  top: number;
  // Where the arrow points, from the bubble's left edge.
  arrowX: number;
  // Under the selection rather than above it: the arrow points up.
  below: boolean;
  // What the selected words already have, shown as chosen.
  current: {color?: string} & Record<TextStyleKey, boolean>;
  // The phone's own menu items (Copy, Select all, Translate...), as it
  // offers them.
  actions: MenuAction[];
  onAction: (id: number) => void;
  onColor: (color: string) => void;
  onStyle: (style: TextStyleKey) => void;
  onErase: () => void;
};

// The highlighter over selected words, like an infobulle: the phone's own
// actions on top, then a colour, bold, italic, underline, or Fafao to take
// them all off.
export const HighlightBubble = ({
  left,
  top,
  arrowX,
  below,
  current,
  actions,
  onAction,
  onColor,
  onStyle,
  onErase,
}: Props) => {
  const {theme} = useTheme();
  const colorsRef = useTutorialTarget('hlColorPicker');
  const eraseRef = useTutorialTarget('hlEraseBtn');
  const dim = theme.isDark ? dimHighlightForDarkMode : dimHighlightForLightMode;
  const surface = {
    backgroundColor: theme.colors.backgroundSecondary,
    borderColor: theme.colors.divider,
  };

  return (
    // The testID tells SelectionMenu.m (iOS) that a tap here keeps the
    // selection, which any other tap outside the text clears.
    <View testID="highlight-bubble" style={[styles.bubble, surface, {left, top}]}>
      <ActionsRow actions={actions} onAction={onAction} />
      <View ref={colorsRef} collapsable={false} style={[styles.row, styles.colorRow]}>
        {HIGHLIGHT_COLORS.map(color => {
          const chosen = current.color === color;
          return (
            <Pressable
              key={color}
              onPress={() => onColor(color)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={t('highlight.color')}
              accessibilityState={{selected: chosen}}
              style={[
                styles.swatch,
                {backgroundColor: dim(color)},
                chosen && [styles.swatchChosen, {borderColor: theme.colors.textPrimary}],
              ]}
            />
          );
        })}
      </View>
      <View style={[styles.row, styles.styleRow]}>
        {STYLE_BUTTONS.map(({style, label, a11y}) => {
          const on = current[style];
          return (
            <Pressable
              key={style}
              onPress={() => onStyle(style)}
              accessibilityRole="button"
              accessibilityLabel={t(a11y)}
              accessibilityState={{selected: on}}
              style={[
                styles.styleButton,
                {backgroundColor: on ? theme.colors.accentBlue : theme.colors.backgroundTertiary},
              ]}
            >
              <Text
                style={[
                  styles.styleLabel,
                  styles[style],
                  on ? styles.styleLabelOn : {color: theme.colors.textPrimary},
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
        <View ref={eraseRef} collapsable={false} style={styles.eraseWrap}>
          <Pressable
            onPress={onErase}
            accessibilityRole="button"
            style={[styles.eraseButton, {backgroundColor: theme.colors.backgroundTertiary}]}
          >
            <Text style={[styles.eraseLabel, {color: theme.colors.textPrimary}]}>
              {t('highlight.erase')}
            </Text>
          </Pressable>
        </View>
      </View>
      {/* The point aimed at the selected words, over the bubble's border. */}
      <View
        style={[
          styles.arrow,
          below ? styles.arrowUp : styles.arrowDown,
          surface,
          {left: arrowX - BUBBLE_ARROW / 2},
        ]}
      />
    </View>
  );
};

// The phone's actions in one row. When they don't all fit, a ‹ or › at the
// edge shows there are more that way, as the phone's own menu does; a tap
// on it turns the row by most of its width.
const ActionsRow = ({actions, onAction}: Pick<Props, 'actions' | 'onAction'>) => {
  const {theme} = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [x, setX] = useState(0);
  const [viewWidth, setViewWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const more = {left: x > 1, right: x + viewWidth < contentWidth - 1};
  const turn = (direction: 1 | -1) => {
    const to = Math.min(Math.max(x + direction * viewWidth * 0.8, 0), contentWidth - viewWidth);
    scrollRef.current?.scrollTo({x: to, animated: true});
  };
  const arrow = (side: 'left' | 'right') =>
    more[side] ? (
      <Pressable
        onPress={() => turn(side === 'left' ? -1 : 1)}
        hitSlop={4}
        // The row itself scrolls for a screen reader.
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[styles.more, side === 'left' ? styles.moreLeft : styles.moreRight, {backgroundColor: theme.colors.backgroundSecondary}]}
      >
        <Text style={[styles.moreLabel, {color: theme.colors.textSecondary}]}>{side === 'left' ? '‹' : '›'}</Text>
      </Pressable>
    ) : null;

  return (
    <View style={[styles.actions, {borderColor: theme.colors.divider}]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={event => setX(event.nativeEvent.contentOffset.x)}
        onLayout={event => setViewWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={width => setContentWidth(width)}
        contentContainerStyle={styles.actionsContent}
      >
        {actions.map(action => (
          <Pressable
            key={action.id}
            onPress={() => onAction(action.id)}
            accessibilityRole="button"
            style={({pressed}) => [
              styles.action,
              pressed && {backgroundColor: theme.colors.backgroundTertiary},
            ]}
          >
            <Text numberOfLines={1} style={[styles.actionLabel, {color: theme.colors.textPrimary}]}>
              {action.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {arrow('left')}
      {arrow('right')}
    </View>
  );
};

type SelectionBubbleProps = {
  // Where the bubble sits and the words it is for (useSelectionBubble).
  placement: {range: MarkRange; left: number; top: number; arrowX: number; below: boolean};
  // The phone's own menu items for the selection (useSelectionBubble).
  actions: MenuAction[];
  marks: ChapterMark[];
  onMarksChange: (next: ChapterMark[]) => void;
  // Called once a colour or style has landed: the selection then ends.
  onDone: () => void;
};

// The bubble over a reader's selection, editing the reader's marks: what the
// words already have shows as chosen, and a colour or style lands at once.
export const SelectionHighlightBubble = ({placement, actions, marks, onMarksChange, onDone}: SelectionBubbleProps) => {
  const {range} = placement;
  const current = useMemo(() => rangeStyles(marks, range), [marks, range]);
  const edit = (change: (from: ChapterMark[], at: MarkRange) => ChapterMark[]) => {
    onMarksChange(change(marks, range));
    onDone();
  };
  return (
    <HighlightBubble
      left={placement.left}
      top={placement.top}
      arrowX={placement.arrowX}
      below={placement.below}
      current={current}
      actions={actions}
      onAction={performMenuAction}
      onColor={color => edit((from, at) => applyMarkToRange(from, at, 'highlight', color))}
      onStyle={style => edit((from, at) => applyMarkToRange(from, at, style))}
      onErase={() => edit(eraseMarksInRange)}
    />
  );
};

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: BUBBLE_WIDTH,
    height: BUBBLE_HEIGHT,
    padding: PAD,
    borderWidth: 1,
    borderRadius: 14,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
  },
  actions: {height: ACTIONS, borderBottomWidth: StyleSheet.hairlineWidth},
  actionsContent: {alignItems: 'center'},
  // Over the row's edge, hiding the cut-off item under it.
  more: {position: 'absolute', top: 0, bottom: 0, width: 24, alignItems: 'center', justifyContent: 'center'},
  moreLeft: {left: 0},
  moreRight: {right: 0},
  moreLabel: {fontSize: 24, fontWeight: '600', marginTop: -3},
  action: {height: ACTIONS - 4, paddingHorizontal: 10, borderRadius: 8, justifyContent: 'center'},
  actionLabel: {fontSize: 14, fontWeight: '600'},
  row: {flexDirection: 'row', alignItems: 'center', gap: GAP},
  colorRow: {marginTop: GAP},
  styleRow: {marginTop: GAP},
  swatch: {width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2},
  swatchChosen: {borderWidth: 2.5},
  styleButton: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleLabel: {fontSize: 17, fontWeight: '700'},
  styleLabelOn: {color: '#FFFFFF'},
  bold: {fontWeight: '900'},
  italic: {fontStyle: 'italic'},
  underline: {textDecorationLine: 'underline'},
  eraseWrap: {flex: 1, alignItems: 'flex-end'},
  eraseButton: {
    height: BUTTON,
    borderRadius: BUTTON / 2,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  eraseLabel: {fontSize: 14, fontWeight: '700'},
  // A square turned 45°, bordered on its two outer edges only.
  arrow: {
    position: 'absolute',
    width: BUBBLE_ARROW,
    height: BUBBLE_ARROW,
    transform: [{rotate: '45deg'}],
  },
  arrowDown: {bottom: -BUBBLE_ARROW / 2, borderRightWidth: 1, borderBottomWidth: 1},
  arrowUp: {top: -BUBBLE_ARROW / 2, borderLeftWidth: 1, borderTopWidth: 1},
});
