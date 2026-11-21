import { describe, expect, it } from "vitest";
import { utledKortId, utledReiseKortId } from "./kortId";
import {
  egetReiseKort,
  jobberFraArbeidsrader,
  jobbRekkefolge,
  OVERFORING_KORT_BYGGEPLASS,
  velgReiseKort,
  type ReiseKortJobb,
  type ReiseKortReise,
} from "./reiseKort";

// web-timeforing-plan.md § 4.11 del A punkt 3 og del H punkt 4; w15c: § 4.15 del E og del H 1, 7, 9.
const jobb = (o: Partial<ReiseKortJobb> & { kortId: string }): ReiseKortJobb => ({
  projectId: "B12",
  ecoId: null,
  byggeplassId: "storgata",
  forsteTid: null,
  eldste: 0,
  ...o,
});
const reise = (o: Partial<ReiseKortReise> = {}): ReiseKortReise => ({
  projectId: "B12",
  ecoId: null,
  byggeplassId: "storgata",
  retning: "ut",
  fraTid: null,
  ...o,
});

describe("velgReiseKort — eksempelet i del A punkt 3 (B12, to jobber)", () => {
  const morgen = jobb({ kortId: "J07", forsteTid: "07:00", eldste: 1 });
  const ettermiddag = jobb({ kortId: "J12", ecoId: "END-002", forsteTid: "12:00", eldste: 2 });
  const jobber = [ettermiddag, morgen];

  it("utreise uten underprosjekt → jobben 07–12", () => {
    expect(velgReiseKort(reise({ retning: "ut" }), jobber)).toBe("J07");
  });
  it("retur uten underprosjekt → jobben 07–12 (eneste uten underprosjekt)", () => {
    expect(velgReiseKort(reise({ retning: "retur" }), jobber)).toBe("J07");
  });
  it("retur på END-002 → jobben 12–16", () => {
    expect(velgReiseKort(reise({ retning: "retur", ecoId: "END-002" }), jobber)).toBe("J12");
  });
  it("utreise på TILL-001 (ingen jobb der) → null (eget kort, B44 — var jobben 07–12 før w15c)", () => {
    expect(velgReiseKort(reise({ retning: "ut", ecoId: "TILL-001" }), jobber)).toBeNull();
  });
  it("utreise på prosjekt 1050 (ingen jobb der) → null (eget kort)", () => {
    expect(velgReiseKort(reise({ projectId: "1050" }), jobber)).toBeNull();
  });
});

describe("velgReiseKort — retning og rekkefølge", () => {
  const a = jobb({ kortId: "A", forsteTid: "07:00", eldste: 3 });
  const b = jobb({ kortId: "B", forsteTid: "12:00", eldste: 1 });
  const c = jobb({ kortId: "C", forsteTid: null, eldste: 0 });

  it("utreise → første etter klokkeslett, retur → siste", () => {
    expect(velgReiseKort(reise({ retning: "ut" }), [b, a])).toBe("A");
    expect(velgReiseKort(reise({ retning: "retur" }), [b, a])).toBe("B");
  });
  it("jobb uten klokkeslett står sist i rekkefølgen (retur havner der)", () => {
    expect(velgReiseKort(reise({ retning: "ut" }), [c, b, a])).toBe("A");
    expect(velgReiseKort(reise({ retning: "retur" }), [c, b, a])).toBe("C");
  });
  it("lik starttid → eldste først, så kort-id", () => {
    const x = jobb({ kortId: "X", forsteTid: "07:00", eldste: 5 });
    const y = jobb({ kortId: "Y", forsteTid: "07:00", eldste: 2 });
    expect(velgReiseKort(reise({ retning: "ut" }), [x, y])).toBe("Y");
    const z = jobb({ kortId: "Z", forsteTid: "07:00", eldste: 2 });
    expect(velgReiseKort(reise({ retning: "retur" }), [x, y, z].map((j) => ({ ...j, eldste: 2 })))).toBe("Z");
  });
  it("uten retning: før første arbeid → første, ellers siste", () => {
    expect(velgReiseKort(reise({ retning: null, fraTid: "06:30" }), [a, b])).toBe("A");
    expect(velgReiseKort(reise({ retning: null, fraTid: "16:00" }), [a, b])).toBe("B");
    expect(velgReiseKort(reise({ retning: null, fraTid: "07:00" }), [a, b])).toBe("B");
  });
  it("uten retning og uten klokkeslett → første", () => {
    expect(velgReiseKort(reise({ retning: null, fraTid: null }), [a, b])).toBe("A");
  });
  it("uten retning når ingen kandidat har klokkeslett → første", () => {
    const d = jobb({ kortId: "D", eldste: 2 });
    expect(velgReiseKort(reise({ retning: null, fraTid: "16:00" }), [c, d])).toBe("C");
  });
  it("ukjent retning («mellom») regnes som uten retning", () => {
    expect(velgReiseKort(reise({ retning: "mellom", fraTid: "16:00" }), [a, b])).toBe("B");
  });
  it("ny tidligere jobb flytter utreisen", () => {
    const tidlig = jobb({ kortId: "T", forsteTid: "06:00", eldste: 9 });
    expect(velgReiseKort(reise({ retning: "ut" }), [a, b])).toBe("A");
    expect(velgReiseKort(reise({ retning: "ut" }), [a, b, tidlig])).toBe("T");
  });
  it("slettet jobb → reisen går til en annen jobb; ingen igjen → null", () => {
    expect(velgReiseKort(reise({ retning: "ut" }), [b])).toBe("B");
    expect(velgReiseKort(reise({ retning: "ut" }), [])).toBeNull();
  });
});

