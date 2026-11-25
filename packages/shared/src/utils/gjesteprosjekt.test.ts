import { describe, it, expect } from "vitest";
import {
  erGjesteprosjekt,
  skjulFirmaModulForGjest,
  gjesteprosjekterIAndreFirma,
  erAdminIFremmedFirma,
  velgerGjestegruppe,
  gjesteIderForNullstilling,
  skalNullstilleProsjekt,
} from "./gjesteprosjekt";

/** POST 2026-11-15 (15) test (a): gjesteprosjekt-regelen som tabell. */
const A = "firma-a";
const B = "firma-b";

describe("erGjesteprosjekt — (15) test (a)", () => {
  const tilfeller: Array<[string, string | null, string[], boolean]> = [
    ["eget firma eier → ikke gjest", A, [A], false],
    ["🔴 annet firma eier, ingen ansettelse der → gjest", B, [A], true],
    ["ansatt i begge → ikke gjest", B, [A, B], false],
    ["standalone (ingen eier) → aldri gjest", null, [A], false],
    ["standalone uten ansettelser → aldri gjest", null, [], false],
    ["🔴 ingen aktive ansettelser, firmaprosjekt → gjest", A, [], true],
    // Deaktivert ansettelse i eier-firmaet står ikke i aktiv-lista → regnes som gjest
    // (serveren filtrerer slike prosjekter bort før klienten ser dem).
    ["deaktivert ansettelse i eier (ikke i aktiv-liste) → gjest", B, [A], true],
  ];
  it.each(tilfeller)("%s", (_navn, eier, mine, forventet) => {
    expect(erGjesteprosjekt({ primaryOrganizationId: eier }, mine)).toBe(forventet);
  });
});

describe("skjulFirmaModulForGjest — (15) test (e) regel", () => {
  it("ikke gjest → ingen modul skjules", () => {
    expect(skjulFirmaModulForGjest("timer", { erGjest: false, firmaKoblet: false })).toBe(false);
    expect(skjulFirmaModulForGjest("varelager", { erGjest: false, firmaKoblet: false })).toBe(false);
  });
  it("🔴 gjest uten firmakobling → Timer og Vareforbruk skjules", () => {
    expect(skjulFirmaModulForGjest("timer", { erGjest: true, firmaKoblet: false })).toBe(true);
    expect(skjulFirmaModulForGjest("varelager", { erGjest: true, firmaKoblet: false })).toBe(true);
  });
  it("gjest med eget firma koblet (ProjectOrganization) → Timer vises, Vareforbruk skjules", () => {
    expect(skjulFirmaModulForGjest("timer", { erGjest: true, firmaKoblet: true })).toBe(false);
    expect(skjulFirmaModulForGjest("varelager", { erGjest: true, firmaKoblet: true })).toBe(true);
  });
});

describe("gjesteprosjekterIAndreFirma — (16) punkt 2", () => {
  const X = "firma-x";
  const Y = "firma-y";
  const iX = { id: "p-x", primaryOrganizationId: X };
  const iY = { id: "p-y", primaryOrganizationId: Y };
  it("🔴 prosjekt eid av valgt firma ligger ikke i «andre firma»-gruppen", () => {
    expect(gjesteprosjekterIAndreFirma([iX, iY], X).map((p) => p.id)).toEqual(["p-y"]);
  });
  it("prosjekt eid av annet firma enn valgt ligger i gruppen", () => {
    expect(gjesteprosjekterIAndreFirma([iX, iY], Y).map((p) => p.id)).toEqual(["p-x"]);
  });
  it("uten valgt firma → hele gjestelista som før", () => {
    expect(gjesteprosjekterIAndreFirma([iX, iY], null).map((p) => p.id)).toEqual(["p-x", "p-y"]);
  });
});

describe("ADMIN-GJEST — velgerens gjestegruppe og nullstilling (Kenneth 2026-11-25)", () => {
  const SITEDOC = "sitedoc";
  const Z = "martin-wulf";
  const P = { id: "p-sitedoc", primaryOrganizationId: SITEDOC };
  const gruppe = (rolle: string, erAnsatt: boolean | null) =>
    velgerGjestegruppe([P], Z, erAdminIFremmedFirma({ rolle, erAnsattIValgtFirma: erAnsatt }));

  it("🔴 admin + ikke ansatt i valgt firma → tom gruppe", () => {
    expect(gruppe("sitedoc_admin", false)).toEqual([]);
  });
  it("admin + ansatt i valgt firma → gruppen vises", () => {
    expect(gruppe("sitedoc_admin", true).map((p) => p.id)).toEqual(["p-sitedoc"]);
  });
  it("admin + ukjent ansatt-status → gruppen vises (dagens atferd)", () => {
    expect(gruppe("sitedoc_admin", null).map((p) => p.id)).toEqual(["p-sitedoc"]);
  });
  it("vanlig bruker, ikke ansatt i valgt firma → gruppen vises", () => {
    expect(gruppe("user", false).map((p) => p.id)).toEqual(["p-sitedoc"]);
  });
  it("(16) står: eget-firma-prosjekt i valgt firma er ikke i gruppen", () => {
    const iZ = { id: "p-z", primaryOrganizationId: Z };
    expect(velgerGjestegruppe([P, iZ], Z, false).map((p) => p.id)).toEqual(["p-sitedoc"]);
  });

  const nullstill = (adminIFremmed: boolean) =>
    skalNullstilleProsjekt({
      valgtFirmaId: Z,
      prosjekt: P,
      gjesteIder: gjesteIderForNullstilling([P.id], adminIFremmed),
      lasterGjester: false,
    });
  it("🔴 A: admin i fremmed firma → valgt gjesteprosjekt nullstilles", () => {
    expect(nullstill(true)).toBe(true);
  });
  it("ellers beholdes valgt gjesteprosjekt (15)", () => {
    expect(nullstill(false)).toBe(false);
  });
});
