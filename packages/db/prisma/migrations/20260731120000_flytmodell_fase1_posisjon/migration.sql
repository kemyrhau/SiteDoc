-- Flytmodell Fase 1a (posisjonsmodell) — datamodell + deterministisk backfill.
-- Grunnlag: flytmodell-fase1-datamodell-plan.md + gate-svar-fabel.md (FLAGG 1-3 vedtatt 31.07).
-- To-stegs migrasjonspolicy: alle nye kolonner nullable/default her; NOT NULL utsettes til steg 2.
-- ALDRI DROP. Status-enum beholdes permanent som avledet cache.

-- ============================================================
-- 1. DDL — legg til kolonner (nullable / default)
-- ============================================================

-- Per ledd: DokumentflytMedlem
ALTER TABLE "dokumentflyt_medlemmer" ADD COLUMN "ansvarsmerke" TEXT;
ALTER TABLE "dokumentflyt_medlemmer" ADD COLUMN "klassifisering" TEXT;
ALTER TABLE "dokumentflyt_medlemmer" ADD COLUMN "kan_terminere_uten_ball" BOOLEAN NOT NULL DEFAULT false;

-- Per dokument: Checklist
ALTER TABLE "checklists" ADD COLUMN "aktiv_posisjon" INTEGER;
ALTER TABLE "checklists" ADD COLUMN "retning" TEXT;
ALTER TABLE "checklists" ADD COLUMN "terminal" TEXT;
ALTER TABLE "checklists" ADD COLUMN "sendt" BOOLEAN NOT NULL DEFAULT false;

-- Per dokument: Task
ALTER TABLE "tasks" ADD COLUMN "aktiv_posisjon" INTEGER;
ALTER TABLE "tasks" ADD COLUMN "retning" TEXT;
ALTER TABLE "tasks" ADD COLUMN "terminal" TEXT;
ALTER TABLE "tasks" ADD COLUMN "sendt" BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 2. Backfill — deterministisk (rolle-/status-basert). Engangs.
--    aktivPosisjon + retning: UTSATT til Fase 2/3 (se § 2g nedenfor).
-- ============================================================

-- 2a. steg = kanonisk rollerekkefølge per flyt (DENSE_RANK på rolle-prioritet).
--     Subsumerer HMS naturlig: bestiller(pri2)->1, utforer(pri3)->2 = dagens seed.
--     Merk: kolliderer to rader på (dokumentflyt_id, {faggruppe|projectMember|group}, rolle, steg)
--     vil UPDATE feile — fanges i sandkasse-prøvekjøring (skal ikke forekomme i praksis).
WITH ranked AS (
  SELECT
    id,
    DENSE_RANK() OVER (
      PARTITION BY "dokumentflyt_id"
      ORDER BY CASE "rolle"
        WHEN 'registrator' THEN 1
        WHEN 'bestiller'   THEN 2
        WHEN 'utforer'     THEN 3
        WHEN 'godkjenner'  THEN 4
        ELSE 99
      END
    ) AS ny_steg
  FROM "dokumentflyt_medlemmer"
)
UPDATE "dokumentflyt_medlemmer" m
SET "steg" = r.ny_steg
FROM ranked r
WHERE m.id = r.id;

-- 2b. klassifisering per rolle (default; redigerbart ved flytoppsett).
--     ← (Besvar) eies av kontroll+utfor -> alle 4 dagens roller beholder ←, ingen regresjon.
UPDATE "dokumentflyt_medlemmer"
SET "klassifisering" = CASE "rolle"
  WHEN 'registrator' THEN 'utfor'
  WHEN 'bestiller'   THEN 'kontroll'
  WHEN 'utforer'     THEN 'utfor'
  WHEN 'godkjenner'  THEN 'kontroll'
  ELSE 'utfor'
END;

-- HMS-gruppe-ledd (utforer i HMS-flyt) -> kontroll (FLAGG 2). HMS-flyt = ledd hvis gruppe har 'hms' i domains.
UPDATE "dokumentflyt_medlemmer" m
SET "klassifisering" = 'kontroll'
FROM "project_groups" g
WHERE m."group_id" = g.id
  AND m."rolle" = 'utforer'
  AND g."domains" @> '["hms"]';

-- 2c. ansvarsmerke per rolle (default; ordliste forfines ved oppsett-UI, veileder § 5).
UPDATE "dokumentflyt_medlemmer"
SET "ansvarsmerke" = CASE "rolle"
  WHEN 'registrator' THEN 'Registrerer'
  WHEN 'bestiller'   THEN 'Bestiller arbeid'
  WHEN 'utforer'     THEN 'Utfører'
  WHEN 'godkjenner'  THEN 'Godkjenner'
  ELSE NULL
END;

-- 2d. kanTerminereUtenBall: kontroll-ledd som eier Lukk uten ball (F3: bestiller+godkjenner) + HMS-gruppe.
UPDATE "dokumentflyt_medlemmer"
SET "kan_terminere_uten_ball" = true
WHERE "rolle" IN ('bestiller', 'godkjenner');

