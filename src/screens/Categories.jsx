import { useState } from 'react';
import { useStore } from '../store/useStore.js';
import { useTheme } from '../theme/useTheme.js';
import { SubscreenHeader } from '../components/ScreenHeader.jsx';
import { CategoryIcon } from '../components/CategoryIcon.jsx';
import { Fab } from '../components/Fab.jsx';
import { GROUPS_ORDER, GROUP_LABELS, toggleArchived } from '../domain/categories.js';

const TABS = [
  { key: 'expense', label: 'Expense / Quest' },
  { key: 'income', label: 'Income' },
];

export function Categories({ onBack, onOpenAddCategory }) {
  const { state, setState } = useStore();
  const { T, C, iconStyle } = useTheme();
  const [tab, setTab] = useState('expense');

  const handleToggleArchived = (categoryId) => {
    setState((s) => ({ categories: toggleArchived(s.categories, categoryId) }));
  };

  // Quests merge into the Savings group's list too, display-side only — matching the design
  // spec's own savingsGrp.items.push(...) pattern (a Quest is a category row same as a budget
  // category, just never archivable).
  const groups = GROUPS_ORDER
    .map((g) => {
      const budgetItems = state.categories.filter((c) => c.type === 'budget' && c.group === g);
      const questItems = g === 'savings' ? state.categories.filter((c) => c.type === 'quest') : [];
      const items = [...budgetItems, ...questItems].sort((a, b) => a.name.localeCompare(b.name));
      return { key: g, label: GROUP_LABELS[g], items };
    })
    .filter((g) => g.items.length > 0);

  const incomeItems = [...state.incomeCategories].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <SubscreenHeader title="Categories" onBack={onBack} />
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 20px 110px' }}>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1, padding: 10, borderRadius: 100, border: 'none',
                  background: active ? C.accent : T.btnSecondaryBg, color: active ? T.onAccentText : T.textSecondary,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'expense' && groups.map((grp) => (
          <div key={grp.key} style={{ marginTop: 20 }}>
            <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 10 }}>
              {grp.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grp.items.map((cat) => {
                const canArchive = cat.type === 'budget';
                const typeLabel = cat.type === 'quest' ? 'Quest' : 'Budget category';
                return (
                  <div
                    key={cat.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, background: T.card, border: T.cardBorder,
                      borderRadius: 14, padding: '10px 12px', opacity: cat.archived ? 0.5 : 1,
                    }}
                  >
                    <CategoryIcon icon={cat.icon} color={cat.color} iconStyle={iconStyle} size={32} radius={10} glyphBase={15} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.text }}>
                        {cat.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.textTertiary }}>{typeLabel}</div>
                    </div>
                    {canArchive && (
                      <button
                        type="button"
                        onClick={() => handleToggleArchived(cat.id)}
                        style={{
                          flexShrink: 0, fontSize: 12, fontWeight: 600, border: `1px solid ${T.border}`,
                          borderRadius: 100, padding: '6px 12px', background: 'none', color: T.textSecondary, cursor: 'pointer',
                        }}
                      >
                        {cat.archived ? 'Unarchive' : 'Archive'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {tab === 'income' && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {incomeItems.map((cat) => (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: T.card, border: T.cardBorder, borderRadius: 14, padding: '10px 12px' }}>
                <CategoryIcon icon={cat.icon} color={cat.color} iconStyle={iconStyle} size={32} radius={10} glyphBase={15} />
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{cat.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Fab onClick={() => onOpenAddCategory(tab === 'income' ? 'income' : 'budget')} bottom={26} />
    </>
  );
}
