package com.ebaiboly.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * The widget's heart. Kept apart from DailyVerseWidgetProvider, which must be
 * exported for the system's widget broadcasts, so that this one is not: only
 * the heart's own PendingIntent reaches it, and no other app can add or remove
 * the person's favorites.
 */
class WidgetHeartReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val key = intent.getStringExtra(DailyVerseWidgetProvider.EXTRA_KEY) ?: return
        DailyVerseWidgetProvider.recordHeart(context, key, intent.getBooleanExtra(DailyVerseWidgetProvider.EXTRA_ON, true))
        DailyVerseWidgetProvider.refreshAll(context)
    }
}
