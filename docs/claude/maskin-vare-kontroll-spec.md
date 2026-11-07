---
status: 🟡 UTKAST
sist_verifisert_mot_kode: 2026-11-07 (develop @ 09cfbb4d)
eier: Fabel (spec) → Redesign/kode-Opus (kode)
ordre: Spec 36d + TILLEGG (relay/inbox-fabel.md, 2026-11-07)
---

# Spec 36d — kontroll av maskin og varer i dagsoversikten, og underprosjekt som føringsnivå for timer, maskin og varer

> **Status 🟡 UTKAST.** Ingen kode. Alle presens-utsagn i § 1 er målt mot `develop @ 09cfbb4d` med fil:linje. Åpne beslutninger for Kenneth er merket **B1 … B7** og samlet i § 9.

## 0. Bestilling

**Kenneths funn fra telefontest 2026-11-07, ordrett:**

- «jeg mangler oversikt over hvilke prosjekter maskiner har vært brukt på. Maskin er ikke knyttet til arbeidsgiver etter registrering. Jeg mangler å kunne kontrollere at maskin er ført mot korrekte arbeidstimer»
- «jeg mangler også oversikt over hvilke prosjekter varene har vært brukt på de står bare oppsett. Det er ingen kontroll på riktig føring»

**Kenneths hjemmel 2026-11-07, ordrett:**

- «Maskin slik som beskrevet er OK oversikt over flere dager er også OK slik som beskrevet.»
- «Varer må kunne registreres også mot underprosjekt. Firma bør egentlig velge om de vil levere mot underprosjekt eller imot byggeplass.»
- «Timer må også kunne føres mot underprosjekt det samme må maskin time. På lik linje med varer. Firma bestemmer om timer maskin og varer føres mot underprosjekt eller mot byggeplass»

**Det som ble beskrevet for Kenneth og godkjent** (orkestrator, ordren):

1. Maskin vises under arbeidstimene sine i dagsoversikten (36b), med byggeplass. Maskinrad uten timerad markeres «ikke knyttet til arbeidstimer». Det samme når maskintimene på en byggeplass overstiger arbeidstimene der.
2. Varer per byggeplass. Varer ført mot hele prosjektet markeres tydelig.
3. Oversikt over flere dager på web, i Maskin- og Varelager-modulene. Egen, senere leveranse.

**Nytt:** firmaet velger om timer, maskintimer og varer føres mot **byggeplass** eller **underprosjekt** (ExternalCostObject, «ECO»). Ett valg for alle tre radtyper.

**Ut av scope:** underprosjekt generelt («egen kontroll etterhvert») — kun åpne funn i § 8. Dagskortet `apps/mobile/app/timer/[id].tsx` endres ikke (memory-vedtak «dagskort isolert», 2026-11-07).

---

## 1. Målt tilstand (2026-11-07, `09cfbb4d`)

### 1.1 Skjema — alle tre radtyper har allerede begge feltene

| Radtype | Modell | `byggeplassId` | `externalCostObjectId` | Kobling til timerad |
|---|---|---|---|---|
| Arbeidstimer | `SheetTimer` `packages/db-timer/prisma/schema.prisma:227` | `:238` (NULL = arver sedelens, A.30) | `:245` (svak FK → `external_cost_objects`) | — |
| Maskintimer | `SheetMachine` `schema.prisma:532` | `:546` | `:553` (T7-4a) | `sheetTimerId String?` `:542`; kommentar `:534-541`: «NULL = ført FØR koblingen fantes … kan IKKE utledes i ettertid uten å gjette (ingen backfill, ingen heuristisk bøtte-matching)» |
| Varer | `Vareforbruk` `packages/db-varelager/prisma/schema.prisma:74` | `:78` («NULL = hele prosjektet») | `:79` (svak FK) | **Ingen `sheetTimerId`.** Kun `dagsseddelId String?` `:84` (svak FK → `daily_sheets`) |

Konklusjon: **36d-2 krever ingen skjemaendring på radene.** Alle tre kan allerede bære både byggeplass og underprosjekt samtidig (begge `nullable().optional()` i `vareforbruk.ts:381-382` og `dagsseddel.ts:7156-7157`).

`ExternalCostObject` ligger i kjernen `packages/db/prisma/schema.prisma:2798`: `organizationId`, `projectId` (påkrevd — ECO er per prosjekt), `proAdmId`, `kortNavn`, `status` («aktiv» | «lukket»), `timerregistreringApen Boolean` (B.1), `slettetVed?`. Eneste av/på-mekanisme i dag er **per objekt** (`status`, `timerregistreringApen`).

### 1.2 Firmainnstilling for føringsnivå — FINNES IKKE

- `OrganizationSetting` `packages/db/prisma/schema.prisma:373-503` har tilgangs-defaultene `timerTilgangDefault` / `vareforbrukTilgangDefault` / `maskinbrukTilgangDefault` `:382-384` (verdier `alle-ansatte | kun-prosjektmedlemmer | sertifiserte`), og visningsmodusen `timerRegistreringsmodus` `:488` («dagskort» | «prosjektkort», L1 2026-11-05). Ingen av dem styrer byggeplass vs. underprosjekt.
- `ProsjektOrdningOverstyring` `packages/db-timer/prisma/schema.prisma:510-524` er firma-admins overstyring av en **utleggskategoris ordning** per prosjekt (U1; prosedyrer i `apps/api/src/routes/timer/expenseCategory.ts:261/313/338`). Ikke relatert til underprosjekt.
- `OrganizationModule.config Json?` `packages/db/prisma/schema.prisma:320` og `ProjectModule.config` `:1872` leses bare for oversettelse (`apps/api/src/routes/modul.ts:510-535`). Ingen modulkonfig for maskin/varelager.
- Negativsøk («foresMot», «føringsnivå», «kostnadssted», «vareforbrukModus», «underprosjektAktiv», «visUnderprosjekt», «krevUnderprosjekt» m.fl.) i `apps/api/src`, `apps/web/src`, `packages/shared/src`, alle `schema.prisma`: **0 treff.**

