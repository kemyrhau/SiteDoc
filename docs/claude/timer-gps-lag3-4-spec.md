---
name: timer-gps-lag3-4-spec
description: Spesifikasjon for LAG 3 (bekreft dag — den menneskelige porten) og LAG 4 (flere byggeplasser pr. dag) i timer-GPS-helhetsplanen. Besøksmodell uten posisjonssporing, bekreft-dag-skjermen (2 klikk), reiseregler V1–V15 ved flere byggeplasser, løsning på G1-konflikten, leveransedeling og åpne spørsmål til Kenneth. Skrevet av fabel 2026-11-06 på orkestrators ordre (Kenneth «Ja, begge»), gates av orkestrator; Kenneth godkjenner før kode-ordre.
sist_verifisert_mot_kode: 2026-11-06
eier: fabel (kontroll-Claude) — orkestrator gater
status: 🟢 L3-A levert `feat/timer-bekreft-dag` (⚠️ venter Kontrollør-gate, ikke merget). 🟢 L3-D levert `feat/timer-bekreft-dag-maskin` (⚠️ venter Kontrollør-gate, ikke merget) — lesevisning av varer i `ProsjektGruppe` ⬜ ikke med (se § 3.5 Status L3-D). 🟢 VEDTATT 2026-11-06 (Kenneth «ja alle fire»: K11 a+c · K13 · K15 · K18 A · K19 nei (maskin pr. prosjekt, antall) · K20 ja (varer pr. prosjekt) · K21 a; K12/K14/K16/K17 tas ved gate som anbefalt). Tillegg samme dag: maskin/redskap + varer i bekreft-skjermen (§ 3.5, leveranse L3-D). ORDRE-tekst L3-A klar i § 10. Nye spørsmål K19–K21 (§ 9) gjelder L3-D, ikke L3-A.
---

# LAG 3 + LAG 4 — bekreft dag, og flere byggeplasser pr. dag

> **Kenneth 2026-11-06, ordrett:** *«Jeg trykker på start dag -> timeregistrering utledes som forslag basert på
> GPS. Dersom jeg var på flere innloggede byggeplasser, foreslå timer på de byggeplasser jeg var innom. Ta vare på
> alle regler som er laget vedrørende transport/kjøring til fra jobb -> reisetid!»*

Hjemmel: [timer-gps-helhetsplan.md](timer-gps-helhetsplan.md) § 3 (G1), § 4b (V1–V22), § 5 LAG 3/LAG 4, § 6 K3/K5.
Pauset ordre som denne erstatter: `relay/inbox-kontrollplan-bekreft-dagsforslag.md` (Kenneth valgte **B** egen skjerm
etter Slutt dag og **A** avbrudd → dagen forblir åpen; gate-kriterier 1–9 der er tatt med i § 8).

Skisser: [skisser-timer-gps-lag3/](skisser-timer-gps-lag3/) — `flyt.png` (Slutt dag → bekreft → sedel),
`skjermform-a-b.png` (segmentliste vs. tidslinje), `ankomst-s1-s2.png` (forslag ved app-åpning vs. manuell knapp),
`skjermform-a-maskin-varer.png` (form A med maskin/redskap og varer pr. segment, § 3.5).

---

## 0. Hva lagene er, og ikke er

- **LAG 3** er *porten*: ingen GPS-utledet rad blir dagsseddel-rad før arbeideren har sett den og trykket «Bekreft».
  Det er dette som gjør G1 (§ 3 i planen) sann i kode, ikke bare i tekst.
- **LAG 4** er *stedsdimensjonen*: dagen kan ha flere besøk, hvert besøk gir egen arbeidsrad med riktig prosjekt og
  byggeplass, og reisereglene gjelder pr. etappe.
- **Ikke** i disse lagene: bakgrunns-posisjonssporing (K3 avgjøres som «bekreftede stopp», § 2.4), km som målt
  størrelse (K4), sjåfør/tur-entitet (lag 5), forespørsel til leder på attestert dag (U-BEKREFT-R, egen migrering,
  etter lag 3-A), PSI-innsjekk som kilde (§ 2.5).

---

## 1. Målt utgangspunkt (2026-11-06, `develop` ≥ `71bc6258`)

| # | Funn | Hvor |
|---|---|---|
| M1 | «Slutt dag» = `Alert` (start + forløpt) → `utforSluttDag` → `beregnDagsforslag` → **`anvendDagsforslag` skriver rader straks**, deretter settes `arbeidsdag_local` avsluttet og det navigeres til `/timer/{id}`. Ingen skjerm viser forslaget før skriving | `StartSluttDagKort.tsx:92-256`, `:261-273` |
| M2 | Beregn/anvend er splittet (lag 0b): `beregnDagsforslag(input): Dagsforslag` er ren; `anvendDagsforslag(db, forslag, ctx)` skriver. Komponenten forutsetter alt `/timer/bekreft-dag` og sier at `samleDagsforslagInput` da flyttes til delt kilde — «ALDRI dupliser lesningen inn i skjermen» | `dagsforslag.ts:480`, `dagsforslagAnvend.ts:29-43`, `StartSluttDagKort.tsx:416-421`, `:423-637` |
| M3 | Den auto-opprettede sedelen er `status: "draft"`, `autoGenerert: true`; `[id].tsx` viser banner for draft+autoGenerert. Arbeideren må selv sende. **Porten i dag er altså «send», ikke «bekreft»** | `dagsseddelOpprett.ts:120`, `[id].tsx:1178-1195` |
| M4 | Input til beregn har **to posisjoner**: `dag.startLat/Lng` (Start dag) og `endLat/Lng` (Slutt dag). Ingen posisjon, ingen hendelse underveis | `BeregnDagsforslagInput` `dagsforslag.ts:280-313` |
| M5 | Hele økta er ett prosjekt og én byggeplass: `prosjektId = destinasjonProsjektId ?? aktivtProsjektId`, ellers `prosjektUkjent`. Arbeidsrader får `byggeplassId: null` (arver sedel), reiserader får destinasjonens | `dagsforslag.ts:497-513`, `:611-615`, `:813`, `:859` |
| M6 | V-regler i kode: V1 `:748`, V3 `:517`, V6 `:113/:757`, V7 `:175/:401`, V8 `:220/:826-831`, V10 `:330/:515`, V11 `:368/:399`, V12 `:384`, V13 `:328`, V15 `:366/:387`. **V4 (overtid kronologisk pr. dag) og V9 (mellometappe) finnes ikke** — overtid regnes pr. økt (`klassifiserArbeidstid` `:769-778`) | `dagsforslag.ts` |
| M7 | `arbeidsdag_local` (synkes aldri) har start/slutt-posisjon, oppmøtested, **én** byggeplass, ingen prosjektkolonne, ingen hendelsesliste | `schema.ts:398-422` |
| M8 | **Ingen posisjonssporing finnes:** 0 treff på `startGeofencingAsync` / `startLocationUpdatesAsync` / `TaskManager` / bakgrunnstillatelse; `expo-task-manager` er ikke installert; `watchPositionAsync` kun i live-view og lokasjoner (lagres ikke) | `apps/mobile` |
| M9 | Geofence-gjenkjenning er delt og ferdig: `gjenkjennSted` (polygon slår sirkel), `tilGeofencer`, `tolkStart/tolkSlutt/velgDestinasjon`. Mobil sender alltid `soner: []` (V17-C venter) | `packages/shared/src/utils/sted.ts:333-520`, `StartSluttDagKort.tsx:490-496` |
| M10 | `SheetTimer.reiseRetning` er `ut \| retur` med kommentar «lag 4 legger til "mellom"»; `tidKilde` `stempel \| utledet \| manuell`; `byggeplassId?` pr. rad finnes både i Prisma og `sheet_timer_local` | `packages/db-timer/prisma/schema.prisma:227-320`, `schema.ts:142-200` |
| M11 | `DailySheet` er én pr. `(userId, dato)` **uten projectId**; mobilens `dagsseddel_local.project_id` er `NOT NULL` (H14) | `schema.prisma:150-221`, `schema.ts:86-140` |
| M12 | Innsjekk (`PsiTilstedevarelse`) er online-only, uten lat/lng, uten kobling til timer. `mannskap.md:45` «aldri GPS-posisjon til person»; `:197` aldri auto-innsjekk uten bekreftelse; `:19` OS-geofencing krever juridisk sign-off | `packages/db/prisma/schema.prisma:2412-2453`, `mannskap.md` |
| M13 | `useGeoProsjektForslag` gjør alt det lag 4 trenger i forgrunnen: én måling → `gjenkjennSted` → `projectId`, stille null | `useGeoProsjektForslag.ts` (48 l) |
| M14 | V21 (overtidsforslag manuelt) og V22 (prosjekt·byggeplass på manuell rad) er vedtatt, ikke levert. V17-C (polygon på mobil) ikke levert | helhetsplan § 4b, `v17-geofence-spec.md:157` |

