---
name: sikkerhet
description: Samlet sikkerhetsvurdering — hva er målt, hva er åpent, hva er avgjort. Erstatter spredte punkter i STATUS-AKTUELT og containertopologi-notatet.
status: 🟠 LEVENDE — oppdateres ved hvert funn og hver lukking
sist_verifisert_mot_kode: 2026-09-06
---

# Sikkerhet — samlet vurdering

**Hvorfor denne fila finnes:** sikkerhetsfunn lå spredt i seks dokumenter som ikke
refererte hverandre. Fire av dem beskrev samme sti — `/uploads/` — uten at noen hadde
lagt dem ved siden av hverandre. Denne fila er stedet det gjøres.

**Den duplserer ikke.** Arkiver forblir arkiver, BACKLOG eier åpne oppgaver,
`gdpr-kartlegging.md` eier persondata-kartet. Her står vurderingen og sammenhengene.

---

## 🔴 Det ingen enkeltdokument hadde sett: fire funn om samme sti

`/uploads/` er berørt av fire uavhengige funn. Hver for seg er de håndterbare; sammen
er de en kjede.

| # | Funn | Kilde | Status |
|---|---|---|---|
| 1 | Sjekkliste-/oppgavebilder er **uautentisert tilgjengelige** på stien | målt 2026-08-12 | Åpen (se under) |
| 2 | **Test skriver inn i PRODS uploads-katalog** | målt 2026-08-28 | Åpen |
| 3 | `@fastify/static` mulig egen path traversal — kan nå filer **utenfor** `uploads/` uavhengig av vår gate | BACKLOG A2 (High) | Delvis: rot-lås verifisert, versjon ikke |
| 4 | Omgåelse av vår egen signaturgate (`//`, `/./`, `%2e` → 200) | fikset 2026-08-12 | ✅ Lukket |

**Kjeden:** test kan skrive en fil (2) inn i en katalog som serveres uautentisert (1),
og hvis biblioteket i tillegg har traversal (3), gjelder det filer utenfor katalogen.
Vi har allerede sett at gaten vår kunne omgås én gang (4).

**Formildende, målt:** `audit-sensitive-apen-sti.ts` mot prod-DB 2026-08-15 ga **null**
sensitive filreferanser på åpen sti — timer, kompetanse, maskin, `Image.file_url` og
feltvedlegg, alle 0. Kategoriene er ryddet. **Stien er der fortsatt.**

---

## Åpne punkter, rangert etter vei fra utenforstående til skade

### 1. 🔴 Test skriver inn i prods uploads-katalog — krever ingen kompromittering

`docker-compose.test.yml:36` monterer `/home/kemyrhau/stack/sitedoc/uploads` inn i
test-api på `/app/apps/api/uploads` — **uten `:ro`**. Prods web serverer samme katalog
(`docker-compose.yml:60`).

En fil lastet opp på test serveres offentlig fra sitedoc.no. Det er ikke innbrudd — det
er normal drift av to stacker som deler et skrivbart volum. Test har dev-login påslått;
lekker den hemmeligheten, kan noen plassere innhold på prods domene (phishing,
filhosting).

**Delingen var bevisst** («test ser ekte filer», kommentar i compose-fila). Fiksen er
ikke å fjerne den, men å gjøre test read-only på prods katalog med et eget skrivbart
område. 🔴 **Egen, forsiktig runde** — uploads har gått tapt før, se
[DOCKER-NOTES § Datatap uploads](../../docker/DOCKER-NOTES.md).

### 2. 🔴 Uautentisert tilgang til sjekkliste-/oppgavebilder (målt 2026-08-12)

Stien krever ingen autentisering for disse kategoriene. Sensitive kategorier er ryddet
bort fra den (målt 0, 2026-08-15), men bilder fra sjekklister og oppgaver ligger åpent.

⚠️ **Dette punktet sto i STATUS-AKTUELT med en overskrift som hadde mistet kroppen sin** —
innholdet under hadde drevet over til arkivmal-PDF. Flyttet hit 2026-08-28.

### 3. 🟠 BACKLOG A2 — `@fastify/static` path traversal (High)

Eies av [BACKLOG](BACKLOG.md) § A2. **Halvparten er verifisert 2026-08-28:** rot-låsen
er på plass (`server.ts:129`, `root: join(process.cwd(), "uploads")`). Gjenstår:
`@fastify/static@9.3.0` er installert — om den er patchet krever oppslag i rådgivninger.

