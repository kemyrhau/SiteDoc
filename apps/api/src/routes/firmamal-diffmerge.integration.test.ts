import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import type { Prisma } from "@sitedoc/db";
import { firmamalRouter } from "./firmamal";

/**
 * Ordre diffmerge-oppdater-kopi (2026-09-17): `firmamal.oppdaterKopiFraHovedmal` (↻ firma→prosjekt)
 * ERSTATTER blankosperren fra forrige runde med ekte diff/merge. Kenneths regel: «prosjektmal kan
 * kun oppdateres dersom tidligere lagrede data ikke berøres». MATCHEDE objekter beholder sin id
 * (update, ikke delete+create) → Checklist/Task.data følger automatisk og røres aldri. NEKT KUN når
 * et umatchet GAMMELT objekt HAR DATA — og feilmeldingen NAVNGIR feltene.
 *
 * Matchingsregel (Kenneth-vedtak 17.09): nøkkel (type,label). ENTYDIG nøkkel (én gang i begge trær)
 * → match på tvers av forelder (flyttet felt beholder data). TVETYDIG → forelder-avhengig, gjett
 * aldri; umatchet gammelt-med-data → NEKT.
 *
 * Krav 5 — «stille tomhet», krav (c): syv retninger, alle sett RØDE først (se rapporten). Går
 * gjennom PROSEDYREN (createCaller). Auth: sitedoc_admin. Mål-DB: localhost/CI-sandkasse.
 */

const ids = { userId: "", orgId: "", projectId: "" };
let teller = 0;

async function lagFirmamal(): Promise<string> {
  const fm = await prisma.organizationTemplate.create({
    data: { organizationId: ids.orgId, name: `Firmamal ${teller++}`, category: "sjekkliste" },
  });
  return fm.id;
}
async function firmaObjekt(
  templateId: string,
  o: { type: string; label: string; sortOrder: number; parentId?: string },
): Promise<string> {
  const r = await prisma.organizationTemplateObject.create({
    data: { templateId, type: o.type, label: o.label, sortOrder: o.sortOrder, parentId: o.parentId },
  });
  return r.id;
}
async function lagProsjektmal(firmamalId: string): Promise<string> {
  const m = await prisma.reportTemplate.create({
    data: {
      projectId: ids.projectId,
      name: `Prosjektmal ${teller++}`,
      category: "sjekkliste",
      organizationTemplateId: firmamalId,
      versjonAvHovedmal: 1,
    },
  });
  return m.id;
}
async function prosjektObjekt(
  templateId: string,
  o: { type: string; label: string; sortOrder: number; parentId?: string },
): Promise<string> {
  const r = await prisma.reportObject.create({
    data: { templateId, type: o.type, label: o.label, sortOrder: o.sortOrder, parentId: o.parentId },
  });
  return r.id;
}
async function lagSjekkliste(templateId: string, data: Record<string, unknown>): Promise<string> {
  const c = await prisma.checklist.create({
    data: { templateId, bestillerUserId: ids.userId, title: "Dok", status: "draft", data: data as Prisma.InputJsonValue },
  });
  return c.id;
}
const medVerdi = (verdi: string) => ({ verdi, kommentar: "", vedlegg: [] });

function caller() {
  const ctx = {
    userId: ids.userId,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: () => {}, warn: () => {} } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return firmamalRouter.createCaller(ctx);
}

beforeAll(async () => {
  const bruker = await prisma.user.create({
    data: { email: "diffmerge-test@sitedoc.test", name: "Diffmerge admin", role: "sitedoc_admin" },
  });
  ids.userId = bruker.id;
  const org = await prisma.organization.create({ data: { name: "Test-firma diffmerge" } });
  ids.orgId = org.id;
  const prosjekt = await prisma.project.create({
    data: { projectNumber: "SD-DIFFMERGE-1", name: "Diffmerge-prosjekt", primaryOrganizationId: org.id },
  });
  ids.projectId = prosjekt.id;
});

afterAll(async () => {
  await prisma.checklist.deleteMany({ where: { template: { projectId: ids.projectId } } });
  await prisma.reportObject.deleteMany({ where: { template: { projectId: ids.projectId } } });
  await prisma.reportTemplate.deleteMany({ where: { projectId: ids.projectId } });
  await prisma.organizationTemplateObject.deleteMany({ where: { template: { organizationId: ids.orgId } } });
  await prisma.organizationTemplate.deleteMany({ where: { organizationId: ids.orgId } });
  if (ids.projectId) await prisma.project.deleteMany({ where: { id: ids.projectId } });
  if (ids.orgId) await prisma.organization.deleteMany({ where: { id: ids.orgId } });
  if (ids.userId) await prisma.user.deleteMany({ where: { id: ids.userId } });
});

