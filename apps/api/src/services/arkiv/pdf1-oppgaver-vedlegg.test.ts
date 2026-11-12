import { describe, it, expect, vi, beforeEach } from "vitest";
import { PDFDocument } from "pdf-lib";

/**
 * PDF-1 (ordre 2026-11-12, Kenneth): oppgaver og vedlegg i sjekkliste-PDF.
 *  - hentSjekklisteOppgaver: henvisningslinjer + oppgave-id-er, 🔴 aldri fra et annet prosjekt,
 *    aldri en oppgave brukeren mangler tilgang til.
 *  - rendrArkivPdf: «Ta med oppgaver» av → ingen oppgavedel; på → én del pr. oppgave.
 *    «Ta med vedlegg» → PDF-vedlegg bakerst. Uten flagg → dagens resultat.
 */

const { hentBytes, sjekkliste, oppgave } = vi.hoisted(() => ({
  hentBytes: vi.fn(),
  sjekkliste: vi.fn(),
  oppgave: vi.fn(),
}));
vi.mock("./disk-bilde", () => ({ hentBildeBytesFraDisk: hentBytes }));
vi.mock("./sammenstilling", () => ({ byggSjekklisteArkivHtml: sjekkliste, byggOppgaveArkivHtml: oppgave }));

import { hentSjekklisteOppgaver } from "./oppgave-henvisning";
import { rendrArkivPdf, leggVedleggBakerst } from "./render";
import type { PrismaClient } from "@sitedoc/db";

const P = "prosjekt-a";
const ANNET = "prosjekt-b";

async function lagPdf(sider: number, bredde: number): Promise<Buffer> {
  const d = await PDFDocument.create();
  for (let i = 0; i < sider; i++) d.addPage([bredde, 800]);
  return Buffer.from(await d.save());
}

const oppgaveRad = (id: string, number: number, felt: string | null, prosjekt: string, ekstra: Record<string, unknown> = {}) => ({
  id, number, title: `Tittel ${id}`, status: "sent", checklistFieldId: felt,
  bestillerFaggruppeId: "fg1", utforerFaggruppeId: "fg2",
  bestillerFaggruppe: { projectId: prosjekt },
  template: { projectId: prosjekt, prefix: "BEF", domain: "bygg", hmsSynlighet: null },
  ...ekstra,
});

function prismaMed(rader: unknown[]) {
  const findMany = vi.fn().mockResolvedValue(rader);
  return { prisma: { task: { findMany } } as unknown as PrismaClient, findMany };
}

describe("hentSjekklisteOppgaver", () => {
  it("to oppgaver på ett felt → én linje med begge, i rekkefølge", async () => {
    const { prisma } = prismaMed([oppgaveRad("o1", 15, "f1", P), oppgaveRad("o2", 16, "f1", P)]);
    const r = await hentSjekklisteOppgaver(prisma, "sj1", P);
    expect(r.ider).toEqual(["o1", "o2"]);
    expect(r.henvisninger.f1).toMatch(/^Oppgaver: BEF-0*15 Tittel o1 \(.+\) · BEF-0*16 Tittel o2 \(.+\)$/);
  });

  it("repeater-rad-nøkkel beholdes (`rep:rad`)", async () => {
    const { prisma } = prismaMed([oppgaveRad("o1", 1, "rep:r2", P)]);
    expect(Object.keys((await hentSjekklisteOppgaver(prisma, "sj1", P)).henvisninger)).toEqual(["rep:r2"]);
  });

  it("🔴 negativkontroll: oppgave fra annet prosjekt kommer aldri med (spørring + utledning)", async () => {
    const { prisma, findMany } = prismaMed([
      oppgaveRad("o1", 1, "f1", P),
      oppgaveRad("fremmed", 2, "f1", ANNET),
      // mal-løs oppgave: prosjekt fra bestiller-faggruppa
      oppgaveRad("malløs", 3, "f1", ANNET, { template: null }),
    ]);
    const r = await hentSjekklisteOppgaver(prisma, "sj1", P);
    expect(r.ider).toEqual(["o1"]);
    expect(r.henvisninger.f1).not.toContain("fremmed");
    expect(r.henvisninger.f1).not.toContain("malløs");
    const where = findMany.mock.calls[0]![0].where;
    expect(JSON.stringify(where.OR)).toContain(P);
    expect(where.deletedAt).toBeNull();
  });

  it("🔴 oppgave uten tilgang utelates både fra linje og deler", async () => {
    const { prisma } = prismaMed([oppgaveRad("o1", 1, "f1", P), oppgaveRad("hemmelig", 2, "f1", P)]);
    const r = await hentSjekklisteOppgaver(prisma, "sj1", P, async (o) => o.id !== "hemmelig");
    expect(r.ider).toEqual(["o1"]);
    expect(r.henvisninger.f1).not.toContain("hemmelig");
  });
});

