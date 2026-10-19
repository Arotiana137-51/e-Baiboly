package com.ebaiboly.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.Spannable
import android.text.SpannableString
import android.text.style.RelativeSizeSpan
import android.text.style.StyleSpan
import android.text.style.TypefaceSpan
import android.util.SizeF
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import androidx.core.graphics.ColorUtils
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Home-screen daily verse widget. Pure display: the app (JS) writes
 * dailyVerse.json into filesDir on every launch — one entry per local day for
 * the next two months, the chosen look and text settings, and per day a deep
 * link, the mode and whether the verse is a favorite — and this only renders
 * today's entry (see src/services/widget/dailyVerseWidget.ts for the
 * contract). The verse calendar itself lives in JS and is never duplicated
 * here.
 *
 * The look is the share card's: a flat colour with matching ink, or a photo
 * (copied next to the feed) under a veil. RemoteViews can only set solid
 * colours, so the card is painted into a bitmap sized to the placed widget:
 * the photo, or plain white tinted with the look's colour. The chosen
 * typeface and text size travel as spans on the verse.
 *
 * With "follow dark mode" the feed also has a night look. Android 12+ gets
 * both colours for every view (setColorInt) and the launcher switches them
 * itself when the phone's dark mode changes; older versions get the colours
 * of the mode at render time, so they follow within updatePeriodMillis.
 *
 * The heart adds the verse to the app's favorites, or takes it out, without
 * opening the app: WidgetHeartReceiver records the wanted state in
 * widgetFavorites.json, the widget shows it at once, and the app folds it
 * into its favorites the next time it comes to the front.
 *
 * One layout, three size classes (see Size): the verse grows with the card and
 * the small class drops the secondary items. On Android 12+ the launcher gets
 * all three at once and picks the best match itself on every resize or
 * rotation; older versions get the one matching the placed size.
 *
 * Refreshed by the launcher every updatePeriodMillis (widget_daily_verse_info)
 * and explicitly by DailyVerseWidgetModule.refresh() after the file changes.
 */
class DailyVerseWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val feed = readFeed(context)
        for (id in ids) {
            manager.updateAppWidget(id, responsive(context, feed, manager.getAppWidgetOptions(id)))
        }
    }

    // Pre-12 only: the launcher does not swap size classes itself, so re-bind
    // for the new size. On 12+ this is redundant but harmless.
    override fun onAppWidgetOptionsChanged(
        context: Context,
        manager: AppWidgetManager,
        id: Int,
        options: Bundle,
    ) {
        manager.updateAppWidget(id, responsive(context, readFeed(context), options))
    }

    // Widget cells are ~70dp each; thresholds in dp of the placed size.
    // verseSp only applies below API 26: from 26 the layout's autosize picks
    // the size and setTextSize is a no-op. verseLines is a safety cap, set
    // high enough that the card's height, not the line count, is the limit.
    private enum class Size(val verseSp: Float, val verseLines: Int, val minimal: Boolean) {
        SMALL(13f, 7, true),
        MEDIUM(15f, 7, false),
        LARGE(16f, 14, false);

        companion object {
            fun of(widthDp: Float, heightDp: Float): Size = when {
                widthDp < 200f -> SMALL
                heightDp >= 250f -> LARGE
                else -> MEDIUM
            }
        }
    }

    private fun responsive(context: Context, feed: Feed?, options: Bundle?): RemoteViews {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Smallest size each class is designed for; the launcher picks the
            // largest one that fits the current cell size.
            val sizes = listOf(SizeF(110f, 110f), SizeF(250f, 110f), SizeF(250f, 250f))
            return RemoteViews(sizes.associateWith { build(context, feed, it.width, it.height) })
        }
        // Portrait size of the placed widget in dp; fall back to 4x2 cells.
        val widthDp = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)?.takeIf { it > 0 } ?: 250
        val heightDp = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)?.takeIf { it > 0 } ?: 110
        return build(context, feed, widthDp.toFloat(), heightDp.toFloat())
    }

    // `veil`: the colour laid over a photo, alpha included.
    private data class Look(val background: Int, val text: Int, val accent: Int, val image: String?, val veil: Int?)

    private data class Feed(
        val look: Look,
        // Night version of `look`; null when the widget ignores dark mode.
        val night: Look?,
        // The day's mode ("Fampaherezana", a plan's "Teny ho anao · 5/21").
        val label: String,
        val translation: String,
        val dateLabel: String,
        val ref: String,
        val text: String,
        val url: String?,
        val scale: Float,
        val font: String,
        // The verse for the heart; null on a check-in day.
        val key: String?,
        val favorite: Boolean,
    )

    private fun readFeed(context: Context): Feed? {
        return try {
            val file = File(context.filesDir, FILE_NAME)
            if (!file.exists()) return null
            val root = JSONObject(file.readText())
            val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
            val entry = root.getJSONObject("days").optJSONObject(today) ?: return null
            val text = root.optJSONObject("text")
            val key = entry.optString("key", "").takeIf { it.isNotEmpty() }
            Feed(
                look = parseLook(root.optJSONObject("look")),
                night = root.optJSONObject("lookDark")?.let { parseLook(it) },
                label = entry.optString("label", "").ifEmpty { root.optString("label", "") },
                translation = root.optString("translation", ""),
                dateLabel = entry.optString("dateLabel", ""),
                ref = entry.optString("ref", ""),
                text = entry.optString("text", ""),
                url = entry.optString("url", null),
                scale = text?.optDouble("scale", 1.0)?.toFloat() ?: 1f,
                font = text?.optString("font", "serif") ?: "serif",
                key = key,
                // A heart tapped since the app last looked wins over the feed.
                favorite = key?.let { readHearts(context).optBoolean(it, entry.optBoolean("fav", false)) } ?: false,
            )
        } catch (e: Exception) {
            null
        }
    }

    private fun parseLook(look: JSONObject?) = Look(
        background = parseColor(look?.optString("background", ""), DEFAULT_ACCENT),
        text = parseColor(look?.optString("text", ""), Color.WHITE),
        accent = parseColor(look?.optString("accent", ""), Color.WHITE),
        image = look?.optString("image", null)?.takeIf { it.isNotEmpty() && it != "null" },
        veil = look?.optJSONObject("veil")?.let {
            ColorUtils.setAlphaComponent(parseColor(it.optString("color", ""), Color.BLACK), (it.optDouble("alpha", 0.45) * 255).toInt())
        },
    )

    // The verse in the chosen typeface and size. RemoteViews carries these
    // spans, so no layout per typeface is needed.
    private fun styledVerse(text: String, font: String, scale: Float): CharSequence =
        SpannableString(text).apply {
            val whole = Spannable.SPAN_INCLUSIVE_EXCLUSIVE
            setSpan(TypefaceSpan(if (font == "sans") "sans-serif" else "serif"), 0, length, whole)
            if (font == "italic") setSpan(StyleSpan(Typeface.ITALIC), 0, length, whole)
            if (scale != 1f) setSpan(RelativeSizeSpan(scale), 0, length, whole)
        }

    private fun build(context: Context, feed: Feed?, widthDp: Float, heightDp: Float): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_daily_verse)
        val day = feed?.look ?: Look(DEFAULT_ACCENT, Color.WHITE, Color.WHITE, null, null)
        val night = feed?.night ?: day
        val nightNow = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES

        // Day and night colour for one view property (see the class comment).
        fun color(id: Int, method: String, dayColor: Int, nightColor: Int) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                views.setColorInt(id, method, dayColor, nightColor)
            } else {
                views.setInt(id, method, if (nightNow) nightColor else dayColor)
            }
        }
        fun ink(look: Look, alpha: Int) = ColorUtils.setAlphaComponent(look.text, alpha)

        val (card, isPhoto) = paintCard(context, day, widthDp, heightDp)
        views.setImageViewBitmap(R.id.widget_bg, card)
        // A transparent filter is no tint: views are re-applied over the
        // previous ones, so an earlier colour's tint has to be cleared.
        color(
            R.id.widget_bg,
            "setColorFilter",
            if (isPhoto) Color.TRANSPARENT else day.background,
            if (isPhoto) Color.TRANSPARENT else night.background,
        )

        val size = Size.of(widthDp, heightDp)
        views.setTextViewTextSize(R.id.widget_text, TypedValue.COMPLEX_UNIT_SP, size.verseSp)
        views.setInt(R.id.widget_text, "setMaxLines", size.verseLines)
        val secondary = if (size.minimal) View.GONE else View.VISIBLE
        views.setViewVisibility(R.id.widget_label, secondary)
        views.setViewVisibility(R.id.widget_settings, secondary)
        views.setViewVisibility(R.id.widget_settings_hit, secondary)

        // Ink: the look's text colour at full strength for the verse, badge and
        // heart, dimmed for the secondary items; the reference takes the accent.
        color(R.id.widget_date, "setTextColor", ink(day, 230), ink(night, 230))
        color(R.id.widget_heart, "setColorFilter", ink(day, 230), ink(night, 230))
        color(R.id.widget_label, "setTextColor", ink(day, 179), ink(night, 179))
        color(R.id.widget_text, "setTextColor", day.text, night.text)
        color(R.id.widget_ref, "setTextColor", day.accent, night.accent)
        color(R.id.widget_translation, "setTextColor", ink(day, 153), ink(night, 153))
        color(R.id.widget_divider, "setBackgroundColor", ink(day, 51), ink(night, 51))
        color(R.id.widget_settings_icon, "setColorFilter", ink(day, 179), ink(night, 179))

        // Pills behind the date and the translation, for light or dark ink. A
        // light look whose night version has light ink gets the *_auto ones:
        // the launcher picks their drawable-night version itself.
        val lightDay = ColorUtils.calculateLuminance(day.text) > 0.5
        val lightNight = ColorUtils.calculateLuminance(night.text) > 0.5
        val (badge, tag) = when {
            lightDay -> R.drawable.widget_badge to R.drawable.widget_tag
            lightNight -> R.drawable.widget_badge_auto to R.drawable.widget_tag_auto
            else -> R.drawable.widget_badge_dark to R.drawable.widget_tag_dark
        }
        views.setInt(R.id.widget_date, "setBackgroundResource", badge)
        views.setInt(R.id.widget_translation, "setBackgroundResource", tag)

        if (feed == null) {
            // No feed yet (fresh install, or the app hasn't been opened in two
            // months): invite the user in. Placeholder MG copy — user-owned.
            views.setTextViewText(R.id.widget_date, context.getString(R.string.app_name))
            views.setTextViewText(R.id.widget_label, "")
            views.setTextViewText(R.id.widget_text, "Sokafy ny e-Baiboly hahitana ny andinin-teny androany.")
            views.setViewVisibility(R.id.widget_ref, View.GONE)
            views.setViewVisibility(R.id.widget_translation, View.GONE)
            views.setViewVisibility(R.id.widget_heart, View.GONE)
        } else {
            views.setTextViewText(R.id.widget_date, feed.dateLabel)
            views.setTextViewText(R.id.widget_label, feed.label)
            // Quotes around a verse; the check-in card's question stays bare.
            val body = if (feed.key != null) "“${feed.text}”" else feed.text
            views.setTextViewText(R.id.widget_text, styledVerse(body, feed.font, feed.scale))
            views.setViewVisibility(R.id.widget_ref, View.VISIBLE)
            views.setTextViewText(R.id.widget_ref, feed.ref)
            views.setViewVisibility(
                R.id.widget_translation,
                if (feed.translation.isEmpty() || size.minimal) View.GONE else View.VISIBLE,
            )
            views.setTextViewText(R.id.widget_translation, feed.translation)
            bindHeart(context, views, feed)
        }

        val intent = if (feed?.url != null) {
            Intent(Intent.ACTION_VIEW, Uri.parse(feed.url), context, MainActivity::class.java)
        } else {
            Intent(context, MainActivity::class.java)
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pending = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(R.id.widget_root, pending)

        // The glyph at the end of the bottom line is a one-tap shortcut to the
        // look picker (App.tsx routes ebaiboly://widget-look to Safidio ny loko).
        val settings = Intent(Intent.ACTION_VIEW, Uri.parse(SETTINGS_URL), context, MainActivity::class.java)
        settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        views.setOnClickPendingIntent(
            R.id.widget_settings_hit,
            PendingIntent.getActivity(context, 1, settings, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
        )
        return views
    }

    // Filled when the verse is a favorite; a tap asks for the opposite.
    private fun bindHeart(context: Context, views: RemoteViews, feed: Feed) {
        val key = feed.key
        if (key == null) {
            views.setViewVisibility(R.id.widget_heart, View.GONE)
            return
        }
        views.setViewVisibility(R.id.widget_heart, View.VISIBLE)
        views.setImageViewResource(
            R.id.widget_heart,
            if (feed.favorite) R.drawable.ic_widget_heart_filled else R.drawable.ic_widget_heart,
        )
        val toggle = Intent(context, WidgetHeartReceiver::class.java).apply {
            putExtra(EXTRA_KEY, key)
            putExtra(EXTRA_ON, !feed.favorite)
        }
        views.setOnClickPendingIntent(
            R.id.widget_heart,
            PendingIntent.getBroadcast(context, 2, toggle, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
        )
    }

    /**
     * Rounded card: the photo (centre-cropped, under the look's veil), or
     * plain white for build() to tint with the look's colour. The flag says
     * which it is.
     */
    private fun paintCard(context: Context, look: Look, widthDp: Float, heightDp: Float): Pair<Bitmap, Boolean> {
        val density = context.resources.displayMetrics.density
        val width = (widthDp * density).toInt().coerceIn(1, MAX_BITMAP_EDGE)
        val height = (heightDp * density).toInt().coerceIn(1, MAX_BITMAP_EDGE)

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val radius = CORNER_RADIUS_DP * density
        val bounds = RectF(0f, 0f, width.toFloat(), height.toFloat())
        canvas.clipPath(Path().apply { addRoundRect(bounds, radius, radius, Path.Direction.CW) })

        val photo = look.image?.let { decodePhoto(File(context.filesDir, it), width, height) }
        if (photo != null) {
            val scale = maxOf(width.toFloat() / photo.width, height.toFloat() / photo.height)
            val matrix = Matrix().apply {
                setScale(scale, scale)
                postTranslate((width - photo.width * scale) / 2f, (height - photo.height * scale) / 2f)
            }
            canvas.drawBitmap(photo, matrix, Paint(Paint.FILTER_BITMAP_FLAG))
            canvas.drawColor(look.veil ?: SCRIM)
        } else {
            canvas.drawColor(Color.WHITE)
        }
        return bitmap to (photo != null)
    }

    // Decodes at the smallest power-of-two sample that still covers the card.
    private fun decodePhoto(file: File, width: Int, height: Int): Bitmap? {
        if (!file.exists()) return null
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= width && bounds.outHeight / (sample * 2) >= height) sample *= 2
        return BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
    }

    private fun parseColor(hex: String?, fallback: Int): Int =
        try {
            if (hex.isNullOrEmpty()) fallback else Color.parseColor(hex)
        } catch (e: IllegalArgumentException) {
            fallback
        }

    companion object {
        const val FILE_NAME = "dailyVerse.json"
        // Hearts tapped on the widget, {"19:23:1": true}; read and cleared by the app.
        private const val HEARTS_FILE_NAME = "widgetFavorites.json"
        const val EXTRA_KEY = "key"
        const val EXTRA_ON = "on"
        private const val SETTINGS_URL = "ebaiboly://widget-look"
        // Same as DEFAULT_PRIMARY_COLOR_ID's hex in src/theme/personalizationPalette.ts.
        private const val DEFAULT_ACCENT = 0xFF007991.toInt()
        // rgba(0, 0, 0, 0.45), as on the share card.
        private const val SCRIM = 0x73000000
        private const val CORNER_RADIUS_DP = 24f
        // Keeps the RemoteViews bitmap well under Android's transaction limit.
        private const val MAX_BITMAP_EDGE = 1400

        private fun readHearts(context: Context): JSONObject {
            val file = File(context.filesDir, HEARTS_FILE_NAME)
            return try {
                if (file.exists()) JSONObject(file.readText()) else JSONObject()
            } catch (e: Exception) {
                JSONObject()
            }
        }

        fun recordHeart(context: Context, key: String, on: Boolean) {
            val hearts = readHearts(context).put(key, on)
            File(context.filesDir, HEARTS_FILE_NAME).writeText(hearts.toString())
        }

        /** Re-render every placed instance; called from JS after the feed file is rewritten. */
        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, DailyVerseWidgetProvider::class.java))
            if (ids.isEmpty()) return
            val intent = Intent(context, DailyVerseWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }
    }
}
