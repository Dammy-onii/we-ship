# Screens & Navigation

## Navigation model

**Three bottom tabs. Always three.** A left-edge swipe opens a secondary drawer. Horizontal swipes that begin outside that edge switch between Home, Play, and Us. Profile and notification actions stay fixed while tab content scrolls and remain available in standard secondary-screen headers.

```
┌─────────────────────────────────────┐
│  (avatar)        Weship        (bell)│   ← pinned profile · title · notifications
│                                      │
│            screen content            │
│                                      │
├──────────────────────────────────────┤
│     🌿 Home     ✿ Play     👥 Us      │   ← 3 tabs
└─────────────────────────────────────┘

left-edge swipe → profile · Home · Goodies · 2do · Widgets · Memories · hold-to-record mic
```

Home and Play keep the quiet nature symbols; Us uses a clear two-person icon.

---

## Tab 1 — Home  (`app/(tabs)/index.tsx`)

The living dashboard. Everything at a glance, nothing to dig for.

- **Header:** pinned avatar (→ profile/settings), title, and nudge bell.
- **Presence banner:** partner's mood, status line, local time, and weather. Big, warm, top of screen.
- **Streak:** a small unboxed day counter with plain language.
- **2do overview:** check the next three shared tasks directly; See All opens the complete list.
- **Today's Question teaser:** the prompt + "answer" CTA (→ Play).

## Tab 2 — Play  (`app/(tabs)/play.tsx`)

- **Pick together** — a full-width, unboxed private two-person choice with live wait/reveal/new-round states and an entry point to its shared future-round queue. — [codex · done-unverified]
- **Daily Question** — answer / reveal / react; set today’s prompt directly before either answer, or manage future prompts in the pair’s queue. — [codex · done-unverified]
- **Featured carousel** — a full-width shelf below the question, led by **Our Take** and followed by the top quick games.
- **Casual games** — a shelf of quick games (would-you-rather, truth-or-dare, more).

Sub-screens (pushed, not tabs):
- `play/question` — today's question, direct unanswered-prompt setter, answer state, and archive items
- `play/questions` — add and remove unused pair-authored prompts from the shared daily queue
- `play/picks` — add and remove unused Pick Together prompts with 2–5 choices; changes update for both partners
- `play/scenes` — scene pack picker (4 packs)
- `play/scene` — Our Take recorder; frame first, select front/back camera, then record a quality-targeted stabilized clip with a live ranking overlay
- `play/scene-result` — playback of the captured clip with the ranking and a native save-video-to-phone action (no live partner compare yet) — [codex · done-unverified]
- `play/game/[id]` — a specific casual game

## Tab 3 — Us  (`app/(tabs)/us.tsx`)

The shared relationship overview.

- **Moments** — visible photo/video shelf linking to Memories.
- **Updates** — streak first, followed by calendar, memory, 2do, and Goodies summaries.
- **Notes** — the shared notes board.

Sub-screens:
- `us/moment/[id]` — a single photo/video
- `us/notes` — full notes board
- `todo` — the drawer-level **2do** list: add-task controls first, followed by full-width tasks, partner state, routines, and note requirements

---

## Sidebar drawer

- **Profile header** — unboxed profile picture and username; opens the profile preview.
- **Spotlight empty states** — both Spotlights show a drawn landscape plus a labelled sample note card rather than an icon, so the surface reads as "this is where pictures and notes go" instead of "no data". Composed from gradients and views, not a bundled bitmap. See [components/empty-spotlight.tsx](../components/empty-spotlight.tsx).

