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
  const handlinger: Record<string, StatusHandling[]> = {
    draft: [
      { tekstNoekkel: "handling.send", nyStatus: "sent", farge: "bg-blue-600", aktivFarge: "bg-blue-400", erPrimaer: true },
      { tekstNoekkel: "handling.slett", nyStatus: "deleted", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    // F2 (D-1): `sent` er transient (auto→received) — ingen handlinger bor her.
    received: [
      { tekstNoekkel: "statushandling.besvar", nyStatus: "responded", farge: "bg-purple-600", aktivFarge: "bg-purple-400", erPrimaer: true },
      // F5 (Send/Videresend-paring, beslutning 6): Send fram i flyten — gjenbruker handling.send.
      { tekstNoekkel: "handling.send", nyStatus: "sent", farge: "bg-blue-600", aktivFarge: "bg-blue-400" },
      // F2: Trekk tilbake henter en sendt hendelse tilbake til avsender FØR mottaker har
      // svart, og lander som redigerbar kladd (received→draft, D-1-fiks).
      { tekstNoekkel: "statushandling.trekkTilbake", nyStatus: "draft", farge: "bg-amber-500", aktivFarge: "bg-amber-400" },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
      // F1: Avvis ruter nå til egen «Avvist»-status (dismissed), ikke lenger cancelled.
      { tekstNoekkel: "handling.avvis", nyStatus: "dismissed", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    // F3 (Under arbeid): merget tilstand (dagens in_progress + rejected). Handlingene er
    // Besvar (→responded), Send på nytt (→sent, fram igjen etter retting), Lukk (→closed,
    // arver dagens rejected→closed) og Videresend. Gammel `sendTilbake` (in_progress→sent
    // uten svar) og `avvis` (→cancelled) utgår.
    in_progress: [
      { tekstNoekkel: "statushandling.besvar", nyStatus: "responded", farge: "bg-purple-600", aktivFarge: "bg-purple-400", erPrimaer: true },
      { tekstNoekkel: "statushandling.sendPaaNytt", nyStatus: "sent", farge: "bg-blue-600", aktivFarge: "bg-blue-400" },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
      { tekstNoekkel: "handling.lukk", nyStatus: "closed", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
    ],
    responded: [
      { tekstNoekkel: "handling.godkjenn", nyStatus: "approved", farge: "bg-green-600", aktivFarge: "bg-green-400", erPrimaer: true },
      // F3: Send tilbake ruter DIREKTE til Under arbeid (responded→in_progress) — ingen Gjenoppta.
      { tekstNoekkel: "statushandling.sendTilbakeUtforer", nyStatus: "in_progress", farge: "bg-amber-500", aktivFarge: "bg-amber-400" },
      // F5 (Send/Videresend-paring): Send fram fra svar-leddet — gjenbruker handling.send.
      { tekstNoekkel: "handling.send", nyStatus: "sent", farge: "bg-blue-600", aktivFarge: "bg-blue-400" },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
    ],
    approved: [
      { tekstNoekkel: "handling.lukk", nyStatus: "closed", farge: "bg-gray-500", aktivFarge: "bg-gray-400", erPrimaer: true },
      // F5 (Send/Videresend-paring): Send fram fra godkjent — gjenbruker handling.send.
      { tekstNoekkel: "handling.send", nyStatus: "sent", farge: "bg-blue-600", aktivFarge: "bg-blue-400" },
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
 * | received     | Trekk tilbake        | Trekk tilbake   | Besvar, Send, Videresend, Avvis   | —                                 |
 * | in_progress  | —                    | Lukk        | Besvar, Send på nytt, Videresend  | Lukk                              |
 * | responded    | —                    | —           | —                                 | Godkjenn, Send tilbake, Send, Videresend|
 * | approved     | Lukk, Videresend     | Lukk        | —                                 | Send                              |
 * | closed       | Gjenåpne             | —           | —                                 | —                                 |
 * | dismissed    | Gjenåpne             | —           | —                                 | —                                 |
 * | cancelled    | Gjenåpne             | —           | —                                 | —                                 |
 *
 * F3 (Under arbeid): `rejected` er merget inn i `in_progress`. Send tilbake
 * (responded→in_progress) eies av godkjenner; Send på nytt (in_progress→sent)
 * av utfører; Lukk (in_progress→closed) av bestiller + godkjenner.
 * F4 (Gjenåpne-samling): closed/dismissed/cancelled → draft eies av registrator
 * (oppretter) + prosjektadmin (spec § 4). Bestiller mister gjenåpne (var legacy cancelled).
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
    // F0 soft-delete: oppretteren kan gjenopprette egne slettede dokumenter (spec § 3–4).
    slettet: new Set(["gjenopprett"]),
  },
  bestiller: {
    draft: new Set(["sent", "deleted"]),
    // F2 (spec § 3): Trekk tilbake flyttet fra sent→cancelled til received→draft (D-1).
    received: new Set(["draft"]),
    // F3 (matrise § 3): Lukk fra Under arbeid (in_progress→closed) eies av bestiller + godkjenner.
    in_progress: new Set(["closed"]),
    approved: new Set(["closed"]),
    // F4: Gjenåpne eies IKKE av bestiller (spec § 3 — kun Reg + P-adm). Legacy cancelled→draft
    // flyttet til registrator; bestiller mister gjenåpne.
  },
  utforer: {
    // F1 (matrise § 3): utfører eier Avvis (received→dismissed) sammen med prosjektadmin.
    // F5 (matrise § 3): Send fram (received→sent) eies av utfører + prosjektadmin.
    received: new Set(["responded", "sent", "forwarded", "dismissed"]),
    // F3 (matrise § 3): Besvar (→responded), Send på nytt (→sent), Videresend fra Under arbeid.
    in_progress: new Set(["responded", "sent", "forwarded"]),
  },
  godkjenner: {
    // F3: Send tilbake ruter direkte til Under arbeid (responded→in_progress), ikke rejected.
    // F5 (matrise § 3): Send fram (responded→sent) eies av godkjenner + prosjektadmin.
    responded: new Set(["approved", "in_progress", "sent", "forwarded"]),
    // F3 (matrise § 3): Lukk fra Under arbeid eies av godkjenner + bestiller.
    in_progress: new Set(["closed"]),
    // F5 (matrise § 3): Send fram (approved→sent) eies av godkjenner + prosjektadmin.
    approved: new Set(["sent"]),
  },
};
