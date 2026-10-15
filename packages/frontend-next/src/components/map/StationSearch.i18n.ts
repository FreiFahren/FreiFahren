import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'stationSearch';

i18n.addResourceBundle('en', NAMESPACE, {
  placeholder: 'Search for a station or line...',
  clear: 'Clear search',
  noResults: 'No stations or lines found',
  openLine: 'Open line {{name}}',
  circularLine: 'Circular line',
});

i18n.addResourceBundle('de', NAMESPACE, {
  placeholder: 'Nach Station oder Linie suchen...',
  clear: 'Suche leeren',
  noResults: 'Keine Stationen oder Linien gefunden',
  openLine: 'Linie {{name}} öffnen',
  circularLine: 'Ringlinie',
});
