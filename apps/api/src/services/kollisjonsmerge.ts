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
 *
 * REPEATERE (Kenneth-funn 2026-09-09, celle-nivå gatet): en repeater er ETT felt med
 * en ARRAY av rader (`{ _radId, felter }`) som `verdi`. Feltvis behandling ga falsk
 * kollisjon på HELE repeateren når man bare la til en rad (arrayet endret seg), og
 * la hele radobjektet som tilføyelse (rå JSON på skjerm + i arkiv-PDF). Løsning:
 * kollisjonsenheten er CELLA (`_radId` × celle-feltId). Rader matches på `_radId`;
 * matchede rader kjører NØYAKTIG samme skalar-logikk pr. celle (rekursivt kall).
 *   - Ny rad (nytt `_radId`, ikke på server) → legges til, ingen kollisjon. Tomme
 *     celler inni har ingen verdi → aldri kollisjon (Kenneths «legg til rad»).
 *   - Rad på server, borte fra inn → sletting. Honoreres KUN når raden er UENDRET
 *     på server siden klientens base. Er den endret (motparten rørte den) eller
 *     ikke i base (motparten la den til samtidig) → raden BEVARES (ingen datatap;
 *     lukker runde-48-hullet). Sletting blir ikke en tilføyelse.
 *   - Tapende celleverdi → tilføyelse PÅ CELLA (skalar, lesbar). Arkiv-PDF rendrer
 *     alt celle-tilføyelser (`packages/pdf/src/arkivmal/repeater.ts`), så fiksen
 *     treffer arkivet gratis.
 * Rad-nivå notat «forsøkt slettet av X» er egen sak (krever rad-nivå rendering på
 * web/mobil/PDF). Repeater-gjenkjenning + rad-traversering bruker den KANONISKE
 * `@sitedoc/shared/utils/repeaterRad` (`feltKartFraRad`/`medFeltKart`) — ingen tredje.
 * Eldre flate rader (uten `_radId`, før rad-id-vedtaket 2026-08-22) matches ikke og
 * følger innkommende blindt, som før — produksjonsformen `{ _radId, felter }` er stien.
 */

import { feltKartFraRad, medFeltKart } from "@sitedoc/shared/utils";

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

/** Stabil rad-id (uuid) fra en repeater-rad; tom streng for eldre flat rad uten id. */
function radId(rad: unknown): string {
  const r = rad as { _radId?: unknown } | null | undefined;
  return typeof r?._radId === "string" ? r._radId : "";
}

/**
 * Er verdien et repeater-rad-array (produksjonsform `{ _radId, felter }`)? Skiller
 * repeater fra list_multi/persons (array av strenger) og attachments (array av
 * `{ id, url, filnavn }`) ved å kreve at hvert element bærer `_radId`/`felter`.
 */
function erRepeaterVerdi(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      (el) =>
        !!el &&
        typeof el === "object" &&
        !Array.isArray(el) &&
        ("_radId" in (el as object) || "felter" in (el as object)),
    )
  );
}

function somArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Celle-nivå merge av ÉN repeater. Matcher rader på `_radId`, kjører skalar-logikken
 * pr. celle i matchede rader (rekursivt `kollisjonsmerge`), legger til nye rader, og
 * bevarer server-rader mot sletting når de er endret siden base. Returnerer det ferdige
 * rad-arrayet + kollisjoner (rapportert på repeaterens feltId med lesbar celleverdi).
 */
function mergeRepeaterFelt(args: {
  feltId: string;
  serverRader: unknown[];
  innRader: unknown[];
  baseRader: unknown[] | undefined;
  brukerNavn: string;
  brukerId: string;
  naa: string;
  appendOnly: boolean;
}): { rader: unknown[]; kollisjoner: Kollisjon[] } {
  const { feltId, serverRader, innRader, baseRader, brukerNavn, brukerId, naa, appendOnly } = args;
  const kollisjoner: Kollisjon[] = [];

  const serverById = new Map<string, unknown>();
  for (const r of serverRader) {
    const id = radId(r);
    if (id) serverById.set(id, r);
  }
  const baseById = new Map<string, unknown>();
  for (const r of baseRader ?? []) {
    const id = radId(r);
    if (id) baseById.set(id, r);
  }
  const innIds = new Set<string>();
  for (const r of innRader) {
    const id = radId(r);
    if (id) innIds.add(id);
  }

  const rader: unknown[] = [];

  // 1. Innkommende rader — i klientens rekkefølge.
  for (const innRad of innRader) {
    const id = radId(innRad);
    const serverRad = id ? serverById.get(id) : undefined;
    if (!serverRad) {
      // Ny rad (eller eldre rad uten id) → ingen kollisjon, legg til som den er.
      rader.push(innRad);
      continue;
    }
    // Matchet rad → celle-nivå: kjør skalar-logikken pr. celle (rekursivt).
    const serverFelter = feltKartFraRad(serverRad);
    const innFelter = feltKartFraRad(innRad);
    const baseRad = baseById.get(id);
    const baseFelter = baseRad !== undefined ? feltKartFraRad(baseRad) : undefined;
    const baseCelleVerdier: Record<string, unknown> = {};
    if (baseFelter) {
      for (const cid of Object.keys(baseFelter)) {
        baseCelleVerdier[cid] = (baseFelter[cid] as Feltobjekt)?.verdi;
      }
    }
    const res = kollisjonsmerge({
      eksisterende: serverFelter,
      innData: innFelter,
      base: baseCelleVerdier,
      brukerNavn,
      brukerId,
      naa,
      appendOnly,
    });
    rader.push(medFeltKart(innRad, res.merget));
    // Rapporter på repeaterens feltId; verdien er nå cellas skalar (lesbar, ikke rå rad).
    for (const k of res.kollisjoner) kollisjoner.push({ feltId, verdi: k.verdi });
  }

  // 2. Server-rader som ikke er i inn → sletting? Honorér kun når UENDRET siden base.
  for (const serverRad of serverRader) {
    const id = radId(serverRad);
    if (!id || innIds.has(id)) continue; // representert i inn (eller eldre rad uten id → følger inn)
    const baseRad = baseById.get(id);
    if (baseRad !== undefined && like(serverRad, baseRad)) {
      continue; // klienten slettet en rad den kjente, uendret på server → honorér sletting
    }
    // Endret på server siden base, eller lagt til av motparten (ikke i base) → BEVAR.
    rader.push(serverRad);
  }

  return { rader, kollisjoner };
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

    // Repeater: kollisjonsenheten er cella, ikke hele arrayet. Kjenn igjen på rad-formen
    // i en av verdiene (server/inn/base) — også når inn er tømt (alle rader slettet).
    if (erRepeaterVerdi(serverVerdi) || erRepeaterVerdi(innVerdi) || erRepeaterVerdi(baseV)) {
      const { rader, kollisjoner: cellK } = mergeRepeaterFelt({
        feltId,
        serverRader: somArray(serverVerdi),
        innRader: somArray(innVerdi),
        baseRader: baseFinnes ? somArray(baseV) : undefined,
        brukerNavn,
        brukerId,
        naa,
        appendOnly,
      });
      // Bær fram server-only-nøkler på repeater-OBJEKTET (kommentar/vedlegg utenfor rader,
      // grenseSnapshot); objektnivå-verdier merges blindt (inn vinner) som før — kun radene
      // er kollisjonsbeskyttet i denne ordren. `verdi` er det ferdig-mergede rad-arrayet.
      merget[feltId] = { ...serverFelt, ...innFelt, verdi: rader };
      kollisjoner.push(...cellK);
      continue;
    }

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
