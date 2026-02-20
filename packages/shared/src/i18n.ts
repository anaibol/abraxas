import i18next, { type i18n as I18nType } from "i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import it from "./locales/it.json";

export const i18n: I18nType = i18next.createInstance();

i18n.init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    it: { translation: it },
  },
  interpolation: {
    escapeValue: false,
  },
});
