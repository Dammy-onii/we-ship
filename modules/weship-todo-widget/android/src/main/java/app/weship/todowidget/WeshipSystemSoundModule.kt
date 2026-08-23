package app.weship.todowidget

import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Plays the phone's own notification tone.
 *
 * In-app alerts used to play a bundled two-note chime that was synthesised for
 * the project. It was louder and sharper than anything else the phone makes,
 * and it ignored the user's chosen tone entirely. This asks Android for
 * whatever the user actually picked in Settings, so an in-app alert sounds like
 * every other notification they get.
 */
class WeshipSystemSoundModule : Module() {
  /**
   * Held for the duration of playback.
   *
   * A `Ringtone` with no strong reference can be collected part-way through and
   * cut itself off; keeping the last one also lets a rapid second alert restart
   * cleanly rather than overlapping.
   */
  private var ringtone: Ringtone? = null

  override fun definition() = ModuleDefinition {
    Name("WeshipSystemSound")

    AsyncFunction("playNotificationSound") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val audio = context.getSystemService(AudioManager::class.java)

      // Silent and vibrate both mean "do not make a sound". Playing anyway
      // would be worse than the chime this replaced.
      if (audio != null && audio.ringerMode != AudioManager.RINGER_MODE_NORMAL) {
        return@AsyncFunction false
      }

      val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        ?: return@AsyncFunction false

      runCatching {
        ringtone?.stop()
        ringtone = RingtoneManager.getRingtone(context, uri)?.apply {
          // Routed to the notification stream, so it follows the notification
          // volume slider rather than media volume.
          audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
          play()
        }
      }.isSuccess && ringtone != null
    }
  }
}
