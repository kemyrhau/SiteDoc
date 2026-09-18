import { describe, it, expect } from "vitest";
import { KC31_MAL } from "./seed-bibliotek";

/**
 * KC3.1 «Oppstøtting av trær» — portet fra feat/mal-kc31-revisjon (2026-09-13):
 * revidert fra 4 generiske felt til 8 mot NS 3420-K post KC3.1 c1–c4 + KC3.11.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis KC3.1 ikke bærer de åtte feltene.
 * Den låser antall, rekkefølge, felttyper og de tre fasene — mister porten et felt,
 * blir den rød.
 */

describe("KC3.1 – 8 felt mot NS 3420-K (portet fra feat/mal-kc31-revisjon)", () => {
  it("er malen for KC3.1", () => {
    expect(KC31_MAL.referanse).toBe("KC3.1");
    expect(KC31_MAL.kapittelKode).toBe("KC");
  });

  it("har nøyaktig åtte datafelt i riktig rekkefølge", () => {
    expect(KC31_MAL.felter).toHaveLength(8);
    expect(KC31_MAL.felter.map((f) => f.label)).toEqual([
      "Metode",
      "Materiell kontrollert mot beskrivelsen",
      "Solid og fast forankret – røtter uskadet",
      "Bundet uten fare for gnag eller barkskade",
      "Kronen kan bevege seg fritt",
      "Høyde: så lav som mulig – maks 1/3 av treets høyde",
      "Antall trær støttet (stk)",
      "Krav oppfylt iht. beskrivelsen",
    ]);
  });

  it("har korrekte felttyper (2 valg, 5 trafikklys, 1 heltall)", () => {
    expect(KC31_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "list_single",
      "traffic_light",
      "traffic_light",
      "traffic_light",
      "traffic_light",
      "integer",
      "traffic_light",
    ]);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (ETTER bærer konklusjon + mengde)", () => {
    expect(KC31_MAL.felter.map((f) => f.fase)).toEqual([
      "FØR",
      "FØR",
      "UNDER",
      "UNDER",
      "UNDER",
      "UNDER",
      "ETTER",
      "ETTER",
    ]);
  });

  it("mengdefeltet er heltall i stk (ikke desimal)", () => {
    const mengde = KC31_MAL.felter[6]!;
    expect(mengde.type).toBe("integer");
    expect(mengde.config?.enhet).toBe("stk");
  });
});
