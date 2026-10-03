/**
 * pdf.js text extraction for PDF statements (ticket #45): bytes → per-page text items. pdf.js and
 * its worker are bundled locally (never CDN — offline-first) and only loaded on the first PDF
 * import via dynamic import(), so ordinary app start-up doesn't pay for ~1.8 MB of PDF engine.
 * The worker is precached by the service worker (workbox globPatterns include .mjs), so this
 * works offline too. The *legacy* build on purpose: the modern one relies on very recent JS
 * built-ins (Promise.try, Map#getOrInsertComputed, Uint8Array#toHex…) with no polyfills, which
 * older Android WebViews lack — and it's the same build the vitest end-to-end test exercises.
 * isEvalSupported is off: statements never need pdf.js's eval-based font path.
 */
export async function extractPdfPages(bytes) {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.min.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
  try {
    const doc = await task.promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      pages.push((await page.getTextContent()).items);
    }
    return pages;
  } finally {
    // Frees the worker-side document (pdf.js 6 puts destroy() on the loading task).
    task.destroy();
  }
}
