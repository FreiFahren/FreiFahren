import type { ReactNode } from 'react';

const DEFAULT_DURATION_MS = 4_000;
// Matches the duration-200 exit animation in the Toaster; the toast stays mounted
// (with `leaving` set) until this elapses so the animation can play out.
const EXIT_MS = 200;

export type ToastItem = {
  id: string | number;
  content: ReactNode;
  leaving: boolean;
};

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<string | number, ReturnType<typeof setTimeout>>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): ToastItem[] {
  return toasts;
}

function clearTimer(id: string | number) {
  const timer = timers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(id);
}

function remove(id: string | number) {
  clearTimer(id);
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

function startExit(id: string | number) {
  const item = toasts.find((entry) => entry.id === id);
  if (!item || item.leaving) return;
  clearTimer(id);
  toasts = toasts.map((entry) => (entry.id === id ? { ...entry, leaving: true } : entry));
  emit();
  timers.set(
    id,
    setTimeout(() => remove(id), EXIT_MS),
  );
}

/**
 * Minimal replacement for sonner's `toast`, covering the only surface the app uses:
 * fully custom-rendered toasts with optional dedupe ids and durations. Re-issuing a
 * toast under an existing id replaces its content in place and restarts its timer
 * (so e.g. near-simultaneous refetches collapse into one pill instead of stacking).
 */
export const toast = {
  custom(
    render: (id: string | number) => ReactNode,
    options: { id?: string | number; duration?: number } = {},
  ): string | number {
    const id = options.id ?? nextId++;
    clearTimer(id);
    const item: ToastItem = { id, content: render(id), leaving: false };
    toasts = toasts.some((entry) => entry.id === id)
      ? toasts.map((entry) => (entry.id === id ? item : entry))
      : [...toasts, item];
    emit();
    timers.set(
      id,
      setTimeout(() => startExit(id), options.duration ?? DEFAULT_DURATION_MS),
    );
    return id;
  },

  dismiss(id: string | number) {
    startExit(id);
  },
};

/**
 * Drops every toast immediately (no exit animation) and cancels their timers. Called when the
 * map-scoped <Toaster> unmounts (the user leaving the map for /report, /reports, etc.). The store
 * is a module global that outlives the route: a toast fired on the map keeps its live timer and
 * stays in the store, and during the route transition the <Toaster>'s `position: fixed` node can
 * be carried into the incoming route's subtree — so the stats pill stays painted on top of a
 * non-map page (FRE-653). Emptying the store on unmount makes the <Toaster> render nothing,
 * enforcing the invariant that toasts only ever live on the map.
 */
export function clearToasts() {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  if (toasts.length === 0) return;
  toasts = [];
  emit();
}
