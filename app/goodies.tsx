import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { VoiceRecorder } from '@/components/voice-recorder';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/ui/data-state';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { VoicePlayer } from '@/components/voice-player';
import { showDialog } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/use-theme';
import { userFacingError } from '@/lib/user-facing-error';
import { useNativePickerAction } from '@/hooks/use-native-picker';
import { useGoodies, useUser, YOU_ID } from '@/lib/store';
import type { Goodie, GoodieKind } from '@/lib/types';

const SEND_TYPES: { kind: GoodieKind; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { kind: 'photo', label: 'Photo', icon: 'image-outline' },
  { kind: 'video', label: 'Video', icon: 'videocam-outline' },
  { kind: 'voice', label: 'Voice', icon: 'mic-outline' },
  { kind: 'note', label: 'Note', icon: 'document-text-outline' },
  { kind: 'reminder', label: 'Reminder', icon: 'alarm-outline' },
];

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
          // Every kind the Quick send widget can deep-link to, not just voice —
          // an unrecognised value used to land silently on the photo composer.
          initialKind={
            SEND_TYPES.some((type) => type.kind === composer)
              ? (composer as GoodieKind)
              : 'photo'
          }
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
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [reminderAt, setReminderAt] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const runPicker = useNativePickerAction();

  const selectKind = (next: GoodieKind) => {
    setKind(next);
    setMediaAsset(undefined);
  };

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showDialog('Photos permission needed', 'Allow photo access to choose something for your partner.');
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

  const canSend =
    ((kind === 'photo' || kind === 'video') && Boolean(mediaAsset)) ||
    ((kind === 'note' || kind === 'reminder') && Boolean(text.trim()));

  /** Voice notes are sent from the recorder itself, so they carry their own take. */
  const send = async (voice?: { uri: string; durationSeconds: number }) => {
    if ((!canSend && !voice) || sending) return;
    setSending(true);
    setUploadProgress(0);
    try {
      await addGoodie({
        kind,
        text: text.trim() || undefined,
        uri: voice ? voice.uri : mediaAsset?.uri,
        durationSeconds: voice?.durationSeconds,
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
      Keyboard.dismiss();
    } catch (error) {
      showDialog('Could not send Goodie', userFacingError(error, 'Please try again.'));
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
        <VoiceRecorder
          sending={sending}
          autoStartRequest={autoStartRequest}
          onSend={(uri, durationSeconds) => send({ uri, durationSeconds })}
        />
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

      {kind === 'voice' ? null : (
        <Button
          loading={sending}
          label={sending ? `Uploading ${Math.round(uploadProgress * 100)}%` : 'Send to today'}
          icon={<Ionicons name="send" size={17} color={theme.onPrimary} />}
          onPress={() => send()}
          disabled={!canSend || sending}
          full
        />
      )}
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
  const meta = (
    <Text variant="caption" color="textFaint">
      {mine ? 'You' : author.displayName} · {type.label}
      {goodie.reminderAt ? ` · ${new Date(goodie.reminderAt).toLocaleString()}` : ''}
    </Text>
  );

  // Voice takes the full width of the row: a waveform squeezed beside a caption
  // and an avatar is too small to read a playhead in.
  if (goodie.kind === 'voice') {
    return (
      <View
        style={[
          styles.voiceRow,
          separated && { borderTopColor: theme.line, borderTopWidth: StyleSheet.hairlineWidth },
        ]}>
        <View style={styles.voiceHead}>
          <Avatar name={author.displayName} seed={author.photoSeed} uri={author.photoUri} ring={author.color} size={30} />
          <View style={{ flex: 1 }}>
            {goodie.text ? <Text variant="bodyStrong">{goodie.text}</Text> : null}
            {meta}
          </View>
        </View>
        <VoicePlayer uri={goodie.uri} seconds={goodie.durationSeconds} />
      </View>
    );
  }

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
      ) : (
        <View style={[styles.goodieIcon, { backgroundColor: theme.surfaceAlt }]}>
          <Ionicons name={type.icon} size={20} color={theme.textSoft} />
        </View>
      )}
      <View style={styles.goodieCopy}>
        <Text variant="bodyStrong">{goodie.text || type.label}</Text>
        {meta}
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
  voiceRow: { paddingVertical: Spacing.md, gap: Spacing.sm },
  voiceHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  goodieRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  goodieMedia: { width: 58, height: 58, borderRadius: Radius.chip, alignItems: 'center', justifyContent: 'center' },
  mediaPlay: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,20,20,0.58)' },
  goodieIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  goodieCopy: { flex: 1, gap: 4 },
});
