import React from 'react';
import { Hymn } from '../hooks/useHymnsData';
import ActionSheet, { type ActionSheetItem } from './ActionSheet';
import { HYMN_CHORUS_LABEL } from '../utils/chapterMarks';
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
  // The sheet's height once laid out, so the reader can keep the stanza above it.
  onSheetLayout?: (height: number) => void;
  // stanza null = a note on the whole hymn.
  onNote: (stanza: number | null) => void;
  onAddToFavorites: (hymn: Hymn) => void;
  onShare: (stanzaNumber: number) => void;
  onReportIssue: (payload: { stanzaNumber: number; stanzaText: string }) => void;
}

// The double-tapped stanza's actions, in the same sheet as a verse's. The
// stanza stays highlighted in the reader above, so the sheet only names it.
const HymnActionPopover: React.FC<HymnActionPopoverProps> = ({
  visible,
  hymn,
  stanzaNumber,
  stanzaText,
  stanzaHasNote,
  hymnHasNote,
  onClose,
  onSheetLayout,
  onNote,
  onAddToFavorites,
  onShare,
  onReportIssue,
}) => {
  if (!hymn) return null;

  const stanza = typeof stanzaNumber === 'number' && stanzaText ? stanzaNumber : null;
  const hymnReference = `${hymn.category ? `${hymn.category.toUpperCase()} ` : ''}${t('favorites.hymnLabel', {number: hymn.number})}`;
  const reference =
    stanza === null ? hymnReference : `${hymnReference} · ${stanza === 0 ? HYMN_CHORUS_LABEL : stanza}`;

  // The stanza's own rows only when there is one (a double-tap on a stanza).
  const actions: ActionSheetItem[] = [];
  if (stanza !== null) {
    actions.push({
      key: 'stanzaNote',
      label: stanzaHasNote ? t('actions.noteOpen') : t('actions.noteAdd'),
      icon: 'notes',
      onPress: () => {
        onClose();
        onNote(stanza);
      },
    });
  }
  actions.push(
    {
      key: 'hymnNote',
      label: hymnHasNote ? t('actions.hymnNoteOpen') : t('actions.hymnNoteAdd'),
      icon: 'note',
      onPress: () => {
        onClose();
        onNote(null);
      },
    },
    {
      key: 'favorite',
      label: t('actions.addToFavorites'),
      icon: 'heart',
      onPress: () => {
        onAddToFavorites(hymn);
        onClose();
      },
    },
  );
  if (stanza !== null) {
    actions.push({
      key: 'share',
      label: t('actions.share'),
      icon: 'share',
      onPress: () => {
        onShare(stanza);
        onClose();
      },
    });
  }

  return (
    <ActionSheet
      visible={visible}
      reference={reference}
      actions={actions}
      report={
        stanza !== null && stanzaText
          ? {
              label: t('actions.reportQuestion'),
              onPress: () => {
                onReportIssue({ stanzaNumber: stanza, stanzaText });
                onClose();
              },
            }
          : undefined
      }
      onClose={onClose}
      onSheetLayout={onSheetLayout}
    />
  );
};

export default HymnActionPopover;
