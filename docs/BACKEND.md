# Backend Plan

The Supabase foundation is checked in. Without environment values the app intentionally uses its demo store; with them it switches to authenticated live data.

## Implemented platform: Supabase

Best fit for an Expo app that needs realtime presence, media, and push.

- **Postgres + Row-Level Security** → clean model for private couple Spaces and friend access. RLS enforces "only the two members can read a Space."
- **Realtime subscriptions** → presence, mood, live widget updates, nudges.
- **Storage** → small private media previews, voice notes, avatars, and legacy media with signed URLs. New Memory and photo/video Goodie originals live in the uploader’s Drive.
- **Auth** built in (email, OTP, Apple/Google), works smoothly with Expo.
- Generous free tier; predictable SQL scaling; you self-serve.

### Alternatives
- **Firebase** — easiest realtime + push, but NoSQL modeling gets awkward for the relationship/friend graph and costs are less predictable.
- **Convex** — excellent modern reactive backend, great Expo DX; smaller ecosystem, less raw-data control.

## Also required (regardless of backend)

- **Expo Push Notifications** — nudges, "partner answered," milestone reminders.
- **Native home-screen widgets** — *not* pure JS. iOS needs **WidgetKit** (SwiftUI); Android needs **App Widgets**. Wire in via an Expo **config plugin + custom dev build**. This is the one thing that forces us off managed Expo — plan for it early. The widget reads a shared app group / data store the app writes to.
- **Media pipeline** — client-side compact previews, direct resumable Drive uploads for originals, and authenticated range-capable original delivery. Drive is not a CDN, so the app grid must remain preview-first.
- **Camera & recording** — `expo-camera` for Our Take scene packs (record + overlay); server or on-device compose for the baked-in result.

## Runtime path from the demo store

Screens depend only on the **store hooks**, never on mock files. To go live:
1. `.env.local` absent: hooks use the deterministic demo.
2. Supabase configured: `AuthGate` requires a session and `lib/backend/repository.ts` hydrates the same hook signatures.
3. Optimistic writes persist, then reconcile through refresh or Realtime.
4. `create_pair_space`/`join_pair_space` handle pairing atomically; Space tables and Storage paths use membership RLS.

## Checked-in schema

Ten deployed migrations in `supabase/migrations/` define profiles, Spaces/members/invites, tasks/completions, Goodies, Memories/media, timelines, notes/presence/streaks/nudges, built-in and pair-authored questions/answers, widgets, push tokens, activities/notifications, provider connections/private tokens, Calendar sources, game catalog/sessions/moves/private choices, future Pick Together prompts, preview buckets, Realtime, RPCs, and triggers. `202608210001_drive_primary_media.sql` adds Drive ownership metadata and service-only atomic finalizers; `202608210002_play_and_question_entry.sql` adds the daily-question queue/materializer and repairs Pick Together rounds; `202608210003_fix_space_invite_generation.sql` repairs invite generation; `202608210004_set_daily_question.sql` adds safe direct question selection; and `202608210005_pick_together_queue.sql` adds pair-authored future rounds with atomic FIFO consumption. — [codex · done-unverified]

External OAuth refresh tokens must be encrypted server-side and must never be embedded in the Expo client. See [INTEGRATIONS.md](./INTEGRATIONS.md).

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for deployment and required values.
