package app.weship.todowidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
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
          manager.notifyAppWidgetViewDataChanged(ids, R.id.weship_carousel_stack)
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
    views.setRemoteAdapter(R.id.weship_carousel_stack, intent)
    views.setEmptyView(R.id.weship_carousel_stack, R.id.weship_carousel_empty)

    // A StackView is a real swipe surface: this is what makes the carousel
    // draggable by hand rather than only auto-advancing.
    views.setPendingIntentTemplate(
      R.id.weship_carousel_stack,
      openApp(
        context,
        if (friends) "weship://friend-spotlight" else "weship://spotlight",
        id,
        template = true
      )
    )
    views.setTextViewText(
      R.id.weship_carousel_empty_text,
      context.getString(
        if (friends) R.string.weship_carousel_empty_friends else R.string.weship_carousel_empty
      )
    )
    // The empty state is the only thing on screen when there is nothing to
    // show, so it has to be tappable itself — the stack behind it is not.
    views.setOnClickPendingIntent(
      R.id.weship_carousel_empty,
      openApp(context, if (friends) "weship://friends" else "weship://goodies", id)
    )

    /*
     * Arrows, and whether to show them at all.
     *
     * A single slide has nothing to swipe to and nothing to advance to, which
     * read as a carousel that was simply broken. With one item the controls are
     * hidden rather than left there doing nothing.
     */
    val navigable = slides.size > 1
    views.setViewVisibility(
      R.id.weship_carousel_controls,
      if (navigable) android.view.View.VISIBLE else android.view.View.GONE
    )
    if (navigable) {
      views.setTextViewText(R.id.weship_carousel_counter, "${slides.size}")
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
    manager.notifyAppWidgetViewDataChanged(id, R.id.weship_carousel_stack)
  }

  /**
   * Steps a placed carousel one slide along without redrawing it.
   *
   * `partiallyUpdateAppWidget` is required here: a full `updateAppWidget` would
   * rebuild the RemoteViews and reset the stack to its first item, so the arrow
   * would appear to do nothing.
   */
  fun step(context: Context, provider: Class<out AppWidgetProvider>, forward: Boolean) {
    val manager = AppWidgetManager.getInstance(context)
    manager.getAppWidgetIds(ComponentName(context, provider)).forEach { id ->
      val views = RemoteViews(context.packageName, R.layout.weship_carousel_widget)
      if (forward) views.showNext(R.id.weship_carousel_stack)
      else views.showPrevious(R.id.weship_carousel_stack)
      manager.partiallyUpdateAppWidget(id, views)
    }
  }

  private fun renderPresence(context: Context, manager: AppWidgetManager, id: Int) {
    val presence = WidgetStore.snapshot(context).optJSONObject("presence")
    val views = RemoteViews(context.packageName, R.layout.weship_presence_widget)
    if (presence == null) {
      views.setTextViewText(R.id.weship_presence_name, context.getString(R.string.weship_presence_empty))
      views.setTextViewText(R.id.weship_presence_mood, "")
      views.setTextViewText(R.id.weship_presence_meta, "")
      views.setViewVisibility(R.id.weship_presence_task, android.view.View.GONE)
      views.setViewVisibility(R.id.weship_presence_streak, android.view.View.GONE)
    } else {
      views.setTextViewText(R.id.weship_presence_name, presence.optString("name"))
      val status = presence.optString("statusText").takeIf { it.isNotEmpty() }
      views.setTextViewText(
        R.id.weship_presence_mood,
        "${presence.optString("moodEmoji")}  ${status ?: presence.optString("mood")}"
      )

      // Falls through the same way the iOS widget does: their clock is only
      // worth showing when it differs from yours, so a shared timezone gets the
      // last thing you sent each other instead.
      val clock = presence.optString("localTime").takeIf { it.isNotEmpty() && it != "null" }
      val exchange = presence.optString("lastExchange").takeIf { it.isNotEmpty() }
      views.setTextViewText(
        R.id.weship_presence_meta,
        (clock ?: exchange ?: presence.optString("lastSeen")).uppercase()
      )

      val task = presence.optString("pendingTask").takeIf { it.isNotEmpty() }
      views.setTextViewText(R.id.weship_presence_task, task?.let { "○  $it" }.orEmpty())
      views.setViewVisibility(
        R.id.weship_presence_task,
        if (task == null) android.view.View.GONE else android.view.View.VISIBLE
      )

      val streak = WidgetStore.snapshot(context).optJSONObject("streak")?.optInt("count") ?: 0
      views.setTextViewText(R.id.weship_presence_streak, if (streak > 0) "🔥 $streak" else "")
      views.setViewVisibility(
        R.id.weship_presence_streak,
        if (streak > 0) android.view.View.VISIBLE else android.view.View.GONE
      )
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
}

class PartnerCarouselProvider : WeshipWidgetProvider()
class FriendsCarouselProvider : WeshipWidgetProvider()
class PresenceWidgetProvider : WeshipWidgetProvider()
class QuickSendWidgetProvider : WeshipWidgetProvider()
