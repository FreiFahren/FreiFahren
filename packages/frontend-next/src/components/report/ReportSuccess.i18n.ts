import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'reportSuccess';

i18n.addResourceBundle('en', NAMESPACE, {
  description: 'people appreciate your help',
  sentimentPrompt: 'Do you like FreiFahren?',
  sentimentYes: 'Yes, I like it',
  sentimentNo: 'No, not really',
  syncText: 'Your report was synced with {{handle}}',
  title: 'Report sent',
  sentBody: 'Your report was received. Thank you for helping others.',
  localTitle: 'Saved on this device',
  localBody:
    'We could not confirm delivery. This report is saved on your device, but has not been confirmed as shared with others.',
  backToMap: 'Back to map',
});

i18n.addResourceBundle('de', NAMESPACE, {
  description: 'Menschen schätzen deine Hilfe',
  sentimentPrompt: 'Gefällt dir FreiFahren?',
  sentimentYes: 'Ja, gefällt mir',
  sentimentNo: 'Nein, eher nicht',
  syncText: 'Deine Meldung wurde mit {{handle}} synchronisiert.',
  title: 'Meldung gesendet',
  sentBody: 'Deine Meldung wurde empfangen. Danke, dass du anderen hilfst.',
  localTitle: 'Auf diesem Gerät gespeichert',
  localBody:
    'Wir konnten den Empfang nicht bestätigen. Die Meldung ist auf deinem Gerät gespeichert; das Teilen mit anderen wurde nicht bestätigt.',
  backToMap: 'Zur Karte',
});
