import type { Href } from 'expo-router';
import type { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';

import { useAuth } from './auth';
import { useFriends } from './friends';
import { pushNotificationsEnabled, pushSupported } from './push';
import { useGoogleConnection } from './use-google-connection';
import { useBackendStatus, useMe } from './store';

export type SetupStep = {
  key: string;
  label: string;
  detail: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  href: Href;
  done: boolean;
  /** Which profile row this step is granted from, for the badges there. */
  row?: 'Account' | 'Shared space' | 'Connections' | 'Notifications';
};

/**
 * What is still not set up, in one place.
 *
 * Shared by the Home checklist and the profile's pending counter so the two can
 * never disagree about how much is left. The Drive grant in particular is what
 * makes photo and video originals work, and nothing used to say so anywhere.
 */
export function useSetupStatus(): { steps: SetupStep[]; pending: SetupStep[] } {
  const me = useMe();
  const sync = useBackendStatus();
  const auth = useAuth();
  const { friends } = useFriends();
  const { driveConnected } = useGoogleConnection();
  // Read from the registered device token rather than assumed. This step used
  // to be hardcoded as never done, which left the checklist permanently one
  // item short of finished and forced it to hide itself to compensate.
  const [pushEnabled, setPushEnabled] = useState(false);

  const userId = auth.user?.id;
  useEffect(() => {
    let active = true;
    if (!userId || !pushSupported) {
      setPushEnabled(false);
      return;
    }
    pushNotificationsEnabled(userId)
      .then((value) => active && setPushEnabled(value))
      .catch(() => active && setPushEnabled(false));
    return () => {
      active = false;
    };
  }, [userId]);

  if (sync.mode !== 'live' || driveConnected === undefined) return { steps: [], pending: [] };

  const steps: SetupStep[] = [
    {
      key: 'pair',
      label: 'Pair with your partner',
      detail: 'Share your invite code so you both see the same space.',
      icon: 'people-outline',
      href: '/pairing',
      done: sync.paired,
      row: 'Shared space',
    },
    {
      key: 'photo',
      label: 'Add a profile photo',
      detail: 'So they see you, not your initials.',
      icon: 'camera-outline',
      href: '/account',
      done: Boolean(me.photoUri),
      row: 'Account',
    },
    {
      key: 'username',
      label: 'Choose a username',
      detail: 'This is how friends find you.',
      icon: 'at-outline',
      href: '/account',
      done: Boolean(me.username),
      row: 'Account',
    },
    {
      key: 'drive',
      label: 'Connect Google Drive',
      detail: 'Photo and video originals are saved to your own Drive, not to us.',
      icon: 'cloud-upload-outline',
      href: '/connections',
      done: driveConnected,
      row: 'Connections',
    },
    {
      key: 'notifications',
      label: 'Turn on notifications',
      detail: 'So you hear about a nudge or a Goodie when it arrives.',
      icon: 'notifications-outline',
      href: '/notification-settings',
      // Where push cannot run at all — web, Expo Go — there is nothing for the
      // user to do, so the step is not held open against them.
      done: pushEnabled || !pushSupported,
      row: 'Notifications',
    },
    {
      key: 'friends',
      label: 'Find your friends',
      detail: 'Optional — a lighter circle alongside your partner.',
      icon: 'person-add-outline',
      href: '/friends',
      done: friends.length > 0,
    },
  ];

  return { steps, pending: steps.filter((step) => !step.done) };
}
