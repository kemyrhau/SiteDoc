-- Pushvarsel runde A (2026-09-17, Kenneth-gatet EKSPLISITT): token-tabell.
--
-- ÉN NY TABELL. Ingen eksisterende tabell endres, ingen kolonne dropppes, ingen data
-- migreres. Reversibel i praksis: DROP TABLE "push_tokens" gjenoppretter forrige tilstand.
--
-- «Stille tomhet» (Kenneth-regel), alle tre ledd:
--   (a) BACKFILL — IKKE AKTUELT, begrunnet: det finnes ingen historiske enhets-tokens å
--       fylle inn. Kanalen oppstår først når en app registrerer seg (runde B). Tabellen
--       fødes tom MED HENSIKT — en bruker uten rad er per definisjon ikke nåbar (krav 4).
--   (b) DB-GARANTI — UNIQUE på token. token er ENHETENS identitet; samme telefon skal
--       aldri gi dobbelt varsel. CREATE UNIQUE INDEX feiler HØYT ved duplikat (tilsiktet,
--       samme prinsipp som 20260917120000_unik_indeks_partiell_soft_delete). En tom tabell
--       kan ikke ha duplikater → migreringen kan ikke feile på eksisterende data.
--   (c) TEST — push-token.integration.test.ts feiler hvis en bruker regnes som nåbar uten
--       et gyldig token, og hvis to rader deler samme token.
--
-- SVAK FK: user_id er et rent String-felt uten FK-constraint/@relation (som activity_log).
-- Holder User-tabellen urørt; en foreldreløs token etter brukersletting feiler hos Expo
-- (DeviceNotRegistered) og ryddes av sendetjenesten.

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "plattform" TEXT NOT NULL,
    "sist_sett" TIMESTAMPTZ NOT NULL,
    "opprettet" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (unik på token — én rad pr. enhet, dobbelt varsel umulig)
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex (oppslag pr. bruker for nåbarhets-telling)
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");
