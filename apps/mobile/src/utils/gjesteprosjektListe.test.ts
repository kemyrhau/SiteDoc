import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  mineAnsattFirmaIder,
  lokaleGjesteprosjekter,
  serverGjesteprosjekter,
  utenGjesteprosjekter,
} from "./gjesteprosjektListe";

/** POST 2026-11-15 (15) punkt 4 — mobil: gruppen «Prosjekter i andre firma». */
const F = "firma-f";
const X = "firma-x";
const rad = (id: string, organizationId: string) => ({ id, name: id, projectNumber: null, organizationId });

describe("mineAnsattFirmaIder", () => {
  it("gir firmaene brukeren er ansatt i", () => {
    expect(mineAnsattFirmaIder([{ id: F }, { id: X }], (id) => id === F)).toEqual([F]);
  });
  it("ukjent ansettelse i ett firma → null (gjetter ikke)", () => {
    expect(mineAnsattFirmaIder([{ id: F }, { id: X }], (id) => (id === F ? true : null))).toBeNull();
  });
  it("tom firmaliste (ikke lastet) → null", () => {
    expect(mineAnsattFirmaIder([], () => true)).toBeNull();
  });
  it("ren gjest uten ansettelse → tom liste, ikke null", () => {
    expect(mineAnsattFirmaIder([{ id: X }], () => false)).toEqual([]);
  });
});

describe("lokaleGjesteprosjekter (offline fra prosjekt_local)", () => {
  const rader = [rad("p-eget", F), rad("p-gjest", X)];
  it("tar bare med prosjekter eid av firma brukeren ikke er ansatt i", () => {
    expect(lokaleGjesteprosjekter(rader, [F]).map((p) => p.id)).toEqual(["p-gjest"]);
  });
  it("negativkontroll: ukjent ansettelse → ingen gjestegruppe", () => {
    expect(lokaleGjesteprosjekter(rader, null)).toEqual([]);
  });
  it("eierfirmaets navn er ukjent offline", () => {
    expect(lokaleGjesteprosjekter(rader, [F])[0].eierFirma).toBeNull();
  });
});

describe("serverGjesteprosjekter + utenGjesteprosjekter", () => {
  it("viser eierfirmaets navn fra serveren", () => {
    const g = serverGjesteprosjekter([
      { id: "p-gjest", name: "Bru", projectNumber: "12", primaryOrganization: { name: "X AS" } },
    ]);
    expect(g).toEqual([{ id: "p-gjest", name: "Bru", projectNumber: "12", eierFirma: "X AS" }]);
  });
  it("gjesteprosjekt tas ut av hovedlista, egne blir stående", () => {
    const hoved = [{ id: "p-eget" }, { id: "p-gjest" }];
    expect(utenGjesteprosjekter(hoved, [{ id: "p-gjest" }]).map((p) => p.id)).toEqual(["p-eget"]);
  });
});

describe("koblinger (kilde-vakt)", () => {
  const les = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");
  it("useProsjektListe filtrerer hovedlista og eksponerer gjesteprosjekter", () => {
    const k = les("../hooks/useProsjektListe.ts");
    expect(k).toContain("trpc.prosjekt.hentGjesteprosjekter.useQuery");
    expect(k).toContain("hentGjesteprosjekterLokalt(mineFirmaIder)");
    expect(k.match(/utenGjesteprosjekter\(/g)?.length).toBe(2);
  });
  it("ProsjektVelger viser gruppen og Hjem finner valgt gjesteprosjekt", () => {
    expect(les("../components/ProsjektVelger.tsx")).toContain('t("prosjektVelger.andreFirma")');
    expect(les("../../app/(tabs)/hjem.tsx")).toContain("gjesteprosjekter.find((p) => p.id === valgtProsjektId)");
  });
});
