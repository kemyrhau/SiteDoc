import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";

const HER = dirname(fileURLToPath(import.meta.url));

// Rotårsak-vakt (2026-10-07): sjekklisten frøs etter «+ Oppgave» → tilbake, fjerde
// gang i samme klasse (a29f89b2 · df86b817 · d4a76020 · 28e55ed5). Rotårsaken var en
// SPEIL-state (`internSynlig`) som hang én render etter `synlig`: når auto-opprett
// fullførte og `synlig` ble satt `false`, ble en native `<Modal visible={true}>`
// montert i én render samtidig med navigasjonen og etterlot en usynlig, touch-
// fangende modal-host = frys.
//
// Fiksen: `visible` bindes DIREKTE til `synlig`-propen, uten speil-state. Da kan
// modalen aldri rendres synlig etter at `synlig` er satt `false`.
//
// Harnessen er `environment: "node"` (ingen RN-render), så vi vokter rotårsaken på
// kildenivå: ingen `internSynlig`-speil, og `visible` bundet til `synlig`. FEILER på
// dagens kode (som hadde speilet) — grønn etter fiksen.

function les(rel: string): string {
  return readFileSync(join(HER, rel), "utf-8");
}

describe("OpprettDokumentModal — synlighet uten speil-state (frys-rotårsak)", () => {
  const kilde = les("./OpprettDokumentModal.tsx");

  it("har ingen `internSynlig`-speil-state", () => {
    // Speilet (state + setter + mirror-effekt) skal være borte i sin helhet.
    expect(kilde).not.toMatch(/internSynlig/);
    expect(kilde).not.toMatch(/setInternSynlig/);
  });

  it("binder <Modal visible> direkte til `synlig`-propen", () => {
    expect(kilde).toMatch(/visible=\{synlig\}/);
  });
});
