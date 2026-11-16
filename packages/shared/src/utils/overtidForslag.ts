/**
 * V21 — overtidsforslag ved manuell føring (spec `timer-pause-en-kilde-spec.md` § 8).
 *
 * Når manuelle timer-rader passerer firmaets dagsnorm, foreslår rad-dialogen
 * (web + mobil) ÉN linje med ÉN knapp. Ingenting skrives automatisk — denne
 * helperen regner bare ut forslaget; lagringen går gjennom eksisterende stier.
 *
 * Regler (samme som auto-genereringen, én kilde i `lonnsregel.ts`):
 *   - kronologisk på `fraTid`: normaltid fylles før overtid
 *   - reise er ALDRI overtid og teller ikke mot normen (V1, LAG 2)
 *   - nivå + lønnsart via `klassifiserArbeidstid` + `velgOvertidLonnsart`
 *     (strukturert `overtidsnivaa`, aldri navn). Ingen lønnsart → ingen forslag
 *   - rader som alt står på en overtid-lønnsart teller mot dagens sum, men får
 *     ikke forslag
 *   - raden som krysser normen deles (to deler); rad som ligger helt etter
 *     normen får forslag om å bytte lønnsart alene (`normal: null`)
 *
 * Delingspunktet er `tilFraAntall` (invers av `effektiveTimerFraSpenn`), så hver
 * del er internt konsistent med pausevinduet — serverens PK4-sjekk
 * (`vurderRadTimer`) godtar begge delene. Radens matpause følger den delen
 * pausevinduet faktisk ligger i.
 */
import {
  klassifiserArbeidstid,
  velgOvertidLonnsart,
  type OvertidLonnsartKandidat,
} from "./lonnsregel";
import {
  effektiveTimerFraSpenn,
  hhmmTilMin,
  pauseOverlappMin,
  tilFraAntall,
} from "./pauseBeregning";

/** Én rad på dagen slik forslaget ser den (lagret rad eller dialogens verdier). */
export type OvertidForslagRad = {
  id: string;
  fraTid: string | null;
  tilTid: string | null;
  /** Radens matpause-bærer (0 når raden ikke bærer pausen). */
  pauseMin: number;
  erReise: boolean;
  /** Radens nåværende lønnsart sitt `overtidsnivaa` (null = normaltid). */
  overtidsnivaa: number | null;
};

export type OvertidForslagDel = {
  fraTid: string;
  tilTid: string;
  timer: number;
  pauseMin: number;
};

export type OvertidForslag<L> = {
  radId: string;
  /** Timer av raden som er over dagsnormen (= overtid-delens timer). */
  overTimer: number;
  overtidLonnsart: L;
  overtidsnivaa: number;
  /** null = hele raden er over normen → kun lønnsart byttes. */
  normal: OvertidForslagDel | null;
  overtid: OvertidForslagDel;
};

/**
 * Regn ut overtidsforslag for dagens rader. Returnerer ett forslag pr. berørt
 * rad (tom liste når normen ikke passeres, normen mangler eller firmaet ikke
 * har en overtid-lønnsart). `pauseFra` = pausepunktet: fast streng, eller pr. rad
 * (ORDRE 2026-11-13 — pausen ligger der summert arbeid passerer grensen, jf.
 * `pauseFraForRad`).
 */
export function foreslaOvertidSplitt<
  L extends OvertidLonnsartKandidat & { id: string },
>(
  rader: readonly OvertidForslagRad[],
  norm: number | null,
  lonnsarter: readonly L[],
  opts: { pauseFra: string | ((rad: OvertidForslagRad) => string) },
): OvertidForslag<L>[] {
  if (norm == null || norm <= 0) return [];
  const pauseFraFor = (rad: OvertidForslagRad): string =>
    typeof opts.pauseFra === "string" ? opts.pauseFra : opts.pauseFra(rad);

  const arbeid = rader
    .filter(
      (r): r is OvertidForslagRad & { fraTid: string; tilTid: string } =>
        !r.erReise && !!r.fraTid && !!r.tilTid,
    )
    .map((r) => {
      const fraMin = hhmmTilMin(r.fraTid);
      const tilMin = hhmmTilMin(r.tilTid);
      const pauseFra = pauseFraFor(r);
      const pauseFraMin = hhmmTilMin(pauseFra);
      const effMin =
        tilMin > fraMin
          ? tilMin -
            fraMin -
            pauseOverlappMin(fraMin, tilMin, pauseFraMin, r.pauseMin)
          : 0;
      return { rad: r, fraMin, tilMin, effMin, pauseFra, pauseFraMin };
    })
    .filter((r) => r.effMin > 0)
    .sort((a, b) => a.fraMin - b.fraMin);

  const totalMin = arbeid.reduce((s, r) => s + r.effMin, 0);
  const nivaa = klassifiserArbeidstid({
    arbeidstimer: totalMin / 60,
    dagsnorm: norm,
  }).find((s) => s.overtidsnivaa != null)?.overtidsnivaa;
  if (nivaa == null) return [];
  const lonnsart = velgOvertidLonnsart([...lonnsarter], nivaa);
  if (!lonnsart) return [];

  const normMin = Math.round(norm * 60);
  const forslag: OvertidForslag<L>[] = [];
  let brukt = 0;
  for (const { rad, fraMin, tilMin, effMin, pauseFra, pauseFraMin } of arbeid) {
    const foer = brukt;
    brukt += effMin;
    if (rad.overtidsnivaa != null || brukt <= normMin) continue;

    if (foer >= normMin) {
      const timer = effektiveTimerFraSpenn(
        rad.fraTid,
        rad.tilTid,
        pauseFra,
        rad.pauseMin,
      );
      forslag.push({
        radId: rad.id,
        overTimer: timer,
        overtidLonnsart: lonnsart,
        overtidsnivaa: nivaa,
        normal: null,
        overtid: {
          fraTid: rad.fraTid,
          tilTid: rad.tilTid,
          timer,
          pauseMin: rad.pauseMin,
        },
      });
      continue;
    }

    const splitt = tilFraAntall(
      rad.fraTid,
      (normMin - foer) / 60,
      pauseFra,
      rad.pauseMin,
    );
    const splittMin = hhmmTilMin(splitt);
    if (splittMin <= fraMin || splittMin >= tilMin) continue;
    const normalPause =
      pauseOverlappMin(fraMin, splittMin, pauseFraMin, rad.pauseMin) > 0
        ? rad.pauseMin
        : 0;
    const overtidPause =
      normalPause === 0 &&
      pauseOverlappMin(splittMin, tilMin, pauseFraMin, rad.pauseMin) > 0
        ? rad.pauseMin
        : 0;
    const overtidTimer = effektiveTimerFraSpenn(
      splitt,
      rad.tilTid,
      pauseFra,
      overtidPause,
    );
    if (overtidTimer <= 0) continue;
    forslag.push({
      radId: rad.id,
      overTimer: overtidTimer,
      overtidLonnsart: lonnsart,
      overtidsnivaa: nivaa,
      normal: {
        fraTid: rad.fraTid,
        tilTid: splitt,
        timer: effektiveTimerFraSpenn(rad.fraTid, splitt, pauseFra, normalPause),
        pauseMin: normalPause,
      },
      overtid: {
        fraTid: splitt,
        tilTid: rad.tilTid,
        timer: overtidTimer,
        pauseMin: overtidPause,
      },
    });
  }
  return forslag;
}
