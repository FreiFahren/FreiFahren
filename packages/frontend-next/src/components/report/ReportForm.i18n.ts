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
  station: 'Station',
  required: 'Required',
  searchStation: 'Search station…',
  nearby: 'Nearby',
  noMatch: 'No stations match “{{query}}”.',
  clearSelection: 'clear selection',
  direction: 'Direction',
  submit: 'Submit report',
  disclaimer: 'Shared anonymously with all Freifahren users.',
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
  station: 'Station',
  required: 'Erforderlich',
  searchStation: 'Station suchen…',
  nearby: 'In der Nähe',
  noMatch: 'Keine Station passt zu „{{query}}“.',
  clearSelection: 'Auswahl löschen',
  direction: 'Richtung',
  submit: 'Melden',
  disclaimer: 'Anonym an alle Freifahren-Nutzer geteilt.',
});
