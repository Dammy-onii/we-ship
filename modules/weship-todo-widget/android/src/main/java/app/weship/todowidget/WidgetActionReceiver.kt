package app.weship.todowidget

import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * Handles taps on widget buttons.
 *
 * A widget has no Supabase client, so this posts straight to the REST RPC with
 * the session the app last handed down. If that fails for any reason — expired
 * token, no network, signed out — the action is queued rather than dropped, and
 * the app flushes it on next launch.
 */
class WidgetActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.getStringExtra(EXTRA_ACTION) ?: return
    val target = intent.getStringExtra(EXTRA_TARGET).orEmpty()

    // Reflect the tap immediately; correctness is reconciled by the app.
    if (action == ACTION_COMPLETE_TASK) {
      WidgetStore.prefs(context).edit().putBoolean(KEY_TODO_DONE, true).apply()
      refresh(context, TopTodoWidgetProvider::class.java)
    }
    if (action == ACTION_NUDGE) {
      WidgetStore.prefs(context).edit().putLong(KEY_LAST_NUDGE, System.currentTimeMillis()).apply()
      refresh(context, NudgeWidgetProvider::class.java)
    }

    val session = WidgetStore.session(context)
    if (session == null) {
      WidgetStore.queueAction(context, action, target)
      return
    }

    val pending = goAsync()
    thread {
      val sent = runCatching { send(session, action, target) }.getOrDefault(false)
      if (!sent) WidgetStore.queueAction(context, action, target)
      pending.finish()
    }
  }

  private fun send(session: WidgetStore.Session, action: String, target: String): Boolean {
    val (path, body) = when (action) {
      ACTION_COMPLETE_TASK ->
        "rpc/set_task_complete" to
          """{"p_task_id":"$target","p_completed":true,"p_note":null,"p_local_date":null}"""
      ACTION_NUDGE ->
        "rpc/send_widget_nudge" to """{"p_kind":"${target.ifEmpty { "thinkingOfYou" }}"}"""
      else -> return false
    }

    val connection = (URL("${session.url}/rest/v1/$path").openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      connectTimeout = 10_000
      readTimeout = 10_000
      doOutput = true
      setRequestProperty("Content-Type", "application/json")
      setRequestProperty("apikey", session.anonKey)
      setRequestProperty("Authorization", "Bearer ${session.accessToken}")
    }
    return try {
      OutputStreamWriter(connection.outputStream).use { it.write(body) }
      connection.responseCode in 200..299
    } finally {
      connection.disconnect()
    }
  }

  private fun refresh(context: Context, provider: Class<*>) {
    val manager = AppWidgetManager.getInstance(context)
    val component = ComponentName(context, provider)
    manager.getAppWidgetIds(component).forEach { id ->
      WeshipWidgets.render(context, manager, id, provider)
    }
  }

  companion object {
    const val EXTRA_ACTION = "weship_action"
    const val EXTRA_TARGET = "weship_target"
    const val ACTION_COMPLETE_TASK = "complete_task"
    const val ACTION_NUDGE = "nudge"
  }
}