**Presedens som den nye innstillingen bør følge** (målt):

| Lag | `timerRegistreringsmodus` i dag |
|---|---|
| Skjema | `OrganizationSetting.timerRegistreringsmodus` `packages/db/prisma/schema.prisma:488`, default «dagskort», ingen backfill |
| API | `organisasjon.oppdaterSetting` `apps/api/src/routes/organisasjon.ts:1279` (input `:1281-1356`), `hentSetting` `:1151`, `hentArbeidstidDefaults` `:1214` |
| Web | `apps/web/src/app/dashbord/firma/innstillinger/page.tsx:959/988/1203` |
| Mobil speil | `organizationSettingLocal.timerRegistreringsmodus` `apps/mobile/src/db/schema.ts:641`; `lesTimerModusLokalt` `apps/mobile/src/services/organizationSettingKatalog.ts:113` — offline-lesbar |

### 1.3 Underprosjekt i hver timer-flyt (hva som er bygget, T.7 låst 2026-05-16)

| Flyt | ECO-velger | Fil:linje |
|---|---|---|
| **Dagskort** (`app/timer/[id].tsx`) | JA — radene grupperes prosjekt → ECO-bøtte | `ProsjektGruppe.tsx:131-132` (`finn(r.externalCostObjectId ?? null)`), `EcoBucket` `:233`, `defaultEcoId` til `TimerSeksjon` `:347` og `MaskinSeksjon` `:368`; `[id].tsx` bærer feltet på `:115/134/148/173` |
| TimerRadModal | JA — felt «Underprosjekt» | `TimerSeksjon.tsx:1781-1794`, init `:1232-1233` (`tvungetValg ? null : eksisterendeRad?.externalCostObjectId ?? defaultEcoId`), `UnderprosjektVelgerModal` `:1963`, def `:2219` (filtrerer `status "aktiv"` + `timerregistreringApen` `:2241-2243`) |
| MaskinRadModal | JA | `MaskinSeksjon.tsx:55` (import), felt `:844-858`, modal `:948-956`, init `:558` |
| SplittRadModal | JA | `SplittRadModal.tsx:42`, felt `:629-633/792-796` |
| **Prosjektkort** (kortskjerm `app/timer/[id]/kort/[projectId].tsx`) | JA via samme `ProsjektGruppe` `:307-327` | |
| **Bekreft dag** | **NEI** — alt hardkodes `null` | `bekreftDagTillegg.ts:118` (timerrad), `:198` (maskin, kommentar `:188` «Nye maskiner har ingen ECO»); `dagsforslagAnvend.ts:149` (timerrad), `:281` (maskin), vare `:292-309` uten ECO; 0 treff på `externalCostObject` i `app/timer/bekreft-dag.tsx` |
| **KortVareforbrukModal** (varer) | **NEI** | `KortVareforbrukModal.tsx`: 0 treff; byggeplass-chips `:144-168`; lagre-payload `:93-112` → `VarelinjeValg` `vareforbrukSync.ts:192-198` (`vareId, vareNavn, enhet, antall, byggeplassId`) |
| Web vareforbruk-side | JA | `apps/web/src/app/dashbord/[prosjektId]/vareforbruk/page.tsx:359-360/377/413/422` |
| Web attestering/redigering | JA | `attestering-buckets.tsx:32/79/92/183-187/247-252`; `RedigerTimerRad.tsx:34/92-94`; `RedigerMaskinRad.tsx:46-48/160-165` |
| **Eksport** | **NEI** | `timer-rapport-eksport.ts` og `packages/shared/src/utils/timerDetaljRader.ts`: 0 treff. `rapport.ts:313-315`: «Fremtid (proadm-underprosjekt): … én kolonne + ett filter. Ikke bygget nå.» `timer.md:864` beskriver «Lønnsart-rader (med ECO per linje)» → proAdmId, men koden bærer det ikke |
| API-validering | Ulik | `vareforbruk.validerEco` `vareforbruk.ts:140-172` sjekker firma + prosjekt + status (kalles `:417-419`, `:537-539`). `tilfoyTimerRad` `dagsseddel.ts:1979` og `maskin.tilfoy` `:7156` **validerer ikke** ECO mot firma/prosjekt; full sjekk finnes bare i `flyttTimerRadEco` `:3993-4021` |

**Mobil lokal DB** (`apps/mobile/src/db/schema.ts`): `sheetTimerLocal.externalCostObjectId` `:158`, `byggeplassId` `:153`; `sheetMachineLocal.sheetTimerId` `:218`, `externalCostObjectId` `:225`, **ingen `byggeplassId`** (0 treff `:208-234`); `vareforbrukLocal.byggeplassId` `:962`, **ingen `externalCostObjectId`, ingen `sheetTimerId`**, sedelkobling `sheetId` `:955`.

**Sync** (`apps/mobile/src/services/timerSync.ts:758-775`): maskin-payload sender `sheetTimerId` `:761` og `externalCostObjectId` `:768`, **ikke byggeplass**. Timerrad-payload sender begge (`:712`, `:719`). Vare-payload `vareforbrukSync.ts:37-44` + `kortVareforbrukInput` `packages/shared/src/utils/prosjektkort.ts:193-201`: `byggeplassId`, `dagsseddelId?` — **ingen ECO**.

### 1.4 Maskin ↔ arbeidstimer — hvem setter `sheetTimerId`, og hvem lar den stå NULL

