/**
 * O17 (vedtak-timer-web.md § Reisevinduet pkt 21): eksportens fra/til-sted. En reise mellom to
 * kontorer (tur 3) får «Til» = til-kontoret; før O17 ble «Til» tom (ingen byggeplass).
 */
import { describe, expect, it } from "vitest";
import { reiseFraTilSted } from "./reise-steder";

const KONTOR: Record<string, string> = { kt: "Tromsø", kn: "Narvik kontor" };
const BYGG: Record<string, string> = { b1: "Blokk A" };
const kontorNavn = (id: string | null) => (id ? (KONTOR[id] ?? null) : null);
const byggNavn = (id: string | null) => (id ? (BYGG[id] ?? null) : null);
const kontor = (id: string) => ({ type: "kontor", oppmotestedId: id });

describe("O17 pkt 21 — reiseFraTilSted", () => {
  it("tur 3 kontor → kontor: fraSted Tromsø, tilSted Narvik kontor", () => {
    expect(
      reiseFraTilSted(
        { reiseRetning: "ut", reiseOppmotestedId: "kt", byggeplassId: null, reiseRegel: { overforing: { fra: kontor("kt"), til: kontor("kn"), periodeId: "p1" } } },
        kontorNavn,
        byggNavn,
      ),
    ).toEqual({ fraSted: "Tromsø", tilSted: "Narvik kontor" });
  });

  it("tur 3 som retur: ruten bestemmer, ikke retningen", () => {
    expect(
      reiseFraTilSted(
        { reiseRetning: "retur", reiseOppmotestedId: "kn", byggeplassId: null, reiseRegel: { overforing: { fra: kontor("kn"), til: kontor("kt"), periodeId: null } } },
        kontorNavn,
        byggNavn,
      ),
    ).toEqual({ fraSted: "Narvik kontor", tilSted: "Tromsø" });
  });

  it("vakt: ut/retur mot byggeplass er uendret", () => {
    const r = { reiseOppmotestedId: "kt", byggeplassId: "b1", reiseRegel: {} };
    expect(reiseFraTilSted({ ...r, reiseRetning: "ut" }, kontorNavn, byggNavn)).toEqual({ fraSted: "Tromsø", tilSted: "Blokk A" });
    expect(reiseFraTilSted({ ...r, reiseRetning: "retur" }, kontorNavn, byggNavn)).toEqual({ fraSted: "Blokk A", tilSted: "Tromsø" });
  });

  it("vakt: L2 kontor → byggeplass (overforing med byggeplass-ende) er uendret", () => {
    expect(
      reiseFraTilSted(
        { reiseRetning: "ut", reiseOppmotestedId: "kt", byggeplassId: "b1", reiseRegel: { overforing: { fra: kontor("kt"), til: { type: "byggeplass", projectId: "p1" } } } },
        kontorNavn,
        byggNavn,
      ),
    ).toEqual({ fraSted: "Tromsø", tilSted: "Blokk A" });
  });

  it("vakt: null retning (gammel backfill) gir begge null", () => {
    expect(reiseFraTilSted({ reiseRetning: null, reiseOppmotestedId: "kt", byggeplassId: "b1", reiseRegel: null }, kontorNavn, byggNavn)).toEqual({
      fraSted: null,
      tilSted: null,
    });
  });
});
