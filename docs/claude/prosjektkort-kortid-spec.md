---
status: 🟢 VEDTATT 2026-11-16 — B1–B10 besvart av Kenneth (§ 10 «Kenneths svar»); B6 snudd: fravær føres på prosjektkort. Ingen kode. Ingen funksjon fjernes uten hjemmel (§ 7, § 11.4). TILLEGG 2026-11-16 (lønnsartvalg pr. linje) ført inn som § 6.1. TILLEGG 2026-11-16 (fraværskort uten prosjekt, § 11) og TILLEGG 2026-11-16 (B10 — fravær med tak mot dagsnormen, § 11.10): 🟢 VEDTATT 2026-11-16 — F1–F11 besvart av Kenneth og ført inn i brødteksten. ✅ F12 = A (Kenneth 2026-11-16, § 11.9): «Fravær til» fjernes i ordre c. ✅ Ordre b merget til develop (`eca8dd1f`) og deployet til test (§ 8.1). 🔨 Ordre c bygget på `feat/kortid-c-mobil` (Kort-id-c), ikke merget (§ 8.2). TILLEGG 2026-11-16 («kortet følger hele veien» — attestering, eksport/fakturering, rapport, § 12): H1–H10 besvart av Kenneth 2026-11-16 (§ 12.8.1; H10 SNUDD: timeraden med sin maskin og sine varer på én linje); 🟡 H11–H13 åpne; R/G/E-reglene ikke ført om ennå; ingen kode. Omfanget er hele attesteringen (TILLEGG 2) og rapportens Detaljer-tabell (TILLEGG 3).
sist_verifisert_mot_kode: 2026-11-16 (develop @ e3aea58f — målt på 140c19cb, linjereferanser i `bekreft-dag.tsx` og `dagsforslagAnvend.ts` oppdatert etter (26)-mergen `780f388c`; § 11 målt mot develop @ dc5833dc; § 11.10 målt mot develop @ e3c7d6cf; § 11-rettingen FM27–FM29 (F1, F4, F8) målt mot develop @ b4dac1b8; § 12 målt mot develop @ 10d343ce, HM22–HM25 mot 0783cf1d, HM26–HM30 mot f465d7d5, HM31–HM41 mot a49821ca)
eier: Fabel (spec) → Timer-feilsøk/Redesign (kode)
ordre: «ORDRE — spec: prosjektkort med kort-id, dagskortet som sum av prosjektkort, lønnsart-forslag fra døgnets registreringer — orkestrator 2026-11-16» + «TILLEGG … valg av lønnsart ved manuell registrering» + «ORDRE 2026-11-16 — SPEC-TILLEGG: fraværskort uten prosjekt» + «SPEC-TILLEGG 2026-11-16 — B10 betalt fravær i ordre b» + «SPEC-RETTING 2026-11-16 — § 11 til VEDTATT med Kenneths svar F1–F11» + «SPEC-TILLEGG 2026-11-16 — «kortet følger hele veien»» + «TILLEGG til SPEC-TILLEGG … Kenneths krav til attesteringsvisningen» + «TILLEGG 2 … TOTAL OVERHALING av attesteringen» + «TILLEGG 3 … rapportens Detaljer-tabell og sjekklistenes verktøy» (relay/inbox-fabel.md)
---

# Spec — prosjektkort med kort-id, dagskortet som sum av prosjektkort, lønnsart-forslag fra døgnets registreringer

> **Fasit:** [timer.md § «🔴 Prosjektkort og dagskort — definisjon (Kenneth 2026-11-16, styrende)»](timer.md). Denne
> specen gjentar ikke definisjonen; den sier hvordan den bygges. Vedtatt og ikke til ny beslutning: ett dagskort pr.
> ansatt pr. døgn med 1–30 prosjektkort · underprosjekt er del av kortet, byggeplass når brukt · flere kort på samme
> prosjekt når arbeidets art deles · foreslått føring kan splittes til eget kort · overtid er linje i kortet, ikke
> eget kort · hver linje viser tid · timer · lønnsart · lønnsart foreslås fra døgnets registreringer, arbeideren kan
> overstyre · **«ja, legg til kort-id»**.

**Hva specen legger til:** hvor kort-id bor og hvem som bærer den (§ 2), migrering (§ 3), synk og API med eldre
klient (§ 4), flater og paritet (§ 5), én regel for lønnsart-forslag (§ 6) med lønnsartvalg pr. linje (§ 6.1), funksjonsinventar (§ 7), ordre-oppdeling
(§ 8), tester (§ 9), beslutninger til Kenneth (§ 10), fraværskort uten prosjekt (§ 11, tillegg) med taket for betalt fravær (§ 11.10, B10) og kortet gjennom attestering, eksport og rapport (§ 12, tillegg — 🟡 forslag).

---

## 1. Målt mot koden (develop @ e3aea58f)

| # | Funn | Referanse |
|---|---|---|
| M1 | Kortet har ingen egen identitet. `kortNokkel` = `projectId\|byggeplassId\|ecoId` («ingen» for null), utledet pr. rad med *effektiv* byggeplass (radens egen, ellers sedelens når den hører til prosjektet). | `apps/mobile/src/lib/prosjektkortMobil.ts:191–193`, `:222–229`, `:237–248` |
| M2 | Kortlista dedupliserer på nøkkelen (`Map<KortNokkel, KortValg>`), så to kort med samme prosjekt, byggeplass og underprosjekt kan ikke finnes samtidig — heller ikke via «+ Nytt kort». | `prosjektkortMobil.ts:295–302` |
| M3 | Serveren kjenner ikke kort: 0 treff på `kortNokkel`/`kortId`/`kort_id` i `apps/api/src` og i de tre firmamodul-skjemaene. Radene bærer `projectId`, `byggeplassId?`, `externalCostObjectId?` hver for seg. | `packages/db-timer/prisma/schema.prisma:227–320` (`SheetTimer`), `:386–420` (`SheetTillegg`), `:460–490` (`SheetUtlegg`), `:544–590` (`SheetMachine`); `packages/db-varelager/prisma/schema.prisma:74–103` (`Vareforbruk`) |
| M4 | Sedelen er unik pr. (bruker, dato): `@@unique([userId, dato])`. Dagskortet finnes altså alt som én rad pr. ansatt pr. døgn. | `db-timer/schema.prisma:211` |
| M5 | Maskin og vare kan kobles til en timerrad (`sheetTimerId`, nullable, 0..n pr. rad). Tillegg og utlegg har ingen kobling til rad; de hører til sedel + (prosjekt, byggeplass, underprosjekt). | `db-timer/schema.prisma:554`; `db-varelager/schema.prisma:88`; `:391–395`, `:463–467` |
| M6 | Vareforbruk bor i eget skjema (`varelager`) med `dagsseddelId` nullable — en varelinje kan finnes uten sedel. Samme database (`DATABASE_URL`), eget Prisma-skjema og egne migreringer. | `db-varelager/schema.prisma:14–15`, `:84`; `db-timer/schema.prisma:14–15` |
| M7 | `syncBatch` tar rader med klient-id (`id: uuid`) pr. type (timer, tillegg, maskiner, utlegg). Zod-objektene er ikke `strict` — ukjente felt strippes. Fra V19.9 erstattes bare «skriv»-radene (`deleteMany` på deres id + `createMany`); hoppede rader står. | `apps/api/src/routes/timer/dagsseddel.ts:6409–6520`, `:7422–7448`, `:7502–7586` |
| M8 | Skriveveier som lager rader på server: 6 for timer (`:1642`, `:2591`, `:3211`, `:5437`, `:5657`, `:5874`) + `createMany` i synk (`:7502`); maskin 4 + synk; tillegg 4 + synk; utlegg 1 + synk; vareforbruk 1 (`vareforbruk.ts:495`). Overlapp-forslag kopieres til og fra `SheetTimerForslag` (`:556–558`, `:3200–3211`). | `dagsseddel.ts`; `apps/api/src/routes/vareforbruk.ts` |
| M9 | Skriveveier på mobil (lokal `insert`): timer 6 steder i 5 filer (`dagsforslagAnvend.ts:233`, `SplittRadModal.tsx:289`, `forsoningSpeil.ts:119`, `nyTimerRad.ts:228`, `timerSync.ts:766/:1527`), maskin 7, tillegg 4, utlegg 3, vare 2. | `grep insert(sheet…Local)` i `apps/mobile` (koderen teller på nytt før ordre b) |
| M10 | Bekreft dag: kortets nøkkel er (dato, prosjekt, effektiv byggeplass); underprosjekt er satt til `null` i nøkkelen. | `apps/mobile/src/utils/beskrivelseKort.ts:48–63` |
| M11 | Bekreft dag i **manuell** modus har underprosjekt-valg (chips) og skriver valget på kortets arbeidsrader. I **GPS**-modus sendes alltid `ecoId: null`. | `apps/mobile/app/timer/bekreft-dag.tsx:579`, `:607`, `:856`, `:1313`; `apps/mobile/src/utils/dagsforslagAnvend.ts:231`, `:240` |
| M12 | Dagskortet (prosjektkort-modus) viser én boks pr. timerrad, gruppert på (prosjekt, underprosjekt). Overtidsraden blir egen boks. | `apps/mobile/src/utils/dagsoversiktRader.ts:36–68`, `:88–109`; `ProsjektkortDagsoversikt.tsx:312`, `:324` |
| M13 | Web-sedelen i prosjektkort-modus har kort pr. **prosjekt** (`prosjektIder`), ikke pr. byggeplass eller underprosjekt. | `apps/web/src/app/dashbord/timer/[id]/page.tsx:965–966`, `:1500–1502` |
| M14 | Normaltid/overtid fordeles i `beregnSegment` for både GPS- og manuell Bekreft dag (`forberedManuellDag` kaller `beregnDagsforslag`). Normen som brukes er datoens fulle `dagsnorm`; `dagsnorm 0` tolkes som «ingen norm → alt normaltid». Arbeid som alt står på datoens sedel trekkes ikke fra. | `apps/mobile/src/utils/dagsforslag.ts:1254–1273`, `:1623–1626`, `:1653`; `apps/mobile/src/utils/manuellDag.ts:74–105` |
| M15 | Inndata til forslaget bærer alt datoens eksisterende rader, men bare som tidsrom (til overlapp-vakten). | `dagsforslag.ts:1245–1249`, `:1618`, `:1673–1677` |
| M16 | Én delt regel finnes: `klassifiserArbeidstid` (normaltid til norm, resten overtid; reise holdes utenfor av kalleren), `velgOvertidLonnsart` (strukturert `overtidsnivaa`), og `foreslaOvertidSplitt` (V21, kronologisk over dagens rader; rader som alt står på overtid teller mot summen). Kallere: mobil Bekreft dag, mobil og web rad-vindu, overtidsgrunnlag. | `packages/shared/src/utils/lonnsregel.ts:43–57`, `:75–86`; `packages/shared/src/utils/overtidForslag.ts:72–189`; `apps/mobile/src/components/timer-detalj/TimerSeksjon.tsx:1607`; `apps/web/…/timer/[id]/page.tsx:3051` |
| M17 | Ukjent norm (ingen svar-cache) gir `dagsnorm 0` + `normStatus 'ukjent'`. | `apps/mobile/src/services/dagsforslagInput.ts:245–259` |
| M18 | «Del opp» på mobil endrer del 1 på plass og setter inn øvrige deler med originalens prosjekt, fra–til og beskrivelse. Delene kan få ulik lønnsart, aktivitet og underprosjekt. `byggeplassId` settes ikke på nye deler. | `apps/mobile/src/components/timer-detalj/SplittRadModal.tsx:277–304` |
| M19 | Kortskjermen har «Endre kort» og «Slett kort», og sammenligner kort med `kortNokkel(til) !== kortNokkel(valg)`. Ruten bærer kortet som `projectId` + `bp` + `up`. | `apps/mobile/app/timer/[id]/kort/[projectId].tsx:103–104`, `:119`, `:645–652` |
| M20 | Lokale tillegg følger mønsteret «kolonneliste + `ALTER TABLE … ADD COLUMN`» i `migreringer.ts`; siste kort-relaterte er `KORTVALG_LOCAL_KOLONNER` og `RADFORM_LOCAL_KOLONNER`. Utkast lagres i `prosjektkort_utkast_local` med `skjemaVersjon`. | `apps/mobile/src/db/migreringer.ts:1547–1558`; `apps/mobile/src/db/schema.ts:1097–1109` |
| M21 | Firmaets visningsmodus (`timerRegistreringsmodus`: `dagskort` \| `prosjektkort`) endrer bare visning — samme sedel, samme rader. | `packages/db/prisma/schema.prisma:491`; `page.tsx:316–319` |
| M22 | Bekreft dag (GPS og manuelt kort, samme skjerm) har **ingen lønnsartvelger**. Normaldelen får alltid firmaets standardart; overtidsdelen får arbeiderens valgte overtidsart, ellers `velgOvertidLonnsart`. Finnes ingen art, droppes raden og telles (`raderDroppetUtenLonnsart`). | `apps/mobile/src/utils/dagsforslag.ts:1655–1670` |
| M23 | Overtid i Bekreft dag styres av: lenken «+ Legg til overtid» (vises bare når kortet ikke har overtid og firmaet har en overtidsart), «Overtid fra» −/+ (steg = firmaets tidsrunding, ellers 15 min) og nivå-chips med aktive lønnsarter som har `overtidsnivaa`. Å føre overtid som ordinær = flytte «Overtid fra» til slutten. | `apps/mobile/app/timer/bekreft-dag.tsx:1055–1058`, `:1906–1920`, `:1921–1945`, `:1949–1962`; `dagsforslag.ts:717–731` |
| M24 | Rad-vinduet har lønnsartvelger. Mobil: `LonnsartVelgerModal` — søkbar liste over **alle** aktive lønnsarter i den lokale tabellen, uten filter på type og **uten filter på firma**. Web: `<select>` over `lonnsart.list` (firmaets aktive), uten filter på type. | `apps/mobile/src/components/timer-detalj/TimerSeksjon.tsx:2306–2326`; `apps/web/…/timer/[id]/page.tsx:2682`, `:3343–3355`; `apps/api/src/routes/timer/lonnsart.ts` (`list`) |
| M25 | Lønnsarten har `type` (`ordinaer` \| `fravaer` \| `feriepenger` \| `diett`), `overtidsnivaa` og `erStandardvalg`. Den har **ikke** noe felt for arbeidets art (kontrakt/regning). Det nærmeste i modellen er underprosjektets `proAdmType` (varsel/endring/tilleggsarbeid/regningsarbeid). | `packages/db-timer/prisma/schema.prisma:22–52`; `packages/db/prisma/schema.prisma:2809` |

### 1.1 Der ordrens premiss og koden skiller lag

- **Avvik 1 («underprosjekt lagres ikke på kortet») gjelder bare delvis.** Manuell Bekreft dag lagrer underprosjektet
  på radene (M11). Det som mangler er (i) valget i GPS-modus og (ii) underprosjekt i kortets nøkkel for beskrivelse,
  maskin og varer (M10).
- **Avvik 5 («ikke målt om Del opp kan gi nytt kort») er målt:** «Del opp» gir nytt kort bare når en del får et annet
  underprosjekt (M18 + M1). To kort med samme nøkkel kan ikke oppstå (M2). Nye deler mister radens egen byggeplass og
  arver sedelens (M18) — meldes som funn, rettes ikke av denne specen alene (se § 7).
- **Ordrens del «lønnsart-forslag for manuelt kort» og «dagskortet viser ett kort med overtid som linje» er alt
  bestilt** som ORDRE 2026-11-16 (27) hos Timer-feilsøk (`relay/inbox-timer-dagskort.md:244`). Ingen leveranse var
  meldt da denne specen ble skrevet (ingen «SVAR ORDRE (27)» i `relay/inbox-orkestrator.md`, og `git ls-remote --heads origin
  fix/overtid-manuell-dag` ga tomt svar 2026-11-16). § 6 og § 8 bygger på (27), ikke ved siden av.
- **Web har ikke prosjektkort pr. byggeplass/underprosjekt i dag** (M13). Paritet er derfor mer enn «legg til kort-id».

---

## 2. Modell (ordrepunkt 1)

### 2.1 To alternativer

| | **A — `kort_id` på radene** (anbefalt) | **B — egen tabell `prosjektkort`** |
|---|---|---|
| Hva er kortet | Mengden rader på én sedel som deler `kort_id`. | Én rad i `timer.prosjektkort`; radene peker dit med FK. |
| Hva «eier» kortet | Prosjekt, underprosjekt, byggeplass og beskrivelse står på radene som i dag. Kortet eier dem som **invariant**: alle kortets rader er like på disse feltene (§ 2.3). | Kortet har egne kolonner; radenes kolonner blir kopier som må holdes like i ~20 skriveveier (M8, M9). |
| Synk | Ett valgfritt felt pr. rad. Følger raden gjennom V19-forslag, V19.9-radversjoner, forsoning og konflikt-speil uten nye begreper. | Ny entitet i `syncBatch`, i `hentEndringerSiden`, i forslag/forsoning og lokalt (`prosjektkort_local`). Eldre klient sender den ikke → serveren må lage den fra radene uansett. |
| DB-garanti | Rad-nivå (`CHECK`, § 3.4). At ett kort ikke spenner to prosjekter kan ikke uttrykkes som unik indeks; bæres av server-validering + test + gate-SQL. | Full: FK + sammensatt FK gir «ett kort, én sedel, ett prosjekt» i databasen. |
| Tomt kort | Finnes bare på telefonen til første rad lagres (som «+ Nytt kort» i dag). | Kan lagres uten rader. |
| Omfang | 5 kolonner + 1 på forslagstabellen, én regel på server, én på mobil. | Som A + ny tabell to steder + ny synk-entitet. |

**Anbefaling: A.** Definisjonen sier *«Hver rad (timer, maskin, varer, tillegg/utlegg som hører til kortet) skal bære
kortets id»* — det er A. Alle lesere (attestering, eksport, rapport, maskin-tak) leser feltene fra radene i dag (M3)
og står urørt. Kortet har ingen egenskap som ikke alt står på radene (beskrivelsen skrives på alle kortets
arbeidsrader, ORDRE 24). B gir sterkere databasegaranti, men innfører to kilder for prosjekt/underprosjekt/byggeplass
i en synk som erstatter rader enkeltvis (M7). B kan bygges senere oppå A uten ny backfill (kort-id-ene finnes da).
Valget er Kenneths (**B1**).

### 2.2 Hvem bærer `kort_id` (alternativ A)

| Tabell (server · mobil) | `kort_id` | Regel |
|---|---|---|
| `timer.sheet_timer` · `sheet_timer_local` | Ja, alle **arbeidsrader**. Reise-rader: alltid `NULL`. | Reise ligger i dag-seksjonen og lager ikke kort (`prosjektkortMobil.ts:286`; vedtak «reise skilt fra arbeid» 2026-11-14). |
| `timer.sheet_machines` · `sheet_machine_local` | Ja. | Koblet maskin (`sheetTimerId`) har alltid radens kort. Ukoblet («Uten rad») bærer eget `kort_id`. |
| `timer.sheet_tillegg` · `sheet_tillegg_local` | Ja. | Linja velger kort (ORDRE 25: datokortet). |
| `timer.sheet_utlegg` · `sheet_utlegg_local` | Ja. | Som tillegg. |
| `varelager.vareforbruk` · `vareforbruk_local` | Ja når `dagsseddelId` er satt; ellers `NULL`. | Koblet vare har radens kort. Svak referanse (annet skjema, M6) — ingen FK, som `sheetTimerId` i dag. |
| `timer.sheet_timer_forslag` | Ja (nullable). | Forslagsraden er en mobilrad satt til side (V19); id-en må følge den tilbake ved forsoning. |

Alle kolonner er `String?` (`TEXT`), lagt i `packages/db-timer` og `packages/db-varelager` — **aldri `packages/db`**.

### 2.3 Hva kortet eier — invarianter

For alle rader med samme `kort_id`:

- **K1** samme sedel (dermed samme ansatt og samme dato — «aldri to datoer»).
- **K2** samme prosjekt.
- **K3** samme underprosjekt (`externalCostObjectId`, også `NULL`).
- **K4** samme effektive byggeplass (`effektivByggeplass`, M1; også `NULL`).
- **K5** én beskrivelse: kortets tekst står på alle kortets arbeidsrader (ORDRE 24). Endres teksten på én rad i et
  kort, skrives den på alle kortets arbeidsrader.
- **K6** koblet maskin/vare har samme `kort_id` som timerraden den er koblet til.
- **K7** to kort kan ha identiske K2–K4 (grøft og skifer). Det er hele poenget; ingen leser slår dem sammen.

K1–K4 og K6 valideres av **én delt funksjon** i `packages/shared` (`validerKortInvariant(rader, sedelKontekst)`),
brukt av `syncBatch`, web-mutasjonene og mobilens skrivevei. Navnet på delt kilde for nøkkelen flyttes samtidig fra
`apps/mobile/src/lib/prosjektkortMobil.ts` til `packages/shared/src/utils/prosjektkort.ts` (web trenger den i § 5);
mobilfila re-eksporterer, så ingen kaller endres.

### 2.4 Hvordan en rad får `kort_id`

`løsKortId` (shared, ren funksjon) brukes likt på server og mobil:

1. **Kalleren oppgir kort-id** (ny klient, bruker står i et kort) → brukes.
2. **Raden finnes fra før og nøkkelen (K2–K4) er uendret** → raden beholder sin lagrede id.
3. **Ellers** (ny rad uten oppgitt id, eller eldre klient flyttet raden): det **eldste** kortet på sedelen med samme
   nøkkel; finnes ingen → **utledet id** (§ 3.2) for nøkkelen.

Nytt kort laget av brukeren («+ Nytt prosjektkort», «Del til eget kort») får tilfeldig UUID fra klienten.
Regel 3 gjør at dagskort-modus-firma (M21) og eldre klienter får fylt feltet uten å vite om kort.

---

## 3. Migrering (ordrepunkt 2) — Kenneth kjører

### 3.1 Steg 1 (denne releasen): legg til + backfill + indeks

To migreringer, additive: `packages/db-timer` (`sheet_timer`, `sheet_machines`, `sheet_tillegg`, `sheet_utlegg`,
`sheet_timer_forslag`) og `packages/db-varelager` (`vareforbruk`). Rekkefølge: timer først, varelager etterpå
(varelager-backfillen leser `timer.sheet_timer`).

- `ADD COLUMN kort_id TEXT` (nullable) + indeks `(sheet_id, kort_id)`; varelager: `(dagsseddel_id, kort_id)`.
- Ingen data slettes eller flyttes. Ingen eksisterende kolonne endres.

### 3.2 Backfill — utledet fra dagens `kortNokkel` pr. sedel

Hver eksisterende rad får kortet den vises i **i dag**, så ingen ser forskjell dagen etter migreringen.

- **Utledet id:** `md5('kort|' || user_id || '|' || dato || '|' || project_id || '|' || coalesce(effektiv_bp,'ingen')
  || '|' || coalesce(eco,'ingen'))` formatert som UUID. Samme funksjon finnes i `packages/shared`
  (`utledKortId`, ren JS-md5), slik at telefonen fyller sine lokale rader med **samme** id uten å spørre serveren.
  Test med faste vektorer mot Postgres (§ 9 T3). Koderen verifiserer at formatet passerer repoets `z.string().uuid()`.
- **Effektiv byggeplass i SQL:** `coalesce(r.byggeplass_id, case when b.project_id = r.project_id then
  ds.byggeplass_id end)` med `left join public.byggeplasser b on b.id = ds.byggeplass_id` — samme regel som M1 (tabellnavn fra
  `packages/db/prisma/schema.prisma:1186`; kolonnenavn verifiseres av koderen).
- **Diskriminerende WHERE, én setning pr. tilfelle** (ingen felles standardverdi):
  1. arbeidsrader: `WHERE kort_id IS NULL AND er_reise = false`;
  2. koblet maskin: `… FROM sheet_timer t WHERE m.sheet_timer_id = t.id AND m.sheet_id = t.sheet_id AND m.project_id = t.project_id` → radens id;
  3. øvrig maskin, tillegg, utlegg: egen nøkkel;
  4. forslagsrader: egen nøkkel, `er_reise = false`;
  5. varelager: koblet vare → radens id; `dagsseddel_id IS NOT NULL` ellers → egen nøkkel; `dagsseddel_id IS NULL` → urørt.
- Reise-rader og varer uten sedel forblir `NULL` med vilje (§ 2.2).
- Migreringen skriver ikke `updated_at` — ingen sedel skal se «endret» ut for synken.

### 3.3 Lokal migrering på telefonen

`KORTID_LOCAL_KOLONNER` (fem tabeller) i `migreringer.ts` etter mønsteret i M20, og lokal backfill med `utledKortId`
i samme kjøring. Koblet maskin/vare får radens id. Ingen Prisma-endring; SQLite-migreringen går med OTA.

### 3.4 Garantier — «stille tomhet er forbudt»

| Krav (arkitektur.md) | Hvordan |
|---|---|
| (a) Backfill | § 3.2 + § 3.3, i samme release som kolonnen. |
| (b) DB-garanti | `CHECK` på rad-nivå: `sheet_timer`: `(er_reise AND kort_id IS NULL) OR (NOT er_reise AND kort_id IS NOT NULL)`; maskin/tillegg/utlegg: `kort_id IS NOT NULL`; vareforbruk: `dagsseddel_id IS NULL OR kort_id IS NOT NULL`. **Når** den legges på er B2. |
| (c) Test som feiler når feltet er tomt | Integrasjonstest pr. skrivevei i M8 (rad uten `kort_id` etter kall = rød) + mobiltest pr. skrivevei i M9 + gate-SQL under. |

**Gate-SQL Kenneth kjører etter migrering (1, 2 og 3a skal gi 0; 3b er til orientering):**

```sql
-- 1) arbeidsrad uten kort
select count(*) from timer.sheet_timer where er_reise = false and kort_id is null;
-- 2) kort som spenner flere sedler, prosjekter eller underprosjekt («uten prosjekt» teller som eget prosjekt)
select count(*) from (select kort_id from timer.sheet_timer where kort_id is not null
  group by kort_id having count(distinct sheet_id) > 1 or count(distinct coalesce(project_id,'ingen')) > 1
     or count(distinct coalesce(external_cost_object_id,'')) > 1) x;
-- 3a) koblet maskin på samme sedel og prosjekt som raden, med annet kort enn raden (skal gi 0)
select count(*) from timer.sheet_machines m join timer.sheet_timer t on t.id = m.sheet_timer_id
 where m.sheet_id = t.sheet_id and m.project_id = t.project_id and m.kort_id is distinct from t.kort_id;
-- 3b) til orientering: maskin koblet til en timerrad på et annet prosjekt eller en annen sedel
select count(*) from timer.sheet_machines m join timer.sheet_timer t on t.id = m.sheet_timer_id
 where m.sheet_id is distinct from t.sheet_id or m.project_id is distinct from t.project_id;
```

Gate-SQL 2 bruker `coalesce(project_id,'ingen')` fordi `count(distinct …)` hopper over `NULL`: uten den teller et kort
som blander prosjekt og «uten prosjekt» (§ 11.2) som ett prosjekt og slipper gjennom.

Gate-SQL 3 er delt fordi 3a speiler `WHERE` i backfill 2 (§ 3.2). **Tallet i 3b** er eldre koblinger der maskinen står
på et annet prosjekt (eller en annen sedel) enn timerraden den er koblet til — kortet kan ikke både ha ett prosjekt
(K2) og bære maskinen til radens kort (K6), så maskinen beholder kortet for sitt eget prosjekt; **det stopper ikke
deploy.** Samme regel på server: `kobletFolger` (`apps/api/src/services/timer/kortId.ts:242`, 🟡
`feat/kortid-b-skjema` @ `c39ca519`, ikke merget).

🔴 **Spenning mellom to regler (B2):** «stille tomhet» krever DB-garantien i samme release; to-stegs-policyen sier
`NOT NULL`/garanti i *neste* release. Legges `CHECK` på i steg 1, kan ikke den gamle API-versjonen skrive en eneste
timerrad i vinduet mellom `migrate` og `up`, og en tilbakerulling av API-et etter migrering stopper all timeføring.
Anbefaling: `CHECK` i **steg 2** (neste release, med en liten etter-backfill først), og (c) + gate-SQL bærer garantien
i mellomtiden.

---

## 4. Synk og API (ordrepunkt 3)

### 4.1 `syncBatch` (mobil → server)

- Nytt valgfritt felt `kortId: z.string().uuid().nullable().optional()` på radene i `timer`, `tillegg`, `maskiner` og
  `utlegg` (`dagsseddel.ts:6448–6520`). Ingen ny entitet, ingen endret form.
- Serveren løser id pr. rad med `løsKortId` (§ 2.4) før `createMany` (`:7502–7586`). Koblet maskin får alltid
  timerradens id — det klienten sendte for maskinen, overstyres (K6).
- Etter løsing valideres K1–K4 pr. kort i hele sedelens post-tilstand (skrevne + hoppede rader, `:7127`). Brudd →
  `resultat: "avvist"` med grunn `kortUlikeRader`, som øvrige katalog-avvisninger (SYNC-1). Ny klient kan ikke
  produsere bruddet (test); eldre klient sender ikke `kortId` og treffer regel 2/3.
- V19 overlapp: `SheetTimerForslag` får `kortId` med inn (`:556–558`) og ut igjen ved `forsonDagskort`
  (`:3200–3211`). V19.9: hoppede rader står med sin lagrede id.
- Svar: `serverData.rader` (`:7602`) og `hentEndringerSiden` (`:6158`) returnerer `kortId`, så telefonen får
  serverens id på rader ført på web.

### 4.2 Eldre klient (bakoverkompatibilitet)

| Situasjon | Hva skjer |
|---|---|
| Eldre mobil pusher rader uten `kortId` | Regel 2: kjent rad med uendret nøkkel beholder id. Regel 3: ny rad havner i sedelens eldste kort med samme nøkkel, ellers utledet id. To kort på samme nøkkel laget på ny klient/web **holdes adskilt** (radene deres er kjente). |
| Eldre mobil flytter en rad til annet prosjekt/underprosjekt | Nøkkelen er endret → regel 3. |
| Ny mobil mot eldre API (OTA før API-deploy) | Feltet strippes av Zod (M7). Ingenting feiler; id-en fylles av backfill/regel 3 når API-et er oppe. Rekkefølgen bør likevel være API først. |
| Eldre mobil leser svar med `kortId` | Ukjent felt ignoreres. |

Ingen router eller prosedyre bytter navn. Alle nye felt er valgfrie i minst én uke — i praksis varig, fordi regel 2/3
ikke fjernes.

### 4.3 Web og øvrige server-skriveveier

| Prosedyre | Endring |
|---|---|
| `tilfoyTimerRad` (`:2377`) | Valgfritt `kortId`. Uten: regel 3. |
| `oppdaterTimerRad` (`:2606`) | Uendret nøkkel → id står. Endrer kallet beskrivelsen på en arbeidsrad, skrives teksten på kortets øvrige arbeidsrader (K5). |
| `flyttTimerRadEco` (`:4536`, attestering) | Nøkkelen endres → regel 3; koblet maskin følger raden. |
| `splittRad` (`:5541`), `splittRadEier` (`:5779`) | Del 1 beholder id. Øvrige deler: samme id når nøkkelen er lik; ellers regel 3. Valgfritt `egetKort: true` pr. del gir ny id (§ 5.1). |
| `redigerSedelRader` (`:5043`) | Ny rad med `parentRadId` arver originalens id når nøkkelen er lik. |
| `forsonDagskort` (`:2859`) | Id følger forslagsraden. |
| `opprettForsteTimerRadForslag` (`:1587`) | Regel 3. |
| `tilfoyTilleggRad` (`:3375`), `tilfoyUtleggRad` (`:3632`), `maskin.tilfoy` (`:7842`) | Valgfritt `kortId`; koblet maskin → radens. |
| `vareforbruk.opprett/oppdater` (`vareforbruk.ts:495`) | Valgfritt `kortId`; koblet vare → radens (`gyldigVareRad` utvides); uten sedel → `NULL`. `vareforbrukSync` sender og leser feltet. |
| `hentMedId`, `hentForAttestering` | Returnerer `kortId`. Ingen visningsendring i attestering. |

---

## 5. Flater og paritet (ordrepunkt 4)

### 5.1 Mobil — Bekreft dag

- **Kort pr. kort-id.** Forslagets kort får id når forslaget bygges (`DagsforslagRad.kortId`): et kort som alt finnes
  på sedelen (manuelt tillegg på en påbegynt dag) beholder sin id; nytt kort får ny. Nøklene i `beskrivelsePerKort`,
  `tilleggPerRad` og kortvalget for tillegg/utlegg (`arbeidKort`) byttes fra utledet streng til `kortId`. Én kilde:
  `kortMedArbeid` (`beskrivelseKort.ts:71`) — ingen ny kopi.
- **Underprosjekt pr. kort, også i GPS-modus.** Chipsene i M11 vises pr. kort når prosjektet har underprosjekt, med
  «Uten» forhåndsvalgt. Valget skrives på kortets arbeidsrader, maskin og varer (som manuell modus i dag).
- **«Del til eget kort»** på en foreslått arbeidsføring: brukeren velger klokkeslett; tiden før blir i kortet, tiden
  etter blir nytt kort på samme prosjekt (ny id) med egen beskrivelse, eget underprosjekt/byggeplass-valg og eget sett
  maskin/varer. Normaltid/overtid regnes på nytt over dagen i tidsrekkefølge (§ 6), så overtidslinja havner i kortet
  der normen passeres. Kortene kan deles flere ganger (1–30 kort).
- **«+ Nytt prosjektkort»** kan velge et prosjekt som alt har kort i dag — også med samme byggeplass og underprosjekt.
- **Utkast:** `skjemaVersjon` økes; et utkast fra før kort-id lastes ved at gamle nøkler slås opp mot forslagets kort
  (samme (dato, prosjekt, byggeplass) → kortets id). Tekst og linjer som ikke finner kort, vises som foreldreløse
  slik `tilleggUtenRad` gjør i dag — aldri stille droppet.

### 5.2 Mobil — dagskortet i prosjektkort-modus

- **Ett kort pr. kort-id** i `ProsjektkortDagsoversikt`. ORDRE (27) del B bygger kortvisningen med linjer
  («07:00–15:00 · 7,5 t · Timelønn», «15:00–17:00 · 2,0 t · Overtid 50 %») på utledet nøkkel; kort-id-ordren bytter
  bare grupperingsnøkkelen — ett sted, i funksjonen (27) lager for å finne radens kort.
- Kortets beskrivelse én gang, kortets maskin og varer én gang, «Uten rad»-linjer i kortet de bærer id til.
- Kortlista (`kortNokler`, M2) grupperer på `kortId`; sortering som i dag (prosjekt i første-forekomst-rekkefølge,
  byggeplass, underprosjekt), og kort med lik nøkkel i tidsrekkefølge etter første linje.
- Kortskjermens rute får `kort=<kortId>`; `bp`/`up` beholdes for kort uten rader og gamle lenker (M19).

### 5.3 Dagskort-modus (firma som ikke bruker prosjektkort)

Skjermen er urørt. Radene får `kort_id` via regel 3 i skriveveien (`TimerSeksjon`/`MaskinSeksjon` og `radLagring`
får samme nye felt, så `radLagring-glue-vakt` fortsatt sammenligner like nøkkelsett). Bytter firmaet modus senere,
finnes kortene alt.

### 5.4 Web og attestering/eksport

- **Web dagsseddel:** samlesiden går fra kort pr. prosjekt (M13) til kort pr. `kortId`, med samme linjeform som
  mobil, «+ Nytt prosjektkort» (også på prosjekt som har kort) og underprosjekt/byggeplass i kortets hode.
  `TimerRadDialog` sender `kortId` når den åpnes fra et kort.
> ⚠️ **SNUDD av Kenneth 2026-11-16** (etter test av attestering på test.sitedoc.no, `3ac572e2`): *«det er svært viktig at det førte prosjektkortet -> følger hele veien -> attestering -> fakturering -> timer skal deles opp. prosjektnummer henger heller ikke sammen med timeradene»*. Målt samme dag: attesteringskortet grupperer bare på (prosjekt, underprosjekt) (`SeddelKort.tsx:297`), timerader står i lagringsrekkefølge, maskinrader står samlet etter alle timerader (`:704`) selv om `sheetTimerId` kobler dem til sin timerad, og ukevarselet «overtid ført under norm» (`Avviksbadge.tsx`) peker ikke på raden. 🟡 **Ikke bygget — Fabel spesifiserer (SPEC-TILLEGG 2026-11-16 «kortet følger hele veien»), deretter ordre.** Det forkastede står under.
>
> ~~**Attestering:** viser fortsatt bøtter pr. (prosjekt, underprosjekt). Ingen kortvisning i denne specen.~~
> ~~**Eksport/rapport/PDF:** urørt. Ingen leser grupperer på kort (M3), og alle beløp følger radenes egne felt.~~

- **Attestering, eksport/fakturering og rapport (🟡 ny retning 2026-11-16):** prosjektkortet slik det ble ført (`kortId`) skal følge raden hele veien: kortet vises samlet i attesteringen, med timer, maskin og varer under sin timerad, og fakturering/eksport skal kunne dele opp timene pr. kort. Detaljene kommer i SPEC-TILLEGGET.
- **Visningskrav (Kenneth 2026-11-16, 🟡 ikke bygget):** *«vi skal ha en oversiktsrad med informasjon. i hver rad er det faste felter med informasjon. -> et excelark med en beskrivende topprad som er synlig hele tiden. Timerader kommer under. vi må presentere lønnsart i en fast kolonne, fra til i en annen kolonne. Kolonner må kunne flyttes.»* Maskin- og varerader skal vise hva de er og hva mengden er (*«hva er 6m3 … jeg kan ikke lese hvilken vare vi har brukt»*). Varsler skal si hvilken norm (dag/uke/måned) og hvilken rad (*«hvilken norm? … en gjettekonkuranse»*). Fakturagrunnlaget til kunden følger samme struktur.
- **Total overhaling av attesteringen (Kenneth 2026-11-16, 🟡 ikke bygget):** gjelder alle fanene (Sedler, Etter prosjekt, Etter ansatt) og prosjektattesteringen. *«all informasjon som tilhører et prosjektkort må vises i en timerad -> ingen ting kan utelates.»* · *«den som attestesterer må selv kunne flytte kolonner, sortere i kolonner, filtrere i kolonner.»* · *«alt i et prosjektkort skal vises i en enkelt rad etterhverandre»* · *«du påstår at dette er attesteringer slik de så ut for mange månder siden -> det betyr ikke at dette var bra da heller»*. Fabel spesifiserer i § 12.

### 5.5 Paritetsmatrise

