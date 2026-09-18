import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import {useTheme} from '../contexts/ThemeContext';
import {useTutorial, useTutorialTargets} from '../contexts/TutorialContext';
import {useAdaptiveInsets} from '../hooks/useAdaptiveInsets';
import {hexToRgba} from '../utils/colorUtils';
import type {TargetScope} from '../tutorials/registry';

const HOLE_PAD = 8;
const CARD_MAX_WIDTH = 320;
const CARD_GAP = 14;
const SCRIM = 'rgba(0,0,0,0.72)';
// Below this window height (320x568, 360x640, 375x667 class phones) the card
// gets tighter padding + smaller body text so it stops eating half the screen.
const COMPACT_HEIGHT = 700;
const GESTURE_HINT_SIZE = 96;

type Rect = {x: number; y: number; width: number; height: number};

type Props = {
  // Which hierarchy this overlay instance draws for. The screen-level mount
  // renders 'screen' steps; a mount inside a RN <Modal> renders 'modal' steps.
  scope?: TargetScope;
};

// One overlay instance. Multiple can be mounted (screen + inside each modal);
// each only renders when the active step's scope matches its own.
const TutorialOverlay: React.FC<Props> = ({scope = 'screen'}) => {
  const {theme, primaryColor} = useTheme();
  const {activeTutorial, step, stepIndex, stepCount, next, skip} = useTutorial();
  const targets = useTutorialTargets();
  const insets = useAdaptiveInsets();

  // Root ref: we measure the overlay's OWN window origin and subtract it from
  // the target's window coords. That cancels any status-bar / safe-area offset
  // between window space and this overlay's local space — so the hole lands on
  // the toggle on any screen size, not shifted up/down.
  const rootRef = useRef<View | null>(null);
  // One rect per highlighted target (targetId + any extraTargetIds). Empty =
  // no measurable target (centered card / modal fallback).
  const [rects, setRects] = useState<Rect[]>([]);
  // Overlay's own height (local space) — card placement clamps to THIS, not the
  // full window, so the card never falls below the overlay's visible area.
  const [overlayH, setOverlayH] = useState(0);
  // Measured coach-card height — placement clamps to it so the card is always
  // fully on-screen, even when the highlighted target is nearly full-height.
  const [cardH, setCardH] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [screen, setScreen] = useState(() => Dimensions.get('window'));

  const pulse = useSharedValue(0);
  // Long-press hint animation: 0 → 1 press-and-hold cycle driving a fingertip
  // dip and an expanding "held" ring, native-style.
  const press = useSharedValue(0);

  const stepScope: TargetScope = step?.scope ?? 'screen';
  const isMine = !!step && stepScope === scope;
  const accent = primaryColor ?? theme.colors.navBackground;
  const compact = screen.height < COMPACT_HEIGHT;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = Dimensions.addEventListener('change', ({window}) => setScreen(window));
    return () => sub?.remove();
  }, []);

  // Pulse loop — only while this overlay is showing a hole and motion is allowed.
  useEffect(() => {
    if (!isMine || reduceMotion || rects.length === 0) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, {duration: 900, easing: Easing.inOut(Easing.ease)}),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [isMine, reduceMotion, rects.length, pulse]);

  // Measure the active target. Re-run whenever the step or screen changes.
  // Modal-scope steps measure too when their target is registered (hymn
  // category strip / keypad) so we can spotlight + dim inside the modal; steps
  // whose target isn't measurable fall back to a card-only layout below.
  const measure = useCallback(() => {
    if (!isMine || !step || step.targetId === null) {
      setRects([]);
      return;
    }
    const ids = [step.targetId, ...(step.extraTargetIds ?? [])];
    // Measure each target in window space, then subtract this overlay's own
    // window origin so results are local to the overlay (offset-corrected).
    const rootNode = rootRef.current;
    const withOrigin = (cb: (ox: number, oy: number) => void) => {
      if (rootNode && typeof rootNode.measureInWindow === 'function') {
        rootNode.measureInWindow((ox, oy) => cb(ox, oy));
      } else {
        cb(0, 0);
      }
    };
    withOrigin((ox, oy) => {
      const collected: Rect[] = [];
      let pending = ids.length;
      const done = () => {
        pending -= 1;
        if (pending === 0) setRects(collected);
      };
      ids.forEach(id => {
        const node = targets.current.get(id)?.current;
        if (!node || typeof node.measureInWindow !== 'function') {
          done();
          return;
        }
        node.measureInWindow((tx, ty, width, height) => {
          if (width > 0 && height > 0) {
            collected.push({x: tx - ox, y: ty - oy, width, height});
          }
          done();
        });
      });
    });
  }, [isMine, step, targets]);

  // Modal-scoped targets (grids) mount as the user drills in, so a single
  // measure can land before layout. Retry a few times over ~600ms.
  useEffect(() => {
    if (!isMine) {
      setRects([]);
      return;
    }
    let tries = 0;
    measure();
    const iv = setInterval(() => {
      tries += 1;
      measure();
      if (tries >= 6) clearInterval(iv);
    }, 100);
    return () => clearInterval(iv);
    // `screen` re-runs measurement on rotation.
  }, [isMine, stepIndex, measure, screen]);

  const glowStyle = useAnimatedStyle(() => {
    const w = 2 + pulse.value * 2; // 2 → 4
    return {
      borderWidth: w,
      shadowOpacity: 0.4 + pulse.value * 0.5,
    };
  });

  const activeGesture = step?.gesture;
  const showGestureHint = isMine && !!activeGesture && rects.length > 0;

  // One shared driver for every gesture hint — only the derived styles below
  // differ per gesture. Runs only while a hint is shown and motion is allowed.
  useEffect(() => {
    if (!showGestureHint || reduceMotion) {
      cancelAnimation(press);
      press.value = 0;
      return;
    }
    press.value = withRepeat(
      withTiming(1, {duration: 1400, easing: Easing.inOut(Easing.ease)}),
      -1,
      false,
    );
    return () => cancelAnimation(press);
  }, [showGestureHint, reduceMotion, press]);

  // Fingertip: dips down and shrinks slightly as the "hold" begins, then lifts.
  const fingerStyle = useAnimatedStyle(() => {
    const held = Math.min(1, press.value * 2); // reach the surface in the first half
    return {
      transform: [
        {translateY: 6 - held * 6},
        {scale: 1 - held * 0.12},
      ],
      opacity: 0.35 + held * 0.65,
    };
  });

  // Held ring: expands + fades during the hold phase to signal "keep pressing".
  const ringStyle = useAnimatedStyle(() => {
    const hold = Math.max(0, (press.value - 0.35) / 0.65); // grow after contact
    return {
      transform: [{scale: 0.3 + hold * 1.1}],
      opacity: (1 - hold) * 0.7,
    };
  });

  // Fingertip slides right then left across one full cycle of the shared
  // driver (a full sine period over press 0→1) — a smooth back-and-forth
  // swipe with no snap at the loop boundary, since sin is 0 at both ends.
  const swipeStyle = useAnimatedStyle(() => {
    const wave = Math.sin(press.value * Math.PI * 2);
    return {
      transform: [{translateX: wave * 22}],
      opacity: 0.4 + Math.abs(wave) * 0.6,
    };
  });

  // Same wave as swipeStyle, but vertical — paired with the ring (dragging a
  // list row is grab-then-move, so the "hold to grab" cue still applies,
  // unlike a plain swipe).
  const dragVerticalStyle = useAnimatedStyle(() => {
    const wave = Math.sin(press.value * Math.PI * 2);
    return {
      transform: [{translateY: wave * 22}],
      opacity: 0.4 + Math.abs(wave) * 0.6,
    };
  });

  if (!activeTutorial || !isMine) return null;

  const isLast = stepIndex === stepCount - 1;

  // Modal-scope WITHOUT a measured target: fall back to a floating coach card
  // (no hole). Centered vertically so it doesn't cover the menu's controls.
  // Once the target is measured (rect set) we fall through to the shared
  // spotlight+dim path below, same as screen steps.
  if (stepScope === 'modal' && rects.length === 0) {
    return (
      <View style={styles.modalCardWrap} pointerEvents="box-none">
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[
            styles.card,
            styles.modalCard,
            compact && styles.cardCompact,
            // Bottom-left so it clears the menu's controls above it. Tinted
            // and translucent, same as the peek cards, so the real modal
            // behind it (e.g. the highlight editor) stays partly visible.
            {backgroundColor: hexToRgba(accent, 0.55), marginBottom: insets.bottom + 66},
          ]}>
          <Text style={styles.counterOnAccent}>
            {stepIndex + 1} / {stepCount}
          </Text>
          <Text style={[styles.bodyOnAccent, compact && styles.bodyCompact]}>{step?.text}</Text>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={skip}
              hitSlop={8}
              style={[styles.skipInlineBtn, {borderColor: accent}]}
              accessibilityRole="button"
              accessibilityLabel="Aok'izao">
              <Text style={[styles.skipInlineText, {color: accent}]}>Aok'izao</Text>
              <Text style={[styles.skipInlineClose, {color: accent}]}>✕</Text>
            </Pressable>
            {/* Card-only intro steps advance on tap — show the Next button.
                targetEvent steps advance from the real UI, so no button. */}
            {step?.advanceOn === 'targetEvent' ? null : (
              <Pressable
                onPress={next}
                style={[styles.nextBtn, styles.nextBtnOnAccent]}
                accessibilityRole="button">
                <Text style={[styles.nextText, {color: accent}]}>
                  {isLast ? 'Vita ✓' : 'Manaraka →'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  // Padded holes, one per measured target. ponytail: multi-hole steps assume
  // their targets share a row (e.g. the two chapter chevrons) — side scrims use
  // the shared band, add per-hole y-tiling if a future step stacks vertically.
  const holes = rects.map(r => ({
    x: Math.max(0, r.x - HOLE_PAD),
    y: Math.max(0, r.y - HOLE_PAD),
    width: r.width + HOLE_PAD * 2,
    height: r.height + HOLE_PAD * 2,
  }));
  const hasHoles = holes.length > 0;

  // Union bounding box across all holes — drives card placement + the band.
  const box = hasHoles
    ? holes.reduce(
        (acc, h) => ({
          left: Math.min(acc.left, h.x),
          top: Math.min(acc.top, h.y),
          right: Math.max(acc.right, h.x + h.width),
          bottom: Math.max(acc.bottom, h.y + h.height),
        }),
        {left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity},
      )
    : null;

  // Horizontal scrim segments inside the band: gaps left of the first hole,
  // between holes, and right of the last hole.
  const sorted = [...holes].sort((a, b) => a.x - b.x);
  const gaps: {left: number; width: number}[] = [];
  if (box) {
    let cursor = 0;
    for (const h of sorted) {
      if (h.x > cursor) gaps.push({left: cursor, width: h.x - cursor});
      cursor = Math.max(cursor, h.x + h.width);
    }
    gaps.push({left: cursor, width: screen.width - cursor});
  }

  // Coach card placement: below the holes if they fit in the top 60%, else above.
  // Centered (no hole) steps get a vertically-centered card.
  // Use the overlay's measured height when we have it; fall back to the window
  // height before first layout.
  const H = overlayH > 0 ? overlayH : screen.height;

  // Card height falls back to a rough estimate before its first onLayout so the
  // very first frame still clamps sensibly.
  const ch = cardH > 0 ? cardH : 150;
  const MARGIN = CARD_GAP;

  // Reserve the status bar / notch (insets.top) and the system nav bar
  // (insets.bottom): this overlay is absoluteFill inside a SafeAreaView, which
  // ignores the parent's padding, so it spans the full window on both
  // platforms. Without the top reservation a 'top'-placed card over a tall
  // target clamps to MARGIN and sits under the iPhone notch.
  const minTop = MARGIN + insets.top;
  const maxTop = H - ch - MARGIN - insets.bottom;
  const aboveTop = box ? box.top - CARD_GAP - ch : 0;
  const belowTop = box ? box.bottom + CARD_GAP : 0;

  let placeBelow = box
    ? step?.placement === 'bottom'
      ? true
      : step?.placement === 'top'
        ? false
        : box.bottom < H * 0.6
    : false;
  // A side that has no room would be clamped back onto the target and hide
  // the very control the step asks for (short screens, high targets), so flip
  // to the other side whenever that one fits.
  if (box && !placeBelow && aboveTop < minTop && belowTop <= maxTop) {
    placeBelow = true;
  } else if (box && placeBelow && belowTop > maxTop && aboveTop >= minTop) {
    placeBelow = false;
  }

  // Always resolve to a single top, then clamp so the whole card stays on-screen
  // regardless of target size (a flex:1 target must not shove the card off-top).
  let cardTop: number;
  if (!box) {
    cardTop = H * 0.5 - 90;
  } else if (placeBelow) {
    cardTop = belowTop;
  } else {
    cardTop = aboveTop;
  }
  cardTop = Math.max(minTop, Math.min(cardTop, maxTop));

  // "Peek" cards (destination-confirmation steps): ignore the hole-relative
  // placement above entirely — the point is to sit off to the side, mid-
  // screen, tinted and translucent so the spotlit content (already undimmed,
  // since it fills the hole) stays legible right through the card, not just
  // around it.
  const isPeek = !!step?.peekCard;
  const peekCardTop = H / 2 - ch / 2;

  return (
    <View
      ref={rootRef}
      onLayout={e => setOverlayH(e.nativeEvent.layout.height)}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none">
      {box ? (
        <>
          {/* Scrim rects framing the transparent hole(s). They capture taps
              (block interaction elsewhere); holes are left open so the real
              element underneath stays tappable when a step needs a live tap.
              Top band above the row, bottom band below it, and horizontal gap
              segments beside/between the holes within the row. */}
          {/* Peek steps skip the top band — there's nothing above the hole the
              user needs to ignore, and dimming the topbar for a "just look"
              step reads as darkening for no reason. */}
          {isPeek ? null : (
            <View style={[styles.scrim, {left: 0, top: 0, right: 0, height: box.top}]} />
          )}
          <View
            style={[styles.scrim, {left: 0, top: box.bottom, right: 0, bottom: 0}]}
          />
          {gaps.map((g, i) => (
            <View
              key={`gap-${i}`}
              style={[
                styles.scrim,
                {left: g.left, top: box.top, width: g.width, height: box.bottom - box.top},
              ]}
            />
          ))}
          {/* Glow border around each hole. pointerEvents none so taps pass to
              the real control beneath. */}
          {holes.map((h, i) => (
            <Animated.View
              key={`hole-${i}`}
              pointerEvents="none"
              style={[
                styles.hole,
                glowStyle,
                {
                  left: h.x,
                  top: h.y,
                  width: h.width,
                  height: h.height,
                  borderColor: accent,
                  shadowColor: accent,
                },
              ]}
            />
          ))}
          {/* Gesture hint — a fingertip emoji, centered on the first hole.
              Deliberately the bare glyph with no skin-tone modifier: that's
              Unicode's own "neutral" rendering (the flat cartoon-yellow tone
              exists specifically so the default isn't any real skin color —
              adding a tone modifier would make it LESS neutral, not more).
              pointerEvents none so the real gesture underneath still
              registers. longPress and dragVertical add an expanding "held"
              ring (both start with a grab-and-hold); swipe skips it — a ring
              there would read as "hold still", the opposite of what's asked. */}
          {showGestureHint && holes[0] ? (
            <View
              pointerEvents="none"
              style={[
                styles.gestureHint,
                {
                  left: holes[0].x + holes[0].width / 2 - GESTURE_HINT_SIZE / 2,
                  // +5: nudges the hint slightly below dead-center, which read
                  // better against the actual controls than exact centering.
                  top: holes[0].y + holes[0].height / 2 - GESTURE_HINT_SIZE / 2 + 5,
                },
              ]}>
              {activeGesture === 'swipeHorizontal' ? null : (
                <Animated.View
                  style={[styles.pressRing, ringStyle, {borderColor: accent}]}
                />
              )}
              <Animated.Text
                style={[
                  styles.fingerGlyph,
                  activeGesture === 'longPress'
                    ? fingerStyle
                    : activeGesture === 'swipeHorizontal'
                      ? swipeStyle
                      : dragVerticalStyle,
                ]}>
                👆
              </Animated.Text>
            </View>
          ) : null}
        </>
      ) : (
        // Centered step: full dim, taps blocked.
        <View style={[StyleSheet.absoluteFill, {backgroundColor: SCRIM}]} />
      )}

      {/* Coach card */}
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        onLayout={e => setCardH(e.nativeEvent.layout.height)}
        style={[
          styles.card,
          isPeek && styles.peekCard,
          compact && styles.cardCompact,
          {
            backgroundColor: isPeek ? hexToRgba(accent, 0.55) : theme.colors.backgroundSecondary,
            top: isPeek ? peekCardTop : cardTop,
          },
        ]}>
        <Text style={isPeek ? styles.counterOnAccent : [styles.counter, {color: theme.colors.textSecondary}]}>
          {stepIndex + 1} / {stepCount}
        </Text>
        <Text
          style={[
            isPeek ? styles.bodyOnAccent : [styles.body, {color: theme.colors.textPrimary}],
            compact && styles.bodyCompact,
          ]}>
          {step?.text}
        </Text>
        <View style={styles.buttonRow}>
          <Pressable
            onPress={skip}
            hitSlop={8}
            style={[styles.skipInlineBtn, {borderColor: accent}]}
            accessibilityRole="button"
            accessibilityLabel="Aok'izao">
            <Text style={[styles.skipInlineText, {color: accent}]}>Aok'izao</Text>
            <Text style={[styles.skipInlineClose, {color: accent}]}>✕</Text>
          </Pressable>
          {/* Next button hidden on targetEvent steps — the real control advances,
              and the step text already tells the user what to do. */}
          {step?.advanceOn === 'targetEvent' ? null : (
            <Pressable
              onPress={next}
              style={[styles.nextBtn, {backgroundColor: accent}]}
              accessibilityRole="button">
              <Text style={styles.nextText}>{isLast ? 'Vita ✓' : 'Manaraka →'}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  scrim: {position: 'absolute', backgroundColor: SCRIM},
  hole: {
    position: 'absolute',
    borderRadius: 12,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 0},
    elevation: 0,
  },
  gestureHint: {
    position: 'absolute',
    width: GESTURE_HINT_SIZE,
    height: GESTURE_HINT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressRing: {
    position: 'absolute',
    width: GESTURE_HINT_SIZE,
    height: GESTURE_HINT_SIZE,
    borderRadius: GESTURE_HINT_SIZE / 2,
    borderWidth: 3,
  },
  fingerGlyph: {
    fontSize: 44,
  },
  // Wraps so a narrow card (the 62% peek card on a 360dp phone) stacks the
  // two pills instead of pushing Manaraka past the card edge.
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  skipInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  skipInlineText: {fontWeight: '700', fontSize: 14},
  skipInlineClose: {fontWeight: '700', fontSize: 15, marginLeft: 8},
  card: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: CARD_MAX_WIDTH,
    width: '90%',
    borderRadius: 14,
    padding: 18,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
  },
  // Overrides `card` for peek steps: narrower and pinned to the right instead
  // of centered, so most of the spotlit content stays fully clear beside it.
  // elevation: 0 matters more than it looks — Android renders a translucent
  // backgroundColor combined with `card`'s elevation as a solid white plate
  // (a known RN/Android quirk: elevation shadows assume an opaque surface),
  // which defeated the whole point of tinting the card. Dropping elevation
  // keeps the iOS shadow* props (unaffected by this) and just loses the
  // Android drop shadow, a fine trade for an actually-translucent card.
  peekCard: {
    alignSelf: 'flex-end',
    width: '62%',
    marginRight: 16,
    elevation: 0,
  },
  cardCompact: {padding: 14},
  counter: {fontSize: 12, fontWeight: '700', marginBottom: 6},
  body: {fontSize: 16, lineHeight: 22, marginBottom: 14},
  bodyCompact: {fontSize: 14, lineHeight: 19, marginBottom: 10},
  nextBtn: {
    // Right-aligns on the shared row and on its own row once wrapped.
    marginLeft: 'auto',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  nextText: {color: '#FFFFFF', fontWeight: '700', fontSize: 15},
  modalCardWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  modalCard: {
    alignSelf: 'flex-start',
    marginLeft: 16,
    bottom: undefined,
    top: undefined,
    // Same reason as peekCard: elevation + a translucent backgroundColor
    // renders as a solid white plate on Android, so it's dropped here too.
    elevation: 0,
  },
  nextBtnOnAccent: {
    backgroundColor: '#FFFFFF',
  },
  counterOnAccent: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    color: 'rgba(255,255,255,0.85)',
  },
  bodyOnAccent: {fontSize: 16, lineHeight: 22, color: '#FFFFFF', marginBottom: 14},
});

export default TutorialOverlay;
