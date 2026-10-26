import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'pageHeader';

i18n.addResourceBundle('en', NAMESPACE, {
  back: 'Back',
  map: 'Map',
  breadcrumb: 'Breadcrumb',
});

i18n.addResourceBundle('de', NAMESPACE, {
  back: 'Zurück',
  map: 'Karte',
  breadcrumb: 'Brotkrümelnavigation',
});
