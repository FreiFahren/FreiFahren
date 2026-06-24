import { Capacitor } from '@capacitor/core';

import { queryClient } from '@/api/queryClient';
import { track } from '@/lib/analytics';

/**
 * Native-only platform setup for the Capacitor (iOS/Android) builds; a no-op on web. Plugins are
 * lazy-imported so they stay out of the web bundle, and each step is best-effort — a failing plugin
 * call must never block startup.
 */
export async function initNativePlatform(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Capgo OTA: signal that this bundle booted cleanly. If notifyAppReady() isn't called within
    // appReadyTimeout the updater treats the bundle as broken and rolls back to the previous one on
    // the next launch — that auto-rollback is our safety net for a bad bundle. The download/install
    // itself is handled by autoUpdate (see capacitor.config.ts).
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.notifyAppReady();
  } catch {
    /* ignore */
  }

  try {
    // The app has no multi-field forms, so the keyboard accessory bar (the "‹ › Done" toolbar) only
    // reads as a stray dialog.
    const { Keyboard } = await import('@capacitor/keyboard');
    await Keyboard.setAccessoryBarVisible({ isVisible: false });
  } catch {
    /* ignore */
  }

  try {
    // Counterintuitively, Style.Dark means "light text for a dark background" — which is what our
    // dark UI needs. setBackgroundColor is a no-op on iOS but styles the Android bar.
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#25272b' });
  } catch {
    /* ignore */
  }

  try {
    const { App } = await import('@capacitor/app');
    await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void queryClient.invalidateQueries();
    });
  } catch {
    /* ignore */
  }

  // AppDelegate bridges iOS's userDidTakeScreenshot notification to this window event. The current
  // route rides along automatically as posthog-js's `$pathname`.
  window.addEventListener('screenshotTaken', () => track('screenshot_taken', {}));
}
