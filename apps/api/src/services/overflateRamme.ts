/**
 * Koordinatramme for lagrede overflater + ramme-vakt (§ F).
 *
 * En lagret overflate MÅ bære hvilken ramme den er i, og systemet MÅ nekte å
 * sammenligne to overflater som ikke deler ramme — ellers blir volumet feil
 * UTEN at noe protesterer (samme klasse som -GLOBAL_SHIFT-risikoen).
 */

import { TRPCError } from "@trpc/server";

/** LandXML-flater deler bøtte, slik at LandXML-vs-LandXML fortsatt kan sammenlignes (som før). */
export const RAMME_LANDXML = "landxml";

/**
 * 🔴 PROVISORISK ramme for LAS-punktskyer i steg 1.
 *
 * En drone-LAS er absolutt UTM (scale+offset bærer det), men den faktiske sonen
 * (coordinateSystem) detekteres FØRST i steg 3. Inntil da får alle LAS denne
 * felles verdien, slik at to skyer av samme site (nå vs. om 2 uker) KAN
 * sammenlignes — hele formålet med masseregnskapet.
 *
 * ⚠️ Den er MIDLERTIDIG. Steg 3 skal erstatte den med detektert coordinateSystem.
 * `PROVISORISKE_RAMMER` + testen `overflateRamme.test.ts` gjør at den ikke kan bli
 * permanent i det stille (mønsteret fra users.ny_navigasjon: et flagg som overlevde
 * utrullingen, 10 identiske verdier, null lesere, ingen alarm).
 */
export const RAMME_LAS_PROVISORISK = "las-utm";

/**
 * Rammer som er PROVISORISKE og skal erstattes i en senere fase. Fjernes en verdi
 * herfra mens koden fortsatt PRODUSERER den, feiler overflateRamme.test.ts — det
 * tvinger et bevisst valg i steg 3 i stedet for en stille arv.
 */
export const PROVISORISKE_RAMMER: ReadonlySet<string> = new Set([RAMME_LAS_PROVISORISK]);

export function erProvisoriskRamme(ramme: string): boolean {
  return PROVISORISKE_RAMMER.has(ramme);
}

/**
 * Utled ramme for en punktsky-overflate.
 * @param coordinateSystem  detektert system (steg 3) — null i steg 1 → provisorisk.
 */
export function utledRammeForPunktsky(coordinateSystem: string | null | undefined): string {
  const s = coordinateSystem?.trim();
  return s ? s : RAMME_LAS_PROVISORISK;
}

/** Utled ramme for en LandXML-overflate. */
export function utledRammeForLandXML(): string {
  return RAMME_LANDXML;
}

/** Ren sjekk: deler to overflater samme ramme? */
export function samsvarerRamme(a: string, b: string): boolean {
  return a === b;
}

/**
 * Ramme-vakt: kast hvis to overflater ikke deler ramme. Kalles på server FØR
 * en kutt/fyll-sammenligning slippes gjennom. Fjernes dette kallet, går en
 * sammenligning på tvers av rammer gjennom med et feil volumtall — derfor har
 * ramme-vakten en integrasjonstest som feiler nettopp da.
 */
export function krevSammeRamme(rammeA: string, rammeB: string): void {
  if (!samsvarerRamme(rammeA, rammeB)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Overflatene ligger i ulike koordinatrammer og kan ikke sammenlignes.",
    });
  }
}
