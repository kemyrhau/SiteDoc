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
