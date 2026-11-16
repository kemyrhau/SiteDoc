/**
 * ORDRE 29 — felles rekkefølge i maskinvelgeren (web `MaskinVelger`, mobil
 * `EquipmentVelgerModal`). Før lå samme sortering kopiert i begge.
 *
 * Rekkefølge: sist brukt (nyeste først) → brukt på seddelen → internNummer
 * (numerisk) → navn.
 */

/** Antall sist brukte maskiner som løftes øverst (Kenneth/orkestrator: N = 5). */
export const SIST_BRUKTE_MASKINER_ANTALL = 5;

/** Numerisk-aware sammenligning av internNummer (tomme sist). */
export function sammenlignInternNummer(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const na = Number(a);
  const nb = Number(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return a.localeCompare(b, "nb");
}

/** De første `n` unike id-ene, i rekkefølgen de kommer (nyeste først inn → nyeste først ut). */
export function sisteUnikeMaskiner(
  vehicleIder: readonly string[],
  n: number = SIST_BRUKTE_MASKINER_ANTALL,
): string[] {
  const ut: string[] = [];
  for (const id of vehicleIder) {
    if (ut.length >= n) break;
    if (!ut.includes(id)) ut.push(id);
  }
  return ut;
}

/** Ny, sortert kopi av `liste`. `navn` gir siste sorteringsnøkkel (plattformens etikett). */
export function sorterMaskiner<T extends { id: string; internNummer: string | null }>(
  liste: readonly T[],
  valg: {
    sistBrukt?: readonly string[];
    bruktPaaSeddel?: readonly string[];
    navn: (m: T) => string;
  },
): T[] {
  const sistRang = new Map((valg.sistBrukt ?? []).map((id, i) => [id, i]));
  const brukt = new Set(valg.bruktPaaSeddel ?? []);
  return [...liste].sort((a, b) => {
    const ra = sistRang.get(a.id) ?? Infinity;
    const rb = sistRang.get(b.id) ?? Infinity;
    if (ra !== rb) return ra < rb ? -1 : 1;
    const aB = brukt.has(a.id);
    const bB = brukt.has(b.id);
    if (aB !== bB) return aB ? -1 : 1;
    const nr = sammenlignInternNummer(a.internNummer, b.internNummer);
    if (nr !== 0) return nr;
    return valg.navn(a).localeCompare(valg.navn(b), "nb");
  });
}
