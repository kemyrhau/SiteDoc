// ============================================================================
//  Ansattens oppmøtested med perioder (POST 2026-11-15 (12) D)
//
//  ÉN delt, ren resolver for «hvor møter den ansatte denne dagen». Mobil
//  (lokal cache, virker offline), web og server kaller samme funksjon.
//
//  Rekkefølgen er bindende (Kenneth):
//    1. Dagens prosjekt har en BYGGEPLASS-periode som gjelder på datoen
//       → ingen reise, arbeidstid fra første minutt.
//    2. GPS-start på et kontor → det kontoret.
//    3. Midlertidig kontor-periode (fast=false) som gjelder på datoen.
//    4. Fast kontor som gjelder på datoen: det åpne (fraDato ≤ datoen), ellers
//       det lukkede som dekket datoen (et erstattet fast sted får tilDato).
//    5. Ingenting → «ikke valgt» (tomt = ikke valgt ennå, aldri gjetting).
//
//  Datoen er dagsseddelens dato (YYYY-MM-DD), så etterregistrering treffer
//  perioden som gjaldt da. Overlapp er avvist i serverlaget; skulle to likevel
//  dekke datoen, vinner nyeste fraDato (likt → korteste periode).
// ============================================================================

export type OppmotePeriodeType = "kontor" | "byggeplass";

export interface OppmotePeriodeInput {
  /** Periodens id (overføringen peker på den). Valgfri for eldre kallere. */
  id?: string;
  type: OppmotePeriodeType;
  /** Fast oppmøtested (kun kontor). false = midlertidig kontor / byggeplass. */
  fast: boolean;
  /** Satt kun for kontor. */
  oppmotestedId: string | null;
  /** Satt kun for byggeplass. */
  projectId: string | null;
  /** YYYY-MM-DD. */
  fraDato: string;
  /** YYYY-MM-DD, null = gjeldende. */
  tilDato: string | null;
  /** POST (13) del B: 'admin' (firmaadmin / eget førstevalg) | 'overforing'
   *  (Tur til annet kontor i reise-kortet). Utelatt/null = admin. */
  kilde?: "admin" | "overforing" | null;
}

export type OppmoteResultat =
  | { kilde: "byggeplass"; projectId: string }
  | { kilde: "gps" | "midlertidig" | "fast"; oppmotestedId: string }
  | { kilde: "ikkeValgt" };

