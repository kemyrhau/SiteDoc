/**
 * Arkivmal — instruksjonsfelt-rendering (F2-rest, 2026-08-23).
 *
 * Arkiv-override for `info_text` / `info_image` / `video` / `quiz`. `felt.ts` er
 * FROSSET (delt mobil-sti) og dropper alle fire eksplisitt (`felt.ts:37` →
 * `return ""`); overstyringen skjer her, etter samme mønster som `drawing_position`
 * (D2). Intercepteres i `innhold.ts` FØR `renderFelt`.
 *
 * Fabel D3: byggherren skal se hva utføreren fikk instruks om.
 * - `info_text` → grå instruksjonsblokk med teksten.
 * - `info_image` → grå blokk med bildeteksten; selve bildet embeddes KUN når URL-en
 *   allerede er en inlinet data-URI (nettverksfri container — `config.imageUrl`
 *   peker på `/api/uploads/...` som containeren ikke kan hente; api-leseren har i
 *   dag ingen inlining for mal-config-bilder, jf. meld — derfor referanselinje ellers).
 * - `video` → referanselinje (tittel + URL), ikke avspiller.
 * - `quiz` → spørsmål + AVGITT svar + riktig/feil (dokumentasjonsdata — datatap før).
 */

import { esc } from "../hjelpere";
import type { TreObjekt, FeltVerdi } from "../typer";

/** Grå instruksjonsboks med tittel + ferdig HTML-kropp. */
function boks(tittel: string, kropp: string): string {
  return `<div class="ark-instruksjon"><div class="ark-instruksjon-tittel">${esc(tittel)}</div>${kropp}</div>`;
}

/** `info_text` → grå blokk med lesetekst. Tom tekst → "" (ingen tom boks). */
export function byggInstruksjonstekst(objekt: TreObjekt): string {
  const innhold = (objekt.config.content as string) ?? "";
  if (!innhold.trim()) return "";
  return boks(
    objekt.label || "Instruksjon",
    `<div class="ark-instruksjon-tekst">${esc(innhold)}</div>`,
  );
}

/** `info_image` → bildetekst (+ bilde hvis allerede data-URI). Tomt → "". */
export function byggInstruksjonsbilde(objekt: TreObjekt): string {
  const url = (objekt.config.imageUrl as string) ?? "";
  const caption = (objekt.config.caption as string) ?? "";
  if (!url && !caption) return "";

  let kropp = "";
  if (url.startsWith("data:")) {
    kropp += `<img class="ark-instruksjon-bilde" src="${url}" alt="${esc(caption)}">`;
    if (caption) kropp += `<div class="ark-instruksjon-caption">${esc(caption)}</div>`;
  } else {
    // Ikke-inlinet bilde: vis bildeteksten som instruksjonskontekst (byggherren
    // ser HVA bildet gjaldt). Selve pikslene krever api-inlining — se modul-meld.
    kropp += `<div class="ark-instruksjon-tekst">${esc(caption || "Instruksjonsbilde")}</div>`;
  }
  return boks(objekt.label || "Instruksjonsbilde", kropp);
}

/** `video` → referanselinje (tittel + URL). Tom URL → "". */
export function byggInstruksjonsvideo(objekt: TreObjekt): string {
  const url = (objekt.config.url as string) ?? (objekt.config.fileUrl as string) ?? "";
  if (!url.trim()) return "";
  const tittel = objekt.label || "Video";
  const ref = url.startsWith("data:")
    ? "(innebygd video)"
    : `<span class="ark-instruksjon-ref">${esc(url)}</span>`;
  return boks("Video", `<div class="ark-instruksjon-tekst">${esc(tittel)}</div>${ref}`);
}

/**
 * `quiz` → spørsmål + avgitt svar + riktig/feil-markør. Verdien er valgt indeks
 * (number) — begge flater lagrer KUN ved riktig svar, men rendres generisk
 * (sammenlign mot `correctIndex`) så et framtidig «lagre også feil» tåles.
 */
export function byggQuiz(objekt: TreObjekt, felt: FeltVerdi | undefined): string {
  const spørsmål = (objekt.config.question as string) ?? objekt.label ?? "";
  const alternativer = (objekt.config.options as string[]) ?? [];
  const riktigIndex = typeof objekt.config.correctIndex === "number" ? objekt.config.correctIndex : 0;
  const svarIndex = typeof felt?.verdi === "number" ? felt.verdi : null;

  const riktigSvar = alternativer[riktigIndex] ?? null;

  let svarLinje: string;
  if (svarIndex === null || alternativer[svarIndex] == null) {
    svarLinje = `<div class="ark-quiz-linje">Avgitt svar: <span class="tom">Ikke besvart</span></div>`;
  } else {
    const rett = svarIndex === riktigIndex;
    const markor = rett
      ? `<span class="ark-quiz-rett">(riktig)</span>`
      : `<span class="ark-quiz-feil">(feil)</span>`;
    svarLinje = `<div class="ark-quiz-linje">Avgitt svar: ${esc(alternativer[svarIndex])} ${markor}</div>`;
  }

  // Fasit vises alltid (referanse for byggherren), også ved ubesvart/feil.
  const fasitLinje =
    riktigSvar != null
      ? `<div class="ark-quiz-linje">Riktig svar: ${esc(riktigSvar)}</div>`
      : "";

  return `<div class="ark-quiz"><div class="ark-quiz-sp">${esc(spørsmål)}</div>${svarLinje}${fasitLinje}</div>`;
}

/**
 * Samle-intercept for `innhold.ts`: returnerer arkiv-HTML for en av de fire
 * instruksjonstypene, eller `null` hvis typen ikke er en instruksjonstype
 * (kalleren faller da til `renderFelt`).
 */
export function byggInstruksjonsfelt(objekt: TreObjekt, felt: FeltVerdi | undefined): string | null {
  switch (objekt.type) {
    case "info_text":
      return byggInstruksjonstekst(objekt);
    case "info_image":
      return byggInstruksjonsbilde(objekt);
    case "video":
      return byggInstruksjonsvideo(objekt);
    case "quiz":
      return byggQuiz(objekt, felt);
    default:
      return null;
  }
}