| Funksjon | Mobil i dag | Mobil etter | Web i dag | Web etter |
|---|---|---|---|---|
| Kortets identitet | Utledet nøkkel (M1) | `kortId` | Prosjekt (M13) | `kortId` |
| To kort, samme prosjekt + byggeplass + underprosjekt | Umulig (M2) | Ja | Umulig | Ja |
| Underprosjekt på kortet | Manuell Bekreft dag + kortskjerm | Også GPS-Bekreft dag | På raden (dialog) | I kortets hode |
| Splitt foreslått føring til eget kort | Nei | «Del til eget kort» | — (ingen Bekreft dag på web) | «Del opp» med «eget kort» |
| Linje: tid · timer · lønnsart | Boks pr. rad (M12) | Linje i kortet ((27) B) | Rad i tabell | Linje i kortet |
| Én beskrivelse pr. kort | Bekreft dag (ORDRE 24) | Bekreft dag + dagskort | Pr. rad | Pr. kort (K5) |
| Lønnsart-forslag fra døgnet | Bare V21 i rad-vindu | Bekreft dag (GPS + manuelt) + V21 | V21 i rad-dialog | V21 (uendret) |
| Lønnsartvalg pr. linje | Bare i rad-vinduet etter lagring (M24); Bekreft dag: kun overtidsnivå (M23) | Pr. linje i Bekreft dag (§ 6.1) + forhåndsvalg i rad-vinduet | `<select>` i rad-dialogen | Uendret |

Web har ingen Bekreft dag; lønnsart-forslaget der er fortsatt V21-linja i rad-dialogen.

---

## 6. Lønnsart-forslag fra døgnets registreringer (ordrepunkt 5)

**Én regel, én kilde:** `klassifiserArbeidstid` i `packages/shared/src/utils/lonnsregel.ts` får ett valgfritt
inndata, `bruktAvNorm` (timer, standard 0). Ingen ny funksjon, ingen kopi; `velgOvertidLonnsart` velger lønnsart som
i dag. Alle eksisterende kallere (M16) sender ikke feltet og er uendret.

| # | Regel |
|---|---|
| L1 | **Grunnlag:** alt arbeid som alt står på datoens sedel — alle kort, alle arbeidsrader, også rader ført som overtid. Ikke reise (V1), ikke rader med `attestertStatus = 'erstattet'`, **ikke fravær** (lønnsart `type = 'fravaer'`, Kenneth 2026-11-16, B8 i § 10): arbeid etter fravær er vanlig arbeidstid, ikke overtid. Bygget i a3: `bruktAvNorm` teller ikke rader med `erFravaer`; a2 flyttet den til `packages/shared/src/utils/lonnsregel.ts` (🟡 `fix/kort-a2-norm-shared`, ikke merget). |
| L2 | **Rest av normen** = `max(0, dagsnorm − bruktAvNorm)`. Kortet som bygges får normaltid opp til resten, deretter overtid. Rest 0 → alt overtid. |
| L3 | **Ukjent norm** (`dagsnorm ≤ 0`, M17): ingen splitt, alt normaltid, markør som i dag. «Rest 0» og «ukjent norm» er to ulike tilstander og må aldri gå i samme gren (fallgruven i `dagsforslag.ts:1626`). |
| L4 | **Samme sted for GPS og manuelt kort:** `beregnSegment` (`dagsforslag.ts:1623–1653`). `eksisterendeSedelPerDato` utvides fra bare tidsrom (M15) til også å bære arbeidstimer uten reise. `manuellDag.ts` trenger ingen egen regel. |
| L5 | **Eksisterende rader røres aldri.** Etterregistreres et kort tidligere på dagen enn det som alt står, er det det *nye* kortet som får overtiden. Arbeideren retter selv om det er feil. |
| L6 | **Flere kort i samme forslag** (etter «Del til eget kort»): normen fylles i tidsrekkefølge over kortene; overtid blir egen linje i kortet der normen passeres. |
| L7 | **Overstyring:** arbeideren kan føre tiden som ordinær (avtalt med sjefen) — i Bekreft dag via overtid-editoren (`overtidFra`, `overtidLonnsartId`), i kortet via rad-vinduets lønnsartvelger. Ingenting låses. |
| L8 | **Synlig forslag:** linja viser lønnsarten (definisjonen). Ingen ekstra banner. |

**Hva (27) del A alt dekker:** L1–L4 og L7 for manuelt kort. Denne specen legger til at regelen bor i
`klassifiserArbeidstid` (delt kilde navngitt), at GPS-dagen får samme grunnlag (L4), og L5–L6.

### 6.1 Lønnsartvalg pr. linje (TILLEGG, Kenneth 2026-11-16)

> Kenneth: *«manuell registrering mangler kanskje valg av lønnsart, spesielt for timer som føres over dagsnorm».*

Målt: det stemmer (M22, M23). Arbeideren kan i dag bare flytte grensen mellom standardart og overtid og velge
overtidsnivå; ingen annen lønnsart kan velges i Bekreft dag. Rad-vinduet har velger (M24), men den nås først etter at
kortet er lagret.

| # | Regel |
|---|---|
| V1 | **Hver arbeidslinje i kortet har sin lønnsart synlig og valgbar** i Bekreft dag — GPS og manuelt kort likt: «07:00–15:00 · 7,5 t · Timelønn ▾». Trykk på lønnsarten åpner valget. |
| V2 | **Forhåndsvalg** følger § 6 (L1–L3): standardarten til normen er brukt, deretter overtidsarten for nivået. Ingen linje står uten forhåndsvalg når firmaet har artene; mangler overtidsart, vises linja med amber «Velg lønnsart» i stedet for å droppes stille (erstatter dagens telling i M22 for denne skjermen). |
| V3 | **Forhåndsdefinerte valg, ikke fritekst:** chips når firmaet har inntil seks aktuelle arter, ellers den søkbare lista rad-vinduet bruker (`LonnsartVelgerModal`). To grupper: «Ordinær» (uten `overtidsnivaa`) og «Overtid» (med). |
| V4-⚠️ | **SNUDD av Kenneth 2026-11-16 (B6):** *«Vi må kunne føre fravær på \"prosjektkort\"».* Fravær-arter (`type = 'fravaer'`) tilbys på kortet i tillegg til ordinær og overtid. Teksten under om at fravær ikke tilbys gjelder ikke. Fraværskortet har **ikke prosjekt** (Kenneth 2026-11-16, B6 i § 10) — skjema, synk, flater og flyt i § 11. Feriepenger og diett: ikke avgjort — tilbys ikke før Kenneth sier noe annet. |
| V4 | **Hvilke arter tilbys:** firmaets aktive lønnsarter med `type = 'ordinaer'`. Reise-arter (valgt reiseart, båndarter, `erReiseLonnsart`) tilbys ikke — reise føres med «+ Reise». Fravær, feriepenger og diett tilbys ikke på et prosjektkort (**B6**). |
| V5a | **Av/på med samme knapp (Kenneth 2026-11-16):** *«Hvorfor ikke bare trykke en gang til på blått felt, så blir feltet hvitt?»* Trykk på valgt nivå-knapp (blå) fjerner overtiden — linja blir standardart, «Overtid fra» skjules. Trykk på en hvit knapp velger nivået (og legger overtid tilbake fra forrige «Overtid fra», ellers arbeidsstart). Bygges i ordre a, rett i dagens editor (`bekreft-dag.tsx`), før V1–V3. |
| V5 | **Grensen mellom linjene** er fortsatt «Overtid fra» −/+ (M23). Lønnsarten velges pr. linje; nivå-chipsene i editoren blir samme valg som linjas. Lenken «+ Legg til overtid» beholdes. |
| V6 | **Overstyring til ordinær:** velger arbeideren en ordinær art på linja etter normen, lagres linja slik. Har de to linjene da samme art og ligger inntil hverandre, vises de som én linje (forslaget regnes på nytt — lagrede rader slås aldri sammen). |
| V7 | **Valget huskes i forslaget** (`retting`): ny `lonnsartPerLinje` ved siden av `overtidFra`/`overtidLonnsartId`. Endres tidene så linja forsvinner, faller valget bort med den — aldri over på en annen linje. Utkastet lagrer valget. |
| V8 | **Rad-vinduet i prosjektkortet («+ Timer»):** ny rad forhåndsvelger art etter samme regel (norm brukt → overtidsart). V21-linja står som i dag. Dagskort-modus er urørt. |
| V9 | **Sporbarhet:** en linje der arbeideren har valgt ordinær art etter at normen er brukt, lagres som vanlig rad. Attestanten ser det alt i dag: `beregnOvertidsgrunnlag` sammenligner ført overtid med overtid regnet fra normen og setter `avvik` (`packages/shared/src/utils/overtidsgrunnlag.ts:59–80`; brukt i web-attesteringens `DagsKort.tsx` og `sedel-vurdering.ts`). Ingen ny markør. |

**Henger lønnsart sammen med arbeidets art og kort-id?** Ikke i datamodellen (M25). Lønnsarten sier hva den ansatte
får betalt; arbeidets art (kontrakt/regning) sier hva kunden skal betale, og bæres i dag av underprosjektet
(`proAdmType`) og beskrivelsen. Kort-id gjør at grøft og skifer kan være to kort; det krever ikke ulik lønnsart.
Fører et firma egne lønnsarter for regningsarbeid, dekkes det av V1–V4 uten mer modell. Skal *kortet selv* bære
«kontrakt/regning» som eget valg, er det en ny egenskap ved kortet som ikke står på radene i dag — det er Kenneths
valg (**B7**) og eneste sted der B1 (kolonne eller tabell) får betydning for brukeren.

🟡 **Funn F-L2 (lest av koden, ikke kjørt):** `LonnsartVelgerModal` henter aktive lønnsarter uten filter på firma
(`TimerSeksjon.tsx:2318–2326`), mens resten av katalogoppslagene filtrerer (`hentLonnsarterLokalt`,
`timerKatalog.ts:200–216`). En bruker med lønnsarter fra to firma i lokal cache kan da se og velge det andre firmaets
art; serveren avviser den (katalog-mismatch → `avvist`). Meldes; rettes når velgeren likevel røres (V3).

🟡 **Funn F-L1 (lest av koden, ikke kjørt):** V21-linja i rad-vinduet (`foreslaOvertidSplitt`) teller rader som alt
står på overtid mot dagens sum, men trekker dem ikke fra overskuddet (`overtidForslag.ts:116–120`). Med en overtidsrad
*tidlig* på dagen (05–07 overtid, deretter 07–15 normal, norm 7,5 t) foreslår den å gjøre 2 t til av 07–15 om til
overtid — 4 t overtid på en dag med 2 t over norm. Etter L5 blir en tidlig overtidsrad vanligere. Anbefalt retting:
forslaget gjelder bare `sum − norm − alt ført som overtid`. Det endrer en eksisterende funksjon (V21) → **B3**.

---

## 7. Funksjonsinventar (ordrepunkt 6)

Ingen funksjon fjernes. «ENDRES» betyr at funksjonen virker som før for brukeren, men bytter fra utledet nøkkel til
`kortId`, eller får et valgfritt tillegg.

| Funksjon | Kode | Status |
|---|---|---|
| V21 overtidslinje i rad-vinduet | `overtidForslag.ts:72`; `TimerSeksjon.tsx:1607`; `page.tsx:3051` | **BEVARES.** Funn F-L1 → B3. |
| Overtid-editoren i Bekreft dag («+ Legg til overtid», «Overtid fra» −/+, nivå-chips) | `bekreft-dag.tsx:1906–1962`; `stegOvertidFra`, `leggTilOvertidRetting` | **BEVARES;** nivå-chipsene blir samme valg som linjas lønnsart (§ 6.1 V5). |
| Lønnsartvelgeren i rad-vinduet | `LonnsartVelgerModal` (`TimerSeksjon.tsx:2306`); web `<select>` (`page.tsx:3343`) | **BEVARES** med alle typer i dagskortet. **ENDRES:** gjenbrukes i Bekreft dag med filter (V4); ny rad i prosjektkortet får forhåndsvalg (V8). Funn F-L2. |
| Rad droppet uten lønnsart | `raderDroppetUtenLonnsart` (`dagsforslag.ts:1667–1670`) | **ENDRES** i Bekreft dag: linja vises med «Velg lønnsart» (V2). Tellingen står for Slutt dag-meldingen. |
| «Del opp» | `SplittRadModal.tsx:277–304`; `splittRad`/`splittRadEier` | **ENDRES:** deler arver `kortId`; nytt valg «eget kort». 🟡 Funn: nye deler mister radens byggeplass (M18) — rettes i samme ordre (K4 krever det). |
| «Flytt raden» | `KortValgModal` (modus `flytt`), `kortRadFlytt.ts` | **ENDRES:** raden får målkortets id; mål kan være «nytt kort». Koblede maskiner/varer følger som i dag. |
| «Endre kort» / «Slett kort» | `kort/[projectId].tsx:119`, `:645–652` | **ENDRES:** virker på alle rader med kortets id, ikke på nøkkel-treff. Id-en beholdes ved endring. |
| «+ Nytt prosjektkort» / «+» | `KortValgModal` (modus `ny`), `manuellDag.ts` | **ENDRES:** tillater prosjekt/nøkkel som alt har kort. |
| Kortlås | `useKortLaas`, `ProsjektkortKontekst`, `TimerRadModal` | **ENDRES:** konteksten bærer `kortId`; ny rad får kortets id. Låsing av prosjekt/byggeplass/underprosjekt som før. |
| Én beskrivelse pr. kort (ORDRE 24) | `beskrivelseForRad`, `manglerBeskrivelse` | **ENDRES:** nøkkel → `kortId`; gjelder også dagskort og web (K5). |
| Ett sett maskin/varer pr. kort | `tilleggPaaKort`, `fordelTilleggPaaKort` | **ENDRES:** nøkkel → `kortId`. Fordeling på rader som før. |
| Aldri to datoer | `radKortId`, `kortMedArbeid` | **BEVARES** — følger av K1. |
| Tillegg/utlegg følger datokortet (25) | `knyttLonnUtleggTilKort`, `kortForLinje`, `sedelPerDato` | **ENDRES:** linja bærer valgt korts id. Standardvalg (`kortMedFlestTimer`) som før. |
| (26) stopp når valgt dato er sendt | merget `780f388c` (develop) | **BEVARES.** Kort-id-ordren for Bekreft dag bygger oppå (26); vakten og omregningen av kortene skal stå. |
| `maskinOverTak` og maskin ≤ arbeid | `ProsjektkortDagsoversikt.tsx:332`; server `validerMaskinUnderArbeid` | **BEVARES** pr. (prosjekt, underprosjekt)-bøtte. Konsekvens med to kort i samme bøtte → B4. |
| Send-sperre og lagre-sperre (beskrivelse) | `forsteRadUtenBeskrivelse`, `radManglerBeskrivelse` | **BEVARES.** |
| Matpause (én bærer pr. sedel) | `handterPauseToggle`, `pauseBaererProsjekt` | **BEVARES** — pausen bæres av en rad, ikke av et kort. |
| Reise skilt fra arbeid, reisekjede (17) | dag-seksjonen, `reiseManuell.ts` | **BEVARES** — reise har ikke kort (§ 2.2). |
| «Uten rad» | `raderForDag` | **BEVARES** — vises i kortet linja bærer id til. |
| Overlapp PC ↔ mobil (V19), radversjoner (V19.9), forsoning | `SheetTimerForslag`, `forsonDagskort`, `timerSync.ts` | **BEVARES** — id-en følger raden. |
| Rader slås aldri sammen | — | **BEVARES.** |
| Utkast | `prosjektkort_utkast_local` | **ENDRES:** `skjemaVersjon`; gammelt utkast lastes (§ 5.1). |
| Attestering, eksport, rapport, PDF | `apps/api/src/routes/timer/rapport.ts` m.fl. | ~~**BEVARES** uendret.~~ ⚠️ Snudd av Kenneth 2026-11-16 — inventaret står i § 12.5. |
| Vakter | `dagskort-isolert-vakt`, `radLagring-glue-vakt`, `prosjektkort-glue-vakt` | **ENDRES bevisst** der skrivefelt legges til; hver endret påstand begrunnes i leveransen. |

---

## 8. Ordre-oppdeling (ordrepunkt 7)

| Ordre | Innhold | Rører | Skjema | Kenneth ser etterpå |
|---|---|---|---|---|
| **a** = (27), alt bestilt | Lønnsart-forslag for manuelt kort fra døgnets registreringer (L1–L4, L7). Dagskortet: ett kort pr. prosjektkort med linjer, på utledet nøkkel. | `manuellDag.ts`, `dagsforslag.ts` (norm-inndata), `dagsoversiktRader.ts`, `ProsjektkortDagsoversikt.tsx` | Nei | 17–18 etter 9,5 t blir Overtid 50 %. Overtid står som linje i kortet. |
| **a2** (liten) 🟡 `fix/kort-a2-norm-shared` (bygget, ikke merget) | Regelen inn i `klassifiserArbeidstid` (`bruktAvNorm`), GPS-dagen får samme grunnlag (L4), L5. F-L1 hvis B3 = ja. Bygget: `lonnsregel.ts` (`klassifiserArbeidstid` + `bruktAvNorm`), `lesEksisterendeSedel` i `dagsforslagInput.ts` (GPS + manuell), F-L1 i `overtidForslag.ts`; `overtidMotDognet.ts` slettet. | `lonnsregel.ts`, `dagsforslagInput.ts`, `overtidForslag.ts` | Nei | GPS-dag oppå manuelle rader gir riktig overtid. |
| **a3** | Lønnsartvalg pr. linje i Bekreft dag (§ 6.1 V1–V7), forhåndsvalg i prosjektkortets rad-vindu (V8), firmafilter i velgeren (F-L2). | `bekreft-dag.tsx`, `dagsforslag.ts` (`retting`), `TimerSeksjon.tsx` (`LonnsartVelgerModal`), `prosjektkortUtkast.ts`, i18n | Nei | Lønnsart kan velges på hver linje før lagring, også for timer over normen. |
| **b** | Kort-id: to migreringer (§ 3), `løsKortId`/`utledKortId`/`validerKortInvariant` i shared, server-skriveveiene (§ 4), mobilens lokale kolonner + backfill + synk. Ingen UI-endring. | `packages/db-timer`, `packages/db-varelager`, `packages/shared`, `dagsseddel.ts`, `vareforbruk.ts`, `migreringer.ts`, `timerSync.ts`, `vareforbrukSync.ts`, lokale skriveveier | **Ja — Kenneth kjører to migreringer** (+ én fil i `packages/db` for F1, § 11.8 — samme kommando) | Ingenting endret på skjermen. Gate-SQL gir 0. |
| **c** | Mobil på kort-id: Bekreft dag (§ 5.1), dagskortet og kortskjermen (§ 5.2), Flytt/Endre/Slett, «Del til eget kort», underprosjekt i GPS-modus. | `bekreft-dag.tsx`, `beskrivelseKort.ts`, `prosjektkortMobil.ts`, `kortRadFlytt.ts`, `SplittRadModal.tsx`, kortskjermen | Nei | Grøft og skifer som to kort på samme prosjekt, hver med egen beskrivelse og egne linjer. |
| **d** | Web: samleside pr. kort-id, kortets hode, «+ Nytt prosjektkort», `kortId` fra dialogene (§ 5.4). | `apps/web/…/timer/[id]/page.tsx`, `packages/shared/…/prosjektkort.ts` | Nei | Samme kort på PC som på telefon. |
| **e** (neste release) | Steg 2: etter-backfill + `CHECK` (§ 3.4). | `packages/db-timer`, `packages/db-varelager` | **Ja — Kenneth kjører** | Ingenting. |

Rekkefølge: a → a2 → a3 → b → c → d → e. a3 trenger ikke kort-id og kan leveres før skjemaet; den rører `bekreft-dag.tsx` og må derfor ikke gå samtidig med c. **b må i prod (API) før c sendes som OTA.**
a og b rører ulike filer og kan gå parallelt hvis to agenter er ledige. Mellom c og d viser web grøft og skifer i
samme prosjektkort (B5). **Fraværskort uten prosjekt** og **taket for betalt fravær (B10)** rir på b, c og d — fordelingen står i § 11.8. **Kortet gjennom attestering, eksport og rapport** — med total overhaling av attesteringen — er egne ordrer d2a, d2b-1, d2b-2, d3 og c2 — § 12.6 (🟡 forslag).


### 8.1 Bygget — ordre b (Kort-id-b, merget `eca8dd1f`)

**b1 — kort-id (2026-11-16).** Migreringene er ikke kjørt mot test eller prod.

| Del | Kode |
|---|---|
| Migrering db-timer, steg 1 (kolonner, backfill 1–6, indekser) | `packages/db-timer/prisma/migrations/20261116120000_kortid_fravaer_normtak/migration.sql` (b2 og b3 legger `uten_prosjekt` og `fravaer_normtak` i samme fil) |
| Migrering db-varelager | `packages/db-varelager/prisma/migrations/20261116120100_kortid_vareforbruk/migration.sql` |
| Regel og invarianter (shared) | `packages/shared/src/utils/kortId.ts` — `utledKortId`, `losKortId` (spec-navn `løsKortId`; ASCII-navn som resten av repoet), `validerKortInvariant` (K1–K4, K6); `kortNokkel`/`fraKortNokkel` flyttet fra mobil til `packages/shared/src/utils/prosjektkort.ts` |
| Server (§ 4) | `apps/api/src/services/timer/kortId.ts` (`sikreKortId`, `kortIdForSkriving`, `validerOppgittKortId`, `lastLagretKort`, `vareKortIdForSkriving`); kalt fra skriveveiene i `apps/api/src/routes/timer/dagsseddel.ts` og `apps/api/src/routes/vareforbruk.ts`. `kort_id` skrives bare når den endres |
| Mobil (§ 3.3) | Kolonner i `apps/mobile/src/db/schema.ts`, ALTER + backfill i `apps/mobile/src/db/migreringer.ts`; regelen i `apps/mobile/src/utils/kortIdNormalisering.ts`; `sikreLokalKortId` i `apps/mobile/src/services/kortIdLokal.ts`, kalt etter hver lokal skriving og før push i `timerSync.ts`. Ingen UI-endring |
| Tester | T3/T4 `apps/api/src/routes/kortid-migrering.integration.test.ts`; T5–T9 `apps/api/src/routes/kortid-skriveveier.integration.test.ts`; regelen `packages/shared/src/utils/kortId.test.ts`; mobil T4/T5 + skrivevei-vakt `apps/mobile/src/services/kortIdLokal.test.ts` |

Avvik fra specen, meldt i SJEKKPUNKT b1:
- **K5 er ikke bygget.** § 4.3 krever K5 i `oppdaterTimerRad`. Det kan endre dagskort-modus. Venter på avklaring.
- **K6 håndheves bare når maskin- eller vareraden har samme prosjekt** som timerraden.
- **Vare-push fra mobil sender ikke `kortId` i b.** Serveren bruker regel 2 og 3, ellers kunne ulik lokal id gi to kort med samme nøkkel (K7).
- **Lokal alder er typeorden + rowid**, fordi telefonen ikke har et felles opprettet-tidspunkt.
- **Lokal normalisering endrer verken `syncStatus` eller `sistEndretLokalt`.**

**b2 — fravær uten prosjekt og F1 (2026-11-16).** Migreringene er ikke kjørt mot test eller prod.

| Del | Kode |
|---|---|
| Migrering db-timer (`uten_prosjekt`, `project_id` nullable, CHECK på timer og forslag) | samme fil som b1: `packages/db-timer/prisma/migrations/20261116120000_kortid_fravaer_normtak/migration.sql` |
| Migrering db (F1) | `packages/db/prisma/migrations/20261116120200_fravaer_attesteres_av_prosjektleder/migration.sql` — `organization_settings.fravaer_attesteres_av_prosjektleder`, default `false` |
| Regel (shared) | `packages/shared/src/utils/utenProsjekt.ts` — `validerUtenProsjekt` (lønnsart = fravær; CHECK kan ikke lese lønnsarten) |
| Server, skriveveier og eldre klient (§ 11.3) | `apps/api/src/routes/timer/dagsseddel.ts` — `krevGyldigUtenProsjekt` i `tilfoyTimerRad`, `oppdaterTimerRad`, `redigerSedelRader`, splitt og `syncBatch` (`kjentUtenProsjekt`: kjent uten-prosjekt-rad med fraværsart beholder flagget; oppslaget kjøres bare for fraværsrader uten flagg) |
| Server, F1 | samme fil — `kanAttestereFravaer`, `fravaerRettPrSedel`, `krevAttesteringsrett`; `hentForAttestering` returnerer `fravaerKanAttesteres`. Firmavalget i `apps/api/src/routes/organisasjon.ts`; F7 i `apps/api/src/routes/timer/lonnsart.ts` (kaller `lonnsartBruktUtenProsjekt`) |
| Lesere | `apps/api/src/routes/timer/rapport.ts` (`sedelUtvalgRapport`, `fravaerEtikett`); web `apps/web/src/lib/timer-rapport-eksport.ts` |
| Web (b-visning) | «Fravær» for null-prosjekt i `apps/web/src/components/attestering/attestering-buckets.tsx` (`radIKontekst`), `AttesteringPivot.tsx`, `DagsKort.tsx`, `SeddelKort.tsx`, `apps/web/src/components/timer/AttesteringDetalj.tsx`, `AttesteringDetalj_Edit.tsx`, `apps/web/src/app/dashbord/firma/timer/attestering/page.tsx`, `apps/web/src/app/dashbord/timer/[id]/page.tsx`. F1-avkrysning i `apps/web/src/app/dashbord/firma/innstillinger/page.tsx` (hjelpetekst i `hjelpetekster.md`) |
| Tester | TF1–TF7, TF11, TF26, TF27 i `apps/api/src/routes/fravaer-uten-prosjekt.integration.test.ts` (29); regelen i `packages/shared/src/utils/utenProsjekt.test.ts` (10) |

Avvik og funn, meldt i SJEKKPUNKT b2:
- **Fra/til-sperren unntar rader uten prosjekt** i `tilfoyTimerRad`, `oppdaterTimerRad`, splitt og `redigerSedelRader`. Hjemmel F3 (bare timer på fravær) og FM14; specen sier det ikke uttrykkelig.
- **Penn og ✂ er skjult for fraværsrader på web** (SeddelKort, rediger-splitt). Ingen eksisterende funksjon er fjernet; radene er nye. Nye fraværsrader legges ikke til via web-redigering (ordre d).
- **`oppdaterTimerRad` avviser** prosjekt, underprosjekt, byggeplass eller maskin på en uten-prosjekt-rad, og bytte til en lønnsart som ikke er fravær.
- **F7-sjekken (`lonnsartBruktUtenProsjekt`) bor i `dagsseddel.ts`**, ikke i `lonnsart.ts`, fordi V19-vakten (1d) bare tillater forslagstabellen der. Den er en eksistenssjekk (`findMany`, `id`, `take: 1`).
- **`hentTilAttesteringFirma` gir tom liste når firmaet har null prosjekter**, også om det finnes fraværssedler. Kantfall, ikke rettet.
- **Gate-SQL § 3.4 gate 2** står uten `coalesce(project_id,'ingen')` i specteksten; § 11.2 sier at den skal endres. Målt med coalesce.

**b3 — B10 fravær med tak og F-F1 (2026-11-16).** Migreringen er ikke kjørt mot test eller prod.

| Del | Kode |
|---|---|
| Migrering db-timer (`fravaer_normtak` NOT NULL DEFAULT true + backfill) | samme fil som b1/b2: `packages/db-timer/prisma/migrations/20261116120000_kortid_fravaer_normtak/migration.sql` (setningen under `-- B10-BACKFILL:`) |
| Skrivere | seed `apps/api/src/services/seed/index.ts`, import `apps/api/src/services/katalog/importerKatalog.ts`, `opprett`/`oppdater` i `apps/api/src/routes/timer/lonnsart.ts` — uten feltet → `true` |
| Regel (shared) | `packages/shared/src/utils/fravaerNormtak.ts` — `harNormtak` (eneste leser av markøren, glue-vakt i testen), `vurderFravaerNormtak`, `restForFravaerMedTak`, `byggNormtakBruddLinje`; F-F1 i `packages/shared/src/utils/overtidsgrunnlag.ts` (`beregnUkeOvertidsgrunnlag`, `ukeTimer`) |
| Server, skriveveier | `apps/api/src/routes/timer/dagsseddel.ts` — `krevFravaerInnenforTak` i `tilfoyTimerRad`, `oppdaterTimerRad`, `redigerSedelRader`. Avviser bare når fravær med tak øker og dagen er i brudd etterpå; arbeid og fravær uten tak avvises aldri |
| Server, synk | `syncBatch` lagrer alltid; `fravaerNormtakBrudd` (tall) i resultatet når dagen er i brudd |
| Server, attestering (F9 = A) | `krevIngenNormtakBrudd` i `attester` og `attesterRader` (hele datoen sperres, også arbeidsrader). Leserne `hentTilAttesteringFirma`, `hentTilAttestering`, `hentForAttestering` returnerer `fravaerNormtakBrudd` |
| Server, ukegrunnlag (F-F1) | `byggUkeOvertidsgrunnlag` grupperer pr. dato; fravær fyller bare dagens norm i `ukeTimer`, aldri arbeid eller overtid |
| Web | lønnsartoppsettet `apps/web/src/app/dashbord/firma/timer/lonnsarter/page.tsx` (avkrysning + «Fravær · med tak», `apps/web/src/lib/lonnsartTypeEtikett.ts`); bruddlinje og sperret ✓ i `SeddelKort.tsx`, `AttesteringDetalj.tsx`, `apps/web/src/app/dashbord/[prosjektId]/timer/attestering/page.tsx` (`apps/web/src/lib/normtakBrudd.ts`); `ukeTimer` i `AttesteringPivot.tsx` og firma-attesteringen |
| Tester | TF13, TF16 (server), TF17, TF18 i `apps/api/src/routes/fravaer-normtak.integration.test.ts` (21; 14 røde mot b2-koden); TF14, TF15, TF25 i `packages/shared/src/utils/fravaerNormtak.test.ts`; TF8, TF16 i `overtidsgrunnlag.test.ts`; TF19 i `apps/web/src/__tests__/b10-normtak-visning.test.ts` |

Avvik og funn, meldt i SJEKKPUNKT b3:
- **Mobil er ikke endret** (ordren: ingen mobil-UI). Mobilens ukebadge og attesteringsliste viser ikke bruddet; serveren sperrer attesteringen likevel.
- **Web-pivoten og DagsKort har ingen egen sperre**; serveren avviser med tallene i feilmeldingen.
- **`attester` og `attesterRader` sjekker hele datoen** (RETUR (30) A1: alt attestert fravær kan komme i brudd når arbeid føres senere, N5). Normen slås bare opp når datoen har fravær med tak.
- **Lønnseksporten tar også uattesterte rader** (`rapport.ts` `detaljEksport`/`firmaPeriodeRapport` filtrerer bare `erstattet`; radstatus er en kolonne). En dag i brudd kan derfor stå i eksporten som `pending`. Ikke endret.
- Fixture i `firmagrense-attestering.test.ts` fikk `sheet.dato` fordi ukegrunnlaget nå grupperer pr. dato.

### 8.2 Bygget — ordre c (Kort-id-c, `feat/kortid-c-mobil`, ikke merget)

🟡 Bygget 2026-11-16, ikke merget, ikke sendt som OTA. Bare `apps/mobile`, `packages/shared` og docs; ingen server-, web- eller skjemaendring. Krever at b (API) er i prod før OTA (§ 8).

**c3 — B10 på telefon og F12 = A.**

| Del | Kode |
|---|---|
| F12 = A: «Fravær til» fjernet, fravær-arter ut av linjevelgeren (F5) | `apps/mobile/app/timer/bekreft-dag.tsx`, `apps/mobile/src/utils/dagsforslag.ts`, `apps/mobile/src/utils/linjeLonnsart.ts` (`2f713760`) |
| Lokal katalogkolonne `fravaer_normtak` (TF20) | `apps/mobile/src/db/schema.ts`, `migreringer.ts`, `apps/mobile/src/services/timerKatalog.ts` (`dccff918`) |
| Bruddlinje med ett-trykks retting, send-sperre, tak i rad-vinduet, F5 for ny rad, brudd i attesteringslista (TF23, TF24) | `apps/mobile/src/utils/fravaerNormtakMobil.ts`, `TimerSeksjon.tsx`, `ProsjektkortDagsoversikt.tsx`, `apps/mobile/app/timer/attestering/index.tsx` (`5da573ce`) |
| U12: taket leser bare datoens eget dagsnorm-svar | `hentDagsnormLokalt(…, { kunEksakt })` i `apps/mobile/src/services/arbeidstidSvarKatalog.ts` (`a1eac3f5`); vakt `normtakEksakt-vakt.test.ts` |

**c2 — fraværskort uten prosjekt (§ 11.5).**

| Del | Kode |
|---|---|
| Datalaget: `uten_prosjekt` lokalt, synk, kort-id-nøkkel «ingen» | `KortValg.projectId: string \| null` og `radProsjektId` i `packages/shared/src/utils/prosjektkort.ts`; `sheet_timer_local.uten_prosjekt` i `schema.ts`/`migreringer.ts`; `apps/mobile/src/utils/utenProsjektSynk.ts`, `timerSync.ts`, `forsoningSpeil.ts`, `kortIdNormalisering.ts` (`486c9658`) |
| U6 aktivitet, «Del opp» på fraværsrad | `fravaerAktivitetId` i `apps/mobile/src/services/nyTimerRad.ts`; `apps/mobile/src/utils/splittFravaer.ts`, `SplittRadModal.tsx` (`a1eac3f5`) |
| Fraværskortet på dagskortet: «+ Fravær», art/timer/beskrivelse, tak, lagring (TF3, TF9, TF22, TF27) | `apps/mobile/src/utils/fravaerKort.ts`, `prosjektkort/FravaerKortModal.tsx`, `prosjektkort/fravaerKortLagring.ts`, `ProsjektkortDagsoversikt.tsx` (`29cf31ff`) |
| «+ Fravær» i Bekreft dag (U1 inngang 2), U8 bare for arbeidskort | `prosjektkort/fravaerKortDag.ts`, `bekreft-dag.tsx` (`0c92afd3`) |
| F6: dagskort-modus viser fravær uten prosjekt i lese-gruppa «Fravær» (TF10) | `apps/mobile/src/utils/dagskortFravaer.ts`, `apps/mobile/app/timer/[id].tsx` (`0d3e9dc6`) |
| «Sum i dag» og «Send dagen» fra én funksjon (TILLEGG pkt 3); tar med fravær (E2, 🟢 Kenneth 2026-11-16) | `dagSumTimer` i `apps/mobile/src/utils/dagsoversikt.ts` — eneste kaller `ProsjektkortDagsoversikt.tsx`; test `dagSumTimer.test.ts` |

**c1 — kort-id i UI (§ 5.1, § 5.2).**

| Del | Kode |
|---|---|
| T13/M18: «Del opp» beholder radens byggeplass og kort-id | `splittFravaer.ts`, `SplittRadModal.tsx` (`04c4ca9a`) |
| K5: én beskrivelse pr. kort i prosjektkort-modus | `prosjektkort/kortBeskrivelse.ts` (`ee602f74`) |
| T10/T14: Bekreft dag — «Del til eget kort», underprosjekt pr. kort, «Slå sammen igjen» (🟢 Kenneth 2026-11-16), utkast skjemaversjon 2 (v1 lastes uendret) | `tildelKortIder` i `apps/mobile/src/utils/kortIdForslag.ts`, `retting.kortDeling` i `dagsforslag.ts`, `beskrivelseKort.ts`, `dagsforslagAnvend.ts`, `prosjektkortUtkast.ts` (`UTKAST_SKJEMA_VERSJON = 2`), `DelKortModal.tsx` (`38b643b0`) |
| T11: dagskort og kortskjerm grupperer på kort-id; rute `kort=<kortId>` | `KortValg.kortId`, `kortNokkel`, `utenIdTilKort`, `kortRute`/`kortForRute` i `apps/mobile/src/lib/prosjektkortMobil.ts`; ny rad skrives med kortets id i `nyTimerRad.ts` (`de162384`) |
| T12: «Flytt til nytt kort», «+ Nytt prosjektkort» gir alltid nytt kort, «Endre kort» beholder id | `FlyttMaal.kortId` i `prosjektkort/kortRadFlytt.ts`; `nyttKort` i `KortValgModal.tsx`; `retting.nyttKort` → `tildelKortIder` (`7a5cb7c7`) |
| Gate (70) A1: maskin og vare flyttet alene (og synket vare etter server-flytt) får målkortets id; uten mål-id nullstilles id-en og utledes på nytt | `flyttMaskinRad`, `flyttVareLokalt`, `flyttKort` i `prosjektkort/kortRadFlytt.ts`; `utforFlytt` i `ProsjektkortDagsoversikt.tsx` (`flyttMaalKort` for alle radtyper + `sikreLokalKortId`). Test `kortRadFlytt.test.ts` |
| Gate (70) A2: frøet for «+ Nytt prosjektkort» fjernes når skjermen åpnes uten `nyttKort=1` (utkastnøkkelen er bare datoen) | `nyttKortFroe` i `apps/mobile/src/utils/kortIdForslag.ts`, brukt i `bekreft-dag.tsx`. Test `kortIdForslag.test.ts` |
| E1: «Endre kort» til en nøkkel som alt har kort — tidskollisjon sjekkes med lagringsregelen (`finnOverlappendeTidsrom` → sperre `timer.feil.overlapp`, som `TimerSeksjon.tsx`); uten overlapp to kort, hver med sin beskrivelse | `finnKortKollisjon`, `kortUtfallParametre` og `flyttKort(…, { kollisjonssjekk: true })` i `prosjektkort/kortRadFlytt.ts`; kalles fra `app/timer/[id]/kort/[projectId].tsx`. «Flytt raden» sjekker ikke (uendret). Test `kortHele.test.ts` |

**Tester:** T10/T12/T14 `bekreftDagKortId.test.ts`, `kortIdForslag.test.ts`; T11 `prosjektkortMobil.kortid.test.ts`; T12 `kortRadFlytt.test.ts`; T13 `splittKortId.test.ts`, `splittFravaer.test.ts`; TF3/TF9/TF22/TF27 `fravaerKort.test.ts`, `fravaerKortLagring.test.ts`, `fravaerKortDag.test.ts`; TF10 `dagskortFravaer.test.ts`, `radProsjektId-vakt.test.ts`, `packages/shared/src/utils/fravaerKort.test.ts`; TF20 `timerKatalog-fravaerNormtak.test.ts`; TF23/TF24 `fravaerNormtakMobil.test.ts`, `radform-vakt.test.ts`; TF21 (A-vakt) `dagsforslag.retting.test.ts`, `manuellDag.test.ts`; T16 vaktene `dagskort-isolert-vakt.test.ts`, `radLagring-glue-vakt`, `prosjektkort-glue-vakt`, `attesteringNormtak-vakt.test.ts`, `normtakEksakt-vakt.test.ts`.

