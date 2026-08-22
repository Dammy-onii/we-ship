package app.weship.todowidget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.widget.RemoteViews
import android.widget.RemoteViewsService

/**
 * Backs the swipeable carousel.
 *
 * A `StackView` fed by a `RemoteViewsService` is the only way to get a real
 * finger-swipe inside an Android widget; anything else can auto-advance but
 * cannot be dragged.
 */
class CarouselRemoteViewsService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory =
    CarouselFactory(
      applicationContext,
      intent.getStringExtra(EXTRA_SOURCE) ?: "partnerSlides",
    )

  companion object {
    const val EXTRA_SOURCE = "weship_source"
  }
}

private class CarouselFactory(
  private val context: Context,
  private val source: String,
) : RemoteViewsService.RemoteViewsFactory {

  private var slides: List<WidgetStore.Slide> = emptyList()

  override fun onCreate() {}

  override fun onDataSetChanged() {
    slides = WidgetStore.slides(context, source)
  }

  override fun onDestroy() {
    slides = emptyList()
  }

  override fun getCount() = slides.size

  override fun getViewAt(position: Int): RemoteViews {
    val slide = slides.getOrNull(position) ?: return RemoteViews(context.packageName, R.layout.weship_carousel_item)
    val views = RemoteViews(context.packageName, R.layout.weship_carousel_item)

    val bitmap = slide.imageUri?.let { uri ->
      // Decoded at a bounded size: RemoteViews are delivered across a Binder
      // transaction with a hard size limit, and a full-resolution bitmap can
      // blow past it and take the whole widget host down.
      runCatching {
        val path = uri.removePrefix("file://")
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, bounds)
        val sample = maxOf(1, minOf(bounds.outWidth / 512, bounds.outHeight / 512))
        BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
      }.getOrNull()
    }

    if (bitmap != null) {
      views.setImageViewBitmap(R.id.weship_slide_image, bitmap)
      views.setViewVisibility(R.id.weship_slide_image, android.view.View.VISIBLE)
      views.setViewVisibility(R.id.weship_slide_note, android.view.View.GONE)
      views.setTextViewText(R.id.weship_slide_caption, slide.text.orEmpty())
      views.setViewVisibility(
        R.id.weship_slide_caption,
        if (slide.text.isNullOrEmpty()) android.view.View.GONE else android.view.View.VISIBLE
      )
    } else {
      // Notes — and any image that failed to decode — render as type.
      views.setViewVisibility(R.id.weship_slide_image, android.view.View.GONE)
      views.setViewVisibility(R.id.weship_slide_caption, android.view.View.GONE)
      views.setViewVisibility(R.id.weship_slide_note, android.view.View.VISIBLE)
      views.setTextViewText(R.id.weship_slide_note, slide.text.orEmpty())
    }

    views.setTextViewText(
      R.id.weship_slide_author,
      if (slide.pinned) "📌 ${slide.author}" else slide.author
    )
    views.setViewVisibility(
      R.id.weship_slide_play,
      if (slide.kind == "video") android.view.View.VISIBLE else android.view.View.GONE
    )

    // Filled in from the widget's pending-intent template.
    views.setOnClickFillInIntent(R.id.weship_slide_root, Intent())
    return views
  }

  // Null means the platform reuses the default loading view.
  override fun getLoadingView(): RemoteViews? = null

  override fun getViewTypeCount() = 1

  override fun getItemId(position: Int) = slides.getOrNull(position)?.id?.hashCode()?.toLong() ?: position.toLong()

  override fun hasStableIds() = true
}
