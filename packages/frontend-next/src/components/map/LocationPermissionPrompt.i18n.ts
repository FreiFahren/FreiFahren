import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'locationPermission';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Show your location?',
  description: 'FreiFahren can show where you are on the map to help you find nearby stations.',
  allow: 'Allow',
  notNow: 'Not now',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Deinen Standort anzeigen?',
  description:
    'FreiFahren kann deinen Standort auf der Karte anzeigen, damit du Stationen in der Nähe findest.',
  allow: 'Erlauben',
  notNow: 'Jetzt nicht',
});
