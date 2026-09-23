-- ===========================================================================
-- 🔴🔴🔴 SKAL IKKE KJØRES. Kenneth-vedtak 2026-09-17: «la SJA være».
--
-- Fila sletter tre signatur-/«bekreftet av»-rader fra 06.09. De radene er
-- BEVIS på at funksjonen virket — ikke støy som skal ryddes. Å slette dem
-- ville fjerne dokumentasjonen på at signering og gjeste-bekreftelse fungerer.
--
-- Trengs flate 3 («signer egen rad») verifisert senere: seed et NYTT demo-SJA
-- ved siden av det gamle. En seed legger til — den sletter aldri rader som
-- representerer ekte hendelser.
--
-- Beholdt som referanse for SQL-mønsteret (vakter, transaksjon, rapportering).
-- 🔴🔴🔴
-- ===========================================================================
--
-- Tilbakestill runde 2 i SJA-demoen til seedet tilstand
--
-- HVORFOR: skjermbilde-gaten trenger at innloggingsbrukerens rad står USIGNERT
-- så «Signer» kan verifiseres. Etter seeding 06.09 kom tre skrivinger:
-- Kenneths rad ble signert, og Truls + Kari ble «bekreftet av». Runde 2 er
-- dermed ikke lenger i seedet tilstand.
--
-- HVA DEN GJØR: sletter signaturradene i runde 2 for ALLE unntatt Ola Tømrer.
-- Seedet tilstand for runde 2 er «kun Ola har signert» (seed-linje 253-255).
--
-- HVA DEN IKKE GJØR: rører ikke runde 1, ikke deltakerlista, ikke dokumentet,
-- ikke noe annet prosjekt. Ingen DROP, ingen TRUNCATE, ingen schema-endring.
--
-- HVORFOR SQL OG IKKE seed:sja: test-api-containeren er et produksjonsbygg uten
-- .ts-kilder og uten tsx, og server-ny har verken node eller node_modules.
-- psql mot containeren er den veien som faktisk finnes.
--
-- KJØRES AV: Kenneth. Se kommandoen nederst i fila.
-- ===========================================================================

BEGIN;

DO $$
DECLARE
  v_db        text;
  v_sja_id    text;
  v_runde_id  text;
  v_ola_id    text;
  v_antall    int;
  v_slettet   int;
