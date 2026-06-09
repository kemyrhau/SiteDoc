# Kickoff — Ny server, migreringsfase (Docker + databaser + apper)

> **Til en ny Cowork kontroll-Claude.** Les denne FØRST, deretter filene listet nederst.
> Du er **kontroll- og verifiseringslaget** (se `kontroll-claude-veileder.md`). Plan med ord → Kenneth godkjenner → Kenneth utfører → du verifiserer.
> Opprettet 2026-06-08.

## Arbeidsmodell (vedtatt — «model 1»)

- **Kenneth utfører alle kommandoer selv fra Mac-en.** Ingen agent kjører på serveren.
- Du skriver eksakte kommando-blokker → Kenneth kjører i Mac-Terminal → limer rå utdata tilbake → du verifiserer mot fakta og gir neste steg.
- Server nås fra Mac med **`ssh server-ny`** (alias → tailnet `100.76.248.15`, bruker `kemyrhau`, nøkkel `~/.ssh/server_ny`). `sudo` krever passord → bruk `ssh -t` for sudo-kommandoer.
- **Ikke gjett. Verifiser mot faktisk kode/konfig før beslutning.** Still kontrollspørsmål ved tvil.

## Hva er ferdig (forutsetningen)

Den nye serveren (`192.168.1.209`, hostname `sitedoc`, Ubuntu 24.04) er en selvstendig, kryptert, fjernstyrbar boks:
auto-opplåsing av LUKS via TPM/clevis, slår seg på selv etter strømbrudd (UEFI), Tailscale-fjerntilgang, herdet OpenSSH (kun nøkkel). Bevist ende-til-ende. Detaljer: `ny-server-fjerntilgang-plan.md`.

## Mål for denne fasen

1. Installere **Docker** på den nye serveren.
2. Kjøre **databaser i containere**.
3. Migrere appene **sitedoc**, **sendfil**, **tromsosalsaklubb** til den nye serveren.
4. **«Fil til database»** blir værende der den er (migreres IKKE nå).

## Harde rammer (ufravikelige)

- ⚠️ **Cross-app / delt infrastruktur:** appene deler i dag domene/DNS (Cloudflare), OAuth-klienter og cloudflared-tunnel. Endring der kan velte prod for FLERE apper samtidig. Hver DNS/OAuth/tunnel-endring krever **lås (`parallell-arbeid-lock.md`) + Kenneths eksplisitte godkjenning**, og en **rollback-plan** per steg.
- **Staged migrering:** én app om gangen. **Lavest-risiko app først som pilot, sitedoc SIST** (mest kritisk, får kundedata).
- **«ALDRI slett data»** (sitedoc-regel): datamigrering via dump/restore + verifisering. Aldri DROP+CREATE på data.
- **Nøkkelregelen:** Claude rører aldri nøkkel-/passphrase-/secret-verdier. Kenneth kjører alle nøkkel-/env-operasjoner selv; du verifiserer kun via lengde/format (`${#VAR}`, `grep -c`).
- **Aldri deploy til prod uten eksplisitt forespørsel.** Test → funksjonell verifisering → prod.

## Åpne designvalg (avgjøres i planen, med rangering + anbefaling)

1. **DB-topologi:** én PostgreSQL-container med separat database + bruker per app (enklest drift, matcher dagens modell) **vs.** én container per app (mer isolasjon, mer overhead). Foreløpig lening: det første.
2. **Appene selv:** kjøre i Docker (compose per app) **vs.** beholde PM2. Docker = renere isolasjon/reproduserbarhet; PM2 = mindre endring.
3. **Datamigrering:** dump/restore-strategi + verifiseringssteg per database.
4. **Rekkefølge:** hvilken app er piloten (lavest risiko)? sitedoc sist.

## Første handling for ny kontroll-Claude

1. Les filene under.
2. Be om tilgang til `Programmering`-mappen (om ikke koblet) og **les stacken til hver app**: `Sendfil/`, `Tromsosalsaklubb/`, `SiteDoc/` (særlig `docs/claude/infrastruktur.md`, `deploy*.sh`, `.env.example`, `package.json`/compose-filer).
3. Skriv en **staged migreringsplan** (per app: rekkefølge, DB-topologi, Docker vs PM2, datamigrering m/dump-restore + verifisering, DNS/OAuth/cloudflared-steg m/rollback). Legg den fram for Kenneth → ingenting utføres før han godkjenner.

## Filer å lese (i rekkefølge)

1. `ny-server-migrering-kickoff.md` (denne)
2. `kontroll-claude-veileder.md` — arbeidsmåten for kontroll-Claude
3. `parallell-arbeid-lock.md` — koordinering mot timer-sporet + cross-app-regler
4. `ny-server-fjerntilgang-plan.md` — hva som er gjort på serveren (tilgang, oppsett)
5. `docs/claude/infrastruktur.md` — dagens (gamle) prod-infra: porter, PM2, cloudflared, DB, env-filer
6. `Sikkerhet/SIKKERHET.md` — sikkerhetsfunn (K-1..K-10) som migreringen bør lukke, ikke gjenskape
7. `CLAUDE.md` — overordnede regler, tech stack, deploy-disiplin
