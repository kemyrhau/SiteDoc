import { describe, it, expect } from "vitest";
import {
  ANNOTERING_LASTE_TIDSGRENSE_MS,
  statusEtterTidsgrense,
  skalLagreForFornyelse,
  annoteringsUtfallLogg,
} from "./annoteringsStatus";

// ORDRE 3 (telefon 74d447fa, 2026-10-29): annotert bilde åpnet andre gang ble stående på
// «Laster bildet …» for alltid, eller ga «kunne ikke åpnes» uten at noen visste hvilken gren.

describe("🔴 F1c — tidsgrense på «laster»", () => {
  it("er 15 s", () => {
    expect(ANNOTERING_LASTE_TIDSGRENSE_MS).toBe(15_000);
  });

  it("«laster» blir «feil» når tiden er ute; andre tilstander røres ikke", () => {
    expect(statusEtterTidsgrense("laster")).toBe("feil");
    expect(statusEtterTidsgrense("klar")).toBe("klar");
    expect(statusEtterTidsgrense("fornyer")).toBe("fornyer");
    expect(statusEtterTidsgrense("feil")).toBe("feil");
  });
});

describe("🔴 F1b — ventende lagring før fornyelse", () => {
  const grunn = { kanRedigere: true, fornyerAktiv: false };

  it("lagrer når dokumentet kan redigeres og fornyeren ikke alt går", () => {
    expect(skalLagreForFornyelse(grunn)).toBe(true);
  });

  it("ingen lagring på lest eller låst dokument", () => {
    expect(skalLagreForFornyelse({ ...grunn, kanRedigere: false })).toBe(false);
  });

  it("ingen dobbeltlagring: går fornyeren alt, er lagringen gjort", () => {
    expect(skalLagreForFornyelse({ ...grunn, fornyerAktiv: true })).toBe(false);
  });
});

describe("🔴 utfallslogg — sier hvilken gren som slo til, uten URL-en", () => {
  it("navngir grunn og kildetype, og status når den finnes", () => {
    expect(annoteringsUtfallLogg("trengerSignatur", { ok: false, grunn: "trengerSignatur" })).toBe(
      "[annotering] bilde: trengerSignatur (kilde trengerSignatur)",
    );
    expect(annoteringsUtfallLogg("server", { ok: false, grunn: "nedlastingFeilet", status: 403 })).toBe(
      "[annotering] bilde: nedlastingFeilet 403 (kilde server)",
    );
    expect(annoteringsUtfallLogg("lokal", { ok: true, dataUrl: "data:image/jpeg;base64,AAAA" })).toBe(
      "[annotering] bilde: ok (kilde lokal)",
    );
  });

  it("lekker aldri signaturen eller dataen", () => {
    const linje = annoteringsUtfallLogg("server", { ok: true, dataUrl: "data:image/jpeg;base64,SIG" });
    expect(linje).not.toContain("SIG");
    expect(linje).not.toContain("data:");
  });
});
