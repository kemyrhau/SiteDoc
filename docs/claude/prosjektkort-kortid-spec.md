---
status: 🟢 VEDTATT 2026-11-16 — B1–B7 besvart av Kenneth (§ 10 «Kenneths svar»); B6 snudd: fravær føres på prosjektkort. Ingen kode. Ingen funksjon fjernes. TILLEGG 2026-11-16 (lønnsartvalg pr. linje) ført inn som § 6.1. TILLEGG 2026-11-16 (fraværskort uten prosjekt) ført inn som § 11 — 🟡 FORSLAG, F1–F8 til Kenneth.
sist_verifisert_mot_kode: 2026-11-16 (develop @ e3aea58f — målt på 140c19cb, linjereferanser i `bekreft-dag.tsx` og `dagsforslagAnvend.ts` oppdatert etter (26)-mergen `780f388c`; § 11 målt mot develop @ dc5833dc)
eier: Fabel (spec) → Timer-feilsøk/Redesign (kode)
ordre: «ORDRE — spec: prosjektkort med kort-id, dagskortet som sum av prosjektkort, lønnsart-forslag fra døgnets registreringer — orkestrator 2026-11-16» + «TILLEGG … valg av lønnsart ved manuell registrering» + «ORDRE 2026-11-16 — SPEC-TILLEGG: fraværskort uten prosjekt» (relay/inbox-fabel.md)
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
(§ 8), tester (§ 9), beslutninger til Kenneth (§ 10) og fraværskort uten prosjekt (§ 11, tillegg).

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

**Gate-SQL Kenneth kjører etter migrering (skal gi 0 på alle tre):**

```sql
-- 1) arbeidsrad uten kort
select count(*) from timer.sheet_timer where er_reise = false and kort_id is null;
-- 2) kort som spenner flere sedler, prosjekter eller underprosjekt
select count(*) from (select kort_id from timer.sheet_timer where kort_id is not null
  group by kort_id having count(distinct sheet_id) > 1 or count(distinct project_id) > 1
     or count(distinct coalesce(external_cost_object_id,'')) > 1) x;
-- 3) koblet maskin med annet kort enn raden
select count(*) from timer.sheet_machines m join timer.sheet_timer t on t.id = m.sheet_timer_id
 where m.kort_id is distinct from t.kort_id;
```

Gate-SQL 2 får `coalesce(project_id, 'ingen')` når fraværskort uten prosjekt bygges (§ 11.2).

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
- **Attestering:** viser fortsatt bøtter pr. (prosjekt, underprosjekt). Ingen kortvisning i denne specen.
- **Eksport/rapport/PDF:** urørt. Ingen leser grupperer på kort (M3), og alle beløp følger radenes egne felt.

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
| L1 | **Grunnlag:** alt arbeid som alt står på datoens sedel — alle kort, alle arbeidsrader, også rader ført som overtid. Ikke reise (V1), ikke rader med `attestertStatus = 'erstattet'`, **ikke fravær** (lønnsart `type = 'fravaer'`, Kenneth 2026-11-16, B8 i § 10): arbeid etter fravær er vanlig arbeidstid, ikke overtid. Bygget i a3: `bruktAvNorm` (`apps/mobile/src/utils/overtidMotDognet.ts`) teller ikke rader med `erFravaer` (🟡 `fix/kort-a3-lonnsart-linje`, ikke merget). |
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
| Attestering, eksport, rapport, PDF | `apps/api/src/routes/timer/rapport.ts` m.fl. | **BEVARES** uendret. |
| Vakter | `dagskort-isolert-vakt`, `radLagring-glue-vakt`, `prosjektkort-glue-vakt` | **ENDRES bevisst** der skrivefelt legges til; hver endret påstand begrunnes i leveransen. |

---

## 8. Ordre-oppdeling (ordrepunkt 7)

