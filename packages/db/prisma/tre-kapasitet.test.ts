import { describe, it, expect } from "vitest";
import { forgrening, type FeltDef } from "./seed-bibliotek";
import { byggMalSql, type MalKonstant } from "./generer-mal-sql";
import { fasitLinjerForMal } from "./mal-fasit.test";
import { skrivMalTekst } from "./skriv-mal";

/**
 * Del A — forelder/barn i malverktøyene (ordre-mal-del-a-tre 2026-09-21). Verifiseres mot en
 * TESTMAL som IKKE ligger i seed-arrayet (ordre §2): én forelder med to barn med hvert sitt
 * utløsersett, og ett nivå nesting (et barn er selv forelder) for å bevise at helperen komponerer.
 *
 * Formen (ordre §1): utløserne ligger PÅ BARNET (`config.conditionValues`); forelderen bærer
 * `conditionActive`. Det er formen app-endringen 2026-09-21 innfører — barnets sett gjelder når det
 * finnes, ellers arves forelderens.
 *
 * Kapasiteten dekker fem ledd: (1) seed-helper `forgrening`, (2) byggBibliotekRader (id/parentId +
 * rekkefølge — dekket i @sitedoc/shared bibliotekRader.test.ts), (3) generatoren skriver parent_id
 * med foreldre før barn, (4) fasiten viser treet, (5) skriv-mal viser treet.
 */

/** Minimal FeltDef-bygger for testen (list_single m/valg) — vi eksponerer ikke seedens `valg`. */
const f = (label: string, options: string[]): FeltDef => ({
  label,
  type: "list_single",
  zone: "datafelter",
  fase: "FØR",
  config: { options },
});

/** Testmal: felt 3 (Underlag) → felt 4 (Ubundet) | felt 5 (Bundet/Gammelt) → felt 6 (Klebet). */
function byggTestMal(): MalKonstant {
  const felter = forgrening(
    "underlag",
    f("Underlaget består av", ["Ubundet", "Bundet", "Gammelt"]),
    [
      { naar: ["Ubundet"], felt: f("Planhet og komprimering", ["OK", "Avvik"]) },
      {
        naar: ["Bundet", "Gammelt"],
        felt: forgrening("klebing", f("Rengjøring og klebing", ["Klebet", "Avvik"]), [
          { naar: ["Klebet"], felt: f("Trafikk på klebet flate", ["Nei", "Ja"]) },
        ]),
      },
    ],
  );
  return {
    kapittelKode: "JH",
    referanse: "TRETEST",
    navn: "TRETEST – testmal for del A",
    beskrivelse: "Testmal (ikke i seed-arrayet). Faglig grunnlag: ikke relevant.",
    felter: felter as unknown as MalKonstant["felter"],
  };
}

describe("del A — forgrening (seed-helper)", () => {
  const felter = byggTestMal().felter as unknown as FeltDef[];

  it("forelder får ref + conditionActive; barna får parentRef + eget conditionValues", () => {
    const [underlag, planhet, klebing, trafikk] = felter;
    expect(underlag!.ref).toBe("underlag");
    expect(underlag!.config?.conditionActive).toBe(true);
    expect(underlag!.parentRef).toBeUndefined();

    expect(planhet!.parentRef).toBe("underlag");
    expect(planhet!.config?.conditionValues).toEqual(["Ubundet"]);

    // Nesting: klebing er BÅDE barn av underlag OG forelder for trafikk.
    expect(klebing!.parentRef).toBe("underlag");
    expect(klebing!.config?.conditionValues).toEqual(["Bundet", "Gammelt"]);
    expect(klebing!.ref).toBe("klebing");
    expect(klebing!.config?.conditionActive).toBe(true);

    expect(trafikk!.parentRef).toBe("klebing");
    expect(trafikk!.config?.conditionValues).toEqual(["Klebet"]);
  });

  it("rekkefølge: forelder står før barna", () => {
    expect(felter.map((x) => x.label)).toEqual([
      "Underlaget består av",
      "Planhet og komprimering",
      "Rengjøring og klebing",
      "Trafikk på klebet flate",
    ]);
  });
});

describe("del A — generatoren skriver parent_id (foreldre før barn)", () => {
  const sql = byggMalSql(byggTestMal(), "ny");

  it("bruker parent_id-kolonnen og namespacet id (<ref>:<nøkkel>)", () => {
    expect(sql).toContain("parent_id, type, label, config, translations, sort_order, required");
    expect(sql).toContain("'TRETEST:underlag'"); // forelderens id
    expect(sql).toContain("'TRETEST:klebing'"); // nestet forelders id
  });

  it("barn peker parent_id til forelderens nøkkel, foreldre står før barn i VALUES", () => {
    // Løvbarn (Planhet) får gen_random_uuid som id men parent_id = forelderen.
    expect(sql).toContain("gen_random_uuid()::text, 'TRETEST:underlag'");
    // Trafikk peker til den nestede forelderen.
    expect(sql).toContain("gen_random_uuid()::text, 'TRETEST:klebing'");
    // Forelderen settes inn før barnet (self-FK valideres ved statement-slutt uansett).
    expect(sql.indexOf("'TRETEST:underlag', NULL::text")).toBeGreaterThan(-1);
    expect(sql.indexOf("'TRETEST:underlag', NULL::text")).toBeLessThan(
      sql.indexOf("gen_random_uuid()::text, 'TRETEST:underlag'"),
    );
  });
});

describe("del A — flat mal er uendret (ingen parent_id)", () => {
  it("en flat mal emitterer gen_random_uuid og INGEN parent_id-kolonne", () => {
    const flat: MalKonstant = {
      kapittelKode: "JH",
      referanse: "FLATTEST",
      navn: "FLATTEST",
      beskrivelse: "Flat testmal.",
      felter: [f("Type", ["A", "B"])] as unknown as MalKonstant["felter"],
    };
    const sql = byggMalSql(flat, "ny");
    expect(sql).not.toContain("parent_id");
    expect(sql).toContain("SELECT gen_random_uuid()::text, m.id, r.type");
  });
});

describe("del A — fasiten viser treet", () => {
  const linjer = fasitLinjerForMal(byggTestMal() as never).join("\n");

  it("viser ref på forelder, barn-av og vises-når per barn", () => {
    expect(linjer).toContain("ref   = underlag");
    expect(linjer).toContain("barn-av = underlag");
    expect(linjer).toContain("vises-når = Ubundet");
    expect(linjer).toContain("vises-når = Bundet | Gammelt");
    expect(linjer).toContain("ref   = klebing");
    expect(linjer).toContain("barn-av = klebing");
    expect(linjer).toContain("vises-når = Klebet");
  });

  it("conditionValues/conditionActive er IKKE i det generiske config-dumpet", () => {
    expect(linjer).not.toContain("conditionValues");
    expect(linjer).not.toContain("conditionActive");
  });
});

describe("del A — skriv-mal viser treet", () => {
  const tekst = skrivMalTekst(byggTestMal() as never);

  it("viser «barn av» og «vises når» for barna", () => {
    expect(tekst).toContain("barn av      : underlag");
    expect(tekst).toContain("barn av      : klebing");
    expect(tekst).toContain('vises når    : ["Ubundet"]');
    expect(tekst).toContain('vises når    : ["Bundet","Gammelt"]');
    expect(tekst).toContain('vises når    : ["Klebet"]');
  });
});
