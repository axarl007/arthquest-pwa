import { useRef, useState } from 'react';
import { useStore } from './store/useStore.js';
import { AppShell } from './components/AppShell.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { Fab } from './components/Fab.jsx';
import { Toast } from './components/Toast.jsx';
import { Onboarding } from './screens/Onboarding.jsx';
import { Home } from './screens/Home.jsx';
import { Transactions } from './screens/Transactions.jsx';
import { Budget } from './screens/Budget.jsx';
import { Quests } from './screens/Quests.jsx';

const TAB_SCREENS = { home: Home, transactions: Transactions, budget: Budget, quests: Quests };

export default function App() {
  const { state } = useStore();
  const [screen, setScreen] = useState(() => (state.onboarded ? 'home' : 'onboarding'));
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notYetBuilt = (feature) => {
    clearTimeout(toastTimer.current);
    setToast(`${feature} arrives in a later update`);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

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
        />
      </div>
      <BottomNav active={screen} onNavigate={setScreen} />
      <Fab onClick={() => notYetBuilt('Logging a transaction')} />
      <Toast message={toast} />
    </AppShell>
  );
}