Avvik og valg, meldt i SJEKKPUNKT c:
- **Grunnkortet beholder utledet nøkkel i Bekreft dag**; bare utdelte kort nøkles på kort-id. Eksisterende kort på sedelen gjenbrukes.
- **Delt kort får radIndeks i steg på 10 000 × (n + 1)** for tillegg pr. rad (`tilleggPerRad`).
- **Foreldreløs beskrivelse vises og sperrer ikke Bekreft**; den droppes aldri.
- 🟢 **Ingen «Fjern teksten» på foreldreløs beskrivelse** (Kenneth 2026-11-16, A3: «beskrivelse eksisterer ikke uten timer») — `fjernForeldrelos` og `timer.bekreftDag.kort.fjernTekst` er fjernet; teksten vises bare (`bekreft-dag.tsx`, `foreldreloseBeskrivelser`). Vakt i `kortIdForslag.test.ts`.
- **Ingen byggeplassvalg pr. delt kort** — delen arver kildens byggeplass.
- **Rad flyttet til en nøkkel uten kort får tilfeldig UUID** (§ 2.4: kort laget av brukeren).
- 🟢 **«Slå sammen igjen»** (`angreKortDeling`) angrer «Del til eget kort» før lagring — beholdt, vedtatt av Kenneth 2026-11-16 (rettelse til E3). Test i `kortIdForslag.test.ts`.
- **«Endre kort» til en nøkkel som alt har kort beholder id** → to kort med samme nøkkel (K7), etter kollisjonssjekk (E1). Merknaden `timer.kort.sammenslaa` er fjernet i 15 språk.
- **«Del opp» (`SplittRadModal`) er delt med dagskort-modus**, så T13-rettingen (byggeplass og kort-id arves) gjelder der også. Datakorrigering uten synlig endring.
- **Fraværskortets −/+ går i firmaets tidsrunding; uten tidsrunding 0,5 t** (`fravaerSteg` i `fravaerKort.ts`). 🟢 Kenneth 2026-11-16 (E4).
- **«Send dagen (N t)» og «Sum i dag»** tar med fraværstimer (E2). Normtak og brudd (B10) er uendret.

---

## 9. Tester som skal feile først (gate-krav)

T17–T20 gjelder tillegget (§ 6.1) og står foran T16 fordi de leveres før kort-id.

| # | Test | Ordre |
|---|---|---|
| T1 | `klassifiserArbeidstid`: `bruktAvNorm` 9,5 / norm 7,5 / arbeid 1 → 1 t overtid; brukt 6 / arbeid 2,5 → 1,5 + 1; brukt 0 → som i dag; norm 0 → alt normaltid uansett brukt. | a2 |
| T2 | Bekreft dag (GPS og manuell) med rader fra før på datoen: reise teller ikke, `erstattet` teller ikke, eksisterende rader uendret etter lagring (L5). | a, a2 |
| T3 | `utledKortId` gir samme id som SQL-uttrykket for faste vektorer (integrasjonstest mot Postgres), og passerer `z.string().uuid()`. | b |
| T4 | Backfill: rader med samme nøkkel på samme sedel får samme id; ulik nøkkel ulik id; reise `NULL`; koblet maskin/vare = radens; vare uten sedel `NULL`. Kjørt to ganger = samme resultat. | b |
| T5 | Pr. server-skrivevei i M8: lagret arbeidsrad uten `kort_id` = rød. Pr. mobil-skrivevei i M9 likeså. | b |
| T6 | `syncBatch` uten `kortId` (eldre klient): kjent rad beholder id; ny rad → eldste kort med samme nøkkel; to kort med samme nøkkel forblir to. | b |
| T7 | `syncBatch` med `kortId` som bryter K2/K3 → `avvist` med `kortUlikeRader`; ingenting skrevet. | b |
| T8 | V19: rad som legges som forslag og forsones tilbake, har samme `kortId`. V19.9: hoppet rad beholder id. | b |
| T9 | Firma-isolasjon: `kortId` fra en annen brukers sedel kan ikke brukes (K1 → avvist). | b |
| T10 | Bekreft dag: «Del til eget kort» kl. 12 på 07–17 → to kort, to id-er, overtid som linje i kort 2, hver sin beskrivelse påkrevd. | c |
| T11 | Dagskort: to kort med lik nøkkel vises som to kort; overtid = linje; «Uten rad» i riktig kort. | c |
| T12 | «Flytt raden» til nytt kort gir ny id og tar med koblet maskin/vare; «Endre kort» beholder id; «Slett kort» sletter bare kortets rader. | c |
| T13 | «Del opp»: nye deler beholder radens byggeplass og `kortId` (rød i dag på byggeplass, M18). | c |
| T14 | Gammelt utkast (før kort-id) lastes: tekst og linjer havner på riktig kort; ingenting droppes stille. | c |
| T15 | Web: samlesiden grupperer på `kortId`; `tilfoyTimerRad` fra et kort sender id-en; uten id → regel 3. | d |
| T17 | Bekreft dag: hver arbeidslinje har lønnsart; valg av annen ordinær art på normaldelen lagres på raden; valg av ordinær art på linja etter normen lagres som ordinær (overstyring) og gir én linje når artene er like. | a3 |
| T18 | Velgeren tilbyr bare firmaets aktive `ordinaer`-arter; reise-arter, fravær, feriepenger, diett og et annet firmas arter er ikke med (rød i dag på firma, F-L2). | a3 |
| T19 | Firma uten overtidsart: linja etter normen vises med «Velg lønnsart» og sperrer lagring til valgt — ingen stille droppet rad. Endret tid som fjerner linja, fjerner valget; utkast bevarer valget. | a3 |
| T20 | Ny rad i prosjektkortets rad-vindu etter brukt norm forhåndsvelger overtidsarten; dagskort-modus uendret (vakt). | a3 |
| T16 | Vakt: `dagskort-isolert-vakt` og begge glue-vaktene grønne med begrunnet endring; dagskort-modus-skjermen uendret. | b, c |

---

## 10. Beslutninger til Kenneth

| # | Spørsmål | Anbefaling |
|---|---|---|
| **B1** | **Hvor bor kort-id?** A: kolonne på radene. B: egen tabell `prosjektkort` som radene peker på. | **A.** Mindre skjema, følger raden gjennom synken, alle lesere urørt. B gir sterkere databasegaranti, men to kilder for prosjekt/underprosjekt/byggeplass; kan bygges senere oppå A. |
| **B2** | **Når legges databasesperren (`CHECK`) på?** Samme release (regelen «stille tomhet») eller neste (to-stegs-regelen)? | **Neste release.** I samme release kan en tilbakerulling av API-et stoppe all timeføring. Test + gate-SQL bærer garantien imens. |
| **B3** | **V21-linja kan foreslå for mye overtid** når en overtidsrad ligger tidlig på dagen (F-L1). Rette den nå? | **Ja, i a2.** Forslaget skal bare gjelde timer over norm som ikke alt er ført som overtid. |
| **B4** | **Maskin-tak med to kort i samme prosjekt + underprosjekt:** tak pr. kort, eller pr. (prosjekt, underprosjekt) som i dag? Taket regnes pr. bøtte (`beregnMaskinBrudd`, `dagsseddel.ts:1327`), så en ukoblet maskin med 8 t på grøft-kortet (4 t arbeid) passerer når skifer-kortet har 4 t til. Koblet maskin er alt begrenset av raden. | **Som i dag på server; pr. kort i skjermen** (samme vakt som Bekreft dag har). Strengere servertak kan avvise sedler som er riktige i dag. |
| **B5** | **Web etter mobil?** Mellom ordre c og d viser PC grøft og skifer i samme prosjektkort, mens telefonen viser to. | **Ja, mobil først.** Data er like begge steder; bare visningen på PC henger etter til d er levert. |
| **B6** | **Hvilke lønnsarter tilbys på en linje i prosjektkortet?** Alle aktive (som rad-vinduet i dag), eller bare ordinære + overtid? | **Bare `ordinaer`-typen (ordinære og overtid), reise utenfor.** Fravær, feriepenger og diett hører ikke hjemme på et prosjektkort; de kan fortsatt føres i dagskortets rad-vindu. |
| **B7** | **Skal kortet bære arbeidets art (kontrakt/regning) som eget valg?** I dag ligger arten i underprosjektet og beskrivelsen; lønnsarten sier ingenting om den. | **Nei, ikke nå.** To kort + underprosjekt + beskrivelse dekker grøft/skifer. Sier du ja, trenger kortet en egen egenskap, og da bør B1 bli tabell (B). |

**Låser koding av ordre b: B1 og B2.** B3 låser a2. B6 låser a3. B7 avgjøres sammen med B1. B4 og B5 kan tas ved
gate som anbefalt.

### Kenneths svar 2026-11-16

| # | Svar |
|---|---|
| B1 | **A — kolonne på radene.** Kenneth: «B1 ok, men vises ikke i ui» — kort-id er intern og vises aldri for brukeren. |
| B2 | Som anbefalt: `CHECK` i neste release (ordre e). |
| B3 | Som anbefalt: rett V21-overskuddet i a2. |
| B4 | Som anbefalt: maskin-tak som i dag på server, pr. kort i skjermen. |
| B5 | Som anbefalt: mobil først, web (d) etter. |
| B6 | **Snudd:** *«Vi må kunne føre fravær på \"prosjektkort\"»* — fravær tilbys på kortet (V4-⚠️). Fraværskort **uten prosjekt** (Kenneth 2026-11-16: «Nei, uten prosjekt») — et prosjektkort med fravær-art har ikke prosjekt, byggeplass eller underprosjekt; `kortNokkel` for fravær må derfor tåle tomt prosjekt (🟡 spesifisert i § 11; bygges i b, c og d — ikke i a3). |
| B7 | Som anbefalt: nei, ikke nå. |
| B8 | **Fravær bruker ikke opp normen, og registreringer tillates** (Kenneth 2026-11-16): «her må vi trå forsiktig. her er mange nyanser. en ansatt som er på ferie og skriver timer. da er normen at slikt arbeid enten lønnes med avspasering eller med lønn (evt + overtid) -> vi må behandle arbeidstiden som vanlig arbeidstid -> ikke overtid. En ansatt som er syk, skal ikke jobbe samtidig. … man kan være på jobb 3 timer -> for så å gi seg å gå hjem fordi en ble syk … jeg tror vi lar dette bli opp til ansatte og lønnsansvarlige å bestemme. vi tillater registreringer» Fravær teller ikke i L1. Systemet sperrer ikke kombinasjoner av fravær og arbeid samme dag (ferie + arbeid, 3 t arbeid + syk resten); det er opp til den ansatte og lønnsansvarlig. Ingen ny sperre eller varsel. |
| B9 | **Fravær på en linje frigjør normen også i samme kort** (Kenneth 2026-11-16: «Jeg anbefaler ja. Da blir 15:30–17 normaltid, i tråd med vedtaket ditt om at fravær ikke bruker opp normen»; begrunnelse: *«regelen er at hver dag fylles med normal arbeidstid etter firmaets dagsnorm … etter normal arbeidstid må den ansatte jobbe inn fraværstiden»* — privat ærend skal ikke gi overtid). Kort 08–17 med fravær 08–15:30 → 15:30–17 normaltid. Overtid først når faktisk arbeidet tid passerer normen. Sykdom/barns sykdom + arbeid samme dag er kanttilfeller som overlates til ansatt og lønnsansvarlig (B8). Bygget i RETUR (28): `beregnSegment` (`apps/mobile/src/utils/dagsforslag.ts`) regner arbeidet etter en fravær-normallinje på nytt mot normresten (linja `arbeid`), fraværets slutt i `DagsforslagRettingDato.fravaerTil` («Fravær til» i Bekreft dag) (🟡 `fix/kort-a3-lonnsart-linje`, ikke merget). ⚠️ **Avgrenset av B10 (Kenneth 2026-11-16):** gjelder bare ubetalt fravær. Eksempelet «08–17 med fravær 08–15:30 → 15:30–17 normaltid» er feil for egenmelding/sykdom. |
| B10 | **Betalt fravær + arbeid kan til sammen ikke overstige dagsnormen; ubetalt fravær frigjør normen som i B9** (Kenneth 2026-11-16, svar «1. ok» på forslaget). Kenneths begrunnelse: *«vi kan ikke registrere 7,5 timer egenmelding, for så å utbetale lønn 2 timer -> konsekvens-> arbeidsgiver betaler for 9,5 timer for 2 timer produksjon -> dette er å utnytte sykesystemet i arbeidstakers favør»*. Betalt fravær (egenmelding, sykemelding, barns sykdom) fyller bare den delen av normen som ikke er arbeidet: 2 t arbeid + egenmelding gir høyst 5,5 t egenmelding (norm 7,5). Ubetalt fravær (privat ærend, permisjon uten lønn) frigjør normen, og arbeidet etter er normaltid (B9). Krever markør «betalt» på fravær-lønnsarter (i dag finnes bare `Lonnsart.type`, `packages/db-timer/prisma/schema.prisma`) — skjemaendring. 🟡 Spesifisert i § 11.10 (markør `fravaer_normtak`, regel pr. flate, F9–F11); bygges i b, c og d. Ikke bygget. a3 (`6d611b05`) behandler alt fravær som ubetalt; test-OTA holdes til B10 er bygget (Kenneth 2026-11-16: «bygg ota regelen, trenger ingen endring med en gang»). |


---

## 11. TILLEGG — fraværskort uten prosjekt (Kenneth 2026-11-16, B6 + B8)

> **Status:** 🟢 VEDTATT 2026-11-16 — F1–F11 besvart av Kenneth (ordrett i § 11.9) og ført inn i §§ 11.2–11.10.
> ✅ F12 = A (Kenneth 2026-11-16, § 11.9): «Fravær til» fjernes i ordre c. Ingen kode. Målt mot develop @ dc5833dc; FM27–FM29 mot b4dac1b8.
> **Vedtatt:** fraværskortet har ikke prosjekt, byggeplass eller underprosjekt, og feltene vises ikke (B6, F2) ·
> fravær bruker ikke opp normen, og ingen kombinasjon av fravær og arbeid sperres (B8) · hvem som attesterer fravær
> er firmavalg, standard lønnsansvarlig (F1) · bare timer, ingen klokkeslett (F3) · beskrivelse kreves (F4) ·
> fravær-artene går ut av prosjektkortets linjer fra c (F5) · dagskort-modus viser nå, oppretter senere (F6) ·
> lønnsartens type låses når arten står på rad uten prosjekt (F7) · én dag om gangen, føring fram i tid er lov (F8).
> **Grense:** a3 (lønnsart pr. linje, fravær i velgeren, fravær på prosjektkortets prosjekt inntil videre) endres
> ikke av dette tillegget. Det som står her bygges i b, c og d (§ 11.8).
> **B10 (Kenneth 2026-11-16):** fravær med tak kan høyst fylle det som er igjen av dagsnormen etter arbeid og annet
> fravær — § 11.10 (F9 = A, F10 med blanding, F11 senere).

### 11.1 Målt mot koden (develop @ dc5833dc)

Stier uten mappe: `dagsseddel.ts` = `apps/api/src/routes/timer/dagsseddel.ts`, `rapport.ts` og `lonnsart.ts` samme
mappe, `schema.prisma` = `packages/db-timer/prisma/schema.prisma`, `page.tsx` =
`apps/web/src/app/dashbord/timer/[id]/page.tsx`. Mobilstier er relative til `apps/mobile`.

| # | Funn | Referanse |
|---|---|---|
| FM1 | Prosjekt er påkrevd på fem tabeller i `timer`: `SheetTimer`, `SheetTimerForslag`, `SheetTillegg`, `SheetUtlegg`, `SheetMachine`. Svak referanse uten FK. Sedelen har ikke prosjekt; den har påkrevd firma. | `schema.prisma:236`, `:346`, `:391`, `:463`, `:557`; NOT NULL satt i `migrations/20260511220000_timer_schema_redesign_1b/migration.sql:28–34`; sedel `:153`, `:156–157` |
| FM2 | Fravær finnes bare som lønnsart-type. Ingen kodegren på `fravaer` i api, web eller mobil utenom oppsett og seed. Typen kan endres på en lønnsart som er i bruk. | `schema.prisma:25`; `lonnsart.ts:8`, `:103`, `:135`; `apps/api/src/services/seed/index.ts:63–72`, `:113`; `apps/web/src/app/dashbord/firma/timer/lonnsarter/page.tsx:16` |
| FM3 | Fravær kan føres i dag — alltid med prosjekt. Rad-vinduene viser alle lønnsart-typer (M24); web har prosjekt som `<select required>` uten tomt valg, mobil sperrer lagring uten prosjekt. Fravær-rader med prosjekt kan derfor finnes i prod (ikke målt mot data — gate-SQL B i § 11.2). | `page.tsx:3316–3330`, `:3343–3356`; `src/components/timer-detalj/TimerSeksjon.tsx:1630–1644`, `:2318–2325` |
| FM4 | 🔴 **«Rad uten prosjekt» betyr i dag «arv sedelens prosjekt»** — i synken begge veier og i mobilens lesere. Push: radens prosjekt, ellers sedelens, ellers utelatt. Server: radens, ellers sedelens. Pull: radens, ellers sedelens (`""` når sedelen er tom). Kort: `rad.projectId ?? sedel.projectId`. Tomt prosjekt alene kan derfor ikke bety fravær. | `src/services/timerSync.ts:917`, `:1363`, `:1531`; `dagsseddel.ts:6890–6891`; `src/lib/prosjektkortMobil.ts:238`; samme fallback i `src/components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt.tsx:236`, `:255`, `:316`, `:368`, `app/timer/[id]/kort/[projectId].tsx:344–352`, `app/timer/[id].tsx:1287–1291` |
| FM5 | `syncBatch`: radens prosjekt er `z.string().uuid().optional()` — eksplisitt `null` avvises av Zod. Mangler prosjekt på både rad og sedel, avvises hele sedelen («En rad mangler prosjekt …»). Skriving bruker `…!`, også til forslagstabellen. | `dagsseddel.ts:6451`, `:6897–6905`, `:7510`, `:565` |
| FM6 | Øvrige skriveveier krever prosjekt i Zod: splitt, `tilfoyTimerRad`, `forsonDagskort` (to steder), `redigerSedelRader`. `opprett` godtar `null` og lager da ingen rad. `oppdaterTimerRad` kan ikke endre prosjekt. | `dagsseddel.ts:1676`, `:2381`, `:2868`, `:2889`, `:5065`; `:2186`, `:2222`; `:2606–2629` |
| FM7 | Attesteringsrett avgjøres pr. rad-prosjekt: firma-admin i sedelens firma, eller prosjekt-admin/`kanAttestere` på radens prosjekt og ansatt i firmaet. Oppslaget på prosjektmedlemskap kjøres for alle unntatt `sitedoc_admin`. | `dagsseddel.ts:237–264`, `:267–287`; kallere (direkte eller via `krevAttesteringsrettForRader`) `:4408`, `:4560`, `:4715`, `:4903`, `:5003`, `:6010`, `:6133` |
| FM8 | API-lesere som mister eller velter på rad uten prosjekt. (i) Utvalg `timer: { some: { projectId … } }` — en sedel med bare fravær faller ut av prosjektkø, firmakø, periode­rapport, eksport og ansattfilter. (ii) `project.findMany({ id: { in: […] } })` med radenes prosjekt-id-er — `null` i lista (lest av koden, ikke kjørt: Prisma avviser `null` i `in` på påkrevd felt). (iii) «Første rads prosjekt» brukes til autorisering — en sedel med bare fravær gir «Dagsseddel har ingen rader», og `returner` leser én rad uten sortering. | (i) `dagsseddel.ts:1993`, `:4027`, `:4149`; `rapport.ts:159`, `:364`, `:946` · (ii) `dagsseddel.ts:4196–4215`, `:4414–4439`, `:8113–8135`; `rapport.ts:432–442` · (iii) `dagsseddel.ts:4398–4405`, `:6118–6133` |
| FM9 | Web grupperer overalt i `Map` på `projectId` typet `string`. En rad uten prosjekt blir egen bøtte med navnet «Ukjent prosjekt». I prosjektleder-kontekst er en rad fra annet prosjekt synlig, men ikke valgbar. Det finnes ingen inngang for å føre en rad uten prosjekt, og ny sedel krever prosjekt. | `page.tsx:112`, `:632–634`, `:1612–1615`, `:1649`; `apps/web/src/components/timer/AttesteringDetalj.tsx:119–123`, `:518–520`; `apps/web/src/components/attestering/attestering-buckets.tsx:603`; `apps/web/src/components/attestering/AttesteringPivot.tsx:576–583`; `apps/web/src/app/dashbord/timer/ny/page.tsx:175` |
| FM10 | Rapport-raden bærer prosjektet som **navn** (streng) fra serveren, «(ukjent)» når prosjektet ikke finnes. Gruppering og PDF forutsetter streng (`localeCompare`, `esc`). | `rapport.ts:276`, `:445`, `:573`; `packages/shared/src/utils/timerDetaljRader.ts:776–788`; `packages/pdf/src/timer-rapport.ts:343` |
| FM11 | Mobil lokalt: `sheet_timer_local.project_id` er alt nullable (også maskin, tillegg, utlegg). `dagsseddel_local.project_id` er NOT NULL med `""` som etablert plassholder. `vareforbruk_local.project_id` er NOT NULL. | `src/db/schema.ts:148`, `:220`, `:248`, `:329`; `:90`; `:1072`; `src/services/timerSync.ts:1359–1363` |
| FM12 | Mobil «+» i prosjektkort-modus går alltid til Bekreft dag i manuell modus. Prosjekt er påkrevd der: prosjektlista har ikke «ingen»-valg, lagring sperres (`manglerProsjekt`), og anvendelsen skriver ingenting uten prosjekt. «+ Reise» vises bare når prosjekt er valgt. `KortValgModal` i modus `ny` har ingen kallere. | `app/timer/[id]/prosjektkort.tsx:378–384`; `src/components/DagsseddelListe.tsx:124–140`; `ProsjektkortDagsoversikt.tsx:757–761`; `app/timer/bekreft-dag.tsx:1288–1294`, `:1454`, `:1495–1501`, `:1655–1658`; `src/utils/bekreftDag.ts:425`; `src/utils/dagsforslagAnvend.ts:131` |
| FM13 | Beskrivelse kreves på alle rader som ikke er reise — også fravær (bare på telefon, FM29). `Lonnsart.tvungenKommentar` kan settes i oppsettet, men håndheves ikke (0 treff i `dagsseddel.ts` og `apps/mobile`). | `src/utils/dagsoversiktRader.ts:180–182`; `schema.prisma:33`; `lonnsarter/page.tsx:335` |
| FM14 | Aktivitet er påkrevd pr. rad. Klokkeslett er valgfritt; en rad uten fra–til vurderes ikke mot tidsrom eller overlapp. | `schema.prisma:231–232`; `dagsseddel.ts:6453`, `:2384`; `:6460–6461`, `:674`, `:769` |
| FM15 | Overtidsgrunnlaget på server skiller ikke på lønnsart-type: fraværstimer teller som arbeid i ukegrunnlaget og i attesteringslistas avviksmarkør. Mobilens `bruktAvNorm` likeså (rettes i a3). | `dagsseddel.ts:1248–1263`, `:4295`; `src/utils/overtidMotDognet.ts:31–35` |
| FM16 | Maskin-taket bøtter pr. prosjekt + underprosjekt; en rad uten prosjekt havner i egen bøtte uten maskin. Kortsummen skiller bare reise fra arbeid. | `packages/shared/src/utils/maskinKapasitet.ts:41`; `packages/shared/src/utils/prosjektkort.ts:65–75` |
| FM27 | *(Målt 2026-11-16 mot develop @ b4dac1b8, F1.)* Firmaets timer-innstillinger bor i `OrganizationSetting` i `packages/db` — **ikke i `db-timer`**: `dagsnorm`, `reisetidTellerOvertid`, `normKilde`, `timerRegistreringsmodus`. Skrives av `organisasjon.oppdaterSetting` (bare firma-admin), leses til web og mobilens cache av `hentArbeidstidDefaults`, og settes i firmainnstillingene under «Timeføring». Deploy migrerer `db`, `db-timer`, `db-maskin` og `db-varelager` i én løkke. | `packages/db/prisma/schema.prisma:376`, `:408`, `:472`, `:487`; `apps/api/src/routes/organisasjon.ts:1292–1324`, `:1360`, `:1437`; `apps/web/src/app/dashbord/firma/innstillinger/page.tsx:960–989`, `:1192–1204`; `src/services/organizationSettingKatalog.ts:86`; `deploy-prod.sh:82` |
| FM28 | *(Målt mot b4dac1b8, F8 — lest av koden, ikke kjørt.)* **Ingen sperre mot framtidig dato.** Server: datoen er `z.string()` uten sammenligning mot i dag i `opprett` og `syncBatch`; eneste datogrense er låsen for gamle datoer (`sjekkAldersgrense`, `timerLockEtterDager`). Telefon: datovelgeren i manuell Bekreft dag har ingen øvre grense; «+» starter på dagens dato, som kan byttes. Web: ny sedel har datofelt uten `max`. Påminnelsen om usendte dager gjelder bare datoer før i dag. | `dagsseddel.ts:2187`, `:6429`, `:1056–1071`; `app/timer/bekreft-dag.tsx:1174–1192`; `src/components/DatoVelgerFelt.tsx:46–52`; `src/components/DagsseddelListe.tsx:124–140`, `:212–214`; `apps/web/src/app/dashbord/timer/ny/page.tsx:244–249` |
| FM29 | *(Målt mot b4dac1b8, F4.)* Beskrivelse-kravet (FM13) finnes bare på telefon: lagre-sperren i rad-vinduet, send-sperren på dagskortet og `manglerBeskrivelse` i Bekreft dag (ett kort = én beskrivelse; teller i dag bare `kortMedArbeid`). Server og web krever ikke beskrivelse: 0 treff på kravet i `dagsseddel.ts` og `packages/shared`, og web-dialogen lagrer tomt felt som `null`. | `src/components/timer-detalj/TimerSeksjon.tsx:1686`; `ProsjektkortDagsoversikt.tsx:347`; `src/utils/bekreftDag.ts:114–118`; `page.tsx:3113`, `:3240`, `:3563` |

### 11.2 Modell og skjema (ordrepunkt 1)

**Fraværskortet** er et kort uten prosjekt, byggeplass og underprosjekt. Det har bare timerrader — ingen maskin,
varer, tillegg eller utlegg. Hver linje er `timer · fravær-art`.

**Eksplisitt markør, ikke bare tomt prosjekt.** FM4 viser at tomt prosjekt alt har en betydning («arv sedelens»). En
fraværsrad må derfor si fra selv, slik reise gjør med `er_reise` (lag 2: «ingen leser skal gjette»).

| Tabell | Endring | Regel |
|---|---|---|
| `timer.sheet_timer` | `project_id` → nullable (`DROP NOT NULL`); ny `uten_prosjekt BOOLEAN NOT NULL DEFAULT false` | `uten_prosjekt = true` betyr «bevisst ført uten prosjekt». Serveren setter den bare når lønnsarten har `type = 'fravaer'`. |
| `timer.sheet_timer_forslag` | Samme to endringer | Forslagsraden er en mobilrad satt til side (V19); en fraværsrad må kunne ligge der. |
| `sheet_machines`, `sheet_tillegg`, `sheet_utlegg`, `varelager.vareforbruk` | **Ingen** | Fraværskortet har ikke slike linjer; prosjekt forblir påkrevd. |
| `sheet_timer_local` (mobil) | Ny `uten_prosjekt INTEGER DEFAULT 0` i en additiv kolonneliste (mønster M20) | `project_id` er alt nullable (FM11). Ingen tabell bygges om. |
| `dagsseddel_local` (mobil) | Ingen | En dag med bare fravær bruker plassholderen `""` som i dag (FM11). |
| `organization_settings` (`packages/db`, FM27) | Ny `fravaer_attesteres_av_prosjektleder BOOLEAN NOT NULL DEFAULT false` | **F1:** firmavalget for hvem som attesterer fravær uten prosjekt. Egen migreringsfil i `packages/db` — innstillingen bor ikke i `db-timer`. |

**DB-garanti i samme migrering** (begge tabellene):

```sql
CHECK (
  (uten_prosjekt = false AND project_id IS NOT NULL)
  OR (uten_prosjekt = true AND project_id IS NULL AND byggeplass_id IS NULL
      AND external_cost_object_id IS NULL AND vehicle_id IS NULL AND er_reise = false)
)
```

- **Hvorfor `CHECK` nå, når kort-id-sperren venter til ordre e (B2)?** Den gamle API-versjonen skriver alltid
  prosjekt og aldri flagget, så den passerer sperren i vinduet mellom `migrate` og `up` og etter en tilbakerulling.
  B2-problemet finnes ikke her.
- **To-stegs-policyen:** endringen er additiv — en sperre løsnes, en kolonne legges til, ingen data flyttes eller
  slettes. **Stille tomhet:** (a) ingen backfill trengs — hver eksisterende rad har prosjekt (NOT NULL fram til denne
  migreringen), så `false` er sant for alle; (b) `CHECK` over; (c) tester TF1–TF3 (§ 11.7).
- **Det databasen ikke kan garantere:** at lønnsarten er fravær (`CHECK` kan ikke lese en annen tabell). Bæres av én
  delt funksjon `validerUtenProsjekt` i `packages/shared`, kalt fra hver skrivevei (§ 11.4), av test TF2, av gate-SQL A
  og av F7 (typen på en lønnsart kan ikke endres bort fra fravær mens den står på en rad uten prosjekt, FM2).
- **Eksisterende fravær-rader med prosjekt (FM3) røres ikke.** Ingen backfill flytter dem til «uten prosjekt» — det
  ville endret attesterte rader og prosjektrapporter i ettertid.

**Firmavalget for attestering (F1):** `OrganizationSetting.fravaerAttesteresAvProsjektleder Boolean @default(false)
@map("fravaer_attesteres_av_prosjektleder")`. Målt (FM27): firmaets timer-innstillinger bor i `OrganizationSetting` i
`packages/db`. Feltet kan derfor **ikke** ligge i `db-timer`-migreringen sammen med `kort_id`, `uten_prosjekt` og
`fravaer_normtak`; det får egen migreringsfil i `packages/db/prisma/migrations`, i samme ordre (b). Kenneth kjører
ingen ekstra kommando — deploy migrerer alle fire pakkene i samme løkke (`deploy-prod.sh:82`). Additiv, ingen backfill:
`false` = bare lønnsansvarlig, som er standarden Kenneth vedtok, og er sant for hvert firma fra første dag. Boolsk og
ikke enum fordi Kenneth ba om avkrysning (mønster: `reisetidTellerOvertid`, `schema.prisma:472`). Skrives via
`oppdaterSetting` (bare firma-admin, `organisasjon.ts:1360`, Zod ved `:1437`). Regelen feltet styrer står i § 11.4.

**Gate-SQL Kenneth kjører etter migrering:**

```sql
-- A) rad uten prosjekt som ikke er fravær (skal gi 0)
select count(*) from timer.sheet_timer t join timer.lonnsarter l on l.id = t.lonnsart_id
 where t.uten_prosjekt and l.type <> 'fravaer';
-- B) til orientering: fravær ført med prosjekt fram til nå (tallet sier hvor mye historikk som blir stående slik)
select count(*) from timer.sheet_timer t join timer.lonnsarter l on l.id = t.lonnsart_id
 where l.type = 'fravaer' and not t.uten_prosjekt;
```

**`kort_id` og `kortNokkel` for fraværskortet:**

- Fraværsrader er ikke reise og bærer `kort_id` som andre arbeidsrader (§ 2.2). `CHECK` i ordre e (§ 3.4) er uendret.
- K1–K4 gjelder med `NULL` som verdi. Ny **K8:** alle rader i et kort har samme `uten_prosjekt`; et kort med
  `uten_prosjekt` har bare timerrader.
- `KortValg.projectId` blir `string | null`. Nøkkelen bruker samme plassholder som byggeplass og underprosjekt:
  `ingen|ingen|ingen` (`prosjektkortMobil.ts:189–193`); `fraKortNokkel` gir `null` tilbake. Én delt funksjon
  `radProsjektId(rad, sedel)` — `uten_prosjekt` → `null`, ellers dagens fallback — erstatter de spredte
  `?? sedel.projectId` i FM4. Glue-vakt: ingen ny `?? sedel.projectId` utenfor funksjonen.
- `utledKortId` (§ 3.2): prosjektleddet blir `coalesce(project_id, 'ingen')` i SQL og JS. Backfillen i b berøres ikke
  (ingen rad er uten prosjekt når den kjører).
- Gate-SQL 2 i § 3.4 endres til `count(distinct coalesce(project_id, 'ingen')) > 1`, ellers teller den ikke et kort
  som blander prosjekt og «uten prosjekt».
- **Ett fraværskort pr. dag.** `løsKortId` regel 3 gir det av seg selv; «+ Fravær» på en dag som har fraværskort,
  åpner det kortet og legger til en linje.

### 11.3 Synk og eldre klient

- `syncBatch`-raden får `utenProsjekt: z.boolean().optional()` (`dagsseddel.ts:6449–6462`). Med `true`: prosjekt
  lagres som `NULL`, sedel-fallbacken (`:6890`) brukes ikke, raden regnes ikke som «mangler prosjekt» (`:6897`) og
  inngår ikke i medlemskapssjekken (`:6872–6883`). Byggeplass og underprosjekt settes til `NULL`. Er lønnsarten ikke
  fravær → `resultat: "avvist"` med grunn `utenProsjektKreverFravaer`, som øvrige katalog-avvisninger (SYNC-1).
- Forslag (V19): `lagreOverlappForslag` (`:537–566`) og `forsonDagskort` (`:2859–2889`, `:3200–3211`) bærer flagget.
  En fraværsrad uten klokkeslett overlapper aldri (FM14).
- Svar: `serverData.rader` og `hentEndringerSiden` (`:6308`) returnerer `utenProsjekt` og `projectId: null`.

| Situasjon | Hva skjer |
|---|---|
| Eldre mobil fører fravær | Som i dag: med prosjekt, uten flagg (FM3). |
| Eldre mobil henter en fraværsrad uten prosjekt | Lagrer den med sedelens prosjekt, eller `""` på en dag med bare fravær (`timerSync.ts:1531`, `:1363`). Raden vises på sedelens prosjektkort eller som «Ukjent prosjekt». Ingen feil — kolonnen er nullable (FM11). |
| Eldre mobil sender en sedel med en fraværsrad den ikke har endret | V19.9: raden hoppes og står. 🔴 «Mangler prosjekt»-sjekken (`:6897`) må unnta rader serveren kjenner som `uten_prosjekt`; ellers avvises en dag med bare fravær (prosjekt mangler på både rad og sedel). |
| Eldre mobil endrer fraværsraden (timer eller art) | Raden kommer uten flagg, med sedelens prosjekt. Regel: kjent `uten_prosjekt`-rad som fortsatt har fravær-art → serveren beholder «uten prosjekt». Byttet til annen art → vanlig arbeidsrad på prosjektet klienten sendte; mangler prosjekt → `avvist` som i dag. |
| Ny mobil mot eldre API | Flagget strippes (M7). Raden får sedelens prosjekt stille, eller sedelen avvises. 🔴 **Ordre b må være i prod før c sendes som OTA** — samme krav som kort-id (§ 8), her ufravikelig. |
| Tilbakerulling av API etter at rader uten prosjekt finnes | Lest av koden, ikke kjørt: den gamle Prisma-klienten har `projectId` som påkrevd og feiler på lesing av slike sedler. Føres i deploy-notatet for c: etter første fraværskort kan API-et ikke rulles bak b. |

### 11.4 Lesere og skriveveier — funksjonsinventar (ordrepunkt 2)

Ingen funksjon fjernes uten at den står i § 11.9. Når `projectId` blir `string | null` i Prisma-typen, peker
typesjekken ut hver leser i api og web (kald bygging, jf. TS2589-fallgruven).

