import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Kontrakt for arkiv-orkestreringen. Mocker filsamling/dokument-enumerering/
 * render/fs slik at vi deterministisk kan teste UTEN pdf-render-containeren:
 * manifest-konvolutt, fil→domeneobjekt-binding, dedup av kolliderende arkiv-
 * stier, manglende-fil-markering (feller ikke), at timer/utlegg ALDRI havner i
 * arkivet, dokument-render (mappe + filnavn + feilet-feller-ikke), progresjon,
 * og guards.
 */

const filer = vi.hoisted(() => ({ samleProsjektFiler: vi.fn() }));
const dokumenter = vi.hoisted(() => ({ samleProsjektDokumenter: vi.fn() }));
const render = vi.hoisted(() => ({ rendrArkivPdf: vi.fn(), genererArkivStempel: vi.fn(() => "07.09.2026 10:00") }));
const fs = vi.hoisted(() => ({ stat: vi.fn() }));

vi.mock("./filer", () => filer);
vi.mock("./dokumenter", () => dokumenter);
vi.mock("../arkiv/render", () => render);
vi.mock("fs/promises", () => fs);
vi.mock("./felles", () => ({ diskSti: (u: string) => "/disk" + u, UPLOADS_DIR: "/disk/uploads" }));

import { byggEksportArkiv } from "./arkiv";

/** Standard-svar fra rendrArkivPdf for ett dokument (BEF-001 uten manglende vedlegg). */
function renderResultat(over: Record<string, unknown> = {}) {
  return {
    pdf: Buffer.from("%PDF-fake"),
    filnavn: "BEF-001.pdf",
    komplett: true,
    renderTimeout: false,
    dokumenter: [{ id: "d1", type: "sjekkliste", tittel: "Tittel", manglendeVedlegg: [] }],
    ...over,
  };
}

const PROSJEKT = {
  id: "p1",
  projectNumber: "998",
  name: "Instinniforbotn",
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  primaryOrganization: { id: "o1", name: "A.Markussen AS", organizationNumber: "123456789" },
};

function fakePrisma() {
  return { project: { findUnique: vi.fn().mockResolvedValue(PROSJEKT) } } as never;
}
function arkivMock() {
  return { append: vi.fn(), file: vi.fn() };
}
const JOBB = { id: "j1", projectId: "p1", bestiltAvUserId: "u1" };

beforeEach(() => {
  vi.clearAllMocks();
  filer.samleProsjektFiler.mockResolvedValue([]);
  dokumenter.samleProsjektDokumenter.mockResolvedValue([]);
  render.rendrArkivPdf.mockResolvedValue(renderResultat());
  fs.stat.mockResolvedValue({ size: 111 });
});

