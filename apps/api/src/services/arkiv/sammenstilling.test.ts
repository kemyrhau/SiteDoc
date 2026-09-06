import { describe, it, expect } from "vitest";
import sharp from "sharp";
import type { PrismaClient } from "@sitedoc/db";
import { byggSjekklisteArkivHtml, byggOppgaveArkivHtml } from "./sammenstilling";

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
    // Generert-stempel (sporbarhet); dokument-id utgått (funn 3)
    expect(r.html).toContain("Generert fra SiteDoc 11.08.2026 14:32");
    expect(r.html).not.toContain("dokument-id");
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

  it("D4: Dokumenthistorikk består alltid; Endringslogg-seksjonen er aldri i PDF", async () => {
    const r = await byggSjekklisteArkivHtml(fakePrisma(), "c1", {
      hentBildeBytes: async () => null,
      generertTekst: "x",
    });
    expect(r.html).toContain("Dokumenthistorikk");
    expect(r.html).not.toContain('ark-seksjon">Endringslogg');
  });
});

describe("byggOppgaveArkivHtml — task/HMS-adapter", () => {
  it("HMS RUH (Task, domain=hms): «Oppgave», terminal «Behandlet av» fra closed-transfer, byggeplass via tegning", async () => {
    const prisma = {
      task: {
        findUniqueOrThrow: async () => ({
          id: "t1",
          title: "RUH — nestenulykke stige",
          number: 7,
          status: "closed",
          createdAt: new Date("2026-09-01T08:00:00.000Z"),
          subject: "Fallfare",
          drawingId: null,
          positionX: null,
          positionY: null,
          lokasjonOmfang: null,
          data: { f1: { verdi: "Stige ikke sikret", kommentar: "", vedlegg: [] } },
          template: {
            projectId: "p1",
            prefix: "RUH",
            enableChangeLog: false,
            domain: "hms",
            objects: [{ id: "f1", type: "text_field", label: "Beskrivelse", required: false, config: {}, sortOrder: 0, parentId: null }],
          },
          bestiller: { name: "Ola Melder" },
          utforerFaggruppe: { name: "HMS" },
          bestillerFaggruppe: { name: "HMS", projectId: "p1" },
          drawing: { byggeplass: { name: "Tunnel Nord" } },
        }),
      },
      project: {
        findUnique: async () => ({
          name: "E6 Nord",
          projectNumber: "5501",
          primaryOrganization: { name: "Markussen AS", organizationNumber: "111 222 333", logoUrl: null },
        }),
      },
      drawing: { findMany: async () => [] },
      documentTransfer: {
        findMany: async () => [
          { createdAt: new Date("2026-09-01T08:00:00.000Z"), sender: { name: "Ola Melder" }, recipientUser: null, recipientGroup: { name: "HMS" }, recipientEnterpriseName: null, senderRolle: "melder", fromStatus: "draft", toStatus: "received", comment: null, dokumentflytName: null },
          { createdAt: new Date("2026-09-02T10:00:00.000Z"), sender: { name: "Kari Behandler" }, recipientUser: null, recipientGroup: null, recipientEnterpriseName: null, senderRolle: "behandler", fromStatus: "responded", toStatus: "closed", comment: "Tiltak iverksatt", dokumentflytName: null },
        ],
      },
      taskComment: { findMany: async () => [] },
      taskChangeLog: { findMany: async () => [] },
      user: { findMany: async () => [] },
    } as unknown as PrismaClient;

    const r = await byggOppgaveArkivHtml(prisma, "t1", { hentBildeBytes: async () => null, generertTekst: "x" });

    // Dokumenttype = Oppgave (topptekst + ramme)
    expect(r.html).toContain("Oppgave");
    // Task-semantikk: «Opprettet av»/«Behandlet av», ikke «Utført av»/«Godkjent av»
    expect(r.html).toContain("Opprettet av");
    expect(r.html).toContain("Behandlet av");
    expect(r.html).not.toContain("Utført av");
    // Terminal-signaturen hentes fra closed-transferen (behandler), ikke fra melder
    expect(r.html).toContain("Kari Behandler");
    // Dokumentnr fra number+prefix, filnavn med prefix
    expect(r.html).toContain("RUH-007");
    expect(r.filnavn).toBe("RUH-007.pdf");
    // Innhold rendret
    expect(r.html).toContain("Stige ikke sikret");
  });

  it("Task uten mal/data → tom innholdsseksjon uten kast; prosjekt hentes fra bestiller-faggruppe", async () => {
    const prisma = {
      task: {
        findUniqueOrThrow: async () => ({
          id: "t2",
          title: "Løs oppgave",
          number: null,
          status: "draft",
          createdAt: new Date("2026-09-01T08:00:00.000Z"),
          subject: null,
          drawingId: null,
          positionX: null,
          positionY: null,
          lokasjonOmfang: null,
          data: null,
          template: null,
          bestiller: { name: "Per" },
          utforerFaggruppe: null,
          bestillerFaggruppe: { name: "Drift", projectId: "p9" },
          drawing: null,
        }),
      },
      project: { findUnique: async () => ({ name: "P9", projectNumber: "9", primaryOrganization: null }) },
      drawing: { findMany: async () => [] },
      documentTransfer: { findMany: async () => [] },
      taskComment: { findMany: async () => [] },
      taskChangeLog: { findMany: async () => [] },
      user: { findMany: async () => [] },
    } as unknown as PrismaClient;

    const r = await byggOppgaveArkivHtml(prisma, "t2", { hentBildeBytes: async () => null, generertTekst: "x" });
    // Ingen kast, dokument bygget, filnavn faller til oppgave-prefiks + id.
    expect(r.filnavn).toBe("oppgave-t2.pdf");
    expect(r.html).toContain("Oppgave");
  });
});