| Funksjon | Kode | Status |
|---|---|---|
| **Server** | | |
| Attesteringsrett for rad med prosjekt | `krevAttesteringsrett`, `attesteringsFirmaer` (`dagsseddel.ts:237–287`) | **BEVARES.** |
| Attesteringsrett for rad uten prosjekt | Samme | **NY REGEL (F1, firmavalg).** Standard: firma-admin i sedelens firma (lønnsansvarlig), og `sitedoc_admin`. Med firmavalget `fravaerAttesteresAvProsjektleder` på: også den som har attesteringsrett etter dagens regel (FM7) på minst ett prosjekt **samme sedel** har en timerrad på som ikke er `erstattet` — «prosjektlederen som attesterer resten av dagen». Sedel med bare fravær: alltid bare firma-admin. Firmavalget leses fra sedelens firma, aldri attestantens. Ingen oppslag på prosjektmedlemskap med `null`. 🟡 Tolkning: har dagen arbeid på to prosjekter, kan hver av de to prosjektlederne attestere fraværslinja; den som gjør det først, har gjort det. |
| Attesteringskø pr. prosjekt | `hentTilAttestering` (`:4027`) | **BEVARES:** utvalget er uendret — fravær uten prosjekt hører ikke til noen prosjektkø, og en sedel med bare fravær står bare i firmakøen. **ENDRES (F1):** på en sedel som alt står i prosjektkøen, er fraværsraden valgbar når firmavalget er på; ellers synlig og nedtonet. Svaret bærer `fravaerKanAttesteres` pr. sedel, så klienten ikke regner retten selv. |
| Firmaets attesteringskø og sedelliste uten prosjektfilter | `hentTilAttesteringFirma` (`:4149`, `:4196–4215`), `list` (`:1993`) | **ENDRES:** sedel med bare fravær kommer med; prosjektoppslaget hopper over `null`. |
| Åpne, attestere og returnere sedel | `hentForAttestering` (`:4398–4439`), `attester` (`:6010`), `returner` (`:6118–6133`), `attesterRader`/`returnerRader`/`gjenaapneAttestering` (`:4715`, `:4903`, `:5003`) | **ENDRES:** tåler sedel der første eller alle rader er uten prosjekt; retten avgjøres pr. rad (F1); `hentForAttestering` bærer `fravaerKanAttesteres`. |
| Dagstotal | `hentDagstotal` (`:8113–8135`) | **ENDRES:** fravær i egen bøtte «Fravær». |
| Perioderapport, Excel og PDF | `firmaPeriodeRapport` (`rapport.ts:159`, `:238–241`, `:276`), `detaljEksport`/`pdfEksport` (`:364`, `:432–445`, `:573`, `:722`), `hentFirmaAnsatteMedTimer` (`:946`) | **ENDRES:** uten prosjektfilter kommer fravær uten prosjekt med, under navnet «Fravær» (i18n) — ikke «(ukjent)». Prosjektnavnet er fortsatt alltid en streng (FM10). **BEVARES:** med valgt prosjekt utelates de. |
| Prosjektliste i rapportfilteret, prosjektsidene, vareforbruk pr. prosjekt | `hentFirmaProsjekterMedTimer` (`rapport.ts:910–915`); `vareforbruk.ts:83`, `:468`, `:607–614` | **BEVARES** — fravær uten prosjekt teller ikke på noe prosjekt og kan ikke bære vare. |
| Maskin-tak | `validerMaskinUnderArbeid` (`:1327–1351`), `maskinKapasitet.ts:41` | **BEVARES** — fravær gir ingen maskinkapasitet (FM16). |
| Overtidsgrunnlag på server | `byggUkeOvertidsgrunnlag` (`:1248–1263`), `beregnOvertidsgrunnlag` (`:4295`) | 🟡 **Funn F-F1, ENDRES med hjemmel B8:** på dag-nivå teller fravær ikke som arbeid. Uten rettingen regnes en dag med 7,5 t fravær + 1,5 t arbeid (B9-dagen) som 9 t arbeid og får 1,5 t «beregnet overtid». På uke-nivå fyller fravær dagens norm, aldri mer — presisert i § 11.10.4 sammen med taket for fravær (B10). Gjelder fravær med og uten prosjekt. *(Rettet 2026-11-16: det tidligere eksempelet 4,5 t + 3 t gir ikke avvik, § 11.10.1.)* |
| Legg til, del opp, firma-admin-redigering, forsoning | `tilfoyTimerRad` (`:2377`), `splittRad`/`splittRadEier` (`:5541`, `:5779`), `redigerSedelRader` (`:5043`), `forsonDagskort` (`:2859`) | **ENDRES:** valgfritt `utenProsjekt`; prosjekt blir da ikke påkrevd i Zod. Deler av en fraværsrad forblir uten prosjekt. |
| Flytt rad til underprosjekt | `flyttTimerRadEco` (`:4536–4591`) | **BEVARES;** rad uten prosjekt avvises med egen melding. |
| Ny sedel | `opprett` (`:2186`) | **BEVARES** — godtar alt tom sedel. |
| Endre lønnsartens type | `lonnsart.oppdater` (`lonnsart.ts:99–158`) | **ENDRES (F7):** type bort fra fravær avvises når arten står på en rad uten prosjekt. |
| Firmavalget for attestering av fravær | `oppdaterSetting` (`organisasjon.ts:1360`, `:1437`) | **NY (F1, b):** valgfritt `fravaerAttesteresAvProsjektleder: z.boolean()`. Bare firma-admin skriver, som resten av innstillingene. Virker fra neste attestering; attesterte rader røres ikke. |
| Føring på framtidig dato | `opprett` (`:2187`), `syncBatch` (`:6429`), `sjekkAldersgrense` (`:1056–1071`) | **BEVARES (F8).** Ingen sperre finnes (FM28), og ingen legges til. Fravær fram i tid lagres, sendes og attesteres som andre dager. |
| **Mobil** | | |
| Dagskortet i prosjektkort-modus | `ProsjektkortDagsoversikt.tsx`, `dagsoversiktRader.ts:61`, `:95–107`, `useProsjektkortSedel.ts:521–543` | **ENDRES:** fraværskortet er eget kort, sist i lista, tittel «Fravær». 🟡 Dagens sum viser arbeid og fravær hver for seg (følger av B8; i dag teller `beregnKortSummer` fravær som arbeid, FM16). |
| Bekreft dag | `bekreft-dag.tsx`, `bekreftDag.ts`, `dagsforslagAnvend.ts` | **ENDRES:** «+ Fravær» og fraværskort i forslaget (§ 11.5). Arbeidskortene er urørt. |
| Kortskjermen | `kort/[projectId].tsx:98–100`, `:344–352`; `prosjektkort.tsx:77–80` | **ENDRES:** prosjektsegmentet er `ingen` for fraværskortet (etter c: `kort=<kortId>`). Bare timerlinjer; knappene for maskin, varer, tillegg og utlegg vises ikke. |
| Beskrivelse-kravet og send-sperren | `radManglerBeskrivelse` (`dagsoversiktRader.ts:180–182`), `forsteRadUtenBeskrivelse` (`ProsjektkortDagsoversikt.tsx:347`), `manglerBeskrivelse` (`bekreftDag.ts:114–118`) | **BEVARES (F4): fravær krever beskrivelse.** Reise er fortsatt eneste unntak. Fraværskortet har ett beskrivelsesfelt (ett kort = én beskrivelse, K5); «Bekreft» og sending av dagen sperres til det er fylt. **ENDRES:** `manglerBeskrivelse` må også telle fraværskortet (teller i dag `kortMedArbeid`, FM29). Serveren får ingen sperre — den har ingen i dag, og en eldre app eller offline-dag skal ikke sprette. Web-dialogen krever feltet for fravær i d (§ 11.6). |
| «Flytt raden», «Endre kort» | `KortValgModal.tsx:130–136`, `kortRadFlytt.ts` | **BEVARES** for prosjektkort. Tilbys ikke på fraværskortet (fravær flyttes ikke til et prosjekt; feil ført = slett og før på nytt). «Slett kort» virker. |
| «Del opp» | `SplittRadModal.tsx` | **BEVARES;** deler av en fraværsrad forblir i fraværskortet. |
| Lønnsartvalg pr. linje på prosjektkort (a3) | § 6.1 V4-⚠️; `LonnsartVelgerModal` (`TimerSeksjon.tsx:2306–2326`) | **ENDRES (F5 = ja) når c leveres:** fravær-arter tilbys ikke lenger på prosjektkortets linjer — verken i Bekreft dag eller på ny rad i rad-vinduet («+ Timer») åpnet fra et prosjektkort. Rader som alt er ført med fravær på et prosjekt, blir stående og kan åpnes, rettes og slettes; taket i § 11.10 gjelder dem. a3 selv er urørt til c. |
| «Fravær til» i Bekreft dag (a3, B9) | `DagsforslagRettingDato.fravaerTil` (`dagsforslag.ts:388`), `beregnSegment` (`:1851–1886`); `bekreft-dag.tsx:2045–2061` | **FJERNES (F12 = A, Kenneth 2026-11-16).** Dagen føres som arbeidskort + «+ Fravær». B9-regelen står — fravær bruker aldri normen (L1), så arbeidet er normaltid. 🟡 Fjernet i c (`feat/kortid-c-mobil`, ikke merget); vakt: `dagsforslag.retting.test.ts` («Fravær til» vises ikke) og `manuellDag.test.ts`. |
| Lønnsartvelgeren i dagskort-modus | `LonnsartVelgerModal` (`TimerSeksjon.tsx:2306–2326`) | **BEVARES** — alle typer, med prosjekt, som i dag. |
| Dagskort-modus-skjermen | `app/timer/[id].tsx:1287–1306` | **ENDRES minimalt (F6):** rader uten prosjekt vises i gruppen «Fravær» i stedet for å falle på sedelens prosjekt. `dagskort-isolert-vakt` endres begrunnet. |
| Matpause, reise, maskin/varer/tillegg/utlegg, overlapp (V19), radversjoner (V19.9) | — | **BEVARES.** Fraværsraden bærer aldri pause og aldri maskin/varer. |
| Utkast | `prosjektkort_utkast_local` (`schema.ts:1097–1109`) | **ENDRES:** fraværskortet lagres i utkastet; `skjemaVersjon` økes (sammen med c). |
| **Web** | | |
| Dagsseddel-siden | `page.tsx:632–634`, `:1612–1615`, `:1649`, `:3316–3330`, `:3563` | **ENDRES:** kortet/gruppen heter «Fravær», ikke «Ukjent prosjekt» (b). «+ Fravær» åpner rad-dialogen med fravær-art valgt (d). **Lønnsarten styrer feltene (F7-tillegget):** valgt fravær-art skjuler prosjekt, byggeplass og underprosjekt og sender `utenProsjekt`; annen art viser dem, og prosjekt er påkrevd som i dag. Beskrivelse er påkrevd når arten er fravær (F4); ellers valgfri som i dag (FM29). |
| Attestering | `AttesteringDetalj.tsx:119–123`, `:518–545`; `attestering-buckets.tsx:603`; `AttesteringPivot.tsx:238–240`, `:576–583`; `firma/timer/attestering/page.tsx:258`, `:358–366` | **ENDRES:** seksjonen heter «Fravær» (b). **BEVARES:** i prosjektleder-kontekst er raden synlig og nedtonet, som rader fra annet prosjekt i dag — når firmavalget er av (standard). **ENDRES (F1):** med firmavalget på er fraværsraden valgbar for prosjektlederen; `radTilgjengelig` leser `fravaerKanAttesteres` fra serveren i stedet for å sammenligne prosjekt. |
| Rapport, Excel, PDF | `firma/timer/rapport/page.tsx:1404–1406`; `timer-rapport-eksport.ts:641–646`; `timerDetaljRader.ts:776–788`; `pdf/timer-rapport.ts:343` | **BEVARES** — leser navnet serveren sender («Fravær»). |
| Ny sedel | `timer/ny/page.tsx:175`, `:380` | **ENDRES (d):** en dag kan startes med fravær uten å velge prosjekt. |
| Firmainnstillinger, «Timeføring» | `firma/innstillinger/page.tsx:960–989`, `:1192–1204` | **ENDRES (F1, b):** ny avkrysning under registreringsmodus. Tekstforslag (endelig ordlyd etter `tooltip-hjelpetekst-veileder.md`): **«Prosjektleder kan attestere fravær»**, hint «Uten avkrysning attesterer bare lønnsansvarlig fravær. Med avkrysning kan også prosjektlederen som attesterer resten av dagen, attestere fraværet.» ?-hjelpeteksten og `hjelpetekster.md` i samme commit; nøkler i `nb.json` + `en.json`. |

### 11.5 Brukerflyt mobil (ordrepunkt 3)

| # | Regel |
|---|---|
| U1 | **To innganger, samme kort.** (1) «+ Fravær» på dagskortet, rett under «+ Nytt prosjektkort» (`ProsjektkortDagsoversikt.tsx:757–761`). (2) «+ Fravær» i Bekreft dag, i lenkeraden der «+ Reise» står (`bekreft-dag.tsx:1495–1501`) — vist også når prosjekt ikke er valgt (raden krever i dag `prosjektId`, `:1454`). GPS-dag og manuell dag likt. Kortet gjelder datoen som står åpen (fram i tid: U12). |
| U2 | **Forhåndsdefinerte valg:** fraværskortet viser firmaets aktive arter med `type = 'fravaer'` som chips når de er inntil seks, ellers den søkbare lista (samme regel som V3, med firmafilter, F-L2). Ingen fritekst. |
| U3 | **Timer er forhåndsutfylt** med resten av normen: `max(0, dagsnorm − arbeid − annet fravær ført på datoen)`. Hel fraværsdag → hele normen. Gikk hjem syk etter 3 t → 4,5 t. Ukjent norm (M17) eller rest 0 → tomt felt som må fylles. −/+ i firmaets tidsrunding. Ingen klokkeslett (F3). For art **med tak** er resten også øvre grense (B10, § 11.10.4). For art uten tak er den bare et forslag: ferie ført etter 2 t arbeid foreslås som 5,5 t og økes til 7,5 t med «+» — feriedagen kuttes ikke (F10). |
| U4 | **Raskeste vei:** «+ Fravær» → art → beskrivelse → «Bekreft» = tre trykk og én tekst (F4). |
| U5 | **Kortet viser ikke** prosjekt, byggeplass, underprosjekt, aktivitet, maskin, varer eller tillegg (F2). Det viser art, timer og beskrivelse. |
| U6 | **Aktivitet** er påkrevd på raden (FM14): raden får samme standard som en ny arbeidsrad får i dag, uten at feltet vises. Koderen måler kilden til standarden før ordre c og melder hvis den ikke finnes for et firma. |
| U7 | **Flere arter samme dag:** «+ Legg til fravær» i kortet gir ny linje. Linjer slås aldri sammen. |
| U8 | **Manuell Bekreft dag med bare fraværskort lagres uten prosjekt.** Sperren `manglerProsjekt` (`bekreftDag.ts:425`) gjelder bare arbeidskort med tid. |
| U9 | **Ingen sperre** når fravær og arbeid står på samme dag (B8). **Ett varsel (F5-tillegget):** bare når fravær med tak bryter taket (B10) — amber linje med ett-trykks retting, § 11.10.4. Ingen annen kombinasjon av fravær og arbeid varsles. |
| U10 | **Linjeform:** «7,5 t · Egenmelding». Lønnsarten kan byttes på linja (samme velger som U2). |
| U11 | **Beskrivelse kreves (F4).** Ett felt pr. fraværskort, som på prosjektkortet (K5) — ikke pr. linje. «Bekreft» og sending av dagen er sperret til feltet er fylt, med samme markering som prosjektkortet bruker i dag. Fritekst. |
| U12 | **Fram i tid (F8).** Fravær kan føres på en framtidig dato, én dag om gangen: velg datoen i Bekreft dag (manuell) og trykk «+ Fravær». Ingen sperre finnes i dag (FM28), og ingen legges til. Flere dager i ett grep, bytte av art på flere dager samtidig og feriesaldo er egen ordre etter d (BACKLOG «Fravær over flere dager»). 🟡 Ikke målt: om telefonens normcache dekker framtidige datoer. Ukjent norm gir tomt timefelt og intet tak (U3, § 11.10.3), aldri feil; koderen måler det i c og melder. |
| U13 | **Lønnsarten styrer prosjektfeltet (F7-tillegget).** Der art og prosjekt står i samme skjema, skjuler valgt fravær-art prosjekt, byggeplass og underprosjekt, og annen art viser dem. På telefon har fraværskortet bare fravær-arter, så feltene vises aldri der. På web gjelder regelen rad-dialogen (§ 11.6). Dagskort-modus-skjermen på telefon er urørt (F6). |

```
 Dagskortet (i dag)              Dagskortet (etter)              Fraværskortet
 ┌──────────────────────┐        ┌──────────────────────┐        ┌──────────────────────────┐
 │ Bygg 50 · Grøft      │        │ Bygg 50 · Grøft      │        │ Fravær                 ✕ │
 │ 07:00–10:00 · 3,0 t  │        │ 07:00–10:00 · 3,0 t  │        │ [Egenmelding] [Barns     │
 │                      │        │ Fravær               │        │  sykdom] [Ferie m/lønn]  │
 │ + Nytt prosjektkort  │        │ 4,5 t · Egenmelding  │        │ Timer      −  4,5  +     │
 └──────────────────────┘        │ + Nytt prosjektkort  │        │ + Legg til fravær        │
                                 │ + Fravær             │        │ Beskrivelse *            │
                                 └──────────────────────┘        │ [ Syk fra kl. 10       ] │
                                                                 │            [ Bekreft ]   │
                                                                 └──────────────────────────┘
```

**Forkastet (F2):** «Fravær» som fast førstevalg i prosjektlista i Bekreft dag (`bekreft-dag.tsx:1655–1658`).
Kenneth valgte «+ Fravær».

### 11.6 Web (ordre b og d)

- **b:** web tåler `projectId: null` og viser «Fravær» der den i dag ville vist «Ukjent prosjekt» (dagsseddel,
  attestering, pivot). Nødvendig i b fordi typene ellers ikke kompilerer, og fordi attestanten må kunne lese en
  fraværsrad fra første dag mobilen kan lage den. Firmavalget for attestering (F1) settes i firmainnstillingene, og
  attesteringen leser `fravaerKanAttesteres` (§ 11.4).
- **d:** «+ Fravær» på dagsseddelen ved siden av «+ Nytt prosjektkort» åpner rad-dialogen med fravær-art valgt.
  **Én dialog, lønnsarten styrer feltene (F7-tillegget, U13):** valgt fravær-art skjuler prosjekt, byggeplass og
  underprosjekt og sender `utenProsjekt`; byttes arten til noe annet, vises feltene igjen og prosjekt må velges.
  Regelen gjelder nye rader — en lagret fraværsrad med prosjekt (FM3) vises med prosjektet som i dag og flyttes ikke
  stille. Timefeltet er forhåndsutfylt som U3. **Beskrivelse er påkrevd når arten er fravær (F4)** — dialogen sperrer
  lagring; for andre arter er feltet valgfritt som i dag (FM29). Ny sedel kan startes med fravær uten prosjekt, også
  på framtidig dato (F8, FM28). Firma-admin fører fravær for en ansatt via samme dialog (`redigerSedelRader`).

### 11.7 Tester som skal feile først

| # | Test | Ordre |
|---|---|---|
| TF1 | Integrasjon mot Postgres: `CHECK` avviser (i) rad uten prosjekt og uten flagg, (ii) flagg med prosjekt, byggeplass, underprosjekt eller `er_reise`. Eksisterende rader passerer migreringen. | b |
| TF2 | Pr. server-skrivevei (§ 11.4): `utenProsjekt` med lønnsart som ikke er fravær → avvist, ingenting skrevet. Med fravær-art → lagret med `project_id NULL`. | b |
| TF3 | Arbeidsrad uten prosjekt og uten flagg kan ikke lagres via noen skrivevei (rød hvis en fallback gir den sedelens prosjekt stille i en ny klient-vei). | b, c |
| TF4 | `syncBatch`, eldre klient: sedel med bare en kjent fraværsrad avvises ikke; endret fraværsrad uten flagg beholder «uten prosjekt»; byttet til ordinær art får klientens prosjekt. | b |
| TF5 | Attesteringsrett (F1). **Firmavalget av:** prosjektleder kan ikke attestere rad uten prosjekt; firma-admin kan. **Firmavalget på:** prosjektleder med rett på et prosjekt sedelen har rad på, kan; prosjektleder uten slikt prosjekt på sedelen kan ikke; sedel med bare fravær → bare firma-admin. Sedel med bare fravær står i firmakøen og kan åpnes, attesteres og returneres. Blandet sedel velter ikke lista. `fravaerKanAttesteres` i svaret stemmer med det serveren håndhever. | b |
| TF6 | Rapport, Excel og PDF uten prosjektfilter: fraværsrad uten prosjekt er med under «Fravær»; med prosjektfilter er den ikke med; prosjektnavnet er aldri `null`. | b |
| TF7 | Firma-isolasjon: rad uten prosjekt fra et annet firmas sedel er ikke synlig eller attesterbar (tilgang går via sedelens firma). Firmavalget (F1) leses fra sedelens firma, ikke attestantens. | b |
| TF8 | Overtidsgrunnlag, dag-nivå: 7,5 t fravær + 1,5 t arbeid gir ikke avvik (rød i dag, FM15). Uke-nivå: TF16. | b |
| TF9 | Mobil: «+ Fravær» på dag med 3 t arbeid og norm 7,5 → 4,5 t forhåndsutfylt; med 2 t annet fravær i tillegg → 2,5 t. Lagret rad har `uten_prosjekt` og havner i fraværskortet, ikke på sedelens prosjekt; bare-fravær-dag lagres uten prosjekt. Kortet viser ikke prosjekt, byggeplass eller underprosjekt (F2). **«Bekreft» og sending er sperret til fraværskortet har beskrivelse (F4);** `manglerBeskrivelse` teller fraværskortet; reise er fortsatt unntatt. | c |
| TF10 | Mobil: `kortNokkel` med tomt prosjekt gir `ingen\|ingen\|ingen` og rundtur via `fraKortNokkel`; glue-vakt mot ny `?? sedel.projectId`; dagskort-modus viser gruppen «Fravær» og er ellers uendret (vakt). | c |
| TF11 | `lonnsart.oppdater`: type bort fra fravær avvises når arten står på en rad uten prosjekt; ellers som i dag. | b |
| TF12 | Web: dagsseddel og attestering viser «Fravær» for rad uten prosjekt; «+ Fravær» sender `utenProsjekt` og ikke prosjekt; valgt fravær-art skjuler prosjekt, byggeplass og underprosjekt, annen art viser dem (F7-tillegget); fravær uten beskrivelse kan ikke lagres i dialogen, annen art kan (F4). | b (visning), d (oppretting) |
| TF13 | **B10.** Migrering: hver fravær-art har verdi etter backfill; navn med «u/lønn», «uten lønn», «ubetalt», «privat» (og F10-leddene) er `false`, øvrige `true`. Seed nivå 1 og 2 gir verdiene i § 11.10.2. `opprett`, `oppdater` og import uten feltet → `true`. | b |
| TF14 | **B10.** `harNormtak`: fravær + `false` → nei; fravær + `true`/`null`/udefinert → ja; ordinær → nei uansett verdi. Glue-vakt: ingen annen leser av feltet. | b |
| TF15 | **B10.** `vurderFravaerNormtak`, norm 7,5: arbeid 2 + egenmelding 7,5 → tak 5,5, over 2; arbeid 7,5 → tak 0, hele fraværet over; ubetalt 7,5 + arbeid 2 → over 0. **Blanding (F10):** ferie m/lønn 7,5 + egenmelding 7,5 → tak 0, over 7,5; privat ærend 2 + egenmelding 7,5 → tak 5,5, over 2; ferie m/lønn 7,5 + arbeid 2 → over 0; arbeid 2 + privat ærend 2 + egenmelding 3,5 → over 0. To linjer med tak summeres; reise og `erstattet` teller ikke; fravær med prosjekt teller som fravær uten prosjekt; norm 0 → tak `null`, over 0. | b |
| TF16 | **B10 / F-F1.** Ukegrunnlag: mandag 7,5 t egenmelding + fire dager 9,5 t med 2 t ført overtid gir ikke ukeavvik (grønn i dag — vakt mot å stryke fravær helt). Mandag 7,5 t ubetalt + 1,5 t arbeid, resten normal uke, gir ikke ukeavvik (rød i dag). | b |
| TF17 | **B10.** Interaktive skriveveier: fraværsrad med tak over taket avvises med tallene; arbeidsrad og fraværsrad uten tak avvises aldri, heller ikke når de setter dagen i brudd; senking av fraværsrad på dag i brudd godtas. `syncBatch` lagrer og returnerer bruddet. Firma-isolasjon: norm og arter leses fra sedelens firma. | b |
| TF18 | **B10 (F9 = A).** `attester` og `attesterRader` avvises for dato i brudd og går gjennom etter retting; `returner` virker; attestert snapshot er uendret. | b |
| TF19 | **B10.** Oppsettet på web: avkrysningen vises bare for type fravær, lagres, og typekolonnen viser med/uten tak. | b |
| TF20 | **B10.** Mobil katalog: kolonnen legges til på eksisterende installasjon; `refreshKatalog` skriver feltet; mangler feltet i svaret → `NULL` → tak. | c |
| TF21 | **B10 / F12 = A.** Testen utgår. Vakt i stedet: fravær-arter tilbys ikke på linjene i Bekreft dag, og «Fravær til» vises ikke (B-varianten er forkastet). | c |
| TF22 | **B10.** Fraværskortet: art med tak → «+» stopper på resten (norm − arbeid − annet fravær); bytte fra art uten tak til art med tak klemmer; rest 0 → arter med tak nedtonet; art uten tak → ingen grense, også når dagen har fravær med tak; ukjent norm → ingen grense. | c |
| TF23 | **B10.** Brudd etter at arbeid eller fravær uten tak legges til: dagskortet viser fraværslinja med tak amber med «Rett til 5,5 t»; ett trykk retter raden; uten trykket endres raden aldri; sending sperret til rettet (F9 = A). **Eneste varsel (F5-tillegget):** dag med fravær og arbeid uten brudd viser ingen varsel. | c |
| TF24 | **B10 / F5.** Rad-vinduet i prosjektkort-modus: ny rad åpnet fra et prosjektkort tilbyr ikke fravær-arter; en lagret fraværsrad med prosjekt og art med tak sperrer lagring over resten; dagskort-modus uendret (vakt, F11). | c |
| TF25 | **B10.** Web: attesteringslista viser bruddlinja; rad-dialogen og «+ Fravær» viser «Høyst X t» og sperrer over taket. | b (visning), d (føring) |
| TF26 | **F1.** Etter migrering har hvert firma `fravaer_attesteres_av_prosjektleder = false`. `oppdaterSetting`: bare firma-admin kan slå valget av og på. Innstillingssiden viser og lagrer avkrysningen. | b |
| TF27 | **F8.** Fravær på framtidig dato: `tilfoyTimerRad` og `syncBatch` lagrer; telefonens Bekreft dag (manuell) med framtidig dato og «+ Fravær» lagrer og synker, og dagen kan sendes; web kan starte ny sedel med fravær fram i tid. Vakt: testen blir rød hvis en datosperre legges til stille. | b (server), c (mobil), d (web) |

### 11.8 Plass i ordrerekkefølgen (ordrepunkt 5)

**Vedtatt: ingen ny ordre og ingen ekstra kjøring — tillegget rir på b, c og d.**

| Ordre | Tillegg fra § 11 | Skjema |
|---|---|---|
| **a3** | Ingen. Fravær føres på prosjektkortets prosjekt inntil c er levert. | Nei |
| **b** | Skjema (§ 11.2) i **samme** `db-timer`-migrering som `kort_id`; `validerUtenProsjekt`; `syncBatch` og eldre klient (§ 11.3); alle server-lesere og -skriveveier (§ 11.4); F-F1; web tåler `null` og viser «Fravær» (§ 11.6); i18n. **F1:** `fravaer_attesteres_av_prosjektleder` i egen migreringsfil i `packages/db` (FM27), regelen i `krevAttesteringsrett`, `fravaerKanAttesteres` i de tre attesteringsleserne, avkrysningen i firmainnstillingene. **B10 (§ 11.10):** kolonnen `fravaer_normtak` med backfill i samme `db-timer`-migrering, seed og import, `harNormtak`/`vurderFravaerNormtak` i shared, lønnsartoppsettet på web, dag- og ukegrunnlaget, avvisning i interaktive skriveveier, bruddet i `syncBatch`-svaret og attesteringslista, attesteringssperren (F9 = A). | **Ja — migreringsfiler i `db`, `db-timer` og `db-varelager`; én kommando, ingen ekstra kjøring** |
| **c** | Mobil: lokal kolonne, `radProsjektId`, «+ Fravær», fraværskortet i Bekreft dag, dagskort og kortskjerm med beskrivelse (F4) og uten prosjektfelt (F2), føring fram i tid (F8), synk, utkast (§ 11.5). F5 trer i kraft her, og «Fravær til» fjernes (F12 = A). **B10:** lokal katalogkolonne, taket i fraværskortet og rad-vinduet, brudd-linja med ett-trykks retting — eneste varsel (F5-tillegget) — og send-sperren (§ 11.10.4). | Nei (SQLite med OTA) |
| **d** | Web: «+ Fravær», rad-dialogen der lønnsarten styrer prosjektfeltene (F7-tillegget), beskrivelse påkrevd for fravær (F4), ny sedel (§ 11.6). **B10:** «Høyst X t» i rad-dialogen og i «+ Fravær». | Nei |
| **e** | Urørt. Fravær-`CHECK` ligger alt i b. | — |

Rekkefølge som før: a → a2 → a3 → b → c → d → e. **b må være i prod før c sendes som OTA** (§ 11.3). Mellom c og d
kan fravær uten prosjekt føres på telefon og leses, attesteres og rapporteres på PC, men ikke opprettes på PC.

**Forkastet:** egen ordre for fravær før kort-id. Koster én ekstra migrering Kenneth må kjøre og én ekstra runde
gjennom de samme skriveveiene i `dagsseddel.ts`.

### 11.9 Beslutninger — Kenneths svar 2026-11-16 (ordrepunkt 4)

F1–F11 er besvart. Svaret står ordrett sist i hver rad og er ført inn i §§ 11.2–11.10 — en koder trenger ikke lese
radene for å bygge. F12 er besvart (A).

| # | Spørsmål | Anbefaling |
|---|---|---|
| **F1** | **Hvem attesterer fravær uten prosjekt?** I dag avgjør radens prosjekt hvem som kan attestere (FM7). A: bare firma-admin (lønnsansvarlig). B: også prosjektlederen som attesterer resten av dagen. | **A.** Prosjektlederen attesterer arbeid på sitt prosjekt; sykdom og ferie er lønnsansvarligs sak (B8: «opp til ansatte og lønnsansvarlige»). Prosjektlederen ser raden nedtonet. Konsekvens: en dag med både arbeid og fravær er ikke ferdig attestert før firma-admin har tatt fraværslinja. ✅ **Kenneth 2026-11-16: firmavalg med avkrysning.** «lag dette til et firmavalg med avkryssing->standard er lønnsansvarlig, la prosjektleder bli alternativ». Standard: bare lønnsansvarlig (firma-admin). Avkrysset: også prosjektlederen som attesterer resten av dagen. Krever innstilling pr. firma (bygges i b). |
| **F2** | **Inngang på telefon:** egen «+ Fravær» på dagskortet og i Bekreft dag, eller «Fravær» som førstevalg i prosjektlista? | **«+ Fravær»** (U1, skisse i § 11.5). Tre trykk og synlig. Alternativet har ingen ny knapp, men gjemmer fravær bak prosjektfeltet. ✅ **Kenneth 2026-11-16: «+ Fravær» som anbefalt**, og «Ved fravær trenger vi ikke prosjekt visning -> skjul prosjekter»: prosjekt-/underprosjekt-/byggeplassfeltet vises ikke på fraværskortet. |
| **F3** | **Timer eller klokkeslett på fravær?** | **Bare timer,** forhåndsutfylt med resten av normen (U3). Klokkeslett på fravær gir ingen lønnsmessig verdi og ville gi overlapp-varsler mot arbeid. ✅ **Kenneth 2026-11-16: som anbefalt** — bare timer, forhåndsutfylt med resten av normen. |
| **F4** | **Skal fravær kreve beskrivelse?** I dag kreves det på alt som ikke er reise (FM13). | **Nei.** Lønnsarten sier hva det er. Unntaket for reise utvides til fraværskortet. ⚠️ **Kenneth 2026-11-16: «ja» — fravær KREVER beskrivelse** (motsatt av anbefalingen). Kravet fra FM13 gjelder også fraværskortet; reise-unntaket utvides ikke. |
| **F5** | **Når fraværskortet finnes: skal fravær-artene ut av lønnsartvalget på prosjektkortets linjer (a3)?** | **Ja, fra c.** Da har fravær ett hjem, og prosjektets timer inneholder ikke fravær. Rader som alt er ført slik, blir stående. Dette fjerner en mulighet a3 nettopp ga («inntil videre») — derfor spørsmål. ✅ **Kenneth 2026-11-16: ja, fra c.** ✅ Tilleggsspørsmål «bør vi varsle ved konflikt i timeføring?» — **Kenneth 2026-11-16: ja, varsel bare når fravær med tak bryter taket (B10)**; ingen varsel for kombinasjonen fravær + arbeid ellers (U9 står). |
| **F6** | **Dagskort-modus** (firma uten prosjektkort): vise fravær uten prosjekt nå og la oppretting vente, eller gi skjermen «+ Fravær» med en gang? | **Vise nå, opprette senere.** Skjermen er vernet (dagskort isolert). Fravær kan fortsatt føres der med prosjekt som i dag. ✅ **Kenneth 2026-11-16: som anbefalt.** |
| **F7** | **Sperre endring av lønnsartens type** bort fra fravær når arten står på en rad uten prosjekt? | **Ja.** Ellers kan en arbeidsart stå uten prosjekt etter en endring i oppsettet. Firmaet lager en ny lønnsart i stedet. ✅ **Kenneth 2026-11-16: ja.** Tilleggsspørsmål «kan vi skjule/vise prosjekt avhengig av lønnsart?» — følger av F2: valgt fravær-art skjuler prosjektfeltet, annen art viser det. |
| **F8** | **Fravær over flere dager** (ferie, sykemelding): ett trykk pr. dag, eller «gjelder til og med dato»? | **Ikke i denne runden.** Én dag om gangen nå; flerdagers fravær som egen ordre etter d. ✅ **Kenneth 2026-11-16: b–d bygges med fravær én dag om gangen, med lov til å føre fravær fram i tid. Flerdagers føring, bytte av lønnsart på flere dager samtidig og feriesaldo blir egen ordre etter d, med egen spec fra Fabel (BACKLOG).** Kenneths eksempel: «dersom en arbeidstaker fyller ut ferie før han reiser, og blir syk mens han er på ferie ->arbeidsgiver åpner kortene for redigering -> ferie byttes til sykdom iht. regler om evt. legeerklæring -> ferie vil da bli omgjort til sykedager, og feriedager vil kunne tas ut senere.»  |
| **F9** | **B10 — hvor hardt håndheves taket?** A: telefon og PC klemmer ved føring; en dag over taket kan ikke sendes fra ny app og kan ikke attesteres før fraværet er rettet; synken lagrer alltid. B: klemming ved føring og varsel til attestanten, som kan attestere likevel. C: som A, og serveren avviser også i synken. | **A.** «Kan ikke» holder da helt fram til lønn — også for eldre app og dagskort-modus — uten at en dag ført offline spretter. B lar 9,5 t gå til lønn hvis attestanten trykker forbi. C kan stoppe timeføringen for ansatte med eldre app. Konsekvens av A: uattesterte dager som alt bryter taket når b deployes, må rettes før de kan attesteres (antall: gate-SQL D, § 11.10.2). ✅ **Kenneth 2026-11-16: A.** |
| **F10** | **B10 — hvilke standardarter har taket?** Du navnga egenmelding, sykemelding og barns sykdom (tak) og ubetalt fravær (ikke tak). Ikke navngitt: Ferie m/lønn, Bevegelig helligdag, Permittering m/lønn, Velferdspermisjon. | **Tak: Permittering m/lønn og Velferdspermisjon** — arbeidsgiver betaler fraværet, som ved sykdom. **Ikke tak: Ferie m/lønn og Bevegelig helligdag** — B8: arbeid på en feriedag lønnes «med avspasering eller med lønn», altså i tillegg til feriedagen; med tak ville 2 t arbeid kutte feriedagen til 5,5 t. Firmaet kan snu hver art i oppsettet. Derfor heter markøren «tak mot dagsnormen», ikke «betalt». ✅ **Kenneth 2026-11-16: «enig»** — tak: Permittering m/lønn, Velferdspermisjon; ikke tak: Ferie m/lønn, Bevegelig helligdag. Kenneth: «en feriedag skal ikke kuttes til 5,5 timer pga arbeid. da er det 7,5 timer ferie + 2 timer arbeid.» ✅ **Blanding (Kenneth 2026-11-16, ja):** fravær med tak kan høyst være dagsnormen − arbeid − annet fravær samme dag (med og uten tak); fravær uten tak beholder sine timer. Ferie m/lønn 7,5 + egenmelding → 0 egenmelding; privat ærend 2 + egenmelding → høyst 5,5; ferie 7,5 + arbeid 2 uendret. Erstatter «norm − arbeid» i § 11.10 der det står. |
| **F11** | **B10 — dagskort-modus** (firma uten prosjektkort): skal rad-vinduet der få taket i c, eller senere? | **Senere.** Skjermen er vernet (dagskort isolert). Med F9 = A stoppes en dag over taket uansett ved attestering. ✅ **Kenneth 2026-11-16: som anbefalt** — senere. |
| **F12** | 🟡 **«Fravær til» i Bekreft dag når fravær får eget kort i c.** Kontrollen ble merget i a3 (`6d611b05`): den deler ett kort i fravær + arbeid (B9) og vises bare når normallinja har fravær-art. F5 = ja tar fravær-artene ut av linjene, men svaret nevnte ikke «Fravær til» ved navn. **A:** «Fravær til» går ut i c. Privat ærend 08–15:30 og arbeid 15:30–17 føres som arbeidskort 15:30–17 og «+ Fravær» 6,0 t. **B:** «Fravær til» beholdes som snarvei; fraværsdelen lagres som linje i fraværskortet (bare timer), arbeidsdelen på prosjektkortet. | **A.** Én vei inn til fravær, og F3 sier bare timer — «Fravær til» fører fravær med klokkeslett. Lønnsresultatet er det samme: arbeidet er normaltid fordi fravær aldri bruker normen (B9 står). Koster ett trykk mer. B gir to veier til samme kort, og snarveien må da også få beskrivelse og tak. Konsekvens av A: taket bygges ikke inn i «Fravær til» (TF21 utgår), og a3 går på OTA først sammen med c. ✅ **Kenneth 2026-11-16: A** — «Fravær til» fjernes i ordre c; fravær føres bare via «+ Fravær» (fraværskortet). a3 sendes på OTA først sammen med c. |

**Exit-svar ordre c — 🟢 Kenneth 2026-11-16** (ordrett):
- **E1 «Endre kort» til en nøkkel som alt har kort:** «Kort til prosjekt som allerede har kort, sjekk om tidspunkter kolliderer, hvis ikke registrer hver for seg. Merknad tilhører kortet og skal fortsette å gjøre det. Merknad er kundens dokumentasjon på hva som er utført av arbeid.» → kortet beholder id-en (K7), beskrivelsen følger kortet; overlapp i tid gir samme sperre som når en rad lagres i dag (`timer.feil.overlapp`). Systemteksten `timer.kort.sammenslaa` er fjernet.
- **E2 Dagsummen:** «Jeg er usikker, men jeg tror det. Lønnsarten sorterer den ut.» → «Send dagen (N t)» og «Sum i dag» tar med fraværstimer (`dagSumTimer`). Normtak og brudd endres ikke. (Setningen under om at dagens sum viser arbeid og fravær hver for seg gjelder serverens overtidsgrunnlag og dagsoversikten; telefonens dagsum er nå én sum.)
- **E3 «Slå sammen igjen»:** ~~«Jeg tror ikke det er aktuelt å slå sammen noe etter oppdeling.»~~ Snudd samme dag etter at knappen ble forklart (den angrer «Del til eget kort» før lagring): «Skal den nye knappen «Slå sammen igjen» beholdes? … -> ja». → 🟢 `angreKortDeling`, knappen og `timer.bekreftDag.kort.slaaSammen` beholdes.
- **E4 −/+ i fraværskortet uten tidsrunding = 0,5 t:** ja.

**Ingenting låser ordre b.** F12 låser én rad i ordre c («Fravær til», § 11.4); resten av c og hele d kan bygges.
Følger av B8 og bygges uten ny beslutning: F-F1 (overtidsgrunnlaget på server teller ikke fravær som arbeid) og at
dagens sum viser arbeid og fravær hver for seg.

### 11.10 B10 — betalt fravær og dagsnormen (TILLEGG, Kenneth 2026-11-16)

> **Status:** 🟢 VEDTATT 2026-11-16 — B10 (§ 10) med F9 = A, F10 (hvilke arter + blanding) og F11 = senere (§ 11.9).
> Ingen kode. Målt mot develop @ e3c7d6cf. **Bygges i b (skjema, server, oppsett), c (mobil) og d (web-føring)** — § 11.8.
> **Uendret:** fravær bruker aldri normen for arbeidet (L1, B8). B10 legger et tak på *fraværstimene*, ikke på arbeidet.
> **Ordbruk:** *fravær med tak* = fravær-art med `fravaerNormtak` (egenmelding, sykemelding, barns sykdom, permittering
> m/lønn, velferdspermisjon). *Fravær uten tak* = øvrige fravær-arter: de ubetalte, og ferie m/lønn og bevegelig
> helligdag (F10). «Betalt fravær» er ikke et begrep i reglene — ferie m/lønn er betalt og uten tak.

**B10 i én setning:** arbeidet regnes som før — normaltid til normen, deretter overtid, og fravær teller ikke.
Det nye er at **fravær med tak bare kan fylle det som er igjen av dagsnormen etter arbeid og annet fravær samme dag.**
Fravær uten tak beholder alltid sine timer (F10-blandingen).

| Dagen (norm 7,5 t) | Resultat |
|---|---|
| 2 t arbeid + egenmelding | Høyst 5,5 t egenmelding |
| 2 t privat ærend + egenmelding | Høyst 5,5 t egenmelding |
| 7,5 t ferie m/lønn + egenmelding | 0 t egenmelding |
| 7,5 t ferie m/lønn + 2 t arbeid | Uendret: 7,5 t ferie og 2 t arbeid |

#### 11.10.1 Målt mot koden (develop @ e3c7d6cf)

Stiforkortelser som i § 11.1. `lonnsarter/page.tsx` = `apps/web/src/app/dashbord/firma/timer/lonnsarter/page.tsx`.

