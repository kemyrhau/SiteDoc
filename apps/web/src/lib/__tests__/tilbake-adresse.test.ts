import { describe, expect, it } from "vitest";
import {
  gyldigRetur,
  lesUkeParam,
  lokalIsoDato,
  medRetur,
  prosjektTimerAdresse,
  soketekst,
  tilbakeEtikett,
} from "../tilbake-adresse";
import { registrerLenke } from "../registrerTimer";

/** w14 leveranse 1 (B39 A, plan § 4.14 TK1–TK5): tilbake-adressen i timeføringen. */
describe("gyldigRetur — open-redirect-vakt", () => {
  it("godtar stier under /dashbord/", () => {
    expect(gyldigRetur("/dashbord/p1/timer?uke=2026-11-09&status=sent")).toBe(
      "/dashbord/p1/timer?uke=2026-11-09&status=sent",
    );
    expect(gyldigRetur("/dashbord/timer/mine")).toBe("/dashbord/timer/mine");
  });
  it.each([
    null,
    "",
    "https://ond.no/dashbord/",
    "//ond.no",
    "/dashbord//ond.no",
    "/dashbord/\\ond.no",
    "/dashbord/../api/x",
    "/dashbord/p1/./timer",
    "/dashbordx/p1",
    "/login",
  ])("avviser %s", (v) => {
    expect(gyldigRetur(v)).toBeNull();
  });
});

describe("tilbakeEtikett — teksten sier hvor knappen går", () => {
  it("prosjektets Timer → «Tilbake til Timer»", () => {
    expect(tilbakeEtikett("/dashbord/p1/timer?uke=2026-11-09")).toBe("timer.tilbakeTilTimer");
  });
  it("Mine timer → «Tilbake til Mine timer»", () => {
    expect(tilbakeEtikett("/dashbord/timer/mine")).toBe("timer.tilbakeTilMineTimer");
  });
  it("annet → nøytral «Tilbake»; dagen selv er ikke prosjektets Timer", () => {
    expect(tilbakeEtikett("/dashbord/p1/sjekklister")).toBe("papirkurv.returTilbake");
    expect(tilbakeEtikett("/dashbord/timer/s1")).toBe("papirkurv.returTilbake");
  });
});

describe("medRetur", () => {
  it("legger ?retur på, kodet", () => {
    expect(medRetur("/dashbord/timer/s1", "/dashbord/p1/timer?uke=2026-11-09&status=sent")).toBe(
      "/dashbord/timer/s1?retur=%2Fdashbord%2Fp1%2Ftimer%3Fuke%3D2026-11-09%26status%3Dsent",
    );
  });
  it("beholder lenkens egne parametre", () => {
    expect(medRetur("/dashbord/timer/s1?registrer=1", "/dashbord/timer/mine")).toBe(
      "/dashbord/timer/s1?registrer=1&retur=%2Fdashbord%2Ftimer%2Fmine",
    );
  });
  it("ugyldig eller tom retur → lenken uendret", () => {
    expect(medRetur("/dashbord/timer/ny", "//ond.no")).toBe("/dashbord/timer/ny");
    expect(medRetur("/dashbord/timer/ny", null)).toBe("/dashbord/timer/ny");
  });
});

describe("prosjektets Timer: uka og filteret i adressen (TK2)", () => {
  it("lenken til dagen bærer uka og filteret", () => {
    const adresse = prosjektTimerAdresse("p1", new Date(2026, 10, 9), "sent");
    expect(adresse).toBe("/dashbord/p1/timer?uke=2026-11-09&status=sent");
    const tilDagen = medRetur("/dashbord/timer/s1", adresse);
    expect(new URL(tilDagen, "http://x").searchParams.get("retur")).toBe(adresse);
  });
  it("«Alle» står ikke i adressen", () => {
    expect(prosjektTimerAdresse("p1", new Date(2026, 10, 9), "alle")).toBe(
      "/dashbord/p1/timer?uke=2026-11-09",
    );
  });
  it("lesUkeParam gir mandagen; ugyldig → null", () => {
    expect(lokalIsoDato(lesUkeParam("2026-11-12")!)).toBe("2026-11-09");
    expect(lokalIsoDato(lesUkeParam("2026-11-09")!)).toBe("2026-11-09");
    expect(lesUkeParam("2026-02-30")).toBeNull();
    expect(lesUkeParam("i-dag")).toBeNull();
    expect(lesUkeParam(null)).toBeNull();
  });
});

describe("«Ny dagsseddel» / «+ Registrer timer» sender ?retur videre (TK4–TK5)", () => {
  it("registrerLenke bærer retur", () => {
    const lenke = registrerLenke({
      sheetId: "s1",
      projectId: "p1",
      eksisterte: false,
      retur: "/dashbord/p1/timer?uke=2026-11-09",
    });
    const sp = new URL(lenke, "http://x").searchParams;
    expect(sp.get("registrer")).toBe("1");
    expect(sp.get("retur")).toBe("/dashbord/p1/timer?uke=2026-11-09");
  });
  it("uten retur er lenken som før", () => {
    expect(registrerLenke({ sheetId: "s1", projectId: null, eksisterte: false })).toBe(
      "/dashbord/timer/s1?registrer=1",
    );
  });
});

describe("soketekst — gamle adresser under [prosjektId]/timer sender parametrene videre", () => {
  it("bevarer retur", () => {
    expect(soketekst({ retur: "/dashbord/timer/mine", tom: undefined })).toBe(
      "?retur=%2Fdashbord%2Ftimer%2Fmine",
    );
    expect(soketekst({})).toBe("");
  });
});
