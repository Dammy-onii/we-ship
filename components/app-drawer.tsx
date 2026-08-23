import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { type Href, usePathname, useRouter } from 'expo-router';
import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from 'expo-router/drawer';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRef } from 'react';

import { Leaf } from '@/components/art/botanicals';
import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMe, useSpace } from '@/lib/store';

type MenuItem = {
  label: string;
  href: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const MENU: MenuItem[] = [
  { label: 'Play', href: '/play', icon: 'game-controller-outline' },
  { label: 'Friends', href: '/friends', icon: 'people-outline' },
  { label: '2do', href: '/todo', icon: 'checkbox-outline' },
  { label: 'Widgets', href: '/widgets', icon: 'grid-outline' },
  { label: 'Memories', href: '/memories', icon: 'images-outline' },
];

export function AppDrawerContent(props: DrawerContentComponentProps) {
  const theme = useTheme();
  const me = useMe();
  const space = useSpace();
  const pathname = usePathname();
  const router = useRouter();
  const longPressTriggered = useRef(false);
  const username = me.username ? `@${me.username}` : 'Set a username';

  const navigate = (href: string) => {
    props.navigation.closeDrawer();
    if (pathname !== href) router.replace(href as Href);
  };

  return (
    <DrawerContentScrollView
      {...props}
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.content}>
      <Pressable
        onPress={() => navigate('/modal')}
        accessibilityLabel="Open your profile"
        style={({ pressed }) => [styles.profile, pressed && { opacity: 0.8 }]}>
        <Avatar name={me.displayName} seed={me.photoSeed} uri={me.photoUri} ring="you" size={54} />
        <View style={styles.profileText}>
          <Text variant="title" numberOfLines={1}>
            {me.displayName}
          </Text>
          <Text variant="caption" color="textFaint">
            {username}
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => navigate('/')}
        accessibilityRole="button"
        accessibilityState={{ selected: pathname === '/' }}
        style={({ pressed }) => [
          styles.item,
          { backgroundColor: pathname === '/' ? theme.primarySoft : 'transparent' },
          pressed && { backgroundColor: theme.surfaceAlt },
        ]}>
        <View
          style={[
            styles.itemIcon,
            { backgroundColor: pathname === '/' ? theme.surface : theme.surfaceAlt },
          ]}>
          <Ionicons
            name="home-outline"
            size={19}
            color={pathname === '/' ? theme.primaryDeep : theme.textSoft}
          />
        </View>
        <Text
          variant="bodyStrong"
          style={{ flex: 1, color: pathname === '/' ? theme.primaryDeep : theme.text }}>
          Home
        </Text>
      </Pressable>

      <Pressable
        onPress={() => navigate('/goodies')}
        accessibilityRole="button"
        accessibilityState={{ selected: pathname === '/goodies' }}
        style={({ pressed }) => [
          styles.item,
          { backgroundColor: pathname === '/goodies' ? theme.primarySoft : 'transparent' },
          pressed && { backgroundColor: theme.surfaceAlt },
        ]}>
        <View
          style={[
            styles.itemIcon,
            { backgroundColor: pathname === '/goodies' ? theme.surface : theme.surfaceAlt },
          ]}>
          <Ionicons
            name="gift-outline"
            size={19}
            color={pathname === '/goodies' ? theme.primaryDeep : theme.textSoft}
          />
        </View>
        <Text
          variant="bodyStrong"
          style={{ flex: 1, color: pathname === '/goodies' ? theme.primaryDeep : theme.text }}>
          Goodies
        </Text>
      </Pressable>

      <View style={styles.menu}>
        {MENU.map((item) => {
          const selected = pathname === item.href;
          return (
            <Pressable
              key={item.href}
              onPress={() => navigate(item.href)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.item,
                { backgroundColor: selected ? theme.primarySoft : 'transparent' },
                pressed && { backgroundColor: theme.surfaceAlt },
              ]}>
              <View
                style={[
                  styles.itemIcon,
                  { backgroundColor: selected ? theme.surface : theme.surfaceAlt },
                ]}>
                <Ionicons
                  name={item.icon}
                  size={19}
                  color={selected ? theme.primaryDeep : theme.textSoft}
                />
              </View>
              <Text
                variant="bodyStrong"
                style={{ flex: 1, color: selected ? theme.primaryDeep : theme.text }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        delayLongPress={450}
        onLongPress={() => {
          longPressTriggered.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          navigate(`/goodies?composer=voice&record=${Date.now()}`);
        }}
        onPress={() => {
          if (longPressTriggered.current) {
            longPressTriggered.current = false;
            return;
          }
          navigate('/goodies?composer=voice');
        }}
        accessibilityRole="button"
        accessibilityLabel="Voice note"
        accessibilityHint="Tap to open voice notes. Press and hold to start recording."
        style={({ pressed }) => [
          styles.capture,
          { backgroundColor: theme.primary },
          pressed && { opacity: 0.82, transform: [{ scale: 0.94 }] },
        ]}>
        <Ionicons name="mic" size={30} color={theme.onPrimary} />
      </Pressable>

      <View style={styles.footer}>
        <Leaf size={18} color={theme.primary} opacity={0.75} />
        <Text variant="captionStrong" color="textSoft" numberOfLines={1}>
          {space.name ?? 'Weship'}
        </Text>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: Spacing.lg, gap: Spacing.xs },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  profileText: { flex: 1, gap: 2 },
  menu: { gap: Spacing.xs },
  item: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.inset,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  capture: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 'auto',
  },
});
