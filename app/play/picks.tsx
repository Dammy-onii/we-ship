import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
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
import { useAuth } from '@/lib/auth';
import * as games from '@/lib/backend/games';
import { useBackendStatus, usePartner, useSpace } from '@/lib/store';

export default function PickQueueScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const sync = useBackendStatus();
  const space = useSpace();
  const partner = usePartner();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [prompts, setPrompts] = useState<games.ChoicePrompt[]>([]);
  const [loading, setLoading] = useState(sync.mode === 'live');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async (showLoading = true) => {
    if (sync.mode !== 'live') {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      setPrompts(await games.listChoicePrompts());
      setError(undefined);
    } catch (reason) {
      setError(userFacingError(reason, 'Could not load the Pick Together queue.'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [sync.mode]);

  useEffect(() => {
    const initial = setTimeout(() => load(true), 0);
    const unsubscribe = sync.mode === 'live' && space.id !== 'unpaired'
      ? games.subscribeToChoicePrompts(space.id, () => load(false))
      : undefined;
    return () => {
      clearTimeout(initial);
      unsubscribe?.();
    };
  }, [load, space.id, sync.mode]);

  const updateOption = (index: number, value: string) => {
    setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  };

  const cleanOptions = options.map((item) => item.trim()).filter(Boolean);
  const duplicateOption = new Set(cleanOptions.map((item) => item.toLocaleLowerCase())).size !== cleanOptions.length;
  const canAdd = question.trim().length >= 5 && cleanOptions.length >= 2 && !duplicateOption;

  const add = async () => {
    if (!canAdd || busy) return;
    setBusy(true);
    const choiceOptions = cleanOptions.map((label, index) => ({ id: `option-${index + 1}`, label }));
    try {
      if (sync.mode === 'live') {
        if (!auth.user || space.id === 'unpaired') throw new Error('Link your shared space first.');
        await games.addChoicePrompt(space.id, auth.user.id, question, choiceOptions);
        await load(false);
      } else {
        setPrompts((current) => [
          ...current,
          {
            id: `demo-pick-${Date.now()}`,
            question: question.trim(),
            options: choiceOptions,
            createdBy: 'demo',
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      setQuestion('');
      setOptions(['', '']);
      Keyboard.dismiss();
    } catch (reason) {
      Alert.alert('Could not add this pick', userFacingError(reason, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = (prompt: games.ChoicePrompt) => {
    Alert.alert('Remove this pick?', 'Unused picks can be removed from the shared queue.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            if (sync.mode === 'live') await games.deleteChoicePrompt(prompt.id);
            setPrompts((current) => current.filter((item) => item.id !== prompt.id));
          } catch (reason) {
            Alert.alert('Could not remove this pick', userFacingError(reason, 'Please try again.'));
          }
        },
      },
    ]);
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
          <Text variant="micro" color="textFaint">PICK TOGETHER QUEUE</Text>
          <Text variant="display">Plan your next picks</Text>
          <Text variant="body" color="textSoft">
            Add a question and its choices. The oldest queued pick becomes the next round after the current one finishes.
          </Text>
        </View>

        <View style={styles.composer}>
          <Text variant="captionStrong">Question</Text>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="What should we choose together?"
            placeholderTextColor={theme.textFaint}
            selectionColor={theme.primary}
            maxLength={180}
            multiline
            style={[styles.questionInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.lineStrong }]}
          />

          <View style={styles.optionHeading}>
            <Text variant="captionStrong">Choices</Text>
            <Text variant="caption" color="textFaint">2–5 options</Text>
          </View>
          {options.map((option, index) => (
            <View key={index} style={styles.optionRow}>
              <View style={[styles.optionNumber, { backgroundColor: theme.primarySoft }]}>
                <Text variant="captionStrong" color="primaryDeep">{index + 1}</Text>
              </View>
              <TextInput
                value={option}
                onChangeText={(value) => updateOption(index, value)}
                placeholder={`Choice ${index + 1}`}
                placeholderTextColor={theme.textFaint}
                selectionColor={theme.primary}
                maxLength={80}
                style={[styles.optionInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.line }]}
              />
              {options.length > 2 ? (
                <Pressable
                  onPress={() => setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove choice ${index + 1}`}>
                  <Ionicons name="close-circle-outline" size={22} color={theme.textFaint} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {options.length < 5 ? (
            <Button
              label="Add another choice"
              variant="soft"
              size="sm"
              onPress={() => setOptions((current) => [...current, ''])}
              icon={<Ionicons name="add" size={17} color={theme.primaryDeep} />}
            />
          ) : null}
          {duplicateOption ? <Text variant="caption" color="partner">Each choice needs to be different.</Text> : null}
          <Button
            full
            label={busy ? 'Adding…' : 'Add to Pick Together queue'}
            disabled={busy || !canAdd}
            onPress={add}
          />
        </View>

        <View style={styles.queueHeading}>
          <View>
            <Text variant="micro" color="textFaint">COMING UP</Text>
            <Text variant="title">Shared queue</Text>
          </View>
          <View style={[styles.count, { backgroundColor: theme.primarySoft }]}>
            <Text variant="captionStrong" color="primaryDeep">{prompts.length}</Text>
          </View>
        </View>

        {loading ? (
          <DataState loading title="Loading your shared picks" />
        ) : error ? (
          <View style={styles.errorState}>
            <DataState icon="cloud-offline-outline" title="Pick queue unavailable" detail={error} />
            <Button label="Try again" variant="soft" onPress={load} />
          </View>
        ) : !prompts.length ? (
          <DataState icon="git-compare-outline" title="No picks waiting" detail="Add one above and it will become a future round." />
        ) : (
          <View style={[styles.list, { borderTopColor: theme.line, borderBottomColor: theme.line }]}>
            {prompts.map((prompt, index) => {
              const mine = sync.mode !== 'live' || prompt.createdBy === auth.user?.id;
              return (
                <View
                  key={prompt.id}
                  style={[
                    styles.promptRow,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line },
                  ]}>
                  <View style={styles.promptCopy}>
                    <Text variant="bodyStrong">{prompt.question}</Text>
                    <Text variant="caption" color="textSoft">
                      {prompt.options.map((option) => option.label).join(' · ')}
                    </Text>
                    <Text variant="micro" color="textFaint">
                      ADDED BY {mine ? 'YOU' : partner.displayName.toUpperCase()}
                    </Text>
                  </View>
                  {mine ? (
                    <Pressable
                      onPress={() => remove(prompt)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Remove queued pick">
                      <Ionicons name="trash-outline" size={19} color={theme.partner} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  intro: { gap: Spacing.sm },
  composer: { gap: Spacing.md },
  questionInput: {
    minHeight: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.inset,
    padding: Spacing.base,
    fontFamily: Font.sans,
    fontSize: 16,
    lineHeight: 23,
    textAlignVertical: 'top',
  },
  optionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  optionNumber: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  optionInput: { flex: 1, minHeight: 50, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.inset, paddingHorizontal: Spacing.md, fontFamily: Font.sans, fontSize: 16 },
  queueHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { minWidth: 34, height: 34, paddingHorizontal: Spacing.sm, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  promptRow: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  promptCopy: { flex: 1, gap: 5 },
  errorState: { alignItems: 'center', gap: Spacing.sm },
});
