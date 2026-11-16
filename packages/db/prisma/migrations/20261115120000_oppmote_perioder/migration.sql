-- POST 2026-11-15 (12) D + TILLEGG: ansattens oppmøtested med perioder, og
-- kjøretid/avstand kontor → kontor (overføringen gir reisetid).
-- Rent additivt. Ingen backfill: tom tabell = «ikke valgt ennå» for alle
-- ansatte (bevisst — resolveren `løsOppmote` gir da «ikkeValgt», som er
-- dagens atferd). Kjøres av Kenneth på server; aldri av agent mot test/prod.

-- CreateTable
CREATE TABLE "oppmote_perioder" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "organization_member_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fast" BOOLEAN NOT NULL DEFAULT false,
    "oppmotested_id" TEXT,
    "project_id" TEXT,
    "fra_dato" DATE NOT NULL,
    "til_dato" DATE,
    "satt_av_user_id" TEXT NOT NULL,
    "satt_ved" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oppmote_perioder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oppmotested_avstand" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "fra_oppmotested_id" TEXT NOT NULL,
    "til_oppmotested_id" TEXT NOT NULL,
    "kjoretid_min" INTEGER NOT NULL,
    "avstand_m" INTEGER,
    "kilde" TEXT NOT NULL,
    "beregnet_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oppmotested_avstand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oppmote_perioder_organization_member_id_fra_dato_idx" ON "oppmote_perioder"("organization_member_id", "fra_dato");
CREATE INDEX "oppmote_perioder_organization_id_idx" ON "oppmote_perioder"("organization_id");
CREATE INDEX "oppmote_perioder_oppmotested_id_idx" ON "oppmote_perioder"("oppmotested_id");
CREATE INDEX "oppmote_perioder_project_id_idx" ON "oppmote_perioder"("project_id");
CREATE INDEX "oppmotested_avstand_organization_id_idx" ON "oppmotested_avstand"("organization_id");
CREATE UNIQUE INDEX "oppmotested_avstand_fra_oppmotested_id_til_oppmotested_id_key" ON "oppmotested_avstand"("fra_oppmotested_id", "til_oppmotested_id");

-- Maks ett GJELDENDE fast oppmøtested (fast uten til_dato) pr. ansatt.
CREATE UNIQUE INDEX "oppmote_perioder_ett_fast_key" ON "oppmote_perioder"("organization_member_id") WHERE "fast" AND "til_dato" IS NULL;

-- Garantier (serverlaget sjekker også, men DB-en er siste vakt).
ALTER TABLE "oppmote_perioder" ADD CONSTRAINT "oppmote_perioder_type_check" CHECK ("type" IN ('kontor', 'byggeplass'));
ALTER TABLE "oppmote_perioder" ADD CONSTRAINT "oppmote_perioder_maal_check" CHECK (
  ("type" = 'kontor' AND "oppmotested_id" IS NOT NULL AND "project_id" IS NULL)
  OR ("type" = 'byggeplass' AND "project_id" IS NOT NULL AND "oppmotested_id" IS NULL)
);
-- Fast finnes kun for kontor; et midlertidig kontor har alltid sluttdato.
ALTER TABLE "oppmote_perioder" ADD CONSTRAINT "oppmote_perioder_fast_check" CHECK (
  ("fast" AND "type" = 'kontor')
  OR (NOT "fast" AND ("type" = 'byggeplass' OR "til_dato" IS NOT NULL))
);
ALTER TABLE "oppmote_perioder" ADD CONSTRAINT "oppmote_perioder_dato_check" CHECK ("til_dato" IS NULL OR "til_dato" >= "fra_dato");
ALTER TABLE "oppmotested_avstand" ADD CONSTRAINT "oppmotested_avstand_par_check" CHECK ("fra_oppmotested_id" < "til_oppmotested_id");

-- AddForeignKey
ALTER TABLE "oppmote_perioder" ADD CONSTRAINT "oppmote_perioder_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oppmote_perioder" ADD CONSTRAINT "oppmote_perioder_organization_member_id_fkey" FOREIGN KEY ("organization_member_id") REFERENCES "organization_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oppmote_perioder" ADD CONSTRAINT "oppmote_perioder_oppmotested_id_fkey" FOREIGN KEY ("oppmotested_id") REFERENCES "oppmotesteder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "oppmote_perioder" ADD CONSTRAINT "oppmote_perioder_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oppmotested_avstand" ADD CONSTRAINT "oppmotested_avstand_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oppmotested_avstand" ADD CONSTRAINT "oppmotested_avstand_fra_oppmotested_id_fkey" FOREIGN KEY ("fra_oppmotested_id") REFERENCES "oppmotesteder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oppmotested_avstand" ADD CONSTRAINT "oppmotested_avstand_til_oppmotested_id_fkey" FOREIGN KEY ("til_oppmotested_id") REFERENCES "oppmotesteder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
