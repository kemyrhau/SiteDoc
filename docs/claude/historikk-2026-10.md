---
name: historikk-2026-10
description: Arkiv av deployete PR-er/saker fra oktober 2026. Flyttet hit fra STATUS-AKTUELT ved DEPLOYET TIL PROD.
sist_verifisert_mot_kode: 2026-10-07
---

# Historikk oktober 2026

## Prod-deploy 2026-10-07 runde 2 (`ec35181d`, develop→main) — frys etter «+ Oppgave» + flere oppgaver pr. felt (LIVE)

Release-commit `ec35181d` på `main`, bygget 13:39Z. **Verifisert innlogget** og på telefon.

**Innhold:** frys etter «+ Oppgave»→tilbake fikset i rotårsaken + flere oppgaver pr. felt, mobil+web (`6ec95359` ← `18ad5bc3`).

**Migreringer:** ingen.

**Mobil:** OTA prod-kanal fra `ec35181d` — update group `74576aa0-df23-4f0b-881f-ad384133a1a9`, iOS update `01a116c8-8480-7d12-b5bc-d3df23407d69`, verifisert på telefon (build 54). Rad i [eas-build-veileder.md § OTA-logg](eas-build-veileder.md).

**Ikke med:** T1 serieopplasting av tegninger (`0e50adad`) — kun på test.

## Prod-deploy 2026-10-07 runde 1 (`4f7998c7`, develop→main) — V20 pause én kilde, ansvarstekst, standardnavn, synk-status (LIVE)

Release-commit `4f7998c7` på `main`, bygget 09:21Z. **Verifisert innlogget** og på telefon.

**Innhold:** V20 pause én kilde — S `3b06dcb1` (server eier pausen, splitt bevarer bæreren), S2 `669c579b` (backfill der hodet er 0), W `d5758806` (web-avkrysning, radene eier pausen) · ansvarstekst i SiteDoc-arkivet og hent-dialogen (`039c8cd6`) · standardnavn uten kode (`40164e63`, mal-7b `eb5af56a`) · synk-statusvisning (`ea18494f`; `fix/sync-status-visning` `358c104f`).

**Migreringer kjørt mot prod `sitedoc` (2):**

| Pakke | Migrering |
|---|---|
| db-timer | `20261006220000_v20_pause_backfill` |
| db-timer | `20261007120000_v20_s2_pause_backfill` |

**Telling etter:** 9 sedler · 8 med hode>0 · Σ=0-kandidater 0 · 1 uavklart (hode 0, ingen bevist fradrag).

**Backup:** `~/backup/sitedoc-pre-release-20261007.dump`, tatt før migrering.

**SiteDoc-arkivet seedet i prod** etter [DEPLOY-RUNBOK § 8](DEPLOY-RUNBOK.md): 4 standarder / 17 kapitler / 27 maler / 402 objekter (fra 0).

**Mobil:** OTA prod-kanal fra `4f7998c7` (OTA `01a1166…`). Rad i [eas-build-veileder.md § OTA-logg](eas-build-veileder.md).

## Arkivert fra STATUS-AKTUELT 2026-10-07

Flyttet ordrett fra toppen av STATUS-AKTUELT. Alle hasher er forfedre av `ec35181d` (målt med `git merge-base --is-ancestor`: `9145404b`, `bd3053bd`, `6dd4b511` V19.9-spec, `ab86dfa4` V20-spec, `3b06dcb1`/`669c579b`/`d5758806` V20-S/S2/W). Den åpne resten av V20-innslaget (V20-M, V21, V22) står igjen i STATUS-AKTUELT. Prod-linja for `7845e9e8` er erstattet av de to nye — innholdet står i seksjonen under.

🟢 **TEST-DEPLOY 2026-10-05: `9145404b`** — `/version` verifisert (bygget 21:43). Nytt siden `bd3053bd`: **L2-C**
(attestering + eksport med reisespor), **V19-A** (overlapp-forslag på server, attestering blokkert), **V19-B** (mobil),
offline-feltfunn, offline-inngang, i18n-sveip 2. 🟢 **Migrering `20261005120000_v19_overlapp_forslag` KJØRT** —
verifisert: `timer.sheet_timer_forslag` finnes, `daily_sheets.konflikt_ventende_siden` finnes. 🟢 **OTA test-kanal
publisert** fra `9145404b` (update `01a10da3-892f-7ef3-a880-2ff57f5e7019`). V19-C (web-valg for arbeideren) ikke med ennå.
🔴 **V19.9 SPEC HOS ORKESTRATOR FOR GATE 2026-10-06** (branch `docs/design-v19-versjonssjekk`): Kenneth-vedtak 05.10 — avvik PC/telefon
skal oppdages uansett hvordan dagen ble opprettet. Versjonssjekk pr. rad i `syncBatch` (M17–M25 målt), matrise R1–R12 + S1–S4 + H1–H6,
ordre V19.9-A (server) → V19.9-B (mobil+web) → V19.9-H (hodet). Spec § 9 i `timer-overlapp-pc-mobil-spec.md`.

🟢 **V20 = B VEDTATT 2026-10-06, spec rev. 2 til gate** (branch `docs/design-pause-en-kilde`, `timer-pause-en-kilde-spec.md`): P1–P8 målt, PK1–PK9 (PK4 rev. 2: syncBatch
normaliserer, avviser aldri; kun timebaserte lønnsarter), 17 tester, ordre V20-S → V20-M ∥ V20-W etter `fix/matpause-avkrysning`. **V19.9-H STRØKET.** V21 (overtidsforslag
manuell) og V22 (prosjekt·byggeplass på raden, web-paritet) VEDTATT — egne små ordrer etter V20.

## Prod-deploy 2026-10-06 (`7845e9e8`, develop→main) — lag 2, V19/V19.9, offline-lesing, V17-A, V20 PK2 (LIVE)

Release-commit `7845e9e8` på `main`, bygget 20:16Z. **Verifisert innlogget** på sitedoc.no: prosjektliste og firma/timer laster.

**Innhold:** timer-GPS lag 2 (reisespor, sporbarhet, attestering + eksport) · V19/V19.9 overlapp PC↔mobil + versjonssjekk pr. rad · offline-lesing fase 2 og offline-liste oppgave/HMS · V17-A (byggeplass-geofence-kilde) · V20 PK2 matpause (manuell rad bærer pausen synlig) · i18n-sveip · synk-fiks.

**Migreringer kjørt mot prod `sitedoc` (8):**

| Pakke | Migrering |
|---|---|
| db-timer | `20261003120000_timer_lag2_sporbarhet` |
| db-timer | `20261005120000_v19_overlapp_forslag` |
| db-timer | `20261006120000_v19_9_forslag_grunn` |
| db | `20260924130000_maaling_i_tegning` |
| db | `20260926120000_psi_drop_stale_unik_indeks` |
| db | `20260926140000_prefiks_backfill` |
| db | `20261002120000_byggeplass_geofence_kilde` |
| db | `20261002130000_timer_normkilde_pausereferanse` |

**Forsjekk før migrering:** PSI-duplikater på prosjektnivå = 0 · backfill-telling lag 2 = 0 konfigurert / 0 navne-match. ⚠️ 2 rader på lønnsarten «Reise/transport til/fra prosjekter» i én org er **ikke** reise-merket (navnet treffer ikke backfill-mønsteret) — vises ikke som reise før lønnsarten merkes.

**Backup:** `~/backup/sitedoc-pre-release-20261006.dump` (633K, 114 tabeller), tatt før migrering.

**Mobil:** OTA prod-kanal publisert fra `7845e9e8`, verifisert på telefon (build 54, OTA `01a1130`). Rad i [eas-build-veileder.md § OTA-logg](eas-build-veileder.md).

**Ikke med:** `fix/sync-status-visning` (`358c104f`) og spec-en for tegning-serieopplasting — merget til develop etter release-commiten.

## Arkivert fra STATUS-AKTUELT 2026-10-06

Innslagene under er flyttet ordrett. **Alle merge-/leveranse-hasher i dem er forfedre av `7845e9e8`** (målt med `git merge-base --is-ancestor`); de fem som ikke er det, er sidehenvisninger til stoppede eller erstattede branch-hasher (`b1818339`, `36539f74`, `adfe0596`, `2e7f5434`, `de182bd2`) — innholdet de gjelder, er i prod via andre hasher. Mange av innslagene var allerede i prod fra tidligere releaser (`af0093b8`, `39e14648`, `858f5c45`, `eb9071f2`) og skulle vært arkivert da. Åpne restanser er høstet til [STATUS-AKTUELT § Åpne gater og restanser](STATUS-AKTUELT.md).

## Arkivert: Test-deploy-linjer fra toppen av STATUS-AKTUELT (begge test-hasher er forfedre av `7845e9e8`)

> 🟢 **TEST-DEPLOY 2026-10-04: `bd3053bd`** — verifisert mot `/version` (bygget 18:56). Inneholder **L2-A + L2-B**
> (reise-spor, V1 på server, V8-vindu, pull bærer sporet, B4 manuell), **offline-liste oppgave/HMS**, **offline-lesing
> fase 2**, **i18n-sveip 1** og **V17-A**. 🟢 **Migrering `20261003120000_timer_lag2_sporbarhet` KJØRT** — verifisert ved
> at `timer.sheet_timer` har `er_reise`/`reise_avvik`/`tid_kilde`. **Backfill-telling på test: 0 konfigurert, 0
> navne-match** — test har ingen timerader med reise-lønnsart; reise-visningen testes kun med NYE dager. 🔴 **Tellingen
> må kjøres mot PROD før prod-deploy** (`backfill-telling-test.sql` mot `-d sitedoc`). 🟢 **OTA test-kanal publisert 2026-10-04** fra `bd3053bd` (EAS update `0c77fe36-b455-4767-a129-286208c2be55`).
> ⚠️ Migrasjonstabellen for db-timer ligger ikke i `timer._prisma_migrations` (målt) — sjekk kolonner, ikke tabellen.

> 🟢 **TEST-DEPLOY 2026-10-02 kveld: `fd92736d`** — verifisert mot `/version`. Inneholder **hele
> lag 0** (km-taket, beregn/skriv-splitten, shared-typesjekken) **+ L1-A og L1-C**.
> 🟢 **Migrering `20261002120000_byggeplass_geofence_kilde` KJØRT** — verifisert ved at
> byggeplass-lista laster og «Mangler plassering»-merket rendres.
> 🔴 **Første funn på test, umiddelbart:** den **publiserte** byggeplassen på testprosjektet
> (`900512 Røstbakken`) **mangler punkt** — 2 av 5 gjør det. **Den fikk tidligere reiseavstand via
> H21-arven fra prosjektets koordinat; nå får den ingen, og merket sier fra.** Det er fiksen som
> virker, men det betyr at punkter må settes før reise virker igjen.
> ⚠️ **L1-B er IKKE med** — kontrollplan bygger fase 4.

---

## Arkivert: Tavla-notater 2026-09-24 → 2026-09-30 (levert arbeid, nå i prod)

### 🔴 2026-09-30 — PROD-DEPLOY ER IKKE KLAR. Kenneth valgte «mål først».

```
main (prod): eb9071f2 · 24.09      develop: 230f2b64 · 29.09
avstand:     174 commits · 3 umigrerte migreringer
```

Migreringer: `maaling_i_tegning` · `psi_drop_stale_unik_indeks` · `prefiks_backfill`.

🔴 **Den målte bekymringen er ikke migreringene — det er `/uploads/`-gaten.** Default-deny på
hele treet **og** signaturlevetid 24 t → 15 min. **Ingen av delene har kjørt utenfor develop.**

⚠️ **Det umålte hullet:** mobilappen er offline-first og lagrer data lokalt. Ligger det
`/uploads/`-URL-er i telefonenes lokale base — rå eller med utløpt signatur — møter de etter
deploy en server som nekter. **Samme klasse som de forgiftede lenkene, men i en base vi ikke
kan rydde i, på telefoner ute hos A.Markussen.** Web har `SignertBilde` med selvfornyelse;
**om mobilen har et motstykke er ikke målt.** → måleordre til kontrollplan.

**Tre forhold til, ført så de ikke glemmes ved deploy-beslutningen:**
- **Tekstannotering er verifisert i web, UTESTET på mobil** — går live sammen med resten
- **`tsc --noEmit` er rød på develop** — tester og bygg grønne, men ett av tre gate-ledd er
  det ikke, og ingen vet siden når
- **Tegnings-redigeringen Kenneth ba om finnes ikke ennå** — en deploy i dag ville uansett
  ikke inneholdt den

🔴 **Anbefalt form når det skjer: ett planlagt vindu med rollback klar** — ikke en
videreføring av en arbeidsøkt. Prod-verifisering **som innlogget bruker**, aldri `curl -sI`.

🔴 **I KØ, IKKE RELAYET:** `relay/inbox-annotering-tekstverktoy.md` (tekstverktøyet treffer
overalt + tom-tekst-tilbakemelding + iframe-fokus). **Holdes tilbake med vilje:** den rører
`annoterings-html.ts`, samme fil som frosne `3b2a2004`. Brancher den fra develop før den
mergen, kolliderer de. **Slippes når `3b2a2004` er i develop.** Hjemmel alt gitt (Kenneth
2026-09-30).
| **design** | `SiteDoc-design` | `docs/design-maaling1-cookie-rewrite` `12d10719` ✅ | 🟡 **Gate på `3b2a2004`** — `relay/inbox-design-gate-frihaand-og-pil.md` |

### 🟢 2026-09-30 — MÅLING 1 BESVART: rewriten bærer sesjonen hele veien

**`12d10719`.** 🟢 **`Cookie` OG `Authorization` kommer fram til API-et. Ingenting strippes.**

🟢 **Metoden er verdt å gjenbruke:** design satte en **ekko-server på port 3001** i stedet for
API-et og sendte forespørselen gjennom rewriten. Rewriten måles da isolert — ingen
midlertidig logging i repoet, og «hva nettleseren sendte» kan ikke forveksles med «hva Next
sendte videre». Det var nettopp den forvekslingen som gjorde at Kenneth ikke kunne måle det
i DevTools.

🟢 **`localhost:3001`-gåten er løst:** `docker-compose.yml:69` — `network_mode:
"service:sitedoc-api"`. Web-containeren deler API-containerens **nettverksnavnerom**. Ikke
proxy, ikke DNS. **Det finnes ikke et nettverkshopp der en header kan gå tapt.**

⚠️ **Til gate-designet:** `host` settes til destinasjonen; **`x-forwarded-host` bærer
web-domenet.** Skal opphavet kontrolleres, er det den som gjelder.
⚠️ **Operasjonell felle:** `API_PORT` er et **BUILD-arg** (`Dockerfile.web:25-29`). Endres
porten, må imaget bygges på nytt — en `environment:`-endring har ingen virkning.

🔴 **Tre ting design IKKE målte, ført så de ikke forsvinner:**
1. **Produksjonsbygget.** Målingen er Next **dev** 14.2.35. Det bygde imaget er umålt.
2. **Om en ekte innlogget nettleser sender cookien** — design sendte den for hånd.
   Same-origin tilsier ja, men det er **utledet**. Kenneth kan lukke den i DevTools.
3. **Ingenting kjørt på server-ny.** Krav 2 er besvart fra compose-filene.

🟢 **Forutsetningen forslaget hvilte på holder: web bærer sesjon helt fram.** Mobilsporet er
dermed ikke lenger blokkert — måling 2 er gitt til redesign.

### 🟢 2026-09-30 — `3b2a2004`: frihånd lagres, pil-haloen sentrert

**4 filer, alle i `packages/shared/src/annotering/` (+120/−4).** Gate 7/7, 2415 tester
(shared 962 · api 638 · web 358 · db 277 · pdf 131 · mobil 49), web build og mobil
typecheck exit 0.

🟢 **`path:created` er koblet** — strøket går nå inn i `objekter` og dekkes dermed av
lagring, Angre og Flytt. **Det stille datatapet er lukket.**
🟢 **Pil-linjene ankres på senter** via ny ren tvilling `pilLinjeSenterOrigo(fra, slutt)`.
**Funksjonen tar ikke `strokeWidth`** — hvit og rød får samme anker per konstruksjon.

🔴 **EGET FUNN: `tsc --noEmit` på web er RØD PÅ DEVELOP.**
`feltdokumentasjon-annotering.test.tsx(67,7)`, vitest `Mock<>`-typing. **Cowork etterprøvde
redesigns påstand om forhåndseksisterende drift uavhengig** — fila er ikke i diffen, den
importerer kun typen `AnnoteringsLag`, og `lag.ts` har **0 slettede linjer**, så typen er
urørt. Feilen kan ikke være indusert av denne branchen.

⚠️ **Men `tsc --noEmit` er ett av Regel 10s tre byggeledd. Er det rødt på develop, har en
gate blitt rapportert kjørt uten å være grønn.** Design skal finne ut hvilken merge som
slapp det inn. **Ikke lappet i denne runden** — branchen er ren og skal ikke bære en
fremmed fiks.

**Kenneths tre funn på test 2026-09-29, etter `230f2b64`:**
1. 🔴 **Frihånd lagres ikke.** Målt rotårsak: null `path:created`-håndterere → strøket kommer aldri inn i `objekter`, som er kilden til både lagring, Angre og Flytt. **Stille datatap** — strøket ligger i den flate JPEG-en, men forsvinner ved neste annotering, og er borte for godt ved neste lagring. → redesign.
2. 🟡 **Pil-haloen ligger for lavt.** Begge `fabric.Line` mangler eksplisitt senter-anker. Antakelsen om at pil-linja «alt var konsentrisk» er motbevist av skjermbilde. → redesign.
3. 🟡 **Ingen miniatyr etter Ferdig.** `byggAnnoteringsPatch` skriver en **usignert** `/uploads/`-URL, og `SignertBilde` signerer ikke (og skal ikke). **SATT PÅ VENT** — en lapp her ville sementert bærer-modellen Kenneth avviste samme kveld.

🟢 **Positivt målt samme runde:** re-annotering virker — objektene kommer tilbake redigerbare.
Kenneth om Flytt-verktøyet: *«ingen endring → jeg liker dagens funksjon»*. **Avvist forslag,
ført så det ikke gjenoppstår.**

### 🟢 2026-09-29 — FORGIFTEDE VEDLEGG-URL-ER: BILDER SOM FORSVANT I AUGUST ER TILBAKE

**Kenneth så et vedlegg som viste filnavnet «IMG_1787» i stedet for bildet.** Målt: signaturen i URL-en
var **utløpt 22.08, 887 timer tidligere** — altså lagret i `Checklist.data`, ikke laget ved emisjon.

🔴 **Rotårsak `hmac.ts`: `erAlleredeSignert()` spurte kun OM en URL bar `sig=`, ikke om signaturen var
gyldig.** En død signatur telte som «ferdig signert» og ble sendt ut uendret — for alltid. Rotårsaken er
**Fase 1** (`ca7f16b6`, 07.08), ikke `/uploads/`-gaten. ⚠️ **Advarselen om «forgiftet URL» sto i kodens
egne kommentarer. Den ble skrevet, og forgiftningen skjedde likevel, fordi det ikke fantes noen vakt.**

**Omfang i prod:** 5 sjekklister + 1 oppgave. **Én tilhører A.Markussen** (`f4337dff`, status `received`).
🟢 Ingen signert eller godkjent.

🟢 **Fiksen rører ikke databasen.** En utløpt signatur regnes ikke lenger som ferdig, så emisjonen
signerer på nytt. **Verifisert på test av Kenneth: A.Markussen-raden viser bildet igjen uten at én rad er
skrevet.** Dataryddingen ligger i `packages/db/manuell/` — utenfor `prisma/migrations/`, så
`migrate deploy` kan ikke kjøre den — og venter godkjent dry-run. ⚠️ **Idempotensen for GYLDIGE
signaturer er bevart, så URL-en er stabil i 15-min-vinduet og koalesceringen fra `4ef039fd` består.**

🔴 **Kenneths formulering er ført som regel:** *«jeg har bestilt større sikkerhet → men det er ikke det
samme som at en gammel sjekkliste aldri mer skal vise bilder.»* **En endring som fjerner noe brukeren
kunne, er en funksjonsendring — også når den er merket sikkerhet.**

### 🟢 2026-09-29 — ANNOTERING I WEB, MED REDIGERBART LAG

**Kenneth trodde annoteringen var forsvunnet fra sjekklister. Målt: den har ALDRI eksistert i web** —
`FeltDokumentasjon.tsx` har null treff i hele git-historikken. 🟢 **Paritetsmålingen som fulgte: 33
rapportobjekt-komponenter i begge trær, 24 i paritet, 9 divergerer, 1 ren mangel.**

🔴 **Og Kenneths spørsmål underveis ga en bedre modell enn ordren:** *«hvorfor kan vi ikke legge et eget
lag på bildet — slik at anotering er redigerbart?»* **Cowork hadde presentert overskriv-vs-behold som om
det var valget; begge ofret noe.** 🟢 **Tre artefakter — original urørt · Fabric-lag som data · utflatet
JPEG — oppløser hele spørsmålet.**

**Tegnemotoren er nå ÉN delt HTML-streng i `@sitedoc/shared`** (mobil-kopien slettet), og
**bro-betingelsene INTERPOLERES inn i HTML-en fra konstanter** — så HTML-en ikke kan drifte fra
TS-tvillingen. 🟢 **Design ba om at drift skulle bli detekterbar; redesign gjorde den umulig.**

⚠️ **Fire returer, tre fra cowork:** meld kostnaden før du bygger (fant at «pilen kan flyttes» krever et
Velg/Flytt-verktøy som ikke fantes, og koordinat-normalisering mellom flatestørrelser) · kjør
motortest i mobilens WebView · **RN-broen var refaktorert og ukjørt** — WebKit-testen traff
`window.parent`-grenen. **Og én fra design: tvillingen var dokumentert, ikke håndhevet.**

🟢 **Drag-kjeden er REGNET, ikke påstått:** pil på canvas 1163×775 → `left=368`; gjenåpnet på 1059×706 →
`left=335`. **368 × (1059/1163) = 335.**

### 🟢 2026-09-28 — TRAFIKKLYS-VERDISETT: 6 AV 6 PROD-FELT VISTE FEIL ETIKETTER

**Rendreren leste aldri `objekt.config.options`** (`TrafikklysObjekt.tsx:14` destrukturerte
`{ verdi, onEndreVerdi, leseModus }`), så en mal som erklærte sitt eget lyssett ble ignorert.
🔴 **Målt i prod: 6 av 6 `traffic_light`-felt har egne `options` — samtlige viste feil.** Fire tilhører
A.Markussen. 🟢 **Ingen var besvart, så ingen lagret verdi skifter betydning.**

**Vedtatt modell (design, målt):** **én felttype, ikke to.** `oppdaterObjekt` kan ikke endre `type`
(`mal.ts:759-768`), så to typer ville tvunget et lyssett-bytte gjennom slett + nyopprett — **forbi
endringsvernet.** Med én type er byttet en `config`-endring og vakten fyrer. 🟢 **Modellvalget ER vakten.**
`TRAFIKKLYS_VALG` forblir kanonisk; `config.options` bærer delmengde og etiketter. **Ingen migrering, ingen
ny kolonne, fargene urørt.**

🔴 **Og gate-runden avdekket en selvmotsigelse i coworks egen ordre:** den sa «api stille», mens
designordrens §3 ba om validering i `mal.ts`. Redesign meldte motsigelsen i stedet for å velge i stillhet;
cowork returnerte branchen fordi **validering uten test er det gale svaret.** **api SKAL stige — 628 → 634.**
🟢 **Rød først bevist mot en no-op valideringskropp: 4 failed | 2 passed → 6 passed.** Det skiller «vokter»
fra «kompilerer».

### 🔴 2026-09-27 — PSI: EN DOMENEREGEL FRA KENNETH SNUDDE EN «KANTSAK» TIL PILOTBLOKKERENDE

> «ikke alle byggeplasser skal ha psi. når psi er slått på → da skal byggeplassen kreve psi. det
> betyr i praksis at et prosjekt kan ha ti forskjellige psi»

**Den foreldreløse `psi_project_id_key`-indeksen i prod sperrer altså ikke et hjørne — den sperrer
hovedveien.** Full regel: [domene-arbeidsflyt.md § PSI er PER BYGGEPLASS](domene-arbeidsflyt.md).

🔴 **Og målingen avdekket at fiksen vi var i ferd med å deploye var HALV.** `Psi.byggeplassId` er
nullable, og **Postgres regner NULL-er som ULIKE i en unik indeks** — så
`@@unique([projectId, byggeplassId])` hindrer *ikke* to PSI-er på prosjektnivå.

| Indeks | Hindrer ti byggeplass-PSI-er? | Hindrer to prosjektnivå-PSI-er? |
|---|---|---|
| `psi_project_id_key` (stale, i prod) | 🔴 **JA — feil** | 🟢 ja, ved et uhell |
| `psi_project_id_building_id_key` | 🟢 nei | 🔴 **NEI — hullet** |

**Kenneth valgte å utvide den develop-mergede migreringen** framfor en ny på toppen, så det aldri
finnes et vindu der begge garantiene mangler. `DROP INDEX` + partiell
`CREATE UNIQUE INDEX ... WHERE byggeplass_id IS NULL`, i den rekkefølgen, **og en test låser
rekkefølgen.**

🟢 **Tre forhåndssjekker kjørt av Kenneth — alle 0 rader:** migreringen finnes ikke i prods
`_prisma_migrations` (redigeringen var lovlig) · 0 duplikater på prosjektnivå i prod · samme i test,
**så `CREATE UNIQUE INDEX` kan ikke feile.** ⚠️ **Det var nøyaktig sjekken
`20260430120000_add_klasse4_indekser` manglet i april — der 15 indekser lå rullet tilbake i fem
måneder uten at noe sa fra.** 🔴 **GJENSTÅR: prod-deploy. Migreringen er kode, ikke tilstand.**

### 🔴 2026-09-27 — «FJERN DET FJERDE TRAFIKKLYSET» BLE TRUKKET, OG MÅLINGEN SNUDDE HELE SAKEN

**Kenneth trakk ordren på premisset, ikke på utførelsen:**

> «du har besluttet basert på en test på hva som brukes i dag → det er ikke rett → du kan ikke vite
> hva som skal brukes i fremtiden. Det har vært behov for 4 trafikklys i andre prosjekter der
> tilsvarende lys var brukt. det eksisterte bare 3 lys.»

🟢 **Regelen som følger:** [`retningslinjer/bruk-er-ikke-behov.md`](retningslinjer/bruk-er-ikke-behov.md).
**Design hadde målt at `gray` var ubrukt og konkludert at den ikke TRENGS.** ⚠️ **Det er en måling av
fortiden brukt som beslutning om framtiden.**

🔴 **Og da bestillingen ble snudd til «to lyssett», viste målingen at mekanismen finnes ALLEREDE — og
at den er ødelagt:** `traffic_light` er erklært 29 steder, og `TrafikklysObjekt.tsx:14`
destrukturerer `{ verdi, onEndreVerdi, leseModus }` uten å lese `objekt`. **`config.options` er
uleselig for skjermen**, så en mal som erklærer eget lyssett blir ignorert.

| Systemmal · felt | Malen erklærer | Skjermen viser |
|---|---|---|
| HMS-avvik · «Status» (`types/index.ts:568`) | tre lys: Åpent / Under behandling / Lukket | fire: Godkjent / Anmerkning / Avvik / Ikke relevant |
| Godkjenning · «Beslutning» (`:534`) | … / **Avvist** / **Ikke behandlet** | … / **Avvik** / **Ikke relevant** |

🔴 **PROD: 6 av 6 `traffic_light`-felt har egne `options`.** **Det finnes ikke ett felt i prod som
bruker standardsettet — samtlige rendrer feil i dag.** **Fire av de seks tilhører A.Markussen.**
🟢 **Ingen er besvart ennå — vinduet er åpent, og det lukkes i det noen svarer på det første.**

🟢 **§0-målingen (Kenneth kjørte test + prod) var NULL overalt:** ingen lagret verdi på noe felt med
egne `options`, ingen foreldreløse. **Ingen etikett skifter på et besvart eller signert dokument, så
rettingen krever ingen kundevarsling.** ⚠️ **Verdiene er de samme nøklene — bare etikettene skifter —
så hadde ett felt vært besvart, ville rettingen endret hva et signert dokument SIER at det ble
kontrollert mot. Null er flaks her, ikke vern.**

**Vedtatt modell (design, målt):** **én felttype, ikke to.** `oppdaterObjekt` kan ikke endre `type`
(`mal.ts:759-768` tar bare label/required/config/parentId), så to typer ville tvunget et lyssett-bytte
gjennom slett + nyopprett — **forbi endringsvernet**. Med én type er byttet en `config`-endring og
vakten fyrer. 🟢 **Modellvalget ER vakten.** `TRAFIKKLYS_VALG` forblir kanonisk; `config.options`
bærer delmengde og etiketter. **Ingen migrering, ingen ny kolonne.**

### 🟢 2026-09-24 — Opprydding + en måling som avgjør prod-deployen

**Branch-opprydding:** 56 mergede referanser slettet fra origin, 4 igjen (`develop`, `redesign/navigasjon`, `feat/mal-up-deling`, `feat/synlighet-samlet` — de to siste aktive i worktrees). Alle 56 verifisert som ancestors av develop før sletting; listen ble målt fra `git worktree list`, ikke fra en fast liste. **Fase 4-etterslepet er ryddet** — samme klasse som de 86 branchene målt 2026-07-16.

🟢 **MÅLT: `main` bærer INGENTING `develop` mangler.** Av 132 commits unike for `main` er **130 merge-commits** fra tidligere `--no-ff`-releaser. De to reelle er docs fra 07.09, og begge finnes i develop (`ec9d3f7e`, `041965d6`). **`git diff <merge-base> origin/main` er TOM.**

🔴 **Konsekvens for prod:** en `develop → main`-merge er **rent additiv**. Risikoen ved prod-deployen ligger ikke i divergens — den er null — men i de **8+ umerkede migreringene** og i at `main` er 522 commits bak. **Migreringsgjennomgang er den avgrensede oppgaven som gjenstår før prod.**

### 🟢 2026-09-25 — REGEL 10 HAR TRE LEDD, og `tsc --noEmit` er grønt for første gang. develop `4b5a148b`.

`fix/zoom-musepeker` `3faadbec` + `feat/maaling-i-tegning` `c644bafb`, i den rekkefølgen — zoom først fordi den bar fiksen som gjorde det nye gate-leddet grønt.

**Gate:** db 248 · api 605 · pdf 128 · shared 854→**867** (+13) · web 319→**321** (+2) · mobil 44 · 7/7. **Alle tre ledd exit=0.**

🔴 **Regel 10 er utvidet med `pnpm --filter @sitedoc/web exec tsc --noEmit`.** Hullet ble målt 24.09: `next build` typesjekker byggegrafen, og `src/lib/__tests__/*` er ikke i den. **En TS2532 hadde ligget usett på develop.** Full begrunnelse i [SAMARBEIDSREGLER § Regel 10](SAMARBEIDSREGLER.md).

🟢 **Zoom-fiksen:** `requestAnimationFrame` satte scroll FØR elementet fikk ny størrelse, så nettleseren klippet til gammelt maksimum og visningen landet for høyt. Flyttet til `useLayoutEffect([zoom])`. **Matematikken er urørt** — formelen er trukket ordrett ut i en ren funksjon, `git diff` viser ingen endring i regnestykket. Rød-først ga `expected +0 to be 100` — symptomet reprodusert i en test.
🔴 **Visuell bekreftelse på ekte A3-tegning gjenstår** — at zoom faktisk treffer pekeren kan bare sees.

🟢 **Måling i tegning:** `mmPrPiksel` **utledet** av papirbredde ÷ bildebredde (420,00 mm ÷ 3308 px), ikke av DPI-konstanten — med test som viser at 300 DPI gir samme virkelige mål. Akseptansetesten mot tegningens egne påførte mål traff **2869,4 mm mot 2870**, avvik **−0,021 %**. Målestokk-uttrekket ankret på «Mål»/«Målestokk»/«Scale» gir `1:50`; et løst grep gir `60/37` fra brannklassekoden `IV11_EI60/37dB`. **Begge vist, som ordren krevde.**

⚠️ **Åpent:** Kenneth vil at tegningens egen målestokk skal huskes OG kunne overstyres ved kalibrering. Med dagens to felt kollapser opprinnelsen til «manuell» ved bekreftelse. **Egen runde — migreringen er additiv og ikke kjørt.**

🟢 **Gate-tall som måling, ikke bokføring:** `shared` steg (+13) fordi `maaling.ts` kom **med** `maaling.test.ts`. Forrige runde sto `shared` stille fordi `uploadsSti.ts` kom **uten**. **Samme signal, motsatt utfall — og forskjellen var synlig i tallet før noen leste koden.**

### 🔴 2026-09-24 — `/uploads/*` SERVERES UTEN AUTENTISERING. Omfanget målt.

**Designs funn, dokgens måling.** `server.ts:127-131` lar `fastifyStatic` levere rått — bilder, tegninger, vedlegg. Hvem som helst med URL-en får fila. Gaten på `:114-124` dekker **kun** `privat/`; kommentaren på `:113` sier «global gate kommer i Fase 1b».

| Flate | Antall | Form |
|---|---|---|
| api **med** signering | 38 kall / 9 filer | 🔴 **No-op for offentlige filer** — dekker bare `privat/` |
| api **uten** signering | ≥7 rutefiler | Returnerer `fileUrl` rått |
| web | 50 linjer / 29 filer | `/api${fileUrl}` inline, **ingen hjelper** |
| mobil | 11 filer | Inline base-URL + én `privat/`-hjelper |
| `packages/pdf` | 1 hjelper | Server-side, egne regler |

🔴 **Ad hoc overalt — ingen felles funksjon.** Og presedensen er målt, ikke antatt: `mobil/FeltDokumentasjon.tsx:191` bærer *«åpen /uploads/-sti (S1-hull, funnet ved prod-opprydding 2026-08-15)»*. **Opt-in-mønsteret har allerede sviktet i produksjon én gang.**

🟢 **Fiksen er billigere enn tallet antyder:** signaturen rir i URL-en, så `<img src>` og `<Image uri>` virker uendret. **Api-side — ikke 61 konsumentendringer.** Sentralisert emisjon (tRPC-serialisering) + utvidet gate. **UUID-filnavnet og RFC 5987-kodingen legger seg på samme rute.**

⚠️ **Coworks rangering var feil:** saken ble først kalt 🟡 kosmetisk. Pilotprøven («vil A.Markussen trenge at fila heter noe?») var riktig stilt for **filnavnet**, men ble anvendt på en sak som også handler om **hvem som får åpne fila**. Design omrangerte til 🔴 sikkerhet. **Et åpent dokumentlager er ikke et spørsmål om hva brukeren savner.**

⚠️ **Ikke fasit ennå:** dokgen markerte at «7 rå rutefiler» er en grov proxy — «filen returnerer `fileUrl`» er ikke det samme som «returnerer den usignert til klient». Krever bekreftelse per prosedyre før det brukes som kravgrunnlag.

### 🟢 2026-09-24 — Punktsky steg 1 (A–F) merget. develop `058b3ffa`.

`feat/punktsky-overflate` `5b15c84e` + `docs/design-backlog-las-uverifisert` `9bac3b90`, begge `--no-ff`. **Gate traff blink:** db 248 (+5) · api 574 (+28) · pdf 128 · shared 854 · web 309 (+2) · mobil 38 · 7/7. Kald web-build exit 0 (ingen TS2589), mobil-typecheck exit 0.

**Ny tabell `Overflate`** — migrering `20260924120000_overflate_tabell`: `CREATE TABLE` + partial unique + CHECK + 4 FK på en ny tom tabell. 🔴 **Ikke kjørt mot test ennå** — krever Kenneths TTY.

🟢 **To avvik fra ordren, begge forbedringer, begge meldt av agenten før koding:**
- `malavstandM`/`bakkeMetode` **nullable + CHECK** i stedet for non-null. § D og § E motsa hverandre — LandXML-flater i samme tabell har verken felt. Non-null ville tvunget fram oppdiktede verdier. **Design bekreftet at selvmotsigelsen var hans.**
- **Float32-vertekser som offset fra bbox-origo** (float64 i headeren). Rå float32 på 6,7M UTM gir ~0,5 m; med offset <0,1 mm. Formen beholdt, presisjonen reddet, låst av en test på hver side.

🔴 **BRUKS-BLOKKER, ikke merge-blokker:** en LAS-avledet overflate skal **ikke** brukes som volumdokumentasjon før én **ekte drone-LAS** er kjørt gjennom kjeden. Aritmetikken er bevist mot en syntetisk fixture med kjent fasit; at ekte filer *parses* er ikke bevist. Ført i [BACKLOG](BACKLOG.md). **Krever én fil fra Kenneth, ikke en ny leveranse.**

🟢 **i18n-kollisjonen ble sekvensert, ikke oppdaget.** Punktsky og dokgens tegningsrunde rører begge 15 i18n-filer. Cowork målte innsettingspunktene (nb.json 1331 mot 1526) og la punktsky først; merge bekreftet 0 konfliktmarkører. **Kollisjons-sjekken virket som den skal for én gangs skyld i forkant.**

---

## Arkivert: Daterte merge-innslag 2026-09-04 → 2026-09-23

## 🟢 2026-09-23 — OCR som fjerde tapte funksjon + `dwgread`-navnretting. Én branch `--no-ff`. develop `77308515`. Ren docs.

🟢 Designgatet. Non-ff, målt trygt SELV: base `6edda731` allerede i develop, `BACKLOG.md` 0 commits rørt på develop siden basen, `merge-tree` 0 konfliktmarkører — ikke rebaset. Faktisk endring mot develop = KUN `BACKLOG.md` +19/−3 (2-punkts-diffen viste også STATUS-AKTUELT.md, men branch-base lå før georeferanse-tavla; 3-veis merge beholdt develop-versjonen — georeferanse-tavla verifisert intakt). Gate `--force` (0 cached): db 243 · api 542 · pdf 128 · shared 854 · web 307 · mobil 38 · 7/7 — **ALT STILLE**.

**Retter to feil, begge båret videre umålt:**

- 🔴 **`dwgread` kalles ikke i det hele tatt.** Cowork navnga den fra et grovt grep, design kopierte navnet inn i BACKLOG uten å måle. Simulator fant at de faktiske libredwg-binærene er **`dwg2dxf`** (`dwgKonvertering.ts:80,892`) og **`dwg2SVG`** (`:930`). Ført som RETTING av en påstand, ikke ny opplysning — begge ledd videreførte noe ingen hadde målt.
- 🔴 **OCR er den FJERDE tapte funksjonen — og svikter STILLERE enn de tre andre.** FtD-prosesseringen startes fire-and-forget (`mengde.ts`: `prosesserDokument(...).catch((err) => console.error(...))`), så en manglende `tesseract` ender som ÉN LINJE i en containerlogg. **PDF-tegning ga i det minste et banner; et skannet dokument uten søkbar tekst ser bare ut som et skannet dokument — derfor har ingen meldt det.**

### 🔴 Konsekvens for hotfixen (ingen ordre skrevet ennå)

**`Dockerfile.web` skal ha TO pakker, ikke én:** `poppler-utils` OG `tesseract-ocr` + `tesseract-ocr-nor`. Begge er énlinjes, begge er LIVE funksjoner — den andre ville ellers ligget igjen usett. Å bygge hotfixen er egen runde; cowork skriver ordren.

## 🟢 2026-09-23 — Georeferanse-notat + konsolidert BACKLOG. Én branch `--no-ff`. develop `861c570e`. Ren docs.

