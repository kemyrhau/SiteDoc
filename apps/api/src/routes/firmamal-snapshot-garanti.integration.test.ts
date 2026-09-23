import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";

/**
 * Ordre versjonssporing-softdelete, krav 2b + 5c: DB-garantien for at en LÅNT firmamal
 * ALLTID bærer et snapshot av sentralmal-versjonen den ble lånt på. Garantien er en
 * CHECK-constraint (`organization_templates_laant_har_snapshot`, migrering
 * 20260916120000_versjonssporing_softdelete) — Prisma-skjemaet kan ikke uttrykke CHECK,
 * så den bor i rå migrerings-SQL.
 *
 * Denne testen går DIREKTE mot databasen (`prisma.organizationTemplate.create`), IKKE
 * gjennom `laanFraSentralarkiv`-prosedyren (som alltid setter snapshot). Den beviser at
 * DB-en biter selv om en skrivevei glemmer snapshot — «stille tomhet» krav (c): testen
 * blir RØD hvis CHECK-en mangler (raden slipper inn med versjon_av_hovedmal = NULL).
 *
 * Mål-DB: localhost/CI-sandkasse (verifisert ikke test/prod). Seed → teardown i afterAll.
 * Negativ kontroll (fjern CHECK → testen blir grønn feilaktig) er kjørt av Opus — se
 * ordre-rapporten («SÅ integrasjonstesten bli rød»).
 */

const STANDARD_KODE = "TEST-SNAPSHOT-GARANTI";
const ids = {
  standardId: "",
  kapittelId: "",
  bibliotekMalId: "",
  orgId: "",
  orgTemplateIds: [] as string[],
};

beforeAll(async () => {
  const standard = await prisma.bibliotekStandard.create({
    data: { kode: STANDARD_KODE, navn: "Test snapshot-garanti", sortering: 998 },
  });
  ids.standardId = standard.id;

  const kapittel = await prisma.bibliotekKapittel.create({
    data: { kode: "TSG", navn: "Test-kapittel", sortering: 1, standardId: standard.id },
  });
  ids.kapittelId = kapittel.id;

  const mal = await prisma.bibliotekMal.create({
    data: { kapittelId: kapittel.id, navn: "Test-mal", referanse: "TSG1", malInnhold: [] },
  });
  ids.bibliotekMalId = mal.id;

  const org = await prisma.organization.create({ data: { name: "Test-firma snapshot-garanti" } });
  ids.orgId = org.id;
});

afterAll(async () => {
  if (ids.orgTemplateIds.length)
    await prisma.organizationTemplate.deleteMany({ where: { id: { in: ids.orgTemplateIds } } });
  if (ids.orgId) await prisma.organization.delete({ where: { id: ids.orgId } });
  if (ids.bibliotekMalId) await prisma.bibliotekMal.delete({ where: { id: ids.bibliotekMalId } });
  if (ids.kapittelId) await prisma.bibliotekKapittel.delete({ where: { id: ids.kapittelId } });
  if (ids.standardId) await prisma.bibliotekStandard.delete({ where: { id: ids.standardId } });
});

describe("Firmamal: snapshot-garanti på lånte maler (krav 2b/5c)", () => {
  it("AVVISER en lånt firmamal UTEN snapshot (CHECK-constraint biter)", async () => {
    let feilet = false;
    let melding = "";
    try {
      const rad = await prisma.organizationTemplate.create({
        data: {
          organizationId: ids.orgId,
          name: "Lånt uten snapshot",
          laantFraBibliotekMalId: ids.bibliotekMalId,
          // versjonAvHovedmal UTELATT → NULL. En lånt mal MÅ ha snapshot → CHECK avviser.
        },
      });
      ids.orgTemplateIds.push(rad.id); // skal ikke nås — men ryddes hvis CHECK mangler
    } catch (e) {
      feilet = true;
      melding = e instanceof Error ? e.message : String(e);
    }

    // Uten CHECK-en ville raden sluppet inn (feilet = false) — da er testen RØD.
    expect(feilet).toBe(true);
    expect(melding).toContain("organization_templates_laant_har_snapshot");
  });

  it("TILLATER en lånt firmamal MED snapshot", async () => {
    const rad = await prisma.organizationTemplate.create({
      data: {
        organizationId: ids.orgId,
        name: "Lånt med snapshot",
        laantFraBibliotekMalId: ids.bibliotekMalId,
        versjonAvHovedmal: 1,
      },
    });
    ids.orgTemplateIds.push(rad.id);
    expect(rad.versjonAvHovedmal).toBe(1);
  });

  it("TILLATER en EGEN firmamal (ikke lånt) UTEN snapshot — NULL er lovlig", async () => {
    const rad = await prisma.organizationTemplate.create({
      data: {
        organizationId: ids.orgId,
        name: "Egen mal uten snapshot",
        laantFraBibliotekMalId: null,
        // versjonAvHovedmal UTELATT → NULL. CHECK tillater det: ingen avstamning å snapshotte.
      },
    });
    ids.orgTemplateIds.push(rad.id);
    expect(rad.versjonAvHovedmal).toBeNull();
  });
});
