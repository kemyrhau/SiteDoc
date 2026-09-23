import { describe, it, expect } from "vitest";
import { BETINGELSE_EGEN_NOKKEL } from "@sitedoc/shared";
import { UP2_MAL, type FeltDef } from "./seed-bibliotek";

/**
 * UP2 «Inspeksjonskum i grunnen» (NY, ordre UP-deling § 6b). To trær: gjennomløp (UNDER, forelder for
 * plastliner i SAMME fase → `forgrening`) og materiale (FØR → barn UNDER via `barnAv`). Felt «kan
 * spyles» (trafikklys) i ETTER, alltid synlig.
 *
 * 🔴 NEGATIV TEST (ordre § 9): ingen nedstigningsfelt (mellomdekke/stige/nedstigningsåpning), og
 * T-merking IKKE i kumskjøtfeltet (den hører i basisfeltet «Kum og deler kontrollert»).
 */

const felt = (label: string): FeltDef => {
  const f = UP2_MAL.felter.find((x) => x.label === label);
  if (!f) throw new Error(`Fant ikke «${label}»`);
  return f;
};
const eget = (f: FeltDef) => (f.config?.[BETINGELSE_EGEN_NOKKEL] as string[] | undefined) ?? [];

describe("UP2 – inspeksjonskum (ny)", () => {
  it("er malen for UP2 i kapittel UP", () => {
    expect(UP2_MAL.referanse).toBe("UP2");
    expect(UP2_MAL.kapittelKode).toBe("UP");
    expect(UP2_MAL.navn).toBe("UP2 – Inspeksjonskum i grunnen");
  });

  it("gjennomløp (forelder) og plastliner (barn) i SAMME fase UNDER → forgrening", () => {
    const g = felt("Gjennomløp og fall");
    expect(g.ref).toBe("gjennomlop");
    expect(g.config?.conditionActive).toBe(true);
    expect(g.fase).toBe("UNDER");
    const liner = felt("Plastliner i gjennomløpet");
    expect(liner.parentRef).toBe("gjennomlop");
    expect(liner.fase).toBe("UNDER");
    expect(eget(liner)).toEqual(["Riktig gjennomløp og jevnt fall"]);
  });

  it("«kan spyles» er trafikklys i ETTER og alltid synlig", () => {
    const s = felt("Kummen kan spyles og inspiseres fra overflaten");
    expect(s.type).toBe("traffic_light");
    expect(s.fase).toBe("ETTER");
    expect(s.parentRef).toBeUndefined();
  });

  it("materiale er forelder (Betong/Plast); M2 for Betong, M3 for Plast; INGEN M4", () => {
    expect(felt("Materiale").ref).toBe("materiale");
    expect(felt("Materiale").config?.options).toEqual(["Betong", "Plast"]);
    expect(eget(felt("Kumskjøt og pakninger"))).toEqual(["Betong"]);
    expect(eget(felt("Oppføringsrør og form"))).toEqual(["Plast"]);
    expect(UP2_MAL.felter.some((f) => f.label === "Plasstøpt kumbunn")).toBe(false);
  });

  it("🔴 NEGATIV: ingen mellomdekke/stige/nedstigningsåpning noe sted", () => {
    for (const f of UP2_MAL.felter) {
      const tekst = `${f.label} ${(f.config?.helpText as string) ?? ""} ${((f.config?.options as string[]) ?? []).join(" ")}`;
      expect(tekst, `«${f.label}»`).not.toMatch(/mellomdekke|stige|nedstigning/i);
    }
  });

  it("🔴 NEGATIV: T-merking som KRAV står kun i B1; M2 KRYSSHENVISER dit (ikke duplikat)", () => {
    // B1 bærer det reelle T-merkingskravet (positiv kontroll — negativ test ikke falskt grønn).
    expect((felt("Kum og deler kontrollert").config?.helpText as string) ?? "").toMatch(/T-merk/i);
    // M2s eneste T-merking-omtale er krysshenvisningen til B1 (ordre §5b), ikke et eget krav.
    const m2 = (felt("Kumskjøt og pakninger").config?.helpText as string) ?? "";
    if (/T-merk/i.test(m2)) expect(m2).toMatch(/dekkes av kontrollen av kum og deler/i);
    // Ingen T-merking i noe ANNET felt (verken duplikat-krav eller løs omtale).
    for (const f of UP2_MAL.felter) {
      if (f.label === "Kum og deler kontrollert" || f.label === "Kumskjøt og pakninger") continue;
      expect((f.config?.helpText as string) ?? "", `«${f.label}»`).not.toMatch(/T-merk/i);
    }
  });

  it("§7b: ingen Matrise/NS-EN/NS 3420/bajonett", () => {
    for (const f of UP2_MAL.felter) {
      const tekst = `${f.label} ${(f.config?.helpText as string) ?? ""} ${((f.config?.options as string[]) ?? []).join(" ")}`;
      expect(tekst).not.toMatch(/Matrise|NS-EN|NS 3420|bajonett/i);
    }
  });
});
