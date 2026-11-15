import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => null }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "x" }));
vi.mock("../db/database", () => ({ erDatabaseTilgjengelig: () => false, hentDatabase: () => null }));
import { manglerBeskrivelse } from "./bekreftDag";
import { arbeidsraderPerKort, beskrivelseForRad, kortMedArbeid } from "./beskrivelseKort";
import { maskinerOverRaden, radTilleggNokkel, type TilleggMaskin, type TilleggVare } from "./bekreftDagTillegg";
import { fordelTilleggPaaKort, kortArbeidstimer, settTilleggPaaKort, tilleggPaaKort } from "./tilleggPaaKort";
import type { Dagsforslag, DagsforslagDag } from "./dagsforslag";

/**
 * ORDRE 24 (Kenneth 2026-11-16): «hvert prosjektkort skal ha sin egen
 * beskrivelse» · «[maskin og varer pr. rad] → jeg trenger kun en av disse per
 * prosjektkort». Kort 07:00–16:00, pause 30, norm 7,5 → to arbeidsrader
 * (07:00–15:00 normal 7,5 t + 15:00–16:00 overtid 1 t), ETT kort.
 */

const DATO = "2026-11-16";
const rad = (projectId: string, fraTid: string, tilTid: string, timer: number, radIndeks: number, erReise = false) => ({
  projectId,
  fraTid,
  tilTid,
  timer,
  radIndeks,
  erReise,
  byggeplassId: null,
});

function forslag(
  rader: ReturnType<typeof rad>[],
  ekstra: Record<string, unknown> = {},
): { f: Dagsforslag; d: DagsforslagDag } {
  const d = { dato: DATO, blokkert: false, byggeplassId: "bp1", rader } as unknown as DagsforslagDag;
  const f = { datoer: [d], ...ekstra } as unknown as Dagsforslag;
  return { f, d };
}

/** 07–16, norm 7,5: normalrad + overtidsrad på samme kort. */
const KORT_07_16 = () => [rad("p1", "07:00", "15:00", 7.5, 0), rad("p1", "15:00", "16:00", 1, 1)];
const N0 = radTilleggNokkel(DATO, { erReise: false, radIndeks: 0 })!;
const N1 = radTilleggNokkel(DATO, { erReise: false, radIndeks: 1 })!;

const maskin = (timer: number, lokalId = "m1"): TilleggMaskin => ({
  lokalId,
  projectId: "p1",
  vehicleId: "v1",
  timer,
  mengde: null,
  enhet: null,
});
const vare: TilleggVare = {
  lokalId: "v1",
  projectId: "p1",
  vareId: "pukk",
  vareNavn: "Pukk",
  enhet: "tonn",
  antall: 3,
  byggeplassId: "bp1",
};

describe("ORDRE 24 — én beskrivelse pr. prosjektkort", () => {
  it("🔴 kort 07–16 m/ norm 7,5: ett kort, kortets tekst på begge radene (normal + overtid)", () => {
    const { f, d } = forslag(KORT_07_16(), { beskrivelsePerKort: { p1: "Forskaling" } });
    expect(kortMedArbeid(f).map((k) => k.nokkel)).toEqual(["p1"]);
    expect(arbeidsraderPerKort(f).get("p1")).toHaveLength(2);
    expect(d.rader.map((r) => beskrivelseForRad(f, r, d))).toEqual(["Forskaling", "Forskaling"]);
  });

  it("🔴 gammel radtekst (beskrivelsePerRad) ignoreres — kortets tekst vinner på alle rader", () => {
    const { f, d } = forslag(KORT_07_16(), {
      beskrivelsePerKort: { p1: "Forskaling" },
      beskrivelsePerRad: { [`rad:${DATO}|p1|15:00|0`]: "Støp" },
    });
    expect(d.rader.map((r) => beskrivelseForRad(f, r, d))).toEqual(["Forskaling", "Forskaling"]);
  });

  it("🔴 tomt felt sperrer med kortnøkkelen — også når et gammelt utkast har radtekst", () => {
    expect(manglerBeskrivelse(forslag(KORT_07_16()).f)).toEqual(["p1"]);
    const gammel = forslag(KORT_07_16(), {
      beskrivelsePerRad: { [`rad:${DATO}|p1|07:00|0`]: "A", [`rad:${DATO}|p1|15:00|0`]: "B" },
    }).f;
    expect(manglerBeskrivelse(gammel)).toEqual(["p1"]);
    // Negativkontroll: kortets felt utfylt → klar.
    expect(manglerBeskrivelse(forslag(KORT_07_16(), { beskrivelsePerKort: { p1: "x" } }).f)).toEqual([]);
  });

  it("🔴 skjermen har ett felt pr. kort — ingen radfelt (kildetekst-vakt)", () => {
    const kilde = fs.readFileSync(
      path.join(__dirname, "../components/timer-detalj/BekreftDagBeskrivelse.tsx"),
      "utf8",
    );
    expect(kilde.match(/<TextInput\b/g) ?? []).toHaveLength(1);
    expect(kilde).not.toMatch(/onEndreRad|radRef|onRadY|radTillegg|radPlassholder|radMangler/);
    const skjerm = fs.readFileSync(path.join(__dirname, "../../app/timer/bekreft-dag.tsx"), "utf8");
    expect(skjerm).not.toMatch(/beskrivelsePerRad|RAD_PREFIKS|settRadBeskrivelse/);
  });
});

