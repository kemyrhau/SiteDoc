/**
 * Prosjektkort L2 (mobil): oversetter lokale SQLite-rader til de delte
 * kort-typene i `@sitedoc/shared` (prosjektkort.ts), slik at samlesiden på
 * mobil regner nøyaktig som web. Rene funksjoner — testes uten RN.
 *
 * Lokale rader har nullable `projectId` (eldre rader før T7-3b2) → sedelens
 * prosjekt. Lokale rader har ikke `attestertStatus`; erstattede rader finnes
 * kun på server (attestørens korreksjon), så lokalt er alt «gjeldende».
 */
import type {
  KortMaskinRad,
  KortTimerRad,
  KortVareLinje,
} from "@sitedoc/shared";
import { slaaSammenVarelinjer, sendDagenTekst, type SendDagenTekst } from "@sitedoc/shared";
import { erReiseRadVisning } from "../utils/reiseRad";

type LokalTimerRad = {
  projectId: string | null;
  byggeplassId: string | null;
  lonnsartId: string;
  timer: number;
  erReise?: boolean | null;
  pauseMin?: number | null;
};

type LokalMaskinRad = {
  projectId: string | null;
  byggeplassId?: string | null;
  timer: number | null;
};

export function tilKortTimerRader(
  rader: readonly LokalTimerRad[],
  sedelProjectId: string,
  reiseLonnsartId: string | null,
): (KortTimerRad & { pauseMin: number })[] {
  return rader.map((r) => ({
    projectId: r.projectId ?? sedelProjectId,
    byggeplassId: r.byggeplassId,
    timer: r.timer,
    erReise: erReiseRadVisning(r.erReise ?? null, r.lonnsartId, reiseLonnsartId),
    attestertStatus: null,
    pauseMin: r.pauseMin ?? 0,
  }));
}

/** ORDRE 36b: maskinraden bærer egen byggeplass (null = arver dagens). */
export function tilKortMaskinRader(
  rader: readonly LokalMaskinRad[],
  sedelProjectId: string,
): KortMaskinRad[] {
  return rader.map((r) => ({
    projectId: r.projectId ?? sedelProjectId,
    byggeplassId: r.byggeplassId ?? null,
    timer: r.timer ?? 0,
    attestertStatus: null,
  }));
}

/**
 * Kortrekkefølge som web: første forekomst over timer → maskin → tillegg →
 * utlegg, deretter bruker-tilføyde (tomme) kort. Sedelens eget prosjekt får
 * IKKE et kort uten rader (modell A: tomt kort forsvinner).
 */
export function kortProsjektIder(
  sedelProjectId: string,
  grupper: readonly (readonly { projectId: string | null }[])[],
  ekstra: readonly string[],
): string[] {
  const ider = new Set<string>();
  for (const rader of grupper) {
    for (const r of rader) ider.add(r.projectId ?? sedelProjectId);
  }
  for (const id of ekstra) ider.add(id);
  return Array.from(ider);
}

/** Kortet som bærer dagens pause (V20/PK1): første timer-rad med pause > 0. */
export function pauseBaererProsjekt(
  rader: readonly (KortTimerRad & { pauseMin: number })[],
): string | null {
  return (
    rader.find((r) => r.attestertStatus !== "erstattet" && r.pauseMin > 0)
      ?.projectId ?? null
  );
}

export type SendKnappTekst = SendDagenTekst;

/**
 * Ordre (6): «Send dagen (7,5 t · reise 2 t)» / «Send dagen (7,5 t)» — delegerer
 * til den delte formatteren (`sendDagenTekst`, samme som web). `arbeid` er uten
 * reise. Returnert sedel: «Send på nytt» (web-paritet).
 */
export function sendKnappTekst(status: string, arbeid: number, reise = 0): SendKnappTekst {
  return sendDagenTekst(status, arbeid, reise);
}

/** Vareforbruk fra server → delt linjetype (bare lesing på mobil). */
export function tilKortVarer<
  V extends { projectId: string; antall: unknown; vare: { enhet: string } },
>(varer: readonly V[]): (V & KortVareLinje)[] {
  return varer.map((v) => ({ ...v, antall: Number(v.antall) || 0 }));
}

