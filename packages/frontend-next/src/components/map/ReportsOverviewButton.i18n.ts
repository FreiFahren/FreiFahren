import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'reportsOverviewButton';

// The count is of reports still live on the map, not of everything reported in the last hour, so
// the label says "current" rather than naming a time window it no longer matches.
i18n.addResourceBundle('en', NAMESPACE, {
  currentReports: 'Current reports',
});

i18n.addResourceBundle('de', NAMESPACE, {
  currentReports: 'Aktuelle Meldungen',
});
