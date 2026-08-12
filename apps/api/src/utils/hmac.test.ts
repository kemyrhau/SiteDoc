import { describe, it, expect } from "vitest";
import { signerFilSti, normaliserFilSti, vurderPrivatFilForesporsel } from "./hmac";

/**
 * Sikkerhetskontrakt for `/uploads/privat/*`-signaturgaten (hastefiks 2026-08-11).
 *
 * Bug: gate-hooken sjekket `startsWith` på RÅ url, mens fastifyStatic normaliserte
 * og serverte likevel. `/uploads/./privat/x`, `/uploads//privat/x` og
 * `/uploads/a/../privat/x` slapp forbi gaten → utløps-/signaturkravet omgått
 * (en lekket lenke kunne brukes «for alltid» ved å legge til `/./`).
 *
 * Testene treffer alle fire formene og krever avvisning på de tre omgåelsene,
 * pluss at kanoniske signerte lenker fortsatt verifiserer (compat).
 */

const KANONISK = "/uploads/privat/abc-123.jpg";

function query(signert: string): string {
  return signert.slice(signert.indexOf("?"));
}

describe("normaliserFilSti — kanonisk-kompatibilitet", () => {
  it("kanonisk sti er en no-op (signerte lenker forblir gyldige)", () => {
    expect(normaliserFilSti(KANONISK)).toBe(KANONISK);
  });

  it("kollapser alle tre omgåelsesformene til kanonisk", () => {
    expect(normaliserFilSti("/uploads//privat/abc-123.jpg")).toBe(KANONISK);
    expect(normaliserFilSti("/uploads/./privat/abc-123.jpg")).toBe(KANONISK);
    expect(normaliserFilSti("/uploads/x/../privat/abc-123.jpg")).toBe(KANONISK);
    expect(normaliserFilSti("/uploads/privat/%2e%2e/privat/abc-123.jpg")).not.toContain("..");
  });
});

describe("vurderPrivatFilForesporsel — gate", () => {
  it("kanonisk lenke med gyldig signatur → ok (compat bevist)", () => {
    const signert = signerFilSti(KANONISK, 60_000);
    expect(vurderPrivatFilForesporsel(signert)).toEqual({ type: "ok" });
  });

  it("cosmetisk /./ på en GYLDIG lenke slipper også gjennom (sjekken KJØRER nå)", () => {
    const q = query(signerFilSti(KANONISK, 60_000));
    expect(vurderPrivatFilForesporsel("/uploads/./privat/abc-123.jpg" + q)).toEqual({ type: "ok" });
  });

  // De tre omgåelsene UTEN gyldig signatur → 401 (var 200 før fiksen).
  it.each([
    ["/uploads//privat/abc-123.jpg"],
    ["/uploads/./privat/abc-123.jpg"],
    ["/uploads/x/../privat/abc-123.jpg"],
  ])("omgåelse uten signatur avvises: %s", (url) => {
    expect(vurderPrivatFilForesporsel(url)).toEqual({ type: "avvist", kode: 401 });
  });

  it("«for alltid»-utnyttelsen: UTLØPT signatur + /./ avvises (var kjernefeilen)", () => {
    // Korrekt signatur, men utløpt (negativ levetid → exp i fortiden).
    const utlopt = signerFilSti(KANONISK, -1000);
    const q = query(utlopt);
    expect(vurderPrivatFilForesporsel("/uploads/./privat/abc-123.jpg" + q)).toEqual({
      type: "avvist",
      kode: 401,
    });
  });

  it("kanonisk uten signatur → 401", () => {
    expect(vurderPrivatFilForesporsel(KANONISK)).toEqual({ type: "avvist", kode: 401 });
  });

  it("ikke-privat /uploads/* slippes uendret (ingen gate i Fase 1)", () => {
    expect(vurderPrivatFilForesporsel("/uploads/offentlig.jpg")).toEqual({ type: "slipp" });
  });

  it("ikke-uploads slippes", () => {
    expect(vurderPrivatFilForesporsel("/api/trpc/noe")).toEqual({ type: "slipp" });
  });

  it("ugyldig prosentkoding → 400 (kaster ikke)", () => {
    expect(vurderPrivatFilForesporsel("/uploads/privat/%ZZ.jpg")).toEqual({
      type: "avvist",
      kode: 400,
    });
  });

  it("dobbeltkodet %252e → slipp (symmetri med fastifyStatic — IKKE dekod i løkke)", () => {
    // `%252e` dekodes ÉN gang → `%2e` (literal tekst, ikke «.»), så prefikset
    // `/uploads/privat/` matcher ikke → slipp. Dette er RIKTIG: fastifyStatic
    // dekoder også bare én gang og slår opp et mappenavn «%2e» som ikke finnes
    // (404) — ingen fil kan nås. Gaten må ALDRI dekode mer aggressivt enn
    // serveren; da ville den beskytte en annen sti enn den som faktisk leses,
    // og asymmetrien vi nettopp fjernet ville komme tilbake speilvendt.
    expect(vurderPrivatFilForesporsel("/uploads/%252e/privat/abc-123.jpg")).toEqual({
      type: "slipp",
    });
  });
});