describe("velgReiseKort — byggeplassen er et krav (w15c, B43 B; del E punkt 3)", () => {
  it("reise til en byggeplass uten jobb → null (eget kort)", () => {
    const a = jobb({ kortId: "A", byggeplassId: "y", forsteTid: "07:00" });
    const b = jobb({ kortId: "B", byggeplassId: "z", forsteTid: "12:00" });
    expect(velgReiseKort(reise({ retning: "retur", byggeplassId: "x" }), [a, b])).toBeNull();
  });
  it("lik byggeplass går foran retningen", () => {
    const annen = jobb({ kortId: "ANNEN", byggeplassId: "y", forsteTid: "07:00" });
    const sammeSted = jobb({ kortId: "SAMME", byggeplassId: "x", forsteTid: "12:00" });
    expect(velgReiseKort(reise({ retning: "ut", byggeplassId: "x" }), [annen, sammeSted])).toBe("SAMME");
  });
  it("byggeplassen går foran underprosjektet: lik underprosjekt på en annen byggeplass er ingen kandidat", () => {
    const likBp = jobb({ kortId: "BP", ecoId: null, byggeplassId: "x", forsteTid: "07:00" });
    const likEco = jobb({ kortId: "ECO", ecoId: "e1", byggeplassId: "y", forsteTid: "12:00" });
    expect(velgReiseKort(reise({ ecoId: "e1", byggeplassId: "x" }), [likBp, likEco])).toBeNull();
    expect(velgReiseKort(reise({ ecoId: null, byggeplassId: "x" }), [likBp, likEco])).toBe("BP");
  });
  it("prosjekt uten byggeplasser (effektiv byggeplass null på begge) → jobben", () => {
    const j = jobb({ kortId: "J", byggeplassId: null, forsteTid: "07:00" });
    expect(velgReiseKort(reise({ byggeplassId: null, retning: "ut" }), [j])).toBe("J");
  });
  it("uten byggeplass er en egen verdi: reise uten effektiv byggeplass står ikke i jobb med byggeplass", () => {
    const j = jobb({ kortId: "J", byggeplassId: "x", forsteTid: "07:00" });
    expect(velgReiseKort(reise({ byggeplassId: null, retning: "ut" }), [j])).toBeNull();
  });
});

