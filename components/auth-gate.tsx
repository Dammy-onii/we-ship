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

function AuthScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { error: authError, signIn, signUp, sendMagicLink } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'create'>('sign-in');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<GenderKey>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (authError) toast.show(authError);
  }, [authError]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!email.trim() || !password || (mode === 'create' && !name.trim())) return;
    setBusy(true);
    setMessage('');
    const result =
      mode === 'create'
        ? await signUp({ email, password, displayName: name, gender })
        : await signIn(email, password);
    setBusy(false);
    // Failures are transient and belong in the toast; a confirmation prompt is
    // an instruction the user needs to keep reading, so it stays inline.
    if (result.error) toast.show(result.error);
    else if (result.needsEmailConfirmation) setMessage('Check your email, then return to Weship.');
  };

  const magicLink = async () => {
    if (!email.trim()) {
      toast.show('Enter your email first.', { tone: 'info' });
      return;
    }
    setBusy(true);
    const result = await sendMagicLink(email);
    setBusy(false);
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
          />
        </View>

        {message ? <Text variant="caption" color="textSoft">{message}</Text> : null}
        <Button
          full
          disabled={busy || !email.trim() || !password || (mode === 'create' && !name.trim())}
          label={busy ? 'Please wait…' : mode === 'create' ? 'Create private space' : 'Sign in'}
          onPress={submit}
        />
        <Pressable disabled={busy} onPress={magicLink} style={styles.magicLink}>
          <Text variant="captionStrong" color="primaryDeep">Email me a sign-in link</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoider>
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
  genderBlock: { gap: 8, marginTop: 4 },
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genderChip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fields: { gap: Spacing.sm },
  inputShell: { minHeight: 54, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.inset, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, gap: Spacing.sm },
  input: { flex: 1, minWidth: 0, minHeight: 52, fontFamily: Font.sans, fontSize: 16 },
  magicLink: { alignItems: 'center', paddingVertical: Spacing.sm },
});
