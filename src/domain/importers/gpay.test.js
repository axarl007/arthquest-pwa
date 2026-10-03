import { describe, it, expect } from 'vitest';
import { gpay } from './gpay.js';

// Lines as groupTextItemsIntoLines produces them from a GPay "Transaction statement" PDF — the
// layout of a real Sept 2026 statement, with synthetic people/ids (the repo is public).
const L = (...cells) => ({ page: 1, cells });
const HEADER = [
  L('Transaction statement'),
  L('9000000000, someone@example.com'),
  L('Transaction statement period', 'Sent', 'Received'),
  L('01 September 2026 - 30 September 2026', '₹6,103.5', '₹3.09'),
  L('Date & time', 'Transaction details', 'Amount'),
];
const FOOTER = [
  L('Note: This statement reflects payments made by you on the Google Pay app. Self transfer payments are not included in the total money paid and'),
  L('received. Any payments transactions and activity deleted from your Google Account will not show up in this statement.'),
  L('Page 1 of 1'),
];
const tx = (date, desc, amount, time, id, instrument) => [
  L(date, desc, amount),
  L(time, `UPI Transaction ID: ${id}`),
  L(instrument),
];
const source = (lines) => ({ kind: 'pdf', lines });

describe('gpay importer', () => {
  const lines = [
    ...HEADER,
    ...tx('01 Sep, 2026', 'Paid to Myntra', '₹5,920', '10:47 AM', '600000000001', 'Paid by Example Bank 0000'),
    ...tx('04 Sep, 2026', 'Received from Google Play', '₹3.09', '02:38 PM', '600000000002', 'Paid to Example Bank 0000'),
    ...FOOTER,
    { page: 2, cells: ['Transaction statement'] },
    ...tx('30 Sep, 2026', 'Paid to SHADOWFAX TECHNOLOGIES LIMITED', '₹183.50', '12:05 AM', '600000000003', 'Paid by Example Bank 0000')
      .map((l) => ({ ...l, page: 2 })),
  ];

  it('detects a GPay statement PDF and ignores text input', () => {
    expect(gpay.detect(source(lines))).toBe(true);
    expect(gpay.detect(source([L('Some other PDF')]))).toBe(false);
    expect(gpay.detect({ kind: 'text', text: 'Transaction statement' })).toBe(false);
  });

  it('parses transactions across pages, skipping header and footer', () => {
    const { rows, invalidCount } = gpay.parse(source(lines));
    expect(invalidCount).toBe(0);
    expect(rows).toEqual([
      { externalId: 'gpay:600000000001', date: '2026-09-01', time: '10:47', amount: 5920, direction: 'debit', payee: 'Myntra', rawDescription: 'Paid to Myntra' },
      { externalId: 'gpay:600000000002', date: '2026-09-04', time: '14:38', amount: 3.09, direction: 'credit', payee: 'Google Play', rawDescription: 'Received from Google Play' },
      { externalId: 'gpay:600000000003', date: '2026-09-30', time: '00:05', amount: 183.5, direction: 'debit', payee: 'SHADOWFAX TECHNOLOGIES LIMITED', rawDescription: 'Paid to SHADOWFAX TECHNOLOGIES LIMITED' },
    ]);
  });

  it('joins a payee name wrapped onto its own line', () => {
    const wrapped = [
      ...HEADER,
      L('09 Sep, 2026', 'Paid to ADYAR ANANDA BHAVAN SWEETS', '₹999'),
      L('INDIA PVT LTD'),
      L('02:44 PM', 'UPI Transaction ID: 600000000009'),
      L('Paid by Example Bank 0000'),
    ];
    expect(gpay.parse(source(wrapped)).rows[0].payee).toBe('ADYAR ANANDA BHAVAN SWEETS INDIA PVT LTD');
  });

  it('falls back to the instrument line for an unknown description prefix', () => {
    const odd = [...HEADER, ...tx('09 Sep, 2026', 'Cashback from Example', '₹10', '09:00 AM', '600000000010', 'Paid to Example Bank 0000')];
    expect(gpay.parse(source(odd)).rows[0]).toMatchObject({ direction: 'credit', payee: 'Cashback from Example' });
  });

  it('counts a transaction it cannot complete as invalid instead of guessing', () => {
    const broken = [
      ...HEADER,
      L('09 Sep, 2026', 'Paid to A', '₹abc'),
      L('02:44 PM', 'UPI Transaction ID: 600000000011'),
      L('Paid by Example Bank 0000'),
      L('10 Sep, 2026', 'Paid to B', '₹10'),
      L('Paid by Example Bank 0000'), // no time / id line
      ...tx('11 Sep, 2026', 'Paid to C', '₹20', '01:00 PM', '600000000012', 'Paid by Example Bank 0000'),
    ];
    const { rows, invalidCount } = gpay.parse(source(broken));
    expect(rows.map((r) => r.payee)).toEqual(['C']);
    expect(invalidCount).toBe(2);
  });
});
