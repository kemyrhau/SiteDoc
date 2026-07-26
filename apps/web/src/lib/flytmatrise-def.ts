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
 * F3: fantom-raden received→in_progress er fjernet — in_progress nås nå kun via
 * responded→in_progress (Send tilbake), aldri via en auto-overgang.
 */
export const AUTO_OVERGANGER: Array<{ fra: string; til: string; flythjelpNoekkel?: string }> = [
  { fra: "sent", til: "received", flythjelpNoekkel: "flythjelp.handling.autoMottatt" },
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
  // F6 (Godkjenn fra Mottatt): direkte godkjenn-vei fra Mottatt for Registrator→Godkjenner-flyt uten
  // utfører. Default-roller Godkjenner + Prosjektadmin (avledes fra ROLLE_HANDLINGER_DEFAULTS +
  // statusmaskin). Gjenbruker flythjelp.handling.godkjenn — samme mikrotekst som responded→approved.
  { fra: "received", til: "approved", labelNoekkel: "handling.godkjenn", flythjelpNoekkel: "flythjelp.handling.godkjenn" },
  // F5 (Send/Videresend-paring, beslutning 6): Send fram i flyten — gjenbruker handling.send.
  { fra: "received", til: "sent", labelNoekkel: "handling.send", flythjelpNoekkel: "flythjelp.handling.send", fallbackNoekkel: "flythjelp.fallback.nesteMottaker" },
  { fra: "received", til: "draft", labelNoekkel: "statushandling.trekkTilbake", flythjelpNoekkel: "flythjelp.handling.trekkTilbake", fallbackNoekkel: "flythjelp.fallback.mottakerDin" },
  { fra: "received", til: "forwarded", labelNoekkel: "statushandling.videresend", flythjelpNoekkel: "flythjelp.handling.videresend", fallbackNoekkel: "flythjelp.fallback.videresendMottaker" },
  { fra: "received", til: "dismissed", labelNoekkel: "handling.avvis", flythjelpNoekkel: "flythjelp.handling.avvis", fallbackNoekkel: "flythjelp.fallback.avsender" },
  // F3 (Under arbeid): merget in_progress-seksjon (dagens in_progress + rejected). Besvar /
  // Send på nytt / Lukk / Videresend. Gammel `sendTilbake` (in_progress→sent uten svar) er nå
  // «Send på nytt» (fram igjen etter retting), og `avvis` (→cancelled) utgår.
  { fra: "in_progress", til: "responded", labelNoekkel: "statushandling.besvar", flythjelpNoekkel: "flythjelp.handling.besvar", fallbackNoekkel: "flythjelp.fallback.avsender" },
  { fra: "in_progress", til: "sent", labelNoekkel: "statushandling.sendPaaNytt", flythjelpNoekkel: "flythjelp.handling.sendPaaNytt", fallbackNoekkel: "flythjelp.fallback.nesteMottaker" },
  { fra: "in_progress", til: "closed", labelNoekkel: "handling.lukk", flythjelpNoekkel: "flythjelp.handling.lukk" },
  { fra: "in_progress", til: "forwarded", labelNoekkel: "statushandling.videresend", flythjelpNoekkel: "flythjelp.handling.videresend", fallbackNoekkel: "flythjelp.fallback.videresendMottaker" },
  { fra: "responded", til: "approved", labelNoekkel: "handling.godkjenn", flythjelpNoekkel: "flythjelp.handling.godkjenn" },
  // F3: Send tilbake ruter DIREKTE til Under arbeid (responded→in_progress) — ingen Gjenoppta.
  { fra: "responded", til: "in_progress", labelNoekkel: "statushandling.sendTilbakeUtforer", flythjelpNoekkel: "flythjelp.handling.sendTilbakeUtforer", fallbackNoekkel: "flythjelp.fallback.utforer" },
  // F5 (Send/Videresend-paring): Send fram fra svar-leddet (responded→sent, for-staget i F3).
  { fra: "responded", til: "sent", labelNoekkel: "handling.send", flythjelpNoekkel: "flythjelp.handling.send", fallbackNoekkel: "flythjelp.fallback.nesteMottaker" },
  { fra: "responded", til: "forwarded", labelNoekkel: "statushandling.videresend", flythjelpNoekkel: "flythjelp.handling.videresend", fallbackNoekkel: "flythjelp.fallback.videresendMottaker" },
  // F3: `rejected`-seksjonen utgår (merget inn i in_progress over).
  // H6 (Godkjent = stoppsted): approved→closed fjernet (Godkjent lukkes aldri). Gjenåpne
  // (approved→draft) er veien tilbake — default-roller registrator + prosjektadmin (avledes fra
  // ROLLE_HANDLINGER_DEFAULTS). Gjenbruker gjenapne-mikrotekst (samme som øvrig Gjenåpne).
  { fra: "approved", til: "draft", labelNoekkel: "statushandling.gjenapne", flythjelpNoekkel: "flythjelp.handling.gjenapne" },
  // F5 (Send/Videresend-paring): Send fram fra godkjent (approved→sent).
  { fra: "approved", til: "sent", labelNoekkel: "handling.send", flythjelpNoekkel: "flythjelp.handling.send", fallbackNoekkel: "flythjelp.fallback.nesteMottaker" },
  { fra: "approved", til: "forwarded", labelNoekkel: "statushandling.videresend", flythjelpNoekkel: "flythjelp.handling.videresend", fallbackNoekkel: "flythjelp.fallback.videresendMottaker" },
  // F4 (Gjenåpne-samling, spec § 3): closed/dismissed/cancelled → draft er ÉN handling
  // (Gjenåpne) — henter et avsluttet dokument tilbake til kladd hos oppretteren. Default-
  // roller: registrator + prosjektadmin (avledes fra ROLLE_HANDLINGER_DEFAULTS). cancelled er legacy.
  { fra: "closed", til: "draft", labelNoekkel: "statushandling.gjenapne", flythjelpNoekkel: "flythjelp.handling.gjenapne" },
  { fra: "dismissed", til: "draft", labelNoekkel: "statushandling.gjenapne", flythjelpNoekkel: "flythjelp.handling.gjenapne" },
  { fra: "cancelled", til: "draft", labelNoekkel: "statushandling.gjenapne", flythjelpNoekkel: "flythjelp.handling.gjenapne" },
  // Fiks 2 (klikktest): F0 soft-delete gjelder også trukket-tilbake dokument → 90-dagers papirkurv,
  // ikke «permanent». Koherens med hover (DokumentHandlingsmeny). slettTrukket beholdes som relikvi.
  { fra: "cancelled", til: "deleted", labelNoekkel: "handling.slett", flythjelpNoekkel: "flythjelp.handling.slett" },
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
  if (erVideresendAdminLaast(rolle, fra, til)) return true;
  return false;
}

