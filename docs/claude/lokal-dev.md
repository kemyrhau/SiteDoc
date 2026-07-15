---
name: lokal-dev
description: Lokal utviklingsflate på Mac — koble til, feilsøke, oppdatere test-data, teste nye funksjoner. FØRSTE stopp når en endring skal ses; test er bekreftelsen før merge, ikke førstegangs-titten.
status: aktiv
sist_verifisert_mot_kode: 2026-07-15
---

# Lokal dev (Mac) — koble til, oppdatere, teste

**Dette er første stopp når du skal se en endring.** Lokal verifisering tar ~1 minutt. En test-deploy-runde tar ~12 minutter med to serverbygg + rsync + helsesjekk. Bruk localhost til å *se* endringen; bruk test til å *bekrefte* den før merge.

## 1. Koble til

| Ting | Verdi |
|------|-------|
| **Server** | Homebrew `postgresql@16` — binærer i `/opt/homebrew/opt/postgresql@16/bin`, **ikke på PATH by default** |
| **Rolle** | `kennethmyrhaug` (OS-brukeren), **passordløs** (trust-auth) |
| **DB** | `sitedoc` på `localhost:5432` — både `apps/web/.env.local` og `apps/api/.env` peker hit |
| **Porter** | web `3100`, api `3001` |

**Legg CLI-en på PATH én gang:**

```
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
```

**Start dev-serveren — fra REPO-ROTEN, ikke `apps/web`** (`dev` er et turbo-script på roten):

```
cd ~/Documents/Programmering/SiteDoc
pnpm dev --filter @sitedoc/web --filter @sitedoc/api
```

**Fullt pakkenavn kreves.** `--filter web` feiler med «No package found with name 'web' in workspace» — pakkene heter `@sitedoc/web`/`@sitedoc/api`/`@sitedoc/mobile` (CLAUDE.md var feil på dette til 2026-07-15). Filtrer alltid til web+api når du tester web: `pnpm dev` alene starter alle 10 pakker inkl. expo/Metro, som er tung og kolliderer på port 8081 med et Metro fra et annet arbeidstre.

Åpne så `http://localhost:3100` i nettleseren. **Ikke lim URL-en i terminalen** — zsh tolker `?` som glob og gir `no matches found`. Vil du åpne fra terminal: `open "http://localhost:3100/..."` (anførselstegn påkrevd).

**Nav-flagget (`nyNavigasjon`):** `?nyNav=1` er **flyktig** — leses ved boot fra `window.location.search` og persisteres aldri (`useNyNavigasjon.ts`, presedens: aktiv `?nyNav`-URL > konto > persistert lokal > env-default > av). Praktisk:

- **Naviger ved å KLIKKE** — `dashbord/layout.tsx` holder flagg-staten gjennom client-side-navigasjon.
- **Hard reload uten parameteren dropper flagget** → legg `?nyNav=1` på igjen.
- **Skal det overleve reload:** sett konto-flagget (`User.nyNavigasjon`) via admin-knappen på `/dashbord/firma/ansatte`.
- **Merk:** konto-flagget **følger med test-dumpen** (§ 3). Har du satt ny nav på test, står den på lokalt også — da trenger du ingen parameter i det hele tatt. Verifisert 2026-07-15: ny nav rendret lokalt uten `?nyNav`.

## 2. Feilsøking — når localhost ikke virker

