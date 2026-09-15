import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma, prisma } from "@sitedoc/db";
import { randomUUID } from "crypto";
import { byggBibliotekRader, type BibliotekFeltData } from "@sitedoc/shared";
import { kopierObjektTre, type KildeObjekt } from "./objektkopi";

/**
 * Idempotent skriver som speiler migreringens NOT EXISTS-vakt OG seedens
 * `opprettMalHvisMangler` (samme `byggBibliotekRader`-fasit): skriv rader kun for en mal
 * som ennå ikke har noen. Definert her (ikke importert fra `packages/db/prisma`) fordi en
 * kryss-pakke-relativ import ville tatt seed-fila inn i api-bygget (utenfor rootDir).
 */
async function sikreRaderHvisMangler(
  templateId: string,
  malInnhold: BibliotekFeltData[],
): Promise<"opprettet" | "finnes"> {
  const antall = await prisma.bibliotekMalObjekt.count({ where: { templateId } });
  if (antall > 0) return "finnes";
  for (const rad of byggBibliotekRader(malInnhold)) {
    await prisma.bibliotekMalObjekt.create({
      data: {
        templateId,
        type: rad.type,
        label: rad.label,
        config: rad.config as Prisma.InputJsonValue,
        translations: rad.translations as Prisma.InputJsonValue,
        sortOrder: rad.sortOrder,
        required: rad.required,
      },
    });
  }
  return "opprettet";
}

/**
 * «Stille tomhet»-rekvittering #4: sentralmalens innhold bor nå i RADER (`BibliotekMalObjekt`),
 * materialisert av migrering 20260914120000_bibliotekmal_objekttabell etter `byggBibliotekRader`
 * (@sitedoc/shared). Fem enhetstester dekker transformasjonen med mock. DENNE beviser det
 * mockene IKKE kan: at heading-rader FAKTISK har tom `config` i databasen, at `translations`
 * lagres som tomt objekt (ikke NULL), at lånevegen kopierer radene verbatim mot EKTE data,
 * og at skrivingen er idempotent (den manuelle ROLLBACK-en gjort til en test).
 *
 * Mål-DB: engangs-sandkasse (aldri test/prod). Seed → teardown i afterAll.
 * Negativ kontroll kjørt av dokgen 2026-09-16, lokalt mot engangs-Postgres.
 */

const NS = "BIBOBJ";
const REF = "BIBOBJ-1";
const ids = { standardId: "", kapittelId: "", templateId: "", orgId: "", orgTemplateId: "" };

const MAL_INNHOLD: BibliotekFeltData[] = [
  { label: "Type materiale", type: "list_single", zone: "datafelter", fase: "FØR", config: { options: ["A", "B"] } },
  { label: "Dybde", type: "decimal", zone: "datafelter", fase: "FØR", config: { unit: "mm" } },
  { label: "Notat", type: "text_field", zone: "topptekst", fase: "UNDER", config: { multiline: true } },
  { label: "Resultat", type: "traffic_light", zone: "datafelter", fase: "ETTER", config: {} },
  { label: "Sluttkommentar", type: "text_field", zone: "datafelter", config: {} }, // uten fase → ingen heading
];

beforeAll(async () => {
  const standard = await prisma.bibliotekStandard.create({
    data: { kode: `${NS}-STD`, navn: "Test standard", sortering: 999 },
  });
  ids.standardId = standard.id;
  const kapittel = await prisma.bibliotekKapittel.create({
    data: { kode: "BOBJ", navn: "Test-kapittel", sortering: 1, standardId: standard.id },
  });
  ids.kapittelId = kapittel.id;

  // Sentralmal med FROSSEN malInnhold (kolonnen leses ikke lenger) — innholdet skrives
  // som rader av sikreRaderHvisMangler i testen under, slik migreringen/seeden gjør.
  const mal = await prisma.bibliotekMal.create({
    data: { kapittelId: kapittel.id, navn: "Test-mal objekt", referanse: REF, malInnhold: [] },
  });
  ids.templateId = mal.id;
});

afterAll(async () => {
  if (ids.orgTemplateId)
    await prisma.organizationTemplateObject.deleteMany({ where: { templateId: ids.orgTemplateId } });
  if (ids.orgTemplateId) await prisma.organizationTemplate.deleteMany({ where: { id: ids.orgTemplateId } });
  if (ids.orgId) await prisma.organization.deleteMany({ where: { id: ids.orgId } });
  // Bibliotek-radene kaskaderer på mal→kapittel→standard-sletting.
  if (ids.standardId) await prisma.bibliotekStandard.delete({ where: { id: ids.standardId } });
});

