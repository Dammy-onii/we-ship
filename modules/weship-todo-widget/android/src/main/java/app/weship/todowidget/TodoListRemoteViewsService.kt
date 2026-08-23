package app.weship.todowidget

import android.content.Context
import android.content.Intent
import android.graphics.Paint
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService

/**
 * Backs the scrollable 2do list.
 *
 * The widget previously drew a single task with plain `RemoteViews`, so a
 * shared list of any length looked like a list of one and there was nothing to
 * scroll. A `ListView` fed from here shows all of them.
 */
class TodoListRemoteViewsService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory =
    TodoListFactory(applicationContext)
}

private class TodoListFactory(private val context: Context) :
  RemoteViewsService.RemoteViewsFactory {

  private var tasks: List<WidgetStore.Task> = emptyList()

  override fun onCreate() {}

  override fun onDataSetChanged() {
    tasks = WidgetStore.tasks(context)
  }

  override fun onDestroy() {
    tasks = emptyList()
  }

  override fun getCount() = tasks.size

  override fun getViewAt(position: Int): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.weship_todo_row)
    val task = tasks.getOrNull(position) ?: return views

    views.setTextViewText(R.id.weship_row_label, task.label)
    views.setTextViewText(R.id.weship_row_routine, task.routine.uppercase())
    views.setImageViewResource(
      R.id.weship_row_status,
      if (task.done) R.drawable.weship_widget_checked else R.drawable.weship_widget_open_circle
    )
    // Struck through and faded, matching how the app draws a completed task.
    views.setInt(
      R.id.weship_row_label,
      "setPaintFlags",
      if (task.done) Paint.STRIKE_THRU_TEXT_FLAG or Paint.ANTI_ALIAS_FLAG else Paint.ANTI_ALIAS_FLAG
    )
    views.setTextColor(
      R.id.weship_row_label,
      context.getColor(
        if (task.done) R.color.weship_widget_secondary else R.color.weship_widget_text
      )
    )

    /*
     * Two fill-in intents, one template.
     *
     * A collection item cannot own a PendingIntent, so the provider sets one
     * template for the whole list and each row says what it wants done. A task
     * that needs a completion note can only be ticked in the app, so its circle
     * opens the list rather than writing a completion the database must reject.
     */
    views.setOnClickFillInIntent(
      R.id.weship_row_body,
      Intent().putExtra(WidgetActionReceiver.EXTRA_ACTION, WidgetActionReceiver.ACTION_OPEN_TODO)
    )
    views.setOnClickFillInIntent(
      R.id.weship_row_status,
      if (task.done || task.noteRequired || task.id.isEmpty()) {
        Intent().putExtra(WidgetActionReceiver.EXTRA_ACTION, WidgetActionReceiver.ACTION_OPEN_TODO)
      } else {
        Intent()
          .putExtra(WidgetActionReceiver.EXTRA_ACTION, WidgetActionReceiver.ACTION_COMPLETE_TASK)
          .putExtra(WidgetActionReceiver.EXTRA_TARGET, task.id)
      }
    )
    views.setViewVisibility(R.id.weship_row_root, View.VISIBLE)
    return views
  }

  override fun getLoadingView(): RemoteViews? = null

  override fun getViewTypeCount() = 1

  override fun getItemId(position: Int) =
    tasks.getOrNull(position)?.id?.hashCode()?.toLong() ?: position.toLong()

  override fun hasStableIds() = true
}
