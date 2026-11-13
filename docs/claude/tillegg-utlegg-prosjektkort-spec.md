---
status: 🟡 UTKAST 2026-11-13 — spec levert til Kenneth via orkestrator; B1–B8 åpne. Ingen kode.
sist_verifisert_mot_kode: 2026-11-13 (develop @ 665806e2 — prosjektkort-utkast C1–C5 `1499458a` og Bekreft dag tillegg/utlegg `3b9e7d0d` merget)
eier: Fabel (spec) → Redesign/kode-Opus (kode)
ordre: «ORDRE — spec: tillegg og utlegg på prosjektkortet med byggeplass/underprosjekt — orkestrator 2026-11-13» (relay/inbox-fabel.md)
---

# Spec — tillegg og utlegg på prosjektkortet, med byggeplass og underprosjekt

> **Status 🟡 UTKAST 2026-11-13.** Alle tall i § 1 er målt mot `develop @ 665806e2`. Specen svarer på de åtte punktene i ordren: § 2 datamodell (1), § 3 mobil (2), § 4 dagskortet (3), § 5 Bekreft dag (4), § 6 web (5), § 7 hjelpetekster/i18n (6), § 8 commit-deling (7), § 10 beslutninger (8). § 9 er gate-testene, § 11 åpne funn utenfor scope. **Ingen kode før Kenneth har svart på B1–B8** — B1 og B2 avgjør skjema og vakter; resten kan vedtas løpende.

## 0. Bestilling

**Kenneth, telefontest 2026-11-13, ordrett** (`relay/inbox-fabel.md`, ordren):

> «denne registreringen må gjøres mot prosjekt og byggeplass/underprosjekt. Utlegg og tillegg må registreres på prosjekt kort ikke på dagskort»

**Hjemmel:** Kenneth 2026-11-13 «Ja til alle fire, Fabel spec på 5 først».

**Fabels lesing av bestillingen** (to setninger, og den andre er kontrollspørsmål B1):

1. Hver tillegg- og utleggsrad skal bære **byggeplass og underprosjekt i tillegg til prosjekt** — altså kortets fulle nøkkel `(prosjekt, byggeplass, underprosjekt)` slik `kortNokkel` definerer den (`apps/mobile/src/lib/prosjektkortMobil.ts:191`).
2. På mobil føres de **på kortskjermen** (`app/timer/[id]/kort/[projectId].tsx`), ikke i dag-seksjonen på samlesiden. «Dagskort» i Kenneths setning leses som *dagsnivået i prosjektkort-modus* (`DagSeksjon`), ikke som det gamle dagskortet `app/timer/[id].tsx`, som er fredet (Kenneth 2026-11-07). Dersom Kenneth faktisk mener at det gamle dagskortet skal miste tillegg/utlegg, er det B1 — det bryter dagskort-vakten og må vedtas eksplisitt.

## 1. Målt tilstand (2026-11-13, develop @ 665806e2)

### 1.1 Datamodell — feltene finnes ikke

`packages/db-timer/prisma/schema.prisma`:

| Entitet | Linje | `projectId` | `byggeplassId` | `externalCostObjectId` |
|---|---|---|---|---|
| `SheetTimer` | :227 | ja | :238 (`String?`, A.30 NULL gyldig) | :245 (svak FK → kjernen) |
| `SheetMachine` | — | ja | ja (36b, uten backfill) | ja |
| `SheetTillegg` | :386 | ja, NOT NULL | **mangler** | **mangler** |
| `SheetUtlegg` | :454 | ja | **mangler** | **mangler** |

`SheetTillegg` har `attestertStatus/attestertSnapshot/parentRadId` (T7-2b2) og indekser på `sheetId`, `tilleggId`, `projectId`, `attestertStatus`, `parentRadId`. `SheetUtlegg` har ingen rad-status, `ordningVedFoering` immutable og CHECK (fakturert ⇒ `belop` null). Vedlegg-tabellene (:424, :486) er uberørt av denne specen.

**Premissen i ordren er riktig:** ingen av feltene finnes, og ingen skrivevei kan ta dem imot.

### 1.2 Dagens design holder tillegg/utlegg bevisst på dagsnivå

Dette er ikke en glipp, men et vedtak fra ORDRE 36b GO 4 (`timer.md` § ORDRE 36b). Specen **reverserer** det vedtaket, med hjemmel i § 0. Stedene som sier «dagsnivå» i dag, og som må endres:

| Sted | Hva den sier |
|---|---|
| `prosjektkort/DagSeksjon.tsx:15-24` | «tillegg og utlegg hører til dagen»; `TilleggSeksjon` :119-126 og `UtleggSeksjon` :128-137 ligger her, under kortene på samlesiden |
| `app/timer/[id]/kort/[projectId].tsx:309` | «Tillegg og utlegg er dagsnivå (ORDRE 36b) — de ligger på samlesiden»; kortskjermen viser dem ikke |
| `prosjektkort/kortRadFlytt.ts:203-212` | «Reise, tillegg og utlegg hører til dagen og røres ikke» (Endre/Slett kort) |
| `useProsjektkortSedel.ts:499`, `prosjektkortMobil.ts:286` | «Tillegg/utlegg/reise … lager ikke kort» |
| `useProsjektkortSedel.ts:436-444` | `utleggAntall` telles pr. **prosjekt**, chip på `ProsjektkortSamleside.tsx:245` |
| `hjelpetekster.md:103` | «Reise, tillegg og utlegg blir liggende på dagen» (Endre kort) |
| `nb.json:5496-5497` | `timer.kort.slettUtkast` / `slettReturnert`: «Reise, tillegg og utlegg beholdes.» |
| `tilleggUtleggSkriv.ts:88` | «Knyttet til sedel + prosjekt, ikke til en arbeidsrad.» |

### 1.3 API-skriveveier (`apps/api/src/routes/timer/dagsseddel.ts`)

