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
  return "papirkurv.returTilbake";
}

/** Legger `?retur=` på en lenke (beholder lenkens egne parametre). Ugyldig retur → lenken uendret. */
export function medRetur(href: string, retur: string | null | undefined): string {
  const gyldig = gyldigRetur(retur);
  if (!gyldig) return href;
  const skille = href.includes("?") ? "&" : "?";
  return `${href}${skille}retur=${encodeURIComponent(gyldig)}`;
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
