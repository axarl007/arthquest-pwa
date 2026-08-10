import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { useTheme } from '../theme/useTheme.js';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { MonthSelector } from '../components/MonthSelector.jsx';
import { questRows } from '../domain/quests.js';
import { monthlyTotals, cumulativePosition } from '../domain/transactions.js';
import { nearLimitCategories } from '../domain/budget.js';
import { formatINR, currentMonthKey, addMonthsToKey } from '../domain/format.js';
import { pendingChangeCount, formatSyncedLabel, shouldNudgeStaleSync } from '../domain/sync.js';

// Mirrors HomeViewModel's activeQuests: ACTIVE or COMPLETED quests (never REDEEMED — those have
// nothing left to track on Home).
const HOME_QUEST_STATUSES = ['active', 'completed'];

// How often the sync indicator's "Xm/Xh ago" text re-renders on its own — the value itself
// (state.pairedDevice.lastSyncedAt) already updates instantly via a normal re-render whenever a
// sync actually completes; this is only for the elapsed-time display to keep counting forward
// while the user just sits on this screen without triggering any other state change.
const SYNC_LABEL_TICK_MS = 30_000;

export function Home({ onOpenSettings, onSelectQuest, onSelectCategory, onOpenPairing }) {
  const { state } = useStore();
  const { T, C } = useTheme();
  const [showCumulativeExplanation, setShowCumulativeExplanation] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [monthOffset, setMonthOffset] = useState(0);
  const isPaired = Boolean(state.pairedDevice);
  useEffect(() => {
    // No sync indicator is rendered at all when unpaired (the common case pre-pairing) — skip the
    // recurring timer/re-render/pendingChangeCount scan entirely rather than ticking a value
    // nothing on screen reads.
    if (!isPaired) return undefined;
    const id = setInterval(() => setNow(Date.now()), SYNC_LABEL_TICK_MS);
    return () => clearInterval(id);
  }, [isPaired]);

  const monthKey = addMonthsToKey(currentMonthKey(), monthOffset);
  const quests = questRows(state.categories, state.transactions, HOME_QUEST_STATUSES);
  const { income, expense, questContribution, net } = monthlyTotals(state.transactions, monthKey);
  const netColor = net < 0 ? C.warn : '#fff';
  const cumulative = cumulativePosition(state.transactions);
  const nearLimit = nearLimitCategories(state.categories, state.budgetAllocations, state.transactions, monthKey);
  const pending = pendingChangeCount(state);
  const nudgeStaleSync = shouldNudgeStaleSync(state, now, pending);

  return (
    <>
      <ScreenHeader title="Home" action={{ icon: 'menu', label: 'Settings', onClick: onOpenSettings }} />
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 20px 110px' }}>
        {state.pairedDevice && (
          <div
            onClick={onOpenPairing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: T.textTertiary }}>sync</span>
            <span style={{ fontSize: 12, color: T.textTertiary }}>
              {formatSyncedLabel(state.pairedDevice.lastSyncedAt, now)}
              {pending > 0 ? ` · ${pending} pending` : ''}
            </span>
          </div>
        )}

        {nudgeStaleSync && (
          <div
            onClick={onOpenPairing}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, cursor: 'pointer',
              background: T.card, border: `1px solid ${C.warn}`, borderRadius: 14, padding: '12px 14px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: C.warn, flexShrink: 0 }}>sync_problem</span>
            <span style={{ flex: 1, fontSize: 12.5, color: T.text, lineHeight: 1.4 }}>
              Open the app on {state.pairedDevice.name} to sync your latest changes.
            </span>
          </div>
        )}

        <MonthSelector monthKey={monthKey} onPrev={() => setMonthOffset((o) => o - 1)} onNext={() => setMonthOffset((o) => o + 1)} />

        <div style={{ background: T.heroGradient, borderRadius: 20, padding: 18, marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.9 0.02 265 / 0.8)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Monthly summary
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'oklch(0.9 0.02 265 / 0.75)' }}>Income</div>
              <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 3 }}>{formatINR(income)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'oklch(0.9 0.02 265 / 0.75)' }}>Expenses</div>
              <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 3 }}>{formatINR(expense)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'oklch(0.9 0.02 265 / 0.75)' }}>Saved (Quests)</div>
              <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 3 }}>{formatINR(questContribution)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'oklch(0.9 0.02 265 / 0.75)' }}>Net leftover</div>
              <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 24, fontWeight: 800, color: netColor, marginTop: 3 }}>
                {net < 0 ? '-' : ''}{formatINR(Math.abs(net))}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{ marginTop: 10, background: T.card, border: T.cardBorder, borderRadius: 14, padding: '12px 14px', cursor: 'pointer' }}
          onClick={() => setShowCumulativeExplanation((v) => !v)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.textTertiary, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Cumulative position
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: T.textTertiary }}>info</span>
          </div>
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: T.text, marginTop: 4 }}>
            {cumulative < 0 ? '-' : ''}{formatINR(Math.abs(cumulative))}
          </div>
          {showCumulativeExplanation && (
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 8, lineHeight: 1.4 }}>
              All-time income minus all-time expenses (including anything redeemed from a quest) —
              not a running balance you hold anywhere, just how you've net come out overall.
            </div>
          )}
        </div>

        {quests.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 10 }}>
              Your quests
            </div>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
              {quests.map(({ quest, contributed, progressFraction }) => {
                const deg = progressFraction * 360;
                return (
                  <div
                    key={quest.id}
                    onClick={() => onSelectQuest(quest.id)}
                    style={{
                      flexShrink: 0, width: 132, background: T.card, border: T.cardBorder, borderRadius: 16,
                      padding: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
                    }}
                  >
                    <div style={{ width: 52, height: 52, borderRadius: 26, background: `conic-gradient(${C.quest} ${deg}deg, ${T.trackBg} ${deg}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 20, background: T.card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{Math.round(progressFraction * 100)}%</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, marginTop: 8, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {quest.name}
                    </div>
                    <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2, textAlign: 'center' }}>
                      {formatINR(contributed)} of {formatINR(quest.questTargetAmount)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {nearLimit.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 10 }}>
              Close to your limit
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {nearLimit.map((row) => {
                const statusColor = row.colorState === 'red' ? C.danger : C.warn;
                return (
                  <div
                    key={row.categoryId}
                    onClick={() => onSelectCategory(row.categoryId, monthKey)}
                    style={{ background: T.card, border: T.cardBorder, borderRadius: 14, padding: '11px 14px', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.name}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: statusColor, flexShrink: 0 }}>
                        {row.percentUsed !== null ? `${Math.round(row.percentUsed)}% used` : 'Over budget'}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: T.trackBg, marginTop: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${row.progressFraction * 100}%`, background: statusColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
