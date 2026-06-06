---
name: simulator-ipv6-nordvpn
description: Rotårsak + feilsøking for iOS-simulator som henger på evig spinner — ødelagt IPv6-ruting fra NordVPN utun-rester. Sjekk dette FØR du mistenker koden.
sist_verifisert_mot_kode: 2026-06-06
status: aktiv
---

# iOS-simulator henger på evig spinner — IPv6/NordVPN rotårsak

> **TL;DR:** Hvis iOS-simulatoren henger på evig spinner og fetcher til `api-test.sitedoc.no`
> aldri returnerer — **sjekk VPN/IPv6 FØR du mistenker koden eller serveren.** Rotårsak
> (2026-06-06): NordVPN (NordLynx/WireGuard) etterlot 8 `utun`-grensesnitt som presenterer en
> **død IPv6-sti**. Simulatorens happy-eyeballs prøver IPv6 (AAAA) og staller. curl/Mac faller
> raskt til IPv4 og virker — derfor «server svarer, men appen henger».

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

## Rotårsak

**Ødelagt IPv6-ruting via NordVPN (NordLynx/WireGuard) `utun`-rester.** Simulatorens
`NSURLSession` happy-eyeballs prøver IPv6 (AAAA-adressen) mot api-test/google, men IPv6-stien er
død (etterlatte NordVPN-`utun`-ruter) → `fetch` henger (ingen timeout → evig spinner) eller kaster
`Network request failed`. curl/macOS faller raskt til IPv4 og virker.

**Viktig:** NordVPN **Disconnect + Quit fjernet IKKE** `utun`-grensesnittene — 8 `utun` (utun0–7,
MTU 1380 = WireGuard-typisk) lå fortsatt UP etter Quit, og IPv6-hoster feilet fortsatt. `scutil
--nwi` viste «No IPv6 states» men simulatoren prøvde IPv6 likevel via `utun`-restene. **Krever
reboot eller IPv6 → Link-local only.**

## Diagnose-kommandoer (gjenbrukbare)

```bash
ifconfig | grep -E "^utun"        # utun-grensesnitt — MTU 1380 = VPN-typisk
pgrep -fl -i nord                 # kjører NordVPN-daemoner?
scutil --nwi                      # primær rute + aktiv IPv6-state?
dig +short api-test.sitedoc.no AAAA   # har hosten IPv6? (ja → happy-eyeballs prøver den)
# Nøytral-host-fetch-mønster i appen: IPv4-only host (github) vs IPv6-host (google/api-test)
```

## Løsninger (rangert)

1. **Reboot Mac** — river ned `utun`-restene helt. Reneste.
2. **IPv6 → Link-local only** — `networksetup -setv6off Wi-Fi` (tilbake: `-setv6automatic Wi-Fi`),
   eller System Settings → Wi-Fi → Details → TCP/IP → Configure IPv6 → Link-local only. Tvinger
   IPv4 (samme sti som curl). Omgår uten reboot.
3. **Full NordVPN-avinstallering** hvis problemet gjentar seg.

## Separat kode-robusthetsbug (ÅPEN OPPFØLGER)

`verifiser`-fetchen i `apps/mobile/src/providers/AuthProvider.tsx` (sjekkToken) mangler
**timeout/AbortController**. En hengende fetch gir **evig spinner** i stedet for å degradere til
cachet bruker / innloggingsskjerm. Bør fikses uansett miljøårsak:
- Legg AbortController med timeout (f.eks. 10–15 s) på verifiser-fetchen.
- Vurder samme på øvrige rå fetcher (dev-login) + en fornuftig tRPC/React Query-timeout.
- Effekt: ved tapt/hengende respons faller appen til offline/cachet i stedet for å låse seg.

## Sjekkliste — «hvis simulatoren henger igjen»

1. **Sjekk VPN/IPv6 FØRST, ikke koden:** `pgrep -fl -i nord`, `ifconfig | grep utun`, `scutil --nwi`.
2. Test IPv4-only host vs IPv6-host fra appen (github vs google/api-test).
3. Hvis IPv6-hoster henger men IPv4-only virker → IPv6-ruting død → reboot / IPv6 av.
4. Først når VPN/IPv6 er utelukket: mistenk kode/server.
