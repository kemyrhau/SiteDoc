import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { forsteRadUtenBeskrivelse, grupperPaaKort, grupperPaaUnderprosjekt, raderForDag } from "./dagsoversiktRader";

const rad = (id: string, projectId: string, fraTid: string | null, timer = 2) => ({ id, projectId, fraTid, timer });

describe("raderForDag (radform 2026-11-12)", () => {
  it("rader i tidsrekkefølge, rader uten fra-tid sist i innkommende orden", () => {
    const d = raderForDag({
      timer: [rad("c", "p1", "12:00"), rad("x", "p1", null), rad("a", "p2", "07:00"), rad("y", "p1", null), rad("b", "p1", "09:30")],
      maskin: [],
      varer: [],
    });
    expect(d.rader.map((b) => b.rad.id)).toEqual(["a", "b", "c", "x", "y"]);
  });

  it("slår aldri sammen rader — to like rader på samme prosjekt gir to bokser", () => {
    const d = raderForDag({
      timer: [rad("r1", "p1", "07:00", 4), rad("r2", "p1", "07:00", 4)],
      maskin: [],
      varer: [],
    });
    expect(d.rader).toHaveLength(2);
    expect(d.rader.map((b) => b.rad.timer)).toEqual([4, 4]);
  });

  it("maskin og vare med kobling havner under sin rad", () => {
    const d = raderForDag({
      timer: [rad("r1", "p1", "07:00"), rad("r2", "p2", "11:00")],
      maskin: [{ id: "m1", projectId: "p2", sheetTimerId: "r2" }],
      varer: [{ id: "v1", projectId: "p1", sheetTimerId: "r1" }],
    });
    expect(d.rader[0]!.varer.map((v) => v.id)).toEqual(["v1"]);
    expect(d.rader[1]!.maskin.map((m) => m.id)).toEqual(["m1"]);
    expect(d.utenRad).toEqual({ maskin: [], varer: [] });
  });

  it("gammel vare uten kobling havner under «Uten rad» — aldri skjult", () => {
    const d = raderForDag({
      timer: [rad("r1", "p1", "07:00")],
      maskin: [{ id: "m1", projectId: "p1", sheetTimerId: null }],
      varer: [{ id: "v1", projectId: "p1" }],
    });
    expect(d.rader[0]!.varer).toEqual([]);
    expect(d.rader[0]!.maskin).toEqual([]);
    expect(d.utenRad.varer.map((v) => v.id)).toEqual(["v1"]);
    expect(d.utenRad.maskin.map((m) => m.id)).toEqual(["m1"]);
  });

  it("kobling til rad på annet prosjekt eller ukjent rad → «Uten rad» (ingen skjønnsplassering)", () => {
    const d = raderForDag({
      timer: [rad("r1", "p1", "07:00")],
      maskin: [],
      varer: [
        { id: "v1", projectId: "p2", sheetTimerId: "r1" },
        { id: "v2", projectId: "p1", sheetTimerId: "slettet" },
      ],
    });
    expect(d.rader[0]!.varer).toEqual([]);
    expect(d.utenRad.varer.map((v) => v.id)).toEqual(["v1", "v2"]);
  });
});

describe("forsteRadUtenBeskrivelse", () => {
  const r = (id: string, beskrivelse: string | null, erReise = false) => ({ id, beskrivelse, erReise });
  it("finner første arbeidsrad uten beskrivelse; blanke teller som mangler", () => {
    expect(forsteRadUtenBeskrivelse([r("a", "Støp"), r("b", "  "), r("c", null)])?.id).toBe("b");
  });
  it("reise krever ikke beskrivelse; alle utfylt → null", () => {
    expect(forsteRadUtenBeskrivelse([r("a", null, true), r("b", "Forskaling")])).toBeNull();
  });
});

