package com.ebaiboly.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
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
 * Refreshed by the launcher every updatePeriodMillis (widget_daily_verse_info)
 * and explicitly by DailyVerseWidgetModule.refresh() after the file changes.
 */
class DailyVerseWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val day = readToday(context)
        for (id in ids) {
            manager.updateAppWidget(id, build(context, day))
        }
    }

    private data class Day(val label: String, val ref: String, val text: String, val url: String?, val accent: Int)

    private fun readToday(context: Context): Day? {
        return try {
            val file = File(context.filesDir, FILE_NAME)
            if (!file.exists()) return null
            val root = JSONObject(file.readText())
            val key = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
            val entry = root.getJSONObject("days").optJSONObject(key) ?: return null
            Day(
                label = root.optString("label", ""),
                ref = entry.optString("ref", ""),
                text = entry.optString("text", ""),
                url = entry.optString("url", null),
                accent = parseColor(root.optString("accent", "")),
            )
        } catch (e: Exception) {
            null
        }
    }

    private fun build(context: Context, day: Day?): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_daily_verse)
        if (day == null) {
            // No feed yet (fresh install, or the app hasn't been opened in two
            // months): invite the user in. Placeholder MG copy — user-owned.
            views.setTextViewText(R.id.widget_label, context.getString(R.string.app_name))
            views.setViewVisibility(R.id.widget_ref, View.GONE)
            views.setTextViewText(R.id.widget_text, "Sokafy ny e-Baiboly hahitana ny andinin-teny androany.")
            views.setInt(R.id.widget_accent, "setBackgroundColor", DEFAULT_ACCENT)
        } else {
            views.setTextViewText(R.id.widget_label, day.label)
            views.setViewVisibility(R.id.widget_ref, View.VISIBLE)
            views.setTextViewText(R.id.widget_ref, day.ref)
            views.setTextViewText(R.id.widget_text, day.text)
            views.setInt(R.id.widget_accent, "setBackgroundColor", day.accent)
            views.setTextColor(R.id.widget_ref, day.accent)
        }

        val intent = if (day?.url != null) {
            Intent(Intent.ACTION_VIEW, Uri.parse(day.url), context, MainActivity::class.java)
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

        /** Re-render every placed instance; called from JS after the feed file is rewritten. */
        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                android.content.ComponentName(context, DailyVerseWidgetProvider::class.java),
            )
            if (ids.isEmpty()) return
            val intent = Intent(context, DailyVerseWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }
    }
}
