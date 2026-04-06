-- Fiks ø-inkonsistens: utfører → utforer (matcher Zod-validering)
UPDATE "dokumentflyt_medlemmer" SET "rolle" = 'utforer' WHERE "rolle" = 'utfører';
UPDATE "dokumentflyt_medlemmer" SET "rolle" = 'bestiller' WHERE "rolle" = 'oppretter';
