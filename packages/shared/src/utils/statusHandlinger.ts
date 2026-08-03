import type { DocumentStatus, DokumentflytRolle } from "../types";
import { isValidStatusTransition } from "./index";

export interface StatusHandling {
  tekstNoekkel: string;
  nyStatus: DocumentStatus | "deleted" | "forwarded";
  farge: string;
  aktivFarge: string;
  /** Primærhandling — vises som hovedknapp i kompakt meny */
  erPrimaer?: boolean;
}

/**
 * Hent tilgjengelige statushandlinger for en gitt dokumentstatus.
 * Brukes i sjekkliste- og oppgave-detaljskjermer (mobil + web).
 * `tekstNoekkel` er en i18n-nøkkel — kall `t(handling.tekstNoekkel)` ved rendering.
 * Første handling i listen er primærhandling (erPrimaer=true).
 */
export function hentStatusHandlinger(status: string): StatusHandling[] {
  // Runde-2 (2026-08-02, fabel-vedtatt): `in_progress` er kollapset HELT (Q1=A). Statusen skrives
  // aldri lenger (avledStatus gir alltid received/«Hos N»), «Send tilbake» (responded→in_progress) er
  // fjernet, og in_progress-grenen finnes ikke mer → tomt handlingssett. Legacy in_progress-dok
  // re-avledes til received av backfill-scriptet (apps/api/scripts/backfill-flytmodell-gjenapne-status.ts).
  const handlinger: Record<string, StatusHandling[]> = {
    draft: [
      { tekstNoekkel: "handling.send", nyStatus: "sent", farge: "bg-blue-600", aktivFarge: "bg-blue-400", erPrimaer: true },
      { tekstNoekkel: "handling.slett", nyStatus: "deleted", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    // F2 (D-1): `sent` er transient (auto→received) — ingen handlinger bor her.
    received: [
      // Fase 4 steg 4b (2026-08-01): «Send til N·X →» GJENINNFØRT fra received. Fase 3.6 gjorde
      // received→sent meningsfull (ruter via nesteLedd, aldri recipient-løs); dette wirer UI-tilbudet.
      // Primær fra received = Send forover (fabel-design 2); Besvar demotert til sekundær (retur bakover).
      { tekstNoekkel: "handling.send", nyStatus: "sent", farge: "bg-blue-600", aktivFarge: "bg-blue-400", erPrimaer: true },
      { tekstNoekkel: "statushandling.besvar", nyStatus: "responded", farge: "bg-purple-600", aktivFarge: "bg-purple-400" },
      // F6 (Godkjenn fra Mottatt): direkte godkjenn-vei for Registrator→Godkjenner-flyt uten utfører.
      { tekstNoekkel: "handling.godkjenn", nyStatus: "approved", farge: "bg-green-600", aktivFarge: "bg-green-400" },
      // Trekk tilbake: avsender-siden henter en sendt hendelse tilbake FØR mottaker svarer
      // (received→draft). Fase 4: gatet på seerErBakover ∨ admin (ikke rolle).
      { tekstNoekkel: "statushandling.trekkTilbake", nyStatus: "draft", farge: "bg-amber-500", aktivFarge: "bg-amber-400" },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
      // F1: Avvis ruter nå til egen «Avvist»-status (dismissed), ikke lenger cancelled.
      { tekstNoekkel: "handling.avvis", nyStatus: "dismissed", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    // Runde-2: `in_progress`-grenen fjernet (kollapset → received, aliaset øverst). Lukk (→closed)
    // for KS-avvik/HMS går uansett via firma-terminal (hms.ts), ikke denne grenen.
    responded: [
      // Pilot-fiks B (2026-08-02, fabel-bindende): «Send til N·X →» GJENINNFØRT fra Besvart, som
      // received (Fase 3.6/4b). Ruter via nesteLedd (ball-guardet), aldri recipient-løs no-op — det
      // fjerner §8A-bekymringen i posisjonsmodellen. Klientens primær-utledning velger Send når
      // nesteLedд≠null, Godkjenn-og-fullfør når nesteLedд=null (erPrimaer beholdt på approved for
      // ikke-flyt/fallback). Ledд som mottar Besvar men ikke er siste → primær Send, ikke Godkjenn.
      { tekstNoekkel: "handling.send", nyStatus: "sent", farge: "bg-blue-600", aktivFarge: "bg-blue-400" },
      { tekstNoekkel: "handling.godkjenn", nyStatus: "approved", farge: "bg-green-600", aktivFarge: "bg-green-400", erPrimaer: true },
      // Runde-2 (2026-08-02): «Send tilbake» (responded→in_progress) FJERNET. Besvar ← (fra received)
      // er nå den eneste bakover-handlingen — ruter via forrigeBallLedd. Én bakover-vei, ingen in_progress.
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
    ],
    // H6 (Godkjent = stoppsted): Godkjent lukkes ALDRI — Lukk fjernet. Veien tilbake er Gjenåpne
    // (approved→draft, samme handling som øvrig gjenåpne). Videresend beholdt (sende-kapasitet
    // ok på en låst suksess-terminal).
    approved: [
      { tekstNoekkel: "statushandling.gjenapne", nyStatus: "draft", farge: "bg-blue-600", aktivFarge: "bg-blue-400", erPrimaer: true },
      // §8A-fiks (2026-07-29): «Send fram» (approved→sent) FJERNET — samme recipient-løse no-op. Videresend beholdt.
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
    ],
    // F4 (Gjenåpne-samling): closed/dismissed/cancelled er avsluttede statuser. Gjenåpne
    // (→draft) henter dokumentet tilbake til kladd hos oppretteren — samme handling overalt.
    closed: [
      { tekstNoekkel: "statushandling.gjenapne", nyStatus: "draft", farge: "bg-blue-600", aktivFarge: "bg-blue-400", erPrimaer: true },
    ],
    // F4: Avvist gjenåpnes med valgfri begrunnelse (nudge, ikke påkrevd — motsatt av selve Avvis).
    dismissed: [
      { tekstNoekkel: "statushandling.gjenapne", nyStatus: "draft", farge: "bg-blue-600", aktivFarge: "bg-blue-400", erPrimaer: true },
    ],
    cancelled: [
      { tekstNoekkel: "statushandling.gjenapne", nyStatus: "draft", farge: "bg-blue-600", aktivFarge: "bg-blue-400", erPrimaer: true },
      { tekstNoekkel: "handling.slett", nyStatus: "deleted", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
  };
  return handlinger[status] ?? [];
}

/**
 * Rollefiltrert handlingsliste.
 *
 * | Status       | registrator          | bestiller       | utfører                           | godkjenner                        |
 * |--------------|----------------------|-----------------|-----------------------------------|-----------------------------------|
 * | draft        | Send, Slett          | Send, Slett     | —                                 | —                                 |
 * | sent         | — (transient)        | — (transient)   | —                                 | —                                 |
 * | received     | Trekk tilbake        | Trekk tilbake   | Besvar, Avvis                     | Godkjenn (F6, fra Mottatt)        |
 * | in_progress  | — (kollapset, Runde-2)                                                                        |
 * | responded    | —                    | —           | —                                 | Godkjenn                          |
 * | approved     | Gjenåpne             | —           | —                                 | —                                 |
 * | closed       | Gjenåpne             | —           | —                                 | —                                 |
 * | dismissed    | Gjenåpne             | —           | —                                 | —                                 |
 * | cancelled    | Gjenåpne             | —           | —                                 | —                                 |
 *
 * H3 (videresend-rettighet, 2026-07-26): Videresend (`forwarded`) er fjernet fra utfører/godkjenner-
 * defaults — kun prosjektadmin har den (via statusmaskin-snittet). Cellene i matrisen står igjen så
 * et firma i prinsippet kan konfigurere, men default-haken er AV for flytroller.
 * Runde-2 (2026-08-02): `in_progress` er kollapset HELT (Q1=A) — grenen finnes ikke mer, «Send tilbake»
 * (responded→in_progress) fjernet. Bakover er nå kun Besvar ← (received→responded). Lukk for KS-avvik/
 * HMS går via firma-terminal (hms.ts), ikke in_progress→closed.
 * F4 (Gjenåpne-samling): closed/dismissed/cancelled → draft eies av registrator
 * (oppretter) + prosjektadmin (spec § 4). Bestiller mister gjenåpne (var legacy cancelled).
 * H6 (Godkjent = stoppsted): approved→closed er fjernet (Godkjent lukkes aldri). Veien tilbake
 * er Gjenåpne (approved→draft), samme eierskap som øvrig gjenåpne: registrator + prosjektadmin.
 */
export function hentRolleFiltrertHandlinger(
  status: string,
  rolle: DokumentflytRolle | null,
  adminNiva: AdminNiva | boolean,
  overrides?: RettighetsOverrides,
): StatusHandling[] {
  if (!rolle) return [];

  const alle = hentStatusHandlinger(status);
  const niva = normaliserAdminNiva(adminNiva);

  // sitedoc = kode-bypass: ser hele universet (uendret fra gammel erAdmin=true).
  if (niva === "sitedoc") return alle;

  // prosjektadmin: full INNENFOR statusmaskinen (bevarer dagens bypass), konfigurerbar nedover.
  if (niva === "prosjekt") {
    return alle.filter((h) => prosjektadminCelle(status, h.nyStatus, overrides));
  }

  // null (vanlig flyt-rolle, inkl. firma-admin): per celle override → default (celleTillatt).
  // Uten overrides = default-laget = bit-identisk med Kloss 1.
  return alle.filter((h) => celleTillatt(rolle, status, h.nyStatus, overrides));
}

/**
 * POSISJON-basert handlingsfilter (Fase 4 steg 4b, retning B). Erstatter det rolle-baserte
 * `hentRolleFiltrertHandlinger` i klienten — klienten viser nøyaktig det serveren autoriserer
 * (`verifiserRetningsrett`), én kilde. Ball-handlinger fra `retningsrettigheter`; admin ser hele
 * universet (bevart). § 2.4-guards (2026-08-01): trekk tilbake = avsenderleddet (`erAvsender`,
 * = den som sendte); gjenåpne = medlem av flyten ∨ admin (`erMedlemAvFlyt`).
 */
export interface PosisjonHandlingKontekst {
  retningsrett: { kanSende: boolean; kanBesvare: boolean; kanVideresende: boolean; kanTerminere: boolean };
  harBallen: boolean;
  /** § 2.4 trekk-tilbake: medlem av avsenderleddet (forrigeBallLedд = «den som sendte»). */
  erAvsender: boolean;
  /** § 2.4 gjenåpne: medlem av NOEN ledд i flyten (terminal→draft-rett for ikke-admin). */
  erMedlemAvFlyt: boolean;
  /** sitedoc/prosjekt-admin — ser hele det statusmaskin-gyldige universet. */
  erAdmin: boolean;
  /**
   * Runde-2-polering P1: er dette SISTE ball-ledд (`nesteLedd == null`)? Da har «Send» intet mål —
   * primæren er «Godkjenn og fullfør», og `sent` skal aldri tilbys (heller ikke i split, heller ikke
   * for admin). Gjelder IKKE draft (førstegangs-send). Kalleren utleder fra delt `nesteLedd`.
   */
  erSisteLedd?: boolean;
}

export function hentPosisjonFiltrertHandlinger(
  status: string,
  ctx: PosisjonHandlingKontekst,
): StatusHandling[] {
  const alle = hentStatusHandlinger(status);
  // P1: «Send» har intet mål på siste ledд (nesteLedd=null) → dropp `sent` FØR både admin-grenen og
  // rettighetsfilteret. draft (førstegangs-send) er unntatt. «Intet mål» er ikke et rettighetsspørsmål.
  const univers =
    ctx.erSisteLedd && status !== "draft" ? alle.filter((h) => h.nyStatus !== "sent") : alle;
  if (ctx.erAdmin) return univers;
  return univers.filter((h) => posisjonHandlingTillatt(status, h.nyStatus, ctx));
}

/** Terminal-statuser en draft-overgang kan komme FRA = Gjenåpne (i motsetning til Trekk tilbake fra received). */
const ER_TERMINAL_STATUS: ReadonlySet<string> = new Set(["approved", "dismissed", "closed", "cancelled", "rejected"]);

function posisjonHandlingTillatt(status: string, nyStatus: string, ctx: PosisjonHandlingKontekst): boolean {
  const { retningsrett, erAvsender, erMedlemAvFlyt } = ctx;
  switch (nyStatus) {
    case "sent": // Send til N·X (received/draft) + Send på nytt (in_progress)
      return retningsrett.kanSende;
    case "responded": // Besvar (retur bakover)
      return retningsrett.kanBesvare;
    case "approved":
    case "dismissed":
    case "closed":
    case "cancelled":
    case "rejected": // Godkjenn / Avvis / Lukk (terminaler)
      return retningsrett.kanTerminere;
    case "forwarded": // Videresend (H3)
      return retningsrett.kanVideresende;
    case "draft":
      // § 2.4 + Runde-2 #10b: received→draft = Trekk tilbake (avsenderleddet = den som sendte);
      // TERMINAL→draft = Gjenåpne (medlem av flyten; admin dekket over av erAdmin-grenen). Ferskt
      // utkast (status="draft"/"sent") tilbyr INGEN av delene — fjerner draft→draft-lekkasjen der
      // enhver flyt-medlem så «Trekk tilbake» på et usendt utkast (#10b).
      if (status === "received") return erAvsender;
      if (ER_TERMINAL_STATUS.has(status)) return erMedlemAvFlyt;
      return false;
    case "deleted": // går via onSlett (sletterett), ikke handlingsmenyen
      return false;
    default:
      return false;
  }
}

/**
 * Sjekk om en rolle har lov til å utføre en statusovergang.
 * Brukes av backend for API-rollevalidering.
 * Kun admin har alltid lov. null-rolle har aldri lov. Registrator har IKKE lenger
 * generell status-makt (Fase B) — kun overgangene ROLLE_HANDLINGER gir rollen
 * (send/slett på egen kladd); redigering/lesing håndteres i utledDokumentRettighet.
 */
export function erTillattForRolle(
  rolle: DokumentflytRolle | null,
  gjeldendStatus: string,
  nyStatus: string,
  adminNiva: AdminNiva | boolean,
  overrides?: RettighetsOverrides,
): boolean {
  // null-rolle aldri — sjekkes FØR admin-nivå (uendret fra Kloss 1: også sitedoc-admin
  // uten rolle får false).
  if (!rolle) return false;
  const niva = normaliserAdminNiva(adminNiva);
  // sitedoc = kode-bypass, uendret semantikk fra gammel erAdmin=true (også ulovlige overganger).
  if (niva === "sitedoc") return true;
  // prosjektadmin: full innenfor statusmaskinen, konfigurerbar nedover.
  if (niva === "prosjekt") return prosjektadminCelle(gjeldendStatus, nyStatus, overrides);
  // null (vanlig flyt-rolle, inkl. firma-admin): Kloss 1-stien (bit-identisk uten overrides).
  return celleTillatt(rolle, gjeldendStatus, nyStatus, overrides);
}

/**
 * Hvilke flyt-roller eier en gitt statusovergang (utenom admin, som eier alt).
 * Brukes av UI for å begrunne deaktiverte handlinger («Kun utfører» osv.) uten
 * å duplisere rollematrisen. Tom liste = kun admin (eierløs handling).
 */
export function hentHandlingEierRoller(status: string, nyStatus: string): DokumentflytRolle[] {
  const roller: DokumentflytRolle[] = [];
  for (const rolle of ["bestiller", "utforer", "godkjenner"] as const) {
    if (ROLLE_HANDLINGER_DEFAULTS[rolle]?.[status]?.has(nyStatus)) roller.push(rolle);
  }
  return roller;
}

/**
 * Per-firma rettighets-overstyringer (delta-modellen, config-design § 1).
 * Nøkkel: `${rolle}:${fraStatus}:${tilStatus}` → tillatt (true/false).
 * Kun firmaets AVVIK fra ROLLE_HANDLINGER_DEFAULTS lagres; tom map = default-laget.
 * Bygges av API-loaderen fra FlytRettighetOverride-radene, konsulteres av web/mobil/server.
 */
export type RettighetsOverrides = Record<string, boolean>;

/** Nøkkelform for én matrise-celle i overrides-mappen. */
export function flytRettighetNoekkel(rolle: string, fraStatus: string, tilStatus: string): string {
  return `${rolle}:${fraStatus}:${tilStatus}`;
}

/**
 * Effektiv rettighet for én celle: override-laget ⊕ default-laget.
 *
 * Oppslagsrekkefølge: override (hvis firmaet har en rad for cellen) → default
 * (ROLLE_HANDLINGER_DEFAULTS). **Invariant (config-design § runtime-lesing):** en positiv
 * override snittes ALLTID mot statusmaskinen (`isValidStatusTransition`) — en override kan
 * aldri skape en overgang statusmaskinen ikke har. Snittet gjelder KUN override-stien:
 * default-laget har pseudo-status-overganger (draft→deleted) som ikke ligger i validTransitions,
 * og skal bevares. Uten override-rad for cellen = ren default = bit-identisk med før config-laget.
 */
function celleTillatt(
  rolle: DokumentflytRolle,
  fraStatus: string,
  tilStatus: string,
  overrides?: RettighetsOverrides,
): boolean {
  const noekkel = flytRettighetNoekkel(rolle, fraStatus, tilStatus);
  if (overrides && noekkel in overrides) {
    // Override-laget: honorér kun hvis statusmaskinen faktisk har overgangen (invariant).
    return overrides[noekkel] === true && isValidStatusTransition(fraStatus, tilStatus);
  }
  // Default-laget (sikkerhetsrammen) — identisk med dagens oppførsel.
  return ROLLE_HANDLINGER_DEFAULTS[rolle]?.[fraStatus]?.has(tilStatus) ?? false;
}

/**
 * Admin-nivå i flyt-rettighetslaget (Kloss 2, kun sitedoc + prosjektadmin — Kenneth-vedtak 2026-07-23).
 *
 * - `"sitedoc"`  → `User.role="sitedoc_admin"`. Kode-bypass (full tilgang, også ulovlige
 *                  overganger) — semantisk identisk med gammel `erAdmin=true`. Ingen matrise-kolonne.
 * - `"prosjekt"` → `ProjectMember.role="admin"`. Egen redigerbar matrise-kolonne. Default (tom
 *                  override) = full INNENFOR statusmaskinen (bevarer dagens bypass), konfigurerbar nedover.
 * - `null`       → vanlig flyt-rolle (inkl. **firma-admin** — får INGEN flyt-admin-rett, som server i dag).
 *
 * `boolean` godtas som bakoverkompatibel snarvei (Kloss 1: `true`→"sitedoc", `false`→null),
 * så Kloss 1-testene forblir uendret grønne. Nye kall bør sende AdminNiva-strengen eksplisitt.
 */
export type AdminNiva = "sitedoc" | "prosjekt" | null;

/** Sentinel-rollenavnet for prosjektadmin-kolonnen i overrides/logg (ikke en DokumentflytRolle). */
export const PROSJEKTADMIN_ROLLE = "prosjektadmin";

function normaliserAdminNiva(a: AdminNiva | boolean): AdminNiva {
  if (typeof a === "boolean") return a ? "sitedoc" : null;
  return a;
}

/**
 * Effektiv rett for prosjektadmin-kolonnen (adminNiva="prosjekt").
 *
 * Tom override = full innenfor statusmaskinen (arver dagens bypass, ikke-regresserende).
 * «Innenfor statusmaskinen» inkluderer pseudo-handlingene `deleted`/`forwarded` som
 * `hentStatusHandlinger` legitimt eksponerer (ellers ville prosjektadmin mistet Slett/Videresend
 * mot dagens fulle bypass). Override kan slå av (nedover) eller på, men en positiv override
 * kan ALDRI skape en overgang statusmaskinen ikke har (Kloss 1-invarianten, § 5.4).
 */
function erStruktureltGyldig(fraStatus: string, tilStatus: string): boolean {
  return isValidStatusTransition(fraStatus, tilStatus) || tilStatus === "deleted" || tilStatus === "forwarded";
}

function prosjektadminCelle(fraStatus: string, tilStatus: string, overrides?: RettighetsOverrides): boolean {
  const noekkel = flytRettighetNoekkel(PROSJEKTADMIN_ROLLE, fraStatus, tilStatus);
  if (overrides && noekkel in overrides) {
    // Override-laget: honorér kun hvis strukturelt gyldig (invarianten — også for prosjektadmin).
    return overrides[noekkel] === true && erStruktureltGyldig(fraStatus, tilStatus);
  }
  // Tom override = arv full innenfor statusmaskinen.
  return erStruktureltGyldig(fraStatus, tilStatus);
}

/** Roller → status → tillatte nyStatus-verdier (default-laget; per-firma avvik i RettighetsOverrides) */
export const ROLLE_HANDLINGER_DEFAULTS: Record<string, Record<string, Set<string>>> = {
  // Registrator: oppretter → sender/sletter EGEN kladd.
  registrator: {
    draft: new Set(["sent", "deleted"]),
    // F2 (spec § 3): avsender-siden trekker en sendt hendelse tilbake til kladd før svar.
    received: new Set(["draft"]),
    // F4 (spec § 3–4): Gjenåpne fra alle avsluttede statuser → kladd hos oppretteren.
    // Rett: registrator (oppretter) + prosjektadmin; godkjenner-ledd kan mangle.
    closed: new Set(["draft"]),
    dismissed: new Set(["draft"]),
    cancelled: new Set(["draft"]),
    // H6 (Godkjent = stoppsted): Gjenåpne fra Godkjent (approved→draft) — samme regel som øvrig
    // gjenåpne: registrator (oppretter) + prosjektadmin. Erstatter approved→closed (fjernet).
    approved: new Set(["draft"]),
    // F0 soft-delete: oppretteren kan gjenopprette egne slettede dokumenter (spec § 3–4).
    slettet: new Set(["gjenopprett"]),
  },
  bestiller: {
    draft: new Set(["sent", "deleted"]),
    // F2 (spec § 3): Trekk tilbake flyttet fra sent→cancelled til received→draft (D-1).
    received: new Set(["draft"]),
    // Runde-2: in_progress-Lukk fjernet (kollaps). Lukk for KS-avvik/HMS går via firma-terminal (hms.ts).
    // H6 (Godkjent = stoppsted): approved→closed fjernet (Godkjent lukkes aldri) — bestiller
    // mister Lukk på Godkjent. Gjenåpne eies av Reg + P-adm, ikke bestiller.
    // F4: Gjenåpne eies IKKE av bestiller (spec § 3 — kun Reg + P-adm). Legacy cancelled→draft
    // flyttet til registrator; bestiller mister gjenåpne.
  },
  utforer: {
    // F1 (matrise § 3): utfører eier Avvis (received→dismissed) sammen med prosjektadmin.
    // §8A-fiks (2026-07-29): Send fram (received→sent) FJERNET — recipient-løs no-op (se
    // hentStatusHandlinger.received + isValidStatusTransition). Utfører går framover via Besvar.
    // H3 (videresend-rettighet, 2026-07-26): `forwarded` fjernet — videresend er en admin-handling
    // (kryssflyt ut av flyten). Prosjektadmin beholder den via statusmaskin-snittet (erStruktureltGyldig),
    // ikke via denne default-lista.
    received: new Set(["responded", "dismissed"]),
    // Runde-2: in_progress-grenen (Besvar/Send på nytt fra Under arbeid) fjernet (kollaps → received).
  },
  godkjenner: {
    // F6 (Godkjenn fra Mottatt): godkjenner eier direkte godkjenning fra Mottatt (received→approved)
    // for Registrator→Godkjenner-flyt uten utfører. Utfører/registrator får den IKKE.
    received: new Set(["approved"]),
    // Runde-2 (2026-08-02): «Send tilbake» (responded→in_progress) FJERNET — bakover er nå Besvar ←
    // (fra received). §8A: Send fram (responded→sent) forblir fjernet fra default; H3: forwarded admin-only.
    responded: new Set(["approved"]),
    // Runde-2: in_progress-Lukk fjernet (kollaps). Lukk for KS-avvik/HMS via firma-terminal (hms.ts).
    // §8A-fiks (2026-07-29): Send fram (approved→sent) FJERNET — recipient-løs no-op. Godkjent er
    // et stoppsted (H6); godkjenner har ingen framover-handling herfra.
  },
};
