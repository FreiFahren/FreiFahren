import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'appRemovalBanner';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'This app may leave the App Store soon',
  text: 'Apple may remove FreiFahren from the App Store in about 14 days. Use the same app on the web at app.freifahren.org to keep access.',
  cta: 'Open app.freifahren.org',
  dismiss: 'Dismiss',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Diese App könnte bald aus dem App Store verschwinden',
  text: 'Apple könnte FreiFahren in etwa 14 Tagen aus dem App Store entfernen. Nutze dieselbe App im Web unter app.freifahren.org, um weiterhin Zugriff zu haben.',
  cta: 'app.freifahren.org öffnen',
  dismiss: 'Schließen',
});
