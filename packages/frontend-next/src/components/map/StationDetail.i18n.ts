import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'stationDetail';

i18n.addResourceBundle('en', NAMESPACE, {
  reportSighting: 'Report sighting',
  close: 'Close',
  stationReportsLast24Hours_one: '{{count}} report · 24h',
  stationReportsLast24Hours_other: '{{count}} reports · 24h',
  lineReports: 'Explore a line',
  lineReportsDescription: 'See current activity, usual patterns, and hotspots.',
  lineReportsLast24Hours_one: '{{count}} report',
  lineReportsLast24Hours_other: '{{count}} reports',
  inLastHour: '{{count}} in the last hour',
  stationRank: '#{{position}} of {{population}} stations',
  stationReportsLast30Days_one: '{{count}} report · 30d',
  stationReportsLast30Days_other: '{{count}} reports · 30d',
});

i18n.addResourceBundle('de', NAMESPACE, {
  reportSighting: 'Sichtung melden',
  close: 'Schließen',
  stationReportsLast24Hours_one: '{{count}} Meldung · 24 Std.',
  stationReportsLast24Hours_other: '{{count}} Meldungen · 24 Std.',
  lineReports: 'Linie erkunden',
  lineReportsDescription: 'Aktuelle Aktivität, typische Muster und Hotspots ansehen.',
  lineReportsLast24Hours_one: '{{count}} Meldung',
  lineReportsLast24Hours_other: '{{count}} Meldungen',
  inLastHour: '{{count}} in der letzten Stunde',
  stationRank: '#{{position}} von {{population}} Stationen',
  stationReportsLast30Days_one: '{{count}} Meldung · 30 Tg.',
  stationReportsLast30Days_other: '{{count}} Meldungen · 30 Tg.',
});
