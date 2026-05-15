-- T.4 Arbeidstid defaults (vedtatt 2026-05-16) — additiv schema-migrasjon
--
-- Legger til firma-default for normal arbeidsdag på OrganizationSetting og
-- periode-overstyring på ArbeidstidsKalender. Sammen utgjør disse grunnlaget
-- for T.4 (fra/til per rad) — forhåndsutfylling i mobil-TimerRadModal og
-- effektiv arbeidstid-helper på server.
--
-- Logikk (implementeres i T4-b):
--   1) Slå opp kalender-rad for dato → bruk overstyringene hvis satt
--   2) Slå opp aktiv sommertid_start-rad (siste før dato, uten påfølgende
--      sommertid_slutt) → bruk overstyringene
--   3) Ellers: bruk OrganizationSetting-defaults
--
-- Validering (i API-laget): standardStartTid/standardSluttTid/pauseMin på
-- ArbeidstidsKalender er kun gyldig for type sommertid_start, sommertid_slutt
-- og halvdag. For helligdag/fellesferie/klemdager/firma_fri avvises feltene.

-- OrganizationSetting: NOT NULL DEFAULT — eksisterende rader får defaultverdi
ALTER TABLE "organization_settings"
  ADD COLUMN "standard_start_tid" TEXT NOT NULL DEFAULT '07:00';

ALTER TABLE "organization_settings"
  ADD COLUMN "standard_slutt_tid" TEXT NOT NULL DEFAULT '15:00';

ALTER TABLE "organization_settings"
  ADD COLUMN "standard_pause_min" INTEGER NOT NULL DEFAULT 30;

-- ArbeidstidsKalender: NULL — settes kun for sommertid_start/slutt/halvdag
ALTER TABLE "arbeidstids_kalender"
  ADD COLUMN "standard_start_tid" TEXT;

ALTER TABLE "arbeidstids_kalender"
  ADD COLUMN "standard_slutt_tid" TEXT;

ALTER TABLE "arbeidstids_kalender"
  ADD COLUMN "pause_min" INTEGER;
