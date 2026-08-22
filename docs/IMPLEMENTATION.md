# Implementation Guide

## Module map

- `app/_layout.tsx` — providers, theme, system surfaces, and root drawer.
- `app/(tabs)/_layout.tsx` — three-tab navigation and horizontal swipe behavior.
- `app/(tabs)/*` — Home, Play, and Us hubs.
- `app/play/question.tsx` + `app/play/questions.tsx` — direct current-day question selection, answer/reveal/archive, and the future custom-question queue.
- `app/play/picks.tsx` + `lib/backend/games.ts` — pair-authored Pick Together queue, private round state, and Realtime refresh.
- `app/goodies.tsx` — same-day composer/feed and device media/audio integration.
- `app/notifications.tsx` — derived chronological feed of partner-authored activity.
- `app/memories.tsx` — gallery, collapsible timeline, event CRUD, and native date picker.
- `app/media.tsx` — authenticated original photo/video viewer.
- `app/todo.tsx` + `app/us/log.tsx` — drawer-level 2do route and task implementation.
- `components/ui/*` — reusable visual primitives, including `DataState` for consistent loading/empty/error surfaces.
- `lib/types.ts` — stable domain contracts.
- `lib/store.tsx` — mutations and selector hooks.
- `lib/auth.tsx` — Supabase session lifecycle and native deep-link consumption.
- `lib/media.ts` — compact preview generation and direct original upload.
- `lib/backend/*` — environment guard, Supabase client, live repository, Drive session/original helpers, Google service calls, and game RPC client.
- `lib/mock/seed.ts` — deterministic prototype content.
- `supabase/migrations/*` — production schema, RLS, Storage, RPCs, triggers, Realtime, and private state.
- `supabase/functions/*` — Google OAuth/Calendar, Drive session/finalization/content proxy, and Expo push delivery.
- `widgets/*` + `modules/weship-todo-widget/*` — iOS and Android top-incomplete-2do widgets.

## Current native capabilities

- `expo-audio` records up to two-minute Goodies voice notes with metering enabled and plays recorded files. Playback resets completed audio before replay and disables recording mode first. The seeded partner voice note uses Expo's public documentation audio sample so its play control is testable before any user recording exists.
- `react-native-gesture-handler` recognizes horizontal tab swipes while leaving the left edge available to the drawer and allowing child native scrollers to arbitrate their own gestures.
- `expo-image-picker` selects profile, Memory, and Goodie photos/videos; `expo-image-manipulator` creates compact JPEG previews, `expo-video` creates native video thumbnails, and modern `expo-file-system` reads native picker/cache URIs and streams originals to Drive without browser-style `fetch(fileUri)`. — [codex · done-unverified]
- `expo-media-library` requests write-only video access at the user’s save action and adds the captured Our Take source clip to the phone library. It is a native module, so existing development/release binaries need one rebuild. — [codex · done-unverified]
- `expo-camera` now opens Our Take in a framing state instead of recording immediately. The user can select front/back before capture; recording targets 1080p at 10 Mbps with automatic stabilization. Lens switching remains disabled during an active recording because switching stops the current Expo Camera clip. — [codex · done-unverified]
- `@react-native-community/datetimepicker` supplies the platform date UI for timeline events.
- Config-plugin changes require rebuilding a development/production binary; an already-installed binary does not gain new native modules through JavaScript refresh alone.
- `expo-widgets` supplies the real iOS widget. Android uses the checked-in local Expo module because SDK 57's Android implementation currently renders only a placeholder.
- Auth/live mode activates only when valid public Supabase values exist. Missing configuration intentionally leaves the existing demo usable.

## Implementation rules

1. Put business mutations in the store, not screens.
2. Keep all text inputs keyboard-safe, 16px minimum, theme-aware, and reachable above the keyboard.
3. Use native permissions only at the point of intent and handle denial without dead ends.
4. Treat picker/cache URIs as temporary. Persist only the compact preview in Supabase and the original in the uploader’s Drive.
5. Keep provider tokens out of source, app config, logs, and client-visible databases.
6. Update `FEATURES.md`, `SCREENS.md`, and the relevant implementation doc with every material feature change.
7. Never expose a service-role key, provider secret, refresh token, or OAuth encryption key through `EXPO_PUBLIC_*`.
8. Never upload a new photo/video original to Supabase first. Start a user-bound Drive resumable session, upload directly, validate the Drive markers server-side, and atomically commit metadata.
9. On ambiguous finalization, preserve the original/preview unless the server confirms the uncommitted Drive file was deleted.
10. Security-definer functions must revoke default `PUBLIC`/`anon` execution and grant only the minimum authenticated or service role explicitly. — [codex · done-unverified]
11. Never infer partner activity from placeholder copy. Current-question labels must read the current question’s mapped answer rows, and live mode must finish hydration before rendering demo-backed screens. — [codex · done-unverified]

## Quality gates

Run before handoff:

```bash
npm run lint
npx tsc --noEmit
npx expo-doctor
npx expo export --platform web
npx expo export --platform android
npx expo export --platform ios
git diff --check
```

Also test microphone denial/approval, drawer long-press auto-start, recording metering, record/send/replay, photo-library denial/approval, image/video preview generation, upload interruption/retry, owner and partner original playback, owner Google disconnect/deleted-file behavior, Android keyboard resize, iOS keyboard avoidance, date selection, drawer-edge gestures, tab swipes, child carousels, notification routes, and status/navigation bars on real devices.

## Known dependency audit note

As of 2026-08-21, `npm audit --omit=dev` reports 16 transitive findings (8 moderate, 8 high) for `image-size` and `uuid` inside Expo/Metro tooling paths. npm's forced suggestions make breaking/incompatible Expo changes, including an SDK 53 downgrade, so they were not applied. Track the upstream Expo/Metro patch and upgrade through Expo's supported package set instead. — [codex · verified]
