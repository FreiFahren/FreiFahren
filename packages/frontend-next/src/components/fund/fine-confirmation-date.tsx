import { useTranslation } from 'react-i18next';

import type { FineConfirmation } from '@/lib/fund-api';

import { NAMESPACE } from './fund.i18n';

export function FineConfirmationDate({
  confirmation,
  showTime = false,
}: {
  confirmation: FineConfirmation;
  showTime?: boolean;
}) {
  const { t, i18n } = useTranslation(NAMESPACE);
  let label = 'settlementChecked';
  if (confirmation.source === 'manual') label = 'settlementManuallyChecked';
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' };
  if (showTime) options.timeStyle = 'short';
  const date = new Intl.DateTimeFormat(i18n.language, options).format(
    new Date(confirmation.confirmedAt),
  );
  return <p className="text-muted-foreground text-xs">{t(label, { date })}</p>;
}
