import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataState } from '@/components/ui/data-state';
import { Text } from '@/components/ui/text';
import { showDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Font, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { userFacingError } from '@/lib/user-facing-error';
import * as repository from '@/lib/backend/repository';
import { useBackendStatus, useMe, usePartner, useSpace } from '@/lib/store';
import { relativeDay } from '@/lib/time';

/**
 * New invite codes are six characters, but codes issued before that change are
 * eight and stay valid — `join_pair_space` matches the stored value and never
 * its length. The input therefore has to accept the whole range, or anyone
 * holding an older invite is locked out of the space they were invited to.
 */
const CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 8;

export default function PairingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sync = useBackendStatus();
  const space = useSpace();
  const toast = useToast();
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
      showDialog('Could not create space', userFacingError(error, 'Please try again.'));
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
      showDialog('Could not join', userFacingError(error, 'Check the invite code and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!invite) return;
    await Clipboard.setStringAsync(invite);
    toast.show('Invite code copied to your clipboard.', { tone: 'success' });
  };

  const skip = () => router.replace('/');

  // Reached from the profile once a Space exists: this used to render nothing
  // at all, so "Shared space" opened a blank screen.
  if (sync.paired) return <PairedSpace />;

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
            {invite ? (
              <Pressable
                onPress={copyCode}
                accessibilityRole="button"
                accessibilityLabel={`Invite code ${invite.split('').join(' ')}. Tap to copy.`}
                style={({ pressed }) => [
                  styles.codeBox,
                  { backgroundColor: theme.surfaceAlt, borderColor: theme.line },
                  pressed && { opacity: 0.7 },
                ]}>
                <Text variant="hero" style={styles.code}>{invite}</Text>
                <View style={styles.copyHint}>
                  <Ionicons name="copy-outline" size={14} color={theme.textFaint} />
                  <Text variant="micro" color="textFaint">TAP TO COPY</Text>
                </View>
              </Pressable>
            ) : (
              <DataState compact loading title="Creating your invite" />
            )}
            <Button
              full
              label="Copy code"
              variant="soft"
              disabled={!invite}
              icon={<Ionicons name="copy-outline" size={17} color={theme.primaryDeep} />}
              onPress={copyCode}
            />
            <Button
              full
              label="Share code"
              disabled={!invite}
              onPress={async () => {
                // Copied as well as shared: share sheets are easy to dismiss by
                // accident, and the code is then gone.
                await Clipboard.setStringAsync(invite ?? '');
                Share.share({ message: `Join my private Weship space with code ${invite}` });
              }}
            />
            {/* Joining happens on the other device, so nothing here would tell
                us until we look again. */}
            <Button
              full
              variant="ghost"
              loading={busy}
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
              <Input value={spaceName} onChangeText={setSpaceName} placeholder="Space name" maxLength={40} />
              <Text variant="caption" color="textFaint">
                You will both see this name at the top of your space. You can change it later.
              </Text>
              <Button full loading={busy} label={busy ? 'Creating…' : 'Create space'} disabled={!spaceName.trim()} onPress={create} />
            </Card>
            <View style={styles.orRow}><View style={[styles.line, { backgroundColor: theme.line }]} /><Text variant="micro" color="textFaint">OR</Text><View style={[styles.line, { backgroundColor: theme.line }]} /></View>
            <Card padded style={styles.card}>
              <Text variant="micro" color="textFaint">OPTION TWO</Text>
              <Text variant="title">Join with their code</Text>
              <Input
                value={code}
                onChangeText={(value) => setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder={`${CODE_LENGTH}-character invite code`}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={MAX_CODE_LENGTH}
                style={styles.codeInput}
              />
              <Button
                full
                loading={busy}
                label={busy ? 'Linking…' : 'Join space'}
                disabled={busy || code.trim().length < CODE_LENGTH}
                onPress={join}
              />
            </Card>
          </>
        )}

        {/* Someone whose partner has not signed up yet should still be able to
            look around rather than being held on this screen. */}
        <View style={styles.skip}>
          <Button variant="ghost" label="Skip for now — I'll pair later" onPress={skip} />
          <Text variant="caption" color="textFaint" center>
            You can pair any time from your profile. Until then, anything you
            create stays on this device.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoider>
  );
}

