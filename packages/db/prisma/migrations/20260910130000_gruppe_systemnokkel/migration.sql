-- Entydig HMS-gruppe via ProjectGroup.system_nokkel (2026-09-10)
--
-- HMS-gruppa ble identifisert på domenet "hms", men det domenet er BREDDE-tilgang
-- som prosjekt-admin også bærer (["bygg","hms","kvalitet"]). To grupper matchet,
-- og find()/findFirst tok vilkårlig første treff — behandler-lista og medlems-
-- lista viste ulike personer, og auto-opprettelsen (modul.ts) konkluderte at
-- gruppa fantes og laget den aldri. system_nokkel gjør identiteten entydig.
--
-- Rekkefølge (viktig): ADD COLUMN → backfill → partiell unik-indeks. Indeksen
-- bygges SIST, etter at backfillen har sikret én markert gruppe pr. prosjekt.

-- 1) Nytt felt (nullable). null = vanlig brukeropprettet gruppe.
ALTER TABLE "project_groups" ADD COLUMN "system_nokkel" TEXT;

-- 2) Backfill (krav a) — marker eksisterende HMS-gruppe pr. prosjekt.
--
-- Diskriminerende WHERE (CLAUDE.md § Migrasjons-backfill-disiplin): KUN grupper
-- der "hms" er ENESTE domene. prosjekt-admin bærer "hms" som bredde-tilgang
-- (3 domener) og skal IKKE markeres — det var nettopp den gruppa som forurenset
-- oppslaget. DISTINCT ON velger nøyaktig én pr. prosjekt (prefererer seed-slug
-- hms-ledere, så modul-slug hms-ansvarlige, ellers eldste) så den partielle unik-
-- indeksen under aldri møter to markerte grupper i samme prosjekt.
UPDATE "project_groups" pg
SET "system_nokkel" = 'hms'
FROM (
    SELECT DISTINCT ON ("project_id") "id"
    FROM "project_groups"
    WHERE "domains" @> '["hms"]'::jsonb
      AND jsonb_array_length("domains") = 1
    ORDER BY "project_id",
        CASE "slug"
            WHEN 'hms-ledere' THEN 0
            WHEN 'hms-ansvarlige' THEN 1
            ELSE 2
        END,
        "created_at"
) valgt
WHERE pg."id" = valgt."id";

-- 3) DB-garanti mot duplikat (krav b) — partiell unik-indeks. Postgres teller
-- NULL som distinkt, så en vanlig @@unique ville tillatt vilkårlig mange
-- umarkerte grupper men også to markerte; WHERE NOT NULL gjør at høyst ÉN gruppe
-- pr. prosjekt kan bære en gitt system_nokkel. Etter denne er gjetting umulig.
-- ProjectGroup er @@map'et til "project_groups", project_id via @map.
CREATE UNIQUE INDEX "project_groups_prosjekt_systemnokkel_unik"
    ON "project_groups" ("project_id", "system_nokkel")
    WHERE "system_nokkel" IS NOT NULL;