describe("ORDRE 24 — ett sett maskin/varer pr. kort, fordelt ved lagring", () => {
  const { f } = forslag(KORT_07_16());
  const rader = arbeidsraderPerKort(f).get("p1")!;

  it("UI-vakten bruker kortets sum arbeidstimer (8,5 t)", () => {
    expect(kortArbeidstimer(rader)).toBe(8.5);
  });

  it("🔴 maskin 4 t → én radkobling på første arbeidsrad", () => {
    const ut = fordelTilleggPaaKort(f, { [N0]: { maskiner: [maskin(4)], varer: [] } });
    expect(ut[N0]?.maskiner.map((m) => m.timer)).toEqual([4]);
    expect(ut[N1]).toBeUndefined();
  });

  it("🔴 maskin 8 t → 7,5 på normalraden + 0,5 på overtidsraden; ingen rad over sin grense", () => {
    const ut = fordelTilleggPaaKort(f, { [N0]: { maskiner: [maskin(8)], varer: [] } });
    expect(ut[N0]?.maskiner.map((m) => m.timer)).toEqual([7.5]);
    expect(ut[N1]?.maskiner.map((m) => m.timer)).toEqual([0.5]);
    expect(ut[N1]?.maskiner[0]?.lokalId).toBe("m1#2");
    expect(maskinerOverRaden(f, ut)).toEqual([]);
    // Negativkontroll: ufordelt bryter regelen maskin ≤ radens timer.
    expect(maskinerOverRaden(f, { [N0]: { maskiner: [maskin(8)], varer: [] } })).toHaveLength(1);
  });

  it("🔴 vare → første arbeidsrad", () => {
    const ut = fordelTilleggPaaKort(f, { [N1]: { maskiner: [], varer: [vare] } });
    expect(ut[N0]?.varer).toEqual([vare]);
    expect(ut[N1]).toBeUndefined();
  });

  it("gammelt utkast med linjer på flere rader: vises samlet, lagres på kortet", () => {
    const perRad = {
      [N0]: { maskiner: [maskin(2, "a")], varer: [] },
      [N1]: { maskiner: [maskin(1, "b")], varer: [vare] },
    };
    expect(tilleggPaaKort(perRad, rader).maskiner.map((m) => m.lokalId)).toEqual(["a", "b"]);
    const satt = settTilleggPaaKort(perRad, rader, tilleggPaaKort(perRad, rader));
    expect(Object.keys(satt)).toEqual([N0]);
  });

  it("nøkler utenfor kortet røres ikke (tilleggUtenRad fanger dem fortsatt)", () => {
    const fremmed = radTilleggNokkel(DATO, { erReise: false, radIndeks: 9 })!;
    const ut = fordelTilleggPaaKort(f, { [fremmed]: { maskiner: [maskin(1)], varer: [] } });
    expect(ut[fremmed]?.maskiner).toHaveLength(1);
  });
});
