# Working in this repo

## Expo version
This project is on **Expo SDK 57 / React Native 0.86**. Read the exact versioned docs at
https://docs.expo.dev/versions/v57.0.0/ before writing any code. Do not assume older-SDK APIs.

## Documentation convention (read before you edit)

`docs/` is **reference material, not a status log.** It describes what the app is, how it
is designed, and how it is built. There is no progress tracker, defect register, or
known-issues file — do not create one.

1. **Keep the reference true.** When a change makes a doc wrong, fix that doc in the same
   change: [docs/FEATURES.md](docs/FEATURES.md), [docs/SCREENS.md](docs/SCREENS.md),
   [docs/DATA_MODEL.md](docs/DATA_MODEL.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
   or whichever one describes the thing you touched. Don't append a changelog entry.

2. **Be honest about verification.** "Compiles" is not "works." If you could not run it
   (camera needs a device dev build, the app is auth-gated, the widget needs a native
   build), say so plainly in your reply to the user — never claim something is verified
   that you did not actually observe running.

3. **Report unfixed problems to the user, not to a file.** If you notice something broken
   that you are not fixing, say it in your response so it is acted on, rather than
   burying it in a register nobody reads.

## Native modules that throw at import (read before adding an Expo package)

Several Expo packages raise as soon as they are **imported** when the native module
is missing — `expo-notifications` and `expo-media-library` have both done it here.
Because an expo-router route that throws at import produces no default export, one
bad top-level import takes down the entire router with a misleading
`Cannot read property 'ErrorBoundary' of undefined`.

**The rule:** for any package that is not present in every runtime (web, Expo Go,
dev build), import it **type-only** and load it at call time:

```ts
import type * as MediaLibrary from 'expo-media-library';
import { loadNativeModule, nativeUnavailableReason } from '@/lib/native-modules';

const media = loadNativeModule<typeof MediaLibrary>(() => require('expo-media-library'));
if (!media) { /* tell the user why, don't throw */ }
```

`lib/native-modules.ts` owns the capability checks (`hasCustomNativeRuntime`,
`isExpoGo`, `nativeUnavailableReason`). Use it rather than re-deriving guards, and
never guard only for web — Expo Go fails differently and on different modules.
