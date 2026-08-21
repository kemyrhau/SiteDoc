import { describe, it, expect } from "vitest";
import { byggTegningsside, byggTegningssider } from "./tegningsside";
import type { TegningssideData } from "./tegningsside";

const basis = (over: Partial<TegningssideData> = {}): TegningssideData => ({
  tegningNavn: "Z-20-01",
  bildeDataUrl: "data:image/jpeg;base64,AAAA",
  imageWidth: 1600,
  imageHeight: 900,
  visResultat: false,
  markorer: [
    { nr: 1, x: 60.65, y: 75.2, punkttekst: null, resultat: null, utsnittDataUrl: "data:image/jpeg;base64,C1" },
    { nr: 2, x: 84.04, y: 56.63, punkttekst: "repeater 2 setter en annen posisjon", resultat: null, utsnittDataUrl: "data:image/jpeg;base64,C2" },
  ],
  ...over,
});

describe("byggTegningsside — D2b helside (BEF-002-form)", () => {
  it("full tegning m/ nummererte markører + markør→punkt-tabell", () => {
    const html = byggTegningsside(basis());
    expect(html).toContain("Z-20-01");
    expect(html).toContain('class="ark-side ark-tegningsside"');
    // Full tegning inlinet + begge markør-tall i SVG.
    expect(html).toContain("data:image/jpeg;base64,AAAA");
    expect(html).toMatch(/<text[^>]*>1<\/text>/);
    expect(html).toMatch(/<text[^>]*>2<\/text>/);
    // Tabellrad per markør, punkttekst for rad 2, utsnitt inlinet.
    expect(html).toContain("repeater 2 setter en annen posisjon");
    expect(html).toContain("data:image/jpeg;base64,C1");
    expect(html).toContain("data:image/jpeg;base64,C2");
    // Aldri nettverks-URL.
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("markørnummer = radnummer (flat per tegning)", () => {
    const html = byggTegningsside(basis());
    const rader = html.match(/ark-markor-rad/g) ?? [];
    expect(rader).toHaveLength(2);
  });

  it("bredere enn høy → liggende-klasse (roteres)", () => {
    expect(byggTegningsside(basis({ imageWidth: 1600, imageHeight: 900 }))).toContain("ark-tegning-liggende");
    expect(byggTegningsside(basis({ imageWidth: 900, imageHeight: 1600 }))).not.toContain("ark-tegning-liggende");
  });

  it("uten resultat-kolonne når malen mangler status-felt (BEF-002)", () => {
    const html = byggTegningsside(basis({ visResultat: false }));
    expect(html).not.toContain("<th>Resultat</th>");
  });

  it("resultat-kolonne vises når visResultat=true", () => {
    const html = byggTegningsside(basis({ visResultat: true, markorer: [
      { nr: 1, x: 10, y: 20, punkttekst: "P", resultat: "Avvik", utsnittDataUrl: "data:x" },
    ] }));
    expect(html).toContain("<th>Resultat</th>");
    expect(html).toContain("Avvik");
  });

  it("markør uten utsnitt → stiplet tom celle, ikke rå/tom", () => {
    const html = byggTegningsside(basis({ markorer: [
      { nr: 1, x: 10, y: 20, punkttekst: "P", resultat: null, utsnittDataUrl: null },
    ] }));
    expect(html).toContain("ark-utsnitt-mangler");
  });

  it("ingen markører → tom streng (ingen tegningsside)", () => {
    expect(byggTegningsside(basis({ markorer: [] }))).toBe("");
  });
});

describe("byggTegningssider — flere tegninger", () => {
  it("én .ark-side per tegning m/ markører; tomme utelates", () => {
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
