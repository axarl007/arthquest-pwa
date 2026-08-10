import { useState } from 'react';
import { useStore } from '../../store/useStore.js';
import { useTheme } from '../../theme/useTheme.js';
import { createQuest } from '../../domain/quests.js';
import { todayIso } from '../../domain/format.js';
import { BottomSheet } from './BottomSheet.jsx';

/**
 * Quests have no icon picker (mirrors QuestFormSheet.kt — every Quest uses the fixed 'flag'
 * icon), and a target date, if set, can't be in the past (mirrors QuestFormSheet's minDate).
 * `initialName` lets AddCategorySheet's "Quest" branch hand off the name the user already typed
 * there rather than losing it.
 */
export function NewQuestSheet({ initialName = '', onClose }) {
  const { state, setState } = useStore();
  const { T, C, theme } = useTheme();

  const [name, setName] = useState(initialName);
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const targetAmountValue = Number(targetAmount || '0');
  const canCreate = name.trim().length > 0 && targetAmountValue > 0;

  const create = () => {
    if (!canCreate) return;
    const quest = createQuest(name.trim(), 'flag', targetAmountValue, targetDate || null, state.categories, state.incomeCategories);
    setState((s) => ({ categories: [...s.categories, quest] }));
    onClose();
  };

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: T.text }}>New quest</div>
      <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 4 }}>
        Created under Savings — the more you add, the better.
      </div>

      <input
        type="text"
        placeholder="Quest name (e.g. Goa Trip)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: '100%', background: T.inputBg, border: 'none', borderRadius: 12, padding: 13, fontSize: 14, color: T.text, marginTop: 14, outline: 'none' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.inputBg, borderRadius: 12, padding: 13, marginTop: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.textTertiary }}>₹</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Target amount"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value.replace(/[^0-9]/g, ''))}
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: T.text }}
        />
      </div>

      {/* Unlike name/amount, this field's placeholder alone ("mm/dd/yyyy") doesn't read as
          optional — an empty required-looking date box looked broken/unfinished. A visible label
          makes the optionality explicit instead of relying on the reader to infer it. */}
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textTertiary, textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: 10, marginBottom: 6 }}>
        Target date (optional)
      </div>
      <input
        type="date"
        min={todayIso()}
        value={targetDate}
        onChange={(e) => setTargetDate(e.target.value)}
        // colorScheme follows the app's theme — see LogTransactionSheet's date input for why.
        style={{ width: '100%', background: T.inputBg, border: 'none', borderRadius: 12, padding: 13, fontSize: 13, color: T.text, outline: 'none', colorScheme: theme === 'vibrant' ? 'light' : 'dark' }}
      />

      <button
        type="button"
        onClick={create}
        disabled={!canCreate}
        style={{
          width: '100%', padding: 15, borderRadius: 100, border: 'none',
          background: canCreate ? C.quest : T.disabledBg,
          color: canCreate ? 'oklch(0.14 0.02 265)' : T.disabledText,
          fontSize: 15, fontWeight: 700, cursor: canCreate ? 'pointer' : 'default', marginTop: 16,
        }}
      >
        Create Quest
      </button>
    </BottomSheet>
  );
}
