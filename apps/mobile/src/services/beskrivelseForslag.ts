import { and, desc, eq, gte, lte, or, isNull, isNotNull } from "drizzle-orm";
import { dagsseddelLocal, sheetTimerLocal } from "../db/schema";
import type { LokalDb } from "./dagsforslagInput";

/* ============================================================================
 *  ORDRE 36a (spec § 3) — forslag til «Hva gjorde du i dag?» i Bekreft dag.
 *
 *  Kun lokal DB (offline). Kilde: arbeiderens egne arbeidsrader på samme
 *  prosjekt de siste 30 dagene t.o.m. `dato`. Reiserader har ingen beskrivelse.
 * ============================================================================ */

const VINDU_DAGER = 30;

/** ISO-dato `dager` før `dato` ("YYYY-MM-DD"), uten tidssone-forskyvning. */
function datoFoer(dato: string, dager: number): string {
  const [aa, mm, dd] = dato.split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(aa, mm - 1, dd - dager));
  return d.toISOString().slice(0, 10);
}

/** De `n` siste distinkte beskrivelsene for prosjektet, nyeste først. */
export function sisteBeskrivelser(
  db: LokalDb,
  p: { userId: string; projectId: string; dato: string; n?: number },
): string[] {
  const n = p.n ?? 2;
  const rader = db
    .select({ beskrivelse: sheetTimerLocal.beskrivelse })
    .from(sheetTimerLocal)
    .innerJoin(dagsseddelLocal, eq(sheetTimerLocal.dagsseddelId, dagsseddelLocal.id))
    .where(
      and(
        eq(dagsseddelLocal.userId, p.userId),
        eq(sheetTimerLocal.projectId, p.projectId),
        // Eldre rader (før M3) har erReise null — de er arbeidsrader.
        or(eq(sheetTimerLocal.erReise, false), isNull(sheetTimerLocal.erReise)),
        isNotNull(sheetTimerLocal.beskrivelse),
        gte(dagsseddelLocal.dato, datoFoer(p.dato, VINDU_DAGER)),
        lte(dagsseddelLocal.dato, p.dato),
      ),
    )
    .orderBy(desc(dagsseddelLocal.dato), desc(sheetTimerLocal.sistEndretLokalt))
    .all();
  const ut: string[] = [];
  for (const r of rader) {
    const tekst = r.beskrivelse?.trim();
    if (tekst && !ut.includes(tekst)) ut.push(tekst);
    if (ut.length >= n) break;
  }
  return ut;
}

/** Chipene: siste beskrivelser + aktivitetsnavnet (når det ikke alt er med). */
export function beskrivelseChips(siste: string[], aktivitetNavn: string | null): string[] {
  const navn = aktivitetNavn?.trim();
  return navn && !siste.includes(navn) ? [...siste, navn] : siste;
}
