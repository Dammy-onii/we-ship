import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFriends } from '@/lib/friends';
import { useWidgetData, YOU_ID } from '@/lib/store';
import { requestWidgetPin, WIDGET_KINDS } from '@/widgets';

type WidgetCard = {
  kind: string;
  name: string;
  blurb: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  interactive?: boolean;
  lockScreen?: boolean;
};

const CATALOG: WidgetCard[] = [
  {
    kind: 'partner-carousel',
    name: 'Us',
    blurb: 'Photos, videos and notes you have shared, changing through the day. Swipe to browse.',
    icon: 'images-outline',
  },
  {
    kind: 'friends-carousel',
    name: 'Friends',
    blurb: 'The same carousel, filled with what your friends post.',
    icon: 'planet-outline',
  },
  {
    kind: 'presence',
    name: 'Presence',
    blurb: 'Their mood and their time — or when they were last around, if you share a timezone.',
    icon: 'person-circle-outline',
    lockScreen: true,
  },
  {
    kind: 'streak-question',
    name: 'Streak & question',
    blurb: 'Your streak, today’s question, and who has answered.',
    icon: 'flame-outline',
  },
  {
    kind: 'nudge',
    name: 'Nudge',
    blurb: 'Send a heart straight from the home screen, without opening Weship.',
    icon: 'heart-outline',
    interactive: true,
  },
  {
    kind: 'todo',
    name: '2do',
    blurb: 'Your next incomplete shared 2do. Tap the circle to tick it off.',
    icon: 'checkbox-outline',
    interactive: true,
  },
];

export default function WidgetsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useWidgetData();
  const friends = useFriends();
  const [adding, setAdding] = useState<string>();

  // Web has no home screen to add to, so `WIDGET_KINDS` is empty there. Show
  // the catalogue anyway rather than a blank page, and say why it is inert.
  const supported = WIDGET_KINDS.length > 0;
  const available = supported
    ? CATALOG.filter((item) => WIDGET_KINDS.includes(item.kind))
    : CATALOG;

  const add = async (item: WidgetCard) => {
    if (!supported) {
      Alert.alert('Open Weship on your phone', 'Widgets live on your phone’s home screen.');
      return;
    }
    setAdding(item.kind);
    try {
      // Android hands this to the launcher, which shows its own confirmation.
      const pinned = await requestWidgetPin(item.kind);
      if (pinned) return;
      // iOS has no API for adding a widget. Some Android launchers decline too.
      Alert.alert(
        'Add it from your phone',
        Platform.OS === 'ios'
          ? `For the Home Screen, touch and hold the background, tap Edit → Add Widget, then choose Weship ${item.name}. For the Lock Screen, touch and hold it, tap Customize, then choose the Weship widget.`
          : `Touch and hold your Home Screen, tap Widgets, then choose Weship ${item.name}. On phones that support Lock Screen widgets, add the same Weship widget from Lock Screen settings.`,
      );
    } finally {
      setAdding(undefined);
    }
  };

  const topTask = data.habits.find(
    (habit) => !(data.todayLog?.habits[habit.id]?.[YOU_ID] ?? false),
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
      <View style={styles.intro}>
        <Text variant="micro" color="textFaint">HOME &amp; LOCK SCREEN</Text>
        <Text variant="display">Weship, at a glance</Text>
        <Text variant="body" color="textSoft">
          {supported
            ? 'Tap any widget to add it. Every widget supports the Home Screen and compatible Lock Screens.'
            : 'Widgets live on your phone’s Home Screen and compatible Lock Screens. This is what you can add.'}
        </Text>
      </View>

      {/* A live preview built from the same data the widgets receive. */}
      <View style={[styles.preview, Shadow.soft, { backgroundColor: theme.surfaceAlt }]}>
        <Text variant="micro" color="textFaint">
          {data.partner?.displayName?.toUpperCase() ?? 'YOUR PERSON'}
        </Text>
        <View style={{ flex: 1 }} />
        <Text variant="title" numberOfLines={3}>
          {topTask?.label ?? 'All caught up'}
        </Text>
        <Text variant="micro" color="textFaint">
          {`${data.goodies.length} shared · ${friends.posts.length} from friends`}
        </Text>
      </View>

      <View style={styles.list}>
        {available.map((item) => (
          <Pressable
            key={item.kind}
            onPress={() => add(item)}
            disabled={Boolean(adding)}
            accessibilityRole="button"
            accessibilityLabel={`Add the ${item.name} widget`}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.line },
              pressed && { opacity: 0.85 },
            ]}>
            <View style={[styles.cardIcon, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name={item.icon} size={20} color={theme.primaryDeep} />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardHead}>
                <Text variant="bodyStrong">{item.name}</Text>
                {item.interactive ? <Tag label="Buttons" /> : null}
                <Tag label="Home screen" />
                {item.lockScreen ? <Tag label="Lock screen" /> : null}
              </View>
              <Text variant="caption" color="textSoft">
                {item.blurb}
              </Text>
            </View>
            <Ionicons
              name={adding === item.kind ? 'ellipsis-horizontal' : 'add-circle'}
              size={22}
              color={supported ? theme.primary : theme.disabledText}
            />
          </Pressable>
        ))}
      </View>

      <Text variant="caption" color="textFaint" center>
        Widgets only ever show what has already been shared with you.
      </Text>
    </ScrollView>
  );
}

function Tag({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}>
      <Text variant="micro" color="textSoft">
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg },
  intro: { gap: Spacing.sm, paddingTop: Spacing.sm },
  preview: {
    width: 182,
    height: 182,
    borderRadius: Radius.tile,
    padding: Spacing.base,
    alignSelf: 'center',
  },
  list: { gap: Spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
