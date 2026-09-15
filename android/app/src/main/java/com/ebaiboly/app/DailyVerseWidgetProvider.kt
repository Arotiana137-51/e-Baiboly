package com.ebaiboly.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
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
 * the next two months, the accent colour and a deep link — and this only
 * renders today's entry (see src/services/widget/dailyVerseWidget.ts for the
 * contract). The verse calendar itself lives in JS and is never duplicated
 * here.
 *
 * Look: a gradient of the accent colour behind white serif text. RemoteViews
 * can only set solid colours at runtime, so the gradient is painted into a
 * bitmap sized to the placed widget.
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

    // Resizing changes the bitmap size the gradient is painted at.
    override fun onAppWidgetOptionsChanged(
        context: Context,
        manager: AppWidgetManager,
        id: Int,
        options: Bundle,
    ) {
        manager.updateAppWidget(id, build(context, readFeed(context), options))
    }

    private data class Feed(
        val label: String,
        val translation: String,
        val accent: Int,
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
            Feed(
                label = root.optString("label", ""),
                translation = root.optString("translation", ""),
                accent = parseColor(root.optString("accent", "")),
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
        val accent = feed?.accent ?: DEFAULT_ACCENT
        views.setImageViewBitmap(R.id.widget_bg, gradientCard(context, accent, options))

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
        return views
    }

    /** Rounded card filled with a diagonal accent -> darker-accent gradient. */
    private fun gradientCard(context: Context, accent: Int, options: Bundle?): Bitmap {
        val density = context.resources.displayMetrics.density
        // Portrait size of the placed widget in dp; fall back to 4x2 cells.
        val widthDp = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0)?.takeIf { it > 0 } ?: 320
        val heightDp = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)?.takeIf { it > 0 } ?: 160
        val width = (widthDp * density).toInt().coerceIn(1, MAX_BITMAP_EDGE)
        val height = (heightDp * density).toInt().coerceIn(1, MAX_BITMAP_EDGE)

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val dark = ColorUtils.blendARGB(accent, Color.BLACK, 0.45f)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(0f, 0f, width.toFloat(), height.toFloat(), accent, dark, Shader.TileMode.CLAMP)
        }
        val radius = CORNER_RADIUS_DP * density
        Canvas(bitmap).drawRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), radius, radius, paint)
        return bitmap
    }

    private fun parseColor(hex: String): Int =
        try {
            Color.parseColor(hex)
        } catch (e: IllegalArgumentException) {
            DEFAULT_ACCENT
        }

    companion object {
        const val FILE_NAME = "dailyVerse.json"
        // Same as DEFAULT_PRIMARY_COLOR_ID's hex in src/theme/personalizationPalette.ts.
        private const val DEFAULT_ACCENT = 0xFF007991.toInt()
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
