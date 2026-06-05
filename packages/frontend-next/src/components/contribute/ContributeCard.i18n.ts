import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'contribute';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Thanks for being part of this.',
  description: 'Want to contribute more to the mission? Then feel free to support us here:',
  close: 'Close',
  tabStripe: 'Card',
  tabBank: 'Bank Transfer',
  support: 'Support us',
  stripeNote: "You'll be securely redirected to Stripe to complete your contribution.",
  bankHolder: 'Account holder',
  bankReference: 'Reference',
  bankReferenceValue: 'Contribution FreiFahren',
  copy: 'Copy',
  copied: 'Copied',
  dismiss: "Don't show again",
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Danke, dass du dabei bist.',
  description: 'Magst du mehr der Mission beitragen? Dann unterstütze uns doch gerne hier:',
  close: 'Schließen',
  tabStripe: 'Karte',
  tabBank: 'Banküberweisung',
  support: 'Unterstützen',
  stripeNote: 'Du wirst sicher zu Stripe weitergeleitet, um deinen Beitrag abzuschließen.',
  bankHolder: 'Kontoinhaber',
  bankReference: 'Verwendungszweck',
  bankReferenceValue: 'Beitrag FreiFahren',
  copy: 'Kopieren',
  copied: 'Kopiert',
  dismiss: 'Nicht wieder anzeigen',
});
