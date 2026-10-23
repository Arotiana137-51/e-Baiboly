import React, {useMemo, useRef, useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../contexts/ThemeContext';
import {t} from '../i18n/strings';
import {
  buildShareReference,
  lookForImage,
  MAX_SHARE_ITEMS,
  pickBackgroundImage,
  PRESET_LOOKS,
  shareImage,
  type ShareCardData,
  type ShareCardLook,
} from '../utils/shareCard';
import {ShareCard, SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH} from './ShareCard';
import {LookPager, LookStrip, themeFill} from './LookPicker';
import {SheetButton} from './SheetModal';

// Mount only while open (`{data ? <ShareCardModal .../> : null}`) so the
// count/look state starts fresh on every open.
type ShareCardModalProps = {
  data: ShareCardData;
  onClose: () => void;
};

// The whole screen, the card first: it takes all the room the controls leave
// (measured, so it fits any phone and text size), beside them in landscape.
// Under it the verse stepper, the photo / colours strip and "Zarao". "Loko"
// swaps the strip for every colour three by three, the card shrunk but in
// view; picking one brings the strip and "Zarao" back. The controls scroll
// if a short screen can't hold them. Verses go out as a picture only: the
// text itself is never handed to the share sheet to be copied and pasted.
export const ShareCardModal = ({data, onClose}: ShareCardModalProps) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const {width, height} = useWindowDimensions();
  const landscape = width > height;
  const [count, setCount] = useState(data.rangeStepper ? 1 : data.items.length);
  const [look, setLook] = useState<ShareCardLook>(PRESET_LOOKS[0]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [allColors, setAllColors] = useState(false);
  const [stage, setStage] = useState({width: 0, height: 0});
  const cardRef = useRef<View>(null);

  // First tap picks a photo; once one is chosen, tapping the tile switches
  // back to it, and tapping it again while active picks a different one.
  const handlePickPhoto = async () => {
    if (busy) return;
    if (photoUri && !look.imageUri) {
      setLook(lookForImage(photoUri));
      return;
    }
    setBusy(true);
    const uri = await pickBackgroundImage();
    setBusy(false);
    if (!uri) return;
    setPhotoUri(uri);
    setLook(lookForImage(uri));
  };

  const maxCount = data.rangeStepper
    ? Math.min(MAX_SHARE_ITEMS, data.items.length)
    : data.items.length;
  const shown = data.items.slice(0, count);
  const reference = buildShareReference(data, count);

  // The 540x960 card scaled to the stage; the card itself keeps its real
  // layout so the capture is not affected by the preview size.
  const scale = Math.min(stage.width / SHARE_CARD_WIDTH, stage.height / SHARE_CARD_HEIGHT);
  const fill = themeFill(theme.colors.navBackground);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 12,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          backgroundColor: theme.colors.backgroundSecondary,
        },
        topBar: {flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 8, minHeight: 48},
        close: {width: 48, height: 48, alignItems: 'center', justifyContent: 'center'},
        closeText: {fontSize: 30, lineHeight: 32, color: theme.colors.textSecondary},
        body: {flex: 1, flexDirection: landscape ? 'row' : 'column'},
        // Never squeezed to nothing: below this the controls scroll instead.
        stage: {flex: 1, minHeight: 160, marginHorizontal: 16, alignItems: 'center', justifyContent: 'center'},
        controlsBox: landscape ? {width: Math.min(400, width * 0.5)} : {flexGrow: 0, flexShrink: 1},
        controls: {paddingHorizontal: 16, paddingTop: 12, gap: 14},
        stepper: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14},
        stepButton: {
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          alignItems: 'center',
          justifyContent: 'center',
        },
        stepOff: {opacity: 0.35},
        stepText: {fontSize: 22, fontWeight: '600', color: theme.colors.textPrimary},
        // Wide enough for "5 andininy", so the buttons don't move as it counts.
        countText: {fontSize: 17, fontWeight: '700', minWidth: 110, textAlign: 'center', color: theme.colors.textPrimary},
        footer: {flexDirection: 'row'},
        label: {fontSize: 13, fontWeight: '700', letterSpacing: 0.4, color: theme.colors.textSecondary},
      }),
    [theme, insets, landscape, width],
  );
  // Apart, so a colour tap or a resize doesn't rebuild the rest.
  const sized = useMemo(
    () =>
      StyleSheet.create({
        preview: {
          width: SHARE_CARD_WIDTH * scale,
          height: SHARE_CARD_HEIGHT * scale,
          borderRadius: 14,
          overflow: 'hidden',
          elevation: 6,
          // Android draws the shadow from a background; the card covers it.
          backgroundColor: '#000000',
        },
        scaled: {transformOrigin: 'top left', transform: [{scale}]},
      }),
    [scale],
  );

  const handleShareImage = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    const shared = await shareImage(cardRef.current);
    setBusy(false);
    if (shared) onClose();
  };

  return (
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      onRequestClose={allColors ? () => setAllColors(false) : onClose}
    >
      <View style={styles.screen}>
        {/* No x over the colour grid: its own "Hidio" goes back to the strip,
            and an x that dropped the whole share there would surprise. */}
        <View style={styles.topBar}>
          {allColors ? null : (
            <Pressable
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.body}>
          <View
            style={styles.stage}
            onLayout={e => setStage({width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height})}
          >
            {scale > 0 ? (
              <View style={sized.preview}>
                <View style={sized.scaled}>
                  <ShareCard ref={cardRef} items={shown} reference={reference} look={look} />
                </View>
              </View>
            ) : null}
          </View>

          <ScrollView style={styles.controlsBox} contentContainerStyle={styles.controls} bounces={false}>
            {allColors ? (
              <>
                <Text style={styles.label}>{t('share.background')}</Text>
                {/* A colour picked here is the choice made: back to "Zarao". */}
                <LookPager
                  look={look}
                  onSelect={swatch => {
                    setLook(swatch);
                    setAllColors(false);
                  }}
                />
                <View style={styles.footer}>
                  <SheetButton label={t('common.close')} onPress={() => setAllColors(false)} color={fill} />
                </View>
              </>
            ) : (
              <>
                {data.rangeStepper ? (
                  <View style={styles.stepper}>
                    <Pressable
                      style={[styles.stepButton, count <= 1 ? styles.stepOff : null]}
                      onPress={() => setCount(c => Math.max(1, c - 1))}
                      disabled={count <= 1}
                      accessibilityRole="button"
                      accessibilityLabel={t('share.fewerVerses')}
                    >
                      <Text style={styles.stepText}>−</Text>
                    </Pressable>
                    {/* The number with its unit, so "- 1 +" says what it counts. */}
                    <Text style={styles.countText}>{t('share.verseCount', {count})}</Text>
                    <Pressable
                      style={[styles.stepButton, count >= maxCount ? styles.stepOff : null]}
                      onPress={() => setCount(c => Math.min(maxCount, c + 1))}
                      disabled={count >= maxCount}
                      accessibilityRole="button"
                      accessibilityLabel={t('share.moreVerses')}
                    >
                      <Text style={styles.stepText}>+</Text>
                    </Pressable>
                  </View>
                ) : null}
                <LookStrip
                  look={look}
                  photoUri={photoUri}
                  onSelect={setLook}
                  onPickPhoto={handlePickPhoto}
                  onMore={() => setAllColors(true)}
                  photoLabel={t('share.image')}
                  moreLabel={t('share.colors')}
                />
                <View style={styles.footer}>
                  <SheetButton
                    label={t('actions.share')}
                    variant="filled"
                    color={fill}
                    onPress={handleShareImage}
                    disabled={busy}
                  />
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
