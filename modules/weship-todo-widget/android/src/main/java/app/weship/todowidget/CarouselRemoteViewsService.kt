package app.weship.todowidget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.widget.RemoteViews
import android.widget.RemoteViewsService

/**
 * Backs the flat carousel.
 *
 * `AdapterViewFlipper` shows one item at a time without the depth/cropping a
 * StackView applies. Android RemoteViews provides no horizontal drag gesture
 * for this view, so the widget exposes previous/next controls instead.
 */
class CarouselRemoteViewsService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory =
    CarouselFactory(
      applicationContext,
      intent.getStringExtra(EXTRA_SOURCE) ?: "partnerSlides",
    )

  companion object {
    const val EXTRA_SOURCE = "weship_source"

    /**
     * How many slides stand in when the deck is empty.
     *
     * The widget chrome reads this so its counter and arrows agree with what
     * the adapter is actually showing.
     */
    const val PLACEHOLDER_COUNT = 2
  }
}

private class CarouselFactory(
  private val context: Context,
  private val source: String,
) : RemoteViewsService.RemoteViewsFactory {

  private var slides: List<WidgetStore.Slide> = emptyList()
  /** Where the rotated list starts, so a slide can report its true position. */
  private var offset = 0

  override fun onCreate() {}

  /**
   * What an empty deck shows: one picture, one note, as real slides.
   *
   * Not a static "nothing here" panel. This surface is a carousel, and the two
   * things it carries are pictures and notes — so an empty one demonstrates
   * both, and the arrows still work. A flat message would have taught nothing
   * about what the widget is for.
   */
  private fun placeholders(): List<WidgetStore.Slide> = listOf(
    WidgetStore.Slide(
      id = PLACEHOLDER_PHOTO,
      kind = "photo",
      imageUri = null,
      text = context.getString(
        if (source == "partnerSlides") R.string.weship_carousel_empty
        else R.string.weship_carousel_empty_friends
      ),
      author = context.getString(R.string.weship_carousel_sample_label),
      favourite = false,
      route = null,
    ),
    WidgetStore.Slide(
      id = PLACEHOLDER_NOTE,
      kind = "note",
      imageUri = null,
      text = context.getString(R.string.weship_carousel_sample_note),
      author = context.getString(R.string.weship_carousel_sample_label),
      favourite = false,
      route = null,
    ),
  )

  override fun onDataSetChanged() {
    val all = WidgetStore.slides(context, source).ifEmpty { placeholders() }
    /*
     * Rotated so the current slide is first.
     *
     * The flipper always shows position 0 after its data changes, so moving the
     * list is what actually moves the carousel. Asking the flipper itself to
     * advance did not survive the trip through RemoteViews on every launcher.
     */
    slides = if (all.size < 2) all else {
      offset = ((WidgetStore.carouselOffset(context, source) % all.size) + all.size) % all.size
      all.subList(offset, all.size) + all.subList(0, offset)
    }
  }

  override fun onDestroy() {
    slides = emptyList()
  }

  override fun getCount() = slides.size

  override fun getViewAt(position: Int): RemoteViews {
    val slide = slides.getOrNull(position) ?: return RemoteViews(context.packageName, R.layout.weship_carousel_item)
    val views = RemoteViews(context.packageName, R.layout.weship_carousel_item)
    val secondaryColor = context.getColor(R.color.weship_widget_secondary)

    if (slide.id == PLACEHOLDER_PHOTO) {
      // A drawable resource, not a decoded file: the landscape is a vector, so
      // it costs nothing across the Binder and stays sharp at any size.
      views.setImageViewResource(R.id.weship_slide_image, R.drawable.weship_widget_peaks)
      views.setInt(R.id.weship_slide_root, "setBackgroundResource", R.drawable.weship_widget_sky)
      views.setViewVisibility(R.id.weship_slide_image, android.view.View.VISIBLE)
      views.setViewVisibility(R.id.weship_slide_note, android.view.View.GONE)
      views.setViewVisibility(R.id.weship_slide_play, android.view.View.GONE)
      views.setTextViewText(R.id.weship_slide_caption, slide.text.orEmpty())
      views.setViewVisibility(R.id.weship_slide_caption, android.view.View.VISIBLE)
      views.setTextViewText(R.id.weship_slide_author, slide.author)
      views.setTextViewText(R.id.weship_slide_source, sourceLabel(position))
      views.setOnClickFillInIntent(R.id.weship_slide_root, Intent())
      return views
    }

    val bitmap = slide.imageUri?.let { uri ->
      val path = uri.removePrefix("file://")
      // A video is cached as the video file itself — there is no separate
      // poster — so BitmapFactory returns null for it and the slide used to
      // fall through to the note branch and draw an empty card. Pull a frame
      // out of the file instead.
      if (slide.kind == "video") videoFrame(path) else stillImage(path)
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
      // Notes — and any image that failed to decode — render as type. The
      // bottom track would be an unreadable dark bar over the pale card, so it
      // is dropped and the author moves into the note's own space.
      views.setViewVisibility(R.id.weship_slide_image, android.view.View.GONE)
      views.setViewVisibility(R.id.weship_slide_caption, android.view.View.GONE)
      views.setViewVisibility(R.id.weship_slide_note, android.view.View.VISIBLE)
      views.setTextViewText(R.id.weship_slide_note, slide.text.orEmpty())
      views.setInt(R.id.weship_slide_track, "setBackgroundColor", android.graphics.Color.TRANSPARENT)
      views.setTextColor(R.id.weship_slide_author, secondaryColor)
      views.setTextColor(R.id.weship_slide_source, secondaryColor)
      views.setInt(R.id.weship_slide_source, "setBackgroundResource", 0)
    }

    views.setTextViewText(
      R.id.weship_slide_author,
      if (slide.favourite) "★ ${slide.author}" else slide.author
    )

    // The source and this slide's place in the deck, drawn on the slide itself.
    // Both used to live on the widget root, which forced a strip of bare card
    // above the photo.
    views.setTextViewText(R.id.weship_slide_source, sourceLabel(position))
    views.setViewVisibility(
      R.id.weship_slide_play,
      if (slide.kind == "video") android.view.View.VISIBLE else android.view.View.GONE
    )

    // Fills the template with this slide's own link, so a tap opens the item
    // being looked at. An empty Intent here meant every slide fell back to the
    // template's URL and opened the top of the gallery instead.
    views.setOnClickFillInIntent(
      R.id.weship_slide_root,
      slide.route?.let { Intent().setData(android.net.Uri.parse(it)) } ?: Intent()
    )
    return views
  }

  // Null means the platform reuses the default loading view.
  override fun getLoadingView(): RemoteViews? = null

  override fun getViewTypeCount() = 1

  override fun getItemId(position: Int) = slides.getOrNull(position)?.id?.hashCode()?.toLong() ?: position.toLong()

  override fun hasStableIds() = true

  /**
   * "WESHIP US  2/7" — the source, and this slide's place in the deck.
   *
   * Counted against the real order rather than the rotated one, so the number
   * stays truthful whether the flipper advanced itself or an arrow did.
   */
  private fun sourceLabel(position: Int): String =
    context.getString(
      if (source == "partnerSlides") R.string.weship_partner_widget_name
      else R.string.weship_friends_widget_name
    ).uppercase() + if (slides.size > 1) {
      "  ${(offset + position) % slides.size + 1}/${slides.size}"
    } else ""

  /**
   * Decoded at a bounded size: RemoteViews are delivered across a Binder
   * transaction with a hard size limit, and a full-resolution bitmap can blow
   * past it and take the whole widget host down.
   *
   * Bounds the *longest* edge — an earlier version used the shorter one, so
   * portrait and panorama previews could still decode to multi-megabyte
   * bitmaps and leave the launcher showing "Can't load widget".
   */
  private fun stillImage(path: String): Bitmap? = runCatching {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, bounds)
    val longest = maxOf(bounds.outWidth, bounds.outHeight)
    var sample = 1
    while (longest / sample > MAX_EDGE_PX) sample *= 2
    BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
  }.getOrNull()

  /** First readable frame of a cached video, scaled to the same budget. */
  private fun videoFrame(path: String): Bitmap? = runCatching {
    // Not `use` — MediaMetadataRetriever only became AutoCloseable in API 29
    // and this module still supports older devices.
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(path)
      val frame = retriever.getFrameAtTime(0) ?: return@runCatching null
      val longest = maxOf(frame.width, frame.height)
      if (longest <= MAX_EDGE_PX) frame
      else {
        val scale = MAX_EDGE_PX.toFloat() / longest
        Bitmap.createScaledBitmap(
          frame,
          (frame.width * scale).toInt().coerceAtLeast(1),
          (frame.height * scale).toInt().coerceAtLeast(1),
          true,
        )
      }
    } finally {
      retriever.release()
    }
  }.getOrNull()
}

/** Longest edge a widget bitmap may have before the Binder limit is a risk. */
private const val MAX_EDGE_PX = 360

/** Ids for the two stand-in slides an empty deck shows. */
private const val PLACEHOLDER_PHOTO = "__weship_placeholder_photo__"
private const val PLACEHOLDER_NOTE = "__weship_placeholder_note__"