| Ordre | Innhold | Rører | Skjema | Kenneth ser etterpå |
|---|---|---|---|---|
| **a** = (27), alt bestilt | Lønnsart-forslag for manuelt kort fra døgnets registreringer (L1–L4, L7). Dagskortet: ett kort pr. prosjektkort med linjer, på utledet nøkkel. | `manuellDag.ts`, `dagsforslag.ts` (norm-inndata), `dagsoversiktRader.ts`, `ProsjektkortDagsoversikt.tsx` | Nei | 17–18 etter 9,5 t blir Overtid 50 %. Overtid står som linje i kortet. |
| **a2** (liten) | Regelen inn i `klassifiserArbeidstid` (`bruktAvNorm`), GPS-dagen får samme grunnlag (L4), L5. F-L1 hvis B3 = ja. | `lonnsregel.ts`, `dagsforslagInput.ts`, `overtidForslag.ts` | Nei | GPS-dag oppå manuelle rader gir riktig overtid. |
| **a3** | Lønnsartvalg pr. linje i Bekreft dag (§ 6.1 V1–V7), forhåndsvalg i prosjektkortets rad-vindu (V8), firmafilter i velgeren (F-L2). | `bekreft-dag.tsx`, `dagsforslag.ts` (`retting`), `TimerSeksjon.tsx` (`LonnsartVelgerModal`), `prosjektkortUtkast.ts`, i18n | Nei | Lønnsart kan velges på hver linje før lagring, også for timer over normen. |
| **b** | Kort-id: to migreringer (§ 3), `løsKortId`/`utledKortId`/`validerKortInvariant` i shared, server-skriveveiene (§ 4), mobilens lokale kolonner + backfill + synk. Ingen UI-endring. | `packages/db-timer`, `packages/db-varelager`, `packages/shared`, `dagsseddel.ts`, `vareforbruk.ts`, `migreringer.ts`, `timerSync.ts`, `vareforbrukSync.ts`, lokale skriveveier | **Ja — Kenneth kjører to migreringer** | Ingenting endret på skjermen. Gate-SQL gir 0. |
| **c** | Mobil på kort-id: Bekreft dag (§ 5.1), dagskortet og kortskjermen (§ 5.2), Flytt/Endre/Slett, «Del til eget kort», underprosjekt i GPS-modus. | `bekreft-dag.tsx`, `beskrivelseKort.ts`, `prosjektkortMobil.ts`, `kortRadFlytt.ts`, `SplittRadModal.tsx`, kortskjermen | Nei | Grøft og skifer som to kort på samme prosjekt, hver med egen beskrivelse og egne linjer. |
| **d** | Web: samleside pr. kort-id, kortets hode, «+ Nytt prosjektkort», `kortId` fra dialogene (§ 5.4). | `apps/web/…/timer/[id]/page.tsx`, `packages/shared/…/prosjektkort.ts` | Nei | Samme kort på PC som på telefon. |
| **e** (neste release) | Steg 2: etter-backfill + `CHECK` (§ 3.4). | `packages/db-timer`, `packages/db-varelager` | **Ja — Kenneth kjører** | Ingenting. |

