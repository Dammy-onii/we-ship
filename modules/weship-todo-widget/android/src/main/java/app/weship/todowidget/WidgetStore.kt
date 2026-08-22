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
        pinned = item.optBoolean("pinned", false),
      )
    }
  }

  data class Slide(
    val id: String,
    val kind: String,
    val imageUri: String?,
    val text: String?,
    val author: String,
    val pinned: Boolean,
  )

  /** Session the widget buttons use to call one RPC directly. */
  data class Session(val url: String, val anonKey: String, val accessToken: String)

  fun session(context: Context): Session? {
    val raw = prefs(context).getString(KEY_SESSION, null) ?: return null
    return runCatching {
      val json = JSONObject(raw)
      Session(
        json.getString("url").trimEnd('/'),
        json.getString("anonKey"),
        json.getString("accessToken"),
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

  fun drainQueue(context: Context): String {
    val store = prefs(context)
    val queue = store.getString(KEY_QUEUE, "[]") ?: "[]"
    store.edit().remove(KEY_QUEUE).apply()
    return queue
  }
}