---

## 2. Modell for byggeplass-besøk gjennom dagen (LAG 4)

### 2.1 Prinsipp: bekreftede stopp, ikke sporing

Dagen er en **ordnet liste av besøk**. Et besøk oppstår bare ved en hendelse arbeideren ser: Start dag, et trykk på
«Ankommet …», eller Slutt dag. Telefonen måler posisjon **kun i forgrunnen, kun ved disse hendelsene og ved
app-åpning** (§ 2.3). Ingen bakgrunnstjeneste, ingen OS-geofence, ingen spor mellom hendelsene. Dette lukker **K3 for
lag 4** som «bekreftede stopp»; sporing forblir et lag 5-spørsmål som krever personvernvurderingen § 8 i planen nevner.

### 2.2 Lagring (mobil, lokal, synkes aldri)

Ny lokal tabell — mobil-migrering i `migreringer.ts`, **ingen server-migrering**:

```
arbeidsdag_besok_local
  id                 TEXT PRIMARY KEY
  arbeidsdag_id      TEXT NOT NULL      → arbeidsdag_local.id
  rekkefolge         INTEGER NOT NULL   1..n
  byggeplass_id      TEXT               null = «utenfor kjent byggeplass»
  byggeplass_navn    TEXT               snapshot for visning offline
  prosjekt_id        TEXT               byggeplassens prosjekt; rettes i bekreft-skjermen
  ankomst_at         TEXT NOT NULL      ISO
  avreise_at         TEXT               null til neste besøk/Slutt dag (§ 3.4)
  kilde              TEXT NOT NULL      'start_dag' | 'gps_forslag' | 'manuell' | 'slutt_dag'
  bekreftet          INTEGER NOT NULL   0 = forslag, 1 = arbeideren trykket
  sist_endret_lokalt TEXT NOT NULL
```

- **Ingen lat/lng i tabellen.** Posisjonen brukes i øyeblikket til `gjenkjennSted` og kastes. Start/slutt-posisjon
  ligger alt i `arbeidsdag_local` (eksisterende, kartlagt som gap i `gdpr-kartlegging.md` — se § 9 K16).
- Besøk 1 skrives av `startDag` (`kilde='start_dag'`, `byggeplass_id = arbeidsdag_local.byggeplass_id`). Slutt dag
  setter `avreise_at` på siste besøk; ingen eget «slutt»-besøk med mindre slutt-GPS treffer en *annen* byggeplass
  enn siste (da ett besøk `kilde='slutt_dag'`, ankomst = slutt − 0 min, og det flagges i skjermen).
- **Rydding:** rader slettes sammen med `arbeidsdag_local` når dagen er `avsluttet`/`forkastet` **og** eldre enn
  14 dager (glemt-dag-vinduet). `arbeidsdag_local` ryddes ikke i dag — rydding av begge legges i L4-A.
- Synk: aldri. Det som når serveren er `SheetTimer`-rader med `byggeplassId` og `tidKilde='stempel'` (K5-modellen,
  alt bygd i lag 2).

### 2.3 Ankomst-registrering: S1 forslag ved app-åpning + S2 manuell knapp (skisse `ankomst-s1-s2.png`)

| | S1 — forslag ved app-åpning | S2 — knapp i Start/Slutt-kortet |
|---|---|---|
| Utløser | `AppState` → `active` mens `arbeidsdag_local.status='paagaar'`, maks én måling pr. 10 min | Arbeideren trykker «Bytt byggeplass» i kortet |
| Måling | Én `getCurrentPositionAsync({accuracy: Balanced})` (som `fangGps`), forgrunnstillatelse allerede gitt | Samme måling; treff vises øverst i lista, ellers full liste |
| Treff ≠ siste besøk | Banner i Timer-fanen: «Du ser ut til å være ved **Fetsund bru** — Ankommet?» · **[Ankommet]** · [Nei] | — |
| Klikk | 1 | 2 (knapp + valg; 1 om GPS-treffet står øverst og velges) |
| Ikke treff / GPS av | Stille (som `useGeoProsjektForslag`). Ingen banner, ingen feil | Full liste over firmaets byggeplasser m/ punkt; søk |
| Skriver | `arbeidsdag_besok_local` `kilde='gps_forslag'`, `bekreftet=1` ved [Ankommet]; [Nei] skriver ingenting og demper samme byggeplass i 30 min | `kilde='manuell'`, `bekreftet=1` |

Begge finnes. S1 er hovedveien («ett klikk»), S2 er reserven når telefonen ikke åpnes eller GPS er av (V12-ånden:
manuell føring er hovedvei, ikke reserve). **Avvist: S3 bakgrunnssporing** — `mannskap.md:19/45`, batteri, og
ingen personvernvurdering finnes. Avvist: automatisk besøk uten trykk (`mannskap.md:197`).

### 2.4 Batteri og offline

- Null bakgrunnsforbruk. Målinger: Start dag, Slutt dag, app-åpning (≤ 1 pr. 10 min, kun når dagen pågår), knapp S2.
  Ingen `watchPositionAsync`.
- Alt lokalt: kataloger (`byggeplass_local`, `hentByggeplasserForFirmaLokalt`) er alt offline. Besøkslogg, beregn og
  bekreft fungerer uten nett; `anvend` skriver lokalt og `TimerSyncProvider` synker som før.
- Polygon-geofence (V17-C) mangler på mobil → S1 gjenkjenner kun sirkler til V17-C er levert. Ikke blokkerende.

### 2.5 Personvern og gjerder

- Det som lagres er *byggeplass + klokkeslett*, bekreftet av arbeideren selv — samme opplysning som arbeideren alt
  fører manuelt på en timerad. Ingen posisjon, ingen bevegelse mellom stopp.
- Grunnlag som for timer ellers (`mannskap.md:34/40`: GDPR art. 6(1)(c), ikke samtykke). Lokal besøkslogg er
  arbeiderens egen telefon; serveren får bare bekreftede rader.
- **PSI-innsjekk brukes ikke som kilde for besøk** og foreslår aldri timer (minne «Tilstedeværelse ≠ arbeidstid»;
  `mannskap.md:197`). Kenneths ordre 06.11 gjelder Start/Slutt dag-økta, ikke innsjekk. Bekreftes i K17.
- Kjent gjerde som lag 4 gjør mer synlig: `hentTilAttestering` viser timer-linjer på tvers av prosjekt for
  prosjektadmin når én sedel spenner flere prosjekter (minne «persondata-gjerder», meldt, ikke fikset). Lag 4 lager
  flere slike sedler → må lukkes **før** L4-C (§ 6).

---

## 3. Bekreft-dag-skjermen (LAG 3)

### 3.1 Flyt og klikktelling (skisse `flyt.png`)

```
[Slutt dag]  →  /timer/bekreft-dag  →  [Bekreft og lagre]  →  /timer/{id} (kladd, som i dag)
   klikk 1                                   klikk 2
```

- **Dagens `Alert` «Slutt dag?» fjernes** — skjermen *er* bekreftelsen. P4-tak: 2 klikk fra «Slutt dag» til rader
  finnes (ideal 1 er umulig uten å fjerne porten; porten er poenget).
- **Avbrudd** («Ikke nå», tilbake-sveip, app drept): ingenting skrives, `arbeidsdag_local` forblir `paagaar`, GPS-økta
  er ikke oppbrukt (Kenneth-valg A). Kortet viser fortsatt «Slutt dag»; nytt trykk åpner skjermen på nytt med fersk
  slutt-GPS.
- **Glemt dag** (`kappGlemtDagSlutt`-grenen `:278-301`): samme skjerm, slutt-tid forhåndsutfylt fra kappingen,
  merket «slutt anslått» (`sluttTidKilde='system'`). Ingen egen prompt lenger.
