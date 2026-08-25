import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sprig } from '@/components/art/botanicals';
import { TaskCompletionDialog } from '@/components/task-completion-dialog';
import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { showDialog } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/use-theme';
import {
  PARTNER_ID,
  useBackendStatus,
  useLog,
  useMissedPeriods,
  usePartner,
  YOU_ID,
} from '@/lib/store';
import type { MissedPeriod } from '@/lib/task-periods';
import type { TaskRoutine } from '@/lib/types';

const ROUTINES: TaskRoutine[] = ['daily', 'weekly', 'monthly'];

/** How many missed periods the page shows before the rest move into the sheet. */
const VISIBLE_MISSED = 6;

export default function TodoScreen() {
  const theme = useTheme();
  const partner = usePartner();
  const insets = useSafeAreaInsets();
  const { today, habits, toggleHabit, deleteTask } = useLog();
  const open = habits.filter((task) => !today.habits[task.id]?.[YOU_ID]);
  const done = habits.filter((task) => today.habits[task.id]?.[YOU_ID]);
  const completed = done.length;
  const [noteTask, setNoteTask] = useState<{ id: string; label: string }>();
  const missed = useMissedPeriods();
  const [showAllMissed, setShowAllMissed] = useState(false);
  const [showDone, setShowDone] = useState(true);

  const toggle = (task: (typeof habits)[number], done: boolean) => {
    if (!done && task.noteRequired) {
      setNoteTask({ id: task.id, label: task.label });
      return;
    }
    toggleHabit(task.id);
  };

  const confirmDelete = (id: string, label: string) => {
    showDialog('Delete shared task?', `“${label}” will be removed for both of you.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTask(id) },
    ]);
  };

  return (
    <KeyboardAvoider
      style={[styles.screen, { backgroundColor: theme.bg }]}
      >
      <ScrollView
        style={{ backgroundColor: theme.bg }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
      <View style={styles.intro}>
        <Text variant="micro" color="textFaint">
          TOGETHER
        </Text>
        <Text variant="display">Shared tasks</Text>
        <Text variant="body" color="textSoft">
          The small things you’re both keeping up with.
        </Text>
      </View>

      <PairingNotice />
      <TaskComposer />

      <View style={[styles.progress, { backgroundColor: theme.surfaceAlt }]}>
        <View style={styles.progressCopy}>
          <Text variant="bodyStrong">
            {completed} of {habits.length} done by you
          </Text>
          <Text variant="caption" color="textFaint">
            Tap its checkbox to update your side.
          </Text>
        </View>
        <View style={[styles.progressBadge, { backgroundColor: theme.surface }]}>
          <Text variant="title" color="primaryDeep">
            {completed}/{habits.length}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="micro" color="textFaint">
          YOUR LIST
        </Text>
        <View
          style={[
            styles.taskList,
            { borderTopColor: theme.line, borderBottomColor: theme.line },
          ]}>
          {habits.length === 0 ? (
            <View style={styles.emptyState}>
              <Text variant="bodyStrong">Nothing here yet</Text>
              <Text variant="caption" color="textFaint">
                Add the first thing you want to keep up with together.
              </Text>
            </View>
          ) : open.length === 0 ? (
            <View style={styles.emptyState}>
              <Text variant="bodyStrong">All caught up</Text>
              <Text variant="caption" color="textFaint">
                Everything on your list is ticked off for this period.
              </Text>
            </View>
          ) : (
            open.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                mine={false}
                theirs={today.habits[task.id]?.[PARTNER_ID] ?? false}
                partnerName={partner.displayName}
                separated={index < open.length - 1}
                onToggle={() => toggle(task, false)}
                onDelete={() => confirmDelete(task.id, task.label)}
              />
            ))
          )}
        </View>
      </View>

      {/*
        * A section of its own rather than struck-through rows mixed into the
        * list. With both states interleaved there was nowhere to look to see
        * what had actually been done, and no way to tell a finished list from
        * an empty one.
        */}
      {done.length ? (
        <View style={styles.section}>
          <Pressable
            onPress={() => setShowDone((current) => !current)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showDone }}
            style={styles.missedHead}>
            <Text variant="micro" color="textFaint">
              COMPLETED BY YOU
            </Text>
            <View style={styles.doneToggle}>
              <Text variant="micro" color="textFaint">
                {done.length}
              </Text>
              <Ionicons
                name={showDone ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={theme.textFaint}
              />
            </View>
          </Pressable>
          {showDone ? (
            <View
              style={[
                styles.taskList,
                { borderTopColor: theme.line, borderBottomColor: theme.line },
              ]}>
              {done.map((task, index) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  mine
                  theirs={today.habits[task.id]?.[PARTNER_ID] ?? false}
                  partnerName={partner.displayName}
                  separated={index < done.length - 1}
                  onToggle={() => toggle(task, true)}
                  onDelete={() => confirmDelete(task.id, task.label)}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.missedHead}>
          <Text variant="micro" color="textFaint">
            MISSED PERIODS
          </Text>
          <Text variant="micro" color="textFaint">
            {missed.length}
          </Text>
        </View>
        {missed.length ? (
          <>
            <View
              style={[
                styles.taskList,
                { borderTopColor: theme.line, borderBottomColor: theme.line },
              ]}>
              {missed.slice(0, VISIBLE_MISSED).map((item, index) => (
                <MissedRow
                  key={`${item.taskId}-${item.periodKey}`}
                  item={item}
                  separated={index > 0}
                  partnerName={partner.displayName}
                />
              ))}
            </View>
            {missed.length > VISIBLE_MISSED ? (
              <Button
                variant="ghost"
                label={`See all ${missed.length}`}
                onPress={() => setShowAllMissed(true)}
              />
            ) : null}
          </>
        ) : (
          <View style={[styles.missedEmpty, { backgroundColor: theme.surfaceAlt }]}>
            <View style={[styles.missedDot, { backgroundColor: theme.surface }]}>
              <Ionicons name="calendar-outline" size={15} color={theme.textFaint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">No missed periods</Text>
              <Text variant="caption" color="textFaint">
                Finished daily, weekly and monthly intervals will appear here when either person leaves a task open.
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Sprig size={25} color={theme.primary} opacity={0.45} />
        <Text variant="caption" color="textFaint" center>
          Shared progress, without pressure.
        </Text>
      </View>
      </ScrollView>
      {showAllMissed ? (
        <MissedSheet
          missed={missed}
          partnerName={partner.displayName}
          onClose={() => setShowAllMissed(false)}
        />
      ) : null}

      <TaskCompletionDialog
        key={noteTask?.id ?? 'no-task'}
        task={noteTask}
        onCancel={() => setNoteTask(undefined)}
        onComplete={(id, note) => {
          toggleHabit(id, note);
          setNoteTask(undefined);
        }}
      />
    </KeyboardAvoider>
  );
}

/**
 * Live mode only persists writes inside a Space. Without this, adding a task
 * while unpaired looks like it worked and then silently vanishes on refresh.
 */
/** One period a task went unfinished. */
function MissedRow({
  item,
  separated,
  partnerName,
}: {
  item: MissedPeriod;
  separated: boolean;
  partnerName: string;
}) {
  const theme = useTheme();
  // Names who let it slip, because "wasn't done" reads as an accusation when
  // only one of you missed it and the other did their part. Built as a whole
  // sentence rather than a subject glued to a fixed verb — "Neither of you" and
  // "didn't do this" collided into a double negative.
  const sentence = item.missedByYou && item.missedByPartner
    ? 'Neither of you completed this'
    : item.missedByYou
      ? 'You did not complete this'
      : `${partnerName} did not complete this`;

  return (
    <View
      style={[
        styles.missedRow,
        separated && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line },
      ]}>
      <View style={[styles.missedDot, { backgroundColor: theme.surfaceAlt }]}>
        <Ionicons name="ellipse-outline" size={13} color={theme.textFaint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {item.label}
        </Text>
        <Text variant="caption" color="textFaint">
          {sentence}
        </Text>
        <View style={styles.missedPeriod}>
          <Ionicons name="calendar-outline" size={12} color={theme.textFaint} />
          <Text variant="micro" color="textFaint">
            {item.periodLabel}
          </Text>
        </View>
      </View>
      <Text variant="micro" color="textFaint">
        {item.routine.toUpperCase()}
      </Text>
    </View>
  );
}

/** Everything the page's short list left out. */
function MissedSheet({
  missed,
  partnerName,
  onClose,
}: {
  missed: MissedPeriod[];
  partnerName: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.bg, paddingBottom: insets.bottom + Spacing.lg },
          ]}>
          <View style={[styles.grabber, { backgroundColor: theme.line }]} />
          <View style={styles.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text variant="title">Missed periods</Text>
              <Text variant="caption" color="textFaint">
                {`${missed.length} missed ${missed.length === 1 ? 'period' : 'periods'}`}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={theme.textSoft} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {missed.map((item, index) => (
              <MissedRow
                key={`${item.taskId}-${item.periodKey}`}
                item={item}
                separated={index > 0}
                partnerName={partnerName}
              />
            ))}
            <Text variant="caption" color="textFaint" center style={{ paddingVertical: Spacing.md }}>
              Daily tasks are tracked for a week, weekly ones for three weeks, and monthly ones for two months.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PairingNotice() {
  const theme = useTheme();
  const router = useRouter();
  const sync = useBackendStatus();
  if (sync.mode !== 'live' || sync.paired) return null;

  return (
    <Pressable
      onPress={() => router.push('/pairing')}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.notice,
        { backgroundColor: theme.surfaceAlt, borderColor: theme.line },
        pressed && { opacity: 0.7 },
      ]}>
      <Ionicons name="people-outline" size={18} color={theme.textSoft} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">Join a shared space to save tasks</Text>
        <Text variant="caption" color="textFaint">
          Until then, changes here can’t be saved. Tap to create or join one.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={theme.textFaint} />
    </Pressable>
  );
}

function TaskComposer() {
  const theme = useTheme();
  const { addTask } = useLog();
  const [draft, setDraft] = useState('');
  const [routine, setRoutine] = useState<TaskRoutine>('daily');
  const [noteRequired, setNoteRequired] = useState(false);
  const [focused, setFocused] = useState(false);

  const submitTask = () => {
    if (!draft.trim()) return;
    addTask({ label: draft, routine, noteRequired });
    setDraft('');
    setRoutine('daily');
    setNoteRequired(false);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.section}>
      <Text variant="micro" color="textFaint">
        ADD A TASK
      </Text>
      <Text variant="title">Something to share</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={submitTask}
        autoCapitalize="sentences"
        autoCorrect
        clearButtonMode="while-editing"
        maxLength={80}
        returnKeyType="done"
        placeholder="e.g. Pick a date-night film"
        placeholderTextColor={theme.textFaint}
        selectionColor={theme.primary}
        accessibilityLabel="Task name"
        accessibilityHint="Enter the shared task you want to add"
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: focused ? theme.primary : theme.line,
          },
        ]}
      />

      <Text variant="micro" color="textFaint">
        ROUTINE
      </Text>
      <View style={styles.routines}>
        {ROUTINES.map((option) => {
          const selected = routine === option;
          return (
            <Pressable
              key={option}
              onPress={() => setRoutine(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.routineButton,
                {
                  backgroundColor: selected ? theme.primarySoft : theme.surface,
                  borderColor: selected ? theme.primary : theme.line,
                },
              ]}>
              <Text variant="captionStrong" color={selected ? 'primaryDeep' : 'textSoft'}>
                {option[0].toUpperCase() + option.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.noteToggle, { backgroundColor: theme.surfaceAlt }]}>
        <View style={styles.noteToggleCopy}>
          <Text variant="bodyStrong">Require a completion note</Text>
          <Text variant="caption" color="textFaint">
            Mark whether this task needs a note when completed.
          </Text>
        </View>
        <Switch
          value={noteRequired}
          onValueChange={setNoteRequired}
          accessibilityLabel="Require a completion note"
          trackColor={{ false: theme.lineStrong, true: theme.primarySoft }}
          thumbColor={noteRequired ? theme.primary : theme.surface}
        />
      </View>

      <Button
        label="Add task"
        onPress={submitTask}
        disabled={!draft.trim()}
        full
        icon={<Ionicons name="add" size={18} color={theme.onPrimary} />}
      />
    </View>
  );
}

/**
 * One shared task. Extracted so the open list and the completed list render
 * identically rather than diverging.
 */
function TaskRow({
  task,
  mine,
  theirs,
  partnerName,
  separated,
  onToggle,
  onDelete,
}: {
  task: { id: string; label: string; color: string; routine: TaskRoutine; noteRequired: boolean };
  mine: boolean;
  theirs: boolean;
  partnerName: string;
  separated: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.task,
        separated && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.line,
        },
      ]}>
      <View style={styles.taskMain}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: mine }}
          accessibilityLabel={`${mine ? 'Reopen' : 'Complete'} ${task.label}`}
          hitSlop={10}
          style={[
            styles.check,
            {
              backgroundColor: mine ? task.color : 'transparent',
              borderColor: mine ? task.color : theme.lineStrong,
            },
          ]}>
          {mine ? <Ionicons name="checkmark" size={14} color="#FFFCF7" /> : null}
        </Pressable>

        <View style={styles.taskCopy}>
          <Text
            variant="bodyStrong"
            style={mine ? { color: theme.textFaint, textDecorationLine: 'line-through' } : undefined}>
            {task.label}
          </Text>
          <View style={styles.metadata}>
            <View style={[styles.metaPill, { backgroundColor: theme.surfaceAlt }]}>
              <Ionicons name="repeat-outline" size={12} color={theme.textSoft} />
              <Text variant="micro" color="textSoft">
                {task.routine.toUpperCase()}
              </Text>
            </View>
            {task.noteRequired ? (
              <View style={styles.noteMeta}>
                <Ionicons name="document-text-outline" size={12} color={theme.textFaint} />
                <Text variant="micro" color="textFaint">
                  NOTE REQUIRED
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.people}>
            <PersonState label="You" done={mine} color={theme.primary} />
            <PersonState label={partnerName} done={theirs} color={theme.partner} />
          </View>
        </View>
      </View>

      <Pressable
        onPress={onDelete}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${task.label}`}
        style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.5 }]}>
        <Ionicons name="trash-outline" size={18} color={theme.textFaint} />
      </Pressable>
    </View>
  );
}

