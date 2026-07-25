// Flyt-rettighetsmatrise — klient-definisjon (Kloss 2, config-design § 2).
//
// Strukturen (rader × kolonner) for admin-UI-et. Defaults leses fra @sitedoc/shared
// (ROLLE_HANDLINGER_DEFAULTS + isValidStatusTransition) — samme substrat som runtime, ingen
// duplisert logikk. Firmaets avvik (overrides) legges oppå per celle av siden.

import {
  ROLLE_HANDLINGER_DEFAULTS,
  isValidStatusTransition,
  flytRettighetNoekkel,
  PROSJEKTADMIN_ROLLE,
  type RettighetsOverrides,
} from "@sitedoc/shared";

/** Redigerbare kolonner: vanlige flyt-roller + prosjektadmin. IKKE firma-admin, IKKE sitedoc (fotnote). */
export const MATRISE_ROLLER = ["registrator", "bestiller", "utforer", "godkjenner", PROSJEKTADMIN_ROLLE] as const;
export type MatriseRolle = (typeof MATRISE_ROLLER)[number];

/** i18n-nøkkel for kolonneoverskrift per rolle. */
export const ROLLE_LABEL_NOEKKEL: Record<MatriseRolle, string> = {
  registrator: "dokumentflyt.registrator",
  bestiller: "dokumentflyt.bestiller",
  utforer: "dokumentflyt.utforer",
  godkjenner: "dokumentflyt.godkjenner",
  [PROSJEKTADMIN_ROLLE]: "flytmatrise.prosjektadmin",
};

// Sentinel for «(nytt)·Opprett»-raden (opprett er ingen statusovergang).
export const SENTINEL_FRA = "nytt";
export const SENTINEL_TIL = "opprett";

/** Auto-overganger (ingen rolle-celler) — rendres med «A»-merke, ikke klikkbare. */
export const AUTO_OVERGANGER: Array<{ fra: string; til: string }> = [
  { fra: "sent", til: "received" },
  { fra: "received", til: "in_progress" },
];

export interface MatriseRad {
  fra: string;
  til: string;
  /** i18n-nøkkel for handlingsetiketten (gjenbruker statushandling-nøkler der mulig). */
  labelNoekkel: string;
}

/**
 * Overgangsuniverset som rader (fra → til), gruppert etter fra-status. Speiler
 * hentStatusHandlinger-universet + Opprett-sentinelen. Auto-overganger er egne (over).
 */
export const MATRISE_RADER: MatriseRad[] = [
  { fra: SENTINEL_FRA, til: SENTINEL_TIL, labelNoekkel: "flytmatrise.opprett" },
  { fra: "draft", til: "sent", labelNoekkel: "handling.send" },
  { fra: "draft", til: "deleted", labelNoekkel: "handling.slett" },
  { fra: "sent", til: "cancelled", labelNoekkel: "statushandling.trekkTilbake" },
  { fra: "received", til: "responded", labelNoekkel: "statushandling.besvar" },
  { fra: "received", til: "forwarded", labelNoekkel: "statushandling.videresend" },
  { fra: "received", til: "cancelled", labelNoekkel: "handling.avvis" },
  { fra: "in_progress", til: "responded", labelNoekkel: "statushandling.besvar" },
  { fra: "in_progress", til: "sent", labelNoekkel: "statushandling.sendTilbake" },
  { fra: "in_progress", til: "forwarded", labelNoekkel: "statushandling.videresend" },
  { fra: "in_progress", til: "cancelled", labelNoekkel: "handling.avvis" },
  { fra: "responded", til: "approved", labelNoekkel: "handling.godkjenn" },
  { fra: "responded", til: "rejected", labelNoekkel: "statushandling.sendTilbakeUtforer" },
  { fra: "responded", til: "forwarded", labelNoekkel: "statushandling.videresend" },
  { fra: "rejected", til: "in_progress", labelNoekkel: "statushandling.gjenoppta" },
  { fra: "rejected", til: "sent", labelNoekkel: "statushandling.sendPaaNytt" },
  { fra: "rejected", til: "forwarded", labelNoekkel: "statushandling.videresend" },
  { fra: "rejected", til: "closed", labelNoekkel: "handling.lukk" },
  { fra: "approved", til: "closed", labelNoekkel: "handling.lukk" },
  { fra: "approved", til: "forwarded", labelNoekkel: "statushandling.videresend" },
  { fra: "cancelled", til: "draft", labelNoekkel: "statushandling.gjenapne" },
  { fra: "cancelled", til: "deleted", labelNoekkel: "handling.slett" },
];

/** i18n-nøkkel for fra-status-gruppens overskrift. */
export const STATUS_LABEL_NOEKKEL: Record<string, string> = {
  [SENTINEL_FRA]: "flytmatrise.status.nytt",
  draft: "flytmatrise.status.draft",
  sent: "flytmatrise.status.sent",
  received: "flytmatrise.status.received",
  in_progress: "flytmatrise.status.in_progress",
  responded: "flytmatrise.status.responded",
  rejected: "flytmatrise.status.rejected",
  approved: "flytmatrise.status.approved",
  cancelled: "flytmatrise.status.cancelled",
};

export type CelleTilstand = "standard-pa" | "standard-av" | "overstyrt-pa" | "overstyrt-av" | "laast";

const PSEUDO_TIL = new Set(["deleted", "forwarded"]);

/** Er en positiv override strukturelt gyldig? (Opprett-sentinel + pseudo + statusmaskin.) */
export function erStruktureltGyldig(fra: string, til: string): boolean {
  if (fra === SENTINEL_FRA && til === SENTINEL_TIL) return true;
  if (PSEUDO_TIL.has(til)) return true;
  return isValidStatusTransition(fra, til);
}

/** Default-rett for én celle (uten overrides). Prosjektadmin = full innenfor statusmaskinen. */
export function celleDefault(rolle: MatriseRolle, fra: string, til: string): boolean {
  if (rolle === PROSJEKTADMIN_ROLLE) return erStruktureltGyldig(fra, til);
  return ROLLE_HANDLINGER_DEFAULTS[rolle]?.[fra]?.has(til) ?? false;
}

/**
 * Lov-låste celler (ikke konfigurerbare, config-design § 2.5):
 * - Registrator × «Opprett» — oppretter oppretter alltid sitt eget dokument (invariant).
 * - Celler som er strukturelt ugyldige å slå på (kan aldri bli «på» — statusmaskin-snittet).
 *
 * Fase-1-tolkning (flagges for fabel ved gaten): P2-kommentarkrav og øvrige lov-celler
 * utvides her når de er endelig vedtatt.
 */
export function celleLaast(rolle: MatriseRolle, fra: string, til: string): boolean {
  if (rolle === "registrator" && fra === SENTINEL_FRA && til === SENTINEL_TIL) return true;
  if (!erStruktureltGyldig(fra, til)) return true;
  return false;
}

/** Effektiv celle-tilstand gitt overrides-map (nøkkel `${rolle}:${fra}:${til}`). */
export function celleTilstand(
  rolle: MatriseRolle,
  fra: string,
  til: string,
  overrides: RettighetsOverrides,
): CelleTilstand {
  if (celleLaast(rolle, fra, til)) return "laast";
  const noekkel = flytRettighetNoekkel(rolle, fra, til);
  if (noekkel in overrides) return overrides[noekkel] ? "overstyrt-pa" : "overstyrt-av";
  return celleDefault(rolle, fra, til) ? "standard-pa" : "standard-av";
}
