# Staged migreringsplan — Docker + databaser + apper på ny server (`sitedoc`, 192.168.1.209)

> Spor: **NY-SERVER**. Utførelsesmodell: **Kenneth utfører alt fra Mac (`ssh server-ny`); kontroll-Claude planlegger og verifiserer.**
> Plan med ord før kode — **ingenting utføres før Kenneth har godkjent hvert steg.** Les `parallell-arbeid-lock.md` før delte ressurser røres.
> Status: **UTKAST til godkjenning.** Opprettet 2026-06-08. Forutsetning fullført: fjerntilgang (TPM auto-unlock + UEFI + Tailscale + SSH-herding), se `ny-server-fjerntilgang-plan.md`.

---

## 0. Strategisk kontekst (besluttet 2026-06-08)

Den nye serveren er **«clean install»-mellomsteget**, ikke endepunktet. Endepunktet er **ekstern EU/EØS-host** når reelle/større kundedata kommer (sannsynligvis flere måneder unna).

- **SiteDoc prod migreres til ny server nå** — men i en **kunde-TESTFASE**, ikke reell produksjon hos kunde. Begrenset/ingen ekte kunde-PII i denne fasen.
- **Dobbel migrering er akseptert** fordi Docker-arbeidet er bærbart: compose-filer + dump/restore-prosedyrer flytter nesten direkte til ekstern host. Arbeidet nå gjør den senere ekstern-flyttingen billig.
- **Utløser for ekstern-flytting:** det øyeblikket reelle/større kundedata lander. Da er det en egen planleggingsoppgave (leverandørvalg, datalokasjon EU/EØS pga. GDPR, migreringsstrategi). Beslutningsporten forsvinner ikke — den flytter seg i tid.
- **Restrisiko å være bevisst på:** hjemmeboksen låser opp disken selv (tyveri av hele maskinen er i scope). Akseptabelt i kunde-testfase uten ekte PII; ikke akseptabelt som hjem for reell kundeproduksjon → derfor ekstern host senere.

---

## 1. Kartlagt utgangspunkt (fakta fra repo, 2026-06-08)

| App | Stack | Database | Port | PM2-navn | Domene(r) | Kompleksitet |
|-----|-------|----------|------|----------|-----------|--------------|
| **Sendfil** | Node + Hono + TS | **SQLite** (`data/sendfil.sqlite`, WAL) + `uploads/` | 3400 | `sendfil` | `sendfil.sitedoc.site` (bak CF Access) | **Lav** |
| **Tromsosalsaklubb** | Next.js 14 + Prisma | **PostgreSQL** `tromsosalsaklubb` (bruker `kemyr`), 36 modeller | 3200 | `salsaklubb` | `sitedoc.online`, `*.sitedoc.site`, `*.sitedoc.online`, kunde-domener | **Middels** (Stripe + Vipps webhooks, OAuth, multi-tenant) |
| **SiteDoc** | Turborepo/pnpm, Next.js 14 + Fastify + tRPC | **PostgreSQL** `sitedoc` + `sitedoc_test` | 3100/3001 (prod), 3300/3301 (test) | `sitedoc-web/-api` (+test) | `sitedoc.no`, `api.sitedoc.no`, `test.*`, `api-test.*`, `ssh.*` | **Høy** (snart kundedata, monorepo, Python-tjenester, native deps) |

**Delt infrastruktur (cross-app — kjernerisiko):**
- **Én Cloudflare-tunnel** (ID `189a5af2-59f9-48df-a834-8e934313aa51`) på dagens server ruter **alle** hostnavn for alle tre appene via én config: `/etc/cloudflared/config.yml`.
- **DNS** via Cloudflare for `sitedoc.no`, `sitedoc.site`, `sitedoc.online`.
- **OAuth-klienter** (Google, Microsoft Entra) delt på tvers.
- **Cloudflare Access**-policyer gater admin (sendfil-admin, `kontroll.sitedoc.online`, `ssh.sitedoc.no`).
- **SiteDoc-tilleggstjenester:** Python `norbert-embed` (3302) + `oversettelse-server` (3303) i `~/norbert-env`; apt-deps `poppler-utils`, `tesseract-ocr(+nor)`, `xvfb`; tunge konvertere (ODA, CloudCompare, PotreeConverter).

