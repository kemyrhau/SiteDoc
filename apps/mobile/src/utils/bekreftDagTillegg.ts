import { and, eq, inArray } from "drizzle-orm";
import {
  beregnMaskinBrudd,
  type MaskinBrudd,
  type MaskinKapasitetRad,
} from "@sitedoc/shared";
import { byggeplassLocal, dagsseddelLocal, sheetTimerLocal, sheetMachineLocal } from "../db/schema";
import type { LokalDb } from "../services/dagsforslagInput";
import { maskinerOverRad } from "../services/kobledeMaskiner";
import type { SedelKortKontekst } from "../lib/prosjektkortMobil";
import type { Dagsforslag } from "./dagsforslag";

/**
 * L3-D maskin og varer i `/timer/bekreft-dag` (spec § 3.5, ORDRE 31;
 * PRESISERING TILLEGG 2026-11-12: pr. rad).
 *
 * Linjene holdes i skjermens minne pr. arbeidsrad og skrives FØRST ved
 * [Bekreft og lagre], koblet til raden (`sheetTimerId`) på radens sedel.
 */

export type TilleggMaskin = {
  /** Kun skjermens nøkkel — ikke rad-id. */
  lokalId: string;
  projectId: string;
  vehicleId: string;
  timer: number;
  mengde: number | null;
  enhet: string | null;
};

export type TilleggVare = {
  lokalId: string;
  projectId: string;
  vareId: string;
  vareNavn: string;
  enhet: string;
  antall: number;
  byggeplassId: string | null;
};

export type BekreftDagTillegg = { maskiner: TilleggMaskin[]; varer: TilleggVare[] };

/**
 * ORDRE 34 pkt 1: Bekreft dag fører maskintimer uten mengde/enhet. Feltene finnes
 * fortsatt i DB/API (firmarapport, attestering, prosjektkortets MaskinSeksjon).
 */
/**
 * ORDRE 34 pkt 2: «Ført i dag» øverst i vare-modalen — linjer som alt ligger
 * lokalt for prosjektet/datoen, pluss de som er valgt i denne Bekreft dag-økten.
 */
export function fortIDagLinjer(
  lagret: { navn: string; antall: number; enhet: string }[],
  varer: TilleggVare[],
  projectId: string,
): { navn: string; antall: number; enhet: string }[] {
  return [
    ...lagret,
    ...varer
      .filter((v) => v.projectId === projectId)
      .map((v) => ({ navn: v.vareNavn, antall: v.antall, enhet: v.enhet })),
  ];
}

export function nyTilleggMaskin(p: {
  lokalId: string;
  projectId: string;
  vehicleId: string;
  timer: number;
}): TilleggMaskin {
  return { ...p, mengde: null, enhet: null };
}

/**
 * Hvilke knapper vises. Maskin krever utstyrsbufferen, varer krever at prosjektet
 * har Varelager. Vedtak D: mangler begge, skjules seksjonen helt.
 */
export function tilleggSynlighet(p: {
  harEquipment: boolean;
  varelagerProsjektIder: string[];
  projectId: string | null;
}): { maskin: boolean; varer: boolean; seksjon: boolean } {
  const maskin = p.projectId != null && p.harEquipment;
  const varer = p.projectId != null && p.varelagerProsjektIder.includes(p.projectId);
  return { maskin, varer, seksjon: maskin || varer };
}

/**
 * Byggeplassen varen arver: entydig byggeplass på åpne datoer for prosjektet.
 * Ulike byggeplasser (eller ingen) → null; arbeideren ser ikke et gjettet sted.
 */
export function entydigByggeplass(forslag: Dagsforslag, projectId: string): string | null {
  if (forslag.prosjektId !== projectId) return null;
  const ider = new Set(
    forslag.datoer
      .filter((d) => !d.blokkert && d.byggeplassId != null)
      .map((d) => d.byggeplassId as string),
  );
  return ider.size === 1 ? [...ider][0]! : null;
}

export type VaktGrunnlag = {
  timerRader: MaskinKapasitetRad[];
  maskinRader: MaskinKapasitetRad[];
  pauseMin: number;
};

/**
 * KUN LESING. Grunnlaget serveren validerer på etter Bekreft: datoens sedels
 * eksisterende timer- og maskinrader (append på draft/returned) + forslagets
 * rader for start-datoen. null = ingen start-sedel å skrive på (sendt/ingen).
 */
