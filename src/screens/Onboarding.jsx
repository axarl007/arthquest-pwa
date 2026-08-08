import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { useTheme } from '../theme/useTheme.js';
import { seedDefaultsIfNeeded, GROUPS_ORDER, GROUP_LABELS } from '../domain/categories.js';
import {
  buildOnboardingRows, allocationTotals, saveAllocations, sanitizePercentageInput, parsePercentageInput,
} from '../domain/allocations.js';
import { formatINR, groupIndianDigits, currentMonthKey } from '../domain/format.js';
import { halfUpRound } from '../domain/money.js';
import { Fab } from '../components/Fab.jsx';
import { CategoryIcon } from '../components/CategoryIcon.jsx';

/**
 * Tap-to-edit percentage field: the +/- buttons alongside it stay integer-step-1, but a bigger
 * salary can make even 1% a large rupee swing, so this lets a fractional split (e.g. 4.5%) be
 * typed directly. Keeps its own draft string while focused (re-synced from `value` whenever it
 * changes from outside, e.g. the +/- steppers) so a mid-typed "4." isn't immediately snapped
 * back to "4" by a controlled-value round-trip — the typed text only commits to a real number
 * (sanitized, clamped >=0) onBlur/Enter. Every other numeric field in this codebase (income
 * above, transaction/quest amount inputs) commits on every keystroke instead; this is the first
 * free-type-then-commit input, needed here specifically because a decimal point mid-entry has
 * nowhere to "go" in a same-keystroke-commit model without snapping back.
 */
function PercentageInput({ value, onChange }) {
  const { T } = useTheme();
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const parsed = parsePercentageInput(draft);
    setDraft(String(parsed));
    if (parsed !== value) onChange(parsed);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', width: 52, justifyContent: 'center' }}>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(sanitizePercentageInput(e.target.value))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        style={{
          // Sized for the worst case now that sanitizePercentageInput/parsePercentageInput cap
          // fractional precision at 2dp: "100.00" (6 chars) at this font/weight.
          width: 40, background: 'none', border: 'none', outline: 'none', padding: 0,
          fontSize: 13, fontWeight: 700, textAlign: 'center', color: T.text,
        }}
      />
      <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>%</span>
    </div>
  );
}

