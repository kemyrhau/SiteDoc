---
status: 🟢 VEDTATT 2026-11-08 — § 3 (36d-2, firmavalg av/på i tillegg til byggeplass) og B1 (`benytterUnderprosjekt Boolean @default(false)`) vedtatt av Kenneth 2026-11-08 («Ja, i tillegg»); B8 utgår, F-U3 står åpent. § 2 (36d-1), § 4 (36d-3), B2–B7 🟢 VEDTATT 2026-11-07. Ingen kode ennå. Rekkefølge: 36b (merget) → 36c → 36d-1 → 36d-2 → 36d-3.
sist_verifisert_mot_kode: 2026-11-08 (develop @ 480e0420, § 1.8 og § 3); § 1.1–1.7 målt 2026-11-07 (develop @ 09cfbb4d) — linjeskift i § 1.8
eier: Fabel (spec) → Redesign/kode-Opus (kode)
ordre: Spec 36d + TILLEGG (relay/inbox-fabel.md, 2026-11-07); revisjon 36d-2 + TILLEGG + AVGRENSNING (relay/inbox-fabel.md, 2026-11-08)
---

# Spec 36d — kontroll av maskin og varer i dagsoversikten, og underprosjekt som frivillig tilleggsdimensjon for timer, maskin og varer

> **Status 🟢 VEDTATT 2026-11-08.** § 2, § 4, § 5 og B2–B7 er 🟢 VEDTATT 2026-11-07 (Kenneth via orkestrator, `relay/inbox-fabel.md` «VEDTAK — Spec 36d»). **§ 3 (36d-2) og B1 er 🟢 VEDTATT 2026-11-08** (Kenneth ordrett «Ja, i tillegg», `relay/inbox-fabel.md` «VEDTAK — revisjon 36d-2»): firmavalget for underprosjekt er **av/på i tillegg til byggeplass**, ikke «byggeplass eller underprosjekt»; innstillingen er `benytterUnderprosjekt Boolean @default(false)`. B8 utgår (Proadm-kjeden utsatt, § 3.7); F-U3 står som åpent funn. Ingen kode ennå. Presens i § 1.1–1.7 er målt mot `09cfbb4d`; § 1.8 og § 3 mot `480e0420`.

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

**Vedtak 2026-11-07 (Kenneth via orkestrator), ordrett:** «Ja til alle bortsett fra hurtigvalg, er ikke det like greit å ta med nå». Hurtigvalg gjelder 36b (Redesign kopierte `handterHurtigVelg` inn i `prosjektkort/radLagring.ts`, lagring C), ikke denne specen.

- **B1 (2026-11-07, nå REVIDERT — se under og § 3.1):** opprinnelig `foringsnivaa` («byggeplass» | «underprosjekt») på `OrganizationSetting`. Erstattes av et av/på-felt.
- **B2 JA (B2-a), med Kenneths presisering:** det **gamle dagskortet** (`app/timer/[id].tsx` i dagskortmodus, appen slik den var før prosjektkortene) står uendret. **Prosjektkort-flyten** (36b-dagsoversikten, prosjektkortet og Bekreft dag) er «det nye dagskortet» og skal kunne tilpasses: firmavalget, maskinkontrollen og varer per byggeplass/underprosjekt gjelder der.
- **B3, B4, B5, B6, B7 JA** som anbefalt. Rekkefølge: **36b → 36c → 36d-1 → 36d-2 → 36d-3**. (B5 er i praksis innfridd av 36b, § 1.8.)

**Revisjon 2026-11-08 — Kenneth ordrett (via orkestrator, `relay/inbox-fabel.md` «ORDRE — Revisjon av spec 36d-2»):**

1. «Under prosjekt har jeg sagt skal være et firma valg. Dersom firmaet velger å benytte underprosjekt i tillegg til byggeplass. Da må vi også kunne registrere under prosjekt samtidig som prosjekt og byggeplass»
2. «Husk at vi skal tillate at underprosjekt kan være tom og ikke skal velges»
3. «I firma innstillinger trenger vi et valg for om firmaet skal benytte underprosjekt eller ikke i sin registrering. Dersom firmaet benytter proadm, da er vi avhengig av at underprosjekt eksisterer. Ellers får vi ikke dokumentflyt til å fungere»

**Lesning:** byggeplass er alltid med (som i dag, og som 36b bygde kortet: prosjekt + byggeplass + underprosjekt). Underprosjekt er en **egen, frivillig dimensjon** som firmaet slår av eller på. «Enten/eller»-modellen fra 2026-11-07 (§ 3 gammel) utgår. Utsagn 3 (Proadm) er **avgrenset av Kenneth samme dag** — se under.

**Avgrensning 2026-11-08 — Kenneth ordrett (via orkestrator, «AVGRENSNING av TILLEGG revisjon 36d-2»):** «detaljer om dette må vi ta senere. Vi har ikke startet dialog med proadm enda. Vi skal bare klargjøre at underprosjekt eksisterer. Og at vi kan skrive timer mot underprosjekt». Specen slår derfor bare fast (§ 3.7) at underprosjekt finnes som entitet, og at timer, maskin og varer kan føres mot det når firmavalget er på. Ingen B-spørsmål om Proadm, ingen flagging av rader uten underprosjekt.

**Ut av scope:** underprosjekt generelt («egen kontroll etterhvert») — kun åpne funn i § 8. Det gamle dagskortet `apps/mobile/app/timer/[id].tsx` (dagskortmodus) endres ikke (memory-vedtak «dagskort isolert», 2026-11-07; B2-presisering over).

---

## 1. Målt tilstand (2026-11-07, `09cfbb4d`; linjeskift etter 36b-merge i § 1.8)

### 1.1 Skjema — alle tre radtyper har allerede begge feltene

| Radtype | Modell | `byggeplassId` | `externalCostObjectId` | Kobling til timerad |
|---|---|---|---|---|
| Arbeidstimer | `SheetTimer` `packages/db-timer/prisma/schema.prisma:227` | `:238` (NULL = arver sedelens, A.30) | `:245` (svak FK → `external_cost_objects`) | — |
| Maskintimer | `SheetMachine` `schema.prisma:532` | `:546` | `:553` (T7-4a) | `sheetTimerId String?` `:542`; kommentar `:534-541`: «NULL = ført FØR koblingen fantes … kan IKKE utledes i ettertid uten å gjette (ingen backfill, ingen heuristisk bøtte-matching)» |
| Varer | `Vareforbruk` `packages/db-varelager/prisma/schema.prisma:74` | `:78` («NULL = hele prosjektet») | `:79` (svak FK) | **Ingen `sheetTimerId`.** Kun `dagsseddelId String?` `:84` (svak FK → `daily_sheets`) |

Konklusjon: **36d-2 krever ingen skjemaendring på radene.** Alle tre kan allerede bære både byggeplass og underprosjekt samtidig (begge `nullable().optional()` — `480e0420`: `vareforbruk.ts:385/510`, `dagsseddel.ts:2056` (timer), `:7259/:7336` (maskin)). Det er nettopp den samtidigheten Kenneths utsagn 1 krever.

`ExternalCostObject` ligger i kjernen `packages/db/prisma/schema.prisma:2798`: `organizationId`, `projectId` (påkrevd — ECO er per prosjekt), `proAdmId String` (**påkrevd**, `:2803`), `kilde` («proadm_import» | «manuell» | «felt_opprettet», `:2808`), `kortNavn`, `status` («aktiv» | «lukket»), `timerregistreringApen Boolean` (B.1), `slettetVed?`, `@@unique([organizationId, proAdmId])` `:2832`. Eneste av/på-mekanisme i dag er **per objekt** (`status`, `timerregistreringApen`).

### 1.2 Firmainnstilling for underprosjekt — FINNES IKKE

