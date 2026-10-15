import { Link } from '@tanstack/react-router';
import { HeartHandshake } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { NAMESPACE } from '@/components/fund/fund.i18n';
import { Button } from '@/components/ui/button';
import { FEATURE_FLAGS, useFeatureFlag } from '@/lib/feature-flags';
import { Route as FundRoute } from '@/routes/fund/index';

export function FundButton() {
  const { t } = useTranslation(NAMESPACE);
  const enabled = useFeatureFlag(FEATURE_FLAGS.fund);
  if (!enabled) return null;

  return (
    <Button
      asChild
      variant="secondary"
      size="icon"
      aria-label={t('open')}
      className="bg-card text-foreground hover:bg-card/80 pointer-events-auto size-11 rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.28)]"
    >
      <Link to={FundRoute.to}>
        <HeartHandshake className="size-5" />
      </Link>
    </Button>
  );
}