describe("byggEksportArkiv — orkestrering", () => {
  it("tom pakke: manifest-konvolutt + LES-MEG, statistikk null", async () => {
    const a = arkivMock();
    const s = await byggEksportArkiv(fakePrisma(), {} as never, JOBB, a as never);

    const navn = a.append.mock.calls.map((c) => c[1].name);
    expect(navn).toContain("manifest.json");
    expect(navn).toContain("LES-MEG.txt");
    const manifest = JSON.parse(a.append.mock.calls.find((c) => c[1].name === "manifest.json")![0]);
    expect(manifest.prosjekt.prosjektnummer).toBe("998");
    expect(manifest.firma.orgnr).toBe("123456789");
    expect(manifest.innhold).toEqual([]);
    expect(s.antallFiler).toBe(0);
  });

  it("filer strømmes fra disk + bindes i manifest; kolliderende navn dedupes", async () => {
    filer.samleProsjektFiler.mockResolvedValue([
      { kategori: "bilde", fileUrl: "/uploads/a.jpg", mappe: "filer/bilder", visningsnavn: "bilde.jpg", storrelse: 100, opprettet: "2026-01-02T00:00:00Z", tilknyttet: { type: "sjekkliste", id: "c1", navn: "SJA-1" } },
      { kategori: "bilde", fileUrl: "/uploads/b.jpg", mappe: "filer/bilder", visningsnavn: "bilde.jpg", storrelse: 100, opprettet: "2026-01-02T00:00:00Z", tilknyttet: { type: "sjekkliste", id: "c1", navn: "SJA-1" } },
    ]);
    const a = arkivMock();
    const s = await byggEksportArkiv(fakePrisma(), {} as never, JOBB, a as never);

    expect(a.file).toHaveBeenCalledTimes(2);
    const stier = a.file.mock.calls.map((c) => c[1].name);
    expect(stier[0]).toBe("filer/bilder/bilde.jpg");
    expect(stier[1]).toBe("filer/bilder/bilde-2.jpg"); // dedup
    expect(s.antallFiler).toBe(2);
    expect(s.samletStorrelseBytes).toBe(200);
    const manifest = JSON.parse(a.append.mock.calls.find((c) => c[1].name === "manifest.json")![0]);
    expect(manifest.innhold[0].tilknyttet).toEqual({ type: "sjekkliste", id: "c1", navn: "SJA-1" });
  });

  it("manglende fil på disk markeres, feller ikke eksporten", async () => {
    filer.samleProsjektFiler.mockResolvedValue([
      { kategori: "dokument", fileUrl: "/uploads/mangler.pdf", mappe: "filer/dokumenter", visningsnavn: "nota.pdf", storrelse: 50, opprettet: "2026-01-03T00:00:00Z", tilknyttet: null },
    ]);
    fs.stat.mockRejectedValue(new Error("ENOENT"));
    const a = arkivMock();
    const s = await byggEksportArkiv(fakePrisma(), {} as never, JOBB, a as never);

    expect(a.file).not.toHaveBeenCalled();
    expect(s.antallManglendeFiler).toBe(1);
    expect(s.antallFiler).toBe(0);
    const manifest = JSON.parse(a.append.mock.calls.find((c) => c[1].name === "manifest.json")![0]);
    expect(manifest.innhold[0]).toMatchObject({ mangler: true, arkivSti: null });
  });

  it("timer og utlegg havner ALDRI i arkivet (firmadata — Kenneth-vedtak 2026-09-06)", async () => {
    // Selv med kvittering-filer (som BLIR med) skal ingen timer/- eller utlegg/-sti
    // eller CSV-innslag dukke opp, og manifestet skal si det bevisst under avgrensninger.
    filer.samleProsjektFiler.mockResolvedValue([
      { kategori: "kvittering-utlegg", fileUrl: "/uploads/kv.pdf", mappe: "filer/kvitteringer", visningsnavn: "kvittering.pdf", storrelse: 20, opprettet: "2026-01-02T00:00:00Z", tilknyttet: { type: "utlegg", id: "u1", navn: null } },
    ]);
    const a = arkivMock();
    const s = await byggEksportArkiv(fakePrisma(), {} as never, JOBB, a as never);

    const alleNavn = [...a.append.mock.calls, ...a.file.mock.calls].map((c) => c[1].name);
    expect(alleNavn.some((n) => n.startsWith("timer/"))).toBe(false);
    expect(alleNavn.some((n) => n.startsWith("utlegg/"))).toBe(false);
    expect(alleNavn).toContain("filer/kvitteringer/kvittering.pdf"); // kvittering BLIR med
    const manifest = JSON.parse(a.append.mock.calls.find((c) => c[1].name === "manifest.json")![0]);
    expect(manifest.csv).toBeUndefined();
    expect(manifest.avgrensninger.some((a: string) => a.includes("Timeregistrering"))).toBe(true);
    expect(s).not.toHaveProperty("antallTimerRader");
  });

  it("kaster hvis projectId mangler / prosjekt ikke finnes", async () => {
    await expect(
      byggEksportArkiv(fakePrisma(), {} as never, { ...JOBB, projectId: null }, arkivMock() as never),
    ).rejects.toThrow(/projectId/);

    const tom = { project: { findUnique: vi.fn().mockResolvedValue(null) } } as never;
    await expect(byggEksportArkiv(tom, {} as never, JOBB, arkivMock() as never)).rejects.toThrow(/finnes ikke/);
  });
});

