import { describe, it, expect } from "vitest";
import {
  byggKildeIndeks,
  byggSitedocGrupper,
  filtrerOgFold,
  grupperFirmaMaler,
  EGENLAGDE_KEY,
  type SokbarGruppe,
} from "../arkiv-fane-filter";

/**
 * Ordre arkivmodal-sok-kollaps (fabels punkt E). Beviser de tre kravene på ren logikk,
 * uten trpc/React: søk folder ut sammenslåtte grupper (Krav 1), samme modell i begge
 * faner (Krav 2), og at søket aldri omgår typefilteret (Krav 3).
 */

type Rad = { id: string; sok: string };
const rad = (id: string, sok: string): Rad => ({ id, sok: sok.toLowerCase() });

const toGrupper = (): SokbarGruppe<Rad>[] => [
  { key: "k1", tittel: "NS3420 · CU Betong", rader: [rad("a", "Armering B500NC"), rad("b", "Utstøping")] },
  { key: "k2", tittel: "NS3420 · JB Tak", rader: [rad("c", "Tekking membran")] },
];

describe("filtrerOgFold — søk folder ut sammenslåtte grupper", () => {
  it("uten søk: alt sammenslått når kollaps-settet er tomt", () => {
    const { synlige, harSok } = filtrerOgFold(toGrupper(), "", new Set());
    expect(harSok).toBe(false);
    expect(synlige.map((g) => g.apen)).toEqual([false, false]);
    // Radene bevares selv om gruppen er sammenslått (komponenten skjuler dem i UI).
    expect(synlige[0]!.rader).toHaveLength(2);
  });

  it("uten søk: kun grupper i kollaps-settet er åpne", () => {
    const { synlige } = filtrerOgFold(toGrupper(), "", new Set(["k2"]));
    expect(synlige.find((g) => g.key === "k1")!.apen).toBe(false);
    expect(synlige.find((g) => g.key === "k2")!.apen).toBe(true);
  });

  // 🔴 KRAVETS KJERNE + negativkontroll: et treff i en SAMMENSLÅTT gruppe (tomt kollaps-sett)
  // MÅ komme fram — gruppen foldes ut og bare treff-raden står igjen. Fjernes `harSok ? true`
  // i filtrerOgFold blir `apen` false her, og assertionen under blir rød.
  it("søk inne i en sammenslått gruppe: gruppen foldes ut og viser treffet", () => {
    const { synlige, harSok } = filtrerOgFold(toGrupper(), "membran", new Set());
    expect(harSok).toBe(true);
    // Bare gruppen med treff overlever, og den er åpen selv om den startet sammenslått.
    expect(synlige).toHaveLength(1);
    expect(synlige[0]!.key).toBe("k2");
    expect(synlige[0]!.apen).toBe(true);
    expect(synlige[0]!.rader.map((r) => r.id)).toEqual(["c"]);
  });

  it("søk uten treff: ingen synlige grupper", () => {
    const { synlige, antall } = filtrerOgFold(toGrupper(), "finnesikke", new Set());
    expect(synlige).toHaveLength(0);
    expect(antall).toBe(0);
  });
});

/* ---- Krav 3: søk + typefilter + kollaps sammen ---- */

const standarder = [
  {
    kode: "NS3420",
    kapitler: [
      {
        id: "kap1",
        kode: "CU",
        navn: "Betong",
        maler: [
          { id: "m-sjekk", navn: "Armering kontroll", referanse: "CU3.1", kategori: "sjekkliste", domene: "kvalitet" },
          { id: "m-oppg", navn: "Armering oppgave", referanse: "CU9.9", kategori: "oppgave", domene: "kvalitet" },
        ],
      },
    ],
  },
];

describe("byggSitedocGrupper + filtrerOgFold — søket omgår aldri typefilteret (Krav 3)", () => {
  it("sjekkliste-flaten: oppgavemalen er filtrert bort FØR søk, så et søk på den gir null", () => {
    const grupper = byggSitedocGrupper(standarder, "sjekkliste").map((g) => ({
      key: g.key,
      tittel: g.tittel,
      rader: g.maler.map((m) => ({ id: m.id, sok: `${m.navn} ${m.referanse}`.toLowerCase() })),
    }));
    // Typefilteret har allerede fjernet oppgavemalen fra gruppen.
    expect(grupper[0]!.rader.map((r) => r.id)).toEqual(["m-sjekk"]);

    // Søk som matcher oppgavemalens navn kan ikke hente den tilbake på sjekklisteflaten.
    const oppgaveTreff = filtrerOgFold(grupper, "oppgave", new Set());
    expect(oppgaveTreff.synlige).toHaveLength(0);

    // Søk på sjekklistemalen (i sammenslått gruppe) folder den ut.
    const sjekkTreff = filtrerOgFold(grupper, "kontroll", new Set());
    expect(sjekkTreff.synlige).toHaveLength(1);
    expect(sjekkTreff.synlige[0]!.apen).toBe(true);
    expect(sjekkTreff.synlige[0]!.rader.map((r) => r.id)).toEqual(["m-sjekk"]);
  });
});

/* ---- Krav 2: samme modell i begge faner (firma utleder kapittel fra lånet) ---- */

describe("grupperFirmaMaler — standard→kapittel + «Egenlagde» (Krav 2)", () => {
  const indeks = byggKildeIndeks(standarder);

  it("lånt firmamal grupperes under kildens kapittel; egenlagd havner i «Egenlagde» sist", () => {
    const firma = [
      { id: "f1", laantFraBibliotekMalId: "m-sjekk" }, // lånt fra kap1
      { id: "f2", laantFraBibliotekMalId: null }, // egenlagd
      { id: "f3", laantFraBibliotekMalId: "finnes-ikke" }, // lån mot ukjent kilde → egenlagd
    ];
    const grupper = grupperFirmaMaler(firma, indeks, "Egenlagde");

    expect(grupper).toHaveLength(2);
    // Kapittel-gruppen først, «Egenlagde» sist.
    expect(grupper[0]!.key).toBe("kap1");
    expect(grupper[0]!.tittel).toBe("NS3420 · CU Betong");
    expect(grupper[0]!.maler.map((m) => m.id)).toEqual(["f1"]);

    expect(grupper[1]!.key).toBe(EGENLAGDE_KEY);
    expect(grupper[1]!.tittel).toBe("Egenlagde");
    expect(grupper[1]!.maler.map((m) => m.id)).toEqual(["f2", "f3"]);
  });

  it("kilde-indeksen bærer den arvede referansen firma-søket treffer på", () => {
    expect(indeks.get("m-sjekk")?.referanse).toBe("CU3.1");
  });
});
