# External Integrations

## Recommendation

All three requested connections are possible, but they belong after accounts, secure backend storage, and privacy controls. Build them as opt-in per-user connections; each partner connects their own provider account.

ChatGPT/Codex plugins are not shipped-app integrations. Weship must register its own OAuth clients and call the provider APIs.

## Current implementation status

- Google OAuth start/callback uses backend PKCE state, one-time sessions, AES-GCM token encryption, and service-role-only private storage.
- Calendar has account calendar listing, explicit selection, event import/upsert, sync metadata, and create-in-Google-plus-Weship entry points.
- Memories and photo/video Goodies create compact protected previews, then upload originals directly into the uploader’s Drive through resumable sessions.
- The server validates each Drive file and atomically records its owner/file ID. A pair-authorized content endpoint streams originals, including byte ranges for video, without exposing Google tokens.
- Spotify remains mapped but unimplemented; Google was prioritized in this backend pass.
- Deployment values and commands are in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

## Sustainable operating model

```text
Partner devices + widgets
          ↕
Weship backend (pair permissions, metadata, encrypted provider tokens, push)
      ↙              ↓               ↘
Google Drive    Google Calendar     Spotify
media originals    selected events   track/playback state
```

The backend remains the small source of truth for who the couple is, which items are shared, file/event IDs, game state, and sync status. Provider services own their specialized data. This avoids copying every original media file while keeping relationship permissions independent of a single partner's Google or Spotify account.

## Google Drive — primary photo/video originals

- Use a visible `Weship/Memories` and `Weship/Goodies` folder in each uploader’s account. Drive is the primary original-binary store, not the app database.
- Request the narrow `drive.file` scope so the app works only with files it creates/opens, rather than broad access to the user's Drive.
- Use resumable uploads for mobile photos/videos because Google recommends them for larger files and unreliable networks.
- Store Drive file IDs, owner, checksum, upload state, and Weship metadata in the backend. The implemented client uploads directly to a resumable session, so original bytes do not transit or persist in Supabase Storage.
- Ownership is explicitly per uploader: each partner connects their own Google account and uses their own quota. Never imply that Drive file ownership grants Weship Space membership.
- Do not make Drive the only copy of relationship metadata. If the owner deletes a file, loses storage, or disconnects Google, Weship must show the item as unavailable and preserve its caption/date/history.
- Drive is not a media CDN. Weship therefore uses small signed previews in grids and fetches an original only when a pair member opens it. This keeps storage cost low, but original playback still consumes Google and Edge Function bandwidth.

Current implementation: `google-drive-media` starts/completes/discards uploads and performs uploader-only deletion from Drive plus Weship; `google-drive-media-content` enforces pair access and streams ready originals. Images upload on web/iOS/Android; video thumbnail generation/upload currently requires iOS or Android. Runtime testing still needs deployed functions and two connected accounts. — [codex · done-unverified]

Official references: [Drive uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [Google OAuth scopes](https://developers.google.com/identity/protocols/oauth2/scopes#drive).

## Google Calendar — timeline and shared dates

- Calendar stores events, not photo binaries. Photos can live in Drive and be linked/attached to an event.
- Create a dedicated Weship calendar or let the user choose one; save the provider event ID and ETag beside the local timeline event.
- Start with one-way “Add to Google Calendar.” Add two-way sync only with conflict policy, deletion rules, timezone handling, and webhook/polling strategy.
- Request the narrowest event scope that supports the final flow and prepare the OAuth consent screen/privacy disclosures.
- Import only calendars/events the user explicitly chooses. A private work calendar should never become visible to a partner because an account was connected.
- Persist Google's sync token and use incremental synchronization; deduplicate by provider event ID and define which side wins when both Google and Weship edit an event.

Official references: [Create Calendar events and Drive attachments](https://developers.google.com/workspace/calendar/api/guides/create-events), [Calendar event resource](https://developers.google.com/workspace/calendar/api/v3/reference/events).

## Spotify — music connection

- Recommended first release: connect account, search/share a track into Goodies, open it in Spotify, and create/update a private couple playlist.
- Use Authorization Code with PKCE on mobile; never embed a Spotify client secret in the app.
- Ask only for the scopes used by the chosen feature, such as playlist modification or current playback. Full in-app playback/control is a separate, more restricted product decision.
- Follow Spotify attribution, caching, rate-limit, redirect-URI, and developer-mode/extended-quota rules.
- “Currently listening” is near-real-time, not guaranteed live: show the track plus a “checked recently” timestamp. Continuous per-user polling is expensive and rate-limit prone.
- “Listen too” should open or remote-control Spotify on the second partner's device. It should not promise perfectly synchronized group playback; on-demand Web API playback requires Premium and commercial streaming integrations face additional policy limits.
- Spotify's 2026 Development Mode is limited to five authorized users and requires the app owner to have Premium. It is suitable for prototypes, not a scalable launch; production access must be resolved before making Spotify a core feature.

## Interactive partner widgets

- Widgets can send small actions—heart, answer A/B, roll dice, make one turn, mark a task—and then reload from backend state.
- A turn-based game is sustainable: store the game on the backend, validate each move, notify the partner, and refresh both widgets.
- A full chess interface is not a good widget experience. Show the board/whose turn and deep-link into the app for selecting a move; reserve direct widget actions for simpler games with one obvious choice.
- Widgets are system-rendered surfaces, not always-running mini apps. iOS supports buttons/toggles through App Intents; Android supports interaction-driven updates but restricts background work and periodic refreshes. Remote changes therefore arrive through push/cache refresh and may not be instantaneous.

Official references: [Spotify PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), [Spotify scopes](https://developer.spotify.com/documentation/web-api/concepts/scopes), [Spotify Web API](https://developer.spotify.com/documentation/web-api).

## Mobile OAuth shape

- Launch provider consent in the system browser with Expo AuthSession/deep linking.
- Register the `weship://` redirect scheme for native builds and provider-approved HTTPS redirects where required.
- Keep long-lived refresh tokens encrypted on the backend; use short-lived access tokens and a revocation/disconnect endpoint.
- A user must be able to see connection state, reconnect, disconnect, and request deletion of provider-derived data.

Official reference: [Expo AuthSession (SDK 57)](https://docs.expo.dev/versions/v57.0.0/sdk/auth-session/).
