import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { showDialog } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/use-theme';
import { useWidgetData } from '@/lib/store';
import { requestWidgetPin, WIDGET_KINDS } from '@/widgets';

type WidgetCard = {
  kind: string;
  name: string;
  /** One line, for the card. */
  blurb: string;
  /** What it shows, how it moves, what a tap does — the things people ask. */
  details?: string[];
  /** True when the widget is useless without a partner. */
  needsPartner?: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  interactive?: boolean;
  lockScreen?: boolean;
};

const CATALOG: WidgetCard[] = [
  {
    kind: 'partner-carousel',
    name: 'Us',
    blurb: 'A slideshow of the photos, videos and notes the two of you have shared.',
    details: [
      'One item at a time, filling the whole widget. Your last 12 photos, videos and notes.',
      'Anything your partner favourites for you leads the slideshow, marked with a star.',
      'Moves on its own through the day. On Android you can swipe it; on iOS, tap the ‹ › arrows — Apple does not allow swiping inside a widget.',
      'Tapping opens that exact item full screen, not the top of the gallery.',
      'To favourite something for them, press and hold it in Spotlight.',
      'Tip: put Us and Friends in the same stack to swipe between them.',
    ],
    needsPartner: true,
    icon: 'images-outline',
  },
  {
    kind: 'friends-carousel',
    name: 'Friends',
    blurb: 'The same slideshow, filled with what your friends have posted.',
    details: [
      'The most recent post from each friend — one each, so nobody crowds out the rest.',
      'Reshuffled once a day, so the same person is not permanently on top.',
      'Your own posts are left out. This one is for seeing other people.',
      'Friend photos are kept on your phone for two days to save space, so older ones drop out of the slideshow on their own.',
      'Empty until you have friends — tap it to find people you already know.',
    ],
    icon: 'planet-outline',
  },
  {
    kind: 'presence',
    name: 'Presence',
    blurb: 'Their mood, and one line worth knowing underneath it.',
    details: [
      'Their current mood, and whatever they typed as their status.',
      'Long distance: their local time, so you know whether it is a good moment to call.',
      'Same timezone: their clock would just be yours, so it shows the last thing you sent each other instead.',
      'On the medium and large sizes it also shows your next unfinished 2do.',
      'Works on the lock screen as a single line. Tapping opens Weship.',
    ],
    needsPartner: true,
    icon: 'person-circle-outline',
    lockScreen: true,
  },
  {
    kind: 'quick-send',
    name: 'Quick send',
    blurb: 'One tap from your home screen to sending a photo, a voice note or a note.',
    details: [
      'Three buttons: photo, voice, note. Each opens the composer already on the right one.',
      'The voice button starts recording the moment the app opens, so a memo is two taps.',
      'Opens the app on purpose — a widget cannot reach the camera or microphone by itself.',
      'On iOS the small size shows the photo button only; medium and large show all three. Android always shows all three.',
      'Your streak now lives on the Presence widget.',
    ],
    needsPartner: true,
    icon: 'flash-outline',
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
  const [adding, setAdding] = useState<string>();

  // Web has no home screen to add to, so `WIDGET_KINDS` is empty there. Show
  // the catalogue anyway rather than a blank page, and say why it is inert.
  const supported = WIDGET_KINDS.length > 0;
  const available = supported
    ? CATALOG.filter((item) => WIDGET_KINDS.includes(item.kind))
    : CATALOG;

  const add = async (item: WidgetCard) => {
    if (!supported) {
      showDialog('Open Weship on your phone', 'Widgets live on your phone’s home screen.');
      return;
    }
    setAdding(item.kind);
    try {
      // Android hands this to the launcher, which shows its own confirmation.
      const pinned = await requestWidgetPin(item.kind);
      if (pinned) return;
      // iOS has no API for adding a widget. Some Android launchers decline too.
      showDialog(
        'Add it from your phone',
        Platform.OS === 'ios'
          ? `For the Home Screen, touch and hold the background, tap Edit → Add Widget, then choose Weship ${item.name}. For the Lock Screen, touch and hold it, tap Customize, then choose the Weship widget.`
          : `Touch and hold your Home Screen, tap Widgets, then choose Weship ${item.name}. On phones that support Lock Screen widgets, add the same Weship widget from Lock Screen settings.`,
      );
    } finally {
      setAdding(undefined);
    }
  };

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
            {/*
              * Header row, then full-width copy beneath it. The description
              * used to share a row with the thumbnail and the add button, so
              * every line broke after three or four words.
              */}
            <View style={styles.cardHead}>
              <WidgetThumbnail item={item} />
              <View style={styles.cardTitle}>
                <Text variant="bodyStrong">{item.name}</Text>
                <View style={styles.tagRow}>
                  {item.interactive ? <Tag label="Buttons" /> : null}
                  <Tag label="Home screen" />
                  {item.lockScreen ? <Tag label="Lock screen" /> : null}
                  {item.needsPartner ? <Tag label="Needs a partner" /> : null}
                </View>
              </View>
              <Ionicons
                name={adding === item.kind ? 'ellipsis-horizontal' : 'add-circle'}
                size={24}
                color={supported ? theme.primary : theme.disabledText}
              />
            </View>

            <Text variant="caption" color="textSoft" style={styles.blurb}>
              {item.blurb}
            </Text>

            {item.details ? (
              <View style={styles.details}>
                {item.details.map((line) => (
                  <View key={line} style={styles.detailRow}>
                    <View style={[styles.bullet, { backgroundColor: theme.textFaint }]} />
                    <Text variant="caption" color="textFaint" style={styles.detailText}>
                      {line}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      <Text variant="caption" color="textFaint" center>
        Widgets only ever show what has already been shared with you.
      </Text>
    </ScrollView>
  );
}

/**
 * A miniature of the real widget.
 *
 * An Ionicon told you nothing about what you were about to put on your home
 * screen. These mirror each widget's actual layout, drawn from the same data
 * the widget receives, so the card and the thing you add look alike.
 */
function WidgetThumbnail({ item }: { item: WidgetCard }) {
  const theme = useTheme();
  const data = useWidgetData();

  if (item.kind === 'partner-carousel' || item.kind === 'friends-carousel') {
    const friendsKind = item.kind === 'friends-carousel';
    const image = friendsKind ? undefined : data.goodies.find((g) => g.kind === 'photo')?.uri;
    // White chrome reads over a photo and disappears over the pale empty
    // ground, so the overlay follows whichever is actually behind it.
    const chrome = image ? theme.onPrimary : theme.textFaint;
    return (
      <View style={[styles.thumb, { backgroundColor: theme.surfaceSunk }]}>
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : null}
        <View style={styles.thumbTop}>
          <Text variant="micro" style={{ color: chrome, fontSize: 7 }}>
            {friendsKind ? 'FRIENDS' : 'US'}
          </Text>
          <Text variant="micro" style={{ color: chrome, fontSize: 7 }}>1/12</Text>
        </View>
        {!image ? <Ionicons name={item.icon} size={18} color={theme.textFaint} /> : null}
        <View style={styles.thumbArrows}>
          <Text variant="micro" style={{ color: chrome, fontSize: 9 }}>‹ ›</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.thumb, { backgroundColor: theme.primarySoft }]}>
      <Ionicons name={item.icon} size={22} color={theme.primaryDeep} />
    </View>
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
  list: { gap: Spacing.md },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: Radius.chip,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbTop: {
    position: 'absolute',
    top: 4,
    left: 5,
    right: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  thumbArrows: { position: 'absolute', bottom: 3, right: 5 },
  details: { gap: 7, marginTop: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  detailText: { flex: 1, lineHeight: 19 },
  bullet: { width: 3, height: 3, borderRadius: 2, marginTop: 8 },
  card: {
    gap: Spacing.sm,
    padding: Spacing.base,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardTitle: { flex: 1, gap: 5 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  blurb: { lineHeight: 20 },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
