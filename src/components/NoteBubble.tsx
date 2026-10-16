import React, {useCallback, useEffect, useRef, useState} from 'react';
import {BackHandler, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useTheme} from '../contexts/ThemeContext';
import {useNotes} from '../contexts/NotesContext';
import {useTutorial, useTutorialTarget} from '../contexts/TutorialContext';
import {formatNoteDate, generateNoteId, type Note, type NoteAnchor} from '../types/notes';
import {shareText} from '../utils/shareCard';
import {t} from '../i18n/strings';
import {MenuIcon} from './MenuIcons';
import {ShareIcon} from './ShareIcon';

export type NoteBubbleTarget = {
  // Where a new note goes; an existing note keeps its own anchor.
  anchor: NoteAnchor;
  existing: Note | null;
  reference: (anchor: NoteAnchor) => string;
  // The noted text, for sharing.
  quote: (anchor: NoteAnchor) => string;
  // Last verse of the chapter: enables the "until verse" stepper (Bible only).
  maxVerse?: number;
};

type Props = {
  target: NoteBubbleTarget;
  onClose: () => void;
  // A save keeps the caller's target in step, so a bubble that unmounts and
  // comes back (list virtualisation) edits the stored note, not a copy.
  onSaved: (note: Note) => void;
  onDeleted: (note: Note) => void;
  // The reader scrolls the bubble to the top, clear of the keyboard.
  onFocus?: () => void;
};

const sameAnchor = (a: NoteAnchor, b: NoteAnchor) => JSON.stringify(a) === JSON.stringify(b);

