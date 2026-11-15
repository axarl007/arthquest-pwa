import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { redactStatement, decodeText, parseArgs } from './redact-statement.mjs';
import { phonepe } from '../src/domain/importers/phonepe.js';

const SAMPLE = fs.readFileSync(path.join(import.meta.dirname, '../src/domain/importers/fixtures/phonepe-sample.csv'), 'utf8');

// Deterministic rng so assertions are stable.
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const redact = (text, opts = {}) => redactStatement(text, { rng: seeded(), ...opts });

describe('redactStatement', () => {
  it('keeps a PhonePe statement parseable: same header, dates, times, row count, directions', () => {
    const { text } = redact(SAMPLE);
    const before = phonepe.parse(SAMPLE).rows;
    const after = phonepe.parse(text).rows;
    expect(phonepe.detect(text)).toBe(true);
    expect(after).toHaveLength(before.length);
    after.forEach((row, i) => {
      expect(row).toMatchObject({ date: before[i].date, time: before[i].time, direction: before[i].direction });
      expect(row.payee).not.toBe(before[i].payee);
      expect(row.externalId).not.toBe(before[i].externalId);
      expect(row.externalId).toMatch(/^phonepe:T\d{22}$/); // prefix + length preserved
    });
  });

  it('removes names, phone and account numbers', () => {
    const { text } = redact(SAMPLE);
    for (const secret of ['RAVI', 'KUMAR', 'ASHA', 'RAO', '9000000000']) expect(text).not.toContain(secret);
    expect(text).toContain('Paid to');
    expect(text).toMatch(/Paid by XXXXXX[1-9]\d{3}"/); // masking stays masking, digits are faked
  });

  it('preserves number formats (commas, decimals, digit counts)', () => {
    const { text } = redact('Name,Foo Bar\nDate,Narration,Amount\n01/10/2026,UPI transfer,"12,345.67"\n');
    const amount = text.match(/"([\d,.]+)"/)[1];
    expect(amount).toMatch(/^[1-9]\d,\d{3}\.\d{2}$/);
    expect(amount).not.toBe('12,345.67');
    expect(text).toContain('Date,Narration,Amount'); // header verbatim
    expect(text).toContain('01/10/2026');
    expect(text).not.toMatch(/Foo|Bar/);
  });

  it('replaces the same payee/id consistently, case pattern preserved', () => {
    const { text } = redact('Date,Details,Ref\n01/10/2026,Paid to Ravi,R99887766\n02/10/2026,Paid to RAVI,R99887766\n');
    const [, a, b] = text.split('\n');
    const nameA = a.split(',')[1].slice('Paid to '.length);
    const nameB = b.split(',')[1].slice('Paid to '.length);
    expect(nameA.toUpperCase()).toBe(nameB);
    expect(nameA).toMatch(/^[A-Z][a-z]{3}$/);
    expect(a.split(',')[2]).toBe(b.split(',')[2]);
  });

  it('fakes the local part of UPI ids but keeps the handle', () => {
    const { text } = redact('Date,Details,Amount\n01/10/2026,UPI/ravi.kumar99@okaxis/Payment,100\n');
    expect(text).toMatch(/UPI\/[a-z]{4}\.[a-z]{5}\d\d@okaxis\/Payment/);
    expect(text).not.toContain('ravi');
  });

  it('does not treat a reference like 123/45/6789 as a date', () => {
    const { text } = redact('Date,Details,Amount\n01/10/2026,NEFT 123/45/6789,10\n');
    expect(text).not.toContain('123/45/6789');
  });

  it('honours --keep words and reports kept words', () => {
    const { text, report } = redact('Date,Details,Amount\n01/10/2026,Zeta Store,10\n', { keep: ['Zeta'] });
    expect(text).toContain('Zeta ');
    expect(report.keptWords.has('zeta')).toBe(true);
  });

  it('redacts everything after a UPI handle in hyphen-delimited narrations (IFSC, UTR, remark)', () => {
    const { text } = redact('Date,Narration,Amount\n01/04/2026,UPI-RAVI KUMAR-ravi.kumar@okaxis-SBIN0001234-612345678901-PAYMENT FROM RAVI,10\n');
    for (const secret of ['RAVI', 'ravi', 'KUMAR', 'SBIN0001234', '612345678901']) expect(text).not.toContain(secret);
    expect(text).toContain('@okaxis-');
  });

  it('never keeps a preamble row verbatim just because it sits above a dated row', () => {
    const { text, report } = redact('Account Holder,RAVI KUMAR,Savings\nPeriod,01/04/2026,30/04/2026\n');
    expect(text).not.toMatch(/RAVI|KUMAR/);
    expect(report.headerWordsReplaced).toEqual(new Set(['Holder', 'RAVI', 'KUMAR', 'Savings']));
  });

  it('redacts non-ASCII names (Devanagari, accented Latin)', () => {
    const { text } = redact('Date,Details,Amount\n01/04/2026,Paid to रवि कुमार José,10\n');
    expect(text).not.toMatch(/[^ -~\n]/); // printable ASCII only
    expect(text).toMatch(/Paid to [a-z]+ [a-z]+ [A-Z][a-z]{3},/);
  });

  it('handles letters whose lowercase is longer than one char (İ)', () => {
    const { text } = redact('Date,Details,Amount\n01/04/2026,Paid to İSMAİL,10\n');
    expect(text).toMatch(/Paid to [A-Z]{6},/);
  });

  it('does not keep first-name-like words or single initials', () => {
    const { text } = redact('Date,Details,Amount\n01/05/2026,Paid to Will May A Bill,10\n');
    expect(text).not.toMatch(/Will|May|Bill| A /);
  });

  it('randomises zeros inside numbers too (only leading zeros stay)', () => {
    const outs = new Set();
    for (let seed = 1; seed <= 20; seed++) outs.add(redactStatement('Ph 9000000000 amt 0500', { rng: seeded(seed) }).text);
    for (const t of outs) expect(t).toMatch(/^\w+ [1-9]\d{9} amt 0[1-9]\d\d$/);
    expect([...outs].some((t) => !/[1-9]000000000/.test(t))).toBe(true);
  });

  it('keeps URL hosts but redacts path and query', () => {
    const { text } = redact('See https://bank.example.com/stmt?acct=50100123456789&name=RAVI\n');
    expect(text).toContain('https://bank.example.com/');
    expect(text).not.toMatch(/50100123456789|RAVI|stmt/);
  });

  it('maps distinct originals to distinct fakes', () => {
    const originals = Array.from({ length: 50 }, (_, i) => String(10 + i));
    const { text } = redact(originals.join(' '));
    expect(new Set(text.split(' ')).size).toBe(50);
  });

  it('keeps HDFC credit card structure (~|~ delimiters, Domestic/International, Cr) but fakes the name', () => {
    const { text, report } = redact('Transaction type~|~Customer Name~|~Date~|~Description~|~Amt\nDomestic~|~RAVI KUMAR~|~05/10/2026 14:22:10~|~SWIGGY BANGALORE~|~1,234.00~|~Cr\n');
    expect(text).toMatch(/^Transaction type~\|~Customer \w+~\|~Date~\|~Description~\|~Amt\nDomestic~\|~[A-Z]{4} [A-Z]{5}~\|~05\/10\/2026 14:22:10~\|~SWIGGY [A-Z]{9}~\|~[1-9],\d{3}\.\d{2}~\|~Cr\n$/);
    expect(report.headerWordsReplaced.has('Name')).toBe(true);
  });

  it('preserves CRLF line endings and a BOM', () => {
    const { text } = redact('﻿Date,Details,Amount\r\n01/10/2026,Foo,10\r\n');
    expect(text.startsWith('﻿Date,Details,Amount\r\n')).toBe(true);
    expect(text.endsWith('\r\n')).toBe(true);
  });
});

describe('decodeText', () => {
  it('decodes UTF-16LE/BE with a BOM and rejects NULs without one', () => {
    const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Date,Amt\n', 'utf16le')]);
    expect(decodeText(le)).toBe('Date,Amt\n');
    const be = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from('Date,Amt\n', 'utf16le').swap16()]);
    expect(decodeText(be)).toBe('Date,Amt\n');
    expect(() => decodeText(Buffer.from('D\0a\0t\0e\0'))).toThrow(/NUL/);
    expect(() => decodeText(Buffer.from([0xfe, 0xff, 0x00, 0x44, 0x00]))).toThrow(/odd byte count/);
    expect(decodeText(Buffer.from('Date,Amt'))).toBe('Date,Amt');
  });
});

describe('parseArgs', () => {
  it('accepts --keep=a,b and --keep a,b', () => {
    expect(parseArgs(['in.csv', '--keep=A,B'])).toEqual({ input: 'in.csv', output: undefined, keep: ['A', 'B'] });
    expect(parseArgs(['in.csv', '--keep', 'Zeta', 'out.csv'])).toEqual({ input: 'in.csv', output: 'out.csv', keep: ['Zeta'] });
  });
  it('rejects unknown flags, a missing --keep value and extra files', () => {
    expect(() => parseArgs(['in.csv', '--kep=A'])).toThrow(/Unknown option/);
    expect(() => parseArgs(['in.csv', '--keep'])).toThrow(/needs a value/);
    expect(() => parseArgs(['a', 'b', 'c'])).toThrow(/Expected/);
  });
});
