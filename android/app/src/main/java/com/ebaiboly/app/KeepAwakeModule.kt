package com.ebaiboly.app

import android.view.WindowManager
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

/**
 * Toggles the Activity window's keep-screen-on flag so the reader stays lit
 * like an open book. The flag is scoped to the window, so backgrounding the
 * app releases it without any extra bookkeeping. Same JS name and method as
 * the iOS module.
 */
class KeepAwakeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "KeepAwake"

    @ReactMethod
    fun setEnabled(enabled: Boolean) {
        val activity = reactApplicationContext.currentActivity ?: return
        activity.runOnUiThread {
            val flag = WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            if (enabled) activity.window.addFlags(flag) else activity.window.clearFlags(flag)
        }
    }
}

class KeepAwakePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(KeepAwakeModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