### 4. 🟠 SSRF i pdf-render — krever en autentisert bruker

`page.setContent(html, { waitUntil: "networkidle" })` lar Chromium utføre requests.
Havner brukerdata uescaped i rapport-HTML, kan `<img src="http://postgres:5432">` gi
intern rekognosering på `appnet`.

**Fiksen er én linje og endrer ikke normal drift:** pdf-render mottar selvstendig HTML
med bilder allerede inlinet — den trenger aldri å hente noe.
`await page.route("**", r => r.abort())` + `waitUntil: "load"`.

🔴 **Containeren deles med test og bygges ikke av vanlige `--no-deps`-deploys.** Krever
eget gatet steg, som da liggende format ble lagt til 2026-08-27.

### 5. 🟠 Flatt `appnet` — test er den myke inngangen

Alle containere, **inkludert hele test-stacken**, deler ett flatt nett
(`external: true`). Kompromitteres én, nås `postgres:5432` og de øvrige.

Test er flaten å modellere: dev-login påslått, svakere data, og der agenter opererer.
**Segmentering bør først skille test fra prod**, ikke bare pdf-render fra postgres.

### 6. 🟡 `--no-sandbox` i Chromium (pdf-render)

Renderer-exploit på uklarert innhold er ikke inneslutt. Lavere prioritet fordi punkt 4
fjerner veien uklarert innhold kommer inn på.

### 7. 🟡 Registrator: `rejected → sent` mangler

Kjent, akseptert regresjon fra sikkerhetsfiksen som fjernet registrators admin-overmakt.
Eies av [registrator-rolleforveksling.md](delplaner/registrator-rolleforveksling.md).

---

## ✅ Lukket 2026-09-06 — FTD tenant-grense + uautentisert prosessering-endepunkt

**Funn (metode: skrivevei-folketelling av `apps/api` mot de 12 prosjekt-portene i
`tilgangskontroll.ts`, 2026-09-06).** Fem skriveveier mot FTD-/økonomidata gikk utenom
firma- og prosjektsjekk:

| Vei | Før | Skade |
|---|---|---|
| `kontrakt.oppdater` / `kontrakt.slett` (`kontrakt.ts:47/67`) | kun innlogget (`protectedProcedure`), ingen firmasjekk | enhver SiteDoc-bruker kunne endre/slette **et annet firmas kontrakt** med bare id-en. `slett` nuller i tillegg `kontraktId` på faggrupper og dokumenter → løsrev koblinger på tvers av firma |
| `mengde.lagreNotat` / `slettPeriode` / `fjernFraOkonomi` (`mengde.ts:323/332/460`) | kun innlogget | endre/slette et annet firmas spec-notat, nota-periode og økonomi-kobling med rå id |
| `POST /prosesser/:documentId` (`prosesser.ts`) | **ingen auth i det hele tatt**, servert på `0.0.0.0` → offentlig på api.sitedoc.no | hvem som helst kunne trigge dokumentprosessering på et vilkårlig dokument-id |

Dette brøt den ufravikelige firmaisolerings-regelen i CLAUDE.md (firma-admin/medlem
skal **kun** nå eget firmas data; firma-grense-sjekk skal ligge i server-laget).

**Fiks (`fix/ftd-tenantgrense`, 2026-09-06):**
- De fire tRPC-veiene resolver nå `projectId` fra entiteten (`FtdKontrakt`/`FtdSpecPost`/
  `FtdNotaPeriod`/`FtdDocument` har alle direkte `projectId`) og kaller
  `verifiserProsjektmedlem` — samme mønster som de dekkede prosedyrene i samme routere
  (`reprosesser`, `oppdaterDokument`).
- `/prosesser/:documentId`-endepunktet er **fjernet**. Kallerne (`mengde.ts`, `mappe.ts`)
  gjorde et HTTP-selvkall til `localhost` — tRPC kjører i samme API-prosess, så hoppet ga
  ingen isolasjon. `triggerProsessering` kaller nå `prosesserDokument` direkte in-process
  (samme fire-and-forget, ikke await-et); autorisasjon skjer i tRPC-kalleren før triggeren.
  Den offentlige flaten finnes ikke lenger — ingen ny secret/env introdusert.