> ⚠️ Konsekvens: å flytte én app betyr å omdirigere dens hostnavn fra dagens delte tunnel til ny server. **Hver slik DNS/tunnel-endring kan påvirke flere apper → krever lås (`parallell-arbeid-lock.md`) + Kenneths eksplisitte godkjenning + rollback per steg.**

---

## 2. Åpne designvalg — rangert med anbefaling

### Valg 1 — DB-topologi (gjelder kun Postgres-appene; Sendfil er SQLite)

1. **(ANBEFALT) Én PostgreSQL-container, separat database + rolle per app.** Databaser `sitedoc`, `sitedoc_test`, `tromsosalsaklubb`, egne roller med GRANT kun til egen DB. *Hvorfor:* matcher dagens modell (én PG-instans hoster allerede alle), én backup-/oppgraderingsrutine, lavest driftsbyrde. Isolasjon på DB/rolle-nivå er nok for samme tillitsgrense (alle er dine).
2. Én container per app. Mer isolasjon, men mer overhead og flere ting å vedlikeholde/patche — marginal gevinst her. **Frarådes nå.**

> **Sendfil beholder SQLite** — ingen migrering til Postgres (unødig scope). SQLite-fila + `uploads/` legges på en Docker-volum/bind-mount.
> **PG-versjon:** dagens er PostgreSQL 16 (per SIKKERHET.md). Anbefaler å pinne **samme major (16)** i container for å unngå dump/restore-overraskelser. Verifiseres i Fase 0.

### Valg 2 — Appene: Docker vs PM2

1. **(ANBEFALT) Docker, én compose-fil per app**, Postgres som delt container. *Hvorfor:* dette er hele poenget med ny server. Gir reproduserbarhet, ren isolasjon (lukker K-7 samlokalisering, K-8 `0.0.0.0`-binding → bind containere til `127.0.0.1`/internt nett), ryddig env-håndtering.
2. Hybrid: Docker for DB + Sendfil + Salsaklubb; **SiteDoc midlertidig på PM2** til slutt-fasen. *Hvorfor mulig:* SiteDoc er tyngst å containerisere (monorepo, `sharp`, Prisma, poppler/tesseract/xvfb, Python embedding/oversettelse, tunge konvertere). Gir læring på de enkle først.
3. Behold PM2 overalt. **Frarådes** — gir ikke gevinsten ny server skal levere.

> **Anbefaling totalt:** Valg 2-alt.1 som mål, men **SiteDocs Python-tjenester og tunge konvertere er en egen underbeslutning** (egne containere vs host-tjenester) som tas når vi kommer til SiteDoc-fasen — ikke nå.

### Valg 3 — Datamigrering (dump/restore + verifisering)

- **Postgres:** `pg_dump -Fc` (custom format) per database på dagens server → kopier → `pg_restore` inn i ny container. **Aldri DROP på kildedata.** Verifiser: rad-tall per tabell (kilde vs mål), spot-sjekk nøkkeltabeller, deretter app-røyktest.
- **SQLite (Sendfil):** konsistent kopi via `VACUUM INTO`/`.backup` (WAL-modus → ikke bare `cp`), kopier `uploads/`-treet, verifiser rad-tall + checksum på filer.
- **Cutover-mønster per app:** dump → restore → verifiser data → bytt tunnel/DNS → verifiser live innlogget → **la gammel app stå urørt som rollback i N dager.**

### Valg 4 — Rekkefølge (pilot → sist)