/** Normaliserer Date/ISO-streng til YYYY-MM-DD (Prisma @db.Date gir Date i UTC). */
export function tilIsoDato(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function dekker(p: OppmotePeriodeInput, dato: string): boolean {
  return p.fraDato <= dato && (p.tilDato == null || dato <= p.tilDato);
}

function spennDager(p: OppmotePeriodeInput): number {
  if (p.tilDato == null) return Number.POSITIVE_INFINITY;
  return (Date.parse(p.tilDato) - Date.parse(p.fraDato)) / 86_400_000;
}

/** Nyeste fraDato vinner; likt → korteste periode (mest spesifikk). */
function mestSpesifikk(a: OppmotePeriodeInput, b: OppmotePeriodeInput): number {
  if (a.fraDato !== b.fraDato) return a.fraDato > b.fraDato ? -1 : 1;
  return spennDager(a) - spennDager(b);
}

export function løsOppmote(
  dato: string,
  prosjektId: string | null,
  perioder: readonly OppmotePeriodeInput[],
  gpsStartKontorId: string | null,
): OppmoteResultat {
  // 1. Byggeplass-periode på dagens prosjekt.
  if (prosjektId) {
    const bp = perioder.find(
      (p) => p.type === "byggeplass" && p.projectId === prosjektId && dekker(p, dato),
    );
    if (bp) return { kilde: "byggeplass", projectId: prosjektId };
  }

  // 2. GPS-start på et kontor.
  if (gpsStartKontorId) return { kilde: "gps", oppmotestedId: gpsStartKontorId };

  const kontor = perioder.filter(
    (p): p is OppmotePeriodeInput & { oppmotestedId: string } =>
      p.type === "kontor" && p.oppmotestedId != null && dekker(p, dato),
  );

  // 3. Midlertidig kontor-periode som gjelder på datoen.
  const midlertidig = kontor.filter((p) => !p.fast).sort(mestSpesifikk)[0];
  if (midlertidig) return { kilde: "midlertidig", oppmotestedId: midlertidig.oppmotestedId };

  // 4. Fast kontor som gjelder på datoen (åpent eller lukket historikk).
  const fast = kontor.filter((p) => p.fast).sort(mestSpesifikk)[0];
  if (fast) return { kilde: "fast", oppmotestedId: fast.oppmotestedId };

  // 5. Ikke valgt.
  return { kilde: "ikkeValgt" };
}

/** Den ansattes gjeldende faste oppmøtested (fast uten tilDato), uansett dato. */
export function finnFastOppmotested(perioder: readonly OppmotePeriodeInput[]): string | null {
  return perioder.find((p) => p.fast && p.tilDato == null)?.oppmotestedId ?? null;
}

/**
 * Skal den ansatte få spørsmålet «Hvor møter du vanligvis?» ved første
 * timeregistrering? Bare når firmaet har ≥ 2 aktive kontorer og den ansatte
 * aldri har hatt et fast sted (ett sted settes automatisk av serveren,
 * null steder → ingenting).
 */
export function trengerOppmoteValg(
  antallAktiveKontorer: number,
  perioder: readonly OppmotePeriodeInput[],
): boolean {
  return antallAktiveKontorer >= 2 && !perioder.some((p) => p.fast);
}

function overlapper(a: OppmotePeriodeInput, b: OppmotePeriodeInput): boolean {
  const aSlutt = a.tilDato ?? "9999-12-31";
  const bSlutt = b.tilDato ?? "9999-12-31";
  return a.fraDato <= bSlutt && b.fraDato <= aSlutt;
}

/**
 * Overlapp-regelen for en ny/endret periode mot den ansattes øvrige perioder.
 * Serverlaget avviser på treff; web viser samme regel før lagring.
 *
 *  - Midlertidig kontor: kan ikke overlappe et annet midlertidig kontor.
 *  - Byggeplass: kan ikke overlappe en byggeplass-periode på SAMME prosjekt.
 *  - Fast: det åpne faste stedet lukkes (tilDato = ny fraDato − 1), så ny
 *    fraDato må være etter dets fraDato; lukket fast-historikk skrives ikke om.
 *
 * Returnerer første kolliderende periode, eller null.
 */
export function finnPeriodeKonflikt<T extends OppmotePeriodeInput>(
  ny: OppmotePeriodeInput,
  ovrige: readonly T[],
): T | null {
  for (const p of ovrige) {
    if (ny.type === "byggeplass") {
      if (p.type === "byggeplass" && p.projectId === ny.projectId && overlapper(ny, p)) return p;
    } else if (!ny.fast) {
      if (p.type === "kontor" && !p.fast && overlapper(ny, p)) return p;
    } else if (p.fast) {
      if (p.tilDato == null ? ny.fraDato <= p.fraDato : ny.fraDato <= p.tilDato) return p;
    }
  }
  return null;
}

// ============================================================================
//  Overføring (POST 2026-11-15 (12) TILLEGG 6b, (13) L2)
//
//  Første dag i en midlertidig kontor-periode (med tilDato) eller en
//  byggeplass-periode: «ut» fra stedet den ansatte ellers ville møtt på
//  (resolveren UTEN denne perioden) til periodens mål. Siste dag (dato ===
//  tilDato): «retur» motsatt vei. Dagene imellom: ingen. Én-dags periode:
//  begge. Er utgangspunktet «ikke valgt» (eller samme kontor), finnes ingen
//  overføring. Overføringen blir aldri en automatisk rad — den er et forslag.
// ============================================================================

export type OverforingSted =
  | { type: "kontor"; oppmotestedId: string }
  | { type: "byggeplass"; projectId: string };

export interface Overforing {
  retning: "ut" | "retur";
  fra: OverforingSted;
  til: OverforingSted;
  periodeId: string | null;
}

export function finnOverforinger(
  dato: string,
  perioder: readonly OppmotePeriodeInput[],
): Overforing[] {
  const ut: Overforing[] = [];
  for (const p of perioder) {
    // Åpen midlertidig kontorperiode (tilDato null) finnes kun som overføring
    // (POST (13) del B) — den gir ingen «retur» før den er avsluttet.
    const erMidlertidigKontor = p.type === "kontor" && !p.fast && p.oppmotestedId != null;
    const erByggeplass = p.type === "byggeplass" && p.projectId != null;
    if (!erMidlertidigKontor && !erByggeplass) continue;
    // Del B: en overføringsperiode ble opprettet AV Tur-raden i reise-kortet —
    // «ut» er alt registrert og foreslås ikke på nytt.
    const forste = dato === p.fraDato && p.kilde !== "overforing";
    const siste = p.tilDato != null && dato === p.tilDato;
    if (!forste && !siste) continue;

    // Hjemsted = der den ansatte ville møtt uten denne perioden (ingen GPS,
    // ingen prosjekt — byggeplass-regelen gjelder kun dagens prosjekt).
    const uten = perioder.filter((q) => q !== p);
    const hjem = løsOppmote(dato, null, uten, null);
    if (hjem.kilde === "ikkeValgt" || hjem.kilde === "byggeplass") continue;
    const hjemSted: OverforingSted = { type: "kontor", oppmotestedId: hjem.oppmotestedId };
    const maal: OverforingSted = erByggeplass
      ? { type: "byggeplass", projectId: p.projectId! }
      : { type: "kontor", oppmotestedId: p.oppmotestedId! };
    if (maal.type === "kontor" && maal.oppmotestedId === hjem.oppmotestedId) continue;

    const periodeId = p.id ?? null;
    if (forste) ut.push({ retning: "ut", fra: hjemSted, til: maal, periodeId });
    if (siste) ut.push({ retning: "retur", fra: maal, til: hjemSted, periodeId });
  }
  return ut;
}

// ============================================================================
//  Kl. 12-regelen (POST 2026-11-15 (13) del B)
//
//  Overføring i reise-kortet setter et midlertidig oppmøtested. Hvilken dag
//  perioden starter/slutter, avgjøres av når reisen starter:
//   - Tur (start) før 12:00 → perioden starter SAMME dag; ellers DAGEN ETTER.
//   - Retur (slutt) før 12:00 → perioden slutter DAGEN FØR; ellers SAMME dag.
//  Havner slutten før starten, slettes perioden (serveren gjør det).
// ============================================================================

/** Legger `dager` til en YYYY-MM-DD (UTC-aritmetikk, ingen tidssone-drift). */
export function leggTilDager(dato: string, dager: number): string {
  const [a, m, d] = dato.slice(0, 10).split("-").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(a!, m! - 1, d! + dager)).toISOString().slice(0, 10);
}

