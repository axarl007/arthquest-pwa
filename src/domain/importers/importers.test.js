import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseCsvLine } from './csv.js';
import { phonepe } from './phonepe.js';
import { parseStatement, StatementImportError } from './index.js';

// Redacted copy of a real PhonePe export: same preamble/header/footer layout, fake phone number,
// payees and ids (the repo is public — never commit a real statement).
const SAMPLE = fs.readFileSync(path.join(import.meta.dirname, 'fixtures/phonepe-sample.csv'), 'utf8');

const HEADER = 'Date,Time,Transaction Details,Transaction ID,UTR,Transaction Type,Credit/debit instrument,Amount';
const statement = (...rows) => ['Transaction Statement for 9000000000', 'Duration,"01 Oct, 2026 - 31 Oct, 2026"', '', HEADER, ...rows, '', 'Footer text'].join('\n');

describe('parseCsvLine', () => {
  it('splits plain and quoted fields, keeping commas inside quotes', () => {
    expect(parseCsvLine('a,"b, c",d')).toEqual(['a', 'b, c', 'd']);
  });
  it('unescapes doubled quotes', () => {
    expect(parseCsvLine('"say ""hi""",x')).toEqual(['say "hi"', 'x']);
  });
  it('keeps empty fields', () => {
    expect(parseCsvLine('a,,c,')).toEqual(['a', '', 'c', '']);
  });
});

describe('phonepe importer', () => {
  it('detects a PhonePe statement and rejects other CSVs', () => {
    expect(phonepe.detect(SAMPLE)).toBe(true);
    expect(phonepe.detect('Date,Type,Category,Description,Amount\n2026-10-01,EXPENSE,Food,,10')).toBe(false);
  });

  it('parses the sample statement, skipping preamble and footer', () => {
    const { rows, invalidCount } = phonepe.parse(SAMPLE);
    expect(invalidCount).toBe(0);
    expect(rows).toEqual([
      { externalId: 'phonepe:T2610030909442184600001', date: '2026-10-03', time: '09:09', amount: 800, direction: 'debit', payee: 'Mr RAVI KUMAR G', rawDescription: 'Paid to Mr RAVI KUMAR G' },
      { externalId: 'phonepe:T2610021753517620600002', date: '2026-10-02', time: '17:53', amount: 1274, direction: 'debit', payee: 'Home Centre', rawDescription: 'Paid to Home Centre' },
      { externalId: 'phonepe:T2610011305400903500003', date: '2026-10-01', time: '13:05', amount: 50, direction: 'debit', payee: 'ASHA RAO', rawDescription: 'Paid to ASHA RAO' },
    ]);
  });

  it('parses CREDIT rows and strips "Received from"', () => {
    const { rows } = phonepe.parse(statement('"Oct 05, 2026","12:15 am","Received from Priya S","T1","U1","CREDIT","Credited to XXXXXX0000","2,500.50"'));
    expect(rows[0]).toMatchObject({ direction: 'credit', payee: 'Priya S', amount: 2500.5, time: '00:15', date: '2026-10-05' });
  });

  it('handles 12 pm, CRLF line endings and a UTF-8 BOM', () => {
    const text = '﻿' + statement('"Oct 05, 2026","12:40 pm","Paid to X","T1","U1","DEBIT","Paid by X","10"').replace(/\n/g, '\r\n');
    expect(phonepe.detect(text)).toBe(true);
    expect(phonepe.parse(text).rows[0]).toMatchObject({ time: '12:40', payee: 'X' });
  });

  it('keeps descriptions without a known prefix as the payee', () => {
    const { rows } = phonepe.parse(statement('"Oct 05, 2026","10:00 am","Mobile recharged 9000000000","T1","U1","DEBIT","Paid by X","199"'));
    expect(rows[0].payee).toBe('Mobile recharged 9000000000');
  });

  it('ends the table at the first non-row line even without a blank line before the footer', () => {
    const text = [HEADER, '"Oct 05, 2026","10:00 am","Paid to A","T1","U1","DEBIT","Paid by X","10"', 'This is an automatically generated statement. Customer(s) are requested', 'of any errors, visit https://support.phonepe.com/statement'].join('\n');
    expect(phonepe.parse(text)).toEqual({ rows: [expect.objectContaining({ payee: 'A' })], invalidCount: 0 });
  });

  it('counts unreadable rows instead of importing garbage', () => {
    const { rows, invalidCount } = phonepe.parse(statement(
      '"Oct 05, 2026","10:00 am","Paid to A","T1","U1","DEBIT","Paid by X","abc"',
      '"Foo 05, 2026","10:00 am","Paid to B","T2","U2","DEBIT","Paid by X","10"',
      '"Oct 05, 2026","10:00 am","Paid to C","T3","U3","REFUND","Paid by X","10"',
      '"Oct 05, 2026","10:00 am","Paid to D","T4","U4","DEBIT","Paid by X","0"',
      '"Oct 05, 2026","10:00 am","Paid to E","T5","U5","DEBIT","Paid by X","10"',
    ));
    expect(rows.map((r) => r.payee)).toEqual(['E']);
    expect(invalidCount).toBe(4);
  });
});

describe('parseStatement', () => {
  it('auto-detects the format', () => {
    const result = parseStatement(SAMPLE);
    expect(result.format.id).toBe('phonepe');
    expect(result.rows).toHaveLength(3);
  });

  it('throws an unrecognized error naming the supported formats', () => {
    expect(() => parseStatement('hello,world')).toThrow(StatementImportError);
    try {
      parseStatement('hello,world');
    } catch (e) {
      expect(e.code).toBe('unrecognized');
      expect(e.message).toBe('Unrecognized file — supported: PhonePe');
    }
  });

  it('throws an empty error for a recognized statement with no readable rows', () => {
    try {
      parseStatement(statement());
      expect.unreachable();
    } catch (e) {
      expect(e.code).toBe('empty');
    }
  });
});
