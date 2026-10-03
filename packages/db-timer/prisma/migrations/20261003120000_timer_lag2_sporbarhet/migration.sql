-- LAG 2 (timer-GPS, sporbarhet — ordre L2-A, Leveranse A) — radmodellen på serveren.
--
-- ADDITIV (to-stegs-policy): kun ADD COLUMN + backfill + CHECK. Ingen DROP, ingen
-- NOT NULL på eksisterende kolonner. Idempotent: ADD COLUMN IF NOT EXISTS + DO-block
-- for CHECK → trygg å kjøre to ganger.
--
-- 🔴 KJØRES AV KENNETH mot sitedoc_test først. Backfillen RAPPORTERER to tall i
-- RAISE NOTICE (se under) — Kenneth leser dem (særlig navne-match-tallet) FØR prod.
--
-- Stille-tomhet-regelen (CLAUDE.md) i denne releasen:
--   (a) backfill  — er_reise settes på eksisterende reise-rader (speiler dagens
--                   leser-regel M3), ikke en ny gjetning. Gamle rader får
--                   reise_kilde = NULL (ærlig «vet ikke», som geofence_kilde i lag 1).
--   (b) garanti   — CHECK: er_reise=false ⇒ reise_retning/kjoretid/avstand ER NULL
--                   (en ikke-reise-rad kan ALDRI bære reise-tall i skjul).
--   (c) test      — @sitedoc/api integrasjonstest kjører backfill + CHECK mot ekte
--                   Postgres og feiler rødt hvis en reise-lønnsart-rad står
--                   er_reise=false etter backfill (timer-lag2-backfill.int.test.ts).
--
-- 🔴 CHECK-avvik fra spec § 2 (ført i leveransen): spec listet OGSÅ
--    «er_reise=true ⇒ reise_retning IS NOT NULL» som DB-CHECK. Den kan IKKE være en
--    hard CHECK: backfillen setter er_reise=true på gamle rader UTEN retning (vi vet
--    den ikke), og overgangsperioden (presisering 2) utleder er_reise=true på rader
--    fra gamle klienter som heller ikke sender retning. En DB-CHECK ville avvist både
--    migreringen og hver overgangs-synk. Invarianten «er_reise⇒retning∧kilde»
--    håndheves derfor i mottaket (C2) KUN når klienten sendte er_reise eksplisitt.

-- ===========================================================================
-- 1. Nye kolonner på sheet_timer (reise-sporet) — alle additive.
-- ===========================================================================
ALTER TABLE "timer"."sheet_timer"
  ADD COLUMN IF NOT EXISTS "er_reise"             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reise_retning"        TEXT,
  ADD COLUMN IF NOT EXISTS "reise_oppmotested_id" TEXT,
  ADD COLUMN IF NOT EXISTS "reise_kjoretid_min"   INTEGER,
  ADD COLUMN IF NOT EXISTS "reise_avstand_m"      INTEGER,
  ADD COLUMN IF NOT EXISTS "reise_kilde"          TEXT,
  ADD COLUMN IF NOT EXISTS "reise_regel"          JSONB,
  ADD COLUMN IF NOT EXISTS "tid_kilde"            TEXT,
  ADD COLUMN IF NOT EXISTS "reise_avvik"          BOOLEAN;

CREATE INDEX IF NOT EXISTS "sheet_timer_reise_oppmotested_id_idx"
  ON "timer"."sheet_timer" ("reise_oppmotested_id");

-- ===========================================================================
-- 2. Nye kolonner på daily_sheets (normens kilde følger sedelen) — additive.
-- ===========================================================================
ALTER TABLE "timer"."daily_sheets"
  ADD COLUMN IF NOT EXISTS "norm_status"   TEXT,
  ADD COLUMN IF NOT EXISTS "norm_snapshot" JSONB;

-- ===========================================================================
-- 3. Backfill av er_reise — speiler dagens leser-regel (M3), ikke ny gjetning.
--    GREN 1 (trygg): rad-lønnsart = firmaets konfigurerte reise-art
--      (organization_settings.reise_lonnsart_id) ELLER en grensepunkt-art
--      (organization_reise_grenser.lonnsart_id).
--    GREN 2 (arver dagens falske positive): navne-match /reise|transport/i, KUN
--      for firmaer UTEN konfigurert reise_lonnsart_id. Regexen matcher et
--      brukerredigerbart navn — tallet rapporteres så Kenneth ser omfanget før prod.
--
--    organization_settings + organization_reise_grenser bor i public-schemaet
--    (kjernen); sheet_timer + lonnsarter i timer-schemaet. Samme DB-instans → vi
--    refererer begge med eksplisitt schema-prefiks (ingen Prisma @relation på tvers).
--    Grenene er disjunkte: gren 2 oppdaterer kun rader som fortsatt står false etter
--    gren 1, så tallene kan ikke dobbelttelle.
-- ===========================================================================
DO $$
DECLARE
  konfigurert_antall INTEGER;
  navnematch_antall  INTEGER;
BEGIN
  -- GREN 1 — konfigurert reise-art (reise_lonnsart_id ∪ grensepunkt-arter).
  UPDATE "timer"."sheet_timer" st
  SET "er_reise" = true
  FROM "timer"."lonnsarter" la
  WHERE st."lonnsart_id" = la."id"
    AND st."er_reise" = false
    AND (
      st."lonnsart_id" = (
        SELECT os."reise_lonnsart_id"
        FROM "public"."organization_settings" os
        WHERE os."organization_id" = la."organization_id"
      )
      OR EXISTS (
        SELECT 1
        FROM "public"."organization_reise_grenser" g
        WHERE g."organization_id" = la."organization_id"
          AND g."lonnsart_id" = st."lonnsart_id"
      )
    );
  GET DIAGNOSTICS konfigurert_antall = ROW_COUNT;

  -- GREN 2 — navne-match, KUN firmaer uten konfigurert reise_lonnsart_id
  --   (manglende settings-rad teller også som «uten», via NOT EXISTS).
  UPDATE "timer"."sheet_timer" st
  SET "er_reise" = true
  FROM "timer"."lonnsarter" la
  WHERE st."lonnsart_id" = la."id"
    AND st."er_reise" = false
    AND la."navn" ~* 'reise|transport'
    AND NOT EXISTS (
      SELECT 1
      FROM "public"."organization_settings" os
      WHERE os."organization_id" = la."organization_id"
        AND os."reise_lonnsart_id" IS NOT NULL
    );
  GET DIAGNOSTICS navnematch_antall = ROW_COUNT;

  RAISE NOTICE 'LAG2 backfill er_reise: % rader via KONFIGURERT reise-art (trygt), % rader via NAVNE-MATCH (arver falske positive — les dette tallet før prod).',
    konfigurert_antall, navnematch_antall;
END $$;

-- ===========================================================================
-- 4. Garanti (CHECK): er_reise=false ⇒ ingen reise-tall i skjul.
--    Backfilte rader er er_reise=true → passerer. Idempotent via DO-block.
-- ===========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sheet_timer_er_reise_tom_naar_false'
  ) THEN
    ALTER TABLE "timer"."sheet_timer" ADD CONSTRAINT "sheet_timer_er_reise_tom_naar_false"
      CHECK (
        "er_reise" = true
        OR (
          "reise_retning" IS NULL
          AND "reise_kjoretid_min" IS NULL
          AND "reise_avstand_m" IS NULL
        )
      );
  END IF;
END $$;
