# Architecture

## Current shape

```text
Expo Router screens
      ↓ selector hooks
Live-aware context store (`lib/store.tsx`)
      ↓ configured                     ↓ unconfigured
Supabase repository + Realtime      Demo seed (`lib/mock/seed.ts`)
      ↓ typed by
Domain contracts (`lib/types.ts`)
```

Screens never import backend rows or seed data directly. Optimistic mutations retain the hook API; authenticated refreshes reconcile against authoritative RLS-scoped rows.

## Navigation ownership

- Root drawer owns Goodies, 2do, Widgets, Memories, and Profile.
- The three-tab group owns Home, Play, and Us.
- Left-edge gestures belong to the drawer; horizontal gestures outside the edge switch tabs.
- Root secondary screens use the native drawer header so the menu, profile, and notification affordances remain consistent.

## State domains

- **Space:** members, mode, anniversary, and streak.
- **Presence:** mood, status, timezone, weather.
- **Coordination:** tasks/log days, timeline events, reminders.
- **Connection:** questions, games, notes, Goodies.
- **Media:** Moments, photo/video Goodies, Scene recordings.
- **Surfaces:** top-2do widget state and opt-in provider connections.

## Connected runtime

```text
Expo client ── authenticated API/store hooks ── Supabase
     │                                      ├─ Postgres + RLS metadata
     │                                      ├─ private preview/voice Storage
     │                                      └─ Realtime + Edge Functions
     ├─ OAuth system browser ── Google ── encrypted token vault/backend
     └─ original PUT ── short-lived resumable session ── uploader's Drive
```

Provider files are references, not the source of relationship permissions. Weship still owns Space membership, metadata, sync state, and deletion rules.

## Drive-primary media flow

1. The device creates a compact JPEG preview (maximum 720px edge and 2 MB).
2. The preview uploads to the pair-scoped private `memory-previews` or `goodie-previews` bucket.
3. An authenticated Edge Function verifies the uploader and creates a resumable upload session in that user’s visible `Weship/Memories` or `Weship/Goodies` Drive folder.
4. The device streams the original directly to Google. The original never passes through Supabase Storage and uses the user’s Drive quota.
5. The Edge Function validates Drive `appProperties` and atomically commits the Drive ID, owner, size, MIME type, checksum where available, and preview path.
6. Gallery grids use signed preview URLs. Opening an original calls an authenticated pair-scoped proxy, which uses the owner’s server-held Google token and supports byte ranges for video. Neither partner receives a Google access/refresh token.

Photo/video Goodies and Memories use this path. Small voice notes still use private Supabase Storage; captions, dates, ownership, pair authorization, and provider IDs remain in Postgres. — [codex · done-unverified]

Only the uploader can delete a Drive-primary item from Weship. That operation deletes the Drive original first, then its database row and private preview; a Memory container is removed only when it has no media left.

## Native surfaces and trust boundaries

- iOS uses `expo-widgets` plus the TypeScript/SwiftUI `TopTodoWidget`.
- Android uses the local `weship-todo-widget` Expo module and `AppWidgetProvider`/`RemoteViews`; SDK 57's Android `expo-widgets` renderer is still a placeholder.
- Widgets receive only the locally cached top incomplete 2do and a deep link. Auth tokens never enter widget storage.
- Device push tokens are registered after explicit permission and stored per user/device.
- Service-role and Google secrets live only in Supabase functions. Provider tokens are AES-GCM encrypted before service-role-only storage in the private schema.
- A failed/ambiguous finalization never blindly deletes a committed original: the discard endpoint checks for a ready database reference first.
- Importing selected calendars is the explicit act that shares those events into the Space. Drive file ownership never grants Space access.
