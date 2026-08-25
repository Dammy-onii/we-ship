import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ensureCachedMedia } from '@/lib/media-cache';
import { cacheScopeFor, type SpotlightItem } from '@/lib/spotlight-item';

/**
 * The responsive masonry shared by the partner Spotlight and the friend
 * Spotlight. Each kind gets a visually distinct card, and each declares its own
 * height — that is what makes the grid stagger rather than sit on a rigid grid.
 */

/** Column sizing. Two hard-coded columns made cards enormous on anything wide. */
const TARGET_COLUMN = 190;
const MAX_COLUMN = 260;
const MAX_COLUMNS = 5;
/** No card grows past this, however tall its media wants to be. */
const MAX_CARD_HEIGHT = 320;
/** Notes may need more room than media so wrapped copy never hides its byline. */
const MAX_NOTE_LINES = 7;
const NOTE_LINE_HEIGHT = 23;

export function SpotlightSection({
  title,
  count,
  items,
  onOpen,
  onLongPress,
}: {
  title: string;
  count: number;
  items: SpotlightItem[];
  onOpen: (item: SpotlightItem) => void;
  /** Optional secondary action — the partner gallery uses it to favourite. */
  onLongPress?: (item: SpotlightItem) => void;
}) {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const { columnCount, columnWidth } = useMemo(() => layoutFor(width), [width]);
  const columns = useMemo(
    () => toColumns(items, columnCount, columnWidth, fontScale),
    [items, columnCount, columnWidth, fontScale],
  );

  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.sectionHead}>
        <Text variant="micro" color="textFaint">
          {title.toUpperCase()}
        </Text>
        <View style={[styles.count, { backgroundColor: theme.surfaceAlt }]}>
          <Text variant="micro" color="textSoft">
            {count}
          </Text>
        </View>
      </View>
      {/* Centred: on a wide screen the capped columns do not fill the row, and
          left-aligning them leaves the gallery hugging one edge. */}
      <View style={styles.masonry}>
        {columns.map((column, columnIndex) => (
          <View key={columnIndex} style={{ width: columnWidth, gap: Spacing.sm }}>
            {column.items.map((item, i) => (
              <Animated.View
                key={item.id}
                entering={FadeInDown.duration(260).delay(Math.min(i, 6) * 40)}>
                <SpotlightCard
                  item={item}
                  width={columnWidth}
                  height={cardHeight(item, columnWidth, fontScale)}
                  onPress={() => onOpen(item)}
                  onLongPress={onLongPress ? () => onLongPress(item) : undefined}
                />
              </Animated.View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Picks a column count and width for the available space.
 *
 * Aims for roughly `TARGET_COLUMN` per column, never fewer than two, and caps
 * the width so a tablet or a wide web window gets more columns rather than
 * enormous ones.
 */
function layoutFor(width: number) {
  const available = width - Spacing.lg * 2;
  const columnCount = Math.max(
    2,
    Math.min(MAX_COLUMNS, Math.floor((available + Spacing.sm) / (TARGET_COLUMN + Spacing.sm))),
  );
  const columnWidth = Math.min(
    MAX_COLUMN,
    (available - Spacing.sm * (columnCount - 1)) / columnCount,
  );
  return { columnCount, columnWidth };
}

/**
 * Distributes items into balanced columns.
 *
 * Each card declares its own height, so a naive row layout would leave ragged
 * gaps. Placing every next card in the currently shortest column keeps the
 * columns even without measuring rendered views.
 */
function toColumns(
  items: SpotlightItem[],
  columnCount: number,
  width: number,
  fontScale: number,
) {
  const columns: { items: SpotlightItem[]; height: number }[] = Array.from(
    { length: columnCount },
    () => ({ items: [], height: 0 }),
  );
  for (const item of items) {
    const shortest = columns.reduce((min, c) => (c.height < min.height ? c : min), columns[0]);
    shortest.items.push(item);
    shortest.height += cardHeight(item, width, fontScale);
  }
  return columns;
}

/** Intrinsic media ratio, clamped so a panorama or very tall image stays usable. */
function cardHeight(item: SpotlightItem, width: number, fontScale: number) {
  switch (item.kind) {
    case 'photo':
    case 'video': {
      const ratio =
        item.width && item.height
          ? Math.max(0.72, Math.min(1.45, item.height / item.width))
          : 1;
      return Math.min(MAX_CARD_HEIGHT, width * ratio);
    }
    case 'voice':
      return 132;
    case 'reminder':
      return 148;
    default: {
      // Character count alone cannot predict wrapping: the same sentence takes
      // far more lines in a narrow phone column than on a tablet. Estimate from
      // the actual card width, reserve a fixed footer, and include the system's
      // text scale so the byline and reactions always remain inside the card.
      const usableWidth = Math.max(1, width - Spacing.base * 2);
      const averageGlyphWidth = 7.5 * fontScale;
      const charactersPerLine = Math.max(8, Math.floor(usableWidth / averageGlyphWidth));
      const wrappedLines = (item.text ?? '').split('\n').reduce(
        (total, paragraph) =>
          total + Math.max(1, Math.ceil(paragraph.length / charactersPerLine)),
        0,
      );
      const lines = Math.max(1, Math.min(MAX_NOTE_LINES, wrappedLines));
      const chromeHeight = 70 * Math.max(1, fontScale);
      return Math.min(420, chromeHeight + lines * NOTE_LINE_HEIGHT * fontScale);
    }
  }
}

function SpotlightCard({
  item,
  width,
  height,
  onPress,
  onLongPress,
}: {
  item: SpotlightItem;
  width: number;
  height: number;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const shared = { width, height, onPress, onLongPress };
  if (item.kind === 'photo' || item.kind === 'video') return <MediaCard item={item} {...shared} />;
  if (item.kind === 'voice') return <VoiceCard item={item} {...shared} />;
  if (item.kind === 'reminder') return <ReminderCard item={item} {...shared} />;
  return <NoteCard item={item} {...shared} />;
}

type CardProps = {
  item: SpotlightItem;
  width: number;
  height: number;
  onPress: () => void;
  onLongPress?: () => void;
};

function byline(item: SpotlightItem) {
  return item.mine ? 'YOU' : item.authorName.toUpperCase();
}

function CardShell({
  children,
  height,
  onPress,
  onLongPress,
  label,
  style,
}: {
  children: React.ReactNode;
  height: number;
  onPress: () => void;
  onLongPress?: () => void;
  label: string;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={onLongPress ? 'Press and hold to favourite this onto their widget' : undefined}
      style={({ pressed }) => [pressed && { opacity: 0.84, transform: [{ scale: 0.99 }] }]}>
      <View style={[styles.card, { height }, style]}>{children}</View>
    </Pressable>
  );
}

/** The emoji for each reaction kind, in display order. */
const REACTION_EMOJI: Record<string, string> = {
  love: '❤️', laugh: '😂', sad: '😢', angry: '😠', cry: '😭', dislike: '👎',
};

/**
 * A small badge showing which reactions a post drew, and how many in total.
 *
 * On the card, before it is opened — so the board reads at a glance. Shows up to
 * three distinct emoji that actually have a count, then the sum. Absent entirely
 * when nothing has reacted, so an unreacted board stays clean.
 */
function ReactionSummary({ reactions, onPhoto }: { reactions?: SpotlightItem['reactions']; onPhoto?: boolean }) {
  const theme = useTheme();
  if (!reactions) return null;
  const present = (['love', 'laugh', 'sad', 'angry', 'cry', 'dislike'] as const).filter(
    (kind) => reactions.counts[kind] > 0,
  );
  const total = present.reduce((sum, kind) => sum + reactions.counts[kind], 0);
  if (total === 0) return null;
  return (
    <View
      style={[
        styles.reactionBadge,
        { backgroundColor: onPhoto ? 'rgba(24,20,16,0.55)' : theme.surfaceAlt },
      ]}>
      <Text style={styles.reactionBadgeEmoji}>{present.slice(0, 3).map((k) => REACTION_EMOJI[k]).join('')}</Text>
      <Text variant="micro" style={{ color: onPhoto ? '#FFFCF7' : theme.textSoft }}>
        {total}
      </Text>
    </View>
  );
}

/** Photo/video: image fills the card, byline sits over a scrim. */
function MediaCard({ item, height, onPress, onLongPress }: CardProps) {
  const theme = useTheme();
  const scope = cacheScopeFor(item);
  const [uri, setUri] = useState<string | undefined>(item.uri);

  useEffect(() => {
    let cancelled = false;
    if (!item.uri) return;
    // Saves on first view; friend media then serves from disk until it expires.
    ensureCachedMedia(item.id, item.kind, item.uri, scope).then((next) => {
      if (!cancelled) setUri(next);
    });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.kind, item.uri, scope]);

  return (
    <CardShell
      height={height}
      onPress={onPress}
      onLongPress={onLongPress}
      label={`${item.kind} from ${item.mine ? 'you' : item.authorName}`}
      style={{ backgroundColor: theme.surfaceAlt }}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <View style={styles.cardFallback}>
          <Ionicons name="image-outline" size={24} color={theme.textFaint} />
        </View>
      )}
      {item.kind === 'video' ? (
        <View style={styles.playBadge}>
          <Ionicons name="play" size={14} color="#1E1D19" />
        </View>
      ) : null}
      <View style={styles.reactionCorner}>
        <ReactionSummary reactions={item.reactions} onPhoto />
      </View>
      <View style={styles.mediaByline}>
        {item.text ? (
          <Text variant="captionStrong" style={styles.mediaCaption} numberOfLines={2}>
            {item.text}
          </Text>
        ) : null}
        <View style={styles.mediaAuthor}>
          <View style={[styles.kindDot, { backgroundColor: item.mine ? theme.primary : theme.partner }]} />
          <Text variant="micro" style={{ color: '#FFFCF7' }} numberOfLines={1}>
            {byline(item)}
          </Text>
        </View>
      </View>
    </CardShell>
  );
}

/** Voice: a waveform-styled card, visually unlike the others. */
function VoiceCard({ item, height, onPress, onLongPress }: CardProps) {
  const theme = useTheme();
  const accent = item.mine ? theme.primary : theme.partner;
  // Deterministic bars from the id so a note looks the same on every render.
  const bars = Array.from({ length: 22 }, (_, i) => {
    const seed = item.id.charCodeAt(i % item.id.length) + i * 7;
    return 8 + (seed % 22);
  });

  return (
    <CardShell
      height={height}
      onPress={onPress}
      onLongPress={onLongPress}
      label={`Voice note from ${item.mine ? 'you' : item.authorName}`}
      style={{
        backgroundColor: item.mine ? theme.primarySoft : theme.partnerSoft,
        padding: Spacing.base,
        justifyContent: 'space-between',
      }}>
      <View style={styles.cardHead}>
        <View style={[styles.iconPill, { backgroundColor: accent }]}>
          <Ionicons name="mic" size={13} color={theme.onPrimary} />
        </View>
        <Text variant="micro" color="textFaint">
          {item.durationSeconds ? `${item.durationSeconds}s` : 'VOICE'}
        </Text>
      </View>
      <View style={styles.waveform}>
        {bars.map((barHeight, i) => (
          <View
            key={i}
            style={[styles.bar, { height: barHeight, backgroundColor: accent, opacity: 0.35 + (i % 4) * 0.16 }]}
          />
        ))}
      </View>
      <Text variant="micro" color="textFaint" numberOfLines={1}>
        {byline(item)}
      </Text>
    </CardShell>
  );
}

/** Note: type-led card that grows with its content. */
function NoteCard({ item, height, onPress, onLongPress }: CardProps) {
  const theme = useTheme();
  return (
    <CardShell
      height={height}
      onPress={onPress}
      onLongPress={onLongPress}
      label={`Note from ${item.mine ? 'you' : item.authorName}`}
      style={{
        backgroundColor: theme.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.line,
        padding: Spacing.base,
        justifyContent: 'space-between',
      }}>
      <View style={[styles.quoteBar, { backgroundColor: item.mine ? theme.primary : theme.partner }]} />
      <Text
        variant="serif"
        style={{ fontSize: 15, lineHeight: NOTE_LINE_HEIGHT }}
        numberOfLines={MAX_NOTE_LINES}>
        {item.text ?? '—'}
      </Text>
      <View style={styles.cardFootRow}>
        <Text variant="micro" color="textFaint" numberOfLines={1} style={{ flex: 1 }}>
          {byline(item)}
        </Text>
        <ReactionSummary reactions={item.reactions} />
      </View>
    </CardShell>
  );
}

/** Reminder: deliberately the loudest card so it reads as an ask. */
function ReminderCard({ item, height, onPress, onLongPress }: CardProps) {
  const theme = useTheme();
  return (
    <CardShell
      height={height}
      onPress={onPress}
      onLongPress={onLongPress}
      label={`Reminder from ${item.mine ? 'you' : item.authorName}`}
      style={{
        backgroundColor: theme.gold + '24',
        borderWidth: 1,
        borderColor: theme.gold + '55',
        padding: Spacing.base,
        justifyContent: 'space-between',
      }}>
      <View style={[styles.iconPill, { backgroundColor: theme.gold }]}>
        <Ionicons name="alarm-outline" size={13} color="#1E1D19" />
      </View>
      <Text variant="bodyStrong" numberOfLines={4}>
        {item.text ?? 'Reminder'}
      </Text>
      <Text variant="micro" color="textFaint" numberOfLines={1}>
        {byline(item)}
      </Text>
    </CardShell>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  count: {
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  masonry: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  card: { borderRadius: Radius.tile, overflow: 'hidden' },
  cardFallback: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconPill: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  mediaByline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    backgroundColor: 'rgba(18,17,16,0.42)',
  },
  mediaCaption: { color: '#FFFCF7' },
  mediaAuthor: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reactionCorner: { position: 'absolute', top: 8, left: 8 },
  cardFootRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reactionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
  },
  reactionBadgeEmoji: { fontSize: 11 },
  playBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(252,250,247,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  bar: { width: 3, borderRadius: 2 },
  quoteBar: { width: 26, height: 3, borderRadius: 2 },
  kindDot: { width: 6, height: 6, borderRadius: 3 },
});
