import { safeSessionStorage } from '@/lib/safe-storage';

export const PRELOAD_RELOAD_MARK = 'ff-preload-reload';

// Fetch a fresh shell after a failed lazy import, but avoid offline and repeated reloads.
export function initPreloadRecovery(): void {
  window.addEventListener('vite:preloadError', () => {
    // Canceling this event makes Vite resolve the import to undefined. Keep the original rejection
    // for callers to handle, even when a reload is requested but navigation has not happened yet.
    if (!navigator.onLine) return;
    const KEY = 'vite:preloadError:lastReload';
    if (Date.now() - Number(safeSessionStorage.getItem(KEY) ?? 0) < 10_000) return;
    if (window.name === PRELOAD_RELOAD_MARK) return;
    safeSessionStorage.setItem(KEY, String(Date.now()));
    window.name = PRELOAD_RELOAD_MARK;
    window.location.reload();
  });
}
