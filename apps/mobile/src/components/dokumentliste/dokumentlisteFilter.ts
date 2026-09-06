import {
  filtrerRader,
  matchScore,
  normaliserSok,
  synonymerFor,
  type TabellFilterConfig,
} from "@sitedoc/shared";
import type { VelgerAlternativ } from "./EnkeltvelgerModal";

/**
 * Dokumentliste-filter for mobil (dokumentsøk-mobil trinn 1). Bygger på det DELTE
 * filterpredikatet (`@sitedoc/shared/tabellFilter`, trinn 0) og den DELTE
 * søkemotoren (`sokMatch`) — «to flater, én filterkilde». Foreløpig sjekkliste;
 * oppgave/HMS er rask oppfølger med samme modul.
 */

export interface DokumentRad {
  id: string;
  title: string;
  status: string;
  number?: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  subject?: string | null;
  dueDate?: string | null;
  template?: { name: string; prefix?: string | null } | null;
  byggeplass?: { name: string } | null;
  drawing?: { name: string | null } | null;
  dokumentflyt?: { name: string } | null;
  recipientUser?: { name: string | null } | null;
  recipientGroup?: { name: string | null } | null;
  bestiller?: { name: string | null } | null;
  utforerFaggruppe?: { name: string } | null;
}

export type Sortering = "nyeste" | "eldste" | "navn";

/** Filter-kolonner sheetet styrer (status + byggeplass hører IKKE hit — fabel). */
export const FILTER_KOLONNER = ["dokumentflyt", "mal", "ansvarlig", "tegning", "frist"] as const;

/**
 * Ansvarlig = den/de som har ballen (speiler webs `formaterAnsvarlig`): reell
 * mottaker; utkast → oppretteren; ellers tom (ingen ansvarlig ennå).
 */
export function formaterAnsvarlig(rad: DokumentRad): string {
  if (rad.recipientUser?.name) return rad.recipientUser.name;
  if (rad.recipientGroup?.name) return rad.recipientGroup.name;
  if (rad.status === "draft") return rad.bestiller?.name ?? "";
  return "";
}

/** Delt config: verdi-uthenting for sjekkliste-radene (mobilens motstykke til webs switch). */
export const sjekklisteFilterConfig: TabellFilterConfig<DokumentRad> = {
  hentVerdi: (rad, kolId) => {
    switch (kolId) {
      case "dokumentflyt":
        return rad.dokumentflyt?.name ?? "";
      case "mal":
        return rad.template?.name ?? "";
      case "ansvarlig":
        return formaterAnsvarlig(rad);
      case "tegning":
        return rad.drawing?.name ?? "";
      default:
        return undefined;
    }
  },
  hentFrist: (rad) => ({
    dueDate: rad.dueDate ?? null,
    ferdig: rad.status === "approved" || rad.status === "closed",
  }),
};

/** Unike, sorterte alternativer per nedtrekk — bygget klientside fra hele lista
 *  (målt: mobil henter hele lista, ingen paginering → trygt). */
export function byggAlternativer(rader: DokumentRad[]): {
  dokumentflyt: VelgerAlternativ[];
  mal: VelgerAlternativ[];
  ansvarlig: VelgerAlternativ[];
  tegning: VelgerAlternativ[];
} {
  const unik = (verdier: (string | null | undefined)[]): VelgerAlternativ[] =>
    Array.from(new Set(verdier.filter((v): v is string => !!v)))
      .sort((a, b) => a.localeCompare(b, "nb"))
      .map((v) => ({ value: v, label: v }));

  return {
    dokumentflyt: unik(rader.map((r) => r.dokumentflyt?.name)),
    mal: unik(rader.map((r) => r.template?.name)),
    ansvarlig: unik(rader.map((r) => formaterAnsvarlig(r))),
    tegning: unik(rader.map((r) => r.drawing?.name)),
  };
}

/** Søke-indeks for en rad: alle søkbare felt + synonymer (delt søkemotor). */
function sokeNorm(rad: DokumentRad): string {
  const rå = [
    rad.template?.prefix && rad.number != null
      ? `${rad.template.prefix}${rad.number}`
      : null,
    rad.title,
    rad.subject,
    rad.template?.name,
    rad.dokumentflyt?.name,
    rad.byggeplass?.name,
    rad.drawing?.name,
  ]
    .filter(Boolean)
    .join(" ");
  const norm = normaliserSok(rå);
  const syn = synonymerFor(norm);
  return syn ? `${norm} ${syn}` : norm;
}

/**
 * Full pipeline: filtrer (delt predikat) → søk (delt motor, overstyrer sortering
 * med relevans) → sorter. `søketekst` tom = ingen søk.
 */
export function filtrerOgSorter(
  rader: DokumentRad[],
  filterVerdier: Record<string, string>,
  søketekst: string,
  sortering: Sortering,
): DokumentRad[] {
  const filtrert = filtrerRader(rader, filterVerdier, sjekklisteFilterConfig);

  const q = normaliserSok(søketekst.trim());
  if (q) {
    // Søk overstyrer sortering → relevans-rangert (delt matchScore).
    return filtrert
      .map((rad) => ({ rad, score: matchScore(sokeNorm(rad), q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.rad);
  }

  const tid = (d: Date | string) => new Date(d).getTime();
  return [...filtrert].sort((a, b) => {
    switch (sortering) {
      case "eldste":
        return tid(a.createdAt) - tid(b.createdAt);
      case "navn":
        return a.title.localeCompare(b.title, "nb");
      case "nyeste":
      default:
        return tid(b.createdAt) - tid(a.createdAt);
    }
  });
}

/** Antall aktive filter-egenskaper (trakt-telleren «▼ N») — status/byggeplass teller ikke. */
export function antallAktiveFilter(filterVerdier: Record<string, string>): number {
  return FILTER_KOLONNER.filter((k) => filterVerdier[k]).length;
}
