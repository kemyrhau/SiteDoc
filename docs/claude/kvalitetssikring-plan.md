---
name: kvalitetssikring-plan
description: 🟢 VEDTATT 2026-08-31 — fire lag mot regresjoner, rangert etter hva de garanterer. Utløst av tre regresjoner på én dag som alle kompilerte grønt.
sist_verifisert_mot_kode: 2026-09-16
---

# Kvalitetssikring — fire lag mot regresjoner

> **Kenneth 2026-08-31:** *«Er det mulig å gjøre en kvalitetssikring på endringer på en slik
> måte at vi sikrer at vi ikke skader funksjoner som fungerer?»* … *«la oss prøve — det er på
> tide med en ny tilnærming.»*

## Hvorfor dagens nett ikke fanget noe

**Tre regresjoner 2026-08-31. Alle kompilerte grønt. Alle passerte regel 10.**

| Regresjon | Hva den var | Hvorfor typer/tester bommet |
|---|---|---|
| Tegningsmodalen kunne ikke lukkes (bygg 46) | Geometri — header under Dynamic Island | Ingen type beskriver «knappen er truffbar» |
| Tekstfelt låst (bygg 47) | Importbytte `SafeAreaView` | Identiske typer, identisk signatur |
| Timer kastet ved manglende lønnsart | Tidlig `return` som var korrekt etter egen logikk | Koden gjorde det den var skrevet for |

🔴 **Lærdommen: flere enhetstester ville ikke hjulpet.** Alle tre var **atferd**, synlig kun
når en enhet eller et menneske rørte flaten. Nettet må derfor legges et annet sted enn der vi
instinktivt legger det.

## Målt utgangspunkt (2026-08-31)

| Pakke | Testfiler | Kjøres i CI? |
|---|---|---|
| `apps/api` | **29** | 🔴 **NEI — pakken mangler `test`-script** |
| `apps/web` | 29 | ✅ |
| `packages/shared` | 25 | ✅ |
| `packages/pdf` | 10 | ✅ |
| **`apps/mobile`** | **0** | — |
| E2E (Playwright, `tests/e2e/`) | 10 filer | ❌ ikke i CI |

**To funn:** 29 API-tester er skrevet og har aldri kjørt automatisk — de mangler ett linjes
script. Og mobilen, der alle tre regresjonene skjedde, har null dekning.

---

## Lag 1 — gjør feilklassen ULOVLIG (eneste som garanterer)

**Prinsipp:** når vi finner en feilklasse, spør *«kan denne gjøres umulig?»* før
*«kan vi teste for den?»*.

**Presedens, samme dag:** `no-restricted-imports` som forbyr `SafeAreaView` i `apps/mobile`
(`.eslintrc.json`, levert i `b852c2ea`). Den kan ikke glemmes, og den virker for enhver
fremtidig agent — inkludert cowork, som innførte feilen.

**Dette er det eneste laget som fjerner en feilklasse permanent.** De tre andre reduserer
sannsynlighet.

🔴 **Kjent hull:** lint-scriptet er `eslint src/` — `apps/mobile/app/` er **ikke** dekket.
Fire modalfiler der er dermed ubeskyttet. Utvides til `eslint src/ app/` i egen runde;
utvidelsen flagger også legitime skjerm-røtter, som må ryddes eller unntas bevisst.

### Kandidater til nye regler (ikke besluttet)

- `<Modal>` uten `presentationStyle` → tvungen eksplisitt verdi. iOS-defaulten er
  `fullScreen`, og det var **den skjulte defaulten** som gjorde `TekstfeltObjekt` rammet uten
  å se sånn ut i koden.
- Direkte `prisma.<modell>.count()` i slettevakter uten at både medlemmer og avhengige rader
  telles — vanskeligere å uttrykke som lint, men verdt å vurdere som kodegjennomgangs-punkt.

---

## Lag 2 — simulator-røyktest FØR hvert EAS-bygg (største gevinst)

**Oppsettet finnes og er bevist.** Simulator-Opus målte 2026-08-31 insets til pikselen,
skilte fullScreen fra pageSheet, og svarte på fire spørsmål med tall — uten et eneste
skjermbilde i kontekst.

