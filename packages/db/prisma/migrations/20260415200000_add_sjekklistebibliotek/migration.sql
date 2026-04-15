-- Sjekklistebibliotek: globalt arkiv med NS 3420-maler

CREATE TABLE "bibliotek_standarder" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "sortering" INTEGER NOT NULL DEFAULT 0,
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bibliotek_standarder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bibliotek_kapitler" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "sortering" INTEGER NOT NULL,
    "standard_id" TEXT NOT NULL,

    CONSTRAINT "bibliotek_kapitler_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bibliotek_maler" (
    "id" TEXT NOT NULL,
    "kapittel_id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "referanse" TEXT NOT NULL,
    "beskrivelse" TEXT,
    "versjon" TEXT NOT NULL DEFAULT '1.0',
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mal_innhold" JSONB NOT NULL,

    CONSTRAINT "bibliotek_maler_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prosjekt_bibliotek_valg" (
    "id" TEXT NOT NULL,
    "prosjekt_id" TEXT NOT NULL,
    "bibliotek_mal_id" TEXT NOT NULL,
    "sjekkliste_mal_id" TEXT,
    "aktivert_av" TEXT NOT NULL,
    "aktivert_dato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prosjekt_bibliotek_valg_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bibliotek_standarder_kode_key" ON "bibliotek_standarder"("kode");
CREATE INDEX "bibliotek_kapitler_standard_id_idx" ON "bibliotek_kapitler"("standard_id");
CREATE INDEX "bibliotek_maler_kapittel_id_idx" ON "bibliotek_maler"("kapittel_id");
CREATE INDEX "prosjekt_bibliotek_valg_prosjekt_id_idx" ON "prosjekt_bibliotek_valg"("prosjekt_id");
CREATE UNIQUE INDEX "prosjekt_bibliotek_valg_prosjekt_id_bibliotek_mal_id_key" ON "prosjekt_bibliotek_valg"("prosjekt_id", "bibliotek_mal_id");

ALTER TABLE "bibliotek_kapitler" ADD CONSTRAINT "bibliotek_kapitler_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "bibliotek_standarder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bibliotek_maler" ADD CONSTRAINT "bibliotek_maler_kapittel_id_fkey" FOREIGN KEY ("kapittel_id") REFERENCES "bibliotek_kapitler"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prosjekt_bibliotek_valg" ADD CONSTRAINT "prosjekt_bibliotek_valg_bibliotek_mal_id_fkey" FOREIGN KEY ("bibliotek_mal_id") REFERENCES "bibliotek_maler"("id") ON DELETE CASCADE ON UPDATE CASCADE;