| Symptom | Hva det faktisk betyr | Fiks |
|---|---|---|
| **`AccessDenied` ved Google-login** | **Ikke en OAuth-feil.** Den blokkerende `signIn`-vakten i `auth.ts` (`ef5906bb`) spurte DB-en og fant ingen bruker → lokal DB er tom eller stale. Hadde OAuth-redirecten vært feil, kom feilen fra Google, ikke fra vår egen feilside. | Oppdater test-data (§ 3) |
| **`psql: command not found`** | Binærene er utenfor PATH. Sier **ingenting** om serveren. | `lsof -i :5432` — prosessnavn `postgres` = lokal server kjører · `ssh` = tunnel · tomt = ingen server. Deretter § 1. |
| **`column "canLogin" does not exist`** | DB-kolonner er snake_case (`can_login`); `canLogin` er Prisma-**feltnavnet**. `@map` oversetter. | Bruk DB-navnet i rå SQL |
| **`zsh: no matches found: http://...`** | URL limt i terminalen; `?` er glob | Lim i nettleseren, eller `open "URL"` |
| **`extension "vector" is not available`** | pgvector er ikke bygget mot `postgresql@16` | Se pgvector-forbeholdet i § 3 — blokkerer kun AI-søk |
| **All CSS borte** — rå knapper, serif-overskrift, lilla lenker, ikoner i full SVG-størrelse | `next build` ble kjørt i **samme arbeidstre** mens `next dev` kjørte. De deler `apps/web/.next`, så produksjonsbygget klobber dev-serverens chunks + CSS-manifest → dev serverer referanser til filer som ikke finnes | Stopp dev → `rm -rf apps/web/.next` → start dev. **Kjør build-gaten (regel 10) i et annet tre** enn det dev bruker — f.eks. `SiteDoc-merge`. Skjedde 2026-07-15 |
| **Agent: `computer screenshot` henger på `document_idle` (~45 s timeout) på HVER side** | **Ikke appen, ikke next dev HMR.** Verifisert 2026-07-15 ved å isolere med `example.com` — samme feil der. Mest sannsynlig at automation-tabben ligger i et bakgrunnsvindu → Chrome strupe-throttler → idle-callbacken fyrer aldri. Forgrunn + extension-reload hjalp IKKE | **Ikke bruk tid på å feilsøke appen.** `read_page`/`javascript_tool`/`navigate` virker — kun bilde-fangst dør. Arbeidsdeling: agenten driver UI-en via DOM og verifiserer tilstanden, **Kenneth fanger**. Isoler alltid med en ekstern side først (`example.com`) før du mistenker koden |
| **Dev føles tregere enn test/prod** | Forventet, ikke en feil. `next dev` kompilerer hver rute on-demand ved første treff, uten minifisering, med source maps + refresh-runtime. Server kjører ferdig `next build`-output | Ingen fiks. Filtrer bort expo (over). Turbopack (`next dev --turbo`) er et alternativ hvis det plager — egen vurdering, ikke gjort |

## 3. Oppdatere test-data

Lokal DB er en **kopi av test**, ikke en levende database. Den ligger bak så snart test får nye migreringer eller data. Frisk den opp slik (verifisert 2026-07-15):

```
ssh -t server-ny 'PG=$(sudo docker ps --format "{{.Names}}" | grep -x postgres); sudo docker exec "$PG" pg_dump -Fc -U sitedoc -d sitedoc_test > ~/backup/sitedoc_test-lokal.dump'
scp server-ny:~/backup/sitedoc_test-lokal.dump ~/Downloads/
PGBIN=/opt/homebrew/opt/postgresql@16/bin
"$PGBIN/dropdb" -U kennethmyrhaug --if-exists sitedoc && "$PGBIN/createdb" -U kennethmyrhaug sitedoc
"$PGBIN/pg_restore" --no-owner --no-privileges -U kennethmyrhaug -d sitedoc ~/Downloads/sitedoc_test-lokal.dump
```

Ufravikelig:

- **Test-dumpen, aldri prod** — ingen kunde-PII på laptopen.
- **`grep -x postgres`** (eksakt match) — løst `grep postgres` treffer `salsaklubb-postgres` først, som verken har rollen `sitedoc` eller databasen.
- **`--no-owner --no-privileges`** — da trengs ikke `sitedoc`-rollen lokalt.

Verifiser etterpå:

```
psql -U kennethmyrhaug -d sitedoc -c "SELECT email, can_login FROM users WHERE email ILIKE '%kemyrhau%';"
```

