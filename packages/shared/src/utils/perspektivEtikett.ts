import type { DokumentflytRolle } from "../types";

/**
 * Perspektiv-avhengig statusetikett — delt kilde for web (`@sitedoc/ui`
 * StatusBadge), mobil og lister. **Rammeverk-fri:** returnerer en i18n-NØKKEL
 * (aldri ferdig oversatt tekst), konsumenten kaller `t(etikettKey)`. Ligger i
 * `@sitedoc/shared` fordi mobil importerer shared, ikke ui — legges den i ui,
 * blir mobil avskåret (cowork-målt A-3b ledd 2-gate).
 *
 * FUNDAMENT (Kenneth-vedtatt N1): status er perspektiv-avhengig, ikke global.
 * Samme lagrede rad får ulik etikett + farge etter hvem som ser den. Lagret
 * tilstand endres ALDRI — dette er rent visningslag.
 *
 * Kilde: docs/claude/delplaner/a3b-perspektiv-tabell.md (fabel-gatet 2026-07-20).
 * Ved endring: oppdater tabellen OG perspektivEtikett.test.ts (frosne rader).
 */

/** Badge-varianter — speiler `@sitedoc/ui` Badge (default/primary/success/warning/danger). */
export type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger";

export type PerspektivDokumentType = "sjekkliste" | "oppgave" | "godkjenning" | "hms";

/**
 * Seerens perspektiv, utledet av admin-flagg + ballinnehav:
 * - `noeytral` — nøytral global sannhet (kolonne D). Nås av admin (globalt tilsyn),
 *   av ikke-parter uten flytrolle (§ 2-fallback), og som celle-fallback for
 *   udefinerte (perspektiv, status)-par.
 * - `aktiv` — dokumentet er på seerens bord nå (har ballen), krever handling.
 * - `venter` — seeren sendte forrige ledd / venter; ballen er hos andre.
 *
 * § 8-revisjon (fabel-gate 2026-07-24): registrator er IKKE lenger en egen
 * kolonne. En matchet registrator er per Kenneths definisjon avsender-parten
 * (oppretter + sender), så hun flyter A/B/C som øvrige deltakere — `venter` (A,
 * avsender) uten ballen, `aktiv` (B) med ballen. En bruker som ikke er part får
 * `rolle=null` fra `utledMinRolle` (ikke «registrator») og følger samme ball-
 * baserte utledning. Kun `erAdmin` gir den nøytrale D-kolonnen ubetinget.
 *
 * De fire tabell-kolonnene (Avsender/Mottaker/Godkjenner/Registrator) kollapser
 * til disse tre: godkjenner-kolonnen = `aktiv` ved `responded` (har ballen →
 * «Til godkjenning») og `venter` ved `rejected` (sendte tilbake, venter →
 * «Til revisjon»). Mottaker-kolonnen = `aktiv`; avsender-kolonnen = `venter`.
 */
export type Perspektiv = "aktiv" | "venter" | "noeytral";

export interface PerspektivSeerKontekst {
  /** Brukerens utledede flytrolle for dokumentet (`utledMinRolle`). null = ingen rolle. */
  rolle: DokumentflytRolle | null;
  /** Har brukeren ballen nå? (`beregnHarBallen`) */
  harBallen: boolean;
  /**
   * Prosjekt-/firma-/sitedoc-admin (globalt tilsyn). § 8-gate: `erAdmin → D`
   * ubetinget — admin ser alltid nøytral sannhet uansett ball/rolle. Bruker
   * `minFlytInfo.erAdmin` (uendret av Kloss 2 `adminNiva`; adminNiva er containet
   * til flyt-rettighets-funksjonene, ikke perspektiv-D). Default false.
   */
  erAdmin?: boolean;
}

export interface PerspektivEtikett {
  /** i18n-nøkkel — konsumenten kaller `t(etikettKey)`. */
  etikettKey: string;
  variant: BadgeVariant;
  /** Utledet perspektiv — eksponeres for testbarhet/feilsøking. */
  perspektiv: Perspektiv;
}

/**
 * Utled seerperspektiv.
 * 1. Admin (globalt tilsyn) → nøytral D uansett ball/rolle (§ 8-gate: `erAdmin → D`).
 * 2. **Ikke-part** (ingen flytrolle) → nøytral D (§ 2-fallback, fabel-gate 2026-07-24):
 *    en leser uten rolle sendte aldri noe og har ingen perspektiv-split — hun ser
 *    dokumentets nøytrale sannhet, ikke avsender-etiketten «Til behandling». Sjekkes
 *    FØR ballen: mangler du en rolle finnes ikke A/B/C-splittet, uansett ballinnehav
 *    (en recipient uten registrert flytmedlemskap er fortsatt ikke en flyt-part).
 * 3. Ellers — inkludert registrator, som nå er en ordinær avsender-part — avgjør
 *    ballen: har den → aktiv part (B), ellers venter/avsender (A).
 */