**Ikke i denne runden (målt, egen sak):** de øvrige ugatede/inline-gatede skriveveiene
folketellingen fant — PSI-gjesteveier (`psi.ts:516/547/560`), inline-admin i `psi.ts`,
`oppgave/sjekkliste.byttEier`, `hms.firmaBehandleAvvik`, og hele `timer/dagsseddel.ts`
(firma-scope mot svak FK `SheetTimer.projectId`). Disse er dekket av firma-/eierskaps-
sjekker på andre akser (ikke tenant-hull som de fem over), og vurderes i frys-vakt-sporet
(FL — prosjekt-livssyklus).

---

## ✅ Verifisert trygt — med dato og metode

| Påstand | Hvordan målt | Dato |
|---|---|---|
| Dev-login er AV i prod | `GET https://api.sitedoc.no/dev-login` → **404**. Ruta registreres kun ved `ENABLE_DEV_LOGIN === "true"` (`server.ts:164`) | 2026-08-28 |
| Ingen host-eksponering | Kun api/web har host-porter, bundet til `127.0.0.1`. pdf-render, embed, oversettelse, postgres har ingen | 2026-08-28 |
| Legitimasjon isolert fra svakeste container | pdf-render har ingen DB-tilgang, ingen secrets, `no-new-privileges:true` | 2026-08-28 |
| Rot-lås på statisk servering | `server.ts:129` | 2026-08-28 |
| Ingen sensitive filer på åpen sti | `audit-sensitive-apen-sti.ts` mot prod-DB, sum 0 | 2026-08-15 |
| Signaturgate-omgåelse lukket | `//`, `/./`, `%2e` → ikke lenger 200 | 2026-08-12 |
| Registrator er ikke superbruker | Fase A+B, `8a1de1a9` | 2026-07-21 |
| 14 funn fra sikkerhets-audit adressert i prod | Se [historikk-2026-05.md](historikk-2026-05.md) | 2026-05-27 |
| Ingen passord-innlogging finnes | `auth.ts` har kun Google + Microsoft Entra ID, ingen Credentials-provider | 2026-08-28 |
| Deaktivert ansatt mister prosjekttilgang | `krevAktivAnsettelse` i alle prosjekt-porter + `status`-filter i `hentBrukersOrg` | 2026-08-28 |
| FTD-kontrakt/-økonomi-skriving er firma-gatet | `kontrakt.oppdater/slett` + `mengde.lagreNotat/slettPeriode/fjernFraOkonomi` resolver `projectId` → `verifiserProsjektmedlem` | 2026-09-06 |
| Ingen uautentisert prosessering-endepunkt | `/prosesser/:documentId` fjernet; `triggerProsessering` kaller `prosesserDokument` in-process | 2026-09-06 |

---

## Hvem eier hva — les her, ikke dupliser hit

| Dokument | Eier |
|---|---|
| **Denne fila** | Vurderingen, sammenhengene, hva som er målt og når |
| [BACKLOG.md](BACKLOG.md) § A-serien | Åpne avhengighets-/CVE-oppgaver med estimat |
| [gdpr-kartlegging.md](gdpr-kartlegging.md) | Hvor persondata om ansatt bor · slett/anonymiser/bevar |
| [delplaner/registrator-rolleforveksling.md](delplaner/registrator-rolleforveksling.md) | Rolle-/rettighetsmodellen og dens åpne rest |
| `docs/redesign/designnotat-registreringsmodellen-fabel-2026-08-28.md` | Tilgangsmodellen i lag · kryssfirma-vedtaket |
| `historikk-2026-MM.md` | Lukkede funn med dato — **arkiv, flyttes aldri hit** |
| `apps/api/scripts/audit-sensitive-apen-sti.ts` | Målingen av åpen sti (read-only, kjøres mot prod) |

## 🔵 Planlagt serverflytting (~okt 2026) lukker TRE av punktene gratis

**Kenneth 2026-08-28:** *«om et par måneder tror jeg vi skal flytte serveren igjen til
en hostet server. Da forblir test hvor den er nå.»*

Flyttes prod til hosted mens test blir stående på `server-ny`, opphører tre av punktene
å eksistere — de er alle konsekvenser av at to stacker deler én maskin:

| Punkt | Hva som skjer ved flytting |
|---|---|
| **1. Test skriver i prods uploads** | Borte. Ulike maskiner, ingen delt bind-mount |
| **5. Flatt `appnet` test↔prod** | Borte. Ingen delt docker-nett |
| **4. pdf-render delt med test** | Splittes. Fjerner også den gatede deploy-særegenheten |

