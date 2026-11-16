import { describe, it, expect } from "vitest";
import { bruddForDag, restForRad, normtakGrenseTekst, type NormtakDagRad, type NormtakArt } from "./fravaerNormtakMobil";

/**
 * 🔴 TF23 / TF24 (ORDRE (33) c3, spec § 11.10.4 «Mobil (ordre c)»).
 * TF23: brudd som oppstår etterpå (N5) — dagskortets brudd-linje med ett-trykks retting
 *       («Rett til X t», tak 0: «Slett fraværet») og send-sperre (F9 = A).
 * TF24: rad-vinduet — resten er øvre grense for en lagret fraværsrad med tak.
 * Skrevet FØR modulen (rød: modulen fantes ikke).
 */

const ARTER: Record<string, NormtakArt> = {
  arbeid: { type: "ordinaer", navn: "Ordinær", fravaerNormtak: null },
  egen: { type: "fravaer", navn: "Egenmelding", fravaerNormtak: null },
  syk: { type: "fravaer", navn: "Sykmelding", fravaerNormtak: true },
  ferie: { type: "fravaer", navn: "Ferie m/lønn", fravaerNormtak: false },
  reise: { type: "ordinaer", navn: "Reise", fravaerNormtak: null },
};
const finnArt = (id: string | null) => (id ? ARTER[id] ?? null : null);
const rad = (id: string, lonnsartId: string, timer: number, erReise = false): NormtakDagRad => ({
  id,
  lonnsartId,
  timer,
  erReise,
});

describe("🔴 TF23 — brudd-linja i dagskortet", () => {
  it("egenmelding 7,5 t + arbeid 2 t, norm 7,5 → brudd, rett til 5,5 t", () => {
    const b = bruddForDag({ dagsnorm: 7.5, rader: [rad("f", "egen", 7.5), rad("a", "arbeid", 2)], finnArt });
    expect(b).not.toBeNull();
    expect(b!.radId).toBe("f");
    expect(b!.rettTil).toBe(5.5);
    expect(b!.data).toEqual({
      artNavn: "Egenmelding",
      fravaerMedTak: 7.5,
      arbeid: 2,
      fravaerUtenTak: 0,
      dagsnorm: 7.5,
      tak: 5.5,
    });
  });

  it("tak 0 (arbeid fyller normen) → rettTil 0 = slett fraværet (N6)", () => {
    const b = bruddForDag({ dagsnorm: 7.5, rader: [rad("f", "egen", 3), rad("a", "arbeid", 8)], finnArt });
    expect(b!.rettTil).toBe(0);
  });

  it("fravær uten tak bruker plassen, men måles aldri (N3): ferie 2 t + egenmelding 7,5 t → rett til 5,5 t", () => {
    const b = bruddForDag({ dagsnorm: 7.5, rader: [rad("p", "ferie", 2), rad("f", "egen", 7.5)], finnArt });
    expect(b!.radId).toBe("f");
    expect(b!.rettTil).toBe(5.5);
    expect(b!.data.fravaerUtenTak).toBe(2);
  });

  it("fravær uten tak alene over normen → intet brudd (N4)", () => {
    expect(bruddForDag({ dagsnorm: 7.5, rader: [rad("p", "ferie", 7.5), rad("a", "arbeid", 2)], finnArt })).toBeNull();
  });

  it("reise teller ikke som arbeid (N8)", () => {
    expect(
      bruddForDag({ dagsnorm: 7.5, rader: [rad("f", "egen", 7.5), rad("r", "reise", 1, true)], finnArt }),
    ).toBeNull();
  });

  it("ukjent norm → intet tak, intet brudd (L3)", () => {
    expect(bruddForDag({ dagsnorm: null, rader: [rad("f", "egen", 7.5), rad("a", "arbeid", 2)], finnArt })).toBeNull();
    expect(bruddForDag({ dagsnorm: 0, rader: [rad("f", "egen", 7.5), rad("a", "arbeid", 2)], finnArt })).toBeNull();
  });

  it("to linjer med tak: siste linje rettes først; går den til 0, slettes den", () => {
    const b = bruddForDag({
      dagsnorm: 7.5,
      rader: [rad("f1", "egen", 4), rad("f2", "syk", 2), rad("a", "arbeid", 3)],
      finnArt,
    });
    // tak 4,5; fravær med tak 6 → 1,5 over; siste (f2, 2 t) → 0,5 t
    expect(b!.radId).toBe("f2");
    expect(b!.rettTil).toBe(0.5);
  });

  it("over mer enn siste linje: siste slettes, neste trykk retter neste", () => {
    const b = bruddForDag({
      dagsnorm: 7.5,
      rader: [rad("f1", "egen", 5), rad("f2", "syk", 1), rad("a", "arbeid", 4)],
      finnArt,
    });
    // tak 3,5; fravær 6 → 2,5 over; f2 (1 t) slettes
    expect(b!.radId).toBe("f2");
    expect(b!.rettTil).toBe(0);
  });

  it("innenfor taket → null (ingen linje, ingen sperre)", () => {
    expect(bruddForDag({ dagsnorm: 7.5, rader: [rad("f", "egen", 5.5), rad("a", "arbeid", 2)], finnArt })).toBeNull();
  });
});

