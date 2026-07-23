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
    sent: [
      { tekstNoekkel: "statushandling.trekkTilbake", nyStatus: "cancelled", farge: "bg-red-600", aktivFarge: "bg-red-400", erPrimaer: true },
    ],
    received: [
      { tekstNoekkel: "statushandling.besvar", nyStatus: "responded", farge: "bg-purple-600", aktivFarge: "bg-purple-400", erPrimaer: true },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
      { tekstNoekkel: "handling.avvis", nyStatus: "cancelled", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    in_progress: [
      { tekstNoekkel: "statushandling.besvar", nyStatus: "responded", farge: "bg-purple-600", aktivFarge: "bg-purple-400", erPrimaer: true },
      { tekstNoekkel: "statushandling.sendTilbake", nyStatus: "sent", farge: "bg-amber-500", aktivFarge: "bg-amber-400" },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
      { tekstNoekkel: "handling.avvis", nyStatus: "cancelled", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    responded: [
      { tekstNoekkel: "handling.godkjenn", nyStatus: "approved", farge: "bg-green-600", aktivFarge: "bg-green-400", erPrimaer: true },
      { tekstNoekkel: "statushandling.sendTilbakeUtforer", nyStatus: "rejected", farge: "bg-amber-500", aktivFarge: "bg-amber-400" },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
    ],
    rejected: [
      // A-i (2026-07-17): rejected→responded var ULOVLIG i isValidStatusTransition (server-BAD_REQUEST).
      // Veien går nå rejected → in_progress → responded. Se dokumentflyt.md § 6.
      { tekstNoekkel: "statushandling.gjenoppta", nyStatus: "in_progress", farge: "bg-purple-600", aktivFarge: "bg-purple-400", erPrimaer: true },
      // Venstre ende (flytmodell-vedtak-2026-07-22): registrator/bestiller retter opp
      // et returnert dokument og sender det mot høyre igjen. Uten denne var rejected→sent inert.
      { tekstNoekkel: "statushandling.sendPaaNytt", nyStatus: "sent", farge: "bg-blue-600", aktivFarge: "bg-blue-400" },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
      { tekstNoekkel: "handling.lukk", nyStatus: "closed", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
    ],
    approved: [
      { tekstNoekkel: "handling.lukk", nyStatus: "closed", farge: "bg-gray-500", aktivFarge: "bg-gray-400", erPrimaer: true },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
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
 * | Status       | registrator          | bestiller   | utfører                           | godkjenner                        |
 * |--------------|----------------------|-------------|-----------------------------------|-----------------------------------|
 * | draft        | Send, Slett          | Send, Slett | —                                 | —                                 |
 * | sent         | Avbryt               | Avbryt      | —                                 | —                                 |
 * | received     | Besvar, Videres.     | —           | Besvar, Videresend                | —                                 |
 * | in_progress  | Besvar, Tilbake, V   | —           | Besvar, Send tilbake, Videresend  | —                                 |
 * | responded    | Godkjenn, Tilbake, V | —           | —                                 | Godkjenn, Send tilbake, Videresend|
 * | rejected     | Send på nytt         | Send på nytt| Gjenoppta, Videresend             | —                                 |
 * | approved     | Lukk, Videresend     | Lukk        | —                                 | —                                 |
 * | cancelled    | Gjenåpne, Slett      | Gjenåpne    | —                                 | —                                 |
 */
export function hentRolleFiltrertHandlinger(
  status: string,
  rolle: DokumentflytRolle | null,
  erAdmin: boolean,
  overrides?: RettighetsOverrides,
): StatusHandling[] {
  if (!rolle) return [];

  const alle = hentStatusHandlinger(status);

  // Kun admin ser alle handlinger. Registrator er ikke lenger superbruker (Fase B):
  // hun faller gjennom til ROLLE_HANDLINGER_DEFAULTS.registrator (kun send/slett på egen kladd).
  if (erAdmin) return alle;

  // Per celle: override → default (celleTillatt). Uten overrides = default-laget = bit-identisk.
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
  erAdmin: boolean,
  overrides?: RettighetsOverrides,
): boolean {
  if (!rolle) return false;
  if (erAdmin) return true;
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

/** Roller → status → tillatte nyStatus-verdier (default-laget; per-firma avvik i RettighetsOverrides) */
export const ROLLE_HANDLINGER_DEFAULTS: Record<string, Record<string, Set<string>>> = {
  // Registrator: oppretter → sender/sletter EGEN kladd. Venstre ende av linja
  // (flytmodell-vedtak-2026-07-22): et returnert (rejected) dokument lander hos henne,
  // hun retter opp og sender mot høyre igjen.
  registrator: {
    draft: new Set(["sent", "deleted"]),
    rejected: new Set(["sent"]),
  },
  bestiller: {
    draft: new Set(["sent", "deleted"]),
    sent: new Set(["cancelled"]),
    approved: new Set(["closed"]),
    cancelled: new Set(["draft"]),
    // Venstre ende (flytmodell-vedtak-2026-07-22): kan sende returnert dokument videre.
    rejected: new Set(["sent"]),
  },
  utforer: {
    received: new Set(["responded", "forwarded"]),
    in_progress: new Set(["responded", "sent", "forwarded"]),
    // A-i: rejected → in_progress (gjenoppta), ikke responded (ulovlig i statusmaskinen)
    rejected: new Set(["in_progress", "forwarded"]),
  },
  godkjenner: {
    responded: new Set(["approved", "rejected", "forwarded"]),
  },
};
