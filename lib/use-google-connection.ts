import { useCallback, useEffect, useState } from 'react';

import * as integrations from './backend/integrations';
import { useBackendStatus } from './store';

export type GoogleConnection = {
  /** `undefined` until the first read finishes. */
  driveConnected: boolean | undefined;
  calendarConnected: boolean | undefined;
  refresh: () => void;
};

/**
 * Whether the account has granted Google Drive.
 *
 * Shared rather than re-queried per screen: the setup checklist, the profile's
 * pending counter, and the friend composer's attachment limit all key off the
 * same grant, and three independent answers would eventually disagree.
 */
export function useGoogleConnection(): GoogleConnection {
  const sync = useBackendStatus();
  const [state, setState] = useState<{ drive?: boolean; calendar?: boolean }>({});
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // Demo mode has nothing to connect.
    if (sync.mode !== 'live') return;
    let active = true;
    integrations
      .listConnections()
      .then((connections) => {
        if (!active) return;
        const google = connections.find((item) => item.provider === 'google');
        const active_ = google?.status === 'active';
        setState({
          drive: active_ && google.scopes.some((scope) => scope.includes('drive')),
          calendar: active_ && google.scopes.some((scope) => scope.includes('calendar')),
        });
      })
      // An unreachable backend is not a missing grant. Treating it as connected
      // avoids nagging about something the user already did, and avoids
      // tightening the attachment limit because the network hiccuped.
      .catch(() => active && setState({ drive: true, calendar: true }))
    return () => {
      active = false;
    };
  }, [sync.mode, nonce]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  return { driveConnected: state.drive, calendarConnected: state.calendar, refresh };
}
