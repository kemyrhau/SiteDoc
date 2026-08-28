---
name: sikkerhet
description: Samlet sikkerhetsvurdering — hva er målt, hva er åpent, hva er avgjort. Erstatter spredte punkter i STATUS-AKTUELT og containertopologi-notatet.
status: 🟠 LEVENDE — oppdateres ved hvert funn og hver lukking
sist_verifisert_mot_kode: 2026-08-28
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

## Metode

Topologien er lest fra compose-filene og `pdf-render/server.mjs` — sannhetskilden for
oppsett. Ett live-kall mot prod (`/dev-login` → 404). **Runtime-tilstand er ikke
verifisert**; kjør
`ssh -t server-ny "sudo docker network inspect appnet --format '{{range .Containers}}{{.Name}} {{end}}'"`
hvis den skal bekreftes.