🔴 **Alle tre av dagens regresjoner ville blitt fanget her, før bygget.**

**Form:** fast flyt-liste, kjørt av simulator-agent, rapportert som **tekst**
(`idb ui describe-all` + Metro-logg). Skjermbilde kun når spørsmålet er visuelt
(SAMARBEIDSREGLER § 10c — én skjermbilde-tung runde brukte 46 % av ukebudsjettet).

### Røykliste v1 — ti flyter (forslag, justeres etter første kjøring)

1. Logg inn → dashbord laster
2. Åpne sjekkliste → fyll et tekstfelt → «Ferdig» er truffbar → verdien består
3. Repeater: legg til rad → sett tegningsposisjon → bekreft → kom ut uten app-drap
4. Legg kommentar + bilde på et felt
5. Forstørr et bilde → lukk igjen
6. Opprett nytt dokument fra plussknappen
7. Åpne en oppgave → send til neste ledd
8. HMS-registrering → opprett og lagre
9. Timer: åpne dagsseddel → legg til rad → lagre
10. Drep appen midt i utfylling → start → utkastet består

**Per flyt rapporteres:** nådde jeg målet, hvor mange trykk, og — for hver skjerm med
kontroller øverst — er de truffbare (`idb ui tap`, ikke øyemål).

**Gate:** listen kjøres **før** `eas build`, ikke etter. Ett funn = bygget utsettes.

---

## Lag 3 — slå på det vi allerede har (billigst)

1. **`apps/api` mangler `test`-script.** Legg til `"test": "vitest run"` → 29 tester begynner
   å gate i CI. 🔴 **Forventes å avdekke røde tester** som ingen har sett — det er poenget,
   men det er en egen ryddejobb, ikke en drive-by.
2. **🟢 `apps/mobile` har nå test-runner (vitest) — REALISERT 2026-09-16.** vitest lagt til
   (`apps/mobile/vitest.config.ts`, `"test": "vitest run"`), automatisk med i `pnpm test`
   (turbo) fra ROT → kjører i CI i samme jobb. Første fotfester: `dagsegment.test.ts` (6 rene
   `splittVedMidnatt`/`kappGlemtDagSlutt`) + `migreringer.test.ts` (3, offline-DB mot EKTE
   SQLite via sql.js). 🟢 **«Stille tomhet» krav (c) er nå oppfylt på mobil:** den faktiske
   migrerings-SQL-en kjører mot en ekte SQLite-motor (sql.js WASM — kun expo-sqlite-BINDINGEN
   er byttet, ikke SQLite selv), og en rad med tom identitetskolonne avvises av ekte NOT NULL.
   Mobil-unntaket i CLAUDE.md kan dermed fjernes (cowork). Valg: sql.js, ikke `better-sqlite3`
   (native/ABI-følsom, node25-lokal↔node20-CI), ikke jest-expo (andre runner, RN-transforms
   ikke nødvendig for DB-lag+utils). **Bred mobildekning er eget spor.**
