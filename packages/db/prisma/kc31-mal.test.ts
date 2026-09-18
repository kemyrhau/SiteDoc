import { describe, it, expect } from "vitest";
import { KC31_MAL } from "./seed-bibliotek";

/**
 * KC3.1 «Oppstøtting av trær» — revidert til NI felt mot NS 3420-K post KC3.1 c1–c4 + KC3.11.
 * (Korreksjon 2026-09-18: 8→9. Nytt sesongkontroll-felt i ETTER + omdøpt konklusjon —
 * Kenneths ferdigbygde versjon, avlest av cowork.)
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis KC3.1 ikke bærer de ni feltene.
 * Den låser antall, rekkefølge, felttyper og de tre fasene — mister porten et felt,
 * blir den rød.
 */

describe("KC3.1 – 9 felt mot NS 3420-K", () => {
  it("er malen for KC3.1", () => {
    expect(KC31_MAL.referanse).toBe("KC3.1");
    expect(KC31_MAL.kapittelKode).toBe("KC");
  });

  it("har nøyaktig ni datafelt i riktig rekkefølge", () => {
    expect(KC31_MAL.felter).toHaveLength(9);
    expect(KC31_MAL.felter.map((f) => f.label)).toEqual([
      "Metode",
      "Materiell kontrollert mot beskrivelsen",
      "Solid og fast forankret – røtter uskadet",
      "Bundet uten fare for gnag eller barkskade",
      "Kronen kan bevege seg fritt",
      "Høyde: så lav som mulig – maks 1/3 av treets høyde",
      "Antall trær støttet (stk)",
      "Kontrollert etter 1. vekstsesong – etterstrammet/justert",
      "Krav oppfylt og dokumentasjon levert",
    ]);
  });

  it("har korrekte felttyper (2 valg, 6 trafikklys, 1 heltall)", () => {
    expect(KC31_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "list_single",
      "traffic_light",
      "traffic_light",
      "traffic_light",
      "traffic_light",
      "integer",
      "traffic_light",
      "traffic_light",
    ]);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (ETTER bærer mengde, sesongkontroll, konklusjon)", () => {
    expect(KC31_MAL.felter.map((f) => f.fase)).toEqual([
      "FØR",
      "FØR",
      "UNDER",
      "UNDER",
      "UNDER",
      "UNDER",
      "ETTER",
      "ETTER",
      "ETTER",
    ]);
  });

  it("mengdefeltet er heltall i stk (ikke desimal)", () => {
    const mengde = KC31_MAL.felter[6]!;
    expect(mengde.type).toBe("integer");
    expect(mengde.config?.enhet).toBe("stk");
  });

  it("sesongkontroll-feltet er trafikklys, foran konklusjonen", () => {
    expect(KC31_MAL.felter[7]!.label).toBe("Kontrollert etter 1. vekstsesong – etterstrammet/justert");
    expect(KC31_MAL.felter[7]!.type).toBe("traffic_light");
    expect(KC31_MAL.felter[8]!.label).toBe("Krav oppfylt og dokumentasjon levert");
  });
});
