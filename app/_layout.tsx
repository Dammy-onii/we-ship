import {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { NavigationBar } from 'expo-navigation-bar';
import { Drawer } from 'expo-router/drawer';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { EdgeMenuButton, HeaderActions, HeaderBackButton } from '@/components/app-header';
import { AppDrawerContent } from '@/components/app-drawer';
import { AuthGate } from '@/components/auth-gate';
import { SyncErrorBanner } from '@/components/sync-error-banner';
import { DialogHost } from '@/components/ui/dialog';
import { ToastProvider } from '@/components/ui/toast';
import { AppColorScheme, Palette, Spacing, Typography } from '@/constants/theme';
import { AuthProvider } from '@/lib/auth';
import { FriendsProvider } from '@/lib/friends';
import { usePushNotificationRouting } from '@/lib/push';
import { StoreProvider } from '@/lib/store';
import { GoogleConnectionProvider } from '@/lib/use-google-connection';
import { useWidgetSync } from '@/lib/use-widget-sync';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Pushes widget data. Rendered as a component rather than called in
 * `RootLayout` because it must sit inside both the Store and Friends
 * providers — the snapshot spans the pair Space and the friend board.
 */
function WidgetSync() {
  useWidgetSync();
  return null;
}

/** Dark backing surface behind Android's edge-to-edge system buttons. */
function AndroidSystemButtonPanel() {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== 'android' || insets.bottom <= 0) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.systemButtonPanel, { height: insets.bottom }]}
    />
  );
}

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  usePushNotificationRouting();
  const scheme = AppColorScheme;
  const p = Palette[scheme];
  const { width } = useWindowDimensions();

  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontError, fontsLoaded]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(p.systemBar).catch(() => {});
  }, [p.systemBar]);

  if (!fontsLoaded && !fontError) return null;

  const navTheme: Theme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: p.bg,
      card: p.surface,
      text: p.text,
      border: p.line,
      primary: p.primary,
      notification: p.bloom,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Palette.dark.systemBar }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AuthProvider>
          <ThemeProvider value={navTheme}>
            <ToastProvider>
            <AuthGate>
              <StoreProvider>
                <GoogleConnectionProvider>
                  <FriendsProvider>
                <WidgetSync />
                <SyncErrorBanner />
                <Drawer
              /*
               * Back must return to the PREVIOUS screen, not the first one.
               * The drawer router inherits TabRouter, whose default
               * `backBehavior: 'firstRoute'` builds history as
               * [routes[0], current] — so Android back always jumped to
               * `(tabs)` (Home) regardless of where the user came from.
               * 'history' records actual visit order instead.
               */
              backBehavior="history"
              drawerContent={(props) => <AppDrawerContent {...props} />}
              /*
               * Wraps every screen rather than every screen adding the control
               * itself. `screenLayout` runs inside the navigator, so the button
               * can open the drawer directly.
               */
              screenLayout={({ children, navigation }) => (
                <View style={styles.fill}>
                  {children}
                  <EdgeMenuButton onPress={() => navigation.openDrawer()} />
                </View>
              )}
              screenOptions={{
                headerShown: false,
                drawerType: 'front',
                drawerPosition: 'left',
                drawerHideStatusBarOnOpen: false,
                swipeEnabled: true,
                swipeEdgeWidth: 34,
                swipeMinDistance: 24,
                overlayColor: 'rgba(24, 24, 24, 0.32)',
                drawerStyle: {
                  width: Math.min(width * 0.86, 350),
                  backgroundColor: p.bg,
                },
                sceneStyle: { backgroundColor: p.bg },
                headerStyle: { backgroundColor: p.bg },
                headerShadowVisible: false,
                headerTintColor: p.primaryDeep,
                headerTitleStyle: { ...Typography.heading, color: p.text },
                headerRight: () => <HeaderActions compact />,
                headerRightContainerStyle: { paddingRight: Spacing.md },
                // Secondary screens are pushed, so they need a back affordance;
                // the drawer's hamburger alone left users stranded.
                headerLeft: () => <HeaderBackButton />,
                headerLeftContainerStyle: { paddingLeft: Spacing.sm },
              }}>
              <Drawer.Screen name="(tabs)" options={{ title: 'Weship' }} />
              <Drawer.Screen name="play" options={{ title: 'Play', drawerItemStyle: { display: 'none' } }} />
              {/* Emailed sign-in and recovery links land here. */}
              <Drawer.Screen name="auth" options={{ drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="us" options={{ drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen
                name="goodies"
                options={{ headerShown: true, title: 'Goodies', drawerItemStyle: { display: 'none' } }}
              />
              <Drawer.Screen
                name="notifications"
                options={{ headerShown: true, title: 'Notifications', drawerItemStyle: { display: 'none' } }}
              />
              <Drawer.Screen
                name="todo"
                options={{ headerShown: true, title: '2do', drawerItemStyle: { display: 'none' } }}
              />
              <Drawer.Screen
                name="widgets"
                options={{ headerShown: true, title: 'Widgets', drawerItemStyle: { display: 'none' } }}
              />
              <Drawer.Screen
                name="memories"
                options={{ headerShown: true, title: 'Memories', drawerItemStyle: { display: 'none' } }}
              />
              <Drawer.Screen
                name="modal"
                options={{ headerShown: true, title: 'Profile', drawerItemStyle: { display: 'none' } }}
              />
              <Drawer.Screen name="account" options={{ headerShown: true, title: 'Account', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen
                name="pairing"
                options={{
                  headerShown: true,
                  title: 'Shared space',
                  drawerItemStyle: { display: 'none' },
                  headerLeft: () => <HeaderBackButton destination="/modal" />,
                }}
              />
              <Drawer.Screen name="connections" options={{ headerShown: true, title: 'Connections', drawerItemStyle: { display: 'none' } }} />
              {/* Where Google's OAuth return lands; redirects to Connections. */}
              <Drawer.Screen name="connections/google" options={{ drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="notification-settings" options={{ headerShown: true, title: 'Notifications', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="calendar" options={{ headerShown: true, title: 'Calendar', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="media" options={{ headerShown: true, title: 'Original', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="friends" options={{ headerShown: true, title: 'Friends', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen
                name="friend/[id]"
                options={{
                  headerShown: true,
                  title: 'Profile',
                  drawerItemStyle: { display: 'none' },
                  headerLeft: () => <HeaderBackButton destination="/friends" />,
                }}
              />
            </Drawer>
                {/* Light controls sit over the dark edge-to-edge backing panel. */}
                <StatusBar style="light" />
                {Platform.OS === 'android' ? <NavigationBar style="light" /> : null}
                <AndroidSystemButtonPanel />
                {/* Last, so a prompt is drawn above the drawer and the toast. */}
                <DialogHost />
                  </FriendsProvider>
                </GoogleConnectionProvider>
              </StoreProvider>
            </AuthGate>
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  systemButtonPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    elevation: 40,
    backgroundColor: Palette.dark.systemBar,
  },
});