describe("TILLEGG 2026-11-12 regel 4–5 — gruppering pr. underprosjekt", () => {
  const rad = (id: string, projectId: string, eco: string | null, fraTid: string) => ({
    id,
    projectId,
    externalCostObjectId: eco,
    fraTid,
    timer: 2,
  });
  const linje = (id: string, projectId: string, eco: string | null, sheetTimerId: string | null) => ({
    id,
    projectId,
    externalCostObjectId: eco,
    sheetTimerId,
  });

  it("linje på rad med ECO A havner under A — også når linjen selv bærer ECO B", () => {
    const dag = raderForDag({
      timer: [rad("r-a", "p1", "A", "07:00"), rad("r-b", "p1", "B", "09:00")],
      maskin: [linje("m1", "p1", "B", "r-a")],
      varer: [linje("v1", "p1", null, "r-a")],
    });
    const g = grupperPaaUnderprosjekt(dag);
    expect(g.map((x) => x.ecoId)).toEqual(["A", "B"]);
    expect(g[0].rader[0].maskin.map((m) => m.id)).toEqual(["m1"]);
    expect(g[0].rader[0].varer.map((v) => v.id)).toEqual(["v1"]);
    expect(g[1].rader[0].maskin).toEqual([]);
  });

  it("negativkontroll: ukoblet linje med ECO B havner under B som «Uten rad», ikke under A", () => {
    const dag = raderForDag({
      timer: [rad("r-a", "p1", "A", "07:00")],
      maskin: [linje("m1", "p1", "B", null)],
      varer: [],
    });
    const g = grupperPaaUnderprosjekt(dag);
    expect(g.map((x) => x.ecoId)).toEqual(["A", "B"]);
    expect(g[0].utenRad.maskin).toEqual([]);
    expect(g[1].rader).toEqual([]);
    expect(g[1].utenRad.maskin.map((m) => m.id)).toEqual(["m1"]);
  });

  it("hele rader, ingen sammenslåing: to like rader under A blir to bokser i tidsrekkefølge", () => {
    const dag = raderForDag({
      timer: [rad("r2", "p1", "A", "12:00"), rad("r1", "p1", "A", "07:00"), rad("rb", "p1", "B", "09:00")],
      maskin: [],
      varer: [],
    });
    const g = grupperPaaUnderprosjekt(dag);
    expect(g[0].rader.map((b) => b.rad.id)).toEqual(["r1", "r2"]);
    expect(g[1].rader.map((b) => b.rad.id)).toEqual(["rb"]);
  });
});

// ORDRE 2026-11-16 (27b), spec § 8 rad a del 2: dagskortet = prosjektkort med
// linjer. Kortnøkkelen kommer fra kalleren (`kortNokkel` i dag, kort-id i b/c).
describe("(27b) grupperPaaKort — ett prosjektkort, radene som linjer", () => {
  const nokler = (m: Record<string, string>) => (id: string) => m[id];
  const ingen = () => undefined;

  it("🔴 normal + overtid på samme kort → ett kort, to linjer i tidsrekkefølge", () => {
    const d = raderForDag({
      timer: [rad("ot", "p1", "15:00", 2), rad("normal", "p1", "07:00", 7.5)],
      maskin: [],
      varer: [],
    });
    const k = grupperPaaKort(d, { timer: nokler({ ot: "p1|ingen|ingen", normal: "p1|ingen|ingen" }), maskin: ingen, vare: ingen });
    expect(k).toHaveLength(1);
    expect(k[0]!.rader.map((b) => b.rad.id)).toEqual(["normal", "ot"]);
  });

  it("negativkontroll: dagens gruppering (pr. rad-boks) gir to bokser for samme kort", () => {
    const d = raderForDag({ timer: [rad("normal", "p1", "07:00", 7.5), rad("ot", "p1", "15:00", 2)], maskin: [], varer: [] });
    // Én boks pr. rad — det Kenneth så som «overtid ser ut som et eget kort».
    expect(d.rader).toHaveLength(2);
  });

  it("🔴 to prosjektkort → to kort, i rekkefølgen til første linje", () => {
    const d = raderForDag({
      timer: [rad("b", "p2", "17:00", 1), rad("a", "p1", "07:00", 7.5), rad("c", "p1", "18:00", 1)],
      maskin: [],
      varer: [],
    });
    const k = grupperPaaKort(d, { timer: nokler({ a: "K1", c: "K1", b: "K2" }), maskin: ingen, vare: ingen });
    expect(k.map((x) => [x.nokkel, x.rader.map((b) => b.rad.id)])).toEqual([["K1", ["a", "c"]], ["K2", ["b"]]]);
  });

  it("🔴 en varelinje står ett sted: koblet → under raden i kortet, ukoblet → «Uten rad» i kortet sitt", () => {
    const d = raderForDag({
      timer: [rad("r1", "p1", "07:00")],
      maskin: [],
      varer: [
        { id: "v1", projectId: "p1", sheetTimerId: "r1" },
        { id: "v2", projectId: "p1", sheetTimerId: null },
      ],
    });
    const k = grupperPaaKort(d, { timer: nokler({ r1: "K1" }), maskin: ingen, vare: nokler({ v1: "K1", v2: "K1" }) });
    expect(k).toHaveLength(1);
    expect(k[0]!.rader[0]!.varer.map((v) => v.id)).toEqual(["v1"]);
    expect(k[0]!.utenRad.varer.map((v) => v.id)).toEqual(["v2"]);
    const alle = [...k[0]!.rader.flatMap((b) => b.varer), ...k[0]!.utenRad.varer].map((v) => v.id);
    expect(alle).toEqual([...new Set(alle)]);
  });

  it("kort med bare «Uten rad» kommer etter kort med linjer", () => {
    const d = raderForDag({
      timer: [rad("r1", "p1", "07:00")],
      maskin: [{ id: "m1", projectId: "p2", sheetTimerId: null }],
      varer: [],
    });
    const k = grupperPaaKort(d, { timer: nokler({ r1: "K1" }), maskin: nokler({ m1: "K2" }), vare: ingen });
    expect(k.map((x) => [x.nokkel, x.rader.length, x.utenRad.maskin.length])).toEqual([["K1", 1, 0], ["K2", 0, 1]]);
  });
});