export function utledPerspektiv(kontekst: PerspektivSeerKontekst): Perspektiv {
  if (kontekst.erAdmin) return "noeytral";
  if (!kontekst.rolle) return "noeytral";
  return kontekst.harBallen ? "aktiv" : "venter";
}

type Celle = { etikettKey: string; variant: BadgeVariant };

/**
 * Kolonne D — nøytral global sannhet (admin + celle-fallback). Dekker ALLE
 * statuser og fungerer som fallback når en (perspektiv, status)-celle ikke er
 * definert. `sent` tas med defensivt selv om `sjekkliste.ts:923` konverterer
 * sent→received ved lagring.
 */
const NOEYTRAL: Record<string, Celle> = {
  draft: { etikettKey: "status.utkast", variant: "default" },
  // UOPPNÅELIG i dag: `sjekkliste.ts:923` konverterer sent→received ubetinget ved
  // lagring, så ingen rad persisteres som `sent`. Beholdes rent defensivt (f.eks.
  // optimistisk/eksperimentell status i en fremtidig konsument) — fyrer ikke nå.
  sent: { etikettKey: "status.sendt", variant: "primary" },
  received: { etikettKey: "status.mottatt", variant: "primary" },
  in_progress: { etikettKey: "status.paagaar", variant: "primary" },
  responded: { etikettKey: "status.besvart", variant: "primary" },
  approved: { etikettKey: "status.godkjent", variant: "success" },
  // § 9-konsolidering (fabel-gate 2026-07-24): `rejected`-fargen er nå perspektiv-
  // avhengig (samme grammatikk som received/in_progress) — warning til ballinnehaver
  // (aktiv/venter-utbedrer), primary til den som venter og til nøytral D. Den gamle
  // § 2b globale danger→farge-endringen er KONSUMERT av dette; ingen egen baseline.
  rejected: { etikettKey: "status.tilRevisjon", variant: "primary" },
  closed: { etikettKey: "status.lukket", variant: "default" },
  cancelled: { etikettKey: "status.avbrutt", variant: "danger" },
};

/** Base = sjekkliste / oppgave / godkjenning (felles rolle-vokabular). */
const BASE_AKTIV: Record<string, Celle> = {
  draft: { etikettKey: "status.utkast", variant: "default" }, // egen usendt kladd
  received: { etikettKey: "status.tilBehandling", variant: "warning" },
  in_progress: { etikettKey: "status.underArbeid", variant: "warning" },
  responded: { etikettKey: "status.tilGodkjenning", variant: "warning" }, // godkjenner har ballen
  // § 9 (A-laget): ballinnehaver på rejected = utfører (gjenoppta) ELLER avsender
  // (registrator/bestiller «Send på nytt») — begge «din tur» → warning.
  rejected: { etikettKey: "status.tilUtbedring", variant: "warning" },
  approved: { etikettKey: "status.godkjent", variant: "success" },
  closed: { etikettKey: "status.lukket", variant: "default" },
  cancelled: { etikettKey: "status.avbrutt", variant: "danger" },
};

const BASE_VENTER: Record<string, Celle> = {
  received: { etikettKey: "status.tilBehandling", variant: "primary" },
  in_progress: { etikettKey: "status.underArbeid", variant: "primary" },
  responded: { etikettKey: "status.besvartTilGodkjenning", variant: "primary" }, // utfører har besvart
  rejected: { etikettKey: "status.tilRevisjon", variant: "primary" }, // godkjenner sendte tilbake, venter
  approved: { etikettKey: "status.godkjent", variant: "success" },
  closed: { etikettKey: "status.lukket", variant: "default" },
  cancelled: { etikettKey: "status.avbrutt", variant: "danger" },
};

/**
 * HMS — enveis med auto-retur. Innsender = `venter`, HMS-gruppe = `aktiv`.
 * § 9-konsolidering: på `rejected` speiler HMS base-grammatikken — innsender får
 * ballen tilbake for utbedring (`aktiv` → warning), HMS-gruppen sendte tilbake og
 * venter (`venter` → primary).
 *
 * ⚠️ HMS-retur-avhengighet (fabel-svar 3, A-3b): «Godkjent – returnert» krever
 * at seer-konteksten identifiserer innsender som `aktiv` ved `approved` (ballen
 * returnert). Koden har ingen egen HMS-retur-gren i dag. Selve MAPPINGEN her er
 * ren visning; klarer ikke `beregnHarBallen` å skille innsender-etter-retur i
 * konsument-laget (1b–d) uten en skrive-side-endring, STOPP og meld tilbake
 * (samme regel som «Lest»). Del 1a leverer kun mappingen.
 */
const HMS_AKTIV: Record<string, Celle> = {
  draft: { etikettKey: "status.utkast", variant: "default" }, // innsenders usendte kladd
  received: { etikettKey: "status.tilBehandling", variant: "warning" }, // HMS-gruppe
  in_progress: { etikettKey: "status.underBehandling", variant: "warning" },
  approved: { etikettKey: "status.godkjentReturnert", variant: "success" }, // innsender, retur
  rejected: { etikettKey: "status.tilUtbedring", variant: "warning" }, // innsender har ballen
  closed: { etikettKey: "status.lukket", variant: "default" },
  cancelled: { etikettKey: "status.avbrutt", variant: "danger" },
};