/**
 * Periodedato for en overføring. `fraTid` = HH:MM reisen starter.
 * Manglende/ugyldig fraTid regnes som 00:00 (før 12).
 */
export function periodeDatoFraOverforing(
  dato: string,
  fraTid: string | null | undefined,
  retning: "tur" | "retur",
): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(fraTid ?? "");
  const minutter = m ? parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10) : 0;
  const forTolv = minutter < 12 * 60;
  if (retning === "tur") return forTolv ? dato.slice(0, 10) : leggTilDager(dato, 1);
  return forTolv ? leggTilDager(dato, -1) : dato.slice(0, 10);
}

// ── POST (13) del B: én regel for «overføring» — serveren (oppmotePeriode.
//    overforing) og mobilens optimistiske skriving bruker SAMME plan ────────

export type OverforingPeriode = OppmotePeriodeInput & { id: string };

export type OverforingPlan =
  /** Ingen endring (ingen åpen overføring å avslutte / allerede på kontoret). */
  | { utfall: "ingen"; periode: OverforingPeriode | null }
  /** En åpen admin-satt midlertidig periode finnes → serveren vinner. */
  | { utfall: "konflikt" }
  /** Åpen overføring lukkes på `til` (eller slettes når `til` < fraDato). */
  | { utfall: "lukket" | "slettet"; apen: OverforingPeriode; til: string }
  /** Ny åpen overføring; `apen` lukkes/slettes først når den finnes. */
  | {
      utfall: "opprettet";
      ny: OppmotePeriodeInput;
      apen: OverforingPeriode | null;
      lukkTil: string | null;
      slettApen: boolean;
    };

