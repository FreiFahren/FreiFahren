import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'reportsOverviewButton';

i18n.addResourceBundle('en', NAMESPACE, {
  lastHour: 'Reports · last 1 h',
});

i18n.addResourceBundle('de', NAMESPACE, {
  lastHour: 'Meldungen · letzte Std.',
});
