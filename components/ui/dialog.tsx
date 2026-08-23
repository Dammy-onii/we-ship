import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, BackHandler, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Same shape as React Native's `AlertButton`, so call sites read identically to
 * the `Alert.alert` they replaced.
 */
export type DialogButton = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type DialogRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
};

let publish: ((request: DialogRequest | null) => void) | null = null;
let nextId = 0;

/**
 * A themed replacement for `Alert.alert`.
 *
 * The platform alert is drawn by the OS: white on Android, system blue text,
 * system font. Against Weship's warm paper and Fraunces headings every prompt
 * looked like it came from a different app. Signature-compatible with
 * `Alert.alert` so it can be swapped in wherever that was used.
 */
export function showDialog(title: string, message?: string, buttons?: DialogButton[]) {
  const request: DialogRequest = {
    id: (nextId += 1),
    title,
    message,
    buttons: buttons?.length ? buttons : [{ text: 'OK' }],
  };
  // Rendered by DialogHost. With no host mounted the prompt would be silently
  // lost, so fall back to the platform alert rather than swallowing it.
  if (publish) publish(request);
  else Alert.alert(title, message, buttons);
}

/**
 * Renders whatever `showDialog` last asked for. Mounted once, near the root, so
 * a prompt survives the screen that raised it navigating away.
 */
export function DialogHost() {
  const theme = useTheme();
  const [request, setRequest] = useState<DialogRequest | null>(null);

  useEffect(() => {
    publish = setRequest;
    return () => {
      publish = null;
    };
  }, []);

  const cancel = request?.buttons.find((button) => button.style === 'cancel');

  // Android's back gesture must behave like tapping the cancel action, and must
  // never fall through to the screen underneath while a prompt is up.
  useEffect(() => {
    if (!request) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (cancel) {
        setRequest(null);
        cancel.onPress?.();
      }
      return true;
    });
    return () => subscription.remove();
  }, [cancel, request]);

  if (!request) return null;

  const run = (button: DialogButton) => {
    setRequest(null);
    button.onPress?.();
  };

  const destructive = request.buttons.some((button) => button.style === 'destructive');

  return (
    <Modal
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      visible
      onRequestClose={() => (cancel ? run(cancel) : undefined)}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        // Tapping outside is a dismissal, which is only safe when the prompt
        // offers one. A destructive choice with no cancel stays put.
        onPress={() => (cancel ? run(cancel) : undefined)}>
        <Pressable
          // Swallows taps so pressing the card itself does not dismiss it.
          onPress={() => {}}
          style={[
            styles.card,
            Shadow.lifted,
            { backgroundColor: theme.surface, borderColor: theme.line },
          ]}>
          {destructive ? (
            <View style={[styles.crest, { backgroundColor: theme.partnerSoft }]}>
              <Ionicons name="alert-circle-outline" size={20} color={theme.partner} />
            </View>
          ) : null}
          <Text variant="title" style={styles.title}>
            {request.title}
          </Text>
          {request.message ? (
            <ScrollView
              // Long backend errors were being clipped by the fixed card.
              style={styles.messageScroll}
              contentContainerStyle={styles.messageContent}>
              <Text variant="body" color="textSoft" style={styles.message}>
                {request.message}
              </Text>
            </ScrollView>
          ) : null}
          <View style={styles.actions}>
            {orderButtons(request.buttons).map((button, index) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';
              return (
                <Pressable
                  key={`${button.text ?? index}`}
                  accessibilityRole="button"
                  onPress={() => run(button)}
                  style={({ pressed }) => [
                    styles.action,
                    {
                      backgroundColor: isCancel
                        ? 'transparent'
                        : isDestructive
                          ? theme.partnerSoft
                          : theme.primary,
                      borderColor: isCancel ? theme.line : 'transparent',
                      borderWidth: isCancel ? StyleSheet.hairlineWidth : 0,
                    },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <Text
                    variant="bodyStrong"
                    style={{
                      color: isCancel
                        ? theme.textSoft
                        : isDestructive
                          ? theme.partner
                          : theme.onPrimary,
                    }}>
                    {button.text ?? 'OK'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * Cancel last.
 *
 * The buttons are stacked, and `Alert.alert` call sites conventionally list
 * cancel first — which would put the safe choice furthest from the thumb and
 * the destructive one directly under it.
 */
function orderButtons(buttons: DialogButton[]): DialogButton[] {
  const rest = buttons.filter((button) => button.style !== 'cancel');
  const cancel = buttons.filter((button) => button.style === 'cancel');
  return [...rest, ...cancel];
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  crest: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { lineHeight: 28 },
  messageScroll: { maxHeight: 260 },
  messageContent: { paddingBottom: 2 },
  message: { lineHeight: 23 },
  actions: { gap: Spacing.sm, paddingTop: Spacing.sm },
  action: {
    minHeight: 50,
    borderRadius: Radius.inset,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
});
