import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { showDialog } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/use-theme';
import { deviceTimezone } from '@/lib/time';
import { useNativePickerAction } from '@/hooks/use-native-picker';
import { useAuth } from '@/lib/auth';
import { GENDERS, genderLabel, type GenderKey } from '@/lib/gender';
import { Select } from '@/components/ui/select';
import { setUsername } from '@/lib/backend/friends';
import * as repository from '@/lib/backend/repository';
import { useBackendStatus, useMe } from '@/lib/store';
import { userFacingError } from '@/lib/user-facing-error';

export default function AccountScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const sync = useBackendStatus();
  const auth = useAuth();
  const [name, setName] = useState(me.displayName);
  const [username, setUsernameInput] = useState(me.username ?? '');
  // Set once, at registration. Kept read-only here and enforced by the
  // database, so the two cannot drift apart.
  const lockedGender = genderLabel(me.gender);
  const [gender, setGender] = useState<GenderKey | undefined>(me.gender as GenderKey | undefined);
  // Always report the device's real zone: profiles default to 'UTC', which is
  // wrong for everyone not actually in UTC and silently skews days and streaks.
  const timezone = deviceTimezone() ?? me.timezone;
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!auth.user) return;
    setBusy(true);
    try {
      await repository.updateProfile(auth.user.id, {
        displayName: name,
        timezone,
        gender: lockedGender ? undefined : (gender ?? null),
      });
      // Claimed through an RPC so uniqueness and the allowed alphabet are
      // enforced on the server, with a message worth showing the user.
      const handle = username.trim().toLowerCase();
      if (handle && handle !== (me.username ?? '')) await setUsername(handle);
      await sync.refresh();
      showDialog('Saved', 'Your account details are updated.');
    } catch (error) {
      showDialog('Could not save', userFacingError(error, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const runPicker = useNativePickerAction();

  const choosePhoto = async () => {
    if (!auth.user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return showDialog('Photo access needed', 'Allow photo access to choose a profile picture.');
    const result = await runPicker(() =>
      ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.82 }),
    );
    if (result.canceled) return;
    setBusy(true);
    try {
      await repository.uploadAvatar(auth.user.id, result.assets[0].uri);
      await sync.refresh();
    } catch (error) {
      showDialog('Could not upload photo', userFacingError(error, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const leaveSpace = () => showDialog(
    'Leave shared space?',
    'Your partner keeps the space and its shared history. You can pair again afterward.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave space',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try { await repository.leavePairSpace(); await sync.refresh(); }
          catch (error) { showDialog('Could not leave space', userFacingError(error, 'Please try again.')); }
          finally { setBusy(false); }
        },
      },
    ],
  );

  const deleteAccount = () => showDialog(
    'Delete your account?',
    'This permanently removes your account and cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete account',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try { await repository.deleteOwnAccount(); await auth.signOut(); }
          catch (error) { showDialog('Could not delete account', userFacingError(error, 'Please try again.')); }
          finally { setBusy(false); }
        },
      },
    ],
  );

  return (
    <KeyboardAvoider style={[styles.screen, { backgroundColor: theme.bg }]} >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.hero}>
          <Avatar name={me.displayName} seed={me.photoSeed} uri={me.photoUri} ring="you" size={76} />
          {/* Name and handle as they stand right now, not as the form has them
              half-edited — this is the one place to check what friends see. */}
          <View style={styles.heroIdentity}>
            <Text variant="title">{me.displayName}</Text>
            <Text variant="body" color={me.username ? 'textFaint' : 'partner'}>
              {me.username ? `@${me.username}` : 'No username yet'}
            </Text>
            {lockedGender ? (
              <Text variant="caption" color="textFaint">
                {lockedGender}
              </Text>
            ) : null}
          </View>
          <Button label="Change photo" variant="soft" onPress={choosePhoto} disabled={!auth.configured || busy} icon={<Ionicons name="camera-outline" size={17} color={theme.primaryDeep} />} />
        </View>

        <View style={styles.section}>
          <Text variant="micro" color="textFaint">PROFILE</Text>
          <Field label="Display name" value={name} onChangeText={setName} placeholder="Your name" />
          <Field
            label="Username"
            value={username}
            onChangeText={(next) => setUsernameInput(next.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
            placeholder="yourhandle"
            autoCapitalize="none"
            maxLength={24}
          />
          <Text variant="caption" color="textFaint">
            This is how friends find you. 3–24 characters: letters, numbers, dots or underscores.
          </Text>
          {lockedGender ? (
            <View style={styles.readOnlyField}>
              <Text variant="micro" color="textFaint">GENDER</Text>
              <Text variant="bodyStrong">{lockedGender}</Text>
              <Text variant="caption" color="textFaint">
                Chosen when you registered and cannot be changed here.
              </Text>
            </View>
          ) : (
            <Select
              label="GENDER · OPTIONAL"
              placeholder="Select"
              options={GENDERS}
              value={gender}
              onChange={setGender}
              clearable
            />
          )}

          <View style={styles.readOnlyField}>
            <Text variant="micro" color="textFaint">TIMEZONE</Text>
            <Text variant="bodyStrong">{timezone}</Text>
            <Text variant="caption" color="textFaint">
              Set automatically from your phone, so your days and streaks line up with where you are.
            </Text>
          </View>
          <Button full loading={busy} label={busy ? 'Saving…' : 'Save account'} disabled={!auth.configured || !name.trim()} onPress={save} />
        </View>

        <View style={[styles.accountMeta, { borderTopColor: theme.line, borderBottomColor: theme.line }]}>
          <Text variant="bodyStrong">{auth.user?.email ?? 'Not signed in'}</Text>
          <Text variant="caption" color="textFaint">{sync.mode === 'live' ? 'Synced across your devices' : 'Sign in to sync across devices'}</Text>
        </View>

        {auth.configured ? (
          <View style={styles.dangerZone}>
            {sync.paired ? <Button label="Leave shared space" variant="ghost" disabled={busy} onPress={leaveSpace} /> : null}
            <Button label="Sign out" variant="ghost" disabled={busy} onPress={auth.signOut} />
            <Button label="Delete account" variant="ghost" disabled={busy} onPress={deleteAccount} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoider>
  );
}

function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text variant="captionStrong">{label}</Text>
      <TextInput {...props} placeholderTextColor={theme.textFaint} selectionColor={theme.primary} autoCorrect={false} style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.line }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  readOnlyField: { gap: 4, paddingVertical: Spacing.sm },
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  hero: { alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.sm },
  heroIdentity: { alignItems: 'center', gap: 2 },
  section: { gap: Spacing.md },
  field: { gap: 6 },
  input: { minHeight: 52, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.inset, paddingHorizontal: Spacing.md, fontFamily: Font.sans, fontSize: 16 },
  accountMeta: { paddingVertical: Spacing.base, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, gap: 3 },
  dangerZone: { gap: Spacing.sm },
});
