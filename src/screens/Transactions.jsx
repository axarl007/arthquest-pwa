import { useState } from 'react';
import { useStore } from '../store/useStore.js';
import { useTheme } from '../theme/useTheme.js';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { MonthSelector } from '../components/MonthSelector.jsx';
import { EmptyStateBody } from './EmptyStateBody.jsx';
import {
  monthlyTotals, transactionsInMonth, filterByType, sortTransactions, groupByDateLabel, resolveTransactionSubject,
} from '../domain/transactions.js';
import { formatINR, currentMonthKey, addMonthsToKey, todayIso } from '../domain/format.js';
import { CategoryIcon } from '../components/CategoryIcon.jsx';

const FILTER_DEFS = [
  { key: 'all', label: 'All' },
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expense' },
  { key: 'quest_contribution', label: 'Quest' },
];

export function Transactions({ onSelectTx }) {
  const { state } = useStore();
  const { T, C, iconStyle } = useTheme();
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('desc');
  const [monthOffset, setMonthOffset] = useState(0);

  const monthKey = addMonthsToKey(currentMonthKey(), monthOffset);
  const today = todayIso();
  const { income, expense, net } = monthlyTotals(state.transactions, monthKey);
  const netColor = net < 0 ? C.warn : T.text;

  const monthTx = transactionsInMonth(state.transactions, monthKey);
  const filtered = filterByType(monthTx, filter);
  const sorted = sortTransactions(filtered, sort);
  const groups = groupByDateLabel(sorted, today);

  return (
    <>
      <ScreenHeader title="Transactions" />
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 20px 110px', display: 'flex', flexDirection: 'column' }}>
        <MonthSelector monthKey={monthKey} onPrev={() => setMonthOffset((o) => o - 1)} onNext={() => setMonthOffset((o) => o + 1)} />

        <div style={{ display: 'flex', gap: 10, marginTop: 14, background: T.card, border: T.cardBorder, borderRadius: 14, padding: '12px 8px' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: T.textTertiary }}>Income</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.income, marginTop: 2 }}>{formatINR(income)}</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', borderLeft: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.textTertiary }}>Expense</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.expense, marginTop: 2 }}>{formatINR(expense)}</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: T.textTertiary }}>Net</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: netColor, marginTop: 2 }}>
              {net < 0 ? '-' : ''}{formatINR(Math.abs(net))}
            </div>
          </div>
        </div>

        {/* flexShrink: 0 is load-bearing — see Budget.jsx's identical filter row for the full
            explanation: without it, this row (the only flex child with non-visible overflow, via
            overflowX: 'auto' forcing overflowY to compute as 'auto' too) was the only one
            flexbox could shrink to absorb the column's content overflow, and it collapsed to 0px
            height, silently hiding and disabling every filter chip. */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, overflowX: 'auto', flexShrink: 0 }}>
          {FILTER_DEFS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                style={{
                  flexShrink: 0, padding: '8px 14px', borderRadius: 100,
                  border: `1px solid ${active ? C.accent : T.border}`,
                  background: active ? C.accent : 'none', color: active ? T.onAccentText : T.textSecondary,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSort((s) => (s === 'desc' ? 'asc' : 'desc'))}
            style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 100, border: `1px solid ${T.border}`, background: 'none', color: T.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}
          >
            Date {sort === 'desc' ? '↓' : '↑'}
          </button>
        </div>

        {groups.length > 0 ? (
          groups.map((grp) => (
            <div key={grp.label} style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.textTertiary, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 8 }}>
                {grp.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grp.items.map((tx) => {
                  const subject = resolveTransactionSubject(tx, state.categories, state.incomeCategories, C);
                  const amountColor = tx.type === 'income' ? C.income : tx.type === 'quest_contribution' ? C.quest : C.expense;
                  const sign = tx.type === 'income' ? '+' : '-';
                  const descOrType = tx.description || (tx.type === 'income' ? 'Income' : tx.type === 'quest_contribution' ? 'Quest contribution' : 'Expense');
                  return (
                    <div
                      key={tx.id}
                      onClick={() => onSelectTx(tx)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, background: T.card, border: T.cardBorder, borderRadius: 14, padding: '11px 14px', cursor: 'pointer' }}
                    >
                      <CategoryIcon icon={subject.icon} color={subject.color} iconStyle={iconStyle} size={38} radius={19} glyphBase={17} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.text }}>
                          {subject.name}
                        </div>
                        <div style={{ fontSize: 12, color: T.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {descOrType}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: amountColor, flexShrink: 0 }}>
                        {sign}{formatINR(tx.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <EmptyStateBody title="No transactions this month." body="Tap + to log your first one." />
        )}
      </div>
    </>
  );
}
