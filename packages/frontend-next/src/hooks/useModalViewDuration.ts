import { useEffect } from 'react';

import { track } from '@/lib/analytics';

// Measures how long a detail modal stays open and fires `detail_modal_closed` on unmount. Both the
// station and report modals are router routes, so they mount on navigate-in and unmount on close —
// that lifecycle is the open window. We use performance.now() (monotonic) so a wall-clock shift
// can't produce garbage durations. A page close/refresh while open won't unmount cleanly, so those
// sessions are dropped — acceptable for an engagement metric.
export function useModalViewDuration(modal: 'station' | 'report'): void {
  useEffect(() => {
    const openedAt = performance.now();
    return () => {
      track('detail_modal_closed', {
        modal,
        duration_ms: Math.round(performance.now() - openedAt),
      });
    };
  }, [modal]);
}
