import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFriends } from '@/lib/friends';
import { useMe, useNudges } from '@/lib/store';

type HeaderProps = {
  title: string;
  subtitle?: string;
  /** Optional control, placed just inside the floating notification bell. */
  action?: React.ReactNode;
};

export function AppHeader({ title, subtitle, action }: HeaderProps) {
  return (
    <View style={styles.titleRow}>
      {/* Both outer slots are reserved, not empty: the profile avatar and the
          notification bell float above this row at the screen edges, so laying
          content there would put it underneath them. */}
      <View style={styles.titleSpace} />
      <View style={styles.titleCopy}>
        <Text variant="title">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="textFaint" style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.titleTrailing}>
        {action}
        <View style={styles.titleSpace} />
      </View>
    </View>
  );
}

/**
 * The drawer handle pinned to the left edge of every screen.
 *
 * The drawer was previously reachable only by an edge swipe or by the hamburger
 * on the few screens that show a header, which left most of the app with no
 * visible way into it. Rendered through the Drawer's `screenLayout`, so it sits
 * inside the navigator on every screen without each screen having to add it.
 */
export function EdgeMenuButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <View pointerEvents="box-none" style={styles.edgeMenu}>
      <Pressable
        onPress={onPress}
        hitSlop={{ top: 12, bottom: 12, left: 6, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        style={({ pressed }) => [
          styles.edgeMenuButton,
          { backgroundColor: theme.surface, borderColor: theme.line },
          pressed && { opacity: 0.7 },
        ]}>
        <Ionicons name="menu" size={16} color={theme.primaryDeep} />
      </Pressable>
    </View>
  );
}

/** Small round header button, sized to sit beside the floating bell. */
export function HeaderIconButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: theme.surface, borderColor: theme.line },
        pressed && { opacity: 0.7 },
      ]}>
      <Ionicons name={icon} size={19} color={theme.primaryDeep} />
    </Pressable>
  );
}

export function HeaderActions({
  compact = false,
  spread = false,
  /** Home draws its own paired avatars, so the floating one would sit on top of them. */
  showAvatar = true,
}) {
  const theme = useTheme();
  const router = useRouter();
  const me = useMe();
  const { nudges } = useNudges();
  const { unreadNotifications } = useFriends();
  const unseen = unreadNotifications + nudges.filter((nudge) => nudge.fromId !== me.id && !nudge.seen).length;

  return (
    // `box-none` matters: when spread across the screen this row is a
    // full-width transparent bar sitting over the Home hero. Without it the row
    // (and the empty avatar slot) swallow taps meant for the mood chip beneath.
    <View pointerEvents="box-none" style={[styles.actions, spread && styles.actionsSpread]}>
      {showAvatar ? (
        <Pressable
          onPress={() => router.push('/modal')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Your profile">
          <Avatar
            name={me.displayName}
            seed={me.photoSeed}
            uri={me.photoUri}
            ring="you"
            size={compact ? 30 : 38}
          />
        </Pressable>
      ) : (
        <View pointerEvents="none" />
      )}
      <Pressable
        onPress={() => router.push('/notifications')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Notifications">
        <View
          style={[
            styles.bell,
            compact ? styles.bellCompact : styles.bellFloating,
            { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}>
          <Ionicons
            name="notifications-outline"
            size={compact ? 18 : 20}
            color={theme.onPrimary}
          />
          {unseen > 0 ? <View style={[styles.dot, { backgroundColor: theme.bloom, borderColor: theme.surface }]} /> : null}
        </View>
      </Pressable>
    </View>
  );
}

export function FloatingHeaderActions({ showAvatar = true }: { showAvatar?: boolean } = {}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.floatingActions, { top: insets.top + Spacing.base }]}>
      <HeaderActions spread showAvatar={showAvatar} />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  titleSpace: { width: 48 },
  titleTrailing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  titleCopy: { flex: 1, alignItems: 'center' },
  subtitle: { marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  actionsSpread: { flex: 1, justifyContent: 'space-between' },
  floatingActions: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 30,
    elevation: 16,
  },
  bell: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellFloating: { width: 48, height: 48, borderRadius: 24, ...Shadow.subtle },
  bellCompact: { width: 32, height: 32, borderRadius: 16 },
  dot: { position: 'absolute', top: 6, right: 6, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  edgeMenu: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 40,
    elevation: 18,
  },
  edgeMenuButton: {
    // Deliberately slim. It floats over whatever screen is beneath it, and
    // every pixel of width is a pixel of someone's content it covers.
    width: 24,
    height: 46,
    // Flat against the screen edge, rounded on the side that faces content.
    borderTopRightRadius: Radius.chip,
    borderBottomRightRadius: Radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 0,
    ...Shadow.subtle,
  },
});

/**
 * Back control for pushed drawer screens. Drawer headers show a hamburger by
 * default, which leaves secondary screens with no way back; this falls back to
 * the drawer's home tab when there is nothing to pop.
 */
export function HeaderBackButton({ destination }: { destination?: Href }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        if (destination) router.replace(destination);
        else if (router.canGoBack()) router.back();
        else router.replace('/');
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={({ pressed }) => [styles.back, pressed && { opacity: 0.55 }]}>
      <Ionicons name="chevron-back" size={26} color={theme.text} />
    </Pressable>
  );
}
