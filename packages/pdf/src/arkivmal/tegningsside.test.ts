import { describe, it, expect } from "vitest";
import { byggTegningsside, byggTegningssider } from "./tegningsside";
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
