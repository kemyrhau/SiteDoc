/**
 * Håndhever plikten fra fabel-ordren (1b): hver seedet standardstreng MÅ finnes i
 * standardtekster.ts. Omdøping av en META-label eller et seedet opsjonssett uten at
 * `gjeldende`/`aliaser` oppdateres → rød CI. Plikten ligger i testen, ikke i hukommelsen.
 *
 * Rekkevidde: testen vandrer KUN kilder i `packages/shared` (REPORT_OBJECT_TYPE_META +
 * PROSJEKT_MODULER i types/index.ts). Seedede strenger i packages/db / apps/api ligger
 * utenfor shared sin import-graf og kan ALDRI håndheves herfra — de trenger egen guard.
 */
import { describe, it, expect } from "vitest";
import {
  REPORT_OBJECT_TYPE_META,
  REPORT_OBJECT_TYPES,
  PROSJEKT_MODULER,
  type ReportObjectType,
} from "./types";
import {
  STANDARD_FELTLABELS,
  STANDARD_OPSJONER,
  STANDARD_FELTLABEL_UNNTAK,
  ukjentTrafikklysVerdi,
  trafikklysOpsjoner,
} from "./standardtekster";
import nb from "./i18n/nb.json";

const labelDekning = new Map<ReportObjectType, Set<string>>();
for (const l of STANDARD_FELTLABELS) {
  labelDekning.set(l.type, new Set([l.gjeldende, ...l.aliaser]));
}

const opsjonDekning = new Set<string>();
for (const o of STANDARD_OPSJONER) {
  opsjonDekning.add(o.gjeldende);
  for (const a of o.aliaser) opsjonDekning.add(a);
}

/** Trekk ut label-strengene fra et options-array (string[] ELLER {value,label}[]). */
function opsjonStrenger(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((o) => (typeof o === "string" ? o : (o as { label?: string })?.label))
    .filter((s): s is string => typeof s === "string" && s.length > 0);
}

describe("standardtekster — feltlabels", () => {
  const dekkedeTyper = REPORT_OBJECT_TYPES.filter(
    (t) => !STANDARD_FELTLABEL_UNNTAK.includes(t),
  );

  it.each(dekkedeTyper)(
    "META-label for '%s' er dekket i STANDARD_FELTLABELS",
    (type) => {
      const label = REPORT_OBJECT_TYPE_META[type].label;
      const dekning = labelDekning.get(type);
      expect(dekning, `mangler tabelloppføring for type '${type}'`).toBeDefined();
      expect(
        dekning!.has(label),
        `META-label «${label}» for '${type}' mangler i gjeldende/aliaser — omdøpt uten tabellføring?`,
      ).toBe(true);
    },
  );

  it("hver feltlabel-nøkkel finnes i nb.json", () => {
    const nbMap = nb as Record<string, string>;
    for (const l of STANDARD_FELTLABELS) {
      expect(nbMap[l.nokkel], `nb.json mangler ${l.nokkel}`).toBeDefined();
    }
  });
});

describe("standardtekster — opsjonsstrenger", () => {
  // META-defaults (i dag kun traffic_light) + alle standardmalenes felt-definisjoner
  const seededeOpsjoner = new Set<string>();

  for (const meta of Object.values(REPORT_OBJECT_TYPE_META)) {
    for (const s of opsjonStrenger((meta.defaultConfig as { options?: unknown }).options)) {
      seededeOpsjoner.add(s);
    }
  }
  for (const modul of PROSJEKT_MODULER) {
    for (const mal of modul.maler) {
      for (const obj of mal.objekter) {
        for (const s of opsjonStrenger((obj.config as { options?: unknown }).options)) {
          seededeOpsjoner.add(s);
        }
      }
    }
  }

  it("fant faktisk seedede opsjoner (guard mot tom sveip)", () => {
    expect(seededeOpsjoner.size).toBeGreaterThan(0);
  });

  it.each([...seededeOpsjoner])(
    "seedet opsjonsstreng «%s» er dekket i STANDARD_OPSJONER",
    (streng) => {
      expect(
        opsjonDekning.has(streng),
        `seedet opsjonsstreng «${streng}» mangler i STANDARD_OPSJONER (gjeldende ∪ aliaser)`,
      ).toBe(true);
    },
  );

  it("hver opsjons-nøkkel finnes i nb.json", () => {
    const nbMap = nb as Record<string, string>;
    for (const o of STANDARD_OPSJONER) {
      expect(nbMap[o.nokkel], `nb.json mangler ${o.nokkel}`).toBeDefined();
    }
  });
});

/**
 * BESLUTNINGEN (ikke bare verdisettet) — én kilde for web + mobil, speilet i pdf. Fanger
 * uenighet om tom streng / whitespace / null vs undefined FØR de kan divergere mellom flatene.
 */