- **Sendt sedel** (`blokkertSendt`): skjermen viser forslaget i lesemodus med «Dagen er alt sendt — ingenting
  opprettes» og lenke til sedelen; dagen avsluttes uten rader. (U-BEKREFT-R kommer senere her.)
- **Tomt forslag** (0 rader, f.eks. < rundingsgrense): «Ingen timer å føre» · [Avslutt dag] · [Ikke nå]. Avslutt
  lukker økta uten sedel (K14).
- **`ikkeAnsatt` / `kildeManglet` / `prosjektUkjent`**: skjermen åpner likevel; prosjekt-feltet er tomt og rødt
  («Velg prosjekt»), Bekreft er deaktivert til valgt. `ikkeAnsatt` viser dagens melding (`dff9cfcd`) og kun [Avslutt
  dag uten timer]/[Ikke nå].

### 3.2 Innhold — hva er forhåndsutfylt (skisse `skjermform-a-b.png`, form A anbefalt)

Skjermen viser **ett kort pr. segment** i kronologisk rekkefølge, pr. dato (deles ved midnatt som i dag):

| Element | Kilde | Redigerbar? |
|---|---|---|
| Topplinje: dato · «Start 06:52 · Slutt 15:31 · 8,2 t» · norm-status (`normStatus`) | `Dagsforslag` | Nei (summen regnes om live) |
| Reise ut: «Reise · Kontor → Lillestrøm skole · 06:52–07:24 · 32 min · 28 km» + regel («over 30 min → reisetid») | reiserad (V3/V10/V11/V15, `reiseKilde='matrise'`) | Nei — utledes. Fjernes bare ved å endre start-sted (K12) |
| Arbeid pr. besøk: «**Lillestrøm skole** · 2041 · 07:24–11:30 · 4,0 t · Anleggsarbeid» | arbeidsrad pr. besøk, `tidKilde='stempel'` | **Ja:** prosjekt · byggeplass (velger), fra/til (klokke), aktivitet, fjern |
| Mellometappe: «Kjøring til Fetsund bru · 11:30–11:55 · 25 min · arbeidstid (V9)» | mellom-rad (§ 4.3) | Tidene følger naboradene; kan ikke slettes alene |
| Pause: «Pause 30 min trukket 11:30–12:00» | `pauseMin` + V6-vindu | Ja: pause-minutter (0–120) |
| Reise retur: «Reise · Fetsund bru → Kontor · 15:31–16:02 …» | V7, fra SISTE besøk | Nei — utledes |
| Årsak-linje når reise mangler: «Ingen reise foreslått: posisjon utilgjengelig» / «Fetsund bru mangler plassering» / «ingen matrisecelle» | V12/V13 `reiseAarsak`/`destinasjonAarsak` | Nei (lenke til hjelp) |
| Overtid: merke «OT 50 % fra 15:00» på raden som bærer | V4 (§ 4.4) | Nei — utledes |
| Seksjon «Maskin og varer» nederst: én linje pr. *prosjekt* med «+ Maskin · + Varer» (§ 3.5, K19/K20 pr. prosjekt) | Maskin-/Varelager-modul aktiv for firmaet | Ja: åpner velger-ark; registrerte linjer vises under prosjektlinjen med «✕». Hele seksjonen skjult når modul er av. **L3-D** |
| «+ Legg til stopp» nederst | — | Åpner samme velger som S2, setter inn besøk m/ tider (K13 ✅) |
| [Bekreft og lagre] · [Ikke nå] | — | — |

**Rettedybde = B** (orkestrators pause-begrunnelse: prosjekt pr. segment *er* kjernen i Kenneths modell). Lønnsart,
reiseklassifisering, overtid og norm redigeres **ikke** her — de er funksjoner av tidene og reglene og regnes om i
skjermen (`beregnDagsforslag` kjøres på nytt med rettet `besok`-liste; ren funksjon, ingen skriving). Ønsker
arbeideren å overstyre lønnsart, gjør han det på sedelen etterpå som i dag.

**Form A vs. B:** A = segmentliste (kort pr. segment, samme mønster som `DagskortSammenligning` men én kolonne) ·
B = vertikal tidslinje med klokkeslett i margen. **Anbefaling A:** redigering pr. kort er kjent mønster, tidslinje
krever drag-håndtering og bryter på små skjermer. B er penere for å *se* dagen, men dette er en *rette*-skjerm.
**✅ VEDTATT A (Kenneth 2026-11-06, K18).**

### 3.3 Arkitektur

- Rute `apps/mobile/app/timer/bekreft-dag.tsx` med parameter `arbeidsdagId`. Dataflyt nøyaktig som kommentaren
  `StartSluttDagKort.tsx:416-421` krever: `samleDagsforslagInput` flyttes til `src/services/dagsforslagInput.ts`
  (delt kilde), kortet kaller den ikke lenger selv.
- Skjermen: `input = samleDagsforslagInput(...)` → `forslag = beregnDagsforslag(input)` → vis → ved retting
  `beregnDagsforslag({...input, besok: rettet, pauseMin, ...})` → ved Bekreft `anvendDagsforslag(db, forslag, ctx)`
  → `avgjorSluttDagHandling` → avslutt `arbeidsdag_local` → naviger. Utfallene `:171-252` beholdes som i dag, bare
  flyttet bak Bekreft.
- **Én skjerm for to innganger (PREMISS):** samme rute med `arbeidsdagId` fraværende og `dato` satt = manuell
  inngang: segmenter fra `effektivPerDato` (standard start/slutt/pause), prosjekt fra kontekst, ingen reise (V11/V12
  årsak «ingen posisjon»). Leveres som L3-B etter V21/V22 (K15).
- i18n ×15 for all tekst; `nb.json` + `en.json` håndskrevet, resten generert `--only`.

### 3.4 Avreise og overlevering mellom besøk

Besøk n har `avreise_at = ankomst_at(n+1)` som standard (bare ankomst stemples). Da er mellometappen 0 min og
hele gapet ligger på besøk n. Arbeideren kan sette «Dro fra» på kortet; da oppstår mellom-raden (§ 4.3) fra «dro
fra» til neste ankomst. **Default når avreise er ukjent er K11 — ✅ VEDTATT (a)+(c) 2026-11-06:** hele gapet på
besøk n til «Dro fra» settes; S1 foreslår «Dro fra A?» når appen åpnes utenfor A.

### 3.5 Maskin/redskap og varer pr. prosjekt (Kenneth 2026-11-06; K19–K21 vedtatt 2026-11-06; skisse `skjermform-a-maskin-varer.png`)

> **Krav (Kenneth, ordrett):** *«husk å etterregistrere maskintimer/redskap og varer»* → **K19:** *«la maskintimer være
> mulig å velge pr prosjekt, med antall -> ikke fra/til»* · **K20:** *«la varer være en mulighet vi kan legge til pr
> prosjekt»* · **K21:** (a) som anbefalt.

**Plassering: pr. prosjekt, i en egen seksjon «Maskin og varer» nederst i skjermen** (over «+ Legg til stopp» og
Bekreft) — én linje pr. prosjekt i dagens forslag, uansett hvor mange byggeplass-segmenter prosjektet har. Ikke i
arbeidskortene (forrige utkast la dem pr. segment): maskin og varer er prosjektets, ikke stedets. Målt grunnlag:

- `SheetMachine.projectId` er NOT NULL (`packages/db-timer/prisma/schema.prisma:544`); `sheetTimerId` (`:541`) er
  **valgfri** svak FK — null-rader «beholder søsken-rad-oppførsel og redigeres inline via maskin-seksjonen»
  (kommentar `:535-540`). En maskinrad på prosjektnivå uten rad-kobling er et dokumentert tilfelle, ikke et unntak.
  `fraTid/tilTid` er nullable (`:547-548`) — «antall, ikke fra/til» krever ingen skjema-endring.
- `Vareforbruk` har `projectId` + `byggeplassId?` + `dagsseddelId?` (`packages/db-varelager/prisma/schema.prisma:74-84`);
  server-`opprett` (`apps/api/src/routes/vareforbruk.ts:370-394`) krever sedel med ≥ 1 timer-rad på samme prosjekt.
  Pr. prosjekt oppfyller kravet direkte: steg 1 skriver alltid minst én rad pr. prosjekt.
