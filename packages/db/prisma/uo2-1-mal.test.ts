import { describe, it, expect } from "vitest";
import { BETINGELSE_EGEN_NOKKEL } from "@sitedoc/shared";
import { UO21_MAL, type FeltDef } from "./seed-bibliotek";

/**
 * UO2.1 «Nedgravd stengeventil» (NY, NYTT KAPITTEL UO, ordre UP-deling § 8). Ett tre: uttak (forelder
 * for brannkumskiltet, kryss-fase UNDER→ETTER → `barnAv`). INGEN materialeblokk (ventilpost, ikke
 * kumpost). Basisfeltene med «enheten»-bytte i B1/B6 og utvidet B7 (teleskop/deksel).
 *
 * 🔴 §7b/§8: «Baio», «Bajo» OG «bajonett» skal IKKE forekomme noe sted — produktnavnet er utelukket
 * med vilje (én leverandørs varemerke, ikke generisk som Ab/Ska).
 */

const felt = (label: string): FeltDef => {
  const f = UO21_MAL.felter.find((x) => x.label === label);
  if (!f) throw new Error(`Fant ikke «${label}»`);
  return f;
};
const eget = (f: FeltDef) => (f.config?.[BETINGELSE_EGEN_NOKKEL] as string[] | undefined) ?? [];

describe("UO2.1 – nedgravd stengeventil (ny, nytt kapittel UO)", () => {
  it("er malen for UO2.1 i kapittel UO", () => {
    expect(UO21_MAL.referanse).toBe("UO2.1");
    expect(UO21_MAL.kapittelKode).toBe("UO");
    expect(UO21_MAL.navn).toBe("UO2.1 – Nedgravd stengeventil");
  });

  it("uttak er forelder for skiltet; skiltet vises ved brannvannsuttak, i ETTER", () => {
    const uttak = felt("Brannvannsuttak på ventilen");
    expect(uttak.ref).toBe("uttak");
    expect(uttak.config?.conditionActive).toBe(true);
    const skilt = felt("Brannkumskilt");
    expect(skilt.parentRef).toBe("uttak");
    expect(skilt.fase).toBe("ETTER");
    expect(eget(skilt)).toEqual(["Ja – ventilen har brannvannsuttak"]);
  });

  it("bare skiltet er betinget (13 alltid synlige)", () => {
    const alltid = UO21_MAL.felter.filter((f) => !f.parentRef);
    const betinget = UO21_MAL.felter.filter((f) => f.parentRef);
    expect(betinget.map((f) => f.label)).toEqual(["Brannkumskilt"]);
    expect(alltid).toHaveLength(13);
  });

  it("INGEN materialeblokk (ventilpost)", () => {
    for (const l of ["Materiale", "Kumskjøt og pakninger", "Oppføringsrør og form", "Plasstøpt kumbunn"]) {
      expect(UO21_MAL.felter.some((f) => f.label === l), l).toBe(false);
    }
  });

  it("basisfelt: «enheten» i B1 og B6; B7 utvidet med teleskop/deksel", () => {
    expect((felt("Kum og deler kontrollert").config?.helpText as string)).toContain("enheten");
    expect(UO21_MAL.felter.some((f) => f.label === "Omfylling rundt enheten")).toBe(true);
    expect(UO21_MAL.felter.some((f) => f.label === "Omfylling rundt kummen")).toBe(false);
    expect((felt("Justeringsringer og ramme").config?.helpText as string)).toMatch(/teleskop|deksel/i);
  });

  it("🔴 §7b/§8: «Baio», «Bajo» og «bajonett» forekommer IKKE noe sted", () => {
    const alt = JSON.stringify(UO21_MAL);
    expect(alt).not.toMatch(/baio/i);
    expect(alt).not.toMatch(/bajo/i);
    expect(alt).not.toMatch(/bajonett/i);
  });

  it("§7b: ingen Matrise/NS-EN/NS 3420", () => {
    for (const f of UO21_MAL.felter) {
      const tekst = `${f.label} ${(f.config?.helpText as string) ?? ""} ${((f.config?.options as string[]) ?? []).join(" ")}`;
      expect(tekst).not.toMatch(/Matrise|NS-EN|NS 3420/i);
    }
  });
});