🟢 Designgatet, ff mot develop `6047b91e`. **Tre BACKLOG-branches rørte alle `§ 1` og ville kollidert ved separate merges — design konsoliderte ved å STABLE:** `6edda731` sitter oppå `648a3179` (dwg-backlog) og fletter inn `b591899f` (tapte-funksjoner) via `a1b30efc`. Å merge kun toppen `6edda731` drar inn alle tre postenes innhold i én ren merge; de to andre merges ikke som egne branches (commitene deres blir ancestors via stabelen). 🔴 **Verifisert selv at alle tre ###-postene finnes:** «Georeferanse: nord dreier ved to-punktskalibrering», «Oppstartssjekk for PÅKREVDE binærer» (dekker DWG, 11 DWG-treff), «TRE FUNKSJONER TAPT VED SERVERFLYTTINGEN». Innholdet er omskrevet, ikke kopiert linje-for-linje. Gate `--force` (0 cached): db 243 · api 542 · pdf 128 · web 307 · shared 854 · mobil 38 · 7/7 — **ALT STILLE**. Diff = 2 docs-filer + tavla. `fix/pdf-omrade-navn` `b223d036` urørt (ugatet).

### 🔴 Georeferanse-funnet — rundens innhold (ingenting bygges ennå)

Kenneth spurte om vi kalibrerer med beste metode. **Svaret er nei, målingen er entydig:** `dwgKonvertering.ts:969-991` detekterer koordinatsystemet og konverterer DWG-ens `extents` til WGS84, men pakker så den EKSAKTE transformasjonen ned i **to punkter på diagonalen** (`pixel (0,0)` og `(100,100)`), matet inn i en similaritet som **ikke kan uttrykke ulik skala i x og y**.

🔴 **Regnestykket som forklarer symptomet:** de to punktene gir **45° i prosentrommet**; metrisk peker diagonalen i `(bredde, −høyde)` — for en 200×100 m tegning er det **−26,6°**. Similariteten MÅ rotere 45° over på −26,6°, så tegningen dreies **~71°** på noe som skal ha 0°. ⚠️ **Kvadratiske tegninger treffer 45° mot 45° og ser riktige ut — DERFOR har feilen overlevd.**

🔴 **Omfanget er større enn antatt:** auto-georeferansen fra DWG-konverteringen er OGSÅ to punkter. De mistenkte kalibreringene er **ALLE auto-georefererte DWG-tegninger** — ikke bare de manuelt kalibrerte. Sannsynligvis flertallet.

🟢 **Den bedre metoden krever ingen kalibrering:** `extents` gir en eksakt affin transformasjon direkte — ulik skala faller ut av seg selv, kiraliteten faller ut av y-inversjonen. Tre punkter nedgradert fra hovedanbefaling til fallback for tegninger uten koordinater.

### 🔴 BETINGELSE før noen koder georeferanse-fiksen

**Notatets § «Hva som skal måles» har tre målinger; den FØRSTE kan velte forslaget:** `detekterKoordinatSystem(filnavn, extents)` **tar FILNAVNET som argument.** ⚠️ Er deteksjonen i praksis en gjetning fra filnavn, MÅ brukeren kunne bekrefte eller overstyre systemet. 🔴 **Mål dette FØR noen koder — betingelse, ikke detalj.** Ingen ordre finnes ennå; tre målinger først.

## 🟢 2026-09-23 — Steg 2b + UP-deling + UP-ordre + PDF-vakt. Fire branches `--no-ff`. develop `18fec301`.

🟢 Alle fire designgatet med korrekt hash, alle ff mot develop `f1d4f9d5`. Branch 3 ERSTATTET uintegrert `97908d78` — tippen var `b134f5b8` (verifisert). Gate `--force` (0 cached, ikke FULL TURBO): **db 243 (+32) · api 542 (+6) · pdf 128 (+4) · web 307 (+1) · shared 854 · mobil 38 · 7/7** — shared/mobil STILLE. Diff = 41 filer + tavla. 🔴 **Slettede fasit-linjer utenfor UP/UO/UM = 0 (verifisert selv).**

🔴 **IKKE GLATT:** Prisma-klienten i merge-treet var stale mot den nye schema-endringen (branch 1 la `omrade_id` på Checklist/Task). Første gate-kjøring: `api#build` feilet med TS2353/TS2339 på `omradeId` (testene passerte — kun tsc mot generert klient sviktet). Regenerert med `pnpm --filter @sitedoc/db generate`, gate grønn på ny kjøring. Ingen kodefeil — worktree-friksjon.

### 🔴 DEPLOY-KRAV — gjelder NESTE DEPLOY TIL TEST, ikke mergen

> **Runde 2 — fyll `omradeNavn` og `omradeType` i arkiv-sammenstillingen — SKAL INN FØR NESTE DEPLOY TIL TEST.**
> **Rekker den ikke: SKJUL `omrade` som valg i lokasjonsvelgeren i den deployen.**
> ⚠️ **Bedre å ikke tilby valget enn å sende en sluttrapport der hvert område-dokument sier «Et definert område». Valget skal være bevisst, ikke avgjort av hvilken branch som ble ferdig først.**

**Hvorfor vinduet er akseptabelt (design-målt):** Merge til `develop` eksponerer ingenting — test oppdateres kun når Kenneth kjører `./deploy-test.sh`. Arkiv-PDF-en rendres PÅ FORESPØRSEL (`arkiv.ts:5` → `rendrArkivPdf`, `:106` ferskt tidsstempel) — et dokument opprettet i vinduet rendrer med riktig områdenavn i det øyeblikket runde 2 er ute. **Det ene som IKKE er selvhelende: en EKSPORTERT kopi** — en PDF noen lastet ned og sendte byggherren i vinduet bærer «Et definert område» for alltid. Ny rendring reparerer systemet, ikke en fil som har forlatt det. Runde 2 (api-fyllingen) er egen runde — cowork nudger dokgen etter denne mergen.

| # | Branch | Hash | Innhold |
|---|---|---|---|
| 1 | `feat/omrade-lokasjonsniva` | `d4d2a3e3` | **Steg 2b:** område som lokasjonsnivå på sjekkliste/oppgave. **Migrering `20260923120000_omrade_lokasjonsniva` (ÉN mappe):** kun `ADD COLUMN`/`ADD CONSTRAINT`/`CREATE INDEX`, FK m/ `ON DELETE SET NULL`, **CHECK-garanti** (`lokasjon_omfang <> 'omrade' OR omrade_id IS NOT NULL`). Ingen `DROP`, ingen `NOT NULL`, ingen datamigrering. Negativkontroll flyttet til throwaway-tabell i `DRY-RUN.sql` (beviser at CHECK-en fanger, ikke en annen NOT NULL). 29 filer |
| 2 | `feat/mal-up-deling` | `a2680cf6` | **UP1 deles i fire:** UP1/UP2/UP3/UO2.1 med betingede felt. Fasit `358 tillegg, 43 slettinger` — alle 43 slettelinjer i UP1-blokka. **Off-by-one i UP2 OG UP3 rettet** (tallene skrevet før B5 «Oppdrift» tok basisblokka fra 9→10 felt). `M2`/`M3` er SAMME KODE delt av tre maler — drift umulig, ikke bare testet mot. Generator-relaxering (`--sorter`, eksplisitt/aldri default, vakt i modus `revisjon` står). 9 filer |
| 3 | `docs/design-up-ordre-retting` | `b134f5b8` | UP-ordren bærer nå BEGGE runder rettinger (T-merking bor i B1 m/ krysshenvisning fra M2; stale tellinger; generator). Erstatter uintegrert `97908d78` (runde 1), som `b134f5b8` sitter oppå. 1 docs-fil |
| 4 | `fix/pdf-omrade-lokasjon` | `698c36c8` | Arkiv-PDF tegningsfelt viser områdenavn/-type. **Rød-først verifisert:** impl-fila stashet, alle fire testene feilet med TOM STRENG (manglende gren truffet, ikke tilfeldig assertion). Kun `packages/pdf`, 2 filer |

### Prosess ført
- 🔴 **Steg 2b inne med CHECK-garanti — kostnaden var én runde.** Cowork holdt merge tilbake mot designs gate, design ga cowork rett: migreringen var ikke merget, så CHECK-en kunne legges inn som ÉN linje i ÉN migrering i stedet for en andre migrering i historikken for alltid.
- 🟢 **Kontrollplan uoppfordret:** migreringen bærer sin egen begrunnelse i kommentaren (inkl. at design snudde), og negativkontrollen på throwaway-tabell BEVISER at det er CHECK-en som fanger — i stedet for å skrive «verifisert» om noe `bestiller_user_id NOT NULL` stoppet først.
- 🟢 **Design-verifisering av trevverdilogikk:** `omfang=NULL` + `omrade_id=NULL` gir `NULL OR FALSE` = NULL, og en CHECK er oppfylt med mindre den evaluerer FALSE — «ikke valgt ennå» passerer, som den skal.

## 🟢 2026-09-23 — KD1 v3 + områdeadmin + steg 3-offline + barnAv-mekanismen. Fire branches `--no-ff`.

🟢 Alle fire designgatet + `ls-remote`-verifisert, alle ff mot develop `76e80925`, null filoverlapp. Branch 1+4 gikk i SAMME runde (KD1 v3 innfører `barnAv`; branch 4 gjør at ordrene ikke lenger motsier seeden). Gate `--force` (0 cached, ikke FULL TURBO): db 211 (+4) · api 536 (+5) · pdf 124 · shared 854 · web 306 · mobil 38 · 7/7 — web uendret (ordren sa «kan stige»), resten stille.

| # | Branch | Hash | Innhold |
|---|---|---|---|
| 1 | `feat/mal-kd1-v3-betinget` | `6cb16ae1` | **KD1 v3:** 18 grener (partisjon dekker 11 typer per kravfelt: tykkelse/fugebredde/planhet/sprang), **arbeideren ser fire**. Fase-flytting «Tykkelse settelag» UNDER→FØR (ordrekrav). Heltall-felt m/ `{enhet:"mm"}` på sprang ved fuger. 🔴 **Slettede fasit-linjer utenfor KD1 = 0 (verifisert selv).** 🟢 Ny mekanisme `forelderFelt`/`barnAv` (`seed-bibliotek.ts:218/:228`) — fester barn til forelder-ref lenger opp, flatt i annen fase (bedre enn `forgrening` når barnet skal i ANNEN fase; treffer UP-delingen + UM1) |
| 2 | `feat/omradeadmin` | `190d9687` | **Områdeadministrasjon + slettevakt.** Liste m/ bruksantall, opprett, omdøp, slett MED VAKT. Vakten teller **to kilder**: FK-punkter OG myk JSON-referanse (`omradeId` i `Checklist.data`/`Task.data` — ingen FK/kaskade). Kun admin (`verifiserAdmin`). 3 api + 4 web + 15 i18n, ingen db/migrering/mobil. Test A grønn før/etter, Test B rød først |
| 3 | `docs/design-steg3-offline` | `9ec08a58` | Steg 3 fikk **BLOKKERENDE krav** (nytt DoD-punkt 15): mobil har ingen lokal `omrade`-tabell → områdelista TOM offline → bundet repeater UTEN RADER (verre enn fritekst). Befaring fylles i grøft 2–3×/uke. Rød først på at rad som viser til slettet område IKKE forsvinner |
| 4 | `docs/design-barnav-mekanisme` | `6446b638` | **MAL-METODE §1f** + de tre malordrene (UP1-deling, UM1, PE-skjot) rettet: **samme fase → `forgrening` · annen fase → `forelderFelt`+`barnAv`**. Uten denne sto en ordre i develop som sa «bruk `forgrening`» ved siden av en seed som bruker `barnAv` — neste leser ville «rettet» det tilbake. To forutsetninger: forelder-fase før barn-fase; hver vert-fase må ha ≥1 alltid-synlig felt (`synlighet.ts:95-100`) |

### Funn ført (ikke tapt)
- 🔴 **«Stille tomhet» i TREDJE variant** (branch 2): `RomEgenskapObjekt`/`SoneEgenskapObjekt` lagrer `omradeId` som **myk streng i `Checklist.data`/`Task.data` — ingen FK, ingen kaskade.** Uten kontrollplans telling ville en sletting etterlatt dangling id-er stille. At han fant den mens han bygget vakten er grunnen til at vakten nå teller begge kilder.
- 🟢 Steg 3-kravet kom av kontrollplans **egen måling** i en runde som ikke handlet om offline.
- ⚠️ **Designs prosessfeil, rettet (branch 4):** `barnAv`-mekanismen ble gatet i en **chat-melding** til mal-Opus (som fulgte den korrekt og meldte at han gikk foran ordrenes bokstav). Da sto en ordre i develop som sa noe annet enn seeden. Branch 4 lukker gapet. Design skriver selv: «en gate i en chat-melding er ikke en sannhetskilde — samme klasse som de upushede hashene i morges.» **Andre gang samme dag** — kanalregelen vi førte i dag står på prøve.
- **To oppfølgere → BACKLOG § 1:** kommentar i `omrade.slett` som navngir vakten; schema-kommentar på `Omrade.type` rettes i steg 2b.

### Til fordeling
- 🔴 **Steg 2b og steg 3 IKKE startet — cowork velger agent.** Steg 2b krever migrering (`omradeId` på `Checklist`+`Task`, additiv/nullable). Steg 3 er blokkerende på offline-områdeliste.
- 🟢 **`forelderFelt`/`barnAv` festet i MAL-METODE §1f** — mekanismevalget er nå en regel, ikke en chat-melding. Treffer UP-delingen + UM1.

## 🟢 2026-09-23 — BEF-referanser rettet (HASTER) + bundet repeater-ordre. To docs-branches `--no-ff`. Ren docs.

🟢 Begge designgatet + `ls-remote`-verifisert. Non-ff branch 1 verifisert selv: base `d21e7011` (alt merget), fila urørt på develop siden basen, `merge-tree` 0 konflikt. Gate `--force`: db 207 · api 531 · pdf 124 · shared 854 · web 306 · mobil 38 · 7/7 — ALT STILLE.

| # | Branch | Hash | Innhold |
|---|---|---|---|
| 1 | `docs/design-byggeleder-befaring` (delta) | `a5c06ed4` | **HASTER:** malreferansene `BEFARING-A/B`, `AVVIK-A/B` → `BEF1/BEF2/AVV1/AVV2`. Prefikset utledes av referansen (`bibliotek.ts:174`) — lange referanser ville gitt dokumentnumre som `BEFARING-A-001`. Rettet før mal-Opus bygger ordre 3. 0 aktive gamle referanser igjen (kun forklarende prosa) |
| 2 | `docs/design-bundet-repeater` | `207637b6` | App-spor-ordre: bundet repeater + områdeadministrasjon. **Fire leveranser, hver kan merges alene.** 🔴 Kun **steg 2b** krever migrering (`omradeId` på `Checklist`+`Task` — additiv/nullable, to-stegs OK). Steg 1/2/3 migreringsfrie |

### Til fordeling — ordre 2 (app-sporet)
- **Cowork velger agent** (ikke startet). Fire leveranser, uavhengige. Slettevakt = **blokkér hvis området er i bruk** (navngi tallet, vei ut = omdøp); tilgang = **kun admin** via `verifiserAdmin` på alle tre skriveveier.
- 🔴 **Admin-kravet har åpen konsekvens:** `omrade.opprett` kalles i dag fra `tegninger/page.tsx:235` + `OpprettPunktDialog.tsx:77` (åpne for alle medlemmer). Admin-krav → FORBIDDEN → flatene må **skjule/deaktivere med begrunnelse** (samme mønster som `fix/utilgjengelige-flyter`).
- **Avhengighet:** `BEF1`/`BEF2` i befaringsordren kan ikke bygges som beskrevet før bundet-repeater steg 3 finnes. Design varsler mal-Opus særskilt.
- 🔴 **Aktivt kodefunn → BACKLOG § 1:** stille duplikater ved `omrade.slett` (vakt som slipper NULL forbi). Egen runde med rød-først-test.

### 🔴 Observasjon — gjenbruk av branch-navn etter merge (ikke ny regel)
Design pushet `a5c06ed4` oppå den alt-mergede `d21e7011` uten å melde ny hash først, og meldte det i etterkant. **Coworks vurdering:** frys-regelen gjelder mellom «klar for merge» og merge — `d21e7011` var alt merget, så branchen var ikke frosset, den var **gjenbrukt**. Deltaet flyttes ikke til egen branch (koster en runde, fjerner ingen risiko). ⚠️ Men gjenbruk av branch-navn etter merge gjør «er X merget?» tvetydig. Føres som observasjon her — **ikke som ny regel, ikke i `SAMARBEIDSREGLER.md` ennå.**

## 🟢 2026-09-23 — Utilgjengelige maler forklarer seg. `fix/utilgjengelige-flyter` `131dfe7b` `--no-ff`. 🔴 MOBIL (OTA).

🟢 Designgatet (design 2026-09-23) + coworks tekniske gate. Merge `--no-ff` (base `6aa933c0`, 40 commits bak). Non-ff verifisert selv: `mal.ts` og `sjekklister/page.tsx` urørt på develop siden basen, `merge-tree` = 0 konfliktmarkører. Gate `--force` (kjørt på nytt, ikke FULL TURBO): **api 531 (+6)** · db 207 · pdf 124 · shared 854 · web 306 · mobil 38 · 7/7.

- **Utilgjengelige maler forklarer seg:** ny `beregnMalOpprettbarhet` returnerer `utilgjengeligÅrsak` fra **samme kilde** som `opprettbar`. Ny i18n-nøkkel `malVelger.ikkeRegistratorIFaggruppe` («Du er ikke registrator i {{faggruppe}}»), 15 språk.
- 🔴 **Eksisterende feil funnet og fjernet:** `sjekklister/page.tsx` hadde **allerede** en klient-gjetning (`ingenFlytMedMal`) som **aldri kunne se registrator-årsaken**. Lå der fra før — kontrollplan innførte den ikke, han fant den mens han gjorde noe annet. **Eget funn.**
- **Negativ test sett rød først:** 6 tester, 6/6 røde → grønne (`mal-opprettbar-arsak.test.ts`). Teksten vises, tilgangen står.
- 🟢 **`opprettbar` bit-identisk — avklart:** cowork meldte at `faggruppeId IS NOT NULL` → non-null faggruppe-**navn** ikke var bit-identisk. Målt etter designs forespørsel: `Dokumentflyt.faggruppe` er **håndhevet FK** (`onDelete: SetNull`) og `Faggruppe.name` er `String` (ikke nullbar) → **mengdene er IDENTISKE**. Innvendingen var riktig i form, avviket er null i praksis. Kontrollplans «bit-identisk» stemmer.
- 🟢 **Fold-paritet i `OpprettVelger`: NEI, designgatet** (alltid utfoldet oppfyller «synlig med begrunnelse» bedre). ⚠️ **Designs betingelse for framtiden:** blir listen lang, foldes den **MED ANTALL i overskriften** — «3 maler krever registrator-tilgang» — aldri en fold som skjuler at de finnes.
- 🔴 **DØDE FILNAVN** (føres så ingen leter): `ordre-up1-revisjon-betinget-…` ble `-tre-maler` ble **`ordre-up1-deling-fire-maler-design-2026-09-22.md`**. **Kun det siste finnes.**
- 🟢 **Alle tre malordrene er i develop** (`1e2d20cd`, `03f2acc4`, `d21e7011`). **Mal-Opus er IKKE blokkert.**
- 🟡 **Oppfølger → BACKLOG § 1:** undefined-årsak-fallback i `sjekklister/page.tsx` (se BACKLOG).
- **Ny regel i SAMARBEIDSREGLER § Meldingsflyt:** innboksfilen er kanalen, `ls-remote`-verifisering før hash meldes, døde filnavn føres — gjelder begge veier.

## 🟢 2026-09-23 — Fire docs-branches fra design (Kenneths rekkefølge). Ren docs. develop `7212f7cb`.

🟢 Kenneth ga klarsignal til å merge fire docs-only branches i denne rekkefølgen. Alle ff-verifisert (branch 1 hadde eldre base `e32e8f84`, men merget rent — dens eneste endring mot basen er den nye ordre-fila, disjunkt fra mine tavla-edits). Gate `--force`, 0 cached (IKKE FULL TURBO): db 207 · api 525 · pdf 124 · shared 854 · web 306 · mobil 38 — ALT STILLE · 7/7.

| # | Branch | Hash | Innhold |
|---|---|---|---|
| 1 | `docs/design-up1-revisjon-betinget` | `1e2d20cd` | Ordre: UP1 deles i fire kummaler (UP1 revisjon + UP2/UP3/UO2.1 nye). Først i malkøen etter KD1 v3 |
| 2 | `docs/design-um1-revisjon-betinget` | `03f2acc4` | Ordre: UM1 v2 + ny mal UM1.1 (samme branch — UM1 felt 9 peker på UM1.1, hører sammen) + PE-skjot ny mal |
| 3 | `docs/design-byggeleder-befaring` | `d21e7011` | Ny standard BYGGELEDELSE, fire maler (Del B → mal-Opus). **Del A + Del A-TILLEGG er app-arbeid → app-sporet** |
| 4 | `docs/design-utled-plan-fra-beskrivelse` | `86ed7196` | Designnotat + BACKLOG-post. 🔴 **IDÉMYLDRING — ingen agent oppretter branch/kode fra den; drøftes videre, ingenting låst** |

### Til fordeling
- **Malkø (mal-Opus):** KD1 v3 → UP1-deling → UM1 v2+UM1.1 → PE-skjot → BYGGELEDELSE Del B. Alle Kenneth-gatet, ingenting venter på ham. **Fasemålingen mal-Opus leverte (kan et barn ha annen fase enn forelderen) er besvart POSITIV og ført inn i ordrene.**
- 🔴 **App-arbeid fra branch 3:** BYGGELEDELSE **Del A** (app) + **Del A-TILLEGG** (bildelag i tegningsvisningen) skal til app-sporet. Del A-TILLEGG kan bygges uavhengig av Del A.
- **BACKLOG § 1 (branch 4):** 🔴 Befaringsnotat m/ fremdriftslys → autogenerert månedsrapport (bevis til sluttoppgjør, ikke dashbord). Ikke gatet for bygging.

### 🟡 Prosessfunn (design, eier det selv)
- Fire av branchene var ikke pushet før nå — `git fetch` feilet tidlig med nettverksfeil, ble ikke fulgt opp, og hasher ingen kunne nå ble meldt. Rettet, regel ført i designs minne.

---

## 🟢 2026-09-22 — Ordre: utilgjengelige flyter + Kenneth-vedtak om registrator-gaten. Ren docs. develop `6d98c697`.

🟢 **Merget** `docs/design-utilgjengelige-flyter` `e8aa810f` `--no-ff`, ff mot `e32e8f84`. Ny ordre-fil (+62) kontrollplan skal lese i sitt worktree (nudge etter mergen). Gate `--force`, 0 cached (IKKE FULL TURBO): db 207 · api 525 · pdf 124 · shared 854 · web 306 · mobil 38 — ALT STILLE · 7/7.

### 🔴 Kenneth-vedtak 2026-09-22 om registrator-gaten (tre punkter)
1. 🟢 **Gaten BEHOLDES.** Den som oppretter et dokument skal tilhøre faggruppen — **en sjekkliste dokumenterer hvem som utførte og kontrollerte arbeidet.** Oppretter byggherren en elektro-sjekkliste, ser dokumentet ut som noe det ikke er. (Begrunnelsen følger vedtaket om at sjekklisten viser utført arbeid.)
2. 🟡 **«Opprett på vegne av» innføres IKKE nå.** Skal det komme, må dokumentet vise både hvem som opprettet og for hvem. Egen runde, ikke et flagg. → BACKLOG § 1.
3. 🔴 **Den stille forsvinningen rettes — uansett hva svaret på punkt 1 hadde blitt.** Fire Elektro-maler og to Tømrer-maler usynlige for en prosjektadmin, uten forklaring. **kontrollplan bygger.**

### 🟢 Hvordan funnet kom
dokgen målte hvorfor Kenneth så færre maler enn ventet. **Ingenting hadde krasjet — malene var bare ikke der.** Funnet kom av at noen sjekket en forventning mot virkeligheten, ikke av en feilmelding.

---

## 🟢 2026-09-22 — Faggruppe-utledningen VERIFISERT på test (opprett-uten-modal). Ren docs, ingen branch. develop `13b1cf60`.

🟢 Opprett-runden (`feat/opprett-uten-modal`, merget `9b83b285`) er nå bevist på test av dokgen. **«Ikke verifisert»-flagget fjernet.** Gate `--force`, 0 cached (IKKE FULL TURBO): db 207 · api 525 · pdf 124 · shared 854 · web 306 · mobil 38 — ALT STILLE · 7/7.

### 🔴 Hva som er BEVIST — fire dokumenter, `psql` mot `sitedoc_test`
Alle fire lest med `psql`: dokumentets lagrede `bestiller_faggruppe_id`/`utforer_faggruppe_id` joinet mot `dokumentflyter.faggruppe_id` — uavhengig av skjerm OG av API-svaret. For 3 og 4 skrev klienten aldri verdien.

| # | Type | Flate | Flyt (eier) | Bestiller | Utfører |
|---|---|---|---|---|---|
| 1 | Sjekkliste | Web UI | BH→HE-TA (Byggherre) | Byggherre | Byggherre |
| 2 | Oppgave | Web UI | BL→BH (Byggherre) | Byggherre | Byggherre |
| 3 | Sjekkliste | API uten faggruppe | Elektro→HE (Elektro) | **Elektro** | **Elektro** |
| 4 | Oppgave | API uten faggruppe | Elektro→HE (Elektro) | **Elektro** | **Elektro** |

🔴 **Negativkontrollen — rundens avgjørende bevis:** samme mal (`Befaringsrapport`, `1eb8999a`), ingen faggruppe sendt, to flyter: **Elektro→HE gav Elektro · Tømrer→HE gav Tømrer.** To ulike svar fra IDENTISK mal → utledningen følger flyten, er ikke en Byggherre-default og kommer ikke fra klienten.

**Mobil-UI utgår** (ufullstendig Xcode) — dekket via samme kontrakt som `OpprettVelger` bruker. **Kenneth måler mobil-UI på telefon etter OTA** (OTA kjørt 2026-09-22).

### 🔴 Eget funn — registrator-gaten (ikke fotnote)
Dokgen meldte først at web-velgeren viste bare Byggherre-flyter «fordi bare de har maler». Det var feil, og han målte: Elektro har 4 maler, Tømrer 2, HE-Ansatte 6. **Virkelig årsak:** `opprett` kaster **FORBIDDEN** «Du er ikke oppretter-medlem av valgt dokumentflyt» hvis brukeren ikke er registrator-medlem. **Kenneth er registrator kun på Byggherre-flytene — prosjekt-admin-rollen omgår IKKE gaten.** Bekreftet ved at API-kall mot Elektro-flyten gav FORBIDDEN. Forklarer en tilstand Kenneth møter i UI-et hver dag. → BACKLOG § 1.

### 🟢 Dokgens oppsett var reversibelt og ryddet
La seg selv som registrator på to flyter for å komme forbi gaten, merket radene «(dokgen-test)», og **slettet dem etterpå — 0 gjenstår.** Flytenes eier-faggruppe ble aldri endret. Testdokumentene STÅR (trengs når KD1 testes).

---

## 🟢 2026-09-22 — Simulator-dokumentasjon (Xcode 27-oppkobling). Ren docs. develop `38333944`.

🟢 **Merget** `feat/simulator-xcode27-oppkobling` `4d7901b1` `--no-ff`, ff mot `47f24ed8`. Diff = 2 docs-filer (`simulator-opus-oppkobling.md` +53, `simulator-runbook.md` +178) + tavla + STATUS.md. GATE `--force`, 0 cached (IKKE FULL TURBO): db 207 · api 525 · pdf 124 · shared 854 · web 306 · mobil 38 — ALT STILLE (rører ingen kode) · 7/7. *(Design gatet at denne er coworks sak, ikke deres — derfor manglet gate-frasen, riktig her.)*

### Hva som er dokumentert
- Xcode 27 brøt simulator-oppkoblingen. Dokumentert med eksakte feilmeldinger: SimulatorKit-symlinken (kommando, hvorfor, at den endrer Xcode-bunten, hvordan den fjernes), oppstart fra null, dev-login, env-presedens, prod-sperre og 7 nye feilsøkingsrader.
- 🔴 **Mest sannsynlige gjentakelse:** en Xcode-oppdatering vil trolig fjerne symlinken uten å si fra. Da ser feilen ut som «idb virker ikke lenger». Står i feilsøkingstabellen nå.

### 🔴 Tilstand på Kenneths maskin
- **Symlinken STÅR** — Kenneth-gatet til testrunden er ferdig. **Xcode-bunten er dermed modifisert mellom øktene** (ført her så ingen oppdager det som en overraskelse). Å fjerne symlinken krever Kenneths sudo; egen jobb, ikke nå.

---

## 🟢 2026-09-22 — §1e (hjelpetekst-veiledning) + KD1 v3-ordre. Ren docs. develop `8136dd23`.

🟢 **To docs-brancher merget** `--no-ff`, begge ff mot `c17ab1a9`: `docs/design-hjelpetekst-veiledning` `f649823c` (§1e i MAL-METODE.md) · `docs/design-kd1-betinget` `50032404` (KD1 v3-ordre). Diff = 2 docs-filer + tavla. GATE `--force`, 0 cached (IKKE FULL TURBO): db 207 · api 525 · pdf 124 · shared 854 · web 306 · mobil 38 — ALT STILLE (rører ingen kode) · 7/7.

### §1e — hjelpetekst gir nå ekstra veiledning
- Kenneths ord etter å ha prøvd JH2 på telefonen: **«dette er genialt → vi må utvide bruken av måten vi bygger sjekklister → nå kan hjelpetekst i større grad gi ekstra veiledning for hvordan kontrollen skal utføres og med hvilke krav.»**
- **Hvorfor:** før måtte ett felt dekke alle varianter, kravene lå som alternativer og arbeideren fant sin egen rad. Nå vises feltet bare for én situasjon, og teksten kan si nøyaktig hva som gjelder. **Regelen:** skriv kravet (ikke alle) · si hvordan det måles · si hva som skjer ved avvik · la alternativene bli «Innenfor kravet»/«Avvik».

### KD1 v3 bestilt
- Fire felt bærer i dag hver sin kravtabell (tykkelse settelag, fugebredde, planhet, sprang). **Etter runden: ATTEN grener i malen, men arbeideren ser FIRE** — de som gjelder steinen han la.
- 🔴 **Byggekrav mal-Opus skal MÅLE før bygging (ikke noe som virker):** barna hører til andre faser enn forelderen (forelder i FØR, planhet/fugebredde i ETTER). `forgrening()` legger barn rett etter forelderen, så helperen må kunne feste et barn lenger ned. Avstand forelder↔barn er IKKE verifisert i utfyllingen. **Finner han at det ikke virker: STOPP — da tas kravfeltene i samme fase i stedet.**

### 🟡 Nytt funn under måling (ikke bestilt som fiks)
- `JH2` og `KD1` mangler dokumentprefiks i mal-velgeren. `schema.prisma:1287`: maler uten prefiks er NUMMERLØSE, og unikhetsvakten gjelder dem ikke. **redesign måler årsaken nå — design skriver ordren når den er kjent.**

---

## 🟢 2026-09-22 — JH2 v2 (første betingede bibliotekmal) + §6c + opprett-uten-modal. develop `9b83b285`.

🟢 **Tre brancher merget** `--no-ff`, alle ff mot `d738c5ce`: `feat/mal-jh2-betinget` `4f5f6c33` · `docs/design-6a-tre` `bcdcaf21` · `feat/opprett-uten-modal` `21520673`. Diff = 19 filer + tavla + BACKLOG. GATE `--force`, 0 cached (IKKE FULL TURBO): api 525 · mobil 38 · web 306 · db 207 (JH2-testen steg fra 200) · shared 854 · pdf 124 stille · 7/7.

### 🔴 JH2 v2 — FØRSTE bibliotekmal med betingede felt
- Kenneth kjørte SQL-en: **version 2, 12 felt + 3 headings.** Treet **verifisert i ARKIVET, ikke bare i fasiten** — rad 5 og 6 under «Underlaget består av» med hvert sitt utløsersett, rad 7 under «Rengjøring og klebing».
- 🔴 **Fasiten hadde SLETTEDE linjer for første gang** (`50 tillegg, 37 slettinger`). Forventet: JH2 er en REVISJON (v1→v2), ikke ny mal. **Cowork verifiserte: kun `JH2`-rader berørt, slettede linjer utenfor JH2-blokken = 0.** v1-felt «Underlaget rengjort»+«Klebing» slått sammen til felt 5, «Overflaten» slått sammen i felt 10.

### §6c — lukket hull i vår EGEN rutine
- §6a-utskriften viste ikke foreldrekobling eller utløsere. Ved JH2 så design femten korrekte rader uten å kunne se om treet hadde landet, måtte etterspørre egen spørring. **§6c krever nå at revisjons-SQL skriver ut forelder + utløsersett for maler med betingede felt** — Kenneth kjører SQL én gang, gaten gjøres på det ene resultatet. Hullet lå i rutinen, ikke i koden.

### Opprett-uten-modal (kontrollplan, branch 3)
- Server utleder faggruppe via `utledBestillerUtforer` (kalt i BEGGE ruter — `sjekkliste.ts`, `oppgave.ts`) · mobil-modalen bort fra standardveien · emnefeltet inn i dokumentet på begge flater. 7 nye mobilkomponenter, 7 `t()`-kall hver, null hardkodet norsk; web-`EmneVelger` gjenbruker `emneVelger.ingenEmne` (0 i18n-filer).
- 🔴 **Godkjent avvik:** ordren sa serveren utledet alt på standard-veien. Den gjorde det bare på kontrollplan-start. Kontrollplan meldte det i stedet for å bygge etter feil premiss.
- 🔴 **Reload: OTA** (JS-only, 5 mobilskjermer). **Ikke verifisert — cowork + design enige: fire dokumenter på test (sjekkliste + oppgave, web + mobil) med bestiller/utfører kontrollert. Enhetstesten beviser helperen, ikke koblingen.**

### 🟡 Prosessfunn ført til BACKLOG § 1
- Lånt mal kan miste forelder-kobling → viser plutselig alle felt (mal-Opus). · Lokal DB bak på migreringer → ingen agent kan kjøre integrasjonstester lokalt (kontrollplan). Begge Kenneth-gatet på timing.

---

## 🟢 2026-09-22 — Del A: tre-støtte i malverktøyene. Ingen migrering/SQL/mobil. develop `fc2e5c04`.

🟢 **Merget** `feat/mal-tre-kapasitet` `2efcdcf4` (ikke gårsdagens `b1818339`) `--no-ff`. Diff = 7 filer, `apps/` 0 filer, fasit-snap byte-identisk (23 maler urørt). GATE `--force`, 0 cached (IKKE FULL TURBO): **db 200 · shared 854 STEG** (`tre-kapasitet.test.ts` + `bibliotekRader.test.ts`) · api 522 · pdf 124 · web 304 · mobil 34 stille · 7/7.

### Del A er inne
- Malverktøyene kan bygge **forgreninger**. Nøkkelen deles med appen: `seed-bibliotek.ts:15` importerer `BETINGELSE_EGEN_NOKKEL` fra `@sitedoc/shared` og bruker den som computed key `:203` — ingen hardkodet `"conditionOwnValues"`-streng. Seed og app kan ikke drifte fra hverandre igjen.

### Hva feilen var (rekkefølge, ikke slurv)
- `forgrening()` satte `conditionValues` på barnet, mens appen leser `conditionOwnValues`. Appen ville aldri funnet barnets eget sett, falt tilbake til forelderens, og forgreningen ville ikke virket — **uten feilmelding**. Årsak: app-branchen var ikke merget da mal-Opus bygde, så nøkkelnavnet fantes ikke i develop. **Design fanget det før merge.**
- 🟢 **Mal-Opus la inn en regresjonstest** (`mal-fasit.test.ts:512` — `expect(linjer).not.toContain("conditionOwnValues")`) som feiler hvis et barn i en forgrening får `conditionValues` — uten at ordren krevde det.

### 🔴 JH2-piloten er nå ULÅST
- JH2 har ventet siden **2026-09-21**, da mal-Opus **stoppet foran den og målte at mønsteret ikke lot seg uttrykke** i malverktøyene. Hele kjeden som fulgte — per-barn-utløsere, `erObjektSynlig`, rapportfilteret, verifiseringen på ekte data — startet med den stoppen.
- ⚠️ **Mal-Opus har IKKE startet JH2. Design sender startsignalet etter denne mergen.**

### 🟡 Prosessfunn (design 2026-09-22)
- Meldinger design↔mal-Opus går **direkte, ikke gjennom innboksen**. Cowork ser bare om en branch beveger seg, og purret på feil grunnlag. **Designs fiks:** én linje i `inbox-cowork.md` når en direkteordre sendes.

---

## 🟢 2026-09-22 — Ordre: opprettelse uten modal (mobil kopierer web-mønster). Ren docs. develop `2fd9fe09`.

🟢 **Designgatet med hash.** `docs/design-opprett-uten-modal` `a83089e8`, `--no-ff`, ff-mulig, `merge-tree` 0 markører. To nye docs: `designnotat-…md` +78, `ordre-…md` +74.

### Kenneth-vedtak 2026-09-22
- Opprett-modalen på mobil **bort fra standardveien** · faggruppe **utledes av flyten** · emnefeltet inn i dokumentet på **begge** flater · «likt for web og mobil, i hvert fall så likt vi kan».

### 🔴 Funnet som gjør jobben mindre
- **Web gjør det allerede riktig:** `sjekklister/page.tsx:334` setter `bestillerFaggruppeId` fra flyten; maler listes gruppert faggruppe → dokumentflyt → mal. **Mobil er den som avviker — oppgaven er å kopiere web-mønsteret**, ikke bygge nytt.
- **Emne-vedtaket (2026-08-29) er halvveis innfridd:** emne kan endres etter sending, men `EmneVelger.tsx:117` viser i lesemodus bare blek grå kursiv «ingen emne» uten etikett — **derfor tror brukeren feltet er borte.**

🔴 **kontrollplan har IKKE startet — nudgen går etter denne mergen.** (Målt: ⚪ LEDIG.) Han eier bygging av endringen.

**Gate (`--force`, ingen FULL TURBO):** db 189 · api 522 · pdf 124 · shared 852 · web 304 · mobil 34 · 7/7. ALLE stille — ren docs.

---

## 🟢 2026-09-22 — Betinget-kjeden VERIFISERT på ekte data (test `826c8c2f`). Ren docs, ingen branch. develop `826c8c2f`.

🔴 **Ingen branch merget.** Kjeden betinget-per-barn → `erObjektSynlig` → rapportfilteret er verifisert på ekte data på test, og føres her så beviset ikke bare finnes i en chat. **Test kjørte `826c8c2f` under hele verifiseringen.**

### redesign (web, malbygger)
- Per-barn-utløsere vises som knapper på barnet og settes uavhengig.
- 🔴 **Redigering av forelderens utløsere sletter IKKE barnas egne sett** — målt programmatisk gjennom **to** redigeringer, sett identisk før og etter. **Dette var den dyreste mulige feilen** (hele grunnen til `conditionOwnValues`).
- Tomt sett på barn3 gir arv, ikke «aldri synlig». Barnebarn følger foreldrekjeden. Skjult påkrevd felt blokkerer ikke innsending.

### dokgen (rapport, web)
- `BT2-001`: aldri-vist felt **helt borte** · **«Ikke aktuelt» som SVAR står** · synlig-tom = «Ikke utfylt» · notisen vises.
- Regresjon `KB6-006` (flat mal): **alle 3 overskrifter, alle 8 felt, ingen notis.**

