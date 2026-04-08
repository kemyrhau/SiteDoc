"use client";

/**
 * Kompakt flytindikator for dokumentlisten.
 * Viser alle ledd i flyten med ● på nåværende mottaker.
 *
 * Aktiv boks: ● HE-Leder (Elektro)
 * Inaktiv boks: [Tømrer]
 */

interface FlytMedlem {
  id: string;
  rolle: string;
  steg: number;
  enterprise: { id: string; name: string } | null;
  projectMember: { user: { id: string; name: string | null } } | null;
  group: { id: string; name: string } | null;
}

interface FlytIndikatorProps {
  medlemmer: FlytMedlem[];
  recipientUserId?: string | null;
  recipientGroupId?: string | null;
  status: string;
  bestillerUserId?: string;
}

interface Ledd {
  /** Kort visningsnavn (entreprise eller gruppe) */
  navn: string;
  /** Detaljert aktiv-visning: person/gruppe + entreprise i parentes */
  aktivNavn: string;
  gruppeIder: Set<string>;
  brukerIder: Set<string>;
  entrepriseIder: Set<string>;
}

/** Grupper medlemmer per steg og bygg visningsinfo */
function byggLedd(medlemmer: FlytMedlem[]): Ledd[] {
  const stegMap = new Map<number, FlytMedlem[]>();
  for (const m of medlemmer) {
    const liste = stegMap.get(m.steg) ?? [];
    liste.push(m);
    stegMap.set(m.steg, liste);
  }

  return [...stegMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([_steg, medl]) => {
      const entreprise = medl.find((m) => m.enterprise);
      const gruppe = medl.find((m) => m.group);
      const person = medl.find((m) => m.projectMember?.user?.name);

      // Kort navn for inaktive bokser
      const navn = entreprise
        ? entreprise.enterprise!.name
        : gruppe
          ? gruppe.group!.name
          : person?.projectMember?.user?.name ?? "?";

      // Detaljert navn for aktiv boks: person/gruppe (entreprise)
      let aktivNavn = navn;
      const personEllerGruppe = gruppe?.group?.name ?? person?.projectMember?.user?.name;
      const entrepriseNavn = entreprise?.enterprise?.name;
      if (personEllerGruppe && entrepriseNavn && personEllerGruppe !== entrepriseNavn) {
        aktivNavn = `${personEllerGruppe} (${entrepriseNavn})`;
      }

      return {
        navn,
        aktivNavn,
        gruppeIder: new Set(medl.filter((m) => m.group).map((m) => m.group!.id)),
        brukerIder: new Set(medl.filter((m) => m.projectMember).map((m) => m.projectMember!.user.id)),
        entrepriseIder: new Set(medl.filter((m) => m.enterprise).map((m) => m.enterprise!.id)),
      };
    });
}

function finnAktivtIndex(ledd: Ledd[], status: string, recipientUserId?: string | null, recipientGroupId?: string | null, bestillerUserId?: string): number {
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

function forkort(tekst: string, maks: number): string {
  return tekst.length > maks ? tekst.slice(0, maks - 1) + "…" : tekst;
}

export function FlytIndikator({ medlemmer, recipientUserId, recipientGroupId, status, bestillerUserId }: FlytIndikatorProps) {
  if (!medlemmer || medlemmer.length === 0) {
    return <span className="text-gray-300">—</span>;
  }

  const ledd = byggLedd(medlemmer);
  if (ledd.length === 0) return <span className="text-gray-300">—</span>;

  const aktivtIndex = finnAktivtIndex(ledd, status, recipientUserId, recipientGroupId, bestillerUserId);

  return (
    <div className="flex items-center gap-0.5 text-[11px] leading-none whitespace-nowrap overflow-hidden">
      {ledd.map((l, i) => {
        const erAktiv = i === aktivtIndex;
        const visningstekst = erAktiv ? l.aktivNavn : l.navn;
        return (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && (
              <span className={erAktiv ? "text-blue-400" : "text-gray-300"}>→</span>
            )}
            <span
              className={
                erAktiv
                  ? "rounded px-1.5 py-0.5 bg-blue-600 text-white font-medium"
                  : "rounded px-1.5 py-0.5 bg-gray-100 text-gray-500"
              }
              title={visningstekst}
            >
              {erAktiv && <span className="mr-0.5">●</span>}
              {forkort(visningstekst, erAktiv ? 24 : 12)}
            </span>
          </span>
        );
      })}
    </div>
  );
}
