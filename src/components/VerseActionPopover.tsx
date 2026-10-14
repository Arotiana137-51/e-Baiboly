import React from 'react';
import { Pressable, Text, View, StyleSheet, Modal } from 'react-native';
import { BibleVerse } from '../hooks/useBibleData';
import { useTheme } from '../contexts/ThemeContext';
import { useTutorialTarget } from '../contexts/TutorialContext';
import TutorialOverlay from './TutorialOverlay';
import {t} from '../i18n/strings';

interface VerseActionPopoverProps {
  visible: boolean;
  verse: BibleVerse | null;
  verseBookName?: string;
  // The verse already starts a note: the item opens it instead of a new one.
  hasNote?: boolean;
  onClose: () => void;
  onNote: (verse: BibleVerse) => void;
  onViewCorrespondence: (verse: BibleVerse) => void;
  onAddToFavorites: (verse: BibleVerse) => void;
  onShare: (verse: BibleVerse) => void;
  onReportIssue: (verse: BibleVerse) => void;
}

const VerseActionPopover: React.FC<VerseActionPopoverProps> = ({
  visible,
  verse,
  verseBookName,
  hasNote,
  onClose,
  onNote,
  onViewCorrespondence,
  onAddToFavorites,
  onShare,
  onReportIssue,
}) => {
  const { theme } = useTheme();
  const noteItemRef = useTutorialTarget('noteActionItem');

  if (!verse) return null;

  const handleNote = () => {
    onClose();
    onNote(verse);
  };

  const handleViewCorrespondence = () => {
    onViewCorrespondence(verse);
    onClose();
  };

  const handleAddToFavorites = () => {
    onAddToFavorites(verse);
    onClose();
  };

  const handleShare = () => {
    onShare(verse);
    onClose();
  };

  const handleReportIssue = () => {
    onReportIssue(verse);
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
            <Text style={[styles.verseReference, { color: theme.colors.textPrimary }]}>
              {verseBookName || ''} {verse.chapter}:{verse.verse_number}
            </Text>
          </View>
          
          <View style={styles.menuItems}>
            <Pressable
              ref={noteItemRef}
              collapsable={false}
              style={[styles.menuItem, { borderBottomColor: theme.colors.divider }]}
              onPress={handleNote}
            >
              <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                {hasNote ? t('actions.noteOpen') : t('actions.noteAdd')}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.menuItem, { borderBottomColor: theme.colors.divider }]}
              onPress={handleViewCorrespondence}
            >
              <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                {t('actions.viewConcordance')}
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
            >
              <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                {t('actions.share')}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={handleReportIssue}
            >
              <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                {t('actions.report')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
      {/* Notes tutorial spotlights the Naoty item from inside this modal. */}
      <TutorialOverlay scope="modal" />
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
  verseReference: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  menuItems: {
    marginTop: 4,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemText: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default VerseActionPopover;
