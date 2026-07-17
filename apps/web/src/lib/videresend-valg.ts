/**
 * Videresend-valg: utleder mottakere (faggruppe → dokumentflyt → person/gruppe)
 * for dokumenthandlingsmenyen på web.
 *
 * Flyttet hit fra den slettede `StatusHandlinger.tsx`-komponenten (A-3a, 2026-07-17).
 * Ren logikk uten JSX — importeres av `DokumentHandlingsmeny.tsx` og av
 * oppgave-/sjekkliste-sidenes inline type-import.
 */

export interface VideresendValg {
  /** Unik nøkkel: faggruppeId eller faggruppeId__dokumentflytId ved flere flyter */
  key: string;
  faggruppeId: string;
  faggruppeNavn: string;
  dokumentflytId: string;
  dokumentflytNavn: string;
  /** Visningsnavn i dropdown. Faggruppenavn alene hvis 1 flyt, med flytnavn i parentes hvis flere */
  visningsnavn: string;
  farge?: string | null;
  mottaker?: { userId?: string; groupId?: string };
}

export interface DokumentflytData {
  id: string;
  name: string;
  faggruppeId: string | null;
  roller: Array<{ rolle: string; label?: string | null }>;
  maler: Array<{ template: { id: string } }>;
  medlemmer: Array<{
    rolle: string;
    erHovedansvarlig: boolean;
    faggruppeId?: string | null;
    projectMemberId?: string | null;
    groupId?: string | null;
    hovedansvarligPerson?: { user: { id: string; name: string | null } } | null;
    projectMember?: { user: { id: string; name: string | null } } | null;
    group?: { id: string; name: string } | null;
  }>;
}

export interface FaggruppeData {
  id: string;
  name: string;
  color: string | null;
}

/**
 * Bygg videresend-valg basert på faggruppe + mal-match.
 * For hver faggruppe, finn dokumentflyter som har:
 * 1. faggruppeId === faggruppeId
 * 2. dokumentets templateId i maler-listen
 * Utled mottaker fra utfører-rollen (fallback: bestiller → godkjenner).
 */
export function byggVideresendValg(
  alleFaggrupper: FaggruppeData[],
  dokumentflyter: DokumentflytData[],
  templateId: string | null | undefined,
): VideresendValg[] {
  const valg: VideresendValg[] = [];

  // Tell antall matchende flyter per faggruppe for å avgjøre visningsnavn
  const flyterPerFaggruppe = new Map<string, DokumentflytData[]>();

  for (const fg of alleFaggrupper) {
    const matchendeFlyter = dokumentflyter.filter((df) => {
      if (df.faggruppeId !== fg.id) return false;
      if (!templateId) return true; // Ingen mal → vis alle flyter for faggruppen
      return df.maler.some((m) => m.template.id === templateId);
    });
    if (matchendeFlyter.length > 0) {
      flyterPerFaggruppe.set(fg.id, matchendeFlyter);
    }
  }

  for (const fg of alleFaggrupper) {
    const flyter = flyterPerFaggruppe.get(fg.id);
    if (!flyter) continue;

    const flereFlyterForFaggruppe = flyter.length > 1;

    for (const df of flyter) {
      // Utled mottaker: prioriter utfører → bestiller → godkjenner
      const mottaker = finnMottaker(df);

      const visningsnavn = flereFlyterForFaggruppe
        ? `${fg.name} (${df.name})`
        : fg.name;

      valg.push({
        key: flereFlyterForFaggruppe ? `${fg.id}__${df.id}` : fg.id,
        faggruppeId: fg.id,
        faggruppeNavn: fg.name,
        dokumentflytId: df.id,
        dokumentflytNavn: df.name,
        visningsnavn,
        farge: fg.color,
        mottaker,
      });
    }
  }

  return valg;
}

/** Finn mottaker fra dokumentflyt: utfører → bestiller → godkjenner */
function finnMottaker(df: DokumentflytData): { userId?: string; groupId?: string } | undefined {
  for (const rollePrioritet of ["utforer", "bestiller", "godkjenner"]) {
    const medlemmerMedRolle = df.medlemmer.filter((m) => m.rolle === rollePrioritet);
    if (medlemmerMedRolle.length === 0) continue;

    // Foretrekk hovedansvarlig
    const hovedansvarlig = medlemmerMedRolle.find((m) => m.erHovedansvarlig);
    const valgt = hovedansvarlig ?? medlemmerMedRolle[0];

    if (valgt?.group) return { groupId: valgt.group.id };
    if (valgt?.hovedansvarligPerson?.user) return { userId: valgt.hovedansvarligPerson.user.id };
    if (valgt?.projectMember?.user) return { userId: valgt.projectMember.user.id };
  }
  return undefined;
}
