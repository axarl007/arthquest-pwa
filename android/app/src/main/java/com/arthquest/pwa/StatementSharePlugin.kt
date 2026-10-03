package com.arthquest.pwa

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

private const val TAG = "StatementSharePlugin"
// Marks an ACTION_SEND intent as already handed to JS, so the same share isn't delivered twice
// (e.g. load() re-running against the activity's still-current launch intent). In-memory only —
// Android doesn't persist it, so a relaunch after process death is handled separately (see
// isUnconsumedShare and MainActivity).
const val EXTRA_STATEMENT_SHARE_CONSUMED = "com.arthquest.pwa.STATEMENT_SHARE_CONSUMED"
// A month of statement rows is a few KB; anything this large isn't a statement and would only
// risk an OOM reading it into one string.
private const val MAX_SHARE_BYTES = 5 * 1024 * 1024

/**
 * Receives a bank/UPI statement file shared into the app from Android's share sheet (ticket #40)
 * — e.g. PhonePe's exported CSV, shared from PhonePe itself or a file manager — and hands its
 * text to JS, which runs the same parse + review flow as Settings' file picker
 * (src/domain/importers, src/screens/ImportReview.jsx). No parsing happens here.
 *
 * MainActivity's ACTION_SEND intent-filter routes the share here:
 *   - cold start: the share is the activity's launch intent, read in load() and held until JS
 *     asks for it via getPendingShare() (JS listeners don't exist yet at that point).
 *   - warm start: MainActivity is singleTask, so the share arrives via onNewIntent ->
 *     handleOnNewIntent and is pushed as a 'shared' event (retained until a listener exists).
 *
 * JS surface (see src/native/statementShare.js):
 *   - getPendingShare(): Promise<{ text?: string, error?: string }> — the cold-start share, once.
 *   - event 'shared' -> { text?: string, error?: string }
 */
@CapacitorPlugin(name = "StatementShare")
class StatementSharePlugin : Plugin() {
    // Cold-start share state, all touched on the main thread only: the read result once ready,
    // whether a read is still in flight, and a getPendingShare() call that arrived before it
    // finished (resolved when it does, so the share can't be lost to that race). Several calls can
    // be waiting (e.g. a WebView reload); the first gets the share, the rest get nothing, keeping
    // "handed out exactly once".
    private var pending: JSObject? = null
    private var reading = false
    private val waitingCalls = mutableListOf<PluginCall>()

    override fun load() {
        val intent = activity?.intent ?: return
        if (isUnconsumedShare(intent)) {
            intent.putExtra(EXTRA_STATEMENT_SHARE_CONSUMED, true)
            reading = true
            readShareAsync(intent) { result ->
                reading = false
                if (waitingCalls.isEmpty()) {
                    pending = result
                } else {
                    waitingCalls.forEachIndexed { i, call -> call.resolve(if (i == 0) result else JSObject()) }
                    waitingCalls.clear()
                }
            }
        }
    }

    override fun handleOnNewIntent(intent: Intent) {
        super.handleOnNewIntent(intent)
        if (!isUnconsumedShare(intent)) return
        intent.putExtra(EXTRA_STATEMENT_SHARE_CONSUMED, true)
        readShareAsync(intent) { result -> notifyListeners("shared", result, true) }
    }

    @PluginMethod
    fun getPendingShare(call: PluginCall) {
        // Plugin methods are dispatched off the main thread; hop over so this shares one thread
        // with load()'s delivery callback.
        activity.runOnUiThread {
            if (reading) {
                waitingCalls.add(call)
                return@runOnUiThread
            }
            val result = pending ?: JSObject()
            pending = null
            call.resolve(result)
        }
    }

    // FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY: reopened from Recents after the process died, which
    // replays the original launch intent — that share was already delivered (and likely imported)
    // in the earlier process, so it must not open a second review.
    private fun isUnconsumedShare(intent: Intent): Boolean =
        intent.action == Intent.ACTION_SEND &&
            !intent.getBooleanExtra(EXTRA_STATEMENT_SHARE_CONSUMED, false) &&
            (intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) == 0

    /** Reads off the main thread — a content:// stream from another app can be slow (cloud-backed
     * file providers) — and delivers the result back on the main thread. */
    private fun readShareAsync(intent: Intent, deliver: (JSObject) -> Unit) {
        val streamUri = streamUriOf(intent)
        val inlineText = intent.getStringExtra(Intent.EXTRA_TEXT)
        Thread {
            val result = JSObject()
            try {
                val text = when {
                    streamUri != null -> readText(streamUri)
                    inlineText != null -> inlineText
                    else -> null
                }
                if (text == null) result.put("error", "Nothing to import in what was shared.") else result.put("text", text)
            } catch (e: Exception) {
                Log.w(TAG, "Couldn't read shared file", e)
                result.put("error", "Couldn't read the shared file.")
            }
            activity?.runOnUiThread { deliver(result) } ?: deliver(result)
        }.start()
    }

    private fun streamUriOf(intent: Intent): Uri? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(Intent.EXTRA_STREAM)
        }

    private fun readText(uri: Uri): String {
        val input = context.contentResolver.openInputStream(uri) ?: throw IllegalStateException("No stream for $uri")
        input.use { stream ->
            val bytes = stream.readNBytesCompat(MAX_SHARE_BYTES + 1)
            if (bytes.size > MAX_SHARE_BYTES) throw IllegalStateException("Shared file too large")
            return String(bytes, Charsets.UTF_8)
        }
    }

    // InputStream.readNBytes is API 33+; minSdk is 24.
    private fun java.io.InputStream.readNBytesCompat(limit: Int): ByteArray {
        val out = java.io.ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        while (out.size() < limit) {
            val read = read(buffer, 0, minOf(buffer.size, limit - out.size()))
            if (read < 0) break
            out.write(buffer, 0, read)
        }
        return out.toByteArray()
    }
}