describe("byggEksportArkiv — dokument-render (fase 3)", () => {
  it("rendrer hvert dokument til PDF med dokumentnummer + tittel i filnavnet, i riktig mappe", async () => {
    dokumenter.samleProsjektDokumenter.mockResolvedValue([
      { id: "d1", type: "sjekkliste", mappe: "dokumenter/sjekklister", tittel: "Gjenbruk av materialer" },
      { id: "h1", type: "sjekkliste", mappe: "dokumenter/hms", tittel: "SJA Graving" },
    ]);
    render.rendrArkivPdf
      .mockResolvedValueOnce(renderResultat({ filnavn: "KA7-003.pdf" }))
      .mockResolvedValueOnce(renderResultat({ filnavn: "SJA-001.pdf" }));

    const a = arkivMock();
    const s = await byggEksportArkiv(fakePrisma(), {} as never, JOBB, a as never);

    const dokStier = a.append.mock.calls.map((c) => c[1].name).filter((n: string) => n.startsWith("dokumenter/"));
    expect(dokStier).toContain("dokumenter/sjekklister/KA7-003 – Gjenbruk av materialer.pdf");
    expect(dokStier).toContain("dokumenter/hms/SJA-001 – SJA Graving.pdf");
    expect(s.antallDokumenter).toBe(2);
    expect(s.antallDokumenterFerdig).toBe(2);
    expect(s.antallDokumenterFeilet).toBe(0);
    // Manifestet binder hvert dokument til arkiv-stien sin.
    const manifest = JSON.parse(a.append.mock.calls.find((c) => c[1].name === "manifest.json")![0]);
    expect(manifest.dokumenter).toHaveLength(2);
    expect(manifest.dokumenter[0]).toMatchObject({ id: "d1", type: "sjekkliste", arkivSti: expect.stringContaining("KA7-003") });
  });

  it("ett dokument som feiler feller IKKE pakken — markeres i manifestet, resten pakkes", async () => {
    dokumenter.samleProsjektDokumenter.mockResolvedValue([
      { id: "d1", type: "sjekkliste", mappe: "dokumenter/sjekklister", tittel: "Ok" },
      { id: "d2", type: "oppgave", mappe: "dokumenter/oppgaver", tittel: "Feiler" },
    ]);
    render.rendrArkivPdf
      .mockResolvedValueOnce(renderResultat({ filnavn: "BEF-001.pdf" }))
      .mockRejectedValueOnce(new Error("pdf-render feil (500): boom"));

    const a = arkivMock();
    const s = await byggEksportArkiv(fakePrisma(), {} as never, JOBB, a as never);

    expect(s.antallDokumenterFerdig).toBe(1);
    expect(s.antallDokumenterFeilet).toBe(1);
    const manifest = JSON.parse(a.append.mock.calls.find((c) => c[1].name === "manifest.json")![0]);
    const feilet = manifest.dokumenter.find((d: { id: string }) => d.id === "d2");
    expect(feilet).toMatchObject({ arkivSti: null, feilet: expect.stringContaining("boom") });
    expect(manifest.avgrensninger.some((x: string) => x.includes("lot seg ikke generere"))).toBe(true);
    // Pakken ble likevel avsluttet med manifest + LES-MEG.
    const navn = a.append.mock.calls.map((c) => c[1].name);
    expect(navn).toContain("manifest.json");
    expect(navn).toContain("LES-MEG.txt");
  });

  it("manglende vedlegg på et rendret dokument noteres (ikke som feil)", async () => {
    dokumenter.samleProsjektDokumenter.mockResolvedValue([
      { id: "d1", type: "sjekkliste", mappe: "dokumenter/sjekklister", tittel: "Ok" },
    ]);
    render.rendrArkivPdf.mockResolvedValue(
      renderResultat({ dokumenter: [{ id: "d1", type: "sjekkliste", tittel: "Ok", manglendeVedlegg: ["bilde.jpg"] }] }),
    );

    const a = arkivMock();
    const s = await byggEksportArkiv(fakePrisma(), {} as never, JOBB, a as never);

    expect(s.antallDokumenterFerdig).toBe(1);
    expect(s.antallDokumenterFeilet).toBe(0);
    const manifest = JSON.parse(a.append.mock.calls.find((c) => c[1].name === "manifest.json")![0]);
    expect(manifest.dokumenter[0].manglendeVedlegg).toEqual(["bilde.jpg"]);
  });

  it("progresjon rapporteres pr. dokument (0/N først, N/N til slutt)", async () => {
    dokumenter.samleProsjektDokumenter.mockResolvedValue([
      { id: "d1", type: "sjekkliste", mappe: "dokumenter/sjekklister", tittel: "A" },
      { id: "d2", type: "sjekkliste", mappe: "dokumenter/sjekklister", tittel: "B" },
    ]);
    const fremdrift: Array<[number, number]> = [];
    const a = arkivMock();
    await byggEksportArkiv(fakePrisma(), {} as never, JOBB, a as never, async (f, t) => {
      fremdrift.push([f, t]);
    });

    expect(fremdrift).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });
});
