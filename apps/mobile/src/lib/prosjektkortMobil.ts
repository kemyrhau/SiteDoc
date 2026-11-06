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

/** Maskinrader har ingen egen byggeplass lokalt → arver dagens. */
export function tilKortMaskinRader(
  rader: readonly LokalMaskinRad[],
  sedelProjectId: string,
): KortMaskinRad[] {
  return rader.map((r) => ({
    projectId: r.projectId ?? sedelProjectId,
    byggeplassId: null,
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
