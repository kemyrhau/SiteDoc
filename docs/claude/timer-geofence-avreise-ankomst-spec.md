---
status: 🟡 UTKAST 2026-11-15 — spec levert til Kenneth via orkestrator; B1–B10 åpne. Ingen kode. Reverserer vedtakene i `timer-gps-lag3-4-spec.md` § 2.3/§ 2.5, `timer-gps-helhetsplan.md` LAG 4/K3 og `mannskap.md:45` med Kenneth-hjemmel 2026-11-15.
sist_verifisert_mot_kode: 2026-11-15 (develop @ d409fca4)
eier: Fabel (spec) → Redesign/kode-Opus (kode)
ordre: «ORDRE — spec: målt avreise/ankomst via lokal geofence (GPS-kilde for forslag i timer) — orkestrator 2026-11-15» (relay/inbox-fabel.md)
---

# Spec — målt avreise og ankomst via lokal geofence (GPS-kilde for forslag i timer)

> **Kenneth 2026-11-15, ordrett:** *«vi skal beregne ferdige forslag som den ansatte kan korrigere, korrigerer en i
> et kort, da automatisk korrigerer vi nabokort for den gps beregnede tiden. Vi må ta høyde for at våre beregnede
> tider er feil. hva om den ansatte punkterer på et dekk og blir heftet på veien. eller at det er veiarbeid som gjør
> at den reelle tiden endres. korrigering må gjøres enkelt. vi må analysere start possisjon, og sluttpossisjon. gdpr
> må vi løse ved at firma henter inn aksept fra arbeidstaker ved ansettelse. Vi lagrer ikke posisjoner på server, kun
> i sqlite på telefonen -> vi bør vurdere å slette possisjoner lagret lokalt hver gang vi sender inn dagskort.»*

**Godkjent retning (Kenneth «Ja, som anbefalt» 2026-11-15):** bakgrunns-geofence rundt *kjente* steder (oppmøtested,
byggeplass), ikke kontinuerlig sporing. Telefonen lagrer bare *hendelsen* (sted-id + forlot/ankom + klokkeslett), aldri
koordinater eller rute. Kun SQLite; ingen posisjon til serveren. Lokale hendelser slettes når serveren har *bekreftet*
mottatt dagskort — ikke ved trykk på «Send» (offline). Aktiveres bare når firmaet har slått på bryter pr. ansatt OG
arbeideren har gitt OS-tillatelsen «Alltid»; ellers manuelt som i dag. Målt tid er alltid et *forslag* med synlig kilde.

**Hva denne specen gjør med tidligere vedtak:** S3 «bakgrunnssporing avvist» (`timer-gps-lag3-4-spec.md` § 2.3) og
«ingen bevegelse mellom stopp» (§ 2.5), «bakgrunnssporing avvist» i `timer-gps-helhetsplan.md` LAG 4 og K3, og «aldri
GPS-posisjon til person» i `mannskap.md:45` er reversert i samme commit som denne fila, med markør *«⚠️ REVERSERT
2026-11-15 (Kenneth)»*. Det som står fast: ingen *posisjon* lagres eller sendes — bare *hendelse ved kjent sted*.
«Tilstedeværelse ≠ arbeidstid» står også: geofence-hendelsen er en *måling* som foreslår, arbeideren bestemmer
(samme vedtak som TILLEGG 3 i ordre (17), `relay/inbox-redesign.md`).

Hjemmel ellers: [timer-gps-helhetsplan.md](timer-gps-helhetsplan.md) § 4b (V1–V22), [timer-gps-lag3-4-spec.md](timer-gps-lag3-4-spec.md)
§ 2 (besøksmodellen), [v17-geofence-spec.md](v17-geofence-spec.md) (sirkel + sone), ordre (17) reisekjede
(`relay/inbox-redesign.md`, GODKJENT PLAN: *«Bygg kjeden slik at en senere kilde «geofence» kan levere målt
avreise/ankomst inn i samme forslag uten omskriving (kildefelt på målt tidspunkt)»*).

---

## 0. Begreper

| Begrep | Betydning her |
|---|---|
| **Kjent sted** | Et oppmøtested (`Oppmotested`, `schema.prisma:2879`, `radiusM` default 150) eller en byggeplass med punkt (`Byggeplass`, `schema.prisma:1142`, `latitude/longitude/radiusM/geofenceKilde`). Begge finnes lokalt: `oppmotested_local` (`apps/mobile/src/db/schema.ts:565`) og `byggeplass_local` (`:653–655`). |
| **Geofence-hendelse** | `{ stedType, stedId, hendelse: 'forlot' \| 'ankom', tidspunkt }`. Ingen lat/lng, ingen nøyaktighet, ingen fart. Dette er *alt* telefonen lagrer. |
| **Målt tidspunkt** | Et klokkeslett med `kilde`. Kilder i dag: besøk (`arbeidsdag_besok_local.ankomstAt/avreiseAt`, `schema.ts:462–474`) og manuell. Ny kilde: `geofence`. |
| **Beregnet tidspunkt** | Det reisekjeden (17) regner ut fra kjøretid og nabokort. |
| **Rettet tidspunkt** | Det arbeideren har skrevet selv (`tidRettet` i (17)). Vinner alltid. |

