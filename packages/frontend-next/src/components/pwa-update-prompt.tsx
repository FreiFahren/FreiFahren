import { RefreshCw, X } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import { PopupCard } from '@/components/map/PopupCard';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import { applyPwaUpdate, hasPwaUpdateAvailable, subscribePwaUpdate } from '@/lib/pwa-update';

import { NAMESPACE } from './pwa-update-prompt.i18n';

export function PwaUpdatePrompt() {
  const { t } = useTranslation(NAMESPACE);
  const updateAvailable = useSyncExternalStore(
    subscribePwaUpdate,
    hasPwaUpdateAvailable,
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const visible = updateAvailable && !dismissed;

  if (!visible) return null;

  return (
    <div role="status" aria-live="polite">
      <PopupCard cardClassName="gap-3 py-3">
        <CardContent className="flex items-start gap-3">
          <RefreshCw className="text-accent-bright size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t('title')}</p>
            <p className="text-muted-foreground text-xs">{t('text')}</p>
          </div>
        </CardContent>
        <CardFooter className="justify-between gap-2">
          <Button
            size="xs"
            aria-label={t('refresh')}
            disabled={updating}
            onClick={() => {
              setUpdating(true);
              void applyPwaUpdate().catch(() => setUpdating(false));
            }}
          >
            {updating ? <RefreshCw className="animate-spin" /> : t('refresh')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('dismiss')}
            disabled={updating}
            onClick={() => setDismissed(true)}
          >
            <X />
          </Button>
        </CardFooter>
      </PopupCard>
    </div>
  );
}
