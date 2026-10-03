package com.arthquest.pwa

import android.util.Log
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsClient
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy

private const val TAG = "NearbySyncManager"

/**
 * Wraps Play Services' Nearby Connections API for a single, specific paired device (ticket #18)
 * — advertises and discovers simultaneously under the same service id, accepts a connection only
 * from the one allowed remote device id, and exposes a small [Listener] callback interface so
 * [NearbySyncPlugin] can turn state changes into Capacitor JS events without this class knowing
 * anything about Capacitor.
 *
 * Both devices run the identical advertise+discover session at once — there's no fixed
 * host/client role — so whichever side's discovery finds the other first is the one that calls
 * `requestConnection`; the other simply accepts. One instance lives for one session (start..stop).
 *
 * Uses [Strategy.P2P_CLUSTER], not P2P_STAR: P2P_STAR is a hub-and-spoke topology where only one
 * device in the pair may advertise at a time, which doesn't fit this symmetric "either device
 * might discover the other first" design — P2P_CLUSTER is Google's own documented strategy for a
 * device that both advertises and discovers simultaneously. Only one connection is ever actually
 * wanted here (enforced in onEndpointFound below), so P2P_CLUSTER's support for many-to-many
 * topologies is unused, not a problem.
 *
 * No merge/sync semantics live here — this only proves two paired devices can find each other and
 * exchange bytes with no internet and no server, per ticket #18's own stated scope. The real sync
 * protocol (#20) is built entirely in JS on top of [NearbySyncPlugin]'s `send`/`received` surface.
 */
class NearbySyncManager(
    private val connectionsClient: ConnectionsClient,
    private val serviceId: String,
    private val localId: String,
    private val allowedRemoteId: String,
    private val listener: Listener,
) {
    interface Listener {
        fun onConnected(remoteId: String)
        fun onDisconnected()
        fun onReceived(bytes: ByteArray)
        fun onError(message: String)
    }

    @Volatile private var connectedEndpointId: String? = null
    @Volatile private var stopped = false

    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, connectionInfo: ConnectionInfo) {
            if (stopped) {
                // A connection request already in flight when stop() ran — don't adopt it into a
                // session that's already being torn down.
                connectionsClient.rejectConnection(endpointId)
                return
            }
            // connectionInfo.endpointName is the *remote* device's own id, exactly as it passed
            // to requestConnection() as its own userName below — only ever accept a connection
            // from the one device this app is paired with (ticket #17).
            if (connectionInfo.endpointName != allowedRemoteId) {
                Log.w(TAG, "Rejecting connection from unpaired endpoint ${connectionInfo.endpointName}")
                connectionsClient.rejectConnection(endpointId)
                return
            }
            if (connectedEndpointId != null) {
                // Only one connection is ever wanted (matches onEndpointFound's own guard below)
                // — accepting a second would silently overwrite connectedEndpointId and orphan
                // the real one, which later spuriously disconnects+restarts an otherwise-healthy
                // session.
                Log.w(TAG, "Already connected to $connectedEndpointId — rejecting duplicate connection from $endpointId")
                connectionsClient.rejectConnection(endpointId)
                return
            }
            connectionsClient.acceptConnection(endpointId, payloadCallback)
                .addOnFailureListener { e -> listener.onError("acceptConnection failed: ${e.message}") }
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            if (result.status.isSuccess) {
                if (stopped) {
                    // stop() ran while this handshake was in flight (connectedEndpointId was
                    // still null then, so stop() had nothing to disconnectFromEndpoint() —
                    // without this check the connection completes anyway and leaks: nothing
                    // holds a reference to this manager to ever tear it down again). Reject the
                    // connection we just accepted rather than adopting it.
                    connectionsClient.disconnectFromEndpoint(endpointId)
                    return
                }
                connectedEndpointId = endpointId
                stopAdvertisingAndDiscovery()
                listener.onConnected(allowedRemoteId)
            } else {
                Log.w(TAG, "Connection to $endpointId failed: ${result.status.statusMessage}")
                listener.onError("Connection failed: ${result.status.statusMessage}")
            }
        }

        override fun onDisconnected(endpointId: String) {
            if (connectedEndpointId == endpointId) connectedEndpointId = null
            listener.onDisconnected()
            // Resume searching so the peer can reconnect once back in range — but only if this
            // disconnect happened while we still wanted to be connected. stop() sets `stopped`
            // before it triggers this same callback (via disconnectFromEndpoint), so an
            // intentional stop/unpair/session-teardown correctly does *not* restart.
            if (!stopped) start()
        }
    }

    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            if (info.endpointName != allowedRemoteId) return // not our paired device — ignore
            if (connectedEndpointId != null) return // already connected — ignore further finds
            connectionsClient.requestConnection(localId, endpointId, connectionLifecycleCallback)
                .addOnFailureListener { e -> listener.onError("requestConnection failed: ${e.message}") }
        }

        override fun onEndpointLost(endpointId: String) {
            // Nothing to do — either it never connected, or onDisconnected already covers it.
        }
    }

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            // BYTES is the only payload type this transport ever sends (see send() below) — file
            // and stream payloads aren't used, so anything else is silently ignored.
            val bytes = payload.asBytes() ?: return
            listener.onReceived(bytes)
        }

        // Single small BYTES payloads deliver whole-or-not-at-all — unlike FILE/STREAM payloads
        // (which this transport never uses), there's no partial/chunked delivery for BYTES to
        // track here. This is what actually satisfies ticket #22's "an interrupted transfer
        // leaves both devices' data unchanged" requirement at the transport layer: a connection
        // dropped mid-send means onPayloadReceived above simply never fires for that payload —
        // there is no such thing as a partially-received sync message reaching the JS merge layer
        // to begin with. The JS side (domain/pingProtocol.js's parseNearbyMessage) still validates
        // defensively on top of this, but the real guarantee is architectural, not a check.
        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
        }
    }

    fun start() {
        val advertisingOptions = AdvertisingOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build()
        connectionsClient.startAdvertising(localId, serviceId, connectionLifecycleCallback, advertisingOptions)
            .addOnFailureListener { e -> listener.onError("startAdvertising failed: ${e.message}") }

        val discoveryOptions = DiscoveryOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build()
        connectionsClient.startDiscovery(serviceId, endpointDiscoveryCallback, discoveryOptions)
            .addOnFailureListener { e -> listener.onError("startDiscovery failed: ${e.message}") }
    }

    fun send(data: ByteArray) {
        val endpointId = connectedEndpointId
        if (endpointId == null) {
            listener.onError("Not connected — nothing to send to")
            return
        }
        connectionsClient.sendPayload(endpointId, Payload.fromBytes(data))
            .addOnFailureListener { e -> listener.onError("sendPayload failed: ${e.message}") }
    }

    fun stop() {
        stopped = true
        stopAdvertisingAndDiscovery()
        connectedEndpointId?.let { connectionsClient.disconnectFromEndpoint(it) }
        connectedEndpointId = null
    }

    private fun stopAdvertisingAndDiscovery() {
        connectionsClient.stopAdvertising()
        connectionsClient.stopDiscovery()
    }
}