export function Onboarding({ onFinish, onOpenAddCategory }) {
  const { state, setState } = useStore();
  const { T, C, iconStyle } = useTheme();
  const monthKey = useMemo(() => currentMonthKey(), []);

  const [rows, setRows] = useState(null);
  const [incomeInput, setIncomeInput] = useState('');

  // Seed default categories (if none exist yet) and load this month's onboarding rows once, on
  // mount — mirrors OnboardingViewModel's init{} (seedDefaultsIfNeeded then loadRows), done
  // synchronously since there's no async DB round-trip here.
  useEffect(() => {
    const patch = seedDefaultsIfNeeded(state);
    if (Object.keys(patch).length > 0) setState(patch);
    const categories = patch.categories ?? state.categories;
    setRows(buildOnboardingRows(categories, state.budgetAllocations, monthKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (rows === null) return null;

  const income = Number(incomeInput.replace(/[^0-9]/g, '') || '0');
  const { allocatedPercentage, remainingPercentage, isOverAllocated } = allocationTotals(rows);
  const canFinish = income > 0 && !isOverAllocated;

  const setIncome = (e) => {
    const digits = e.target.value.replace(/[^0-9]/g, '');
    setIncomeInput(groupIndianDigits(digits));
  };

  const adjustPercentage = (categoryId, delta) => {
    // Half-up rounded to 2dp: r.percentage can now be fractional (typed via PercentageInput),
    // and raw float addition/subtraction on a fractional base drifts (e.g. 1.2 - 1 ===
    // 0.19999999999999996 in IEEE-754) — round on every mutation, not just on manual entry.
    setRows((rs) => rs.map((r) => (r.categoryId === categoryId ? { ...r, percentage: halfUpRound(Math.max(0, r.percentage + delta), 2) } : r)));
  };

  const setPercentage = (categoryId, value) => {
    setRows((rs) => rs.map((r) => (r.categoryId === categoryId ? { ...r, percentage: value } : r)));
  };

  const finish = () => {
    if (!canFinish) return;
    const newAllocations = saveAllocations(income, rows, monthKey);
    setState((s) => ({
      budgetAllocations: [...s.budgetAllocations.filter((a) => a.month !== monthKey), ...newAllocations],
      onboarded: true,
    }));
    onFinish();
  };

  const groups = GROUPS_ORDER
    .map((g) => {
      const categories = rows.filter((r) => r.group === g);
      const groupPct = halfUpRound(categories.reduce((a, r) => a + r.percentage, 0), 2);
      return { key: g, label: GROUP_LABELS[g], categories, pctStr: `${groupPct}%`, amountStr: formatINR((income * groupPct) / 100) };
    })
    .filter((g) => g.categories.length > 0);

  const allocBannerColor = isOverAllocated ? C.danger : allocatedPercentage === 100 ? C.safe : C.accent;
  const allocBannerBg = isOverAllocated ? 'oklch(0.28 0.06 25)' : T.card;

  return (
    <>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 22px) 20px 2px', flexShrink: 0 }}>
        <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 800, lineHeight: 1.2, color: T.text }}>
          Let&rsquo;s plan your money
        </div>
        <div style={{ color: T.textSecondary, fontSize: 13.5, marginTop: 6, lineHeight: 1.45 }}>
          Enter your monthly income — we&rsquo;ll suggest a 50/30/20 split. Tune anything below.
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '6px 20px 110px' }}>
        <div style={{ marginTop: 8, background: T.card, border: T.cardBorder, borderRadius: 20, padding: 18 }}>
          <div style={{ fontSize: 12, color: T.textTertiary, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            Monthly income
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
            <span style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 700, color: C.accent }}>₹</span>
            <input
              type="text"
              inputMode="numeric"
              value={incomeInput}
              onChange={setIncome}
              placeholder="0"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontFamily: "'Baloo 2', sans-serif", fontSize: 30, fontWeight: 700, color: T.text,
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 16, background: allocBannerBg, borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: allocBannerColor, whiteSpace: 'nowrap' }}>
              {allocatedPercentage}% allocated
            </span>
            <span style={{ fontSize: 13, color: allocBannerColor, whiteSpace: 'nowrap', textAlign: 'right' }}>
              {isOverAllocated
                ? `${formatINR((-remainingPercentage * income) / 100)} over`
                : `${formatINR((remainingPercentage * income) / 100)} remaining`}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: T.trackBg, marginTop: 10, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%', borderRadius: 4,
                width: `${Math.min(allocatedPercentage, 100)}%`, background: allocBannerColor,
              }}
            />
          </div>
          {isOverAllocated && (
            <div style={{ fontSize: 12, color: 'oklch(0.75 0.16 25)', marginTop: 8 }}>
              You&rsquo;ve allocated more than your income — trim something below before saving.
            </div>
          )}
        </div>

        {groups.map((grp) => (
          <div key={grp.key} style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 700, color: T.text }}>{grp.label}</span>
              <span style={{ fontSize: 13, color: T.textSecondary }}>{grp.pctStr} · {grp.amountStr}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grp.categories.map((cat) => {
                return (
                  <div
                    key={cat.categoryId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, background: T.card,
                      border: T.cardBorder, borderRadius: 14, padding: '10px 12px',
                    }}
                  >
                    <CategoryIcon icon={cat.icon} color={cat.color} iconStyle={iconStyle} size={34} radius={10} glyphBase={16} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.text }}>
                        {cat.name}
                      </div>
                      <div style={{ fontSize: 12, color: T.textTertiary }}>{formatINR((income * cat.percentage) / 100)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => adjustPercentage(cat.categoryId, -1)}
                      style={{ width: 26, height: 26, borderRadius: 13, border: `1px solid ${T.border}`, background: 'none', color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>remove</span>
                    </button>
                    <PercentageInput value={cat.percentage} onChange={(v) => setPercentage(cat.categoryId, v)} />
                    <button
                      type="button"
                      onClick={() => adjustPercentage(cat.categoryId, 1)}
                      style={{ width: 26, height: 26, borderRadius: 13, border: `1px solid ${T.border}`, background: 'none', color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={finish}
          disabled={!canFinish}
          style={{
            width: '100%', marginTop: 24, padding: 16, borderRadius: 100, border: 'none',
            background: canFinish ? C.accent : T.disabledBg,
            color: canFinish ? 'oklch(0.14 0.02 265)' : T.disabledText,
            fontSize: 16, fontWeight: 700, cursor: canFinish ? 'pointer' : 'default',
          }}
        >
          Get started
        </button>
      </div>

      <Fab onClick={onOpenAddCategory} bottom={26} />
    </>
  );
}
