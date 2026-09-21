---
name: MAL-METODE
description: Arbeidsmetode for oppbygging av sjekklistemaler fra NS 3420 — roller, kilder, kvalitetsprinsipper
status: 🔴 STYRENDE for mal-bygging
sist_verifisert_mot_kode: 2026-09-11
---

# MAL-METODE — arbeidsmetode for oppbygging av sjekklistemaler (NS 3420)

**Referansenavn: MAL-METODE.** Målsti i repo: `docs/claude/MAL-METODE.md`. Leses av fabel, cowork og mal-Opus ved oppstart/`/clear`/compact når arbeidet gjelder sjekklistemaler. Gjelder KUN mal-bygging — ikke øvrig redesign.

## 1. Hva en god mal er (Kenneth 2026-09-11 — styrer alle valg)

En KS-sjekkliste skal hjelpe en arbeider med teknisk informasjon om kravene, og etterlate dokumentasjon som viser hva som er levert og bekrefter at kravene er fulgt.

- **Effektiv utfylling.** Minst mulig tekst å skrive. Svar med predefinerte alternativer (trafikklys, enkeltvalg) så langt det lar seg gjøre; fritekst er unntaket. Kommentar/vedlegg/tegning finnes allerede per felt — malen skal ikke duplisere dem.
- **Informativ om kravene.** Hjelpetekst per felt gir det tekniske kravet der arbeideren står (tall og toleranser), **formulert som vårt eget krav — uten tabell- og punktkoder fra standarden** (§7b, Kenneth 2026-09-18). Der kravene er prosjektspesifikke, peker hjelpeteksten til prosjektbeskrivelsen/posten. Aldri påstå normkrav som ikke finnes i normen.
- **Enklest mulig dokumentasjonsprinsipp.** Bilder er primærbevis — hjelpetekster ber eksplisitt om foto der bildet beviser leveransen. Egne felt sier HVA som er levert (type/materiale) — ellers viser dokumentet bare at «noe» ble gjort.
- **Strukturert og oversiktlig.** Feltene grupperes under fase-overskrifter (H-felt): «Kontroll FØR utførelse» / «Kontroll UNDER utførelse» / «Kontroll ETTER utførelse». Seksjonene kollapser og viser teller («0 av 3») — viktig fordi sjekklister fylles ut over tid. ETTER-fasen bærer konklusjonen: krav oppfylt + dokumentasjonskrav levert.
- **Tallfelt kun når ett veldefinert tall dokumenterer leveransen** (Kenneth 2026-09-11, KB2-testen). Feltnavnet skal si hvilken måling som føres (minste/største). Krav mot en flate som varierer (fall, planhet) besvares med samsvar — trafikklys eller enkeltvalg per kravnivå — og målt verdi/sted hører i kommentaren. Min/maks-grenser på tallfelt skal aldri blokkere registrering av et avvik.
- **Hele felttype-paletten er tilgjengelig — velges etter behov** (Kenneth 2026-09-12; paletten er ikke låst til valg/trafikklys/desimal). Typene rendreren støtter: `list_single` (enkeltvalg), `list_multi` (flervalg), `traffic_light`, `integer` (heltall), `decimal`, `date`, `date_time`. Predefinerte valg framfor fritekst står — nå med flere predefinerte former. Fabel velger felttype per felt i ordren; mal-Opus bygger med tilsvarende helper.
- **Desimalpresisjon etter enhet — byggebransje-praksis** (Kenneth 2026-09-12): flere desimaler enn enheten krever skal ikke brukes. **Enhets-standard (tak/utgangspunkt):** mm → 0 desimaler (heltall `integer`, eller `decimal { desimaler: 0 }`) · cm → 1 desimal (`decimal { desimaler: 1 }`) · m og større → 2 desimaler (`decimal { desimaler: 2 }`). «Ingen måler 1,28 % / 1,28 cm.» **Men presisjonen følger hva som FAKTISK måles, ikke bare enheten** — måles størrelsen i grove/standard steg, brukes færre (eller 0) desimaler selv om enheten tilsier flere. Eksempel: lagtykkelse vekstjord måles i hele/standard cm (10/15/20/40) → **heltall (`integer`)**, ikke `decimal` med 1 desimal.

## 1b. Felles regler for design og mal-Opus — lært 17.–18.09.2026 (STYRENDE)

Design (ordrer og innholdsgate) og mal-Opus (bygging) jobber etter samme regler. De står her, ikke i noens minne.

1. **Sjekklisten dokumenterer utført arbeid** — at jobben er gjort og objektet er klart for overlevering. Kontroll
   som forutsetter at tid har gått (ettårsbefaring, sesongkontroll) er en annen arbeidsoppgave og hører ikke hjemme
   i malen. Bindende vedtak: `domene-arbeidsflyt.md` § «en sjekkliste dokumenterer utført arbeid» (Kenneth 2026-09-18).
2. **Samsvar, ikke tallfelt, på varierende flate og intervaller** (§1): fall, planhet, linjeføring, tykkelse-intervall,
   fugebredde-intervall → trafikklys eller enkeltvalg per kravnivå. Tallfelt kun for én veldefinert måling
   («Største …», «Minste …»), aldri med grenser som blokkerer registrering av avvik.
3. **Egne krav, ikke standarden** (§7b): kode + egne ord i navnet, ingen tabell-/punktkoder i hjelpetekster, én linje
   «Faglig grunnlag» i beskrivelsen, aldri (nesten-)ordrett normtekst.