describe("velgReiseKort — underprosjektet (w15c, B44 og B48 A; del E punkt 4, del H 9)", () => {
  it("reise med underprosjekt som ingen jobb på byggeplassen har → null", () => {
    const j = jobb({ kortId: "J", ecoId: "e2", forsteTid: "07:00" });
    const u = jobb({ kortId: "U", ecoId: null, forsteTid: "12:00" });
    expect(velgReiseKort(reise({ ecoId: "e1" }), [j, u])).toBeNull();
  });
  it("reise med underprosjekt → bare jobben med det samme", () => {
    const j = jobb({ kortId: "J", ecoId: "e1", forsteTid: "12:00" });
    const u = jobb({ kortId: "U", ecoId: null, forsteTid: "07:00" });
    expect(velgReiseKort(reise({ ecoId: "e1", retning: "ut" }), [j, u])).toBe("J");
  });
  it("reise uten underprosjekt: jobben «Uten» går foran", () => {
    const j = jobb({ kortId: "J", ecoId: "e1", forsteTid: "07:00" });
    const u = jobb({ kortId: "U", ecoId: null, forsteTid: "12:00" });
    expect(velgReiseKort(reise({ ecoId: null, retning: "ut" }), [j, u])).toBe("U");
  });
  it("reise uten underprosjekt står i jobben på byggeplassen, også når jobben har underprosjekt (B48 A)", () => {
    const j1 = jobb({ kortId: "J1", ecoId: "e1", forsteTid: "07:00" });
    const j2 = jobb({ kortId: "J2", ecoId: "e2", forsteTid: "12:00" });
    expect(velgReiseKort(reise({ ecoId: null, retning: "ut" }), [j1, j2])).toBe("J1");
    expect(velgReiseKort(reise({ ecoId: null, retning: "retur" }), [j1, j2])).toBe("J2");
  });
  it("«flytt hele jobben» til annet underprosjekt: reisen på det gamle får eget kort", () => {
    const foer = [jobb({ kortId: "J1", ecoId: "e1", forsteTid: "07:00" }), jobb({ kortId: "J2", ecoId: null, forsteTid: "12:00" })];
    expect(velgReiseKort(reise({ ecoId: "e1", retning: "retur" }), foer)).toBe("J1");
    const etter = [jobb({ kortId: "J1", ecoId: "e2", forsteTid: "07:00" }), foer[1]!];
    expect(velgReiseKort(reise({ ecoId: "e1", retning: "retur" }), etter)).toBeNull();
  });
  it("regelen endrer aldri reiseraden (bare leser den)", () => {
    const r = Object.freeze(reise({ ecoId: "e1", byggeplassId: "x" }));
    const jobber = Object.freeze([Object.freeze(jobb({ kortId: "A", forsteTid: "07:00" }))]);
    expect(() => velgReiseKort(r, jobber)).not.toThrow();
    expect(r).toEqual(reise({ ecoId: "e1", byggeplassId: "x" }));
  });
});

describe("velgReiseKort — reise til annet kontor (w15c, del E punkt 6, del H 7)", () => {
  // Kontorreisen bærer ingen egen byggeplass; jobbene står på Storgata.
  const morgen = jobb({ kortId: "J07", forsteTid: "07:00", eldste: 1 });
  const ettermiddag = jobb({ kortId: "J12", forsteTid: "12:00", eldste: 2, byggeplassId: "annen" });
  const kontor = (o: Partial<ReiseKortReise>) => reise({ byggeplassId: null, overforing: true, ...o });

  it("før dagens første arbeid på prosjektet → første jobb (jobben man kjører til)", () => {
    expect(velgReiseKort(kontor({ retning: "ut", fraTid: "06:00" }), [ettermiddag, morgen])).toBe("J07");
  });
  it("etter at arbeidet er begynt → null (eget kort)", () => {
    expect(velgReiseKort(kontor({ retning: "ut", fraTid: "12:00" }), [ettermiddag, morgen])).toBeNull();
    expect(velgReiseKort(kontor({ retning: "ut", fraTid: "07:00" }), [morgen])).toBeNull();
  });
  it("retur fra annet kontor → jobben man drar fra (siste, B44)", () => {
    expect(velgReiseKort(kontor({ retning: "retur", fraTid: "16:00" }), [ettermiddag, morgen])).toBe("J12");
  });
  it("hopper over byggeplass-steget, men underprosjektet følger punkt 4", () => {
    const e = jobb({ kortId: "E", ecoId: "e1", forsteTid: "08:00", byggeplassId: "x" });
    expect(velgReiseKort(kontor({ retning: "ut", fraTid: "06:00", ecoId: "e1" }), [morgen, e])).toBe("E");
    expect(velgReiseKort(kontor({ retning: "ut", fraTid: "06:00", ecoId: "e9" }), [morgen, e])).toBeNull();
  });
  it("uten klokkeslett på reisen → som før arbeid", () => {
    expect(velgReiseKort(kontor({ retning: "ut", fraTid: null }), [morgen])).toBe("J07");
  });
  it("vanlig reise uten byggeplass er ingen kontorreise: den følger byggeplassen (null ≠ Storgata)", () => {
    expect(velgReiseKort(reise({ byggeplassId: null, retning: "ut", fraTid: "06:00" }), [morgen])).toBeNull();
  });
});

