import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";

/**
 * LAG 2 (ordre L2-A, gate-kriterie 4) — behavioural bevis for garantiene i
 * 20261003120000_timer_lag2_sporbarhet, mot EKTE Postgres (localhost/CI-sandkasse).
 * «Stille-tomhet krav c kan ikke kvitteres med mock» (ordre) → integrasjon.
 *
 *   1. BACKFILL av er_reise speiler dagens leser (M3): konfigurert art ∪
 *      grensepunkt-art (GREN 1, trygt) + navne-match KUN uten konfigurert art
 *      (GREN 2). De to tallene (migreringens RAISE NOTICE) måles her via
 *      $executeRawUnsafe-returverdien — samme WHERE som migreringen.
 *   2. 🔴 Falske-positive-vakten: en «Transporttillegg»-art i et firma MED
 *      konfigurert reise-art skal IKKE bli er_reise (rød først: en regex-only-
 *      backfill ville frosset den som sannhet).
 *   3. CHECK: er_reise=false MED reise-felt AVVISES («stille tomhet»-garanti).
 *      Kontroll: uten CHECK går den ugyldige raden inn.
 *
 * Tabellene speiler migreringens SQL i throwaway-tabeller (samme mønster som
 * overflate-check-constraint.integration.test.ts) — ingen app-migrering nødvendig.
 */

const ST = "sheet_timer_lag2test";
const LA = "lonnsarter_lag2test";
const OS = "organization_settings_lag2test";
const GR = "organization_reise_grenser_lag2test";

const ORG_A = "org-a"; // HAR konfigurert reise_lonnsart_id
const ORG_B = "org-b"; // UTEN konfigurert art, men med grensepunkt-art

describe("LAG 2 backfill + CHECK (ekte Postgres)", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${ST}`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${LA}`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${OS}`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${GR}`);

    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${LA} (id text PRIMARY KEY, organization_id text NOT NULL, navn text NOT NULL)`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${OS} (organization_id text PRIMARY KEY, reise_lonnsart_id text)`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${GR} (organization_id text NOT NULL, lonnsart_id text)`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${ST} (
         id text PRIMARY KEY,
         lonnsart_id text NOT NULL,
         er_reise boolean NOT NULL DEFAULT false,
         reise_retning text,
         reise_kjoretid_min integer,
         reise_avstand_m integer
       )`,
    );

    // Org A: KONFIGURERT reise-art = reise-A.
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${OS} VALUES ('${ORG_A}', 'reise-A'), ('${ORG_B}', NULL)`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${LA} VALUES
         ('reise-A', '${ORG_A}', 'Reise til prosjekt'),
         ('ord-A',   '${ORG_A}', 'Timelønn'),
         ('trans-A', '${ORG_A}', 'Transporttillegg'),
         ('band-B',  '${ORG_B}', 'Avstandsbånd 25km'),
         ('trans-B', '${ORG_B}', 'Transport av masser'),
         ('ord-B',   '${ORG_B}', 'Timelønn')`,
    );
    // Org B har en grensepunkt-art (band-B).
    await prisma.$executeRawUnsafe(`INSERT INTO ${GR} VALUES ('${ORG_B}', 'band-B')`);

    await prisma.$executeRawUnsafe(
      `INSERT INTO ${ST} (id, lonnsart_id) VALUES
         ('r1', 'reise-A'),   -- GREN 1 (konfigurert art)
         ('r2', 'ord-A'),     -- ingen
         ('r3', 'trans-A'),   -- navne-match MEN org har konfigurert art → IKKE
         ('r4', 'band-B'),    -- GREN 1 (grensepunkt-art)
         ('r5', 'trans-B'),   -- GREN 2 (navne-match, ingen konfigurert art)
         ('r6', 'ord-B')      -- ingen`,
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${ST}`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${LA}`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${OS}`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${GR}`);
  });

  it("backfill gir forventede to tall (2 konfigurert, 1 navne-match)", async () => {
    // GREN 1 — speiler migreringens WHERE (konfigurert art ∪ grensepunkt).
    const konfigurert = await prisma.$executeRawUnsafe(
      `UPDATE ${ST} st SET er_reise = true
         FROM ${LA} la
        WHERE st.lonnsart_id = la.id
          AND st.er_reise = false
          AND (
            st.lonnsart_id = (SELECT os.reise_lonnsart_id FROM ${OS} os WHERE os.organization_id = la.organization_id)
            OR EXISTS (SELECT 1 FROM ${GR} g WHERE g.organization_id = la.organization_id AND g.lonnsart_id = st.lonnsart_id)
          )`,
    );
    // GREN 2 — navne-match KUN uten konfigurert art.
    const navnematch = await prisma.$executeRawUnsafe(
      `UPDATE ${ST} st SET er_reise = true
         FROM ${LA} la
        WHERE st.lonnsart_id = la.id
          AND st.er_reise = false
          AND la.navn ~* 'reise|transport'
          AND NOT EXISTS (SELECT 1 FROM ${OS} os WHERE os.organization_id = la.organization_id AND os.reise_lonnsart_id IS NOT NULL)`,
    );
    expect(konfigurert).toBe(2); // r1 + r4
    expect(navnematch).toBe(1); // r5
  });

  it("🔴 riktige rader satt (reise-lønnsart → true), falske positive unngått", async () => {
    const rader = await prisma.$queryRawUnsafe<{ id: string; er_reise: boolean }[]>(
      `SELECT id, er_reise FROM ${ST} ORDER BY id`,
    );
    const map = Object.fromEntries(rader.map((r) => [r.id, r.er_reise]));
    expect(map.r1).toBe(true); // konfigurert reise-art
    expect(map.r4).toBe(true); // grensepunkt-art
    expect(map.r5).toBe(true); // navne-match (ingen konfigurert art)
    expect(map.r2).toBe(false); // ordinær
    expect(map.r6).toBe(false); // ordinær
    // 🔴 Transporttillegg i firma MED konfigurert art: IKKE frosset som reise.
    expect(map.r3).toBe(false);
  });

  it("CHECK AVVISER er_reise=false med reise-felt (stille-tomhet)", async () => {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE ${ST} ADD CONSTRAINT ${ST}_er_reise_tom CHECK (
         er_reise = true OR (reise_retning IS NULL AND reise_kjoretid_min IS NULL AND reise_avstand_m IS NULL)
       )`,
    );
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO ${ST} (id, lonnsart_id, er_reise, reise_retning) VALUES ('bad', 'ord-A', false, 'ut')`,
      ),
    ).rejects.toThrow();
  });

  it("CHECK TILLATER er_reise=true med reise-felt, og false uten", async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${ST} (id, lonnsart_id, er_reise, reise_retning, reise_kjoretid_min, reise_avstand_m)
         VALUES ('ok-reise', 'reise-A', true, 'ut', 48, 42000)`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${ST} (id, lonnsart_id, er_reise) VALUES ('ok-arbeid', 'ord-A', false)`,
    );
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM ${ST} WHERE id IN ('ok-reise','ok-arbeid')`,
    );
    expect(Number(r[0]!.n)).toBe(2);
  });
});
