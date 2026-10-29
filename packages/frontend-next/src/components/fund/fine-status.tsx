import { Check, Clock3, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Fine } from '@/lib/fund-api';

import { FundHistoryStatus } from './fund-history-status';
import { NAMESPACE } from './fund.i18n';

const STATUS_STYLES = {
  in_review: { icon: Clock3, color: 'text-muted-foreground' },
  paid: { icon: Check, color: 'text-ok' },
  declined: { icon: X, color: 'text-destructive' },
};

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
  const { icon, color } = STATUS_STYLES[status];
  return (
    <FundHistoryStatus
      icon={icon}
      iconClassName={color}
      label={t(`fineStatus.${status}`)}
      paidAt={status === 'paid' ? paidAt : null}
      showTime={showTime}
      descriptionId={descriptionId}
    />
  );
}
