import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { useTheme } from '../theme/useTheme.js';
import { SubscreenHeader } from '../components/ScreenHeader.jsx';
import { CategoryIcon } from '../components/CategoryIcon.jsx';
import { CategoryPickerSheet } from '../components/sheets/CategoryPickerSheet.jsx';
import { categoryOptionsForType } from '../domain/categoryOptions.js';
import { makeId } from '../domain/categories.js';
import { formatINR, shortDate } from '../domain/format.js';
import {
  prepareReview,
  groupRowsByPayee,
  unassignedRowIds,
  buildImportTransactions,
  applyImportedTransactions,
} from '../domain/statementImport.js';
import { prefillAssignments, learnPayeeCategories } from '../domain/payeeMemory.js';

const TYPE_DEFS = [
  { key: 'expense', label: 'Expense' },
  { key: 'quest_contribution', label: 'Quest' },
  { key: 'income', label: 'Income' },
];

/** The one {type, categoryId} every included row of `group` shares, or null when they differ. */
function uniformAssignment(group, assignments) {
  const included = group.rows.map((r) => assignments[r.externalId]).filter((a) => !a.skip);
  if (included.length === 0) return null;
  const [first] = included;
  return included.every((a) => a.type === first.type && a.categoryId === first.categoryId) ? first : null;
}

function uniformType(group, assignments) {
  const included = group.rows.map((r) => assignments[r.externalId]).filter((a) => !a.skip);
  if (included.length === 0) return null;
  return included.every((a) => a.type === included[0].type) ? included[0].type : null;
}

/**
 * Statement import review (ticket #36): parsed rows grouped by payee, one type+category picker
 * per group with per-row overrides, and a sticky submit footer that stays disabled until every
 * included row has a category. `draft` is the parseStatement() result.
 */
