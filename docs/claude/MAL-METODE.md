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
- **Informativ om NS 3420-krav.** Hjelpetekst per felt gir det tekniske kravet der arbeideren står (tall, toleranser, tabellreferanser). Der kravene er prosjektspesifikke, peker hjelpeteksten til prosjektbeskrivelsen/posten. Aldri påstå normkrav som ikke finnes i normen.
- **Enklest mulig dokumentasjonsprinsipp.** Bilder er primærbevis — hjelpetekster ber eksplisitt om foto der bildet beviser leveransen. Egne felt sier HVA som er levert (type/materiale) — ellers viser dokumentet bare at «noe» ble gjort.
- **Strukturert og oversiktlig.** Feltene grupperes under fase-overskrifter (H-felt): «Kontroll FØR utførelse» / «Kontroll UNDER utførelse» / «Kontroll ETTER utførelse». Seksjonene kollapser og viser teller («0 av 3») — viktig fordi sjekklister fylles ut over tid. ETTER-fasen bærer konklusjonen: krav oppfylt + dokumentasjonskrav levert.
- **Tallfelt kun når ett veldefinert tall dokumenterer leveransen** (Kenneth 2026-09-11, KB2-testen). Feltnavnet skal si hvilken måling som føres (minste/største). Krav mot en flate som varierer (fall, planhet) besvares med samsvar — trafikklys eller enkeltvalg per kravnivå — og målt verdi/sted hører i kommentaren. Min/maks-grenser på tallfelt skal aldri blokkere registrering av et avvik.

## 2. Kilder — hvor NS 3420-PDF-ene ligger

`kilder/ns3420/` i hovedtreet (Del 1, A, F, G, J, K, L, S, U, W, Z, ZK). Mappen er **gitignorert** (`.gitignore:78 kilder/*`) — agenter i worktrees ser den IKKE, og lisensiert normtekst skal ikke kopieres ut i worktrees.

**Regel:** hver mal-ordre fra fabel er SELVBÆRENDE — alle normutledede fakta (sidetall, poster, tallkrav, tabellverdier) står i ordren. Mal-Opus gjetter aldri på normkrav; mangler et faktum → stopp og meld tilbake.

**Hvor fabels ordrer lander (viktig etter compact/`/clear`):** ferdige ordrer fra fabel legges i **`~/Documents/Programmering/SiteDoc/Fra fabel/`** — i hovedtreet, utenfor worktrees — i daterte undermapper, f.eks. `til-repo-<dato-tid>/docs/redesign/ordre-<ref>-fabel-<dato>.md` (ev. medfølgende `docs/claude/MAL-METODE.md`-tillegg fra fabel). Kenneth relayer stien; mal-Opus henter ordren **der**, ikke fra worktreet. Når Kenneth sier «se meldingen fra fabel», er det denne plasseringen.

## 3. Hvem gjør hva, når (regel)

Flyt per mal — **én mal om gangen**, neste ordre skrives først når forrige er gatet:

1. **fabel** leser normkapitlet, måler dagens mal i `packages/db/prisma/seed-bibliotek.ts`, og skriver en selvbærende ordre (funn + full feltspesifikasjon + DoD). Ordren absorberer ev. rader for malen fra MK-konverteringslista (§4).
2. **Kenneth** relayer ordren til mal-Opus (fabel snakker aldri direkte med cowork/mal-Opus).
3. **mal-Opus** bygger i `seed-bibliotek.ts` iht. ordren, med eksisterende hjelpefunksjoner (`valg`/`trafikklys`/`desimal`/`felt`) — aldri hardkodet JSON. Kjører seed mot lokal DB, verifiserer idempotent re-kjøring, og leverer **skjermbilde-bevis**: malen i MalBygger + utfyllingsvisningen. Avvik fra ordren meldes eksplisitt.
4. **fabel** gater INNHOLD mot ordren (feltene, hjelpetekstene, fasene, utfyllingsopplevelsen). Godkjent → melder «klar for commit».
5. **cowork** gater TEKNISKE husregler før merge — og rører aldri innholdet: MalBygger-objekter, aldri hardkodet (Kenneth-vedtak 2026-09-05); `verifisert: false` eksplisitt + prod-gate urørt; seed-idempotens (upsert, aldri deleteMany); i18n på nye synlige strenger. Cowork eier merge-timing og deploy alene.

En mal som kompilerer og seeder kan fortsatt være ubrukelig på skjermen — derfor er skjermbilde-beviset obligatorisk før gate (presedens: kontrollplan L1-gaten).