| Prosedyre | Linje | Felt i dag | Byggeplass-vask |
|---|---|---|---|
| `tilfoyTilleggRad` | :2942 (input :2944, firmagrense :2965, create :2979) | `{sheetId, projectId, tilleggId, antall, kommentar?}` | nei |
| `oppdaterTilleggRad` | :2993 (update :3026) | `{id, tilleggId?, antall?, kommentar?}` — `projectId` immutable | nei |
| `tilfoyUtleggRad` | :3172 (ordning :3211, create :3249) | `{sheetId, projectId, expenseCategoryId, belop?, kommentar?}` | nei |
| `oppdaterUtleggRad` | :3266 (update :3314) | `{id, belop?, kommentar?}` | nei |
| `redigerSedelRader` | :4548 — tillegg-Zod :4584, create ~:4940 | tillegg `{originalId, projectId, tilleggId, antall, kommentar?}`; timer :4566 / maskin :4596 **har** eco/byggeplass | timer/maskin ja |
| `splittRad` / `splittRadEier` | :5021 / :5258; `splittRadInput` tillegg-variant :1482 | kun `{projectId, tilleggId, antall, kommentar}`; kommentar :1551 «tillegg-rader har ingen» | — |
| `syncBatch` | :5882 — tillegg-Zod :5970, utlegg-Zod :6008, createMany tillegg :6964, utlegg :7002 | ingen byggeplass/ECO; maskin :6984 skriver `byggeplassId: syncMaskinByggeplass.get(m.id) ?? null` via `maskinByggeplassVedSync` | timer :6396, maskin :6402 |
| `hentEndringerSiden` (pull) | :5636 — tillegg-map :5816, utlegg-map :5849 | returnerer ikke feltene; timer :5791-5793 og maskin :5833-5836 gjør det | — |
| `attesterRader` | :4162 (snapshot :4287) | snapshot `{tilleggId, kode, navn, type, prisMotKunde, internkostnad}` | — |

Byggeplass-regler som finnes og skal gjenbrukes (`apps/api/src/routes/timer/byggeplass-rad.ts`): eierskapssjekk :20-25, `lagByggeplassVasker` :48-59 (fremmed byggeplass → null), `krevByggeplasserIProsjekt` :67-77 (BAD_REQUEST når byggeplassen ikke tilhører radens prosjekt), `maskinByggeplassVedSync` :87-93 (`vask(m.byggeplassId ?? sedelByggeplass)`).

Kommentar `dagsseddel.ts:6840`: tillegg/maskin/utlegg er **ikke versjonert** → full payload-replace pr. sedel (deleteMany :6852/:6865 + createMany). Nye felt følger samme vei uten ny konfliktbane.

### 1.4 Mobil — sync og lokalt skjema

- `apps/mobile/src/db/schema.ts`: `sheetTilleggLocal` :240-249 (`id, dagsseddelId, projectId, tilleggId, antall, kommentar, sistEndretLokalt`), `sheetUtleggLocal` :311-321 (+ `expenseCategoryId, belop, ordningVedFoering, foertVed`). Ingen byggeplass/ECO. `sheetTimerLocal` :153/:158 og `sheetMachineLocal` :208-238 har begge.
- `apps/mobile/src/db/migreringer.ts`: additivt mønster `KORTVALG_LOCAL_KOLONNER` :1451 + idempotent `ALTER TABLE … ADD COLUMN` :1392-1401, test `migreringer.kortvalgLocal.test.ts`.
- `apps/mobile/src/services/timerSync.ts`: push tillegg :819-826 `{id, projectId (fallback sedel), tilleggId, antall, kommentar}`, utlegg :850-861; pull insert tillegg :1412-1450, utlegg :1482-1525 (hopper over rader med levende tombstone). Kompat-kommentarer :761/:794: gammel server **stripper ukjente felt stille**.
- `KortRad` (`prosjektkortMobil.ts:231-235`) er `{projectId, byggeplassId?, externalCostObjectId?}` — `raderPaaKort` :335 og `kortNokkelFor` :246 virker på enhver rad med disse feltene. Tillegg/utlegg-rader passer så snart kolonnene finnes.
- Skrivere: `tilleggUtleggSkriv.ts` `NyttLonnstillegg` :90-96 / `skrivLonnstillegg` :99-111, `NyttUtlegg` :20-29 / `skrivUtlegg` :38-84 (delt av prosjektkortet og Bekreft dag). `TilleggSeksjon.leggTil` :68-91, `UtleggSeksjon` → `skrivUtlegg` :629-646.
- `SplittRadModal.tsx` tillegg-gren :350-381: lokal Drizzle-splitt av `antall`; delene arver `projectId/tilleggId/kommentar` fra originalen (:371-379). Utlegg har ingen Del-knapp.
- Utkast C1–C5 (`prosjektkortUtkast.ts:25-35`): `UtkastData.lonnUtlegg = {tillegg: NyttLonnstillegg[], utlegg: NyttUtlegg[]}` + `valgtByggeplassId` og `ecoId` på **dagsnivå**.

### 1.5 Bekreft dag (`3b9e7d0d`)

- `app/timer/bekreft-dag.tsx`: `lonnUtlegg`-state :190; `lonnUtleggProsjekt = prosjektMedFlestTimer(forslag)` :392-394; `arbeidKort = kortMedArbeid(forslag)` :396-399 gir `(prosjekt, effektiv byggeplass)` pr. kort med `ecoId: null` (`beskrivelseKort.ts:29-35`, :38-58); dagens underprosjekt `ecoId` finnes kun i manuell modus :477-517 (`ecoId: manuell ? ecoId : null`).
- `BekreftDagLonnUtlegg.tsx`: props `verdi, onEndre, defaultProjectId` :21-32; gjenbruker `TilleggRadModal` :104-118 og `UtleggRadModal` med `onOpprett` :119-134. Vedlegg på tillegg legges til etterpå i prosjektkortet (B1 i den ordren).
- `dagsforslagAnvend.ts:258-271`: linjene skrives på `forsteLagredeSheetId` (første dato som ikke er sendt) uten byggeplass/ECO; timer-rader :195-215 får `radEco = rad.erReise ? null : ctx.ecoId`, `radByggeplass = rad.erReise ? rad.byggeplassId : (rad.byggeplassId ?? eksplisittByggeplassId)`.
- Stopp `tilleggUtleggUtenDag` (`bekreftDag.ts:210-214`, :250-254) — beholdes.

