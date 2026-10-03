import { describe, it, expect } from 'vitest';
import { groupTextItemsIntoLines } from './pdfLines.js';

const item = (str, x, y, width, height = 8) => ({ str, transform: [1, 0, 0, 1, x, y], width, height });

describe('groupTextItemsIntoLines', () => {
  it('groups items by baseline (top to bottom), orders cells left to right, drops blanks', () => {
    const pages = [[
      item('₹5,920', 541, 593),
      item('01 Sep, 2026', 24, 593),
      item('', 24, 593),
      item(' ', 78, 593),
      item('Paid to Myntra', 135, 593),
      item('10:47 AM', 24, 578),
      item('UPI Transaction ID: 624470053679', 135, 578.6),
    ]];
    expect(groupTextItemsIntoLines(pages)).toEqual([
      { page: 1, cells: ['01 Sep, 2026', 'Paid to Myntra', '₹5,920'] },
      { page: 1, cells: ['10:47 AM', 'UPI Transaction ID: 624470053679'] },
    ]);
  });

  it('keeps pages in order and trims cell text', () => {
    const lines = groupTextItemsIntoLines([[item(' A ', 10, 100)], [item('B', 10, 700), item('C', 10, 50)]]);
    expect(lines).toEqual([{ page: 1, cells: ['A'] }, { page: 2, cells: ['B'] }, { page: 2, cells: ['C'] }]);
  });

  it('rejoins a word pdf.js split at a font/ligature change (touching pieces), but not separate columns', () => {
    const pages = [[
      item('Paid to Swi', 135, 500, 40),
      item('ffi', 175, 500, 8),
      item('ce Bar', 183.5, 500, 22),
      item('₹99', 541, 500, 15),
    ]];
    expect(groupTextItemsIntoLines(pages)).toEqual([{ page: 1, cells: ['Paid to Swiffice Bar', '₹99'] }]);
  });

  it('keeps the space when a touching piece ended (or the next began) with one', () => {
    const pages = [[item('Paid to ', 135, 500, 30), item('Myntra', 165, 500, 25)]];
    expect(groupTextItemsIntoLines(pages)[0].cells).toEqual(['Paid to Myntra']);
  });
});
