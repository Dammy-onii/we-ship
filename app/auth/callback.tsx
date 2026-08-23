import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

/**
 * Where emailed sign-in and password-recovery links land.
 *
 * The token itself is consumed by the `Linking` listener in `lib/auth.tsx`,
 * which sits above the router — this screen exists because expo-router still
 * navigates to the path, and without a route for it the app showed
 * "Unmatched Route" over a sign-in that had actually worked.
 *
 * Recovery is not handled here: `AuthGate` swaps to the new-password screen on
 * the `PASSWORD_RECOVERY` event, so this only has to get out of the way once a
 * session exists.
 */
export default function AuthCallbackScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session, loading, error } = useAuth();

  useEffect(() => {
    if (loading || !session) return;
    router.replace('/');
  }, [loading, router, session]);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ActivityIndicator color={theme.primary} />
      <Text variant="caption" color="textFaint" center>
        {error ?? 'Signing you in…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
});
