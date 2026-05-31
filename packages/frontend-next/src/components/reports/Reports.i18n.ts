import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'reports';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Reports',
  summaryCount: 'reports · last 24 h',
  tabSummary: 'Summary',
  tabLines: 'Lines',
  tabReports: 'Reports',
  sectionReports: 'Reports · 24 h',
  comingSoon: 'Coming soon.',
  direction: 'Towards {{name}}',
  now: 'just now',
  minutesAgo: '{{count}} min ago',
  moreThan45Min: 'over 45 min ago',
  hoursAgo: '{{count}} h ago',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Meldungen',
  summaryCount: 'Meldungen · letzte 24 Std.',
  tabSummary: 'Übersicht',
  tabLines: 'Linien',
  tabReports: 'Meldungen',
  sectionReports: 'Meldungen · 24 Std.',
  comingSoon: 'Demnächst verfügbar.',
  direction: 'Richtung: {{name}}',
  now: 'gerade eben',
  minutesAgo: 'vor {{count}} Min.',
  moreThan45Min: 'vor über 45 Min.',
  hoursAgo: 'vor {{count}} Std.',
});