- `OrganizationSetting` `packages/db/prisma/schema.prisma:373-503` har tilgangs-defaultene `timerTilgangDefault` / `vareforbrukTilgangDefault` / `maskinbrukTilgangDefault` `:382-384` (verdier `alle-ansatte | kun-prosjektmedlemmer | sertifiserte`), og visningsmodusen `timerRegistreringsmodus` `:488` («dagskort» | «prosjektkort», L1 2026-11-05). Ingen av dem styrer underprosjekt.
- `ProsjektOrdningOverstyring` `packages/db-timer/prisma/schema.prisma:510-524` er firma-admins overstyring av en **utleggskategoris ordning** per prosjekt (U1; prosedyrer i `apps/api/src/routes/timer/expenseCategory.ts:261/313/338`). Ikke relatert til underprosjekt.
- `OrganizationModule.config Json?` `packages/db/prisma/schema.prisma:320` og `ProjectModule.config` `:1872` leses bare for oversettelse (`apps/api/src/routes/modul.ts:510-535`). Ingen modulkonfig for maskin/varelager.
- Negativsøk («foresMot», «føringsnivå», «kostnadssted», «vareforbrukModus», «underprosjektAktiv», «visUnderprosjekt», «krevUnderprosjekt» m.fl.) i `apps/api/src`, `apps/web/src`, `packages/shared/src`, alle `schema.prisma`: **0 treff.**

**Presedens som den nye innstillingen bør følge** (målt, linjer `480e0420` der annet ikke er sagt):

| Lag | `timerRegistreringsmodus` (streng-valg) | Boolske felt (av/på) |
|---|---|---|
| Skjema | `OrganizationSetting.timerRegistreringsmodus` `packages/db/prisma/schema.prisma:488`, default «dagskort», ingen backfill | `tillattSelvAttestering Boolean @default(true)` `:414`, `tillattRedigerVedAttestering Boolean @default(true)` `:425`, `reisetidTellerOvertid Boolean @default(false)` `:469` (avviklet i UI) |
| API | `organisasjon.oppdaterSetting` `apps/api/src/routes/organisasjon.ts:1279` (`z.enum(["dagskort","prosjektkort"]).optional()` `:1356`), `hentSetting` `:1151`, `hentArbeidstidDefaults` `:1211` (mobil-subsett, select `:1242`) | samme ruter, `z.boolean().optional()` |
| Web | `apps/web/src/app/dashbord/firma/innstillinger/page.tsx:959` (lesing), `:988` (lagring), radiogruppe `:1191-1203` | avkrysningsboks: `AutoProsjektAdminSeksjon` `:810`, `RedigerVedAttesteringSeksjon` `:881` (`tillattRedigerVedAttestering: nyVerdi` `:866`) |
| Mobil speil | `organizationSettingLocal.timerRegistreringsmodus` `apps/mobile/src/db/schema.ts:645`; `lesTimerModusLokalt` `apps/mobile/src/services/organizationSettingKatalog.ts:113` — offline-lesbar | `organizationSettingLocal.tillattRedigerVedAttestering` `schema.ts:616-620` (integer-boolean, default false) |

Et nytt felt krever (målt `organizationSettingKatalog.ts:39-91`): select i `hentArbeidstidDefaults`, kolonne i `schema.ts`, idempotent ALTER i `migreringer.ts`, mapping i katalogen (`:53-91` sletter og setter inn raden på nytt).

### 1.3 Underprosjekt i hver timer-flyt (hva som er bygget, T.7 låst 2026-05-16; linjer `09cfbb4d`)

| Flyt | ECO-velger | Fil:linje |
|---|---|---|
| **Dagskort** (`app/timer/[id].tsx`) | JA — radene grupperes prosjekt → ECO-bøtte | `ProsjektGruppe.tsx:131-132` (`finn(r.externalCostObjectId ?? null)`), `EcoBucket` `:233`, `defaultEcoId` til `TimerSeksjon` `:347` og `MaskinSeksjon` `:368`; `[id].tsx` bærer feltet på `:115/134/148/173` |
| TimerRadModal | JA — felt «Underprosjekt» | `TimerSeksjon.tsx:1781-1794`, init `:1232-1233` (`tvungetValg ? null : eksisterendeRad?.externalCostObjectId ?? defaultEcoId`), `UnderprosjektVelgerModal` `:1963`, def `:2219` (filtrerer `status "aktiv"` + `timerregistreringApen`; `480e0420`: `:2280-2285`) |
| MaskinRadModal | JA | `MaskinSeksjon.tsx:55` (import), felt `:844-858`, modal `:948-956`, init `:558` |
| SplittRadModal | JA | `SplittRadModal.tsx:42`, felt `:629-633/792-796` |
| **Prosjektkort** (kortskjerm `app/timer/[id]/kort/[projectId].tsx`) | JA via samme `ProsjektGruppe` `:307-327`; **etter 36b** også via kortvalget (§ 1.8) | |
| **Bekreft dag** | **NEI** — alt hardkodes `null` (fortsatt på `480e0420`, § 1.8) | `bekreftDagTillegg.ts:118` (timerrad), `:198` (maskin, kommentar `:188` «Nye maskiner har ingen ECO»); `dagsforslagAnvend.ts:149` (timerrad), `:281` (maskin), vare `:292-309` uten ECO |
| **KortVareforbrukModal** (varer) | **NEI** egen velger; **etter 36b arver linja kortets ECO** (§ 1.8) | `09cfbb4d`: 0 treff; byggeplass-chips `:144-168` |
| Web vareforbruk-side | JA | `apps/web/src/app/dashbord/[prosjektId]/vareforbruk/page.tsx:359-360/377/413/422` |
| Web attestering/redigering | JA | `attestering-buckets.tsx:32/79/92/183-187/247-252`; `RedigerTimerRad.tsx:34/92-94`; `RedigerMaskinRad.tsx:46-48/160-165` |
| **Eksport** | **NEI** | `timer-rapport-eksport.ts` og `packages/shared/src/utils/timerDetaljRader.ts`: 0 treff. `rapport.ts:313-315`: «Fremtid (proadm-underprosjekt): … én kolonne + ett filter. Ikke bygget nå.» `timer.md:864` beskriver «Lønnsart-rader (med ECO per linje)» → proAdmId, men koden bærer det ikke |
| API-validering | Ulik | `vareforbruk.validerEco` sjekker firma + prosjekt + status (`480e0420`: `vareforbruk.ts:141-172`, kalles `:420-421`, `:579-580`). `tilfoyTimerRad` og `maskin.tilfoy` **validerer ikke** ECO mot firma/prosjekt; full sjekk finnes bare i `flyttTimerRadEco` (`480e0420`: `:4050`, validering `:4107`) |

**Mobil lokal DB** (`09cfbb4d`, `apps/mobile/src/db/schema.ts`): `sheetTimerLocal.externalCostObjectId` `:158`, `byggeplassId` `:153`; `sheetMachineLocal.sheetTimerId` `:218`, `externalCostObjectId` `:225`, ingen `byggeplassId`; `vareforbrukLocal.byggeplassId` `:962`, ingen `externalCostObjectId`. **Begge manglene er lukket av 36b — se § 1.8.**

**Sync** (`09cfbb4d`, `apps/mobile/src/services/timerSync.ts:758-775`): maskin-payload sender `sheetTimerId` `:761` og `externalCostObjectId` `:768`, ikke byggeplass. Timerrad-payload sender begge (`:712`, `:719`). Vare-payload uten ECO. **Endret av 36b — § 1.8.**

### 1.4 Maskin ↔ arbeidstimer — hvem setter `sheetTimerId`, og hvem lar den stå NULL

