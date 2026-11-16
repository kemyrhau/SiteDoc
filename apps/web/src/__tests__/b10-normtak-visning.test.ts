import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { lonnsartTypeEtikett } from "../lib/lonnsartTypeEtikett";
import { formaterNormtakTimer, normtakBruddLinje } from "../lib/normtakBrudd";

// Kort-id-spec § 11.10 (B10). TF19: typekolonnen i lønnsartoppsettet viser tak for fravær.
// Bruddlinja (§ 11.10.4) bygges fra serverens tall i brukerens språk.

const ord = JSON.parse(
  readFileSync(new URL("../../../../packages/shared/src/i18n/nb.json", import.meta.url), "utf-8"),
) as Record<string, string>;
const t = (k: string, vars: Record<string, string> = {}) =>
  (ord[k] ?? k).replace(/\{\{(\w+)\}\}/g, (_, v: string) => vars[v] ?? "");

describe("TF19 lonnsartTypeEtikett", () => {
  it("fravær med tak / uten tak / ukjent verdi = med tak", () => {
    expect(lonnsartTypeEtikett({ type: "fravaer", fravaerNormtak: true }, t)).toBe("Fravær · med tak");
    expect(lonnsartTypeEtikett({ type: "fravaer", fravaerNormtak: false }, t)).toBe("Fravær · uten tak");
    expect(lonnsartTypeEtikett({ type: "fravaer" }, t)).toBe("Fravær · med tak");
  });
  it("andre typer får ingen tak-etikett", () => {
    expect(lonnsartTypeEtikett({ type: "ordinaer", fravaerNormtak: true }, t)).toBe(t("firma.timer.type.ordinaer"));
  });
});

describe("normtakBruddLinje", () => {
  it("null uten brudd", () => {
    expect(normtakBruddLinje(t, null, "nb-NO")).toBeNull();
    expect(normtakBruddLinje(t, undefined, "nb-NO")).toBeNull();
  });
  it("bygger linja i brukerens tallformat", () => {
    const brudd = { artNavn: "Egenmelding", fravaerMedTak: 7.5, arbeid: 2.25, fravaerUtenTak: 0, dagsnorm: 7.5, tak: 5.25 };
    expect(normtakBruddLinje(t, brudd, "nb-NO")).toBe("Egenmelding 7,5 t + arbeid 2,25 t = 9,75 t — over dagsnormen 7,5 t");
    expect(formaterNormtakTimer(2, "en-GB")).toBe("2.0");
  });
});
