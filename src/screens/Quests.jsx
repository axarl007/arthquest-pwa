import { useStore } from '../store/useStore.js';
import { useTheme } from '../theme/useTheme.js';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { EmptyStateBody } from './EmptyStateBody.jsx';
import { questRows } from '../domain/quests.js';
import { formatINR, longDate } from '../domain/format.js';
import { GOLD_COLOR } from '../theme/tokens.js';

export function Quests({ onOpenNewQuest, onSelectQuest, onRedeemQuest }) {
  const { state } = useStore();
  const { T, C } = useTheme();

  const rows = questRows(state.categories, state.transactions);
  const active = rows.filter((r) => r.quest.questStatus === 'active');
  const completed = rows.filter((r) => r.quest.questStatus === 'completed');
  const redeemed = rows.filter((r) => r.quest.questStatus === 'redeemed');

  if (rows.length === 0) {
    return (
      <>
        <ScreenHeader title="Quests" action={{ icon: 'add', label: 'New quest', variant: 'quest', onClick: onOpenNewQuest }} />
        <EmptyStateBody title="No quests yet" body="Create a savings quest to start tracking a goal." />
      </>
    );
  }

  return (
    <>
      <ScreenHeader title="Quests" action={{ icon: 'add', label: 'New quest', variant: 'quest', onClick: onOpenNewQuest }} />
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 20px 110px' }}>
        {active.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, margin: '8px 0 10px' }}>
              Active
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {active.map(({ quest, contributed, progressFraction }) => {
                const deg = progressFraction * 360;
                return (
                  <div
                    key={quest.id}
                    onClick={() => onSelectQuest(quest.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, background: T.card, border: T.cardBorder, borderRadius: 18, padding: 16, cursor: 'pointer' }}
                  >
                    <div style={{ width: 60, height: 60, borderRadius: 30, background: `conic-gradient(${C.quest} ${deg}deg, ${T.trackBg} ${deg}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 23, background: T.card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{Math.round(progressFraction * 100)}%</span>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{quest.name}</div>
                      <div style={{ fontSize: 12.5, color: T.textTertiary, marginTop: 3 }}>
                        {formatINR(contributed)} of {formatINR(quest.questTargetAmount)}
                      </div>
                      {quest.questTargetDate && (
                        <div style={{ fontSize: 11.5, color: C.accent, marginTop: 4 }}>Target {longDate(quest.questTargetDate)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, margin: '20px 0 10px' }}>
              Completed — ready to redeem
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {completed.map(({ quest }) => (
                <div
                  key={quest.id}
                  onClick={() => onSelectQuest(quest.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, borderRadius: 18, padding: 16, cursor: 'pointer',
                    background: 'linear-gradient(135deg, oklch(0.28 0.07 85), oklch(0.24 0.04 60))',
                    border: '1px solid oklch(0.55 0.1 85 / 0.5)',
                  }}
                >
                  <div style={{ width: 60, height: 60, borderRadius: 30, background: `conic-gradient(${GOLD_COLOR} 360deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 23, background: 'oklch(0.24 0.04 60)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.98 0.02 85)' }}>100%</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'oklch(0.97 0.02 85)' }}>{quest.name}</div>
                    <div style={{ fontSize: 12.5, color: 'oklch(0.85 0.08 85)', marginTop: 3 }}>
                      Fully funded · {formatINR(quest.questTargetAmount)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRedeemQuest(quest.id);
                    }}
                    style={{ fontSize: 11.5, fontWeight: 700, color: 'oklch(0.2 0.03 85)', background: GOLD_COLOR, padding: '6px 10px', borderRadius: 100, flexShrink: 0, border: 'none', cursor: 'pointer' }}
                  >
                    Redeem
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {redeemed.length > 0 && (
          <div style={{ marginTop: 20, opacity: 0.8 }}>
            <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, margin: '20px 0 10px' }}>
              Redeemed
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {redeemed.map(({ quest }) => (
                <div
                  key={quest.id}
                  onClick={() => onSelectQuest(quest.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, background: T.cardMuted, borderRadius: 18, padding: 16, cursor: 'pointer' }}
                >
                  <div style={{ width: 50, height: 50, borderRadius: 25, background: T.btnSecondaryBgAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 18 }}>✓</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{quest.name}</div>
                    <div style={{ fontSize: 12.5, color: T.textTertiary, marginTop: 3 }}>
                      Redeemed {longDate(quest.questRedeemedDate)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
