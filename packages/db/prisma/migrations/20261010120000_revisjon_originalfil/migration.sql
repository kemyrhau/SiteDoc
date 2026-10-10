-- Tegning-nedlasting NESTE: originalfila arkiveres pr. revisjon.
-- Additiv og nullbar. NULL = originalen ble ikke tatt vare på — en gyldig og varig
-- tilstand for revisjoner arkivert før dette feltet (ingen backfill er mulig, fila
-- finnes ikke lenger som original). Diskriminator for revisjonsnedlasting (erstatter
-- `.svg`-endelse-sjekken). Ikke en identitets-/koblingskolonne → stille-tomhet-kravet
-- om backfill/unik-indeks gjelder ikke; testen gater at NYE revisjoner får verdi.
ALTER TABLE "drawing_revisions" ADD COLUMN "original_file_url" TEXT;
