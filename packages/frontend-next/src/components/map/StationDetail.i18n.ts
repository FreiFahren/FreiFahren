import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'stationDetail';

i18n.addResourceBundle('en', NAMESPACE, {
  reportSighting: 'Report sighting',
  close: 'Close',
  stationReportsLast24Hours_one: '{{count}} report · 24h',
  stationReportsLast24Hours_other: '{{count}} reports · 24h',
  lineReports: 'Line-wide · 24h',
  lineReportsLast24Hours_one: '{{count}} report',
  lineReportsLast24Hours_other: '{{count}} reports',
  inLastHour: '{{count}} in the last hour',
  showMoreLines: '{{count}} more lines',
});

i18n.addResourceBundle('de', NAMESPACE, {
  reportSighting: 'Sichtung melden',
  close: 'Schließen',
  stationReportsLast24Hours_one: '{{count}} Meldung · 24 Std.',
  stationReportsLast24Hours_other: '{{count}} Meldungen · 24 Std.',
  lineReports: 'Linienweit · 24 Std.',
  lineReportsLast24Hours_one: '{{count}} Meldung',
  lineReportsLast24Hours_other: '{{count}} Meldungen',
  inLastHour: '{{count}} in der letzten Stunde',
  showMoreLines: '{{count}} weitere Linien',
});
