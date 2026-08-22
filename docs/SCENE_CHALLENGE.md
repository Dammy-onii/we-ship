# Scene Challenge ("Our Take")

An in-camera game: you record a short video of yourself while themed scenarios appear one at a time, and you rank each by tapping a number (1–n) on the side. The finished take shows your reactions plus your ranking, to send and compare with your partner.

"Scene" = the scenarios that appear. No "filter" language. The word "ritual" is not used anywhere in the product.

## How it plays

1. Play → **Our Take** opens the **pack picker** ([app/play/scenes.tsx](../app/play/scenes.tsx)).
2. Picking a pack opens the recorder ([app/play/scene.tsx](../app/play/scene.tsx)) with `?pack=<id>`.
3. Camera + mic permission is requested (a gate screen explains why).
4. The camera opens without recording so the user can frame the shot and toggle front/back; tapping Start begins capture.
5. Scenarios slide in; each tap on 1–n assigns that rank and advances.
6. When the list is full, recording stops and the take is saved, then the result screen opens.
7. Result ([app/play/scene-result.tsx](../app/play/scene-result.tsx)) plays the captured clip back with the ranking drawn over it.

## Scene packs

Defined in [lib/scenes.ts](../lib/scenes.ts) as `SCENE_PACKS`. Currently four: *Date Night Draft*, *Where To Next*, *The Little Things*, *Someday, Us*. Adding a pack is data-only — append a `{ id, theme, prompt, scenarios[] }`.

## Data model — the recorder→result seam

[lib/scene-take.ts](../lib/scene-take.ts) holds the most recent `SceneTake` in a module singleton (not router params, so the video URI and timing array survive intact):

```ts
SceneTake {
  packId: string
  videoUri?: string          // local file URI of the real capture
  durationMs: number
  entries: { scenarioId, rank, atMs }[]   // atMs = ms from recording start
  simulated: boolean         // true when no real capture (web / no camera)
  createdAt: string
}
```

The **timestamped `entries`** are deliberate: they let the result overlay sync to the video and, later, let a native compositor burn the overlay in at the right moments.

## Status — two stages

### ✅ Stage 1 — real capture + overlay-on-replay (done)
- `expo-camera` `CameraView` records actual video with the ranking overlay on top.
- Capture targets 1080p at 10 Mbps with automatic stabilization, and the visual legibility wash is intentionally light so it does not unnecessarily degrade the preview.
- Front/back selection is available while framing and locked after capture starts because changing the lens stops an active Expo Camera recording.
- Permission gate; graceful web/no-camera fallback (`simulated: true`, ranking-only).
- `expo-video` plays the clip back on the result screen with the ranking over it.
- Ranking stored with timestamps.
- **Only verifiable on a device dev build** — `expo-camera` does not record on web or in Expo Go.

### 🚫 Stage 2 — burned-in export (deferred, not a current task)
Permanently compositing the ranking **into** the exported video file was considered but **dropped for
now** (decision 2026-08-21). Stage 1 is a complete, usable feature on its own — the ranking shows over
the clip inside the app; it just isn't burned into the raw file for sharing elsewhere.

If it's ever revisited: it needs a native module (iOS AVFoundation, Android MediaCodec/OpenGL), because
`ffmpeg-kit-react-native` was retired in 2025. `scene-take.ts`'s `videoUri` + timestamped `entries`
already carry everything a compositor would need. **Not tracked as an open task** — don't re-file it as
a gap.

### 🔭 Later — live two-person compare
Currently the result shows **your** ranking only. Comparing both partners' takes side by side needs the partner to record their own and live sync to exchange takes. The earlier fabricated "matched X of 5" (derived from your own list) was **removed**.

## Files
- [app/play/scenes.tsx](../app/play/scenes.tsx) — pack picker
- [app/play/scene.tsx](../app/play/scene.tsx) — recorder (camera + overlay)
- [app/play/scene-result.tsx](../app/play/scene-result.tsx) — playback + ranking
- [lib/scenes.ts](../lib/scenes.ts) — pack data
- [lib/scene-take.ts](../lib/scene-take.ts) — take singleton + `rankedOrder`
- `app.json` — `expo-camera` plugin (permission strings)
