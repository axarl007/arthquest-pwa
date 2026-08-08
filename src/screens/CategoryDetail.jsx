import { useEffect } from 'react';
import { useStore } from '../store/useStore.js';
import { useTheme } from '../theme/useTheme.js';
import { SubscreenHeader } from '../components/ScreenHeader.jsx';
import { CategoryIcon } from '../components/CategoryIcon.jsx';
import { buildBudgetRows } from '../domain/budget.js';
import { GROUP_LABELS } from '../domain/categories.js';
import { transactionsInMonth, sortTransactions } from '../domain/transactions.js';
import { formatINR, dLabel, todayIso } from '../domain/format.js';

function statusLabel(row) {
  if (row.percentUsed !== null) return `${Math.round(row.percentUsed)}% used`;
  return row.isNotUsed ? 'Not used' : 'No budget allocated';
}

export function CategoryDetail({ categoryId, monthKey, onBack }) {
  const { state } = useStore();
  const { T, C, iconStyle } = useTheme();

  const row = buildBudgetRows(state.categories, state.budgetAllocations, state.transactions, monthKey)
    .find((r) => r.categoryId === categoryId);

  // If the category was archived/deleted out from under this screen, bounce back to Budget —
  // deferred to an effect since calling the parent's setter mid-render (updating an ancestor's
  // state while this component renders) is unsafe.
  useEffect(() => {
    if (!row) onBack();
  }, [row, onBack]);

  if (!row) {
    return null;
  }

  const statusColor = row.colorState === 'red' ? C.danger : row.colorState === 'yellow' ? C.warn : C.safe;
  const today = todayIso();
  const categoryTx = sortTransactions(
    transactionsInMonth(state.transactions, monthKey).filter((t) => t.type === 'expense' && t.categoryId === categoryId),
    'desc',
  );

  return (
    <>
      <SubscreenHeader title={row.name} onBack={onBack} />
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 20px 110px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, background: T.card, border: T.cardBorder, borderRadius: 20, padding: 18 }}>
          <CategoryIcon icon={row.icon} color={row.color} iconStyle={iconStyle} size={52} radius={16} glyphBase={24} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: T.textTertiary }}>{GROUP_LABELS[row.group]}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: statusColor, marginTop: 2 }}>
              {formatINR(row.spent)} of {formatINR(row.allocated)} · {statusLabel(row)}
            </div>
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: T.trackBg, marginTop: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, width: `${row.progressFraction * 100}%`, background: statusColor }} />
        </div>

        <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 15, fontWeight: 700, color: T.text, margin: '22px 0 10px' }}>
          This month&rsquo;s transactions
        </div>
        {categoryTx.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {categoryTx.map((tx) => (
              <div key={tx.id} style={{ display: 'flex', gap: 12, background: T.card, border: T.cardBorder, borderRadius: 14, padding: '11px 14px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.text }}>
                    {tx.description || 'Expense'}
                  </div>
                  <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 2 }}>{dLabel(tx.date, today)}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.expense, flexShrink: 0 }}>-{formatINR(tx.amount)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: T.card, border: T.cardBorder, borderRadius: 14, padding: '18px 16px', textAlign: 'center', fontSize: 13, color: T.textTertiary }}>
            No transactions logged in this category yet.
          </div>
        )}
      </div>
    </>
  );
}