4. **Revisjons-SQL genereres, skrives aldri for hånd.** Fra KD2: én generell generator
   (`packages/db/prisma/generer-mal-sql.ts <REF>`) lager SQL fra mal-konstanten — **revisjon** hvis referansen finnes
   i arkivet (§6a: versjon +1, DELETE/INSERT objekt-rader), **ny mal** hvis den ikke finnes (INSERT med versjon 1).
   Begge skriver ut hele malinnholdet før `COMMIT`.
5. 🔴 **Revisjons-SQL kjøres ÉN gang mot test.** Kjøres den på nytt, øker versjonen igjen og objekt-radene byttes ut
   igjen. En generert fil som ligger klar etter kjøring, skal merkes eller slettes. (KD1: `kd1-test.sql` ble kjørt
   18.09 → version 2. Den skal ikke kjøres igjen.)
6. **Designgaten kjøres på tekstbevis** (§3, §6a) — utskriften fra SQL-kjøringen. Ingen skjermbilder av maler.
7. **Gate-ord** (SAMARBEIDSREGLER § design): «Innhold godkjent» slipper ikke videre. Bare «Designgatet – klar for
   merge» gjør det. Mal-Opus kan committe og pushe egen branch når som helst.
8. **Ordren skiller obligatorisk fra valgfritt.** Mangler et normfaktum i ordren: stopp og meld, gjett aldri.

## 2. Kilder — hvor NS 3420-PDF-ene ligger

`kilder/ns3420/` i hovedtreet (Del 1, A, F, G, J, K, L, S, U, W, Z, ZK). Mappen er **gitignorert** (`.gitignore:78 kilder/*`) — agenter i worktrees ser den IKKE, og lisensiert normtekst skal ikke kopieres ut i worktrees.

**Regel:** hver mal-ordre fra fabel er SELVBÆRENDE — alle normutledede fakta (sidetall, poster, tallkrav, tabellverdier) står i ordren. Mal-Opus gjetter aldri på normkrav; mangler et faktum → stopp og meld tilbake.

*Historisk — gjaldt Fabel, som ikke hadde skrivetilgang. Rollen heter nå design og følger § design — rollen etter Fabel (2026-09-18).*

**Hvor fabels ordrer lander (viktig etter compact/`/clear`):** ferdige ordrer fra fabel legges i **`~/Documents/Programmering/SiteDoc/Fra fabel/`** — i hovedtreet, utenfor worktrees — i daterte undermapper, f.eks. `til-repo-<dato-tid>/docs/redesign/ordre-<ref>-fabel-<dato>.md` (ev. medfølgende `docs/claude/MAL-METODE.md`-tillegg fra fabel). Kenneth relayer stien; mal-Opus henter ordren **der**, ikke fra worktreet. Når Kenneth sier «se meldingen fra fabel», er det denne plasseringen.

## 3. Hvem gjør hva, når (regel)

Flyt per mal — **én mal om gangen**, neste ordre skrives først når forrige er gatet:

1. **fabel** leser normkapitlet, måler dagens mal i `packages/db/prisma/seed-bibliotek.ts`, og skriver en selvbærende ordre (funn + full feltspesifikasjon + DoD). Ordren absorberer ev. rader for malen fra MK-konverteringslista (§4).
2. **Kenneth** relayer ordren til mal-Opus (fabel snakker aldri direkte med cowork/mal-Opus).
   *Historisk — gjaldt Fabel, som ikke hadde skrivetilgang. Rollen heter nå design og følger § design — rollen etter Fabel (2026-09-18).*
3. **mal-Opus** bygger i `seed-bibliotek.ts` iht. ordren, med eksisterende hjelpefunksjoner (`valg`/`trafikklys`/`desimal`/`felt`) — aldri hardkodet JSON. Kjører seed mot lokal DB, verifiserer idempotent re-kjøring, og leverer **tekstbevis** fra revisjons-SQL-en (§6a — fullt malinnhold skrevet ut av kontroll-SELECT-en). Avvik fra ordren meldes eksplisitt.
4. **fabel** gater INNHOLD mot ordren (feltene, hjelpetekstene, fasene, utfyllingsopplevelsen). Godkjent → melder «klar for commit».
5. **cowork** gater TEKNISKE husregler før merge — og rører aldri innholdet: MalBygger-objekter, aldri hardkodet (Kenneth-vedtak 2026-09-05); `verifisert: false` eksplisitt + prod-gate urørt; seed-oppførsel (**kun opprett** via `opprettMalHvisMangler`, aldri update/`deleteMany`); i18n på nye synlige strenger. Cowork eier merge-timing og deploy alene.

🔴 **Tekstbevis erstatter skjermbilder (Kenneth 2026-09-18).** Det designgaten kontrollerer er tekst: fase-overskrifter, feltnavn, felttype, alternativer i rekkefølge, hjelpetekster og versjon. Revisjons-SQL-en skriver ut nøyaktig dette fra `sitedoc_test` (§6a), Kenneth limer utskriften til design-rollen, og gaten kjøres på den. Om malen faktisk vises, ser Kenneth selv med ett blikk i et testprosjekt. **Ingen agent skal jakte på skjermbilder av en mal** — mal-Opus har verken innlogget nettleser eller simulator.

## 4. Koordinering med MK-konverteringslista

Når en mal revideres, tar ordren stilling til malens rader i MK C-konverteringslista (hva hver rad blir i det nye oppsettet), og radene strykes fra lista når malen er gatet. Aldri dobbel konvertering av samme felt.

## 5. Rekkefølge og status

