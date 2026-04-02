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
import fr from "@sitedoc/shared/src/i18n/fr.json";
import { lagreVerdi, hentVerdi } from "../services/auth";

// Alle 14 språk — statisk importert
const oversettelser: Record<SpraakKode, Record<string, string>> = {
  nb, en, sv, lt, pl, uk, ro, et, fi, cs, de, ru, lv, fr,
};

const STORAGE_KEY = "sitedoc-language";

// Bygg resources-objekt
const resources: Record<string, { translation: Record<string, string> }> = {};
for (const [kode, data] of Object.entries(oversettelser)) {
  if (data) resources[kode] = { translation: data };
}

// Initialiser synkront med nb — oppdateres asynkront via SpraakProvider
i18next.use(initReactI18next).init({
  resources,
  lng: STANDARD_SPRAAK,
  fallbackLng: "nb",
  interpolation: {
    escapeValue: false,
  },
});

export async function hentLagretSpraak(): Promise<SpraakKode> {
  const lagret = await hentVerdi(STORAGE_KEY);
  return (lagret as SpraakKode) || STANDARD_SPRAAK;
}

export async function byttSpraak(kode: SpraakKode) {
  await i18next.changeLanguage(kode);
  await lagreVerdi(STORAGE_KEY, kode);
}

export default i18next;