/**
 * K20: ett prosjekts varelinjer for lesevisning — server + lokale, synket lokal
 * linje (samme id) telles én gang (`slaaSammenVarelinjer`).
 */
export function varerForProsjekt<V extends { id: string; projectId: string }>(
  server: readonly V[],
  lokale: readonly V[],
  projectId: string,
): V[] {
  return slaaSammenVarelinjer(
    server.filter((v) => v.projectId === projectId),
    lokale.filter((v) => v.projectId === projectId),
  );
}

/**
 * Linjene som telles i kortets Varer-sum: kortets prosjekt, uten lokale linjer
 * serveren har avvist (16d). Avviste linjer vises fortsatt i lista med
 * feilmelding — de er bare ikke ført.
 */
export function telteKortVarer<V extends { projectId: string; syncStatus?: string | null }>(
  varer: readonly V[],
  projectId: string,
): V[] {
  return varer.filter((v) => v.projectId === projectId && v.syncStatus !== "avvist");
}

/** Timetall som web-samlesiden (nb-NO, 1–2 desimaler): 5 → «5,0», 2.25 → «2,25». */
export function formatKortTall(n: number): string {
  const rundet = Math.round(n * 100) / 100;
  const tekst = Number.isInteger(rundet) ? rundet.toFixed(1) : String(rundet);
  return tekst.replace(".", ",");
}

/**
 * Prosjektkort L2: hva rad-modalen viser pr. modus. Kortskjermen låser
 * prosjektet (raden hører til kortet) og kaller arv-kilden «dagen»; dagskortet
 * er uendret (ikke låst, «dagskortet»).
 */
export function kortModusVisning(kortModus: boolean) {
  return kortModus
    ? {
        prosjektLaast: true,
        arvesFra: "timer.byggeplass.arvesFraDagen",
        fra: "timer.byggeplass.fraDagen",
      }
    : {
        prosjektLaast: false,
        arvesFra: "timer.byggeplass.arvesFraDagskort",
        fra: "timer.byggeplass.fraDagskort",
      };
}

/**
 * ORDRE 18 (2026-11-06): hva rad-dialogen viser når raden arver byggeplass
 * (`byggeplassId = null`) — dagskortets faktiske byggeplass, ikke en
 * forklaring. Samme regel som radlista: arv gjelder bare når sedelens
 * byggeplass hører til radens prosjekt. `navn` null → «Ingen byggeplass».
 */
export function arvetByggeplassVisning(
  sedelByggeplass: { navn: string; projectId: string } | null,
  projectId: string | null,
  kortModus: boolean,
): { navn: string | null; nokkel: string } {
  if (!sedelByggeplass || sedelByggeplass.projectId !== projectId) {
    return { navn: null, nokkel: "timer.byggeplass.ingenValgt" };
  }
  return { navn: sedelByggeplass.navn, nokkel: kortModusVisning(kortModus).fra };
}

/**
 * ORDRE 36b: ett prosjektkort = (prosjekt, effektiv byggeplass, underprosjekt).
 * Nøkkelen er felles for kortlista, ruten (`?bp=&up=`), Bekreft dag
 * (`beskrivelsePerKort`) og «Flytt raden». `null` skrives «ingen».
 */
// Delt kilde i shared (kort-id-spec § 2.3); re-eksportert så ingen kaller endres.
export { fraKortNokkel, type KortNokkel } from "@sitedoc/shared";
import {
  radProsjektId,
  kortNokkel as utledetKortNokkel,
  type KortValg as UtledetKortValg,
  type KortNokkel,
} from "@sitedoc/shared";
export { utledetKortNokkel };

/**
 * Ordre c, T11 (prosjektkort-kortid-spec § 5.2): et kort med rader bærer
 * kort-id-en, og da er id-en nøkkelen — to kort med lik (prosjekt, byggeplass,
 * underprosjekt) er to kort. Kort uten id (tomt kort fra ruten, fraværskortet)
 * nøkles som før (`utledetKortNokkel`). Prosjekt/byggeplass/underprosjekt står
 * fortsatt på valget; skjermene leser dem derfra.
 */