---

## 1. Målt mot koden (develop @ d409fca4)

| # | Funn | Referanse |
|---|---|---|
| M1 | `expo-location` **19.0.8** er installert og har geofence-API: `startGeofencingAsync(taskName, regions)`, `stopGeofencingAsync(taskName)`, `hasStartedGeofencingAsync(taskName)`. Hendelsen leveres til en bakgrunnsoppgave definert med `TaskManager.defineTask` i toppnivå-scope, med `{ eventType: Enter \| Exit, region }`. | `apps/mobile/node_modules/expo-location/build/Location.d.ts:234`, `:241`, `:247`; eksempel `:219–231` |
| M2 | `LocationRegion` = `identifier`, `latitude`, `longitude`, `radius`, `notifyOnEnter`, `notifyOnExit`, `state`. Sirkel, ikke polygon. | `expo-location/build/Location.types.d.ts:201–232` |
| M3 | **`expo-task-manager` er ikke installert.** Ingen bakgrunns-API i bruk i appen (0 treff på `startGeofencingAsync`/`startLocationUpdatesAsync`/`TaskManager`). Samme funn som 2026-11-06. | `apps/mobile/package.json` (ingen rad); `timer-gps-helhetsplan.md:357` |
| M4 | Config-pluginen legger `UIBackgroundModes: ["location"]` i Info.plist bare når `isIosBackgroundLocationEnabled` er satt, og `ACCESS_BACKGROUND_LOCATION` i AndroidManifest bare når `isAndroidBackgroundLocationEnabled` er satt. Foreground-service på Android følger samme bryter om ikke overstyrt. | `expo-location/plugin/build/withLocation.js:8–12`, `:18`, `:33–35`, `:42` |
| M5 | `app.json` i dag: pluginen har bare tekst for `locationAlwaysAndWhenInUsePermission`; `infoPlist` har ingen `UIBackgroundModes`; Android-tillatelser er COARSE/FINE/RECORD_AUDIO uten BACKGROUND. | `apps/mobile/app.json:16`, `:25`, `:35` |
| M6 | All GPS i dag er forgrunns-engangsmåling: `fangGps` → `getCurrentPositionAsync` ved Start dag (`useArbeidsdag.ts:57/:64/:164`), S1 ved app-åpning (`arbeidsdagBesok.ts:233`, maks én pr. 10 min, demping 30 min), Slutt dag. | `apps/mobile/src/hooks/useArbeidsdag.ts`, `apps/mobile/src/services/arbeidsdagBesok.ts:15–31` |
| M7 | `arbeidsdag_besok_local` er knyttet til en *pågående arbeidsdag* (`arbeidsdagId NOT NULL`), har `kilde` `'start_dag' \| 'gps_forslag' \| 'manuell' \| 'slutt_dag'` og `bekreftet`. Ryddes med arbeidsdagen etter 14 d (`RYDD_ETTER_MS`, `ryddGamleArbeidsdager`). Toppteksten lover: KUN lokal, PSI aldri kilde. | `schema.ts:462–474`; `arbeidsdagBesok.ts:31`, `:141` |
| M8 | Synk-kvittering finnes: `dagsseddel_local.syncStatus` ∈ `pending \| synced \| conflict \| avvist`; `synced` settes først når serveren har svart `ok`/`merged` på pushen. Synken kjører hvert 30 s og ved app-aktiv. | `schema.ts:125–128`; `apps/mobile/src/services/timerSync.ts:119`, `:320`; `apps/mobile/src/providers/TimerSyncProvider.tsx:212`, `:291` |
| M9 | Arbeidsdagen avsluttes i `bekreftDag` (`status: "avsluttet"`), som også skriver siste besøks `avreiseAt` via `avsluttBesok`. | `apps/mobile/src/utils/bekreftDag.ts:282`, `:289`, `:327`, `:333` |
| M10 | Oppmøtested-perioder er cachet lokalt pr. bruker (`oppmote_periode_local`), så dagens oppmøtested er kjent offline. | `schema.ts:582`; server `OppmotePeriode` `schema.prisma:2928` |
| M11 | Pr.-ansatt-flagg bor på `OrganizationMember` (`ansattRolle`, `firmaRoller`, `status`, `prosjektTilgang`, `oppmotePerioder`). Firma-defaulter bor på `OrganizationSetting`. Web-flaten for én ansatt er `firma/ansatte/page.tsx` med avkrysningsbokser for firmaadmin/HMS/HR/prosjektoppretter (`:802–847`) og `OppmotePerioder` (`:737`). | `schema.prisma:248`, `:376`; `apps/web/src/app/dashbord/firma/ansatte/page.tsx` |
| M12 | Mobilen har **ingen** spørring som henter brukerens egen ansettelsesrad med flagg (bare `medlem.hentForProsjekt`/`hentMineFaggrupper`). Oppmøte-perioder hentes via egen katalog-refresh. | `grep medlem\.` i `apps/mobile` → kun prosjekt-medlemskap |
| M13 | (17) er planlagt, ikke levert: `sekvenserReisekjede` finnes ikke i `packages/shared/src/utils/reiseManuell.ts` (eksporter i dag: `klassifiserManuellReise :73`, `løsReiseKort :282`, `løsOverforingKort :372`). Redesigns PLAN P1 lover kildefelt på målt tidspunkt og at besøkets `ankomstAt` vises som «Målt 10:40 (Ankommet) · Beregnet 10:25». | `relay/inbox-orkestrator.md` (PLAN P1 (17)); `relay/inbox-redesign.md` (GODKJENT PLAN) |
| M14 | Delt stedsmodell: `Geofence = Sirkel \| Polygon`, `erInnenfor`, `sentroidePunkter`, `gjenkjennSted`, `tilGeofencer`, `geofenceForm`. OS-geofence tar bare sirkler (M2). | `packages/shared/src/utils/sted.ts:50`, `:158`, `:181`, `:333`, `:381`, `:415` |
| M15 | `tidKilde` på timerad er i dag `'stempel' \| 'utledet' \| 'manuell'` — ingen verdi skiller «målt av geofence» fra «stempel». | `packages/shared/src/utils/timerDetaljRader.ts:76` |
| M16 | `PsiTilstedevarelse.kilde` har alt verdien `"geofence"` på server-siden (PSI-modulen). Må ikke blandes med denne kilden — PSI er egen ordre. | `schema.prisma:2449` |
| M17 | Vakt-test som hindrer lat/lng i lokale timer-tabeller finnes som mønster (`geofence-grep-vakt.test.ts` vokter `radiusM != null`-filtre; `arbeidsdagBesok.ts`-toppteksten vokter PSI). Ingen vakt mot bakgrunns-API finnes — den må skrives (§ 8). | `apps/mobile/src/services/geofence-grep-vakt.test.ts` |

