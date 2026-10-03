import { useState } from 'react';
import { useStore } from '../../store/useStore.js';
import { useTheme } from '../../theme/useTheme.js';
import { GROUPS_ORDER, GROUP_LABELS, makeId } from '../../domain/categories.js';
import { catColor } from '../../theme/tokens.js';
import { ICON_OPTIONS } from '../../theme/icons.js';
import { BottomSheet } from './BottomSheet.jsx';
import { CategoryIcon } from '../CategoryIcon.jsx';

const TYPE_DEFS = [
  { key: 'budget', label: 'Budget' },
  { key: 'quest', label: 'Quest' },
];

/**
 * Shared "add a category/income source/quest-stub" sheet — opened from Budget's actions sheet,
 * the Categories screen FAB (ticket #6), and onboarding's FAB. `context` is 'budget' (default) or
 * 'income'; a budget-context save creating a Quest doesn't persist anything here — Quest creation
 * needs a target amount/date this sheet doesn't collect, so it hands off to `onRequestQuest` (opens
 * ticket #5's New Quest sheet, pre-filled with the name already typed). No icon picker for that
 * branch — mirrors QuestFormSheet.kt, where every Quest gets the same fixed 'flag' icon regardless
 * of what's chosen here, so asking the user to pick one first would be pointless friction.
 */
export function AddCategorySheet({ context = 'budget', initialGroup = 'needs', onClose, onRequestQuest }) {
  const { state, setState } = useStore();
  const { T, C, iconStyle } = useTheme();

  const [name, setName] = useState('');
  const [type, setType] = useState('budget');
  const [group, setGroup] = useState(initialGroup);
  const [icon, setIcon] = useState(null);

  const isIncome = context === 'income';
  const isQuest = !isIncome && type === 'quest';
  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && (isQuest || icon !== null);

  const noteText = isIncome
    ? "Added as an Income category — no type to pick."
    : isQuest
      ? "Goes into Savings — type can't be changed later."
      : "Type can't be changed once created.";

  const save = () => {
    if (!canSave) return;
    if (isIncome) {
      const newIncomeCategory = {
        id: makeId(), name: trimmedName, icon,
        color: catColor(state.categories.length + state.incomeCategories.length),
        createdAt: Date.now(),
      };
      setState((s) => ({ incomeCategories: [...s.incomeCategories, newIncomeCategory] }));
      onClose();
      return;
    }
    if (isQuest) {
      onRequestQuest(trimmedName);
      return;
    }
    const newCategory = {
      id: makeId(), name: trimmedName, icon, type: 'budget', group, archived: false, archivedAt: null,
      color: catColor(state.categories.length + state.incomeCategories.length),
      createdAt: Date.now(),
    };
    setState((s) => ({ categories: [...s.categories, newCategory] }));
    onClose();
  };

  return (
    <BottomSheet onClose={onClose} maxHeight="88%">
      <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: T.text }}>
        {isIncome ? 'Add income source' : 'Add category'}
      </div>

      <input
        type="text"
        placeholder={isIncome ? 'e.g. Rental income' : 'Category name'}
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: '100%', background: T.inputBg, border: 'none', borderRadius: 12, padding: 13, fontSize: 14, color: T.text, marginTop: 14, outline: 'none' }}
      />

      {!isIncome && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {TYPE_DEFS.map((t) => {
            const active = type === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                style={{
                  flex: 1, padding: 9, borderRadius: 10, border: 'none',
                  background: active ? C.accent : T.btnSecondaryBg, color: active ? T.onAccentText : T.textSecondary,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {!isIncome && type === 'budget' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {GROUPS_ORDER.map((g) => {
            const active = group === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                style={{
                  flex: 1, padding: 9, borderRadius: 10, border: 'none',
                  background: active ? C.accent : T.btnSecondaryBg, color: active ? T.onAccentText : T.textSecondary,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {GROUP_LABELS[g]}
              </button>
            );
          })}
        </div>
      )}

      {!isQuest && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {ICON_OPTIONS.map((opt) => {
            const active = icon === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setIcon(opt)}
                style={{
                  width: 40, height: 40, borderRadius: 12, cursor: 'pointer',
                  border: `2px solid ${active ? C.accent : T.border}`,
                  background: active ? 'oklch(0.3 0.06 245)' : (iconStyle === 'cartoon' ? 'transparent' : T.btnSecondaryBg),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, color: T.text,
                }}
              >
                <CategoryIcon icon={opt} iconStyle={iconStyle} glyphBase={18} bare />
              </button>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 11.5, color: T.textTertiary, marginTop: 10 }}>{noteText}</div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button
          type="button"
          onClick={onClose}
          style={{ flex: 1, padding: 14, borderRadius: 100, border: `1px solid ${T.border}`, background: 'none', color: T.textSecondary, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          style={{
            flex: 1, padding: 14, borderRadius: 100, border: 'none',
            background: canSave ? C.accent : T.disabledBg, color: canSave ? T.onAccentText : T.disabledText,
            fontSize: 14, fontWeight: 700, cursor: canSave ? 'pointer' : 'default',
          }}
        >
          Add
        </button>
      </div>
    </BottomSheet>
  );
}
