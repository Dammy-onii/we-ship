import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from 'expo-haptics';

import { Text } from '@/components/ui/text';
import { playAlertSound } from '@/lib/alert-sound';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ToastTone = 'error' | 'info' | 'success';

type Toast = { id: number; message: string; tone: ToastTone; onRetry?: () => void };

type ToastContextValue = {
  /** Shows a transient message. Repeating the same text will not stack it. */
  show: (
    message: string,
    options?: { tone?: ToastTone; onRetry?: () => void; silent?: boolean },
  ) => void;
  dismiss: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** How long a message stays before sliding back out. */
const VISIBLE_MS = 5000;

const ICONS: Record<ToastTone, React.ComponentProps<typeof Ionicons>['name']> = {
  error: 'alert-circle-outline',
  info: 'information-circle-outline',
  success: 'checkmark-circle-outline',
};

/**
 * Transient messages that slide in from the top and leave on their own.
 *
 * Replaces the persistent banner, which sat over the screen until dismissed and
 * pushed content down. One toast is shown at a time: a second message replaces
 * the first rather than stacking, because these are almost always the same
 * failure reported by two subscribers at once.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);
  const shownMessage = useRef<string | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const dismiss = useCallback(() => {
    clearTimer();
    shownMessage.current = null;
    setToast(null);
  }, []);

  const show = useCallback<ToastContextValue['show']>((message, options) => {
    const text = message?.trim();
    if (!text) return;
    const tone = options?.tone ?? 'error';
    // Tracked in a ref rather than read back from state: a state updater is not
    // guaranteed to run synchronously, so deciding "is this new?" inside one
    // would announce unpredictably.
    const announced = shownMessage.current !== text;
    shownMessage.current = text;
    setToast((current) => {
      // Re-showing the identical message restarts its timer rather than
      // flashing the toast out and back in.
      if (current?.message === text) return current;
      return { id: (nextId.current += 1), message: text, tone, onRetry: options?.onRetry };
    });
    // A toast that slides in silently is easy to miss while looking elsewhere on
    // the screen. Sound and haptics only fire for a genuinely new message, so a
    // repeated failure does not chime on every retry.
    if (announced && !options?.silent) {
      playAlertSound();
      Haptics.notificationAsync(
        tone === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : tone === 'info'
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
    }
    clearTimer();
    timer.current = setTimeout(() => {
      shownMessage.current = null;
      setToast(null);
    }, VISIBLE_MS);
  }, []);

  useEffect(() => clearTimer, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <ToastHost toast={toast} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastHost({ toast, onDismiss }: { toast: Toast | null; onDismiss: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (!toast) return null;

  const accent =
    toast.tone === 'error' ? theme.bloom : toast.tone === 'success' ? theme.primary : theme.textSoft;

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + Spacing.xs }]}>
      <Animated.View
        key={toast.id}
        entering={SlideInUp.duration(260)}
        exiting={SlideOutUp.duration(220)}
        style={[styles.toast, Shadow.lifted, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <View style={[styles.crest, { backgroundColor: theme.surfaceAlt }]}>
          <Ionicons name={ICONS[toast.tone]} size={18} color={accent} />
        </View>
        <Text variant="body" style={styles.copy} numberOfLines={3}>
          {toast.message}
        </Text>
        {toast.onRetry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try again"
            hitSlop={8}
            onPress={() => {
              toast.onRetry?.();
              onDismiss();
            }}>
            <Text variant="captionStrong" color="primaryDeep">
              Retry
            </Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8} onPress={onDismiss}>
          <Ionicons name="close" size={16} color={theme.textFaint} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  // Deliberately forgiving: a toast is never important enough to crash a screen
  // that happens to render outside the provider.
  return context ?? { show: () => {}, dismiss: () => {} };
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: Spacing.md, right: Spacing.md, zIndex: 200, elevation: 40 },
  toast: {
    // Roomier than the pill it replaced: a two-line message was squeezed into
    // 44dp with the text against the icon, and a third line was cut off.
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  crest: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, lineHeight: 21 },
});
