import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

import { SECONDARY_BUTTON } from './account-layout';
import { NAMESPACE } from './account.i18n';

export function SessionLoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <div className="flex flex-col gap-4">
      <p role="alert" className="text-destructive text-sm">
        {t('sessionLoadFailed')}
      </p>
      <Button variant="secondary" size="lg" onClick={onRetry} className={SECONDARY_BUTTON}>
        {t('retry')}
      </Button>
    </div>
  );
}