- **Goodies** (`goodies`) — daily media/note/reminder feed plus a single-page composer for every supported send type. A destination selector at the top switches between **Us** and **Friends**; choosing Friends opens the friend board's own composer, so the Quick send widget's three tiles can reach either audience without the widget growing to six. `?to=friends` seeds the selector. Photo and video actions offer full-quality system-camera capture or a single item from the device library; recorded videos include sound. Partner photo/video sharing requires the uploader's Google Drive connection and accepts one media item at a time; its optional message remains visible after sharing. Spotlight note cards size their preview from the rendered column width and system text scale, keeping the author and reactions visible at narrow widths.
- **Capture** — centered mic in the drawer’s bottom area, directly above the Weship mark; tap opens Goodies in voice mode and long press starts recording after navigation.
- **2do** (`todo`) — every shared task with each partner's completion state, recurrence, and note requirement; users can add and delete tasks. Below current and completed work, **Missed periods** names who left a closed interval incomplete and shows the exact date or range. The section remains visible with a zero-state so historical tracking is discoverable.
- **Widgets** (`widgets`) — a compact catalogue with full layout previews for Us, Friends, Presence, Quick send and 2do, concise behavior notes, and an Add control per widget.
- **Memories** (`memories`) — collapsible editable timeline with a native date picker, followed by the moments gallery.

Profile sub-screens now provide live data entry points: **Account** (`account`), **Shared Space** (`pairing`), **Connections** (`connections`), **Calendar** (`calendar`), and **Notification settings** (`notification-settings`). Memories and photo/video Goodies upload originals to the uploader’s Drive and previews to Supabase. The shared `media` route opens a ready original through authenticated pair-scoped delivery. — [codex · done-unverified]

## Authentication and pairing (pre-tabs in connected mode)

Configured builds show the email/password or magic-link Auth gate, then direct unpaired accounts to Shared Space to create or join by code. Creating keeps the owner on the invite screen; successfully joining/linking replaces that route with Home. Unconfigured builds remain a seeded local demo. — [codex · done-unverified]

---

## Screen inventory (build checklist mirror)

| Screen | Route | v1 |
| --- | --- | --- |
| Home dashboard | `(tabs)/index` | ✅ |
| Play hub | `(tabs)/play` | ✅ |
| Us hub | `(tabs)/us` | ✅ |
| Goodies | `goodies` | ✅ (local media/audio) |
| Partner notifications | `notifications` | ✅ (local activity feed) |
| Question detail/archive | `play/question` | ✅ |
| Shared question queue | `play/questions` | ✅ live code; two-account validation pending — [codex · done-unverified] |
| Pick Together queue | `play/picks` | ✅ live code + Realtime; two-account validation pending — [codex · done-unverified] |
| Scene pack picker | `play/scenes` | ✅ (4 packs) |
| Our Take recorder | `play/scene` | ✅ real camera capture + overlay |
| Scene result | `play/scene-result` | ✅ playback + ranking + save source video; live compare pending — [codex · done-unverified] |
| Casual game | `play/game/[id]` | ✅ 2 live (wyr, tod); 2 inactive "coming soon" |
| Notes board | `us/notes` | ✅ |
| 2do shared tasks | `todo` | ✅ |
| Memories | `memories` | ✅ |
| Drive original viewer | `media` | ✅ code; deployment/device validation pending — [codex · done-unverified] |
| Moment detail | `us/moment/[id]` | 🔜 |
| Profile | `modal` | ✅ (full-width layout) |
| Settings | `settings` | 🔜 |
| Widget Studio | `widgets` | ✅ native iOS + Android catalogue, full layout previews, install controls, and platform-accurate 2do behavior |
| Account | `account` | ✅ live |
| Shared Space pairing | `pairing` | ✅ live |
| Google/Drive connections | `connections` | ✅ configured; connected-account validation pending |
| Calendar import/create | `calendar` | ✅ configured; connected-account validation pending |
| Unpaired state | Home, Us, Us Spotlight | ✅ code; skip verified in source, not on device |
| Notification settings | `notification-settings` | ✅ code; device credentials pending |
| Friends | `friends` | ✅ live graph, board, username search, and requests. People are added by username; there is no contact matching |
| Friend profile | `friend/[id]` | ✅ code; device validation pending — who they are, whether they are paired, their gender, and their posts |
| Google OAuth return | `connections/google` | ✅ redirects to Connections |
| Auth gate | root provider | ✅ live |

## First-run permissions