| Vei | `sheetTimerId` | `byggeplassId` (maskin) | Fil:linje |
|---|---|---|---|
| TimerRadModal med maskin-seksjon (hovedvei fra prosjektkort/dagskort) | SATT | — (arves implisitt via timeraden) | `nyTimerRad.ts:240-255` (`sheetTimerId: timerRadId` `:244`); redigering `TimerSeksjon.tsx:345/370` |
| `MaskinSeksjon.leggTil` (egen «+», skjult: `visHeader={false}` `ProsjektGruppe.tsx:369`) | NULL | — | `MaskinSeksjon.tsx:118-149` |
| SplittRadModal maskinrest | NULL | — | `SplittRadModal.tsx:320-334` |
| **Bekreft dag** (`skrivTillegg`) | **NULL** | — | `dagsforslagAnvend.ts:278` (+ `fraTid/tilTid: null` `:285-286`, ECO `null` `:281`); kommentar `:265` «maskin uten fra/til og uten timerrad-kobling» |
| Rader fra før koblingen fantes | NULL | — | skjema-kommentar `schema.prisma:534-541` |
| Web `maskin.tilfoy` | ikke i input | i input | `480e0420`: `dagsseddel.ts:7254-7259`; `sheetTimerId` finnes kun i `syncBatch` `:5882` |

**Kapasitetsvakt** «maskin ≤ arbeid» FINNES: `validerMaskinUnderArbeid` `dagsseddel.ts:1050-1063` → `beregnMaskinBrudd` `packages/shared/src/utils/maskinKapasitet.ts:79-107`. Bøtte = **(projectId, externalCostObjectId)** `:9`, nøkkel `:38-41`, tak = arbeid + `pauseMin/60` + `EPSILON_MASKIN_TIMER` `:53` (`:19`). Kalles ved `maskin.tilfoy`, `maskin.oppdater`, timerrad og `syncBatch` (feilmelding `480e0420`: `:1319` «Maskintimer … overstiger arbeidstimer … for prosjekt … / underprosjekt …»). Lokal vakt i Bekreft dag: `maskinBruddForTillegg` `bekreftDagTillegg.ts:188-198`.
**Byggeplass inngår ikke i bøtta.** «Maskintimer på en byggeplass overstiger arbeidstimene der» er derfor ikke dekket av dagens vakt — se § 2.3 og B4.

### 1.5 Visning i dag (prosjektkort/kortskjerm, `09cfbb4d`)

- Maskinrader leses **per sedel** (`kort/[projectId].tsx:114-116`), grupperes per ECO-bøtte, og rendres inline etter timerradene i bøtta (`ProsjektGruppe.tsx:359-363`). `sheetTimerId` brukes ikke i visningen.
- `MaskinRadVis` `MaskinSeksjon.tsx:340-435` viser MASKIN-merke, navn, internnummer, reg.nr, mengde, fra–til, timer. **Ikke byggeplass** (0 treff).
- Timerraden viser byggeplass på sekundærlinja `TimerSeksjon.tsx:773-779` (`rad.byggeplassId ?? sedelByggeplassId`, arvet nedtonet).
- `VareforbrukLesListe.tsx:22-51` viser kun `vare.navn`, antall/enhet, syncstatus. **Ikke byggeplass**; `VisVarelinje` `:8-15` har ikke feltet.
- `KortHode` `ProsjektkortSamleside.tsx:226` utleder kortets byggeplass fra timer + maskin (`utledKortByggeplass`), men maskin bidrar aldri: `prosjektkortMobil.ts:52-57` setter `byggeplassId: null` `:54`. Varer inngår ikke i utledningen. (36b erstatter samlesiden — § 1.8.)
- Eksportens nøsting: `rapport.ts:310-311` «maskin-rader bæres under sin timerad via SheetMachine.sheetTimerId»; `maskin.md:300-312`: Bekreft dag-maskin foldes ikke (sheetTimerId NULL).

### 1.6 Oversikt over flere dager — FINNES IKKE

- API: `vareforbruk.list` `vareforbruk.ts:289-347` krever `projectId` `:292` (per prosjekt, filtre fra/til/byggeplass/dagsseddel/vare). Ingen firma-vid oversikt per vare. Maskin-routeren `apps/api/src/routes/maskin/index.ts:8-14` (`equipment`, `vegvesenKo`, `ansvarlig`, `import`, `service`) leser aldri `sheetMachine` (0 treff). Nærmest: `timer.rapport.detaljEksport` `rapport.ts:317` med `periodeSchema` `:37-43` (`organizationId, fra, til, prosjektId?, ansattId?`) — **ingen `vehicleId`/`vareId`-filter**.
- Web: `dashbord/maskin/[id]/page.tsx:122` har seksjoner statushistorikk `:246`, ansvarlig `:294`, EU-kontroll `:375`, service `:446` — **ingen bruk/prosjekter**. `dashbord/firma/varelager/page.tsx:40` har faner `varer | kategorier` `:33` — 0 treff «vareforbruk». `dashbord/firma/timer/rapport/page.tsx:308` har filtre fra/til/prosjekt/ansatt, maskin nøstet `:383-393` — ingen maskin-/varefilter.
- `maskin.md:881-883`: `maskin.hentSpor` / `hentServicehistorikk` — ingen brukslogg pr. prosjekt. `maskin.md:695` har en Maskinoversikt-skisse (ikke bygget).

### 1.7 36b-grunnlaget — **merget 2026-11-08** (`3ff60370`, RETUR 4 `b85c7c6a`)

36b erstattet `ProsjektkortSamleside` med `src/components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt.tsx` og ren `src/utils/dagsoversikt.ts`. Ingen radikoner (§ 2.5 i [dagsoversikt-beskrivelse-spec.md](dagsoversikt-beskrivelse-spec.md)); trykk på linje åpner modal. **36d-1 bygger på denne.** Vakt-test: `apps/mobile/src/components/timer-detalj/dagskort-isolert-vakt.test.ts`.

### 1.8 Remåling etter 36b-merge (2026-11-08, `develop @ 480e0420`)

Det som har endret seg siden § 1.1–1.7 og som § 3 bygger på:

