import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'appBanner';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'FreiFahren',
  text: 'Faster and offline-ready in the app.',
  open: 'Open in App Store',
  dismiss: 'Dismiss',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'FreiFahren',
  text: 'Schneller und offline-fähig in der App.',
  open: 'Im App Store öffnen',
  dismiss: 'Schließen',
});
