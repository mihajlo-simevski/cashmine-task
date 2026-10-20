import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en";

export const defaultNS = "translation";
export const resources = { en: { [defaultNS]: en } } as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  defaultNS,
  interpolation: { escapeValue: false },
  // Resources are bundled, so initialise synchronously (no untranslated first render).
  initAsync: false,
});

export default i18n;
