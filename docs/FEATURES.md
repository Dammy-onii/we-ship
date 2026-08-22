# Features

Every feature, grouped by area. Each has a one-line **what**, the **why** (closeness/retention), and **v1 scope** (what the standalone build includes).

Legend for v1 scope: ✅ in standalone v1 · 🔜 next phase · 🧊 later

---

## 1. Shared Space (the couple core)

### Presence
- **What:** Partner's current mood, status, local time, and (long-distance) weather at a glance.
- **Why:** The single most important "feel close" signal. Anchors the Home screen.
- **v1:** ✅ Mood + status + local time card with mock partner data.

### Notes board
- **What:** Small notes/love notes/reminders either partner can post to a shared board.
- **Why:** Lightweight, async affection. Not a chat — a fridge covered in sticky notes.
- **v1:** ✅ View + add notes (local state).

### Photos & videos
- **What:** A private shared gallery/timeline of moments.
- **Why:** A co-owned album is a proven retention driver.
- **Live path:** ✅ The device makes a small preview for the private in-app grid and sends the original directly to the uploader’s Google Drive. Tapping a ready item opens the original through a pair-authorized stream; Google tokens stay server-side. — [codex · done-unverified]

### Goodies
- **What:** A same-day inbox and composer for partner-sent photos, videos, voice notes, notes, and reminders.
- **Why:** Makes affection and practical care feel immediate without turning Weship into a chat app.
- **v1/live:** ✅ Drawer route, seeded day feed, live note/reminder/voice persistence, device photo/video selection, Drive-primary photo/video originals, private compact previews, microphone recording with a voice-reactive meter, and replay-safe voice playback. Native picker files are read through Expo FileSystem, not web-style URI fetching. The drawer mic opens the composer on tap and begins recording after a long press. — [codex · done-unverified]

---

## 2. Widget

- **What:** One focused home-screen widget showing only the user's top incomplete shared 2do.
- **Behavior:** Completing the item promotes the next incomplete task. Tapping opens 2do. No auth token is copied to widget storage.
- **Platforms:** ✅ iOS TypeScript/SwiftUI widget through `expo-widgets`; ✅ Android `AppWidgetProvider` through the local Expo module. Both require a custom development/release build.
- **Appearance:** Neutral, system-aware light/dark surfaces rather than the old green-tinted rotation.

---

## 3. Play Together

### Daily Question
- **What:** One prompt a day; answers reveal once both respond.
- **Why:** A daily reason to open; sparks real conversation.
- **v1/live:** ✅ Answer, reveal-on-both, archive, a shared add/delete queue, and a direct “set today’s question” field available until either partner answers. In live mode the server safely creates one question for the pair's local day, and partner-answer states come only from that question’s answer rows. — [codex · done-unverified]

### Our Take
- **What:** A flexible set of interactive, in-camera scene packs for couples. A pack can ask partners to rank choices, react, choose sides, tell a short story, or complete another scene-based prompt while recording. The current **Date Night Draft** pack ranks five date ideas and compares both partners’ order.
- **Why:** One clear game identity can hold many changing scenes and mechanics without making the whole feature sound like a single ranking exercise.
- **Current:** ✅ Four scene packs, real `expo-camera` capture, an explicit framing/start step, front/back camera selection before capture, 1080p quality targeting, a high video bitrate, automatic stabilization, a lighter legibility overlay, live ranking, overlay-on-replay, and saving the captured source video to the phone’s media library. True partner-side comparison and burned-in export are not implemented. Physical-device quality validation remains. — [codex · done-unverified]

### Casual games
- **What:** Rotating quick 2-player games — would-you-rather, truth-or-dare deck, drawing/guessing, photo memory-match, tap-battles.
- **Why:** Variety so play never gets stale; low effort, high delight.
- **v1:** ✅ Full-width featured carousel for Our Take, Would You Rather, and Truth or Dare. The latter two have playable decks; others are clearly marked coming soon.

### Pick together
- **What:** Both partners privately choose a small shared activity, then reveal whether they matched.
- **Why:** It creates an immediate two-person interaction without making progress depend on a garden metaphor.
- **v1/live:** ✅ Full-width unboxed interaction with local demo fallback. Configured accounts use authenticated pair-scoped RPCs, private choices, partner-state polling, reveal only after both submit, retained results, and an explicit next round. Either partner can queue a custom prompt with 2–5 choices; the server atomically consumes the oldest unused prompt for the next round, and the queue updates through Realtime. — [codex · done-unverified]

---

## 4. 2do — Shared Tasks (retention engine)

- **What:** Keep meaningful relationship actions together—intentional check-ins, sharing a daily highlight, planning quality time, thoughtful gestures, saving favorite moments, and future custom tasks. Both partners see each other's completion state.
- **Why:** Lightweight shared accountability helps couples coordinate without turning the app into a project manager.
- **Features:** full-width task rows, an explicit completion checkbox, per-person status, shared progress, add/delete controls, daily/weekly/monthly routines, and a per-task completion-note requirement. The next three tasks can also be checked directly from Home; See All opens the complete list.
- **v1/live:** ✅ Seeded demo fallback plus live Supabase create/delete/completion, routine periods, partner state, Realtime sync, Home completion, and native widget promotion.

---

## 5. Streaks, updates & memories (glue)

- **Streaks:** a simple “day streak” count plus encouragement, with no relationship-duration or garden/bloom wording and no large streak card. — ✅ v1
- **Partner activity:** the high-contrast notification bell opens a chronological feed; database triggers create pair activity/notification rows and a signed webhook sends remote device push. — ✅ foundation; device credential/receipt validation pending — [codex · done-unverified]
- **"Thinking of you" nudges:** one-tap pings that reach the partner (and their widget). — 🔜 data action scaffolded; quick-send UI deferred during Phase 0 polish
- **On This Day:** resurfaces a past photo or answer. — ✅ v1 (mock)
- **Timeline events:** collapsible history with add/edit menu, native date picker, Google calendar selection/import, and create-in-Google-and-Weship entry point. — ✅ code and provider configuration; connected-account device validation pending

---

## 6. Friends layer (light, secondary)

- **What:** Add friends, see light status/mood, share select moments outside the couple Space.
- **Why:** Social breadth without compromising the private couple core.
- **Rule:** Never mixed into the couple Space; lives behind the avatar, not a main tab.
- **v1:** 🧊 Stubbed/hidden in standalone v1 (auth/pairing skipped). Designed in [DATA_MODEL.md](./DATA_MODEL.md) for later.

---

## 7. Onboarding & pairing

- **What:** Sign up, create profile, pair with partner via code/link, set mode + anniversary + timezone.
- **Current:** ✅ Email/password and magic-link account gate, profile photo/name/timezone, create/join invite-code pairing, Home navigation immediately after a successful partner link, sign out, and demo fallback when Supabase is not configured. — [codex · done-unverified]

## 8. Drive-primary media

- **What:** A user chooses a Memory or photo/video Goodie; its original is stored in that uploader’s own Google Drive by default.
- **Ownership:** Drive holds the only new original binary on the uploader’s quota. Supabase holds pair metadata, the Drive file/owner IDs, upload state, and a private JPEG preview capped at 2 MB.
- **Delivery:** The uploader and partner see preview grids. Opening an item streams the original through a pair-authorized Edge Function with range support for video; neither device receives a Google token.
- **Current:** ✅ client preview generation, direct resumable original upload, atomic finalization, safe cleanup, Goodies/Memories UI, original viewer, and uploader-only deletion from Drive plus Weship are implemented, with the backend deployed. Two-device photo/video testing remains. — [codex · done-unverified]
