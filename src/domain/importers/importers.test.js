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

describe('phonepe importer — spreadsheet-resaved export', () => {
  // Redacted copy of a real export after a spreadsheet app re-saved it: unquoted fields, every
  // line padded to 8 columns (blank lines become ",,,,,,,"), 4-letter "Sept", "2:18 PM" times,
  // NB…/OLEX… transaction ids.
  const SHEET = fs.readFileSync(path.join(import.meta.dirname, 'fixtures/phonepe-spreadsheet-sample.csv'), 'utf8');

  it('reads every row, including 4-letter "Sept" dates, with nothing reported unreadable', () => {
    expect(phonepe.detect(SHEET)).toBe(true);
    const { rows, invalidCount } = phonepe.parse(SHEET);
    expect(invalidCount).toBe(0);
    expect(rows.map((r) => [r.date, r.time, r.amount, r.direction])).toEqual([
      ['2026-10-03', '14:18', 1500, 'debit'],
      ['2026-09-30', '17:58', 313.95, 'debit'],
      ['2026-09-17', '17:08', 2497, 'debit'],
      ['2026-09-14', '13:45', 10000, 'credit'],
      ['2026-09-13', '19:42', 129, 'debit'],
      ['2026-09-06', '00:13', 1019, 'debit'],
      ['2026-09-04', '09:23', 40000, 'debit'],
    ]);
  });

  it('keeps non-UPI ids and strips "Payment to" like "Paid to"', () => {
    const { rows } = phonepe.parse(SHEET);
    expect(rows[2]).toMatchObject({ externalId: 'phonepe:NB26091717075979900003', payee: 'Credit card bill paid XXXXXXXXXXXX0000' });
    expect(rows[4]).toMatchObject({ externalId: 'phonepe:OLEX2609131942271282700005', payee: 'SPORTA TECHNOLOGIES PRIVATE LIMITED' });
  });

  it('accepts 3-letter, 4-letter and full month names in any case', () => {
    const one = (d) => phonepe.parse(statement(`"${d}","10:00 am","Paid to A","T1","U1","DEBIT","X","10"`)).rows[0]?.date;
    expect(one('Sep 01, 2026')).toBe('2026-09-01');
    expect(one('September 01, 2026')).toBe('2026-09-01');
    expect(one('JUNE 5, 2026')).toBe('2026-06-05');
    expect(one('Septx 01, 2026')).toBeUndefined();
  });
});

describe('parseStatement', () => {
  it('routes a PDF source to PDF importers only', () => {
    expect(() => parseStatement({ kind: 'pdf', lines: [{ page: 1, cells: ['Some other PDF'] }] })).toThrow('Unrecognized file');
  });

  it('auto-detects the format', () => {
    const result = parseStatement({ kind: 'text', text: SAMPLE });
    expect(result.format.id).toBe('phonepe');
    expect(result.rows).toHaveLength(3);
  });

  it('throws an unrecognized error naming the supported formats', () => {
    expect(() => parseStatement({ kind: 'text', text: 'hello,world' })).toThrow(StatementImportError);
    try {
      parseStatement({ kind: 'text', text: 'hello,world' });
    } catch (e) {
      expect(e.code).toBe('unrecognized');
      expect(e.message).toBe('Unrecognized file — supported: PhonePe, Google Pay');
    }
  });

  it('throws an empty error for a recognized statement with no readable rows', () => {
    try {
      parseStatement({ kind: 'text', text: statement() });
      expect.unreachable();
    } catch (e) {
      expect(e.code).toBe('empty');
    }
  });
});
