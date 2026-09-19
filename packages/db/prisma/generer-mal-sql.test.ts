import { describe, it, expect } from "vitest";
import { byggMalSql, filnavnFor, malRegister } from "./generer-mal-sql";
import { KD2_MAL, KM2_MAL } from "./seed-bibliotek";

/**
 * Ren unit-test (ingen DB) for den generelle mal-SQL-generatoren (MAL-METODE §1b pkt 4).
 * Låser skillet mellom modusene: `ny` INSERT-er en fersk mal (version 1, ingen DELETE),
 * `revisjon` bumper versjonen og bytter objekt-radene (DELETE + INSERT). Begge bærer §6a-
 * tekstbeviset (`\x on`).
 */

const KD2 = KD2_MAL as unknown as Parameters<typeof byggMalSql>[0];
const KM2 = KM2_MAL as unknown as Parameters<typeof byggMalSql>[0];

describe("generer-mal-sql", () => {
  it("ny: version-verdi 1, INGEN DELETE, \\x on", () => {
    const s = byggMalSql(KD2, "ny");
    expect(s).toContain("INSERT INTO bibliotek_maler");
    expect(s).toContain("false, 1, '[]'::jsonb"); // verifisert=false, version=1, mal_innhold='[]'
    expect(s).not.toContain("DELETE");
    expect(s).not.toContain("version = version + 1");
    expect(s).toContain("\\x on");
    expect(s).toContain("BEGIN;");
    expect(s).toContain("COMMIT;");
  });

  it("revisjon: version = version + 1, DELETE av objekt-rader, \\x on", () => {
    const s = byggMalSql(KD2, "revisjon");
    expect(s).toContain("version = version + 1");
    expect(s).toContain("DELETE FROM bibliotek_mal_objekter");
    expect(s).not.toContain("INSERT INTO bibliotek_maler"); // revisjon rører kun metadata + rader
    expect(s).toContain("\\x on");
  });

  it("begge modus bygger objekt-radene fra mal-konstanten (heading + felt)", () => {
    for (const modus of ["ny", "revisjon"] as const) {
      const s = byggMalSql(KD2, modus);
      expect(s).toContain("'heading', 'Kontroll FØR utførelse'");
      expect(s).toContain("'list_single', 'Kantsteinstype'");
      expect(s).toContain("'integer', 'Største sprang ved fuger (mm)'");
    }
  });

  it("filnavn: <ref> → <ref>-test.sql med punktum fjernet", () => {
    expect(filnavnFor("KD2")).toBe("kd2-test.sql");
    expect(filnavnFor("KC3.1")).toBe("kc31-test.sql");
  });

  it("registeret finner KD2 blant de eksporterte *_MAL-konstantene", () => {
    expect(malRegister().get("KD2")?.referanse).toBe("KD2");
  });

  // Ordre KM2 §4: modus `ny` skal opprette et manglende kapittel i samme transaksjon,
  // og gjenbruke det hvis det finnes. Begge tilfeller emitterer samme idempotente INSERT
  // (WHERE NOT EXISTS) — testen dekker kapittel som IKKE finnes (KM) og som finnes (KD).
  it("ny: oppretter manglende kapittel KM i samme transaksjon (idempotent, WHERE NOT EXISTS)", () => {
    const s = byggMalSql(KM2, "ny");
    expect(s).toContain("INSERT INTO bibliotek_kapitler");
    expect(s).toContain("'KM', 'Murer i terreng', 5");
    // Idempotent: gjenbrukes hvis det finnes.
    expect(s).toMatch(/NOT EXISTS[\s\S]*bibliotek_kapitler k WHERE k\.standard_id = s\.id AND k\.kode = 'KM'/);
    // Kapittel-INSERT kommer FØR mal-INSERT (rekkefølge — malen må ha et kapittel å henge på).
    expect(s.indexOf("INSERT INTO bibliotek_kapitler")).toBeLessThan(s.indexOf("INSERT INTO bibliotek_maler"));
  });

  it("ny: eksisterende kapittel KD gjenbrukes — samme idempotente INSERT emitteres", () => {
    const s = byggMalSql(KD2, "ny");
    expect(s).toContain("INSERT INTO bibliotek_kapitler");
    expect(s).toContain("'KD', 'Utendørsbelegg, kanter, renner', 4");
    expect(s).toMatch(/NOT EXISTS[\s\S]*k\.kode = 'KD'/);
  });

  it("revisjon rører aldri kapittel-tabellen (kapittelet finnes allerede)", () => {
    expect(byggMalSql(KM2, "revisjon")).not.toContain("bibliotek_kapitler");
    expect(byggMalSql(KD2, "revisjon")).not.toContain("bibliotek_kapitler");
  });
});
