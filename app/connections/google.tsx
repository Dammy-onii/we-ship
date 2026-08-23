import { Redirect } from 'expo-router';

/**
 * Landing point for the Google OAuth return.
 *
 * `google-oauth-start` sends the browser back to `weship://connections/google`
 * with a `?connected=1` query. Nothing was registered at that path, so
 * finishing a Drive connection dropped the user on "Unmatched Route" — the
 * connection itself had already succeeded server-side.
 *
 * `WebBrowser.openAuthSessionAsync` normally intercepts this before the router
 * ever sees it. It does not when Android hands the deep link to a cold start,
 * or when the user returns to the app manually.
 */
export default function GoogleConnectionReturn() {
  return <Redirect href="/connections" />;
}