## 4. Koordinering med MK-konverteringslista

Når en mal revideres, tar ordren stilling til malens rader i MK C-konverteringslista (hva hver rad blir i det nye oppsettet), og radene strykes fra lista når malen er gatet. Aldri dobbel konvertering av samme felt.

## 5. Rekkefølge og status

Kapittel K først, så F: KA7 → KB2 → KB4 → KB6 → KC3.1 → KD1 → (FB2, FC1, FD2, FE1, FB4, FD3).

| Mal | Ordre | Bygget | Gatet |
|---|---|---|---|
| KA7 | ordre-ka7-revisjon-fabel-2026-09-11.md (v2, absorberer MK C :166–:168) | ✓ `feat/mal-ka7-revisjon` `2a1602a8` | ✓ fabel 2026-09-11 → cowork teknisk gate + merge |
| øvrige | – | – | – |

Merknad til FE1 (fra cowork, rutes inn når FE1 kommer opp): hjelpetekstene på «Gjenfylling lagvis» (:516) og varselbånd (:529) bærer metodekrav («maks 30 cm», «30 cm over») i rene trafikklys — fabel vurderer feltform mot normen.

## 6. Redigere en eksisterende mal — steg for steg (mal-Opus)

Konkret løype, målt mot KA7-revisjonen 2026-09-11. **Én mal om gangen, kun etter en selvbærende ordre fra fabel.**

1. **Branch fra develop-tippen:** `git fetch -q origin && git checkout -b feat/mal-<ref>-revisjon origin/develop`. Verifiser at tippen er den ordren forventer (STOPP hvis eldre — da mangler ordre/metode i treet).
2. **Finn malens blokk** i `packages/db/prisma/seed-bibliotek.ts` — objektet i `maler`-arrayet med riktig `referanse`. **Rør ingenting utenfor denne blokken** (elleve andre maler deler fila).
3. **Rediger med hjelpefunksjonene** `valg` / `trafikklys` / `desimal` / `felt` — **aldri hardkodet JSON** (Kenneth-vedtak 2026-09-05). `fase`-strengen (`"FØR"`/`"UNDER"`/`"ETTER"`) styrer fase-gruppering; overskriftene «Kontroll FØR/UNDER/ETTER utførelse» genereres av lån-mutasjonen (`apps/api/src/routes/bibliotek.ts` + `firmamal.ts`), ikke av seeden. `verifisert: false` arves fra den sentrale seed-loopen — **rør ikke prod-gaten** (`erProd && !verifisert → continue`).
4. **Seed mot lokal DB, to ganger** (idempotens):
   ```sh
   DATABASE_URL="postgresql://<bruker>@localhost:5432/sitedoc" \
     pnpm --filter @sitedoc/db exec tsx prisma/seed-bibliotek.ts
   ```
   Seeden **oppretter kun** (`opprettMalHvisMangler`, aldri update/`deleteMany`), så andre kjøring per definisjon ikke endrer noe — den melder «N fantes fra før og ble IKKE rørt». ⚠️ **Bygger du en REVISJON av en mal som allerede finnes i din lokale DB, overskriver seeden den IKKE** — slett den ene raden først (`delete from bibliotek_maler where referanse='<REF>'`) eller start fra tom DB, ellers seeder du og ser fortsatt gammelt innhold.
5. **Gate-bygg** (les baseline på develop-tippen selv; seed-data er ikke dekket av tester → alle skal stå stille): `pnpm install` → `prisma generate` for `db`/`db-timer`/`db-maskin`/`db-varelager` → `pnpm --filter @sitedoc/web build` → `pnpm --filter @sitedoc/mobile typecheck` → `pnpm test`.
6. **Rebase rett før push**, verifiser at diffen mot develop er **kun** `seed-bibliotek.ts`, og push egen branch: `git rebase origin/develop && git diff --stat origin/develop..HEAD && git push -u origin feat/mal-<ref>-revisjon`. **Aldri `develop`** — cowork merger etter fabels innholdsgate.
7. **Skjermbilde-bevis på web** (obligatorisk før gate): seed malen til `sitedoc_test` (§6a) og fang malen i MalBygger (alle felter + faser) + utfyllingsvisningen.
8. **Meld ÉTT svar** til Kenneth (branch+hash · gate-tall målt selv · idempotens · skjermbildene · hvor fase-overskriften kom fra · avvik fra ordren). «Klar for commit» sier fabel, ikke mal-Opus.

### 6a. Revidere en mal i arkivet via målrettet UPDATE — den normale revisjonsveien

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
