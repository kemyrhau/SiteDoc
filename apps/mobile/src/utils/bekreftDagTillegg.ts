import { and, eq, inArray } from "drizzle-orm";
import {
  beregnMaskinBrudd,
  type MaskinBrudd,
  type MaskinKapasitetRad,
} from "@sitedoc/shared";
import { dagsseddelLocal, sheetTimerLocal, sheetMachineLocal } from "../db/schema";
import type { LokalDb } from "../services/dagsforslagInput";
import type { Dagsforslag } from "./dagsforslag";

/**
 * L3-D «Maskin og varer» i `/timer/bekreft-dag` (spec § 3.5, ORDRE 31).
 *
 * Tilleggene holdes i skjermens minne og skrives FØRST ved [Bekreft og lagre],
 * på start-segmentets sedel (vedtak C). Er start-sedelen sendt, skrives ingen.
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
 * KUN LESING. Grunnlaget serveren validerer på etter Bekreft: start-sedelens
 * eksisterende timer- og maskinrader (append på draft/returned) + forslagets
 * rader for start-datoen. null = ingen start-sedel å skrive på (sendt/ingen).
 */
export function vaktGrunnlag(
  db: LokalDb,
  userId: string,
  forslag: Dagsforslag,
): VaktGrunnlag | null {
  const d = forslag.datoer.find((x) => x.erStartSegment);
  if (!d || d.blokkert || forslag.prosjektId == null) return null;
  const nyeTimer = d.rader.map((r) => ({
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
 * Dom (57) m2/m3. `startSendt`: start-sedelen er sendt mens senere datoer er
 * åpne — tilleggene har ingen sedel å skrives på. `varerTillatt`: startdatoen
 * har minst én timer-rad (ny eller eksisterende) på prosjektet; ellers kan
 * varen ikke kobles til sedelen (`kortDagsseddelId`) og knappen skjules.
 */
export type TilleggTilstand = { startSendt: boolean; varerTillatt: boolean };

export function tilleggTilstand(
  forslag: Dagsforslag,
  grunnlag: VaktGrunnlag | null,
  projectId: string,
): TilleggTilstand {
  const startSendt = forslag.datoer.find((d) => d.erStartSegment)?.blokkert === true;
  const varerTillatt =
    !startSendt && grunnlag != null && grunnlag.timerRader.some((r) => r.projectId === projectId);
  return { startSendt, varerTillatt };
}

/** Fjerner tillegg tilstanden ikke tillater. Uendret → samme objekt. */
export function rensTillegg(tillegg: BekreftDagTillegg, tilstand: TilleggTilstand): BekreftDagTillegg {
  const maskiner = tilstand.startSendt ? [] : tillegg.maskiner;
  const varer = tilstand.varerTillatt ? tillegg.varer : [];
  return maskiner.length === tillegg.maskiner.length && varer.length === tillegg.varer.length
    ? tillegg
    : { maskiner, varer };
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
