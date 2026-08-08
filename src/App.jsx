import { useRef, useState } from 'react';
import { useStore } from './store/useStore.js';
import { useTheme } from './theme/useTheme.js';
import { AppShell } from './components/AppShell.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { Fab } from './components/Fab.jsx';
import { Toast } from './components/Toast.jsx';
import { LogTransactionSheet } from './components/sheets/LogTransactionSheet.jsx';
import { TxActionsSheet } from './components/sheets/TxActionsSheet.jsx';
import { BudgetActionsSheet } from './components/sheets/BudgetActionsSheet.jsx';
import { AddCategorySheet } from './components/sheets/AddCategorySheet.jsx';
import { NewQuestSheet } from './components/sheets/NewQuestSheet.jsx';
import { Onboarding } from './screens/Onboarding.jsx';
import { Home } from './screens/Home.jsx';
import { Transactions } from './screens/Transactions.jsx';
import { Budget } from './screens/Budget.jsx';
import { CategoryDetail } from './screens/CategoryDetail.jsx';
import { Quests } from './screens/Quests.jsx';
import { QuestDetail } from './screens/QuestDetail.jsx';
import { resolveTransactionSubject } from './domain/transactions.js';

const TAB_SCREENS = { home: Home, transactions: Transactions, budget: Budget, quests: Quests };

export default function App() {
  const { state } = useStore();
  const { T, C } = useTheme();
  const [screen, setScreen] = useState(() => (state.onboarded ? 'home' : 'onboarding'));
  // Subscreen state for Budget -> category detail; cleared whenever we navigate away from it.
  const [categoryDetail, setCategoryDetail] = useState(null); // null | { categoryId, monthKey }
  // Subscreen state for Quests -> quest detail; cleared whenever we navigate away from it.
  const [questDetail, setQuestDetail] = useState(null); // null | { questId, autoRedeem? }
  // null | { type: 'log', initialType?, initialCategoryId? } | { type: 'txActions', tx } |
  // { type: 'budgetActions' } | { type: 'addCategory', context, initialGroup } | { type: 'newQuest', initialName? }
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notYetBuilt = (feature) => {
    clearTimeout(toastTimer.current);
    setToast(`${feature} arrives in a later update`);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const closeSheet = () => setSheet(null);

  const openAddCategory = (context = 'budget', initialGroup = 'needs') => {
    setSheet({ type: 'addCategory', context, initialGroup });
  };

  // AddCategorySheet's "Quest" branch doesn't create anything itself — a Quest needs a target
  // amount/date that sheet doesn't collect — so it hands off here to the real New Quest sheet,
  // pre-filled with whatever name the user already typed.
  const requestQuestFromAddCategory = (name) => {
    setSheet({ type: 'newQuest', initialName: name });
  };

  if (screen === 'onboarding') {
    return (
      <AppShell>
        <Onboarding onFinish={() => setScreen('home')} onOpenAddCategory={() => openAddCategory('budget')} />
        <Toast message={toast} />
        {sheet?.type === 'addCategory' && (
          <AddCategorySheet
            context={sheet.context}
            initialGroup={sheet.initialGroup}
            onClose={closeSheet}
            onRequestQuest={requestQuestFromAddCategory}
          />
        )}
        {sheet?.type === 'newQuest' && <NewQuestSheet initialName={sheet.initialName} onClose={closeSheet} />}
      </AppShell>
    );
  }

  const TabScreen = TAB_SCREENS[screen];

  return (
    <AppShell>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <TabScreen
          onOpenSettings={() => notYetBuilt('Settings')}
          onOpenActions={() => setSheet({ type: 'budgetActions' })}
          onOpenNewQuest={() => setSheet({ type: 'newQuest' })}
          onSelectTx={(tx) => setSheet({ type: 'txActions', tx })}
          onSelectCategory={(categoryId, monthKey) => setCategoryDetail({ categoryId, monthKey })}
          onSelectQuest={(questId) => setQuestDetail({ questId })}
          onRedeemQuest={(questId) => setQuestDetail({ questId, autoRedeem: true })}
        />
      </div>
      <BottomNav
        active={screen}
        onNavigate={(next) => {
          setCategoryDetail(null);
          setQuestDetail(null);
          setScreen(next);
        }}
      />
      <Fab onClick={() => setSheet({ type: 'log' })} />
      <Toast message={toast} />

      {categoryDetail && (
        // Overlays Budget rather than replacing it, so Budget's search/filter/sort/month-nav
        // state survives opening and closing a category's detail (see AppShell's position:relative
        // frame — this covers it exactly, including the BottomNav/Fab this subscreen has none of).
        <div style={{ position: 'absolute', inset: 0, background: T.frameBg, zIndex: 15, display: 'flex', flexDirection: 'column' }}>
          <CategoryDetail
            categoryId={categoryDetail.categoryId}
            monthKey={categoryDetail.monthKey}
            onBack={() => setCategoryDetail(null)}
          />
        </div>
      )}

      {questDetail && (
        <div style={{ position: 'absolute', inset: 0, background: T.frameBg, zIndex: 15, display: 'flex', flexDirection: 'column' }}>
          <QuestDetail
            questId={questDetail.questId}
            autoRedeem={questDetail.autoRedeem}
            onBack={() => setQuestDetail(null)}
            onAddContribution={(questId) => setSheet({ type: 'log', initialType: 'quest_contribution', initialCategoryId: questId })}
          />
        </div>
      )}

      {sheet?.type === 'log' && (
        <LogTransactionSheet initialType={sheet.initialType} initialCategoryId={sheet.initialCategoryId} onClose={closeSheet} />
      )}
      {sheet?.type === 'txActions' && (
        <TxActionsSheet
          txId={sheet.tx.id}
          name={resolveTransactionSubject(sheet.tx, state.categories, state.incomeCategories, C).name}
          amount={sheet.tx.amount}
          type={sheet.tx.type}
          categoryId={sheet.tx.categoryId}
          onClose={closeSheet}
        />
      )}
      {sheet?.type === 'budgetActions' && (
        <BudgetActionsSheet
          onClose={closeSheet}
          onAddCategory={() => openAddCategory('budget')}
          onAdjustIncomeSplit={() => {
            closeSheet();
            setScreen('onboarding');
          }}
        />
      )}
      {sheet?.type === 'addCategory' && (
        <AddCategorySheet
          context={sheet.context}
          initialGroup={sheet.initialGroup}
          onClose={closeSheet}
          onRequestQuest={requestQuestFromAddCategory}
        />
      )}
      {sheet?.type === 'newQuest' && <NewQuestSheet initialName={sheet.initialName} onClose={closeSheet} />}
    </AppShell>
  );
}
