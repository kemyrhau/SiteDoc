/**
 * Beslutningslogikken for U-BEKREFT-sammenligningen (modus B + C) — den rene kjernen
 * bak `app/timer/[id].tsx`-visningen som lar en arbeider se BEGGE dagskort (appens
 * utregning mot web-dagskortet) pr. tidsrom og velge hva som er rett.
 *
 * 🔴 Ren funksjon — mobil-harness render-tester ikke RN, så gate-kriteriene må kunne
 * feile uten skjermen montert (samme mønster som `dokumentLokasjonsOmfang`). Her bor:
 *  - offline-skillet (gate 4): «får ikke kontakt» er IKKE «web-kortet er tomt».
 *  - modus B (redigerbart: `draft`/`returned`) vs modus C (låst: `sent`/`accepted`).
 *  - flettingen PR. TIDSROM (gate 1): samme klokkeslett på samme linje.
 *  - tom side → «ingen registreringer», ikke blank (gate 5, falsk-positiv-vakten).
 *
 * 🔴 Server-radenes innhold finnes IKKE lokalt under en aktiv conflict (timerSync
 * beholder lokale rader, skriver kun hode-status). Derfor må web-kortet hentes LIVE via
 * `dagsseddel.hentMedId`, og derfor er offline en ekte grense: uten nett har vi bare den
 * ene siden. `webLaster` skiller «vet ikke ennå» fra «vet at den er tom».
 */

export type NettStatus = "online" | "offline";
export type WebStatus = "draft" | "returned" | "sent" | "accepted";
export type Side = "lokal" | "server";

/**
 * Minste felles nevner for en timer-rad fra begge kilder: lokal `sheetTimerLocal`
 * (Drizzle) og server `sheetTimer` (Prisma via hentMedId). Kun feltene sammenligningen
 * trenger; visningsfelt (`projectId`/`lonnsartId`/`beskrivelse`) bæres med uendret.
 */
export interface TimerRad {
  id: string;
  fraTid: string | null;
  tilTid: string | null;
  timer: number;
  projectId?: string | null;
  lonnsartId?: string | null;
  beskrivelse?: string | null;
}

/** Én linje i sammenligningen: samme tidsrom, appens rad mot web-kortets rad. */
export interface TidsromRad {
  /** Visningsnøkkel for tidsrommet: «07:00–15:00», eller varigheten når klokkeslett mangler. */
  tidsrom: string;
  /** Appens utregnede rad for dette tidsrommet, eller null (ingen registrering fra appen). */
  lokal: TimerRad | null;
  /** Web-dagskortets rad for dette tidsrommet, eller null (ingen registrering på web). */
  server: TimerRad | null;
  /** Forhåndsvalgt side. Ensidig rad → den siden som finnes; begge → web-kortet (reviderbart). */
  valgt: Side;
}

export type Sammenligning =
  /** Ikke nett → kan ikke hente web-kortet. Skjermen sier «får ikke kontakt», ALDRI tomt panel. */
  | { slag: "offline" }
  /** Web-kortet hentes → «vet ikke ennå». Forskjellig fra offline og fra tomt. */
  | { slag: "laster" }
  /** Online, men web-kortet kunne ikke leses (query-feil). Ikke det samme som «tomt kort». */
  | { slag: "utilgjengelig" }
  /** Web-kortet er redigerbart → valg pr. rad, ender i ETT dagskort. */
  | { slag: "modusB"; rader: TidsromRad[] }
  /** Web-kortet er låst (`sent`/`accepted`) → lesevisning, ingen skrivevei herfra. */
  | { slag: "modusC"; rader: TidsromRad[]; grunn: WebStatus };

/**
 * Tidsrom-nøkkel for fletting. Begge klokkeslett satt → «fra–til» (felles akse, gate 1).
 * Mangler ett, kan vi IKKE påstå at to rader er samme tidsrom → `null` (egen linje hver).
 */
function tidsromNokkel(rad: TimerRad): string | null {
  return rad.fraTid && rad.tilTid ? `${rad.fraTid}–${rad.tilTid}` : null;
}

/** Visningsetikett: klokkeslett når de finnes, ellers varigheten (aldri blank). */
function tidsromEtikett(rad: TimerRad): string {
  const n = tidsromNokkel(rad);
  return n ?? `${rad.timer} t`;
}

function flettPrTidsrom(lokale: TimerRad[], server: TimerRad[]): TidsromRad[] {
  const slots = new Map<string, { tidsrom: string; lokal: TimerRad | null; server: TimerRad | null }>();
  let utenNokkel = 0;

  const plasser = (rad: TimerRad, side: Side) => {
    const n = tidsromNokkel(rad);
    // Uten klokkeslett: egen unik slot pr. rad (merges aldri mot en annen rad).
    const key = n ?? `__utenTid_${side}_${utenNokkel++}`;
    const eksisterende = slots.get(key);
    if (eksisterende) {
      eksisterende[side] = rad;
    } else {
      slots.set(key, {
        tidsrom: tidsromEtikett(rad),
        lokal: side === "lokal" ? rad : null,
        server: side === "server" ? rad : null,
      });
    }
  };

  for (const r of lokale) plasser(r, "lokal");
  for (const r of server) plasser(r, "server");

  const rader = [...slots.values()].map((s) => ({
    ...s,
    // Ensidig rad → den siden som finnes. Begge → web-kortet som reviderbar base.
    valgt: (s.lokal && !s.server ? "lokal" : "server") as Side,
  }));

  // Sorter på starttid; rader uten klokkeslett sist (stabil rekkefølge).
  return rader.sort((a, b) => {
    const fa = a.lokal?.fraTid ?? a.server?.fraTid ?? null;
    const fb = b.lokal?.fraTid ?? b.server?.fraTid ?? null;
    if (fa === fb) return 0;
    if (fa === null) return 1;
    if (fb === null) return -1;
    return fa < fb ? -1 : 1;
  });
}

export function dagskortSammenligning(input: {
  nettStatus: NettStatus;
  webLaster: boolean;
  /** Web-kortet fra `hentMedId` — null når det ikke er hentet/ikke lot seg lese. */
  webKort: { status: WebStatus; timer: TimerRad[] } | null;
  lokaleTimer: TimerRad[];
}): Sammenligning {
  // Rekkefølgen er regelen: offline FØR laster FØR utilgjengelig. Et tomt web-panel
  // og «vet ikke ennå» er to forskjellige ting (ordrens kjerne) — de får hver sin gren.
  if (input.nettStatus === "offline") return { slag: "offline" };
  if (input.webLaster) return { slag: "laster" };
  if (!input.webKort) return { slag: "utilgjengelig" };

  const rader = flettPrTidsrom(input.lokaleTimer, input.webKort.timer);
  const redigerbar = input.webKort.status === "draft" || input.webKort.status === "returned";
  return redigerbar
    ? { slag: "modusB", rader }
    : { slag: "modusC", rader, grunn: input.webKort.status };
}
