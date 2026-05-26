import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'reportSighting';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Report sighting',
  back: 'Back',
  line: 'Line',
  optional: 'Optional',
  all: 'All',
  subway: 'U-Bahn',
  light_rail: 'S-Bahn',
  tram: 'Tram',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Sichtung melden',
  back: 'Zurück',
  line: 'Linie',
  optional: 'Optional',
  all: 'Alle',
  subway: 'U-Bahn',
  light_rail: 'S-Bahn',
  tram: 'Tram',
});