**Konsekvens for prioriteringen:** ikke bruk en forsiktig runde på å skille
uploads-volumene nå. Skillet kommer gratis, og uploads har gått tapt to ganger på denne
serveren. Det som IKKE løses av flyttingen er applikasjonsnivået: uautentisert
`/uploads/`, A2, SSRF-en og `--no-sandbox`.

🔴 **Men flyttingen må da BÆRE dem.** Blir de ikke designet inn, gjenskaper vi det flate
nettet på ny maskin og har brukt en flytting uten å hente gevinsten. Denne fila skal
leses som del av flytte-planleggingen, ikke etterpå.

## Anbefalt rekkefølge

**Nå (billig, uavhengig av flytting):**

1. **`page.route`-abort i pdf-render** — én linje, lav risiko, egen gatet deploy
2. **BACKLOG A2** — versjonsoppslag; rot-låsen er allerede verifisert på plass

**Ved serverflyttingen (~okt 2026):**

3. Nettverkssegmentering designes inn fra start — ikke gjenskap flatt `appnet`
4. Uploads-volumene skilles som konsekvens av flyttingen, ikke som egen risikooperasjon

**Egen vurdering, uavhengig av begge:**

5. Uautentisert `/uploads/` for sjekkliste-/oppgavebilder — applikasjonsnivå,
   overlever flyttingen
6. `--no-sandbox`

## 🔴 DEKNING — hva denne gjennomgangen IKKE har sett på

> **Kenneth 2026-09-07:** *«Hvorfor er ikke dette oppdaget i min forespørsel om å kontrollere
> systemet for sikkerhetssvakheter?»*

**Fordi gjennomgangen så på hva som skjer ETTER innlogging, ikke på hvordan innlogging skjer.**
Alle funn over handler om dører inne i bygget — uploads-stien, tenant-grenser, nettverk,
hvem som kan gjøre hva. **Ingen sjekket låsen på inngangsdøra, fordi det sto «Google» på den.**

Raden *«Ingen passord-innlogging finnes — kun Google + Microsoft Entra ID»* i «Verifisert trygt»
ble ført som **betryggelse**. At autentisering er delegert til to store leverandører ble behandlet
som slutten på auth-spørsmålet i stedet for begynnelsen: ingen spurte hvilken **flyt** vi bruker,
hvilke **scopes** vi ber om, eller om `state` faktisk **verifiseres**.

**Funnet 2026-09-07 kom fra Google Cloud Console → Project Checkup**, som måler vår faktiske
trafikk og flagget *«not using the state parameter»*. 🔴 **En ekstern målekilde vi har hatt hele
tiden, gratis, og aldri konsultert.**

### 🔴 Regelen som følger av dette

**En sikkerhetsgjennomgang skal liste hva den IKKE har sett på.** Metode-avsnittet under sa at
runtime-tilstand ikke var verifisert — men sa ingenting om autentiseringsprotokollen. **En
gjennomgang som ikke oppgir sin egen dekning, leses som om den dekket alt.** Det er en større feil
enn det enkeltfunnet den bommet på.

| Område | Dekket? |
|---|---|
| Nettverkstopologi, containere, host-porter | ✅ 2026-08-28 |
| Filservering og `/uploads/` | ✅ 2026-08-12/15 |
| Autorisasjon: tenant-grenser, prosjektporter, roller | ✅ 2026-09-06 |
| **Autentiseringsprotokoll: OAuth-flyt, scopes, `state`, token-validering** | 🔴 **IKKE FØR 2026-09-07** — se funn under |
| **Eksterne leverandørkonsoller (Google Cloud, Azure) som målekilde** | 🔴 **ALDRI ÅPNET før 2026-09-07** |
| Avhengigheter / kjente CVE-er i tredjepartspakker | 🔴 **IKKE DEKKET** |
| Rate limiting og misbruk av offentlige endepunkter | 🟡 Delvis (auth-login, `/api/pamelding`, `/api/kontakt`) |
| Logging: havner hemmeligheter eller persondata i logg? | 🔴 **IKKE DEKKET** |

## 🔴 KONTOOVERTAKELSE via e-post-claimet (målt 2026-09-07, redesign sporet hele kjeden)

**Ikke en kobling — en full overtakelse.** Sporet i `mobilAuth.ts`:

1. `:134` — `email` tas fra **`mail`-claimet**, som en tenant-admin kontrollerer. `preferred_username`
   (UPN, bundet til verifisert domene) er bare fallback.
