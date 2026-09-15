import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import notifee, {AuthorizationStatus} from '@notifee/react-native';
import DateTimePicker, {type DateTimePickerEvent} from '@react-native-community/datetimepicker';
import {useTheme} from '../contexts/ThemeContext';
import {
  createSlotId,
  deleteReminderSlot,
  getReminderSlots,
  MAX_REMINDER_SLOTS,
  saveReminderSlot,
  type ReminderFrequency,
  type ReminderSlot,
} from '../services/reminders/readingReminder';
import {applyPickerAccentForCurrentColor} from '../services/reminders/pickerTheme';

// Placeholder MG copy — index 0 (Sunday) .. 6 (Saturday), matches Date#getDay().
const DAY_LABELS = ['Alahady', 'Alatsinainy', 'Talata', 'Alarobia', 'Alakamisy', 'Zoma', 'Sabotsy'];
const DAY_SHORT = ['Alh', 'Alt', 'Tal', 'Alr', 'Alk', 'Zom', 'Sab'];

// Editor choices. Each hint explains, in plain words, what the selected pill
// will do — placeholder MG copy, user-owned.
type Choice<T> = {value: T; label: string; hint: string};

const KIND_CHOICES: Choice<ReminderSlot['kind']>[] = [
  {
    value: undefined,
    label: 'Fampahatsiarovana',
    hint: "Hafatra fohy: \"Tonga ny fotoana hamakiana ny Baiboly.\" Tsy misy andininy ao.",
  },
  {
    value: 'verse',
    label: 'Andinin-teny',
    hint: "Andinin-teny iray avy ao amin'ny Baiboly, hafa isan'andro. Tsindrio dia misokatra eo ny Baiboly.",
  },
];

const PROMINENCE_CHOICES: Choice<boolean>[] = [
  {
    value: true,
    label: 'Mipoitra sy misy feo',
    hint: "Mipoitra eo amin'ny efijery sady maneno ny finday. Hita eo amin'ny efijery mihidy koa ny andininy.",
  },
  {
    value: false,
    label: 'Mangina',
    hint: "Tsy maneno, tsy mipoitra. Hita ao amin'ny lisitry ny notifications ihany rehefa sokafanao.",
  },
];

const FREQUENCY_CHOICES: Choice<ReminderFrequency>[] = [
  {value: 'daily', label: "Isan'andro", hint: "Isan'andro, amin'ny ora fidinao eto ambany."},
  {
    value: 'weekly',
    label: 'Isan-kerinandro',
    hint: "Indray mandeha isan-kerinandro, amin'ny andro sy ny ora fidinao eto ambany.",
  },
];