3. **🟢 E2E DEL 1 REALISERT 2026-09-16 — efemært miljø i CI, `01-login` grønn.** Sju spec-er
   (`tests/e2e/tests/`, 8 test-case) dekker hele dokumentflyten (pilotflyten A.Markussen bruker).
   Suiten er en røyktest mot et **kjørende** miljø, autentisert via `DEV_LOGIN_SECRET`, og
   `global-setup.ts` muterer DB-en (lager/sletter E2E-dokumenter, admin-sweep). Den kan derfor
   ALDRI kjøre mot delt `sitedoc_test`. **Løsning (egen `e2e`-jobb, parallell med `test`):** per
   kjøring reises et efemært miljø — engangs-pgvector → `migrate deploy` → `seed-testbrukere.ts`
   + `seed-e2e-flyt.ts` (begge idempotente/kjørbare, målt) → api (tsx) + web (`next start`) →
   helsesjekk med hard timeout → `playwright test tests/01-login.spec.ts`. Bevist lokalt
   ende-til-ende FØR CI.

   🟢 **DEV_LOGIN_SECRET-funn:** i et efemært, isolert miljø leser api OG e2e-klienten SAMME
   `DEV_LOGIN_SECRET` — en **jobb-generert** verdi (`openssl rand`) holder. Ingen GitHub-secret
   nødvendig for del 1 (ingenting lagret, ingenting å lekke). Samme for `AUTH_SECRET` +
   `FIL_SIGNING_SECRET` (web krever de to i `NODE_ENV=production` via `instrumentation.ts`).
   dev-login-whitelisten (`apps/api/src/routes/dev-login.ts`) er **hardkodet, ikke miljøavhengig**
   → de tre testbrukerne slipper alltid gjennom i et friskt miljø.

   🟡 **DEL 2/3 (2026-09-16):** de seks andre spec-ene var DRIFTET (aldri validert siden e2e
   aldri kjørte i CI). **De-drift (del 3) — resultat: 01–04 + 05-godkjenn grønne, 05-besvar/06/07
   holdt ute for produkt-avgjørelse.**

   🟢 **Fikset (grønne 01–04, 05-godkjenn):**
   - **02:** `getByRole("button")` → `getByRole("option")` (OpprettMalVelger rendrer mal som
     `role="option"` i listbox, refaktor `f567d339` 2026-08-04).
   - **04:** `seed-e2e-flyt.ts` satte ALLE flyt-medlemmer på `steg:1` → `byggLedd` kollapset til
     én ledd-boks mens slåOppFlyt teller tre roller. Fikset til distinkt steg 1/2/3 (samme
     seed-matcher-ikke-produksjon-klasse som ProjectOrganization-gapet).
   - **07 (delvis):** status-sti `in_progress` → `approved` (in_progress er HELT kollapset,
     fabel-vedtak 2026-08-02 — `responded→in_progress` fjernet).
   - **Sticky-header + nedtrekk:** `handling-*`-knapper er tvetydige (primær + meny + mobil) og
     dekkes av den sticky skjerm-headeren (z-10) etter auto-scroll. Ny `klikkFlythandling`-helper
     (`lib/fixtures.ts`) åpner «Flere handlinger»-nedtrekket ved behov og kaller `el.click()`
     direkte på DOM-noden (`force:true` ville truffet overlayet, ikke knappen).
   - **`seed-testbrukere.ts`:** `ProjectOrganization`-join-raden lagt til → prosjektet er ikke
     lenger prøveprosjekt (maks 10). ⚠️ `seed-e2e-pilot.ts` + `seed-agent-mobil-test.ts` bygger på
     samme prosjekt (var også trial-begrenset) — meldt, ikke rørt her.
   - **`settStatus` (lib/flyt.ts):** sender alltid `kommentar` (godkjenn/gjenåpne krever begrunnelse).

   🔴 **HOLDT UTE — krever produkt-semantikk-avgjørelse (ikke gjettet):**
   - **05-besvar:** `avledStatus` (flytPosisjon.ts) gir `responded` KUN ved `retning="tilbake"`.
     Når utfører besvarer FRAMOVER blir badge `received` («Hos godkjenner»). Spec-ens
     `data-status="responded"` sjekker en verdi UI-modellen ikke lenger produserer for denne flyten.
   - **06-videresend:** `handling-videresend-nedtrekk` er ikke synlig for firma-admin på received
     (rolle-/synlighets-gating endret) — trenger avklaring på om videresend-tilbudet er flyttet.
   - **07-gjenapne:** gjenåpne `closed→draft` viser `received` i badge (samme avledStatus-modell).
   **Neste spor:** avklar forventet badge-utfall for besvar/gjenåpne i dagens modell, oppdater de
   tre assertionene, slå på 05–07 i CI.

   🔴 **DB-garanti-funn (meldt, kontrollplan eier skjemaet):** `Project.primaryOrganizationId` og
   `ProjectOrganization`-raden er to UAVHENGIGE kilder UTEN constraint/trigger — de KAN divergere
   (nettopp det seed-testbrukere gjorde). Trial-sjekken (`erStandaloneProsjekt`) bruker kun
   join-raden. Vurder en garanti; ikke bygget her.

   🟡 **Blokkerings-anbefaling (endelig):** ikke blokker; kjør kun på PR (ikke hver push); rød e2e
   omgås av merge-tre-push (`git push origin HEAD:develop`). Vurder blokkering FØRST når alle sju
   er grønne og stabile over mange kjøringer.

