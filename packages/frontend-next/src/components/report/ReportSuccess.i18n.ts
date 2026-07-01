import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'reportSuccess';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Thank you for your report!',
  description: 'people appreciate your help',
  sentimentPrompt: 'Do you like FreiFahren?',
  sentimentYes: 'Yes, I like it',
  sentimentNo: 'No, not really',
  syncText: 'Your report was synced with @FreiFahren_BE',
  continue: 'Continue',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Danke für deine Meldung!',
  description: 'Menschen schätzen deine Hilfe',
  sentimentPrompt: 'Gefällt dir FreiFahren?',
  sentimentYes: 'Ja, gefällt mir',
  sentimentNo: 'Nein, eher nicht',
  syncText: 'Deine Meldung wurde mit @FreiFahren_BE synchronisiert.',
  continue: 'Weiter',
});
