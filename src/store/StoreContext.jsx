import { useEffect, useReducer } from 'react';
import { loadState, saveState } from './persistence.js';
import { StoreContext } from './context.js';

function reducer(state, patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  return { ...state, ...next };
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  return <StoreContext.Provider value={{ state, setState: dispatch }}>{children}</StoreContext.Provider>;
}