### 1.6 Dagskortet (fredet)

- `app/timer/[id].tsx`: tillegg/utlegg leses :253-272, grupperes pr. prosjekt i `ProsjektGruppe` :1248-1273 med filter `(r.projectId ?? sedel.projectId) === pid` (:1267/:1269). Kommentar :1246: SheetTillegg har ingen ECO.
- `ProsjektGruppe.tsx`: `TilleggSeksjon` :210-217 og `UtleggSeksjon` :220-227 ligger **utenfor** ECO-bøttene (:122-146), uten `hjelpIkon`/`prosjektValg`.
- Vakt `dagskort-isolert-vakt.test.ts`: forbudte strenger (`prosjektValg=`, `reise=`, `DagSeksjon`, `KortValgModal`, `ProsjektkortKontekst`, `kortRadFlytt`, BEKREFT_DAG_PROPS), frosset JSX-tagg-hash `DAGSKORT_TAGG_HASH = "2e7dc562…"`, `UTLEGG_CHIPS`-vilkår, `prosjektkortKontekst.ts` `createContext<KortLaas | boolean>(false)`, negativkontroll. Også `prosjektkort-glue-vakt.test.ts:20-40` (like antall `db.delete(sheetTilleggLocal)` / `db.delete(sheetUtleggLocal)` i dagskort og `useProsjektkortSedel`) og `kenneth-1211-vakt.test.ts:117` (TilleggSeksjon viser ikke prosjektnummer).

### 1.7 Web-lesere

| Fil | Linje | Hva den gjør med tillegg/utlegg i dag |
|---|---|---|
| `apps/web/src/app/dashbord/timer/[id]/page.tsx` | :532-584 | timer/maskin grupperes pr. `(projectId, externalCostObjectId)`; tillegg/utlegg kun pr. prosjekt (`tilleggPerProsjekt`, `utleggPerProsjekt`); kommentar :533 «ingen ECO-felt på SheetTillegg» |
| samme | `TilleggRadDialog` :3409 (mutate :3553-3555), `UtleggRadDialog` :4062 (mutate :4202-4204) | uten byggeplass/underprosjekt; timer-dialogen :2829-2997 har begge |
| `components/timer/AttesteringDetalj.tsx` | :116, :481 | tillegg-rader gruppert pr. prosjekt, ingen ECO |
| `components/timer/AttesteringDetalj_Edit.tsx` | :355, :379-380 | tillegg-payload uten felt; timer :349-350 sender eco/bp |
| `components/attestering/RedigerRadModal.tsx` | :189, :412 | tillegg uten ECO; timer/maskin `byggeplassId: null` :395/:406 |
| `components/attestering/attestering-buckets.tsx` | :321, :506; ECO-redigering kun timer :199, :247-273 | — |
| `AttesteringPivot.tsx` :60/:88-89, `SeddelKort.tsx` :77/:81/:582/:746, `DagsKort.tsx` :57-58/:91-96/:273-298, `SplittRadModal.tsx:189`, `RedigerTilleggRad.tsx:21` | | visning/redigering uten feltene |
| `app/dashbord/firma/timer/attestering/page.tsx` :75/:78/:202/:212, `[prosjektId]/timer/attestering/page.tsx:46` | | typer fra `hentTilAttesteringFirma` :3605 (tillegg :3680, utlegg :3691) |
| `hentForAttestering` | `dagsseddel.ts:3878` | returnerer tillegg (:3895), **ikke utlegg** (F2) |
| `flyttTimerRadEco` | `dagsseddel.ts:4050` | kun timer |

### 1.8 Eksport, rapport, økonomi

- `apps/api/src/routes/timer/rapport.ts`: `detaljEksport` :317 — tillegg-rader :622 `{id, dato, ansatt, ansattnr, prosjekt, tillegg, antall, kommentar, radstatus}`, utlegg :637 `{…, kategori, belop, kommentar, seddelstatus}`; byggeplass hentes i dag kun for reise-stedsnavn :481-499/:523. Kommentar :311-315: «ny dimensjon = én kolonne + ett filter. Ikke bygget nå.» `firmaPeriodeRapport` :99 har død include av tillegg :168 (F3). `pdfEksport` :670.
- `packages/shared/src/utils/timerDetaljRader.ts`: kildetyper :77/:88, `byggDetaljRader` tillegg-løkke :312, utlegg :356, `TIMER_KOL_KEYS` :477 (ingen byggeplass/ECO for noen radtype), `grupperDetaljRader` :733.
- `apps/api/src/routes/timer/eksportOppsett.ts`: `KOLONNE_KEYS` ~:50, radTyper :62. `apps/web/src/lib/timer-rapport-eksport.ts`: typer :138/:149, `EXCEL_KOL` ~:452, `byggDetaljerArk` :508. `packages/pdf/src/timer-rapport.ts` :38, :160-161, :286-289. `rapport/page.tsx` :383/:594/:534/:1421, `TimerRapportDetaljer.tsx` :49/:118.
- **Faktura/økonomi:** ingen leser av `SheetTillegg`/`SheetUtlegg` utenfor timer-ruter. Attestering-snapshotets `prisMotKunde/internkostnad` (:4298-4299, :5545-5546) leses av ingen kode (F3). `apps/api/src/services/eksport/filer.ts:186-219` (prosjekt-/arkiveksport) finner rader pr. `projectId` og eksporterer vedlegg — uberørt.
- Andre skrivere (seed `services/seed/index.ts:226/:239`, `importerKatalog.ts:271/:355-376`, `routes/admin.ts:1048`, `routes/onboarding.ts:44`): nullable kolonner → ingen endring.

