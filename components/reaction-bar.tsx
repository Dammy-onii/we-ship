import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PostReactions, ReactionKind } from '@/lib/types';

import { Text } from './ui/text';

/** The six reactions, in the order they are offered, with their glyphs. */
export const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: 'love', emoji: '❤️', label: 'Love' },
  { kind: 'laugh', emoji: '😂', label: 'Laugh' },
  { kind: 'sad', emoji: '😢', label: 'Sad' },
  { kind: 'angry', emoji: '😠', label: 'Angry' },
  { kind: 'cry', emoji: '😭', label: 'Cry' },
  { kind: 'dislike', emoji: '👎', label: 'Dislike' },
];

/**
 * The reaction picker under a friend post.
 *
 * Tapping a reaction you have not given sets it; tapping the one you already
 * gave takes it back. Only one reaction per person, so choosing a second
 * replaces the first — the parent handles that, this only reports the tap.
 *
 * Counts are shown to everyone who can see the post. What is private is the
 * lifetime *total* on a person's profile, which lives elsewhere; a per-post
 * count is not a running tally of a person and gives no one a scoreboard.
 */
export function ReactionBar({
  reactions,
  onReact,
  disabled,
}: {
  reactions?: PostReactions;
  onReact: (kind: ReactionKind | null) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const mine = reactions?.mine;

  return (
    <View style={styles.row}>
      {REACTIONS.map(({ kind, emoji, label }) => {
        const count = reactions?.counts[kind] ?? 0;
        const selected = mine === kind;
        return (
          <Pressable
            key={kind}
            disabled={disabled}
            onPress={() => onReact(selected ? null : kind)}
            accessibilityRole="button"
            accessibilityLabel={selected ? `Remove ${label} reaction` : `React ${label}`}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: selected ? theme.primarySoft : theme.surfaceAlt,
                borderColor: selected ? theme.primary : theme.line,
              },
              pressed && !disabled && { opacity: 0.7 },
            ]}>
            <Text style={styles.emoji}>{emoji}</Text>
            {count > 0 ? (
              <Text
                variant="captionStrong"
                style={{ color: selected ? theme.primaryDeep : theme.textSoft }}>
                {count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  emoji: { fontSize: 15 },
});
