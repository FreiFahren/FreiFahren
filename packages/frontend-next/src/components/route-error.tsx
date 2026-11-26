import type { ErrorComponentProps } from '@tanstack/react-router';
import { TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatch, useNavigate, useRouter } from '@tanstack/react-router';

import { queryClient } from '@/api/queryClient';
import { Button } from '@freifahren/ui/button';
import { cn } from '@freifahren/ui/cn';
import { PopupCard } from '@/components/map/PopupCard';
import { captureException } from '@/lib/error-monitoring';

import { NAMESPACE } from './route-error.i18n';

/** Shown in place of a route that threw while rendering, so one broken page doesn't blank the app. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation(NAMESPACE);
  const router = useRouter();
  const navigate = useNavigate();
  // The map is a fixed full-screen layer, so an error rendered in place on a map page sits behind it
  // and is never seen. Map pages open as a popup card above the map, so the error does the same.
  const onMap = useMatch({ from: '/_map', shouldThrow: false }) !== undefined;

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
     *
     * Whatever broke this route usually broke other requests too (e.g. the map's lines during an
     * outage), and nothing retries those on its own. Re-request every failed query in the
     * background so they recover with this retry, without making the retry wait for them.
     */
    void queryClient.refetchQueries({ predicate: (query) => query.state.status === 'error' });
    try {
      await router.invalidate();
    } finally {
      setRetrying(false);
    }
    reset();
  };

  const content = (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 px-6 text-center', onMap ? 'py-4' : 'py-12')}
    >
      <TriangleAlert className="text-destructive size-6" aria-hidden />
      <h2 className="text-base font-semibold">{t('title')}</h2>
      <p className="text-muted-foreground max-w-xs text-sm">{t('description')}</p>
      <Button variant="outline" disabled={retrying} onClick={() => void retry()}>
        {t('retry')}
      </Button>
    </div>
  );

  if (!onMap) return content;
  return (
    <PopupCard onClose={() => navigate({ to: '/' })} closeLabel={t('close')}>
      {content}
    </PopupCard>
  );
}