| Vei | `sheetTimerId` | `byggeplassId` (maskin) | Fil:linje |
|---|---|---|---|
| TimerRadModal med maskin-seksjon (hovedvei fra prosjektkort/dagskort) | SATT | — (arves implisitt via timeraden) | `nyTimerRad.ts:240-255` (`sheetTimerId: timerRadId` `:244`); redigering `TimerSeksjon.tsx:345/370` |
| `MaskinSeksjon.leggTil` (egen «+», skjult: `visHeader={false}` `ProsjektGruppe.tsx:369`) | NULL | — | `MaskinSeksjon.tsx:118-149` |
| SplittRadModal maskinrest | NULL | — | `SplittRadModal.tsx:320-334` |
| **Bekreft dag** (`skrivTillegg`) | **NULL** | — | `dagsforslagAnvend.ts:278` (+ `fraTid/tilTid: null` `:285-286`, ECO `null` `:281`); kommentar `:265` «maskin uten fra/til og uten timerrad-kobling» |
| Rader fra før koblingen fantes | NULL | — | skjema-kommentar `schema.prisma:534-541` |
| Web `maskin.tilfoy` | ikke i input | i input `:7157` | `dagsseddel.ts:7151-7164`; `sheetTimerId` finnes kun i `syncBatch` `:5891` → `:6878` |

**Kapasitetsvakt** «maskin ≤ arbeid» FINNES: `validerMaskinUnderArbeid` `dagsseddel.ts:1050-1063` → `beregnMaskinBrudd` `packages/shared/src/utils/maskinKapasitet.ts:79-107`. Bøtte = **(projectId, externalCostObjectId)** `:9`, nøkkel `:38-41`, tak = arbeid + `pauseMin/60` + `EPSILON_MASKIN_TIMER` `:53` (`:19`). Kalles ved `maskin.tilfoy` `:7199`, `maskin.oppdater` `:7301`, timerrad `:2057/:2246`, `syncBatch` `:6441`. Lokal vakt i Bekreft dag: `maskinBruddForTillegg` `bekreftDagTillegg.ts:188-198`.
**Byggeplass inngår ikke i bøtta.** «Maskintimer på en byggeplass overstiger arbeidstimene der» er derfor ikke dekket av dagens vakt — se § 2.3 og B4.

### 1.5 Visning i dag (prosjektkort/kortskjerm)

- Maskinrader leses **per sedel** (`kort/[projectId].tsx:114-116`), grupperes per ECO-bøtte, og rendres inline etter timerradene i bøtta (`ProsjektGruppe.tsx:359-363`). `sheetTimerId` brukes ikke i visningen.
- `MaskinRadVis` `MaskinSeksjon.tsx:340-435` viser MASKIN-merke, navn, internnummer, reg.nr, mengde, fra–til, timer. **Ikke byggeplass** (0 treff).
- Timerraden viser byggeplass på sekundærlinja `TimerSeksjon.tsx:773-779` (`rad.byggeplassId ?? sedelByggeplassId`, arvet nedtonet).
- `VareforbrukLesListe.tsx:22-51` viser kun `vare.navn`, antall/enhet, syncstatus. **Ikke byggeplass**; `VisVarelinje` `:8-15` har ikke feltet.
- `KortHode` `ProsjektkortSamleside.tsx:226` utleder kortets byggeplass fra timer + maskin (`utledKortByggeplass`), men maskin bidrar aldri: `prosjektkortMobil.ts:52-57` setter `byggeplassId: null` `:54`. Varer inngår ikke i utledningen.
- Eksportens nøsting: `rapport.ts:310-311` «maskin-rader bæres under sin timerad via SheetMachine.sheetTimerId»; `maskin.md:300-312`: Bekreft dag-maskin foldes ikke (sheetTimerId NULL).

### 1.6 Oversikt over flere dager — FINNES IKKE

- API: `vareforbruk.list` `vareforbruk.ts:289-347` krever `projectId` `:292` (per prosjekt, filtre fra/til/byggeplass/dagsseddel/vare). Ingen firma-vid oversikt per vare. Maskin-routeren `apps/api/src/routes/maskin/index.ts:8-14` (`equipment`, `vegvesenKo`, `ansvarlig`, `import`, `service`) leser aldri `sheetMachine` (0 treff). Nærmest: `timer.rapport.detaljEksport` `rapport.ts:317` med `periodeSchema` `:37-43` (`organizationId, fra, til, prosjektId?, ansattId?`) — **ingen `vehicleId`/`vareId`-filter**.
- Web: `dashbord/maskin/[id]/page.tsx:122` har seksjoner statushistorikk `:246`, ansvarlig `:294`, EU-kontroll `:375`, service `:446` — **ingen bruk/prosjekter**. `dashbord/firma/varelager/page.tsx:40` har faner `varer | kategorier` `:33` — 0 treff «vareforbruk». `dashbord/firma/timer/rapport/page.tsx:308` har filtre fra/til/prosjekt/ansatt, maskin nøstet `:383-393` — ingen maskin-/varefilter.
- `maskin.md:881-883`: `maskin.hentSpor` / `hentServicehistorikk` — ingen brukslogg pr. prosjekt. `maskin.md:695` har en Maskinoversikt-skisse (ikke bygget).

### 1.7 36b-grunnlaget (Redesign-plan, `relay/inbox-orkestrator.md:15974-15998`, **ikke startet**)