/** Åpen midlertidig kontorperiode satt via reise-kortet. */
export function erApenOverforing(p: OppmotePeriodeInput): boolean {
  return p.type === "kontor" && !p.fast && p.tilDato == null && p.kilde === "overforing";
}

/** O16 R1: midlertidig kontorperiode satt av arbeideren selv (reise-kortet), med eller uten sluttdato. */
export function erEgenOverforing(p: OppmotePeriodeInput): boolean {
  return p.type === "kontor" && !p.fast && p.kilde === "overforing";
}

/**
 * O16 R1: arbeiderens egen overføring som dekker `dato` eller ligger etter den (åpen eller med
 * sluttdato). Den som dekker datoen går foran; ellers den tidligste senere. Uten egne perioder med
 * sluttdato ≥ `dato` er svaret det samme som `perioder.find(erApenOverforing)` (maks én åpen).
 */
export function finnEgenOverforing<T extends OppmotePeriodeInput>(perioder: readonly T[], dato: string): T | null {
  const egne = perioder.filter((p) => erEgenOverforing(p) && (p.tilDato == null || p.tilDato >= dato));
  const dekker = egne.find((p) => p.fraDato <= dato);
  if (dekker) return dekker;
  return [...egne].sort((a, b) => (a.fraDato < b.fraDato ? -1 : a.fraDato > b.fraDato ? 1 : 0))[0] ?? null;
}

/**
 * Del B: hva en overføring gjør med brukerens perioder. Rører KUN egen
 * periode med kilde='overforing'; admin-perioder og fast sted er urørt.
 * Hvilken egen periode (O16 V1/V2): uten flagg (mobilen) den åpne, som før;
 * `medSluttdato` (web) den som dekker datoen eller ligger etter, åpen eller
 * med sluttdato (R1); `periodeId` (web, `slutt`) nettopp den perioden.
 *  - slutt: egen overføring lukkes på `dato` (slettes om `dato` < fraDato;
 *    ingen endring når den alt slutter på eller før `dato`).
 *  - start til eget faste kontor: egen overføring lukkes dagen før (hjemkomst).
 *  - start til samme kontor som allerede gjelder: ingen endring.
 *  - start når en admin-satt midlertidig periode er åpen: konflikt.
 *  - ellers: egen overføring lukkes dagen før (slettes om tom), ny opprettes
 *    (O16 S3: med `tilDato` når den er gitt). Ligger den egne helt etter den
 *    nye (ny `tilDato` før dens start), røres den ikke.
 */