describe("leggVedleggBakerst", () => {
  it("PDF-vedlegg legges BAKERST; uleselig/ugyldig fil → manglende med filnavn", async () => {
    const hoved = await lagPdf(2, 600);
    const vedlegg = await lagPdf(1, 333);
    const hent = vi.fn(async (url: string) =>
      url === "/ok.pdf" ? vedlegg : url === "/tull.pdf" ? Buffer.from("ikke en pdf") : null,
    );
    const r = await leggVedleggBakerst(hoved, [
      { url: "/ok.pdf", filnavn: "ok.pdf" },
      { url: "/borte.pdf", filnavn: "borte.pdf" },
      { url: "/tull.pdf", filnavn: "tull.pdf" },
    ], hent);
    const doc = await PDFDocument.load(r.pdf);
    expect(doc.getPageCount()).toBe(3);
    expect(Math.round(doc.getPage(2).getWidth())).toBe(333);
    expect(r.manglende).toEqual(["borte.pdf", "tull.pdf"]);
  });
});

describe("rendrArkivPdf — utskriftsvalg", () => {
  const resultat = (side: string, ekstra: Record<string, unknown> = {}) => ({
    side, tittel: side, filnavn: `${side}.pdf`, prosjektRef: "P",
    ramme: { firmaNavn: "F", dokumenttype: "Sjekkliste", dokumentnavn: side, dokumentnummer: "", dokumentId: "", prosjekt: "P", logoDataUrl: null },
    manglendeVedlegg: [], oppgaveIder: [], pdfVedlegg: [], ...ekstra,
  });
  let sendtHtml = "";

  beforeEach(async () => {
    sjekkliste.mockReset().mockImplementation(async () =>
      resultat("SJEKKLISTE", { oppgaveIder: ["o1", "o2"], pdfVedlegg: [{ url: "/v.pdf", filnavn: "v.pdf" }] }),
    );
    oppgave.mockReset().mockImplementation(async (_p: unknown, id: string) => resultat(`OPPGAVE-${id}`));
    hentBytes.mockReset().mockImplementation(async () => lagPdf(1, 333));
    const hovedPdf = await lagPdf(1, 600);
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
      sendtHtml = JSON.parse(init.body).html;
      return new Response(hovedPdf, { status: 200 });
    }));
  });

  const kjør = (flagg: { medOppgaver?: boolean; medVedlegg?: boolean } = {}) =>
    rendrArkivPdf({} as PrismaClient, [{ id: "sj1", type: "sjekkliste" }], { generertTekst: "g", datoForFilnavn: "2026-11-12", ...flagg });

  it("medOppgaver av → ingen oppgavedel", async () => {
    await kjør({ medOppgaver: false });
    expect(oppgave).not.toHaveBeenCalled();
    expect(sendtHtml).not.toContain("OPPGAVE-");
  });

  it("medOppgaver på → én del pr. oppgave, etter sjekklista; enkelt-filnavn beholdes", async () => {
    const r = await kjør({ medOppgaver: true });
    expect(oppgave).toHaveBeenCalledTimes(2);
    expect(sendtHtml.indexOf("OPPGAVE-o1")).toBeGreaterThan(sendtHtml.indexOf("SJEKKLISTE"));
    expect(sendtHtml.indexOf("OPPGAVE-o2")).toBeGreaterThan(sendtHtml.indexOf("OPPGAVE-o1"));
    expect(r.filnavn).toBe("SJEKKLISTE.pdf");
    expect(r.dokumenter).toHaveLength(1);
  });

  it("medVedlegg på → PDF-vedlegget er siste side", async () => {
    const r = await kjør({ medVedlegg: true });
    const doc = await PDFDocument.load(r.pdf);
    expect(doc.getPageCount()).toBe(2);
    expect(Math.round(doc.getPage(1).getWidth())).toBe(333);
  });

  it("uten flagg → dagens resultat: kun sjekklista, ingen vedlegg lagt til", async () => {
    const r = await kjør();
    expect(oppgave).not.toHaveBeenCalled();
    expect(hentBytes).not.toHaveBeenCalled();
    expect((await PDFDocument.load(r.pdf)).getPageCount()).toBe(1);
  });
});
