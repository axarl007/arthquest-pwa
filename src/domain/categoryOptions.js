import { GROUP_LABELS } from './categories.js';
import { QUEST_COLOR } from '../theme/tokens.js';

/**
 * The selectable categories for a transaction of `type` — shared by LogTransactionSheet and the
 * statement-import review screen so both offer exactly the same set: archived budget categories
 * and redeemed quests are never offered. Matches the design spec's picker-dropdown color rule: an
 * income or budget category shows its own persisted color, but every quest option uses the same
 * fixed quest accent (not per-quest).
 */
export function categoryOptionsForType(type, state) {
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