- **Kortet = (prosjekt, byggeplass, underprosjekt).** `KortValg { projectId; byggeplassId: string | null; ecoId: string | null }` `apps/mobile/src/lib/prosjektkortMobil.ts:182-186`, `kortNokkel` `:191` (`"<projectId>|<bp|ingen>|<up|ingen>"`), `kortNokkelFor` `:246`. Nøkkelen brukes av kortlista, ruten (`?bp=&up=`), Bekreft dag (`beskrivelsePerKort`) og «Flytt raden» (`:176-180`). **Underprosjekt er altså allerede en egen dimensjon ved siden av byggeplass i 36b** — modellen Kenneth beskriver 2026-11-08.
- **Kortvalg med underprosjekt-chips:** `KortValgModal` `src/components/timer-detalj/prosjektkort/KortValgModal.tsx:14-21`. Modus `ny` («+ Nytt kort»): underprosjekt-chips øverst med «Uten» forhåndsvalgt, start `ecoId: null` `:68`; K3 `:35-39`: 0–1 byggeplass **og** ingen underprosjekter (`hentUnderprosjekterLokalt(projectId).length > 0` er vilkåret) → kortet åpnes direkte uten modal. Modus `flytt` («Flytt raden»): prosjekt, byggeplass og underprosjekt som chips. Velgeren vises altså i dag **når prosjektet har aktive underprosjekter**, uavhengig av firma. (36c flytter `ny`-modusen fra P4 til Bekreft dag — § 3.8.)
- **Varer arver kortet:** `KortVareforbrukModal.tsx:35-38` (kommentar), payload `externalCostObjectId: kortLaas?.ecoId ?? null` `:145`; byggeplass = kortets effektive (`vareByggeplassForKort`, RETUR 4). Ingen byggeplass-velger under `kortLaas` — retting via «Flytt raden». Uten `kortLaas`: som før (chips).
- **Lokal DB og sync bærer begge felt nå:** `vareforbrukLocal.byggeplassId` `schema.ts:966`, `externalCostObjectId` `:968`; `vareforbrukSync.ts:35` (`VarelinjeValg` inkl. begge), `:48`, `:151`, `:175`. `sheetMachineLocal.byggeplassId` `schema.ts:229` (kommentar `:226-228`: «NULL = arver sedelens byggeplass … speil av server `sheet_machines.byggeplass_id`»). → **B5 er innfridd av 36b**; testene 12/14 fra 2026-11-07 utgår (§ 7).
- **Bekreft dag er fortsatt uten underprosjekt:** `app/timer/bekreft-dag.tsx:703/705` (`kortNokkel({ …, ecoId: null })`), `src/utils/bekreftDag.ts:121` (`arvKort … ecoId: null`), `bekreftDagTillegg.ts:118/198`, `dagsforslagAnvend.ts:150` (timerrad) og `:280` (maskin). 0 treff på `externalCostObjectId|underprosjekt` i `dagsforslagInput.ts`. **Ingen 36c-commit på develop** (`git log -- app/timer/bekreft-dag.tsx`: nyeste `b85c7c6a`, `2c0fab3e`, `0aef2e8b`).
- **Lokal ECO-tabell:** `externalCostObjectLocal` `schema.ts:481-493` (`id, organizationId, projectId, proAdmId notNull, kortNavn, kilde, status, timerregistreringApen, sistOppdatert`). Pull `timerKatalog.ts:78` → `eksternKostObjekt.list` uten `projectId`; server filtrerer `slettetVed: null`, `status: "aktiv"`, `timerregistreringApen: true` (`eksternKostObjekt.ts:40-44`); lokalt overskrives hele tabellen. «Aktive underprosjekter» lokalt = `hentUnderprosjekterLokalt(projectId)` `timerKatalog.ts:398-412`.
- **API-linjer (`dagsseddel.ts`):** `tilfoyTimerRad` `:2037` (ECO-input `:2056`), `oppdaterTimerRad` `:2207` (`:2217`), `forsonDagskort` `:2446` (`:2466/:2487`), `flyttTimerRadEco` `:4050` (`z.string().uuid().nullable()` `:4054` — null er lov; validering `:4107`), `redigerSedelRader` `:4548` (`:4573`), `syncBatch` `:5882` (`:5927/:5984`), `maskin: router` `:7253`, `maskin.tilfoy` `:7254` (`:7259`, lagring `externalCostObjectId: input.externalCostObjectId ?? null` `:7298/:7316`), `maskin.oppdater` `:7331` (`:7336`). Alle `.nullable().optional()` unntatt `flyttTimerRadEco`.
- **Opprettelse av underprosjekt finnes ikke i kode:** `externalCostObject.(create|upsert|createMany|update|updateMany|delete)` i hele repoet = **0 treff**. `eksternKostObjekt.ts:13-14`: «kun lese-operasjoner … Opprettelse skjer via Proadm-import eller dedikert admin-flyt (ikke her)» — ingen av delene er bygget. Bærer F-U3. Proadm-kjeden (import → ECO → dokumentflyt) er ikke målt — utsatt av Kenneth (§ 3.7).
- **Firmagrense H1 + H3** (`1b6b856e`) flyttet linjer i `dagsseddel.ts` og `rapport.ts` etter at UE-utredningen ble levert; tallene over er etter den.

---

## 2. 36d-1 — maskin- og varekontroll i dagsoversikten (mobil, prosjektkort) — 🟢 VEDTATT 2026-11-07

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
| Maskinrad med egen `byggeplassId` ≠ timeradens | vis maskinens egen | normal tekst (ikke arvet). Etter 36b bærer mobil feltet selv (`sheetMachineLocal.byggeplassId` `schema.ts:229`, § 1.8) |

«Ikke knyttet» er **informasjon**, ikke sperre. Bekreft dag-maskin (`dagsforslagAnvend.ts:278`) vil alltid få denne markeringen i dag → brukeren ser hvorfor og kan trykke raden og knytte den (§ 2.4). Kenneths setning «Maskin er ikke knyttet til arbeidsgiver etter registrering» leses som nettopp dette: maskinen fra Bekreft dag har ingen timerad.

### 2.2 Byggeplass på maskin

Maskinraden får byggeplass i oversikten **uten skjemaendring**: den utledes fra timeraden den er knyttet til (§ 2.1), eller fra maskinens egen `byggeplassId` når den er satt (36b). For `sheetTimerId` NULL og egen `byggeplassId` NULL vises ingen byggeplass (ingen gjetting), kun markeringen.

**B5 VEDTATT 2026-11-07** («nei i 36d-1, vurderes i 36d-2») er overtatt av 36b: `sheetMachineLocal.byggeplassId` finnes (`schema.ts:229`, § 1.8). Ingen ny beslutning trengs.

### 2.3 «Maskintimer på en byggeplass overstiger arbeidstimene der»

Dagens vakt (`maskinKapasitet.ts`) er per (prosjekt, ECO) og håndheves hardt på server. En byggeplass-regel kan ikke håndheves på samme måte uten funksjonsendring (den ville sperre lagring). Spec-en foreslår en **ren visningsregel** i oversikten:

- Per prosjekt og effektiv byggeplass (timeradens `byggeplassId ?? sedelByggeplassId`): `sum(maskin nøstet under timerader med den byggeplassen) > sum(arbeidstimer med den byggeplassen) + pauseMin/60` → amber prikk på Maskin-linjen + mikrotekst «Maskin 5,0 t over arbeid 3,0 t på Lillestrøm skole». Samme `EPSILON_MASKIN_TIMER` som `maskinKapasitet.ts:19`.
- Maskin med `sheetTimerId` NULL teller **ikke** i byggeplass-summen (ingen byggeplass å telle mot) — de har allerede egen markering.
- Ingen sperre, ingen Alert, ingen toast. Ingen endring i server-vakten.

**B4 VEDTATT 2026-11-07: kun visning** (amber) i 36d-1. Ingen server-sperre — det ville vært funksjonsendring i `validerMaskinUnderArbeid` + bøttenøkkel med virkning for dagskort, web og sync.

### 2.4 Trykk på maskinrad (knytte til arbeidstimer)

36b/§ 2.5: ingen radikoner, trykk åpner modal. Trykk på en «ikke knyttet»-maskinrad åpner `MaskinRadModal` (`MaskinSeksjon.tsx:436`) som i dag. Å **knytte** raden til en timerad finnes ikke i noen modal i dag (`maskin.oppdater` `480e0420`: `dagsseddel.ts:7331` har ikke `sheetTimerId`; mobil-sync bærer den kun ved opprettelse). Spec-en foreslår i 36d-1 en valgfri velger «Hører til arbeidstimer» i `MaskinRadModal` (liste over sedelens timerader for samme prosjekt), som setter `sheetTimerId` lokalt og krever at `syncBatch` allerede bærer feltet — det gjør den. Web `maskin.oppdater` trenger `sheetTimerId` i input for paritet.

**B3 VEDTATT 2026-11-07: ja, i 36d-1.** `MaskinRadModal` brukes også av det gamle dagskortet → velgeren gates bak prop `visKnytting?` med dagens default `false` (B2-presisering § 0 / § 3.3) og test i `dagskort-isolert-vakt.test.ts`.

### 2.5 Varer per byggeplass

