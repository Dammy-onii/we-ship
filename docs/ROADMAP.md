# Roadmap

Phased so each stage is independently testable. **Phase 0 is complete; the Phase 2/3 backend and native-surface foundation is implemented and deployed. Two-account, provider, push, and physical-device validation remain.** — [codex · done-unverified]

## Phase 0 — Standalone v1 (complete baseline)

> Goal: build and test every core screen with no auth and no pairing. App boots straight into a seeded Space.

- Design system + theme (calm/nature).
- Store + mock seed (same shapes a backend will fill later).
- Three tabs: Home, Play, Us, with horizontal swipe navigation.
- Left-edge drawer: profile identity, 2do, Widgets, Memories.
- Home dashboard (presence banner, simple streak, top-three 2do overview, question teaser).
- Play: interactive partner pick, daily question, full-width featured carousel, Our Take mock flow, and casual games.
- Us: shared moments, streak-first calendar/memory/task/Goodies updates, and notes.
- Goodies: local photo/video selection, metered voice recording/replay, notes, reminders, and daily feed.
- Notifications: recent local partner-activity feed from the bell.
- Memories: collapsible timeline, add/edit menu, and native date picker.
- 2do shared-task tracker with per-partner completion state.

**Explicitly skipped in Phase 0:** auth, pairing, real camera, real widgets, friends, network.

Those skips describe the original milestone. Auth, pairing, Supabase live data, native top-2do widgets, push foundations, and Google Calendar/Drive code have since been added while preserving Phase 0 as the unconfigured demo fallback.

## Phase 1 — Real device features (partially implemented)

- `expo-camera` recording for Our Take packs with live overlays is implemented; baked-result encoding is deferred.
- Device-library photos/videos now use Drive-primary live persistence rather than a local-only media library.
- Goodies media and timeline edits persist in configured Supabase mode; unconfigured demo writes still reset on reload.
- Local persistence (e.g. `expo-sqlite` / MMKV) so state survives restarts.
- Notifications scaffolding (`expo-notifications`) and token registration are implemented; remote credentials/webhook testing remains.

## Phase 2 — Backend + accounts (implemented and deployed; live validation pending)

- Supabase: schema, RLS, storage, realtime (see [BACKEND.md](./BACKEND.md)).
- Auth + onboarding + **pairing** (invite code/link) in front of the tabs.
- Real presence, real two-person sync.
- Secure media upload/delivery for Goodies and Memories.

## Phase 3 — Widgets & connected services (partially implemented)

- Custom dev build + config plugin.
- iOS WidgetKit + Android App Widget for the top incomplete shared 2do.
- Drive-primary user-owned originals, Google Calendar event sync, and Spotify linking after OAuth review.

## Phase 4 — Social & polish

- Friends layer.
- More casual games and Our Take scene packs with ranking, reactions, choices, and storytelling mechanics.
- Milestones/anniversaries, On This Day from real history.
- Onboarding polish, empty states, settings, privacy controls.

## Definition of done for Phase 0

- App runs on iOS/web via Expo with zero network calls.
- All three tabs and their v1 sub-screens are reachable and interactive.
- Answering the question, checking a 2do item, and making a Play choice all visibly update state.
- Looks calm and on-theme per [DESIGN.md](./DESIGN.md).
