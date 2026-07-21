import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'lineDetail';

i18n.addResourceBundle('en', NAMESPACE, {
  close: 'Close',
  typical: 'Typical {{weekday}} · this line',
  typicalCity: 'Typical {{weekday}} · {{city}}',
  currentActivity: 'Current activity',
  reportsLast24Hours_one: '{{count}} report · last 24h',
  reportsLast24Hours_other: '{{count}} reports · last 24h',
  reportsInLastHour_one: '{{count}} in the last hour',
  reportsInLastHour_other: '{{count}} in the last hour',
  noneInLastHour: 'None in the last hour',
  reportedSightings: 'Reported sightings',
  peak: 'peak {{hour}}:00',
  quietAfter: 'usually quiet after {{hour}}:00',
  usualHotspots: 'Usual hotspots',
  quieterStations_one: '{{count}} quieter station',
  quieterStations_other: '{{count}} quieter stations',
  noHotspots: 'No reports yet',
  reportSighting: 'Report sighting on the {{line}}',
  chartLabel: 'Reports by hour for a typical {{weekday}}',
});

i18n.addResourceBundle('de', NAMESPACE, {
  close: 'Schließen',
  typical: 'Typischer {{weekday}} · diese Linie',
  typicalCity: 'Typischer {{weekday}} · {{city}}',
  currentActivity: 'Aktuelle Aktivität',
  reportsLast24Hours_one: '{{count}} Meldung · letzte 24 Std.',
  reportsLast24Hours_other: '{{count}} Meldungen · letzte 24 Std.',
  reportsInLastHour_one: '{{count}} in der letzten Stunde',
  reportsInLastHour_other: '{{count}} in der letzten Stunde',
  noneInLastHour: 'Keine in der letzten Stunde',
  reportedSightings: 'Gemeldete Sichtungen',
  peak: 'Höchststand {{hour}}:00 Uhr',
  quietAfter: 'meist ruhig nach {{hour}}:00 Uhr',
  usualHotspots: 'Typische Hotspots',
  quieterStations_one: '{{count}} ruhigere Station',
  quieterStations_other: '{{count}} ruhigere Stationen',
  noHotspots: 'Noch keine Meldungen',
  reportSighting: 'Sichtung auf der {{line}} melden',
  chartLabel: 'Meldungen nach Stunde an einem typischen {{weekday}}',
});
