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

### Hvorfor både Cloudflare og Tailscale

De løser to ulike problemer og erstatter ikke hverandre:

- **Cloudflare = offentlig inngang (for kundene).** Tunnelen kobler seg *ut* fra serveren til Cloudflare, så vi slipper å åpne porter eller ha fast offentlig IP hjemme. Cloudflare gir DNS, automatisk HTTPS/TLS, DDoS-/WAF-beskyttelse og skjuler serverens IP. Publikum er ikke på Tailscale-nettet, så de *må* nå appene via en offentlig vei.
- **Tailscale = privat inngang (for drift).** Privat VPN mellom våre egne enheter — slik vi administrerer serveren (`ssh server-ny`) uten å eksponere SSH mot internett.

Kort: **Cloudflare slipper kundene inn, Tailscale slipper oss inn.** På gammel server gikk SSH også via Cloudflare (`ssh.sitedoc.no`); den rollen flyttet til Tailscale. De er uavhengige — skulle Cloudflare ha trøbbel, kommer vi fortsatt inn via Tailscale for å fikse ting.

---

## 3. Hvordan deploye riktig

🔴 **Deploy-kommandoene bor i [`DEPLOY-RUNBOK.md`](DEPLOY-RUNBOK.md)** — test (§ 1), prod (§ 2),
OTA (§ 3), env-filer på server (§ 4), rekkefølge (§ 5) og rollback (§ 6), i rekkefølge.
`deploy-test.sh <hash>` / `deploy-prod.sh` rsyncer og skriver ut de ferdig utfylte `ssh -t`-kommandoene
Kenneth limer (`--exclude docker/env` innebygd; scriptene migrerer alle fire db-pakker).
**Finner du en deploy-kommando i en annen fil, er den foreldet.**

Ufravikelig uansett hvor du leser: verifiser alltid som **innlogget** bruker (HTTP 200 er ikke nok) ·
**aldri** prod-deploy uten Kenneths «ja» · **aldri** `ssh sitedoc`/`pm2` (gammel server) ·
**aldri** `--remove-orphans` på prod-/test-compose.

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

---

## 6. Brannmur (🟡 anbefalt, ikke aktivert)

Serveren har i dag ingen host-brannmur (`ufw inactive`) — den trenger den strengt tatt ikke, siden
begge inngangsveier er utgående-initiert (Cloudflare Tunnel + Tailscale) og alle app-porter binder
`127.0.0.1`. Bakgrunn/portkart: [`infrastruktur.md`](infrastruktur.md). Som defense-in-depth ved
oppsett av en ny boks:

```sh
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow in on lo
sudo ufw allow in on tailscale0    # MÅ stå FØR enable — ellers lockout
sudo ufw enable
```

⚠️ **Kjør kun med fysisk konsoll tilgjengelig.** `allow outgoing` er påkrevd — cloudflared, Tailscale,
Open-Meteo, Resend, embed/oversettelse og docker-pull er alle utgående.
