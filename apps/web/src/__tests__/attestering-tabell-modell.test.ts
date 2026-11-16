import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  byggAttesteringModell,
  filtrerModell,
  filterAlternativer,
  byggUtvalg,
  sumLinjer,
  AVVIK_FILTER,
  type AttDeps,
  type AttSedel,
  type AttTimer,
  type AttMaskin,
} from "@/components/attestering/attestering-tabell";

/**
 * Modellen bak attesteringens Sedler-fane (spec prosjektkort-kortid d2b-1, § 12.8.5).
 * Rød før commit 4: modulen fantes ikke.
 */

const deps: AttDeps = {
  lonnsartNavn: (id) => ({ l1: "Ordinær", l2: "Overtid 50 %" })[id] ?? "?",
  aktivitetNavn: () => "Graving",
  maskinNavn: (id) => ({ v1: "Gravemaskin", v2: "Dumper" })[id] ?? "?",
  tilleggNavn: () => "Smusstillegg",
  avdelingNavn: (id) => (id === "avd1" ? "Anlegg" : null),
  normtakLinje: (s) => (s.id === "sperret" ? "Fravær over dagsnorm" : null),
  ukeAvvikTekst: () => "Uke 47: 2,50 t over ukenorm 37,50 t",
  tekst: {
    forslagSperre: "Uavklart forslag",
    maskinUtenTimerad: "Maskin uten timerad",
    maskinforerbevis: "Mangler maskinførerbevis",
    tilleggskrav: "Tilleggskrav",
    tilByggherre: "Til byggherre",
    fravaerUtenProsjekt: "Fravær",
    reise: "Reise",
    statusVenter: "Venter",
    statusAttestert: "Attestert",
    statusReturnert: "Returnert",
  },
};

const prosjekt = (id: string, navn: string, intern: string | null) => ({ id, name: navn, internalProjectNumber: intern, projectNumber: `SD-${id}` });

function timer(id: string, kortId: string, p: ReturnType<typeof prosjekt>, over: Partial<AttTimer> = {}): AttTimer {
  return {
    id, kortId, lonnsartId: "l1", aktivitetId: "a1", externalCostObjectId: null, projectId: p.id, byggeplassId: null,
    fraTid: "07:00", tilTid: "15:00", beskrivelse: null, timer: "7.5", pauseMin: 30, attestertStatus: "pending",
    project: p, byggeplassNavn: "Tomta", underprosjekt: null, rettedeFelter: [], ...over,
  };
}
function maskin(id: string, kortId: string, sheetTimerId: string | null, vehicleId: string, over: Partial<AttMaskin> = {}): AttMaskin {
  return {
    id, kortId, vehicleId, sheetTimerId, projectId: "pA", externalCostObjectId: null, byggeplassId: null,
    fraTid: "07:00", tilTid: "11:00", timer: "4", mengde: null, enhet: null, attestertStatus: "pending",
    manglerTimerad: false, ...over,
  };
}

const A = prosjekt("pA", "Prosjekt A", "1001");
const B = prosjekt("pB", "Prosjekt B", null);

function sedel(over: Partial<AttSedel> = {}): AttSedel {
  return {
    id: "s1", dato: "2026-11-16", totaltimer: 15, dagsnorm: 7.5, pauseMin: 30, tilleggHarKrav: false,
    redigerTillatt: true, manglerMaskinforerbevis: false, normStatus: "server", konfliktVentendeSiden: null,
    ansatt: { id: "u1", name: "Kari Nordmann", email: "k@x", ansattnummer: "12", avdelingId: "avd1" },
    timer: [
      timer("t1", "kA", A),
      timer("t2", "kB", B, { lonnsartId: "l2" }),
    ],
    maskiner: [maskin("m1", "kA", "t1", "v1"), maskin("m2", "kA", "t1", "v2", { timer: "3" })],
    tillegg: [],
    utlegg: [],
    varer: [{ id: "va1", navn: "Pukk 8-16", enhet: "tonn", antall: 20, projectId: "pA", sheetTimerId: "t1", kortId: "kA", attestert: false }],
    ukeAvvikRadIder: ["t2"],
    fravaerKanAttesteres: false,
    ...over,
  };
}