export function planleggOverforing(
  perioder: readonly OverforingPeriode[],
  input: {
    handling: "start" | "slutt";
    oppmotestedId?: string | null;
    dato: string;
    /** O16 S3: «Til og med» (bare `start`). Utelatt = åpen periode. */
    tilDato?: string | null;
    /**
     * O16 V1: bare web sender den. Satt → egen periode med sluttdato kan velges (`finnEgenOverforing`).
     * Utelatt (mobilen) → nøyaktig gammel regel: kun egen ÅPNE overføring.
     */
    medSluttdato?: boolean;
    /** O16 V2: bare web, bare `slutt`: nettopp denne egne perioden lukkes/slettes (den boksen navngir). */
    periodeId?: string | null;
  },
): OverforingPlan {
  const apen =
    input.periodeId != null
      ? (perioder.find((p) => p.id === input.periodeId && erEgenOverforing(p)) ?? null)
      : input.medSluttdato
        ? finnEgenOverforing(perioder, input.dato)
        : (perioder.find(erApenOverforing) ?? null);
  const lukk = (til: string): OverforingPlan => {
    if (!apen) return { utfall: "ingen", periode: null };
    if (apen.tilDato != null && til >= apen.tilDato) return { utfall: "ingen", periode: apen };
    return { utfall: til < apen.fraDato ? "slettet" : "lukket", apen, til };
  };

  if (input.handling === "slutt") return lukk(input.dato);

  const maal = input.oppmotestedId ?? null;
  const fastPaaDato = perioder.find(
    (p) => p.fast && p.fraDato <= input.dato && (p.tilDato == null || input.dato <= p.tilDato),
  );
  if (maal != null && fastPaaDato?.oppmotestedId === maal) return lukk(leggTilDager(input.dato, -1));
  if (apen && apen.oppmotestedId === maal && apen.fraDato <= input.dato) return { utfall: "ingen", periode: apen };
  if (perioder.some((p) => p.type === "kontor" && !p.fast && p.tilDato == null && p.kilde !== "overforing")) {
    return { utfall: "konflikt" };
  }
  const nyTil = input.tilDato ?? null;
  // O16: en egen periode som ligger helt etter den nye, står urørt.
  const berort = apen && !(nyTil != null && nyTil < apen.fraDato) ? apen : null;
  const lukkTil = berort ? leggTilDager(input.dato, -1) : null;
  return {
    utfall: "opprettet",
    ny: {
      type: "kontor",
      fast: false,
      oppmotestedId: maal,
      projectId: null,
      fraDato: input.dato,
      tilDato: nyTil,
      kilde: "overforing",
    },
    apen: berort,
    lukkTil,
    slettApen: berort != null && lukkTil! < berort.fraDato,
  };
}

/**
 * O16 R3: perioden en «opprettet»-plan ville overlappe etter at den egne er lukket/slettet —
 * samme regel serveren avviser med (`finnPeriodeKonflikt`). null = ingen konflikt.
 */
export function overforingKonflikt<T extends OverforingPeriode>(
  perioder: readonly T[],
  plan: OverforingPlan,
): T | null {
  if (plan.utfall !== "opprettet") return null;
  const { apen, lukkTil, slettApen, ny } = plan;
  const ovrige = perioder.filter((p) => p.id !== apen?.id);
  const lukket = apen && !slettApen ? [{ ...(apen as T), tilDato: lukkTil }] : [];
  return finnPeriodeKonflikt(ny, [...ovrige, ...lukket]);
}

/** Del B: «Overføring til annet kontor» i reise-kortet — hva som tilbys. */
export interface KontorOverforingOppsett {
  /** Kontoret den ansatte møter på denne dagen (reisen starter her). */
  fraKontorId: string;
  /** Det faste kontoret på datoen — valg av det = hjemreise (slutt). */
  fastKontorId: string | null;
  /** De andre aktive kontorene, i samme rekkefølge som inn. */
  andre: string[];
}

/**
 * null = valget vises ikke: færre enn 2 aktive kontorer, byggeplass-periode
 * på prosjektet, eller oppmøtested ikke valgt.
 */
