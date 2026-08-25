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
- **v1/live:** ✅ Drawer route, seeded day feed, live note/reminder/voice persistence, single-item device photo/video selection, Drive-primary photo/video originals, private compact previews, microphone recording with a voice-reactive meter, and replay-safe voice playback. Media captions remain visible on Spotlight cards and in the full-screen viewer. A live user must connect Google Drive before choosing or sending partner media. Native picker files are read through Expo FileSystem, not web-style URI fetching. The drawer mic opens the composer on tap and begins recording after a long press. — [codex · done-unverified]

---

## 2. Widget

- **What:** Five widgets — Us, Friends, Presence, Quick send, and 2do.
- **Us / Friends:** A full-bleed slideshow of one shared item at a time — photo, video frame or note — with the source, position, author and any ★ favourite in a scrim along the bottom. Both decks carry **every** eligible item, up to a 40-slide cap that exists only to bound disk caching; Friends is the whole board newest-first, your own posts included, rather than one post per person. Video frames are pulled from the cached file with `MediaMetadataRetriever`, since a video has no separate poster and `BitmapFactory` cannot decode one. Notes are drawn on ruled paper with a margin rule, their line height matched in dp to the rule pitch. Android uses a flat `AdapterViewFlipper`; iOS uses a SwiftUI `ZStack`. Both expose ‹ › controls because neither platform permits a custom horizontal drag gesture in this widget surface. Images are fill-cropped and clipped to the widget outline, so no second card appears behind them. Tapping a slide opens that exact item in the matching Spotlight — Us goes to the shared gallery, Friends to the friend board — rather than the top of the list.
- **2do:** About four comfortably padded shared tasks are visible at the normal Android size, with a done/total count and a native scrolling list for everything else. The list is styled as a pad: each row carries its own bottom rule so the rules scroll with the content, while the margin rule sits on the fixed list container. The in-app catalogue uses the same header, row hierarchy and spacing as the native layout. Tapping a circle ticks that task off in place; a task that requires a completion note opens the app instead, since a widget cannot ask for text. Android keeps an optimistic tick while its completion is queued, removes the queue item only after replay succeeds, and reconciles the result with the next app snapshot. iOS shows three rows in Small and four in Medium, then opens the full list when tapped because WidgetKit home-screen widgets do not scroll.
- **Presence:** A compact relationship dashboard with a mood badge, current status panel, streak pill, their time or latest exchange, and the next shared 2do. The status panel hugs its text; an empty spacer below it owns the flexible middle space, so a one-word mood is not stranded in the centre of a large box while the footer still sits at the bottom. Size-based hiding is measured against `OPTION_APPWIDGET_MIN_HEIGHT`, which reports the host's guaranteed *floor* rather than the height actually granted — a two-cell widget reports ~110dp while occupying far more — so the thresholds are set low enough to trip only on a genuinely single-cell widget. When there is no open 2do, daily-question progress fills the second detail slot.
- **Quick send:** Three distinct, color-coded photo, voice and note tiles with native icons and direct composer links. Width and height are read separately: tile width decides whether a caption and then its hint survive, height decides whether the header does, and the icon and tile box scale with the space available (API 31+) rather than stretching to fill a tall widget. Small iOS uses one larger camera action because that family only supports one reliable app-opening region.
- **Platforms:** ✅ iOS TypeScript/SwiftUI widgets through `expo-widgets`; ✅ Android `AppWidgetProvider`s plus two `RemoteViewsService`s through the local Expo module. Both require a custom development/release build.
- **Appearance:** Locked to the light palette on both platforms, copied by hand from `Palette.light` into `widgets/shared.ts` and `res/values/colors.xml`.
- **Empty states:** With nothing shared, the adapter substitutes **two placeholder slides** — a landscape on one, a labelled example note on the other — so an empty carousel is still a carousel, the arrows still work, and the widget demonstrates both kinds of thing it carries. The `setEmptyView` layout is therefore never normally seen; it survives only as the pre-bind fallback. The landscape is a vector, so it costs nothing across the Binder and stays sharp; `centerCrop` keeps the sun round at any widget aspect.

