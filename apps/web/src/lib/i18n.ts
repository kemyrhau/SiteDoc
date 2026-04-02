import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { nb, STANDARD_SPRAAK } from "@sitedoc/shared";
import type { SpraakKode } from "@sitedoc/shared";
import en from "@sitedoc/shared/src/i18n/en.json";
import sv from "@sitedoc/shared/src/i18n/sv.json";
import lt from "@sitedoc/shared/src/i18n/lt.json";
import pl from "@sitedoc/shared/src/i18n/pl.json";
import uk from "@sitedoc/shared/src/i18n/uk.json";
import ro from "@sitedoc/shared/src/i18n/ro.json";
import et from "@sitedoc/shared/src/i18n/et.json";
import fi from "@sitedoc/shared/src/i18n/fi.json";
import cs from "@sitedoc/shared/src/i18n/cs.json";
import de from "@sitedoc/shared/src/i18n/de.json";
import ru from "@sitedoc/shared/src/i18n/ru.json";
import lv from "@sitedoc/shared/src/i18n/lv.json";

// Alle 13 språk — statisk importert
const oversettelser: Record<SpraakKode, Record<string, string>> = {
  nb, en, sv, lt, pl, uk, ro, et, fi, cs, de, ru, lv,
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

// Bygg resources-objekt
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
    escapeValue: false,
  },
});

// Funksjon for å bytte språk
export async function byttSpraak(kode: SpraakKode) {
  await i18next.changeLanguage(kode);
  lagreSpraak(kode);
  if (typeof document !== "undefined") {
    document.documentElement.lang = kode;
  }
}

export default i18next;