Varer-linjen i 36b lister varelinjene (ikke bare telling). Per linje: `vareNavn`, antall + enhet, byggeplassnavn fra `vareforbrukLocal.byggeplassId` (`480e0420`: `schema.ts:966`) slått opp i lokal byggeplass-cache (`hentByggeplasserForProsjektLokalt`, allerede brukt i `KortVareforbrukModal`). `byggeplassId` NULL → amber prikk + «Hele prosjektet» (samme ordlyd som chip-en `vareforbruk.felt.byggeplassIngen`). Når prosjektet ikke har byggeplasser i det hele tatt (`byggeplasser.length === 0`), vises **ingen** markering — det er ikke en mangel. Trykk på linje åpner `KortVareforbrukModal` med linjen forhåndsvalgt (36b).

`VisVarelinje` (`VareforbrukLesListe.tsx:8-15`) brukes av dagskortet og utvides **ikke**; oversikten får egen linjetype i `dagsoversikt.ts`.

### 2.6 Server-varelinjer vs. lokale

Kortskjermen viser server-linjer + lokale (`kort/[projectId].tsx:212-222`). Oversikten gjør det samme; server-linjer har `byggeplassId` fra `vareforbruk.list`. Begge kilder får samme markering.

### 2.7 Dagskort-isolering

- `dagsoversikt.ts` og ny komponent under `prosjektkort/` er kun i prosjektkort-grenen.
- Delte komponenter som endres (kun § 2.4 `MaskinRadModal`): ny prop med dagens default, vakt-test utvides med «dagskort rendrer MaskinRadModal uten knytte-velger».
- Diff i `app/timer/[id].tsx` = 0 (gate).

---

## 3. 36d-2 — firmavalg «bruker firmaet underprosjekt i registreringen?» (av/på) — 🟢 VEDTATT 2026-11-08

> **Erstatter § 3 av 2026-11-07** («byggeplass | underprosjekt», enten/eller). Byggeplass er **alltid** med, som i dag og som 36b bygde kortet. Underprosjekt er en **frivillig tilleggsdimensjon** som firmaet slår av eller på. Når den er på, kan en registrering bære prosjekt + byggeplass + underprosjekt samtidig (Kenneth utsagn 1); feltet kan alltid stå tomt (utsagn 2).

### 3.1 Hvor innstillingen bor — B1 (🟢 VEDTATT 2026-11-08)

**Anbefaling:** nytt boolsk felt på `OrganizationSetting` i **`packages/db`** (kjernen):

```prisma
// Underprosjekt i registreringen (Kenneth 2026-11-08): når true kan ansatte velge
// underprosjekt (ExternalCostObject) i tillegg til byggeplass for arbeidstimer,
// maskintimer og varer i prosjektkort-flyten og Bekreft dag. Feltet på raden er
// alltid frivillig. false = velgeren vises ikke; eksisterende rader beholdes.
// Default false, ingen backfill.
benytterUnderprosjekt Boolean @default(false) @map("benytter_underprosjekt")
```

**Navn:** `benytterUnderprosjekt` følger Kenneths ordlyd («om firmaet skal benytte underprosjekt») og de boolske feltenes verb-først-form (`tillattSelvAttestering` `:414`, `tillattRedigerVedAttestering` `:425`, § 1.2). Vurdert og forkastet: `foringsnivaa` (enten/eller-semantikk, utgår), `underprosjektAktiv` (lett å blande med `ExternalCostObject.status "aktiv"` per objekt), `visUnderprosjekt` (beskriver UI, ikke firmaets valg).

**Default `false`.** Begrunnelse: (a) ingen firma har i dag en måte å opprette underprosjekt på (§ 1.8: 0 create-kall) — for alle firmaer uten ECO-rader er velgeren allerede usynlig via K3 (`KortValgModal.tsx:35-39`), så `false` endrer ingenting synlig for dem; (b) default dekker alle eksisterende rader → ingen stille tomhet, ingen backfill. **Merk for deploy-notatet:** firmaer som *har* ECO-rader (`SELECT organization_id, count(*) FROM external_cost_objects WHERE slettet_ved IS NULL GROUP BY 1`) mister underprosjekt-chips i `KortValgModal` til innstillingen slås på for dem. Listen tas i deploy-notatet (test først), og sitedoc_admin/firma-admin slår på. Alternativ default `true` (bevarer dagens 36b-oppførsel for alle) er mulig, men gjør «firmaet velger» til «firmaet velger bort» — Kenneth avgjør i B1.

Begrunnelse for plassering: (a) innstillingen er **ikke** en firmamodul-tabell — den er en firmainnstilling som tre moduler leser, nøyaktig som `timerRegistreringsmodus` `:488` og tilgangs-defaultene `:382-384`; (b) `ExternalCostObject` selv ligger i kjernen `:2798`; (c) mobil-speilet `organizationSettingLocal` `schema.ts:611-649` finnes og gir offline-lesing. Regelen «firmamodulers tabeller aldri i `packages/db`» brytes ikke.

Alternativ (ikke anbefalt): `OrganizationModule.config Json` per modul (`:320`) — tre uavhengige valg, strider mot «ett valg», leses ikke av noen i dag.

**Skjemaendring = ja** (ny kolonne i `packages/db`, migrering via Prisma). **B1 må godkjennes på nytt av Kenneth** (navn, type, default). Migreringen kjøres via deploy-flyten, aldri av agenten.

Lag som følger presedensen (§ 1.2, `480e0420`): `oppdaterSetting`-input `organisasjon.ts:1279` (ny `benytterUnderprosjekt: z.boolean().optional()`), `hentArbeidstidDefaults`-select `:1242`-området; web `firma/innstillinger/page.tsx` ny avkrysningsboks-seksjon etter mønster `RedigerVedAttesteringSeksjon` `:842-881`; mobil `organizationSettingLocal` ny integer-boolean-kolonne (mønster `tillattRedigerVedAttestering` `schema.ts:616-620`) + ALTER i `migreringer.ts` + mapping `organizationSettingKatalog.ts:53-91` + ny `lesBenytterUnderprosjektLokalt(organizationId)` ved siden av `lesTimerModusLokalt` `:113`; manglende/ukjent verdi → `false`.

### 3.2 Hva valget styrer — «på»

Valget styrer **om underprosjekt-velgeren vises** i prosjektkort-flyten og Bekreft dag. Det endrer **ikke** skjema på radene, sync-payload eller server-validering, og det sletter/omskriver aldri eksisterende rader. Byggeplass-velgerne er **uendret i begge tilstander**.

Regler for velgeren når valget er **på**:

- Vises **sammen med** prosjekt og byggeplass, der kortet velges: `KortValgModal` modus `ny` og `flytt` (chips, som 36b `:14-21`), Bekreft dag (§ 3.8), og — via kortet — for timer, maskin og varer på kortet.
- **Frivillig:** tomt ved åpning («Uten» er startverdien, som `ecoId: null` `KortValgModal.tsx:68`), aldri forhåndsvalgt fra et annet kort eller en annen dag, ingen «påkrevd»-validering, kan tømmes igjen («Uten»/«Flytt raden» til kort uten underprosjekt — `flyttTimerRadEco` tar `null` `:4054`). Tomt lagres som `NULL` i `externalCostObjectId`.
- **Rader på et kort arver kortets underprosjekt** (36b: `kortLaas.ecoId` i `KortVareforbrukModal.tsx:145`, timer/maskin via kortet). Det er ikke forhåndsvalg — det er kortets identitet (`kortNokkel`). Brukeren som vil føre uten underprosjekt velger/åpner kortet uten.
- Vises bare når prosjektet har aktive underprosjekter lokalt (`hentUnderprosjekterLokalt(projectId)`, `timerKatalog.ts:398-412`), ellers er det ingenting å velge (K3 som i dag). Vilkåret blir altså **`benytterUnderprosjekt && underprosjekter.length > 0`**.
- Server: ingen ny vakt på «påkrevd». Den eksisterende integritetssjekken (finnes, samme firma og prosjekt, aktiv, `timerregistreringApen`) skal gjelde alle ruter (§ 3.6) — det er korrekthet, ikke påkrevd-het.

