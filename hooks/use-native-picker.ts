import { useNavigation } from 'expo-router';
import { useCallback } from 'react';

/** The drawer navigator surface we need, without pulling in react-navigation types. */
type DrawerLike = {
  closeDrawer?: () => void;
  setOptions?: (options: Record<string, unknown>) => void;
};

/**
 * Runs an action that hands control to a native activity (image picker,
 * camera, document picker) without stranding the drawer.
 *
 * Opening a native activity can interrupt an in-flight drawer pan gesture: the
 * gesture never receives its END event, so React Navigation still believes a
 * swipe is in progress and the drawer slides out and stays out once the app
 * returns. Disabling the swipe for the duration and explicitly closing the
 * drawer afterwards clears that stuck state.
 */
export function useNativePickerAction() {
  const navigation = useNavigation();

  return useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      const drawer = navigation.getParent() as unknown as DrawerLike | undefined;
      drawer?.setOptions?.({ swipeEnabled: false });
      try {
        return await action();
      } finally {
        drawer?.closeDrawer?.();
        drawer?.setOptions?.({ swipeEnabled: true });
      }
    },
    [navigation],
  );
}
