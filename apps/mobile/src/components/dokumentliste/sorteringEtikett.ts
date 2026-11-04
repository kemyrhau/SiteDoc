import type { TFunction } from "i18next";
import type { Retning, SorterNokkel, Sortering } from "./dokumentlisteFilter";

export const SORTERING_NOEKKEL: Record<SorterNokkel, string> = {
  opprettet: "dokumentsok.sorteringOpprettet",
  endret: "dokumentsok.sorteringEndret",
  sendt: "dokumentsok.sorteringSendt",
  frist: "dokumentsok.sorteringFrist",
  nummer: "dokumentsok.sorteringNummer",
  emne: "dokumentsok.sorteringEmne",
  navn: "dokumentsok.sorteringNavn",
};

export const pil = (retning: Retning) => (retning === "stigende" ? "↑" : "↓");

/** Brikketekst i arket: «1 · Frist ↑» når valgt, ellers bare «Frist». */
export function brikkeEtikett(sortering: Sortering, nokkel: SorterNokkel, t: TFunction): string {
  const navn = t(SORTERING_NOEKKEL[nokkel]);
  const i = sortering.findIndex((n) => n.nokkel === nokkel);
  if (i === -1) return navn;
  return t("dokumentsok.sorteringNivaa", { nivaa: i + 1, navn, pil: pil(sortering[i]!.retning) });
}

/** Skjermleser: «Frist, nivå 1, stigende». */
export function brikkeA11y(sortering: Sortering, nokkel: SorterNokkel, t: TFunction): string {
  const navn = t(SORTERING_NOEKKEL[nokkel]);
  const i = sortering.findIndex((n) => n.nokkel === nokkel);
  if (i === -1) return navn;
  const retning = t(sortering[i]!.retning === "stigende" ? "dokumentsok.sorteringStigende" : "dokumentsok.sorteringSynkende");
  return t("dokumentsok.sorteringNivaaA11y", { nivaa: i + 1, navn, retning });
}

/** Chip over lista: «Frist ↑, deretter Nummer ↓». Tom sortering → tom streng. */
export function sorteringOppsummering(sortering: Sortering, t: TFunction): string {
  return sortering
    .map((n) => `${t(SORTERING_NOEKKEL[n.nokkel])} ${pil(n.retning)}`)
    .join(t("dokumentsok.sorteringDeretter"));
}
