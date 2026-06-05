import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'reportSuccess';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Thank you for your report!',
  description: 'people appreciate your help',
  syncText: 'Your report was synced with @FreiFahren_BE',
  continue: 'Continue',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Danke für deine Meldung!',
  description: 'Menschen schätzen deine Hilfe',
  syncText: 'Deine Meldung wurde mit @FreiFahren_BE synchronisiert.',
  continue: 'Weiter',
});