- Server-vakt `validerMaskinUnderArbeid` (`apps/api/src/routes/timer/dagsseddel.ts:1050`) → `beregnMaskinBrudd`
  (`packages/shared/src/utils/maskinKapasitet.ts:79`): Σ maskintimer ≤ Σ arbeidstimer + pause **pr. prosjekt(+ECO)**.
  Grupperingen er alt pr. prosjekt, så vedtaket passer vakten. **Mobil importerer ikke funksjonen i dag** (0 treff i
  `apps/mobile/src`); skjermen skal kjøre den lokalt før Bekreft — ellers avvises hele `syncBatch` server-side etter at
  dagen er avsluttet lokalt.
- Byggeplass på maskinrad utledes i dag server-side fra sedelhodet (`syncMaskinByggeplass`, `dagsseddel.ts:6301`:
  `vaskTell(lokal.byggeplassId, radProsjekt(m.projectId))`). Mobil sender ikke `byggeplassId` pr. maskinrad, og en
  pr.-prosjekt-rad trenger det ikke.

**Konsekvens for flere byggeplasser på samme prosjekt samme dag (lag 4):** én prosjektlinje og én maskinrad/vare
uansett antall besøk. Maskin og varer fordeles **ikke** pr. byggeplass fra skjermen; `byggeplassId` på vare settes bare
når prosjektet har nøyaktig én byggeplass i forslaget (entydig), ellers null, og maskinrad bærer aldri byggeplass fra
skjermen. Fordeling pr. byggeplass gjøres i så fall på sedelen etterpå (`MaskinSeksjon`, prosjektkortets vareliste).
Det er vedtakets pris, og den er riktig: GPS vet *hvor* arbeideren var, ikke hvor maskinen gikk. § 6-notatet om
`sheet_machine_local.byggeplassId` er dermed ikke lenger en forutsetning for denne skjermen.

**Klikktelling (P4-taket, maks 2 for vanlig dag):** seksjonen viser prosjektnavn + «+ Maskin · + Varer» pr. prosjekt.
Dag uten maskin/varer: ingen av knappene trykkes → **2 klikk uendret**. Med maskin: «+ Maskin» → velg i ark → antall +
Legg til → Bekreft = **5**. Med vare: «+ Varer» → vare → antall + Legg til → Bekreft = **5**. (Forrige utkast hadde
maskin = 4 fordi timer var forhåndsutfylt; K19 nei koster ett felt. Riktig: en maskintime arbeideren ikke har skrevet,
er et gjett.)

**Maskin/redskap:**

| Element | Kilde / regel | Redigerbar? |
|---|---|---|
| Prosjektlinje | ett prosjekt = én linje, nøkkel `projectId`; navn + prosjektnummer som i kortene | — |
| Velger-ark «Maskin · {prosjekt}» | `EquipmentVelgerModal` (`MaskinSeksjon.tsx:1003`, sortering `:1053-1065`) med gruppe **«Sist brukt»** øverst (ORDRE 29 A: `sistBrukteMaskiner` pr. ansatt, firma-isolert), deretter «Alle» + søk | Ja |
| **Antall timer** | **tomt felt, påkrevd, desimal-tastatur** — K19: ikke fra/til, ikke forhåndsutfylt. Lokal vakt: Σ maskintimer på prosjektet ≤ Σ arbeidstimer + pause (`beregnMaskinBrudd`), samme tekst som serverens brudd-melding; feltet rødt og «Legg til» blokkert ved brudd | Ja |
| Mengde · enhet | tomt, valgfritt — som «Maskin (valgfritt)» i `TimerRadModal` (`TimerSeksjon.tsx:1813-1893`) | Ja |
| Redskap | = `Equipment.kategori='smautstyr'` (`apps/mobile/src/db/schema.ts:458`; import `maskinImport.ts:86`), merket «redskap» i samme velger. **Ingen egen modell (K21 ✅ a)** | — |
| Flere maskiner pr. prosjekt | én linje pr. maskin under prosjektlinjen, «✕» pr. linje; samme maskin to ganger = to rader (som på sedelen) | Ja |

Ingen maskin legges inn automatisk: GPS vet *hvor*, ikke *hvilken* maskin. «Sist brukt» gjør valget til ett trykk uten
å skrive rader arbeideren ikke har bedt om (samme prinsipp som porten i § 5).

**Varer (K20 ✅ — «en mulighet vi kan legge til pr prosjekt»):**

| Element | Kilde / regel | Redigerbar? |
|---|---|---|
| Velger-ark | `KortVareforbrukModal` (`apps/mobile/src/components/timer-detalj/KortVareforbrukModal.tsx`) gjenbrukt: prosjekt låst til linjens; byggeplass-chip forhåndsvalgt når prosjektet har én byggeplass i forslaget, ellers tom/valgfri; varesøk mot lokal `vareLocal` (`schema.ts:934`, buffer fra `vareKatalog.ts`) | Ja |
| Antall · enhet | enhet fra varen; antall må fylles | Ja |

**Dataskriving — alt først ved «Bekreft og lagre»** (`anvendDagsforslag` utvides i L3-D; i dag har den 0 felt for
maskin/varer, `dagsforslagAnvend.ts:17-29`). Rekkefølge:

1. Timer-rader pr. segment (som L3-A).
2. Maskinrader → `sheet_machine_local` (`schema.ts:208`): `projectId` = linjens, **`sheetTimerId = null`**
   (prosjektnivå — dokumentert null-tilfelle; ved to segmenter på prosjektet finnes ingen riktig rad å peke på),
   `timer` = antall, `mengde/enhet`, `vehicleId`, `fraTid/tilTid = null`, `externalCostObjectId` = prosjektets
   timer-raders ECO når alle deler én, ellers null (T7-4a: maskin følger prosjekt+ECO-gruppe). Sync som i dag via
   `dagsseddel.syncBatch` (`timerSync.ts:651/758`; Zod `dagsseddel.ts:5867-5885`); byggeplass utledes på server.
3. Vareforbruk-rader → `vareforbrukLocal` (`schema.ts:951`): `sheetId` = lokal sedel-id, `projectId`, `byggeplassId`
   (entydig eller null), `syncStatus='pending'`. Synkes av eksisterende `syncVareforbruk` (`vareforbrukSync.ts:73`,
   kalt fra `TimerSyncProvider.tsx:192`) **etter** at sedelen er `synced` (`:48`) — server-kravet om timer-rad på
   samme prosjekt er oppfylt fordi steg 1 skrev den.

Avbrudd («Ikke nå», sveip, drept app) skriver ingenting — heller ikke maskin/varer som alt er lagt inn i skjermen (§ 3.1).

**Vakter (Maskin og Varelager er firmamoduler, `dagsseddel-design.md` § Modul-avhengigheter):**

- «+ Maskin» vises bare når firmaet har Maskin-modul aktiv og `equipmentLocal` har utstyr (samme vilkår som
  `MaskinSeksjon`). Server-vaktene `verifiserKjoretoyTilhørerFirma` + `validerMaskinUnderArbeid` er uendret.
- «+ Varer» vises bare når `visVareforbrukKnapp` er sann for linjens prosjekt
  (`packages/shared/src/utils/prosjektkort.ts:169`: `prosjektIderMedVarelager.includes(projectId)`). Katalogen er
  firma-isolert (`katalogForFirma`, `vareforbruk.ts:157`).
- Hele seksjonen skjules når ingen prosjektlinje har en synlig knapp.
- Offline: begge velgere leser lokale buffere. Er bufferen tom offline, vises «Utstyr/varer ikke lastet — legg til på
  sedelen senere» i linjen i stedet for knappen. Skjermen gjør ingen nettkall.

**Etterpå på sedelen — vedtak for dagskort-modus (K20, tatt i spec på orkestrators ordre):** maskin vises i
`MaskinSeksjon` under prosjektgruppen (`ProsjektGruppe.tsx:359`) i begge registreringsmoduser — rader med
`sheetTimerId = null` rendres inline der i dag. Varer vises i dag **bare i prosjektkort-modus**
(`apps/mobile/app/timer/[id]/kort/[projectId].tsx:336-371`; dagskort laster ikke `vareQuery`, `[id].tsx:631-633`).
**L3-D legger en lesevisning av prosjektets vareforbruk i `ProsjektGruppe` (dagskort)**, samme spørring som
prosjektkortet — en vare arbeideren nettopp bekreftet skal ikke være usynlig i halve brukermassen. Retting skjer via
prosjektkortet/web som i dag; ingen ny redigering i dagskort.