Kapittel K først, så F: KA7 → KB2 → KB4 → KB6 → KC3.1 → KD1 → **KD2 (ny) → KM2 (ny)** → (FB2, FC1, FD2, FE1, FB4, FD3). *(KD2/KM2 foran Del F: Kenneth 2026-09-18. Status per mal: MAL-PLAN.)*

🔴 **Autoritativ «hva finnes i biblioteket» måles i DB, ikke her** (Kenneth 2026-09-12): `select referanse, navn, verifisert from bibliotek_maler order by referanse`. Tabellen under er kun en lettvekts oversikt over rekkefølge og gate-runder — ikke et vedlikeholdt register. Er du i tvil om hva som er bygget, spør databasen.

| Mal | Ordre | Bygget | Gatet |
|---|---|---|---|
| KA7 | ordre-ka7-revisjon-fabel-2026-09-11.md (v2, absorberer MK C :166–:168) | ✓ `feat/mal-ka7-revisjon` `2a1602a8` | ✓ fabel 2026-09-11 → cowork teknisk gate + merge |
| KB2 | ordre-kb2-revisjon-fabel + v2 (felt 4/7/8, kravsvar mot varierende flate) | ✓ `feat/mal-kb2-revisjon` `1372b93f` | ✓ fabel 2026-09-12 → cowork teknisk gate + merge |
| øvrige | – | – | – |

Merknad til FE1 (fra cowork, rutes inn når FE1 kommer opp): hjelpetekstene på «Gjenfylling lagvis» (:516) og varselbånd (:529) bærer metodekrav («maks 30 cm», «30 cm over») i rene trafikklys — fabel vurderer feltform mot normen.

## 6. Redigere en eksisterende mal — steg for steg (mal-Opus)

Konkret løype, målt mot KA7-revisjonen 2026-09-11. **Én mal om gangen, kun etter en selvbærende ordre fra fabel.**

1. **Branch fra develop-tippen:** `git fetch -q origin && git checkout -b feat/mal-<ref>-revisjon origin/develop`. Verifiser at tippen er den ordren forventer (STOPP hvis eldre — da mangler ordre/metode i treet).
2. **Finn malens blokk** i `packages/db/prisma/seed-bibliotek.ts` — objektet i `maler`-arrayet med riktig `referanse`. **Rør ingenting utenfor denne blokken** (elleve andre maler deler fila).
3. **Rediger med hjelpefunksjonene** `valg` / `trafikklys` / `desimal`, og `felt(label, type, fase, config)` for øvrige typer — **aldri hardkodet JSON** (Kenneth-vedtak 2026-09-05). Full felttype-palett + presisjonsregel: §1. Navngitte helpers for nye typer (`heltall`=`integer`, `flervalg`=`list_multi`, `dato`=`date`, `datotid`=`date_time`) legges til i den mal-branchen som **først bruker** typen — ikke som ubrukt kode (ellers feiler `no-unused-vars`); utvid samtidig `FeltDef.type`-unionen. Config: `integer` bruker `{ enhet?, min?, maks? }`, `list_multi` `{ options, helpText? }`, `date`/`date_time` `{ helpText? }`. `fase`-strengen (`"FØR"`/`"UNDER"`/`"ETTER"`) styrer fase-gruppering; overskriftene «Kontroll FØR/UNDER/ETTER utførelse» genereres av lån-mutasjonen (`apps/api/src/routes/bibliotek.ts` + `firmamal.ts`), ikke av seeden. `verifisert: false` arves fra den sentrale seed-loopen — **rør ikke prod-gaten** (`erProd && !verifisert → continue`).
4. **Seed mot lokal DB, to ganger** (idempotens):
   ```sh
   DATABASE_URL="postgresql://<bruker>@localhost:5432/sitedoc" \
     pnpm --filter @sitedoc/db exec tsx prisma/seed-bibliotek.ts
   ```
   Seeden **oppretter kun** (`opprettMalHvisMangler`, aldri update/`deleteMany`), så andre kjøring per definisjon ikke endrer noe — den melder «N fantes fra før og ble IKKE rørt». ⚠️ **Bygger du en REVISJON av en mal som allerede finnes i din lokale DB, overskriver seeden den IKKE** — slett den ene raden først (`delete from bibliotek_maler where referanse='<REF>'`) eller start fra tom DB, ellers seeder du og ser fortsatt gammelt innhold.
5. **Gate-bygg** (les baseline på develop-tippen selv; seed-data er ikke dekket av tester → alle skal stå stille): `pnpm install` → `prisma generate` for `db`/`db-timer`/`db-maskin`/`db-varelager` → `pnpm --filter @sitedoc/web build` → `pnpm --filter @sitedoc/mobile typecheck` → `pnpm test`.
6. **Rebase rett før push**, verifiser at diffen mot develop er **kun** `seed-bibliotek.ts`, og push egen branch: `git rebase origin/develop && git diff --stat origin/develop..HEAD && git push -u origin feat/mal-<ref>-revisjon`. **Aldri `develop`** — cowork merger etter fabels innholdsgate.
7. **Tekstbevis** (obligatorisk før gate): lever revisjons-SQL-en (§6a) med versjonsøkning og full utskrift. Kenneth kjører og limer utskriften til design-rollen. *(Skjermbilder utgikk 2026-09-18.)*
8. **Meld ÉTT svar** til Kenneth (branch+hash · gate-tall målt selv · idempotens · SQL-enlinjerne · hvor fase-overskriften kom fra · avvik fra ordren). «Klar for commit» sier fabel, ikke mal-Opus.

### 6a. Revidere en mal i arkivet via målrettet UPDATE — den normale revisjonsveien

