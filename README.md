# Weship

Weship is a private Expo app for two partners: shared 2dos, Goodies, Memories, daily questions, lightweight games, widgets, Calendar connections, and Drive-owned media.

## Start here

The documentation index is [docs/README.md](./docs/README.md) — start with [docs/VISION.md](./docs/VISION.md) for what the app is and [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for how it is put together.

## Local setup

```bash
npm ci
cp .env.example .env.local
npx expo start --dev-client
```

The app can use mock data when public Supabase values are absent. The configured live build requires the migrations, Edge Functions, and provider secrets in [docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md). Native widgets, camera, and remote notifications require a custom development build; they are not an Expo Go workflow.

## Verification

```bash
npm run lint
npx tsc --noEmit
npx expo-doctor
npx expo export --platform web
npx expo export --platform android
npx expo export --platform ios
git diff --check
```
