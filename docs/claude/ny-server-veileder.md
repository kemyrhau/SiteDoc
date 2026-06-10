# Drift-veileder — server-ny (Docker)

> Praktisk runbook for ny server: hvordan deploye riktig, hvordan systemet kommuniserer, og hvordan få det opp igjen hvis noe slutter å virke. Dypere referanse: [`infrastruktur.md`](infrastruktur.md). Docker-oppsett: [`../../docker/DOCKER-NOTES.md`](../../docker/DOCKER-NOTES.md).
>
> **Gjelder fra 2026-06-10.** Gammel PM2/WSL-server er utgått (rollback til den er beskrevet til slutt). Bruk ALDRI `ssh sitedoc`/`pm2` for ny server.

---

## 1. Kort om hva som kjører hvor

Én Ubuntu 24.04-boks (`server-ny`, `192.168.1.209`, tailnet `100.76.248.15`). Tre apper, alle i Docker, alle bak samme cloudflared-tunnel `sitedoc-ny`:

| App | Stack-mappe | Container(e) | Domene |
|-----|-------------|--------------|--------|
| sitedoc | `~/stack/sitedoc` | `sitedoc-api`, `sitedoc-web`, `sitedoc-embed`, `sitedoc-oversettelse` | sitedoc.no / api.sitedoc.no |
| salsaklubb | `~/stack/salsaklubb` | `salsaklubb` | sitedoc.online + *.sitedoc.site |
| sendfil | `~/stack/sendfil` | `sendfil` | sendfil.sitedoc.site |
| (delt) | `~/stack/postgres` | `postgres` (pgvector/pg16) | intern :5432 |

Alle containere har `restart: unless-stopped` → starter automatisk ved boot/krasj.

---

## 2. Hvordan kommunikasjonen fungerer

### Du → serveren (drift)
```
Mac  → Tailscale (tailnet)  → ssh server-ny   (nøkkel ~/.ssh/server_ny)
```
Krever at både Mac og server er på Tailscale. `ssh server-ny` er eneste vei inn — ingen åpen SSH mot internett.

### Bruker → appen (prod-trafikk)
```
Nettleser → DNS (Cloudflare) → Cloudflare edge → tunnel sitedoc-ny
          → cloudflared (systemd på server) → container-port på 127.0.0.1 → app
```
Ingen container er eksponert direkte mot internett — alt går gjennom tunnelen. Portene bindes kun til `127.0.0.1` på serveren.

### Mellom containerne (internt, sitedoc)
```
sitedoc-web  ── deler nett-namespace med ──►  sitedoc-api   (web kaller localhost:3001 for /api og /uploads)
sitedoc-api  ──► postgres:5432       (DATABASE_URL = postgresql://sitedoc:***@postgres:5432/sitedoc)
sitedoc-api  ──► embed:3302          (NORBERT_URL,  AI-søk/embedding)
sitedoc-api  ──► oversettelse:3303   (OVERSETTELSE_URL)
```
`sitedoc-web` har `network_mode: "service:sitedoc-api"` — derfor publiserer `sitedoc-api` BEGGE porter (3001 + 3100). De andre tjenestene snakker sammen over docker-nettet `appnet` på tjenestenavn (`postgres`, `embed`, `oversettelse`).

> ML-tjenestene må binde `0.0.0.0` for å nås cross-container (de bor i egne containere). `NORBERT_HOST=0.0.0.0` settes i compose; `oversettelse` binder `0.0.0.0` fast.

---

## 3. Hvordan deploye riktig

**All deploy skjer fra Mac via rsync + docker compose på server-ny.** Server-git er ikke satt opp, så koden synkes (ikke `git pull` på server).

### Full sitedoc-deploy
```
git push
```
```
rsync -a --exclude node_modules --exclude .next --exclude .git ~/Documents/Programmering/SiteDoc/ server-ny:stack/sitedoc/
```
```
ssh -t server-ny 'cd ~/stack/sitedoc && sudo docker compose -f docker/docker-compose.yml up -d --build'
```
- `ssh -t` (TTY) kreves — uten det feiler `sudo` med «a terminal is required».
- `--build` bygger images på nytt; uten det brukes eksisterende.
- Verifiser etter: `ssh -t server-ny 'sudo docker compose -f ~/stack/sitedoc/docker/docker-compose.yml ps'` (alle `Up`) + `curl -sI https://sitedoc.no` + innlogget i nettleser.

