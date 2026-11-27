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
| **`Cannot find module '@sitedoc/pdf'` i typecheck (friskt worktree)** | Workspace-pakken er i `apps/api/package.json` men **ikke symlenket** i `apps/api/node_modules/@sitedoc/` — pnpm hoppet over lenken i et nytt git-worktree (`pnpm install` sier «Already up to date» uten å lenke). Gjelder også `@sitedoc/pdf`-avhengige testfiler. Verifisert 2026-08-12. | `pnpm install --force` (rebygger workspace-lenkene; ~2–3 min). `--force` er ikke åpenbart — ordinær `install` fikser det ikke |

## 3. Oppdatere test-data

Lokal DB er en **kopi av test**, ikke en levende database. Den ligger bak så snart test får nye migreringer eller data. Frisk den opp slik (verifisert 2026-07-15):

```
ssh -t server-ny 'PG=$(sudo docker ps --format "{{.Names}}" | grep -x postgres); sudo docker exec "$PG" pg_dump -Fc -U sitedoc -d sitedoc_test > ~/backup/sitedoc_test-lokal.dump'
scp server-ny:~/backup/sitedoc_test-lokal.dump ~/Downloads/
PGBIN=/opt/homebrew/opt/postgresql@16/bin
"$PGBIN/dropdb" -U kennethmyrhaug --if-exists sitedoc && "$PGBIN/createdb" -U kennethmyrhaug sitedoc
"$PGBIN/pg_restore" --no-owner --no-privileges -U kennethmyrhaug -d sitedoc ~/Downloads/sitedoc_test-lokal.dump
```

🔴 **`prisma migrate deploy` er IKKE veien til å ta igjen etterslepet** (lærdom 2026-08-29).
En lokal DB som har ligget stille noen måneder henter ikke inn ~170 migreringer; den stopper
på gamle datafeil som migreringene forutsetter er ryddet. Målt: `20260810120000_mal_integritet`
legger en unik navne-indeks, og lokal DB hadde **fem** identiske PSI-maler fra april-seeden →
deployen stoppet etter 9 migreringer og lot databasen stå i «failed migration»-tilstand, som er
verre enn utgangspunktet.

**Dumpen er veien.** Den kommer fra en database der alle migreringer allerede har kjørt, så
ingen datalandminer utløses. Rydding av duplikater for å komme videre er ubegrenset arbeid —
neste migrering har sin egen forutsetning.

Symptomet som avslørte etterslepet: **500 på alt som slår opp org-medlemskap**
(`bruker.hentMin`, `faggruppe.hentForProsjekt`, `mal`/`dokumentflyt`/`organisasjon.hentForProsjekt`),
mens prosedyrer som ikke rører tabellen svarte 200. Prisma-klienten var regenerert mot
develop-schemaet og spurte etter `organization_members.status`; lokal DB manglet kolonnen.
🔴 **Regenerering skjulte ikke problemet — den avdekket det.** Med gammel klient spurte ingen
etter kolonnen, og driften lå usett.

Ufravikelig:

- **Test-dumpen, aldri prod** — ingen kunde-PII på laptopen.
- **Stopp dev-serveren før `dropdb`** — den holder tilkoblinger, og `dropdb` feiler med
  «database is being accessed by other users». `lsof -ti:3100,3001 | xargs kill`, så drop.
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

## 6. Prøvebenk for annotering (døm strek/halo/tekst i nettleser)

`pnpm dlx tsx scripts/annotering-prøvebenk.ts` (fra repo-rot) skriver den delte annoterings-HTML-en til `scripts/annotering-prøvebenk.local.html` (gitignorert) med filvelger + verktøyknapper. Åpne den i nettleser, velg et ekte bilde og juster skaleringen ved å endre vindusbredden. Rent utviklerverktøy — automatiserer ingenting.

🔴 **Benken er for ØYNENE, ikke for en agent.** Den finnes for at Kenneth skal dømme tykkelse, kontrast og plassering på et ekte bilde i løpet av sekunder, i stedet for en merge-og-deploy-syklus pr. forsøk. **Den skal ikke drives av Playwright eller annen nettleserautomatisering.** ⚠️ **Målt to ganger 2026-09-29: forsøk på å automatisere den kostet 33 og 31 minutter og ga ingen resultater.** 🟢 **Skal et tall verifiseres, er det en funksjonstest** — forholdet mellom pilhode og strek er matematikk, ikke noe man klikker seg fram til. **Hvem som verifiserer hva: [SAMARBEIDSREGLER § En verifiseringsordre](SAMARBEIDSREGLER.md).**

## 7. Lokal testflate (Kenneth tester runder her, fra 2026-11-26)

Kenneth 2026-11-26: «kan vi teste i et annet miljø enn på server … jeg slipper å deploye hele tiden». Regelen for
testrunder står i [SAMARBEIDSREGLER § 3 DEPLOY OG TESTRUNDER](SAMARBEIDSREGLER.md); her står oppsettet.

