/**
 * Turns pdf.js text items (per page, each `{ str, transform }` with x = transform[4], y =
 * transform[5] in PDF space, origin bottom-left) into reading-order lines for PDF statement
 * importers (ticket #45): items whose baselines are within Y_TOLERANCE are one line, lines run top
 * to bottom, cells left to right, blank items dropped, touching pieces of one word rejoined. Pure — the pdf.js call itself lives in
 * src/native/pdfText.js so this stays unit-testable without a PDF engine.
 *
 *   Line = { page: 1-based, cells: string[] }
 */
const Y_TOLERANCE = 2;
const JOIN_GAP = 0.15;

export function groupTextItemsIntoLines(pages) {
  const lines = [];
  pages.forEach((items, pageIndex) => {
    const rows = [];
    for (const it of items) {
      const text = it.str.trim();
      if (!text) continue;
      const x = it.transform[4];
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) <= Y_TOLERANCE);
      if (!row) {
        row = { y, cells: [] };
        rows.push(row);
      }
      row.cells.push({ x, text, width: it.width, height: it.height, leadingSpace: /^\s/.test(it.str), trailingSpace: /\s$/.test(it.str) });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.cells.sort((a, b) => a.x - b.x);
      // pdf.js splits a run wherever the font/glyph run changes (e.g. at an "ffi" ligature), so
      // one word can arrive as several touching items — rejoin those; a real gap between columns
      // is far wider than JOIN_GAP of the text height.
      const cells = [];
      for (const c of row.cells) {
        const prev = cells[cells.length - 1];
        if (prev && prev.end != null && c.x - prev.end <= JOIN_GAP * (c.height || prev.height || 0)) {
          prev.text += (prev.spacedEnd || c.leadingSpace ? ' ' : '') + c.text;
          prev.end = c.width != null ? c.x + c.width : null;
          prev.spacedEnd = c.trailingSpace;
        } else {
          cells.push({ text: c.text, end: c.width != null ? c.x + c.width : null, height: c.height, spacedEnd: c.trailingSpace });
        }
      }
      lines.push({ page: pageIndex + 1, cells: cells.map((c) => c.text) });
    }
  });
  return lines;
}