| # | Funn | Referanse |
|---|---|---|
| FM17 | `Lonnsart` har ingen markør for betalt/ubetalt — bare `type`. | `schema.prisma:22–53` (`type` `:25`) |
| FM18 | Standardkatalogen har elleve fravær-arter: ti i nivå 1, én i nivå 2 («Velferdspermisjon»). To heter «u/lønn». «Privat ærend» og «Permisjon uten lønn» finnes ikke i seed. Importerte kataloger har egne navn (ikke målt mot data). | `apps/api/src/services/seed/index.ts:58–75`, `:112–113`; `apps/api/src/services/katalog/importerKatalog.ts:335–343` |
| FM19 | Lønnsarter opprettes fire steder: oppsettet, seed nivå 1 og 2, katalogimport og demo-seed. Typen kan endres i `oppdater`. `list` returnerer hele raden uten `select` — et nytt felt følger med til web og mobil uten endring i ruten. | `lonnsart.ts:19`, `:41`, `:99`; `seed/index.ts:103`, `:169`; `importerKatalog.ts:335`; `packages/db/scripts/seed-timer-demo.ts:372` |
| FM20 | Mobil: `lonnsart_local` har ikke feltet. `refreshKatalog` sletter og skriver hele tabellen ved hver katalogsynk; nye kolonner legges til med `ALTER` i `migreringer.ts` (mønster `er_standardvalg`). | `src/db/schema.ts:400–419`; `src/services/timerKatalog.ts:86–106`; `src/db/migreringer.ts:275–284` |
| FM21 | a3 behandler alt fravær likt. Bekreft dag: fravær på normallinja får timene til vinduet fram til «Fravær til», og arbeidet etter regnes mot normresten — fraværstimene måles aldri mot arbeidet. Fravær-arter slås opp på `type` alene, tre steder. | `src/utils/dagsforslag.ts:1851–1886`; `src/utils/overtidMotDognet.ts:37–42`; `src/utils/manuellDag.ts:90–97`, `src/services/timerKatalog.ts:226–237`, `src/components/timer-detalj/TimerSeksjon.tsx:1240–1248` |
| FM22 | Rad-vinduet (mobil og web) godtar et hvilket som helst timetall på en fravær-art; ingen grense mot normen. | `LonnsartVelgerModal` (`TimerSeksjon.tsx:2339`); `page.tsx:3343–3356` |
| FM23 | 🔴 **En rad med fra–til og timer som ikke stemmer med spennet tåles ikke.** Interaktive skriveveier avviser («Antall timer … stemmer ikke med tidsrommet»). Synken lagrer, teller avviket, og gjør raden til **pausebærer** når differansen er lik standardpausen. En rad uten fra–til vurderes ikke. | `vurderRadTimer` (`dagsseddel.ts:649–726`), `avvisTimerAvvik` (`:787–803`) |
| FM24 | Server-overtidsgrunnlaget kjenner ikke lønnsart-type: alle rader som ikke er reise, er arbeid — på dag-nivå (attesteringslista) og uke-nivå (snapshot ved attestering). Ukesbadgen summerer `totaltimer`. «Krever vurdering» slår alt i dag ut når `totaltimer ≠ dagsnorm`. | `dagsseddel.ts:1223–1275`, `:4295–4304`; kallere `:4501`, `:4742`, `:6020`; `packages/shared/src/utils/overtidsgrunnlag.ts:59–92`, `:181–193` (kallere: web `firma/timer/attestering/page.tsx:302`, `AttesteringPivot.tsx:447`; mobil `app/timer/attestering/index.tsx:104`); `apps/web/src/components/attestering/sedel-vurdering.ts:39–41` |
| FM25 | Dagsnormen har én kilde: `hentEffektivArbeidstid(organizationId, dato)` — pr. firma og dato, ikke pr. ansatt. Telefonen cacher svaret pr. dato. | `apps/api/src/services/timer/arbeidstid.ts:45–48` |
| FM26 | `bruktAvNorm` og `klassifiserMotDognet` bor i mobilen, ikke i `packages/shared` (0 treff på `bruktAvNorm` i `packages/shared`, `apps/api`, `apps/web`) — a2 er ikke bygget. Bare manuell dag fyller `eksisterende.bruktAvNorm`. | `src/utils/overtidMotDognet.ts`; `src/utils/manuellDag.ts:101`, `:157` |

🔴 **Retting av § 11 slik den sto:** eksempelet «4,5 t egenmelding + 3 t arbeid gir avvik» (F-F1 og TF8) var feil —
summen er 7,5 t, lik normen, og gir ikke avvik i dag. Riktig rødt tilfelle er B9-eksempelet: 7,5 t fravær + 1,5 t
arbeid regnes i dag som 9 t arbeid og gir 1,5 t «beregnet overtid» (`overtidsgrunnlag.ts:66–82`). F-F1-raden
(§ 11.4) og TF8 (§ 11.7) er rettet.

#### 11.10.2 Markøren (ordre b)

| | |
|---|---|
| **Felt** | `Lonnsart.fravaerNormtak Boolean @default(true) @map("fravaer_normtak")` → `timer.lonnsarter.fravaer_normtak BOOLEAN NOT NULL DEFAULT true`. I **samme** `db-timer`-migrering som `kort_id` og `uten_prosjekt` — ingen ekstra kjøring for Kenneth. Additiv (to-stegs-policyen). |
| **Betydning** | Leses bare når `type = 'fravaer'`. `true` = *fravær med tak*: arten kan høyst fylle det som er igjen av dagsnormen etter arbeid og annet fravær (§ 11.10.3). `false` = *fravær uten tak*: føres fullt og måles aldri (B9, F10). |
| **Hvorfor ikke `betalt`** | Navnet sier hva feltet gjør. «Ferie m/lønn» er betalt, men har ikke tak (F10, Kenneth: «en feriedag skal ikke kuttes til 5,5 timer pga arbeid»). |
| **Én leser** | `harNormtak(lonnsart)` i `packages/shared`: `type === 'fravaer' && fravaerNormtak !== false`. Ingen annen kode leser feltet (glue-vakt). Ukjent verdi — mobil før første katalogsynk, ny mobil mot gammel API — gir tak. |
| **Hvorfor standard `true`** | Feil vei koster ulikt. Ubetalt art merket med tak: fraværstimene klemmes, ingen lønnseffekt. Betalt art uten tak: 9,5 t betalt for 2 t arbeid — det B10 skal hindre. |
| **Backfill** (samme migrering, diskriminerende `WHERE`) | `UPDATE timer.lonnsarter SET fravaer_normtak = false WHERE type = 'fravaer' AND (navn ILIKE '%u/lønn%' OR navn ILIKE '%uten lønn%' OR navn ILIKE '%ubetalt%' OR navn ILIKE '%privat%' OR navn ILIKE 'ferie m/lønn%' OR navn ILIKE '%helligdag%')` — de to siste leddene er F10: ferie m/lønn og bevegelig helligdag har ikke tak. Alle andre fravær-arter står med `true`. |
| **Stille tomhet** | (a) `NOT NULL` — ingen rad mangler verdi; (b) backfill over; (c) gate-SQL C: Kenneth leser lista over hver fravær-art med verdien **før c sendes som OTA**; (d) test TF13. Verdien på en art som ikke er fravær leses aldri (TF14). |
| **Forkastet** | Nullable kolonne + `CHECK ((type = 'fravaer') = (fravaer_normtak IS NOT NULL))`. Sterkere garanti, men gammel API skriver fravær-arter uten feltet i vinduet mellom `migrate` og `up` og etter en tilbakerulling — oppsett, typeendring og seed ved nytt firma ville feile (B2-problemet). |

**Hvor firma setter den:** lønnsartoppsettet på web (`lonnsarter/page.tsx`). I dialogen vises en avkrysning bare når
typen er fravær — samme mønster som overtidsnivå, som bare vises for ordinær (`:474–500`). I tabellen vises verdien i
typekolonnen («Fravær · med tak» / «Fravær · uten tak»), ingen ny kolonne. `opprett` og `oppdater` (`lonnsart.ts:41`,
`:99`) får `fravaerNormtak: z.boolean().optional()`; uten feltet → `true`. Katalogimporten får samme valgfrie felt i
fixturen. Sidens ?-hjelpetekst og `hjelpetekster.md` oppdateres i samme commit; nøkler i `nb.json` + `en.json`.

Tekstforslag (endelig ordlyd etter `tooltip-hjelpetekst-veileder.md`): avkrysning **«Fraværet kan høyst fylle resten
av dagsnormen»**, hint «Slå på for fravær arbeidsgiver betaler i stedet for arbeid: egenmelding, sykemelding og barns
sykdom. Uten avkrysning — for eksempel ferie og privat ærend — føres fraværet fullt, og arbeid samme dag kommer i tillegg.»

**Endring av markøren på en art i bruk** virker framover fra neste katalogsynk. Uattesterte dager vurderes mot ny
verdi; attesterte rader og snapshots røres ikke.

**Seed-verdier for standardartene** (`seed/index.ts`; begge seed-listene får feltet):

| Art | Tak | Hjemmel |
|---|---|---|
| Sykemelding 1–16 dager (fastlønn) · Sykemelding 1–16 dager (timelønn) · Sykemelding fra dag 17 · Egenmelding inntil 3 dager · Barns sykdom | **Ja** | B10 — navngitt av Kenneth |
| Ferie u/lønn · Permittering u/lønn | **Nei** | B10 — ubetalt |
| Permittering m/lønn · Velferdspermisjon | **Ja** | ✅ F10 (Kenneth: «enig») — arbeidsgiver betaler fraværet |
| Ferie m/lønn · Bevegelig helligdag | **Nei** | ✅ F10 (Kenneth: «enig») — arbeid på en feriedag lønnes i tillegg; feriedagen kuttes ikke |

**Gate-SQL Kenneth kjører etter migrering** (i tillegg til A og B i § 11.2):

```sql
-- C) hver fravær-art pr. firma med verdien — leses før c sendes som OTA
select organization_id, navn, kode, aktiv, fravaer_normtak from timer.lonnsarter
 where type = 'fravaer' order by organization_id, fravaer_normtak, navn;
-- D) til orientering: dager som bryter taket i dag, pr. sedelstatus (fast dagsnorm fra firmainnstillingen;
--    firma med kalendernorm kan avvike noe). Tallet sier hvor mange dager som må rettes før attestering (F9).
--    Taket følger F10-blandingen: dagsnorm − arbeid − fravær uten tak.
select s.status, count(*) from (
  select ds.id, ds.status, os.dagsnorm,
         sum(t.timer) filter (where l.type = 'fravaer' and l.fravaer_normtak) as fravaer_med_tak,
         sum(t.timer) filter (where l.type = 'fravaer' and not l.fravaer_normtak) as fravaer_uten_tak,
         sum(t.timer) filter (where l.type <> 'fravaer' and not t.er_reise) as arbeid
    from timer.daily_sheets ds
    join timer.sheet_timer t on t.sheet_id = ds.id and t.attestert_status is distinct from 'erstattet'
    join timer.lonnsarter l on l.id = t.lonnsart_id
    join organization_settings os on os.organization_id = ds.organization_id
   group by ds.id, ds.status, os.dagsnorm
) s where s.dagsnorm > 0
    and coalesce(s.fravaer_med_tak, 0)
        > greatest(0, s.dagsnorm - coalesce(s.arbeid, 0) - coalesce(s.fravaer_uten_tak, 0)) + 0.01
 group by s.status;
```

#### 11.10.3 Regelen — én kilde (ordre b)

Ny ren modul i `packages/shared` (`fravaerNormtak.ts`), brukt av server, web og mobil. Pr. ansatt pr. dato:

| Størrelse | Definisjon |
|---|---|
| **arbeid** | L1-grunnlaget: timer på rader som ikke er reise, ikke fravær og ikke `erstattet`. Overtidsrader teller. |
| **fravær med tak** | Timer på rader med fravær-art med tak (`harNormtak`), ikke `erstattet`. Flere linjer summeres. |
| **fravær uten tak** | Timer på rader med fravær-art uten tak, ikke `erstattet`. |
| **tak** | `max(0, dagsnorm − arbeid − fravær uten tak)`, to desimaler. Ukjent norm (`dagsnorm ≤ 0`, L3) → **intet tak**: ingenting klemmes, ingenting flagges. |
| **brudd** | `fravær med tak − tak > 0,01`. |
| **rest for én linje** | Det én fraværslinje med tak høyst kan være: `max(0, dagsnorm − arbeid − alt annet fravær på datoen)` — annet fravær med og uten tak (F10, ordrett: «dagsnormen − arbeid − annet fravær samme dag»). |

Fravær teller etter lønnsartens type — med og uten prosjekt. Rader ført før c, fra eldre app og fra dagskort-modus er med.

| # | Regel |
|---|---|
| N1 | **Arbeidet regnes som før.** Fravær — med eller uten tak — bruker aldri normen for arbeidet (L1, B8, B9). 2 t arbeid etter egenmelding er normaltid. Overtid først når arbeidet alene passerer normen. |
| N2 | **Fravær med tak kan høyst være taket.** Flere linjer med tak samme dag deler det. |
| N3 | **Fravær uten tak måles aldri og beholder sine timer** (B9, F10). Det bruker av plassen fravær med tak kan fylle: 7,5 t ferie m/lønn → 0 t egenmelding; 2 t privat ærend → høyst 5,5 t egenmelding. |
| N4 | **Arbeid og fravær uten tak avvises aldri av taket.** Den ansatte skal alltid kunne føre tiden som er arbeidet (B8), og en feriedag kuttes ikke (F10). Det er fraværet med tak som viker. |
| N5 | **Eksisterende rader endres aldri stille** (L5). Føres arbeid eller fravær uten tak etter at fravær med tak alt står på dagen, oppstår brudd. Det vises, og den som fører retter fraværet med ett trykk (§ 11.10.4). |
| N6 | **Arbeid og fravær uten tak fyller normen** (tak 0): fravær med tak kan ikke føres på dagen. Står det der fra før, er hele linja brudd, og rettingen er å slette linja. Arbeidet og fraværet uten tak røres ikke. |
| N7 | **Taket er eksakt,** ikke rundet til firmaets tidsrunding: norm 7,5 − arbeid 2,25 = 5,25 t. Stepperen stopper på taket også utenfor gridet. |
| N8 | **Reise teller ikke som arbeid i taket** — følger L1 og V1 (reise bruker aldri normen). |
| N9 | **Normen er firmaets dagsnorm for datoen** (FM25), samme norm som L1–L3 — også for en framtidig dato (F8). 🟡 Det finnes ingen norm pr. ansatt; en deltidsansatt måles mot firmaets norm, som i overtidsregelen i dag. |
| N10 | **Brudd er det eneste varselet** om fravær og arbeid på samme dag (F5-tillegget, U9). |

Funksjoner: `harNormtak(lonnsart)` · `restForFravaerMedTak({ dagsnorm, arbeid, annetFravaer })` → timer eller `null`
(intet tak) · `vurderFravaerNormtak({ dagsnorm, rader })` → `{ arbeid, fravaerMedTak, fravaerUtenTak, tak, overTak }`.

#### 11.10.4 Regelen pr. flate

**Mobil (ordre c)**

| Flate | Regel |
|---|---|
| **Fraværskortet** (§ 11.5) | U3 forhåndsutfyller med resten av normen (norm − arbeid − annet fravær). For art med tak er resten også øvre grense — «+» stopper der, med linja «Høyst 5,5 t — 2,0 t arbeid er ført» (annet fravær nevnes når det finnes: «… 2,0 t arbeid og 2,0 t annet fravær er ført»). Bytte fra art uten tak til art med tak klemmer timene til resten før lagring. Rest 0: arter med tak vises nedtonet med «Dagsnormen er fylt»; arter uten tak kan fortsatt velges. Art uten tak: ingen grense. |
| **Bekreft dag — «Fravær til»** (a3) | **Bygges ikke — F12 = A (Kenneth 2026-11-16): «Fravær til» fjernes i c.** Forkastet variant (B), stående for sporbarhet: art med tak → fraværslinjas timer = `min(vinduets timer, rest)`, der resten regnes etter § 11.10.3 med datoens arbeid og fravær fra før + kortets arbeid etter punktet. Punktet styrer fortsatt hvor arbeidet starter, og arbeidet etter er normaltid mot normresten (N1) — delingen i `beregnSegment` står. 🔴 Fraværsdelen lagres som linje i fraværskortet **uten klokkeslett** (F3, FM23). Rest 0: ingen fraværslinje lagres, linja vises med «Dagsnormen er fylt», og delingen står (en husket «Overtid fra» leses ikke, a3 A2). Art uten tak: fraværsdelen får vinduets timer. |
| **Rad-vinduet i prosjektkort-modus** | Ny rad åpnet fra et prosjektkort tilbyr ikke fravær-arter (F5). En lagret fraværsrad med prosjekt — ført før c, fra eldre app eller fra PC — kan åpnes: har arten tak, er resten øvre grense i timefeltet, og lagring over den sperres med samme linje som over. Stemmer ikke fra–til med klemte timer, lagres raden uten klokkeslett (FM23). |
| **Brudd som oppstår etterpå** (N5: arbeid eller fravær uten tak ført etter fraværet, eller rad kommet fra PC) | Dagskortet viser fraværslinja med tak amber: «Egenmelding 7,5 t + arbeid 2,0 t er over dagsnormen 7,5 t» (annet fravær nevnes når det finnes) med knappen **«Rett til 5,5 t»** (tak 0: **«Slett fraværet»**). Ett trykk retter raden. Med F9 = A sperres sending av dagen til bruddet er rettet — samme mønster som send-sperren for manglende beskrivelse. **Dette er det eneste varselet om fravær og arbeid på samme dag (F5-tillegget, N10).** |
| **Dagskort-modus-skjermen** | Urørt i c (dagskort isolert, F11). Brudd derfra fanges på server. |
| **Lønnsartkatalogen** | Ny lokal kolonne `fravaer_normtak INTEGER` (nullable) med `ALTER` i `migreringer.ts`; `refreshKatalog` skriver `l.fravaerNormtak ?? null`. De tre oppslagene i FM21 leser `harNormtak` i tillegg til type. |

**Web**

| Flate | Regel | Ordre |
|---|---|---|
| Lønnsartoppsettet | Markøren (§ 11.10.2). | b |
| Attestering | En dag i brudd viser «Egenmelding 7,5 t + arbeid 2,0 t = 9,5 t — over dagsnormen 7,5 t» (annet fravær nevnes når det finnes) der overtidsvarselet står i dag (banneret i `AttesteringDetalj.tsx:408–418`), og i attesteringslista på telefon (`apps/mobile/app/timer/attestering/index.tsx`). Sedelen ligger alt under «Krever vurdering» (FM24). Med F9 = A er attestering av datoen sperret mens bruddet står; attestanten returnerer sedelen, eller firma-admin retter timene (`redigerSedelRader`). | b |
| Dagsseddel-siden, rad-dialogen | Art med tak valgt: timefeltet viser «Høyst 5,5 t» og sperrer lagring over resten (§ 11.10.3). I b viser dialogen bare serverens avvisning; grensen i feltet kommer i d. | b / d |
| «+ Fravær» (§ 11.6) | Samme grense som fraværskortet på telefon. | d |

**Server (ordre b)**

| Hva | Regel |
|---|---|
| **Avledning** | `vurderFravaerNormtak` kjøres der dag-grunnlaget bygges i dag (`hentTilAttesteringFirma`, `:4295`) og returneres ved siden av `overtidsgrunnlag`. De to andre attesteringsleserne får samme felt: `hentTilAttestering` (`:4017`, bærer ikke dag-grunnlag i dag) og `hentForAttestering` (`:4364`, bærer bare ukegrunnlaget, `:4501`). Radutvalget utvides med `lonnsart.type` og `lonnsart.fravaerNormtak`. Normen er `hentEffektivArbeidstid` for datoen — aldri den flate kolonnen. |
| **F-F1 på dag-nivå** | `OvertidRad` får `erFravaer` (påkrevd i typen, som `erReise`). Fravær holdes utenfor `arbeidstimer`, `sumOrdinaert`, `sumOvertid` og beregnet overtid, og summeres i nytt `fravaerTimer`. Med og uten tak likt (N1). Eldre snapshots uten feltet leses som `fravaerTimer = 0` — det som faktisk ble attestert. |
| **F-F1 på uke-nivå** | 🟡 Fravær kan ikke bare strykes fra ukegrunnlaget. Mandag 7,5 t egenmelding + tirsdag–fredag 9,5 t med 2 t ført overtid hver dag gir 38 t arbeid mot ukenorm 37,5 → beregnet 0,5 t, ført 8 t → falskt avvik. I dag er dette tilfellet riktig, fordi fraværet telles. Regel: **i ukesummen fyller fravær dagens norm, aldri mer** — hver dag teller `arbeid + min(fravær, max(0, dagsnorm − arbeid))`, med og uten tak likt. Da er både tilfellet over og B9-dagen (7,5 t privat + 1,5 t arbeid) riktige. Krever dato og type i utvalget i `byggUkeOvertidsgrunnlag` (`:1247–1264`), og at ukesbadgen (`beregnUkeAvvik`, `overtidsgrunnlag.ts:181–193`, tre kallere i FM24) får dagens klemte sum i stedet for `totaltimer`. |
| **Interaktive skriveveier** (web) | `tilfoyTimerRad` (`:2377`), `oppdaterTimerRad` (`:2606`), `redigerSedelRader` (`:5043`): en **fraværsrad med tak** som etter skrivingen ligger over resten, avvises med tallene («Egenmelding kan høyst være 5,5 t denne dagen — 2,0 t arbeid er ført»). En arbeidsrad og en fraværsrad uten tak avvises aldri (N4) — også når skrivingen setter dagen i brudd; bruddet vises og rettes (N5). En skriving som senker en fraværsrad på en dag som alt er i brudd, godtas — ellers kan ingen rette dagen. |
| **`syncBatch`** (`:6409`) | Lagrer alltid — en offline-dag eller en eldre app skal ikke sprette (SYNC-1). Bruddet følger med i svaret, så ny mobil viser det. |
| **Attestering** | Med F9 = A: `attester` (`:5945`) og `attesterRader` (`:4657`) avvises for en dato i brudd, med tallene. `returner`, `returnerRader` og `redigerSedelRader` virker. Attesterte rader og snapshots røres ikke. Bruddet regnes etter § 11.10.3, med blandingen. |
| **Eksport og rapport** | Uendret. 🟡 Ikke målt: om lønnseksporten bare tar attesterte rader. Koderen måler det i b; tar den også uattesterte, meldes det før levering — da holder ikke «stoppes ved attestering» alene. |

#### 11.10.5 Eldre klient og rekkefølge

| Situasjon | Hva skjer |
|---|---|
| Eldre mobil (uten B10) fører 7,5 t egenmelding + 2 t arbeid | Lagres som i dag. Dagen står i brudd i attesteringslista; med F9 = A stopper attesteringen til den er rettet. |
| Ny mobil mot gammel API (feltet finnes ikke) | Alle fravær-arter får tak (`harNormtak` ved ukjent verdi). Fravær uten tak klemmes til b er ute. Enda en grunn til «b før c». |
| Ny mobil før første katalogsynk | Lokal kolonne er `NULL` → tak. Rettes ved neste katalogsynk. |
| Gammel API etter tilbakerulling | Skriver nye fravær-arter uten feltet → `true` (standard). Ingen feil. |
| Dagskort-modus | Skjermen har ingen grense (F11). Bruddet fanges på server som for eldre mobil. |

**Test-OTA og a3:** a3 ligger på develop uten B10 og behandler alt fravær som uten tak; test-OTA holdes. Første OTA
som bærer a3, er c-leveransen. F12 = A (Kenneth 2026-11-16): a3 kan ikke
gå på OTA foran fraværskortet, fordi «Fravær til» da verken får tak eller blir stående; c leveres som én ordre.

---

## 12. TILLEGG — kortet følger hele veien: attestering, eksport/fakturering og rapport (Kenneth 2026-11-16)

> **Status:** 🟢 H1–H10 besvart av Kenneth 2026-11-16 (§ 12.8.1) og ført inn i reglene under (del 3). 🟡 Åpent til
> Kenneth: ingen. H1–H14, H2-skissen og mal-raden besvart 2026-11-16 (§ 12.8.1 og § 12.8.3; H12 = sperre ved føring, H14 = underlinjer med tydelig skille). Ingen kode. **FUNKSJONSENDRING**; hjemmel:
> Kenneth 2026-11-16, ført i § 5.4 som ⚠️ SNUDD (`10d343ce`), «Visningskrav» (`0783cf1d`) og «Total overhaling»
> (`f465d7d5`). Hjemmel for del 2: Kenneths ord under («Rapportens Detaljer som mønster»). Hjemmel for del 3: § 12.8.1.
> Målt mot develop @ `10d343ce`; HM22–HM25 mot `0783cf1d`; HM26–HM30 mot `f465d7d5`; HM31–HM41 mot `a49821ca`;
> HM42–HM56 mot `12d9ae8d`.
>
> **Omfang:** hele attesteringen — fanene Sedler, Etter prosjekt og Etter ansatt, firma- og prosjektattesteringen — og
> rapportens Detaljer-tabell, som får samme tabell og samme verktøy.
> **Levert i tre deler.** Del 1: modell og beslutningsliste. Del 2 (TILLEGG 3): attesteringen og rapportens Detaljer
> deler tabell, og verktøyene følger sjekklistene. Del 3 (TILLEGG 4): Kenneths svar H1–H10. **H10 er snudd:** én linje
> er timeregistreringen med sin maskin og sine varer, ikke én rad pr. registrering. Der del 1 og 2 sa «egne rader», er
> teksten skrevet om.
>
> **Kenneths ord:** *«jeg finner det umulig å se hva som er feil i timeføringen -> gjeldende rader er ikke merket»* ·
> *«hvis en av prosjektradene skal faktureres med sine maskintimer -> hvordan finner jeg rett timerad. prosjektkortet
> som ble bygget er jo helt ødelagt i attesteringen. alle timerader er stokket om på. totalen er sannsynligvis rett ->
> men varer og maskintimer kan ikke faktureres med sin timerad»* · *«det er svært viktig at det førte prosjektkortet ->
> følger hele veien -> attestering -> fakturering -> timer skal deles opp. prosjektnummer henger heller ikke sammen med
> timeradene»*
>
> **Etter lørdagskortet på test (visningskravene):** *«ført under norm -> hvilken norm? dagsnorm, ukesnorm, månedsnorm?
> Dette er jo en gjettekonkuranse»* · *«vi skal ha en oversiktsrad med informasjon. i hver rad er det faste felter med
> informasjon. -> et excelark med en beskrivende topprad som er synlig hele tiden.»* · *«Timerader kommer under. vi må
> presentere lønnsart i en fast kolonne, fra til i en annen kolonne. Kolonner må kunne flyttes.»* · *«varelinjer hvor er
> de -> hva er 6m3 -> jeg kan ikke lese hvilken vare vi har brukt … send dette til kunden -> kunden nekter å betale meg»*
>
> **Total overhaling:** *«hvor er resten av prosjektkortet med tilhørende informasjon»* (om «Etter prosjekt») ·
> *«husk at mennesker lett må forstå hva de skal attestere. all informasjon som tilhører et prosjektkort må vises i en
> timerad -> ingen ting kan utelates.»* · *«den som attestesterer må selv kunne flytte kolonner, sortere i kolonner,
> filtrere i kolonner.»* · *«nå trenger vi å strukturere data slik at de er brukbare. alt i et prosjektkort skal vises
> i en enkelt rad etterhverandre»*
>
> **Rapportens Detaljer som mønster (del 2):** Kenneth viste «Detaljer» i timerapporten
> (`/dashbord/firma/timer/rapport`): *«se på denne rapporten -> attesteringen må bli noe lignende som dette tror jeg ->
> ellers kommer vi ikke i mål»* · *«her har vi et problem med kolonner -> kolonner har faste bredder og ikke dynamiske
> -> jeg får ikke anledning å utvide kolonner for å lese all informasjon»* · *«for attestering må filter og slikt være
> mer skjult slik at mesteparten av siden benyttes til selve attesteringen og timerader. prøv å finne en smart måte å
> lage filter/sortering/skjul/vis kolonner på.»* · *«se på løsning for sjekklister som et hint -> velg parameter,
> filtericon, sorter opp/ned og kolonner som kan justeres i bredde»*

### 12.1 Målt mot koden (develop @ 10d343ce)

Forkortelser: `D` = `apps/api/src/routes/timer/dagsseddel.ts`, `R` = `apps/api/src/routes/timer/rapport.ts`,
`W` = `apps/web/src`, `A` = `apps/web/src/components/attestering`.

**Server — leserne bak attesteringen**

| # | Funn | Referanse |
|---|---|---|
| HM1 | `hentTilAttesteringFirma` (firmalista og pivotene): sedlene sorteres på dato, så opprettet. Timer, tillegg og maskiner hentes **uten `orderBy`** — rekkefølgen på radene er udefinert. Radene kommer hele (med `kortId`, `sheetTimerId`, `fraTid`, `tilTid`) og får `project { id, name, projectNumber, internalProjectNumber }` pr. rad. Underprosjekt og byggeplass kommer bare som id. Utlegg kommer med fem felt. | `D:4754`, `:4829–4838`, `:4848–4857`, `:4859`, `:4988–5001` |
| HM2 | **Sedelens `prosjekt` er prosjektet på første timerad** som har prosjekt. En sedel med kort på tre prosjekter «tilhører» altså det første. | `D:4971` (firma), `D:5088–5092` (detalj: timer, ellers maskin, ellers tillegg) |
| HM3 | `hentForAttestering` (detaljsiden, web og mobil): timer, tillegg og maskiner sortert på `createdAt` — ikke fra-tid. **Utlegg er ikke med.** | `D:5052`, `:5067`, `:5071`, `:5075` |
| HM4 | `hentTilAttestering` (prosjektets attesteringsliste): timer og tillegg, **ikke maskiner**, ingen `orderBy` på rader, ingen prosjekt pr. rad. | `D:4669`, `:4689–4693`, `:4695` |
| HM5 | **Varer finnes ikke i attesteringen.** 0 treff på `vareforbruk`/`prismaVarelager` i `D` og `R`. Eneste leser en attestant kan bruke er prosjektets `vareforbruk.list`; `hentMineForDato` gir bare egne rader. Ingen skrivevei setter `Vareforbruk.attestertSnapshot` — feltet leses i `vareforbruk.ts` og skrives bare i tester. Vareattestering er vedtatt og utsatt, ikke forkastet. | `apps/api/src/routes/vareforbruk.ts:275`, `:323`, `:363`; `packages/db-varelager/prisma/schema.prisma:71`, `:94`; `docs/claude/fase-0-beslutninger.md:317`; `docs/claude/historikk-2026-05.md:3284` |
| HM6 | Attesteringens enhet er **raden**: `attesterRader`/`returnerRader` tar `timerIder`, `tilleggIder`, `maskinIder`. `attester`/`returner` er innpakning pr. sedel. Det finnes ingen enhet for kort eller bøtte, og en koblet maskin følger ikke timeraden — klienten må sende id-en. | `D:5407–5414`, `:5601`, `:6829`, `:7007`; 0 treff på `kortId`/`sheetTimerId` i `D:5407–5720` |
| HM7 | Ukeavviket («over norm» / «ført under norm») er et rent aggregat pr. (ansatt, uke): `UkeAvvik` bærer norm, ukesum og overtid — **ingen rad, sedel eller dato**. Det regnes på klienten. Serverens ukegrunnlag for detaljsiden henter ikke rad-id. | `packages/shared/src/utils/overtidsgrunnlag.ts:240`, `:258`, `:277`; `W/app/dashbord/firma/timer/attestering/page.tsx:300–311`; `A/AttesteringPivot.tsx:451`; `apps/mobile/app/timer/attestering/index.tsx:104`; `D:1582`, `:1619–1624` |

**Web — attesteringen**

| # | Funn | Referanse |
|---|---|---|
| HM8 | Sedler-visningen grupperer **sedler** på sedelens prosjekt (HM2). Prosjektnummeret (`internalProjectNumber`) står bare i gruppehodet. Gruppesummene (arbeidstimer, maskintimer) summerer **alle** radene på gruppens sedler, også rader på andre prosjekter. Prosjektfilteret bruker samme felt, så en sedel med kort på prosjekt B og første rad på A forsvinner når en filtrerer på B. | `W/app/dashbord/firma/timer/attestering/page.tsx:262`, `:360–390`, `:714–717` |
| HM9 | `SeddelKort` bøtter radene på **underprosjekt alene** — ikke prosjekt. Rader uten underprosjekt fra to prosjekter havner i samme bøtte. Kolonnene er lønnsart, aktivitet, fra–til og timer; **raden viser ikke prosjekt** (0 treff på prosjektnavn eller -nummer i fila). Underprosjekt-hode vises bare for ekte underprosjekt, og katalogen hentes bare for sedelens første prosjekt — underprosjekt på de andre prosjektene vises som «—». Byggeplass vises ikke. | `A/SeddelKort.tsx:264–271`, `:297–313`, `:601–612`, `:620–629` |
| HM10 | `SeddelKort`: timeradene står i den rekkefølgen serveren leverte (udefinert, HM1). **Alle bøttas maskinrader står etter alle bøttas timerader**, uten bruk av `sheetTimerId`. Tillegg står samlet nederst på sedelen. Utlegg vises bare i hover-kortet. | `A/SeddelKort.tsx:639`, `:704`, `:764` |
| HM11 | Hover-dagskortet nøster maskin under timeraden via `sheetTimerId` og samler ukoblede nederst. Det viser verken prosjekt eller fra–til (feltene strippes i `tilPivotRad`). | `A/DagsKort.tsx:76–84`, `:204–217`, `:230–271` |
| HM12 | «Per prosjekt»-pivoten grupperer sedler på sedelens prosjekt og summerer `totaltimer`. Hele dagen føres altså på første rads prosjekt. «Per ansatt»-pivoten bruker radens prosjekt. | `A/AttesteringPivot.tsx:234–250`, `:281`, `:580–593` |
| HM13 | Detaljsiden bøtter på (radens prosjekt, underprosjekt) med prosjektnavn og internnummer i seksjonshodet. I bøtta står alle timerader, så alle maskinrader som egen liste — ikke under sin timerad. Tillegg pr. prosjekt. Utlegg og varer vises ikke (HM3, HM5). | `W/components/timer/AttesteringDetalj.tsx:269–274`, `:502–571`; `A/attestering-buckets.tsx:631–640`, `:769`, `:781–800`, `:672–687` |
| HM14 | Varsler i `SeddelKort` står på sedelens hode: ukeavvik, norm (`9,00t / 7,50t`), tilleggskrav, forslag-pille, normtak-sperre. På raden står bare reise-merket og matpause-merket. Ukeavviket vises på **alle** ansattens sedler i uka. | `A/SeddelKort.tsx:415–419`, `:647–649`; `A/Avviksbadge.tsx:15–36`; `A/sedel-vurdering.ts:39–66`; `W/app/dashbord/firma/timer/attestering/page.tsx:757` |

**Rapport, eksport og PDF**

| # | Funn | Referanse |
|---|---|---|
| HM15 | `detaljEksport` er eneste radkilde for Excel-arket «Detaljer», PDF og rapportskjermen. Sedlene sorteres på dato og opprettet; radene har ingen `orderBy`. Prosjekt sendes som **navn alene**, selv om begge prosjektnumrene hentes. Maskin nøstes under timeraden via `sheetTimerId`. Ingen `kortId`, ingen varer. | `R:376`, `:397`, `:475`, `:504`, `:509–512`, `:605`, `:677` |
| HM16 | `byggDetaljRader`: én blokk = timerad + nøstede maskiner; sortert på dato, så kilderekkefølge. Tillegg, utlegg og ukoblede maskiner er egne blokker. `grupperDetaljRader` kan bare «ingen», «ansatt» og «prosjekt», og prosjektnøkkelen er **navnet** — to prosjekter med samme navn slås sammen. | `packages/shared/src/utils/timerDetaljRader.ts:200`, `:424`, `:769–790` |
| HM17 | Excel: prosjektnummer finnes bare i aggregatarket «Etter prosjekt», ikke på detaljradene. Rad-id finnes bare uten kolonnevalg og med intern mottaker. CSV er bare sammendrag pr. ansatt. | `W/lib/timer-rapport-eksport.ts:267–274`, `:281`, `:544–546`, `:606` |
| HM18 | **«Byggherredokumentet» er ikke et eget dokument.** Det er rapport-PDF-en med innebygd mal «Fakturagrunnlag»: PDF, ekstern mottaker, gruppert på prosjekt, kolonner uten ansatt, fra–til, underprosjekt og byggeplass. To kort samme dag på samme prosjekt skilles der bare av beskrivelse og aktivitet. | `W/app/dashbord/firma/timer/rapport/page.tsx:186–212`; `R:799`; `packages/pdf/src/timer-rapport.ts:336–420` |
| HM19 | Det finnes **ingen** PDF av én dagsseddel, ingen PDF-pakke og ingen arkiv-PDF for timer. Prosjektarkivet utelater timer bevisst (Kenneth-vedtak 2026-09-06). Rapport-PDF-en lagres ikke; en ny layout gjelder også gamle perioder neste gang noen eksporterer. | `apps/api/src/services/eksport/arkiv.ts:162–165`; 0 treff på dagsseddel i `packages/pdf/src` utenom `timer-rapport.ts` |
| HM20 | `firmaPeriodeRapport` gir bare aggregat pr. ansatt, prosjekt og dag — ingen rader. | `R:147`, `:296`, `:333–337` |

**Mobil**

| # | Funn | Referanse |
|---|---|---|
| HM21 | Attesteringslista er flat, ett kort pr. sedel, med sedelens prosjektnavn (HM2). Detaljen har tre seksjoner — timer, tillegg, maskiner — hver i `createdAt`-rekkefølge. Radene viser verken prosjekt, underprosjekt, fra–til eller beskrivelse. Maskin står ikke under timeraden. Varer og utlegg vises ikke. Ingen bruk av `kortId`. | `apps/mobile/app/timer/attestering/index.tsx:73`, `:146`; `apps/mobile/src/components/timer-attestering/AttesteringDetaljMobil.tsx:174`, `:295`, `:320`, `:339` |

**Visningskravene (målt mot `0783cf1d`)**

