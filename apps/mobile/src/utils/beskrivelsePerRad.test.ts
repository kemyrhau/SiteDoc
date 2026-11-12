import { describe, it, expect, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => null }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "x" }));
vi.mock("../db/database", () => ({ erDatabaseTilgjengelig: () => false, hentDatabase: () => null }));
import { manglerBeskrivelse } from "./bekreftDag";
import { arbeidsraderPerKort, beskrivelseForRad, radBeskrivelseNokkel } from "./beskrivelseKort";
import type { Dagsforslag, DagsforslagDag } from "./dagsforslag";

/**
 * Radform (Kenneth 2026-11-12, beslutning 2 + 3): kortteksten forhåndsutfyller
 * hver arbeidsrad, hver rad kan overstyres, og sperren gjelder pr. rad.
 * Rene funksjoner — anvend skriver `beskrivelseForRad` rett på raden.
 */

const rad = (projectId: string, fraTid: string | null, tilTid: string | null, erReise = false) => ({
  projectId,
  fraTid,
  tilTid,
  erReise,
  timer: 2,
  byggeplassId: null,
});

function forslag(
  rader: ReturnType<typeof rad>[],
  perKort?: Record<string, string>,
  perRad?: Record<string, string>,
): { f: Dagsforslag; d: DagsforslagDag } {
  const d = { dato: "2026-11-12", blokkert: false, byggeplassId: null, rader } as unknown as DagsforslagDag;
  const f = {
    datoer: [d],
    ...(perKort ? { beskrivelsePerKort: perKort } : {}),
    ...(perRad ? { beskrivelsePerRad: perRad } : {}),
  } as unknown as Dagsforslag;
  return { f, d };
}

const TO_RADER = () => [rad("p1", "07:00", "11:00"), rad("p1", "11:30", "15:00"), rad("p1", "15:00", "16:00", true)];

describe("beskrivelse pr. rad (radform)", () => {
  it("kortteksten forhåndsutfyller hver arbeidsrad; reise får ingen", () => {
    const { f, d } = forslag(TO_RADER(), { p1: "Forskaling" });
    expect(d.rader.map((r) => (r.erReise ? null : beskrivelseForRad(f, r, d)))).toEqual([
      "Forskaling",
      "Forskaling",
      null,
    ]);
    expect(manglerBeskrivelse(f)).toEqual([]);
  });

  it("overstyring på én rad gjelder bare den raden", () => {
    const rader = TO_RADER();
    const n2 = radBeskrivelseNokkel({ dato: "2026-11-12", rader }, rader[1]!)!;
    const { f, d } = forslag(rader, { p1: "Forskaling" }, { [n2]: "Støp" });
    expect(beskrivelseForRad(f, d.rader[0]!, d)).toBe("Forskaling");
    expect(beskrivelseForRad(f, d.rader[1]!, d)).toBe("Støp");
  });

  it("tomt kort og ingen rad utfylt → kortets nøkkel (skriv én gang)", () => {
    const { f } = forslag(TO_RADER());
    expect(manglerBeskrivelse(f)).toEqual(["p1"]);
  });

  it("tomt kort, én rad utfylt → sperren peker på raden som mangler", () => {
    const rader = TO_RADER();
    const [n1, n2] = [rader[0]!, rader[1]!].map((r) => radBeskrivelseNokkel({ dato: "2026-11-12", rader }, r)!);
    const { f } = forslag(rader, undefined, { [n1 as string]: "Riving" });
    expect(manglerBeskrivelse(f)).toEqual([n2]);
    // Negativkontroll: fylles også rad 2, er dagen klar.
    const { f: f2 } = forslag(rader, undefined, { [n1 as string]: "Riving", [n2 as string]: "Rydding" });
    expect(manglerBeskrivelse(f2)).toEqual([]);
  });

  it("blank overstyring teller ikke, og kortteksten vinner da", () => {
    const rader = TO_RADER();
    const n1 = radBeskrivelseNokkel({ dato: "2026-11-12", rader }, rader[0]!)!;
    const { f, d } = forslag(rader, { p1: "Forskaling" }, { [n1]: "   " });
    expect(beskrivelseForRad(f, d.rader[0]!, d)).toBe("Forskaling");
  });

  it("like rader får hver sin nøkkel; endret fra-tid gir kortteksten tilbake, aldri en annen rads tekst", () => {
    const rader = [rad("p1", "07:00", "09:00"), rad("p1", "07:00", "09:00")];
    const [a, b] = rader.map((r) => radBeskrivelseNokkel({ dato: "2026-11-12", rader }, r));
    expect(a).not.toBe(b);
    const flyttet = [rad("p1", "08:00", "10:00"), rad("p1", "07:00", "09:00")];
    const { f, d } = forslag(flyttet, { p1: "Kort" }, { [b as string]: "Rad B" });
    // Rad B (nå den eneste 07:00-raden, n=0) arver ikke b's tekst (n=1).
    expect(d.rader.map((r) => beskrivelseForRad(f, r, d))).toEqual(["Kort", "Kort"]);
  });

  it("arbeidsraderPerKort grupperer arbeidsradene under kortnøkkelen", () => {
    const { f } = forslag([...TO_RADER(), rad("p2", "16:00", "17:00")]);
    const m = arbeidsraderPerKort(f);
    expect(m.get("p1")?.map((r) => r.fraTid)).toEqual(["07:00", "11:30"]);
    expect(m.get("p2")?.map((r) => r.fraTid)).toEqual(["16:00"]);
  });
});
