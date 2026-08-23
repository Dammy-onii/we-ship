import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sprig } from '@/components/art/botanicals';
import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Onboarding } from '@/components/onboarding';
import { hasSeenOnboarding, markOnboardingSeen } from '@/lib/onboarding';
import { useAuth } from '@/lib/auth';
import { GENDERS, type GenderKey } from '@/lib/gender';
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT, passwordProblem } from '@/lib/password';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  // `undefined` while we are still reading the flag — showing the auth form and
  // then yanking it away for the intro would be worse than one extra frame.
  const [seenIntro, setSeenIntro] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    hasSeenOnboarding().then(setSeenIntro);
  }, []);

  if (auth.loading || seenIntro === undefined) return <AuthLoading />;
  // Checked before the session: a recovery link signs the user in, so without
  // this the app would open normally and never ask for the new password.
  if (auth.recovering) return <NewPasswordScreen />;
  if (!auth.configured || auth.session) return children;

  // First launch: explain what this is before asking for an email.
  if (!seenIntro) {
    return (
      <Onboarding
        onDone={() => {
          markOnboardingSeen();
          setSeenIntro(true);
        }}
      />
    );
  }

  return <AuthScreen />;
}

function AuthLoading() {
  const theme = useTheme();
  return (
    <View style={[styles.loading, { backgroundColor: theme.bg }]}>
      <ActivityIndicator color={theme.primary} />
      <Text variant="caption" color="textFaint">Opening your space…</Text>
    </View>
  );
}

/** Shown after following a recovery link, while the user picks a new password. */
function NewPasswordScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async () => {
    const problem = passwordProblem(password);
    if (problem) {
      toast.show(problem);
      return;
    }
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (result.error) toast.show(result.error);
    else toast.show('Password updated.', { tone: 'success' });
  };

  return (
    <KeyboardAvoider style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 54, paddingBottom: insets.bottom + Spacing['4xl'] },
        ]}>
        <View style={[styles.mark, { backgroundColor: theme.primarySoft }]}>
          <Ionicons name="lock-open-outline" size={28} color={theme.primaryDeep} />
        </View>
        <Text variant="hero">{'Choose a new\npassword.'}</Text>
        <Text variant="body" color="textSoft">
          You followed a recovery link, so you are signed in. Set a new password
          to finish.
        </Text>
        <AuthInput
          value={password}
          onChangeText={setPassword}
          placeholder="New password"
          icon="lock-closed-outline"
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
        />
        <Text
          variant="caption"
          color={password && password.length < MIN_PASSWORD_LENGTH ? 'partner' : 'textFaint'}>
          {PASSWORD_HINT}
        </Text>
        <Button
          full
          loading={busy}
          disabled={password.length < MIN_PASSWORD_LENGTH}
          label={busy ? 'Saving…' : 'Save password'}
          onPress={submit}
        />
        <Pressable disabled={busy} onPress={signOut} style={styles.magicLink}>
          <Text variant="captionStrong" color="textFaint">Cancel and sign out</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoider>
  );
}

function AuthScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { error: authError, signIn, signUp, sendMagicLink, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'create'>('sign-in');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<GenderKey>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  // Which action is running, so the spinner appears on the control that was
  // actually pressed rather than on all of them.
  const [pending, setPending] = useState<'submit' | 'magic-link' | 'reset'>();
  const [message, setMessage] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (authError) toast.show(authError);
  }, [authError]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!email.trim() || !password || (mode === 'create' && !name.trim())) return;
    // Checked here as well as on the server so a too-short password fails
    // instantly and says why, rather than after a round trip.
    const problem = mode === 'create' ? passwordProblem(password) : undefined;
    if (problem) {
      toast.show(problem);
      return;
    }
    setBusy(true);
    setPending('submit');
    setMessage('');
    const result =
      mode === 'create'
        ? await signUp({ email, password, displayName: name, gender })
        : await signIn(email, password);
    setBusy(false);
    setPending(undefined);
    // Failures are transient and belong in the toast; a confirmation prompt is
    // an instruction the user needs to keep reading, so it stays inline.
    if (result.error) toast.show(result.error);
    else if (result.needsEmailConfirmation) setMessage('Check your email, then return to Weship.');
  };

  const forgotPassword = async () => {
    if (!email.trim()) {
      toast.show('Enter your email first.', { tone: 'info' });
      return;
    }
    setBusy(true);
    setPending('reset');
    const result = await sendPasswordReset(email);
    setBusy(false);
    setPending(undefined);
    if (result.error) toast.show(result.error);
    // Deliberately the same message whether or not the address has an account:
    // a different one would confirm which emails are registered here.
    else setMessage('If that email has an account, a reset link is on its way.');
  };

  const magicLink = async () => {
    if (!email.trim()) {
      toast.show('Enter your email first.', { tone: 'info' });
      return;
    }
    setBusy(true);
    setPending('magic-link');
    const result = await sendMagicLink(email);
    setBusy(false);
    setPending(undefined);
    if (result.error) toast.show(result.error);
    else setMessage('Check your email for the secure sign-in link.');
  };

  return (
    <KeyboardAvoider
      style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        // Lets the focused field scroll clear of the keyboard instead of being
        // pinned under it — the password input sits low on this screen.
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 54, paddingBottom: insets.bottom + Spacing['4xl'] },
        ]}>
        <View style={[styles.mark, { backgroundColor: theme.primarySoft }]}>
          <Sprig size={32} color={theme.primaryDeep} />
        </View>
        <Text variant="hero">{'Your shared space,\nkept private.'}</Text>
        <Text variant="body" color="textSoft">
          Sign in to sync 2dos, memories, Goodies, games, and partner updates across devices.
        </Text>

        <View style={[styles.modeRow, { backgroundColor: theme.surfaceAlt }]}>
          {(['sign-in', 'create'] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => { setMode(item); setMessage(''); }}
              style={[styles.modeButton, mode === item && { backgroundColor: theme.surface }]}>
              <Text variant="captionStrong" color={mode === item ? 'text' : 'textFaint'}>
                {item === 'sign-in' ? 'Sign in' : 'Create account'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.fields}>
          {mode === 'create' ? (
            <AuthInput
              value={name}
              onChangeText={setName}
              placeholder="Username"
              icon="person-outline"
              autoCapitalize="none"
              textContentType="username"
            />
          ) : null}
          {mode === 'create' ? (
            <Select
              label="GENDER · OPTIONAL"
              placeholder="Select"
              options={GENDERS}
              value={gender}
              onChange={setGender}
              clearable
            />
          ) : null}
          <AuthInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            icon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <AuthInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            icon="lock-closed-outline"
            secureTextEntry
            autoCapitalize="none"
            textContentType={mode === 'create' ? 'newPassword' : 'password'}
          />
          {mode === 'create' ? (
            <Text
              variant="caption"
              color={password && password.length < MIN_PASSWORD_LENGTH ? 'partner' : 'textFaint'}>
              {PASSWORD_HINT}
            </Text>
          ) : null}
        </View>

        {message ? <Text variant="caption" color="textSoft">{message}</Text> : null}
        <Button
          full
          loading={pending === 'submit'}
          disabled={
            busy ||
            !email.trim() ||
            !password ||
            (mode === 'create' && (!name.trim() || password.length < MIN_PASSWORD_LENGTH))
          }
          label={busy ? 'Please wait…' : mode === 'create' ? 'Create private space' : 'Sign in'}
          onPress={submit}
        />
        <TextAction
          label="Email me a sign-in link"
          busyLabel="Sending the link…"
          busy={pending === 'magic-link'}
          disabled={busy}
          onPress={magicLink}
        />
        {mode === 'sign-in' ? (
          <TextAction
            label="Forgot your password?"
            busyLabel="Sending the reset link…"
            busy={pending === 'reset'}
            disabled={busy}
            tone="textFaint"
            onPress={forgotPassword}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoider>
  );
}

/** A text link that can say it is working. */
function TextAction({
  label,
  busyLabel,
  busy,
  disabled,
  tone = 'primaryDeep',
  onPress,
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled?: boolean;
  tone?: 'primaryDeep' | 'textFaint';
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      style={({ pressed }) => [styles.magicLink, pressed && { opacity: 0.6 }]}>
      <View style={styles.textActionRow}>
        {busy ? <ActivityIndicator size="small" color={theme.textFaint} /> : null}
        <Text variant="captionStrong" color={busy ? 'textFaint' : tone}>
          {busy ? busyLabel : label}
        </Text>
      </View>
    </Pressable>
  );
}

function AuthInput({ icon, ...props }: React.ComponentProps<typeof TextInput> & { icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  const theme = useTheme();
  return (
    <View style={[styles.inputShell, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <Ionicons name={icon} size={18} color={theme.textFaint} />
      <TextInput
        {...props}
        placeholderTextColor={theme.textFaint}
        selectionColor={theme.primary}
        autoCorrect={false}
        style={[styles.input, { color: theme.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  mark: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  modeRow: { flexDirection: 'row', padding: 4, borderRadius: Radius.pill },
  modeButton: { flex: 1, minWidth: 0, minHeight: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  fields: { gap: Spacing.sm },
  inputShell: { minHeight: 54, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.inset, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, gap: Spacing.sm },
  input: { flex: 1, minWidth: 0, minHeight: 52, fontFamily: Font.sans, fontSize: 16 },
  magicLink: { alignItems: 'center', paddingVertical: Spacing.sm },
  textActionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