> ⚠️ **Dumpen tar IKKE med filer (funnet 2026-07-15).** `pg_dump` kopierer DB-rader; **opplastede filer** (tegninger, bilder, vedlegg) ligger på disk i `apps/api/uploads` (`upload.ts`: `UPLOADS_DIR = join(process.cwd(), "uploads")`) og følger **ikke** med. Etter restore peker tegningsrader på bilder som ikke finnes lokalt → 404, og alt som krever en fil (georef-editoren, bildevisning) er utestbart. Symptomet er lumsk: raden *finnes*, så det ser ut som en app-bug.
>
> **Trenger du en fil lokalt: last opp én via UI-en.** Sandkasse, ingen kundedata, og det utøver den ekte opplastings-stien — du får både fila og DB-raden i konsistent tilstand. En vilkårlig PNG duger som tegning (georef-editoren plasserer punkter på et bilde; motivet er likegyldig).
>
> **Ikke kopier serverens `uploads`** — den er **~1,4 GB ekte kundefiler**, delt mellom prod og test (test bind-mounter prods mappe, `docker-compose.test.yml`). Samme PII-innvending som gjør at vi restorer fra test-dumpen og ikke prod-dumpen.

> ⚠️ **pgvector-forbehold.** `brew install pgvector` bygger mot Homebrews *standard* postgres, ikke `postgresql@16` → `vector.control` mangler i pg16-ens extension-katalog. Restoren feiler da på **21 kommandoer**, og alle 21 gjelder to tabeller: `ftd_document_blocks` + `ftd_document_chunks` (dokumentleser/AI-søk-embeddings). **Alt annet restores** — verifisert 2026-07-15: 31 brukere, prosjekter, timer, byggeplasser, dokumentflyt. Trenger du AI-søk lokalt:
> ```
> git clone --branch v0.8.5 https://github.com/pgvector/pgvector.git /tmp/pgvector
> cd /tmp/pgvector && make PG_CONFIG=/opt/homebrew/opt/postgresql@16/bin/pg_config && make install PG_CONFIG=/opt/homebrew/opt/postgresql@16/bin/pg_config
> ```
> deretter `CREATE EXTENSION vector;` + ny restore.

## 4. Teste en ny funksjon — løypa

1. **Kod.**
2. **Se den på localhost** (~1 min). Dekker: web-UI, i18n, globalt søk, navigasjon, tRPC-flyt, DB-lesing/skriving.
3. **Cowork-gate på diffen** (kode-verifisering mot faktisk kode, ikke beskrivelse).
4. **Merge til develop** — build-gate (`pnpm --filter @sitedoc/web build`) + docs-delta kreves.
5. **Test-deploy → bekreft på `test.sitedoc.no`.** Test deployer fra **develop**, så merge skjer først. Bygg **kun det som endret seg** (frontend-endring → `build sitedoc-test-web` alene; api-endring → begge, fordi web-bygget importerer tRPC-routeren). Bygg **sekvensielt** — to tunge images i samme `up -d --build` ga OOM-kaskade som tok ned prod 2026-07-11.
6. **Prod:** kun på eksplisitt go, med migrasjonsgate + container-helsesjekk + innlogget verifisering.

## 5. Hva localhost IKKE dekker

- **Mobil.** Egen løype — se [simulator-opus-oppkobling.md](simulator-opus-oppkobling.md) (simulator) og [dev-login-agent.md](dev-login-agent.md) § localhost-port-forward (mobil mot api-test via SSH-tunnel).
- **AI-søk / dokumentleser.** pgvector-forbeholdet i § 3 → `ftd_document_*`-tabellene er tomme lokalt.
- **Migreringer.** Lokal DB er en test-kopi; nye migreringer kommer ikke automatisk. Etter schema-endring: ny restore (§ 3), eller `prisma migrate deploy` mot lokal.
- **Edge-lag.** Cloudflare/cloudflared, delt postgres-tilkoblingskvote og container-topologi finnes kun på server — se [infrastruktur.md](infrastruktur.md) + [DOCKER-NOTES.md](../../docker/DOCKER-NOTES.md).

## Historikk

Oppsettet var **udokumentert til 2026-07-15**. Frem til da ble `AccessDenied` lest som et OAuth-problem, og `deploy-detaljer.md`-linjene `postgresql://kemyr:kemyr@localhost:5432/...` (som gjelder den **utgåtte WSL-serveren**, ikke Mac-en) ble feillest som lokal dev. Kartlagt via `lsof -i :5432` → `ps -p <pid> -o comm=` → Homebrew pg16. Lærdom: miljø-påstander verifiseres mot maskinen (`lsof`/`ps`), ikke mot docs eller hukommelse — samme regel som gjelder kode.