36b erstatter `ProsjektkortSamleside` i `app/timer/[id]/prosjektkort.tsx:328` med `src/components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt.tsx`, med ren `src/utils/dagsoversikt.ts` (`linjerForProsjekt(...)`, Maskin-linje når `harEquipmentCache || summer.maskin > 0`, Varer-linje når `harVarelager || telteKortVarer.length > 0`, «Mangler» K3). Ingen radikoner (§ 2.5 i [dagsoversikt-beskrivelse-spec.md](dagsoversikt-beskrivelse-spec.md)); trykk på linje åpner modal. **36d-1 bygger på denne.** Vakt-test: `apps/mobile/src/components/timer-detalj/dagskort-isolert-vakt.test.ts` (finnes).

---

## 2. 36d-1 — maskin- og varekontroll i dagsoversikten (mobil, prosjektkort)

Gjelder `ProsjektkortDagsoversikt` fra 36b. Dagskortet `app/timer/[id].tsx` og `ProsjektGruppe`/`MaskinSeksjon`/`TimerSeksjon` i dagskort-grenen endres ikke; de nye visningsreglene ligger i `dagsoversikt.ts` (ren funksjon) + ny visningskomponent under `prosjektkort/`.

### 2.1 Maskin under arbeidstimene

Per prosjekt-blokk i oversikten:

```
Arbeid     07:00–15:00   7,5 t   Lillestrøm skole
  Hjullaster 4120        3,0 t   Lillestrøm skole          ← maskinrad med sheetTimerId → nøstet
  Gravemaskin 2210       2,0 t   ● Ikke knyttet til arbeidstimer   ← sheetTimerId NULL
Maskin     5,0 t   (summen, som i 36b)
Varer      Knust fjell 0–32  12 m³   Lillestrøm skole
           Armeringsnett     4 stk  ● Hele prosjektet
```

Regler (`dagsoversikt.ts`, ren funksjon `maskinLinjerForProsjekt(timerRader, maskinRader, sedelByggeplassId)`):

| Tilfelle | Regel | Visning |
|---|---|---|
| `sheetTimerId` peker på en timerad i samme sedel og prosjekt | nøstes under den timeraden, arver timeradens effektive byggeplass (`rad.byggeplassId ?? sedelByggeplassId`, samme som `TimerSeksjon.tsx:773-779`) | innrykk, byggeplassnavn nedtonet når arvet |
| `sheetTimerId` NULL | egen rad etter de nøstede | amber prikk + «Ikke knyttet til arbeidstimer» (aldri fyll, `ui-standarder.md:140-180`) |
| `sheetTimerId` peker på timerad som ikke finnes lokalt (slettet/annet prosjekt) | behandles som NULL | samme markering; ingen gjetting |
| Maskinrad med egen `byggeplassId` ≠ timeradens | vis maskinens egen | normal tekst (ikke arvet) — kun relevant for web-førte rader `dagsseddel.ts:7157`; mobil lagrer ikke feltet (§ 1.3) |

«Ikke knyttet» er **informasjon**, ikke sperre. Bekreft dag-maskin (`dagsforslagAnvend.ts:278`) vil alltid få denne markeringen i dag → brukeren ser hvorfor og kan trykke raden og knytte den (§ 2.4). Kenneths setning «Maskin er ikke knyttet til arbeidsgiver etter registrering» leses som nettopp dette: maskinen fra Bekreft dag har ingen timerad.

### 2.2 Byggeplass på maskin

Maskinraden får byggeplass i oversikten **uten skjemaendring**: den utledes fra timeraden den er knyttet til (§ 2.1). For `sheetTimerId` NULL vises ingen byggeplass (ingen gjetting), kun markeringen. Konsekvens for `KortHode`-utledningen (`prosjektkortMobil.ts:54`): uendret i 36d-1 — maskin bidrar fortsatt ikke til kortets byggeplass, siden den ikke har egen verdi.

**B5 (lav):** skal `sheetMachineLocal` få `byggeplassId` (speil av server-feltet `schema.prisma:546`, mobil-sync `timerSync.ts:758-775` sender den ikke)? Anbefaling: **nei i 36d-1**; ja i 36d-2 hvis firmavalget «byggeplass» skal gi maskin egen byggeplass-velger (§ 3.3).

### 2.3 «Maskintimer på en byggeplass overstiger arbeidstimene der»

Dagens vakt (`maskinKapasitet.ts`) er per (prosjekt, ECO) og håndheves hardt på server. En byggeplass-regel kan ikke håndheves på samme måte uten funksjonsendring (den ville sperre lagring). Spec-en foreslår en **ren visningsregel** i oversikten:

- Per prosjekt og effektiv byggeplass (timeradens `byggeplassId ?? sedelByggeplassId`): `sum(maskin nøstet under timerader med den byggeplassen) > sum(arbeidstimer med den byggeplassen) + pauseMin/60` → amber prikk på Maskin-linjen + mikrotekst «Maskin 5,0 t over arbeid 3,0 t på Lillestrøm skole». Samme `EPSILON_MASKIN_TIMER` som `maskinKapasitet.ts:19`.
- Maskin med `sheetTimerId` NULL teller **ikke** i byggeplass-summen (ingen byggeplass å telle mot) — de har allerede egen markering.
- Ingen sperre, ingen Alert, ingen toast. Ingen endring i server-vakten.

**B4:** Skal byggeplass-overskridelse bare vises (anbefalt, 36d-1) eller også sperres på server som dagens ECO-vakt? Sperre = funksjonsendring i `validerMaskinUnderArbeid` + bøttenøkkel, påvirker dagskort, web og sync. Anbefaling: **kun visning** nå.

### 2.4 Trykk på maskinrad (knytte til arbeidstimer)

