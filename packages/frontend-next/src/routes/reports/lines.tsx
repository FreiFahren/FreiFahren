import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { NAMESPACE } from '@/components/reports/Reports.i18n';

export const Route = createFileRoute('/reports/lines')({
  component: ReportsLines,
});

function ReportsLines() {
  const { t } = useTranslation(NAMESPACE);
  return <p className="text-muted-foreground px-4 py-6 text-sm">{t('comingSoon')}</p>;
}
