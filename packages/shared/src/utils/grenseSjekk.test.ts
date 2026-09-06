import { describe, it, expect } from "vitest";
import {
  normaliserGrense,
  harGrense,
  grenseStatus,
  formaterGrense,
  beregnAvvik,
  byggAvvikLinje,
  byggKravHerkomst,
  utenforKravOppfylt,
  lesKravType,
  løsGrense,
} from "./grenseSjekk";

describe("normaliserGrense — norsk kanonisk + engelsk fallback", () => {
  it("leser norske nøkler (seed NS3420)", () => {
    expect(normaliserGrense({ enhet: "mm", toleranse: 3 })).toEqual({
      min: null,
      maks: null,
      toleranse: 3,
      desimaler: null,
      enhet: "mm",
    });
  });

  it("leser engelske nøkler som fallback (MalBygger-bygde maler)", () => {
    expect(normaliserGrense({ unit: "%", max: 10, decimals: 2 })).toEqual({
      min: null,
      maks: 10,
      toleranse: null,
      desimaler: 2,
      enhet: "%",
    });
  });

  it("norsk vinner over engelsk når begge finnes", () => {
    const g = normaliserGrense({ maks: 5, max: 99, enhet: "m", unit: "km" });
    expect(g.maks).toBe(5);
    expect(g.enhet).toBe("m");
  });

  it("tolererer tall-streng og komma-desimal", () => {
    expect(normaliserGrense({ min: "2,5" }).min).toBe(2.5);
  });

  it("tom/ugyldig verdi blir null", () => {
    expect(normaliserGrense({ min: "", maks: "abc" })).toMatchObject({
      min: null,
      maks: null,
    });
  });
});

describe("harGrense", () => {
  it("false uten grense", () => {
    expect(harGrense(normaliserGrense({ enhet: "mm" }))).toBe(false);
  });
  it("true med toleranse", () => {
    expect(harGrense(normaliserGrense({ toleranse: 3 }))).toBe(true);
  });
});

describe("grenseStatus", () => {
  it("min: verdi under grensen → under (Fall ≥ 2%)", () => {
    const g = normaliserGrense({ min: 2, enhet: "%" });
    expect(grenseStatus(1.5, g)).toBe("under");
    expect(grenseStatus(2, g)).toBe("ok");
    expect(grenseStatus(3, g)).toBe("ok");
  });

  it("maks: verdi over grensen → over (Vertikalt sprang maks 2mm)", () => {
    const g = normaliserGrense({ maks: 2, enhet: "mm" });
    expect(grenseStatus(3, g)).toBe("over");
    expect(grenseStatus(2, g)).toBe("ok");
  });

  it("toleranse: |verdi| over båndet → utenfor_toleranse (Planhet ±3mm)", () => {
    const g = normaliserGrense({ toleranse: 3, enhet: "mm" });
    expect(grenseStatus(4, g)).toBe("utenfor_toleranse");
    expect(grenseStatus(-4, g)).toBe("utenfor_toleranse");
    expect(grenseStatus(3, g)).toBe("ok");
    expect(grenseStatus(-2, g)).toBe("ok");
  });

  it("min+maks kombinert (2–10)", () => {
    const g = normaliserGrense({ min: 2, maks: 10 });
    expect(grenseStatus(1, g)).toBe("under");
    expect(grenseStatus(11, g)).toBe("over");
    expect(grenseStatus(5, g)).toBe("ok");
  });

  it("null når verdi ikke er tall eller ingen grense", () => {
    expect(grenseStatus(null, normaliserGrense({ maks: 2 }))).toBeNull();
    expect(grenseStatus(5, normaliserGrense({ enhet: "mm" }))).toBeNull();
  });
});

describe("formaterGrense — språknøytral", () => {
  it("kun min", () => {
    expect(formaterGrense(normaliserGrense({ min: 2, enhet: "%" }))).toBe("≥ 2 %");
  });
  it("kun maks", () => {
    expect(formaterGrense(normaliserGrense({ maks: 2, enhet: "mm" }))).toBe("≤ 2 mm");
  });
  it("toleranse", () => {
    expect(formaterGrense(normaliserGrense({ toleranse: 3, enhet: "mm" }))).toBe("± 3 mm");
  });
  it("min+maks spenn", () => {
    expect(formaterGrense(normaliserGrense({ min: 2, maks: 10, enhet: "mm" }))).toBe("2–10 mm");
  });
  it("uten enhet", () => {
    expect(formaterGrense(normaliserGrense({ min: 5 }))).toBe("≥ 5");
  });
  it("tom når ingen grense", () => {
    expect(formaterGrense(normaliserGrense({ enhet: "mm" }))).toBe("");
  });
});

