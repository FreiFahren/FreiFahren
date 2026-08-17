import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'statsPopUp';

i18n.addResourceBundle('en', NAMESPACE, {
  reports: 'reports',
  todayInCity: 'today in {{city}}',
  over: 'Over',
  reporters: 'reporters',
  inCity: 'in {{city}}',
});

i18n.addResourceBundle('de', NAMESPACE, {
  reports: 'Meldungen',
  todayInCity: 'heute in {{city}}',
  over: 'Über',
  reporters: 'Meldende',
  inCity: 'in {{city}}',
});
