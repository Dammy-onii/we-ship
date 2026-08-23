import { Stack } from 'expo-router';

/** Bare stack: the callback screen is a hand-off, not a destination. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