1. **(ANBEFALT pilot) Sendfil.** Lavest risiko: SQLite (ingen delt Postgres), enkel single-prosess, eget hostnavn, ingen betaling, lav trafikk, triviell rollback. Beviser Docker + tunnel-cutover ende-til-ende på lav innsats.
2. **Tromsosalsaklubb.** Middels: Postgres+Prisma, multi-tenant, **Stripe/Vipps webhooks** (eksterne callback-URLer → ekstra cross-app-omtanke), flere domener.
3. **SiteDoc SIST.** Mest kritisk (kundedata kommer) og mest kompleks. Test-miljø migreres/etableres før prod; prod helt til slutt.

### Valg 5 — Tunnel/DNS-cutover (kjernerisiko — krever Kenneth-beslutning ⚠️)

1. **(ANBEFALT) Ny, separat cloudflared-tunnel på ny server.** Per app: flytt hostnavnets DNS-CNAME fra gammel til ny tunnel ved cutover. *Hvorfor:* rører ikke dagens delte config (lav blast-radius på dagens prod), rollback = pek CNAME tilbake. Test alltid mot et **midlertidig subdomene** (f.eks. `sendfil-ny.sitedoc.site`) før prod-hostnavnet flippes.
2. Rediger dagens delte tunnel-config til å rute hostnavnet til ny server over tailnet. Beholder én tunnel, men hver endring rører live delt config → høyere risiko for alle apper. **Frarådes.**

---

## 3. Fase 0 — Read-only kartlegging (Kenneth kjører, ingen endringer)

Verifiser antakelsene mot faktisk tilstand før noe besluttes endelig. **Alt er read-only — endrer ingenting.** Kenneth kjører, limer rå utdata tilbake; kontroll-Claude verifiserer.

### 🖥️ KJØR (Kenneth) — Blokk A: dagens server (`ssh sitedoc`)

```bash
ssh sitedoc '
echo "===== OS / PG VERSION =====";
grep PRETTY /etc/os-release;
sudo -u postgres psql -tc "SHOW server_version;";
echo "===== DATABASER + STORRELSE =====";
sudo -u postgres psql -c "SELECT datname, pg_size_pretty(pg_database_size(datname)) AS storrelse FROM pg_database WHERE datistemplate=false ORDER BY pg_database_size(datname) DESC;";
echo "===== PG ROLLER =====";
sudo -u postgres psql -c "\du";
echo "===== CLOUDFLARED: AKTIV CONFIG =====";
ps aux | grep -o "[c]loudflared.*--config [^ ]*";
echo "===== CLOUDFLARED INGRESS (hostnavn -> service) =====";
sudo grep -E "hostname|service" /etc/cloudflared/config.yml;
echo "===== PM2 =====";
pm2 list;
echo "===== LYTTENDE PORTER =====";
sudo ss -tlnp | grep -E ":3[0-9]{3}|:5432|:80";
echo "===== DATA-STORRELSER =====";
du -sh ~/programmering/sendfil/data ~/programmering/sendfil/uploads ~/programmering/sitedoc/apps/api/uploads 2>/dev/null;
echo "===== ENV-FILER (kun nokkel-NAVN, aldri verdier) =====";
for f in ~/programmering/sendfil/.env ~/programmering/tromsosalsaklubb/.env.local ~/programmering/sitedoc/apps/api/.env ~/programmering/sitedoc/apps/web/.env.local ~/programmering/sitedoc/packages/db/.env; do echo "--- $f ---"; if [ -f "$f" ]; then grep -oE "^[A-Za-z0-9_]+=" "$f" | sort; else echo "(finnes ikke)"; fi; done
'
```

### 🖥️ KJØR (Kenneth) — Blokk B: ny server (`ssh server-ny`)

