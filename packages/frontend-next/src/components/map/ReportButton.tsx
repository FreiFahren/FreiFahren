import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { track } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Route as ReportRoute } from '@/routes/report';

import { NAMESPACE } from './ReportButton.i18n';

export function ReportButton() {
  const { t } = useTranslation(NAMESPACE);

  return (
    <div className="pointer-events-none fixed right-0 bottom-0 z-20 p-3">
      <Button
        asChild
        size="lg"
        className="bg-accent-bright text-primary-foreground hover:bg-accent-press pointer-events-auto h-14 gap-2.5 rounded-lg px-6 text-base shadow-[0_6px_16px_rgba(214,59,59,0.28)] [&_svg:not([class*='size-'])]:size-6"
      >
        <Link to={ReportRoute.to} onClick={() => track('report_started', { source: 'fab' })}>
          {t('report')}
          <Plus data-icon="inline-end" />
        </Link>
      </Button>
    </div>
  );
}
