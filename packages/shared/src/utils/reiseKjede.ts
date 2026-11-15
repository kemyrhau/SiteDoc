/**
 * Reisekjeden på én dag: overføring → reise til byggeplass → arbeid → reise
 * fra byggeplass → overføring tilbake. Kortene ligger etter hverandre uten
 * overlapp (ordre 2026-11-15 (17) P1).
 *
 * Kenneth-vedtak 2026-11-15: kjeden har ikke ett fast anker. Forslaget er
 * beregnet, og arbeideren retter. Kortet arbeideren har rettet er fast punkt;
 * beregnede nabokort flytter seg etter det, mens kort arbeideren har rettet
 * selv, står. Uten retting står arbeidsstart/-slutt fast, reisene legges
 * bakover og returen framover.
 *
 * Reisekort har fast lengde (beregnet kjøretid), med mindre arbeideren har
 * rettet det — da gjelder de rettede tidene, også lengden. Arbeid er elastisk:
 * en rettet reise inn mot arbeid flytter arbeidsstart (forsinkelse havner på
 * reisen, ikke på arbeidet).
 *
 * Ren funksjon, minutter fra midnatt. Ingen klemming mot døgnet — kalleren
 * avgjør hva som skjer utenfor 00:00–24:00.
 */

export type KjedeKort =
  | {
      nokkel: string;
      type: "reise";
      fraMin: number;
      tilMin: number;
      /** Arbeideren har rettet kortet — fra og til står. */
      rettet?: boolean;
    }
  | {
      nokkel: string;
      type: "arbeid";
      fraMin: number;
      tilMin: number;
      /** Arbeideren har rettet arbeidsstart. */
      rettetFra?: boolean;
      /** Arbeideren har rettet arbeidsslutt. */
      rettetTil?: boolean;
    };

const erRettet = (k: KjedeKort): boolean => k.type === "reise" && k.rettet === true;

/**
 * Sekvenserer kjeden. `kort` er i kjederekkefølge med høyst ett arbeidskort.
 * Uten arbeidskort er det ingen kjede å regne ut fra: rettede kort står,
 * resten returneres uendret.
 */
export function sekvenserReisekjede(kort: readonly KjedeKort[]): KjedeKort[] {
  const res = kort.map((k) => ({ ...k }));
  const a = res.findIndex((k) => k.type === "arbeid");
  if (a === -1) return res;
  const arbeid = res[a]!;
  if (arbeid.type !== "arbeid") return res;

  const lengde = kort.map((k) => k.tilMin - k.fraMin);

  /** Legg kortene i [fra, til] (synkende indeks) bakover fra `cursor`. */
  const bakover = (fra: number, til: number, cursor: number): number => {
    let c = cursor;
    for (let i = til; i >= fra; i--) {
      const k = res[i]!;
      if (erRettet(k)) {
        c = k.fraMin;
        continue;
      }
      k.tilMin = c;
      k.fraMin = c - lengde[i]!;
      c = k.fraMin;
    }
    return c;
  };
  /** Legg kortene i [fra, til] (stigende indeks) framover fra `cursor`. */
  const framover = (fra: number, til: number, cursor: number): number => {
    let c = cursor;
    for (let i = fra; i <= til; i++) {
      const k = res[i]!;
      if (erRettet(k)) {
        c = k.tilMin;
        continue;
      }
      k.fraMin = c;
      k.tilMin = c + lengde[i]!;
      c = k.tilMin;
    }
    return c;
  };

  // Ut-siden (før arbeid).
  let j = -1;
  for (let i = a - 1; i >= 0; i--) {
    if (erRettet(res[i]!)) {
      j = i;
      break;
    }
  }
  if (!arbeid.rettetFra && j !== -1) {
    // Arbeidsstart følger det rettede kortet; kortene imellom legges framover.
    arbeid.fraMin = framover(j + 1, a - 1, res[j]!.tilMin);
    bakover(0, j - 1, res[j]!.fraMin);
  } else {
    bakover(0, a - 1, arbeid.fraMin);
  }

  // Retursiden (etter arbeid) — speilet.
  let r = -1;
  for (let i = a + 1; i < res.length; i++) {
    if (erRettet(res[i]!)) {
      r = i;
      break;
    }
  }
  if (!arbeid.rettetTil && r !== -1) {
    arbeid.tilMin = bakover(a + 1, r - 1, res[r]!.fraMin);
    framover(r + 1, res.length - 1, res[r]!.tilMin);
  } else {
    framover(a + 1, res.length - 1, arbeid.tilMin);
  }
  return res;
}