export function kontorOverforingOppsett(
  dato: string,
  projectId: string | null,
  perioder: readonly OppmotePeriodeInput[],
  aktiveKontorIder: readonly string[],
): KontorOverforingOppsett | null {
  if (aktiveKontorIder.length < 2) return null;
  const o = løsOppmote(dato, projectId, perioder, null);
  if (o.kilde === "byggeplass" || o.kilde === "ikkeValgt") return null;
  const fastKontorId = perioder.find((p) => p.fast && dekker(p, dato))?.oppmotestedId ?? null;
  return {
    fraKontorId: o.oppmotestedId,
    fastKontorId,
    andre: aktiveKontorIder.filter((id) => id !== o.oppmotestedId),
  };
}

/** Til eget fast kontor = retur (avslutter overføringen); ellers tur (starter ny). */
export function kontorOverforingRetning(oppsett: KontorOverforingOppsett, tilKontorId: string): "tur" | "retur" {
  return tilKontorId === oppsett.fastKontorId ? "retur" : "tur";
}

// ============================================================================
//  O16 (vedtak-timer-web.md § Reisevinduet pkt 1–2): oppmøtestedet som ett felt
//  i web-reisevinduet, og den blå boksen («Gjelder fra», «Til og med», «Siste dag»).
//  Programmet foreslår datoene, arbeideren retter. Mobil bruker ikke dette.
// ============================================================================

/** O16 pkt 1: den midlertidige kontorperioden som gjelder på datoen (samme valg som `løsOppmote` trinn 3). */
export function gjeldendeMidlertidig<T extends OppmotePeriodeInput>(dato: string, perioder: readonly T[]): T | null {
  return (
    perioder
      .filter((p) => p.type === "kontor" && !p.fast && p.oppmotestedId != null && dekker(p, dato))
      .sort(mestSpesifikk)[0] ?? null
  );
}

export type OppmoteByttValg = "tur" | "retur" | "kontor";

/** O16 pkt 2: «Gjelder fra» — sedelens dato ved «Til byggeplass», dagen etter ved «Fra byggeplass»,
 *  kl. 12-regelen ved «Til annet oppmøtested». */
export function gjelderFraForslag(valg: OppmoteByttValg, dato: string, startTid: string | null): string {
  if (valg === "tur") return dato.slice(0, 10);
  if (valg === "retur") return leggTilDager(dato, 1);
  return periodeDatoFraOverforing(dato, startTid, "tur");
}

/** O16 pkt 2: «Siste dag» — sedelens dato ved «Fra byggeplass», dagen før ved «Til byggeplass».
 *  R7a (Kenneth «ja»): «Til annet oppmøtested» → fast kontor følger kl. 12-regelen for retur-turen
 *  (`periodeDatoFraOverforing`): start før 12 → dagen før, ellers sedelens dato. */
export function sisteDagForslag(valg: OppmoteByttValg, dato: string, startTid: string | null): string {
  if (valg === "retur") return dato.slice(0, 10);
  if (valg === "tur") return leggTilDager(dato, -1);
  return periodeDatoFraOverforing(dato, startTid, "retur");
}

/** R7b (Kenneth «ja»): «Avslutt» spør om «Siste dag» — forslaget er dagen før sedelens dato. */
export function avsluttSisteDagForslag(dato: string): string {
  return leggTilDager(dato, -1);
}

export type OppmoteByttKall =
  | { handling: "start"; oppmotestedId: string; dato: string; tilDato?: string; medSluttdato: true }
  | { handling: "slutt"; dato: string; periodeId: string };

export type OppmoteBytte =
  /** Dagens oppmøtested er valgt — ingen periode skrives. */
  | { type: "ingen" }
  /** Et annet kontor blir midlertidig oppmøtested. */
  | {
      type: "start";
      kontorId: string;
      gjelderFra: string;
      tilOgMed: string | null;
      kall: OppmoteByttKall;
      plan: OverforingPlan;
      /** R3: perioden den nye ville overlappe (sperrer «Lagre»). */
      konflikt: OverforingPeriode | null;
      /** R4: egen periode som fjernes av bytte. */
      fjernes: OverforingPeriode | null;
      /** Egen periode som slutter dagen før den nye. */
      forkortes: { periode: OverforingPeriode; til: string } | null;
      ugyldig: "tilFoerFra" | null;
    }
  /** Det faste kontoret er valgt mens en egen midlertidig gjelder — den avsluttes. */
  | {
      type: "slutt";
      periode: OverforingPeriode;
      sisteDag: string;
      kall: OppmoteByttKall;
      fjernes: OverforingPeriode | null;
    }
  /** R8: det faste kontoret er valgt mens firmaadmins periode gjelder — avsluttes ikke her. */
  | { type: "admin"; periode: OverforingPeriode };

