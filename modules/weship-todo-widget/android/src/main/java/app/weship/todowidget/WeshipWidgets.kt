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
    "streak-question" to StreakQuestionProvider::class.java,
    "nudge" to NudgeWidgetProvider::class.java,
  )

  /** Redraws every placed instance of every widget. */
  fun refreshAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    providers.values.forEach { provider ->
      val ids = manager.getAppWidgetIds(ComponentName(context, provider))
      ids.forEach { render(context, manager, it, provider) }
      // A StackView caches its rows, so it must be told the data changed.
      if (provider == PartnerCarouselProvider::class.java ||
        provider == FriendsCarouselProvider::class.java
      ) {
        manager.notifyAppWidgetViewDataChanged(ids, R.id.weship_carousel_stack)
      }
    }
  }

  fun render(context: Context, manager: AppWidgetManager, id: Int, provider: Class<*>) {
    when (provider) {
      TopTodoWidgetProvider::class.java -> renderTodo(context, manager, id)
      PartnerCarouselProvider::class.java -> renderCarousel(context, manager, id, "partnerSlides")
      FriendsCarouselProvider::class.java -> renderCarousel(context, manager, id, "friendSlides")
      PresenceWidgetProvider::class.java -> renderPresence(context, manager, id)
      StreakQuestionProvider::class.java -> renderStreak(context, manager, id)
      NudgeWidgetProvider::class.java -> renderNudge(context, manager, id)
    }
  }

  private fun renderTodo(context: Context, manager: AppWidgetManager, id: Int) {
    val prefs = WidgetStore.prefs(context)
    val todo = WidgetStore.snapshot(context).optJSONObject("todo")
    val title = todo?.optString("label")?.takeIf { it.isNotEmpty() }
      ?: prefs.getString(KEY_TITLE, null)
    val taskId = todo?.optString("id").orEmpty()
    val noteRequired = todo?.optBoolean("noteRequired") ?: false
    // A tick made from the widget shows immediately, before the app confirms it.
    val optimisticallyDone = prefs.getBoolean(KEY_TODO_DONE, false)
    val empty = title == null || optimisticallyDone

    val views = RemoteViews(context.packageName, R.layout.weship_todo_widget)
    views.setTextViewText(
      R.id.weship_widget_task,
      if (empty) context.getString(R.string.weship_todo_widget_empty) else title
    )
    views.setTextViewText(
      R.id.weship_widget_routine,
      if (empty) context.getString(R.string.weship_todo_widget_open)
      else (todo?.optString("routine") ?: prefs.getString(KEY_ROUTINE, "")).orEmpty().uppercase()
    )
    views.setImageViewResource(
      R.id.weship_widget_status,
      if (empty) R.drawable.weship_widget_checked else R.drawable.weship_widget_open_circle
    )
    views.setOnClickPendingIntent(R.id.weship_widget_root, openApp(context, "weship://todo", id))
    // A required note needs the app's text prompt; never send a completion
    // that the database must reject or pretend it succeeded optimistically.
    if (!empty && taskId.isNotEmpty() && !noteRequired) {
      views.setOnClickPendingIntent(
        R.id.weship_widget_status,
        action(context, WidgetActionReceiver.ACTION_COMPLETE_TASK, taskId, id)
      )
    }
    manager.updateAppWidget(id, views)
  }

  private fun renderCarousel(context: Context, manager: AppWidgetManager, id: Int, key: String) {
    val views = RemoteViews(context.packageName, R.layout.weship_carousel_widget)
    val slides = WidgetStore.slides(context, key)

    views.setTextViewText(
      R.id.weship_carousel_label,
      context.getString(
        if (key == "partnerSlides") R.string.weship_partner_widget_name
        else R.string.weship_friends_widget_name
      ).uppercase()
    )

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
      openApp(context, if (key == "partnerSlides") "weship://spotlight" else "weship://friend-spotlight", id, template = true)
    )
    views.setTextViewText(
      R.id.weship_carousel_empty,
      context.getString(R.string.weship_carousel_empty)
    )
    manager.updateAppWidget(id, views)
    if (slides.isEmpty()) manager.notifyAppWidgetViewDataChanged(id, R.id.weship_carousel_stack)
  }

  private fun renderPresence(context: Context, manager: AppWidgetManager, id: Int) {
    val presence = WidgetStore.snapshot(context).optJSONObject("presence")
    val views = RemoteViews(context.packageName, R.layout.weship_presence_widget)
    if (presence == null) {
      views.setTextViewText(R.id.weship_presence_name, context.getString(R.string.weship_presence_empty))
      views.setTextViewText(R.id.weship_presence_mood, "")
      views.setTextViewText(R.id.weship_presence_meta, "")
    } else {
      views.setTextViewText(R.id.weship_presence_name, presence.optString("name"))
      val status = presence.optString("statusText").takeIf { it.isNotEmpty() }
      views.setTextViewText(
        R.id.weship_presence_mood,
        "${presence.optString("moodEmoji")}  ${status ?: presence.optString("mood")}"
      )
      // No clock when you share a timezone — it would just be your own time.
      val clock = presence.optString("localTime").takeIf { it.isNotEmpty() && it != "null" }
      views.setTextViewText(
        R.id.weship_presence_meta,
        clock ?: presence.optString("lastSeen")
      )
    }
    views.setOnClickPendingIntent(R.id.weship_presence_root, openApp(context, "weship://", id))
    manager.updateAppWidget(id, views)
  }

  private fun renderStreak(context: Context, manager: AppWidgetManager, id: Int) {
    val streak = WidgetStore.snapshot(context).optJSONObject("streak")
    val views = RemoteViews(context.packageName, R.layout.weship_streak_widget)
    val count = streak?.optInt("count") ?: 0
    views.setTextViewText(R.id.weship_streak_count, context.resources.getQuantityString(
      R.plurals.weship_streak_days, count, count
    ))
    views.setTextViewText(
      R.id.weship_streak_question,
      streak?.optString("questionText")?.takeIf { it.isNotEmpty() }
        ?: context.getString(R.string.weship_streak_no_question)
    )
    val youAnswered = streak?.optBoolean("youAnswered") ?: false
    val partnerAnswered = streak?.optBoolean("partnerAnswered") ?: false
    views.setTextViewText(
      R.id.weship_streak_status,
      context.getString(
        when {
          youAnswered && partnerAnswered -> R.string.weship_streak_both
          youAnswered -> R.string.weship_streak_waiting
          else -> R.string.weship_streak_your_turn
        }
      )
    )
    views.setOnClickPendingIntent(R.id.weship_streak_root, openApp(context, "weship://play/question", id))
    manager.updateAppWidget(id, views)
  }

  private fun renderNudge(context: Context, manager: AppWidgetManager, id: Int) {
    val views = RemoteViews(context.packageName, R.layout.weship_nudge_widget)
    val sentAt = WidgetStore.prefs(context).getLong(KEY_LAST_NUDGE, 0L)
    val justSent = sentAt > 0 && System.currentTimeMillis() - sentAt < 60_000
    views.setTextViewText(
      R.id.weship_nudge_status,
      context.getString(if (justSent) R.string.weship_nudge_sent else R.string.weship_nudge_prompt)
    )
    views.setOnClickPendingIntent(
      R.id.weship_nudge_heart,
      action(context, WidgetActionReceiver.ACTION_NUDGE, "heart", id)
    )
    views.setOnClickPendingIntent(
      R.id.weship_nudge_thinking,
      action(context, WidgetActionReceiver.ACTION_NUDGE, "thinkingOfYou", id)
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
class StreakQuestionProvider : WeshipWidgetProvider()
class NudgeWidgetProvider : WeshipWidgetProvider()
