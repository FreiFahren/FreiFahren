import { useSyncExternalStore } from 'react';

// Which transit layer the map shows: risk-colored segments ('RISK') or plain line colors
// ('LINES'). Shared between the toggle button (mounted in the map route) and the layer (nested
// inside the lazily-loaded map), so it lives in a tiny module store rather than React context —
// no provider, no prop-drilling across the lazy boundary. Defaults to 'RISK' and persists the
// user's choice under the `defaultLayer` key.
type Layer = 'RISK' | 'LINES';

const STORAGE_KEY = 'defaultLayer';
const DEFAULT_LAYER: Layer = 'RISK';

function readInitial(): Layer {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'LINES' ? 'LINES' : 'RISK';
  } catch {
    return DEFAULT_LAYER;
  }
}

let layer = readInitial();
const listeners = new Set<() => void>();

function setLayer(next: Layer) {
  if (next === layer) return;
  layer = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore storage failures (e.g. private mode); state still works for the session.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRiskLayer(): { visible: boolean; toggle: () => void } {
  const current = useSyncExternalStore(subscribe, () => layer);
  return {
    visible: current === 'RISK',
    toggle: () => setLayer(layer === 'RISK' ? 'LINES' : 'RISK'),
  };
}
