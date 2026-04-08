"use client";

/**
 * Kompakt flytindikator for dokumentlisten.
 * Viser alle ledd i flyten med ● på nåværende mottaker.
 *
 * Eksempel: [Elektro] →●→ [HE-Leder] → [BH]
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
  /** Nåværende mottaker (person) */
  recipientUserId?: string | null;
  /** Nåværende mottaker (gruppe) */
  recipientGroupId?: string | null;
  /** Dokumentets status — brukes for å bestemme aktiv boks */
  status: string;
  /** Bestiller-bruker-ID — aktiv boks i draft */
  bestillerUserId?: string;
}

/** Hent visningsnavn for et flytmedlem */
function medlemNavn(m: FlytMedlem): string {
  if (m.group) return m.group.name;
  if (m.projectMember?.user?.name) return m.projectMember.user.name;
  if (m.enterprise) return m.enterprise.name;
  return "?";
}

/** Grupper medlemmer per steg og velg ett visningsnavn per steg */
function byggLedd(medlemmer: FlytMedlem[]): { navn: string; medlemIder: Set<string>; gruppeIder: Set<string>; brukerIder: Set<string>; entrepriseIder: Set<string> }[] {
  const stegMap = new Map<number, FlytMedlem[]>();
  for (const m of medlemmer) {
    const liste = stegMap.get(m.steg) ?? [];
    liste.push(m);
    stegMap.set(m.steg, liste);
  }

  const sortert = [...stegMap.entries()].sort(([a], [b]) => a - b);

  return sortert.map(([_steg, medl]) => {
    // Velg primærnavn: foretrekk entreprise-navn, deretter gruppe, deretter person
    const entrepriseMedlem = medl.find((m) => m.enterprise);
    const gruppeMedlem = medl.find((m) => m.group);
    const navn = entrepriseMedlem
      ? entrepriseMedlem.enterprise!.name
      : gruppeMedlem
        ? gruppeMedlem.group!.name
        : medl[0] ? medlemNavn(medl[0]) : "?";

    return {
      navn,
      medlemIder: new Set(medl.map((m) => m.id)),
      gruppeIder: new Set(medl.filter((m) => m.group).map((m) => m.group!.id)),
      brukerIder: new Set(medl.filter((m) => m.projectMember).map((m) => m.projectMember!.user.id)),
      entrepriseIder: new Set(medl.filter((m) => m.enterprise).map((m) => m.enterprise!.id)),
    };
  });
}

export function FlytIndikator({ medlemmer, recipientUserId, recipientGroupId, status, bestillerUserId }: FlytIndikatorProps) {
  if (!medlemmer || medlemmer.length === 0) {
    return <span className="text-gray-300">—</span>;
  }

  const ledd = byggLedd(medlemmer);
  if (ledd.length === 0) return <span className="text-gray-300">—</span>;

  // Finn aktivt ledd basert på mottaker
  let aktivtIndex = -1;

  if (status === "draft" || status === "cancelled") {
    // Bestiller har ballen — finn leddet med bestilleren
    if (bestillerUserId) {
      aktivtIndex = ledd.findIndex((l) => l.brukerIder.has(bestillerUserId));
    }
    // Fallback: første ledd
    if (aktivtIndex === -1) aktivtIndex = 0;
  } else if (status === "closed" || status === "approved") {
    // Ingen har ballen — vis alle dempet
    aktivtIndex = -1;
  } else {
    // Finn mottaker i leddene
    if (recipientGroupId) {
      aktivtIndex = ledd.findIndex((l) => l.gruppeIder.has(recipientGroupId));
    }
    if (aktivtIndex === -1 && recipientUserId) {
      aktivtIndex = ledd.findIndex((l) => l.brukerIder.has(recipientUserId));
    }
    // Fallback: siste ledd (utfører-siden)
    if (aktivtIndex === -1 && ledd.length > 1) {
      aktivtIndex = ledd.length - 1;
    }
  }

  return (
    <div className="flex items-center gap-0.5 text-[11px] leading-none whitespace-nowrap overflow-hidden">
      {ledd.map((l, i) => {
        const erAktiv = i === aktivtIndex;
        return (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && (
              <span className={erAktiv ? "text-blue-400" : "text-gray-300"}>
                →
              </span>
            )}
            <span
              className={
                erAktiv
                  ? "rounded px-1.5 py-0.5 bg-blue-600 text-white font-medium"
                  : "rounded px-1.5 py-0.5 bg-gray-100 text-gray-500"
              }
              title={l.navn}
            >
              {erAktiv && <span className="mr-0.5">●</span>}
              {l.navn.length > 12 ? l.navn.slice(0, 11) + "…" : l.navn}
            </span>
          </span>
        );
      })}
    </div>
  );
}
