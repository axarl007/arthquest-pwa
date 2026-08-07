import { useRef, useState } from 'react';
import { AppShell } from './components/AppShell.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { Fab } from './components/Fab.jsx';
import { Toast } from './components/Toast.jsx';
import { Home } from './screens/Home.jsx';
import { Transactions } from './screens/Transactions.jsx';
import { Budget } from './screens/Budget.jsx';
import { Quests } from './screens/Quests.jsx';

const SCREENS = { home: Home, transactions: Transactions, budget: Budget, quests: Quests };

export default function App() {
  const [screen, setScreen] = useState('home');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notYetBuilt = (feature) => {
    clearTimeout(toastTimer.current);
    setToast(`${feature} arrives in a later update`);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const Screen = SCREENS[screen];

  return (
    <AppShell>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Screen
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
