import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'legalDisclaimer';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Please confirm before proceeding',
  text: 'To maintain the integrity of our community and the spirit of fair use, we ask you to confirm two important points:',
  ticket: 'I own a valid ticket for my journey.',
  ticketDescription:
    'I understand that this app is designed to improve awareness and planning in public transport, not to circumvent rules or regulations.',
  activeUsage: 'I am not actively using the app during my journey.',
  activeUsageDescription:
    'I understand that the active use of the app during my journey can disturb other passengers and violate the terms of use of the public transport operator.',
  saved: 'Your confirmation will be saved on this device.',
  confirm: 'I confirm',
  privacy: 'Privacy',
  imprint: 'Imprint',
  reviewTitle: 'Terms of Use',
  close: 'Close',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Bitte bestätigen Sie vor dem Fortfahren',
  text: 'Um die Integrität unserer Community und den Geist fairer Nutzung zu wahren, bitten wir Sie, zwei wichtige Punkte zu bestätigen:',
  ticket: 'Ich besitze ein gültiges Ticket für meine Reise.',
  ticketDescription:
    'Ich verstehe, dass diese App dazu dient, das Bewusstsein und die Planung im öffentlichen Nahverkehr zu verbessern, nicht aber um Regeln oder Vorschriften zu umgehen.',
  activeUsage: 'Ich nutze die App nicht aktiv während der Fahrt.',
  activeUsageDescription:
    'Ich verstehe, dass die aktive Nutzung der App während der Fahrt andere Fahrgäste stören und gegen die Nutzungsbedingungen des Verkehrsbetriebs verstoßen kann.',
  saved: 'Die Bestätigung wird auf diesem Gerät gespeichert.',
  confirm: 'Ich bestätige',
  privacy: 'Datenschutz',
  imprint: 'Impressum',
  reviewTitle: 'Nutzungsbedingungen',
  close: 'Schließen',
});