**Status L3-D (ORDRE 31, `feat/timer-bekreft-dag-maskin`, ⚠️ venter gate; vedtak A–E i orkestratorens OK 2026-11-06):**

- Seksjonen: `BekreftDagTilleggSeksjon` (`apps/mobile/src/components/timer-detalj/BekreftDagTilleggSeksjon.tsx`),
  nederst i ScrollView over hjelpeteksten og [Bekreft] (vedtak A). Én linje = dagens prosjekt (`forslag.prosjektId`);
  prosjekt-retting flytter tilleggene med, og varene mister byggeplassen (gjettes ikke på nytt).
- Synlighet: `tilleggSynlighet` (`apps/mobile/src/utils/bekreftDagTillegg.ts`) — «+ Maskin» når `equipment_local` har
  rader for firmaet, «+ Varer» når prosjektet er i `hentVarelagerProsjekterLokalt`. Begge mangler → seksjonen
  skjules helt, **uten** «ikke lastet»-teksten over (vedtak D; ingen «hentet»-markør).
- Maskin: `EquipmentVelgerModal` → antall-ark (timer påkrevd, valgfri mengde + enhet fra `ENHETER`), live vakt
  `maskinBruddForTillegg` med rød kant og stengt [Legg til]. Redskap (`kategori='smautstyr'`) merkes i lista.
- Varer: `KortVareforbrukModal` med ny valgfri `onVelgLinje` (`sheetId={null}`) — linjen holdes i minnet; uten
  propen lagrer modalen som før (`fullforVarelinje`, `vareforbrukSync.ts`; vedtak B). Byggeplass forhåndsvalgt
  bare når dagen har nøyaktig én (`entydigByggeplass`).
- Skriving: `bekreftDag(db, forslag, ctx, tillegg)` (`utils/bekreftDag.ts`) kjører vakten `vaktGrunnlag` +
  `maskinBruddForTillegg` **før** skriving; brudd gir `handling.type = "maskinBrudd"`, 0 skrivinger, dagen står
  `paagaar`, skjermen viser `timer.maskin.overstigerArbeid`. Grunnlaget = eksisterende draft/returned-sedels timer-
  og maskinrader + nye rader, pause = sedelens + nye raders (PK6). Deretter skriver `anvendDagsforslag(…, tillegg)`
  (`utils/dagsforslagAnvend.ts`, `skrivTillegg`) maskin og varer på **start-sedelen**; er den sendt (blokkert),
  skrives ingen av dem (vedtak C). ECO = null på maskinradene, som forslagets timer-rader.
- `TimerRadModal`-vakten er ikke med (vedtak E, egen ordre). Funn 1 (`userId` i `vareforbruk.opprett`) er urørt.
- ⬜ **Ikke med:** lesevisning av vareforbruk i `ProsjektGruppe` (dagskort, K20-avsnittet over) — sto ikke i den
  godkjente planen; meldt orkestrator. Til den finnes, er varer ført her synlige på prosjektkortet og web.
- Tester: `bekreftDagTillegg.test.ts` (§ 8 nr. 15–21 + vedtak B/C + dom 56 m1), `dagsforslag.retting.test.ts` (dom 56 m2).

**Personvern/isolering:** ingen nye persondata. Maskin- og varerader bærer prosjekt (og evt. byggeplass) og ansatt (via
sedelen) nøyaktig som i dag. `sistBrukteMaskiner` leser kun egne rader (ORDRE 29 A).

**Funn (løses ikke her, meldes Kontrollør):**

1. `vareforbruk.opprett` henter sedelens `userId` (`vareforbruk.ts:378`) men sammenligner den ikke med `ctx.userId` —
   en bruker i samme firma kan muligens registrere vareforbruk på en annens sedel. Måles i L3-D-gaten; fiks i API.
2. `beregnMaskinBrudd` ligger i shared, men ingen fil i `apps/mobile/src` importerer den: dagens `TimerRadModal` kan
   skrive maskin > arbeid lokalt og få hele synken avvist. L3-D bør bruke vakten i begge innganger (skjermen + modalen).

---

## 4. Reisereglene ved flere byggeplasser

Alle regler V1–V22 består. Det som endres er hva «første», «siste» og «mellom» peker på.

### 4.1 Første etappe ut (V3, V10, V11, V13, V15) — uendret form

Origo = start-GPS tolket med `tolkStart` (oppmøtested vinner, V15; «på kontoret» K2). Destinasjon = **første besøk
med byggeplass** (ikke lenger `velgDestinasjon` fra slutt-GPS). Terskel pr. etappe (V10), matrisecelle
oppmøtested × byggeplass (V13, ingen fallback), årsak ved mangel (V12/V13). Starter dagen på en byggeplass (V11):
ingen ut-etappe. `destinasjonProsjektId` utgår som begrep — prosjekt kommer fra besøkene.

### 4.2 Retur (V7) — «siste» = siste besøk

Retur-etappe foreslås kun når `tolkSlutt` treffer oppmøtested, fra **siste besøks byggeplass** × oppmøtested.
Dette er alt V7-ordlyden («retur fra kontor × SISTE byggeplass»); lag 4 gjør «siste» til en faktisk liste-slutt.

### 4.3 Mellometappe (V9) — ny radtype, ingen ny matriseakse

For hvert par (besøk n, besøk n+1) med ulik byggeplass og `avreise_at(n) < ankomst_at(n+1)`:

```
SheetTimer-rad
  projectId     = besøk n+1 sitt prosjekt       (bæres av den man kommer til)
  byggeplassId  = besøk n+1 sin byggeplass
  fraTid/tilTid = avreise(n) → ankomst(n+1)     klokketid, V9
  erReise       = false                         arbeidstid: teller i norm og overtid (V1 gjelder ikke)
  reiseRetning  = 'mellom'                      sporbarhet (lag 2 / K5)
  reiseKilde    = 'manuell'                     ingen matrise — tidene er stempler
  reiseRegel    = { regel: 'V9', fraByggeplassId, tilByggeplassId }
  tidKilde      = 'stempel'
  lonnsartId    = ordinær arbeids-lønnsart (ikke reiseLonnsartId)
```

Samme byggeplass to ganger på rad (A → A) slås sammen til ett besøk. Besøk uten byggeplass («utenfor») gir
arbeidsrad på forrige prosjekt med merke «sted ukjent» og rødt prosjekt-felt om intet prosjekt er kjent.
Server: `validerReiseInvarianter` må tillate `erReise=false ∧ reiseRetning='mellom'` og avvise
`erReise=true ∧ reiseRetning='mellom'`; `arvReiseSpor`/`beregnReiseAvvik` hopper over mellom-rader (ingen
matrisecelle å avvike fra). Zod på `syncBatch`: `reiseRetning` får `'mellom'`.

### 4.4 Overtid (V4) og norm (V5, V6) på tvers av besøk

- `klassifiserArbeidstid` kjøres **pr. dato over alle arbeids- og mellom-rader sortert på `fraTid`**, ikke pr.
  økt. Terskelen krysses i klokketid; raden som eier klokkeslettet splittes, og delen etter terskelen får
  overtids-lønnsart. Siste prosjekt bærer overtiden (V4). Reiserader (`erReise=true`) holdes utenfor (V1).
- Norm følger første ankomst (V5): `normSnapshot` tas på besøk 1, uendret.
- Pause (V6, V20): vinduet regnes fra `pauseReferanse` som i dag; `carveArbeidstider` kjøres på **den raden som
  inneholder vinduets start**; går vinduet over en radgrense, trekkes resten fra neste rad. Mellom-rader trekkes
  aldri pause.
- Kapping `MAKS_ENKELTSKIFT_TIMER=16` og `splittVedMidnatt` gjelder dagen samlet, besøk som krysser midnatt deles
  som sedelen deles.

### 4.5 Tidskilde (V8)

Rader avgrenset av stempler (Start dag, Ankommet, Dro fra, Slutt dag) får `tidKilde='stempel'`. Første ut-etappe og
retur beholder `utledet` (matrise ± GPS) som i dag. Rettes et klokkeslett i skjermen → `manuell`.

### 4.6 Fasit (utvider Dag A/B i planen)

