/**
 * w14 (B39 A, plan § 4.14): tilbake-adressen i timeføringen.
 *
 * Siden som åpner en annen, sender sin egen adresse i `?retur=`. Den åpnede siden går
 * tilbake dit — eller til en fast reserve når siden ble åpnet direkte (bokmerke, e-post).
 * Ren logikk, delt av `TilbakeLenke`/`useTilbakeAdresse`, lenkene og `useAktivSeksjon`.
 */

/** Etiketten følger adressen (lukket liste, aldri fritekst fra URL). */
export type TilbakeEtikett =
  | "timer.tilbakeTilTimer"
  | "timer.tilbakeTilMineTimer"
  | "tilbake.tilMapper"
  | "tilbake.tilHms"
  | "tilbake.tilInnstillinger"
  | "tilbake.tilSjekklister"
  | "papirkurv.returTilbake";

/**
 * Open-redirect-vakt: godtar kun stier under `/dashbord/`. Avviser `//`, `\` og
 * `..`-segmenter (sti-vandring), og alt som ikke er en streng.
 */
export function gyldigRetur(param: string | null | undefined): string | null {
  if (!param || !param.startsWith("/dashbord/")) return null;
  if (param.includes("//") || param.includes("\\")) return null;
  const sti = param.split(/[?#]/)[0]!;
  if (sti.split("/").some((del) => del === ".." || del === ".")) return null;
  return param;
}

/** Prosjektets Timer: `/dashbord/<prosjektId>/timer` (med eller uten søkeparametre). */
export function erProsjektetsTimer(sti: string): boolean {
  const deler = sti.split(/[?#]/)[0]!.split("/").filter(Boolean);
  return deler.length === 3 && deler[0] === "dashbord" && deler[2] === "timer" && deler[1] !== "timer";
}

/** Mine timer: `/dashbord/timer/mine`. */
export function erMineTimer(sti: string): boolean {
  return sti.split(/[?#]/)[0]!.replace(/\/$/, "") === "/dashbord/timer/mine";
}

/** Knappeteksten sier hvor knappen går. Ukjent adresse → nøytral «Tilbake». */
export function tilbakeEtikett(sti: string): TilbakeEtikett {
  if (erProsjektetsTimer(sti)) return "timer.tilbakeTilTimer";
  if (erMineTimer(sti)) return "timer.tilbakeTilMineTimer";
  // w14 leveranse 2 (TK6–TK13, TK24): de andre listene en underside åpnes fra.
  if (erProsjektside(sti, "mapper")) return "tilbake.tilMapper";
  if (erHmsListe(sti)) return "tilbake.tilHms";
  if (erProsjektside(sti, "sjekklister")) return "tilbake.tilSjekklister";
  if (utenSok(sti) === "/dashbord/innstillinger") return "tilbake.tilInnstillinger";
  return "papirkurv.returTilbake";
}

function utenSok(sti: string): string {
  return sti.split(/[?#]/)[0]!.replace(/\/$/, "");
}

/** `/dashbord/<prosjektId>/<side>` (med eller uten søkeparametre). */
function erProsjektside(sti: string, side: string): boolean {
  const deler = utenSok(sti).split("/").filter(Boolean);
  return deler.length === 3 && deler[0] === "dashbord" && deler[2] === side;
}

/** Legger `?retur=` på en lenke (beholder lenkens egne parametre). Ugyldig retur → lenken uendret. */
export function medRetur(href: string, retur: string | null | undefined): string {
  const gyldig = gyldigRetur(retur);
  if (!gyldig) return href;
  const skille = href.includes("?") ? "&" : "?";
  return `${href}${skille}retur=${encodeURIComponent(gyldig)}`;
}

/**
 * w14 gate (110) V1: teksten på en «Ferdig»-knapp som går til tilbake-adressen.
 * Går adressen et annet sted enn reserven (gyldig `?retur`), sier knappen hvor
 * (tilbake-etiketten); ellers står sidens egen tekst («Til maskinregister»).
 */
export function ferdigKnappNokkel(
  adresse: { href: string; labelKey: string } | null,
  reserveHref: string,
  egenNokkel: string,
): string {
  return adresse && adresse.href !== reserveHref ? adresse.labelKey : egenNokkel;
}

/** Fast reserve når siden åpnes uten gyldig `?retur` (B39 A). */
export const RESERVE_MINE_TIMER = {
  href: "/dashbord/timer/mine",
  labelKey: "timer.tilMineTimer",
} as const;

/** Lokal dato som YYYY-MM-DD (ikke `toISOString`, som gir dagen før øst for UTC). */
export function lokalIsoDato(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Mandagen i uka datoen ligger i, lokal midnatt. */
export function mandagI(dato: Date): Date {
  const d = new Date(dato);
  const dag = d.getDay(); // 0 = søndag
  d.setDate(d.getDate() + (dag === 0 ? -6 : 1 - dag));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** `?uke=YYYY-MM-DD` → mandagen i den uka. Ukjent/ugyldig → `null` (siden bruker denne uka). */
export function lesUkeParam(param: string | null | undefined): Date | null {
  const m = param ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(param) : null;
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return mandagI(d);
}

/**
 * w14 (TK2): prosjektets Timer med uka og statusfilteret i adressen, så «Tilbake til Timer»
 * lander på samme uke og filter. Statusfilteret «alle» står ikke i adressen.
 */
export function prosjektTimerAdresse(prosjektId: string, ukeStart: Date, status: string): string {
  const params = new URLSearchParams({ uke: lokalIsoDato(ukeStart) });
  if (status !== "alle") params.set("status", status);
  return `/dashbord/${prosjektId}/timer?${params.toString()}`;
}

/** Søkeparametrene fra en server-side (`searchParams`) som `?a=b`, tom når det ikke er noen. */
export function soketekst(searchParams: Record<string, string | string[] | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) p.append(k, x);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * Ukefeilen (plan § 8.17): fra og til for uka som starter `ukeStart` (lokal midnatt), som lokale
 * datoer. `toISOString()` av lokal midnatt gir dagen før øst for UTC: lista fikk søndagen før og
 * mistet søndagen i uka.
 */
export function ukeIntervall(ukeStart: Date): { fra: string; til: string } {
  const slutt = new Date(ukeStart);
  slutt.setDate(slutt.getDate() + 6);
  return { fra: lokalIsoDato(ukeStart), til: lokalIsoDato(slutt) };
}

/** Hurtigvalgene på Mine timer. «egendefinert» bruker datoene brukeren valgte. */
export type MineTimerPeriode =
  | "denne_uken"
  | "denne_maaneden"
  | "forrige_maaneden"
  | "siste_3_mnd"
  | "egendefinert";

/** Fra og til for et hurtigvalg på Mine timer, som lokale datoer (ukefeilen, plan § 8.17). */
export function mineTimerIntervall(
  periode: MineTimerPeriode,
  naa: Date,
  fraEgen: string,
  tilEgen: string,
): { fra: string; til: string } {
  if (periode === "denne_uken") return ukeIntervall(mandagI(naa));
  if (periode === "denne_maaneden") {
    return {
      fra: lokalIsoDato(new Date(naa.getFullYear(), naa.getMonth(), 1)),
      til: lokalIsoDato(new Date(naa.getFullYear(), naa.getMonth() + 1, 0)),
    };
  }
  if (periode === "forrige_maaneden") {
    return {
      fra: lokalIsoDato(new Date(naa.getFullYear(), naa.getMonth() - 1, 1)),
      til: lokalIsoDato(new Date(naa.getFullYear(), naa.getMonth(), 0)),
    };
  }
  if (periode === "siste_3_mnd") {
    // Siste 3 måneder t.o.m. i dag (inklusivt). TILLEGG 3: lengre tidsperspektiv.
    return {
      fra: lokalIsoDato(new Date(naa.getFullYear(), naa.getMonth() - 3, naa.getDate())),
      til: lokalIsoDato(naa),
    };
  }
  return { fra: fraEgen, til: tilEgen };
}

/** HMS-lista: prosjektets (`/dashbord/<p>/hms`) eller Firma › HMS (`/dashbord/firma/hms`). */
export function erHmsListe(sti: string): boolean {
  const deler = sti.split(/[?#]/)[0]!.split("/").filter(Boolean);
  return deler.length === 3 && deler[0] === "dashbord" && deler[2] === "hms";
}

/**
 * w14 (TK7–TK10): «← HMS» og retur etter sletting på et HMS-dokument eller en sjekkliste/oppgave.
 * «← HMS» går til HMS-lista brukeren kom fra (Firma › HMS eller prosjektets), ellers prosjektets.
 * Sletting går til `returnerTil` (dokumentet oppgaven ble laget fra), så `?retur`, så lista.
 */
export function dokumentRetur(opts: {
  retur: string | null | undefined;
  returnerTil?: string | null;
  standardListe: string;
  prosjektHms: string;
}): { hms: string; etterSletting: string } {
  const retur = gyldigRetur(opts.retur);
  const returnerTil = gyldigRetur(opts.returnerTil);
  return {
    hms: returnerTil ?? (retur && erHmsListe(retur) ? retur : opts.prosjektHms),
    etterSletting: returnerTil ?? retur ?? opts.standardListe,
  };
}

/** Adressen brukeren står på nå (sti + søk), til `?retur` fra en klikk-handler. `null` på serveren. */
export function herAdresse(): string | null {
  return typeof window === "undefined" ? null : window.location.pathname + window.location.search;
}
