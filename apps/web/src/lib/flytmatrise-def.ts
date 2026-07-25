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

/**
 * Auto-overganger (ingen rolle-celler) — rendres med «A»-merke, ikke klikkbare.
 * `flythjelpNoekkel` (valgfri): kun sent→received får mikrotekst-hover (autoMottatt).
 * received→in_progress er en fantom (serveren auto-fyrer aldri den — in_progress nås
 * kun via gjenoppta) og skal stå urørt uten hover; se mikrotekst-spec ⚠2.
 */
export const AUTO_OVERGANGER: Array<{ fra: string; til: string; flythjelpNoekkel?: string }> = [
  { fra: "sent", til: "received", flythjelpNoekkel: "flythjelp.handling.autoMottatt" },
  { fra: "received", til: "in_progress" },
];

export interface MatriseRad {
  fra: string;
  til: string;
  /** i18n-nøkkel for handlingsetiketten (gjenbruker statushandling-nøkler der mulig). */
  labelNoekkel: string;
  /** i18n-nøkkel for mikrotekst-brødteksten (flythjelp.handling.*) — delt kilde med knappe-flaten. */
  flythjelpNoekkel: string;
  /**
   * i18n-nøkkel for den relasjonelle fallback-benevnelsen som fyller {{mottaker}} i matrisen
   * (matrisen kjenner ingen konkret person). Utelatt når brødteksten ikke har {{mottaker}}.
   */
  fallbackNoekkel?: string;
}

/**
 * Overgangsuniverset som rader (fra → til), gruppert etter fra-status. Speiler
 * hentStatusHandlinger-universet + Opprett-sentinelen. Auto-overganger er egne (over).
 */
export const MATRISE_RADER: MatriseRad[] = [
  { fra: SENTINEL_FRA, til: SENTINEL_TIL, labelNoekkel: "flytmatrise.opprett", flythjelpNoekkel: "flythjelp.handling.opprett" },
  { fra: "draft", til: "sent", labelNoekkel: "handling.send", flythjelpNoekkel: "flythjelp.handling.send", fallbackNoekkel: "flythjelp.fallback.nesteMottaker" },
  { fra: "draft", til: "deleted", labelNoekkel: "handling.slett", flythjelpNoekkel: "flythjelp.handling.slett" },
  // F2 (D-1): `sent`-seksjonen utgår (transient). Trekk tilbake flyttet til received→draft.
  { fra: "received", til: "responded", labelNoekkel: "statushandling.besvar", flythjelpNoekkel: "flythjelp.handling.besvar", fallbackNoekkel: "flythjelp.fallback.avsender" },
  { fra: "received", til: "draft", labelNoekkel: "statushandling.trekkTilbake", flythjelpNoekkel: "flythjelp.handling.trekkTilbake", fallbackNoekkel: "flythjelp.fallback.mottakerDin" },
  { fra: "received", til: "forwarded", labelNoekkel: "statushandling.videresend", flythjelpNoekkel: "flythjelp.handling.videresend", fallbackNoekkel: "flythjelp.fallback.videresendMottaker" },
  { fra: "received", til: "dismissed", labelNoekkel: "handling.avvis", flythjelpNoekkel: "flythjelp.handling.avvis", fallbackNoekkel: "flythjelp.fallback.avsender" },
  { fra: "in_progress", til: "responded", labelNoekkel: "statushandling.besvar", flythjelpNoekkel: "flythjelp.handling.besvar", fallbackNoekkel: "flythjelp.fallback.avsender" },
  { fra: "in_progress", til: "sent", labelNoekkel: "statushandling.sendTilbake", flythjelpNoekkel: "flythjelp.handling.sendTilbake", fallbackNoekkel: "flythjelp.fallback.avsender" },
  { fra: "in_progress", til: "forwarded", labelNoekkel: "statushandling.videresend", flythjelpNoekkel: "flythjelp.handling.videresend", fallbackNoekkel: "flythjelp.fallback.videresendMottaker" },
  { fra: "in_progress", til: "cancelled", labelNoekkel: "handling.avvis", flythjelpNoekkel: "flythjelp.handling.avvis", fallbackNoekkel: "flythjelp.fallback.avsender" },
  { fra: "responded", til: "approved", labelNoekkel: "handling.godkjenn", flythjelpNoekkel: "flythjelp.handling.godkjenn" },
  { fra: "responded", til: "rejected", labelNoekkel: "statushandling.sendTilbakeUtforer", flythjelpNoekkel: "flythjelp.handling.sendTilbakeUtforer", fallbackNoekkel: "flythjelp.fallback.utforer" },
  { fra: "responded", til: "forwarded", labelNoekkel: "statushandling.videresend", flythjelpNoekkel: "flythjelp.handling.videresend", fallbackNoekkel: "flythjelp.fallback.videresendMottaker" },
  { fra: "rejected", til: "in_progress", labelNoekkel: "statushandling.gjenoppta", flythjelpNoekkel: "flythjelp.handling.gjenoppta" },
  { fra: "rejected", til: "sent", labelNoekkel: "statushandling.sendPaaNytt", flythjelpNoekkel: "flythjelp.handling.sendPaaNytt", fallbackNoekkel: "flythjelp.fallback.nesteMottaker" },
  { fra: "rejected", til: "forwarded", labelNoekkel: "statushandling.videresend", flythjelpNoekkel: "flythjelp.handling.videresend", fallbackNoekkel: "flythjelp.fallback.videresendMottaker" },
  { fra: "rejected", til: "closed", labelNoekkel: "handling.lukk", flythjelpNoekkel: "flythjelp.handling.lukk" },
  { fra: "approved", til: "closed", labelNoekkel: "handling.lukk", flythjelpNoekkel: "flythjelp.handling.lukk" },
  { fra: "approved", til: "forwarded", labelNoekkel: "statushandling.videresend", flythjelpNoekkel: "flythjelp.handling.videresend", fallbackNoekkel: "flythjelp.fallback.videresendMottaker" },
  { fra: "cancelled", til: "draft", labelNoekkel: "statushandling.gjenapne", flythjelpNoekkel: "flythjelp.handling.gjenapne" },
  { fra: "cancelled", til: "deleted", labelNoekkel: "handling.slett", flythjelpNoekkel: "flythjelp.handling.slettTrukket" },
  // F0 soft-delete — papirkurv-handlinger fra visningsstatus «Slettet» (deletedAt).
  { fra: "slettet", til: "gjenopprett", labelNoekkel: "statushandling.gjenopprett", flythjelpNoekkel: "flythjelp.handling.gjenopprett" },
  { fra: "slettet", til: "slett_endelig", labelNoekkel: "statushandling.slettEndelig", flythjelpNoekkel: "flythjelp.handling.slettEndelig" },
];

