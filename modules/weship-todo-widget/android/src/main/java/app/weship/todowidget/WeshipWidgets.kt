package app.weship.todowidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.RemoteViews

/** Every widget this app offers, and how to draw each one. */
internal object WeshipWidgets {

  val providers: Map<String, Class<out AppWidgetProvider>> = mapOf(
    "todo" to TopTodoWidgetProvider::class.java,
    "partner-carousel" to PartnerCarouselProvider::class.java,
    "friends-carousel" to FriendsCarouselProvider::class.java,
    "presence" to PresenceWidgetProvider::class.java,
    "quick-send" to QuickSendWidgetProvider::class.java,
  )

  /** Redraws every placed instance of every widget. */
  fun refreshAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    providers.values.forEach { provider ->
      val ids = manager.getAppWidgetIds(ComponentName(context, provider))
      ids.forEach { render(context, manager, it, provider) }
      // A RemoteViews collection caches its rows, so it must be told the data
      // changed — redrawing the host layout alone leaves stale content.
      when (provider) {
        PartnerCarouselProvider::class.java, FriendsCarouselProvider::class.java ->
          manager.notifyAppWidgetViewDataChanged(ids, R.id.weship_carousel)
        TopTodoWidgetProvider::class.java ->
          manager.notifyAppWidgetViewDataChanged(ids, R.id.weship_widget_list)
      }
    }
  }

  fun render(context: Context, manager: AppWidgetManager, id: Int, provider: Class<*>) {
    when (provider) {
      TopTodoWidgetProvider::class.java -> renderTodo(context, manager, id)
      PartnerCarouselProvider::class.java -> renderCarousel(context, manager, id, "partnerSlides")
      FriendsCarouselProvider::class.java -> renderCarousel(context, manager, id, "friendSlides")
      PresenceWidgetProvider::class.java -> renderPresence(context, manager, id)
      QuickSendWidgetProvider::class.java -> renderQuickSend(context, manager, id)
    }
  }

  /**
   * The widget's current size in dp, as the launcher reports it.
   *
   * Widgets are not laid out by us and cannot query their own width, so the
   * only way to adapt is to read the size the host last negotiated and redraw.
   * `onAppWidgetOptionsChanged` calls back into `render` whenever it changes.
   */
  private fun sizeDp(manager: AppWidgetManager, id: Int): Pair<Int, Int> {
    val options = manager.getAppWidgetOptions(id)
    val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
    val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
    return width to height
  }

  /**
   * Below this, only the headline row fits.
   *
   * Deliberately low. The value it is compared against is
   * OPTION_APPWIDGET_MIN_HEIGHT, which is the *floor* the host guarantees, not
   * the height the widget actually got — a two-cell-tall widget reports about
   * 110dp while occupying far more. A threshold of 140 therefore hid Presence's
   * footer and Quick send's "send to" line on widgets with ample room, leaving a
   * dead gap where the content should have been. 100 only trips on a genuinely
   * single-cell widget, which is the case this was written for.
   */
  private const val SHORT_DP = 100

  /** Three cells tall. Above this a tile has room for a third line. */
  private const val TALL_DP = 200

  /*
   * Tile-width thresholds, measured against the *reported* width, which runs
   * smaller than the real one. A 3-cell quick send reports ~180dp, leaving
   * ~46dp a tile — so a threshold of 54 hid the captions on a widget that had
   * plenty of room for them. These are set against what the host actually
   * reports, not against the geometry the widget ends up with.
   */

  /** Narrowest tile that can hold its one-word caption without truncating. */
  private const val TILE_LABEL_DP = 40

  /** Narrowest tile that can hold the caption *and* its hint underneath. */
  private const val TILE_HINT_DP = 62

  private fun renderTodo(context: Context, manager: AppWidgetManager, id: Int) {
    val tasks = WidgetStore.tasks(context)
    val views = RemoteViews(context.packageName, R.layout.weship_todo_widget)

    val done = tasks.count { it.done }
    views.setTextViewText(
      R.id.weship_widget_progress,
      if (tasks.isEmpty()) "" else "$done/${tasks.size}"
    )

    val intent = Intent(context, TodoListRemoteViewsService::class.java).apply {
      putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
      // Unique per instance, or Android shares one factory across every copy.
      data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
    }
    views.setRemoteAdapter(R.id.weship_widget_list, intent)
    views.setEmptyView(R.id.weship_widget_list, R.id.weship_widget_empty)

    // One template for the whole list; each row fills in what it wants done.
    views.setPendingIntentTemplate(R.id.weship_widget_list, rowTemplate(context, id))
    views.setOnClickPendingIntent(R.id.weship_widget_empty, openApp(context, "weship://todo", id))

    manager.updateAppWidget(id, views)
    manager.notifyAppWidgetViewDataChanged(id, R.id.weship_widget_list)
  }

  /**
   * The broadcast every 2do row fills in.
   *
   * Mutable because a fill-in intent has to be able to add its own extras; an
   * immutable template would silently ignore them and every row would do the
   * same thing.
   */
  private fun rowTemplate(context: Context, id: Int): PendingIntent {
    val intent = Intent(context, WidgetActionReceiver::class.java)
    return PendingIntent.getBroadcast(
      context,
      "todo_row_template".hashCode() + id,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
    )
  }

  private fun renderCarousel(context: Context, manager: AppWidgetManager, id: Int, key: String) {
    val views = RemoteViews(context.packageName, R.layout.weship_carousel_widget)
    val slides = WidgetStore.slides(context, key)
    val friends = key != "partnerSlides"

    val intent = Intent(context, CarouselRemoteViewsService::class.java).apply {
      putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
      putExtra(CarouselRemoteViewsService.EXTRA_SOURCE, key)
      // The data URI must be unique per widget instance or Android reuses one
      // factory across every placed copy and they all show the same source.
      data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
    }
    views.setRemoteAdapter(R.id.weship_carousel, intent)
    views.setEmptyView(R.id.weship_carousel, R.id.weship_carousel_empty)

    // A flat AdapterViewFlipper shows one edge-to-edge slide. RemoteViews does
    // not expose a horizontal drag gesture for it, so paging uses the arrows.
    views.setPendingIntentTemplate(
      R.id.weship_carousel,
      openApp(
        context,
        if (friends) "weship://friend-spotlight" else "weship://spotlight",
        id,
        template = true
      )
    )
    views.setTextViewText(
      R.id.weship_carousel_empty,
      context.getString(
        if (friends) R.string.weship_carousel_empty_friends else R.string.weship_carousel_empty
      )
    )

    /*
     * Arrows, and whether to show them at all.
     *
     * A single slide has nothing to advance to, which read as a carousel that
     * was simply broken, so the controls are hidden rather than left doing
     * nothing. An empty deck is not one of those cases: the factory stands in
     * two placeholder slides, so the arrows work there too and the widget
     * demonstrates what it is for.
     */
    val count = if (slides.isEmpty()) CarouselRemoteViewsService.PLACEHOLDER_COUNT else slides.size
    val navigable = count > 1
    views.setViewVisibility(
      R.id.weship_carousel_controls,
      if (navigable) android.view.View.VISIBLE else android.view.View.GONE
    )
    if (navigable) {
      views.setTextViewText(R.id.weship_carousel_counter, "$count")
      views.setOnClickPendingIntent(
        R.id.weship_carousel_next,
        action(context, WidgetActionReceiver.ACTION_CAROUSEL_NEXT, key, id)
      )
      views.setOnClickPendingIntent(
        R.id.weship_carousel_previous,
        action(context, WidgetActionReceiver.ACTION_CAROUSEL_PREVIOUS, key, id)
      )
    }

    manager.updateAppWidget(id, views)
    manager.notifyAppWidgetViewDataChanged(id, R.id.weship_carousel)
  }

  /**
   * Steps a placed carousel one slide along without redrawing it.
   *
   * `partiallyUpdateAppWidget` is required here: a full `updateAppWidget` would
   * rebuild the RemoteViews and reset the stack to its first item, so the arrow
   * would appear to do nothing.
   */
  fun step(context: Context, provider: Class<out AppWidgetProvider>, forward: Boolean) {
    val key = if (provider == PartnerCarouselProvider::class.java) "partnerSlides" else "friendSlides"
    WidgetStore.setCarouselOffset(
      context,
      key,
      WidgetStore.carouselOffset(context, key) + if (forward) 1 else -1,
    )

    // Redraw for the new counter, then tell the adapter its data moved — that
    // second call is what actually changes the slide.
    val manager = AppWidgetManager.getInstance(context)
    val ids = manager.getAppWidgetIds(ComponentName(context, provider))
    ids.forEach { render(context, manager, it, provider) }
    manager.notifyAppWidgetViewDataChanged(ids, R.id.weship_carousel)
  }

  private fun renderPresence(context: Context, manager: AppWidgetManager, id: Int) {
    val presence = WidgetStore.snapshot(context).optJSONObject("presence")
    val views = RemoteViews(context.packageName, R.layout.weship_presence_widget)
    if (presence == null) {
      views.setTextViewText(R.id.weship_presence_name, context.getString(R.string.weship_presence_empty))
      views.setTextViewText(R.id.weship_presence_emoji, "♡")
      views.setTextViewText(R.id.weship_presence_mood, "Open Weship to connect your shared space.")
      views.setTextViewText(R.id.weship_presence_meta_label, "WESHIP")
      views.setTextViewText(R.id.weship_presence_meta, "OPEN APP")
      views.setTextViewText(R.id.weship_presence_detail_label, "TOGETHER")
      views.setTextViewText(R.id.weship_presence_task, "START HERE")
      views.setViewVisibility(R.id.weship_presence_streak, android.view.View.GONE)
    } else {
      views.setTextViewText(R.id.weship_presence_name, presence.optString("name"))
      views.setTextViewText(R.id.weship_presence_emoji, presence.optString("moodEmoji"))
      val status = presence.optString("statusText").takeIf { it.isNotEmpty() }
      views.setTextViewText(
        R.id.weship_presence_mood,
        status ?: presence.optString("mood")
      )

      // Falls through the same way the iOS widget does: their clock is only
      // worth showing when it differs from yours, so a shared timezone gets the
      // last thing you sent each other instead.
      val clock = presence.optString("localTime").takeIf { it.isNotEmpty() && it != "null" }
      val exchange = presence.optString("lastExchange").takeIf { it.isNotEmpty() }
      views.setTextViewText(
        R.id.weship_presence_meta_label,
        context.getString(
          if (clock != null) R.string.weship_presence_their_time else R.string.weship_presence_latest
        )
      )
      views.setTextViewText(
        R.id.weship_presence_meta,
        clock ?: exchange ?: presence.optString("lastSeen")
      )

      val task = presence.optString("pendingTask").takeIf { it.isNotEmpty() }
      val question = WidgetStore.snapshot(context).optJSONObject("streak")
      val answered = listOf("youAnswered", "partnerAnswered").count { question?.optBoolean(it) == true }
      views.setTextViewText(
        R.id.weship_presence_detail_label,
        context.getString(
          if (task != null) R.string.weship_presence_next_todo else R.string.weship_presence_daily_question
        )
      )
      views.setTextViewText(R.id.weship_presence_task, task ?: "$answered/2 answered")

      val streak = WidgetStore.snapshot(context).optJSONObject("streak")?.optInt("count") ?: 0
      views.setTextViewText(R.id.weship_presence_streak, if (streak > 0) "🔥 $streak" else "")
      views.setViewVisibility(
        R.id.weship_presence_streak,
        if (streak > 0) android.view.View.VISIBLE else android.view.View.GONE
      )
    }
    /*
     * The footer carries their local time and your next 2do — useful at three
     * cells, and the first thing to drop at two, where it pushed the mood panel
     * down to nothing.
     */
    val (_, presenceHeightDp) = sizeDp(manager, id)
    if (presenceHeightDp < SHORT_DP) {
      views.setViewVisibility(R.id.weship_presence_footer, android.view.View.GONE)
    }

    views.setOnClickPendingIntent(R.id.weship_presence_root, openApp(context, "weship://", id))
    manager.updateAppWidget(id, views)
  }

  /**
   * Three shortcuts into the composer.
   *
   * Every one of these needs the camera, the microphone or the keyboard, so
   * they open the app rather than acting in place — there is nothing a widget
   * could usefully do here on its own. The voice link carries a timestamp so
   * the app treats each tap as a fresh request and starts recording, instead of
   * ignoring a repeat of the last one.
   */
  private fun renderQuickSend(context: Context, manager: AppWidgetManager, id: Int) {
    val views = RemoteViews(context.packageName, R.layout.weship_quick_send_widget)
    val partner = WidgetStore.snapshot(context).optJSONObject("presence")?.optString("name")

    views.setTextViewText(
      R.id.weship_quick_label,
      if (partner.isNullOrEmpty()) context.getString(R.string.weship_quick_label_generic)
      else context.getString(R.string.weship_quick_label, partner.uppercase())
    )

    /*
     * Responsive in both axes.
     *
     * One hard rule learned the hard way: OPTION_APPWIDGET_MIN_WIDTH is the
     * *minimum* size the host promises, not the size the widget actually got.
     * It is fine for deciding what to SHOW and useless for deciding how big to
     * DRAW. An earlier version divided it across three tiles and pinned their
     * height to the result, which collapsed the whole widget into a strip. The
     * tiles are weighted again and size themselves; only visibility and
     * padding are driven from the reported size.
     */
    val (widthDp, heightDp) = sizeDp(manager, id)
    val tileWidthDp = (widthDp - 24 - 16) / 3

    val labels = if (tileWidthDp >= TILE_LABEL_DP) android.view.View.VISIBLE
      else android.view.View.GONE
    views.setViewVisibility(R.id.weship_quick_photo_label, labels)
    views.setViewVisibility(R.id.weship_quick_voice_label, labels)
    views.setViewVisibility(R.id.weship_quick_note_label, labels)

    // The hint is the first thing to go: it is the least load-bearing line in
    // the tile, and it needs both room to read and room to stack.
    val hints = if (tileWidthDp >= TILE_HINT_DP && heightDp >= TALL_DP)
      android.view.View.VISIBLE else android.view.View.GONE
    views.setViewVisibility(R.id.weship_quick_photo_hint, hints)
    views.setViewVisibility(R.id.weship_quick_voice_hint, hints)
    views.setViewVisibility(R.id.weship_quick_note_hint, hints)

    views.setViewVisibility(
      R.id.weship_quick_label,
      if (heightDp >= SHORT_DP) android.view.View.VISIBLE else android.view.View.GONE
    )

    /*
     * Tile padding tracks the tile's width so the icon keeps proportional air
     * around it instead of sitting in a fixed 7dp well that looks cramped when
     * wide and crowded when narrow. `setViewPadding` takes pixels, so the dp
     * has to be converted against the display density.
     */
    val density = context.resources.displayMetrics.density
    // Kept tight. Side padding competes directly with the caption for width,
    // and "PHOTO" truncating to "PHO…" costs more than the breathing room buys.
    val sidePx = ((tileWidthDp * 0.07f).coerceIn(4f, 9f) * density).toInt()
    // Taller than it is wide: a tile whose padding is square reads as cramped,
    // because the icon and its caption stack vertically and need the room in
    // that axis, not beside them.
    val topPx = ((tileWidthDp * 0.22f).coerceIn(10f, 26f) * density).toInt()
    listOf(R.id.weship_quick_photo, R.id.weship_quick_voice, R.id.weship_quick_note)
      .forEach { tile -> views.setViewPadding(tile, sidePx, topPx, sidePx, topPx) }

    views.setOnClickPendingIntent(
      R.id.weship_quick_photo,
      openApp(context, "weship://goodies?composer=photo", id)
    )
    views.setOnClickPendingIntent(
      R.id.weship_quick_voice,
      openApp(context, "weship://goodies?composer=voice&record=${System.currentTimeMillis()}", id)
    )
    views.setOnClickPendingIntent(
      R.id.weship_quick_note,
      openApp(context, "weship://goodies?composer=note", id)
    )
    manager.updateAppWidget(id, views)
  }

  private fun openApp(context: Context, deepLink: String, id: Int, template: Boolean = false): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).apply {
      setPackage(context.packageName)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or
      if (template) PendingIntent.FLAG_MUTABLE else PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getActivity(context, deepLink.hashCode() + id, intent, flags)
  }

  private fun action(context: Context, action: String, target: String, id: Int): PendingIntent {
    val intent = Intent(context, WidgetActionReceiver::class.java).apply {
      putExtra(WidgetActionReceiver.EXTRA_ACTION, action)
      putExtra(WidgetActionReceiver.EXTRA_TARGET, target)
    }
    return PendingIntent.getBroadcast(
      context,
      (action + target + id).hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }
}

/**
 * Each provider is only a thin entry point; drawing lives in `WeshipWidgets`.
 *
 * Public because the concrete providers below are instantiated by the platform
 * from the manifest, and Kotlin forbids a public class exposing an internal
 * supertype.
 */
abstract class WeshipWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { WeshipWidgets.render(context, manager, it, javaClass) }
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    manager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: Bundle,
  ) {
    // Samsung and several third-party launchers keep the initial layout until
    // the first resize/options callback. Always replace it with live data.
    WeshipWidgets.render(context, manager, appWidgetId, javaClass)
  }

  override fun onRestored(context: Context, oldWidgetIds: IntArray, newWidgetIds: IntArray) {
    val manager = AppWidgetManager.getInstance(context)
    newWidgetIds.forEach { WeshipWidgets.render(context, manager, it, javaClass) }
  }
}

class PartnerCarouselProvider : WeshipWidgetProvider()
class FriendsCarouselProvider : WeshipWidgetProvider()
class PresenceWidgetProvider : WeshipWidgetProvider()
class QuickSendWidgetProvider : WeshipWidgetProvider()
