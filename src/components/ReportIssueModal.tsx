import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
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
  const [infoVisible, setInfoVisible] = useState(false);
  const bodyRef = useRef<ScrollView>(null);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (visible) {
      setComment('');
      setInfoVisible(false);
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
      titleExtra={
        // What gets sent and what doesn't, one tap away instead of a
        // paragraph under the field.
        <Pressable
          onPress={() => setInfoVisible(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="?"
          style={({ pressed }) => [
            styles.info,
            { borderColor: theme.colors.accentBlue },
            pressed && styles.infoPressed,
          ]}
        >
          <Text style={[styles.infoText, { color: theme.colors.accentBlue }]}>?</Text>
        </Pressable>
      }
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
        {/* The text being reported, quoted with its reference under it. */}
        <View
          style={[
            styles.quote,
            { backgroundColor: theme.colors.readerBackground, borderLeftColor: theme.colors.accentBlue },
          ]}
        >
          <Text style={[styles.quoteText, { color: theme.colors.textPrimary }]} numberOfLines={8}>
            {text}
          </Text>
          <Text style={[styles.reference, { color: theme.colors.accentBlue }]}>{reference}</Text>
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
      </ScrollViewWithThumb>

      {/* Inside the report card's tree, so iOS stacks it over that modal. */}
      <SheetModal visible={infoVisible} onClose={() => setInfoVisible(false)}>
        <Text style={[styles.note, { color: theme.colors.textPrimary }]}>{t('report.note')}</Text>
      </SheetModal>
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
  info: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoPressed: {
    opacity: 0.6,
  },
  infoText: {
    fontSize: 15,
    fontWeight: '700',
  },
  reference: {
    marginTop: 8,
    fontSize: 14,
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    fontSize: 15,
    lineHeight: 22,
  },
});

export default ReportIssueModal;