- **Picker previews:** Every provider declares one matching `previewLayout`, and each preview layout is written out in full rather than `<include>`-ing the runtime layout, because an `<include>` does not survive the picker's cross-process resource lookup and resolved to the wrong provider's art. No provider declares a `previewImage`. Runtime-generated previews are deliberately not persisted: some launchers cache their resource IDs across an app update and then show one provider's layout under another provider's name. The code-based visual reference is [widget-gallery.png](./images/widget-gallery.png).

### In-app alert sound
- **What:** A toast that arrives while the app is open plays a sound, because the OS only sounds notifications delivered to a backgrounded app.
- **Android:** Plays the sound selected for Weship's `weship-updates-v4` notification channel (falling back to the phone default before Android 8), so in-app and system alerts match and obey notification volume, silent mode and Do Not Disturb.
- **iOS:** The system tone for an incoming message. iOS gives an app no way to read the user's chosen notification sound outside a delivered notification, so this is the closest real system sound.
- **No bundled audio.** Both paths play a sound the phone already makes. Nothing is shipped with the app; an in-app alert should never introduce a noise the device does not otherwise produce.
- **Where neither exists** — web, Expo Go — the toast is silent.
- **Diagnostics:** Notification settings can play the in-app tone and schedule a local system notification. Before scheduling on Android, the app now reads the real installed `weship-updates-v4` channel and reports whether the user or OS has muted it or lowered its importance.
- **Android sound choice:** Notification settings opens Android's own Weship channel screen, where the user can choose any notification sound installed on that phone. Android owns this choice after channel creation; Weship does not replace it silently.

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
- **Features:** full-width task rows, an explicit completion checkbox, per-person status, shared progress, add/delete controls, daily/weekly/monthly routines, and a per-task completion-note requirement. A permanent **Missed periods** section records unfinished closed intervals with exact daily dates, weekly date ranges, or month/year labels; it shows an explicit empty state when nothing has been missed. The next three tasks can also be checked directly from Home; See All opens the complete list.
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
- **Rule:** Never mixed into the couple Space; friend posts use their own private Supabase media path and never depend on the pair-scoped Google Drive pipeline.
- **v1:** ✅ Friend discovery/requests, profiles, board posts, reactions, comments, and photo/video/voice sharing are implemented. Each friend post accepts exactly one photo or one video; friend photo posts keep compact copies in private storage, while friend video and voice posts keep their media there. — [codex · done-unverified]

---

## 7. Onboarding & pairing

- **What:** Sign up, create profile, pair with partner via code/link, set mode + anniversary + timezone.
- **Current:** ✅ Email/password and magic-link account gate, profile photo/name/timezone, create/join invite-code pairing, Home navigation immediately after a successful partner link, sign out, and demo fallback when Supabase is not configured. — [codex · done-unverified]

## 8. Drive-primary media

- **What:** A user chooses a Memory or photo/video Goodie; its original is stored in that uploader’s own Google Drive by default.
- **Ownership:** Drive holds the only new original binary on the uploader’s quota. Supabase holds pair metadata, the Drive file/owner IDs, upload state, and a private JPEG preview capped at 2 MB.
- **Delivery:** The uploader and partner see preview grids. Opening an item streams the original through a pair-authorized Edge Function with range support for video; neither device receives a Google token.
- **Current:** ✅ client preview generation, direct resumable original upload, atomic finalization, safe cleanup, Goodies/Memories UI, original viewer, and uploader-only deletion from Drive plus Weship are implemented, with the backend deployed. Two-device photo/video testing remains. — [codex · done-unverified]
- **Friend-post lifetime:** A friend-board post lives **two days**, then disappears from the board, the Spotlight, the widget and the database alike. The read policy on `friend_posts` hides a row the moment it passes the cutoff, so expiry is a rule rather than a cleanup job; the scheduled `dispatch-reminders` function then deletes the rows and their storage objects, and the device prunes its cached copies on the same clock. The lifetime is defined once in [lib/friend-post-ttl.ts](../lib/friend-post-ttl.ts) and mirrored by `public.friend_post_ttl()` and the dispatcher — all three change together.

- **Connection requirement:** In a live account, photo/video composers explain and enforce that the uploader must connect Google Drive before sharing. Notes, reminders, voice notes, and friend-board posts do not use this Drive path.
