import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { showDialog } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/use-theme';
import { enterPlaybackMode, enterRecordingMode } from '@/lib/audio-mode';

const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
/** Poll fast enough that the meter reads as a live level rather than a ticker. */
const POLL_MS = 70;
const BAR_COUNT = 30;
const MIN_BAR = 0.12;

/**
 * Voice capture with a live waveform and a send control beside it.
 *
 * Replaces a static "Recording…" label that gave no sign the microphone was
 * actually picking anything up, and buried sending behind a separate button
 * further down the sheet. Owns the recorder outright so both composers get the
 * same behaviour instead of maintaining two copies of it.
 */
export function VoiceRecorder({
  onSend,
  sending = false,
  autoStartRequest,
  maxSeconds = 120,
}: {
  /** Return false when delivery failed so the take remains available to retry. */
  onSend: (uri: string, durationSeconds: number) => void | boolean | Promise<void | boolean>;
  sending?: boolean;
  /** A changing value auto-starts recording once, for the drawer's hold-to-record. */
  autoStartRequest?: string;
  maxSeconds?: number;
}) {
  const theme = useTheme();
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, POLL_MS);
  const [recordedUri, setRecordedUri] = useState<string>();
  const [recordedDuration, setRecordedDuration] = useState(0);
  const captureAutoStop = useRef(false);
  const autoStartHandled = useRef<string | undefined>(undefined);

  const pulse = useSharedValue(1);

  const recording = recorderState.isRecording;
  const elapsed = recording ? recorderState.durationMillis / 1000 : recordedDuration;

  useEffect(() => {
    if (recording) {
      pulse.value = withRepeat(
        withSequence(withTiming(0.25, { duration: 600 }), withTiming(1, { duration: 600 })),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(1, { duration: 150 });
    }
  }, [pulse, recording]);

  const reset = useCallback(() => {
    setRecordedUri(undefined);
    setRecordedDuration(0);
  }, []);

  const start = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      showDialog('Microphone permission needed', 'Allow microphone access to record a voice note.');
      return;
    }
    reset();
    await enterRecordingMode();
    await recorder.prepareToRecordAsync();
    captureAutoStop.current = true;
    recorder.record({ forDuration: maxSeconds });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [maxSeconds, recorder, reset]);

  useEffect(() => {
    if (!autoStartRequest || autoStartHandled.current === autoStartRequest) return;
    autoStartHandled.current = autoStartRequest;
    start().catch(() => {
      showDialog('Recording unavailable', 'The voice recorder could not start. Please tap the mic to try again.');
    });
  }, [autoStartRequest, start]);

  /** Stops and keeps the take. Returns it so "stop and send" is one gesture. */
  const stop = useCallback(async () => {
    const seconds = Math.max(1, Math.round(recorderState.durationMillis / 1000));
    captureAutoStop.current = false;
    try {
      await recorder.stop();
    } catch {
      // Already stopped by the duration cap — the URI below is still valid.
    }
    const uri = recorder.uri ?? undefined;
    setRecordedUri(uri);
    setRecordedDuration(seconds);
    await enterPlaybackMode();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return uri ? { uri, seconds } : undefined;
  }, [recorder, recorderState.durationMillis]);

  const discard = useCallback(async () => {
    captureAutoStop.current = false;
    if (recording) {
      try {
        await recorder.stop();
      } catch {
        // Clearing the state below is still the right outcome.
      }
    }
    reset();
    await enterPlaybackMode();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [recorder, recording, reset]);

  // The duration cap stops the recorder natively, with no call for us to await.
  useEffect(() => {
    if (recording || !captureAutoStop.current || !recorder.uri) return;
    captureAutoStop.current = false;
    setRecordedUri(recorder.uri);
    setRecordedDuration(Math.max(1, Math.round(recorderState.durationMillis / 1000) || maxSeconds));
    enterPlaybackMode().catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [maxSeconds, recorder.uri, recorderState.durationMillis, recording]);

  const send = async () => {
    if (sending) return;
    // Sending mid-recording stops first, so the user never has to stop and then
    // send as two separate deliberate steps.
    const captured = recording ? await stop() : recordedUri ? { uri: recordedUri, seconds: recordedDuration } : undefined;
    if (!captured) return;
    const sent = await onSend(captured.uri, captured.seconds);
    if (sent !== false) reset();
  };

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const idle = !recording && !recordedUri;

  return (
    <View style={[styles.root, { backgroundColor: theme.surfaceAlt }]}>
      {idle ? (
        <View style={styles.idle}>
          <Pressable
            onPress={start}
            accessibilityRole="button"
            accessibilityLabel="Start recording"
            style={({ pressed }) => [
              styles.record,
              { backgroundColor: theme.primary },
              pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
            ]}>
            <Ionicons name="mic" size={26} color={theme.onPrimary} />
          </Pressable>
          <Text variant="caption" color="textFaint">
            Tap to record · up to {Math.round(maxSeconds / 60)} minute
            {maxSeconds >= 120 ? 's' : ''}
          </Text>
        </View>
      ) : (
        <View style={styles.bar}>
          <Pressable
            onPress={discard}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Cancel recording' : 'Delete voice note'}
            style={({ pressed }) => [styles.circle, pressed && { opacity: 0.6 }]}>
            <Ionicons name="trash-outline" size={19} color={theme.textSoft} />
          </Pressable>

          {recording ? (
            <Animated.View style={[styles.dot, { backgroundColor: theme.bloom }, dotStyle]} />
          ) : (
            <PlaybackButton uri={recordedUri!} />
          )}

          <Text variant="captionStrong" style={styles.timer}>
            {formatDuration(elapsed)}
          </Text>

          <Waveform
            active={recording}
            metering={recorderState.metering}
            tick={recorderState.durationMillis}
          />

          {recording ? (
            <Pressable
              onPress={stop}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Stop recording"
              style={({ pressed }) => [styles.circle, pressed && { opacity: 0.6 }]}>
              <Ionicons name="stop" size={18} color={theme.textSoft} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={send}
            disabled={sending}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Send voice note"
            style={({ pressed }) => [
              styles.send,
              { backgroundColor: sending ? theme.surfaceSunk : theme.primary },
              pressed && { opacity: 0.85 },
            ]}>
            <Ionicons name="send" size={17} color={sending ? theme.textFaint : theme.onPrimary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Preview playback for a take that has been stopped but not sent. */
function PlaybackButton({ uri }: { uri: string }) {
  const theme = useTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  return (
    <Pressable
      onPress={() => {
        if (status.playing) {
          player.pause();
          return;
        }
        // Finished takes sit at the end, where play() would be a no-op.
        if (status.currentTime >= status.duration - 0.1) player.seekTo(0);
        player.play();
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={status.playing ? 'Pause' : 'Play voice note'}
      style={({ pressed }) => [styles.circle, pressed && { opacity: 0.6 }]}>
      <Ionicons name={status.playing ? 'pause' : 'play'} size={18} color={theme.primaryDeep} />
    </Pressable>
  );
}

/**
 * A scrolling microphone meter.
 *
 * Owns its own level history rather than taking it from the recorder: the
 * levels are written on every poll, and a value both written here and listed as
 * a dependency upstream is rejected by the compiler's immutability rule.
 */
function Waveform({
  active,
  metering,
  tick,
}: {
  active: boolean;
  metering?: number;
  /** Recording position; changes on every poll, including through silence. */
  tick: number;
}) {
  const levels = useSharedValue<number[]>(new Array(BAR_COUNT).fill(MIN_BAR));

  useEffect(() => {
    if (!active) {
      levels.value = new Array(BAR_COUNT).fill(MIN_BAR);
      return;
    }
    // dBFS: roughly -160 (silence) to 0 (clipping). Under -60 is room tone.
    const normalized =
      typeof metering === 'number' && Number.isFinite(metering)
        ? Math.max(0, Math.min(1, (metering + 60) / 60))
        : 0;
    // Newest level enters at the right, the way a recorder's meter scrolls.
    levels.value = [...levels.value.slice(1), MIN_BAR + normalized ** 0.7 * (1 - MIN_BAR)];
  }, [active, levels, metering, tick]);

  return (
    <View style={styles.wave}>
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <WaveBar key={index} levels={levels} index={index} active={active} />
      ))}
    </View>
  );
}

function WaveBar({
  levels,
  index,
  active,
}: {
  levels: { value: number[] };
  index: number;
  active: boolean;
}) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => ({
    height: withTiming(`${(levels.value[index] ?? MIN_BAR) * 100}%`, { duration: POLL_MS * 1.6 }),
  }));

  return (
    <Animated.View
      style={[styles.waveBar, { backgroundColor: active ? theme.primary : theme.textFaint }, style]}
    />
  );
}

function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: { borderRadius: Radius.inset, padding: Spacing.md, minHeight: 76, justifyContent: 'center' },
  idle: { alignItems: 'center', gap: Spacing.sm },
  record: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  circle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 12 },
  timer: { minWidth: 38, fontVariant: ['tabular-nums'] },
  wave: {
    flex: 1,
    minWidth: 0,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
  },
  waveBar: { flex: 1, minWidth: 2, borderRadius: 1.5 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
