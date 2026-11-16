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

/**
 * Del B: hva en overføring gjør med brukerens perioder. Rører KUN egen åpen
 * periode med kilde='overforing'; admin-perioder og fast sted er urørt.
 *  - slutt: åpen overføring lukkes på `dato` (slettes om `dato` < fraDato).
 *  - start til eget faste kontor: åpen overføring lukkes dagen før (hjemkomst).
 *  - start til samme kontor som allerede er åpent: ingen endring.
 *  - start når en admin-satt midlertidig periode er åpen: konflikt.
 *  - ellers: åpen overføring lukkes dagen før (slettes om tom), ny opprettes.
 */
export function planleggOverforing(
  perioder: readonly OverforingPeriode[],
  input: { handling: "start" | "slutt"; oppmotestedId?: string | null; dato: string },
): OverforingPlan {
  const apen = perioder.find(erApenOverforing) ?? null;
  const lukk = (til: string): OverforingPlan =>
    apen ? { utfall: til < apen.fraDato ? "slettet" : "lukket", apen, til } : { utfall: "ingen", periode: null };

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
  const lukkTil = apen ? leggTilDager(input.dato, -1) : null;
  return {
    utfall: "opprettet",
    ny: {
      type: "kontor",
      fast: false,
      oppmotestedId: maal,
      projectId: null,
      fraDato: input.dato,
      tilDato: null,
      kilde: "overforing",
    },
    apen,
    lukkTil,
    slettApen: apen != null && lukkTil! < apen.fraDato,
  };
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
