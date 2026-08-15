import { useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { useTheme } from '../theme/useTheme.js';
import { SubscreenHeader } from '../components/ScreenHeader.jsx';
import { SegmentedControl } from '../components/SegmentedControl.jsx';
import { freshState } from '../store/persistence.js';
import { buildBackupJson, buildTransactionsCsv, parseBackupJson } from '../domain/exportData.js';
import { exportFile } from '../native/exportFile.js';

const THEME_OPTIONS = [{ key: 'dark', label: 'Dark' }, { key: 'vibrant', label: 'Vibrant' }];
const ICON_STYLE_OPTIONS = [{ key: 'flat', label: 'Flat' }, { key: 'cartoon', label: 'Cartoon' }];

const REMINDER_ROWS = [
  { key: 'daily', label: 'Daily log reminder', sub: "Notified in the evening if nothing's logged yet today" },
  { key: 'monthEnd', label: 'Month-end lock warning', sub: 'Notified a few days before your budget plan locks' },
  { key: 'backup', label: 'Backup reminder', sub: 'Notified periodically to export a JSON backup' },
  { key: 'review', label: 'New-month budget review', sub: 'Notified on the 1st to review your plan' },
];

function timestampForFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/** Requests Notification permission only at the moment a toggle is switched on — never
 * proactively (decision #3) — and only if the browser hasn't already been asked. */
function ensureNotificationPermission() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') Notification.requestPermission();
}

