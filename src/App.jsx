import { useRef, useState } from 'react';
import { useStore } from './store/useStore.js';
import { useTheme } from './theme/useTheme.js';
import { AppShell } from './components/AppShell.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { Fab } from './components/Fab.jsx';
import { Toast } from './components/Toast.jsx';
import { LogTransactionSheet } from './components/sheets/LogTransactionSheet.jsx';
import { TxActionsSheet } from './components/sheets/TxActionsSheet.jsx';
import { Onboarding } from './screens/Onboarding.jsx';
import { Home } from './screens/Home.jsx';
import { Transactions } from './screens/Transactions.jsx';
import { Budget } from './screens/Budget.jsx';
import { Quests } from './screens/Quests.jsx';
import { resolveTransactionSubject } from './domain/transactions.js';

const TAB_SCREENS = { home: Home, transactions: Transactions, budget: Budget, quests: Quests };

export default function App() {
  const { state } = useStore();
  const { C } = useTheme();
  const [screen, setScreen] = useState(() => (state.onboarded ? 'home' : 'onboarding'));
  const [sheet, setSheet] = useState(null); // null | { type: 'log' } | { type: 'txActions', tx }
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notYetBuilt = (feature) => {
    clearTimeout(toastTimer.current);
    setToast(`${feature} arrives in a later update`);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const closeSheet = () => setSheet(null);

  if (screen === 'onboarding') {
    return (
      <AppShell>
        <Onboarding onFinish={() => setScreen('home')} onOpenAddCategory={() => notYetBuilt('Adding a category')} />
        <Toast message={toast} />
      </AppShell>
    );
  }

  const TabScreen = TAB_SCREENS[screen];

  return (
    <AppShell>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <TabScreen
          onOpenSettings={() => notYetBuilt('Settings')}
          onOpenActions={() => notYetBuilt('Budget actions')}
          onOpenNewQuest={() => notYetBuilt('Quest creation')}
          onSelectTx={(tx) => setSheet({ type: 'txActions', tx })}
        />
      </div>
      <BottomNav active={screen} onNavigate={setScreen} />
      <Fab onClick={() => setSheet({ type: 'log' })} />
      <Toast message={toast} />

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
    </AppShell>
  );
}