| # | Funn | Referanse |
|---|---|---|
| HM22 | **«(6.00 m3)» er ikke en vare.** Det er maskinradens egne felt `mengde` og `enhet` — et fritt tall med enhet (m, m2, m3, kg, tonn, stk) som føres i maskinskjemaets felt «Mengde». Feltet sier ikke **hva** som er målt. Attesteringen skriver det i parentes uten ledetekst. Varer vises ikke fordi attesteringen aldri leser dem (HM5). | `packages/db-timer/prisma/schema.prisma:600–601`; `apps/mobile/src/components/timer-detalj/MaskinSeksjon.tsx:831`, `:844`; `W/app/dashbord/timer/[id]/page.tsx:3622`; `A/SeddelKort.tsx:716–720` |
| HM23 | Maskinradens fra–til er valgfri i skjema og lagring, og attesteringen viser den bare når begge er satt. Koden skjuler ikke feltet. **Ikke målt:** om radene på lørdagskortet mangler tid i databasen — jeg har ikke lest test-databasen. | `packages/db-timer/prisma/schema.prisma:593`; `MaskinSeksjon.tsx:131–147`; `A/SeddelKort.tsx:711–715` |
| HM24 | Varselet «overtid ført under norm» gjelder **ukenormen**. Tallene (norm, ordinært, overtid) står bare i tooltip. «14.00t / 7.50t» i hodet er dagens timer mot **dagsnormen**, uten ledetekst. Det finnes to normer i koden — dag og uke. Månedsnorm finnes ikke (0 treff). | `packages/shared/src/i18n/nb.json:783–785`; `A/Avviksbadge.tsx:19–23`; `A/SeddelKort.tsx:412` |
| HM25 | **Flyttbare kolonner finnes fra før.** Sjekklister og oppgaver bruker `FlyttbareKolonner` (dra i tabellhodet, også tastatur) med rekkefølgen lagret **pr. bruker** på serveren i `User.tabelloppsett`, pr. liste. Timerapporten har sin egen: `KolonneVelger`, der rekkefølgen lagres i eksportmalen (`EksportOppsett.config.kolonner`) — firmamal eller personlig. Attesteringens tabell har fire faste kolonner, og hodet ruller ut av syne. | `W/components/FlyttbareKolonner.tsx`; `W/lib/kolonneRekkefolge.ts`; `W/hooks/useTabelloppsett.ts`; `packages/db/prisma/schema.prisma:19`; `W/components/ui/KolonneVelger.tsx`; `packages/db-timer/prisma/schema.prisma:688–703`; `A/SeddelKort.tsx:598–614` |

**Hele attesteringen (målt mot `f465d7d5`)**

| # | Funn | Referanse |
|---|---|---|
| HM26 | **En tabell med sortering, filter og flyttbare kolonner finnes fra før.** Den delte `Table` i `@sitedoc/ui` har sortering pr. kolonne, filter pr. kolonne (avkryssing blant alternativer, med snarveier), radvalg, bredde-dragning, `sticky` hode (se HM38) og krok for flyttbare kolonner. Den brukes av sjekklister, oppgaver, HMS, mapper og faggrupper. Den har **ikke** grupper, oversiktsrader eller sumrader. `apps/web` har ingen tabellpakke utover denne; `@tanstack/react-virtual` og `@dnd-kit` er alt installert. **Ingen ny pakke trengs.** | `packages/ui/src/table.tsx:3–13`, `:39–59`, `:237`, `:367`; `apps/web/package.json:16–18`, `:27`; `W/hooks/useTabelloppsett.ts:12` (felt for sortering — skrives ikke, HM38) |
| HM27 | Firma-attesteringen har tre visninger (Sedler · Etter prosjekt · Etter ansatt), to statusfaner (venter · attestert, den siste skrivebeskyttet), filtre for prosjekt, ansatt og avdeling, ukenavigasjon, og «utvid/kollaps alle». Penn og ✂ er usynlige til en holder musa over raden. | `W/app/dashbord/firma/timer/attestering/page.tsx:163`, `:171–173`, `:178`, `:229`, `:341–345`; `A/SeddelKort.tsx:680`, `:691`, `:735`, `:746` |
| HM28 | «Etter prosjekt» og «Etter ansatt» er ukepivoter: én linje pr. prosjekt eller ansatt og **bare en timesum pr. dag**. Cella åpner sedelen eller hover-kortet. «Attester alle» på linja attesterer hele sedler, én om gangen. Ingenting av kortets innhold vises i selve fanen. | `A/AttesteringPivot.tsx:169–201`, `:211`, `:281`, `:320–322`, `:370`, `:510–512`, `:595`; `page.tsx:411–414` |
| HM29 | Prosjektets attesteringsliste viser dato, ansatt, aktivitet, timesum og antall rader pr. sedel, med ✓, retur og lenke til detaljen. Radene ses først på detaljsiden. Lista får verken maskiner, utlegg, varer eller prosjekt pr. rad (HM4). | `W/app/dashbord/[prosjektId]/timer/attestering/page.tsx:50`, `:120–175` |
| HM30 | Firmalistas svar bærer alt raden trenger av timer (også pause, beskrivelse og lønnsartens navn), tillegg og maskin (også `mengde` og `enhet`). **Mangler:** varer, navn på underprosjekt og byggeplass (HM1, HM5). Navn på aktivitet, maskin og tillegg slås opp i klientens kataloger. `attesterRader` tar rader på tvers av sedler i ett kall, men avviser hele kallet hvis én rad ikke er ventende eller én dato er sperret. Kolonnenøklene bor i shared (`TIMER_KOL_KEYS`); overskrift og verdi er definert tre steder som holdes like for hånd — Excel, API-skjemaet og PDF. | `D:4829–4857`; `A/SeddelKort.tsx:244–262`; `D:5417–5470`; `packages/shared/src/utils/timerDetaljRader.ts:503`, `:652`; `W/lib/timer-rapport-eksport.ts:463`; `apps/api/src/routes/timer/eksportOppsett.ts:49–58`; `packages/pdf/src/timer-rapport.ts:336` |

**Rapportens Detaljer, sjekklistenes verktøy og maskinkoblingen (del 2, målt mot `a49821ca`)**

Flere forkortelser: `TD` = `W/components/timer/TimerRapportDetaljer.tsx`, `RP` =
`W/app/dashbord/firma/timer/rapport/page.tsx`, `TB` = `packages/ui/src/table.tsx`, `SJ` =
`W/app/dashbord/[prosjektId]/sjekklister/page.tsx`, `TR` = `packages/shared/src/utils/timerDetaljRader.ts`,
`M` = `apps/mobile/src`.

| # | Funn | Referanse |
|---|---|---|
| HM31 | **Rapportens Detaljer er ikke den delte `Table`.** Den er en egen tabell: CSS-grid med virtualiserte rader, bygd for tusenvis av rader. Den har gruppehode, delsum, totalsum, radtelling og fast hode i en ramme på 70 % av vindushøyden. Den har **ikke** sortering, filter, bredde-dragning, flytting i hodet, radvalg eller handlinger. | `TD:5`, `:146–151`, `:253–273`, `:298–372` |
| HM32 | **Hvorfor bredden er fast:** hver kolonne har én bredde i den delte `TIMER_KOL_BREDDE` — samme tall for skjerm, PDF og Excel. Dato, klokkeslett, tall, type, enhet og status står på et fast pikseltall. Tekstkolonnene deler det som er til overs. Det finnes ingen bredde pr. bruker og ikke noe håndtak. Alle celler unntatt Beskrivelse kuttes med «…»; hele teksten står bare i `title`. | `TR:605–637`; `TD:138–144`, `:324–327` |
| HM33 | Rapportens rad er **én rad pr. registrering, med ett unntak.** En maskin som leies ut pr. time og er koblet til en timerad, foldes inn på timeradens linje: Maskintimer i raden og maskinnavnet etter lønnsarten. Maskin pr. døgn, eller uten kjent enhet, står på egen linje under timeraden. Regelen er Kenneths (2026-09-01). Radtypene er timer, maskin, tillegg og utlegg — **vare finnes ikke**. | `TR:17`, `:255–312`; `docs/claude/maskin.md:263–275` |
| HM34 | Maskinraden i rapporten har aldri fra–til. `detaljEksport` sender ikke feltene for maskin, og radbyggeren setter dem tomme. Attesteringens lesere har dem (HM1). | `R:696–714`; `TR:20–37`, `:223–224` |
| HM35 | **«⚠ Maskin uten timerad» betyr bare at `sheetTimerId` mangler,** eller ikke peker på en timerad som er med i eksporten. Varselet er ment som «maskin brukt uten registrert arbeid». | `R:716–739`; `TR:321–323`; `packages/shared/src/i18n/nb.json:4958` |
| HM36 | **Koblingen skrives bare i mobilens prosjektkort-modus** — når maskinen føres fra en rad, og fra Bekreft dag. Disse skriver den **aldri**: web (`maskin.tilfoy`; 0 treff på `sheetTimerId` i `D:8916–9153` og i `W/app/dashbord/timer/[id]/page.tsx`), mobilens dagskort-modus (`MaskinSeksjon`), splitt på mobil og server, og attestantens nye maskinrad (0 treff i `D:5801–7070`). Flytt av en maskinrad alene løser koblingen. `syncBatch` bevarer det klienten sender. Varselet i HM35 slår altså ut på helt vanlig føring. **Ikke målt:** hvor lørdagsradene ble ført — test-databasen er ikke lest. | Skriver: `M/services/nyTimerRad.ts:261–278`; `M/services/kobledeMaskiner.ts:122–126`; `M/utils/dagsforslagAnvend.ts:445–449`. Skriver ikke: `D:8917`, `:8988–9001`; `M/components/timer-detalj/MaskinSeksjon.tsx:136–149` (brukt fra `ProsjektGruppe.tsx:387`); `M/components/timer-detalj/SplittRadModal.tsx:335–349`; `D:6289`, `:6565`, `:6799`. Løser: `M/components/timer-detalj/prosjektkort/kortRadFlytt.ts:108–122`. Synk: `D:7452`, `:8605–8610` |
| HM37 | **Sjekklistenes verktøy, del for del.** Alt over tabellen står på én linje. (1) «Velg parameter»: knapp som åpner `KolonneVelger` — søk, grupper, avkryssing, dra for rekkefølge, nullstill. (2) Filterikon i kolonnehodet: avkryssing blant verdier siden leverer. Aktive filtre står som brikker med × over tabellen, med teller «n av m». (3) Sortering: klikk i hodet, pil opp eller ned. (4) Bredde: håndtak i høyre kant av hodet, minst 40 px. (5) Flytting: grep-håndtak i hodet, også med tastatur. Kolonner, rekkefølge og bredder lagres pr. bruker i `User.tabelloppsett` under en fri liste-nøkkel. | (1) `SJ:817–837`; `W/components/ui/KolonneVelger.tsx:37–57`. (2) `TB:119–235`, `:398–405`; `SJ:674`, `:877–890`. (3) `TB:296–303`, `:393–397`. (4) `TB:263–294`, `:408–414`; `W/hooks/useTabelloppsett.ts:93–101`, `:133–136`. (5) `W/components/FlyttbareKolonner.tsx:50–75`; `useTabelloppsett.ts:114–118`. Lagring: `apps/api/src/routes/bruker.ts:5–13`, `:62–92` |
| HM38 | **Hull i `Table` for dette bruket.** (a) Sorteringen bor inne i komponenten og kan verken leses, nullstilles eller lagres. Lagringen har et felt for sortering, men ingenting skriver det. **Dette retter HM26 og R7 i del 1**, som sa at sorteringen lagres. (b) Alle rader tegnes — ingen virtualisering. (c) Filteret har bare avkryssing, og tekstene «Filtrer» og «Alle» er hardkodet norsk. (d) `sticky` på hodet står i en ramme uten høyde; hodet står bare fast når siden gir ramma en høyde. Ikke målt i nettleser. (e) Ingen grupper, oversiktsrader eller summer (HM26). (f) `packages/ui` har verken `@tanstack/react-virtual` eller `@dnd-kit`; de bor i `apps/web`. | (a) `TB:253–254`; `useTabelloppsett.ts:12`, `:49`, `:58`. (b) `TB:429`. (c) `TB:175`, `:190`. (d) `TB:365–367`. (f) `packages/ui/package.json`; `TB:55–56` |
| HM39 | **Attesteringens topp tar seks bånd** før første sedel: beskrivelse, statusfaner, visningsvelger, ukenavigasjon, tre nedtrekk og kollaps/utvid. Rapportens Detaljer har verktøyene på én linje: fire avkrysninger, Intern/Ekstern, gruppering og «Velg parameter». | `page.tsx:444`, `:449`, `:495`, `:519`, `:551–587`, `:624–638`; `RP:1109–1163`, `:1275–1296` |
| HM40 | Kolonnedefinisjonen har et **fjerde** sted i tillegg til de tre i HM30: rapportskjermen har egen `KOL_META` og egen `celle()`. Rapportens kolonnevalg og rekkefølge lagres i eksportmalen, ikke pr. bruker. | `TD:59–90`, `:153–220`; `RP:1155–1162`, `:1257–1272` |
| HM41 | **Eksportens tilbakemelding:** menyen lukkes straks og knappen viser en spinner. En feil vises som rød linje øverst på siden, over filterraden — ikke ved knappen. Når eksporten lykkes, sies ingenting; fila lastes bare ned. Feilen Kenneth så (PDF uten fil og uten melding) er ORDRE (34) og er ikke målt her. | `RP:540–544`, `:578`, `:634–642`, `:779–782`, `:939–943` |

**Linja, cellerettingen, eksportmalene og kortet som faktureringsenhet (del 3, målt mot `12d9ae8d`)**

Flere forkortelser: `PK` = `M/components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt.tsx`, `RM` =
`A/RedigerRadModal.tsx`, `EO` = `apps/api/src/routes/timer/eksportOppsett.ts`, `VF` =
`apps/api/src/routes/vareforbruk.ts`, `ST` = `packages/db-timer/prisma/schema.prisma`.

| # | Funn | Referanse |
|---|---|---|
| HM42 | **Mobilens prosjektkort viser timeraden som én linje** («07:00–15:00 · 7,5 t · lønnsart»). Rett under står **én tekstlinje pr. koblet maskin** («navn · timer») og så **én pr. koblet vare** («navn antall enhet»). Maskinens mengde, enhet og fra–til vises ikke der. Det er ingen grense for antall maskiner eller varer på en rad, verken i skjermen, i synken eller i skjemaet. | `PK:579–609`, `:617–646`; `M/utils/dagsoversiktRader.ts:55–65`; `D:7445–7468`; `ST:621` |
| HM43 | **Flere maskiner og flere varer på én timerad kan føres i dag.** Radvinduet har «+ Legg til» for maskin, og hver rad har «+ Vare». Hver maskin kan ha høyst radens timer. | `M/components/timer-detalj/TimerSeksjon.tsx:1365–1385`, `:2107–2186`; `M/services/kobledeMaskiner.ts:56–58`, `:111–137`; `PK:636–646` |
| HM44 | **Maskin og vare uten timerad** står i kortet sitt, etter kortets rader, under den grå overskriften «Uten rad». Det er ikke noe varsel. Koblingen regnes som brutt når `sheetTimerId` mangler, peker på en rad som ikke finnes, eller på en rad med annet prosjekt. | `dagsoversiktRader.ts:60–61`; `PK:697–704`; `packages/shared/src/i18n/nb.json:5585` |
| HM45 | **Fra Bekreft dag er koblingen en fordeling, ikke et valg.** Kortets varer legges på kortets første rad. Maskinene fyller første rad og renner over til neste. Hvilken rad en vare står på, sier derfor lite når kortet har flere rader og er ført fra Bekreft dag. | `M/utils/tilleggPaaKort.ts:100–116`; `M/utils/dagsforslagAnvend.ts:444–480` |
| HM46 | **Tillegg og utlegg bærer `kortId`, men ingen kobling til en timerad.** Vareforbruk bærer `dagsseddelId`, `sheetTimerId` og `kortId`. På telefonen står tillegg og utlegg som antall i kortets hode på dagsoversikten og som lister på kortskjermen. | `ST:435`, `:513`, `:587`, `:617`; `packages/db-varelager/prisma/schema.prisma:84`, `:88`, `:91`; `PK:558–573`; `apps/mobile/app/timer/[id]/kort/[projectId].tsx:553–575` |
| HM47 | **«Utstyr» er ikke en egen radtype.** Det er kategorien `smautstyr` i maskinregisteret, ved siden av `kjoretoy` og `anleggsmaskin`, og føres som en vanlig maskinrad. | `packages/db-maskin/prisma/schema.prisma:23`; `M/components/timer-detalj/MaskinSeksjon.tsx:67–76` |
| HM48 | **Rapporten har alt flere maskiner på én linje, men uten å skille dem:** foldes flere time-maskiner inn på en timerad, summeres timene, navnene står kommaskilt, og mengde og enhet blir tomme. | `TR:267–272`, `:307–310` |
| HM49 | **Attestantens rettevei i dag er `redigerSedelRader`.** Den krever firmaadministrator, at firmaet har «rediger ved attestering» på (`OrganizationSetting.tillattRedigerVedAttestering`, standard på), at sedelen er sendt, og den rører bare ventende rader. Vinduet bak pennen (`RedigerRadModal`) retter timerader og maskinrader i én bøtte: tid, lønnsart, aktivitet, timer, pause, maskin, og slett rad. **Maskinens mengde og enhet, og beskrivelsen, kan ikke rettes der.** Mengde og enhet kan rettes på detaljsiden (`RedigerMaskinRad`), som bruker samme prosedyre. | `D:5883–5898`, `:5945–5955`; `packages/db/prisma/schema.prisma:428`; `RM:157–158`, `:779–873`, `:972–1028`; `W/components/timer/RedigerMaskinRad.tsx:142–160`; `W/components/timer/AttesteringDetalj_Edit.tsx:218` |
| HM50 | 🔴 **Retteveien bytter ut hele sedelens ventende rader, og koblingen maskin → timerad går tapt.** Hver retting sletter **alle** sedelens ventende timer-, tilleggs- og maskinrader og lager dem på nytt med ny id. De nye maskinradene får ikke `sheetTimerId` (0 treff i `D:5801–6345`). Timeradene får ny id, så varenes `sheetTimerId` peker på en rad som ikke finnes. `kortId` arves. Etter én retting i attesteringen står altså sedelens maskiner og varer «Uten rad». **Ikke målt i databasen** — lest i koden. | `D:6238–6306` (maskin `:6290–6306`); `D:6268`, `:6284`, `:6303` |
| HM51 | **Historikken skrives, men ingen leser den.** `SheetRadHistorikk` får én post pr. utbyttet rad med hele raden slik den var — ikke pr. felt. Fordi retteveien bytter alle ventende rader (HM50), får også uendrede rader en post. Skrivere: `redigerSedelRader` og `splittRad`. Attester, returner, gjenåpne og eierens egne endringer skriver ingen post. Eneste leser (`lesRevisjoner`) har ingen kaller, og ingen skjerm viser «endret fra 5 til 6». | `ST:650–666`; `D:1782–1798`, `:6227–6237`; `apps/api/src/services/arkiv/logg-lesere.ts:160` (0 kallere) |
| HM52 | **Gjenåpning finnes bare for en hel, ferdig attestert sedel.** `gjenaapneAttestering` tar `sheetId`, krever at sedelen er godkjent, og setter alle radene tilbake til ventende. Den krever attesteringsrett på sedelens prosjekter og logger ingenting. Gjenåpning av én rad eller ett kort finnes ikke. Knappen står bare i attestert-fanen. | `D:5708–5786`; `A/SeddelKort.tsx:526–539` |
| HM53 | **En vare kan rettes av andre enn den som førte den.** På en sendt sedel kan firmaadministrator og prosjektadministrator endre antallet (`vareforbruk.oppdater`). Loggen får det **nye** antallet, ikke det gamle. Varen har ingen egen status; `attestertSnapshot` sperrer endring, men ingen kode setter den (HM5). | `VF:31–49`, `:565–620`, `:703–716` |
| HM54 | **Utlegg har ingen egen status og ingen rettevei for attestanten.** Utlegget følger sedelen: det er med i eksporten når hele sedelen er attestert. | `ST:487–530` (0 treff på `attestertStatus`); `R:50–58` |
| HM55 | **Eksportmalene har alt to nivåer, og de kan redigeres.** `EksportOppsett.eierId` tom = firmamal, satt = personlig. Lista gir firmaets maler og brukerens egne. En mal kan lagres som «min» eller som firmamal, få nytt navn og nytt innhold, og slettes. En firmamal kan endres av enhver firmaadministrator; en personlig bare av eieren. En mal kan ikke bytte nivå — den lagres som ny. De tre innebygde malene (Full eksport, Lønnsgrunnlag, Fakturagrunnlag) ligger i koden og kan bare brukes som utgangspunkt for en ny. **Firmanivået krever ingen migrering.** | `ST:688–704`; `EO:84–95`, `:102–141`, `:147–183`, `:190–219`; `RP:154–215`, `:688–764`, `:1793–1826`; `docs/claude/timer.md:1015–1017` |
| HM56 | **Malens innhold (config v4):** radtyper, format (xlsx eller pdf), mottaker, gruppering, orientering, topptekst, kolonner med rekkefølge, og «Ta med uattesterte». Den ligger som JSON; eldre maler leses med standardverdier, uten migrering. **Kolonnenøklene (30) holdes like for hånd tre steder.** Lista mangler prosjektnummer, pause, maskin og vare som egne kolonner, og kort. | `EO:61–74`; `RP:93–136`; nøklene: `TR:503–536`, `EO:52–59`, `R:823–838` |
| HM57 | **Hele rapport- og eksportflaten er for firmaadministrator.** Malene, rapporten og eksporten krever alle firmaadministrator. «Egne maler» er derfor hver firmaadministrators egne. En attestant som ikke er firmaadministrator, har ingen eksport. | `EO:28–31`; `R:380`; `docs/claude/timer.md:1017` |
| HM58 | **Rapporten og eksporten kan avgrenses på periode, prosjekt og ansatt — ikke på underprosjekt og ikke på kort.** | `R:37–46` |
| HM59 | **Prosjektnummer:** firmaets eget nummer er `Project.internalProjectNumber` (valgfritt). SD-nummeret er `Project.projectNumber` (alltid satt, unikt, `SD-ÅÅÅÅMMDD-XXXX`). Prosjektet har en bryter for om SD-nummeret skal vises (`visSiteDocNummer`). Attesteringen viser internnummeret i dag; rapportens detaljrad viser bare navnet. | `packages/db/prisma/schema.prisma:672`, `:678`, `:681–684`; `packages/shared/src/utils/index.ts:415–425`; `page.tsx:379`; `R:509–512` |
| HM60 | **Ingen kolonne står fast sidelengs i dag.** Rapportens tabell har en ramme som ruller begge veier, med hodet fast øverst. Den delte `Table` likeså. | `TD:258–263`; `TB:365–367` |

**Én gruppering finnes ikke.** Fem steder grupperer på hver sin måte: `SeddelKort` (underprosjekt), `attestering-buckets`
(prosjekt + underprosjekt), `DagsKort` (`sheetTimerId`), `timerDetaljRader` (blokk pr. timerad) og mobilens detalj
(radtype).

#### 12.1.1 Der ordrens premiss og koden skiller lag

- **«Bøtter pr. underprosjekt innenfor prosjektet»** stemmer ikke: bøtta er underprosjekt **på tvers av** prosjekter
  (HM9).
- **«Prosjektnummer henger ikke sammen med timeradene»** er målt som fire brudd: (1) sedelen legges under første rads
  prosjekt (HM2, HM8), (2) raden viser ikke prosjekt (HM9), (3) summer og pivot pr. prosjekt regner med rader fra andre
  prosjekter (HM8, HM12), (4) eksportens detaljrader har ikke prosjektnummer (HM15, HM17). «Totalen er sannsynligvis
  rett» stemmer for sedelen og uka; **summen pr. prosjekt er feil** når en dag har flere prosjekter.
- **«Varer i attesteringen»** er målt: de finnes ikke der, og heller ikke i rapport eller eksport (HM5, HM15).
- **«PDF-pakken» og «arkiv-PDF»** finnes ikke for timer (HM19). Paritetsmatrisen under gjelder derfor rapport-PDF-en.
- Maskin etter alle timerader (`SeddelKort.tsx:704`) er bekreftet. Detaljsiden og mobil har samme feil (HM13, HM21).
- **«Én rad per registrering, slik rapportens Detaljer viser det»** (TILLEGG 3) stemmer med ett unntak: time-maskinen
  som er koblet til en timerad, står på timeradens linje (HM33). De fire maskinradene på Kenneths bilde sto alene fordi
  de mangler koblingen. Unntaket ble lagt til Kenneth som H11, som er lukket i del 3: det følger av H10.
- **«Maskinradene har ikke `sheetTimerId` i data»** er ikke en datafeil. Web og dagskort-modus skriver aldri koblingen
  (HM36). «Maskin under sin timerad» kan derfor bare virke for rader ført i mobilens prosjektkort-modus.
- **«Gjenbruk sjekklistenes tabell»:** rapportens Detaljer og sjekklistene er to ulike tabeller (HM31). Verktøyene i
  hodet kan gjenbrukes; selve tabellen til sjekklistene mangler det attesteringen trenger mest (HM38). Se R1.
- **«Attestanten retter en celle og godkjenner linja»** (TILLEGG 4) kan ikke bygges på dagens rettevei. Den bytter ut
  alle sedelens ventende rader og bryter koblingen mellom maskin, vare og timerad (HM50). Linja ville falt fra
  hverandre ved første retting. Se R21.
- **«Bevar historikken»:** historikken skrives i dag, men ingen leser den og ingen skjerm viser den (HM51).
- **«Gjenåpning» på linja** finnes ikke på serveren. Gjenåpning gjelder bare en hel, ferdig attestert sedel (HM52).
- **«Firmanivået kan kreve migrering»:** nei. Firmamal og egen mal finnes alt (HM55).
- **«Utstyr»** er maskinrader med kategorien småutstyr, ikke noe eget (HM47).

### 12.2 Modell

**Én delt gruppering.** Ny ren funksjon `grupperPaaKort` i `packages/shared/src/utils/kortGruppering.ts`. Alle
leserne i § 12.1 skal bruke den — web-attestering, hover-kortet, detaljsiden, mobilens detalj og `byggDetaljRader`.
Ingen flate skal ha egen bøtting etterpå (T35).

| Regel | Innhold |
|---|---|
| G1 Gruppa | Rader på samme sedel med samme `kortId` er ett kort. **`kortId` bestemmer kortet; `sheetTimerId` bestemmer linja i kortet.** |
| G2 Hode (oversiktsraden, R4) | Prosjektnummer + prosjektnavn · underprosjekt (`proAdmId · kortNavn`) · byggeplass, lest fra kortets første arbeidsrad (K2–K4 gjør dem like). Fraværskort uten prosjekt får hodet «Fravær» (§ 11). Hodet har kortets sum for arbeid og maskin og kortets status (attestert n av m). |
| G3 Linjer | **Én linje er én timerad med maskinene og varene som er koblet til den** (H10, R3). Linjene sorteres på timeradens `fraTid`. Linjer uten fra-tid står etter dem, i opprettet-rekkefølge. Likt → opprettet, så id. |
| G4 På timeradens linje | Maskin og varer med `sheetTimerId` som peker på en timerad **i samme kort**, står **på timeradens linje** — ikke som egne rader. Er det flere maskiner eller flere varer, står de i den rekkefølgen de er ført (opprettet, så id); R3 sier hvordan de tegnes. Slik viser telefonens prosjektkort dem (HM42). |
| G5 Uten kobling | Maskin og varer i kortet uten gyldig kobling (ingen `sheetTimerId`, eller raden finnes ikke i kortet) er **egne linjer** etter kortets timelinjer, med Type «Maskin» eller «Vare», sortert på egen fra-tid; uten tid sist. De flyttes aldri inn på en timelinje av visningen — det ville vært å gjette. Slik viser telefonen dem under «Uten rad» (HM44). Dette er det vanlige for alt som er ført på web og i dagskort-modus (HM36). Kortet finner de via `kortId` (§ 2.4 regel 3). |
| G6 Tillegg og utlegg | Egne linjer i kortet de bærer `kortId` til, etter time-, maskin- og varelinjene. De har ingen kobling til en timerad (M5, HM46). |
| G7 Kortenes rekkefølge | Første linjes `fraTid`. Kort uten tid etter dem. Likt → eldste rad, så `kortId`. |
| G8 Reise | Reiserader har `kortId = NULL` (§ 2.2). De vises i egen blokk «Reise» på sedelen, sortert på `fraTid`, med reise-merket som i dag. |
| G9 Uten kort | Andre rader med `kortId = NULL` samles i «Uten kort» nederst på sedelen. Ingen rad skjules; antall rader inn = antall rader ut. |
| G10 Beskrivelse | Står på hver rad (R2). K5 — én tekst pr. kort — er ikke bygget (§ 8.1) og forutsettes ikke. |
| G11 Aldri synlig id | `kortId` brukes bare som nøkkel. Den skrives aldri ut i skjerm, PDF eller regneark (B1). |

**Visning — én flat tabell for hele attesteringen, den samme som rapportens Detaljer** (Kenneths visningskrav, «total
overhaling» og pekepinnen mot rapporten). Gjelder firma- og prosjektattesteringen og alle tre fanene.

| Regel | Innhold |
|---|---|
| R1 Én tabell, to steder | Attesteringen og rapportens Detaljer bruker **samme tabellkomponent**: rapportens virtualiserte tabell (HM31), løftet ut til `TimerRadTabell` (ny, `W/components/timer/`). Verktøyene i hodet er sjekklistenes (HM37) — sorterpil, filternedtrekk, bredde-håndtak og flytte-håndtak løftes ut av `table.tsx` og `FlyttbareKolonner.tsx` og brukes av begge tabellene, ikke kopiert (T51). `Table` oppfører seg som før; sjekklister, oppgaver, HMS, mapper og faggrupper ser like ut (T46). Ingen ny pakke. **Endret fra del 1,** som bygde attesteringen på `Table`: den mangler grupper, summer og virtualisering (HM38), og rapporten har alle tre. En uke i et firma med femti ansatte kan være over tusen rader (anslag, ikke målt). |
| R2 Linja bærer alt | **Standard kolonnerekkefølge** (H9): Dato · Ansatt · Ansattnr · Prosjektnr · Prosjekt · Byggeplass · Underprosjekt · Type · Betegnelse · Aktivitet · Fra · Til · Timer · Pause · **Maskin · Maskintimer** · Maskinmengde · Maskinenhet · **Vare · Vareenhet · Varemengde** · Antall · Beløp · Beskrivelse · Status · Avvik. Maskinen og maskinens timer står side om side. Varen, enheten og mengden står side om side. Brukeren kan flytte dem (H7); dette er utgangspunktet. **Prosjektnr** er firmaets interne prosjektnummer; mangler det, vises SD-nummeret (H6, E4). **Betegnelse** er lønnsarten på en timelinje, tilleggets navn og utleggets kategori. **Maskinmengde og Maskinenhet** er det rapporten i dag kaller Mengde og Enhet — tallet som er ført på maskinen (HM22). Nøklene er de samme, overskriften sier nå hva tallet hører til, fordi varen har sin egen mengde på samme linje. Antall og Beløp gjelder tillegg og utlegg. Rapportens øvrige kolonner (lønnsarttype, reisefeltene) og Avdeling kan slås på. Prosjekt, ansatt og dato gjentas på hver linje. **Ingenting ligger bak innrykk, tooltip, hover eller klikk.** |
| R3 Hva er én linje (H10 — ⚠️ SNUDD) | **Én linje er timeregistreringen slik prosjektkortet viser den: timeraden med sin maskin og sine varer på samme linje.** Maskinen står i kolonnene Maskin, Maskintimer, Maskinmengde og Maskinenhet, og varen i Vare, Vareenhet og Varemengde, på timeradens linje. Tegningen står under tabellen. **Flere maskiner eller varer på samme timerad** (HM43) står som **underlinjer** i samme linje: første maskin og første vare på linjas første tekstlinje, neste maskin og neste vare på tekstlinja under, bare i sine egne kolonner (H14). Linja er én enhet: én avkrysning, én ✓, én plass i sorteringen. **Egne linjer** er bare det som ikke hører til en timerad: maskin og vare uten kobling (G5), tillegg og utlegg (G6). Kolonnen Type sier hva linja er: Timer, Maskin, Vare, Tillegg eller Utlegg. Reise er en timelinje med reise-merket (G8); kolonnen Reise fra rapporten kan slås på. Det gjelder alle maskiner som er koblet til timeraden, også de som leies ut pr. døgn (se «Maskinen på timeradens linje» under). |
| R4 Kortet og oversiktsraden | I standardrekkefølgen står kortets rader etter hverandre (G1–G9) under én **oversiktsrad**: prosjektnummer + navn · underprosjekt · byggeplass · dato · ansatt · kortets timer og maskintimer · dagens timer mot dagsnorm med ledetekst («Dagen: 14,00 t av dagsnorm 7,50 t») · status · ✓ og retur. |
| R5 Fast hode | Kolonneoverskriften står fast øverst hele tiden. Tabellramma fyller resten av vinduet under verktøylinja og ruller selv, så hodet har noe å stå fast i (HM38 d). |
| R6 Flytte, bredde, av og på | Som i sjekklistene (HM37): «Velg parameter» slår kolonner av og på og gir rekkefølgen, kolonnene dras i hodet, og bredden dras i høyre kant av hodet. Standardbredden er `TIMER_KOL_BREDDE` (HM32); dratt bredde vinner. Lagres pr. bruker i `tabelloppsett` under liste-nøkkelen `timer-attestering` (H7). Ingen ny lagring, ingen migrering. En celle som er kuttet, leses ved å dra kolonnen bredere; Beskrivelse brytes over flere linjer som i rapporten. |
| R7 Sortere | Klikk i hodet: stigende, så synkende, så tilbake til kortrekkefølgen. Pila i hodet viser retningen. Sortert tabell er en flat liste uten oversiktsrader; hver rad er fortsatt fullstendig (R2). **Sortering og filter gjelder besøket og huskes ikke** — et glemt filter skjuler rader som venter på attestering. Endret fra del 1; lagringen skriver heller ikke sortering i dag (HM38 a). |
| R8 Filtrere | **Filterikonet står i kolonnehodet.** Det åpner avkryssing blant verdiene som finnes i utvalget; Beskrivelse har tekstsøk i samme nedtrekk. Det finnes ingen egen filterrad. Kortene består under filter; kort uten treff vises ikke. Dagens nedtrekk for prosjekt, ansatt og avdeling og «krever vurdering» blir slike filtre. Prosjektfilteret treffer radens prosjekt (retter HM8). |
| R9 Bare oversiktsrader | Én bryter viser bare oversiktsradene — dagens «kollaps alle». Standard er alle rader synlige. |
| R10 Handlinger | **Linje:** avkrysning, ✓ og retur gjelder **hele linja** — timeraden og maskinene på den (H10). Klienten sender timeradens id og maskinradenes id-er i samme kall. Varene på linja har ingen egen status og følger linja (se «Varer» under). En egen maskinlinje og en tilleggslinje attesteres for seg. En egen varelinje og en utleggslinje har ingen ✓; de følger kortet. **Kort:** ✓ og retur i oversiktsraden tar alle kortets ventende linjer (H1). **Dag:** «Attester dagen» i oversiktsraden — hele sedelen, som ✓ på sedelen i dag. **Utvalg:** «Attester utvalget (n)» tar alle ventende linjer som vises etter filter; den erstatter «Attester gruppe» og «Attester alle». **Gjenåpne** står på attesterte linjer og kort (R23). ✂ og penn står synlig, ikke bak hover (HM27). Knappene står fast når tabellen rulles (R22). |
| R11 Sperrer | Brudd på fraværstaket (B10, F9) og uavklart forslag (V19) sperrer datoen som i dag. Radene viser grunnen i Avvik, ✓ er av, og utvalget hopper over dem og sier hvor mange som ble stående. Klienten sender aldri sperrede rader — serveren avviser hele kallet (HM30). F1 og `radIKontekst` avgjør hva en prosjektleder kan velge. Serveren er siste vakt og endres ikke. |
| R12 Fanene (H4) | «Sedler», «Etter prosjekt» og «Etter ansatt» er **samme tabell med tre grupperinger**: dag (ansatt + dato), prosjekt og ansatt. Alle viser hele raden. Tallene pivotene viser i dag — timer pr. dag, ukesum, ukenorm, avvik — blir en **ukeoversikt** som åpnes med én knapp over tabellen (R18). Klikk på en celle filtrerer tabellen til den dagen. Statusfanene venter og attestert består; attestert er skrivebeskyttet. |
| R13 Prosjektattesteringen | Samme tabell, låst til prosjektet, uten mellomlista (HM29). Rader på andre prosjekter vises nedtonet og kan ikke velges, som på detaljsiden i dag. |
| R14 Detaljsiden | Består for det tabellen ikke bærer: forslaget attestanten leser (V19), flytt underprosjekt, vedlegg på utlegg, rediger sedel. Radene der tegnes med samme tabell. |
| R15 Mobil | Attestering i volum hører på web. Telefonen viser kortene med de samme feltene: timeraden, og under den maskinene og varene som hører til den, slik prosjektkortet gjør (HM42). Ingen flytting, sortering, filter eller retting i cellen. Attester og returner som i dag. |
| R16 Én radbygger, én kolonneliste | Radene lages av én ren funksjon i `packages/shared` (`byggKortRader`, oppå `grupperPaaKort`). Kolonnene — nøkkel, overskrift, verdi og hvilke radtyper de gjelder — defineres ett sted, ved `TIMER_KOL_KEYS`. Attestering, rapportskjerm, Excel og PDF bruker begge. De fire listene i HM30 og HM40 og de tre håndholdte nøkkellistene i HM56 blir én. Radtypen `vare` legges til. **Radbyggeren gir linjer:** hver timelinje bærer `maskiner[]` og `varer[]`, i ført rekkefølge. Hvordan flere tegnes (H14), er visningens sak og låser ikke radbyggeren. Nye kolonnenøkler: prosjektnummer, pause, maskin, vare, vareenhet, varemengde, kort og avvik. |
| R17 Én verktøylinje | Alt over tabellen står på **én linje** (to på smal skjerm): uke med ◀ ▶ · gruppering (Sedler · Etter prosjekt · Etter ansatt, H4) · Venter / Attestert · «Velg parameter» · «Bare oversiktsrader» · «Ukeoversikt» · brikker for aktive filtre og sortering, hver med × · teller «n av m rader» · «Attester utvalget (n)» til høyre. De seks båndene i HM39 blir denne linja. Beskrivelsen øverst på siden flyttes til ?-hjelpen. Mesteparten av siden er rader. |
| R18 Ukeoversikten er lukket | Ukeoversikten (R12) åpnes og lukkes med knappen i verktøylinja og er lukket når siden åpnes. Avvikene den viser, står uansett i kolonnen Avvik og i oversiktsraden. |
| R19 Rapportens Detaljer får verktøyene | Fordi tabellen er delt (R1), får rapporten **bredde som kan dras** og **flytting i hodet** i samme ordre som attesteringen. Bredden lagres pr. bruker (liste-nøkkel `timer-rapport-detaljer`). Flytting i hodet skriver samme kolonnevalg som «Velg parameter» gjør i dag — eksportmalen (HM40). PDF og Excel bruker standardbreddene som før. **Sortering og kolonnefilter slås ikke på i rapporten:** «Eksporter» skal skrive ut det skjermen viser (`RP:1104–1106`), og eksporten kjenner verken sortering eller filter. De kan komme med «Eksporter det jeg ser» (H8 C). |
| R20 Tekster i verktøyene | Alle tekster i hodets verktøy går via `t()`. «Filtrer» og «Alle» er hardkodet i dag (HM38 c) og får nøkler når delene løftes ut. Den norske teksten sjekklistene viser, endres ikke. |
| R21 Rette i cellen (H10) | Attestanten klikker i en celle, skriver ny verdi og lagrer med Enter eller Tab; Esc angrer. **Hver retting lagres med en gang**, for seg — ikke sammen med ✓. Etterpå godkjennes linja med ✓. **Celler som kan rettes:** på timeraden Betegnelse (lønnsart), Aktivitet, Fra, Til, Timer og Pause; på maskinen Maskin, Maskintimer, Maskinmengde og Maskinenhet; på varen Varemengde; på tillegg Antall. Prosjekt, underprosjekt og byggeplass rettes ikke i cellen — de er kortets (K2–K4) og flyttes med «Flytt underprosjekt». Beskrivelse og utlegg har ingen rettevei for attestanten i dag (HM49, HM54) og får ingen her. **Hvem og når — som i dag** (HM49, HM53): firmaadministrator, når firmaet har «rediger ved attestering» på, på en sendt sedel og en ventende linje. For andre er cellene bare lesbare. En attestert linje må gjenåpnes før den kan rettes (R23). **Lagring:** se «Retting i cellen — lagring og logg» under. |
| R22 Knappene står fast (H2) | Kolonnen med ✓, retur, gjenåpne, ✂ og penn **står fast ved tabellens høyre kant**, rett til venstre for det loddrette rullefeltet. Den ruller ikke med når linja rulles sidelengs. Avkrysningen står fast til venstre. Hodet står fast øverst (R5). Det vannrette rullefeltet står alltid synlig nederst i tabellramma og ruller bare kolonnene mellom avkrysningen og knappene. I dag står ingen kolonne fast (HM60). Skissen står under tabellen og er lagt til Kenneth som ja eller nei (§ 12.8.2). |
| R23 Gjenåpne linje og kort (H1, H2) | En attestert linje har **gjenåpne** der ✓ sto. Oversiktsraden har gjenåpne for kortets attesterte linjer. Gjenåpning setter linjene tilbake til ventende; var sedelen ferdig attestert, går den tilbake til sendt. Gjenåpning av hele sedelen består (HM52). Den som kan attestere linja, kan gjenåpne den — samme krav som i dag. Serveren har bare gjenåpning av hel sedel; d2a legger til gjenåpning av rader (`gjenaapneRader`, samme inndata som `attesterRader`). Gjenåpningen logges med hvem og når. I dag logges den ikke. |

