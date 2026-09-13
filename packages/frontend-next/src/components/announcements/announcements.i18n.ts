import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'announcements';

// Announcement text is not here: each announcement ships one markdown file per language
// (src/content/announcements/<slug>.<lang>.md).
i18n.addResourceBundle('en', NAMESPACE, {
  title: 'What’s new',
  open: 'Open what’s new',
  markRead: 'Mark as read',
  markAllRead: 'Mark all as read',
  unread: 'Unread',
  empty: 'Nothing new right now.',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Neuigkeiten',
  open: 'Neuigkeiten öffnen',
  markRead: 'Als gelesen markieren',
  markAllRead: 'Alle als gelesen markieren',
  unread: 'Ungelesen',
  empty: 'Zurzeit nichts Neues.',
});