export function Settings({ onBack, onOpenCategories, onAdjustIncomeSplit, onOpenPairing, onReset }) {
  const { state, setState } = useStore();
  const { T, C } = useTheme();
  const [resetStep, setResetStep] = useState(0); // 0 closed, 1 first confirm, 2 final confirm
  const [importError, setImportError] = useState(null);
  const [exportError, setExportError] = useState(null);
  // On native, exportFile() cleans up its own previously-exported cache files at the start of the
  // *next* call rather than right after sharing (deleting immediately risks the receiving app
  // still being mid-read on a still-open share sheet — see exportFile.js). That only holds if
  // exports can't overlap, so this disables both buttons for the duration of an in-flight export
  // instead of just relying on nobody double-tapping.
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef(null);

  const setReminderToggle = (key, enabled) => {
    if (enabled) ensureNotificationPermission();
    setState((s) => ({ settingsToggles: { ...s.settingsToggles, [key]: enabled } }));
  };

  const runExport = (filename, mimeType, content) => {
    setExportError(null);
    setExporting(true);
    exportFile(filename, mimeType, content)
      .catch(() => setExportError("Couldn't export that file — please try again."))
      .finally(() => setExporting(false));
  };
  const exportJson = () => runExport(`arthquest_backup_${timestampForFilename()}.json`, 'application/json', buildBackupJson(state));
  const exportCsv = () => runExport(`arthquest_transactions_${timestampForFilename()}.csv`, 'text/csv', buildTransactionsCsv(state));

  const importJson = (file) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const patch = parseBackupJson(String(reader.result));
        setState(patch);
      } catch {
        setImportError("Couldn't read that file — make sure it's an ArthQuest JSON backup.");
      }
    };
    reader.readAsText(file);
  };

  const confirmReset = () => {
    // Device identity (ticket #17) is this device's own setting, not budget data — preserved
    // across a reset the same way theme is. Pairing is deliberately NOT preserved once sync
    // exists (ticket #20): mergeState only ever additively unions records, so staying paired
    // across a reset would mean the very next sync (the peer reconnecting, or either side
    // hitting "Sync now") pulls the peer's untouched full history straight back in, silently
    // undoing the reset. Unpairing forces a conscious re-pair before any data can flow again,
    // matching how a brand-new pairing already shows "no data is shared yet" until that happens.
    setState(() => ({
      ...freshState(), theme: state.theme, deviceId: state.deviceId, deviceName: state.deviceName,
    }));
    setResetStep(0);
    onReset();
  };

  const sectionLabelStyle = { fontSize: 12, fontWeight: 700, color: T.textTertiary, textTransform: 'uppercase', letterSpacing: '0.02em', margin: '18px 0 8px' };
  const dataButtonStyle = { width: '100%', textAlign: 'left', background: T.card, border: 'none', borderRadius: 14, padding: '14px 16px', color: T.text, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <>
      <SubscreenHeader title="Settings" onBack={onBack} />
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 20px 40px' }}>
        <div style={{ ...sectionLabelStyle, margin: '8px 0 8px' }}>Appearance</div>
        <div style={{ marginBottom: 22 }}>
          <SegmentedControl options={THEME_OPTIONS} value={state.theme} onChange={(key) => setState({ theme: key })} />
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: T.textTertiary, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 8 }}>
          Category icons
        </div>
        <div style={{ marginBottom: 22 }}>
          <SegmentedControl options={ICON_STYLE_OPTIONS} value={state.iconStyle} onChange={(key) => setState({ iconStyle: key })} />
        </div>

        <div style={sectionLabelStyle}>Reminders</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: T.border, borderRadius: 14, overflow: 'hidden' }}>
          {REMINDER_ROWS.map((row) => {
            const on = state.settingsToggles[row.key];
            return (
              <div key={row.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: T.card, padding: '14px 16px' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{row.label}</div>
                  <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 2 }}>{row.sub}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={row.label}
                  onClick={() => setReminderToggle(row.key, !on)}
                  style={{ position: 'relative', width: 46, height: 26, borderRadius: 13, border: 'none', background: on ? C.accent : T.trackBg, cursor: 'pointer', flexShrink: 0, padding: 0 }}
                >
                  <div style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: 10, background: '#fff', transition: 'left 0.15s' }} />
                </button>
              </div>
            );
          })}
        </div>

        <div style={sectionLabelStyle}>Data</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={exportJson} disabled={exporting} style={{ ...dataButtonStyle, opacity: exporting ? 0.6 : 1, cursor: exporting ? 'default' : 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
            Export as JSON (full backup)
          </button>
          <button type="button" onClick={exportCsv} disabled={exporting} style={{ ...dataButtonStyle, opacity: exporting ? 0.6 : 1, cursor: exporting ? 'default' : 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
            Export as CSV
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} style={dataButtonStyle}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload</span>
            Import JSON backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importJson(file);
              e.target.value = '';
            }}
          />
          {exportError && <div style={{ fontSize: 12, color: C.danger, padding: '0 4px' }}>{exportError}</div>}
          {importError && <div style={{ fontSize: 12, color: C.danger, padding: '0 4px' }}>{importError}</div>}
        </div>

        <div style={sectionLabelStyle}>Sync</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={onOpenPairing} style={dataButtonStyle}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>smartphone</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {state.pairedDevice ? `Paired with ${state.pairedDevice.name}` : 'Pair a device'}
            </span>
          </button>
        </div>

        <div style={sectionLabelStyle}>Manage</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={onOpenCategories} style={dataButtonStyle}>Manage categories</button>
          <button type="button" onClick={onAdjustIncomeSplit} style={dataButtonStyle}>Redo income split</button>
        </div>

        <div style={{ ...sectionLabelStyle, color: C.danger }}>Danger zone</div>
        <button
          type="button"
          onClick={() => setResetStep(1)}
          style={{
            width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
            border: '1px solid oklch(0.4 0.1 25 / 0.5)', background: 'oklch(0.24 0.05 25)', color: 'oklch(0.82 0.12 25)',
            borderRadius: 14, padding: '14px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete_forever</span>
          Reset all data
        </button>

        <div style={{ textAlign: 'center', fontSize: 12, color: T.textTertiary, opacity: 0.7, marginTop: 26 }}>
          ArthQuest · v1.0 · fully offline
        </div>
      </div>

      {resetStep > 0 && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 20 }} onClick={() => setResetStep(0)} />
          <div style={{ position: 'absolute', left: 20, right: 20, top: '50%', transform: 'translateY(-50%)', background: T.sheetBg, borderRadius: 24, padding: '26px 22px', textAlign: 'center', zIndex: 21, animation: 'popIn 0.2s' }}>
            <div style={{ fontSize: 34, color: C.danger }}>⚠</div>
            <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 800, color: T.text, marginTop: 8 }}>
              {resetStep === 1 ? 'Reset all data?' : 'Are you absolutely sure?'}
            </div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 6, lineHeight: 1.4 }}>
              {resetStep === 1
                ? "This clears every transaction, quest and category, and restores ArthQuest to first-time setup."
                : "This can't be undone. Every transaction, quest, category and reminder/data setting will be erased, and this device will be unpaired (so a synced partner device can't bring the old data back) — only your theme and device name are kept."}
            </div>
            <button
              type="button"
              onClick={() => (resetStep === 1 ? setResetStep(2) : confirmReset())}
              style={{ width: '100%', padding: 15, borderRadius: 100, border: 'none', background: 'oklch(0.68 0.19 25)', color: 'oklch(0.98 0.01 25)', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 18 }}
            >
              {resetStep === 1 ? 'Continue' : 'Yes, erase everything'}
            </button>
            <button
              type="button"
              onClick={() => setResetStep(0)}
              style={{ width: '100%', padding: 14, borderRadius: 100, border: 'none', background: 'none', color: T.textTertiary, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </>
  );
}
