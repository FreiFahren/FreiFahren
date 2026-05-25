import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Route as ReportRoute } from '@/routes/report';

import { NAMESPACE } from './ReportButton.i18n';

export function ReportButton() {
  const { t } = useTranslation(NAMESPACE);

  return (
    <div className="pointer-events-none fixed right-0 bottom-8 z-20 p-3">
      <Button
        asChild
        size="lg"
        className="bg-accent-bright text-primary-foreground hover:bg-accent-press pointer-events-auto h-12 gap-2 rounded-lg px-5 text-sm [&_svg:not([class*='size-'])]:size-5"
      >
        <Link to={ReportRoute.to}>
          {t('report')}
          <Plus data-icon="inline-end" />
        </Link>
      </Button>
    </div>
  );
}
