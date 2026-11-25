/**
 * w2 i web-timeføring (B1, Kenneth 2026-11-17): «+ Registrer timer» fører en jobb på et
 * prosjekt. Dagen er ikke et eget steg — dagsseddelen lages stille (`opprett` er finn-eller-lag,
 * WM58), og neste jobb legges på samme seddel som et nytt kort (ny `kortId`, WM59).
 *
 * Ren logikk, delt av knappen (Mine timer, prosjektets Timer-side) og dagssiden.
 * Plan: `docs/claude/web-timeforing-plan.md` § 4 bilde 1 (tabellen «Når → Det som skjer»).
 */

import { lokalIsoDato, medRetur } from "@/lib/tilbake-adresse";

/** Hva dagssiden gjør når den åpnes fra «+ Registrer timer». */
export type RegistrerSteg =
  /** Ny dag med prosjekt: serveren har laget første jobb. Kortet åpnes, ingenting mer. */
  | "ferdig"
  /** Dagen kan føres: timervinduet åpnes for en ny jobb (nytt kort). */
  | "nyJobb"
  /** Dagen kan føres, men ingen prosjekt er kjent: arbeideren velger prosjekt først. */
  | "velgProsjekt"
  /** Dagen er sendt og ingen rad er attestert: tilby «Gjenåpne dagen» først (WM60). */
  | "gjenaapne"
  /** Dagen kan ikke gjenåpnes av arbeideren (attestert rad, eller godkjent). Dagens tekst forklarer. */
  | "laast";

export function registrerTimerSteg(a: {
  /** `opprett` fant en dagsseddel fra før (ingen rad ble laget). */
  eksisterte: boolean;
  status: string;
  harAttestertRad: boolean;
  /** Prosjektet fra toppen, når det finnes i arbeiderens prosjektliste. */
  projectId: string | null;
}): RegistrerSteg {
  if (a.status === "sent") return a.harAttestertRad ? "laast" : "gjenaapne";
  if (a.status !== "draft" && a.status !== "returned") return "laast";
  if (!a.projectId) return "velgProsjekt";
  return a.eksisterte ? "nyJobb" : "ferdig";
}

/**
 * w15a (B41 A, plan § 4.15 del G): hvilket kort som er åpent på dagssiden.
 * `aapentKort` er kort-id, prosjekt-id (tomt prosjektkort, eller prosjektet fra «+ Registrer
 * timer»/«Ny dagsseddel»), «utenJobb», `null` (alle lukket) eller `undefined` (automatisk).
 * En prosjekt-id som ikke er et kort på dagen, åpner prosjektets kort når det er ett —
 * serveren har laget jobben, og kortene har jobbens kort-id.
 */
export function loesAapentKort(a: {
  aapentKort: string | null | undefined;
  kortNokler: readonly string[];
  jobbKort: readonly { kortId: string; projectId: string | null }[];
}): string | null {
  if (a.aapentKort === undefined) return a.kortNokler.length === 1 ? a.kortNokler[0]! : null;
  if (a.aapentKort === null || a.kortNokler.includes(a.aapentKort)) return a.aapentKort;
  const prosjektets = a.jobbKort.filter((k) => k.projectId === a.aapentKort);
  return prosjektets.length === 1 ? prosjektets[0]!.kortId : a.aapentKort;
}

/** Parametrene «+ Registrer timer»-flyten leser; de fjernes når flyten er kjørt. */
const REGISTRER_PARAMETRE = ["registrer", "nyttProsjekt", "eksisterte"] as const;

/**
 * w15a: adressen etter at «+ Registrer timer»-flyten er kjørt — uten `registrer`,
 * `nyttProsjekt` og `eksisterte`, så omlasting ikke kjører flyten (eller åpner vinduet) igjen.
 * `retur` og andre parametre står.
 */
export function adresseEtterRegistrering(sti: string, sok: string | URLSearchParams): string {
  const ny = new URLSearchParams(sok);
  for (const navn of REGISTRER_PARAMETRE) ny.delete(navn);
  const rest = ny.toString();
  return rest ? `${sti}?${rest}` : sti;
}

/** Firmaets standardaktivitet for en ny dag — samme valg som skjemaet «Ny dagsseddel» (WM5). */
export function standardAktivitetId(
  aktiviteter: readonly { id: string; navn: string; aktiv: boolean }[] | undefined,
): string | null {
  if (!aktiviteter || aktiviteter.length === 0) return null;
  return (
    aktiviteter.find((a) => a.navn === "Anleggsarbeid" && a.aktiv)?.id ??
    aktiviteter.find((a) => a.aktiv)?.id ??
    aktiviteter[0]!.id
  );
}

