/**
 * Slice 4a — midnatt-splitt av en arbeidsøkt.
 *
 * Et skift som krysser 00:00 (lokal tid) skal bli én dagsseddel per
 * kalenderdag. Denne rene funksjonen deler bracket-en [startIso, sluttIso] ved
 * hver lokale midnatt og returnerer ett segment per dag. Timene i segmentene
 * summerer alltid til den reelle totalen (19:00→07:00 = 5 t + 7 t = 12 t).
 *
 * Ren utils (ingen DB/IO) → enhetstestbar. Lokal tid brukes fordi `dato` på
 * dagsseddelen er en lokal kalenderdag.
 */

export type Dagsegment = {
  /** Lokal kalenderdag, ISO YYYY-MM-DD. */
  dato: string;
  /** ISO-timestamp for segmentets start. */
  startIso: string;
  /** ISO-timestamp for segmentets slutt (≤ neste midnatt). */
  sluttIso: string;
  /** Første segment = dagen økten startet. Reise + pause hører hit. */
  erStartSegment: boolean;
};

function formatIsoDato(d: Date): string {
  const aar = d.getFullYear();
  const maaned = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${aar}-${maaned}-${dag}`;
}

/**
 * UF-2 (glemt-dag-cap) — skill **nattskift** (kort, krysser typisk én midnatt)
 * fra **glemt avslutning** (fler-døgns spenn) FØR midnatt-splitt.
 *
 * Rotårsak 160 t: en sluttbane med `slutt = nå` mater et fler-døgns spenn inn i
 * `splittVedMidnatt`, som deler det blindt dag-for-dag → N døgnsedler à ~24 t.
 *
 * Universell enkelt-skift-cap (gjelder ALLE sluttbaner): er spennet større enn
 * `deteksjonsTimer` (trinn 8 — hard AML/tariff-cap), tolkes økten som en glemt
 * avslutning og slutt-tiden **kappes** til `start + kappLengdeTimer` (trinn 7 —
 * sesongjustert dagsnorm). `kappet: true` signaliserer at slutt-kilden bør
 * settes til "system" (gjettet → kontroll-badge, korrigerbart forslag).
 *
 * Et legitimt nattskift (< deteksjonsTimer, krysser én midnatt) slipper urørt
 * gjennom og splittes som normalt.
 */
export function kappGlemtDagSlutt(
  startIso: string,
  sluttIso: string,
  opts: { deteksjonsTimer: number; kappLengdeTimer: number },
): { sluttIso: string; kappet: boolean } {
  const start = new Date(startIso).getTime();
  const slutt = new Date(sluttIso).getTime();
  const spennTimer = (slutt - start) / 3_600_000;
  if (!(spennTimer > opts.deteksjonsTimer)) {
    return { sluttIso, kappet: false };
  }
  // DEL 5 d (Kenneth 2026-11-12): en estimert slutt fører aldri tid på neste
  // dato — kappet stopper ved midnatt etter start.
  const estimert = Math.min(
    start + opts.kappLengdeTimer * 3_600_000,
    nesteLokaleMidnatt(startIso).getTime(),
  );
  return {
    sluttIso: new Date(estimert).toISOString(),
    kappet: true,
  };
}

/** Første lokale midnatt etter `iso` (00:00 neste kalenderdag). */
export function nesteLokaleMidnatt(iso: string): Date {
  const d = new Date(iso);
  d.setHours(24, 0, 0, 0);
  return d;
}

/**
 * DEL 5 d — glemt dag: estimert slutt for en økt brukeren glemte å avslutte.
 * Firmaets standard sluttid på startdatoen; ligger den før start, start +
 * dagsnorm (7,5 t uten norm). Estimatet kappes ved midnatt etter start, så
 * det føres aldri automatisk tid på neste dato. Brukeren kan selv rette
 * sluttiden til etter midnatt i Bekreft dag (del c).
 */
export function estimerGlemtSlutt(
  startIso: string,
  standardSluttHHMM: string,
  dagsnormTimer: number | null | undefined,
): { sluttIso: string; kappetVedMidnatt: boolean } {
  const start = new Date(startIso);
  const [tt, mm] = standardSluttHHMM.split(":").map(Number);
  let slutt = new Date(start);
  slutt.setHours(tt ?? 0, mm ?? 0, 0, 0);
  if (slutt.getTime() <= start.getTime()) {
    const norm = dagsnormTimer && dagsnormTimer > 0 ? dagsnormTimer : 7.5;
    slutt = new Date(start.getTime() + norm * 3_600_000);
  }
  const midnatt = nesteLokaleMidnatt(startIso);
  if (slutt.getTime() > midnatt.getTime()) {
    return { sluttIso: midnatt.toISOString(), kappetVedMidnatt: true };
  }
  return { sluttIso: slutt.toISOString(), kappetVedMidnatt: false };
}

/**
 * Del [startIso, sluttIso] ved hver lokale midnatt.
 *
 * - Samme kalenderdag (eller `slutt <= start`) → ett segment (uendret atferd
 *   for normale dagskift; degenerert/0-lengde gir ett start-segment).
 * - Kryssende → ett segment per dag, hver klampet til [segStart, nesteMidnatt].
 */
export function splittVedMidnatt(
  startIso: string,
  sluttIso: string,
): Dagsegment[] {
  const start = new Date(startIso);
  const slutt = new Date(sluttIso);

  // Degenerert (ingen positiv varighet) → behold som ett start-segment, så
  // kallende kode beholder dagens atferd (draft på start-dagen, 0 timer).
  if (!(slutt.getTime() > start.getTime())) {
    return [
      {
        dato: formatIsoDato(start),
        startIso: start.toISOString(),
        sluttIso: slutt.toISOString(),
        erStartSegment: true,
      },
    ];
  }

  const segmenter: Dagsegment[] = [];
  let cur = start;
  let forste = true;
  while (cur.getTime() < slutt.getTime()) {
    const nesteMidnatt = new Date(cur);
    nesteMidnatt.setHours(24, 0, 0, 0); // neste lokale midnatt
    const segSlutt =
      nesteMidnatt.getTime() < slutt.getTime() ? nesteMidnatt : slutt;
    segmenter.push({
      dato: formatIsoDato(cur),
      startIso: cur.toISOString(),
      sluttIso: segSlutt.toISOString(),
      erStartSegment: forste,
    });
    cur = segSlutt;
    forste = false;
  }
  return segmenter;
}
