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

import { Text } from '@/components/ui/text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ToastTone = 'error' | 'info' | 'success';

type Toast = { id: number; message: string; tone: ToastTone; onRetry?: () => void };

type ToastContextValue = {
  /** Shows a transient message. Repeating the same text will not stack it. */
  show: (message: string, options?: { tone?: ToastTone; onRetry?: () => void }) => void;
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

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
  }, []);

  const show = useCallback<ToastContextValue['show']>((message, options) => {
    const text = message?.trim();
    if (!text) return;
    setToast((current) => {
      // Re-showing the identical message restarts its timer rather than
      // flashing the toast out and back in.
      if (current?.message === text) return current;
      return { id: (nextId.current += 1), message: text, tone: options?.tone ?? 'error', onRetry: options?.onRetry };
    });
    clearTimer();
    timer.current = setTimeout(() => setToast(null), VISIBLE_MS);
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
        <Ionicons name={ICONS[toast.tone]} size={17} color={accent} />
        <Text variant="caption" style={styles.copy} numberOfLines={2}>
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
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
  },
  copy: { flex: 1 },
});