**Plattformgrenser (leverandør-dokumentasjon, ikke målt i kode — merkes slik):** iOS overvåker maks **20 regioner pr.
app** samtidig (CoreLocation); Android maks **100 geofences pr. app**. Begge anbefaler radius ≥ 100 m. *Exit*-hendelser
forsinkes med vilje av OS-et (iOS typisk 20 s–flere minutter etter faktisk utgang, for å unngå flimring i kanten).
Android 10 skiller «bare i bruk» fra «alltid»; fra Android 11 kan «alltid» bare gis i Innstillinger — `requestBackgroundPermissionsAsync`
åpner den dialogen, og `isBackgroundLocationAvailableAsync` sier om plattformen støtter det. Expo krever
`UIBackgroundModes: location` for bakgrunns-metodene sine (M4); Apple krever strengt tatt ikke dette for ren
region-overvåking, men vi følger Expo-pluginen.

---

## 2. Teknikk (ordrepunkt 1)

### 2.1 Hva som bygges

- **Én bakgrunnsoppgave** `GEOFENCE_HENDELSE` definert med `TaskManager.defineTask` i toppnivå-scope (M1), i en ny
  fil `apps/mobile/src/services/geofenceHendelse.ts`. Oppgaven gjør *én* ting: skriver en rad i `geofence_hendelse_local`
  (§ 3) med `stedType/stedId` fra `region.identifier` (`"oppmotested:<id>"` / `"byggeplass:<id>"`), `hendelse`
  fra `eventType` og `tidspunkt = now()`. Ingen posisjonsoppslag, ingen nettverkskall, ingen UI.
- **Region-sett** bygges av `byggGeofenceRegioner(db, userId, organizationId)` og registreres med
  `startGeofencingAsync` (å kalle den igjen erstatter settet, M1). Settet bygges om: ved app-åpning, etter katalog-refresh
  (byggeplass/oppmøtested/perioder), ved firmabytte, og når bryteren (§ 5) endres. Maks **20** regioner (iOS-grensen
  gjelder begge plattformer for enkelhet). Prioritet når det er flere:
  1. dagens oppmøtested fra `oppmote_periode_local` (M10) — alltid med,
  2. byggeplasser med punkt i prosjekter arbeideren har timer på de siste 14 dagene (`sheet_local` lokalt),
  3. byggeplasser i pågående arbeidsdags prosjekt(er),
  4. øvrige byggeplasser i firmaet med punkt, nærmest oppmøtestedet først (`avstandM`, `sted.ts:78`).
  Soner (polygon, V17) får omskrevet sirkel: `sentroidePunkter` (`:181`) + største avstand til hjørne, minst 100 m (B6).
- **Radius:** stedets `radiusM`, men aldri under 100 m (plattformanbefaling). Oppmøtested default 150 m holder.
- **Demping:** `ankom` og `forlot` for samme sted innen **10 min** slås sammen til ingen hendelse (kanten-flimring).
  Terskelen er konstant `GEOFENCE_DEMPING_MS` ved siden av `S1_DEMPING_MS` (B10).
- **Stopp:** `stopGeofencingAsync` + sletting av alle lokale hendelser når (a) arbeideren slår av i appen, (b) firmaet
  slår av (oppdages ved neste synk, § 5.4), (c) OS-tillatelsen ikke lenger er «Alltid» (sjekkes med
  `getBackgroundPermissionsAsync` ved app-åpning), (d) utlogging eller firmabytte.

### 2.2 Konfigurasjon og bygg

