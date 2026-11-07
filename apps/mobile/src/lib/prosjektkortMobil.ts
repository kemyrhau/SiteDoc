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
import { slaaSammenVarelinjer } from "@sitedoc/shared";
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

export type SendKnappTekst =
  | { nokkel: "timer.detalj.sendPaaNytt" }
  | { nokkel: "timer.prosjektkort.sendDagen"; timer: number };

/** Returnert sedel: samme tekst som dagskortets «Send på nytt» (web-paritet). */
export function sendKnappTekst(status: string, dagSum: number): SendKnappTekst {
  return status === "returned"
    ? { nokkel: "timer.detalj.sendPaaNytt" }
    : { nokkel: "timer.prosjektkort.sendDagen", timer: dagSum };
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
export type KortValg = {
  projectId: string;
  byggeplassId: string | null;
  ecoId: string | null;
};
export type KortNokkel = string;

const INGEN = "ingen";

export function kortNokkel(k: KortValg): KortNokkel {
  return `${k.projectId}|${k.byggeplassId ?? INGEN}|${k.ecoId ?? INGEN}`;
}

export function fraKortNokkel(nokkel: KortNokkel): KortValg {
  const [projectId = "", bp, up] = nokkel.split("|");
  return {
    projectId,
    byggeplassId: !bp || bp === INGEN ? null : bp,
    ecoId: !up || up === INGEN ? null : up,
  };
}

/** Rute-parameter ↔ verdi: `ingen`/manglende → null. */
export function fraRuteParam(verdi: string | string[] | undefined): string | null | undefined {
  if (verdi === undefined) return undefined;
  const v = Array.isArray(verdi) ? verdi[0] : verdi;
  return !v || v === INGEN ? null : v;
}

export function tilRuteParam(verdi: string | null): string {
  return verdi ?? INGEN;
}

export type SedelKortKontekst = {
  projectId: string;
  /** Sedelens byggeplass med prosjekt — arv gjelder bare innen samme prosjekt. */
  byggeplass: { id: string; projectId: string } | null;
};

/** Effektiv byggeplass: radens egen, ellers sedelens når den hører til prosjektet. */
export function effektivByggeplass(
  projectId: string,
  byggeplassId: string | null | undefined,
  sedel: SedelKortKontekst,
): string | null {
  if (byggeplassId) return byggeplassId;
  return sedel.byggeplass && sedel.byggeplass.projectId === projectId ? sedel.byggeplass.id : null;
}

export type KortRad = {
  projectId: string | null;
  byggeplassId?: string | null;
  externalCostObjectId?: string | null;
};

export function kortValgFor(rad: KortRad, sedel: SedelKortKontekst): KortValg {
  const projectId = rad.projectId ?? sedel.projectId;
  return {
    projectId,
    byggeplassId: effektivByggeplass(projectId, rad.byggeplassId, sedel),
    ecoId: rad.externalCostObjectId ?? null,
  };
}

export function kortNokkelFor(rad: KortRad, sedel: SedelKortKontekst): KortNokkel {
  return kortNokkel(kortValgFor(rad, sedel));
}

export function radHorerTilKort(rad: KortRad, sedel: SedelKortKontekst, kort: KortValg): boolean {
  return kortNokkelFor(rad, sedel) === kortNokkel(kort);
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
 * Tillegg/utlegg/reise ligger i dag-seksjonen og lager ikke kort.
 */
export function kortNokler(
  sedel: SedelKortKontekst,
  grupper: readonly (readonly KortRad[])[],
  ekstra: readonly KortValg[],
  sortering: KortSortering,
): KortValg[] {
  const valg = new Map<KortNokkel, KortValg>();
  const prosjektRekkefolge: string[] = [];
  const legg = (k: KortValg) => {
    if (!prosjektRekkefolge.includes(k.projectId)) prosjektRekkefolge.push(k.projectId);
    valg.set(kortNokkel(k), k);
  };
  for (const rader of grupper) for (const r of rader) legg(kortValgFor(r, sedel));
  for (const k of ekstra) legg(k);

  const bpNavn = (id: string | null) => (id === null ? null : sortering.byggeplassNavn(id));
  const ecoNavn = (id: string | null) => (id === null ? null : sortering.ecoNokkel(id));
  const sammenlign = (a: string | null, b: string | null, ingenSist: boolean) => {
    if (a === b) return 0;
    if (a === null) return ingenSist ? 1 : -1;
    if (b === null) return ingenSist ? -1 : 1;
    return a.localeCompare(b, "nb", { numeric: true });
  };
  return Array.from(valg.values()).sort(
    (a, b) =>
      prosjektRekkefolge.indexOf(a.projectId) - prosjektRekkefolge.indexOf(b.projectId) ||
      sammenlign(bpNavn(a.byggeplassId), bpNavn(b.byggeplassId), true) ||
      sammenlign(ecoNavn(a.ecoId), ecoNavn(b.ecoId), false),
  );
}

/** Rute uten `bp`/`up`: prosjektets første kort (eller et tomt kort på prosjektet). */
export function forsteKortFor(
  projectId: string,
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
): R[] {
  const n = kortNokkel(kort);
  return rader.filter((r) => kortNokkelFor(r, sedel) === n);
}
