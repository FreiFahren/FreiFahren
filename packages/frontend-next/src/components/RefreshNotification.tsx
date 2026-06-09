import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { useReportsRefreshSignal } from '@/api/reports';
import { ToastPill } from '@/components/ui/toast-pill';
import { i18n } from '@/lib/i18n';

import { NAMESPACE } from './RefreshNotification.i18n';

const TOAST_ID = 'reports-refreshed';

export function RefreshNotification() {
  const signal = useReportsRefreshSignal();

  useEffect(() => {
    if (signal === 0) return;
    // Reading off the i18n singleton (not a reactive `t`) keeps this keyed on `signal` alone;
    // the fixed id collapses near-simultaneous slice refetches into one toast instead of stacking.
    toast.custom(
      () => (
        <ToastPill className="text-foreground flex w-fit items-center gap-2 text-sm font-semibold">
          <RefreshCw className="size-4 animate-spin" />
          {i18n.t('refreshed', { ns: NAMESPACE })}
        </ToastPill>
      ),
      // icon: null clears sonner's own icon slot — we draw the icon inside the pill, and
      // reusing one id would otherwise let a stale `icon` option linger and render twice.
      { id: TOAST_ID, unstyled: true, icon: null },
    );
  }, [signal]);

  return null;
}
