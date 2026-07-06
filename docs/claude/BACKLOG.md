---
name: BACKLOG
description: Konsolidert backlog — alt planlagt men ikke ferdig, kategorisert. STATUS-AKTUELT.md eier kun aktivt arbeid (maks 3 PR).
sist_verifisert_mot_kode: 2026-06-08
---

# Backlog

All planlagt-men-ikke-startet eller deprioritert arbeid samles her, slik
at STATUS-AKTUELT.md kan holdes kort (kun aktive PRs). Nye oppgaver
plasseres i riktig kategori. Når en oppgave startes, flyttes den til
STATUS-AKTUELT.md § Pågående arbeid; ferdige PRs flyttes videre til
`historikk-YYYY-MM.md` etter prod-deploy.

Legenda: 🔴 ikke startet · 🟡 delvis · ⏸️ parkert · ❓ trenger avklaring.

## 1. Teknisk gjeld

### 🟡 Server-ny vedlikehold: OS-oppdateringer + restart (før redesign-stack)

server-ny melder «System restart required» + ~36 ventende pakke-oppdateringer (observert 2026-07-05 under test-web-rebuild). Ikke akutt, men **bør gjøres før dere reiser den tredje redesign-stacken** (`-p redesign`, `sitedoc_redesign`) på samme maskin — en restart midt i tre kjørende stacks (prod + test + redesign) er mer risikabelt. Handling: planlagt vedlikeholdsvindu → `apt upgrade` + `reboot` (Kenneth, sudo), verifiser prod + test kommer opp igjen (innlogget) etterpå.

**Disk LØST 2026-07-06:** root-LV utvidet 100→500G (528G lå uallokert i VG — underallokert, ikke full disk). **Gjenstår:** OS-oppdateringer + restart (36 pending); `--exclude apps/mobile` i rsync (2,98GB kontekst-bloat); prune-rutine.

### 🟢 Dagsseddel: dobbel timeføring (total-tid + per-prosjekt) — a2 LØST 2026-07-06 (a1 fremtidig)

**Problem (Kenneth, 2026-07-05, prod-test):** Arbeideren førte først total
arbeidstid på sedel-nivå («Arbeidstid i dag»: fra/til/pause), og måtte DERETTER
føre timer per prosjekt på nytt. Oppleves som dobbelt arbeid og ustrukturert.

**a2 LØST (2026-07-06, develop) — vinduet er ikke lenger et påkrevd steg.**
`dagsseddel.opprett` prefyller arbeidstids-vinduet fra firma-kalenderen
(`hentEffektivArbeidstid`, Oslo-anker) i stedet for tomt; UI degradert til
sekundær/forhåndsutfylt/overstyrbar på begge detalj-sider (ny streng
`timer.arbeidstidPrefyltHint` — «timene føres på radene»). Radene + topp-sum er
primær-flaten → den brukervendte dobbel-føringen er borte. Bevart: pauseMin som
maskin-buffer, auto-gen-stien, arbeidstids-varsel. Se [timer.md § Dagsseddel a2](timer.md).

**Gjenstår (a1, fremtidig):** total arbeidstid **utledes** internt av sum(rader)
+ pause i stedet for et eget lagret vindu — full strukturell forening. Krever at
overtid (③) fortsatt får korrekt dagsnorm/overtid-split fra en UTLEDET total
(overtid bruker firma-dagsnorm, ikke vinduet, så a2 rører den ikke — men a1 må
verifiseres mot ③). Beslektet: **web-norm-paritet** (separat oppfølger). Se
dagsseddel-design.md, mobil-dagsseddel-ui-spec.md § U-flyt, timer.md. Del av
dagsseddel-UX-overhalingen (etter TestFlight).

### 🟡 Modul-onboarding-veiledning (wizard ved modul-aktivering)

**Idé (Kenneth, 2026-07-05):** Stegvis veiledning som viser ALLE steg som må
gjennomføres for en modul, trigget automatisk NÅR modulen aktiveres. Bakgrunn:
timer manglet lønnsarter på test fordi onboarding-seedingen (`aktiverNivaa1`)
ikke var kjørt/synlig — veiledningen skal gjøre slike forutsetnings-steg tydelige.

**Krav (Kenneth):**
- Trigges automatisk ved modul-aktivering (der modulen slås på).
- Dekker alle nødvendige steg (timer: aktiver Nivå 1 / seed lønnsarter,
  aktiviteter, tillegg, interne prosjekter, ...).
- Avbrytbar — bruker som ikke vil ha den stegvis kan lukke den.
- Re-aktiverbar senere fra modulen (samme sted den slås på).

**Generisk mønster:** gjenbrukbart per modul (timer, maskin, varelager, ...),
ikke timer-spesifikt. Koble til eksisterende idé-docs: onboarding-veileder.md,
prosjektoppsett-veileder.md.

### 🟡 i18n-duplikat: `timer.glemtDag.tittel` (to nøkler, andre vinner)

**Verifisert 2026-07-05 mot kode:** `timer.glemtDag.tittel` finnes **to ganger** i
`packages/shared/src/i18n/nb.json` (linje 42 «Gjenopprettet dag — estimert» +
linje 57 «Glemte du å avslutte?») og tilsvarende i `en.json` (grep-count 2). JSON
lar den **siste** vinne → linje 42-verdien («Gjenopprettet dag — estimert») er
**død** og vises aldri. De to er semantisk ulike (recall-badge vs glemt-dag-prompt)
→ én må omdøpes (f.eks. `timer.gjenopprettetDag.tittel` for badge-varianten), ikke
bare slettes. Sjekk kode-bruk (`grep timer.glemtDag.tittel apps/*/src`) FØR omdøping
for å treffe riktig call-site. Gjelder alle 15 språkfiler (duplikatet er kopiert av
`generate.ts`). Lav prio (kosmetisk feil tekst på recall-badge), men lønns-nær UI.


### 🟢 Mobil Microsoft-auth — BYGGET I EAS-SKY #37 2026-07-01 (venter Azure + Florian-test)

**Status (2026-07-01):** Kode implementert + gate-verifisert (commit `f8594d1c` develop / merget til main via `bc744f82`). Ekte dedikert Entra public-client-id (`234ca0e0-…`) inn på alle fire eas.json-profiler. Code+PKCE-flyt, knapp-gating, typecheck rent (12 baseline-feil uendret, ingen i auth-filene). `mobilAuth.byttToken` + orphan-guard **urørt**. **Bygget i EAS-sky-bunt #37** (bygg-ID `496b6a63`, status `finished` m/ .ipa, 2026-07-01) → TestFlight. **Gjenstår (Kenneths hånd):** (a) Azure-sjekklista under (dedikert «SiteDoc Mobile»-app, redirect `sitedoc://auth`, public client flows, Graph-scopes) — **MÅ være kjørt før MS-login faktisk virker for Florian**; (b) Florians test i TestFlight-bygget. Lokale bygg forkastet som blindvei (se [eas-build-veileder.md § Fallgruver](eas-build-veileder.md)).

**Design (referanse — implementert som beskrevet):**

**Rotårsak (verifisert mot kode):** Mobil-MS har aldri vært funksjonell. `EXPO_PUBLIC_MICROSOFT_CLIENT_ID="disabled"` på alle EAS-profiler (`eas.json:21,34,48,63`, slik siden `a4aa8fd6` 2026-03-07 — ikke en regresjon). MS-knappen (`logg-inn.tsx:131-139`) rendres alltid, kaller `loggInnMedMicrosoft()` (`services/auth.ts:99`) som bygger `AuthRequest` med `clientId:"disabled"` → Microsoft avviser → `null` → stille feil. I tillegg bruker flyten implicit (`responseType:Token`, `usePKCE:false`) som Entra normalt avviser for public/native-klient. Florians koblede `microsoft-entra-id`-Account ble laget via **web** (Auth.js, virker), ikke mobil. Mobil-auth er egen flyt (`expo-auth-session` + `mobilAuth.byttToken` mot Fastify), **ikke** web-Auth.js — web-`signIn`-gaten er irrelevant for mobil. Mobil-sesjon = 30 dager (ikke web-ens 24t maxAge), så «sesjon utløp»-teorien gjelder ikke.

**Vedtatt design:** authorization code + PKCE, **app-side** token-utveksling (public client = ingen secret i appen), resulterende MS access token → **uendret** `mobilAuth.byttToken` (Graph `/me`-verifisering + orphan-guard). **Sikkerhetsgaten bevares 100 %** — kun `canLogin` + invitert/eksisterende/koblet slipper inn (`91fa7867`), samme prinsipp som web. Implicit forkastes: Entra avviser for public client, ingen refresh, token i redirect-URL. `expo-crypto@15.0.8` (PKCE) + `expo-auth-session@7.0.10` (`exchangeCodeAsync`) finnes; `MICROSOFT_AUTH.tokenEndpoint` finnes allerede i `config/auth.ts`.

**Entra-registrering — DEDIKERT public-client-app** (besluttet: ren separasjon, ingen posture-endring på prod-web-auth). Azure-sjekkliste (Kenneths hånd, verifisert mot Microsoft Learn `reply-url` oppdatert 2026-06-15):
1. **App registrations → New registration** → navn «SiteDoc Mobile» → **Supported account types: Accounts in any organizational directory (multitenant)** — så A.Markussens tenant virker (samme som web).
2. **Authentication → Add a platform → «Mobile and desktop applications»** (IKKE «Web»/«SPA»). Custom redirect URI — se redirect-note under.
3. **Advanced settings → «Allow public client flows» → Yes** (i UI vist som «Enable the following mobile and desktop flows»). Trygt her — isolert public-app.
4. **API permissions → Microsoft Graph (delegated): `openid`, `email`, `profile`, `User.Read`** → grant/consent.
5. **Ingen client-secret** (public client).
6. Kopier **Application (client) ID** → blir ekte `EXPO_PUBLIC_MICROSOFT_CLIENT_ID`.
7. Florians første login (A.Markussen-tenant) kan trigge én consent (bruker-klikk, evt. IT-admin hvis tenanten låser app-consent). Engangs.

**Redirect-URI — LÅST: `sitedoc://auth`** (besluttet 2026-06-25, docs-verifisert). App-en produserer den via `makeRedirectUri({scheme:"sitedoc",path:"auth"})`, og **nøyaktig `sitedoc://auth`** registreres i Entra (steg 2 over). Begrunnelse: `makeRedirectUri({scheme:"sitedoc"})` *uten* path gir `sitedoc://` (sporet gjennom `expo-auth-session@7.0.10` → `expo-linking@8.0.11 createURL`: `getHostUri()→null`, `ensureLeadingSlash('',true)='/'`), men Microsoft-docs (reply-url, 2026-06-15) sier URI-er uten path-segment returneres med trailing slash (response_mode query/fragment) → eksakt-match-risiko; MS' egne mobil-eksempler bruker alltid path (`msauth.<bundle>://auth`). Path-varianten fjerner tvetydigheten. App-kode og Entra MÅ matche eksakt `sitedoc://auth`. Spesialtegn `! $ ' ( ) , ;` ikke tillatt (irrelevant her).

**Kode-endringsliste (når Azure + client-id er klar):**
| Fil | Endring |
|---|---|
| `apps/mobile/src/config/auth.ts` | Ny `erMicrosoftKonfigurert = microsoftClientId !== "" && !== "disabled"`. |
| `apps/mobile/src/services/auth.ts` | `loggInnMedMicrosoft()`: `responseType:Code` + `usePKCE:true`; etter `promptAsync` → `exchangeCodeAsync({clientId,code,redirectUri,extraParams:{code_verifier:request.codeVerifier}},{tokenEndpoint})` → returner `accessToken`. Discovery `{authorizationEndpoint,tokenEndpoint}`. Redirect via `makeRedirectUri({scheme:"sitedoc",path:"auth"})` → `sitedoc://auth` (låst). |
| `apps/mobile/app/logg-inn.tsx` | Gate MS-knappen på `erMicrosoftKonfigurert` (skjul når ikke konfigurert → ingen død knapp). |
| `apps/mobile/eas.json` | `"disabled"` → ekte client-id på relevante profiler (Kenneths verdi). |
| **Backend** | **INGEN endring** — `mobilAuth.byttToken`-kontrakt + orphan-guard urørt. |
| `docs/claude/*` | Oppdater `infrastruktur.md`/`eas-build-veileder.md` med Azure-stegene, samme commit som koden. |

Knapp-gatingen holder MS skjult til client-id er ekte → PKCE-koden er trygg å merge før Azure er ferdig hvis ønskelig. Koden alene fikser ingenting før Azure + ekte client-id + nytt EAS-bygg (env bakes inn ved byggetid).

**Lokal dev — ekte Entra client-ID for simulator (funn 2026-07-06) 🟡:** MS-login-flyten *virker* i iOS-simulator (systembrowser + Authenticator OK), men `apps/mobile`s lokale env har placeholder `din-microsoft-client-id-her` som `EXPO_PUBLIC_MICROSOFT_CLIENT_ID` → Entra svarer **AADSTS700016** (app ikke funnet i katalogen). Distinkt fra Azure-sjekklista over (den gjelder EAS-profiler/TestFlight, ikke lokal `.env`). Fiks: registrer/konfigurer en ekte Entra client-ID for lokal dev — enten gjenbruk «SiteDoc Mobile»-appen med lokal redirect-URI lagt til, eller egen dev-app-registrering m/ riktig redirect-URI. **Ikke prioritert** — `dev-login` dekker simulator-testing uten MS.

### ✅ Org uten standard-lønnsart (③b) — IMPLEMENTERT PÅ DEVELOP 2026-07-05 (web klar for prod, mobil venter EAS-batch)

Data-backfill garanterer nå at hvert firma med ≥1 ordinær lønnsart har en standard (migrering `20260705120000_lonnsart_overtidsnivaa`: foretrekk `Timelønn` seedNivaa=1, ellers laveste-rekkefolge ordinær; kun orgs som mangler standard, NOT EXISTS-guard). Auto-gen gjetter aldri (= B) — standard kommer fra `erStandardvalg`, korrigerbar i firma-konfig. F-G rød banner beholdes for null-ordinære-lønnsarter-tilfellet. Full detalj: [STATUS-AKTUELT § Timer auto-lønnsart ③](STATUS-AKTUELT.md) + [timer.md § Overtid-klassifisering](timer.md).

### ✅ Auto-overtid matchet feil lønnsart på navn (③a) — IMPLEMENTERT PÅ DEVELOP 2026-07-05 (web klar for prod, mobil venter EAS-batch)

Navne-regexen (`/overtid/i && /50/`) erstattet med strukturert `Lonnsart.overtidsnivaa` (Int?, nullable). Overtid velges nå via `velgOvertidLonnsart` (type=ordinaer + `overtidsnivaa`-match, aldri fritekst-navn); lærling-varianter beholdes `overtidsnivaa=null` i backfill → aldri auto-valgt for normal arbeider (kjernen i bugen). Backfill KUN seed-navn (`Overtid 50%`→50, `Overtid 100%`→100, seedNivaa=1); lærling + kunde-importerte (A.Markussens 170/172/175/177) settes manuelt i web admin-UI. Fallback: amber banner når firmaet mangler overtid-lønnsart (aldri feil-match, aldri stille drop). Klassifiserings-regelen isolert i `@sitedoc/shared` [lonnsregel.ts](../../packages/shared/src/utils/lonnsregel.ts) (forward-compat, se § Lønnsregel-konfig under). Full detalj: [timer.md § Overtid-klassifisering](timer.md).

### 🟢 Glemt-dag 0-bug (sen start, midnatt-splitt) — FIKSET PÅ DEVELOP 2026-06-24 (`c6babc44`, i EAS #32)

Glemt sent skift (start 21:33) ga 0.00t / ingen timer-rad. To rotårsaker fikset: **(c)** hele-dags pause+reise lå på start-segmentet → kort start-segment klampet arbeidstimer til 0 (`Math.max(0,…)`). Ny `fordelArbeidstidFradrag` (pause→lengste, reise→start m/ overflyt, kappet til kapasitet) bevarer dag-total-invariant, aldri kapp-og-mist. **(d)** manglende standard-lønnsart surfaces (se over). `splittVedMidnatt`/UF-2/F-A/F-B urørt. **Device-verifiseres på #32** (a: banner uten lønnsart, b: ~2.45t-rad m/ lønnsart + pause på lengste segment) før submit.

### ✅ Geofence-editor uoppdagbar — LØST + DEPLOYET TIL PROD 2026-07-04 (`b1c81629` i `bb5aec05`)

Fanget 2026-06-24: verken Kenneth eller kontroll-Claude fant geofence-editoren i web selv med steg-for-steg. Tre lag feil veivisning i `apps/web/src/app/dashbord/oppsett/byggeplasser/page.tsx`: (1) `bygning.opprett`-suksess kaster brukeren rett inn i fullskjerm tegnings-editor (`setRedigerLokasjonId`, :798) — ser ut som hovedflyten, men geofence er ikke der; (2) geofence-seksjonen ligger nederst i **«Endre navn»**-modalen (:1178–1309), åpnet av knapp med **Copy-ikon** + `t("lokasjoner.endreNavn")` — feil ikon + misvisende label; (3) modalen vises kun etter at en byggeplass er markert, og «Rediger» (blyant) åpner i stedet tegnings-editoren (motsatt av forventning). **Fix:** egen synlig «Geofence/Georeferanse»-handling på markert byggeplass, ikke auto-åpne tegnings-editor ved opprett, rett Copy-ikon/label.

> ✅ Implementert (`b1c81629`, egen synlig «Geofence»-knapp + rett ikon/label + ikke auto-åpne tegnings-editor) + deployet til prod 2026-07-04 (`bb5aec05`). Arkiv: [historikk-2026-07.md](historikk-2026-07.md). **Ny relatert bug oppdaget samtidig — se § Geofence-modal Leaflet under.**

### Geofence-modal: Leaflet-kart laster kun hjørne-fliser ✅ DEPLOYET TIL PROD 2026-07-04 (`6178034f` i `0801af38`)

Rotårsak i delt `KartVelger` (native `<dialog>`-Modal → `L.map()` init med 0×0-container ved mount). Fiks: `ResizeObserver` → `invalidateSize()` ved modal-open, `disconnect()` i cleanup. Full detalj: [historikk-2026-07.md § Prod-deploy 2026-07-04 (kveld) PR 2](historikk-2026-07.md).

### ✅ «Opprett firma» (sitedoc_admin) fungerer ikke — DEPLOYET TIL PROD 2026-07-04 (`6de25024` i `bb5aec05`)

**Rotårsak (1a):** CREATE↔LISTE-mismatch på `erKunde`. `admin.opprettOrganisasjon` (`admin.ts:156`) satte kun `name`+`organizationNumber` → `erKunde` falt til schema-default `false`, og `hentAlleOrganisasjoner` filtrerer `where: { erKunde: true }` (`admin.ts:109`, bevisst — skiller kundefirma fra skall-/faggruppe-firma). Firmaet *ble* opprettet (DB-rad), men filtrert bort fra lista → så «ut som» det ikke skjedde. Ikke stille server-feil, ikke refetch-bug, ikke deploy-drift (prosedyren er fra 2026-03-07; invalidering verifisert korrekt wiret). **Fiks:** `opprettOrganisasjon` setter nå `erKunde: true`. **(1b) var IKKE bug:** Brønnøysund-knappen er korrekt `disabled` til org.nr er 9 siffer (`firmaer/page.tsx:309`+`:91`); server (`brreg.ts`) fullt wiret — kun dårlig synlighet, adressert med `title`-tooltip (`brreg.hint`). I tillegg lagt `onError`+feilvisning på opprett-mutasjonen (defensiv — stille feil var i seg selv en mangel). #2 «kan ikke opprette prosjekt uten eksisterende firma» er fortsatt **IKKE bug** (firma-påkrevd, låst 2026-05-20, anti-orphan).

**Åpen oppfølger — prod-orphan-opprydding (Kenneths prod-DB-hånd):** Firma opprettet via modalen FØR fiksen er `erKunde: false` → forblir usynlige (fiksen gjelder kun nye). Blanket-backfill forbudt (ekte skall-firma *skal* være `false`). Read-only diagnose-SQL klar (teller `proj_orgs`/`primary_proj`/`avdelinger`/`moduler`/`members` per `erKunde=false`-firma; ekte orphans = alt 0, typisk navn «Sitedoc»). Kjøres mot prod `sitedoc` → Opus verifiserer trygge rader → Kenneth flipper smalt (`erKunde=true` på spesifikk id, blir synlig i UI) eller sletter.

### 🔴 Auto-deploy til test rebuilder ikke web (feilaktig antakelse hele økta)

Oppdaget 2026-06-24. Geofence-editor (A+B, `8deb3a4b`) + «Lokasjon»→«Byggeplass»-rename (C, `915400ac`) ble pushet til `develop` 2026-06-23/24, men **nådde aldri `test.sitedoc.no`**: navet viste fortsatt «Lokasjoner», `/dashbord/oppsett/byggeplasser` ga 404, `/lokasjoner` var urørt (verifisert via nettleser 2026-06-24). Antakelsen «testbart umiddelbart» for web-endringer — brukt gjennom hele økta — er **ugyldig**.

**Undersøk rotårsak:** om auto-deploy-til-test (a) **ikke trigges** av push til `develop`, (b) **ikke rebuilder web-imaget** (Docker-cache — jf. [DOCKER-NOTES § rsync FØR build](../../docker/DOCKER-NOTES.md): cache-bygg ~6 s vs ekte ~268 s, og rsync må skje først), eller (c) **ikke finnes** i det hele tatt. Korriger CLAUDE.md «Auto-deploy til test» (+ infrastruktur.md) om antakelsen er feil.

**Bidiagnose (2026-06-24):** manuell `rsync -a` (uten `--delete`) lar **slettede/omdøpte filer ligge igjen** på server — `apps/web/.../oppsett/lokasjoner/` ble ikke fjernet ved C-rename (ny `byggeplasser/` la seg ved siden av). Vurder `--delete` i deploy-mekanikken (men da må `.env`-bevaring sikres — `--delete` uten excludes ville slette server-`.env`). Hører til samme rotårsak-rydding.

**Umiddelbar workaround brukt:** manuell rsync `develop` → `server-ny:~/stack/sitedoc` + `sudo docker compose -f docker/docker-compose.test.yml build/up` (Kenneth, ekte TTY).

### 🟢 Web-timer-UI T.1-korrekthet — INTERIM GJORT 2026-07-05 (PSI-hook-delen forblir Fase 4/E)

Fanget under web-testing på prod 2026-06-24 (A.Markussen / 999 / 998). **Plan-først-verifisert mot kode 2026-07-05.** `DailySheet` har `@@unique([userId, dato])` (`db-timer/prisma/schema.prisma:176`) og **`projectId` ble droppet** (T.1, 2026-05-11, kommentar `schema.prisma:137-138`) — dagsseddel er firma/arbeider-eid, prosjekt ligger på rad (`SheetTimer.projectId`, `:201`). Verifisert også i generert klient: `DailySheetWhereInput` har **ingen** `projectId`-nøkkel. Web-UI behandlet den fortsatt som prosjekt-eid → modell-mismatch. **Detalj-siden (`dashbord/timer/[id]/page.tsx`) er allerede T.1-korrekt** (grupperer rader per `(projectId, ECO)`, «+ Legg til prosjekt», per-rad prosjektvelger) — redesignen rører den ikke.

**Beslutning 2026-07-05 → interim implementert 2026-07-05.** De tre korrekthets-buggene (①②③) er lav-skade men reelle modell-mismatch, og fiks er lokal til timer-sidene (ikke frossen sone, ikke sammenfiltret med PSI-redesignen). Derfor tatt som **interim T.1-korrekthets-fiks** nå (se «Interim-status» under). Den PSI-drevne delen — auto-forslag av prosjekt fra tilstedeværelse (④) + prosjekt-fane-redesign — forblir **Fase 4 Mannskap/PSI** (se «Retning» under); ⑤ er verifisert tilsiktet.

**Interim-status (implementert 2026-07-05, develop):**

