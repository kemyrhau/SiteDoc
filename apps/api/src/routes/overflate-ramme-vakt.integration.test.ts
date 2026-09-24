import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";
import { createTestCaller } from "../test-harness/context";

/**
 * § F ramme-vakt — server-e2e mot EKTE DB (createCaller → overflate.hentForSammenligning).
 *
 * Beviser at to overflater i ULIKE koordinatrammer AVVISES på serveren FØR en kutt/fyll-
 * sammenligning slippes gjennom (en lokal/LAS-ramme vs. en landxml-ramme). Fjernes
 * `krevSammeRamme`-kallet i ruten, går sammenligningen gjennom med et feil volumtall —
 * da feiler test (1) nedenfor. Test (3) er rød-først-beviset: samme ramme SKAL passere.
 *
 * 🔴 Ikke mocket — hele veien gjennom tRPC-authz + prisma. Krever localhost-sandkasse med
 * migreringen 20260924120000_overflate_tabell anvendt. Commit-seed → teardown i afterAll.
 */
const NS = `rammevakt-${randomUUID().slice(0, 8)}`;
const id = { userId: "", projectId: "", lasId: "", landxmlId: "", landxml2Id: "" };
const bbox = { minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 10, maxZ: 5 };

beforeAll(async () => {
  const bruker = await prisma.user.create({
    data: { id: randomUUID(), name: `${NS} Bruker`, email: `${NS}@rammevakt.test`, role: "user" },
  });
  id.userId = bruker.id;
  const project = await prisma.project.create({
    data: { id: randomUUID(), projectNumber: NS, name: `${NS} Prosjekt`, primaryOrganizationId: null },
  });
  id.projectId = project.id;
  await prisma.projectMember.create({
    data: { id: randomUUID(), userId: bruker.id, projectId: project.id, role: "member" },
  });

  // Punktsky-overflate i provisorisk LAS-ramme (CHECK krever malavstand+bakkemetode).
  const las = await prisma.overflate.create({
    data: {
      projectId: project.id, navn: `${NS} LAS`, kilde: "punktsky", filUrl: "/uploads/overflater/dummy-las.stin",
      malavstandM: 0.15, bakkeMetode: "minZ", ramme: "las-utm", boundingBox: bbox,
    },
  });
  id.lasId = las.id;
  // LandXML-overflate i landxml-ramme (ULIK LAS-rammen).
  const lx = await prisma.overflate.create({
    data: {
      projectId: project.id, navn: `${NS} LandXML`, kilde: "landxml", filUrl: "/uploads/overflater/dummy-lx.stin",
      ramme: "landxml", boundingBox: bbox,
    },
  });
  id.landxmlId = lx.id;
  const lx2 = await prisma.overflate.create({
    data: {
      projectId: project.id, navn: `${NS} LandXML 2`, kilde: "landxml", filUrl: "/uploads/overflater/dummy-lx2.stin",
      ramme: "landxml", boundingBox: bbox,
    },
  });
  id.landxml2Id = lx2.id;
});

afterAll(async () => {
  await prisma.overflate.deleteMany({ where: { projectId: id.projectId } });
  await prisma.projectMember.deleteMany({ where: { projectId: id.projectId } });
  await prisma.project.deleteMany({ where: { id: id.projectId } });
  await prisma.user.deleteMany({ where: { id: id.userId } });
});

describe("overflate.hentForSammenligning — ramme-vakt (§ F)", () => {
  it("AVVISER to overflater i ulike rammer (las-utm vs landxml)", async () => {
    const caller = createTestCaller(id.userId);
    try {
      await caller.overflate.hentForSammenligning({
        projectId: id.projectId, toppId: id.lasId, bunnId: id.landxmlId,
      });
      expect.unreachable("skulle ha kastet ramme-vakt-feil");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).message).toMatch(/ulike koordinatrammer/);
    }
  });

  it("TILLATER to overflater i SAMME ramme (to landxml)", async () => {
    const caller = createTestCaller(id.userId);
    const res = await caller.overflate.hentForSammenligning({
      projectId: id.projectId, toppId: id.landxmlId, bunnId: id.landxml2Id,
    });
    expect(res.ramme).toBe("landxml");
    expect(res.topp.id).toBe(id.landxmlId);
    expect(res.bunn.id).toBe(id.landxml2Id);
  });
});
