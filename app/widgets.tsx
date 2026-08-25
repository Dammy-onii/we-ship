import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { showDialog } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/use-theme';
import { useFriends } from '@/lib/friends';
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
      'One edge-to-edge item at a time from your latest 12 shares.',
      'Use ‹ › to browse; it also advances during the day.',
      'Tap the item to open it full screen.',
    ],
    needsPartner: true,
    icon: 'images-outline',
  },
  {
    kind: 'friends-carousel',
    name: 'Friends',
    blurb: 'The same slideshow, filled with what your friends have posted.',
    details: [
      'One recent post per friend, reshuffled daily.',
      'Photos, video covers and notes fill the same flat frame.',
      'Use ‹ › to browse; tap to open that post.',
    ],
    icon: 'planet-outline',
  },
  {
    kind: 'presence',
    name: 'Presence',
    blurb: 'Their mood, and one line worth knowing underneath it.',
    details: [
      'Their mood, status and useful local-time context.',
      'Medium sizes also show your next unfinished 2do.',
      'Tap anywhere to open Weship.',
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
      'Photo, voice and note shortcuts open the right composer.',
      'Voice starts recording as the app opens.',
    ],
    needsPartner: true,
    icon: 'flash-outline',
  },
  {
    kind: 'todo',
    name: '2do',
    blurb: 'Four shared tasks at a glance, with the rest one gesture or tap away.',
    details: [
      'Android shows about four rows at its normal size and scrolls through the full list.',
      'Tap a circle on Android to complete it; tasks requiring a note open in Weship.',
      'iOS shows up to four rows and opens the full list when tapped.',
    ],
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
            ? 'Preview each layout here, then tap Add. Home-screen widgets use the same content and proportions.'
            : 'Widgets live on your phone’s Home Screen and compatible Lock Screens. This is what you can add.'}
        </Text>
      </View>

      <View style={styles.list}>
        {available.map((item) => (
          <View
            key={item.kind}
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.line },
            ]}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIcon, { backgroundColor: theme.primarySoft }]}>
                <Ionicons name={item.icon} size={19} color={theme.primaryDeep} />
              </View>
              <View style={styles.cardTitle}>
                <Text variant="bodyStrong">{item.name}</Text>
                <View style={styles.tagRow}>
                  {item.interactive ? <Tag label="Buttons" /> : null}
                  <Tag label="Home screen" />
                  {item.lockScreen ? <Tag label="Lock screen" /> : null}
                  {item.needsPartner ? <Tag label="Needs a partner" /> : null}
                </View>
              </View>
              <Pressable
                onPress={() => add(item)}
                disabled={Boolean(adding)}
                accessibilityRole="button"
                accessibilityLabel={`Add the ${item.name} widget`}
                style={({ pressed }) => [
                  styles.addButton,
                  { backgroundColor: theme.primarySoft },
                  pressed && { opacity: 0.7 },
                ]}>
                <Ionicons
                  name={adding === item.kind ? 'ellipsis-horizontal' : 'add'}
                  size={17}
                  color={supported ? theme.primaryDeep : theme.disabledText}
                />
                <Text variant="captionStrong" color={supported ? 'primaryDeep' : 'textFaint'}>
                  Add
                </Text>
              </Pressable>
            </View>

            <WidgetPreview item={item} />

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
          </View>
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
 * screen. These mirror each widget's actual proportions and hierarchy; the
 * carousels use current account media when available and representative copy
 * otherwise, so the card and the thing you add look alike without being empty.
 */
