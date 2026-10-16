import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollView,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import {t} from '../i18n/strings';
import { SheetButton, SheetModal } from './SheetModal';
import { ScrollViewWithThumb } from './ScrollViewWithThumb';

type ReportIssueModalProps = {
  visible: boolean;
  reference: string;
  text: string;
  onClose: () => void;
  onSubmit: (comment: string) => void;
};

const ReportIssueModal: React.FC<ReportIssueModalProps> = ({
  visible,
  reference,
  text,
  onClose,
  onSubmit,
}) => {
  const { theme } = useTheme();
  const [comment, setComment] = useState('');
  const bodyRef = useRef<ScrollView>(null);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (visible) {
      setComment('');
    }
  }, [visible]);

  // The comment field is the last thing in the body: once the card has made
  // room for the keyboard, bring it (and the note under it) into view.
  useEffect(() => {
    if (keyboardHeight > 0) {
      requestAnimationFrame(() => bodyRef.current?.scrollToEnd({ animated: true }));
    }
  }, [keyboardHeight]);

  const canSubmit = useMemo(() => comment.trim().length > 0, [comment]);

  return (
    <SheetModal
      visible={visible}
      title={t('report.title')}
      onClose={onClose}
      footer={
        <>
          <SheetButton label={t('common.cancel')} onPress={onClose} />
          <SheetButton
            label={t('common.send')}
            variant="filled"
            onPress={() => onSubmit(comment)}
            disabled={!canSubmit}
          />
        </>
      }
    >
      <ScrollViewWithThumb
        ref={bodyRef}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{t('report.reference')}</Text>
        <Text style={[styles.reference, { color: theme.colors.textPrimary }]}>{reference}</Text>

        <Text style={[styles.label, styles.spaced, { color: theme.colors.textSecondary }]}>
          {t('report.text')}
        </Text>
        <View
          style={[
            styles.quote,
            { backgroundColor: theme.colors.readerBackground, borderLeftColor: theme.colors.accentBlue },
          ]}
        >
          <Text style={[styles.quoteText, { color: theme.colors.textPrimary }]} numberOfLines={8}>
            {text}
          </Text>
        </View>

        <Text style={[styles.label, styles.spaced, { color: theme.colors.textSecondary }]}>
          {t('report.comment')}
        </Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder={t('report.placeholder')}
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          textAlignVertical="top"
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.readerBackground,
              borderColor: theme.colors.divider,
              color: theme.colors.textPrimary,
            },
          ]}
        />
        <Text style={[styles.note, { color: theme.colors.textSecondary }]}>{t('report.note')}</Text>
      </ScrollViewWithThumb>
    </SheetModal>
  );
};

const styles = StyleSheet.create({
  // Shrinks between the header and the footer when the card runs out of room.
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  spaced: {
    marginTop: 18,
  },
  reference: {
    fontSize: 16,
    fontWeight: '700',
  },
  quote: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quoteText: {
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 110,
    fontSize: 16,
    lineHeight: 22,
  },
  note: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default ReportIssueModal;