| Endring | Krever nytt EAS-bygg? | Hvorfor |
|---|---|---|
| `expo-task-manager` som avhengighet | **Ja** | Native modul (M3). OTA kan ikke bære den. |
| `expo-location`-plugin: `isIosBackgroundLocationEnabled: true`, `isAndroidBackgroundLocationEnabled: true`, `isAndroidForegroundServiceEnabled: false` | **Ja** | Endrer Info.plist/AndroidManifest (M4). Foreground-service er for kontinuerlig sporing — slås eksplisitt av, så Android ikke viser «sporer deg»-varsel. |
| Tekst for `locationAlwaysPermission` (nb + en) | **Ja** | Info.plist. Teksten må si *hva* og *hvorfor* (§ 6). |
| Kode i `geofenceHendelse.ts`, SQLite-tabell, innstillingsskjerm, (17)-kobling | Nei | JS, går med OTA — men virker ikke før bygget over er installert. Koden må derfor sjekke `TaskManager.isAvailableAsync()` og vise «Krever oppdatert app» i innstillingen. |

**Ingen agent fyrer bygget.** Specen ber om *ett* EAS-bygg (iOS + Android) når G2 (§ 7) er gatet, samlet med andre
native endringer som venter — Kenneth avgjør tidspunkt mot kvoten (`eas-build-veileder.md`) (B8).

### 2.3 Batteri

OS-geofence bruker celle/Wi-Fi-posisjonering og vekker appen bare ved kryssing — det er den billigste bakgrunnsmekanismen
plattformene tilbyr. Forventet merforbruk er lavt, men **ikke målt**. Specen krever at G3 (§ 7) leverer en enkel
måling: to arbeidsdager med og to uten på samme telefon, batteriprosent ved 07:00 og 16:00, ført i `mobil.md`.
`watchPositionAsync` og `startLocationUpdatesAsync` brukes ikke; vakt-test i § 8 forbyr dem.

---

## 3. Lokal lagring (ordrepunkt 2)

### 3.1 Ny tabell, ikke utvidelse av `arbeidsdag_besok_local`

Besøkstabellen passer ikke: den krever en pågående arbeidsdag (M7), mens den viktigste hendelsen — *forlot
oppmøtestedet* — skjer *før* «Start dag» trykkes, og *ankom oppmøtestedet* skjer etter «Slutt dag». Besøk er dessuten
arbeiderens *bekreftede* stopp; en geofence-hendelse er en *umiddelbar måling* som kan være feil (OS-forsinkelse,
flimring). Å blande dem ville også bryte toppteksten i `arbeidsdagBesok.ts` og vaktene bak den.

```ts
// apps/mobile/src/db/schema.ts — KUN lokal, synkes aldri, ingen lat/lng (vakt-test § 8)
export const geofenceHendelseLocal = sqliteTable("geofence_hendelse_local", {
  id: text("id").primaryKey(),                 // klient-UUID
  userId: text("user_id").notNull(),           // synlighetsvakt, som oppmote_periode_local
  organizationId: text("organization_id").notNull(),
  stedType: text("sted_type").notNull(),       // 'oppmotested' | 'byggeplass'
  stedId: text("sted_id").notNull(),
  stedNavn: text("sted_navn").notNull(),       // snapshot til visning offline
  hendelse: text("hendelse").notNull(),        // 'forlot' | 'ankom'
  tidspunkt: text("tidspunkt").notNull(),      // ISO, lokal klokke på telefonen
  dato: text("dato").notNull(),                // YYYY-MM-DD etter kl. 12-regelen (samme som oppmote_overforing_ko)
  registrertAt: text("registrert_at").notNull(),
  bruktIDagsseddelId: text("brukt_i_dagsseddel_id"), // settes når forslaget ble lagret på en sedel (sletting § 3.2)
});
```

Lokal migrering via `migreringer.ts` (samme vei som `VEDLEGG_REGISTRERT_KOLONNER`). **Ingen Prisma-endring for denne
tabellen** — den finnes bare på telefonen.

### 3.2 Slettekriterium

Kenneths ord: *«slette … hver gang vi sender inn dagskort»*. Godkjent retning presiserer *bekreftet mottatt*. Regel:

1. **Hovedregel — synk-kvittering.** Etter hver `syncTimer` (`TimerSyncProvider.tsx:212`) kjøres
   `ryddGeofenceHendelser(db, userId, organizationId)`: for hver `dato` med hendelser slettes radene når **alle**
   `dagsseddel_local` for (bruker, firma, dato) har `syncStatus = 'synced'` (M8) og minst én finnes. `conflict`/`avvist`
   holder radene (arbeideren kan trenge dem for å rette). `bruktIDagsseddelId` er ikke nødvendig for regelen, men gjør
   det mulig å vise «brukt» i innstillingsskjermen og teste at riktig dag ble ryddet.
2. **Reserveregel — alder.** Rader eldre enn **14 d** slettes uansett, samme konstant som `RYDD_ETTER_MS`
   (`arbeidsdagBesok.ts:31`), slik at dager uten dagskort (fri, sykdom, glemt) ikke blir liggende (B5).
3. **Umiddelbart alt:** ved stopp-grunnene i § 2.1 (av-bryter, firma av, tillatelse trukket, utlogging, firmabytte).

Sletting skjer med `DELETE`, ikke tombstone — det finnes ingen server å forsone mot.

