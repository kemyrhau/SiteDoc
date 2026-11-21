/**
 * Plan § 8.22 L3a (Bilde 2-jobben): regler for jobbskjemaet på dagssiden (prosjektkort-modus).
 * Rene funksjoner — testes uten React. Tidsregnestykket er delt med serveren (`regnJobbTid`).
 */
import { erGyldigHhmm, hhmmTilMin, tilFraAntall } from "@sitedoc/shared";

export type SkjemaArbeidsrad = {
  id: string;
  fraTid: string | null;
  tilTid: string | null;
  lonnsartId: string;
  pauseMin: number;
  attestertStatus?: string | null;
};

/**
 * Jobbens arbeidslinjer i rekkefølge når skjemaet kan vise jobben, ellers null (jobben står
 * som i dag). Skjemaet viser én linje, eller to der linje 2 er en overtidsart rett etter
 * linje 1. Mer enn to linjer, hull, linje uten fra–til eller attestert linje → null.
 */
export function jobbSkjemaLinjer<R extends SkjemaArbeidsrad>(
  arbeid: readonly R[],
  erOvertidsart: (lonnsartId: string) => boolean,
): R[] | null {
  if (arbeid.length < 1 || arbeid.length > 2) return null;
  if (arbeid.some((r) => !r.fraTid || !r.tilTid)) return null;
  if (arbeid.some((r) => r.attestertStatus === "attestert" || r.attestertStatus === "erstattet")) return null;
  const sortert = [...arbeid].sort((a, b) => hhmmTilMin(a.fraTid!) - hhmmTilMin(b.fraTid!));
  const [l1, l2] = sortert as [R, R | undefined];
  if (l2) {
    if (l2.fraTid !== l1.tilTid) return null;
    if (!erOvertidsart(l2.lonnsartId)) return null;
    if (erOvertidsart(l1.lonnsartId)) return null;
  }
  return sortert;
}

/** Seneste til-tid på dagen (alle rader), eller null. */
export function senesteTilTid(rader: readonly { tilTid: string | null }[]): string | null {
  return rader
    .map((r) => r.tilTid)
    .filter((t): t is string => !!t)
    .reduce<string | null>((s, t) => (s === null || hhmmTilMin(t) > hhmmTilMin(s) ? t : s), null);
}

export type SkjemaKilde = "firma" | "forrige";

/**
 * Neste jobb (dagen finnes): Fra = slutten på forrige jobb (ellers firmaets start), Til =
 * firmaets slutt bare når den ligger etter Fra — ellers tom. Pausen er dagens pause på en ny
 * dag og 0 på neste jobb (pausen er tatt i forrige jobb). Kilden vises som merke.
 */
export function nyJobbForslag(a: {
  sisteTil: string | null;
  firmaStart: string;
  firmaSlutt: string;
  firmaPauseMin: number;
}): { fraTid: string; tilTid: string; pauseMin: number; kilde: SkjemaKilde } {
  const fraTid = a.sisteTil ?? a.firmaStart;
  const tilTid = hhmmTilMin(a.firmaSlutt) > hhmmTilMin(fraTid) ? a.firmaSlutt : "";
  return { fraTid, tilTid, pauseMin: a.sisteTil ? 0 : a.firmaPauseMin, kilde: a.sisteTil ? "forrige" : "firma" };
}

/** Pausefeltet som heltall minutter; tomt = 0, ugyldig = NaN (valideres av `validerJobbTid`). */
export function lesPauseMin(v: string): number {
  const s = v.trim();
  if (s === "") return 0;
  return /^\d+$/.test(s) ? Number(s) : Number.NaN;
}

/**
 * Plan § 8.22 O2: tidsfeltet tolket når det forlates. «16», «1600», «16.00», «16,00» og «16:00»
 * blir «16:00»; «730» blir «07:30». Tomt felt = "". Ugyldig tekst = null (feltet står som skrevet,
 * og `validerJobbTid` melder formatfeil).
 */
export function tolkKlokkeslett(v: string): string | null {
  const s = v.trim();
  if (s === "") return "";
  const m = /^(\d{1,2})(?:[:.,](\d{2}))?$/.exec(s) ?? /^(\d{1,2})(\d{2})$/.exec(s);
  if (!m) return null;
  const t = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (t > 23 || min > 59) return null;
  return `${String(t).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Timefeltet som tall; komma eller punktum. Tomt, ugyldig eller ≤ 0 = null. */
export function lesTimer(v: string): number | null {
  const s = v.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s) && !/^\.\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

/**
 * Plan § 8.22 O2: Til når arbeideren skriver timer — Fra + timer + pause, via den delte
 * `tilFraAntall` (pausepunkt = Fra, så hele pausen ligger i jobben, som `regnJobbTid` regner).
 * Tom/ugyldig Fra eller ugyldige timer → null (ingenting regnes ut).
 */
export function tilFraTimer(fra: string, timerTekst: string, pauseMin: number): string | null {
  if (!erGyldigHhmm(fra)) return null;
  const n = lesTimer(timerTekst);
  if (n === null || !Number.isInteger(pauseMin) || pauseMin < 0) return null;
  return tilFraAntall(fra, n, fra, pauseMin);
}

/** Klokkevelgerens steg i minutter — samme som timevinduet: firmaets runding, maks 30, ellers 15. */
export function klokkeSteg(tidsrundingMinutter: number | null | undefined): number {
  return Math.min(tidsrundingMinutter && tidsrundingMinutter > 0 ? tidsrundingMinutter : 15, 30);
}

/** Valgene i klokkevelgeren (00:00 … 23:45 ved 15-minutters steg). */
export function klokkeValg(stegMin: number): string[] {
  const ut: string[] = [];
  for (let m = 0; m < 24 * 60; m += stegMin) {
    ut.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return ut;
}
