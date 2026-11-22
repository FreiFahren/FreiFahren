import type { ErrorComponentProps } from '@tanstack/react-router';
import { TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from '@tanstack/react-router';

import { Button } from '@freifahren/ui/button';
import { captureException } from '@/lib/error-monitoring';

import { NAMESPACE } from './route-error.i18n';

/** Shown in place of a route that threw while rendering, so one broken page doesn't blank the app. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation(NAMESPACE);
  const router = useRouter();

  useEffect(() => {
    captureException(error);
  }, [error]);

  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    /*
     * Retry by re-running the failed route's loader. reset() alone would just re-render against
     * the router's failed loader state, and refetching every query would also wait on unrelated
     * requests; invalidate() retries exactly what this route loads and clears that state. A
     * failed retry (e.g. offline) keeps the cached data the app relies on to work offline.
     */
    try {
      await router.invalidate();
    } finally {
      setRetrying(false);
    }
    reset();
  };

  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <TriangleAlert className="text-destructive size-6" aria-hidden />
      <h2 className="text-base font-semibold">{t('title')}</h2>
      <p className="text-muted-foreground max-w-xs text-sm">{t('description')}</p>
      <Button variant="outline" disabled={retrying} onClick={() => void retry()}>
        {t('retry')}
      </Button>
    </div>
  );
}
