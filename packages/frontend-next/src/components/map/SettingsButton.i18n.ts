import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'settings';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Settings',
  open: 'Open settings',
  close: 'Close',
  // hub menu
  contact: 'Contact us',
  feedback: 'Send feedback',
  contribute: 'Contribute',
  follow: 'Follow',
  // legal
  association: 'Mission',
  imprint: 'Imprint',
  privacy: 'Privacy',
  terms: 'Terms of Use',
  analytics: 'Analytics',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Einstellungen',
  open: 'Einstellungen öffnen',
  close: 'Schließen',
  // hub menu
  contact: 'Kontaktiere uns',
  feedback: 'Feedback geben',
  contribute: 'Beitrag leisten',
  follow: 'Folgen',
  // legal
  association: 'Mission',
  imprint: 'Impressum',
  privacy: 'Datenschutz',
  terms: 'Nutzungsbedingungen',
  analytics: 'Analyse',
});
