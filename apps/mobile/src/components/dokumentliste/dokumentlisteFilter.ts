import {
  beregnHarBallen,
  effektiveGrenser,
  filtrerRader,
  innenforPeriode,
  matchScore,
  normaliserSok,
  synonymerFor,
  TERMINALE_DOKUMENTSTATUSER,
  type HarBallenBruker,
  type Periode,
  type TabellFilterConfig,
} from "@sitedoc/shared";
import type { VelgerAlternativ } from "./EnkeltvelgerModal";

/**
 * Dokumentliste-filter for mobil (dokumentsøk-mobil trinn 1). Bygger på det DELTE
 * filterpredikatet (`@sitedoc/shared/tabellFilter`, trinn 0) og den DELTE
 * søkemotoren (`sokMatch`) — «to flater, én filterkilde». Dekker sjekkliste- og
 * oppgavelista (filter-mobil 2026-11-03) og HMS-lista (filter-hms 2026-11-03).
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
  /** B-1 (metadata-spec): område (sone/rom/etasje/trasé). Mangler i eldre API-svar. */
  omrade?: { navn: string } | null;
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

/** Sorteringsnøklene (flernivå-sortering 2026-11-04) — rekkefølgen arket viser dem i. */
export type SorterNokkel = "opprettet" | "endret" | "frist" | "nummer" | "emne" | "navn";
export type Retning = "stigende" | "synkende";
export interface SorterNivaa {
  nokkel: SorterNokkel;
  retning: Retning;
}
/** 0–3 nivåer i prioritert rekkefølge. `[]` = standardsortering (opprettet, nyeste først). */
export type Sortering = SorterNivaa[];

export const SORTER_NOKLER: SorterNokkel[] = ["opprettet", "endret", "frist", "nummer", "emne", "navn"];
export const MAKS_SORTERNIVAAER = 3;
/** Retningen en nøkkel får ved første trykk — tidspunkt nyeste først, resten stigende. */
export const STARTRETNING: Record<SorterNokkel, Retning> = {
  opprettet: "synkende",
  endret: "synkende",
  frist: "stigende",
  nummer: "stigende",
  emne: "stigende",
  navn: "stigende",
};

/**
 * Trykk på en sorteringsbrikke: ny nøkkel legges til som neste nivå (maks 3 —
 * ellers uendret), valgt nøkkel med startretning snus, snudd nøkkel fjernes og
 * nivåene under rykker opp. Syklus: legg til → snu → fjern.
 */
export function trykkSorteringsbrikke(sortering: Sortering, nokkel: SorterNokkel): Sortering {
  const i = sortering.findIndex((n) => n.nokkel === nokkel);
  if (i === -1) {
    if (sortering.length >= MAKS_SORTERNIVAAER) return sortering;
    return [...sortering, { nokkel, retning: STARTRETNING[nokkel] }];
  }
  const nivaa = sortering[i]!;
  if (nivaa.retning === STARTRETNING[nokkel]) {
    const snudd: Retning = nivaa.retning === "stigende" ? "synkende" : "stigende";
    return sortering.map((n, j) => (j === i ? { nokkel, retning: snudd } : n));
  }
  return sortering.filter((_, j) => j !== i);
}

/**
 * Nøklene arket viser (adaptivt): opprettet/endret/navn alltid; frist, nummer og
 * emne bare når minst én rad har verdi. En valgt nøkkel vises alltid (kan fjernes).
 */
export function tilgjengeligeSorteringer(rader: DokumentRad[], sortering: Sortering): SorterNokkel[] {
  const harData: Record<SorterNokkel, boolean> = {
    opprettet: true,
    endret: true,
    navn: true,
    frist: rader.some((r) => !!r.dueDate),
    nummer: rader.some((r) => r.number != null),
    emne: rader.some((r) => !!r.subject?.trim()),
  };
  return SORTER_NOKLER.filter((k) => harData[k] || sortering.some((n) => n.nokkel === k));
}

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
  "omrade",
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
        case "omrade":
          return rad.omrade?.navn ?? "";
        default:
          return undefined;
      }
    },
    hentFrist: (rad) => ({
      dueDate: rad.dueDate ?? null,
      // Avsluttet (inkl. avbrutt) er aldri forfalt — samme sett som flytrollene.
      ferdig: TERMINALE_DOKUMENTSTATUSER.has(rad.status),
    }),
  };
}

