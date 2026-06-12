import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'consentBanner';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Help us improve FreiFahren',
  text: 'We use privacy-friendly analytics (PostHog, hosted in the EU) to make the app better. Allow cookies and we can recognize your return visits; decline and we collect only anonymous, cookieless usage statistics - nothing is stored on your device. We never sell your data or use it for ads. You can change this anytime in Settings.',
  accept: 'Allow cookies',
  decline: 'Decline cookies',
  privacy: 'Privacy Policy',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Hilf uns, FreiFahren zu verbessern',
  text: 'Wir verwenden datenschutzfreundliche Analyse (PostHog, in der EU gehostet), um die App zu verbessern. Erlauben Sie Cookies, können wir wiederkehrende Besuche erkennen; lehnen Sie ab, erfassen wir nur anonyme, cookielose Nutzungsstatistiken - es wird nichts auf Ihrem Gerät gespeichert. Wir verkaufen keine Daten und nutzen sie nicht für Werbung. Sie können diese Auswahl jederzeit in den Einstellungen ändern.',
  accept: 'Cookies erlauben',
  decline: 'Cookies ablehnen',
  privacy: 'Datenschutz',
});
