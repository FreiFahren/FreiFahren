import { Capacitor } from '@capacitor/core';

// Light tap confirming a selection (station/report/line/direction, layer toggle). Native-only
// (no web Vibration on iOS Safari), lazy-imported, best-effort fire-and-forget — never blocks or
// throws into a click handler.
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

// Success notification for a completed action (e.g. a submitted report) — an outcome, not a
// selection. Same native-only, fire-and-forget contract as `selectionTap`.
export function notifySuccess(): void {
  if (!Capacitor.isNativePlatform()) return;
  void (async () => {
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      /* ignore */
    }
  })();
}