Rekkefølge: a → a2 → a3 → b → c → d → e. a3 trenger ikke kort-id og kan leveres før skjemaet; den rører `bekreft-dag.tsx` og må derfor ikke gå samtidig med c. **b må i prod (API) før c sendes som OTA.**
a og b rører ulike filer og kan gå parallelt hvis to agenter er ledige. Mellom c og d viser web grøft og skifer i
samme prosjektkort (B5). **Fraværskort uten prosjekt** rir på b, c og d — fordelingen står i § 11.8.

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
| B10 | **Betalt fravær + arbeid kan til sammen ikke overstige dagsnormen; ubetalt fravær frigjør normen som i B9** (Kenneth 2026-11-16, svar «1. ok» på forslaget). Kenneths begrunnelse: *«vi kan ikke registrere 7,5 timer egenmelding, for så å utbetale lønn 2 timer -> konsekvens-> arbeidsgiver betaler for 9,5 timer for 2 timer produksjon -> dette er å utnytte sykesystemet i arbeidstakers favør»*. Betalt fravær (egenmelding, sykemelding, barns sykdom) fyller bare den delen av normen som ikke er arbeidet: 2 t arbeid + egenmelding gir høyst 5,5 t egenmelding (norm 7,5). Ubetalt fravær (privat ærend, permisjon uten lønn) frigjør normen, og arbeidet etter er normaltid (B9). Krever markør «betalt» på fravær-lønnsarter (i dag finnes bare `Lonnsart.type`, `packages/db-timer/prisma/schema.prisma`) — skjemaendring, bygges i ordre b. 🟡 Ikke bygget. a3 (`6d611b05`) behandler alt fravær som ubetalt; test-OTA holdes til B10 er bygget (Kenneth 2026-11-16: «bygg ota regelen, trenger ingen endring med en gang»). |


---

## 11. TILLEGG — fraværskort uten prosjekt (Kenneth 2026-11-16, B6 + B8)

> **Status:** 🟡 FORSLAG — F1–F8 til Kenneth (§ 11.9). Ingen kode. Målt mot develop @ dc5833dc.
> **Vedtatt og ikke til ny beslutning:** fraværskortet har ikke prosjekt, byggeplass eller underprosjekt (B6) ·
> fravær bruker ikke opp normen, og ingen kombinasjon av fravær og arbeid sperres (B8).
> **Grense:** a3 (lønnsart pr. linje, fravær i velgeren, fravær på prosjektkortets prosjekt inntil videre) endres
> ikke av dette tillegget. Det som står her bygges i b, c og d (§ 11.8).

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
| FM13 | Beskrivelse kreves på alle rader som ikke er reise — også fravær. `Lonnsart.tvungenKommentar` kan settes i oppsettet, men håndheves ikke (0 treff i `dagsseddel.ts` og `apps/mobile`). | `src/utils/dagsoversiktRader.ts:180–182`; `schema.prisma:33`; `lonnsarter/page.tsx:335` |
| FM14 | Aktivitet er påkrevd pr. rad. Klokkeslett er valgfritt; en rad uten fra–til vurderes ikke mot tidsrom eller overlapp. | `schema.prisma:231–232`; `dagsseddel.ts:6453`, `:2384`; `:6460–6461`, `:674`, `:769` |
| FM15 | Overtidsgrunnlaget på server skiller ikke på lønnsart-type: fraværstimer teller som arbeid i ukegrunnlaget og i attesteringslistas avviksmarkør. Mobilens `bruktAvNorm` likeså (rettes i a3). | `dagsseddel.ts:1248–1263`, `:4295`; `src/utils/overtidMotDognet.ts:31–35` |
| FM16 | Maskin-taket bøtter pr. prosjekt + underprosjekt; en rad uten prosjekt havner i egen bøtte uten maskin. Kortsummen skiller bare reise fra arbeid. | `packages/shared/src/utils/maskinKapasitet.ts:41`; `packages/shared/src/utils/prosjektkort.ts:65–75` |

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

**Gate-SQL Kenneth kjører etter migrering:**