| Flate (prosjektkort-grenen) | «av» | «på» |
|---|---|---|
| `KortValgModal` `ny`/`flytt` | underprosjekt-chips **skjules** (prop fra firmavalget); byggeplass-chips som i dag; K3 = «0–1 byggeplass → direkte» | som 36b: chips med «Uten» først; K3 som i dag |
| `TimerRadModal` / `MaskinRadModal` på kortet | ECO-feltet (`TimerSeksjon.tsx:1781-1794` / `MaskinSeksjon.tsx:844-858`) **skjules** via prop med dagens default (vist) — dagskortet uendret (§ 3.3); raden arver kortets `ecoId` som før | feltet vist, forhåndsutfylt med kortets underprosjekt (kortets identitet), kan endres → raden flyttes til annet kort (36b-regel) |
| `KortVareforbrukModal` under `kortLaas` | som i dag (ingen egen velger; arver kortet `:145`) | som i dag (arver kortet) |
| **Bekreft dag** — timer, maskin, varer | som i dag (`ecoId: null` `bekreft-dag.tsx:703/705`, `bekreftDag.ts:121`, `dagsforslagAnvend.ts:150/280`, `bekreftDagTillegg.ts:118/198`) | ny frivillig velger «Underprosjekt» per prosjekt(kort) i Bekreft dag; valgt verdi til `anvendDagsforslag`/`skrivTillegg` for timer, maskin og varer under det kortet; tomt → `null`. Byggeplass som i dag |
| Dagsoversikt 36d-1 | byggeplass-kontroll (§ 2) | byggeplass-kontroll (§ 2) **pluss** kortets underprosjekt i korthodet; **ingen amber for tomt underprosjekt** — tomt er lovlig (utsagn 2). Nøytral tekst «Uten underprosjekt» bare der kort grupperes |
| Web vareforbruk-side, attestering, redigering | begge felt, uendret (admin-flater viser alltid begge) | uendret |

### 3.3 Konsekvens for det gamle dagskortet `app/timer/[id].tsx` — B2 VEDTATT B2-a med presisering

Dagskortet viser i dag ECO-bøtter og ECO-velger **alltid** (§ 1.3). Et firma med valget «av» vil etter 36d-2 fortsatt se «Underprosjekt»-feltet i dagskortets `TimerRadModal`/`MaskinRadModal` og ECO-gruppering i `ProsjektGruppe`, mens prosjektkort-flyten skjuler det.

**B2 VEDTATT 2026-11-07 = B2-a, med Kenneths presisering (§ 0):** det gamle dagskortet i dagskortmodus står uendret. Prosjektkort-flyten (36b-dagsoversikten, prosjektkortet `app/timer/[id]/kort/[projectId].tsx` + `prosjektkort.tsx`, og Bekreft dag) er «det nye dagskortet» og tilpasses fritt. Delte komponenter (`TimerRadModal`, `MaskinRadModal`, `ProsjektGruppe`) får prop med dagens default slik at dagskortmodus ikke endrer oppførsel; `dagskort-isolert-vakt.test.ts` utvides (§ 7 test 19). Revisjonen 2026-11-08 endrer ikke dette.

### 3.4 Eksisterende rader — «av» og «på», ingen stille tomhet, ingen gjetting

- **Valget slås på:** rader med `externalCostObjectId` NULL (alle Bekreft dag-rader til nå, alle rader uten valg) **beholdes uendret**. Ingen migrering, ingen backfill (ingenting å utlede fra — byggeplass er SiteDoc-intern uten Proadm-motpart, `terminologi.md:209`). De vises som kort «uten underprosjekt» — uten markering (§ 3.2).
- **Valget er/slås av:** rader som **har** `externalCostObjectId` (ført på web, via Proadm-import i fremtiden, eller mens valget var på) **beholdes uendret og vises uendret** der de vises: kortnøkkelen bærer fortsatt `ecoId`, så kortet står som eget kort med underprosjekt-navnet i korthodet (`kortNavn` fra `externalCostObjectLocal`), raden vises under det kortet, attestering/web viser feltet som før. Det eneste som forsvinner er **velgeren** — brukeren kan ikke sette eller endre underprosjekt på mobil mens valget er av (web kan). Nye rader på et eksisterende kort med underprosjekt arver kortets `ecoId` (36b) også når valget er av — det er dataen på kortet, ikke et valg.
- Rader som har **både** byggeplass og underprosjekt vises med begge (korthodet og sekundærlinja). Ingen av dem skjules i data.
- Attestering (`attestering-buckets.tsx`) viser ECO-bøtter som i dag — uavhengig av valget. Rader uten ECO ligger i hovedbøtta (null først, `ProsjektGruppe.tsx:137-141`-mønsteret).

### 3.5 Bytte midt i en periode — eksport, lønn, attestering

Målt: eksporten bærer **verken** byggeplass-dimensjon på maskin/vare **eller** underprosjekt (§ 1.3, `rapport.ts:313-315`). Lønnsgrunnlaget (`SheetTimer.timer`, lønnsart, tillegg) er uavhengig av begge feltene. Derfor:

- Bytte av `benytterUnderprosjekt` endrer **ingen** tall i attestering, lønn eller eksport og **ingen rad**. Perioden kan få blandede rader (med/uten underprosjekt) — synlig i kortlista og i web-redigering, ikke i eksporten.
- Innstillingen skal **ikke** lagres på raden eller sedelen (ingen `benytterUnderprosjektVedFøring`-kolonne). Feltene selv (`byggeplassId`/`externalCostObjectId` satt eller NULL) er fakta; valget er et UI-filter. Ingen ny identitetskolonne på radene → ingen stille tomhet.
- **B6 VEDTATT 2026-11-07:** web-rapporten får ECO som kolonne + filter (`rapport.ts:313-315` «ikke bygget nå») som **del av 36d-3**, ikke i 36d-2.

### 3.6 Server-validering — paritetshull (uendret fra 2026-11-07, linjer `480e0420`)

`tilfoyTimerRad` `dagsseddel.ts:2037`, `oppdaterTimerRad` `:2207`, `syncBatch` `:5882`, `maskin.tilfoy` `:7254` (lagrer rett: `:7298/:7316`) og `maskin.oppdater` `:7331` validerer ikke ECO mot firma/prosjekt/status; kun `flyttTimerRadEco` `:4050-4107` og `vareforbruk.validerEco` `vareforbruk.ts:141-172` gjør det. Mobil-velgeren filtrerer på prosjekt + aktiv (`TimerSeksjon.tsx:2280-2285`, `hentUnderprosjekterLokalt`), så i praksis sendes gyldige verdier, men web/`syncBatch` kan sende hva som helst. 36d-2 gjenbruker `validerEco`-logikken i alle fem. Sikkerhets-/korrekthetsendring uten brukersynlig tap → ingen hjemmel-krav, men nevnes (`feedback_sikkerhet_fritar_ikke`). **Ikke** en «påkrevd»-vakt — tomt er alltid lov.

### 3.7 Underprosjekt finnes — og timer, maskin og varer kan føres mot det

