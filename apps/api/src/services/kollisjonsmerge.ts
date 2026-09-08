/**
 * Feltvis kollisjons-deteksjon ved lagring av dokumentdata.
 *
 * ÉN delt mekanikk for `sjekkliste.oppdaterData` og `oppgave.oppdaterData`
 * (Kenneth-vedtak 2026-09-08 — «kan vi varsle og merge uten sletting?»). Ingen
 * to implementasjoner.
 *
 * Modellen (ordre `merge-med-deteksjon`):
 *   1. Klienten sender KUN endrede felt (dirty-scopet) + `base` = hva den TRODDE
 *      feltet inneholdt pr. endret felt.
 *   2. Serveren leser fersk data i transaksjonen og kaller denne.
 *   3. Ingen kollisjon (server = klientens base) → skriv som før.
 *   4. Kollisjon (server ≠ base, og klienten endret verdien til noe annet enn
 *      serverens) → **serverens `verdi` beholdes** (den som kom først står), og
 *      **klientens tapende verdi legges som `tilfoyelse`** på feltet, med hvem og
 *      når. Ingenting slettes.
 *
 * `appendOnly` (oppgave i sendt tilstand): et felt med eksisterende verdi kan
 * ALDRI få verdien overskrevet — enhver ulik innkommende verdi blir en tilføyelse,
 * uavhengig av om serveren har flyttet seg. Det er append-only-vakten (Vedtak B,
 * 29.08) uttrykt som kollisjon: kastet FORBIDDEN erstattes av en tilføyelse.
 *
 * Kalles KUN når klienten sender `base` (ny klient). Eldre klienter (uten base)
 * beholder dagens atferd i kalleren: sjekkliste blind merge, oppgave append-only-
 * throw. Ingen regresjon — deteksjonen slår inn når klientene oppdateres.
 *
 * Feltmergen er deep pr. felt (`{ ...serverFelt, ...innFelt }`) slik at server-only-
 * nøkler klienten ikke kjenner (`tilfoyelser`, `grenseSnapshot`, `original`) bæres
 * fram — samme prinsipp som `grenseSnapshot` alt gjør ved lagring.
 */

/** Én tapende verdi, bevart på feltet ved kollisjon. Bærer verdi + hvem + når. */
export interface Tilfoyelse {
  verdi: unknown;
  brukerNavn: string;
  brukerId: string;
  /** ISO-8601 (veggklokke med offset). */
  tidspunkt: string;
}

type Feltobjekt = Record<string, unknown>;

export interface KollisjonsmergeInput {
  /** Server-fersk, komplett data (fra transaksjonslesningen). */
  eksisterende: Record<string, unknown>;
  /** Kun endrede felt fra klienten (dirty-scopet payload). */
  innData: Record<string, unknown>;
  /** Antatt gammel `verdi` pr. endret felt — klientens base. */
  base: Record<string, unknown>;
  brukerNavn: string;
  brukerId: string;
  /** ISO-8601-tidspunkt for tilføyelsen. */
  naa: string;
  /** Oppgave i sendt tilstand → enhver endring av et utfylt felt blir tilføyelse. */
  appendOnly: boolean;
}

export interface Kollisjon {
  feltId: string;
  /** Klientens tapende verdi (til varsel/retur). */
  verdi: unknown;
}

export interface KollisjonsmergeResultat {
  /** Komplett data klar til å skrives tilbake. */
  merget: Record<string, unknown>;
  kollisjoner: Kollisjon[];
}

/** Kanonisk sammenligning (nøkkelrekkefølge-uavhengig via verdi-serialisering). */
function like(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Har feltet en reell (ikke-tom) verdi å tape? Speiler `harFeltVerdi`. */
function harVerdi(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

export function kollisjonsmerge(input: KollisjonsmergeInput): KollisjonsmergeResultat {
  const { eksisterende, innData, base, brukerNavn, brukerId, naa, appendOnly } = input;
  const merget: Record<string, unknown> = { ...eksisterende };
  const kollisjoner: Kollisjon[] = [];

  for (const [feltId, innFeltRaw] of Object.entries(innData)) {
    const serverFelt = (eksisterende[feltId] ?? {}) as Feltobjekt;
    const innFelt = (innFeltRaw ?? {}) as Feltobjekt;
    // Deep pr.-felt: bær fram server-only-nøkler (tilfoyelser/grenseSnapshot/original).
    const deep: Feltobjekt = { ...serverFelt, ...innFelt };

    const serverVerdi = serverFelt.verdi;
    const innVerdi = innFelt.verdi;
    const baseFinnes = feltId in base;
    const baseV = base[feltId];

    // Endret klienten faktisk verdien? (uten base for feltet: anta ja hvis ulik server)
    const klientEndretVerdi = baseFinnes ? !like(innVerdi, baseV) : !like(innVerdi, serverVerdi);
    // Har serveren flyttet seg under klienten?
    const serverFlyttet = baseFinnes ? !like(serverVerdi, baseV) : false;

    const kollisjon =
      klientEndretVerdi &&
      !like(innVerdi, serverVerdi) &&
      harVerdi(serverVerdi) &&
      (appendOnly || serverFlyttet);

    if (kollisjon) {
      const tidligere = Array.isArray(serverFelt.tilfoyelser)
        ? (serverFelt.tilfoyelser as Tilfoyelse[])
        : [];
      merget[feltId] = {
        ...deep,
        verdi: serverVerdi, // den som kom først står
        tilfoyelser: [...tidligere, { verdi: innVerdi, brukerNavn, brukerId, tidspunkt: naa }],
      };
      kollisjoner.push({ feltId, verdi: innVerdi });
    } else if (baseFinnes && serverFlyttet && !klientEndretVerdi) {
      // Klienten rørte ikke verdien, men serveren flyttet seg → ikke klobb den ferske verdien.
      merget[feltId] = { ...deep, verdi: serverVerdi };
    } else {
      merget[feltId] = deep;
    }
  }

  return { merget, kollisjoner };
}
