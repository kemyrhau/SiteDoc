---
name: timer-gps-helhetsplan
description: Helhetsplan som syr sammen GPS, reise, flerprosjekt-dag og bekreftelsessteget i timer-modulen. Skrevet 2026-10-01 på Kenneths ordre etter at orkestratoren hadde bestilt kode i hver runde uten kontroll på kompleksiteten. Les FØR noe i dette komplekset bestilles.
sist_verifisert_mot_kode: 2026-10-01
---

# Helhetsplan — GPS, reise og flere prosjekter i timer

> **Kenneth 2026-10-01:** *«du er veldig på å starte koding → alle disse spørsmålene dine over →
> beviser for meg at du ikke har kontroll over kompleksiteten. det er ikke bare å bygge i vei.»*

🔴 **Denne planen finnes fordi orkestratoren bestilte kode i hver runde mens modellen ennå ble
formet.** To ordrer motsa hverandre før agentene rakk å bygge dem (Gjenåpne-blokkeringen, og en
gate som krevde en skriving mens resten av ordren sa «les og vis»). **Det er ikke agentenes feil
— det er mangel på en plan.**

**Alt under er målt mot kode 2026-10-01** av fire agenter, verifisert av orkestrator. Grunnlaget:
[timer-gps-prosjekt-utredning.md](timer-gps-prosjekt-utredning.md) · [timer.md](timer.md) ·
[mobil-dagsseddel-ui-spec.md § 6.2](mobil-dagsseddel-ui-spec.md).

---

## 1. Den ene innsikten som ordner resten

🔴 **Tre forskjellige kapabiliteter er i dag blandet sammen i én mekanisme.** De har ulike
datakrav, ulik presisjonstoleranse og ulike konsekvenser — og **det er sammenblandingen som
skaper hullene**, ikke manglende kode.

| # | Kapabilitet | Spørsmålet | Trenger | Konsekvens hvis feil |
|---|---|---|---|---|
| **A** | **Stedsgjenkjenning** | «Er jeg fremme?» | Punkt **+ radius** | Feil forslag. Irriterende |
| **B** | **Reiseberegning** | «Hvor langt er det dit?» | **Kun punkt** | 🔴 **Feil lønn** — over/under terskel avgjør arbeidstid vs. reisetid |
| **C** | **Prosjekt-tilordning** | «Hvilket prosjekt skal timene føres på?» | Punkt + **tid** + bekreftelse | 🔴 **Feil prosjekt belastes.** Feil i regnskapet, ikke bare i lønn |

**I dag brukes samme haversine til alle tre, fire steder, med fire ulike regler:**

```
byggeplassKatalog.ts:72-96        byggeplass · egen radius        → A
useArbeidsdag.ts:71-87            oppmøtested · egen radius       → A
timer/ny.tsx:131-142              prosjekt · hardkodet 500 m      → C
StartSluttDagKort.tsx:441-451     prosjekt · INGEN grense         → C
```

🔴 **Ingen av dem er delt. Ingen er testet. `haversineKm` finnes kun i `apps/mobile/src/utils/geo.ts`
— server og web kan ikke regne avstand i det hele tatt.**

## 2. Den andre innsikten: ingenting som avgjør lønn kan etterprøves

| Hva | Hvor det blir av | Konsekvens |
|---|---|---|
| Posisjonen ved start og slutt | `arbeidsdag_local` — **synkes ALDRI** (`db/schema.ts:351-356`) | Dør med telefonen |
| Avstanden som valgte lønnsart | Brukes, så **kastes** | Reise-raden er en naken timeverdi uten fra/til/km |
| Oppmøtestedet dagen startet på | Lagres kun lokalt | Dagsseddelen bærer ingen `oppmotestedId` |
| Hvilken regel som klassifiserte | Firmainnstilling, lest **offline på telefonen** | Serveren verifiserer aldri klassifiseringen |

🔴 **`grep -ic reise` i `apps/api/src/routes/timer/dagsseddel.ts` = 0.** Hele reisemodellen lever
i mobil-klienten. **Blir lønn feil, finnes det ingen målekjede å gå tilbake i.**

## 3. Den tredje innsikten: bekreftelsessteget er det som gjør GPS lovlig

