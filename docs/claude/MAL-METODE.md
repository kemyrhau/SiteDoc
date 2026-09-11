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

## 2. Kilder — hvor NS 3420-PDF-ene ligger

`kilder/ns3420/` i hovedtreet (Del 1, A, F, G, J, K, L, S, U, W, Z, ZK). Mappen er **gitignorert** (`.gitignore:78 kilder/*`) — agenter i worktrees ser den IKKE, og lisensiert normtekst skal ikke kopieres ut i worktrees.

**Regel:** hver mal-ordre fra fabel er SELVBÆRENDE — alle normutledede fakta (sidetall, poster, tallkrav, tabellverdier) står i ordren. Mal-Opus gjetter aldri på normkrav; mangler et faktum → stopp og meld tilbake.

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
- **Innlim-felle (målt):** psql-økten mot test kjører på en host som **ikke ser lokale filer** (`\i /private/tmp/…` → «No such file»), og terminalen bryter en lang JSON-linje med harde linjeskift (`ERROR: invalid input syntax for type json … 0x0a must be escaped`). **Fiks:** del JSON-strengen i korte biter (≤ ~75 tegn) på egne linjer — Postgres skjøter tilstøtende strengkonstanter atskilt av linjeskift, så terminal-bryting kan ikke ødelegge den. Del på mellomrom, aldri midt i et ord (trygt for æøå). Pakk i `BEGIN; … COMMIT;` med en `SELECT referanse, verifisert, jsonb_array_length(mal_innhold), navn`-bekreftelse. Test SQL-en lokalt før du gir den til Kenneth.
- ⚠️ **Dette speiler ugatet/gatet arbeid inn i test** — revisjonsveien inntil `/admin/bibliotek`. Innholdsgaten (fabel) og merge (cowork) står urørt.

**Ansvarslinje:** å lage test-seed-kommandoen for den bestemte malen er **mal-Opus' oppgave** — leveres sammen med malen, ikke skjøvet til cowork (unngår friksjon). Når all seed-data er verifisert OK på test, eies **prod-promoteringen (test → produksjon) av Kenneth + cowork** — mal-Opus rører verken seed-mekanikk, prod-gate eller deploy.

### 6b. Seeden oppretter kun — fila er ikke fasit (Kenneth-vedtak 2026-09-11)

🔴 **`seed-bibliotek.ts` oppretter det som mangler og RØRER ALDRI en rad som finnes fra før** (`opprettMalHvisMangler` + `finnEllerOpprettKapittel` + standard-`upsert` med `update: {}`; aldri update, aldri `deleteMany`). Konsekvensen er prinsipiell:

- **Fila beskriver ikke nødvendigvis hva arkivet inneholder.** En mal revidert i databasen (via §6a, eller senere `/admin/bibliotek`) avviker permanent fra fila — med vilje. Fila er en **startpakke, ikke en fasit**.
- 🔴 **Vil du vite hva som står i arkivet: spør databasen, ikke fila.**
- **Revisjonsveien er den målrettede UPDATE-en (§6a), ikke seeden** — inntil `/admin/bibliotek` (retteveien i UI) finnes.
- **Tre veier, hver sin eier:** seed = førstegangs oppsett (oppretter det som mangler) · rå SQL (§6a) = byggeveien for revisjoner · `/admin/bibliotek` = retteveien i UI (bygges parallelt, ikke mal-Opus').
- Seeden skiller nå **opprettet** fra **hoppet over fordi finnes** i output og navngir de hoppede med referanse — «N maler seedet» uten det skjuler at en revisjon i fila aldri nådde databasen.
