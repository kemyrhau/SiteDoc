import { describe, it, expect } from "vitest";
import { frysGrenseSnapshots } from "./grenseLagring";

const felt = (verdi: unknown, extra: Record<string, unknown> = {}) => ({
  verdi,
  kommentar: "",
  vedlegg: [],
  ...extra,
});
const hoyst = (id: string, maks: number, enhet = "mm") => ({
  id,
  type: "decimal",
  config: { maks, enhet, kravType: "hoyst" },
});

describe("frysGrenseSnapshots — server-frys ved lagring", () => {
  it("ny verdi på tallfelt med grense: snapshot skrives sidestilt, verdi urørt", () => {
    const merget: Record<string, unknown> = { h: felt(14) };
    frysGrenseSnapshots(merget, {}, [hoyst("h", 10)]);
    expect((merget.h as Record<string, unknown>).verdi).toBe(14);
    expect((merget.h as Record<string, unknown>).grenseSnapshot).toEqual({
      kravTekst: "≤ 10 mm",
      status: "over",
      avvikTekst: "Avvik: 4 mm over krav",
    });
  });

  it("uendret verdi: eksisterende (frosne) snapshot bæres frem, ikke rekomputert", () => {
    const eksisterende = { h: felt(14, { grenseSnapshot: { kravTekst: "≤ 99 mm", status: "ok" } }) };
    // klienten stripper snapshotet på tråden → merget.h mangler det
    const merget: Record<string, unknown> = { h: felt(14) };
    frysGrenseSnapshots(merget, eksisterende, [hoyst("h", 10)]);
    // verdi uendret → behold det gamle kravet (≤ 99), ikke dagens mal (≤ 10)
    expect((merget.h as Record<string, unknown>).grenseSnapshot).toEqual({
      kravTekst: "≤ 99 mm",
      status: "ok",
    });
  });

  it("endret verdi: nytt snapshot mot gjeldende mal (frys ved måletidspunkt)", () => {
    const eksisterende = { h: felt(5, { grenseSnapshot: { kravTekst: "≤ 10 mm", status: "ok" } }) };
    const merget: Record<string, unknown> = { h: felt(14) };
    frysGrenseSnapshots(merget, eksisterende, [hoyst("h", 10)]);
    expect((merget.h as Record<string, unknown>).grenseSnapshot).toEqual({
      kravTekst: "≤ 10 mm",
      status: "over",
      avvikTekst: "Avvik: 4 mm over krav",
    });
  });

  it("tomt felt med grense: kravet snapshotes likevel (F7), status null", () => {
    const merget: Record<string, unknown> = { h: felt(null) };
    frysGrenseSnapshots(merget, {}, [hoyst("h", 15)]);
    expect((merget.h as Record<string, unknown>).grenseSnapshot).toEqual({
      kravTekst: "≤ 15 mm",
      status: null,
    });
  });

  it("felt uten grense: intet snapshot", () => {
    const merget: Record<string, unknown> = { t: felt(3) };
    frysGrenseSnapshots(merget, {}, [{ id: "t", type: "integer", config: { enhet: "stk" } }]);
    expect((merget.t as Record<string, unknown>).grenseSnapshot).toBeUndefined();
  });

  it("Vei B: styrende søsken-verdi løser grensen ved lagring", () => {
    const merget: Record<string, unknown> = { u: felt("sprengstein"), h: felt(20) };
    frysGrenseSnapshots(merget, {}, [
      { id: "u", type: "list_single", config: { options: ["pukk", "sprengstein"] } },
      {
        id: "h",
        type: "decimal",
        config: { maks: 10, enhet: "mm", styrendeFeltId: "u", grenseVarianter: [{ valg: "sprengstein", maks: 25 }] },
      },
    ]);
    expect((merget.h as Record<string, unknown>).grenseSnapshot).toEqual({ kravTekst: "≤ 25 mm", status: "ok" });
  });

  it("repeater-rader: snapshot per rad, uendret rad bærer frem gammelt snapshot (match på _radId)", () => {
    const objekter = [{ id: "rep", type: "repeater", config: {} }, hoyst("h", 10)];
    const eksisterende = {
      rep: felt([{ _radId: "r1", felter: { h: felt(5, { grenseSnapshot: { kravTekst: "≤ 10 mm", status: "ok" } }) } }]),
    };
    const merget: Record<string, unknown> = {
      rep: felt([
        { _radId: "r1", felter: { h: felt(5) } }, // uendret → behold gammelt
        { _radId: "r2", felter: { h: felt(14) } }, // ny rad → over
      ]),
    };
    frysGrenseSnapshots(merget, eksisterende, objekter);
    const rader = (merget.rep as { verdi: Array<{ felter: Record<string, { grenseSnapshot?: unknown }> }> }).verdi;
    expect(rader[0]!.felter.h!.grenseSnapshot).toEqual({ kravTekst: "≤ 10 mm", status: "ok" });
    expect(rader[1]!.felter.h!.grenseSnapshot).toEqual({
      kravTekst: "≤ 10 mm",
      status: "over",
      avvikTekst: "Avvik: 4 mm over krav",
    });
  });

  it("mal uten tallfelt: no-op (returnerer uten å røre data)", () => {
    const merget: Record<string, unknown> = { t: felt("hei") };
    frysGrenseSnapshots(merget, {}, [{ id: "t", type: "text_field", config: {} }]);
    expect(merget.t).toEqual(felt("hei"));
  });
});