describe("T23/T27 — kort pr. prosjekt, og timeraden er én linje med maskin og vare", () => {
  const [dag] = byggAttesteringModell([sedel()], deps);

  it("to prosjekter på samme sedel gir to kort", () => {
    expect(dag!.kort.map((k) => k.prosjekt)).toEqual(["Prosjekt A", "Prosjekt B"]);
  });

  it("timeraden med to maskiner og én vare er én linje (H10, T55) — ingen egne maskin-/varelinjer", () => {
    const kA = dag!.kort[0]!;
    expect(kA.linjer).toHaveLength(1);
    const l = kA.linjer[0]!.linje;
    expect(l.type).toBe("timer");
    expect(l.maskiner.map((m) => m.navn)).toEqual(["Gravemaskin", "Dumper"]);
    expect(l.varer.map((v) => v.navn)).toEqual(["Pukk 8-16"]);
  });

  it("hver linje har prosjektnummer, prosjekt, byggeplass, ansatt og dato; kortId står ikke i teksten", () => {
    const l = dag!.kort[1]!.linjer[0]!.linje;
    expect(l).toMatchObject({ prosjekt: "Prosjekt B", byggeplass: "Tomta", ansatt: "Kari Nordmann", dato: "2026-11-16", avdeling: "Anlegg" });
    // T63: uten internnummer vises SD-nummeret.
    expect(l.prosjektnummer).toBe("SD-pB");
    expect(dag!.kort[0]!.linjer[0]!.linje.prosjektnummer).toBe("1001");
    expect(JSON.stringify(dag!.kort.map((k) => k.linjer.map((x) => x.linje)))).not.toContain("kA");
  });

  it("kortets summer: timer og maskintimer", () => {
    expect(sumLinjer(dag!.kort[0]!.linjer)).toEqual({ timer: 7.5, maskintimer: 7 });
  });
});

describe("T30 — ✓ på linja sender timeraden og maskinene på den, ingen andre", () => {
  it("linja i kort A sender t1 + m1 + m2", () => {
    const [dag] = byggAttesteringModell([sedel()], deps);
    expect(dag!.kort[0]!.linjer[0]!.radIder).toEqual({ timerIder: ["t1"], maskinIder: ["m1", "m2"], tilleggIder: [] });
    expect(dag!.kort[1]!.linjer[0]!.radIder).toEqual({ timerIder: ["t2"], maskinIder: [], tilleggIder: [] });
  });

  it("i prosjektkontekst kan et kort på et annet prosjekt ikke velges", () => {
    const [dag] = byggAttesteringModell([sedel()], deps);
    const alle = dag!.kort.flatMap((k) => k.linjer);
    const u = byggUtvalg(alle, () => dag!.sedel, "pA");
    expect(u.radIder.timerIder).toEqual(["t1"]);
  });
});

describe("T29/T39/T69 — avvik i synlig tekst på riktig linje", () => {
  it("ukeavviket står bare på den merkede raden, med ukenummer og normens navn", () => {
    const [dag] = byggAttesteringModell([sedel()], deps);
    expect(dag!.kort[1]!.linjer[0]!.linje.avvik).toContain("Uke 47: 2,50 t over ukenorm 37,50 t");
    expect(dag!.kort[0]!.linjer[0]!.linje.avvik).not.toContain("Uke 47: 2,50 t over ukenorm 37,50 t");
  });

  it("time-maskin uten kobling: «Maskin uten timerad» på egen maskinlinje; døgnmaskin uten: ingenting", () => {
    const s = sedel({
      maskiner: [
        maskin("m3", "kA", null, "v1", { manglerTimerad: true, utleieEnhet: "time" }),
        maskin("m4", "kA", null, "v2", { manglerTimerad: false, utleieEnhet: "doegn" }),
      ],
    });
    const [dag] = byggAttesteringModell([s], deps);
    const linjer = dag!.kort[0]!.linjer;
    const m3 = linjer.find((l) => l.linje.id === "m3")!;
    const m4 = linjer.find((l) => l.linje.id === "m4")!;
    expect(m3.linje.type).toBe("maskin");
    expect(m3.linje.avvik).toContain("Maskin uten timerad");
    expect(m4.linje.avvik).not.toContain("Maskin uten timerad");
    // ✓ og retur virker på begge.
    expect(m3.harHandling && m4.harHandling).toBe(true);
  });
});

