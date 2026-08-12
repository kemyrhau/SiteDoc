import type { MSProjectTask } from "@/lib/ms-project-parser";
import { datoTilUkeAar } from "@/lib/ms-project-parser";

// ─────────────────────────────────────────────────────────────────────────────
// Klient-side beregning av revisjons-diff (del 2). Ren funksjon: sammenligner en
// nylest MS Project-fil mot eksisterende import-styrte kontrollpunkter og
// grupperer endringene. Ingen apply-logikk her — det er sjekkpunkt (c).
// ─────────────────────────────────────────────────────────────────────────────

export type Frist = { uke: number; aar: number };

// Eksisterende import-styrt punkt (fra kontrollplan.hentRevisjonsgrunnlag).
export interface RevisjonPunkt {
  id: string;
  importTaskUid: number;
  importWbs: string | null;
  importNavn: string | null;
  sjekklisteMalId: string;
  faggruppeId: string;
  milepelId: string | null;
  fristUke: number | null;
  fristAar: number | null;
  status: string; // planlagt | pagar | utfort | godkjent
  sjekklisteMal: { name: string; prefix: string | null; kontrollomrade: string | null };
  faggruppe: { name: string; color: string | null };
  milepel: { navn: string } | null;
  sjekkliste: { id: string; status: string } | null;
}

// Rader brukeren bevisst valgte bort ved forrige import (KontrollplanImport.hoppetOver).
export interface HoppetOverRad {
  uid: number;
  navn: string;
  wbs: string | null;
}

export interface FristEndring {
  punkt: RevisjonPunkt;
  gammelFrist: Frist | null;
  nyFrist: Frist | null;
  deltaUker: number | null;
  // sikker = UID-match (forhåndsvalgt, ingen dekor). false = fingerprint («antatt samme»),
  // krever eksplisitt bekreftelse per rad før anvendelse.
  sikker: boolean;
  // Kun for antatt samme: uid-en fra ny fil som punktet oppgraderes til ved bekreftelse,
  // og hva som var før (til «Var: X»-visning).
  nyTaskUid: number;
  antattVar?: string | null;
}

export interface MilepelGruppe {
  milepelId: string | null;
  milepelNavn: string | null;
  endringer: FristEndring[];
  antallSikre: number;
  antallAntatt: number;
}

export interface NyAktivitet {
  uid: number;
  navn: string;
  wbs: string | null;
  frist: Frist | null;
  resourceNames: string[];
  // Var blant radene brukeren valgte bort ved forrige import — vises kollapset.
  tidligereValgtBort: boolean;
}

export interface Deaktivert {
  // Alle punkter for en uid som ikke lenger finnes i ny fil (kan være flere maler).
  uid: number;
  navn: string | null;
  wbs: string | null;
  punkter: RevisjonPunkt[];
  harUtfortArbeid: boolean; // hindrer arkivering (mockup: «Arkiver» disabled)
}

export interface Revisjonsdiff {
  fristEndringer: MilepelGruppe[];
  nyeAktiviteter: NyAktivitet[];
  deaktiverte: Deaktivert[];
  uendretAntall: number;
  // Utførte/godkjente punkter holdes HELT ute av diffen — kun oppsummeringslinja.
  utfortGodkjentPunkter: RevisjonPunkt[];
  antallSikre: number;
  antallAntatt: number;
}

const ER_UTFORT = (status: string) => status === "utfort" || status === "godkjent";
// Proxy for «har utført arbeid»: alt utover planlagt betyr at arbeid er påbegynt.
const HAR_ARBEID = (p: RevisjonPunkt) => p.status !== "planlagt" || p.sjekkliste != null;

function taskFrist(t: MSProjectTask): Frist | null {
  return t.finish ? datoTilUkeAar(t.finish) : null;
}

function fristLik(a: Frist | null, b: Frist | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.uke === b.uke && a.aar === b.aar;
}

function deltaUker(gammel: Frist | null, ny: Frist | null): number | null {
  if (!gammel || !ny) return null;
  return (ny.aar - gammel.aar) * 52 + (ny.uke - gammel.uke);
}