**Dag C — to byggeplasser, kontor-start, firma med terskel 30 min:**
Start 06:52 kontor · matrise kontor→Lillestrøm 32 min · Ankommet Lillestrøm 07:24 · Ankommet Fetsund 12:10
(uten «Dro fra») · Slutt 15:31 på kontoret · matrise Fetsund→kontor 31 min · pause 30 min, referanse start+4 t.

| Rad | Prosjekt | Tid | erReise | reiseRetning | tidKilde | Lønn |
|---|---|---|---|---|---|---|
| Reise ut | 2041 Lillestrøm | 06:52–07:24 | ja | ut | utledet | reisetid (32 > 30, V10) |
| Arbeid | 2041 Lillestrøm | 07:24–12:10, pause 30 (10:52–11:22, V6) | nei | — | stempel | 4,27 t |
| Arbeid | 2057 Fetsund | 12:10–15:00 | nei | — | stempel | 2,83 t |
| Arbeid OT | 2057 Fetsund | 15:00–15:31 | nei | — | stempel | 0,52 t OT 50 % (V4: siste bærer, norm 7,5 nådd 15:00 etter pause) |
| Reise retur | 2057 Fetsund | 15:31–16:02 | ja | retur | utledet | reisetid (31 > 30) |

Setter arbeideren «Dro fra Lillestrøm 11:40», kommer rad «Mellom · 2057 · 11:40–12:10 · stempel · arbeidstid»,
Lillestrøm-raden slutter 11:40, og overtidsgrensen flytter seg ikke (samme sum arbeidstid).

---

## 5. G1-konflikten — løsning

**Spørsmålet:** `anvendDagsforslag` skriver i dag GPS-utledet prosjekt og reise ved «Slutt dag» uten at noen
bekreftet, mens `useArbeidsdag.ts:71,141` sier «GPS aldri lønnsgrunnlag» og vedtaket sier «tilstedeværelse ≠
arbeidstid». Brudd?

**Svar: ja i form, nei i virkning — og det lukkes av lag 3-A.**

1. G1 (plan § 3) krever at *bekreftelsessteget* finnes før GPS får velge prosjekt. Det finnes ikke (M1). Koden
   skriver rader på grunnlag av posisjon uten menneskelig port → **dette er det bruddet lag 3 skulle hindre.**
2. Virkningen er dempet fordi raden blir `draft` + `autoGenerert` med banner (M3), og arbeideren må selv sende. Porten
   er altså flyttet til «send». Det er en svakere port enn vedtaket (ingen viser forslaget *som forslag* med årsaker
   og retting), men ingen lønn er utbetalt uten en menneskelig handling. **Ingen tilbakerulling i prod er nødvendig;
   ingen pålagt stans av Start/Slutt dag.**
3. **Løsning:** `anvend` flyttes bak «Bekreft» (§ 3.3). Fra L3-A er dagens oppførsel borte. I samme leveranse
   reverseres de tre kodekommentarene (`useArbeidsdag.ts:67-77`, `:150-153`, `dagsforslag.ts` topptekst) til:
   *«GPS gir FORSLAG til sted, prosjekt og reise. Forslaget blir lønnsgrunnlag først når arbeideren bekrefter i
   `/timer/bekreft-dag` (helhetsplan § 3 G1, Kenneth 2026-11-06). Arbeider-valget i skjermen er autoritativt.»*
4. **Vedtaket «tilstedeværelse ≠ arbeidstid» står uendret:** det gjelder innsjekk/PSI/geofence-tilstedeværelse. Start
   dag er en *villet* handling («Jeg trykker på start dag»), og hvert besøk er bekreftet med et trykk (§ 2.1). GPS
   forteller *hvor* — arbeideren forteller *at* det var arbeid.
5. Ført som **H26** i planen § 4: «anvend uten port» — lukkes av L3-A.

---

## 6. Leveranser, rekkefølge og modul-avhengighet

| # | Leveranse | Lag | Berører | Migrering | Avhenger av |
|---|---|---|---|---|---|
| **L3-A** | Skjermen `/timer/bekreft-dag` (form A ✅), `anvend` bak Bekreft, delt `samleDagsforslagInput`, avbrudd = åpen dag, grenene glemt/sendt/tomt/ukjent, V12/V13-årsaker, rettedybde B *for én byggeplass* (prosjekt/tid/pause/fjern), tre kodekommentarer reversert, i18n ×15, tester § 8 nr. 1–8. **ORDRE-tekst: § 10** | 3 | mobil | ingen | — (✅ K15: bestilles nå) |
| **L3-D** | Maskin/redskap og varer i bekreft-skjermen (§ 3.5): seksjon «Maskin og varer» pr. prosjekt (antall timer, ikke fra/til), `EquipmentVelgerModal` m/ «Sist brukt», `KortVareforbrukModal` m/ låst prosjekt, lokal `beregnMaskinBrudd`-vakt, `anvendDagsforslag` skriver maskin- (`sheetTimerId = null`) og vareforbruk-rader bak Bekreft, vakter Maskin/Varelager, offline-buffer, lesevisning av varer i `ProsjektGruppe` (K20), tester § 8 nr. 15–21 | 3 | mobil (+ shared-import, i18n; `ProsjektGruppe`) | ingen | L3-A merget + ORDRE 29 Leveranse A (`sistBrukteMaskiner`) merget; K19–K21 ✅ vedtatt 2026-11-06. 🟢 Levert `feat/timer-bekreft-dag-maskin` (⚠️ venter gate) uten `ProsjektGruppe`-lesevisningen (§ 3.5 Status L3-D) |
| **L4-A** | `arbeidsdag_besok_local` + mobil-migrering, besøk 1 fra Start dag, S1-banner (AppState + 10-min-vakt) og S2-knapp, rydding av `arbeidsdag_local`+besøk > 14 d | 4 | mobil | mobil (SQLite) | L3-A (ellers havner nye besøk i en skjerm som ikke finnes) |
| **L4-B** | `beregnDagsforslag` m/ `besok[]`: rad pr. besøk, V9 mellom-rad, V4 pr. dag, V5/V6 på tvers, V7 fra siste, V8 stempel; `dagsseddel_local.project_id` nullable (H14); skjermen viser flere kort + «Dro fra» + «+ Legg til stopp»; fasit Dag C som test | 4 | mobil + shared | mobil | L4-A, K11/K13 |
| **L4-C** | Server: `reiseRetning='mellom'` i Zod/invarianter, `arvReiseSpor`/`beregnReiseAvvik` hopper mellom-rader, attestering/eksport viser byggeplass pr. rad; **persondata-gjerdet `hentTilAttestering` lukkes her** | 4 | api + db-timer | evt. CHECK på `reiseRetning` (Kontrollør måler) | kan gå parallelt med L4-B; må merges FØR L4-B (mobil sender ellers rader serveren avviser) |
| **L3-B** | Manuell inngang gjennom samme skjerm (PREMISS), `dato` uten `arbeidsdagId` | 3 | mobil | ingen | V21 + V22 levert |
| L3-C | U-BEKREFT-R (forespørsel til leder på attestert dag) | 3 | api + mobil | **ja** (db-timer) | L3-A; egen ordre senere |

**Rekkefølge:** L3-A → L3-D → L4-A → L4-C ∥ L4-B (L4-C merges først) → L3-B. Hver leveranse én gate. L3-D kan
starte så snart L3-A og ORDRE 29 A begge er på `develop`; den rører ikke besøksmodellen, så L4-A kan gå parallelt
i egen branch hvis kapasitet finnes (ulike filer: L3-D = skjermen + `dagsforslagAnvend.ts`; L4-A = `arbeidsdag_besok_local`
+ `StartSluttDagKort`).

**Modul-avhengighetssjekk (`dagsseddel-design.md` § Modul-avhengigheter):**
- `daily_sheets`: **uendret** — fortsatt én sedel pr. `(userId, dato)`, ingen projectId (M11). Kun mobilens lokale
  `dagsseddel_local.project_id` blir nullable (H14); server-sedel har aldri hatt den.
