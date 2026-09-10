import { describe, it, expect } from "vitest";
import { kollisjonsmerge } from "./kollisjonsmerge";

const felt = (verdi: unknown, extra: Record<string, unknown> = {}) => ({
  verdi,
  kommentar: "",
  vedlegg: [],
  ...extra,
});

const base = {
  brukerNavn: "Kari",
  brukerId: "u-kari",
  naa: "2026-09-08T10:00:00+02:00",
};

describe("kollisjonsmerge — feltvis deteksjon + tilføyelse", () => {
  it("ulike felt merges uten kollisjon", () => {
    const eksisterende = { a: felt("Anne fylte A"), b: felt("") };
    const innData = { b: felt("Kari fyller B") };
    const { merget, kollisjoner } = kollisjonsmerge({
      eksisterende,
      innData,
      base: { b: "" },
      appendOnly: false,
      ...base,
    });
    expect(kollisjoner).toHaveLength(0);
    expect((merget.a as { verdi: unknown }).verdi).toBe("Anne fylte A");
    expect((merget.b as { verdi: unknown }).verdi).toBe("Kari fyller B");
  });

  it("samme felt: server flyttet seg → tilføyelse + bevart verdi (den som kom først står)", () => {
    // Kari trodde feltet var tomt, men Anne rakk å skrive «Anne» først.
    const eksisterende = { f: felt("Anne") };
    const innData = { f: felt("Kari") };
    const { merget, kollisjoner } = kollisjonsmerge({
      eksisterende,
      innData,
      base: { f: "" },
      appendOnly: false,
      ...base,
    });
    expect(kollisjoner).toEqual([{ feltId: "f", verdi: "Kari" }]);
    const f = merget.f as { verdi: unknown; tilfoyelser: unknown[] };
    expect(f.verdi).toBe("Anne"); // bevart
    expect(f.tilfoyelser).toEqual([
      { verdi: "Kari", brukerNavn: "Kari", brukerId: "u-kari", tidspunkt: base.naa },
    ]);
  });

  it("tilføyelsen passerer append-only på en sendt oppgave (verdi uendret)", () => {
    // Oppgave sendt (appendOnly): feltet er utfylt, Kari prøver å endre → blir tilføyelse,
    // ikke throw. Ingen base-mismatch kreves — eksisterende verdi ER førsteskriveren.
    const eksisterende = { f: felt("Utført av Anne") };
    const innData = { f: felt("Kari overstyrer") };
    const { merget, kollisjoner } = kollisjonsmerge({
      eksisterende,
      innData,
      base: { f: "Utført av Anne" }, // Kari SÅ verdien, men prøver likevel å endre
      appendOnly: true,
      ...base,
    });
    expect(kollisjoner).toHaveLength(1);
    const f = merget.f as { verdi: unknown; tilfoyelser: unknown[] };
    expect(f.verdi).toBe("Utført av Anne");
    expect(f.tilfoyelser).toHaveLength(1);
  });

  it("base-verdi som matcher serveren gir normal skriving (ingen kollisjon)", () => {
    const eksisterende = { f: felt("gammel") };
    const innData = { f: felt("ny") };
    const { merget, kollisjoner } = kollisjonsmerge({
      eksisterende,
      innData,
      base: { f: "gammel" }, // server === base → server flyttet seg ikke
      appendOnly: false,
      ...base,
    });
    expect(kollisjoner).toHaveLength(0);
    expect((merget.f as { verdi: unknown }).verdi).toBe("ny");
  });

  it("klienten endret ikke verdien, men serveren flyttet seg → server-verdi beholdes (ikke klobbet)", () => {
    // Kari endret bare kommentaren; verdien lot hun stå. Serveren har fått ny verdi imens.
    const eksisterende = { f: felt("Annes verdi") };
    const innData = { f: felt("tom", { kommentar: "Karis notat" }) };
    const { merget, kollisjoner } = kollisjonsmerge({
      eksisterende,
      innData,
      base: { f: "tom" }, // Karis base = det hun trodde og fortsatt sender
      appendOnly: false,
      ...base,
    });
    expect(kollisjoner).toHaveLength(0);
    const f = merget.f as { verdi: unknown; kommentar: unknown };
    expect(f.verdi).toBe("Annes verdi"); // ikke klobbet
    expect(f.kommentar).toBe("Karis notat"); // kommentar-tilføyelsen beholdt
  });

  it("server-only-nøkler (tilfoyelser, grenseSnapshot) bæres fram ved normal skriving", () => {
    const eksisterende = {
      f: felt("gammel", { grenseSnapshot: { status: "ok" }, tilfoyelser: [{ verdi: "x" }] }),
    };
    const innData = { f: felt("ny") };
    const { merget } = kollisjonsmerge({
      eksisterende,
      innData,
      base: { f: "gammel" },
      appendOnly: false,
      ...base,
    });
    const f = merget.f as Record<string, unknown>;
    expect(f.verdi).toBe("ny");
    expect(f.grenseSnapshot).toEqual({ status: "ok" });
    expect(f.tilfoyelser).toEqual([{ verdi: "x" }]);
  });

  it("begge kom fram til samme verdi → ingen kollisjon", () => {
    const eksisterende = { f: felt("42") };
    const innData = { f: felt("42") };
    const { kollisjoner } = kollisjonsmerge({
      eksisterende,
      innData,
      base: { f: "" }, // trodde tomt, men endte likt → ingen tapende verdi
      appendOnly: false,
      ...base,
    });
    expect(kollisjoner).toHaveLength(0);
  });

  it("manglende base for feltet (eldre payload): sjekkliste faller til normal skriving", () => {
    const eksisterende = { f: felt("Anne") };
    const innData = { f: felt("Kari") };
    const { merget, kollisjoner } = kollisjonsmerge({
      eksisterende,
      innData,
      base: {}, // ingen base for f
      appendOnly: false,
      ...base,
    });
    expect(kollisjoner).toHaveLength(0);
    expect((merget.f as { verdi: unknown }).verdi).toBe("Kari"); // blind merge, som før
  });

  it("kollisjon bevarer tidligere tilføyelser (appender, overskriver ikke)", () => {
    const eksisterende = {
      f: felt("Anne", { tilfoyelser: [{ verdi: "Per", brukerNavn: "Per", brukerId: "u-per", tidspunkt: "t0" }] }),
    };
    const innData = { f: felt("Kari") };
    const { merget } = kollisjonsmerge({
      eksisterende,
      innData,
      base: { f: "" },
      appendOnly: false,
      ...base,
    });
    const f = merget.f as { tilfoyelser: unknown[] };
    expect(f.tilfoyelser).toHaveLength(2);
  });
});

