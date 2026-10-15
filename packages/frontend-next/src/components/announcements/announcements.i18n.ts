import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'announcements';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'News',
  open: 'Open news',
  openUnread: 'Open news, unread items',
  empty: 'No news yet.',
  notFound: 'This announcement is no longer available.',
  error: "Couldn't load news.",
  retry: 'Try again',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Neuigkeiten',
  open: 'Neuigkeiten öffnen',
  openUnread: 'Neuigkeiten öffnen, ungelesene Einträge',
  empty: 'Noch keine Neuigkeiten.',
  notFound: 'Diese Ankündigung ist nicht mehr verfügbar.',
  error: 'Neuigkeiten konnten nicht geladen werden.',
  retry: 'Erneut versuchen',
});