- `sheet_machines` (Maskin) og `Vareforbruk` (Varelager): **berørt av L3-D, men uten skjema-endring** — skjermen skriver
  gjennom de eksisterende lokale tabellene og synk-veiene (§ 3.5), ingen nye felt på server. Lest mot `maskin.md` og
  `dagsseddel-design.md`: `Vareforbruk.dagsseddelId?` «registreres i Timer-flyten» er nettopp dette. **Mangel målt:**
  `sheet_machine_local` (`schema.ts:208`) har ikke `byggeplassId` (server har, `schema.prisma:546`); server utleder fra
  sedelhodet i `syncMaskinByggeplass` (`dagsseddel.ts:6301`). **Ikke lenger en forutsetning for skjermen** — K19/K20
  legger maskin og varer pr. prosjekt, og maskinrad bærer aldri byggeplass fra skjermen (§ 3.5). Fordeling av maskin
  pr. byggeplass ved to besøk på samme prosjekt er en sedel-sak og hører til **ORDRE 29 Leveranse B #5** («har
  SheetMachine også byggeplassId, gjelder samme regel»), ikke L4-B.
- `sheet_timer`: nytt verdi-alternativ `reiseRetning='mellom'` (L4-C). Lest mot `timer.md`, fase-0 C.16 og
  `maskin.md`: ingen av dem leser `reiseRetning`. Eksport (`timer.md § eksport`) må vise «mellom» som arbeidstid —
  Kontrollør bekrefter ved L4-C.
- `sheet_tillegg`: ikke berørt.
- Registreringsmodus: i `prosjektkort`-modus blir hvert besøkt prosjekt sitt kort på samlesiden (Ordre 8-spec);
  i `dagskort`-modus rader med prosjekt · byggeplass (V22). Ingen ny modus-logikk; Kontrollør måler at kort-grupperingen
  i `[id].tsx` tåler rader med ulik `projectId` (M5 har aldri gitt den det).

---

## 7. Hva denne spec-en bevisst IKKE gjør

- Ingen posisjon lagres utover dagens start/slutt (K16 spør om de skal bort).
- Ingen byggeplass→byggeplass-matriseakse (V9 gjør den unødvendig; K4 eneste bruker).
- Ingen automatisk innsjekk, ingen kobling mot `PsiTilstedevarelse`.
- Ingen endring av overtidsnivåer (100 % finnes ikke, planen § 8).
- Ingen web-flate: PC får ingen bekreft-skjerm — GPS-økta finnes bare på mobil. V19.9-overlappen består.

---

## 8. Tester (DoD på tvers, fra pauset ordre 1–9 + nye)

1. Bekreft → rader finnes, `arbeidsdag_local.status='avsluttet'`, navigasjon til sedelen.
2. Forlat skjermen → ingen rader, dagen `paagaar`, kortet viser «Slutt dag» (**skrives rød først**).
3. Sendt sedel → skjermen viser, ingenting opprettes, dagen avsluttes.
4. Retting av prosjekt/tid/pause i skjermen slår gjennom i radene (ikke originalforslaget).
5. Tomt forslag → «Ingen timer å føre», Avslutt lukker uten sedel.
6. `beregnDagsforslag` er fortsatt ren: samme input → samme output, ingen db-kall (eksisterende test utvides med `besok`).
7. i18n: alle 15 språkfiler har nøklene (`pnpm test` i shared feiler ellers).
8. Regel 10 (typecheck 10 pakker) grønn; reload-linje i commit.
9. Fasit Dag C (§ 4.6) som enhetstest: 5 rader, OT på Fetsund, mellom-rad kun med «Dro fra».
10. V1-vakt: reiserader aldri i overtidsgrunnlaget selv med tre besøk.
11. Server avviser `erReise=true ∧ reiseRetning='mellom'` (L4-C).
12. S1: `AppState active` to ganger innen 10 min → én måling (vakt).
13. Rydding: `arbeidsdag_local` + besøk eldre enn 14 d slettes, nyere ikke.
14. `hentTilAttestering` viser ikke andre prosjekters rader for prosjektadmin (L4-C, gjerde-test som feiler i dag).
15. L3-D: Bekreft med én maskin på prosjektet, antall 3,0 → rad i `sheet_machine_local` med `projectId` = prosjektet,
    **`sheetTimerId = null`**, `fraTid/tilTid = null`, `timer = 3.0` (**rød først**: `anvend` skriver ingen maskin i dag).
16. L3-D: Bekreft med én vare → rad i `vareforbrukLocal` med `syncStatus='pending'`, `sheetId` = sedelen, `projectId` =
    linjens, `byggeplassId` = prosjektets eneste byggeplass i forslaget; `syncVareforbruk` sender først når sedelen er
    `synced` (eksisterende vakt `:48` dekkes av test).
17. L3-D: Dag uten maskin/varer → nøyaktig samme klikksti som L3-A (2); seksjonen rendres men åpner ingenting
    (snapshot/`queryByText`).
18. L3-D: «+ Varer» rendres ikke når `prosjektIderMedVarelager` mangler linjens prosjekt; «+ Maskin» rendres ikke uten
    Maskin-modul/tomt `equipmentLocal`; hele seksjonen rendres ikke når ingen linje har knapp.
19. L3-D: Avbrudd etter at maskin og vare er lagt inn i skjermen → 0 rader i `sheet_machine_local` og `vareforbrukLocal`
    (utvidelse av nr. 2).
20. L3-D: Forslag med to segmenter på samme prosjekt (syntetisk input i testen, ingen L4-B-avhengighet) → **én**
    prosjektlinje; én maskin → én rad; vare får `byggeplassId = null` (ikke entydig).
21. L3-D: Antall maskintimer 9,0 på prosjekt med 3,4 t arbeid + 0,5 t pause → «Legg til» blokkert med
    `beregnMaskinBrudd`-melding, ingen rad; samme input mot `syncBatch` gir samme brudd (server-test finnes).

---

## 9. Spørsmål til Kenneth — vedtak 2026-11-06 og nye (L3-D)

| # | Spørsmål | Alternativer | Anbefaling | Status |
|---|---|---|---|---|
| **K11** | Når bare ankomst er stemplet: hvem bærer gapet A→B? | (a) hele gapet på A (avreise = neste ankomst), mellom-rad kun når «Dro fra» settes · (b) krev «Dro fra»-trykk ved hvert bytte (ekstra klikk) · (c) S1 foreslår «Dro fra A?» når app åpnes utenfor A | **(a) + (c)** — ett klikk forblir hovedregel, V9 slår inn så snart avreise er kjent. (b) bryter P4 | ✅ **VEDTATT (a)+(c) 2026-11-06** |
| **K12** | Kan arbeideren fjerne en reise-etappe i skjermen? | (a) nei, bare via start-/sluttsted og tider · (b) ja, «fjern»-knapp | **(a)** — reise er regel, ikke valg (K1 streng). Fjerning skjuler lønnsavvik | tas ved gate som anbefalt (a) |
| **K13** | «+ Legg til stopp» i bekreft-skjermen? | (a) ja (retting av besøkslogg) · (b) nei, kun på sedelen etterpå | **(a)** — ellers må en glemt byggeplass rettes i to skjermer | ✅ **VEDTATT ja 2026-11-06** (bygges i L4-B) |
| **K14** | Tomt forslag: kan dagen lukkes uten sedel? | (a) ja · (b) nei, alltid sedel m/ 0 rader | **(a)** — en sedel uten rader er støy for attestanten | tas ved gate som anbefalt (a) |
| **K15** | Bestille L3-A før V21/V22 er levert? Planens premiss sier V20–V22 først | (a) ja, L3-A nå, L3-B (manuell inngang) etter V21/V22 · (b) vent | **(a)** — L3-A rører bare GPS-grenen som alt har pausebærer/overtid; porten (G1) er viktigere enn paritet | ✅ **VEDTATT ja 2026-11-06** |
| **K16** | `arbeidsdag_local.start_lat/lng, end_lat/lng` — beholde? | (a) behold (ikke synket, lokal) · (b) dropp, lagre kun tolket sted | **(b)** i L4-A — konsekvent med «aldri GPS-posisjon til person»; ingen leser dem etter tolkning | tas ved gate som anbefalt (b) |
| **K17** | Bekreft: PSI-innsjekk er aldri kilde for besøk eller timer | ja / nei | **ja** — holder «tilstedeværelse ≠ arbeidstid» | tas ved gate som anbefalt (ja) |
| **K18** | Skjermform A (segmentliste) eller B (tidslinje)? Se `skjermform-a-b.png` | A / B | **A** (§ 3.2) | ✅ **VEDTATT A 2026-11-06** |
| **K19** | Maskintimer i bekreft-skjermen: forhåndsutfylt = segmentets arbeidstid? | (a) ja, forhåndsutfylt og redigerbar i arket; regnes om når segmentet rettes til arbeideren overstyrer · (b) alltid tomt felt, må fylles | (a) var anbefalt | ❌ **VEDTATT NEI 2026-11-06** — Kenneth: *«pr prosjekt, med antall -> ikke fra/til»*: tomt antall-felt, påkrevd, pr. prosjekt (§ 3.5) |
| **K20** | Varer lagt inn i skjermen er usynlige på sedelen i dagskort-modus (§ 3.5) | (a) L3-D legger en lesevisning av vareforbruk i `ProsjektGruppe` (dagskort) — samme data som prosjektkortet · (b) «+ Varer» vises bare når firmaet står i prosjektkort-modus; dagskort får varer senere | **(a)** | ✅ **VEDTATT 2026-11-06** — Kenneth: *«en mulighet vi kan legge til pr prosjekt»*; lesevisning (a) tatt i spec på orkestrators ordre (§ 3.5) |
| **K21** | «Redskap» — egen kategori i utstyrsregisteret? | (a) nei, `smautstyr` dekker redskap; velgeren merker dem «redskap» · (b) ny `Equipment.kategori='redskap'` (db-maskin-migrering + import + web) | **(a)** | ✅ **VEDTATT (a) 2026-11-06** |