### 1.9 i18n og hjelpetekster

`packages/shared/src/i18n/nb.json` (15 språk, `en.json` master): `hjelp.tillegg.tittel/tekst` :5504-5505, `hjelp.utlegg.tittel/tekst` :5506-5507, `timer.bekreftDag.tilleggUtlegg.utenDagTekst` :5509 («…Fjern dem, eller før dem i prosjektkortet.»), `timer.kort.slettUtkast/slettReturnert` :5496-5497, `timer.utleggReg.leggTilTittel` :503 «Legg til på dagsseddelen», `timer.prosjektkort.kolonne.utlegg` :356. `timer.prosjektkort.leggTil` :366 («+ Tillegg/Utlegg») brukes ikke i kode (død nøkkel). `hjelpetekster.md` § Mobil: Prosjektkortet :96-107, § Mobil: Tillegg og Utlegg :109-121.

`benytterUnderprosjekt` (36d-2, `maskin-vare-kontroll-spec.md` § 3) finnes ikke i kode ennå — underprosjekt-feltet styres i dag av om prosjektet har underprosjekter (`TimerSeksjon.tsx:1242-1245`).

## 2. Datamodell (punkt 1)

### 2.1 Valg: to nullable kolonner på hver rad — ikke kobling til timerrad

**Anbefaling:** `byggeplassId String?` og `externalCostObjectId String?` på både `SheetTillegg` og `SheetUtlegg`, samme type, `@map` og svak-FK-stil (A.20) som `SheetTimer` :238/:245, med `@@index([byggeplassId])` og `@@index([externalCostObjectId])`.

Hvorfor kolonner, ikke kobling til prosjektkort eller timerrad:

1. **Kortet har ingen DB-identitet.** Kortet er avledet: `kortNokkel = projectId|byggeplassId|ecoId` (`prosjektkortMobil.ts:191`). Å gi tillegg/utlegg de samme tre feltene *er* å knytte dem til kortet — det er slik timer, maskin og varer er knyttet. En egen korttabell ville være ny arkitektur utenfor bestillingen.
2. **Kobling til timerrad bryter.** Tillegg/utlegg kan finnes uten arbeidsrad (parkering på vei til møte; kosttillegg på reisedag), og en timerrad kan splittes, slettes eller erstattes ved attestering (`parentRadId`) — koblingen måtte vedlikeholdes i alle de veiene. Tillegg er i dag eksplisitt «ikke til en arbeidsrad» (`tilleggUtleggSkriv.ts:88`).
3. **Same mønster som 36b maskin-byggeplass**, som Kenneth GO-et 2026-11-07 § 7 (ingen backfill, SQLite OK).

### 2.2 Semantikk

- `byggeplassId = NULL` betyr «arver sedelens byggeplass» (A.30, `fase-0-beslutninger.md:752`) — identisk med timer/maskin. Effektiv byggeplass regnes med `effektivByggeplass`/`kortValgFor` på mobil og tilsvarende på server.
- `externalCostObjectId = NULL` betyr «uten underprosjekt» (hovedgruppa i web-sedelen).
- Server-validering i **alle** skriveveier i § 1.3: `krevByggeplasserIProsjekt` på tillegg- og utleggsrader (BAD_REQUEST når byggeplassen ikke tilhører radens prosjekt); i `syncBatch` samme arv og vask som maskin (`maskinByggeplassVedSync`: utelatt/null → sedelens byggeplass vaskes, fremmed → null). ECO valideres som for timer (`verifiserProsjekterTilhørerFirma` på prosjekt; ECO må tilhøre prosjektet — gjenbruk timer-sjekken i `redigerSedelRader`).
- `SheetUtlegg`-CHECK og `ordningVedFoering`-immutabilitet er uberørt.

### 2.3 Migrering

Én Prisma-migrering i `packages/db-timer` (Kenneth kjører `pnpm db:migrate`, test før prod):

```sql
ALTER TABLE timer.sheet_tillegg ADD COLUMN byggeplass_id text, ADD COLUMN external_cost_object_id text;
ALTER TABLE timer.sheet_utlegg  ADD COLUMN byggeplass_id text, ADD COLUMN external_cost_object_id text;
-- + fire indekser
```

- To-stegs-policy: dette er steg 1 (nullable, additivt). **Steg 2 (NOT NULL) kommer aldri**, fordi NULL er en gyldig tilstand (arv) — som for `SheetTimer.byggeplassId` :237 «Forblir nullable (A.30)».
- **Backfill: ingen (anbefalt, B2).** Begrunnelse mot «stille tomhet er forbudt» (`arkitektur.md:417-426`): regelen gjelder identitets-/koblingskolonner der tomhet er feil. Her har NULL en definert betydning som er *nøyaktig det raden betydde da den ble ført*: «hele prosjektet / sedelens byggeplass». En backfill måtte velge mellom (a) hardkodet verdi på alle rader — forbudt av backfill-disiplinen, og (b) diskriminerende `WHERE sedelen har nøyaktig ett kort` — som dikter opp et kortvalg brukeren aldri gjorde, og som på dager med flere kort likevel må la raden stå NULL. Konsekvens for eksisterende rader på dager med flere byggeplasser/underprosjekter: de blir stående NULL, vises på web under hovedgruppa for prosjektet og på mobil som før (dagskortet) — på kortskjermen vises de på kortet som arver sedelens byggeplass og har underprosjekt null (det første kortet pr. prosjekt). Ingen rad forsvinner.
- Test som følger migreringen (§ 9 T1): antall rader i `sheet_tillegg`/`sheet_utlegg` før = etter, alle nye kolonner NULL, indekser finnes. Det er den «test som feiler når tom»-ekvivalenten denne kolonnen kan ha: den skal feile hvis migreringen rører data.

