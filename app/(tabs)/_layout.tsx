import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useMemo } from 'react';
import { View, type ColorValue } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Leaf, Sparkle } from '@/components/art/botanicals';
import { FloatingHeaderActions } from '@/components/app-header';
import { SpotlightTabBar } from '@/components/spotlight-tab-bar';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/ui/data-state';
import { useTheme } from '@/hooks/use-theme';
import { useBackendStatus } from '@/lib/store';

type ArtIcon = (p: { size?: number; color?: ColorValue; opacity?: number }) => React.ReactElement;

const TAB_ROUTES = ['/', '/(tabs)/spotlight', '/(tabs)/friend-spotlight', '/(tabs)/us'] as const;
const DRAWER_EDGE_WIDTH = 34;

function makeIcon(Art: ArtIcon, name: string) {
  const Icon = ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <View style={styles.icon}>
      <Art size={23} color={color} opacity={focused ? 1 : 0.75} />
    </View>
  );
  Icon.displayName = `TabIcon(${name})`;
  return Icon;
}

export default function TabLayout() {
  const sync = useBackendStatus();

  const theme = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const tabName = segments[0] === '(tabs)' ? (segments[1] ?? 'index') : 'index';
  const activeIndex =
    tabName === 'spotlight' ? 1 : tabName === 'friend-spotlight' ? 2 : tabName === 'us' ? 3 : 0;

  const tabSwipe = useMemo(
    () =>
      Gesture.Pan()
        .hitSlop({ left: -DRAWER_EDGE_WIDTH })
        .activeOffsetX([-18, 18])
        .failOffsetY([-16, 16])
        .runOnJS(true)
        .onEnd((event) => {
          const startedAt = event.absoluteX - event.translationX;
          if (startedAt <= DRAWER_EDGE_WIDTH) return;

          const passedThreshold =
            Math.abs(event.translationX) > 72 || Math.abs(event.velocityX) > 650;
          if (!passedThreshold) return;

          const direction = event.translationX < 0 ? 1 : -1;
          const nextIndex = activeIndex + direction;
          if (nextIndex < 0 || nextIndex >= TAB_ROUTES.length) return;
          router.replace(TAB_ROUTES[nextIndex]);
        }),
    [activeIndex, router],
  );

  // Never flash the deterministic demo seed while a live account hydrates.
  // Besides looking wrong, that seed contains a fictional partner answer.
  if (sync.mode === 'live' && sync.initialLoading) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: theme.bg }]}>
        <DataState loading title="Loading your shared space" detail="Bringing your latest questions, 2dos, and Goodies together." />
      </View>
    );
  }

  if (sync.mode === 'live' && sync.error && !sync.paired && !sync.offlineSince) {
    return (
      <View style={[styles.fill, styles.center, styles.state, { backgroundColor: theme.bg }]}>
        <DataState
          compact
          icon="cloud-offline-outline"
          title="Your shared space could not load"
          detail={sync.error}
        />
        <Button label="Try again" variant="soft" onPress={sync.refresh} />
      </View>
    );
  }

  // No redirect for an unpaired account. Everything that does not need a
  // partner — friends, your profile, notifications — works without one, and
  // Home explains what pairing unlocks instead of the app refusing to open.

  return (
    <View style={styles.fill}>
      <GestureDetector gesture={tabSwipe}>
        <View style={styles.fill}>
          <Tabs
            tabBar={(props) => <SpotlightTabBar {...props} />}
            screenOptions={{
              headerShown: false,
              tabBarShowLabel: false,
            }}>
            <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: makeIcon(Leaf, 'home') }} />
            <Tabs.Screen
              name="spotlight"
              options={{ title: 'Spotlight', tabBarIcon: makeIcon(Sparkle, 'spotlight') }}
            />
            <Tabs.Screen
              name="friend-spotlight"
              options={{
                title: 'Friends',
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.icon}>
                    <Ionicons
                      name={focused ? 'planet' : 'planet-outline'}
                      size={23}
                      color={color}
                    />
                  </View>
                ),
              }}
            />
            <Tabs.Screen
              name="us"
              options={{
                title: 'Us',
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.icon}>
                    <Ionicons
                      name={focused ? 'people' : 'people-outline'}
                      size={24}
                      color={color}
                    />
                  </View>
                ),
              }}
            />
          </Tabs>
        </View>
      </GestureDetector>
      {/* Home draws its own paired avatars in the hero; a floating one would
          land directly on top of them. */}
      <FloatingHeaderActions showAvatar={tabName !== 'index'} />
    </View>
  );
}

const styles = {
  fill: { flex: 1 },
  center: { alignItems: 'center' as const, justifyContent: 'center' as const },
  state: { paddingHorizontal: 28 },
  icon: { alignItems: 'center' as const, justifyContent: 'center' as const },
};
