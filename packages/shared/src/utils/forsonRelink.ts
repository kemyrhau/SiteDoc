import { parForslagMotSedel, type ForsonRad } from "./forsonValg";

/**
 * Telefontest B funn 5 — linjer (maskin, og på mobil lokale varer) som hang på en
 * forslagsrad, følger raden som vant forsoningen.
 *
 * Kun V19-A-overlapp-slots med ulike id-er gir relink: id-parede V19.9-grunner har samme
 * id på begge sider, og forslag uten motpart blir nye rader (utenfor planen). Paringen
 * gjenbruker `parForslagMotSedel`, så relinken aldri kan pare ulikt fra skjermen.
 */

/** Et forslag (fra-id) som er slått inn i serverraden `tilId`. */
export interface RelinkPar {
  fra: ForsonRad;
  tilId: string;
}

/** Minste utsnitt av en linje (SheetMachine o.l.) som relinken leser. */
export interface RelinkLinje {
  id: string;
  sheetTimerId: string | null;
  /** null = linjen arver sedelens prosjekt (mobilens lokale maskinrader). */
  projectId: string | null;
  byggeplassId: string | null;
  externalCostObjectId: string | null;
}

export interface RelinkData {
  sheetTimerId: string;
  projectId?: string;
  byggeplassId?: string | null;
  externalCostObjectId?: string | null;
}

export interface RelinkPlan {
  id: string;
  fra: string;
  til: string;
  data: RelinkData;
}

export function parForRelink(
  sedelRader: readonly ForsonRad[],
  forslag: readonly ForsonRad[],
): RelinkPar[] {
  const par: RelinkPar[] = [];
  for (const s of parForslagMotSedel(sedelRader, forslag)) {
    if (s.forslag && s.sedel && s.forslag.id !== s.sedel.id) {
      par.push({ fra: s.forslag, tilId: s.sedel.id });
    }
  }
  return par;
}

const FELT = ["projectId", "byggeplassId", "externalCostObjectId"] as const;

/**
 * `sheetTimerId` relinkes alltid. Prosjekt, byggeplass og underprosjekt overskrives KUN når
 * linjens verdi var lik forslagets (linjen «fulgte» raden) og raden som vant har en annen
 * verdi. En linje som eksplisitt sto på noe annet, beholder sitt. Finnes ikke raden som vant
 * i sluttsettet, relinkes ingenting (ingen kobling diktes).
 */
export function planleggLinjeRelink(
  par: readonly RelinkPar[],
  linjer: readonly RelinkLinje[],
  sluttRader: readonly ForsonRad[],
): RelinkPlan[] {
  const parPaaFra = new Map(par.map((p) => [p.fra.id, p]));
  const sluttPaaId = new Map(sluttRader.map((r) => [r.id, r]));
  const plan: RelinkPlan[] = [];
  for (const l of linjer) {
    if (!l.sheetTimerId) continue;
    const p = parPaaFra.get(l.sheetTimerId);
    if (!p) continue;
    const slutt = sluttPaaId.get(p.tilId);
    if (!slutt) continue;
    const data: RelinkData = { sheetTimerId: p.tilId };
    for (const f of FELT) {
      const linjeVerdi = l[f] ?? null;
      const forslagVerdi = p.fra[f] ?? null;
      const sluttVerdi = slutt[f] ?? null;
      if (linjeVerdi === forslagVerdi && sluttVerdi !== linjeVerdi) {
        if (f === "projectId") {
          if (sluttVerdi) data.projectId = sluttVerdi;
        } else {
          data[f] = sluttVerdi;
        }
      }
    }
    plan.push({ id: l.id, fra: l.sheetTimerId, til: p.tilId, data });
  }
  return plan;
}