### Kirurgisk deploy (kun enkelte tjenester)
Legg tjenestenavn til slutt for å bare bygge/restarte dem (rører ikke resten):
```
ssh -t server-ny 'cd ~/stack/sitedoc && sudo docker compose -f docker/docker-compose.yml up -d --build embed oversettelse'
```

### Prisma-migrasjoner (åpent punkt)
`prisma migrate deploy` er **ikke automatisert** i Docker-deployen. Klientene genereres i bygget, men ved schema-endring må migrasjonen kjøres manuelt mot `postgres`-containeren for alle fire db-pakker (db, db-maskin, db-timer, db-varelager) FØR build. Dette bør automatiseres (se TODO i `infrastruktur.md`).

### Regler
- **Verifiser alltid som innlogget bruker** — HTTP 200 er ikke nok.
- **Aldri prod-deploy uten Kenneths «ja».**
- **Bruk aldri `ssh sitedoc`/`pm2`** — det er gammel server.

---

## 4. Gjenoppretting — «noe slutter å virke»

Generell førstehjelp: `ssh server-ny`, så `cd ~/stack/<app>/` og `sudo docker compose -f docker/docker-compose.yml ps` + `... logs --tail 50 <container>`.

| Symptom | Sjekk / fiks |
|---------|--------------|
| **Hele siden nede / 404** | 1) Tunnel: `ssh -t server-ny 'sudo systemctl status cloudflared'` → `restart` ved behov. 2) Containere: `docker compose ps` → `up -d`. 3) DNS: CNAME for hostnavnet peker på `eb262307-…cfargotunnel.com` (Cloudflare-dashboard). |
| **Får ikke `ssh server-ny`** | Tailscale nede? Sjekk at server er på tailnet (`tailscale status` fra Mac). Er boksen på? (auto-on etter strømbrudd, men sjekk fysisk.) |
| **Container krasj-looper** | `docker compose logs --tail 100 <container>` for årsak → fiks → `up -d --build <container>`. |
| **AI-søk/embedding feiler** | `embed`-containeren oppe? Binder den `0.0.0.0`? Re-sjekk fra api: `sudo docker exec sitedoc-api node -e "const n=require('net');const s=n.connect(3302,'embed');s.on('connect',()=>{console.log('REACHABLE');s.end()});s.on('error',e=>console.log('UNREACHABLE',e.code))"` → skal gi `REACHABLE`. |
| **Oversettelse feiler** | `oversettelse`-container oppe + `OVERSETTELSE_URL=http://oversettelse:3303` satt i `api.env`/compose. |
| **«Server error» ved innlogging** | `DATABASE_URL` i `docker/env/web.env` + `api.env` peker `@postgres:5432`, rolle `sitedoc`. `up -d --force-recreate` etter env-endring (env_file leses ikke på nytt automatisk). |
| **OAuth `redirect_uri_mismatch`** | `AUTH_URL`/`NEXTAUTH_URL=https://sitedoc.no` + `AUTH_TRUST_HOST=true` i `web.env`. |
| **Etter strømbrudd** | Boksen slår seg på selv, TPM låser opp kryptert disk, containere starter (`unless-stopped`), cloudflared starter (systemd). Verifiser: `ssh server-ny` → `docker compose ps` (alle Up) → `curl https://sitedoc.no`. |
| **404 dypdiagnose** | `ps aux \| grep cloudflared` (hvilken config), `grep <host> /etc/cloudflared/config.yml` (routet?), Cloudflare DNS (CNAME finnes?), `cloudflared tunnel info sitedoc-ny` (connector oppe?). |
| **Ny hostname svarer ikke** | Hostnames utenfor cert-sonen rutes via Cloudflare-dashboard, ikke `cloudflared tunnel route dns` (jf. salsaklubb `.online`-lærdom). |

---

## 5. Nødbremse: rollback til gammel server

Gammel prod (PM2 på Kenspill/WSL) står **stoppet** som rollback til ny server er bekreftet stabil. Hvis ny server svikter kritisk og må forlates midlertidig:

1. Flytt DNS for berørte domener tilbake til gammel tunnel (`sitedoc`, ID `189a5af2-…`) via Cloudflare-dashboard.
2. Start gamle apper på gammel server (`pm2 start`).

> Dette er en **nødløsning** — gammel server er udokumentert ustabil (ukontrollert ukentlig restart). Avvikles helt når ny server er bekreftet stabil; da fjernes gamle hostnames fra gammel tunnel og pm2-appene slettes.
