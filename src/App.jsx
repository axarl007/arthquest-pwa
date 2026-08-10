import { useEffect, useState } from 'react';
import { useStore } from './store/useStore.js';
import { useTheme } from './theme/useTheme.js';
import { AppShell } from './components/AppShell.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { Fab } from './components/Fab.jsx';
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
import { Settings } from './screens/Settings.jsx';
import { Categories } from './screens/Categories.jsx';
import { Pairing } from './screens/Pairing.jsx';
import { resolveTransactionSubject } from './domain/transactions.js';
import { dueReminders } from './domain/reminders.js';
import { todayIso } from './domain/format.js';
import { useNearbySync } from './native/useNearbySync.js';

const TAB_SCREENS = { home: Home, transactions: Transactions, budget: Budget, quests: Quests };

export default function App() {
  const { state, setState } = useStore();
  const { T, C } = useTheme();
  // Owns the Nearby Connections session (ticket #18) for the whole app — called once here, not
  // per-screen, since it holds the plugin's singleton listener subscriptions and native session.
  const nearby = useNearbySync();
  const [screen, setScreen] = useState(() => (state.onboarded ? 'home' : 'onboarding'));
  // Subscreen state for Budget -> category detail; cleared whenever we navigate away from it.
  const [categoryDetail, setCategoryDetail] = useState(null); // null | { categoryId, monthKey }
  // Subscreen state for Quests -> quest detail; cleared whenever we navigate away from it.
  const [questDetail, setQuestDetail] = useState(null); // null | { questId, autoRedeem? }
  // Subscreen state for Home -> Settings (-> Categories/Pairing); cleared whenever we navigate away.
  const [settings, setSettings] = useState(null); // null | 'main' | 'categories' | 'pairing'
  // null | { type: 'log', initialType?, initialCategoryId? } | { type: 'txActions', tx } |
  // { type: 'budgetActions' } | { type: 'addCategory', context, initialGroup } | { type: 'newQuest', initialName? }
  const [sheet, setSheet] = useState(null);

  // Best-effort foreground reminder check, once per app open (decision #3: no push server, no
  // proactive permission prompting — Notification.permission is only ever 'granted' here because
  // the user already opted in via a Settings toggle, so a not-granted permission makes this a
  // silent no-op, mirroring AndroidReminderNotifier's own silent no-op path).
  useEffect(() => {
    if (!state.onboarded) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const today = todayIso();
    const due = dueReminders(state, today);
    let backupNotified = false;
    for (const reminder of due) {
      try {
        // eslint-disable-next-line no-new
        new Notification(reminder.title, { body: reminder.body });
        if (reminder.key === 'backup') backupNotified = true;
      } catch {
        // Notification construction can throw in some contexts (e.g. no active document) —
        // best-effort means a failure here shouldn't break the app. Crucially, lastBackupReminderDate
        // below only advances on an actual successful notify, not just a "was due" check — otherwise
        // a throw here would silently mark the user as reminded when they were never shown anything,
        // pushing the next real reminder out by the full interval.
      }
    }
    if (backupNotified) {
      setState({ lastBackupReminderDate: today });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // True whenever a full-screen subscreen overlay is covering the tab screen — BottomNav and the
  // transaction-logging Fab are unmounted (not just visually covered) while one is open, both to
  // match "no bottom-nav/FAB on this subscreen" and so a hidden, still-focusable/query-able FAB
  // doesn't linger in the DOM (e.g. Categories' own "add category" Fab would otherwise share the
  // global Fab's aria-label with one of them invisible underneath).
  const subscreenOpen = Boolean(categoryDetail || questDetail || settings);

  return (
    <AppShell>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <TabScreen
          onOpenSettings={() => setSettings('main')}
          onOpenActions={() => setSheet({ type: 'budgetActions' })}
          onOpenNewQuest={() => setSheet({ type: 'newQuest' })}
          onSelectTx={(tx) => setSheet({ type: 'txActions', tx })}
          onSelectCategory={(categoryId, monthKey) => setCategoryDetail({ categoryId, monthKey })}
          onSelectQuest={(questId) => setQuestDetail({ questId })}
          onRedeemQuest={(questId) => setQuestDetail({ questId, autoRedeem: true })}
        />
      </div>
      {!subscreenOpen && (
        <>
          <BottomNav
            active={screen}
            onNavigate={(next) => {
              setCategoryDetail(null);
              setQuestDetail(null);
              setSettings(null);
              setScreen(next);
            }}
          />
          <Fab onClick={() => setSheet({ type: 'log' })} />
        </>
      )}

      {settings && (
        <div style={{ position: 'absolute', inset: 0, background: T.frameBg, zIndex: 15, display: 'flex', flexDirection: 'column' }}>
          {settings === 'categories' ? (
            <Categories onBack={() => setSettings('main')} onOpenAddCategory={openAddCategory} />
          ) : settings === 'pairing' ? (
            <Pairing onBack={() => setSettings('main')} nearby={nearby} />
          ) : (
            <Settings
              onBack={() => setSettings(null)}
              onOpenCategories={() => setSettings('categories')}
              onOpenPairing={() => setSettings('pairing')}
              onAdjustIncomeSplit={() => {
                setSettings(null);
                setScreen('onboarding');
              }}
              onReset={() => {
                setSettings(null);
                setScreen('onboarding');
              }}
            />
          )}
        </div>
      )}

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