| Ting | Verdi (målt 2026-11-26) |
|------|-------|
| **Tre** | `~/Documents/Programmering/SiteDoc-lokaltest`, alltid **detached** på rundens hash |
| **DB** | `sitedoc_lokaltest` (kopi av `sitedoc_test`). De seks env-filene i treet (`apps/api/.env`, `apps/web/.env.local`, `packages/db*/.env`) peker hit; hovedtreets `.env` er urørt |
| **Start** | `preview_start {name: "lokaltest"}` (`.claude/launch.json`, gitignorert) — web 3100 + api 3001 |
| **Eier** | Orkestrator starter og bytter; agentene rører verken treet eller `sitedoc_lokaltest` |

⚠️ **Postgres-serveren er 17.9, `pg_dump`/`psql` på PATH er 16** (`/opt/homebrew/opt/postgresql@16/bin`) og avbryter med
«server version mismatch» (målt 2026-11-26). Bruk `postgresql@17`-binærene. § 1-tabellens «`postgresql@16`» er derfor
utdatert for serveren.

**Rutine pr. runde** (orkestrator, maskin: Mac):
1. `preview_stop` på «lokaltest».
2. Sjekk ut rundens hash:
   ```
   cd ~/Documents/Programmering/SiteDoc-lokaltest && git fetch -q origin && git checkout -q --detach <hash>
   ```
3. `pnpm install --frozen-lockfile`
4. `prisma generate` ×4:
   ```
   for p in db db-timer db-maskin db-varelager; do pnpm --filter @sitedoc/$p generate; done
   ```
5. Ved ny migrering i runden, i pakken som har den (lov mot lokal DB, aldri mot server):
   ```
   pnpm --filter @sitedoc/<pakke> migrate:deploy
   ```
6. `preview_start {name: "lokaltest"}`, og poll til siden svarer før meldingen sendes.

**Meldingen til Kenneth** har alltid fire deler: **(a)** er lokal server endret (hash før → nå) · **(b)** Cmd+Shift+R
før test · **(c)** teststeg med forventet resultat pr. steg · **(d)** hva svaret fører til.

**Kopi-DB for agentens skjermbilder** (UI-retting, [ordre-og-agent.md § 4 Ordre-anatomi](ordre-og-agent.md)):
```
P=/opt/homebrew/opt/postgresql@17/bin; $P/createdb sitedoc_<agent> && $P/pg_dump sitedoc_lokaltest | $P/psql -q sitedoc_<agent>
```
`pg_dump`-leddet er målt (2026-11-26, `--schema-only` mot `sitedoc_lokaltest`); `createdb`/`psql`-leddet er umålt.

### Parallelle runder — ingen dødtid for Kenneth (Kenneth 2026-11-27)

Kenneth: «kan du nå finne en måte å jobbe på slik at jeg slipper dødtid mens vi venter på koding» → «ja».

- **To spor samtidig**, hvert med **én agent og ett tema** (maks 3 beslektede rettinger). Eksempel 2026-11-27: w1 = runde 3 (maskin/vare i dagskortet), w5 = runde 4 (hjemreise fra «Annet sted»).
- **Filgrense i ordren:** hver ordre navngir delene den andre agenten eier (komponent/linjer) og sier «rør ikke; trenger du dem: STOPP og meld i løsningsforslaget».
- **Løsning før kode:** agenten skriver løsningsforslag (målt fil:linje, før/etter for brukeren, hva som bevares) i `inbox-orkestrator.md`; orkestrator godkjenner på vedtatt innhold (hjemmel = Kenneths ord i FASIT) og nudger «kod».
- **Kø til testflaten:** runden som **først** har Kontrollør-GODKJENT settes opp på 3100 (rutinen over) og Kenneth tester den; den andre står klar når han er ferdig. Aldri to temaer i samme testliste.
- **Merge i den rekkefølgen Kenneth sier «virker».** Runden som merges sist: agenten rebaser på `origin/develop` og kjører regel 10 på nytt; konflikt = én ekstra agenttur, ikke Kenneth-tid. Deploy = siste lokalt godkjente merge (SAMARBEIDSREGLER § 3).
- **Agenten jobber i SITT EGET worktree** (sesjonen er hook-låst dit). Ny runde = `git fetch && git switch -c <branch> origin/develop` i eget tre, etter `git status` rent. **Aldri** be agenten lage nytt worktree (2026-11-27: w1/w5 fikk hook-stopp i `web-timer-w1-r3`/`-w5-r4`). Etter merge slettes branchen, ikke agentens tre.
- Trenger Kenneth to runder oppe samtidig: testflate nr. 2 (egen port + egen DB-kopi) settes opp først når én flate faktisk er flaskehalsen.

**Dekker ikke:** mobil (telefonen peker mot test), prod-oppsett, opplastede filer.

### Testpanel — strukturert testrunde nederst i lokal SiteDoc (Kenneth 2026-11-27)

