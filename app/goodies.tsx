import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/ui/data-state';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { userFacingError } from '@/lib/user-facing-error';
import { useNativePickerAction } from '@/hooks/use-native-picker';
import { enterPlaybackMode, enterRecordingMode } from '@/lib/audio-mode';
import { useGoodies, useUser, YOU_ID } from '@/lib/store';
import type { Goodie, GoodieKind } from '@/lib/types';

const SEND_TYPES: { kind: GoodieKind; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { kind: 'photo', label: 'Photo', icon: 'image-outline' },
  { kind: 'video', label: 'Video', icon: 'videocam-outline' },
  { kind: 'voice', label: 'Voice', icon: 'mic-outline' },
  { kind: 'note', label: 'Note', icon: 'document-text-outline' },
  { kind: 'reminder', label: 'Reminder', icon: 'alarm-outline' },
];

const VOICE_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

export default function GoodiesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { composer, record } = useLocalSearchParams<{ composer?: string; record?: string }>();
  const { goodies } = useGoodies();

  return (
    <KeyboardAvoider
      style={[styles.screen, { backgroundColor: theme.bg }]}
      >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.intro}>
          <Text variant="micro" color="textFaint">TODAY</Text>
          <Text variant="display">Goodies for each other</Text>
          <Text variant="body" color="textSoft">
            Send a photo, video, voice note, note, or reminder. Goodies are private to the two of
            you — the Friends tab is where you post to everyone else.
          </Text>
        </View>

        <GoodieComposer
          initialKind={composer === 'voice' ? 'voice' : 'photo'}
          autoStartRequest={composer === 'voice' ? record : undefined}
        />

        <View style={styles.section}>
          <Text variant="micro" color="textFaint">YOUR DAY</Text>
          <Text variant="title">Recent Goodies</Text>
          <View style={[styles.feed, { borderTopColor: theme.line }]}>
            {!goodies.length ? (
              <DataState compact icon="gift-outline" title="Nothing sent today" detail="Your first photo, voice note, reminder, or message will appear here." />
            ) : goodies.map((goodie, index) => (
              <GoodieRow key={goodie.id} goodie={goodie} separated={index > 0} />
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoider>
  );
}

function GoodieComposer({
  initialKind,
  autoStartRequest,
}: {
  initialKind: GoodieKind;
  autoStartRequest?: string;
}) {
  const theme = useTheme();
  const { addGoodie } = useGoodies();
  const [kind, setKind] = useState<GoodieKind>(initialKind);
  const [text, setText] = useState('');
  const [mediaAsset, setMediaAsset] = useState<ImagePicker.ImagePickerAsset>();
  const [recordedUri, setRecordedUri] = useState<string>();
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [reminderAt, setReminderAt] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const captureAutoStop = useRef(false);
  const autoStartHandled = useRef<string | undefined>(undefined);
  const runPicker = useNativePickerAction();

  const selectKind = (next: GoodieKind) => {
    if (recorderState.isRecording) return;
    setKind(next);
    setMediaAsset(undefined);
    setRecordedUri(undefined);
    setRecordedDuration(0);
  };

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos permission needed', 'Allow photo access to choose something for your partner.');
      return;
    }
    const result = await runPicker(() =>
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === 'video' ? ['videos'] : ['images'],
        allowsEditing: false,
        quality: 0.9,
      }),
    );
    if (!result.canceled) setMediaAsset(result.assets[0]);
  };

  const startRecording = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone permission needed', 'Allow microphone access to record a voice note.');
      return;
    }
    setRecordedUri(undefined);
    setRecordedDuration(0);
    await enterRecordingMode();
    await recorder.prepareToRecordAsync();
    captureAutoStop.current = true;
    recorder.record({ forDuration: 120 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [recorder]);

  useEffect(() => {
    if (!autoStartRequest || autoStartHandled.current === autoStartRequest) return;
    autoStartHandled.current = autoStartRequest;
    startRecording().catch(() => {
      Alert.alert('Recording unavailable', 'The voice recorder could not start. Please tap the mic to try again.');
    });
  }, [autoStartRequest, startRecording]);

  /** Cancels an in-progress recording, or clears one already captured. */
  const discardRecording = async () => {
    captureAutoStop.current = false;
    if (recorderState.isRecording) {
      try {
        await recorder.stop();
      } catch {
        // Already stopped — clearing the state below is still correct.
      }
    }
    setRecordedUri(undefined);
    setRecordedDuration(0);
    await enterPlaybackMode();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const toggleRecording = async () => {
    if (!recorderState.isRecording) {
      await startRecording();
      return;
    }

    const duration = recorderState.durationMillis;
    captureAutoStop.current = false;
    await recorder.stop();
    setRecordedUri(recorder.uri ?? undefined);
    setRecordedDuration(Math.max(1, Math.round(duration / 1000)));
    await enterPlaybackMode();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  // A capped recording stops itself inside the native recorder. Preserve the
  // resulting URI when that state transition arrives instead of resetting the
  // composer to an empty recording.
  useEffect(() => {
    if (recorderState.isRecording || !captureAutoStop.current || !recorder.uri) return;
    captureAutoStop.current = false;
    setRecordedUri(recorder.uri);
    setRecordedDuration(Math.max(1, Math.round(recorderState.durationMillis / 1000) || 120));
    enterPlaybackMode().catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [recorder.uri, recorderState.durationMillis, recorderState.isRecording]);

  const canSend =
    (kind === 'voice' && Boolean(recordedUri)) ||
    ((kind === 'photo' || kind === 'video') && Boolean(mediaAsset)) ||
    ((kind === 'note' || kind === 'reminder') && Boolean(text.trim()));

  const send = async () => {
    if (!canSend || sending) return;
    setSending(true);
    setUploadProgress(0);
    try {
      await addGoodie({
        kind,
        text: text.trim() || undefined,
        uri: kind === 'voice' ? recordedUri : mediaAsset?.uri,
        durationSeconds: kind === 'voice' ? recordedDuration : undefined,
        fileName: mediaAsset?.fileName,
        mimeType: mediaAsset?.mimeType,
        sizeBytes: mediaAsset?.fileSize,
        width: mediaAsset?.width,
        height: mediaAsset?.height,
        reminderAt: kind === 'reminder' ? reminderAt.toISOString() : undefined,
        onProgress: setUploadProgress,
      });
      setText('');
      setMediaAsset(undefined);
      setRecordedUri(undefined);
      setRecordedDuration(0);
      Keyboard.dismiss();
    } catch (error) {
      Alert.alert('Could not send Goodie', userFacingError(error, 'Please try again.'));
    } finally {
      setSending(false);
      setUploadProgress(0);
    }
  };

  return (
    <View style={styles.composer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeRow}>
        {SEND_TYPES.map((item) => {
          const selected = kind === item.kind;
          return (
            <Pressable
              key={item.kind}
              onPress={() => selectKind(item.kind)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.typeButton,
                {
                  backgroundColor: selected ? theme.primarySoft : theme.surface,
                  borderColor: selected ? theme.primary : theme.line,
                },
              ]}>
              <Ionicons name={item.icon} size={17} color={selected ? theme.primaryDeep : theme.textSoft} />
              <Text variant="captionStrong" color={selected ? 'primaryDeep' : 'textSoft'}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {kind === 'photo' || kind === 'video' ? (
        <Pressable
          onPress={pickMedia}
          style={[styles.mediaPicker, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}>
          {mediaAsset?.uri && kind === 'photo' ? (
            <Image source={{ uri: mediaAsset.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <>
              <Ionicons name={kind === 'video' ? 'videocam-outline' : 'images-outline'} size={30} color={theme.primary} />
              <Text variant="bodyStrong">{mediaAsset ? 'Video selected' : `Choose a ${kind}`}</Text>
              <Text variant="caption" color="textFaint">Original → your Drive · small preview → Weship</Text>
            </>
          )}
        </Pressable>
      ) : null}

      {kind === 'voice' ? (
        <View style={[styles.voiceComposer, { backgroundColor: theme.surfaceAlt }]}>
          {/* Status first, then the waveform, then controls — the old row put
              the button, meter and text side by side and read as clutter. */}
          <View style={styles.voiceStatus}>
            <Text variant="bodyStrong">
              {recorderState.isRecording
                ? 'Recording…'
                : recordedUri
                  ? 'Ready to send'
                  : 'Record a voice note'}
            </Text>
            <Text variant="micro" color="textFaint">
              {formatDuration(
                recorderState.isRecording ? recorderState.durationMillis / 1000 : recordedDuration,
              )}
              {recorderState.isRecording ? ' · MAX 2:00' : recordedUri ? '' : ' · UP TO 2 MINUTES'}
            </Text>
          </View>

          <RecordingWaveform active={recorderState.isRecording} metering={recorderState.metering} />

          <View style={styles.voiceControls}>
            {/* Discard is always reachable once there is something to lose. */}
            {recorderState.isRecording || recordedUri ? (
              <Pressable
                onPress={discardRecording}
                accessibilityRole="button"
                accessibilityLabel={recorderState.isRecording ? 'Cancel recording' : 'Delete voice note'}
                style={({ pressed }) => [
                  styles.voiceSecondary,
                  { borderColor: theme.line },
                  pressed && { opacity: 0.6 },
                ]}>
                <Ionicons name="close" size={20} color={theme.textSoft} />
              </Pressable>
            ) : (
              <View style={styles.voiceSecondarySpacer} />
            )}

            <Pressable
              onPress={toggleRecording}
              accessibilityRole="button"
              accessibilityLabel={recorderState.isRecording ? 'Stop recording' : 'Start recording'}
              style={[
                styles.recordButton,
                { backgroundColor: recorderState.isRecording ? theme.bloom : theme.primary },
              ]}>
              <Ionicons
                name={recorderState.isRecording ? 'stop' : 'mic'}
                size={28}
                color={theme.onPrimary}
              />
            </Pressable>

            {recordedUri && !recorderState.isRecording ? (
              <VoiceButton uri={recordedUri} />
            ) : (
              <View style={styles.voiceSecondarySpacer} />
            )}
          </View>
        </View>
      ) : null}

      {kind !== 'voice' ? (
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={240}
          autoCapitalize="sentences"
          autoCorrect
          placeholder={kind === 'reminder' ? 'What should your partner remember?' : 'Add a little message…'}
          placeholderTextColor={theme.textFaint}
          selectionColor={theme.primary}
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.surface, borderColor: theme.line },
          ]}
        />
      ) : null}

      {kind === 'reminder' ? (
        <>
          <Pressable
            onPress={() => setShowReminderPicker(true)}
            style={[styles.reminderTime, { backgroundColor: theme.surfaceAlt }]}
            accessibilityRole="button"
            accessibilityLabel="Choose reminder time">
            <Ionicons name="time-outline" size={19} color={theme.primaryDeep} />
            <Text variant="bodyStrong">{reminderAt.toLocaleString()}</Text>
          </Pressable>
          {showReminderPicker ? (
            <DateTimePicker
              value={reminderAt}
              mode="datetime"
              minimumDate={new Date()}
              onChange={(_, next) => {
                if (Platform.OS === 'android') setShowReminderPicker(false);
                if (next) setReminderAt(next);
              }}
            />
          ) : null}
        </>
      ) : null}

      <Button
        label={sending ? `Uploading ${Math.round(uploadProgress * 100)}%` : 'Send to today'}
        icon={<Ionicons name="send" size={17} color={theme.onPrimary} />}
        onPress={send}
        disabled={!canSend || sending}
        full
      />
    </View>
  );
}

function GoodieRow({ goodie, separated }: { goodie: Goodie; separated: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const author = useUser(goodie.authorId);
  const mine = goodie.authorId === YOU_ID;
  const type = SEND_TYPES.find((item) => item.kind === goodie.kind)!;

  const isDriveMedia = (goodie.kind === 'photo' || goodie.kind === 'video') && goodie.originalAvailable;
  const content = (
    <View style={[styles.goodieRow, separated && { borderTopColor: theme.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
      {goodie.kind === 'photo' || goodie.kind === 'video' ? (
        goodie.uri ? (
          <View style={styles.goodieMedia}>
            <Image source={{ uri: goodie.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {goodie.kind === 'video' ? (
              <View style={styles.mediaPlay}><Ionicons name="play" size={13} color="#FFFCF7" /></View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.goodieMedia, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="image-outline" size={24} color={theme.primaryDeep} />
          </View>
        )
      ) : goodie.kind === 'voice' ? (
        <VoiceButton uri={goodie.uri} />
      ) : (
        <View style={[styles.goodieIcon, { backgroundColor: theme.surfaceAlt }]}>
          <Ionicons name={type.icon} size={20} color={theme.textSoft} />
        </View>
      )}
      <View style={styles.goodieCopy}>
        <Text variant="bodyStrong">{goodie.text || type.label}</Text>
        <Text variant="caption" color="textFaint">
          {mine ? 'You' : author.displayName} · {type.label}
          {goodie.durationSeconds ? ` · ${formatDuration(goodie.durationSeconds)}` : ''}
          {goodie.reminderAt ? ` · ${new Date(goodie.reminderAt).toLocaleString()}` : ''}
        </Text>
      </View>
      <Avatar name={author.displayName} seed={author.photoSeed} uri={author.photoUri} ring={author.color} size={30} />
    </View>
  );
  if (!isDriveMedia) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${goodie.kind} Goodie`}
      onPress={() => router.push({
        pathname: '/media',
        params: {
          target: 'goodie',
          id: goodie.id,
          type: goodie.kind,
          caption: goodie.text ?? '',
          canDelete: mine ? '1' : '0',
        },
      } as unknown as Href)}>
      {content}
    </Pressable>
  );
}

function VoiceButton({ uri }: { uri?: string }) {
  const theme = useTheme();
  const player = useAudioPlayer(uri ?? null);
  const status = useAudioPlayerStatus(player);

  return (
    <Pressable
      disabled={!uri}
      accessibilityRole="button"
      accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}
      onPress={async () => {
        if (!uri) return;
        try {
          await enterPlaybackMode();
          if (status.playing) {
            player.pause();
            return;
          }
          if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) {
            await player.seekTo(0);
          }
          player.play();
        } catch {
          Alert.alert('Playback unavailable', 'This voice note could not be played on this device.');
        }
      }}
      style={[styles.goodieIcon, { backgroundColor: theme.partnerSoft, opacity: uri ? 1 : 0.75 }]}>
      <Ionicons
        name={!uri ? 'mic-outline' : status.playing ? 'pause' : 'play'}
        size={20}
        color={theme.partner}
      />
    </Pressable>
  );
}

function RecordingWaveform({ active, metering }: { active: boolean; metering?: number }) {
  const level = active
    ? Math.max(0.08, Math.min(1, ((metering ?? -54) + 60) / 60))
    : 0.08;

  return (
    <View style={styles.waveform} accessibilityElementsHidden>
      {[0.55, 0.85, 1, 0.72, 0.95].map((weight, index) => (
        <MeterBar key={index} level={level * weight} active={active} />
      ))}
    </View>
  );
}

function MeterBar({ level, active }: { level: number; active: boolean }) {
  const theme = useTheme();
  const animatedStyle = useAnimatedStyle(
    () => ({ height: withTiming(6 + level * 27, { duration: 90 }) }),
    [level],
  );

  return (
    <Animated.View
      style={[
        styles.meterBar,
        { backgroundColor: active ? theme.bloom : theme.lineStrong },
        animatedStyle,
      ]}
    />
  );
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  intro: { gap: Spacing.sm, paddingTop: Spacing.sm },
  section: { gap: Spacing.sm },
  composer: { gap: Spacing.md },
  typeRow: { gap: Spacing.sm },
  typeButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
  },
  mediaPicker: {
    height: 180,
    borderRadius: Radius.tile,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  input: {
    minHeight: 112,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.inset,
    padding: Spacing.base,
    fontFamily: Font.sans,
    fontSize: 16,
    lineHeight: 23,
    textAlignVertical: 'top',
  },
  reminderTime: {
    minHeight: 52,
    borderRadius: Radius.inset,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  voiceStatus: { alignItems: 'center', gap: 3 },
  voiceControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  voiceSecondary: { width: 46, height: 46, borderRadius: 23, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  voiceSecondarySpacer: { width: 46, height: 46 },
  voiceComposer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  recordingControl: { alignItems: 'center', gap: Spacing.sm },
  recordButton: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  waveform: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 3 },
  meterBar: { width: 3, borderRadius: 2 },
  voiceCopy: { flex: 1, gap: 4 },
  feed: { borderTopWidth: StyleSheet.hairlineWidth },
  goodieRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  goodieMedia: { width: 58, height: 58, borderRadius: Radius.chip, alignItems: 'center', justifyContent: 'center' },
  mediaPlay: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,20,20,0.58)' },
  goodieIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  goodieCopy: { flex: 1, gap: 4 },
});
