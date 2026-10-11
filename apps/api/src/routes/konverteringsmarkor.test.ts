import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { hentKodeversjon, byggKonverteringMarkor } from "./tegning";

/**
 * Konverteringsmarkør (2026-10-11): BEVISER at en konvertering faktisk kjørte, med hvilken
 * kode/motor. Markøren skrives der koden kjører — web-containeren for nettleser-opplasting
 * (`NEXT_PUBLIC_BUILD_SHA`), api-containeren for mobil (`GIT_SHA`).
 *
 * 🔴 Test (c) «stille tomhet forbudt»: en konvertering i prod/test skal ALDRI gi en tom
 * `kodeversjon`. Disse testene FEILER hvis sha-en kan skjule seg som tom streng.
 */

const lagret = {
  GIT_SHA: process.env.GIT_SHA,
  NEXT_PUBLIC_BUILD_SHA: process.env.NEXT_PUBLIC_BUILD_SHA,
  NODE_ENV: process.env.NODE_ENV,
};

beforeEach(() => {
  delete process.env.GIT_SHA;
  delete process.env.NEXT_PUBLIC_BUILD_SHA;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env.GIT_SHA = lagret.GIT_SHA;
  process.env.NEXT_PUBLIC_BUILD_SHA = lagret.NEXT_PUBLIC_BUILD_SHA;
  process.env.NODE_ENV = lagret.NODE_ENV;
});

describe("hentKodeversjon — build-sha der koden kjører", () => {
  it("leser GIT_SHA (api-container)", () => {
    process.env.GIT_SHA = "2034396e";
    expect(hentKodeversjon()).toBe("2034396e");
  });

  it("faller tilbake til NEXT_PUBLIC_BUILD_SHA (web-container) når GIT_SHA mangler", () => {
    process.env.NEXT_PUBLIC_BUILD_SHA = "ba70fa4a";
    expect(hentKodeversjon()).toBe("ba70fa4a");
  });

  it("prod/test uten sha → «ukjent» + logget feil, ALDRI tom streng (stille tomhet)", () => {
    process.env.NODE_ENV = "production";
    const feil = vi.spyOn(console, "error").mockImplementation(() => {});
    const v = hentKodeversjon();
    expect(v).toBe("ukjent");
    expect(v).not.toBe("");
    expect(feil).toHaveBeenCalledOnce();
  });

  it("lokal dev uten sha → «dev»", () => {
    process.env.NODE_ENV = "development";
    expect(hentKodeversjon()).toBe("dev");
  });
});

describe("byggKonverteringMarkor — kodeversjon aldri tom (test c)", () => {
  it("test-miljø (sha satt) gir ikke-tom kodeversjon + riktig motor", () => {
    process.env.GIT_SHA = "2034396e";
    const m = byggKonverteringMarkor("egen");
    expect(m.kodeversjon).toBeTruthy();
    expect(m.kodeversjon).not.toBe("");
    expect(m.motor).toBe("egen");
    expect(() => new Date(m.konvertertTid).toISOString()).not.toThrow();
  });

  it("selv uten sha i prod er kodeversjon ikke-tom (ukjent, ikke «»)", () => {
    process.env.NODE_ENV = "production";
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(byggKonverteringMarkor("pdf").kodeversjon).not.toBe("");
  });
});
