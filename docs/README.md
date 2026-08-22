# Weship — Docs

> **Weship** is a calm, private space for two people to feel close — whether they share a home or a long-distance timezone. It layers a light social circle for friends on top of a couple-first core.

This folder describes what Weship is, how it is designed, and how it is built. It is
reference material, not a status log — running progress and bug registers are not kept here.

## Read in this order

| Doc | What it's for |
| --- | --- |
| [VISION.md](./VISION.md) | The idea, who it's for, the principles that guide every decision |
| [RESEARCH.md](./RESEARCH.md) | What similar apps do, what works, what we borrow / avoid |
| [FEATURES.md](./FEATURES.md) | Every feature, specced in detail |
| [SCREENS.md](./SCREENS.md) | Screen-by-screen breakdown and navigation |
| [DESIGN.md](./DESIGN.md) | The calm neutral design system (color, type, motion, components) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | App layers, data flow, navigation, and ownership boundaries |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | Practical engineering plan, module map, and quality gates |
| [INTEGRATIONS.md](./INTEGRATIONS.md) | Google Drive/Calendar and Spotify feasibility and OAuth plan |
| [DATA_MODEL.md](./DATA_MODEL.md) | Data shapes — designed so the mock layer can be swapped for a real backend |
| [BACKEND.md](./BACKEND.md) | Backend plan for when we leave standalone mode |
| [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) | Exact Supabase, Google, EAS, push, deployment, and secret checklist |
| [SCENE_CHALLENGE.md](./SCENE_CHALLENGE.md) | The "Our Take" camera game — mechanic, packs, data model, and its two build stages |
| [ROADMAP.md](./ROADMAP.md) | Phases, from standalone v1 to full app |

## The one-paragraph pitch

Two people pair into a shared **Space**. Inside it they exchange daily **Goodies**, answer a daily question, make small shared activity picks, play quick games and **Our Take** scene packs, keep up with meaningful relationship tasks in **2do**, and collect photos, notes, and dated events in a private timeline. Photo/video originals live in the uploader’s Google Drive while Weship keeps only compact private previews. A simple streak marks continuity with an explicit count and encouragement.

## Current build

**Phase 2 foundation — accounts and live sync.** The app remains usable as a local demo without environment values. Once Supabase is configured, Auth gates the app, RLS scopes data to the authenticated pair, Realtime refreshes partner changes, and live entry points cover accounts, pairing, Drive-primary media, 2dos, Calendar, push, and games. Deployment and physical-device validation still require the values and steps in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md). — [codex · done-unverified]
