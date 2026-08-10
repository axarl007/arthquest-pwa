import { useEffect, useReducer } from 'react';
import { loadState, saveState, ensureDeviceId } from './persistence.js';
import { StoreContext } from './context.js';

function reducer(state, patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  // A functional updater that deliberately returns the very same `state` object it was given
  // (e.g. domain/sync.js's applyIncomingSync, on a stray/rejected sync message — see its own doc
  // comment) means "nothing changed here at all," not "here's a same-content replacement" —
  // preserving that reference instead of spreading into a new object skips the saveState effect
  // and re-render below for what both are otherwise a genuine no-op. Every other caller in this
  // app returns a fresh partial-field object, so `next === state` never happens by accident.
  if (next === state) return state;
  return { ...state, ...next };
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  // Generates this device's stable identity (ticket #17) on first mount if it doesn't have one
  // yet — a real setState, not a side effect inside loadState's lazy initializer (see
  // ensureDeviceId's doc comment for why that split matters under StrictMode). Runs once on
  // mount only: deviceId is write-once, so re-checking it on every later state change (which
  // [state] as a dependency would do, since the reducer returns a new object every dispatch)
  // would be pure wasted work for the rest of the session.
  useEffect(() => {
    const patch = ensureDeviceId(state);
    if (patch) dispatch(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  return <StoreContext.Provider value={{ state, setState: dispatch }}>{children}</StoreContext.Provider>;
}
