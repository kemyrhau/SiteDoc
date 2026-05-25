/**
 * Delt helper for å bygge "ledd"-rader fra DokumentflytMedlem.
 * Brukes av FlytIndikator (kompakt visuell visning i topbar) og
 * DokumentHandlingsmeny (trykkbar boks-rad i bunn).
 *
 * Et "ledd" er en gruppering av medlemmer som deler samme `steg`.
 * Spesifisitets-hierarki ved navn-utledning: faggruppe > group > projectMember.
 */

export interface FlytMedlem {
  id?: string;
  rolle: string;
  steg: number;
  erHovedansvarlig?: boolean;
  faggruppe: { id: string; name: string; color?: string | null } | null;
  projectMember: { id?: string; user: { id: string; name: string | null } } | null;
  group: { id: string; name: string } | null;
}

export interface Ledd {
  steg: number;
  navn: string;
  aktivNavn: string;
  farge: string | null;
  gruppeIder: Set<string>;
  brukerIder: Set<string>;
  faggruppeIder: Set<string>;
  medlemmer: FlytMedlem[];
}

export function byggLedd(medlemmer: FlytMedlem[]): Ledd[] {
  const stegMap = new Map<number, FlytMedlem[]>();
  for (const m of medlemmer) {
    const liste = stegMap.get(m.steg) ?? [];
    liste.push(m);
    stegMap.set(m.steg, liste);
  }

  return [...stegMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([steg, medl]) => {
      const faggruppeM = medl.find((m) => m.faggruppe);
      const gruppe = medl.find((m) => m.group);
      const person = medl.find((m) => m.projectMember?.user?.name);

      const navn = faggruppeM
        ? faggruppeM.faggruppe!.name
        : gruppe
          ? gruppe.group!.name
          : person?.projectMember?.user?.name ?? "?";

      let aktivNavn = navn;
      const personEllerGruppe = gruppe?.group?.name ?? person?.projectMember?.user?.name;
      const faggruppeNavn = faggruppeM?.faggruppe?.name;
      if (faggruppeNavn && personEllerGruppe && personEllerGruppe !== faggruppeNavn) {
        aktivNavn = `${faggruppeNavn} · ${personEllerGruppe}`;
      }

      return {
        steg,
        navn,
        aktivNavn,
        farge: faggruppeM?.faggruppe?.color ?? null,
        gruppeIder: new Set(medl.filter((m) => m.group).map((m) => m.group!.id)),
        brukerIder: new Set(medl.filter((m) => m.projectMember).map((m) => m.projectMember!.user.id)),
        faggruppeIder: new Set(medl.filter((m) => m.faggruppe).map((m) => m.faggruppe!.id)),
        medlemmer: medl,
      };
    });
}

export function finnAktivtIndex(
  ledd: Ledd[],
  status: string,
  recipientUserId?: string | null,
  recipientGroupId?: string | null,
  bestillerUserId?: string,
): number {
  if (status === "draft" || status === "cancelled") {
    if (bestillerUserId) {
      const idx = ledd.findIndex((l) => l.brukerIder.has(bestillerUserId));
      if (idx !== -1) return idx;
    }
    return 0;
  }
  if (status === "closed" || status === "approved") return -1;

  if (recipientGroupId) {
    const idx = ledd.findIndex((l) => l.gruppeIder.has(recipientGroupId));
    if (idx !== -1) return idx;
  }
  if (recipientUserId) {
    const idx = ledd.findIndex((l) => l.brukerIder.has(recipientUserId));
    if (idx !== -1) return idx;
  }
  return ledd.length > 1 ? ledd.length - 1 : -1;
}

export function forkort(tekst: string, maks: number): string {
  return tekst.length > maks ? tekst.slice(0, maks - 1) + "…" : tekst;
}