export function ImportReview({ draft, onBack, onImported }) {
  const { state, setState } = useStore();
  const { T, C, iconStyle } = useTheme();

  // Computed once on open: rows already imported (non-deleted externalId match) are hidden.
  const [{ rows, alreadyImportedCount }] = useState(() => prepareReview(draft.rows, state.transactions));
  const groups = useMemo(() => groupRowsByPayee(rows), [rows]);
  // Prefilled from learned payee memory (#37); `prefilled` is kept to label groups still showing
  // a remembered choice, so the user knows which ones they haven't actually looked at.
  const [prefilled] = useState(() => prefillAssignments(rows, state.payeeCategoryMap, state));
  const [assignments, setAssignments] = useState(prefilled);
  const [expanded, setExpanded] = useState(() => new Set());
  // null | { groupKey } | { rowId } — which picker sheet is open.
  const [picker, setPicker] = useState(null);

  const unassigned = unassignedRowIds(rows, assignments, state);
  const includedRows = rows.filter((r) => !assignments[r.externalId].skip);
  const includedTotal = includedRows.reduce((sum, r) => sum + r.amount, 0);
  const canSubmit = includedRows.length > 0 && unassigned.length === 0;

  const updateRows = (ids, update) => {
    setAssignments((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = { ...prev[id], ...update(prev[id]) };
      return next;
    });
  };
  const includedIdsOf = (group) => group.rows.map((r) => r.externalId).filter((id) => !assignments[id].skip);

  const toggleExpanded = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const jumpToFirstUnassigned = () => {
    const firstId = unassigned[0];
    const group = groups.find((g) => g.rows.some((r) => r.externalId === firstId));
    if (!group) return;
    // A mixed group's offending row is only reachable from its expanded row list.
    if (!uniformAssignment(group, assignments)) setExpanded((prev) => new Set(prev).add(group.key));
    requestAnimationFrame(() => {
      document.querySelector(`[data-import-group="${CSS.escape(group.key)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const submit = () => {
    if (!canSubmit) return;
    const now = Date.now();
    const imported = buildImportTransactions(rows, assignments, { now, makeId });
    setState((s) => ({
      ...applyImportedTransactions(s, imported),
      payeeCategoryMap: learnPayeeCategories(s.payeeCategoryMap ?? {}, rows, assignments, now),
    }));
    onImported(imported);
  };

  const optionById = (type, id) => categoryOptionsForType(type, state).find((o) => o.id === id) ?? null;

  const typeToggle = (value, onChange, size = 'md') => (
    <div style={{ display: 'flex', gap: 4, background: T.inputBg, borderRadius: 100, padding: 3 }}>
      {TYPE_DEFS.map((opt) => {
        const active = value === opt.key;
        const activeBg = opt.key === 'income' ? C.income : opt.key === 'expense' ? C.expense : C.quest;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.key)}
            style={{
              flex: 1, padding: size === 'sm' ? '5px 2px' : '7px 4px', borderRadius: 100, border: 'none',
              background: active ? activeBg : 'none', color: active ? T.onAccentText : T.textSecondary,
              fontSize: size === 'sm' ? 11 : 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  const categoryButton = (type, categoryId, onClick, { disabledLabel, placeholder } = {}) => {
    const selected = type && categoryId ? optionById(type, categoryId) : null;
    const disabled = Boolean(disabledLabel);
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: T.inputBg, borderRadius: 12, padding: '10px 12px',
          cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
          border: !disabled && !selected && !placeholder ? `1px dashed ${C.warn}` : '1px solid transparent',
        }}
      >
        {selected ? (
          <>
            <CategoryIcon icon={selected.icon} color={selected.color} iconStyle={iconStyle} size={24} glyphBase={13} />
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: T.text }}>{selected.name}</span>
          </>
        ) : (
          <span style={{ flex: 1, fontSize: 13.5, color: disabled || placeholder ? T.textTertiary : C.warn }}>{disabledLabel ?? placeholder ?? 'Choose a category'}</span>
        )}
        {!disabled && <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.textTertiary }}>expand_more</span>}
      </button>
    );
  };

  const pickerGroup = picker?.groupKey ? groups.find((g) => g.key === picker.groupKey) : null;
  const pickerType = pickerGroup ? uniformType(pickerGroup, assignments) : picker?.rowId ? assignments[picker.rowId].type : null;
  const pickerSelected = pickerGroup ? uniformAssignment(pickerGroup, assignments)?.categoryId : picker?.rowId ? assignments[picker.rowId].categoryId : null;

  const notes = [
    alreadyImportedCount > 0 && `${alreadyImportedCount} already imported, hidden`,
    draft.invalidCount > 0 && `${draft.invalidCount} row${draft.invalidCount === 1 ? '' : 's'} couldn't be read`,
  ].filter(Boolean);

  return (
    <>
      <SubscreenHeader title="Review import" onBack={onBack} />
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 20px 24px' }}>
        <div style={{ fontSize: 13, color: T.textSecondary, margin: '6px 0 4px' }}>
          {draft.format.label} statement · {rows.length} new transaction{rows.length === 1 ? '' : 's'}
        </div>
        {notes.map((n) => (
          <div key={n} style={{ fontSize: 12, color: T.textTertiary }}>{n}</div>
        ))}

        {rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 12px', color: T.textSecondary, fontSize: 14 }}>
            Nothing new to import — every transaction in this file is already in ArthQuest.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          {groups.map((group) => {
            const groupType = uniformType(group, assignments);
            const groupAssignment = uniformAssignment(group, assignments);
            const isOpen = expanded.has(group.key);
            const allSkipped = includedIdsOf(group).length === 0;
            const remembered = groupAssignment?.categoryId != null && group.rows.every((r) => {
              const a = assignments[r.externalId];
              const p = prefilled[r.externalId];
              return a.skip || (p.categoryId === a.categoryId && p.type === a.type);
            });
            return (
              <div key={group.key} data-import-group={group.key} style={{ background: T.card, border: T.cardBorder, borderRadius: 16, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {group.payee}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: group.direction === 'credit' ? C.income : T.textSecondary, flexShrink: 0 }}>
                    {group.rows.length > 1 ? `×${group.rows.length} · ` : ''}{group.direction === 'credit' ? '+' : ''}{formatINR(group.total)}
                  </div>
                </div>

                {remembered && !allSkipped && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: T.textTertiary, marginTop: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>history</span>
                    Remembered from a previous import
                  </div>
                )}
                {allSkipped ? (
                  <div style={{ fontSize: 12.5, color: T.textTertiary, marginTop: 10 }}>All rows skipped</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    {typeToggle(groupType, (type) => updateRows(includedIdsOf(group), () => ({ type, categoryId: null })))}
                    {categoryButton(
                      groupType,
                      groupAssignment?.categoryId ?? null,
                      () => setPicker({ groupKey: group.key }),
                      groupType
                        ? { placeholder: groupAssignment ? undefined : 'Mixed — tap to set all' }
                        : { disabledLabel: 'Mixed types — edit rows below' },
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleExpanded(group.key)}
                  style={{ background: 'none', border: 'none', color: T.textTertiary, fontSize: 12, fontWeight: 600, padding: '10px 0 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {isOpen ? 'Hide' : 'Show'} {group.rows.length === 1 ? 'row' : `${group.rows.length} rows`}
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{isOpen ? 'expand_less' : 'expand_more'}</span>
                </button>

                {isOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                    {group.rows.map((r) => {
                      const a = assignments[r.externalId];
                      return (
                        <div key={r.externalId} style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.textSecondary, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={!a.skip}
                                aria-label={`Include ${r.payee} ${shortDate(r.date)} ${formatINR(r.amount)}`}
                                onChange={(e) => updateRows([r.externalId], () => ({ skip: !e.target.checked }))}
                              />
                              {shortDate(r.date)} · {r.time}
                            </label>
                            <div style={{ flex: 1 }} />
                            <div style={{ fontSize: 13, fontWeight: 700, color: a.skip ? T.textTertiary : T.text, textDecoration: a.skip ? 'line-through' : 'none' }}>
                              {formatINR(r.amount)}
                            </div>
                          </div>
                          {!a.skip && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                              {typeToggle(a.type, (type) => updateRows([r.externalId], () => ({ type, categoryId: null })), 'sm')}
                              {categoryButton(a.type, a.categoryId, () => setPicker({ rowId: r.externalId }))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {rows.length > 0 && (
        <div style={{ flexShrink: 0, padding: '12px 20px calc(env(safe-area-inset-bottom, 0px) + 14px)', borderTop: `1px solid ${T.border}`, background: T.frameBg }}>
          {unassigned.length > 0 && (
            <button
              type="button"
              onClick={jumpToFirstUnassigned}
              style={{ width: '100%', background: 'none', border: 'none', color: C.warn, fontSize: 12.5, fontWeight: 700, padding: '0 0 8px', cursor: 'pointer' }}
            >
              {unassigned.length} need{unassigned.length === 1 ? 's' : ''} a category — show me
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            style={{
              width: '100%', padding: 15, borderRadius: 100, border: 'none',
              background: canSubmit ? C.accent : T.disabledBg,
              color: canSubmit ? 'oklch(0.14 0.02 265)' : T.disabledText,
              fontSize: 15, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'default',
            }}
          >
            {includedRows.length === 0 ? 'Nothing selected' : `Import ${includedRows.length} · ${formatINR(includedTotal)}`}
          </button>
        </div>
      )}

      {picker && pickerType && (
        <CategoryPickerSheet
          title={pickerGroup ? pickerGroup.payee : 'Choose a category'}
          options={categoryOptionsForType(pickerType, state)}
          selectedId={pickerSelected}
          onClose={() => setPicker(null)}
          onSelect={(categoryId) => {
            const ids = pickerGroup ? includedIdsOf(pickerGroup) : [picker.rowId];
            updateRows(ids, () => ({ categoryId }));
            setPicker(null);
          }}
        />
      )}
    </>
  );
}
