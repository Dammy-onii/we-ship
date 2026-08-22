import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';

/**
 * How much bottom padding the content still needs to clear the keyboard.
 *
 * Two separate Android problems make the naive approaches fail:
 *
 * 1. `KeyboardAvoidingView` with `behavior={undefined}` — which is what
 *    `Platform.OS === 'ios' ? 'padding' : undefined` evaluates to on Android —
 *    renders a plain View and does nothing at all.
 * 2. A React Native `<Modal>` gets its own window, which does **not** inherit
 *    the activity's `windowSoftInputMode="adjustResize"`. So even when normal
 *    screens resize correctly, anything inside a Modal is covered.
 *
 * This returns the keyboard height **minus whatever the window already gave
 * back** by resizing. Where the platform resized (a normal screen on Android),
 * the result is 0 and nothing is double-counted; where it did not (inside a
 * Modal, or on Android 15+ where `adjustResize` is ignored under edge-to-edge),
 * the result is the full keyboard height.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    // `will*` fires before the animation on iOS and gives a smoother result;
    // Android only emits the `did*` pair reliably.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event: KeyboardEvent) => {
      const keyboardHeight = event.endCoordinates?.height ?? 0;
      if (Platform.OS === 'ios') {
        setInset(keyboardHeight);
        return;
      }
      // `screen` stays constant; `window` shrinks when the platform resizes for
      // the keyboard. Whatever it already absorbed must not be padded again.
      const screenHeight = Dimensions.get('screen').height;
      const windowHeight = Dimensions.get('window').height;
      const absorbed = Math.max(0, screenHeight - windowHeight);
      setInset(Math.max(0, Math.round(keyboardHeight - absorbed)));
    };

    const onHide = () => setInset(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return inset;
}
