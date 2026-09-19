import { describe, it, expect } from "vitest";
import { byggMalSql, byggFlerRevisjonSql, filnavnFor, malRegister } from "./generer-mal-sql";
import { KA7_MAL, KB2_MAL, KD2_MAL, KM2_MAL, FD1_MAL } from "./seed-bibliotek";

/**
 * Ren unit-test (ingen DB) for den generelle mal-SQL-generatoren (MAL-METODE §1b pkt 4).
 * Låser skillet mellom modusene: `ny` INSERT-er en fersk mal (version 1, ingen DELETE),
 * `revisjon` bumper versjonen og bytter objekt-radene (DELETE + INSERT). Begge bærer §6a-
 * tekstbeviset (`\x on`).
 */

const KD2 = KD2_MAL as unknown as Parameters<typeof byggMalSql>[0];
const KM2 = KM2_MAL as unknown as Parameters<typeof byggMalSql>[0];
const FD1 = FD1_MAL as unknown as Parameters<typeof byggMalSql>[0];

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

// Ordre §7b pkt 4: fler-referanse-revisjon i ÉN transaksjon, én fil, full utskrift av alle.
describe("byggFlerRevisjonSql", () => {
  const KA7 = KA7_MAL as unknown as Parameters<typeof byggMalSql>[0];
  const KB2 = KB2_MAL as unknown as Parameters<typeof byggMalSql>[0];

  it("én transaksjon (ett BEGIN, ett COMMIT) rundt flere revisjoner", () => {
    const s = byggFlerRevisjonSql([KA7, KB2, KD2]);
    expect(s.match(/BEGIN;/g)).toHaveLength(1);
    expect(s.match(/COMMIT;/g)).toHaveLength(1);
  });

  it("bumper version for HVER mal (version+1 per mal)", () => {
    const s = byggFlerRevisjonSql([KA7, KB2, KD2]);
    expect(s.match(/version = version \+ 1/g)).toHaveLength(3);
    expect(s.match(/DELETE FROM bibliotek_mal_objekter/g)).toHaveLength(3);
  });

  it("skriver full utskrift av alle malene før COMMIT (\\x on + metadata-SELECT per mal)", () => {
    const s = byggFlerRevisjonSql([KA7, KB2]);
    const commitIdx = s.indexOf("COMMIT;");
    for (const ref of ["KA7", "KB2"]) {
      expect(s.indexOf(`WHERE referanse = '${ref}';`)).toBeGreaterThan(-1);
    }
    expect(s.indexOf("\\x on")).toBeGreaterThan(-1);
    expect(s.indexOf("\\x on")).toBeLessThan(commitIdx);
  });

  it("bygger objekt-radene fra hver mal-konstant", () => {
    const s = byggFlerRevisjonSql([KA7, KB2]);
    expect(s).toContain("'list_single', 'Type materiale'"); // KA7 felt 1
    expect(s).toContain("'list_single', 'Formål / planteformål'"); // KB2 felt 1
    expect(s).toContain("'heading', 'Kontroll FØR utførelse'");
  });

  it("aldri INSERT i bibliotek_maler eller kapittel-tabellen (revisjon)", () => {
    const s = byggFlerRevisjonSql([KA7, KB2, KD2]);
    expect(s).not.toContain("INSERT INTO bibliotek_maler");
    expect(s).not.toContain("bibliotek_kapitler");
  });

  it("tom liste er en feil", () => {
    expect(() => byggFlerRevisjonSql([])).toThrow();
  });
});

// Ordre FD1 §5: standard slås opp per mal (K→NS3420-K, F→NS3420-F), og `--fra` (omkoding)
// legger en referanse-UPDATE FØR revisjonens DELETE — samme rad, lån beholdt.
describe("standard per mal + omkoding (--fra)", () => {
  it("K-mal (ny) gir fortsatt NS3420-K", () => {
    const s = byggMalSql(KD2, "ny");
    expect(s).toContain("s.kode = 'NS3420-K'");
    expect(s).not.toContain("NS3420-F");
  });

  it("FD1 (omkoding) gir NS3420-F", () => {
    const s = byggMalSql(FD1, "revisjon", { fraRef: "FB2" });
    expect(s).toContain("s.kode = 'NS3420-F'");
    expect(s).not.toContain("NS3420-K");
  });

  it("--fra: UPDATE ... referanse (omkoding) kommer FØR DELETE av objekt-radene", () => {
    const s = byggMalSql(FD1, "revisjon", { fraRef: "FB2" });
    expect(s).toContain("UPDATE bibliotek_maler SET\n  referanse = 'FD1'");
    expect(s).toContain("WHERE referanse = 'FB2'");
    const omkodingIdx = s.indexOf("referanse = 'FD1'");
    const deleteIdx = s.indexOf("DELETE FROM bibliotek_mal_objekter");
    expect(omkodingIdx).toBeGreaterThan(-1);
    expect(omkodingIdx).toBeLessThan(deleteIdx);
  });

  it("--fra: guard avbryter hvis FB2 mangler eller FD1 finnes; retter kapittelnavn og viser kapittel", () => {
    const s = byggMalSql(FD1, "revisjon", { fraRef: "FB2" });
    expect(s).toContain("FB2 finnes ikke i NS3420-F");
    expect(s).toContain("FD1 finnes allerede i NS3420-F");
    // Kapittelnavn rettet til normen (FB→Markrydding, FD→Uttak av løsmasser).
    expect(s).toContain("navn = 'Markrydding'");
    expect(s).toContain("navn = 'Uttak av løsmasser'");
    // Ekstra kapittel-utskrift (§5 pkt 4).
    expect(s).toContain("kapittel_navn");
  });

  it("revisjon UTEN --fra er uendret (ingen omkoding, ingen referanse-UPDATE)", () => {
    const s = byggMalSql(KD2, "revisjon");
    expect(s).not.toContain("Omkoding");
    expect(s).not.toContain("referanse = 'FB2'");
  });

  it("--fra i modus ny er en feil", () => {
    expect(() => byggMalSql(FD1, "ny", { fraRef: "FB2" })).toThrow();
  });

  it("registeret finner FD1 (F-mal) blant de eksporterte *_MAL-konstantene", () => {
    expect(malRegister().get("FD1")?.referanse).toBe("FD1");
  });
});