## 3. Mobil (punkt 2)

### 3.1 Hvor tillegg og utlegg føres: kortskjermen

- `app/timer/[id]/kort/[projectId].tsx`: linje :309 fjernes; to nye seksjoner «Tillegg» og «Utlegg» under varer, med `kTillegg = raderPaaKort(tilleggRader, kontekst, valg)` og `kUtlegg = raderPaaKort(utleggRader, kontekst, valg)` (:306-308-mønsteret). `tomt` (:310) teller også disse. Seksjonene gjenbruker `TilleggSeksjon`/`UtleggSeksjon` med `hjelpIkon` (som `DagSeksjon` :119-137 gjør i dag) — flyttet, ikke nyskrevet.
- `prosjektkort/DagSeksjon.tsx` beholder **reise** (:170-199) og mister `TilleggSeksjon`/`UtleggSeksjon` (:119-137) og `forslagProsjekt` (:60-76, bare brukt av dem).
- Samlesiden: chip `timer.prosjektkort.kolonne.utlegg` (`ProsjektkortSamleside.tsx:245`) teller pr. **kort** — `utleggAntall` (`useProsjektkortSedel.ts:436-444`) nøkles på `kortNokkelFor(r, sedel)` i stedet for `projectId`. Tilsvarende tillegg-chip er ny (B5-uavhengig; anbefalt: ja, «Tillegg n», ellers ser ikke brukeren på samlesiden at kortet bærer tillegg).
- Kommentarene i § 1.2 (`kort/[projectId].tsx:309`, `kortRadFlytt.ts:203-212`, `useProsjektkortSedel.ts:499`, `prosjektkortMobil.ts:286`) oppdateres til «reise hører til dagen; tillegg og utlegg er kortets rader».

### 3.2 Arv fra kortet

Nye rader får kortets nøkkel på samme måte som timer-rader i `radLagring.ts:85-95`:

| Felt | Verdi ved føring på kortet |
|---|---|
| `projectId` | `valg.projectId` |
| `byggeplassId` | `lagretByggeplassForKort(valg, kontekst)` — null når kortets byggeplass er sedelens (arv), ellers kortets |
| `externalCostObjectId` | `valg.ecoId` |

Mekanisme: `TilleggRadModal` (`TilleggSeksjon.tsx:512`) og `UtleggRadModal` (`UtleggSeksjon.tsx:477`) leser `useKortLaas()` som `TimerRadModal` gjør (`TimerSeksjon.tsx:1250-1259`, :1292-1296): på kortet er prosjekt, byggeplass og underprosjekt **låst og grå** (:1880-1881/:2006-mønsteret), utenfor kortet (dagskort, Bekreft dag) er `useKortLaas()` `null` og feltene får `null` → dagens atferd. `onLagre` utvides med `byggeplassId: string | null, externalCostObjectId: string | null`; `leggTil` (:68-91), `oppdater` (:93-116), `skrivLonnstillegg`, `skrivUtlegg` og typene `NyttLonnstillegg`/`NyttUtlegg` bærer feltene.

Underprosjekt-feltet vises etter samme regel som timer (`TimerSeksjon.tsx:1242-1245`: når prosjektet har underprosjekter) inntil 36d-2 `benytterUnderprosjekt` er bygget; da følger det den innstillingen som timer/maskin/varer.

### 3.3 «Del»-knappen (pil-ikonet, `Split`)

`SplittRadModal.tsx` tillegg-gren :371-379: insert kopierer i tillegg `byggeplassId` og `externalCostObjectId` fra originalen. Delene blir på kortet. **Anbefaling B5:** knappen beholdes med denne ene endringen — Del deler antall (f.eks. 2 kosttillegg → 1 + 1), og flytting til et annet kort gjøres ved å redigere raden eller med «Endre kort». Å gi hver del eget underprosjekt som timer-splitt (:72-84) er mulig, men ikke bestilt.

### 3.4 «Endre kort» og «Slett kort» (`kortRadFlytt.ts`)

**Anbefaling B4:** tillegg og utlegg **følger kortet** — de er nå kortets rader. Endre kort setter målkortets nøkkel på dem (sammenslåing på datanivå som timer/maskin); Slett kort sletter dem med tombstone (`slettedeRaderLocal`, radType `tillegg`/`utlegg`, som `fjern` i :118-140/:126-146). Konsekvens: hjelpeteksten og `timer.kort.slettUtkast/slettReturnert` endres til «Reise beholdes.» (§ 7). `prosjektkort-glue-vakt.test.ts:20-40` forventer like antall `db.delete(sheetTilleggLocal)`/`db.delete(sheetUtleggLocal)` i dagskort og `useProsjektkortSedel` — `kortRadFlytt` kommer i tillegg og må legges inn i vakten eksplisitt (ikke endre dagskort-tallet).

### 3.5 Lokal SQLite og offline

- `schema.ts`: `byggeplassId`, `externalCostObjectId` (nullable text) på `sheetTilleggLocal` :240-249 og `sheetUtleggLocal` :311-321.
- `migreringer.ts`: fire nye par i `KORTVALG_LOCAL_KOLONNER` :1451 (`sheet_tillegg_local`/`sheet_utlegg_local` × `byggeplass_id`/`external_cost_object_id`); idempotent ALTER :1392-1401 dekker dem; `migreringer.kortvalgLocal.test.ts` utvides.
- Offline: feltene er lokale kolonner som pushes i samme full-replace-payload som i dag. Ingen ny konflikt- eller versjonsbane.

### 3.6 Sync og gamle klienter

