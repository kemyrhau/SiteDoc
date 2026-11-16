import { beregnKortSummer, kortStatus, type KortSummer } from "@sitedoc/shared";
import {
  radHorerTilKort,
  type UtenIdTilKort,
  telteKortVarer,
  type KortValg,
  type SedelKortKontekst,
} from "../lib/prosjektkortMobil";

/**
 * ORDRE 36b (spec `dagsoversikt-beskrivelse-spec.md` § 2.1/§ 2.3): ren logikk
 * for dagsoversikten i prosjektkort-modus — hvilke faste linjer et prosjekt
 * viser, «Mangler»-regelen (K3), statusordet og sum-kortet. Komponenten
 * (`ProsjektkortDagsoversikt`) gir lokale rader inn og rendrer svaret.
 */

export type OversiktTimerRad = {
  id: string;
  projectId: string;
  byggeplassId: string | null;
  /** Ordre c (T11): radens kort. Mangler = utledes fra nøkkelen. */
  kortId?: string | null;
  timer: number;
  fraTid: string | null;
  tilTid: string | null;
  beskrivelse: string | null;
  erReise: boolean;
  externalCostObjectId?: string | null;
  /** Lønnsartens overtidsnivå (50/100) — null = ordinær. */
  overtidsnivaa: number | null;
  attestertStatus: string | null;
};

export type OversiktMaskinRad = {
  id: string;
  projectId: string;
  byggeplassId: string | null;
  /** Ordre c (T11): radens kort. Mangler = utledes fra nøkkelen. */
  kortId?: string | null;
  vehicleId: string;
  externalCostObjectId?: string | null;
  timer: number;
  attestertStatus: string | null;
};

export type OversiktVare = {
  id: string;
  projectId: string;
  byggeplassId?: string | null;
  externalCostObjectId?: string | null;
  antall: number;
  vare: { navn: string; enhet: string };
  syncStatus?: string | null;
};

export type ProsjektLinjer<V extends OversiktVare = OversiktVare> = {
  /** Ordinære arbeidsrader (ikke reise, ikke overtid), sortert på fraTid. */
  arbeid: OversiktTimerRad[];
  /** Overtidsrader — vises som underlinje under Arbeid. */
  overtid: OversiktTimerRad[];
  reise: OversiktTimerRad[];
  /** Maskin vises når firmaet har utstyr i cache ELLER maskin er ført i dag. */
  visMaskin: boolean;
  maskin: OversiktMaskinRad[];
  /** Varer vises når prosjektet har varelager ELLER varer er ført i dag. */
  visVarer: boolean;
  /** Alle linjer for visning (også avviste); summen teller ikke avviste. */
  varer: V[];
  /** Distinkte beskrivelser (trimmet) i radrekkefølge. */
  beskrivelser: string[];
  /** K3: arbeid > 0 og ingen beskrivelse på noen arbeidsrad. */
  mangler: boolean;
  /** Raden «Beskrivelse»/«Mangler» åpner (første arbeidsrad). */
  forsteArbeidsradId: string | null;
  utlegg: number;
  status: "returnert" | "attestert" | null;
  summer: KortSummer;
};

const gjelder = (r: { attestertStatus: string | null }) => r.attestertStatus !== "erstattet";

const etterFraTid = (a: OversiktTimerRad, b: OversiktTimerRad) =>
  (a.fraTid ?? "99:99").localeCompare(b.fraTid ?? "99:99");

