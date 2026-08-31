import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'cityLocationPrompt';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Switch to {{city}}?',
  description:
    'Your location looks like you are in {{city}}. FreiFahren shows reports for one city at a time.',
  switch: 'Switch',
  stay: 'Stay here',
  remember: 'Remember this choice',
  expansionTitle: 'Want FreiFahren in your city?',
  expansionDescription:
    'You are outside the cities FreiFahren currently covers. Would you like FreiFahren where you live?',
  expansionCta: 'Yes, tell me more',
  expansionStay: 'Not now',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Zu {{city}} wechseln?',
  description:
    'Du bist laut deinem Standort in {{city}}. FreiFahren zeigt Meldungen jeweils für eine Stadt.',
  switch: 'Wechseln',
  stay: 'Hier bleiben',
  remember: 'Diese Auswahl merken',
  expansionTitle: 'FreiFahren auch in deiner Stadt?',
  expansionDescription:
    'Du bist außerhalb der Städte, die FreiFahren gerade abdeckt. Möchtest du FreiFahren auch bei dir haben?',
  expansionCta: 'Ja, mehr erfahren',
  expansionStay: 'Nicht jetzt',
});
