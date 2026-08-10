import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { useTheme } from '../theme/useTheme.js';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { CategoryIcon } from '../components/CategoryIcon.jsx';
import { MonthSelector } from '../components/MonthSelector.jsx';
import { EmptyStateBody } from './EmptyStateBody.jsx';
import { buildBudgetRows, matchesBudgetFilter, sortBudgetRows, isLockedMonth } from '../domain/budget.js';
import { ensureMonthSeeded } from '../domain/allocations.js';
import { GROUPS_ORDER, GROUP_LABELS } from '../domain/categories.js';
import { formatINR, currentMonthKey, addMonthsToKey } from '../domain/format.js';

const FILTER_DEFS = [
  { key: 'all', label: 'All' },
  { key: 'over', label: 'Over budget' },
  { key: 'under', label: 'Underused' },
  { key: 'unused', label: 'Not used' },
];

function statusLabel(row) {
  if (row.percentUsed !== null) return `${Math.round(row.percentUsed)}% used`;
  return row.isNotUsed ? 'Not used' : 'No budget allocated';
}

export function Budget({ onOpenActions, onSelectCategory }) {
  const { state, setState } = useStore();
  const { T, C, iconStyle } = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('desc');
  const [monthOffset, setMonthOffset] = useState(0);

  const realCurrentMonthKey = currentMonthKey();
  const monthKey = addMonthsToKey(realCurrentMonthKey, monthOffset);
  const locked = isLockedMonth(monthKey, realCurrentMonthKey);

  // Mirrors BudgetViewModel's init{} seeding only the real current month (not whatever month is
  // being navigated to) — carries the previous month's plan forward once per real-world month
  // rollover, matching BudgetAllocationRepository.ensureMonthSeeded exactly.
  useEffect(() => {
    const seeded = ensureMonthSeeded(state.budgetAllocations, realCurrentMonthKey);
    if (seeded !== state.budgetAllocations) setState({ budgetAllocations: seeded });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realCurrentMonthKey]);

  const allRows = buildBudgetRows(state.categories, state.budgetAllocations, state.transactions, monthKey);
  const query = search.trim().toLowerCase();
  const visibleRows = allRows.filter((r) => r.name.toLowerCase().includes(query) && matchesBudgetFilter(r, filter));

  // Groups render in the Android app's fixed enum order (Needs/Wants/Savings) — only the rows
  // within a group respond to the sort toggle, matching how CategoryGroup.entries drives
  // BudgetScreen.kt's LazyColumn (there's no "sort whole groups by ratio" concept on the Android
  // side to port).
  const groups = GROUPS_ORDER
    .map((g) => {
      const rows = sortBudgetRows(visibleRows.filter((r) => r.group === g), sort);
      const spentTotal = rows.reduce((sum, r) => sum + r.spent, 0);
      const allocatedTotal = rows.reduce((sum, r) => sum + r.allocated, 0);
      return { key: g, label: GROUP_LABELS[g], rows, spentTotal, allocatedTotal };
    })
    .filter((g) => g.rows.length > 0);

  if (allRows.length === 0) {
    return (
      <>
        <ScreenHeader title="Budget" action={{ icon: 'add', label: 'Budget actions', onClick: onOpenActions }} />
        <EmptyStateBody
          title="No budget yet"
          body="Once you set up your income split, your budget categories and spend will show up here."
        />
      </>
    );
  }

  return (
    <>
      <ScreenHeader title="Budget" action={{ icon: 'add', label: 'Budget actions', onClick: onOpenActions }} />
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 20px 110px', display: 'flex', flexDirection: 'column' }}>
        <MonthSelector monthKey={monthKey} onPrev={() => setMonthOffset((o) => o - 1)} onNext={() => setMonthOffset((o) => o + 1)} />

        {locked && (
          <div style={{ display: 'flex', gap: 10, background: T.lockedBanner, borderRadius: 14, padding: '12px 14px', marginTop: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: T.textSecondary, flexShrink: 0 }}>lock</span>
            <div style={{ fontSize: 12.5, color: T.textSecondary, lineHeight: 1.4 }}>
              This month&rsquo;s budget plan is locked — you can still edit transactions, just not the plan.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8, background: T.inputBg, borderRadius: 12, padding: '10px 12px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.textTertiary }}>search</span>
          <input
            type="text"
            placeholder="Search budget categories"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13.5, color: T.text }}
          />
        </div>

        {/* flexShrink: 0 is load-bearing, not decorative — this row's parent is a column flex
            container whose content overflows its available height (that's the point, it's the
            scroll region). overflowX: 'auto' forces overflowY to compute as 'auto' too (CSS
            Overflow spec), and a flex item with non-visible overflow gets an automatic minimum
            size of 0 instead of its content size — so without flexShrink: 0, this was the only
            child flexbox was "allowed" to shrink to fill the deficit, and it collapsed to 0px,
            silently hiding and disabling every filter chip. This was a real, pre-existing bug
            (not new to this change) and very likely the actual cause behind "filters are
            missing" — worse than just visually wrong, the chips were unclickable too. */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', flexShrink: 0 }}>
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
                  fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSort((s) => (s === 'desc' ? 'asc' : 'desc'))}
            style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 100, border: `1px solid ${T.border}`, background: 'none', color: T.textSecondary, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', marginLeft: 'auto' }}
          >
            % used {sort === 'desc' ? '↓' : '↑'}
          </button>
        </div>

        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', fontSize: 13, color: T.textTertiary }}>
            No categories match this search or filter.
          </div>
        ) : (
          groups.map((grp) => (
            <div key={grp.key} style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 700, color: T.text }}>{grp.label}</span>
                <span style={{ fontSize: 12.5, color: T.textTertiary }}>
                  {formatINR(grp.spentTotal)} of {formatINR(grp.allocatedTotal)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {grp.rows.map((row) => {
                  const statusColor = row.colorState === 'red' ? C.danger : row.colorState === 'yellow' ? C.warn : C.safe;
                  return (
                    <div
                      key={row.categoryId}
                      onClick={() => onSelectCategory(row.categoryId, monthKey)}
                      style={{ background: T.card, border: T.cardBorder, borderRadius: 16, padding: '14px 16px', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <CategoryIcon icon={row.icon} color={row.color} iconStyle={iconStyle} size={30} radius={9} glyphBase={15} />
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.text }}>
                          {row.name}
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: statusColor, flexShrink: 0 }}>{statusLabel(row)}</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 4, background: T.trackBg, marginTop: 11, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 4, width: `${row.progressFraction * 100}%`, background: statusColor }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 12, color: T.textTertiary }}>
                        <span>{formatINR(row.spent)} spent</span>
                        <span>{formatINR(row.allocated)} planned</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
