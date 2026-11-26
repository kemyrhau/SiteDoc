/**
 * Plan § 8.22 L3a (Bilde 2-jobben): jobbens tid som arbeideren fører den i skjemaet —
 * Fra, Til og pause for hele jobben — delt i lønnslinjer. Én kilde for skjemaet på web
 * (det som vises før lagring) og `dagsseddel.lagreJobbTid` (det som lagres). Serveren
 * regner selv og stoler ikke på klientens linjer.
 *
 * Regler:
 *   - pausen ligger inne i jobben (`pauseFraForRad` klemmer punktet inn i spennet), så
 *     jobbens timer = spenn − pause, samme som serverens PK4 (`vurderRadTimer`, «ny»-regel)
 *   - overtid etter den delte regelen `foreslaOvertidSplitt`: normaltid fylles kronologisk
 *     over hele dagen, reise teller ikke, og overtidsarten velges strukturert
 *     (`velgOvertidLonnsart`, aldri navn). Uten norm eller overtidsart: én linje
 *   - har arbeideren valgt en overtidsart på linje 1 selv, lages ingen overtidslinje
 *   - ligger hele jobben over normen, blir det én linje merket `helOvertid`
 */
import type { OvertidLonnsartKandidat } from "./lonnsregel";
import { vurderOvertidSplitt, type OvertidForslagRad } from "./overtidForslag";
import { effektiveTimerFraSpenn, hhmmTilMin, pauseFraForRad } from "./pauseBeregning";

/** Én lønnslinje i jobben. */
export type JobbTidLinje = {
  fraTid: string;
  tilTid: string;
  timer: number;
  pauseMin: number;
  /** Linja er overtidsdelen (linje 2), eller hele jobben er over normen. */
  overtid: boolean;
};

export type JobbTidFeil = "format" | "fraForTil" | "pause";

export type JobbTidResultat<L> =
  | { ok: false; feil: JobbTidFeil }
  | {
      ok: true;
      /** 1 linje (normal eller hel overtid) eller 2 (normal + overtid). */
      linjer: JobbTidLinje[];
      /** Jobbens timer = spenn − pause. */
      timer: number;
      /** Firmaets overtidsart når jobben passerer normen, ellers null. */
      overtidLonnsart: L | null;
      overtidsnivaa: number | null;
      /** Hele jobben ligger over normen (én linje, overtid). */
      helOvertid: boolean;
      /**
       * R3 (runde 1 timer): jobben går over normen, men firmaet har ingen aktiv ordinær
       * lønnsart med dette `overtidsnivaa` — jobben lagres som én normallinje. Nivået, ellers null.
       */
      overtidManglerArt: number | null;
    };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Gyldig HH:MM (00:00–23:59). */
export function erGyldigHhmm(v: string | null | undefined): v is string {
  return !!v && HHMM.test(v);
}

/** Kontroll av feltene i skjemaet — samme regel som serveren avviser på. */
export function validerJobbTid(a: {
  fraTid: string | null | undefined;
  tilTid: string | null | undefined;
  pauseMin: number;
}): JobbTidFeil | null {
  if (!erGyldigHhmm(a.fraTid) || !erGyldigHhmm(a.tilTid)) return "format";
  const spenn = hhmmTilMin(a.tilTid) - hhmmTilMin(a.fraTid);
  if (spenn <= 0) return "fraForTil";
  if (!Number.isInteger(a.pauseMin) || a.pauseMin < 0 || a.pauseMin >= spenn) return "pause";
  return null;
}

export function regnJobbTid<L extends OvertidLonnsartKandidat & { id: string }>(a: {
  fraTid: string;
  tilTid: string;
  pauseMin: number;
  /** `overtidsnivaa` til lønnsarten på linje 1 (null = normaltid). */
  linje1Overtidsnivaa: number | null;
  /** Dagens andre timerader — uten jobbens egne arbeidslinjer. Reise tas med (teller ikke). */
  andreRader: readonly OvertidForslagRad[];
  norm: number | null;
  lonnsarter: readonly L[];
  pauseEtterTimer: number;
  /** `fastPauseFraFor(...)`: fast pausepunkt for `fastStart`-firma, ellers null. */
  fastPauseFra: string | null;
}): JobbTidResultat<L> {
  const feil = validerJobbTid(a);
  if (feil) return { ok: false, feil };

  const jobbId = "__jobb__";
  const jobbSomAnnen = [{ fraTid: a.fraTid, tilTid: a.tilTid, erReise: false }];
  const andreForPause = (utenId: string | null) =>
    a.andreRader
      .filter((r) => r.id !== utenId)
      .map((r) => ({ fraTid: r.fraTid, tilTid: r.tilTid, erReise: r.erReise }));
  const pauseFraFor = (r: { id: string; fraTid: string; tilTid: string; pauseMin: number }, andre: string | null) =>
    pauseFraForRad({
      fraTid: r.fraTid,
      tilTid: r.tilTid,
      andreRader: andre === null ? andreForPause(null) : [...andreForPause(r.id), ...jobbSomAnnen],
      pauseEtterTimer: a.pauseEtterTimer,
      pauseMin: r.pauseMin,
      fastPauseFra: a.fastPauseFra,
    });

  const jobbPauseFra = pauseFraFor({ id: jobbId, ...a }, null);
  const timer = effektiveTimerFraSpenn(a.fraTid, a.tilTid, jobbPauseFra, a.pauseMin);
  const enLinje = (overtid: boolean): JobbTidLinje[] => [
    { fraTid: a.fraTid, tilTid: a.tilTid, timer, pauseMin: a.pauseMin, overtid },
  ];
  const ingen = { overtidLonnsart: null, overtidsnivaa: null, helOvertid: false, overtidManglerArt: null };

  if (a.linje1Overtidsnivaa != null) return { ok: true, linjer: enLinje(true), timer, ...ingen };

  const jobbRad: OvertidForslagRad = {
    id: jobbId,
    fraTid: a.fraTid,
    tilTid: a.tilTid,
    pauseMin: a.pauseMin,
    erReise: false,
    overtidsnivaa: null,
  };
  const vurdering = vurderOvertidSplitt([...a.andreRader, jobbRad], a.norm, a.lonnsarter, {
    pauseFra: (r) =>
      r.id === jobbId
        ? jobbPauseFra
        : r.fraTid && r.tilTid
          ? pauseFraFor({ id: r.id, fraTid: r.fraTid, tilTid: r.tilTid, pauseMin: r.pauseMin }, r.id)
          : "00:00",
  });
  const forslag = vurdering.forslag.find((f) => f.radId === jobbId);
  if (!forslag) {
    const mangler = vurdering.manglerArt?.radIder.includes(jobbId) ? vurdering.manglerArt.nivaa : null;
    return { ok: true, linjer: enLinje(false), timer, ...ingen, overtidManglerArt: mangler };
  }

  const ot = { overtidLonnsart: forslag.overtidLonnsart, overtidsnivaa: forslag.overtidsnivaa, overtidManglerArt: null };
  if (!forslag.normal) return { ok: true, linjer: enLinje(true), timer, ...ot, helOvertid: true };
  return {
    ok: true,
    linjer: [
      { ...forslag.normal, overtid: false },
      { ...forslag.overtid, overtid: true },
    ],
    timer,
    ...ot,
    helOvertid: false,
  };
}
