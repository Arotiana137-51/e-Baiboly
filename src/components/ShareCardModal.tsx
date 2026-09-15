import React, {useRef, useState} from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useTheme} from '../contexts/ThemeContext';
import {t} from '../i18n/strings';
import {PRIMARY_COLOR_OPTIONS} from '../theme/personalizationPalette';
import {
  buildShareReference,
  buildShareText,
  lookForColor,
  lookForImage,
  MAX_SHARE_ITEMS,
  pickBackgroundImage,
  PRESET_LOOKS,
  shareImage,
  shareText,
  type ShareCardData,
  type ShareCardLook,
} from '../utils/shareCard';
import {ShareCard, SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH} from './ShareCard';

// Mount only while open (`{data ? <ShareCardModal .../> : null}`) so the
// count/look state starts fresh on every open.
type ShareCardModalProps = {
  data: ShareCardData;
  onClose: () => void;
};

// The two designed looks first, then the app's own colour palette.
const SWATCH_LOOKS: ShareCardLook[] = [
  ...PRESET_LOOKS,
  ...PRIMARY_COLOR_OPTIONS.map(option => lookForColor(option.hex)),
];

export const ShareCardModal = ({data, onClose}: ShareCardModalProps) => {
  const {theme} = useTheme();
  const {width, height} = useWindowDimensions();
  const [count, setCount] = useState(data.rangeStepper ? 1 : data.items.length);
  const [look, setLook] = useState<ShareCardLook>(PRESET_LOOKS[0]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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

  // Scale the 540x960 card down to fit the dialog; the card itself keeps its
  // real layout so the capture is not affected by the preview size.
  const scale = Math.min((width - 64) / SHARE_CARD_WIDTH, (height * 0.55) / SHARE_CARD_HEIGHT);

  const handleShareImage = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    const shared = await shareImage(cardRef.current);
    setBusy(false);
    if (shared) onClose();
  };

  const handleShareText = async () => {
    if (busy) return;
    setBusy(true);
    const shared = await shareText(buildShareText(data, count));
    setBusy(false);
    if (shared) onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, {backgroundColor: theme.colors.backgroundSecondary}]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <Text style={[styles.title, {color: theme.colors.textPrimary}]}>
              {t('share.title')}
            </Text>
            <Pressable onPress={onClose}>
              <Text style={[styles.closeText, {color: theme.colors.textSecondary}]}>
                {t('common.close')}
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.preview,
              {width: SHARE_CARD_WIDTH * scale, height: SHARE_CARD_HEIGHT * scale},
            ]}
          >
            <View style={[styles.scaled, {transform: [{scale}]}]}>
              <ShareCard ref={cardRef} items={shown} reference={reference} look={look} />
            </View>
          </View>

          {data.rangeStepper ? (
            <View style={styles.stepper}>
              <Pressable
                style={[styles.stepButton, {borderColor: theme.colors.divider}]}
                onPress={() => setCount(c => Math.max(1, c - 1))}
                disabled={count <= 1}
              >
                <Text style={[styles.stepText, {color: theme.colors.textPrimary}]}>−</Text>
              </Pressable>
              <Text style={[styles.countText, {color: theme.colors.textPrimary}]}>
                {count}
              </Text>
              <Pressable
                style={[styles.stepButton, {borderColor: theme.colors.divider}]}
                onPress={() => setCount(c => Math.min(maxCount, c + 1))}
                disabled={count >= maxCount}
              >
                <Text style={[styles.stepText, {color: theme.colors.textPrimary}]}>+</Text>
              </Pressable>
            </View>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.swatches}
          >
            <Pressable
              onPress={handlePickPhoto}
              style={[
                styles.swatch,
                styles.photoSwatch,
                {
                  backgroundColor: theme.colors.backgroundTertiary,
                  borderColor: look.imageUri ? theme.colors.accentBlue : theme.colors.divider,
                },
              ]}
            >
              {photoUri ? (
                <Image source={{uri: photoUri}} style={styles.photoThumb} />
              ) : (
                <Text style={[styles.photoPlus, {color: theme.colors.textPrimary}]}>+</Text>
              )}
            </Pressable>
            {SWATCH_LOOKS.map(swatch => (
              <Pressable
                key={swatch.background}
                onPress={() => setLook(swatch)}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: swatch.background,
                    borderColor:
                      look === swatch ? theme.colors.accentBlue : theme.colors.divider,
                  },
                ]}
              />
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={[styles.button, {borderColor: theme.colors.divider}]}
              onPress={handleShareText}
              disabled={busy}
            >
              <Text style={[styles.buttonText, {color: theme.colors.textPrimary}]}>
                {t('share.text')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.button,
                styles.primaryButton,
                {backgroundColor: busy ? theme.colors.divider : theme.colors.accentBlue},
              ]}
              onPress={handleShareImage}
              disabled={busy}
            >
              <Text style={[styles.buttonText, styles.primaryButtonText]}>
                {t('share.image')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  preview: {
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  scaled: {
    transformOrigin: 'top left',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 20,
    fontWeight: '600',
  },
  countText: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 18,
    textAlign: 'center',
  },
  swatches: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
  },
  photoSwatch: {
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  photoPlus: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  button: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    borderWidth: 0,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButtonText: {
    color: '#fff',
  },
});
