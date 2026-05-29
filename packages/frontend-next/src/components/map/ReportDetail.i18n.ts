import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'reportDetail';

i18n.addResourceBundle('en', NAMESPACE, {
  close: 'Close',
  now: 'Just now',
  minutesAgo: '{{count}} min ago',
  moreThan45Min: 'More than 45 min ago',
  hoursAgo_one: '1 hour ago',
  hoursAgo_other: '{{count}} hours ago',
  times: 'times',
  thisWeek: 'this week',
  inviteText: 'Data may be inaccurate.',
  syncText: 'Reports synced with {{group}}',
});

i18n.addResourceBundle('de', NAMESPACE, {
  close: 'Schließen',
  now: 'Gerade eben',
  minutesAgo: 'vor {{count}} min',
  moreThan45Min: 'Vor mehr als 45 min',
  hoursAgo_one: 'vor 1 Stunde',
  hoursAgo_other: 'vor {{count}} Stunden',
  times: 'mal',
  thisWeek: 'diese Woche',
  inviteText: 'Daten vielleicht ungenau.',
  syncText: 'Meldungen mit {{group}} synchronisiert',
});
