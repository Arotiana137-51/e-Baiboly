import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import type {ShareCardItem, ShareCardLook} from '../utils/shareCard';

// Laid out at 9:16 in dp, captured at 1080x1920 (see shareImage). The safe
// zones are what Instagram/Facebook stories cover with their own UI: ~14% at
// the top (profile bar) and ~20% at the bottom (reply box).
export const SHARE_CARD_WIDTH = 540;
export const SHARE_CARD_HEIGHT = 960;
const SAFE_TOP = 134;
const SAFE_BOTTOM = 192;
const SIDE_PADDING = 48;
const FOOTER_HEIGHT = 92;
const BODY_HEIGHT = SHARE_CARD_HEIGHT - SAFE_TOP - SAFE_BOTTOM - FOOTER_HEIGHT;

// Subtle top-to-bottom shade over any background: a 1x32 black PNG whose
// alpha ramps 0 -> 25%, stretched to the card. RN has no gradient primitive
// and this avoids a native dependency for one soft shadow.
const SHADE_PNG =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAgCAYAAADT5RIaAAAASElEQVR42i3E0QaDAAAAwCRJEkmSJJlJkjFJkvT/' +
  'X5Wje7ggeIWKFCtRqky5CpWqVKtRq069Bn301ahJsxb99NeqTbsOnbp0P8xQBAEgjFceAAAAAElFTkSuQmCC';

type ShareCardProps = {
  items: ShareCardItem[];
  reference: string;
  look: ShareCardLook;
  ref?: React.Ref<View>;
};

export const ShareCard = ({items, reference, look: colors, ref}: ShareCardProps) => {
  const showLabels = items.length > 1;
  const onPhoto = !!colors.imageUri;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, {backgroundColor: colors.background}]}
    >
      {onPhoto ? (
        <>
          <Image
            source={{uri: colors.imageUri}}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
          {/* Scrim keeps the text readable over any photo. */}
          <View style={[StyleSheet.absoluteFill, styles.scrim]} />
        </>
      ) : null}
      <Image source={{uri: SHADE_PNG}} resizeMode="stretch" style={StyleSheet.absoluteFill} />

      <View style={styles.body}>
        <Text
          adjustsFontSizeToFit
          numberOfLines={24}
          minimumFontScale={0.3}
          allowFontScaling={false}
          style={[styles.bodyText, {color: colors.text}, onPhoto && styles.onPhotoText]}
        >
          {items.map((item, index) => (
            <React.Fragment key={`${item.label}-${index}`}>
              {index > 0 ? '\n\n' : null}
              {showLabels ? <Text style={{color: colors.accent}}>{`${item.label} `}</Text> : null}
              {item.text}
            </React.Fragment>
          ))}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={[styles.rule, {backgroundColor: colors.accent}]} />
        <Text
          allowFontScaling={false}
          style={[styles.reference, {color: colors.accent}, onPhoto && styles.onPhotoText]}
        >
          {reference}
        </Text>
        {/* Faint filigrane only — the text is Scripture, not the app's. */}
        <Text allowFontScaling={false} style={[styles.filigrane, {color: colors.text}]}>
          e-Baiboly
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    paddingTop: SAFE_TOP,
    paddingBottom: SAFE_BOTTOM,
    paddingHorizontal: SIDE_PADDING,
    overflow: 'hidden',
  },
  body: {
    height: BODY_HEIGHT,
    justifyContent: 'center',
  },
  bodyText: {
    maxHeight: BODY_HEIGHT,
    fontSize: 42,
    textAlign: 'center',
  },
  scrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  onPhotoText: {
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
  footer: {
    height: FOOTER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  rule: {
    width: 48,
    height: 3,
    borderRadius: 2,
    marginBottom: 14,
  },
  reference: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  filigrane: {
    fontSize: 15,
    letterSpacing: 1,
    opacity: 0.3,
  },
});
