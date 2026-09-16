-- DRY-RUN (ordre versjonssporing-softdelete, krav 6). BEVISELIG READ-ONLY: ingen INSERT,
-- UPDATE, DELETE, DROP, ALTER, CREATE — kun én SELECT. Kjøres FØR migreringen for å vise
-- nøyaktig hva backfillen (migration.sql steg 2b) vil røre, per firma.
--
-- MERK: kolonnene `versjon_av_hovedmal` og `deleted_at` finnes ENNÅ IKKE når denne kjøres
-- (migreringen er ikke kjørt). Derfor utledes «mangler snapshot» og «soft-slettet» fra
-- EKSISTERENDE kolonner (laant_fra_bibliotek_mal_id) som PREDIKSJON av effekten:
--   · antall_laant          = rader backfillen setter versjon_av_hovedmal = 1 på
--   · mangler_snapshot_naa  = samme tall (ingen har snapshot før migreringen)
--   · antall_soft_slettet   = 0 (deleted_at-kolonnen finnes ikke ennå)

SELECT
  o."name"                                                                     AS firma,
  o."id"                                                                       AS firma_id,
  COUNT(ot."id")                                                               AS antall_firmamaler,
  COUNT(ot."id") FILTER (WHERE ot."laant_fra_bibliotek_mal_id" IS NOT NULL)    AS antall_laant,
  COUNT(ot."id") FILTER (WHERE ot."laant_fra_bibliotek_mal_id" IS NOT NULL)    AS mangler_snapshot_naa,
  0                                                                            AS antall_soft_slettet
FROM "organizations" o
LEFT JOIN "organization_templates" ot ON ot."organization_id" = o."id"
GROUP BY o."id", o."name"
ORDER BY o."name";
