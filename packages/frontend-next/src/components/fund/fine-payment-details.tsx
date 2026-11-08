import { useTranslation } from 'react-i18next';

import type { Fine } from '@/lib/fund-api';

import { FineStatus } from './fine-status';
import { FineConfirmationDate } from './fine-confirmation-date';
import { TransferReceipt } from './transfer-receipt';
import { NAMESPACE } from './fund.i18n';

export function FinePaymentDetails({ fine }: { fine: Fine }) {
  const { t } = useTranslation(NAMESPACE);
  const { status, paidAt, confirmation, transfer } = fine;
  const confirmed = status === 'settled';
  const unverified = status === 'payment_sent' && transfer?.verificationAvailable === false;
  return (
    <div className="space-y-1">
      <FineStatus status={status} paidAt={paidAt} showTime />
      {confirmed && confirmation && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p>{t('fineStatus.settled')}</p>
          <FineConfirmationDate confirmation={confirmation} showTime />
        </div>
      )}
      {unverified && <p className="text-muted-foreground text-xs">{t('transferUnverifiable')}</p>}
      {transfer?.receiptPath && <TransferReceipt path={transfer.receiptPath} />}
      {confirmed && confirmation?.verificationUrl && (
        <div className="space-y-1">
          <a
            className="ph-no-capture ph-mask text-sm underline underline-offset-4"
            href={confirmation.verificationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('settlementLink', { provider: confirmation.providerLabel })}
          </a>
          <p className="text-muted-foreground text-xs">{t('settlementLinkExpiry')}</p>
        </div>
      )}
    </div>
  );
}