const HMS_VENTER: Record<string, Celle> = {
  received: { etikettKey: "status.tilBehandlingHms", variant: "primary" }, // innsender venter
  in_progress: { etikettKey: "status.underBehandling", variant: "primary" },
  approved: { etikettKey: "status.godkjent", variant: "success" }, // HMS-gruppe, ferdig
  rejected: { etikettKey: "status.tilRevisjon", variant: "primary" }, // HMS-gruppe sendte tilbake
  closed: { etikettKey: "status.lukket", variant: "default" },
  cancelled: { etikettKey: "status.avbrutt", variant: "danger" },
};

/**
 * Perspektiv-avhengig etikett + farge for et dokument.
 *
 * @param status       Lagret dokumentstatus (uendret — ren avlesning).
 * @param kontekst     Seerens rolle + ballinnehav (`utledMinRolle` / `beregnHarBallen`).
 * @param dokumentType Velger base-matrise (sjekkliste/oppgave/godkjenning) vs. HMS-matrise.
 */
export function perspektivEtikett(
  status: string,
  kontekst: PerspektivSeerKontekst,
  dokumentType: PerspektivDokumentType,
): PerspektivEtikett {
  const perspektiv = utledPerspektiv(kontekst);
  const erHms = dokumentType === "hms";

  let celle: Celle | undefined;
  if (perspektiv === "noeytral") {
    celle = NOEYTRAL[status];
  } else if (perspektiv === "aktiv") {
    celle = (erHms ? HMS_AKTIV : BASE_AKTIV)[status];
  } else {
    celle = (erHms ? HMS_VENTER : BASE_VENTER)[status];
  }

  // Fallback: udefinert celle → nøytral D-sannhet (kolonne D).
  // Ukjent status → returner status-strengen selv (samme kontrakt som StatusBadge).
  const løst = celle ?? NOEYTRAL[status] ?? { etikettKey: status, variant: "default" as BadgeVariant };
  return { etikettKey: løst.etikettKey, variant: løst.variant, perspektiv };
}

/**
 * Kvitterings-øyeblikket (Del 1b): momentan bekreftelse rett etter egen handling,
 * nøklet på HANDLINGEN (`StatusHandling.tekstNoekkel`), ikke på `nyStatus`.
 * Vises optimistisk i badgen og erstattes av dokumentets sanne perspektiv-tilstand
 * ved neste visning. **Klient-only, ALDRI lagret tilstand.** Kilde:
 * a3b-perspektiv-tabell.md § 6 + statusHandlinger.ts.
 *
 * HVORFOR handling og ikke status: `nyStatus` er ikke injektiv over handlinger —
 * `handling.send` og `statushandling.sendTilbake` gir begge `sent`, `handling.avvis`
 * og `statushandling.trekkTilbake` gir begge `cancelled`. Nøkling på status ga «Sendt ✓»
 * på en «Send tilbake»-handling. Statusen er utfallet; handlingen er det brukeren gjorde.
 *
 * Én rad per distinkt `tekstNoekkel` i statusHandlinger.ts. `handling.slett` er utelatt
 * (går via `onSlett`, ikke `onEndreStatus`). Returnerer `null` for ukjent handling.
 */
const KVITTERING: Record<string, Celle> = {
  "handling.send": { etikettKey: "kvittering.sendt", variant: "primary" },
  "statushandling.besvar": { etikettKey: "kvittering.besvart", variant: "primary" },
  "handling.godkjenn": { etikettKey: "kvittering.godkjent", variant: "success" },
  // To distinkte «send tilbake»-handlinger (in_progress→sent og responded→rejected)
  // — samme kvittering er korrekt, begge ER en tilbakesending.
  "statushandling.sendTilbake": { etikettKey: "kvittering.sendtTilbake", variant: "warning" },
  "statushandling.sendTilbakeUtforer": { etikettKey: "kvittering.sendtTilbake", variant: "warning" },
  "statushandling.videresend": { etikettKey: "kvittering.videresendt", variant: "primary" },
  "handling.avvis": { etikettKey: "kvittering.avvist", variant: "danger" },
  "statushandling.trekkTilbake": { etikettKey: "kvittering.trukketTilbake", variant: "default" },
  "statushandling.gjenoppta": { etikettKey: "kvittering.gjenopptatt", variant: "primary" },
  "statushandling.gjenapne": { etikettKey: "kvittering.gjenapnet", variant: "primary" },
  "handling.lukk": { etikettKey: "kvittering.lukket", variant: "success" },
};

export function kvitteringEtikett(handlingNoekkel: string): { etikettKey: string; variant: BadgeVariant } | null {
  return KVITTERING[handlingNoekkel] ?? null;
}
