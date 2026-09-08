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