BEGIN
  -- ---------------------------------------------------------------------
  -- VAKT 1: aldri mot prod. Speiler prod-vakten i seed-sja-signaturrunder.ts.
  -- ---------------------------------------------------------------------
  SELECT current_database() INTO v_db;
  IF v_db <> 'sitedoc_test' THEN
    RAISE EXCEPTION 'AVBRUTT: koblet til «%», ikke sitedoc_test. Demo-data bygges aldri mot prod.', v_db;
  END IF;

  -- ---------------------------------------------------------------------
  -- VAKT 2: nøyaktig én SJA med denne tittelen, ellers vet vi ikke hvilken.
  -- ---------------------------------------------------------------------
  SELECT count(*) INTO v_antall FROM checklists WHERE title = 'SJA Løft mobilkran — Akse 4';
  IF v_antall <> 1 THEN
    RAISE EXCEPTION 'AVBRUTT: fant % sjekklister med demo-tittelen, forventet nøyaktig 1.', v_antall;
  END IF;
  SELECT id INTO v_sja_id FROM checklists WHERE title = 'SJA Løft mobilkran — Akse 4';

  -- ---------------------------------------------------------------------
  -- VAKT 3: runde 2 må finnes og være ÅPEN. Er den avsluttet, er tilstanden
  -- en annen enn den gaten forventer — da skal et menneske se på det.
  -- ---------------------------------------------------------------------
  SELECT id INTO v_runde_id
    FROM signatur_runder
   WHERE checklist_id = v_sja_id AND runde_nr = 2;
  IF v_runde_id IS NULL THEN
    RAISE EXCEPTION 'AVBRUTT: fant ingen runde 2 på demo-SJA-en.';
  END IF;
  IF (SELECT avsluttet_at FROM signatur_runder WHERE id = v_runde_id) IS NOT NULL THEN
    RAISE EXCEPTION 'AVBRUTT: runde 2 er AVSLUTTET. Seedet tilstand er en åpen runde 2 — si fra framfor å tvinge.';
  END IF;

  -- ---------------------------------------------------------------------
  -- Ola Tømrer sin deltakerrad — hans signatur er en DEL av seedet tilstand
  -- og skal IKKE slettes.
  -- ---------------------------------------------------------------------
  SELECT d.id INTO v_ola_id
    FROM dokument_deltakere d
    JOIN users u ON u.id = d.user_id
   WHERE d.checklist_id = v_sja_id
     AND u.email = 'ola.tomrer@demo.sitedoc.no';
  IF v_ola_id IS NULL THEN
    RAISE EXCEPTION 'AVBRUTT: fant ikke Ola Tømrer som deltaker. Demoen ser annerledes ut enn seeden bygger.';
  END IF;

  -- ---------------------------------------------------------------------
  -- FØR
  -- ---------------------------------------------------------------------
  SELECT count(*) INTO v_antall FROM dokument_signaturer WHERE runde_id = v_runde_id;
  RAISE NOTICE 'FØR:  runde 2 har % signaturrad(er).', v_antall;

  -- ---------------------------------------------------------------------
  -- Tilbakestill: behold KUN Olas rad.
  -- ---------------------------------------------------------------------
  DELETE FROM dokument_signaturer
   WHERE runde_id = v_runde_id
     AND deltaker_id <> v_ola_id;
  GET DIAGNOSTICS v_slettet = ROW_COUNT;

  SELECT count(*) INTO v_antall FROM dokument_signaturer WHERE runde_id = v_runde_id;
  RAISE NOTICE 'SLETTET: % rad(er).', v_slettet;
  RAISE NOTICE 'ETTER: runde 2 har % signaturrad(er) — forventet 1 (Ola).', v_antall;

  IF v_antall <> 1 THEN
    RAISE EXCEPTION 'AVBRUTT: endte på % rader, forventet 1. Rullet tilbake.', v_antall;
  END IF;
END $$;

COMMIT;

-- Kontroll etterpå: hvem står som signert i runde 2?
SELECT COALESCE(u.name, d.guest_name) AS deltaker,
       CASE WHEN s.id IS NULL THEN 'usignert'
            WHEN s.bekreftet_av_user_id IS NOT NULL THEN 'bekreftet av ansvarlig'
            ELSE 'signert' END AS tilstand
  FROM dokument_deltakere d
  LEFT JOIN users u ON u.id = d.user_id
  LEFT JOIN dokument_signaturer s
         ON s.deltaker_id = d.id
        AND s.runde_id = (SELECT r.id FROM signatur_runder r
                           JOIN checklists c ON c.id = r.checklist_id
                          WHERE c.title = 'SJA Løft mobilkran — Akse 4' AND r.runde_nr = 2)
 WHERE d.checklist_id = (SELECT id FROM checklists WHERE title = 'SJA Løft mobilkran — Akse 4')
   AND d.fjernet_at IS NULL
 ORDER BY deltaker;

-- ===========================================================================
-- KJØRES SLIK (Kenneth, fra Mac):
--
--   cat ~/Documents/Programmering/SiteDoc/packages/db/prisma/reset-sja-runde2.sql \
--     | ssh -t server-ny 'sudo docker exec -i $(sudo docker ps --format "{{.Names}}" | grep -x postgres) psql -U sitedoc -d sitedoc_test'
--
-- Alt kjøres i én transaksjon. Feiler en vakt, rulles alt tilbake og
-- ingenting er endret.
-- ===========================================================================
