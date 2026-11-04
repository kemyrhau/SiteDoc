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
    signatur: { kreves: 2, signert: 2, komplett: true },
  },
  {
    statushendelser: { sendt: h("Per"), godkjent: null, lukket: null },
    utfylling: null,
    signatur: { kreves: 3, signert: 1, komplett: false },
  },
  { statushendelser: { sendt: null, godkjent: null, lukket: null }, utfylling: { sist: null, alle: [] }, signatur: null },
];

describe("signatur", () => {
  it("tekst: ✓ komplett, m/n mangler, — uten felt", () => {
    expect(rader.map((r) => signaturTekst(r.signatur))).toEqual(["✓", "1/3", "—"]);
  });

  it("kategori for filteret Signert / Mangler / Uten signaturfelt", () => {
    expect(rader.map((r) => signaturKategori(r.signatur))).toEqual(["signert", "mangler", "uten"]);
    expect(metadataFilterVerdi(rader[1]!, "signatur")).toBe("mangler");
  });

  it("stigende sortering: komplett først, så mest signert, uten felt sist", () => {
    const mye = { kreves: 4, signert: 3, komplett: false };
    const lite = { kreves: 4, signert: 1, komplett: false };
    const sortert = [null, lite, { kreves: 1, signert: 1, komplett: true }, mye].sort(
      (a, b) => signaturSorterVerdi(a) - signaturSorterVerdi(b),
    );
    expect(sortert.map(signaturTekst)).toEqual(["✓", "3/4", "1/4", "—"]);
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
