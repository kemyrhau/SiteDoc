# parallell-arbeid-lock.md

> **Koordineringsfil for to parallelle arbeidsspor som deler infrastruktur.**
> Hver Opus **og** hver kontroll-Claude MÅ lese denne FØR de rører en delt ressurs.
> De to sporene har ingen direkte kommunikasjon — **denne fila + Kenneth er kanalen.**
> Sist oppdatert: 2026-06-08

---

## Spor-register

| Spor | Kontroll-Claude | Branch / worktree | Status |
|------|-----------------|-------------------|--------|
| **TIMER-ARKITEKTUR** | denne Cowork-samtalen | `develop` | Aktiv — SPOR 2 (docs-routing) |
| **NY-SERVER** | egen Cowork-samtale | **worktree `../sitedoc-server`, branch `ny-server`** (model 1: Kenneth utfører fra Mac, kontroll-Claude verifiserer) | **MIGRERING FULLFØRT 2026-06-10 ✅** — alle tre apper i Docker på ny server: SENDFIL (2026-06-08), SALSAKLUBB (2026-06-09), SITEDOC (2026-06-10, test+prod, pgvector, ML, innlogget+tegninger+3D verifisert). Delt Postgres `pgvector/pgvector:pg16` + restic-backup (NVMe). Gamle apper stoppet som rollback. **Sitedoc-dev var fryst på TIMER-sporet under flyttingen.** Gjenstår: avvikle gamle (stopp + fjern fra gammel tunnel), off-disk-backup-disk, ODA for DWG, slett junk-DNS. NY-SERVER pusher kun til branch `ny-server`, aldri develop. |

> **Kontekst:** Dagens server = Ubuntu under en Win-PC i daglig bruk, ukontrollert ukentlig restart (ustabil). NY-SERVER bygger et nytt, stabilt, sikrere oppsett. Begge spor deployer fra samme repo, men til **ulike mål** under overgangen: TIMER → dagens test/prod; NY-SERVER → nytt oppsett. Ingen kryssdeploy uten lås.

---

## Ressurs-eierskap — hvem rører hva

| Ressurs | Eier-spor | Regel for det andre sporet |
|---------|-----------|----------------------------|
| `.env`-filer | NY-SERVER | TIMER rører aldri; be om endring via LÅS |
| Server / PM2 / deploy (test + prod) | NY-SERVER (mens migrering pågår) | TIMER deployer **ikke** mens server-LÅS er aktiv |
| DNS / OAuth / ngrok | NY-SERVER | TIMER rører aldri |
| prod-DB (`sitedoc`) — migrering | **delt → LÅS kreves** | Ingen migrering uten lås |
| Prisma-migrasjoner (kode) | TIMER | NY-SERVER rører ikke schema |
| App-kode (`apps/`, `packages/`) på `develop` | TIMER | NY-SERVER pusher ikke kode til `develop` |
| `docs/claude/` timer-filer | TIMER | — |
| `infrastruktur.md`, `deploy-detaljer.md` | NY-SERVER | — |

> Delingen over er et **forslag** — server-sporet bekrefter/justerer sin kolonne når det starter.

> ⚠️ **KRYSS-APP-FARE (viktigst):** DNS, OAuth-klienter, ngrok og andre delte kontoer brukes av **alle** Kenneths apper — ikke bare SiteDoc. En endring der under server-hardening kan velte dagens produksjon for flere apper samtidig, selv om det nye oppsettet er fysisk adskilt. Slike endringer krever **lås + eksplisitt Kenneth-godkjenning**, uansett hvilket spor.

---

## EKSKLUSIV LÅS — ressurser som aldri må røres av begge samtidig

Gjelder: `.env`, server/PM2/deploy, DNS/OAuth/ngrok, **prod-DB-migrering**.

| Ressurs | Holdes av | Siden | Slippes når |
|---------|-----------|-------|-------------|
| _(ingen aktiv lås)_ | — | — | — |

### Protokoll
1. **Før** du rører en eksklusiv ressurs: sjekk tabellen. Holdt av det andre sporet → **STOPP**, koordiner via Kenneth.
2. **Skaff lås:** legg inn rad (spor, ressurs, tidsstempel) + si fra til Kenneth.
3. **Slipp lås:** fjern raden når ferdig + si fra.
4. **Tvil → Kenneth bestemmer. Aldri gjett.**

---

## Harde regler (aldri samtidig)

- Aldri to deploys (test eller prod) samtidig.
- Aldri Prisma-migrering mens server-migrering/-rebuild pågår.
- Aldri `.env`-endring fra begge spor.
- Aldri push til samme branch fra to Opus-instanser — bruk git-worktrees eller separate brancher.

---

## Nøkkelhåndtering (begge spor — ufravikelig)

Claude — verken Opus eller kontroll — håndterer **aldri** nøkkel-/hemmelighetsverdier. **Kenneth kjører alle nøkkel-/rotasjons-operasjoner selv.** Kontroll-Claude verifiserer kun at en prosess *har* nøkkelen via ikke-avslørende sjekk (lengde/format: `${#VAR}`, `grep -c`), **aldri** ved å lese eller ekko verdien.

Gjelder: `.env`, OAuth-secrets, DB-passord, SSH-nøkler, API-nøkler.

> Server-hardening kan heve hygienen (rotasjonsrutine, secrets-manager) — men det er en designvurdering server-sporet tar, og den skal **aldri** flytte nøkkel-håndtering bort fra Kenneth uten hans eksplisitte beslutning.

---

## Distribusjon og worktrees

- **Bruk én git-worktree per spor** (samme repo, separate mapper): `git worktree add ../sitedoc-server develop` for server-sporet. Da redigerer de to Opus-instansene aldri samme arbeidstre samtidig, men deployer fra samme grunnlag.
- **Commit denne fila til `develop`** så begge worktrees ser den (og oppdateringer av låsen). Ukommittert holder *kun* hvis begge jobber i nøyaktig samme checkout — frarådes ved samtidig arbeid.
- Kenneth/Opus avgjør commit (commit/push er ikke kontroll-Claudes oppgave).