export function vaktGrunnlag(
  db: LokalDb,
  userId: string,
  forslag: Dagsforslag,
  /** Utelatt = start-datoen. */
  dato?: string,
): VaktGrunnlag | null {
  const d = forslag.datoer.find((x) => (dato ? x.dato === dato : x.erStartSegment));
  if (!d || d.blokkert || forslag.prosjektId == null) return null;
  // Ordre (6): maskin måles mot arbeid UTEN reise — reise-rader er ikke grunnlag.
  // Strengere enn serveren (som fortsatt teller reise), aldri løsere.
  const nyeTimer = d.rader.filter((r) => !r.erReise).map((r) => ({
    projectId: r.projectId,
    externalCostObjectId: null,
    timer: r.timer,
  }));
  const nyPause = d.rader.reduce((s, r) => s + r.pauseMin, 0);
  const sedel = db
    .select()
    .from(dagsseddelLocal)
    .where(
      and(
        eq(dagsseddelLocal.userId, userId),
        eq(dagsseddelLocal.dato, d.dato),
        inArray(dagsseddelLocal.status, ["draft", "returned"]),
      ),
    )
    .all()[0];
  if (!sedel) return { timerRader: nyeTimer, maskinRader: [], pauseMin: d.pauseMin };
  // Lokal rad uten prosjekt arver sedelens (samme bøtte som serveren ser etter sync).
  const tilRad = (r: { projectId: string | null; externalCostObjectId: string | null; timer: number }) => ({
    projectId: r.projectId ?? sedel.projectId,
    externalCostObjectId: r.externalCostObjectId,
    timer: Number(r.timer),
  });
  const eksTimer = db
    .select()
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sedel.id))
    .all()
    .filter((r) => r.erReise !== true)
    .map(tilRad);
  const eksMaskin = db
    .select()
    .from(sheetMachineLocal)
    .where(eq(sheetMachineLocal.dagsseddelId, sedel.id))
    .all()
    .map(tilRad);
  return {
    timerRader: [...eksTimer, ...nyeTimer],
    maskinRader: eksMaskin,
    // PK6: serverens hode-pause = Σ rad-pause, også etter append.
    pauseMin: (sedel.pauseMin ?? 0) + nyPause,
  };
}

/**
 * ORDRE Tillegg/Utlegg 3b (GO 2026-11-13): sedel-kontekst for en rad som
 * nettopp er skrevet — aldri null. Mangler sedelen prosjekt (eldre sedel med
 * `projectId = null`), er radens prosjekt konteksten: raden eier prosjektet
 * (TILLEGG 2026-11-12). Sedelens byggeplass beholdes for arv.
 */
export function sedelKontekstForRad(db: LokalDb, sheetId: string, radProsjektId: string): SedelKortKontekst {
  const s = db
    .select({ projectId: dagsseddelLocal.projectId, byggeplassId: dagsseddelLocal.byggeplassId })
    .from(dagsseddelLocal)
    .where(eq(dagsseddelLocal.id, sheetId))
    .all()[0];
  const bp = s?.byggeplassId
    ? db
        .select({ id: byggeplassLocal.id, projectId: byggeplassLocal.projectId })
        .from(byggeplassLocal)
        .where(eq(byggeplassLocal.id, s.byggeplassId))
        .all()[0]
    : undefined;
  return {
    // Server-sedel uten prosjekt lagres lokalt som "" (timerSync) — faller også til raden.
    projectId: s?.projectId || radProsjektId,
    byggeplass: bp ? { id: bp.id, projectId: bp.projectId } : null,
  };
}

/** Sedelens prosjekt + byggeplass (med byggeplassens prosjekt) — som `sedelKontekst` i prosjektkortet. */
export function sedelKontekstLokalt(db: LokalDb, sheetId: string): SedelKortKontekst | null {
  const s = db
    .select({ projectId: dagsseddelLocal.projectId, byggeplassId: dagsseddelLocal.byggeplassId })
    .from(dagsseddelLocal)
    .where(eq(dagsseddelLocal.id, sheetId))
    .all()[0];
  if (!s?.projectId) return null;
  const bp = s.byggeplassId
    ? db
        .select({ id: byggeplassLocal.id, projectId: byggeplassLocal.projectId })
        .from(byggeplassLocal)
        .where(eq(byggeplassLocal.id, s.byggeplassId))
        .all()[0]
    : undefined;
  return { projectId: s.projectId, byggeplass: bp ? { id: bp.id, projectId: bp.projectId } : null };
}