### 3.3 Hva som aldri lagres

Lat/lng, nøyaktighet, fart, retning, rute, tidspunkt *mellom* steder, hendelser for steder som ikke er firmaets egne.
Vakt-test (§ 8 T1) grep-er `schema.ts` for tabellen og feiler på kolonnenavn som matcher `/lat|lng|latitude|longitude|accuracy|speed|heading/`.

---

## 4. Kobling til reisekjeden (17) (ordrepunkt 3)

### 4.1 Grensesnitt

(17) bygger `sekvenserReisekjede` i `packages/shared` (M13) med kildefelt på målt tidspunkt. Denne specen *bruker* det
grensesnittet og legger ikke til egen logikk i shared ut over typen:

```ts
// packages/shared/src/utils/reisekjede.ts (navn følger (17)) — utvidelse denne specen trenger
export type MaaltKilde = "besok" | "geofence" | "manuell";
export type MaaltTidspunkt = {
  tid: string;            // "HH:mm" i firmaets tidssone
  kilde: MaaltKilde;
  stedId: string;
  stedType: "oppmotested" | "byggeplass";
  hendelse: "forlot" | "ankom";
};
// Pr. etappe i input til sekvenserReisekjede:
//   maaltAvreise?: MaaltTidspunkt   (fra-stedets 'forlot')
//   maaltAnkomst?: MaaltTidspunkt   (til-stedets 'ankom')
```

Mobilen fyller feltene i `samleDagsforslagInput` (som (17) alt utvider med `arbeidsdagId`): les
`geofence_hendelse_local` for `dato`, sortér på `tidspunkt`, og **match på sted-id** mot etappenes fra/til-sted.
Umatchede hendelser (sted som ikke er med i kjeden) ignoreres i forslaget, men vises i innstillingsskjermen (§ 6.2) så
arbeideren kan se hva telefonen målte. Ved både besøk (`ankomstAt`) og geofence for samme ankomst vinner **besøk**
(bekreftet av arbeideren); geofence fyller der besøket mangler — først og fremst `forlot oppmøtested` om morgenen og
`ankom oppmøtested` om kvelden, som ingen besøksrad dekker i dag.

### 4.2 Prioritet og korrigering

Reglene er (17) sine; her bare hva kilden `geofence` betyr i dem:

| Situasjon | Resultat i forslaget |
|---|---|
| Målt finnes, ingen rettelse | Målt vinner over beregnet. Linje: «Avreise: **Målt 06:52** (Forlot Kontor Nord) · Beregnet 07:00». |
| Arbeideren retter kortet | Rettet er fast punkt; naboer flytter (Kenneth-vedtak i (17)). Målt vises fortsatt som grå referanse, ikke som konflikt. |
| Målt avviker fra beregnet med mer enn terskel (foreslått 20 min — (17) sin) | Begge vises, målt forhåndsvalgt. Dette er «punktert dekk»-tilfellet: reisen tok lenger tid enn kjøretid-matrisen sier, og det målte er riktigere. |
| Målt er åpenbart feil (ankom før forlot, eller > 14 t etter) | Hendelsen forkastes for forslaget og merkes «ikke brukt» lokalt. Beregnet brukes. |
| Ingen målt (bryter av, tillatelse mangler, ingen kjent sted) | Nøyaktig som i dag — beregnet, med «Beregnet» som eneste kilde. |

Kildemerket på timeraden: `tidKilde` (M15) får **ikke** ny verdi i denne leveransen; raden skrives som i dag
(`'stempel'` for målt/besøk-ankomst slik (17) alt gjør). Om serveren skal kunne skille «geofence» fra «stempel», er
en beslutning (B2) — se § 6.5.

---

## 5. Firmabryter og arbeiderens valg (ordrepunkt 4)

### 5.1 Tre vilkår, alle må være sanne

1. **Firma har slått på for ansatt** — ny kolonne på `OrganizationMember` (M11).
2. **Arbeideren har slått på i appen** — lokalt valg, lagret i AsyncStorage-nøkkel pr. (bruker, firma). Kenneths
   «aksept ved ansettelse» er firmaets dokument; appens valg er arbeiderens *praktiske* bryter og kan alltid slås av (B4).
3. **OS-tillatelse «Alltid»** — `getBackgroundPermissionsAsync().status === 'granted'`.

Mangler ett vilkår, oppfører appen seg nøyaktig som i dag (forgrunns-GPS ved Start/Slutt dag + S1/S2).

### 5.2 Server (packages/db — ansettelsesforholdet, ikke timer-modulen; B9)

```prisma
model OrganizationMember {
  // …
  /// Målt reise via geofence på arbeiderens telefon (spec timer-geofence-avreise-ankomst). NULL = av (to-stegs-policy, ingen backfill).
  geofenceForslag        Boolean?  @map("geofence_forslag")
  geofenceForslagSattAv  String?   @map("geofence_forslag_satt_av")
  geofenceForslagSattVed DateTime? @map("geofence_forslag_satt_ved")
}

/// Logg for dokumentasjon av informasjon/aksept (begge grunnlag i § 6). Append-only.
model GeofenceSamtykkeLogg {
  id                   String   @id @default(uuid())
  organizationId       String   @map("organization_id")
  organizationMemberId String   @map("organization_member_id")
  handling             String   // 'firma_paa' | 'firma_av' | 'info_vist' | 'ansatt_paa' | 'ansatt_av'
  grunnlag             String?  // 'samtykke' | 'kontrolltiltak' | null (firmaets valg, § 6)
  tekstVersjon         String?  // versjon av informasjonsteksten arbeideren fikk
  avUserId             String   @map("av_user_id")
  ved                  DateTime @default(now())
  @@index([organizationMemberId, ved])
  @@index([organizationId])
}
```