function PersonState({ label, done, color }: { label: string; done: boolean; color: string }) {
  return (
    <View style={styles.personState}>
      <View
        style={[
          styles.personDot,
          { backgroundColor: done ? color : 'transparent', borderColor: color },
        ]}
      />
      <Text variant="micro" color="textFaint">
        {label.toUpperCase()} {done ? 'DONE' : 'OPEN'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.inset,
    borderWidth: StyleSheet.hairlineWidth,
  },
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  intro: { gap: Spacing.sm, paddingTop: Spacing.sm },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.base,
    borderRadius: Radius.inset,
  },
  progressCopy: { flex: 1, gap: 3 },
  progressBadge: {
    minWidth: 58,
    height: 48,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { gap: Spacing.sm },
  taskList: {
    marginHorizontal: -Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  task: {
    minHeight: 116,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.md,
  },
  taskMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.base,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  taskCopy: { flex: 1, gap: Spacing.sm },
  metadata: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  noteMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  personState: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  personDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1 },
  deleteButton: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  emptyState: { padding: Spacing.lg, gap: 4 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Radius.inset,
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
    fontFamily: Font.sans,
    fontSize: 16,
  },
  doneToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  missedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  missedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    // The list around these rows bleeds to the screen edge so its rules run
    // full width. Without this the *content* bled with it, and the routine
    // label on the right was clipped by the edge of the display.
    paddingHorizontal: Spacing.lg,
  },
  missedPeriod: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  missedEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.inset,
    padding: Spacing.base,
  },
  missedDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24,20,17,0.42)' },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingBottom: Spacing.sm },
  routines: { flexDirection: 'row', gap: Spacing.sm },
  routineButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.base,
    borderRadius: Radius.inset,
  },
  noteToggleCopy: { flex: 1, gap: 2 },
  footer: { alignItems: 'center', gap: Spacing.sm },
});
