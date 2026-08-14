import { describe, it, expect } from "vitest";
import { ukerTilFrist, isoUkeRef, avledPunktTilstand } from "../kontrollplanFremdrift";

/**
 * Leveranse 2: avledet tilstand (fremdrift × frist) + ISO-uke-aritmetikk.
 *
 * Årsskiftet er den kritiske kanten: ukenummer er ikke monotone over årsgrensen, og
 * ISO-år kan ha 52 ELLER 53 uker. ISO-2026 har 53 uker (1. januar 2026 er torsdag), så
 * U52 → U01 går via U53 = 2 uker, ikke 1. Regnes det på uke-tall alene, bommer det.
 */
describe("ukerTilFrist — ISO-uker over årsgrensen (inkl. 53-ukers-år)", () => {
  it("U52/2026 → U01/2027 er 2 uker (via U53/2026)", () => {
    expect(ukerTilFrist({ uke: 1, aar: 2027 }, { uke: 52, aar: 2026 })).toBe(2);
  });
  it("U53/2026 → U01/2027 er 1 uke (U53 finnes i ISO-2026)", () => {
    expect(ukerTilFrist({ uke: 1, aar: 2027 }, { uke: 53, aar: 2026 })).toBe(1);
  });
  it("passert frist over årsgrensen er negativt", () => {
    expect(ukerTilFrist({ uke: 52, aar: 2026 }, { uke: 1, aar: 2027 })).toBe(-2);
  });
  it("innenfor samme år: U10 → U12 er 2 uker", () => {
    expect(ukerTilFrist({ uke: 12, aar: 2026 }, { uke: 10, aar: 2026 })).toBe(2);
  });
  it("isoUkeRef: 1. januar 2027 tilhører ISO-uke 53/2026 (torsdag-regelen)", () => {
    // 1. jan 2027 er en fredag → ISO-uken dens (torsdag 31.12.2026) er U53/2026.
    expect(isoUkeRef(new Date(2027, 0, 1))).toEqual({ uke: 53, aar: 2026 });
  });
});

describe("avledPunktTilstand — seks tilstander (form = startet, farge = haster)", () => {
  const naa = { uke: 20, aar: 2026 };
  const base = { status: "planlagt", sjekkliste: null, fristUke: null, fristAar: null, varselUkerFor: 1 };

  it("Godkjent: koblet sjekkliste approved → fylt, grønn", () => {
    const t = avledPunktTilstand({ ...base, sjekkliste: { status: "approved" } }, naa);
    expect(t.tilstand).toBe("godkjent");
    expect(t.fylt).toBe(true);
    expect(t.farge).toBe("#10b981");
  });
  it("Påbegynt: koblet sjekkliste draft → fylt, blå", () => {
    const t = avledPunktTilstand({ ...base, sjekkliste: { status: "draft" } }, naa);
    expect(t.tilstand).toBe("pabegynt");
    expect(t.fylt).toBe(true);
  });
  it("Påbegynt: legacy ukoblet 'utfort' vises som påbegynt (utført ≠ godkjent)", () => {
    const t = avledPunktTilstand({ ...base, status: "utfort" }, naa);
    expect(t.tilstand).toBe("pabegynt");
  });
  it("Uten frist: ikke startet, frist null → grå, ring — egen tilstand", () => {
    const t = avledPunktTilstand(base, naa);
    expect(t.tilstand).toBe("utenFrist");
    expect(t.fylt).toBe(false);
  });
  it("Forfalt: ikke startet, frist passert → rød, ring", () => {
    const t = avledPunktTilstand({ ...base, fristUke: 10, fristAar: 2026 }, naa);
    expect(t.tilstand).toBe("forfalt");
    expect(t.farge).toBe("#ef4444");
    expect(t.fylt).toBe(false);
  });
  it("Aktuell nå: innenfor varselUkerFor → amber, ring", () => {
    const t = avledPunktTilstand({ ...base, fristUke: 21, fristAar: 2026, varselUkerFor: 1 }, naa);
    expect(t.tilstand).toBe("aktuellNaa");
    expect(t.farge).toBe("#f59e0b");
  });
  it("Planlagt: frist lenger unna enn varselUkerFor → grå, ring", () => {
    const t = avledPunktTilstand({ ...base, fristUke: 30, fristAar: 2026, varselUkerFor: 1 }, naa);
    expect(t.tilstand).toBe("planlagt");
    expect(t.fylt).toBe(false);
  });
  it("Planlagt og Uten frist deler grå/ring men er DISTINKTE (ulik label)", () => {
    const planlagt = avledPunktTilstand({ ...base, fristUke: 30, fristAar: 2026 }, naa);
    const utenFrist = avledPunktTilstand(base, naa);
    expect(planlagt.labelKey).not.toBe(utenFrist.labelKey);
  });
});
