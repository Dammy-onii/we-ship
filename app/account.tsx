import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deviceTimezone } from '@/lib/time';
import { useNativePickerAction } from '@/hooks/use-native-picker';
import { useAuth } from '@/lib/auth';
import { GENDERS, type GenderKey } from '@/lib/gender';
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
        gender: gender ?? null,
      });
      // Claimed through an RPC so uniqueness and the allowed alphabet are
      // enforced on the server, with a message worth showing the user.
      const handle = username.trim().toLowerCase();
      if (handle && handle !== (me.username ?? '')) await setUsername(handle);
      await sync.refresh();
      Alert.alert('Saved', 'Your account details are updated.');
    } catch (error) {
      Alert.alert('Could not save', userFacingError(error, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const runPicker = useNativePickerAction();

  const choosePhoto = async () => {
    if (!auth.user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photo access needed', 'Allow photo access to choose a profile picture.');
    const result = await runPicker(() =>
      ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.82 }),
    );
    if (result.canceled) return;
    setBusy(true);
    try {
      await repository.uploadAvatar(auth.user.id, result.assets[0].uri);
      await sync.refresh();
    } catch (error) {
      Alert.alert('Could not upload photo', userFacingError(error, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const leaveSpace = () => Alert.alert(
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
          catch (error) { Alert.alert('Could not leave space', userFacingError(error, 'Please try again.')); }
          finally { setBusy(false); }
        },
      },
    ],
  );

  const deleteAccount = () => Alert.alert(
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
          catch (error) { Alert.alert('Could not delete account', userFacingError(error, 'Please try again.')); }
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
          <View style={styles.genderBlock}>
            <Text variant="micro" color="textFaint">GENDER · OPTIONAL</Text>
            <View style={styles.genderRow}>
              {GENDERS.map((option) => {
                const selected = gender === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setGender(selected ? undefined : option.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      styles.genderChip,
                      {
                        backgroundColor: selected ? theme.primarySoft : theme.surface,
                        borderColor: selected ? theme.primary : theme.line,
                      },
                    ]}>
                    <Text variant="caption" color={selected ? 'primaryDeep' : 'textSoft'}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.readOnlyField}>
            <Text variant="micro" color="textFaint">TIMEZONE</Text>
            <Text variant="bodyStrong">{timezone}</Text>
            <Text variant="caption" color="textFaint">
              Set automatically from your phone, so your days and streaks line up with where you are.
            </Text>
          </View>
          <Button full label={busy ? 'Saving…' : 'Save account'} disabled={!auth.configured || busy || !name.trim()} onPress={save} />
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
  section: { gap: Spacing.md },
  field: { gap: 6 },
  genderBlock: { gap: 8 },
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genderChip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  input: { minHeight: 52, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.inset, paddingHorizontal: Spacing.md, fontFamily: Font.sans, fontSize: 16 },
  accountMeta: { paddingVertical: Spacing.base, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, gap: 3 },
  dangerZone: { gap: Spacing.sm },
});