> 🔴 **ENDRET SIDEN MIGRERING `20260914120000_bibliotekmal_objekttabell` (presisert 2026-09-18, meldt av mal-Opus ved KD1):**
> innholdet bor nå i **`bibliotek_mal_objekter`**, ikke i `mal_innhold`. Seeden fryser `mal_innhold` til `[]`
> (`seed-bibliotek.ts` ~:122), og både forhåndsvisning og import leser kun objekt-radene
> (`apps/api/src/routes/bibliotek.ts` :87 og :162). **En `UPDATE … mal_innhold` er en død skrivning som aldri
> vises i UI.**
>
> **Revisjons-SQL-en er derfor:** `UPDATE bibliotek_maler` (kun metadata: `navn`, `beskrivelse`, `verifisert=false`)
> + `DELETE FROM bibliotek_mal_objekter WHERE template_id = <malens id>` + `INSERT` av de nye radene —
> generert **byte-eksakt fra mal-konstanten via `byggBibliotekRader`**, ikke skrevet for hånd. Mønster:
> `kd1-test.sql` (2026-09-18). DELETE-en er trygg: ingen tabell peker på en bibliotek-objekt-id
> (firmamaler er uavhengige kopier), og cascade gjelder kun malens egne barn-rader.
>
> 🔴 **To krav i hver revisjons-SQL (Kenneth 2026-09-18):**
> 1. **Versjonsstempel:** `version = version + 1` i metadata-UPDATE-en. Ellers ser verken Kenneth eller firmaene at en
>    ny versjon er ute. (`versjon`-tekstkolonnen røres ikke uten egen beslutning.)
>    ⚠️ **Felle — to felt, én bokstav:** `BibliotekMal` har `versjon String @default("1.0")` (schema:2313) OG
>    `version Int @default(1)` (schema:2320). Badgen «X versjoner bak» leser **`version`** (Int) — `versjonerBak`
>    i `MalListe.tsx:654` / `MalBygger.tsx:251`. Tekstkolonnen `versjon` skrives aldri (bevist `git log -S`) og er
>    død for versjonsvisning. Øker SQL-en feil felt, skjer **ingenting synlig**, og feilen oppdages ikke før noen
>    lurer på hvorfor badgen står stille.
> 2. **Full utskrift før `COMMIT`:** `\x on`, så én SELECT av malens metadata (`referanse, navn, beskrivelse, version,
>    verifisert`) og én av alle objekt-radene i rekkefølge (`sort_order, type, label, config->'options',
>    config->>'helpText'`). Utskriften er tekstbeviset designgaten kjøres på.
>
> Leveringsveien (`scp` → `docker cp` → `psql -f`, tre enlinjere) under er uendret. Teksten under om
> «`mal_innhold`» og «kilde til innholdet» gjelder bare maler revidert før 14.09.

🔴 **Seeden oppdaterer ikke lenger (§6b), og er heller ikke del av deploy.** Verken seed, `deploy-test.sh` eller migreringene rører en eksisterende `bibliotek_maler`-rad. Skal en **revidert** mal inn i et arkiv (test for web-bevis, eller generelt), er den målrettede UPDATE-en veien — **ikke et unntak for bevis, men den normale revisjonsveien inntil `/admin/bibliotek` (retteveien i UI) finnes** (målt 2026-09-11, KA7).

Kun ÉN mal, uten å røre de 11 andre: generér en målrettet `UPDATE bibliotek_maler … WHERE referanse='<REF>'` fra den **lokalt seedede** raden (byte-eksakt speiling av koden; sett `verifisert=false`), og få Kenneth til å kjøre den mot test.

