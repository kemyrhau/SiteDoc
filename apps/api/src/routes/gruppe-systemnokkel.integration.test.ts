import { describe, it, expect, afterAll } from "vitest";
import { Prisma, prisma } from "@sitedoc/db";
import { randomUUID } from "crypto";
import { sikreHmsGruppe } from "./modul";

/**
 * «Stille tomhet»-rekvittering #3 — den ALVORLIGSTE: den er selve saken som skapte
 * regelen. To grupper bar `domains:["hms"]`, `find()` plukket vilkårlig, og HMS-gruppa ble
 * aldri opprettet fordi oppslaget trodde den fantes. Fiksen (migrering
 * 20260910130000_gruppe_systemnokkel) ga `project_groups.system_nokkel` + en PARTIELL
 * unik-indeks `(project_id, system_nokkel) WHERE system_nokkel IS NOT NULL`.
 *
 * Den mockede testen (`hms-gruppe-systemnokkel.test.ts`) MODELLERER den partielle indeksen
 * i en fake-tx. DENNE beviser garantien mot EKTE Postgres, og at deteksjonen (`sikreHmsGruppe`)
 * bruker systemNokkel og ikke domener — krav (c): en test som FEILER hvis kolonnen er tom
 * der den skal ha verdi.
 *
 * Mål-DB: engangs-sandkasse (aldri test/prod). Hvert scenario får eget prosjekt; teardown i afterAll.
 * Negativ kontroll kjørt av dokgen 2026-09-16, lokalt mot engangs-Postgres.
 */

const NS = "SYSNOKKEL";
const sporede = { projectIds: [] as string[] };

async function nyttProsjekt(): Promise<string> {
  const kjoreId = randomUUID().slice(0, 8);
  const p = await prisma.project.create({
    data: { id: randomUUID(), projectNumber: `${NS}-${kjoreId}`, name: `${NS} ${kjoreId}`, primaryOrganizationId: null },
  });
  sporede.projectIds.push(p.id);
  return p.id;
}

afterAll(async () => {
  if (sporede.projectIds.length) {
    await prisma.projectGroup.deleteMany({ where: { projectId: { in: sporede.projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: sporede.projectIds } } });
  }
});

describe("HMS-gruppe: entydig via systemNokkel (#3)", () => {
  it("deteksjonen bruker systemNokkel, IKKE domener — en bred hms-gruppe tilfredsstiller ikke kravet", async () => {
    const projectId = await nyttProsjekt();

    // Fella: prosjekt-admin bærer «hms» som ett av flere bredde-domener, systemNokkel=null.
    const bred = await prisma.projectGroup.create({
      data: {
        id: randomUUID(), projectId, name: "Prosjektadmin", slug: "prosjektadmin",
        domains: ["bygg", "hms", "kvalitet"], systemNokkel: null,
      },
    });

    const hms = await prisma.$transaction((tx) => sikreHmsGruppe(tx, projectId));

    // Deteksjonen skal IKKE ha plukket den brede gruppa — den skal ha opprettet en ny, markert.
    expect(hms.id).not.toBe(bred.id);
    const markert = await prisma.projectGroup.findFirst({ where: { projectId, systemNokkel: "hms" } });
    expect(markert?.id).toBe(hms.id);
    // Den brede gruppa er urørt (fortsatt umarkert).
    const bredEtter = await prisma.projectGroup.findUnique({ where: { id: bred.id } });
    expect(bredEtter?.systemNokkel).toBeNull();
  });

  it("en umarkert HMS-gruppe (systemNokkel=NULL) DETEKTERES IKKE — tom kolonne = usynlig for oppslaget", async () => {
    const projectId = await nyttProsjekt();

    // Ser ut som HMS-gruppa (domener + slug), men kolonnen er tom.
    await prisma.projectGroup.create({
      data: {
        id: randomUUID(), projectId, name: "HMS-ansvarlige", slug: "hms-ansvarlige",
        domains: ["hms"], systemNokkel: null,
      },
    });

    // Krav (c) i renform: oppslaget på systemNokkel BOMMER når kolonnen er tom.
    const funnet = await prisma.projectGroup.findFirst({ where: { projectId, systemNokkel: "hms" } });
    expect(funnet).toBeNull();
  });

  it("sikreHmsGruppe er idempotent — andre kall gir samme gruppe, ikke en ny", async () => {
    const projectId = await nyttProsjekt();
    const forste = await prisma.$transaction((tx) => sikreHmsGruppe(tx, projectId));
    const andre = await prisma.$transaction((tx) => sikreHmsGruppe(tx, projectId));
    expect(andre.id).toBe(forste.id);
    const antall = await prisma.projectGroup.count({ where: { projectId, systemNokkel: "hms" } });
    expect(antall).toBe(1);
  });

  it("DB-GARANTI: to grupper med systemNokkel='hms' i samme prosjekt er umulig (P2002)", async () => {
    const projectId = await nyttProsjekt();
    await prisma.projectGroup.create({
      data: { id: randomUUID(), projectId, name: "HMS 1", slug: "hms-1", domains: ["hms"], systemNokkel: "hms" },
    });

    let feilkode: string | null = null;
    try {
      await prisma.projectGroup.create({
        data: { id: randomUUID(), projectId, name: "HMS 2", slug: "hms-2", domains: ["hms"], systemNokkel: "hms" },
      });
    } catch (e) {
      feilkode = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : "UKJENT";
    }
    // Den partielle unik-indeksen (project_id, system_nokkel) WHERE NOT NULL biter.
    // Garantien hviler IKKE på backfillen alene.
    expect(feilkode).toBe("P2002");
  });

  it("umarkerte grupper (systemNokkel=NULL) kan være mange i samme prosjekt — NULLS DISTINCT", async () => {
    const projectId = await nyttProsjekt();
    const g1 = await prisma.projectGroup.create({
      data: { id: randomUUID(), projectId, name: "Vanlig 1", slug: "vanlig-1", domains: ["bygg"], systemNokkel: null },
    });
    const g2 = await prisma.projectGroup.create({
      data: { id: randomUUID(), projectId, name: "Vanlig 2", slug: "vanlig-2", domains: ["bygg"], systemNokkel: null },
    });
    // WHERE system_nokkel IS NOT NULL gjør at umarkerte grupper aldri kolliderer.
    expect(g1.id).not.toBe(g2.id);
  });
});
