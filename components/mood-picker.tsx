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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MOODS, type MoodKey } from '@/lib/moods';

type Props = {
  current?: MoodKey;
  /** Free-text mood in the user's own words, shown to their partner. */
  statusText?: string;
  onSelect: (mood: MoodKey, statusText?: string) => void;
  onClose: () => void;
};

const MAX_STATUS = 60;

/** Bottom sheet for setting your own mood. */
export function MoodPicker({ current, statusText, onSelect, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<MoodKey>(current ?? 'calm');
  const [custom, setCustom] = useState(statusText ?? '');

  const save = () => {
    onSelect(selected, custom.trim() || undefined);
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoider
          style={styles.avoider}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets
          bounces={false}
          contentContainerStyle={styles.scrollContent}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: insets.bottom + Spacing.lg },
          ]}>
          <View style={[styles.grabber, { backgroundColor: theme.lineStrong }]} />
          <Text variant="title" style={{ marginBottom: 2 }}>
            How are you feeling?
          </Text>
          <Text variant="caption" color="textSoft">
            Your partner sees this on their home screen.
          </Text>

          <View style={styles.grid}>
            {MOODS.map((mood) => {
              const active = selected === mood.key;
              return (
                <Pressable
                  key={mood.key}
                  onPress={() => {
                    setSelected(mood.key);
                    setCustom('');
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.mood,
                    {
                      backgroundColor: active ? mood.color + '26' : theme.surfaceAlt,
                      borderColor: active ? mood.color : 'transparent',
                    },
                    pressed && { opacity: 0.75 },
                  ]}>
                  <Text style={styles.emoji}>{mood.emoji}</Text>
                  <Text variant="captionStrong" color={active ? 'text' : 'textSoft'}>
                    {mood.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.customBlock}>
            <Text variant="micro" color="textFaint">CUSTOM MOOD LABEL</Text>
            <TextInput
              value={custom}
              onChangeText={setCustom}
              placeholder="e.g. exhausted, hopeful, missing you…"
              placeholderTextColor={theme.textFaint}
              selectionColor={theme.primary}
              maxLength={MAX_STATUS}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.line },
              ]}
            />
            <Text variant="micro" color="textFaint">
              {`${custom.length}/${MAX_STATUS} · replaces the preset label when filled`}
            </Text>
          </View>

          <Button full label="Save mood" onPress={save} style={{ marginTop: Spacing.sm }} />
        </View>
        </ScrollView>
        </KeyboardAvoider>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  avoider: { maxHeight: '92%' },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,12,11,0.5)' },
  sheet: {
    borderTopLeftRadius: Radius.hero,
    borderTopRightRadius: Radius.hero,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: 4,
  },
  grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.base },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.lg },
  mood: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  emoji: { fontSize: 15 },
  customBlock: { gap: 6, marginTop: Spacing.lg },
  input: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.inset,
    paddingHorizontal: Spacing.md,
    fontFamily: Font.sans,
    fontSize: 16,
  },
});