- Push (`timerSync.ts` :819-826, :850-861): `byggeplassId: tl.byggeplassId ?? null, externalCostObjectId: tl.externalCostObjectId ?? null`.
- Server `syncBatch`: Zod :5970/:6008 får `byggeplassId: z.string().uuid().nullable().optional()`, `externalCostObjectId: …optional()`; createMany :6964/:7002 skriver dem via en `syncTilleggByggeplass`/`syncUtleggByggeplass` bygd som `maskinByggeplassVedSync` (:6402-mønsteret) — utelatt = arv = null, fremmed → null.
- Pull: `hentEndringerSiden` :5816/:5849 returnerer feltene; `timerSync.ts` insert :1412-1450/:1482-1525 mapper dem.
- **Gammel klient mot ny server:** sender ikke feltene → Zod optional → NULL = arv. Pull ignorerer ukjente felt. Ingen brudd.
- **Ny klient mot gammel server:** feltene strippes stille (:761/:794) — rader mister byggeplass/underprosjekt uten feil. Derfor rekkefølgen i § 8: API deployes **før** OTA. Ingen router-rename → ingen alias nødvendig.
- Web viser NULL-rader som før (hovedgruppa).

## 4. Dagskortet (punkt 3) — uendret, vakt utvidet

**Hva endres i dagskortet: ingenting.** `app/timer/[id].tsx` og `ProsjektGruppe.tsx` sender ingen nye props; `TilleggRadModal`/`UtleggRadModal` uten kort-kontekst skriver `byggeplassId: null, externalCostObjectId: null`, som er dagens rad. Rader ført på et kort vises i dagskortet under prosjektgruppa (filter :1267/:1269 bruker bare `projectId`) uten byggeplass-/underprosjekt-etikett — **B3**, anbefalt nei til etikett: dagskortet er fredet, JSX-hashen er frosset, og dagskort-modus avvikles bak flagg.

Vakten `dagskort-isolert-vakt.test.ts` utvides (negativkontroll på hver):

1. `DAGSKORT_TAGG_HASH` uendret — bevis på at JSX-treet ikke er rørt.
2. Nye forbudte strenger i `app/timer/[id].tsx` og `ProsjektGruppe.tsx`: `useKortLaas`, `byggeplassId=` og `ecoId=` på `TilleggSeksjon`/`UtleggSeksjon`-kallene, `raderPaaKort`.
3. Enhetstest: `TilleggSeksjon.leggTil` og `skrivUtlegg` uten kort-kontekst skriver `byggeplassId: null, externalCostObjectId: null` (default-grenen = dagens insert).
4. `kenneth-1211-vakt.test.ts:117` (ingen prosjektnummer i TilleggSeksjon) og `UTLEGG_CHIPS`-vilkåret står.

## 5. Bekreft dag (punkt 4) — beholdes, med kortvalg pr. linje

**Anbefaling B6: beholde** Bekreft dag-veien (merget i dag, `3b9e7d0d`, bestilt av Kenneth) og gi hver linje et kort. Å fjerne den og sende brukeren til kortskjermen etterpå gir to steg der Kenneth ba om ett.

- `BekreftDagLonnUtlegg.tsx` får `kort: BeskrivelseKort[]` (= `arbeidKort`, `bekreft-dag.tsx:396-399`) i stedet for bare `defaultProjectId`. Én kort: ingen valg vises, linja arver det. Flere kort: chips pr. linje (samme mønster som underprosjekt-chips :1166-1171 / `UTLEGG_CHIPS`), default = kortet med flest timer (`prosjektMedFlestTimer` :392-394 byttes til kort-varianten).
- Felt på linja: `projectId` og `byggeplassId` fra kortet (`kortMedArbeid` gir effektiv byggeplass, :46); `externalCostObjectId = ctx.ecoId` — dagens ene underprosjekt (`ecoId: manuell ? ecoId : null`, :477-517), nøyaktig som timer-radene får i `dagsforslagAnvend.ts:195-215`. Når 36d-2 § 3.9 gir underprosjekt pr. kort, følger linja kortet.
- `dagsforslagAnvend.ts:258-271`: `skrivLonnstillegg`/`skrivUtlegg` skriver feltene. Sedelen er fortsatt `forsteLagredeSheetId` (første åpne dato); stoppen `tilleggUtleggUtenDag` står.
- Utkast C2: `UtkastData.lonnUtlegg` bærer feltene gjennom de utvidede typene; gamle utkast uten felt leses som null (arv) — ingen migrering av utkast.
- Manuell modus uten GPS-forslag har ett kort (prosjekt + valgt byggeplass + ecoId) — linja arver det.

## 6. Web (punkt 5)

