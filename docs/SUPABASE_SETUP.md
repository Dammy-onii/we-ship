# Supabase and Provider Setup

The codebase contains the database, RLS, Storage, Realtime, Auth, Edge Function, widget, Calendar, Drive, game, and push foundations. Nothing private is hard-coded. The remaining step is connecting projects and deploying the checked-in backend.

## What the developer needs to provide

### Supabase — required

1. A Supabase project and its **Project URL**.
2. Its **publishable key** (`sb_publishable_…`) or legacy anon key. This key is designed for the app; RLS is the security boundary.
3. The project reference so the local CLI can run `supabase link` and deploy migrations/functions.
4. A decision on production email delivery. Supabase's default mailer is enough for early tests; production should use a configured SMTP provider.

Put only the URL and publishable key in `.env.local`:

```bash
cp .env.example .env.local
```

After adding or changing `EXPO_PUBLIC_*` values, restart Metro with `npx expo start --clear --dev-client`. A stale Metro transform cache can otherwise keep an earlier empty/demo configuration even though Expo reports loading the environment file. — [codex · verified]

Do **not** put the database password or service-role key in Expo environment variables. Do not send the service-role key in chat or commit it. Supabase supplies it to deployed Edge Functions.

### Native app identity — required before the first shared build

- Final iOS bundle identifier (current development placeholder: `app.weship.mobile`).
- Final Android package (current development placeholder: `app.weship.mobile`).
- Expo/EAS project ID and the Expo account/organization that owns builds.

Changing either identifier later creates a different app identity and can break OAuth, push credentials, Keychain data, and installed widgets. Confirm them before production signing.

The identifiers do not have to equal the legal company name, App Store seller name, or Play developer-account name. Use a stable, unique reverse-domain value, ideally based on a domain the team controls, such as `com.company.weship`. The iOS value must match the Apple App ID and App Store Connect record. To update an existing Google Play listing, the Android package and signing identity must match the previous release exactly; a different package is a new app.

### Push notifications — required for remote delivery

- `EXPO_PUBLIC_EAS_PROJECT_ID` in `.env.local`.
- iOS APNs credentials configured in EAS.
- Android FCM v1 service-account credentials configured in EAS.
- A random `PUSH_WEBHOOK_SECRET` set as a Supabase function secret.

The app asks notification permission only after the user taps **Profile → Notifications → Enable**. Android remote push requires a development/release build, not Expo Go.

**Point the database at the dispatcher.** `dispatch-push` is called by database
triggers on `personal_notifications` and `activity_events`. Those triggers look
up where to send in `private.app_settings`, and do nothing at all while it is
empty — which is why notifications were written to the database but never
reached a phone. Run once, with your own project ref and the same secret you set
as `PUSH_WEBHOOK_SECRET`:

```sql
insert into private.app_settings (key, value) values
  ('push_endpoint', 'https://<project-ref>.supabase.co/functions/v1/dispatch-push'),
  ('push_secret',   '<the same value as PUSH_WEBHOOK_SECRET>')
on conflict (key) do update set value = excluded.value;
```

Nothing here is readable by `anon` or `authenticated`; `private.app_settings`
has every privilege revoked from both.

APNs is Apple's delivery network for iPhone notifications. Its credential is normally an Apple Push Notification signing key (`.p8`) plus its Key ID and Apple Team ID. FCM is Firebase Cloud Messaging, Google's delivery network for Android. Expo/EAS can manage both credentials with `eas credentials`; private key files must stay out of the app and repository.

Android also needs the public Firebase client configuration file, `google-services.json`, for the final Android package. Add its path as `expo.android.googleServicesFile`. Separately upload the private FCM v1 service-account JSON to EAS under the Android push credentials.

The two Firebase files are not equivalent and must be handled differently:

| File | Contains | Where it goes | Committed? |
| --- | --- | --- | --- |
| `google-services.json` | Project number, app id, and an API key restricted to this package — all of which ship inside the APK anyway | Repository root, referenced by `expo.android.googleServicesFile` | **Yes.** EAS builds from the Git tree, so an ignored file is simply absent at build time and push silently fails to register |
| FCM v1 service-account JSON | A private key that can send push as this project | `eas credentials` only | **Never.** Google scans public repositories and disables exposed keys |

The Gradle edits Firebase's own console instructions describe — adding the
`com.google.gms.google-services` plugin to both build files — are not done by
hand. `expo prebuild` applies them from `googleServicesFile`, and `/android` is
generated, so hand edits there are overwritten.

### Google Calendar and Drive — required

Create one Google Cloud project, enable **Google Calendar API** and **Google Drive API**, configure the OAuth consent screen, and provide:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`, exactly `https://<PROJECT_REF>.supabase.co/functions/v1/google-oauth-callback`
- Test-user emails while the OAuth app is in testing

Add that exact HTTPS callback in Google Cloud's authorized redirect URIs. Weship requests Calendar read/events access and narrow `drive.file` access. Each partner authorizes their own Google account.

For the implemented server callback flow, create an OAuth client with application type **Web application**. The client ID and client secret belong in Supabase Edge Function secrets. Separate public iOS/Android OAuth client IDs are not currently consumed by this flow.

Google Cloud setup order:

