import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Image } from 'expo-image';

import { Bloom, Leaf, Sprig } from '@/components/art/botanicals';
import { MomentTile } from '@/components/moment-tile';
import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/ui/data-state';
import { Font, Radius, Spacing } from '@/constants/theme';
import { showDialog } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/use-theme';
import { userFacingError } from '@/lib/user-facing-error';
import { useNativePickerAction } from '@/hooks/use-native-picker';
import { useAuth } from '@/lib/auth';
import * as repository from '@/lib/backend/repository';
import { useBackendStatus, useMemories, useMoments, useSpace, YOU_ID } from '@/lib/store';
import { relativeDay } from '@/lib/time';
import type { MemoryItem } from '@/lib/types';

export default function MemoriesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const moments = useMoments();
  const { memories, addMemory, updateMemory } = useMemories();
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState<MemoryItem | null | 'new'>(null);
  const [addingMedia, setAddingMedia] = useState(false);
  const { width } = useWindowDimensions();
  const tile = (width - Spacing.lg * 2 - Spacing.sm) / 2;

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
      <View style={styles.intro}>
        <Text variant="micro" color="textFaint">
          YOUR STORY
        </Text>
        <Text variant="display">Moments worth keeping</Text>
        <Text variant="body" color="textSoft">
          Photos, answers, and small milestones collected in one quieter place.
        </Text>
      </View>

      <View style={styles.timelineSection}>
        <View style={styles.timelineHeader}>
          <Pressable
            onPress={() => setTimelineOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: timelineOpen }}
            style={styles.timelineTitle}>
            <View style={{ flex: 1 }}>
              <Text variant="micro" color="textFaint">LOOKING BACK</Text>
              <Text variant="title">Your timeline</Text>
            </View>
            <Ionicons name={timelineOpen ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textSoft} />
          </Pressable>
          <Pressable
            onPress={() => setMenuOpen((open) => !open)}
            accessibilityLabel="Timeline menu"
            style={[styles.menuButton, { backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSoft} />
          </Pressable>
        </View>

        {menuOpen ? (
          <View style={[styles.timelineMenu, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Pressable onPress={() => { setEditing('new'); setMenuOpen(false); }} style={styles.menuAction}>
              <Ionicons name="add-circle-outline" size={19} color={theme.primaryDeep} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Add event</Text>
                <Text variant="caption" color="textFaint">Choose a date and add it to your shared story.</Text>
              </View>
            </Pressable>
            <View style={[styles.syncNote, { borderTopColor: theme.line }]}>
              <Ionicons name="calendar-outline" size={17} color={theme.textFaint} />
              <Text variant="caption" color="textFaint" style={{ flex: 1 }}>
                Dates update across this app now. Google Calendar sync is staged for the connected build.
              </Text>
            </View>
          </View>
        ) : null}

        {timelineOpen ? <View style={styles.timeline}>
          {!memories.length ? (
            <DataState compact icon="calendar-outline" title="Your timeline is empty" detail="Use the timeline menu to add your first shared event." />
          ) : memories.map((memory, index) => (
            <View key={memory.id} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View
                  style={[
                    styles.timelineDot,
                    { backgroundColor: theme.surface, borderColor: theme.line },
                  ]}>
                  {memory.kind === 'question' ? (
                    <Sprig size={20} color={theme.primary} />
                  ) : memory.kind === 'milestone' ? (
                    <Bloom size={20} color={theme.bloom} />
                  ) : (
                    <Leaf size={20} color={theme.accent} />
                  )}
                </View>
                {index < memories.length - 1 ? (
                  <View style={[styles.timelineLine, { backgroundColor: theme.line }]} />
                ) : null}
              </View>
              <View style={styles.timelineCopy}>
                <View style={styles.memoryTitleRow}>
                  <Text variant="bodyStrong" style={{ flex: 1 }}>{memory.title}</Text>
                  <Pressable
                    onPress={() => setEditing(memory)}
                    hitSlop={8}
                    accessibilityLabel={`Edit ${memory.title}`}>
                    <Ionicons name="create-outline" size={17} color={theme.textFaint} />
                  </Pressable>
                </View>
                <Text variant="caption" color="textSoft">
                  {memory.subtitle}
                </Text>
                <Text variant="micro" color="textFaint">
                  {relativeDay(memory.date).toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
        </View> : null}
      </View>

      <View style={styles.photoSection}>
        <View style={styles.photoHeader}>
          <View style={{ flex: 1 }}>
            <Text variant="micro" color="textFaint">PHOTOS & VIDEOS</Text>
            <Text variant="title">Shared moments</Text>
          </View>
          <Pressable onPress={() => setAddingMedia(true)} style={[styles.addMediaButton, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="add" size={20} color={theme.primaryDeep} />
          </Pressable>
        </View>
        <View style={styles.gallery}>
          {!moments.length ? (
            <DataState style={styles.galleryEmpty} icon="images-outline" title="No shared moments yet" detail="Tap + to add your first photo or video." />
          ) : moments.map((moment, index) => (
            <MomentTile
              key={moment.id}
              moment={moment}
              index={index}
              width={tile}
              height={index % 3 === 0 ? tile * 1.2 : tile}
              showCaption={index % 3 === 0}
              onPress={moment.originalAvailable ? () => router.push({
                pathname: '/media',
                params: {
                  target: 'memory',
                  id: moment.id,
                  type: moment.type,
                  caption: moment.caption ?? '',
                  canDelete: moment.authorId === YOU_ID ? '1' : '0',
                },
              } as unknown as Href) : undefined}
            />
          ))}
        </View>
      </View>
      <TimelineEditor
        value={editing}
        onClose={() => setEditing(null)}
        onSave={(input) => {
          if (editing && editing !== 'new') updateMemory(editing.id, input);
          else addMemory(input);
          setEditing(null);
        }}
      />
      <MemoryMediaEditor visible={addingMedia} onClose={() => setAddingMedia(false)} />
    </ScrollView>
  );
}

function MemoryMediaEditor({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const auth = useAuth();
  const space = useSpace();
  const sync = useBackendStatus();
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset>();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const runPicker = useNativePickerAction();

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return showDialog('Photo access needed', 'Allow photo access to add a shared memory.');
    const result = await runPicker(() =>
      ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.9 }),
    );
    if (!result.canceled) setAsset(result.assets[0]);
  };

  const save = async () => {
    if (!auth.user || space.id === 'unpaired' || !asset || !title.trim()) return;
    setBusy(true);
    setProgress(0);
    try {
      await repository.addMemoryMedia(space.id, auth.user.id, {
        title,
        caption,
        date: new Date().toISOString().slice(0, 10),
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'photo',
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        sizeBytes: asset.fileSize,
        width: asset.width,
        height: asset.height,
        onProgress: setProgress,
      });
      await sync.refresh();
      setTitle(''); setCaption(''); setAsset(undefined); onClose();
    } catch (error) {
      showDialog('Could not save memory', userFacingError(error, 'Please try again.'));
    } finally { setBusy(false); setProgress(0); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoider style={styles.modalRoot} >
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={[styles.editor, { backgroundColor: theme.bg }]}>
          <View style={styles.editorHeader}>
            <View><Text variant="micro" color="textFaint">NEW MEMORY</Text><Text variant="title">Add a photo or video</Text></View>
            <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.surfaceAlt }]}><Ionicons name="close" size={20} color={theme.textSoft} /></Pressable>
          </View>
          {/* Shows the picked media rather than only its filename — there was
              no way to tell whether the right thing had been selected. */}
          <Pressable
            onPress={pick}
            accessibilityRole="button"
            accessibilityLabel={asset ? 'Change the selected media' : 'Choose media from your phone'}
            style={[
              asset ? styles.mediaPreview : styles.mediaChoice,
              { backgroundColor: theme.surfaceAlt, borderColor: theme.line },
            ]}>
            {asset ? (
              <>
                <Image source={{ uri: asset.uri }} style={styles.mediaPreviewImage} contentFit="cover" />
                <View style={[styles.mediaPreviewBar, { backgroundColor: theme.scrim }]}>
                  <Ionicons
                    name={asset.type === 'video' ? 'videocam' : 'image'}
                    size={15}
                    color="#FCFAF7"
                  />
                  <Text variant="caption" onPhoto numberOfLines={1} style={{ flex: 1 }}>
                    {asset.fileName ?? (asset.type === 'video' ? 'Video' : 'Photo')}
                  </Text>
                  <Text variant="captionStrong" onPhoto>
                    Change
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Ionicons name="images-outline" size={28} color={theme.primaryDeep} />
                <Text variant="bodyStrong">Choose from your phone</Text>
              </>
            )}
          </Pressable>
          <TextInput value={title} onChangeText={setTitle} placeholder="Memory title" placeholderTextColor={theme.textFaint} selectionColor={theme.primary} style={[styles.editorInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.line }]} />
          <TextInput value={caption} onChangeText={setCaption} placeholder="Add a caption" placeholderTextColor={theme.textFaint} selectionColor={theme.primary} style={[styles.editorInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.line }]} />
          <View style={[styles.driveNotice, { backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="logo-google" size={20} color={theme.primaryDeep} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Original stored in your Google Drive</Text>
              <Text variant="caption" color="textFaint">Originals stay in your own Google Drive. Connect Google in Profile → Connections.</Text>
            </View>
          </View>
          <Button full loading={busy} label={busy ? `Uploading ${Math.round(progress * 100)}%` : 'Save memory'} disabled={!asset || !title.trim() || sync.mode !== 'live'} onPress={save} />
        </View>
      </KeyboardAvoider>
    </Modal>
  );
}

function TimelineEditor({
  value,
  onClose,
  onSave,
}: {
  value: MemoryItem | null | 'new';
  onClose: () => void;
  onSave: (input: { title: string; subtitle: string; date: string }) => void;
}) {
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [date, setDate] = useState(new Date());
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const key = value === 'new' ? 'new' : value?.id ?? 'closed';

  return (
    <Modal key={key} visible={Boolean(value)} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoider style={styles.modalRoot} >
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={[styles.editor, { backgroundColor: theme.bg }]}>
          <View style={styles.editorHeader}>
            <View>
              <Text variant="micro" color="textFaint">TIMELINE EVENT</Text>
              <Text variant="title">{value === 'new' ? 'Add something new' : 'Update event'}</Text>
            </View>
            <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.surfaceAlt }]}>
              <Ionicons name="close" size={20} color={theme.textSoft} />
            </Pressable>
          </View>

          <TimelineFields
            initial={value && value !== 'new' ? value : undefined}
            title={title}
            subtitle={subtitle}
            date={date}
            onTitle={setTitle}
            onSubtitle={setSubtitle}
            onDate={setDate}
            showAndroidPicker={showAndroidPicker}
            setShowAndroidPicker={setShowAndroidPicker}
          />

          <Button
            label="Save event"
            full
            disabled={!title.trim()}
            onPress={() => onSave({
              title: title.trim(),
              subtitle: subtitle.trim() || 'A moment in your shared story',
              date: toDateKey(date),
            })}
          />
        </View>
      </KeyboardAvoider>
    </Modal>
  );
}

function TimelineFields({
  initial,
  title,
  subtitle,
  date,
  onTitle,
  onSubtitle,
  onDate,
  showAndroidPicker,
  setShowAndroidPicker,
}: {
  initial?: MemoryItem;
  title: string;
  subtitle: string;
  date: Date;
  onTitle: (value: string) => void;
  onSubtitle: (value: string) => void;
  onDate: (value: Date) => void;
  showAndroidPicker: boolean;
  setShowAndroidPicker: (value: boolean) => void;
}) {
  const theme = useTheme();
  useEffect(() => {
    if (initial) {
      onTitle(initial.title);
      onSubtitle(initial.subtitle);
      onDate(new Date(`${initial.date}T12:00:00`));
    } else {
      onTitle('');
      onSubtitle('');
      onDate(new Date());
    }
  }, [initial, onDate, onSubtitle, onTitle]);

  const picker = (
    <DateTimePicker
      value={date}
      mode="date"
      display={Platform.OS === 'ios' ? 'inline' : 'default'}
      themeVariant="light"
      accentColor={theme.primary}
      onChange={(_, next) => {
        if (Platform.OS === 'android') setShowAndroidPicker(false);
        if (next) onDate(next);
      }}
    />
  );

  return (
    <View style={styles.fields}>
      <TextInput
        value={title}
        onChangeText={onTitle}
        placeholder="Event title"
        placeholderTextColor={theme.textFaint}
        selectionColor={theme.primary}
        maxLength={70}
        style={[styles.editorInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.line }]}
      />
      <TextInput
        value={subtitle}
        onChangeText={onSubtitle}
        placeholder="Add a short detail"
        placeholderTextColor={theme.textFaint}
        selectionColor={theme.primary}
        maxLength={140}
        style={[styles.editorInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.line }]}
      />
      <Pressable
        onPress={() => setShowAndroidPicker(true)}
        style={[styles.dateButton, { backgroundColor: theme.surfaceAlt }]}>
        <Ionicons name="calendar-outline" size={19} color={theme.primaryDeep} />
        <View style={{ flex: 1 }}>
          <Text variant="micro" color="textFaint">EVENT DATE</Text>
          <Text variant="bodyStrong">{date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </View>
      </Pressable>
      {Platform.OS === 'ios' ? picker : showAndroidPicker ? picker : null}
    </View>
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.xl },
  intro: { gap: Spacing.sm, paddingTop: Spacing.sm },
  timelineSection: { gap: Spacing.sm },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  timelineTitle: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  menuButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  timelineMenu: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.inset, padding: Spacing.md },
  menuAction: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  syncNote: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, marginTop: Spacing.md, paddingTop: Spacing.md },
  timeline: { marginTop: Spacing.sm },
  timelineRow: { flexDirection: 'row', gap: Spacing.base },
  timelineRail: { alignItems: 'center', width: 38 },
  timelineDot: {
    width: 38,
    height: 38,
    borderRadius: Radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: { width: StyleSheet.hairlineWidth, flex: 1, marginVertical: 4 },
  timelineCopy: { flex: 1, gap: 3, paddingBottom: Spacing.lg },
  memoryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  photoSection: { gap: Spacing.sm },
  photoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  addMediaButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    marginTop: Spacing.sm,
  },
  galleryEmpty: { width: '100%' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(20,20,20,0.42)' },
  editor: { borderTopLeftRadius: Radius.hero, borderTopRightRadius: Radius.hero, padding: Spacing.lg, gap: Spacing.lg },
  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  closeButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fields: { gap: Spacing.md },
  editorInput: { minHeight: 52, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.inset, paddingHorizontal: Spacing.md, fontFamily: Font.sans, fontSize: 16 },
  dateButton: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radius.inset, padding: Spacing.md },
  mediaPreview: {
    height: 200,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.inset,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  mediaPreviewImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  mediaPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  mediaChoice: { minHeight: 82, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.inset, alignItems: 'center', justifyContent: 'center', gap: 5 },
  driveNotice: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radius.inset, padding: Spacing.md },
});
