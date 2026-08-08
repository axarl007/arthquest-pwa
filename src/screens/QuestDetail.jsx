import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { useTheme } from '../theme/useTheme.js';
import { SubscreenHeader } from '../components/ScreenHeader.jsx';
import { questProgress, redeemQuest } from '../domain/quests.js';
import { formatINR, longDate } from '../domain/format.js';
import { GOLD_COLOR } from '../theme/tokens.js';

const CELEBRATION_DELAY_MS = 2400;
const CELEBRATION_VISIBLE_MS = 3000;

/**
 * `autoRedeem` opens the redeem-confirmation modal immediately on mount — set when arriving here
 * via the Quests list's "Redeem" pill (see Quests.jsx), which mirrors QuestsScreen.kt opening its
 * RedeemConfirmationSheet directly from the list rather than requiring a detour through detail.
 */
export function QuestDetail({ questId, autoRedeem = false, onBack, onAddContribution }) {
  const { state, setState } = useStore();
  const { T, C } = useTheme();
  const [showRedeemConfirm, setShowRedeemConfirm] = useState(autoRedeem);
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationDelayTimer = useRef(null);

  const quest = state.categories.find((c) => c.id === questId && c.type === 'quest');

  useEffect(() => {
    if (!quest) onBack();
  }, [quest, onBack]);

  useEffect(() => {
    if (!showCelebration) return undefined;
    const timer = setTimeout(() => setShowCelebration(false), CELEBRATION_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [showCelebration]);

  // Cancels the celebration-delay timer if this screen is left before it fires.
  useEffect(() => () => clearTimeout(celebrationDelayTimer.current), []);

  if (!quest) return null;

  const { contributed, progressFraction, shortfall } = questProgress(quest, state.transactions);
  const pctStr = `${Math.round(progressFraction * 100)}%`;
  // Mirrors QuestsScreen.kt: Redeem is offered on any Active quest, no minimum-contribution gate —
  // the repository's redeem() itself has none either.
  const canRedeemEarly = quest.questStatus === 'active';
  const pill = {
    active: { bg: 'oklch(0.3 0.06 245)', color: C.accent, label: 'Active' },
    completed: { bg: 'oklch(0.3 0.07 85)', color: 'oklch(0.85 0.1 85)', label: 'Completed' },
    redeemed: { bg: T.btnSecondaryBgAlt, color: T.textSecondary, label: 'Redeemed' },
  }[quest.questStatus];
  const contributions = state.transactions
    .filter((t) => t.type === 'quest_contribution' && t.categoryId === questId)
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));

  const confirmRedeem = () => {
    const { transaction, questPatch } = redeemQuest(quest, state.transactions, new Date());
    setState((s) => ({
      transactions: [transaction, ...s.transactions],
      categories: s.categories.map((c) => (c.id === questId ? { ...c, ...questPatch } : c)),
    }));
    setShowRedeemConfirm(false);
    celebrationDelayTimer.current = setTimeout(() => setShowCelebration(true), CELEBRATION_DELAY_MS);
  };

  return (
    <>
      <SubscreenHeader title={quest.name} onBack={onBack} />
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 20px 110px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 0 8px' }}>
          <div style={{ width: 150, height: 150, borderRadius: 75, background: `conic-gradient(${C.quest} ${progressFraction * 360}deg, ${T.trackBg} ${progressFraction * 360}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 122, height: 122, borderRadius: 61, background: T.frameBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 800, color: T.text }}>{pctStr}</span>
              <span style={{ fontSize: 11, color: T.textTertiary }}>funded</span>
            </div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginTop: 16 }}>
            {formatINR(contributed)} <span style={{ fontWeight: 500, color: T.textTertiary }}>of {formatINR(quest.questTargetAmount)}</span>
          </div>
          {quest.questTargetDate && (
            <div style={{ fontSize: 12.5, color: C.accent, marginTop: 4 }}>Target date: {longDate(quest.questTargetDate)}</div>
          )}
          <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 100, marginTop: 10, background: pill.bg, color: pill.color }}>
            {pill.label}
          </span>
        </div>

        {quest.questStatus === 'completed' && (
          <button
            type="button"
            onClick={() => setShowRedeemConfirm(true)}
            style={{ width: '100%', padding: 15, borderRadius: 100, border: 'none', background: GOLD_COLOR, color: 'oklch(0.2 0.03 85)', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 10 }}
          >
            Redeem {formatINR(contributed)}
          </button>
        )}

        {quest.questStatus === 'active' && (
          <>
            <button
              type="button"
              onClick={() => onAddContribution(questId)}
              style={{ width: '100%', padding: 15, borderRadius: 100, border: 'none', background: C.accent, color: 'oklch(0.14 0.02 265)', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 10 }}
            >
              Add contribution
            </button>
            {canRedeemEarly && (
              <button
                type="button"
                onClick={() => setShowRedeemConfirm(true)}
                style={{ width: '100%', background: 'none', border: 'none', color: T.textSecondary, fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer', marginTop: 4, padding: 6 }}
              >
                Redeem early — {pctStr} funded
              </button>
            )}
          </>
        )}

        <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 15, fontWeight: 700, color: T.text, margin: '24px 0 10px' }}>
          Contribution history
        </div>
        {contributions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contributions.map((tx) => (
              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', background: T.card, border: T.cardBorder, borderRadius: 14, padding: '12px 14px' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{tx.description || 'Quest contribution'}</div>
                  <div style={{ fontSize: 11.5, color: T.textTertiary, marginTop: 2 }}>{longDate(tx.date)}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.quest, flexShrink: 0 }}>+{formatINR(tx.amount)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: T.card, border: T.cardBorder, borderRadius: 14, padding: '18px 16px', textAlign: 'center', fontSize: 13, color: T.textTertiary }}>
            No contributions logged yet.
          </div>
        )}
      </div>

      {showRedeemConfirm && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 20 }} onClick={() => setShowRedeemConfirm(false)} />
          <div
            style={{
              position: 'absolute', left: 20, right: 20, top: '50%', transform: 'translateY(-50%)',
              background: T.sheetBg, borderRadius: 24, padding: '26px 22px', textAlign: 'center', zIndex: 21, animation: 'popIn 0.2s',
            }}
          >
            <div style={{ fontSize: 34 }}>🎉</div>
            <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 800, color: T.text, marginTop: 8 }}>
              Redeem {quest.name}?
            </div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 6, lineHeight: 1.4 }}>
              {quest.questStatus === 'active'
                ? `This logs a ${formatINR(contributed)} expense now and marks the quest Redeemed — ${formatINR(shortfall)} short of your ${formatINR(quest.questTargetAmount)} goal. No going back!`
                : `This logs a ${formatINR(contributed)} expense and marks the quest Redeemed. No going back!`}
            </div>
            <button
              type="button"
              onClick={confirmRedeem}
              style={{ width: '100%', padding: 15, borderRadius: 100, border: 'none', background: GOLD_COLOR, color: 'oklch(0.2 0.03 85)', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 18 }}
            >
              Yes, redeem it
            </button>
            <button
              type="button"
              onClick={() => setShowRedeemConfirm(false)}
              style={{ width: '100%', padding: 14, borderRadius: 100, border: 'none', background: 'none', color: T.textTertiary, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}
            >
              Not yet
            </button>
          </div>
        </>
      )}

      {showCelebration && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', padding: 20 }}>
          <div style={{ background: T.sheetBg, border: '1px solid oklch(0.6 0.13 85 / 0.5)', borderRadius: 24, padding: '30px 26px', textAlign: 'center', animation: 'popIn 0.3s' }}>
            <div style={{ fontSize: 40 }}>🎉</div>
            <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 800, color: 'oklch(0.85 0.1 85)', marginTop: 8 }}>
              Redeemed!
            </div>
            <div style={{ fontSize: 13, color: T.textTertiary, marginTop: 4 }}>Enjoy it — you earned this.</div>
          </div>
        </div>
      )}
    </>
  );
}
