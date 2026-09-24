import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'announcements';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'News',
  open: 'Open news',
  openUnread: 'Open news, unread items',
  markAllRead: 'Mark all read',
  markRead: 'Mark as read',
  unread: 'Unread',
  empty: 'No news yet.',
  error: "Couldn't load news.",
  retry: 'Try again',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Neuigkeiten',
  open: 'Neuigkeiten öffnen',
  openUnread: 'Neuigkeiten öffnen, ungelesene Einträge',
  markAllRead: 'Alle gelesen',
  markRead: 'Als gelesen markieren',
  unread: 'Ungelesen',
  empty: 'Noch keine Neuigkeiten.',
  error: 'Neuigkeiten konnten nicht geladen werden.',
  retry: 'Erneut versuchen',
});
