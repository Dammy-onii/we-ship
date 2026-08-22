import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataState } from '@/components/ui/data-state';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { userFacingError } from '@/lib/user-facing-error';
import * as repository from '@/lib/backend/repository';
import { useBackendStatus, useSpace } from '@/lib/store';

export default function PairingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sync = useBackendStatus();
  const space = useSpace();
  const [spaceName, setSpaceName] = useState('Our space');
  const [code, setCode] = useState('');
  const [invite, setInvite] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sync.mode === 'live' && space.id !== 'unpaired') {
      repository.getActiveInvite(space.id).then((value) => setInvite(value?.code)).catch(() => {});
    }
  }, [space.id, sync.mode]);

  const create = async () => {
    setBusy(true);
    try {
      const result = await repository.createSpace(spaceName);
      setInvite(result?.invite_code);
      await sync.refresh();
    } catch (error) {
      Alert.alert('Could not create space', userFacingError(error, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setBusy(true);
    try {
      await repository.joinSpace(code);
      await sync.refresh();
      router.replace('/');
    } catch (error) {
      Alert.alert('Could not join', userFacingError(error, 'Check the invite code and try again.'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (sync.paired) router.replace('/');
  }, [router, sync.paired]);

  if (sync.paired) return null;

  return (
    <KeyboardAvoider style={[styles.screen, { backgroundColor: theme.bg }]} >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.intro}>
          <Text variant="micro" color="textFaint">LAST STEP</Text>
          <Text variant="display">
            {space.id !== 'unpaired' ? 'Waiting for them to join' : 'Who are you sharing with?'}
          </Text>
          <Text variant="body" color="textSoft">
            {space.id !== 'unpaired'
              ? 'Send them this code. As soon as they join, your space opens for both of you.'
              : 'Weship only works with two people. Start a space and invite them, or enter the code they sent you.'}
          </Text>
        </View>

        {space.id !== 'unpaired' ? (
          <Card padded style={styles.card}>
            <Text variant="micro" color="textFaint">INVITE CODE</Text>
            {invite
              ? <Text variant="hero" style={styles.code}>{invite}</Text>
              : <DataState compact loading title="Creating your invite" />}
            <Button
              full
              label="Share code"
              disabled={!invite}
              onPress={() => Share.share({ message: `Join my private Weship space with code ${invite}` })}
            />
            {/* Joining happens on the other device, so nothing here would tell
                us until we look again. */}
            <Button
              full
              variant="ghost"
              label={busy ? 'Checking…' : 'I have joined — check again'}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await sync.refresh();
                } finally {
                  setBusy(false);
                }
              }}
            />
          </Card>
        ) : (
          <>
            <Card padded style={styles.card}>
              <Text variant="micro" color="textFaint">OPTION ONE</Text>
              <Text variant="title">Start a space and invite them</Text>
              <Input value={spaceName} onChangeText={setSpaceName} placeholder="Space name" />
              <Button full label={busy ? 'Creating…' : 'Create space'} disabled={busy || !spaceName.trim()} onPress={create} />
            </Card>
            <View style={styles.orRow}><View style={[styles.line, { backgroundColor: theme.line }]} /><Text variant="micro" color="textFaint">OR</Text><View style={[styles.line, { backgroundColor: theme.line }]} /></View>
            <Card padded style={styles.card}>
              <Text variant="micro" color="textFaint">OPTION TWO</Text>
              <Text variant="title">Join with their code</Text>
              <Input value={code} onChangeText={(value) => setCode(value.toUpperCase())} placeholder="8-character invite code" autoCapitalize="characters" maxLength={8} />
              <Button full label={busy ? 'Linking…' : 'Join space'} disabled={busy || code.trim().length !== 8} onPress={join} />
            </Card>
          </>
        )}
      </ScrollView>
    </KeyboardAvoider>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const theme = useTheme();
  return <TextInput {...props} placeholderTextColor={theme.textFaint} selectionColor={theme.primary} style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.line }]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  intro: { gap: Spacing.sm, paddingTop: Spacing.sm },
  card: { gap: Spacing.md },
  input: { minHeight: 52, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.inset, paddingHorizontal: Spacing.md, fontFamily: Font.sans, fontSize: 16 },
  code: { letterSpacing: 5, textAlign: 'center', marginVertical: Spacing.sm },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
