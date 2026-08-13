-- Endringslogg står ALLTID på (Kenneth-forenkling 2026-08-12): valget om loggen
-- skal MED i utskrift flyttes til utskriftstidspunktet (fase 3b), ikke om den
-- samles inn. Kolonnen beholdes som sitedoc-admin nødbryter.
--
-- (1) Nye maler: default true.
ALTER TABLE "report_templates" ALTER COLUMN "enable_change_log" SET DEFAULT true;

-- (2) Backfill av eksisterende maler til true.
--
-- BEVISST UNNTAK fra backfill-disiplinen i CLAUDE.md (som forbyr å sette én verdi
-- på alle rader uten diskriminerende WHERE): her ER alle rader målet, fordi dette
-- er en POLICY-endring («logg alltid på»), ikke en datautledning. Eksisterende
-- maler skal begynne å logge fra og med dette tidspunktet.
--
-- MERK: loggen er IKKE retroaktiv — den dekker først endringer gjort etter at
-- dette kjøres. Historikk før dette fylles ikke.
UPDATE "report_templates" SET "enable_change_log" = true WHERE "enable_change_log" = false;
