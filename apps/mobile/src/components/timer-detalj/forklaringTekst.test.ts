import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18next, { type TFunction } from "i18next";
import { klassifiserManuellReise, type ReiseRegelsett } from "@sitedoc/shared";

// RETUR 2026-11-14 (9) V1: den grå forklaringslinja på «+ Reise» velger under/over
// etter TERSKELUTFALLET, ikke etter erReise. Testen måler selve TEKSTEN brukeren ser,
// også når firmaet har under-type «reisetid» eller over-type «arbeidstid».

// useManuellReise drar inn de lokale katalogene (expo-sqlite/SecureStore) — de er
// irrelevante for den rene tekstfunksjonen.
vi.mock("../../services/organizationSettingKatalog", () => ({}));
vi.mock("../../services/oppmotestedKatalog", () => ({}));
vi.mock("../../services/reisetidMatriseKatalog", () => ({}));
vi.mock("../../services/reiseGrensepunktKatalog", () => ({}));
vi.mock("../../services/timerKatalog", () => ({}));
vi.mock("../../lib/reiseOppmotestedLagring", () => ({}));

const { forklaringTekst } = await import("./useManuellReise");

const her = dirname(fileURLToPath(import.meta.url));
const nb = JSON.parse(
  readFileSync(join(her, "../../../../../packages/shared/src/i18n/nb.json"), "utf-8"),
) as Record<string, string>;

let t: TFunction;
beforeAll(async () => {
  const inst = i18next.createInstance();
  await inst.init({
    lng: "nb",
    resources: { nb: { translation: nb } },
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
  });
  t = inst.t;
});

function regel(over: Partial<ReiseRegelsett>): ReiseRegelsett {
  return {
    reiseTerskelEnhet: "minutter",
    reiseTerskelMin: 30,
    reiseTerskelM: null,
    reiseUnderTerskelType: "arbeidstid",
    reiseOverTerskelType: "reisetid",
    ...over,
  };
}

function tekst(r: ReiseRegelsett, reisetimer: number, avstandM: number | null = null): string {
  const k = klassifiserManuellReise({
    regel: r,
    reisetimer,
    avstandM,
    grensepunkter: [],
    resolverLonnsartId: "reise-art",
    standardLonnsartId: "ordinaer-art",
  });
  return forklaringTekst(t, k, null);
}

describe("forklaringTekst — teksten følger terskelutfallet", () => {
  it("standard: under → arbeidstid, over → reise", () => {
    const r = regel({});
    expect(tekst(r, 0.25)).toBe("Under terskel (30 min) — føres som arbeidstid");
    expect(tekst(r, 1)).toBe("Over terskel (30 min) — føres som reise");
  });

  it("under-type «reisetid»: en tur UNDER terskelen sier «Under terskel», føres som reise", () => {
    const r = regel({ reiseUnderTerskelType: "reisetid" });
    expect(tekst(r, 0.25)).toBe("Under terskel (30 min) — føres som reise");
  });

  it("over-type «arbeidstid»: en tur OVER terskelen sier «Over terskel», føres som arbeidstid", () => {
    const r = regel({ reiseOverTerskelType: "arbeidstid" });
    expect(tekst(r, 1)).toBe("Over terskel (30 min) — føres som arbeidstid");
  });

  it("km-terskel med samme regel", () => {
    const r = regel({
      reiseTerskelEnhet: "km",
      reiseTerskelM: 30000,
      reiseUnderTerskelType: "reisetid",
      reiseOverTerskelType: "arbeidstid",
    });
    expect(tekst(r, 1, 10000)).toBe("Under terskel (30 km) — føres som reise");
    expect(tekst(r, 1, 50000)).toBe("Over terskel (30 km) — føres som arbeidstid");
  });

  it("km uten kjent avstand → ukjent-teksten", () => {
    const r = regel({ reiseTerskelEnhet: "km", reiseTerskelM: 30000 });
    expect(tekst(r, 1, null)).toBe("Avstand ukjent — regnes som under terskel");
  });
});