**Linja, tegnet med standard kolonnerekkefølge.** Kolonnene Ansattnr, Byggeplass, Pause, Antall, Beløp, Status og Avvik er
tatt ut av tegningen for å få plass. Tallene er eksempler.

```
Dato   Ansatt  Prosjektnr  Prosjekt  Underprosjekt  Type    Betegnelse     Aktivitet  Fra    Til    Timer │ Maskin         Maskintimer  Maskinmengde  Maskinenhet │ Vare        Vareenhet  Varemengde │ Beskrivelse
─────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┼───────────────────────────────────┼─────────────
▸ 1042 Storgata · 12 Grøft · Felt B · lø 07.11 · Ola N. · 7,50 t · maskin 7,50 t · Dagen: 14,00 t av dagsnorm 7,50 t          (oversiktsrad for kortet)
07.11  Ola N.  1042        Storgata  12 · Grøft     Timer   Timelønn       Graving    07:00  12:00   5,00 │ Volvo EC220E         3,00          6,00  m3          │ Pukk 8–16   tonn            12,00 │ Grøft felt B
                                                                                                          │ Hoppetusse           2,00                            │ Fiberduk    m2              20,00 │
07.11  Ola N.  1042        Storgata  12 · Grøft     Timer   Overtid 50 %   Graving    12:30  15:00   2,50 │                                                     │                                   │ Tilbakefylling
07.11  Ola N.  1042        Storgata  12 · Grøft     Maskin                                                │ Aggregat 6 kVA       2,50                            │                                   │
07.11  Ola N.  1042        Storgata  12 · Grøft     Tillegg Smusstillegg                                  │                                                     │                                   │
```

- **Linje 1** er én timerad med to maskiner og to varer. Den andre maskinen og den andre varen står på tekstlinja under,
  i sine egne kolonner. Hele blokka er én linje: én ✓ godkjenner timene og begge maskinene.
- **Linje 2** er en timerad uten maskin og vare.
- **Linje 3** er en maskin uten timerad (G5): egen linje, Type «Maskin», tidskolonnene tomme. Har maskinen egen
  fra–til, står den i Fra og Til.
- **Linje 4** er et tillegg (G6), med antallet i kolonnen Antall.

**Flere maskiner eller varer på én timerad — tre måter, én anbefalt (H14).**

| | Slik blir det | For | Mot |
|---|---|---|---|
| **A — underlinjer (anbefalt)** | Som tegningen: én tekstlinje pr. maskin og pr. vare inne i linja. | Hver maskin og hver vare har egne celler, så «maskinmengde 5 → 6» kan rettes på riktig maskin. Slik viser telefonens prosjektkort dem (HM42). | Linja blir høyere når det er flere. |
| B — alt i én celle | «Volvo EC220E, Hoppetusse» i Maskin og summen 5,00 i Maskintimer. Slik folder rapporten i dag (HM48). | Alle linjer like høye. | Timene pr. maskin forsvinner, mengden blir tom, og cellen kan ikke rettes. |
| C — egne kolonner | Maskin 1 · Maskin 2 · Vare 1 · Vare 2 … | Alt på én tekstlinje. | Tabellen blir bredere for alle linjer, og de fleste cellene står tomme. Antallet har ingen grense (HM42). |

- **I Excel** blir hver underlinje en egen regnearkrad. Dato, ansatt, prosjekt, underprosjekt, byggeplass og kort
  gjentas, så filter og pivot virker. Timer, Pause, Fra og Til står bare på første rad, så summen av timer er riktig.
- **I PDF** tegnes linja som på skjermen.
- **Sortering og filter:** linja flyttes som én enhet og sorteres på første underlinje. Et filter treffer linja når én
  av underlinjene treffer.

**Faste knapper — skisse til Kenneth (H2, R22).** Kenneths ord: *«godkjenning og gjenåpning til venstre for vertikal
scroll og til høyre for horisontal scroll»*. Lest slik: knappene står helt til høyre, rett til venstre for det
loddrette rullefeltet, og til høyre for alt som ruller sidelengs.

```
        står fast │◀──────────────── ruller sidelengs ─────────────────▶│ står fast  │ loddrett
                  │                                                      │            │ rullefelt
┌───┬─────────────────────────────────────────────────────────────────┬────────────┬─┐
│ ☐ │ Dato   Ansatt   Prosjektnr   Prosjekt   …   Maskin   Maskintimer  │            │▲│ ← hodet står fast øverst
├───┼─────────────────────────────────────────────────────────────────┼────────────┤█│
│ ☐ │ ▸ 1042 Storgata · 12 Grøft · Felt B · lø 07.11 · Ola N. · 7,50 t  │ ✓  ↩       │█│ ← oversiktsrad: hele kortet
│ ☐ │ 07.11  Ola N.   1042   Storgata   …   Volvo EC220E   3,00   …     │ ✓  ↩  ✂  ✎ │ │ ← ventende linje
│ ☐ │ 07.11  Ola N.   1042   Storgata   …                               │ ✓  ↩  ✂  ✎ │ │
│   │ 06.11  Kari L.  1042   Storgata   …   Dumper A25     4,00   …     │ ↺ gjenåpne │ │ ← attestert linje
│   │                                                                   │            │▼│
├───┴─────────────────────────────────────────────────────────────────┴────────────┴─┤
│   ◀ ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░ ▶    vannrett rullefelt, alltid synlig         │
└────────────────────────────────────────────────────────────────────────────────────┘
  ✓ godkjenn   ↩ returner   ✂ del opp   ✎ rediger i vindu   ↺ gjenåpne
```

- Rulles tabellen ned, står hodet. Rulles den sidelengs, står avkrysningen til venstre og knappene til høyre.
- Den andre lesningen av ordene er at knappene står fast til **venstre**, ved avkrysningen, foran første kolonne.
  Den er ikke tegnet. Sier Kenneth nei til skissen, bygges den i stedet; ingenting annet i § 12 endres.

**Retting i cellen — lagring og logg (R21).**

- **Ny, smal prosedyre** (`rettRadFelt`, d2a): én rad og de feltene som er endret. Raden **oppdateres der den står** —
  samme id, samme `kortId`, samme `sheetTimerId`. Linja holder sammen etter rettingen.
- **Samme krav og samme kontroller som `redigerSedelRader` i dag** (HM49), for den ene raden: firmaadministrator,
  firmavalget på, sendt sedel, ventende rad, fra–til uten overlapp, satstak, pause, fraværstak og maskin ≤ arbeid.
  Feiler en kontroll, står den gamle verdien og cellen viser grunnen.
- **Historikk:** én post i `SheetRadHistorikk` med raden slik den var **før** rettingen, hvem som rettet og når. Bare
  den rettede raden får post. Tabellen brukes som den er; ingen migrering.
- **Varen:** antallet rettes med `vareforbruk.oppdater`, som finnes (HM53). Loggen får også antallet **før** rettingen.
  En vare på en attestert linje kan ikke rettes; serveren avviser det (i dag ser den bare på sedelens status).
- **Synlig i tabellen:** en rettet celle viser den nye verdien og under den hva som sto før: «var 5,00». Avvik-kolonnen
  sier «Rettet av ‹navn› ‹dato›». Leserne i d2a gir derfor hver rad lista over rettede felter, regnet ut ved å
  sammenligne raden med siste historikkpost. Uendrede rader som fikk post av dagens rettevei (HM51), gir tom liste.
- **Vinduet bak pennen består** (`RedigerRadModal`, `redigerSedelRader`), for det cellen ikke kan: slette en rad og
  rette pausevinduet for sedelen. 🔴 **Det må slutte å bryte linja** (HM50): etter en retting der skal maskinene ha
  `sheetTimerId` til den nye timeraden, og varene som pekte på den gamle, peke på den nye (T58). Rettes i d2a.
- **Den ansatte** ser den rettede verdien etter neste synk, som i dag. Ingen skjerm viser historikken til den ansatte
  (HM51); det er ikke med her.

**Serveren** leverer det grupperingen trenger, i de tre leserne i HM1, HM3 og HM4:

- Radene sorteres på server (`fraTid`, `createdAt`) så svaret er stabilt; `grupperPaaKort` sorterer uansett.
- Underprosjekt (`proAdmId`, `kortNavn`) og byggeplass (navn) slås opp for **alle** sedelens prosjekter. `detaljEksport`
  gjør dette oppslaget i dag (`R:579–605`); det flyttes til én tjenestefunksjon (`apps/api/src/services/timer/kortLeser.ts`)
  og kopieres ikke.
- `varer[]` pr. sedel: vareforbruk med `dagsseddelId` lik sedelen — varenavn, antall, enhet, `sheetTimerId`, `kortId`.
  Bare sedler brukeren alt har rett til å se; er varelager-modulen av, er lista tom.
- `hentForAttestering` får utlegg (samme fem felt som firmalista) og `hentTilAttestering` får maskiner, så alle tre
  flatene viser samme kort.
- Hver rad får lista over rettede felter (R21): felt, verdien før, hvem og når.
- Nye prosedyrer i d2a: `rettRadFelt` (R21) og `gjenaapneRader` (R23). `redigerSedelRader` beholder koblingen
  maskin → timerad og flytter varenes kobling til den nye timeraden (HM50).
- Ingen prosedyre får nytt navn. Feltene legges til; eldre klienter ser dem ikke.

**Summer pr. prosjekt** regnes på radens prosjekt i alle grupperinger og i ukeoversikten. En dag med kort på to
prosjekter teller på begge, med hver sine timer. Dette retter HM8 og HM12.

**Attestering pr. kort** (H1): oversiktsraden får ✓ og retur. De kaller `attesterRader`/`returnerRader` med kortets
ventende timer-, maskin- og tilleggsrader. Attestering pr. linje og pr. sedel består. Retur krever kommentar som i dag;
kommentaren lagres på sedelen, ikke på linja (`D:5609`, `:5660–5694`).

**Varer** (H2): står **på timeradens linje** (R3), også i eksporten. De har ingen egen attestering (HM5).

- En vare på en timelinje følger linja: den er med i eksporten når timeraden er attestert.
- En vare uten timerad og et utlegg følger **kortet**: de er med når ingen linje i kortet venter.
- ⚠️ **ENDRES for utlegg.** I dag følger utlegget hele sedelen (HM54, ordre (31)). Hjemmel: H1 og H5 — et kort skal
  kunne attesteres og faktureres for seg, med alt som ble brukt i jobben. Utlegg og varer uten kort følger sedelen som
  i dag. «Ta med uattesterte» tar alt med, som i dag.
- Prisen på varen låses ikke ved attestering. Det er vedtatt fra før og ikke bygget (HM5), og er ikke med her. Varen
  står derfor med mengde og enhet, uten beløp.

**Maskin uten kobling til timerad** (HM35, HM36). Dette er det vanlige i dag, ikke unntaket: alt som føres på web og i
dagskort-modus, mangler koblingen.

- **Plass:** maskinen er egen linje i kortet sitt, etter kortets timelinjer (G5), slik telefonen viser den under
  «Uten rad» (HM44). Kortet er det som bærer fakturaen; maskinens egen fra–til viser hvilken del av dagen den gjelder.
- **Varsel** (H12): «⚠ Maskin uten timerad» vises bare når kortet ikke har noen arbeidsrad. Da er maskinen faktisk
  ført uten registrert arbeid. I dag står varselet på hver maskinrad uten kobling.
- **Skriveveiene** (H13): web og dagskort-modus kan skrive koblingen fremover. Det er en egen ordre (d2c) og ikke en
  forutsetning for tabellen. Uten den står maskiner ført på PC som egne linjer, ikke på timeradens linje.

**Maskinen på timeradens linje** (H10; H11 er lukket). Alle maskiner som er koblet til en timerad, står på timeradens
linje, og linja attesteres og returneres samlet — klienten sender alle rad-id-ene.

- **H11 følger av H10 og H2** og er ikke lenger et eget valg: attesteringen, rapporten og eksporten bruker samme linje
  (R16, E8). Alternativene B og C i H11 strider begge mot H10.
- ⚠️ **ENDRES for maskiner som leies ut pr. døgn.** Rapporten setter dem i dag på egen linje under timeraden, også når
  de er koblet (`TR:264–266`, `:312`; regelen fra 2026-09-01, `docs/claude/maskin.md:263–275`). Etter H10 står en
  koblet døgn-maskin på timeradens linje, slik prosjektkortet viser den (`PK:634` skiller ikke på enhet). En døgn-maskin
  uten kobling er egen linje uten varsel, som regelen fra september sier.
- **Flere time-maskiner på én timerad** vises hver for seg (H14 A). Rapporten slår dem i dag sammen til én celle (HM48).
- Uten kobling er maskinen alltid egen linje.

**Avvik pekes ut**

| Avvik | I dag | Etter |
|---|---|---|
| Ukeavvik «ført under norm» | Merke på alle sedler i uka; normen er ikke navngitt, tallene står i tooltip (HM14, HM24) | Teksten navngir normen og viser tallene: «Uke 46: 3,0 t er ført som overtid, men uka er under ukenormen (32,0 t av 37,5 t)». **Alle rader med overtidsart i uka merkes**, i kolonnen Avvik. Oversiktsraden viser varselet bare når kortet har en merket rad. |
| Ukeavvik «over norm» | Som over | «Uke 46: 2,0 t over ukenormen (39,5 t av 37,5 t) er ikke ført som overtid». Merket står på de ordinære arbeidsradene som ligger etter at ukenormen er passert, i tidsrekkefølge. |
| Maskin over arbeid | Sedel | Oversiktsraden, pr. kort (B4), og Avvik på maskinraden. Serverens tak er uendret. |
| Brudd på fraværstak (B10) | Linje pr. dato | Linja står; fraværsradene med tak på datoen merkes. |
| Dagens timer mot norm (`14.00t / 7.50t`) | Sedelens hode, uten ledetekst | Oversiktsraden, med ledetekst «dagsnorm» (R4). |
| Tilleggskrav | Sedelens hode | Uendret — gjelder dagen. |
| Reise, matpause | Raden | Uendret. |

Radene finnes av én ny ren funksjon `ukeAvvikRader` i `overtidsgrunnlag.ts`, ved siden av `beregnUkeAvvik`. Firmalista
har ukas rader og regner selv. Detaljsiden har bare én sedel; serverens ukegrunnlag (`D:1619–1624`) henter derfor rad-id
og returnerer hvilke rader på sedelen som er merket. Regnestykket for selve avviket endres ikke. Det finnes to normer — dagsnorm og ukenorm (HM24). Hvert varsel sier
hvilken det gjelder, i synlig tekst.

### 12.3 Eksport og fakturering — kortet er faktureringsenheten

Kenneth (H5): *«betyr at et prosjektkort kan faktureres for seg selv uten at hele dagskortet er med. Typisk eksempel er
et registrert underprosjekt. Med timer, varer, tillegg, maskiner og utstyr som ble brukt i jobben»*. Og (H3):
*«dynamiske eksportmaler iht timekortets kolonner … Noen firma-eksportmaler og noen den enkelte kan lage selv.»*

Kortet har ingen synlig id. Det som skiller to kort på samme prosjekt i en eksport, er **dato + kortnummer**, og i
oversiktsraden klokkeslett og beskrivelse.

| Del | Regel |
|---|---|
| E1 Rekkefølge (alltid) | Linjene sorteres så et kort står samlet: dato → ansatt → kort (G7) → linje (G3), med maskin og varer **på** sin timerad (R3) og egne maskin- og varelinjer, tillegg og utlegg sist i kortet. Gjelder Excel «Detaljer», PDF og rapportskjermen. |
| E2 Kolonnen «Kort» | En vanlig kolonne i kolonnelista, **valgt i malen** (H3) og av som standard. Løpenummer pr. dato innenfor eksportens gruppe: 1, 2, 3 … Tom for reise og linjer uten kort. Dato + nummer (+ gruppe) er entydig i dokumentet, også når ansatt ikke vises. |
| E3 «Oversiktsrad og delsum pr. prosjektkort» | **Et valg i malen** (H3), standard av. Hvert kort får samme oversiktsrad som attesteringen (R4) — prosjektnummer og -navn · underprosjekt · byggeplass · dato · fra–til · «Kort n» — og en delsum for timer og maskintimer. Ansatt følger regelen for ekstern mottaker som i dag. |
| E4 Prosjektnummer (H6) | **Én kolonne «Prosjektnr»:** firmaets interne nummer (`Project.internalProjectNumber`). Mangler det, vises SD-nummeret (`Project.projectNumber`). Har prosjektet slått av visning av SD-nummer (`visSiteDocNummer`, HM59), står cella da tom. Samme regel i oversiktsraden, i gruppeoverskriften og i attesteringen, fra én delt funksjon i `packages/shared`. Aggregatarket «Etter prosjekt» har begge numrene som i dag. Gruppering på prosjekt bruker prosjektets **id** som nøkkel og viser nummer + navn i overskriften. |
| E5 Varer (H2) | Varen står **på timeradens linje**, i kolonnene Vare · Vareenhet · Varemengde. En vare uten timerad er egen linje med Type «Vare» (G5). Radtypen «vare» slår dem av og på, og rapportskjermen får en femte avkrysning. Ingen beløp — prisen låses ikke ved attestering (§ 12.2 «Varer»). |
| E6 Dynamiske maler (H3) | **Malens kolonner er attesteringstabellens kolonner** — samme liste, samme ord (R16). Brukeren velger hvilke som er med og rekkefølgen, med «Velg parameter» som i dag. **To nivåer:** firmamaler og egne maler. Begge finnes (HM55), og en mal kan lages, få nytt navn, endres, lagres som ny og slettes som i dag. **Nytt i malen (config v5):** de nye kolonnene (R16), radtypen vare, og valget i E3. Malen ligger som JSON; en eldre mal leses som før, uten de nye kolonnene og med valget av. **Ingen migrering.** **De innebygde:** «Fakturagrunnlag» får Prosjektnr, maskin- og varekolonnene, oversiktsrad og delsum pr. kort. «Lønnsgrunnlag» får ny rekkefølge (E1). «Full eksport» får alle kolonnene. De innebygde endres fortsatt bare ved å lagre som ny mal. **Hvem:** firmaadministrator, som i dag (HM57). Om et klikk på en mal også skal eksportere, er spørsmålet i ORDRE (34) og avgjøres ikke her. |
| E7 Urørt | CSV (sammendrag), arkene «Sammendrag», «Etter prosjekt» og «Etter dag», `firmaPeriodeRapport`, regelen «bare attesterte» fra (31) for timer, maskin og tillegg, og kladd-visningen fra (32). Utlegg følger kortet i stedet for sedelen (§ 12.2 «Varer»). |
| E8 Samme struktur til kunden | Fakturagrunnlaget bygges av samme radbygger og samme kolonneliste som attesteringen (R16): samme kort, samme linjer, samme ord. Det attestanten godkjente, er det kunden får — uten ansatt og status når mottakeren er ekstern. Hvilke kolonner som er med og i hvilken rekkefølge, er malens og ikke skjermens (H8). |
| E9 Eksporten svarer alltid | Hver eksport ender i ett av to synlige svar **ved eksportknappen**: «Lastet ned: ‹filnavn›» eller en feilmelding som sier hva som gikk galt. Mens den går, viser knappen det. Et tomt utvalg gir «Ingen rader i utvalget», ikke stillhet. Valgene står etter en feil, så nytt forsøk er ett klikk. I dag står feilen øverst på siden, og en vellykket eksport sier ingenting (HM41). Feilen i ORDRE (34) rettes der; regelen her gjelder alle formater. |
| E10 Maskinens fra–til | `detaljEksport` sender maskinradens fra–til. De vises i Fra og Til når maskinen er egen linje (retter HM34). På en timelinje er Fra og Til timeradens. |
| E11 «⚠ Maskin uten timerad» | Følger H12: merket settes bare når kortet ikke har arbeidsrad. Merket «ikke eksporterbar» (`R:735–736`) er uendret. |
| E12 Fakturagrunnlag for ett kort eller ett underprosjekt (H5) | Rapporten og eksporten får to nye avgrensninger; i dag finnes bare periode, prosjekt og ansatt (HM58). **Underprosjekt:** et filter ved siden av prosjekt. **Kort:** avkrysning på oversiktsradene i rapportens Detaljer, og «Eksporter valgte kort (n)» i eksportmenyen. **Alt på kortet følger med:** timer, maskiner og utstyr (småutstyr er maskinrader, HM47), varer, tillegg og utlegg. Resten av dagen kommer ikke med. Regelen «bare attesterte» fra (31) består: bare kortets attesterte linjer, med varer og utlegg etter regelen i § 12.2 «Varer». |
| E13 Radtypene | Avkrysningene Timer, Maskin, Vare, Tillegg og Utlegg virker som i dag. Uten Maskin er maskinkolonnene tomme og egne maskinlinjer skjult. Uten Timer, med Maskin, står maskinene som egne linjer (`TR:313–316`). Vare følger samme regel. |

En delvis attestert sedel gir et kort med bare de attesterte linjene; delsummen gjelder linjene som er med.

### 12.4 Paritetsmatrise

Det finnes ingen arkiv-PDF for timer (HM19); siste kolonne er rapport-PDF og Excel «Detaljer». «Web firmaliste» gjelder
alle tre fanene og prosjektattesteringen (R12, R13). Paritet er ikke likhet: volum-attestering hører på web (R15).

| Funksjon | Web firmaliste (`SeddelKort`) | Web detalj | Mobil detalj | PDF / Excel |
|---|---|---|---|---|
| Gruppe i dag | Underprosjekt (HM9) | Prosjekt + underprosjekt (HM13) | Radtype (HM21) | Blokk pr. timerad (HM16) |
| Gruppe etter | Kort | Kort | Kort | Kort (rekkefølge; hode ved E3) |
| Prosjektnummer i dag | Bare gruppehode, sedelens prosjekt | Seksjonshode | Nei | Bare aggregatark |
| Prosjektnummer etter | Kortets hode | Kortets hode | Kortets hode | Kolonne + korthode |
| Underprosjekt og byggeplass etter | Kortets hode | Kortets hode | Kortets hode | Kolonner (finnes) + korthode |
| Timerader sortert på fra-tid | Nei → ja | Nei → ja | Nei → ja | Nei → ja |
| Maskin på sin timerads linje (når koblingen finnes, HM36) | Etter alle timerader → på linja | Egen liste → på linja | Egen seksjon → under timeraden, som i prosjektkortet (R15) | Time-maskin: ja (står). Døgn-maskin: egen linje → på linja |
| Maskin uten kobling | Etter alle timerader i bøtta → egen linje i kortet, etter kortets timelinjer (G5) | Egen liste → som web | Egen seksjon → som web | Egen blokk med ⚠ → egen linje i kortet; ⚠ bare uten arbeidsrad (E11) |
| Varer på sin timerads linje (H2) | Finnes ikke → ja | Finnes ikke → ja | Finnes ikke → under timeraden | Finnes ikke → ja (E5) |
| Tillegg i kortet | Nederst på sedel → i kortet | Pr. prosjekt → i kortet | Egen seksjon → i kortet | Egne blokker → i kortet |
| Utlegg i kortet | Bare hover → i kortet | Finnes ikke → i kortet | Finnes ikke → i kortet | Egne blokker → i kortet |
| Ukeavvik peker på rad | Nei → ja | Nei → ja | Nei → ja | — |
| Varsel navngir normen med tall i teksten | Nei → ja | Nei → ja | Nei → ja | — |
| Fast kolonnehode, alltid synlig | Nei → ja | Nei → ja | — (R15) | Ja (står) |
| Én linje pr. timeregistrering, med maskin og varer på linja og alle feltene (R2, R3) | Fire kolonner, maskin i fritekst → ja | Tre lister → ja | Bare timer og matpause → samme felter, maskin og varer under timeraden | Time-maskin på linja (står); døgn-maskin og vare kommer til |
| Flere maskiner eller varer på én timerad | Finnes ikke → underlinjer (H14) | Finnes ikke → underlinjer | Én tekstlinje hver, som i prosjektkortet (HM42) | Navn kommaskilt og timer summert (HM48) → underlinjer; i Excel egne rader |
| Time-maskin på timeradens linje (HM33) | Nei → ja (H10) | Nei → ja | Nei → under timeraden | Ja (står) |
| Maskinens mengde og enhet i egne kolonner, ved siden av maskinen (H9) | Parentes → ja | Egen liste → ja | Nei → ja | Ja (står) |
| Maskinens fra–til (egen maskinlinje) | Bare når begge er satt → kolonnene Fra og Til | Som web | Nei → ja | Mangler → ja (E10) |
| Oversiktsrad pr. kort | Nei → ja | Nei → ja | Nei → ja | Nei → ja (E3) |
| Flyttbare kolonner | Nei → ja, pr. bruker | Nei → ja, samme oppsett | Nei (R15) | Ja, pr. mal (står). Rapportskjerm: også i hodet (R19) |
| Kolonnebredde som kan dras | Nei → ja, pr. bruker | Nei → ja | Nei (R15) | Rapportskjerm: nei → ja, pr. bruker (R19). PDF og Excel: standardbredder som før |
| Sortere og filtrere i kolonner | Nei → ja, fra kolonnehodet | Nei → ja | Nei (R15) | I Excel selv. Rapportskjerm: nei (R19) |
| Verktøy på én linje, resten er rader (R17) | Seks bånd → én linje | — | — | Rapportskjerm: én linje (står) |
| Eksporten svarer med fil eller feil ved knappen (E9) | — | — | — | Feil øverst, ingen kvittering → ja |
| Etter prosjekt og Etter ansatt viser radene | Bare dagssummer → hele raden | — | — | — |
| Attester utvalget etter filter | Gruppe og «Attester alle», hele sedler → rader i utvalget | — | Nei | — |
| Attester og returner pr. kort (H1) | Nei → ja | Nei → ja | Nei → ja | — |
| Rette i cellen (R21) | Vindu bak pennen → i cellen; vinduet består | Egen redigeringsmodus → i cellen | Nei (R15) | — |
| En rettet verdi viser hva som sto før | Nei → ja | Nei → ja | Nei | — |
| Knappene står fast når tabellen rulles (R22) | Nei → ja | Nei → ja | — | — |
| Gjenåpne linje og kort (R23) | Bare hel sedel → ja | Bare hel sedel → ja | Som i dag (R15) | — |
| Fakturagrunnlag for ett kort eller ett underprosjekt (E12) | — | — | — | Nei → ja |
| Eksportmaler på tabellens kolonner, firmaets og egne (E6) | — | — | — | Finnes med 30 kolonner (HM56) → samme kolonneliste som attesteringen |

### 12.5 Funksjonsinventar

Ingen funksjon fjernes. Finner koderen en funksjon som ikke står her og som må vike: STOPP og meld.
`page.tsx` = `apps/web/src/app/dashbord/firma/timer/attestering/page.tsx`; øvrige filnavn som i § 12.1.

| Funksjon | Kode | Status |
|---|---|---|
| Tre visninger: Sedler · Etter prosjekt · Etter ansatt | `page.tsx:163`, `:596–607` | **ENDRES** (H4): tre grupperinger av samme tabell; alle viser hele raden. Summene regnes på radens prosjekt (HM12). |
| Ukepivotenes tall: timer pr. dag, ukesum, ukenorm, avvik | `AttesteringPivot.tsx:211`, `:370` | **ENDRES:** flyttes til ukeoversikten over tabellen (R12). Ingen tall forsvinner. |
| Statusfanene venter · attestert (skrivebeskyttet), ukenavigasjon, visning og uke i adressen | `page.tsx:178`, `:182–190`, `:229` | **BEVARES.** |
| Filtrene prosjekt, ansatt, avdeling | `page.tsx:171–173`, `:262`, `:551–587` | **ENDRES:** de tre nedtrekkene blir filterikon i kolonnehodet (R8). Avdeling blir en kolonne som kan slås på. Valgt filter huskes ikke til neste besøk (R7). |
| Beskrivelsen øverst på attesteringssiden | `page.tsx:444` | **ENDRES:** flyttes til ?-hjelpen (R17). Teksten består. |
| Rapportens Detaljer-tabell: virtualisering, gruppering, delsum, totalsum, radtelling, regelen for ekstern mottaker, «Velg parameter» lagret i malen | `TD`; `RP:1109–1177`, `:1223–1297` | **BEVARES.** **ENDRES:** tabellen blir den delte `TimerRadTabell` (R1); bredden kan dras og kolonner flyttes i hodet (R19). Ingen sortering eller filter i rapporten. |
| Delte kolonnebredder for skjerm, PDF og Excel | `TR:605–637` | **BEVARES** for PDF og Excel. **ENDRES** på skjerm: standard til brukeren drar (R6, R19). |
| Time-maskin foldet inn på timeradens linje i rapport og eksport | `TR:255–312` | **BEVARES**, og gjelder nå også attesteringen (H10). **ENDRES:** koblede døgn-maskiner står også på linja, ikke under den, og flere maskiner vises hver for seg i stedet for kommaskilt med summert tid (HM48, H14). |
| Varselet «⚠ Maskin uten timerad» | `R:732–739`; `TR:321–323` | **ENDRES** (H12): bare når kortet ikke har arbeidsrad. Rader uten kobling står i kortet sitt (G5). |
| Eksportens feilmelding øverst på rapportsiden | `RP:634–642`, `:939–943` | **ENDRES** (E9): svaret står ved knappen, og en vellykket eksport kvitteres med filnavn. |
| «Utvid alle» · «Kollaps alle» · fold ut det som krever vurdering | `page.tsx:322–345`; `sedel-vurdering.ts:64` | **ENDRES:** radene er alltid synlige. «Kollaps alle» = «Bare oversiktsrader» (R9); «krever vurdering» = filter i Avvik (R8). |
| «Attester alle» i pivotene | `AttesteringPivot.tsx:320`, `:510`, `:595`; `page.tsx:411–414` | **ENDRES:** «Attester utvalget» (R10) — radene i utvalget, ikke hele sedler. |
| Prosjektets attesteringsliste med ✓, retur og lenke | `[prosjektId]/timer/attestering/page.tsx:120–175` | **ENDRES** (R13): samme tabell, låst til prosjektet. ✓, retur og veien til detaljen består. |
| Prosjektgrupper i Sedler-visningen med sum og «Attester gruppe» | `page.tsx:360–390`, `:734–740` | **ENDRES** (H4): prosjektgruppene er grupperingen «Etter prosjekt», med sum på radens prosjekt. «Attester gruppe» = «Attester utvalget» (R10) — gruppas rader, ikke hele sedlene. |
| ✓ og retur pr. sedel, gjenåpne | `SeddelKort.tsx`; `D:6829`, `:7007`, `:5708` | **BEVARES.** |
| Avkrysning og ✓/retur pr. rad på detaljsiden | `attestering-buckets.tsx:159`, `:474`; `D:5407`, `:5601` | **BEVARES** på serveren: `attesterRader` og `returnerRader` tar fortsatt rader. **ENDRES** i tabellen (H10): timeraden og maskinene på linja attesteres og returneres samlet. Egne maskinlinjer og tillegg attesteres for seg. |
| Penn (rediger rader) | `SeddelKort.tsx:185–188`, `:867`; `RedigerRadModal.tsx` | **BEVARES**, synlig uten hover (R22) — for å slette en rad og rette pausevinduet. **ENDRES:** `redigerSedelRader` skal beholde koblingen maskin og vare → timerad (HM50, T58). Vanlig retting skjer i cellen (R21). |
| Redigering på detaljsiden, også maskinens mengde og enhet | `W/components/timer/AttesteringDetalj_Edit.tsx:218`; `W/components/timer/RedigerMaskinRad.tsx:142–160` | **BEVARES** (R14). |
| Firmavalget «rediger ved attestering» | `packages/db/prisma/schema.prisma:428`; `W/app/dashbord/firma/innstillinger/page.tsx:840–867` | **BEVARES.** Styrer også retting i cellen (R21). |
| Radhistorikken ved retting og splitt | `ST:650–666`; `D:1782–1798`, `:6227–6237` | **BEVARES.** **ENDRES:** retting i cellen skriver én post for raden som ble rettet, og tabellen viser hva som sto før (R21). |
| Gjenåpne en ferdig attestert sedel | `D:5708–5786`; `SeddelKort.tsx:526–539` | **BEVARES.** Nytt ved siden av: gjenåpne linje og kort (R23). |
| Retting av vare på sendt sedel (firma- og prosjektadministrator) | `VF:31–49`, `:565–620` | **BEVARES.** **ENDRES:** loggen får også antallet før rettingen, og en vare på en attestert linje kan ikke rettes (R21). |
| ✂ Del opp | `SeddelKort.tsx:689`, `:744`; `D:2094`, `:6434–6444` | **BEVARES**, synlig uten hover. Delene arver `kortId` (§ 4.3). «Eget kort» i attesteringen avhenger av H5. |
| Flytt underprosjekt | `flyttTimerRadEco` (§ 4.3) | **BEVARES.** Raden bytter kort etter regel 3 og vises der. |
| Merket «→ til byggherre» på underprosjekt | `SeddelKort.tsx:630–635`; `attestering-buckets.tsx:742–747` | **BEVARES** — i kortets hode. |
| Hover-dagskortet fra navn og pivotceller | `DagsKort.tsx:195`, `:322` | **BEVARES** i ukeoversikten, med prosjekt i hodet og samme radbygger. Tabellen trenger det ikke — alt står på raden. |
| Tabellen i `SeddelKort`: lønnsart · aktivitet · fra–til · timer, én overskrift pr. sedel | `SeddelKort.tsx:598–614` | **ENDRES:** alle feltene på raden (R2), ett fast hode (R5). Alt som vises i dag, vises fortsatt. |
| Sjekklister, oppgaver, HMS, mapper og faggrupper på den delte tabellen | `packages/ui/src/table.tsx`; `FlyttbareKolonner.tsx`; `useTabelloppsett.ts` | **BEVARES** uendret. Hodets verktøy løftes ut av `table.tsx` og `FlyttbareKolonner.tsx` uten endret oppførsel, og attesteringen og rapporten er nye liste-nøkler i samme lagring (R1, T46, T51). «Filtrer» og «Alle» får i18n-nøkler med samme norske tekst (R20). |
| Kolonnevalg og rekkefølge i eksportmalene | `KolonneVelger.tsx`; `EksportOppsett.config.kolonner` | **BEVARES** (H8). **ENDRES:** kolonnelista er attesteringstabellens (E6). |
| Firmamaler og egne maler: lag, gi navn, endre, «Lagre som min», «Lagre som firma», slett; innebygde maler som utgangspunkt | `EO:84–219`; `RP:154–215`, `:688–764`, `:1793–1826` | **BEVARES** (H3). **ENDRES:** config v5 med de nye kolonnene, radtypen vare og valget oversiktsrad og delsum pr. kort (E6). |
| Utlegg er med i eksporten når sedelen er attestert | `R:50–58` | **ENDRES** (H1, H5): utlegg med kort følger kortet. Utlegg uten kort følger sedelen som i dag (§ 12.2 «Varer»). |
| Rapportens avgrensning: periode, prosjekt, ansatt | `R:37–46` | **BEVARES.** Nytt: underprosjekt og valgte kort (E12). |
| Kolonnene «Mengde» og «Enhet» i rapport og eksport | `TR:503–536` | **ENDRES:** overskriftene blir «Maskinmengde» og «Maskinenhet» (R2). Nøklene er de samme, så lagrede maler virker som før. |
| Reise-merke, matpause-merke | `ReiseRadMerke.tsx`, `MatpauseRadMerke.tsx` | **BEVARES.** |
| Normtak-sperre (B10), forslag-sperre (V19), skrivebeskyttet modus, fold ut ved avvik | `SeddelKort.tsx`; `sedel-vurdering.ts` | **BEVARES.** |
| Fravær uten prosjekt, F1-regelen `radIKontekst` | `attestering-buckets.tsx:31–39` | **BEVARES** — et kort har ett prosjekt (K2), så regelen gjelder kortet. |
| Ukeavvik-merket | `Avviksbadge.tsx` | **ENDRES:** uke i teksten, rad merkes, hode bare ved merket rad (§ 12.2). |
| Mobil attesteringsliste | `attestering/index.tsx` | **BEVARES.** Ukeavviket får uke i teksten. |
| Mobil attesteringsdetalj | `AttesteringDetaljMobil.tsx` | **ENDRES:** kort i stedet for tre seksjoner. Attester og returner som i dag. |
| Eksport: formater, mottaker, kolonnevalg, maler, «Ta med uattesterte» | `timer-rapport-eksport.ts`; `eksportOppsett.ts:52–71` | **BEVARES.** **ENDRES:** rekkefølge (E1), nye valgfrie kolonner (R16), valget «Oversiktsrad og delsum pr. prosjektkort», radtypen vare, og avgrensning på underprosjekt og kort (E12). |
| Gruppering «prosjekt» i eksport | `timerDetaljRader.ts:776–777` | **ENDRES:** nøkkel = id; overskrift med nummer (E4). |
| Rapportens aggregat og CSV | `R:147`; `timer-rapport-eksport.ts:281` | **BEVARES** uendret. |
| § 7-raden «Attestering, eksport, rapport, PDF — BEVARES uendret» | § 7 | **Erstattet av denne tabellen.** |

