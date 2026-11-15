import { describe, expect, it } from "vitest";
import { velgFilterByggeplass } from "@sitedoc/shared";
import { flettServerValg, manueltValg, nyesteInnsjekk, psiModulAktiv, serverVinner } from "./byggeplassFilterValg";

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

describe("GATE (49) V1 psiModulAktiv — samme regel som web", () => {
  it("status «aktiv» → true", () => {
    expect(psiModulAktiv([{ moduleSlug: "psi", status: "aktiv" }])).toBe(true);
  });
  it("negativkontroll: `active: true` uten status (feltet finnes ikke på ProjectModule) → false", () => {
    expect(psiModulAktiv([{ moduleSlug: "psi", active: true } as { moduleSlug: string }])).toBe(false);
  });
  it("arkivert PSI, annen modul eller ingen data → false", () => {
    expect(psiModulAktiv([{ moduleSlug: "psi", status: "arkivert" }])).toBe(false);
    expect(psiModulAktiv([{ moduleSlug: "timer", status: "aktiv" }])).toBe(false);
    expect(psiModulAktiv(undefined)).toBe(false);
  });
});

describe("GATE (49) V2 flettServerValg — manuelt valg overlever kaldstart", () => {
  const T = 1000;
  // Brukeren sto på A (GPS = A) og valgte B bevisst; speilingen til serveren fikk nyere `oppdatert`.
  const lokalMap = { P: "B" };
  const lokalTid = { P: { tid: T, gps: "A" } };

  it("samme id på server → lokale metadata beholdes, GPS A overstyrer ikke B", () => {
    const meta = flettServerValg(lokalMap.P, lokalTid.P, "B", T + 500);
    expect(meta).toEqual({ tid: T, gps: "A" });
    const m = manueltValg({ P: "B" }, { P: meta! }, "P");
    expect(m?.gpsVedValg).toBe("A");
    expect(velgFilterByggeplass({ byggeplassIder: ["A", "B"], gps: "A", manuelt: m })).toBe("B");
  });

  it("negativkontroll: metadata erstattet med bare { tid } (gammel fletting) gir A", () => {
    const m = manueltValg({ P: "B" }, { P: { tid: T + 500 } }, "P");
    expect(velgFilterByggeplass({ byggeplassIder: ["A", "B"], gps: "A", manuelt: m })).toBe("A");
  });

  it("annen id på server (valgt på annen enhet, nyere) → serverens tid, uten lokal GPS", () => {
    expect(flettServerValg("B", { tid: T, gps: "A" }, "C", T + 500)).toEqual({ tid: T + 500 });
  });

  it("lokalt nyere → null (lokalt står)", () => {
    expect(flettServerValg("B", { tid: T + 900, gps: "A" }, "C", T + 500)).toBeNull();
  });

  it("GPS-autovalg lokalt med samme id → serverens tid (auto er ikke et manuelt valg)", () => {
    expect(flettServerValg("B", { tid: T, auto: true }, "B", 0)).toEqual({ tid: 0 });
  });
});