36b/§ 2.5: ingen radikoner, trykk åpner modal. Trykk på en «ikke knyttet»-maskinrad åpner `MaskinRadModal` (`MaskinSeksjon.tsx:436`) som i dag. Å **knytte** raden til en timerad finnes ikke i noen modal i dag (`maskin.oppdater` `dagsseddel.ts:7230-7244` har ikke `sheetTimerId`; mobil-sync bærer den kun ved opprettelse `:761`). Spec-en foreslår i 36d-1 en valgfri velger «Hører til arbeidstimer» i `MaskinRadModal` (liste over sedelens timerader for samme prosjekt), som setter `sheetTimerId` lokalt og krever at `syncBatch` allerede bærer feltet (`:5891` → `:6878`) — det gjør den. Web `maskin.oppdater` trenger `sheetTimerId` i input for paritet.

Dette er en liten funksjonsendring i `MaskinRadModal`, som også brukes av dagskortet → **B2** (se § 3.4): må gates bak prop `handlinger?`/`visKnytting?` med dagens default `false` og test i `dagskort-isolert-vakt.test.ts`. Hvis Kenneth sier nei, utgår § 2.4 og «ikke knyttet» forblir ren informasjon.

### 2.5 Varer per byggeplass

Varer-linjen i 36b lister varelinjene (ikke bare telling). Per linje: `vareNavn`, antall + enhet, byggeplassnavn fra `vareforbrukLocal.byggeplassId` `schema.ts:962` slått opp i lokal byggeplass-cache (`hentByggeplasserForProsjektLokalt`, allerede brukt i `KortVareforbrukModal.tsx:64-67`). `byggeplassId` NULL → amber prikk + «Hele prosjektet» (samme ordlyd som chip-en `vareforbruk.felt.byggeplassIngen`). Når prosjektet ikke har byggeplasser i det hele tatt (`byggeplasser.length === 0`, modalen skjuler chips `:144`), vises **ingen** markering — det er ikke en mangel. Trykk på linje åpner `KortVareforbrukModal` med linjen forhåndsvalgt (36b).

`VisVarelinje` (`VareforbrukLesListe.tsx:8-15`) brukes av dagskortet og utvides **ikke**; oversikten får egen linjetype i `dagsoversikt.ts`.

### 2.6 Server-varelinjer vs. lokale

Kortskjermen viser server-linjer + lokale (`kort/[projectId].tsx:212-222`). Oversikten gjør det samme; server-linjer har `byggeplassId` fra `vareforbruk.list`. Begge kilder får samme markering.

### 2.7 Dagskort-isolering

- `dagsoversikt.ts` og ny komponent under `prosjektkort/` er kun i prosjektkort-grenen.
- Delte komponenter som endres (kun § 2.4 `MaskinRadModal`): ny prop med dagens default, vakt-test utvides med «dagskort rendrer MaskinRadModal uten knytte-velger».
- Diff i `app/timer/[id].tsx` = 0 (gate).

---

## 3. 36d-2 — firmavalg «byggeplass | underprosjekt» for timer, maskin og varer

### 3.1 Hvor innstillingen bor — B1

**Anbefaling:** nytt felt på `OrganizationSetting` i **`packages/db`** (kjernen):

```prisma
// Føringsnivå (Kenneth 2026-11-07): hva arbeidstimer, maskintimer og varer
// føres mot under prosjektet. "byggeplass" = SiteDoc-intern byggeplass (som i dag).
// "underprosjekt" = ExternalCostObject (ProAdm). Ett valg for alle tre radtyper.
// Default "byggeplass", ingen backfill (alle firmaer står der i dag).
foringsnivaa String @default("byggeplass") @map("foringsnivaa")
```

Begrunnelse: (a) innstillingen er **ikke** en firmamodul-tabell — den er en firmainnstilling som tre moduler leser, nøyaktig som `timerRegistreringsmodus` `:488` og tilgangs-defaultene `:382-384`; (b) `ExternalCostObject` selv ligger i kjernen `:2798`; (c) mobil-speilet `organizationSettingLocal` `apps/mobile/src/db/schema.ts:607` finnes allerede og gir offline-lesing. Regelen «firmamodulers tabeller aldri i `packages/db`» brytes ikke: ingen modul-tabell flyttes.

Alternativ (ikke anbefalt): `OrganizationModule.config Json` per modul (`:320`) — gir tre uavhengige valg, som strider mot Kenneths «ett valg», og leses ikke av noen i dag.

**Skjemaendring = ja** (ny kolonne i `packages/db`, migrering via Prisma, default dekker alle eksisterende firmaer — ingen stille tomhet, ingen backfill nødvendig). **B1: godkjenn plassering og navn `foringsnivaa` («byggeplass» | «underprosjekt»).**

Lag som følger presedensen (§ 1.2): `oppdaterSetting`-input `organisasjon.ts:1281-1356` + `hentArbeidstidDefaults`-select `:1219-1240`; web `firma/innstillinger/page.tsx` ny seksjon ved `TilgangPolicySeksjon` `:283-297`; mobil `organizationSettingKatalog.ts` ny `lesForingsnivaaLokalt(organizationId)` ved siden av `lesTimerModusLokalt` `:113`; `organizationSettingLocal` ny kolonne.

### 3.2 Hva valget styrer — og hva det IKKE styrer

Valget styrer **hvilken velger som vises** i føringsflatene og **hva oversikten kontrollerer mot**. Det endrer **ikke** skjema, sync-payload eller server-validering, og det sletter/omskriver aldri eksisterende rader.

