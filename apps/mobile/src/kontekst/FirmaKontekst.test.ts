import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Timer «ikke ansatt» (ordre 2026-11-04 (8)): ansatt-status leses fra fersk query-data
 * først, så sist lagrede liste, ellers `null` (ukjent → dagens atferd).
 */

const lager = vi.hoisted(() => new Map<string, string>());

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: async (k: string) => lager.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void lager.set(k, v),
  deleteItemAsync: async (k: string) => void lager.delete(k),
}));
vi.mock("../lib/trpc", () => ({ trpc: {} }));
vi.mock("../providers/AuthProvider", () => ({ useAuth: () => ({ bruker: null }) }));
vi.mock("expo-auth-session", () => ({}));
vi.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: () => {} }));
vi.mock("../config/auth", () => ({ AUTH_CONFIG: { apiUrl: "http://api.test" }, MICROSOFT_AUTH: {} }));
vi.mock("../services/tegningKatalog", () => ({ tomTegningSpeil: () => {} }));

import { erAnsattI, hentLagretAnsattStatus } from "./FirmaKontekst";
import { ANSATT_FIRMA_KEY, loggUt } from "../services/auth";

beforeEach(() => lager.clear());

describe("erAnsattI — query, så lagret, ellers null", () => {
  it("query-data vinner over lagret liste", () => {
    expect(erAnsattI("o1", [{ id: "o1", erAnsatt: false }], ["o1"])).toBe(false);
    expect(erAnsattI("o1", [{ id: "o1", erAnsatt: true }], [])).toBe(true);
  });

  it("uten query-svar → lagret liste", () => {
    expect(erAnsattI("o1", [], ["o1"])).toBe(true);
    expect(erAnsattI("o2", [], ["o1"])).toBe(false);
  });

  it("eldre API uten feltet → ukjent, aldri «ikke ansatt»", () => {
    expect(erAnsattI("o1", [{ id: "o1" }], null)).toBeNull();
  });

  it("ingenting kjent / ingen org → null", () => {
    expect(erAnsattI("o1", [], null)).toBeNull();
    expect(erAnsattI(null, [{ id: "o1", erAnsatt: true }], ["o1"])).toBeNull();
  });
});

describe("hentLagretAnsattStatus", () => {
  it("leser den persisterte lista", async () => {
    lager.set("sitedoc_ansatt_firmaer", JSON.stringify(["o1"]));
    expect(await hentLagretAnsattStatus("o1")).toBe(true);
    expect(await hentLagretAnsattStatus("o2")).toBe(false);
  });

  it("ingenting lagret / ødelagt verdi → null", async () => {
    expect(await hentLagretAnsattStatus("o1")).toBeNull();
    lager.set("sitedoc_ansatt_firmaer", "{ikke json");
    expect(await hentLagretAnsattStatus("o1")).toBeNull();
  });
});

describe("utlogging — ansatt-listen følger brukeren (RETUR dom 22)", () => {
  it("🔴 etter loggUt er lagret ansatt-status ukjent, ikke forrige brukers liste", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    lager.set("sitedoc_session_token", "tok");
    lager.set(ANSATT_FIRMA_KEY, JSON.stringify(["o1"]));
    expect(await hentLagretAnsattStatus("o1")).toBe(true);
    expect(await hentLagretAnsattStatus("o2")).toBe(false);

    await loggUt();

    expect(lager.has(ANSATT_FIRMA_KEY)).toBe(false);
    expect(await hentLagretAnsattStatus("o1")).toBeNull();
    expect(await hentLagretAnsattStatus("o2")).toBeNull();
    vi.unstubAllGlobals();
  });
});
