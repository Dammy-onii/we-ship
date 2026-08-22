package app.weship.todowidget

import android.appwidget.AppWidgetManager
import android.content.Context

/** Kept as its own class so existing placed widgets keep working. */
class TopTodoWidgetProvider : WeshipWidgetProvider() {
  companion object {
    fun update(context: Context, manager: AppWidgetManager, widgetId: Int) {
      WeshipWidgets.render(context, manager, widgetId, TopTodoWidgetProvider::class.java)
    }
  }
}