// Normaliser navn for fingerprint-sammenligning: lowercase, fjern tegnsetting,
// kollaps whitespace. «Utsparinger tekn. føringer 3etg» ~ «Utsparinger tekniske føringer 3. etg».
function normaliser(navn: string): string {
  return navn
    .toLowerCase()
    .replace(/[.,;:_/\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Token-Jaccard: andel felles ord. Fingerprint krever WBS-treff + rimelig navnelikhet.
function navnLikner(a: string, b: string): boolean {
  const na = normaliser(a);
  const nb = normaliser(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(" ").filter(Boolean));
  const tb = new Set(nb.split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return false;
  let felles = 0;
  for (const w of ta) if (tb.has(w)) felles++;
  const jaccard = felles / (ta.size + tb.size - felles);
  return jaccard >= 0.5;
}

export function beregnRevisjonsdiff(
  punkter: RevisjonPunkt[],
  nyeTasks: MSProjectTask[],
  hoppetOver: HoppetOverRad[],
): Revisjonsdiff {
  const hoppetOverUids = new Set(hoppetOver.map((h) => h.uid));

  // Kun løvnoder er kontrollpunkt-kandidater (summary-rader er beholdere).
  const nyeLoev = nyeTasks.filter((t) => !t.isSummary);
  const nyeByUid = new Map(nyeLoev.map((t) => [t.uid, t]));

  // Grupper eksisterende punkter per uid (én uid → N punkter, flere maler).
  const punktByUid = new Map<number, RevisjonPunkt[]>();
  for (const p of punkter) {
    const arr = punktByUid.get(p.importTaskUid) ?? [];
    arr.push(p);
    punktByUid.set(p.importTaskUid, arr);
  }

  const fristEndringer: FristEndring[] = [];
  const utfortGodkjentPunkter: RevisjonPunkt[] = [];
  const deaktivertUids: number[] = [];
  let uendretAntall = 0;

  // ── Pass 1: UID-match ──
  for (const [uid, punkterForUid] of punktByUid) {
    const nyTask = nyeByUid.get(uid);
    if (!nyTask) {
      deaktivertUids.push(uid);
      continue;
    }
    const nyFrist = taskFrist(nyTask);
    for (const punkt of punkterForUid) {
      if (ER_UTFORT(punkt.status)) {
        utfortGodkjentPunkter.push(punkt); // HELT ute av diffen
        continue;
      }
      const gammelFrist = punkt.fristUke != null && punkt.fristAar != null
        ? { uke: punkt.fristUke, aar: punkt.fristAar }
        : null;
      if (fristLik(gammelFrist, nyFrist)) {
        uendretAntall++;
      } else {
        fristEndringer.push({
          punkt, gammelFrist, nyFrist,
          deltaUker: deltaUker(gammelFrist, nyFrist),
          sikker: true, nyTaskUid: uid,
        });
      }
    }
  }

  // ── Pass 2: fingerprint (WBS + navn) på UID-løse ny-rader mot deaktiverte ──
  const nyeUtenUidMatch = nyeLoev.filter((t) => !punktByUid.has(t.uid));
  const brukteDeaktivertUids = new Set<number>();
  const forbrukteNyeUids = new Set<number>();

  for (const nyTask of nyeUtenUidMatch) {
    const treff = deaktivertUids.find((uid) => {
      if (brukteDeaktivertUids.has(uid)) return false;
      const p0 = punktByUid.get(uid)![0]!;
      return p0.importWbs != null && p0.importWbs === nyTask.wbs
        && p0.importNavn != null && navnLikner(p0.importNavn, nyTask.name);
    });
    if (treff === undefined) continue;

    brukteDeaktivertUids.add(treff);
    forbrukteNyeUids.add(nyTask.uid);
    const nyFrist = taskFrist(nyTask);
    for (const punkt of punktByUid.get(treff)!) {
      if (ER_UTFORT(punkt.status)) { utfortGodkjentPunkter.push(punkt); continue; }
      const gammelFrist = punkt.fristUke != null && punkt.fristAar != null
        ? { uke: punkt.fristUke, aar: punkt.fristAar }
        : null;
      fristEndringer.push({
        punkt, gammelFrist, nyFrist,
        deltaUker: deltaUker(gammelFrist, nyFrist),
        sikker: false, nyTaskUid: nyTask.uid, antattVar: punkt.importNavn,
      });
    }
  }

  // ── Grupper frist-endringer per milepæl ──
  const milepelMap = new Map<string, MilepelGruppe>();
  for (const e of fristEndringer) {
    const key = e.punkt.milepelId ?? "__ingen__";
    let g = milepelMap.get(key);
    if (!g) {
      g = {
        milepelId: e.punkt.milepelId,
        milepelNavn: e.punkt.milepel?.navn ?? null,
        endringer: [], antallSikre: 0, antallAntatt: 0,
      };
      milepelMap.set(key, g);
    }
    g.endringer.push(e);
    if (e.sikker) g.antallSikre++; else g.antallAntatt++;
  }

  // ── Nye aktiviteter (uten uid-match, ikke fingerprint-forbrukt) ──
  const nyeAktiviteter: NyAktivitet[] = nyeUtenUidMatch
    .filter((t) => !forbrukteNyeUids.has(t.uid))
    .map((t) => ({
      uid: t.uid,
      navn: t.name,
      wbs: t.wbs,
      frist: taskFrist(t),
      resourceNames: t.resourceNames,
      tidligereValgtBort: hoppetOverUids.has(t.uid),
    }));

  // ── Deaktiverte (uid uten motpart, ikke fingerprint-brukt) ──
  const deaktiverte: Deaktivert[] = deaktivertUids
    .filter((uid) => !brukteDeaktivertUids.has(uid))
    .map((uid) => {
      const ps = punktByUid.get(uid)!;
      return {
        uid,
        navn: ps[0]!.importNavn,
        wbs: ps[0]!.importWbs,
        punkter: ps,
        harUtfortArbeid: ps.some(HAR_ARBEID),
      };
    });

  const fristEndringerGrupper = [...milepelMap.values()];
  const antallSikre = fristEndringer.filter((e) => e.sikker).length;
  const antallAntatt = fristEndringer.length - antallSikre;

  return {
    fristEndringer: fristEndringerGrupper,
    nyeAktiviteter,
    deaktiverte,
    uendretAntall,
    utfortGodkjentPunkter,
    antallSikre,
    antallAntatt,
  };
}

// Kompakt fristvisning (mockup): «u34 → u37 +3 uker». Årstall kun når endringen
// krysser årsskiftet, ellers blir 200 rader uleselige.
export function formaterFristEndring(gammel: Frist | null, ny: Frist | null): string {
  const kryssaar = gammel && ny && gammel.aar !== ny.aar;
  const vis = (f: Frist | null) =>
    f ? (kryssaar ? `u${f.uke}/${f.aar}` : `u${f.uke}`) : "—";
  return `${vis(gammel)} → ${vis(ny)}`;
}
