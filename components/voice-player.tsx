import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { showDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { enterPlaybackMode } from '@/lib/audio-mode';

/** Bars drawn across the track. Enough to read as a waveform at any width. */
const BAR_COUNT = 34;

/**
 * A voice note with its playback state visible.
 *
 * Playing one used to change nothing except a play glyph turning into a pause
 * glyph — no position, no length, and no sign it was actually running. The bars
 * fill from the left as it plays, so the note behaves like every other voice
 * message the user has seen.
 */
export function VoicePlayer({
  uri,
  seconds,
  tone = 'surface',
}: {
  uri?: string;
  /** Recorded length, used before the file reports its own duration. */
  seconds?: number;
  /** `photo` sits over imagery and uses light-on-dark colours. */
  tone?: 'surface' | 'photo';
}) {
  const theme = useTheme();
  const player = useAudioPlayer(uri ?? null);
  const status = useAudioPlayerStatus(player);

  const duration = status.duration > 0 ? status.duration : (seconds ?? 0);
  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0;

  // A fixed, seeded shape rather than real amplitudes: the file is remote and
  // decoding it just to draw a picture of it would cost more than it is worth.
  const shape = useMemo(() => barShape(uri ?? ''), [uri]);

  const onPhoto = tone === 'photo';
  const accent = onPhoto ? '#FCFAF7' : theme.partner;
  const idle = onPhoto ? 'rgba(252,250,247,0.32)' : theme.lineStrong;

  const toggle = async () => {
    if (!uri) return;
    try {
      await enterPlaybackMode();
      if (status.playing) {
        player.pause();
        return;
      }
      // Restarting from the end, rather than sitting silently at it.
      if (status.didJustFinish || (duration > 0 && status.currentTime >= duration - 0.05)) {
        await player.seekTo(0);
      }
      player.play();
    } catch {
      showDialog('Playback unavailable', 'This voice note could not be played on this device.');
    }
  };

  return (
    <View style={styles.row}>
      <Pressable
        disabled={!uri}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}
        onPress={toggle}
        style={[
          styles.button,
          {
            backgroundColor: onPhoto ? 'rgba(252,250,247,0.16)' : theme.partnerSoft,
            opacity: uri ? 1 : 0.6,
          },
        ]}>
        <Ionicons
          name={!uri ? 'mic-outline' : status.playing ? 'pause' : 'play'}
          size={20}
          color={accent}
        />
      </Pressable>

      <View style={styles.wave}>
        {shape.map((height, index) => (
          <Bar
            key={index}
            height={height}
            // Bars left of the playhead are filled; the rest stay muted.
            filled={index / BAR_COUNT <= progress}
            playing={status.playing}
            accent={accent}
            idle={idle}
          />
        ))}
      </View>

      <Text variant="micro" color={onPhoto ? undefined : 'textFaint'} onPhoto={onPhoto}>
        {formatDuration(status.playing || status.currentTime > 0 ? status.currentTime : duration)}
      </Text>
    </View>
  );
}

function Bar({
  height,
  filled,
  playing,
  accent,
  idle,
}: {
  height: number;
  filled: boolean;
  playing: boolean;
  accent: string;
  idle: string;
}) {
  const style = useAnimatedStyle(() => ({
    backgroundColor: withTiming(filled ? accent : idle, { duration: 160 }),
    // A gentle lift on the filled side so a playing note is legible in motion,
    // not only by colour.
    height: withTiming(`${(filled && playing ? Math.min(1, height * 1.25) : height) * 100}%`, {
      duration: 180,
    }),
  }));
  return <Animated.View style={[styles.bar, style]} />;
}

/**
 * Deterministic bar heights for a URI.
 *
 * Seeded so the same note always draws the same shape — a waveform that
 * reshuffled on every render would read as noise rather than as the recording.
 */
function barShape(seed: string): number[] {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Array.from({ length: BAR_COUNT }, (_, index) => {
    hash = Math.imul(hash ^ (index + 1), 16777619);
    const unit = ((hash >>> 8) % 1000) / 1000;
    // Tapered at both ends, the way a spoken clip starts and stops quietly.
    const taper = Math.sin((Math.PI * (index + 0.5)) / BAR_COUNT);
    return 0.24 + unit * 0.62 * (0.45 + 0.55 * taper);
  });
}

function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  button: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  wave: { flex: 1, height: 30, flexDirection: 'row', alignItems: 'center', gap: 2 },
  bar: { flex: 1, minWidth: 2, borderRadius: Radius.pill },
});
