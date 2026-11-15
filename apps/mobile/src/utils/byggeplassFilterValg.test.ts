import { describe, expect, it } from "vitest";
import { manueltValg, nyesteInnsjekk, serverVinner } from "./byggeplassFilterValg";

/** Lest legacy-data: strengen eldre versjoner lagret (før TILLEGG (22)). */
const UTGAATT = "__hele_prosjektet__";

describe("(22) manueltValg", () => {
  it("lagret byggeplass med tid og GPS ved valg", () => {
    expect(manueltValg({ P: "b1" }, { P: { tid: 5, gps: "g" } }, "P")).toEqual({ id: "b1", tid: 5, gpsVedValg: "g" });
  });
  it("eldre valg uten tid teller som eldst (tid 0)", () => {
    expect(manueltValg({ P: "b1" }, {}, "P")).toEqual({ id: "b1", tid: 0, gpsVedValg: null });
  });
  it("negativkontroll: utgått streng-verdi fra før (22) er ikke et valg", () => {
    expect(manueltValg({ P: UTGAATT }, { P: { tid: 9 } }, "P")).toBeNull();
  });
  it("negativkontroll: GPS-autovalg (D1) er ikke et manuelt valg", () => {
    expect(manueltValg({ P: "b1" }, { P: { tid: 0, auto: true } }, "P")).toBeNull();
  });
  it("annet prosjekt → null", () => {
    expect(manueltValg({ Q: "b1" }, {}, "P")).toBeNull();
  });
});

describe("(22) nyesteInnsjekk — PSI og timer-besøk, nyeste vinner", () => {
  it("besøk nyere enn PSI vinner", () => {
    expect(nyesteInnsjekk([{ id: "psi", tid: 1 }, { id: "besok", tid: 2 }])?.id).toBe("besok");
  });
  it("PSI nyere enn besøk vinner", () => {
    expect(nyesteInnsjekk([{ id: "psi", tid: 3 }, { id: "besok", tid: 2 }])?.id).toBe("psi");
  });
  it("ingen kilder → null; ugyldig tid hoppes over", () => {
    expect(nyesteInnsjekk([null, undefined, { id: "x", tid: Number.NaN }])).toBeNull();
  });
});

describe("(22) serverVinner — nyeste valg på tvers av enheter", () => {
  it("server nyere → server", () => expect(serverVinner({ tid: 1 }, 2)).toBe(true));
  it("negativkontroll: lokalt nyere (skrevet offline) → lokalt står", () => {
    expect(serverVinner({ tid: 3 }, 2)).toBe(false);
  });
  it("ingen lokal tid eller GPS-autovalg → server", () => {
    expect(serverVinner(undefined, 0)).toBe(true);
    expect(serverVinner({ tid: 9, auto: true }, 0)).toBe(true);
  });
});