UPDATE "dokumentflyt_medlemmer" m
SET "kan_terminere_uten_ball" = true
FROM "project_groups" g
WHERE m."group_id" = g.id
  AND m."rolle" = 'utforer'
  AND g."domains" @> '["hms"]';

-- 2e. terminal <- dagens terminale status (Checklist + Task). cancelled -> avbrutt (ny terminal, vedtak 3).
UPDATE "checklists"
SET "terminal" = CASE "status"
  WHEN 'approved'  THEN 'godkjent'
  WHEN 'rejected'  THEN 'avvist'
  WHEN 'dismissed' THEN 'avvist'
  WHEN 'closed'    THEN 'lukket'
  WHEN 'cancelled' THEN 'avbrutt'
  ELSE NULL
END;

UPDATE "tasks"
SET "terminal" = CASE "status"
  WHEN 'approved'  THEN 'godkjent'
  WHEN 'rejected'  THEN 'avvist'
  WHEN 'dismissed' THEN 'avvist'
  WHEN 'closed'    THEN 'lukket'
  WHEN 'cancelled' THEN 'avbrutt'
  ELSE NULL
END;

-- 2f. sendt <- status<>draft ELLER finnes transfer-rad (bevis for tidligere send). Draft != aldri sendt.
UPDATE "checklists" c
SET "sendt" = (c."status" <> 'draft' OR EXISTS (
  SELECT 1 FROM "document_transfers" dt WHERE dt."checklist_id" = c.id
));

UPDATE "tasks" t
SET "sendt" = (t."status" <> 'draft' OR EXISTS (
  SELECT 1 FROM "document_transfers" dt WHERE dt."task_id" = t.id
));

-- 2g. aktivPosisjon TERMINAL: backfilles NÅ (valg 4 + cowork-syntese 31.07).
--     Terminaler er FROSNE historiske fakta — runtime re-ruter dem aldri, så en engangs-backfill
--     kan ikke divergere fra en live matcher (til forskjell fra aktive dok). Posisjon = leddet
--     handlingen ble utført fra:
--       godkjent            -> siste ledd (MAX steg) — fremover-handling fra siste ledd (§ 2.3)
--       avvist/lukket/avbrutt -> terminerende senders steg (transferlogg), fallback siste kjente (MAX steg)
UPDATE "checklists" c
SET "aktiv_posisjon" = (
  SELECT MAX(m."steg") FROM "dokumentflyt_medlemmer" m WHERE m."dokumentflyt_id" = c."dokumentflyt_id"
)
WHERE c."terminal" = 'godkjent' AND c."dokumentflyt_id" IS NOT NULL;

UPDATE "checklists" c
SET "aktiv_posisjon" = COALESCE(
  (
    SELECT m."steg"
    FROM "document_transfers" dt
    JOIN "project_members" pm ON pm."user_id" = dt."sender_id"
    JOIN "dokumentflyt_medlemmer" m
      ON m."dokumentflyt_id" = c."dokumentflyt_id" AND m."project_member_id" = pm."id"
    WHERE dt."checklist_id" = c."id"
    ORDER BY dt."created_at" DESC
    LIMIT 1
  ),
  (SELECT MAX(m."steg") FROM "dokumentflyt_medlemmer" m WHERE m."dokumentflyt_id" = c."dokumentflyt_id")
)
WHERE c."terminal" IN ('avvist', 'lukket', 'avbrutt') AND c."dokumentflyt_id" IS NOT NULL;

UPDATE "tasks" t
SET "aktiv_posisjon" = (
  SELECT MAX(m."steg") FROM "dokumentflyt_medlemmer" m WHERE m."dokumentflyt_id" = t."dokumentflyt_id"
)
WHERE t."terminal" = 'godkjent' AND t."dokumentflyt_id" IS NOT NULL;

UPDATE "tasks" t
SET "aktiv_posisjon" = COALESCE(
  (
    SELECT m."steg"
    FROM "document_transfers" dt
    JOIN "project_members" pm ON pm."user_id" = dt."sender_id"
    JOIN "dokumentflyt_medlemmer" m
      ON m."dokumentflyt_id" = t."dokumentflyt_id" AND m."project_member_id" = pm."id"
    WHERE dt."task_id" = t."id"
    ORDER BY dt."created_at" DESC
    LIMIT 1
  ),
  (SELECT MAX(m."steg") FROM "dokumentflyt_medlemmer" m WHERE m."dokumentflyt_id" = t."dokumentflyt_id")
)
WHERE t."terminal" IN ('avvist', 'lukket', 'avbrutt') AND t."dokumentflyt_id" IS NOT NULL;

-- 2h. aktivPosisjon NON-TERMINAL + all retning: BEVISST UTSATT til Fase 2.
--     Aktive dok krever eier/recipient -> flytmedlem-matching som SPEILER runtime-rutingen; den
--     delte matcheren bygges først i Fase 2. En hand-rullet SQL-approksimasjon nå ville risikere
--     divergens fra runtime — nettopp feilklassen posisjonsmodellen fjerner. Kolonnene står NULL for
--     ikke-terminale dok til Fase 2 backfiller dem med SAMME kode runtime bruker (AVKLARING 1, godkjent).
