import type { DokumentflytRolle } from "../types";

/**
 * Info om innlogget bruker i prosjektkontekst.
 */
export interface FlytBrukerInfo {
  userId: string;
  projectMemberId: string;
  /** Brukerens faggruppe-IDer (faggrupper brukeren tilhører) */
  faggruppeIder: string[];
  /** Brukerens ProjectGroup-IDer */
  gruppeIder: string[];
  /** Prosjektadmin eller sitedoc_admin */
  erAdmin: boolean;
}

/**
 * Minimum flytmedlem-data for rolle-matching.
 */
export interface FlytMedlemInfo {
  rolle: string;
  faggruppeId: string | null;
  projectMemberId: string | null;
  groupId: string | null;
}

/**
 * Dokument-kontekst for å vite hvem som er bestiller/utfører.
 */
export interface DokumentKontekst {
  bestillerFaggruppeId: string | null;
  utforerFaggruppeId: string | null;
}

/**
 * Rolle-prioritet: høyere tall = høyere prioritet.
 *
 * Registrator er LAVEST (arbeidsverdi 1 — fabel gater endelig tallsetting): en
 * oppretter/leser skal ikke slå en skrive-rolle brukeren også innehar, ellers mister
 * hun sin legitime tur ved flertreff. Verdien må være ≥ 1 fordi `bestePrioritet` starter
 * på 0 og `prioritet <= bestePrioritet`-testen ellers ville hoppe registrator over.
 */
const ROLLE_PRIORITET: Record<string, number> = {
  registrator: 1,
  bestiller: 2,
  utforer: 3,
  godkjenner: 4,
};

/**
 * Utled innlogget brukers rolle i en dokumentflyt for et gitt dokument.
 *
 * Matching-rekkefølge per flytmedlem:
 * 1. Direkte person-match (projectMemberId)
 * 2. Gruppe-match (groupId)
 * 3. Faggruppe-match (faggruppeId) — kun hvis faggruppen er bestiller ELLER utfører på dokumentet
 *
 * Ved flertreff returneres rollen med høyest prioritet:
 * godkjenner > utforer > bestiller > registrator
 * (registrator er lavest — en oppretter/leser skal ikke slå en skrive-rolle brukeren
 *  også innehar. Se dokumentflyt.md § Rollematrisen.)
 *
 * Admin (prosjektadmin / sitedoc_admin) returnerer alltid "registrator"; selve
 * admin-makten kommer fra erAdmin-flagget i utledDokumentRettighet / erTillattForRolle,
 * ikke fra registrator-rollen.
 */
export function utledMinRolle(
  bruker: FlytBrukerInfo,
  medlemmer: FlytMedlemInfo[],
  dokument: DokumentKontekst,
): DokumentflytRolle | null {
  // Admin har alltid registrator-rolle
  if (bruker.erAdmin) return "registrator";

  const dokumentFaggrupper = new Set([
    dokument.bestillerFaggruppeId,
    dokument.utforerFaggruppeId,
  ]);

  let besteRolle: DokumentflytRolle | null = null;
  let bestePrioritet = 0;

  for (const m of medlemmer) {
    const rolle = m.rolle as DokumentflytRolle;
    const prioritet = ROLLE_PRIORITET[rolle] ?? 0;

    // Hopp over hvis lavere prioritet enn det vi allerede har
    if (prioritet <= bestePrioritet) continue;

    const erMatch =
      // 1. Direkte person-match
      (m.projectMemberId !== null && m.projectMemberId === bruker.projectMemberId) ||
      // 2. Gruppe-match
      (m.groupId !== null && bruker.gruppeIder.includes(m.groupId)) ||
      // 3. Faggruppe-match — kun relevant hvis faggruppen er part i dokumentet
      (m.faggruppeId !== null &&
        bruker.faggruppeIder.includes(m.faggruppeId) &&
        dokumentFaggrupper.has(m.faggruppeId));

    if (erMatch) {
      besteRolle = rolle;
      bestePrioritet = prioritet;
    }
  }

  return besteRolle;
}

/* ------------------------------------------------------------------ */
/*  harBallen — har innlogget bruker dokumentet på sitt bord nå?       */
/* ------------------------------------------------------------------ */

/** Minimum dokumentdata for harBallen-beregning. */
export interface HarBallenDokument {
  status: string;
  bestillerUserId: string | null | undefined;
  recipientUserId: string | null | undefined;
  recipientGroupId: string | null | undefined;
}

