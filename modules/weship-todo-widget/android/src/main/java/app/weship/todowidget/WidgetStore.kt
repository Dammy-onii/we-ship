package app.weship.todowidget

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * The widgets' view of the app's data.
 *
 * Widgets run in a separate process with no Supabase client and no React state,
 * so the app writes a complete snapshot here and every provider reads from it.
 * Images are already local file paths — a widget cannot follow an expiring
 * signed URL.
 */
internal object WidgetStore {
  fun prefs(context: Context) = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun snapshot(context: Context): JSONObject =
    runCatching { JSONObject(prefs(context).getString(KEY_SNAPSHOT, "{}") ?: "{}") }
      .getOrElse { JSONObject() }

  fun slides(context: Context, key: String): List<Slide> {
    val array = snapshot(context).optJSONArray(key) ?: return emptyList()
    return (0 until array.length()).mapNotNull { index ->
      val item = array.optJSONObject(index) ?: return@mapNotNull null
      Slide(
        id = item.optString("id"),
        kind = item.optString("kind", "note"),
        imageUri = item.optString("imageUri").takeIf { it.isNotEmpty() },
        text = item.optString("text").takeIf { it.isNotEmpty() },
        author = item.optString("author"),
        favourite = item.optBoolean("favourite", false),
        route = item.optString("route").takeIf { it.isNotEmpty() },
      )
    }
  }

  /**
   * Which slide a carousel is showing.
   *
   * Paging is done by rotating the list the adapter returns rather than by
   * asking the flipper to advance itself. `RemoteViews.showNext` is delivered
   * as a reflection call against a view bound to a `RemoteViewsAdapter`, and
   * whether it lands depends on the launcher and on the adapter having finished
   * binding — on One UI it silently did nothing, so the arrows drew but never
   * moved anything. Rotating the data and calling
   * `notifyAppWidgetViewDataChanged` is honoured everywhere.
   */
  fun carouselOffset(context: Context, key: String): Int =
    prefs(context).getInt(KEY_CAROUSEL_OFFSET + key, 0)

  fun setCarouselOffset(context: Context, key: String, value: Int) {
    prefs(context).edit().putInt(KEY_CAROUSEL_OFFSET + key, value).apply()
  }

  /** One row of the 2do widget's list. */
  data class Task(
    val id: String,
    val label: String,
    val routine: String,
    val noteRequired: Boolean,
    val done: Boolean,
  )

  fun tasks(context: Context): List<Task> {
    val array = snapshot(context).optJSONArray("todos") ?: return emptyList()
    val completedLocally = completedLocally(context)
    return (0 until array.length()).mapNotNull { index ->
      val item = array.optJSONObject(index) ?: return@mapNotNull null
      val id = item.optString("id")
      Task(
        id = id,
        label = item.optString("label"),
        routine = item.optString("routine"),
        noteRequired = item.optBoolean("noteRequired", false),
        // A tick made from the widget shows immediately, before the app has
        // confirmed it and written a fresh snapshot.
        done = item.optBoolean("done", false) || completedLocally.contains(id),
      )
    }
  }

  /** Task ids ticked from the widget since the last snapshot arrived. */
  fun completedLocally(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_TODO_DONE_IDS, emptySet()) ?: emptySet()

  fun markCompletedLocally(context: Context, id: String) {
    val store = prefs(context)
    store.edit()
      .putStringSet(KEY_TODO_DONE_IDS, completedLocally(context) + id)
      .apply()
  }