/**
 * i18n-nøkkel for status-etikett. Brukes til fra-gruppens overskrift OG til «ny status»-delen
 * av mikrotekst-tittelen (Handling → Ny status). Dekker derfor også pseudo-/terminalstatuser
 * (deleted/forwarded/closed) og Opprett-sentinelen (→ Kladd, K-vedtak 2026-07-25).
 */
export const STATUS_LABEL_NOEKKEL: Record<string, string> = {
  [SENTINEL_FRA]: "flytmatrise.status.nytt",
  // Opprett-raden får «Kladd» som ny status i tittelen («Opprett → Kladd») — ingen egen opprett-status.
  [SENTINEL_TIL]: "flytmatrise.status.draft",
  draft: "flytmatrise.status.draft",
  sent: "flytmatrise.status.sent",
  received: "flytmatrise.status.received",
  in_progress: "flytmatrise.status.in_progress",
  responded: "flytmatrise.status.responded",
  rejected: "flytmatrise.status.rejected",
  approved: "flytmatrise.status.approved",
  cancelled: "flytmatrise.status.cancelled",
  dismissed: "flytmatrise.status.dismissed",
  closed: "flytmatrise.status.closed",
  deleted: "flytmatrise.status.deleted",
  slettet: "flytmatrise.status.slettet",
  gjenopprett: "flytmatrise.status.gjenopprett",
  slett_endelig: "flytmatrise.status.slett_endelig",
  forwarded: "flytmatrise.status.forwarded",
};

/** t-signatur som tillater interpolasjons-opsjoner (i18next TFunction er kompatibel). */
export type OversettFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Mikrotekst-tittel for en matrise-rad: «Handling → Ny status» (f.eks. «Send → Mottatt»).
 * Ingen egne tittel-nøkler — bygges av eksisterende label- + status-nøkler.
 */
export function matriseTittel(rad: MatriseRad, t: OversettFn): string {
  return `${t(rad.labelNoekkel)} → ${t(STATUS_LABEL_NOEKKEL[rad.til] ?? rad.til)}`;
}

/**
 * Mikrotekst-brødtekst: fyller {{mottaker}} med fallback-benevnelsen (matrise) eller resolvert
 * navn (knappe-flate). i18next-interpolasjon — ingen {{mottaker}} lekker til skjerm.
 */
export function flythjelpTekst(flythjelpNoekkel: string, mottaker: string | undefined, t: OversettFn): string {
  return mottaker !== undefined ? t(flythjelpNoekkel, { mottaker }) : t(flythjelpNoekkel);
}

export type CelleTilstand = "standard-pa" | "standard-av" | "overstyrt-pa" | "overstyrt-av" | "laast";

const PSEUDO_TIL = new Set(["deleted", "forwarded", "gjenopprett", "slett_endelig"]);

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
