import React from 'react';
import { BibleVerse } from '../hooks/useBibleData';
import { useTutorialTarget } from '../contexts/TutorialContext';
import TutorialOverlay from './TutorialOverlay';
import ActionSheet, { type ActionSheetItem } from './ActionSheet';
import {t} from '../i18n/strings';

interface VerseActionPopoverProps {
  visible: boolean;
  verse: BibleVerse | null;
  verseBookName?: string;
  // The verse already starts a note: the item opens it instead of a new one.
  hasNote?: boolean;
  onClose: () => void;
  // The sheet's height once laid out, so the reader can keep the verse above it.
  onSheetLayout?: (height: number) => void;
  onNote: (verse: BibleVerse) => void;
  onViewCorrespondence: (verse: BibleVerse) => void;
  onAddToFavorites: (verse: BibleVerse) => void;
  onShare: (verse: BibleVerse) => void;
  onReportIssue: (verse: BibleVerse) => void;
}

// The double-tapped verse's actions, in a sheet along the bottom. The verse
// itself stays highlighted in the reader above, so the sheet only names it.
const VerseActionPopover: React.FC<VerseActionPopoverProps> = ({
  visible,
  verse,
  verseBookName,
  hasNote,
  onClose,
  onSheetLayout,
  onNote,
  onViewCorrespondence,
  onAddToFavorites,
  onShare,
  onReportIssue,
}) => {
  const noteItemRef = useTutorialTarget('noteActionItem');

  if (!verse) return null;

  const actions: ActionSheetItem[] = [
    {
      key: 'note',
      label: hasNote ? t('actions.noteOpen') : t('actions.noteAdd'),
      icon: 'notes',
      onPress: () => {
        onClose();
        onNote(verse);
      },
      itemRef: noteItemRef,
    },
    {
      key: 'concordance',
      label: t('actions.viewConcordance'),
      icon: 'arrows',
      onPress: () => {
        onViewCorrespondence(verse);
        onClose();
      },
    },
    {
      key: 'favorite',
      label: t('actions.addToFavorites'),
      icon: 'heart',
      onPress: () => {
        onAddToFavorites(verse);
        onClose();
      },
    },
    {
      key: 'share',
      label: t('actions.share'),
      icon: 'share',
      onPress: () => {
        onShare(verse);
        onClose();
      },
    },
  ];

  return (
    <ActionSheet
      visible={visible}
      reference={`${verseBookName || ''} ${verse.chapter}:${verse.verse_number}`}
      actions={actions}
      report={{
        label: t('actions.reportQuestion'),
        onPress: () => {
          onReportIssue(verse);
          onClose();
        },
      }}
      onClose={onClose}
      onSheetLayout={onSheetLayout}
      // Notes tutorial spotlights the Naoty item from inside this modal.
      overlay={<TutorialOverlay scope="modal" />}
    />
  );
};

export default VerseActionPopover;
