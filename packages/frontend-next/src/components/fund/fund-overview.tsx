import { useTranslation } from 'react-i18next';

import { NAMESPACE } from './fund.i18n';

export function FundOverview() {
  const { t } = useTranslation(NAMESPACE);
  return <p className="text-muted-foreground text-sm">{t('intro')}</p>;
}