/** The paired view: who you are sharing with, and what the space is called. */
function PairedSpace() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const partner = usePartner();
  const space = useSpace();
  const sync = useBackendStatus();
  const toast = useToast();
  const [name, setName] = useState(space.name ?? 'Our space');
  const [busy, setBusy] = useState(false);

  const rename = async () => {
    setBusy(true);
    try {
      await repository.renameSpace(name);
      await sync.refresh();
      toast.show('Space name updated.', { tone: 'success' });
    } catch (error) {
      toast.show(userFacingError(error, 'Could not rename your space.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoider style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.pairedHero}>
          <View style={styles.pair}>
            <Avatar name={me.displayName} seed={me.photoSeed} uri={me.photoUri} ring="you" size={64} />
            <View style={[styles.knot, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Ionicons name="heart" size={16} color={theme.bloom} />
            </View>
            <Avatar name={partner.displayName} seed={partner.photoSeed} uri={partner.photoUri} ring="them" size={64} />
          </View>
          <Text variant="display" center>{space.name ?? 'Our space'}</Text>
          <Text variant="body" color="textSoft" center>
            You and {partner.displayName} share this space. No other Weship
            member can see anything in it.
          </Text>
        </View>

        <Card padded style={styles.card}>
          <Text variant="micro" color="textFaint">YOUR PARTNER</Text>
          <View style={styles.partnerRow}>
            <Avatar name={partner.displayName} seed={partner.photoSeed} uri={partner.photoUri} ring="them" size={46} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{partner.displayName}</Text>
              <Text variant="caption" color="textFaint">
                {partner.username ? `@${partner.username}` : partner.timezone}
              </Text>
            </View>
          </View>
          <Detail label="THEIR TIMEZONE" value={partner.timezone} />
          <Detail
            label="ANNIVERSARY"
            value={
              space.anniversary
                ? new Date(`${space.anniversary}T12:00:00`).toLocaleDateString()
                : 'Not set — add it from your profile'
            }
          />
          <Detail
            label="STREAK"
            value={`${space.streak.count} day${space.streak.count === 1 ? '' : 's'} · last active ${relativeDay(space.streak.lastActiveDate)}`}
          />
          <Detail label="MODE" value={space.mode === 'distance' ? 'Long distance' : 'Together'} />
        </Card>

        <Card padded style={styles.card}>
          <Text variant="micro" color="textFaint">SPACE NAME</Text>
          <Input value={name} onChangeText={setName} placeholder="Space name" maxLength={40} />
          <Button
            full
            variant="soft"
            loading={busy}
            label={busy ? 'Saving…' : 'Save name'}
            disabled={busy || !name.trim() || name.trim() === (space.name ?? '')}
            onPress={rename}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoider>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text variant="micro" color="textFaint">{label}</Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

function Input({ style, ...props }: React.ComponentProps<typeof TextInput>) {
  const theme = useTheme();
  return <TextInput {...props} placeholderTextColor={theme.textFaint} selectionColor={theme.primary} style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.line }, style]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  intro: { gap: Spacing.sm, paddingTop: Spacing.sm },
  card: { gap: Spacing.md },
  input: { minHeight: 52, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.inset, paddingHorizontal: Spacing.md, fontFamily: Font.sans, fontSize: 16 },
  codeInput: { textAlign: 'center', letterSpacing: 6, fontSize: 20 },
  codeBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.inset, paddingVertical: Spacing.md, alignItems: 'center', gap: 6 },
  code: { letterSpacing: 8, textAlign: 'center' },
  copyHint: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  skip: { gap: Spacing.xs, paddingTop: Spacing.sm },
  pairedHero: { alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.sm },
  pair: { flexDirection: 'row', alignItems: 'center' },
  knot: { width: 34, height: 34, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginHorizontal: -14, zIndex: 1 },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  detail: { gap: 3 },
});