```bash
ssh server-ny '
echo "===== OS =====";
grep PRETTY /etc/os-release;
echo "===== DOCKER? (forventet: ikke installert enna) =====";
docker --version 2>/dev/null || echo "docker IKKE installert";
docker compose version 2>/dev/null || echo "compose IKKE installert";
echo "===== PM2 / HOST-POSTGRES? (forventet: ingen) =====";
which pm2 2>/dev/null || echo "ingen pm2";
systemctl is-active postgresql 2>/dev/null || echo "ingen host-postgres";
echo "===== DISK =====";
df -h /;
echo "===== CPU / MINNE =====";
nproc; free -h;
echo "===== NETT =====";
ip -br a; ip route | grep default;
echo "===== TAILSCALE =====";
tailscale status 2>/dev/null | head -5 || echo "tailscale status utilgjengelig"
'
```

### ⚠️ Manuell sjekk (Kenneth, Cloudflare-dashboard — ikke SSH)

Hvilke hostnavn er gated av **Cloudflare Access** i dag? Særlig `ssh.sitedoc.no`, test-hostnavn (`test.*`, `api-test.*`), og sendfil-admin. (Avgjør K-4/K-5-status og hva som må reetableres på ny tunnel.)

> **Stopp-punkter** rapporteres til Kenneth (PG-major-mismatch mot 16, uventede delte hostnavn i ingress, for lite diskplass på ny server) — ikke gjett videre.

### RESULTAT — Fase 0 verifisert 2026-06-08 (kjørt av Kenneth fra Mac)

**Ingen hard-stopp. Klar for grunnmur.**

- **PostgreSQL 16.14** på dagens server → pin **major 16** i container. ✅
- **DB-størrelser (små, lett dump/restore):** `sitedoc_test` 215 MB, `sitedoc` 40 MB, `tromsosalsaklubb` 14 MB.
- **PG-roller:** kun `kemyr` (superuser) + `postgres`. **Ingen per-app-rolle** — alle apper kjører som superuser `kemyr` (del av K-7). → Ny server: **egen least-privilege-rolle per database**.
- **Ny server:** ren (ingen docker/pm2/host-postgres), Ubuntu 24.04.4, **8 vCPU / 15 GiB RAM / 86 GB ledig**, `eno1` 192.168.1.209 + tailnet 100.76.248.15. ✅
- ⚠️ **Salsaklubb er IKKE ett hostnavn — det er 5+ inkl. wildcard:** `sitedoc.online`, `kontroll.sitedoc.online`, `honefosssalsa.sitedoc.online`, `sitedoc.site`, **`*.sitedoc.site`** (kunde-subdomener) → alle til :3200. **Salsaklubb-cutover må flytte hele settet samtidig** (mest komplekse DNS-steg). Sendfil er fortsatt rent isolerbart: `sendfil.sitedoc.site` er en egen, mer spesifikk DNS-record som vinner over wildcard.
- ⚠️ **Sendfil `uploads/` = 4.6 GB** (SQLite kun 4.1 MB; sitedoc uploads 1.4 GB). → Cutover bruker **rsync (pre-sync + final delta)**, ikke én kopi, for lav nedetid.
- **K-8 bekreftet:** de fleste apper binder `0.0.0.0`/`*` (kun 3302 + 5432 binder 127.0.0.1). → Containere binder kun internt nett/127.0.0.1.
- **Env-funn:** `sendfil/.env` finnes ikke (konfig via PM2-env / defaults — sendfil-admin er Access-gated, trolig minimale app-secrets). `tromsosalsaklubb/.env.local` finnes ikke på forventet sti → **må lokaliseres** (har Stripe/Vipps/OAuth) før salsaklubb-fasen. SiteDoc-env bekreftet (api: DATABASE_URL/AUTH_SECRET/RESEND/VEGVESEN/APP_URL; web: + Google/Microsoft OAuth).
- **Gjenstår manuelt:** Cloudflare Access-policy per hostnavn (dashboard).

---

## 4. Staged utførelse (per app — ingenting før godkjenning)

