import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../contexts/ThemeContext';
import {useTutorialTarget} from '../contexts/TutorialContext';
import {dimHighlightForDarkMode, dimHighlightForLightMode} from '../utils/colorUtils';
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
export const BUBBLE_ARROW = 12;
// Fixed size, so the reader can place the bubble without measuring it first.
export const BUBBLE_WIDTH = PAD * 2 + HIGHLIGHT_COLORS.length * SWATCH + (HIGHLIGHT_COLORS.length - 1) * GAP;
export const BUBBLE_HEIGHT = PAD * 2 + SWATCH + GAP + BUTTON;

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
  onColor: (color: string) => void;
  onStyle: (style: TextStyleKey) => void;
  onErase: () => void;
};

// The highlighter over selected words, like an infobulle: a colour, bold,
// italic, underline, or Fafao to take them all off.
export const HighlightBubble = ({left, top, arrowX, below, current, onColor, onStyle, onErase}: Props) => {
  const {theme} = useTheme();
  const colorsRef = useTutorialTarget('hlColorPicker');
  const eraseRef = useTutorialTarget('hlEraseBtn');
  const dim = theme.isDark ? dimHighlightForDarkMode : dimHighlightForLightMode;
  const surface = {
    backgroundColor: theme.colors.backgroundSecondary,
    borderColor: theme.colors.divider,
  };

  return (
    <View style={[styles.bubble, surface, {left, top}]}>
      <View ref={colorsRef} collapsable={false} style={styles.row}>
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
  row: {flexDirection: 'row', alignItems: 'center', gap: GAP},
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
