import { describe, it, expect, vi } from "vitest";
import * as path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * RETUR prosjektkort-utkast (gate-dom Kontrollør 2026-11-13), vilkår 1 og 2.
 *
 * V10 (avvik 10): en fjernet kvittering slettes først når en utkastversjon UTEN
 * utlegget er skrevet. Uten callback sletter `BekreftDagLonnUtlegg` straks, som før.
 * V12 (avvik 12): trykk på et GPS-utkast i Timer-lista går via SAMME funksjon som
 * «Slutt dag» (`forberedSluttDag`: slutt-GPS + fersk norm før navigasjonen).
 */

vi.mock("../hooks/useArbeidsdag", () => ({
  fangGps: async () => ({ lat: null, lng: null }),
  formatIsoDato: (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
}));
vi.mock("../services/arbeidstidSvarKatalog", () => ({ hentOgCacheArbeidstidSvar: async () => true }));
vi.mock("../db/database", () => ({ hentDatabase: () => null }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { forberedSluttDag } from "../services/sluttDag";
import { formatIsoDato } from "../hooks/useArbeidsdag";
import { slettbareEtterSkriving, type UtkastData } from "./prosjektkortUtkast";

const her = path.dirname(fileURLToPath(import.meta.url));
function utenKommentarer(t: string): string {
  return t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function les(rel: string): string {
  return utenKommentarer(readFileSync(path.resolve(her, rel), "utf8"));
}
const SKJERM = les("../../app/timer/bekreft-dag.tsx");
const LISTE = les("../components/DagsseddelListe.tsx");
const KORT = les("../components/StartSluttDagKort.tsx");
const UTLEGG = les("../components/timer-detalj/BekreftDagLonnUtlegg.tsx");

/** Vakten + negativkontroll: regexen treffer kilden, men IKKE den muterte kopien. */
function vakt(kilde: string, re: RegExp, mutasjon: [string | RegExp, string]) {
  expect(kilde).toMatch(re);
  const mutert = kilde.replace(mutasjon[0], mutasjon[1]);
  expect(mutert).not.toBe(kilde);
  expect(mutert).not.toMatch(re);
}

/** Kroppen til `const <navn> = useCallback(` (parentes-matching). */
function callbackKropp(kilde: string, navn: string): string {
  const start = kilde.indexOf(`const ${navn} = useCallback(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const i = kilde.indexOf("(", start + `const ${navn} = useCallback`.length);
  let dybde = 0;
  for (let j = i; j < kilde.length; j++) {
    if (kilde[j] === "(") dybde++;
    else if (kilde[j] === ")" && --dybde === 0) return kilde.slice(i, j + 1);
  }
  throw new Error(`fant ikke slutten på ${navn}`);
}

function medUtlegg(stier: string[]): UtkastData {
  return {
    lonnUtlegg: {
      tillegg: [],
      utlegg: stier.map((s, n) => ({ id: `u${n}`, kvittering: { lokalSti: s } })),
    },
  } as unknown as UtkastData;
}

describe("V10 — avvik 10: kvitteringsfil slettes først etter skrevet utkast uten utlegget", () => {
  it("🔴 ren: bare stier det skrevne utkastet ikke eier er slettbare", () => {
    expect(slettbareEtterSkriving(["a", "b"], medUtlegg(["b", "c"]))).toEqual(["a"]);
    expect(slettbareEtterSkriving(new Set(["a"]), medUtlegg([]))).toEqual(["a"]);
    // Negativkontroll: utkastet eier fortsatt fila → ingenting slettes.
    expect(slettbareEtterSkriving(["a"], medUtlegg(["a"]))).toEqual([]);
  });

  it("🔴 skrivUtkastNaa: lagreUtkast → stopp ved «opptatt» → FØRST da sletting", () => {
    const kropp = callbackKropp(SKJERM, "skrivUtkastNaa");
    const re =
      /const res = lagreUtkast\([\s\S]*?\);\s*if \(res === "opptatt"\) return;\s*for \(const sti of slettbareEtterSkriving\(fjernetKvitteringer\.current, k\.data\)\) \{\s*fjernetKvitteringer\.current\.delete\(sti\);\s*void slettLokaltBilde\(sti\);/;
    // Mutant: slettingen flyttes foran skrivingen.
    vakt(kropp, re, [
      /(const res = lagreUtkast\([\s\S]*?\);\s*if \(res === "opptatt"\) return;\s*)(for \(const sti of slettbareEtterSkriving[\s\S]*?\n {4}\})/,
      "$2\n$1",
    ]);
  });

  it("🔴 fjerning i skjermen sletter IKKE fila — den legges bare i ventelista", () => {
    const kropp = callbackKropp(SKJERM, "fjernKvittering");
    expect(kropp).toMatch(/fjernetKvitteringer\.current\.add\(sti\)/);
    expect(kropp).not.toContain("slettLokaltBilde");
    // Negativkontroll: den gamle straks-slettingen hadde gått rød.
    expect(kropp.replace("fjernetKvitteringer.current.add(sti);", "void slettLokaltBilde(sti);")).toContain(
      "slettLokaltBilde",
    );
    expect(SKJERM).toMatch(/<BekreftDagLonnUtlegg[\s\S]*?onFjernKvittering=\{fjernKvittering\}/);
  });

  it("🔴 unmount: fjernede kvitteringer slettes bare når siste utkast ikke eier dem", () => {
    vakt(
      SKJERM,
      /for \(const sti of fjernetKvitteringer\.current\) \{\s*if \(!eide\.includes\(sti\)\) void slettLokaltBilde\(sti\);/,
      [
        /for \(const sti of fjernetKvitteringer\.current\) \{\s*if \(!eide\.includes\(sti\)\) void slettLokaltBilde\(sti\);/,
        "for (const sti of fjernetKvitteringer.current) { void slettLokaltBilde(sti);",
      ],
    );
  });

  it("🔴 BekreftDagLonnUtlegg: callback når gitt, ellers straks-sletting som før", () => {
    vakt(UTLEGG, /if \(onFjernKvittering\) onFjernKvittering\(sti\);\s*else void slettLokaltBilde\(sti\);/, [
      "else void slettLokaltBilde(sti);",
      "else void 0;",
    ]);
    expect(UTLEGG).toMatch(/onFjernKvittering\?: \(lokalSti: string\) => void;/);
  });
});

describe("V12 — avvik 12: GPS-utkast i lista går samme sti som «Slutt dag»", () => {
  const klient = {} as Parameters<typeof forberedSluttDag>[0]["klient"];

  it("🔴 forberedSluttDag fanger slutt-GPS og henter norm for start- og sluttdato før retur", async () => {
    const hentNorm = vi.fn(async (_k: unknown, _o: string, _dato: string) => true);
    const fangGps = vi.fn(async () => ({ lat: 69.6, lng: 18.9 }));
    const p = await forberedSluttDag(
      { arbeidsdag: { id: "dag1", startAt: "2026-07-01T22:00:00" }, orgId: "org1", klient },
      { fangGps, hentNorm, naa: () => new Date("2026-07-02T06:00:00") },
    );
    expect(fangGps).toHaveBeenCalledTimes(1);
    expect(hentNorm.mock.calls.map((c) => c[2]).sort()).toEqual([
      formatIsoDato(new Date("2026-07-01T22:00:00")),
      formatIsoDato(new Date("2026-07-02T06:00:00")),
    ]);
    expect(p).toEqual({
      arbeidsdagId: "dag1",
      sluttIso: new Date("2026-07-02T06:00:00").toISOString(),
      endLat: "69.6",
      endLng: "18.9",
      sisteSegmentKilde: "bruker",
    });
  });

  it("glemt dag (overstyrt slutt): ingen GPS, tom posisjon, kilde system", async () => {
    const fangGps = vi.fn(async () => ({ lat: 1, lng: 2 }));
    const p = await forberedSluttDag(
      {
        arbeidsdag: { id: "d", startAt: "2026-07-01T07:00:00" },
        orgId: "o",
        klient,
        overstyrtSluttIso: "2026-07-01T15:00:00.000Z",
        sisteSegmentKilde: "system",
      },
      { fangGps, hentNorm: async () => true, naa: () => new Date() },
    );
    expect(fangGps).not.toHaveBeenCalled();
    expect(p.endLat).toBe("");
    expect(p.sisteSegmentKilde).toBe("system");
  });

  it("🔴 lista kaller forberedSluttDag og navigerer med resultatet", () => {
    const kropp = callbackKropp(LISTE, "aapneUtkast");
    vakt(
      kropp,
      /forberedSluttDag\(\{ arbeidsdag: dag, orgId: [^}]*klient: utils\.client \}\)\s*\.then\(\(params\) => router\.push\(\{ pathname: "\/timer\/bekreft-dag", params \}\)\)/,
      // Mutant: lista hopper over funksjonen (som før rettingen).
      [
        /void forberedSluttDag\([\s\S]*?\}\);\n/,
        'router.push({ pathname: "/timer/bekreft-dag", params: { arbeidsdagId: dag.id, sluttIso: new Date().toISOString(), endLat: "", endLng: "", sisteSegmentKilde: "bruker" } });\n',
      ],
    );
    // Ingen tom posisjon hardkodet noe sted i lista.
    expect(LISTE).not.toMatch(/endLat: ""/);
  });

  it("🔴 «Slutt dag»-kortet bruker samme funksjon (ingen kopi av logikken)", () => {
    const kropp = callbackKropp(KORT, "utforSluttDag");
    expect(kropp).toMatch(/await forberedSluttDag\(\{/);
    expect(kropp).not.toMatch(/fangGps\(|hentOgCacheArbeidstidSvar\(/);
  });
});