**Felles grunnmur (lav risiko, rører ikke dagens prod) — rekkefølge justert 2026-06-08 fordi sendfil-piloten er SQLite-only og ikke trenger Postgres:**
1. ✅ **Docker Engine + Compose** installert på ny server (29.5.3 / v5.1.4, hello-world OK). Containere bindes kun til internt nett/`127.0.0.1` (lukker K-8).
2. **Ny cloudflared-tunnel** (Valg 5-alt.1) — det piloten trenger. 2a: install + login + opprett tunnel (ingen DNS). 2b: test-subdomene `sendfil-ny.sitedoc.site` (DNS → lås + godkjenning).
   - ✅ 2a (2026-06-08): cloudflared 2026.5.2 installert; `cert.pem` autentisert; tunnel **`sitedoc-ny`** opprettet, UUID `eb262307-f893-4fbf-82b7-420178cf6aea`. Creds-fil hos Kenneth.
   - **Funn:** det finnes allerede en dormant `salsaklubb`-tunnel (`f1a0e2c4-...`, 0 connections) ved siden av aktiv `sitedoc`-tunnel (`189a5af2-...`). Avklares i salsaklubb-fasen (gjenbruk vs. rydd).
3. **Delt Postgres 16-container** + least-privilege rolle/database per app + backup-volum + `pg_dump`-cron — **utsatt til salsaklubb-fasen** (sendfil bruker ikke Postgres).

**Container-herdingsprofil (gjelder alle, særlig de internett-vendte med ikke-betrodd input — sendfil-opplasting, salsaklubb-betaling):**
- Kjør som **ikke-root** bruker; `read_only: true` rot-filsystem + eksplisitt skrive-volum kun der appen trenger det.
- `cap_drop: ALL`, `security_opt: [no-new-privileges:true]`.
- Kun appens eget data-/uploads-volum montert — **aldri** tilgang til andre appers volumer (bryter K-7-kjeden: ett kompromiss ≠ alle apper).
- Internt docker-nett / `127.0.0.1`; nåbar kun via tunnelen.
- Ressursgrenser (CPU/minne/pids) — demper DoS via store opplastinger.
- Merk: container er forsvar-i-dybden, ikke en VM-grense (kerneleksploits kan bryte ut). Sikkerheten kommer av *hvordan* containeren kjøres, ikke av at den er en container.

**Pilot — Sendfil:**
> **PILOT FULLFØRT 2026-06-08 ✅** — `sendfil.sitedoc.site` kjører nå i Docker på ny server, DNS flyttet til tunnel `sitedoc-ny`. Live verifisert: miniatyrer rendrer, admin lister alle delinger, `file`+`thumb` HTTP 200 (lokalt før DNS + i nettleser etter). Gammel sendfil står **stoppet men intakt** på gammel server som rollback.
>
> **Fremdrift:** Docker-filer pushet til repo. `sendfil:latest` bygget (383 MB). Kode via **rsync fra Mac** (GitHub HTTPS-passord-auth død → server-git-auth via SSH-nøkkel utsatt). Data via **Mac som rsync-mellomledd** (serverne når ikke hverandre direkte). Sti-fiks (absolutt→`/uploads`) kjørt på DB etter kopi.
>
> **Lærdommer til app 2/3:** (1) WAL-modus SQLite — kopier alle tre filer; (2) absolutte stier i DB — verifiser ekte fil-levering lokalt (ikke bare delingsside) FØR DNS; (3) direkte windowed cutover funker for lav-risiko-app og bevarer Access-policy på hostnavnet; (4) rollback (CNAME tilbake + pm2 start) testet og virker.

