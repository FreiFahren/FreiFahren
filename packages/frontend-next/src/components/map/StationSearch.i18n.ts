import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'stationSearch';

i18n.addResourceBundle('en', NAMESPACE, {
  placeholder: 'Search for a station...',
  clear: 'Clear search',
  noResults: 'No stations found',
});

i18n.addResourceBundle('de', NAMESPACE, {
  placeholder: 'Nach einer Station suchen...',
  clear: 'Suche leeren',
  noResults: 'Keine Stationen gefunden',
});