/**
 * Byggeplassen fra toppen følger med første jobb (h, WM4) — men bare når den hører til
 * prosjektet. Serveren avviser ellers hele opprettelsen (`krevByggeplassIProsjekt`).
 */
export function byggeplassForRegistrering(a: {
  toppbarByggeplassId: string | null;
  projectId: string | null;
  byggeplasser: readonly { id: string; projectId: string }[] | undefined;
}): string | null {
  if (!a.toppbarByggeplassId || !a.projectId) return null;
  const bp = a.byggeplasser?.find((b) => b.id === a.toppbarByggeplassId);
  return bp && bp.projectId === a.projectId ? bp.id : null;
}

/**
 * REGISTRER-DATO (Kenneth 2026-11-25): datoen «Velg dato» på «+ Registrer timer» foreslår.
 * En valgt enkeltdato (Mine timers datosøk) vinner; ellers uka siden står på — denne uka gir i
 * dag, en tidligere uke gir ukas mandag. Aldri en dag etter i dag (ingen regel tillater
 * fremtidige dager; serveren har ingen grense, men skjemaet åpner ikke for dem).
 */
export function standardRegistrerDato(a: {
  naa: Date;
  /** Mandagen i uka siden viser (`?uke=`). */
  ukeStart?: Date | null;
  /** En enkeltdato siden filtrerer på (YYYY-MM-DD). */
  valgtDato?: string | null;
}): string {
  const iDag = lokalIsoDato(a.naa);
  if (a.valgtDato && gyldigRegistrerDato(a.valgtDato, a.naa)) return a.valgtDato;
  if (a.ukeStart) {
    const mandag = lokalIsoDato(a.ukeStart);
    return mandag < iDag ? senesteAv(mandag, iDag, a.ukeStart) : iDag;
  }
  return iDag;
}

/** Ukas mandag, men i dag når uka er denne (mandag ≤ i dag ≤ søndag). */
function senesteAv(mandag: string, iDag: string, ukeStart: Date): string {
  const sondag = new Date(ukeStart);
  sondag.setDate(sondag.getDate() + 6);
  return lokalIsoDato(sondag) >= iDag ? iDag : mandag;
}

/** YYYY-MM-DD som finnes i kalenderen og ikke er etter i dag. */
export function gyldigRegistrerDato(dato: string, naa: Date): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dato);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return false;
  return dato <= lokalIsoDato(naa);
}

/** Lenken til dagen etter `opprett`. `registrer=1` starter flyten på dagssiden. */
export function registrerLenke(a: {
  sheetId: string;
  projectId: string | null;
  eksisterte: boolean;
  /** w14: lista knappen sto på — dagens tilbake-knapp går dit. */
  retur?: string | null;
}): string {
  const params = new URLSearchParams({ registrer: "1" });
  if (a.projectId) params.set("nyttProsjekt", a.projectId);
  if (a.eksisterte) params.set("eksisterte", "1");
  return medRetur(`/dashbord/timer/${a.sheetId}?${params.toString()}`, a.retur);
}

/** Ny kort-id (UUID) for en ny jobb. */
export function nyKortId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Timer med norsk komma og to desimaler: 7.5 → «7,50». */
export function visTimerTall(n: number): string {
  return n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Datoen som dd.mm. (som attesteringen, w1); med år når lista spenner over flere år. */
export function visDagDato(d: Date | string, medAar: boolean): string {
  // Streng fra API-et («2026-11-17» eller «2026-11-17T00:00:00.000Z»): datodelen som den står.
  // Date (f.eks. ukestart = lokal midnatt): lokale deler — toISOString ville gitt dagen før.
  const [aar, mnd, dag] =
    typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)
      ? d.slice(0, 10).split("-")
      : (() => {
          const x = new Date(d);
          return [
            String(x.getFullYear()),
            String(x.getMonth() + 1).padStart(2, "0"),
            String(x.getDate()).padStart(2, "0"),
          ];
        })();
  return medAar ? `${dag}.${mnd}.${aar}` : `${dag}.${mnd}.`;
}

/** Har lista dager fra mer enn ett kalenderår? */
export function spennerFlereAar(datoer: readonly (Date | string)[]): boolean {
  return new Set(datoer.map((d) => visDagDato(d, true).slice(6))).size > 1;
}