| Flate | «byggeplass» (= i dag) | «underprosjekt» |
|---|---|---|
| `KortVareforbrukModal` `:144-168` | byggeplass-chips (uendret) | underprosjekt-velger (`UnderprosjektVelgerModal` `TimerSeksjon.tsx:2219`, gjenbrukt som i `MaskinSeksjon.tsx:55`), «Ingen» = hele prosjektet; chips skjult. Lagre-payload får `externalCostObjectId` → krever nytt felt i `VarelinjeValg` `vareforbrukSync.ts:192-198`, `vareforbrukLocal` (ny kolonne `external_cost_object_id`), `kortVareforbrukInput` `prosjektkort.ts:193-201`, sync-basis `vareforbrukSync.ts:37-44`. API tar det allerede `vareforbruk.ts:382` og validerer `:417-419` |
| Bekreft dag — timerrader | som i dag (`dagsforslagAnvend.ts:165` byggeplass fra forslag) | ny valgfri velger «Underprosjekt» per prosjekt-chip i Bekreft dag; verdi til `anvendDagsforslag` i stedet for `null` `:149` |
| Bekreft dag — maskin | som i dag | arver prosjektets valgte underprosjekt (`:281` → verdi) |
| Bekreft dag — varer | byggeplass via `entydigByggeplass` `bekreftDagTillegg.ts:88-96` | arver prosjektets valgte underprosjekt; `byggeplassId` settes ikke |
| TimerRadModal / MaskinRadModal (prosjektkort-grenen) | ECO-feltet `TimerSeksjon.tsx:1781-1794` / `MaskinSeksjon.tsx:844-858` **skjules**; byggeplass-chips som i dag | som i dag (ECO-felt vist) |
| Dagsoversikt 36d-1 | kontroll per byggeplass (§ 2) | kontroll per underprosjekt: «Hele prosjektet»-markering når `externalCostObjectId` NULL; maskin-vakt er allerede per ECO (`maskinKapasitet.ts:38-41`) |
| Web vareforbruk-side `[prosjektId]/vareforbruk/page.tsx` | begge felt (uendret) | begge felt (uendret) — web admin-flater viser alltid begge |
| Web attestering/redigering | uendret | uendret |

### 3.3 Konsekvens for dagskortet `app/timer/[id].tsx` — B2 (STOPP)

Dagskortet viser i dag ECO-bøtter og ECO-velger **alltid** (§ 1.3). Et firma på «byggeplass» ville etter 36d-2 fortsatt se «Underprosjekt»-feltet i dagskortets `TimerRadModal`/`MaskinRadModal` og ECO-gruppering i `ProsjektGruppe`, mens prosjektkortet skjuler det. To alternativer:

- **B2-a (anbefalt): dagskortet endres ikke.** Valget gjelder prosjektkort-grenen, Bekreft dag og `KortVareforbrukModal`. Dagskortet beholder dagens oppførsel (ECO valgfritt, byggeplass valgfritt). Inkonsekvensen er akseptabel fordi dagskortet skal fases ut i firmaer som bruker prosjektkort (`timerRegistreringsmodus`), og fordi vedtaket 2026-11-07 isolerer det.
- **B2-b: dagskortet følger valget.** Krever prop `foringsnivaa` på `ProsjektGruppe`, `TimerRadModal`, `MaskinRadModal` med dagens default («vis ECO») + utvidet vakt-test, og endring i `[id].tsx`-grenen. **STOPP — krever egen hjemmel fra Kenneth.**

Spec-en skriver 36d-2 for **B2-a**. Hvis Kenneth velger B2-b, er det en egen leveranse etter 36d-2.

### 3.4 Eksisterende rader uten underprosjekt — ingen stille tomhet, ingen gjetting

Når et firma velger «underprosjekt»:

- Rader med `externalCostObjectId` NULL (alle Bekreft dag-rader frem til nå, alle varelinjer fra mobil, alle rader uten valg) **beholdes uendret**. Ingen migrering, ingen backfill (det finnes ingenting å utlede fra — byggeplass er SiteDoc-intern uten ProAdm-motpart, `terminologi.md:209`).
- Oversikten (36d-1) markerer dem «Hele prosjektet» (amber prikk). Det er kontrollen Kenneth ba om; markeringen er svaret på «ingen kontroll på riktig føring».
- Rader som har **både** byggeplass og underprosjekt (mulig via web `vareforbruk.ts:381-382`, `dagsseddel.ts:7156-7157`) vises med det feltet valget peker på; det andre beholdes i data.
- Attestering (`attestering-buckets.tsx`) viser ECO-bøtter som i dag — uavhengig av valget. Rader uten ECO ligger i hovedbøtta (null først, `ProsjektGruppe.tsx:137-141`-mønsteret).

### 3.5 Bytte midt i en periode — eksport, lønn, attestering

Målt: eksporten bærer **verken** byggeplass-dimensjon på maskin/vare **eller** underprosjekt (§ 1.3, `rapport.ts:313-315`). Lønnsgrunnlaget (`SheetTimer.timer`, lønnsart, tillegg) er uavhengig av begge feltene. Derfor:

- Bytte av `foringsnivaa` endrer **ingen** tall i attestering, lønn eller eksport. Rader ført før byttet beholder sine felt; rader ført etter får det nye feltet fylt. Perioden får blandede rader — det er synlig i oversikten (markering) og i web-redigering (begge felt vises), ikke i eksporten.
- `foringsnivaa` skal **ikke** lagres på raden eller sedelen (ingen `foringsnivaaVedFøring`-kolonne). Begrunnelse: feltene selv (`byggeplassId`/`externalCostObjectId` satt eller NULL) er fakta; valget er bare et UI-filter. Ingen stille tomhet oppstår fordi ingen ny identitetskolonne innføres på radene.
- **B6:** skal web-rapporten få ECO som kolonne + filter (`rapport.ts:313-315` «ikke bygget nå») i 36d-2, slik at kontroll per underprosjekt også finnes i eksporten? Anbefaling: **ja, men som 36d-3-del** (web-oversikt), ikke i 36d-2.

### 3.6 Server-validering — paritetshull

