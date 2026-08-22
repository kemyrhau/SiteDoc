import { describe, it, expect } from "vitest";
import { byggTegningsside, byggTegningssider, velgHelsider } from "./tegningsside";
import type { TegningssideData } from "./tegningsside";

const basis = (over: Partial<TegningssideData> = {}): TegningssideData => ({
  tegningNavn: "Z-20-01",
  bildeDataUrl: "data:image/jpeg;base64,AAAA",
  imageWidth: 1600,
  imageHeight: 900,
  markorer: [
    { nr: 1, x: 60.65, y: 75.2 },
    { nr: 2, x: 84.04, y: 56.63 },
  ],
  ...over,
});

describe("byggTegningsside — D2b helside (revidert: tegning + nummererte markører, ingen tabell)", () => {
  it("full tegning m/ nummererte markører (nr = radnr); markør→punkt-tabell FJERNET", () => {
    const html = byggTegningsside(basis());
    expect(html).toContain("Z-20-01");
    expect(html).toContain('class="ark-tegningsside"');
    expect(html).toContain("data:image/jpeg;base64,AAAA");
    expect(html).toMatch(/<text[^>]*>1<\/text>/);
    expect(html).toMatch(/<text[^>]*>2<\/text>/);
    // Ingen markør→punkt-tabell (flyttet til repeater-cella).
    expect(html).not.toContain("<table");
    expect(html).not.toContain("Utsnitt");
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("bredere enn høy → liggende-klasse (roteres); høyere enn bred → ikke", () => {
    expect(byggTegningsside(basis({ imageWidth: 1600, imageHeight: 900 }))).toContain("ark-tegning-liggende");
    expect(byggTegningsside(basis({ imageWidth: 900, imageHeight: 1600 }))).not.toContain("ark-tegning-liggende");
  });

  it("ingen markører → tom streng (ingen tegningsside)", () => {
    expect(byggTegningsside(basis({ markorer: [] }))).toBe("");
  });
});

describe("byggTegningssider — flere tegninger", () => {
  it("én helside per tegning m/ markører; tomme utelates", () => {
    const html = byggTegningssider([
      basis({ tegningNavn: "A" }),
      basis({ tegningNavn: "B", markorer: [] }),
      basis({ tegningNavn: "C" }),
    ]);
    expect((html.match(/ark-tegningsside/g) ?? [])).toHaveLength(2);
    expect(html).toContain(">A<");
    expect(html).toContain(">C<");
    expect(html).not.toContain(">B<");
  });
});

describe("velgHelsider — helside KUN for tegning med ≥2 markører (Kenneth-vedtak 2026-08-22)", () => {
  const medMarkorer = (navn: string, antall: number): TegningssideData =>
    basis({ tegningNavn: navn, markorer: Array.from({ length: antall }, (_, i) => ({ nr: i + 1, x: 10 * i, y: 10 * i })) });

  it("1 markør → ingen helside", () => {
    expect(velgHelsider([medMarkorer("A", 1)])).toHaveLength(0);
  });

  it("2 markører samme tegning → én helside", () => {
    const ut = velgHelsider([medMarkorer("A", 2)]);
    expect(ut).toHaveLength(1);
    expect(ut[0]!.tegningNavn).toBe("A");
  });

  it("1 + 1 på TO tegninger → ingen helside (teller per tegning, ikke totalt)", () => {
    expect(velgHelsider([medMarkorer("A", 1), medMarkorer("B", 1)])).toHaveLength(0);
  });

  it("blandet: A=2, B=1, C=3 → kun A og C (≥2)", () => {
    const ut = velgHelsider([medMarkorer("A", 2), medMarkorer("B", 1), medMarkorer("C", 3)]);
    expect(ut.map((s) => s.tegningNavn)).toEqual(["A", "C"]);
  });

  it("0 markører → ingen helside (defensivt)", () => {
    expect(velgHelsider([medMarkorer("A", 0)])).toHaveLength(0);
  });
});
