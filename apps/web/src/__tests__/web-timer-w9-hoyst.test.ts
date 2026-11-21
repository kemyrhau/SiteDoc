import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * w9 (2c): «høyst X t» ved maskinens timer-felt på PC. Regelen selv er testet i
 * `packages/shared/src/utils/maskinKapasitet.test.ts` (maskinHoystPerRad); her vaktes at
 * de fire PC-vinduene bruker den, sperrer lagring over grensen, og at infolinja
 * «Arbeid i gruppen …» er borte fra web (nøklene står — mobilen bruker dem til w9m).
 */

const les = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");
const DAGSSIDE = "../app/dashbord/timer/[id]/page.tsx";
const REDIGER = "../components/attestering/RedigerRadModal.tsx";
const REGISTRERING = "../components/attestering/RegistreringPanel.tsx";

describe("w9 — «høyst» på PC", () => {
  it.each([DAGSSIDE, REDIGER, REGISTRERING])("%s viser timer.maskin.hoyst med den delte regelen", (fil) => {
    const kilde = les(fil);
    expect(kilde).toContain('"timer.maskin.hoyst"');
    expect(kilde).toContain("maskinHoystPerRad");
    expect(kilde).toContain("overMaskinHoyst");
  });

  it("🔴 infolinja «Arbeid i gruppen» er borte fra web", () => {
    for (const fil of [DAGSSIDE, REDIGER, REGISTRERING]) {
      const kilde = les(fil);
      expect(kilde).not.toContain("timer.maskin.kapasitet");
      expect(kilde).not.toContain("timer.maskinSeksjon.kapasitet");
      expect(kilde).not.toContain("maskinBucketKapasitet");
      expect(kilde).not.toContain("overstigerMaskinTak");
    }
  });

  it("dagssidens maskinvindu og timerad-vindu sperrer Lagre over grensen", () => {
    const kilde = les(DAGSSIDE);
    expect(kilde).toMatch(/disabled=\{lagrer \|\| !vehicleId \|\| !timer \|\| overHoyst\}/);
    // w3b: i prosjektkort-modus gjelder maskindelens sperre (kortOverHoyst), ellers w9-sperren.
    expect(kilde).toMatch(/!tilTid \|\|\s*\/\/ w9 \(2c\): maskinen over jobbens «høyst»\.\s*\(!kortModus && maskinOverHoyst\) \|\|\s*\/\/ w3b: [^\n]*\s*kortOverHoyst/);
  });

  it("Rediger sedel sperrer Lagre over grensen", () => {
    expect(les(REDIGER)).toMatch(/disabled=\{lagre\.isPending \|\| !harEndringer \|\| maskinOverHoyst\}/);
  });

  it("den åpne registreringen lagrer ikke en retting over grensen", () => {
    expect(les(REGISTRERING)).toMatch(/if \(over\) return;\s*onLagre\?\.\(v,/);
    // w15g: maskintimene rettes i vinduet bak ✎; over «høyst» er «Lagre» sperret.
    expect(les("../components/attestering/LinjeRettVindu.tsx")).toMatch(/tall\.type === "over"\) return \{ type: "sperret" \}/);
  });
});
