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
  onClose: () => void;
  onAddToFavorites: (hymn: Hymn) => void;
  onShare: (stanzaNumber: number) => void;
  onReportIssue: (payload: { stanzaNumber: number; stanzaText: string }) => void;
}

const HymnActionPopover: React.FC<HymnActionPopoverProps> = ({
  visible,
  hymn,
  stanzaNumber,
  stanzaText,
  onClose,
  onAddToFavorites,
  onShare,
  onReportIssue,
}) => {
  const { theme } = useTheme();

  if (!hymn) return null;

  const hasStanza = typeof stanzaNumber === 'number' && !!stanzaText;

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
