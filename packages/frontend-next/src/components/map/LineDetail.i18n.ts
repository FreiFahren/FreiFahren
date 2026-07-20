import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'lineDetail';

i18n.addResourceBundle('en', NAMESPACE, {
  close: 'Close',
  typical: 'Typical {{weekday}} · this line',
  typicalCity: 'Typical {{weekday}} · {{city}}',
  today: '{{count}} time today',
  today_other: '{{count}} times today',
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
  today: '{{count}} Mal heute',
  today_other: '{{count}} Mal heute',
  peak: 'Höchststand {{hour}}:00 Uhr',
  quietAfter: 'meist ruhig nach {{hour}}:00 Uhr',
  usualHotspots: 'Typische Hotspots',
  quieterStations_one: '{{count}} ruhigere Station',
  quieterStations_other: '{{count}} ruhigere Stationen',
  noHotspots: 'Noch keine Meldungen',
  reportSighting: 'Sichtung auf der {{line}} melden',
  chartLabel: 'Meldungen nach Stunde an einem typischen {{weekday}}',
});
