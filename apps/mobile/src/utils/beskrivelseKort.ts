import { kortNokkel } from "../lib/prosjektkortMobil";
import type { Dagsforslag, DagsforslagDag } from "./dagsforslag";
import { radTilleggNokkel } from "./bekreftDagTillegg";

/**
 * ORDRE 36b (revidert plan § 5): «Hva gjorde du i dag?» pr. KORT
 * (prosjekt + effektiv byggeplass; underprosjekt inngår ikke i nøkkelen).
 *
 * RETUR (24), Kenneth 2026-11-16: «Et prosjektkort inneholder aldri to
 * datoer» — datoen inngår i kortets identitet. Nattevakt 21–06 på samme
 * prosjekt = to kort (21–24 og 00–06), hvert med egen beskrivelse og eget
 * sett maskin/varer.
 *
 * Nøkkelen i `beskrivelsePerKort` er grunnøkkelen på FORSLAGETS STARTDATO
 * og `${dato}|${grunnøkkel}` på alle senere datoer — også når startdatoens
 * kort mangler (0 t eller blokkert sedel; RETUR 2 (24)). Grunnøkkelen er:
 *  - `projectId` når prosjektet har ETT kort-sted (byggeplass) i forslaget —
 *    identisk med 36a, så teksten overlever bytte av dagens byggeplass;
 *  - `kortNokkel(...)` når prosjektet har flere byggeplasser.
 * Slik havner et utkast lagret før RETUR (24) (nøkkel uten dato) bare på
 * startdatoens kort, og kortet etter midnatt starter tomt.
 *
 * Effektiv byggeplass = radens egen `byggeplassId ?? sedelens` (arbeidsrader
 * har normalt null = arver dagens).
 */

export type BeskrivelseKort = {
  /** Nøkkelen teksten står under i `beskrivelsePerKort`. */
  nokkel: string;
  projectId: string;
  byggeplassId: string | null;
  /** Kortets dato — én dagsseddel (§ Midnatt-splitt). */
  dato: string;
  /** Prosjektet har flere byggeplass-kort i forslaget → etiketten trenger byggeplassnavn. */
  delerProsjekt: boolean;
  /** Prosjektet har kort på flere datoer (nattevakt) → etiketten trenger dato. */
  visDato: boolean;
};

type RadKortGrunnlag = { projectId: string; byggeplassId: string | null };
type DatoGrunnlag = Pick<DagsforslagDag, "byggeplassId" | "dato">;

function radKortNokkel(rad: RadKortGrunnlag, d: Pick<DagsforslagDag, "byggeplassId">): string {
  return kortNokkel({
    projectId: rad.projectId,
    byggeplassId: rad.byggeplassId ?? d.byggeplassId ?? null,
    ecoId: null,
  });
}

/** Kortets identitet: dato + prosjekt + effektiv byggeplass. */
function radKortId(rad: RadKortGrunnlag, d: DatoGrunnlag): string {
  return `${d.dato}|${radKortNokkel(rad, d)}`;
}

function kortId(k: BeskrivelseKort): string {
  return `${k.dato}|${kortNokkel({ projectId: k.projectId, byggeplassId: k.byggeplassId, ecoId: null })}`;
}

/** Forslagets startdato: start-segmentets dato, ellers første dato. Blokkert eller ei. */
function forslagStartDato(forslag: Dagsforslag): string | null {
  return (forslag.datoer.find((d) => d.erStartSegment) ?? forslag.datoer[0])?.dato ?? null;
}

/** Kortene med arbeid (ikke reise) på åpne datoer, i forslagets rekkefølge — ett pr. dato. */
export function kortMedArbeid(forslag: Dagsforslag): BeskrivelseKort[] {
  const kort: { id: string; sted: string; dato: string; projectId: string; byggeplassId: string | null }[] = [];
  for (const d of forslag.datoer) {
    if (d.blokkert) continue;
    for (const r of d.rader) {
      if (r.erReise || !(r.timer > 0)) continue;
      const id = radKortId(r, d);
      if (kort.some((x) => x.id === id)) continue;
      kort.push({
        id,
        sted: radKortNokkel(r, d),
        dato: d.dato,
        projectId: r.projectId,
        byggeplassId: r.byggeplassId ?? d.byggeplassId ?? null,
      });
    }
  }
  const startDato = forslagStartDato(forslag);
  return kort.map((k) => {
    const egne = kort.filter((x) => x.projectId === k.projectId);
    const delerProsjekt = new Set(egne.map((x) => x.sted)).size > 1;
    const visDato = new Set(egne.map((x) => x.dato)).size > 1;
    const grunn = delerProsjekt ? k.sted : k.projectId;
    // RETUR 2 (24): grunnøkkelen uten dato tilhører KUN startdatoens kort —
    // også når det kortet mangler (0 t / blokkert). Ellers arvet kortet
    // 00–06 teksten fra 21–24 og arbeiderens egen tekst lå skjult.
    const nokkel = k.dato === startDato ? grunn : `${k.dato}|${grunn}`;
    return { nokkel, projectId: k.projectId, byggeplassId: k.byggeplassId, dato: k.dato, delerProsjekt, visDato };
  });
}

