import type { TFunction } from "i18next";
import { PERIODE_NOEKKEL } from "@sitedoc/shared";
import { FILTER_KOLONNER, UTEN_EMNE, type ListePeriode } from "./dokumentlisteFilter";

export const PRIORITET_NOEKKEL: Record<string, string> = {
  low: "prioritet.lav",
  medium: "prioritet.middels",
  high: "prioritet.hoey",
  critical: "prioritet.kritisk",
};

export const FRIST_NOEKKEL: Record<string, string> = {
  forfalt: "dokumentsok.fristForfalt",
  har_frist: "dokumentsok.fristHarFrist",
  ingen_frist: "dokumentsok.fristIngenFrist",
};

/** Pseudo-kolonne for perioden (opprettet eller statusdato) i chip-raden (ikke et likhetsfilter). */
export const PERIODE_CHIP = "__periode__";

/** Synlig etikett for én filterverdi (chipsene over lista og nedtrekkene i arket). */
export function filterEtikett(kolId: string, verdi: string, t: TFunction): string {
  if (kolId === "ballen") return t("dokumentsok.ballenHosMeg");
  if (kolId === "emne" && verdi === UTEN_EMNE) return t("dokumentsok.utenEmne");
  if (kolId === "frist") return FRIST_NOEKKEL[verdi] ? t(FRIST_NOEKKEL[verdi]) : verdi;
  if (kolId === "prioritet") return PRIORITET_NOEKKEL[verdi] ? t(PRIORITET_NOEKKEL[verdi]) : verdi;
  return verdi;
}

export interface AktivChip {
  kolId: string;
  value: string;
  label: string;
}

/**
 * Fjernbare chips for aktive filtre + opprettet-periode (fabel-designlås pkt 6).
 * Etiketten kommer alltid fra filterEtikett, så sentinel-verdier (UTEN_EMNE)
 * aldri vises rått. Felles for sjekkliste-, oppgave- og innbokslista.
 */
export function byggAktiveChips(
  filterVerdier: Record<string, string>,
  periode: ListePeriode | undefined,
  t: TFunction,
): AktivChip[] {
  const chips: AktivChip[] = [];
  for (const kolId of FILTER_KOLONNER) {
    const v = filterVerdier[kolId];
    if (!v) continue;
    for (const del of v.split(",").filter(Boolean)) {
      chips.push({ kolId, value: del, label: filterEtikett(kolId, del, t) });
    }
  }
  if (periode && periode.hurtigvalg !== "alle") {
    chips.push({
      kolId: PERIODE_CHIP,
      value: periode.hurtigvalg,
      // M-pakke: chipen sier hvilket datofelt perioden gjelder («Sendt: Siste 7 dager»).
      label: `${t(periode.felt && periode.felt !== "opprettet" ? `periodeFilter.${periode.felt}` : "tabell.opprettet")}: ${t(PERIODE_NOEKKEL[periode.hurtigvalg])}`,
    });
  }
  return chips;
}
