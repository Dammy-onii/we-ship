import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
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
import { VoiceRecorder } from '@/components/voice-recorder';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { showDialog } from '@/components/ui/dialog';
import { useNativePickerAction } from '@/hooks/use-native-picker';
import { useTheme } from '@/hooks/use-theme';
import { userFacingError } from '@/lib/user-facing-error';
import { useFriends } from '@/lib/friends';
import { useGoogleConnection } from '@/lib/use-google-connection';
import type { FriendPostKind } from '@/lib/types';

/**
 * How many photos one post may carry.
 *
 * Without Drive the originals have nowhere of the user's own to live, so the
 * app is the one absorbing the storage — hence the tighter cap, and a prompt
 * explaining what lifts it rather than a bare refusal.
 */
const MAX_PHOTOS_WITHOUT_DRIVE = 2;
const MAX_PHOTOS_WITH_DRIVE = 10;

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
  const router = useRouter();
  const { post } = useFriends();
  const [kind, setKind] = useState<FriendPostKind>('note');
  const [text, setText] = useState('');
  const [mediaAssets, setMediaAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [sending, setSending] = useState(false);
  const runPicker = useNativePickerAction();
  const { driveConnected } = useGoogleConnection();

  // Until the grant is known, assume the generous limit: tightening it on a
  // slow network read would be a worse surprise than briefly allowing more.
  const photoLimit =
    driveConnected === false ? MAX_PHOTOS_WITHOUT_DRIVE : MAX_PHOTOS_WITH_DRIVE;

  const reset = () => {
    setKind('note');
    setText('');
    setMediaAssets([]);
  };

  const close = () => {
    if (sending) return;
    reset();
    onClose();
  };

  const selectKind = (next: FriendPostKind) => {
    setKind(next);
    setMediaAssets([]);
  };

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showDialog('Photos permission needed', 'Allow photo access to choose something to post.');
      return;
    }
    const result = await runPicker(() =>
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === 'video' ? ['videos'] : ['images'],
        allowsEditing: false,
        quality: 0.9,
        // Videos stay one at a time: they are large enough that batching them
        // is a slow upload with no obvious progress.
        allowsMultipleSelection: kind === 'photo',
        selectionLimit: kind === 'photo' ? photoLimit : 1,
      }),
    );
    if (result.canceled) return;
    // `selectionLimit` is advisory on some Android pickers, so the cap is
    // applied again here rather than trusted.
    const chosen = result.assets.slice(0, kind === 'photo' ? photoLimit : 1);
    setMediaAssets(chosen);
    if (kind === 'photo' && result.assets.length > chosen.length) {
      showDialog(
        'Two photos at a time',
        'Connect Google Drive in Connections to share up to ten at once. Your originals stay in your own Drive.',
      );
    }
  };

  const canSend =
    (kind === 'note' && Boolean(text.trim())) ||
    ((kind === 'photo' || kind === 'video') && mediaAssets.length > 0);

  /** Voice posts are sent from the recorder itself, so they carry their own take. */
  const send = async (voice?: { uri: string; durationSeconds: number }) => {
    if ((!canSend && !voice) || sending) return;
    setSending(true);
    try {
      if (voice || !mediaAssets.length) {
        await post({ kind, text: text.trim() || undefined, uri: voice?.uri, durationSeconds: voice?.durationSeconds });
      } else {
        // One row per photo: `friend_posts` carries a single media reference,
        // and a batch is just several of them. Sequential rather than parallel
        // so a slow connection uploads one at a time instead of stalling on all.
        for (const [index, asset] of mediaAssets.entries()) {
          await post({
            kind,
            // The caption belongs to the batch, so only the first carries it.
            text: index === 0 ? text.trim() || undefined : undefined,
            uri: asset.uri,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            sizeBytes: asset.fileSize,
            width: asset.width,
            height: asset.height,
          });
        }
      }
      reset();
      onClose();
    } catch (error) {
      showDialog('Could not post', userFacingError(error, 'Please try again.'));
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
              Everyone you are connected to will see this. It never reaches your shared space.
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
              <>
                <Pressable
                  onPress={pickMedia}
                  style={[styles.picker, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}>
                  {mediaAssets.length && kind === 'photo' ? (
                    <View style={styles.thumbRow}>
                      {mediaAssets.map((asset) => (
                        <Image
                          key={asset.assetId ?? asset.uri}
                          source={{ uri: asset.uri }}
                          style={styles.thumb}
                          contentFit="cover"
                        />
                      ))}
                    </View>
                  ) : (
                    <>
                      <Ionicons
                        name={kind === 'video' ? 'videocam-outline' : 'images-outline'}
                        size={28}
                        color={theme.primary}
                      />
                      <Text variant="bodyStrong">
                        {mediaAssets.length
                          ? 'Video selected'
                          : kind === 'photo'
                            ? `Choose up to ${photoLimit} photos`
                            : 'Choose a video'}
                      </Text>
                    </>
                  )}
                </Pressable>

                {/* Says what lifts the limit, rather than only that there is one. */}
                {kind === 'photo' && driveConnected === false ? (
                  <Pressable
                    onPress={() => {
                      close();
                      router.push('/connections');
                    }}
                    style={({ pressed }) => [
                      styles.driveNudge,
                      { backgroundColor: theme.primarySoft },
                      pressed && { opacity: 0.75 },
                    ]}>
                    <Ionicons name="cloud-upload-outline" size={17} color={theme.primaryDeep} />
                    <Text variant="caption" color="primaryDeep" style={{ flex: 1 }}>
                      Two photos at a time. Connect Google Drive to share up to{' '}
                      {MAX_PHOTOS_WITH_DRIVE} — originals stay in your own Drive.
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={theme.primaryDeep} />
                  </Pressable>
                ) : null}
              </>
            ) : null}

            {kind === 'voice' ? (
              <VoiceRecorder
                sending={sending}
                onSend={(uri, durationSeconds) => send({ uri, durationSeconds })}
              />
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

            {kind === 'voice' ? null : (
              <Button
                full
                loading={sending}
                label={sending ? 'Posting…' : 'Post to friends'}
                icon={<Ionicons name="send" size={17} color={theme.onPrimary} />}
                onPress={() => send()}
                disabled={!canSend || sending}
              />
            )}
          </ScrollView>
        </KeyboardAvoider>
      </View>
    </Modal>
  );
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
  thumbRow: { ...StyleSheet.absoluteFill, flexDirection: 'row', gap: 2 },
  thumb: { flex: 1, height: '100%' },
  driveNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.inset,
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