- **① ✅ GJORT** — `list`-query bruker eksplisitt `where` med rad-prosjekt-filter `timer: { some: { projectId } }` (ikke lenger spread av ugyldig `projectId` på `DailySheetWhereInput`). Prosjekt-kontekst-lista viser nå faktiske sedler med ≥1 rad for prosjektet.
- **② ✅ GJORT** — `list`-retur beriker hver sedel med `prosjektIder` (distinct `projectId` på tvers av timer-/maskin-/tillegg-rader). `mine/page.tsx` utleder prosjekt-kolonne + «antall prosjekter» fra dette (ikke lenger `rad.projectId` som ikke finnes).
- **③ ✅ GJORT** — web-opprett er nå **dato-only**: `opprett`-input droppet `projectId`, auth bruker org-tilgang (`krevBrukersOrg` + `krevTimerAktivert`) i stedet for `verifiserProsjektmedlem`; prosjekt-velgeren + geo-forslag fjernet fra `ny/page.tsx`. Prosjekt legges per rad på detalj-siden. Fjerner den misvisende velgeren og kilden til P2002-forvirringen (`@@unique([userId, dato])` består — én sedel per dato er korrekt).
- **④ 🟡 FORBLIR FASE 4/E** — auto-forslag/auto-utkast av prosjekt i web (PSI-innsjekk + GPS-hook) er ikke bygd; avhenger av Fase 4 Mannskap/PSI (se «Retning»).
- **⑤ ✅ verifisert tilsiktet** — byggeplass-velger bevisst deaktivert i web-timer.

**Verifiserte funn (2026-07-05, mot kode — pre-fix; ①②③ fikset interim samme dag, se «Interim-status» over):**

- **① 🔴 Prosjekt-kontekst-timer-lista (`[prosjektId]/timer/page.tsx:61`) er runtime-brutt.** BACKLOG antok tidligere «lista filtrerer for dette prosjektet» — virkeligheten er verre: `list`-query (`dagsseddel.ts:472`) legger `projectId` inn i `DailySheetWhereInput` via spread (omgår TS excess-property-sjekk → typechecker, men feiler i runtime). Prisma kaster `PrismaClientValidationError` (unknown arg — `DailySheet` har ingen `projectId` siden T.1) → React Query-feil → siden faller til tom-tilstand (`:161`). Så lista viser **alltid tomt for ALLE sedler**, ikke bare kryss-prosjekt. Live siden 2026-05-11, maskert som «ingen data». P2002-kollisjonen reproduseres slik: mobil lager `(bruker, dato)`-sedel på prosjekt A → web «Ny dagsseddel» velger prosjekt B (kun auth) samme dato → `upsert` treffer `@@unique([userId, dato])` → «Du har allerede en dagsseddel for denne datoen» (P2002, **`dagsseddel.ts:617-620`** — BACKLOG sa `:650`, driftet linjenr) for en sedel arbeideren ikke ser.
- **② 🟡 «Mine timer» (`mine/page.tsx`) leser `rad.projectId` fra DailySheet (finnes ikke).** `list`-retur (`:497-501`) sprer `...s` (sedel uten projectId) → `rad.projectId === undefined` → prosjekt-kolonne (`:306`) alltid «—», «antall prosjekter» (`:112`) alltid 1. Riktig kilde = radenes `projectId` (sedelen har `timer[]`, men mappingen kaster dem).
- **③ 🔴 «Ny dagsseddel» (web, `dashbord/timer/ny/page.tsx`) har misvisende prosjekt-velger + er P2002-kollisjonskilde.** `opprett` (`dagsseddel.ts:549`) tar `projectId` som påkrevd input, men bruker den **kun til auth** (`verifiserProsjektmedlem`, `:571`) — lagrer den aldri; sedelen opprettes tom. Prosjektvalget velger altså ingenting reelt.
- **④ 🟡 Ingen forslag/auto-utkast i web:** «intelligent timeføring» (`genererForslag`) er mobil-only — bekreftet ingen web-motpart.
- **⑤ ❓→✅ Byggeplass-velger deaktivert i web-timer — verifisert tilsiktet:** `[prosjektId]/timer/page.tsx:47` kaller eksplisitt `useToppbarFiltre({ byggeplass: false })`. Bevisst, ikke hull. Asymmetri består: `DailySheet` har `byggeplassId` men ikke `projectId`.

**Retning (PSI-drevet, Fase-4-avhengig) — lovforankret:**

- **Prosjekt-kontekst fra PSI-innsjekk** (§15 byggherreforskriften — lovpålagt tilstedeværelse) + GPS: systemet **foreslår** prosjektet (mobil), arbeider **korrigerer** (arbeidsmiljøloven krever korrekte timer → feil prosjekt-attribusjon = feil lønn/faktura; legitime kryss-prosjekt-dager finnes: forberedelse / materialhenting / flytting mellom plasser). Web kan ikke vite lokasjon → **manuelt per rad**. GDPR: GPS event-basert (inn/ut), aldri kontinuerlig spor.
- **G1 revurderes mot lovverk:** «foreslå + korrigerbar» er ikke en begrensning, men nettopp det juridisk korrekte records krever. Et hardt PSI-lås ville tvunget frem feil attribusjon → brudd på lønns-/faktura-korrekthet.
- **Avhengighet:** PSI innsjekk/utsjekk = Fase 4 Mannskap (ikke bygd) + web-UI-redesign. Se [terminologi.md § 0](terminologi.md), [timer-gps-prosjekt-utredning.md](timer-gps-prosjekt-utredning.md) (G1), [mannskap.md](mannskap.md).
- **Interim (når saken tas):** web-opprett = **kun dato** → detalj → **per-rad prosjekt** (modell-korrekt, forward-kompatibel med PSI-forslag). Fjern misvisende prosjekt-velger på opprett; erstatt runtime-brutt prosjekt-liste-filter (redirect til «mine», eller filtrer via rad-prosjekt `timer.some({ projectId })`); rett «mine»-kolonnen til å utlede prosjekt fra rader.

- **🔴 Advarsel ved 2+ byggeplasser:** ved oppsett av flere byggeplasser på et prosjekt, minn om at geolokasjon/geofence bør settes per byggeplass (ellers ingen GPS-auto-valg). Akseptert som OK: prosjekt-georef (Prosjektlokasjon) vs byggeplass-georef-konflikt der byggeplass-velger er deaktivert i prosjekt-innstillingen.

### 🟡 HMSREG-push — ekstern §15-rapportering (dedikert fase, IKKE bygg nå)

Push av `PsiTilstedevarelse`-tilstedeværelse til **HMSREG** (`az-api.hmsreg.com`) så byggherre får lovpålagt §15-data. Ruting-nøkkelen `Byggeplass.hmsregNummer` (Int?, additiv) er lagt til i PSI Fase A-commiten (2026-07-05); selve push-en gjenstår. Full felt-mapping + push-event-modell + arkitektur-avklaring i [mannskap.md § HMSREG-integrasjon](mannskap.md).

**Mønster (som SmartDok-eksporten — kø + ekstern API, ikke live):**
- **Queue** til `az-api.hmsreg.com` — `/api/v2/registration` (inn/ut-events) + `/api/v2/course` (kurs/kompetanse).
- **Item-queue-status-polling** (async — HMSREG kvitterer ikke synkront).
- **Auth:** source/provider-ID + auth-header-secret (aldri til klient — nøkkelhåndterings-regelen). **Provider-registrering hos HMSREG er en forutsetning** før push kan skje.
- **Idempotens:** `externalRef` = deterministisk UUID av `(rad-id + direction)` → to POST-er per rad (`In @ innsjekkTid`, `Out @ utsjekkTid`), retry-trygt.
- **`cardType` default `"HMS"`.**
- **🔴 Reell begrensning:** arbeidere med `harIkkeHmsKort=true` **kan ikke rapporteres** (HMSREG krever `cardNumber`) — de blir i intern §15-liste men faller ut av push; krever eksplisitt PL-varsel.
- **GDPR:** push-kanalen sender full data (inkl. tidspunkt) til byggherre på grunnlag art. 6(1)(c) (byggherreforskriften §15). Kolliderer **ikke** med den strenge interne feltnivå-isolasjonen (byggherre leser aldri klokkeslett i SiteDoc-UI-et) — ulike flater, samme rettsgrunnlag.

Forankring: [mannskap.md](mannskap.md) (Fase A live 2026-07-05), Fase B–E (QR/geofence/PDF/timer-hook) parkert; HMSREG-push er sideordnet Fase D-nivå (ekstern rapportering).

### 🔒 SheetMachine.vehicleId org-validert (§2.D) ✅ DEPLOYET TIL PROD 2026-07-04 (`90469dc7` i `0801af38`)

Pre-eksisterende cross-firma-lekkasje-klasse (åpen siden 2026-06-09): `SheetMachine.vehicleId` (maskindrift) ble skrevet uten org-validering. Fiks: `verifiserKjoretoyTilhørerFirma` på alle fem input-baserte skrive-stier (`maskin.tilfoy`/`maskin.oppdater`/`redigerSedelRader`/`splittRad`/`syncBatch`). Full detalj: [historikk-2026-07.md § Prod-deploy 2026-07-04 (kveld) PR 1](historikk-2026-07.md).

### Pre-eksisterende typecheck-gjeld (mobil + web) 🟡

Fanget under R4-konsistens-sjekk (2026-06-11) — **ikke R-serie-introdusert** (R-serie-filer er rein; verifisert mot kode). Type-only, blokkerer **ikke** byggene (EAS = Metro/Babel uten `tsc`; web Next.js-build typesjekker ikke test-filer).

- **Mobil (~12 feil):** `erstattVedlegg` mangler i `UseOppgaveSkjemaResultat`/`UseSjekklisteSkjemaResultat` (`useOppgaveSkjema.ts:615`/`useSjekklisteSkjema.ts:594` — egenskapen finnes i runtime, type-interface usynket); `timerSync.ts:313/339` Drizzle-overload på `byggeplassId` (`string | null` vs insert-type); + følgefeil i `oppgave/[id].tsx`, `psi/[psiId].tsx`, `sjekkliste/[id].tsx`.
- **Web (1 feil):** `vitest`-modul mangler typer i `src/components/mengde/__tests__/import-hjelpere.test.ts` (test-tooling, ikke produksjonskode).

Fiks når noen rører de filene: synk hook-resultat-typene med faktisk retur, og gi `byggeplassId` riktig Drizzle-type / `vitest` til devDependencies+tsconfig. Lav prio — ingen runtime-effekt.

### `apps/mobile` mangler test-runner — rene utils udekket 🟡

`apps/mobile` har ingen test-runner (verken `test`-script, jest/vitest-config eller `*.test.ts`). Rene, logikk-tunge hjelpere er derfor udekket av automatiserte tester. Konkret fanget ved Slice 4a (2026-06-20): **`splittVedMidnatt`** (`apps/mobile/src/utils/dagsegment.ts`) ble kun manuelt verifisert (tsx-kjøring). Casene som bør dekkes når en test-beslutning tas: **nattskift 19→07 = 5t+7t=12t** (sum = reell total), **dagskift** (1 segment, uendret), **degenerert** (slutt ≤ start → ett 0-segment), **fler-døgn** (glemt-dag → N segmenter, sum = total). Vurder å **flytte den rene helperen til `@sitedoc/shared`** (web bruker allerede `vitest` — jf. `src/components/mengde/__tests__/`), evt. introdusere vitest i `apps/mobile`. Lav prio — ingen runtime-effekt, men midnatt-splitt er lønns-sensitiv logikk som fortjener regresjonsdekning.

### Metro blockList — `.env.eas.local` knekker `expo run:ios` ✅ FIKSET 2026-07-06 (venter dual-review)

`apps/mobile/.env.eas.local` (credential-fil, gitignored) ligger i prosjektroten og overvåkes av Metro (`metro.config.js` har `watchFolders` = hele monorepoet, men **ingen `resolver.blockList`**). Ved `expo run:ios` kan Metro forsøke å bundle/lese fila → bygg-brudd. **Fikset i web-runde s1 (2026-07-06):** `config.resolver.blockList += /\.env\.eas\.local$/` (additivt til Expos defaults) i `metro.config.js`. I arbeidstreet, venter dual-review/commit.

### Test-web (:3300) mangler healthcheck + restart-policy i compose 🟡

Under dev-login-feilsøkingen 2026-07-06 var `sitedoc-test-web` (:3300) død (connection reset) mens test-api (:3301) var frisk — Kenneth måtte restarte containeren manuelt. `docker/docker-compose.test.yml` har ingen `healthcheck` eller aktiv `restart`-policy som fanger en død web-prosess. Fiks: legg `healthcheck` (curl mot `/` eller en health-rute) + `restart: unless-stopped` (verifiser at web-tjenesten har det — api har det) i test-compose, så en død test-web auto-restartes i stedet for å stå og resette. Lav prio (kun test-miljø), men rammer agent-/simulator-testing når web-siden trengs.

### Navigasjonsredesign — dev-login secrets-oppsett (Kenneth) 🟡

Dev-login (agent-testing, Nivå A+B) er på develop, men **virker ikke før Kenneth setter secrets** (aldri i git): (1) `ENABLE_DEV_LOGIN=true` + `DEV_LOGIN_SECRET=<hemmelig>` i `docker/env/api-test.env` → rebuild api-test; (2) seed testbrukere mot `sitedoc_test` (`seed-testbrukere.ts`); (3) EAS-secret `EXPO_PUBLIC_DEV_LOGIN_SECRET` (= samme verdi) for mobil-knappen. Detaljer: [dev-login-agent.md](dev-login-agent.md). Samme gjelder steg v-retesten (rebuild api+web + `seed-oversettelse-test.ts`).

### CLAUDE.md over 40k-tegn-grensen (40373 tegn) 🟡

CLAUDE.md er 40373 tegn — 373 over den ufravikelige 40k-grensen. Nye indeks-rader (f.eks. `dev-login-agent.md`) legges derfor i DOC-MAP i stedet (jf. presedens `parallell-arbeid-lock.md`). Trenger en dedikert trim-runde (kollaps redundante regel-blokker mot detalj-filer) for å komme under grensen igjen.

### Følgesaker etter prod-deploy 2026-06-21

Fanget i avslutnings-auditen etter Slice 1–4 + reise + GPS L1 prod-deploy (`32b88bd7`).

- **🔴 EAS prod-bygg = GATE før mobil-prod (gjenstår — arbeidere kjører gammel app):** prod-deployen 2026-06-21 var server (API+web) KUN. ALLE mobil-endringene (auto-utkast/Slice 3, midnatt-splitt/4a, glemt-dag-prompt/4b-1, reise-cache/R4, GPS L1, attestering-badges) når IKKE arbeidernes telefoner før et **EAS prod-bygg + TestFlight/Play**. **Forutsetning:** enhetstest på fysisk enhet (Start/Slutt-dag, midnatt-splitt, glemt-dag-prompt, badges) — simulator er blokkert (NordVPN/IPv6 + Cloudflare↔Expo-Go-quirk). Enhetstest er gaten; ingen mobil-prod før den er grønn.
  - **✅ Backend-gate 🟢 VERIFISERT 2026-06-21 (mot `sitedoc_test`):** 4 migrasjoner `finished`+ikke-rolled-back i `_prisma_migrations` OG schema faktisk anvendt (`reisetid_matrise`-tabell, `timer.sheet_timer.beskrivelse`, `timer.daily_sheets.slutt_tid_kilde`, `public.organization_settings.arbeidstid_varsel_timer` default 13). Test-deploy à jour (HEAD = develop-tipp inkl. T.12 web), `sitedoc-test-api`/`-web` online, API serverer (`/health` 200, tRPC auth-gating korrekt), `test.sitedoc.no` 200. Server/DB-siden av Slice 3/4 er live; mobil-atferden verifiseres på enhet (sjekkliste under).
  - **Device-verifiserings-sjekkliste (Fase 2 — kjøres etter fersk test-build på fysisk enhet):**
    1. **Auto-utkast:** «Start dag» → «Slutt dag» → draft genereres automatisk med rader (ikke tom), `status=draft` (ingen auto-innsending).
    2. **Korrigerbar:** endre en auto-rad → send inn (`draft→sent`).
    3. **Prosjekt synlig per rad (Slice 1) + fritekst per rad (T.12):** skriv produksjonsbeskrivelse, lagre, vises.
    4. **Nattskift-splitt:** 19:00→07:00 → 2 sedler (5t + 7t = 12t); start-dag bærer reise/pause.
    5. **Glemt-dag:** start, ikke avslutt, åpne neste dag → prompt «jobber du fortsatt / glemte å avslutte?».
    6. **System-flagg:** systemavsluttet dag → `sluttTidKilde="system"` → kontroll-badge i attestering.
    7. **Arbeidstids-varsel:** seddel >13t → gult varsel, ikke blokk (kan fortsatt sende). Sjekk også **(a) web-badgen mot ekte data**.
    8. **Reise R4:** «Start dag» fra kontor → reisetid-forslag fra matrise (gammel E4).
    9. **Offline:** nett av → registrer/endre → nett på → sync (`projectId` per rad).
    10. **T.11 maskinførerbevis-flagg (soft):** **Forutsetning — kompetansematrise må seedes:** minst én bruker MED gyldig (ikke-utløpt) `AnsattKompetanse` kategori `TRUCK-/MASKINFØRERBEVIS` + minst én UTEN, ellers er flagget alltid `true`/`false` og varselet kan ikke ses. Verifiser: (a) **arbeider** uten gyldig bevis → maskin-seksjon vises fortsatt (Equipment-cache-gaten uendret), men amber soft-varsel «flagget for synlighet» over radene; lagring IKKE blokkert. (b) **arbeider** med gyldig bevis → ingen varsel. (c) **leder** i attestering (web + mobil) → amber-badge på sedel med maskinarbeid uten bevis. (d) flagget synker via `kompetanse.minMaskinstatus` → SecureStore ved maskin-katalog-refresh (login/nett-gjenkomst) — logg inn på nytt etter matrise-endring for å oppdatere.