`tilfoyTimerRad` `dagsseddel.ts:1979` og `maskin.tilfoy` `:7156` validerer ikke ECO mot firma/prosjekt/status (kun `flyttTimerRadEco` `:3993-4021` og `vareforbruk.validerEco` `:140-172` gjør det). Mobil-velgeren filtrerer på prosjekt + aktiv (`TimerSeksjon.tsx:2241-2243`), så i praksis sendes gyldige verdier, men web/`syncBatch` kan sende hva som helst. 36d-2 bør gjenbruke `validerEco`-logikken i `tilfoyTimerRad`, `oppdaterTimerRad`, `maskin.tilfoy`, `maskin.oppdater` og `syncBatch` (`:6441`-området). Dette er sikkerhets-/korrekthetsendring uten brukersynlig tap → ingen hjemmel-krav, men nevnes (`feedback_sikkerhet_fritar_ikke`).

---

## 4. 36d-3 — web-oversikt over flere dager (Maskin- og Varelager-modul)

Egen, senere leveranse (Kenneth: «oversikt over flere dager er også OK slik som beskrevet»).

### 4.1 Maskin

- Ny prosedyre `maskin.equipment.bruk` (i `apps/api/src/routes/maskin/`, leser `prismaTimer.sheetMachine` — første lesning av timer-skjema fra maskin-routeren; krever `krevMaskinAktivert` + firma-grense). Input: `organizationId`, `vehicleId?`, `fra`, `til`, `prosjektId?`. Returnerer rader: dato, prosjekt, byggeplass (via nøstet timerad når `sheetTimerId` satt, ellers maskinens egen `byggeplassId` `:546`, ellers «—»), underprosjekt (`proAdmId · kortNavn`), ansatt, timer, `sheetTimerId` NULL-flagg («ikke knyttet»), attestertStatus. Sum per prosjekt/byggeplass/underprosjekt.
- Web: ny seksjon «Bruk» på `dashbord/maskin/[id]/page.tsx` (etter service `:446`) med periode-filter, og ny fane/side under `dashbord/maskin` «Bruk per periode» (alle maskiner, filtre maskin/prosjekt/periode). Samme «ikke knyttet»-markering som 36d-1.

### 4.2 Varer

- `vareforbruk.list` `:289` krever `projectId`. Ny `vareforbruk.listForFirma` (`organizationId`, `vareId?`, `prosjektId?`, `fra`, `til`): alle prosjekter i firmaet, grupperbart per vare → prosjekt → byggeplass/underprosjekt. «Hele prosjektet»-flagg når begge NULL.
- Web: ny fane «Forbruk» i `dashbord/firma/varelager/page.tsx` (`type Fane` `:33` utvides) + «Forbruk»-seksjon på varedetalj om den finnes.

### 4.3 Eksport (B6)

ECO-kolonne + filter i `timer.rapport.detaljEksport` (`rapport.ts:313-315`-planen), og byggeplass-kolonne for maskin via nøstet timerad. Kun hvis B6 = ja.

---

## 5. Rekkefølge — anbefaling (B7)

| Rekkefølge | Leveranse | Avhenger av | Begrunnelse |
|---|---|---|---|
| 1 | **36b** (dagsoversikt A) | — | 36d-1 rendrer i `ProsjektkortDagsoversikt` |
| 2 | **36d-1** maskin- og varekontroll i oversikten (§ 2) | 36b | Svarer direkte på begge Kenneth-funnene uten skjemaendring; viser «Hele prosjektet»/«Ikke knyttet» som er kontrollen; avdekker omfanget av NULL-rader før firmaene velger nivå |
| 3 | **36d-2** firmavalg + ECO i KortVareforbrukModal/Bekreft dag (§ 3) | B1, B2; 36d-1 (markeringene må finnes før firmaer kan bytte, ellers er byttet usynlig) | Skjemaendring i `packages/db` + mobil-kolonne; bør ikke blandes med 36d-1 |
| 4 | **36d-3** web-oversikt (§ 4) | 36d-2 for underprosjekt-kolonnen; ellers uavhengig | Kan starte parallelt med 36d-2 etter 36d-1 |

Alternativet «36d-2 først» ble vurdert: det gir firmaet valget tidligere, men uten 36d-1 ser ingen effekten av valget på mobil, og «ingen kontroll på riktig føring» forblir. Anbefaling: **36d-1 før 36d-2.**

---

## 6. i18n (nb + en, generer `--only`)

| Nøkkel | nb |
|---|---|
| `dagsoversikt.maskin.ikkeKnyttet` | Ikke knyttet til arbeidstimer |
| `dagsoversikt.maskin.overByggeplass` | Maskin {{maskin}} t over arbeid {{arbeid}} t på {{byggeplass}} |
| `dagsoversikt.vare.heleProsjektet` | Hele prosjektet |
| `dagsoversikt.underprosjekt.ingen` | Uten underprosjekt |
| `maskin.felt.horerTilArbeid` | Hører til arbeidstimer |
| `firma.innstillinger.foringsnivaa.tittel` | Føring under prosjekt |
| `firma.innstillinger.foringsnivaa.beskrivelse` | Hva timer, maskin og varer føres mot. Gjelder mobil og Bekreft dag. Rader som allerede er ført, endres ikke. |
| `firma.innstillinger.foringsnivaa.byggeplass` | Byggeplass |
| `firma.innstillinger.foringsnivaa.underprosjekt` | Underprosjekt |
| `vareforbruk.felt.underprosjekt` | Underprosjekt |

Mikrotekst etter § 3a: innstillingsbeskrivelsen sier hvor det flytter (mobil/Bekreft dag), hva som skjer med det som finnes (uendret).

---

## 7. Tester som skal feile før kode (gate)