### Kenneth (mobil, ekte enhet via OTA til test-kanal)
- `BT2-003` opprettet, utfylt og sendt **på mobil**, mottatt. Tre nivåer: **bundet → epoksy → Kommentar fuge.** Årsak ubundet borte, notisen vist.
- 🔴 **Innsending gikk gjennom med skjult påkrevd felt** — mobil-valideringen bevist for seg.
- 🔴 **Regresjon `KB6-007` på mobil: alle 3 overskrifter, alle 8 felt, INGEN notis.**

🔴 **Viktigst for piloten: alle A.Markussens maler er flate.** De fire hookene mistet 27–33 linjer hver, og «tro flytting» er nå bevist på **ekte mobil-flate**, ikke bare i enhetstest.

### Testdata som står igjen på test — FØRT, ikke slett
`BT2` + `BT2-001`, `BT2-003` · `BT`-kopi (ubrukt, uten flyt) · `KB6-006`, `KB6-007`. 🔴 **Kenneth avgjør oppryddingen — cowork sletter ingenting.**

### Funn → BACKLOG § 1
🟡 **Flytvalg-modalen godtar tomt valg uten varsel** (redesign, samme klasse som stille tomhet) — se BACKLOG § 1 Teknisk gjeld. Kenneth gater timingen.

**Gate (`--force`, ingen FULL TURBO):** db 189 · api 522 · pdf 124 · shared 852 · web 304 · mobil 34 · 7/7. ALLE stille — ingen kode.

---

## 🟢 2026-09-22 — Rapportfilter (pdf-ikke-aktuelt): aldri-viste felt utelates. Ren api+pdf, ingen mobil. develop `e6fc4483`.

🟢 **Designgatet, frossen (tippen = gatet hash — cowork verifiserte selv).** `feat/pdf-ikke-aktuelt` `dbd2d86a`, `--no-ff`, ff-mulig, `merge-tree` 0 markører.

### Rapporten filtrerer via delt kilde — ingen egen vurdering
- **`synlighet.ts:19` importerer og kaller `erObjektSynlig`** (@sitedoc/shared) — samme kilde som skjemaet. Ingen re-implementasjon: `conditionActive`/`utenfor_krav`/`conditionValues` finnes bare i én kommentar (linje 85), ikke som egen evaluering. Cowork-verifisert: 0 db/schema/migrering/mobile, `betingelse.ts` urørt.
- 🔴 **§1c-skillet demonstrert i ÉN rapport:** Siltskjørt → «Ikke aktuelt» **står** (fagperson vurderte) · Klebeprimer → **utelatt** (aldri vist) · Merknad → «Ikke utfylt» **står** (var synlig, tomt).
- 🔴 **Negativkontrollene — leveransens sterkeste del:** no-op-filter → **begge** tester røde; fjern-alle-betingede → **kun** testen som vokter fagvurderingen rød. Asymmetrien beviser at de to testene måler ulike ting.
- **Byte-likhet for maler uten betingelser** bygget inn i regelen (før==etter), ikke bare testet.

### Tre godkjente avvik (ikke drift)
1. Notisen lagt i `dokument.ts`/`typer.ts` (dokumentnivå), ikke `felt.ts` — den er en dokument-notis, ikke en feltverdi.
2. Ferdig nb-streng inn i pdf-pakken — **`packages/pdf/src/arkivmal/` har null `t()`-kall**; branchen følger pakkens mønster, bryter det ikke. 🟡 **Ført i BACKLOG § 1** (arkiv-PDF ikke flerspråklig) så det ikke må gjenoppdages.
3. Tom-overskrift-fjerning trigges mest i kontainere, men bygget generelt.

### Køen etter denne
dokgen har rapporten inne → **mal-Opus retter nøkkelnavnet i del A** (`feat/mal-tre-kapasitet` `b1818339`, urørt — nøkkelnavn-feilen `conditionValues`→`conditionOwnValues` står) → JH2-piloten. 🔴 **Mal-Opus har IKKE startet — design sender ordren.**

**Gate (`--force`, ingen FULL TURBO):** api 513→**522** (+9) · db 189 · pdf 124 · shared 852 · web 304 · mobil 34 (resten stille) · 7/7.

---

## 🟢 2026-09-21 — `erObjektSynlig` samlet synlighetsvurdering merget (kode+mobil). 🔴 MOBIL Reload: OTA. develop `3ecbdff2`.

🟢 **Designgatet, frossen (tippen = gatet hash — cowork verifiserte selv).** `feat/synlighet-samlet` `c9353a31`, `--no-ff`, ff-mulig, `merge-tree` 0 markører.

### Én synlighetskilde
- **`erObjektSynlig` lagt over `erBetingelseOppfylt` (uendret).** Fire hook-kopier av `sjekkSynlighet` borte (web+mobil, sjekkliste+oppgave), hver mister 27–33 linjer. `conditionActive`, `utenfor_krav`, foreldrekjede-rekursjon, dybdevakt på 10, repeater-unntak — alt samlet i `packages/shared/src/utils/betingelse.ts`.
- **Cowork-verifisert tro flytting:** 0 db/api/schema/migrering · `erBetingelseOppfylt` urørt · alle fire hooks kaller `erObjektSynlig`. Diff = 8 filer (`packages/shared/src/utils/CLAUDE.md` = mappe-doc, IKKE rot-CLAUDE.md).
- 🔴 **Reload: OTA** (JS-only, mobil-hooks endret) — Kenneth eier deploy, cowork kjører ikke OTA selv.

### 🔴 § 2b — de fire hookene VAR identiske, bekreftet ved lesing linje for linje
Ikke antatt: noen leste de fire kopiene linje for linje før flyttingen. **Både designs og coworks tidligere «funn» om avvik viste seg å være kommentarer, ikke kode** — den faktiske synlighetslogikken var lik i alle fire.

### 🟢 dokgen stoppet RIKTIG — stoppregelen virket
dokgen målte at `erObjektSynlig` bare fantes i docs på develop (ordren, ikke koden) og bygde **ikke** rundt den. Nå som funksjonen er i develop, er han låst opp. 🔴 **Ikke startet ennå — cowork nudger etter mergen.**

**Køen etter denne:** dokgen bygger rapporten → mal-Opus retter nøkkelnavnet i del A (`feat/mal-tre-kapasitet`) → JH2-piloten.

**Gate (`--force`, ingen FULL TURBO):** shared 844→**852** (+8) · db 189 · api 513 · pdf 124 · web 304 · mobil 34 (resten stille) · 7/7.

---

## 🟢 2026-09-21 — Ordre for samlet synlighetsvurdering (`erObjektSynlig`). Ren docs. develop `9157d961`.

🟢 **Designgatet MED hash, frossen (tippen = gatet hash — cowork verifiserte selv).** Design gatet først `fa618e53`, tok inn coworks krav, re-gatet `0b7d2fe0`. Merget `0b7d2fe0`, `--no-ff`, ff-mulig, `merge-tree` 0 markører.

- **`docs/design-synlighet-samlet` `0b7d2fe0`** (fra develop `7e9dfb9a`): ny ordrefil `ordre-synlighet-samlet-…md` +81.

### Hva ordren låser opp
- **`erBetingelseOppfylt` dekker kun verdimatchen.** `conditionActive`, `utenfor_krav` og foreldrekjede-rekursjonen ligger fortsatt i fire hooks. Ny **`erObjektSynlig`** legges over — én samlet synlighetsfunksjon.
- 🔴 **dokgen er BEVISST HOLDT TILBAKE**, ikke glemt: rapporten hans må kalle den samlede synlighetsfunksjonen, som ikke finnes ennå.
- **Kjeden: redesign → dokgen → JH2-piloten.** Denne ordren låser opp redesign, som låser opp dokgen.
- 🔴 **Redesign har IKKE startet** — nudgen går etter denne mergen. (Målt tilstand: ⚪ LEDIG, ingen ny branch pushet.)

**Gate (`--force`, ingen FULL TURBO):** db 189 · api 513 · pdf 124 · shared 844 · web 304 · mobil 34 · 7/7. ALLE stille — ren docs.

---

## 🟢 2026-09-21 — PDF-rapportordre (docs) + betinget-per-barn app-endring (kode+mobil) merget. 🔴 MOBIL Reload: OTA. develop `14fd4bd0`.

🟢 **Begge designgatet MED hash, begge frosne (tippen = gatet hash — cowork verifiserte selv):** `docs/design-pdf-ikke-aktuelt` `dbe609e1`, `feat/betinget-per-barn` `80373ebf`. Begge `--no-ff`, ff-mulig, `merge-tree` 0 markører.

### PDF-rapportvedtaket (Kenneth 2026-09-21) — MAL-METODE + ordre
- **Felt som ALDRI ble vist, utelates helt** fra rapporten; tomme overskrifter faller bort. Én setning vises når noe er utelatt: «Felt som ikke gjaldt dette arbeidet, er utelatt.»
- 🔴 **«Ikke utfylt» står fortsatt der feltet VAR synlig og er tomt** — en reell mangel skal synes.
- 🔴 **Skillet (MAL-METODE §1c):** «Ikke aktuelt» som **svar** blir stående — en fagperson har vurdert og konkludert. Det som utelates er felt som aldri ble vist.
- **Selve PDF-endringen bygges ikke ennå** — ordren merges nå, agent velges etterpå.

### App-endringen — betinget-per-barn (`feat/betinget-per-barn`)
- **Delt `erBetingelseOppfylt` i `@sitedoc/shared`** (`utils/betingelse.ts`), fire hook-kopier borte (web+mobil sjekkliste+oppgave kaller nå den delte funksjonen).
- 🔴 **Godkjent avvik, ikke drift:** ordren sa gjenbruk `conditionValues`; redesign målte at en kontainer som selv er betinget barn allerede bruker `conditionValues` i **forelder-rollen**, og at malbyggeren støtter nøsting — gjenbruk ville blitt en stille felle. Ny nøkkel **`conditionOwnValues`** (0 treff på develop før, ny). Cowork-verifisert: 0 db/migrering/schema · i18n 30 tillegg/0 slettinger (ingen eksisterende nøkkel rørt) · alle fire hooks kaller `erBetingelseOppfylt`.
- 🔴 **Reload: OTA** (kun JS/hook-logikk, ingen native) — Kenneth eier deploy, cowork kjører ikke OTA selv.

### 🔴 `feat/mal-tre-kapasitet` `b1818339` — STOPPET, IKKE MERGET (bevisst)
Design fant en reell feil: `forgrening()` setter **`conditionValues`** på barnet, men app-endringen leser **`conditionOwnValues`**. Appen ville falt tilbake til forelderens sett og forgreningen ville ikke virket — uten feilmelding. Årsaken var rekkefølgen: app-branchen var ikke merget, så nøkkelnavnet var ikke synlig for mal-Opus. 🟢 **Derfor merges app-endringen FØRST** — nå ser mal-Opus nøkkelen i develop og kan rette mot kode. Branchen står **urørt på origin**; design sender rette-ordre.

**Gate (`--force`, ingen FULL TURBO):** shared 834→**844** (+10 `betingelse.test.ts`) · db 189 · api 513 (begge stille) · pdf 124 · web 304 · mobil 34 (uendret) · 7/7.

---

## 🟢 2026-09-21 — Ordrer for betinget-per-barn (app-spor) + del A-tre (mal-spor). JH2-pilot stanset. Ren docs. develop `dba927e7`.

🟢 **Designgatet med ordene «Designgatet – klar for merge».** Én branch, `--no-ff`, ekte ff-mulig (develop var ancestor), `merge-tree` 0 markører.

- **`docs/design-betinget-per-barn` `56267af9`** (fra develop `ac4658d2`): to nye ordrefiler — `ordre-betinget-per-barn-…md` +77, `ordre-mal-del-a-tre-…md` +46.

### 🔴 Grensen mal-Opus fant — og STOPPET FØR bygging fordi han målte
JH2 v2-piloten (betingede felt) traff en reell grense: **`conditionValues` ligger på FORELDEREN og deles av alle barna** (`useSjekklisteSkjema.ts:324`), så «vis felt A ved svar 1 og felt B ved svar 2» er ikke uttrykkbart i dagens modell. 🟢 **Mal-Opus målte dette på begge plattformer i stedet for å bygge en halv løsning** — det er atferden vi vil ha, og den skal være synlig her, ikke bare i en innboks. Design verifiserte grensen i koden (`useSjekklisteSkjema.ts:324`). **Kenneth gatet app-endringen.**

### To spor ut av grensen
- **App-sporet** (`ordre-betinget-per-barn`) → **redesign.** 🔴 Redesign har **IKKE startet** — pekeren ligger i `relay/inbox-redesign.md`, nudgen sendes ETTER denne mergen (ellers peker ordren på en fil som ikke finnes i hans worktree).
- **Mal-sporet** (`ordre-mal-del-a-tre`) → **mal-Opus**, på `feat/mal-tre-kapasitet`. Uavhengig spor, ingen SQL, rører ikke `apps/`. Målt tilstand: worktreet står på branchen, men HEAD = develop-tip `ac4658d2` — **ingen commit/push ennå, ikke på origin**.

### 🔴 JH2-piloten er STANSET — bevisst, ikke åpent løst
JH2 v2 (betingede felt) bygges **ikke** før app-endringen (betinget-per-barn) er inne. Dette er en bevisst stans forankret i en målt modellgrense, ikke et halvferdig arbeid som drifter.

**Gate (`--force`, ingen FULL TURBO):** api 513 · db 189 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. ALLE stille — ren docs.

---

## 🟢 2026-09-21 — To docs-brancher: FP1-ordren rettet + pilot betingede felt. Ren docs. develop `854f6ef4`.

🟢 **Første runde etter § MALØYPE-regelen om gate-melding:** begge brancher bar ordene «Designgatet – klar for merge» — gate-ordet på plass for begge, ikke bare målt eksistens.

**To brancher, begge `--no-ff`, begge non-ff verifisert selv:**
- **1 — `docs/design-runde-e` `e4498500`** (base `73869c99`): `ordre-fp1-…md` +5/−1.
- **2 — `docs/design-betingede-felt` `f0980684`** (base `7c328207`): `designnotat-betingede-felt-…md` +90, `ordre-jh2-revisjon-betinget-…md` +183.

🔴 **Non-ff-målingen gjort mot BASEN, ikke 2-punktsdiffen:** begge brancher har eldre base enn develop-tippen (`81da4795`), så `git diff develop..branch` er falskt reversert (viser develops arbeid som «fjernet»). Målt riktig: hver branchs EGNE endring mot sin base = kun de listede filene · filene hver branch rører er urørt på develop siden basen (0 develop-commits) · `merge-tree` = **0 konfliktmarkører** for begge. Samlet merge-resultat mot develop = de 3 docs-filene, ingenting annet.

### FP1-ordren rettet — bestilling OG opptegnelse
- **Feltlista (bestillingen) rettet:** felt 8 «50 bolter **per 1000**» → «50 bolter **pr. 1000 satte**», husstil «pr.» i satser. Dette er ordren mal-Opus bygger etter.
- **Gammel ordlyd bevart som datert sitat** med begrunnelse — opptegnelsen skrives ikke om. Begge deler samtidig: bestillingen rettes, historikken står.
- 🟢 **Krediteringen bevart:** merknaden «etter mal-Opus' flagg — flagget riktig i stedet for å endre en gatet ordlyd selv». Det er atferden vi vil ha mer av.

### Pilot betingede felt (JH2 v2) — lesbar, IKKE startet
- **Designnotat + JH2 v2-ordre** ligger i develop med Kenneths faglige rettinger (Ag/Agb/Ab, bundet mot ubundet underlag, mykasfalt produseres varm).
- 🔴 **Mal-Opus har IKKE startet piloten.** Design sender startsignalet ETTER denne mergen. (Tavla-raden hans måles, ikke antas — står fortsatt ⚪ LEDIG.)

**Gate (`--force`, ingen FULL TURBO):** api 513 · db 189 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. ALLE stille — runden rører ingen kode.

---

## 🟢 2026-09-21 — Runde E-rettelse: FP1 f08 følger husstilen «pr.» i satser. Ingen migrering, ingen SQL, ingen mobil. develop `aa9fd26b`.

**Én branch, `--no-ff`:** `feat/mal-runde-e` `172529ed` — to kodefiler (`seed-bibliotek.ts` + `mal-fasit.snap.md`), hver `1 1`.

### Rettelsen
- **FP1 f08 hjelpetekst:** «Deretter 50 bolter **per 1000**.» → «Deretter 50 bolter **pr. 1000 satte**.» I både seed (`FP1_MAL`) og fasiten. Følger husstilen «pr.» i satser/enheter (CLAUDE.md § Språk). Ingen annen tekst rørt.
- ⚠️ **Eneste gang fasiten endres uten at slettetallet er 0 — og det er riktig her:** en RETTELSE av eksisterende tekst SKAL vise 1 slettet + 1 lagt til. Fasit-diff målt = nøyaktig **`1 1`**.
- **`per 1000` = 0 treff i kodefiler** (seed + fasit) på develop etter merge. De 2 gjenværende repo-treffene ligger i design-ordredokumentet `ordre-fp1-ny-mal-design-2026-09-21.md` — historisk record av malteksten, korrekt latt urørt.

### 🔴 PROSESSFUNN — runde E ble merget UGATET (coworks ansvar)
`0ab36a84` merget runde E til develop **før design hadde gatet den.** Årsaken var coworks ordre: branchen ble tatt inn fordi cowork hadde **målt at den fantes på origin**, ikke fordi det forelå en «Designgatet – klar for merge». Design holdt den tilbake nettopp med denne tekstrettelsen — men meldingen gikk til mal-Opus, ikke cowork. **Ingen skade, fordi SQL-en ikke var kjørt — men det var flaks, ikke system.**

⚠️ **Ikke designs feil:** deres tilbakeholdelse gikk til mal-Opus. Coworks egen merge-regel skulle uansett fanget det.

🔴 **Ny regel i `SAMARBEIDSREGLER.md` § MALØYPE (etter punkt 3):** en pushet branch er IKKE et klarsignal — gate-MELDINGEN «Designgatet – klar for merge» i `relay/inbox-cowork.md` for nøyaktig den branchen utløser merge, ikke branchens eksistens. Gjelder også når cowork har målt branchen på origin.

---

## 🟢 2026-09-21 — Tre rettinger + Runde E (FJ1 + FP1) + ordrene merget. Ingen migrering, ingen mobil-kode. develop `e4ada0e3`.

**Tre brancher, alle `--no-ff`, alle konfliktfrie mot develop (merge-tree 0 markører — verifisert selv etter at develop hadde flyttet til `2d2a32b9` for CLAUDE.md-runden):**
- **1 — `fix/tre-smaa-rettinger` `2438886b`** (18 filer: 2 api, 1 web hms, 15 i18n).
- **2 — `feat/mal-runde-e` `963d34d6`** (5 filer, `packages/db/prisma`): `seed-bibliotek.ts` · `fj1-mal.test.ts` + `fp1-mal.test.ts` · `generer-mal-sql.test.ts` · `mal-fasit.snap.md`.
- **3 — `docs/design-runde-e` `73869c99`** (🔴 ikke ff, base `4b46aa2b`): to nye ordrefiler `ordre-fj1-…` + `ordre-fp1-…`. Non-ff trygghetsmålt selv: begge nye, 0 commits på develop siden basen, merge-tree 0 markører.

### De tre rettingene — designgatet per sak
- **`dismissed`-råstreng:** `dismissed: "status.avvist"` i `STATUS_I18N`. Funnet bekreftet — `dismissed` sto i `FIRMA_TERMINALE` og ble vist rått. `rejected` er inert og latt stå (som ordren sa).
- **Tiebreaker:** `orderBy: [{ sortering }, { kode }]` på både standarder og kapitler; enhetstesten sett rød først (`api` 511→513). 🔴 **Presisering (ordrett i innhold):** enhetstesten låser at spørringen **ber om** tiebreakeren; at databasen faktisk **leverer** den rekkefølgen kan bare en integrasjonstest vise. Design har vurdert dekningen som god nok her.
- **Dokumentklasse:** `nb.json` «Dokumentklasse», `en.json` «Document class», 13 språkfiler med én endret linje hver. Ingen drift dratt med.

### Runde E — FJ1 + FP1
- **FJ1 + FP1 v1.** 🟢 **Generatoren (`generer-mal-sql.ts`) er URØRT** — kun `generer-mal-sql.test.ts` endret. **SQL-regelen utløses altså ikke av generatorendring denne runden**, men malene er nye, så Kenneth kjørte SQL-en (gatemelding). Merge-agenten kjørte ikke SQL selv.
- **🔴 REN TILLEGG — verifisert med tall:** `git diff --numstat` på `mal-fasit.snap.md` = **`108 0`** (0 slettinger). **Biblioteket har nå 23 maler.**

**Gate (`--force`, 0 cached, ingen FULL TURBO):** api 511→**513** (tiebreaker) · db 175→**189** (FJ1+FP1) · pdf 124 · shared 834 · web 304 · mobil 34 (alle fire stille) · 7/7. Ingen migrering, ingen mobil-kode. *(web/shared kunne steget på i18n-endringen, men gjorde det ikke — endringene var verdiendringer, ikke nye nøkler/tester.)*

🔴 **i18n-fella er ALLEREDE dokumentert** i `shared-pakker.md` (kodelinje `generate.ts:70`, filteret `!eksisterende[key]`, «Bekreftet på nytt 2026-09-11»). **Dette er fjerde gang den ikke ble funnet** — det er selve poenget, og grunnen til at regelen ble løftet til `CLAUDE.md` i egen runde (`325edf37`). **Ikke skrevet inn på nytt i `shared-pakker.md`.**

---

## 🟢 2026-09-21 — CLAUDE.md § i18n: regel om ENDRING av eksisterende nøkkel løftet inn. Ren docs, ingen branch. develop `325edf37`.

**Ingen merge-branch — én direkte commit på `CLAUDE.md` (Kenneth-gatet):** i18n-punkt 3 fikk én setning — **endrer du en EKSISTERENDE nøkkel, slett den fra de 13 målspråkene først; `--only` fyller kun manglende, oppdaterer aldri.**

🔴 **Begrunnelse (hvorfor den flyttes, ikke bare at den finnes): tredje gjenoppdagelse.** Fella er allerede dokumentert i `shared-pakker.md` (kodelinje `generate.ts:70`, filteret `!eksisterende[key]`, «Bekreftet på nytt 2026-09-11»), men `CLAUDE.md:223` — det agentene leser ved sesjonsstart — beskrev bare `--only` for å LEGGE TIL nøkler. Regelen løftes dit fordi det er der den blir lest.

**Størrelsesgate (`wc -m`, ikke `wc -c`):** CLAUDE.md 40486 → **40541 tegn, margin 419** (grense 40960; krav ≥400). Komprimerte tre eksempler/datoer i samme i18n-blokk — **kun eksempler og datoer, ingen begrunnelse rørt**: datoen «(funnet 2026-08-24)» på ikke-JSX-punktet, parentesen «(lærdom `hjelp.flyt.*` 2026-05-23)» på diagnostikk-regelen, og ett av tre gjenbruks-eksempler (`handling.avbryt`). Reglenes hvorfor-setninger står intakt.

**Gate — ALT HELT stille (`--force`, 0 cached, ingen FULL TURBO):** db 175 · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. Runden rører ingen kode.

---

## 🟢 2026-09-21 — MAL-METODE §6b (feltnummer vs. radnummer) + ordre «tre små rettinger» merget. Ren docs. develop `b506d551`.

**To brancher, begge `--no-ff`, begge ff-mulig mot `4b46aa2b`:**
- **1 — `docs/design-feltnummer` `003ceaea`**: `docs/claude/MAL-METODE.md` (`+16/−0`) — §6b.
- **2 — `docs/design-tre-smaa` `efc4453b`**: `docs/redesign/ordre-tre-smaa-rettinger-design-2026-09-21.md` (ny) — dismissed-råstreng, kapittel-tiebreaker, Dokumenttype→Dokumentklasse.

**MAL-METODE §6b er inne:** et felt har to tall — **feltnummer** (ordre/test/fasit, uten overskrifter) og **radnummer** (psql-utskrift/`sort_order`, med overskrifter). Regelen: si alltid hvilken telling; ved tvil er fasitfilen fasit. (Løser JH2-forvirringen fra runde D — «felt 13» i gatemeldingen var radnummeret; feltnummeret er 10.)

**Ordren for de tre små rettingene ligger lesbar i develop** — redesign eier dem. 🔴 **Redesign har IKKE startet; nudgen sendes etter denne mergen.**

**Gate — ALT HELT stille (`--force`, 0 cached, ingen FULL TURBO):** db 175 · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. Runden rører ingen kode.

---

## 🟢 2026-09-20 — Runde D: FF1 + JH2 (fjerde standard NS 3420-J) merget + MAL-PLAN-rydding. Biblioteket har 21 maler i fire standarder. Ingen migrering, ingen mobil. develop `42bdb03e`.

**To brancher, begge `--no-ff`, begge ff-mulig mot `692dfefd`:**
- **1 — `feat/mal-runde-d` `fe97e498`** (seks filer, alle `packages/db/prisma`): `seed-bibliotek.ts` · `ff1-mal.test.ts` + `jh2-mal.test.ts` · `generer-mal-sql.ts` (4 linjer) + `generer-mal-sql.test.ts` · `mal-fasit.snap.md`.
- **2 — `docs/design-rydding` `c946c01c`**: `docs/claude/MAL-PLAN.md` (`+18/−7`) + `docs/redesign/status-designsporet-2026-09-20.md` (ny).

**🔴 REN TILLEGG — verifisert med tall:** `git diff --numstat` på `mal-fasit.snap.md` = **`110 0`** (0 slettinger). Ingen eksisterende maltekst endret.

**🟢 MAL-PLAN-rydding er statusoppdatering, ikke drift:** de sju slettede linjene i `MAL-PLAN.md` var **stale status-/planrader** (gamle statuser «klar for merge»/«–»/«Starter etter …» for FS2/FD2/FH1/FS3, FB4/FD3-parkeringsrader, og planplassholderen «Del U – rørledning i grøft») — alle **erstattet av korrekte merget-rader** (nå rad 10–21). Intet innhold forsvant uten erstatning.

**FF1 (10 felt + 3 headings) + JH2 (11 felt + 3 headings), begge v1.** **Kapitlene FF og JH opprettet.** **Biblioteket har nå 21 maler i fire standarder — K, F, U og J.**

**🔴 To ting eksplisitt:**
- **§7c virker i praksis:** JH2 navngir **N200 ordrett** — første mal som peker arbeideren til en kilde han faktisk kan åpne (gratis offentlig vegvesen-håndbok; NS-standarden navngis ikke).
- **FF fikk sortering 4** — som var **ledig mellom FD og FH**. **Ingen eksisterende kapitler flyttet.**

**🟢 GODKJENT GENERATORENDRING (ikke drift):** `kapittelArrays()` kjente bare K/F/U; den fjerde standarden krevde `KAPITTEL_DATA_J` + oppslag i `kapittelArrays()`. Nødvendig for standard nr. 4, testdekket.

**Gate — KUN db steg, alle andre HELT stille (`--force`, 0 cached, ingen FULL TURBO):** db 156→175 (**+19**, FF1+JH2-tester + utvidet generator-test) · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. Ingen migrering, ingen mobil-endring, ingen i18n.

**SQL-regelen (§8b) utløst og fulgt:** generatoren er endret (`generer-mal-sql.ts`, 4 linjer), så SQL mot test kreves. **Kjørt av Kenneth, `ff1-jh2-test.sql`:** fjerde standard NS 3420-J:2008 opprettet, kapitlene FF og JH opprettet, FF1 v1 (10 felt + 3 headings), JH2 v1 (11 felt + 3 headings). 🔴 §1b: én kjøring per fil — merge-agenten kjørte ikke SQL selv.

**Ingen ny malordre i kø.** 🟡 **Målt: mal-Opus har ikke startet ny runde** — worktreet står på `feat/mal-runde-d` (nå merget), ingen kodebranch utover runde D. Neste kandidater står i `docs/redesign/status-designsporet-2026-09-20.md`; startsignalet sender design.

---

## 🟢 2026-09-20 — Runde C: UP1 + FB1 (nytt kap UP) merget + runde D-ordrene lagt lesbare. VA-kjeden komplett. Ingen migrering, ingen mobil. develop `ca44f9e3`.

**To brancher, begge `--no-ff` — runde C først (blokkerte D):**
- **1 — `feat/mal-runde-c` `aec7688f`** (🔴 ikke ff, base `37864435`; seks filer, alle `packages/db/prisma`): `seed-bibliotek.ts` · `up1-mal.test.ts` + `fb1-mal.test.ts` · `generer-mal-sql.ts` (`+76/−4`) + `generer-mal-sql.test.ts` · `mal-fasit.snap.md`. **Non-ff trygghetsmålt selv:** alle fire kodefiler 0 commits på develop siden basen, `merge-tree` → 0 konfliktmarkører. Ingen rebase.
- **2 — `docs/design-runde-d` `63b56af7`** (ff-bar): `docs/claude/MAL-METODE.md` (§7c) + `ordre-ff1-ny-mal-design-2026-09-20.md` + `ordre-jh2-ny-mal-design-2026-09-20.md`.

**🔴 REN FLYTTING/TILLEGG — verifisert med tall:** `git diff --numstat` på `mal-fasit.snap.md` = **`113 0`** (0 slettinger). Ingen eksisterende maltekst endret.

**UP1 (12 felt + 3 headings) + FB1 (10 felt + 3 headings), begge v1.** **Nytt kapittel UP** (i NS 3420-U). **Kapittelet FB er ikke lenger tomt.** **Biblioteket har nå 19 maler**, og **VA-kjeden er komplett: FD2 → UM1 → UP1 → FS3 → UU1.**

**🟢 GODKJENT UTVIDELSE (ikke drift):** mal-Opus løste sorteringsrettingen (UU → sortering 3) som et `--sorter KODE=n`-valg i generatoren i stedet for håndskrevet SQL — smal, innenfor riktig standard, kun modus `ny`, testdekket. Design har godkjent.

**Gate — KUN db steg, alle andre HELT stille (`--force`, 0 cached, ingen FULL TURBO):** db 137→156 (**+19**, UP1+FB1-tester + utvidet generator-test) · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. Ingen migrering, ingen mobil-endring, ingen i18n.

**SQL-regelen (§8b) utløst og fulgt:** generatoren er endret (`+76/−4`), så SQL mot test kreves. **Kjørt av Kenneth, `up1-fb1-test.sql`:** kapittel UP opprettet, UP1 v1, FB1 v1, `UPDATE 1` flyttet UU til sortering 3. 🔴 §1b: én kjøring per fil — merge-agenten kjørte ikke SQL selv.

**Runde D-ordrene (FF1, JH2) + MAL-METODE §7c ligger lesbare i develop.** 🟡 **Målt: mal-Opus har IKKE startet runde D** — worktreet står fortsatt på `feat/mal-runde-c`, ingen runde-D-kodebranch finnes. Startsignalet sender design.

### 🟡 BACKLOG-post fra runde C — kapittel-sortering mangler tiebreaker
- `bibliotek.ts:37` sorterer kapittel-lista kun på `sortering`, uten tiebreaker. To kapitler med samme tall gir udefinert rekkefølge i UI-et — samme klasse som «stille tomhet».
- **Selve tilfellet er løst i runde C** (UU flyttet til egen sortering). Koden bør sortere på `sortering`, deretter `kode`. **Ikke hastesak, ikke fikset i denne runden — ført til cowork/BACKLOG.**

---

## 🟢 2026-09-20 — Ordrefiler for runde C (FB1 + UP1) lagt i develop. Ren docs. develop `c0985f7c`.

**Én branch `docs/design-runde-c` `ea7f5d48` [no-ff]:** to NYE ordrefiler i `docs/redesign/` — `ordre-fb1-ny-mal-design-2026-09-20.md` (130 linjer) + `ordre-up1-ny-mal-design-2026-09-20.md` (162 linjer). Begge status `A`, 0 slettede linjer, ingen eksisterende fil rørt.

**Gate — ALT HELT stille (`--force`, 0 cached, ingen FULL TURBO):** db 137 · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. Runden rører ingen kode.

🔴 **RETTELSE (korreksjon av påstand, ikke en statusendring):** denne seksjonen sa opprinnelig at ordrefilene var «klare for mal-Opus / ingen har startet». **Det var feil.** Runde C var på det tidspunktet allerede **bygget, frosset og designgatet** (`feat/mal-runde-c` `aec7688f`). Feilen kom fra coworks ordre, som skrev «ingen har startet» uten å ha lest inboksen. **Det som faktisk skjedde:** ordrefilene ble lagt i develop mens malbygget allerede var gatet — ikke som et startsignal.

---

## 🟢 2026-09-20 — Runde B: UM1 + UU1 (ny standard NS 3420-U) + MAL-PLAN merget. Del U påbegynt. Ingen migrering, ingen mobil. develop `0b1506d1`.

**To brancher, begge `--no-ff`, begge ff-mulig mot `717f5981`:**
- **1 — `feat/mal-um1-uu1` `9c9af247`** (seks filer, alle `packages/db/prisma`): `seed-bibliotek.ts` (UM1+UU1, hver 11 felt + 3 headings, modus «ny»; kapitlene UM og UU) · `um1-mal.test.ts` + `uu1-mal.test.ts` · `generer-mal-sql.ts` (`+75/−9`) + `generer-mal-sql.test.ts` (`+100/−2`) · `mal-fasit.snap.md`.
- **2 — `docs/design-malplan-2` `b6076127`**: `docs/claude/MAL-PLAN.md`.

**🟢 GODKJENT AVVIK (ikke drift):** ordrene fra 19.09 sa separate brancher for UM1 og UU1; **én felles branch fulgt Kenneths samlerunde-vedtak 20.09**. Innholdet er uendret. Design har godkjent.

**Biblioteket har nå TRE standarder: NS 3420-K, -F og -U.** **Generatoren er utvidet:** den kan nå **opprette en manglende standard** (`opprettStandardSql`) og **bygge flere nye maler i én fil** (`byggFlerNySql`). K- og F-maler får no-op standard-INSERT.

**🔴 REN FLYTTING/TILLEGG — verifisert med tall:** `git diff --numstat` på `mal-fasit.snap.md` = **`111 0`** (111 tillegg, **0 slettinger**). Ingen eksisterende maltekst endret.

**Gate — KUN db steg, alle andre HELT stille (`--force`, 0 cached, ingen FULL TURBO):** db 111→137 (**+26**, UM1+UU1-tester + utvidet generator-test) · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. Ingen migrering, ingen mobil-endring, ingen i18n.

### 🔴 SQL-REGELEN UTLØST OG FULGT — første gang i praksis (2026-09-20)
- Dette er **første runde som treffer den nye SQL-regelen** (MAL-METODE §8b): generatoren ER endret (`generer-mal-sql.ts` `+75/−9`), og regelen sier da at SQL mot test **skal** kjøres.
- **Den er kjørt — av Kenneth, `um1-uu1-test.sql`** (designgate-input): ny standard NS 3420-U opprettet, kapitlene UM og UU opprettet, UM1 og UU1 v1 med 11 felt + 3 headings hver, tekstbevis ordrett (45 og 49 tekster, målt av design).
- 🔴 **§1b: én kjøring per fil, aldri to.** Merge-agenten kjørte ikke SQL selv.

---

## 🟢 2026-09-20 — FB4/FD3 løftet inn i malfasiten + SAMARBEIDSREGLER: gate-tall fra `--force`. Ingen migrering, ingen mobil, ingen SQL. develop `a0349089`.

**To brancher, begge `--no-ff`:**
- **1 — `feat/mal-fasit-fb4-fd3` `10e04f72`** (ff-bar): `seed-bibliotek.ts` (FB4/FD3 løftet fra inline-blokk til `export const *_MAL`) + `mal-fasit.snap.md` (FB4/FD3 nå med i snapshotet).
- **2 — `docs/design-fasit-fb4-fd3` `c05897fe`** (🔴 ikke ff, base `af349b0e`): `docs/redesign/ordre-fasit-fb4-fd3-design-2026-09-20.md`. Trygghetsmålt: fila urørt på develop siden basen (0 commits), `merge-tree` → 0 konfliktmarkører. Ingen rebase.

**🔴 REN FLYTTING — verifisert med tall:** `git diff --numstat` på `mal-fasit.snap.md` = **`74 0`** (74 tillegg, **0 slettinger**). Ingen eksisterende maltekst endret; FB4/FD3-teksten er identisk, kun løftet inn i fasitens dekningsområde. `seed-bibliotek.ts` viser 92/88 (strukturell inline→export-flytting) — men snapshotens 0 slettinger er garantien for at innholdet er uendret.

**Gate — ALLE HELT stille, kjørt med `--force` (0 cached, ingen FULL TURBO):** db **111 uendret** (runden la ikke til testfil, bare innhold i eksisterende snapshot) · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. Ingen migrering, ingen mobil-endring, ingen i18n, ingen SQL.

**🟡 MÅLT (ikke endret): FB4/FD3 er nå med i `malRegister()`** (kjente refs: FB4, FD1, FD2, FD3, FH1, FS2, FS3, KA7, KB2, KB4, KB6, KC3.1, KD1, KD2, KM2). Konsekvens: `generer-mal-sql.ts` **kan** nå produsere SQL for dem, og §7b-vakter kan se dem. Ingen effekt i denne runden (generator/SQL ikke rørt), men **kjør ikke generatoren mot FB4/FD3 før normkode-revisjonen er Kenneth-gatet**.

**🔴 FB4/FD3-fasithullet fra forrige runde er nå LUKKET.** Presisering: **normkodene i FB4/FD3-hjelpetekstene står fortsatt urettet** — det er bevisst, Kenneth-gatet. De rettes ved revisjon og vil da vises som ekte diff mot fasiten.

**SAMARBEIDSREGLER (samme commit):** ny regel «Gate-tall skal komme fra `--force`, ikke fra cache» lagt inn under § «GATE-TALL SKAL SI HVA SOM KJØRTE» — et FULL TURBO-treff er ikke en gate-kjøring; gaten er en observasjon, ikke et oppslag.

---

## 🟢 2026-09-20 — Malfasit + lokalt tekstbevis (skriv-mal) merget. Ingen migrering, ingen mobil, ingen SQL. develop `c1d51726`.

**To brancher, begge `--no-ff`, begge ff-mulig mot `af349b0e`:**
- **A — `feat/mal-fasit` `fa60f2b2`** (fire filer, alle `packages/db/prisma`): `mal-fasit.snap.md` + `mal-fasit.test.ts` (låser HELE maltekstene — hjelpetekster **og** alternativer, ikke bare etiketter; endres en tekst senere blir det en diff i `pnpm test`, ikke en stille passering) · `skriv-mal.ts` + `skriv-mal.test.ts` (skriver ut malen lokalt i §6a-form via `byggBibliotekRader`, uten DB/scp/docker/TTY).
- **B — `docs/design-malfasit` `b7bb1f4a`** (to filer): `docs/claude/MAL-METODE.md` §8/§8b + `docs/redesign/ordre-malfasit-design-2026-09-20.md`. Kenneth-gatet 2026-09-20.

**Runden legger et lag OVER seeden — `seed-bibliotek.ts` og `generer-mal-sql.ts` er URØRT.** Innholdsgaten går nå på **lokal utskrift** (`skriv-mal.ts`, låst av malfasiten), ikke på SQL mot test. **SQL mot test kjøres per RUNDE (ikke per mal), og alltid når `generer-mal-sql.ts`/`byggBibliotekRader` er endret** (MAL-METODE §8b, Kenneth-gatet).

