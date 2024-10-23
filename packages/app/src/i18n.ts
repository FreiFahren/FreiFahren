import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import de from "../assets/locales/de.json";
import en from "../assets/locales/en.json";

i18n
  .use(initReactI18next)
  .init({
    lng: "de",
    ns: Object.keys(de),
    defaultNS: "common",
    fallbackLng: "de",
    resources: { de, en },
    supportedLngs: ["de", "en"],
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to initialize i18n: ", err);
  });

// eslint-disable-next-line import/no-default-export
export default i18n;
