import { i18n } from '@/lib/i18n';

// Hosted on the association's website so a single policy covers the website, the app and the
// Telegram bot. German is the binding version; every other language gets the English translation.
const GERMAN_URL = 'https://freifahren.org/datenschutz';
const ENGLISH_URL = 'https://freifahren.org/en/privacy';

export const privacyPolicyUrl = (language: string | undefined = i18n.resolvedLanguage): string =>
  language === 'de' ? GERMAN_URL : ENGLISH_URL;
