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
  /**
   * Kortet står på forslagets startdato (nøkkelen uten dato). ORDRE 25: en
   * tillegg-/utleggslinje uten dato (utkast fra før 25) hører hit.
   */
  paaStartDato: boolean;
  /**
   * Ordre c (spec § 5.1): kortets id (`tildelKortIder`). Utelatt når forslaget
   * er regnet uten bruker (ingen id å gi).
   */
  kortId?: string;
  /** Ordre c: kortet er delt ut av arbeideren («Del til eget kort»). Nøkkelen er `kortId`. */
  egetKort: boolean;
};

type RadKortGrunnlag = { projectId: string; byggeplassId: string | null; kortId?: string; egetKort?: boolean };
type DatoGrunnlag = Pick<DagsforslagDag, "byggeplassId" | "dato">;

function radKortNokkel(rad: RadKortGrunnlag, d: Pick<DagsforslagDag, "byggeplassId">): string {
  return kortNokkel({
    projectId: rad.projectId,
    byggeplassId: rad.byggeplassId ?? d.byggeplassId ?? null,
    ecoId: null,
  });
}

/**
 * Kortets identitet: dato + prosjekt + effektiv byggeplass. Ordre c: et kort
 * arbeideren har delt ut («Del til eget kort») er sin egen id — det deler
 * prosjekt og byggeplass med kortet det kom fra (K7).
 */
function radKortId(rad: RadKortGrunnlag, d: DatoGrunnlag): string {
  if (rad.egetKort && rad.kortId) return `eget|${rad.kortId}`;
  return `${d.dato}|${radKortNokkel(rad, d)}`;
}

function kortId(k: BeskrivelseKort): string {
  if (k.egetKort && k.kortId) return `eget|${k.kortId}`;
  return `${k.dato}|${kortNokkel({ projectId: k.projectId, byggeplassId: k.byggeplassId, ecoId: null })}`;
}

/** Forslagets startdato: start-segmentets dato, ellers første dato. Blokkert eller ei. */
function forslagStartDato(forslag: Dagsforslag): string | null {
  return (forslag.datoer.find((d) => d.erStartSegment) ?? forslag.datoer[0])?.dato ?? null;
}

/** Kortene med arbeid (ikke reise) på åpne datoer, i forslagets rekkefølge — ett pr. dato. */
export function kortMedArbeid(forslag: Dagsforslag): BeskrivelseKort[] {
  const kort: {
    id: string;
    sted: string;
    dato: string;
    projectId: string;
    byggeplassId: string | null;
    kortId?: string;
    egetKort: boolean;
  }[] = [];
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
        ...(r.kortId ? { kortId: r.kortId } : {}),
        egetKort: !!(r.egetKort && r.kortId),
      });
    }
  }
  const startDato = forslagStartDato(forslag);
  // Ordre c: grunnkortenes nøkler regnes som før (utkast fra før kort-id finner
  // kortet sitt, T14). Et utdelt kort nøkles på sin id og rører dem ikke.
  const grunnKort = kort.filter((k) => !k.egetKort);
  return kort.map((k) => {
    const felles = { projectId: k.projectId, byggeplassId: k.byggeplassId, dato: k.dato, ...(k.kortId ? { kortId: k.kortId } : {}), egetKort: k.egetKort };
    const egne = grunnKort.filter((x) => x.projectId === k.projectId);
    const delerProsjekt = new Set(egne.map((x) => x.sted)).size > 1;
    const visDato = new Set(egne.map((x) => x.dato)).size > 1;
    if (k.egetKort) {
      return { ...felles, nokkel: k.kortId!, delerProsjekt, visDato, paaStartDato: k.dato === startDato };
    }
    const grunn = delerProsjekt ? k.sted : k.projectId;
    // RETUR 2 (24): grunnøkkelen uten dato tilhører KUN startdatoens kort —
    // også når det kortet mangler (0 t / blokkert). Ellers arvet kortet
    // 00–06 teksten fra 21–24 og arbeiderens egen tekst lå skjult.
    const paaStartDato = k.dato === startDato;
    const nokkel = paaStartDato ? grunn : `${k.dato}|${grunn}`;
    return { ...felles, nokkel, delerProsjekt, visDato, paaStartDato };
  });
}

/**
 * Ordre c, spec § 5.1 / T14: nøkler i `beskrivelsePerKort` med tekst som ikke
 * hører til noe kort (kortet ble angret, tiden flyttet, gammelt utkast). Vises
 * i Bekreft dag — teksten droppes aldri stille.
 */
export function foreldreloseBeskrivelser(forslag: Dagsforslag): string[] {
  const b = forslag.beskrivelsePerKort;
  if (!b) return [];
  const kjent = new Set(kortMedArbeid(forslag).map((k) => k.nokkel));
  return Object.keys(b).filter((n) => !kjent.has(n) && (b[n] ?? "").trim() !== "");
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
/** Ordre c: kortet en arbeidsrad på dato `d` hører til. Reise og 0 t → undefined. */
export function kortForRad(
  forslag: Dagsforslag,
  rad: RadKortGrunnlag,
  d: DatoGrunnlag,
): BeskrivelseKort | undefined {
  const id = radKortId(rad, d);
  return kortMedArbeid(forslag).find((x) => kortId(x) === id);
}

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

/** Summeringsnøkkel: kort-stedet (over alle datoer) — et utdelt kort er sitt eget (ordre c). */
function kortNokkelFraKort(k: BeskrivelseKort): string {
  if (k.egetKort && k.kortId) return `eget|${k.kortId}`;
  return kortNokkel({ projectId: k.projectId, byggeplassId: k.byggeplassId, ecoId: null });
}

function radSumNokkel(r: RadKortGrunnlag, d: Pick<DagsforslagDag, "byggeplassId">): string {
  if (r.egetKort && r.kortId) return `eget|${r.kortId}`;
  return radKortNokkel(r, d);
}

/**
 * Kortet med flest arbeidstimer (spec tillegg-utlegg-prosjektkort § 5, B6):
 * standardkort for en ny tillegg-/utleggslinje i Bekreft dag. Med `projectId`
 * velges blant det prosjektets kort. Lik sum → første kort. Ingen arbeid → null.
 * Summen er pr. kort-sted (prosjekt + byggeplass) over alle datoene, og et
 * sted med kort på flere datoer gir første åpne datos kort. ORDRE 25: linja
 * lagres på det kortets dato — samme sedel som før 25 når første åpne dato har
 * kortet, så dagsvakten og nattevaktens forvalg er uendret.
 */
export function kortMedFlestTimer(forslag: Dagsforslag, projectId?: string): BeskrivelseKort | null {
  const sum = new Map<string, number>();
  for (const d of forslag.datoer) {
    if (d.blokkert) continue;
    for (const r of d.rader) {
      if (r.erReise || !(r.timer > 0)) continue;
      const k = radSumNokkel(r, d);
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
