import { describe, expect, it } from "vitest";
import { dokumentRetur, gyldigRetur, medRetur, tilbakeEtikett } from "../tilbake-adresse";
import { leserHref } from "../dokument-sok-ctrlk";

/** w14 leveranse 2 (B39 A, plan § 4.14 TK6–TK26). */
describe("tilbakeEtikett — de nye listene", () => {
  it.each([
    ["/dashbord/p1/mapper?mappe=m1", "tilbake.tilMapper"],
    ["/dashbord/p1/hms", "tilbake.tilHms"],
    ["/dashbord/firma/hms?fane=sja", "tilbake.tilHms"],
    ["/dashbord/p1/sjekklister", "tilbake.tilSjekklister"],
    ["/dashbord/innstillinger", "tilbake.tilInnstillinger"],
    ["/dashbord/p1/timer?uke=2026-11-16", "timer.tilbakeTilTimer"],
    ["/dashbord/timer/mine", "timer.tilbakeTilMineTimer"],
    ["/dashbord/p1/tegninger", "papirkurv.returTilbake"],
    ["/dashbord/p1/kontrollplan", "papirkurv.returTilbake"],
  ])("%s → %s", (sti, etikett) => {
    expect(tilbakeEtikett(sti)).toBe(etikett);
  });
});

describe("TK6 — dokumentleseren husker mappen og søket", () => {
  it("mapperaden sender mappen med", () => {
    expect(medRetur("/dashbord/p1/dokumenter/d1/les", "/dashbord/p1/mapper?mappe=m1")).toBe(
      "/dashbord/p1/dokumenter/d1/les?retur=%2Fdashbord%2Fp1%2Fmapper%3Fmappe%3Dm1",
    );
  });

  it("Ctrl+K-treffet sender siden søket ble åpnet fra", () => {
    expect(leserHref("p1", "d1", "betong", "/dashbord/p1/sjekklister")).toBe(
      "/dashbord/p1/dokumenter/d1/les?highlight=betong&retur=%2Fdashbord%2Fp1%2Fsjekklister",
    );
  });

  it("søk fra en side utenfor /dashbord/ gir ingen retur (reserven Mapper gjelder)", () => {
    expect(leserHref("p1", "d1", "betong", "https://ondsinnet.example")).toBe(
      "/dashbord/p1/dokumenter/d1/les?highlight=betong",
    );
    expect(leserHref("p1", "d1", "betong", null)).toBe("/dashbord/p1/dokumenter/d1/les?highlight=betong");
  });
});

describe("TK7–TK10, TK22 — HMS-dokumenter og sletting", () => {
  const std = { standardListe: "/dashbord/p1/hms", prosjektHms: "/dashbord/p1/hms" };

  it("åpnet fra Firma › HMS: «← HMS» og sletting går dit", () => {
    expect(dokumentRetur({ ...std, retur: "/dashbord/firma/hms" })).toEqual({
      hms: "/dashbord/firma/hms",
      etterSletting: "/dashbord/firma/hms",
    });
  });

  it("åpnet direkte: prosjektets HMS, som før", () => {
    expect(dokumentRetur({ ...std, retur: null })).toEqual({
      hms: "/dashbord/p1/hms",
      etterSletting: "/dashbord/p1/hms",
    });
  });

  it("sjekkliste åpnet fra tegningen: sletting går til tegningen, «← HMS» ikke", () => {
    const r = dokumentRetur({
      retur: "/dashbord/p1/tegninger",
      standardListe: "/dashbord/p1/sjekklister",
      prosjektHms: "/dashbord/p1/hms",
    });
    expect(r.etterSletting).toBe("/dashbord/p1/tegninger");
    expect(r.hms).toBe("/dashbord/p1/hms");
  });

  it("returnerTil (dokumentet oppgaven ble laget fra) går foran ?retur", () => {
    expect(
      dokumentRetur({ ...std, retur: "/dashbord/firma/hms", returnerTil: "/dashbord/p1/sjekklister/s1" })
        .etterSletting,
    ).toBe("/dashbord/p1/sjekklister/s1");
  });

  it("TK22: returnerTil utenfor /dashbord/ avvises", () => {
    expect(gyldigRetur("/login")).toBeNull();
    expect(dokumentRetur({ ...std, retur: null, returnerTil: "/api/x" }).etterSletting).toBe(
      "/dashbord/p1/hms",
    );
    expect(dokumentRetur({ ...std, retur: "//ondsinnet.example" }).etterSletting).toBe("/dashbord/p1/hms");
  });
});

describe("TK11–TK13, TK24, TK26 — inngangene sender retur", () => {
  it("Mine timer → firmasiden", () => {
    const href = medRetur("/dashbord/admin/firmaer/o1?fane=brukere", "/dashbord/timer/mine");
    expect(href).toBe("/dashbord/admin/firmaer/o1?fane=brukere&retur=%2Fdashbord%2Ftimer%2Fmine");
    expect(tilbakeEtikett(new URLSearchParams(href.split("?")[1]).get("retur")!)).toBe(
      "timer.tilbakeTilMineTimer",
    );
  });

  it("prosjektvelgeren (/dashbord) er ingen gyldig retur — reserven er prosjektvelgeren", () => {
    expect(medRetur("/dashbord/nytt-prosjekt", "/dashbord")).toBe("/dashbord/nytt-prosjekt");
    expect(medRetur("/dashbord/nytt-prosjekt", "/dashbord/firma/prosjekter")).toBe(
      "/dashbord/nytt-prosjekt?retur=%2Fdashbord%2Ffirma%2Fprosjekter",
    );
  });
});