**Tre steder i koden står det ordrett:** *«KUN dokumentasjon — aldri lønn/reise/prosjektvalg»*
(`byggeplassKatalog.ts:70`, `useArbeidsdag.ts:141-142`, `db/schema.ts:374`). Og utredningens
anker **G1**: *«GPS = friksjonsfjerner + bevis, ikke hard port. Arbeider-valg forblir
autoritativt.»*

🟢 **Kenneths modell bryter IKKE G1 — forutsatt at bekreftelsessteget finnes.** GPS **foreslår**,
arbeideren **bekrefter eller retter**. **Uten bekreftelsessteget blir GPS en hard port, og da
faller G1.**

🔴 **Konsekvens for rekkefølgen: bekreftelsessteget er ikke en finesse som kan komme sist. Det er
forutsetningen for at GPS i det hele tatt får lov til å velge prosjekt.**

---

## 4. Tilstanden, målt

### 🟢 Dette er bygget og virker

| Hva | Bevis |
|---|---|
| **Oppmøtested-gjenkjenning** | `useArbeidsdag.ts:71-87`, i drift ved «Start dag». Koordinat + radius er **PÅKREVD** (`db/schema.prisma:2759-2761`), radius valideres 10–5000 m |
| **Reisematrise med tid OG avstand** | `ReisetidMatrise` (`db/schema.prisma:2788-2807`) — ekte OSRM-ruting, `kjoretidMin` + `avstandM` i meter, hendelsesdrevet vedlikeholdt, **tilgjengelig offline** |
| **Inkrementell utvidelse av matrisen** | `reisetidMatrise.ts:36-37` — kolonne pr. kontor, rad pr. byggeplass. **Fungerer allerede slik Kenneth beskrev** |
| **Reise-regelsett pr. firma** | Terskel i minutter **eller** meter + avstandsbånd → lønnsart (`db/schema.prisma:442-471`, `shared/utils/reise.ts:85-157`) |
| **Serveren tåler flere prosjekter pr. dag** | T.1 (2026-05-11): `DailySheet` har ingen `projectId`, unik er `(userId, dato)`, prosjekt pr. rad |
| **Flerprosjekt-sedel i manuell UI** | Prosjektgrupper, «+ Legg til prosjekt» — levende konsept på web og mobil |

### 🔴 Dette er hullene

| # | Hull | Bevis | Klasse |
|---|---|---|---|
| **H1** | **Prosjekt velges uten avstandsgrense**, og faller blindt til `prosjekter[0]` uten koordinater | `StartSluttDagKort.tsx:440-451` | Stille feil |
| **H2** | **To innganger uenige:** manuell har 500 m-tak, auto har ingen | `timer/ny.tsx:139` vs. over | Inkonsistens |
| **H3** | **Byggeplass-geofence er valgfri og finnes ikke i opprettelsen** — oppstår bare fra georeferert tegning | `validation/index.ts:95-101` | Tomt datagrunnlag |
| **H4** | **Avstanden som avgjorde lønnsart kastes** | `StartSluttDagKort.tsx:866-888` | Usporbar lønn |
| **H5** | **Km har ikke noe felt** — skrives i `timer`, tak 24 interaktivt, **intet tak i `syncBatch`** | `dagsseddel.ts:1329` vs. `:3528` | 🔴 Funksjonsfeil |
| **H6** | **Null server-side reiselogikk** | 0 treff på «reise» i timer-rutene | Ingen verifisering |
| **H7** | **`genererForslag` skriver som sideeffekt** — og arbeidsdagen markeres `avsluttet` FØR utfallet sjekkes | `StartSluttDagKort.tsx:119-129` | 🔴 Tapt arbeidsdag |
| **H8** | **Segment = kalenderdøgn, ikke sted.** Ingen struktur å feste «prosjekt 2 fra 11:30» på | `utils/dagsegment.ts:93-94` | Modellmangel |
| **H9** | **Posisjon fanges kun to ganger** — start og slutt. Ingen besøkslogg | `db/schema.ts:362-366` | Modellmangel |
| **H10** | **Ingen byggeplass→byggeplass-akse** i matrisen — sjåførens akse | `@@unique([oppmotestedId, byggeplassId])` | Modellmangel |
| **H11** | **«Utenfor alle oppmøtesteder» skiller ikke** «startet hjemmefra» fra «GPS var avslått» | `useArbeidsdag.ts:55` | Stille feil |
| **H12** | **Oppmøtested × byggeplass gjenkjennes uavhengig og forenes aldri** | `useArbeidsdag.ts:143-144` | Udefinert |
| **H13** | **Fire konkurrerende «jeg er her», ingen delt, ingen testet** | § 1 | Drift |
| **H14** | **Mobil sedel har `project_id` NOT NULL** — kjent gjeld som venter på nettopp dette kravet | `timer.md:124` | Blokkerer flerprosjekt |