1. Bygg Docker-image, mount SQLite-volum + `uploads/`. Roter SSH/secret-mønster (ikke gjenskap `sshpass`-passordet — Kenneth setter nøkler).
2. **Uploads 4.6 GB:** rsync **pre-sync** mens gammel app kjører (kan gjentas, ufarlig). SQLite kopieres konsistent (`VACUUM INTO`/`.backup`, ikke `cp` pga. WAL). Verifiser rad-tall + checksum/fil-tall.
3. Eksponer via `sendfil-ny.sitedoc.site`, røyktest (opplasting + nedlasting + iOS-share + Access-gating).
4. ⚠️ **Cutover (lås + godkjenning):** **stopp gammel sendfil FØRST** (→ SQLite checkpointer WAL inn i hovedfila) → kopier `sendfil.sqlite` (nå komplett + konsistent) → **rsync final delta** av uploads → flytt `sendfil.sitedoc.site`-CNAME til ny tunnel (egen DNS-record, vinner over `*.sitedoc.site`). Verifiser live. Gammel `sendfil` står urørt som rollback.
   - **WAL-lærdom (2026-06-08):** sendfil kjører SQLite i WAL-modus; ~4.1 MB av dataene lå i `-wal` mens hovedfila var 108 KB. `cp sendfil.sqlite` alene mister WAL-data. Kopier alltid alle tre (`.sqlite` + `-wal` + `-shm`). Merk: `pm2 stop` checkpointer IKKE (dreper prosessen) — så `-wal` består også etter stopp.
   - **ABSOLUTT-STI-lærdom (2026-06-08):** `files.storage_path`/`thumb_path` lagres som **absolutte stier** (`storage.ts` → `join(UPLOADS_ROOT, …)`; gammel server hadde ingen `.env` → `/home/kemyr/programmering/sendfil/uploads/…`). Serving (`share.ts`/`download.ts` → `createReadStream(storage_path)`) bruker dem direkte → «Fil mangler» + blanke thumbs i container der stien er `/uploads/…`. **Fiks ved cutover (etter DB-kopi):** `UPDATE files SET storage_path=substr(storage_path,instr(storage_path,'/uploads/')); UPDATE files SET thumb_path=substr(thumb_path,instr(thumb_path,'/uploads/')) WHERE thumb_path IS NOT NULL;` (idempotent). **Verifiser fil+thumb HTTP 200 lokalt FØR DNS flyttes** (delingssiden gir 200 selv om filene er døde — ikke nok alene).
   - **📋 OPUS-INSTRUKS (oppfølger, etter pilot):** endre `storage.ts` til å lagre **relativ** sti + resolve mot `UPLOADS_ROOT` ved servering → framtidige flyttinger slipper sti-omskriving. Motor-uavhengig.

**App 2 — Tromsosalsaklubb:**
1. Docker + Prisma; `pg_dump -Fc tromsosalsaklubb` → `pg_restore` til ny container. Verifiser rad-tall per tabell + innlogging.
2. ⚠️ **Stripe/Vipps:** webhook-/callback-URLer og NEXTAUTH_URL må stemme med endelig domene før prod-flip — eksterne integrasjoner = ekstra cross-app-omtanke. Beskrives som eget delsteg m/rollback.
3. Test mot midlertidig subdomene → ⚠️ cutover (lås + godkjenning) per domene.

**App 3 — SiteDoc (sist):**
1. Egen underbeslutning: containerisering av web/api + Postgres, og hva som skjer med Python-tjenester (3302/3303) + native apt-deps + tunge konvertere (egne containere vs host).
2. **Test-miljø først** (`sitedoc_test`): dump/restore + full funksjonell verifisering. Deretter prod (`sitedoc`) — `pg_dump -Fc` → restore → rad-tall + innlogget verifisering i nettleser (ikke bare HTTP 200, jf. CLAUDE.md).
3. ⚠️ Prod-cutover av `sitedoc.no`/`api.sitedoc.no` helt til slutt, lås + godkjenning + rollback. **«ALDRI slett data».**

