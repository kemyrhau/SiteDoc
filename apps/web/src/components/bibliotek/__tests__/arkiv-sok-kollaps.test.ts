import { describe, it, expect } from "vitest";
import {
  byggKildeIndeks,
  byggSitedocGrupper,
  byggUnderkapittelBlokker,
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

/* ---- Del C: kollaps på STANDARD, kapittel som underetikett, referanse-sortering ---- */

const standarder = [
  {
    kode: "NS3420-K",
    navn: "NS 3420-K Anleggsgartner",
    kapitler: [
      {
        kode: "KA",
        navn: "Innledende",
        maler: [
          { id: "ka7", navn: "Rigg", referanse: "KA7", kategori: "sjekkliste", domene: "kvalitet" },
          { id: "ka2", navn: "Oppmåling", referanse: "KA2", kategori: "sjekkliste", domene: "kvalitet" },
        ],
      },
      {
        kode: "KB",
        navn: "Jord",
        maler: [
          { id: "kb10", navn: "Planering", referanse: "KB10", kategori: "sjekkliste", domene: "kvalitet" },
          { id: "kb2", navn: "Vegetasjon", referanse: "KB2", kategori: "sjekkliste", domene: "kvalitet" },
          { id: "kb-oppg", navn: "Jord oppgave", referanse: "KB9", kategori: "oppgave", domene: "kvalitet" },
        ],
      },
    ],
  },
];

describe("byggSitedocGrupper — kollaps på standard, kapittel som etikett, referanse-orden (Del C)", () => {
  it("én gruppe per standard, ikke per kapittel", () => {
    const grupper = byggSitedocGrupper(standarder, "sjekkliste");
    expect(grupper).toHaveLength(1);
    expect(grupper[0]!.key).toBe("NS3420-K");
    expect(grupper[0]!.tittel).toBe("NS3420-K — NS 3420-K Anleggsgartner");
  });

  it("malene sorteres kapittel-for-kapittel og på referanse (numerisk: KB2 før KB10)", () => {
    const grupper = byggSitedocGrupper(standarder, "sjekkliste");
    // KA før KB (server-sortering), referanse-orden innen kapitlet, oppgavemalen filtrert bort.
    expect(grupper[0]!.maler.map((m) => m.id)).toEqual(["ka2", "ka7", "kb2", "kb10"]);
  });

  it("hver mal bærer sin kapittel-etikett så render kan skyte inn underoverskrift", () => {
    const grupper = byggSitedocGrupper(standarder, "sjekkliste");
    const etikett = Object.fromEntries(
      grupper[0]!.maler.map((m) => [m.id, `${m.kapittelKode} ${m.kapittelNavn}`]),
    );
    expect(etikett["ka2"]).toBe("KA Innledende");
    expect(etikett["kb10"]).toBe("KB Jord");
  });
});

describe("byggSitedocGrupper + filtrerOgFold — søket omgår aldri typefilteret (Krav 3)", () => {
  it("sjekkliste-flaten: oppgavemalen er filtrert bort FØR søk, så et søk på den gir null", () => {
    const grupper = byggSitedocGrupper(standarder, "sjekkliste").map((g) => ({
      key: g.key,
      tittel: g.tittel,
      rader: g.maler.map((m) => ({ id: m.id, sok: `${m.navn} ${m.referanse}`.toLowerCase() })),
    }));
    // Typefilteret har allerede fjernet oppgavemalen fra standard-gruppen.
    expect(grupper[0]!.rader.map((r) => r.id)).not.toContain("kb-oppg");

    // Søk som matcher oppgavemalens navn kan ikke hente den tilbake på sjekklisteflaten.
    const oppgaveTreff = filtrerOgFold(grupper, "oppgave", new Set());
    expect(oppgaveTreff.synlige).toHaveLength(0);

    // Søk på en sjekklistemal (i sammenslått gruppe) folder standarden ut.
    const sjekkTreff = filtrerOgFold(grupper, "vegetasjon", new Set());
    expect(sjekkTreff.synlige).toHaveLength(1);
    expect(sjekkTreff.synlige[0]!.apen).toBe(true);
    expect(sjekkTreff.synlige[0]!.rader.map((r) => r.id)).toEqual(["kb2"]);
  });
});

/* ---- Del C: firma-fanen — samme standard-modell (utleder standard/kapittel fra lånet) ---- */

describe("grupperFirmaMaler — kollaps på standard + «Egenlagde» sist", () => {
  const indeks = byggKildeIndeks(standarder);

  it("lånte firmamaler grupperes under kildens standard, sortert på kapittel+referanse", () => {
    const firma = [
      { id: "f-kb2", laantFraBibliotekMalId: "kb2" }, // KB
      { id: "f-ka7", laantFraBibliotekMalId: "ka7" }, // KA
      { id: "f-egen", laantFraBibliotekMalId: null }, // egenlagd
      { id: "f-ukjent", laantFraBibliotekMalId: "finnes-ikke" }, // ukjent kilde → egenlagd
    ];
    const grupper = grupperFirmaMaler(firma, indeks, "Egenlagde");

    expect(grupper).toHaveLength(2);
    // Standard-gruppen først, «Egenlagde» sist.
    expect(grupper[0]!.key).toBe("NS3420-K");
    expect(grupper[0]!.tittel).toBe("NS3420-K — NS 3420-K Anleggsgartner");
    // KA (sort 0) før KB (sort 1) — kapittel-for-kapittel.
    expect(grupper[0]!.maler.map((m) => m.id)).toEqual(["f-ka7", "f-kb2"]);
    expect(grupper[0]!.maler[0]!.kapittelKode).toBe("KA");
    expect(grupper[0]!.maler[1]!.kapittelKode).toBe("KB");

    expect(grupper[1]!.key).toBe(EGENLAGDE_KEY);
    expect(grupper[1]!.maler.map((m) => m.id)).toEqual(["f-egen", "f-ukjent"]);
    // Egenlagde har ingen kapittel-etikett → ingen underoverskrift i render.
    expect(grupper[1]!.maler[0]!.kapittelKode).toBeNull();
  });

  it("kilde-indeksen bærer standard + arvet referanse firma-søket treffer på", () => {
    expect(indeks.get("ka7")?.standardKode).toBe("NS3420-K");
    expect(indeks.get("ka7")?.referanse).toBe("KA7");
  });
});

/* ---- Underkapittel-overskrift kun ved >= terskel (Kenneth 16.09) ---- */

describe("byggUnderkapittelBlokker — kollaps kun på kapittel, underkapittel-overskrift ved 3+", () => {
  const mal = (id: string, kode: string | null, navn: string | null) => ({
    id,
    kapittelKode: kode,
    kapittelNavn: navn,
  });

  it("underkapittel med 3+ maler → egen kollapsbar blokk; < 3 → løse maler uten overskrift", () => {
    // Dagens data: KA=1, KB=3, KC=1, KD=1 → BARE KB utløser unntaket.
    const maler = [
      mal("ka7", "KA", "Innledende"),
      mal("kb2", "KB", "Jord og vegetasjon"),
      mal("kb4", "KB", "Jord og vegetasjon"),
      mal("kb6", "KB", "Jord og vegetasjon"),
      mal("kc31", "KC", "Vanning"),
      mal("kd1", "KD", "Belegg"),
    ];
    const blokker = byggUnderkapittelBlokker(maler, "NS3420-K");

    // KA løs · KB-overskrift · KC+KD løse (slått sammen, referanserekkefølge bevart).
    expect(blokker.map((b) => b.type)).toEqual(["lose", "underkapittel", "lose"]);
    expect(blokker[0]).toMatchObject({ type: "lose" });
    expect(blokker[0]!.maler.map((m) => m.id)).toEqual(["ka7"]);

    const kb = blokker[1]!;
    expect(kb.type).toBe("underkapittel");
    if (kb.type === "underkapittel") {
      expect(kb.key).toBe("NS3420-K:KB");
      expect(kb.kode).toBe("KB");
      expect(kb.navn).toBe("Jord og vegetasjon");
      expect(kb.maler.map((m) => m.id)).toEqual(["kb2", "kb4", "kb6"]);
    }

    expect(blokker[2]!.maler.map((m) => m.id)).toEqual(["kc31", "kd1"]);
  });

  it("nøyaktig 2 i et underkapittel → ingen overskrift (terskel er 3)", () => {
    const blokker = byggUnderkapittelBlokker(
      [mal("fb2", "FB", "x"), mal("fb4", "FB", "x")],
      "NS3420-F",
    );
    expect(blokker).toHaveLength(1);
    expect(blokker[0]!.type).toBe("lose");
  });

  it("egenlagde (kapittelKode = null) får ALDRI overskrift, selv med 3+", () => {
    const blokker = byggUnderkapittelBlokker(
      [mal("e1", null, null), mal("e2", null, null), mal("e3", null, null)],
      "__egenlagde__",
    );
    expect(blokker).toHaveLength(1);
    expect(blokker[0]!.type).toBe("lose");
  });

  it("under søk: filtrert liste under terskel mister overskriften (vedtak c)", () => {
    // KB filtrert ned til 1 treff → ingen overskrift lenger.
    const blokker = byggUnderkapittelBlokker([mal("kb2", "KB", "Jord")], "NS3420-K");
    expect(blokker[0]!.type).toBe("lose");
  });
});
