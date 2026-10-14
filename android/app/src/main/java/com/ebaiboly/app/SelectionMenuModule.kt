package com.ebaiboly.app

import android.view.ActionMode
import android.view.Menu
import android.view.MenuItem
import android.widget.TextView
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewManager

/**
 * Puts the app's own actions (Surligner, Naoty, ...) first in the phone's
 * text-selection menu of a selectable <Text>, and tells JS which one was
 * chosen and exactly which characters were selected.
 *
 * React Native draws <Text selectable> with a real TextView, so the
 * selection itself stays the phone's own: double-tap or long-press, the
 * handles, Copy, Translate. Only the menu gets our items.
 */
class SelectionMenuModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SelectionMenu"

    private data class Item(val key: String, val label: String, val primary: Boolean)

    // Set once from JS, read when a menu opens.
    @Volatile
    private var items: List<Item> = emptyList()

    @ReactMethod
    fun setItems(list: ReadableArray) {
        items = (0 until list.size()).mapNotNull { i ->
            val map = list.getMap(i) ?: return@mapNotNull null
            val key = map.getString("key") ?: return@mapNotNull null
            val label = map.getString("label") ?: return@mapNotNull null
            val primary = map.hasKey("primary") && map.getBoolean("primary")
            Item(key, label, primary)
        }
    }

    // Hooks the menu of one selectable <Text>, found by its React tag. Calling
    // it again on the same view just replaces the callback.
    @ReactMethod
    fun attach(tag: Int) {
        UiThreadUtil.runOnUiThread {
            val view = try {
                UIManagerHelper.getUIManagerForReactTag(reactContext, tag)?.resolveView(tag)
            } catch (e: Exception) {
                null
            }
            val textView = view as? TextView ?: return@runOnUiThread
            textView.customSelectionActionModeCallback = MenuCallback(textView, tag)
        }
    }

    // NativeEventEmitter on the JS side expects these two.
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private inner class MenuCallback(
        private val textView: TextView,
        private val tag: Int,
    ) : ActionMode.Callback {

        // The system fills the menu first (Copy, Select all, Translate...),
        // then calls this. Ours go in front: primary items before Cut (order
        // 4), the rest after Select all (8) and before the apps' text actions
        // (100+), so they sit at the top of the overflow. The system Share is
        // dropped: the app's own sharing does more.
        override fun onCreateActionMode(mode: ActionMode, menu: Menu): Boolean {
            items.forEachIndexed { index, item ->
                menu.add(Menu.NONE, FIRST_ID + index, if (item.primary) 1 else 12, item.label)
            }
            menu.removeItem(android.R.id.shareText)
            reactContext.emitDeviceEvent("SelectionMenuShown", Arguments.createMap().apply {
                putInt("tag", tag)
            })
            return true
        }

        override fun onPrepareActionMode(mode: ActionMode, menu: Menu): Boolean = false

        override fun onActionItemClicked(mode: ActionMode, item: MenuItem): Boolean {
            val chosen = items.getOrNull(item.itemId - FIRST_ID) ?: return false
            val start = minOf(textView.selectionStart, textView.selectionEnd)
            val end = maxOf(textView.selectionStart, textView.selectionEnd)
            reactContext.emitDeviceEvent("SelectionMenuAction", Arguments.createMap().apply {
                putInt("tag", tag)
                putString("key", chosen.key)
                putInt("start", start)
                putInt("end", end)
            })
            mode.finish()
            return true
        }

        override fun onDestroyActionMode(mode: ActionMode) {
            reactContext.emitDeviceEvent("SelectionMenuHidden", Arguments.createMap().apply {
                putInt("tag", tag)
            })
        }
    }

    private companion object {
        // Our menu item ids; the system's are android.R.id.* (0x0102xxxx).
        const val FIRST_ID = 1000
    }
}

class SelectionMenuPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(SelectionMenuModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
