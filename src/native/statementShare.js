import { registerPlugin } from '@capacitor/core';

/**
 * Capacitor bridge for ticket #40 (Android-only — see
 * android/app/src/main/java/com/arthquest/pwa/StatementSharePlugin.kt): a statement file shared
 * into the app from Android's share sheet, as `{ base64 }` (its raw bytes — #45, PDFs) or
 * `{ error }`.
 *
 *   getPendingShare(): Promise<{ base64?, error? }> — the share that cold-launched the app, once.
 *   event 'shared' -> { base64?, error? } — a share arriving while the app is already running.
 *
 * There's no web implementation, so on the PWA build both reject/no-op ("not implemented").
 */
export const StatementShare = registerPlugin('StatementShare');
