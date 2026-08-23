import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/ui/data-state';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { showDialog } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/use-theme';
import * as integrations from '@/lib/backend/integrations';
import { useBackendStatus } from '@/lib/store';
import { userFacingError } from '@/lib/user-facing-error';

type CalendarOption = { id: string; name: string; color?: string; selected: boolean };

export default function CalendarScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const sync = useBackendStatus();
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingCalendars, setLoadingCalendars] = useState(sync.mode === 'live');
  const [calendarError, setCalendarError] = useState<string>();
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');

  useEffect(() => {
    if (sync.mode !== 'live') {
      return;
    }
    let active = true;
    integrations.listGoogleCalendars()
      .then((value) => { if (active) setCalendars(value); })
      .catch((error) => { if (active) setCalendarError(userFacingError(error, 'Could not load calendars.')); })
      .finally(() => { if (active) setLoadingCalendars(false); });
    return () => { active = false; };
  }, [sync.mode]);

  const importEvents = async () => {
    const ids = calendars.filter((item) => item.selected).map((item) => item.id);
    if (!ids.length) return;
    setBusy(true);
    try {
      const result = await integrations.importGoogleCalendar(ids);
      await sync.refresh();
      showDialog('Calendar updated', `${result.imported} imported · ${result.updated} updated`);
    } catch (error) { showDialog('Import failed', userFacingError(error, 'Please try again.')); }
    finally { setBusy(false); }
  };

  const createEvent = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await integrations.createGoogleCalendarEvent({
        title: title.trim(),
        details: details.trim() || undefined,
        startsAt: date.toISOString(),
        date: localDateKey(date),
        allDay: true,
        calendarId: calendars.find((item) => item.selected)?.id,
      });
      setTitle(''); setDetails('');
      await sync.refresh();
      showDialog('Event created', 'It is in Google Calendar and your shared Weship timeline.');
    } catch (error) { showDialog('Could not create event', userFacingError(error, 'Please try again.')); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoider style={[styles.screen, { backgroundColor: theme.bg }]} >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.section}>
          <Text variant="micro" color="textFaint">IMPORT</Text>
          <Text variant="title">Choose calendars</Text>
          {loadingCalendars ? (
            <DataState compact loading title="Loading your calendars" />
          ) : calendarError ? (
            <DataState compact icon="cloud-offline-outline" title="Calendars unavailable" detail={calendarError} />
          ) : calendars.map((calendar, index) => (
            <Pressable key={calendar.id} onPress={() => setCalendars((items) => items.map((item) => item.id === calendar.id ? { ...item, selected: !item.selected } : item))} style={[styles.calendarRow, { borderColor: theme.line }, index > 0 && { borderTopWidth: 0 }]}>
              <View style={[styles.calendarColor, { backgroundColor: calendar.color ?? theme.textSoft }]} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>{calendar.name}</Text>
              <Ionicons name={calendar.selected ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={calendar.selected ? theme.primary : theme.textFaint} />
            </Pressable>
          ))}
          {!loadingCalendars && !calendarError && !calendars.length ? <DataState compact icon="calendar-outline" title="No calendars found" detail="Confirm the connected Google account has a calendar." /> : null}
          <Button full loading={busy} label={busy ? 'Importing…' : 'Import selected events'} disabled={!calendars.some((item) => item.selected)} onPress={importEvents} />
        </View>

        <View style={styles.section}>
          <Text variant="micro" color="textFaint">CREATE</Text>
          <Text variant="title">Add an event</Text>
          <Input value={title} onChangeText={setTitle} placeholder="Birthday, visit, date night…" />
          <Input value={details} onChangeText={setDetails} placeholder="Optional details" />
          <Pressable onPress={() => setShowPicker(true)} style={[styles.dateRow, { backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="calendar-outline" size={20} color={theme.primaryDeep} />
            <Text variant="bodyStrong">{date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </Pressable>
          {showPicker ? <DateTimePicker value={date} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} themeVariant="light" accentColor={theme.primary} onChange={(_, next) => { if (Platform.OS === 'android') setShowPicker(false); if (next) setDate(next); }} /> : null}
          <Button full loading={busy} label={busy ? 'Creating…' : 'Create in Google & Weship'} disabled={!title.trim()} onPress={createEvent} />
        </View>
      </ScrollView>
    </KeyboardAvoider>
  );
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const theme = useTheme();
  return <TextInput {...props} placeholderTextColor={theme.textFaint} selectionColor={theme.primary} style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.line }]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  section: { gap: Spacing.md },
  calendarRow: { minHeight: 56, paddingHorizontal: Spacing.md, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  calendarColor: { width: 10, height: 10, borderRadius: 5 },
  input: { minHeight: 52, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.inset, paddingHorizontal: Spacing.md, fontFamily: Font.sans, fontSize: 16 },
  dateRow: { minHeight: 56, borderRadius: Radius.inset, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
