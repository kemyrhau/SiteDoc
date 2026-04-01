import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { nb, STANDARD_SPRAAK } from "@sitedoc/shared";
import type { SpraakKode } from "@sitedoc/shared";

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

// Lazy-load oversettelser for andre språk
async function lastOversettelse(spraak: SpraakKode): Promise<Record<string, string>> {
  if (spraak === "nb") return nb;
  try {
    // Dynamisk import av språkfil fra shared-pakken
    const modul = await import(`@sitedoc/shared/src/i18n/${spraak}.json`);
    return modul.default || modul;
  } catch {
    console.warn(`Kunne ikke laste oversettelse for ${spraak}, bruker norsk`);
    return nb;
  }
}

// Initialiser i18next
i18next.use(initReactI18next).init({
  resources: {
    nb: { translation: nb },
  },
  lng: hentLagretSpraak(),
  fallbackLng: "nb",
  interpolation: {
    escapeValue: false, // React håndterer XSS
  },
});

// Funksjon for å bytte språk (laster oversettelse on-demand)
export async function byttSpraak(kode: SpraakKode) {
  if (!i18next.hasResourceBundle(kode, "translation")) {
    const oversettelse = await lastOversettelse(kode);
    i18next.addResourceBundle(kode, "translation", oversettelse);
  }
  await i18next.changeLanguage(kode);
  lagreSpraak(kode);
  // Oppdater html lang-attributt
  if (typeof document !== "undefined") {
    document.documentElement.lang = kode;
  }
}

export default i18next;
