import { useStore } from '../store/useStore.js';
import { useTheme } from '../theme/useTheme.js';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { questRows } from '../domain/quests.js';
import { formatINR } from '../domain/format.js';

// Mirrors HomeViewModel's activeQuests: ACTIVE or COMPLETED quests (never REDEEMED — those have
// nothing left to track on Home).
const HOME_QUEST_STATUSES = ['active', 'completed'];

export function Home({ onOpenSettings, onSelectQuest }) {
  const { state } = useStore();
  const { T, C } = useTheme();
  const quests = questRows(state.categories, state.transactions, HOME_QUEST_STATUSES);

  return (
    <>
      <ScreenHeader title="Home" action={{ icon: 'menu', label: 'Settings', onClick: onOpenSettings }} />
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 20px 110px' }}>
        {quests.length > 0 && (
          <div style={{ marginTop: 8 }}>
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

        <div
          style={{
            marginTop: quests.length > 0 ? 24 : 0, flex: quests.length > 0 ? undefined : 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: quests.length > 0 ? 'flex-start' : 'center', textAlign: 'center',
            padding: quests.length > 0 ? '20px 12px' : '0 32px', gap: 6,
          }}
        >
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 17, fontWeight: 700, color: T.text }}>
            More on the way
          </div>
          <div style={{ fontSize: 13, color: T.textTertiary, lineHeight: 1.5 }}>
            Your monthly summary and cumulative position land here in the next update.
          </div>
        </div>
      </div>
    </>
  );
}
