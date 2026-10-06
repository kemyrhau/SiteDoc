import { describe, it, expect } from "vitest";
import { signerFilSti, kanoniserForSletting } from "../utils/hmac";

/**
 * 🔴 D2-invariant (S1 Fase 1b): `bilde.slettMedUrl` gjør EKSAKT-streng-match mot
 * lagret `fileUrl` (kanonisk, uten query). Nå som HELE `/uploads/` signeres ved
 * emisjon, mottar klienten en signert URL (`?exp=&sig=`) — og kan sende den
 * tilbake til sletting. `kanoniserForSletting` (brukt av `slettMedUrl`) MÅ
 * redusere den til den lagrede kanoniske formen, ellers finner `deleteMany` ingen
 * rad og slettingen feiler STILLE.
 *
 * Fjernes query-strippingen i `kanoniserForSletting`, blir denne testen RØD.
 */
describe("kanoniserForSletting — D2: signert URL matcher lagret kanonisk", () => {
  it("en URL som har passert emisjonssignering reduseres til lagret form (privat)", () => {
    const lagret = "/uploads/privat/abc-123.jpg";
    const somKlientenMottok = signerFilSti(lagret); // bærer ?exp=&sig=
    expect(somKlientenMottok).not.toBe(lagret); // forsikre oss om at den ER signert
    expect(kanoniserForSletting(somKlientenMottok)).toBe(lagret);
  });

  it("gjelder også ikke-privat /uploads/ (signeres nå i Fase 1b)", () => {
    const lagret = "/uploads/apen.jpg";
    expect(kanoniserForSletting(signerFilSti(lagret))).toBe(lagret);
  });

  it("kanonisk URL uten query er en no-op (baklengs-kompat)", () => {
    expect(kanoniserForSletting("/uploads/privat/abc-123.jpg")).toBe("/uploads/privat/abc-123.jpg");
  });

  it("sti-varianter (/./ // ..) reduseres til kanonisk", () => {
    expect(kanoniserForSletting("/uploads/./privat/x.jpg")).toBe("/uploads/privat/x.jpg");
    expect(kanoniserForSletting("/uploads//privat/x.jpg")).toBe("/uploads/privat/x.jpg");
    expect(kanoniserForSletting("/uploads/a/../privat/x.jpg")).toBe("/uploads/privat/x.jpg");
  });

  it("ugyldig prosentkoding → beholdes rå (matcher da ikke, ingen sletting)", () => {
    expect(kanoniserForSletting("/uploads/privat/%ZZ.jpg")).toBe("/uploads/privat/%ZZ.jpg");
  });
});