// One question of the editor: a small label, the pills, and a line under
// them explaining what the selected pill will do.
const ChoiceRow = <T extends string | boolean | undefined>({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) => {
  const {theme} = useTheme();
  const selected = choices.find(c => c.value === value) ?? choices[0];
  return (
    <View style={styles.choiceBlock}>
      <Text style={[styles.sectionLabel, {color: theme.colors.textPrimary}]}>{label}</Text>
      <View style={styles.pillRow}>
        {choices.map(choice => {
          const active = choice.value === value;
          return (
            <Pressable
              key={String(choice.value)}
              onPress={() => onChange(choice.value)}
              style={[
                styles.frequencyPill,
                {
                  borderColor: theme.colors.accentBlue,
                  backgroundColor: active ? theme.colors.accentBlue : 'transparent',
                },
              ]}
            >
              <Text
                style={[styles.frequencyPillText, {color: active ? '#FFFFFF' : theme.colors.accentBlue}]}
              >
                {choice.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.rowHint, {color: theme.colors.textSecondary}]}>{selected.hint}</Text>
    </View>
  );
};

const pad2 = (n: number) => String(n).padStart(2, '0');

// "HH:mm" <-> Date, since the native picker works in Date but slots persist
// as a plain time string (only the time-of-day component is ever used).
const timeToDate = (time: string): Date => {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};
const dateToTime = (date: Date): string => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const slotSummary = (slot: ReminderSlot) => {
  const when =
    slot.frequency === 'weekly'
      ? `${DAY_LABELS[slot.dayOfWeek ?? 0]} • ${slot.time}`
      : `Isan'andro • ${slot.time}`;
  // Placeholder MG copy — user-owned.
  if (slot.kind !== 'verse') return when;
  return `Andinin-teny • ${when}${slot.prominent ? ' • mipoitra' : ''}`;
};

const ReadingReminderScreen = () => {
  const {theme} = useTheme();

  const [loaded, setLoaded] = useState(false);
  const [slots, setSlots] = useState<ReminderSlot[]>([]);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [draftKind, setDraftKind] = useState<ReminderSlot['kind']>(undefined);
  const [draftProminent, setDraftProminent] = useState(false);
  const [draftFrequency, setDraftFrequency] = useState<ReminderFrequency>('daily');
  const [draftDayOfWeek, setDraftDayOfWeek] = useState(0);
  const [draftTime, setDraftTime] = useState('07:00');
  // Android: the picker is a self-dismissing native dialog, so it only needs
  // to be mounted while open. iOS renders inline (spinner), so it stays
  // mounted whenever the editor is open — see the render below.
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const [softAskVisible, setSoftAskVisible] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const pendingActionRef = useRef<(() => Promise<void>) | null>(null);

  const refreshSlots = useCallback(async () => {
    setSlots(await getReminderSlots());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getReminderSlots();
      if (cancelled) return;
      setSlots(stored);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestPermissionOrRun = useCallback(async (action: () => Promise<void>) => {
    const settings = await notifee.getNotificationSettings();
    if (settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED) {
      await action();
      return;
    }
    pendingActionRef.current = action;
    setSoftAskVisible(true);
  }, []);

  const confirmSoftAsk = useCallback(async () => {
    setSoftAskVisible(false);
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED) {
      setPermissionDenied(false);
      await pendingActionRef.current?.();
    } else {
      setPermissionDenied(true);
    }
    pendingActionRef.current = null;
  }, []);

  const dismissSoftAsk = useCallback(() => {
    setSoftAskVisible(false);
    pendingActionRef.current = null;
  }, []);

  const openAddEditor = useCallback(() => {
    if (slots.length >= MAX_REMINDER_SLOTS) return;
    setEditingSlotId(null);
    setDraftKind(undefined);
    setDraftProminent(false);
    setDraftFrequency('daily');
    setDraftDayOfWeek(new Date().getDay());
    setDraftTime('07:00');
    setPermissionDenied(false);
    setEditorVisible(true);
  }, [slots.length]);

  const openEditEditor = useCallback((slot: ReminderSlot) => {
    setEditingSlotId(slot.id);
    setDraftKind(slot.kind);
    setDraftProminent(slot.prominent === true);
    setDraftFrequency(slot.frequency);
    setDraftDayOfWeek(slot.dayOfWeek ?? new Date().getDay());
    setDraftTime(slot.time);
    setPermissionDenied(false);
    setEditorVisible(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorVisible(false);
  }, []);

  const saveDraft = useCallback(() => {
    const slot: ReminderSlot = {
      id: editingSlotId ?? createSlotId(),
      enabled: true,
      kind: draftKind,
      prominent: draftKind === 'verse' ? draftProminent : undefined,
      time: draftTime,
      frequency: draftFrequency,
      dayOfWeek: draftFrequency === 'weekly' ? draftDayOfWeek : undefined,
    };
    requestPermissionOrRun(async () => {
      await saveReminderSlot(slot);
      await refreshSlots();
      setEditorVisible(false);
    });
  }, [editingSlotId, draftKind, draftProminent, draftTime, draftFrequency, draftDayOfWeek, requestPermissionOrRun, refreshSlots]);

  const toggleSlot = useCallback(
    (slot: ReminderSlot, next: boolean) => {
      if (!next) {
        saveReminderSlot({...slot, enabled: false}).then(refreshSlots);
        return;
      }
      requestPermissionOrRun(async () => {
        await saveReminderSlot({...slot, enabled: true});
        await refreshSlots();
      });
    },
    [requestPermissionOrRun, refreshSlots],
  );

  const removeSlot = useCallback(
    (slot: ReminderSlot) => {
      deleteReminderSlot(slot.id).then(refreshSlots);
    },
    [refreshSlots],
  );

  const handleTimeChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowAndroidPicker(false);
    if (event.type === 'dismissed' || !date) return;
    setDraftTime(dateToTime(date));
  }, []);

  if (!loaded) {
    return (
      <SafeAreaView
        edges={['bottom']}
        style={[styles.container, {backgroundColor: theme.colors.backgroundPrimary}]}
      />
    );
  }

  const atCap = slots.length >= MAX_REMINDER_SLOTS;

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.container, {backgroundColor: theme.colors.backgroundPrimary}]}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.subtitle, {color: theme.colors.textSecondary}]}>
          Fampahatsiarovana tsy tery hamaky ny Baiboly, amin'ny ora sy fotoana
          tianao. Azonao ampiana maromaro — isan'andro, isan-kerinandro, na
          impiry isan'andro no tianao.
        </Text>

        {slots.length === 0 ? (
          <Text style={[styles.emptyHint, {color: theme.colors.textSecondary}]}>
            Mbola tsy misy fampahatsiarovana. Ampio iray.
          </Text>
        ) : (
          <View
            style={[
              styles.card,
              {backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.divider},
            ]}
          >
            {slots.map((slot, index) => (
              <View key={slot.id}>
                {index > 0 ? (
                  <View style={[styles.divider, {backgroundColor: theme.colors.divider}]} />
                ) : null}
                <View style={styles.slotRow}>
                  <Switch
                    value={slot.enabled}
                    onValueChange={next => toggleSlot(slot, next)}
                    trackColor={{false: '#767577', true: theme.colors.accentBlue}}
                    thumbColor={slot.enabled ? '#FFFFFF' : '#F4F3F4'}
                  />
                  <Pressable style={styles.slotTextContainer} onPress={() => openEditEditor(slot)}>
                    <Text style={[styles.rowTitle, {color: theme.colors.textPrimary}]}>
                      {slotSummary(slot)}
                    </Text>
                    <Text style={[styles.rowHint, {color: theme.colors.textSecondary}]}>
                      Tsindrio hanova
                    </Text>
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => removeSlot(slot)} style={styles.removeButton}>
                    <Text style={[styles.removeButtonText, {color: theme.colors.textSecondary}]}>✕</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <Pressable
          disabled={atCap}
          onPress={openAddEditor}
          style={[styles.addButton, {borderColor: theme.colors.accentBlue}, atCap && styles.addButtonDisabled]}
        >
          <Text style={[styles.addButtonText, {color: theme.colors.accentBlue}]}>
            + Ampio fampahatsiarovana
          </Text>
        </Pressable>
        {atCap ? (
          <Text style={[styles.capHint, {color: theme.colors.textSecondary}]}>
            Feno ny {MAX_REMINDER_SLOTS} fampahatsiarovana azo ampiana.
          </Text>
        ) : null}
      </ScrollView>

      <Modal visible={editorVisible} transparent animationType="fade" onRequestClose={closeEditor}>
        <Pressable style={styles.modalBackdrop} onPress={closeEditor}>
          <Pressable
            style={[styles.modalCard, styles.editorCard, {backgroundColor: theme.colors.backgroundSecondary}]}
            onPress={() => {}}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, {color: theme.colors.textPrimary}]}>
                {editingSlotId ? 'Ovay ny fampahatsiarovana' : 'Fampahatsiarovana vaovao'}
              </Text>

              <ChoiceRow
                label="Inona no alefa?"
                choices={KIND_CHOICES}
                value={draftKind}
                onChange={setDraftKind}
              />

              {draftKind === 'verse' ? (
                <ChoiceRow
                  label="Ahoana no fisehony?"
                  choices={PROMINENCE_CHOICES}
                  value={draftProminent}
                  onChange={setDraftProminent}
                />
              ) : null}

              <ChoiceRow
                label="Impiry?"
                choices={FREQUENCY_CHOICES}
                value={draftFrequency}
                onChange={setDraftFrequency}
              />

              {draftFrequency === 'weekly' ? (
                <View style={styles.dayRow}>
                  <Text style={[styles.sectionLabel, styles.dayRowLabel, {color: theme.colors.textPrimary}]}>
                    Andro inona?
                  </Text>
                  {DAY_SHORT.map((label, day) => {
                    const active = draftDayOfWeek === day;
                    return (
                      <Pressable
                        key={day}
                        onPress={() => setDraftDayOfWeek(day)}
                        style={[
                          styles.dayPill,
                          {
                            borderColor: theme.colors.accentBlue,
                            backgroundColor: active ? theme.colors.accentBlue : 'transparent',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayPillText,
                            {color: active ? '#FFFFFF' : theme.colors.accentBlue},
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <Text style={[styles.sectionLabel, {color: theme.colors.textPrimary}]}>Amin'ny firy?</Text>
              {Platform.OS === 'android' ? (
                <>
                  <Pressable
                    onPress={() => {
                      applyPickerAccentForCurrentColor().then(() => setShowAndroidPicker(true));
                    }}
                    style={[styles.timeDisplayButton, {borderColor: theme.colors.accentBlue}]}
                  >
                    <Text style={[styles.timeDisplayText, {color: theme.colors.accentBlue}]}>
                      {draftTime}
                    </Text>
                  </Pressable>
                  {showAndroidPicker ? (
                    <DateTimePicker
                      value={timeToDate(draftTime)}
                      mode="time"
                      is24Hour
                      onChange={handleTimeChange}
                    />
                  ) : null}
                </>
              ) : (
                <DateTimePicker
                  value={timeToDate(draftTime)}
                  mode="time"
                  is24Hour
                  display="spinner"
                  onChange={handleTimeChange}
                />
              )}

              {permissionDenied ? (
                <>
                  <Text style={[styles.rowHint, {color: theme.colors.textSecondary, marginTop: 10}]}>
                    Tsy nomena alalana ny fampahatsiarovana. Afaka ovaina ao amin'ny
                    paramaetatry ny finday.
                  </Text>
                  <Pressable onPress={() => Linking.openSettings()}>
                    <Text style={[styles.linkText, {color: theme.colors.accentBlue}]}>
                      Sokafy ny paramaetatra
                    </Text>
                  </Pressable>
                </>
              ) : null}

              <View style={styles.modalActions}>
                <Pressable style={styles.modalSecondaryButton} onPress={closeEditor}>
                  <Text style={[styles.modalSecondaryText, {color: theme.colors.textPrimary}]}>
                    Aoka izay
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.modalPrimaryButton, {backgroundColor: theme.colors.accentBlue}]}
                  onPress={saveDraft}
                >
                  <Text style={styles.modalPrimaryText}>Tahirizo</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={softAskVisible} transparent animationType="fade" onRequestClose={dismissSoftAsk}>
        <Pressable style={styles.modalBackdrop} onPress={dismissSoftAsk}>
          <Pressable
            style={[styles.modalCard, {backgroundColor: theme.colors.backgroundSecondary}]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, {color: theme.colors.textPrimary}]}>
              Ora famakiana tiana
            </Text>
            <Text style={[styles.modalBody, {color: theme.colors.textSecondary}]}>
              Mila alalana hampiseho fampahatsiarovana ny finday mba
              hampahatsiahivana anao hamaky ny Baiboly.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondaryButton} onPress={dismissSoftAsk}>
                <Text style={[styles.modalSecondaryText, {color: theme.colors.textPrimary}]}>
                  Tsy izao
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryButton, {backgroundColor: theme.colors.accentBlue}]}
                onPress={confirmSoftAsk}
              >
                <Text style={styles.modalPrimaryText}>Alefaso</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  scroll: {padding: 16, paddingBottom: 32},
  subtitle: {fontSize: 14, marginBottom: 16, lineHeight: 20},
  emptyHint: {fontSize: 14, marginBottom: 16, fontStyle: 'italic'},
  card: {borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12},
  divider: {height: StyleSheet.hairlineWidth, marginVertical: 10},
  slotRow: {flexDirection: 'row', alignItems: 'center'},
  slotTextContainer: {marginLeft: 12, flex: 1},
  rowTitle: {fontSize: 15, fontWeight: '700'},
  rowHint: {marginTop: 2, fontSize: 12, lineHeight: 17},
  removeButton: {paddingHorizontal: 8, paddingVertical: 6},
  removeButtonText: {fontSize: 16, fontWeight: '700'},
  addButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonDisabled: {opacity: 0.4},
  addButtonText: {fontSize: 14, fontWeight: '700'},
  capHint: {marginTop: 8, fontSize: 12, textAlign: 'center'},
  linkText: {marginTop: 6, fontSize: 14, fontWeight: '700'},
  choiceBlock: {marginBottom: 14},
  sectionLabel: {fontSize: 12, fontWeight: '700', marginBottom: 6},
  pillRow: {flexDirection: 'row', gap: 10, marginBottom: 6},
  dayRowLabel: {width: '100%', marginBottom: 0},
  frequencyPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
  frequencyPillText: {fontSize: 13, fontWeight: '700'},
  dayRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
  dayPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  dayPillText: {fontSize: 12, fontWeight: '700'},
  timeDisplayButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginVertical: 8,
  },
  timeDisplayText: {fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums']},
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {borderRadius: 14, padding: 18},
  editorCard: {maxHeight: '90%'},
  modalTitle: {fontSize: 17, fontWeight: '700', marginBottom: 12},
  modalBody: {fontSize: 14, lineHeight: 20},
  modalActions: {flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 12},
  modalSecondaryButton: {paddingVertical: 10, paddingHorizontal: 12},
  modalSecondaryText: {fontSize: 14, fontWeight: '700'},
  modalPrimaryButton: {paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10},
  modalPrimaryText: {fontSize: 14, fontWeight: '700', color: '#FFFFFF'},
});

export default ReadingReminderScreen;
