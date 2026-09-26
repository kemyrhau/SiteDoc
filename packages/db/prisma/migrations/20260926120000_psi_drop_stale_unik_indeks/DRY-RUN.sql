-- DRY-RUN for 20260926120000_psi_drop_stale_unik_indeks — BEVISELIG READ-ONLY.
-- Kun SELECT. Ingen INSERT/UPDATE/DELETE/ALTER/CREATE/DROP. Trygg mot test OG prod.
--
-- Kjøres FØR Kenneth kjører migreringen. Tre spørsmål:
--   1. Finnes den foreldreløse indeksen `psi_project_id_key` i det hele tatt?
--      (forventet: PROD = 1 rad, TEST = 0 rader — det er nettopp driften vi retter.)
--   2. Består den sammensatte garantien på (project_id, byggeplass_id)? DETTE ER DET
--      KRITISKE: dropper vi den enkle indeksen, må den sammensatte finnes, ellers mister
--      psi sin ENESTE unikhetsgaranti. MÅ returnere nøyaktig kolonnene project_id +
--      byggeplass_id (uansett indeks-navn — navnet bærer fortsatt "building_id").
--   3. Kontekst: hvor mange psi-rader og hvor mange prosjekter har mer enn én PSI?
--      (prod målte 1 rad i 1 prosjekt — ingen har truffet veggen ennå.)

-- 1. Finnes den enkle unike indeksen på psi(project_id)?  (forventet prod=1, test=0)
SELECT indexrelid::regclass AS indeks_navn,
       indisunique          AS er_unik,
       pg_get_indexdef(indexrelid) AS definisjon
FROM pg_index
WHERE indrelid = 'psi'::regclass
  AND indexrelid::regclass::text = 'psi_project_id_key';

-- 2. Den sammensatte garantien MÅ finnes og dekke NØYAKTIG (project_id, byggeplass_id).
--    Leser kolonnene fra katalogen, ikke fra navnet — navnet er "..._building_id_key".
SELECT i.indexrelid::regclass AS indeks_navn,
       i.indisunique          AS er_unik,
       array_agg(a.attname ORDER BY k.ord) AS kolonner
FROM pg_index i
JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
WHERE i.indrelid = 'psi'::regclass
  AND i.indisunique
GROUP BY i.indexrelid, i.indisunique;
-- Forventet: minst én unik indeks med kolonner {project_id, byggeplass_id}.

-- 3. Kontekst: antall psi-rader totalt, og prosjekter med > 1 PSI (per byggeplass).
SELECT count(*)                       AS antall_psi_rader,
       count(DISTINCT project_id)     AS antall_prosjekter_med_psi
FROM psi;

SELECT project_id,
       count(*) AS antall_psi_i_prosjektet
FROM psi
GROUP BY project_id
HAVING count(*) > 1;