```sql
-- A) rad uten prosjekt som ikke er fravær (skal gi 0)
select count(*) from timer.sheet_timer t join timer.lonnsarter l on l.id = t.lonnsart_id
 where t.uten_prosjekt and l.type <> 'fravaer';
-- B) til orientering: fravær ført med prosjekt fram til nå (tallet sier hvor mye historikk som blir stående slik)
select count(*) from timer.sheet_timer t join timer.lonnsarter l on l.id = t.lonnsart_id
 where l.type = 'fravaer';
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
| Attesteringsrett for rad uten prosjekt | Samme | **NY REGEL (F1):** firma-admin i sedelens firma. Ingen oppslag på prosjektmedlemskap med `null`. |
| Attesteringskø pr. prosjekt | `hentTilAttestering` (`:4027`) | **BEVARES** — fravær uten prosjekt hører ikke til noen prosjektkø. |
| Firmaets attesteringskø og sedelliste uten prosjektfilter | `hentTilAttesteringFirma` (`:4149`, `:4196–4215`), `list` (`:1993`) | **ENDRES:** sedel med bare fravær kommer med; prosjektoppslaget hopper over `null`. |
| Åpne, attestere og returnere sedel | `hentForAttestering` (`:4398–4439`), `attester` (`:6010`), `returner` (`:6118–6133`), `attesterRader`/`returnerRader`/`gjenaapneAttestering` (`:4715`, `:4903`, `:5003`) | **ENDRES:** tåler sedel der første eller alle rader er uten prosjekt; retten avgjøres pr. rad (F1). |
| Dagstotal | `hentDagstotal` (`:8113–8135`) | **ENDRES:** fravær i egen bøtte «Fravær». |
| Perioderapport, Excel og PDF | `firmaPeriodeRapport` (`rapport.ts:159`, `:238–241`, `:276`), `detaljEksport`/`pdfEksport` (`:364`, `:432–445`, `:573`, `:722`), `hentFirmaAnsatteMedTimer` (`:946`) | **ENDRES:** uten prosjektfilter kommer fravær uten prosjekt med, under navnet «Fravær» (i18n) — ikke «(ukjent)». Prosjektnavnet er fortsatt alltid en streng (FM10). **BEVARES:** med valgt prosjekt utelates de. |
| Prosjektliste i rapportfilteret, prosjektsidene, vareforbruk pr. prosjekt | `hentFirmaProsjekterMedTimer` (`rapport.ts:910–915`); `vareforbruk.ts:83`, `:468`, `:607–614` | **BEVARES** — fravær uten prosjekt teller ikke på noe prosjekt og kan ikke bære vare. |
| Maskin-tak | `validerMaskinUnderArbeid` (`:1327–1351`), `maskinKapasitet.ts:41` | **BEVARES** — fravær gir ingen maskinkapasitet (FM16). |
| Overtidsgrunnlag på server | `byggUkeOvertidsgrunnlag` (`:1248–1263`), `beregnOvertidsgrunnlag` (`:4295`) | 🟡 **Funn F-F1, ENDRES med hjemmel B8:** fravær teller ikke som arbeid. Uten rettingen flagger attesteringslista avvik på en dag med 4,5 t egenmelding + 3 t arbeid. Gjelder fravær med og uten prosjekt. |
| Legg til, del opp, firma-admin-redigering, forsoning | `tilfoyTimerRad` (`:2377`), `splittRad`/`splittRadEier` (`:5541`, `:5779`), `redigerSedelRader` (`:5043`), `forsonDagskort` (`:2859`) | **ENDRES:** valgfritt `utenProsjekt`; prosjekt blir da ikke påkrevd i Zod. Deler av en fraværsrad forblir uten prosjekt. |
| Flytt rad til underprosjekt | `flyttTimerRadEco` (`:4536–4591`) | **BEVARES;** rad uten prosjekt avvises med egen melding. |
| Ny sedel | `opprett` (`:2186`) | **BEVARES** — godtar alt tom sedel. |
| Endre lønnsartens type | `lonnsart.oppdater` (`lonnsart.ts:99–158`) | **ENDRES (F7):** type bort fra fravær avvises når arten står på en rad uten prosjekt. |
| **Mobil** | | |
| Dagskortet i prosjektkort-modus | `ProsjektkortDagsoversikt.tsx`, `dagsoversiktRader.ts:61`, `:95–107`, `useProsjektkortSedel.ts:521–543` | **ENDRES:** fraværskortet er eget kort, sist i lista, tittel «Fravær». 🟡 Dagens sum viser arbeid og fravær hver for seg (følger av B8; i dag teller `beregnKortSummer` fravær som arbeid, FM16). |
| Bekreft dag | `bekreft-dag.tsx`, `bekreftDag.ts`, `dagsforslagAnvend.ts` | **ENDRES:** «+ Fravær» og fraværskort i forslaget (§ 11.5). Arbeidskortene er urørt. |
| Kortskjermen | `kort/[projectId].tsx:98–100`, `:344–352`; `prosjektkort.tsx:77–80` | **ENDRES:** prosjektsegmentet er `ingen` for fraværskortet (etter c: `kort=<kortId>`). Bare timerlinjer; knappene for maskin, varer, tillegg og utlegg vises ikke. |
| Beskrivelse-kravet og send-sperren | `radManglerBeskrivelse` (`dagsoversiktRader.ts:180–182`), `manglerBeskrivelse` (`bekreftDag.ts:114–118`) | **ENDRES (F4):** fraværskortet er unntatt, som reise. |
| «Flytt raden», «Endre kort» | `KortValgModal.tsx:130–136`, `kortRadFlytt.ts` | **BEVARES** for prosjektkort. Tilbys ikke på fraværskortet (fravær flyttes ikke til et prosjekt; feil ført = slett og før på nytt). «Slett kort» virker. |
| «Del opp» | `SplittRadModal.tsx` | **BEVARES;** deler av en fraværsrad forblir i fraværskortet. |
| Lønnsartvalg pr. linje på prosjektkort (a3) | § 6.1 V4-⚠️ | **ENDRES (F5)** når c leveres: fravær-arter tilbys ikke lenger på prosjektkortets linjer. a3 selv er urørt. |
| Lønnsartvelgeren i dagskort-modus | `LonnsartVelgerModal` (`TimerSeksjon.tsx:2306–2326`) | **BEVARES** — alle typer, med prosjekt, som i dag. |
| Dagskort-modus-skjermen | `app/timer/[id].tsx:1287–1306` | **ENDRES minimalt (F6):** rader uten prosjekt vises i gruppen «Fravær» i stedet for å falle på sedelens prosjekt. `dagskort-isolert-vakt` endres begrunnet. |
| Matpause, reise, maskin/varer/tillegg/utlegg, overlapp (V19), radversjoner (V19.9) | — | **BEVARES.** Fraværsraden bærer aldri pause og aldri maskin/varer. |
| Utkast | `prosjektkort_utkast_local` (`schema.ts:1097–1109`) | **ENDRES:** fraværskortet lagres i utkastet; `skjemaVersjon` økes (sammen med c). |
| **Web** | | |
| Dagsseddel-siden | `page.tsx:632–634`, `:1612–1615`, `:1649`, `:3316–3330` | **ENDRES:** kortet/gruppen heter «Fravær», ikke «Ukjent prosjekt» (b). «+ Fravær» og rad-dialog uten prosjekt-, byggeplass- og underprosjektfelt, med bare fravær-arter i lønnsartlista (d). |
| Attestering | `AttesteringDetalj.tsx:119–123`, `:518–545`; `attestering-buckets.tsx:603`; `AttesteringPivot.tsx:238–240`, `:576–583`; `firma/timer/attestering/page.tsx:258`, `:358–366` | **ENDRES:** seksjonen heter «Fravær» (b). **BEVARES:** i prosjektleder-kontekst er raden synlig og nedtonet, som rader fra annet prosjekt i dag. |
| Rapport, Excel, PDF | `firma/timer/rapport/page.tsx:1404–1406`; `timer-rapport-eksport.ts:641–646`; `timerDetaljRader.ts:776–788`; `pdf/timer-rapport.ts:343` | **BEVARES** — leser navnet serveren sender («Fravær»). |
| Ny sedel | `timer/ny/page.tsx:175`, `:380` | **ENDRES (d):** en dag kan startes med fravær uten å velge prosjekt. |

### 11.5 Brukerflyt mobil (ordrepunkt 3)

| # | Regel |
|---|---|
| U1 | **To innganger, samme kort.** (1) «+ Fravær» på dagskortet, rett under «+ Nytt prosjektkort» (`ProsjektkortDagsoversikt.tsx:757–761`). (2) «+ Fravær» i Bekreft dag, i lenkeraden der «+ Reise» står (`bekreft-dag.tsx:1495–1501`) — vist også når prosjekt ikke er valgt (raden krever i dag `prosjektId`, `:1454`). GPS-dag og manuell dag likt. |
| U2 | **Forhåndsdefinerte valg:** fraværskortet viser firmaets aktive arter med `type = 'fravaer'` som chips når de er inntil seks, ellers den søkbare lista (samme regel som V3, med firmafilter, F-L2). Ingen fritekst. |
| U3 | **Timer er forhåndsutfylt:** `max(0, dagsnorm − arbeid ført på datoen)`. Hel fraværsdag → hele normen. Gikk hjem syk etter 3 t → 4,5 t. Ukjent norm (M17) eller rest 0 → tomt felt som må fylles. −/+ i firmaets tidsrunding. Ingen klokkeslett (F3). |
| U4 | **Raskeste vei:** «+ Fravær» → art → «Bekreft» = tre trykk, ingen tekst. |
| U5 | **Kortet viser ikke** prosjekt, byggeplass, underprosjekt, aktivitet, maskin, varer, tillegg eller beskrivelse. |
| U6 | **Aktivitet** er påkrevd på raden (FM14): raden får samme standard som en ny arbeidsrad får i dag, uten at feltet vises. Koderen måler kilden til standarden før ordre c og melder hvis den ikke finnes for et firma. |
| U7 | **Flere arter samme dag:** «+ Legg til fravær» i kortet gir ny linje. Linjer slås aldri sammen. |
| U8 | **Manuell Bekreft dag med bare fraværskort lagres uten prosjekt.** Sperren `manglerProsjekt` (`bekreftDag.ts:425`) gjelder bare arbeidskort med tid. |
| U9 | **Ingen sperre og ingen varsel** når fravær og arbeid står på samme dag (B8). |
| U10 | **Linjeform:** «7,5 t · Egenmelding». Lønnsarten kan byttes på linja (samme velger som U2). |

```
 Dagskortet (i dag)              Dagskortet (etter)              Fraværskortet
 ┌──────────────────────┐        ┌──────────────────────┐        ┌──────────────────────────┐
 │ Bygg 50 · Grøft      │        │ Bygg 50 · Grøft      │        │ Fravær                 ✕ │
 │ 07:00–10:00 · 3,0 t  │        │ 07:00–10:00 · 3,0 t  │        │ [Egenmelding] [Barns     │
 │                      │        │ Fravær               │        │  sykdom] [Ferie m/lønn]  │
 │ + Nytt prosjektkort  │        │ 4,5 t · Egenmelding  │        │ Timer      −  4,5  +     │
 └──────────────────────┘        │ + Nytt prosjektkort  │        │ + Legg til fravær        │
                                 │ + Fravær             │        │            [ Bekreft ]   │
                                 └──────────────────────┘        └──────────────────────────┘
