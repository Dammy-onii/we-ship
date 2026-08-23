package app.weship.todowidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WeshipTodoWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WeshipTodoWidget")

    AsyncFunction("setTopTask") { title: String?, routine: String?, deepLink: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      WidgetStore.prefs(context).edit()
        .putString(KEY_TITLE, title)
        .putString(KEY_ROUTINE, routine)
        .putString(KEY_DEEP_LINK, deepLink)
        .apply()
      WeshipWidgets.refreshAll(context)
    }

    AsyncFunction("setSnapshot") { json: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      WidgetStore.prefs(context).edit()
        .putString(KEY_SNAPSHOT, json)
        .apply()
      // The app has spoken; drop only the optimistic ticks it now confirms.
      WidgetStore.clearStaleLocalCompletions(context)
      WeshipWidgets.refreshAll(context)
    }

    // Handed down so widget buttons can call one RPC without the app running.
    // Null on sign-out, so a signed-out phone cannot act on the account.
    AsyncFunction("setSession") { json: String? ->
      val context = appContext.reactContext ?: return@AsyncFunction
      val editor = WidgetStore.prefs(context).edit()
      if (json == null) editor.remove(KEY_SESSION) else editor.putString(KEY_SESSION, json)
      editor.apply()
    }

    AsyncFunction("availableKinds") {
      WeshipWidgets.providers.keys.toList()
    }

    AsyncFunction("drainActions") {
      val context = appContext.reactContext ?: return@AsyncFunction "[]"
      WidgetStore.drainQueue(context)
    }

    // Asks the launcher to pin the widget. Returns false when the launcher does
    // not support pinning, so the caller can fall back to instructions.
    AsyncFunction("requestPin") { kind: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val provider = WeshipWidgets.providers[kind] ?: return@AsyncFunction false
      val manager = AppWidgetManager.getInstance(context)
      if (!manager.isRequestPinAppWidgetSupported) return@AsyncFunction false
      manager.requestPinAppWidget(ComponentName(context, provider), null, null)
    }
  }
}

internal const val PREFS_NAME = "weship_top_todo_widget"
internal const val KEY_TITLE = "title"
internal const val KEY_ROUTINE = "routine"
internal const val KEY_DEEP_LINK = "deep_link"
internal const val KEY_SNAPSHOT = "snapshot"
internal const val KEY_SESSION = "session"
internal const val KEY_QUEUE = "action_queue"
/** Ids ticked from the widget, kept until the app's snapshot agrees. */
internal const val KEY_TODO_DONE_IDS = "todo_done_ids"
