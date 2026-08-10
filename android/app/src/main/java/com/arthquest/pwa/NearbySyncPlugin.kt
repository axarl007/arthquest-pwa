package com.arthquest.pwa

import android.Manifest
import android.util.Base64
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.PermissionState
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.google.android.gms.nearby.Nearby

private const val TAG = "NearbySyncPlugin"
private const val PERMISSION_ALIAS = "nearby"

/**
 * Capacitor bridge for device-to-device sync transport (ticket #18) — advertises and discovers
 * simultaneously under this app's own package name as the Nearby Connections service id,
 * accepting a connection only from the one device paired in ticket #17, with no internet and no
 * server. No merge/sync semantics live here — raw byte transport only; the sync-wiring ticket
 * (#20) builds the real protocol on top of this without touching native code again.
 *
 * JS surface (see src/native/nearbySync.js for the JS-side wrapper):
 *   - startAdvertisingAndDiscovery({ localId, allowedRemoteId }): Promise<void>
 *       Requests the "nearby" permission group (Bluetooth/Wi-Fi/location, see the alias below) if
 *       not already granted — rejecting with "requiresPermission" if the user declines — then
 *       starts advertising this device as `localId` and discovering `allowedRemoteId`, connecting
 *       automatically the moment both are in range with both apps foregrounded.
 *   - disconnect(): Promise<void> — tears down any active/pending connection and stops
 *       advertising/discovery.
 *   - send({ data: string }): Promise<void> — `data` is a base64-encoded byte payload sent to the
 *       currently connected endpoint; rejects if nothing is connected.
 *
 * Events (via addListener): 'connected' -> { remoteId }, 'disconnected' -> {}, 'received' ->
 * { data: base64 string }, 'error' -> { message }.
 */
@CapacitorPlugin(
    name = "NearbySync",
    permissions = [
        Permission(
            alias = PERMISSION_ALIAS,
            strings = [
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.BLUETOOTH_ADVERTISE,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.NEARBY_WIFI_DEVICES,
            ],
        ),
    ],
)
class NearbySyncPlugin : Plugin() {
    private var manager: NearbySyncManager? = null
    // Bumped every time a session starts or is torn down. Each session's listener callbacks
    // capture the generation they were created with and compare against the current value before
    // forwarding anything to JS — stopping a manager is async (disconnectFromEndpoint doesn't
    // block), so a torn-down session's stale callback can otherwise arrive after a newer session
    // already reports 'connected', silently flipping the JS-side status back to "searching" for a
    // connection that's actually still live.
    private var sessionGeneration = 0

    @PluginMethod
    fun startAdvertisingAndDiscovery(call: PluginCall) {
        val localId = call.getString("localId")
        val allowedRemoteId = call.getString("allowedRemoteId")
        if (localId.isNullOrBlank() || allowedRemoteId.isNullOrBlank()) {
            call.reject("localId and allowedRemoteId are required")
            return
        }

        if (getPermissionState(PERMISSION_ALIAS) != PermissionState.GRANTED) {
            requestPermissionForAlias(PERMISSION_ALIAS, call, "onPermissionResult")
            return
        }

        beginSession(localId, allowedRemoteId)
        call.resolve()
    }

    @PermissionCallback
    private fun onPermissionResult(call: PluginCall) {
        if (getPermissionState(PERMISSION_ALIAS) != PermissionState.GRANTED) {
            call.reject("requiresPermission")
            return
        }
        val localId = call.getString("localId")
        val allowedRemoteId = call.getString("allowedRemoteId")
        if (localId.isNullOrBlank() || allowedRemoteId.isNullOrBlank()) {
            call.reject("localId and allowedRemoteId are required")
            return
        }
        beginSession(localId, allowedRemoteId)
        call.resolve()
    }

    private fun beginSession(localId: String, allowedRemoteId: String) {
        manager?.stop()
        sessionGeneration++
        val myGeneration = sessionGeneration
        val connectionsClient = Nearby.getConnectionsClient(context)
        val newManager = NearbySyncManager(
            connectionsClient = connectionsClient,
            serviceId = context.packageName,
            localId = localId,
            allowedRemoteId = allowedRemoteId,
            listener = object : NearbySyncManager.Listener {
                override fun onConnected(remoteId: String) {
                    if (myGeneration != sessionGeneration) return
                    val data = JSObject()
                    data.put("remoteId", remoteId)
                    notifyListeners("connected", data)
                }

                override fun onDisconnected() {
                    if (myGeneration != sessionGeneration) return
                    notifyListeners("disconnected", JSObject())
                }

                override fun onReceived(bytes: ByteArray) {
                    if (myGeneration != sessionGeneration) return
                    val data = JSObject()
                    data.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP))
                    notifyListeners("received", data)
                }

                override fun onError(message: String) {
                    if (myGeneration != sessionGeneration) return
                    Log.w(TAG, message)
                    val data = JSObject()
                    data.put("message", message)
                    notifyListeners("error", data)
                }
            },
        )
        manager = newManager
        newManager.start()
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        stopSession()
        call.resolve()
    }

    private fun stopSession() {
        manager?.stop()
        manager = null
        sessionGeneration++ // invalidates any in-flight callback from the session just stopped
    }

    // Defense in depth alongside the JS-side foreground tracking (useForegroundVisible): if the
    // Activity itself pauses for any reason — backgrounding, a system dialog, the permission
    // prompt this plugin triggers — stop advertising/discovery rather than leave Bluetooth/Wi-Fi
    // radios running unattended. JS's own visibility-driven effect re-starts the session on
    // resume if it's still wanted; this doesn't try to auto-resume itself, to avoid a duplicate
    // start racing with that JS-driven restart.
    override fun handleOnPause() {
        stopSession()
        super.handleOnPause()
    }

    @PluginMethod
    fun send(call: PluginCall) {
        val encoded = call.getString("data")
        if (encoded.isNullOrEmpty()) {
            call.reject("data is required")
            return
        }
        val current = manager
        if (current == null) {
            call.reject("Not started — call startAdvertisingAndDiscovery first")
            return
        }
        val bytes = Base64.decode(encoded, Base64.NO_WRAP)
        current.send(bytes)
        call.resolve()
    }

    override fun handleOnDestroy() {
        stopSession()
        super.handleOnDestroy()
    }
}
