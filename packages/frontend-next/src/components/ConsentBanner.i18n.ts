import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'consentBanner';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Help us improve FreiFahren',
  text: 'We use privacy-friendly analytics (PostHog, hosted in the EU) to make the app better. Unless you allow cookies, we only collect cookieless usage statistics, and analytics stores nothing on your device. If you allow cookies, a pseudonymous ID is stored on your device so we can recognize your return visits. We never sell your data or use it for ads. You can change this anytime in Settings.',
  accept: 'Allow cookies',
  decline: 'Decline cookies',
  privacy: 'Privacy Policy',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Hilf uns, FreiFahren zu verbessern',
  text: 'Wir verwenden datenschutzfreundliche Analyse (PostHog, in der EU gehostet), um die App zu verbessern. Solange Sie Cookies nicht erlauben, erfassen wir nur cookielose Nutzungsstatistiken; die Analyse speichert dann nichts auf Ihrem Gerät. Erlauben Sie Cookies, wird eine pseudonyme Kennung auf Ihrem Gerät gespeichert, damit wir wiederkehrende Besuche erkennen können. Wir verkaufen keine Daten und nutzen sie nicht für Werbung. Sie können diese Auswahl jederzeit in den Einstellungen ändern.',
  accept: 'Cookies erlauben',
  decline: 'Cookies ablehnen',
  privacy: 'Datenschutz',
});