/**
 * Arbeidsrad på et kort. Kenneth 2026-11-16 (ORDRE 24): kortet har ÉN
 * beskrivelse og ETT sett maskin/varer — radene bærer ingen egen tekst.
 */
export type BeskrivelseRad = {
  /** Kortet raden hører til (nøkkel i `beskrivelsePerKort`). */
  kortNokkel: string;
  fraTid: string | null;
  tilTid: string | null;
  /** PRESISERING TILLEGG: nøkkelen maskin/vare på raden holdes under (`radTilleggNokkel`). */
  tilleggNokkel: string | null;
  dato: string;
  timer: number;
  /** Radens effektive byggeplass (raden, ellers datoens) — forhåndsvalg for varer. */
  byggeplassId: string | null;
};

/** Arbeidsradene (timer > 0) pr. kort på åpne datoer, i forslagets rekkefølge. */
export function arbeidsraderPerKort(forslag: Dagsforslag): Map<string, BeskrivelseRad[]> {
  const kort = kortMedArbeid(forslag);
  const ut = new Map<string, BeskrivelseRad[]>(kort.map((k) => [k.nokkel, []]));
  for (const d of forslag.datoer) {
    if (d.blokkert) continue;
    for (const r of d.rader) {
      if (r.erReise || !(r.timer > 0)) continue;
      const id = radKortId(r, d);
      const kn = kort.find((x) => kortId(x) === id)?.nokkel ?? r.projectId;
      ut.get(kn)?.push({
        kortNokkel: kn,
        fraTid: r.fraTid,
        tilTid: r.tilTid,
        tilleggNokkel: radTilleggNokkel(d.dato, r),
        dato: d.dato,
        timer: r.timer,
        byggeplassId: r.byggeplassId ?? d.byggeplassId,
      });
    }
  }
  return ut;
}

/**
 * Teksten (trimmet, null = tom) en arbeidsrad på dato `d` skal få: kortets
 * tekst — på alle kortets arbeidsrader, også overtidsraden (Kenneth
 * 2026-11-16: «hvert prosjektkort skal ha sin egen beskrivelse»). Et gammelt
 * utkast med `beskrivelsePerRad` (radform 2026-11-12) leses ikke. Kortet
 * er dato-bundet (RETUR 24): raden får teksten til kortet på sin egen dato.
 */
export function beskrivelseForRad(
  forslag: Dagsforslag,
  rad: RadKortGrunnlag,
  d: DatoGrunnlag,
): string | null {
  const b = forslag.beskrivelsePerKort;
  if (!b) return null;
  const id = radKortId(rad, d);
  const kort = kortMedArbeid(forslag).find((x) => kortId(x) === id);
  const nokkel = kort?.nokkel ?? rad.projectId;
  return b[nokkel]?.trim() || null;
}

function kortNokkelFraKort(k: BeskrivelseKort): string {
  return kortNokkel({ projectId: k.projectId, byggeplassId: k.byggeplassId, ecoId: null });
}

/**
 * Kortet med flest arbeidstimer (spec tillegg-utlegg-prosjektkort § 5, B6):
 * standardkort for en ny tillegg-/utleggslinje i Bekreft dag. Med `projectId`
 * velges blant det prosjektets kort. Lik sum → første kort. Ingen arbeid → null.
 * Summen er pr. kort-sted (prosjekt + byggeplass) over alle datoene, og et
 * sted med kort på flere datoer gir første datos kort — tillegg/utlegg har
 * ingen dato, så valget er uendret av RETUR (24).
 */
export function kortMedFlestTimer(forslag: Dagsforslag, projectId?: string): BeskrivelseKort | null {
  const sum = new Map<string, number>();
  for (const d of forslag.datoer) {
    if (d.blokkert) continue;
    for (const r of d.rader) {
      if (r.erReise || !(r.timer > 0)) continue;
      const k = radKortNokkel(r, d);
      sum.set(k, (sum.get(k) ?? 0) + r.timer);
    }
  }
  let best: BeskrivelseKort | null = null;
  let bestTimer = 0;
  for (const k of kortMedArbeid(forslag)) {
    if (projectId && k.projectId !== projectId) continue;
    const t = sum.get(kortNokkelFraKort(k)) ?? 0;
    if (!best || t > bestTimer) {
      best = k;
      bestTimer = t;
    }
  }
  return best;
}