**Avvikling av gammel server (per app, etter bekreftet flytting):**
- Gammel boks beholder K-3 (ukryptert disk) + K-4 (SSH passord/root, åpent CF-Access-spørsmål) så lenge den kjører som rollback. **Ikke legg ny sensitiv data på gammel boks i overlappen.**
- Når en app er verifisert stabil på ny server i N dager: stopp appens PM2-prosess på gammel boks, fjern dens ingress-entry fra gammel tunnel-config (lås + godkjenning), behold data-backup.
- Når **alle** apper er flyttet: avvikle/herdé gammel tunnel + gammel SSH-eksponering helt. Det lukker den gjenværende K-4-flaten.

**Secret-rotasjon (Kenneth kjører — jeg verifiserer kun format/lengde):**
- `virjo` er i dag gjenbrukt som DB-passord **og** SSH-passord (hardkodet i `Sendfil/CLAUDE.md` og `Tromsosalsaklubb/setup-ubuntu.sh`). Gjenbrukt svakt passord på tvers av DB+SSH er et eget funn.
- Ved migrering: roter til **distinkte sterke verdier per app/rolle**, hold dem **ute av repo** (env-fil/secrets, ikke committet skript). Fjern de hardkodede verdiene fra repo-filene.

---

## 5. Harde rammer (ufravikelige — fra kickoff/lock/CLAUDE.md)

- Cross-app (DNS/OAuth/tunnel/webhooks): **lås + Kenneths godkjenning + rollback per steg.**
- Staged, **én app om gangen**, lavest-risiko først, **SiteDoc sist**.
- **«ALDRI slett data»:** dump/restore + verifisering, aldri DROP+CREATE på kildedata.
- **Nøkkelregelen:** Claude rører aldri nøkkel-/secret-verdier; Kenneth kjører alle nøkkel-/env-/rotasjons-operasjoner; jeg verifiserer kun via lengde/format.
- **Aldri prod uten eksplisitt forespørsel.** Test → funksjonell verifisering → prod.
- Migreringen skal **lukke** sikkerhetsfunn (K-3/K-4 alt løst på ny boks; lukk K-7 via container-isolasjon, K-8 via `127.0.0.1`-binding, K-5 via Access på test), **ikke gjenskape** dem.

---

## 6. Det denne planen IKKE gjør

- Migrerer **ikke** «Fil til database» (blir værende).
- Endrer **ikke** dagens server/prod før hver cutover er eksplisitt godkjent.
- Tar **ikke** beslutning om SiteDocs Python-tjeneste-containerisering nå (egen underbeslutning i SiteDoc-fasen).
- Committer/pusher ingenting (kontroll-Claude committer ikke; det er Kenneth/Opus).

---

## 7. Beslutninger og åpne spørsmål

**Besluttet (2026-06-08):**
- ✅ **Rekkefølge:** sendfil → salsaklubb → sitedoc.
- ✅ **SiteDoc prod → ny server**, som kunde-testfase; ekstern EU/EØS-host senere (se § 0).
- ✅ **Sendfil containeriseres** (internett-vendt + ikke-betrodd input → størst isolasjonsgevinst).
- ✅ **Tunnel (Valg 5):** ny separat cloudflared-tunnel på ny server + per-hostnavn DNS-cutover, testet via midlertidig subdomene først.
- ✅ **Docker-omfang (Valg 2):** alt i Docker (alle tre apper + delt Postgres).
- ✅ **Fase 0 read-only kartlegging:** kommando-blokker levert (se § 3) — Kenneth kjører, limer rå utdata tilbake, kontroll-Claude verifiserer.

**Neste ⚠️ BESLUTNING-er (kommer etter Fase 0-utdata):**
- PG-major i container (forventet 16 — bekreftes mot dagens versjon).
- SiteDocs Python-tjenester (3302/3303) + tunge konvertere: egne containere vs. host-tjenester.
- Per-app cutover-tidspunkt (hver flip = ⚠️ BESLUTNING + lås + rollback).
