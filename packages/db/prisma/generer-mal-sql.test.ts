import { describe, it, expect } from "vitest";
import { byggMalSql, byggFlerRevisjonSql, byggFlerNySql, filnavnFor, flerFilnavn, malRegister } from "./generer-mal-sql";
import { KA7_MAL, KB2_MAL, KD2_MAL, KM2_MAL, FD1_MAL, FD2_MAL, FS2_MAL, FH1_MAL, FS3_MAL, UM1_MAL, UU1_MAL } from "./seed-bibliotek";

/**
 * Ren unit-test (ingen DB) for den generelle mal-SQL-generatoren (MAL-METODE §1b pkt 4).
 * Låser skillet mellom modusene: `ny` INSERT-er en fersk mal (version 1, ingen DELETE),
 * `revisjon` bumper versjonen og bytter objekt-radene (DELETE + INSERT). Begge bærer §6a-
 * tekstbeviset (`\x on`).
 */

const KD2 = KD2_MAL as unknown as Parameters<typeof byggMalSql>[0];
const KM2 = KM2_MAL as unknown as Parameters<typeof byggMalSql>[0];
const FD1 = FD1_MAL as unknown as Parameters<typeof byggMalSql>[0];
const FS2 = FS2_MAL as unknown as Parameters<typeof byggMalSql>[0];
const FH1 = FH1_MAL as unknown as Parameters<typeof byggMalSql>[0];
const FS3 = FS3_MAL as unknown as Parameters<typeof byggMalSql>[0];
const UM1 = UM1_MAL as unknown as Parameters<typeof byggMalSql>[0];
const UU1 = UU1_MAL as unknown as Parameters<typeof byggMalSql>[0];

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

// Ordre FS2 §5: omkodingssporet (--fra) oppretter manglende MÅLKAPITTEL i samme transaksjon,
// før UPDATE … referanse, med samme WHERE NOT EXISTS som modus `ny`. FS2 flytter til nytt kapittel
// FS; FD1s mål (FD) finnes allerede → samme blokk er en no-op der.
describe("omkoding oppretter manglende målkapittel (--fra)", () => {
  it("FS2 --fra FD2: kapittel-INSERT (FS) kommer FØR UPDATE … referanse", () => {
    const s = byggMalSql(FS2, "revisjon", { fraRef: "FD2" });
    expect(s).toContain("INSERT INTO bibliotek_kapitler");
    expect(s).toContain("'FS', 'Utlegging av løsmasser', 6");
    expect(s).toMatch(/NOT EXISTS[\s\S]*k\.kode = 'FS'/);
    const kapIdx = s.indexOf("INSERT INTO bibliotek_kapitler");
    // Ankre på UPDATE-formen «referanse = 'FS2',» (komma) — guarden bruker «m.referanse = 'FS2'».
    const refIdx = s.indexOf("referanse = 'FS2',");
    expect(kapIdx).toBeGreaterThan(-1);
    expect(kapIdx).toBeLessThan(refIdx);
    // Guard + standard som FD1-mønsteret.
    expect(s).toContain("FD2 finnes ikke i NS3420-F");
    expect(s).toContain("FS2 finnes allerede i NS3420-F");
  });

  it("FD1 --fra FB2: samme kapittelblokk finnes nå (no-op for eksisterende FD), før UPDATE referanse", () => {
    // Valgt: FD1 får den samme (no-op) kapittelblokken — uniform kodevei, ikke byte-lik med før FS2.
    const s = byggMalSql(FD1, "revisjon", { fraRef: "FB2" });
    expect(s).toContain("INSERT INTO bibliotek_kapitler");
    expect(s).toContain("'FD', 'Uttak av løsmasser', 3");
    expect(s.indexOf("INSERT INTO bibliotek_kapitler")).toBeLessThan(s.indexOf("referanse = 'FD1',"));
  });

  it("FS2 gir NS3420-F og version+1 + DELETE (revisjon etter omkoding)", () => {
    const s = byggMalSql(FS2, "revisjon", { fraRef: "FD2" });
    expect(s).toContain("s.kode = 'NS3420-F'");
    expect(s).not.toContain("NS3420-K");
    expect(s).toContain("version = version + 1");
    expect(s).toContain("DELETE FROM bibliotek_mal_objekter");
  });

  it("registeret finner FS2 (F-mal)", () => {
    expect(malRegister().get("FS2")?.referanse).toBe("FS2");
  });
});

