package com.ebaiboly.app

import android.view.ActionMode
import android.view.GestureDetector
import android.view.Menu
import android.view.MenuItem
import android.view.MotionEvent
import android.view.View
import android.widget.TextView
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewManager

/**
 * The phone's own text selection on a selectable <Text> (a real TextView in
 * React Native): long-press a word, then drag the handles. The system menu
 * is left empty, so the app shows its own highlight bubble instead; JS hears
 * where the selection is (SelectionMenuShown) and when it ends
 * (SelectionMenuHidden).
 *
 * A double-tap would also select a word; it is kept for the app's verse menu
 * instead (SelectionMenuDoubleTap) and never reaches the TextView.
 */
class SelectionMenuModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SelectionMenu"

    // One selection on screen at a time.
    private var activeMode: ActionMode? = null

    // Hooks one selectable <Text>, found by its React tag. Calling it again on
    // the same view just replaces the hooks.
    @ReactMethod
    fun attach(tag: Int) {
        UiThreadUtil.runOnUiThread {
            val view = try {
                UIManagerHelper.getUIManagerForReactTag(reactContext, tag)?.resolveView(tag)
            } catch (e: Exception) {
                null
            }
            val textView = view as? TextView ?: return@runOnUiThread
            textView.customSelectionActionModeCallback = SelectionCallback(textView, tag)
            textView.setOnTouchListener(DoubleTapListener(textView, tag))
        }
    }

    // Ends the selection on screen, e.g. once a colour is applied.
    @ReactMethod
    fun clearSelection() {
        UiThreadUtil.runOnUiThread { activeMode?.finish() }
    }

    // NativeEventEmitter on the JS side expects these two.
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun emitTag(event: String, tag: Int) {
        reactContext.emitDeviceEvent(event, Arguments.createMap().apply { putInt("tag", tag) })
    }

    private inner class SelectionCallback(
        private val textView: TextView,
        private val tag: Int,
    ) : ActionMode.Callback {

        // The system fills the menu (Copy, Select all, Translate...) before
        // each of these; emptying it hides its toolbar but keeps the selection.
        override fun onCreateActionMode(mode: ActionMode, menu: Menu): Boolean {
            menu.clear()
            activeMode = mode
            emitSelection()
            return true
        }

        // Called again once a handle is let go, with the new selection.
        override fun onPrepareActionMode(mode: ActionMode, menu: Menu): Boolean {
            menu.clear()
            emitSelection()
            return true
        }

        override fun onActionItemClicked(mode: ActionMode, item: MenuItem): Boolean = false

        override fun onDestroyActionMode(mode: ActionMode) {
            if (activeMode === mode) activeMode = null
            emitTag("SelectionMenuHidden", tag)
        }

        // The selected characters, and where they sit in the TextView (dp from
        // its top-left corner), for the bubble to point at them.
        private fun emitSelection() {
            val layout = textView.layout ?: return
            val start = minOf(textView.selectionStart, textView.selectionEnd)
            val end = maxOf(textView.selectionStart, textView.selectionEnd)
            if (start < 0 || end <= start) return
            val firstLine = layout.getLineForOffset(start)
            val lastLine = layout.getLineForOffset(end - 1)
            val left = if (firstLine == lastLine) layout.getPrimaryHorizontal(start) else 0f
            val right = when {
                firstLine != lastLine -> layout.width.toFloat()
                end >= layout.getLineEnd(firstLine) -> layout.getLineRight(firstLine)
                else -> layout.getPrimaryHorizontal(end)
            }
            val density = textView.resources.displayMetrics.density
            val dx = textView.totalPaddingLeft - textView.scrollX
            val dy = textView.totalPaddingTop - textView.scrollY
            reactContext.emitDeviceEvent("SelectionMenuShown", Arguments.createMap().apply {
                putInt("tag", tag)
                putInt("start", start)
                putInt("end", end)
                putDouble("x", ((dx + (left + right) / 2) / density).toDouble())
                putDouble("top", ((dy + layout.getLineTop(firstLine)) / density).toDouble())
                putDouble("bottom", ((dy + layout.getLineBottom(lastLine)) / density).toDouble())
            })
        }
    }

    // Spots a double-tap and keeps its second tap from the TextView, which
    // would otherwise select the word under it. Sends the character tapped,
    // since one TextView holds several verses.
    private inner class DoubleTapListener(private val textView: TextView, private val tag: Int) :
        View.OnTouchListener {

        private var swallowing = false

        private val detector = GestureDetector(
            textView.context,
            object : GestureDetector.SimpleOnGestureListener() {
                override fun onDoubleTap(e: MotionEvent): Boolean {
                    reactContext.emitDeviceEvent("SelectionMenuDoubleTap", Arguments.createMap().apply {
                        putInt("tag", tag)
                        putInt("offset", textView.getOffsetForPosition(e.x, e.y))
                    })
                    return true
                }
            },
        ).apply { setIsLongpressEnabled(false) }

        override fun onTouch(v: View, event: MotionEvent): Boolean {
            if (detector.onTouchEvent(event) && event.actionMasked == MotionEvent.ACTION_DOWN) {
                swallowing = true
            }
            val swallow = swallowing
            if (event.actionMasked == MotionEvent.ACTION_UP ||
                event.actionMasked == MotionEvent.ACTION_CANCEL
            ) {
                swallowing = false
            }
            return swallow
        }
    }
}

class SelectionMenuPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(SelectionMenuModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
