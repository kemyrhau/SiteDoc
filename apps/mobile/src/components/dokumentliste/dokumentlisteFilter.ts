import {
  beregnHarBallen,
  effektiveGrenser,
  filtrerRader,
  innenforPeriode,
  matchScore,
  normaliserSok,
  synonymerFor,
  type HarBallenBruker,
  type Periode,
  type TabellFilterConfig,
} from "@sitedoc/shared";
import type { VelgerAlternativ } from "./EnkeltvelgerModal";

/**
 * Dokumentliste-filter for mobil (dokumentsøk-mobil trinn 1). Bygger på det DELTE
 * filterpredikatet (`@sitedoc/shared/tabellFilter`, trinn 0) og den DELTE
 * søkemotoren (`sokMatch`) — «to flater, én filterkilde». Dekker sjekkliste- og
 * oppgavelista (filter-mobil 2026-11-03); HMS-lista er utenfor.
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
  bestillerFaggruppe?: { name: string } | null;
  utforerFaggruppe?: { name: string } | null;
  /** Kun oppgaver. */
  priority?: string | null;
  // Id-er for «ballen hos meg» — finnes bare i serversvaret (lokale tabeller har dem ikke).
  bestillerUserId?: string | null;
  recipientUserId?: string | null;
  recipientGroupId?: string | null;
}

export type Sortering = "nyeste" | "eldste" | "endret" | "frist" | "nummer" | "emne" | "navn";

/** Sorteringene i den rekkefølgen arket viser dem. */
export const SORTERINGER: Sortering[] = ["nyeste", "eldste", "endret", "frist", "nummer", "emne", "navn"];

/** Filter-kolonner sheetet styrer (status + byggeplass hører IKKE hit — fabel). */
export const FILTER_KOLONNER = [
  "ballen",
  "emne",
  "mal",
  "prioritet",
  "frist",
  "opprettetAv",
  "ansvarlig",
  "bestillerFaggruppe",
  "utforerFaggruppe",
  "tegning",
  "dokumentflyt",
] as const;

/**
 * Intern verdi for «Uten emne». Det delte predikatet hopper over tom filterverdi,
 * så tomt emne kan ikke velges som "" — det får denne sentinelen i stedet.
 */
export const UTEN_EMNE = "__uten_emne__";

/** Prioritet i fast rekkefølge (lav → kritisk), ikke alfabetisk. */
const PRIORITET_REKKEFOLGE = ["low", "medium", "high", "critical"];

/** Tilleggsvalg som ikke er likhetsfiltre: opprettet-periode og «ballen hos meg». */
export interface EkstraFilter {
  periode?: Periode;
  /** Innlogget bruker. Uten bruker (offline) ignoreres «ballen hos meg». */
  bruker?: HarBallenBruker | null;
}

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

function emneVerdi(rad: DokumentRad): string {
  return rad.subject?.trim() || UTEN_EMNE;
}

/**
 * Delt config: verdi-uthenting for dokumentradene (mobilens motstykke til webs switch).
 * `bruker` trengs bare for «ballen hos meg»; uten bruker ignoreres den kolonnen.
 */
