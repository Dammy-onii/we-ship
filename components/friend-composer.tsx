import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
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

/**
 * The friend-board composer.
 *
 * Deliberately a `Modal` rather than a route: posting is a quick interruption
 * of browsing the board, and returning should not lose the grid's scroll
 * position. Separate from the Goodies composer because the destinations differ
 * — Goodies are for the partner only, this posts to every friend.
 */
export function FriendComposer({
  visible,
  onClose,
  initialKind = 'note',
}: {
  visible: boolean;
  onClose: () => void;
  /** Seeded by the Quick send widget, which names the kind before this opens. */
  initialKind?: FriendPostKind;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { post } = useFriends();
  const [kind, setKind] = useState<FriendPostKind>(initialKind);
  const [text, setText] = useState('');
  const [mediaAsset, setMediaAsset] = useState<ImagePicker.ImagePickerAsset>();
  const [sending, setSending] = useState(false);
  const runPicker = useNativePickerAction();

  const reset = () => {
    setKind(initialKind);
    setText('');
    setMediaAsset(undefined);
  };

  const close = () => {
    if (sending) return;
    reset();
    onClose();
  };

  const selectKind = (next: FriendPostKind) => {
    setKind(next);
    setMediaAsset(undefined);
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
        // Every post is one piece of media. Explicitly disabling multi-select
        // also keeps OEM Android pickers from retaining their last batch mode.
        allowsMultipleSelection: false,
        selectionLimit: 1,
      }),
    );
    if (result.canceled) return;
    // Some vendor pickers ignore selectionLimit; consuming only the first
    // result keeps the one-post/one-file contract true regardless.
    setMediaAsset(result.assets[0]);
  };

  const canSend =
    (kind === 'note' && Boolean(text.trim())) ||
    ((kind === 'photo' || kind === 'video') && Boolean(mediaAsset));

  /** Voice posts are sent from the recorder itself, so they carry their own take. */
  const send = async (voice?: { uri: string; durationSeconds: number }) => {
    if ((!canSend && !voice) || sending) return false;
    setSending(true);
    try {
      if (voice || !mediaAsset) {
        await post({ kind, text: text.trim() || undefined, uri: voice?.uri, durationSeconds: voice?.durationSeconds });
      } else {
        await post({
          kind,
          text: text.trim() || undefined,
          uri: mediaAsset.uri,
          fileName: mediaAsset.fileName,
          mimeType: mediaAsset.mimeType,
          sizeBytes: mediaAsset.fileSize,
          width: mediaAsset.width,
          height: mediaAsset.height,
        });
      }
      reset();
      onClose();
      return true;
    } catch (error) {
      showDialog('Could not post', userFacingError(error, 'Please try again.'));
      return false;
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
                  {mediaAsset && kind === 'photo' ? (
                    <Image
                      source={{ uri: mediaAsset.uri }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <>
                      <Ionicons
                        name={kind === 'video' ? 'videocam-outline' : 'images-outline'}
                        size={28}
                        color={theme.primary}
                      />
                      <Text variant="bodyStrong">
                        {mediaAsset
                          ? 'Video selected'
                          : kind === 'photo'
                            ? 'Choose one photo'
                            : 'Choose a video'}
                      </Text>
                    </>
                  )}
                </Pressable>

                <Text variant="caption" color="textFaint">
                  Friend posts use private Weship storage; they do not use your Google Drive.
                </Text>
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