**Gate — KUN db steg, alle andre HELT stille:** db 106→111 (**+5**, malfasit + skriv-mal-tester, to nye testfiler) · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · integrasjon 61 · 7/7. Ingen migrering, ingen mobil-endring, ingen i18n, ingen SQL.

**`docs/design-um1` + `docs/design-uu1` IKKE merget** — begge er allerede i develop (inn med `083ac0da` 19.09; verifisert med `git merge-base --is-ancestor` → ancestor). Å merge dem ville gitt tomme merge-commits.

**§4-verifisering utført:** `skriv-mal.ts` kjørt for FD1 (`pnpm --filter @sitedoc/db exec tsx prisma/skriv-mal.ts FD1`) — full §6a-utskrift kom (metadata + 13+ objektrader med type/label/alternativer/hjelpetekst). Scriptet virker, ikke bare grønn test.

### 🔴 HULL I FASITEN — `FB4` og `FD3` er inline-blokker, ikke dekket (2026-09-20)
- `FB4` og `FD3` ligger som **inline-blokker i F-arrayet** i `seed-bibliotek.ts`, ikke som eksporterte konstanter. Malfasiten dekker kun eksporterte `*_MAL`-konstanter → **teksten deres er fortsatt ULÅST**.
- Begge bærer **gamle normkoder i hjelpetekstene**.
- 🔴 **Ikke fikset — Kenneth avgjør timingen.** Ført her kun for at hullet skal være synlig. (design står alt på `docs/design-fasit-fb4-fd3`.)

---

## 🟢 2026-09-20 — FH1 + FS3 omkodet + samlerunder-docs merget. Del F ferdig omkodet. develop `d876932a`.

**To brancher:** `feat/mal-fh1-fs3` `00cd602f` (`seed-bibliotek.ts` + `fh1-mal.test.ts` + `fs3-mal.test.ts` + `generer-mal-sql.ts` + `generer-mal-sql.test.ts`) · `docs/design-samlerunder` `ba70270f` (`docs/redesign/tillegg-samlerunder-design-2026-09-20.md`). Begge `--no-ff`, begge ff-mulig mot `6b294d58`.

**Gate — KUN db steg, alle andre HELT stille:** db 83→106 (**+23**, FH1+FS3-tester) · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · integrasjon 61 · 7/7. Ingen migrering, ingen mobil-endring, ingen i18n.

**Del F er nå ferdig omkodet.** FH1 v2 (12 felt + 3 headings, nytt kapittel FH) + FS3 v2 (11 felt + 3 headings, i FS), begge tekstbevis ordrett (designgate 2026-09-20, Kenneth kjørte `fh1-fs3-test.sql` mot `sitedoc_test`). **Kildekapitlene FC og FE slettet (tomme — bevis viser 0 rader). Lån intakt, id bevart.** FC1/FE1-delen av den bevisste mellomtilstanden er dermed avviklet (FD3 under «Uttak av løsmasser» ikke nevnt i denne ordren — ikke målt her).

---

## 🟢 2026-09-20 — FD2 «Graving av grøft» (ny mal) + tre docs merget. Ingen migrering, ingen mobil-endring. develop `083ac0da`.

**Fire brancher, FD2 først:** `feat/mal-fd2-ny` `11f83fae` (`packages/db/prisma/seed-bibliotek.ts` + `fd2-mal.test.ts`) · `docs/design-um1` `1bb0409a` · `docs/design-uu1` `80bc8a55` · `docs/design-malplan` `eeda9440` (`docs/claude/MAL-PLAN.md`). Alle `--no-ff`.

**Branch 4 ikke-ff (base `3616d140`), merget etter to reproduserte trygghetsmålinger:** `git log 3616d140..origin/develop -- docs/claude/MAL-PLAN.md` → tom (develop hadde ikke rørt fila), og `git merge-tree` → 0 konfliktmarkører. Ingen rebase — historikk urørt.

**Gate — KUN db steg, alle andre HELT stille:** db 76→83 (**+7**, FD2-seedtest) · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · integrasjon 61 · 7/7. Ingen migrering, ingen mobil-endring, ingen i18n.

**Koden FD2 var ledig** etter at gamle FD2 ble omkodet til FS2 i mellomrunden. 🟡 **Bevisst mellomtilstand (ikke drift — ingen skal «rette» den):** FD3 under «Uttak av løsmasser», FC1/FE1 i gamle kapitler — venter egne omkodinger. Neste Del F: FH1 → FS3.

### 🔴 Guard i seed-SQL verifisert tannete i FELT (2026-09-20)
- `fd2-test.sql` ble kjørt **to ganger** mot `sitedoc_test` ved et **uhell**. **Vakten stoppet den andre kjøringen («FD2 finnes allerede») og rullet alt tilbake — ingen skade, ingen dublett.**
- 🔴 **Ført som bevis, ikke anekdote:** guarden ble testet av et uhell, ikke av en planlagt negativkontroll. **Det gjør beviset sterkere** — den ekte skrivestien traff vakten, ikke en konstruert test. Idempotens-guarden i seed-SQL-en er dermed verifisert i drift, ikke bare i teori.

---

## 🟢 2026-09-19g — FD1 (omkoding fra FB2) merget. Ingen migrering, ingen i18n. develop `5ac878ff`.

**To brancher, docs først:** `docs/design-fd1` (ordrefil, ikke ff — develops nye commits siden `f2867985` rører mobil/i18n/tavla, null overlapp med ny ordrefil; test-merge bekreftet) + `feat/mal-fd1-omkoding` (fem filer, alle `packages/db/prisma`). Begge `--no-ff`.

**Gate — KUN db steg, alle andre HELT stille:** db 51→65 (**+14**) · api 511 · pdf 124 · shared 824 · web 292 · mobil 21 · integrasjon 61 · 7/7. Ingen migrering, ingen i18n. **Prod-gaten røres ikke.**

### FD1 «Uttak av løsmasser» — Bygget ✓ / Gatet ✓ design (tekstbevis, ordrett mot ordren) 2026-09-19
- **Første OMKODING:** FB2 → FD1. **version 2**, 11 felt + 3 headings, nytt kapittel **FD «Uttak av løsmasser»**. **Id bevart — lånet er intakt.**
- `fd1-test.sql` kjørt **én gang** mot test og skal **ikke** kjøres igjen (gitignorert).
- 🟡 **KJENT MELLOMTILSTAND, bevisst (ikke drift — ingen skal «rette» den):** FB4 ligger fortsatt under «Markrydding», FD2 (fylling) og FD3 under «Uttak av løsmasser» — begge venter egne omkodinger. Neste Del F-ordre: **FD2 fylling → FS2**.
- 🔴 **§7b-vakten (`mal-7b.test.ts`) er nå K-filtrert** (FD1 ligger i `malRegister`, F-maler har egne vakter som `fd1-mal.test.ts`). Design godkjente. **Cowork verifiserte at vakten fortsatt FEILER på K-brudd:** injisert «Tabell K» i KA7-hjelpetekst → `KA7: ingen forbudte referanser` ble RØD. Filtreringen snevrer inn *hvilke* maler den ser på, ikke *hva* den krever. Meta-testen krever dessuten at alle 8 K-maler er til stede, så en K-mal kan ikke forsvinne stille ut av registeret.

---

## 🟢 2026-09-19f — Varig-grå Google-innloggingsknapp merget. OTA, ingen migrering. develop `1dace3b0`.

**`fix/innlogging-varig-graa` `--no-ff`.** **Ikke ff** — develop flyttet `f3c0affa → f2867985` (§7b-mergen) mens kontrollplan jobbet. **Cowork målte: ingen rebase nødvendig** — §7b rørte `mal-ns-standard-logg.md`/`packages/db/*`/tavla, branchen rører `apps/mobile/*` + `packages/shared/i18n/*`. Null filoverlapp → `--no-ff` gikk rent (test-merge bekreftet). **Branchen ikke rørt.**

**Gate — KUN mobil steg, alle andre HELT stille:** db 51 · api 511 · pdf 124 · shared 824 · web 292 · mobil 18→21 (**+3**) · integrasjon 61 · 7/7. `sperret.googleIkkeTilgjengelig` lagt i alle 15 språk uten at shared-tellingen (824) rører seg. **Reload: OTA.**

### Varig-grå innloggingsknapp — Bygget ✓ (kontrollplan)
- **Bug:** Google-innloggingsknappen på mobil kunne stå **død permanent** når `useAuthRequest` gir `request=null` (`logg-inn.tsx`). Nå forklarer den seg via `KnappMedForklaring` + ny helper `apps/mobile/src/utils/innlogging-sperre.ts` (+ vaktest rød→grønn).
- Ny nøkkel: `sperret.googleIkkeTilgjengelig` = «Google-innlogging er ikke tilgjengelig i denne versjonen».
- **Scope:** regelen utelater bevisst `laster` — spinneren er signalet der. **Kun Google-knappen** er i scope; Microsoft og test er kun disabled på `laster` og har ingen varig-grå-tilstand.

### 🔴 PROSESSFUNN — ordren lå kun i nudgen, ikke i fil (coworks brudd på SAMARBEIDSREGLER regel 11)
Ordren til kontrollplan lå **kun i nudgen**, ikke i en `relay/inbox-*.md`-fil. Den forsvant med kontrollplans `/clear` og måtte rekonstrueres fra tavla, BACKLOG og koden. **Det var coworks brudd** — regel 11 krever at ordren bor i fil, ikke bare i den flyktige nudgen. Herfra: hver ordre skrives til `relay/inbox-<navn>.md` FØR nudgen limes, uten unntak.

---

## 🟢 2026-09-19e — §7b-retting av fem maler merget. Ingen migrering, ingen i18n. develop `5cd113ab`.

**`feat/mal-7b-retting` `--no-ff`.** Branchen var **ikke fast-forward** — develop flyttet fra `c7349cd6` til `f3c0affa` (19d-runden, 6 docs-commits) mens mal-Opus jobbet. **Cowork målte: ingen rebase nødvendig** — develops nye commits rører kun `MAL-PLAN.md`/`docs/redesign/*`/`STATUS-AKTUELT.md`/`BACKLOG.md`, branchen rører `mal-ns-standard-logg.md` + fire `packages/db/`-filer. Null filoverlapp → `--no-ff`-merge gikk rent uten konflikt (test-merge bekreftet før commit). **mal-Opus' branch ble ikke rørt.**

**Gate — KUN db steg, alle andre HELT stille:** db 34→51 (**+17**) · api 511 · pdf 124 · shared 824 · web 292 · mobil 18 · integrasjon 61 · 7/7. Full `pnpm test` fra ROT grønn; db-tellingen verifisert direkte (51 passed). Ingen migrering, ingen i18n.

### §7b-retting KA7, KB2, KB4, KB6, KC3.1 — Bygget ✓ / Gatet ✓ design (tekstbevis) 2026-09-19
- **Ren tekstretting, ikke innholdsendring.** Antall felt og typer uendret. Designgatens bevis: alle fem på **version 2**, rader **11/12/12/13/11**, navn og beskrivelser med «Faglig grunnlag», **INGEN normkoder eller standardnavn i hjelpetekster eller alternativer** — standarden nevnes kun i beskrivelsen.
- 🟢 **Hele NS 3420-K-biblioteket (KA7–KM2) følger nå MAL-METODE §7b. Opphavsrettssaken er lukket for biblioteket.**
- Den gamle KC3.1-§7b-kø-raden (sto siden 18.09) er dermed lukket.
- Ny `mal-7b.test.ts` (§7b-vakt over K-malene) + utvidet `generer-mal-sql.ts`/-test. `7b-retting-test.sql` er kjørt **én gang** mot test og skal **ikke** kjøres igjen (gitignorert).
- 🔴 **Reelt funn rettet i samme runde:** NS-loggens «Reproduserbar sjekk»-SQL (`mal-ns-standard-logg.md`) spurte kolonnen `mal_innhold`, som har vært **fryst tom siden migrering `20260914120000`** (innholdet bor i `bibliotek_mal_objekter`). SQL-en returnerte derfor ingenting og kunne få en leser til å tro at malene var tomme. Nå rettet til `bibliotek_mal_objekter`. **Merk: dette var aldri en formell BACKLOG-post** (grep på `mal_innhold` i BACKLOG.md = 0 treff) — funnet bodde i loggfila. Ført lukket her.

---

## 🟢 2026-09-19d — To docs-brancher merget. Rene docs, ingen migrering, ingen kode. develop `7212edb3`.

**To docs-brancher, begge `--no-ff`, ingen felles filer, begge ff fra `c7349cd6`.** Ingen kode rørt → **gaten står HELT stille** (db 34 · api 511 · pdf 124 · shared 824 · web 292 · mobil 18 · integrasjon 61 · 7/7). Ingen test kjørt (docs-only).

### §7b-retting-ordre (`e3dc2566`) — KA7, KB2, KB4, KB6, KC3.1
- `docs/redesign/ordre-7b-retting-fem-maler-design-2026-09-19.md` + `MAL-PLAN.md`-loggrad. Tekst-only retting av fem maler; KC3.1 minimalt. Kenneth-gatet.
- **Allerede gitt mal-Opus via maløypa** (design → mal-Opus direkte), branch `feat/mal-7b-retting`. Merget her lukker den gamle KC3.1-§7b-raden i køen (sto siden 18.09).

### Statusfarger-paritet (`7212edb3`) — designnotat + ordre
- `docs/redesign/designnotat-statusfarger-paritet-design-2026-09-19.md` (én fargetabell web+mobil, fem farge-familier) + `ordre-...md`. **Kenneth-gatet § 8.**
- **To vedtak:** (1) `responded` er **blå** i lister, gul bare på detaljside for godkjenner. (2) 🔴 `in_progress` heter **«Under arbeid» for ALLE** — dette **overstyrer** runde-2-vedtaket 2026-08-02 (Q1=A: «Mottatt»). Ført som overstyring i § 8, ikke som parallelt vedtak.
- **Ordren relayes til redesign** (LEDIG) av cowork nå — omfang: `perspektivEtikett` (NOEYTRAL-eksport), web-`StatusBadge` + mobil `StatusMerkelapp`/`STATUS_MAP` utledes fra NOEYTRAL, mobil detaljsider tar i bruk `perspektivEtikett`.

**BACKLOG § 1:** ny post fra designs etterkontroll av kontraktssaken — `aria-label` `dokumentklasse.segmentTittel` sier «Dokumenttype», maldialogen sier «Dokumentklasse» (samme begrep, to ord).

---

## 🟢 2026-09-19c — KM2-mal + sperrede knapper merget. Ingen migrering. develop `b9d8ddec`.

**To uavhengige runder, KM2 først** (liten + isolert, så en feil i den store står alene i diffen). Begge `--no-ff`, null felles filer. Mellom 19b og denne: CLAUDE.md § «Commit + push» skrevet om + strammet (`496579d2`/`3dc7c9bc` — Opus pusher egen branch på grønn gate uten klarsignal; frys etter «klar for merge»).

**Gate — db og mobil steg, web og resten HELT stille:** db 25→34 (KM2 +9) · api 511 · pdf 124 · shared 824 · web 292 (stille) · mobil 16→18 (+2) · integrasjon 61 · 7/7. Prisma generate ×4 + web build (regel 10) + mobil typecheck — alle grønne.

**i18n (57-fils-runden — største flate på lenge):** 4627→4662 = **+35** i alle 15 filer, **identisk nøkkelsett**, **0 nøkler fjernet** (verifisert nøkkel-for-nøkkel mot `a59d0e44`; numstats «1 deleted» er komma-artefakten på `videresend.radAvsenderMedRolle`, ikke en sletting).

### KM2 «mur av stein i terreng» — Bygget ✓ / Gatet ✓ design 2026-09-19
- Tekstbevis: kapittel KM + mal lagt inn, version 1, 13 rader (overskrifter 1/5/10), 5 enkeltvalg + 5 trafikklys, **NULL tallfelt**.
- ⚠️ **Eneste tall i hele malen er definisjonen «300 mm»** — Kenneth-gatet unntak: det definerer *hva en mur er*, ikke *hvordan den utføres*. §5-testen beviser at unntaket er smalt.
- Seedkommentaren rettet til 14 maler. `km2-test.sql` kjørt mot test ÉN gang — skal IKKE kjøres igjen.

### Sperrede knapper — Bygget ✓ / Gatet ✓ design 2026-09-19
- 48 knapper kartlagt (web + mobil), 35 nøkler under `sperret.*`. Ny mobil-komponent `KnappMedForklaring`. Alle designs rettelser brukt.
- 🔴 **Fler-grunn-knapper velger forklaring etter hvilken grunn som faktisk slår til.** «Ingen endringer å lagre ennå» vises BARE når det virkelig ikke er endringer — ellers ville teksten lyve.
- **Betingelsene er urørt.** Vi forklarer *hvorfor* en knapp er sperret; vi endrer ikke *når* den er det.
- **Fire oppfølgere → BACKLOG § 1 Teknisk gjeld** (ingen blokkerende): 🔴 web-tsc-gjeld (papirkurv/page.tsx TS2589 + bibliotek-mal.test.ts TS2532 — CI kjører ikke web-tsc = hull i gaten) · «Kopier mal» i MalListe mangler forklaring · videresend-kommentar påkrevd uten å være merket · Google-innlogging mobil kan bli varig grå (kontrollplan har runden).

---

## 🟢 2026-09-19a — KD2-mal + NettverkProvider-selvheling merget. OTA (NettverkProvider), ingen migrering. develop `c1e29dc9`.

**Fire ting inne** (KD2 `--no-ff`, resten ff-kjede fra `5d4dabff`): maløype-docs (`5d4dabff`), NettverkProvider (`7d383605`), KD2-mal (merge `c1e29dc9`), `.gitignore /*-test.sql`.

**Gate — kun db og mobil steg, resten HELT stille:** db 14→25 (+11) · api 511 · pdf 124 · shared 824 · web 292 · mobil 14→16 (+2) · integrasjon 61 · 7/7. Prisma generate ×4 kjørt før gaten. Web build gir null signal (KD2-filene ligger i `packages/db/prisma/`, ikke i byggets flate; NettverkProvider er mobil-only).

### KD2 «Setting av kantstein» — Bygget ✓ / Gatet ✓ design 2026-09-19
- 🟢 **Første NYE mal i biblioteket**, og **første med den generelle generatoren** (`generer-mal-sql.ts <REF> <ny|revisjon>`) — erstatter det KD1-spesifikke skriptet som bevisst aldri ble committet.
- **Tekstbevis (design gatet på):** version 1 · «KD2 – Setting av kantstein» · «Faglig grunnlag» i beskrivelsen · 13 rader med overskrifter på 1/5/8 · 4 enkeltvalg, 5 trafikklys, 1 heltall · ingen normkoder, §7b oppfylt.
- ⚠️ **`kd2-test.sql` er kjørt mot test ÉN gang og skal IKKE kjøres igjen.**
- 🟢 **Første runde maløypa ble brukt:** design og mal-Opus gikk direkte, cowork fikk ÉN melding med branch, hash, filer og docs-branch. **Den fungerte.**

### NettverkProvider-selvheling — OTA (kun JS)
- Selvheler nå fastlåst `erPaaNettet`. To mekanismer gjennom samme `anvendTilstand()`: **AppState→active-refresh** (telefon låst under nett-overgang) + et **offline-BARE intervall på 20s** som river seg ned ved første online-probe → null batterikost online.
- 🔴 **MÅLT FUNN: `TimerSyncProvider` sitt 30s-intervall redder IKKE** — gated på `erPaaNettet` både i effekt-oppsettet (`:198`, river ned intervallet når false) og inne i `triggerSync` (`:167`), og kaller aldri `NetInfo.fetch()`. Samme sykdom, ikke kur. Ingen eksisterende mekanisme selvhelet tilstanden.
- `erPaaNettet` leses i 13 konsumentfiler; **fem fryser arbeid** (OpplastingsKoProvider, VaerKoProvider, TimerSyncProvider, skjema-sync i `useSjekklisteSkjema`/`useOppgaveSkjema`) — resten er ren UI-tilstand uten datatap.
- Valgte `isConnected`, ikke `isInternetReachable` (sistnevnte prober Googles connectivity-endepunkt, blokkerbart på anleggsnett selv når vårt API er nåbart; server-nåbarhet avgjøres av køens retry/backoff). Bevisst IKKE bygget: mount-fetch (`addEventListener` leverer initialtilstand ved subscribe).
- 🔴 **ÆRLIG (KRAV 4):** dette retter et **konkret strukturelt hull** — ikke bare «ingenting hindrer det» som forrige runde. HVIS årsaken var fastlåst `erPaaNettet`, lukker dette den og bounder frysen til ≤20s i forgrunn / umiddelbart ved opplåsing. **MEN kontrollplan har ikke reprodusert felt-hendelsen** og kan ikke bevise at stuck-false var årsaken; en tredje umodellert årsak kan ikke utelukkes. Selvhelingen er forgrunns-scopet. **IKKE ført som «kø-frysen løst».**

### `.gitignore`: `/*-test.sql`
- MAL-METODE sa mal-revisjons-SQL var ignorert; det stemte ikke — de var bare aldri `git add`-et. Verifisert før linja: ingen slik regel fantes, ingen slike filer i hovedtreet. Én linje gjør dokumentasjonen sann før noen committer en ved uhell.

---

## 🟢 2026-09-18i — KM2-ordre merget (ren docs) + tavla rettet + nudge-rutine

**Merge:** `docs/design-km2` `1056b302` → develop, ren fast-forward fra `3b32c646`. Diff = nøyaktig to filer: `docs/redesign/ordre-km2-ny-mal-design-2026-09-18.md` (ny) + `MAL-PLAN.md` (KM2-rad). Ingen kode → gate-tallene HELT stille (db 14 · api 511 · pdf 124 · shared 824 · web 292 · mobil 14 · integrasjon 61 · 7/7 — docs-only, ikke re-kjørt).
- 🔴 **KM2-ordren IKKE relayet** — én mal om gangen. KM2 går til mal-Opus først når KD2 er merget (begge rører `seed-bibliotek.ts` + `generer-mal-sql.ts`; KM2 skal ligge etter `KD2_MAL` og bruker KD2-generatoren). KM2 = kontroll mot beskrivelsen, **ingen tall** (normen har ingen utførelseskrav/toleranser for mur — Kenneth sett og godkjent).
- 🔴 **TAVLA RETTET — den løy:** kø-raden fremstilte KD2-relayet som gitt/aktivt («mal-Opus lager KD2-branchen … nå»). Målt av design: mal-Opus står fortsatt på `feat/mal-kd1-revisjon` @ `51caefda`, ingen KD2-branch, ingen KD2-filer. KD2-nudgen ble skrevet av cowork, men limt til feil økt — nådde ALDRI mal-Opus, og cowork førte «i arbeid» uten å måle. KD2 er ordret + committet, men IKKE startet; branch blir `feat/mal-kd2-ny`.
- 🟢 **NY RUTINE — SAMARBEIDSREGLER § Meldingsflyt rule 14** (design foreslo praksisen; regelteksten er coworks): den som skriver en ordre lager nudgen i sin EGEN melding, cowork svarer KUN «kan relayes» eller «vent». «Kan relayes» er samtidig § design pkt 2-gaten — cowork sier den først når han har sett hvilke filer ordren rører. Da finnes alltid nøyaktig én kjent nudge.

## 🟢 2026-09-18h — KD1-revisjon (første tekstbevis-gate) + KD2-ordre/§1b merget. WEB-DEPLOY (seed) for KD1, ingen migrering, ingen OTA.

**To brancher, bindende rekkefølge, begge ff fra `031105ed`.** 1. `feat/mal-kd1-revisjon` `51caefda` → `6bbfe0dc`. 2. `docs/design-kd2` `828ddd73` → `4fb25469`.
- 🟢 **KD1 «Belegg av stein og heller» — FØRSTE mal gatet på TEKSTBEVIS** (ikke skjermbilder). **Designgatens bevis:** version 2 · navn «KD1 – Belegg av stein og heller» · beskrivelse med «Faglig grunnlag» · **13 rader** med overskrifter på rad 1/5/9 · **6× enkeltvalg, 3× trafikklys, 1× heltall** · alternativer og hjelpetekster ord for ord mot ordren + TILLEGG 1 · ingen normkoder, **§7b oppfylt**.
- 🟢 **Teknisk gate (cowork):** skrivevei `opprettMalHvisMangler` URØRT (bekreftet i diff-kommentar + grep), hjelpefunksjoner (ingen hardkodet JSON), `verifisert: false` eksplisitt, prod-gate urørt (uverifiserte seedes ikke i prod). Gate: **`db` 7→14** (+7, ny `kd1-mal.test.ts`; kjørt lokalt 14/14 grønt). Alle andre HELT stille: `api` 511 · `pdf` 124 · `shared` 824 · `web` 292 · `mobil` 14 · `integrasjon` 61. Ingen migrering. *(«version 2» kommer fra `kd1-test.sql` Kenneth kjørte på test 18.09 — MAL-METODE §1b pkt 5 — ikke fra seeden; seeden er create-only.)*
- 🟢 **KD2 — designs FØRSTE leveranse etter den nye modellen.** Ren docs: KD2-ordre (kantstein), MAL-METODE **§1b** (felles regler for design + mal-Opus), MAL-PLAN KD2-rad. **Merget FØR relay (§ design pkt 2 — første praktiske bruk av regelen).** → KD2-relay lagt i Coworks kø.
- **Reload:** ingen (seed; eksisterende maler urørt til re-seed).
- ⚠️ `_gen-kd1-sql.ts` ble bevisst IKKE committet — KD2 leverer `generer-mal-sql.ts` generalisert; den KD1-spesifikke ville vært utdatert. Ikke etterlyst.

## 🟢 2026-09-18g — § design (rollen etter Fabel) innfletta i SAMARBEIDSREGLER + seks fabel-steder merket historiske. INGEN kode, ingen deploy, ingen OTA.

**Kilde:** `relay/forslag-samarbeidsregler-designrollen-2026-09-18.md` (gitignorert), Kenneth-godkjent v2 i sin helhet.
- 🟢 **Nytt § design** flettet inn i SAMARBEIDSREGLER rett etter § Roller (før «redesign-Opus»-seksjonen). Sitatblokken (seks punkter: eget worktree · ingen relay før cowork har sett filene · egen innboks `inbox-design.md` · faste gate-ord · bevis agenten kan levere · uenighet maks én runde) tatt inn **ordrett** — verifisert byte-identisk mot kilden (`diff` tomt).
- 🟢 **Seks fabel-steder merket historiske (ikke slettet):** SAMARBEIDSREGLER § Leveranser fra fabel · meldingsflyt `fabel → …/Fra fabel/til-repo-*` · § Dokument-eierskap · `informasjonsflyt-fabel-cowork.md` (øverst) · MAL-METODE «Hvor fabels ordrer lander» + «fabel snakker aldri direkte». Banner-linje øverst i hvert.
- 🟢 **To steder navnebyttet (gjelder fortsatt):** roller-raden `fabel` → «design (tidligere fabel)» · «redesign-Opus»-seksjonens overskrift + generell regel → design. **Det daterte 04.09-tilfellet forblir «fabel»** (det VAR fabel — historisk faktum).
- 🟢 **Tavla:** `fabel`-raden erstattet av **design** (`SiteDoc-design`, `docs/design-<emne>`-brancher, plan-sporet). 🔴 **Worktreet finnes ikke ennå — Kenneth oppretter det** (`git worktree add ~/Documents/Programmering/SiteDoc-design -b design-base origin/develop`).
- 🔴 **`relay/KONVENSJON.md` er GITIGNORERT — IKKE rørt.** Tre steder der inne peker fortsatt på fabel (:21 regel 7, :36 «Unntaket = fabel», :44 «fabel → cowork»). **Kenneth retter dem selv i hovedtreet** — en endring herfra når ingen.
- MAL-METODE/MAL-PLAN fabel→design-swap er valgfri («når filene uansett røres») — IKKE gjort denne runden (utenfor ordren).

## 🟢 2026-09-18f — Docs-runde: tekstbevis erstatter skjermbilder + BACKLOG #23. INGEN kode, ingen deploy, ingen OTA.

**Tre commits, alle docs.** 1. `ef8f1d9b` — design-rollens tre filer overført fra hovedtreet (mal-Opus var BLOKKERT på TILLEGG-2): MAL-METODE §3/§6/§6a — **tekstbevis fra revisjons-SQL erstatter skjermbilder** (mal-Opus har verken innlogget nettleser eller simulator); hver revisjons-SQL **øker `bibliotek_maler.version` med 1** og skriver ut hele malinnholdet før `COMMIT` (tekstbeviset gaten kjøres på); MAL-PLAN oppskrift pkt 7; TILLEGG-2 (ny). **Felle-note tilføyd (autorisert av ordren):** `versjon String` (schema:2313) er død for versjonsvisning, `version Int` (schema:2320) er badge-kilden (`versjonerBak`, `MalListe.tsx:654`) — feil felt gir stille feil. 2. `919897ff` — BACKLOG #23 «Malinnhold som tekst» (superadmin-visning m/kopier-knapp, Kenneth-godkjent, ikke nå; erstatter §6a-utskriften når den finnes). 3. denne.
- De to andre untrackede hovedtre-filene (TILLEGG-kd1-egne-krav, ordre-kd1-revisjon) er ALT i develop og byte-identiske — IKKE committet på nytt (verifisert `git diff` = tomt). Kenneth rydder dem selv.
- 🔴 **`feat/mal-kd1-revisjon` MERGES IKKE** — fortsatt ikke designgatet. Gaten kjøres nå på **tekstbevis**, ikke skjermbilder: mal-Opus lager `kd1-test.sql` på nytt per TILLEGG-2, Kenneth kjører den og limer utskriften til design-rollen.

## 🟢 2026-09-18e — §7b opphavsrett (design-docs) + KC3.1 9→8 «sesongfelt ut» merget. WEB-DEPLOY (seed), ingen migrering, ingen OTA.

**Tre commits, alle på develop.** 1. `9c83f547` — design-rollens fire filer overført fra hovedtreet (mal-Opus var BLOKKERT på dem): MAL-METODE **§7b** (malene er SiteDocs egne sjekklister, skal ikke fremstå som NS 3420 — opphavsrett; navn = kode + egne ord, ingen tabell-/punktkoder i hjelpetekster, «Faglig grunnlag: NS 3420-K:2024, post <kode>» én gang i beskrivelsen), **§6a** rettet (revisjons-SQL treffer `bibliotek_mal_objekter`, ikke `mal_innhold` — feil i metoden siden 14.09), **§5** KD2/KM2 foran Del F; MAL-PLAN statustabell remålt mot develop. 2. `37e98b0c` — merge `fix/kc31-sesongfelt-ut` (KC3.1 9→8 felt: sesongkontroll-feltet fjernet fra `seed-bibliotek.ts`, omdøpt konklusjon beholdt). 3. `2073ffc0` — bindende vedtak oppdatert: sesongfeltet ER fjernet (hash).
- Gate: **`db` 8→7** (−1, testtilfellet fjernet MED feltet — uvanlig retning, bekreftet ved kjøring: `db`-test 7/7 grønt lokalt). Alle andre HELT stille: `api` 511 · `pdf` 124 · `shared` 824 · `web` 292 · `mobil` 14 · `integrasjon` 61. Branchen rørte kun `packages/db` (seed+test) + to docs-filer.
- 🔴 **§7b-KONSEKVENS FOR KC3.1 (nettopp merget) — i køen, IKKE fikset:** malens undertittel «NS3420-K KC3.1 — Oppstøtting og oppbinding» er normens egen overskriftstekst. Under §7b skal navnet være **kode + egne ord**. KC3.1 trenger en §7b-runde → Coworks kø, mal-Opus.
- **Reload:** ingen (seed; eksisterende maler urørt til re-seed).

## 🟢 2026-09-18d — KC3.1 niende felt + flytvalg etter «Hent fra arkiv» merget. WEB-DEPLOY, ingen migrering, ingen OTA.

**To brancher** (`feat/kc31-niende-felt` `41835523` · `feat/hent-fra-arkiv-flytvalg` `c7049531`, begge ren ff, null felles filer). Gate (etter `prisma generate` ×4): **`db` 7→8** (+1) · **`web` 285→292** (+7). Alle andre HELT stille: `api` 511 · `pdf` 124 · `shared` 824 · `mobil` 14. 7/7. ⚠️ De 6 lokale typecheck-feilene (maskin/service.ts + bibliotek-mal.test.ts) var **stale db-maskin Prisma-klient** etter service-migreringen — borte etter `generate`, verifisert grønn. Ingen migrering.

- 🟢 **KC3.1 rettet 8→9 felt:** nytt «Kontrollert etter 1. vekstsesong – etterstrammet/justert» (trafikklys) i ETTER-fasen; siste felt omdøpt til «Krav oppfylt og dokumentasjon levert». **Skriveveien `opprettMalHvisMangler` fortsatt URØRT.** Testen låst på 9, sett rød mot dagens 8.
- 🔴 **ÅPENT (meldt av mal-Opus) — grenseoppgang for Kenneth:** konklusjonens hjelpetekst sier fortsatt «Etterfølgende sesongskontroll … er vedlikehold (egen post) — ikke del av denne sjekklisten», mens **rad 9 nå ER en sesongkontroll.** mal-Opus rørte den ikke (ordre: «alt annet uendret»). **Kenneth avgjør grensen.**
- 🔴 **ÅPENT:** hjelpeteksten på det nye feltet er mal-Opus' egen formulering, **ikke avlest fra Kenneths skjerm** — Kenneth kan overstyre.
- 🟢 **Flytvalg etter «Hent fra arkiv»:** etter at en mal hentes fra **FIRMA-arkivet** til et prosjekt, åpnes «Velg dokumentflyt» lagvis over hent-modalen, med «Velg» og «Hopp over» **likestilt**. Fler-velger (`DokumentflytMal` har `@@unique([dokumentflytId, templateId])` = mange-til-mange), gjenbruker `FaggruppeTilknytningModal`. **Steget skjules helt når prosjektet ikke har dokumentflyter** (et «Velg» til tom liste er blindvei).
- 🔴 **PREMISS-KORRIGERING (målt av redesign):** Kenneth ba om «begge arkiver», men det er **schema-umulig for SiteDoc-lån**: `laanFraSentralarkiv` lager en firma-`OrganizationTemplate` UTEN `projectId`, mens `Dokumentflyt`/`DokumentflytMal` er prosjekt-scoped (`schema.prisma:1541/1608`). Kravet oppfylles **indirekte**: enhver mal som faktisk entrer prosjektet gjør det via `kopierTilProsjekt` — også en lånt SiteDoc-mal (lånes først til firmaarkivet, hentes deretter til prosjektet).
- 🟢 **Ingen nye i18n-nøkler** — `maler.velgDokumentflyt`, `handling.velg`, `handling.hoppOver` fantes alle.
- ⚠️ **EDGE, meldt:** flyter uten `faggruppeId` vises ikke i velgeren (pre-eksisterende picker-atferd).

## 🟢 2026-09-18c — KC3.1-port + kø-mutex-herding merget. Kø-fiks OTA (kun JS), ingen migrering.

**To brancher** (`feat/kc31-port` `48fc5dfc` · `fix/opplastingsko-finally` `b95c88ac`). Gate: **`db` 2→7** (+5, KC3.1-testen) · **`mobil` 13→14** (+1, kø-vaktest). Alle andre HELT stille: `api` 511 · `pdf` 124 · `shared` 824 · `web` 285. 7/7. Ingen migrering.

- 🟢 **KC3.1-PORT levert (lukker GLEMT-ARBEID fra branch-kartleggingen):** KC3.1 «Oppstøtting av trær» revidert 4→8 felt (NS 3420-ZK2.7112) — portet på **dagens objekttabell-arkitektur**. **Skriveveien `opprettMalHvisMangler` er URØRT** (create-only bevart, `BibliotekMalObjekt`-radskriving ikke reversert — verifisert i merge-diffen). Testen låser 8 felt, sett rød mot dagens 4-felt-tilstand. **Den gamle `feat/mal-kc31-revisjon` (stale arkitektur) er nå overflødig.** [BACKLOG § KC3.1-PORT](BACKLOG.md) → 🟢 LØST.
- 🟢 **Kø-mutex herdet — men IKKE en bevist feil rettet (ærlig framing):** `try/finally` erstatter åtte spredte nullstillinger av `prosessererRef`; rekursjonen flyttet ut av `try`, etter `finally`. Vaktest kjører ekte `prosesserNeste` med mocket drizzle (uten `finally`: rød, med logg «prosesserer: true» som bevis på at rekursjonen traff guarden). 🔴 **kontrollplan fant INGEN vei der `prosessererRef` faktisk blir stående — fiksen HERDER, den løser IKKE den observerte kø-frysen.**
- 🔴 **HOVEDFUNN til egen runde — sannsynlig rotårsak til kø-frysen:** `NettverkProvider` har **ingen selvhelende mekanisme**. `erPaaNettet` settes **kun** av `addEventListener` — ingen `NetInfo.fetch()` ved mount, ingen `AppState`-sjekk, ingen polling. En **tapt reconnect-hendelse** låser `erPaaNettet = false` permanent og fryser køen. Forklarer «online, men fryst» bedre enn mutex-stien. **Egen runde kommer** ([BACKLOG § KØ-FRYS](BACKLOG.md) oppdatert).
- **Reload:** OTA på kø-fiksen (kun JS). KC3.1 er seed (ingen reload-krav for eksisterende maler).

## 🟢 2026-09-18b — Dobbel «Type» i mal-dialogen rettet. WEB-DEPLOY, ingen migrering, ingen OTA.

**Én branch, `fix/mal-dialog-dobbel-type`** (`dde98b07`, ren ff fra `6e78d56d`). Gate: **`web` 270→285** (+15, én testcase pr. språk). Alle andre HELT stille: `db` 2 · `api` 511 · `pdf` 124 · `shared` 824 · `mobil` 13. 7/7. i18n: nøkkeltallet **UENDRET 4627** i alle 15 — kun *verdien* av `mal.type.tittel` endret (+1/-1 pr. fil, ingen nøkkel lagt til/fjernet). **Null apps/api-filer rørt** → redesigns 14 lokale `projectGroup.create`-feil er miljø (umigrert lokal integrasjons-DB), ikke kode; CI mot fersk pgvector er fasit (integrasjon 61).

- 🟢 **Dobbel «Type» rettet.** To akser bar samme navn: det **gamle låste** feltet styrer dokument-**FORM** (oppgave/sjekkliste/HMS — hvilken tabell dokumentet havner i); det **nye** styrer dokument-**KLASSE**. redesign omdøpte SIN EGEN overskrift (`mal.type.tittel`) til **«Dokumentklasse»** og lot det låste feltet stå.
- 🟢 **Låsen på det gamle feltet har reell grunn (målt):** opprett-modalen leser kontekst (hardkodet `readOnly`), rediger-modalen låser når `harDokumenter` — å bytte form etter at dokumenter finnes ville **foreldreløst dem i feil tabell.**
- 🟢 **Testen er en i18n-INVARIANT, ikke render-test:** form- og klasse-overskriften kan aldri løse til samme streng, i alle 15 språk. Leser JSON, ingen DOM — bevisst for å unngå skjørhet.
- 🟢 **FUNN, rettet som bieffekt:** fransk `mal.type.tittel` sto som **«Taper»** (verbet «å taste», ikke substantivet) → «Classe de documents».
- ⚠️ **MELDT, IKKE FIKSET — PRE-EKSISTERENDE dobbel «Type» i HMS-fanen:** den gamle låste Type-blokken er ikke guardet mot HMS, så den vises sammen med `hms.subdomain.label="Type"` i `erHms`-blokken. **Gatet HMS-område, urørt** (egen runde).

