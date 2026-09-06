import { describe, it, expect } from "vitest";
import { tilbehorVisning } from "../RapportObjektRenderer";

/**
 * Funn 6 (Kenneth-vedtak 2026-08-22): tilbehør fjernes fra nyregistrering på
 * date/date_time/drawing_position/location (ren fjerning) + repeater (read-only kun m/data).
 * «Øvrige felttyper beholder tilbehør». Speiler mobil-helperen (samme logikk).
 *
 * `signature` lagt til i deny-lista 2026-09-05 (fabel/Kenneth-krav): en signatur ER sin
 * egen dokumentasjon — ikke bilde/galleri/+Oppgave/filopplasting i nyregistrering.
 * Behandles som de øvrige fire (Option A): fjernet i utfylling, men i et FERDIG dokument
 * (global lesemodus) får FeltDokumentasjon lov og self-hider når den er tom — så en
 * pre-05.09-signatur med historisk kommentar/vedlegg beholder read-only-visningen.
 */
describe("tilbehorVisning — funn 6 deny-list per felttype", () => {
  const FJERNET = ["date", "date_time", "drawing_position", "location", "signature"];

  it("deny-typene: ren fjerning i utfylling (vis=false)", () => {
    for (const t of FJERNET) {
      expect(tilbehorVisning(t, false, false)).toEqual({ vis: false, leseModus: false });
      // også når feltet skulle hatt data: fortsatt fjernet i nyregistrering
      expect(tilbehorVisning(t, false, true)).toEqual({ vis: false, leseModus: false });
    }
  });

  it("deny-typene: i global lesemodus (ferdig dokument) vises de normalt read-only", () => {
    for (const t of FJERNET) {
      expect(tilbehorVisning(t, true, false)).toEqual({ vis: true, leseModus: true });
    }
  });

  it("repeater: read-only, men KUN når det finnes eksisterende data", () => {
    expect(tilbehorVisning("repeater", false, true)).toEqual({ vis: true, leseModus: true });
    expect(tilbehorVisning("repeater", false, false)).toEqual({ vis: false, leseModus: true });
    // også i global lese: skjules om tomt (unngår tom ramme på mobil)
    expect(tilbehorVisning("repeater", true, false)).toEqual({ vis: false, leseModus: true });
  });

  it("øvrige felttyper (text_field): beholder tilbehør, redigerbart i utfylling", () => {
    expect(tilbehorVisning("text_field", false, false)).toEqual({ vis: true, leseModus: false });
    expect(tilbehorVisning("text_field", false, true)).toEqual({ vis: true, leseModus: false });
    // global lese → read-only
    expect(tilbehorVisning("text_field", true, false)).toEqual({ vis: true, leseModus: true });
  });

  it("øvrige (integer/select osv.) uendret", () => {
    for (const t of ["integer", "list_single", "traffic_light"]) {
      expect(tilbehorVisning(t, false, false)).toEqual({ vis: true, leseModus: false });
    }
  });
});