Én migrering, additiv, ingen backfill (flagg, ikke identitet — «stille tomhet»-regelen gjelder koblingskolonner).
Router: `ansatt.settGeofenceForslag({ organizationId, organizationMemberId, paa })` (firmaadmin, firma-grense i
server-laget) og `ansatt.minGeofenceInnstilling({ organizationId })` (arbeideren selv → `{ firmaPaa, grunnlag,
infoTekstVersjon }`). Mobilen kaller den siste ved app-åpning og etter synk, og cacher svaret lokalt (M12: finnes ikke
i dag).

### 5.3 Web — hvor bryteren bor

I ansatt-detaljpanelet i `firma/ansatte/page.tsx`, rett under `OppmotePerioder` (`:737`), som egen rad **«Målt reise
via telefon»** med avkrysningsboks i samme form som firmaadmin/HMS/HR (`:802–847`), og hjelpetekst (?-ikon):
*«Telefonen registrerer når den ansatte forlater og ankommer oppmøtested og byggeplasser, og foreslår tidene i Bekreft
dag. Ingen posisjon lagres på server. Den ansatte må godta i appen og gi tillatelse «Alltid».»* Under boksen vises
status fra loggen: «Ansatt godtok 2026-11-20 · Tekst v1» eller «Venter på ansatt». Hjelpetekst registreres i
`hjelpetekster.md`.

### 5.4 Mobil — hva arbeideren ser

- **Ny seksjon i Mer → Timer-innstillinger: «Målt reise».** Tre linjer med status: Firma (på/av), Du (på/av — bryter),
  Tillatelse (Alltid / Bare i bruk / Ikke gitt — knapp «Åpne innstillinger»). Over bryteren står informasjonsteksten
  (firmaets grunnlagstekst, § 6, versjonert) og den faste forklaringen: *«Telefonen lagrer bare at du forlot eller ankom
  et kjent sted, og når. Ikke hvor du var ellers. Slettes når dagkortet er mottatt av serveren, senest etter 14 dager.»*
- Slå på → logg `info_vist` + `ansatt_paa` (server, via køen `oppmote_overforing_ko`-mønsteret om offline), be om
  OS-tillatelse, start geofencing. Slå av → `ansatt_av`, stopp, slett lokale hendelser.
- **Liste over dagens hendelser** i samme seksjon («06:52 Forlot Kontor Nord · 07:31 Ankom Fetsund bru …») med
  «Slett alle nå». Åpenhet er billig og tar bort mistanke.
- **Første gang bryteren vises** (firma slo på): ett kort i Timer-fanen «Firmaet har åpnet for målt reise — se
  innstillinger», ingen modal, ingen toast.
- Firma slår av mens arbeideren har på: neste `minGeofenceInnstilling` gir `firmaPaa=false` → stopp + slett, seksjonen
  viser «Av (firma)».

---

## 6. GDPR — hva appen må støtte, uten juridisk konklusjon (ordrepunkt 5)

🔴 **Flagg til Kenneth.** Kenneths plan er «firma henter inn aksept fra arbeidstaker ved ansettelse». Prosjektets egen
dokumentasjon sier det motsatte om samtykke: `mannskap.md:40` *«Samtykke ikke nødvendig og ikke anbefalt
(arbeidsgiver/ansatt-relasjon gjør samtykke ufritt iht. Datatilsynet)»*, og `mannskap.md:19` krever «juridisk
sign-off» for OS-geofence. Datatilsynets veiledning er at samtykke i arbeidsforhold sjelden er frivillig, og at
posisjonsopplysninger om ansatte typisk behandles som **kontrolltiltak** etter arbeidsmiljøloven kap. 9 (drøfting med
tillitsvalgte § 9-2, informasjon til de ansatte, saklig grunn og forholdsmessighet § 9-1). Specen tar ikke stilling.
Den beskriver hva appen må kunne for **begge** grunnlag, så valget kan tas av Kenneth (eventuelt med jurist) uten
omskriving (B1).

### 6.1 Felles krav uansett grunnlag

