import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'languageSwitcher';

i18n.addResourceBundle('en', NAMESPACE, {
  language: 'Language',
  label: 'Switch language',
  auto: 'Auto',
  en: 'English',
  de: 'German',
});

i18n.addResourceBundle('de', NAMESPACE, {
  language: 'Sprache',
  label: 'Sprache wechseln',
  auto: 'Automatisch',
  en: 'Englisch',
  de: 'Deutsch',
});
