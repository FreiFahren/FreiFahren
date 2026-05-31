import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { NAMESPACE } from '@/components/reports/Reports.i18n';

export const Route = createFileRoute('/_map/reports/_overview/')({
  component: ReportsSummary,
});

function ReportsSummary() {
  const { t } = useTranslation(NAMESPACE);
  return <p className="text-muted-foreground px-4 py-6 text-sm">{t('comingSoon')}</p>;
}
