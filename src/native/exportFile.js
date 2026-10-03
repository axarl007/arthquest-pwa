import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Saves/exports a text file (JSON backup or CSV) to the user. The web `<a download>` + Blob
 * technique below works fine in a real browser or an installed PWA, but silently does nothing in
 * Capacitor's Android WebView — there's no download-manager wiring for a bare WebView, so tapping
 * "Export" there just did nothing (the bug this file exists to fix). On native, write the file to
 * the app's private cache dir instead and hand it to the system share sheet, letting the user pick
 * where it actually goes (Downloads, Drive, email, etc.) — the standard Capacitor pattern for
 * exporting a generated file, and it sidesteps Android's scoped-storage restrictions entirely
 * since nothing is written to shared storage directly.
 */
// Every exported file lands directly in the cache dir's root (Directory.Cache, no subfolder) with
// this shared prefix, so a later export run can find and clean up its own past exports without
// touching anything else that might be in there.
const EXPORT_FILE_PREFIX = 'arthquest_';

// How long a previously-exported file is left alone before cleanup will touch it. Deliberately
// NOT deleted right after the current export's share sheet resolves — Android hands the receiving
// app a content:// grant on the underlying file, and that app can still be reading it
// asynchronously even after the chooser intent itself returns control to us (e.g. Gmail attaching
// it to a draft doesn't necessarily finish before its activity hands focus back). A real share
// flow's own file access is done within seconds; several minutes is a wide margin against that
// without letting exports pile up for long.
const CLEANUP_MIN_AGE_MS = 2 * 60 * 1000;

/** Best-effort deletes this app's own previously-exported files old enough to safely assume
 * nothing is still reading them — see CLEANUP_MIN_AGE_MS. */
async function cleanupPastExports() {
  const { files } = await Filesystem.readdir({ path: '', directory: Directory.Cache });
  const cutoff = Date.now() - CLEANUP_MIN_AGE_MS;
  await Promise.all(
    files
      .filter((f) => f.type === 'file' && f.name.startsWith(EXPORT_FILE_PREFIX) && f.mtime < cutoff)
      .map((f) => Filesystem.deleteFile({ path: f.name, directory: Directory.Cache }).catch(() => {})),
  );
}

export async function exportFile(filename, mimeType, content) {
  if (Capacitor.isNativePlatform()) {
    // Cleanup and the write are independent (the cutoff filter can never match the file about to
    // be written, since it doesn't exist yet) — run them concurrently rather than paying the
    // readdir/delete latency in front of every export.
    const [, { uri }] = await Promise.all([
      cleanupPastExports().catch(() => {}),
      Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      }),
    ]);
    try {
      // dialogTitle (not title) is what actually labels the share-sheet UI itself — title is
      // documented as the email-subject line for an email target, so it's kept as a friendly
      // sentence rather than the raw internal filename.
      await Share.share({ url: uri, title: 'ArthQuest export', dialogTitle: 'Export ArthQuest data' });
    } catch (err) {
      // The Android SharePlugin rejects with exactly this message when the user backs out of or
      // dismisses the share sheet without picking a target — that's not a failed export (the file
      // was written just fine, they just changed their mind about where to send it), so it's
      // swallowed here rather than surfacing as an error to the caller.
      if (err?.message !== 'Share canceled') throw err;
    }
    return;
  }
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