// Produksjonsform `{ _radId, felter }` — testes FØRST (SAMARBEIDSREGLER: fire feil bak grønn gate).
const rad = (id: string, felter: Record<string, unknown>) => ({ _radId: id, felter });
const raderVerdi = (rader: unknown[]) => felt(rader);

describe("kollisjonsmerge — repeater celle-nivå", () => {
  it("legg til rad mens server har en annen versjon → INGEN kollisjon (Kenneths funn)", () => {
    // base: én rad. server: den + en rad web la til. inn: den + en NY tom rad mobil la til.
    const eksisterende = {
      rep: raderVerdi([
        rad("r1", { a: felt("X") }),
        rad("rWeb", { a: felt("web-rad") }),
      ]),
    };
    const innData = {
      rep: raderVerdi([rad("r1", { a: felt("X") }), rad("r2", { a: felt("") })]),
    };
    const { merget, kollisjoner } = kollisjonsmerge({
      eksisterende,
      innData,
      base: { rep: [rad("r1", { a: felt("X") })] },
      appendOnly: false,
      ...base,
    });
    expect(kollisjoner).toHaveLength(0);
    const rader = (merget.rep as { verdi: Array<{ _radId: string }> }).verdi;
    // r1 (merget) + r2 (ny) + rWeb (server-only, bevart mot tap)
    expect(rader.map((r) => r._radId).sort()).toEqual(["r1", "r2", "rWeb"]);
  });

  it("tom celle i en ny rad → aldri kollisjon", () => {
    const eksisterende = { rep: raderVerdi([rad("r1", { a: felt("Anne") })]) };
    const innData = {
      rep: raderVerdi([rad("r1", { a: felt("Anne") }), rad("r2", { a: felt("") })]),
    };
    const { kollisjoner } = kollisjonsmerge({
      eksisterende,
      innData,
      base: { rep: [rad("r1", { a: felt("Anne") })] },
      appendOnly: false,
      ...base,
    });
    expect(kollisjoner).toHaveLength(0);
  });

  it("samme celle endret begge steder → kollisjon med LESBAR skalarverdi + bevart server-verdi", () => {
    // Kari trodde cella var tom; Anne rakk å skrive «Anne» i samme celle først.
    const eksisterende = { rep: raderVerdi([rad("r1", { a: felt("Anne") })]) };
    const innData = { rep: raderVerdi([rad("r1", { a: felt("Kari") })]) };
    const { merget, kollisjoner } = kollisjonsmerge({
      eksisterende,
      innData,
      base: { rep: [rad("r1", { a: felt("") })] },
      appendOnly: false,
      ...base,
    });
    // Rapportert på repeaterens feltId, verdi er cellas skalar (ikke rå rad-JSON).
    expect(kollisjoner).toEqual([{ feltId: "rep", verdi: "Kari" }]);
    const rader = (merget.rep as { verdi: Array<{ felter: Record<string, { verdi: unknown; tilfoyelser?: unknown[] }> }> }).verdi;
    const celle = rader[0]!.felter.a!;
    expect(celle.verdi).toBe("Anne"); // den som kom først står
    expect(celle.tilfoyelser).toEqual([
      { verdi: "Kari", brukerNavn: "Kari", brukerId: "u-kari", tidspunkt: base.naa },
    ]);
  });

  it("ulike celler i SAMME rad endret hver sin plass → ingen kollisjon (celle, ikke rad)", () => {
    // Anne fylte b på server; Kari fyller a. Samme rad, ulik celle → skal IKKE kollidere.
    const eksisterende = { rep: raderVerdi([rad("r1", { a: felt(""), b: felt("Anne-b") })]) };
    const innData = { rep: raderVerdi([rad("r1", { a: felt("Kari-a"), b: felt("Anne-b") })]) };
    const { merget, kollisjoner } = kollisjonsmerge({
      eksisterende,
      innData,
      base: { rep: [rad("r1", { a: felt(""), b: felt("Anne-b") })] },
      appendOnly: false,
      ...base,
    });
    expect(kollisjoner).toHaveLength(0);
    const celler = (merget.rep as { verdi: Array<{ felter: Record<string, { verdi: unknown }> }> }).verdi[0]!.felter;
    expect(celler.a!.verdi).toBe("Kari-a");
    expect(celler.b!.verdi).toBe("Anne-b");
  });

  it("sletting av UENDRET rad honoreres (raden fjernes)", () => {
    const uendretRad = rad("r2", { a: felt("gammel") });
    const eksisterende = { rep: raderVerdi([rad("r1", { a: felt("X") }), uendretRad]) };
    const innData = { rep: raderVerdi([rad("r1", { a: felt("X") })]) }; // r2 slettet
    const { merget, kollisjoner } = kollisjonsmerge({
      eksisterende,
      innData,
      base: { rep: [rad("r1", { a: felt("X") }), uendretRad] },
      appendOnly: false,
      ...base,
    });
    expect(kollisjoner).toHaveLength(0);
    const rader = (merget.rep as { verdi: Array<{ _radId: string }> }).verdi;
    expect(rader.map((r) => r._radId)).toEqual(["r1"]);
  });

  it("sletting av rad som motparten ENDRET → raden BEVARES (lukker runde-48-hullet)", () => {
    // A sletter r2 offline; B fyller r2 på server imens. A kommer på nett → r2 må ikke tapes.
    const eksisterende = { rep: raderVerdi([rad("r1", { a: felt("X") }), rad("r2", { a: felt("B fylte den") })]) };
    const innData = { rep: raderVerdi([rad("r1", { a: felt("X") })]) }; // r2 slettet av A
    const { merget, kollisjoner } = kollisjonsmerge({
      eksisterende,
      innData,
      base: { rep: [rad("r1", { a: felt("X") }), rad("r2", { a: felt("gammel") })] },
      appendOnly: false,
      ...base,
    });
    expect(kollisjoner).toHaveLength(0);
    const rader = (merget.rep as { verdi: Array<{ _radId: string; felter: Record<string, { verdi: unknown }> }> }).verdi;
    expect(rader.map((r) => r._radId).sort()).toEqual(["r1", "r2"]);
    expect(rader.find((r) => r._radId === "r2")!.felter.a!.verdi).toBe("B fylte den");
  });

  it("rad motparten la til (i server, ikke i base/inn) → bevares", () => {
    const eksisterende = { rep: raderVerdi([rad("r1", { a: felt("X") }), rad("rWeb", { a: felt("web") })]) };
    const innData = { rep: raderVerdi([rad("r1", { a: felt("X") })]) };
    const { merget } = kollisjonsmerge({
      eksisterende,
      innData,
      base: { rep: [rad("r1", { a: felt("X") })] }, // rWeb var ikke i basen A så
      appendOnly: false,
      ...base,
    });
    const rader = (merget.rep as { verdi: Array<{ _radId: string }> }).verdi;
    expect(rader.map((r) => r._radId).sort()).toEqual(["r1", "rWeb"]);
  });
});
