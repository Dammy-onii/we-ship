import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { DataState } from '@/components/ui/data-state';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNotes, usePartner, useUser, YOU_ID } from '@/lib/store';
import { relativeDay } from '@/lib/time';

export default function NotesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { notes, addNote } = useNotes();
  const partner = usePartner();
  const [draft, setDraft] = useState('');

  const submit = () => {
    if (!draft.trim()) return;
    addNote(draft);
    setDraft('');
    Keyboard.dismiss();
  };

  return (
    <KeyboardAvoider
      style={{ flex: 1, backgroundColor: theme.bg }}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}>
        {!notes.length ? (
          <DataState icon="document-text-outline" title="No notes yet" detail={`Leave ${partner.displayName} the first note below.`} />
        ) : notes.map((n, i) => (
          <Animated.View key={n.id} entering={FadeInDown.duration(320).delay(Math.min(i, 5) * 50)}>
            <NoteCard authorId={n.authorId} text={n.text} at={n.createdAt} pinned={n.pinned} />
          </Animated.View>
        ))}
      </ScrollView>

      <View
        style={[
          styles.composer,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.line,
            paddingBottom: insets.bottom + 12,
          },
        ]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`Leave ${partner.displayName} a note…`}
          placeholderTextColor={theme.textFaint}
          selectionColor={theme.primary}
          autoCapitalize="sentences"
          autoCorrect
          clearButtonMode="while-editing"
          maxLength={240}
          accessibilityLabel={`Note for ${partner.displayName}`}
          style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
          onSubmitEditing={submit}
          returnKeyType="send"
        />
        <Pressable
          onPress={submit}
          disabled={!draft.trim()}
          accessibilityLabel="Send note"
          style={[styles.send, { backgroundColor: draft.trim() ? theme.primary : theme.surfaceSunk }]}>
          <Ionicons
            name="arrow-up"
            size={19}
            color={draft.trim() ? theme.onPrimary : theme.textFaint}
          />
        </Pressable>
      </View>
    </KeyboardAvoider>
  );
}

function NoteCard({
  authorId,
  text,
  at,
  pinned,
}: {
  authorId: string;
  text: string;
  at: string;
  pinned?: boolean;
}) {
  const theme = useTheme();
  const user = useUser(authorId);
  const mine = authorId === YOU_ID;
  const accent = mine ? theme.primary : theme.partner;

  return (
    <Card
      padded
      elevation="subtle"
      style={{
        flexDirection: 'row',
        gap: Spacing.md,
        alignItems: 'flex-start',
        backgroundColor: mine ? theme.primarySoft : theme.partnerSoft,
        borderColor: accent + '2E',
      }}>
      <View style={[styles.bar, { backgroundColor: accent }]} />
      <Avatar name={user.displayName} seed={user.photoSeed} uri={user.photoUri} ring={user.color} size={32} />
      <View style={{ flex: 1 }}>
        <Text variant="serif" style={{ fontSize: 15, lineHeight: 24 }}>
          {text}
        </Text>
        <Text variant="micro" color="textFaint" style={{ marginTop: 7 }}>
          {(mine ? 'YOU' : user.displayName.toUpperCase())} · {relativeDay(at.slice(0, 10)).toUpperCase()}
        </Text>
      </View>
      {pinned && <Ionicons name="bookmark" size={15} color={theme.gold} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  bar: { width: 3, borderRadius: 2, alignSelf: 'stretch' },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    fontFamily: Font.sans,
    fontSize: 16,
  },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