---

## 🔴 HULL I NETTET — håndskrevet migrerings-SQL er ugatet (målt 2026-09-08)

**Hendelse:** `20260908120000_reise_terskel_km` skrev `ALTER TABLE "organization_setting"`.
Modellen har `@@map("organization_settings")` — **flertall**. `ERROR 42P01`.

🔴 **Migreringen feilet på test 2026-09-07 kl. 23:23 UTC og sto feilet i over ni timer**, gjennom
en fullført deploy, en OTA og flere gater. Andre forsøk ga `P3009` — **test-DB-en var blokkert**,
og ingen visste det. `/version` svarte riktig hash, appen startet, kolonnene fantes bare ikke.

### Hvorfor ingen av de tre lagene kunne fanget det

| Lag | Hvorfor det ikke fanger | |
|---|---|---|
| **1 — lint** | Leser TypeScript, ikke SQL | ❌ |
| **2 — simulator-røykliste** | Kjører mot et allerede deployet miljø | ❌ |
| **3 — api-tester** | Kjører mot testfixtures, ikke mot en migrert DB | ❌ |
| *`prisma generate` ×4* | Leser `schema.prisma`, **aldri migrerings-SQL** | ❌ |

🔴 **Alle fire pakker genererte, alle fire testsuiter var grønne, web build var grønn — og
migreringen var ødelagt.** Agentens gate var korrekt utført og kunne ikke se feilen.

### 🟢 Klassen ble målt, og den er ellers ren

dokgen sammenlignet **11 migreringer** fra siste 14 dager mot **107 `@@map`-verdier**, mekanisk:
`ALTER TABLE` · `CREATE TABLE` · `REFERENCES` · `INDEX … ON`. **0 andre avvik.**
🟢 `db-timer` bruker skjema-kvalifisert `"timer"."eksport_oppsett"` korrekt.
**Dette var en isolert skrivefeil, ikke et mønster.**

### 🟢 LAG 5 — REALISERT 2026-09-15: engangs-Postgres i CI (integrasjonstestene)

`.github/workflows/ci.yml` har nå en Postgres-service-container, kjører
`prisma migrate deploy` (kun `@sitedoc/db` — integrasjonstestene rører bare kjernen) og
deretter `pnpm test:integration` (17 tester i 4 filer) mot den. Engangs-DB, rives med
jobben — aldri `sitedoc_test`/`sitedoc`.

🟢 **Da feiler en ødelagt migrering i CI på en PR, ikke på test klokka 23:23** — og migreringen
`20260908120000`-klassen (feil `@@map`) ville blitt fanget her, fordi `migrate deploy` kjører
det faktiske SQL-et mot en ekte DB.

⚠️ **Image = `pgvector/pgvector:pg16`, ikke ren `postgres:16`:** migrering `20260331120000`
kjører `CREATE EXTENSION vector` (AI-søk-embeddings). Verifisert lokalt 2026-09-15 at ren
postgres feiler `migrate deploy` på nettopp den utvidelsen.

🟢 **Kostnad målt 2026-09-15:** før ≈ 1m55s–2m05s (siste fem develop-kjøringer), etter tillegg
av container-oppstart + 197 migreringer + 17 tester. Godt under ti-minutters-taket → ingen
jobb-oppdeling nødvendig ennå.

🔴 **Dette lukker også et konkret hull:** `firmaarkiv-unik-indeks.integration.test.ts` ble
skrevet i runde 95 for «stille tomhet»-krav (b) (DB-garanti mot duplikat), men var ekskludert
fra `pnpm test` og hadde aldri kjørt. Kvitteringen «grønn» var aldri sann før nå.

### 🟢 «Stille tomhet»-rekvittering 2026-09-16: tre mock-kvitteringer gjort ekte (integrasjon 17→33)

