import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'centerOnUser';

i18n.addResourceBundle('en', NAMESPACE, {
  center: 'Center map on your location',
});

i18n.addResourceBundle('de', NAMESPACE, {
  center: 'Karte auf deinen Standort zentrieren',
});
