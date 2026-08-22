import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/ui/data-state';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { userFacingError } from '@/lib/user-facing-error';
import { useQuestionQueue, useUser, YOU_ID } from '@/lib/store';

export default function QuestionQueueScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { questions, addQuestion, deleteQuestion } = useQuestionQueue();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const prompt = draft.trim();
    if (prompt.length < 5 || busy) return;
    setBusy(true);
    try {
      await addQuestion(prompt);
      setDraft('');
      Keyboard.dismiss();
    } catch (error) {
      Alert.alert('Could not add question', userFacingError(error, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) => {
    Alert.alert(
      'Remove this question?',
      'It will be removed from your shared queue. Questions already used cannot be removed here.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteQuestion(id).catch((error) => {
            Alert.alert('Could not remove question', userFacingError(error, 'Please try again.'));
          }),
        },
      ],
    );
  };

  return (
    <KeyboardAvoider
      style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.intro}>
          <Text variant="micro" color="textFaint">SHARED QUESTION QUEUE</Text>
          <Text variant="display">Ask what matters to you</Text>
          <Text variant="body" color="textSoft">
            Add prompts for both of you. Weship uses the oldest queued question on the next new day, before its built-in prompts.
          </Text>
        </View>

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="What would you love to ask each other?"
            placeholderTextColor={theme.textFaint}
            selectionColor={theme.primary}
            multiline
            maxLength={240}
            autoCapitalize="sentences"
            autoCorrect
            accessibilityLabel="New shared question"
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.surface, borderColor: theme.lineStrong },
            ]}
          />
          <View style={styles.composerFoot}>
            <Text variant="caption" color="textFaint">{draft.length}/240</Text>
            <Button
              label={busy ? 'Adding…' : 'Add to queue'}
              disabled={busy || draft.trim().length < 5}
              onPress={add}
              icon={<Ionicons name="add" size={18} color={theme.onPrimary} />}
            />
          </View>
        </View>

        <View style={styles.queueHead}>
          <View>
            <Text variant="micro" color="textFaint">COMING UP</Text>
            <Text variant="title">Your questions</Text>
          </View>
          <View style={[styles.count, { backgroundColor: theme.primarySoft }]}>
            <Text variant="captionStrong" color="primaryDeep">{questions.length}</Text>
          </View>
        </View>

        <View style={[styles.list, { borderTopColor: theme.line, borderBottomColor: theme.line }]}>
          {questions.length ? questions.map((question, index) => (
            <QuestionRow
              key={question.id}
              question={question}
              separated={index > 0}
              onRemove={() => remove(question.id)}
            />
          )) : (
            <DataState icon="chatbubbles-outline" title="No custom questions waiting" detail="Add one above and it will join your shared daily queue." />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoider>
  );
}

function QuestionRow({
  question,
  separated,
  onRemove,
}: {
  question: ReturnType<typeof useQuestionQueue>['questions'][number];
  separated: boolean;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const author = useUser(question.createdBy);
  const mine = question.createdBy === YOU_ID;
  return (
    <View style={[
      styles.row,
      separated && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line },
    ]}>
      <View style={[styles.order, { backgroundColor: theme.primarySoft }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={17} color={theme.primaryDeep} />
      </View>
      <View style={styles.rowCopy}>
        <Text variant="bodyStrong">{question.text}</Text>
        <Text variant="caption" color="textFaint">Added by {mine ? 'you' : author.displayName}</Text>
      </View>
      {mine ? (
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Remove question">
          <Ionicons name="trash-outline" size={19} color={theme.partner} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  intro: { gap: Spacing.sm },
  composer: { gap: Spacing.md },
  input: {
    minHeight: 126,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.inset,
    padding: Spacing.base,
    fontFamily: Font.sans,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  composerFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  queueHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { minWidth: 34, height: 34, paddingHorizontal: Spacing.sm, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  order: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
});
