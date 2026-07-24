/**
 * Videresend-valg: utleder mottakere (faggruppe → dokumentflyt → person/gruppe)
 * for dokumenthandlingsmenyen på web.
 *
 * Flyttet hit fra den slettede `StatusHandlinger.tsx`-komponenten (A-3a, 2026-07-17).
 * Ren logikk uten JSX — importeres av `DokumentHandlingsmeny.tsx` og av
 * oppgave-/sjekkliste-sidenes inline type-import.
 */

/** Én person/gruppe i en dokumentflyt som kan motta et videresendt dokument. */
export interface VideresendMedlem {
  /** Unik nøkkel for React-lister (userId eller groupId). */
  key: string;
  navn: string;
  rolle: string;
  mottaker: { userId?: string; groupId?: string };
}

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
  /**
   * Person-videresending (A-3b Del 2.4): flytens medlemmer, vist når faggruppe-raden
   * ekspanderes. Lar brukeren sende til en spesifikk person i mottaker-flyten i stedet
   * for standard-mottakeren. Datamodellen bærer dette allerede — ingen schema-endring.
   */
  medlemmer: VideresendMedlem[];
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
        medlemmer: finnMedlemmer(df),
      });
    }
  }

  return valg;
}

/**
 * Finn flytens medlemmer som konkrete mottakere (person eller gruppe), dedup på
 * mottaker-ID. Brukes til person-videresending (Del 2.4): ekspandér faggruppe →
 * velg spesifikk person. Hovedansvarlig person telles med; rolle beholdes for
 * eventuell visning/rekkefølge.
 */
function finnMedlemmer(df: DokumentflytData): VideresendMedlem[] {
  const medlemmer: VideresendMedlem[] = [];
  const settIder = new Set<string>();
  for (const m of df.medlemmer) {
    const person = m.projectMember?.user ?? m.hovedansvarligPerson?.user ?? null;
    if (person) {
      if (settIder.has(`u:${person.id}`)) continue;
      settIder.add(`u:${person.id}`);
      medlemmer.push({
        key: `u:${person.id}`,
        navn: person.name ?? "?",
        rolle: m.rolle,
        mottaker: { userId: person.id },
      });
    } else if (m.group) {
      if (settIder.has(`g:${m.group.id}`)) continue;
      settIder.add(`g:${m.group.id}`);
      medlemmer.push({
        key: `g:${m.group.id}`,
        navn: m.group.name,
        rolle: m.rolle,
        mottaker: { groupId: m.group.id },
      });
    }
  }
  return medlemmer;
}

/**
 * Ball-holder-navn (A-3b Del 1c): resolv navnet på den som har ballen fra
 * recipient-ID mot flytens medlemmer — **person foran faggruppe/gruppe**.
 * Detaljsidene har kun `recipientGroup`-relasjonen fra API-et, ikke `recipientUser`,
 * så person-navnet resolves klient-side fra flytmedlemmene (ingen API-endring).
 * Returnerer null når verken person eller gruppe kan navngis (kall-stedet faller
 * da til `recipientGroup.name` hvis det finnes).
 */
export function finnMottakerNavn(
  medlemmer: Array<{
    projectMember?: { user: { id: string; name: string | null } } | null;
    group?: { id: string; name: string } | null;
  }>,
  recipientUserId?: string | null,
  recipientGroupId?: string | null,
): string | null {
  if (recipientUserId) {
    const m = medlemmer.find((x) => x.projectMember?.user?.id === recipientUserId);
    if (m?.projectMember?.user?.name) return m.projectMember.user.name;
  }
  if (recipientGroupId) {
    const m = medlemmer.find((x) => x.group?.id === recipientGroupId);
    if (m?.group?.name) return m.group.name;
  }
  return null;
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
