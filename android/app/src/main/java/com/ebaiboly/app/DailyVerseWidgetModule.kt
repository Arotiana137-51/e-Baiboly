package com.ebaiboly.app

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
}
