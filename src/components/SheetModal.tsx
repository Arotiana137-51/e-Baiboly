import React from 'react';
import {Modal, Pressable, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../contexts/ThemeContext';
import {useKeyboardHeight} from '../hooks/useKeyboardHeight';
import {hexToRgba} from '../utils/colorUtils';
import {t} from '../i18n/strings';

const EDGE = 24;

type SheetModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  // Stays in view under the body: the action buttons.
  footer?: React.ReactNode;
  // Shrinks (flexShrink: 1) and scrolls when the card runs out of room.
  children: React.ReactNode;
};

// The app's dialog card: a title with a 44pt ×, a body and a footer, centred
// over a dim backdrop that closes it. It keeps clear of the status bar and
// rises above the keyboard itself: the app is edge-to-edge, so neither the
// Android dialog window nor iOS makes room for it.
export const SheetModal = ({visible, title, onClose, footer, children}: SheetModalProps) => {
  const {theme} = useTheme();
  const {height} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottom = (useKeyboardHeight() || insets.bottom) + EDGE;
  const top = insets.top + EDGE;
  const maxHeight = Math.min(height * 0.8, height - top - bottom);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, {paddingTop: top, paddingBottom: bottom}]} onPress={onClose}>
        <Pressable
          style={[styles.card, {maxHeight, backgroundColor: theme.colors.backgroundSecondary}]}
          onPress={() => {}}
        >
          <View style={[styles.header, {borderBottomColor: theme.colors.divider}]}>
            <Text style={[styles.title, {color: theme.colors.textPrimary}]} numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={styles.close}
            >
              <Text style={[styles.closeText, {color: theme.colors.textSecondary}]}>×</Text>
            </Pressable>
          </View>
          {children}
          {footer ? (
            <View style={[styles.footer, {borderTopColor: theme.colors.divider}]}>{footer}</View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

type SheetButtonProps = {
  label: string;
  onPress: () => void;
  // 'filled' for the main action, 'outline' for the others.
  variant?: 'filled' | 'outline';
  disabled?: boolean;
};

// One footer button; several share the footer row equally.
export const SheetButton = ({label, onPress, variant = 'outline', disabled}: SheetButtonProps) => {
  const {theme} = useTheme();
  const accent = theme.colors.accentBlue;
  const filled = variant === 'filled';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{disabled: !!disabled}}
      style={({pressed}) => [
        styles.button,
        filled ? {backgroundColor: accent} : [styles.outline, {borderColor: accent}],
        pressed && (filled ? styles.pressed : {backgroundColor: hexToRgba(accent, 0.08)}),
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, filled ? styles.filledText : {color: accent}]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    paddingRight: 12,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 28,
    lineHeight: 30,
  },
  // Same 20pt inset as the title and the body, so the edges line up.
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {borderWidth: 1.5},
  pressed: {opacity: 0.85},
  disabled: {opacity: 0.4},
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  filledText: {color: '#FFFFFF'},
});
