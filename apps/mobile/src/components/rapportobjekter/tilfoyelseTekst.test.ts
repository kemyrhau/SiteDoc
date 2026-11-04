import { describe, it, expect } from "vitest";
import type { TFunction } from "i18next";
import { tilfoyelseVerdiTekst } from "./tilfoyelseTekst";

/** Tapt vær-verdi i kollisjonsnotatet vises som vær-feltet selv (ordre 2026-11-04 (3) P3). */

const ord: Record<string, string> = {
  "felt.vaerVindVerdi": "vind {{verdi}}",
  "felt.vaerNedborVerdi": "nedbør {{verdi}}",
  "felt.ingenVaerdata": "Ingen værdata",
  "kollisjon.notat.kompleksVerdi": "(kompleks verdi)",
};
const t = ((k: string, v?: Record<string, unknown>) =>
  (ord[k] ?? k).replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(v?.[n] ?? ""))) as unknown as TFunction;

describe("tilfoyelseVerdiTekst", () => {
  it("vær-objekt → samme tekst som VaerObjekt", () => {
    const vaer = { temp: "6 °C", conditions: "Regn", wind: "5 m/s", precipitation: "1.2 mm", kilde: "manuell" };
    expect(tilfoyelseVerdiTekst(vaer, t)).toBe("6 °C, regn, vind 5 m/s, nedbør 1.2 mm");
  });

  it("vær uten data → «Ingen værdata»", () => {
    expect(tilfoyelseVerdiTekst({ status: "venter" }, t)).toBe("Ingen værdata");
  });

  it("ukjent objekt → oversatt markør", () => {
    expect(tilfoyelseVerdiTekst({ noe: 1 }, t)).toBe("(kompleks verdi)");
  });

  it("skalar og filnavn uendret", () => {
    expect(tilfoyelseVerdiTekst("tekst", t)).toBe("tekst");
    expect(tilfoyelseVerdiTekst([{ filnavn: "a.jpg" }, "b"], t)).toBe("a.jpg, b");
  });
});
