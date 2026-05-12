---
name: STATUS-AKTUELT
description: Løpende statusrapport for pågående arbeid, pauset arbeid og planlagte faser. Oppdateres ved hver vesentlig fremdrift.
sist_verifisert_mot_kode: 2026-05-08
---

# SiteDoc — aktuell status

Detaljert løpende statusrapport. CLAUDE.md har kort sammendrag øverst med
peker hit. Beslutningsgrunnlag og arkitektur ligger i
[fase-0-beslutninger.md](fase-0-beslutninger.md) og
[arkitektur-syntese.md](arkitektur-syntese.md).

## Kundeønsker — A.Markussen (mottatt 2026-05-06)

12 forbedringsønsker fra kunde. Status per 2026-05-11 etter sjekk mot kode og commits. Legenda: 🟢 fikset · 🟡 delvis · 🔴 ikke startet · ❓ trenger verifikasjon · ⏸️ parkert.

### #1 — Sjekkliste for service koblet til timetall og status 🟡

**Side:** Maskin-detaljer (f.eks. 7634 Heatwork MY35). **Prioritet:** Høy.

Kunden ønsker sjekkliste der timetall kobles til servicestatus, og «neste service» oppdateres automatisk.

**Status:** DB-feltet `nesteServiceTimer` finnes allerede i `packages/db-maskin/prisma/schema.prisma:188`. Mangler: UI-felt på maskin-detaljside, serviceintervall-konfigurasjon, visuell terskel-indikator, sjekkliste med avkrysningsbokser, automatisk oppdatering av neste service basert på driftstimer.

### #2 — Validering av overtid basert på arbeidstid 🔴

**Side:** Timeføring.

Overtid skal ikke kunne registreres før min. 8t (sommer) / 7t (vinter) ordinær arbeidstid er ført. Ingen validering finnes i timer-routes. Ny `sommer/vinter`-overtid-grense-logikk + feilmelding/blokkering mangler.

### #3 — Tidspunkt (fra/til) per linje i timeføringen 🟡

**Side:** Timeføring.

Schema + server-input på plass (T.4). UI-felt og fra<til-validering mangler.

`SheetTimer.fraTid`/`tilTid` (`packages/db-timer/prisma/schema.prisma:183-184`) og `SheetMachine.fraTid`/`tilTid` (linje 256-257) er lagt til som `String? @map("fra_tid"/"til_tid")`. Server tar imot feltene i `timer.dagsseddel.tilfoyTimerRad` (`apps/api/src/routes/timer/dagsseddel.ts:372-373, 417-418`) og `redigerTimerRad` (1506-1507, 1533-1534). Mangler: server-side validering `fraTid < tilTid` (kommentar på schema-linje 183 lover dette i PR 2, ikke implementert ennå) + UI-felt for inntasting i web/mobil-skjemaene.

### #4 — Redigering og splitting av timer ved attestering 🟡

**Side:** Attestering.

Attesterende skal kunne redigere antall timer og splitte en rad i flere. **Steg 4a (ECO-flytt på attestering)** ble deployet til prod 2026-05-03 (`f98fa7a5`) — leder kan endre kostnadsbærer per rad. Mangler: redigering av timeantall + rad-splitting + audit-log på endringer.

### #5 — Registrering av HMS-gruppe på brukere ⏸️ PARKERT

**Side:** Oppsett – Brukere.

**Opprinnelig ønske:** Felt for HMS-gruppe på bruker/kontakt-kortet, knyttet til eksisterende gruppe-struktur, filtrerbart i brukerlisten.

**Status (oppdatert 2026-05-11 etter Sonnet-sesjon):** Parkert til prosjektoppsettet er mer modent og avhengighetene er synlige. Tidligere klassifisert som «lav kompleksitet» — feilvurdert.

**Begrunnelse:**
- To separate konsepter eksisterer i dag: `ProjectGroup` (RBAC/tilgang) og `Faggruppe` (dokumentflyt-deltaker). HMS-gruppe må plasseres i en av disse eller bli et tredje konsept — ikke avgjort.
- Standard HMS-gruppen (`hms-ledere`, `category="field"`) har ingen UI for administrasjon i dag — kan ikke redigeres via noen side.
- Brukergruppe-arkitekturen er uavklart: Kenneth vurderer firma-basert gruppering (ansatte/ledere per firma) som fremtidig modell, men ikke låst.

**Beslutning:** Ikke estimer eller planlegg denne nå. Tas opp igjen når prosjektoppsett-design og brukergruppe-arkitektur er låst.

---

### #6 — Maskinmodul ikke synlig i prosjekt 998 Instinniforbotn ✅ Lukket 2026-05-12

**Side:** Maskin (prosjekt 998 Instinniforbotn).

✅ **Lukket 2026-05-12 — ikke en bug.** `ProjectModule maskin/aktiv` finnes på prod for prosjekt 998 (`5e8dd794-ab81-47b7-a146-d7384fac3a8a`), og `OrganizationModule maskin/aktiv` finnes for A.Markussen (`4488fe17-...`). Auto-sync fra Steg 1c (`87fb7292`) har gjort jobben sin.

A.Markussen-ansatte (Malin, Silje, Florian — alle `company_admin` med `organization_id = 4488fe17-...` og `can_login=true`) ser Maskin-lenken korrekt i bunnen av HovedSidebar. Kenneth ser den ikke fordi hans bruker har `organization_id = NULL` (superadmin uten firma-tilknytning) — `organisasjon.hentMin` returnerer da `null` og `aktiveFirmamoduler = []`, slik at maskin-bunnelementet filtreres bort i `HovedSidebar.tsx:331`.

**Løsning:** Bytt til brukervisning (impersonering eller logg inn som A.Markussen-ansatt) for å se det kunden ser. Diagnose-verifikasjon utført 2026-05-12 mot prod-DB.

### #7 — Rettighetsmatrise med rolle-styring (Prosjektleder + Bas) 🔴

**Side:** Oppsett – Brukere/Roller.

Ingen treff på `Prosjektleder`/`Bas` som DB-roller. Eksisterende roller: `User.role = sitedoc_admin | company_admin | user` og `ProjectMember.role = admin | member`. Krever ny rolle-modell + matrise-UI som viser tilganger per rolle.

### #8 — Fagområde og oppgaver i sjekklistemaler-listevisning 🔴

**Side:** Innstillinger – Produksjon – Sjekklistemaler.

`apps/web/src/app/dashbord/oppsett/produksjon/_components/MalListe.tsx` har kun 3 kolonner: Navn (`tabell.navn`), Prefiks (`maler.prefiks`), Versjon (`maler.versjon`). Mangler kolonner for fagområde og oppgaver.

### #9 — Justeringer på SJA (signatur/lesetilgang/deltaker) 🔴

**Side:** Innstillinger – Produksjon – Sjekklistemaler – SJA.

Ingen treff på `SJA`/`sja` i kode — SJA er sannsynligvis en konkret sjekklistemal-instans, ikke egen funksjonalitet. Krever utvidet sjekkliste-mekanikk: re-signaturforespørsel, auto-lesetilgang for alle prosjektmedlemmer, selv-påmelding som deltaker.

### #10 — «Flere personer»-feltet på SJA — definere hvem som er valgbare 🔴

**Side:** Innstillinger – Produksjon – Sjekklistemaler – SJA.

Avklare om feltet henter alle firma-ansatte. Krever felt-konfigurasjon for å begrense/definere valgbare personer per SJA-mal.

### #11 — Pushvarsel/SMS til ansattliste 🔴

**Side:** Generelt.

Ingen treff på `pushvarsel`/`sms` i kode. Krever ny varslingstjeneste (SMS-leverandør integrasjon), målgruppe-velger (alle ansatte eller utvalgte grupper), kostnadsavklaring med SiteDoc/leverandør.

### #12 — Oppretting av ny sjekkliste fungerer ikke 🟢 SANNSYNLIGVIS FIKSET

**Side:** Sjekklister (prosjekt 998 Instinniforbotn).

**Status:** Commit `4e29c88a` («fix: sjekkliste opprett-modal stille død») deployet til prod 2026-05-09. Lukket bug der klikk på mal i opprett-modal gjorde ingenting når innlogget bruker ikke var medlem av noen faggruppe (typisk sitedoc_admin/company_admin uten faggruppe-tilknytning) — `handleOpprettFraMal` returnerte stille. Nå: fallback-kjede henter `bestillerFaggruppeId` fra dokumentflytens `oppretter`-medlem, synlig feilmelding i Modal hvis ingen kandidat finnes. Re-test ønskelig fra kunde for å bekrefte at både «Opprett ny sjekkliste» og «+ Ny sjekkliste» nå fungerer i prosjekt 998.

---

## Timer-modul revisjon — kartlegging 2026-05-11

Forarbeid før planlegging av større timer-modul-revisjon. Ingen koding — kun faktagrunnlag fra schema, routes og UI-filer.

**🟢 Alle arkitektur-beslutninger låst 2026-05-11** i [fase-0-beslutninger.md § T](fase-0-beslutninger.md) (T.1–T.6). Neste steg: PR 1 schema + migrasjon.

### A — Fra/til per rad (#3) ✅ Avklart

**SheetTimer-modellen** (`packages/db-timer/prisma/schema.prisma:171–195`) har følgende felter:
`id`, `sheetId`, `lonnsartId`, `aktivitetId` (NOT NULL etter C9), `externalCostObjectId` (svak FK), `timer Decimal(6,2)`, `attestertSnapshot Json?`.

**Ingen `fraTid`/`tilTid` på SheetTimer.** Kun antall timer som Decimal(6,2).

**DailySheet-modellen** (`packages/db-timer/prisma/schema.prisma:123–166`) har `startAt DateTime?` og `endAt DateTime?` — dvs. start/slutt **på dag-nivå**, ikke rad-nivå. Også `pauseMin Int @default(0)`.

**UI-filer som redigerer åpen dagsseddel:**
- `apps/web/src/app/dashbord/[prosjektId]/timer/[id]/page.tsx` — DagsseddelDetaljSide (har `isoTidspunktTilHHMM`-helper)
- `apps/web/src/app/dashbord/[prosjektId]/timer/ny/page.tsx` — opprett ny
- `apps/web/src/app/dashbord/timer/mine/page.tsx` — Mine timer-rapport
- `apps/web/src/app/dashbord/[prosjektId]/timer/attestering/[id]/page.tsx` — leder-detalj (read-only + ECO-flytt)
- Mobil: `apps/mobile/app/timer/*` (ikke kartlagt i denne runden)

### B — Dagssum på tvers av prosjekter ✅ Avklart

**JA — finnes.** `timer.dagsseddel.hentDagstotal` i `apps/api/src/routes/timer/dagsseddel.ts:1543`. Tar `userId?` (default = innlogget) + `dato` (ISO YYYY-MM-DD), returnerer sum timer på tvers av prosjekter for én bruker × én dato.

Innebygd C9 2026-05-02 for mobil-bruk («Du har ført Xt i dag på N prosjekter» øverst i ny-dagsseddel-flyten). Multi-sedel per dag er gyldig per unique-constraint `(userId, projectId, dato)`.

**Naturlige sider for visning:**
- Mobil ny-dagsseddel-flyt (bruker den allerede via Runde 2.5/C9)
- `/dashbord/timer/mine` (Mine timer — periode-rapport)
- Mobil ukesoppsummering (Runde 2.7 implementert)
- Leder-attestering-flyt — ville gi kontekst for hvor brukerens øvrige tid er ført

### C — Overtid og lønnsarter (#2) ✅ Avklart

**Lonnsart-typen** (`packages/db-timer/prisma/schema.prisma:22–44`) har `type String` med verdier: `"ordinaer" | "fravaer" | "feriepenger" | "diett"`.

**Overtid finnes IKKE som egen type i Lonnsart.** Overtid er sannsynligvis modellert som **egen `Lonnsart`-rad** med `type="ordinaer"` (f.eks. «Overtid 50 %», «Overtid 100 %»). Verifisering mot seed-data anbefales.

**Auto-fordeling normaltid/overtid** styres av `OrganizationSetting.dagsnorm Decimal @default(7.5)` (kommentar på linje 213: «Dagsnorm i timer per arbeidsdag — auto-fordeling til normaltid/overtid»). Hvordan denne auto-fordelingen kjøres er ikke kartlagt i denne runden — mest sannsynlig i klient-UI eller mutation-handler.

**Ingen 8t/7t-validering** finnes i `apps/api/src/routes/timer/dagsseddel.ts` — `grep "overtid|8t|7t|sommer|vinter"` returnerer tomt fra routes-filer. Validering må bygges fra scratch.

### D — Firminnstilling hele/halve timer ✅ Avklart

**OrganizationSetting** (`packages/db/prisma/schema.prisma:194–229`) har følgende timer-relevante felter:

| Felt | Type | Default | Bruk |
|---|---|---|---|
| `timezone` | String | `Europe/Oslo` | Tidssone for forretningsregler (A.14) |
| `timerTilgangDefault` | String | `alle-ansatte` | Hvem kan registrere timer (default) |
| `dagsnorm` | Decimal(4,2) | `7.5` | Dagsnorm for auto-fordeling overtid |
| `overtidsmatTerskel` | Decimal(4,2) | `9.0` | Terskel for overtidsmat-tillegg |
| `tillattSelvAttestering` | Boolean | `true` | Ansatt kan attestere egen sedel |
| `timerLockEtterDager` | Int? | NULL | Antall dager før låsing (NULL = status styrer) |

**Ingen `heleTimer`/`halveTimer`-felt.** SheetTimer.timer er `Decimal(6,2)` — tillater 0,01 timer presisjon (ned til 36 sekunder).

**Ingen avrundingslogikk** i timer-routes — `grep "rundAv|heleTimer|halveTimer|round|Math.round|fraction"` returnerer tomt fra `apps/api/src/routes/timer/`. Hvis avrunding skal innføres, må det bygges fra scratch (kandidat for OrganizationSetting-felt `tidsrundingMinutter: Int? @default(null)` med 15/30/60-verdier).

### E — Geolokasjon ✅ Avklart

**Project** (`packages/db/prisma/schema.prisma`) har **`latitude Float?` + `longitude Float?`** — prosjekt-koordinater finnes.

**Byggeplass** har **IKKE** koordinater. Kun `address String?`, `name`, `type` (`bygg`/`anlegg`), `status`. Ingen geofence-radius eller polygon.

**Eksisterende GPS-bruk i mobilappen:** `apps/mobile/src/components/OpprettDokumentModal.tsx` bruker `expo-location` for GPS + `erInnenforBounds(latitude, longitude, geo)`-helper for å sjekke om GPS er innenfor en **tegnings georeferanse** (point1.gps + point2.gps). Brukstilfellet er foreslå korrekt tegning ved opprettelse av sjekkliste/oppgave fra felt.

**Ingen geofence-logikk** for byggeplass eller arbeidstidsregistrering. Mannskaps-modulen (planlagt) har geofence-innsjekk i spec, men det er ikke implementert ennå.

### Andre observasjoner

**Dagsseddel-router (`apps/api/src/routes/timer/dagsseddel.ts`)** har følgende mutations/queries:
- `list` (linje 133), `hentMedId` (205), `opprett` (233)
- `hentTilAttestering` (619), `hentTilGodkjenning` (655, alias for backwards compat), `hentForAttestering` (707, leder-detalj-vy)
- `returner` (850), `attester` (882)
- `hentEndringerSiden` (998, mobil offline-sync)
- `hentDagstotal` (1543, cross-prosjekt sum)