**1. Underprosjekt finnes som entitet i dag:** `ExternalCostObject` `packages/db/prisma/schema.prisma:2798` (UI-term «Underprosjekt», `terminologi.md:209`): `organizationId`, `projectId` (per prosjekt), `proAdmId String` (påkrevd, `:2803`), `kilde` («proadm_import» | «manuell» | «felt_opprettet», `:2808`), `kortNavn`, `status` («aktiv» | «lukket», `:2811`), `timerregistreringApen Boolean` (`:2812`), `slettetVed?`, `@@unique([organizationId, proAdmId])` `:2832`. Leses av `eksternKostObjekt.list` (`eksternKostObjekt.ts:25-60`, filter aktiv + åpen `:40-44`) og speiles lokalt i `externalCostObjectLocal` `apps/mobile/src/db/schema.ts:481-493` (pull `timerKatalog.ts:78`, oppslag `hentUnderprosjekterLokalt` `:398-412`). Ingen opprettelsesflate finnes (§ 1.8, F-U3).

**2. Når firmavalget er på, kan timer føres mot et underprosjekt.** Radene bærer feltet allerede (`SheetTimer.externalCostObjectId` `packages/db-timer/prisma/schema.prisma:245`, API `tilfoyTimerRad` `dagsseddel.ts:2056`), og 36b gjør underprosjekt til del av kortet (`KortValg.ecoId`, § 1.8). 36d-2 legger til firmavalget som vilkår for velgeren (§ 3.2) og velgeren i Bekreft dag. **Maskin og varer følger de samme reglene:** `SheetMachine.externalCostObjectId` `:553` / `maskin.tilfoy` `dagsseddel.ts:7259`; `Vareforbruk.externalCostObjectId` `packages/db-varelager/prisma/schema.prisma:79` / `vareforbruk.opprett` `vareforbruk.ts:385`. Alle tre arver kortets underprosjekt (§ 3.2), alle tre kan stå tomme (NULL).

**Proadm:** Import av Proadm-endringsmeldinger via underprosjekt — senere, dialog ikke startet (Kenneth 2026-11-08).

### 3.8 Forhold til 36c-mellomløsningen

36c (bestilt hos Redesign, **ikke på develop `480e0420`**) flytter «+ Nytt kort» (P4) inn i Bekreft dag og gir Bekreft dag et **frivillig underprosjekt-valg når prosjektet har aktive underprosjekter** (vilkåret er K3-regelen `hentUnderprosjekterLokalt(projectId).length > 0`, samme som `KortValgModal.tsx:35-39`). Det er en mellomløsning uten firmavalg.

**36d-2 erstatter den regelen med firmavalget:** vilkåret for å vise underprosjekt-valget i Bekreft dag (og i `KortValgModal`) blir `benytterUnderprosjekt && underprosjekter.length > 0`. Oppførselen for øvrig (tomt ved åpning, frivillig, tomt → `NULL`) beholdes fra 36c. Rader ført via 36c-mellomløsningen med underprosjekt beholdes uendret (§ 3.4).

---

## 4. 36d-3 — web-oversikt over flere dager (Maskin- og Varelager-modul) — 🟢 VEDTATT 2026-11-07

Egen, senere leveranse (Kenneth: «oversikt over flere dager er også OK slik som beskrevet»).

### 4.1 Maskin

- Ny prosedyre `maskin.equipment.bruk` (i `apps/api/src/routes/maskin/`, leser `prismaTimer.sheetMachine` — første lesning av timer-skjema fra maskin-routeren; krever `krevMaskinAktivert` + firma-grense). Input: `organizationId`, `vehicleId?`, `fra`, `til`, `prosjektId?`. Returnerer rader: dato, prosjekt, byggeplass (via nøstet timerad når `sheetTimerId` satt, ellers maskinens egen `byggeplassId` `:546`, ellers «—»), underprosjekt (`proAdmId · kortNavn`), ansatt, timer, `sheetTimerId` NULL-flagg («ikke knyttet»), attestertStatus. Sum per prosjekt/byggeplass/underprosjekt.
- Web: ny seksjon «Bruk» på `dashbord/maskin/[id]/page.tsx` (etter service `:446`) med periode-filter, og ny fane/side under `dashbord/maskin` «Bruk per periode» (alle maskiner, filtre maskin/prosjekt/periode). Samme «ikke knyttet»-markering som 36d-1.

### 4.2 Varer

- `vareforbruk.list` `:289` krever `projectId`. Ny `vareforbruk.listForFirma` (`organizationId`, `vareId?`, `prosjektId?`, `fra`, `til`): alle prosjekter i firmaet, grupperbart per vare → prosjekt → byggeplass → underprosjekt. «Hele prosjektet»-flagg når `byggeplassId` NULL (underprosjekt tomt er ikke en mangel, § 3.2).
- Web: ny fane «Forbruk» i `dashbord/firma/varelager/page.tsx` (`type Fane` `:33` utvides) + «Forbruk»-seksjon på varedetalj om den finnes.

### 4.3 Eksport (B6)

ECO-kolonne + filter i `timer.rapport.detaljEksport` (`rapport.ts:313-315`-planen), og byggeplass-kolonne for maskin via nøstet timerad.

---

## 5. Rekkefølge — 🟢 VEDTATT 2026-11-07 (B7)

| Rekkefølge | Leveranse | Avhenger av | Begrunnelse |
|---|---|---|---|
| 1 | **36b** (dagsoversikt A, inkl. hurtigvelg) — **merget `3ff60370`** | — | 36d-1 rendrer i `ProsjektkortDagsoversikt` |
| 2 | **36c** | 36b | Redesigns leveranse; 36d-1 legges etter den (vedtak 2026-11-07). Bærer mellomløsningen § 3.8 |
| 3 | **36d-1** maskin- og varekontroll i oversikten (§ 2) | 36b | Svarer direkte på begge Kenneth-funnene uten skjemaendring; viser «Hele prosjektet»/«Ikke knyttet» som er kontrollen |
| 4 | **36d-2** firmavalg av/på + underprosjekt i Bekreft dag (§ 3) | B1 (🟢 vedtatt); 36c (erstatter mellomløsningen) | Skjemaendring i `packages/db` + mobil-kolonne; bør ikke blandes med 36d-1 |
| 5 | **36d-3** web-oversikt (§ 4) | 36d-2 for underprosjekt-kolonnen; ellers uavhengig | Kan starte parallelt med 36d-2 etter 36d-1 |

---

## 6. i18n (nb + en, generer `--only`)

| Nøkkel | nb |
|---|---|
| `dagsoversikt.maskin.ikkeKnyttet` | Ikke knyttet til arbeidstimer |
| `dagsoversikt.maskin.overByggeplass` | Maskin {{maskin}} t over arbeid {{arbeid}} t på {{byggeplass}} |
| `dagsoversikt.vare.heleProsjektet` | Hele prosjektet |
| `dagsoversikt.underprosjekt.ingen` | Uten underprosjekt |
| `maskin.felt.horerTilArbeid` | Hører til arbeidstimer |
| `firma.innstillinger.underprosjekt.tittel` | Underprosjekt i registreringen |
| `firma.innstillinger.underprosjekt.beskrivelse` | Når valget er på, kan ansatte velge underprosjekt i tillegg til byggeplass for timer, maskin og varer på mobil og i Bekreft dag. Valget er alltid frivillig. Rader som allerede er ført, endres ikke. |
| `firma.innstillinger.underprosjekt.paa` | Bruk underprosjekt |
| `bekreftDag.felt.underprosjekt` | Underprosjekt |

Nøklene `firma.innstillinger.foringsnivaa.*` og `vareforbruk.felt.underprosjekt` fra 2026-11-07 utgår (varer arver kortet; ingen egen velger). Mikrotekst etter § 3a: beskrivelsen sier hvor det flytter (mobil/Bekreft dag), at det er frivillig, og hva som skjer med det som finnes (uendret).

---

## 7. Tester som skal feile før kode (gate)