Kenneth 2026-11-27: «under vinduet til sitedoc lager vi et testvindu … Knappen neste er et signal på at jeg er klar å vurdere neste steg.» Bygget på `feat/testpanel` 🟡 (ikke merget).

| Ting | Verdi |
|------|-------|
| **Vilkår** | `NODE_ENV=development` **og** `NEXT_PUBLIC_SITEDOC_TESTPANEL=1` (`apps/web/src/components/testpanel/TestpanelPort.tsx`). Prod-bygg: grenen er død kode, panel-chunken lages ikke; API-ruten svarer 404 (`apps/web/src/app/api/testpanel/route.ts`) |
| **Mappe** | `SITEDOC_TESTPANEL_DIR` (server-env, i lokaltest-treets `apps/web/.env.local`) = `<hovedtre>/relay/testrunder`. `NEXT_PUBLIC_*` byttes inn ved start → start dev-serveren på nytt etter endring |
| **Filer** | `aktiv.json` = `{ "fil": "<runde>.json" }` (kun `[a-z0-9-]+.json` i samme mappe). Runde-fila: `{ runde, hash, steg[], pause?, agentNaa? }`; steg: `nr, hvaTestes, handling, forventet, agentSa, agentVurdering (godkjent/avvik/null), status, kenneth { vurdering, merknad, forbedring, tid } \| null, markering? ({ tekst } \| { selektor } \| null), forbedringer? ([{ tekst, tid }])`. Schema: `components/testpanel/schema.ts` (Zod). Panelets POST (`type`: `svar` / `pause` / `forbedring`) patcher rå JSON og bevarer alle andre felt, også felt utenfor schemaet (`lagring.ts`) |
| **Plass** | Fast rute nederst (260 px, 32 px minimert). Mens den er montert krympes `body`, `.h-screen` og `.min-h-screen` med panelhøyden (`html[data-testpanel]`); sider med inline `100vh`/`100dvh` dekkes ikke |

**Statusflyt pr. steg:** `venter_agent` (panelet viser «Agenten kjører steget …», feltene låst) → agenten fyller `agentSa` + `agentVurdering` og setter `venter_kenneth` → Kenneth velger Godkjent/Avvik, skriver merknad (påkrevd ved Avvik) og ev. forbedring (valgfri) → **Neste** (grå til kravene er oppfylt) lagrer `kenneth` og setter `ferdig` → agenten ser `ferdig` og tar neste steg. Aktivt steg = laveste `nr` som ikke er `ferdig`. Panelet poller hvert 500. ms.

**Underveis (RETUR 2, Kenneth 2026-11-27):**
- **Pause/Fortsett** i toppstripa setter `pause` på runden.
- **Lagre forbedring** kan brukes når som helst, også mens agenten kjører. Teksten legges i `steg.forbedringer[]`, og status endres ikke.
- Det som står i forbedring-feltet når du trykker Neste, går som før til `kenneth.forbedring`.
- Linjen «Agenten: …» viser `agentNaa`.
- `markering` tegnes som en amber ramme rundt elementet. Rammen er et eget overlegg med `pointer-events: none` (`components/testpanel/Markering.tsx`), så siden under test endres ikke.
- Oppslag skjer på synlig tekst, `aria-label` eller input-verdi blant knapper, lenker, faner og etiketter. `selektor` er reserve.
- Finnes ikke elementet, viser panelet «Fant ikke «…»».

**Testagentens regler:**
- Skriver planen og egne felt (`agentSa`, `agentVurdering`, `status` → `venter_kenneth`, `markering`, `agentNaa`) direkte i fila, **atomisk** (skriv til tmp, så `rename`).
  - **Les fila rett før hver skriving** og rør bare egne felt.
  - Rør aldri `kenneth`, `pause` eller `forbedringer`, fordi de eies av panelet.
- **For hver handling, også veien inn til testen:**
  1. Les fila. Står `pause` på, vent og les på nytt.
  2. Sett `agentNaa` (f.eks. «går til Timer → Mine timer») og `markering` til elementet du skal klikke.
  3. **Vent 2 s.**
  4. Klikk.
  5. Tøm `markering`.
  6. **Vent 2 s** før neste handling.
- Klikker og leser kun i appen.
- Rapporten går til orkestrator.
- Avvik + merknad blir retur.
- Forbedring blir backlog-kandidat, som måles mot koden før noe bestilles.

## Historikk

Oppsettet var **udokumentert til 2026-07-15**. Frem til da ble `AccessDenied` lest som et OAuth-problem, og `deploy-detaljer.md`-linjene `postgresql://kemyr:kemyr@localhost:5432/...` (som gjelder den **utgåtte WSL-serveren**, ikke Mac-en) ble feillest som lokal dev. Kartlagt via `lsof -i :5432` → `ps -p <pid> -o comm=` → Homebrew pg16. Lærdom: miljø-påstander verifiseres mot maskinen (`lsof`/`ps`), ikke mot docs eller hukommelse — samme regel som gjelder kode.
