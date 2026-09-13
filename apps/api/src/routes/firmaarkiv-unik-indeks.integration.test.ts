import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma, prisma } from "@sitedoc/db";

/**
 * Funn #10, «Malforvaltning — 17 målte funn 2026-09-13»: unik indeks mot dobbelt-lån
 * av samme bibliotekmal til samme firma (`@@unique([organizationId, laantFraBibliotekMalId])`
 * på OrganizationTemplate, migrering 20260913140000_firmaarkiv_unik_indeks).
 *
 * Denne testen går DIREKTE mot databasen (`prisma.organizationTemplate.create`), IKKE gjennom
 * `laanFraSentralarkiv`-prosedyren. Vakten (findFirst + CONFLICT i firmamal.ts) fanges av de
 * rene enhetstestene i firmamal-arkivtilgang.test.ts; DENNE beviser at INDEKSEN biter selv om
 * en skrivevei omgår vakten (samtidighet: sjekk-og-skriv er to operasjoner).
 *
 * Mål-DB: localhost-sandkasse (verifisert ikke test/prod). Seed → teardown i afterAll.
 * Negativ kontroll (fjern indeksen → testen blir rød) er kjørt manuelt av mal-Opus 2026-09-13.
 */

const STANDARD_KODE = "TEST-UNIK-INDEKS";
const ids = {
  standardId: "",
  kapittelId: "",
  bibliotekMalId: "",
  orgId: "",
  orgTemplateIds: [] as string[],
};

beforeAll(async () => {
  const standard = await prisma.bibliotekStandard.create({
    data: { kode: STANDARD_KODE, navn: "Test unik indeks", sortering: 999 },
  });
  ids.standardId = standard.id;

  const kapittel = await prisma.bibliotekKapittel.create({
    data: { kode: "TUI", navn: "Test-kapittel", sortering: 1, standardId: standard.id },
  });
  ids.kapittelId = kapittel.id;

  const mal = await prisma.bibliotekMal.create({
    data: { kapittelId: kapittel.id, navn: "Test-mal", referanse: "TUI1", malInnhold: [] },
  });
  ids.bibliotekMalId = mal.id;

  const org = await prisma.organization.create({ data: { name: "Test-firma unik indeks" } });
  ids.orgId = org.id;
});

afterAll(async () => {
  // Rekkefølge etter FK: org-templates → org → bibliotekmal → kapittel → standard.
  if (ids.orgTemplateIds.length)
    await prisma.organizationTemplate.deleteMany({ where: { id: { in: ids.orgTemplateIds } } });
  if (ids.orgId) await prisma.organization.delete({ where: { id: ids.orgId } });
  if (ids.bibliotekMalId) await prisma.bibliotekMal.delete({ where: { id: ids.bibliotekMalId } });
  if (ids.kapittelId) await prisma.bibliotekKapittel.delete({ where: { id: ids.kapittelId } });
  if (ids.standardId) await prisma.bibliotekStandard.delete({ where: { id: ids.standardId } });
});

describe("Firmaarkiv: unik indeks mot dobbelt-lån (funn #10)", () => {
  it("blokkerer et andre lån av samme bibliotekmal til samme firma (P2002)", async () => {
    const forste = await prisma.organizationTemplate.create({
      data: { organizationId: ids.orgId, name: "Lån 1", laantFraBibliotekMalId: ids.bibliotekMalId },
    });
    ids.orgTemplateIds.push(forste.id);

    let feilkode: string | null = null;
    try {
      const andre = await prisma.organizationTemplate.create({
        data: { organizationId: ids.orgId, name: "Lån 2", laantFraBibliotekMalId: ids.bibliotekMalId },
      });
      ids.orgTemplateIds.push(andre.id); // skal ikke nås — men ryddes hvis indeksen mangler
    } catch (e) {
      feilkode = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : "UKJENT";
    }

    // P2002 = unique constraint. Uten indeksen ville feilkode vært null (begge slapp gjennom).
    expect(feilkode).toBe("P2002");
  });

  it("tillater flere EGNE (ikke-lånte) firmamaler — NULL er distinkt", async () => {
    const egen1 = await prisma.organizationTemplate.create({
      data: { organizationId: ids.orgId, name: "Egen 1", laantFraBibliotekMalId: null },
    });
    const egen2 = await prisma.organizationTemplate.create({
      data: { organizationId: ids.orgId, name: "Egen 2", laantFraBibliotekMalId: null },
    });
    ids.orgTemplateIds.push(egen1.id, egen2.id);

    // Begge skal finnes — NULLS DISTINCT gjør at to null-lån ikke kolliderer.
    expect(egen1.id).not.toBe(egen2.id);
  });
});
