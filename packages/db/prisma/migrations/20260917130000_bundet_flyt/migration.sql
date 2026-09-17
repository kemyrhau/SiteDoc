-- Bundet flyt (fabel-tegning 2026-09-16, Kenneth-gatet).
--
-- Én boolsk kolonne på dokumentflyt: true = dokumentene i flyten kan IKKE flyttes til andre
-- flyter (flyt-bytte nektes på serveren, oppgave/sjekkliste.endreStatus). false = «fri flyt».
--
-- DEFAULT false ER backfillen: alle eksisterende rader blir frie automatisk — ingen rad
-- fødes tom. NOT NULL er trygt nettopp fordi DEFAULT dekker de eksisterende radene.
-- Ingen datamigrering: kolonnen styrer kun hva som er LOV framover, den rører aldri
-- dokumentdata (Kenneth-vedtak: INGEN backfill av tilstand — alle eksisterende flyter forblir frie).
ALTER TABLE "dokumentflyter" ADD COLUMN "bundet" BOOLEAN NOT NULL DEFAULT false;