export type KortValg = UtledetKortValg & { kortId?: string | null };

const KORT_ID_PREFIKS = "kort:";

export function kortNokkel(k: KortValg): KortNokkel {
  return k.kortId ? `${KORT_ID_PREFIKS}${k.kortId}` : utledetKortNokkel(k);
}
export { radProsjektId };

const INGEN = "ingen";

/** Rute-parameter ↔ verdi: `ingen`/manglende → null. */
export function fraRuteParam(verdi: string | string[] | undefined): string | null | undefined {
  if (verdi === undefined) return undefined;
  const v = Array.isArray(verdi) ? verdi[0] : verdi;
  return !v || v === INGEN ? null : v;
}

export function tilRuteParam(verdi: string | null): string {
  return verdi ?? INGEN;
}

/**
 * Ordre c (T11, spec § 5.2): kortskjermens rute. `kort=<kortId>` adresserer
 * kortet når det har id; `bp`/`up` står fortsatt (tomt kort, gamle lenker, M19).
 */
export function kortRute(sheetId: string, k: KortValg): string {
  const id = k.kortId ? `&kort=${encodeURIComponent(k.kortId)}` : "";
  return `/timer/${sheetId}/kort/${k.projectId}?bp=${tilRuteParam(k.byggeplassId)}&up=${tilRuteParam(k.ecoId)}${id}`;
}

/**
 * Ordre c (T11): kortet kortskjermen viser. `kort=` med rader → det kortet;
 * ellers `bp`/`up` (mangler → prosjektets første rad), og finnes det kort med
 * id på den nøkkelen, det første av dem. `kort=` uten rader = et tomt kort med
 * den id-en (nye rader føres på den).
 */
export function kortForRute(args: {
  projectId: string;
  kortParam: string | null;
  bp: string | null | undefined;
  up: string | null;
  /** Timer + maskin (som før: første av dem gir kortet når `bp` mangler). */
  rader: readonly KortRad[];
  /** Tillegg + utlegg: bærer også kort-id. */
  ovrige?: readonly KortRad[];
  sedel: SedelKortKontekst;
}): KortValg {
  const { projectId, kortParam, bp, up, rader, sedel } = args;
  const iProsjektet = rader.filter((r) => radProsjektId(r, sedel) === projectId);
  const alle = [...iProsjektet, ...(args.ovrige ?? []).filter((r) => radProsjektId(r, sedel) === projectId)];
  if (kortParam) {
    const r = alle.find((x) => x.kortId === kortParam);
    if (r) return kortValgFor(r, sedel);
  }
  const forste = iProsjektet[0];
  const valg: KortValg =
    bp === undefined
      ? forste
        ? kortValgFor(forste, sedel)
        : { projectId, byggeplassId: effektivByggeplass(projectId, null, sedel), ecoId: null }
      : { projectId, byggeplassId: bp, ecoId: up };
  if (kortParam) return { ...valg, kortId: kortParam };
  if (valg.kortId) return valg;
  const id = utenIdTilKort(sedel, [alle]).get(utledetKortNokkel(valg));
  return id ? { ...valg, kortId: id } : valg;
}

export type SedelKortKontekst = {
  projectId: string;
  /** Sedelens byggeplass med prosjekt — arv gjelder bare innen samme prosjekt. */
  byggeplass: { id: string; projectId: string } | null;
};

/** Effektiv byggeplass: radens egen, ellers sedelens når den hører til prosjektet. */
export function effektivByggeplass(
  projectId: string | null,
  byggeplassId: string | null | undefined,
  sedel: SedelKortKontekst,
): string | null {
  if (projectId === null) return null; // fraværskortet har ingen byggeplass (K8)
  if (byggeplassId) return byggeplassId;
  return sedel.byggeplass && sedel.byggeplass.projectId === projectId ? sedel.byggeplass.id : null;
}

export type KortRad = {
  projectId: string | null;
  /** Fraværskortet (spec § 11.2): bevisst ført uten prosjekt. Bare timerrader. */
  utenProsjekt?: boolean | null;
  byggeplassId?: string | null;
  externalCostObjectId?: string | null;
  /** Ordre c (T11): radens kort. Mangler = utledes (varer fra serveren, gamle rader). */
  kortId?: string | null;
  /** Bare til sortering av kort med lik nøkkel (tidsrekkefølge). */
  fraTid?: string | null;
};

