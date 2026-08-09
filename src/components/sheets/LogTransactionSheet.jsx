import { useState } from 'react';
import { useStore } from '../../store/useStore.js';
import { useTheme } from '../../theme/useTheme.js';
import { GROUP_LABELS, makeId } from '../../domain/categories.js';
import { withRecomputedQuestStatus } from '../../domain/quests.js';
import { QUEST_COLOR } from '../../theme/tokens.js';
import { todayIso } from '../../domain/format.js';
import { BottomSheet } from './BottomSheet.jsx';
import { CategoryIcon } from '../CategoryIcon.jsx';

const TYPE_DEFS = [
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expense' },
  { key: 'quest_contribution', label: 'Quest' },
];

// Matches the design spec's picker-dropdown color rule: an income or budget category shows its
// own persisted color, but every quest option uses the same fixed quest accent (not per-quest).
function optionsForType(type, state) {
  if (type === 'income') {
    return state.incomeCategories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, tag: 'Income' }));
  }
  if (type === 'quest_contribution') {
    return state.categories
      .filter((c) => c.type === 'quest' && c.questStatus !== 'redeemed')
      .map((c) => ({ id: c.id, name: c.name, icon: c.icon || 'flag', color: QUEST_COLOR, tag: 'Quest' }));
  }
  return state.categories
    .filter((c) => c.type === 'budget' && !c.archived)
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, tag: GROUP_LABELS[c.group] }));
}

export function LogTransactionSheet({ initialType = 'expense', initialCategoryId = null, onClose }) {
  const { state, setState } = useStore();
  const { T, C, iconStyle } = useTheme();

  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');

  const options = optionsForType(type, state);
  const filteredOptions = search.trim()
    ? options.filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase()))
    : options;
  const selected = options.find((o) => o.id === categoryId) ?? null;

  const changeType = (t) => {
    setType(t);
    setCategoryId(null);
    setDropdownOpen(false);
    setSearch('');
  };

  const amountValue = Number(amount || '0');
  const saveDisabled = !amount || amountValue === 0 || !categoryId;

  const save = () => {
    if (saveDisabled) return;
    const transaction = {
      id: makeId(),
      type,
      amount: amountValue,
      date,
      createdAt: Date.now(),
      description,
      // categoryId is the one FK for both a budget-category expense and a quest contribution —
      // a Quest is a category row (type:'quest'), same as Android's TransactionEntity.categoryId.
      categoryId: type === 'income' ? null : categoryId,
      incomeCategoryId: type === 'income' ? categoryId : null,
      isRedemption: false,
      deletedAt: null,
    };
    setState((s) => {
      const transactions = [transaction, ...s.transactions];
      if (type !== 'quest_contribution') return { transactions };
      // Mirrors QuestRepository.recomputeStatus, called after every quest-contribution insert —
      // a contribution reaching the quest's target flips it to Completed right away.
      return { transactions, categories: withRecomputedQuestStatus(s.categories, categoryId, transactions) };
    });
    onClose();
  };

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: T.text }}>Add transaction</div>
        <button
          type="button"
          onClick={onClose}
          style={{ width: 30, height: 30, borderRadius: 15, border: 'none', background: T.btnSecondaryBg, color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 16, background: T.inputBg, borderRadius: 100, padding: 4 }}>
        {TYPE_DEFS.map((opt) => {
          const active = type === opt.key;
          const activeBg = opt.key === 'income' ? C.income : opt.key === 'expense' ? C.expense : C.quest;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => changeType(opt.key)}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: 100, border: 'none',
                background: active ? activeBg : 'none', color: active ? T.onAccentText : T.textSecondary,
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, margin: '20px 0' }}>
        <span style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 28, fontWeight: 700, color: T.textTertiary }}>₹</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
          style={{ width: 170, background: 'none', border: 'none', outline: 'none', fontFamily: "'Baloo 2', sans-serif", fontSize: 38, fontWeight: 700, color: T.text, textAlign: 'center' }}
        />
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textTertiary, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 6 }}>
          Category
        </div>
        <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: T.inputBg, border: 'none', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left' }}
        >
          {selected ? (
            <>
              <CategoryIcon icon={selected.icon} color={selected.color} iconStyle={iconStyle} size={28} glyphBase={16} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.text }}>{selected.name}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: T.textTertiary }}>{selected.tag}</span>
            </>
          ) : (
            <span style={{ flex: 1, fontSize: 14, color: T.textTertiary }}>Choose a category</span>
          )}
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.textTertiary }}>
            {dropdownOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {dropdownOpen && (
          <div style={{ marginTop: 8, background: T.card, border: T.cardBorder, borderRadius: 14, padding: 10 }}>
            <input
              type="text"
              placeholder="Search categories"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', background: T.inputBg, border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, color: T.text, outline: 'none' }}
            />
            <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filteredOptions.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(o.id);
                    setDropdownOpen(false);
                    setSearch('');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', borderRadius: 10, padding: '9px 8px', cursor: 'pointer', textAlign: 'left' }}
                >
                  <CategoryIcon icon={o.icon} color={o.color} iconStyle={iconStyle} size={26} glyphBase={14} />
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: T.text }}>{o.name}</span>
                  <span style={{ fontSize: 11, color: T.textTertiary }}>{o.tag}</span>
                </button>
              ))}
              {filteredOptions.length === 0 && (
                <div style={{ textAlign: 'center', padding: 14, fontSize: 13, color: T.textTertiary }}>No matches</div>
              )}
            </div>
          </div>
        )}
      </div>

      <input
        type="date"
        max={todayIso()}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{ width: '100%', background: T.inputBg, border: 'none', borderRadius: 12, padding: 12, fontSize: 13, color: T.text, marginTop: 14, outline: 'none' }}
      />
      <input
        type="text"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ width: '100%', background: T.inputBg, border: 'none', borderRadius: 12, padding: 12, fontSize: 13.5, color: T.text, marginTop: 10, outline: 'none' }}
      />

      <button
        type="button"
        onClick={save}
        disabled={saveDisabled}
        style={{
          width: '100%', padding: 15, borderRadius: 100, border: 'none',
          background: saveDisabled ? T.disabledBg : C.accent,
          color: saveDisabled ? T.disabledText : 'oklch(0.14 0.02 265)',
          fontSize: 15, fontWeight: 700, cursor: saveDisabled ? 'default' : 'pointer', marginTop: 16,
        }}
      >
        Save transaction
      </button>
    </BottomSheet>
  );
}