| Krav | Hvordan specen møter det |
|---|---|
| Dataminimering | Bare hendelse ved kjent sted (§ 3.3). Ingen koordinater, ingen rute. |
| Lagringsbegrensning | Slettes ved synk-kvittering, senest 14 d (§ 3.2). |
| Åpenhet | Informasjonstekst før aktivering, synlig hendelsesliste, synlig kilde «Målt» på hvert forslag (§ 4.2, § 5.4). |
| Formålsbegrensning | Brukes bare til forslag i Bekreft dag. Ingen leder-flate viser hendelser; serveren får bare det arbeideren lagrer på dagkortet. |
| Dokumentasjon | `GeofenceSamtykkeLogg` (§ 5.2) viser når firma slo på, hvilken tekstversjon arbeideren så, og når arbeideren slo på/av. |
| Innsyn/sletting (art. 15/17) | Alt lokalt kan slettes av arbeideren selv («Slett alle nå»); loggen eksporteres med øvrig ansattdata. |
| DPIA (art. 35) | Systematisk overvåking av ansatte er et typisk DPIA-tilfelle. **Flagg:** ingen DPIA finnes (helhetsplan K3 sa det samme). Ikke appens oppgave, men Kenneth bør vite det. |

### 6.2 Hvis grunnlaget er samtykke (art. 6(1)(a), art. 7)

- Aktivt opt-in i appen (bryteren i § 5.4), aldri forhåndsvalgt.
- Like lett å trekke som å gi: samme bryter; trekk gir umiddelbar stopp + sletting.
- Loggført med tidspunkt og tekstversjon (`ansatt_paa` med `tekstVersjon`).
- Firmaets «aksept ved ansettelse» er da bare informasjon — det *reelle* samtykket er trykket i appen.

### 6.3 Hvis grunnlaget er kontrolltiltak (aml. kap. 9 + personopplysningsloven)

- Firmaet dokumenterer drøfting og informasjon *utenfor* appen; appen lagrer at informasjonsteksten ble vist (`info_vist`).
- Arbeideren trenger da ikke «godta», men specen **anbefaler** likevel at bryteren i appen beholdes (B4): OS-tillatelsen
  er uansett arbeiderens egen, så systemet må tåle «av» på telefonen. Firmaet ser i web om målt reise faktisk er aktiv.
- `grunnlag = 'kontrolltiltak'` i loggen, så eksport skiller grunnlagene.

### 6.4 Grunnlagstekst pr. firma

Firmaet skriver/velger informasjonsteksten arbeideren får (standardtekst fra SiteDoc i nb/en som utgangspunkt, i18n).
Lagres på `OrganizationSetting` (`geofenceInfoTekst`, `geofenceGrunnlag`) med versjonsnummer som følger loggen.
Dette er den eneste firmainnstillingen i denne specen; pr.-ansatt-bryteren bor på medlemmet (§ 5.2).

### 6.5 🔴 Serveren får likevel en avledet opplysning

Når arbeideren lagrer forslaget, får serveren «avreise 06:52» på dagkortet — det er samme opplysning som arbeideren
alltid har kunnet føre manuelt, og *ikke* posisjon. Men hvis kildefeltet `geofence` følger med til serveren (B2), vet
serveren at tiden er *målt* av telefonen, ikke oppgitt av arbeideren. Det er en liten, men reell forskjell for
grunnlagsvurderingen. Anbefaling: kildefeltet forblir på telefonen; serveren får `tidKilde` som i dag (M15). Lederen
ser da ingen forskjell på målt og manuelt — som er poenget med «arbeideren bestemmer».

---

## 7. Leveransedeling og rekkefølge

| Lev. | Innhold | Avhengig av | Gate |
|---|---|---|---|
| **G0** | Denne specen + reversering av gamle vedtak (samme commit) | — | Fabel → Kenneth B1–B10 |
| **G1 server + web** | Migrering (`OrganizationMember`-kolonner, `GeofenceSamtykkeLogg`, `OrganizationSetting`-tekst), routere, ansatt-side-rad, hjelpetekst | B1, B3, B9 | Kontrollør |
| **G2 mobil native** | `expo-task-manager`, plugin-opsjoner, tillatelsestekster, `geofenceHendelse.ts` (task + region-bygger + stopp), `geofence_hendelse_local` + migrering, vakt-tester T1–T4 | G1 (for `minGeofenceInnstilling`) | Kontrollør → **Kenneth fyrer EAS-bygg** (B8) |
| **G3 mobil innstilling** | «Målt reise»-seksjon, hendelsesliste, logg-kall, synk-kvittering-rydding, batterimåling (§ 2.3) | G2 | Kontrollør |
| **G4 kobling (17)** | `MaaltTidspunkt` med `kilde: 'geofence'` i `samleDagsforslagInput` → `sekvenserReisekjede`, visning «Målt (Forlot …)» | (17) merget, G3 | Kontrollør |

G1 og G2 kan kodes parallelt om B1/B3/B9 er avgjort; G2 kan ikke *verifiseres på telefon* før bygget er installert.
Ingen leveranse rører dagskortet, `syncBatch` eller besøksmodellen.

---

## 8. Tester som skal feile først (gate-krav)

