package com.ebaiboly.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import androidx.core.graphics.ColorUtils
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Home-screen "Sakafom-panahy" widget. Pure display: the app (JS) writes
 * dailyVerse.json into filesDir on every launch — one entry per local day for
 * the next two months, the chosen look and a deep link — and this only
 * renders today's entry (see src/services/widget/dailyVerseWidget.ts for the
 * contract). The verse calendar itself lives in JS and is never duplicated
 * here.
 *
 * The look is the share card's: a flat colour with matching ink, or a photo
 * (copied next to the feed) under a dark scrim with light ink. RemoteViews
 * can only set solid colours, so the card is painted into a bitmap sized to
 * the placed widget.
 *
 * Refreshed by the launcher every updatePeriodMillis (widget_daily_verse_info)
 * and explicitly by DailyVerseWidgetModule.refresh() after the file changes.
 */
class DailyVerseWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val feed = readFeed(context)
        for (id in ids) {
            manager.updateAppWidget(id, build(context, feed, manager.getAppWidgetOptions(id)))
        }
    }

    // Resizing changes the bitmap size the card is painted at.
    override fun onAppWidgetOptionsChanged(
        context: Context,
        manager: AppWidgetManager,
        id: Int,
        options: Bundle,
    ) {
        manager.updateAppWidget(id, build(context, readFeed(context), options))
    }

    private data class Look(val background: Int, val text: Int, val accent: Int, val image: String?)

    private data class Feed(
        val look: Look,
        val label: String,
        val translation: String,
        val dateLabel: String,
        val ref: String,
        val text: String,
        val url: String?,
    )

    private fun readFeed(context: Context): Feed? {
        return try {
            val file = File(context.filesDir, FILE_NAME)
            if (!file.exists()) return null
            val root = JSONObject(file.readText())
            val key = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
            val entry = root.getJSONObject("days").optJSONObject(key) ?: return null
            val look = root.optJSONObject("look")
            Feed(
                look = Look(
                    background = parseColor(look?.optString("background", ""), DEFAULT_ACCENT),
                    text = parseColor(look?.optString("text", ""), Color.WHITE),
                    accent = parseColor(look?.optString("accent", ""), Color.WHITE),
                    image = look?.optString("image", null)?.takeIf { it.isNotEmpty() && it != "null" },
                ),
                label = root.optString("label", ""),
                translation = root.optString("translation", ""),
                dateLabel = entry.optString("dateLabel", ""),
                ref = entry.optString("ref", ""),
                text = entry.optString("text", ""),
                url = entry.optString("url", null),
            )
        } catch (e: Exception) {
            null
        }
    }

    private fun build(context: Context, feed: Feed?, options: Bundle?): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_daily_verse)
        val look = feed?.look ?: Look(DEFAULT_ACCENT, Color.WHITE, Color.WHITE, null)
        views.setImageViewBitmap(R.id.widget_bg, paintCard(context, look, options))

        // Ink: the look's text colour at full strength for the verse and badge,
        // dimmed for the secondary lines; the reference takes the accent.
        val ink = look.text
        val lightInk = ColorUtils.calculateLuminance(ink) > 0.5
        views.setTextColor(R.id.widget_date, ColorUtils.setAlphaComponent(ink, 230))
        views.setTextColor(R.id.widget_label, ColorUtils.setAlphaComponent(ink, 179))
        views.setTextColor(R.id.widget_text, ink)
        views.setTextColor(R.id.widget_ref, look.accent)
        views.setTextColor(R.id.widget_translation, ColorUtils.setAlphaComponent(ink, 153))
        views.setInt(R.id.widget_divider, "setBackgroundColor", ColorUtils.setAlphaComponent(ink, 51))
        views.setInt(R.id.widget_date, "setBackgroundResource", if (lightInk) R.drawable.widget_badge else R.drawable.widget_badge_dark)
        views.setInt(R.id.widget_translation, "setBackgroundResource", if (lightInk) R.drawable.widget_tag else R.drawable.widget_tag_dark)
        views.setInt(R.id.widget_settings, "setColorFilter", ColorUtils.setAlphaComponent(ink, 179))

        if (feed == null) {
            // No feed yet (fresh install, or the app hasn't been opened in two
            // months): invite the user in. Placeholder MG copy — user-owned.
            views.setTextViewText(R.id.widget_date, context.getString(R.string.app_name))
            views.setTextViewText(R.id.widget_label, "")
            views.setTextViewText(R.id.widget_text, "Sokafy ny e-Baiboly hahitana ny andinin-teny androany.")
            views.setViewVisibility(R.id.widget_ref, View.GONE)
            views.setViewVisibility(R.id.widget_translation, View.GONE)
        } else {
            views.setTextViewText(R.id.widget_date, feed.dateLabel)
            views.setTextViewText(R.id.widget_label, feed.label)
            views.setTextViewText(R.id.widget_text, "“${feed.text}”")
            views.setViewVisibility(R.id.widget_ref, View.VISIBLE)
            views.setTextViewText(R.id.widget_ref, feed.ref)
            views.setViewVisibility(R.id.widget_translation, if (feed.translation.isEmpty()) View.GONE else View.VISIBLE)
            views.setTextViewText(R.id.widget_translation, feed.translation)
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

        // The glyph on the footer line is a one-tap shortcut to the look
        // picker (App.tsx routes ebaiboly://widget-look to Safidio ny loko).
        val settings = Intent(Intent.ACTION_VIEW, Uri.parse(SETTINGS_URL), context, MainActivity::class.java)
        settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        views.setOnClickPendingIntent(
            R.id.widget_settings,
            PendingIntent.getActivity(context, 1, settings, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
        )
        return views
    }

    /** Rounded card: the look's photo (centre-cropped, scrimmed) or its flat colour. */
    private fun paintCard(context: Context, look: Look, options: Bundle?): Bitmap {
        val density = context.resources.displayMetrics.density
        // Portrait size of the placed widget in dp; fall back to 4x2 cells.
        val widthDp = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0)?.takeIf { it > 0 } ?: 320
        val heightDp = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)?.takeIf { it > 0 } ?: 160
        val width = (widthDp * density).toInt().coerceIn(1, MAX_BITMAP_EDGE)
        val height = (heightDp * density).toInt().coerceIn(1, MAX_BITMAP_EDGE)

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val radius = CORNER_RADIUS_DP * density
        val bounds = RectF(0f, 0f, width.toFloat(), height.toFloat())
        canvas.clipPath(Path().apply { addRoundRect(bounds, radius, radius, Path.Direction.CW) })

        val photo = look.image?.let { decodePhoto(File(context.filesDir, it), width, height) }
        if (photo != null) {
            // Centre-crop the photo, then the share card's 45% scrim.
            val scale = maxOf(width.toFloat() / photo.width, height.toFloat() / photo.height)
            val matrix = Matrix().apply {
                setScale(scale, scale)
                postTranslate((width - photo.width * scale) / 2f, (height - photo.height * scale) / 2f)
            }
            canvas.drawBitmap(photo, matrix, Paint(Paint.FILTER_BITMAP_FLAG))
            canvas.drawColor(SCRIM)
        } else {
            canvas.drawColor(look.background)
        }
        return bitmap
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
        private const val SETTINGS_URL = "ebaiboly://widget-look"
        // Same as DEFAULT_PRIMARY_COLOR_ID's hex in src/theme/personalizationPalette.ts.
        private const val DEFAULT_ACCENT = 0xFF007991.toInt()
        // rgba(0, 0, 0, 0.45), as on the share card.
        private const val SCRIM = 0x73000000
        private const val CORNER_RADIUS_DP = 24f
        // Keeps the RemoteViews bitmap well under Android's transaction limit.
        private const val MAX_BITMAP_EDGE = 1400

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
