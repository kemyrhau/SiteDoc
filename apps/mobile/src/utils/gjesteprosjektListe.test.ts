import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  mineAnsattFirmaIder,
  lokaleGjesteprosjekter,
  serverGjesteprosjekter,
  utenGjesteprosjekter,
  velgerGjesteprosjekter,
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
      { id: "p-gjest", name: "Bru", projectNumber: "12", primaryOrganizationId: X, primaryOrganization: { name: "X AS" } },
    ]);
    expect(g).toEqual([
      { id: "p-gjest", name: "Bru", projectNumber: "12", eierFirma: "X AS", primaryOrganizationId: X },
    ]);
  });
  it("gjesteprosjekt tas ut av hovedlista, egne blir stående", () => {
    const hoved = [{ id: "p-eget" }, { id: "p-gjest" }];
    expect(utenGjesteprosjekter(hoved, [{ id: "p-gjest" }]).map((p) => p.id)).toEqual(["p-eget"]);
  });
});

describe("velgerGjesteprosjekter — (16) punkt 2", () => {
  const Y = "firma-y";
  const g = (id: string, eier: string) => ({
    id,
    name: id,
    projectNumber: null,
    eierFirma: null,
    primaryOrganizationId: eier,
  });
  const server = [g("p-x", X), g("p-y", Y)];
  it("🔴 prosjekt eid av valgt firma ligger ikke i gjestegruppen (valgt firma uten ansettelse)", () => {
    const ider = velgerGjesteprosjekter({ visning: "server", server, lokale: [], valgtFirmaId: X, adminIFremmedFirma: false }).map((p) => p.id);
    expect(ider).toEqual(["p-y"]);
  });
  it("🔴 samme regel offline (lokal cache)", () => {
    const ider = velgerGjesteprosjekter({ visning: "lokal", server: [], lokale: server, valgtFirmaId: X, adminIFremmedFirma: false }).map((p) => p.id);
    expect(ider).toEqual(["p-y"]);
  });
  it("valgt firma blir i hovedlista: utenGjesteprosjekter fjerner ikke valgt firmas prosjekt", () => {
    const gjester = velgerGjesteprosjekter({ visning: "server", server, lokale: [], valgtFirmaId: X, adminIFremmedFirma: false });
    expect(utenGjesteprosjekter([{ id: "p-x" }], gjester).map((p) => p.id)).toEqual(["p-x"]);
  });
  it("🔴 ADMIN-GJEST: sitedoc_admin i fremmed firma → ingen gjestegruppe (på nett og offline)", () => {
    expect(velgerGjesteprosjekter({ visning: "server", server, lokale: [], valgtFirmaId: X, adminIFremmedFirma: true })).toEqual([]);
    expect(velgerGjesteprosjekter({ visning: "lokal", server: [], lokale: server, valgtFirmaId: X, adminIFremmedFirma: true })).toEqual([]);
  });
  it("feil-/lastevisning → ingen gjestegruppe", () => {
    expect(velgerGjesteprosjekter({ visning: "feil", server, lokale: server, valgtFirmaId: null, adminIFremmedFirma: false })).toEqual([]);
  });
});

describe("koblinger (kilde-vakt)", () => {
  const les = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");
  it("useProsjektListe filtrerer hovedlista og eksponerer gjesteprosjekter", () => {
    const k = les("../hooks/useProsjektListe.ts");
    expect(k).toContain("trpc.prosjekt.hentGjesteprosjekter.useQuery");
    expect(k).toContain("hentGjesteprosjekterLokalt(mineFirmaIder)");
    expect(k.match(/utenGjesteprosjekter\(/g)?.length).toBe(2);
    // (16): gruppen filtreres mot valgt firma.
    expect(k).toContain("valgtFirmaId: valgtFirmaId ?? null");
    expect(k).toContain("velgerGjesteprosjekter({");
    // ADMIN-GJEST: regelen får rolle + ansatt-status inn.
    expect(k).toMatch(/erAdminIFremmedFirma\(\{\s*rolle: minBruker\.data\?\.role,\s*erAnsattIValgtFirma,\s*\}\)/);
    expect(k).toMatch(/\n\s*adminIFremmedFirma,\n\s*\}\);/);
  });
  it("ProsjektVelger viser gruppen og Hjem finner valgt gjesteprosjekt", () => {
    expect(les("../components/ProsjektVelger.tsx")).toContain('t("prosjektVelger.andreFirma")');
    expect(les("../../app/(tabs)/hjem.tsx")).toContain("gjesteprosjekter.find((p) => p.id === valgtProsjektId)");
  });
});
