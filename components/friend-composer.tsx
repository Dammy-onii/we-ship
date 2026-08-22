import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { useNativePickerAction } from '@/hooks/use-native-picker';
import { useTheme } from '@/hooks/use-theme';
import { userFacingError } from '@/lib/user-facing-error';
import { enterPlaybackMode, enterRecordingMode } from '@/lib/audio-mode';
import { useFriends } from '@/lib/friends';
import type { FriendPostKind } from '@/lib/types';

const KINDS: {
  kind: FriendPostKind;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { kind: 'note', label: 'Note', icon: 'document-text-outline' },
  { kind: 'photo', label: 'Photo', icon: 'image-outline' },
  { kind: 'video', label: 'Video', icon: 'videocam-outline' },
  { kind: 'voice', label: 'Voice', icon: 'mic-outline' },
];

const VOICE_RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/**
 * The friend-board composer.
 *
 * Deliberately a `Modal` rather than a route: posting is a quick interruption
 * of browsing the board, and returning should not lose the grid's scroll
 * position. Separate from the Goodies composer because the destinations differ
 * — Goodies are for the partner only, this posts to every friend.
 */
export function FriendComposer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { post } = useFriends();
  const [kind, setKind] = useState<FriendPostKind>('note');
  const [text, setText] = useState('');
  const [mediaAsset, setMediaAsset] = useState<ImagePicker.ImagePickerAsset>();
  const [recordedUri, setRecordedUri] = useState<string>();
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [sending, setSending] = useState(false);
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const captureAutoStop = useRef(false);
  const runPicker = useNativePickerAction();

  const reset = () => {
    setKind('note');
    setText('');
    setMediaAsset(undefined);
    setRecordedUri(undefined);
    setRecordedDuration(0);
  };

  const close = () => {
    if (sending) return;
    reset();
    onClose();
  };

  const selectKind = (next: FriendPostKind) => {
    if (recorderState.isRecording) return;
    setKind(next);
    setMediaAsset(undefined);
    setRecordedUri(undefined);
    setRecordedDuration(0);
  };

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos permission needed', 'Allow photo access to choose something to post.');
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

  const toggleRecording = async () => {
    if (!recorderState.isRecording) {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone permission needed', 'Allow microphone access to record a memo.');
        return;
      }
      setRecordedUri(undefined);
      setRecordedDuration(0);
      await enterRecordingMode();
      await recorder.prepareToRecordAsync();
      captureAutoStop.current = true;
      recorder.record({ forDuration: 120 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
  };

  // `record({ forDuration })` stops natively at the cap. Capture the resulting
  // URI from the recorder state transition just as we do for a manual stop.
  useEffect(() => {
    if (recorderState.isRecording || !captureAutoStop.current || !recorder.uri) return;
    captureAutoStop.current = false;
    setRecordedUri(recorder.uri);
    setRecordedDuration(Math.max(1, Math.round(recorderState.durationMillis / 1000) || 120));
    enterPlaybackMode().catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [recorder.uri, recorderState.durationMillis, recorderState.isRecording]);

  const canSend =
    (kind === 'note' && Boolean(text.trim())) ||
    (kind === 'voice' && Boolean(recordedUri)) ||
    ((kind === 'photo' || kind === 'video') && Boolean(mediaAsset));

  const send = async () => {
    if (!canSend || sending) return;
    setSending(true);
    try {
      await post({
        kind,
        text: text.trim() || undefined,
        uri: kind === 'voice' ? recordedUri : mediaAsset?.uri,
        durationSeconds: kind === 'voice' ? recordedDuration : undefined,
        fileName: mediaAsset?.fileName,
        mimeType: mediaAsset?.mimeType,
        sizeBytes: mediaAsset?.fileSize,
        width: mediaAsset?.width,
        height: mediaAsset?.height,
      });
      reset();
      onClose();
    } catch (error) {
      Alert.alert('Could not post', userFacingError(error, 'Please try again.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close composer" />
        <KeyboardAvoider
          style={styles.avoider}>
          <ScrollView
            style={[styles.sheet, { backgroundColor: theme.bg }]}
            contentContainerStyle={[
              styles.sheetContent,
              { paddingBottom: insets.bottom + Spacing.lg },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets
            bounces={false}>
            <View style={[styles.grabber, { backgroundColor: theme.line }]} />

            <View style={styles.head}>
              <Text variant="title">Post to friends</Text>
              <Pressable onPress={close} hitSlop={12} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={theme.textSoft} />
              </Pressable>
            </View>
            <Text variant="caption" color="textFaint">
              Everyone you are connected to will see this. Your partner’s Goodies stay private.
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.kindRow}>
              {KINDS.map((item) => {
                const selected = kind === item.kind;
                return (
                  <Pressable
                    key={item.kind}
                    onPress={() => selectKind(item.kind)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      styles.kindButton,
                      {
                        backgroundColor: selected ? theme.primarySoft : theme.surface,
                        borderColor: selected ? theme.primary : theme.line,
                      },
                    ]}>
                    <Ionicons
                      name={item.icon}
                      size={17}
                      color={selected ? theme.primaryDeep : theme.textSoft}
                    />
                    <Text variant="captionStrong" color={selected ? 'primaryDeep' : 'textSoft'}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {kind === 'photo' || kind === 'video' ? (
              <Pressable
                onPress={pickMedia}
                style={[styles.picker, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}>
                {mediaAsset?.uri && kind === 'photo' ? (
                  <Image source={{ uri: mediaAsset.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <>
                    <Ionicons
                      name={kind === 'video' ? 'videocam-outline' : 'images-outline'}
                      size={28}
                      color={theme.primary}
                    />
                    <Text variant="bodyStrong">
                      {mediaAsset ? 'Video selected' : `Choose a ${kind}`}
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null}

            {kind === 'voice' ? (
              <View style={[styles.voice, { backgroundColor: theme.surfaceAlt }]}>
                <View style={styles.voiceStatus}>
                  <Text variant="bodyStrong">
                    {recorderState.isRecording
                      ? 'Recording…'
                      : recordedUri
                        ? 'Ready to post'
                        : 'Record a voice memo'}
                  </Text>
                  <Text variant="micro" color="textFaint">
                    {formatDuration(
                      recorderState.isRecording
                        ? recorderState.durationMillis / 1000
                        : recordedDuration,
                    )}
                    {recorderState.isRecording ? ' · MAX 2:00' : recordedUri ? '' : ' · UP TO 2 MINUTES'}
                  </Text>
                </View>
                <View style={styles.voiceControls}>
                  {recorderState.isRecording || recordedUri ? (
                    <Pressable
                      onPress={discardRecording}
                      accessibilityRole="button"
                      accessibilityLabel={
                        recorderState.isRecording ? 'Cancel recording' : 'Delete voice memo'
                      }
                      style={({ pressed }) => [
                        styles.voiceSecondary,
                        { borderColor: theme.line },
                        pressed && { opacity: 0.6 },
                      ]}>
                      <Ionicons name="close" size={20} color={theme.textSoft} />
                    </Pressable>
                  ) : (
                    <View style={styles.voiceSpacer} />
                  )}
                  <Pressable
                    onPress={toggleRecording}
                    accessibilityRole="button"
                    accessibilityLabel={
                      recorderState.isRecording ? 'Stop recording' : 'Start recording'
                    }
                    style={[
                      styles.recordButton,
                      { backgroundColor: recorderState.isRecording ? theme.bloom : theme.primary },
                    ]}>
                    <Ionicons
                      name={recorderState.isRecording ? 'stop' : 'mic'}
                      size={26}
                      color={theme.onPrimary}
                    />
                  </Pressable>
                  <View style={styles.voiceSpacer} />
                </View>
              </View>
            ) : null}

            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={kind === 'note' ? 'Write a note…' : 'Add a caption (optional)'}
              placeholderTextColor={theme.textFaint}
              selectionColor={theme.primary}
              multiline
              style={[
                styles.input,
                kind === 'note' && styles.inputTall,
                { color: theme.text, backgroundColor: theme.surface, borderColor: theme.line },
              ]}
            />

            <Button
              full
              label={sending ? 'Posting…' : 'Post to friends'}
              icon={<Ionicons name="send" size={17} color={theme.onPrimary} />}
              onPress={send}
              disabled={!canSend || sending}
            />
          </ScrollView>
        </KeyboardAvoider>
      </View>
    </Modal>
  );
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18,17,16,0.42)' },
  avoider: { maxHeight: '92%' },
  sheet: {
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
  },
  sheetContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  grabber: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kindRow: { gap: Spacing.sm, paddingRight: Spacing.lg },
  kindButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  picker: {
    height: 168,
    borderRadius: Radius.inset,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    overflow: 'hidden',
  },
  voice: { padding: Spacing.md, borderRadius: Radius.inset, gap: Spacing.md },
  voiceStatus: { gap: 3 },
  voiceControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  voiceSecondary: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceSpacer: { width: 44 },
  recordButton: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  input: {
    minHeight: 52,
    maxHeight: 160,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.inset,
    paddingHorizontal: Spacing.md,
    paddingTop: 15,
    paddingBottom: 15,
    fontFamily: Font.sans,
    fontSize: 16,
  },
  inputTall: { minHeight: 120 },
});