export function linjerForProsjekt<V extends OversiktVare>(args: {
  projectId: string;
  timer: readonly OversiktTimerRad[];
  maskin: readonly OversiktMaskinRad[];
  varer: readonly V[];
  utlegg: number;
  harEquipmentCache: boolean;
  harVarelager: boolean;
  /**
   * ORDRE 36b: ett kort = (prosjekt, effektiv byggeplass, underprosjekt). Uten
   * `kort` filtreres på prosjekt alene (som før).
   */
  kort?: { valg: KortValg; sedel: SedelKortKontekst; utenId?: UtenIdTilKort };
}): ProsjektLinjer<V> {
  const { projectId, kort } = args;
  // Ordre c (T11): kortet er kort-id-en når den finnes (radHorerTilKort).
  const paaKort = (r: {
    projectId: string;
    byggeplassId?: string | null;
    externalCostObjectId?: string | null;
    kortId?: string | null;
  }) => r.projectId === projectId && (!kort || radHorerTilKort(r, kort.sedel, kort.valg, kort.utenId));
  const timer = args.timer.filter((r) => paaKort(r) && gjelder(r));
  const maskin = args.maskin.filter((r) => paaKort(r) && gjelder(r));
  const varer = args.varer.filter(paaKort);
  const telte = telteKortVarer(varer, projectId);
  const summer = beregnKortSummer(timer, maskin, telte);

  const arbeidsrader = timer.filter((r) => !r.erReise).sort(etterFraTid);
  const beskrivelser: string[] = [];
  for (const r of arbeidsrader) {
    const b = r.beskrivelse?.trim();
    if (b && !beskrivelser.includes(b)) beskrivelser.push(b);
  }

  return {
    arbeid: arbeidsrader.filter((r) => r.overtidsnivaa == null),
    overtid: arbeidsrader.filter((r) => r.overtidsnivaa != null),
    reise: timer.filter((r) => r.erReise).sort(etterFraTid),
    visMaskin: args.harEquipmentCache || summer.maskin > 0,
    maskin,
    visVarer: args.harVarelager || telte.length > 0,
    varer,
    beskrivelser,
    mangler: summer.arbeid > 0 && beskrivelser.length === 0,
    forsteArbeidsradId: arbeidsrader[0]?.id ?? null,
    utlegg: args.utlegg,
    status: kortStatus([...timer, ...maskin]),
    summer,
  };
}

export type StatusOrd = {
  nokkel:
    | "timer.dagsoversikt.ikkeSendt"
    | "timer.dagsoversikt.sendt"
    | "timer.dagsoversikt.returnert"
    | "timer.dagsoversikt.attestert";
  /** Amber = noe arbeideren må gjøre (R2). */
  amber: boolean;
};

/** Sedelens statusord i sum-kortet. Attestert er et grått ord, ikke grønt (§ 2.3). */
export function statusOrd(sedelStatus: string): StatusOrd {
  if (sedelStatus === "sent") return { nokkel: "timer.dagsoversikt.sendt", amber: false };
  if (sedelStatus === "returned") return { nokkel: "timer.dagsoversikt.returnert", amber: true };
  if (sedelStatus === "accepted") return { nokkel: "timer.dagsoversikt.attestert", amber: false };
  return { nokkel: "timer.dagsoversikt.ikkeSendt", amber: true };
}

/** Sum-kortets tall: arbeid/reise for hele dagen; maskin bare når aktuelt for minst ett prosjekt. */
export function dagsoversiktSum(linjer: readonly ProsjektLinjer<OversiktVare>[]): {
  arbeid: number;
  maskin: number | null;
  reise: number;
} {
  let arbeid = 0;
  let maskin = 0;
  let reise = 0;
  for (const l of linjer) {
    arbeid += l.summer.arbeid;
    maskin += l.summer.maskin;
    reise += l.summer.reise;
  }
  return { arbeid, maskin: linjer.some((l) => l.visMaskin) ? maskin : null, reise };
}

/**
 * TILLEGG (33) pkt 3 — timetallet i «Sum i dag» og på «Send dagen (N t)» i prosjektkort-modus.
 * Én kilde for begge. Fravær (`uten_prosjekt`) telles IKKE i dag: om det skal med, ligger hos
 * Kenneth (specen sier ikke noe). Når svaret kommer, er endringen denne ene linja.
 */
export function dagSumTimer(a: { arbeid: number; fravaer: number }): number {
  return a.arbeid;
}
