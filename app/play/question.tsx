import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sprig } from '@/components/art/botanicals';
import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataState } from '@/components/ui/data-state';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { userFacingError } from '@/lib/user-facing-error';
import {
  PARTNER_ID,
  usePartner,
  useQuestionArchive,
  useTodayQuestion,
  useUser,
  YOU_ID,
} from '@/lib/store';
import { relativeDay } from '@/lib/time';

export default function QuestionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { question, answer, setQuestion, answered, partnerAnswered, revealed } = useTodayQuestion();
  const archive = useQuestionArchive();
  const partner = usePartner();
  const [draft, setDraft] = useState('');
  const [questionDraft, setQuestionDraft] = useState('');
  const [settingQuestion, setSettingQuestion] = useState(false);

  const submitAnswer = () => {
    if (!draft.trim()) return;
    answer(draft);
    Keyboard.dismiss();
  };

  const submitQuestion = async () => {
    if (questionDraft.trim().length < 5 || settingQuestion) return;
    setSettingQuestion(true);
    try {
      await setQuestion(questionDraft);
      setQuestionDraft('');
      Keyboard.dismiss();
    } catch (error) {
      const message = userFacingError(error, 'Please try again.');
      // Keep the prompt in the field so the user can retry or copy it.
      Alert.alert('Could not set today’s question', message);
    } finally {
      setSettingQuestion(false);
    }
  };

  return (
    <KeyboardAvoider
      style={{ flex: 1, backgroundColor: theme.bg }}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 48 }}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled">
        {/* Prompt */}
        <View style={styles.promptHead}>
          <Sprig size={30} color={theme.primary} opacity={0.55} />
          <Text variant="micro" color="textFaint">
            {relativeDay(question.promptDate).toUpperCase()} · DAILY QUESTION
          </Text>
        </View>
        <Text variant="hero" style={{ marginTop: Spacing.md, marginBottom: Spacing.xl }}>
          {question.text}
        </Text>

        {!answered && !partnerAnswered ? (
          <View style={[styles.questionSetter, { borderTopColor: theme.line, borderBottomColor: theme.line }]}>
            <View style={{ gap: 3 }}>
              <Text variant="micro" color="textFaint">SET TODAY’S QUESTION</Text>
              <Text variant="caption" color="textSoft">Either of you can replace today’s prompt until someone answers.</Text>
            </View>
            <TextInput
              value={questionDraft}
              onChangeText={setQuestionDraft}
              placeholder="What should you both answer today?"
              placeholderTextColor={theme.textFaint}
              selectionColor={theme.primary}
              maxLength={240}
              multiline
              style={[styles.questionInput, { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}
            />
            <Button
              full
              size="sm"
              label={settingQuestion ? 'Setting…' : 'Use this question today'}
              disabled={settingQuestion || questionDraft.trim().length < 5}
              onPress={submitQuestion}
            />
          </View>
        ) : null}

        {!answered ? (
          <Animated.View entering={FadeInDown.duration(380)}>
            <Card padded elevation="soft" style={{ gap: Spacing.base }}>
              <Text variant="micro" color="textFaint">
                YOUR ANSWER
              </Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Say what’s true for you…"
                placeholderTextColor={theme.textFaint}
                selectionColor={theme.primary}
                autoCapitalize="sentences"
                autoCorrect
                maxLength={600}
                accessibilityLabel="Your answer"
                multiline
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.line },
                ]}
              />
              <Button
                label={`Share with ${partner.displayName}`}
                full
                disabled={!draft.trim()}
                onPress={submitAnswer}
              />
              <View style={styles.lockNote}>
                <Ionicons name="lock-closed-outline" size={13} color={theme.textFaint} />
                <Text variant="caption" color="textFaint" style={{ flex: 1 }}>
                  {partnerAnswered
                    ? `${partner.displayName} already answered — their answer unlocks once you share yours.`
                    : `Your answers stay private until ${partner.displayName} answers too.`}
                </Text>
              </View>
            </Card>
          </Animated.View>
        ) : (
          <View style={{ gap: Spacing.md }}>
            <AnswerCard userId={YOU_ID} text={question.answers[YOU_ID]?.text ?? ''} />
            {revealed ? (
              <Animated.View entering={FadeIn.duration(500)}>
                <AnswerCard userId={PARTNER_ID} text={question.answers[PARTNER_ID]?.text ?? ''} />
              </Animated.View>
            ) : (
              <Card padded elevation="subtle" style={{ alignItems: 'center', gap: Spacing.sm }}>
                <Sprig size={34} color={theme.primary} opacity={0.5} />
                <Text variant="caption" color="textFaint" center>
                  Waiting for {partner.displayName}…
                </Text>
              </Card>
            )}
            <ReactionRow />
          </View>
        )}

        <SectionHeader
          overline="Archive"
          title="Past answers"
          action="Question queue"
          onAction={() => router.push('/play/questions')}
        />
        <View style={{ gap: Spacing.md }}>
          {!archive.length ? (
            <DataState compact icon="archive-outline" title="No past answers yet" detail="Answered daily questions will collect here." />
          ) : archive.map((q) => (
            <Card key={q.id} padded elevation="subtle" style={{ gap: Spacing.md }}>
              <View>
                <Text variant="micro" color="textFaint" style={{ marginBottom: 5 }}>
                  {relativeDay(q.promptDate).toUpperCase()}
                </Text>
                <Text variant="title" style={{ fontSize: 18, lineHeight: 25 }}>
                  {q.text}
                </Text>
              </View>
              <View style={{ gap: Spacing.sm }}>
                <MiniAnswer userId={YOU_ID} text={q.answers[YOU_ID]?.text} />
                <MiniAnswer userId={PARTNER_ID} text={q.answers[PARTNER_ID]?.text} />
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoider>
  );
}

function AnswerCard({ userId, text }: { userId: string; text: string }) {
  const theme = useTheme();
  const user = useUser(userId);
  const mine = userId === YOU_ID;
  const accent = mine ? theme.primary : theme.partner;

  return (
    <Card padded elevation="soft" style={{ gap: Spacing.md }}>
      <View style={styles.answerHead}>
        <Avatar name={user.displayName} seed={user.photoSeed} uri={user.photoUri} ring={user.color} size={28} />
        <Text variant="captionStrong" color={mine ? 'primary' : 'partner'}>
          {mine ? 'You' : user.displayName}
        </Text>
        <View style={[styles.voiceBar, { backgroundColor: accent + '33' }]} />
      </View>
      <Text variant="serif" style={{ fontSize: 16, lineHeight: 26 }}>
        {text}
      </Text>
    </Card>
  );
}

function ReactionRow() {
  const theme = useTheme();
  const [picked, setPicked] = useState<string | null>(null);
  const reactions = ['🌿', '💛', '🥹', '😂'];

  return (
    <View style={styles.reactions}>
      {reactions.map((r) => {
        const on = picked === r;
        return (
          <Pressable
            key={r}
            onPress={() => setPicked(on ? null : r)}
            accessibilityLabel={`React ${r}`}
            style={[
              styles.reaction,
              {
                backgroundColor: on ? theme.primarySoft : theme.surface,
                borderColor: on ? theme.primary : theme.line,
              },
            ]}>
            <Text style={{ fontSize: 17 }}>{r}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MiniAnswer({ userId, text }: { userId: string; text?: string }) {
  const theme = useTheme();
  const user = useUser(userId);
  const mine = userId === YOU_ID;
  if (!text) return null;
  return (
    <View style={styles.miniRow}>
      <View style={[styles.miniBar, { backgroundColor: mine ? theme.primary : theme.partner }]} />
      <View style={{ flex: 1 }}>
        <Text variant="micro" color={mine ? 'primary' : 'partner'} style={{ marginBottom: 2 }}>
          {(mine ? 'You' : user.displayName).toUpperCase()}
        </Text>
        <Text variant="caption" color="textSoft">
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  promptHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  input: {
    minHeight: 108,
    borderRadius: Radius.inset,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.base,
    fontFamily: Font.sans,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  lockNote: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  questionSetter: { gap: Spacing.md, paddingVertical: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: Spacing.xl },
  questionInput: { minHeight: 82, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.inset, padding: Spacing.md, fontFamily: Font.sans, fontSize: 16, lineHeight: 23, textAlignVertical: 'top' },
  answerHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  voiceBar: { flex: 1, height: 2, borderRadius: 1, marginLeft: 4 },
  reactions: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center', marginTop: 4 },
  reaction: {
    width: 46,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniRow: { flexDirection: 'row', gap: Spacing.md },
  miniBar: { width: 2.5, borderRadius: 2, alignSelf: 'stretch' },
});
