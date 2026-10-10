import { describe, it, expect } from "vitest";
import {
  utledProsjektForZip,
  ZipAvvist,
  vurderZipGrenser,
  byggOppforinger,
  byggManglerTekst,
  MAKS_TEGNINGER,
  MAKS_SUM_BYTES,
  type ZipTegningRad,
} from "./tegningNedlasting";

function rad(id: string, projectId: string, over: Partial<ZipTegningRad> = {}): ZipTegningRad {
  return {
    id,
    name: id,
    drawingNumber: null,
    revision: "A",
    fileUrl: `/uploads/${id}.dwg`,
    originalFileUrl: null,
    projectId,
    ...over,
  };
}

describe("utledProsjektForZip (tilgangsavvisning)", () => {
  it("returnerer prosjektet når alle id-er finnes i samme prosjekt", () => {
    const rader = [rad("a", "P1"), rad("b", "P1")];
    expect(utledProsjektForZip(rader, 2)).toBe("P1");
  });

  it("avviser når en forespurt id ikke ble funnet (antall-avvik)", () => {
    const rader = [rad("a", "P1")]; // ba om 2, fikk 1 → fremmed/ukjent id
    expect(() => utledProsjektForZip(rader, 2)).toThrow(ZipAvvist);
  });

  it("avviser når id-ene spenner flere prosjekter (smuglet fremmed id)", () => {
    const rader = [rad("a", "P1"), rad("b", "P2")];
    expect(() => utledProsjektForZip(rader, 2)).toThrow(ZipAvvist);
  });

  it("avviser tom forespørsel", () => {
    expect(() => utledProsjektForZip([], 0)).toThrow(ZipAvvist);
  });

  it("en enslig fremmed id i et annet prosjekt gir fortsatt ett prosjekt — tilgang avgjøres så av verifiserProsjektmedlem", () => {
    // utledProsjektForZip slipper gjennom (ett prosjekt); den faktiske
    // medlemssjekken (DB) avviser. Dette dokumenterer ansvarsdelingen.
    const rader = [rad("a", "FREMMED")];
    expect(utledProsjektForZip(rader, 1)).toBe("FREMMED");
  });
});

describe("vurderZipGrenser (413-grensene)", () => {
  const liteBytes = 1024;
  it("innenfor begge grensene → ok", () => {
    expect(vurderZipGrenser(MAKS_TEGNINGER, liteBytes)).toEqual({ ok: true });
    expect(vurderZipGrenser(1, MAKS_SUM_BYTES)).toEqual({ ok: true });
  });
  it("over antallsgrensen → grunn=antall", () => {
    expect(vurderZipGrenser(MAKS_TEGNINGER + 1, liteBytes)).toEqual({ ok: false, grunn: "antall" });
  });
  it("over størrelsesgrensen → grunn=storrelse", () => {
    expect(vurderZipGrenser(1, MAKS_SUM_BYTES + 1)).toEqual({ ok: false, grunn: "storrelse" });
  });
  it("antall sjekkes før størrelse", () => {
    // Begge brutt → antall rapporteres (billigste vakt, sjekkes først).
    expect(vurderZipGrenser(MAKS_TEGNINGER + 1, MAKS_SUM_BYTES + 1)).toEqual({ ok: false, grunn: "antall" });
  });
});

describe("byggOppforinger (traversal + manglende fil + størrelse)", () => {
  const statOk = (size: number) => () => Promise.resolve({ size });

  it("KASTER når en fileUrl prøver path traversal (→ 400 i ruten)", async () => {
    const rader = [rad("a", "P1", { fileUrl: "/uploads/../../../etc/passwd" })];
    await expect(byggOppforinger(rader, statOk(10))).rejects.toThrow();
  });

  it("fil som mangler på disk føres i manglende (ikke stille bort), feller ikke", async () => {
    const rader = [
      rad("a", "P1", { fileUrl: "/uploads/finnes.dwg" }),
      rad("b", "P1", { drawingNumber: "B-02", fileUrl: "/uploads/mangler.dwg" }),
    ];
    const statFn = (disk: string) =>
      disk.includes("mangler") ? Promise.reject(new Error("ENOENT")) : Promise.resolve({ size: 50 });
    const { oppforinger, sumBytes, manglende } = await byggOppforinger(rader, statFn);
    expect(oppforinger).toHaveLength(1);
    expect(sumBytes).toBe(50);
    expect(manglende).toHaveLength(1);
    expect(manglende[0]!.tegningsnummer).toBe("B-02");
    expect(manglende[0]!.filnavn).toContain("B-02");
  });

  it("foretrekker originalFileUrl og summerer størrelser", async () => {
    const rader = [
      rad("a", "P1", { originalFileUrl: "/uploads/orig-a.dwg", fileUrl: "/uploads/konv-a.svg" }),
      rad("b", "P1", { originalFileUrl: null, fileUrl: "/uploads/b.pdf" }),
    ];
    const { oppforinger, sumBytes, manglende } = await byggOppforinger(rader, statOk(100));
    expect(oppforinger).toHaveLength(2);
    expect(oppforinger[0]!.disk).toContain("orig-a.dwg");
    expect(sumBytes).toBe(200);
    expect(manglende).toHaveLength(0);
  });
});

describe("byggManglerTekst (MANGLER.txt-innhold)", () => {
  it("lister tegningsnummer + filnavn pr. manglende fil", () => {
    const tekst = byggManglerTekst([
      { tegningsnummer: "A-01", filnavn: "A-01_revA.dwg" },
      { tegningsnummer: "B-02", filnavn: "B-02_revC.pdf" },
    ]);
    expect(tekst).toContain("A-01\tA-01_revA.dwg");
    expect(tekst).toContain("B-02\tB-02_revC.pdf");
    expect(tekst).toContain("IKKE med i zip");
  });
});
