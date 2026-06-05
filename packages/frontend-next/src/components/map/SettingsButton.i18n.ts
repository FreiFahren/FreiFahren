import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'settings';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Settings',
  open: 'Open settings',
  close: 'Close',
  placeholder: 'More settings coming soon.',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Einstellungen',
  open: 'Einstellungen öffnen',
  close: 'Schließen',
  placeholder: 'Weitere Einstellungen folgen bald.',
});