/**
 * O16: hva valget av kontor i reisevinduet gjør med oppmøtestedet. `valgtKontorId` = kontoret i
 * nedtrekket (null eller dagens = ingen bytte). Datoene er arbeiderens når de er gitt, ellers
 * forslaget. «Siste dag» går som `slutt` (R2: aldri `start` til fast kontor).
 */
export function planleggOppmoteBytte(a: {
  valg: OppmoteByttValg;
  dato: string;
  startTid: string | null;
  perioder: readonly OverforingPeriode[];
  dagensKontorId: string | null;
  fastKontorId: string | null;
  valgtKontorId: string | null;
  gjelderFra?: string | null;
  tilOgMed?: string | null;
  sisteDag?: string | null;
}): OppmoteBytte {
  const valgt = a.valgtKontorId;
  if (!valgt || valgt === a.dagensKontorId) return { type: "ingen" };
  const gjeldende = gjeldendeMidlertidig(a.dato, a.perioder);

  if (valgt === a.fastKontorId && gjeldende) {
    if (!erEgenOverforing(gjeldende)) return { type: "admin", periode: gjeldende };
    const sisteDag = a.sisteDag ?? sisteDagForslag(a.valg, a.dato, a.startTid);
    // V2: kallet og «… fjernes» gjelder nettopp perioden boksen navngir.
    const kall: OppmoteByttKall = { handling: "slutt", dato: sisteDag, periodeId: gjeldende.id };
    const plan = planleggOverforing(a.perioder, kall);
    return {
      type: "slutt",
      periode: gjeldende,
      sisteDag,
      kall,
      fjernes: plan.utfall === "slettet" ? plan.apen : null,
    };
  }

  const gjelderFra = a.gjelderFra ?? gjelderFraForslag(a.valg, a.dato, a.startTid);
  const tilOgMed = a.tilOgMed ?? null;
  const plan = planleggOverforing(a.perioder, {
    handling: "start",
    oppmotestedId: valgt,
    dato: gjelderFra,
    tilDato: tilOgMed,
    medSluttdato: true,
  });
  const konflikt =
    plan.utfall === "konflikt"
      ? (a.perioder.find((p) => p.type === "kontor" && !p.fast && p.tilDato == null && p.kilde !== "overforing") ?? null)
      : overforingKonflikt(a.perioder, plan);
  const fjernes =
    plan.utfall === "opprettet" && plan.slettApen ? plan.apen : plan.utfall === "slettet" ? plan.apen : null;
  const forkortes =
    plan.utfall === "opprettet" && plan.apen && !plan.slettApen && plan.lukkTil
      ? { periode: plan.apen, til: plan.lukkTil }
      : plan.utfall === "lukket"
        ? { periode: plan.apen, til: plan.til }
        : null;
  return {
    type: "start",
    kontorId: valgt,
    gjelderFra,
    tilOgMed,
    kall: {
      handling: "start",
      oppmotestedId: valgt,
      dato: gjelderFra,
      ...(tilOgMed ? { tilDato: tilOgMed } : {}),
      medSluttdato: true,
    },
    plan,
    konflikt,
    fjernes,
    forkortes,
    ugyldig: tilOgMed != null && tilOgMed < gjelderFra ? "tilFoerFra" : null,
  };
}

