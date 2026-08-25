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

## What the privacy model does and does not cover

Stated plainly, because the app's own wording has to match it.

**Protected.** Disk encryption at rest and TLS in transit, both from Supabase.
Row Level Security scopes every table to the pair or the friendship that owns
it, so no user can read another user's rows. Where a screen legitimately needs
a little more than RLS exposes — a friend's gender and whether they are paired,
for their profile page — it goes through a `SECURITY DEFINER` function
(`public.get_friend_profile`) that returns a fixed projection and only for
someone you are actually connected to, rather than by widening a table policy. Google OAuth access and refresh
tokens are additionally encrypted with AES-GCM before storage
(`supabase/functions/_shared/crypto.ts`) — a stolen refresh token is a live
credential to someone's whole Drive and Calendar. Contact identifiers are only
ever stored as salted hashes. Pair-scoped Goodie and Memory photo/video
originals live in the uploader's own Drive, with compact previews held here.
Friend-board media follows a separate private `friend-media` Supabase Storage
path: photos are compact copies, while video and voice files are stored there.

**Not protected.** User content — notes, Goodie captions, question answers,
moods, task titles — is stored as plaintext columns. The project owner can read
all of it from the Supabase dashboard, which authenticates as them and uses
service-role access that bypasses RLS by design. RLS protects users from each
other; it has never protected data from the operator.

This is the ordinary posture for a hosted app, but it is **not** end-to-end
encryption, and user-facing copy must not imply that it is. "Only the two of you
can see this" is a claim this architecture does not support; "no other Weship
member can see this" is one it does. Adopting E2EE later would mean giving up
content in push notifications, any server-side search, and any possibility of
content recovery — a product decision, not a patch.

Operationally, the practical control is the Supabase account itself: enable MFA
and keep dashboard access to as few people as possible.

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
