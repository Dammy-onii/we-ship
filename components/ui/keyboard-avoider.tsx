import { type ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';

import { useKeyboardInset } from '@/hooks/use-keyboard-inset';

type Props = {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Extra breathing room between the field and the keyboard. */
  offset?: number;
};

/**
 * Keeps content clear of the on-screen keyboard, on every surface.
 *
 * Replaces `KeyboardAvoidingView`, which was used across this app as
 * `` — a no-op on
 * Android. Screens still looked fine there only because the activity is
 * `adjustResize`; anything inside a `<Modal>` has its own window and was left
 * completely uncovered, which is why the mood picker and other sheets kept
 * ending up behind the keyboard.
 *
 * Padding is applied directly rather than through the platform component so the
 * behaviour is identical inside and outside a Modal.
 */
export function KeyboardAvoider({ children, style, offset = 0 }: Props) {
  const inset = useKeyboardInset();
  const padding = inset > 0 ? inset + offset : 0;

  return (
    <View
      style={[
        style,
        // iOS reports the inset including its own safe area, so the raw value
        // is already the right amount of lift.
        padding > 0 ? { paddingBottom: padding } : null,
      ]}>
      {children}
    </View>
  );
}

/** True while the keyboard is up — for hiding decorative chrome. */
export function useKeyboardVisible() {
  return useKeyboardInset() > 0 || Platform.OS === 'web';
}
