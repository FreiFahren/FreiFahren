import type { ErrorComponentProps } from '@tanstack/react-router';
import { TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { queryClient } from '@/api/queryClient';
import { Button } from '@freifahren/ui/button';
import { captureException } from '@/lib/error-monitoring';

import { NAMESPACE } from './route-error.i18n';

/** Shown in place of a route that threw while rendering, so one broken page doesn't blank the app. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation(NAMESPACE);

  useEffect(() => {
    captureException(error);
  }, [error]);

  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    /*
     * The usual cause is a response the cache kept from before an API change, so re-rendering
     * straight away would crash again. Refetching first replaces it, while a failed refetch (e.g.
     * offline) keeps the cached data the app relies on to work without a connection.
     */
    await queryClient.refetchQueries({ type: 'all' }, { throwOnError: false });
    setRetrying(false);
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
