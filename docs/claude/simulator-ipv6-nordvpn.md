---
name: simulator-ipv6-nordvpn
description: Rotårsak + feilsøking for iOS-simulator som henger/feiler mot api-test — AAAA-DNS-oppslag som staller fordi Mac-en mangler fungerende IPv6-rute. NordVPN trenger ikke kjøre. Sjekk dette FØR du mistenker koden.
sist_verifisert_mot_kode: 2026-06-07
status: aktiv
---

# iOS-simulator henger/feiler mot api-test — AAAA-DNS / IPv6 rotårsak

> **TL;DR (skjerpet 2026-06-07):** Hvis iOS-simulatoren henger på spinner eller fetcher til
> `api-test.sitedoc.no` feiler med `Network request failed` — **rotårsaken er AAAA-DNS-oppslag som
> staller, ikke utun-rester eller NordVPN.** api-test publiserer ekte AAAA-records (Cloudflare
> IPv6), Mac-en har **ingen fungerende IPv6-rute**, og simulatorens happy-eyeballs prøver IPv6 og
> feiler. **NordVPN trenger IKKE kjøre** for å trigge dette — det skjer på en ren Mac uten VPN.
> curl/Mac virker fordi den bruker IPv4 og aldri prøver den ekte IPv6-adressen.
>
> **Fiks:** `sudo networksetup -setv6off Wi-Fi` → `npx expo start --clear` → ved vedvarende spinner,
> logg ut/inn i appen for å nullstille SecureStore. Detaljer i [Løsninger](#løsninger-rangert).

## Symptom

- App henger på **evig spinner** i iOS-simulator (aldri forbi auth-fasen).
- Alle **GET-fetcher til api-test** (og andre IPv6-hoster) henger ved `await fetch` —
  **ingen retur, ingen feil** (eller intermitterende `TypeError: Network request failed`).
- Serveren ser requesten og svarer 200 — men klienten mottar aldri responsen.

## Feilsøking (kronologi 2026-06-06)

1. **Server OK:** `mobilAuth.verifiser` + `organisasjon.hentMineMedlemskap` fullfører **200 på
   3–15 ms** i serverloggen (verifisert 4×). Ikke server, ikke manglende data.
2. **curl OK:** `curl` fra samme Mac til `https://api-test.sitedoc.no/trpc/...` får **200 på
   ~0,15 s** — alle user-agents (tom/CFNetwork/okhttp) + HTTP/2. Ikke Cloudflare-WAF, ikke UA.
3. **ngrok eliminert:** ngrok bærer kun Metro/bundle (`EXPO_PACKAGER_PROXY_URL`), **ikke** API-en
   (`EXPO_PUBLIC_API_URL=https://api-test.sitedoc.no`). LAN-Metro uten ngrok → henger likevel.
4. **Kode (b) eliminert via [AUTH]-instrumentering:** `console.log` før/etter `await fetch`,
   etter `res.json()`, i `finally`, og i catch. Resultat: **`fetch start` logges, `fetch retur`
   ALDRI** → `await fetch` settler verken med respons eller feil. Altså ikke `res.json()`-stall,
   ikke state/race/StrictMode, ikke kode etter fetch.
5. **Ikke connection-reuse:** health-fetch (første fetch, frisk connection, ingen auth) til
   `api-test/health` henger OGSÅ.
6. **Nøytral-host-test (avgjørende):**
   - `api.github.com` (**IPv4-only**, ingen AAAA) → **alltid 200** (17–284 ms).
   - `www.google.com/generate_204` (**har AAAA**) → **feiler/henger**.
   - `api-test.sitedoc.no` (**har AAAA**) → **henger** (verst rammet).
   → IPv4-only-host virker alltid; IPv6-hoster feiler alltid = lærebok-bevis på ødelagt IPv6.

## Rotårsak (skjerpet 2026-06-07)

**AAAA-DNS-oppslag som staller fordi Mac-en mangler fungerende IPv6-rute.** api-test publiserer
ekte AAAA-records via Cloudflare. Simulatorens `NSURLSession` happy-eyeballs ser AAAA-en og prøver
å koble til IPv6-adressen — men det finnes ingen IPv6-rute → `fetch` henger (ingen timeout → evig
spinner) eller kaster `Network request failed`, uten ren fallback til IPv4. curl/macOS virker fordi
hosten ikke har IPv6 i det hele tatt og bruker IPv4 — den prøver aldri den ekte IPv6-adressen.

**NordVPN trenger IKKE kjøre.** Den opprinnelige diagnosen (2026-06-06) pekte på NordVPN-`utun`-rester,
men 2026-06-07 ble det bekreftet at problemet vedvarer **uten** NordVPN og **uten** utun-rester som
årsak: `pgrep -fl -i nord` tom, og de gjenværende `utun0–5` er **normale macOS-systemgrensesnitt**
(kun link-local `fe80::`, ingen global rute). MTU 1380 på enkelte utun er IKKE en pålitelig
NordVPN-markør — det finnes på en ren reboot. utun-restene var et villspor; årsaken er AAAA + ingen
IPv6-rute.

**Bevis (2026-06-07):**
```
# curl fra Mac — virker via IPv4, prøver aldri ekte IPv6:
curl -s -w "%{http_code} %{remote_ip}\n" https://api-test.sitedoc.no/health   → 200  188.114.96.1  (IPv4)
curl -6 ...                                                                    → 200  ::ffff:188.114.97.1  (IPv4-MAPPET, ikke ekte IPv6)

# DNS — api-test HAR ekte AAAA:
dig +short api-test.sitedoc.no AAAA   → 2a06:98c1:3121::1 / 2a06:98c1:3120::1
dig +short api-test.sitedoc.no A      → 188.114.97.1 / 188.114.96.1

# scutil --nwi → «No IPv6 states found» (hosten har ingen global IPv6)
# Simulator: dev-login (frisk POST, ingen state, ingen retry) → «Network request failed» 4×
# IPv4-only host (api.github.com) fra simulator → alltid 200; AAAA-hoster → feiler
```

**Intermittens:** Reboot ga midlertidig lindring (happy-eyeballs vinner av og til IPv4-løpet), men
forverres tilbake fordi AAAA-en og den manglende IPv6-ruten består. **Reboot er ikke en varig fiks.**
Den varige løsningen er å hindre IPv6-forsøket (slå av IPv6 på Wi-Fi).

## Diagnose-kommandoer (gjenbrukbare)

```bash
dig +short api-test.sitedoc.no AAAA   # ← SJEKK FØRST: har hosten ekte AAAA? (ja → happy-eyeballs prøver IPv6)
scutil --nwi                          # «No IPv6 states» = hosten har ingen global IPv6-rute
curl -s -w "%{http_code} %{remote_ip}\n" https://api-test.sitedoc.no/health   # host virker via IPv4?
ifconfig | grep -E "^utun"        # utun finnes også UTEN VPN (normale macOS-grensesnitt) — ikke diskriminerende
pgrep -fl -i nord                 # NordVPN behøver IKKE kjøre for at feilen oppstår
# Simulator-bevis: dev-login-knappen (frisk POST) → «Network request failed» = AAAA-stall bekreftet.
# Nøytral-host-mønster: IPv4-only host (github) virker; AAAA-host (google/api-test) feiler.
```

## Løsninger (rangert)

**Definitiv fiks-sekvens (2026-06-07):**

1. **Slå av IPv6 på Wi-Fi** — treffer rotårsaken (hindrer IPv6-forsøket). Hosten har uansett ingen
   fungerende IPv6, så ingenting går tapt:
   ```bash
   sudo networksetup -setv6off Wi-Fi        # angre: sudo networksetup -setv6automatic Wi-Fi
   ```
   Eller GUI: System Settings → Wi-Fi → Details → TCP/IP → Configure IPv6 → **Link-local only**.
2. **Start Metro friskt med `--clear`** (rydder bundler-cache + gir tilknyttet terminal/logg):
   ```bash
   cd apps/mobile && npx expo start --clear
   ```
   Relansér appen i simulatoren. Verifiser i terminalen: `[DEV-LOGIN] Svar: 200`.
3. **SecureStore-reset ved vedvarende spinner** — hvis appen fortsatt henger på «Henter prosjekter»
   etter steg 1–2 pga. ufullstendig cachet auth («Ukjent bruker»): logg ut i appen (Mer → Logg ut)
   og logg inn på nytt (dev-login). Nullstiller `sitedoc_valgt_firma` + token/bruker i SecureStore,
   så firma auto-velges og prosjekter laster.

**Fallback (kirurgisk):** pin api-test til IPv4 i `/etc/hosts` (simulatoren arver hostens hosts-fil):
```
188.114.97.1  api-test.sitedoc.no
```
Fjerner AAAA fra oppslaget kun for dette domenet. Ulempe: pinner en Cloudflare-IP — fjern når ferdig.

**Reboot Mac** river ned eventuelle utun-rester, men er **ikke en varig fiks** mot AAAA-stallen
(gir kun midlertidig lindring via happy-eyeballs-racing — se Rotårsak/Intermittens).

## Separat kode-robusthetsbug

**✅ LØST (2026-06-07):** `verifiser`-fetchen i `apps/mobile/src/providers/AuthProvider.tsx`
(sjekkToken) har nå **AbortController med 12 s timeout**. Ved tapt/hengende respons kaster
fetch `AbortError` → fanges av ytre catch → appen degraderer til cachet bruker i stedet for evig
spinner. Samme commit fjernet all `[AUTH]`/`[HEALTH]`/`[NEUTRAL]`-debug-instrumentering brukt til
rotårsak-diagnosen.

**Gjenstående (BACKLOG-oppfølger):** dev-login + øvrige rå fetcher mangler fortsatt timeout, og en
fornuftig tRPC/React Query-timeout er ikke satt. Holdt utenfor denne fiksen for å holde diffen
minimal — se [BACKLOG.md](BACKLOG.md).

## Sjekkliste — «hvis simulatoren henger/feiler igjen»

1. **Sjekk AAAA + IPv6-rute FØRST, ikke koden:** `dig +short api-test.sitedoc.no AAAA` (har AAAA?)
   + `scutil --nwi` («No IPv6 states» = ingen IPv6-rute). Har host AAAA men ingen IPv6-rute → dette er det.
2. **Bekreft fra simulatoren:** dev-login-knappen → `Network request failed` (frisk POST, ingen state).
   IPv4-only host (github) virker mens AAAA-host (api-test) feiler = AAAA-stall bekreftet.
3. **Fiks:** `sudo networksetup -setv6off Wi-Fi` → `npx expo start --clear` → ved vedvarende spinner,
   logg ut/inn (SecureStore-reset). NordVPN/utun er IKKE nødvendig å mistenke.
4. Først når AAAA/IPv6 er utelukket: mistenk kode/server.