export function lagFilterConfig(bruker?: HarBallenBruker | null): TabellFilterConfig<DokumentRad> {
  return {
    hentVerdi: (rad, kolId) => {
      switch (kolId) {
        case "ballen":
          if (!bruker) return undefined;
          return beregnHarBallen(
            {
              status: rad.status,
              bestillerUserId: rad.bestillerUserId ?? null,
              recipientUserId: rad.recipientUserId ?? null,
              recipientGroupId: rad.recipientGroupId ?? null,
            },
            bruker,
          )
            ? "1"
            : "0";
        case "emne":
          return emneVerdi(rad);
        case "prioritet":
          return rad.priority ?? "";
        case "opprettetAv":
          return rad.bestiller?.name ?? "";
        case "bestillerFaggruppe":
          return rad.bestillerFaggruppe?.name ?? "";
        case "utforerFaggruppe":
          return rad.utforerFaggruppe?.name ?? "";
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
}

/** Config uten bruker («ballen hos meg» ignoreres). */
export const sjekklisteFilterConfig: TabellFilterConfig<DokumentRad> = lagFilterConfig();

export interface DokumentAlternativer {
  dokumentflyt: VelgerAlternativ[];
  mal: VelgerAlternativ[];
  ansvarlig: VelgerAlternativ[];
  tegning: VelgerAlternativ[];
  /** Emner som finnes + «Uten emne» (UTEN_EMNE, etikett satt av arket) når noen rad mangler emne. */
  emne: VelgerAlternativ[];
  opprettetAv: VelgerAlternativ[];
  bestillerFaggruppe: VelgerAlternativ[];
  utforerFaggruppe: VelgerAlternativ[];
  /** Prioritetskoder i fast rekkefølge (etikett settes av arket). */
  prioritet: VelgerAlternativ[];
}

/** Unike, sorterte alternativer per nedtrekk — bygget klientside fra hele lista
 *  (målt: mobil henter hele lista, ingen paginering → trygt). */
export function byggAlternativer(rader: DokumentRad[]): DokumentAlternativer {
  const unik = (verdier: (string | null | undefined)[]): VelgerAlternativ[] =>
    Array.from(new Set(verdier.filter((v): v is string => !!v)))
      .sort((a, b) => a.localeCompare(b, "nb"))
      .map((v) => ({ value: v, label: v }));

  return {
    dokumentflyt: unik(rader.map((r) => r.dokumentflyt?.name)),
    mal: unik(rader.map((r) => r.template?.name)),
    ansvarlig: unik(rader.map((r) => formaterAnsvarlig(r))),
    tegning: unik(rader.map((r) => r.drawing?.name)),
    emne: [
      ...unik(rader.map((r) => r.subject?.trim())),
      ...(rader.some((r) => !r.subject?.trim()) ? [{ value: UTEN_EMNE, label: "" }] : []),
    ],
    opprettetAv: unik(rader.map((r) => r.bestiller?.name)),
    bestillerFaggruppe: unik(rader.map((r) => r.bestillerFaggruppe?.name)),
    utforerFaggruppe: unik(rader.map((r) => r.utforerFaggruppe?.name)),
    prioritet: PRIORITET_REKKEFOLGE.filter((p) => rader.some((r) => r.priority === p)).map((p) => ({
      value: p,
      label: p,
    })),
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

/** Sammenligning der tom verdi alltid havner sist (begge retninger). */
function tomSist<V>(a: V | null | undefined, b: V | null | undefined, cmp: (x: V, y: V) => number): number {
  const aTom = a == null || a === "";
  const bTom = b == null || b === "";
  if (aTom && bTom) return 0;
  if (aTom) return 1;
  if (bTom) return -1;
  return cmp(a as V, b as V);
}

/**
 * Full pipeline: filtrer (delt predikat) → opprettet-periode → søk (delt motor,
 * overstyrer sortering med relevans) → sorter. `søketekst` tom = ingen søk.
 */
export function filtrerOgSorter(
  rader: DokumentRad[],
  filterVerdier: Record<string, string>,
  søketekst: string,
  sortering: Sortering,
  ekstra: EkstraFilter = {},
): DokumentRad[] {
  let filtrert = filtrerRader(rader, filterVerdier, lagFilterConfig(ekstra.bruker));
  if (ekstra.periode && ekstra.periode.hurtigvalg !== "alle") {
    const { fra, til } = effektiveGrenser(ekstra.periode);
    filtrert = filtrert.filter((r) => innenforPeriode(new Date(r.createdAt), fra, til));
  }

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
      case "endret":
        return tid(b.updatedAt) - tid(a.updatedAt);
      case "frist":
        return tomSist(a.dueDate, b.dueDate, (x, y) => tid(x) - tid(y));
      case "nummer":
        return tomSist(a.number, b.number, (x, y) => x - y);
      case "emne":
        return tomSist(a.subject?.trim(), b.subject?.trim(), (x, y) => x.localeCompare(y, "nb"));
      case "navn":
        return a.title.localeCompare(b.title, "nb");
      case "nyeste":
      default:
        return tid(b.createdAt) - tid(a.createdAt);
    }
  });
}

/** Antall aktive filter-egenskaper (trakt-telleren «▼ N») — status/byggeplass teller ikke. */
export function antallAktiveFilter(filterVerdier: Record<string, string>, periode?: Periode): number {
  const periodeAktiv = periode && periode.hurtigvalg !== "alle" ? 1 : 0;
  return FILTER_KOLONNER.filter((k) => filterVerdier[k]).length + periodeAktiv;
}
