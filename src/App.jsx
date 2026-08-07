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
import { Onboarding } from './screens/Onboarding.jsx';
import { Home } from './screens/Home.jsx';
import { Transactions } from './screens/Transactions.jsx';
import { Budget } from './screens/Budget.jsx';
import { CategoryDetail } from './screens/CategoryDetail.jsx';
import { Quests } from './screens/Quests.jsx';
import { resolveTransactionSubject } from './domain/transactions.js';

const TAB_SCREENS = { home: Home, transactions: Transactions, budget: Budget, quests: Quests };

export default function App() {
  const { state } = useStore();
  const { T, C } = useTheme();
  const [screen, setScreen] = useState(() => (state.onboarded ? 'home' : 'onboarding'));
  // Subscreen state for Budget -> category detail; cleared whenever we navigate away from it.
  const [categoryDetail, setCategoryDetail] = useState(null); // null | { categoryId, monthKey }
  // null | { type: 'log' } | { type: 'txActions', tx } | { type: 'budgetActions' } | { type: 'addCategory', context, initialGroup }
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
            onRequestQuest={() => {
              closeSheet();
              notYetBuilt('Quest creation');
            }}
          />
        )}
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
          onOpenNewQuest={() => notYetBuilt('Quest creation')}
          onSelectTx={(tx) => setSheet({ type: 'txActions', tx })}
          onSelectCategory={(categoryId, monthKey) => setCategoryDetail({ categoryId, monthKey })}
        />
      </div>
      <BottomNav
        active={screen}
        onNavigate={(next) => {
          setCategoryDetail(null);
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

      {sheet?.type === 'log' && <LogTransactionSheet onClose={closeSheet} />}
      {sheet?.type === 'txActions' && (
        <TxActionsSheet
          txId={sheet.tx.id}
          name={resolveTransactionSubject(sheet.tx, state.categories, state.incomeCategories, C).name}
          amount={sheet.tx.amount}
          type={sheet.tx.type}
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
          onRequestQuest={() => {
            closeSheet();
            notYetBuilt('Quest creation');
          }}
        />
      )}
    </AppShell>
  );
}