describe("(27b) kildevakter — dagskortet og V5a", () => {
  const her = dirname(fileURLToPath(import.meta.url));
  const les = (rel: string) => readFileSync(join(her, rel), "utf-8");
  const OVERSIKT = les("../components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt.tsx");
  const SKJERM = les("../../app/timer/bekreft-dag.tsx");

  it("🔴 kortet bruker den delte nøkkelen og grupperPaaKort; ingen egen kopi", () => {
    expect(OVERSIKT).toContain("grupperPaaKort(dag, {");
    expect(OVERSIKT).toMatch(/return v \? kortNokkel\(v\) : undefined;/);
    expect(OVERSIKT).not.toContain("grupperPaaUnderprosjekt(");
  });

  it("🔴 linja åpner rad-vinduet for raden og viser tid · timer · lønnsart", () => {
    const start = OVERSIKT.indexOf("function kortLinje(");
    const blokk = OVERSIKT.slice(start, OVERSIKT.indexOf("\n  }\n", start));
    expect(blokk).toContain("onPress={() => aapneTimer(valg, rad.id)}");
    expect(blokk).toContain("[tidTekst(rad), t2(rad.timer), lonnsart].filter(Boolean).join(\" · \")");
  });

  it("🔴 aldri to datoer: dagskortets rader leses for én sedel (unik pr. bruker og dato)", () => {
    const sedel = les("../components/timer-detalj/prosjektkort/useProsjektkortSedel.ts");
    expect(sedel).toContain("db.select().from(sheetTimerLocal).where(eq(sheetTimerLocal.dagsseddelId, sheetId)).all()");
  });

  it("🔴 V5a: nivå-knappene går via vekslOvertidNivaa; «Overtid fra» skjules når overtiden er av", () => {
    const flat = SKJERM.replace(/\s+/g, " ");
    // ORDRE (28) V5: nivå-trykket erstatter også et linjevalg på overtidslinja.
    expect(flat).toContain("onRett({ ...vekslOvertidNivaa({ trykketId: l.id, valgtId: forsteOt?.lonnsartId ?? null,");
    expect(flat).toContain('lonnsartPerLinje: utenLinje(lonnsartPerLinje, "overtid"),');
    expect(flat).toContain("{!overtidAv && !dag.fravaerTil ? ( <View className=\"flex-row items-center justify-between\">");
    expect(flat).toContain("overtidAv={retting.perDato?.[d.dato]?.overtidAv === true}");
    expect(flat).not.toContain("onPress={() => onRett({ overtidLonnsartId: l.id })}");
  });
});

// RETUR (27b), Kenneth 2026-11-16: «varens og maskinens måte å bli registrert i
// kortet fungerte godt» — som før dd1d2926 (`radBoks` på 05c5488e).
describe("(27b RETUR) kildevakter — maskin/varer pr. linje, navn-trykk", () => {
  const her = dirname(fileURLToPath(import.meta.url));
  const OVERSIKT = readFileSync(join(her, "../components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt.tsx"), "utf-8");
  const blokk = (navn: string) => {
    const start = OVERSIKT.indexOf(`function ${navn}(`);
    expect(start).toBeGreaterThan(-1);
    return OVERSIKT.slice(start, OVERSIKT.indexOf("\n  }\n", start)).replace(/\s+/g, " ");
  };

  it("🔴 «+ Vare» står ved hver linje og ny vare får linjas id", () => {
    const linje = blokk("kortLinje");
    expect(linje).toContain("{ rad, maskin, varer: radVarer }");
    expect(linje).toContain("setVareRadId(rad.id); setVareKort(valg);");
    expect(linje).toContain('t("timer.dagsoversikt.leggTilVare")');
  });

  it("🔴 linjas maskin og varer vises under linja", () => {
    const linje = blokk("kortLinje");
    expect(linje).toContain("{maskin.map((m) => maskinLinje(");
    expect(linje).toContain("{radVarer.map(vareLinje)}");
  });

  it("🔴 kortet har ingen «+ Vare» koblet til første linje, og samler ikke linjenes maskin/varer", () => {
    const kort = blokk("prosjektkort");
    expect(kort).not.toContain("setVareRadId(forsteRad.id)");
    expect(kort).not.toContain("rader.flatMap((b) => b.maskin)");
    expect(kort).not.toContain("rader.flatMap((b) => b.varer)");
    // Kort uten arbeidsrad beholder «+ Maskin»/«+ Vare» (vare uten rad).
    expect(kort).toContain('t("timer.prosjektkort.leggTilMaskin")');
    expect(kort).toContain("setVareRadId(null);");
  });

  it("🔴 eneste prosjekt: navnet åpner raden (kortets første linje); ellers kortet", () => {
    expect(blokk("prosjektkort")).toContain(
      "enkeltProsjekt ? forsteRad && aapneTimer(valg, forsteRad.id) : onAapneKort?.(valg)",
    );
  });
});
