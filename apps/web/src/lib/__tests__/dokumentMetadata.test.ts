import { describe, it, expect } from "vitest";
import {
  metadataFilterAlternativer,
  metadataFilterVerdi,
  metadataFlereVerdier,
  signaturKategori,
  signaturSorterVerdi,
  signaturTekst,
  utfyllingUkjent,
  type MetadataRad,
} from "../dokumentMetadata";

/** Metadata M-pakke: celle-tekst, filter og sortering for hvem-og-når- og signaturkolonnene. */
const h = (navn: string, ved = "2026-11-01T08:00:00.000Z") => ({ av: { id: `u-${navn}`, navn }, ved });

const rader: MetadataRad[] = [
  {
    statushendelser: { sendt: h("Ola"), godkjent: h("Kari"), lukket: null },
    utfylling: { sist: h("Kari"), alle: [{ id: "u-Ola", navn: "Ola" }, { id: "u-Kari", navn: "Kari" }] },
    signatur: { felt: { kreves: 2, signert: 2, komplett: true }, sja: null },
  },
  {
    statushendelser: { sendt: h("Per"), godkjent: null, lukket: null },
    utfylling: null,
    signatur: { felt: { kreves: 3, signert: 1, komplett: false }, sja: null },
  },
  { statushendelser: { sendt: null, godkjent: null, lukket: null }, utfylling: { sist: null, alle: [] }, signatur: null },
];

describe("signatur", () => {
  const sjaTekst = (n: number) => `${n} signert`;
  const felt = (signert: number, kreves: number) => ({ felt: { kreves, signert, komplett: kreves > 0 && signert >= kreves }, sja: null });
  const sja = (n: number) => ({ felt: null, sja: n });

  it("malfelt: ✓ komplett, m/n mangler, — uten felt", () => {
    expect(rader.map((r) => signaturTekst(r.signatur, sjaTekst))).toEqual(["✓", "1/3", "—"]);
  });

  it("SJA: bare antall — 3 signert av 5 deltakere gir «3 signert», ikke «3/5»; 0 gir «—»", () => {
    expect(signaturTekst(sja(3), sjaTekst)).toBe("3 signert");
    expect(signaturTekst(sja(0), sjaTekst)).toBe("—");
  });

  it("malfelt + SJA: én kort tekst, tallene slås ikke sammen", () => {
    expect(signaturTekst({ felt: { kreves: 2, signert: 1, komplett: false }, sja: 3 }, sjaTekst)).toBe("1/2 · 3 signert");
    expect(signaturTekst({ felt: { kreves: 1, signert: 1, komplett: true }, sja: 0 }, sjaTekst)).toBe("✓");
  });

  it("kategori: malfelt styrer; rent SJA er Signert ved ≥ 1, ellers Mangler", () => {
    expect(rader.map((r) => signaturKategori(r.signatur))).toEqual(["signert", "mangler", "uten"]);
    expect(metadataFilterVerdi(rader[1]!, "signatur")).toBe("mangler");
    expect(signaturKategori(sja(1))).toBe("signert");
    expect(signaturKategori(sja(0))).toBe("mangler");
    expect(signaturKategori({ felt: { kreves: 2, signert: 1, komplett: false }, sja: 5 })).toBe("mangler");
  });

  it("stigende sortering er deterministisk: komplett, SJA flest først, mangler mest signert først, uten sist", () => {
    const sortert = [null, felt(1, 4), sja(2), felt(1, 1), sja(0), felt(3, 4), sja(5)].sort(
      (a, b) => signaturSorterVerdi(a) - signaturSorterVerdi(b),
    );
    expect(sortert.map((s) => signaturTekst(s, sjaTekst))).toEqual(["✓", "5 signert", "2 signert", "3/4", "1/4", "—", "—"]);
    expect(signaturSorterVerdi(sja(0))).toBeLessThan(signaturSorterVerdi(null));
  });
});

describe("hvem og når", () => {
  it("person-kolonnene gir navnet for steget, tomt når steget ikke har skjedd", () => {
    expect(metadataFilterVerdi(rader[0]!, "godkjentAv")).toBe("Kari");
    expect(metadataFilterVerdi(rader[1]!, "godkjentAv")).toBe("");
    expect(metadataFilterVerdi(rader[0]!, "tittel")).toBeUndefined();
  });

  it("filteralternativene er adaptive — bare navn som finnes i lista", () => {
    const alt = metadataFilterAlternativer(rader);
    expect(alt.sendtAv!.map((a) => a.value)).toEqual(["Ola", "Per"]);
    expect(alt.godkjentAv!.map((a) => a.value)).toEqual(["Kari"]);
    expect(alt.lukketAv).toEqual([]);
    expect(alt.sistUtfyltAv!.map((a) => a.value)).toEqual(["Kari", "Ola"]);
  });
});

describe("utfylt av", () => {
  it("«Utfylt av» gir alle i loggen; logg av gir tom liste og ukjent-markør", () => {
    expect(metadataFlereVerdier(rader[0]!, "sistUtfyltAv")).toEqual(["Ola", "Kari"]);
    expect(metadataFlereVerdier(rader[1]!, "sistUtfyltAv")).toEqual([]);
    expect(utfyllingUkjent(rader[1]!)).toBe(true);
    expect(utfyllingUkjent(rader[2]!)).toBe(false);
    expect(metadataFlereVerdier(rader[0]!, "sendtAv")).toBeUndefined();
  });
});
