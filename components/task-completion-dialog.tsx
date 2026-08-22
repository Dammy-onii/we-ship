import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function TaskCompletionDialog({
  task,
  onCancel,
  onComplete,
}: {
  task?: { id: string; label: string };
  onCancel: () => void;
  onComplete: (taskId: string, note: string) => void;
}) {
  const theme = useTheme();
  const [note, setNote] = useState('');
  if (!task) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Cancel" />
        <KeyboardAvoider
          style={styles.avoider}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
            automaticallyAdjustKeyboardInsets>
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text variant="title">Add a completion note</Text>
              <Text variant="caption" color="textSoft">{task.label}</Text>
              <TextInput
                autoFocus
                multiline
                value={note}
                onChangeText={setNote}
                maxLength={240}
                placeholder="What did you do, notice, or want your partner to know?"
                placeholderTextColor={theme.textFaint}
                selectionColor={theme.primary}
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.line },
                ]}
              />
              <View style={styles.actions}>
                <Button label="Cancel" variant="soft" onPress={onCancel} />
                <Button
                  label="Complete"
                  disabled={!note.trim()}
                  onPress={() => onComplete(task.id, note.trim())}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoider>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18,17,16,0.45)' },
  avoider: { maxHeight: '90%' },
  scroll: { flexGrow: 1, justifyContent: 'flex-end', padding: Spacing.lg },
  card: { borderRadius: Radius.card, padding: Spacing.lg, gap: Spacing.md },
  input: {
    minHeight: 110,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.inset,
    padding: Spacing.md,
    fontFamily: Font.sans,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
});
