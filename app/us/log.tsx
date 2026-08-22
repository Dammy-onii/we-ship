import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Keyboard,
  Alert,
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
import { useTheme } from '@/hooks/use-theme';
import { PARTNER_ID, useBackendStatus, useLog, usePartner, YOU_ID } from '@/lib/store';
import type { TaskRoutine } from '@/lib/types';

const ROUTINES: TaskRoutine[] = ['daily', 'weekly', 'monthly'];

export default function TodoScreen() {
  const theme = useTheme();
  const partner = usePartner();
  const insets = useSafeAreaInsets();
  const { today, habits, toggleHabit, deleteTask } = useLog();
  const completed = habits.filter((task) => today.habits[task.id]?.[YOU_ID]).length;
  const [noteTask, setNoteTask] = useState<{ id: string; label: string }>();

  const toggle = (task: (typeof habits)[number], done: boolean) => {
    if (!done && task.noteRequired) {
      setNoteTask({ id: task.id, label: task.label });
      return;
    }
    toggleHabit(task.id);
  };

  const confirmDelete = (id: string, label: string) => {
    Alert.alert('Delete shared task?', `“${label}” will be removed for both of you.`, [
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
          ) : (
            habits.map((task, index) => {
              const mine = today.habits[task.id]?.[YOU_ID] ?? false;
              const theirs = today.habits[task.id]?.[PARTNER_ID] ?? false;

              return (
                <View
                  key={task.id}
                  style={[
                    styles.task,
                    index < habits.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.line,
                    },
                  ]}>
                  <View style={styles.taskMain}>
                    <Pressable
                      onPress={() => toggle(task, mine)}
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
                        style={
                          mine
                            ? { color: theme.textFaint, textDecorationLine: 'line-through' }
                            : undefined
                        }>
                        {task.label}
                      </Text>
                      <View style={styles.metadata}>
                        <View style={[styles.metaPill, { backgroundColor: theme.surfaceAlt }]}>
                          <Ionicons name="repeat-outline" size={12} color={theme.textSoft} />
                          <Text variant="micro" color="textSoft">
                            {task.routine.toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.noteMeta}>
                          <Ionicons
                            name={task.noteRequired ? 'document-text-outline' : 'remove-outline'}
                            size={12}
                            color={theme.textFaint}
                          />
                          <Text variant="micro" color="textFaint">
                            {task.noteRequired ? 'NOTE REQUIRED' : 'NO NOTE'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.people}>
                        <PersonState label="You" done={mine} color={theme.primary} />
                        <PersonState
                          label={partner.displayName}
                          done={theirs}
                          color={theme.partner}
                        />
                      </View>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => confirmDelete(task.id, task.label)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${task.label}`}
                    style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.5 }]}>
                    <Ionicons name="trash-outline" size={18} color={theme.textFaint} />
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Sprig size={25} color={theme.primary} opacity={0.45} />
        <Text variant="caption" color="textFaint" center>
          Shared progress, without pressure.
        </Text>
      </View>
      </ScrollView>
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
