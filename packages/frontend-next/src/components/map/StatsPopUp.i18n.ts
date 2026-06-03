import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'statsPopUp';

i18n.addResourceBundle('en', NAMESPACE, {
  reports: 'reports',
  todayInBerlin: 'today in Berlin',
  over: 'Over',
  reporters: 'reporters',
  inBerlin: 'in Berlin',
});

i18n.addResourceBundle('de', NAMESPACE, {
  reports: 'Meldungen',
  todayInBerlin: 'heute in Berlin',
  over: 'Über',
  reporters: 'Meldende',
  inBerlin: 'in Berlin',
});