describe("lesKravType — eksplisitt vinner, ellers utledes", () => {
  it("eksplisitt kravType vinner over satte felter", () => {
    // Sett maks (ville utledet 'hoyst'), men eksplisitt 'mellom' → varsel-tilfellet
    expect(lesKravType({ kravType: "mellom", maks: 10 })).toBe("mellom");
  });
  it("hver eksplisitt verdi returneres uendret", () => {
    expect(lesKravType({ kravType: "minst" })).toBe("minst");
    expect(lesKravType({ kravType: "hoyst" })).toBe("hoyst");
    expect(lesKravType({ kravType: "toleranse" })).toBe("toleranse");
  });
  it("ugyldig eksplisitt verdi ignoreres → utledes", () => {
    expect(lesKravType({ kravType: "tull", min: 5 })).toBe("minst");
  });
  it("utleder minst fra kun min", () => {
    expect(lesKravType({ min: 30 })).toBe("minst");
  });
  it("utleder hoyst fra kun maks (også engelsk alias)", () => {
    expect(lesKravType({ maks: 10 })).toBe("hoyst");
    expect(lesKravType({ max: 10 })).toBe("hoyst");
  });
  it("utleder mellom fra min + maks", () => {
    expect(lesKravType({ min: 2, maks: 10 })).toBe("mellom");
  });
  it("utleder toleranse når toleranse er satt (presedens)", () => {
    expect(lesKravType({ toleranse: 3 })).toBe("toleranse");
    expect(lesKravType({ min: 2, maks: 10, toleranse: 3 })).toBe("toleranse");
  });
  it("null når ingen grense", () => {
    expect(lesKravType({ enhet: "mm" })).toBeNull();
    expect(lesKravType({})).toBeNull();
  });
});

describe("løsGrense — bakoverkompatibel, variant-matching", () => {
  const STD = { min: null, maks: 10, toleranse: null, desimaler: 2, enhet: "mm" };

  it("uten styrendeFeltId → standardgrense (identisk med normaliserGrense)", () => {
    const config = { maks: 10, desimaler: 2, enhet: "mm" };
    expect(løsGrense({ config }, "hva som helst")).toEqual(STD);
    expect(løsGrense({ config }, undefined)).toEqual(normaliserGrense(config));
  });

  it("styrendeFeltId satt men ingen varianter → standard", () => {
    const config = { maks: 10, desimaler: 2, enhet: "mm", styrendeFeltId: "f1" };
    expect(løsGrense({ config }, "A")).toEqual(STD);
  });

  it("forelderVerdi null/undefined → standard selv med varianter", () => {
    const config = {
      maks: 10, desimaler: 2, enhet: "mm", styrendeFeltId: "f1",
      grenseVarianter: [{ valg: "A", maks: 5 }],
    };
    expect(løsGrense({ config }, null)).toEqual(STD);
    expect(løsGrense({ config }, undefined)).toEqual(STD);
  });

  it("treff overstyrer tallet; enhet/desimaler forblir felles", () => {
    const config = {
      maks: 10, desimaler: 2, enhet: "mm", styrendeFeltId: "f1",
      grenseVarianter: [{ valg: "Tett", maks: 5 }, { valg: "Åpen", maks: 20 }],
    };
    expect(løsGrense({ config }, "Tett")).toEqual({
      min: null, maks: 5, toleranse: null, desimaler: 2, enhet: "mm",
    });
    expect(løsGrense({ config }, "Åpen")).toEqual({
      min: null, maks: 20, toleranse: null, desimaler: 2, enhet: "mm",
    });
  });

  it("tom variantcelle arver standard (undefined/null/tom streng)", () => {
    const config = {
      min: 2, maks: 10, desimaler: 1, enhet: "%", styrendeFeltId: "f1",
      grenseVarianter: [{ valg: "A", maks: 8 }], // min utelatt → arver 2
    };
    expect(løsGrense({ config }, "A")).toEqual({
      min: 2, maks: 8, toleranse: null, desimaler: 1, enhet: "%",
    });
    const config2 = {
      min: 2, maks: 10, styrendeFeltId: "f1",
      grenseVarianter: [{ valg: "A", min: "", maks: null }], // begge tomme → arver
    };
    const g2 = løsGrense({ config: config2 }, "A");
    expect(g2.min).toBe(2);
    expect(g2.maks).toBe(10);
  });

  it("ingen treff (foreldreløs/ukjent verdi) → standard, aldri stille sletting", () => {
    const config = {
      maks: 10, desimaler: 2, enhet: "mm", styrendeFeltId: "f1",
      grenseVarianter: [{ valg: "A", maks: 5 }],
    };
    expect(løsGrense({ config }, "Ukjent")).toEqual(STD);
  });

  it("matcher via normaliserOpsjon på begge sider ({value,label} vs streng)", () => {
    const config = {
      maks: 10, styrendeFeltId: "f1",
      grenseVarianter: [{ valg: { value: "green", label: "Godkjent" }, maks: 3 }],
    };
    // forelderVerdi er den lagrede opsjonsverdien (streng "green")
    expect(løsGrense({ config }, "green").maks).toBe(3);
  });

  it("leser engelsk alias-config for standard (max)", () => {
    const config = {
      max: 10, unit: "mm", styrendeFeltId: "f1",
      grenseVarianter: [{ valg: "A", maks: 4 }],
    };
    expect(løsGrense({ config }, "B")).toEqual(normaliserGrense(config)); // ingen treff → std
    expect(løsGrense({ config }, "A").maks).toBe(4);
    expect(løsGrense({ config }, "A").enhet).toBe("mm");
  });
});