/** Et prosjektkort — alle kort unntatt fraværskortet (prosjekt `null`, spec § 11.2). */
export type ProsjektKortValg = KortValg & { projectId: string };

export function erProsjektKort(k: KortValg): k is ProsjektKortValg {
  return k.projectId !== null;
}

export function kortValgFor(rad: KortRad, sedel: SedelKortKontekst): KortValg {
  const projectId = radProsjektId(rad, sedel);
  const valg: KortValg = {
    projectId,
    byggeplassId: effektivByggeplass(projectId, rad.byggeplassId, sedel),
    ecoId: projectId === null ? null : (rad.externalCostObjectId ?? null),
  };
  // Fraværskortet er ett kort uansett id (spec § 11.2) — nøkles som før.
  if (projectId !== null && rad.kortId) valg.kortId = rad.kortId;
  return valg;
}

export function kortNokkelFor(rad: KortRad, sedel: SedelKortKontekst): KortNokkel {
  return kortNokkel(kortValgFor(rad, sedel));
}

/**
 * T11: rader uten kort-id (varer fra serveren, gamle rader) hører til det
 * FØRSTE kortet med samme utledede nøkkel — første kort-id sett i radenes
 * rekkefølge (timer → maskin → …). Én regel for kortlista og kortskjermen.
 */
export type UtenIdTilKort = ReadonlyMap<KortNokkel, string>;

export function utenIdTilKort(
  sedel: SedelKortKontekst,
  grupper: readonly (readonly KortRad[])[],
): UtenIdTilKort {
  const ut = new Map<KortNokkel, string>();
  const rader = grupper.flat().slice().sort((a, b) => sammenlignFraTid(a.fraTid, b.fraTid));
  for (const r of rader) {
    const v = kortValgFor(r, sedel);
    const n = utledetKortNokkel(v);
    if (v.kortId && !ut.has(n)) ut.set(n, v.kortId);
  }
  return ut;
}

function sammenlignFraTid(a: string | null | undefined, b: string | null | undefined): number {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : 1;
}

/**
 * T11: raden hører til kortet. Har begge kort-id: lik id. Ellers lik utledet
 * nøkkel — og en rad uten id bare til kortet `utenId` peker på (når gitt).
 */
export function radHorerTilKort(
  rad: KortRad,
  sedel: SedelKortKontekst,
  kort: KortValg,
  utenId?: UtenIdTilKort,
): boolean {
  const rv = kortValgFor(rad, sedel);
  if (rv.kortId && kort.kortId) return rv.kortId === kort.kortId;
  const n = utledetKortNokkel(rv);
  if (n !== utledetKortNokkel(kort)) return false;
  if (!rv.kortId && kort.kortId && utenId) {
    const forste = utenId.get(n);
    return forste === undefined || forste === kort.kortId;
  }
  return true;
}

/**
 * Det radLagring skriver på en ny rad på kortet: byggeplass `null` når kortets
 * byggeplass er den raden ellers arver (sedelens), ellers kortets egen.
 */
export function lagretByggeplassForKort(kort: KortValg, sedel: SedelKortKontekst): string | null {
  return kort.byggeplassId !== null &&
    kort.byggeplassId === effektivByggeplass(kort.projectId, null, sedel)
    ? null
    : kort.byggeplassId;
}

/**
 * RETUR 4: byggeplassen en VARELINJE på kortet lagres med — alltid kortets
 * effektive byggeplass. `vareforbruk` har ingen arv fra sedelen (web filtrerer
 * på `byggeplassId`), så `null` ville flyttet linja til «uten byggeplass».
 * Kontrast: timer/maskin bruker `lagretByggeplassForKort` (null = arv).
 */
export function vareByggeplassForKort(kort: KortValg): string | null {
  return kort.byggeplassId;
}

export type KortSortering = {
  /** Byggeplassnavn for sortering (ukjent → id). */
  byggeplassNavn: (id: string) => string;
  /** Underprosjektets sorteringsnøkkel (proAdmId). */
  ecoNokkel: (id: string) => string;
};