| Fil:linje | Må gjøre med nye felt |
|---|---|
| `dagsseddel.ts` `tilfoyTilleggRad` :2944/:2979, `tilfoyUtleggRad` :3174/:3249 | Zod `byggeplassId?`/`externalCostObjectId?` nullable; `krevByggeplasserIProsjekt`; skriv |
| `oppdaterTilleggRad` :2993/:3026, `oppdaterUtleggRad` :3266/:3314 | samme to felt valgfrie i update; vask mot radens prosjekt |
| `redigerSedelRader` tillegg-Zod :4584, create ~:4940 | som timer :4566/:4924-4926 (`?? null`) |
| `splittRadInput` tillegg :1482, `splittRad` :5170, `splittRadEier` :5379 | delene arver feltene (som timer :5144/:5202) |
| `syncBatch` :5970/:6008/:6964/:7002, `hentEndringerSiden` :5816/:5849 | § 3.6 |
| `hentTilAttesteringFirma` :3680/:3691, `hentTilAttestering` :3555, `hentForAttestering` :3895, `hentMedId` :1750/:1761 | select + returner feltene |
| `attesterRader` :4287 snapshot | ingen endring (snapshot er lønnsart-data, ikke sted) |
| `flyttTimerRadEco` :4050 | **B7:** generaliseres til tillegg (attestant retter underprosjekt) — anbefalt ja, liten |
| `app/dashbord/timer/[id]/page.tsx` :532-584 | tillegg/utlegg inn i `ecoGrupper` pr. `(projectId, externalCostObjectId)` som timer/maskin; kommentar :533 fjernes |
| samme `TilleggRadDialog` :3409/:3553, `UtleggRadDialog` :4062/:4202 | byggeplass- og underprosjekt-velger som timer-dialogen :2829-2997; sender feltene |
| `AttesteringDetalj.tsx` :116/:481, `_Edit.tsx` :355/:379, `RedigerRadModal.tsx` :189/:412, `attestering-buckets.tsx` :321/:506, `AttesteringPivot.tsx` :60/:88, `SeddelKort.tsx` :77/:81/:582/:746, `DagsKort.tsx` :57-58/:91-96/:273-298, `SplittRadModal.tsx:189`, `RedigerTilleggRad.tsx:21` | typer bærer feltene; gruppering pr. `(prosjekt, underprosjekt)` der timer alt grupperes slik; rediger-payload sender dem |
| `rapport.ts` `detaljEksport` :622/:637 | nye felt `byggeplass` (navn, effektiv: rad ?? sedel) og `underprosjekt` (navn) på radene; byggeplass-navn lastes alt for reise :481-499, ECO-navn må hentes fra kjernen |
| `timerDetaljRader.ts` :77/:88/:312/:356/:477, `eksportOppsett.ts` `KOLONNE_KEYS`, `timer-rapport-eksport.ts` :138/:149/:452/:508, `packages/pdf/src/timer-rapport.ts` :160-161/:286-289 | to nye kolonner `byggeplass`, `underprosjekt` — **B8:** for alle radtyper (anbefalt; rapport.ts:313 er designet for «én kolonne + ett filter») eller kun tillegg/utlegg |
| `timer/mine/page.tsx:185`, `[prosjektId]/timer/page.tsx:62`, `utleggskategorier/page.tsx:64` | lister; ingen plikt, kan vise feltene senere |
| `services/eksport/filer.ts:186-219`, seed/import/admin/onboarding (§ 1.8) | ingen endring |

Lønnseksport eksporterer i dag `radstatus`/`seddelstatus` uten sted; faktura/økonomi leser ikke tabellene (§ 1.8). Konsekvens: nye felt endrer **ingen** beløp — de er dimensjoner for kontroll og filtrering, ikke for beregning.

## 7. Hjelpetekster og i18n (punkt 6)

nb + en skrives for hånd, de 13 andre genereres med `--only` (rutine `shared-pakker.md § i18n`).

| Nøkkel | Endring (nb-forslag) |
|---|---|
| `hjelp.tillegg.tekst` :5505 | + «Tillegget føres på prosjektkortet og får kortets prosjekt, byggeplass og underprosjekt.» |
| `hjelp.utlegg.tekst` :5507 | + «Utlegget føres på prosjektkortet og får kortets prosjekt, byggeplass og underprosjekt.» |
| `timer.kort.slettUtkast` :5496 | «Seddelen blir værende som utkast hos deg. Leder har ikke fått den. Reise beholdes.» (B4) |
| `timer.kort.slettReturnert` :5497 | «Reise beholdes. Leder ser endringen når du sender seddelen på nytt.» (B4) |
| `timer.bekreftDag.tilleggUtlegg.utenDagTekst` :5509 | «…Fjern dem, eller før dem på prosjektkortet.» (preposisjon) |
| `timer.utleggReg.leggTilTittel` :503 | ny nøkkel `timer.utleggReg.leggTilKortTittel` «Legg til på kortet» brukt når `useKortLaas()` er satt; dagskortet beholder «Legg til på dagsseddelen» |
| `timer.prosjektkort.kolonne.tillegg` (ny) | «Tillegg» — chip på samlesiden (§ 3.1) |
| `timer.prosjektkort.leggTil` :366 | død nøkkel — slettes i samme commit |
| `timer.bekreftDag.lonnUtlegg.kortValg` (ny) | «Kort» — etikett for chips pr. linje (§ 5) |

Docs i samme commit: `hjelpetekster.md` :103 («Reise blir liggende på dagen») og § :109-121 (HjelpIkon-stedene: kortskjermen i stedet for `DagSeksjon`; ny setning om kortets nøkkel); `timer.md` § ORDRE 36b GO 4, § Bekreft dag tillegg/utlegg, § sheet_tillegg (:1618-1640) og § sheet_utlegg (:1768-1810) med de nye kolonnene; `mobil.md` (sync-felt); `arkitektur.md` nevner ikke timer-tabellene i detalj — ingen endring. `FUNKSJONSENDRINGER.md` føres av orkestrator ved merge.

## 8. Commit-deling (punkt 7)

Én branch `feat/timer-tillegg-utlegg-kort`, seks commits, docs i hver (regel «kode + docs i samme commit»). Rekkefølgen er også deploy-rekkefølgen.

| # | Commit | Innhold | Gate-test (§ 9) |
|---|---|---|---|
| 1 | `feat(db-timer): byggeplass og underprosjekt på sheet_tillegg/sheet_utlegg` | schema + migrering + T1. **Kenneth kjører migreringen** (test → prod). Kolonnene er nullable; ingen kode avhenger ennå | T1 |
| 2 | `feat(api): tillegg/utlegg bærer byggeplass og underprosjekt` | § 6 API-rader: Zod, vask, sync, pull, rediger, splitt, attestering-select, eksportfelt. Deployes til test **før** OTA | T2–T4 |
| 3 | `feat(mobil): lokalt skjema og sync for byggeplass/underprosjekt på tillegg og utlegg` | `schema.ts`, `migreringer.ts`, `timerSync` push/pull, `tilleggUtleggSkriv`-typer. Ingen UI | T5–T6 |
| 4 | `feat(mobil): tillegg og utlegg føres på prosjektkortet` | kortskjerm, `DagSeksjon`, modaler m/ `useKortLaas`, Del, `kortRadFlytt`, samleside-chips, i18n, vakter (§ 4) | T7–T11 |
| 5 | `feat(mobil): Bekreft dag fører tillegg og utlegg pr. kort` | `BekreftDagLonnUtlegg`, `dagsforslagAnvend`, utkast-typer | T12 |
| 6 | `feat(web): byggeplass og underprosjekt på tillegg/utlegg i sedel, attestering og eksport` | § 6 web-rader, eksportkolonner | T13 |