| # | Test | Fil |
|---|---|---|
| T1 | Vakt: `geofence_hendelse_local` har ingen kolonne som matcher `/lat\|lng\|latitude\|longitude\|accuracy\|speed\|heading/` | `apps/mobile/src/db/geofenceHendelse.vakt.test.ts` |
| T2 | Vakt: ingen fil i `apps/mobile/src` kaller `watchPositionAsync` eller `startLocationUpdatesAsync`; `startGeofencingAsync` kalles bare fra `geofenceHendelse.ts` | samme |
| T3 | Bakgrunnsoppgaven skriver én rad pr. hendelse med riktig `stedType/stedId/hendelse/dato`, og gjør ingen nettverkskall (mock av `fetch`/tRPC feiler testen) | `geofenceHendelse.test.ts` |
| T4 | Demping: `ankom` + `forlot` samme sted innen 10 min → 0 rader; 11 min → 2 rader | samme |
| T5 | Region-bygger: dagens oppmøtested alltid med; maks 20; prioritet 1–4; sone → omskrevet sirkel ≥ 100 m; sted uten punkt utelates | samme |
| T6 | Rydding: dato med alle sedler `synced` → rader slettet; én `pending`/`conflict` → beholdt; eldre enn 14 d → slettet uansett; annen bruker/firma urørt (isolasjon) | `ryddGeofenceHendelser.test.ts` |
| T7 | Stopp-grunnene (ansatt av, firma av, tillatelse ikke «Alltid», utlogging, firmabytte) gir `stopGeofencingAsync` + tom tabell | samme |
| T8 | `samleDagsforslagInput`: hendelser matches på sted-id til riktig etappe; besøk vinner over geofence for samme ankomst; umatchet ignoreres; «ankom før forlot» forkastes | `dagsforslag.geofence.test.ts` |
| T9 | Forslag viser «Målt HH:mm (Forlot <sted>) · Beregnet HH:mm» når geofence finnes, bare «Beregnet» når ikke | `bekreft-dag`-test (17) |
| T10 | Server: `settGeofenceForslag` krever firmaadmin og avviser medlem i annet firma (firma-grense); hver endring gir én loggrad | `apps/api/src/routes/__tests__/ansatt.geofence.test.ts` |
| T11 | Server: `minGeofenceInnstilling` returnerer bare egen rad; aldri andres | samme |
| T12 | Web: ansatt-raden viser status fra loggen; vakt at dagskort-komponentene ikke importerer noe fra geofence | web-test |

---

## 9. Utenfor denne specen (ordrepunkt 6)

- Kontinuerlig rute/sporing (`watchPositionAsync`, `startLocationUpdatesAsync`, foreground-service) — forbudt av T2.
- Kilometer som *målt* størrelse (K4 i helhetsplanen står).
- PSI-innsjekk som kilde for timer (`mannskap.md:197`, `arbeidsdagBesok.ts` topptekst) — egen ordre.
- Automatisk «Start dag»/«Slutt dag» eller automatisk besøk uten trykk — hendelsen *foreslår*, den utløser ingen
  statusendring på arbeidsdagen.
- Leder-visning av hendelser, varsling til leder, bruk i attestering.
- Endringer i dagskortet, `syncBatch`, besøksmodellen (S1/S2) eller reisekjedens regler (de er (17) sine).

---

## 10. Beslutningsspørsmål til Kenneth (samlet)

| # | Spørsmål | Anbefaling |
|---|---|---|
| **B1** | **Rettslig grunnlag:** samtykke (art. 6(1)(a)) eller kontrolltiltak (aml. kap. 9)? Prosjektets egne docs (`mannskap.md:40`) fraråder samtykke. Juridisk valg — ikke Fabels. | Appen bygges for begge (§ 6). Spør jurist før G1 settes i produksjon; Fabel anbefaler ingen av dem. |
| **B2** | Skal serveren få vite at tiden er *målt* (`tidKilde='geofence'`), eller bare `stempel` som i dag? | **Bare `stempel`.** Kilden forblir på telefonen (§ 6.5). |
| **B3** | Trenger firmaet en *firma-bryter* (master) i tillegg til pr.-ansatt? | Nei til egen bryter; **ja** til grunnlagstekst + grunnlag på `OrganizationSetting` (§ 6.4), som i praksis må fylles før pr.-ansatt kan slås på. |
| **B4** | Kan arbeideren alltid slå av i appen, også ved kontrolltiltak? | **Ja.** OS-tillatelsen er arbeiderens uansett; firmaet ser status i web. |
| **B5** | Reservesletting: 14 d (som besøk) eller kortere? | **14 d**, én konstant å forholde seg til. |
| **B6** | Soner (polygon) som omskrevet sirkel i OS-geofencen, med S1 (forgrunn) som skarp bekreftelse? | **Ja.** OS tar bare sirkler; forslaget rettes uansett av arbeideren. |
| **B7** | Prioritering ved > 20 kjente steder (§ 2.1, 1–4)? | Som foreslått. Alternativ: la arbeideren velge «mine steder» — mer UI, ikke anbefalt nå. |
| **B8** | Når fyres EAS-bygget (iOS + Android)? Kvote ~15/mnd. | Etter G2-gate, samlet med andre native endringer som venter. Kenneth fyrer. |
| **B9** | Tabellplassering: `OrganizationMember`-kolonner + `GeofenceSamtykkeLogg` i `packages/db` (ansettelsesforhold) eller `db-timer` (timer-modul)? | **`packages/db`** — det gjelder ansettelsen og personvern, ikke lønnsberegning. |
| **B10** | Demping-terskel for kant-flimring: 10 min? | **10 min.** Lavere gir doble hendelser i kanten; høyere mister korte stopp. |

**Første beslutning som låser koding:** B1 (grunnlag) og B9 (plassering) — resten kan tas ved gate som anbefalt.
