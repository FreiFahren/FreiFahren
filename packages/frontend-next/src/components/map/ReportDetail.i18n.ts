import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'reportDetail';

i18n.addResourceBundle('en', NAMESPACE, {
  close: 'Close',
  openStationDetails: 'Open details for {{station}}',
  now: 'Just now',
  minutesAgo: '{{count}} min ago',
  moreThan45Min: 'More than 45 min ago',
  hoursAgo_one: '1 hour ago',
  hoursAgo_other: '{{count}} hours ago',
  times: 'times',
  thisWeek: 'this week',
  oneStationAway: 'one station away',
  stationsAway: '{{count}} stations away',
  inviteText: 'Data may be inaccurate.',
  syncText: 'Reports synced with {{group}}',
});

i18n.addResourceBundle('de', NAMESPACE, {
  close: 'Schließen',
  openStationDetails: 'Details zu {{station}} öffnen',
  now: 'Gerade eben',
  minutesAgo: 'vor {{count}} min',
  moreThan45Min: 'Vor mehr als 45 min',
  hoursAgo_one: 'vor 1 Stunde',
  hoursAgo_other: 'vor {{count}} Stunden',
  times: 'mal',
  thisWeek: 'diese Woche',
  oneStationAway: 'eine Station entfernt',
  stationsAway: '{{count}} Stationen entfernt',
  inviteText: 'Daten vielleicht ungenau.',
  syncText: 'Meldungen mit {{group}} synchronisiert',
});