- **Kilde til innholdet:** `psql -h localhost -d sitedoc -tAc "select mal_innhold::text from bibliotek_maler where referanse='<REF>'"` (+ `navn`/`beskrivelse`).
- **Test-DB:** arkivet ligger i den delte `postgres`-containeren på **server-ny** (rolle `sitedoc`, db `sitedoc_test`; container heter eksakt `postgres` — jf. DOCKER-NOTES).
- 🔴 **PRIMÆRVEI — `.sql`-fil + `psql -f` (Kenneth kjører, tre SEPARATE én-linjes kommandoer):** skriv SQL-en til en `<fil>.sql` (pakket i `BEGIN; … COMMIT;` med en `SELECT referanse, verifisert, jsonb_array_length(mal_innhold), navn`-bekreftelse; test med `psql -f` lokalt først). Lever nøyaktig disse — Kenneth limer ÉN OG ÉN, venter til hver er ferdig:
  ```
  scp "<abs-sti>/<fil>.sql" server-ny:/tmp/<fil>.sql
  ```
  ```
  ssh -t server-ny "sudo docker cp /tmp/<fil>.sql postgres:/tmp/<fil>.sql"
  ```
  ```
  ssh -t server-ny "sudo docker exec postgres psql -U sitedoc -d sitedoc_test -f/tmp/<fil>.sql"
  ```
  Fila kjøres atomisk fra disk — umulig å droppe innhold. Bekreftelse: `UPDATE 1` + rad-treffet + `COMMIT`.
  - ⚠️ **ALDRI `\`-linjeskift-fortsettelse i disse** (målt KB2 2026-09-12): en `\`-fortsatt ssh-kommando splitter `-f` fra stien ved paste → `option requires an argument -- 'f'`, og bash prøver å kjøre fila (`Permission denied`). Derfor tre atskilte enlinjere, og `-f/tmp/…` limt til stien (mellomrom mellom `-f` og sti kan brytes av paste).
- **FALLBACK — lime SQL i interaktiv psql-prompt** (kun hvis fil-veien ikke er tilgjengelig; mindre trygg): åpne `ssh -t server-ny "sudo docker exec -it postgres psql -U sitedoc -d sitedoc_test"` (`-t` gir TTY for sudo; `\i` mot lokal fil virker IKKE — hosten ser ikke Mac-filsystemet), del JSON-strengen i korte biter (≤ ~75 tegn) på egne linjer (Postgres skjøter tilstøtende strengkonstanter; del på mellomrom, aldri midt i et ord), pakk i `BEGIN; … COMMIT;`.
  - ⚠️ **Paste i prompt kan feile på ekte** — KB2 v2 2026-09-12 droppet tre linjer midt i JSON-en → `Token "under" is invalid` → `ROLLBACK` (ingenting endret). Andre ganger ser EKKOET bare skramlet ut (KA7: `COMMIT;bibliotek_maler WHERE …`) mens psql committer riktig. Kort sagt: paste er upålitelig i halen. **Verifiser ALLTID på `UPDATE 1` / `COMMIT` / bekreftelses-SELECT-en, aldri på ekkoet — og foretrekk fil-veien over.**
- ⚠️ **Dette speiler ugatet/gatet arbeid inn i test** — revisjonsveien inntil `/admin/bibliotek`. Innholdsgaten (fabel) og merge (cowork) står urørt.

**Ansvarslinje:** å lage test-seed-kommandoen for den bestemte malen er **mal-Opus' oppgave** — leveres sammen med malen, ikke skjøvet til cowork (unngår friksjon). Når all seed-data er verifisert OK på test, eies **prod-promoteringen (test → produksjon) av Kenneth + cowork** — mal-Opus rører verken seed-mekanikk, prod-gate eller deploy.

### 6b. Seeden oppretter kun — fila er ikke fasit (Kenneth-vedtak 2026-09-11)

🔴 **`seed-bibliotek.ts` oppretter det som mangler og RØRER ALDRI en rad som finnes fra før** (`opprettMalHvisMangler` + `finnEllerOpprettKapittel` + standard-`upsert` med `update: {}`; aldri update, aldri `deleteMany`). Konsekvensen er prinsipiell:

- **Fila beskriver ikke nødvendigvis hva arkivet inneholder.** En mal revidert i databasen (via §6a, eller senere `/admin/bibliotek`) avviker permanent fra fila — med vilje. Fila er en **startpakke, ikke en fasit**.
- 🔴 **Vil du vite hva som står i arkivet: spør databasen, ikke fila.**
- **Revisjonsveien er den målrettede UPDATE-en (§6a), ikke seeden** — inntil `/admin/bibliotek` (retteveien i UI) finnes.
- **Tre veier, hver sin eier:** seed = førstegangs oppsett (oppretter det som mangler) · rå SQL (§6a) = byggeveien for revisjoner · `/admin/bibliotek` = retteveien i UI (bygges parallelt, ikke mal-Opus').
- Seeden skiller nå **opprettet** fra **hoppet over fordi finnes** i output og navngir de hoppede med referanse — «N maler seedet» uten det skjuler at en revisjon i fila aldri nådde databasen.

### 6c. Få en revidert mal SYNLIG i test — biblioteket ≠ firmamalen (målt KB2 2026-09-12)

§6a oppdaterer **bibliotek-raden** (`bibliotek_maler`). Men det arbeideren/du ser i MalBygger er nesten alltid en **firmamal** — en **frossen kopi** som `importerMal` (`apps/api/src/routes/bibliotek.ts:96`) lagde da malen ble importert til et prosjekt. **Kopier oppdateres ALDRI når biblioteket endres** (med vilje — en importert mal skal ikke skifte under føttene på et prosjekt). Konsekvens:

1. 🔴 **En §6a-UPDATE vises ikke i eksisterende firmamaler.** For å se den reviderte malen må du **importere den på nytt** fra bibliotek-velgeren («legg til fra bibliotek») i et prosjekt — det lager en fersk firmamal fra dagens bibliotek-rad.
2. **Versjons-sjekk uten kommando:** i den ferske importen ser du feltene som ble endret. KB2 v2: «Planhet …» = **Enkeltvalg** (ikke Desimaltall), «Fall …» = **Trafikklys**. Er de fortsatt Desimaltall, ser du en gammel kopi / gammelt bibliotek.

**Fella — foreldreløst bibliotekvalg (produktbug, ikke mal-Opus å fikse):** `ProsjektBibliotekValg.sjekklisteMalId` (`schema.prisma`) er en **svak, nullable peker uten cascade** til firmamalen. Sletter du firmamalen (ikke «fjern fra prosjekt»), blir valg-raden stående. Da:
- bibliotek-velgeren viser malen med **grønt ✓** («allerede importert») → du får ikke importert på nytt;
- klikk på den → `mal.hentMedId` gjør `findUniqueOrThrow` på en slettet id → **«Malen ble ikke funnet»**.

**Rydde-løype (Kenneth kjører, samme `psql -f`-vei som §6a — tre separate enlinjere):**
1. **Diagnostisér først (ren les):** en `.sql` som lister bibliotek-raden + alle valg for malen og om firmamalen finnes:
   ```sql
   SELECT v.id, v.prosjekt_id, v.sjekkliste_mal_id, (t.id IS NOT NULL) AS firmamal_finnes
     FROM prosjekt_bibliotek_valg v
     JOIN bibliotek_maler b ON b.id = v.bibliotek_mal_id
     LEFT JOIN report_templates t ON t.id = v.sjekkliste_mal_id
    WHERE b.referanse='<REF>';
   ```
   `firmamal_finnes = f` = foreldreløst valg (blokkerer re-import).
2. **Rydd KUN foreldreløse valg** (WHERE-vakten rører aldri et valg med levende firmamal; pakk i `BEGIN; SELECT …; DELETE …; COMMIT;` så du ser hva som slettes):
   ```sql
   DELETE FROM prosjekt_bibliotek_valg v
    USING bibliotek_maler b
    WHERE v.bibliotek_mal_id = b.id AND b.referanse='<REF>'
      AND (v.sjekkliste_mal_id IS NULL
           OR NOT EXISTS (SELECT 1 FROM report_templates t WHERE t.id = v.sjekkliste_mal_id));
   ```
   ⚠️ **Kjør diagnosen på nytt rett før DELETE** — tilstanden kan endre seg mellom kjøringene (KB2 2026-09-12: en ekstra firmamal ble slettet mellom diagnose og rydd, så DELETE traff 2 rader, ikke 1 — begge var da genuint foreldreløse, så trygt). DELETE-en rører **kun** koblingsrader (`prosjekt_bibliotek_valg`), aldri en firmamal.
3. Etter rydd: det grønne ✓-merket blir tom avkryssingsboks → **importer på nytt** → fersk firmamal med revisjonen.

**Produktbug å rute til cowork/backlog (ikke mal-Opus):** firmamal-sletting og `fjernValg` er ikke synkronisert — sletting av firmamal rydder ikke valget, og `importerMal` avviser re-import (CONFLICT) i stedet for å erstatte et foreldreløst valg. Riktig fiks er i koden (cascade/opprydding ved sletting, eller la re-import overta et dødt valg), ikke gjentatt manuell SQL.

## 7. NS-standard-loggen — mal-Opus' vedlikeholdsplikt (Kenneth 2026-09-13, HØY VIKTIGHET)

🔴 **[docs/claude/mal-ns-standard-logg.md](mal-ns-standard-logg.md) er mal-Opus' ansvar å holde à jour.** Loggen lister hvert sjekkliste-felt som viser til en **ekstern NS-standard** (NS 4400, NS 2890, NS 8141, NS 4417, …) i feltnavn, hjelpetekst eller valgopsjoner — og markerer om feltet **også** gir en konkret, felt-målbar verdi eller bare punkter arbeideren til standarden. Bakgrunn: en arbeider har sjelden den fremmede standarden foran seg (jf. § 1 «informativ om kravet der arbeideren står»); et felt som kun sier «tilfredsstille NS XXXX» uten målbar verdi er en kandidat fabel skal berike.

**Ufravikelig regel — del av DoD på HVER mal-bygg/revisjon:**

1. **Etter at malen er seedet lokalt**, kjør NS-sjekken (SQL-en står i loggens § «Reproduserbar sjekk») mot arkivet.
2. **Legger, endrer eller fjerner malen en ekstern NS-referanse**, oppdater `mal-ns-standard-logg.md` — rad(er), standard og «Målbar verdi i teksten?»-vurdering — i **SAMME branch/commit** som mal-endringen. Aldri «logg senere».
3. **NS 3420-K selv teller ikke** (internt sjekklistegrunnlag, ikke fremmed oppslag). Bare eksterne standarder.
4. **Ingen ny ekstern NS-referanse → ingen logg-endring**, men sjekken skal likevel være kjørt (negativ kontroll: tom output kan bety at du grep i feil felt-sti — `config->>'helpText'`, ikke `->>'helpText'`).

**Meld i mal-rapporten** (§ 6 pkt. 8) om malen rørte NS-loggen, og hvilke rader.

### 7a. Kilde og ansvar — hvordan NS-krav uttrykkes (Kenneth 2026-09-13, STYRENDE)

1. **Referer, gjengi aldri.** Hjelpetekster **refererer** NS-standarder ved post/punkt-nummer — de **gjengir aldri standardens ordlyd**. Vi har rett til å lese NS og lage sjekklister basert på den, men ikke nødvendigvis å reprodusere teksten. (Dette overstyrer et tidligere forslag om å bygge NS 4400-kriteriene inn i KB6 — det skal IKKE gjøres.)
2. **Kilde med utgave.** Referansen bærer utgave/år. *(Presisert av §7b 2026-09-18: henvisningen til NS 3420 står ÉN gang per mal, i beskrivelsen — og standardens navn skal ikke bære biblioteket i UI.)* **NS 3420-K:2024 er allerede forankret på standard-nivå** (`bibliotekStandard`: «NS 3420-K:2024 Anleggsgartnerarbeider») — den er fasit, og trenger ikke gjentas inline i hver hjelpetekst. **Eksterne standarders utgave (NS 4400/2890/8141/4417) oppgis av fabel** — mal-Opus gjetter aldri årstall; mangler det, står bar referanse og loggen flagger «utgave mangler».
3. **Den daterte kilden er aldri feil, og er selv drift-varselet.** Den sier hva malen ble bygget fra, ikke hva som gjelder i evig tid. Ser en leser årstallet og vet at en nyere utgave finnes → påminnelse om å sjekke om kravet fortsatt er gyldig.
4. **Sjekklistene holdes rene.** Ingen reprodusert lovtekst, ingen ansvarsfraskrivelser per sjekkliste eller i hver nedlastede PDF.
5. **Ansvaret legges på kunden ÉN gang sentralt.** «Du verifiserer mot gjeldende standard — da står sjekklisten seg på ditt ansvar» hører hjemme i bruksvilkår/onboarding/den ene «last ned avvik i sjekklister»-oversikten, **aldri gjentatt per sjekkliste**. NS-loggen er datagrunnlaget for den framtidige oversikten (kundevisning bygges når UI er klart — ikke nå).

### 7b. 🔴 Malene er SiteDocs egne sjekklister — de fremstår ikke som standarden (Kenneth-vedtak 2026-09-18, STYRENDE)

**Bakgrunn — Kenneth, 2026-09-18:** standarden er opphavsrettsbeskyttet. *«Jeg har rett å lese dokumentet og lage
mine egne maler basert på informasjon i dokumentet. Jeg kan henvise til hvor man finner informasjon og krav. Men jeg
kan ikke ordrett gjengi standarden. … Vi bør ikke fremstå som at dokumentene er NS 3420 standard. De bør fremstå med
krav uten å påstå at det er standarden som ligger til grunn.»*

**Regelen (fem punkter, godkjent av Kenneth):**

1. **Navn = koden + arbeidsoperasjonen med våre egne ord.** Kapittel- og underkapittelkoden **beholdes**
   (Kenneth, samme dag: *«av praktiske årsaker — det er koder som benyttes i beskrivelser og sammenfaller med
   fremdriftsplaner»*). Teksten etter koden er vår egen, ikke standardens tittel.
   ✅ «KD1 – Belegg av stein og heller» · ❌ «KD1 – Utendørs belegg» (standardens tittel).
2. **Hjelpetekst = kravet som vårt krav, med tallene.** Ingen tabell- eller punktkoder fra standarden.
   ✅ «Fall minst 2 % på gangareal og 2,5 % på kjøreareal (gatestein 3 %).» · ❌ «Tabell K11: …», ❌ «KD1 c5: …».
3. **Standarden nevnes én gang per mal, i beskrivelsen:** `Faglig grunnlag: NS 3420-K:2024, post <kode>.` Ikke i
   felt, ikke i hjelpetekster. (Koden i navnet er en henvisning til posten i beskrivelsen og fremdriftsplanen — ikke
   en påstand om at malen er standarden.)
4. **Kodene er synlige og stabile.** `referanse` (`KD1`) og `kapittelKode` (`KD`) røres ikke. De er både datanøkler
   og det brukeren kjenner igjen fra beskrivelse og fremdriftsplan.
5. **Aldri ordrett tekst fra standarden** — heller ikke nesten-ordrett. Skriv kravet slik en bas ville sagt det.
   ❌ «Gjennomgående fuger skal danne rette linjer eller jevne kurver» · ✅ «Fugene følger rette linjer eller jevne buer».

**Hva som forblir tillatt:** tallkrav (fall, toleranser, tykkelser, frostklasser) — det er fakta, ikke formuleringer.
Produktmerking brukeren ser på pallen («F1», «klasse 3 merket D», «FP100») nevnes uten å navngi produktstandarden.

**Ordrene (design-rollens arbeidsregel, 2026-09-18):** normfakta i en ordre skrives som **egen sammenstilling** —
krav per valg i malen, med egne ord og tall — ikke som avskrift av standardens tabeller i standardens oppsett.
Ordren kan si hvor faktumet står (normside), slik at gaten kan kontrollere det.

**Status ved vedtaket (målt på develop 2026-09-18):**

| Hvor | Brudd | Tiltak |
|---|---|---|
| KD1 (under bygging) | Standardens tittel i navn, tabell-/punktkoder i hjelpetekster | Rettes før commit — `TILLEGG-kd1-egne-krav-fabel-2026-09-18.md` |
| KA7, KB2, KB4, KB6, KC3.1 | 32 hjelpetekster åpner med tabell-/punktkode; navnene sjekkes mot punkt 1 | Én samlet ordre til mal-Opus etter KD1-gaten |
| Biblioteket i UI | Standardens navn vises som overskrift (`OpprettPunktDialog.tsx:546`) | Kapittelkodene beholdes. Om standardnavnet skal stå som overskrift, avgjøres i strengharmoniseringen (cowork) |
| Fabels ordrer KA7–KB4 i `docs/redesign/` | Tabeller avskrevet i standardens oppsett | Kenneths avgjørelse — ikke rørt |

**Forholdet til §7 (NS-loggen):** NS 3420 selv teller fortsatt ikke i loggen. Eksterne produktstandarder
(NS-EN 1338 osv.) nevnes ikke lenger i hjelpetekster når produktmerkingen alene sier det arbeideren skal sjekke.


## 8. Malfasit — teksten er låst (Kenneth 2026-09-20)

**Hullet som lukkes:** maltestene låser navn, felttype og fase. Hjelpetekster og alternativer var bare sjekket
negativt (§7b: ingen normkoder). Selve teksten var sett én gang, i psql-utskriften ved gaten. Endret noen et tall i en
hjelpetekst etterpå, sa ingenting fra.

**Regelen:** hele innholdet i hver eksportert `*_MAL` — referanse, navn, beskrivelse, og per felt type, label, fase,
alternativer, hjelpetekst og config — ligger i en **fasitfil i repoet**, skrevet ut av testen. En test sammenligner
malene mot fasiten ved hver kjøring.

1. **Endring i fasitfilen er bare lov sammen med en designgatet ordre.** Diffen skal vise gammel og ny tekst, og den
   skal være akkurat det ordren ber om. Fasitendring uten ordre er et avvik, og design holder merge.
2. Ved revisjon oppdateres fasiten i samme branch som malen, aldri i en egen «rett opp testen»-commit.
3. Nye maler legger til sin del av fasiten i samme branch.
4. Fasiten låser seeden, ikke databasen. At arkivet faktisk har samme innhold, vises fortsatt av tekstbeviset (§6a) ved
   hver kjøring.

### §8b. SQL-kjøringens rolle (Kenneth 2026-09-20)

Tekstbeviset hentes lokalt (`skriv-mal.ts`, samme form som §6a) og er låst av fasiten i §8. Derfor:

1. **Innholdsgaten går på den lokale utskriften** — malen seedes ikke for at design skal lese teksten.
2. **SQL mot test kjøres per runde, ikke per mal**, og alltid når `generer-mal-sql.ts` eller `byggBibliotekRader` er
   endret. Det er der beviset for kolonner, vakter og kapitteloppslag mot et ekte skjema ligger.
3. §1b-regelen står: SQL kjøres ÉN gang per fil, aldri to. Kenneth kjører den.

### §7c. Gratis offentlige dokumenter kan navngis (Kenneth 2026-09-20)

§7b forbyr å navngi standarder i hjelpetekster. Regelen har ett unntak, og skillet er om arbeideren kan slå opp kilden:

1. **Gratis og fritt tilgjengelig** (vegvesenets håndbøker, f.eks. N200, fritt nedlastbare fra vegvesen.no):
   **kan navngis** med navn og kapittel. Det hjelper den som står i grøfta til å finne kravet.
2. **Bak betaling** (NS 3420, NS-EN, NS 3458, VA/Miljø-blad, Norsk Vann-rapporter): navngis ikke i hjelpetekst.
   En henvisning dit er verdiløs for en arbeider som ikke har tilgang.
3. **Uansett kilde:** tekst og tabeller kopieres aldri. Kravet skrives med egne ord, eller det pekes til beskrivelsen.

Eksisterende maler som sier «vegvesenets krav i beskrivelsen» (bl.a. FS2) kan få N200 navngitt **når de revideres** —
det er en tekstendring og krever egen designgatet ordre, jf. §8.

### §6b. To tellinger — si hvilken du bruker (design 2026-09-21)

Et felt i en mal har **to tall**, og de er ikke like:

| Tall | Hvor det står | Teller med overskrifter? |
|---|---|---|
| **Feltnummer** (`f10`) | ordren, maltesten, fasitfilen (`mal-fasit.snap.md`) | Nei — bare datafelt |
| **Radnummer** (`RECORD 13`) | psql-utskriften ved §6a-kjøring, `sort_order` | Ja — fase-overskriftene teller med |

**Regel:** skriv alltid hvilken telling du bruker — «felt 10» eller «rad 13 i utskriften». Den som skal verifisere,
skal slippe å gjette. Ved tvil er **fasitfilen fasit**, fordi ordren og testen bruker samme telling som den.

Bakgrunn: designs gatemelding for JH2 sa «felt 13», som var radnummeret i psql-utskriften. Ordren sa felt 10, og det
var riktig. Merge-agenten nektet å føre et tall den ikke kunne verifisere, og skrev setningen uten feltnummer i stedet.
Det var riktig håndtering: heller utelate et tall enn å feste feil tall (cowork og merge, 2026-09-20).

### §1c. Vurdert uaktuelt er ikke det samme som aldri aktuelt (Kenneth 2026-09-21)

To ting ser like tomme ut, men er helt ulike, og skillet styrer både malbygging og rapport:

| | Hva det er | I malen | I rapporten |
|---|---|---|---|
| **Vurdert uaktuelt** | en fagperson så på forholdet og konkluderte | **et svar**: «Ikke aktuelt», «Ikke krav» | **står** — dokumenterer at vurderingen ble gjort |
| **Aldri aktuelt** | spørsmålet gjaldt ikke denne jobben | **betinget felt** som ikke vises | **utelates** — rapporten viser det som faktisk gjaldt |

**Regel for feltvalg:** skal arbeideren ta stilling til om et krav gjelder for jobben, er det et **svaralternativ**.
Følger uaktualiteten av et valg han allerede har gjort, er det et **betinget felt**.

Eksempel på hver: «Siltskjørt: Ikke aktuelt» er en vurdering noen har gjort, og den står. Klebing på et ubundet
bærelag er ikke et spørsmål noen skal svare på — der er de riktige spørsmålene om underlaget er tilstrekkelig
komprimert og tilstrekkelig plant, og klebefeltet vises ikke.

### §1d. Hva en KS-sjekkliste dekker (Kenneth 2026-09-21)

**Malen følger normens krav til utførelsen.** Stiller normen et krav, hører det hjemme i malen — også når kravet har
en sikkerhetsside. Graveskråning i grøft, sikring av åpen grøft og skriftlig salveplan er en del av den grunnleggende
forståelsen av hvordan jobben gjøres, ikke et HMS-tillegg som skal skilles ut.

**Det som ikke hører hjemme i en KS-mal**, er dokumenter i HMS-sporet med sin egen hensikt og sin egen mal: SJA,
risikovurdering av arbeidsoperasjonen, vernerunder og personlig verneutstyr. De handler om sikkerheten til dem som
utfører arbeidet, ikke om kvaliteten på det som leveres.

**Bakgrunn:** design foreslo 2026-09-21 å fjerne sikrings- og miljøfelt fra fem maler som «HMS på avveie». Kenneth
trakk forslaget: feltene står i normen malene bygger på, og skal bli. Grensen går ved dokumenttypen, ikke ved om et
krav tilfeldigvis også beskytter noen.
