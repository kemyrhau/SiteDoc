/**
 * Rene visningsregler for timer-lista (DagsseddelListe + TimerSyncStatusBar).
 * Ingen DB, ingen React — testbar (se dagsseddelListeVisning.test.ts).
 */

/** Minste felt visnings-dedupen trenger fra en listerad. */
export interface DedupRad {
  dato: string;
  syncStatus: string;
  // Bærer sedelen faktisk data? (timer- ELLER tillegg- ELLER maskin-rader).
  // En tom plassholder (0 av alt) kan skjules trygt, en sedel med innhold aldri.
  harInnhold: boolean;
  // Settes kun ved ekte divergens (≥2 søsken med innhold for samme dato) —
  // da vises begge kort MED denne markeringen i stedet for å skjule data stille.
  divergens?: boolean;
}

/**
 * Visnings-dedupe (2026-07-11): kollaps lokale sedel-hoder med samme dato til
 * ett i lista. Rent display — ingen DB-skriving, ingen pull-endring. Duplikat
 * kan oppstå som pre-F4-1-relikvi på enheter oppdatert fra gammel pull (som
 * matchet kun på server-id og innsatte et ekstra tomt server-hode ved siden av
 * en pending offline-sedel). Merge-autoriteten blir i M1 (push/`forsonSedel-
 * Identitet`) — her skjuler vi kun den tomme plassholderen visuelt.
 *
 * Ufravikelig: kun tomme plassholdere skjules. Har begge søsken innhold (ekte
 * divergens, sjelden) vises begge med `divergens`-markering — aldri stille tap.
 *
 * Ordre 2026-11-13 pkt. 3: en sedel med `syncStatus="conflict"` skjules ALDRI,
 * heller ikke når den er tom — banneret teller den, så lista må vise den (med
 * den røde «Konflikt»-merkelappen). Dedupen gjelder bare de øvrige søsknene.
 */
export function dedupPerDato<T extends DedupRad>(rader: T[]): T[] {
  const grupper = new Map<string, T[]>();
  for (const r of rader) {
    const liste = grupper.get(r.dato);
    if (liste) liste.push(r);
    else grupper.set(r.dato, [r]);
  }

  const resultat: T[] = [];
  // Map bevarer innsettingsrekkefølge; input er dato desc → gruppe-rekkefølge
  // forblir dato desc.
  for (const gruppe of grupper.values()) {
    if (gruppe.length === 1) {
      resultat.push(gruppe[0]);
      continue;
    }
    const konflikter = gruppe.filter((r) => r.syncStatus === "conflict");
    const ovrige = gruppe.filter((r) => r.syncStatus !== "conflict");
    resultat.push(...konflikter);
    if (ovrige.length === 0) continue;

    const medInnhold = ovrige.filter((r) => r.harInnhold);
    if (medInnhold.length >= 2) {
      // Ekte divergens: ALDRI skjul data stille. Vis alle innholds-søsken med
      // markering; tomme plassholdere i samme gruppe skjules fortsatt.
      for (const r of medInnhold) resultat.push({ ...r, divergens: true });
      continue;
    }
    // Ved siden av en konflikt-sedel er en tom plassholder bare støy.
    if (konflikter.length > 0 && medInnhold.length === 0) continue;
    // 0–1 søsken med innhold → trygt å kollapse til ett hode. Foretrekk søsknet
    // med innhold; ellers et ikke-avvist hode; ellers første.
    const beholdt =
      medInnhold[0] ??
      ovrige.find((r) => r.syncStatus !== "avvist") ??
      ovrige[0];
    resultat.push(beholdt);
  }
  return resultat;
}

/**
 * Ordre 2026-11-13 pkt. 3: hvilken konflikt-sedel banneret åpner. Er det flere,
 * åpnes den eldste (tidligste dato; lik dato → første i input). null = ingen.
 */
export function velgEldsteKonflikt(
  sedler: readonly { id: string; dato: string; syncStatus: string }[],
): string | null {
  let eldste: { id: string; dato: string } | null = null;
  for (const s of sedler) {
    if (s.syncStatus !== "conflict") continue;
    if (!eldste || s.dato < eldste.dato) eldste = s;
  }
  return eldste?.id ?? null;
}

/**
 * Trykk på sync-banneret. Synkronisering startes alltid (som før). Viser
 * banneret konflikt-tilstanden, åpnes i tillegg den eldste konflikt-sedelen.
 */
export function haandterStatusbarTrykk(args: {
  visningErKonflikt: boolean;
  finnKonfliktSedelId: () => string | null;
  aapneSedel: (id: string) => void;
  startSync: () => void;
}): void {
  args.startSync();
  if (!args.visningErKonflikt) return;
  const id = args.finnKonfliktSedelId();
  if (id) args.aapneSedel(id);
}
