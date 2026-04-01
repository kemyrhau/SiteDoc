import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { nb, STANDARD_SPRAAK } from "@sitedoc/shared";
import type { SpraakKode } from "@sitedoc/shared";
import en from "@sitedoc/shared/src/i18n/en.json";

// Statisk import av alle tilgjengelige oversettelser
// Legg til nye språk her etter hvert som de genereres
const oversettelser: Partial<Record<SpraakKode, Record<string, string>>> = {
  nb,
  en,
};

const STORAGE_KEY = "sitedoc-language";

export function hentLagretSpraak(): SpraakKode {
  if (typeof window === "undefined") return STANDARD_SPRAAK;
  return (localStorage.getItem(STORAGE_KEY) as SpraakKode) || STANDARD_SPRAAK;
}

export function lagreSpraak(kode: SpraakKode) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, kode);
  }
}

// Bygg resources-objekt fra tilgjengelige oversettelser
const resources: Record<string, { translation: Record<string, string> }> = {};
for (const [kode, data] of Object.entries(oversettelser)) {
  if (data) resources[kode] = { translation: data };
}

// Initialiser i18next
i18next.use(initReactI18next).init({
  resources,
  lng: hentLagretSpraak(),
  fallbackLng: "nb",
  interpolation: {
    escapeValue: false, // React håndterer XSS
  },
});

// Funksjon for å bytte språk
export async function byttSpraak(kode: SpraakKode) {
  await i18next.changeLanguage(kode);
  lagreSpraak(kode);
  // Oppdater html lang-attributt
  if (typeof document !== "undefined") {
    document.documentElement.lang = kode;
  }
}

export default i18next;
