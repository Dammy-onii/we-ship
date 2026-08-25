import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from './auth';
import * as integrations from './backend/integrations';
import { useBackendStatus } from './store';

export type GoogleConnection = {
  /** `undefined` until the first successful read finishes. */
  driveConnected: boolean | undefined;
  calendarConnected: boolean | undefined;
  refresh: () => Promise<void>;
};

const GoogleConnectionContext = createContext<GoogleConnection | null>(null);

/**
 * Owns the Google grant state once for the signed-in app.
 *
 * Connection changes happen on a separate route, while setup indicators can
 * remain mounted underneath it. A provider makes those consumers observe the
 * same refreshed result instead of each hook retaining a private stale copy.
 */
export function GoogleConnectionProvider({ children }: { children: ReactNode }) {
  const sync = useBackendStatus();
  const userId = useAuth().user?.id;
  const [state, setState] = useState<{ drive?: boolean; calendar?: boolean }>({});
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++requestId.current;
    if (sync.mode !== 'live' || !userId) {
      setState({});
      return;
    }

    try {
      const connections = await integrations.listConnections();
      if (request !== requestId.current) return;
      const google = connections.find((item) => item.provider === 'google');
      const active = google?.status === 'active';
      setState({
        drive: Boolean(active && google.scopes.some((scope) => scope.includes('drive'))),
        calendar: Boolean(active && google.scopes.some((scope) => scope.includes('calendar'))),
      });
    } catch {
      // A network failure says nothing about the grant. Keep the last known
      // state; on first load it remains unknown instead of falsely connected.
    }
  }, [sync.mode, userId]);

  useEffect(() => {
    setState({});
    void refresh();
    return () => {
      requestId.current += 1;
    };
  }, [refresh]);

  return createElement(
    GoogleConnectionContext.Provider,
    {
      value: {
        driveConnected: state.drive,
        calendarConnected: state.calendar,
        refresh,
      },
    },
    children,
  );
}

export function useGoogleConnection(): GoogleConnection {
  const value = useContext(GoogleConnectionContext);
  if (!value) throw new Error('useGoogleConnection must be used inside GoogleConnectionProvider');
  return value;
}
