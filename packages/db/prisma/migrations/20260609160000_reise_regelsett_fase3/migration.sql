-- Fase 3 / T.10 § B: reise-regelsett som firmainnstilling på OrganizationSetting.
-- Terskel/retning/lovlighet er avtale-avhengig (tariff) → konfigurerbart, ikke
-- hardkodet. Reisetid = lønnsart-rad (arbeidstid), IKKE avstands-/godtgjørelse-sats.
-- Alle felt additive med DEFAULT/nullable (to-stegs-policy: trygt, ingen data slettes).
ALTER TABLE "organization_settings"
  ADD COLUMN "reise_terskel_min"         INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "reise_under_terskel_type"  TEXT    NOT NULL DEFAULT 'arbeidstid',
  ADD COLUMN "reise_over_terskel_type"   TEXT    NOT NULL DEFAULT 'reisetid',
  ADD COLUMN "reisetid_teller_overtid"   BOOLEAN NOT NULL DEFAULT false,
  -- Svak FK → timer.lonnsarter.id (db-timer), håndheves i app-lag (A.20). NULL =
  -- fallback til navne-match ("reise/transport") i klassifiseringen.
  ADD COLUMN "reise_lonnsart_id"         TEXT;