describe("Bibliotekmal objekt-rader (#4)", () => {
  it("rad-skriving er idempotent — andre kall skriver ingenting (ROLLBACK gjort til test)", async () => {
    const forste = await sikreRaderHvisMangler(ids.templateId, MAL_INNHOLD);
    expect(forste).toBe("opprettet");
    const antallEtterForste = await prisma.bibliotekMalObjekt.count({ where: { templateId: ids.templateId } });

    const andre = await sikreRaderHvisMangler(ids.templateId, MAL_INNHOLD);
    expect(andre).toBe("finnes");
    const antallEtterAndre = await prisma.bibliotekMalObjekt.count({ where: { templateId: ids.templateId } });
    // Idempotent: radantallet er uendret etter andre kall (ingen dobling).
    expect(antallEtterAndre).toBe(antallEtterForste);
    // 5 felt + 3 distinkte faser (FØR/UNDER/ETTER) = 8 rader.
    expect(antallEtterForste).toBe(8);
  });

  it("heading-rader har FAKTISK tom config i databasen — ikke bare i transformasjonen", async () => {
    const headings = await prisma.bibliotekMalObjekt.findMany({
      where: { templateId: ids.templateId, type: "heading" },
      orderBy: { sortOrder: "asc" },
    });
    expect(headings).toHaveLength(3);
    for (const h of headings) {
      // {} lagret i JSONB — ikke { zone: "datafelter" } (Design B, Krav 2-B), ikke NULL.
      expect(h.config).toEqual({});
      expect(h.config).not.toBeNull();
    }
    expect(headings.map((h) => h.label)).toEqual([
      "Kontroll FØR utførelse",
      "Kontroll UNDER utførelse",
      "Kontroll ETTER utførelse",
    ]);
  });

  it("translations lagres som tomt objekt med definert fallback — ALDRI NULL", async () => {
    const alle = await prisma.bibliotekMalObjekt.findMany({ where: { templateId: ids.templateId } });
    for (const rad of alle) {
      expect(rad.translations).toEqual({});
      expect(rad.translations).not.toBeNull();
    }
  });

  it("feltrader beholder sone + egen config (verbatim, ikke tapt)", async () => {
    const dybde = await prisma.bibliotekMalObjekt.findFirstOrThrow({
      where: { templateId: ids.templateId, label: "Dybde" },
    });
    // Sone først, feltets egen config vinner — samme form som den gamle lånevegen.
    expect(dybde.config).toEqual({ zone: "datafelter", unit: "mm" });
    const notat = await prisma.bibliotekMalObjekt.findFirstOrThrow({
      where: { templateId: ids.templateId, label: "Notat" },
    });
    expect(notat.config).toEqual({ zone: "topptekst", multiline: true });
  });

  it("lån fra rad-veien gir identisk resultat mot EKTE data (round-trip verbatim)", async () => {
    const org = await prisma.organization.create({ data: { name: `${NS} Firma` } });
    ids.orgId = org.id;
    const orgTemplate = await prisma.organizationTemplate.create({
      data: { organizationId: org.id, name: "Lånt mal", category: "sjekkliste", domain: "bygg" },
    });
    ids.orgTemplateId = orgTemplate.id;

    // Les sentralmalens rader (kilden lånevegen faktisk bruker).
    const kilde = await prisma.bibliotekMalObjekt.findMany({
      where: { templateId: ids.templateId },
      orderBy: { sortOrder: "asc" },
    });
    const kildeObjekter: KildeObjekt[] = kilde.map((o) => ({
      id: o.id, parentId: o.parentId, type: o.type, label: o.label,
      config: o.config, translations: o.translations, sortOrder: o.sortOrder, required: o.required,
    }));

    // Kopier verbatim inn i firmamalen (samme kopimekanikk som firmamal.ts/bibliotek.ts).
    await kopierObjektTre(
      kildeObjekter,
      (data) => prisma.organizationTemplateObject.create({
        data: { templateId: orgTemplate.id, ...data },
        select: { id: true },
      }),
      (id, parentId) => prisma.organizationTemplateObject.update({ where: { id }, data: { parentId } }).then(() => undefined),
    );

    const lant = await prisma.organizationTemplateObject.findMany({
      where: { templateId: orgTemplate.id },
      orderBy: { sortOrder: "asc" },
    });

    // Felt for felt identisk med sentralmalens rader — heading beholder tom config.
    expect(lant.map((o) => ({ type: o.type, label: o.label, config: o.config, translations: o.translations, required: o.required }))).toEqual(
      kilde.map((o) => ({ type: o.type, label: o.label, config: o.config, translations: o.translations, required: o.required })),
    );
  });
});