### 12.6 Ordre-oppdeling

Dette er egne ordrer, ikke en del av d. Ordre d rører den ansattes egen sedelside (`timer/[id]/page.tsx`);
attesteringen og eksporten ligger i andre filer. **Første mål er en brukbar attesteringstabell hos Kenneth** — det er
d2a + d2b-1. Fanene, prosjektattesteringen, eksporten og mobil kommer etter.

| Ordre | Innhold | Rører | Skjema | Kenneth ser etterpå |
|---|---|---|---|---|
| **d2a** | Grunnlaget, bare server og delt kode: `grupperPaaKort`, `byggKortRader` med linjemodellen (timelinja bærer `maskiner[]` og `varer[]`, R16), `ukeAvvikRader`, `kortLeser.ts`, de tre leserne med varer, navn på underprosjekt og byggeplass, merkede rader og rettede felter (§ 12.2). **Nytt i del 3:** `rettRadFelt` (R21), `gjenaapneRader` (R23), `redigerSedelRader` beholder koblingen maskin og vare → timerad (HM50), vare-rettingen logger antallet før og avviser vare på attestert linje, og delt funksjon for prosjektnummer (E4). | `packages/shared/src/utils/kortGruppering.ts` (ny), `overtidsgrunnlag.ts`, `apps/api/src/services/timer/kortLeser.ts` (ny), `D`, `VF` | Nei | Én ting: en retting i vinduet bak pennen løsner ikke lenger maskiner og varer fra timeraden. Ellers ingenting. |
| **d2b-1** | **Attesteringstabellen** i firma-attesteringens Sedler-fane: R1–R11 og R17–R23 — den delte `TimerRadTabell`, **én linje pr. timeregistrering med maskin og varer på linja** (H10), underlinjer for flere (H14), standard kolonnerekkefølge (H9), fast hode, oversiktsrad pr. kort, én verktøylinje, «Velg parameter», filterikon og sortering i hodet, bredde som dras, flytting, **retting i cellen** (R21), **knappene fast ved høyre kant** (R22), ✓ pr. linje, kort, dag og utvalg, gjenåpne linje og kort (R23), sperrene, varsler som navngir normen. **Rapportens Detaljer bytter til samme tabell** og får bredde-dragning og flytting i hodet (R19); rapportens rader og kolonner endres først i d3. Hjelpeteksten for siden i samme commit. | `W/components/timer/TimerRadTabell.tsx` (ny), `TD`, `TB` og `W/components/FlyttbareKolonner.tsx` (verktøyene løftes ut, ingen endret oppførsel), `A/*`, `W/app/dashbord/firma/timer/attestering/page.tsx`, `RP` (bare byttet av tabell), i18n. Bruker `useTabelloppsett.ts` og `KolonneVelger.tsx` uten å endre dem. | Nei | Attesteringen er én tabell. Hver linje er timeregistreringen med maskin og varer ved siden av hverandre. Du retter i cellen og godkjenner linja. Knappene står fast når du ruller. Kolonnene kan dras bredere, flyttes, sorteres og filtreres. Bredden kan dras også i rapporten. |
| **d2b-2** | Resten av attesteringen på samme tabell: «Etter prosjekt» og «Etter ansatt» som grupperinger, ukeoversikten, prosjektattesteringen, detaljsiden, hover-kortet (R12–R14). | `A/AttesteringPivot.tsx`, `A/DagsKort.tsx`, `W/components/timer/AttesteringDetalj.tsx`, `A/attestering-buckets.tsx`, prosjektets attesteringssider, i18n | Nei | Samme tabell i alle fanene og i prosjektet. Ukesummene står over tabellen. |
| **d3** | Eksport og fakturagrunnlag på samme radbygger og kolonneliste (R16, § 12.3): `detaljEksport` (`kortId`, prosjektnummer, varer, maskinens fra–til), linjemodellen i `byggDetaljRader`, Excel, PDF og rapportskjerm, **dynamiske maler med config v5** (E6), **fakturagrunnlag for ett kort eller ett underprosjekt** (E12), utlegg følger kortet, varselet for maskin uten timerad (E11) og eksportens svar (E9). | `R`, `timerDetaljRader.ts`, `W/lib/timer-rapport-eksport.ts`, rapportsiden, `EO`, `packages/pdf/src/timer-rapport.ts`, i18n | Nei | Fakturagrunnlag med samme linjer som attesteringen, for ett kort eller ett underprosjekt, med timer, maskiner, varer, tillegg og utlegg. Malene bygges av tabellens kolonner. Eksporten sier alltid fra: fil eller feil. |
| **d2c** (bare hvis H13 = A) | Koblingen maskin → timerad skrives også på web og i dagskort-modus, og delene i en splitt arver den. Forvalgt når kortet har én arbeidsrad. | `D` (`maskin.tilfoy`, `maskin.oppdater`, `splittRad`, `splittRadEier`, `redigerSedelRader`), `W/app/dashbord/timer/[id]/page.tsx`, `M/components/timer-detalj/MaskinSeksjon.tsx`, `M/components/timer-detalj/SplittRadModal.tsx` | Nei | Ny maskinføring står rett etter sin timerad, også når den er ført på PC. |
| **c2** | Mobilens attesteringsdetalj på kort (R15): timeraden med maskin og varer under, som i prosjektkortet (HM42). | `AttesteringDetaljMobil.tsx`, `attestering/index.tsx`, i18n | Nei | Samme kort på telefonen. |

- **Samtidig med c:** d2a. Ordre c rører ingen API-fil. Eneste felles fil er `packages/shared/src/utils/index.ts`
  (én eksportlinje hver).
- **d2b-1 rører `packages/ui/src/table.tsx`**, som fem andre sider bruker (HM26). Endringen løfter hodets verktøy ut
  til deler begge tabellene bruker; `Table` skal tegne det samme som før, og T46 holder de andre sidene uendret. Ingen
  annen ordre må røre fila samtidig.
- **d2b-1 rører rapportens tabell (`TD`) og én linje i rapportsiden (`RP`).** ORDRE (34) retter PDF-eksporten på samme
  side. (34) bør merges først; `fix/rapport-pdf-eksport` @ `8c0ca1a2` er pushet og ikke merget pr. `12d9ae8d`.
- **d2a låses ikke av noen beslutning og kan bestilles nå.** Radbyggeren gir `maskiner[]` og `varer[]` uansett hvordan
  flere tegnes (H14). d2a er blitt større i del 3 (`rettRadFelt`, `gjenaapneRader`, rettingen av `redigerSedelRader`);
  orkestrator kan dele den i to ordrer på samme fil (`D`) hvis den blir for stor for én gate.
- **d2b-1 låses av H2-skissen (ja eller nei) og H14.** H12 styrer bare ett varsel og kan bygges sist. H1, H5, H6, H7 og
  H9 er besvart, og H11 er lukket.
- **d2b-2 låses ikke av noen beslutning** (H4 er besvart). **d3 låses av H14 og H12.** **d2c låses av H13.**
- **d2a rører `apps/api/src/routes/vareforbruk.ts`.** Ingen annen ordre i § 12 rører den.
- **d2c og d** rører begge `timer/[id]/page.tsx`. Sier Kenneth A på H13, legges webdelen av d2c inn i ordre d eller rett
  etter den. Mobildelen går etter c.
- **d2b-2 etter d2b-1** — samme komponenter. **d3 etter d2a og d2b-1:** d3 rører rapportsiden, som d2b-1 bytter tabell
  på. Alle legger til i18n-nøkler, og c har 15 språkfiler i sin diff — den som merges sist, rebaser språkfilene.
- **c2 må vente på c:** c rører `apps/mobile/app/timer/attestering/index.tsx`.
- **d og d3:** `timer/[id]/page.tsx` bruker `byggDetaljRader`. Ny rekkefølge (E1) slår inn der uten at fila røres;
  den som bygger d, må vite det.
- **Anbefalt rekkefølge:** d2a → d2b-1 → d2b-2 → d3 → d, med c2 rett etter c og e sist. d2b-1 foran alt annet på web
  fordi attesteringen er 🔴 hos Kenneth.
- **Deploy:** d2a + d2b-1 er web og API — én test-deploy gir Kenneth tabellen. d2b-2 og d3 kan samles i neste.
  c2 går med neste OTA etter c.
- **Ikke med i noen ordre her:** prislåsing av varer ved attestering (vedtatt fra før, ikke bygget, HM5), et felt for
  hva maskinens mengde gjelder (H9 B), eksport og egne maler for andre enn firmaadministrator (HM57), og visning av
  historikken for den ansatte (HM51). Hver av dem er en egen ordre hvis Kenneth vil ha den.

### 12.7 Tester som skal feile først

| # | Test | Ordre |
|---|---|---|
| T21 | `grupperPaaKort`: to kort med samme prosjekt, underprosjekt og byggeplass gir to grupper. Linjene er sortert på `fraTid` uansett rekkefølge inn; rader uten tid står sist; kortene i rekkefølge etter første linje. | d2a |
| T22 | `grupperPaaKort`: maskin og vare med `sheetTimerId` står **på** sin timerads linje (`maskiner[]`, `varer[]`), i ført rekkefølge. Peker koblingen på en rad i et annet kort, eller mangler den, er de egne linjer etter kortets timelinjer i sitt eget kort (G5). Reise i egen blokk. Rad uten `kortId` i «Uten kort». Antall rader inn = antall ut. | d2a |
| T23 | Rader uten underprosjekt fra to prosjekter på samme sedel gir to kort med hver sin oversiktsrad (rød i dag, HM9). | d2a, d2b-1 |
| T24 | `hentTilAttesteringFirma`, `hentForAttestering` og `hentTilAttestering` returnerer sedelens varer med `sheetTimerId` og `kortId`, utlegg i detaljen og maskiner i prosjektlista. Vare på en annen brukers eller et annet firmas sedel kommer aldri med. Varelager av → tom liste, ingen feil. | d2a |
| T25 | Leserne returnerer underprosjekt og byggeplass med navn for **alle** sedelens prosjekter (rød i dag: bare id). | d2a |
| T26 | `ukeAvvikRader`: «ført under norm» gir alle ukas overtidsrader og ingen andre; «over norm» gir de ordinære radene etter passert norm; uten avvik tom liste. Fravær følger F-F1. | d2a |
| T27 | Web: en sedel med kort på tre prosjekter viser tre oversiktsrader, og **hver linje** har prosjektnummer, prosjekt, underprosjekt og byggeplass. **En timerad med koblet maskin og vare er én linje:** maskinen står i Maskin og Maskintimer og varen i Vare, Vareenhet og Varemengde, på samme linje som timene. Det finnes ingen egen maskin- eller varerad for dem (H10). I standardrekkefølgen står Maskin og Maskintimer side om side, og Vare, Vareenhet og Varemengde side om side (H9). `kortId` finnes ikke i den tegnede teksten. | d2b-1 |
| T28 | Web: en dag med kort på A og B gir i «Etter prosjekt» rader under begge prosjektene, med bare det prosjektets rader. Prosjektsum = summen av radene. Filter på B finner radene (rød i dag, HM8). Ukeoversikten fører timene på radens prosjekt (rød i dag, HM12). | d2b-1, d2b-2 |
| T29 | Web: ukeavviket har ukenummer i teksten, raden er merket, og et kort uten merket rad har ikke varselet i oversiktsraden (rød i dag: alle sedler i uka). | d2b-1 |
| T30 | ✓ på en linje sender timeradens id og id-ene til maskinene på linja, og ingen andre. ✓ på kortet kaller `attesterRader` med nøyaktig kortets ventende timer-, maskin- og tilleggsrader. Sedelens andre kort står som ventende. I prosjektkontekst kan et kort på et annet prosjekt ikke velges. | d2b-1, d2b-2 |
| T31 | `byggDetaljRader`: radene i ett kort står samlet og i tidsrekkefølge uansett rekkefølge inn (rød i dag). Kolonnen «Kort» gir ulike nummer for to kort på samme prosjekt samme dag, også når ansatt ikke vises. | d3 |
| T32 | Gruppering på prosjekt: to prosjekter med samme navn gir to grupper (rød i dag, HM16). Detaljradene har prosjektnummer når kolonnen er valgt. | d3 |
| T33 | «Delsum pr. prosjektkort»: hodelinje og delsum pr. kort, med samme tall i Excel, PDF og på skjerm. Lagret mal uten valget gir samme kolonner som før. | d3 |
| T34 | Vare i eksporten står på sin timerads linje: med når timeraden er attestert, ute når den ikke er det, med når «Ta med uattesterte» er krysset. En vare uten timerad og et utlegg er med når ingen linje i kortet venter, også når et annet kort på sedelen venter (rød i dag: de følger sedelen). Testene fra (31) og (32) er grønne uendret, unntatt tilfellet for utlegg, som skrives om etter denne regelen. | d3 |
| T35 | Vakt: attesteringstabellen, `DagsKort`, `AttesteringDetalj`, `AttesteringDetaljMobil` og `timerDetaljRader` bruker `grupperPaaKort`/`byggKortRader`, og ingen av dem har egen bøtting på underprosjekt eller radtype. | d2b-1, d2b-2, d3, c2 |
| T36 | Mobil: detaljen viser kort med prosjektnummer i hodet, linjer på fra-tid, og maskin og varer under sin timerad. | c2 |
| T37 | `byggKortRader`: en timerad med én koblet døgn-maskin og én koblet vare gir **én** linje med én maskin og én vare — ikke tre rader. En timerad med to maskiner og tre varer gir én linje med to og tre, i ført rekkefølge. Maskinens mengde og enhet står i egne felter, ingen parentes (rød i dag, HM22). En maskin uten kobling gir egen linje med egen fra–til. Summen av Timer og av Maskintimer er lik kildens. | d2a |
| T38 | Web: en kolonne flyttes i hodet, rekkefølgen lagres under attesteringens liste-nøkkel i `tabelloppsett` og står etter ny innlasting. Oppsettet for sjekklister og oppgaver er urørt. Radrekkefølgen i kortet endres ikke. | d2b-1 |
| T39 | Varselteksten inneholder normens navn (dagsnorm eller ukenorm) og tallene i synlig tekst, ikke bare i `title` (rød i dag, HM24). | d2b-1, c2 |
| T40 | Vakt: attesteringens kolonner og eksportens kolonner bruker samme nøkler og samme overskrifter (én kolonneliste, R16). Fakturagrunnlagets oversiktsrad har de samme feltene som attesteringens, minus ansatt og status for ekstern mottaker. | d2b-1, d3 |
| T41 | Web: sortering på en kolonne gir en flat liste uten oversiktsrader, der hver linje fortsatt har ansatt, dato og prosjekt. En linje med underlinjer flyttes samlet og sorteres på første underlinje; et filter treffer linja når én underlinje treffer. Tredje klikk, eller × på sorteringsbrikken, gir kortene tilbake i G-rekkefølgen. | d2b-1 |
| T42 | Web: kolonnefilteret tilbyr verdiene som finnes i utvalget. Filter på en lønnsart viser bare de radene, kortene består, og kort uten treff vises ikke. «Krever vurdering» er et filter og gir samme sedler som `sedelKreverVurdering` i dag. | d2b-1 |
| T43 | Web: «Attester utvalget» sender nøyaktig de ventende radene som vises etter filter, i ett kall. Rader på en dato med B10-brudd eller uavklart forslag sendes ikke; meldingen sier hvor mange som ble stående. I attestert-fanen finnes ingen ✓. | d2b-1 |
| T44 | Web: ingenting attestanten trenger, ligger bare i `title`, bak hover eller bak klikk — penn og ✂ er synlige, og hvert felt i R2 finnes som celle i raden (rød i dag, HM27). | d2b-1 |
| T45 | Web: «Etter prosjekt» og «Etter ansatt» viser de samme radene som «Sedler», med annen gruppering. Ukeoversiktens tall = summen av tabellens rader for samme dag. Prosjektattesteringen viser radene uten å gå via detaljsiden, og rader på andre prosjekter er nedtonet og kan ikke velges. | d2b-2 |
| T46 | Vakt: sjekklister, oppgaver, HMS, mapper og faggrupper tegner samme tabell som før hodets verktøy ble løftet ut av `Table` — ingen ny rad, ingen endret overskrift, samme norske tekst i filteret. | d2b-1 |
| T47 | Attesteringen og rapportens Detaljer tegnes av samme tabellkomponent og samme kolonneliste; like kolonner har lik overskrift tegn for tegn (rød i dag: to tabeller, HM31, HM40). Rapporten har ingen sorterpil og intet filterikon (R19). | d2b-1 |
| T48 | Web: en kolonne dras bredere i attesteringen og i rapportens Detaljer. Bredden står etter ny innlasting, pr. bruker og pr. liste, og cella som var kuttet, viser hele teksten. PDF og Excel har samme bredder som før (rød i dag, HM32). | d2b-1 |
| T49 | Web: over attesteringstabellen står én verktøylinje. Det finnes ingen nedtrekk for prosjekt, ansatt eller avdeling utenfor tabellen. Et filter settes fra ikonet i kolonnehodet og vises som brikke med ×. Tabellramma fyller resten av vinduet, og hodet står fast når radene rulles (rød i dag, HM39). | d2b-1 |
| T50 | Web: klikk i hodet gir stigende, synkende og så kortrekkefølgen. Etter ny innlasting står kortrekkefølgen og ingen filtre; kolonner, rekkefølge og bredder står. | d2b-1 |
| T51 | Vakt: sorterpil, filternedtrekk, bredde-håndtak og flytte-håndtak finnes ett sted hver og brukes av både `Table` og `TimerRadTabell`. Tekstene i dem går via `t()` (rød i dag, HM38 c). | d2b-1 |
| T52 | `grupperPaaKort` og `byggKortRader`: en maskin uten `sheetTimerId`, med `kortId`, er egen linje i kortet sitt etter kortets timelinjer — ikke i «Uten kort», og ikke flyttet inn på en timelinje. Merket «uten timerad» settes bare når kortet ikke har arbeidsrad (rød i dag i rapporten: alle uten kobling merkes, HM35). | d2a, d3 |
| T53 | Eksport: hver vei ender i synlig kvittering med filnavn eller synlig feil ved knappen. Tomt utvalg gir melding. Valgene står etter en feil (rød i dag, HM41). | d3 |
| T54 | Bare med H13 = A: en maskin ført på web eller i dagskort-modus på et kort med én arbeidsrad får `sheetTimerId` til den raden. Delene i en splitt arver originalens kobling. En eldre klient som ikke sender feltet, gir `null` som i dag. | d2c |
| T55 | En timerad med to maskiner og to varer tegnes som én linje med to underlinjer. Hver maskin har egne celler for navn, timer, mengde og enhet. Linja har én avkrysning og én ✓. Excel gir to rader der Timer bare står på den første, og summen av Timer er lik kildens (H14). | d2b-1, d3 |
| T56 | `rettRadFelt`: maskinmengde 5 → 6 på en ventende rad på en sendt sedel. Raden har samme id, samme `kortId` og samme `sheetTimerId` etterpå. Det er skrevet én historikkpost, med 5, for den raden og ingen for andre rader. Sedelen er fortsatt sendt. Avvist, og verdien står: ikke firmaadministrator, firmavalget av, attestert rad, sedel som ikke er sendt. Overlapp i tid og maskin over arbeid avvises som i `redigerSedelRader`. | d2a |
| T57 | Leserne gir en rettet rad feltet, verdien før, hvem og når. En rad som bare fikk historikkpost fordi en annen rad ble rettet i vinduet bak pennen, gir tom liste. Web: cellen viser «var 5,00» i synlig tekst, ikke bare i `title`. | d2a, d2b-1 |
| T58 | `redigerSedelRader`: etter en retting har maskinene `sheetTimerId` til den nye timeraden, og varene som pekte på den gamle timeraden, peker på den nye (rød i dag, HM50). | d2a |
| T59 | `gjenaapneRader`: attesterte rader blir ventende, en ferdig attestert sedel blir sendt, og andre rader er urørt. Uten attesteringsrett: avvist. Gjenåpningen er loggført med hvem og når. Web: gjenåpne står på attestert linje og i oversiktsraden. | d2a, d2b-1 |
| T60 | Web: når tabellen rulles sidelengs, står avkrysningen til venstre og knappekolonnen til høyre. Når den rulles ned, står hodet. ✓ er synlig for hver linje uten å rulle sidelengs, også når tabellen er bredere enn vinduet (rød i dag, HM60). | d2b-1 |
| T61 | Web: Enter eller Tab lagrer én celle i ett kall, Esc angrer. Avviser serveren, står den gamle verdien og cellen viser grunnen. For en bruker uten rett er cellene ikke redigerbare. En attestert linje kan ikke rettes før den er gjenåpnet. | d2b-1 |
| T62 | Vare: en administrator retter antallet på en sendt sedel, og loggen har antallet før og etter (rød i dag: bare etter, HM53). En vare på en attestert timerad kan ikke rettes. | d2a |
| T63 | Prosjektnummer: internnummeret vises. Uten internnummer vises SD-nummeret. Uten internnummer og med SD-visning slått av på prosjektet er feltet tomt. Attestering, oversiktsrad og eksport bruker samme funksjon. | d2a, d2b-1, d3 |
| T64 | Maler: en mal lagret som v4 gir samme kolonner og samme fil som før. En ny mal med Maskin, Vare og «Kort» gir de kolonnene i valgt rekkefølge i Excel og PDF. En firmamal vises for en annen firmaadministrator; en egen mal vises bare for eieren. | d3 |
| T65 | Fakturagrunnlag for ett kort: bare kortets linjer, med timer, maskiner, varer, tillegg og utlegg; dagens andre kort er ikke med. Avgrensning på underprosjekt gir bare det underprosjektets kort. Kortets utlegg er med når kortet er attestert, også når et annet kort på sedelen venter. | d3 |
| T66 | Rapport og eksport: en koblet døgn-maskin står på timeradens linje (rød i dag: egen linje under). To time-maskiner på én timerad vises hver for seg med egne timer (rød i dag: summert og kommaskilt, HM48). | d3 |

### 12.8 Beslutninger til Kenneth

Tabellen står slik den ble lagt fram. **H1–H10 er besvart i § 12.8.1, og svarene går foran anbefalingene her.** H11 er
lukket. Det som står åpent etter del 3, står i § 12.8.2.

| # | Spørsmål | Anbefaling |
|---|---|---|
| **H1** | **Skal kortet kunne attesteres og returneres for seg?** A: ja, ✓ og retur i kortets hode, i tillegg til rad og sedel. B: nei, bare rad og sedel som i dag. | **A.** Det er slik du fakturerer: ett kort om gangen. Serveren har alt som trengs. |
| **H2** | **Varer i attestering og eksport.** A: varene vises under sin timerad, attesteres ikke for seg, og går i eksporten når sedelen er attestert — med mengde og enhet, uten beløp. B: som A, og attestering låser i tillegg prisen på varen, så beløpet kan stå i fakturagrunnlaget. C: bare vise varene i attesteringen, ikke i eksporten. | **A nå, B som egen ordre.** A gir deg varene på riktig timerad med en gang. B er vedtatt fra før og aldri bygget (HM5); den skriver i varelageret og må ha egne regler for retur og gjenåpning. |
| **H3** | **Hva skiller to kort på samme prosjekt i en eksport?** A: kolonnen «Kort» med løpenummer pr. dato, og korthode med klokkeslett og beskrivelse når «Delsum pr. prosjektkort» er på. B: bare korthodet, ingen kolonne. C: en kort kode laget av kort-id. | **A.** Nummeret kan filtreres og summeres i Excel. C bryter «kort-id vises ikke» (B1). |
| **H4** | **De tre fanene — Sedler, Etter prosjekt, Etter ansatt.** A: de består som tre grupperinger av **samme** tabell, og ukesummene pivotene viser i dag, står i en ukeoversikt som åpnes med én knapp over tabellen. B: fanene fjernes; det er én tabell, og du grupperer selv ved å sortere og filtrere. Ukesummene pr. dag forsvinner da. C: «Sedler» får tabellen, de to pivotene står som i dag. | **A.** Du får hele raden uansett fane, og ingen tall forsvinner. B er enklest, men tar bort ukeoversikten. C løser ikke det du pekte på i «Etter prosjekt». |
| **H5** | **«Timer skal deles opp» — har jeg lest deg riktig?** Jeg leser det som at timene skal stå delt pr. kort i attestering og eksport, med delsum pr. kort. A: ja, det er det. B: du vil også at attestanten skal kunne dele en rad ut til et **nytt** kort (✂ med «eget kort»). | **A.** Serveren støtter alt B (`D:6434–6444`); sier du B, er det et valg i ✂-vinduet i ordre d2b-1. |
| **H6** | **Hvilket prosjektnummer står i kortets hode når prosjektet mangler internt nummer?** A: SD-nummeret vises i stedet. B: ingenting, som i dag. | **A.** Da har hvert kort et nummer. Eksporten får begge numrene som kolonner uansett. |

| **H7** | **Hvem eier kolonnerekkefølgen i attesteringen?** A: hver bruker sin egen, husket på tvers av PC-er — slik sjekklister og oppgaver virker i dag. B: firmaet har én rekkefølge som en administrator setter. | **A.** Lagringen finnes, ingen migrering. Standardrekkefølgen er lik for alle til brukeren flytter noe. B krever ny lagring og ny innstillingsside. |
| **H8** | **Skal attesteringen og eksporten dele kolonneoppsett?** Kolonnene defineres uansett ett sted, med samme ord (R16). Spørsmålet er rekkefølgen og utvalget. A: hver for seg — skjermen huskes pr. bruker, eksporten pr. mal, som i dag. B: eksporten følger det brukeren har på skjermen. C: som A, pluss en knapp «Eksporter det jeg ser» i attesteringen. | **A nå, C som egen ordre hvis du vil ha det.** Det du sender kunden, bør ikke endre seg fordi én attestant flyttet en kolonne. Malen holder fakturagrunnlaget likt hver gang. |
| **H9** | **Maskinradens mengde («6 m3») sier ikke hva som er målt** (HM22). A: vis tallet i kolonnene Mengde og Enhet på maskinraden, som det er ført. B: maskinskjemaet får i tillegg et felt for hva mengden gjelder (masse eller vare), så raden kan leses «6 m³ pukk». | **A nå, B som egen ordre hvis du vil ha det.** A gjør det lesbart at tallet hører til maskinen. B er en ny funksjon i føringen på mobil og web, ikke i attesteringen. |

| **H10** | ⚠️ **SNUDD av Kenneth 2026-11-16, se § 12.8.1.** Del 2 førte dette som «hver registrering er egen rad — timerad, så maskinrad, så varerad». Kenneths svar: én linje er timeregistreringen slik prosjektkortet viser den, med maskin og varer på samme linje. | Ført inn som R3, G4 og R10 i del 3. «Egne rader» er forlatt. |
| **H11** | 🟢 **Lukket — følger av H10 og H2.** Spørsmålet var om attesteringen skulle sette time-maskinen på timeradens linje slik rapporten gjør (A), alltid vise den som egen rad (B), eller om heller ikke rapporten skulle folde (C). | **A følger av H10:** maskinen står på timeradens linje i attestering, rapport og eksport. B og C strider mot H10. Se § 12.2 «Maskinen på timeradens linje». |
| **H12** | **Varselet «⚠ Maskin uten timerad».** I dag står det på hver maskin som mangler kobling til en timerad — og alt som føres på PC og i dagskort-modus, mangler den (HM36). Varselet roper altså på helt vanlig føring. A: maskinen står i prosjektkortet sitt, etter kortets timerader, uten varsel. Varselet vises bare når kortet ikke har noen arbeidsrad. B: som i dag. | **A.** Da betyr varselet det det sier: maskin brukt uten registrert arbeid. Kortet viser uansett hvilke timer maskinen hører sammen med. |
| **H13** | **Skal maskinen kobles til timeraden også når den føres på PC og i dagskort-modus?** A: ja, fremover — skjemaet velger timerad, forvalgt når kortet har én. Gamle rader står som de er. B: som A, og gamle rader kobles der kortet har nøyaktig én arbeidsrad (du kjører en dataretting). C: nei; maskinen står i kortet sitt uten kobling. | **A, som egen ordre (d2c).** Uten den blir «maskin rett etter sin timerad» bare sant for det som er ført i prosjektkort-modus på telefonen. B hjelper lite: lørdagskortet har fem timerader og kan ikke kobles automatisk. |

#### 12.8.1 Kenneths svar 2026-11-16 (ordrett der det står i anførselstegn)

🟢 **Besvart: H1–H10.** 🟡 **Åpent: H11–H13.** H11 følger trolig av H10 og H2, men Kenneth har ikke svart på den. Svarene **går foran** anbefalingene i tabellen over. Der R-, G- og E-reglene i § 12 sier noe annet, gjelder svarene her til Fabel har ført dem inn.

| # | Svar | Hva det betyr |
|---|---|---|
| **H10** | ⚠️ **SNUDD fra «egne rader» til «registreringen på én linje».** Kenneth: *«Jeg går inn i cellen for maskin og endrer den fra 5 til 6 -> så godkjenner jeg hele linjen.»* · *«H10, ja, en rad per registrering slik prosjektkortet gjør»* | **Én rad er én timeregistrering slik den står på prosjektkortet:** timeraden med sin maskin og sine varer på **samme linje**. Attestanten retter i cellen (for eksempel maskinmengden) og godkjenner hele linja. Fabels føring i R3, G4 og T27 («maskin og vare som egne rader») og innvendingen «kan ikke attesteres hver for seg» faller. Kenneth ser ikke det som et behov: linja rettes i cellen og godkjennes samlet. Fabel må spesifisere flere maskiner eller varer på én timerad, og maskin uten timerad (G5). Mål hvordan mobilens prosjektkort viser dem. |
| **H1** | **Ja** | Kortet attesteres og returneres for seg (A). |
| **H2** | **Nei.** *«hvorfor ikke i samme linje som timeregistreringen? Problemet er lange linjer. Løses med godkjenning og gjenåpning til venstre for vertikal scroll og til høyre for horisontal scroll»* | Varer står **på timeradens linje**, også i eksporten, ikke under den. Linja blir lang. Derfor står knappene for godkjenning og gjenåpning **fast** og er synlige ved både vertikal og horisontal scroll. Knappene står fast ved høyre kant, rett innenfor den vertikale rullefeltet. Kenneths ord kan leses på to måter. Fabel tegner forslaget og viser det for Kenneth. |
| **H3** | *«Eksport skal være dynamisk. Jeg må kunne velge hva jeg eksporterer … dynamiske eksportmaler iht timekortets kolonner. Eksportmaler må kunne redigeres ved behov. Noen firma-eksportmaler og noen den enkelte kan lage selv.»* | Eksportmalene bygges på **de samme kolonnene som timekortet** (attesteringstabellen). Brukeren velger hvilke kolonner som eksporteres. Malene kan redigeres. Det finnes to nivåer: **firmamaler**, som deles i firmaet, og **egne maler**. Kolonnen «Kort» og oversiktsraden (forslaget i H3) er valg i malen, ikke faste. Mål dagens lagrede maler (config v4, `eksportOppsett.ts`): hvor de eies (pr. bruker eller pr. firma) og hvem som kan redigere dem. |
| **H4** | **Ja** | Alle tre fanene beholdes, som grupperinger av samme tabell, med ukesummene øverst. |
| **H5** | *«betyr at et prosjektkort kan faktureres for seg selv uten at hele dagskortet er med. Typisk eksempel er et registrert underprosjekt. Med timer, varer, tillegg, maskiner og utstyr som ble brukt i jobben»* | Ja. Kortet er faktureringsenheten. Fakturagrunnlaget for ett kort, for eksempel ett underprosjekt, tar med **alt** på kortet: timer, varer, tillegg, maskiner og utstyr. Resten av dagen kommer ikke med. |
| **H6** | **Ja, men** *«internt nummer skal fortrinnsvis benyttes, ikke SD-nummer»* | Prosjektnummer-kolonnen viser **firmaets interne prosjektnummer**. SD-nummeret brukes bare når det interne nummeret mangler. |
| **H7** | **Ja** | Kolonnerekkefølgen lagres pr. bruker. |
| **H8** | **Ja** | Attesteringen og eksporten har hvert sitt oppsett. |
| **H9** | **Ja, forutsatt** *«at maskinen og maskinens mengde (timer) er kolonner ved siden av hverandre som default. Samme med varer, enhet og mengde.»* | Standard kolonnerekkefølge: **Maskin · Maskinmengde (timer)** side om side, og **Vare · Enhet · Mengde** side om side. Brukeren kan flytte kolonnene (H7), men standarden er slik. |

**Låser d2a:** ingen. **Låser d2b-1:** H1, H5, H6, H7, H11, H12. **Låser d2b-2:** H4. **Låser d3:** H2, H3, H8, H11, H12.
**Låser d2c:** H13. H9 låser ingen; A er det d2b-1 bygger uansett.

#### 12.8.2 Åpent etter del 3 — til Kenneth

Viktigst først. De to første låser attesteringstabellen (d2b-1).

| # | Spørsmål | Anbefaling |
|---|---|---|
| **H2-skissen** | **Står knappene riktig?** Skissen i § 12.2 «Faste knapper» setter godkjenn, returner og gjenåpne **fast helt til høyre**, rett til venstre for det loddrette rullefeltet. De ruller ikke med når linja rulles sidelengs. Ja: bygges som skissen. Nei: knappene står fast til **venstre**, ved avkrysningen. | **Ja.** Det er slik jeg leser ordene dine: til venstre for det loddrette rullefeltet og til høyre for det som ruller sidelengs. |
| **H14** | **Flere maskiner eller flere varer på samme timerad** — det kan føres i dag (HM43). A: underlinjer inne i linja, én tekstlinje pr. maskin og pr. vare, hver med egne celler. B: alt i én celle, navnene kommaskilt og timene summert. C: egne kolonner — Maskin 1, Maskin 2, Vare 1, Vare 2. Tegning og tabell står i § 12.2. | **A.** Bare A lar deg rette «maskinmengde 5 → 6» på riktig maskin. Det er også slik telefonens prosjektkort viser dem. |
| **H12** | **Varselet «⚠ Maskin uten timerad».** Uendret fra § 12.8. Etter H10 er en maskin uten timerad en egen linje i kortet sitt (G5). Spørsmålet er bare varselet. A: varselet vises bare når kortet ikke har noen arbeidsrad. B: som i dag, på hver maskin uten kobling. | **A.** Telefonens prosjektkort viser slike maskiner under «Uten rad» uten varsel (HM44). |
| **H13** | **Skal maskinen kobles til timeraden også når den føres på PC og i dagskort-modus?** Uendret fra § 12.8, men betyr mer etter H10: uten koblingen står en maskin ført på PC som egen linje, ikke på timeradens linje. A: ja, fremover. B: som A, og gamle rader kobles der kortet har nøyaktig én arbeidsrad. C: nei. | **A, som egen ordre (d2c).** |

**Følger av svarene dine. Dette er ikke spørsmål, men si fra hvis du mente noe annet:**

1. **Maskin som leies ut pr. døgn og er ført på en timerad, står på timeradens linje** — også i rapport og
   fakturagrunnlag. Regelen fra september satte den på egen linje. Ført uten timerad står den alene, uten varsel.
2. **Utlegg, og varer uten timerad, følger kortet i eksporten** — ikke hele sedelen. Ellers mangler de i
   fakturagrunnlaget for et kort til resten av dagen er attestert. Dette endrer regelen fra (31) for utlegg.
3. **Bare firmaadministrator kan rette i cellen**, og bare når firmaet har «rediger ved attestering» på. Slik er det
   i dag. En attestant som ikke er firmaadministrator, må returnere linja.
4. **Egne eksportmaler er hver firmaadministrators.** Hele rapport- og eksportsiden er for firmaadministrator i dag.
5. **Varen står med mengde og enhet, uten beløp.** Prisen låses ikke ved attestering; det er vedtatt fra før og ikke
   bygget.

**Låser d2a:** ingen — kan bestilles nå. **Låser d2b-1:** H2-skissen og H14; H12 styrer bare ett varsel.
**Låser d2b-2:** ingen. **Låser d3:** H14 og H12. **Låser d2c:** H13.

#### 12.8.3 Kenneths svar 2026-11-16, runde 2 (ordrett der det står i anførselstegn)

🟢 **Besvart: H11, H12 og H13, pluss mal-raden i eksportmenyen.** 🟢 **H2-skissen og H14 besvart samme dag (radene nederst).** Ingen H-er åpne. Svarene her går foran tabellen i § 12.8.2.

| # | Svar | Hva det betyr |
|---|---|---|
| **H11** | **«enig»** (A) | En maskin som er koblet til en timerad, står på timeradens linje i attesteringen, slik rapporten gjør. Linja attesteres samlet. |
| **H12** | ⚠️ **Strengere enn A og B:** *«man skal ikke kunne registrere maskinrad uten at det er ført timer.»* | Varselet blir en **sperre ved føring**. En maskinrad kan ikke lagres uten at det er ført timer. Fabel skal spesifisere følgende: om sperren krever en koblet timerad (H13) eller bare timer på kortet; hvor den virker (mobil i begge moduser, PC og attestantens «legg til maskin»); og hva som skjer med eksisterende maskinrader uten timer. De eksisterende radene slettes aldri, og de vises i kortet sitt (G5). Spørsmålet om koblet timerad eller timer på kortet er sendt til Kenneth. |
| **H13** | **«enig»** (A) | Maskinen kobles til timeraden fremover, også på PC og i dagskort-modus. Det blir egen ordre (d2c). Gamle rader står som de er. |
| **Mal-raden** (ordre 34) | **Nei.** *«jeg vil se filen først før vi lager/lagrer den»* | Klikk på en mal-rad som «Fakturagrunnlag (.pdf)» legger malen på skjermen og lager **ingen** fil, som i dag (`86a91047`). Eksporten skjer med knappen. E9 gjelder: knappen svarer alltid med en fil eller en melding. |
| **H12, presisert** | *«ja. men det skal ikke være mulig å starte en maskinrad som selges på timer uten at det er registrert arbeidstimer»* | Sperren krever en **koblet timerad**, slik det følger av H13. Det gjelder i alle fall maskiner som selges pr. time. En slik maskinrad kan ikke startes før arbeidstimer er registrert. Fabel spesifiserer om maskiner som selges pr. døgn eller på andre enheter også krever koblet timerad. Kenneths ord sier «som selges på timer». |
| **H14** | *«jeg kan akseptere dette -> men da med tydelig skille på hvilke rader som hører sammen»* | **A, underlinjer.** Kravet er et **tydelig visuelt skille** mellom linjer som hører sammen og nabolinjene. Én timeregistrering med sine maskiner og varer skal leses som én enhet, for eksempel med felles ramme eller bakgrunn og innrykk. Fabel tegner skillet. |
| **H2-skissen** | **«enig»** | Knappene for godkjenning, retur og gjenåpning står fast helt til høyre, rett til venstre for det loddrette rullefeltet, som skissen i § 12.2 viser. |
| **A3** (ordre c, «Fjern teksten») | *«enig -> beskrivelse eksisterer ikke uten timer»* | Knappen «Fjern teksten» i Bekreft dag fjernes. En beskrivelse hører alltid til timer. Den droppes ikke og slettes ikke av en egen knapp. |