## 🟢 2026-09-17c — Kontraktssak runde 1 merget. WEB+API-DEPLOY, INGEN migrering (schema kun kommentar), ingen OTA-krav.

**Én branch, `feat/kontraktssak-runde1`** (`0542d39b`, alt rebaset på dagens develop `1ea48a10` — **trengte ikke rebase**; ordrens `36539f74`/base `250dfc7f` var stale). Gate: **`api` 495→503** (+8, `mal-subdomain-validering.test.ts`) · **`integrasjon` 57→59** (+2, `kontraktssak.integration.test.ts`, bekreftes i CI). Alle andre HELT stille: `db` 2 · `pdf` 120 · `shared` 824 · `web` 264 · `mobil` 13. 7/7.

- 🟢 **Kontraktssak runde 1 levert** — **visuelt skille i Oppgaver via `subdomain="kontrakt"`** (web + mobil oppgaveliste/-detalj), **klassen erklært på malen** (`ReportTemplate.subdomain`). Lovlige `(domain, subdomain)`-par eies av `LOVLIG_SUBDOMAIN` i `mal.ts:169` (`bygg → kontrakt`); `valideerSubdomainKombinasjon` (`mal.ts:193`) avviser kontrakt under HMS. **VEDTAK 17.09: `subdomain` i runde 1, `domain` i runde 2** (domain-endring blokkert av dokumenter, VAR-001).
- 🟢 **INGEN migrering** — `schema.prisma`-diffen er **kun `//`-kommentar** på `subdomain`-feltet (felt-def byte-identisk), verifisert i diffen.
- 🟢 **i18n: alle 15 filer nøyaktig +13 nøkler, identisk sett, `-0` slettinger** — ingen verdi tapt i mergen (kontrollert bevisst, ikke bare nøkkelsett-testen).
- ⚠️ **PDF-labelen «Kontraktssak» er bevisst hardkodet norsk** (`sammenstilling.ts`, `dokumenttype`) — **arkiv-PDF-pakken er ikke i18n** (presedens `grensesnapshot.ts:22`).
- ⚠️ **Api-feilmeldingen er hardkodet** — `apps/api` har ingen i18n-rigg.
- 🔴 **kontrollplan bygger service/timetall og skal inn i `nb.json` ETTER dette.** Develop-hash å fetche FØR i18n røres føres ved push.

## 🟢 2026-09-17b — To docs-brancher merget + branch-kartlegging ført. Ingen kode, ingen deploy, ingen migrering.

**To rene docs-brancher inn på develop** (`docs/arkitektur-syntese-drift-2` `a1716dcc` · `docs/maaling-kundeonske-1` `391c0aaf`). **Gate står HELT stille** (ingen kode/test-fil rørt): `db` 2 · `api` 495 · `pdf` 120 · `shared` 824 · `web` 264 · `mobil` 13 · `integrasjon` 57 · 7/7.

