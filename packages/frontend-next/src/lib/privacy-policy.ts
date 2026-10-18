import { i18n } from '@/lib/i18n';

// Hosted on the association's website so a single policy covers the website, the app and the
// Telegram bot. German is the binding version; every other language gets the English translation.
const GERMAN_PRIVACY_URL = 'https://freifahren.org/datenschutz';
const ENGLISH_PRIVACY_URL = 'https://freifahren.org/en/privacy';

// Same reasoning as the privacy policy: one legal notice on the website covers every service.
const GERMAN_IMPRINT_URL = 'https://freifahren.org/impressum';
const ENGLISH_IMPRINT_URL = 'https://freifahren.org/en/imprint';

export const privacyPolicyUrl = (language: string | undefined = i18n.resolvedLanguage): string =>
  language === 'de' ? GERMAN_PRIVACY_URL : ENGLISH_PRIVACY_URL;

export const imprintUrl = (language: string | undefined = i18n.resolvedLanguage): string =>
  language === 'de' ? GERMAN_IMPRINT_URL : ENGLISH_IMPRINT_URL;