describe("velgReiseKort — dagen på bilde 8 (w15c, del G)", () => {
  // B12: jobben «sommerfeldtsgt 65 · uten» 07–12; reisen 12–15 til Narvik, timerad uten retning.
  const jobben = jobb({ kortId: "SOMMERFELDT", byggeplassId: "sommerfeldtsgt65", forsteTid: "07:00" });
  it("reisen til Narvik står ikke i jobben, den får eget kort", () => {
    expect(velgReiseKort(reise({ byggeplassId: "narvik", retning: null, fraTid: "12:00" }), [jobben])).toBeNull();
  });
  it("som overføring til Kontor Narvik etter arbeid: også eget kort", () => {
    expect(velgReiseKort(reise({ byggeplassId: null, overforing: true, retning: "ut", fraTid: "12:00" }), [jobben])).toBeNull();
  });
});

describe("egetReiseKort — id-en for eget kort (w15c, F24, F25)", () => {
  const nokkel = { projectId: "p", byggeplassId: "b", ecoId: null };
  const args = { userId: "u", dato: "2026-11-21", nokkel };
  it("normalt den utledede id-en av reisens nøkkel (samme kort som tillegg på samme sted)", () => {
    expect(egetReiseKort({ ...args, overforing: false, jobbKortIder: [] })).toBe(utledKortId(args));
  });
  it("treffer den utledede id-en kortet til en jobb på sedelen → egen reise-id", () => {
    const k = egetReiseKort({ ...args, overforing: false, jobbKortIder: [utledKortId(args)] });
    expect(k).toBe(utledReiseKortId(args));
    expect(k).not.toBe(utledKortId(args));
  });
  it("kontorreise i eget kort får alltid reise-id-en med byggeplass «overforing», aldri lik en jobbs", () => {
    const k = egetReiseKort({ ...args, overforing: true, jobbKortIder: [] });
    expect(k).toBe(utledReiseKortId({ ...args, nokkel: { ...nokkel, byggeplassId: OVERFORING_KORT_BYGGEPLASS } }));
    expect(k).not.toBe(utledKortId(args));
    expect(k).not.toBe(utledKortId({ ...args, nokkel: { ...nokkel, byggeplassId: null } }));
  });
});

describe("jobberFraArbeidsrader", () => {
  it("ett kort pr. id, første fra-tid og eldste rad; erstattede og rader uten kort teller ikke", () => {
    const j = jobberFraArbeidsrader([
      { kortId: "K", projectId: "p", ecoId: null, byggeplassId: "b", fraTid: "12:00", opprettet: 5 },
      { kortId: "K", projectId: "p", ecoId: null, byggeplassId: "b", fraTid: "07:00", opprettet: 9 },
      { kortId: "K", projectId: "p", ecoId: null, byggeplassId: "b", fraTid: "05:00", opprettet: 1, attestertStatus: "erstattet" },
      { kortId: null, projectId: "p", ecoId: null, byggeplassId: "b", fraTid: "04:00", opprettet: 0 },
    ]);
    expect(j).toEqual([{ kortId: "K", projectId: "p", ecoId: null, byggeplassId: "b", forsteTid: "07:00", eldste: 5 }]);
  });
  it("kort med bare erstattede rader er ingen jobb", () => {
    expect(
      jobberFraArbeidsrader([{ kortId: "K", projectId: "p", ecoId: null, byggeplassId: null, fraTid: null, opprettet: 1, attestertStatus: "erstattet" }]),
    ).toEqual([]);
  });
});

describe("jobbRekkefolge", () => {
  it("klokkeslett før uten, så eldste, så kort-id", () => {
    const l = [
      { kortId: "c", forsteTid: null, eldste: 0 },
      { kortId: "b", forsteTid: "07:00", eldste: 2 },
      { kortId: "a", forsteTid: "07:00", eldste: 2 },
      { kortId: "d", forsteTid: "06:00", eldste: 9 },
    ].sort(jobbRekkefolge);
    expect(l.map((x) => x.kortId)).toEqual(["d", "a", "b", "c"]);
  });
});