2. `:210` — bruker slås opp på **e-post** → treffer offerets konto.
3. `:218` — kontooppslag på `oid` → angriperens ferske `oid` finnes ikke → `null`.
4. `:237` — admission-gaten: offeret har firma/prosjekt → `harTilknytning = true` → **slipper forbi**.
5. 🔴 `:288` — **ny `account`-rad kobler angriperens `oid` til offerets `userId`.** Sesjon på
   offerets bruker. **Permanent binding.**

🔴 **`iss`/`tid`-vakten stopper det ikke** — angriperens token er ekte, signert av Microsoft, og
`iss` matcher deres egen `tid`. Flertenant slipper det inn **by design**; det er e-post-koblingen
som er hullet.

🟢 **Pre-eksisterende** — den gamle Graph-veien brukte `mail ?? userPrincipalName` og gikk også mot
`/common`. **Fiks under arbeid:** `oid`-oppslag først + UPN som autoritativ e-post; `mail` beholdes
kun som visnings-fallback for navn og bilde, aldri for identitet.

**Målt bruddflate: NULL.** Alle 6 Microsoft-brukere i prod har allerede `oid`-kobling og resolveres
på identitet uansett e-post (`9 kontoer / 6 brukere`, domener `amarkussen.no`, `sitedoc.no`,
`gmail.com`).

🟢 **Personlige Microsoft-kontoer skal IKKE sperres.** Cowork var på vei til å foreslå det — målingen
viste at **Kenneth selv** logger inn med en MSA på gmail-adressen sin, aktiv og med firmatilknytning.
**Sperren ville låst produkteieren ute av sitt eget produkt.**

## ⚠️ `signIn`-vakten fanget ikke en orphan-konto (2026-09-07)

`Mathias Jensen / mathias.jensen989@gmail.com` hadde `can_login = true` og **null firmatilknytninger**
— nøyaktig tilstanden vakten fra 2026-06-05 (`auth.ts:66-70`) ble innført for å hindre.
🟢 **Lukket manuelt:** `can_login = false` satt i prod 2026-09-07 på Kenneths ordre. Raden beholdt
for historikk; reversibel.

🔴 **Ubesvart: hvorfor slapp den gjennom?** Enten er kontoen eldre enn vakten, eller så finnes en vei
rundt den. **Mål når vi uansett er i auth-koden** — ikke en egen hastesak, men ikke glemt.

## 🔴 Åpne auth-funn (2026-09-07, Kenneth-utløst)

| Funn | Kilde | Status |
|---|---|---|
| Mobil-Microsoft ber om **`User.Read`** — Graph-tillatelse til hele Entra-profilen (stilling, telefon, kontorsted, leder) for å hente e-post og navn som alt ligger i ID-tokenet | cowork-måling, `apps/mobile/src/services/auth.ts:116` | 🟡 Ordre gitt, `fix/mobil-user-read` |
| **Google-innlogging på mobil bruker IMPLISITT flyt.** Håndskrevet web-variant har `response_type: "token"` og en `state` fra `Math.random()` som **aldri verifiseres** | Google Cloud Console + cowork-måling, `auth.ts:90` | 🔴 Ordre skrevet, holdes til `User.Read` er merget |
| Cross-Account Protection ikke konfigurert | Google Cloud Console | 🟡 Valgfritt Google-tiltak, ikke vurdert |

🟢 **Google-scopes er minimale** (`openid email profile`) på både web og mobil — verifisert
2026-09-07. **Omfanget var aldri problemet; flyten er det.**

⚠️ **Presedensen sto i samme fil hele tiden:** Microsoft-flyten (`auth.ts:113`) bruker
authorization code + PKCE og bærer kommentaren *«Implicit forkastes … token i redirect-URL»*.
**Riktig avgjørelse ble tatt for én tilbyder og aldri båret over til den andre** — samme klasse som
byggeplassfilteret (9 kopier, 3 ødelagte) og trafikklys-etikettene.

## Metode

Topologien er lest fra compose-filene og `pdf-render/server.mjs` — sannhetskilden for
oppsett. Ett live-kall mot prod (`/dev-login` → 404). **Runtime-tilstand er ikke
verifisert**; kjør
`ssh -t server-ny "sudo docker network inspect appnet --format '{{range .Containers}}{{.Name}} {{end}}'"`
hvis den skal bekreftes.
