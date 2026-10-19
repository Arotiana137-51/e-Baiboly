import React, {useCallback, useEffect, useRef, useState} from 'react';
import {BackHandler, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions} from 'react-native';
import {useTheme} from '../contexts/ThemeContext';
import {useNotes} from '../contexts/NotesContext';
import {useTutorial, useTutorialTarget} from '../contexts/TutorialContext';
import {useKeyboardHeight} from '../hooks/useKeyboardHeight';
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

// The writing field's height: at least 3 lines, at most 16% of the window
// (about 5 lines on a big phone), and no more than fits above the keyboard.
const FIELD_MIN = 92;
const FIELD_SHARE = 0.16;
// What sits above the keyboard besides the field once the reader has scrolled
// the bubble to its top: the app's top bar and the bubble's other rows, plus a
// margin. NOTE: an estimate kept on the safe side so Tahirizo never ends up
// under the keyboard; measuring those rows would give the field the last few
// points. Below ~650pt of screen even the minimum field can't fit.
const AROUND_FIELD = 300;

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
  const {height: windowHeight} = useWindowDimensions();
  // Until the keyboard reports its size, assume a typical one (~40% of the
  // window), so the field doesn't jump when it opens.
  const keyboardHeight = useKeyboardHeight() || windowHeight * 0.4;
  const fieldHeight = Math.round(
    Math.max(FIELD_MIN, Math.min(windowHeight * FIELD_SHARE, windowHeight - keyboardHeight - AROUND_FIELD)),
  );
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
  const canShrink = bibleAnchor !== null && bibleAnchor.verseEnd > bibleAnchor.verseStart;
  const canGrow = bibleAnchor !== null && typeof maxVerse === 'number' && bibleAnchor.verseEnd < maxVerse;
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
        {/* Touch layout: × alone in the top corner, the main action (Tahirizo /
            Ovay) alone at the bottom right, share and delete at the bottom
            left, every target at least 44pt, so a wide finger can't hit
            "close" while aiming for "save". */}
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={[styles.reference, {color: theme.colors.textPrimary}]} numberOfLines={1}>
              {target.reference(anchor)}
            </Text>
            {date ? (
              <Text style={[styles.date, {color: theme.colors.textSecondary}]} numberOfLines={1}>
                {t('notes.editedOn', {date})}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={editing ? discard : close}
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
                  height: fieldHeight,
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
            {/* The whole range as a sentence, "Andininy 16 hatramin'ny − 18 +",
                so the start stays in view next to the end the buttons move. */}
            <Text style={[styles.stepLabel, {color: theme.colors.textSecondary}]}>
              {t('notes.fromVerse')}{' '}
              <Text style={[styles.stepNumber, {color: theme.colors.textPrimary}]}>
                {bibleAnchor.verseStart}
              </Text>{' '}
              {t('notes.untilVerse')}
            </Text>
            <Pressable
              style={[styles.stepButton, {borderColor: theme.colors.divider}, !canShrink && styles.disabled]}
              onPress={() => stepEnd(-1)}
              disabled={!canShrink}
              hitSlop={4}
              accessibilityRole="button"
            >
              <Text style={[styles.stepText, {color: theme.colors.textPrimary}]}>−</Text>
            </Pressable>
            <Text style={[styles.stepValue, {color: theme.colors.textPrimary}]}>{bibleAnchor.verseEnd}</Text>
            <Pressable
              style={[styles.stepButton, {borderColor: theme.colors.divider}, !canGrow && styles.disabled]}
              onPress={() => stepEnd(1)}
              disabled={!canGrow}
              hitSlop={4}
              accessibilityRole="button"
            >
              <Text style={[styles.stepText, {color: theme.colors.textPrimary}]}>+</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            onPress={handleShare}
            disabled={!text.trim()}
            style={[styles.iconButton, !text.trim() && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel={t('actions.share')}
          >
            <ShareIcon color={theme.colors.textPrimary} />
          </Pressable>
          <Pressable
            onPress={handleDelete}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.remove')}
          >
            <MenuIcon name="trash" color={theme.colors.textSecondary} />
          </Pressable>
          <View style={styles.spacer} />
          {editing ? (
            <Pressable
              onPress={close}
              accessibilityRole="button"
              style={({pressed}) => [
                styles.mainButton,
                {backgroundColor: theme.colors.navBackground},
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.saveText}>{t('notes.save')}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setEditing(true)}
              accessibilityRole="button"
              style={({pressed}) => [
                styles.mainButton,
                styles.editButton,
                {borderColor: theme.colors.navBackground},
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.editText, {color: theme.colors.navBackground}]}>
                {t('notes.edit')}
              </Text>
            </Pressable>
          )}
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
  header: {flexDirection: 'row', alignItems: 'flex-start'},
  titleBlock: {flex: 1, marginRight: 12, paddingTop: 2},
  reference: {fontSize: 15, fontWeight: '700'},
  // 44pt box pulled into the bubble's corner, away from everything else.
  closeButton: {
    width: 44,
    height: 44,
    marginTop: -8,
    marginRight: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {fontSize: 28, lineHeight: 30},
  readText: {marginTop: 8, fontSize: 17, lineHeight: 24},
  mainButton: {
    minHeight: 44,
    minWidth: 110,
    borderRadius: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {color: '#FFFFFF', fontSize: 16, fontWeight: '700'},
  editButton: {borderWidth: 1.5},
  editText: {fontSize: 16, fontWeight: '700'},
  pressed: {opacity: 0.7},
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 17,
    lineHeight: 24,
  },
  footer: {flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12},
  spacer: {flex: 1},
  date: {fontSize: 12, marginTop: 2},
  stepper: {flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10},
  stepLabel: {flex: 1, fontSize: 14},
  // Drawn at 36 so the row stays light; hitSlop brings the touch area to 44.
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {fontSize: 20, lineHeight: 22},
  stepNumber: {fontSize: 16, fontWeight: '700'},
  stepValue: {minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '700'},
  iconButton: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  disabled: {opacity: 0.4},
});

export default NoteBubble;
