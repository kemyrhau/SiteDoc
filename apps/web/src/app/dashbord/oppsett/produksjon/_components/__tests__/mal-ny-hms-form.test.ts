import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SUBDOMAIN_FORM, formForSubdomain } from "@sitedoc/shared";
import nb from "../../../../../../../../../packages/shared/src/i18n/nb.json";
import en from "../../../../../../../../../packages/shared/src/i18n/en.json";
import {
  hmsFormForklaringNokkel,
  hørerTilMalListe,
  nyMalKategori,
} from "../mal-liste-filter";

// HM2 (Kenneth 2026-11-24): «Ny HMS-mal» lagrer formen undertypen tilsier.
describe("nyMalKategori (HM2)", () => {
  it("HMS: avvik og RUH blir oppgave, SJA blir sjekkliste", () => {
    expect(nyMalKategori("hms", "avvik")).toBe("oppgave");
    expect(nyMalKategori("hms", "ruh")).toBe("oppgave");
    expect(nyMalKategori("hms", "sja")).toBe("sjekkliste");
  });

  it("Oppgave-/sjekklistemaler lagres som valgt (undertypen er uten betydning)", () => {
    expect(nyMalKategori("oppgave", "sja")).toBe("oppgave");
    expect(nyMalKategori("sjekkliste", "avvik")).toBe("sjekkliste");
  });

  it("ny HMS-mal (domain hms) står i HMS-lista, ikke i Oppgave-/Sjekklistemaler", () => {
    for (const sd of ["avvik", "ruh", "sja"] as const) {
      const mal = { category: nyMalKategori("hms", sd), domain: "hms" };
      expect(hørerTilMalListe(mal, "hms")).toBe(true);
      expect(hørerTilMalListe(mal, "oppgave")).toBe(false);
      expect(hørerTilMalListe(mal, "sjekkliste")).toBe(false);
    }
  });

  it("samme regel som serveren (én kilde: SUBDOMAIN_FORM)", () => {
    for (const sd of ["avvik", "ruh", "sja"] as const) {
      expect(nyMalKategori("hms", sd)).toBe(SUBDOMAIN_FORM[sd]);
      expect(nyMalKategori("hms", sd)).toBe(formForSubdomain(sd));
    }
    expect(formForSubdomain("kontrakt")).toBe("oppgave");
    expect(formForSubdomain("ukjent")).toBeUndefined();
  });
});

describe("forklaringslinja under undertypevalget (HM2)", () => {
  it("skifter med undertypen", () => {
    expect(hmsFormForklaringNokkel("avvik")).toBe("hms.subdomain.formOppgave");
    expect(hmsFormForklaringNokkel("ruh")).toBe("hms.subdomain.formOppgave");
    expect(hmsFormForklaringNokkel("sja")).toBe("hms.subdomain.formSjekkliste");
  });

  it("nøklene finnes i nb og en", () => {
    for (const k of ["hms.subdomain.formOppgave", "hms.subdomain.formSjekkliste"]) {
      expect((nb as Record<string, string>)[k]).toBeTruthy();
      expect((en as Record<string, string>)[k]).toBeTruthy();
    }
  });
});

describe("MalListe «Ny …-mal» bruker regelen (HM2)", () => {
  const kilde = readFileSync(resolve(__dirname, "../MalListe.tsx"), "utf-8");
  const opprett = kilde.slice(
    kilde.indexOf("function handleOpprett"),
    kilde.indexOf("function handleRediger"),
  );

  it("handleOpprett sender category fra nyMalKategori, ikke sidens kategori rått", () => {
    expect(opprett).toContain("category: nyMalKategori(kategori, subdomain)");
    expect(opprett).not.toMatch(/category:\s*kategori\s*,/);
  });

  it("opprett-dialogen viser forklaringslinja for valgt undertype", () => {
    expect(kilde).toContain("t(hmsFormForklaringNokkel(subdomain))");
  });
});
