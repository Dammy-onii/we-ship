import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './ui/text';

/**
 * What a Spotlight shows before anything has been shared.
 *
 * Two parts, and both are deliberate:
 *
 * 1. A drawn landscape rather than an icon. An icon says "no data"; a picture
 *    says "this is where pictures go". It is composed from gradients and views
 *    rather than shipped as a bitmap, so it stays sharp at every density and
 *    adds nothing to the bundle.
 *
 * 2. A sample note card, ruled like the home-screen widget's paper. Half of
 *    what lands here is not a photo at all, and a lone photo frame implies the
 *    Spotlight only takes images. The card is labelled so it is never mistaken
 *    for a real post.
 */
export function EmptySpotlight({
  title,
  detail,
  sampleNote,
  sampleAuthor,
}: {
  title: string;
  detail: string;
  /** The words on the example card. Kept short — it is scenery, not reading. */
  sampleNote: string;
  sampleAuthor: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.root}>
      <View style={[styles.frame, { borderColor: theme.line }]}>
        <LinearGradient
          colors={[theme.sky, theme.surfaceAlt]}
          style={StyleSheet.absoluteFill}
        />
        {/* Sun, kept left of centre so the screen's floating controls, which
            sit top-right, never land on top of it. */}
        <View style={[styles.sun, { backgroundColor: theme.surface }]} />
        {/*
          Peaks are squares turned 45°, not rounded bands.
          A band with a large corner radius reads as a slab; a rotated square
          gives a real diagonal, and the frame's overflow clip hides the three
          corners that would otherwise show.
        */}
        <View style={[styles.peak, styles.peakFar, { backgroundColor: theme.partnerSoft }]} />
        <View style={[styles.peak, styles.peakMid, { backgroundColor: theme.partner }]} />
        <View style={[styles.peak, styles.peakNear, { backgroundColor: theme.primaryDeep }]} />
        {/* Ground, sitting in front of every peak. */}
        <View style={[styles.ground, { backgroundColor: theme.primaryDeep }]} />
      </View>

      <NoteCard note={sampleNote} author={sampleAuthor} />

      <View style={styles.copy}>
        <Text variant="bodyStrong" center>
          {title}
        </Text>
        <Text variant="caption" color="textFaint" center>
          {detail}
        </Text>
      </View>
    </View>
  );
}

/** Ruled paper, matching the note slide on the home-screen widget. */
function NoteCard({ note, author }: { note: string; author: string }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.note, { backgroundColor: theme.surface, borderColor: theme.line }]}
      // Scenery, not content: a screen reader announcing an example post as a
      // real one would be worse than it announcing nothing.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={styles.noteHead}>
        <Text variant="micro" color="textFaint">
          EXAMPLE
        </Text>
      </View>
      {/* The rules sit behind the words at the same rhythm as the line height. */}
      <View style={styles.noteBody}>
        {[0, 1, 2].map((line) => (
          <View
            key={line}
            style={[
              styles.rule,
              // One rule per line of text, sitting on the baseline rather than
              // through it — the same relationship the widget's paper has.
              { top: NOTE_LINE * (line + 1) - StyleSheet.hairlineWidth, backgroundColor: theme.line },
            ]}
          />
        ))}
        <Text variant="body" style={styles.noteText}>
          {note}
        </Text>
      </View>
      <Text variant="micro" color="textFaint">
        {author.toUpperCase()}
      </Text>
    </View>
  );
}

const NOTE_LINE = 24;

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg },
  frame: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 4 / 3,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sun: { position: 'absolute', top: '15%', left: '22%', width: 42, height: 42, borderRadius: 21, opacity: 0.92 },
  peak: { position: 'absolute', transform: [{ rotate: '45deg' }] },
  peakFar: { width: 150, height: 150, left: '6%', bottom: -66 },
  peakMid: { width: 190, height: 190, right: '2%', bottom: -92 },
  peakNear: { width: 140, height: 140, left: '34%', bottom: -70 },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '14%' },
  note: {
    width: '100%',
    maxWidth: 320,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  noteHead: { flexDirection: 'row', justifyContent: 'space-between' },
  noteBody: { minHeight: NOTE_LINE * 3 },
  rule: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  noteText: { lineHeight: NOTE_LINE },
  copy: { gap: 4, maxWidth: 340 },
});
