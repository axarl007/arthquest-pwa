import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { useStore } from '../store/useStore.js';
import { useTheme } from '../theme/useTheme.js';
import { SubscreenHeader } from '../components/ScreenHeader.jsx';
import { SegmentedControl } from '../components/SegmentedControl.jsx';
import { BottomSheet } from '../components/sheets/BottomSheet.jsx';
import { buildPairingPayload, parsePairingPayload, shortDeviceCode, nextPairedDevice } from '../domain/pairing.js';
import { useForegroundVisible } from '../native/useForegroundVisible.js';

const TABS = [
  { key: 'mine', label: 'My code' },
  { key: 'scan', label: 'Scan' },
];

/** Maps a getUserMedia failure to a message that actually matches what went wrong — a blanket
 * "check camera permission" is misleading when the real cause is no camera hardware, the camera
 * already being used elsewhere, or an autoplay/constraint rejection unrelated to permission. */
function cameraErrorMessage(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return "Couldn't access the camera — check camera permission in your device settings.";
    case 'NotFoundError':
    case 'OverconstrainedError':
      return "No camera found on this device.";
    case 'NotReadableError':
      return "The camera is already in use by another app.";
    default:
      return "Couldn't access the camera.";
  }
}

const NEARBY_STATUS_LABEL = {
  idle: 'Not syncing',
  connecting: 'Searching for paired device…',
  connected: 'Connected',
  error: 'Sync error',
};

/**
 * One-time device pairing (ticket #17): shows this device's own QR (encoding its stable deviceId
 * + a user-editable display name) for the other device to scan, or scans the other device's QR
 * via the camera. Once paired, also surfaces the transport session (ticket #18, via the `nearby`
 * prop from useNearbySync — see App.jsx): a paired device can be test-pinged to confirm the two
 * phones actually reach each other, and real data sync (ticket #20) happens automatically on
 * connect, with "Sync now" as a manual re-trigger for edits made after that.
 */