**36d-1** (`dagsoversikt.test.ts`, ren funksjon):
1. Maskin med `sheetTimerId` = T1 nøstes under T1 og arver T1s byggeplass; arvet fra sedel når T1 har NULL.
2. Maskin med `sheetTimerId` NULL → linje med `ikkeKnyttet: true`, ingen byggeplass.
3. Maskin med `sheetTimerId` som ikke finnes i radene → som NULL.
4. Byggeplass-sum: 3,0 t arbeid + 0 pause på B1, 3,5 t nøstet maskin på B1 → `overByggeplass` for B1; 3,0 t maskin → ingen (EPSILON).
5. Pause teller: 3,0 t arbeid + 30 min pause, 3,4 t maskin → ingen.
6. Maskin NULL teller ikke i byggeplass-summen.
7. Vare `byggeplassId` NULL med `byggeplasser.length > 0` → `heleProsjektet: true`; med 0 byggeplasser → `false`.
8. Server-linje og lokal linje får samme markering.
9. `dagskort-isolert-vakt.test.ts`: `MaskinRadModal` uten `visKnytting` rendrer ingen «Hører til arbeidstimer»; diff-gate `[id].tsx` = 0.

**36d-2:**
10. `OrganizationSetting.foringsnivaa` default «byggeplass» for eksisterende firma (migreringstest: SELECT count(*) WHERE foringsnivaa IS NULL = 0).
11. `oppdaterSetting` avviser andre verdier enn «byggeplass» | «underprosjekt».
12. `KortVareforbrukModal` på «underprosjekt» viser velger, ikke chips; lagre-payload har `externalCostObjectId`, `byggeplassId: null`.
13. `KortVareforbrukModal` på «byggeplass» = dagens snapshot.
14. `vareforbrukLocal` ny kolonne synkes: `kortVareforbrukInput` bærer `externalCostObjectId`.
15. Bekreft dag på «underprosjekt»: timerrad, maskin og vare for prosjektet får valgt ECO; uten valg → NULL (ikke gjetting).
16. `tilfoyTimerRad`/`maskin.tilfoy`/`syncBatch` avviser ECO fra annet prosjekt/firma/lukket (paritet med `validerEco`).
17. Bytte av `foringsnivaa` endrer ingen rad (SELECT før/etter identisk) og ingen eksport-tall.
18. Mobil leser `foringsnivaa` offline fra `organizationSettingLocal`; ukjent/manglende verdi → «byggeplass».

**36d-3:**
19. `maskin.equipment.bruk` filtrerer på firma (annet firmas maskin → FORBIDDEN) og periode; «ikke knyttet»-flagg ved NULL.
20. `vareforbruk.listForFirma` filtrerer på firma; «hele prosjektet» ved begge NULL.

---

## 8. Åpne funn — underprosjekt generelt (noteres, løses ikke her)

- F-U1: ECO-validering mangler i `tilfoyTimerRad`/`oppdaterTimerRad`/`maskin.tilfoy`/`maskin.oppdater` (§ 3.6).
- F-U2: Eksport/lønn bærer ikke ECO selv om `timer.md:864` sier det (`timerDetaljRader.ts`, `timer-rapport-eksport.ts`: 0 treff). Doc-feil eller manglende kode — avklares i 36d-3/B6.
- F-U3: `eksternKostObjekt`-routeren er kun lesing (`eksternKostObjekt.ts:13-14`); oppretting «via Proadm-import eller dedikert admin-flyt (ikke her)». Firmaer uten ProAdm kan ikke opprette underprosjekt i UI — «underprosjekt»-valget er da tomt. Må løses før valget gir mening for slike firmaer.
- F-U4: `ExternalCostObject` er per prosjekt. Byggeplass er også per prosjekt. Ingen kobling byggeplass ↔ underprosjekt finnes eller er ønsket (`terminologi.md:209`).
- F-U5: `maskin.tilfoy` kaller ikke `verifiserProsjekterTilhørerFirma` (gjør `tilfoyTimerRad` `:2034`).
- F-U6: `SplittRadModal` maskinrest mister `sheetTimerId` (`:320-334`) — splittede maskiner blir «ikke knyttet».

---

## 9. Beslutninger for Kenneth

| # | Spørsmål | Anbefaling |
|---|---|---|
| **B1** | Innstillingen `foringsnivaa` («byggeplass» | «underprosjekt») som ny kolonne på `OrganizationSetting` i `packages/db` (kjernen), default «byggeplass», ingen backfill. Skjemaendring = ja. | Ja — følger `timerRegistreringsmodus`-presedensen; ikke en modul-tabell |
| **B2** | Dagskortet `app/timer/[id].tsx`: følge firmavalget (B2-b, STOPP, egen leveranse) eller uendret (B2-a)? | **B2-a uendret** |
| **B3** | § 2.4 «Hører til arbeidstimer»-velger i `MaskinRadModal` (prosjektkort-grenen, prop-gated) så Bekreft dag-maskiner kan knyttes i ettertid? | Ja i 36d-1, prop med dagens default |
| **B4** | Byggeplass-overskridelse maskin > arbeid: kun visning (amber) eller også server-sperre? | **Kun visning** |
| **B5** | `sheetMachineLocal.byggeplassId` + sync av feltet fra mobil? | Nei i 36d-1; vurderes i 36d-2 |
| **B6** | ECO-kolonne + filter i rapport/eksport? | Ja, som del av 36d-3 |
| **B7** | Rekkefølge 36b → 36d-1 → 36d-2 → 36d-3 | Ja |

---

## 10. Ut av scope

- Underprosjekt-opprettelse i UI (F-U3), ProAdm-import.
- Endring i server-kapasitetsvakt (bøttenøkkel) — B4.
- Dagskortets ECO-visning (B2-b).
- Attestering per byggeplass.
- Sletting/omskriving av eksisterende rader ved bytte av føringsnivå — skjer aldri.