describe("R11/T43 — sperrer og utvalget", () => {
  it("B10-brudd: grunnen står i Avvik, og utvalget hopper over datoen og teller dem", () => {
    const modell = byggAttesteringModell([sedel({ id: "sperret" }), sedel({ id: "s2", dato: "2026-11-17" })], deps);
    const sperretLinje = modell[0]!.kort[0]!.linjer[0]!;
    expect(sperretLinje.sperre).toBe("Fravær over dagsnorm");
    expect(sperretLinje.linje.avvik).toContain("Fravær over dagsnorm");
    const alle = modell.flatMap((d) => d.kort.flatMap((k) => k.linjer));
    const u = byggUtvalg(alle, (id) => modell.find((d) => d.sedel.id === id)?.sedel);
    expect(u.stoende).toBe(2);
    expect(u.antallLinjer).toBe(2);
    expect(u.radIder.timerIder).toEqual(["t1", "t2"]);
  });

  it("uavklart forslag (V19) sperrer på samme måte", () => {
    const [dag] = byggAttesteringModell([sedel({ konfliktVentendeSiden: "2026-11-16T08:00:00Z" })], deps);
    expect(dag!.sperre).toBe("Uavklart forslag");
  });

  it("attesterte linjer er ikke i utvalget", () => {
    const s = sedel({ timer: [timer("t1", "kA", A, { attestertStatus: "attestert" }), timer("t2", "kB", B)], maskiner: [] });
    const [dag] = byggAttesteringModell([s], deps);
    const u = byggUtvalg(dag!.kort.flatMap((k) => k.linjer), () => dag!.sedel);
    expect(u.radIder.timerIder).toEqual(["t2"]);
  });
});

describe("R8/T41/T42 — filter i kolonnehodet", () => {
  const modell = byggAttesteringModell([sedel()], deps);

  it("filteret tilbyr verdiene som finnes i utvalget", () => {
    expect(filterAlternativer(modell, "betegnelse")).toEqual(["Ordinær", "Overtid 50 %"]);
    expect(filterAlternativer(modell, "maskin")).toEqual(["Dumper", "Gravemaskin"]);
  });

  it("filter på en lønnsart: bare de linjene, kort uten treff faller bort", () => {
    const f = filtrerModell(modell, { verdier: { betegnelse: "Overtid 50 %" }, beskrivelseSok: "" });
    expect(f[0]!.kort.map((k) => k.prosjekt)).toEqual(["Prosjekt B"]);
  });

  it("prosjektfilteret treffer radens prosjekt (HM8)", () => {
    const f = filtrerModell(modell, { verdier: { prosjekt: "Prosjekt B" }, beskrivelseSok: "" });
    expect(f[0]!.kort.flatMap((k) => k.linjer.map((l) => l.linje.id))).toEqual(["t2"]);
  });

  it("en linje treffer når én underlinje treffer", () => {
    const f = filtrerModell(modell, { verdier: { maskin: "Dumper" }, beskrivelseSok: "" });
    expect(f[0]!.kort.flatMap((k) => k.linjer.map((l) => l.linje.id))).toEqual(["t1"]);
  });

  it("«krever vurdering» er et filter og gir samme sedler som sedelKreverVurdering", () => {
    const ok = sedel({ id: "ok", totaltimer: 7.5, timer: [timer("t9", "kA", A)], maskiner: [], varer: [] });
    const m = byggAttesteringModell([sedel(), ok], deps);
    const f = filtrerModell(m, { verdier: { avvik: AVVIK_FILTER.kreverVurdering }, beskrivelseSok: "" });
    expect(f.map((d) => d.sedel.id)).toEqual(["s1"]);
  });
});

describe("T35 — vakt: ingen egen bøtting på underprosjekt eller radtype", () => {
  it("modellen grupperer via grupperPaaKort", () => {
    const kilde = readFileSync(resolve(__dirname, "../components/attestering/attestering-tabell.ts"), "utf8");
    expect(kilde).toMatch(/grupperPaaKort</);
    expect(kilde).not.toMatch(/externalCostObjectId \?\? "|new Map<string, AttLinje/);
  });
});
