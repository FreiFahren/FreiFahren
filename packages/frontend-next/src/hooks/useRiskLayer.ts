import { useEffect, useSyncExternalStore } from 'react';

import { setSuperProperties, track } from '@/lib/analytics';

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
  track('risk_layer_toggled', { to: next });
  setSuperProperties({ map_layer: next });
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRiskLayer(): { visible: boolean; toggle: () => void } {
  const current = useSyncExternalStore(subscribe, () => layer);
  // Stamp the current layer as a super property once PostHog is initialized (it isn't yet at module
  // load), so events fired before any toggle — pageviews, reports — still carry the default state.
  useEffect(() => {
    setSuperProperties({ map_layer: current });
  }, [current]);
  return {
    visible: current === 'RISK',
    toggle: () => setLayer(layer === 'RISK' ? 'LINES' : 'RISK'),
  };
}
