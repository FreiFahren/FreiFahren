import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

import { NAMESPACE } from './announcements.i18n';

export function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation(NAMESPACE);
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <p className="text-muted-foreground text-sm">{t('error')}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {t('retry')}
      </Button>
    </div>
  );
}