**Mangler i dagens timer-modell mtp. revisjons-scope:**
- Fra/til på rad-nivå (#3) — schema-endring
- 8t/7t overtid-validering (#2) — server-logikk
- Redigering av timer-antall under attestering (#4 utvidelse) — server + UI
- Rad-splitting under attestering (#4) — server + UI
- Avrunding/heleTimer-konfig — schema + logikk
- Geofence-basert timer-validering — krever Byggeplass-koordinater

### Konsekvensanalyse — flytt projectId fra DailySheet til SheetTimer (2026-05-11)

**Arkitektur-beslutning (låst):** `DailySheet` skal ikke lenger ha `projectId`. Prosjekttilhørighet flyttes til rad-nivå (SheetTimer/SheetMachine/SheetTillegg/Vareforbruk). Dagsseddelen eies av arbeider/firma, ikke prosjekt.

#### 1. Felter som må fjernes/flyttes på DailySheet

| Felt | Handling | Begrunnelse |
|---|---|---|
| `projectId String` | **Fjernes** | Flyttes til rad-nivå |
| `byggeplassId String?` | **Flyttes til rad** | Byggeplass hører til prosjekt — kan variere per rad |
| `aktivitetId String?` | **Beholdes** som default | C9-vedtak: kanon-eierskap allerede på rad |
| `avdelingId String?` | Drøftes — beholdes? | Avdeling er firma-intern inndeling, ikke prosjekt-knyttet |
| Unique `(userId, projectId, dato)` | **Endres til** `(userId, dato)` | Én sedel per dag per bruker — uavhengig av prosjekt |

#### 2. Nye/endrede felter på rad-tabellene

**SheetTimer:**
- **`projectId String` NOT NULL** (NY) — hver timer-rad knyttes til ett prosjekt
- `byggeplassId String?` (NY) — fra DailySheet
- `externalCostObjectId String?` — finnes allerede (svak FK til ECO i kjernen)
- Vurder: `fraTid String?` + `tilTid String?` (HH:MM) hvis #3 implementeres samtidig

**SheetMachine:**
- **`projectId String` NOT NULL** (NY) — symmetri med SheetTimer
- `byggeplassId String?` (NY)

**SheetTillegg:**
- **`projectId String` NOT NULL** (NY) — symmetri
- Vurder: kanskje noen tillegg er per-sedel (overtidsmat) og noen per-prosjekt — drøftes

**Ny radType-tabell? (drøftes ikke vedtatt):**
- Alternativ A: behold tre separate tabeller (SheetTimer/SheetMachine/SheetTillegg) — alle får `projectId`
- Alternativ B: konsolider til én `SheetLine`-tabell med `type` enum + nullable lonnsartId/vehicleId/tilleggId/vareId
- **Anbefaling:** Alternativ A — minste blast-radius, eksisterende `attestertSnapshot Json` per tabell tillater type-spesifikk pris-snapshot

#### 3. Omfang av projectId-bruk

| Område | Antall forekomster |
|---|---|
| `apps/api/src/routes/timer/` | **45 linjer** (rapport.ts 7, dagsseddel.ts 38) |
| `apps/mobile/app/timer/` + `apps/mobile/src/hooks/` | **47 linjer** |
| **Sum (kartlagte filer)** | **92 linjer** |

**Konklusjon: nærmere 100 enn 50.** Flere steder utenfor disse mappene er ikke kartlagt (web-sider, andre routes som leser timer-data, kontrollpanel-rapporter). Realistisk totaltall: 120–150 endringspunkter.

Hot spots i `apps/api/src/routes/timer/dagsseddel.ts`:
- `erProsjektLeder(userId, projectId)` (linje 43) — autorisasjons-helper
- `krevProsjektLeder(userId, projectId)` (linje 65) — gate
- `opprett` (linje 233) — input har `projectId: z.string().uuid()` påkrevd
- `hentTilAttestering` (linje 619) — filter `projectId: input.projectId`
- `returner` (linje 850) + `attester` (linje 882) — bruker `sheet.projectId` for gate
- `ECO-flytt` (linje 804) — sjekker `eco.projectId !== sheet.projectId`
- Mobil offline-sync (linje 1218, 1305) — bruker `lokal.projectId`

#### 4. Kobling maskin-timer ↔ Equipment

**Finnes.** `SheetMachine.vehicleId` (svak FK String) peker til `Equipment.id` i `db-maskin`-schema. Ingen Prisma `@relation` (cross-package-FK håndteres som svak String per A.3-mønster, etablert mønster i db-timer/db-maskin).

I dag arver `SheetMachine` prosjekttilhørighet via `DailySheet.projectId` (Cascade). Etter endring må `SheetMachine.projectId` settes eksplisitt.

#### 5. Vareforbruk-kobling

**Finnes som egen modell** `Vareforbruk` i `packages/db-varelager/prisma/schema.prisma`:
- `projectId String` (NOT NULL) — **prosjekt er allerede på rad-nivå**
- `byggeplassId String?` — finnes
- `externalCostObjectId String?` — finnes
- `dagsseddelId String?` — svak FK til DailySheet (kan beholdes)
- `attestertSnapshot Json?` — finnes

**Konsekvens:** Vareforbruk passer arkitekturen som hånd i hanske. Ingen schema-endring nødvendig der. Vurder om `dagsseddelId` blir mindre meningsfullt når dagsseddel ikke har prosjekt — den fungerer da som «tilhører hvilken arbeidsdag», ikke «tilhører hvilken prosjekt-dag».

#### 6. Attestering-flyt i dag

**Per `DailySheet`, ikke per rad:**
- `DailySheet.status` (`draft`/`sent`/`returned`/`accepted`) styrer hele sedelen
- `DailySheet.attestertAvUserId` + `attestertVed` lagres på sedel-nivå
- `attester`-mutation gate'er på `krevProsjektLeder(ctx.userId, sheet.projectId)` (linje 895) — leder for sedelens prosjekt attesterer alle rader

**Pris-snapshot per rad finnes allerede** via `attestertSnapshot Json?` på SheetTimer/SheetTillegg/SheetMachine. Det er klart for å flyttes til per-rad-attestering.

**Implikasjon for ny arkitektur:**
- Sedel som spenner flere prosjekter må attesteres av **flere ledere** — én per prosjekt
- Alternativer:
  - **A** — Status flyttes fra DailySheet til per-rad eller per-prosjekt-gruppe. Sedelen er bare en container.
  - **B** — Behold sedel-status, men gjør den til aggregert visning av rad-status (alle rader attestert → sedel = accepted).
  - **C** — Splitt fysisk: én DailySheet per prosjekt. Da blir endringen mindre, men «én sedel for arbeider per dag» går tapt.
- Anbefaling A eller B — ikke C, siden C reverserer hele arkitektur-beslutningen.

#### 7. Migrasjonsplan (skisse, ikke vedtatt)

1. **Schema-endring (bakoverkompatibel fase 1):** Legg til `projectId String?` (nullable) på SheetTimer/SheetMachine/SheetTillegg. Behold `DailySheet.projectId`. Migrasjon kopierer parent-prosjekt til alle rader.
2. **Klient-migrering:** Oppdater alle 92+ callsites til å lese `projectId` fra rad i stedet for sedel. Mutations skriver til rad. Mobil offline-sync må reflektere.
3. **Innstramning (fase 2):** Sett SheetTimer.projectId NOT NULL. Drop `DailySheet.projectId` + endre unique-constraint. Refaktorer `krevProsjektLeder`-gates til å håndtere flere prosjekter per sedel.
4. **Attestering-modell-endring (egen runde):** Vedta A/B per § 6 før innstramning.

#### 8. Avhengigheter mot andre modul-forslag

- **#3 fra/til per rad** — naturlig å gjøre i samme schema-runde (SheetTimer-utvidelse uansett)
- **#4 redigering/splitting ved attestering** — krever per-rad-tankegang; passer godt i § 7 fase 3
- **#2 overtid 8t/7t** — uavhengig (validering ved opprett/edit av rad, ikke knyttet til prosjekt-flytt)
- **#7 rolle-matrise (Prosjektleder/Bas)** — `krevProsjektLeder` refaktoreres uansett — godt tidspunkt å avklare rollesystem først

### Implementasjonsstatus PR 1A → PR 2C (2026-05-11/12)

| PR | Innhold | Status |
|---|---|---|
| **PR 1A** (`862c70c3`) | Schema-additive + backfill (alle kolonner nullable, DailySheet.projectId beholdt) | 🟢 Deployet prod 2026-05-11 |
| **PR 1B** (`bba971ba`) | NOT NULL på rad-tabeller + drop DailySheet.projectId + ny unique `(userId, dato)` | 🟢 Deployet prod 2026-05-12 (00:06:53) |
| **PR 2A** (`6431873c`) | API-refaktor — dagsseddel/rapport/vareforbruk-routes (45 → 0 TS-feil i `apps/api`) | 🟢 Deployet prod 2026-05-12 |
| **PR 2B** (`8478d4a7`) | Web-klient — 3 timer-modaler sender `projectId` fra `useParams` (46 → 0 TS-feil i `apps/web`) | 🟢 Deployet prod 2026-05-12 (PM2-restart bekreftet, restart-teller +1 = 46) |
| **PR 2C min** (`0700b8ed`) | Mobil — defensiv `?? ""` på `serverSedel.projectId` i `timerSync.ts` mot ny server-respons (null for tomme sedler) | 🟢 Deployet prod 2026-05-12 |

**Verifisering prod 2026-05-12:** HTTP/2 200 mot `sitedoc.no`, API health OK. DB-state: `daily_sheets.project_id` DROPPED, `sheet_timer/sheet_machines/sheet_tillegg.project_id` NOT NULL, ny unique `daily_sheets_user_id_dato_key`. PM2 sitedoc-web (id 47) + sitedoc-api (id 39) begge restartet 22:08, uptime 0-2s, restart-teller +1 = 46.

### Åpen oppgave — full Drizzle-schema-omskriving (utsatt)

Mobil-Drizzle-schemaet speiler **gammel** server-modell der `dagsseddel_local.project_id` er NOT NULL på sedel-nivå. Etter T.1/T.2 burde mobil ideelt sett:

1. Gjøre `dagsseddel_local.project_id` nullable (krever SQLite TABLE-recreate-mønster siden ALTER COLUMN DROP NOT NULL ikke støttes direkte)
2. Legge til `project_id` (NOT NULL) + `byggeplass_id` + `fra_tid` + `til_tid` + `attestert_status`/`attestert_av_user_id`/`attestert_ved` på `sheet_timer_local`, `sheet_machine_local`, `sheet_tillegg_local` via idempotente ALTER TABLE
3. Backfill rad-tabellene fra parent `dagsseddel_local.project_id` (samme mønster som C9-migrasjonen for `aktivitet_id`)
4. Oppdatere `timerSync.ts` push-flyt til å sende `projectId` per rad (i tråd med ny API-protokoll fra PR 2A)
5. Oppdatere `app/timer/[id].tsx`, `ny.tsx`, `mine.tsx` for å rendere/redigere projectId per rad

**Hvorfor utsatt:** Mobil typecheck er uendret fra baseline (12 pre-eksisterende feil, alle pre-eksisterende per CLAUDE.md). Eksisterende sync-flyt fungerer fordi mobil sender `lokal.projectId` på sedel-nivå og PR 2A's server propagerer til rader. Full omskriving er en eget runde (1–2 dager) som påvirker offline-sync-strategien og krever mobil-team-koordinering.

**Avhengigheter for å låse opp:** Ny krav fra Sonnet/Kenneth (f.eks. arbeider registrerer timer for flere prosjekter samme dag via mobil) trigger denne omskrivingen.

---

## Pågående arbeid

**Albansk (sq) lagt til + alle 14 eksisterende språk fullført IMPLEMENTERT på develop 2026-05-08.** Sitedoc støtter nå 15 språk. `sq.json` opprettet med 2145 nøkler (visningsnavn «Shqip», flagg 🇦🇱). Som sidegevinst fylte `generate.ts` ut alle manglende nøkler i de 6 språkene på 974-baseline (cs/de/et/fi/fr/ro) og 8 språkene på 2130-baseline — alle 14 eksisterende språk er nå på 2145-nøkler-baseline. Ingen batch-feil for sq, men 4 språk (ro/et/cs/de) fikk én 50-nøkler-batch til engelsk fallback som må re-oversettes ved senere kjøring. 7138 nye/oppdaterte oversettelser totalt. Web typecheck + build grønt, mobil 12 = 12. Native-speaker-QA anbefalt for sq, cs, de, et, fi.

---

**Rename `kontakter` → `dokumentflyt` DEPLOYET TIL PROD 2026-05-09** (`4919befc` refactor + `27232541` i18n-verdier + `01e51bcd` deploy.sh-fix). HTTP/2 200 mot sitedoc.no. Lukker semantisk drift: ruta het `kontakter` mens UI allerede sa «Dokumentflyt» (verdiene `oppsett.kontakter` og `kontakter.tittel` var begge «Dokumentflyt» i nb). Nå er alt konsistent. Route flyttet, gammel sti bevart som server-side redirect-stub. 502 i18n-nøkler restrukturert via Node-skript over 14 språkfiler. Web-grep `kontakter` redusert fra 55 → 15 (kun variabelnavn + semantisk korrekte nøkler igjen), i18n fra 536 → 24, mobil fra 1 → 0. `pnpm --filter @sitedoc/web typecheck` + `pnpm build --filter @sitedoc/web` grønt på 54.6s. Mobil typecheck 12 = 12 (ingen nye feil).

---

**Sjekkliste opprett-modal + mobil rettighet DEPLOYET TIL PROD 2026-05-09** (`4e29c88a`). HTTP/2 200 mot sitedoc.no. To bugs i én PR.

**Bug 1 — Web sjekkliste opprett-modal:** Klikk på mal gjorde ingenting når brukeren ikke var medlem av noen faggruppe (sitedoc_admin / company_admin uten faggruppe-tilknytning). `handleOpprettFraMal` returnerte stille på `if (!oppretter) return`. Fix i `apps/web/src/app/dashbord/[prosjektId]/sjekklister/page.tsx`: fallback-kjede henter `bestillerFaggruppeId` fra dokumentflytens `oppretter`-medlem når `mineFaggrupper` er tom; synlig feilmelding i Modal hvis ingen kandidat finnes. Ny `opprettFeil`-state, `onError`-handler i `opprettMutation`. Server-side `verifiserFaggruppeTilhorighet` har admin-bypass for sitedoc_admin og ProjectMember.role="admin".

**Bug 2 — Mobil sjekkliste read-only:** Sjekkliste i status `"sent"` ble read-only på mobil selv om mottakeren burde hatt redigeringsrett. `useSjekklisteSkjema(id!)` ble kalt uten `rettighetInput`, så hooken falt tilbake til forenklet status-sjekk. Fix i `apps/mobile/app/sjekkliste/[id].tsx`: speiler web-rettighetsberegningen — ny `trpc.gruppe.hentMineTillatelser`-query, useMemo-blokker for `harBallen`/`flytRettighet`/`rettighetInput` (`minRolle` fantes allerede), hook-kall endret til `useSjekklisteSkjema(id!, rettighetInput)`. Ingen endringer i hooken selv.

**i18n:** 1 ny nøkkel `sjekklister.feil.ingenFaggruppe` i nb+en. **Filer:** 4 endret (1 web, 1 mobil, 2 i18n), 0 server, 0 migrasjon. `pnpm --filter @sitedoc/web typecheck` grønt (kun pre-eksisterende vitest-feil i unrelated test). `pnpm build --filter @sitedoc/web` grønt på 36.4s. Mobil typecheck: 12 = 12 (ingen nye feil).

**Oppfølger (egen runde):** `apps/mobile/app/oppgave/[id].tsx` har sannsynligvis identisk Bug 2 — `useOppgaveSkjema(id!)` kalles uten `rettighetInput`. Fikses etter at sjekkliste-fixen er verifisert på test.

---

**EAS Build iOS produksjon godkjent av Apple — TestFlight aktiv 2026-05-08.** Build 1.0.0 (19) er ferdig prosessert i App Store Connect og distribuert til intern testing-gruppe «Team (Expo)». Brukere i gruppen kan nå installere via TestFlight-appen på iPhone.

**Funksjonalitet aktivert i build:**
- **Hvem-har-ballen-badge** på `apps/mobile/app/oppgave/[id].tsx` + `apps/mobile/app/sjekkliste/[id].tsx` — speilet fra web (`2e32b867`). Amber `<View>` med `recipientGroup.name` ved status sent/received/in_progress.
- **Runde 2.5/C9** — aktivitet flyttet fra `DailySheet`-nivå til `SheetTimer.aktivitetId` (per rad), `sheet_machines`-tabell, `ECO.proAdmType`-fritekst.
- **Runde 2.6** — mobil-cache for maskinregister via `apps/mobile/src/services/maskinKatalog.ts` + `EquipmentVelger`-komponent.
- **Runde 2.7** — Mine timer-rapport på mobil med `DagstotalBanner` + `UkeTotalBanner` + ukesoppsummering.
- **Pensjonert→utgått-rename** — terminologi-konsistens mellom web og mobil.
- **Hvem-har-ballen-badge i18n** — alle 14 språk har nå `tabell.venterPaa` (cs/de/et/fi/fr/lt/lv/pl/ro/ru/sv/uk lagt til 2026-05-07).

**Forutsetninger som var live på server før build:**
- `oppgave.hentMedId` + `sjekkliste.hentMedId` returnerer `recipientGroup` (deployet `2e32b867` 2026-05-05)
- Timer Runde 2.5/2.6/2.7 server-side klar (deployet 2026-05-02)

**Distribusjons-detaljer:**
- Build-hash på develop ved EAS-tidspunkt: `7921f59b` (commit `feat: hvem-har-ballen-badge mobil + i18n-fix 12 språk`)
- App Store Connect URL: https://appstoreconnect.apple.com/apps/6760205962/testflight/ios
- Expo-projektet: `kemyrhau/sitedoc`
- Submission ID: `126c444d-38bf-491e-bd8a-eb86d952c31a`

**Ikke i build (utsatt til neste mobil-runde):**
- 12 pre-eksisterende mobil typecheck-feil (klynge A: moduleSlug, klynge B: erstattVedlegg-interface, klynge C: null-handling, klynge D: Drizzle-typer) — TS-tids-feil, ikke runtime-feil. Metro/Hermes stripper typer.
- Leder-attestering på mobil (utsatt fra Runde 2 MVP) — krever ECO-flytt-funksjon (Steg 4a er live på web)
- Vareforbruk på mobil (Steg 4b.5) — krever offline-sync og dagsseddel-integrasjon

**Verifisering på fysisk enhet (Kenneth-oppgave):** Installer build via TestFlight, åpne sjekkliste/oppgave-detalj med innsendt status, verifiser at amber-badge «Venter på: [gruppenavn]» vises korrekt under StatusMerkelapp.

**Gjenstår:**
- 🔄 Mobil typecheck klynge B — `erstattVedlegg`-interface (utsatt til etter TestFlight-verifisering)
- 🔄 i18n: cs, de, et, fi, fr, ro gjenstår (gjøres ved behov)
- 🔄 HW-vifte Equipment — manuelt i `/dashbord/maskin` på A.Markussen

---

**Fullstendig i18n-oversettelse uk/ru/pl/lt/lv/sv DEPLOYET TIL PROD 2026-05-08** (`720a23dc` merge). HTTP/2 200 mot sitedoc.no.

**Bakgrunn — i18n-audit 2026-05-08:**
| Språk | Nøkler før | Nøkler etter |
|---|---:|---:|
| nb (kilde) | 2129 | 2129 |
| en | 2132 | 2132 (uendret) |
| **uk, ru, pl, lt, lv, sv** | 972 hver | **2129 hver** |
| cs, de, et, fi, fr, ro | 972 | 972 (uendret) |

Audit avdekket at alle 12 ikke-nb/en-språk var frosset på en historisk baseline med 972 nøkler, mens nb/en hadde vokst til 2129 (54 % drift). Web-siden viste klartekst-nøkkelen («firma.timer.tittel» osv.) som UI-tekst for alle ikke-norske/engelske brukere på post-baseline-funksjoner.

**Prioritering — 6 språk valgt etter byggebransje-relevans i Norge:**
1. **uk (ukrainsk)** — `c4b6f6aa`
2. **ru (russisk)** — `b774b1de` (russisk-talende ukrainere + andre)
3. **pl (polsk)** — `4ddff556` (størst østeuropeisk gruppe i norsk bygg)
4. **lt (litauisk)** — `4c0b8be8`
5. **lv (latvisk)** — `e952c166`
6. **sv (svensk)** — `827e83ea` (naboland)

**Metode:**
- Eksisterende `packages/shared/src/i18n/generate.ts` brukt som mal
- Patchet til ett språk per kjøring via `SPRAAK`-env-variabel (atomic commits)
- Kilde: `en.json` (mer presis enn nb for fagtermer per CLAUDE.md i18n-policy)
- `google-translate-api-x` (gratis, ingen API-nøkkel) i batcher à 50 med 1.5s pause for rate-limiting
- Per kjøring: 1157 manglende nøkler oversatt → 2129 totalt

**Resultat:**
- 6 atomiske commits (én per språk) på develop
- Merge-commit `720a23dc` til main
- **6 942 nye oversettelser** (1157 × 6)
- Alle 6 JSON-filer validert med `python3 -c "import json; json.load(...)"`
- `+7000/-18` linjer i merge

**Build:** `pnpm build --filter @sitedoc/web` 1m7s på prod-server. `pm2 reload --update-env` reloadet sitedoc-web (47) + sitedoc-api (39). Ingen DB-migrasjon, ingen schema-endring.

**Kvalitetsforbehold:** Google Translate er LLM-kvalitet, ikke profesjonelle oversettelser. Fagtermer (Lønnsart, Faggruppe, Dokumentflyt, Attestering, ECO, etc.) bør verifiseres av native-speakers ved senere språkrunde. For UI-strenger uten fagtermer er Google Translate-kvaliteten generelt god nok for funksjonell forståelse.

**Gjenstår ved behov:** cs, de, et, fi, fr, ro (alle på 972-baseline). Samme metode kan gjentas ved behov — én kommando per språk:
```bash
SPRAAK=cs pnpm exec tsx src/i18n/generate-ett-sprak.ts
```

**Vurdering for fremtid:** Avgjør om disse 6 språkene faktisk brukes av kunder. Hvis ingen — fjern fra build for å redusere bundle-størrelse. Hvis ja — kjør oversettelse på samme måte.

---

**i18n-fix 12 språk + hvem-har-ballen-badge mobil DEPLOYET TIL PROD 2026-05-07** (`4ff352a7` merge, `7921f59b` impl). HTTP/2 200 mot sitedoc.no.

**To uavhengige fix bundlet i én commit:**

**(1) i18n-drift på 12 språk:**
Drift identifisert under mobil-analyse 2026-05-07: `tabell.venterPaa` (brukt av hvem-har-ballen-badge på sjekkliste/oppgave-detalj) + `dashbord.venterPaaTilgangTittel`/`Beskrivelse` (tilgangs-tom-state) fantes kun på `nb.json` + `en.json`. Web-versjon ble deployet 2026-05-05 (`2e32b867`) — siden da har ikke-norske/engelske brukere sett klartekst-nøkkelen «tabell.venterPaa» som badge-tekst, ikke oversatt streng.

**Endring:** Python-script la til 3 nøkler i 12 språkfiler (cs, de, et, fi, fr, lt, lv, pl, ro, ru, sv, uk) med kontekstuelle LLM-oversettelser. Eksempel:
- cs: «Čeká na»
- de: «Wartet auf»
- fr: «En attente de»
- pl: «Oczekuje na»
- ru: «Ожидает»
- sv: «Väntar på»

Native-speaker-bekreftelse ønskes ved senere språkrunde.

**(2) Hvem-har-ballen-badge på mobil:**
Speilet fra web `2e32b867` til mobil. Endret 2 filer (`apps/mobile/app/oppgave/[id].tsx` + `apps/mobile/app/sjekkliste/[id].tsx`) med IIFE-pattern som rendrer amber `<View>` med `recipientGroup.name` ved status sent/received/in_progress. Bruker eksisterende cast-mønster fra FlytIndikator (`(detalj as { recipientGroup?: ... } | undefined)?.recipientGroup`).

**Server-respons uendret:** `oppgave.hentMedId` (linje 133) + `sjekkliste.hentMedId` (linje 84) returnerer allerede `recipientGroup: { id, name }` — feltet ble lagt til av `2e32b867` og brukes på web. Mobil utnytter samme respons.

**Type-status:**
- Web build grønt (29.2s lokalt + 1m9s prod)
- Web typecheck: 1 pre-eksisterende feil (`vitest`-modul-mangling i test-fil) — ikke fra denne commit
- Mobil typecheck: 12 pre-eksisterende feil klassifisert som kjent teknisk gjeld:
  - Klynge A (4 feil) — `moduleSlug` type-mismatch i `hjem.tsx` (Steg 1e-rename)
  - Klynge B (4 feil) — `erstattVedlegg` mangler i `UseOppgaveSkjemaResultat`/`UseSjekklisteSkjemaResultat`-interface
  - Klynge C (2 feil) — null-handling i `mer.tsx` + `psi/[psiId].tsx`
  - Klynge D (2 feil) — Drizzle-typer i `timerSync.ts`
  - Mine endringer er ikke i feillisten. Alle 12 er TS-tidsfeil, ikke runtime-feil — Metro/Hermes stripper typer ved bygg. App fungerer på prod nå med disse feilene. Egen «mobil typecheck cleanup»-runde planlagt etter EAS Build.

**Mobil ikke aktiv før EAS Build:** Server + web er deployet til prod. Mobil-koden venter på `eas build --platform ios --profile production` (Kenneth-oppgave parallellt med dokumentasjon). Build-tid ~15-30 min. Etter `eas submit` lander build-en i App Store Connect → TestFlight intern testing.

**Endrede filer:** 14 (12 i18n-JSON + 2 mobil-tsx), `+72/-12`. Ingen DB-migrasjon.

---

**Rolle-dropdown outside-click-fix DEPLOYET TIL PROD 2026-05-07** (`9e264bfa` merge, `6ee229a3` impl). HTTP/2 200 mot sitedoc.no.

**Bug:** Rolle-dropdown på `/dashbord/firma/brukere` lukket seg umiddelbart når brukeren klikket pillen. Outside-click-handler på document brukte `mousedown` som fires FØR React's onClick — i sekvensen [mousedown → click] kjørte handler-en før setState rakk å åpne menyen, og påfølgende klikk på dropdown-elementene fungerte ikke konsistent.

**Fix:** Bytt document-listener fra `mousedown` til `click` (linje 35-36 i `apps/web/src/app/dashbord/firma/brukere/page.tsx`). Click fires ETTER React's onClick, så React-state oppdateres først og dropdown rendres før outside-click-evaluering kjører. 2 linjer endret (`addEventListener` + `removeEventListener`).

**Server-tilgang allerede korrekt:** `organisasjon.endreRolle` bruker `verifiserFirmaAdmin` som godtar både `sitedoc_admin` (alle firmaer) og `company_admin` (eget firma). Ingen server-endring nødvendig — fix-en var ren UI-bug.

**Sideprodukt — Florians rolle satt via SQL:** Før fixen ble deployet ble Florian Aschwanden (`8e3c7f17-9880-425d-8e6f-41ba437c9047` på A.Markussen `4488fe17-...`) satt til `company_admin` direkte i prod-DB via SQL UPDATE siden UI var blokkert. Verifisert via RETURNING-clause.

**Test-verifisering før prod-deploy:** Kenneth bekreftet på test.sitedoc.no at dropdown åpner seg og forblir åpen, og at company_admin (Florian) kan endre roller for andre brukere i eget firma.

**Build:** `pnpm build --filter @sitedoc/web` 28.2s lokalt + 1m1s på prod-server. `pm2 reload ecosystem.config.js --update-env` reloadet sitedoc-web (47) + sitedoc-api (39).

---

**«Velg fra firma»-flyt DEPLOYET TIL PROD 2026-05-07** (`f27a63dc` merge). HTTP/2 200 mot sitedoc.no. Lukker arkitekturhull i prosjektmedlems-tilføyelse: tidligere ingen UI-vei for å legge til en eksisterende firma-bruker uten å skrive e-posten manuelt.

**Komponenter:**
- `packages/shared/src/validation/index.ts` — nytt `addExistingMemberSchema` (projectId, userId, role, faggruppeIder)
- `apps/api/src/routes/medlem.ts` — 2 nye prosedyrer:
  - `hentLedigeFirmaBrukere({ projectId })` — User-liste filtrert på `primaryOrganizationId === project.primaryOrganizationId` + `canLogin=true` + `id NOT IN existing ProjectMember`
  - `leggTilEksisterende({ projectId, userId, role, faggruppeIder })` — verifiserer same-firma + canLogin, oppretter ProjectMember direkte (ingen e-post). Idempotent: CONFLICT hvis allerede medlem.
- `apps/web/src/app/dashbord/oppsett/brukere/page.tsx` — fane-toggle på «Legg til bruker»-skjemaet:
  - **«Velg fra firma»** (default): dropdown av ledige firma-brukere → klikk «Legg til» kaller `leggTilEksisterende`
  - **«Inviter ny e-post»**: eksisterende invitasjons-skjema uendret
  - Tom-state: «Alle firma-brukere er allerede medlem» når listen er tom
- 6 nye i18n-nøkler nb+en (`brukere.fane.fraFirma`, `brukere.fane.nyEpost`, `brukere.velgFirmaBruker`, `brukere.ingenLedigeFirmaBrukere`, `brukere.leggTil` + endring av `brukere.inviterNy` til «Legg til bruker»)

**Sikkerhet:**
- `leggTilEksisterende` håndhever `user.organizationId === project.primaryOrganizationId` — kan ikke legge til brukere fra andre firmaer
- Avviser deaktiverte brukere (canLogin=false)
- Idempotent: avviser hvis allerede medlem (CONFLICT)
- Gates med `verifiserAdminEllerFirmaansvarlig` (samme som eksisterende `medlem.leggTil`)

`pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (1m18s) grønt på prod-deploy.

---

**Modul-piller i admin/firmaer + Varelager-bug DEPLOYET TIL PROD 2026-05-07** (`620a85c7` merge). HTTP/2 200 mot sitedoc.no.

**Endringer i `apps/web/src/app/dashbord/admin/firmaer/page.tsx`:**
- Ny delt `ModulPiller`-komponent rendrer alle 3 firmamoduler som piller med ikon (Clock/Truck/Package). Aktiv = grønn (bg-green-50, ring), inaktiv = grå (bg-gray-50). To størrelser: `xs` (tabell) og `sm` (slide-over).
- Tabell: Timer + Maskin-kolonner kombinert til én «Moduler»-kolonne. Skalerbar når flere moduler kommer.
- Slide-over: én «Firmamoduler»-seksjon erstatter de to separate Timer-modul + Maskin-modul-kortene. Hint-tekst om `/dashbord/firma/moduler` beholdt nederst.
- **Bug-fix:** Varelager-modul vises nå korrekt — manglet helt i admin-vyen før.

**Skalerbarhet:** Neste modul (kompetanse, fremdrift, planlegger) er én linje i `FIRMAMODULER`-arrayet:
```ts
const FIRMAMODULER = [
  { slug: "timer", label: "Timer", ikon: Clock },
  { slug: "maskin", label: "Maskin", ikon: Truck },
  { slug: "varelager", label: "Varelager", ikon: Package },
] as const;
```

---

**Admin-impersonering DEPLOYET TIL PROD 2026-05-07** (`a3765a97` merge). HTTP/2 200 mot sitedoc.no. Migrasjon `20260507000001_session_impersonering` applied til prod-DB (verifisert via `\d sessions` — `impersonated_user_id`, `original_user_id`, `impersonation_expires_at` på plass). Test-verifisert: Kenneth (sitedoc_admin) klikket «Imperser» på Kari Firmaadmin → gul banner «Du imperserer Kari (Byggeleder)» + admin-meny forsvant + firma-velger viste kun Byggeleder. Stopp-knapp brakte admin-UI tilbake.

**Deploy-prosedyre:**
- Merge `a3765a97` (develop → main)
- `pnpm install --frozen-lockfile` på prod-server (sikrer node_modules)
- `prisma generate` (regenererer klient med nye Session-felter)
- `prisma migrate deploy` (applied `20260507000001_session_impersonering`)
- `pnpm build --filter @sitedoc/web` (1m12s)
- `pm2 reload ecosystem.config.js --update-env`

**Lærdom (dokumenteres i deploy-detaljer.md ved behov):** Første test-runde feilet med UNAUTHORIZED — cookie-lesing brukte Fastify-style `req.headers.cookie`, men tRPC-mutations kjører i Next.js-web-prosessen der `req` er fetch-Request (Web API Headers krever `headers.get("cookie")`). Fix (`910437e3`): eksponer pre-parsed `sessionToken` direkte i tRPC-context. tRPC-handlers som leser cookies må aldri anta Fastify-spesifikt format — bruk ctx-eksponerte verdier istedenfor å re-parse.

**Audit-log MVP:** `console.log` start/stopp i admin-router. Per-mutation logging utsatt til senere PR (krever Activity-tabell-utvidelse med `actorId` + `subjectId`).

---

**Impersonering («view as user») IMPLEMENTERT på develop 2026-05-07.** SaaS-admin-funksjon: sitedoc_admin kan logge inn som hvilken som helst ikke-admin-bruker. Augmented-session-mønster — `Session.impersonatedUserId/originalUserId/impersonationExpiresAt` settes på admin sin egen session-rad. tRPC-context bruker `impersonatedUserId` som effektiv `userId` for autorisering; `actualUserId` bevarer admin for audit.

**Komponenter:**
- Migrasjon `20260507000001_session_impersonering` — 3 nullable-kolonner + indeks
- `apps/api/src/trpc/context.ts` — `actualUserId` + `imperseringAktiv`-flagg
- `apps/web/src/app/api/trpc/[...trpc]/route.ts` — samme logikk i Next.js-route
- `apps/api/src/routes/admin.ts` — 3 nye prosedyrer (`hentImpersoneringStatus`, `startImpersonering`, `stoppImpersonering`)
- `apps/web/src/components/layout/ImpersoneringBanner.tsx` — global gul banner
- `apps/web/src/app/dashbord/layout.tsx` — banner mountet rett under Toppbar
- `apps/web/src/app/dashbord/admin/firmaer/page.tsx` — `ImperserKnapp` per bruker-rad i slide-over

**Sikkerhetsregler:**
- Kun `sitedoc_admin` kan starte (verifisert via `actualUserId`)
- Forbudt: impersonere annen `sitedoc_admin`, seg selv, eller deaktivert bruker
- Auto-utløp 1t — `impersonationExpiresAt > now`-sjekk i context
- Banner alltid synlig på alle dashbord-sider

**Audit-logging (MVP):** `console.log` med actor + target ved start og stopp. Detaljert per-mutation logging utsatt til senere PR.

4 nye i18n-nøkler nb+en (`impersonering.banner.*`). 1 ny migrasjon, 2 nye komponenter, 5 modifiserte filer. `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (31.0s) grønt. Klar for test-deploy.

---

**HovedSidebar skjult i firma-kontekst + Tilbake-lenke DEPLOYET TIL PROD 2026-05-06** (`8a184fc8` merge). HTTP/2 200 mot sitedoc.no.

**Endringer:**
- `apps/web/src/app/dashbord/layout.tsx` — gjort til client-komponent med `usePathname()`. Betingelses-rendring: `{!erFirmaKontekst && <HovedSidebar />}` der `erFirmaKontekst = pathname?.startsWith("/dashbord/firma") ?? false`.
- `apps/web/src/app/dashbord/firma/layout.tsx` — ny «← Tilbake til dashbord»-lenke (ArrowLeft-ikon) plassert øverst i sidebar-header-blokken (over firmanavnet). Peker til `/dashbord` og bringer HovedSidebar tilbake siden URL ikke lenger starter med `/dashbord/firma`. Bredden på firma-sidebar uendret (280px).

**UX-effekt:** I firma-administrasjon hadde brukeren tidligere både HovedSidebar (60-200px) + firma-sidebar (280px) stablet ved siden av hverandre, som spiste 480px-skjermbredde uten ekstra verdi. Nå tar firma-sidebar full sidebar-rolle, og «Tilbake»-lenken gir en eksplisitt vei ut av firma-konteksten.

**Build (1m1s) + pm2 reload --update-env** grønt på prod. HTTP/2 200 verifisert.

---

**Fakturering-gating + U5-forkasting DEPLOYET TIL PROD 2026-05-06** (`207a223c` merge). To små endringer bundlet i én deploy: (1) Fakturering-menyelement i firma-sidebar skjult for `company_admin`, (2) UX-agenda U5 lukket som forkastet. HTTP/2 200 mot sitedoc.no.

**Endring 1 — Fakturering-gating** (`apps/web/src/app/dashbord/firma/layout.tsx`):
- `NavElement`-typen utvidet med `kreverSitedocAdmin?: boolean`
- `Fakturering`-elementet får `kreverSitedocAdmin: true`
- Render-filter: `if (element.kreverSitedocAdmin && !erSitedocAdmin) return false;`
- `erSitedocAdmin` allerede destructured fra `useFirma()` på linje 88

**Endring 2 — U5 forkastet** (`docs/claude/ux-arkitektur-agenda.md`):
- Status `[MANGLER]` → `[FORKASTET 2026-05-06]`
- Begrunnelse: byggeplass-data (geofence, GPS, mannskaps-innsjekk, §15-liste) er prosjekt-bundne. Selvstendig firma-byggeplass ville blitt orphan-rad uten formål. Dagens prosjekt-bundne flyt er korrekt design.

**Lærdom om første forsøk:** Cherry-picket samme commit (`77939c63` → `eabd34d7`) etter en mislykket første test-deploy som ga «Application error» i nettleser. Krasjen viste seg å være deploy-race-condition (HTML/JS-bundle-mismatch under PM2 reload mens browser hadde cached stale assets), ikke logikk-feil i koden. Verifisert ved at hard reload etter deploy var ferdig fungerte uten problem. Diff-en var minimalt invasiv (3 linjer, semantisk trygge), så root-cause-analysen pekte på deploy-overgang som mest sannsynlig årsak. Ingen kode-endring var nødvendig ved andre forsøk — bare ventet til build var bekreftet ferdig før test.

**UX-agenda — endelig status etter denne deployen:**
- ✅ B1 toppbar prosjektvelger Alle/Mine — DEPLOYET (`2f22c503`)
- ✅ B2 onboarding-checkpoint-bar utvidelse — DEPLOYET (`da00d55d`)
- ✅ B3 modul-fargedesign — DEPLOYET (`c2da3135`)
- ✅ U1 leder-timer-rapport — DEPLOYET (`c551063f`)
- ✅ U2 CSV/Excel-eksport — DEPLOYET (`31cff7da`)
- ✅ U3 sidebar tekst-labels — DEPLOYET (`c2da3135`)
- (U4 erstattet av B3)
- ✅ U5 byggeplass selvstendig flyt — FORKASTET (`207a223c`)
- ✅ U6 maskin sitedoc_admin firma-kontekst — DEPLOYET (`3dd4371b`)
- ✅ U7 fritekst utstyrstype — DEPLOYET (`1781a17a`)

UX-agenda er nå komplett lukket. Ingen åpne UX-tråder igjen.

---

**Integrasjonsadmin (AES-256-GCM-kryptering) + Brreg-autofyll DEPLOYET TIL PROD 2026-05-06** (`878e90ec` merge — bringer kryptering-PR `63b50816` + Brreg-PR `e3b8fd5c` + dok-oppdateringer). To uavhengige PR-er bundlet i én prod-deploy etter test-verifisering av begge.

**Pre-deploy:** `SITEDOC_INTEGRATION_KEY` (64 hex-tegn, generert med `openssl rand -hex 32` direkte på prod-server uten å eksponere verdi i chat) lagt til i begge prod-blokker (`sitedoc-web` + `sitedoc-api`) i `~/programmering/sitedoc/ecosystem.config.js`. Idempotent sed-kommando matchet `VEGVESEN_API_KEY`-linja og satte inn etter — fungerte på første forsøk siden lærdom fra test-deploy var dokumentert i [deploy-detaljer.md](deploy-detaljer.md).

**Deploy-trinn:** `git checkout main && git merge --no-ff develop && git push origin main` → `ssh sitedoc git fetch && git reset --hard origin/main && pnpm build --filter @sitedoc/web` (1m15s) → `pm2 reload ecosystem.config.js --update-env` (reload, ikke restart — bevarer ecosystem-binding og leser oppdatert env). Verifisering: HTTP/2 200 mot sitedoc.no + `/proc/PID/environ` på begge prosesser bekrefter SITEDOC_INTEGRATION_KEY satt med 64 tegn.

**Funksjonell status på prod:**
- AES-256-GCM-kryptering aktiv på `OrganizationIntegration.apiKey` (eksisterende admin-CRUD krypterer ved opprett/oppdater, returnerer aldri klartekst, dekrypterer ikke automatisk i admin-vy — `harNøkkel: boolean` er den eksponerte tilstanden).
- `/dashbord/admin/integrasjoner` — sitedoc_admin platform-status: Vegvesen + krypteringsnøkkel-status (read-only via `process.env`-sjekk).
- `/dashbord/firma/innstillinger/integrasjoner` — firma-admin-side. Type-whitelist tom i firma-integrasjons-router; «ingen aktive integrasjoner»-melding vises. Klar for Reginn-PR senere.
- `/dashbord/firma/innstillinger` — Brreg-knapp ved orgnr-felt autofyller navn + fakturaadresse fra `data.brreg.no`. Modulus-11-validering server-side (vekter 3,2,7,6,5,4,3,2 + kontroll). 8s-timeout via AbortController. Kodede feiltyper (UGYLDIG_ORGNR/IKKE_FUNNET/TIMEOUT/NETTVERK/UKJENT) mappet til tRPC-koder.
- `/dashbord/admin/firmaer` opprett-modal — Brreg-knapp autofyller navn (modal har ikke adressefelt).
- `INTEGRASJON_TYPER` i admin/firmaer-side utvidet med `reginn` (label «Reginn MREG»). Forberedelse for når Reginn-API er klart.

**Test-verifisering før prod-deploy 2026-05-07:** Brreg-oppslag mot orgnr `974760673` (Brønnøysundregistrene selv) returnerte «REGISTERENHETEN I BRØNNØYSUND», adresse «Havnegata 48, 8900 BRØNNØYSUND» — autofyll fungerte korrekt.

**Test-rens utført 2026-05-07:** Gammel klartekst-rad `c9a86fa4-...` (proadm testdata på Byggeleder) slettet via SQL før kryptering ble aktivert. Prod hadde 0 rader så ingen migrering der. Test-nøkkelen `1dcd...4fe4` (eksponert i chat-logg under feilsøking) **bør roteres** — Kenneth-oppgave.

**Lærdom dokumentert i [deploy-detaljer.md](deploy-detaljer.md):** SITEDOC_INTEGRATION_KEY må stå i BÅDE web- og api-ecosystem-blokker fordi tRPC-mutations kjører i Next.js-web-prosessen (ikke Fastify-api). Test-deploy 2026-05-07 feilet 1+ time fordi nøkkelen kun lå i api-blokken; ble løst ved å duplisere i web-blokken. Prod-deploy fulgte ny prosedyre på første forsøk uten feil.

---

**Brreg-autofyll IMPLEMENTERT på develop 2026-05-07.** Firma-oppslag på orgnr mot Brønnøysund Enhetsregisteret (`data.brreg.no`). Autofyll-knapp på `/dashbord/firma/innstillinger` og `/dashbord/admin/firmaer`-opprett-modal. Type-whitelist `sentralregisteret` renamet til `reginn` (clean slate — feilaktig kategorisering av forrige PR rettet opp). UI-tile for `sentralregisteret` fjernet fra `/dashbord/firma/innstillinger/integrasjoner`.

**Komponenter:**
- `apps/api/src/services/brreg.ts` — ny service med `hentFirmaFraBrreg` + `erGyldigOrgnr` (Modulus-11). 8s-timeout, kodede feiltyper.
- `apps/api/src/routes/organisasjon.ts` — ny `hentFraBrreg`-procedure (protectedProcedure).
- `apps/api/src/routes/admin.ts` — type-whitelist `sentralregisteret` → `reginn`.
- `apps/api/src/routes/firma-integrasjon.ts` — `FIRMA_TYPER` blir tom liste; routerstruktur beholdes for senere Reginn-PR.
- `apps/web/src/app/dashbord/firma/innstillinger/page.tsx` — Brreg-knapp ved orgnr-felt, autofyller navn + fakturaadresse.
- `apps/web/src/app/dashbord/admin/firmaer/page.tsx` — Brreg-knapp i opprett-firma-modal, autofyller navn. INTEGRASJON_TYPER utvidet med `reginn`.
- `apps/web/src/app/dashbord/firma/innstillinger/integrasjoner/page.tsx` — Sentralregisteret-tile fjernet, erstattet med "ingen aktive integrasjoner ennå"-tekst.

**Begrunnelse for rename:** Brønnøysund (`data.brreg.no` — firma-grunndata, åpent) og Reginn MREG (`api.sentralregisteret.no` — MEF-utstyrsregister, krever nøkkel) er to ulike tjenester. Forrige PR brukte navnet «Sentralregisteret» med Brønnøysund-beskrivelse — det var feilaktig. Korrigert: Brreg = firmaprofil-autofyll (denne PR), Reginn = maskindata (senere PR, ref. N2.2.3 i oppryddings-plan).

3 nye i18n-nøkler nb+en (`brreg.hent`, `brreg.henter`, `firma.integrasjoner.ingenAktive`). 2 fjernede (`firma.integrasjoner.sentralregisteret.*`). `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (39.2s) grønt. Klar for test-deploy.

---

**Integrasjonsadmin med kryptering IMPLEMENTERT på develop 2026-05-07.** Per-firma integrasjons-administrasjon med AES-256-GCM-kryptering av API-nøkler at-rest. Forutsetning for Sentralregisteret-integrasjon (Brønnøysundregistrene). SmartDok holdes utenfor denne PR.

**Komponenter:**
- `packages/db/src/encryption.ts` — AES-256-GCM utility (`krypter`/`dekrypter`/`verifiserKrypteringsKonfig`). 12-byte IV, 16-byte authTag, base64-output. Master-key fra `SITEDOC_INTEGRATION_KEY` (32 byte hex).
- `apps/api/src/routes/firma-integrasjon.ts` — ny tRPC-router (`list`/`lagre`/`slett`) gates med `autoriserAdminForFirma`. Type-whitelist `["sentralregisteret"]`.
- `apps/api/src/routes/admin.ts` — utvidet: opprett/oppdater krypterer apiKey, ny type `"sentralregisteret"` tillatt, ny `hentPlatformIntegrasjoner` returnerer Vegvesen + krypterings-nøkkel-status.
- `apps/web/src/app/dashbord/firma/innstillinger/integrasjoner/page.tsx` — firma-admin UI med kort-basert design, status-badge, password-felt, Lagre/Endre/Fjern.
- `apps/web/src/app/dashbord/admin/integrasjoner/page.tsx` — sitedoc_admin platform-status (Vegvesen + krypteringsnøkkel read-only).
- Sidebar-links lagt til både firma- og admin-layout.

**Designvalg — eksplisitt vs Prisma `$extends`:** Vurderte `$extends` med `query`-component for transparent kryptering, men dette endret type-en på `prisma`-instansen og brakk type-systemet i hele monorepo (manglende `$on`-metode på utvidet klient bryter funksjoner som tar `PrismaClient`-parameter). Eksplisitt `krypter()`-kall i routerne (kun 2 filer rører `OrganizationIntegration`) er mer lesbar og unngår type-kaskade. Risiko for å glemme krypter-kall mitigeres av at scope er minimalt.

**Test-rens:** `c9a86fa4-ec5b-4959-8631-b3f176f92d50` (proadm testdata på Byggeleder, klartekst) slettet via SQL før push. Prod hadde 0 rader → ingen migrering nødvendig.

**Manuell env-oppdatering kreves før test-deploy:** Sett `SITEDOC_INTEGRATION_KEY` på test- og prod-server. Genereres med `openssl rand -hex 32`. Master-key må aldri rote i git.

**Sentralregisteret-integrasjon konsumerer foreløpig ikke nøkkelen** — denne PR-en lager kun lager-flyten. Faktisk Sentralregister-API-kall (Brønnøysundregistrene) implementeres i egen PR. Vegvesen-policy uendret: env-variabel (`VEGVESEN_API_KEY`), platform-nivå.

`pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (35.7s) grønt. Klar for test-deploy etter env-oppdatering.

---

**UX-runde 2 (B1+B2) DEPLOYET TIL PROD 2026-05-06.** UX-agenda har nå alle 3 vedtatte beslutninger (B1+B2+B3) på prod. Gjenstår kun U5 (byggeplass selvstendig flyt) som åpen UX-oppgave.

| Merge-hash | Innhold | Prod-deploy-tid (CEST) |
|---|---|---|
| `2f22c503` | B1 ProsjektVelger Alle/Mine prosjekter scope | ~16:48 |
| `da00d55d` | B2 onboarding-checkpoint-bar modul-utvidelse | ~17:05 |

**B1** (`2f22c503`): Server: `prosjekt.hentMine` endret til medlemskaps-filter uavhengig av rolle (sitedoc_admin og company_admin filtreres nå også på `members.some.userId`). `hentAlle` beholder admin-bypass for «Alle»-scope.

Klient: ProsjektKontekst utvidet med `prosjektScope: "alle" | "mine" | "enkelt"`, `mineProsjekter`-liste og `velgScope(scope)`-funksjon. Scope persisteres i `localStorage` (`sitedoc-prosjekt-scope`, default `"mine"`). URL med prosjektId tvinger `scope="enkelt"`. ProsjektVelger viser to scope-rader øverst (LayoutGrid + Star-ikon, telling = N/M) — kun for sitedoc_admin og company_admin. Vanlig user (`role="user"`) får ren prosjektliste som før. Knapp-tekst speiler aktiv scope. `velgScope` nullstiller prosjekt-id og ruter til `/dashbord`. Dashbord-startsiden filtrerer visnings-listen på scope; auto-redirect-logikken bruker fortsatt full prosjektliste (førstegangs-onboarding). Ny tom-state-tekst for «Mine»-scope peker brukeren til «Alle prosjekter». 7 nye i18n-nøkler nb+en (`prosjektVelger.*` + `dashbord.ingenMineProsjekterBeskrivelse`).

**B2** (`da00d55d`): Server: `prosjekt.hentOnboardingStatus` utvidet med 6 nye flagg — `timerAktiv/harTimerOppsett`, `maskinAktiv/harMaskinregister`, `varelagerAktiv/harVarekatalog`. Modul-aktivering avledes fra `ProjectModule.status="aktiv"` på prosjektet. Ferdig-kriterier: Timer = `prismaTimer.lonnsart.count > 0 && prismaTimer.aktivitet.count > 0`; Maskin = `prismaMaskin.equipment.count > 0`; Varelager = `prismaVarelager.vare.count > 0`. Tellinger kjøres mot prosjektets `primaryOrganizationId`. Standalone prosjekt (ingen primary org) har alltid modul-flagg = false.

Klient: `apps/web/src/app/dashbord/[prosjektId]/page.tsx` bygger steg-array dynamisk — modul-piller spread-es inn kun når aktivert. `alleFerdige`-sjekken bruker bare synlige piller (skjuler hele banneret når alt er gjort). Lenker peker til firma-sidene (`/dashbord/firma/timer/onboarding`, `/dashbord/maskin`, `/dashbord/firma/varelager`) siden modul-oppsett er firma-nivå-arbeid. Banneret skjules fortsatt for ikke-admin (eksisterende `erAdmin`-sjekk uendret). 3 nye i18n-nøkler nb+en (`onboarding.timerOppsett`, `onboarding.maskinregister`, `onboarding.varekatalog`).

Test-verifisering 2026-05-06 mot prosjekt 998 Instinniforbotn (`f6dcb81f-...` på sitedoc_test): timer + varelager aktivert, alle modul-tellinger > 0 (lonnsart=41, aktivitet=3, vare=57) — banneret skjult som forventet siden alle synlige steg er ferdige. Funksjonell verifisering for ikke-ferdig-tilstand utsatt (kunstig DB-tilbakerulling unødvendig — koden følger samme mønster som eksisterende 4 grunnsteg).

**UX-agenda-status etter UX-runde 2:**
- ✅ B1 toppbar prosjektvelger Alle/Mine — DEPLOYET (`2f22c503`)
- ✅ B2 onboarding-checkpoint-bar utvidelse — DEPLOYET (`da00d55d`)
- ✅ B3 modul-fargedesign — DEPLOYET (`c2da3135`)
- ✅ U1 leder-timer-rapport — DEPLOYET (`c551063f`)
- ✅ U2 CSV/Excel-eksport — DEPLOYET (`31cff7da`)
- ✅ U3 sidebar tekst-labels — DEPLOYET (`c2da3135`)
- (U4 erstattet av B3)
- ⬜ U5 byggeplass selvstendig flyt — gjenstår, krever planleggingsrunde
- ✅ U6 maskin sitedoc_admin firma-kontekst — DEPLOYET (`3dd4371b`)
- ✅ U7 fritekst utstyrstype — DEPLOYET (`1781a17a`)

HTTP/2 200 mot sitedoc.no etter begge deploys.

---

**UX-runde 1 (B3+U1+U2+U3+U6+U7) DEPLOYET TIL PROD 2026-05-06.**

Sammenfatning av 6 UX-vedtatte endringer fra ux-arkitektur-gjennomgang 2026-05-06, deployet i 5 prod-merger samme dag:

| Merge-hash | Innhold | Prod-deploy-tid (CEST) |
|---|---|---|
| `3dd4371b` | U6 maskin sitedoc_admin firma-kontekst-fix + 5 Heatwork-Equipment-rader for A.Markussen | ~13:30 |
| `c2da3135` | U3 sidebar tekst-labels (60→200px) + B3 modul-fargedesign (Alternativ C) | ~14:22 |
| `1781a17a` | U7 fritekst utstyrstype med datalist-forslag | ~14:40 |
| `c551063f` | U1 leder-timer-rapport på firmanivå + React#310-fix | ~14:55 |
| `e4f594fa` | Mine timer flyttet til HovedSidebar + global scrollbar-fix | ~15:30 |
| `31cff7da` | U2 CSV/Excel-eksport på timer-rapport | ~16:03 |

**Detaljer per endring:**

**U3 + B3** (`c2da3135`): HovedSidebar utvidet fra `w-[60px]` (kun ikoner) til `min-w-[200px]` med ikon+tekst-labels. Tooltip-wrapping fjernet. Modul-fargedesign Alternativ C: toppbar uendret (mørkeblå brand), sidebar-aktivt element får 3px border-left + farget ikon KUN når elementet hører til aktiv modul. Ny `apps/web/src/lib/modul-farger.ts` med palett (prosjekt #378ADD, timer #3B6D11, maskin #854F0B, varelager #1D9E75) + `hentAktivModul(pathname)` med UUID-{36}-regex for prosjekt-rute-detect.

**U7** (`1781a17a`): `<select>` for utstyrstype byttet til `<input type="text">` + `<datalist>`-forslag på både nytt-utstyr-side og detalj-side. Server tok allerede fritekst (kun klient-endring). Vegvesen-auto-foreslag oppdatert til labelKey-form (`Personbil`/`Varebil`/etc.) for å matche datalist-verdiene.

**U1** (`c551063f`): Ny tRPC under-router `timer.rapport` med 3 endepunkter:
- `firmaPeriodeRapport({orgId, fra, til, prosjektId?, ansattId?})` — aggregerer DailySheet+SheetTimer+SheetTillegg+SheetMachine på tvers av firmaets prosjekter, returnerer per-ansatt-aggregat med totalTimer, antallSedler, sistRegistrert, statusFordeling, perProsjekt-array, perDag-array
- `hentFirmaProsjekterMedTimer` + `hentFirmaAnsatteMedTimer` for filter-dropdowns
- Alle gates med `autoriserAdminForFirma`

Klient: ny side `/dashbord/firma/timer/rapport` med periode-velger (4 hurtig-knapper «Denne uken / Forrige uke / Denne måned / Forrige måned» + egendefinert), prosjekt+ansatt-filter, 5-kort sammendrag-stripe (Total timer / Ansatte / Sedler / Sent / Attestert), sortbar tabell på 5 kolonner med klikkbar ekspanderbar detaljvisning (per-dag standard + uke-toggle + per-prosjekt sidekol). Status-badges (Kladd/Sent/Attestert) per ansatt. Sidebar-rad «Timer-rapport» i firma-layout under «Timer».

**React #310-fix:** `useMemo` for `sorterteAnsatte` flyttet FØR `if (!orgId)` / `if (!harTimer)` early returns. Samme bug-mønster som tidligere økonomi-React310 (dokumentert i memory). Hooks må kalles i samme rekkefølge hver render.

**Mine timer + scrollbar** (`e4f594fa`):
- «Mine timer»-lenken fjernet fra firma-sub-sidebar — det er en personlig funksjon, ikke admin. Ny Seksjon-verdi `"mine-timer"` i `navigasjon-kontekst.tsx`. Nytt hovedelement i HovedSidebar (BarChart3-ikon, `kreverProsjekt: false`, `kreverFirmaModul: "timer"`, plassert mellom PSI/Søk og Timer for å gruppere timer-flowen). Modul-aksent grønn (B3). `useAktivSeksjon`-hook detekterer `/dashbord/timer/mine` → `"mine-timer"`. Gjenbruker eksisterende i18n-nøkkel `nav.timerMine`.
- Global scrollbar-fix: `<main className="flex-1 overflow-y-auto">` rundt `{children}` i `dashbord/layout.tsx` — fjerner kuttet innhold på sider uten egen scroll-wrapper. `<main>` semantisk riktig (a11y-fordel).

**U2** (`31cff7da`): Ny `apps/web/src/lib/timer-rapport-eksport.ts` med `eksporterCsv` + `eksporterXlsx`. Lazy-import av exceljs (allerede i deps) — unngår bundle-økning. Klient-side bygging fra rapportData (ingen server-roundtrip).

- **CSV:** ett ark, semikolon-separert med UTF-8 BOM for Excel-Windows-kompatibilitet, RFC 4180-quoting
- **Excel (.xlsx):** 3 ark
  1. Sammendrag — én rad per ansatt (Ansatt | Ansattnr | Total timer | Sedler | Sist reg. | Kladd | Sent | Attestert | Per prosjekt)
  2. Per prosjekt — én rad per ansatt × prosjekt
  3. Per dag — én rad per ansatt × dag
- **Filnavn:** `SiteDoc-timer-{firma-slug}-{fra}-{til}.{csv|xlsx}`
- **Norsk tallformat** (komma som desimal). **Respekterer alle filtre** (periode/prosjekt/ansatt) siden eksport bygges fra rapportData som allerede er filtrert.

Eksport-knapp med dropdown (CSV/Excel) i header på rapport-siden. Disabled hvis 0 ansatte. Spinner mens xlsx genereres.

**UX-agenda-status etter denne runden:**
- ✅ B1 toppbar prosjektvelger Alle/Mine — DEPLOYET i UX-runde 2 (`2f22c503`)
- ✅ B2 onboarding-checkpoint-bar utvidelse — DEPLOYET i UX-runde 2 (`da00d55d`)
- ✅ B3 modul-fargedesign — IMPLEMENTERT
- ✅ U1 leder-timer-rapport — IMPLEMENTERT
- ✅ U2 CSV/Excel-eksport — IMPLEMENTERT
- ✅ U3 sidebar tekst-labels — IMPLEMENTERT
- (U4 erstattet av B3)
- ⬜ U5 byggeplass selvstendig flyt — gjenstår, krever planleggingsrunde
- ✅ U6 maskin sitedoc_admin firma-kontekst — IMPLEMENTERT
- ✅ U7 fritekst utstyrstype — IMPLEMENTERT

HTTP/2 200 mot sitedoc.no etter alle deploys.

---

**Heatwork-seed + U6 maskin firma-kontekst-fix DEPLOYET TIL PROD 2026-05-06** (merge `3dd4371b`).

**Prod-deploy fullført:**
- Merge `3dd4371b`: Heatwork-seed-script + U6-fix
- pnpm install + db-maskin generate (ingen migrasjon — kun kode-endringer)
- Web-build 1m16s, sitedoc-api + sitedoc-web restartet
- HTTP/2 200 mot sitedoc.no

**Heatwork-seed mot A.Markussen prod (`4488fe17-...`):**
```
Heatwork-rader: 3 opprettet, 2 eksisterte
```

**DB-tilstand etter seed + manuell rens:**
| internNummer | type | erUtleieobjekt | utleieEnhet | Kilde |
|---|---|---|---|---|
| 7626 | Heatwork 3600 | true | doegn | Seed-script 2026-05-06 |
| 7628 | Heatwork 3600 | true | doegn | Seed-script 2026-05-06 |
| 7630 | Heatwork 3600 | true | doegn | Seed-script 2026-05-06 |
| 7632 | Heatwork 3600 | true | doegn | Manuelt rettet i UI 2026-05-06 |
| 7634 | Heatwork MY35 | true | doegn | Manuelt rettet i UI 2026-05-06 |

Alle 5 Heatwork-utleie-Equipment-rader for A.Markussen ferdig konfigurert.

7632 og 7634 ble opprintet via SmartDok-maskin-import 2026-05-03 før Heatwork-Equipment-utvidelsen var planlagt. Idempotens-sjekken (på `internNummer`) hoppet over dem fordi de allerede fantes — scriptet overskriver ikke eksisterende rader. Brukeren rettet manuelt i UI etter prod-deploy av U6-fix.

**U6-fix:** equipment-router migrert til Steg 1b/2d-mønster. Ny `hentMaskinOrgFraInput` + lokal `verifiserMaskinTilgang` med sitedoc_admin-bypass. Klient sender `useFirma().valgtFirma?.id` med enabled-flagg. Detaljside bruker utstyrets eget orgId for ansvarlig-velger. Tom-state på nytt-utstyr-side hvis ingen firma valgt.

---

**Steg 4b Sesjon 3 DEPLOYET TIL PROD 2026-05-06** (merge `37a1fe89`). Lukker Steg 4b fullt ut.

**Prod-deploy fullført:**
- Merge develop→main: `37a1fe89` (`feat: Steg 4b Sesjon 3 + UX-dokumentasjon`, no-ff)
- Migrasjon `20260507000001_vare_unique_navn_enhet` applied til prod-DB (Vare unique fra `(orgId, varenummer)` til `(orgId, navn, enhet)`)
- Web-build 1m18s, `sitedoc-api` + `sitedoc-web` restartet
- HTTP/2 200 mot sitedoc.no

**Seed-kjøring mot A.Markussen (`4488fe17-7490-409f-9c1c-2827f257c54d`):**
```
Kategorier: 7 opprettet, 0 eksisterte
Varer: 57 opprettet, 0 eksisterte
```

**DB-verifisering (prod):**
- 7 kategorier: Grus/pukk/jord (36), Naturstein (8), Diverse (7), Rør og rørdeler (2), Betongstein og elementer (2), Forbruk (1), Deponiavgift (1) = 57 varer
- 2 pris-rader: Matjord fra lager Beisfjord (m3) = 100,00 og Samfengt grus (m3) = 80,00

**Gjenstår manuelt på Kenneths side:**
- Opprett 6 Heatwork-utleie-Equipment-rader (7626/7628/7630/7632/7634 + HW-vifte) i `/dashbord/maskin` med `erUtleieobjekt=true`, `utleieEnhet=doegn`. Varelager-modul allerede aktivert for A.Markussen per UX-agenda 2026-05-06.

**UX/arkitektur-status:**
- 3 vedtatte beslutninger (B1 toppbar prosjektvelger med Alle/Mine, B2 onboarding-checkpoint-bar utvidelse, B3 modul-fargedesign Alternativ C — sidebar-aksent + ikonfarge, toppbar uendret)
- 4 åpne oppgaver: U1 leder-timer-rapport, U2 eksport alle ansatte (forutsetning for ProAdm), U3 sidebar tekst-labels, U5 byggeplass selvstendig flyt
- U4 erstattet av B3
- B3-implementasjon planlagt som egen frontend-sesjon etter A.Markussen-onboarding er stabilisert
- Detaljer i [ux-arkitektur-agenda.md](ux-arkitektur-agenda.md)

---

**Steg 4b Sesjon 3 — DEPLOYET TIL TEST 2026-05-07** (historikk).

**Status før prod-deploy:**
- Sesjon 3-koden lå på `develop`: `420c0464` (import-flyt) + `5e7aa8d2` (seed-script) + `7241180f` (dok)
- Test-DB hadde migrasjon `20260507000001_vare_unique_navn_enhet` applied; prod-DB hadde den IKKE

**Test-verifisering (Byggeleder, org-id `f1000001-0000-0000-0000-000000000002`):**

Første seed-kjøring:
```
Kategorier: 7 opprettet, 0 eksisterte
Varer: 57 opprettet, 0 eksisterte
```

DB-verifisering: kategorifordeling Grus/pukk/jord (36) + Naturstein (8) + Diverse (7) + Rør og rørdeler (2) + Betongstein og elementer (2) + Forbruk (1) + Deponiavgift (1) = 57 varer. Same-name-multi-enhet fungerer (Betong, Bærelag 0-22, Jernbanepukk, Kabelsand 0-8, Kult 0-250 har 2 rader hver — bekrefter ny `(orgId, navn, enhet)`-constraint).

Idempotens (re-kjøring):
```
Kategorier: 0 opprettet, 7 eksisterte
Varer: 0 opprettet, 57 eksisterte
```

**Strategi-endring:** A.Markussens varekatalog seedes via dedikert script (`packages/db-varelager/prisma/seed-amarkussen.ts`) i stedet for å kjøre import-UI mot prod. Import-UI'et fra `420c0464` beholdes for fremtidige kunder.

**Sesjon 3 venter på følgende før prod-deploy:**

1. ✅ **UX/arkitektur-gjennomgang KOMPLETT 2026-05-06** — beslutninger (B1 toppbar prosjektvelger med Alle/Mine-valg, B2 onboarding-checkpoint-bar utvides med modul-punkter) og 5 åpne oppgaver (U1 leder-timer-rapport, U2 eksport alle ansatte, U3 sidebar tekst-labels, U4 farge-aksent per modul, U5 byggeplass selvstendig flyt) dokumentert i [ux-arkitektur-agenda.md](ux-arkitektur-agenda.md). U1+U2 må prioriteres — forutsetning for ProAdm-eksport.
2. ✅ **A.Markussen firmaprofil KOMPLETT 2026-05-06** — Timer/Maskin/Varelager aktivert i prod, prosjekt «998 Instinniforbotn» opprettet (SD-20260506-0008).
3. **Gjenstår:** prod-deploy av Sesjon 3 (merge `develop` → `main`) → seed-kjøring mot A.Markussen (`pnpm --filter @sitedoc/db-varelager exec tsx prisma/seed-amarkussen.ts`) → manuell opprettelse av 6 Heatwork-utleie-Equipment-rader (Varelager-modul allerede aktivert).

**Forsøk på prod-seed 2026-05-07 ble stoppet** fordi prod-repo er på Sesjon 2 (filen finnes ikke + migrasjonen er ikke applied — varenr-kollisjoner ville rullet transaksjonen på den gamle constraint).

---

**Steg 4b Sesjon 3 — engangs seed-script for A.Markussen IMPLEMENTERT på develop 2026-05-07** (`5e7aa8d2`).

**Strategi-endring:** A.Markussens varekatalog seedes via dedikert script i stedet for å kjøre import-UI mot prod. Import-UI'et fra `420c0464` beholdes for fremtidige kunder.

**Endring:**
- Ny fil `packages/db-varelager/prisma/seed-amarkussen.ts` (219 linjer)
- 7 VareKategori-rader (Grus/pukk/jord, Diverse, Naturstein, Betongstein og elementer, Rør og rørdeler, Deponiavgift, Forbruk) — alle med `kontonummer=null` (fylles manuelt etter seed)
- 57 Vare-rader fordelt: Grus/pukk/jord (36), Diverse (7, «.» utelatt), Naturstein (8), Betongstein og elementer (2), Rør og rørdeler (2), Deponiavgift (1), Forbruk (1)
- 2 pris-rader: «Matjord fra lager Beisfjord» m3=100,00 og «Samfengt grus» m3=80,00
- Idempotent: `findFirst` per rad → opprett hvis null. Re-kjøring oppretter 0 nye rader og overskriver IKKE eksisterende verdier (bevarer manuelle pris-justeringer i UI)
- Default `ORG_ID=4488fe17-7490-409f-9c1c-2827f257c54d` (A.Markussen AS prod). Override via `SEED_ORG_ID`-env for test
- Heatwork-utleie (6 rader) IKKE seedet — opprettes manuelt som Equipment per Beslutning 3 i steg-4b-plan.md

**Kjøring (test-DB først):**
```
SEED_ORG_ID=f1000001-0000-0000-0000-000000000002 \
  pnpm --filter @sitedoc/db-varelager exec tsx prisma/seed-amarkussen.ts
```
(Byggeleder-firma på test-DB.)

**Kjøring (prod):**
```
pnpm --filter @sitedoc/db-varelager exec tsx prisma/seed-amarkussen.ts
```

**Forutsetning:** Varelager-modul må aktiveres for firmaet via UI eller `OrganizationModule(slug="varelager", status="aktiv")` for at radene skal vises. Scriptet sjekker ikke dette — kun datavisnings-forutsetning, ikke data-integritet. Logger påminnelse på slutten.

**Stopp og rapporter etter test-kjøring — Claude verifiserer i UI før prod-kjøring.**

---

**Steg 4b Sesjon 3 (Fase 5 — import-flyt) IMPLEMENTERT på develop 2026-05-07** (`420c0464`). Lukker Steg 4b fullt ut når deployet til prod. Bygger på Sesjon 2 (deployet prod 2026-05-06). Implementerer SmartDok-varekatalog-import for A.Markussen.

**Endringer i Sesjon 3:**

**Migrasjon — Vare unique-constraint:**
- Ny migrasjon `20260507000001_vare_unique_navn_enhet`: dropper `(organizationId, varenummer)`-unique og legger til `(organizationId, navn, enhet)`-unique. Schema-rens i `packages/db-varelager/prisma/schema.prisma`. Bakgrunn: A.Markussens SmartDok-katalog har samme produkt med to enheter (eks. «Pukk 0-120» som både m³ og Tonn med varenummer 31) — den gamle constraint hindret det. Domenet er klart: navn+enhet identifiserer en katalog-vare unikt per firma; varenummer er valgfri ekstern referanse. Eksisterende vare-router CONFLICT-meldinger oppdatert.

**Server — `vareImport`-router (ny):**
- Ny utility `apps/api/src/utils/vareforbrukImport.ts`: `parseSmartDokVarerXml(filinnhold)` parser SpreadsheetML XML (filtype `Varedetaljer.xls.xls` er XML, ikke binær), `normaliserEnhet(verdi)` (Døgn→doegn, m³→m3, etc.), `beregnFilHash(filinnhold)` SHA-256. Filtreringer: navn=«.» → utelat (ugyldig), kategori=«Utleie Heatwork» → utelat (opprettes manuelt som Equipment per Beslutning 3 i steg-4b-plan.md), pris=0 → null (SmartDok 0=ikke satt), internkostnad tom → null. Bruker `fast-xml-parser` (allerede installert).
- Ny router `apps/api/src/routes/vareImport.ts` montert på `appRouter.vareImport`:
  - `importerForhandsvisning({ filInnhold, organizationId })` — parse + duplikat-rapport (DB-duplikater på navn+enhet + fil-interne) + kategori-fordeling (eksisterende vs ny). Ingen DB-skriving.
  - `importerBekreft({ filInnhold, filhash, organizationId })` — fil-hash-sjekk mot forhåndsvisning, atomisk `$transaction`: (1) seed nye `VareKategori`-rader for kategorier som ikke eksisterer, (2) opprett `Vare`-rader med `kategoriId`-FK satt. Activity-log best-effort med samlet rad (`target_type=vare_import`, `action=vare.smartdok-importert`).
- Begge gates med `verifiserFirmaAdminOgVarelager` (samme mønster som vare/vareKategori-routerne) — `autoriserAdminForFirma` + `krevVarelagerAktivert` med `PRECONDITION_FAILED` hvis modul ikke aktiv.

**Klient — ny side `/dashbord/firma/varelager/import`:**
- 4-stegs flyt: opplastning (drag-and-drop + klikk) → forhåndsvisning (sammendrag + kategori-oversikt + advarsler + tabell-preview) → bekreft → resultat. Samme stil som `/dashbord/maskin/import`.
- Filinnhold lastes som tekst (`fil.text()`) siden SpreadsheetML er XML. Aksepterer `.xls` og `.xml`.
- Forhåndsvisning skiller mellom Heatwork-utelatt (med peker til Equipment-internnr fra navnet), ugyldige rader (navn=«.»), DB-duplikater og fil-interne duplikater.
- Resultat-side har egen advarsel-boks for Heatwork-rader med klar instruks om manuell Equipment-opprettelse.
- «Importer fra SmartDok»-knapp på `/dashbord/firma/varelager` byttet fra `disabled` til `<Link>` til ny rute. Ubrukt i18n-nøkkel `firma.varelager.knapp.importKommer` fjernet.

**A.Markussen prod-import — manuell oppfølging etter prod-deploy:**
1. Aktiver Varelager-modul for A.Markussen via `/dashbord/firma/moduler` (sitedoc_admin → A.Markussen i FirmaVelger).
2. Importer `Varedetaljer.xls.xls` via ny rute. Forventet resultat: 7 nye kategorier + 57 varer + 1 ugyldig utelatt + 6 Heatwork utelatt (totalt 64 rader i fila).
3. Manuelt: opprett 6 nye Equipment-rader for Heatwork-enhetene (7626/7628/7630/7632/7634 + HW-vifte) med `kategori=smautstyr`, `erUtleieobjekt=true`, `utleieEnhet=doegn`. Listet i resultat-side med forventet internnummer.

**i18n:** ~50 nye nøkler under `firma.varelager.import.*` i nb+en. Fjernet 1 ubrukt nøkkel.

**Filer endret/nye:**
- 1 ny migrasjon (`20260507000001_vare_unique_navn_enhet`)
- 1 endret: `packages/db-varelager/prisma/schema.prisma` (unique-endring)
- 1 endret: `apps/api/src/routes/vare.ts` (CONFLICT-meldinger oppdatert til navn+enhet)
- 1 ny: `apps/api/src/utils/vareforbrukImport.ts` (parser)
- 1 ny: `apps/api/src/routes/vareImport.ts` (router)
- 1 endret: `apps/api/src/trpc/router.ts` (montering)
- 1 ny: `apps/web/src/app/dashbord/firma/varelager/import/page.tsx` (klient-UI)
- 1 endret: `apps/web/src/app/dashbord/firma/varelager/page.tsx` (knapp aktivert + Link)
- 2 endret: `packages/shared/src/i18n/{nb,en}.json` (i18n-nøkler)

`pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (36.2s) grønt. Klar for test-deploy.

**Stopp og rapporter etter test-deploy — Claude verifiserer import-flyten på Byggeleder før prod-deploy.**

---

**Steg 4b Sesjon 2 (Fase 3 + Fase 4) DEPLOYET TIL PROD 2026-05-06** (impl `da354766` + fix `7d95087f`). Bygger på Sesjon 1 (Fase 1 + 2) som blir deployet i samme prod-merge (commit `b7127475`). Sesjon 2 leverer tRPC-routere og full klient-UI for Varelager-modulen — verifisert på test som **Tore SiteDocAdmin → Byggeleder**: aktivering fungerer, full CRUD i Varelager + Vareforbruk verifisert, lås på attestert-rader fungerer, FK-Restrict på kategori-slett gir korrekt feilmelding.

**Endringer i Sesjon 2:**

**Fase 3 — tRPC-routere (3 nye + infrastruktur-utvidelser):**
- **Infrastruktur:**
  - `FirmamodulSlug` i `services/firmamodul.ts` utvidet fra `"timer" | "maskin"` til `"timer" | "maskin" | "varelager"`. `syncProjektModulerPaaAktiver/Deaktiver` håndterer nye slug automatisk uten ekstra kode (verifisert).
  - `organisasjon.settFirmamodul.input.slug` Zod-enum utvidet til å tillate `varelager`.
  - Ny `services/varelager/moduleGate.ts` — `erVarelagerAktivert(orgId, projectId?)` + `krevVarelagerAktivert(...)` + `VarelagerModulIkkeAktivertError`. Speiler `services/timer/moduleGate.ts`. To-nivås gating: firma-master + ProjectModule.
- **`vareKategori`-router** (firma-admin): `list`, `opprett`, `oppdater`, `slett`. Gates: `verifiserFirmaAdmin` + `krevVarelagerAktivert` (firma-nivå). Slett er **ekte DELETE** — feiler med CONFLICT (P2003) hvis varer er tilknyttet (FK Restrict).
- **`vare`-router** (firma-admin): `list` (med kategori-filter, søk, kunAktive), `hentMedId`, `opprett`, `oppdater`, `deaktiver` (soft-delete via `aktiv=false` — bevarer Vareforbruk-historikk). Kategori-validering: `kategoriId` må tilhøre samme firma. Unique-konflikt på varenummer mappes til CONFLICT.
- **`vareforbruk`-router** (prosjekt-medlemmer): `list` (filter på periode/byggeplass/dagsseddel/vare; beriker med registrert-av-bruker), `hentMedId`, `opprett`, `oppdater`, `slett`. Gates per endepunkt:
  - `verifiserProsjektmedlem` (eksisterende helper — ProjectMember + sitedoc_admin/company_admin-fallback)
  - `krevVarelagerForProsjekt` (henter `primaryOrganizationId` + krever modul aktiv på ProjectModule-nivå; returnerer orgId)
  - `krevTilgangPolicy` (henter `OrganizationSetting.vareforbrukTilgangDefault`; `alle-ansatte` → kun ProjectMember/company_admin; `kun-prosjektmedlemmer` og `sertifiserte` → krever ekte ProjectMember-rad. Sertifisert-policy får fallback til kun-prosjektmedlemmer i Sesjon 2; reell Kompetansetype-sjekk utsettes)
  - ECO-validering: hvis `externalCostObjectId` gitt — finnes, samme firma+prosjekt, status=aktiv, `timerregistreringApen=true` (proxy per Beslutning)
  - Vare-validering: tilhører samme firma som prosjektets eier-org
  - Dagsseddel-validering: hvis `dagsseddelId` gitt — eksisterer + tilhører samme prosjekt
  - Lås: `attestertSnapshot !== null` → FORBIDDEN på oppdater + slett
- **Activity-logging** (best-effort try/catch) på `vareforbruk.{opprett,oppdater,slett}`: `targetType="vareforbruk"`, `action="vare.registrert|endret|slettet"`, payload med vareId/antall/dagsseddelId. Kategori og Vare-CRUD logges ikke (firma-konfigurasjon).
- **Mount:** `appRouter` får 3 nye toppnivå-routere: `vareKategori`, `vare`, `vareforbruk`.

**Fase 4 — Klient web-UI:**
- **`/dashbord/firma/varelager/page.tsx`** (ny side): fane-toggle «Varer» / «Kategorier» (default Varer). Modul-ikke-aktivert-melding når `!aktiveFirmamoduler.includes("varelager")`. Varer-fane: filter på søk + kategori + inkluder-inaktiv, tabell-kolonner (navn, varenr, kategori, enhet, pris, internkostnad, aktiv-status), header-knapper «Importer fra SmartDok» (deaktivert i Sesjon 2 — peker til Fase 5) og «Legg til vare». 3 modaler: `VareModal` (opprett/rediger med felter inkl. enhet-combobox med 10 forslag via `<datalist>`, kategori-dropdown), `Deaktiver`-bekreftelses-modal. Kategorier-fane: liste med navn/kontonummer/aktiv, 3 modaler: `KategoriModal` (opprett/rediger med kontonummer-felt + hjelpetekst om ProAdm/Tripletax), `Slett`-bekreftelses-modal med server-feilmelding ved FK-konflikt.
- **`/dashbord/firma/moduler/page.tsx`**: Varelager-slug byttet fra `status: "kommer-snart"` til `status: "tilgjengelig"`. Toggle-funksjonalitet (aktivere/deaktivere) virker via eksisterende mønster — `organisasjon.settFirmamodul({ slug: "varelager", aktiver })`.
- **`/dashbord/[prosjektId]/vareforbruk/page.tsx`** (ny side): periode-filter (default siste 30 dager) + byggeplass-filter, tabell-kolonner (dato, vare, antall, enhet, byggeplass, registrert-av, kommentar, attestert-badge, handlinger). Modul-ikke-aktivert-melding hvis tRPC returnerer `PRECONDITION_FAILED`. 2 modaler: `ForbrukModal` (opprett/rediger — vare-velger låst i rediger-modus pga ECO/snapshot-implikasjoner; antall + dato + byggeplass + ECO-dropdown filtrert til aktive ECO-er + kommentar), `Slett`-bekreftelses-modal. Lås-håndtering: rediger/slett-knapper skjult når `erLast===true`.
- **Sidebar — firma:** Ny «Varelager»-lenke (Package-ikon) i `apps/web/src/app/dashbord/firma/layout.tsx` mellom «Mine timer» og «Fakturering» — `kreverFirmaModul: "varelager"` filter henvender til `aktiveFirmamoduler.includes("varelager")`.
- **Sidebar — prosjekt:** Ny «Vareforbruk»-element (Package-ikon) i `HovedSidebar.tsx` etter timer-attestering — `kreverFirmaModul: "varelager"` gates på ProjectModule-status (`harVarelagerPaaProsjekt`). `Seksjon`-typen i `navigasjon-kontekst.tsx` utvidet med `"vareforbruk"`. `useAktivSeksjon`-mappet utvidet med `vareforbruk: "vareforbruk"`.
- **i18n:** ~80 nye nøkler i `nb.json` + `en.json`:
  - `nav.vareforbruk` (1)
  - `handling.deaktiver` (1, manglet før)
  - `firma.varelager.*` (~35: tittel, faner, knapper, kolonner, filter, tom-tilstand, modaler, felter, deaktiver-bekreftelse, modul-ikke-aktivert-melding)
  - `firma.varelager.kategori.*` (~13: tittel, knapp, tom, kolonner, modaler, kontonummer-hjelp, slett-bekreftelse)
  - `vareforbruk.*` (~30: tittel, knapp, kolonner, filter, modaler, felter, lås-badge, slett-bekreftelse, modul-ikke-aktivert-melding)

**Hva Sesjon 2 IKKE leverer:**
- Ingen import-flyt — Sesjon 3 (Fase 5).
- Ingen mobil offline-sync — Steg 4b.5.
- Ingen aktivering av Varelager-modul for noe firma — separat manuell handling etter test-verifisering.
- Ingen sertifiserte-policy-håndhevelse — Kompetansetype får «kreves for vareregistrering»-flagg senere.
- Ingen attestering-flow på Vareforbruk — utsatt (mobil + leder-attestering).
- Ingen dagsseddel-kobling i opprett-modal — mobil registrerer fra dagsseddel-detalj senere.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (36.5s). Build-statistikk viser begge nye sider: `/dashbord/firma/varelager` (4.9 kB) + `/dashbord/[prosjektId]/vareforbruk` (4.09 kB). Ingen DB-migrasjoner i denne sesjonen (alle tabeller ble opprettet i Sesjon 1).

**Auto-deployes til test via cron** etter push. Cron-skriptet ble oppdatert i Sesjon 1 til å kjøre `prisma generate + migrate deploy` for alle 4 db-pakker — denne sesjonen krever ikke noen ny `.env` på server. Claude verifiserer på test som **Tore SiteDocAdmin → Byggeleder** (Beslutning fra forrige tur):
1. `/dashbord/firma/moduler` viser Varelager med toggle-knapp (ikke «kommer snart»). Aktiver Varelager → bekreftelse, sidebar-lenke «Varelager» dukker opp i firma-layout.
2. `/dashbord/firma/varelager` med tom-tilstand. Bytt til Kategorier-fane → opprett kategori «Test» med kontonummer 1900. Bytt tilbake til Varer → opprett vare «Pukk 0-22» enhet `m3` pris 250 kategori «Test». Rediger varen, deaktiver, reaktiver via list (toggle aktiv).
3. Som **Per Prosjektadmin** på et Byggeleder-prosjekt: prosjekt-sidebar viser «Vareforbruk»-ikon. Naviger inn → `/dashbord/[prosjektId]/vareforbruk` viser tom-tilstand. Registrer forbruk «Pukk 0-22» antall 5 — vises i tabell. Slett raden.
4. Slett kategori «Test» som har varer tilknyttet → server-feilmelding «Kategorien har varer tilknyttet og kan ikke slettes». Deaktiver vare først → slett kategori → slett vare.

**Stopp og rapporter etter test-verifisering — Sesjon 3 (Fase 5: import-flyt) avventer eksplisitt grønt lys.**

**Steg 4b Sesjon 1 (Fase 1 + Fase 2) inkludert i samme prod-deploy 2026-05-06** (commit `b7127475`). Verifisert på test før prod-deploy. Forutsetninger lukket (Steg 1e i prod 2026-05-05). Plan-oppdatering 2026-05-06 (`5aca7c31`): Beslutning 8 låst — `VareKategori`-tabell (firma-definert) med valgfri `kontonummer` for ProAdm/Tripletax-eksport; `Vare.kategoriId` (FK) erstatter fritekst-`kategori`. A.Markussens 7 kategorier seedes ved import (Fase 5). Engangsfix på server: `.env` opprettet i `packages/db-varelager`, deploy-cron-skript oppdatert til å håndtere alle 4 db-pakker (generate + migrate deploy).

**Endringer i Sesjon 1:**

**Fase 1 — `packages/db-varelager`-pakke:**
- Ny pakke speilet etter `db-timer`/`db-maskin`: `package.json`, `tsconfig.json`, `.env.example`, `.gitignore`, `src/index.ts` (eksporterer `prismaVarelager` + typer), `prisma/schema.prisma`.
- Schema med 3 modeller i postgres-schema `varelager`:
  - **`VareKategori`** (firma-definert) — `id`, `organizationId` (svak FK), `navn`, `kontonummer?`, `aktiv`, audit-felter. Unique `(organizationId, navn)`.
  - **`Vare`** — `organizationId`, `navn`, `varenummer?`, `enhet`, `pris?`, `internkostnad?`, `kategoriId?` (ekte FK med `onDelete: Restrict`), `aktiv`. Unique `(organizationId, varenummer)`.
  - **`Vareforbruk`** — `dato (Date)`, `projectId`, `byggeplassId?`, `externalCostObjectId?`, `vareId` (ekte FK Restrict), `antall`, `registrertAvUserId`, `kommentar?`, `dagsseddelId?` (svak FK → `daily_sheets`), `attestertSnapshot Json?` (A.7-mønster).
- Migrasjon `20260506000001_init`: CREATE SCHEMA varelager + 3 tabeller + 8 indekser + 2 ekte FKs.
- Cross-package-FK håndteres som svake String-felt uten `@relation` (samme mønster som db-timer/db-maskin).
- Workspace-deps: `@sitedoc/db-varelager: workspace:*` lagt til i `apps/api/package.json` + `apps/web/package.json`.
- `prismaVarelager` lagt til i tRPC-context begge steder (`apps/api/src/trpc/context.ts` + `apps/web/src/app/api/trpc/[...trpc]/route.ts`).
- `pnpm install` + `pnpm --filter @sitedoc/db-varelager exec prisma generate` grønt (Prisma-klient i `node_modules/.prisma/varelager-client`).

**Fase 2 — Equipment-utleie-utvidelse:**
- 4 nye felter på Equipment i `db-maskin/prisma/schema.prisma`:
  - `erUtleieobjekt Boolean default false`
  - `utleieprisPerDogn Decimal(10,2)?`
  - `utleieprisPerTime Decimal(10,2)?`
  - `utleieEnhet String?` («doegn» | «time» — primærenhet for fakturering)
- Migrasjon `20260506000002_equipment_utleieobjekt`: ALTER TABLE ADD COLUMN, bakoverkompatibel.
- tRPC: `maskin.equipment.oppdater` utvidet med 4 nye felter i Zod-schema (spread-mønster i Prisma-update krever ingen ekstra kode).
- Klient (`apps/web/src/app/dashbord/maskin/[id]/page.tsx`):
  - `UtstyrDetalj`-typen + `RedigerInputs`-typen utvidet med utleie-felter.
  - `aktivModal`-union utvidet med `"utleie"`.
  - Ny «Utleie»-seksjon i detaljvyen mellom Småutstyr-info og Notater. Read-only-visning: når `erUtleieobjekt=true` viser Ja/Nei + pris-per-døgn + pris-per-time + primærenhet; når `false` viser kun «Er utleieobjekt: Nei».
  - RedigerModal får ny `felt="utleie"`-seksjon med toggle-checkbox + 2 NumInput-pris-felter + select for utleieEnhet (kun synlig når toggle på).
  - `byggInitielt` får ny case for `"utleie"`.
- ~8 nye i18n-nøkler under `maskin.utleie.*` (nb+en): `seksjon`, `rediger`, `erUtleieobjekt`, `prisPerDogn`, `prisPerTime`, `primaerEnhet`, `enhet.doegn`, `enhet.time`.

**Hva Sesjon 1 IKKE leverer:**
- Ingen tRPC-routes for Vare/Vareforbruk-CRUD — Sesjon 2 (Fase 3).
- Ingen klient-UI for varekatalog eller vareforbruk — Sesjon 2 (Fase 4).
- Ingen import-flyt — Sesjon 3 (Fase 5).
- Ingen `EquipmentRental`-tabell, ingen utleie-transaksjons-flyt — Steg 4d.
- Ingen aktivering av Varelager-modulen for noe firma — separat steg etter Sesjon 2.
- Ingen mobil offline-sync — Steg 4b.5.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (28.3s). Ingen DB-migrasjon kjørt lokalt — test-deploy applier `20260506000001_init` (db-varelager) + `20260506000002_equipment_utleieobjekt` (db-maskin) ved auto-deploy.

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer på test: (1) `psql sitedoc_test -c "\dt varelager.*"` viser `vare_kategorier`, `varer`, `vareforbruk`; (2) `psql sitedoc_test -c "\d maskin.equipment"` viser nye kolonner; (3) som **Per Prosjektadmin** på en Equipment-detaljside — «Utleie»-seksjonen vises med «Er utleieobjekt: Nei», rediger-modalen kan toggles og prisfelter dukker opp/skjules. **Stopp og rapporter etter test-verifisering — Sesjon 2 (Fase 3 + 4) avventer eksplisitt grønt lys.**

**Steg 4b-plan VEDTATT 2026-05-05 — Sesjon 1 implementert 2026-05-06.** Komplett 5-faset plan i [steg-4b-plan.md](steg-4b-plan.md) (komplett A.Markussen-vareliste i § 13). Bygger på C.16 (vedtatt 2026-04-30) + A.Markussen SmartDok-katalog kartlagt 2026-05-05 (64 varer, 8 kategorier, 9 enheter). Sentrale beslutninger: ny `db-varelager`-pakke, **generelt prinsipp om utleie-utstyr** (per time/døgn registreres i Maskinregister med `erUtleieobjekt=true`, ikke i Varekatalog — gjelder Heatwork, steinsag, Hilti, aggregat på tvers av Equipment-kategorier), ECO-kobling på Vareforbruk, fritekst-enhet med forslagsliste, **VareKategori-tabell med kontonummer** (Beslutning 8, 2026-05-06). Importresultat: 57 Vare-rader + 7 VareKategori-rader (alt unntatt Heatwork) + 6 nye Equipment-rader for Heatwork-utleie-enheter. Estimat ~16t over 3 sesjoner. Forutsetning Steg 1e ✅ deployet prod 2026-05-05.

**admin/prosjekter respekterer FirmaVelger DEPLOYET TIL PROD 2026-05-05** (`0245b265` merge — fix `d9570c7b` + firma-kolonne `6414b9d3`). HTTP/2 200 verifisert mot sitedoc.no. Lukker to relaterte issues: (1) siden viste alle prosjekter på tvers av firmaer selv når sitedoc_admin hadde valgt et firma i FirmaVelger; (2) firma-kolonnen viste `projectOrganizations[0]` (første partner-rad) i stedet for primary firma — ga «Hovedentreprenør» på Byggeleder-prosjekter når Hovedentreprenør var partner. Speiler `prosjekt.hentAlle`-filteret fra Blokk A 2026-05-04.

**Endringer:**
- **Server (`apps/api/src/routes/admin.ts`):** `hentAlleProsjekter` får valgfri `organizationId: z.string().uuid().optional()`-input. `findMany`-where filtrerer på `primaryOrganizationId` når input er gitt, ellers ingen filter (samme atferd som før). Sjekkliste/oppgave-tellinger uendret — jobber mot allerede filtrert `prosjektIder`.
- **Klient (`apps/web/src/app/dashbord/admin/prosjekter/page.tsx`):** importerer `useFirma()`, sender `{ organizationId: valgtFirma?.id }` til queryen. Header-tittel + empty-state-tekst byttes dynamisk: «Alle prosjekter» når intet firma valgt → «[Firmanavn]» når firma valgt. Empty-state-beskrivelse blir firmaspesifikk.
- Ingen ny i18n (header er fortsatt hardkodet — i18n-konvertering av admin-vyen er separat opprydningsoppgave).

**Hva endringen IKKE dekker:**
- `prosjekt.hentAlle` røres ikke — har samme filter fra før, brukes andre steder.
- Auto-reset av lokal state ved firma-bytte er ikke relevant her (admin/prosjekter er selvstendig vy uten prosjekt-kontekst).
- i18n-konvertering av admin-vyen er fortsatt åpen.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (32.7s). Ingen DB-migrasjon, ingen i18n.

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer på test som **Tore SiteDocAdmin**: (1) uten firma valgt — `/dashbord/admin/prosjekter` viser «Alle prosjekter (N)» og listen er full; (2) velg Byggeleder i FirmaVelger — header endres til «Byggeleder -Firma (M)» og listen er filtrert til kun Byggeleder-prosjekter; (3) bytt til et firma uten prosjekter — empty-state med firmaspesifikk tekst.

**Steg 1e (OrganizationModule erstatter har_*_modul-flagg) DEPLOYET TIL PROD 2026-05-05** (`de044be4` merge — Fase A `9fda0f81` + Fase B `978c1bf4` + Fase C `5f72dc23`). HTTP/2 200 verifisert mot sitedoc.no. Lukker Steg 1e fullt ut og forutsetningen for Steg 4b (Vareforbruk).

**Prod-deploy verifisert:**
- 2 migrasjoner applied (`20260505000001_add_organization_module_fase_a` + `20260505010000_drop_organization_har_modul_flags`)
- `har_timer_modul` + `har_maskin_modul`-kolonnene droppet fra `organizations` (0 i information_schema)
- Bakfylt: **2 rader** i `organization_modules` for **A.Markussen AS** (timer + maskin, status=aktiv). HRP AS og Kenneths testmiljø hadde erKunde=true men aldri `har_*_modul=true`, så ingen rader bakfylt for dem — antagelsen i Fase A-rapporten om 6 rader var feil. 2 rader er korrekt for prod-state der kun A.Markussen aktivt bruker modulene.
- PM2: sitedoc-web + sitedoc-api restartet, uptime 0s ved verifisering

**Hva Steg 1e leverer:**
- Generisk `OrganizationModule(organizationId, moduleSlug, status, audit-felter, config)`-tabell erstatter `Organization.har_timer_modul` + `har_maskin_modul`
- Skalerbar til kompetanse/fremdrift/varelager uten schema-endring per ny modul
- Audit-spor: `aktivert_ved/aktivert_av_user_id/deaktivert_ved/deaktivert_av_user_id` (String? uten `@relation` per A.3-mønster)
- Klient-API: `Firma.aktiveFirmamoduler: string[]` erstatter de boolean-flaggene
- A.4-overstyring dokumentert i `fase-0-beslutninger.md` (peker til Steg 1e med rasjonale: firma uten prosjekter må kunne onboarde lønnsarter — ikke avledbar fra ProjectModule alene)

**Steg 1e Fase C (drop har_*_modul-kolonner) IMPLEMENTERT på develop 2026-05-05.** Lukker Steg 1e fullt ut. OrganizationModule-tabellen er nå eneste sannhetskilde for firma-master-aktivering — `har_timer_modul` + `har_maskin_modul`-kolonnene droppet fra Organization.

**Endringer i Fase C:**
- **Migrasjon `20260505010000_drop_organization_har_modul_flags`:** `ALTER TABLE organizations DROP COLUMN IF EXISTS har_timer_modul`, samme for `har_maskin_modul`. Idempotent.
- **Schema (`packages/db/prisma/schema.prisma`):** `harMaskinModul` + `harTimerModul`-feltene fjernet fra Organization-modellen. Kommentar oppdatert med peker til Fase C-migrasjonen.
- **Server (`apps/api/src/routes/organisasjon.ts`):** `settFirmamodul`-mutationen mister dual-write — `tx.organization.update({ data: { [flagFelt]: input.aktiver } })` og `flagFelt`-variabelen fjernet. Kun `skrivOrganizationModuleAktiver/Deaktiver` + `syncProjektModulerPaa{Aktiver,Deaktiver}` igjen.
- **Server (`apps/api/src/routes/timer/onboarding.ts`):** `aktiverNivaa1` + `aktiverTomKatalog` mister dual-write — `tx.organization.update({ data: { harTimerModul: true } })` fjernet fra begge.
- **Service-kommentarer:** `services/timer/moduleGate.ts` + `services/maskin/moduleGate.ts` har oppdaterte kommentarer som ikke lenger nevner `Organization.har_*_modul`-flagget.

**Hva Fase C IKKE gjør:**
- Ingen klient-endring — `Firma`-typen i `firma-kontekst.tsx` ble migrert i Fase B og berøres ikke her.
- Ingen API-bakoverkompat-bruddsjekk: feltene ble fjernet fra alle respons-typer i Fase B, så klienter (mobil, eldre web-builds) kan eventuelt få type-mismatch hvis de fortsatt forventer `harTimerModul`/`harMaskinModul`. Mobil sjekk: 0 callsites verifisert i Fase A — ingen risk. Web bygger fra samme commit.
- Ingen i18n-endring.

**Verifisering:** `pnpm --filter @sitedoc/db exec prisma generate` grønt. `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (32.7s).

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer på test: (1) psql `\d organizations` viser at `har_timer_modul` + `har_maskin_modul`-kolonnene er borte; (2) som Kari Firmaadmin — toggle Timer av/på på `/dashbord/firma/moduler` fungerer fortsatt (skriver til OrganizationModule); (3) FirmaVelger viser fortsatt «Maskin · Timer» under Byggeleder; (4) Timer-elementer i prosjekt-sidebar uendret. **Stopp og rapporter etter test-verifisering — Steg 1e er da fullt ut levert. Forutsetter prod-deploy som lukker Steg 4b-blokkeren (Vareforbruk).**

**Steg 1e Fase B (callsite-migrering til OrganizationModule) DEPLOYET TIL TEST 2026-05-05** (commit `978c1bf4`). Verifisert: FirmaVelger viser «Maskin · Timer» under Byggeleder, `/dashbord/firma/moduler` toggle fungerer, Timer-elementer i prosjekt-sidebar uendret. 47 callsites migrert fra `harTimerModul`/`harMaskinModul`-flagg til `aktiveFirmamoduler: string[]`. Lese-veien er nå utelukkende fra OrganizationModule-tabellen, men dual-write til flagg beholdt inntil Fase C dropper kolonnene.

**Steg 1e Fase A (OrganizationModule-tabell + bakfyll + dual-write) IMPLEMENTERT på develop 2026-05-05.** Bygger på Fase A. Migrerer alle 47 callsites fra `harTimerModul`/`harMaskinModul`-flagg til ny `aktiveFirmamoduler: string[]`-modell. Dual-write fra Fase A er beholdt — flaggene oppdateres fortsatt parallelt med OrganizationModule-rader inntil Fase C dropper kolonnene. Lese-veien er nå utelukkende fra OrganizationModule-tabellen.

**Endringer i Fase B:**
- **Service (`apps/api/src/services/firmamodul.ts`):** ny helper `hentAktiveFirmamoduler(organizationId, txClient?)` returnerer `string[]` — alle slugs der `OrganizationModule.status="aktiv"`. Gjenbrukes av `organisasjon.hentMin/hentMedId`, `admin.hentAlleOrganisasjoner`, `prosjekt.opprett/opprettTestprosjekt`. Eksisterende `erFirmamodulAktivert(orgId, slug)` (Fase A) brukes som boolean-sjekk.
- **Server-respons-typer:**
  - `organisasjon.hentTilgjengelige`: returnerer nå `{ id, name, erKunde, aktiveFirmamoduler: string[] }` per firma. Egen N+1-fri batch-spørring mot OrganizationModule berikes etter findMany.
  - `organisasjon.hentMin` + `hentMedId`: beriker Organization-respons med `aktiveFirmamoduler`-felt via Promise.all.
  - `admin.hentAlleOrganisasjoner`: tilsvarende batch-berikning av Organization[]-respons.
- **Server-internal:**
  - `services/timer/moduleGate.ts` + `services/maskin/moduleGate.ts`: leser nå fra `erFirmamodulAktivert` (OrganizationModule) i stedet for `Organization.har_*_modul`-flagg.
  - `prosjekt.opprett` + `opprettTestprosjekt`: bruker `hentAktiveFirmamoduler` i stedet for `select: { harTimerModul, harMaskinModul }`.
  - `timer/onboarding.status` + `aktiverNivaa2`: leser fra `erFirmamodulAktivert`. Returfeltet `harTimerModul: boolean` beholdt på response — feltnavnet er semantisk korrekt for boolean-sjekk i timer-spesifikk klient-kontekst.
- **Klient:**
  - `Firma`-typen i `firma-kontekst.tsx` har nå `aktiveFirmamoduler: string[]` i stedet for `harTimerModul/harMaskinModul: boolean`.
  - `firma/layout.tsx` + `firma/moduler/page.tsx` + `FirmaVelger.tsx` + `HovedSidebar.tsx` + `admin/firmaer/page.tsx`: alle lese-callsites byttet til `aktiveFirmamoduler.includes("timer")`/`includes("maskin")`. Lokale variabelnavn `harTimerModul`/`harMaskinModul` beholdt der det er hjelper-leser (semantisk navngivning, ikke felt-aksess).
  - `firma/timer/layout.tsx` + `firma/timer/onboarding/page.tsx` leser fortsatt `status.harTimerModul` fra `trpc.timer.onboarding.status` — det er en timer-spesifikk respons-felt (ikke fra Firma-typen) og beholdes for semantisk klarhet.

**Hva Fase B IKKE gjør:**
- Ingen drop av `har_*_modul`-kolonner — det skjer i Fase C.
- Skriving til OrganizationModule fra `settFirmamodul` + `timer/onboarding.aktiverNivaa1`/`aktiverTomKatalog` skjer fortsatt som dual-write — gir trygg overgang til Fase C.
- Mobil ikke berørt (0 callsites).

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (32.6s). Ingen DB-migrasjon, ingen i18n.

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer på test: (1) som **Tore SiteDocAdmin** — FirmaVelger viser «Maskin · Timer» under Byggeleder-firma (avledes nå fra `aktiveFirmamoduler` i stedet for flagg); (2) som **Kari Firmaadmin** — `/dashbord/firma/moduler` reflekterer korrekt aktiv-status, deaktiver Timer → reaktiver fungerer end-to-end (dual-write skriver til både flagg og OrganizationModule); (3) Timer-elementer i prosjekt-sidebar gates fortsatt på ProjectModule (ikke flagg) — uendret atferd. **Stopp og rapporter etter test-verifisering — Fase C avventer eksplisitt grønt lys.**

**Steg 1e Fase A (OrganizationModule-tabell + bakfyll + dual-write) DEPLOYET TIL TEST 2026-05-05** (commit `9fda0f81`). Verifisert som innlogget Kari Firmaadmin: deaktiver/reaktiver Timer fungerer ende-til-ende, sidebar oppdateres synkront, bekreftelsesdialog vises ved deaktivering. 2 bakfylte rader for Byggeleder (timer + maskin, status=aktiv) verifisert via psql. Fase A er **bakoverkompatibel** — har_*_modul-flaggene er fortsatt sannhetskilde, OrganizationModule oppdateres parallelt via dual-write. Sjette steg i prioritert byggerekkefølge fra [domene-arbeidsflyt.md](domene-arbeidsflyt.md). Erstatter `Organization.har_timer_modul`/`har_maskin_modul`-kolonnene med generisk `OrganizationModule`-tabell. Skalerbar til flere firmamoduler (kompetanse, fremdrift, varelager) uten schema-endring per ny modul. Forutsetning for Steg 4b (Vareforbruk).

**Tre-faset utrulling (Fase A bakoverkompatibel):**
- **Fase A** (denne): tabell opprettet + bakfylt, callsites uendret, dual-write fra `settFirmamodul` + `timer/onboarding.aktiverNivaa1` + `aktiverTomKatalog` til både flagg og ny tabell.
- **Fase B** (etter test-verifisering): migrér 47 callsites (23 server, 20 klient, 2 schema, 0 mobil) fra `harTimerModul`/`harMaskinModul` til `aktiveFirmamoduler: string[]` på Firma-typen.
- **Fase C** (etter Fase B-verifisering): drop `har_timer_modul` + `har_maskin_modul`-kolonnene fra Organization.

**Endringer i Fase A:**
- **Migrasjon `20260505000001_add_organization_module_fase_a`:** CREATE TABLE `organization_modules` med felter `(id, organization_id, module_slug, status, aktivert_ved, aktivert_av_user_id, deaktivert_ved, deaktivert_av_user_id, config, created_at, updated_at)`. Unique `(organization_id, module_slug)`, index på `(module_slug, status)`. FK til `organizations` med Cascade. `aktivert_av/deaktivert_av_user_id` er String? uten Prisma-`@relation` per A.3-mønster (bevarer audit-spor ved User-sletting). Bakfyll: INSERT-statements som speiler eksisterende `har_*_modul=true` fra Organization-tabellen, `aktivert_ved` settes til `organization.created_at` som beste tilnærming.
- **Schema (`packages/db/prisma/schema.prisma`):** Ny `OrganizationModule`-modell + `organizationModules OrganizationModule[]`-relasjon på Organization. Kommentar over `harMaskinModul`/`harTimerModul`-flaggene oppdatert til å beskrive Fase A-overgang.
- **Service (`apps/api/src/services/firmamodul.ts`):** Tre nye helpers — `erFirmamodulAktivert(orgId, slug)` (read fra ny tabell, klar for Fase B), `skrivOrganizationModuleAktiver(tx, orgId, slug, userId)` (upsert med audit), `skrivOrganizationModuleDeaktiver(tx, orgId, slug, userId)` (soft-delete via deaktivert_ved). Eksisterende `syncProjektModulerPaa{Aktiver,Deaktiver}` (Steg 1c Fase B) uendret.
- **Server (`apps/api/src/routes/organisasjon.ts`):** `settFirmamodul`-mutation utvidet med dual-write — kaller nå `skrivOrganizationModuleAktiver/Deaktiver` i samme `$transaction` som flagget oppdateres og `syncProjektModulerPaaAktiver/Deaktiver` kjøres. `ctx.userId` brukes som `aktivertAvUserId`/`deaktivertAvUserId`.
- **Server (`apps/api/src/routes/timer/onboarding.ts`):** `aktiverNivaa1` + `aktiverTomKatalog` utvidet med dual-write (kaller `skrivOrganizationModuleAktiver` i samme `$transaction`). `aktiverNivaa2` uberørt (krever at modul allerede er aktivert — ingen tilstandsendring).
- **Dokumentasjon (`docs/claude/fase-0-beslutninger.md` § A.4):** Peker til Steg 1e med overstyring-rasjonale lagt til. A.4 ProjectModule-utvidelse for prosjekt-instans-laget består uendret; firma-master-laget flyttes til ny tabell.

**Hva Fase A IKKE gjør:**
- Ingen klient-endring — `Firma`-typen i `firma-kontekst.tsx` beholder `harTimerModul`/`harMaskinModul`. Migreres i Fase B.
- Ingen drop av kolonner — `har_*_modul` er fortsatt sannhetskilde. Droppes i Fase C.
- Ingen Activity-logging av modul-aktivering ennå (audit-feltene på OrganizationModule-tabellen er kun bevegelse-historikk, ikke full event-stream).
- Ingen cross-org ProjectModule-unique — Steg 1e-spec sier dette skal vurderes samtidig, men er utsatt til separat steg per Kenneths beslutning 2026-05-05 (krever firmamodul-vs-prosjektmodul-distinksjon i schema/runtime).

**Verifisering:** `pnpm --filter @sitedoc/db exec prisma generate` grønt. `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (32.4s). Migrasjons-SQL ikke kjørt mot lokal-DB ennå (test+prod auto-deploy applier den).

**Bakfyll-forventning ved deploy:**
- Test-DB: 1 firma med begge flagg (Byggeleder) → 2 OrganizationModule-rader (timer + maskin, status=aktiv).
- Prod-DB: 3 firma med begge flagg (A.Markussen + HRP AS + Kenneths testmiljø) → 6 rader.

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer på test: (1) psql-spørring `SELECT organization_id, module_slug, status, aktivert_ved FROM organization_modules ORDER BY organization_id, module_slug` returnerer 2 rader for Byggeleder; (2) toggle Timer av/på i `/dashbord/firma/moduler` som Kari Firmaadmin → bekreft at både `harTimerModul`-flagg OG `OrganizationModule`-rad oppdateres synkront (psql-verifisering); (3) `aktivertAvUserId`/`deaktivertAvUserId` fylles korrekt med innloggets userId. **Stopp og rapporter etter test-verifisering — Fase B avventer eksplisitt grønt lys.**

**Reginn MREG (2026-05-05):** API-nøkler mottatt. N2.2.3 i oppryddings-plan aktivert. Venter på svar fra Anders (anders@sentralregisteret.no) om funksjonelle endepunkter — kun `/auth/session/get` er dokumentert så langt. Sakkyndig kontroll-felter (`sakkyndigKontrollSist/Frist/Organ/Nr`) kan legges til Equipment-skjema nå uten API. Reginn-worker bygges analogt med Vegvesen-worker. Tekniske rammer dokumenteres i [reginn-mreg-integrasjon.md](reginn-mreg-integrasjon.md) (opprettes separat). Blokkeren «avventer API-tilgang» fra N2.2.3 er fjernet.

**FirmaVelger-kontekst på `kom-i-gang` DEPLOYET TIL PROD 2026-05-05** (`66c2e982` merge, `9a750681` impl). HTTP/2 200 verifisert mot sitedoc.no. Test-verifisert begge redirect-scenarier som Tore SiteDocAdmin før prod-deploy. Sitedoc_admin med valgt firma redirectes til `/dashbord/nytt-prosjekt`, uten valgt firma til `/dashbord/admin/firmaer`. `opprettTestprosjekt` tar nå valgfri `organizationId` med samme autorisering som `prosjekt.opprett`. Vanlig bruker / company_admin uberørt. Lukker en regresjon som ble identifisert under faggruppe-konsolideringssesjonen: `prosjekt.opprettTestprosjekt`-mutationen ignorerte FirmaVelger-kontekst og brukte alltid innlogget brukers `organizationId`. Sitedoc_admin (Kenneth, org=Kenneths testmiljø) som hadde valgt A.Markussen i FirmaVelger og klikket «Start gratis prøveperiode» på `/dashbord/kom-i-gang` fikk prosjektet opprettet på Kenneths testmiljø, ikke A.Markussen. Steg 1b/2d-mønsteret (organizationId-input + sitedoc_admin-autorisering) fanget alle `/dashbord/firma/*`-rutene + `prosjekt.opprett`, men `opprettTestprosjekt` ble glemt fordi den ligger i kom-i-gang-flyten utenfor firma-tre-strukturen.

**Strategi: redirect + fix.** Ikke to flyter på samme side («kom-i-gang» er konseptuelt for nye brukere, ikke superadmin som onboarder kunder; «prøveperiode»-framing er semantisk feil for betalende kunde). I stedet redirectes sitedoc_admin bort, og selve mutationen fixes som forsvar i dybden.

**Endringer:**
- **Server (`apps/api/src/routes/prosjekt.ts`):** `opprettTestprosjekt` får valgfri `organizationId: z.string().uuid().optional()`-input. Speiler `prosjekt.opprett`-autorisering (linje 127-141): sitedoc_admin → enhver org, vanlig bruker → kun egen org, ellers FORBIDDEN. Fallback til `bruker.organizationId` når input ikke gitt. `Project.primaryOrganizationId` + `ProjectOrganization` + `ProjectModule`-rader bruker nå `valgtOrgId` i stedet for `bruker.organizationId`.
- **Klient (`apps/web/src/app/dashbord/kom-i-gang/page.tsx`):** Importerer `useFirma`. Ny `useEffect` lytter på `erSitedocAdmin`, `valgtFirma`, `firmaLaster`. Sitedoc_admin med valgt firma → `router.replace("/dashbord/nytt-prosjekt")` (siden har info-banner for sitedoc_admin fra Steg 2d). Sitedoc_admin uten valgt firma → `router.replace("/dashbord/admin/firmaer")` (kan velge eksisterende eller opprette nytt — «Opprett firma»-knapp finnes allerede). Vanlig bruker / company_admin: ingen redirect. Prøveperiode-mutation sender nå `valgtFirma?.id` som organizationId — defensivt, gjelder også sjeldne tilfeller der vanlig bruker har flere orger.

**Hva endringen IKKE dekker (separate oppgaver):**
- `eksternKostObjekt.ts:22-28` (`hentBrukerOrgId`-helper) faller fortsatt tilbake til `bruker.organizationId`. Read-only ECO-katalog-list — sitedoc_admin med valgt firma ser fortsatt egen ECO-liste, ikke valgt firmas. Mindre alvorlig (ingen skriving). Tas i egen runde hvis det blir aktuelt.
- Slå sammen `kom-i-gang` og `nytt-prosjekt` til én smart side — strukturell endring, ut av scope.
- Onboarding-veileder + prosjektoppsett-veileder (planlagt post-Fase 0) — ikke berørt.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (33.1s). Ingen DB-migrasjon, ingen i18n.

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer som **Tore SiteDocAdmin** på test: (1) velg Byggeleder i FirmaVelger, gå til `/dashbord/kom-i-gang` → forventet auto-redirect til `/dashbord/nytt-prosjekt`; (2) fjern firma-valg via DevTools `localStorage.removeItem("sitedoc-valgt-firma")`, refresh `/dashbord/kom-i-gang` → forventet redirect til `/dashbord/admin/firmaer`; (3) som **Per Prosjektadmin** (vanlig bruker): `/dashbord/kom-i-gang` viser fortsatt feature-kort + prøveperiode-knapp, klikk oppretter prosjekt på Per Prosjektadmins firma (Byggeleder).

**Faggruppe-side-konsolidering DEPLOYET TIL PROD 2026-05-05** (`d62ffa6c` merge, `5942f396` impl). HTTP/2 200 verifisert mot sitedoc.no. Test-verifisert full CRUD (opprett/rediger/slett + bekreftelsesdialog) som Per Prosjektadmin før prod-deploy. Lukker Tiltak 2 i [navigasjon-arkitektur-analyse-2026-05-03.md](navigasjon-arkitektur-analyse-2026-05-03.md) og er forutsetning for selvstendig A.Markussen-onboarding (per [STATUS-AKTUELT.md § Onboarding-veileder](STATUS-AKTUELT.md)). De to nesten-identiske sidene er erstattet med én konsolidert side.

**Funn under verifisering FØR koding:** Statusrapporten beskrev legacy-siden `/dashbord/prosjekter/[id]/faggrupper` som «full CRUD», men kode-verifisering viste at den kun hadde **opprett**-Modal — ingen rediger eller slett i UI. Server-routeren (`apps/api/src/routes/faggruppe.ts`) har full CRUD inkludert `oppdater` og `slett` (sistnevnte med pen feilmelding ved tilknyttede sjekklister/oppgaver). Konsolideringen krevde derfor å bygge rediger og slett som ikke fantes i UI fra før — ikke ren sammenslåing.

**Endringer:**
- **Klient (`apps/web/src/app/dashbord/[prosjektId]/faggrupper/page.tsx`):** Erstattet read-only tabell + «Administrer faggrupper»-lenke med full CRUD: «Ny faggruppe»-header-knapp, rediger-/slett-ikoner per rad i ny handlinger-kolonne. Tre modaler — `OpprettFaggruppeModal` (firmanavn + org.nr), `RedigerFaggruppeModal` (samme felter, prefylt, lokal id-tracking for state-reset ved bytte av rad), `SlettFaggruppeDialog` (ekte modal per CLAUDE.md UI-regel, viser server-feilmelding hvis koblinger blokkerer slett). Alle felter har `t()` for i18n.
- **Slettet:** `apps/web/src/app/dashbord/prosjekter/[id]/faggrupper/page.tsx` (hard delete — ingen redirect-stub, web-URL-er trenger ikke API-bakoverkompat).
- **Nav-rens (`apps/web/src/app/dashbord/prosjekter/[id]/layout.tsx`):** Fjernet «Faggrupper»-fanen fra tab-nav-arrayet. Fanene Oversikt/Maler/Sjekklister/Oppgaver beholdt — opprydding av hele legacy-`prosjekter/[id]`-strukturen er separat oppgave.
- **Kort-href (`apps/web/src/app/dashbord/prosjekter/[id]/page.tsx`):** Faggrupper-oversiktskortet peker nå til `/dashbord/${id}/faggrupper` (ny rute) i stedet for `${basePath}/faggrupper` (slettet).
- **i18n:** 1 ny nøkkel `faggrupper.bekreftSlett` (nb+en — «Slett faggruppen «{{navn}}»? Dette kan ikke angres.»). Gjenbrukte `faggrupper.{nyFaggruppe,redigerFaggruppe,slettFaggruppe,ingenFaggrupper,ingenFaggrupperBeskrivelse,firma,organisasjonsnummer}` + `handling.{opprett,lagre,slett,avbryt,rediger}` + `dashbord.medlemmer` + `nav.{sjekklister,oppgaver}`.

**Hva konsolideringen IKKE dekker (separate oppgaver):**
- Rediger ansvarlig/farge/partner — Kenneth bekreftet at disse tas i egen runde (ut av scope)
- Soft-delete (deaktiver) — server har det, UI bruker hard delete (Kenneths beslutning, server returnerer pen feilmelding ved koblinger)
- Hele `dashbord/prosjekter/[id]/*`-strukturen — kun Faggrupper-fanen fjernet, andre faner og selve oversiktssiden står igjen
- i18n-nøkkel `faggrupper.administrerBeskrivelse` (gammel hjelpetekst på read-only-siden) — er ikke i bruk lenger, kunne fjernes som opprydding

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (31.7s) — ny rute `/dashbord/[prosjektId]/faggrupper` (3.1 kB) kompilert, legacy `/dashbord/prosjekter/[id]/faggrupper` borte fra build-output. Ingen DB-migrasjon, ingen server-endring (router har full CRUD fra før).

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer som **Per Prosjektadmin** på test: (1) opprett ny faggruppe «Test AS» med org.nr → vises i tabell, (2) rediger til «Test AS Endret» → oppdatert i tabell, (3) prøv slette en faggruppe med tilknyttet sjekkliste → får pen feilmelding fra server («Kan ikke slette ... fordi den har X sjekklister tilknyttet»), (4) slett en faggruppe uten koblinger → forsvinner, (5) verifiser at `/dashbord/prosjekter/[prosjektId]/faggrupper` returnerer 404, (6) verifiser at Faggrupper-fanen er borte fra `/dashbord/prosjekter/[prosjektId]`-tab-nav.

**«Hvem har ballen»-badge på dokument-detaljsider IMPLEMENTERT på develop 2026-05-05.** Lukker funn fra STATUS-AKTUELT.md (2026-05-02): «Inne på dokumentet vises kun status — ingen «Venter på X»». Listene hadde badge fra før — kun detalj-sidene manglet. Server: `sjekkliste.hentMedId` + `oppgave.hentMedId` får `recipientGroup: { select: { id, name } }` på toppnivå (var inkludert i `transfers`-relasjonen, men ikke direkte på dokumentet). Klient: badge ved siden av `<StatusBadge />` i header på `[prosjektId]/sjekklister/[sjekklisteId]/page.tsx` og `[prosjektId]/oppgaver/[oppgaveId]/page.tsx`. Synlig kun når status ∈ {sent, received, in_progress} OG `recipientGroup?.name` finnes — speiler liste-vyenes logikk eksakt. Bruker eksisterende i18n-nøkkel `tabell.venterPaa` (allerede i nb+en, ingen ny nøkkel). Sjekkliste-detalj-siden manglet `useTranslation`-import — lagt til. Oppgave-detalj-siden hadde det fra før.

**Hva «Hvem har ballen»-badge IKKE dekker:**
- `recipientUserId`-tilfellet (transfer sendt til konkret person, ikke gruppe). Speiler listene som også kun viser gruppe. Person-tilfellet kan tas senere hvis det blir etterspurt.
- `<FlytIndikator>`-komponenten på detalj-sidene viser allerede flyten — badge er supplement, ikke erstatning.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (27.3s). Ingen DB-migrasjon, ingen ny i18n.

**Auto-deployes til test via cron.** Klar for verifisering. Claude verifiserer på test som **Per Prosjektadmin**: åpne en sjekkliste/oppgave med status=sent eller received → forventet «Venter på: [gruppenavn]»-badge ved siden av status-pill i header.

**P1 Fase 2 (auto-reset av prosjekt ved firma-bytte) DEPLOYET TIL PROD 2026-05-05** (`5674df71` merge, `26cc0326` impl). HTTP/2 200 verifisert. Sitedoc_admin med valgt firma og aktivt prosjekt fra annet firma (eller standalone) får automatisk reset + redirect til `/dashbord`. Type-utvidelse: `Prosjekt`-interface i klient-konteksten får `primaryOrganizationId: string | null`. Lukker P1 fullt ut sammen med Blokk A.

**P1 Fase 2 (auto-reset av prosjekt ved firma-bytte) IMPLEMENTERT på develop 2026-05-05.** Lukker P1 fullt ut sammen med Blokk A. Femte tiltak fra [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md) (tabell-rad #5).

**Atferd per scenario:**
| Scenario | Før | Etter | Atferd |
|---|---|---|---|
| A | Byggeleder + Byggeleder-prosjekt aktivt | Annet firma | **Reset** + redirect til `/dashbord` |
| B | Byggeleder + Byggeleder-prosjekt aktivt | Byggeleder (idempotent) | Ingen reset |
| C | Ingen firma + Byggeleder-prosjekt aktivt | Byggeleder | Ingen reset |
| D | Ingen firma + A.Markussen-prosjekt aktivt | Byggeleder | **Reset** + redirect |
| E | Byggeleder + Byggeleder-prosjekt aktivt | Fjerner firma-valg (null) | Ingen reset |
| F | Standalone-prosjekt aktivt | Et firma valgt | **Reset** + redirect |

**Endring:** `apps/web/src/kontekst/prosjekt-kontekst.tsx`:
- `Prosjekt`-interface utvidet med `primaryOrganizationId: string | null`. Server returnerer feltet uendret (`prosjekt.hentMedId` bruker `findUniqueOrThrow` uten select-klausul, alle toppnivå-felter inkludert) — ingen server-endring.
- Ny `useEffect` lytter på `valgtFirma`, `valgtProsjekt`, `lasterValgt`. Vakt-rekkefølge: `if (!valgtFirma) return` (ingen begrensning ved null-firma) → `if (lasterValgt) return` (vent på data) → `if (!valgtProsjekt) return` → `if (matched) return`. Ved konflikt: `setLagretProsjektId(null) + localStorage.removeItem(STORAGE_KEY) + router.push("/dashbord")`.

**Hva P1 Fase 2 IKKE dekker:**
- URL-deeplink: hvis sitedoc_admin lim-er en `/dashbord/[prosjektId]/...`-URL og prosjektet ikke matcher valgt firma, vil URL-en dominere over localStorage. Reset trigges først når `hentMedId` returnerer prosjektet og useEffect kjører — kort flicker mulig.
- Auto-velg første prosjekt etter reset: brukeren havner på `/dashbord` (ikke automatisk-redirect). Auto-redirect-logikk i `dashbord/page.tsx` håndterer 1-prosjekt-case.
- Auto-reset ved tilgangstap (separat fra firma-bytte-flow).

**Verifisering:** `pnpm build --filter @sitedoc/web` grønt (27.9s). Ingen DB-migrasjon, ingen i18n, ingen server-endring.

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer som **Tore SiteDocAdmin**: (1) scenario A — velg Byggeleder, åpne et Byggeleder-prosjekt, bytt til annet firma → forventet redirect til `/dashbord`; (2) scenario B — bytte Byggeleder→Byggeleder via FirmaVelger → ingen reset; (3) scenario E — fjern firma-valg via DevTools `localStorage.removeItem("sitedoc-valgt-firma")` → ingen reset.

**Auto-deploy-cron implementert 2026-05-05** (`b4a920b1` på develop). Polling-cron `*/2 * * * *` på serveren erstatter manuell SSH-deploy. Script: `~/programmering/deploy-test-cron.sh`. Logg: `~/programmering/logs/deploy-test.log`. Verifisert end-to-end: push `76a2b4c8` → cron 01:14:00 → deploy fullført 01:14:12 (FULL TURBO 437ms build). Idempotent: kjører kun ved diff mellom HEAD og origin/develop. Funnet under undersøkelse: Tidligere «auto-deploy-hook» nevnt i SITEDOC-CLAUDE-VEILEDER.md var dokumentasjons-drift — ingen mekanisme har eksistert til nå (verifisert ved sjekk av lokale + server git-hooks, GitHub Actions, PM2-prosesser, crontab og systemd). Cloudflare Access via tunneled SSH gjorde GitHub Actions-veien mer kompleks enn polling-cron — derfor cron-løsningen.

**Blokk C (P2 — admin/firmaer erKunde-filter + Timer-kolonne) DEPLOYET TIL PROD 2026-05-04** (`e2729849` merge, `261a0c8e` impl). Tredje del av [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md) (tiltak #3 i prioritert tiltak-rekkefølge). Lukker P2-funnet: skall-firmaer blandes ikke lenger med kunde-firmaer i admin-vyen, og Timer-modul-status er synlig på linje med Maskin.

**Endringer:**
- **Server (`apps/api/src/routes/admin.ts`):** `hentAlleOrganisasjoner` får `where: { erKunde: true }` på `findMany`. Ingen klient-endring kreves for filteret. Test-DB: filteret skjuler 4 skall-firmaer (Byggherre, Tømrer Hansen, Elektrikker Hansen, Hovedentreprenør) og viser kun Byggeleder. Prod-DB: viser A.Markussen, HRP AS og Kenneths testmiljø — 0 skall-firmaer å filtrere ut.
- **Klient (`apps/web/src/app/dashbord/admin/firmaer/page.tsx`):**
  - Type `OrganisasjonRad` utvidet med `harTimerModul: boolean`.
  - `Clock`-ikon importert fra lucide-react.
  - Tabell-header: ny `<th>Timer</th>` plassert mellom Integrasjoner og Maskin (matcher rekkefølgen i `firma/moduler`).
  - `FirmaRad`-celle for Timer: speiler Maskin-celle-stilen (Clock-ikon + grønn «Ja» når aktivert, grå «Nei» ellers).
  - Slide-over-detaljpanel: ny Timer-modul-status-seksjon FØR Maskin-modul-status-seksjonen (samme rekkefølge og stil — `Clock`-ikon, Aktivert/Ikke aktivert, peker til `/dashbord/firma/moduler` for endring).
- Ingen ny i18n (eksisterende kolonne-overskrifter på siden er hardkodet i samme stil — i18n-konvertering er separat opprydningsoppgave).

**Hva Blokk C IKKE dekker:**
- Skall-firma-toggle eller debug-vy: skall-firmaer er nå fullstendig usynlige fra admin-vyen. Hvis sitedoc_admin trenger å se dem (debug, opprydning) må de gå via psql.
- Abonnement-status / fakturaoversikt (P5 — egen design-runde, ~1-2 dager).
- Klikk-til-firma-admin (klikke firma → se firmaets prosjekter): slide-over viser allerede prosjekter, men ingen direkte snarvei til `/dashbord/firma/*`-administrasjon. Separat oppgave.
- i18n-konvertering av admin-vyen: hele siden har hardkodet norsk tekst. Ikke i scope for Blokk C.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (34.8s). Ingen DB-migrasjon, ingen i18n.

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer som **Tore SiteDocAdmin** på `/dashbord/admin/firmaer`: (1) listen viser kun Byggeleder (skall-firmaer skjult), (2) Timer-kolonne synlig mellom Integrasjoner og Maskin, (3) Byggeleder viser Ja for både Timer og Maskin (har_timer_modul=true, har_maskin_modul=true), (4) klikk på Byggeleder-rad åpner slide-over med både Timer-modul-seksjon og Maskin-modul-seksjon.

**Blokk A (P1 Fase 1 — prosjektliste filtreres på valgt firma) DEPLOYET TIL PROD 2026-05-04** (`12717426` merge, `51d5e3ee` impl). Andre del av [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md) (tiltak #2). HTTP/2 200 verifisert mot sitedoc.no. Sitedoc_admin med valgt firma i FirmaVelger ser nå kun prosjekter med matchende `primaryOrganizationId`. Server: `prosjekt.hentMine`+`hentAlle` tar valgfri `organizationId`. Klient: 4 callsites migrert (prosjekt-kontekst, dashbord, prosjekter-listing, timer/mine). Tom-state for sitedoc_admin med valgt firma og 0 prosjekter får firmaspesifikk tekst (1 ny i18n-nøkkel `dashbord.ingenProsjekterForFirmaBeskrivelse` nb+en). Bakfyll test-DB: 2 prosjekter satt til Byggeleder. Vanlig bruker / company_admin uberørt — `members.some.userId`-filter beholder isolasjon. Auto-reset av aktivt prosjekt ved firma-bytte er P1 Fase 2 (utsatt).

**Klikkbare prosjektrader på `/dashbord/firma/prosjekter` DEPLOYET TIL PROD 2026-05-04** (`dbf78bca` merge, `59338895` impl). Blokk B fra [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md) (tiltak #7 — quick-win før Blokk A). HTTP/2 200 verifisert mot sitedoc.no. Hele tabellraden navigerer til `/dashbord/[id]` ved klikk; `<Link>` på prosjektnavnet beholdt for cmd/ctrl+click + tastatur-fokus. `onClick` hopper over hvis target er innenfor `<a>`-tag. 1 fil endret (7 linjer).

**Header-fix per rolle DEPLOYET TIL PROD 2026-05-04** (`e3717a8c` merge, `f78113c5` impl). HTTP/2 200 verifisert mot sitedoc.no. Toppbar-rekkefølge per Kenneths rolle-spec av 2026-05-04 (etter korreksjonen 2026-05-03 om at Prosjekt er firmamodul, ikke toppnivå-entitet, dokumentert i [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md)).

**Endringer per rolle:**
| Rolle | Header (venstre → høyre) |
|---|---|
| sitedoc_admin | SiteDoc \| **FirmaVelger** \| Prosjekt \| (Byggeplass) \| Admin-knapp |
| company_admin | SiteDoc \| **Firma-fast-link** \| Prosjekt \| (Byggeplass) |
| user | SiteDoc \| Prosjekt \| (Byggeplass) — ingen firma-element |

**Tre filer endret (ingen schema, ingen RBAC, ingen auth):**
- `apps/web/src/kontekst/firma-kontekst.tsx`: utvidet med `erCompanyAdmin: boolean` (utledet fra eksisterende `minBruker.role`-data, ingen ny query). Brukes av Toppbar for å skille company_admin fra vanlig bruker.
- `apps/web/src/components/layout/FirmaVelger.tsx`: `router.push("/dashbord/firma")` lagt til etter `velgFirma()` slik at sitedoc_admin lander direkte i firma-admin-flyten ved firma-valg.
- `apps/web/src/components/layout/Toppbar.tsx`: JSX-omarrangering — firma-element flyttet FORAN ProsjektVelger for sitedoc_admin og company_admin. Vanlig bruker får ingen firma-link i toppbar lenger (tidligere fikk alle med `organizationId`-tilknytning fast firma-link via `organisasjon`-fallback). Duplisert `erSiteDocAdmin`-sjekk fra `trpc.admin.erAdmin` fjernet — `erSitedocAdmin` fra `useFirma()` er eneste kilde. `organisasjon.hentMin` enables nå kun for `erCompanyAdmin`.

**Test-deploy:** Manuell deploy nødvendig (auto-deploy-hooken trigget ikke — tredje gang i denne sesjonen, bør undersøkes separat).

**Hva header-fix IKKE løser (fortsatt åpne planlagte oppgaver):**
- Filtrering av prosjektliste på `primaryOrganizationId = valgtFirma.id` (P1 Fase 1, ~3-4t)
- Auto-reset av aktivt prosjekt ved firma-bytte (P1 Fase 2, ~2-3t)
- Bakfyll test-DB `primary_organization_id` (5 min, blokkerende for P1)
- admin/firmaer: `erKunde`-filter + Timer-kolonne (P2, ~2t)
- Admin-navigasjon redesign + abonnement-modell (P4+P5, ~1-2 dager)

Header-fix dekker rekkefølge-signalet og redirect-friksjonen, men det reelle hierarki-håndhevet (firma → prosjekter under firma) krever P1-arbeidet som står på vent.

**Cache-invalidering verifisert 2026-05-04:** `apps/web/src/app/dashbord/firma/innstillinger/page.tsx:38-44` invaliderer allerede `hentMedId` + `hentMin` + `hentTilgjengelige` ved oppdater-mutation. Ingen kode-endring nødvendig — sidebar-tittel og FirmaVelger oppdateres korrekt etter firma-info-endring.

**Steg 4a (ECO-flytt på attestering) DEPLOYET TIL PROD 2026-05-03** (`da6b34a5` merge, `f98fa7a5` impl). HTTP/2 200 verifisert mot sitedoc.no. Test-deploy krevde manuell trigger (auto-deploy-hooken trigget ikke — andre gang etter Steg 1a, bør undersøkes separat). Test-verifisert på test.sitedoc.no som Per Prosjektadmin: leder-detaljsiden åpner sedlen, ECO-velger inline på timer-rader, action-bar med Returner/Attester fungerer. Beslutning fra Kenneth/Claude før koding: scope er kun ECO-flytt (samme prosjekt), ikke cross-prosjekt. 4b (Vareforbruk) utsettes til etter Steg 1e (OrganizationModule). 4c (Godkjenning UI) starter nå.

**Endringer:**
- **Server (`apps/api/src/routes/timer/dagsseddel.ts`):**
  - Ny `flyttTimerRadEco({ timerRadId, externalCostObjectId: string | null })`-mutation. Gates med `krevProsjektLeder(ctxUserId, sheet.projectId)`. Status-vakt: kun `sent` tillates (returned er hos ansatten, accepted er låst av snapshot, draft har aldri vært innom leder). ECO-validering hvis ikke null: `slettetVed=null`, `organizationId === sheet.organizationId`, `projectId === sheet.projectId`, `status="aktiv"`, `timerregistreringApen=true`. Activity-log (best-effort try/catch) skriver `target_type=sheet_timer`, `action=timer.eco-flyttet`, payload `{sheetId, fraEcoId, tilEcoId}` — ikke-blokkerende ved feil siden selve flyttingen allerede er committed.
  - Ny `hentForAttestering({id})`-query. Autoriserer på `krevProsjektLeder` i stedet for `hentEgenDagsseddel` (som krever eierskap eller sitedoc_admin/company_admin med matchende org). Beriker med ansatt-info fra kjernen-DB. Løser eksisterende svakhet der Per Prosjektadmin ikke kunne åpne ansattens detaljside fra attestering-tabellen.
- **Klient (`apps/web/src/app/dashbord/[prosjektId]/timer/attestering/[id]/page.tsx`):** Ny dedikert leder-detaljside. Header med dato, prosjektnavn, ansatt-info og StatusBadge. 4 seksjoner: Detaljer (read-only), Timer-rader (ECO-felt redigerbart inline via `<select>` + fjern-X-knapp, øvrige felter read-only), Tillegg (read-only, vises kun hvis rader finnes), Maskin (read-only, vises kun hvis rader finnes). Action-bar nederst med Returner-knapp (åpner kommentar-modal) + Attester-knapp. ReturnerDialog gjenbruker eksisterende returner-mutation fra Runde 1C. Ikke-sent-sedler viser fallback-melding «Sedlen kan ikke endres ({{status}})».
- **Klient (`apps/web/src/app/dashbord/[prosjektId]/timer/attestering/page.tsx`):** Chevron-lenken i tabellraden navigerer nå til `/timer/attestering/${rad.id}` (ny leder-rute) i stedet for `/timer/${rad.id}` (ansattens detaljside). Tidligere lenke ga FORBIDDEN for Per Prosjektadmin (User.role="user" + ProjectMember.role="admin") siden ansattens `hentMedId` kun aksepterer eierskap eller sitedoc_admin/company_admin.
- **i18n:** 5 nye nøkler under `timer.attestering.flyttEco.{etikett,ingenEco,fjernEco}` + `timer.attestering.tilbake` + `timer.attestering.detalj.ikkeRedigerbar` i nb+en.

**Hva 4a IKKE dekker:**
- Cross-prosjekt-flytt (avklart utenfor scope — krever DailySheet-rekonstruksjon pga `(userId, projectId, dato)` UNIQUE).
- Endring av lønnsart/timer/aktivitet/beskrivelse/klokkeslett — er ansattens domene, returneres ved behov.
- Bulk-flytt (én rad om gangen — ingen multi-select).
- Mobil leder-attestering (kun web — Runde 2-godkjent scope).
- Auto-revert ved attestering — snapshot-pattern (A.7) låser uansett.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (34.5s) — ny rute `/dashbord/[prosjektId]/timer/attestering/[id]` (4.71 kB) kompilert. Ingen DB-migrasjon.

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Etter test-deploy skal Claude verifisere som innlogget Per Prosjektadmin (ke.myrhau@gmail.com): (1) åpne sedel fra Ola Tømrer i `/dashbord/[prosjektId]/timer/attestering/[id]`, (2) bytt ECO på en rad og fjern ECO fra annen, (3) attester sedlen og verifiser via psql at `attestertSnapshot` reflekterer nye ECO-verdiene, (4) som Ola Tømrer (vanlig bruker): bekreft at `/attestering/[id]`-ruten returnerer FORBIDDEN.

**Steg 3 (maskin-import med firma-kontekst) DEPLOYET TIL PROD 2026-05-03** (`33a2b9b4` merge, `e7ddc397` impl). HTTP/2 200 verifisert mot `/dashbord/maskin/import` på sitedoc.no.

**A.Markussen-maskinimport gjennomført på prod 2026-05-03.** Kenneth utførte importen via UI som sitedoc_admin med A.Markussen (`4488fe17-7490-409f-9c1c-2827f257c54d`) valgt i FirmaVelger. Verifisert via psql:
- **Equipment-tellinger:** 124 totalt — 36 kjøretøy + 50 anleggsmaskin + 38 småutstyr (matcher SmartDok-undersøkelsens forventning fra 126-rad Excel: 125 importerbare minus 1 testrad → 124)
- **Registreringsnumre:** 36 (alle kjøretøy har gyldig regnr — matcher prosjektert 36)
- **Eierskap leid:** 11 (9XXX-internnumre per A.Markussen-konvensjon)
- **Vegvesen-kø:** 36 rader prioritet=200 opprettet ved import. Ved verifisering: 2 fullført + 34 ventende. Worker plukker én av gangen via 60s-polling — naturlig spredning over ~34 min for resten.

Steg 1+2+3 fra prioritert byggerekkefølge er nå komplett. Gjenstår: Steg 4 (Dagsseddel-utvidelser) som omfatter 4a Timer-admin (flytt prosjekt↔ECO), 4b Vareforbruk (SheetMaterial-tabell), 4c Godkjenning UI (byggherre-flyt). Steg 3 fra prioritert byggerekkefølge — to deler.

**3a — Koble import til FirmaVelger + erKunde-filter:**
- Server: ny `krevErKundeFirma(organizationId)`-helper i `apps/api/src/trpc/tilgangskontroll.ts` som validerer `Organization.erKunde === true` (NOT_FOUND hvis firma ikke finnes; FORBIDDEN hvis erKunde=false). Brukt i lokal `verifiserFirmaAdmin`-helper i `apps/api/src/routes/maskin/import.ts` slik at både `importerForhandsvisning` og `importerBekreft` blokkerer skall-firma-import. Skall-firmaer (byggherre, UE uten SiteDoc-konto) skal ikke kunne være mål for SmartDok-import siden de ikke bruker maskinregisteret.
- Klient: `useFirma()` brukes allerede (fra Steg 1b Fase B-migrering) — ingen endring i denne delen. La til tom-state hvis sitedoc_admin ikke har valgt firma: `{steg === "opplastning" && !orgId && <div>{t("firma.maskin.import.velgFirma")}</div>}` viser «Velg et kunde-firma fra toppmenyen før du kan importere».

**3b — Fil-upload UI klikkbar drag-and-drop:**
- Konvertert fra ren label til label med drag-and-drop-handlere: `onDragOver` (preventDefault + setDrarOver(true)), `onDragLeave` (setDrarOver(false)), `onDrop` (preventDefault + setDrarOver(false) + handleFilValg(e.dataTransfer.files[0])). Ny `drarOver`-state styrer visuell feedback: ved drag-over endres border til `border-sitedoc-primary` og bakgrunn til `bg-blue-50` (sterkere enn hover-statet). UploadCloud-ikonet farges også blått ved drag.
- Klikk-funksjonalitet beholdt via eksisterende label/input-mønster — klikk hvor som helst i sonen åpner filvelger.
- Validering uendret: `accept=".xlsx"` på input + sjekk på filnavn-extension i `handleFilValg`.

**Hva 3 IKKE dekker:**
- Multi-fil-support (én fil av gangen) — ikke etterspurt.
- Andre import-formater (CSV, andre Excel-strukturer) — kun SmartDok-format støttes per nå.
- Validering at filen faktisk er en SmartDok-eksport — fanges i `parseSmartDokXlsx`-parseren downstream.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (34.0s).

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer (1) at sitedoc_admin uten valgt firma ser tom-state, (2) at drag-and-drop med .xlsx fungerer (visuell feedback + opplasting), (3) at FORBIDDEN returneres hvis sitedoc_admin via DevTools sender et skall-firma-orgId (valgfri).

**Steg 2 (firma-admin-sider) DEPLOYET TIL PROD 2026-05-03** (`a1463561` merge — samlet 2b+2c+2d, 2a var allerede komplett). HTTP/2 200 verifisert mot `/dashbord/firma/moduler`, `/dashbord/firma/innstillinger`, `/dashbord/nytt-prosjekt`. Ingen DB-migrasjoner i Steg 2. Funksjonell verifisering på test før prod-deploy: sitedoc_admin (Tore) opprettet prosjekt for Byggeleder via firma-kontekst → primary_organization_id satt korrekt + 2 ProjectModule-rader (timer + maskin, status=aktiv) auto-opprettet.

**Steg 2d (prosjekt fra firma-kontekst) IMPLEMENTERT på develop 2026-05-03.** Tredje og siste del av Steg 2. Server tar nå valgfri `organizationId` i prosjekt-opprettelsen, klient sender valgtFirma.id, og duplikat-fil slettet.

**Endringer:**
- **Server (`apps/api/src/routes/prosjekt.ts`):** `createProjectSchema` utvidet med `organizationId: z.string().uuid().optional()` i `packages/shared/src/validation/index.ts`. `prosjekt.opprett` autoriserer mot bruker-rolle: sitedoc_admin → tilgang til enhver org; ellers krever input.organizationId === bruker.organizationId, eller FORBIDDEN. Falleback: hvis input.organizationId ikke gitt, bruk bruker.organizationId. Den valgte orgId-en brukes for: (1) `Project.primaryOrganizationId` (manglet før Steg 2d — eksisterende prosjekter hadde ProjectOrganization-rad men ikke primaryOrganizationId), (2) ProjectOrganization-rad, (3) ProjectModule-rader for aktive firmamoduler. `opprettTestprosjekt` setter også `primaryOrganizationId` (samme manglende fix). Stripper `organizationId` fra spread-input til Project-data (det er ikke en kolonne på Project-modellen).
- **Klient (`apps/web/src/app/dashbord/nytt-prosjekt/page.tsx`):** importer `useFirma`, sender `valgtFirma?.id` som `organizationId` i mutation. Info-banner (Building2-ikon + blå bakgrunn) vises kun for sitedoc_admin med valgt kunde-firma («Prosjektet opprettes for [firma-navn]. Bytt firma i toppmenyen for å opprette på vegne av et annet firma.»). For vanlige brukere er banneret skjult — de oppretter alltid for sitt eget firma uten valg.
- **Duplikat-rensing:** `apps/web/src/app/dashbord/prosjekter/nytt/page.tsx` slettet. Var orphan-fil — alle 4 lenker i kodebasen pekte til `/dashbord/nytt-prosjekt`. Forskjellen var redirect (`/dashbord/${id}` vs `/dashbord/prosjekter/${id}`); den slettete pekte til legacy-rute som ikke har full subnavigasjon.
- 1 ny i18n-nøkkel `nyttProsjekt.opprettesFor` (nb+en).

**Hva 2d IKKE dekker:**
- Per-bruker-default-firma (hvilket firma settes som valgt i FirmaVelger ved første pålogging) — ikke scope.
- Validering på server-side at det valgte firmaet faktisk er `erKunde:true` — ikke nødvendig nå siden FirmaVelger allerede filtrerer på `erKunde:true`. Men kan legges til senere som ekstra forsvar.
- Legacy-rute `/dashbord/prosjekter/[id]/*` (som har færre undersider enn `/dashbord/[prosjektId]/*`) er ikke ryddet i scope for 2d — separat opprydningsoppgave.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (35.0s).

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer (1) at sitedoc_admin (Tore) kan velge Byggeleder i FirmaVelger og opprette prosjekt med korrekt primaryOrganizationId, (2) at info-banneret vises, (3) at vanlig bruker (Kari Firmaadmin) opprettelse av prosjekt fungerer som før, (4) at ProjectModule-rader auto-opprettes (Steg 1c-flow gjenbrukes). **Steg 2 komplett etter dette — alle 4 sub-oppgaver dekket** (2a allerede komplett før, 2b+2c+2d nå deployet).

**Steg 2c (OrganizationSetting-UI) IMPLEMENTERT på develop 2026-05-03.** Andre del av Steg 2 fra prioritert byggerekkefølge. Utvider `/dashbord/firma/innstillinger`-siden med 4 nye seksjoner som dekker alle gjenværende OrganizationSetting-felter (kompetanse-policy var allerede dekket fra Fase 0.5).

**Endringer:**
- `apps/web/src/app/dashbord/firma/innstillinger/page.tsx`:
  - Ny `TidssoneSeksjon`-komponent: dropdown med 7 tidssoner (Europe/Oslo default + Stockholm/København/Helsinki/Berlin/London/UTC). Bruker `organisasjon.oppdaterSetting`-mutation. Endring lagres umiddelbart ved valg (ingen separat lagre-knapp).
  - Ny generisk `TilgangPolicySeksjon`-komponent: tar `felt`-prop (timerTilgangDefault | vareforbrukTilgangDefault | maskinbrukTilgangDefault) + tittel/beskrivelse-i18n-nøkler. Renderer 3 radio-knapper med samme verdi-sett: `alle-ansatte` / `kun-prosjektmedlemmer` / `sertifiserte` (matcher Zod-enum i `oppdaterSetting`-mutation). Eliminerer dobling av kode for de tre tilgang-feltene som har identisk UI-mønster.
  - Tre `<TilgangPolicySeksjon>`-instanser instansiert med ulike felt: Timer, Vareforbruk, Maskinbruk. Plassering: under firma-info-skjemaet, mellom Tidssone og Kompetanse-policy.
  - `KompetansePolicySeksjon` (eksisterende fra Fase 0.5) beholdt som siste seksjon — har annen verdi-mengde (`firma_admin`/`bruker_egen`/`alle`) så ikke gjenbrukes via `TilgangPolicySeksjon`.
- 14 nye i18n-nøkler under `firma.innstillinger.tidssone.*` + `firma.innstillinger.tilgang{Timer,Vareforbruk,Maskinbruk}.*` + `firma.innstillinger.tilgangVerdi.{alle-ansatte,kun-prosjektmedlemmer,sertifiserte}.*` i nb+en.

**Hva 2c IKKE dekker:**
- Eksisterende `KompetansePolicySeksjon` har hardkodede norske strenger (etablert i Fase 0.5 § 2). Konvertering til i18n er separat opprydningsoppgave — ikke scope for 2c.
- Per-prosjekt-overstyring av disse defaultene er ikke bygget — de er kun «default ved opprettelse av nytt prosjekt» foreløpig. Faktisk respekt-i-runtime av `timerTilgangDefault`/`vareforbrukTilgangDefault`/`maskinbrukTilgangDefault` på prosjekt-nivå er ikke bygget — det blir senere når Vareforbruk-modul + Maskinbruk-flow kommer.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (33.7s).

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer at alle 5 seksjoner (firma-info + tidssone + 3 tilgang + kompetanse-policy) lastes og at endringer persisteres i OrganizationSetting-tabellen.

**Steg 2b (firmamodul-styring UI) DEPLOYET TIL TEST 2026-05-03** (`25cd7675`). Verifisert som innlogget Kari Firmaadmin: aktivere/deaktivere Timer/Maskin fungerer end-to-end, ProjectModule-rader synkroniserer korrekt, sidebar oppdateres. Klar for prod (avventer 2c+2d før samlet prod-deploy). Første del av Steg 2 fra prioritert byggerekkefølge. Ny dedikert side `/dashbord/firma/moduler` for å aktivere/deaktivere firmamoduler — erstatter den manuelle `UPDATE organizations SET har_*_modul = true`-prosedyren som tidligere var dokumentert i `admin/firmaer/page.tsx`-modal.

**Endringer:**
- Ny fil `apps/web/src/app/dashbord/firma/moduler/page.tsx` — skalerbar konfig-tabell (`MODULER`-array) med 5 moduler: timer + maskin (status: `tilgjengelig`), kompetanse + fremdrift + varelager (status: `kommer-snart`). Bare `tilgjengelig`-moduler har funksjonelle toggles.
- Hver kort: ikon (Lucide), navn, beskrivelse, status-badge («Aktivert» grønn / «Kommer snart» grå), Aktiver/Deaktiver-knapp. Aktivering = direkte mutation (idempotent — `settFirmamodul` håndterer både ny aktivering og reaktivering). Deaktivering = `Modal`-bekreftelse fra `@sitedoc/ui` med advarsel («Modulen settes som arkivert på alle prosjekter firmaet er knyttet til. Data slettes ikke — du kan reaktivere senere.»).
- Bruker `useFirma().valgtFirma.harTimerModul`/`harMaskinModul` for status-visning og `organisasjon.settFirmamodul`-mutation fra Steg 1c. Cache-invalidering på `hentTilgjengelige`/`hentMin`/`hentMedId`.
- `apps/web/src/app/dashbord/firma/layout.tsx` — nytt menyelement «Moduler» (Boxes-ikon) plassert mellom Kompetanse og Timer. Synlig for alle firma-admin-brukere uavhengig av modul-status.
- `apps/web/src/app/dashbord/admin/firmaer/page.tsx` — SQL-instruks i firma-detaljmodal erstattet med peker til ny side («Velg firmaet i FirmaVelger og gå til /dashbord/firma/moduler»). Tabellradens harMaskinModul-visning beholdt uendret (oversikts-info, ikke handling).
- ~22 nye i18n-nøkler under `firma.moduler.*` i nb.json + en.json: tittel/beskrivelse/aktiver/deaktiver/aktivert/kommer-snart/dialog-tekster + per-modul navn/beskrivelse for alle 5 moduler.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (34.7s).

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer (1) at sitedoc_admin (Tore) ser den nye «Moduler»-menyelement etter å ha valgt et kunde-firma, (2) at toggle Timer/Maskin off+on virker end-to-end, (3) at deaktivering syncer ProjectModule-rader til `status="arkivert"`, (4) at sidebaren oppdateres når Timer aktiveres/deaktiveres for valgt firma. 2c (OrganizationSetting-UI med tidssone + 3 tilgang-toggles) + 2d (prosjekt fra firma-kontekst, server+klient) avventer grønt lys.

**Steg 1d (ProjectModule final cleanup, forkortet) DEPLOYET TIL PROD 2026-05-03** (`73dcbd1a` merge, `ec0ce969` impl). Migrasjon `20260503020000_drop_project_module_active` applied på sitedoc + sitedoc_test. DB-schema verifisert begge miljøer: `active`-kolonnen borte fra `project_modules`. HTTP/2 200 web, HTTP/2 204 API. Migrasjon `20260503020000_drop_project_module_active` — `ALTER TABLE project_modules DROP COLUMN IF EXISTS active`. Verifisering før drop: grep `\.active` mot apps/api/apps/web/apps/mobile returnerte 0 ProjectModule-relaterte treff (eneste treff er `Project.status`-enum i prosjekt.ts, ulik modell). Schema-rens: `active Boolean`-feltet fjernet fra `ProjectModule`-modellen, kommentar oppdatert til endelig modell. Unique `(project_id, module_slug)` beholdes — cross-org-unique `(projectId, organizationId, moduleSlug)` flyttet til Steg 1e fordi den kun er meningsfull for firmamoduler (timer/maskin), ikke for prosjektmoduler (oversettelse/PSI/kontrollplan/etc. har 14 av 16 callsites og bør forbli én rad per prosjekt). To-stegs migration-policy A.18 oppfylt: `status`-feltet ble lagt til i `20260501000005` (deployet til prod 2026-05-01); denne migrasjonen er steg 2. `pnpm typecheck` + `pnpm build --filter @sitedoc/web` grønt. Klar for test-deploy.

**Steg 1c (OrganizationModule-overgang) DEPLOYET TIL PROD 2026-05-03** (`87fb7292` merge, `d581e399` Fase A+B + `6921ffea` mini-Fase C). Migrasjon `20260503010000_steg_1c_module_backfill` applied på sitedoc + sitedoc_test. Bakfyll-tellinger: 0 rader på begge DB-er (kunde-firma har 0 prosjekter med primary-rolle ennå — auto-sync hooket aktiveres ved første prosjekt-opprettelse). HTTP/2 200 web, HTTP/2 204 API. Test-verifisert som innlogget Kari Firmaadmin før prod-deploy: nytt prosjekt → 2 ProjectModule-rader auto-opprettet (timer+maskin, status=aktiv, organization_id=Byggeleder). Tredje steg i prioritert byggerekkefølge ferdig.

**Mini-Fase C lukker Steg 1c (kommentar-rens, ikke drop):** Drop av `har_*_modul`-kolonner krever en `OrganizationModule`-tabell — firma uten prosjekter trenger flagget for å onboarde lønnsarter (A.Markussen-flow). Den jobben er utsatt til **Steg 1e** (fremtidig). Kommentarer i `schema.prisma` + `moduleGate.ts` oppdatert til endelig to-nivås-modell. Steg 1d (drop `active Boolean` + ny unique på ProjectModule) er uavhengig og påvirkes ikke.

**Fase A — datamodell + bakfyll (server-side, bakoverkompatibel):**
- Migrasjon `20260503010000_steg_1c_module_backfill` — INSERT ProjectModule(slug=timer/maskin, organizationId, status="aktiv") for alle prosjekter der primary_organization har flagget aktivert. Idempotent via `ON CONFLICT (project_id, module_slug) DO NOTHING`. Forhåndsverifisert mot test-DB (Byggeleder: 0 prosjekter med primary-rolle) og prod-DB (A.Markussen: 0 prosjekter) — migrasjonen er ren no-op safety-net nå, og blir aktiv først når kunde-firma kobles til sitt første prosjekt (via Fase B-hooks).
- Service-utvidelse: `erTimerAktivert/krevTimerAktivert` + `erMaskinAktivert/krevMaskinAktivert` tar valgfri `projectId`-param. Uten projectId: kun firma-bredt flagg (bakoverkompatibel — alle eksisterende callsites uendret). Med projectId: krever både firma-flagg OG `ProjectModule.status="aktiv"` for `(projectId, slug, organizationId)`. Error-meldinger differensierer mellom firma-scope og prosjekt-scope.

**Fase B — auto-sync-hooks + klient-migrering:**
- **`prosjekt.opprett`** (`apps/api/src/routes/prosjekt.ts`): refaktorert fra direkte create til `$transaction`. Henter brukerens `organizationId` og firma-flagg (har_timer_modul, har_maskin_modul) før transaction. I transaction: oppretter Project + ProjectOrganization + ProjectModule-rader (createMany med skipDuplicates) for hver aktive firmamodul.
- **`prosjekt.opprettTestprosjekt`**: tilsvarende — etter ProjectOrganization.create i eksisterende transaction, opprettes ProjectModule-rader for aktive firmamoduler.
- **Ny service-helper `apps/api/src/services/firmamodul.ts`** med `syncProjektModulerPaaAktiver(tx, organizationId, slug)` + `syncProjektModulerPaaDeaktiver(tx, organizationId, slug)`. Aktiver-versjonen henter alle prosjekter firmaet er knyttet til (primary OR ProjectOrganization-partner), reaktiverer eksisterende ikke-aktive rader via updateMany, og oppretter nye via createMany med skipDuplicates. Deaktiver-versjonen setter alle aktive rader til status="arkivert" (rader beholdes — historikk bevares).
- **Ny mutation `organisasjon.settFirmamodul({ organizationId, slug: "timer"|"maskin", aktiver: boolean })`**. Polymorf — dekker timer/maskin × aktiver/deaktiver. Setter har_*_modul-flagg + syncer ProjectModule i samme `$transaction`. Gates med `verifiserFirmaAdmin` (sitedoc_admin + firmaets company_admin). UI-knapp ikke bygget ennå — Kenneth/sitedoc_admin kan kalle direkte fra tRPC eller via UI som bygges i Steg 2b (firmamodul-styring under firma-admin).
- **`timer/onboarding.aktiverNivaa1`**: refaktorert til `$transaction` som setter harTimerModul + kaller syncProjektModulerPaaAktiver. Sikrer at ProjectModule-rader genereres når Timer-modul aktiveres for første gang via onboarding-flow (selv uten å bruke settFirmamodul).
- **`timer/onboarding.aktiverTomKatalog`**: tilsvarende refaktor.
- **`HovedSidebar.tsx` migrering**: Timer-elementer (`timer` + `timer-attestering`) i prosjekt-sidebar gates nå på `aktiveModuler.some(m => m.moduleSlug === "timer" && m.status === "aktiv")` (allerede hentet via `trpc.modul.hentForProsjekt`) i stedet for firma-flagg `harTimerModul`. Variabel `harTimerModul` erstattet med `harTimerModulPaaProsjekt`. Maskin-bunnelement (global lenke til `/dashbord/maskin`) beholder `harMaskinModul`-flagget siden bunn-elementet ikke er prosjekt-spesifikk.

**Hva Steg 1c IKKE gjør:**
- Fortsatt cross-org-aktivering på samme prosjekt (UE-firma med Timer-modul på A.Markussens prosjekt) er blokkert av dagens unique `(project_id, module_slug)`. Det åpnes opp i Steg 1d.
- Drop `active Boolean`-kolonne på ProjectModule + endre unique-indeks → Steg 1d (krever CI-grep for `projectId_moduleSlug`).
- Drop `har_timer_modul`/`har_maskin_modul`-kolonner på Organization → Steg 1c Fase C (avventer test-verifisering av Fase B).
- Klient-UI for firmamodul-toggle på `/dashbord/firma/innstillinger` eller egen side → Steg 2b. Mutationen `settFirmamodul` er klar å brukes så snart UI bygges.

**Verifisering:**
- `pnpm --filter @sitedoc/api typecheck` grønt
- `pnpm build --filter @sitedoc/web` grønt (37.2s)

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer (1) at sitedoc_admin (Tore) kan opprette prosjekt for A.Markussen-kontekst og at ProjectModule-rader for timer+maskin opprettes automatisk, (2) at Timer-elementene vises i prosjekt-sidebar når modul er aktiv, og (3) at `settFirmamodul`-mutationen fungerer end-to-end (kall via DevTools eller test-script). Etter verifisering: grønt lys for Fase C (drop midlertidige flagg).

**Steg 1b Fase A+B+C DEPLOYET TIL PROD 2026-05-03** (`045a49b7` merge). Hele Steg 1b komplett. Sitedoc_admin kan nå velge et hvilket som helst kunde-firma i FirmaVelger og se/redigere det firmaets data på alle firma-admin-undersider. Eier-firma-rename live i prod. HTTP 200 verifisert. Innlogget verifisering anbefales for å bekrefte A.Markussen-kunde fortsatt fungerer.

**Steg 1b Fase C (firma-kontekst — innstramning + Eier-firma-rename) IMPLEMENTERT på develop 2026-05-03** — tredje og siste del av tre-fasers strategi. Etter denne fasen er fundamentet for global firma-kontekst komplett.

**Endringer:**
- **Server (9 router-filer):** `verifiserFirmaAdmin`-helper forenklet til thin wrapper rundt `autoriserAdminForFirma`. Fallback-grenen til `bruker.organizationId` droppet — orgId er nå PÅKREVD for alle write-mutationer. Filer: organisasjon, avdeling, kompetanse, kompetansetype (kun write-mutations), timer/{onboarding (kun aktiver*), lonnsart/aktivitet/tillegg (kun opprett/oppdater/deaktiver)}, maskin/import.
- **Read-only ruter beholder fallback:** `timer.{lonnsart,aktivitet,tillegg}.list`, `timer.onboarding.status`, `kompetansetype.hentAlle` har fortsatt `hentBrukerOrgId(userId, inputOrgId?)` — disse brukes fra prosjekt-baserte dagsseddel-sider hvor ansatte skal se sitt eget firmas katalog uten å eksplisitt bytte. Beslutningen er bevisst: ansatte (ikke firma-admin) trenger ikke firma-velger.
- **Klient (~30 callsites):** alle `organizationId: orgId` byttet til `organizationId: orgId!` — non-null assertion. Etablert mønster siden `firma/layout.tsx` gates på `valgtFirma` (ingen children rendres uten valgt firma).
- **Lag 3 — rename:** `oppsett.firmainnstillinger` i14n-nøkkel: nb «Firmainnstillinger» → «Eier-firma», en «Company settings» → «Owner company». H1-overskrift på `/dashbord/oppsett/firma` hardkodet rename til «Eier-firma». Foreldrekategorien «Prosjekteier» (linje 75-78 i `oppsett/layout.tsx`) eksisterte allerede — kun subelementets navn endret for å unngå navnkollisjon. Andre 12 språkfiler beholder eksisterende oversettelse (samme mønster som tidligere terminologi-renames per timer-attestering 2026-05-02).
- **Fix:** `oppsett/firma/page.tsx` `lagre()` får early-return ved `!organisasjon` (orgId må være string, ikke `string | undefined`). Fanget av tsc da fallback ble fjernet.

**Verifisering:**
- `pnpm --filter @sitedoc/api typecheck` grønt
- `pnpm build --filter @sitedoc/web` grønt (27.3s)

**Hva Fase C skiller seg fra Fase A/B:**
- Fase A: bakoverkompatibilitet — orgId valgfri, fallback til bruker
- Fase B: klient sender orgId aktivt
- **Fase C: orgId tvinges — sitedoc_admin må bytte firma eksplisitt for å jobbe i kundens kontekst**

**Klar for test-deploy.** Etter verifisering: prod-deploy lukker Steg 1b helt.

**Beslutning under arbeid:** Sub-elementet «Firmainnstillinger» renames til «Eier-firma» i stedet for «Prosjekteier» (Kenneths foreslag) for å unngå kollisjon med eksisterende parent-kategori «Prosjekteier». Klarere navn — beskriver firma-info knyttet til prosjektets eier.

**Steg 1b Fase B (firma-kontekst — klient-migrering) IMPLEMENTERT på develop 2026-05-03** — andre del av tre-fasers strategi. Bygger på Fase A-server-side-helper. Etter denne fasen kan sitedoc_admin velge et hvilket som helst firma i FirmaVelger og faktisk se det firmaets data på alle firma-admin-undersider.

**Endringer (~10 sider migrert):**
- `firma/page.tsx` (oversikt) — byttet fra `organisasjon.hentMin` til `organisasjon.hentMedId({ id: orgId })`. Tre andre queries (`hentProsjekter`, `hentBrukere`, `hentIntegrasjonerStatus`) sender `{ organizationId: orgId }`.
- `firma/avdelinger/page.tsx` — alle queries/mutations i hovedkomponent + `OpprettAvdelingDialog` + `RedigerAvdelingDialog` har `useFirma()` og sender orgId.
- `firma/brukere/page.tsx` — `hentBrukere` + 2 `endreRolle.mutate`-kall sender orgId.
- `firma/innstillinger/page.tsx` — byttet fra `hentMin` til `hentMedId`. `oppdater` invaliderer både `hentMedId`/`hentMin`/`hentTilgjengelige`. `KompetansePolicySeksjon`-underkomponent har egen `useFirma()`.
- `firma/kompetanse/page.tsx` — `MatriseFane` (hentMatrise + hentSetting), `KompetansetyperFane` (hentAlle + oppdater), `OpprettTypeDialog`, `RedigerTypeDialog`, `SlettTypeDialog`, `ImportFraFilDialog` (forhandsvisning + bekreft). AnsattKompetanse-CRUD (opprett/oppdater/slett) UENDRET — bruker `verifiserKompetanseSkriveTilgang` server-side som utleder orgId fra målbruker.
- `firma/prosjekter/page.tsx` — `hentProsjekter` sender orgId.
- `firma/timer/layout.tsx` — `onboarding.status` sender orgId.
- `firma/timer/onboarding/page.tsx` — `status`-query + 3 mutations (aktiverNivaa1/aktiverNivaa2/aktiverTomKatalog) sender orgId.
- `firma/timer/lonnsarter/page.tsx` — list-query + deaktiver/oppdater + Dialog (opprett/oppdater) sender orgId.
- `firma/timer/aktiviteter/page.tsx` — analog.
- `firma/timer/tillegg/page.tsx` — analog.
- `maskin/import/page.tsx` — `importerForhandsvisning` + `importerBekreft` sender orgId.

**Mønster:** `const { valgtFirma } = useFirma(); const orgId = valgtFirma?.id;` + `useQuery({ organizationId: orgId }, { enabled: !!orgId })` for queries og `mutate({ ...args, organizationId: orgId })` for mutations.

**Beskyttelse:** `firma/layout.tsx` returnerer allerede tom-state hvis `!valgtFirma` (etablert i tidligere commit). Undersider rendres derfor aldri uten valgt firma — `enabled: !!orgId` er en ekstra trygging.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (28.9s, 1 cached).

**Klar for test-deploy.** Stopper og rapporterer før Fase C per Kenneths instruks. Claude verifiserer at sitedoc_admin faktisk kan bytte firma og se annet firmas data.

**Steg 1b Fase A (firma-kontekst — server-helper + valgfri input) IMPLEMENTERT på develop 2026-05-03** — andre steg i prioritert byggerekkefølge fra [domene-arbeidsflyt.md](domene-arbeidsflyt.md). Tre-fasers strategi godkjent av Kenneth: A → B → C med stopp+verifisering mellom hver. Fase A er bakoverkompatibel — alle eksisterende klient-kall fungerer uendret.

**Endringer:**
- Ny `autoriserAdminForFirma(userId, organizationId)`-helper i `apps/api/src/trpc/tilgangskontroll.ts`. Logikk: sitedoc_admin → tilgang til alle firmaer (uavhengig av bruker.organizationId); company_admin med matchende organizationId → tilgang; ellers FORBIDDEN. Skiller seg fra eksisterende `verifiserOrganisasjonTilgang` ved å tillate sitedoc_admin uten matchende org og kreve admin-rolle (ikke bare medlemskap).
- Lokale `verifiserFirmaAdmin`-helpers i 9 router-filer refaktorert til å ta valgfri `inputOrgId`-param. Når gitt: deleger til `autoriserAdminForFirma`. Når ikke gitt: fallback til gammel logikk (`bruker.organizationId`).
- Tilsvarende `hentBrukerOrgId`-helpers (read-only ruter) i kompetansetype, timer/{onboarding,lonnsart,aktivitet,tillegg} fikk samme behandling.
- ~46 endepunkter på tvers av 9 router-filer fikk `organizationId: z.string().uuid().optional()` som input-felt:
  - `organisasjon.ts` (~12): hentMedId/hentProsjekter/hentBrukere/oppdater/leggTilProsjekt/fjernProsjekt/hentIntegrasjonerStatus/endreRolle/tildelOrgRolle/fjernOrgRolle/hentSetting/oppdaterSetting. Lokal `erSiteDocAdmin`-helper fjernet (ubrukt etter konsolidering av oppdater).
  - `avdeling.ts` (4): hentAlle/opprett/oppdater/slett.
  - `kompetanse.ts` (~3 firma-admin-endepunkter): hentMatrise/hentForBruker/importerForhandsvisning/importerBekreft. AnsattKompetanse-CRUD bruker fortsatt `verifiserKompetanseSkriveTilgang` (bruker-mot-bruker-RBAC, ikke firma-admin) — uendret.
  - `kompetansetype.ts` (~5): hentAlle/opprett/oppdater/slett.
  - `timer/onboarding.ts` (4): status/aktiverNivaa1/aktiverNivaa2/aktiverTomKatalog.
  - `timer/lonnsart.ts` (4), `timer/aktivitet.ts` (4), `timer/tillegg.ts` (4): list/opprett/oppdater/deaktiver.
  - `maskin/import.ts` (2): importerForhandsvisning/importerBekreft (via felles `filInputSchema.extend({...})`).
- Verifisering: `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (34s).

**Hva Fase A IKKE gjør:**
- Ingen klient-endring — Fase A er rent server-side bakoverkompatibilitet.
- `organizationId` er valgfri overalt — fallback fungerer som før.
- Sitedoc_admin har fortsatt ikke tilgang til andre firmas data uten at klienten begynner å sende `valgtFirma.id`. Det skjer i Fase B.

**Klar for test-deploy.** Stopper og rapporterer før Fase B per Kenneths instruks.

**Steg 1a (Organization.erKunde) DEPLOYET TIL PROD 2026-05-03** (`c91d953c` merge, `b69830e7` impl) — første steg i prioritert byggerekkefølge fra [domene-arbeidsflyt.md](domene-arbeidsflyt.md). Lukker Strategi C i «Organization vs OrganizationPartner — fundamentalt skille mangler». Ny `Organization.erKunde Boolean default false` + migrasjon `20260503000001_add_organization_er_kunde` med backfill. Heuristikk: `er_kunde=true` hvis `har_maskin_modul` OR `har_timer_modul` OR finnes `Project.primary_organization_id` OR finnes `Avdeling`. `organization_settings` og `users` droppet som signaler (auto-upsert ved første hentSetting-kall + testdata-misbruk: rolle-test-brukere lagt på alle skall-firmaer på test). Backfill-resultat (verifisert via psql etter deploy): test-DB Byggeleder=true + 4 skall=false (Byggherre/Tømrer Hansen/Elektrikker Hansen/Hovedentreprenør); prod-DB A.Markussen/HRP AS/Kenneths testmiljø=true + 0 skall. Server: `organisasjon.hentTilgjengelige` filtrerer på `erKunde:true` for sitedoc_admin (company_admin-grenen uendret). `hentMin` returnerer hele Organization (inkl. `erKunde`). Klient: `Firma`-type i `firma-kontekst.tsx` utvidet med `erKunde:boolean`. Test-verifisert som innlogget Tore SiteDocAdmin via Claude (FirmaVelger viser kun Byggeleder). **Merknad:** Auto-deploy-hook etter push til develop triggert ikke — manuell deploy ble kjørt. Bør undersøkes separat.

**Global firma-kontekst (FirmaVelger i Toppbar) DEPLOYET TIL TEST 2026-05-03** (`a2d45c02` + `9175ab84`) — kun `firma/layout.tsx` følger velgeren, undersider krever Lag 1+2+3 (se planlagte oppgaver).

**Status 2026-05-02:** **Fase 0 § E KOMPLETT i prod**. **Fase 0.5 KOMPLETT i prod**. **Timer-modul Fase 3 — Runde 1A + 1B + 1C DEPLOYET TIL PROD**. **Runde 2 (mobil + offline-sync) C1–C8 KOMPLETT på develop** (merge `1cce62f3` 2026-05-02 sent kveld). C5 visuelt verifisert på iOS Simulator + fysisk mobil etter første test-deploy. **Runde 2 + 2.5 / C9 deployet til prod 2026-05-02** (`de33aefc`). **Maskin terminologi-rename «pensjonert» → «utgaatt» DEPLOYET TIL PROD 2026-05-02** (`03d8c63a` — migrasjon `20260502120000_rename_pensjonert_til_utgaatt` applied på sitedoc + sitedoc_test). **Runde 2.6 mobil maskin-cache DEPLOYET TIL PROD 2026-05-02** (`03d8c63a`). **Runde 2.7 «Mine timer» + DagstotalBanner + UkeTotalBanner + web ukesoppsummering DEPLOYET TIL PROD 2026-05-02** (`05b3bddb`) — ny `/dashbord/timer/mine` (web, 5-perioder + 4 oppsummerings-kort + per aktivitet/status), ny `/timer/mine` (mobil, 3-perioder + 2 pills + aktivitet-aggregering), DagstotalBanner i mobil ny+detalj, web uke-totalsum, sidebar/Mer-tab-link. Ingen DB-migrasjon, ingen server-endring (gjenbruker `timer.dagsseddel.list`). Mobil får funksjonalitet ved neste EAS Build. Se [dagsseddel-design.md](dagsseddel-design.md) + [fase-0-beslutninger.md C.18](fase-0-beslutninger.md).

**Rolle-arkitektur-avklaring DEPLOYET TIL PROD 2026-05-02** (`6f6d3d68`) — `ProjectMember.kanAttestere Boolean` lagt til som kapabilitets-felt. Erstatter mye-omtalt `project_manager`-rolle som kun var i bruk i `dagsseddel.ts` (2 referanser, ingen rader i DB). Backfill: alle `role="admin"` får `kanAttestere=true` ved migrering — verifisert på test-DB (Per Prosjektadmin har `kanAttestere=true`, Ola Tømrer har `false`). CLAUDE.md rolletabell renset for `worker`/`field_user`/`project_manager` (fantasi-verdier som aldri eksisterte i kode/DB). Migrasjon `20260502160000_add_kan_attestere` applied på sitedoc + sitedoc_test. UI: sub-pill «✓ Attestering» under rolle-cellen i prosjekt-medlem-admin (`/dashbord/oppsett/brukere`) + ny `medlem.settKanAttestere`-mutation. Esc-fiks for redigeringsmodus inkludert. Lærdom: `prisma generate` MÅ kjøres FØR `migrate deploy` på server — `pnpm install --frozen-lockfile` regenererer ikke klient-typene.

**Timer-attestering rename DEPLOYET TIL PROD 2026-05-02** (`8aa792b2`) — terminologi-rens for å gjennomføre CLAUDE.md regelen «Attestering ≠ Godkjenning» (vedtatt 2026-04-26). Full sweep:
- **URL:** `/dashbord/[prosjektId]/timer/godkjenning` → `/timer/attestering`. Redirect-stub i gammel rute peker til ny via `redirect()` fra `next/navigation`. Lenker fra utsiden fungerer.
- **tRPC:** `kanGodkjenne` → `kanAttestere`, `hentTilGodkjenning` → `hentTilAttestering`. Gamle prosedyrer beholdes som `@deprecated` alias i 1 uke (fjernes etter 2026-05-09) per CLAUDE.md API-bakoverkompatibilitet-regel.
- **Sidebar/hooks/navigasjon-kontekst:** `id: "timer-godkjenning"` → `"timer-attestering"`, `nav.timerGodkjenning` → `nav.timerAttestering`, useAktivSeksjon-spesialfall, navigasjon-kontekst-type.
- **Mobil:** `sendTilGodkjenning()` → `sendTilAttestering()` + i18n-nøkkel `timer.sendTilGodkjenning` → `timer.sendTilAttestering`.
- **i18n:** 16 nøkler renamet i nb.json + en.json (`timer.godkjenning.*` → `timer.attestering.*`). Norske VERDIER oppdatert: «Godkjenning» → «Attestering», «Godkjenn timer» → «Attester timer», «Send til godkjenning» → «Send til attestering» m.fl. Engelske verdier beholdt («Approval»/«Approve» dekker begge konsepter på engelsk). Ny `status.tilAttestering` lagt til i alle 14 språk (samme verdi som `status.tilGodkjenning` for ikke-nb språk siden distinksjonen er norsk-spesifikk).
- **Verifisert:** `pnpm build --filter @sitedoc/web` grønt; `tsc --noEmit` grønt for api+web (kun pre-eksisterende vitest-typing). Mobile-tsc har bare pre-eksisterende feil ikke relatert til rename.

Status `status.tilGodkjenning` er bevisst beholdt — brukes for sjekkliste/oppgave-flyt og kontrollplan-status (intern aksept ≠ Godkjenning-dokumenttype). **Innlogget bruker-verifisering på test gjenstår** per CLAUDE.md regelen — curl HTTP 200 bekrefter kun server-svar, ikke at sidebar-element/URL-redirect/«Send til attestering»-knapp faktisk virker.

**Fase 0.5-fremdrift (revidert scope etter kode-verifisering 2026-05-01):**
- § 1 Avdeling-tabell + User.avdelingId ✅ (`a90daabd`) — `Avdeling`-modell i `packages/db`, `User.avdelingId String?` med SetNull, migrasjon `20260501000015_add_avdeling`
- § 2 Kompetansetype + AnsattKompetanse + RBAC ✅ — Kompetansetype + AnsattKompetanse-tabeller (per A.28), OrganizationSetting utvidet med `kompetanseRegistreringTilgang` (firma_admin | bruker_egen | alle, default firma_admin), 7-kategori-seed i `packages/shared/src/types/index.ts` (`KOMPETANSE_KATEGORIER` + `KOMPETANSE_REGISTRERING_TILGANG` + `KOMPETANSE_IMPORT_KILDER`), migrasjon `20260501000016_add_kompetanse`. `kompetanse.*` tRPC-rute + UI bygges senere (Fase 0.5 § 6 eller separat). Varsling-integrasjon (90/30/7 dager) bygges separat når varsling-modul er klar.
- § 3 ProjectGroupByggeplass m2m + drop building_ids ✅ — `ProjectGroupByggeplass`-tabell (m2m groupId × byggeplassId, Cascade på begge), drop `ProjectGroup.byggeplassIder` (verifisert dødt felt — kun skrevet i `gruppe.ts:495-503`, aldri lest), refaktor `gruppe.oppdaterByggeplasser`-mutation til `prisma.$transaction([deleteMany, createMany])` mot koblingstabell, semantikk: tom array = alle byggeplasser. Migrasjon `20260501000017_add_project_group_byggeplass`. Prinsipp C-verifisering ferdig (C1 vedtatt).
- § 4 Drop `ProjectGroup.byggeplassIder` ✅ — slått sammen med § 3 (samme migrasjon)
- § 5 Slette-policy for byggeplass ✅ — API: ny `byggeplass.hentSletteSammendrag` (returnerer telleresult per modell, splittet bevares/slettes per cascade-policy fra schema), oppdatert `byggeplass.slett` med `navnBekreftelse`-input (case-insensitive match per Kenneth) + `verifiserAdmin` (strammet fra `verifiserProsjektmedlem`) + TRPCError FORBIDDEN ved mismatch. UI: ny `SletteLokasjonDialog` i `apps/web/src/app/dashbord/oppsett/lokasjoner/page.tsx` (erstatter `confirm()`-prompt) — viser bevares/slettes-seksjoner, tekstinput med navn-bekreftelse, slett-knapp disabled til match. i18n: 17 nye nøkler (nb + en). Cascade-valg utsatt til senere — kun SetNull-default i første versjon. Ingen schema-endringer

**Fase 0.5 KOMPLETT** — deployet til prod 2026-05-01 (merge develop `9fed74a5` → main `f0a515cd`). 3 nye migrasjoner applied (`20260501000015_add_avdeling`, `20260501000016_add_kompetanse`, `20260501000017_add_project_group_byggeplass`).

**Etter-Fase-0.5-arbeid (på develop):**
- Avdeling-UI implementert: ny tRPC-router `avdeling.*` (hentAlle/opprett/oppdater/slett, alle gated med verifiserFirmaAdmin) i `apps/api/src/routes/avdeling.ts`. Slett blokkeres med CONFLICT hvis brukere er tilknyttet. Ny side `/dashbord/firma/avdelinger` med tabell (navn/kode/aktiv-toggle/antall brukere) + opprett/rediger-modaler. Menyelement i firma-layout. 16 nye i18n-nøkler (`firma.avdelinger.*`). Deployet til prod 2026-05-01 (`2799a4d1`).
- Kompetanse-UI Runde 1: ny tRPC-router `kompetansetype.*` (full CRUD, gated firma-admin) + `kompetanse.hentMatrise` + `kompetanse.hentForBruker` (read-only). Ny `organisasjon.hentSetting` + `organisasjon.oppdaterSetting` (upsert, dekker alle 5 OrganizationSetting-felter). Ny `kompetanseStatus()`-utils i shared (gyldig/varsel/utløpt med 90-dagers terskel). Ny side `/dashbord/firma/kompetanse` med to faner: Matrise (read-only, fargemarkering, filter på kategori/avdeling/ansatt-søk) + Kompetansetyper (full CRUD med modal-dialoger). Settings-toggle for `kompetanseRegistreringTilgang` (firma_admin/bruker_egen/alle) i innstillinger-siden. Menyelement «Kompetanse» (Award-ikon) i firma-layout. ~37 nye i18n-nøkler (`firma.kompetanse.*`). Deployet til prod 2026-05-01 (`0965ddf2`).
- Kompetanse-UI Runde 2.5 (develop): CSV/Excel-import. Ny dependency `csv-parse@6.2.1` i `apps/api`. To nye tRPC-mutations (`importerForhandsvisning` + `importerBekreft`) med SHA-256 filHash-validering for å garantere konsistens mellom forhåndsvisning og bekreft. Atomisk-policy ved ukjente ansattnumre (avviser hele importen). Auto-opprett av kompetansetyper (default på). Kolonne-aliaser + DD.MM.YYYY norsk dato + ISO-dato + Excel-dato-serial. ImportFraFilDialog i UI med 4-stegs flyt (opplastning → forhåndsvisning → bekreft → resultat). Hjelpefunksjoner i `apps/api/src/utils/kompetanseImport.ts` (parseCsvFil + parseXlsxFil + beregnFilHash). 30 nye i18n-nøkler (`firma.kompetanse.import.*`). Klar for test-deploy.
- Kompetanse-UI Runde 2: AnsattKompetanse-CRUD via celle-klikk i matrisen. Ny `verifiserKompetanseSkriveTilgang(ctxUserId, malUserId)` i `tilgangskontroll.ts` (Alt A — sitedoc_admin og company_admin bypasser policy; ikke-admin følger `kompetanseRegistreringTilgang`-policy med fallback til `firma_admin` hvis OrganizationSetting mangler). 3 nye mutations i `kompetanse.ts` (opprett/oppdater/slett). UI utvidet: celle-klikk åpner ny `AnsattKompetanseDialog` (read-only header med bruker+type, redigerbare felter for utstedt/utløp/utsteder/sertifikat-nr/notat, klient-validering for utløp<utstedt). Slett via sub-modal (per CLAUDE.md slett-bekreftelse-regel — ikke confirm()). Klikk-tilstand styrt av lokal `kanSkriveKompetanse()` som speiler server-RBAC (UI-bekvemmelighet, server er sannhetskilden). 18 nye i18n-nøkler (`firma.kompetanse.dialog.*`). Klar for test-deploy. **Runde 2.5 utsatt:** CSV/Excel-import (krever `csv-parse`-install).

**Verifiserings-funn 2026-05-01 (mot kode):**
- ❌ `ByggeplassMedlemskap` UTSATT TIL FASE 4 (Mannskap-modul) — eneste forbrukere er innsjekk/utsjekk/geofence/§15-liste, alle Fase 4
- ❌ `EquipmentAnsvarlig.avdelingId` strøket — tabellen finnes ikke i db-maskin (Equipment har direkte `ansvarligUserId`)
- ✅ Prinsipp B (ingen tvungen byggeplass) bekreftet matcher kode 1:1 (kun Kontrollplan krever byggeplass — modul-policy, ikke prosjekt-blokker)
- ✅ Prinsipp C (koblingstabell vs jsonb) bekreftet trygg — `building_ids` skrives i `gruppe.ts:495-503` men leses ALDRI noe sted

**Fase 0 § E (deployet til prod 2026-05-01):** Alle 13 § E-steg implementert (E.9 hoppet per § E). § E-fremdrift: E.1 Activity (`13a746a7`), E.2 OrganizationSetting (`4a155c28`), E.3 ProjectOrganization-rename (`1bff8672`), E.4 primaryOrganizationId (`137eed6f`), E.5 ProjectModule (`d9bfafc4`), E.6 OrganizationPartner (`22a772b6`), E.7 OrganizationTemplate (`7709ea32`), E.8 BibliotekMal + C.17 (`29311756`), E.10 ProjectMember.periodeSlutt (`5b8beef6`), E.11 ExternalCostObject (`9c9dd682`), E.12 Godkjenning (`0622fc35`), E.13 User-utvidelse + B.7 (`37d49872`), E.14 OrganizationRole. Timer/Maskin-revurdering utsatt til etter Fase 0.5-deploy.

**Anker for Fase 0-koding:**
- [fase-0-beslutninger.md](fase-0-beslutninger.md) — **PRIMÆR ANKER** (23 vedtatte + 0 åpne BLOKKERE + 12 anbefalte utvidelser + 13-stegs migrerings-rekkefølge + B.7-utvidelse for multi-identifikator-auth)
- [arkitektur.md](arkitektur.md), [terminologi.md](terminologi.md), [dokumentflyt.md](dokumentflyt.md) — verifiserte fundament-filer (drift mot kode rettet 2026-04-27)
- [smartdok-undersokelse.md](smartdok-undersokelse.md) — empirisk grunnlag fra A.Markussen (UI-research 2026-04-26)
- [arkitektur-syntese.md](arkitektur-syntese.md) — helhetlig produktarkitektur (loan-pattern, modul-arkitektur)
- [timer.md](timer.md) — krever refaktor (enterpriseId → organizationId, Underprosjekt-modell erstattet av ExternalCostObject). **Verifiseres i Timer-revurdering**
- [maskin.md](maskin.md) — krever justering for fase-0-beslutninger (særlig EquipmentAnsvarlig). **Verifiseres i Maskin-revurdering**

**Sentrale arkitektur-funn (oppdatert 2026-04-27 etter komplett verifisering):**
- `ProjectModule` eksisterer (linje 752 i schema, brukt 30+ steder) — utvides med `organizationId` + `status` (3-nivå per A.17), ikke ny tabell
- `Activity` (sentral audit-tabell) finnes ikke — bygges i Fase 0 som første steg
- `OrganizationProject` har eksisterende felter (`id`/`organizationId`/`projectId`/`createdAt` + relasjoner) — renames til `ProjectOrganization` og utvides med `rolle`-felt (NOT blank m:n)
- `date-fns-tz` er ikke installert — krevet for tidssone-håndtering (lukkes implisitt av B.6)
- Cache-invalidation-mønster er ad-hoc (30 kall, ingen sentral policy) — definres i Fase 0, fylles i Fase 3
- Underprosjekt = `ExternalCostObject` (UI-term «Underprosjekt», Prisma-modell `ExternalCostObject` per A.1)
- **Lønnsart-katalog er datadrevet, tre-nivå** (16 lovpålagte + 25 bransje-relevante + kundens egne) — detaljer i [timer.md](timer.md)
- **Avdeling-tabell** bygges i Fase 0.5 (sammen med Byggeplass), ikke Fase 0 (per C.11)
- **Seed-mekanisme** (event-hook `onOrganizationCreated`) etableres tomt i Fase 0; innhold registreres i Fase 3
- **B.7 — Org-bytte-mekanikk:** Modell A (én User per person×firma) vedtatt. `User` får composite `@@unique([email, organizationId])` + `@@unique([phone, organizationId])` (forberedende for fremtidig multi-identifikator-auth). `ProjectMember.userId` cascade endres `Cascade → SetNull`
- **B.6 — Timestamptz-håndtering:** Selektiv migrasjon (medium scope) — 11 felter får `@db.Timestamptz` (timer/audit/godkjenning/PsiSignatur/frist-felter/Invitation), resten av schema beholder `timestamp(3)`

**Maskin-modul (`feature/maskin-db`):** under bygging. **Midlertidig modul-gating implementert 2026-04-30** via `Organization.harMaskinModul`-flagg (default `false`). HovedSidebar skjuler maskin-ikonet for firma uten flagget; eksisterende firma-isolering i maskin-rutene (`verifiserOrganisasjonTilgang`) hindrer cross-tenant-lekkasje. Aktivering per firma: `UPDATE organizations SET har_maskin_modul = true WHERE id = '<id>';`. Erstattes av full `OrganizationModule` + `modulProcedure('maskin')`-gating i Fase 0 per A.4 — den midlertidige kolonnen droppes da.

**Maskin Blokk A + B implementert (2026-05-01) på `develop`:**
- **Blokk A (schema-reconciliation, `de3fb1d0`):** EquipmentAnsvarlig-tabell (m:n for tilleggsansvarlige per A.6 hybrid) + 15 nye Equipment-felt (5 felles: internNavn, eierskap, eksportKode, harSporingsenhet, aarsmodell + 10 materialiserte Vegvesen-kolonner). Migrasjon `20260501131546_blokk_a_schema_reconciliation` deployet til test 2026-05-01.
- **Blokk B (Vegvesen-integrasjon):** Service-lag i `apps/api/src/services/maskin/` (vegvesen-api, vegvesen, vegvesen-worker, moduleGate, equipment) per cross-modul-konvensjon (arkitektur-syntese § 6.1.1). 3 nye tRPC-endepunkter: `hentFraVegvesenForhandsvisning` (synkron mutation, 409 ved duplikat), `opprettMedVegvesen` (Variant A — klient sender bekreftet vegvesenData, server validerer kjennemerke-match), `oppdaterFraVegvesen` (admin-only, kø-basert). VegvesenKo-worker: 60s polling-løkke + 5min watchdog + 15min pause ved 429 + 5 retries. Klient-UI: Vegvesen-flyt aktivert i `nytt/page.tsx` med forhåndsvisning-panel + «fortsett uten Vegvesen-data»-fallback + eierskap-velger (eid/leid/leasing/lant) + årsmodell-felt + kallenavn. Felles `normaliserRegnummer()` i `packages/shared/src/utils/regnummer.ts` brukes i klient-input, Zod-validering og server-sammenligning. ~36 nye i18n-nøkler.
- **Blokk C1 (read-only detaljside + filter-bar + statusendring):** Filter-bar i listevisning med chip-buttons (kategori med count, status, ansvarlig-dropdown, fritekstsøk, vis-pensjonerte-toggle). Klikk på rad navigerer til ny detaljside `/dashbord/maskin/[id]`. Detaljside har 8 seksjoner read-only (generelt, anskaffelse, ansvarlig, kjøretøy-info, EU-kontroll med trafikklys-banner, anleggsmaskin-info, småutstyr-info, notater) + statusendring-modal med pensjonertGrunn-velger og advarsel + Vegvesen-oppdater-knapp (admin-only, polling 10s mot vegvesenKo.hentStatus). Nye API-endepunkter: `equipment.list` med sok-filter, `equipment.antallPerKategori`, `equipment.hentMuligeAnsvarlige`, `bruker.hentMin`. ~50 nye i18n-nøkler.
- **Blokk C2 (modal-redigering + ansvarlig-CRUD):** Detaljside utvidet med rediger-knapper på 5 seksjoner (Generelt, Anskaffelse, Kjøretøy-info, Anleggsmaskin-info, Småutstyr-info) som åpner én generisk `RedigerModal`-komponent. Ansvarlig-seksjonen erstattet med full CRUD: hovedansvarlig kan endres (UserPicker), tilleggsansvarlige listes med periode-start + (×)-fjern-knapp, (+)-knapp åpner LeggTilAnsvarlig-modal. Server-side: ny `verifiserMaskinAnsvarligSkriveTilgang(ctxUserId, equipmentId)` i tilgangskontroll.ts — sitedoc_admin/company_admin/primær-ansvarlig kan endre ansvarlig-felter (per A.6 hybrid). Ny `ansvarlig`-router (`maskin.ansvarlig.list/tilfoy/fjern`) med soft-delete (periodeSlutt = now), cross-org-blokkering, conflict-sjekk. `equipment.oppdater` utvidet med 30+ redigerbare felt (alle Generelt/Anskaffelse/manuelle Kjøretøy-info/Anleggsmaskin-info/Småutstyr-info). Vegvesen-felter overskrives av oppdaterFraVegvesen-flyten — ikke manuelt. ~18 nye i18n-nøkler. **Lukker forutsetning for SmartDok-import.**
- **Type-fix (`77d7bd67`, 2026-05-01):** Build feilet på test for C2 — `Input`-komponenten i RedigerModal returnerer `string | null` via onChange, men `RedigerInputs.type`-feltet er `string | undefined` (påkrevd-felt i `equipment.oppdater`-schema, kan ikke settes null). Lokal `tsc --noEmit` fanget ikke dette fordi local config er mindre strikt enn Next.js-build. Fix: erstattet `<Input v={inn.type}>` med inline `<input>` for type-feltet i Generelt-modalen. **Lærdom for fremtidige bugs:** Next.js-build kjører strengere tsc enn lokal — verifiser alltid med `pnpm build --filter @sitedoc/web` lokalt før test-deploy hvis nye felter med komplekse Optional-typer introduseres.

**Timer-modul Fase 3 STARTET 2026-05-01 (Infrastruktur-commit, på `feature/maskin-db`):**
- **packages/db-timer/-pakke opprettet:** 7 Runde-1-tabeller i postgres-schema `timer` (`lonnsarter`, `aktiviteter`, `tillegg`, `expense_categories`, `daily_sheets`, `sheet_timer`, `sheet_tillegg`). Egen Prisma-klient (`.prisma/timer-client`), cross-package-FK som svake String-felt (samme mønster som db-maskin). Init-migrasjon `20260501200000_init`.
- **Kjernen-utvidelse:** `Organization.harTimerModul Boolean default false` (midlertidig modul-flagg, samme mønster som `harMaskinModul`). `OrganizationSetting` utvidet med 4 felt: `dagsnorm Decimal default 7.5`, `overtidsmatTerskel Decimal default 9.0`, `tillattSelvAttestering Boolean default true`, `timerLockEtterDager Int? null` (Variant A — null = ingen alders-grense, status styrer låsing). Migrasjon `20260501200000_add_timer_modul_og_settings`.
- **Service-lag:** `apps/api/src/services/timer/moduleGate.ts` (`erTimerAktivert` + `krevTimerAktivert` + `TimerModulIkkeAktivertError`). `apps/api/src/services/seed/index.ts` (5 stub-funksjoner for Runde 1A: `seedLonnsartNivaa1/2`, `seedAktiviteter`, `seedTillegg`, `seedExpenseCategories` + samlet `seedTimerForOrganization`).
- **Workspace-deps:** `@sitedoc/db-timer` lagt til i `apps/api/package.json` + `apps/web/package.json`. Krever `pnpm install` før `prisma generate`.
- **Migrasjons-SQL skrevet manuelt** (ikke kjørt mot lokal-DB ennå). Kenneth kjører `pnpm install` + `pnpm --filter @sitedoc/db-timer exec prisma generate` + `pnpm --filter @sitedoc/db-timer exec prisma migrate deploy` + tilsvarende for `@sitedoc/db` mot test før prod.
- **Ikke i denne commit-en:** prototype-sletting (Runde 1B), modulProcedure i tRPC-base, dagsseddel-flyt, leder-attestering, mobil/offline, eksport-adaptere.

**Timer-modul Fase 3 — Runde 1A IMPLEMENTERT 2026-05-01 (`feature/timer-1a`):**
- **tRPC-router `timer.*`:** ny mappe `apps/api/src/routes/timer/` med `onboarding.ts` (status/aktiverNivaa1/aktiverNivaa2/aktiverTomKatalog), `lonnsart.ts` (list/opprett/oppdater/deaktiver), `aktivitet.ts` (analog), `tillegg.ts` (analog), `index.ts`. Registrert i `appRouter`. `prismaTimer` lagt i tRPC-context. RBAC: `verifiserFirmaAdmin` for skrive-mutations, alle ansatte i firma kan lese.
- **Seed-funksjoner med faktisk innhold:** `seedLonnsartNivaa1` (16: Fastlønn, Timelønn, Overtid 50%/100%, sykemelding/permittering/feriepenger osv. per AML/Folketrygdloven/Ferieloven). `seedLonnsartNivaa2` (25: Velferdspermisjon, Reise 7,5–15/15–30/30–45/45–60 km, Diett-pakke, Skifttillegg, Lærling-pakke, Innleid arbeidskraft, Fakturerbar tid m.fl.). `seedAktiviteter` (3: Anleggsarbeid, Maskintimer, Garanti/reklamasjon). `seedTillegg` (3: Overtidsmat, Smusstilleg, Beredskap-vakt). `seedExpenseCategories` (5: Drivstoff, Parkering, Diett, Verktøy, Annet). Alle idempotente — re-kjøring overskriver ikke.
- **Web-sider:** `/dashbord/firma/timer/{onboarding,lonnsarter,aktiviteter,tillegg}/page.tsx` + felles `layout.tsx` (sub-nav) + `page.tsx` (redirect). Onboarding-side har 3 scenarioer (Aktiver Nivå 1, Nivå 1+2, tom katalog). CRUD-tabeller med opprett/rediger-modal og deaktiver/reaktiver-toggle (soft-delete via Restrict-FK på SheetTimer/SheetTillegg/DailySheet). Sidebar-element «Timer» (Clock-ikon) i firma-layout, gates på `harTimerModul`.
- **i18n:** ~85 nye nøkler under `firma.timer.*` (nb+en) + 3 generiske (`ja`, `nei`, `handling.handlinger`).
- **Verifisert:** Lokal `pnpm build --filter @sitedoc/web` grønt — alle 5 timer-ruter kompilert. tRPC-typer eksponert via `appRouter`. Klar for test-deploy.

**Timer-modul Fase 3 — Runde 1B (dagsseddel-flyt) IMPLEMENTERT 2026-05-01 (`feature/timer-1b`):**
- **Slettet prototype:** `apps/web/src/app/dashbord/[prosjektId]/timer/page.tsx` (914 linjer hardkodet demodata) — erstattet av reell implementasjon.
- **tRPC-router `timer.dagsseddel.*`:** ny fil `apps/api/src/routes/timer/dagsseddel.ts` med 12 endepunkter: `list` (filter på projectId/userId/periode/status, kun egne sedler hvis ikke admin), `hentMedId` (full join inkl. timer-rader/tillegg-rader/aktivitet/prosjekt), `opprett` (idempotent via `clientUuid`), `oppdater` (header-felt), `tilfoy/oppdater/fjernTimerRad`, `tilfoy/oppdater/fjernTilleggRad`, `send` (draft → sent, krever ≥1 timer-rad), `slett` (kun draft).
- **Status-livssyklus enforcing:** `draft`/`returned` redigerbar, `sent`/`accepted` låst. `OrganizationSetting.timerLockEtterDager` sjekkes kun for `draft` (null = ingen alders-grense). Cross-org-blokkering via `verifiserProsjektmedlem` på opprett, eierskaps-sjekk via `hentEgenDagsseddel` på alle muteringer.
- **Web-sider under `/dashbord/[prosjektId]/timer/`:** `page.tsx` (liste-side med ISO-uke-velger, status-filter, status-badge), `ny/page.tsx` (opprett-skjema med dato/aktivitet/klokkeslett/pause/beskrivelse, default-aktivitet «Anleggsarbeid» hvis seedet, stabil clientUuid for idempotens), `[id]/page.tsx` (detaljside med 4 seksjoner: header-redigering, timer-rader-CRUD, tillegg-rader-CRUD, send/slett-handlinger). `status-badge.tsx` som delt komponent (Next.js page.tsx kan ikke ha named exports).
- **HovedSidebar Timer-gating:** Timer-element gates på `harTimerModul` (samme mønster som maskin). `kreverFirmaModul: "maskin" | "timer"` utvidet i `SidebarElement`-interface.
- **i18n:** ~50 nye nøkler under `timer.*` (nb+en) — felter, status-typer, kolonneoverskrifter, dialog-titler, feilmeldinger.
- **Verifisert:** `pnpm build --filter @sitedoc/web` grønt — 3 nye `/[prosjektId]/timer/*`-ruter + 5 fra Runde 1A. Type-fix: TS2589 «Type instantiation excessively deep» rettet ved å eksplisitt typee `onError: (e: { message: string })` på alle useMutation-callbacks i detaljsiden (per CLAUDE.md-regel — pre-eksisterende lærdom).
- **Deployet til prod 2026-05-01** (`c1122c2e`). Ingen nye DB-migrasjoner — kun kode.

**Timer-modul Fase 3 — Runde 1C (leder-attestering) IMPLEMENTERT 2026-05-01 (`feature/timer-1c`):**
- **tRPC-router-utvidelse:** 4 nye endepunkter i `dagsseddel.ts`: `hentTilGodkjenning({projectId})` (alle innsendte for prosjektet, beriket med ansatt-info), `kanGodkjenne({projectId})` (boolean — sidebar-gating), `returner({id, kommentar})` (sent → returned, krever ikke-tom kommentar), `attester({id})` (sent → accepted med pris-snapshot per rad og DailySheet.attestertAvUserId/attestertVed). Lokal helper `erProsjektLeder` + `krevProsjektLeder` — sjekker `ProjectMember.role ∈ {admin, project_manager}` eller `sitedoc_admin`/`company_admin` med matchende org.
- **Snapshot-pattern (Fase 0 A.7):** Ved attester kopieres katalog-data inn i `SheetTimer.attestertSnapshot` + `SheetTillegg.attestertSnapshot` JSON-felt: `{lonnsartId/tilleggId, kode, navn, type, prisMotKunde, internkostnad, sats, satsEnhet, attestertVed}`. Decimal-felt serialiseres som strings (toString()) for å bevare presisjon. Atomisk via `prismaTimer.$transaction([...])` — alle rader + status-overgang i én commit.
- **Web-side `/dashbord/[prosjektId]/timer/godkjenning/page.tsx`:** Leder-vy med tabell over innsendte sedler (dato/ansatt/aktivitet/totaltimer/rader-count). Tre actions per rad: åpne (chevron til detaljside), returner (RotateCcw-ikon, åpner kommentar-modal), attester (Check-ikon, direkte mutation). Returner-modal har påkrevd kommentar (min 1 tegn). `kanGodkjenne`-sjekk gir tydelig «ingen tilgang»-melding for ikke-ledere.
- **Detaljside-utvidelse (`[id]/page.tsx`):** To nye banner-seksjoner: returned-banner med leder-kommentar (amber, viser hva som må rettes), accepted-banner med attestert-tidspunkt (grønn). `lederKommentar`-feltet (allerede i schema) brukes som tilbakemeldingskanalen. Ansatt kan redigere returned-sedler og sende på nytt (samme send-mutation, status går returned → sent).
- **Sidebar-utvidelse:** Nytt seksjons-element «timer-godkjenning» (CheckCircle2-ikon) i `Seksjon`-typen + seksjonMap. HovedSidebar gates på `harTimerModul && kanGodkjenne` — usynlig for ikke-ledere. URL-mønster `/dashbord/[prosjektId]/timer/godkjenning` håndteres av useAktivSeksjon (spesialfall etter prosjektId-deler).
- **i18n:** ~17 nye nøkler under `timer.godkjenning.*` + `timer.detalj.{returnertTittel,returnertHjelp,attestertTittel}` + `nav.timerGodkjenning` (nb+en).
- **Verifisert:** `pnpm build --filter @sitedoc/web` grønt — ny ruten `/dashbord/[prosjektId]/timer/godkjenning` + alle eksisterende kompilert. tsc grønt for api+web (kun pre-eksisterende vitest-typing). Klar for test-deploy.

**Timer-modul Fase 3 — Runde 2 (mobil + offline-sync) C1–C5 IMPLEMENTERT 2026-05-01 (`feature/timer-2`, IKKE merget til develop):**
- **Godkjent scope:** kun timer-rader + tillegg-rader (ikke utlegg/maskin), kun ansatts egne sedler på mobil (leder-attestering kun på web), server-wins ved konflikt med tydelig banner.
- **C1 (`8a3c8a9a`) — Drizzle-skjema:** 6 nye SQLite-tabeller i `apps/mobile/src/db/schema.ts`: `dagsseddel_local` (id = clientUuid, sync-atom for hele sedlen), `sheet_timer_local`, `sheet_tillegg_local` (skrive-tabeller med syncStatus pending/synced/conflict) + `lonnsart_local`, `aktivitet_local`, `tillegg_local` (read-only katalog-cache). Idempotente CREATE TABLE IF NOT EXISTS i `migreringer.ts`. Decimal-felt fra Postgres serialiseres som tekst for presisjon, timestamps Unix ms.
- **C2 (`4c89e498`) — Server-side sync-endepunkter:** To nye i `apps/api/src/routes/timer/dagsseddel.ts`: `hentEndringerSiden` (query — pull alle sedler endret etter ISO timestamp, full pull begrenset til siste 90 dager, returnerer sedler med rader serialisert), `syncBatch` (mutation — Array<{clientUuid, ...rader}>, maks 100, per-seddel `prismaTimer.$transaction`, uavhengig resultat per seddel: `ok`/`conflict`/`feilet`, ingen rollback på tvers, klient kan ikke sette status=accepted, rader erstattes via deleteMany+createMany).
- **C3 (`e8f15f1e`) — Sync-motor:** Ny `apps/mobile/src/services/timerSync.ts` med `syncTimer(klient, userId)` som orkestrerer push (pending → server) + pull (siden → server), batches av 100 sedler. Ny `apps/mobile/src/providers/TimerSyncProvider.tsx` etter SpraakProvider — eksponerer `pendingAntall/conflictAntall/sistSynkronisert/syncerNa/sisteFeil` + `triggerSync()`. Auto-trigger ved login + nett-gjenkomst, 30s interval mens app er aktiv + online. Server-wins: conflict overskriver lokal med serverData.
- **C4 (`27598e7a`) — Katalog-cache:** Ny `apps/mobile/src/services/timerKatalog.ts` med `refreshKatalog(klient)` (full nedlasting fra `timer.{lonnsart,aktivitet,tillegg}.list`, atomisk overskriving per type) + synkrone lese-funksjoner (`hentLonnsarterLokalt`/`hentAktiviteterLokalt`/`hentTilleggLokalt`/`finnLonnsartLokalt`/etc.) for offline-trygge UI-velgere. Provider trigger katalog-refresh sammen med syncTimer ved login.
- **C5 (`d2a81fa7`) — UI-liste:** Ny `apps/mobile/app/timer/_layout.tsx` + `index.tsx` (liste over mine dagssedler les fra dagsseddel_local, sortert dato desc, pull-to-refresh, refocus-rerender, FAB → /timer/ny). Ny `TimerStatusMerkelapp.tsx` (status-badge utkast/sendt/returnert/attestert + sync-status-badge) + `TimerSyncStatusBar.tsx` (tynn statusbar: offline/syncerNa/pending/conflict/synced med farger + manuell trigger). Mer-tab utvidet med Timer-rad + badge for pending/conflict.
- **Pre-eksisterende kjent issue:** Mobil tsc har 9 pre-eksisterende feil (oppgave/sjekkliste/PSI/3D/hjem-tab) som ikke er knyttet til timer-2 — Metro bundler kjører uavhengig av tsc. Trpc-import-feil i rapportobjekter ble fikset på develop (`f062c5f2`) før timer-2 — fix vil komme inn naturlig ved senere develop-merge.
- **C5 visuelt verifisert 2026-05-02** på iOS Simulator + fysisk mobil etter test-deploy (`0342b883`). Liste-side viste eksisterende sedler synket fra prod-DB, sync-statusbar fungerer, Mer-tab Timer-rad navigerer korrekt.
- **C6 (`90c73991`) — Opprett-skjema + detaljside:** `apps/mobile/app/timer/ny.tsx` (DateTimePicker + prosjekt-velger via `trpc.prosjekt.hentMine` + aktivitet-velger fra lokal cache med default `Anleggsarbeid` + valgfri beskrivelse → `randomUUID()` clientUuid + insert til `dagsseddel_local` med `syncStatus=pending`). `apps/mobile/app/timer/[id].tsx` (header med dato/aktivitet/status-badge, status-banners for returned/accepted/conflict/pending, timer-rader-seksjon med +/rediger/slett, tillegg-rader-seksjon analog, send-til-attestering-knapp som krever ≥1 timer-rad, slett-knapp med `Alert.alert`-bekreftelse — kun draft). 4 modaler (TimerRadModal, TilleggRadModal, LonnsartVelgerModal, TilleggVelgerModal) inline i [id].tsx leser fra lokal cache med søk når > 7 elementer. Alle endringer markerer `syncStatus=pending` + `sistEndretLokalt` + trigger sync via `TimerSyncProvider`.
- **C7 — i18n + docs:** ~50 nye nøkler under `timer.*` i nb.json + en.json (sync.*, status.utkast/sendt/returnert/attestert, felt.*, tilfoy.*, rediger.*, ingenLonnsarter/Tillegg/TimerRader/TilleggRader, feil.*, bekreftSlett*, sendTilGodkjenning, slettDagsseddel m.fl.). Total: 155 timer-nøkler per språk. CLAUDE.md + STATUS.md + timer.md oppdatert med Runde 2-fremdrift.
- **C8 (`af91dff3`) — Underprosjekt-velger:** Ny `eksternKostObjekt`-router (server) med `list({ projectId? })` for aktive ECO-er filtert på `status="aktiv" + timerregistreringApen=true`. Ny `external_cost_object_local`-tabell + idempotent migrering. `timerKatalog.refreshKatalog` henter ECO-er via Promise.all med catch-fallback (ikke-kritisk hvis router mangler). UnderprosjektVelgerModal i TimerRadModal (filtrerer på prosjekt + søk når > 7). TimerRadVis viser ECO-etikett (proAdmId + kortNavn) under lønnsart. Fjern-X-knapp ved siden av valgt underprosjekt. ~3 nye i18n-nøkler.
- **Merge til develop:** `1cce62f3` 2026-05-02 sent kveld. Inkluderer også OppgaveModal-fix (`ff313e54` — `trpc.arbeidsforlop` → `dokumentflyt`).
- **Test-deploy + prod-deploy utsatt til neste sesjon.** Server-side krever fersk deploy for at C6–C8 skal fungere fra mobil (syncBatch + hentEndringerSiden + dev-login + eksternKostObjekt-router).

**DB-naming-opprydning — ferdig (parkert):**
- Faggruppe-rename gjennomført på test (2026-04-15/16) og prod (2026-04-16) via tre migreringer (`navnegjennomgang`, `enterprise_rename_dokumentflyt_part`, `faggruppe_rename`). Verifisert i [db-naming-audit-2026-04-25.md](db-naming-audit-2026-04-25.md)
- U.1 (`project_groups.building_ids` jsonb) utsatt til Fase 0.5 — drop koordineres med m2m-koblingstabell
- U.2 (FK-constraint-navn fortsatt på engelsk) parkert som lavt-prioritert kosmetikk — tas naturlig ved neste større migrering
- Lokal-DB er bevisst ikke vedlikeholdt; re-seedes fra test ved behov per § «Primærmiljø»

Status og detaljer: [db-opprydning.md](db-opprydning.md).

## Pauset arbeid

**Timer/Maskin-revurdering** er utsatt til etter Fase 0-fundament er ferdig. timer.md og maskin.md har drift mot fase-0-beslutninger og må justeres før Fase 3 (Timer-modul) og Fase 1-fullføring (Maskin-modul-gateway) — men Fase 0-fundamentet bygges nå uavhengig av denne revurderingen.

## Planlagte oppgaver

### Superadmin-oversikt over firma-moduler

Superadmin trenger oversikt over hvilke moduler det enkelte firma har aktivert — delvis for fakturering. Ikke del av A.Markussen-kundelisten. Egen feature-sesjon.

**HMS-tilgang for arbeidsgiver på andres prosjekter (juridisk gap, 2026-05-03):**
A.27 gir firma-HMS-ansvarlig innsyn i «firmaets prosjekter» men IKKE i prosjekter
der firmaets ansatte jobber som UE. Arbeidsmiljøloven § 2-1 krever at arbeidsgiver
har HMS-ansvar for egne ansatte uavhengig av arbeidsplass. Løses i HMS-tilgang-runde
(Fase 4 / Mannskap).

**Steg 4c — Godkjenning UI (parkert 2026-05-03):**
Utsatt til etter møte med A.Markussen og/eller ProAdm API-tilgang.
Forutsetninger som mangler:
- Avklart dokumentflyt-mal for endringsmeldinger (krever A.Markussen-input)
- ProAdm API-integrasjon (eller manuell oppsett av mal)
- Domeneavklaring: hvilke felter skal med, hvem godkjenner, hvilken flyt

Modellen (Godkjenning + DocumentTransfer) er implementert i Fase 0 § E.12.
Teknisk grunnlag er på plass — kun domene-avklaring mangler.

**NB:** Når Godkjenning-detaljside bygges (Steg 4c): inkludér «Hvem har ballen»-badge etter samme mønster som sjekkliste/oppgave-detalj (`e82e51c5`). Server: include `recipientGroup` i `godkjenning.hentMedId`. Klient: amber pill ved siden av `<StatusBadge />` i header. Bruker eksisterende i18n-nøkkel `tabell.venterPaa`.

**Header-koordinering: firma-bytte nullstiller ikke prosjekt-kontekst (observert 2026-05-03):**
Når sitedoc_admin bytter aktivt firma via FirmaVelger, beholdes det aktive prosjektet i
ProsjektVelger selv om prosjektet tilhører et annet firma. Prosjektlisten bør:
1. Filtreres på valgt firma (vise kun prosjekter der primaryOrganizationId = valgtFirma.id)
2. Nullstille aktivt prosjekt ved firma-bytte

Kompleksitet: Lav-middels (~2-3t). Ikke blokkerende for pågående arbeid.
Tas som egen oppgave etter Steg 4 er ferdig.

**Arkitektur-planlegging — samlet sesjon nødvendig (2026-05-03):**
Følgende moduler mangler forankring i vedtatt arkitekturplan ([terminologi.md § 0](terminologi.md) tre nivåer: Firma → Firmaadministrasjon → Prosjekter, samt [arkitektur-syntese.md](arkitektur-syntese.md) helhetlig produktarkitektur):
- Timer-modul: bygget uten global firma-kontekst på plass
- Maskin-register: bygget uten global firma-kontekst på plass
- Mannskap/kompetansematrise: ikke planlagt i firma-kontekst
- Organization vs OrganizationPartner: skillet mangler i datamodellen

Før videre koding på noen av disse: hold en dedikert planleggingssesjon med
frisk Opus-kontekst. Les [terminologi.md § 0](terminologi.md) + [arkitektur-syntese.md](arkitektur-syntese.md) som utgangspunkt.
Kartlegg alle koblinger mellom modulene og firma-konteksten.
Prioriter: Strategi A (modul-filter) → firma-kontekst full konvergens → maskin-import.

**Organization vs OrganizationPartner — fundamentalt skille mangler (observert 2026-05-03):** Test-DB inneholder Organization-rader som ikke er reelle kunder (Byggherre, Tømrer Hansen, Elektrikker Hansen, Hovedentreprenør). De ble opprettet som «skall-firmaer» for å representere parter i faggrupper/dokumentflyt. Datamodellen tillater dette uten advarsel — det finnes ingen `type`/`erKunde`-felt på Organization som skiller «firma som bruker SiteDoc» fra «firma som er part i et prosjekt».

**Riktig modell:** `OrganizationPartner` (linje 197-217 i schema.prisma) er det rette stedet for faggruppe-parter. Hvert kunde-firma har sitt eget partner-bibliotek (`OrganizationPartner.organizationId` peker til kunden). `Faggruppe.partnerId` (nullable FK) kobler en faggruppe til en partner-rad. Den eksisterer for nettopp dette formålet, men test-data har misbrukt Organization-tabellen i stedet.

**Heuristikk-signaler for «reelt firma» (i fravær av eksplisitt felt):** users.length > 0 + harMaskinModul/harTimerModul satt + OrganizationSetting eksisterer + primaryProjects.length > 0 + avdelinger/kompetansetyper finnes. Alle disse er null/0 for skall-firmaer.

**Konsekvenser:**
- Firma-velger i Toppbar (etter `9175ab84`) viser skall-firmaer som om de var administrerbare. Klikk på dem fører til tom firma-admin-side.
- Maskin-import er særlig sårbart: hvis sitedoc_admin velger et skall-firma og kjører import, opprettes Equipment-rader under et firma ingen administrerer = datakorruption.
- Prod-DB ser korrekt ut i dag (3 reelle firmaer), men datamodellen forhindrer ikke fremtidig misbruk.

**Mulige strategier (rangert):**
- **A. Filter på modul-flagg** (5 min) — pragmatisk for maskin/timer-velgere. `WHERE har_maskin_modul = true` filtrerer skall-firmaer effektivt for import-flyten.
- **B. Filter på users-count** (30 min) — fanger reelle firmaer mer generelt.
- **C. Nytt felt `Organization.erKunde Boolean`** (2-3t migrasjon + backfill) — eksplisitt skille, riktig langsiktig.
- **D. Migrer skall-firmaer til OrganizationPartner** (6-8t DB-cleanup) — rensker datakorrupsjon, krever audit per rad.

**Anbefalt rekkefølge:** ~~Strategi A umiddelbart for maskin-import-velgeren.~~ ✅ **Strategi C IMPLEMENTERT 2026-05-03** (`Organization.erKunde`-feltet — se «Pågående arbeid» øverst). Strategi A kan nå bygges på erKunde-feltet hvis behov. Strategi D som datakvalitets-prosjekt etter A.Markussen er stabilt.

**Firma-administrasjons-navigasjon — strukturell rydding (observert 2026-05-03):** Etter at global firma-kontekst (`9175ab84`) ble bygd, observerte vi at firma-velger i Toppbar kun virker på `firma/layout.tsx` — ikke på undersidene. Dypere analyse avdekket to ulike «firma»-konsepter i kodebasen:

1. **`/dashbord/oppsett/firma` («Prosjekteiers innstillinger»)** — viser firma som eier det aktive prosjektet via `ProjectOrganization`-tabellen. Per-prosjekt-bundet, henter via `organisasjon.hentForProsjekt(projectId)`. Viser tom-state «Ingen firma — Du er ikke tilknyttet noe firma» når prosjektet mangler `ProjectOrganization`-rad. Skal IKKE følge FirmaVelger.
2. **`/dashbord/firma/*` (firma-admin-seksjon, ~12 sider)** — globale firma-funksjoner: avdelinger, brukere, fakturering, innstillinger, kompetanse, prosjekter, timer-katalog. Skal følge FirmaVelger, men hver underside henter sin egen orgId via `verifiserFirmaAdmin(ctx.userId)` som leser `bruker.organizationId` direkte. Sitedoc_admin uten orgId vil fortsatt feile på undersidene.

**Tre lag som mangler for full konvergens:**
- **Lag 1 (server, ~4-6t):** ~10 ruter må ta `organizationId` som input og bruke ny `autoriserAdminForFirma(userId, orgId)`-helper. Mønster eksisterer i `maskin/import.ts:autoriserImportForFirma`.
- **Lag 2 (klient, ~3-4t):** ~10 sider må sende `useFirma().valgtFirma.id` som input til mutations/queries.
- **Lag 3 (rename, ~30 min):** «Firmainnstillinger» under prosjekt-sidebar er forvirrende navngitt — bør rename til «Prosjekteier» eller «Eier-firma» for å tydeliggjøre at det IKKE er firma-admin.

**Total estimat:** ~10-12 timer. Ikke-blokkerende for vanlig drift; sitedoc_admin (Kenneth) påvirket — ikke A.Markussen-kunder. Prioriter etter Maskin-import-leveransen.

**Onboarding-veileder (prioritert — forutsetning for A.Markussen):** Ny bruker vet ikke rekkefølge eller URL for oppsett etter prosjektopprettelse. Observert 2026-05-02: 4 404-feil ved forsøk på å finne faggruppe-oppsett via intuitive URL-er. Konkret rotårsak: to nesten-identiske faggruppe-sider eksisterer (`/dashbord/[prosjektId]/faggrupper` er **read-only**, mens `/dashbord/prosjekter/[id]/faggrupper` har **full CRUD**) — ingen visuell forskjell, ingen lenke fra read-only-siden til full versjon.

**Runde 1 (a)+(b) DEPLOYET TIL PROD 2026-05-02** (`6ed8b676`):
- ✅ (a) Lenke fra read-only faggrupper-side til CRUD: ny header-knapp «Administrer faggrupper» (Settings-ikon, øverst til høyre) + action-knapp i EmptyState. Begge peker til `/dashbord/prosjekter/${prosjektId}/faggrupper`.
- ✅ (b) Pencil-ikon (alltid synlig, text-gray-300) ved siden av brukernavn i `/dashbord/oppsett/brukere` — klikk på navn eller ikon åpner redigeringsmodus (samme oppførsel som før, men nå oppdagbart).

**SmartDok maskin-import dag 1 på develop 2026-05-03:**
- ✅ `apps/api/src/utils/maskinImport.ts` — parser for SmartDok Excel-eksport. 13 kolonner (Maskin, Internnummer, Reg.nr, Maskinkode, Årsmodell, Lokasjon, Sist endret, Maskinansvarlig 1, Maskinansvarlig 2, Timetall, Km.stand, Notat, Status). SHA-256 fil-hash. Filtrering: «x»-rader = testdata. 0XXX-placeholder → `internNummer=null`. Kategori-mapping verifisert mot A.Markussen 126-rad-fil:
  - Med gyldig regnr → kjøretøy (Vegvesen-oppslag bekrefter)
  - 7000-7599 (uten regnr) → kjøretøy (bilpark)
  - 7600-7699 (uten regnr) → anleggsmaskin (truck, hjullaster, dumper)
  - 7700-7999 (uten regnr) → småutstyr (redskap, GPS, hammer)
  - 9XXX → anleggsmaskin (eierskap=leid)
  - 0XXX-placeholder → utled fra 4-sifret prefiks i navn-feltet
- ✅ `apps/api/src/routes/maskin/import.ts` — to nye tRPC-mutations:
  - `importerForhandsvisning` — parse + matching-rapport (kategori-fordeling, ansvarlig-match mot User.name case-insensitive, duplikat-sjekk på internNummer per org, 25 første rader som forhåndsvisning)
  - `importerBekreft` — atomisk Prisma-transaction: Equipment + EquipmentAnsvarlig (kun rader med Maskinansvarlig 2) + VegvesenKo prio 200. Skip duplikater. Umatcha ansvarlig → `null` + advarsel (ikke blokker per Kenneth's beslutning).
- ✅ Verifisert mot ekte fil: 125 importerbare av 126 (1 testrad filtrert), 36 med regnr, 11 leid, 10 0XXX-null, 15 ansvarlige. Fordeling 37 kjøretøy / 50 anleggsmaskin / 38 småutstyr.
- ✅ Vegvesen-prio 200 = lavere enn 100 (auto) — worker plukker én om gangen via `ORDER BY prioritet ASC, opprettet ASC` i 60s-polling. Naturlig spredning over tid (ingen 429-risiko).
- ✅ Dag 2: klient-UI på develop. Standalone-side `/dashbord/maskin/import` med 4-stegs progress-indikator (Last opp → Forhåndsvis → Bekreft → Resultat). Forhåndsvisning viser kategori-fordeling (kjøretøy/anleggsmaskin/småutstyr), totalsum, antall med regnummer, antall leid, fargemerkede advarsler (valideringsfeil rød / filtrerte testdata grå / duplikater gul / umatcha ansvarlig amber / matcha ansvarlig grønn) + tabell med 25 første rader (radnummer, navn, internnr, regnr, kategori, eierskap, ansvarlig 1+2 med Check/X-ikon for match-status). Bekreft-steg viser sammendrag + advarsel om atomisk operasjon. Resultat-steg viser opprettet-antall, Vegvesen-kø-antall, hoppet-over-liste, umatcha-liste. «Importer fra SmartDok»-knapp lagt til på `/dashbord/maskin`-hovedsiden. 60 nye i18n-nøkler i nb+en (`firma.maskin.import.*` + `maskin.importerFraSmartDok`). Verifisert med `pnpm build --filter @sitedoc/web` 37.6s grønt (Next.js strenge tsc).
- ⏳ Dag 3: test-runde mot test-firma i test-DB FØR prod (per Kenneth's beslutning).

**Dag 3 fix 2026-05-03 — fil-interne duplikater:** Test-runde mot Byggeleder feilet ved bekreft-steg. Rotårsak: SmartDok-fila har internnummer `7084` på to rader (17 og 99). `importerBekreft` filtrerte bare DB-eksisterende internnumre, ikke fil-interne. Andre forekomst brakk `@@unique([organizationId, internNummer])` og rullet tilbake hele transaksjonen. Fix: filtrer begge kategorier FØR `$transaction` — første forekomst importeres, etterfølgende hoppes over med grunn «duplisert i fila». Forhåndsvisning returnerer nå `duplikaterDB` + `duplikaterFilInterne` separat i tillegg til total. Hoppet-over-rapport skiller mellom «finnes allerede i firmaet» og «duplisert i fila». Klar for ny test-runde.

**Runde 1 (c) progress-banner DEPLOYET TIL PROD 2026-05-02** (`098f7586`):
- ✅ Ny tRPC-query `prosjekt.hentOnboardingStatus({ projectId })` returnerer 4 booleans: harDokumentflyt, harBrukergruppe (kategori="brukergrupper"), harMalKobletTilFlyt (DokumentflytMal-rader), harLokasjon (Byggeplass-rader).
- ✅ Banner på prosjekt-dashbord (`/dashbord/[prosjektId]`) plasseres over prosjekt-header og under prøveperiode-banneret. Vises kun for admin (`role ∈ {admin, owner}`) og kun når minst ett steg gjenstår. Hvert steg er en pill med lenke til riktig oppsett-side: Dokumentflyt + Maler → `/dashbord/oppsett/produksjon/kontakter`, Brukergrupper → `/dashbord/oppsett/brukere`, Lokasjoner → `/dashbord/oppsett/lokasjoner`.
- ✅ 5 nye i18n-nøkler under `onboarding.*` i nb+en.
- ✅ Konsolidering av de to faggruppe-sidene IMPLEMENTERT på develop 2026-05-05. `/dashbord/[prosjektId]/faggrupper` har full CRUD (opprett/rediger/slett). Legacy `/dashbord/prosjekter/[id]/faggrupper` slettet, Faggrupper-fane fjernet fra `prosjekter/[id]/layout.tsx`, oversiktskort i `prosjekter/[id]/page.tsx` peker til ny rute.

Blokkerer selvstendig A.Markussen-onboarding. Ankret i [onboarding-veileder.md](onboarding-veileder.md).

**Testbrukere (planlagt — etter Timer er ferdig):** Opprett strukturerte testbrukere i test-DB for systematisk verifisering av tilgangsnivåer:
- **Ola Tømrer** — produksjon-rolle (`ProjectMember.role = "worker"` eller `"field_user"`)
- **Per Prosjektadmin** — `ProjectMember.role = "project_manager"`
- **Kari Firmaadmin** — `User.role = "company_admin"` med `organizationId` satt
- **Tore SiteDocAdmin** — `User.role = "sitedoc_admin"`

Formål: systematisk verifisering av at riktige funksjoner er tilgjengelig per rolle, og at utilgjengelige funksjoner er skjult/blokkert. Eksempel: Timer-attestering skal kun være synlig for Per/Kari/Tore (ikke Ola); Firma-administrasjon skal kun være tilgjengelig for Kari/Tore; Superadmin-flater kun for Tore. Dekker også verifisering av RBAC-helpers (`harProsjektTilgang`, `verifiserOrganisasjonTilgang`, `verifiserSiteDocAdmin`) og sidebar-gating.

### ~~«Hvem har ballen» — mangler synlig indikator (observert 2026-05-02)~~ — LØST 2026-05-05

Listene fikk badge før denne sesjonen (sjekkliste-listen + oppgave-listen viser «Venter på: [gruppenavn]» når status ∈ {sent, received, in_progress}). Dokument-detaljsidene fikk samme badge 2026-05-05 — server utvidet med `recipientGroup`-include på `sjekkliste.hentMedId` + `oppgave.hentMedId`, klient viser badge ved siden av `<StatusBadge />` i header.

### ~~Auto-redirect ved innlogging — mangler (observert 2026-05-02)~~ — LØST

Verifisert 2026-05-05 at logikken er fullt implementert i `apps/web/src/app/dashbord/page.tsx:41-65` (auto-redirect basert på antall prosjekter) + skriving av `lastVisitedProjectId` i `apps/web/src/app/dashbord/[prosjektId]/layout.tsx:26`. Alle scenarier dekket: 0 prosjekter (admin → kom-i-gang, ikke-admin → tom-state), 1 prosjekt → direkte, 2+ → sist besøkte hvis i tilgjengelig liste, 2+ uten sist-besøkt → bli stående med oversikt. Sannsynligvis lagt til samtidig som auto-progress-arbeidet før denne sesjonen — ikke en mangel lenger.

## Kjente bugs

**~~Lokasjon-modal forhåndsvelger ikke når kun ett alternativ finnes (observert 2026-05-02)~~ — LØST.** Verifisert 2026-05-05 at auto-select er implementert i `apps/web/src/components/LokasjonVelger.tsx:66-81` (to useEffect-hooks: én for bygning, én for tegning, begge sjekker `length === 1` og setter valgt verdi). Sannsynligvis lagt til etter den opprinnelige observasjonen. TegningsModal (skjermbilder, ikke samme flyt) auto-velger kun ved `standardTegningId` — bevisst design.

## Planlagte faser

Detaljert plan: [arkitektur-syntese.md §5](arkitektur-syntese.md). Beslutningsgrunnlag: [fase-0-beslutninger.md](fase-0-beslutninger.md).

**Fase 0 — Firma-fundament + tilgangsinfrastruktur:**
- Datamodell (13 migrasjons-steg per § E i fase-0-beslutninger): `Activity`, `OrganizationSetting`, `OrganizationPartner`, `OrganizationTemplate`, `ProjectOrganization` (rename av OrganizationProject + `rolle`), `Project.primaryOrganizationId String?` (nullable), `ProjectModule`-utvidelse (`organizationId` + `status` per A.4/A.17), `Psi.organizationId` + `projectId` nullable + `kontekstType`, `BibliotekMal`-utvidelse (kategori/domene/kobletTilModul/verifisert), `ProjectMember.periodeSlutt` + `userId` cascade SetNull (per B.7), `ExternalCostObject`, `Godkjenning` + `DocumentTransfer.kostnadSnapshot/godkjenningId`, `User`-utvidelse (canLogin, HMS-kort, ansattnummer, nasjonalitet, arbeidstillatelse + composite unique på email + phone per B.7)
- Selektiv Timestamptz på 11 felter per B.6 (timer/audit/godkjenning/PsiSignatur/frist-felter/Invitation)
- Infrastruktur: `prosjektProcedure`, `modulProcedure(slug)` i tRPC
- Refaktor: 9 funksjoner i `tilgangskontroll.ts` for ProjectMember-periode

**Fase 0.5 — Byggeplass + Avdeling-fundament:**
- Tre åpne arkitektur-prinsipper besluttes (NULL-betydning, default-byggeplass, FK vs jsonb) per [byggeplass-strategi.md](byggeplass-strategi.md)
- `ByggeplassMedlemskap` (loan-pattern: User → Byggeplass over tid)
- Drop `building_ids` jsonb fra `project_groups`
- `Avdeling`-tabell i `packages/db` (kjernen) — firma-intern organisatorisk inndeling, separat dimensjon fra byggeplass
- `User.avdelingId` valgfri (ny kolonne)
- Avklaring av seed-mekanismer som registreres her vs i Fase 3

**Fase 1 — Maskin med modul-gateway** (allerede under bygging på `feature/maskin-db` — gates før prod):
- Refaktor maskin-rutene til `modulProcedure('maskin')`
- `EquipmentChecklist` + `EquipmentChecklistTemplate` i `db-maskin`
- Manuell trigger fra maskinregister

**Fase 2 — Mal-promotering:**
- `OrganizationTemplate` + `ReportTemplate.organizationTemplateId`
- UI for «Send til firmabibliotek»

**Fase 3 — Timer-modul** (inkl. Kompetanseregister):
- Lønnsarter, arbeidstidskalender, dagsseddel med byggeplassId fra dag 1
- Underprosjekt (Proadm-import eller SiteDoc Godkjenning)

**Fase 4 — Mannskap/PSI-modul.**

**Fase 5 — Varelager-modul.**

**Fase 6 — Avansert:** DO-kobling, AI-ukeplan.

**Fase 7 — Prosjekthotell-utvidelser (parallelt spor):** Møtemal, Månedsrapport, HMS-statistikk firma-nivå, Street View, auto-trigger maskin-sjekkliste fra service-varsel.

**TODO etter Maskin (Fase 1) + Timer (Fase 3):** [Aktivitetsfeed på dashboard](aktivitetsfeed.md) — bruker eksisterende Activity-tabell, polling via tRPC, konfigurerbar periode (default 10 dager) + hendelsestyper + GDPR-retensjon i OrganizationSetting. Ekstern partner-feed-scope krever egen designrunde.

**Commits på `feature/maskin-db`** venter på merge til develop:
- `a4d7771` — Proadm-detaljer i timer.md
- `89e102c` — Proadm-regel i CLAUDE.md
- DB-opprydning-relaterte audit/doc-commits (2026-04-25)
- Arkitektur-dokumentasjon (2026-04-25/26)