// A note shown right above its verse (or stanza), pointing at it like a
// speech bubble: read it, edit it in place, save. Rendered inside the reading
// list, so it scrolls with the text and never covers it.
//
// An existing note opens for reading: × closes it, "Ovay" (or a tap on the
// text) edits it. While editing, "Tahirizo" saves and closes, × drops the
// draft and closes; Android back saves; leaving the bubble any other way
// (chapter change, scrolled out of the list) saves too.
const NoteBubble: React.FC<Props> = ({target, onClose, onSaved, onDeleted, onFocus}) => {
  const {theme} = useTheme();
  const {saveNote, removeNote} = useNotes();
  const tutorial = useTutorial();
  const inputRef = useTutorialTarget('noteInput');
  const [text, setText] = useState(() => target.existing?.text ?? '');
  const [anchor, setAnchor] = useState<NoteAnchor>(() => target.existing?.anchor ?? target.anchor);
  // An existing note opens for reading (× closes, "Ovay" or a tap on the text
  // edits); a new one opens ready to write.
  const [editing, setEditing] = useState(() => !target.existing);

  // Latest values for the save that runs on unmount.
  const latest = useRef({text, anchor, target, onSaved, onDeleted});
  latest.current = {text, anchor, target, onSaved, onDeleted};
  const done = useRef(false);

  const commit = useCallback(() => {
    if (done.current) return;
    done.current = true;
    const {text: draft, anchor: at, target: tg} = latest.current;
    const trimmed = draft.trim();
    const now = new Date().toISOString();
    const existing = tg.existing;
    if (existing) {
      if (!trimmed) {
        removeNote(existing.id);
        latest.current.onDeleted(existing);
      } else if (trimmed !== existing.text || !sameAnchor(at, existing.anchor)) {
        const updated = {...existing, anchor: at, text: trimmed, updatedAt: now};
        saveNote(updated);
        latest.current.onSaved(updated);
      }
    } else if (trimmed) {
      const created = {id: generateNoteId(), anchor: at, text: trimmed, createdAt: now, updatedAt: now};
      saveNote(created);
      latest.current.onSaved(created);
    }
  }, [saveNote, removeNote]);

  useEffect(() => {
    tutorial.notifyProgress('noteOpened');
    return () => commit();
    // Mount/unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback(() => {
    commit();
    onClose();
    tutorial.notifyProgress('noteClosed');
  }, [commit, onClose, tutorial]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  // Closes without the unmount save: the draft (or the whole note) is dropped.
  const discard = () => {
    done.current = true;
    onClose();
    tutorial.notifyProgress('noteClosed');
  };

  const handleDelete = () => {
    if (target.existing) {
      removeNote(target.existing.id);
      onDeleted(target.existing);
    }
    discard();
  };

  const handleShare = () => {
    if (!text.trim()) return;
    shareText(`${target.reference(anchor)}\n${target.quote(anchor)}\n\n${text.trim()}`);
  };

  const bibleAnchor = anchor.kind === 'bible' ? anchor : null;
  const maxVerse = target.maxVerse;
  const stepEnd = (delta: number) => {
    if (!bibleAnchor || typeof maxVerse !== 'number') return;
    setAnchor({
      ...bibleAnchor,
      verseEnd: Math.min(maxVerse, Math.max(bibleAnchor.verseStart, bibleAnchor.verseEnd + delta)),
    });
  };
  const date = target.existing ? formatNoteDate(target.existing.updatedAt) : '';

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.bubble,
          {backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.accentBlue},
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.reference, {color: theme.colors.textPrimary}]} numberOfLines={1}>
            {target.reference(anchor)}
          </Text>
          {editing ? (
            <Pressable
              onPress={close}
              hitSlop={8}
              accessibilityRole="button"
              style={[styles.saveButton, {backgroundColor: theme.colors.navBackground}]}
            >
              <Text style={styles.saveText}>{t('notes.save')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={editing ? discard : close}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={styles.closeButton}
          >
            <Text style={[styles.closeText, {color: theme.colors.textSecondary}]}>×</Text>
          </Pressable>
        </View>

        <View ref={inputRef} collapsable={false}>
          {editing ? (
            <TextInput
              value={text}
              onChangeText={setText}
              onFocus={onFocus}
              multiline
              autoFocus
              placeholder={t('notes.placeholder')}
              placeholderTextColor={theme.colors.textSecondary}
              textAlignVertical="top"
              style={[
                styles.input,
                {
                  color: theme.colors.textPrimary,
                  backgroundColor: theme.colors.readerBackground,
                  borderColor: theme.colors.divider,
                },
              ]}
            />
          ) : (
            <Pressable onPress={() => setEditing(true)} accessibilityHint={t('notes.edit')}>
              <Text style={[styles.readText, {color: theme.colors.textPrimary}]}>{text}</Text>
            </Pressable>
          )}
        </View>

        {editing && bibleAnchor && typeof maxVerse === 'number' ? (
          <View style={styles.stepper}>
            <Text style={[styles.stepLabel, {color: theme.colors.textSecondary}]}>
              {t('notes.untilVerse')}
            </Text>
            <Pressable
              style={[styles.stepButton, {borderColor: theme.colors.divider}]}
              onPress={() => stepEnd(-1)}
              disabled={bibleAnchor.verseEnd <= bibleAnchor.verseStart}
              hitSlop={4}
              accessibilityRole="button"
            >
              <Text style={[styles.stepText, {color: theme.colors.textPrimary}]}>−</Text>
            </Pressable>
            <Text style={[styles.stepValue, {color: theme.colors.textPrimary}]}>{bibleAnchor.verseEnd}</Text>
            <Pressable
              style={[styles.stepButton, {borderColor: theme.colors.divider}]}
              onPress={() => stepEnd(1)}
              disabled={bibleAnchor.verseEnd >= maxVerse}
              hitSlop={4}
              accessibilityRole="button"
            >
              <Text style={[styles.stepText, {color: theme.colors.textPrimary}]}>+</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={[styles.date, {color: theme.colors.textSecondary}]} numberOfLines={1}>
            {date ? t('notes.editedOn', {date}) : ''}
          </Text>
          {!editing ? (
            <Pressable
              onPress={() => setEditing(true)}
              hitSlop={6}
              accessibilityRole="button"
              style={[styles.editButton, {borderColor: theme.colors.navBackground}]}
            >
              <Text style={[styles.editText, {color: theme.colors.navBackground}]}>
                {t('notes.edit')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleShare}
            disabled={!text.trim()}
            hitSlop={8}
            style={[styles.iconButton, !text.trim() && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel={t('actions.share')}
          >
            <ShareIcon color={theme.colors.textPrimary} />
          </Pressable>
          <Pressable
            onPress={handleDelete}
            hitSlop={8}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.remove')}
          >
            <MenuIcon name="trash" color={theme.colors.textSecondary} />
          </Pressable>
        </View>
      </View>
      {/* The point aimed at the verse below, over the bubble's border. */}
      <View
        style={[
          styles.arrow,
          {backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.accentBlue},
        ]}
      />
    </View>
  );
};

const ARROW = 12;

const styles = StyleSheet.create({
  wrap: {
    marginBottom: ARROW / 2 + 6,
  },
  bubble: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
  },
  // A square turned 45°, only its lower edges bordered, so it reads as the
  // bubble's outline coming to a point over the verse number.
  arrow: {
    position: 'absolute',
    left: 18,
    bottom: -ARROW / 2 + 1,
    width: ARROW,
    height: ARROW,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{rotate: '45deg'}],
    elevation: 4,
  },
  header: {flexDirection: 'row', alignItems: 'center'},
  reference: {flex: 1, fontSize: 15, fontWeight: '700', marginRight: 10},
  saveButton: {borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6},
  saveText: {color: '#FFFFFF', fontSize: 14, fontWeight: '700'},
  closeButton: {paddingHorizontal: 6, marginLeft: 4},
  closeText: {fontSize: 26, lineHeight: 28},
  readText: {marginTop: 8, fontSize: 16, lineHeight: 23},
  editButton: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginRight: 4,
  },
  editText: {fontSize: 13, fontWeight: '700'},
  input: {
    marginTop: 10,
    minHeight: 64,
    maxHeight: 200,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    lineHeight: 22,
  },
  footer: {flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 2},
  date: {flex: 1, fontSize: 12},
  stepper: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8},
  stepLabel: {flex: 1, fontSize: 13},
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {fontSize: 17, lineHeight: 19},
  stepValue: {minWidth: 24, textAlign: 'center', fontSize: 14, fontWeight: '700'},
  iconButton: {padding: 6},
  disabled: {opacity: 0.4},
});

export default NoteBubble;
