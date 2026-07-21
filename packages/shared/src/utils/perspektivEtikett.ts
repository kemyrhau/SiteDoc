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
 * Seerens perspektiv, utledet av rolle + ballinnehav:
 * - `registrator` — nøytral global sannhet (prosjektadmin / flytregistrator).
 * - `aktiv` — dokumentet er på seerens bord nå (har ballen), krever handling.
 * - `venter` — seeren sendte forrige ledd / venter; ballen er hos andre.
 *
 * De fire kolonnene i perspektiv-tabellen (Avsender/Mottaker/Godkjenner/Registrator)
 * kollapser til disse tre: godkjenner-kolonnen = `aktiv` ved `responded`
 * (har ballen → «Til godkjenning») og `venter` ved `rejected` (sendte tilbake,
 * venter → «Til revisjon»). Mottaker-kolonnen = `aktiv`; avsender-kolonnen = `venter`.
 */
export type Perspektiv = "aktiv" | "venter" | "registrator";

export interface PerspektivSeerKontekst {
  /** Brukerens utledede flytrolle for dokumentet (`utledMinRolle`). null = ingen rolle. */
  rolle: DokumentflytRolle | null;
  /** Har brukeren ballen nå? (`beregnHarBallen`) */
  harBallen: boolean;
}

export interface PerspektivEtikett {
  /** i18n-nøkkel — konsumenten kaller `t(etikettKey)`. */
  etikettKey: string;
  variant: BadgeVariant;
  /** Utledet perspektiv — eksponeres for testbarhet/feilsøking. */
  perspektiv: Perspektiv;
}

/**
 * Utled seerperspektiv. Registrator/admin ser alltid nøytral sannhet uansett
 * ballinnehav; ellers avgjør ballen om du er den aktive parten eller venter.
 */
export function utledPerspektiv(kontekst: PerspektivSeerKontekst): Perspektiv {
  if (kontekst.rolle === "registrator") return "registrator";
  return kontekst.harBallen ? "aktiv" : "venter";
}

type Celle = { etikettKey: string; variant: BadgeVariant };

/**
 * Kolonne D — nøytral global sannhet. Dekker ALLE statuser og fungerer som
 * fallback når en (perspektiv, status)-celle ikke er definert. `sent` tas med
 * defensivt selv om `sjekkliste.ts:923` konverterer sent→received ved lagring.
 */
const REGISTRATOR: Record<string, Celle> = {
  draft: { etikettKey: "status.utkast", variant: "default" },
  // UOPPNÅELIG i dag: `sjekkliste.ts:923` konverterer sent→received ubetinget ved
  // lagring, så ingen rad persisteres som `sent`. Beholdes rent defensivt (f.eks.
  // optimistisk/eksperimentell status i en fremtidig konsument) — fyrer ikke nå.
  sent: { etikettKey: "status.sendt", variant: "primary" },
  received: { etikettKey: "status.mottatt", variant: "primary" },
  in_progress: { etikettKey: "status.paagaar", variant: "primary" },
  responded: { etikettKey: "status.besvart", variant: "primary" },
  approved: { etikettKey: "status.godkjent", variant: "success" },
  // § 2b-fallback: rejected er `danger` globalt i dag → `primary` for nøytral seer.
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
  rejected: { etikettKey: "status.tilUtbedring", variant: "warning" }, // utfører har ballen
  approved: { etikettKey: "status.godkjent", variant: "success" },
  closed: { etikettKey: "status.lukket", variant: "default" },
  cancelled: { etikettKey: "status.avbrutt", variant: "danger" },
};

const BASE_VENTER: Record<string, Celle> = {
  received: { etikettKey: "status.tilBehandling", variant: "primary" },
  in_progress: { etikettKey: "status.underArbeid", variant: "primary" },
  responded: { etikettKey: "status.besvartTilGodkjenning", variant: "primary" }, // utfører har besvart
  rejected: { etikettKey: "status.tilRevisjon", variant: "primary" }, // godkjenner sendte tilbake
  approved: { etikettKey: "status.godkjent", variant: "success" },
  closed: { etikettKey: "status.lukket", variant: "default" },
  cancelled: { etikettKey: "status.avbrutt", variant: "danger" },
};

/**
 * HMS — enveis med auto-retur. Innsender = `venter`, HMS-gruppe = `aktiv`.
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
  if (perspektiv === "registrator") {
    celle = REGISTRATOR[status];
  } else if (perspektiv === "aktiv") {
    celle = (erHms ? HMS_AKTIV : BASE_AKTIV)[status];
  } else {
    celle = (erHms ? HMS_VENTER : BASE_VENTER)[status];
  }

  // Fallback: udefinert celle → nøytral registrator-sannhet (kolonne D).
  // Ukjent status → returner status-strengen selv (samme kontrakt som StatusBadge).
  const løst = celle ?? REGISTRATOR[status] ?? { etikettKey: status, variant: "default" as BadgeVariant };
  return { etikettKey: løst.etikettKey, variant: løst.variant, perspektiv };
}
