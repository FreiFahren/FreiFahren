import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'settings';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Settings',
  open: 'Open settings',
  close: 'Close',
  // hub menu
  contact: 'Contact us',
  contribute: 'Contribute',
  follow: 'Follow',
  // legal
  imprint: 'Imprint',
  privacy: 'Privacy',
  terms: 'Terms of Use',
  analytics: 'Analytics',
  // contact sheet
  aboutTitle: 'About us',
  about1:
    'FreiFahren is a non-commercial, open-source project with the goal of making public transport more accessible. We are always open to new contributors on our GitHub.',
  about2:
    'Most reports come from the FreiFahren_BE Telegram group. Many thanks to the admins for letting our Telegram bot extract the relevant information.',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Einstellungen',
  open: 'Einstellungen öffnen',
  close: 'Schließen',
  // hub menu
  contact: 'Kontaktiere uns',
  contribute: 'Beitrag leisten',
  follow: 'Folgen',
  // legal
  imprint: 'Impressum',
  privacy: 'Datenschutz',
  terms: 'Nutzungsbedingungen',
  analytics: 'Analyse',
  // contact sheet
  aboutTitle: 'Über uns',
  about1:
    'FreiFahren ist ein nicht-kommerzielles Open-Source-Projekt, das sich zum Ziel gesetzt hat, den Zugang zum öffentlichen Nahverkehr zu erleichtern. Wir sind stets offen für neue Mithelfende auf unserem GitHub.',
  about2:
    'Ein Großteil der Meldungen stammt aus der FreiFahren_BE Telegram-Gruppe. Vielen Dank an die Admins, dass wir mit unserem Telegram Bot die relevanten Informationen extrahieren dürfen.',
});