/**
 * PRESISERING TILLEGG pkt 2 (Kenneth 2026-11-12): radene i Bekreft dag er
 * vanlige rader — maskiner og varer registreres på RADEN, som i
 * prosjektkortet. Ingen dagsliste, ingen tidsmatching, ingen auto-kobling.
 *
 * Nøkkel = `tillegg:` + dato | radIndeks. `radIndeks` er radens stabile
 * identitet (carve-vinduets opprettelsesrekkefølge, ikke posisjon etter tid) —
 * rettes fra–til, følger linjene raden. Uten fra-tid, prosjekt og lønnsart
 * (ORDRE Tillegg/Utlegg 3a, GO 2026-11-13): prosjektbytte og lønnsartbytte
 * (f.eks. til overtid) tar linjene med. Et vindu som forsvinner gir fortsatt
 * `tilleggUtenRad`-stopp — linjene glir aldri stille over på en annen rad.
 */
export const TILLEGG_PREFIKS = "tillegg:";

export function radTilleggNokkel(
  dato: string,
  rad: { erReise: boolean; radIndeks?: number },
): string | null {
  if (rad.erReise || rad.radIndeks == null) return null;
  return `${TILLEGG_PREFIKS}${dato}|${rad.radIndeks}`;
}

/** Maskin og varer pr. arbeidsrad, nøkkel fra `radTilleggNokkel`. */
export type TilleggPerRad = Record<string, BekreftDagTillegg>;

export type TilleggRad = { nokkel: string; dato: string; projectId: string; timer: number };

/** Arbeidsradene på åpne datoer som kan bære maskin og varer. */
export function tilleggRader(forslag: Dagsforslag): TilleggRad[] {
  const ut: TilleggRad[] = [];
  for (const d of forslag.datoer) {
    if (d.blokkert) continue;
    for (const r of d.rader) {
      const nokkel = radTilleggNokkel(d.dato, r);
      if (nokkel && r.timer > 0) ut.push({ nokkel, dato: d.dato, projectId: r.projectId, timer: r.timer });
    }
  }
  return ut;
}

function harLinjer(t: BekreftDagTillegg | undefined): boolean {
  return !!t && (t.maskiner.length > 0 || t.varer.length > 0);
}

/**
 * Nøkler med linjer der raden ikke finnes lenger (fjernet arbeid, færre rader,
 * sendt dato). Bekreft stopper på dem — linjene kastes aldri stille.
 */
export function tilleggUtenRad(forslag: Dagsforslag, perRad: TilleggPerRad): string[] {
  const finnes = new Set(tilleggRader(forslag).map((r) => r.nokkel));
  return Object.keys(perRad).filter((k) => harLinjer(perRad[k]) && !finnes.has(k));
}

/** Regel 2: maskinens egne timer ≤ radens (standard = radens, lavere tillatt). */
export function maskinerOverRaden(
  forslag: Dagsforslag,
  perRad: TilleggPerRad,
): Array<{ nokkel: string; projectId: string; radTimer: number; maskin: TilleggMaskin }> {
  return tilleggRader(forslag).flatMap((r) =>
    maskinerOverRad(r.timer, perRad[r.nokkel]?.maskiner ?? []).map((maskin) => ({
      nokkel: r.nokkel,
      projectId: r.projectId,
      radTimer: r.timer,
      maskin,
    })),
  );
}

/** Maskinene som skrives på datoens sedel, med radens prosjekt (for sum-vakten). */
export function maskinerForDato(forslag: Dagsforslag, perRad: TilleggPerRad, dato: string): TilleggMaskin[] {
  return tilleggRader(forslag)
    .filter((r) => r.dato === dato)
    .flatMap((r) => (perRad[r.nokkel]?.maskiner ?? []).map((m) => ({ ...m, projectId: r.projectId })));
}

/** Samme regel som serveren (`beregnMaskinBrudd`). Nye maskiner har ingen ECO. */
export function maskinBruddForTillegg(
  grunnlag: VaktGrunnlag | null,
  nyeMaskiner: TilleggMaskin[],
): MaskinBrudd[] {
  if (!grunnlag || nyeMaskiner.length === 0) return [];
  return beregnMaskinBrudd(
    grunnlag.timerRader,
    [
      ...grunnlag.maskinRader,
      ...nyeMaskiner.map((m) => ({ projectId: m.projectId, externalCostObjectId: null, timer: m.timer })),
    ],
    grunnlag.pauseMin,
  );
}
