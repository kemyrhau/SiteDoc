import type { DokumentflytRolle } from "../types";

/**
 * Info om innlogget bruker i prosjektkontekst.
 */
export interface FlytBrukerInfo {
  userId: string;
  projectMemberId: string;
  /** Brukerens MemberEnterprise-IDer (entrepriser brukeren tilhører) */
  entrepriseIder: string[];
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
  enterpriseId: string | null;
  projectMemberId: string | null;
  groupId: string | null;
}

/**
 * Dokument-kontekst for å vite hvem som er bestiller/utfører.
 */
export interface DokumentKontekst {
  bestillerEnterpriseId: string;
  utforerEnterpriseId: string;
}

/** Rolle-prioritet: høyere tall = høyere prioritet */
const ROLLE_PRIORITET: Record<string, number> = {
  bestiller: 1,
  utforer: 2,
  godkjenner: 3,
  registrator: 4,
};

/**
 * Utled innlogget brukers rolle i en dokumentflyt for et gitt dokument.
 *
 * Matching-rekkefølge per flytmedlem:
 * 1. Direkte person-match (projectMemberId)
 * 2. Gruppe-match (groupId)
 * 3. Entreprise-match (enterpriseId) — kun hvis entreprisen er bestiller ELLER utfører på dokumentet
 *
 * Ved flertreff returneres rollen med høyest prioritet:
 * registrator > godkjenner > utforer > bestiller
 *
 * Admin (prosjektadmin / sitedoc_admin) returnerer alltid "registrator".
 */
export function utledMinRolle(
  bruker: FlytBrukerInfo,
  medlemmer: FlytMedlemInfo[],
  dokument: DokumentKontekst,
): DokumentflytRolle | null {
  // Admin har alltid registrator-rolle
  if (bruker.erAdmin) return "registrator";

  const dokumentEntrepriser = new Set([
    dokument.bestillerEnterpriseId,
    dokument.utforerEnterpriseId,
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
      // 3. Entreprise-match — kun relevant hvis entreprisen er part i dokumentet
      (m.enterpriseId !== null &&
        bruker.entrepriseIder.includes(m.enterpriseId) &&
        dokumentEntrepriser.has(m.enterpriseId));

    if (erMatch) {
      besteRolle = rolle;
      bestePrioritet = prioritet;
      // Registrator er høyeste — kan avslutte tidlig
      if (rolle === "registrator") return "registrator";
    }
  }

  return besteRolle;
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
}

/**
 * Utled brukerens rettighet for et dokument.
 *
 * - "admin": full tilgang, kan overstyre alt (prosjektadmin / registrator)
 * - "redigerer": kan fylle ut felter (har ballen + edit-tillatelse)
 * - "leser": kun forhåndsvisning
 *
 * For oppgaver: "redigerer" betyr append-only — erFeltLåst() i hook håndhever dette.
 */
export function utledDokumentRettighet(input: DokumentRettighetInput): DokumentRettighet {
  const { erAdmin, minRolle, tillatelser, status, dokumentType, harBallen } = input;

  // 1. Prosjektadmin eller flytregistrator → alltid admin
  if (erAdmin || minRolle === "registrator") return "admin";

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

  // 5. Har ballen — sjekk tillatelse (med fallback for brukere uten grupper)
  if (tillatelser.size === 0) return "redigerer"; // Ingen grupper konfigurert → tillat
  const editPerm = dokumentType === "sjekkliste" ? "checklist_edit" : "task_edit";
  if (!tillatelser.has(editPerm)) return "leser";

  return "redigerer";
}
