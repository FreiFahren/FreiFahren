import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'de'],
    // Without this, a detected code like 'de-DE', 'de-AT', or 'de-CH' (which most browsers and
    // iOS report instead of plain 'de') doesn't exactly match supportedLngs and silently falls
    // back to 'en' — the cause of German users landing on the English UI. This strips the region
    // before matching, so any 'de-*' resolves to 'de'.
    load: 'languageOnly',
    defaultNS: false,
    interpolation: { escapeValue: false },
    detection: {
      // Keep detection to what this app actually uses: a persisted user choice (mirrored via
      // lib/language.ts) or the device/browser locale. No querystring/cookie lookup — this app
      // has no `?lng=` entry point and no cookie-consent story for one.
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

const syncHtmlLang = (lng: string) => {
  document.documentElement.lang = lng;
};

syncHtmlLang(i18n.resolvedLanguage ?? 'en');
i18n.on('languageChanged', syncHtmlLang);

export { i18n };
