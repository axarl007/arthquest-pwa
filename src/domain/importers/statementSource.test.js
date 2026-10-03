import { describe, it, expect } from 'vitest';
import { statementSourceFromBytes } from './statementSource.js';

const bytes = (s) => new TextEncoder().encode(s);

describe('statementSourceFromBytes', () => {
  it('decodes non-PDF files as UTF-8 text without touching the PDF extractor', async () => {
    const extract = () => { throw new Error('should not be called'); };
    expect(await statementSourceFromBytes(bytes('Date,Time\n₹1'), extract)).toEqual({ kind: 'text', text: 'Date,Time\n₹1' });
  });

  it('extracts and groups PDF text (by %PDF magic, not file name or MIME type)', async () => {
    const extract = async (b) => {
      expect(b[0]).toBe(0x25);
      return [[{ str: 'Hello', transform: [1, 0, 0, 1, 10, 100] }]];
    };
    expect(await statementSourceFromBytes(bytes('%PDF-1.7 …'), extract)).toEqual({ kind: 'pdf', lines: [{ page: 1, cells: ['Hello'] }] });
  });

  it('reports an unreadable PDF as an unrecognized statement', async () => {
    const extract = async () => { throw new Error('Invalid PDF structure'); };
    await expect(statementSourceFromBytes(bytes('%PDF-broken'), extract)).rejects.toMatchObject({ code: 'unrecognized' });
  });
});
