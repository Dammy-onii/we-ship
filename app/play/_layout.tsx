import { Stack } from 'expo-router';

import { HeaderActions } from '@/components/app-header';
import { Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function PlayLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerShadowVisible: false,
        headerTintColor: theme.primaryDeep,
        headerTitleStyle: { ...Typography.heading, color: theme.text },
        contentStyle: { backgroundColor: theme.bg },
        headerRight: () => <HeaderActions compact />,
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="question" options={{ title: 'Today' }} />
      <Stack.Screen name="questions" options={{ title: 'Question queue' }} />
      <Stack.Screen name="picks" options={{ title: 'Pick Together queue' }} />
      <Stack.Screen name="scenes" options={{ title: 'Our Take' }} />
      <Stack.Screen name="scene" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="scene-result" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="game/[id]" options={{ title: 'Play' }} />
    </Stack>
  );
}
