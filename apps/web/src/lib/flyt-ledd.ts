/**
 * Delt kilde for flyt-ledd (2026-07-26).
 *
 * `byggLedd` + `finnAktivtIndex` lå tidligere duplisert i BÅDE `FlytIndikator.tsx`
 * og `DokumentHandlingsmeny.tsx` (fabel-flagg 1). Én kilde nå — begge importerer
 * herfra, ingen dobbel logikk. Ren utledning fra dokumentets FAKTISKE flyt
 * (medlemmer gruppert på `steg`): antall ledd er dynamisk, aldri hardkodet.
 */

export interface FlytMedlem {
  id: string;
  rolle: string;
  steg: number;
  faggruppe: { id: string; name: string } | null;
  projectMember: { user: { id: string; name: string | null } } | null;
  group: { id: string; name: string } | null;
}

/** Ett medlem i et ledd — for medlems-hover (navn + rolle). */
export interface LeddMedlem {
  navn: string;
  rolle: string;
}

export interface Ledd {
  /** Kort visningsnavn (faggruppe, ellers gruppe, ellers person). */
  navn: string;
  /** Detaljert aktiv-visning: faggruppe · person/gruppe. */
  aktivNavn: string;
  /** Leddets rolle (steg-gruppen bærer rollen) — brukes til rolle-etiketten. */
  rolle: string;
  /** Alle medlemmer i leddet (navn + rolle) for hover-listing. */
  medlemmer: LeddMedlem[];
  steg: number;
  gruppeIder: Set<string>;
  brukerIder: Set<string>;
  faggruppeIder: Set<string>;
}

/** Grupper medlemmer per steg og bygg visningsinfo. */
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
      const faggruppe = medl.find((m) => m.faggruppe);
      const gruppe = medl.find((m) => m.group);
      const person = medl.find((m) => m.projectMember?.user?.name);

      // Kort navn for inaktive bokser
      const navn = faggruppe
        ? faggruppe.faggruppe!.name
        : gruppe
          ? gruppe.group!.name
          : person?.projectMember?.user?.name ?? "?";

      // Detaljert navn for aktiv boks: faggruppe · person/gruppe
      let aktivNavn = navn;
      const personEllerGruppe = gruppe?.group?.name ?? person?.projectMember?.user?.name;
      const faggruppeNavn = faggruppe?.faggruppe?.name;
      if (faggruppeNavn && personEllerGruppe && personEllerGruppe !== faggruppeNavn) {
        aktivNavn = `${faggruppeNavn} · ${personEllerGruppe}`;
      }

      // Medlems-hover (Kenneth 2026-07-26): alle medlemmene i leddet, navn + rolle.
      const leddMedlemmer: LeddMedlem[] = medl.map((m) => ({
        navn: m.projectMember?.user?.name ?? m.group?.name ?? m.faggruppe?.name ?? "?",
        rolle: m.rolle,
      }));

      return {
        navn,
        aktivNavn,
        // Steg-gruppen bærer rollen — medlemmene i ett steg deler rolle.
        rolle: medl[0]?.rolle ?? "",
        medlemmer: leddMedlemmer,
        steg,
        gruppeIder: new Set(medl.filter((m) => m.group).map((m) => m.group!.id)),
        brukerIder: new Set(medl.filter((m) => m.projectMember).map((m) => m.projectMember!.user.id)),
        faggruppeIder: new Set(medl.filter((m) => m.faggruppe).map((m) => m.faggruppe!.id)),
      };
    });
}

/** Finn aktiv boks (hvor dokumentet er nå). -1 = terminal (lukket/godkjent). */
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

/** Filtrer til aktiv boks + én nabo på hver side (kompakt/kollaps-modus). */
export function filtrerNaboer(
  ledd: Ledd[],
  aktivtIndex: number,
): Array<{ ledd: Ledd; originalIndex: number }> {
  // Hvis aktivtIndex er -1 (lukket/godkjent), vis de to siste
  if (aktivtIndex === -1) {
    return ledd.slice(-2).map((l, i) => ({ ledd: l, originalIndex: ledd.length - 2 + i }));
  }

  const resultat: Array<{ ledd: Ledd; originalIndex: number }> = [];
  const start = Math.max(0, aktivtIndex - 1);
  const slutt = Math.min(ledd.length - 1, aktivtIndex + 1);
  for (let i = start; i <= slutt; i++) {
    const l = ledd[i];
    if (l) resultat.push({ ledd: l, originalIndex: i });
  }
  return resultat;
}
