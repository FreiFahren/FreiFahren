import { Check, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { riskColor, riskLevel } from '@/api/risk';
import { CardContent } from '@/components/ui/card';

import { NAMESPACE } from './StationDetail.i18n';

export function StationRiskStatus({ risk }: { risk: number }) {
  const { t } = useTranslation(NAMESPACE);
  const isClear = risk === 0;
  const Icon = isClear ? Check : TriangleAlert;
  const label = isClear
    ? t('allClear')
    : t('riskLevel', { level: t(`riskLevels.${riskLevel(risk)}`) });
  const color = riskColor(risk);

  return (
    <CardContent>
      <div
        className="flex items-center gap-2 rounded-md px-3 py-2"
        style={{ backgroundColor: `${color}26`, color }}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <p className="text-sm font-semibold">{label}</p>
      </div>
    </CardContent>
  );
}
