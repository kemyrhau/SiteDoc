/**
 * Arkivmal — grenseresolver trinn 3 del A: injiser kravsnapshot på tallfelt.
 *
 * `packages/pdf` er null-avhengig og kan ikke regne grenser. Derfor bygger dette api-laget
 * (som allerede importerer @sitedoc/shared, jf. sammenstilling.ts) et snapshot
 * `{ kravTekst, status }` SIDESTILT med verdien på hvert tallfelt med grense, og
 * `felt.ts`/`skalarCelle` rendrer det som ferdige strenger — samme oppslagsmønster som
 * `tegningsOppslag`/`signaturOppslag`, men lagret på verdi-objektet (ikke på PdfConfig) fordi
 * en repeater-kolonne har ÉN verdi PER RAD — et objektId-nøklet oppslag kan ikke bære N rader.
 *
 * Rekonstruerer fra malen via den delte resolveren `løsGrense`. Skriver kun når feltet IKKE
 * allerede har et snapshot: del B lagrer et frosset snapshot ved lagring (kravet slik det var da
 * målingen ble gjort), og det skal vinne over rekonstruksjonen her.
 */

import { normaliserRad } from "@sitedoc/pdf";
import type { TreObjekt, FeltVerdi, GrenseSnapshot } from "@sitedoc/pdf";
import { løsGrense, grenseStatus, formaterGrense, harGrense, beregnAvvik } from "@sitedoc/shared";

export const TALL_TYPER = new Set(["integer", "decimal", "calculation"]);

// Retningstekst i arkiv-PDF (norsk — pakken er ikke i18n; se felt.ts s/h-regel).
const AVVIK_RETNING_PDF: Record<"under" | "over" | "utenfor_toleranse", string> = {
  under: "under krav",
  over: "over krav",
  utenfor_toleranse: "utenfor toleranse",
};

/**
 * Kravsnapshot for ett tallfelt — den delte kjernen for både PDF-rekonstruksjon (del A) og
 * server-frys ved lagring (del B), så resolveren ikke bygges to ganger med to former.
 * `undefined` når feltet ikke har noen grense. `status` er `null` for tom/ikke-tall (kravet
 * vises likevel, F7).
 */
export function beregnGrenseSnapshot(
  config: Record<string, unknown>,
  forelderVerdi: unknown,
  verdi: unknown,
): GrenseSnapshot | undefined {
  const grense = løsGrense({ config }, forelderVerdi);
  if (!harGrense(grense)) return undefined;
  const snapshot: GrenseSnapshot = {
    kravTekst: formaterGrense(grense),
    status: grenseStatus(verdi, grense),
  };
  // Målt avvik ved brudd (trinn 3 del C): «Avvik: 4 mm over krav» — beregnet, står i arkivet.
  const avvik = beregnAvvik(verdi, grense);
  if (avvik) {
    const tall = grense.enhet ? `${avvik.avvik} ${grense.enhet}` : String(avvik.avvik);
    snapshot.avvikTekst = `Avvik: ${tall} ${AVVIK_RETNING_PDF[avvik.retning]}`;
  }
  return snapshot;
}

/**
 * Injiser kravsnapshot på tallfelt i `data`, rekursivt (rot + repeater-rader + betingede barn).
 * Muterer data-treet — kjør på det data-objektet `byggInnhold` faktisk rendrer (`dataInlinet`).
 *
 * `data` er rad-scope ved rekursjon inn i en repeater, så `styrendeFeltId` (Vei B) slås opp mot
 * riktig kontekst: søsken i samme rad, eller rot. `løsGrense` uten styrendeFeltId/varianter gir
 * feltets standardgrense (bakoverkompatibelt) — så snapshotet fungerer også uten Vei B.
 */
export function injiserGrenseSnapshot(
  objekter: TreObjekt[],
  data: Record<string, FeltVerdi>,
): void {
  for (const obj of objekter) {
    if (obj.type === "repeater") {
      const barn = obj.children ?? [];
      const rader = Array.isArray(data[obj.id]?.verdi)
        ? (data[obj.id]!.verdi as unknown[]).map(normaliserRad)
        : [];
      // Repeater-barn har verdiene sine i radens `felter` — eget data-scope per rad.
      for (const rad of rader) injiserGrenseSnapshot(barn, rad.felter);
    } else if (obj.children && obj.children.length > 0) {
      // Seksjoner + betingede kontainere (list/tallfelt med barn): barnas verdier ligger
      // FLATT i samme scope (kun repeateren nester) → rekurser med samme `data`.
      injiserGrenseSnapshot(obj.children, data);
    }

    if (!TALL_TYPER.has(obj.type)) continue;
    const felt = data[obj.id];
    if (!felt || typeof felt !== "object") continue;
    if (felt.grenseSnapshot) continue; // del B: frosset snapshot vinner over rekonstruksjon

    const styrendeId = obj.config.styrendeFeltId;
    const forelderVerdi = typeof styrendeId === "string" ? data[styrendeId]?.verdi : undefined;
    const snapshot = beregnGrenseSnapshot(obj.config, forelderVerdi, felt.verdi);
    if (snapshot) felt.grenseSnapshot = snapshot;
  }
}
