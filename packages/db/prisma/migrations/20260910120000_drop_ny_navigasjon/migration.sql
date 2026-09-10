-- Fjern ubrukt nav-flagg User.nyNavigasjon (2026-09-10)
--
-- Gammel navigasjon er avviklet i tre trinn. Trinn 1 (03ba723d) og trinn 2
-- (356ae3f1) fjernet all kode som leste flagget; etter trinn 2 er kolonnen
-- `users.ny_navigasjon` uten lesere (målt: null kilde-treff i apps/packages).
--
-- To-stegs migrerings-policy (CLAUDE.md, ufravikelig fra 2026-04-26): kolonnen
-- droppes i en EGEN release, etter at koden som sluttet å bruke den er ute og
-- deployet (trinn 2). Ingen ny kolonne, ingen datamigrering — kun DROP.
--
-- Prod 2026-09-09: ny_navigasjon = true for 10/10 brukere. Flagget betyr
-- ingenting etter trinn 2; verdien er ikke verdt å bevare (cowork + redesign
-- enige). Ingen reversering planlagt.
--
-- Tabellnavn: User er @@map-et til "users" (schema.prisma:79). Kolonnen er
-- @map-et til "ny_navigasjon".

ALTER TABLE "users" DROP COLUMN "ny_navigasjon";
