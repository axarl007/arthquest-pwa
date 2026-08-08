import { todayIso, parseIsoDate, daysBetween } from './format.js';

/** How many days before month-end the lock warning fires — ported from ReminderWorker.kt's
 * MONTH_END_LOCK_WARNING_LEAD_DAYS. */
export const MONTH_END_LOCK_WARNING_LEAD_DAYS = 3;

/** How often, at minimum, the backup nudge re-fires once seen — ported from
 * ReminderWorker.kt's BACKUP_REMINDER_INTERVAL_DAYS. */
export const BACKUP_REMINDER_INTERVAL_DAYS = 14;

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

/** Mirrors ReminderWorker.checkDailyLogReminder: due if nothing has been logged today yet. */
export function shouldFireDailyLogReminder(transactions, today = todayIso()) {
  return !transactions.some((t) => t.date === today);
}

/** Mirrors checkMonthEndLockWarning: due on the exact day that's MONTH_END_LOCK_WARNING_LEAD_DAYS
 * before month-end (not "within", not a range — the Kotlin source checks `!=`, i.e. one single day). */
export function shouldFireMonthEndLockWarning(today = todayIso()) {
  const { y, m, d } = parseIsoDate(today);
  const daysUntilMonthEnd = daysInMonth(y, m) - d;
  return daysUntilMonthEnd === MONTH_END_LOCK_WARNING_LEAD_DAYS;
}

/** Mirrors checkNewMonthReview: due on the 1st of the month only. */
export function shouldFireNewMonthReview(today = todayIso()) {
  return parseIsoDate(today).d === 1;
}

/** Mirrors checkBackupReminder: due if never reminded, or at least the interval has elapsed. */
export function shouldFireBackupReminder(lastBackupReminderDate, today = todayIso()) {
  if (!lastBackupReminderDate) return true;
  return daysBetween(lastBackupReminderDate, today) >= BACKUP_REMINDER_INTERVAL_DAYS;
}

/**
 * Every reminder that's both enabled (via `settingsToggles`) and due right now, in the same
 * fixed order ReminderWorker.doWork() checks them. Each entry's `key` matches a
 * `state.settingsToggles`/notification-dedup key; the caller (a best-effort foreground
 * Notification-API check on app open, since there's no push server — decision #3) is responsible
 * for actually posting notifications and, for 'backup', persisting the new lastBackupReminderDate.
 */
export function dueReminders(state, today = todayIso()) {
  const { settingsToggles, transactions, lastBackupReminderDate } = state;
  const due = [];
  if (settingsToggles.daily && shouldFireDailyLogReminder(transactions, today)) {
    due.push({
      key: 'daily',
      title: "Log today's transactions",
      body: "You haven't logged anything today — take a minute to catch up.",
    });
  }
  if (settingsToggles.monthEnd && shouldFireMonthEndLockWarning(today)) {
    due.push({
      key: 'monthEnd',
      title: 'Budget plan locks soon',
      body: `This month's budget plan locks in ${MONTH_END_LOCK_WARNING_LEAD_DAYS} days — review it while you still can.`,
    });
  }
  if (settingsToggles.review && shouldFireNewMonthReview(today)) {
    due.push({
      key: 'review',
      title: "Review this month's budget",
      body: 'A new month has started — confirm or adjust your budget plan.',
    });
  }
  if (settingsToggles.backup && shouldFireBackupReminder(lastBackupReminderDate, today)) {
    due.push({
      key: 'backup',
      title: 'Back up your data',
      body: "It's been a while — export a JSON backup so you never lose your data.",
    });
  }
  return due;
}