// Ordre FH1 §3/§5: omkoding sletter TOMT kildekapittel (NOT EXISTS-vakt) etter UPDATE referanse.
describe("omkoding sletter tomt kildekapittel (--fra)", () => {
  it("FH1 --fra FC1: kapittel-INSERT (FH) → UPDATE referanse → DELETE bibliotek_kapitler (FC), i rekkefølge", () => {
    const s = byggMalSql(FH1, "revisjon", { fraRef: "FC1" });
    const kapInsert = s.indexOf("INSERT INTO bibliotek_kapitler");
    const refUpd = s.indexOf("referanse = 'FH1',");
    const kapDelete = s.indexOf("DELETE FROM bibliotek_kapitler");
    expect(kapInsert).toBeGreaterThan(-1);
    expect(refUpd).toBeGreaterThan(kapInsert);
    expect(kapDelete).toBeGreaterThan(refUpd);
    // NOT EXISTS-vakt mot gjenværende maler:
    expect(s).toMatch(/DELETE FROM bibliotek_kapitler[\s\S]*NOT EXISTS \(SELECT 1 FROM bibliotek_maler/);
    expect(s).toContain("k.kode = 'FC'");
  });

  it("FD1 --fra FB2: sletter også kildekapittel FB (no-op i praksis, FB har FB4) — NOT EXISTS-vakt", () => {
    const s = byggMalSql(FD1, "revisjon", { fraRef: "FB2" });
    expect(s).toContain("DELETE FROM bibliotek_kapitler");
    expect(s).toContain("k.kode = 'FB'");
    // FB navne-rettes fortsatt (overlever), men FC/tomt kildekap. gjør det ikke — se FH1.
    expect(s).toContain("navn = 'Markrydding'");
  });

  it("fjernet kildekapittel navne-rettes IKKE (FC ikke i KAPITTEL_DATA_F)", () => {
    const s = byggMalSql(FH1, "revisjon", { fraRef: "FC1" });
    // Kun ÉN navn-UPDATE (målkapittel FH). Var FC med, ville det vært to (jf. FD1: FB+FD).
    expect((s.match(/UPDATE bibliotek_kapitler k SET navn/g) ?? []).length).toBe(1);
    expect(s).toContain("navn = 'Uttak av berg'");
    // FC nevnes bare i DELETE-en (kildekapittel), aldri i en navn-UPDATE.
    expect(s).toContain("k.kode = 'FC'");
    // Kontroll: FD1 (kilde FB overlever) har to navn-UPDATE-er.
    const fd1 = byggMalSql(FD1, "revisjon", { fraRef: "FB2" });
    expect((fd1.match(/UPDATE bibliotek_kapitler k SET navn/g) ?? []).length).toBe(2);
  });
});

// Tillegg samlerunder §2: --fra med ett par per mal → fler-mal-omkoding i én transaksjon.
describe("fler-mal-omkoding (par NY=GAMMEL)", () => {
  const fraMap = new Map([
    ["FH1", "FC1"],
    ["FS3", "FE1"],
  ]);

  it("to UPDATE … referanse i riktig rekkefølge (FH1 før FS3), én transaksjon", () => {
    const s = byggFlerRevisjonSql([FH1, FS3], fraMap);
    expect(s.match(/BEGIN;/g)).toHaveLength(1);
    expect(s.match(/COMMIT;/g)).toHaveLength(1);
    const fh1 = s.indexOf("referanse = 'FH1',");
    const fs3 = s.indexOf("referanse = 'FS3',");
    expect(fh1).toBeGreaterThan(-1);
    expect(fs3).toBeGreaterThan(fh1);
  });

  it("hver mal får kapittel-INSERT, DELETE tomt kildekapittel og version+1", () => {
    const s = byggFlerRevisjonSql([FH1, FS3], fraMap);
    expect(s.match(/version = version \+ 1/g)).toHaveLength(2);
    expect(s.match(/DELETE FROM bibliotek_kapitler/g)).toHaveLength(2);
    expect(s).toContain("k.kode = 'FC'"); // FH1s kildekapittel
    expect(s).toContain("k.kode = 'FE'"); // FS3s kildekapittel
    expect(s).toContain("'FH', 'Uttak av berg', 5"); // FH opprettes
  });

  it("utskrift per mal (\\x on + metadata-SELECT + kildekapittel-bevis for hver)", () => {
    const s = byggFlerRevisjonSql([FH1, FS3], fraMap);
    expect(s.match(/\\x on/g)?.length).toBeGreaterThanOrEqual(2);
    expect(s).toContain("WHERE referanse = 'FH1';");
    expect(s).toContain("WHERE referanse = 'FS3';");
    expect(s).toContain("kildekapittel_finnes_fortsatt");
  });

  it("en ref uten par revideres uten omkoding (blandet)", () => {
    const s = byggFlerRevisjonSql([FH1, KD2], new Map([["FH1", "FC1"]]));
    expect(s).toContain("referanse = 'FH1',"); // FH1 omkodes
    expect(s).not.toContain("referanse = 'KD2',"); // KD2 ren revisjon, ingen omkoding
    expect(s.match(/version = version \+ 1/g)).toHaveLength(2);
  });

  it("fler-revisjon uten fraMap er ren revisjon (ingen omkoding, ingen kapittel-tabell)", () => {
    const s = byggFlerRevisjonSql([KD2, KM2]);
    expect(s).not.toContain("bibliotek_kapitler");
    expect(s).not.toContain("Omkoding");
  });

  it("flerFilnavn: refs → «<ref1>-<ref2>-…-test.sql», punktum fjernet", () => {
    expect(flerFilnavn(["FH1", "FS3"])).toBe("fh1-fs3-test.sql");
    expect(flerFilnavn(["UM1", "UU1"])).toBe("um1-uu1-test.sql");
    expect(flerFilnavn(["KC3.1", "KD2"])).toBe("kc31-kd2-test.sql");
  });
});

// Ordre UM1 §3/§5: modus `ny` oppretter en manglende STANDARD (NS3420-U) i samme transaksjon, før
// kapittel og mal. K-/F-maler hører til en standard som alltid seedes → deres standard-INSERT er en
// idempotent no-op (WHERE NOT EXISTS). MELDT: K/F får en no-op standard-INSERT, ikke ingen.
describe("standard-opprett i modus ny (ordre UM1 §3)", () => {
  it("UM1 ny: standard-INSERT (NS3420-U) FØR kapittel-INSERT (UM) FØR mal-INSERT", () => {
    const s = byggMalSql(UM1, "ny");
    const stdIdx = s.indexOf("INSERT INTO bibliotek_standarder");
    const kapIdx = s.indexOf("INSERT INTO bibliotek_kapitler");
    const malIdx = s.indexOf("INSERT INTO bibliotek_maler");
    expect(stdIdx).toBeGreaterThan(-1);
    expect(stdIdx).toBeLessThan(kapIdx);
    expect(kapIdx).toBeLessThan(malIdx);
    // Ny standard NS3420-U, idempotent (WHERE NOT EXISTS), med navn + sortering fra STANDARD_DATA.
    expect(s).toContain("'NS3420-U', 'NS 3420-U:2019 Rørinstallasjoner', 3");
    expect(s).toMatch(/NOT EXISTS[\s\S]*bibliotek_standarder WHERE kode = 'NS3420-U'/);
    // Kapittel UM opprettes i NS3420-U.
    expect(s).toContain("'UM', 'Utendørs rørledninger', 1");
    expect(s).toContain("s.kode = 'NS3420-U'");
    expect(s).not.toContain("NS3420-K");
  });

  it("K-mal (ny) får en NO-OP standard-INSERT for NS3420-K (WHERE NOT EXISTS), ikke ingen", () => {
    const s = byggMalSql(KD2, "ny");
    expect(s).toContain("INSERT INTO bibliotek_standarder");
    expect(s).toMatch(/NOT EXISTS[\s\S]*bibliotek_standarder WHERE kode = 'NS3420-K'/);
  });

  it("F-mal (ny) får en NO-OP standard-INSERT for NS3420-F (WHERE NOT EXISTS)", () => {
    const s = byggMalSql(FD2_MAL as unknown as Parameters<typeof byggMalSql>[0], "ny");
    expect(s).toContain("INSERT INTO bibliotek_standarder");
    expect(s).toMatch(/NOT EXISTS[\s\S]*bibliotek_standarder WHERE kode = 'NS3420-F'/);
  });

  it("revisjon rører aldri standard-tabellen", () => {
    expect(byggMalSql(KD2, "revisjon")).not.toContain("bibliotek_standarder WHERE kode");
  });
});

// Runde B: UM1 + UU1 er begge NYE maler i én transaksjon (multi-ny). UM1 oppretter standard NS3420-U
// + kapittel UM; UU1 gjenbruker standarden (no-op) og oppretter kapittel UU.
describe("byggFlerNySql (multi-ny, runde B)", () => {
  it("én transaksjon (ett BEGIN, ett COMMIT) rundt begge nye maler", () => {
    const s = byggFlerNySql([UM1, UU1]);
    expect(s.match(/BEGIN;/g)).toHaveLength(1);
    expect(s.match(/COMMIT;/g)).toHaveLength(1);
  });

  it("hver mal INSERT-es fersk (version=1), INGEN DELETE, INGEN version+1", () => {
    const s = byggFlerNySql([UM1, UU1]);
    expect(s.match(/INSERT INTO bibliotek_maler/g)).toHaveLength(2);
    expect(s.match(/false, 1, '\[\]'::jsonb/g)).toHaveLength(2);
    expect(s).not.toContain("DELETE");
    expect(s).not.toContain("version = version + 1");
  });

  it("standard NS3420-U og begge kapitler (UM, UU) opprettes WHERE NOT EXISTS", () => {
    const s = byggFlerNySql([UM1, UU1]);
    expect(s).toContain("'NS3420-U', 'NS 3420-U:2019 Rørinstallasjoner', 3");
    expect(s).toContain("'UM', 'Utendørs rørledninger', 1");
    // UU flyttet 2→3 i KAPITTEL_DATA_U ved Runde C (UP satt inn på 2, FØR UU). Speiler seed-konstanten.
    expect(s).toContain("'UU', 'Felles arbeider for utendørs rørledningsanlegg', 3");
    // UM1 kommer før UU1 (rekkefølge).
    expect(s.indexOf("referanse = 'UM1'")).toBeLessThan(s.indexOf("referanse = 'UU1'"));
  });

  it("guard: hver mal avbryter hvis referansen finnes fra før (bruk revisjon)", () => {
    const s = byggFlerNySql([UM1, UU1]);
    expect(s).toContain("UM1 finnes allerede i arkivet — bruk modus revisjon");
    expect(s).toContain("UU1 finnes allerede i arkivet — bruk modus revisjon");
  });

  it("full utskrift per mal før COMMIT (\\x on + metadata-SELECT for hver)", () => {
    const s = byggFlerNySql([UM1, UU1]);
    const commitIdx = s.indexOf("COMMIT;");
    expect(s).toContain("WHERE referanse = 'UM1';");
    expect(s).toContain("WHERE referanse = 'UU1';");
    expect(s.indexOf("\\x on")).toBeGreaterThan(-1);
    expect(s.indexOf("\\x on")).toBeLessThan(commitIdx);
  });

  it("bygger objekt-radene fra hver mal-konstant (heading + felt)", () => {
    const s = byggFlerNySql([UM1, UU1]);
    expect(s).toContain("'heading', 'Kontroll FØR utførelse'");
    expect(s).toContain("'list_single', 'Type ledning'"); // UM1 felt 1
    expect(s).toContain("'list_single', 'Hva prøves'"); // UU1 felt 1
  });

  it("tom liste er en feil", () => {
    expect(() => byggFlerNySql([])).toThrow();
  });

  it("registeret finner UM1 og UU1 (U-maler)", () => {
    expect(malRegister().get("UM1")?.referanse).toBe("UM1");
    expect(malRegister().get("UU1")?.referanse).toBe("UU1");
  });
});