/**
 * Kortlista: prosjekter i første-forekomst-rekkefølge (timer → maskin →
 * varer, så bruker-tilføyde), innen prosjektet byggeplass etter navn med
 * «Uten» sist, deretter underprosjekt etter proAdmId med «Uten» først.
 * Reise ligger i dag-seksjonen og lager ikke kort; tillegg/utlegg gjør det
 * (spec tillegg-utlegg-prosjektkort § 3 — kalleren sender dem som grupper).
 */
export function kortNokler(
  sedel: SedelKortKontekst,
  grupper: readonly (readonly KortRad[])[],
  ekstra: readonly KortValg[],
  sortering: KortSortering,
): KortValg[] {
  const valg = new Map<KortNokkel, KortValg>();
  const forsteTid = new Map<KortNokkel, string>();
  const prosjektRekkefolge: (string | null)[] = [];
  const utenId = utenIdTilKort(sedel, grupper);
  const legg = (k: KortValg, fraTid?: string | null) => {
    if (!prosjektRekkefolge.includes(k.projectId)) prosjektRekkefolge.push(k.projectId);
    const n = kortNokkel(k);
    if (!valg.has(n)) valg.set(n, k);
    const f = forsteTid.get(n);
    if (fraTid && (!f || fraTid < f)) forsteTid.set(n, fraTid);
  };
  for (const rader of grupper)
    for (const r of rader) {
      const v = kortValgFor(r, sedel);
      // T11: rad uten id → første kort med samme utledede nøkkel.
      const id = v.kortId ? null : utenId.get(utledetKortNokkel(v));
      legg(id ? { ...v, kortId: id } : v, r.fraTid);
    }
  const utledede = new Set([...valg.values()].map(utledetKortNokkel));
  for (const k of ekstra) {
    // Et tomt kort uten id er det samme kortet som et med rader og lik nøkkel.
    if (!k.kortId && utledede.has(utledetKortNokkel(k))) continue;
    legg(k);
  }

  const bpNavn = (id: string | null) => (id === null ? null : sortering.byggeplassNavn(id));
  const ecoNavn = (id: string | null) => (id === null ? null : sortering.ecoNokkel(id));
  const sammenlign = (a: string | null, b: string | null, ingenSist: boolean) => {
    if (a === b) return 0;
    if (a === null) return ingenSist ? 1 : -1;
    if (b === null) return ingenSist ? -1 : 1;
    return a.localeCompare(b, "nb", { numeric: true });
  };
  // Fraværskortet (prosjekt `null`) står alltid sist (spec § 11.4).
  const plass = (pid: string | null) =>
    pid === null ? Number.MAX_SAFE_INTEGER : prosjektRekkefolge.indexOf(pid);
  return Array.from(valg.values()).sort(
    (a, b) =>
      plass(a.projectId) - plass(b.projectId) ||
      sammenlign(bpNavn(a.byggeplassId), bpNavn(b.byggeplassId), true) ||
      sammenlign(ecoNavn(a.ecoId), ecoNavn(b.ecoId), false) ||
      // T11: kort med lik nøkkel i tidsrekkefølge etter første linje.
      sammenlignFraTid(forsteTid.get(kortNokkel(a)), forsteTid.get(kortNokkel(b))),
  );
}

/** Rute uten `bp`/`up`: prosjektets første kort (eller et tomt kort på prosjektet). */
export function forsteKortFor(
  projectId: string | null,
  kort: readonly KortValg[],
  sedel: SedelKortKontekst,
): KortValg {
  return (
    kort.find((k) => k.projectId === projectId) ?? {
      projectId,
      byggeplassId: effektivByggeplass(projectId, null, sedel),
      ecoId: null,
    }
  );
}

/** Varer/maskin på kortet: full nøkkel (vare uten egen byggeplass arver dagens). */
export function raderPaaKort<R extends KortRad>(
  rader: readonly R[],
  sedel: SedelKortKontekst,
  kort: KortValg,
  utenId?: UtenIdTilKort,
): R[] {
  return rader.filter((r) => radHorerTilKort(r, sedel, kort, utenId));
}
