import { Capacitor } from '@capacitor/core';

/**
 * A light haptic tap to confirm a selection (a station/report picked on the map or in search).
 * Native-only: the web Vibration API is unsupported on iOS Safari and just noise on desktop, so
 * there's nothing to gain firing it in the PWA. Best-effort and fire-and-forget — haptics are a
 * nicety and must never block or throw into a click handler. The plugin is lazy-imported so it
 * stays out of the web bundle, matching the other native plugins (see `@/lib/native`).
 */
export function selectionTap(): void {
  if (!Capacitor.isNativePlatform()) return;
  void (async () => {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      /* ignore */
    }
  })();
}