- **Deploy-divergens test=PM2 / prod=Docker (latent paritets-risiko)** 🟡 — verifisert 2026-06-21: TEST kjører fortsatt på gammel server (`Kenspill`/WSL, PM2-prosesser `sitedoc-test-api`/`-web`), mens PROD flyttet til server-ny Docker 2026-06-10. To ulike deploy-mekanikker, miljøvariabel-oppsett og runtime-baner. **Risiko:** noe som virker på test (PM2-build, ikke-containerisert) kan oppføre seg ulikt i prod (Docker, `--no-deps`, compose-nett) — paritets-feller fanges ikke før prod-deploy. Vurder å flytte test til samme Docker-mekanikk som prod (eller dokumentere divergensen eksplisitt i deploy-veilederen). Ikke-blokkerende, men bør lukkes før test mister verdi som prod-forhåndssjekk.
- **NorBERT `embed`/`oversettelse`-rebuild (gjenstår — krever Kenneth sudo):** bind-fix-koden (`NORBERT_HOST`) er merget til prod, men containerne ble bevisst IKKE gjenskapt i denne deployen (`--no-deps`). Rebuild + re-sjekk `REACHABLE` (3302) + innlogget AI-søk-verifisering = egen oppgave. Reconciler samtidig prosjektnavn (under).
- **Compose-prosjektnavn-reconcile (`docker` ↔ `sitedoc`):** kjørende prod-containere er prosjekt `docker`; `docker-compose.yml` har `name: sitedoc` → krever `-p docker` ved hver `compose`-kommando. Bestem ett navn permanent (down + up under riktig `-p`, eller dropp `name:`). Gjøres når NorBERT-rebuild uansett gjenskaper embed/oversettelse. Dok: [DOCKER-NOTES § Deploy-mekanikk](../../docker/DOCKER-NOTES.md).
- **`add_klasse4_indekser` finished_at NULL (lavprio):** `_prisma_migrations` viser `20260430120000_add_klasse4_indekser` med tom `finished_at` på prod. Avklart ikke-blokkerende (indeksene er anvendt, `migrate deploy` 2026-06-21 lyktes uten å snuble på den). Rydd raden (sett finished_at, eller resolve) når noen uansett er i prod-DB.
- ~~**CLAUDE.md nær størrelsesgrense (39844/40k)**~~ ✅ **TRIMMET 2026-06-21** → 39105/40k (895 under). Server-deploy-mekanikk-blokken kollapset til 2 styrende regler (sudo/TTY + migrerings-gate) + peker; detalj-kulepunkter står i [DOCKER-NOTES § Deploy-mekanikk](../../docker/DOCKER-NOTES.md). Ingen overordnet regel fjernet.
- ~~**Slett `redesign-dagsseddel-funn-2026-06-20.md`**~~ ✅ **GJORT 2026-06-21** — alle unike beslutninger Explore-verifisert fanget i sannhetskilder (R/P→fase-0 T.11/T.12, BESLUTNING 1→timer-gps-utredning, GAP-1→fase-0 C.16, GAP-2→dagsseddel-design, Slice 3/4→timer.md). Fila slettet (var ikke i STATUS-register/DOC-MAP/fil-telling).
- ~~web-parity T.12 (`TimerRadDialog`)~~ ✅ **GJORT 2026-06-21** (`8f92f0ea`) · ~~DRIFT-1..5 (timer.md-rensing)~~ ✅ **GJORT 2026-06-21** (se § Doc-drift under). Står fortsatt: arbeider-review arbeidstids-badge (§ Slice 4 over).
- **Fillagring: CLAUDE.md sier «S3-kompatibel», virkeligheten er server-lokal disk** 🟡 (fanget under Funn #2, 2026-06-21) — REST `/upload` (`apps/api/src/routes/upload.ts`) lagrer til `process.cwd()/uploads`, servert statisk via `@fastify/static` (`server.ts:77`). **Ingen S3/R2/MinIO-klient finnes** i `apps`/`packages` — gjelder HELE bilde-stacken (sjekkliste/oppgave/rapport/tegninger/tillegg-kvittering), ikke bare timer. **Handling (velg én):** (a) **dokument-fiks (rask):** oppdater CLAUDE.md tech-stack-linja fra «S3-kompatibel» til «server-lokal disk (S3-klar)» så docs speiler virkeligheten; ELLER (b) **implementer S3 som egen tverrgående oppgave:** S3/R2-klient + migrer eksisterende `/uploads`-filer + bytt upload-rute + `fileUrl`-format for hele stacken. Ikke-blokkerende.
- **Funn #2 tillegg-kvittering — 2 MVP-kanter** 🟡 (2026-06-21): (1) **Offline server-slett:** fjernes et opplastet vedlegg uten nett, slettes lokal rad + fil umiddelbart men server-recorden blir kortvarig foreldreløs (`fjernTilleggVedleggServer` er best-effort online). Bør køes for retry, eller ryddes av en periodisk server-jobb. (2) **Cross-device vedlegg-slett ikke pull-synket:** sletter enhet A et vedlegg, fjerner ikke pull det fra enhet B's lokale cache (pull er additiv upsert, ingen tombstone). Begge lav-frekvente; løses når tillegg-vedlegg får full to-veis-sync (samme mønster som evt. fremtidig sheet-row-tombstones).

### UI/device-test-funn (2026-06-21) — UI-sesjon-saker 🟡

Fanget under enhetstest av timer-redesignet på fysisk enhet. Samles til en dedikert UI-polish-sesjon (ikke blokkerende).

- **✅ (a) Prosjekt-felt-affordance — LUKKET (U2).** Delt `VelgerFelt`-komponent med chevron-affordanse på alle 10 modal-velgere.
- **✅ (b) Topp-sum på dagsseddelen — LUKKET (U1).** Dag-total øverst, synlig uten scroll.
- **✅ (c) v2-visuell polish — LUKKET (U3).** Gruppe-header byggeplass + ECO-badge + kort-stil + kollaps-animasjon.

**UI/device-test-funn (2026-06-22/23) — andre enhetstest-runde, alle ✅ LUKKET:**
- **✅ Tidshjul (blocker) — LUKKET.** Inline iOS-spinner i fra/til-velgeren rant utenfor høyre skjermkant (rendret i halv-bredde `flex-1`-kolonne) + valgt tid committet ikke ved trykk. Fiks: modal-basert full-bredde spinner + «Ferdig»-knapp (`FraTilTidFelt.tsx`); Android `display="default"` urørt.
- **✅ Keyboard-dismiss numeriske felt — LUKKET.** iOS decimal-pad manglet lukk-tast → ny delt `TastaturFerdig` (`InputAccessoryView` + «Ferdig») på timer/maskin/mengde/tillegg-antall-feltene.
- **✅ Grønn-boks-wording — LUKKET.** «Maskin Xt / Arbeid Yt» leste additivt → omformulert til «Herav maskin Xt av Yt arbeid» (`timer.gruppe.maskinAvArbeid`).

- **🟡 Registrerings-forenkling — UX-økt (etter TestFlight).** Mål: gjøre timeregistreringen **mindre tungvint** + fjerne misforståelig info — forankret i redesign-fokuset (arbeider-forståelig + enkelt). Kenneth prioriterte tre punkter (2026-06-23 enhetstest):
  1. **For mange bannere/signaler stablet** på dagsseddel-skjermen — topp-sum + «du har ført X» + «venter på sync» + arbeidstid-kort konkurrerer om oppmerksomheten. Vurder å slå sammen / nedprioritere / vise betinget.
  2. **Misforståelige etiketter** — «av 7.50t», «herav maskin», «Maskin/Arbeid» tolkes feil av arbeider. Gjennomgå ordlyd for felt-arbeider-forståelse.
  3. **For mange steg** — åpne sedel → modal → felter → lagre → tilbake. Vurder å redusere stegene (inline-redigering, færre modaler, hurtigregistrering).
  4. **Smart fra/til-default** — ny timer-rad bør starte etter **siste registrerte `tilTid`** på sedelen, ikke alltid 07:00–15:00 (default sjekker ikke eksisterende rader → arbeider må re-justere hver rad i et fler-rads skift).
  **Eksplisitt IKKE i scope:** antall felt per rad (det er ikke problemet). Egen UX-økt etter TestFlight-validering av gjeldende redesign.

- **🟡 Byggeplass/underprosjekt-timeregistrering (mobil).** I dag kan man kun «Legg til prosjekt» på en sedel — ikke byggeplass eller underprosjekt. Separat fra forenkling-økta; hører til [byggeplass-strategi.md](byggeplass-strategi.md)-fasen + registrerings-forenkling-økta. Ønsket:
  1. **Valgfri drill-down** — pil til høyre i prosjektvelgeren → velg **byggeplass** (fysisk sted, mange per prosjekt) eller **underprosjekt** (utledet fra dokumentflyt-godkjenning — distinkt fra byggeplass). Default forblir prosjekt-nivå (ingen tvang).
  2. **Visuell forsterkning øverst** (blå) av aktivt prosjekt + byggeplass.
  3. **Føre timer per byggeplass** for å dele arbeidsdagen innen ett prosjekt (eks. «101 — småprosjekter» med mange byggeplasser).
  **Geo-anker:** geolokalisering ligger på **byggeplass** (via tegninger), ikke prosjekt → GPS kan på sikt foreslå byggeplass. Krever sannsynligvis å utvide mobil-cache + sedel-/rad-modell med byggeplass/underprosjekt-tilknytning (avklares i byggeplass-strategi-fasen).
  **Status (kode-review 2026-06-23 — se [timer-gps-prosjekt-utredning.md § 2026-06-23](timer-gps-prosjekt-utredning.md)):** = **Beslutning 6** i utredningen, fases:
  - **✅ Sedel-nivå byggeplass (én/dag): IMPLEMENTERT PÅ DEVELOP 2026-06-23 (mobil).** Punkt 1–2 levert: `arbeidsdag.byggeplassId` kopieres inn i auto-utkast (`dagsseddelOpprett.ts`/`StartSluttDagKort.tsx`), `ByggeplassVelgerModal` (filtrert på `sedel.projectId`) + blå sedel-topp + soft mismatch-advisory på `[id].tsx`. Ingen schema/server (sedel-nivå-sync alt klar). Distribueres via NESTE TestFlight prod-bygg (ikke #30). Se [STATUS-AKTUELT.md](STATUS-AKTUELT.md).
  - **🟡 Per-rad / «splitt dagen mellom byggeplasser» (punkt 3): Beslutning 6-oppfølger (ikke startet).** Krever server `syncBatch` rad-input + mobil rad-tabeller (`sheetTimerLocal`/`sheetMachineLocal.byggeplassId`) — `@@unique(userId, dato)` gjør sedel-nivå = én byggeplass/dag, så splitt-dagen krever per-rad-modell.

- **🟢 Mobil global byggeplass-UX — LANDET PÅ DEVELOP 2026-06-24 (F1–F6 ✅).** Alle faser bygget + dual-review per fase. **Gjenstår: EAS-bygg for enhetstest** av hele kjeden (mobil-runde, ingen auto-deploy). Etter verifisert enhetstest → klar for prod-distribusjon via TestFlight.

  **Bakgrunn (gjennomgang 2026-06-23):** web har global toppbar-byggeplass-velger (`useToppbarFiltre` + `ByggeplassVelger.tsx`), mens mobil hadde byggeplass fragmentert i **tre** flater: (A) `ByggeplassKontekst` (`bygningMap[prosjektId]`, paneler/tegninger/3D/hjem), (B) timer-sedel `dagsseddelLocal.byggeplassId` (frakoblet), (C) `OpprettDokumentModal` egen lokal state + `sitedoc_sist_bygning_{prosjektId}` (ignorerer A). GPS (`identifiserByggeplass`) matet kun timer.

  **Verifisert tilstand:** global prosjekt-kontekst finnes alt (`ProsjektKontekst`, speiler web → F5 oppfylt). Byggeplass-kontekst finnes (`ByggeplassKontekst.tsx`, per-prosjekt) — skal konsolideres til eneste kilde.

  **Vedtatt målmodell:** `ByggeplassKontekst` = **eneste globale kilde** for aktiv byggeplass (per aktivt prosjekt). Alle flater leser/skriver den. Header-chip på tvers av skjermer (hjem/timer/sjekklister/tegninger). GPS auto-set + synlig override. Timer-utkast **defaulter** fra global byggeplass (per-sedel-override beholdt). Per-byggeplass siste-tegning-minne. Favoritter.

  **Faser (dual-review hver):**
  - **✅ F1 (høyest risiko) — GJORT 2026-06-24 (develop).** Konsoliderte `ByggeplassKontekst` → eneste kilde: la til `sistTegningPerByggeplass: {byggeplassId → tegningId}` (`hentSistTegning`/`settSistTegning`); foldet `OpprettDokumentModal` (C) til Option B (leser default byggeplass fra `valgtBygningId` + tegning fra `hentSistTegning`, skriver `settSistTegning` ved opprett, droppet egne `sitedoc_sist_*`-nøkler, **kaller ikke** `settBygning` — ingen stille nav-bytte). GPS-tegnings-bounds-logikk bevart. Tre flater verifisert urørt (A additiv, B timer urørt, C logikk intakt).
  - **✅ F2 — GJORT 2026-06-24 (develop).** Delt `ByggeplassChip` (byggeplass-only, gjenbruk `ByggeplassVelgerModal` bottom-sheet, `settBygning` ved valg) på **hjem** (erstattet redundant header-subtittel) + **sjekkliste/index**. To designvalg: (1) **timer får IKKE global chip** — timer er firma-scopet/kryss-prosjekt mens chip er per aktivt prosjekt; «Gjelder timer» realiseres via **F4** (sedel defaulter fra global byggeplass når `sedel.projectId === valgtProsjektId`, D2) + eksisterende per-sedel-chip på `timer/[id].tsx` (B6). (2) **tegninger (lokasjoner)** har alt byggeplass-bytte i header (ActionSheet/Alert) — chip droppet der; **harmonisering** av native picker → delt bottom-sheet-velger = liten oppfølger (ikke gjort).
  - **✅ F3 — GJORT 2026-06-24 (develop).** GPS-deteksjon i `ByggeplassKontekst` (`gpsByggeplassId`, `getForegroundPermissionsAsync` — prompter ikke fra provider). D1: auto-set kun når tom + GPS-treff i prosjektet (race-fri funksjonell map-oppdatering, rører aldri eksisterende valg). Chip-status «GPS · du er på plass»/«GPS foreslår: [navn]»; velger-badge «GPS foreslår — du er her». Kryss-prosjekt-GPS filtreres bort. **Begrensning:** GPS detekteres én gang per prosjekt-/firma-aktivering (ikke ved fokus/kontinuerlig) — kontinuerlig OS-geofence parkert til Fase 4.
  - **✅ F4 — GJORT 2026-06-24 (develop).** Timer auto-utkast-default: `dag.byggeplassId` (GPS) → global kontekst → ingen (`StartSluttDagKort.genererForslag`). D2 håndhevet: kontekst-fallback kun når utkastets prosjekt = aktivt prosjekt. Per-sedel-velger (B6) overstyrer fritt; F4 rører kun ny-draft-default (idempotent).
  - **✅ F6 (lokal) — GJORT 2026-06-24 (develop).** Favoritt-byggeplasser: `favorittIder` + `toggleFavoritt` i `ByggeplassKontekst` (persistert `sitedoc_byggeplass_favoritter`, enhets-lokalt, ingen server). Stjerne-toggle (egen trykk-flate) + sortering favoritter→GPS-forslag→resten + «Favoritt»-subtittel i `ByggeplassVelgerModal` (delt av chip + timer). Cross-device-favoritter = senere server-oppfølger.

  **Beslutninger:**
  - **D1** — GPS auto-setter global byggeplass **kun når ingen er valgt** for prosjektet; ellers soft-forslag (aldri stille bytte midt i økt).
  - **D2** — timer defaulter fra global byggeplass **kun når `sedel.projectId === valgtProsjektId`** (to-produkt-grensen: timer org-scopet, paneler prosjekt-scopet — samme `byggeplassLocal`-entitet).
  - **D3** — utsett navnerydding «bygning»→«byggeplass» i kontekst-internals (`valgtBygningId`/`settBygning`/`bygningMap`) — intern identifikator, egen churn-runde.

  **Schema/server:** ingen (alt finnes: `byggeplassLocal`, `dagsseddelLocal.byggeplassId`). i18n: chip-label, GPS-status, «Favoritt», «Husker siste tegning», «Manuelt bytte» (nb+en+generate).

  **Kryss-ref:** [byggeplass-strategi.md](byggeplass-strategi.md) (byggeplass på tvers av moduler) + Byggeplass/underprosjekt-timeregistrering-saken over (Beslutning 6 / per-rad-oppfølger).

- **🟡 TestFlight for test-varianten (A.Markussen-distribusjon).** Test-bygget bruker bundle `com.kemyrhau.sitedoc.test` med `distribution: internal` (ad-hoc) → kun enheter med registrert UDID kan installere (i dag kun Kenneths). TestFlight (mange testere uten UDID-registrering) er **kun** satt opp for prod-profilen (bundle `com.kemyrhau.sitedoc`, ASC-app 6760205962). For å gi A.Markussen testtilgang uten UDID-registrering kreves enten (a) egen ASC-app for `.test`-bundlen + `submit.test`-profil i `eas.json`, eller (b) bruk prod-profil-bygg + `eas submit` til TestFlight. Avklares før bredere pilotering. Se [eas-build-veileder.md § App variants](eas-build-veileder.md).

- **U1-utsettelse: faggruppe i gruppe-header** 🟡 (2026-06-22) — v2 gruppe-header skal vise byggeplass + **faggruppe** + ECO-badge ([mobil-dagsseddel-ui-spec.md § 2/§3](mobil-dagsseddel-ui-spec.md)). **Faggruppe finnes ikke i lokal cache** — `prosjektLocal` (`apps/mobile/src/db/schema.ts`) har kun `id/orgId/name/projectNumber/lat/lng/aktiv`. U1 leverer byggeplass + ECO-badge (begge lokalt tilgjengelig); faggruppe utsatt fordi den krever å utvide prosjekt-sync (`prosjektKatalog.refreshProsjektKatalog` + server `prosjekt.list`-payload + ny kolonne i `prosjektLocal`) — en flyt/schema-endring utenfor U1s «ren UI»-mandat. **Oppfølger:** legg `faggruppe` (arbeiderens faggruppe på prosjektet) i prosjekt-sync, så fyll inn i gruppe-header. Avklar kilde: `ProjectMember`/dokumentflyt-faggruppe per (bruker, prosjekt).

- **✅ VERIFISERT IKKE FUNKSJONELL BUG: auto-draft settes lokalt med `organizationId: ""`** (sidefunn under U-flyt-spec-verifisering 2026-06-22, verifisert 2026-06-22) — `opprettDagsseddelForSegment` (`apps/mobile/src/components/StartSluttDagKort.tsx:614`) inserterer den auto-genererte dagsseddelen i lokal Drizzle med `organizationId: ""` (tom streng). **Verifisert ufarlig:** 8/8 synkede server-rader har korrekt `organization_id` — server backfiller riktig org ved sync. Den lokale tomme strengen er **kun kosmetisk** og rettes ved sync. Ingen firma-isolasjons-lekkasje (server er sannhetskilde for org-tilhørighet). Kosmetisk opprydning (sette korrekt org lokalt ved insert) kan tas ved leilighet, men er ikke en bug.

### ✅ U-flyt UF-0 PÅ DEVELOP (2026-06-22): duplikat-dagsseddel fikset + helper-konsolidering

- **✅ Duplikat-dagsseddel fra `+ Ny`-skjermen — FIKSET i UF-0.** `lagre()` i `ny.tsx` inserterte tidligere alltid en ny `dagsseddelLocal` med fersk UUID uten `(userId, dato)`-sjekk → server `@@unique([userId, dato])`-kollisjon → sync-stuck (`syncStatus: pending` som aldri lykkes) + tom attestering. **Løst** ved delt `finnEllerOpprettDagsseddel`-helper (`apps/mobile/src/services/dagsseddelOpprett.ts`): `ny.tsx` ruter nå gjennom find-or-open og `router.replace` til eksisterende sedel når dagen finnes (subtil notis + bevart prosjekt-valg via `nyttProsjekt`-param).
- **✅ To-inngangspunkt-konsolidering — GJORT i UF-0.** Begge veier til ny dagsseddel (manuell `+ Ny` og auto-draft via `opprettDagsseddelForSegment`) ruter nå gjennom samme helper: idempotens per `(userId, dato)` + org-backfill (`organizationId = orgId`, ikke `""`) + arbeidstid-prefill ett sted. `opprettDagsseddelForSegment` refaktorert atferdsbevarende (returnerer fremdeles eksisterende uten append — append er UF-1).

- **✅ Tastatur-avoidance — FIKSET 2026-06-22.** Skjemaet skjøv ikke fokusert felt + Lagre-knapp over tastaturet. Løst ved app-standard `KeyboardAvoidingView` + `ScrollView keyboardShouldPersistTaps="handled"` (mønster fra `sjekkliste/[id].tsx`, ingen ny avhengighet) i alle fem skjemaer: TimerRadModal, MaskinRadModal, TilleggRadModal, `ny.tsx`, RedigerArbeidstidModal. + `keyboardShouldPersistTaps` på velger-modalenes FlatList (fjerner dobbelt-trykk-papercut).
- **✅ Lønnsart-på-Ny-skjerm (UX) — AVKLART 2026-06-22.** Forventet oppførsel: lønnsart er et **per-rad**-attributt (én sedel har typisk flere lønnsarter: timelønn + overtid + reise), og `ny.tsx` lager etter UF-0 kun et tomt sedel-skall uten rader. Valgt løsning (Del 2-A): kort grå hint på Ny-skjermen — `timer.lonnsartHint` («Lønnsart velges per timer-rad inne på sedelen») — i stedet for å legge en misvisende «én lønnsart for hele dagen»-velger på opprettelses-steget.
- **🟡 Topp-sum farge-paritet-gap web vs mobil.** Web topp-sum bruker flat `OrganizationSetting.dagsnorm`, mobil bruker sesongjustert `effektiv.dagsnorm` (kalender-cache m/ sommertid-overstyring) → for firmaer med sesong-dagsnorm kan grønn/gul/blå-grensa avvike mellom web og mobil. Krever et server-endepunkt som eksponerer sesongjustert dagsnorm (per org, dato) til web for full paritet.
- **🟡 Sync-gift-isolasjon (fiks A) — oppfølger: 403/FORBIDDEN klassifiseres transient.** `erPermanentFeil` (`timerSync.ts`) regner kun `400` som permanent; `403` (f.eks. hvis Timer-modulen deaktiveres for org-en mid-bruk → `krevTimerAktivert` kaster FORBIDDEN før per-item-loopen) klassifiseres transient → push retry-er hele batchen hver tick uten å komme videre (tick-retry-stall, men ingen datatap). Vurder eget «permanent-uten-quarantine»-spor (stopp tick + synliggjør «sync blokkert: <årsak>» uten å quarantine sedlene).
- **✅ UF-4 (recall) — IMPLEMENTERT 2026-06-22 (server + mobil).** Ny tRPC-mutasjon `timer.dagsseddel.gjenaapneDagsseddel`: eier-only (`hentEgenDagsseddel`), KUN `status="sent"` (`accepted` → tydelig feil «kontakt leder»), `sent→draft` + nullstiller ALLE rad-attestasjoner til `pending` (speiler re-send-etter-retur-mønster; permanent audit i Activity-tabell). Leder-kø (`hentTilAttestering`/`hentTilAttesteringFirma`, filtrerer `status="sent"`) tømmer seg automatisk; race håndtert (leder rekker accept → guard blokkerer recall). Mobil: online-only «Gjenåpne for redigering»-knapp på sent-blokk i `[id].tsx`. **Ingen migrering** (eksisterende enum-verdier). **Krever server-deploy til test for ende-til-ende-verifisering.**

### Legacy eide prosjekter mangler `ProjectOrganization`-rad (datakvalitet) 🟡

Funnet under Timer Fase 1b-data-sjekk (2026-06-09). `admin.ts:266` + `prosjekt.ts:220-226` oppretter nå en `ProjectOrganization`-rad for eier-org ved prosjekt-opprettelse, men dette var en **senere bugfix** — prosjekter opprettet før den mangler raden, selv om de har `Project.primaryOrganizationId` satt. Verifisert mot test-DB: minst ett slikt prosjekt («Test redigert mal») med timer-rader. Prod kan ha tilsvarende (ikke sjekket).

**Konsekvens:** kode som avgjør firma-tilhørighet **kun** via `ProjectOrganization` (uten å falle tilbake på `primaryOrganizationId`) vil feilaktig behandle disse som ikke-firma-prosjekter. Fase 1b-helperen `verifiserProsjekterTilhørerFirma` dekker dette via union (eid ELLER koblet), men andre stier kan ikke ha samme beskyttelse.

**Foreslått fiks:** backfill-migrasjon som setter inn manglende `ProjectOrganization`-rader for alle `Project` med `primaryOrganizationId IS NOT NULL` som ikke allerede har en kobling for den orgen (idempotent `INSERT ... WHERE NOT EXISTS`). Da kan union-fallbacken på sikt forenkles til ren ProjectOrganization-sjekk. **Krever migrasjon → prod = LÅS + Kenneth.** Lav hast (1b-unionen holder timer trygg i mellomtiden).

### Split-identitet MS-login (web↔mobil) — ✅ DEPLOYET TIL PROD 2026-07-04 (`bb5aec05`)

**Fix A (case-insensitiv `getUserByEmail`) + gate-innstramming (web+mobil) + sak #3 (KMY-duplikat B→A) er deployet og utført.** Full rot-årsak + implementasjon + datafiks arkivert til [historikk-2026-07.md § Prod-deploy 2026-07-04](historikk-2026-07.md). Kort: to `users`-rader for én MS-konto (mobil Graph-`/me.id` vs web id-token-`sub` → ulik `provider_account_id`; + case-sensitiv `getUserByEmail`). Konsolidering utført 2026-07-04 (begge MS-kontoer flyttet til A `f2d473b9`, e-post → `kenneth@sitedoc.no`, B `3a3c6272` arkivert `can_login=false`). Diagnostikk-SQL: `scripts/diag-kmy-web-bug.sql`.

**Gjenstår (åpne oppfølgere):**

**🟡 Sak #4 — normalisér e-post ved skriving (belt-and-suspenders):** Alle skrivestier bør lagre e-post lowercase (mobil `mobilAuth.ts:60` skriver rå Graph-case i dag; web PrismaAdapter likeså). Så lesestier ikke er avhengige av `mode: "insensitive"`. Krever backfill av eksisterende blandet-case-rader (migrering av `users.email`). Slår sammen med den eldre «User.email-normalisering»-oppfølgeren under.

**✅ Sak #5 — firma-ansatte ser eget firma — DEPLOYET TIL PROD 2026-07-04 (`6dbc884a` + PR 4 `179b86f9`, i `0801af38`):** Dobbel-kilde firma-kontekst (`hentMineMedlemskap` beriket + `kanAdministrereFirma`-gating på firma-admin-flater) + maskin opprett/import-gating. Full detalj: [historikk-2026-07.md § Prod-deploy 2026-07-04 (kveld) PR 3-4](historikk-2026-07.md).

**✅ Maskin-velger i dagsseddel-modal — søk + kategori-filter + sortering — IMPLEMENTERT PÅ DEVELOP 2026-07-05 (web klar for prod, mobil venter EAS-batch):** Delt web-komponent `MaskinVelger` (`apps/web/src/components/timer/MaskinVelger.tsx`, `SearchInput` + kategori-chips + sortering brukt-på-seddelen→internNummer→navn) på alle fire callsites + mobil `EquipmentVelgerModal` utvidet med chip-rad + sortering. Full detalj: [STATUS-AKTUELT § Maskin-dagsseddel Del 1+2](STATUS-AKTUELT.md) + [timer.md § Maskin-velger](timer.md).

**✅ Maskin ≤ arbeidstimer-avhengighet — gjort proaktiv (b+disable) — IMPLEMENTERT PÅ DEVELOP 2026-07-05 (web klar for prod, mobil venter EAS-batch):** Inline kapasitet-linje + Lagre-disable i maskin-modalen (web + mobil), drevet av delt regel `packages/shared/src/utils/maskinKapasitet.ts` som serveren `validerMaskinUnderArbeid` nå også delegerer til (null divergens). Full detalj: [timer.md § Maskin ≤ arbeidstimer](timer.md). (Åpent skille `utleie_enhet` time vs døgn — se § lenger ned — er urørt av denne; regelen bruker fortsatt sedel-pause-buffer for alle maskiner.)

**🟡 Gradert tidligere-ansatt-tilgang (framtidig, døra holdes åpen):** Gate-innstrammingen over betyr at en bruker fjernet fra *alle* firma/prosjekt fortsatt beholder **pålogging** via koblet konto (unntak (c)), men mister alt **innhold** (ingen medlemskap → tomme lister). Det er akseptabelt nå. Framtidig Timer-modul-funksjon: gi en org-løs *tidligere ansatt* **scoped** tilgang til egne timer (lønns-/dokumentasjonsbehov etter sluttdato), uten firma/prosjekt-innsyn. Henger på org-isolasjon + Proadm-lønnsflyt — ikke levert av denne PR. Merk: «avvis fjernet-fra-alt» gjelder fortsatt **aldri-innloggede** orphans (ingen koblet konto).

### Brukere-lista viser ikke arvet firma_admin (kosmetisk UX) 🟢

Observert 2026-07-04 (KMY/Florian-diagnose). ROLLE-kolonnen i `dashbord/oppsett/brukere/page.tsx` viser kun **ProjectMember-rollen/-flagget** (`admin`/`member`/`firmaansvarlig` via `erFirmaansvarlig`), ikke den **arvede** org-admin-statusen. En `company_admin` med `firmaRoller=["firma_admin"]` har full admin på firmaets prosjekter (via `verifiserAdminEllerFirmaansvarlig` → `erFirmaAdmin` når prosjektet har `ProjectOrganization`-kobling), men *leser* i lista som «Firmaansvarlig»/«Medlem». Konkret eksempel: Florian (`company_admin` + `firma_admin` på A.Markussen) er funksjonelt admin på 999, men vises som «Firmaansvarlig». **Ikke et tilgangsavvik** — tilgangen er korrekt; kun UI som ikke synliggjør arv. Mulig fiks: badge «Admin (via firma)» når `erFirmaAdmin` er sann for et prosjekt-koblet firma (server-beregnet boolean per medlem i `medlem.hentForProsjekt` — `user.role="company_admin"` med org == `primaryOrganizationId`, eller `firmaRoller` har `firma_admin` for prosjektets org).

**Utsatt (kosmetisk, 2026-07-05):** badgen er lav-verdi og kan **subsumeres av → «Dynamisk rettighets-matrise»** under. Bygges matrisen, blir denne badgen unødvendig (rettighetene vises da eksplisitt der de tildeles). Ikke bygg badgen isolert før matrise-idéen er vurdert.

### 🟢 IDÉ: Dynamisk rettighets-matrise (erstatter ad-hoc rolle-/kapabilitets-miks)

Kenneths idé 2026-07-04. I dag er tilgang spredt over en **ad-hoc miks**: `User.role` (`sitedoc_admin`/`company_admin`/`user`) + `ProjectMember.role` (`admin`/`member`) + kapabilitets-booleans (`kanAttestere`, `erFirmaansvarlig`) + `OrganizationMember.firmaRoller` (`firma_admin`). Arv er implisitt (company_admin → admin på org-prosjekter uten rad), og synliggjøres ikke i UI (jf. admin-badge-posten over). **Konkret villedende signal (verifisert 2026-07-04):** `User.role="company_admin"` (settes via `admin.ts:194`) og `OrganizationMember.firmaRoller=["firma_admin"]` (settes via `organisasjon.ts:450`) er **uavhengige** signaler — firma-admin-tilgang krever `firma_admin`-medlemskap (eller `sitedoc_admin`), ikke `company_admin`-rollen alene (`autoriserAdminForFirma` har ingen role-fallback: `sitedoc_admin || erFirmaAdmin`). Navnet «company_admin» villeder derfor. Idé: en **konfigurerbar rettighets-matrise** der tildeling av rettigheter er eksplisitt og data-drevet (rolle × ressurs × handling), som erstatning for den hardkodede miksen. Fordeler: eksplisitt/synlig tildeling, ett sted å resonnere om tilgang, badge-behovet forsvinner. **Kan utsettes/utelates** — fanget for vurdering, ikke besluttet. Stort arkitektur-tiltak; berører `tilgangskontroll.ts`, alle `verifiser*`-helpere, admin-UI. Knyttet til admin-badge-posten (badgen blir unødvendig hvis matrisen bygges).

### Test-miljø mangler web-MS-redirect i Entra 🟡

Observert 2026-07-04: innlogging med Microsoft på `test.sitedoc.no` feiler med **AADSTS50011** — redirect-URI `https://test.sitedoc.no/api/auth/callback/microsoft-entra-id` er ikke registrert i Entra-app-en (`d7735b7a-c7fb-407c-9bf6-80048f6f3ac5`). Test har aldri fått Microsoft-OAuth wiret i Azure (kun prod-callbacken finnes). **Fiks = Kenneths Azure-hånd:** legg til test-redirect-URI-en i app-registreringen (additivt, rører **ikke** prod-callbacken). Egen infra-oppgave på linje med mobil-MS-Azure-sjekklista. **I mellomtiden:** auth-gaten (sak #2) kan verifiseres på test via **Google** (`AUTH_GOOGLE_ID` er satt på test) — logg inn med Google-konto uten firma/prosjekt → skal avvises (`AccessDenied`); med medlemskap → slipper inn. Merk også: `dev-login` er **av** på test (`NODE_ENV=production`, ingen `ENABLE_DEV_LOGIN`). **Også observert fra iOS-simulator 2026-07-06** (MS-login-flyten) — samme rotårsak (manglende test-redirect i Entra `d7735b7a`); uavhengig av dev-login-transporten (dev-login bruker localhost-port-forward, se [dev-login-agent.md](dev-login-agent.md)).

### H3 — `allowDangerousEmailAccountLinking` reversert + signIn-guard — ✅ DEPLOYET TIL PROD 2026-06-05

✅ Arkivert til [historikk-2026-06.md § OAuth-innlogging: account-linking + orphan-guard + duplikat-opprydding](historikk-2026-06.md).

**Kort:** `allowDangerousEmailAccountLinking` reversert fra `false` (H3-audit 2026-05-27, prod-merge `9ca0257e`) til `true` (prod-merge `e12355d9`) — lar Google/Microsoft logge inn på samme konto via e-post; trygt fordi begge IdP-er verifiserer e-post-eierskap. Samtidig lagt til en **blokkerende `signIn`-guard** (`f6522a94`) som hindrer uinviterte pålogginger i å opprette tomme orphan-kontoer (a/b/c/d-regler, verifisert på test at `return false` hindrer User-opprettelse).

**Merknad — `User.email` er globalt unik** (`@unique`, ikke composite). `getUserByEmail`-overstyringen bruker `findFirst` med `canLogin=true` + eldste-først for determinisme.

**Mobil-guard** (`91fa7867`, prod-merge `f3a16cef`, 2026-06-05): tilsvarende orphan-guard lagt til i `mobilAuth.byttToken` med samme a/b/c/d-regler → `TRPCError FORBIDDEN` ved ingen match. **Både web- og mobil-OAuth er nå dekket.** (Account-linking på mobil håndteres allerede i `byttToken` via account-koblingen — ikke samme PrismaAdapter-mekanisme som web.)

### Sikkerhets-audit 2026-05-27 — alle høy-prio funn lukket ✅

Alle 14 funn fra sikkerhets-audit 2026-05-27 er adressert i prod. Se [historikk-2026-05.md](historikk-2026-05.md) for full arkiv.

| Funn | Prod-merge | Arkiv |
|---|---|---|
| K1 + M2 + M3 + M4 + H3 + error-håndtering | `9ca0257e` | [§ Sikkerhets-audit-bunke](historikk-2026-05.md) |
| M1 (global tRPC-rate-limit) | `54885eb2` | [§ M1](historikk-2026-05.md) |
| H2 (case-sensitive invitasjon-match) + Fastify-logger | `b97494cd` | [§ Fastify-logger + H2](historikk-2026-05.md) |
| H1 (mobil token-rotasjon) | `29bdded8` + fix `43460d80` | [§ H1](historikk-2026-05.md) |

**Sekundære oppfølgere (ikke kode-fix):**
- Sjekk eksisterende serverlogger for token-lekkasje før M4-redaction ble aktivert. Manuell loggevurdering.
- Permanent `deploy-test-cron.sh` → `pnpm build --force`-fiks. Server-side skript, ikke i repo. Rammet 3+ ganger i mai 2026, krever manuell `pnpm build --force` per deploy. Bør prioriteres for å redusere friksjon.
- **User.email-normalisering** (oppstått fra H2 2026-05-27) — PrismaAdapter + Auth.js OAuth-flyt skriver `User.email` med casing fra provider. To brukere med samme lowercase-e-post men ulik case kan eksistere som separate rader pga `@unique` er case-sensitive. **Materialisert 2026-07-04** (split-identitet KMY, se § Split-identitet MS-login over) — Fix A (case-insensitiv `getUserByEmail`) demper leseren, men skrive-normalisering + backfill gjenstår (sak #4 samme sted). Bredere refaktor som krever migrering av `User.email` + adapter-override + verifisering av Google/Microsoft OAuth-flyt.

### Refaktor: web-tRPC-route — DEPLOYET TIL PROD 2026-05-27 (prod-merge `77e6553d`)

✅ Implementert via `lagContextStamme`-helper (Alternativ 1). Arkivert til [historikk-2026-05.md § lagContextStamme + B5](historikk-2026-05.md).

**Tilleggsforslag fortsatt åpent:** Server-side `deploy-test-cron.sh` skal feile hard på `pnpm build` exit ≠ 0 og IKKE kjøre `pm2 restart`. CLAUDE.md har regelen (commit `95ff4a07`), men cron-skriptet er server-side og ikke i repo. Krever manuell oppdatering av skriptet på `sitedoc`-serveren.

### Mobil hentMineMedlemskap — tom for sitedoc_admin + standalone-brukere — ✅ FIKSET + verifisert (build #29, 2026-06-02)

**Oppdaget 2026-06-01**, fikset + verifisert i TestFlight build #29 2026-06-02. Rotårsak: klienten gatet prosjekt-lasting på valgt firma (`enabled: !!valgtFirmaId`) → 0-firma-/uvalgt-firma-bruker hang på evig «Henter prosjekter…». Fiks: server-fallback (prod-merge `21555a5c`) + klient-fiks (`9e1bbf02`). Arkivert til [historikk-2026-06.md § Mobil hentMineMedlemskap-bug](historikk-2026-06.md).

**To-sporet problem:**
1. **Design-svakhet (bekreftet):** `organisasjon.hentMineMedlemskap` returnerer `[]` for brukere uten OrganizationMember-rad. Rammer brukere invitert via ProjectMember-bare og brukere på standalone-prosjekt. Mobil-flyten gater alle prosjekt-spørringer på `valgtFirmaId` → tom hjem.
2. **Sitedoc_admin runtime-mismatch (ikke avdekket):** Kenneth er sitedoc_admin, server skal returnere 3 firmaer, men klienten ser 0. Token er ferskt, endepunkt deployet, mobil-koden i build #27 = dagens develop. Krever enhets-logger fra build #28.

**Plan:**
1. Server-fiks: utvid `hentMineMedlemskap` til å inkludere `Organization` via `ProjectMember → Project.primaryOrganizationId` når `OrganizationMember.count === 0`. Konkret kode-skisse i STATUS-AKTUELT.
2. Diagnose-logging i `FirmaKontekst.tsx:71-78` (`console.log(firmaerQuery.data/error/isLoading)`) for build #28.
3. Begge endringer i samme PR til develop → server-fiks deployes til prod separat → mobil-bygg #28 til TestFlight.
4. Etter rotårsak avdekket fra enhets-logger: konkret runtime-fiks i oppfølger-PR.

**Bi-funn:** «Ukjent bruker»-meldingen ved utlogging (`mer.tsx:248`, `bruker?.name ?? "Ukjent bruker"`) er forventet kortvarig fallback når `setBruker(null)` rendres før navigation. Ikke en bug.

### Avklaring-modul — TE/Endring/Varsel statusflyt (høy prioritet)

> **Terminologi-rename 2026-05-28 (A.31):** Modul-konseptet tidligere kalt «Godkjenning» er omdøpt til **Avklaring** for å unngå kollisjon med status-verdien `"godkjent"` i `DocumentTransfer.toStatus`. Schema-rename (`model Godkjenning` → `model Avklaring`, `godkjenninger` → `avklaringer`) gjennomføres når modulen bygges. Se [fase-0-beslutninger.md § A.31](fase-0-beslutninger.md).

**Oppdaget 2026-05-26** ved sporing av Avklaring-modulens (tidligere «Godkjenning-modulens») faktiske implementasjon, og presisert med produktbeskrivelse fra Kenneth samme dag.

**Produktbeskrivelse (Kenneth 2026-05-26):** Avklaring dekker formell kommunikasjon mellom kontraktsparter i to relasjoner:

1. **Entreprenør → Byggherre:** Teknisk avklaring (TE) eller Økonomisk krav
2. **UE → HE (Hovedentreprenør):** Teknisk avklaring eller Økonomisk krav

Brukeren konfigurerer selv dokumentflyter per relasjon. Systemet dikterer ikke partsstrukturen.

Et dokument starter som **Teknisk avklaring** og kan eskalere til **Økonomisk krav** (Endring/Varsel) — men må bevare historikken fra original-dokumentet gjennom hele livsløpet.

**Manglende:**
- Statusprogresjonen TE → Endring/Varsel er ikke implementert.
- `Godkjenning`-tabellen i schema (`schema.prisma:984-1027`) har riktige felter (`externalCostObjectId`, `internRef`, `byggherreRef`, `kortNavn`, `godkjentVed`, `transfers` med kostnadsnapshot) men **ingen route bruker den**. NB: Tabellnavn omdøpes til `avklaringer` per A.31 når routen bygges.
- Avklaring-modulen lager i dag kun en vanlig `Task` fra GM-malen via `oppgave.opprett`. Den ekstra tabellen forblir tom og urørt.
- Verifisert i prod-DB 2026-05-26: «Godkjenning»-malen (GM, bygg) har 0 rader i `DokumentflytMal` — ingen mottaker-utledning fungerer. (Mal-navnet i prod-DB kan omdøpes til «Avklaring» som del av modul-leveransen.)

**Krever (i prioritert rekkefølge):**
1. **`avklaring.opprett`-route** + statusovergangs-logikk (TE → Endring/Varsel) med bevart referanse til original-dokument. Bygger på eksisterende `Godkjenning`-tabell (omdøpes til `Avklaring`) og `DocumentTransfer.kostnadsnapshot`-mønster.
2. **Samme modul-seeding-redesign som HMS:** utvid modul-aktivering til å seed maler + plassholder-flyter for de to standard-relasjonene (TE-til-byggherre, TE-til-HE) som brukeren kan justere.
3. **UI-skille:** Brukeren må kunne se Avklaring som egen dokumenttype (ikke vanlig oppgave) i opprett-modaler og listevisninger.

**Avhengighet:** Krever Kenneths produktbeslutning om eskalering-mekanikken (knapp i dokumentet? statusovergang via dokumentflyt? egen «Eskaler til Økonomisk krav»-handling?). Spec-runde anbefales før koding.

**Oppfølger:** Avklaring-hake i mal-builder (samme mønster som HMS-haken, `0278cfb3`) aktiveres når Avklaring-modulen er designet.

### HMS-modul redesign — DEPLOYET TIL PROD 2026-05-26/27 (prod-merge `69068ba0` + fix `c1fbc19f` + åpen-synlighet `c0c00374`)

✅ **Implementert.** HMS-modul-seeding (`dd491081`) + HMS-prosjektvisning (`69068ba0`) + subdomain-fix (`c1fbc19f`) + åpen-synlighet (`c0c00374`) dekker hele specen + synlighet-oppfølgeren. Detaljer i [historikk-2026-05.md § HMS-prosjektvisning](historikk-2026-05.md) + [§ HMS åpen-synlighet](historikk-2026-05.md).

**Status per del:**
- Modul-seeding: HMS-gruppe + HMS-flyt + mal-koblinger ✅
- SJA + RUH-maler i `PROSJEKT_MODULER` med subdomain/synlighet ✅
- HMS-spesialrute i `sjekkliste.opprett` (speil av `oppgave.opprett`) ✅
- Synlighet per mal (`hmsSynlighet: "privat" | "apen"`) + tilgangskontroll i `hms.hentDokumenter` (privat) og `verifiserDokumentTilgang` (åpen) ✅
- Mal-builder UI for subdomain + synlighet ✅
- HMS-prosjektvisning med KPI + 4 tabs + statistikk ✅
- Sidebar-element gated på `hms-avvik` ✅
- Fix-migrasjon for prefix-baserte subdomains (SJA/RUH som var feilklassifisert som avvik etter PR 1) ✅
- Prod-backfill kjørt for alle 3 HMS-aktive prosjekter ✅

**Gjenstående oppgaver (lav prioritet, eventuelle oppfølgere):**
- Web DokumentHandlingsmeny redesign for HMS-dokumenter — venter på mobil-bunke-verifikasjon (build #23). § 2 «Halvferdige features».
- Backfill-script kjørt på test, **IKKE på prod** — Kenneth tar beslutning. Prosjekter uten manuelt opprettede SJA/RUH-maler får dem KUN ved neste `modul.aktiver`-call eller manuell trigger.
- Statistikk-fane utvidelser (CSV/PDF-eksport, per-måned drill-down) — separat oppfølger ved kundeønske.
- Same-modul-seeding for Avklaring-modul (§ Avklaring-modul nedenfor) — generalisering vurderes ved den implementasjon.

### MASKIN-TIMER KOBLING — arkitektursvikt (høy prioritet)

Kenneth-avklaring 2026-05-16: Maskintimer er en del av arbeidsdagen,
ikke additivt. `sum(SheetMachine.timer) ≤ sum(SheetTimer.timer)` per sedel.

Nåværende feil: maskin og timer faktureres som to separate summer.
Korrekt: maskin er utstyrsbidrag av samme tidsperiode.

Krever:
1. Server-validering: `maskin.timer ≤ total worker.timer` ved opprett/oppdater
2. UI: vis maskin som underpost av timer-seksjonen, ikke separat
3. Attestering: `splittRad` på maskin bør validere mot timer-totalsum
4. Mobil: samme logikk

Tas i planleggingssesjon — ingen videre koding i mellomtiden.

Se [fase-0-beslutninger.md T.7](fase-0-beslutninger.md) for full spec (låst 2026-05-16) — flytskille arbeidstaker/attestering/Byggherre-godkjenning + dagsseddel-struktur per prosjekt+ECO.

### Innsender-tilgang — DEPLOYET TIL PROD 2026-05-27 (prod-merge `b3194f1d`, develop-commit `b4e53e17`)

✅ **Implementert.** `verifiserDokumentTilgang` utvidet med innsender/mottaker-gren rett etter firmaansvarlig (linje 451-460). `findUnique` for `bestillerUserId`/`recipientUserId` løftet til lokal helper, gjenbrukes av firmaansvarlig + innsender. Alle 17 kallsteder uendret. Slett-sikring håndheves fortsatt av `slett`-mutasjonens egen status-sjekk (`status !== "draft" && status !== "cancelled"`). Detaljer i [historikk-2026-05.md § Innsender-tilgang](historikk-2026-05.md).

### HMS-prosjektvisning teknisk gjeld (lav prioritet)

**Samlet fra HMS-PR-analyse 2026-05-27** etter prod-deploy. Seks kjente avvik som ikke blokkerer funksjon, men reduserer konsistens/skala:

1. **TS2589-workaround i `apps/web/src/app/dashbord/[prosjektId]/hms/page.tsx`** — imperativ `utils.client.X.mutate()` i stedet for `useMutation`-hook (kombinasjonen av `oppgave.opprett` + `sjekkliste.opprett` typegen pumpet for dyp etter `recipientGroupId`-utvidelse). Mister `isPending`/`error`-state og optimistic updates.
2. ~~**Plain HTML-tabell** brukt i HMS-side-tabellene i stedet for `@sitedoc/ui` Table.~~ ✅ DEPLOYET TIL PROD 2026-05-28 (prod-merge `12e19c0a`, arkivert til [historikk-2026-05.md](historikk-2026-05.md)). Tre HMS-tabeller (AvvikTabell, SjaTabell, RuhTabell) konvertert til delt `Table`-komponent. Gjelder både prosjekt-HMS og firma-HMS automatisk. Status-snarvei «Alle åpne» kun på AvvikTabell.
3. ~~**HMS-siden støtter byggeplass-filter innad i prosjektet.**~~ ✅ DEPLOYET TIL PROD 2026-05-29 (prod-merge `526db462`, impl `c3dc62c4`). `hms.hentDokumenter` utvidet med `byggeplassId: z.string().uuid().optional()`. Asymmetri Task vs Checklist (Task via `drawing.byggeplassId`, Checklist direkte). Prosjekt-brede dokumenter (`null`) inkluderes alltid. Klient sender `aktivByggeplass?.id` fra `useByggeplass()`. Cache-invalidering uendret.
4. **Statistikk-fanen aggregerer på klient.** `månederData`, `statusData`, `faggruppeData` regnes på klient fra `dokumenter.avvik`-arrayet. Hvis prosjekt har 1000+ HMS-avvik, blir søyler/bars trege. Server-aggregering kreves for skala.
5. **`useVerktoylinje`-pattern droppet** — HMS-siden bruker inline header med Ny-dropdown i stedet for global verktøylinje (oppgaver/sjekklister mønster). Funksjonelt OK, men inkonsistent.
6. **Modul-slug `hms-avvik` misvisende.** Slug-en var korrekt da modulen kun dekket HMS-avvik. Nå dekker den SJA + RUH også. Rename krever migrasjon + mobil-app-bakover-kompat-arbeid (mobil sender slug-en ved aktivering). Vurder ved neste modul-redesign.

**Vurderes som samlet oppfølger-PR** når kundefeedback indikerer behov, eller når Avklaring-modul-redesign trigger generalisering av modul-mønstre.

### Firma-nivå HMS-dashboard — aggregering på tvers av prosjekter ✅ FERDIG (alle 4 trinn deployet til prod 2026-05-29, prod-merger `526db462` + `eacdb40e`, arkivert til [historikk-2026-05.md](historikk-2026-05.md))

**Oppdaget 2026-05-29** ved gjennomgang av HMS-arkitekturen. HMS er i dag strikt prosjekt-isolert: én side på `/dashbord/[prosjektId]/hms/` per prosjekt, `verifiserProsjektmedlem`-gating på server, ingen firma-nivå-aggregering. Det finnes ingen ruter under `/dashbord/firma/` som matcher HMS, avvik, SJA eller RUH.

**Mål:** Firma-admin og HMS-ansvarlig skal se HMS-tilstand på tvers av alle firma-prosjektene fra ett sted — statistikk (åpne avvik per prosjekt, gjennomsnittlig saksbehandlingstid, SJA-frekvens, RUH-rate), prioritert handlingsliste (eldste åpne avvik, frister som nærmer seg) og felles behandling (kommentere/godkjenne uten å hoppe inn i hvert prosjekt).

**Skiller seg fra oppgaver/sjekklister:** HMS har juridisk + arbeidsmiljø-dimensjon som krever firma-overblikk (internkontroll-forskriften §5, NS 5814). Oppgaver og sjekklister er strengt prosjekt-brede per design — det er produksjon-/leveranse-styring uten tilsvarende kryss-prosjekt-mandat. HMS skiller seg.

**Filter-krav på firma-nivå:** Brukeren skal kunne filtrere HMS-hendelser på prosjekt og byggeplass. Default er «alle prosjekter, alle byggeplasser» — filter-velgere lar firma-admin/HMS-ansvarlig snevre inn til ett eller flere prosjekter, og videre til byggeplass(er) innenfor de valgte prosjektene. Filter-state gjenspeiles i URL slik at delbar lenke kan peke til «alle åpne HMS-avvik på Byggeplass A i Prosjekt X». Knyttes til samme byggeplass-felter som prosjekt-nivå-filter (asymmetri Task `drawing.byggeplassId` vs Checklist `byggeplassId`).

**Rolle-modell:** To separate HMS-roller:

1. **HMS-ansvarlig på firma-nivå** — ser alle prosjekters HMS-data, kan behandle fra firma-dashbordet. **Finnes ikke i kodebasen i dag.** Krever enten ny `OrganizationGroup`-type (gruppe-basert tilgang på firma-nivå, parallell til `ProjectGroup` på prosjekt-nivå) eller ny rolle på `OrganizationMember` (felt-basert, f.eks. `OrganizationMember.hmsAnsvarlig: boolean` eller utvidelse av eksisterende `role`-enum).
2. **HMS-ansvarlig på prosjekt-nivå** — `ProjectGroup` med `domains: ["hms"]`. Eksisterer allerede og er aktivt brukt i `byggHmsSynlighetsFilter` for å gi utvidet tilgang til private HMS-dokumenter.

De to rollene kan tilhøre ulike personer — firma-HMS-ansvarlig er typisk én sentral person eller HMS-koordinator, prosjekt-HMS-ansvarlig er prosjektspesifikk og kan rotere. Tilgangsmodellen må reflektere at firma-nivå-tilgang ikke automatisk gir prosjekt-nivå-tilgang og omvendt, men firma-HMS-ansvarlig får implisitt lese-tilgang til alle prosjekters HMS-data (eventuell sammenheng med `hmsSynlighet: "privat"` må avklares).

**Avhengighet for implementasjon:** Beslutning om OrganizationGroup vs OrganizationMember-rolle må tas FØR firma-HMS-dashbord bygges, ellers risikerer vi å skrive tilgangskontroll to ganger. **Vedtak 2026-05-29: OrganizationMember.firmaRoller += "hms_ansvarlig"** (utvidelse av eksisterende array, ingen schema-endring). Server-fundament implementert i Trinn 1 (`93970feb`) og Trinn 2 (utvidet `byggHmsSynlighetsFilter` + ny `hms.hentFirmaOversikt`). **Trinn 3** (klient-side: ny side `/dashbord/firma/hms/page.tsx` med filter, URL-state, 4 faner + statistikk-panel, samt refaktor av delte HMS-komponenter til `components/hms/`) implementert 2026-05-29. **Trinn 4** implementert på develop 2026-05-29: (Del A) `RedigerModal` + `InviterModal` i `firma/ansatte/page.tsx` har ny checkbox for `hms_ansvarlig`, grønn chip vises i tabellraden, `inviterBruker`-input utvidet med `erHmsAnsvarlig`; (Del B) ny `FirmaHurtigModal` + `hms.firmaBehandleAvvik`-prosedyre lar HMS-ansvarlig endre status + legge til intern kommentar på avvik direkte fra firma-dashbord uten flyt-rolle-validering. Drill-ned forblir hovedflyt. SJA/RUH får ikke hurtig-modal (ingen ChecklistComment-tabell — drill-ned er primær for dem).

**Konsekvenser for arkitektur:**
- Ny rute `apps/web/src/app/dashbord/firma/hms/` (planlagt under firmamoduler)
- Ny server-prosedyre `firma.hms.aggregerForOrganisasjon` eller `hms.hentFirmaOversikt`, gated på firma-admin / HMS-ansvarlig-rolle
- Behandling fra firma-nivå må navigere ned til prosjekt-detalj eller åpne modal i prosjekt-kontekst — felles vs. prosjekt-isolert tilgangskontroll må avklares
- Aggregering kan gjenbruke `hms.hentDokumenter` per prosjekt med `Promise.all` initialt, server-side aggregering for skala senere (jf. punkt 4 i HMS-prosjektvisning teknisk gjeld)

**Spec-beslutninger 2026-05-29:**

- **Behandling:** Full behandling fra firma-dashbordet — kommentere, statusendring og tildele utfører direkte fra firma-listen uten å forlate dashbordet. Server-prosedyrene som gjør disse handlingene må aksepteres uten prosjekt-kontekst, eller dashbordet kaller eksisterende prosjekt-prosedyrer med projectId hentet fra dokument-raden.
- **Synlighet:** Firma-HMS-ansvarlig ser alle HMS-dokumenter inkl. private (`hmsSynlighet: "privat"`). Likestilt med prosjekt-HMS-ansvarlig i tilgang. `byggHmsSynlighetsFilter` må utvides eller bypass-es når firma-HMS-rolle er aktiv. Tilgang logges som audit-spor.
- **Statistikk-KPI-er** (alle fire valgt):
  1. Åpne avvik per prosjekt (status ≠ closed/approved/cancelled, gruppert per prosjekt)
  2. SJA-frekvens per måned (siste 12 mnd, total + per prosjekt)
  3. RUH-rate per måned + trend (indikerer rapporteringskultur)
  4. Saksbehandlingstid median (dager fra opprettet til closed, per prosjekt + firma-total)

**Avhengighet:** Krever rolle-modell-beslutning (`OrganizationGroup` vs `OrganizationMember`-rolle) før implementasjon. Server-aggregering av statistikk skal være rask nok for firma med 50+ prosjekter — vurderes om Promise.all per prosjekt eller én rå-SQL-query. Fase 7-nivå arbeid; ikke startet.

**Eksisterende referanse:** Fase 7 § «HMS-statistikk på firma-nivå» nevner dette kort — denne entry-en utvider med konkret arkitekturskisse.

### Status-audit på tvers av dokumenttyper — UTFØRT 2026-05-27

✅ **Audit kjørt 2026-05-27.** Tre handlingsrettede tickets opprettet nedenfor (F1, F7, Tiltak 1). Andre funn (timestamp-felter for SLA, flyt-oppsett-validering, stuck-state ved manglende godkjenner-rolle, tooltip ved blokkert handling) ble vurdert som ikke-handlingsrettede uten produktbeslutning — tas opp ved Avklaring-modul-redesign eller kundefeedback.

**Sammendrag av kode-grunnlag** (verifiser mot kode FØR oppfølger-handling, kan ha endret seg):
- `DOCUMENT_STATUSES` (9 verdier) i `packages/shared/src/types/index.ts:4-14`.
- Tilstandsmaskin: `isValidStatusTransition` i `packages/shared/src/utils/index.ts:33`.
- Rolle-handling-matrise: `ROLLE_HANDLINGER` (bestiller/utforer/godkjenner) i `packages/shared/src/utils/statusHandlinger.ts:110-125`. Registrator får alle handlinger.
- Auto-overgang `sent → received` skjer i `endreStatus`-mutationen (oppgave.ts:1022 / sjekkliste.ts:923).
- HMS-modulen bruker samme statusflyt uten subdomain-spesifikk differensiering.

**Avhengighet:** Avklaring-modul-redesign (§ Avklaring-modul TE/Endring/Varsel) bør re-bruke disse fakta istedenfor å lage egen modell. Verifiser mot kode på det tidspunktet.

### F1 — `cancelled`-status mangler i HMS-filter — IMPLEMENTERT PÅ DEVELOP 2026-05-27

✅ **Fix:** `cancelled` lagt til i `LUKKET_STATUSER` i `apps/web/src/app/dashbord/[prosjektId]/hms/page.tsx:63`. Avbrutt er en endelig tilstand (samme semantikk som closed/approved), ikke en åpen. KPI-tellingen `apneAvvik` er uendret — vi vil ikke at avbrutte saker skal telle som åpne. Verifisering på test etter auto-deploy.

### F7 — HMS subdomain-spesifikk statusflyt (høy prioritet, krever spec-runde)

**Oppdaget under status-audit 2026-05-27.** Alle tre HMS-subdomains (Avvik, SJA, RUH) bruker samme generelle dokumentflyt — ingen subdomain-spesifikk håndtering på server eller i mal-builder.

**Antagelse om reell bruk per subdomain:**
- **SJA** (Sikker Jobb Analyse) — formell godkjenning er kjernen. Bør kreve `approved` før `closed`. I dag er hele flyten valgfri.
- **RUH** (Rapporterte Uønskede Hendelser) — primært rapport-orientert. Flyten `received → closed` direkte (uten responded/approved) er trolig vanlig praksis. I dag tvinges samme flyt som SJA.
- **Avvik** — full flyt er sannsynligvis korrekt.

**Krever (i prioritert rekkefølge):**
1. Produktbeslutning: skal hver subdomain ha hardkodet default-flyt eller fortsatt konfigurerbar per mal?
2. Hvis hardkodet default: utvid `mal.opprett` til å seede subdomain-spesifikk dokumentflyt med riktige roller. Mal-builder UI viser default-flyt med mulighet for overstyring.
3. Hvis konfigurerbar: legg til UI-advarsel i mal-builder ved subdomain SJA hvis flyten mangler `godkjenner`-rolle.

**Avhengighet:** Bør koordineres med F-tickets fra HMS-prosjektvisning teknisk gjeld (§ 1 over) og Avklaring-modul-redesign. Estimat 8-12t etter spec-runde.

### Tiltak 1 — «Alle åpne»-filter i oppgave/sjekkliste-filter — IMPLEMENTERT PÅ DEVELOP 2026-05-27

✅ **Fix:** Ny `filterSnarveier`-prop på `KolonneDef<T>` i `packages/ui/src/table.tsx` + render-blokk i `FilterDropdown` (rad rett under «Alle», visuelt skille med border-bottom). Klikk setter `filterVerdier[kolId] = verdier.join(",")`. Multi-select-mekanikken finnes fra før i page.tsx-filtrering.

Aktivert på status-kolonnen i oppgaver + sjekklister med snarvei `["draft", "sent", "received", "in_progress", "responded"]` (5 åpne statuser, ekskluderer `approved/closed/rejected/cancelled`).

HMS-siden bruker binær `visAlle`-toggle (annen UX-modell) som etter F1-fiks effektivt allerede er en «Alle åpne»-toggle — ikke endret.

i18n: ny `status.alleApne` i nb («Alle åpne») + en («All open»), auto-generert til 13 språk.

### Dokumentflyt send-modal redesign — DEPLOYET TIL PROD 2026-05-25 (prod-merge `4968a23c`)

**Status:** ✅ Implementert og deployet i én bunke (server-Commit 1 `584148b2` + mobil-Commit 2 `91bc235f` + i18n `495d3a37` → develop-merge `88d8299f` → prod-merge `4968a23c`). EAS iOS build #23 (`a5e6e2ea`) submittert til TestFlight (`898599df`). Fire kjente avvik fra spec dokumentert for enhet-testing. Detaljer i [historikk-2026-05.md § Dokumentflyt send-modal redesign](historikk-2026-05.md). Spec under beholdes for referanse til hva som ble låst før implementasjon.

**Oppdaget 2026-05-25** ved gjennomgang av mobilens `DokumentHandlingsmeny.tsx`. Gjelder både oppgave og sjekkliste (samme komponent). Spec låst 2026-05-25, utvidet samme dag.

**Problemet:** Dagens send-modal blander fire konseptuelle kategorier i én flat ActionSheet-liste uten visuell separasjon (flyt-progresjon i aktiv flyt / flyt-bytte til annen flyt / godkjenner-respons / admin-livssyklus). Brukeren mangler kontekst om HVOR de er i flyten. ⚙ brukes som separator for admin, semantisk feil.

**Kjerneinnsikt:** Flyten må visualiseres permanent i detaljsiden med brukerens egen boks markert. Trykk på en boks åpner popup med tilgjengelige STATUSER for den retningen — status er primær-handlingen, ikke et generisk «Send hit».

#### Låst design

1. **Flyt-bokser alltid synlig i detaljsiden** — fargede bokser (`Faggruppe.color`) uten tekst, brukerens boks markert med ring/aktivt-indikator. Bunn-bar erstattes; bokse-raden er den nye primær-handlings-UI-en.
2. **Trykk på boks → popup med tilgjengelige STATUSER** (ikke «Send hit»-knapp). Hver tilgjengelig status er en separat knapp. Eksempler:
   - Nabo-boks fra status `received`: `[Send hit]` (→ `sent` til nabo)
   - Nabo-boks fra status `in_progress`: `[Send videre]` + `[Send tilbake]`
   - Egen boks med status `responded`: `[Godkjenn]` + `[Avvis]` (statusforespørsler — handle på egen ballen)

   Status bærer semantikken; mottaker styres deterministisk av flyt-oppsett. «Send hit»-knappen er fjernet.
3. **Bekreftelses-modal etter status-valg** — «Ønsker du å sende og bytte til [ny status]?» + valgfritt kommentarfelt + Bekreft/Avbryt. To-trinns-flyt: boks → status → bekreft.
4. **Ingen tekst under boksene** — boksnavn vises kun i popup ved trykk. Bevisst minimalisme.
5. **Mottaker styrt av flyt-oppsett** — `recipientUserId`/`recipientGroupId` utledes fra boksens hovedansvarlig-medlem (markert med stjerne i popup'ens medlems-liste). Bruker velger ikke mottaker.
6. **Admin-handlinger bak `⋯`-meny** — Lukk, Gjenåpne, Trekk tilbake skjult under «⋯»-knapp ved siden av bokse-raden. Synlig kun for `minRolle === "registrator"` eller `erFirmaAdmin`. Bryter dagens mønster med ⚙-prefiks.
7. **Flyt-bytte = egen nedtrekksmeny** ved siden av bokse-raden, synlig kun for brukere som er medlem av minst én annen dokumentflyt på samme dokumenttype. Velg flyt → oppgaven flyttes dit og **lander hos brukerens egen boks i den nye flyten** (ikke vilkårlig mottaker). Bekreftelses-modal: «Oppgaven flyttes fra [flyt A] til [flyt B]. Forrige flyt forlates.»
8. **Layout-regler:**
   - ≤4 bokser: én rad
   - ≥5 bokser: to rader med wrap (lese-rekkefølge venstre→høyre, ikke U-form)
   - Pil-konnektor mellom siste på rad 1 og første på rad 2
9. **Skip-over (ikke-nabo-trykk) tillatt** — samme popup-flyt som nabo-trykk. Bekreftelses-modalen i punkt 3 fungerer som safeguard; ingen ekstra mellom-bekreftelse trengs.
10. **Android = custom RN Modal** — ingen `ActionSheetIOS`, ingen plattform-spesifikk `Alert`. Samme komponent på iOS og Android (samme mønster som `FirmaVelger`/`ProsjektVelger`).

#### Fortsatt åpent (detalj-spørsmål, ikke blokkerer implementasjon)

- **`approved`/`closed`-tilstand:** Skal flyt-boksene grå-tones som «lukket flyt» eller forbli trykkbare for «videresend som referanse»? Dagens server flytter oppgaven mellom flyter også fra approved/closed via `forwarded`-mekanisme. Foreslått retning: grå-toning + trykkbart, popup viser tilgjengelige statuser (typisk kun «Send som referanse») med klar advarsel om at oppgaven flyttes over. Avklares ved implementasjon.

#### Tilgangs-utvidelse i samme runde

`endreStatus` server-regel utvides — dagens regel tillater kun `admin`/`registrator` å bytte flyt. Utvides til også å tillate:
- «Har ballen» (`userId === recipientUserId` eller medlem av `recipientGroup`)
- «Cross-flyt-medlem» (medlem av både gammel og ny flyt) — tett knyttet til at flyt-bytte lander på brukerens egen boks i ny flyt

Skip-over-nabo: tillatt for alle med flyt-tilgang. Server validerer ikke retning — det er en UX-konvensjon styrt av bekreftelses-modalen.

#### Berører

- `apps/mobile/src/components/DokumentHandlingsmeny.tsx` — full omskriving til boks-basert komponent med statusvalg-popup
- `apps/mobile/src/components/FlytIndikator.tsx` — sannsynligvis innlemmes i ny komponent (`byggLedd` blir delt helper)
- `apps/api/src/routes/oppgave.ts` — ny `hentTilgjengeligeFlyter`-prosedyre + utvidet `endreStatus`-tilgangs-validering
- `apps/api/src/routes/sjekkliste.ts` — speilet endring
- `packages/shared/src/utils/statusHandlinger.ts` — kilde for tilgjengelige statuser per boks. Mobil bør konsumere `hentRolleFiltrertHandlinger` (i dag dupliserer den logikken lokalt).
- `packages/shared/src/i18n/*` — nye nøkler: bekreftelses-tekst, popup-tittel, flyt-bytte-tekst, admin-meny-elementer
- Server-tilgangskontroll-helper for å sjekke flyt-medlemskap

#### Estimat

Server ~45 min, mobil-UI ~5 timer (oppgave, ny boks-komponent med statusvalg-popup), sjekkliste ~30 min (gjenbruk). I18n auto-oversett. Totalt ~7 timer Opus-arbeid + EAS-bygg.

### Datamodell og migrasjon

- **P-KRITISK-1 — Sentralbiblioteket ikke seedet i prod** 🔴 — se [oppryddings-plan-2026-04-28.md § P-KRITISK-1](oppryddings-plan-2026-04-28.md). Lovpålagt grunnpakke skal auto-seedes ved firma-opprettelse.
- ~~**P-KRITISK-2 — `FtdChangeEvent` og `FtdTnotaChangeLink` mangler i prod**~~ ✅ DEPLOYET — migrasjon tilført i `4f32d702 fix(migrations): tilføy FtdChangeEvent + FtdTnotaChangeLink-migrasjon` (merget til main via `29a3733f`). Verifisert 2026-05-28 mot kode + git-historikk. Entry var hjemløs drift fra før prod-deploy.
- ~~**P-KRITISK-3 — `BibliotekMal` mangler 4 fase-0-besluttede felt**~~ ✅ DEPLOYET — alle 4 felt (`kategori`, `domene`, `kobletTilModul`, `verifisert`) lagt til i `29311756 feat(db): Fase 0 § E steg 8 — BibliotekMal-utvidelse`. Verifisert 2026-05-28: `packages/db/prisma/schema.prisma` har feltene; commit er i main. Entry var hjemløs drift.
- **DB-naming-audit alias-rydding** 🟡 — etter mobil-app-oppdatering kan alias-feltene fjernes. Se [db-naming-audit-2026-04-25.md](db-naming-audit-2026-04-25.md).
- **Cross-package svake FK orphan-deteksjon** 🔴 — `db-maskin` referer til `User.id` via String uten cascade. Backlog-oppgave per [arkitektur-syntese.md § 6.1](arkitektur-syntese.md).
- **Organization vs OrganizationPartner — strategi D (DB-cleanup, 6-8t)** 🔴 — skall-firmaer i test-DB. Strategi C `Organization.erKunde` implementert 2026-05-03. Audit per rad gjenstår.

### Refaktor og rydding

- **40 åpne P-oppgaver i [oppryddings-plan-2026-04-28.md](oppryddings-plan-2026-04-28.md)** 🟡 — P2 faggruppe-rename, P3 drift-detaljer, P4 Kenneth-drøftinger, P5 svakhet-reparering.
- ~~**Firma-administrasjons-navigasjon strukturell rydding (~10-12t)**~~ ✅ FERDIG — audit utført 2026-05-28. Alle tre lag i mål: (1) rename «Firmainnstillinger» → «Prosjekteier» (`f3b8bb1a` + `e7168b32`), (2) firma-relevante server-ruter har `organizationId`-input (organisasjon 15/22 — 7 manglende er bruker-spesifikke queries; avdeling, kompetansetype, kalender, lonnsart, aktivitet, tillegg, vare, vareKategori 100%; kompetanse `opprett`/`oppdater`/`slett` utleder org via `verifiserKompetanseSkriveTilgang` per design, ikke bug; vareImport 2/2 — telle-feil i tidligere audit), (3) 10/10 firma-sider bruker `useFirma()` (kun stub-siden `fakturering` mangler, og den får det naturlig når den implementeres). Opprinnelig «~10-12t»-estimat var foreldet — reelt arbeid skjedde gradvis gjennom Blokk A-C + andre PRs.
- ~~**Header-koordinering: firma-bytte nullstiller ikke prosjekt**~~ ✅ LØST — verifisert mot kode 2026-05-27. `prosjekt-kontekst.tsx:101-114` har auto-reset useEffect (P1 Fase 2, 2026-05-05). `byggeplass-kontekst.tsx:70-79` har defensiv cleanup ved firma-bytte. Entry-en var hjemløs drift fra før P1 Fase 2-deploy.
- **Nye integrasjonstester for `tilgangskontroll.ts`** 🔴 — etter O-5c er gammel test-fil slettet (16/22 broken). Integrasjonstester mot test-DB med OrganizationMember-fikstur er planlagt.
- **Activity-logging — aktivere `activity_log` for tilstandsendringer** 🔴 — `activity_log`-skjema finnes (15 kolonner, payload jsonb, retention-felter, anonymisering) men **ingen kode skriver til tabellen**. Bekreftet 2026-05-28: 0 rader siste 24t, ingen spor av template-sletting eller tilgangs-endringer. **Note — dokumentflyt-domenet er allerede dekket:** `DocumentTransfer`-tabellen (`schema.prisma:1029-1060`) logger juridisk audit-trail for alle status-overganger (draft→sent→received→responded/godkjent), kommentarer, faggruppe-snapshots og kostnad-snapshot. `TaskComment` dekker frittstående kommentarer, `ChecklistChangeLog` dekker sjekkliste-felt-endringer, og fra 2026-05-29 dekker `TaskChangeLog` task-felt-endringer (opt-in via `enableChangeLog`). Disse skal IKKE replikeres til `activity_log` — Activity dekker det som ikke har egen audit-mekanisme i dag. **Implementasjonsrekkefølge (mangler i dag):** (1) **template-CRUD** (`report_templates`) — opprettelse/endring/sletting (akutt etter Florian-k-avv-mysteriet 2026-05-28: hard-delete uten spor), (2) **`project_members`-endringer** (role, kanAttestere, erFirmaansvarlig — tilgangs-kritisk), (3) **`groups`/permissions** (permission-endringer er audit-kritiske), (4) **hard-delete generelt** via Prisma middleware som sikkerhetsnett for alle modeller. **Arkitektur-skisse (5 dager):** Hybrid Prisma middleware + eksplisitt tRPC-skriving, AsyncLocalStorage for userId-context, whitelist per modell, retention 18 mnd via PM2 cron. Erstatter T7-2b3 før/etter-snapshot-utvidelse (samme tabell, samme infrastruktur).
- ~~**TaskChangeLog — audit-trail for felt-endringer på oppgaver etter sending**~~ ✅ DEPLOYET TIL PROD 2026-05-29 (prod-merge `fff9daf4`, impl `6d6e2321`). Arkivert til [historikk-2026-05.md § TaskChangeLog](historikk-2026-05.md).
- **UI-cache-forsinkelse ved gruppe-oppdatering** 🟡 — React Query oppdaterer ikke andre brukeres sesjoner ved DB-endring (gruppe-permissions, ProjectMember-rolle etc.). Bruker som er midt i en sesjon ser gammel rolle-state inntil window-focus eller manuell refresh. Kjent begrensning av React Query sin per-klient-cache-modell. Mulige fremtidige løsninger: kortere `staleTime` på gruppe-queries (offer mot ekstra server-trafikk), optimistisk invalidering via WebSocket/SSE-broadcast ved gruppe-endring, eller polling-interval på sentrale tilgangs-queries. Ikke prioritert — tas opp ved kundefeedback eller når impersonerings-tilgangs-oversikt-UX-sesjonen drøftes.
- ~~**Returnert→pending-reset ved `sendTilAttestering`**~~ ✅ Implementert 2026-05-27 på develop. `send`-mutation i `dagsseddel.ts:931` utvidet med betinget `$transaction` som nullstiller returnerte rader til pending ved re-send. Backfill-SELECT mot prod-DB ga 0 rader — ingen migrasjon nødvendig.
- ~~**HMS-prefix-UX-felle — amber-hint i mal-modal**~~ ✅ DEPLOYET TIL PROD 2026-05-30 (prod-merge `765e060e`, impl `8d517732`). Arkivert til [historikk-2026-05.md § Subdomain↔category-validering + HMS-prefiks amber-hint](historikk-2026-05.md).
- ~~**Subdomain↔category-sammenheng-validering**~~ ✅ DEPLOYET TIL PROD 2026-05-30 (prod-merge `765e060e`, impl `8d517732`). Server-validering med mapping `avvik+ruh → oppgave, sja → sjekkliste` (konsistent med 2026-05-29-redesign). Feilmelding: «SJA bruker sjekkliste-format. Avvik og RUH bruker oppgave-format.» Arkivert til [historikk-2026-05.md § Subdomain↔category-validering + HMS-prefiks amber-hint](historikk-2026-05.md).
- **MalbyggerV2 — fire-fane redesign (`MalListeV2.tsx`)** 🔵 **UTSATT** — Frafalt inntil videre — fokus på å rydde opp dagens problemer (HMS/oppgave-konsistens, sammenheng subdomain↔category, send-modal-flytvalg). Vurderes på nytt etter HMS/oppgave-rydding er komplett. *(Opprinnelig skisse: Ny komponent på `/dashbord/oppsett/produksjon/maler-v2` bak feature-flag, fire faner Oppgave | Sjekkliste | HMS | Avklaring. Begrunnelse: dagens UI blander to akser, fire-fane-modell gjør valgene visuelt likestilt og forberedt på Avklaring som tredje kategori. Forutsetter: avklare om HMS skal være egen fane eller filter, og at Avklaring-modul er spesifisert. Minimal-fiks (HMS-checkbox-gate) deployet 2026-05-29.)*

### Mobil og sync

- **Pre-eksisterende timerSync.ts baseline-feil (linje 308, 334)** 🟡 — `string | null` mot lokal `.notNull()`. Akseptert som baseline, ikke prioritert.

- **Full scheme-separasjon for app variants (oppfølger til app-variants 2026-06-12)** 🟡 — App-variants (del B, 2026-06-12) gir test-bygget eget `ios.bundleIdentifier` (`com.kemyrhau.sitedoc.test`) via `app.config.js`, men `scheme` ("sitedoc") + `android.package` holdes DELT fordi `apps/mobile/src/services/auth.ts:84` hardkoder `makeRedirectUri({ scheme: "sitedoc" })`. Konsekvens: «SiteDoc TEST» og prod-«SiteDoc» deler URL-scheme → iOS-udefinert hvilken app som fanger OAuth-redirect hvis begge er installert. For ekte isolasjon: (1) gjør `scheme` betinget i `app.config.js` (`sitedoc-test` på APP_VARIANT), (2) la `auth.ts:84` lese scheme fra config i stedet for hardkoding, (3) registrer `sitedoc-test://`-redirect i Google OAuth-klient. Lav prio — praktisk workaround er å ikke kjøre OAuth i begge apper samtidig. Se [eas-build-veileder.md § App variants](eas-build-veileder.md).

### Attestering-rediger-flyt — inkonsistens (oppdaget 2026-05-17, LØST 2026-05-17 via T7-5d)

**Status:** ✅ Adressert. T7-5d (merge `9727c7f9` på develop) erstatter RedigerSeddelModal med RedigerRadModal. Penn-klikk åpner nå kun prosjekt+ECO-bucken, ikke hele sedelen i side-i-modal. AttesteringDetalj renset for modal-spesifikke props. Detaljer i [STATUS-AKTUELT.md § T7-4g + T7-5d](STATUS-AKTUELT.md).

Original diagnose beholdt under for historikk.

---

### Attestering-rediger-flyt (original diagnose)

**Stop og planlegg.** Etter T7-4f-bunken har vi to overlappende redigeringsstier som skaper forvirring. Diagnose og anbefalt arkitektur:

#### Hva skjer teknisk etter penn-klikk i SeddelKort

Penn-ikonet er en `<Link>` til `/dashbord/firma/timer/attestering/[id]?rediger=1`. Next.js gjør full sidebytte til detalj-siden (`apps/web/src/app/dashbord/firma/timer/attestering/[id]/page.tsx`), som monterer `AttesteringDetalj`. `useSearchParams()` leser `?rediger=1` og setter `redigerModus=true` via `useEffect` — **men kun hvis `sheet.redigerTillatt=true`**.

`sheet.redigerTillatt` kommer fra `OrganizationSetting.tillattRedigerVedAttestering`, **default `false`**. Hvis firmaet ikke har slått den på, ignoreres `?rediger=1` og siden vises read-only med en liten advarsel-banner.

#### Hva mangler i edit-modus-flyten

**Teknisk:** ingenting. Lagre-knapp (`AttesteringDetalj_Edit.tsx:481`), avbryt-knapp (linje 478), cache-invalidering — alt finnes.

**UX:**
- `redigerTillatt=false` → penn-ikonet «lyver». Brukeren ser ingen åpenbar tilbakemelding på hvorfor edit ikke aktiveres.
- Etter lagring blir bruker stående på detalj-siden i read-only. Forventer retur til listen.
- Ingen toast/badge på listen som bekrefter at sedelen ble endret.
- Edit-modus krever hele sedelen lastet — per-rad-edit-løfte fra penn-ikonet er overdrevet.
- Detalj-siden duplikerer ✓/↩-knappene fra listen — to måter å gjøre samme attestering på.

**Brukerens nåværende vei fra «vil endre én rad» til «endring lagret»:** 8 steg (klikk penn → vent navigasjon → sjekk redigerTillatt → endre → lagre → vent → klikk tilbake → se listen).

#### Korrekt arkitektur — anbefaling: **Modal overlay (Alternativ B)**

| Alternativ | Vurdering |
|---|---|
| A: Inline i listen | ❌ Liste-state blir kompleks. 50+ sedler × edit-state. Kataloger queries multipliseres per kort. Ytelse-risiko. |
| **B: Modal overlay** | ✅ Beholder list-kontekst. Gjenbruker `AttesteringDetaljEdit`. Lukk = umiddelbar retur. Per-rad-attestering fungerer i bred modal. |
| C: Sidebytte (dagens) | ❌ Tar bruker ut av list-kontekst (Kenneths hovedklage). Duplikate knapper. 8 steg. |

**Implementasjons-skisse (planlagt som T7-5b):**
- SeddelKort: penn-klikk åpner modal i stedet for å navigere
- Ny `<AttesteringDetaljModal>`-wrapper rundt eksisterende `AttesteringDetalj`-komponent
- `?rediger=1`-mønsteret avvikles for liste-bruk (kan beholdes for direktelink hvis aktuelt)
- Detalj-siden beholdes for bokmark/e-post-deeplinking, men blir tertiær

**Krever før implementasjon:**
1. Avklar om `tillattRedigerVedAttestering` skal være default `true` for nye firma (i dag default `false`)
2. Avklar om listens ✓/↩-knapper og modalens per-rad-checkboxer skal forenes til ett mønster
3. Vurder om detalj-siden bør slankes til kun det den gjør bedre enn modalen (per-rad multiselect, inline rediger), og fjerne det som duplikerer listen

**Status 2026-05-17:** T7-5b-1..4 + B-fixes implementert og deployet til test (se STATUS-AKTUELT.md). T7-5c (sammenheng-håndtering i splitt) åpen. Plasseres i `historikk` når hele bunken er deployet til prod.

### Kompakt sedel-layout — utnytt skjerm bedre (oppdaget 2026-05-17, ✅ T7-4g 2026-05-17)

**Status:** ✅ Forslag 1 implementert. T7-4g (merge `5c6347d9` på develop) reduserer SeddelKort-header til én linje (~48px) med default-kollapsing. Auto-expand ved tilleggHarKrav eller mertid. Action-rad fjernet. Detaljer i [STATUS-AKTUELT.md § T7-4g](STATUS-AKTUELT.md).

**Gjenstående:**
- Forslag 3 (periode-presets + faner + paginering) — egen oppfølger T7-4h
- Forslag 2 (view-toggle [Kort]/[Tabell]) — vurder etter Forslag 3

### B_ny / T7-5f — Lagre-knapp grå→grønn — DEPLOYET TIL PROD 2026-05-23 (prod-merge `c2792f28`, impl `e7ac0f83` + utvidelse `f0e1a740`)

✅ Implementert på både `AttesteringDetalj_Edit.tsx:296-305, 487-499` (`harUlagredeEndringer`-memo + grønn className når dirty) OG `RedigerRadModal`. Tidligere arkiv-commit `be73e2c6`. Entry var hjemløs drift som ikke ble fjernet etter prod-deploy.

### T7-5e — Attestert-filter på attestering-listen — DEPLOYET TIL PROD 2026-05-20 (prod-merge `cc8f0067`, impl `c523323a`)

✅ Implementert. Fane-toggle `[Venter ●N] [Attestert ●M]` over uke-navigasjon, to parallelle queries, `readOnly`-prop til SeddelKort + ProsjektGruppe, i18n-nøkler `timer.attestering.fane.{venter,attestert}` i 15 språk. Tidligere arkiv-commit `8aa664cb`. Entry var hjemløs drift som ikke ble fjernet etter prod-deploy.

### Pause-modell på timer-rad — IMPLEMENTERT 2026-05-18 (pauseFra/pauseTil i daily_sheets)

**Faktisk implementasjon på develop 2026-05-18:** Pause med eksplisitt fra/til-vindu på sedel-nivå, ikke inline checkbox uten tider. Mer ambisiøst enn opprinnelig MVP-vedtak fordi maskin-validering for døgn-utleide maskiner (Heatwork-mønster) krevde å vite pause-lengde for invariant-justering.

**Schema (`packages/db-timer/prisma/schema.prisma`):**
- `DailySheet.pauseFra: String?` og `DailySheet.pauseTil: String?` (HH:MM, nullable). Migrasjon `20260517220000_add_pause_fra_til`.
- `pauseMin` beholdt som denormalisert sum for raskt oppslag. Server beregner `pauseMin = Math.round((pauseTil - pauseFra) / 60)` ved hver oppdatering.

**Klient-flyt (RedigerRadModal):**
- Checkbox auto-hukes ved overlap mellom rad.fraTid/tilTid og sheet.pauseFra/pauseTil.
- Klikk på checkbox når ingen pause finnes lager default 30 min midt i rad-intervallet (se § Pause-default).
- `beregnTimerMedPause(fraTid, tilTid, pauseFra, pauseTil)` returnerer `(til-fra) - pauseMin/60` ved overlap.
- Sheet-level state — endring fra én rad reflekteres på alle overlapp.

**Server-validering (utvidet):**
- `validerMaskinUnderArbeid(timer, maskin, pauseMin)` — pause-buffer på maskin-invarianten (se § utleie_enhet-prinsipp).
- `redigerSedelRader`-mutation aksepterer `pauseFra/pauseTil` i input + oppdaterer DailySheet i samme transaksjon.

**Bakgrunn (opprinnelig analyse):** Pause-data-analyse på 3 sedler i test-DB viste tre ulike praksiser (gap mellom rader / pause trukket fra første timer-rad / pause trukket fra maskin-rad også). Sedel B brøt maskin-timer-koblingen. Eksplisitt pause-vindu var nødvendig for å gi maskin-validering riktig kontekst.

**Kjente begrensninger — se egne seksjoner:**
- Stille overskriving av manuelt-justert rad.timer (T7-5h)
- Default pause-vindu er midtpunkt — bør være firma-konfigurerbar
- Multi-rad-overlap ikke server-validert
- utleie_enhet-prinsipp ikke håndhevet i UI ennå

### T7-5h — Stille overskriving av manuelt-justert rad.timer — DEPLOYET TIL PROD 2026-05-28 (prod-merge `6fd294d1`)

✅ Arkivert til [historikk-2026-05.md § T7-5h](historikk-2026-05.md). Scope: kun web. Mobil-komponenter har separat recompute-logikk og er ikke berørt — egen sub-PR ved behov.

### Pause-vindu default — DEPLOYET TIL PROD 2026-05-28 ✅ (prod-merge `75a09ccf`, arkivert til [historikk-2026-05.md](historikk-2026-05.md))

### Multi-rad-overlap pause — ikke håndtert (oppdaget 2026-05-18)

Hvis flere timer-rader overlapper samme pause-vindu (f.eks. 07:00–12:00 + 11:30–15:00 med pause 11:45–12:00), trekkes pause-min fra hver rad isolert i `beregnTimerMedPause`. Server-validering (`validerMaskinUnderArbeid` med pauseMin-buffer) regner pause kun én gang per bucket — det er konsistent for invarianten, men klient-summering kan vise dobbel-trukket pause.

Sjeldent i praksis (typisk én sammenhengende rad per dag), ikke server-blokk. Vurdere om recompute bør splitte pause-fradraget på tvers av overlappende rader, eller om det er en arbeider-feil å registrere overlappende rader uten å selv justere pause.

### utleie_enhet-prinsipp som styrende for maskin-validering (vedtatt 2026-05-18)

**Vedtak:** `equipment.utleie_enhet ∈ {'doegn', 'time'}` er det styrende skillet for hvordan maskin-timer relaterer seg til arbeidstimer — ikke et hypotetisk «kreverForer»-flagg eller «mannsbetjent vs autonom»-konsept.

**Bakgrunn (verifisert mot test-DB 2026-05-18):**
- `maskin.equipment`-tabellen har ALLEREDE feltene `er_utleieobjekt: boolean`, `utleie_enhet: text` ('doegn' | 'time'), `utleiepris_per_dogn`, `utleiepris_per_time`.
- Det finnes **ikke** noe `krever_foerer`-felt. Tidligere foreslåtte spesialtilfeller (Heatwork som «autonom», CAT 320 som «mannsbetjent») var gjettet uten datagrunnlag.

**Konsekvens for maskin-invariant per (projectId, ECO)-bucket:**
- `utleie_enhet = 'doegn'`: maskin går mens operatør pauser → invariant tillater `maskin ≤ arbeid + pauseMin/60`. Heatwork 7626 (9.00t maskin / 8.50t arbeid + 0.50t pause = 9.00t) er innenfor.
- `utleie_enhet = 'time'`: maskin styres av operatør → faller naturlig under `maskin ≤ arbeid` (pause-buffer brukes ikke fordi maskin pauser når operatør pauser).
- `er_utleieobjekt = false`: intern bruk, ikke fakturert utleie — invariant gjelder uansett som baseline.

**Implementasjon-status 2026-05-18:**
- Server-invariant er utvidet med `pauseMin`-buffer universelt (`validerMaskinUnderArbeid` tar pauseMin). Maskin-utleie-enhet brukes ikke i invariantsjekken — gjelder for alle.
- UI-info-warning i `KompaktMaskinRad` viser fortsatt «⚠ Maskintimer overstiger arbeidstimer» når over arbeidstimer, uten å hensynta `utleie_enhet`. Ikke blokker, men kan misforstås for døgn-utleide.

**Åpne avklaringer:**
- Skal invariant være ulik for `utleie_enhet='time'` (strengere: `maskin ≤ arbeid`, ingen pause-buffer)? I så fall: kreves split av sjekken per maskin-rad basert på equipment-data.
- Skal UI-warning skjules for `utleie_enhet='doegn'`-rader når maskin > arbeid (forventet)?

**Foreslås som styrende prinsipp i fase-0-beslutninger.md.**

### B5 — Sum-indikator (maskin-av-arbeid) i SeddelKort — DEPLOYET TIL PROD 2026-05-27 (prod-merge `f7a836f8`)

✅ Implementert. Grønn/rød badge med samme invariant som EcoBucketAttest (inkl. pause-buffer per T.7 2026-05-18). Auto-expand-trigger utvidet med `maskinOver`. Arkivert til [historikk-2026-05.md § lagContextStamme + B5](historikk-2026-05.md).

### Detalj-siden vs modal — slankhetsvurdering (vedtatt 2026-05-17)

Detaljsiden beholdes fullt funksjonell (sammenheng-prinsipp krever det). Reverserer tidligere skissert slanking. Detaljsiden er riktig sted for kompleks redigering der sammenhenger må vurderes (multi-rad-utvalg på tvers av ECO, full sedel-overblikk).

### i18n: pause-drift (fr + de/sv/et) — ✅ DEPLOYET TIL PROD 2026-05-27 (prod-merger `baa462e1` + `d8b60854`)

Auto-oversettings-skriptet forvekslet engelsk «break» (pause) med «break» (knekke/avbryte) på fire språk. Fikset i to runder:

- **fr** (prod-merge `baa462e1`, impl `da0b2aad`): label «Casser» → «Pause», toggleHint «saut» → «pause», intervall «rupture» → «pause», maskinAvArbeid-formulering forbedret. Arkivert til [historikk-2026-05.md § Returnert→pending-reset + fr.json](historikk-2026-05.md).
- **de/sv/et** (prod-merge `d8b60854`, impl `eae412c0`): samme mønster fikset på tysk («Brechen» → «Pause»), svensk («Bryta» → «Paus» + hint «avbrott» → «paus»), estisk («Katkesta» → «Paus»). Audit-funn via pre-compact dokumentasjons-sjekk.

### i18n: `timer.gruppe.maskinAvArbeid` — IMPLEMENTERT PÅ DEVELOP 2026-05-28 ✅

Engelsk kildetekst forenklet fra «Machine hours {{maskin}}h of work hours {{arbeid}}h» til «Machine {{maskin}}h / Work {{arbeid}}h» (kort, klar struktur med universell slash-separator). Norsk speilet: «Maskin {{maskin}}t / Arbeid {{arbeid}}t». Nøkkelen slettet i 12 språk og re-generert via `generate.ts` — alle oversettelser nå gramatisk korrekte. ro fikset manuelt (Google Translate hoppet over «Work»; satt til «Lucru»). fr beholdt sin manuelle verdi fra `baa462e1`.

## 2. Halvferdige features

### Tilbake-pil i kommentar-modal (mobil `oppgave/[id].tsx`) 🟡

`ArrowLeft`-knapp i headeren på kommentar-dialogen for å lukke den. Ucommittet WIP fra 2026-06-01 (forkastet 2026-06-05 — endringen lå ucommittet lokalt gjennom flere sesjoner uten å bli fullført). Skal vurderes på nytt: om kommentar-dialogen trenger en eksplisitt tilbake-/lukk-pil i tillegg til eksisterende lukking.

### Dokumentflyt/kontaktliste redesign — skille faggrupper fra interne grupper (høy prioritet)

**Oppdaget 2026-05-26** etter prod-deploy av HMS-modul-seeding (`dddf2732`). Dagens dokumentflyt-side grupperer alt etter faggruppe, men `HMS-ansvarlige`-gruppen (og andre `ProjectGroup`-instanser med `domains: ["hms"]` eller `category: "brukergrupper"`) er ikke faggrupper — det er en annen datatype som ikke vises i dagens visning.

**To konkrete problemer:**
1. **HMS-flyten (opprettet av `modul.aktiver` for hms-avvik) er usynlig i dokumentflyt-administrasjon.** Flyten har et `DokumentflytMedlem` med `faggruppeId = null` + `groupId = HMS-gruppen.id`. Dagens UI grupperer kun på faggruppe-medlemmer og hopper over null-faggruppe-rader.
2. **Kenneth opplever faggruppe-visningen som svak.** Ønsker to visningsmoduser: én for navn/enkle lister (interne grupper, ansatte), én for faggruppe-struktur (kontraktsparter med faggruppe-farge + rolle-organisering).

**Rotårsak:** UI blander to konsepter som er forskjellige i datamodellen:
- **Faggruppe** (`Faggruppe`-tabell) — eksterne kontraktsparter (Byggherre, Bygg, Elektro, VVS, Ventilasjon). Har `color`, `industry`, `faggruppeNummer`. Vises i dokumentflyt som «boks» i flytkjeden.
- **ProjectGroup** (`ProjectGroup`-tabell) — interne grupper (HMS-ansvarlige, brukergrupper). Har `domains`, `permissions`, `modules`. Brukes til tilgangskontroll og som flyt-medlem via `DokumentflytMedlem.groupId`.

`DokumentflytMedlem`-schemaet støtter allerede begge via `faggruppeId | projectMemberId | groupId` (mutex), men UI gjenspeiler ikke den fleksibiliteten.

**Krever design-runde før implementasjon.** Åpne spørsmål:
- Skal interne grupper vises i samme flyt-visualisering som faggrupper, eller i et separat panel?
- Hvordan visualiserer vi en flyt med både faggruppe- og gruppe-medlemmer (eks. HMS-flyt der bestiller er åpen og utforer er HMS-gruppen)?
- Skal Kenneths to visningsmoduser være toggle-bare per side, eller skal de skilles ut til separate sider (kontaktliste vs flyt-administrasjon)?
- Hva med brukergrupper som ikke er involvert i noen flyt — vises de noe sted i dag?

**Berører:**
- `apps/web/src/app/dashbord/oppsett/produksjon/dokumentflyt/page.tsx` — primær side
- `apps/web/src/app/dashbord/oppsett/produksjon/_components/dokumentflyt-komponenter.tsx` — komponenter
- `apps/web/src/app/dashbord/oppsett/produksjon/kontakter/` — kontaktliste (sannsynligvis berørt av samme to-konsept-skille)
- Server `gruppe.hentForProsjekt` returnerer allerede ProjectGroup-data — UI må bare konsumere det

### Web DokumentHandlingsmeny — redesign til boks-modell (høy prioritet)

Samme redesign som mobil fikk i Commit 2 (`91bc235f`). Web-versjonen (`apps/web/src/components/DokumentHandlingsmeny.tsx`, 734 linjer) bruker fortsatt gammelt ActionSheet-mønster uten flyt-kontekst — brukeren bekrefter «Send» uten å se hvor dokumentet går.

Bør speile mobil-modellen: flyt-bokser alltid synlig, klikkbare, popup med statuser, ⋯-admin-meny, flyt-bytte-dropdown. Avventer til mobil-UX er verifisert på enhet (build #23) før vi kjører samme redesign på web — får bekreftet at modellen fungerer i praksis først.

Eksisterende `apps/web/src/components/FlytIndikator.tsx` (199 linjer) og `apps/web/src/components/StatusHandlinger.tsx` (278 linjer) kan gjenbrukes som byggesteiner. Server-API (`oppgave.hentTilgjengeligeFlyter` + utvidet `endreStatus`-tilgang) er allerede i prod (`4968a23c`) og kan konsumeres uten endring.

### Innstillinger + IA/UX-restrukturering (egen sesjon, etter R-fasene) 🟡

`firma/innstillinger` er blitt uoversiktlig, og enkelte modul-koblinger havner adskilt fra det de hører til (f.eks. maskin-side ved en innstillingsknapp — må diskuteres). Mye har fornuftig plassering; dette gjelder primært innstillinger + noen spredte enkeltsider, ikke en total omskriving. Plan: dedikert sesjon med full IA-analyse — enumerér alle innstillings-/modul-ruter, mål mot domene-arbeidsflyt + tre-nivå-arkitektur, foreslå logiske grupperinger + ny navigasjonsstruktur med visuelle mockups. Bygg på [navigasjon-arkitektur-analyse-2026-05-03](navigasjon-arkitektur-analyse-2026-05-03.md), [ux-arkitektur-agenda](ux-arkitektur-agenda.md), [admin-navigasjon-analyse-2026-05-03](admin-navigasjon-analyse-2026-05-03.md), [domene-arbeidsflyt](domene-arbeidsflyt.md). Ingen ad-hoc flytting underveis — samles til én restrukturering. Trigget av reise-matrise-knapp-plassering (R3, 2026-06-11).

### Hilsen viser ekte admin-navn under impersonering (funn 2026-06-11) 🟡

Toppbar-hilsenen bruker `useSession()` (ekte innlogget bruker), ikke impersonerings-bevisst kontekst → viser `sitedoc_admin` sitt navn mens man impersonerer. Uavhengig, isolert fiks (impersonerings-bevisst bruker-kontekst i hilsenen). Lav prioritet. Kilde: `funn-impersonering-og-prosjektoppsett.md`.

### kom-i-gang viser «første prosjekt»-onboarding feilaktig (funn 2026-06-11) 🟡

`kom-i-gang` viser «første prosjekt»-onboarding for ikke-admin selv med valgt prosjekt; redirect kun for `sitedoc_admin`, mangler prosjekt-guard. Sannsynligvis erstattet av planlagt prosjektoppsett-omstrukturering (firma-malprosjekt) → knytt til IA/restrukturerings-saken over, ikke isolert fiks. Kilde: `funn-impersonering-og-prosjektoppsett.md`.

### 3D/IFC/georeferanse

Status og roadmap dokumentert i Claude-memory (`project_3d_status.md`,
`project_3d_roadmap.md`, `project_3d_viewers.md`). 3D/IFC tilhører
separat chat per `feedback_3d_annen_chat`.

- **3D Fase 1 — Web layout-level viewer-persistering** 🔴 — flytt `SammenslattIfcViewer` til prosjekt-layout, vis/skjul basert på rute. Eliminerer re-lasting ved 3D ↔ Tegninger-bytte.
- **3D Fase 2 — Mobil IFC-visning i React Native** 🟡 — grunnleggende viewer DEPLOYET via `eef2ee92 Mobil IFC 3D-viewer — WebView-komponent og navigasjon (Fase 2 Steg 2-3)`. Komponenten lever i `apps/mobile/src/components/IfcViewer.tsx` + ruter `apps/mobile/app/{3d-visning,tegning-3d}.tsx`. Persistent WebView-optimaliseringen ble forsøkt to ganger og revertert begge (`773720d1`, `a319c7e8`) — viewer re-laster ved navigasjon, men fungerer. Fragment-caching tilført (`8c86c85c`). Offline-støtte og persistent-mount gjenstår.
- **3D Fase 3 — Live site-view (AR/3D på byggeplass)** 🔴 — ARKit (iOS) / ARCore (Android). GPS + kompass for grov posisjonering, manuell justering for presisjon.
- **Test absolutt `treDTilTegning`** 🟡 — markør-offset-fixen kan ha løst hele problemet. Ikke testet etter fix.
- **Fjern 3D debug-logging** 🟡 — `tegningTil3D` og `treDTilTegning` logger til console når debug ferdig.
- **Fragment-caching verifisering** 🟡 — sjekk at 2. lasting er raskere.

### Tegning/PDF

- **Split-view pdf.js-migrering** 🔴 — PDF iframe-begrensninger i nåværende implementasjon. Planlagt migrering til pdf.js.

### Timer-relatert

- 🟢 **IDÉ: Lønnsregel-konfig (Nivå 1-2) — tariff-basert lønnsart-forslag.** SiteDoc klassifiserer tid → lønnsart (regnskap eier satser, jf. CLAUDE.md § Lønnsart-grense). Bygger på ③s `Lonnsart.overtidsnivaa`. **Nivå 1:** per-firma konfig for overtid-regler (dags-/ukesterskel, tier-liste 50→100, dag-regler lør/søn/helligdag) via avkryssing/felt. **Nivå 2:** tariff-profiler (Fellesoverenskomsten byggfag etc.) som firma velger → auto-fyller Nivå-1-konfig. **Nivå 3** (full dynamisk regel-motor): bevisst utsatt — kompleksitets-felle (pause/midnatt/uke-vs-dag/helligdag/lærling); bygg kun på konkret udekket behov. **Forward-compat med ③:** `overtidsnivaa` = klassifiserings-substrat; overtid-regelen er allerede isolert i egen util ([packages/shared/src/utils/lonnsregel.ts](../../packages/shared/src/utils/lonnsregel.ts) — `klassifiserArbeidstid` / `velgOvertidLonnsart`) så Nivå-1 kan bytte regel-kropp uten call-site-endring i `StartSluttDagKort`. **Datamodell-skisse (Nivå 1):** per-firma `LønnsregelKonfig` (terskler + tiers + dag-regler) — ikke bygget, kun retning. Manuell override alltid tilgjengelig; konfig kun foreslår.
- ~~**Attestering edit-modus bugs (oppdaget 2026-05-16)**~~ ✅ LØST — fixet i T7-2e (commit `c480fe8a`, prod-deploy via `86fdb5a3`). Bug 1 (fra-tid «0:») rotårsak: `col-span-1` for smal + `step=3600` skjuler minutter i Chrome — fix: `min-w-[120px]` + clamp `step ≤ 1800`. Bug 2 (timer-desimaler): controlled re-render «spiste» punktum — fix: lokal `timerStr`-state, parse ved blur. Entry var hjemløs drift fra før prod-deploy. Verifisert mot kode 2026-05-28 (`RedigerTimerRad.tsx:41-48` + `RedigerMaskinRad.tsx:46-52`).
- **T7-3c geo-forslag-utvidelser** ❓ — historikk-baserte forslag (sist brukte prosjekt). Mye av geo-forslag-leveransen kom i T7-3b2. Egen sub-PR eller forkastes.
- **`OrganizationMemberPermission` (modul-tilgang per ansatt)** 🔴 — låst i [fase-0-beslutninger.md](fase-0-beslutninger.md). Designet klart, ikke startet.
- **Mobil enhet-verifisering: Variant A/B default-lønnsart + auth-fiks** 🟡 — deployet til prod 2026-06-06 (`ac1a4367`), men ikke verifisert på enhet. iOS-simulator blokkert av Cloudflare↔Expo-Go-quirk (POST `/dev-login` svarer 200 server-side men responsen når ikke simulatoren — bekreftet via server-logg req-41) + Google passkey-prompt. Verifiser på fysisk enhet ved neste EAS/TestFlight-bygg: (a) tom sedel forhåndsvelger «Timelønn», (b) rad 2+ arver forrige rad, (c) bruker forblir innlogget over app-reload (auth-fiks).
- **Default-lønnsart per ansatt-avlønningsform (avklaring — Kenneths spørsmål 2026-06-06)** 🟡 — Variant B bruker firma-nivå default («Timelønn», ordinær type) markert via web-stjerne. Åpent: bør «ordinær standard-lønnsart» heller utledes fra **ansattens avlønningsform** (timelønnet → «Timelønn», fastlønnet → «Fastlønn (månedslønn)») enn et firma-globalt valg? Avlønningsform er per-ansatt, mens firmaets arbeidstidsordning (`OrganizationSetting.standardStartTid/SluttTid/pauseMin/dagsnorm`) definerer **timer**, ikke lønnsart — så arbeidstidsordningen kan ikke alene utlede hvilken lønnsart. Naturlig kobling: arbeidstidsordningens `dagsnorm` driver **auto-fordeling normaltid/overtid** (eget, større feature, ikke implementert — `timer.md § Auto-fordeling`). Firma-nivå default (nåværende) dekker det vanlige tilfellet der et firma er enhetlig time- eller fastlønnet; per-ansatt `avlonningsform`-felt på `User` vurderes hvis firma blander begge. Ikke besluttet.
- ~~**iOS-simulator henger på evig spinner — IPv6/NordVPN (ROTÅRSAK FUNNET 2026-06-06)**~~ ✅ BEKREFTET LØST 2026-06-07 — etter reboot (NordVPN avsluttet) returnerer `[HEALTH]` + `[AUTH] verifiser` 200 på 83–117 ms (hang evig før), appen kommer forbi spinneren. Rotårsak var ødelagt IPv6-ruting fra NordVPN-`utun`-rester; happy-eyeballs stallet på død IPv6-sti. **Ikke kode/server/Cloudflare/ngrok.** Full diagnose + løsninger (reboot / IPv6 Link-local only) i [simulator-ipv6-nordvpn.md](simulator-ipv6-nordvpn.md).
- ~~**AuthProvider `verifiser`-fetch mangler timeout/AbortController**~~ ✅ FIKSET 2026-06-07 — `verifiser`-fetchen i `apps/mobile/src/providers/AuthProvider.tsx` har nå AbortController med 12 s timeout; `AbortError` → ytre catch → cachet bruker, ingen evig spinner. Samme commit fjernet debug-instrumenteringen fra rotårsak-diagnosen. **Gjenstående oppfølger (konkrete tilfeller identifisert 2026-06-08):** rå mobil-auth-fetcher uten timeout — `auth.ts loggUt` (se egen logout-frys-entry under) + dev-login-fetchen. Legg AbortController-timeout på alle rå mobil-auth-fetcher; vurder global tRPC/React-Query-timeout. tRPC/React Query har fortsatt ingen global timeout satt. Detaljer i [simulator-ipv6-nordvpn.md § Separat kode-robusthetsbug](simulator-ipv6-nordvpn.md).
- **Logout fryser appen — manglende timeout (bekreftet mot kode 2026-06-08)** 🟡 NÆR-FIKS-KANDIDAT — `apps/mobile/src/services/auth.ts` `loggUt()` (linje 173–192): rå `fetch` mot `mobilAuth.loggUt` UTEN AbortController/timeout. Når api-test er unåelig henger fetch (settler aldri, kaster ikke) → koden når aldri `slettSessionToken()`/`slettBrukerData()` (som ligger ETTER try/catch) → AuthProviders `setBruker(null)` etter `await loggUtTjeneste()` kjøres aldri → appen fryser i «Ukjent bruker». Reprodusert i simulator 2026-06-08. **Fiks (anbefalt: lokal-først):** slett token/bruker + rut til login *først* og ubetinget; server-kall best-effort med timeout etterpå (instant utlogging, ikke 12s-vent som ren AbortController ville gitt).
- **dev-login/simulator IPv6-reachability — re-surfaced 2026-06-08** 🟡 (dev-miljø) — dev-login POST mot api-test feiler intermitterende med «Network request failed» i simulator (AAAA/IPv6-død sti). `setv6off` + `/etc/hosts`-IPv4-pin er flaky. Blokkerer mobil-runtime-test mot api-test. Trenger fokusert infra-feilsøking; skjerp [simulator-ipv6-nordvpn.md](simulator-ipv6-nordvpn.md) med dev-login-spesifikt. Web (test.sitedoc.no) er upåvirket (verifisert via Chrome 2026-06-08).
- **Ansatt-deaktivering — ubygd spor (latent, SPOR 1-research 2026-06-08)** 🟡 — Det finnes ingen deaktiverings-*handling* i koden: `User.canLogin` (arkiv-flagg, `schema.prisma:22`) leses ved login (`auth.ts:15/90`, `mobilAuth.ts:104`) men **settes aldri false** noe sted i `apps/api` (grep: 0 treff). Tre koblede luker: (1) ingen `deaktiverAnsatt`-mutasjon — `OrganizationMember` har ingen livssyklus-felt (`schema.prisma:115-135`), ProjectMember rører ikke; (2) aktive sesjoner / mobile bearer-tokens revokeres ikke — `verifiser` re-sjekker ikke canLogin; (3) timer-mutasjoner (`dagsseddel.ts:560` opprett, `:664` tilfoyTimerRad) gater ikke på canLogin → deaktivert bruker med levende token kan i prinsippet føre timer. **Bygges ikke nå (latent).** Rangerte alt.: (1A) `deaktiverAnsatt` setter `canLogin=false` + `periodeSlutt` på aktive ProjectMember (bevarer, sletter ikke) vs (1B) kun canLogin; (2A) `verifiser` re-sjekker canLogin (treffer 30-dagers-tokens) vs (2B) aktiv sesjons-sletting; (3) canLogin-sjekk i timer-mutasjonene. Historikk er strukturelt bevart uansett (`ProjectMember.userId` SetNull `:446/458`; timer i eget db-timer-schema).
- **`medlem.fjern` hard-sletter ProjectMember — nær-fiks-kandidat (SPOR 1, aktivt i dag)** 🟡 — `medlem.fjern` (`medlem.ts:294-300`) gjør `projectMember.delete()` ved fjern-fra-prosjekt, i strid med den myke-livssyklus-intensjonen `periodeSlutt` (null=aktiv) på `ProjectMember:455`. Foreslått: bytt til `periodeSlutt`-setting for bevart historikk (konsistens med C.13-mønsteret). Liten, isolert endring.
- **Attestant-kontinuitet ved ansatt-slutt — parkert, lav prio (SPOR 1)** 🟢 — Hvis eneste prosjekt-attestant slutter, er åpne attesteringer dekket av firma_admin-fallbacken i `erProsjektLeder` (`dagsseddel.ts:46-58`). Foreldreløs-risiko kun hvis firmaet mangler firma_admin. Parkert; evt. varsel når eneste prosjekt-attestant deaktiveres.
- **Timer-arkitektur (reise / oppmøtested / ikke-prosjekt-tid / firma-isolasjon) — åpne/parkerte punkter** 🟡 — Fra [OPPSUMMERING-timer-arkitektur.md § G](OPPSUMMERING-timer-arkitektur.md): (G3) 30-min-reise-terskel + retning + lovlighet av reisetid utenfor overtid → kun A.Markussen/regnskap/jurist kan bekrefte; (G4) fra/til → HMS-register → uavklart, designes ikke nå; (G5) maskinkost-fordeling + ProAdm utgående eksport (finnes ikke i dag) + per-maskin-vedlikeholdsrapport (`groupBy vehicleId` — finnes ikke) + planlegger-integrasjon → datamodell holdes åpen, bygges ikke nå. Fase-plan + schema-skisse i OPPSUMMERING; den aktive delen rutes til `timer.md` / `fase-0-beslutninger.md` / `arkitektur.md` via SPOR 2.
- **T.8-revisjon — auto-utkast vs konservativ (utredning, 2026-06-13)** 🟡 — T.8 (`fase-0:970`) er i dag **konservativ**: innsjekk/GPS-dagflyt trigger ALDRI auto-dagsseddel eller -rader; data brukes KUN som *hint* i prosjekt-velgeren, og arbeider oppretter rader eksplisitt (`fase-0 T.8:983`). Kenneth foreslår **evolusjon**: GPS-dagflyt **auto-skriver utkast-rader** (draft), og arbeider godkjenner ved **innsending** (draft→sent). **Beslutning for utredningen:** behold konservativ T.8 vs. evolusjon til auto-utkast + innsendings-godkjenning. Begge bevarer arbeider-godkjenning før *endelig* innsending — forskjellen er (a) **hvem som skriver utkastet** (arbeider manuelt vs. systemet fra GPS-dagflyt) og (b) **hvor godkjennings-punktet ligger** (ved opprettelse vs. ved innsending). Berører `fase-0 T.8`, Fase 1c-mobil (`:582` — «aldri auto-rad»-formuleringen må revideres ved evolusjon) og dagsseddel-flyt; avgjøres før Fase 4 Mannskap-koblingen. Ingen kode før beslutning.
- **Oppmøtested Fase 1-oppfølgere (etter Fase 1 develop/test 2026-06-08; Fase 1b ferdig 2026-06-09 `eea004cb`)** 🟡 — tre oppfølgere fanget fra `FASE-1-PLAN`-arbeidsdokumentet (alt nå i BACKLOG → arbeidsdokumentet kan fjernes). Rekkefølge videre: **Fase 1c → Fase 2 (Alt C) → Fase 3 (reise)**:
  - **Leaflet-kartvelger** for oppmøtested-koordinater (web `/dashbord/firma/oppmotesteder` bruker i dag manuell lat/lng — react-leaflet er ikke wiret i web ennå). Kart-klikk + marker-drag → setter lat/lng, manuell inntasting som fallback.
  - **EAS-enhet-verifisering** av Fase 1 mobil-del (GPS-identifikasjon i «Start dag»). Simulator dekker, men ikke fysisk enhet; krever EAS/TestFlight-bygg.
  - **Fase 1c-server — byggeplass-geofence fra georeferert tegning:** ✅ IMPLEMENTERT 2026-06-09 (develop/test, venter prod). `Byggeplass.latitude/longitude/radiusM` + `beregnByggeplassGeofence` (shared) + `bygning.beregnGeofence`/`settGeofence` + auto-fyll i `tegning.settGeoReferanse` (kun når tom) + web override. Løser byggeplass-koordinat-gapet (`fase-0 T.8:990`). Sannhetskilde [timer.md § Byggeplass-geofence](timer.md).
  - **Fase 1c-mobil — byggeplass-GPS-deteksjon i «Start dag»:** 🟡 GJENSTÅR. Utvid `apps/mobile/app/timer/ny.tsx:138-150` (Haversine `mobile/src/utils/geo.ts`) til å detektere byggeplass via `Byggeplass`-koordinater i tillegg til prosjekt. Krever EAS-bygg → buntes med Fase 1 mobil-verifisering over. Aldri auto-rad (`T.8:983`).
- **Web-parity TimerRadDialog — T.12 beskrivelse (ikke-blokkerende, 2026-06-20)** 🟢 — T.12 (fritekst per timer-rad, `SheetTimer.beskrivelse`) ble bygget mobil-fokusert (Slice 2, commit `a51821c3`). Web `TimerRadDialog` mangler tilsvarende felt. Feltet er nullable + tRPC-input er `.optional()` → web brekker ikke uten det. Speil mobil-mønsteret: multiline-input med `t("timer.felt.radBeskrivelse")` + visning i rad-detalj. Kort follow-up.
- **🔵 Dynamisk fler-ledds attestering/godkjenning — egen DESIGN-SESJON (plan-først, 2026-06-22)** — **Dagens ett-ledd:** timer-attesteringen er **ett godkjenningsnivå** — prosjektleder/attestant (eller firma-admin-fallback) setter `SheetTimer.attestertStatus = attestert` (`dagsseddel.ts` `attesterRader`), og ferdig attesterte timer går til lønn/ProAdm. Ingen kjede etter attestant. **Behovet:** en **konfigurerbar godkjenningskjede med dynamisk lengde** — f.eks. arbeider → (bas/)leder → regnskap/HR — der hvert firma definerer antall ledd og hvem som sitter på hvert. Kan trenge per-ledd-status, eskalering, retur til forrige ledd, og at lønn/ProAdm-eksport først trigges når **siste** ledd er godkjent. **Terminologi-presisering (CLAUDE.md, låst 2026-04-26):** dette er fler-ledds **attestering** (lønn — arbeider får betalt for registrert tid), IKKE dokumentflyt-**Godkjenning** (byggherre godtar kostnad). Hold de to domenene adskilt; en evt. felles «kjede»-abstraksjon må respektere skillet. **Avkoblet fra U-overhaulen** (U1–U3 + U-flyt rører ikke godkjenningsnivåer). Egen plan-først-sesjon: kartlegg dagens `attestertStatus`-modell + `erProsjektLeder`/kapabilitets-felter (`kanAttestere`) + `ProjectMember`-roller før schema-skisse.

  **Kandidat-tilnærming (evalueres i design-økten — ikke besluttet):** *gjenbruk dokumentflyt-flyt-motoren for timer-attestering* i stedet for å bygge en ny kjede-mekanikk. Dokumentflyt har allerede en konfigurerbar fler-ledds flyt (eier/mottaker, flytregler, godkjenner-roller) — en moden motor for nettopp «dynamisk lengde + per-ledd-godkjenning». **To spenninger som må løses før dette er levedyktig:**
  - **(1) Attestering ≠ Godkjenning (låst 2026-04-26):** dokumentflyt-motoren er bygd for **Godkjenning** (byggherre godtar kostnad). Å kjøre lønns-**attestering** gjennom samme motor må ikke blande domenene — `DokumentflytMedlem.rolle="godkjenner"` er korrekt dokumentflyt-bruk, ikke timer. En felles motor må holde de to flyt-*typene* logisk adskilt (ulik semantikk, ulike sluttkonsekvenser: lønn vs. kostnadsgodkjenning).
  - **(2) Firma- vs prosjekt-isolasjon:** dokumentflyt er **prosjekt-scoped** (per-prosjekt faggrupper/flyt); timer er **firmamodul** (`organizationId`-isolert, to-produkt-modellen). En prosjekt-koblet motor passer ikke direkte på en firma-isolert attesteringskjede.

  **Design-spørsmål:** **generisk flyt-motor** (abstrahert ut av dokumentflyt, brukbar av både prosjekt-Godkjenning og firma-attestering) **vs. prosjekt-koblet motor** (timer kan ikke gjenbruke direkte → egen mekanikk likevel). **Verifiser dokumentflyt-modellens koblinger først** (hvor hardt er motoren bundet til `projectId`/faggruppe?) før tilnærmingen velges.

  Relatert: [dokumentflyt.md](dokumentflyt.md) (eier/mottaker, flytregler, redigerbarhet), [forretningslogikk.md](forretningslogikk.md), `project_dokumentflyt_roller` (Bestiller≠Godkjenner), `project_dokumentflyt_typer` (fri flyt vs godkjenningsflyt). Ingen kode før design besluttet.

### Doc-drift (timer) — ✅ LØST 2026-06-21

Fra redesign-screening 2026-06-20. Reconciliert timer.md mot faktisk kode.

- ~~**DRIFT-1 — `timer.md:124` PR 2C-status**~~ ✅ Splittet ferdig (per-rad projectId/fraTid/tilTid + timerSync + screens, T7-3b1/T4) vs genuint åpent (`dagsseddel_local.project_id` `.notNull()` + byggeplassId/attestert-felter + NOT NULL + backfill). Status 🔴→🟡.
- ~~**DRIFT-2 — `timer.md:300-366` UX-skisse pre-T.1**~~ ✅ Skrevet om til T.7 per-rad-modell (prosjekt per rad, prosjekt+ECO-gruppert visning).
- ~~**DRIFT-3 — fritekstsøk udokumentert**~~ ✅ Ny subseksjon «Fritekstsøk på velgere» i timer.md (lønnsart/aktivitet/ECO/utstyr nr+navn, terskel > 7).
- ~~**DRIFT-4 — `timer-input-katalog.md` tom plassholder**~~ ✅ SLETTET 2026-06-21 (2 innkommende lenker repointet til timer.md; spec bor kanonisk i timer.md § Datamodell).
- ~~**DRIFT-5 — auto-fordeling T.9-droppet vs OPPSUMMERING**~~ ✅ timer.md klargjort: ingen fordelingsmotor i manuell flyt (T.9 droppet = fasit); eneste Timelønn/Overtid-split skjer i auto-utkast (Slice 3 `genererForslag`). OPPSUMMERING er ikke-registrert arbeidsdok (egen lenke-reconciliering per STATUS).

### BUG-1 — StartSluttDagKort mangler maks-varighet-vakt / auto-utsjekk 🟡

`StartSluttDagKort`-flyten har ingen maks-varighet-vakt eller auto-utsjekk (jf. 12t-presedensen for innsjekk). Glemt «Slutt dag» → urealistisk arbeidstid (165.57 t observert på skjerm 1 i screening 2026-06-20: «Start dag» 13. juni, «Slutt dag» trykket ~7 dager senere → 168 t brutto). Manuell rad-redigering *har* vakt (`ArbeidstidSeksjon.tsx:143` `diffMin<=0`) og `arbeidstidTimer` klamrer `Math.max(0,…)` (`[id].tsx`), men auto-flyt-vakten mangler. Fiks: maks-varighet/auto-utsjekk i «Start dag»-økt-flyten.

### Slice 3 — auto-utkast MVP (auto-generer draft ved «Slutt dag») ✅ DEVELOP 2026-06-20 (`a79a8fae`)

Mål = v2-mockup (låst 2026-06-20). Forankret i BESLUTNING 1 = Alternativ B (auto-utkast + innsendings-godkjenning, jf. `fase-0` T.8-revisjon over). Ved «Slutt dag» auto-genereres en **draft**-dagsseddel på valgt prosjekt med arbeidstid + reise, med **auto-fyll-banner** og **reise som egen rad**. Arbeider korrigerer + sender (draft→sent = godkjenning). Synlighets-fiks (UX-1) er allerede levert. Senere utvidelser: maskin + multi-prosjekt-auto-deteksjon (krever byggeplass-GPS L2). Ingen kode før beslutnings-detaljene er låst per mockup.

**Innsnevring (verifisert mot kode 2026-06-20):** Selve auto-genereringen er **allerede bygget** — `genererForslag` (`apps/mobile/src/components/StartSluttDagKort.tsx`, fra «Start dag/Slutt dag»-MVP 2026-06-06 + R4; per 4a delt i `genererForslag` + `opprettDagsseddelForSegment`) lager draft på Haversine-prosjekt med arbeidstid (= total − reise, splittet Timelønn/Overtid 50%) + reise-rad (egen lønnsart via `OrganizationSetting.reiseLonnsartId`, navne-match-fallback, gated på terskel + identifisert oppmøtested). Slice 3 sin gjenstående kode er derfor kun **UX-signallaget**: (1) auto-fyll-banner, (2) auto-markør (skille auto-draft fra manuell `ny.tsx`-draft), (3) reise-rad-merking.

**Idempotens (LÅST 2026-06-20, Alt 1):** ved «Slutt dag» — finnes allerede en draft for `(userId, dato)` → naviger til den eksisterende i stedet for å lage ny. Begrunnelse: server håndhever `@@unique([userId, dato])` på `DailySheet` (`db-timer/schema.prisma:164`), så «alltid ny» ville gitt sync-konflikt og «merge» dobbelttellings-risiko. Alt 1 respekterer modellen, unngår duplikat + dobbel-lønn, enklest. *(`@@unique([userId, dato])` per 2026-06-21 på `db-timer/schema.prisma:172` — flyttet av Slice 4b-2 `sluttTidKilde`.)*
- **Edge case (akseptabel MVP-tradeoff):** er den eksisterende draften tom (manuelt opprettet, ingen rader), åpnes den uten auto-fyll → arbeider mister auto-genereringen i det sjeldne tilfellet. Greit for MVP. «Auto-fyll tom eksisterende draft» (skriv auto-rader inn i tom draft) er en mulig senere forfining.

### Slice 4 — dag-grense + nattskift + glemt-dag + system-flagg + arbeidstids-varsel ✅ DEPLOYET TIL PROD 2026-06-21 (server; mobil via EAS)

> **Server-deler (migreringer + web-attestering-badges + admin-UI) DEPLOYET TIL PROD 2026-06-21** (prod-merge `32b88bd7`) — arkivert i [historikk-2026-06.md § Slice 1–4 + reisetid R1–R4 + GPS L1](historikk-2026-06.md). **Mobil-delene (auto-utkast, midnatt-splitt, glemt-dag-prompt, badges) er IKKE på arbeidernes telefoner** — krever EAS prod-bygg etter enhetstest (gate, se § Følgesaker etter prod-deploy). Detalj-spec under beholdt for referanse.

> **Slice 4a — midnatt-splitt ✅ DEVELOP 2026-06-20.** Mobil-lokalt, ingen migrering. `genererForslag` (`StartSluttDagKort.tsx`) refaktorert til per-segment via ren `splittVedMidnatt`-helper (`utils/dagsegment.ts`): skift som krysser 00:00 → én draft per kalenderdag, timer summerer til reell total (verifisert: 19:00→07:00 = 5t+7t=12t). **Låst:** pause + reise kun på start-dagen (1a), per-dag Timelønn/Overtid-split beholdt (2), «delt ved midnatt»-merking (lokal nullable `dagsseddel_local.delt_ved_midnatt`, idempotent ALTER) + badge på review-skjerm (`timer.deltMidnatt.*`, 15 språk). Idempotens per dag (eksisterende `(userId,dato)`-sedel beholdes, øvrige opprettes), naviger til start-dagens sedel.
> - **Kjent luke (→ Lag 2/4b):** en glemt «Slutt dag» over flere døgn over-splittes (3 dager → 4 sedler à ~24t). Lag 2 glemt-dag-prompt fanger dette. Inntil 4b: akseptabel (bedre enn dagens ene 72t-sedel; per-dag-tallene er i det minste avgrenset).

**Sub-split (vedtatt 2026-06-20):**
- **4b-1 — Lag 2 glemt-dag-prompt ✅ DEVELOP 2026-06-20.** Mobil-lokalt, ingen migrering. `StartSluttDagKort`: åpen `arbeidsdag_local` med start-dato < i dag → amber-prompt «Glemte du å avslutte?» med «Jeg glemte å avslutte» (gjenoppretting: estimer slutt = firma `standardSluttTid` på start-dagen, `utforSluttDag(overstyrtSluttIso)` uten GPS-ved-slutt → draft arbeider korrigerer) / «Jeg jobber fortsatt» (behold åpen, vis normal «Slutt dag»). Fanger BUG-1 + 4a over-splitt-luken. i18n `timer.glemtDag.*` (15 språk). `sluttTidKilde="system"`-merking påføres i 4b-2.
- **4b-2 — Lag 3 (`sluttTidKilde`) + arbeidstids-varsel ✅ DEVELOP/TEST 2026-06-21 (migrering anvendt + verifisert på `sitedoc_test`):** to additive migreringer anvendt + verifisert 2026-06-21 — `slutt_tid_kilde` (NOT NULL DEFAULT 'bruker') på `timer.daily_sheets` + `arbeidstid_varsel_timer` (NOT NULL DEFAULT 13) på `organization_settings`; gaten traff `sitedoc_test`, begge migreringer «applied», 12/12 rader backfill (0 berørt), upload-regresjon 401 (web-port OK). Ikke prod. to additive migreringer (`db-timer DailySheet.sluttTidKilde @default("bruker")` + `db OrganizationSetting.arbeidstidVarselTimer @default(13)`). Server: felt i `opprett`/`oppdater`/`syncBatch`/`hentEndringerSiden`/`hentForAttestering` + `organisasjon.oppdaterSetting`/`hentSetting`/`hentArbeidstidDefaults`. Mobil: lokal kolonne `dagsseddel_local.slutt_tid_kilde` + ALTER + sync (push/pull) + set-semantikk (`opprettDagsseddelForSegment`: ikke-siste→`"midnatt"`, siste→`"bruker"`/`"system"` via threaded param; reset `"bruker"` ved redigering i `ArbeidstidSeksjon`). Smartere natt-estimat i `gjenopprettGlemtDag` (standardSluttTid ≤ start → start+dagsnorm, `"system"`). Badges (web `AttesteringDetalj` + mobil `AttesteringDetaljMobil`): kontroll-badge ved `sluttTidKilde==="system"` + arbeidstids-varsel når `sum(timer-rader inkl. reise) > arbeidstidVarselTimer` (varsel, ikke blokkering). Admin-UI: terskel-felt i `firma/innstillinger`. i18n 4 nøkler × 15 språk. Typecheck: 0 nye feil. **Gjenstår (ikke-blokkerende):** arbeider-review arbeidstids-badge (eget punkt under) + mobil-distribusjon via EAS. Prod ikke deployet.

**Følgesaker fra Slice 4 (ikke startet):**
- **Arbeider-review arbeidstids-badge (tidlig-varsel) 🟡** — 4b-2 viser arbeidstids-varsel kun i *attestering* (leder-siden). Arbeider bør se samme varsel på review-skjermen (`apps/mobile/app/timer/[id].tsx`) FØR innsending, så lange dager fanges tidlig. Krever `arbeidstidVarselTimer` i mobil-cache (`organizationSettingKatalog` + `organisasjon.hentArbeidstidDefaults`-select — terskelen er ikke cachet i dag) + samme `sum(timer-rader inkl. reise) > terskel`-beregning som attestering. Varsel, ikke blokkering.
- **Arbeider-review system-slutt-badge 🟢 (valgfri)** — tilsvarende «delt ved midnatt»-mønsteret kan en `sluttTidKilde==="system"`-merking vises på arbeider-review (lokal kolonne finnes alt). Lav prio — gjenopprettings-flyten leder arbeider rett til draften uansett.
  - **Edge case fra 4b-1 å håndtere smartere i 4b-2:** glemt-dag-gjenopprettingen estimerer slutt = `standardSluttTid` på start-dagen. Var det egentlig et **nattskift** (start sent på kvelden, `standardSluttTid` < `startAt`) gir estimatet en 0-times draft. 4b-2 bør (a) detektere dette og estimere smartere (f.eks. start + dagsnorm, eller standardSluttTid på NESTE dag → midnatt-splitt), og (b) uansett merke gjenopprettings-slutten `sluttTidKilde="system"` så attestant ser at tiden er gjettet og må sjekkes.

**Låste design-punkter (2026-06-20):** (1) `sluttTidKilde`: midnatt-grense→`"midnatt"` (ingen badge), «Slutt dag»-trykk/manuell→`"bruker"`, glemt-dag-gjenoppretting/maks-varighet→`"system"` (kontroll-badge). (2) Arbeidstids-terskel teller **alle timer-rader inkl. reise** per dagsseddel (kompensert reise = arbeidstid → mer AML-riktig + konservativt). (3) Glemt-dag-gjenoppretting bruker estimert slutt = firma `standardSluttTid` (arbeider korrigerer). (4) Terskel = `Int` (13 default / 16 tariff via samme felt); admin-redigerings-UI = liten følgesak.

Større slice enn 1–3: krever **én server-migrering (gated)** + split-logikk + gjenopprettings-prompt + attesterings-badge → eget bygg i frisk økt. Bygger på Slice 3 («Start/Slutt dag»-flyten + `genererForslag`). Forankret i AML **§ 10-6** (alminnelig/utvidet arbeidstid: 13 t varsel-default, 16 t ved tariff) + **§ 10-8** (11 t døgnhvile). **Prinsipp:** SiteDoc *flagger + registrerer* — juridisk ansvar for arbeidstidsgrenser ligger hos firmaets HMS, ikke i appen.

**Lag 1 — midnatt-SPLITT (ikke klemming):** et skift som krysser 00:00 deles i **én dagsseddel per kalenderdag**; timene summerer til reell total (12 t nattskift fra 19:00 → 5 t på dag 1 + 7 t på dag 2). Ikke klem til én dag, ikke kutt på midnatt-totalen. Reise føres på **start-dagen**. Overtid/tariff-behandling av nattetimene er **regnskaps-scope** (lønnsart-grensen — SiteDoc registrerer rådata, regnskap eier satser/kobling).

**Lag 2 — glemt-dag vs. nattskift (gjenopprettings-prompt):** ved «Start dag» / app-åpning, hvis en arbeidsdag fra en **tidligere dato** fortsatt er åpen (`arbeidsdag_local.status="paagaar"`) → spør arbeider: **«Jobber du fortsatt, eller glemte du å avslutte i går?»**. «Jobber fortsatt» → behold åpen (ekte nattskift/lang vakt → Lag 1 splitt ved avslutning). «Glemte å avslutte» → la arbeider sette riktig slutt-tid (system-flagg, Lag 3). Erstatter dagens manglende maks-varighet-vakt (jf. BUG-1: 165 t fra glemt «Slutt dag»).

**Lag 3 — system-flagg på slutt-tid:** nytt server-felt **`DailySheet.sluttTidKilde: "bruker" | "system" | "midnatt"`** (Prisma-migrering i `db-timer`, **gated** + `/sitedoc_test` foran). Tre verdier (vedtatt 2026-06-20) så **legitim midnatt-splitt ikke utløser kontroll-badge**: `"midnatt"` = start-segmentets `endAt` er en automatisk dag-grense (Slice 4a) — normalt, ingen badge; `"system"` = slutt-tiden er system-*gjettet* (glemt-dag-gjenoppretting/maks-varighet-klamp) → **kontroll-badge i attestering** (ikke arbeider-bekreftet); `"bruker"` = arbeider satte/bekreftet tiden. Settes til `"bruker"` ved **eksplisitt redigering** (nullstiller system/midnatt). Det lokale 4a-feltet `delt_ved_midnatt` mappes til `"midnatt"` på start-segmentet når 4b lander. Speiler 12 t auto-utsjekk-presedensen (`MannskapsInnsjekk.autoUtlogget`, mannskap.md) for timer-domenet.

**Arbeidstids-varsel (samme badge-mekanisme):** ny `OrganizationSetting`-terskel (**default 13 t**, firma kan heve til **16 t** ved tariff). Overskrides **total av alle timer-rader (inkl. reise) på en dagsseddel** terskelen (vedtatt 2026-06-20: inkluder reise — kompensert reise er arbeidstid, og det er konservativt for varsel) → **varsel, ikke blokkering** (arbeider kan fortsatt sende; utførelse låses aldri bak dette). Per kalenderdag/dagsseddel (et midnatt-splittet nattskift trigger normalt ikke siden hver dag < terskel; ekte AML-«døgn» = utenfor MVP). Samme badge i attestering så attestant/HMS ser flagget. To-stegs-migrerings-policy gjelder for både `sluttTidKilde` og terskel-feltet.

**Avhengigheter/rekkefølge:** Lag 1+2 er mobil-lokalt (kan bygges uten server-migrering om system-flagget utsettes), men Lag 3 + arbeidstids-varsel krever server-migreringen → mest sammenhengende å ta hele Slice 4 som ett bygg med migrerings-OK i forkant. Berører `StartSluttDagKort.tsx` (gjenopprettings-prompt + splitt), `genererForslag` (per-dag-splitt), `db-timer/schema.prisma` (`sluttTidKilde` + terskel på `OrganizationSetting`), attestering-UI (badge), mobil-cache (terskel). Modul-avhengighets-regelen: verifiser mot [timer.md](timer.md) + [mannskap.md](mannskap.md) (auto-utsjekk-presedens) før koding.

### Byggeplass-ankomst → HMS mannskaps-register (byggherreforskriften §15) 🟡

Når 1c-mobil bygges (byggeplass-GPS-ankomst), skal ankomst-innlogging mate HMS/PSI-mannskaps-oversikten (§15, lovpålagt) som **PRIMÆR** formål. HMS-compliance, ikke produktivitets-sporing → sterkere personvern-grunnlag enn reisetid. Reisetid (R4) er sekundær avledning. Kobling: 1c-mobil (ankomst-deteksjon) + [mannskap.md](mannskap.md) (§15-tilstedeværelse, fra/til firma-isolert). Design: ankomst-event → PSI-presence + HMS-register.

### Reise (Fase 3) — forbedringer etter MVP

Tre idéer fanget 2026-06-09 etter at Fase 3 reise-MVP (estimat ×50 km/t, avvik C) ble implementert på develop/test. Distinkt fra §G3-punktet (`:554` — som gjelder *policy-bekreftelse* av terskel/lovlighet hos A.Markussen/regnskap/jurist). Disse er *byggbare forbedringer* av selve reisetid-utledningen.

- **Reisetid-matrise: Google-kjøretid kontor×byggeplass (ANBEFALT — Kenneth: bør implementeres 2026-06-09)** 🟡 — Forhåndsberegn [oppmøtested × byggeplass] kjøretid via Google Directions ved georeferanse-oppsett (byggeplass-koordinater fra Fase 1c). Per tur blir et rent oppslag: GPS-identifisert kontor → byggeplass → ferdig reisetid, offline-cachet, håndterer fler-kontor-firma. **Erstatter estimat-MVP (×50 km/t, avvik C)** med faktisk kjøretid. Recompute toveis ved samme invalidering som 1c i `tegning.settGeoReferanse`: byggeplass-georef endres → recompute den raden; oppmøtested legges til/flyttes → recompute den kolonnen. Google-nøkkel brukes KUN ved oppsett (ikke per registrering). Fallback: ikke-registrert startsted → estimat/ingen reisetid. Ny matrise-tabell (oppmotestedId × byggeplassId → minutter) + mobil-cache.

- **Per-prosjekt reisetid-berettigelse-flagg** 🟡 — `Project.reisetidBerettiget` (boolean), satt ved prosjekt-opprettelse, gate for om reisetid i det hele tatt gjelder prosjektet. Kombineres med terskelen: reisetid foreslås kun når prosjektet er berettiget OG reisetid > terskel. Lar firma skru av reise-forslag på nær-/by-prosjekter uten å rote til terskel-regelen.

- **Kontinuerlig GPS-logging for faktisk reisetid — NEDGRADERT, KREVER PERSONVERN-VURDERING** 🔴 (lavest prio, notert for fullstendighet) — App logger GPS kontinuerlig (midlertidig under reise) for *målt* reisetid (ankomst − avreise) i stedet for estimat. **To grunner til at dette IKKE bygges:** (1) **Sporing av ansatte er regulert** (GDPR + arbeidsmiljølov, Datatilsynets praksis om lokasjonssporing) — bygges ikke uten personvern-/juridisk vurdering. (2) **Læring (R4, 2026-06-11): et observert ankomst−avreise-delta er ikke ren reisetid** — det inkluderer arbeids-stopp underveis, så det måler feil størrelse. R4-modellen er autoritativ i stedet: matrise-kjøretid = reisetid; `arbeidstimer = total − reisetid` håndterer arbeids-stopp korrekt som arbeidstid. Reisetid-matrisen gir altså både nøyaktighet UTEN sporing OG riktig begrep — denne entryen er derfor nedgradert til kun-for-fullstendighet.

- **Matrise-trigger ved prosjekt-koordinat (fallback-luke, lav prioritet)** 🟢 — Byggeplass som kun bruker `Project.latitude/longitude`-fallback (uten georeferert tegning) får ingen auto-recompute ved opprettelse; ingen trigger fyrer på prosjekt-koordinat. Dekkes i dag av «beregn matrise»-knappen + graceful estimat-fallback i oppslaget. Fiks når ønsket: trigger `recomputeRadForByggeplass` når `Project.latitude/longitude` settes/endres, for prosjektets byggeplasser. Normal-flyt (georeferering → `oppdaterByggeplassGeofence`) er allerede dekket av R3.

- **Matrise-viewer + uoppnåelig-surfacing (drøftet R3, utsatt 2026-06-11)** 🟢 — reisetid-matrisen er i dag en black box: «beregn» gir kun «X rader beregnet», ingen måte å SE radene (kontor→byggeplass-tider, særlig -1/veiløse par som trenger koordinat-sjekk, og mistenkelig like/store tider). To nivåer: (a) **LETT:** la `recomputeMatrise` returnere antall uoppnåelige → «X beregnet, Y uoppnåelige» i knapp-resultatet (~5 linjer, fanger sikkerhetssignalet). (b) **FULL:** read-only tabell kontor × byggeplass → minutter (-1 markert) i Reise-seksjonen. Vurdering: full viewer er smal admin-diagnostikk (gull-plating nå) → vurder under IA/innstillinger-restruktureringen. (a) kan gjøres når som helst hvis -1-synlighet ønskes. Kontekst: reisetid er justerbart forslag (feil verdi ikke kritisk), men -1 = ingen forslag, og firmaet bør vite hvilke par som mangler.

- **R4-avhengighet av `bygning`-router-alias (back-compat-flagg, lav prioritet)** 🟡 — R4 mobil-cache henter byggeplasser via `klient.bygning.hentForFirma` (`apps/mobile/src/services/byggeplassKatalog.ts:29`). `bygning` er kun en bakoverkompatibel alias for `byggeplassRouter` i `apps/api/src/trpc/router.ts:53`, merket «1 uke». **Fjernes aliaset, brytes R4s byggeplass-fetch** (matrise-oppslaget på mobil mister byggeplass-koblingen). Avklar om `bygning`-nøkkelen skal være permanent; hvis ikke, flytt R4-kallet (og evt. andre konsumenter) til den kanoniske router-nøkkelen FØR aliaset fjernes. Funnet under R4-verifisering 2026-06-12.

### Attestering-liste — expanded inline-visning (oppdaget 2026-05-16)

Attestering-listen viser kun rad-antall, ikke innhold. Prosjektleder
må åpne enkelt-sedel for å verifisere timeføring.

Ønsket: alle registreringer synlige inline + redigering tilgjengelig
direkte fra listen.

- Alternativ A: expandable rader (default expanded).
- Alternativ B: to-panel-visning (liste + detalj side om side).

### Onboarding og brukerveileder

- **Onboarding-veileder (forutsetning for A.Markussen)** 🟡 — Runde 1 (a)+(b)+(c) deployet til prod 2026-05-02. Resterende: full guidet flyt for ny bruker. Se [onboarding-veileder.md](onboarding-veileder.md).
- **Prosjektoppsett-veileder** 🟡 — steg-for-steg ny bruker etter prosjektopprettelse. Se [prosjektoppsett-veileder.md](prosjektoppsett-veileder.md).
- **Testbrukere i test-DB** 🔴 — Ola Tømrer (worker), Per Prosjektadmin, Kari Firmaadmin, Tore SiteDocAdmin. Planlagt etter Timer er ferdig.

### Søk og mobil

- **Adaptivt søk for sjekklister/oppgaver/HMS/RUH** 🔴 — krever kode-utforskning. Se [adaptiv-sok-plan.md](adaptiv-sok-plan.md).
- **Dokumentflyt mobil** 🔴 — finner ikke arbeidsforløp (bruker-basert vs entreprise-basert matching).
- ~~**Oppgave-mobil rettighetsoppfølger**~~ ✅ DEPLOYET TIL PROD 2026-05-29 (prod-merge `526db462`, impl `32dd43ac`). `apps/mobile/app/oppgave/[id].tsx` får nå `rettighetInput` ved kall til `useOppgaveSkjema` — speil av sjekkliste-mønster fra `60601d3c`. Aktiveres på mobil ved neste EAS-bygg + TestFlight/Play Store-distribusjon.

## 3. Fremtidige faser

Detaljert plan: [arkitektur-syntese.md § 5](arkitektur-syntese.md).
Beslutningsgrunnlag: [fase-0-beslutninger.md](fase-0-beslutninger.md).
Aktiv Fase: 0 (firma-fundament) er i hovedsak ferdig — gjenstående §-E-steg dokumentert der.

### Fase 0.5 — Byggeplass + Avdeling-fundament

- To åpne arkitektur-prinsipper besluttes (default-byggeplass, FK vs jsonb) per [byggeplass-strategi.md](byggeplass-strategi.md). NULL = «hele prosjektet» allerede vedtatt (A.30).
- `ByggeplassMedlemskap` (loan-pattern: User → Byggeplass over tid)
- Drop `building_ids` jsonb fra `project_groups` — erstattes av m2m-koblingstabell
- `Avdeling`-tabell i `packages/db` (kjernen)
- `User.avdelingId` valgfri
- Forbered byggeplassId-felt på fremtidige Timer/Mannskap/Varelager-modeller

### Fase 1 — Maskin med modul-gateway (under bygging)

- Refaktor maskin-rutene til `modulProcedure('maskin')` — må gjøres før prod-deploy
- `EquipmentChecklist` + `EquipmentChecklistTemplate` i `db-maskin`
- UI for maskin-sjekkliste på maskin-detalj-side
- Manuell trigger fra maskinregister (auto-trigger fra service-varsel utsettes til Fase 7)

### Fase 2 — Mal-promotering

- `OrganizationTemplate` + `ReportTemplate.organizationTemplateId`
- UI for «Send til firmabibliotek»
- «Start fra firma-mal»-valg ved opprettelse

### Fase 3 — Timer-modul (inkluderer Kompetanseregister)

- Lønnsarter, arbeidstidskalender (delvis startet via T9-bunken), dagsseddel med byggeplassId fra dag 1
- Underprosjekt (Proadm-import eller SiteDoc Godkjenning)
- Steg 4c — Godkjenning UI (parkert 2026-05-03, venter på A.Markussen-input / ProAdm API)

### Fase 4 — PSI-utvidelse + mannskaps-vy

- Innsjekk/utsjekk-mekanikk
- Mannskaps-vy aggregerer PSI-tilstedeværelses-data per byggeplass
- §15-liste-eksport, HMS-kort-validering, geofence-innsjekk
- `eksternSystem`-felt på Psi
- 12t auto-utsjekk
- **HMS-tilgang for arbeidsgiver på andres prosjekter (juridisk gap A.27)** — løses her per [fase-0-beslutninger.md](fase-0-beslutninger.md).

### Fase 5 — Varelager-modul

- Goods, GoodsCategory, GoodsLocation
- Vareforbruk på dagsseddel (kobler til Timer-modul)
- Saldo-håndtering
- Strekkode-skanning (mobil)

### Fase 6 — Avansert

- DO-kobling (Kompetanse ↔ Equipment-validering)
- AI-ukeplan (Timer + Mannskap + Maskin)
- Strekkode-skanning utvidelser

### Fase 7 — Prosjekthotell-utvidelser (parallelt spor)

- Møtemal (ny dokumenttype)
- Månedsrapport (auto-aggregering)
- HMS-statistikk på firma-nivå
- Street View for byggeplass (eget prosjekt)
- Auto-trigger maskin-sjekkliste fra service-varsel (forutsetter Varsling-modul)

### Etter Fase 1 + Fase 3

- **Aktivitetsfeed på dashboard** — bruker eksisterende Activity-tabell, polling via tRPC, konfigurerbar periode (default 10 dager) + hendelsestyper + GDPR-retensjon i `OrganizationSetting`. Ekstern partner-feed-scope krever egen designrunde. Se [aktivitetsfeed.md](aktivitetsfeed.md).

### Konfigurerbare statuser per flyt (lav prioritet)

**Idé 2026-05-25.** Tillat at hver dokumentflyt (eller dokumenttype-mal) aktiverer kun et subset av tilgjengelige statuser. Konfigureres i mal-byggeren for sjekklister/oppgaver — en enkel flyt kan eks. ha kun `draft → sent → responded → approved`, mens en kompleks flyt har hele matrisen (`in_progress`, `rejected`, mellomtrinn osv.).

**Konsekvens for send-modal-redesign:** Popup'en med tilgjengelige statuser per boks filtreres på flyt-konfigurasjon i tillegg til rolle-tilgang. Færre status-knapper å vise — enklere for brukeren.

**Konfigurasjonssted:** Mal-bygger-UI ([MALBYGGER.md](../../MALBYGGER.md)). Eksisterende mal-konfigurasjon utvides med status-toggle-matrise. Mest sannsynlig per dokumenttype-mal, ikke per enkelt dokumentflyt.

**Avhengighet:** Krever migrering — ny `ReportTemplate.tilgjengeligeStatuser: Json` (eller `OrganizationTemplate.tilgjengeligeStatuser` når Fase 2 mal-promotering lander). Default = alle statuser aktive (bakover-kompat).

**Lav prioritet:** Vurder etter dokumentflyt send-modal-redesignen er deployet og i bruk. Sjelden at kunder spør om dette — eksisterende standard-flyt dekker de fleste tilfeller.

### Tverrgående

- **Firma-nivå tilgangskontrolloversikt** 🔴 — firma-admin skal kunne se en samlet oversikt over hvem som har hvilke roller og tilganger i firmaet, i ett strukturert UI. I dag finnes data spredt (User.role, OrganizationMember.firmaRoller, ProjectMember.role + kapabiliteter, OrganizationMember.firmaansvarlig, ProjectGroup-medlemskap, modul-tilganger). Ingen sentralisert visning. Skal designes fra bunnen — IKKE kopiert eller portert fra Tromsø Salsaklubb-prosjektet (annet domene, annen tilgangsmodell). Del av planlagt UX-sesjon for firma-innstillinger + tilgangsoversikt (se rapport 2026-05-28). Krever: (1) skisse av visnings-struktur (matrise person × tilgang? person × rolle med expand? rolle × tildelte personer?), (2) avklaring av om dette skal være lese-bare oversikt eller redigerbart kontrollpanel, (3) hvilke roller/tilganger som er relevante å vise (kjerne-roller, kapabiliteter, firma-roller, prosjekt-roller, modul-tilganger). Estimat 6-10t etter spec-runde.
- **Superadmin-oversikt over firma-moduler** 🔴 — fakturerings-orientert. Egen feature-sesjon.
- **Vis som bruker (impersonering)** 🟡 — DEPLOYET TIL PROD 2026-05-28 (audit-log prod-merge `30467d74`). Schema, 3 server-prosedyrer, context-håndtering, UI, i18n, `utloperVed`-fix, persistent `ImpersonationAudit`-spor (Variant B) — alt på plass. **Gjenstående:** Lese-prosedyre + UI for audit-loggen — venter på tilgangs-oversikt-UX-sesjon. Audit-log-PR arkivert til [historikk-2026-05.md § Impersonering audit-log](historikk-2026-05.md).
- **Import-modul (HR-data)** 🔴 — datainfrastruktur, mater Timer med ansattnummer, hmsKortNr osv.
- **AI-integrasjon** 🔴 — Copilot plugin, MCP server, innebygd assistent. Se [ai-integrasjon.md](ai-integrasjon.md).
- **Fremdriftsplanlegger** 🔴 — ressursplanlegging, kompetanse, bemanning, forslag-motor. Etter timer+maskin+HR. Se [planlegger.md](planlegger.md).
- **AI-drevet ukeplan** 🔴 — utvidelse av planlegger Fase 4.
- **Dokumentsøk + OCR plan** 🟡 — OCR-fallback, dokumentasjon per post (splitting).
- **NS 3420 kontrollmaler** 🔴 — auto-genererte sjekklistemaler fra NS 3420 via OCR/søkemotor.
- **Cross-prosjekt-deling** ❓ — UE med eget prosjekt deler sjekklister til hovedentreprenør. Flere tilnærminger drøftes.

## 4. Kundeønsker ikke startet (A.Markussen)

Liste mottatt 2026-05-06. Se også [STATUS-AKTUELT.md § Kundeønsker](STATUS-AKTUELT.md).

- **#1 Sjekkliste for service koblet til timetall og status** 🟡 — DB-feltet `nesteServiceTimer` finnes i `packages/db-maskin/prisma/schema.prisma:188`. Mangler UI på maskin-detaljside + serviceintervall-konfigurasjon + sjekkliste med automatisk oppdatering.
- **#5 Registrering av HMS-gruppe på brukere** ⏸️ — parkert.
- **#7 Rettighetsmatrise med rolle-styring (Prosjektleder + Bas)** 🔴 — ny rolle-modell + matrise-UI. Eksisterende roller dekker ikke `Prosjektleder`/`Bas` som DB-roller.
- **#9 Justeringer på SJA (signatur/lesetilgang/deltaker)** 🔴 — utvidet sjekkliste-mekanikk: re-signaturforespørsel, auto-lesetilgang for prosjektmedlemmer, selv-påmelding som deltaker.
- **#10 «Flere personer»-feltet på SJA — definere hvem som er valgbare** 🔴 — felt-konfigurasjon for å begrense valgbare personer per SJA-mal.
- **#11 Pushvarsel/SMS til ansattliste** 🔴 — ny varslingstjeneste (SMS-leverandør-integrasjon), målgruppe-velger, kostnadsavklaring.

## Vedlikehold

Når en oppgave startes: flytt linje til [STATUS-AKTUELT.md § Pågående
arbeid](STATUS-AKTUELT.md). Når oppgaven er prod-deployet: flytt videre
til `historikk-YYYY-MM.md`. Se også [DOC-MAP.md](DOC-MAP.md) og
[CLAUDE.md § Dokumentasjons-regler](../../CLAUDE.md).