/**
 * «Ballen hos meg» gjelder bare serverrader. Lokale rader (offline-katalogen) mangler
 * bestiller-/mottaker-id-ene, så `beregnHarBallen` ville gitt false for alle og lista
 * blitt stille tom — også med nett, så lenge serversvaret ikke er bekreftet.
 */
export function ballenBrukerForKilde(
  bruker: HarBallenBruker | null,
  kilde: string,
): HarBallenBruker | null {
  return kilde === "server" ? bruker : null;
}

/** Fjerner et satt ballen-filter når det ikke kan brukes, så telleren ikke lyver. */
export function utenUbruktBallen(
  filterVerdier: Record<string, string>,
  bruker: HarBallenBruker | null,
): Record<string, string> {
  if (bruker || !filterVerdier.ballen) return filterVerdier;
  const { ballen: _ballen, ...rest } = filterVerdier;
  return rest;
}

/** Config uten bruker («ballen hos meg» ignoreres). */
export const sjekklisteFilterConfig: TabellFilterConfig<DokumentRad> = lagFilterConfig();

export interface DokumentAlternativer {
  dokumentflyt: VelgerAlternativ[];
  mal: VelgerAlternativ[];
  ansvarlig: VelgerAlternativ[];
  tegning: VelgerAlternativ[];
  omrade: VelgerAlternativ[];
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
    omrade: unik(rader.map((r) => r.omrade?.navn)),
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

/**
 * Adaptivt (arket): under to ulike verdier er et filter meningsløst og skjules — med
 * mindre det alt er satt. Gir også toleranse mot eldre API: mangler feltet i svaret,
 * blir alternativene færre enn to og filteret forsvinner stille.
 */
export function visFilterKolonne(
  kolId: string,
  alt: VelgerAlternativ[],
  filterVerdier: Record<string, string>,
): boolean {
  return alt.length >= 2 || !!filterVerdier[kolId];
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

  return [...filtrert].sort((a, b) => sammenlignRader(a, b, sortering));
}

const tid = (d: Date | string) => new Date(d).getTime();

/** Stigende sammenligning for én nøkkel; tom verdi gir `null` (håndteres av `sammenlignNivaa`). */
function verdi(r: DokumentRad, nokkel: SorterNokkel): number | string | null {
  switch (nokkel) {
    case "opprettet":
      return tid(r.createdAt);
    case "endret":
      return tid(r.updatedAt);
    case "frist":
      return r.dueDate ? tid(r.dueDate) : null;
    case "nummer":
      return r.number ?? null;
    case "emne":
      return r.subject?.trim() || null;
    case "navn":
      return r.title;
  }
}

/** Ett nivå: retningen gir fortegnet, men tom verdi havner sist i begge retninger. */
function sammenlignNivaa(a: DokumentRad, b: DokumentRad, { nokkel, retning }: SorterNivaa): number {
  return tomSist(verdi(a, nokkel), verdi(b, nokkel), (x, y) => {
    const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "nb");
    return retning === "stigende" ? cmp : -cmp;
  });
}

const STANDARDSORTERING: Sortering = [{ nokkel: "opprettet", retning: "synkende" }];
/** Fast, skjult hale: nummer, deretter id — nummer gjentas på tvers av maler (AVV-3/SJA-3). */
const HALE: SorterNivaa = { nokkel: "nummer", retning: "stigende" };

/**
 * Flernivå-komparator: nivåene i rekkefølge (første ulikhet vinner), deretter
 * nummer ↑ og id, slik at like rader alltid får samme rekkefølge uansett
 * rekkefølgen de kom inn i. `[]` = opprettet, nyeste først.
 */
export function sammenlignRader(a: DokumentRad, b: DokumentRad, sortering: Sortering): number {
  for (const nivaa of sortering.length ? sortering : STANDARDSORTERING) {
    const r = sammenlignNivaa(a, b, nivaa);
    if (r !== 0) return r;
  }
  const r = sammenlignNivaa(a, b, HALE);
  if (r !== 0) return r;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Antall aktive filter-egenskaper (trakt-telleren «▼ N») — status/byggeplass teller ikke. */
export function antallAktiveFilter(filterVerdier: Record<string, string>, periode?: Periode): number {
  const periodeAktiv = periode && periode.hurtigvalg !== "alle" ? 1 : 0;
  return FILTER_KOLONNER.filter((k) => filterVerdier[k]).length + periodeAktiv;
}
