-- T.9 Firmakalender (vedtatt 2026-05-15) — schema-migrasjon
--
-- Variant B (dynamisk): én rad per dato per firma. Helligdager, fellesferie,
-- klemdager, halvdager, sommer/vinter-perioder og firma-fri-dager lagres i
-- samme tabell og skilles via `type`-feltet.
--
-- type-verdier valideres via Zod-enum i API-laget (ikke Prisma-enum) for å
-- holde typen utvidbar uten migrasjon: helligdag | fellesferie | klemdager
-- | sommertid_start | sommertid_slutt | halvdag | firma_fri.
--
-- timer_overstyr settes kun for halvdag-type. Decimal(4,2) matcher dagsnorm
-- på OrganizationSetting.

CREATE TABLE "arbeidstids_kalender" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "aar"             INTEGER NOT NULL,
  "dato"            DATE NOT NULL,
  "type"            TEXT NOT NULL,
  "navn"            TEXT NOT NULL,
  "timer_overstyr"  DECIMAL(4, 2),
  "aktiv"           BOOLEAN NOT NULL DEFAULT true,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "arbeidstids_kalender_pkey" PRIMARY KEY ("id")
);

-- Én rad per dato per firma. Halvdag overstyrer helligdag på samme dato
-- (admin må eksplisitt slette eller endre type for å skifte).
CREATE UNIQUE INDEX "arbeidstids_kalender_organization_id_dato_key"
  ON "arbeidstids_kalender" ("organization_id", "dato");

-- For raskt år-filtrering ved import («Importer norsk standard 2027») og
-- web-admin-vy («vis 2026»).
CREATE INDEX "arbeidstids_kalender_organization_id_aar_idx"
  ON "arbeidstids_kalender" ("organization_id", "aar");

-- For oppslag på type per år (f.eks. «finn sommertid-perioden i 2026»).
CREATE INDEX "arbeidstids_kalender_organization_id_type_aar_idx"
  ON "arbeidstids_kalender" ("organization_id", "type", "aar");

ALTER TABLE "arbeidstids_kalender"
  ADD CONSTRAINT "arbeidstids_kalender_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
