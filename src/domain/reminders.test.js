import { describe, it, expect } from 'vitest';
import {
  shouldFireDailyLogReminder, shouldFireMonthEndLockWarning, shouldFireNewMonthReview,
  shouldFireBackupReminder, dueReminders,
} from './reminders.js';

describe('shouldFireDailyLogReminder', () => {
  it('is due when nothing has been logged today', () => {
    const transactions = [{ date: '2026-08-06' }];
    expect(shouldFireDailyLogReminder(transactions, '2026-08-07')).toBe(true);
  });

  it('is not due once something has been logged today', () => {
    const transactions = [{ date: '2026-08-07' }];
    expect(shouldFireDailyLogReminder(transactions, '2026-08-07')).toBe(false);
  });
});

describe('shouldFireMonthEndLockWarning', () => {
  it('fires exactly 3 days before month-end (August has 31 days -> the 28th)', () => {
    expect(shouldFireMonthEndLockWarning('2026-08-28')).toBe(true);
  });

  it('does not fire on other days, including 2 or 4 days before month-end', () => {
    expect(shouldFireMonthEndLockWarning('2026-08-27')).toBe(false);
    expect(shouldFireMonthEndLockWarning('2026-08-29')).toBe(false);
  });

  it('accounts for the actual days in a shorter month (Feb 2027, 28 days -> the 25th)', () => {
    expect(shouldFireMonthEndLockWarning('2027-02-25')).toBe(true);
  });
});

describe('shouldFireNewMonthReview', () => {
  it('fires only on the 1st', () => {
    expect(shouldFireNewMonthReview('2026-08-01')).toBe(true);
    expect(shouldFireNewMonthReview('2026-08-02')).toBe(false);
  });
});

describe('shouldFireBackupReminder', () => {
  it('is due when never reminded before', () => {
    expect(shouldFireBackupReminder(null, '2026-08-07')).toBe(true);
  });

  it('is not due before the interval has elapsed', () => {
    expect(shouldFireBackupReminder('2026-08-01', '2026-08-10')).toBe(false);
  });

  it('is due once at least 14 days have elapsed', () => {
    expect(shouldFireBackupReminder('2026-08-01', '2026-08-15')).toBe(true);
  });
});

describe('dueReminders', () => {
  const baseState = {
    settingsToggles: { daily: true, monthEnd: true, backup: true, review: true },
    transactions: [],
    lastBackupReminderDate: null,
  };

  it('skips a reminder whose toggle is off even if it would otherwise be due', () => {
    const state = { ...baseState, settingsToggles: { ...baseState.settingsToggles, daily: false } };
    const due = dueReminders(state, '2026-08-07');
    expect(due.find((r) => r.key === 'daily')).toBeUndefined();
  });

  it('includes only the due-and-enabled reminders, in worker order', () => {
    const due = dueReminders(baseState, '2026-08-01'); // 1st: new-month review + backup (never reminded) + daily (nothing logged)
    expect(due.map((r) => r.key)).toEqual(['daily', 'review', 'backup']);
  });

  it('returns nothing when every toggle is off', () => {
    const state = { ...baseState, settingsToggles: { daily: false, monthEnd: false, backup: false, review: false } };
    expect(dueReminders(state, '2026-08-01')).toEqual([]);
  });
});