/** Minimum brukerdata for harBallen-beregning. */
export interface HarBallenBruker {
  userId: string;
  gruppeIder: string[];
}

/**
 * Avgjør om innlogget bruker «har ballen» — er nåværende mottaker eller
 * bestiller i kladd-status. Brukes til å gi redigerings-tilgang i
 * `utledDokumentRettighet`.
 */
export function beregnHarBallen(
  dokument: HarBallenDokument,
  bruker: HarBallenBruker,
): boolean {
  if (dokument.status === "draft") {
    return dokument.bestillerUserId === bruker.userId;
  }
  if (dokument.recipientUserId && dokument.recipientUserId === bruker.userId) {
    return true;
  }
  if (dokument.recipientGroupId && bruker.gruppeIder.includes(dokument.recipientGroupId)) {
    return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Dokumentrettighet — leser / redigerer / admin                      */
/* ------------------------------------------------------------------ */

export type DokumentRettighet = "admin" | "redigerer" | "leser";

export interface DokumentRettighetInput {
  /** Prosjektadmin eller sitedoc_admin (fra hentMinFlytInfo.erAdmin) */
  erAdmin: boolean;
  /** Brukerens rolle i dokumentflyten (fra utledMinRolle) */
  minRolle: DokumentflytRolle | null | undefined;
  /** Brukerens group-baserte tillatelser (fra hentBrukerTillatelser / hentMineTillatelser) */
  tillatelser: Set<string>;
  /** Dokumentets nåværende status */
  status: string;
  /** Dokumenttype */
  dokumentType: "sjekkliste" | "oppgave";
  /** Har brukeren ballen akkurat nå? */
  harBallen: boolean;
  /** Rettighet fra DokumentflytMedlem.kanRedigere for brukerens aktive flytledd */
  flytRettighet?: "redigerer" | "leser";
}

/**
 * Utled brukerens rettighet for et dokument.
 *
 * - "admin": full tilgang, kan overstyre alt (prosjektadmin / sitedoc_admin)
 * - "redigerer": kan fylle ut felter (har ballen + edit-tillatelse)
 * - "leser": kun forhåndsvisning
 *
 * For OPPGAVE: "redigerer" betyr append-only — erFeltLåst() i oppgave-hooken
 * håndhever dette (delt kilde: beregnLaasteFelter i feltLaasing.ts). For
 * SJEKKLISTE er "redigerer" full felt-redigering (den som har ballen +
 * admin) — IKKE append-only (vedtatt 2026-07-16, dokumentflyt.md § 2).
 * Merk: klient-lås — server oppdaterData håndhever ikke append-only i dag.
 *
 * Registrator har ingen særbehandling her: hun følger samme logikk som øvrige roller —
 * med ballen redigerer hun sin egen del (Kenneths matrise: oppretter + redigerer
 * sjekkliste/oppgave), uten ballen leser hun. «Minst leser»-gulvet er iboende
 * (returnerer aldri null). Skrive-/statusmakt forbi egen tur ligger ikke her — se
 * erTillattForRolle + ROLLE_HANDLINGER.registrator. dokumentflyt.md § Rollematrisen.
 */
export function utledDokumentRettighet(input: DokumentRettighetInput): DokumentRettighet {
  const { erAdmin, tillatelser, status, dokumentType, harBallen, flytRettighet } = input;

  // 1. Prosjektadmin / sitedoc_admin → alltid admin
  if (erAdmin) return "admin";

  // 2. Terminale statuser → alltid leser
  if (["closed", "approved", "cancelled"].includes(status)) return "leser";

  // 3. Kladd → sjekk edit-tillatelse (med fallback)
  if (status === "draft") {
    if (tillatelser.size === 0) return "redigerer"; // Ingen grupper konfigurert → tillat
    const editPerm = dokumentType === "sjekkliste" ? "checklist_edit" : "task_edit";
    return tillatelser.has(editPerm) ? "redigerer" : "leser";
  }

  // 4. Har ikke ballen → leser
  if (!harBallen) return "leser";

  // 5. Har ballen — sjekk flytledd-rettighet (DokumentflytMedlem.kanRedigere)
  if (flytRettighet === "leser") return "leser";

  // 6. Har ballen — sjekk gruppetillatelse (med fallback for brukere uten grupper)
  if (tillatelser.size === 0) return "redigerer"; // Ingen grupper konfigurert → tillat
  const editPerm = dokumentType === "sjekkliste" ? "checklist_edit" : "task_edit";
  if (!tillatelser.has(editPerm)) return "leser";

  return "redigerer";
}