describe("🔴 TF24 — rad-vinduet: rest som øvre grense", () => {
  it("lagret egenmelding på en dag med 2 t arbeid → høyst 5,5 t", () => {
    const r = restForRad({
      dagsnorm: 7.5,
      rader: [rad("f", "egen", 7.5), rad("a", "arbeid", 2)],
      radId: "f",
      lonnsartId: "egen",
      finnArt,
    });
    expect(r).toEqual({ rest: 5.5, arbeid: 2, annetFravaer: 0 });
  });

  it("annet fravær regnes med (F10)", () => {
    const r = restForRad({
      dagsnorm: 7.5,
      rader: [rad("f", "egen", 3), rad("p", "ferie", 2), rad("a", "arbeid", 2)],
      radId: "f",
      lonnsartId: "egen",
      finnArt,
    });
    expect(r).toEqual({ rest: 3.5, arbeid: 2, annetFravaer: 2 });
  });

  it("art uten tak → ingen grense (null)", () => {
    expect(
      restForRad({ dagsnorm: 7.5, rader: [rad("p", "ferie", 7.5)], radId: "p", lonnsartId: "ferie", finnArt }),
    ).toBeNull();
  });

  it("arbeidsart → ingen grense (null)", () => {
    expect(
      restForRad({ dagsnorm: 7.5, rader: [rad("a", "arbeid", 9)], radId: "a", lonnsartId: "arbeid", finnArt }),
    ).toBeNull();
  });

  it("ukjent norm → ingen grense", () => {
    expect(
      restForRad({ dagsnorm: null, rader: [rad("f", "egen", 9)], radId: "f", lonnsartId: "egen", finnArt }),
    ).toBeNull();
  });

  it("bytte til art med tak i vinduet: radens egne timer teller ikke som annet fravær", () => {
    const r = restForRad({
      dagsnorm: 7.5,
      rader: [rad("f", "ferie", 7.5), rad("a", "arbeid", 1)],
      radId: "f",
      lonnsartId: "egen",
      finnArt,
    });
    expect(r!.rest).toBe(6.5);
  });
});

describe("🔴 TF24 — linja under timefeltet", () => {
  const t = (k: string, v?: Record<string, string>) => `${k}${v ? JSON.stringify(v) : ""}`;
  const fmt = (n: number) => String(n).replace(".", ",");
  it("arbeid ført", () => {
    expect(normtakGrenseTekst(t, { rest: 5.5, arbeid: 2, annetFravaer: 0 }, fmt)).toBe(
      'timer.normtak.hoyst{"timer":"5,5","fort":"timer.normtak.fortArbeid{\\"timer\\":\\"2\\"}"}',
    );
  });
  it("arbeid og annet fravær nevnes begge", () => {
    expect(normtakGrenseTekst(t, { rest: 3.5, arbeid: 2, annetFravaer: 2 }, fmt)).toContain("fortBegge");
  });
  it("bare annet fravær", () => {
    expect(normtakGrenseTekst(t, { rest: 5.5, arbeid: 0, annetFravaer: 2 }, fmt)).toContain("fortAnnet");
  });
  it("ingenting ført", () => {
    expect(normtakGrenseTekst(t, { rest: 7.5, arbeid: 0, annetFravaer: 0 }, fmt)).toContain("hoystUtenFort");
  });
  it("rest 0 → Dagsnormen er fylt", () => {
    expect(normtakGrenseTekst(t, { rest: 0, arbeid: 7.5, annetFravaer: 0 }, fmt)).toBe("timer.normtak.normFylt");
  });
});