describe("beregnAvvik — målt avvik + retning (trinn 3 del C)", () => {
  const g = (o: Record<string, unknown>) => normaliserGrense(o);
  it("over maks → avvik = verdi − maks", () => {
    expect(beregnAvvik(14, g({ maks: 10, enhet: "mm" }))).toEqual({ avvik: 4, retning: "over" });
  });
  it("under min → avvik = min − verdi", () => {
    expect(beregnAvvik(93, g({ min: 95, enhet: "%" }))).toEqual({ avvik: 2, retning: "under" });
  });
  it("utenfor toleranse → avvik = |verdi| − toleranse", () => {
    expect(beregnAvvik(5, g({ toleranse: 3 }))).toEqual({ avvik: 2, retning: "utenfor_toleranse" });
  });
  it("innenfor / tom → null", () => {
    expect(beregnAvvik(8, g({ maks: 10 }))).toBeNull();
    expect(beregnAvvik(null, g({ maks: 10 }))).toBeNull();
  });
  it("float-støy rundes til desimaler", () => {
    expect(beregnAvvik(0.3, g({ maks: 0.1, desimaler: 1 }))?.avvik).toBe(0.2);
  });
});

describe("byggAvvikLinje — i18n-linje via t-callback", () => {
  const t = (key: string, opts?: Record<string, unknown>) =>
    key === "grense.avvikLinje" ? `Avvik: ${opts!.avvik} ${opts!.retning}` : `<${key}>`;
  it("bygger linje med enhet + retningsnøkkel", () => {
    expect(byggAvvikLinje(t, 14, normaliserGrense({ maks: 10, enhet: "mm" }))).toBe(
      "Avvik: 4 mm <grense.avvikOver>",
    );
  });
  it("innenfor → null", () => {
    expect(byggAvvikLinje(t, 8, normaliserGrense({ maks: 10 }))).toBeNull();
  });
});

describe("utenforKravOppfylt — avviksfelt-utløser (trinn 3 del C)", () => {
  const hent = () => undefined;
  it("verdi bryter kravet → true", () => {
    expect(utenforKravOppfylt({ config: { maks: 10 } }, 14, hent)).toBe(true);
  });
  it("verdi innenfor → false", () => {
    expect(utenforKravOppfylt({ config: { maks: 10 } }, 8, hent)).toBe(false);
  });
  it("tom verdi → false (ingen utløsning)", () => {
    expect(utenforKravOppfylt({ config: { maks: 10 } }, null, hent)).toBe(false);
  });
  it("Vei B: styrende felt løser grensen først", () => {
    const config = { maks: 10, styrendeFeltId: "u", grenseVarianter: [{ valg: "sp", maks: 25 }] };
    expect(utenforKravOppfylt({ config }, 20, (id) => (id === "u" ? "sp" : undefined))).toBe(false);
    expect(utenforKravOppfylt({ config }, 20, () => "pukk")).toBe(true); // std maks 10
  });
});

describe("byggKravHerkomst — hvor et betinget krav kom fra (2026-09-07)", () => {
  const t = (key: string, opts?: Record<string, unknown>) =>
    key === "grense.herkomst" ? `Krav ${opts!.krav} — følger av ${opts!.felt}: ${opts!.valg}.` : `<${key}>`;
  const objekt = { config: { maks: 35, enhet: "mm", styrendeFeltId: "mat", grenseVarianter: [{ valg: "delvis", maks: 25 }] } };
  const styrende = { label: "Materialstatus", config: { options: [{ value: "delvis", label: "Delvis sortert" }, { value: "sortert", label: "Sortert" }] } };

  it("variant traff → herkomstlinje med det løste kravet + valgets label", () => {
    expect(byggKravHerkomst(t, objekt, "delvis", styrende)).toBe("Krav ≤ 25 mm — følger av Materialstatus: Delvis sortert.");
  });
  it("standardkravet gjelder (ingen variant traff) → null", () => {
    expect(byggKravHerkomst(t, objekt, "sortert", styrende)).toBeNull();
  });
  it("ikke betinget (uten styrendeFeltId) → null", () => {
    expect(byggKravHerkomst(t, { config: { maks: 10 } }, undefined, undefined)).toBeNull();
  });
  it("navnløst styrende felt → null (herkomsten ville pekt i løse lufta)", () => {
    expect(byggKravHerkomst(t, objekt, "delvis", { label: "  ", config: styrende.config })).toBeNull();
  });
})