describe("ukjentTrafikklysVerdi — foreldreløs-beslutningen", () => {
  it("ukjent, ikke-tom streng → den RÅ verdien (foreldreløs)", () => {
    expect(ukjentTrafikklysVerdi("gray_gammel")).toBe("gray_gammel");
    expect(ukjentTrafikklysVerdi("foreldreloes-42")).toBe("foreldreloes-42");
  });
  it("gyldig verdi → null (normal brikke matcher)", () => {
    for (const { value } of ["green", "yellow", "red", "gray"].map((v) => ({ value: v }))) {
      expect(ukjentTrafikklysVerdi(value)).toBeNull();
    }
  });
  it("tom streng OG whitespace-only → null (et mellomrom er ikke et svar — trim tilsiktet)", () => {
    expect(ukjentTrafikklysVerdi("")).toBeNull();
    expect(ukjentTrafikklysVerdi(" ")).toBeNull();
    expect(ukjentTrafikklysVerdi("   ")).toBeNull();
  });
  it("ikke-streng → null (ubesvart, ikke en foreldreløs verdi)", () => {
    expect(ukjentTrafikklysVerdi(null)).toBeNull();
    expect(ukjentTrafikklysVerdi(undefined)).toBeNull();
    expect(ukjentTrafikklysVerdi(123)).toBeNull();
    expect(ukjentTrafikklysVerdi({})).toBeNull();
  });
});

/**
 * Lyssett-lesing (`trafikklysOpsjoner`) — den delte kilden web + mobil rendrer fra. Krav (c) pkt
 * 1–2 på ren logikk-flate; pkt 4 mot de FAKTISKE systemmal-deklarasjonene i PROSJEKT_MODULER
 * (ikke en kopi skrevet i testen). En test som bare sjekker at det ikke kastes er en tillatelse,
 * ikke en test — derfor kreves den nøyaktige verdirekkefølgen og etikett-kilden.
 */
function finnTrafikklys(slug: string, label: string) {
  const modul = PROSJEKT_MODULER.find((m) => m.slug === slug);
  const objekt = modul?.maler.flatMap((mal) => mal.objekter).find((o) => o.type === "traffic_light" && o.label === label);
  if (!objekt) throw new Error(`Fant ikke traffic_light «${label}» i modul «${slug}»`);
  return objekt;
}

describe("trafikklysOpsjoner — feltets eget lyssett vs. kanonisk", () => {
  it("(c1) egne options → NØYAKTIG dem, i rekkefølge, med egen etikett (ikke kanonisk sett)", () => {
    const valg = trafikklysOpsjoner([
      { value: "red", label: "Åpent" },
      { value: "yellow", label: "Under behandling" },
      { value: "green", label: "Lukket" },
    ]);
    expect(valg.map((v) => v.value)).toEqual(["red", "yellow", "green"]);
    expect(valg.map((v) => v.tekst)).toEqual(["Åpent", "Under behandling", "Lukket"]);
    expect(valg.every((v) => v.erI18nNokkel === false)).toBe(true); // egen etikett, ikke i18n-nøkkel
  });

  it("(c2) uten options → kanonisk TRAFIKKLYS_VALG uendret (fire lys, i18n-nøkler)", () => {
    for (const tom of [undefined, null, []]) {
      const valg = trafikklysOpsjoner(tom);
      expect(valg.map((v) => v.value)).toEqual(["green", "yellow", "red", "gray"]);
      expect(valg.map((v) => v.tekst)).toEqual([
        "standardopsjon.godkjent",
        "standardopsjon.anmerkning",
        "standardopsjon.avvik",
        "standardopsjon.ikkeRelevant",
      ]);
      expect(valg.every((v) => v.erI18nNokkel === true)).toBe(true);
    }
  });

  it("bar verdi (options uten egen etikett) → kanonisk i18n-nøkkel for verdien, ikke rå «green»", () => {
    const valg = trafikklysOpsjoner([{ value: "green" }, { value: "red" }]);
    expect(valg).toEqual([
      { value: "green", tekst: "standardopsjon.godkjent", erI18nNokkel: true },
      { value: "red", tekst: "standardopsjon.avvik", erI18nNokkel: true },
    ]);
  });

  it("(c4) HMS-avvik «Status» = tre lys Åpent/Under behandling/Lukket (faktisk deklarasjon)", () => {
    const valg = trafikklysOpsjoner(finnTrafikklys("hms-avvik", "Status").config.options);
    expect(valg.map((v) => v.value)).toEqual(["red", "yellow", "green"]);
    expect(valg.map((v) => v.tekst)).toEqual(["Åpent", "Under behandling", "Lukket"]);
  });

  it("(c4) Godkjenning «Beslutning» = fire lys, inkl. Avvist + Ikke behandlet (faktisk deklarasjon)", () => {
    const valg = trafikklysOpsjoner(finnTrafikklys("godkjenning", "Beslutning").config.options);
    expect(valg.map((v) => v.value)).toEqual(["green", "yellow", "red", "gray"]);
    expect(valg.map((v) => v.tekst)).toEqual(["Godkjent", "Delvis godkjent", "Avvist", "Ikke behandlet"]);
  });
});