/**
 * H3 (videresend-rettighet, fabel-vedtak 2026-07-26): Videresend (`til = "forwarded"`) er admin-only.
 * For flyt-roller (ikke prosjektadmin) vises cellen LÅST (hengelås), ikke som en av-celle man kan
 * klikke PÅ — en positiv override ville uansett vært en no-op: runtime (`celleTillatt` i
 * statusHandlinger) snitter override mot `isValidStatusTransition`, og `forwarded` ligger utenfor den.
 * Prosjektadmins videresend-celle forblir PÅ (via `celleDefault` → `erStruktureltGyldig`).
 * Styrer også lås-tooltipen i matrise-UI-et.
 */
export function erVideresendAdminLaast(rolle: MatriseRolle, _fra: string, til: string): boolean {
  return til === "forwarded" && rolle !== PROSJEKTADMIN_ROLLE;
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

/** Slå opp rad-metadata (etikett + mikrotekst) for en (fra → til)-overgang. Hver overgang er unik. */
export function finnRad(fra: string, til: string): MatriseRad | undefined {
  return MATRISE_RADER.find((r) => r.fra === fra && r.til === til);
}

/* ------------------------------------------------------------------ */
/*  Flytvisning — boks/retningsgruppe-projeksjon (ordre 2026-07-26)     */
/* ------------------------------------------------------------------ */
//
// Ren PROJEKSJON over de samme cellene som matrise-fanen (rolle · fra · til). Ingen ny lagring,
// intet nytt skjema: hver bryter ER en matrisecelle. Denne mappingen legger KUN på hvor cellen
// vises (boks + retningsgruppe). Etikett/mikrotekst/tilstand hentes fra den delte def-en over
// (MATRISE_RADER + celleTilstand), så de to fanene kan ikke drifte.
//
// Fabel-bekreftet mapping 2026-07-26 med to korreksjoner:
//   (a) Gjenåpne vises der den er redigerbar — registrator-cellene i Registrator-boksen (LOKALT)
//       OG prosjektadmin-cellene i admin-sonen. Distinkte celler, én bryter per (rolle × overgang).
//   (b) «Slett kladd» (draft→deleted, soft) i Registrator- OG Bestiller-boks (LOKALT). Admin-Slett
//       er admin-cellen. «Slett endelig» (hard, deletedAt-basert, F0) er IKKE en matrisecelle og
//       vises ikke her — den hører til papirkurv-UI-et. Papirkurv-pseudoene (slettet→*) utelates.

/** Flytboks = én flyt-rolle med egen «stasjon» i visningen. Prosjektadmin er IKKE en boks (egen sone). */
export type Flytboks = "registrator" | "bestiller" | "utforer" | "godkjenner";

/** De fire boksene i venstre-mot-høyre-rekkefølge (dokumentflyten). */
export const FLYTVISNING_BOKSER: Flytboks[] = ["registrator", "bestiller", "utforer", "godkjenner"];

/** Retningsgruppe innenfor en boks — rendret i denne rekkefølgen der de finnes. */
export type Retningsgruppe = "sendHoyre" | "sendVenstre" | "hentTilbake" | "endepunkt" | "lokalt";
export const RETNINGSGRUPPE_REKKEFOLGE: Retningsgruppe[] = [
  "sendHoyre",
  "sendVenstre",
  "hentTilbake",
  "endepunkt",
  "lokalt",
];

/** i18n-nøkkel for retningsgruppe-overskrift. Pil-glyfen legges på i UI-et. */
export const RETNINGSGRUPPE_NOEKKEL: Record<Retningsgruppe, string> = {
  sendHoyre: "flytvisning.gruppe.sendHoyre",
  sendVenstre: "flytvisning.gruppe.sendVenstre",
  hentTilbake: "flytvisning.gruppe.hentTilbake",
  endepunkt: "flytvisning.gruppe.endepunkt",
  lokalt: "flytvisning.gruppe.lokalt",
};

/**
 * En oppføring i en retningsgruppe: enten en ekte celle (rolle · fra · til) eller et H2-fantom
 * (manglende overgang — disabled ?-bryter, IKKE en celle, IKKE klikkbar).
 */
export type FlytEntry =
  | { type: "celle"; rolle: MatriseRolle; fra: string; til: string }
  | { type: "fantom"; labelNoekkel: string };

/** Kortform for en celle-entry i en flyt-rolle-boks (rollen er gitt av boksen). */
const c = (rolle: MatriseRolle, fra: string, til: string): FlytEntry => ({ type: "celle", rolle, fra, til });

export interface FlytboksDef {
  boks: Flytboks;
  /** Bestiller er ikke egen stasjon i dagens statusmaskin (H1) → stiplet ramme + H1-merke. */
  stiplet?: boolean;
  grupper: Partial<Record<Retningsgruppe, FlytEntry[]>>;
  /**
   * Videresend for flyt-roller er admin-only (H3) → egen LÅST chip (hengelås) nederst i boksen.
   * Representativ celle (received→forwarded) — celleLaast/erVideresendAdminLaast gir «laast».
   */
  videresendLaast: FlytEntry & { type: "celle" };
}

/**
 * Mapping per flyt-rolle-boks. Cellene er utledet fra ROLLE_HANDLINGER_DEFAULTS (hvilke overganger
 * rollen eier) og gruppert etter overgangens retning. Opprett-cellen (registrator) er lov-låst
 * (celleLaast) → rendres med hengelås. H2-fantomene er «Besvar/send tilbake» (bestiller) og
 * «Send tilbake (be om noe)» (utfører).
 */
export const FLYTVISNING_BOKS_DEF: FlytboksDef[] = [
  {
    boks: "registrator",
    grupper: {
      sendHoyre: [c("registrator", "draft", "sent")],
      hentTilbake: [c("registrator", "received", "draft")],
      lokalt: [
        c("registrator", SENTINEL_FRA, SENTINEL_TIL), // Opprett — lov-låst (hengelås)
        c("registrator", "draft", "deleted"), // Slett kladd (soft)
        // Gjenåpne (korreksjon a): registrator-cellene der de er redigerbare.
        c("registrator", "closed", "draft"),
        c("registrator", "dismissed", "draft"),
        c("registrator", "cancelled", "draft"),
        c("registrator", "approved", "draft"),
      ],
    },
    videresendLaast: c("registrator", "received", "forwarded") as FlytEntry & { type: "celle" },
  },
  {
    boks: "bestiller",
    stiplet: true, // H1
    grupper: {
      sendHoyre: [c("bestiller", "draft", "sent")],
      sendVenstre: [{ type: "fantom", labelNoekkel: "flytvisning.fantom.bestillerBesvar" }],
      hentTilbake: [c("bestiller", "received", "draft")],
      endepunkt: [c("bestiller", "in_progress", "closed")],
      lokalt: [c("bestiller", "draft", "deleted")], // Slett kladd (korreksjon b)
    },
    videresendLaast: c("bestiller", "received", "forwarded") as FlytEntry & { type: "celle" },
  },
  {
    boks: "utforer",
    grupper: {
      sendHoyre: [c("utforer", "received", "sent"), c("utforer", "in_progress", "sent")],
      sendVenstre: [
        c("utforer", "received", "responded"), // Besvar — svar går til den som ba
        c("utforer", "in_progress", "responded"),
        { type: "fantom", labelNoekkel: "flytvisning.fantom.utforerSendTilbake" },
      ],
      endepunkt: [c("utforer", "received", "dismissed")], // Avvis
    },
    videresendLaast: c("utforer", "received", "forwarded") as FlytEntry & { type: "celle" },
  },
  {
    boks: "godkjenner",
    grupper: {
      sendHoyre: [c("godkjenner", "responded", "sent"), c("godkjenner", "approved", "sent")],
      sendVenstre: [c("godkjenner", "responded", "in_progress")], // Send tilbake til utfører
      endepunkt: [
        c("godkjenner", "received", "approved"), // Godkjenn fra Mottatt (F6)
        c("godkjenner", "responded", "approved"), // Godkjenn
        c("godkjenner", "in_progress", "closed"), // Lukk
      ],
    },
    videresendLaast: c("godkjenner", "received", "forwarded") as FlytEntry & { type: "celle" },
  },
];

/**
 * Prosjektadmin-sonen (full bredde under boks-linjen) — IKKE en boks. Kuraterte admin-handlinger
 * i ordrens rekkefølge: Opprett · Videresend på tvers · Gjenåpne · Lukk trukket [Farlig] · Slett.
 * Alle celler er prosjektadmin-kolonnens egne (distinkt fra rolle-boksenes celler).
 */
export interface AdminSoneGruppe {
  labelNoekkel: string;
  /** Farlig sone (destruktivt) → rød aksent i UI. */
  farlig?: boolean;
  celler: Array<{ type: "celle"; rolle: MatriseRolle; fra: string; til: string }>;
}

const pa = (fra: string, til: string): { type: "celle"; rolle: MatriseRolle; fra: string; til: string } => ({
  type: "celle",
  rolle: PROSJEKTADMIN_ROLLE,
  fra,
  til,
});

export const FLYTVISNING_ADMIN_SONE: AdminSoneGruppe[] = [
  { labelNoekkel: "flytvisning.admin.opprett", celler: [pa(SENTINEL_FRA, SENTINEL_TIL)] },
  {
    labelNoekkel: "flytvisning.admin.videresend",
    celler: [pa("received", "forwarded"), pa("in_progress", "forwarded"), pa("responded", "forwarded"), pa("approved", "forwarded")],
  },
  {
    labelNoekkel: "flytvisning.admin.gjenapne",
    celler: [pa("closed", "draft"), pa("dismissed", "draft"), pa("cancelled", "draft"), pa("approved", "draft")],
  },
  { labelNoekkel: "flytvisning.admin.lukkTrukket", farlig: true, celler: [pa("cancelled", "deleted")] },
  { labelNoekkel: "flytvisning.admin.slett", celler: [pa("draft", "deleted")] },
];