---

## 5. Lagene — og hvorfor rekkefølgen er bindende

🔴 **Hvert lag forutsetter laget under. Bygges et lag før fundamentet, bygges det på en antakelse.**

### LAG 0 — Reparasjoner som ikke venter på noe

**Disse er uavhengige av hele GPS-modellen og retter feil som rammer i dag.**

| Sak | Hull | Hvorfor nå |
|---|---|---|
| **24-taket på km-rader** | H5 | En kjøregodtgjørelse over 24 km avvises i dag. Rammer alle som fører km, ikke bare sjåfører. **Og de to veiene er usymmetriske** — `syncBatch` har ikke taket |
| **`genererForslag` skriver som sideeffekt** | H7 | Feiler radopprettelsen, er GPS-økta oppbrukt og dagens timer tapt. **Splitt beregning fra skriving** |

### LAG 1 — Fundament: én stedsmodell

**Uten dette finnes det ikke ett svar på «hvor er jeg».**

- **Én delt avstandsfunksjon** i `packages/shared` — i dag kun i `apps/mobile`. **Server og web må kunne regne.**
- **Én funksjon pr. kapabilitet** (A/B/C fra § 1), ikke fire konkurrerende. **Hver med navngitt regel og test.**
- **Én navngitt terskel pr. kapabilitet** — ikke 500 m hardkodet ett sted og ingenting et annet (H1, H2).
- **Definert tilstand for «ingen treff»** som skiller fravær fra feil (H11).
- **Avklart hva som vinner når oppmøtested og byggeplass overlapper** (H12).

🔴 **Beslutning K1 kreves før dette bygges — se § 6.**

### LAG 2 — Sporbarhet: det som avgjør lønn skal kunne etterprøves

**Uten dette er alt over et lag som produserer lønn ingen kan kontrollere.**

- **Avstanden som valgte lønnsart lagres på raden** (H4).
- **Oppmøtestedet og posisjonen følger med til serveren** (H6) — i dag dør de på telefonen.
- **Serveren kan verifisere en reiseklassifisering**, ikke bare ta imot den.

⚠️ **Dette er det laget som er lettest å hoppe over og dyrest å mangle.** Det gir ingen ny
funksjon brukeren ser — og uten det kan ingen svare på «hvorfor fikk jeg denne lønnen».

### LAG 3 — Bekreftelse: den menneskelige porten

**Dette er det som gjør at lag 4 og 5 i det hele tatt er tillatt (§ 3).**

- **Bekreftelsessteget etter «Slutt dag»** — egen skjerm, forslaget vises, arbeideren retter og
  bekrefter. **Dagen forblir åpen hvis han avbryter** (Kenneth-vedtak 2026-10-01).
- **Sammenligningsvisningen ved konflikt** — 🟢 **LEVERT** (`e4866f8d` + `9c7c1ad1`).
- **Forespørsel til leder når dagskortet er attestert** (U-BEKREFT-R) — krever én migrering.

🔴 **Og de tre kodekommentarene som forbyr GPS å velge prosjekt må reverseres HER — eksplisitt,
med henvisning til Kenneths vedtak og til at bekreftelsessteget er på plass.** Rives de før
bekreftelsessteget finnes, brytes G1.

### LAG 4 — Flere prosjekter pr. dag

**Forutsetter lag 1 (ett stedssvar), lag 2 (sporbarhet) og lag 3 (bekreftelse).**

- **Segment må få en stedsdimensjon** (H8) — i dag er grensen midnatt og ingenting annet.
- **`dagsseddel_local.project_id` må bli nullable** (H14) — gjelden `timer.md:124` navngir.
- **Ankomst-registrering** — noe må merke at man kom til prosjekt nr. 2.
- ⚠️ **Og overlapp-regelen består:** to prosjekter må ha adskilte klokkevinduer. **«To steder
  samtidig» er ikke uttrykkbart, og det er trolig riktig.**

