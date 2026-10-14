import React from 'react';
import { Pressable, Text, View, StyleSheet, Modal } from 'react-native';
import { Hymn } from '../hooks/useHymnsData';
import { useTheme } from '../contexts/ThemeContext';
import {t} from '../i18n/strings';

interface HymnActionPopoverProps {
  visible: boolean;
  hymn: Hymn | null;
  stanzaNumber?: number | null;
  stanzaText?: string | null;
  // The stanza / the whole hymn already has a note: open it instead.
  stanzaHasNote?: boolean;
  hymnHasNote?: boolean;
  onClose: () => void;
  // stanza null = a note on the whole hymn.
  onNote: (stanza: number | null) => void;
  onAddToFavorites: (hymn: Hymn) => void;
  onShare: (stanzaNumber: number) => void;
  onReportIssue: (payload: { stanzaNumber: number; stanzaText: string }) => void;
}

const HymnActionPopover: React.FC<HymnActionPopoverProps> = ({
  visible,
  hymn,
  stanzaNumber,
  stanzaText,
  stanzaHasNote,
  hymnHasNote,
  onClose,
  onNote,
  onAddToFavorites,
  onShare,
  onReportIssue,
}) => {
  const { theme } = useTheme();

  if (!hymn) return null;

  const hasStanza = typeof stanzaNumber === 'number' && !!stanzaText;

  const handleNote = (stanza: number | null) => {
    onClose();
    onNote(stanza);
  };

  const handleAddToFavorites = () => {
    onAddToFavorites(hymn);
    onClose();
  };

  const handleShare = () => {
    if (typeof stanzaNumber === 'number') {
      onShare(stanzaNumber);
    }
    onClose();
  };

  const handleReportIssue = () => {
    if (typeof stanzaNumber !== 'number' || !stanzaText) {
      onClose();
      return;
    }

    onReportIssue({ stanzaNumber, stanzaText });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.popoverContainer, { backgroundColor: theme.colors.backgroundSecondary }]}
          onPress={() => {}}
        >
          <View style={styles.popoverHeader}>
            <Text style={[styles.hymnTitle, { color: theme.colors.textPrimary }]}>
              {hymn.title}
            </Text>
            <Text style={[styles.hymnReference, { color: theme.colors.textSecondary }]}>
              {hymn.category ? `${hymn.category.toUpperCase()} ` : ''}{t('favorites.hymnLabel', {number: hymn.number})}
            </Text>
          </View>
          
          <View style={styles.menuItems}>
            {hasStanza ? (
              <Pressable
                style={[styles.menuItem, { borderBottomColor: theme.colors.divider }]}
                onPress={() => handleNote(stanzaNumber ?? null)}
              >
                <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                  {stanzaHasNote ? t('actions.noteOpen') : t('actions.noteAdd')}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.menuItem, { borderBottomColor: theme.colors.divider }]}
              onPress={() => handleNote(null)}
            >
              <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                {hymnHasNote ? t('actions.hymnNoteOpen') : t('actions.hymnNoteAdd')}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.menuItem, { borderBottomColor: theme.colors.divider }]}
              onPress={handleAddToFavorites}
            >
              <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                {t('actions.addToFavorites')}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.menuItem, { borderBottomColor: theme.colors.divider }]}
              onPress={handleShare}
              disabled={!hasStanza}
            >
              <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                {t('actions.share')}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={handleReportIssue}
              disabled={!hasStanza}
            >
              <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>{t('actions.report')}</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popoverContainer: {
    borderRadius: 12,
    padding: 16,
    minWidth: 280,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  popoverHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  hymnTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  hymnReference: {
    fontSize: 14,
    textAlign: 'center',
  },
  menuItems: {
    marginTop: 4,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  menuItemText: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default HymnActionPopover;