**36d-1** (`dagsoversikt.test.ts`, ren funksjon) — uendret fra 2026-11-07:
1. Maskin med `sheetTimerId` = T1 nøstes under T1 og arver T1s byggeplass; arvet fra sedel når T1 har NULL.
2. Maskin med `sheetTimerId` NULL → linje med `ikkeKnyttet: true`, ingen byggeplass (med mindre egen `byggeplassId` er satt).
3. Maskin med `sheetTimerId` som ikke finnes i radene → som NULL.
4. Byggeplass-sum: 3,0 t arbeid + 0 pause på B1, 3,5 t nøstet maskin på B1 → `overByggeplass` for B1; 3,0 t maskin → ingen (EPSILON).
5. Pause teller: 3,0 t arbeid + 30 min pause, 3,4 t maskin → ingen.
6. Maskin NULL teller ikke i byggeplass-summen.
7. Vare `byggeplassId` NULL med `byggeplasser.length > 0` → `heleProsjektet: true`; med 0 byggeplasser → `false`.
8. Server-linje og lokal linje får samme markering.
9. `dagskort-isolert-vakt.test.ts`: `MaskinRadModal` uten `visKnytting` rendrer ingen «Hører til arbeidstimer»; diff-gate `[id].tsx` = 0.

**36d-2** (revidert 2026-11-08):
10. `OrganizationSetting.benytterUnderprosjekt` default `false` for eksisterende firma (migreringstest: `SELECT count(*) WHERE benytter_underprosjekt IS NULL` = 0).
11. `oppdaterSetting` tar `benytterUnderprosjekt: boolean`; streng/`null` avvises (Zod).
12. `KortValgModal` modus `ny` og `flytt` med valget **av** og prosjekt med aktive underprosjekter: ingen underprosjekt-chips, byggeplass-chips som i dag. Med **på**: chips med «Uten» forhåndsvalgt, `ecoId` starter `null`.
13. Bekreft dag med **på** og prosjekt med aktive underprosjekter: velgeren vises tom; uten valg lagres `externalCostObjectId: null` på timer, maskin og vare; med valg får alle tre under kortet samme `ecoId`. Byggeplass-payload identisk med i dag i begge tilfeller.
14. Bekreft dag med **av**, eller prosjekt uten aktive underprosjekter: ingen velger; payload som i dag (`null`).
15. `TimerRadModal`/`MaskinRadModal` i prosjektkort-grenen med **av**: ECO-feltet rendres ikke; raden lagres med kortets `ecoId` (uendret arv). Dagskort-grenen (`dagskort-isolert-vakt.test.ts`): feltet rendres som før uansett innstilling.
16. `tilfoyTimerRad`/`oppdaterTimerRad`/`maskin.tilfoy`/`maskin.oppdater`/`syncBatch` avviser ECO fra annet prosjekt/firma/lukket (paritet med `validerEco`); `null` godtas alltid.
17. Bytte av `benytterUnderprosjekt` begge veier endrer ingen rad (SELECT før/etter identisk) og ingen eksport-tall; kort med `ecoId` vises med underprosjekt-navn etter bytte til **av**.
18. Mobil leser `benytterUnderprosjekt` offline fra `organizationSettingLocal`; manglende/ukjent → `false`.
19. Vilkår «aktive underprosjekter»: **på** + 0 aktive → ingen velger (K3); **på** + 1 lukket → ingen velger.

**36d-3:**
20. `maskin.equipment.bruk` filtrerer på firma (annet firmas maskin → FORBIDDEN) og periode; «ikke knyttet»-flagg ved NULL.
21. `vareforbruk.listForFirma` filtrerer på firma; «hele prosjektet» ved `byggeplassId` NULL.

---

## 8. Åpne funn — underprosjekt generelt (noteres, løses ikke her)

- F-U1: ECO-validering mangler i `tilfoyTimerRad`/`oppdaterTimerRad`/`maskin.tilfoy`/`maskin.oppdater`/`syncBatch` (§ 3.6).
- F-U2: Eksport/lønn bærer ikke ECO selv om `timer.md:864` sier det (`timerDetaljRader.ts`, `timer-rapport-eksport.ts`: 0 treff). Doc-feil eller manglende kode — avklares i 36d-3/B6.
- **F-U3 (skjerpet 2026-11-08):** underprosjekt kan **ikke opprettes noe sted** — 0 create-kall i repoet, `eksternKostObjekt`-routeren er kun lesing (`eksternKostObjekt.ts:13-14`), Proadm-import finnes ikke (§ 1.8). `proAdmId` er påkrevd og unik per firma (`schema.prisma:2803/:2832`), så en manuell opprettelsesflate må gi feltet en verdi. Inntil import eller opprettelse finnes er firmavalget «på» uten virkning for alle firmaer. Bør få egen ordre (web firma-admin: opprett/lukk underprosjekt, `kilde "manuell"`) — Kenneth avgjør om før eller etter 36d-2. Proadm-import: senere (§ 3.7).
- F-U4: `ExternalCostObject` er per prosjekt. Byggeplass er også per prosjekt. Ingen kobling byggeplass ↔ underprosjekt finnes eller er ønsket (`terminologi.md:209`).
- F-U5: `maskin.tilfoy` kaller ikke `verifiserProsjekterTilhørerFirma` (gjør `tilfoyTimerRad`).
- F-U6: `SplittRadModal` maskinrest mister `sheetTimerId` (`:320-334`) — splittede maskiner blir «ikke knyttet».
---

## 9. Beslutninger

| # | Spørsmål | Anbefaling | Status |
|---|---|---|---|
| **B1 (revidert 2026-11-08)** | Innstillingen `benytterUnderprosjekt Boolean @default(false)` som ny kolonne på `OrganizationSetting` i `packages/db` (kjernen), ingen backfill; deploy-notat lister firmaer med eksisterende ECO-rader som må slås på. Skjemaendring = ja. | Ja — følger de boolske feltenes presedens (`:414/:425`); erstatter `foringsnivaa`. Default `false` (alternativ `true` beskrevet § 3.1) | **🟢 JA** (2026-11-08, «Ja, i tillegg») — navn, type og default `false` som anbefalt. Migrering via deploy-flyten, aldri av agenten |
| **B2** | Dagskortet `app/timer/[id].tsx`: følge firmavalget eller uendret? | B2-a uendret | **🟢 JA B2-a + presisering** (2026-11-07): gamle dagskortet uendret; prosjektkort-flyten (36b, prosjektkort, Bekreft dag) er «det nye dagskortet» og tilpasses |
| **B3** | § 2.4 «Hører til arbeidstimer»-velger i `MaskinRadModal` (prop-gated)? | Ja i 36d-1 | **🟢 JA** |
| **B4** | Byggeplass-overskridelse maskin > arbeid: kun visning eller server-sperre? | Kun visning | **🟢 JA** |
| **B5** | `sheetMachineLocal.byggeplassId` + sync? | Nei i 36d-1 | **🟢 JA** — innfridd av 36b (`schema.ts:229`), ingen rest |
| **B6** | ECO-kolonne + filter i rapport/eksport? | Ja, i 36d-3 | **🟢 JA** |
| **B7** | Rekkefølge | 36b → 36c → 36d-1 → 36d-2 → 36d-3 | **🟢 JA** |
---

## 10. Ut av scope

- Underprosjekt-opprettelse i UI (F-U3) — egen ordre; 36d-2 «på» er uten virkning til det finnes.
- Import av Proadm-endringsmeldinger via underprosjekt og alt som følger av den (låsing av firmavalget, flagging av rader uten underprosjekt, dokumentflyt) — senere, dialog ikke startet (Kenneth 2026-11-08).
- Endring i server-kapasitetsvakt (bøttenøkkel) — B4.
- Det gamle dagskortets ECO-visning (B2-b, forkastet ved B2-presiseringen).
- Attestering per byggeplass.
- Sletting/omskriving av eksisterende rader ved bytte av firmavalget — skjer aldri.
