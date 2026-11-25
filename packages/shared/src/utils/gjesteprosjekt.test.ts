import { describe, it, expect } from "vitest";
import {
  erGjesteprosjekt,
  skjulFirmaModulForGjest,
  gjesteprosjekterIAndreFirma,
  erAdminUtenGjestegruppe,
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

describe("ADMIN-UTEN-GJESTEGRUPPE — velgerens gjestegruppe og nullstilling (Kenneth 2026-11-26)", () => {
  const SITEDOC = "sitedoc";
  const Z = "martin-wulf";
  const P = { id: "p-sitedoc", primaryOrganizationId: SITEDOC };
  // Prosessanlegg-tilfellet: admin står i eget firma (SITEDOC), gjesteprosjektet eies av Z.
  const PZ = { id: "p-prosessanlegg", primaryOrganizationId: Z };
  const gruppe = (rolle: string | null, valgtFirma: string, gjester = [P]) =>
    velgerGjestegruppe(gjester, valgtFirma, erAdminUtenGjestegruppe(rolle));

  it("🔴 admin i eget firma → tom gruppe", () => {
    expect(gruppe("sitedoc_admin", SITEDOC, [PZ])).toEqual([]);
  });
  it("admin i fremmed firma → tom gruppe (ADMIN-GJEST står)", () => {
    expect(gruppe("sitedoc_admin", Z)).toEqual([]);
  });
  it("regresjon: vanlig bruker ser fortsatt gruppen", () => {
    expect(gruppe("user", SITEDOC, [PZ]).map((p) => p.id)).toEqual(["p-prosessanlegg"]);
  });
  it("regresjon: company_admin ser fortsatt gruppen", () => {
    expect(gruppe("company_admin", SITEDOC, [PZ]).map((p) => p.id)).toEqual(["p-prosessanlegg"]);
  });
  it("ukjent rolle (laster) → gruppen vises (ingen admin-atferd)", () => {
    expect(gruppe(null, SITEDOC, [PZ]).map((p) => p.id)).toEqual(["p-prosessanlegg"]);
  });
  it("(16) står: eget-firma-prosjekt i valgt firma er ikke i gruppen", () => {
    const iZ = { id: "p-z", primaryOrganizationId: Z };
    expect(velgerGjestegruppe([P, iZ], Z, false).map((p) => p.id)).toEqual(["p-sitedoc"]);
  });

  const nullstill = (rolle: string, valgtFirma: string, prosjekt: typeof P) =>
    skalNullstilleProsjekt({
      valgtFirmaId: valgtFirma,
      prosjekt,
      gjesteIder: gjesteIderForNullstilling([prosjekt.id], erAdminUtenGjestegruppe(rolle)),
      lasterGjester: false,
    });
  it("🔴 admin i eget firma med valgt gjesteprosjekt → valget nullstilles", () => {
    expect(nullstill("sitedoc_admin", SITEDOC, PZ)).toBe(true);
  });
  it("admin i fremmed firma → valgt gjesteprosjekt nullstilles (tillegg A står)", () => {
    expect(nullstill("sitedoc_admin", Z, P)).toBe(true);
  });
  it("admin: gjesteprosjekt eid av valgt firma beholdes", () => {
    expect(nullstill("sitedoc_admin", Z, PZ)).toBe(false);
  });
  it("regresjon: vanlig bruker og company_admin beholder valgt gjesteprosjekt (15)", () => {
    expect(nullstill("user", SITEDOC, PZ)).toBe(false);
    expect(nullstill("company_admin", SITEDOC, PZ)).toBe(false);
  });
});