K11/K13/K15/K18 og K19–K21 er vedtatt; **L3-A kan bestilles nå (§ 10)**, L3-D når L3-A + ORDRE 29 A er på `develop`.

---

## 10. ORDRE-tekst L3-A — klar til sending (orkestrator limer inn i `relay/inbox-<kodeagent>.md`)

```markdown
## ORDRE L3-A — bekreft-dag-skjermen (mobil) — fra orkestrator <dato>

**Hjemmel:** Kenneth 2026-11-06 «ja alle fire» (K11 a+c · K13 · K15 · K18 form A) · spec
`docs/claude/timer-gps-lag3-4-spec.md` § 3.1–3.4, § 5, § 8 nr. 1–8 · helhetsplan § 3 (G1) + H26.
**Skisser:** `docs/claude/skisser-timer-gps-lag3/flyt.png` + `skjermform-a-b.png` (A).
**Branch:** `feat/timer-bekreft-dag` fra `origin/develop`. **Kun mobil + shared/i18n.** Ingen migrering, ingen API-endring,
ingen web. Funksjonsendring med hjemmel over — ingen annen atferd fjernes (meld FØR levering hvis du finner noe du må fjerne).

### Omfang (kun dette)
1. **Ny rute `apps/mobile/app/timer/bekreft-dag.tsx`** (param `arbeidsdagId`), form A: topplinje (dato · start/slutt · sum ·
   norm), reise ut, ÉN arbeidsrad pr. dato (L3-A = én byggeplass; flere kort er L4-B), pause, reise retur, årsak-linje når
   reise mangler (V12/V13 `reiseAarsak`/`destinasjonAarsak`), OT-merke, [Bekreft og lagre] · [Ikke nå].
   Rettedybde B: prosjekt · byggeplass (eksisterende velger), fra/til, aktivitet, pause (0–120), fjern rad. Ved retting
   kjøres `beregnDagsforslag` på nytt med rettet input (ren funksjon, ingen skriving) og summen i toppen regnes om.
   **Ikke** «+ Legg til stopp», **ikke** «Dro fra», **ikke** maskin/varer (L4-B / L3-D).
2. **Grener (§ 3.1):** glemt dag (`kappGlemtDagSlutt`-grenen → samme skjerm, slutt merket «anslått»,
   `sluttTidKilde='system'`) · sendt sedel (`blokkertSendt` → lesemodus «Dagen er alt sendt — ingenting opprettes»,
   lenke til sedelen, dagen avsluttes uten rader) · tomt forslag («Ingen timer å føre» · [Avslutt dag] lukker uten
   sedel (K14 a) · [Ikke nå]) · `ikkeAnsatt`/`kildeManglet`/`prosjektUkjent` (prosjektfelt tomt + rødt «Velg prosjekt»,
   Bekreft deaktivert; `ikkeAnsatt` kun [Avslutt dag uten timer]/[Ikke nå]).
3. **`samleDagsforslagInput` flyttes** fra `apps/mobile/src/components/StartSluttDagKort.tsx:423` til ny
   `apps/mobile/src/services/dagsforslagInput.ts` (named export, samme signatur). Kortet importerer den ikke lenger.
4. **`StartSluttDagKort.tsx`:** `utforSluttDag` (`:92-256`) stopper etter slutt-GPS-måling/tolkning og navigerer til
   skjermen; `Alert` «Slutt dag?» (`:261-273`) fjernes. `anvendDagsforslag` → `avgjorSluttDagHandling` → avslutt
   `arbeidsdag_local` → naviger til sedelen flyttes til skjermens Bekreft-handler; utfallene `:171-252` beholdes.
   **Invariant:** ingen skriving til `sheet_timer_local`/`dagsseddel_local`/`arbeidsdag_local.status` før Bekreft.
   Avbrudd (Ikke nå, tilbake, drept app) → dagen `paagaar`, kortet viser «Slutt dag», nytt trykk åpner skjermen med
   fersk slutt-GPS. Slutt-posisjon sendes som ruteparametre (transient), ikke lagret (K16 b kommer i L4-A).
5. **Tre kodekommentarer reverseres** (`useArbeidsdag.ts:67-77`, `:150-153`, `dagsforslag.ts` topptekst) til ordlyden
   i spec § 5 pkt. 3. Geofence-kommentarene i `migreringer.ts:321` / `schema.ts:411` («aldri lønnsgrunnlag» for
   innsjekk) **står**.
6. **i18n ×15:** `timer.bekreftDag.*` — `nb.json` + `en.json` håndskrevet, resten `--only`. Mikrotekst etter
   tooltip-veileder § 3a (hvor flytter det, hvem får ballen).

### Tester (skrives FØRST; vis rød kjøring i leveransen)
- **Røde uten fiks (sikre):** § 8 nr. 2 (forlat skjermen → 0 rader i `sheet_timer_local`, `arbeidsdag_local.status='paagaar'`
  — rød i dag fordi `anvend` kjører ved Slutt dag) · nr. 4 (retting av prosjekt/tid/pause slår gjennom i radene, ikke
  originalforslaget) · nr. 1 (Bekreft → rader + `avsluttet` + navigasjon).
- **Nye, røde til skjermen finnes:** nr. 3 (sendt sedel) · nr. 5 (tomt forslag → Avslutt lukker uten sedel).
- **Regresjon (grønne før og etter):** nr. 6 (`beregnDagsforslag` ren) · nr. 7 (15 språkfiler) · eksisterende
  `dagsforslag*.test.ts` og `dagsforslagAnvend.lag2.test.ts` uendret grønne.

### DoD
- § 8 nr. 1–8 grønne; `pnpm test` fra rot: samme «N successful, N total» som `origin/develop` + de nye (oppgi tallene før/etter).
- Regel 10: `pnpm typecheck` alle 10 pakker grønn; `pnpm lint` grønn; ingen `any`; ubrukte variabler `_`-prefikset.
- Docs i samme commit: `docs/claude/timer.md` (bekreft-dag-ruten, anvend bak porten) · `docs/claude/mobil.md` (ny rute +
  `dagsforslagInput.ts`) · helhetsplan H26 → 🟢 + LAG 3 første punkt → 🟢 med hash · spec frontmatter `status` «L3-A levert
  <hash>» · STATUS.md tre faste felter.
- Commit på norsk med **«Reload: <metode>»**-linje (deploy-detaljer § Mobil reload). Rebase på `origin/develop` rett før push,
  `--force-with-lease`. Meld hash + testtall i `relay/inbox-orkestrator.md`. Branchen er frosset etter «klar for merge».
- **Gate:** Kontrollør, én gate pr. leveranse. Kontrollør måler i tillegg at `[id].tsx:1175-1208`-banneret («Glemte du å
  avslutte?» / autoFyll) fortsatt treffer radene skjermen skriver.

### Ikke i L3-A
Maskin/redskap/varer (L3-D) · flere besøk, «+ Legg til stopp», «Dro fra», mellom-rader (L4-A/L4-B) · manuell inngang (L3-B) ·
U-BEKREFT-R (L3-C) · dropp av koordinater (L4-A, K16) · web.
```