export function Pairing({ onBack, nearby }) {
  const { state, setState } = useStore();
  const { T, C } = useTheme();
  const [tab, setTab] = useState('mine');
  const [nameDraft, setNameDraft] = useState(state.deviceName);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [pendingPair, setPendingPair] = useState(null); // { id, name } awaiting confirmation
  const [confirmUnpair, setConfirmUnpair] = useState(false);
  // So the camera effect below can release the stream while backgrounded (home button, app
  // switcher, tabbing away) instead of burning battery with the camera indicator lit on a screen
  // nobody's looking at.
  const visible = useForegroundVisible();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(buildPairingPayload(state.deviceId, state.deviceName), { margin: 1, width: 220 })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [state.deviceId, state.deviceName]);

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== state.deviceName) setState({ deviceName: trimmed });
    setNameDraft(trimmed || state.deviceName);
  };

  // Camera scanning loop — only runs while the Scan tab is open, no pairing is awaiting
  // confirmation, and the app is foregrounded, and always tears its stream down on cleanup so
  // switching tabs (or a pending confirmation, or backgrounding, or leaving this screen) never
  // leaves the camera running unattended.
  useEffect(() => {
    if (tab !== 'scan' || pendingPair || !visible) return undefined;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setScanError("This device doesn't support camera scanning.");
      return undefined;
    }
    let stopped = false;
    setScanError(null);

    // Decoding every requestAnimationFrame tick at full camera resolution is unnecessary CPU/
    // battery load for a code that isn't moving — 5 scans/sec is plenty responsive, and capping
    // the capture's longer side keeps each getImageData/jsQR pass cheap regardless of camera
    // resolution (QR decoding degrades gracefully at lower resolution).
    const SCAN_INTERVAL_MS = 200;
    const MAX_CAPTURE_SIZE = 480;
    let lastScanAt = 0;

    function tick(now = performance.now()) {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && now - lastScanAt >= SCAN_INTERVAL_MS) {
        lastScanAt = now;
        const scale = Math.min(1, MAX_CAPTURE_SIZE / Math.max(video.videoWidth, video.videoHeight));
        const width = Math.round(video.videoWidth * scale);
        const height = Math.round(video.videoHeight * scale);
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          const parsed = parsePairingPayload(code.data);
          if (!parsed) {
            setScanError("That's not an ArthQuest pairing code.");
          } else if (parsed.id === state.deviceId) {
            setScanError("That's this device's own code — scan it on the other device instead.");
          } else {
            setPendingPair(parsed);
            return; // stop the loop; effect cleanup tears the camera down
          }
        } else {
          // Nothing in frame right now — clear any stale "not a pairing code" message from a
          // moment ago rather than leaving it stuck on screen once the code moves out of view.
          setScanError(null);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    (async () => {
      try {
        // Requesting a capped ideal resolution (the browser picks the closest the camera
        // supports) avoids decoding/delivering full sensor-resolution frames for the whole scan
        // session when every decode pass below downsamples to MAX_CAPTURE_SIZE anyway.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: MAX_CAPTURE_SIZE }, height: { ideal: MAX_CAPTURE_SIZE } },
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch (err) {
        if (!stopped) setScanError(cameraErrorMessage(err));
      }
    })();

    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [tab, pendingPair, visible, state.deviceId]);

  const confirmPair = () => {
    setState({ pairedDevice: nextPairedDevice(state.pairedDevice, pendingPair) });
    setPendingPair(null);
    setTab('mine');
  };

  const unpair = () => {
    setState({ pairedDevice: null });
    setConfirmUnpair(false);
  };

  // deviceId is generated by a mount effect in StoreContext.jsx (not synchronously available on
  // the very first render — see persistence.js's ensureDeviceId), so this screen must tolerate
  // rendering before it exists rather than crashing on a null id.
  if (!state.deviceId) {
    return (
      <>
        <SubscreenHeader title="Pair a device" onBack={onBack} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 13, color: T.textTertiary }}>Setting up this device…</div>
        </div>
      </>
    );
  }

  return (
    <>
      <SubscreenHeader title="Pair a device" onBack={onBack} />
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 20px 40px' }}>
        {state.pairedDevice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: T.card, border: T.cardBorder, borderRadius: 14, padding: '14px 16px', marginTop: 8, marginBottom: 18 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: C.accent }}>smartphone</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: T.textTertiary }}>Paired with</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state.pairedDevice.name}</div>
            </div>
            <button
              type="button"
              onClick={() => setConfirmUnpair(true)}
              style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, border: `1px solid ${T.border}`, borderRadius: 100, padding: '6px 12px', background: 'none', color: T.textSecondary, cursor: 'pointer' }}
            >
              Unpair
            </button>
          </div>
        )}

        {state.pairedDevice && nearby && (
          <div style={{ background: T.card, border: T.cardBorder, borderRadius: 14, padding: '14px 16px', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                background: nearby.status === 'connected' ? C.safe : nearby.status === 'error' ? C.danger : C.warn,
              }}
              />
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{NEARBY_STATUS_LABEL[nearby.status]}</div>
            </div>
            {nearby.error && !nearby.permissionDenied && (
              // Shown regardless of status: a ping can fail (see sendPing) while the connection
              // itself is otherwise still 'connected', not just while status === 'error'.
              <div style={{ fontSize: 12, color: C.danger, marginTop: 6, lineHeight: 1.4 }}>{nearby.error}</div>
            )}
            {nearby.permissionDenied && (
              // A distinct, actionable explainer (ticket #22) rather than just the generic error
              // line above — covers both "never granted" (declined the prompt) and "revoked later
              // via Android's own Settings" identically, since this app can't tell those apart and
              // the fix is the same either way: this device just isn't allowed to use Bluetooth/
              // Wi-Fi/nearby-device APIs right now, and the only way back is Android's own
              // per-app permission screen.
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'oklch(0.28 0.06 25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: C.danger }}>lock</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>Permission needed</span>
                </div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.4 }}>
                  ArthQuest needs Bluetooth/nearby-device permission to sync with {state.pairedDevice.name}. Grant it in this app's settings, then come back here.
                </div>
                <button
                  type="button"
                  onClick={nearby.openAppSettings}
                  style={{ marginTop: 8, padding: '8px 14px', borderRadius: 100, border: 'none', background: C.accent, color: T.onAccentText, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  Open Settings
                </button>
                {nearby.error && (
                  // The one shared error slot every action in this hook uses (sendPing, sync,
                  // the connection lifecycle) — surfaced here too so a failed "Open Settings" tap
                  // itself (e.g. no such settings screen on this device/ROM) is never silently
                  // swallowed just because the generic error line above is suppressed while
                  // permissionDenied is true. Redundant with the explainer text above on first
                  // render (both describe the same "permission needed" state) but never wrong.
                  <div style={{ fontSize: 11.5, color: C.danger, marginTop: 6, lineHeight: 1.4 }}>{nearby.error}</div>
                )}
              </div>
            )}
            {nearby.status === 'connected' && (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={nearby.sync}
                    style={{ marginTop: 10, padding: '9px 14px', borderRadius: 100, border: 'none', background: C.accent, color: T.onAccentText, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Sync now
                  </button>
                  <button
                    type="button"
                    onClick={nearby.sendPing}
                    style={{ marginTop: 10, padding: '9px 14px', borderRadius: 100, border: `1px solid ${T.border}`, background: 'none', color: T.textSecondary, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Send test ping
                  </button>
                </div>
                {nearby.lastRoundTripMs !== null && (
                  <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 8 }}>Echo received in {nearby.lastRoundTripMs}ms</div>
                )}
              </>
            )}
            {/* Full "Synced Xm ago" / stale-sync nudge treatment is ticket #21 — this is just
                enough to confirm a sync actually landed while testing this ticket (#20). */}
            {state.pairedDevice?.lastSyncedAt && (
              <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 8 }}>
                Last synced {new Date(state.pairedDevice.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
        </div>

        {tab === 'mine' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textTertiary, textTransform: 'uppercase', letterSpacing: '0.02em', alignSelf: 'flex-start', marginBottom: 6 }}>
              This device's name
            </div>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              placeholder="e.g. Axar's Phone"
              style={{ width: '100%', background: T.inputBg, border: 'none', borderRadius: 12, padding: 12, fontSize: 14, color: T.text, outline: 'none', marginBottom: 22 }}
            />
            <div style={{ width: 220, height: 220, background: '#fff', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {qrDataUrl ? <img src={qrDataUrl} alt="Pairing QR code" width={220} height={220} /> : null}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: T.textSecondary, marginTop: 14 }}>
              {shortDeviceCode(state.deviceId)}
            </div>
            <div style={{ fontSize: 12.5, color: T.textTertiary, textAlign: 'center', marginTop: 14, lineHeight: 1.4 }}>
              Open Pair a device on the other phone, switch to Scan, and point it at this code.
              Then swap: scan their code here too, so both phones remember each other.
            </div>
          </div>
        )}

        {tab === 'scan' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', aspectRatio: '1', background: '#000', borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div style={{ fontSize: 12.5, color: scanError ? C.danger : T.textTertiary, textAlign: 'center', marginTop: 14, lineHeight: 1.4 }}>
              {scanError ?? "Point the camera at the other device's pairing code."}
            </div>
          </div>
        )}
      </div>

      {pendingPair && (
        <BottomSheet onClose={() => setPendingPair(null)} maxHeight="auto">
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Pair with {pendingPair.name}?</div>
          <div style={{ fontSize: 13, color: T.textTertiary, marginTop: 6, lineHeight: 1.4 }}>
            {state.pairedDevice
              ? `This replaces your current pairing with ${state.pairedDevice.name}. Once connected, your data syncs automatically.`
              : "Once connected, your budget data syncs automatically — no separate 'share' step."}
          </div>
          <button
            type="button"
            onClick={confirmPair}
            style={{ width: '100%', padding: 14, borderRadius: 100, border: 'none', background: C.accent, color: T.onAccentText, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 18 }}
          >
            Confirm pairing
          </button>
          <button
            type="button"
            onClick={() => setPendingPair(null)}
            style={{ width: '100%', padding: 14, borderRadius: 100, border: `1px solid ${T.border}`, background: 'none', color: T.textSecondary, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 10 }}
          >
            Cancel
          </button>
        </BottomSheet>
      )}

      {confirmUnpair && (
        <BottomSheet onClose={() => setConfirmUnpair(false)} maxHeight="auto">
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Unpair {state.pairedDevice?.name}?</div>
          <div style={{ fontSize: 13, color: T.textTertiary, marginTop: 6, lineHeight: 1.4 }}>
            You can pair again any time — this only forgets the connection.
          </div>
          <button
            type="button"
            onClick={unpair}
            style={{ width: '100%', padding: 14, borderRadius: 100, border: 'none', background: 'oklch(0.3 0.08 25)', color: 'oklch(0.85 0.1 25)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 18 }}
          >
            Unpair
          </button>
          <button
            type="button"
            onClick={() => setConfirmUnpair(false)}
            style={{ width: '100%', padding: 14, borderRadius: 100, border: `1px solid ${T.border}`, background: 'none', color: T.textSecondary, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 10 }}
          >
            Cancel
          </button>
        </BottomSheet>
      )}
    </>
  );
}
