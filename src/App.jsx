import { useCallback, useEffect, useState } from 'react';
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
import { ImportReview } from './screens/ImportReview.jsx';
import { ImportUndoToast } from './components/ImportUndoToast.jsx';
import { undoImport, canUndoImport } from './domain/statementImport.js';
import { resolveTransactionSubject } from './domain/transactions.js';
import { dueReminders } from './domain/reminders.js';
import { todayIso } from './domain/format.js';
import { useNearbySync } from './native/useNearbySync.js';
import { useAndroidBackButton } from './native/useAndroidBackButton.js';
import { useAppShortcutDeepLink } from './native/useAppShortcutDeepLink.js';
import { useSharedStatement } from './native/useSharedStatement.js';
import { canOpenSharedStatement } from './domain/sharedStatement.js';
import { parseStatement, StatementImportError } from './domain/importers/index.js';

const TAB_SCREENS = { home: Home, transactions: Transactions, budget: Budget, quests: Quests };

// Shared by Settings' own on-screen back arrows and the hardware/gesture back button (ticket #29)
// so both back out exactly one level the same way: 'categories'/'pairing' return to Settings' main
// menu, 'pairing-direct' (opened straight from Home, skipping Settings) and 'main' itself both
// close the whole settings subscreen.
function settingsBackTarget(settings) {
  // 'import-direct' (a statement shared in from Android's share sheet, #40) closes straight back to
  // whatever was showing, like 'pairing-direct'.
  if (settings === 'categories' || settings === 'pairing' || settings === 'import') return 'main';
  return null;
}

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
  const [settings, setSettings] = useState(null); // null | 'main' | 'categories' | 'pairing' | 'pairing-direct' | 'import' | 'import-direct'
  // The parsed statement (domain/importers parseStatement result) the 'import' subscreen reviews.
  const [importDraft, setImportDraft] = useState(null);
  // The just-submitted import batch the undo toast (#38) can reverse: null | { transactionIds, previousPayeeEntries }.
  const [importUndo, setImportUndo] = useState(null);
  const dismissImportUndo = useCallback(() => setImportUndo(null), []);
  // A statement shared in from Android's share sheet (#40), held until canOpenSharedStatement
  // allows opening it: null | { text } | { error }.
  const [pendingShare, setPendingShare] = useState(null);
  // { message, id } to show on Settings' main screen when a shared file can't be imported — `id`
  // remounts Settings so a new error shows even if Settings was already open.
  const [shareError, setShareError] = useState(null);
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

  const navigateToTab = (next) => {
    setCategoryDetail(null);
    setQuestDetail(null);
    setSettings(null);
    setScreen(next);
  };

  // Onboarding has no subscreens/tabs of its own to back out of — force categoryDetail/questDetail/
  // settings/screen to their "nothing open, already home" shape so back only ever closes an open
  // sheet (addCategory/newQuest) or exits, never jumps to the Home tab mid-onboarding (state.onboarded
  // is still false then, which would land on an unconfigured Home).
  useAndroidBackButton(
    screen === 'onboarding'
      ? { sheet, categoryDetail: null, questDetail: null, settings: null, screen: 'home' }
      : { sheet, categoryDetail, questDetail, settings, screen },
    {
      onCloseSheet: closeSheet,
      onCloseCategoryDetail: () => setCategoryDetail(null),
      onCloseQuestDetail: () => setQuestDetail(null),
      onCloseSettings: () => setSettings(settingsBackTarget(settings)),
      onGoHome: () => navigateToTab('home'),
    },
  );

  // Home-screen widget (#33) and native launcher-icon app shortcuts (#34) — each opens the exact
  // same sheet the FAB/Budget's "+"/Quests' "New quest" already do, stacking on top of whatever
  // screen is currently showing. Guarded on screen !== 'onboarding' rather than just
  // state.onboarded: that screen is reused for both true first-run onboarding (state.onboarded
  // false) AND the "redo income split" re-run (state.onboarded stays true — see
  // Settings.jsx/BudgetActionsSheet.jsx's onAdjustIncomeSplit), and its JSX branch doesn't render
  // any of these sheet types at all — opening one there would sit inert until the user finished
  // that flow and screen flipped back, then pop open unprompted on whatever screen they landed on.
  // Also guarded on !sheet: `sheet` is a single slot, not a stack, so firing while another sheet
  // (e.g. NewQuestSheet with an unsaved in-progress form) is already open would silently replace
  // it and lose that input — the deep link can arrive at an arbitrary moment (app backgrounded,
  // shortcut tapped) that the FAB/etc.'s own click handlers never have to account for, since
  // they're unreachable while a sheet's backdrop covers them.
  const openFromShortcut = (openFn) => {
    if (screen !== 'onboarding' && !sheet) openFn();
  };
  useSharedStatement(setPendingShare);
  useEffect(() => {
    if (!pendingShare || !canOpenSharedStatement({ screen, sheet, settings, categoryDetail, questDetail })) return;
    setPendingShare(null);
    let draft = null;
    let error = pendingShare.error ?? null;
    if (!error) {
      try {
        draft = parseStatement(pendingShare.text);
      } catch (e) {
        error = e instanceof StatementImportError ? e.message : "Couldn't read that file.";
      }
    }
    if (draft) {
      setShareError(null);
      setImportDraft(draft);
      // Over Settings' main screen it's a normal 'import' (Back returns to Settings); over a tab
      // it's 'import-direct' (Back returns to that tab).
      setSettings(settings === 'main' ? 'import' : 'import-direct');
    } else {
      // Shown on Settings' Data section, next to the in-app picker that hits the same errors.
      setShareError({ message: error, id: Date.now() });
      setSettings('main');
    }
  }, [pendingShare, screen, sheet, settings, categoryDetail, questDetail]);
  // A share error belongs to the Settings visit it opened — clear it once Settings' main screen
  // isn't showing, so it doesn't reappear on every later visit.
  useEffect(() => {
    if (settings !== 'main') setShareError((e) => (e?.message ? { ...e, message: null } : e));
  }, [settings]);

  useAppShortcutDeepLink({
    'add-transaction': () => openFromShortcut(() => setSheet({ type: 'log' })),
    'add-category': () => openFromShortcut(() => openAddCategory('budget')),
    'new-quest': () => openFromShortcut(() => setSheet({ type: 'newQuest' })),
  });

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
          onOpenPairing={() => setSettings('pairing-direct')}
        />
      </div>
      {!subscreenOpen && (
        <>
          <BottomNav active={screen} onNavigate={navigateToTab} />
          <Fab onClick={() => setSheet({ type: 'log' })} />
        </>
      )}

      {settings && (
        <div style={{ position: 'absolute', inset: 0, background: T.frameBg, zIndex: 15, display: 'flex', flexDirection: 'column' }}>
          {settings === 'categories' ? (
            <Categories onBack={() => setSettings(settingsBackTarget(settings))} onOpenAddCategory={openAddCategory} />
          ) : settings === 'pairing' || settings === 'pairing-direct' ? (
            // 'pairing-direct' (Home's sync indicator/nudge, which skips Settings entirely) backs
            // out to the tab screen it was opened from, not to a Settings main menu the user never
            // visited — 'pairing' (opened via Settings' own "Pair a device" button) still backs out
            // to Settings main, matching every other subscreen's "return to where you came from".
            <Pairing onBack={() => setSettings(settingsBackTarget(settings))} nearby={nearby} />
          ) : (settings === 'import' || settings === 'import-direct') && importDraft ? (
            <ImportReview
              draft={importDraft}
              onBack={() => setSettings(settingsBackTarget(settings))}
              onImported={(batch) => {
                setImportDraft(null);
                setImportUndo(batch);
                navigateToTab('transactions');
              }}
            />
          ) : (
            <Settings
              key={shareError?.id ?? 'settings'}
              onBack={() => setSettings(settingsBackTarget(settings))}
              onOpenCategories={() => setSettings('categories')}
              onOpenPairing={() => setSettings('pairing')}
              initialStatementError={shareError?.message ?? null}
              onOpenImport={(draft) => {
                setShareError(null);
                setImportDraft(draft);
                setSettings('import');
              }}
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

      {/* canUndoImport hides the toast once undo would be unsafe — a reset or backup restore
          replaced the batch, or a quest it completed has since been redeemed. */}
      {importUndo && canUndoImport(state, importUndo) && (
        <ImportUndoToast
          // Keyed per batch so a new import restarts the auto-dismiss timer.
          key={importUndo.transactionIds[0]}
          count={importUndo.transactionIds.length}
          onDismiss={dismissImportUndo}
          onUndo={() => {
            const batch = importUndo;
            setState((s) => (canUndoImport(s, batch) ? undoImport(s, batch) : s));
            setImportUndo(null);
          }}
        />
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