describe("firmamal.oppdaterKopiFraHovedmal — diff/merge (ordre 2026-09-17)", () => {
  it("(1) Felt UENDRET med data → beholder id OG data etter ↻", async () => {
    const fm = await lagFirmamal();
    await firmaObjekt(fm, { type: "traffic_light", label: "Kontroll", sortOrder: 1 });
    const mal = await lagProsjektmal(fm);
    const objId = await prosjektObjekt(mal, { type: "traffic_light", label: "Kontroll", sortOrder: 1 });
    const clId = await lagSjekkliste(mal, { [objId]: medVerdi("green") });

    await caller().oppdaterKopiFraHovedmal({ templateId: mal });

    // Samme id lever (matchet, ikke slettet+opprettet) → data intakt.
    const obj = await prisma.reportObject.findUnique({ where: { id: objId } });
    expect(obj).not.toBeNull();
    const cl = await prisma.checklist.findUniqueOrThrow({ where: { id: clId } });
    expect((cl.data as Record<string, { verdi: string }>)[objId]?.verdi).toBe("green");
  });

  it("(2) Felt LAGT TIL i firmamal → opprettes, eksisterende data urørt", async () => {
    const fm = await lagFirmamal();
    await firmaObjekt(fm, { type: "traffic_light", label: "Kontroll", sortOrder: 1 });
    await firmaObjekt(fm, { type: "traffic_light", label: "Ny sjekk", sortOrder: 2 });
    const mal = await lagProsjektmal(fm);
    const objId = await prosjektObjekt(mal, { type: "traffic_light", label: "Kontroll", sortOrder: 1 });
    const clId = await lagSjekkliste(mal, { [objId]: medVerdi("green") });

    await caller().oppdaterKopiFraHovedmal({ templateId: mal });

    const alle = await prisma.reportObject.findMany({ where: { templateId: mal } });
    expect(alle).toHaveLength(2);
    expect(alle.some((o) => o.label === "Ny sjekk")).toBe(true);
    const cl = await prisma.checklist.findUniqueOrThrow({ where: { id: clId } });
    expect((cl.data as Record<string, { verdi: string }>)[objId]?.verdi).toBe("green");
  });

  it("(3) Felt FJERNET uten data → slettes, ↻ går gjennom (annet felt HAR data)", async () => {
    const fm = await lagFirmamal();
    await firmaObjekt(fm, { type: "traffic_light", label: "Kontroll", sortOrder: 1 });
    const mal = await lagProsjektmal(fm);
    const beholdt = await prosjektObjekt(mal, { type: "traffic_light", label: "Kontroll", sortOrder: 1 });
    const fjernet = await prosjektObjekt(mal, { type: "text_field", label: "Gammel merknad", sortOrder: 2 });
    const clId = await lagSjekkliste(mal, { [beholdt]: medVerdi("green") }); // fjernet-feltet er TOMT

    await caller().oppdaterKopiFraHovedmal({ templateId: mal });

    expect(await prisma.reportObject.findUnique({ where: { id: fjernet } })).toBeNull();
    expect(await prisma.reportObject.findUnique({ where: { id: beholdt } })).not.toBeNull();
    const cl = await prisma.checklist.findUniqueOrThrow({ where: { id: clId } });
    expect((cl.data as Record<string, { verdi: string }>)[beholdt]?.verdi).toBe("green");
  });

  it("(4) Felt FJERNET med data → NEKTES, og feltet NAVNGIS i meldingen", async () => {
    const fm = await lagFirmamal();
    await firmaObjekt(fm, { type: "traffic_light", label: "Kontroll", sortOrder: 1 });
    const mal = await lagProsjektmal(fm);
    await prosjektObjekt(mal, { type: "traffic_light", label: "Kontroll", sortOrder: 1 });
    const fjernetMedData = await prosjektObjekt(mal, { type: "text_field", label: "Fuktmåling", sortOrder: 2 });
    await lagSjekkliste(mal, { [fjernetMedData]: medVerdi("14 %") });

    let feilkode: string | null = null;
    let melding = "";
    try {
      await caller().oppdaterKopiFraHovedmal({ templateId: mal });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      feilkode = err.code ?? "UKJENT";
      melding = err.message ?? "";
    }
    expect(feilkode).toBe("PRECONDITION_FAILED");
    expect(melding).toContain("Fuktmåling"); // feltet NAVNGIS
    expect(melding).not.toContain("Hent fra arkiv"); // ikke den avviste utveien
    // Ingenting ble skrevet: feltet med data står fortsatt.
    expect(await prisma.reportObject.findUnique({ where: { id: fjernetMedData } })).not.toBeNull();
  });

  it("(5) Firmanivå urørt — firmamal.slettObjekt sletter fritt selv med utfylt avledet dokument", async () => {
    const fm = await lagFirmamal();
    const firmaObjId = await firmaObjekt(fm, { type: "traffic_light", label: "Kontroll", sortOrder: 1 });
    const mal = await lagProsjektmal(fm);
    const objId = await prosjektObjekt(mal, { type: "traffic_light", label: "Kontroll", sortOrder: 1 });
    await lagSjekkliste(mal, { [objId]: medVerdi("green") });

    // Ingen sperre på firmanivå (Kenneth 17.09): firmamaler skal ALLTID kunne redigeres.
    await caller().slettObjekt({ id: firmaObjId });
    expect(await prisma.organizationTemplateObject.findUnique({ where: { id: firmaObjId } })).toBeNull();
  });

  it("(6) TVETYDIG (type,label) under ulike overskrifter, ett har data → NEKTES (gjetter ikke)", async () => {
    // To «Måling»-felt i prosjektmalen (ambiguøs nøkkel). Firmamalen har «Måling» KUN under B.
    const fm = await lagFirmamal();
    const fmA = await firmaObjekt(fm, { type: "heading", label: "Grunn", sortOrder: 1 });
    const fmB = await firmaObjekt(fm, { type: "heading", label: "Overflate", sortOrder: 2 });
    await firmaObjekt(fm, { type: "traffic_light", label: "Måling", sortOrder: 3, parentId: fmB });

    const mal = await lagProsjektmal(fm);
    const pA = await prosjektObjekt(mal, { type: "heading", label: "Grunn", sortOrder: 1 });
    const pB = await prosjektObjekt(mal, { type: "heading", label: "Overflate", sortOrder: 2 });
    const maalingA = await prosjektObjekt(mal, { type: "traffic_light", label: "Måling", sortOrder: 3, parentId: pA });
    await prosjektObjekt(mal, { type: "traffic_light", label: "Måling", sortOrder: 4, parentId: pB });
    void fmA;
    await lagSjekkliste(mal, { [maalingA]: medVerdi("green") }); // data i A sin Måling

    let feilkode: string | null = null;
    let melding = "";
    try {
      await caller().oppdaterKopiFraHovedmal({ templateId: mal });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      feilkode = err.code ?? "UKJENT";
      melding = err.message ?? "";
    }
    // A sin Måling (data) har ingen match under A i firmamalen → NEKT, ikke flytt data til B.
    expect(feilkode).toBe("PRECONDITION_FAILED");
    expect(melding).toContain("Måling");
  });

  it("(7) Felt FLYTTET til ny overskrift, ENTYDIG nøkkel, har data → beholder id+data", async () => {
    // «Fuktmåling» finnes én gang i begge trær (entydig) men under ulik overskrift → match på tvers.
    const fm = await lagFirmamal();
    const fmB = await firmaObjekt(fm, { type: "heading", label: "Overflate", sortOrder: 1 });
    await firmaObjekt(fm, { type: "text_field", label: "Fuktmåling", sortOrder: 2, parentId: fmB });

    const mal = await lagProsjektmal(fm);
    const pA = await prosjektObjekt(mal, { type: "heading", label: "Grunn", sortOrder: 1 });
    const fukt = await prosjektObjekt(mal, { type: "text_field", label: "Fuktmåling", sortOrder: 2, parentId: pA });
    const clId = await lagSjekkliste(mal, { [fukt]: medVerdi("14 %") });

    await caller().oppdaterKopiFraHovedmal({ templateId: mal });

    // Samme id lever (matchet på tvers av forelder), data intakt, ny forelder = «Overflate».
    const obj = await prisma.reportObject.findUnique({ where: { id: fukt } });
    expect(obj).not.toBeNull();
    const nyForelder = obj?.parentId ? await prisma.reportObject.findUnique({ where: { id: obj.parentId } }) : null;
    expect(nyForelder?.label).toBe("Overflate");
    const cl = await prisma.checklist.findUniqueOrThrow({ where: { id: clId } });
    expect((cl.data as Record<string, { verdi: string }>)[fukt]?.verdi).toBe("14 %");
  });
});
