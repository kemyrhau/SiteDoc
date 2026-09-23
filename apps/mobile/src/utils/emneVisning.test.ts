import { describe, it, expect } from "vitest";
import { emneVisning } from "./emneVisning";

/**
 * Rød-først (ordre opprett-uten-modal, § 7): emnet skal inn i dokumentet på mobil,
 * synlig ØVERST også når det er TOMT — i dag finnes emne kun i opprett-modalen, så
 * detaljskjermen viser ingenting. Denne rene helperen avgjør emne-feltets
 * visningstilstand og LÅSER at et tomt emne gir en synlig tilstand (ikke `null`),
 * både redigerbart og i lesemodus for andre. RN-komponenten (EmneFelt) rendrer ut
 * fra denne — mobil-vitest kjører kun ren TS, så visningslogikken bevises her.
 */
describe("emneVisning — emne-feltets tilstand på mobil-detaljskjermen", () => {
  it("utfylt emne (redigerbar): viser teksten og tillater redigering", () => {
    expect(emneVisning("Fasade nord", false)).toEqual({
      modus: "utfylt",
      tekst: "Fasade nord",
      kanRedigere: true,
    });
  });

  it("utfylt emne (lesemodus for andre): viser teksten, men ikke redigerbart", () => {
    expect(emneVisning("Fasade nord", true)).toEqual({
      modus: "utfylt",
      tekst: "Fasade nord",
      kanRedigere: false,
    });
  });

  it("TOMT emne + redigerbar: synlig som «legg til»-tilstand (ikke skjult)", () => {
    expect(emneVisning(null, false)).toEqual({ modus: "tomt-redigerbar" });
    // Tom streng behandles som tomt.
    expect(emneVisning("", false)).toEqual({ modus: "tomt-redigerbar" });
  });

  it("TOMT emne + lesemodus: synlig som «Ingen emne»-tilstand (ikke skjult, ikke null)", () => {
    const v = emneVisning(null, true);
    expect(v).toEqual({ modus: "tomt-lesemodus" });
    // Kjernen i § 7: feltet HAR en synlig tilstand når det er tomt — aldri usynlig.
    expect(v).not.toBeNull();
  });
});
