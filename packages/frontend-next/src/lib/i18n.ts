import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'de'],
  defaultNS: false,
  interpolation: { escapeValue: false },
});

export { i18n };
