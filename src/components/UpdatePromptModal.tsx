import React, {useMemo} from 'react';
import {StyleSheet, Text} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
import {t} from '../i18n/strings';
import {useTheme} from '../contexts/ThemeContext';
import {SheetButton, SheetModal} from './SheetModal';

type Props = {
  visible: boolean;
  onUpdate: () => void;
  onLater: () => void;
};

// "A new version is waiting on Play": later, or off to the store page.
export const UpdatePromptModal = ({visible, onUpdate, onLater}: Props) => {
  const {theme} = useTheme();
  // Home stays mounted under the screens pushed on it: the sheet waits until
  // Home is in front. Checked here, not in Home, so a navigation only
  // re-renders this sheet and not the whole reader.
  const isFocused = useIsFocused();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: {fontSize: 17, lineHeight: 25, color: theme.colors.textPrimary},
      }),
    [theme],
  );
  return (
    <SheetModal
      visible={visible && isFocused}
      title={t('update.title')}
      onClose={onLater}
      footer={
        <>
          <SheetButton label={t('update.later')} onPress={onLater} />
          <SheetButton label={t('update.go')} variant="filled" onPress={onUpdate} />
        </>
      }>
      <Text style={styles.body}>{t('update.body')}</Text>
    </SheetModal>
  );
};