- 🟢 **mal-Opus:** `arkitektur-syntese.md` — tre drift-rader lukket med positiv kontroll mot `250dfc7f`: § 4 firma-modeller (alle fire bygget, `schema.prisma`-linjer), HMS-statistikk på firma-nivå (`hms.hentFirmaOversikt`), footer remålt (7 av 8 datamodell-steg bygget; PSI-utvidelsen steg 5 IKKE bygget; hel-Fase-0-status 🟡 usikker — egen runde).
- 🟢 **kontrollplan:** ny `delplaner/maaling-kundeonske-1-2026-09-17.md` — målingen som veltet BACKLOG-raden om service↔timetall (kundeønske #1).
- 🟢 **BRANCH-KARTLEGGING GJORT** (seks umergede origin-brancher, bevis: `git cherry` patch-ekvivalens + 3-punkts diff):
  - 🟢 **DØD** (patch alt i develop, ingen unik rest): `ci/e2e-del2` · `fix/e2e-dedrift` (begge superseded — develops e2e-CI gikk videre til 05/07) · `feat/versjonssporing-softdelete` (begge migreringer + schema + firmamal soft-delete i develop via 17.09-mergen; **rettet memo-drift** — sto som «pending»).
  - 🟡 **GLEMT ARBEID:** `feat/mal-kc31-revisjon` — unik KC3.1-revisjon (8 felt mot NS 3420-ZK2.7112), men bygget på stale seed-arkitektur → **skal PORTES, ikke merges** (festet i [BACKLOG § KC3.1-PORT](BACKLOG.md)).
  - 🟢 **DØD kode / 🟡 måling beholdt:** `wip/diag-exif` (EXIF-fraværsårsaker) · 🔴 `wip/diag-ko-trigger` (kø-frys mens online — ÅPEN) — begge `__DEV__`, funnene festet i [BACKLOG § WIP-diagnostikkbranches](BACKLOG.md).
  - 🔴 **Ingen branch slettet — Kenneth gater.** Tre funn festet i BACKLOG først (eneste bærer).

## 🟢 2026-09-17 — Docs + redesign merget: død Opprett-knapp forklart + seedeveien + design-leveranser. WEB-DEPLOY (redesign), ingen migrering, ingen OTA.

**To brancher + design-leveransene inn på develop** (`docs/seederegler-runbok` `db80c755` · `fix/dokumentflyt-navn-primaert` `4568387e`). Gate: `pnpm test` **7/7** — **`web` 261→264** (+3 `knapp-med-forklaring.test.tsx`). Alle andre HELT stille: `db` 2 · `api` 495 · `pdf` 120 · `shared` 824 · `mobil` 13. `integrasjon` uendret 57 (redesign rørte null api/db, skal stå 57 i CI). `prisma generate` ×4 kjørt før test. ⚠️ Pre-eksisterende `tsc`-rød på `bibliotek-mal.test.ts:25-26` (ikke fra denne runden).

- 🟢 **DØD OPPRETT-KNAPP FORKLART** — navnefeltet løftet til primært (fet `<label>` + rød påkrevd-`*`, `htmlFor`/`useId`, `aria-required`), `BundetFlytVelger` dempet minimalt (valgt-fyll beholdt som funksjonell indikator, radiovalg/ordlyd/anker urørt), tooltip via `@sitedoc/ui` på både «Opprett» og «Legg til faggruppe». Rekkefølge urørt. **Utløst av at Kenneth selv ble stoppet av sin egen flate under bundet flyt-gaten.**
- 🔴 **MÅLT FUNN:** `pointer-events:none` på et disabled barn **bryter hover på wrapperen** (0 fyringer) — den vanlige folkloren er feil her. **Verifisert i ekte Chrome, ikke antatt;** derfor satt bevisst IKKE. Kontrakten er `aria-describedby` (test satt rød: fjernet wrapper → 2 av 3 falt).
- 🟡 **20+ andre disabled-knapper mangler forklaring.** `KnappMedForklaring.tsx` er gjenbrukbar for dem — **egen runde** (meldt, ikke fikset).
- 🟢 **DEPLOY-RUNBOK § 7 «Seeding mot test»** — `scp` → `docker cp` → `psql` (steg 1 agent, 2–3 Kenneths TTY; `-d sitedoc_test`≠`-d sitedoc`; legg-til-aldri-slett; `.ts`-seeds ikke på server; `SEED_CONFIRM_DB`-vakt). ⚠️ **Merket IKKE re-verifisert etter serverendringene 17.09.**
- 🟢 **`LOKALT-OPPSETT.md:48` rettet** — «kjøres av Kenneth på server-ny» stemte ikke; nå SSH-tunnel + peker RUNBOK § 7.
- 🟢 **SJA-GATEN LUKKET** — «etterkontroll, delvis dekket». **Flate 3 (signer egen rad) IKKE DEKKET** («la SJA være»). simulator → ⚪ LEDIG. Prod-hash rettet til release-merge `ad18df93`.
- 🟢 **DESIGN-ROLLENS LEVERANSER INN** — kontraktssak runde 1 (designnotat + mockup 4 `.dc.html` + `support.js` + ORDRE ikke gitt ennå), `domain`-svaret, DESIGNSYSTEM-AUDIT, FABEL-KATALOG, § Feltstatus i `ui-standarder.md` (Kenneth-gatet). SJA-ordrefila fikk hovedtreets NYERE versjon (flate 3 valgfri), ikke dublett.
- 🔴 **VEDTAK, design-rollen 17.09:** kontraktssak bruker `subdomain` i runde 1, `domain` i runde 2. **Coworks anbefaling om `domain` nå var FEIL:** `mal.ts:460-472` blokkerer endring av `domain` når malen har dokumenter — VAR-001 finnes, så konvertering var ugjennomførbar.
- 🟢 **redesign var fra eldre base** (`70c1e556`) **og force-pushet** (ordrens `adfe0596` utdatert, faktisk tipp `4e123b9a`). **Merge gikk KONFLIKTFRITT — ingen rebase nødvendig;** redesigns utdaterte docs-endringer (SJA-ordrefil-opprett + gammel tavla) ble auto-superseded av develops nyere versjoner.

## 🟢 2026-09-17 — Pushvarsel runde A merget (`1d66e148`): datalag + sendetjeneste. API-DEPLOY + MIGRERING (IKKE KJØRT), ingen OTA.

**Én branch, `feat/push-datalag`.** Kontrollplan hadde alt rebaset den oppå dagens develop (`feddad76`) og force-pushet før handoff — **hash `b1275423`, ikke `2e7f5434` som ordren sa; ren fast-forward, ingen rebase nødvendig.** Gate: `pnpm test` 7/7 — **`api` unit 490→495** (+5: pushVarsel + push-token) · **`integrasjon` 51→57** (+6, bevist i CI: `57 passed`). **`mobil` STÅR STILLE på 13** (fra bundet-flyt-mobil — ikke mistet). Resten stille (`db` 2 · `pdf` 120 · `shared` 824 · `web` 261). Begge CI-jobber grønne, fersk pgvector anvendte alle migreringer inkl. den nye.

- 🟢 **PUSHVARSEL RUNDE A LEVERT** — `PushToken`-tabell (`push_tokens`) + migrering, sendetjeneste via `expo-server-sdk ^7.2.0`, nåbarhets-telling, logg i `activity_log` (`action="push.sendt"`). **Ingen UI, ingen i18n.**
- 🟢 **`User` er HELT urørt** — `user_id` er svak String-FK uten `@relation`, samme mønster som `activity_log`. `schema.prisma`-diff mot develop = **0 slettinger** (30 tillegg). Migrering = **én `CREATE TABLE` + to indekser** (UNIQUE på `token`, indeks på `user_id`), ingen eksisterende tabell endret.
- 🟢 **Nåbarhets-tellingen er poenget:** en formann skal ikke tro at 50 mann fikk beskjed når 12 gjorde det. `naabarhet()` returnerer `{valgt, naabare, utenToken[]}`.
- 🟢 **Døde tokens ryddes KUN på `DeviceNotRegistered`** — forbigående feil (`MessageRateExceeded`, `InvalidCredentials`) fjerner ingen enhet. Token = enhetens identitet, `userId` = hvem som sitter der nå (upsert på token, «siste innlogging vinner»).
- 🔴 **PUSH KAN IKKE TESTES I EXPO GO ELLER SIMULATOR.** Ende-til-ende-validering av runde B koster minst ett iOS- + ett Android-bygg; iOS forutsetter APNs-nøkkel i EAS FØRST, Android krever Firebase-prosjekt (FCM V1).
- ⚠️ **FUNN — lokal sandkasse blokkert:** `20260906000000_sja_signaturrunder` feilet 09-09 og stopper `prisma migrate deploy` lokalt. **Femten migreringer ligger etter den.** CI upåvirket (fersk pgvector). Ikke rørt — DB-tilstand er Kenneths. **Neste agent som kjører integrasjonstester lokalt treffer dette.**
- ⚠️ **`varsling.md` mangler statusmarkør og er skrevet i presens om fem modeller som ikke finnes.** Sett av kontrollplan (la inn peker «modellene i denne fila er IKKE bygget», rettet ikke resten). **Cowork ordrer oppfølgeren.**
- 🟢 **BASE-FELLA UNNGÅTT:** ordren advarte at kontrollplans tall var målt mot `50fd9893` (to merger gammel). Målt selv: branchen var alt rebaset på `feddad76`, så fasit holdt — `integrasjon 57` (ikke 54 = mistet bundet-flyt-mobil, ikke 51 = mistet kontrollplan).
- 🔴 **UTLØSER api-deploy + MIGRERING — Kenneth eier begge. Klart, ikke kjørt.**

---

## 🟢 2026-09-17 — Tre brancher merget (`f6ed59f1`): bundet flyt mobil · fasetabell remålt · ordreformat presisert. WEB+API-DEPLOY + OTA, ingen migrering.

**Tre fast-forward-brancher fra `50fd9893`, null felles filer:** 1. `docs/ordreformat-kopierbar` (SAMARBEIDSREGLER) · 2. `docs/remaaling-fasetabell` (arkitektur-syntese) · 3. `feat/bundet-flyt-mobil` (ett api-felt × 2 routere + mobil + tester). Merget i den rekkefølgen så #3 står alene i diffen. Gate: `pnpm test` 7/7 — **`mobil` 9→13** (+4: flytbytte-visning, inkl. testen som feiler hvis «Bytt flyt» vises for en bundet flyt). **`integrasjon` 48→51** (+3: `gjeldende.bundet` returneres i begge routere). Resten HELT stille (`db` 2 · `api` unit 490 · `pdf` 120 · `shared` 824 · `web` 261). De to docs-branchene flyttet ingen tall. Begge CI-jobber grønne.

- 🟢 **BUNDET FLYT ER KOMPLETT PÅ BEGGE FLATER** — web kom i `ba7f6c0f`, mobil nå. Ett felt (`bundet`) lagt til på `gjeldende` i begge routere; **`kanByttFlyt`/`andre`/`kanFlytte` urørt — verifisert mot develop etter merge (api-diff rent additiv, 0 slettede linjer på rettighets-felt)**. Mobil skjuler «Bytt flyt» og viser fotnoten med anker i stedet.
- 🔴 **HULLET SOM BLE LUKKET:** serversperren fantes og var testet, men mobil kunne ikke vite at en flyt var bundet — «Bytt flyt» var levende og feilet mot serveren uten forklaring. Fotnotens poeng («det gjelder alle i prosjektet, ikke bare deg») fantes bare på web.
- 🟢 **Test som feiler hvis «Bytt flyt» vises for en bundet flyt** — sett rød først (`!egenFlytBundet`-vakten fjernet → testen falt). Integrasjon (5)+(6) sett rød på samme vis. Gjenbrukte `videresend.bundetFotnote` — ingen nye i18n-nøkler. `Anchor` verifisert i `lucide-react-native`.
- 🟢 **FASETABELLEN REMÅLT mot `50fd9893`** — syv «Mangler»-påstander målt mot kode. Fase 2 arkivert som ferdig, Fase 7 markert delvis.
- 🔴 **FUNN: «HMS-statistikk på firma-nivå» sto som «Mangler — Fase 7». Den er bygget** (`hms.hentFirmaOversikt`, `firma/hms/page.tsx`, fem i18n-nøkler). Ettermålt av cowork.
- 🟡 **Godkjenning-modellen er DØD:** finnes i skjemaet, `prisma.godkjenning` = 0 treff i api. Ingen router, ingen flate. Ført som DELVIS, ikke «ferdig».
- ⚠️ **MELDT, IKKE GJORT — tre rader til i `arkitektur-syntese.md` har drevet:** `:318` lister `OrganizationTemplate` som manglende (den finnes) · `:573` gjentar HMS-statistikk-feilen · `:615` sier Fase 0-koding ikke kan starte. **Cowork ordrer oppfølgeren.**
- 🟢 **ORDREFORMATET PRESISERT** — limbare blokker i egen fenced kodeblokk, én pr. mottaker; spørsmål som venter på Kenneth får egen «KREVER SVAR»-overskrift, og står det ingenting, skal det STÅ. Utløst av Kenneth 17.09.
- 🔴 **UTLØSER api-deploy + OTA — Kenneth eier begge. Klart, ikke deployet.**

---

## 🟢 2026-09-17 — To strengvedtak (`b4602e2c`). WEB-DEPLOY, ingen migrering, ingen OTA.

**Én branch, `chore/strengvedtak-kilde-sokeord`, fast-forward oppå `ccad572a`. To i18n-VERDIER × 15 filer — ingen kode, ingen nye nøkler.** Gate: `pnpm test` 7/7 — alle seks tall helt stille (`db` 2 · `api` 490 · `pdf` 120 · `shared` 824 · `web` 261 · `mobil` 9). Integrasjon 48 (branchen rører null api/integrasjonsfiler). Alle 15 i18n-filer 4569 nøkler, identisk sett før/etter. Begge CI-jobber grønne (`test` + `e2e 01-05+07`).

- 🟢 **TO STRENGVEDTAK LEVERT** — `maler.arkiv.kildeSitedoc` «SiteDoc-standard» → **«SiteDoc-mal»** (paritet med `kildeFirma` = «Firmamal»); `innstillinger.sokeord.maler` utvidet med **«firmaarkiv sitedoc-arkiv»** uten at «malarkiv» ble fjernet. **2 verdier × 15 språk. Ingen nøkkel-rename, ingen kodeendring.**
- 🟢 **De to åpne punktene fra forrige bolk er dermed LUKKET** — begge gatet av Kenneth 17.09.
- 🟢 **Ingen `kildeProsjekt`-søsternøkkel finnes** — målt, ikke antatt. **Eneste andre `sokeord`-nøkkel er `byggeplasser`, uten arkiv-termer.**
- ⚠️ **HULL I TESTVERNET, meldt av mal-Opus:** *«testen vokter at nøkkelen bærer «arkiv», ikke «malarkiv» spesifikt — fjerner du kun «malarkiv» (men beholder andre arkiv-tokens) forblir den grønn. Broen «malarkiv» er altså ikke test-vernet i seg selv.»* **Ingen handling nå — men neste som rører søkeord skal vite det.**
- 🟢 **Verifisert etter merge, før push (verdi-merge har ingen test som fanger fravær):** `kildeSitedoc` = «SiteDoc-mal» · `sokeord.maler` bærer BÅDE «malarkiv» OG «sitedoc-arkiv» · `adminBibliotek.tittel` = «SiteDoc-arkiv» (forrige rundes harmonisering ikke rullet tilbake).
- 🟢 **mal-Opus ventet korrekt:** `git merge-base --is-ancestor` FØR han branchet, etter forrige rundes falske alarm. **Lærdommen satt.**
- 🟡 **Cowork-funn, ikke blokkerende:** `pl.json` bøyer produktnavnet — «Szablon SiteDoca» (polsk genitiv). Grammatisk korrekt polsk, ikke oversettelsesfeil.

---

## 🟢 2026-09-17 — Bundet flyt-UI + strengharmonisering (`ba7f6c0f`). WEB-DEPLOY, ingen migrering, ingen OTA.

**To brancher, bindende rekkefølge:** **1. `chore/strengharmonisering`** (`--no-ff`, 15 i18n-filer, 165/165 ren tekst) · **2. `feat/bundet-flyt-ui`** (`--no-ff`, web + 15 i18n). Begge rører alle femten i18n-filer — landet i denne rekkefølgen for at bundet-flyt-UI blir en vanlig tillegg-merge oppå verdiendringene. Ingen konflikt. Kontrollert etter merge (3-veis JSON-merge feiler stille): **alle 15 filer 4569 nøkler, identisk sett**; **de 11 harmoniserte verdiene overlevde** (`adminBibliotek.tittel` = «SiteDoc-arkiv» i develop, verifisert med streng-diff mot forrige develop, ikke bare nøkkeltelling).
Gate: `pnpm test` 7/7 tasks — **`web` 259→261** (+2: testen som feiler hvis «Andre flyter» vises for en bundet flyt). Resten stille (`db` 2 · `api` 490 · `pdf` 120 · `shared` 824 · `mobil` 9). Integrasjon uendret på 48 (branchene rører null api/integrasjonsfiler). Begge CI-jobber grønne.

- 🟢 **BUNDET FLYT ER KOMPLETT** — kolonne og serversperre kom i `be2217d1`, UI-et nå. To radiovalg ved opprettelse («Fri flyt · standard» / «Bundet flyt ⚓»), bryter i etterkant med konsekvenstekst begge veier, fotnote som avviser rettighets-lesningen, `Anchor` på tre flater. **Fri flyt har INGEN symbol.**
- 🟢 **Test som feiler hvis «Andre flyter» vises for en bundet flyt** — sett rød først (`!egenFlytBundet`-vakten fjernet → testen falt). `data-testid` på begrunnelse-dialogen tatt med (`bekreft-begrunnelse-input` + `-send`).
- 🔴 **AVVIK FRA FASITEN, gatet av cowork:** fabels fotnote navnga «Endringsmeldinger». redesign generaliserte til «Dokumentene» fordi fotnoten vises i enhver bundet flyt (også «Varsel», «Teknisk avklaring»). Mikrotekst-standarden krever relasjonelle benevnelser. Siste setning står ordrett: «Det gjelder alle i prosjektet, ikke bare deg.»
- 🟢 **STRENGHARMONISERING LEVERT** — «Sentralarkiv» og «sentralmalen» ut som synlige begreper. 11 verdier i femten språk. Ingen nøkkel-rename, ingen kodeendring.
- 🟢 **Krav 5 var et ikke-problem:** ingen live UI sier «Standard» om `NS3420-K` — treet bruker dataens eget navn. «Standard for nye» står urørt.
- ⚠️ **MELDT, IKKE GJORT: seks relikvi-nøkler med 0 kodereferanser** (`firma.malarkiv.tittel`, `.tilbake`, `.kunFirmaAdmin`, `bibliotek.tittel`, `.hentFraBibliotek`, `.beskrivelse`). Nøkkel-sletting er egen sak.
- 🔴 **FALSK ALARM STRØKET:** mal-Opus meldte at `feat/bundet-flyt-skjema` ville felle nøkkelsett-testen ved å slette to nøkler fra `nb`/`en`. Målt: den ble merget for lenge siden (`be2217d1`), og begge nøklene finnes i alle femten filer. 2-punkts-diff mot en gammel branch-tipp.
- 🟡 **TO ÅPNE, Kenneth gater:** `maler.arkiv.kildeSitedoc` = «SiteDoc-standard» — mal-Opus anbefaler «SiteDoc-mal» for paritet med «Firmamal» · `innstillinger.sokeord.maler` — legg til «firmaarkiv sitedoc-arkiv» uten å fjerne «malarkiv».

---

## 🟢 2026-09-17 — Personvalg i videresend (`65e16a93`). WEB-DEPLOY, ingen migrering, ingen OTA.

**Én branch merget** (`fix/videresend-personvalg`, `--no-ff`). Kun `apps/web` + 15 i18n-filer (17 filer, +113/−15). Ingen fil i `apps/api`, `apps/mobile`, `packages/db` eller `tests/e2e`.
Gate: `pnpm test` 7/7 tasks — **`web` 257→259** (+2: regresjonstesten for personvalg). Resten stille (`db` 2 · `api` 490 · `pdf` 120 · `shared` 824 · `mobil` 9). **Integrasjon uendret på 48** (branchen rører null api/integrasjonsfiler — strukturelt uendret, ikke re-kjørt). Alle 15 i18n-filer på 4552 nøkler, identisk nøkkelsett (generatoren kjørt). Begge CI-jobber grønne.

- 🟢 **PERSONVALG I VIDERESEND VIRKER.** Radene under «Andre flyter» var `<div>` — kun flytnavnet var klikkbart. Flyt-bytte gikk alltid til hovedansvarlig utfører.
- 🟢 **Bekreftelsesboksen navngir valgt person med rolle; tittelen sier dokumentnavnet.** Valgt person → «Ballen går til Siri Vik (registrator)» · flytnavn → «Ballen går til Per Eng (hovedansvarlig utfører)». Tittel: «Flytt «Befaringsnotat»?».
- 🔴 **COWORK-FEIL: ordren påstod at ordlyden for begge tilfeller alt fantes. Den gjorde ikke det.** Kun auto-utleder-varianten («hovedansvarlig utfører») eksisterte. redesign la til én ny nøkkel (`videresend.konsekvensBallPerson`) framfor å gjenbruke feil tekst — og meldte det.

---

## 🟢 2026-09-17 — Tre brancher merget (`be2217d1`): diff/merge på ↻ (erstatter blankosperre) · bundet flyt (MIGRERING) · e2e 05/07. DEPLOY m/ MIGRERING.

**Tre disjunkte brancher, rekkefølge 1→2→3, `--no-ff` per branch.** Strategi: **e2e `10d656b8`** · **diff/merge `9cf21d37`** · **bundet flyt `be2217d1`**. `comm -12` tom mellom alle tre (målt selv). Base `7851f243`. `fix/e2e-status-assertions` var basert på `d2f8bf65` (bak develop), men develop rørte ikke dens tre filer → ren merge.
🔴 **BÆRER MIGRERING `20260917130000_bundet_flyt` — IKKE KJØRT.** Kenneth kjører den ved deploy (BUILD→MIGRATE→UP). `ALTER TABLE dokumentflyter ADD COLUMN bundet BOOLEAN NOT NULL DEFAULT false` (default = backfillen; ingen rad fødes tom). DRY-RUN.sql bevist read-only (kun SELECT).
Gate: `pnpm test` 7/7 tasks — alle stille (`db` 2 · **`api` 490** · `pdf` 120 · `shared` 824 · `web` 257 · `mobil` 9). **Integrasjon 44→48** (+5 diff/merge, +4 bundet flyt, −2 slettet blankosperre-test → netto på de to basene summerer til 48) — kjørt lokalt mot efemær `pgvector/pgvector:pg16`-sandkasse (CI-speil, port 5433). Begge CI-jobber grønne (`test` + `e2e 01–05/07`, run 35191786088).

**A — diff/merge på ↻ (erstatter sperren):**
- 🔴 **COWORK-FEIL RETTET.** Blankosperren fra forrige runde nektet oppdatering når noe dokument hadde data. Kenneths regel er at oppdatering nektes når data BERØRES. I drift ville sperren gjort at ingen prosjekt i bruk kunne motta maloppdateringer.
- 🟢 **↻ matcher nå gammelt mot nytt på `(type, label)` og BEHOLDER objekt-id ved match.** Dokumentdata følger automatisk. Nekt utløses KUN når et felt som HAR DATA forsvinner — og feilmeldingen NAVNGIR feltene.
- 🟢 **Entydighetsvakt ved kjøretid:** entydig nøkkel → match på tvers av overskrift (flyttet felt beholder data). Tvetydig → forelder-match, gjetter aldri.
- 🔴 **Kenneth-vedtak 17.09, definisjonen som gjelder:** «firmamaler skal alltid kunne oppdateres — de er aldri bundet av en handling i prosjekt. prosjektmal — kan kun oppdateres dersom tidligere lagrede data ikke berøres.»
- 🟡 **MELDT, IKKE BYGGET: tørrkjøring.** `firmamal.forhandsvisOppdatering` ~30–40 linjer, gjenbruker `diffObjektTre` uten transaksjon → «3 felt legges til, 1 fjernes, 12 beholdes» i ↻-bekreftelsen. Ingen skjemaendring. 🔴 Kenneth gater.
- 🟢 **Erstattet testfil:** `firmamal-oppdater-vern.integration.test.ts` SLETTET (per mandat, test 1 feilet mot ny kode først); ingen annen test dekker blankosperren. Ny `firmamal-diffmerge.integration.test.ts` — 7 tester sett røde i fire negativkontroller (NK-4: brøt entydighetsvakten, beviste at testen fanger GJETTINGEN).

**B — bundet flyt (BÆRER MIGRERING `20260917130000_bundet_flyt`):**
- 🟢 **Kolonne på `Dokumentflyt`, default FRI. Serversperre i `oppgave.ts` og `sjekkliste.ts`** mot flyt-bytte UT av en bundet flyt. Videresend INNEN egen flyt virker fortsatt.
- 🟢 **Dry-run: 18 flyter, 6 prosjekter, alle blir frie via defaulten. Ingen backfill.**
- 🔴 **`kanByttFlyt` er URØRT** — bundet flyt er en egenskap ved flyten, ikke en rettighet.
- ⚠️ **UI gjenstår:** radiovalg ved opprettelse, bryter i etterkant, fotnote, `Anchor`-symbol. Bestilles til redesign.

**C — e2e `05` og `07`:**
- 🔴 **FUNN: en test som passerte fordi handlingen aldri skjedde.** Samme feilklasse som de elleve testene som aldri kjørte. ⚠️ Avvis og Besvar krever begrunnelse; gjenåpne gjør ikke.
- 🔴 **MELDT: begrunnelse-dialogen mangler `data-testid`** (`DokumentHandlingsmeny.tsx:646`) — spec-en henger i placeholder-tekst. Fikses IKKE her; redesign eier fila.

---

## 🟢 2026-09-17 — Vern på firmaarkiv-↻ + fabels bundet-flyt-tegning (`045e376d`). WEB-DEPLOY, ingen migrering.

**Én branch merget + én tegning som egen commit. `fix/e2e-status-assertions` HOLDT (under avklaring, meldt).** Strategi: **vern `--no-ff`** (`22a4dc2f`), **fabel-tegning egen commit** (`045e376d`).
`firmamal.ts` ga **INGEN konflikt** selv om både indeks-mergen (forrige runde) og vern-branchen rører den: endringene er i ulike funksjoner og begge overlevde — **VERN-guard `oppdaterKopiFraHovedmal` `firmamal.ts:825-843`** (tellDokumenterMedInnhold `:830`) · **`deletedAt`-filter i dobbeltlån-vakten `firmamal.ts:894-900`** (`:898`). `merge-tree` dry-run var ren før merge.
Gate: `pnpm test` 7/7 tasks — alle stille (`db` 2 · **`api` 490** · `pdf` 120 · `shared` 824 · `web` 257 · `mobil` 9). **Integrasjon 37→39** (+2: vern-testen begge retninger) — kjørt lokalt mot efemær `pgvector/pgvector:pg16`-sandkasse (CI-speil). **`api` STILLE på 490 som forventet** (kontrollplan la ingen enhetstest; sperren dekkes av integrasjonstest). Ingen schema-endring, ingen OTA.

**A — sperre på firmaarkiv-↻ (funn #22, steg 1 av 2):**
- 🔴 **`oppdaterKopiFraHovedmal` nekter nå når prosjektmalens objekter har faktisk innhold i et aktivt dokument.** Speiler `slettObjekt` — det var en inkonsistens, ikke en manglende funksjon. `oppdaterKopiFraHovedmal` gjorde `deleteMany` + gjenskaping med NYE id-er, kun `verifiserAdmin`-gatet → all dokumentdata ble foreldreløs.
- 🟢 **Tellefunksjonen GJENBRUKT, ikke kopiert** — `tellDokumenterMedInnhold` i `mal.ts:85` fikk `export`, ingen andre kopi. Soft-slettede dokumenter teller ikke (`mal.ts:89-90`). `oppdaterFraSentralarkiv` verifisert trygg og URØRT (firmanivået bærer ingen dokumenter).
- 🟢 **Utveien står i feilmeldingen:** «Hent fra arkiv» lager en ny prosjektmal.
- 🔴 **STEG 2 SYNLIG PÅ BACKLOG:** Kenneths regel «forsvant et felt som har data?» krever at ↻ matcher gammelt mot nytt og BEHOLDER objekt-id-en (diff/merge, som koden selv kaller backlog `firmamal.ts:786`). **Sperren er MIDLERTIDIG.** Målt omfang 17.09: 40 prosjektmaler, 22 med dokumenter, 1 der malen alt er endret.
- ⚠️ **COWORK-FEIL godkjent:** krav 3 ba om i18n-nøkler, men `apps/api` har INGEN i18n — kontrollplan målte premisset og avvek bevisst.

**B — e2e `05` og `07` (HOLDT):**
- 🟡 **`fix/e2e-status-assertions` (`3578f3e4`) IKKE merget denne runden — under avklaring** (Kenneth-instruks). Spec-en følger statusmodellen (`avledStatus` gir `responded` KUN ved `retning=tilbake`; besvarelse framover = `received`). Slås på egen runde.
- 🔴 **`06-videresend` fortsatt ute** — ventet på en HANDLING fjernet fra menyen, slås på når `fix/videresend-personvalg` er inne.

**C — VEDTAK: bundet flyt (fabels tegning, Kenneth-gatet 16.09):**
- 🟢 **Navn: «Bundet flyt».** Motsatsen heter «fri flyt» i all mikrotekst. ⚠️ «Lukket» (dokumentstatus) og «låst» (maler) utelukket.
- 🔴 **Default: FRI.** Feilen skal gå mot «for åpen»: glemt binding gir en flytting som uansett krever bekreftelse, navngitt målflyt, påkrevd kommentar og logg.
- 🔴 **Nivå: per FLYT** — én boolsk kolonne på `Dokumentflyt`. **Ingen backfill** (alle eksisterende flyter forblir frie). Bryteren kan endres begge veier etter opprettelse — styrer kun hva som er lov framover, rører aldri dokumentdata.
- 🟢 **Symbol: lucide `Anchor`** (0 treff, ledig). Kun på BUNDNE flyter. ⚠️ `Lock` utelukket (17 treff mallåsing, leses som «du mangler tilgang»). «Andre flyter» fjernes ikke stille — fotnote med anker forklarer: «Det gjelder alle i prosjektet, ikke bare deg.»
- 🔴 **NESTE:** skjemaordre til kontrollplan, så UI til redesign.

---

## 🟢 2026-09-17 — Tre brancher merget (`d074d919`): videresend synlig konsekvens · partiell unik-indeks (MIGRERING) · funn #22-måling. DEPLOY m/ MIGRERING.

**Tre disjunkte brancher (parvis `comm -12` tom, verifisert mot ekte filer, alle base = `d8e051b2`).** Strategi: **unik-indeks `--no-ff`** (`3892f0f1`), **videresend `--no-ff`** (`a663a01f`), **funn21 `--no-ff`** (`d074d919`) — kun første kunne FF, resten disjunkte merge-commits, null konflikt.
Gate: `pnpm test` 7/7 tasks — **`api` 489→490** (dobbeltlån-vakt case 5) · **`web` 253→257** (`videresend-mottakervelger.test.tsx`), øvrige stille (`db` 2 · `pdf` 120 · `shared` 824 · `mobil` 9). **Integrasjon 36→37 grønn** (gjenlån-retningen) — kjørt lokalt mot efemær `pgvector/pgvector:pg16`-sandkasse (CI-speil), migrate deploy m/ `20260917120000` uten feil. `tsc --noEmit` rød KUN på `bibliotek-mal.test.ts:25-26` (TS2532) — **verifisert pre-eksisterende** (filen urørt av mergen, kald `next build` grønn). **BÆRER MIGRERING `20260917120000_unik_indeks_partiell_soft_delete` — cowork fører BUILD→MIGRATE→UP.**

**A — videresend synlig konsekvens (PILOTKRITISK):**
- 🔴 **VIDERESEND ER TILBAKE FOR FLYT-BUNDNE DOKUMENTER.** Pilot-fiks A (02.08) hadde fjernet affordansen på både web og mobil. Serveren kunne det; menyen tilbød det ikke.
- 🔴 **Gate-grunnen fra 02.08 var GAL:** `forwarded` returnerer på `oppgave.ts:1515`, FØR `beregnRuting` på `:1549`. Valget ble aldri kastet av posisjonsruting. Kodekommentaren på `DokumentHandlingsmeny.tsx:428-433` tok feil.
- 🟢 **Kenneths tre scenarier er nå mulige fra flaten:** re-gate til person · rette feil dokumentflyt · tømrer→ledelsen→elektriker. Mottakervelger i to seksjoner («I denne flyten» / «Andre flyter» kun ved `kanFlytte`, ⇄-linje navngir målflyt). Bekreftelsessteg ved flytbytte: konsekvensboks + PÅKREVD kommentar + knapp som navngir målflyten.
- 🟢 **Mottakeren ser «⏳ Venter på deg» + avsender med faggruppe og dato + kommentar i raden** — ikke bare et nytt dokument. **`DocumentTransfer` bar all dataen — ingen schema-endring.** `select`-kostnaden målt: `transfers: { take: 1 }` gir K→K+1 batchede spørringer, ikke N+1.
- 🟡 **MOBIL: mindre enn antatt.** Mobil ALT har flyt-bytte-flyten (`visFlytBytte`-sheet, `kanFlytte`-gating). Det som mangler er en person-velger innen egen flyt — dataen er plumbet. 🔴 **Egen liten runde, trenger neppe tegnerunde.**

**B — partiell unik-indeks (BÆRER MIGRERING):**
- 🔴 **`20260917120000_unik_indeks_partiell_soft_delete`.** Soft-slettet mal blokkerer ikke lenger gjenlån. ⚠️ Fella var at en angrehandling tvang en destruktiv: du måtte tømme HELE papirkurven for å låne malen igjen.
- 🔴 **Dobbeltlån-vakten (`firmamal.ts:861`) filtrerte IKKE på `deletedAt`** — nå fikset. Begge retninger sett røde (gjenlån etter soft-slett → `P2002` mot full indeks · to aktive lån → rød da indeksen ble droppet).
- 🟢 **Dry-run gatet av Kenneth (`sitedoc_test` 17.09, read-only):** 0 soft-slettede firmamaler, 0 duplikat-lån. `CREATE UNIQUE INDEX` vil ikke feile. **`DRY-RUN.sql` verifisert read-only (kun SELECT).**

**C — funn #22-måling (docs):**
- 🔴 **Premisset nedjustert — to vern fantes allerede.** Cowork kalte strukturkopi «største umålte pilotrisiko»; måling viste at `mal.ts`-endringsvernet (07.09) + `grenseSnapshot` dekker mesteparten. Ett hull står i firmaarkiv-↻ (`oppdaterKopiFraHovedmal`); fiksen kommer som egen branch (`fix/vern-oppdater-kopi`, kontrollplan).
- ⚠️ **Ført som funn #22** («#21» var alt tatt). ⚠️ **LÆRDOM: Subagent-rapport er input, ikke fasit** — en Explore-subagent ga feil svar («intet endringsvern») ved å hoppe over guard-linjene.
- ⚠️ **AVVIK meldt:** funn21 rørte `docs/claude/BACKLOG.md` (additivt, funn #22 + nummer-note) — ordrens Steg 1 forventet den urørt. Harmløst (kun funn21 rørte den, kolliderer ikke med tavla).

---

## 🟢 2026-09-16 — Tre brancher merget (`09d6df7f`): versjonssporing+soft-delete (MIGRERING) · kapittelkollaps · e2e-dedrift. DEPLOY m/ MIGRERING.

**Tre disjunkte brancher (parvis `comm -12` tom, verifisert mot ekte filer).** Strategi: **kapittelkollaps ff** (`d15a7fc0`), **e2e-dedrift rebase+ff** (basert på develop-tippen),
**versjonssporing rebase+ff** (branchet fra `0c7efe21`, før PR2-tavla — rebase replayet kun `de182bd2`, rørte ALDRI STATUS-AKTUELT; diffen var ren base-artefakt).
Gate: `pnpm test` 7/7 tasks — **`api` 488→489 · `web` 249→253**, øvrige stille. **Integrasjon 33→36 grønn i CI** (kan ikke kjøre lokalt: `DATABASE_URL` ikke satt i merge-treet — antall 36 bekreftet ved collection). Kald web-bygg grønn. Begge CI-jobber grønne. **BÆRER MIGRERING `20260916120000_versjonssporing_softdelete` — cowork fører BUILD→MIGRATE→UP.**

**A — versjonssporing + soft-delete (MIGRERING):**
- 🟢 **Versjonsmønsteret komplett på tre nivåer** — kapittelmal egen `version`, firmamal `versjonAvHovedmal` mot kapittelarkivet, prosjektmal sin mot firmamalen.
- 🔴 **Backfillen beviselig riktig** — `BibliotekMal.versjon` har aldri hatt skrivevei (`git log -S`), alle lån skjedde på versjon 1. Dry-run mot `sitedoc_test`: backfyller **6 rader hos SITEDOC MYRHAUG, 0 andre firmaer** (Kenneth-gatet, read-only verifisert).
- 🟢 **`versjonAvHovedmal` NULLABLE med vilje** (default'et 1 ville skjult manglende snapshot). DB-garanti: rå-SQL `CHECK` (Prisma kan ikke uttrykke den). Integrasjonstest SETT RØD: droppet CHECK → rad slapp inn uten snapshot → rød.
- 🔴 **FUNN: soft-delete blokkerer gjenlån** — unik-indeksen fra runde 95 teller soft-slettede rader. Fiks = partial unique index `WHERE deleted_at IS NULL`, egen runde. **Ført BACKLOG #21.**
- 🔴 **FUNN: `OrganizationTemplate.version` bumpes ikke av eget objekt-CRUD** — firmanivå svakere versjonert enn kapittelnivå. **Ført BACKLOG #21.**
- 🟡 **N dager auto-tømming IKKE satt** — `tomPapirkurvPermanent` tar `eldreEnnDager` som påkrevd input, ingen default/cron.

**B — kapittelkollaps, fire flater:**
- 🟢 **Kollaps kun på KAPITTEL** (`NS3420-K`/`NS3420-F`); underkapittel-etikettene borte. Kollapsbar underkapittel-overskrift KUN ved 3+ maler (i dag utløser bare `KB`). Én delt primitiv `byggUnderkapittelBlokker` i fire flater: «Hent fra arkiv» (begge faner) · trestrukturen i Malforvaltning · `LaanFraSentralarkivDialog` · `kontrollplan/OpprettPunktDialog`.
- 🔴 **TERMINOLOGI-VEDTAK (Kenneth 16.09):** kapittel = én bokstav (`K`,`F`) · underkapittel = to (`KA`) · post = `KC3.1`. ⚠️ Kodens `BibliotekStandard` = Kenneths «kapittel»; `BibliotekKapittel` = hans «underkapittel» (forskjøvet ett hakk). **Modellnavn døpes IKKE om — vedtaket gjelder det brukeren ser.**
- ⚠️ `kontrollplan.opprettPunkt.visKapitler` er nå relikvi («vis kapitler»-avkrysningen fjernet). La stå — mal-Opus rydder i18n.

**C — e2e de-drift:**
- 🟢 **01–04 de-driftet og grønne i CI, 5/5 kjøringer, ingen flaky.** 🔴 **INGEN `data-testid` lagt til** — dokgens del-2-diagnose var feil; testid-ene fantes, problemet var tvetydighet (3 treff) + sticky header-overlay. Ingen web-komponent rørt → ingen web-deploy fra denne.
- 🔴 **SEED-FIKS:** `seed-testbrukere.ts` fikk `ProjectOrganization`-join-raden (prosjektet var prøveprosjekt fordi `erStandaloneProsjekt` teller den raden). ⚠️ `seed-e2e-pilot.ts` + `seed-agent-mobil-test.ts` fortsatt berørt (meldt, ikke rørt). **Ført BACKLOG (ProjectOrganization-post).**
- 🔴 **FUNN: `Project.primaryOrganizationId` og `ProjectOrganization` er to UAVHENGIGE kilder UTEN constraint** — de kan divergere; seeden gjorde det. **Ført BACKLOG (ProjectOrganization-post).**
- 🔴 **05/06/07 HOLDT UTE.** `06-videresend` er IKKE spec-drift: pilot-fiks A (02.08) gater Videresend bort for flyt-bundne dok (`DokumentHandlingsmeny.tsx:434` `!harFlyt`, mobil `DokumentHandlingslinje.tsx:208`). Fabels tegning 16.09 gjenåpner den — egen runde. **Fabels videresend/bytt-flyt-tegning committet denne runden (`f1ac764d`).**

---

## 🟢 2026-09-16 — Malforvaltning PR 2 merget (`0c7efe21`): `firma/malarkiv` REVET. UTLØSER WEB-DEPLOY.

**Merget `feat/malforvaltning-pr2` (ren fast-forward `267f42b0..0c7efe21`).** 28 filer, +1456/−1017 (13 kode/test + 15 i18n).
Alle femten språkfiler i takt på 4522 (verifisert likt nøkkelsett). Gate: `pnpm test` 7/7 tasks, **`web` 244→249** (+5 gating), `api` stille 488,
øvrige stille. Kald web-bygg grønn. Begge CI-jobber grønne. **Første web-deploy på flere runder — cowork fører den.**

- 🟢 **MALFORVALTNING PR 2 LEVERT — `firma/malarkiv` er REVET.** Firmaarkiv-fanen er én liste med filtrerbar maltype-kolonne. Nav-lenken PR 1 holdt tilbake er lagt inn. `/dashbord/firma/malarkiv` + `/[malId]` består som REDIRECTS (bevarer `malId`), ikke flater.
- 🟢 **ELLEVE funksjoner flyttet med bevis per funksjon.** Fem av dem sto IKKE i coworks ordre — redesign målte flaten i stedet for å stole på lista (rediger-metadata-dialog · inspiser-før-lån · HMS-subdomain/synlighet · «allerede lånt»-vakt · søk-i-lån-dialog).
- 🔴 **TO PREMISSFEIL I COWORKS ORDRE, målt og meldt av redesign:** (1) «versjonsavstand» i OPPHAV finnes ikke som data — cowork tok tallet fra fabels MOCKUP og behandlet en tegning som funksjonalitet. (2) slett-sperren `mal.ts:500` er PROSJEKTmal-sperren; `firmamal.slett` hard-sletter — ordren motsa seg selv. 🟢 Bygget ærlig: OPPHAV viser avstamning + ↻, sletting får permanent-advarsel + `copiedTo`.
- 🔴 **FUNN: den generelle «Tilbake til …»-whitelisten finnes ikke.** `TilbakeLenke.ETIKETT_FRA_KILDE` er papirkurv-only; `Nivaabanner.tilbake` validerer ingenting. redesign repekte `Nivaabanner.tilbake` til malforvaltning-roten med ny nøkkel — ingen etikett forsvant.
- 🟢 **Kollaps i «Hent fra arkiv» flyttet til STANDARD-nivå** (`NS3420-K`/`NS3420-F`, kapitler som statiske underetiketter), maler sortert på referanse med numerisk `localeCompare` (`KC3.1 < KC10`). **Serverens `orderBy` urørt.**
- 🟡 **MELDT, KENNETH GATER:** `LaanFraSentralarkivDialog` har fortsatt per-kapittel-kollaps — utenfor Del C's scope; redesign utvidet ikke. Konsistensspørsmålet tas til Kenneth.
- 🟢 **`sok-dekning`-testen:** firma- og SiteDoc-arkiv deler nå URL (begge → Malforvaltning) — endret til å skille på `id`, redirect-roten lagt i unntakslista.
- 🔴 **Versjonssporing firmamal→SiteDoc-arkiv bygges NÅ av kontrollplan** (`feat/versjonssporing-softdelete`, ikke pushet ennå) — sammen med soft-delete som låser opp Papirkurv-fanen.

---

## 🟢 2026-09-16 — E2e del 2 merget (`8ddad2e0`): riggen målt stabil, seks spec-er avslørt DRIFTET. INGEN deploy.

**Merget `ci/e2e-del2` — IKKE fast-forward** (dokgen branchet fra `0612f938`, før nøkkelsett-mergen). **Strategi: rebase** (null overlapp
mot det develop fikk i mellomtiden — `comm -12` tom; develop fikk kun i18n+test+STATUS, del2 rører kun `ci.yml`+`kvalitetssikring-plan.md`).
Rebaset rent på develop, alle tre commits bevart (inkl. negativ-kontroll-sporet), så `--ff-only` `d08496e4..8ddad2e0`. 2 filer, +43/−4.
Gate: `pnpm test` 7/7 tasks, seks tall (`db 2 · api 488 · pdf 120 · shared 824 · web 244 · mobil 9`). Begge CI-jobber grønne.

- 🟢 **Riggen er MÅLT STABIL — 5/5 grønne kjøringer, ingen retries, miljø klart 4–5 s** (4m03s · 3m23s · 3m48s · 3m05s · 2m54s).
- 🟢 **`db-maskin`-migreringene inn i e2e-miljøet** — `maskin.vegvesen_ko does not exist`-støyen er borte (verifisert i CI-logg, ~2 s).
- 🔴 **HOVEDFUNN: SEKS AV SJU E2E-SPEC-ER ER DRIFTET.** Skrevet mot et UI som siden er endret; ingen merket det fordi suiten aldri kjørte i CI. `02-opprett` venter `role="button"` der `OpprettMalVelger.tsx` nå rendrer `role="option"` (UI-refaktor `f567d339` 04.08, spec sist rørt 26.07). Tre spec-er venter på testid-er som ikke finnes. Ingen flaky — alle feiler deterministisk. **Ført som egen BACKLOG-post.**
- 🔴 **SEED-GAP (treffer mer enn e2e):** `seed-testbrukere.ts:95` setter `primaryOrganizationId` men oppretter ALDRI `projectOrganization`-join-raden. `erStandaloneProsjekt` (`prosjektGrense.ts`) teller den — er den 0, regnes prosjektet som PRØVEPROSJEKT (maks 10). Seedet produserer prosjekter som ikke ligner produksjon. **Ført som delfunn under eksisterende `ProjectOrganization`-legacy-post i BACKLOG.**
- 🟢 **Negativ kontroll i CI:** `02-opprett` kjørt midlertidig → RØD på den diagnostiserte driften. Riggen fanger drift i CI, ikke bare lokalt.
- 🔴 **E2e forblir KUN `01-login` i CI** inntil en egen runde med SPEC-REDIGERINGS-MANDAT har de-driftet 02–07 og lukket seed-gapet. Å slå dem på nå ville gjort develop rød.
- 🟡 **Blokkering (dokgens anbefaling, cowork-gatet):** e2e blokkerer IKKE merge nå (for tynt signal med én spec); kun på PR, ikke hver push. Veien forbi finnes: `git push origin HEAD:develop` fra merge-treet omgår PR-gaten. Vurderes på nytt når 02–07 er grønne.

---

## 🟢 2026-09-16 — Nøkkelsett-testen merget (`e599d40a`): i18n-hullet kan ikke lenger gjenoppstå stille. Utløser web-deploy (samles).

**Merget `test/i18n-nokkelsett` (ren fast-forward `0612f938..e599d40a`).** 16 filer, +160/−15: de femten språkfilene +
`packages/shared/src/i18n/nokkelsett.test.ts`. Ingen kodefil utenom testen. Gate: `pnpm test` 7/7 tasks, **`shared` 823→824**
(testen bor der), de fem andre stille (`db 2 · api 488 · pdf 120 · web 244 · mobil 9`). Begge CI-jobber grønne på develop.

- 🟢 **NØKKELSETT-TESTEN LEVERT** — `packages/shared/src/i18n/nokkelsett.test.ts` leser alle femten filer og krever samme nøkkelsett som `nb`. **Feilklassen kan ikke lenger gjenoppstå stille.**
- 🔴 **GJELDEN HADDE VOKST FRA 0 TIL 7 PÅ ETT DØGN** — fire nøkler fra Malforvaltning PR 1 (`malforvaltning.fane.sitedoc`/`.ingenTilgang`/`.tittel`/`.undertittel`), tre fra arkiv-søk (`sok.firmaarkiv`/`sok.sitedocArkiv`/`innstillinger.sokeord.maler`). Begge runder passerte coworks merge-gate uten at generatoren ble kjørt. Alle femten på 4506 etter runden.
- 🟢 **Testen er SETT RØD før grønn** (`sok.firmaarkiv` fjernet fra `de.json` → rød). Feilmeldingen navngir nøkkel + fil og gir løsningskommandoen (`generate.ts --only <nøkkel>`).
- 🟢 **`firmaNav.malarkiv` slettet i alle femten** — relikvi etter at menypunktet ble fjernet. Verifisert 0 kallere (grep i `apps/`+`packages/`). ⚠️ Testen fanger IKKE relikvier som finnes i ALLE filer — de må tas manuelt (nøyaktig scenariet kravet beskrev).
- 🔴 **NY REGEL, i kraft fra denne mergen:** enhver runde som legger `nb`/`en`-nøkler MÅ kjøre `generate.ts --only <nøkler>`, ellers blir CI RØD (tilsiktet). Sperren mot at andre agenter enn mal-Opus kjører generatoren gjelder ikke lenger for deres EGNE nye nøkler — kun for eksisterende nøkler i de tretten.
- ⚠️ **Lærdom (mal-Opus):** `git checkout <fil>` under en negativ kontroll reverterte også ugatet arbeid i samme fil. Ta backup av arbeidstre-versjonen FØR `git checkout`, ikke etter.

---

## 🟢 2026-09-16 — E2e i CI del 1 merget (`d136340f`): efemært miljø + `01-login` grønn. INGEN deploy.

**Merget `ci/e2e-efemert-miljo` (ren fast-forward `f6c13eca..d136340f`, fire commits bevart — ikke squashet).** 2 filer, +123/−19:
`.github/workflows/ci.yml` + `kvalitetssikring-plan.md`. Ingen spec-fil, ingen kodefil. Gate: `pnpm test` 7/7 tasks, seks tall stille
(`db 2 · api 488 · pdf 120 · shared 823 · web 244 · mobil 9`). **Begge CI-jobbene grønne på develop: `test` ✓ og `e2e-del1 (KUN 01-login)` ✓.**

- 🟢 **E2E I CI DEL 1 LEVERT** — efemært miljø (pg+pgvector, migreringer, seed, api+web), `01-login` grønn i egen parallell jobb (3m25s, parallelt med `test`). Miljøet klart etter 4–5 s via helsesjekk, ikke `sleep`.
- 🟢 **Begge negativkontroller kjørt i CI:** feil api-port → rød på HELSESJEKK før Playwright startet · feil testid → rød på assertionen. Riggen feiler tidlig og av riktig grunn. `git diff 1cee88fa d136340f` tom.
- 🟢 **Seed kjørbar og idempotent** — `seed-testbrukere.ts` + `seed-e2e-flyt.ts`. E2e-suiten er IKKE avhengig av manuelt oppsatt tilstand i `sitedoc_test`.
- 🟢 **Ingen GitHub-secret nødvendig for del 1** — jobb-generert `DEV_LOGIN_SECRET` (+ `AUTH_SECRET`, `FIL_SIGNING_SECRET`). Ingenting lagres.
- 🔴 **ARKITEKTUR-FUNN:** web `/api/trpc` kjører tRPC-routeren IN-PROCESS, ikke som proxy til Fastify. Web er selvstendig for nettleser-flyten; api (Fastify) trengs for `global-setup` sin dev-login og `slåOppFlyt`. Verdt å vite ved ethvert miljøoppsett.
- 🔴 **`next start` tvinger `NODE_ENV=production`** → trigger `assertFilSigneringEnv("web")` i `instrumentation.ts`; derfor kreves `FIL_SIGNING_SECRET` + `AUTH_SECRET` for å boote web overhodet.
- 🟢 **Cookie-navn-grenen treffer riktig:** http-miljø → `authjs.session-token`, ikke `__Secure-`-varianten. Admin-sweepen er env-guardet til `sitedoc_test` og hopper trygt over.
- ⚠️ **MELDT, ikke løst:** api-bakgrunnsworkeren logger `maskin.vegvesen_ko does not exist` fordi `db-maskin`-migreringene ikke kjøres i e2e-miljøet. Ufarlig for login. Vurderes i del 2.
- 🟡 **Blokkeringsspørsmålet (dokgens anbefaling, cowork-gatet inntil videre):** e2e-jobben RAPPORTERER, blokkerer IKKE merge — «én grønn kjøring sier ingenting om flakiness». Kenneth avgjør i del 2 etter stabil grønn over flere kjøringer.
- 🔴 **NESTE: e2e del 2** — de seks andre spec-ene, `db-maskin`-støyen, blokkeringsspørsmålet.

---

## 🟢 2026-09-16 — Mobil testharness merget (`b8ee57cc`): fase 2 offline AVBLOKKERT. INGEN deploy.

**Merget `test/mobil-harness` (ren fast-forward `403be913..b8ee57cc`).** 7 filer, +338/−10: vitest-config + 2 testfiler i
`apps/mobile`, `package.json` (test-script + devDeps), `pnpm-lock.yaml`, BACKLOG + kvalitetssikring-plan. `metro.config.js`/`app.json`/`eas.json` NULL diff.
Gate: `pnpm test` **7/7 tasks**, seks tall: `db 2 · api 488 · pdf 120 · shared 823 · web 244 · mobil 9`. CI på develop grønn, `@sitedoc/mobile:test` kjørte der.

- 🟢 **MOBIL TESTHARNESS LEVERT — fase 2 offline er AVBLOKKERT.** vitest i `apps/mobile`, 9 tester (unit-ren 6 · integrasjon 3), med i `pnpm test` fra ROT og i CI. **Gate-tall er SEKS fra nå:** `db · api · pdf · shared · web · mobil`.
- 🟢 **Krav (c) EKTE oppfylt mot reell SQLite** (`sql.js` WASM, ikke `better-sqlite3` — node v25 lokalt / v20 CI ville gjort nativ modul ABI-følsom; avvik fra BACKLOG-anbefaling begrunnet ved måling). Tom `sjekkliste_id` → `NOT NULL constraint failed` fra SQLite selv, ikke mock. **Mobil-unntaket i CLAUDE.md er fjernet — «stille tomhet» gjelder nå uten unntak i hele repoet.**
- 🟢 **To BACKLOG-poster lukket av dokgen (i branchen):** «apps/mobile har INGEN test-runner» (blokkerte fase 2) og `splittVedMidnatt` (lønns-sensitiv, tidligere kun manuelt `tsx`-verifisert).
- 🔴 **MÅLT SQLite-quirk:** `PRIMARY KEY` alene håndhever IKKE `NOT NULL` på TEXT-kolonner. `sjekkliste_feltdata` har eksplisitt `NOT NULL` på både `id` og `sjekkliste_id` — ellers ville krav (c)-testen ikke bitt. Verdt å huske ved nye offline-tabeller.
- ⚠️ **UVERIFISERT (meldt av dokgen):** faktisk `expo export`-bundle-diff er ikke kjørt. Reachability bevist statisk (testfiler + devDeps uåtakbare fra `expo-router/entry`); observert tom bundle-diff gjenstår — verifiseres ved neste EAS-bygg, ingen egen kvote brukes.
- ⚠️ **CLAUDE.md-størrelse:** `wc -m` (tegn — regelens metrikk) = **40183 < 40960 ✓**. `wc -c` (bytes) = 41133. Ordrens anslag «~40 900» var mot bytes og traff ikke; unntakslinja var ~458 bytes, ikke ~690.

---

## 🟢 2026-09-16 — «Stille tomhet»-rekvittering merget (`082d1a60`): tre ekte integrasjonstester. INGEN web-deploy.

**Merget `test/stille-tomhet-rekvittering` (ren fast-forward `69c9ef2e..082d1a60`).** 4 filer, +457/−1: tre nye
`*.integration.test.ts` + `kvalitetssikring-plan.md`. Ingen kodefil, ingen skjemaendring. Gate: `pnpm test` **6/6 tasks**,
fem tall stille (`db 2 · api 488 · pdf 120 · shared 823 · web 244`). Fordeling: **unit-mock 158 · unit-ren 330 · integrasjon 17→33 · e2e 8** (integrasjon utenfor rot-kjeden). `find *.integration.test.ts` = **7** filer. CI på develop grønn.

- 🟢 **«STILLE TOMHET»-REKVITTERINGEN LUKKET** — alle fire migreringer har nå en test som faktisk feiler når dataen mangler (`integrasjon` 17→33: dokumentnummer 6 · gruppe-systemnøkkel 5 · bibliotekmal-objekttabell 5; `firmaarkiv_unik_indeks` innfridd av CI-runden). Alle tre sett RØDE før grønne (dokgen brøt hver lokalt mot engangs-Postgres).
- 🟢 **DB-garantien mot to `system_nokkel = 'hms'` per prosjekt FINNES** — `project_groups_prosjekt_systemnokkel_unik`, partiell unik-indeks `(project_id, system_nokkel) WHERE system_nokkel IS NOT NULL`. 🔴 Coworks bekymring om at den hvilte på backfillen alene var UBEGRUNNET — strøket.
- 🔴 **MÅLT: `Checklist.number` og `Task.number` er `Int?`** — maler uten prefiks får aldri nummer. Postgres NULLS DISTINCT betyr at den unike indeksen tillater vilkårlig mange NULL-nummer per mal. Testet eksplisitt for begge tabeller — ikke en feil, men en felle som nå er dokumentert i test.
- ⚠️ **De mockede testene BLIR STÅENDE** — de tester andre ting; integrasjonstestene kom i tillegg.
- 🟡 **BACKLOG:** ingen dedikert post fantes for server-side migrering-rekvitteringen (målt — søk på migreringsnavn/«rekvittering» ga null). Posten «apps/mobile har INGEN test-runner» gjelder **mobil** offline og forblir ÅPEN (denne runden lukker den ikke). Ingen post opprettet (per ordre).

---

## 🟢 2026-09-16 — CI: integrasjonstestene slått på mot engangs-Postgres. INGEN web-deploy (CI rører ikke kjørende kode).

**Merget `ci/integrasjon-og-e2e` (ren fast-forward `81b2a785..a27f5131`, tre commits bevart — ikke squashet).** 3 filer, +93/−11:
`.github/workflows/ci.yml` · `package.json` (kun nytt `test:integration`-script) · `docs/claude/kvalitetssikring-plan.md`. Ingen kodefil.

- 🟢 **Slått på:** 17 integrasjonstester (4 filer) kjører nå i CI mot en engangs-pgvector-Postgres — migreringene påføres, så testene. Utenfor CI: 8 e2e-spec-er.
- 🟢 **Syklusen bevist i PR #4:** grønn på `0a01534e` (17 tester passed, «All migrations successfully applied») → RØD på `c5c5207d` (bevisst P2002→P9999-brudd; kun integrasjonssteget feilet, `pnpm test` 488 unit forble grønt — rent signal) → grønn igjen på `a27f5131` (revert). `git diff 0a01534e a27f5131` er tom (verifisert).
- 🟢 **Kjøretid:** 1m48–54s → 2m19s (+29s: pgvector-init 22s, migrer 3s, integrasjon 6s).
- 🔴 **e2e står bevisst UTENFOR CI** — suiten muterer `sitedoc_test`; efemært miljø kreves (dokgens kø, egen runde).
- 🔴 **Gate-tall NY FORM (rot-`pnpm test`, helt stille): `db 2 · api 488 · pdf 120 · shared 823 · web 244`.** `api`-fordeling (dokgens måling): unit-mock 158 · unit-ren 330 · integrasjon 17 (i CI, eget script) · e2e 8 (utenfor CI). 158+330 = 488 ✓.

---

## 🟢 2026-09-15 — Malforvaltning PR 1 merget (`c192104c`): skall + gating + SiteDoc-fane, `admin/bibliotek` REVET. Utløser web-deploy.

**Merget `feat/malforvaltning` (ren fast-forward `4447fb0a..c192104c`).** 13 filer, +200/−214 (netto MINDRE kode). i18n kun `nb`/`en`.
Gate fra ROT grønn (`pnpm install` + `prisma generate` ×4): **`db 2 · api 488 · pdf 120 · shared 823 · web 244`** — `api` FALT −4
(`bibliotek-oppdater-mal.test.ts` slettet med `oppdaterMal`), `web` STEG +4 (`malforvaltning-tilgang.test.ts` gating-negativ-kontroll). Kald web-bygg grønn.

- 🟢 **MALFORVALTNING PR 1 LEVERT** — `/dashbord/firma/innstillinger/malforvaltning`. Skall + gating + SiteDoc-arkiv-fanen.
- 🔴 **`admin/bibliotek` ER REVET.** Flaten flyttet (git: rename R082) til `malforvaltning/_components/SitedocArkivFane.tsx`.
  `bibliotek.hentMalRedigering` og `oppdaterMal` slettet — **verifisert arveløse repo-vidt (grep i web+mobil = null kallere).**
  `/dashbord/admin`-unntaket i `sok-dekning.test.ts` gjenopprettet i full bredde.
- 🟢 **Gating bevist:** ren `gateMalforvaltningFaner()` — SiteDoc-admin ser SiteDoc-fanen · prosjektadmin/-bruker ser INGEN fane → flaten skjult · direkte URL «ingen tilgang» · ingen søketreff.
- 🔴 **KENNETH-VEDTAK 15.09, tre stykker:**
  1. Firmaarkiv-fanen blir ÉN liste med filtrerbar maltype-kolonne — ikke underfaner. «L9-adskillingen tapes ikke — flyttes fra faner til kolonne + filter».
  2. Papirkurv-fanen BLOKKERT: `firmamal.slett` hard-sletter (`firmamal.ts:499`), `OrganizationTemplate` mangler `deletedAt` — mockupens «Papirkurv (5)» har ingen data. Egen skjemarunde med backfill, DB-garanti og feilende test på tom kolonne. Samme runde definerer auto-tømming (N dager).
  3. `firma/malarkiv` RIVES i PR 2 — men først når Malforvaltning beviselig dekker alt, med bevis per funksjon, redirect og oppdatert «Tilbake til …»-whitelist.
- 🔴 **RETTELSE hos fabel:** hans vedtaksnotat leste «#3» som `firma/malarkiv`. Kenneths bilde #3 var `/dashbord/oppsett/produksjon/sjekklistemaler` — prosjektarkivet. Kenneth har aldri sagt at `firma/malarkiv` skal bestå.
- 🟢 **LÅST OPP: lese/redigere-aksen.** Alle prosjektmedlemmer LESER fra alle tre arkivene via «Hent fra arkiv»; kun firma-/SiteDoc-admin FORVALTER. **Rettighetskonflikten fra 12.09 er løst — matrisen var ikke feil, den manglet en akse.** 🔴 `hentStandarder`-sikkerhetsrunden er nå ulåst; `terminologi.md § 0` skal oppdateres — begge bestilles av cowork.
- 🟡 **MELDT (ingen handling nå):** ingen nav-lenke i PR 1 med vilje — en firmaadmin har ingen fane ennå, lenke til tom flate = samme løgn som `admin/bibliotek` var. Lenken legges i PR 2. Flaten nås via søk + fotnoten.
- 🟡 **MELDT:** SiteDoc-arkivet lever nå under firma-kontekst og krever valgt firma, selv om arkivet er firma-uavhengig. Harmløst (SiteDoc-admin har alltid firma valgt via FirmaVelger). Nyanse, ikke feil.
- ⚠️ **Ny i18n-gjeld: nøkler i `nb`/`en` som de tretten mangler.** 🔴 mal-Opus' nøkkelsett-test er bestilt, fanger klassen permanent.
- 🔴 **NESTE: Kenneths visuelle gate på ny rute → PR 2.**
- ⚠️ **Uendret åpent:** papirkurv i sidefeltet · funn #21 · `BibliotekMal` mangler `updatedAt` · fastefelt-kolonnene · N dager auto-tømming · fargeføringen.

---

## 🟢 2026-09-15 — Malarkiv ut av sidefeltet + alle tre arkivnivåer søkbare merget (`aab32f9e`). Utløser web-deploy.

**Merget `fix/malarkiv-ut-av-sidefelt` (ren fast-forward `84df84ab..aab32f9e`).** To commits: `ecf3df9d` (menypunkt ut) + `aab32f9e`
(alle tre arkivnivåer søkbare). 6 filer, +143/−14. i18n traff KUN `nb`/`en` (3 nye nøkler). Gate fra ROT grønn
(`pnpm install` + `prisma generate` ×4): **`db 2 · api 492 · pdf 120 · shared 823 · web 240`** — `web` steg +5 (gating-testen kjørte).

- 🔴 **Malarkiv er UTE av firma-sidefeltet** (`firma-nav.tsx`). Ruta `/dashbord/firma/malarkiv` består; kun navigasjonsinngangen er borte. Kenneth-vedtak 13.09, endelig utført 15.09.
- 🟢 **Inngang til firmaarkiv-redigering:** `oppsett/produksjon/*maler` → «Hent fra arkiv» → firma-fane-fotnoten. Alle tre maltypene (sjekkliste/oppgave/HMS) bruker `MalListe` → har modalen — ingen fane ble unåbar.
- 🟢 **ALLE TRE ARKIVNIVÅER ER NÅ SØKBARE, alle tre EKTE registreringer** — ingen låner lenger fra sidefeltet.
- 🔴 **MÅLT ROTÅRSAK (Kenneth 15.09):** firmaarkivet var søkbart kun fordi det sto i venstremenyen; SiteDoc-arkivet har aldri vært registrert. Tre-nivå-modellen bygget ett nivå om gangen uten at strukturen ble laget for tre — samme rot som at prosjektnivået manglet navn i `nb.json` før 13.09.
- 🟡 **MELDT, KENNETH GATER:** de tre arkivene sitter i TO kilder, ikke én. Prosjekt i `innstillinger-kort` (nav-hjem under Oppsett), firma + SiteDoc i `dype-sider` (ingen nav-hjem). Én felles «arkiv-gruppe»-kilde krever større omstrukturering.
- 🟢 **Gating bevist:** `gateDypeSider()` trukket ut som ren funksjon — SiteDoc-admin ser begge · prosjektbruker ser ingen · firmaadmin ser kun firma · antallskontroll fanger død gating.
- 🟢 **`/dashbord/admin`-unntaket står** — kun `admin/bibliotek` tatt ut av det.
- 🟡 **MELDT:** `innstillinger-kort.tsx` fikk et `arkiv`-søkeord (utenfor redesigns filliste, men prosjektarkivet BOR der). Cowork gater det som riktig.
- ⚠️ **`firmaNav.malarkiv` er nå relikvi (0 kodereferanser).** IKKE slettet — ryddes i en i18n-runde, unngår drift mot de tretten.
- 🔴 **NY i18n-gjeld samme dag den ble lukket: 3 nøkler i `nb`/`en` som de tretten mangler.** Nøyaktig mønsteret mal-Opus målte — hullet gjentar seg hver runde. 🔴 **Nøkkelsett-testen bestilles nå.**
- ⚠️ **Uendret åpent:** Kenneths visuelle gate av vei C del 2 · riving av `admin/bibliotek` · papirkurv i sidefeltet · rettighetsmatrisen vs. ulåst SiteDoc-fane · funn #21 · `BibliotekMal` mangler `updatedAt` · fastefelt-kolonnene.

---

## 🟢 2026-09-15 — i18n-gjeld lukket + vei C del 2 (MalBygger på SiteDoc-nivå) merget (`345476c8`). Utløser web-deploy.

**Merget to brancher** (i18n `chore/i18n-gjeld` `d06daf02` fast-forward FØRST, så vei C del 2 `feat/malbygger-sitedoc-niva` `0f353a1c` som ekte `--no-ff`-merge — ingen filoverlapp, `comm -12` tom). Gate fra ROT grønn
(`pnpm install` + `prisma generate` ×4): **`db 2 · api 492 · pdf 120 · shared 823 · web 235`** — `api` steg +6 (paritetstesten kjørte). Kald web-bygg grønn.

**i18n-gjeld:**
- 🟢 **LUKKET** — 134 nøkler (ikke 132; mal-Opus talte selv, coworks tall var foreldet). Alle femten filer har nå identisk nøkkelsett (4500). Null relikvier begge veier.
- 🔴 **OPPHAVET MÅLT:** 131 av 134 stammer fra ÉN runde — `bbc6cb36` «i18n-runde 1 — delte komponenter», der generatoren aldri ble kjørt. 2 fra `ac7afb33` (vei C del 1 TILLEGG 1), 3 fra `ed21b640`. ⚠️ Hullet gjentar seg hver runde som legger `nb`/`en`-nøkler uten å kjøre 13-språk-generatoren.
- 🟡 **FORESLÅTT, IKKE BYGGET:** `packages/shared/src/i18n/nokkelsett.test.ts` — les alle femten, krev samme nøkkelsett som `nb`. Fanger både glemt generator og relikvier. Vanlig vitest-test. **Bestilles som egen liten runde ETTER denne mergen** (ville feilet på gjelden).

**Vei C del 2:**
- 🟢 **LEVERT — MalBygger redigerer nå SiteDoc-maler.** `MalNivaa = prosjekt | firma | sitedoc`. Seks nye prosedyrer på `bibliotek.ts` (`hent`, `oppdater`, `leggTilObjekt`, `oppdaterObjekt`, `oppdaterRekkefolge`, `slettObjekt`), alle gatet av `verifiserSiteDocAdmin`.
- 🟢 **TS2589-fella omgått:** `velgMutasjon(nivaa, {prosjekt, firma, sitedoc})` med `Record<MalNivaa, unknown>` — hver gren møter `unknown` på funksjonsgrensen. Kald bygg grønn (verifisert her).
- 🟢 **Paritet BEVIST:** `bibliotek-objekt-crud-paritet.test.ts` kjører samme input gjennom begge routere og sammenligner (fem operasjoner + gate-test).
- 🟢 **`admin/bibliotek` er ikke lenger låst** — låsebanner og `LAAST_REDIGERING` fjernet, nivåbanneret tilbake. Venstre trestruktur beholdt som navigasjon, MalBygger til høyre.
- 🔴 **AVVIK MELDT, KENNETH GATER:** `BibliotekMal` mangler fastefelt-kolonnene (`subjects`, `showSubject`, `showLocation`, `showPriority`) som firma/prosjekt har. Fastefelt-seksjonen skjules på sitedoc-nivå; feltredigering er full paritet, kun malnavn er redigerbar metadata. ⚠️ Reelt avvik fra «alle tre nivåer like» — krever skjemaendring.
- ⚠️ **`hentMalRedigering` og `oppdaterMal` er nå arveløse.** MELDT ubrukte, IKKE slettet — slettes ved rivingen.
- 🔴 **NESTE:** Kenneths visuelle gate på `/dashbord/admin/bibliotek` → riving av flaten → Innstillinger › Malforvaltning. Parallelt: strengharmonisering (nå ulåst).
- ⚠️ **Parkert av Kenneth 15.09:** forhåndsvisning av felt ved klikk i «Hent fra arkiv»-modalen — «la dette vente. bygg ferdig så ser vi etterpå hva som mangler».
- ⚠️ **Uendret åpent:** rettighetsmatrisen vs. ulåst SiteDoc-fane · N dager auto-tømming · fargeføringen · funn #21 · `BibliotekMal` mangler `updatedAt`.

---

## 🟢 2026-09-15 — `admin/bibliotek` ekte lese-only (TILLEGG 2) merget (`8c84cc77`). Utløser web-deploy.

**Merget `fix/admin-bibliotek-laast-visning` (ren fast-forward `e204f00f..8c84cc77`).** Én fil, +29/−10:
`apps/web/src/app/dashbord/admin/bibliotek/page.tsx`. Ingen i18n-, skjema- eller API-endring. Gate fra ROT grønn:
`db 2 · api 486 · pdf 120 · shared 823 · web 235` — alle stille.

- 🟢 **VEI C DEL 1 VERIFISERT PÅ TEST 15.09** — begge lånevegene virker mot rad-veien: prosjekt
  (`oppsett/produksjon/sjekklistemaler` → «Hent fra arkiv» → SiteDoc-arkiv) og firma (`firma/malarkiv` → «Lån fra SiteDoc-arkivet»). Kenneth bekreftet.
- 🟢 **`admin/bibliotek` er nå EKTE lese-only** — høyre panel (`FeltKonfigurasjon` + type/fase-nedtrekk) skjules når flaten er låst.
  Venstre + midten står: tre, malnavn, referanse, beskrivelse, feltliste gruppert per fase med felttype-merke.
- 🟢 **Kun låsebanneret vises.** Nivåbanneret skjules på låst flate (vei a) — `nivaabanner.sitedoc.scope` er URØRT, MalBygger trenger den i del 2.
- 🔴 **Kenneth-vedtak 15.09: ingen `laast`-prop i `FeltKonfigurasjon`** — delt komponent + flate som rives i del 2 = feil sted å bygge gjeld. Derfor skjules panelet.
- ⚠️ **MELDT av redesign, Kenneth-gatet:** feltlisten viser etikett og type, men ikke per-felt hjelpetekst, påkrevd-flagg eller valgalternativer
  (de lå kun i høyre panel). Akseptert fram til del 2.
- 🔴 **NESTE i køen:** i18n-gjelden (mal-Opus — tallet telles på nytt, 132 ble 134 etter TILLEGG 1) → strengharmonisering → vei C del 2.
- ⚠️ **Uendret åpent:** rettighetsmatrisen vs. ulåst SiteDoc-fane · N dager auto-tømming · fargeføringen · funn #21 · `BibliotekMal` mangler `updatedAt`.

---

## 🔴 2026-09-15 — Vei C del 1 MERGET til develop (`ac7afb33`). BÆRER MIGRERING — deploy BUILD→MIGRATE→UP.

**Merget `feat/bibliotekmal-objekttabell` (ren fast-forward `fe13e5d8..ac7afb33`).** To commits: `a6bee514` (tabell + migrering, Design B)
+ `ac7afb33` (forhåndsvisning til rader + lås `admin/bibliotek`, TILLEGG 1). 21 filer, +1172/−364. Gate fra ROT grønn
(`pnpm install` + `prisma generate` ×4): **`db 2 · api 486 · pdf 120 · shared 823 · web 235`** — alle forventede tall.
i18n traff KUN `nb`/`en` (2 nøkler hver); de tretten urørt. **Jeg kjørte IKKE migreringen — Kenneth kjører den i deploy.**

- 🔴 **Migreringsmappe (slik den står i develop):** `packages/db/prisma/migrations/20260914120000_bibliotekmal_objekttabell/`
  (`migration.sql` + `DRY-RUN.sql`, sistnevnte read-only).
- 🟢 **Dry-run mot `sitedoc_test` grønn (Kenneths kjøring, coworks referat):** 12 maler · 96 felt · 132 rader · null avvik
  på alle fire negativkontroller (felt_uten_fase 0 · ukjente_nøkler tom · heading_i_json 0 · ikke-array 0).
  ⚠️ Redesign målte lokalt 95 felt / 131 rader — differansen er ETT felt på KC3.1 alene (9 i test, 8 lokalt), forventet/forklart.
- 🟢 **`BibliotekMalObjekt` speiler `OrganizationTemplateObject` felt for felt.** Design B: heading-rader materialisert, én per distinkt fase.
- 🔴 **`malInnhold` er FROSSET** — leses ikke lenger av lån, import, forhåndsvisning eller seed. **Kolonnen SLETTES IKKE — egen senere runde.**
- 🔴 **`admin/bibliotek` er LÅST TIL LESING** — flaten auto-persisterte hver endring; choke-punktet nøytralisert, kontrollene deaktivert,
  banner forklarer hvor redigeringen flyttet. `bibliotek.oppdaterMal` + `verifiserSiteDocAdmin` er URØRT på serveren. Del 2 bygger den ekte veien.
- 🟢 **`hentMalInnhold` (forhåndsvisning før lån) leser nå radene** — fase rekonstrueres fra heading-radene. Cowork fant den som krav 4-brudd før merge; redesign lukket den.
- ⚠️ **MELDT, ikke løst:** felt uten fase arver nærmeste foregående headings fase i forhåndsvisningen. Null slike felt i test/lokal/seed, og lånet gjør det samme → konsistente.
- ⚠️ **i18n-gjeld:** de tretten stiger fra 132 til **134** manglende nøkler. Mal-Opus' rydderunde skal telle selv, ikke bruke 132.
- 🔴 **NESTE: vei C del 2** — ruting av MalBygger til sitedoc-nivå, `MalNivaa = "sitedoc"`, oppdateringsvei for eksisterende SiteDoc-maler. **Så riving av `admin/bibliotek`.**
- ⚠️ **Uendret åpent:** rettighetsmatrisen vs. ulåst SiteDoc-fane · N dager auto-tømming · fargeføringen · funn #21 · `BibliotekMal` mangler `updatedAt`.

---

## 🟡 2026-09-14 — Fabels avviksgodkjenning B (heading-rader) + KC3.1 lagt bort. Ingen kode, ingen deploy.

**Committet** (`docs/redesign/avviksgodkjenning-b-heading-rader-fabel-2026-09-14.md`), uendret, fra fabel-pakke
`til-repo-2026-09-14-0940`. Verifisert: kun den ene fila, ingen `.DS_Store`, fantes ikke fra før.

- 🟢 **VEDTAK: Design B** — heading-rader materialiseres, **rad per felt + én heading-rad per distinkt fase.** A avvist
  (`config.fase` viderefører spesialtilfellet C skulle fjerne, bryter Kenneths krav om like egenskaper på alle tre nivåer).
- 🟢 **Krav 2a revidert (erstatter vei C § krav 1):** dry-run per mal viser TRE tall — felt i JSON · distinkte faser ·
  rader etter migrering — og **radantall == felt + faser** (KC3.1: 8+3=11). Negativ kontroll: heading-rader har ingen config/hjelpetekst.
  Idempotens (×2 = samme) uendret. **Fabel: «Krav 2a var formulert mot en antakelse redesigns måling motbeviste — da er det
  kravet som skal justeres, ikke speilingen.»** Overskriftene genereres ved lån (`firmamal.ts:161-176`), ikke fra JSON-felt.
- 🔴 **Konsekvens for lånevegen (krav 2 skjerpet):** round-trip-testen skal nå OGSÅ bevise at rad-veiens genererte
  overskrifter == malInnhold-veiens. Heading-radene **erstatter** genereringen i `firmamal.ts:161-176`, ikke dobles — genereringen fjernes i C del 2.
- 🟢 **KC3.1 LAGT BORT (Kenneth 14.09):** «KC3.1 er ikke helt ferdig → den er IKKE viktig → bruk versjonen som er der i dag.»
  `feat/mal-kc31-revisjon` **merges ikke, står åpen og urørt.** Migreringen tar databasens nåværende innhold. **Ingen blokkering av C del 1.**
- 🔴 **MÅLT 14.09 — seeden er IKKE fasit for databasen:** KC3.1 har `antall_felt = 9` i `sitedoc_test`, mens develop-seeden gir 4
  og `feat/mal-kc31-revisjon` gir 8. Seeden legger ikke til heading-objekter (`seed-bibliotek.ts:129-146`). Noe har skrevet til
  `mal_innhold` utenom seeden — sannsynligvis `oppdaterMal`. **Migrerings-dry-run må måle mot faktisk DB, ikke seed.**
- ⚠️ **Nytt målt, ikke bestilt:** `BibliotekMal` har `opprettet`, men **INGEN `updatedAt`** (`schema.prisma`). SiteDoc-nivået har
  ingen endringshistorikk. Henger sammen med funn #8.

---

## 🟡 2026-09-14 — Fabels KS av vei C committet (objekt-tabell på BibliotekMal). Ingen kode, ingen deploy.

**Mottatt og committet** (`docs/redesign/ks-sitedoc-niva-vei-c-fabel-2026-09-14.md`), uendret, fra fabel-pakke
`til-repo-2026-09-14-0230`. Verifisert: kun den ene fila, ingen `.DS_Store`, fantes ikke fra før.

- 🟢 **VEDTAK: vei C valgt** — `BibliotekMal` får objekt-tabell som speiler `OrganizationTemplateObject`.
  **A og B forkastet:** A etterlater et evig spesialtilfelle; B gjør «én editor» til en løgn i koden.
- 🟢 **redesigns stopp godkjent av fabel** — «stoppet på premiss FØR koding, null commits, avvik meldt … Dette er standarden».
- 🔴 **RETTELSE (coworks feil, MÅLT AV MEG):** ordren pekte på `autoriserMalTilgang`; gaten heter faktisk
  **`verifiserSiteDocAdmin`** — definert `apps/api/src/routes/bibliotek.ts:13`, kalt `:280` og `:323`. Ingen
  `autoriserMalTilgang` i fila. Samme jobb, feil navn i ordren. **Ordre-malen skal peke på FAKTISK funksjonsnavn, målt — ikke antatt.**
- 🟢 **REKKEFØLGE-konflikten jeg flagget her er BORTFALT (Kenneth 14.09):** KC3.1 er lagt bort — se runde-toppen. Migreringen tar databasens nåværende innhold; ingen KC3.1-avhengighet igjen. *(Historikk: jeg flagget at relay-ordren la KC3.1 før C del 1 mens fabels krav 4 la C del 1 først — spørsmålet er nå moot.)*
- 🔴 **`malInnhold`-kolonnen FRYSES etter migrering** (leses ikke), slettes i egen senere runde etter verifisert testperiode — **aldri samtidig med migreringen.**
- 🟢 **redesign bygger C del 1** på `feat/bibliotekmal-objekttabell`.
- ⚠️ **Uendret åpent:** rettighetsmatrisen vs. ulåst SiteDoc-fane · N dager auto-tømming · fargeføringen · funn #21 (↻ og MalBygger muterer under eksisterende dokumenter).

---

## 🟡 2026-09-14 — Fabels Malstruktur IA v2 committet (kontekststyrt malside). Ingen kode, ingen deploy.

**Mottatt og committet** (`docs/redesign/malstruktur-ia-v2-notat-fabel-2026-09-14.md` + `-mockup-…dc.html`),
uendret, fra fabel-pakke `til-repo-2026-09-14-0210` (erstattet `0145`). Verifisert: kun de to filene, ingen `.DS_Store`, ingen fantes fra før.

🔴 **v2 ERSTATTER fane-modellen fra 13.09** (Malforvaltning med tre faner) **der de kolliderer.** Bygg videre på v2, ikke fane-modellen.

**Består UENDRET fra 13.09 (fabels egne ord):**
- hente ≠ forvalte
- «Hent fra arkiv»-modalen (gruppering per standard, søk, ulåst SiteDoc-fane)
- nivåbanner og nivåfarger
- papirkurv-vedtakene (tellefelle-vakt, globalt søk-merke, 90 d)
- «rediger»-regelen · «Tilbake til …»-regelen · `terminologi.md § 0`

**Grunnmodellen (ordrett fra notatet):**
- **Inngang:** Innstillinger › Produksjon › Oppgavemaler / Sjekklistemaler / HMS-maler (dagens venstremeny-navn). Tre maltyper, identiske egenskaper.
- **Nivå:** kontekstvelgeren øverst til venstre (PROSJEKT / FIRMA / SITEDOC ADMIN). **Samme side, ulikt innhold. Ingen egne sider per nivå.**
- **Utledninger:** malnavn/Rediger → MalBygger i samme kontekst; «Hent fra arkiv» → modal (prosjekt: firma+SiteDoc · firma: kun SiteDoc · SiteDoc-nivå: ingen — kilden henter ikke).
- 🔴 **SiteDoc-nivået på samme side ERSTATTER `admin/bibliotek` HELT.**
- **Kontekstvakt i MalBygger (Kenneth 14.09):** malen tilhører nivået den ble åpnet/startet i (`openLvl`). Kontekstbytte inne i MalBygger er lov, men Publiser etter bytte krever eksplisitt bekreftelse med navngitt rekkevidde. Uten bytte publiserer knappen uten dialog.

### 🔴 ÅPEN RIVNINGSLISTE (fabel — ordre følger etter Kenneths gate, IKKE bygget)
1. «Malarkiv» i FIRMA-menyen
2. «Bibliotek» i admin-menyen + `admin/bibliotek`-editoren
3. Alle «rediger arkivet»-lenker som peker på lister
4. Eneste innganger blir: de tre maltype-sidene + kontekstvelgeren

### 🔴 Rettelse ført skriftlig (Kenneth 14.09)
Cowork delte fabels 13.09-tegning i biter og merket punkt D («ÉN editor — SiteDoc-maler i samme MalBygger, `admin/bibliotek` utgår») som «retning, ikke bestilt» — derfor peker modalens bunntekst på en LISTE, ikke en malbygger. **Kenneth:** *«du klarer ikke å formidle fabels ordre til agentene … du endrer ordren til noe annet fordi du mener fabels ordre ikke fungerer.»* **Regelen som følger: cowork relayer fabels ordre HEL. Måling mot kode er coworks jobb; omskriving av omfanget er det ikke.**

### ⚠️ Fabels «Ikke tegnet» (v2)
Papirkurvens plassering i v2 (forslag «Vis papirkurv» på malsiden, samme komponent som 13.09 — Kenneth gater) · `MalRevisjon`/Historikk (eget skjemavedtak) · oppgave-/HMS-malsidenes konkrete kolonner (identisk mønster, tegnes ikke separat) · mobilvisning.

🟢 **Neste steg er FABELS:** etter Kenneths gate skriver fabel rivnings- og byggeordre i rekkefølge (1: slett innganger · 2: kontekststyrt malside · 3: MalBygger-ruting). **Cowork skal IKKE skrive byggordrer på dette.**

---

## 🟢 2026-09-13 — Runde 98 merget: arkivmodal-søk/kollaps + nivåbanner. Utløser web-deploy (samles).

**Merget til develop** (`--no-ff`, i rekkefølge dokgen→redesign, ingen kodeoverlapp — kun 15 i18n-JSON delt, `comm -12` bekreftet):
- `feat/nivaabanner` (`0d9b0fc8`, dokgen) — nivåbanner + `TilbakeLenke`-primitiv utpakket (BACKLOG #20).
- `feat/arkivmodal-sok-kollaps` (`6b75accd`, redesign) — søk over fanene + kollaps + samme gruppemodell begge faner (BACKLOG #19).

**Gate grønn på develop-tippen:** `db 2 · api 478 · pdf 120 · shared 814` stille · `web 228→235` (+7, alle i `arkiv-sok-kollaps.test.ts`).
Utfoldings-testen (søk i sammenslått gruppe → foldes ut) og typefilter-testen (oppgavemal filtrert bort FØR søk → 0 treff) begge til stede. Kald web-bygg grønn (`prisma generate` ×4, `.next` slettet). Én tilbake-lenke per flate; papirkurv bruker delt `TilbakeLenke`.

- **redesign → LEDIG · dokgen → LEDIG.**
- 🔴 **VEDTAK, IKKE bygget ennå — fargeføring (egen runde etter Kenneth ser dem på test):** firma-blå **snapper** til `sitedoc-primary #1e40af` (to nesten-like blå = drift) · SiteDoc-fiolett → nytt token **`arkiv-sitedoc`** · prosjekt-grønn → nytt token **`arkiv-prosjekt`**, **snapper IKKE** til `sitedoc-success #10b981` (for lys under hvit tekst; suksess-semantikk feil for et nivåmerke). Fabels mørke hex (`#5843a8`/`#2451b3`/`#3f6f1f`) beholdt som utgangspunkt i mergen — ingen farge endret her.
- 🔴 **VEDTAK: «Prosjektarkiv» gis via banneret**, ikke som tvungen overskrift. Eventuell eksplisitt overskrift vurderes i harmoniseringsrunden — hvis i det hele tatt.
- 🔴 **NY ÅPEN GJELD (MÅLT): i18n-drift.** `nb`/`en` = 4498 nøkler, de 13 andre = 4366 — **nøyaktig 132 mangler, identisk i alle.** **Kenneth-vedtak: ryddes som EGEN RUNDE FØR strengharmoniseringen** («ellers harmoniserer vi oppå drift»).
- 🟡 **SISTE GATE-VALG til fabel: N dager auto-tømming av papirkurv.** Målt N=**90** i dag (`services/papirkurv-sweep.ts` + UI). Spørsmålet er om Kenneth vil endre den.

---

## 🟡 2026-09-13 — Fabels samlede IA-tegning for Malforvaltning committet. Ingen kode, ingen deploy.

**Mottatt og committet, deretter ERSTATTET med pakke `til-repo-2026-09-13-2245`** (samme to filnavn i
`docs/redesign/`, uendret innhold ellers). Diff `2210`→`2245` = kun to blokker: låsespørsmålet (notat linje 34–39
+ mockup-banneret) og «Neste steg» — begge fordi Kenneth gatet låsen direkte med fabel 13.09 kveld. Verifisert:
ingen nye filnavn, ingen `.DS_Store`.

### 🔴 NY ÅPEN TRÅD — direktehentet prosjektmal har ingen ↻-vei

- **Konsekvens av ulåsingen (MÅLT av cowork, `packages/db` `schema.prisma` → `ReportTemplate`):** en direktehentet
  mal blir en **prosjektmal** og følger IKKE firmaets ↻-forvaltning. `ReportTemplate` har kun `organizationTemplateId`
  — peker den ikke på en firmamal, finnes ingen ↻ og ingen «versjoner bak».
- 🔴 **Krever et nytt avstamningsfelt mot `BibliotekMal` — skjemaendring Kenneth gater.** Fabel førte den som «senere
  vurdering»; her løftet til åpen tråd så ingen oppdager frosset-for-alltid-malen i prod.

### Øvrige punkter
- 🟢 **Fabel trakk rekkefølgekravet på #8** — coworks innvending tatt (hullet fantes fra før; #1/#2 innførte ikke oppdateringsveien).
- 🟢 **Kenneth overstyrte coworks E-forslag:** begge faner i «Hent fra arkiv» bruker nå SAMME modell — gruppert på
  standard/kapittel, «Egenlagde» egen gruppe, sammenslått ved start, søket folder ut treff. Coworks åpne-Firmaarkiv-fane forkastet.
- 🟡 **SISTE GATE-VALG: N dager før papirkurv auto-tømmes.** Dagens verdi målt N=**90** (`services/papirkurv-sweep.ts`,
  UI-tekst «90 dager»). Spørsmålet er om Kenneth vil **endre** den — ikke sette den (den finnes allerede).
- ⚠️ **Ubesvart (Kenneth):** skal papirkurv-søket treffe INNHOLD, ikke bare navn/metadata?
- ⚠️ **Fabel melder 90 % kvotebruk og stopper her.** Neste steg på hans side er ordrer til redesign — kommer etter gate.
- 🟢 **A og B er ute til bygging** (`feat/arkivmodal-sok-kollaps`, `feat/nivaabanner`). Upåvirket av `2245` (punkt B og E uendret).
- 🔴 **Fabels «Ikke tegnet» (grensene, så ingen gjetter):** `MalRevisjon`-fanens innhold · diff/merge for ↻ ·
  SiteDoc-admins editor-kapasitet · `hentStandarder`-innstramming · HMS-lenken i slett-sperren · mobilvisning av
  Malforvaltning · strengharmoniseringen.
- ⚠️ **Strengharmoniseringen er coworks jobb og utløses nå** — flatene navngitt av fabel: Malforvaltning med tre faner ·
  MalBygger-banner · Hent fra arkiv · globalt søk-merke.

---

## 🟡 2026-09-13 — Docs: ett navn per arkivnivå (Kenneth-vedtak). Ingen kode, ingen deploy.

**Vedtak ført i `terminologi.md § 0`** (rett under rettighetsmatrisen fra `a3e73a09`): hvert arkivnivå
skal hete **én** ting på flatene brukeren ser — **SiteDoc-arkiv** (`BibliotekMal`) · **Firmaarkiv**
(`OrganizationTemplate`) · **Prosjektarkiv** (`ReportTemplate`). «Bibliotek»/«Sentralarkiv»/«Malarkiv» utgår
som synlige begreper. 🔴 **Presisert at vedtaket IKKE er en datamodell-/rute-refaktorering** — tabellnavn,
ruter og kodeidentifikatorer (`BibliotekMal`, `/admin/bibliotek`, `bibliotek.ts`, `firma-nav.tsx`) røres ikke.
**Målt selv 13.09 (`nb.json`):** SiteDoc **6** navn · Firma **2** · Prosjekt **0** (nivået hadde aldri fått
et navn — sannsynlig grunn til gjentatt feilrekonstruksjon av tre-nivå-modellen). Selve streng-harmoniseringen
er egen oppgave under fabels IA-sak.

🟢 **Navnevedtaket er nå komplett (kveld 13.09):** arkiv + entall (SiteDoc-mal · Firmamal · Prosjektmal), begge i `terminologi.md § 0`. Strengharmonisering i `nb.json` gjenstår og eies av fabels IA-sak.

**Tre nye funn ført i BACKLOG (#18–#20, alle eier fabel):** #18 `admin/bibliotek` lover malbygger men kan
kun `oppdaterMal` · #19 «Hent fra arkiv»-modalen mangler kollaps + søk (gamle lånedialog hadde søk) · #20 ingen
flate viser hvilket arkivnivå du står i.

**Tavle:**
- 🟢 **Runde 97 verifisert av Kenneth på test:** avslutt-flaten, «Oppdatert»-merket og retur-lenken virker.
  ⚠️ **Ferskhetsgaten IKKE bekreftet utløst ennå** — Kenneth må prøve å avslutte med arkiv eldre enn siste endring.
- ⚠️ **«Tilbake til …» er et GENERELT behov** (Kenneth), ikke bare i papirkurven. Primitiven finnes i
  `papirkurv/page.tsx` fra runde 97 (sti-validert, whitelistet etikett). Går til fabel som del av IA-saken —
  ikke bestill flate for flate.

---

## 🟡 2026-09-13 — Runde 97: arkivgaten måler ferskhet + tre veier ut. Web-deploy samles.

**To merger, dokgen først (flere nøkler) så redesign på toppen:**
- `62381fc4` (dokgen `04341d18`) — avslutt-gaten måler arkivets **ferskhet + utløp** (løsning B, Kenneth-vedtak).
- `b5b4a490` (redesign `515f0fc0`) — tre veier ut: à jour-tilstand, papirkurv-retur, sperre-lenker.

**Gaten verifisert i koden (ordrens punkt 3):** bruker nyeste `updatedAt` på tvers av **`Checklist` OG `Task`**
(via `template.projectId`, `deletedAt: null`), **IKKE `Activity`** — dokument-mutasjonene skriver ingen `Activity`-rad,
så en `Activity`-gate ville gått grønt på utfylte felter etter eksport. Tre distinkte feilveier
(`arkivMangler`/`arkivUtlopt`/`arkivForGammelt`), `utloperVed = null` = utløper aldri (består), `sitedoc_admin`-nødutgang uendret.
**i18n-mergen gikk rent** — begge nøkkelsett (dokgen +4, redesign +5 pr. språk) verifisert intakt i nb.json, all JSON parser.
`api` 473→478 (+5, alle i `prosjekt-livssyklus-gate.test.ts`); `db` 2 · `pdf` 120 · `shared` 814 · `web` 228 stille;
kald web-bygg grønn. develop `b5b4a490`. 🔴 **Ingen migrering/OTA denne runden — men runde 95-migreringen venter fortsatt.**

**Funn/beslutninger ført:**
- 🔴 **RETTELSE:** `Activity` skrives IKKE av `sjekkliste.ts`/`oppgave.ts`/`hms.ts` — ingen framtidig gate skal bruke den som «noe skjedde»-signal for dokumenter.
- 🟡 **VURDERT OG AVVIST:** mal-filter i papirkurven — kolliderer med «Tøm papirkurv»-tellingen (tømmer alt, ikke det filtrerte). Ikke en åpen oppgave.
- 🔴 **NYTT FUNN:** HMS-lenken i slett-sperren lander på `/hms` **ufiltrert** — HMS-lista har lokalt søk, ikke URL-drevet.

---

## 🟡 2026-09-13 — Runde 96: synliggjøring + i18n-relikvie merget. Web-deploy samles.

**To merger, dokgen først (eldre base) så redesign på toppen:**
- `d363ef25` (dokgen `b08035ad`) — slettet foreldreløs `arkiv.lokalFallback` × 15 språk (0 kode-kallere).
- `da23361f` (redesign `c03c2d1a`) — synliggjøring (#1/#2/#3/#17): `versjonerBak`/↻ i mallista,
  sperrelenker, avslutt-bekreftelse, `OppdaterFraHovedmalModal` på BEGGE prosjekt-↻.

**i18n-mergen gikk rent** — verifisert at dokgens fjerning forble borte OG redesigns nøkler kom med, ingen tapt.
`api` 468→473 (+5, alle i `prosjekt-livssyklus-gate.test.ts`); `db` 2 · `pdf` 120 · `shared` 814 · `web` 228 stille;
kald web-bygg grønn. develop `<hash under>`. 🔴 **Ingen migrering/OTA denne runden — men runde 95-migreringen venter fortsatt.**
Fire nye funn ført under (iKontrollplan-sperre, papirkurv mal-filter, ↻ diff-vs-erstatning, «Avslutt prosjekt»-stale-kommentar-rettelse).

---

## 🔴 2026-09-13 — Runde 95: unik indeks mot dobbelt-lån merget. UTLØSER DEPLOY MED MIGRERING.

**Merget til develop:** `ebda4946` (`Merge: unik indeks mot dobbelt-lån … fe3e2ed6`). `--no-ff`,
verifisert mot mal-Opus' hash. `@@unique([organizationId, laantFraBibliotekMalId])` + bevart
`@@index([laantFraBibliotekMalId])` (revers-oppslag/`SetNull`). Migrering `20260913140000_firmaarkiv_unik_indeks`
= ren `CREATE UNIQUE INDEX`. **Alle fem testtall stille** (db 2 · api 468 · pdf 120 · shared 814 · web 228),
kald web-bygg grønn. 🔴 **Kenneth kjører deploy BUILD → MIGRATE → UP.** 🔴 **Prod har egen DB — kjør
dry-run + rydding mot `-d sitedoc` FØR migreringen (se tavla).** Duplikater ryddet på test 13.09.

---

## 🟡 2026-09-13 — Malforvaltnings-funnene samlet i BACKLOG

Kenneth brukte malforvaltnings-flaten i to døgn og meldte funn løpende. De 17 funnene er nå
ført som én seksjon i [BACKLOG § Malforvaltning — 17 målte funn](BACKLOG.md) med funn ·
kode-ref · grad · eier — i stedet for spredt prosa-svar (SAMARBEIDSREGLER `:56-76`). #1/#2/#3/#17
bestilt hos redesign (`fix/synliggjor-malforvaltning`), #16 hos dokgen (`fix/fjern-doed-utkastknapp`);
#5/#6/#7/#9 samlet IA-sak hos fabel; #8/#10 venter på Kenneths skjema-/data-gate; #4 AVKREFTET.

---

## 🟢 PROD DEPLOYET 2026-09-11 — `af0093b8`. 44 merger ute. Frysen er over.

**Prod sto på `1a74904b` fra 8. september. Nå: `af0093b8`.**
**Verifisert innlogget: prosjektlista laster, Kontakter-flaten med to faner og nye filtre er ute.**

🔴 **~30 minutters nedetid underveis. Rotårsak og berging: [DEPLOY-RUNBOK § 5b](DEPLOY-RUNBOK.md).**
**Kort: `deploy-prod.sh` skriver ut fire kommandoer men kjører dem ikke — `build sitedoc-web` ble
hoppet over. Prod kjørte ny api + ny database mot to døgn gammel web, hvis Prisma-klient fortsatt
kjente den droppede kolonnen. Symptomet var `error=Configuration` på begge OAuth-providere.**

🟢 **RYDDET samme natt.** `users.ny_navigasjon` ble lagt tilbake for å berge oppetid, og er nå
borte igjen: web bygget med `--no-cache` (linje 7 kjørte i 10,9 s, ikke `CACHED`) → startet →
kolonnen droppet → **innlogging verifisert i nettleser.** **Prod har ingen lapp igjen.**
**Rekkefølgen som må følges neste gang står i [DEPLOY-RUNBOK § 5b](DEPLOY-RUNBOK.md).**

🟡 **ARKIVERINGSPLIKT IKKE UTFØRT.** CLAUDE.md krever at deployet arbeid flyttes til
`historikk-2026-09.md` i samme commit. **44 rundenes historikk er ikke flyttet** — utsatt bevisst
kl. 01:30, ikke glemt. **Neste cowork tar den.**

---

### Gate-status på det som lå på test før prod-deployen

| Sak | Status |
|---|---|
| Kollisjons-deteksjon med tilføyelse | 🟢 Gatet 08.09 · ⚠️ **repeater-variant rettet 09.09** (`d4df351e`) |
| Faggruppe-medlemskap redigerbart | 🟢 Gatet |
| `medlem.registrer` (én registreringsvei) | 🟢 **Fase 2 merget 09.09** — Kontakter i tre nivåer |
| Dialog/kommentar offline | 🟢 **RETTET 09.09** (`62446dce`) — vakt + beskjed, teksten står |
| Tekstfelt nullstilles under skriving | 🟢 **RETTET 09.09** (`f1dea4db`) — delt `kollisjonReset.ts`, re-dirty felt bevares |

## 📅 2026-09-10 KVELD — rundene 65–72. Rettighetsmodellen gjennomgått, syv stille tomheter funnet

**Develop `74d641f5` · test verifisert løpende · prod urørt.**
**Utløst av Kenneths egen testing på test.sitedoc.no gjennom dagen.**

| Runde | Innhold | Hash |
|---|---|---|
| 67 | `DROP COLUMN ny_navigasjon` — flagget overlevde sin egen utrulling | `a98a19cb` |
| 68 | `ProjectGroup.systemNokkel` — HMS-gruppa var ikke entydig | `0e17ce1a` |
| 69 | «Velg andre» ut av HMS-flyten · personkortets HMS-filter · prosjektadmin-kort | `29a49606` |
| 70 | `prosjekt_oppretter`-rollen · to persondata-gjerder | `783abca1` |
| 71 | Gruppeansvarlig (`isAdmin` fra mars) · «egen avdeling» deaktivert | `13fcc4cf` |
| 72 | «Leser» én kilde · HMS-arv fjernet · firmatilknytning + to sikkerhetsfikser | `74d641f5` |

### 🔴 To reelle sikkerhetshull lukket

**1. Rettighetseskalering i `medlem.registrer`** (`d11958ef`): admin-grenen validerte ikke
`organizationId` i det hele tatt. **En prosjektadmin kunne gi en ansatt i firma B et medlemskap i
firma C — også et ekte kundefirma.** Målt og bekreftet av redesign. `!erAdmin`-grenens sjekk
hadde ingen motpart i admin-grenen.

**2. `organisasjon.opprett` uten tilgangssjekk**: enhver innlogget bruker kunne opprette et firma
med fritt navn. 🟢 **Null kallere i web/mobil, og prod hadde null skall-firmaer i bruk** — så
gaten brøt ingenting. ⚠️ **Konsekvens: ingen UI-vei til å opprette skall-firma. Kenneth oppretter
dem selv ved behov; en gatet prosjektrute er egen sak etter pilot.**

### 🔴 MØNSTERET som ble funnet — syv «stille tomheter» på én dag

**Utløste husregelen «Stille tomhet er forbudt» (CLAUDE.md § Viktige regler, 2026-09-10).**

| # | Hva | Tilstand da den ble funnet |
|---|---|---|
| 1 | `users.ny_navigasjon` | Flagg overlevde utrullingen. 10 identiske verdier, null lesere |
| 2 | `group_faggrupper` | Skrivevei fjernet `e14f2aa0` 23.03. **Tom i 22/22 prosjekter i et halvt år** |
| 3 | HMS-gruppe-deteksjon | To grupper bar `domains:["hms"]`, `find()` plukket vilkårlig |
| 4 | `ProjectGroupMember.isAdmin` | Bygget 23. mars, **aldri lest av én linje**. Løst i runde 71 |
| 5 | `DokumentflytMedlem.kanRedigere` | Settes i UI, leses kun av klienten. **Serverhåndheving ført som 🔴 MÅ GJØRES etter pilot** |
| 6 | `hr_ansvarlig` | Settbar i firma-UI, **null håndheving**. Kravlista finnes, ikke gatet |
| 7 | «Prosjekter i egen avdeling» | Valgbar og lagret, gjorde ingenting (`Project` mangler `avdelingId`). Deaktivert i runde 71 |

🔴 **Fellesnevneren var ikke at feltene var tomme — det var at tomheten var STILLE.** Alle sju ble
funnet ved at Kenneth så noe rart på skjermen, ikke av systemet. **Derfor krever regelen nå (c):
en test som FEILER når feltet er tomt.**

### Vedtak tatt 2026-09-10

| Vedtak | Kenneths ord |
|---|---|
| Firmaadmin arver **ikke** HMS-admin | *«nei -> firmaadmin setter seg selv som HMS»* |
| Mathias Jensen mister firma-HMS | *«han er ikke medlem i flyt i dag i noen av prosjektene»* |
| `kanRedigere` gjelder **gruppen**, ikke person | *«jeg er enig at den skal gjelde gruppen»* |
| «Gruppeansvarlig» er rett nivå — bruk `isAdmin` | *«da bruker vi det vi har -> det var allerede laget»* |
| Feilregistrering ≠ firmabytte | To hendelser, ulik historikk-behandling |
| Rettigheter vises der de finnes, redigeres der de hører hjemme | Utledet av «Velg andre»-vedtaket, anvendt fire steder |
| `opprettTestprosjekt` parkert | *«aktiviseres og utbedres senere når jeg har bedre oversikt»* |

### ⚠️ Fire flater som løy — «knappen skal ikke lyve»

**Knapper synlige for folk serveren avviser.** Funnet fire ganger samme dag:
`BrukergruppeFane.tsx:159` (løst) · `oppsett/brukere/page.tsx:279-294` (løst) ·
gruppekortets navn-rediger/slett (løst) · **domener/moduler-editoren i gruppepanelet — meldt av
redesign, ikke fikset, egen sak.**

### Åpne saker etter dagen

🔴 **`hr_ansvarlig`** — kravlista er Kenneths (attestering · legge til · deaktivere ansatte).
**Ikke gatet. Coworks anbefaling: etter pilot.**
🔴 **`kanRedigere` serverhåndheving** — BACKLOG som MÅ GJØRES, med full måling.
🟡 **ⓘ-forklaring på kortene** — Kenneth savnet den på HMS-kortet tre ganger. Omfang ikke gatet.
🟡 **Duplikat-forebygging på firmanavn** — prod hadde to tomme «Sitedoc»-skall-firmaer (slettet
av Kenneth 10.09). **To tilfeller på et halvt år; egen sak etter pilot.**
🟡 **`byttEier`** (`oppgave.ts:2088`, `sjekkliste.ts:1924`) har ingen dokumenttilgangssjekk.

## 📅 2026-09-09/10 — TI MERGER. Kritisk vei til prod er gjennomført

🟢 **Kontakter fase 2 er merget OG verifisert av Kenneth på test.** *«Veldig bra design.»*
🔴 **Prod er fortsatt frosset** — fabels designgodkjenning gjenstår, og Kenneth fant fire nye
funn på test etter verifiseringen.

**Merget denne runden** (develop `a169afbc` → `15ef9602` under merge):

| Sak | Hash | Utløst av |
|---|---|---|
| Tilføyelser vises i arkiv-PDF | `38e8afaa` | 🔴 Kenneth på test — notatet manglet i dokumentet byggherren får |
| Kollisjons-reset visket ut tekst under skriving | `f1dea4db` | 🔴 Kenneth: *«feltet ble låst etter første setning»* |
| Dialogen svarer offline | `62446dce` | 🔴 Kenneth: *«når jeg trykker send skjer ingen ting»* |
| PSI-scrollrester fjernet | `51b6de21` | Lukket sak, restene utløste tre etterforskninger |
| Web-PSI signerer ikke falskt | `2ee6e343` | «Fullført» vistes før serveren bekreftet |
| Stille mutasjoner svarer | `3630e0d4` | 🔴 **Send/Besvar/Videresend ga FALSK SUKSESS offline** |
| Mobil-PSI: fullført venter på server | `890d17e2` | Samme klasse, andre flate |
| `--only`-flagg på i18n-generatoren | `cd9996ba` | Generatoren dro med seg 132 driftede nøkler |
| CLAUDE.md renset | `1875908b` | i18n-tallet var «~2500», faktisk **4 317** |
| Kontakter fase 2 | `3ffa6fee` | Fabels designlås |
| Forent søkemodal | `c1da46f4` | 🔴 Kenneth: tomt nedtrekk i «Legg til medlem» |
| Kolonner + filterblokk | `ef84d1dd` | 🔴 Kenneth: brukergruppe-filter sto under **Firma** |
| Repeater-kollisjon på celle-nivå | `d4df351e` | 🔴 Kenneth: falsk melding + **rå JSON i notatet** |
| Brukerminne på server (fase 1) | `15ef9602` | 🔴 Kenneth mistet «sist brukt» ved reinstallering |

🔴 **Ti av fjorten sakene kom fra Kenneths egen testing.** Ikke fra agentene.

**Fortsettelse 10.09 — fire merger til, develop `705cef2e` → `fe226986` under merge:**

| Sak | Hash | Utløst av |
|---|---|---|
| Repeater-kollisjon på celle-nivå | `d4df351e` | 🔴 Kenneth: falsk melding + rå JSON i notatet |
| Brukerminne på server, fase 1 | `15ef9602` | 🔴 Kenneth mistet «sist brukt» ved reinstallering |
| «+N»-teller åpenbar via tooltip | `b0cf5164` | Fabels formkrav til designgodkjenningen |
| Gammel navigasjon, trinn 1 | `03ba723d` | 🟢 PROD-måling: **10/10 brukere på ny nav** — netto **−844 linjer** |
| Brukerminne: én rad per prosjekt | `fe226986` | Strukturavvik fanget ved DB-verifisering |

🟢 **Deployet til test `705cef2e` + OTA publisert.** Migreringen `bruker_innstilling` verifisert
i DB: begge partielle indekser, FK mot `users(id)`.

🟢 **Kenneth verifiserte repeater-fiksen på telefon:** *«kollisjonstest på telefon er mye bedre.
Endringsloggen beskriver hva som skjedde.»*

⚠️ **Ny fast regel i ordre-malen:** `git rebase origin/develop` **rett før push**. Fem ganger
09.09 måtte cowork be om rebase i etterkant fordi develop hadde flyttet seg — base-illusjonen
viste da fremmedfiler som «slettet» i diffen.

⚠️ **Og en testmetode som ikke skal brukes igjen:** cowork ba Kenneth avinstallere appen for å
verifisere brukerminnet. **Appen er lokalt signert — å få den tilbake krever et nytt bygg.**
🟢 **DB-spørring beviste skrivingen uten risiko.**

### 🔴 FUNN 10.09 — nye prosjekter har vært TOMME siden 6. april

**Redesign målte tre opprettelsesveier. To seeder ingenting:**

| Vei | Grupper | Faggrupper | Dokumentflyter | Moduler/maler |
|---|---|---|---|---|
| `prosjekt.opprett` — **hovedveien** | ❌ | ❌ | ❌ | ❌ |
| `admin.opprettProsjekt` | ❌ | ❌ | ❌ | ❌ |
| `opprettTestprosjekt` | ✅ | ✅ | ✅ | ✅ |

🔴 **Rotårsak (`git log -S`):** kalleren lå på KLIENTEN — en lazy-seed på Brukere-siden
(`c6dc930e`) som selvhelbredet prosjekter ved første besøk. **Fjernet som kollateral i
`9a489876`** («Fjern gammel gruppevisning», 6. april, −1599 linjer). **Aldri et vedtak.**

**PROD-måling:** malen har 6 grupper; **ingen prosjekt har mer enn 5 fra mal.** Differansen er
håndlaget — 2 grupper på ytterstifjorn, 4 på Instinniforbotn.
🟢 **Hullet er betalt i manuelt arbeid, ikke i tomme prosjekter.**

**Rettet i `29b1eab3`:** delt `seedStandardProsjektoppsett` kalt fra alle tre veier i samme
transaksjon. 🔴 **Treffer piloten — A.Markussen oppretter prosjekter gjennom hovedveien.**

### ⚙️ ARBEIDSFORM ENDRET 10.09 — deploy koster Kenneths tid, merge gjør ikke

**Kenneth:** *«vi gater mange små fikser med deploys som tar mye tid»*

🔴 **Hver ordre merkes 🔴 (deploy nå) eller 🟡 (samles).** Full regel:
[SAMARBEIDSREGLER § DEPLOY KOSTER KENNETHS TID](SAMARBEIDSREGLER.md).
🟢 **Deploy blokkerer kun merge-agenten** — kode-agenter bygger videre, cowork venter ikke.

### Åpne saker etter runden — alle ført i [BACKLOG](BACKLOG.md) med måling

| Sak | Type |
|---|---|
| Faggruppe: egenskap eller resultat? | 🟢 **Avklart** — datakvalitet, ikke modellfeil |
| `group_faggrupper` | 🟢 **Avklart** — halvferdig, venter spor1 Ordre 1.3. **IKKE RYDD** |
| Gammel navigasjon avvikles | 🟡 **Kartlegging pågår** — prod: **10/10 brukere på ny**, gammel er død |
| Offline-klargjøring serveren kjenner | 🟡 **Fase 2 — designsak til fabel** |
| «Lagre mine filtre» | 🟡 **Designsak til fabel** |
| Maskinoversettelsene er kontekstløse | ⏸️ **UTSATT med vilje** — 1 089 inkonsistenser målt |
| HMS-gruppen gir HMS-admin | 🟠 Trenger forklaring i UI |
| Firmaadmin mangler domene-flate | 🟠 Må inn i hvert prosjekt |

⚠️ **Lærdom ført i BACKLOG: «null kallere» ≠ død kode.** Tre saker samme døgn, tre ulike utfall.
**Cowork gjettet feil på to av tre.** Mål *hvorfor* koden forsvant, ikke bare om den kalles.

## 📅 2026-09-07 SENKVELD — merge-runde 32 + 33 på develop, venter Kenneths gater

**Ikke i prod ennå.** Tre brancher merget etter `69ca9f62`:

| Merge | Innhold | Leveringsvei | Gate (Kenneths øyne) |
|---|---|---|---|
| `160d8f77` → develop (r32) | 🔴 **Kontoovertakelse via e-post-claimet lukket** — `oid`-oppslag før e-post (`:236` før `:253`), og identitets-e-post kun fra `preferred_username`. `mail`/`email` er visnings-fallback for navn, aldri identitet | api → test-deploy | MS-innlogging på mobil mot test, egen konto |
| `24505fbd` → develop (r33) | Død implisitt Google-vei slettet — `loggInnMedGoogleWeb` + web-callback + AuthProvider-no-op, −47/+2 | mobil-JS → `eas update` kanal `test` | Google-innlogging på mobil mot test, egen konto |
| `2b235e8a` → develop (r33) | **Arkiv-PDF strakk kart og tegninger** — `malBildeDimensjoner` leser JPEG-headeren i api når `Drawing.imageWidth/Height` er `null` | api → prod-deploy | Arkiv-PDF: lokasjonskart ikke strukket, markør står riktig |

🟢 **Testtall målt etter r33: api 330 · pdf 113 · shared 737 · web 210.**
(api 328 → 330 og pdf 110 → 113; de to api-testene kom fra `tegningsmarkorer.test.ts` og var ikke
forutsett i ordren, men matcher diffen.) 🟢 **Ingen migrering i noen av de tre.**

🔴 **Rotårsaken til tegningsstrekket lå ikke der cowork trodde.** Ordren pekte på
`preserveAspectRatio="none"`. Agenten målte at `none` er en **no-op i normaltilfellet**:
`beregnUtsnittVindu` gir et normalisert rom (`vbH=100`, `vbW=aspect×100`), så viewBoxen har bildets
eget sideforhold. **Strekket oppstår kun i fallback-grenen** der dims er `null` — da blir
`vbW=vbH=100`, en kvadratisk viewBox mot et rektangulært ortofoto. Dims er null for ukonverterte
PDF-er, eldre rader og ortofoto.
🟢 **`packages/pdf/src/tegning.ts` er urørt → koordinatrommet står → den frosne baselinetesten er
grønn.** Kostnad målt: ~0,1 ms per kall, kun for tegninger uten lagrede dims; 0 i normaltilfellet.

⚠️ ~~**Varig fiks ført, ikke bestilt:** backfill `Drawing.imageWidth/Height` i DB.~~
🔴 **RETTET SAMME KVELD — den finnes allerede.** `tegning.backfillDimensjoner`
(`apps/api/src/routes/tegning.ts:663`) er en `protectedProcedure` som fyller manglende dims per
prosjekt fra fila på disk. **Cowork førte den som ubygget uten å måle** — sjuende gang samme
klasse denne uka.

⚠️ **Men den dekker ikke alt:** `where` filtrerer på `fileType: { in: ["png","jpg","jpeg","svg"] }`.
**Ukonverterte PDF-er faller utenfor** — og de er nettopp en av de tre kildene til `null`-dims som
utløste tegningsstrekket. **Ingen kjent UI-vei kaller prosedyren.** Ført som åpent spørsmål, ikke
som ordre: *dekker backfillen de radene som faktisk mangler dims, og hvem kaller den?*

## 📅 2026-09-07 KVELD — prod `69ca9f62`, auth-tråden lukket

**develop = main = `69ca9f62` · test `7aa85094` · OTA production `7aa85094` (group `b2c066e6`)**

🟢 **MICROSOFT-INNLOGGING VERIFISERT I PROD PÅ TELEFON 2026-09-07.** Første gang den virker på en
OTA-levert app siden 04.09.

⚠️ **Cowork bommet på siste steg:** sa «ingen ny prod-OTA trengs, bundelen har alt den ekte
klient-id-en». **`84a89500` var fra FØR env-fiksen** (den kom i runde 29). Fanget da Kenneth så
plassholder-feilen på produksjonsappen. **Sjette gang samme mønster: hukommelse i stedet for
måling** — én `git show 84a89500:apps/mobile/.env.production` ville avgjort det.

| Levert i denne releasen | Hash |
|---|---|
| 🔴 **Mobil-MS dropper `User.Read`** — ID-token validert med `jose` mot Entras JWKS, Graph `/me` borte | `19a2884e` |
| 🔴 **OTA-env-landminen lukket** — `EXPO_PUBLIC_MICROSOFT_CLIENT_ID` var plassholder i `.env.*`; **alle OTA-er siden 04.09 bar den** | samme |
| 🔴 **Flertenant ID-token-validering** — `iss` mot tokenets eget `tid`, ikke pinnet tenant | `7aa85094` |
| Seed-uttrekk — `finnEllerOpprettDemoFirma`, sjuende kopiklasse lukket | `cb2f815b` |
| Feilede dokumenter synlig i eksport-UI | `4308352c` |
| **DEPLOY-RUNBOK** — 12 filer bar deploy-kommandoer, nå én kilde | `abdef2c2` |

### 🔴 Auth-tråden — hva den faktisk avdekket

Utløst av **ett spørsmål fra Kenneth om et Google-varsel.** Kjeden som fulgte:

1. **Google ber om minimum** — omfanget var aldri problemet.
2. **Mobil-MS ba om `User.Read`** — Graph-tilgang til hele Entra-profilen for data som lå i ID-tokenet.
3. **Google Cloud Console flagget «not using the state parameter»** — en ekstern målekilde vi hadde
   hatt gratis i måneder og **aldri åpnet**.
4. **`EXPO_PUBLIC_MICROSOFT_CLIENT_ID` var en plassholder** committet 25.03, ufarlig til OTA ble
   leveringsvei 04.09. **Microsoft-innlogging på mobil hadde vært død i en uke.** Ingen hadde prøvd.
5. **`iss` pinnet mot `/common`** ga 401 — og coworks foreslåtte fiks («pinn mot vår tenant»)
   ville **sperret hver eneste kunde.** Fanget før merge.

🔴 **Ført i [`sikkerhet.md`](sikkerhet.md) § DEKNING:** gjennomgangen så på hva som skjer ETTER
innlogging, aldri på HVORDAN innlogging skjer. Fila har nå en dekningstabell.

⚠️ **Åpent, meldt av redesign, ikke bygget:** admission-gaten matcher på `email`-claimet, som en
tenant-admin kontrollerer, framfor domene-bundet `preferred_username`. **Pre-eksisterende og
uendret av releasen** — men egen runde. **Og `iss`/`tid`-testen mangler** (api-tall uendret 319).

🟡 **Google implisitt flyt** (`relay/inbox-google-implisitt-flyt.md`) — ferdig skrevet, ikke gitt.

## 📅 DØGNET 2026-09-06/07 — ti merge-runder (17–26), prod-release `d4c4c65d`

**develop `8ee4e681` · main `d4c4c65d` · test `8ee4e681` · api-testtall `315` (merge-agentens
måling, runde 26 — coworks 298 var feil)**

🟢 **Prod-release 2026-09-07: 58 commits, NULL migreringer.** Bygg og restart.

| Levert i denne releasen | Hash |
|---|---|
| 🔴 **Tenant-lekkasje lukket** — fem skriveveier uten firmasjekk + uautentisert `/prosesser`-endepunkt fjernet | `d58e080f` |
| Byggeplassfilteret — 9 kopier → 1 kilde, **tre skjulte bugger lukket** | `a076236f` |
| Grenseresolver trinn 0–3 — kravtype, Vei B-varianter, PDF-krav, server-frys, avviksfelt | `dc93d01d`+ |
| Prosjekt-livssyklus (FL) — avslutt/arkiver fryser tilgang via delt guard i 11 porter | `36dc3029` |
| Prosjektarkiv-UI + eksport-rettighet til firma-admin | `3c6df4bf` · `1d4bf629` |
| Mal-endringsvern — krav i bruk kan ikke endres · herkomst-linje i utfylling | `c1f202dd` |
| Trafikklys-etiketter — synlige navn, **femte kopiklasse lukket** | `8d063d1d` |
| Arkivfunn — leselige tegninger, timer/utlegg ut, manifest forklart | `325a0b7e` |

🟢 **PROD BEKREFTET `d4c4c65d`** (2026-09-07 06:04Z, `curl api.sitedoc.no/version`).

🟢 **MOBIL-OTA FYRT 2026-09-07 — `84a89500`, group `6ce8ebd6`.** Commit-linja uten asterisk og
**identisk hash med prod-API-et** — bundel og server i takt. Steg 2-målingen ga én treff:
`https://api.sitedoc.no`. Ute hos testerne: dokumentsøk mobil, byggeplass-velger, innboks-pila,
utlogging, SJA-signaturrunder, grensekrav med herkomst-linje, trafikklys-etiketter.
⚠️ **Etterslepet var ~17 timer** — OTA-en ble den eldste åpne saken mens web og api gikk ut i to
prod-runder. **Lærdom: mobil-JS hører i samme runde som prod-deployen, ikke etter den.**

### Runde 27 (2026-09-07) — venter test-verifisering

| Levert | Hash |
|---|---|
| 🔴 **Arkiv fase 3** — dokumentene ER endelig i pakken. Én PDF per dokument, mappe etter domene (SJA→`hms/`), per-dokument `try/catch`, papirkurv ute, **ekte progresjon** (baren var falsk før), template-løse HMS-avvik via bestiller-faggruppe | `8e9a2652` |
| Malbyggerens stille feil — `oppdaterObjekt`/`oppdaterRekkefølge` manglet feil-callbacks; `slettFeil` → `feilVisning` for alle tre avslag | `a6fc03b5` |

**Kostnad målt og ført i `dokumentgenerering-plan.md`:** ~1 s/dokument + ~0,09 s/bilde.
200 dokumenter = 3–25 min, **drevet av bildetetthet, ikke antall.**

🟢 **«Lagring av ugyldig verdi fungerte» — målt, vernet lekker IKKE.** De tidlige lagringene gikk
gjennom fordi utkastet ennå ikke hadde verdi i akkurat det feltet. Det var stillheten hele veien.

⚠️ **Fem funn kom fra Kenneths egen test-verifisering**, ikke fra gaten: uleselige tegninger ·
lønnsdata i arkivet · uforklart manifest · krav som endret seg under føttene · **dokumentene som
ikke var der i det hele tatt.** Ingen av dem kunne build eller typecheck ha fanget.

## 📅 DØGNET 2026-09-04 — ti merger, to prod-deployer, OTA i drift

**develop `3c905298` · prod `96eebc13` · test `ea729ced` · TestFlight bygg 54 + OTA**

| Runde | Hash | Ute hos |
|---|---|---|
| EXIF opptakstid og -sted på bilder | `c6de4385` | **prod + testerne (OTA)** |
| Lesbar endringslogg (kolonnenavn, fra→til, UUID skjult) | — | **prod + testerne (OTA)** |
| Opptakstidspunkt i web | `d610acb8` | develop |
| Sidebrekk «BILDER» + navnløst felt i PDF | `f13b2421` | develop |
| Navnløst felt lagres som tom streng | `09102794` | develop |
| Web ut av `platforms` (åpnet OTA-veien) | `2b73ae68` | develop |
| AM4 malarkiv **bolk 1** — migrering + `firmamal.*` | `91e3e5a6` | **test** |
| lokasjonOmfang + L9 + paritetsfiks | `9a94a249` | **test** |
| AM4 malarkiv **bolk 2** — firma-arkiv UI | `2cfdbaea` | **test** |
| Arkiv-PDF for oppgave + HMS avvik/RUH | `a2c7edc9` | develop |

**Tre migreringer, alle additive:** `20260904120000_malarkiv_hms_kolonner` (5 kolonner) ·
`20260904140000_lokasjon_omfang` (2 kolonner). Begge anvendt på test, ingen på prod ennå.

🔴 **Venter prod-deploy:** web-opptakstidspunkt · PDF-sidebrekk · navnløst felt · malarkiv (bolk
1+2) · lokasjonOmfang · arkiv-PDF for oppgave/HMS. **Verifiser på test som innlogget først** —
malbyggeren fikk 91 nye linjer og brukes av alt.

---

## Arkivert: § Pågående arbeid (PR-historikk) — august-innslag, i prod siden august/september

### 🟢 lokasjonOmfang — «Gjelder hele byggeplassen» som eksplisitt svar + L9 sticky tegning (`feat/lokasjonomfang`, MERGET develop `ea66590b`)

**Ordre:** `docs/redesign/ORDRE-lokasjonomfang-2026-09-04.md` (+ L9-tillegg), fabel-vedtatt av Kenneth 04.09. Forankring: «alle gatelysene mangler merking» er én observasjon om hundre lyspunkt — en pin ville påstått at funnet gjelder ett sted. I dag skriver PDF-en «Ikke utfylt» der «gjelder alt» var ment; et tomt felt der noe var ment er en usann påstand.

**Levert (8 krav):**
- **Modell:** nytt nullable `lokasjonOmfang` ("punkt" | "byggeplass" | null) på `Checklist` + `Task` (migrering `20260904140000_lokasjon_omfang` — kun ADD COLUMN, ingen backfill, forhåndsgodkjent). Eksponert i `sjekkliste.opprett/oppdater` + `oppgave.opprett/oppdater` (omfang er låst etter godkjenning via `rørerLaastFelt`).
- **Visning (paritet web + PDF + mobil):** «Gjelder hele byggeplassen» i `LokasjonVelger` (web), `byggLokasjonsblokk` (PDF — skrives ALLTID ved byggeplass, aldri stille utelatt), mobil sjekkliste- + oppgave-detalj.
- **Krav 2:** «Gjelder hele byggeplassen» som ett-trykk-affordance i `LokasjonVelger` (passiv tilstand + modal), ingen obligatorisk bekreftelse.
- **Krav 3:** auto-åpning av tegning kun `status=draft` **OG** `lokasjonOmfang==null` **OG** ingen tegning fra før; synlig utvei (Avbryt), lukking lagrer ingenting. Nye lagringer setter `lokasjonOmfang="punkt"` → konsistent framover.
- **Krav 4 (paritetsfiks):** oppgavesiden fikk `showLocation`-gate (rendret før velgeren ubetinget — et hull). Ingen API-endring: `template` følger `oppgave.hentMedId`.
- **Krav 5 (L9):** sticky tegning i repeater-feltpin — tom rad forhåndsvelger sist brukte tegning i SAMME dokument (forrige rad → dokumentets tegning → ingen). **Kun tegning, aldri pin.** Kilden er dokument-avgrenset (ny prop `dokumentTegning`/`stickyTegning`), IKKE `byggeplass-kontekst.aktivTegning` (sesjonstilstand på tvers av dokumenter — svakheten Kenneth 04.09 ba om å rette). Atferden «rad 2 lander på rad 1s tegning» bevart.

**Målt avvik (rapportert):** oppgave har ingen arkiv-PDF ennå (`arkiv/render.ts` kaster) → PDF-visningen gjelder i praksis kun sjekkliste; oppgave-PDF arver regelen når den bygges. Web + mobil dekker oppgave.

**Begrepsrydding (lukker masterplan-restansen «tre ting heter lokasjon»):** dokumentlokasjon / lokasjonstekst / feltpin / lokasjonsbryter — se [terminologi.md](terminologi.md).

**Gate grønn (lokalt):** web build (typecheck+lint+next), api typecheck, mobil typecheck + lint 0 errors, pdf 97/97, shared 636/636, web 193/193 (inkl. tre navngitte repeater-regresjonstester + ny L9-test). **Leveringsvei:** web + server-PDF → prod-deploy; mobil-delen via OTA.

### 🔴 PROD-FELLE lukket 31.08 (`73b30e71`) — tegningsposisjon-modalen kunne ikke lukkes

**Kenneth i felt på TestFlight-bygg 46 (`5605775d`):** *«eneste måten å komme ut av tegning →
avslutte og restarte appen»*. Rammet alle som åpnet et `drawing_position`-felt i en repeater
på iPhone med Dynamic Island — A.Markussen i produksjon.

**Mekanismen, målt på simulator (iPhone 16 Plus / iOS 18.4):** `useSafeAreaInsets()` gir
korrekt `top=59` inne i `<Modal presentationStyle="fullScreen">`, men `<SafeAreaView>`
anvender **0** padding der. Headeren rendret på y≈32–54, inne i det 59 px høye island-båndet.
`idb ui tap` på X-en ×3 lukket ikke; tap rett under båndet traff umiddelbart. Både «Lukk» og
«Bekreft» var utenfor rekkevidde.

🔴 **Cowork gjettet på tre mekanismer — alle tre var feil** (manglende provider · kontekst
krysser ikke modalen · insets er null). Målingen fant den fjerde. En fiks skrevet på
hypotesene ville bommet; runden var verdt kostnaden.

**Levert (`73b30e71`):** «Lukk» i bunnlinjen (utgang uavhengig av insets) · indre X lukker nå
hele modalen · `SafeAreaView` byttet mot `View` + `useSafeAreaInsets()`-padding ·
prod-debug-linjen `Bilde: WxH | Zoom: Nx` fjernet fra WebView-en · sju filer rettet fra
React Natives innebygde `SafeAreaView` til context-varianten.

**Datatap målt, ikke antatt:** en påbegynt repeater-rad **overlever** app-drap (autolagring
til SQLite, 2 s debounce i `useSjekklisteSkjema.ts:405-410`). Tapt går kun de siste ≤2
sekundene og et ubekreftet modalvalg. Ingen save-on-background finnes.

⚠️ **Cowork-gaten sendte første leveranse tilbake.** `dace662f` fjernet fella, men lot
«Bekreft» ligge i det døde båndet — brukeren kom seg ut, men kunne fortsatt ikke sette en
posisjon, som var Kenneths opprinnelige klage. Inset-fiksen kom i `20df827f`.

### 🔴 REGRESJON i samme bygg (47) — vi ødela fire skjermer mens vi fikset én

Kenneth testet bygg 47 og bekreftet at tegningsposisjonen virker: *«de nye plassene knappene
har fått i fiksen fungerer svært bra»*. **Men tekstfelt-modalen var nå ødelagt** — «Ferdig»
under Dynamic Island, vinduet låst.

**Årsak, målt:** importbyttet erstattet React Natives innebygde `SafeAreaView` med
context-varianten i sju filer. **Fire av dem er fullScreen-modaler**, der context-varianten
anvender 0 padding: `TekstfeltObjekt` · `InfoBildeObjekt` · `FeltDokumentasjon` ·
`OpprettDokumentModal`. De virket i bygg 46.

🔴 **Rotårsaken er coworks rekkefølge, ikke koden.** Importbyttet ble bestilt i **samme runde**
som fella — før simulator-målingen forelå. Ordren sa «mål hver fil»; det som ikke var målt
ennå var at komponenten svikter i en hel modal-klasse. **Mål først, bestill så** gjelder også
når endringen ser triviell ut.

**Kartlagt 2026-08-31:** 9 fullScreen-modaler rammet (4 av oss, 5 fra før) · 15 pageSheet
umålt · 1 fikset. 🔴 **`<Modal>` uten `presentationStyle` ER fullScreen på iOS** — derfor er
`TekstfeltObjekt.tsx:46` rammet uten å se sånn ut.

**Systemfiks bestilt** (Kenneth: *«ikke lapp sammen — lag en løsning som fungerer over alle
flater»*): delt `ModalFlate`-komponent + `no-restricted-imports`-lint som forbyr
`SafeAreaView` i `apps/mobile`. `relay/inbox-modalflate-systemfiks.md`.
pageSheet måles parallelt før de røres — `relay/inbox-simulator-pagesheet.md`.

### 🟢 TEST-DEPLOY 30.08 (`24bccbba`) — fire runder + REG fase 2-migreringen

Stempel verifisert: `curl https://api-test.sitedoc.no/version` → `24bccbba`. Migrering
`20260830120000_registrering_fase2_prosjekttilgang` applied på `sitedoc_test`; de tre andre
db-pakkene svarte «No pending».

🔴 **Migreringen ble nesten glemt — tredje gang samme feilklasse på tre dager.**
`deploy-test.sh` skrev ut `up -d --build` **uten migrate-steget**. Blokken er raskere å lime
enn den fulle sekvensen og fungerer ni av ti ganger, fordi det som regel ikke er noen
migrering. Denne gangen kjørte test ny kode mot gammelt skjema i noen minutter —
`organisasjon.hentMedlemmer` velger `prosjektTilgang`, som ikke fantes i `sitedoc_test`.

Tre kilder, samme feil, tre dager: `deploy-prod.sh` hadde migrate utkommentert (rettet
29.08) · `deploy-detaljer.md` sa «droppes når diffen ikke har migrering» (rettet 30.08) ·
`deploy-test.sh` skrev ut en blokk uten den (rettet 30.08). **Skriptet er kilden Kenneth
faktisk limer fra** — det skriver nå ut STEG 1 bygg → STEG 2 migrer (alle fire, med
`sitedoc_test`-gate) → STEG 3 start. Utskriften er verifisert byte-identisk med kommandoen
som virket.

### 🟢 Fire brancher merget til develop 30.08 — deployet til test (se over)

Merget i rekkefølge, alle disjunkte (verifisert med `merge-base`-diff, ingen delte filer):

| Branch | Hash | Merge | Innhold |
|---|---|---|---|
| `fix/emne-alltid-redigerbart` | `f074f903` | `7b1a87c8` | Emne redigerbart etter sending på oppgave |
| `fix/emne-sjekkliste` | `c18c01a5` | `14d8fcc7` | Samme regel på sjekkliste — Kenneth: *«øyeblikksbilde vs. levende dokument, det er jo det samme»* |
| `feat/reg-fase2` | `578e2b67` | `355c200c` | REG fase 2: `prosjektTilgang` per ansatt + `prosjektTilgangDefault` firmadefault |
| `fix/o12-eier-firma-lesevisning` | `0101bd25` | `964fdbfd` | **O12 — UI-duplikatet lukket.** `oppsett/firma` er ren lesevisning; Kenneth gatet i nettleser |
| `fix/faggruppe-slettevakt` | `fc817801` | `661682c5` | Faggruppe-sletting teller nå medlemmer + flyter. **Merget ETTER test-deployen `24bccbba`** — ikke på test |

**O12 i klartekst:** vedtaket ble tatt 2026-05-03 (`navigasjon-arkitektur-analyse`, linje 92)
og **halvveis utført samme dag** — renamet gjort, redigeringen stående. I fire måneder skrev
`oppsett/firma` og `firma/innstillinger` **samme rad med samme mutasjon**
(`organisasjon.oppdater`), der prosjektsiden manglet validering, i18n og en fungerende
gating på Rediger-knappen. Kenneth 30.08: *«vi kan aldri duplisere hverken UI eller kode.»*
Fila gikk 180 → 113 linjer; `organisasjon.oppdater` har 0 treff der nå.

🔴 **Cowork-gaten sendte den tilbake én gang, og det var riktig:** første leveranse hadde
`const harFirmaTilgang = !!organisasjon || erSitedocAdmin` **etter** den tidlige returen på
`!organisasjon` — altså konstant `true`. Oppførselen var riktig, konstruksjonen løy. Å levere
en falsk gate i nettopp den runden som ryddet et halvutført vedtak ville vært samme feil i ny
form. Nå er gaten den tidlige returen, og kommentaren sier det.

✅ **Faggruppe-duplikatet fra samme mai-analyse (linje 60–61) er allerede ryddet** — målt
30.08, `/dashbord/prosjekter/[id]/faggrupper` finnes ikke. Radene er merket i analysen.
`oppsett/firma` var dermed det eneste bekreftede UI-duplikatet vi hadde.

🔴 **REG fase 2 inneholder en migrering** (`20260830120000_registrering_fase2_prosjekttilgang`)
— ren additiv, `ADD COLUMN` på `organization_members` + `organization_settings`, ingen DROP,
ingen backfill. **Kjørt KUN lokalt.** Test og prod har den ikke. Neste deploy må kjøre
`migrate deploy` for alle fire db-pakker.

`modulNokler` ble tatt ut av fase 2 før commit — se [BACKLOG § 2 Modulmodellen](BACKLOG.md)
og [modulmodell-utredning-2026-08-30.md](modulmodell-utredning-2026-08-30.md).

**Cowork-gate på reg-fase2 (målt, ikke lest av rapport):** `modulNokler` har null levende
referanser i kode/schema/migrering/15 språkfiler · begge mutasjoner er `verifiserFirmaAdmin`-
gatet · `prosjektTilgang` evalueres ingen steder (fase 2-kravet holder) · alle 15 i18n-filer
har 14 forekomster, ingen henger etter.

**Falsk alarm som ble målt bort:** `git diff develop..branch` viste at alle tre «fjernet»
tavle-radene og DEPLOY-RYTME-blokken. Mot egen merge-base rørte alle tre **null** linjer i
`STATUS-AKTUELT.md` — de var bare bak på fila. 🔴 **`git diff develop..branch` svarer ikke på
«hva endret branchen».** Det gjør `git diff $(git merge-base develop branch)..branch`.

### 🟢 Oppgave-datalås + repeater ut av oppgavemaler (MERGET develop `f61eb64b`) — PÅ TEST, GATET 3/3

**Kenneth-funn på test 29.08:** han sendte en oppgave, fikk den i retur, og **endret et
utfylt tallfelt** (antall gravemaskiner 1 → 2). Skulle ikke være mulig.

**Rotårsak (kontrollplan):** `oppgave.oppdater` (`:635`) ER draft-only — men feltverdiene går
gjennom `oppgave.oppdaterData` (`:689`), som hadde **ingen statussjekk**. To dører, én vakt.
Kommentaren i `oppdater` lovet «kun tilføyelser er tillatt» — en regel ingen kode håndhevet.
🔴 **Fjerde forekomst av samme form på to dager** (prosjektisolering · lokasjonsgating ·
`forbedreOversettelse` · denne).

**Klient-rotårsaken var en annen og verre:** låsen `beregnLaasteFelter` VAR wiret og predikatet
var riktig — men lås-settet ble beregnet **én gang ved mount** (`useOppgaveSkjema.ts:95`) og
aldri på nytt etter refetch. Kenneths flyt (opprett → fyll → send → få i retur, alt med
dokumentet åpent) ga et lås-sett utledet fra tom utkast-data. Nå `useMemo`, reberegnes ved
status/data-endring. Bonus: utkast er igjen fullt redigerbart — den gamle låsen over-låste
utfylte utkast-felt ved reload.

**Vedtak B (Kenneths regi):** felt med verdi låses ved sending · tomme felt kan fylles av den
som har ballen · kommentarer og vedlegg går alltid. Domenet han formulerte:
*«en oppgave er en arbeidsordre — arbeideren fyller ut de tomme feltene når oppgaven er utført
og sender til godkjenning.»* Ført i
[domene-arbeidsflyt.md § Hva en oppgave ER](domene-arbeidsflyt.md). Alternativ A («redigerbar
som utkast kun») forkastet — det ville gjort oppgaven til en melding.

**Repeater ut av oppgavemaler** (`d2958b98`): `FeltPalett` skjuler `repeater` når
`category = "oppgave"`. Kenneth: *«en repeater tilhører ikke i oppgave.»* Begrunnelsen —
en repeater er N ting, en arbeidsordre er én; riktig modell finnes allerede motsatt vei
(`feat/oppgave-per-rad`: hver repeater-rad i en SJEKKLISTE får sin egen oppgave). **Formen er
«slutt å tilby», ikke «riv ut»** — eksisterende objekter rendres som før, ingen migrering.
Målt: 0 oppgavemaler med repeater på test, 4 i prod (alle Kenneths egne testdokumenter,
bekreftet av ham).

**Kenneths gate på test 29.08 — 3/3 grønt:** utfylt felt låst etter retur, tomt felt fyllbart,
kommentar og vedlegg går på begge · repeater borte fra oppgavemaler, til stede i sjekklistemaler ·
utkast fullt redigerbart.

**Meldt, ikke bygget:** mobil `useOppgaveSkjema` har trolig samme mount-staleness
(server-vakten dekker den) · quiz/video/info_image/signature kan være meningsløse i oppgave —
hver fjerning er et produktvedtak.


### 🟢 Emne på oppgave + onboarding-delstatus (`fix/oppgave-emne` + `feat/prosjektoppsett-veileder`, MERGET develop) — PÅ TEST

**Funn 1 fra Kenneths gate 29.08 løst** (`ff485478`): `EmneVelger` rendres nå på
oppgave-detaljsiden, gjenbrukt uendret fra sjekklisten. `leseModus = status !== "draft"` —
speiler `oppgave.oppdater` (`oppgave.ts:670`), som er **strengere enn sjekklistens vakt** og
avviser ALL redigering utenfor `draft`. **Cowork-vedtak samme runde:** LokasjonVelger-gatingen
på samme side rettet fra `["closed","approved"]` til `status !== "draft"` — den ga stille
server-avvisning i `sent`. To felt side om side oppfører seg nå likt. Ingen nye i18n.
Sjekklistens gating urørt.

**ON onboarding** (`214bae7f`): `harTegning` i `hentOnboardingStatus` + delstatus på
lokasjonssteget («Lokasjon ✓ · Tegning mangler»). Flagget `harLokasjon` var `byggeplass.count`
og ble grønt uten en eneste tegning.

🔴 **Målt av dokgen før bygging — ordren var delvis foreldet:** selve onboarding-panelet var
**allerede bygget** (`[prosjektId]/page.tsx:119-198`, fire steg + modul-steg, DB-avledet,
skjules når alt er oppfylt), og UX-problem 1 (faggrupper read-only) var løst — siden er full
CRUD og lenket fra dashbord-kortet. ⚠️ **Coworks gate 28.08 verifiserte hullet i
`prosjekt.opprett` men sjekket aldri om konsumenten fantes.** `hentOnboardingStatus` er
navngitt etter sin bruker; ett grep ville avslørt det. Ført i masterplanen.

**UX3** (blyant ved redigerbare navn i flytoppsettet) **utsatt** — den flaten er parkert til
faggruppe/kontakter-avklaringen er gjort (`domene-arbeidsflyt.md`).

⚠️ **GJENSTÅR — selve leveransen er ikke gjennomført:** Kenneth skal opprette et tomt prosjekt
og komme fram til sendt sjekkliste **kun via panelets lenker**. Panelet fantes fra før; det
ingen vet er om veien går. Kjøres på test.


### 🟢 FASTE FELT — emne-skrivevei, lokasjonsmodell, faggruppe-fjerning (`feat/faste-felt`, MERGET develop `30260f88`) — PÅ TEST, gatet med funn

Fabels ordre, cowork-gatet (Del D var alt bygget; `ReportTemplate.subjects` og `Task.subject`
fantes alt — sparte tre runder). **Emne:** `EmneVelger` på sjekkliste-detalj (chip + Endre,
`<datalist>` fra malens `subjects`), emnefelt i oppgave-modalen, fritekstsøk inkluderer
`subject`. 🔴 **Avvik A2, fabel-ratifisert FØR koding:** mockupen forutsatte en opprett-modal
for sjekkliste — den finnes ikke (`OpprettMalVelger.tsx:212` oppretter ved klikk). Emne settes
derfor kun på detaljsiden for sjekkliste. **Lokasjon:** to tilstander («+ Legg til lokasjon» /
aktivert m/Endre-Fjern), `showLocation` gater rendringen (var ubetinget), PDF skriver
byggeplass-linja alltid + emne som første datafelt. **Malbygger:** faggruppe-raden fjernet,
radtekster rettet. **Statusvakt:** `subject` inn i den eksisterende `approved`/`closed`-vakten.

**Kenneths gate på test 29.08 — fire funn, alle rutet:** oppgave-detaljsiden mangler
emne-chippen (→ `relay/inbox-oppgave-emne.md`) · duplisert lokasjonsvelger, modal vs. navigering
til Tegninger (→ fabel) · barn-labels usynlige i utfylling (kjent D8/D9, venter malrydding) ·
flytboksene kollapset (se under).

### 🟢 Stegvisning i flytoppsettet (`feat/flytboks-stegvisning`, MERGET develop `16c20a9e`) — PÅ TEST, LOKALT GATET FØRST

**Kenneth-vedtak: verifisert lokalt før test** — første gang i dag. Oppsettet sorterte boksene på
**rollerangering** (`dokumentflyt/page.tsx:475`), dokumentet på `steg`. Å nummerere den gamle
sorteringen ville satt tall på feil rekkefølge. Nå sorteres og nummereres begge flater på `steg`.
Sammendragslinja følger samme rekkefølge. Kun `page.tsx`, +41/−3, ingen datamodell.

⚠️ **Kjent grense, skrevet i commit-meldingen:** oppsettet har én boks per **rolle**, dokumentet
én per **posisjon**. En rolle på flere steg (rundtur — «Endringsmelding» har Godkjenner på steg 1
OG 4) vises på sitt tidligste steg (`min`). Kenneth-vedtak: behold `min`, den ærlige fiksen hører
til `steg={1}`-runden.

🔴 **Lokal verifisering kostet en halv økt fordi miljøet var råttent, ikke metoden.** Lokal DB var
fire måneder bak: `organization_members.status` manglet → 500 på alt som slår opp org-medlemskap,
mens resten svarte 200. `prisma migrate deploy` tok ikke igjen etterslepet — den stoppet på
`mal_integritet` (unik navne-indeks mot fem identiske PSI-maler fra april-seeden) og lot DB stå i
failed-migration-tilstand. Løst med frisk test-dump (`lokal-dev.md § 3`). **Lærdommene ført i
[lokal-dev.md](lokal-dev.md)**: dumpen er veien, ikke migrate deploy · dev-serveren må stoppes før
`dropdb` · regenerering av Prisma-klienten avdekker slik drift i stedet for å skjule den.

**Målt underveis, til fabels F1:** «Tømrer -> HE» var IKKE divergenstilfellet cowork antok —
dens steg er monotone med rangeringen. Beviset kom fra «Endringsmelding», der Godkjenner står på
plass 2 og rangering ville satt den sist.


### 🟢 KP-lokasjon — isolering, arv av tegning, statuslås (`fix/kp-lokasjon`, MERGET develop `b987d793`) — PÅ TEST, GATET 4/4

Fire runder, kontrollplan. **Utløser:** måling av AM-3-fiksen (`180e9c61`) avdekket fire hull.
**(1) Prosjektisolering:** `sjekkliste.oppdater` skrev `input.drawingId` til både `Checklist` og
koblet `KontrollplanPunkt` uten tegnings-oppslag — målt åpen og nåbar. Søsterprosedyren
`settPunktPlassering` hadde vakten. Ny delt `verifiserTegningIProsjekt` i
`services/kontrollplanKobling.ts`, kalt fra begge dører (ingen kopiert if-blokk).
**(2) Arv ved Start:** `koblePunktTilSjekkliste` kopierer nå punktets `drawingId` + byggeplass ved
`kilde:"startet"` — **aldri pin**. Kenneth-vedtak: *«hver sjekkliste må få sin egen plassering»* ·
punktet er planleggerens omtrentlige plassering, sjekklisten dokumenterer faktisk utførelse.
Utfører kan bytte tegning som bevisst valg. **(3) Statuslås:** `approved`/`closed` var låst KUN
klient-side; byggeplass-chippen var ugatet og skrev `drawingId: null` på godkjente dokumenter.
Kenneth-vedtak (alternativ 1): byggeplass er del av det dokumentet påstår → serverside-vakt på
`drawingId`/`positionX`/`positionY`/`byggeplassId` + deaktivert chip. Retting går via gjenåpning,
som gir spor. **(4) `?? null`** i speil-blokken erstattet med «utelatt = behold», likt
`Checklist.update`. **(5) Mobil-tapp** på punkt uten sjekkliste gir nå `Alert` i stedet for stille
`return`. 🔴 **Repeater urørt** (Kenneths «ikke rør») — ingen av de sju bærende filene rørt,
regresjonstester 5/5, Kenneth bekreftet uendret på test.

**i18n-lærdom ført til [shared-pakker.md § i18n](shared-pakker.md):** generatoren hopper over
nøkler som finnes og oppdager IKKE at kildestrengen er endret. «Site» ga tysk «Website»; retting
til husets «Building site» slo først gjennom da nøkkelen ble slettet fra de 13 og regenerert
(`fab6deb0` → de «Baustelle», fr «chantier», sv «Byggplatsen»).

**Kenneths gate på test 29.08, 4/4:** godkjent sjekkliste → chip død m/forklaring · utkast → chip
virker · Start fra plassert punkt → LOKASJON «900512 Røstbakken · Z-20-01» uten pin · repeater
uendret. **Ingen migrering. Ingen prod.** Reload (mobil): JS-bundle.

⚠️ **Funn under gaten, egen sak:** klikk på et IKKE-startet kontrollpunkt på tegningen sender
brukeren til kontrollplan-oversikten uten å si hvilket punkt han kom fra
(`tegninger/page.tsx:980-986`, fallback fra `180e9c61`). Kenneth mistet oversikten over hvilken
sjekkliste han skulle fylle ut.


### 🟢 ANSVARLIG-kolonnen navnga feil faggruppe på utkast (`fix/ansvarlig-kolonne`, MERGET develop `12e34ceb`) — PÅ TEST, venter Kenneths gate

Kenneth-funn (prod): sjekklistelista viste faggruppenavn i ANSVARLIG på utkast. `formaterAnsvarlig` (sjekklister/page.tsx + IDENTISK i oppgaver/page.tsx) falt tilbake på `utforerFaggruppe.name` når dokumentet ikke var sendt — en faggruppe som ennå ikke hadde fått ansvar (utkast har verken `recipientUser` eller `recipientGroup`). Kenneth-vedtak: ansvarlig = den/de i flyten som skal svare ut dokumentet; **utkast → oppretteren** (`rad.bestiller?.name`), **ellers ingen mottaker → tom** («—» i cella). Ledd 1–2 (mottaker-person/-gruppe) beholdt. Fikset begge sider: funksjonen returnerer **tom streng** (ikke «—») så filterbyggingen (`bygg()` → Boolean-filter) ikke får en «—»-oppføring — cella rendrer «—», samme mønster som `opprettetAv`. Filter- OG sorteringsveien treffer `formaterAnsvarlig` begge steder → dekket. **Måling (mål-før-utvid):** den buggede fallbacken finnes KUN i disse to filene; HMS-flatene (`HmsFlytStripe`/`HmsFlytKort`/`flyt-ledd`) bruker «ansvarlig» i en annen, korrekt betydning (HMS-behandler/`erHovedansvarlig`) — ikke rørt. Ingen nye i18n-nøkler. Grønt: typecheck web, `pnpm test` 189/189. **Ingen prod.** Reload: n/a (web).

### Modul-onboarding-wizard (timer) — IMPLEMENTERT PÅ DEVELOP 2026-07-08 (web-only, venter prod)

Gjør firmamodul-onboarding synlig + veiledet ved aktivering. Bakgrunn: `organisasjon.settFirmamodul` (aktiver=true) flipper kun modul-flagget — **seeder ikke katalog** → timer-brukere traff tomme kataloger (jf. [BACKLOG § Modul-onboarding-veiledning](BACKLOG.md)). Generisk datadrevet modell (ferdig-state utledes fra status-tellinger, aldri lagret steg-posisjon) → maskin/varelager plugges inn senere.

- **TASK 1 (`ea4887a3`)** — modell `apps/web/src/lib/onboarding-wizard.ts` (`OnboardingWizardConfig`, `førsteUfullførteSteg`/`antallGjenstår`/`erOnboardingFullført`) + timer-config (4 steg, `ferdig = count > 0`, status-type fra tRPC `RouterOutputs`).
- **TASK 2 (`97a2912f` + Suspense-build-fix `1730263b`)** — dedikert wizard-side `/dashbord/firma/timer/oppsett` (URL-adresserbare steg `?steg=`, datadrevet gjenopptak). Orkestrerer: steg 1 = `aktiverNivaa1`, steg 2–3 lenker til aktivitet/tillegg-sider, steg 4 = utlegg-state. Oppsett-fane i timer-layout + hjelpetekst (?-ikon).
- **TASK 3 (`34ae939f`)** — modal-inngang i `firma/moduler` (`settFirmamodul.onSuccess` → «{Modul} aktivert. Sett opp nå?») + «Fullfør oppsett ({n} av N)»-indikator på modulkortet (skjules ved fullført). Generisk `MODUL_WIZARD_URL`-oppslag.
- **TASK 4 (docs)** — i18n-sveip (30 nøkler nb+en, 0 relikvier/manglende), hjelpetekst-verifisering, denne STATUS-oppdateringen, sluttverifisering (build 59/59 grønt).

**v1 = web-only** (mobil «oppsett ufullstendig»-visning = egen follow-up). i18n nb+en (generate.ts frossen under redesign → 13 språk faller tilbake til nb). **Konsolidering utsatt** (redirect gammel `onboarding`-fane → wizard + migrering/`aktiverTomKatalog` inn i steg 1) → [BACKLOG § Onboarding-wizard konsolidering](BACKLOG.md). **Gjenstår: prod-deploy** (adresserer også Åpne tråder pkt 1 — tom lønnsart-katalog på prod-firma synliggjøres nå av wizarden).

---
