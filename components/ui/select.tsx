import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SelectOption<T extends string> = { key: T; label: string };

/**
 * A dropdown for short, fixed option lists.
 *
 * Rendered as a sheet rather than a native picker: the native pickers differ
 * enough between platforms that they fight the design system, and a chip row
 * grows wider than the screen once labels are more than a word long.
 */
export function Select<T extends string>({
  label,
  placeholder = 'Select',
  options,
  value,
  onChange,
  clearable = false,
}: {
  label?: string;
  placeholder?: string;
  options: SelectOption<T>[];
  value?: T;
  onChange: (next: T | undefined) => void;
  /** Allows re-picking the current option to clear it. */
  clearable?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.key === value);

  return (
    <View style={styles.root}>
      {label ? <Text variant="micro" color="textFaint">{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        style={({ pressed }) => [
          styles.trigger,
          { backgroundColor: theme.surface, borderColor: theme.line },
          pressed && { opacity: 0.7 },
        ]}>
        <Text variant="body" color={selected ? 'text' : 'textFaint'} style={styles.triggerLabel}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={17} color={theme.textFaint} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close">
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: theme.bg, paddingBottom: insets.bottom + Spacing.md },
            ]}
            // Swallows the backdrop press so tapping the list does not dismiss it.
            onPress={() => {}}>
            <View style={[styles.grabber, { backgroundColor: theme.line }]} />
            {label ? (
              <Text variant="micro" color="textFaint" style={styles.sheetLabel}>{label}</Text>
            ) : null}
            {options.map((option, index) => {
              const active = option.key === value;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    onChange(active && clearable ? undefined : option.key);
                    setOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.option,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line },
                    pressed && { backgroundColor: theme.surfaceAlt },
                  ]}>
                  <Text variant="body" color={active ? 'primaryDeep' : 'text'} style={styles.optionLabel}>
                    {option.label}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={19} color={theme.primaryDeep} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  trigger: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.inset,
  },
  triggerLabel: { flex: 1, minWidth: 0 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24,20,17,0.42)' },
  sheet: {
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    ...Shadow.subtle,
  },
  grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  sheetLabel: { marginBottom: Spacing.xs },
  option: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  optionLabel: { flex: 1, minWidth: 0 },
});
