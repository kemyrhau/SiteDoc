import { describe, it, expect } from "vitest";
import sharp from "sharp";
import type { PrismaClient } from "@sitedoc/db";
import { byggSjekklisteArkivHtml } from "./sammenstilling";

async function png(): Promise<Buffer> {
  return sharp({ create: { width: 16, height: 16, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.4 } } }).png().toBuffer();
}

function fakePrisma(): PrismaClient {
  return {
    checklist: {
      findUniqueOrThrow: async () => ({
        id: "c1",
        title: "Betongarbeider",
        number: 1,
        status: "approved",
        createdAt: new Date("2026-08-08T09:14:00.000Z"),
        data: {
          f1: {
            // attachments-felt: filene ER verdien (per felt.ts:126)
            verdi: [
              { url: "/u/ok.png", filnavn: "ok.png", type: "bilde" },
              { url: "/u/borte.png", filnavn: "borte.png", type: "bilde" },
            ],
            kommentar: "",
            vedlegg: [],
          },
        },
        template: {
          projectId: "p1",
          prefix: "BEF",
          enableChangeLog: false,
          objects: [{ id: "f1", type: "attachments", label: "Foto", required: false, config: {}, sortOrder: 0, parentId: null }],
        },
        bestiller: { name: "Mathias Berg" },
        utforerFaggruppe: { name: "HE-Ansatte" },
        bestillerFaggruppe: { name: "Byggeledelse" },
        byggeplass: { name: "Blokk B" },
      }),
    },
    project: {
      findUnique: async () => ({
        name: "Boligfelt B12",
        projectNumber: "998",
        primaryOrganization: { name: "SiteDoc AS", organizationNumber: "923 456 789", logoUrl: null },
      }),
    },
    documentTransfer: {
      findMany: async () => [
        { createdAt: new Date("2026-08-08T09:14:00.000Z"), sender: { name: "Silje Havstad" }, recipientUser: null, recipientGroup: null, recipientEnterpriseName: null, senderRolle: "godkjenner", fromStatus: "responded", toStatus: "approved", comment: null, dokumentflytName: null },
      ],
    },
    checklistChangeLog: { findMany: async () => [] },
    user: { findMany: async () => [] },
  } as unknown as PrismaClient;
}

describe("byggSjekklisteArkivHtml — orkestrator", () => {
  it("kjeder data → HTML: firma, status, innhold, logg, inlinet bilde + mangel", async () => {
    const bilde = await png();
    const hentBildeBytes = async (url: string) => (url === "/u/ok.png" ? bilde : null);

    const r = await byggSjekklisteArkivHtml(fakePrisma(), "c1", { hentBildeBytes, generertTekst: "11.08.2026 14:32" });

    // Firma (org) i topptekst
    expect(r.html).toContain("SiteDoc AS");
    expect(r.html).toContain("Org.nr 923 456 789");
    // Status (semantisk tekst)
    expect(r.html).toContain("Godkjent");
    // Dokumentnr fra number+prefix
    expect(r.html).toContain("BEF-001");
    // Logg lag 1
    expect(r.html).toContain("Dokumenthistorikk");
    // Godt bilde inlinet som JPEG
    expect(r.html).toContain("data:image/jpeg;base64,");
    // Dårlig bilde → manglende + mangel-merknad i dokumentet
    expect(r.manglendeVedlegg).toContain("/u/borte.png");
    expect(r.html).toContain("MANGLENDE VEDLEGG");
    // Ikke-inlinet bilde erstattes med placeholder-data-URI i KROPPEN — aldri
    // en gjenstående nettverks-url (som ville hengt bilde-vakten 20 s i containeren).
    expect(r.html).toContain("data:image/svg+xml;base64,");
    expect(r.html).not.toContain('src="/u/borte.png"');
    // Generert-stempel (sporbarhet)
    expect(r.html).toContain("Generert fra SiteDoc 11.08.2026 14:32 · dokument-id c1");
  });

  it("samler bilder nestet i repeater-rader (celle-vedlegg) → manglendeVedlegg", async () => {
    // Repeater med ett bilde nestet i en celle-vedlegg. Uten rekursjon i
    // bilderIFelt ble dette aldri samlet → underrapportert (BEF-001: 14 av 18).
    const prisma = {
      checklist: {
        findUniqueOrThrow: async () => ({
          id: "c2",
          title: "Befaring",
          number: 2,
          status: "approved",
          createdAt: new Date("2026-08-08T09:14:00.000Z"),
          data: {
            rep: {
              verdi: [{ kol: { verdi: null, kommentar: "", vedlegg: [{ url: "/u/nestet.png", filnavn: "nestet.png", type: "bilde" }] } }],
              kommentar: "",
              vedlegg: [],
            },
          },
          template: {
            projectId: "p1",
            prefix: "BEF",
            enableChangeLog: false,
            objects: [
              { id: "rep", type: "repeater", label: "Rader", required: false, config: {}, sortOrder: 0, parentId: null },
              { id: "kol", type: "attachments", label: "Foto", required: false, config: {}, sortOrder: 1, parentId: "rep" },
            ],
          },
          bestiller: { name: "M" },
          utforerFaggruppe: { name: "HE" },
          bestillerFaggruppe: { name: "BL" },
          byggeplass: { name: "B" },
        }),
      },
      project: { findUnique: async () => ({ name: "P", projectNumber: "1", primaryOrganization: null }) },
      documentTransfer: { findMany: async () => [] },
      checklistChangeLog: { findMany: async () => [] },
      user: { findMany: async () => [] },
    } as unknown as PrismaClient;

    const r = await byggSjekklisteArkivHtml(prisma, "c2", { hentBildeBytes: async () => null, generertTekst: "x" });
    // Rekursjonen fant det nestede bildet (ville manglet før fiksen).
    expect(r.manglendeVedlegg).toContain("/u/nestet.png");
  });

  it("respekterer taMedEndringslogg=false (men Dokumenthistorikk består)", async () => {
    const r = await byggSjekklisteArkivHtml(fakePrisma(), "c1", {
      hentBildeBytes: async () => null,
      generertTekst: "x",
      taMedEndringslogg: false,
    });
    expect(r.html).toContain("Dokumenthistorikk");
  });
});