### LAG 5 — Sjåføren

**Forutsetter alt over, og minst én beslutning som ikke er teknisk.**

- **Posisjonssporing gjennom dagen** (H9) — eller bekreftede stopp i stedet for sporing.
- **Byggeplass→byggeplass-akse i matrisen** (H10).
- **En leveranse-/tur-entitet** — finnes ikke, og `vehicleId` på timeraden er en
  **mekaniker**-funksjon, ikke en sjåfør-funksjon.

---

## 6. Beslutninger som venter på Kenneth

🔴 **Ingen av disse kan avgjøres av orkestratoren. Hver av dem endrer hva som bygges.**

| # | Beslutning | Hvorfor den er din | Konsekvens av valget |
|---|---|---|---|
| **K1** | **Hvilken presisjon skal avgjøre lønn?** Et punkt nær terskelen avgjør arbeidstid vs. reisetid. Skal en byggeplass kunne ha reiseberegning uten at noen har kontrollert punktet? | Lønn | Streng: krever kontrollert punkt, færre byggeplasser får reise. Mild: flere får reise, noen får feil |
| **K2** | **Hva vinner når oppmøtested og byggeplass overlapper?** I dag gjenkjennes begge og forenes aldri | Produktvalg | Avgjør om en dag som starter på et kontor som ligger på en byggeplass gir reise eller ikke |
| **K3** | **Sporing eller bekreftede stopp?** Sjåfør-modellen trenger å vite hvor man var underveis | 🔴 **Personvern.** Krever samtykke, og `mannskap.md:19` sier juridisk sign-off for bakgrunns-geofencing | Sporing: automatisk, men inngripende. Bekreftede stopp: arbeideren trykker ved ankomst |
| **K4** | **Skal km bli en målt størrelse?** I dag skrives km i feltet «timer» med tak 24 | Lønn + regnskap. `timer.md:228` sier «regnskap eier satsene og km-utmålingen» — **vedtaket ditt kolliderer med det** | Eget felt: SiteDoc måler km. Som i dag: regnskap måler, vi bare fører |
| **K5** | **Hvor mye skal serveren verifisere?** I dag: ingenting. Alt skjer offline på telefonen | Risiko vs. kompleksitet | Full verifisering krever at posisjon synkes — altså lagring av hvor ansatte har vært |
| **K6** | **Hva skal skje med eksisterende byggeplasser uten punkt?** | Omfang | Etterfylle i bulk, eller la dem stå uten reise til noen rører dem |

---

## 7. Hva som IKKE skal bestilles ennå — og hvorfor

| Ordre | Status | Grunn |
|---|---|---|
| `inbox-dokgen-byggeplass-origo.md` | ⏸️ **HOLDES** | Bygger lag 1 uten at K1 er avgjort. **Origo-spørsmålet Kenneth stilte er ikke besvart — det er en beslutning, ikke en implementasjonsdetalj** |
| `inbox-kontrollplan-bekreft-dagsforslag.md` | ⏸️ **PAUSET** | Arkitektur-splitten (beregn/anvend) står og hører i LAG 0. **Skjermen venter på at modellen er avklart** |
| U-BEKREFT-R (forespørsel til leder) | ⏸️ | Krever migrering. Hører i lag 3, etter at lag 3s første del er inne |
| Alt i lag 4 og 5 | ⏸️ | Forutsetter lag 1–3 |

🔴 **Det eneste som trygt kan bestilles nå er LAG 0** — de to reparasjonene som ikke avhenger av
noen beslutning.

---

## 8. Hva denne planen IKKE svarer på

**Ført eksplisitt, så den ikke leses som mer komplett enn den er:**

- **Personvernvurderingen for posisjonssporing** er ikke gjort. `mannskap.md:19` flagger juridisk
  sign-off; det finnes ikke noe personverndokument for GPS-sporing av arbeidstid i repoet.
- **Hvor mange byggeplasser som faktisk mangler punkt** er ikke målt — krever SQL mot databasen,
  som kun Kenneth kjører.
- **Eksportsidens behandling av `sats`/`satsEnhet`** mot regnskapssystemene er ikke lest.
- **Sjåfør-modellen er ikke spesifisert** av noen, noe sted. Den er nevnt av Kenneth 2026-10-01
  og finnes ikke i dokumentasjonen ellers.
