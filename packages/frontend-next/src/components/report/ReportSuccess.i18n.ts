import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'reportSuccess';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Thank you for your report!',
  description: 'people appreciate your help',
  feedbackHeading: 'Got a moment? Tell us what you think',
  syncText: 'Your report was synced with @FreiFahren_BE',
  continue: 'Continue',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Danke für deine Meldung!',
  description: 'Menschen schätzen deine Hilfe',
  feedbackHeading: 'Hast du kurz Zeit? Sag uns deine Meinung',
  syncText: 'Deine Meldung wurde mit @FreiFahren_BE synchronisiert.',
  continue: 'Weiter',
});
