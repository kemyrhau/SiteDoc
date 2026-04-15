import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Hjelpefunksjoner (kopiert fra import-dialog for testing)
// ---------------------------------------------------------------------------

function gjettDokType(filnavn: string): string {
  const lavt = filnavn.toLowerCase();
  if (lavt.endsWith(".gab") || lavt.endsWith(".ga1")) return "anbudsgrunnlag";
  if (lavt.endsWith(".xml")) return "anbudsgrunnlag"; // NS 3459
  if (/sluttnota|a[-\s]?nota|avdragsnota/i.test(lavt)) return "a_nota";
  if (/t[-\s]?nota|tilleggsnota/i.test(lavt)) return "t_nota";
  if (/anbud|priset|tilbud/i.test(lavt)) return "anbudsgrunnlag";
  if (/mengde/i.test(lavt)) return "mengdebeskrivelse";
  return "anbudsgrunnlag";
}

function gjettNotaNr(filnavn: string): string {
  const m = filnavn.match(
    /(?:a[-\s]?nota|t[-\s]?nota|avdragsnota|tilleggsnota)[_\s-]*(\d+)/i,
  );
  if (m) return m[1]!;
  const fallback = filnavn.match(/[_\s](\d+)[_\s]/);
  return fallback ? fallback[1]! : "";
}

function gjettDato(filnavn: string): string {
  const m = filnavn.match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
  if (!m) return "";
  const år = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
  return `${år}-${m[2]}-${m[1]}`;
}

// ---------------------------------------------------------------------------
// Tester
// ---------------------------------------------------------------------------

describe("gjettDokType", () => {
  it("GAB/GA1-filer → anbudsgrunnlag", () => {
    expect(gjettDokType("prisskjema.gab")).toBe("anbudsgrunnlag");
    expect(gjettDokType("tilbud.ga1")).toBe("anbudsgrunnlag");
  });

  it("XML-filer → anbudsgrunnlag", () => {
    expect(gjettDokType("mengder.xml")).toBe("anbudsgrunnlag");
  });

  it("A-nota varianter → a_nota", () => {
    expect(gjettDokType("A-nota 26_31.05.25.pdf")).toBe("a_nota");
    expect(gjettDokType("Anota 3.pdf")).toBe("a_nota");
    expect(gjettDokType("a nota 12.xlsx")).toBe("a_nota");
    expect(gjettDokType("A-Nota 28_31.07.25.pdf")).toBe("a_nota");
  });

  it("Avdragsnota → a_nota", () => {
    expect(gjettDokType("Avdragsnota_18_562_562 Storgata nord_Avdragsnota, liggende.xlsx")).toBe("a_nota");
    expect(gjettDokType("Avdragsnota_24_562.pdf")).toBe("a_nota");
  });

  it("Sluttnota → a_nota", () => {
    expect(gjettDokType("Sluttnota faktura 70020.pdf")).toBe("a_nota");
    expect(gjettDokType("Sluttnota faktura 70020.xlsx")).toBe("a_nota");
  });

  it("T-nota varianter → t_nota", () => {
    expect(gjettDokType("T-nota 5.pdf")).toBe("t_nota");
    expect(gjettDokType("Tnota 2.xlsx")).toBe("t_nota");
    expect(gjettDokType("t nota 8.pdf")).toBe("t_nota");
    expect(gjettDokType("Tilleggsnota 3.pdf")).toBe("t_nota");
  });

  it("Mengdebeskrivelse → mengdebeskrivelse", () => {
    expect(gjettDokType("Mengdebeskrivelse K01.pdf")).toBe("mengdebeskrivelse");
  });

  it("Anbud/tilbud → anbudsgrunnlag", () => {
    expect(gjettDokType("Anbudsgrunnlag prosjekt X.pdf")).toBe("anbudsgrunnlag");
    expect(gjettDokType("Priset mengdebeskrivelse.xlsx")).toBe("anbudsgrunnlag");
    expect(gjettDokType("Tilbudsskjema.pdf")).toBe("anbudsgrunnlag");
  });

  it("Ukjent → anbudsgrunnlag (default)", () => {
    expect(gjettDokType("random-file.pdf")).toBe("anbudsgrunnlag");
  });
});

describe("gjettNotaNr", () => {
  it("A-nota med bindestrek", () => {
    expect(gjettNotaNr("A-nota 26_31.05.25.pdf")).toBe("26");
    expect(gjettNotaNr("A-nota 3.pdf")).toBe("3");
    expect(gjettNotaNr("A-Nota 28_31.07.25.pdf")).toBe("28");
  });

  it("A-nota uten bindestrek", () => {
    expect(gjettNotaNr("Anota 12.pdf")).toBe("12");
    expect(gjettNotaNr("a nota 5.xlsx")).toBe("5");
  });

  it("Avdragsnota med underscore", () => {
    expect(gjettNotaNr("Avdragsnota_18_562_562 Storgata nord_Avdragsnota, liggende.xlsx")).toBe("18");
    expect(gjettNotaNr("Avdragsnota_24_562.pdf")).toBe("24");
    expect(gjettNotaNr("Avdragsnota_25_562_562 Storgata nord.xlsx")).toBe("25");
  });

  it("T-nota varianter", () => {
    expect(gjettNotaNr("T-nota 5.pdf")).toBe("5");
    expect(gjettNotaNr("Tnota 2.xlsx")).toBe("2");
    expect(gjettNotaNr("t nota 8.pdf")).toBe("8");
  });

  it("Tilleggsnota", () => {
    expect(gjettNotaNr("Tilleggsnota 3.pdf")).toBe("3");
    expect(gjettNotaNr("Tilleggsnota_7_prosjekt.xlsx")).toBe("7");
  });

  it("Sluttnota → ingen notaNr (bruker erSluttnota)", () => {
    expect(gjettNotaNr("Sluttnota faktura 70020.pdf")).toBe("");
  });

  it("Fallback: tall mellom separatorer", () => {
    expect(gjettNotaNr("prosjekt_3_rapport.pdf")).toBe("3");
    expect(gjettNotaNr("dok 42 endelig.xlsx")).toBe("42");
  });

  it("Ingen match → tom streng", () => {
    expect(gjettNotaNr("random-file.pdf")).toBe("");
    expect(gjettNotaNr("prisskjema.gab")).toBe("");
  });
});

describe("gjettDato", () => {
  it("dd.mm.yy format (2-sifret år)", () => {
    expect(gjettDato("A-nota 26_31.05.25.pdf")).toBe("2025-05-31");
    expect(gjettDato("A-nota 28_31.07.25.pdf")).toBe("2025-07-31");
    expect(gjettDato("A-nota 29_30.09.25.pdf")).toBe("2025-09-30");
  });

  it("dd.mm.yyyy format (4-sifret år)", () => {
    expect(gjettDato("rapport_15.03.2025_endelig.pdf")).toBe("2025-03-15");
    expect(gjettDato("faktura 01.12.2024.xlsx")).toBe("2024-12-01");
  });

  it("Ingen dato → tom streng", () => {
    expect(gjettDato("Avdragsnota_18_562.xlsx")).toBe("");
    expect(gjettDato("random-file.pdf")).toBe("");
    expect(gjettDato("Sluttnota faktura 70020.pdf")).toBe("");
  });
});