1. Create or select a Google Cloud project.
2. Enable Google Calendar API and Google Drive API.
3. In Google Auth Platform, configure Branding, Audience, and Data Access. Add test users while the app is in testing.
4. Add the Calendar and Drive scopes listed by the app.
5. Create a **Web application** OAuth client.
6. Add `https://<PROJECT_REF>.supabase.co/functions/v1/google-oauth-callback` as an exact authorized redirect URI.
7. Save the generated client ID and client secret as Supabase function secrets.

Each Weship partner connects their own Google account and grants their own consent. A Memory or photo/video Goodie uploader's original goes directly to that uploader's Drive and quota; Supabase receives only a compact pair-scoped preview. The partner opens a ready original through Weship’s authenticated proxy, which uses the owner’s encrypted server-side token. If both partners want to upload media, both connect Google. This avoids asking a couple to share one Google password. A genuinely shared Drive folder with direct Google permissions would be a separate feature. — [codex · done-unverified]

These are server secrets, not `.env.local` values:

```bash
supabase secrets set \
  GOOGLE_CLIENT_ID=... \
  GOOGLE_CLIENT_SECRET=... \
  GOOGLE_REDIRECT_URI=https://PROJECT_REF.supabase.co/functions/v1/google-oauth-callback \
  PROVIDER_TOKEN_KEY_VERSION=2 \
  PROVIDER_TOKEN_ENCRYPTION_KEY_V2="$(openssl rand -base64 48)" \
  PUSH_WEBHOOK_SECRET="$(openssl rand -hex 32)"
```

Keep every active/legacy encryption key in the team's password manager. To
rotate, add `PROVIDER_TOKEN_ENCRYPTION_KEY_V3`, change
`PROVIDER_TOKEN_KEY_VERSION` to `3`, and redeploy. Ciphertext carries its own
version; normal token refresh rewrites both Google tokens with the current key,
while older keys remain readable during the transition.

## Deploy in order

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy google-oauth-start
supabase functions deploy google-oauth-callback --no-verify-jwt
supabase functions deploy provider-disconnect
supabase functions deploy google-calendar-list
supabase functions deploy google-calendar-import
supabase functions deploy google-calendar-create
supabase functions deploy google-drive-media
supabase functions deploy google-drive-media-content
supabase functions deploy dispatch-push --no-verify-jwt
supabase functions deploy dispatch-reminders --no-verify-jwt
```

In Supabase Auth URL configuration, add `weship://auth/callback` to allowed redirect URLs. Email/password and magic-link sign-in are implemented.

Create a Database Webhook on `public.activity_events` INSERT to:

```text
https://<PROJECT_REF>.supabase.co/functions/v1/dispatch-push
```

Include header `x-weship-secret` with the same `PUSH_WEBHOOK_SECRET`. Database triggers already fan activities out to in-app notifications; the webhook handles device delivery.

Create the same INSERT webhook on `public.personal_notifications` so friend
requests, decisions, and posts reach devices too. Use the same URL and secret.

Schedule `dispatch-reminders` once per minute with Supabase Cron (or another
trusted scheduler). Send a POST to
`https://<PROJECT_REF>.supabase.co/functions/v1/dispatch-reminders` with the
same `x-weship-secret` header. The function selects due, unsent reminders and
marks each one sent after Expo accepts the batch.

## Build and test on phones

Native widgets and Android remote notifications cannot be added to Expo Go. After confirming identifiers and running `eas init`:

```bash
eas build --profile development --platform android
eas build --profile development --platform ios
npx expo start --dev-client
```

Install each internal build from its EAS link. On Android, long-press the Home Screen and choose Widgets. On iOS, long-press, choose Edit, then Add Widget. Search for **Weship 2do**.

## Drive operational note

The Edge Function does not receive or buffer original bytes. It authenticates the uploader, creates the correct visible Drive folder and resumable session, and returns that session URL to the device. The device then streams the original straight to Google and calls the function again to validate/commit metadata. This removes the old 20 MB Edge-copy limit and prevents duplicate original storage in Supabase.

Supabase stores only JPEG previews capped at 2 MB in `memory-previews`/`goodie-previews`, plus metadata in Postgres. If the Drive owner disconnects Google or deletes a file, the preview/caption/date remain but the original becomes unavailable until access is restored. Interrupted uploads can be retried by the user; resumable-session persistence across a terminated app is not yet implemented. — [codex · done-unverified]

After deploying, verify with two accounts:

1. Connect a different Google account for each partner.
2. Upload a photo and video from each device in both Memories and Goodies.
3. Confirm the originals exist only in each uploader’s `Weship` Drive folder and do not appear in the Supabase original buckets.
4. Confirm both partners see the small grid preview and can open/seek the original.
5. Revoke one Google connection and delete one Drive file; confirm previews remain and original-open fails without leaking data.
6. Interrupt an upload and confirm no ready database row points at a deleted file.

## What should not be provided

- No service-role key in the Expo app.
- No Google client secret in the Expo app.
- No personal Google password.
- No APNs `.p8` or FCM JSON committed to Git.
- No database password committed to Git.

ChatGPT/Codex Google Drive or Calendar plugins are not used here: those connect this coding session to an account, not the shipped Weship app to each user's account.
