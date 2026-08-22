import { Stack } from 'expo-router';

import { HeaderActions } from '@/components/app-header';
import { Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function UsLayout() {
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
      <Stack.Screen name="notes" options={{ title: 'Notes' }} />
      <Stack.Screen name="log" options={{ title: '2do' }} />
    </Stack>
  );
}
