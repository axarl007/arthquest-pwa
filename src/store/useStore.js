import { useContext } from 'react';
import { StoreContext } from './context.js';

/** Returns { state, setState } — setState accepts a partial object or an updater `(state) => partial`. */
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}
