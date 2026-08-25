package app.weship.todowidget

import android.app.NotificationManager
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.provider.Settings
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

      // Match the sound the user chose for Weship's own Android channel. A
      // null channel sound means the channel was intentionally muted, so the
      // in-app alert must stay silent too. Before Android 8, use the phone-wide
      // default notification tone.
      val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = context.getSystemService(NotificationManager::class.java)
          ?.getNotificationChannel(WESHIP_NOTIFICATION_CHANNEL)
        if (channel != null) channel.sound ?: return@AsyncFunction false
        else RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
      } else {
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
      } ?: return@AsyncFunction false

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

    /**
     * Android owns a channel's chosen tone after the channel is created. Open
     * that exact channel so the user can choose any notification sound their
     * phone exposes; recreating the channel in JavaScript cannot override it.
     */
    AsyncFunction("openNotificationSoundSettings") { channelId: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val channelSettings = Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).apply {
        putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        putExtra(Settings.EXTRA_CHANNEL_ID, channelId)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      runCatching { context.startActivity(channelSettings) }.recoverCatching {
        context.startActivity(
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
        )
      }.isSuccess
    }
  }
}

private const val WESHIP_NOTIFICATION_CHANNEL = "weship-updates-v4"