Tre migreringer var kvittert mot CLAUDE.md § «Stille tomhet» krav (c) — *«en test som FEILER
når feltet er tomt»* — men kun med **mockede** tester, som måler vakten, ikke dataen. Nå har
de hver sin integrasjonstest mot engangs-Postgres (mockene BLIR STÅENDE — de tester andre ting):

- **`20260908140000_dokumentnummer_unik`** → `dokumentnummer-unik.integration.test.ts` (6): begge
  unike indekser (`checklists`/`tasks` `(template_id, number)`) biter (P2002); samme nummer under
  ULIK mal er lovlig (indeksen er riktig avgrenset); **`number` er nullable** (maler uten `prefix`
  får aldri nummer) → flere NULL kolliderer ikke (NULLS DISTINCT). En mock kan ikke skille en
  riktig avgrenset indeks fra en for bred — det krever ekte Postgres-unikhet.
- **`20260910130000_gruppe_systemnokkel`** → `gruppe-systemnokkel.integration.test.ts` (5): den
  ALVORLIGSTE (saken som skapte regelen). `sikreHmsGruppe` bruker `systemNokkel`, ikke domener
  (en bred `["bygg","hms","kvalitet"]`-gruppe tilfredsstiller ikke); en umarkert HMS-gruppe
  (`systemNokkel=NULL`) detekteres IKKE (krav c i renform); idempotent. 🟢 **DB-garanti bekreftet:**
  den partielle unik-indeksen `(project_id, system_nokkel) WHERE NOT NULL` gjør to
  `system_nokkel='hms'` per prosjekt UMULIG (P2002) — garantien hviler IKKE på backfillen alene.
- **`20260914120000_bibliotekmal_objekttabell`** → `bibliotekmal-objekttabell.integration.test.ts`
  (5): heading-rader har FAKTISK tom `config` i JSONB (ikke `{zone}`, ikke NULL); `translations`
  lagres som `{}` (ikke NULL); lån via rad-veien (`kopierObjektTre`) er verbatim mot ekte data;
  rad-skrivingen er idempotent via en NOT EXISTS-vakt som speiler migreringen og seedens
  `opprettMalHvisMangler` (den manuelle `ROLLBACK`-en gjort til en test). Vakten defineres i
  testfila, ikke importeres fra `packages/db/prisma` — en kryss-pakke-import ville tatt seed-fila
  inn i api-`tsc`-bygget (utenfor rootDir) og gjort `pnpm test` rød.

🔴 **Negativ kontroll (krav 4) kjørt lokalt mot engangs-Postgres 2026-09-16** for alle tre: hver
brutt, sett rød, tilbakestilt. Integrasjonstallet i CI stiger fra **17 → 33** (+16).

🔴 **Samme form som de tre andre stille feilene i samme døgn:** en Entra-secret som gikk ut uten
varsel, containere som ikke restarter uten varsel, og nå en migrering som feiler mens deployen ser
vellykket ut. **Fellesnevneren er ikke at feilene er like — det er at ingen av dem sa fra.**

## Lag 4 — det vi IKKE gjør

**Ingen skriftlig funksjonsliste som eget dokument.** Den blir foreldet og lest av ingen.
Røyklisten i lag 2 **er** funksjonslisten — forskjellen er at den kjøres.

---

## Rekkefølge

| # | Tiltak | Kostnad | Fanger |
|---|---|---|---|
| 1 | `test`-script i `apps/api` | minutter | logikkfeil i 29 eksisterende tester |
| 2 | Røykliste v1 + fast kjøring før EAS | én runde å skrive, ~20 min per bygg | **alle tre av dagens regresjoner** |
| 3 | Lint-scope utvidet til `app/` | én runde | fremtidige `SafeAreaView`-i-modal |
| 4 | Nye lint-regler når feilklasser finnes | løpende | permanent, per klasse |

## Ærlig begrensning

**Ingenting av dette hindrer at en fiks bryter noe i et hjørne ingen har tenkt på.** Lag 1 er
øverst nettopp fordi det er det eneste som fjerner en feilklasse i stedet for å redusere
sannsynligheten for at den slipper gjennom.

Røyklisten dekker ti flyter av flere hundre. Den er valgt fordi de ti er de piloten faktisk
bruker — ikke fordi de er nok.
