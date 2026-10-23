package com.ebaiboly.app

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.model.UpdateAvailability

/**
 * Asks Google Play whether an update is waiting for this phone (In-App
 * Updates). Play answers per device, so a staged rollout that hasn't reached
 * it yet says no. Only a copy installed from Play gets an answer: a sideloaded
 * build fails, which reads as "no update" too.
 */
class AppUpdateModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AppUpdate"

    /** The waiting versionCode, or null. */
    @ReactMethod
    fun availableVersion(promise: Promise) {
        AppUpdateManagerFactory.create(reactApplicationContext).appUpdateInfo
            .addOnSuccessListener { info ->
                promise.resolve(
                    if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE) {
                        info.availableVersionCode()
                    } else {
                        null
                    }
                )
            }
            .addOnFailureListener { promise.resolve(null) }
    }
}
