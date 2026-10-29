package com.ebaiboly.app

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Lets JS ask the home-screen widget to re-read dailyVerse.json right after
 * writing it (fresh install, colour change), instead of waiting for the
 * launcher's periodic update.
 */
class DailyVerseWidgetModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "DailyVerseWidget"

    @ReactMethod
    fun refresh(promise: Promise) {
        try {
            DailyVerseWidgetProvider.refreshAll(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /** Android 8+ with a launcher that can add a widget for the app (One UI can). */
    @ReactMethod
    fun canPin(promise: Promise) {
        promise.resolve(
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                AppWidgetManager.getInstance(reactApplicationContext).isRequestPinAppWidgetSupported
        )
    }

    /**
     * Whether the widget is on a home screen, at any size. Android only knows
     * the ids bound to the widget, and an id a launcher left behind (another
     * launcher, a crash mid-add) still counts: the app never relies on this
     * alone to offer the add, the widget guide always has its button.
     */
    @ReactMethod
    fun isPlaced(promise: Promise) {
        val provider = ComponentName(reactApplicationContext, DailyVerseWidgetProvider::class.java)
        promise.resolve(AppWidgetManager.getInstance(reactApplicationContext).getAppWidgetIds(provider).isNotEmpty())
    }

    /**
     * Asks the launcher to put the widget on the home screen. It shows its own
     * "add to home screen?" card, so there is no gesture to learn.
     */
    @ReactMethod
    fun requestPin(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.resolve(false)
            return
        }
        val manager = AppWidgetManager.getInstance(reactApplicationContext)
        val provider = ComponentName(reactApplicationContext, DailyVerseWidgetProvider::class.java)
        promise.resolve(manager.isRequestPinAppWidgetSupported && manager.requestPinAppWidget(provider, null, null))
    }
}