  /**
   * Forgets local ticks once the app's own snapshot reflects them.
   *
   * Without this a task stays struck through forever from the widget's point of
   * view, including after it is reopened or deleted in the app.
   *
   * The snapshot is the only thing consulted. An earlier version also required
   * the tick to still be sitting in the retry queue, which quietly broke the
   * common case: `queueAction` runs only when the network call *fails*, so a
   * tick that succeeded was never queued and was therefore dropped on the very
   * next snapshot — before the server's own `done` had made it back. The header
   * count fell straight back to 0 while the row list, not yet re-notified, still
   * showed the tick, so the two halves of the widget disagreed.
   *
   * Keeping a tick until the snapshot itself accounts for it is both simpler and
   * correct: once the task reads as done, or stops existing, it leaves on its
   * own.
   */
  fun clearStaleLocalCompletions(context: Context) {
    val live = snapshot(context).optJSONArray("todos") ?: return
    val open = (0 until live.length())
      .mapNotNull { live.optJSONObject(it) }
      .filter { !it.optBoolean("done", false) }
      .map { it.optString("id") }
      .toSet()
    val kept = completedLocally(context).intersect(open)
    prefs(context).edit().putStringSet(KEY_TODO_DONE_IDS, kept).apply()
  }

  data class Slide(
    val id: String,
    val kind: String,
    val imageUri: String?,
    val text: String?,
    val author: String,
    /** Chosen by the partner to lead the carousel. Was `pinned` before the rename. */
    val favourite: Boolean,
    /** Deep link to this exact item, so a tap does not just open the gallery. */
    val route: String?,
  )

  /** Session the widget buttons use to call one RPC directly. */
  data class Session(
    val url: String,
    val anonKey: String,
    val accessToken: String,
    val timezone: String,
  )

  fun session(context: Context): Session? {
    val raw = prefs(context).getString(KEY_SESSION, null) ?: return null
    return runCatching {
      val json = JSONObject(raw)
      Session(
        json.getString("url").trimEnd('/'),
        json.getString("anonKey"),
        json.getString("accessToken"),
        json.optString("timezone", "UTC"),
      )
    }.getOrNull()
  }

  /**
   * Records an action the widget could not send.
   *
   * A tap must never be silently lost because the token expired or the phone
   * was offline; the app drains this queue the next time it runs.
   */
  fun queueAction(context: Context, type: String, id: String) {
    val store = prefs(context)
    val queue = runCatching { JSONArray(store.getString(KEY_QUEUE, "[]")) }.getOrElse { JSONArray() }
    queue.put(
      JSONObject()
        .put("type", type)
        .put("id", id)
        .put("at", System.currentTimeMillis())
    )
    store.edit().putString(KEY_QUEUE, queue.toString()).apply()
  }

  /** Returns pending actions without deleting them; JS acknowledges successes. */
  fun pendingQueue(context: Context): String =
    prefs(context).getString(KEY_QUEUE, "[]") ?: "[]"

  fun acknowledgeActions(context: Context, acknowledgedJson: String) {
    val acknowledged = runCatching { JSONArray(acknowledgedJson) }.getOrElse { return }
    val acknowledgedKeys = (0 until acknowledged.length())
      .mapNotNull { acknowledged.optJSONObject(it) }
      .map(::actionKey)
      .toSet()
    val completedTaskIds = (0 until acknowledged.length())
      .mapNotNull { acknowledged.optJSONObject(it) }
      .filter { it.optString("type") == WidgetActionReceiver.ACTION_COMPLETE_TASK }
      .map { it.optString("id") }
      .filter { it.isNotEmpty() }
      .toSet()
    if (acknowledgedKeys.isEmpty()) return

    val current = runCatching { JSONArray(pendingQueue(context)) }.getOrElse { JSONArray() }
    val kept = JSONArray()
    for (index in 0 until current.length()) {
      val item = current.optJSONObject(index) ?: continue
      if (actionKey(item) !in acknowledgedKeys) kept.put(item)
    }
    prefs(context).edit()
      .putString(KEY_QUEUE, kept.toString())
      .putStringSet(KEY_TODO_DONE_IDS, completedLocally(context) - completedTaskIds)
      .apply()
  }

  private fun actionKey(action: JSONObject): String =
    "${action.optString("type")}\u0000${action.optString("id")}\u0000${action.optLong("at")}"
}