// ── POST (13) L2 commit 8: overføringsoppslag (flyttet fra mobilens dagsforslag.ts,
//    så web-reisekortet og mobil bruker SAMME funksjon) ──────────────────────

/**
 * POST (13) L2 TILLEGG: én overføring slik lese-fasen har slått den opp.
 * `oppmotestedId` = kontor-enden (fra-kontoret når begge ender er kontor);
 * `byggeplassId` = byggeplass-enden (null når kontor↔kontor eller ikke valgt).
 * `celle` = kjøretid/avstand fra kontor-avstanden eller matrisen; null = mangler.
 */
export type DagsforslagOverforingOppslag = {
  dato: string;
  overforing: Overforing;
  oppmotestedId: string;
  byggeplassId: string | null;
  fraNavn: string;
  tilNavn: string;
  celle: DagsforslagOverforingCelle | null;
};

export type DagsforslagOverforingCelle = { kjoretidMin: number; avstandM: number | null };

/**
 * POST (13) L2 TILLEGG — REN: overføringene (første/siste dag i en periode)
 * for datoene, med kjøretid og navn slått opp via de innsendte oppslagene.
 *
 * Byggeplass-enden velges: destinasjonen (når den hører til periodens
 * prosjekt) → kontekst-byggeplassen (samme vilkår) → prosjektets eneste
 * byggeplass → null («velg byggeplass» i skjermen; da mangler cellen).
 * `oppmotestedId` = kontor-enden (fra-kontoret når begge ender er kontor).
 */
export function byggOverforingOppslag(a: {
  datoer: string[];
  perioder: readonly OppmotePeriodeInput[];
  destinasjonByggeplassId: string | null;
  kontekstByggeplassId: string | null;
  byggeplasserForProsjekt: (projectId: string) => Array<{ id: string; navn: string | null }>;
  kontorNavn: (oppmotestedId: string) => string;
  prosjektNavn: (projectId: string) => string;
  kontorAvstand: (a: string, b: string) => DagsforslagOverforingCelle | null;
  matrise: (oppmotestedId: string, byggeplassId: string) => DagsforslagOverforingCelle | null;
}): DagsforslagOverforingOppslag[] {
  const ut: DagsforslagOverforingOppslag[] = [];
  for (const dato of a.datoer) {
    for (const o of finnOverforinger(dato, a.perioder)) {
      const kontor = o.fra.type === "kontor" ? o.fra : o.til.type === "kontor" ? o.til : null;
      if (kontor == null) continue; // byggeplass↔byggeplass finnes ikke (finnOverforinger)
      const bp = o.fra.type === "byggeplass" ? o.fra : o.til.type === "byggeplass" ? o.til : null;
      let byggeplassId: string | null = null;
      let bpNavn: string | null = null;
      if (bp) {
        const kandidater = a.byggeplasserForProsjekt(bp.projectId);
        const valgt =
          kandidater.find((b) => b.id === a.destinasjonByggeplassId) ??
          kandidater.find((b) => b.id === a.kontekstByggeplassId) ??
          (kandidater.length === 1 ? kandidater[0] : undefined);
        byggeplassId = valgt?.id ?? null;
        bpNavn = valgt?.navn ?? null;
      }
      const navn = (s: typeof o.fra) =>
        s.type === "kontor" ? a.kontorNavn(s.oppmotestedId) : (bpNavn ?? a.prosjektNavn(s.projectId));
      let celle: DagsforslagOverforingCelle | null = null;
      if (o.fra.type === "kontor" && o.til.type === "kontor") {
        celle = a.kontorAvstand(o.fra.oppmotestedId, o.til.oppmotestedId);
      } else if (byggeplassId) {
        celle = a.matrise(kontor.oppmotestedId, byggeplassId);
      }
      ut.push({
        dato,
        overforing: o,
        oppmotestedId: kontor.oppmotestedId,
        byggeplassId,
        fraNavn: navn(o.fra),
        tilNavn: navn(o.til),
        celle,
      });
    }
  }
  return ut;
}
