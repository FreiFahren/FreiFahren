import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'pwaUpdatePrompt';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'New version available',
  text: 'Refresh to use the latest version of FreiFahren.',
  refresh: 'Refresh',
  dismiss: 'Dismiss update notice',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Neue Version verfügbar',
  text: 'Aktualisieren Sie, um die neueste Version von FreiFahren zu verwenden.',
  refresh: 'Aktualisieren',
  dismiss: 'Hinweis schließen',
});
