import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  byggAttesteringModell,
  filtrerModell,
  filterAlternativer,
  byggUtvalg,
  byggJobbUtvalg,
  sumLinjer,
  grupperModell,
  byggUkeoversikt,
  AVVIK_FILTER,
  dagensTimer,
  lonnsartMerker,
  linjeVarsel,
  type LonnsartOppslag,
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
  maskinOverArbeidForklaring: (m: number, a: number) => `Maskin ${String(m).replace(".", ",")} t, arbeid ${String(a).replace(".", ",")} t`,
  tekst: {
    forslagSperre: "Uavklart forslag",
    maskinUtenTimerad: "Maskin uten timerad",
    maskinforerbevis: "Mangler maskinførerbevis",
    merkeUtenTimerad: "Uten timerad",
    merkeUtenTimeradForklaring: "Maskinen er ikke koblet til en timerad.",
    merkeUtenForerbevis: "Uten førerbevis", merkeMaskinOverArbeid: "Maskin over arbeid",
    tilleggskrav: "Tilleggskrav",
    tilByggherre: "Til byggherre",
    fravaerUtenProsjekt: "Fravær",
    annetProsjekt: "Annet prosjekt",
    reise: "Reise",
    utenUnderprosjekt: "Uten",
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
    expect(sumLinjer(dag!.kort[0]!.linjer)).toEqual({ timer: 7.5, maskintimer: 7, reise: 0 });
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
    const u = byggUtvalg(alle, () => dag!.sedel, new Set(["pA"]));
    expect(u.radIder.timerIder).toEqual(["t1"]);
  });

  it("w10b: prosjektlederen velger linjene på alle sine prosjekter, ingen andre", () => {
    const [dag] = byggAttesteringModell([sedel()], deps);
    const alle = dag!.kort.flatMap((k) => k.linjer);
    expect(byggUtvalg(alle, () => dag!.sedel, new Set(["pA", "pB"])).radIder.timerIder).toEqual(["t1", "t2"]);
    expect(byggUtvalg(alle, () => dag!.sedel, new Set(["pC"])).radIder.timerIder).toEqual([]);
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

describe("w10a (B30 A) — «Attester utvalget» tar hele jobber", () => {
  // Jobb kA: ordinær 07–15 + overtid 15–17; jobb kB: én linje.
  const s = sedel({
    timer: [
      timer("t1", "kA", A),
      timer("t2", "kA", A, { lonnsartId: "l2", fraTid: "15:00", tilTid: "17:00", timer: "2", pauseMin: 0 }),
      timer("t3", "kB", B),
    ],
    maskiner: [],
    varer: [],
  });
  const modell = byggAttesteringModell([s], deps);
  const sedelFor = () => modell[0]!.sedel;
  const kortA = modell[0]!.kort.find((k) => k.projectId === "pA")!.nokkel;
  const kortB = modell[0]!.kort.find((k) => k.projectId === "pB")!.nokkel;

  it("filteret skjuler overtiden, men jobben sendes hel", () => {
    const filtrert = filtrerModell(modell, { verdier: { betegnelse: "Ordinær" }, beskrivelseSok: "" });
    const synlige = filtrert.flatMap((d) => d.kort.map((k) => k.nokkel));
    expect(filtrert[0]!.kort.find((k) => k.nokkel === kortA)!.linjer.map((l) => l.linje.id)).toEqual(["t1"]);
    const u = byggJobbUtvalg(modell, synlige, new Set([kortA]), sedelFor);
    expect(u.radIder.timerIder).toEqual(["t1", "t2"]);
    expect(u.antallJobber).toBe(1);
  });

  it("negativkontroll: med linje-utvalget (byggUtvalg på de synlige linjene) ble overtiden stående", () => {
    const filtrert = filtrerModell(modell, { verdier: { betegnelse: "Ordinær" }, beskrivelseSok: "" });
    const synligeLinjer = filtrert.flatMap((d) => d.kort.filter((k) => k.nokkel === kortA).flatMap((k) => k.linjer));
    expect(byggUtvalg(synligeLinjer, sedelFor).radIder.timerIder).toEqual(["t1"]);
  });

  it("ingen krysset av: alle synlige jobber; knappen teller jobber, ikke linjer", () => {
    const u = byggJobbUtvalg(modell, [kortA, kortB], new Set(), sedelFor);
    expect(u.antallJobber).toBe(2);
    expect(u.radIder.timerIder).toEqual(["t1", "t2", "t3"]);
  });

  it("kryss på en jobb som ikke lenger vises (filteret), teller ikke", () => {
    const u = byggJobbUtvalg(modell, [kortB], new Set([kortA]), sedelFor);
    expect(u.radIder.timerIder).toEqual(["t3"]);
  });

  it("reiseblokken er en egen blå rad med reise-flagg; jobbene har det ikke", () => {
    const m = byggAttesteringModell([sedel({ timer: [timer("r1", "kA", A, { erReise: true, kortId: null }), timer("t1", "kA", A)], maskiner: [], varer: [] })], deps);
    expect(m[0]!.kort.map((k) => [k.nokkel.split(":")[1], k.reise])).toEqual([["reise", true], ["kA", false]]);
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

/* ------------------------------------------------------------------ */
/*  Ordre d2b-2 (R12, R13, T28, T35, T45)                              */
/* ------------------------------------------------------------------ */

const enkel = (over: Partial<AttSedel> = {}) => sedel({ maskiner: [], varer: [], ukeAvvikRadIder: [], ...over });

describe("T28 — «Etter prosjekt» grupperer på radens prosjekt", () => {
  const m = byggAttesteringModell([enkel()], deps);

  it("én gruppe pr. prosjekt, bare prosjektets rader, og gruppesummen er summen av radene", () => {
    const g = grupperModell(m, "prosjekt")!;
    expect(g.map((x) => x.tittel)).toEqual(["1001 Prosjekt A", "SD-pB Prosjekt B"]);
    const linjerA = g[0]!.dager.flatMap((d) => d.kort.flatMap((k) => k.linjer));
    expect(linjerA.map((l) => l.projectId)).toEqual(["pA"]);
    expect(sumLinjer(linjerA).timer).toBe(7.5);
  });

  it("et kort med rader på to prosjekter deles, så hver gruppe har bare sitt prosjekts rader", () => {
    const delt = byggAttesteringModell([enkel({ timer: [timer("t1", "k1", A), timer("t2", "k1", B)] })], deps);
    const g = grupperModell(delt, "prosjekt")!;
    expect(g.map((x) => x.dager[0]!.kort.flatMap((k) => k.linjer.map((l) => l.projectId)))).toEqual([["pA"], ["pB"]]);
  });

  it("«Etter ansatt» samler den ansattes dager; «dag» gir ingen gruppering", () => {
    const to = byggAttesteringModell([enkel(), enkel({ id: "s2", dato: "2026-11-17" })], deps);
    const g = grupperModell(to, "ansatt")!;
    expect(g).toHaveLength(1);
    expect(g[0]!.tittel).toBe("Kari Nordmann (12)");
    expect(g[0]!.dager.map((d) => d.sedel.id)).toEqual(["s1", "s2"]);
    expect(grupperModell(to, "dag")).toBeNull();
  });
});

describe("T45 — ukeoversikten er summen av tabellens timerlinjer pr. dag", () => {
  const m = byggAttesteringModell([enkel(), enkel({ id: "s2", dato: "2026-11-17", timer: [timer("t9", "kA", A, { timer: "4" })] })], deps);

  it("ansattaksen: dagens tall = summen av dagens timerlinjer; prosjektene under", () => {
    const [kari] = byggUkeoversikt(m, "ansatt");
    for (const d of m) {
      const tabell = d.kort.flatMap((k) => k.linjer).filter((l) => l.linje.type === "timer").reduce((s, l) => s + (l.linje.timer ?? 0), 0);
      expect(kari!.perDag[d.dato]).toBe(tabell);
    }
    expect(kari!.sum).toBe(19);
    expect(kari!.under.map((u) => [u.navn, u.sum])).toEqual([["1001 Prosjekt A", 11.5], ["SD-pB Prosjekt B", 7.5]]);
  });

  it("prosjektaksen: timene føres på radens prosjekt (HM12), med de ansatte under", () => {
    const rader = byggUkeoversikt(m, "prosjekt");
    expect(rader.map((r) => [r.nokkel, r.perDag])).toEqual([
      ["pA", { "2026-11-16": 7.5, "2026-11-17": 4 }],
      ["pB", { "2026-11-16": 7.5 }],
    ]);
    expect(rader[0]!.under.map((u) => u.ansattId)).toEqual(["u1"]);
  });
});

describe("R13 — rad på prosjekt uten tilgang heter «Annet prosjekt»", () => {
  it("serveren sendte project: null → «Annet prosjekt», uten nummer", () => {
    const [d] = byggAttesteringModell([enkel({ timer: [timer("t1", "kX", A, { projectId: "pX", project: null })] })], deps);
    expect(d!.kort[0]!.prosjekt).toBe("Annet prosjekt");
    expect(d!.kort[0]!.linjer[0]!.linje.prosjektnummer).toBeNull();
  });

  it("utlegg følger samme grense; firmalistens utlegg uten prosjekt får ikke fraværsteksten", () => {
    const [d] = byggAttesteringModell(
      [enkel({ timer: [], utlegg: [
        { id: "u1", belop: 80, expenseCategory: { navn: "Bom" }, kortId: null, projectId: "pX", project: null },
        { id: "u2", belop: 50, expenseCategory: { navn: "Parkering" }, kortId: null },
      ] })],
      deps,
    );
    const tekst = d!.kort.flatMap((k) => k.linjer).map((l) => [l.linje.id, l.linje.prosjekt]);
    expect(tekst).toContainEqual(["u1", "Annet prosjekt"]);
    expect(tekst.find(([id]) => id === "u2")![1]).not.toBe("Fravær");
  });
});

describe("T35 — vakt: dagskortet, detaljsiden og ukeoversikten leser modellen, ingen egen bøtting", () => {
  const les = (sti: string) => readFileSync(resolve(__dirname, sti), "utf8");
  it("ukeoversikten og hover-dagskortet bygger på byggUkeoversikt/AttDag", () => {
    const kilde = les("../components/attestering/Ukeoversikt.tsx");
    expect(kilde).toMatch(/byggUkeoversikt\(/);
    expect(kilde).not.toMatch(/bucketMap|new Map<string, AttLinje|grupperPerProsjekt|maskinPerTimer/);
  });
  it("detaljsiden tegner radene med AttesteringTabell, ikke prosjekt/ECO-bøttene", () => {
    const kilde = les("../components/timer/AttesteringDetalj.tsx");
    expect(kilde).toMatch(/<AttesteringTabell/);
    expect(kilde).not.toMatch(/ProsjektSectionAttest|bucketMap|EcoBucketAttestProps/);
  });
  it("firmasiden har ingen pivot", () => {
    expect(les("../app/dashbord/attestering/page.tsx")).not.toMatch(/AttesteringPivot|tilPivotRad/);
  });
});

describe("w9 — merket «Maskin over arbeid» på jobbraden (B21 A, B23 B)", () => {
  // Jobbraden samler linjenes merker unikt pr. tekst (AttesteringTabell `unikeMerker`).
  const merkerFor = (s: AttSedel, kortId = "kA") => {
    const [dag] = byggAttesteringModell([s], deps);
    const kort = dag!.kort.find((k) => k.nokkel === `${s.id}:${kortId}`)!;
    const unike = new Map(
      kort.linjer.flatMap((l) => l.avvikMerker).filter((m) => m.tekst === "Maskin over arbeid").map((m) => [m.tekst, m]),
    );
    return [...unike.values()];
  };
  // Kenneths eksempel: Ola Tømrer, arbeid 4,5 t, maskin 7,5 t på samme jobb.
  const ola = (over: Partial<AttSedel> = {}) =>
    sedel({
      timer: [timer("t1", "kA", A, { timer: "4.5" })],
      maskiner: [maskin("m1", "kA", "t1", "v1", { timer: "7.5", utleieEnhet: "time" })],
      varer: [],
      ukeAvvikRadIder: [],
      ...over,
    });

  it("🔴 førermaskin 7,5 t mot arbeid 4,5 t → merket med forklaringen", () => {
    const merker = merkerFor(ola());
    expect(merker).toHaveLength(1);
    expect(merker[0]!.forklaring).toBe("Maskin 7,5 t, arbeid 4,5 t");
  });

  it("merket teller som avvik (filteret «har avvik»)", () => {
    const [dag] = byggAttesteringModell([ola()], deps);
    expect(dag!.kort[0]!.linjer[0]!.linje.avvik.some((a) => a.startsWith("Maskin over arbeid"))).toBe(true);
  });

  it("døgn-maskin over arbeidet får varsel-merket, hver maskin for seg (S2)", () => {
    const merker = merkerFor(
      ola({
        maskiner: [
          maskin("m1", "kA", "t1", "v1", { timer: "9", utleieEnhet: "doegn" }),
          maskin("m2", "kA", null, "v2", { timer: "3", utleieEnhet: "doegn" }),
        ],
      }),
    );
    expect(merker).toHaveLength(1);
    expect(merker[0]!.forklaring).toBe("Maskin 9 t, arbeid 4,5 t");
  });

  it("negativkontroll: maskin innenfor arbeidet → intet merke", () => {
    expect(merkerFor(ola({ maskiner: [maskin("m1", "kA", "t1", "v1", { timer: "4.5", utleieEnhet: "time" })] }))).toHaveLength(0);
  });

  it("negativkontroll: attestert jobb uten ventende rader → intet merke", () => {
    expect(
      merkerFor(
        ola({
          timer: [timer("t1", "kA", A, { timer: "4.5", attestertStatus: "attestert" })],
          maskiner: [maskin("m1", "kA", "t1", "v1", { timer: "7.5", utleieEnhet: "time", attestertStatus: "attestert" })],
        }),
      ),
    ).toHaveLength(0);
  });

  it("reise teller ikke som arbeid", () => {
    const merker = merkerFor(
      ola({
        timer: [timer("t1", "kA", A, { timer: "4.5" }), timer("t9", "kA", A, { timer: "4", erReise: true })],
      }),
    );
    expect(merker.map((m) => m.forklaring)).toEqual(["Maskin 7,5 t, arbeid 4,5 t"]);
  });

  it("en annen jobbs brudd merker ikke denne jobben", () => {
    const s = sedel({
      timer: [timer("t1", "kA", A, { timer: "4.5" }), timer("t2", "kB", B, { timer: "8" })],
      maskiner: [maskin("m1", "kA", "t1", "v1", { timer: "7.5", utleieEnhet: "time" })],
      varer: [],
      ukeAvvikRadIder: [],
    });
    expect(merkerFor(s, "kA")).toHaveLength(1);
    expect(merkerFor(s, "kB")).toHaveLength(0);
  });
});

describe("w12 — reisen i jobbens kort (plan § 4.11 del C; H.7 og H.8)", () => {
  const u = (proAdmId: string) => ({ proAdmId, kortNavn: `UP ${proAdmId}`, navn: null });
  const jobb = (over: Partial<AttTimer> = {}) => timer("t1", "kA", A, { externalCostObjectId: "e1", underprosjekt: u("100"), ...over });
  const reise = (id: string, over: Partial<AttTimer> = {}) =>
    timer(id, "kA", A, { erReise: true, lonnsartId: "l1", fraTid: "06:00", tilTid: "07:00", timer: "1", pauseMin: 0, externalCostObjectId: "e1", underprosjekt: u("100"), ...over });
  const modell = (timerRader: AttTimer[]) =>
    byggAttesteringModell([sedel({ timer: timerRader, maskiner: [], varer: [], ukeAvvikRadIder: [] })], deps)[0]!;

  it("H.7: «Maskin over arbeid» er lik før og etter at reisen har jobbens kort-id", () => {
    const merkerFor2 = (kortId: string | null) => {
      const s = sedel({
        timer: [timer("t1", "kA", A, { timer: "4.5" }), timer("r1", kortId as string, A, { timer: "4", erReise: true })],
        maskiner: [maskin("m1", "kA", "t1", "v1", { timer: "7.5", utleieEnhet: "time" })],
        varer: [],
        ukeAvvikRadIder: [],
      });
      const kort = byggAttesteringModell([s], deps)[0]!.kort.find((k) => k.nokkel === "s1:kA")!;
      return kort.linjer.flatMap((l) => l.avvikMerker).filter((m) => m.tekst === "Maskin over arbeid").map((m) => m.forklaring);
    };
    expect(merkerFor2("kA")).toEqual(["Maskin 7,5 t, arbeid 4,5 t"]);
    expect(merkerFor2("kA")).toEqual(merkerFor2(null));
  });

  it("reiselinja står sist i jobben, utreise før retur; ingen reiseblokk; én jobb på dagen", () => {
    const d = modell([reise("r2", { reiseRetning: "retur", fraTid: "15:00", tilTid: "16:00" }), jobb(), reise("r1", { reiseRetning: "ut" })]);
    expect(d.kort.map((k) => k.nokkel)).toEqual(["s1:kA"]);
    expect(d.kort[0]!.reise).toBe(false);
    expect(d.kort[0]!.linjer.map((l) => [l.linje.id, l.linje.erReise === true])).toEqual([["t1", false], ["r1", true], ["r2", true]]);
    // Reiselinja er en timelinje uten maskiner og varer, med handling (følger jobbens ✓ ↩ ↺).
    const r1 = d.kort[0]!.linjer[1]!;
    expect(r1.kilde.type).toBe("timer");
    expect(r1.harHandling).toBe(true);
    expect(r1.radIder).toEqual({ timerIder: ["r1"], maskinIder: [], tilleggIder: [] });
  });

  it("✓ på jobben sender reisens id sammen med jobbens (C3)", () => {
    const d = modell([jobb(), reise("r1", { reiseRetning: "ut" })]);
    const u2 = byggJobbUtvalg([d], ["s1:kA"], new Set(["s1:kA"]), () => d.sedel);
    expect([...u2.radIder.timerIder].sort()).toEqual(["r1", "t1"]);
    expect(u2.antallJobber).toBe(1);
  });

  it("jobbens sum skiller reisen ut; dagens sum har alt (C4)", () => {
    const d = modell([jobb(), reise("r1", { reiseRetning: "ut" })]);
    expect(sumLinjer(d.kort[0]!.linjer)).toEqual({ timer: 8.5, maskintimer: 0, reise: 1 });
  });

  it("reiselinja viser eget underprosjekt når det avviker; «Uten» når reisen ikke har noe (C1, B34 B)", () => {
    const lik = modell([jobb(), reise("r1")]).kort[0]!;
    expect(lik.linjer[1]!.linje.underprosjekt).toBe(lik.underprosjekt);
    const annet = modell([jobb(), reise("r1", { externalCostObjectId: "e2", underprosjekt: u("200") })]).kort[0]!;
    expect(annet.underprosjekt).toBe("100 · UP 100 · Til byggherre");
    expect(annet.linjer[1]!.linje.underprosjekt).toBe("200 · UP 200 · Til byggherre");
    const uten = modell([jobb(), reise("r1", { externalCostObjectId: null, underprosjekt: null })]).kort[0]!;
    expect(uten.linjer[1]!.linje.underprosjekt).toBe("Uten");
    // Reisen endrer ikke jobbens hode.
    expect(uten.underprosjekt).toBe("100 · UP 100 · Til byggherre");
  });

  it("reise alene i et kort vises som eget kort med reisens underprosjekt (C7)", () => {
    const d = modell([jobb(), timer("r9", "kR", B, { erReise: true, externalCostObjectId: "e9", underprosjekt: u("900") })]);
    const kR = d.kort.find((k) => k.nokkel === "s1:kR")!;
    expect(kR.reise).toBe(true);
    expect(kR.underprosjekt).toBe("900 · UP 900 · Til byggherre");
    expect(d.kort.find((k) => k.nokkel === "s1:kA")!.reise).toBe(false);
  });

  it("w15c F31: reisekort med et utlegg står fortsatt som «Reise», ikke som en jobb uten timer", () => {
    const s = sedel({
      timer: [jobb(), timer("r9", "kR", B, { erReise: true, externalCostObjectId: null, underprosjekt: null })],
      maskiner: [],
      varer: [],
      ukeAvvikRadIder: [],
      utlegg: [{ id: "u9", belop: 80, expenseCategory: { navn: "Bom" }, kortId: "kR", projectId: "pB", project: B }],
    });
    const d = byggAttesteringModell([s], deps)[0]!;
    const kR = d.kort.find((k) => k.nokkel === "s1:kR")!;
    expect(kR.linjer.map((l) => l.linje.id).sort()).toEqual(["r9", "u9"]);
    expect(kR.reise).toBe(true);
    expect(d.kort.find((k) => k.nokkel === "s1:kA")!.reise).toBe(false);
  });

  it("w15c F31: kort med bare tillegg eller utlegg er ikke reise", () => {
    const s = sedel({
      timer: [jobb()],
      maskiner: [],
      varer: [],
      ukeAvvikRadIder: [],
      utlegg: [{ id: "u9", belop: 80, expenseCategory: { navn: "Bom" }, kortId: "kU", projectId: "pB", project: B }],
    });
    const kU = byggAttesteringModell([s], deps)[0]!.kort.find((k) => k.nokkel === "s1:kU")!;
    expect(kU.reise).toBe(false);
  });
});

describe("A1 (plan § 4.17 del A) — normmerket, lønnsartmerkene og gule linjer", () => {
  const arter: Record<string, { navn: string; type?: string; overtidsnivaa?: number | null }> = {
    l1: { navn: "Ordinær" },
    l2: { navn: "Overtid 50 %", overtidsnivaa: 50 },
    lf: { navn: "Sykemelding", type: "fravaer" },
    lr: { navn: "Reise" },
  };
  const oppslag: LonnsartOppslag = (id) => arter[id];

  it("normmerket måles mot arbeid uten reise; fravær fyller normen", () => {
    const d = dagensTimer(
      [
        { timer: "5", lonnsartId: "l1" },
        { timer: "1.5", lonnsartId: "lr", erReise: true },
        { timer: "2.5", lonnsartId: "lf" },
      ],
      7.5,
      oppslag,
    );
    expect(d).toMatchObject({ arbeid: 5, reise: 1.5, fravaer: 2.5, sum: 9, avvik: 0 });
  });

  it("negativkontroll: reisen teller ikke mot normen — uten fravær er dagen 2,5 t under", () => {
    const d = dagensTimer([{ timer: "5", lonnsartId: "l1" }, { timer: "1.5", lonnsartId: "lr", erReise: true }], 7.5, oppslag);
    expect(d.avvik).toBe(-2.5);
    // Ville reisen telt, sto dagen bare 1 t under.
    expect(d.avvik).not.toBe(-1);
  });

  it("overtid regnes som arbeid og vises for seg; uten norm er det ikke noe avvik", () => {
    const d = dagensTimer([{ timer: "7.5", lonnsartId: "l1" }, { timer: "2", lonnsartId: "l2" }], null, oppslag);
    expect(d).toMatchObject({ arbeid: 9.5, overtid: 2, avvik: null });
  });

  const [dag] = byggAttesteringModell(
    [sedel({
      timer: [
        timer("t3", "kA", A, { lonnsartId: "l1", fraTid: "11:00", tilTid: "15:00", timer: "4" }),
        timer("t1", "kA", A, { lonnsartId: "l1", fraTid: "07:00", tilTid: "10:30", timer: "3.5" }),
        timer("t2", "kA", A, { lonnsartId: "l2", fraTid: "15:00", tilTid: "17:00", timer: "2" }),
        timer("t4", "kA", A, { lonnsartId: "lf", fraTid: "17:00", tilTid: "18:00", timer: "1" }),
      ],
      maskiner: [], varer: [], ukeAvvikRadIder: [],
    })],
    { ...deps, lonnsartNavn: (id) => arter[id]?.navn ?? "?" },
  );
  const linjer = dag!.kort.flatMap((k) => k.linjer);

  it("lønnsartmerkene: ett merke pr. art i tidsrekkefølge, med sum og linjene for hover", () => {
    const m = lonnsartMerker(linjer, oppslag);
    expect(m.map((x) => [x.navn, x.timer, x.varsel])).toEqual([
      ["Ordinær", 7.5, null],
      ["Overtid 50 %", 2, "overtid"],
      ["Sykemelding", 1, "fravaer"],
    ]);
    expect(m[0]!.linjer.map((l) => l.fraTid)).toEqual(["07:00", "11:00"]);
  });

  it("gule linjer: overtid og fravær; negativkontroll: ordinær linje er ikke gul", () => {
    const v = (id: string) => linjeVarsel(linjer.find((l) => l.kilde.type === "timer" && l.kilde.rad.id === id)!, oppslag);
    expect(v("t2")).toBe("overtid");
    expect(v("t4")).toBe("fravaer");
    expect(v("t1")).toBeNull();
  });
});