Én Kontrollør-gate pr. leveranse. **Anbefaling:** én leveranse (hele branchen), fordi commit 1 alene ikke er synlig for noen, og commit 2–6 uten 1 ikke kan kjøres. Vil Kenneth kjøre migreringen tidlig, kan 1+2 merges først som egen leveranse (gate-tall måles da to ganger — avvik fra «mål aldri to ganger», men styrt av Kenneth).

## 9. Tester som skal feile før kode (gate)

| # | Test | Feiler i dag fordi |
|---|---|---|
| T1 | migrering: radantall før = etter, nye kolonner NULL, indekser finnes | kolonnene finnes ikke |
| T2 | `tilfoyTilleggRad`/`tilfoyUtleggRad` med byggeplass fra annet prosjekt → BAD_REQUEST | ingen vask |
| T3 | `syncBatch` rundtur: felt inn = felt ut i `hentEndringerSiden`; utelatt felt → NULL (gammel klient) | feltene strippes |
| T4 | `redigerSedelRader`/`splittRad` tillegg: deler arver byggeplass/ECO | Zod avviser/ignorerer |
| T5 | `migreringer.kortvalgLocal.test.ts`: fire nye kolonner, idempotent | mangler i `KORTVALG_LOCAL_KOLONNER` |
| T6 | `timerSync` push-payload inneholder feltene; pull mapper dem | mangler |
| T7 | `raderPaaKort(tilleggRader, …)` gir kortets tillegg; kortskjerm-innhold teller dem | kolonner mangler |
| T8 | `SplittRadModal` tillegg: delene har originalens byggeplass/ECO | insert kopierer ikke |
| T9 | `kortRadFlytt`: Endre kort flytter tillegg/utlegg; Slett kort tombstoner dem (B4) | «røres ikke» |
| T10 | `dagskort-isolert-vakt` utvidet (§ 4, med negativkontroll); `DAGSKORT_TAGG_HASH` uendret | nye strenger ikke i lista |
| T11 | `TilleggSeksjon.leggTil`/`skrivUtlegg` uten kort-kontekst skriver `null, null` | feltene finnes ikke |
| T12 | `dagsforslagAnvend`: lonnUtlegg-rader får kortets byggeplass og dagens ECO | skrives uten |
| T13 | `byggDetaljRader`: tillegg/utlegg-rad har `byggeplass`/`underprosjekt`; eksportark har kolonnene | `TIMER_KOL_KEYS` mangler |

## 10. Beslutninger for Kenneth

| # | Spørsmål | Anbefaling | Alternativ |
|---|---|---|---|
| **B1** | «Ikke på dagskort»: skal det gamle dagskortet (`app/timer/[id].tsx`) fortsatt kunne føre tillegg/utlegg? | **Ja, urørt** — det er fredet 2026-11-07, avvikles bak flagg, og rader derfra får NULL = arv | Fjerne seksjonene fra dagskortet → bryter JSX-hashen, ny vakt-hash |
| **B2** | Backfill av eksisterende rader? | **Ingen** (§ 2.3) — NULL betyr det raden betydde | Diskriminerende backfill der sedelen har ett kort |
| **B3** | Dagskortet viser byggeplass/underprosjekt-etikett på tillegg/utlegg ført fra kort? | **Nei** | Ja → JSX-endring i fredet skjerm |
| **B4** | Endre/Slett kort tar med tillegg og utlegg? | **Ja** — de er kortets rader; «Reise beholdes» | Nei → rader blir stående på et kort som ikke finnes |
| **B5** | Del-knappen på tillegg | **Beholdes**, delene arver kortet | Fjernes; eller eget underprosjekt pr. del som timer |
| **B6** | Bekreft dag | **Beholdes** med kortvalg pr. linje (§ 5) | Fjernes; brukeren fører på kortskjermen etterpå |
| **B7** | Attestant kan flytte tillegg mellom underprosjekt (som `flyttTimerRadEco`) | **Ja**, i commit 2 | Senere |
| **B8** | Eksportkolonner Byggeplass/Underprosjekt | **For alle radtyper** (timer/maskin mangler dem også, F4) | Kun tillegg og utlegg |

## 11. Åpne funn utenfor scope (følges opp separat)

- **F1 — `forsonSedelIdentitet` mister utlegg.** `timerSync.ts:322-360` re-nøkler `sheetTimerLocal`, `sheetTilleggLocal`, `sheetMachineLocal`, `slettedeRaderLocal`, `vareforbrukLocal` til `tilId`, men **ikke** `sheetUtleggLocal` og ingen vedlegg-tabeller. Utlegg ført på en sedel som får ny id, blir stående på gammel id og pushes aldri. Uavhengig av denne specen; koster data. Anbefalt egen liten ordre med vakt-test.
- **F2 — `hentForAttestering` (:3878) returnerer ikke utlegg**; firma-varianten (:3691) gjør det.
- **F3 — død kode:** `firmaPeriodeRapport` includer tillegg (:168) uten bruk; attestering-snapshotets `prisMotKunde/internkostnad` (:4298, :5545) leses av ingen.
- **F4 — ingen eksport har byggeplass/underprosjekt for timer/maskin** (rapport.ts:313 «ikke bygget nå») — dekkes av B8 hvis «alle radtyper».
- **F5 — `timer.prosjektkort.leggTil` er død i18n-nøkkel** (:366) — slettes i commit 4.

## 12. Ut av scope

Egen korttabell i DB; versjonering av tillegg/utlegg i sync; underprosjekt pr. del i Del-modalen; `benytterUnderprosjekt` (36d-2, egen spec); faktura/økonomi-lesing av tillegg (ingen finnes); endringer i dagskortets JSX.
