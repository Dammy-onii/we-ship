import { useEffect } from 'react';

import { useToast } from '@/components/ui/toast';
import { useFriends } from '@/lib/friends';
import { useBackendStatus } from '@/lib/store';

/**
 * Routes background sync failures into the toast.
 *
 * Renders nothing itself. Previously this was a persistent banner that stayed
 * over the screen until dismissed; a failed background refresh does not warrant
 * that much of the interface, and offline is now an expected state rather than
 * an error worth pinning.
 */
export function SyncErrorBanner() {
  const sync = useBackendStatus();
  const friends = useFriends();
  const toast = useToast();

  const message = sync.error ?? friends.error;

  useEffect(() => {
    if (!message) return;
    toast.show(message, {
      onRetry: () => {
        sync.refresh().catch(() => {});
        friends.refresh({ silent: true }).catch(() => {});
      },
    });
    // The toast owns its own lifetime, so the underlying error is cleared
    // immediately — otherwise it would re-fire on every re-render.
    sync.clearError();
    friends.clearError();
  }, [message]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
