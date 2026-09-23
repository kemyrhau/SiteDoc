-- DRY-RUN for 20260917120000_unik_indeks_partiell_soft_delete — BEVISELIG READ-ONLY.
-- Kun SELECT. Ingen INSERT/UPDATE/DELETE/ALTER/CREATE/DROP. Trygg mot test OG prod.
--
-- Kjøres FØR Kenneth kjører migreringen. To spørsmål:
--   1. Hvor mange firmamaler er soft-slettet i dag? (forventet 0 — soft-delete ble akkurat
--      deployet, ingen har rukket å slette noe.)
--   2. Har noen organisasjon to AKTIVE rader med samme laant_fra_bibliotek_mal_id?
--      DETTE ER DET KRITISKE: finnes duplikater, kan den nye partielle unik-indeksen IKKE
--      opprettes, og migreringen feiler midt i deployen. MÅ være 0.

-- 1. Antall soft-slettede firmamaler (forventet 0).
SELECT count(*) AS soft_slettede_firmamaler
FROM organization_templates
WHERE deleted_at IS NOT NULL;

-- 2. Aktive duplikat-lån som ville felt den nye indeksen (MÅ være 0 rader).
--    Speiler indeksens predikat nøyaktig: deleted_at IS NULL + non-null lån-peker.
--    (NULL-pekere er egne maler og telles ikke — NULLS DISTINCT.)
SELECT organization_id,
       laant_fra_bibliotek_mal_id,
       count(*) AS antall_aktive_laan
FROM organization_templates
WHERE deleted_at IS NULL
  AND laant_fra_bibliotek_mal_id IS NOT NULL
GROUP BY organization_id, laant_fra_bibliotek_mal_id
HAVING count(*) > 1;
