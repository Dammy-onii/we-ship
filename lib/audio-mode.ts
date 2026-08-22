import { setAudioModeAsync } from 'expo-audio';

/**
 * Audio session helpers.
 *
 * Voice notes played back quietly because the session was only told
 * `allowsRecording` / `playsInSilentMode`. Two routing details were missing:
 *
 *  - iOS keeps a play-and-record session on the **receiver (earpiece)**, which
 *    is dramatically quieter than the speaker. Leaving `allowsRecording` true
 *    during playback keeps audio on that route.
 *  - Android honours `shouldRouteThroughEarpiece`, which must be explicitly
 *    false to reach the loudspeaker.
 */

/** Session for capturing a voice note. */
export async function enterRecordingMode() {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    shouldRouteThroughEarpiece: false,
    interruptionMode: 'doNotMix',
  });
}

/** Session for loud playback through the speaker. */
export async function enterPlaybackMode() {
  await setAudioModeAsync({
    // Must be false, or iOS keeps routing to the quiet earpiece.
    allowsRecording: false,
    playsInSilentMode: true,
    shouldRouteThroughEarpiece: false,
    interruptionMode: 'doNotMix',
  });
}
