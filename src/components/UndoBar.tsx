import React, {useEffect} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../contexts/ThemeContext';
import {t} from '../i18n/strings';

const UNDO_WINDOW_MS = 5000;

// Shown after a note is deleted: the delete already happened, "Averina" puts
// it back. Lighter than a confirmation dialog for something that can be undone.
type Props<T> = {
  item: T | null;
  message: string;
  onUndo: (item: T) => void;
  onDismiss: () => void;
  bottomOffset?: number;
};

export function UndoBar<T>({item, message, onUndo, onDismiss, bottomOffset = 0}: Props<T>) {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();

  // A new delete restarts the window; leaving the screen clears it.
  useEffect(() => {
    if (item == null) return;
    const timer = setTimeout(onDismiss, UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [item, onDismiss]);

  if (item == null) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.bar, {bottom: insets.bottom + 16 + bottomOffset}]}
    >
      <Text style={styles.message} numberOfLines={1}>
        {message}
      </Text>
      <Pressable
        onPress={() => onUndo(item)}
        hitSlop={8}
        accessibilityRole="button"
        style={styles.action}
      >
        <Text style={[styles.actionText, {color: theme.colors.accentGold}]}>
          {t('notes.undo')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingLeft: 16,
    paddingRight: 8,
    minHeight: 48,
    // The usual snackbar surface: dark in both themes, so it reads as a
    // passing message rather than part of the page.
    backgroundColor: '#323232',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 3},
  },
  message: {flex: 1, color: '#FFFFFF', fontSize: 14},
  action: {paddingHorizontal: 12, paddingVertical: 12},
  actionText: {fontSize: 14, fontWeight: '700'},
});
