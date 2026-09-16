import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma, prisma } from "@sitedoc/db";

/**
 * Funn #10, «Malforvaltning — 17 målte funn 2026-09-13»: unik indeks mot dobbelt-lån
 * av samme bibliotekmal til samme firma. Indeksen ble PARTIELL i migrering
 * 20260917120000_unik_indeks_partiell_soft_delete: `CREATE UNIQUE INDEX ... (organization_id,
 * laant_fra_bibliotek_mal_id) WHERE deleted_at IS NULL` — @@unique er FJERNET fra skjemaet.
 *
 * Denne testen går DIREKTE mot databasen (`prisma.organizationTemplate.create`), IKKE gjennom
 * `laanFraSentralarkiv`-prosedyren. Vakten (findFirst + CONFLICT i firmamal.ts) fanges av de
 * rene enhetstestene i firmamal-arkivtilgang.test.ts; DENNE beviser at INDEKSEN biter selv om
 * en skrivevei omgår vakten (samtidighet: sjekk-og-skriv er to operasjoner).
 *
 * Beviser BEGGE retninger (ordre unik-indeks-soft-delete, krav 3c):
 *  · to AKTIVE lån av samme bibliotekmal → P2002 (garantien består)
 *  · lån → soft-slett → lån på nytt → LOV (fella fra den fulle indeksen er borte)
 * Test nummer to var RØD mot det gamle (fulle) skjemaet og GRØNN etter fiksen — verifisert
 * grønn→rød→grønn mot lokal pgvector 2026-09-16. Den er hele poenget: uten den vet vi ikke
 * at fiksen virker.
 *
 * Mål-DB: localhost-sandkasse (verifisert ikke test/prod). Seed → teardown i afterAll.
 */

const STANDARD_KODE = "TEST-UNIK-INDEKS";
const ids = {
  standardId: "",
  kapittelId: "",
  bibliotekMalId: "",
  bibliotekMalId2: "", // egen mal for gjenlån-testen — isolert fra test 1s aktive lån
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

  const mal2 = await prisma.bibliotekMal.create({
    data: { kapittelId: kapittel.id, navn: "Test-mal 2 (gjenlån)", referanse: "TUI2", malInnhold: [] },
  });
  ids.bibliotekMalId2 = mal2.id;

  const org = await prisma.organization.create({ data: { name: "Test-firma unik indeks" } });
  ids.orgId = org.id;
});

afterAll(async () => {
  // Rekkefølge etter FK: org-templates → org → bibliotekmal → kapittel → standard.
  if (ids.orgTemplateIds.length)
    await prisma.organizationTemplate.deleteMany({ where: { id: { in: ids.orgTemplateIds } } });
  if (ids.orgId) await prisma.organization.delete({ where: { id: ids.orgId } });
  if (ids.bibliotekMalId) await prisma.bibliotekMal.delete({ where: { id: ids.bibliotekMalId } });
  if (ids.bibliotekMalId2) await prisma.bibliotekMal.delete({ where: { id: ids.bibliotekMalId2 } });
  if (ids.kapittelId) await prisma.bibliotekKapittel.delete({ where: { id: ids.kapittelId } });
  if (ids.standardId) await prisma.bibliotekStandard.delete({ where: { id: ids.standardId } });
});

describe("Firmaarkiv: unik indeks mot dobbelt-lån (funn #10)", () => {
  it("blokkerer et andre lån av samme bibliotekmal til samme firma (P2002)", async () => {
    const forste = await prisma.organizationTemplate.create({
      // versjonAvHovedmal kreves nå på lånte maler (CHECK, migrering 20260916120000).
      data: { organizationId: ids.orgId, name: "Lån 1", laantFraBibliotekMalId: ids.bibliotekMalId, versjonAvHovedmal: 1 },
    });
    ids.orgTemplateIds.push(forste.id);

    let feilkode: string | null = null;
    try {
      const andre = await prisma.organizationTemplate.create({
        data: { organizationId: ids.orgId, name: "Lån 2", laantFraBibliotekMalId: ids.bibliotekMalId, versjonAvHovedmal: 1 },
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

  it("tillater lån på nytt etter at et tidligere lån er soft-slettet (partiell indeks)", async () => {
    // Retning 2 — HELE POENGET med den partielle indeksen. Var RØD mot den fulle indeksen
    // (P2002 på gjenlånet, fordi den slettede raden fortsatt talte); GRØNN etter fiksen.

    // 1. Lån inn.
    const laan1 = await prisma.organizationTemplate.create({
      data: {
        organizationId: ids.orgId,
        name: "Gjenlån — første",
        laantFraBibliotekMalId: ids.bibliotekMalId2,
        versjonAvHovedmal: 1,
      },
    });
    ids.orgTemplateIds.push(laan1.id);

    // 2. Soft-slett (raden består, deleted_at settes → faller ut av partiell indeks).
    await prisma.organizationTemplate.update({
      where: { id: laan1.id },
      data: { deletedAt: new Date() },
    });

    // 3. Lån den SAMME bibliotekmalen på nytt. Med full indeks: P2002. Med partiell: LOV.
    let feilkode: string | null = null;
    let laan2Id: string | null = null;
    try {
      const laan2 = await prisma.organizationTemplate.create({
        data: {
          organizationId: ids.orgId,
          name: "Gjenlån — etter sletting",
          laantFraBibliotekMalId: ids.bibliotekMalId2,
          versjonAvHovedmal: 1,
        },
      });
      laan2Id = laan2.id;
      ids.orgTemplateIds.push(laan2.id);
    } catch (e) {
      feilkode = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : "UKJENT";
    }

    // Gjenlånet SKAL lykkes — ingen constraint-feil, ny rad opprettet.
    expect(feilkode).toBeNull();
    expect(laan2Id).not.toBeNull();
  });
});
