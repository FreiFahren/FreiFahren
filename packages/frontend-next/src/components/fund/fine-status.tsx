import { Check, Clock3, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Fine } from '@/lib/fund-api';

import { FundHistoryStatus } from './fund-history-status';
import { NAMESPACE } from './fund.i18n';

const STATUS_STYLES = {
  in_review: { icon: Clock3, color: 'text-muted-foreground', label: 'in_review' },
  payment_sent: { icon: Check, color: 'text-ok', label: 'payment_sent' },
  settled: { icon: Check, color: 'text-ok', label: 'payment_sent' },
  declined: { icon: X, color: 'text-destructive', label: 'declined' },
} as const;

export function FineStatus({
  status,
  paidAt,
  showTime,
  descriptionId,
}: {
  status: Fine['status'];
  paidAt?: string | null;
  showTime?: boolean;
  descriptionId?: string;
}) {
  const { t } = useTranslation(NAMESPACE);
  const { icon, color, label } = STATUS_STYLES[status];
  let transferDate = null;
  if (status === 'payment_sent' || status === 'settled') transferDate = paidAt;
  return (
    <FundHistoryStatus
      icon={icon}
      iconClassName={color}
      label={t(`fineStatus.${label}`)}
      paidAt={transferDate}
      showTime={showTime}
      descriptionId={descriptionId}
    />
  );
}