```

**Alternativ til U1 (ikke anbefalt):** «Fravær» som fast førstevalg i prosjektlista i Bekreft dag
(`bekreft-dag.tsx:1655–1658`). Ingen ny knapp, men fravær blir gjemt bak prosjektfeltet og koster fire trykk når et
prosjekt er forhåndsvalgt.

### 11.6 Web (ordre b og d)

- **b:** web tåler `projectId: null` og viser «Fravær» der den i dag ville vist «Ukjent prosjekt» (dagsseddel,
  attestering, pivot). Nødvendig i b fordi typene ellers ikke kompilerer, og fordi attestanten må kunne lese en
  fraværsrad fra første dag mobilen kan lage den.
- **d:** «+ Fravær» på dagsseddelen ved siden av «+ Nytt prosjektkort», rad-dialog uten prosjektfelt, ny sedel
  startet med fravær. Firma-admin fører fravær for en ansatt via samme dialog (`redigerSedelRader`).

### 11.7 Tester som skal feile først

| # | Test | Ordre |
|---|---|---|
| TF1 | Integrasjon mot Postgres: `CHECK` avviser (i) rad uten prosjekt og uten flagg, (ii) flagg med prosjekt, byggeplass, underprosjekt eller `er_reise`. Eksisterende rader passerer migreringen. | b |
| TF2 | Pr. server-skrivevei (§ 11.4): `utenProsjekt` med lønnsart som ikke er fravær → avvist, ingenting skrevet. Med fravær-art → lagret med `project_id NULL`. | b |
| TF3 | Arbeidsrad uten prosjekt og uten flagg kan ikke lagres via noen skrivevei (rød hvis en fallback gir den sedelens prosjekt stille i en ny klient-vei). | b, c |
| TF4 | `syncBatch`, eldre klient: sedel med bare en kjent fraværsrad avvises ikke; endret fraværsrad uten flagg beholder «uten prosjekt»; byttet til ordinær art får klientens prosjekt. | b |
| TF5 | Attesteringsrett: prosjektleder kan ikke attestere rad uten prosjekt; firma-admin kan. Sedel med bare fravær står i firmakøen og kan åpnes, attesteres og returneres. Blandet sedel velter ikke lista. | b |
| TF6 | Rapport, Excel og PDF uten prosjektfilter: fraværsrad uten prosjekt er med under «Fravær»; med prosjektfilter er den ikke med; prosjektnavnet er aldri `null`. | b |
| TF7 | Firma-isolasjon: rad uten prosjekt fra et annet firmas sedel er ikke synlig eller attesterbar (tilgang går via sedelens firma). | b |
| TF8 | Overtidsgrunnlag: 4,5 t fravær + 3 t arbeid gir ikke avvik (rød i dag, FM15). | b |
| TF9 | Mobil: «+ Fravær» på dag med 3 t arbeid og norm 7,5 → 4,5 t forhåndsutfylt; lagret rad har `uten_prosjekt` og havner i fraværskortet, ikke på sedelens prosjekt; bare-fravær-dag lagres uten prosjekt; send sperres ikke av manglende beskrivelse. | c |
| TF10 | Mobil: `kortNokkel` med tomt prosjekt gir `ingen\|ingen\|ingen` og rundtur via `fraKortNokkel`; glue-vakt mot ny `?? sedel.projectId`; dagskort-modus viser gruppen «Fravær» og er ellers uendret (vakt). | c |
| TF11 | `lonnsart.oppdater`: type bort fra fravær avvises når arten står på en rad uten prosjekt; ellers som i dag. | b |
| TF12 | Web: dagsseddel og attestering viser «Fravær» for rad uten prosjekt; «+ Fravær» sender `utenProsjekt` og ikke prosjekt. | b (visning), d (oppretting) |

### 11.8 Plass i ordrerekkefølgen (ordrepunkt 5)

**Anbefaling: ingen ny ordre og ingen ny migreringsrunde — tillegget rir på b, c og d.**

| Ordre | Tillegg fra § 11 | Skjema |
|---|---|---|
| **a3** | Ingen. Fravær føres på prosjektkortets prosjekt inntil c er levert. | Nei |
| **b** | Skjema (§ 11.2) i **samme** `db-timer`-migrering som `kort_id`; `validerUtenProsjekt`; `syncBatch` og eldre klient (§ 11.3); alle server-lesere og -skriveveier (§ 11.4); F-F1; web tåler `null` og viser «Fravær» (§ 11.6); i18n. | **Ja — fortsatt to migreringer, ingen ekstra kjøring** |
| **c** | Mobil: lokal kolonne, `radProsjektId`, «+ Fravær», fraværskortet i Bekreft dag, dagskort og kortskjerm, synk, utkast (§ 11.5). F5 trer i kraft her. | Nei (SQLite med OTA) |
| **d** | Web: «+ Fravær», rad-dialog, ny sedel (§ 11.6). | Nei |
| **e** | Urørt. Fravær-`CHECK` ligger alt i b. | — |

Rekkefølge som før: a → a2 → a3 → b → c → d → e. **b må være i prod før c sendes som OTA** (§ 11.3). Mellom c og d
kan fravær uten prosjekt føres på telefon og leses, attesteres og rapporteres på PC, men ikke opprettes på PC.

**Alternativ:** egen ordre for fravær før kort-id. Koster én ekstra migrering Kenneth må kjøre og én ekstra runde
gjennom de samme skriveveiene i `dagsseddel.ts`. Anbefales ikke.

### 11.9 Beslutninger til Kenneth (ordrepunkt 4)

Rangert etter hvor mye de låser.

| # | Spørsmål | Anbefaling |
|---|---|---|
| **F1** | **Hvem attesterer fravær uten prosjekt?** I dag avgjør radens prosjekt hvem som kan attestere (FM7). A: bare firma-admin (lønnsansvarlig). B: også prosjektlederen som attesterer resten av dagen. | **A.** Prosjektlederen attesterer arbeid på sitt prosjekt; sykdom og ferie er lønnsansvarligs sak (B8: «opp til ansatte og lønnsansvarlige»). Prosjektlederen ser raden nedtonet. Konsekvens: en dag med både arbeid og fravær er ikke ferdig attestert før firma-admin har tatt fraværslinja. |
| **F2** | **Inngang på telefon:** egen «+ Fravær» på dagskortet og i Bekreft dag, eller «Fravær» som førstevalg i prosjektlista? | **«+ Fravær»** (U1, skisse i § 11.5). Tre trykk og synlig. Alternativet har ingen ny knapp, men gjemmer fravær bak prosjektfeltet. |
| **F3** | **Timer eller klokkeslett på fravær?** | **Bare timer,** forhåndsutfylt med resten av normen (U3). Klokkeslett på fravær gir ingen lønnsmessig verdi og ville gi overlapp-varsler mot arbeid. |
| **F4** | **Skal fravær kreve beskrivelse?** I dag kreves det på alt som ikke er reise (FM13). | **Nei.** Lønnsarten sier hva det er. Unntaket for reise utvides til fraværskortet. |
| **F5** | **Når fraværskortet finnes: skal fravær-artene ut av lønnsartvalget på prosjektkortets linjer (a3)?** | **Ja, fra c.** Da har fravær ett hjem, og prosjektets timer inneholder ikke fravær. Rader som alt er ført slik, blir stående. Dette fjerner en mulighet a3 nettopp ga («inntil videre») — derfor spørsmål. |
| **F6** | **Dagskort-modus** (firma uten prosjektkort): vise fravær uten prosjekt nå og la oppretting vente, eller gi skjermen «+ Fravær» med en gang? | **Vise nå, opprette senere.** Skjermen er vernet (dagskort isolert). Fravær kan fortsatt føres der med prosjekt som i dag. |
| **F7** | **Sperre endring av lønnsartens type** bort fra fravær når arten står på en rad uten prosjekt? | **Ja.** Ellers kan en arbeidsart stå uten prosjekt etter en endring i oppsettet. Firmaet lager en ny lønnsart i stedet. |
| **F8** | **Fravær over flere dager** (ferie, sykemelding): ett trykk pr. dag, eller «gjelder til og med dato»? | **Ikke i denne runden.** Én dag om gangen nå; flerdagers fravær som egen ordre etter d. |

**Låser ordre b: F1** (F7 kan tas ved gate som anbefalt). **Låser ordre c: F2–F5.** F6 og F8 kan vente.
Følger av B8 og bygges uten ny beslutning med mindre Kenneth sier nei: F-F1 (overtidsgrunnlaget på server teller
ikke fravær) og at dagens sum viser arbeid og fravær hver for seg.