function WidgetPreview({ item }: { item: WidgetCard }) {
  const theme = useTheme();
  const data = useWidgetData();
  const { posts } = useFriends();

  if (item.kind === 'partner-carousel' || item.kind === 'friends-carousel') {
    const friendsKind = item.kind === 'friends-carousel';
    const source = friendsKind
      ? posts.find((post) => !post.mine && (post.kind === 'photo' || post.kind === 'video' || post.kind === 'note'))
      : data.goodies.find((goodie) => goodie.kind === 'photo' || goodie.kind === 'video' || goodie.kind === 'note');
    const image = source && source.kind !== 'note' ? source.uri : undefined;
    const note = source?.text || (friendsKind ? 'A little window into their day.' : 'Somewhere worth remembering.');
    return (
      <View style={[styles.carouselPreview, { backgroundColor: theme.surfaceSunk }]}>
        <LinearGradient
          colors={friendsKind ? ['#8DA2A8', '#47585E'] : ['#C69B7D', '#704936']}
          style={StyleSheet.absoluteFill}
        />
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : source?.kind === 'note' ? (
          <View style={[styles.notePreview, { backgroundColor: theme.bg }]}>
            <Text variant="serif" numberOfLines={5}>{note}</Text>
          </View>
        ) : null}
        <View style={styles.previewTop}>
          <View style={styles.previewChip}>
            <Text variant="micro" style={styles.previewChipText}>
              {friendsKind ? 'WESHIP FRIENDS' : 'WESHIP US'}
            </Text>
          </View>
          <Text variant="micro" style={styles.previewCount}>1/6</Text>
        </View>
        <View style={styles.previewFooter}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" style={styles.previewCaption} numberOfLines={1}>
              {note}
            </Text>
            <Text variant="micro" style={styles.previewAuthor}>
              {friendsKind ? 'YOUR FRIEND' : 'YOU'}
            </Text>
          </View>
          <View style={styles.previewArrows}>
            <Text variant="title" style={styles.previewArrow}>‹</Text>
            <Text variant="title" style={styles.previewArrow}>›</Text>
          </View>
        </View>
      </View>
    );
  }

  if (item.kind === 'presence') {
    return (
      <View style={[styles.presencePreview, { backgroundColor: theme.bg }]}>
        <View style={styles.presenceHead}>
          <View style={styles.moodBadge}><Text variant="title">☀️</Text></View>
          <View style={{ flex: 1 }}>
            <Text variant="title">Riri</Text>
            <Text variant="micro" color="primaryDeep">RIGHT NOW</Text>
          </View>
          <View style={[styles.streakBadge, { backgroundColor: theme.primaryDeep }]}>
            <Text variant="micro" style={{ color: '#FCFAF7' }}>🔥 12</Text>
          </View>
        </View>
        <View style={[styles.statusPanel, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text variant="bodyStrong">Feeling calm and taking it slow.</Text>
        </View>
        <View style={styles.presenceDetails}>
          <PreviewInfo label="THEIR TIME" value="8:42 PM" />
          <PreviewInfo label="NEXT 2DO" value="Plan Friday dinner" />
        </View>
      </View>
    );
  }

  if (item.kind === 'quick-send') {
    return (
      <View style={[styles.widePreview, { backgroundColor: theme.bg }]}>
        <View style={styles.quickHead}>
          <Ionicons name="paper-plane" size={15} color={theme.primaryDeep} />
          <Text variant="micro" style={{ flex: 1 }}>SEND TO RIRI</Text>
          <Text variant="micro" color="textSoft">OPEN COMPOSER</Text>
        </View>
        <View style={styles.quickActions}>
          {[
            ['camera', 'PHOTO', 'Camera', '#E2ECE4'],
            ['mic', 'VOICE', 'Record', '#EEDFD9'],
            ['document-text', 'NOTE', 'Write', '#ECE6D2'],
          ].map(([icon, label, hint, fill]) => (
            <View key={label} style={[styles.quickAction, { backgroundColor: fill }]}>
              <Ionicons name={icon as React.ComponentProps<typeof Ionicons>['name']} size={24} color={theme.primaryDeep} />
              <Text variant="micro">{label}</Text>
              <Text variant="micro" color="textSoft">{hint}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.todoPreview, { backgroundColor: theme.bg }]}>
      <View style={styles.previewRow}>
        <Text variant="micro" color="textSoft">WESHIP 2DO</Text>
        <Text variant="captionStrong" color="primaryDeep">0/4</Text>
      </View>
      {['Post on X or LinkedIn', 'Clinic plan', 'Book the train', 'Pick date-night film'].map((label) => (
        <View key={label} style={[styles.todoRow, { borderTopColor: theme.line }]}>
          <Ionicons name="ellipse-outline" size={17} color={theme.primaryDeep} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>{label}</Text>
            <Text variant="micro" color="textFaint">WEEKLY</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function PreviewInfo({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="micro" color="textSoft" numberOfLines={1}>{label}</Text>
      <Text variant="captionStrong" numberOfLines={1}>{value}</Text>
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
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardTitle: { flex: 1, gap: 5 },
  addButton: {
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  blurb: { lineHeight: 20 },
  carouselPreview: {
    width: '82%',
    maxWidth: 300,
    aspectRatio: 1,
    alignSelf: 'center',
    borderRadius: Radius.tile,
    overflow: 'hidden',
  },
  notePreview: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  previewTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(24,32,27,0.6)',
  },
  previewChipText: { color: '#FCFAF7', fontSize: 9 },
  previewCount: { color: '#FCFAF7', textShadowColor: '#18201B', textShadowRadius: 4 },
  previewFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 66,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(24,32,27,0.62)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  previewCaption: { color: '#FCFAF7' },
  previewAuthor: { color: '#FCFAF7', marginTop: 2 },
  previewArrows: { flexDirection: 'row', gap: 7 },
  previewArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    textAlign: 'center',
    lineHeight: 29,
    color: '#FCFAF7',
    backgroundColor: 'rgba(24,32,27,0.65)',
  },
  widePreview: {
    width: '100%',
    aspectRatio: 2,
    borderRadius: Radius.tile,
    padding: Spacing.base,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  presencePreview: {
    width: '100%',
    aspectRatio: 1.55,
    borderRadius: Radius.tile,
    padding: Spacing.base,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  presenceHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  moodBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EADDD7',
  },
  streakBadge: { borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  statusPanel: {
    flex: 1,
    justifyContent: 'center',
    borderRadius: Radius.inset,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  presenceDetails: { flexDirection: 'row', gap: Spacing.md },
  quickHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  quickActions: { flexDirection: 'row', gap: Spacing.sm, flex: 1, alignItems: 'stretch' },
  quickAction: {
    flex: 1,
    borderRadius: Radius.inset,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  todoPreview: {
    width: '100%',
    aspectRatio: 1.15,
    borderRadius: Radius.tile,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    overflow: 'hidden',
  },
  todoRow: {
    minHeight: 50,
    paddingVertical: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
