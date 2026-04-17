# Mannskapsregistrering

## Formål

Elektronisk oversiktsliste per byggeplass — hvem er på plassen, med hvilket firma, med hvilket HMS-kort. Oppfyller byggherreforskriften §15 og er koblingspunktet mellom PSI, HMS, timer og maskin.

## Lovgrunnlag

| Lov/forskrift | Paragraf | Krav | SiteDoc-funksjon |
|---------------|----------|------|------------------|
| Byggherreforskriften | §15 | Elektronisk oversiktsliste, daglig oppdatert | Innsjekk/ut per byggeplass |
| Byggherreforskriften | §15 a-e | Navn, fødselsdato, HMS-kortnr, arbeidsgiver, org.nr | Mannskapsregistrering |
| Forskrift om HMS-kort | §4, §7 | Alle på bygge-/anleggsplass skal ha HMS-kort, synlig | HMS-kort-validering ved innsjekk |
| GDPR art. 6(1)(c) | Rettslig forpliktelse | Behandlingsgrunnlag for registrering | Ikke samtykke — lovpålagt |
| GDPR art. 5(1)(e) | Lagringsbegrensning | Slettes når formålet er oppnådd | 6 mnd etter prosjektslutt |

### Personvern — regler

- **Behandlingsgrunnlag:** Rettslig forpliktelse (GDPR art. 6(1)(c)) — byggherreforskriften §15 pålegger registrering
- **Samtykke ikke nødvendig** og ikke anbefalt (arbeidsgiver/ansatt-relasjon gjør samtykke ufritt iht. Datatilsynet)
- **Dataminimering:** Kun felt som §15 krever + telefon/e-post for HMS-varsling (berettiget interesse art. 6(1)(f))
- **Oppbevaring:** 6 måneder etter prosjektslutt — deretter automatisk sletting
- **Tilgang:** Prosjektleder, verneombud, Arbeidstilsynet, skattemyndigheter
- **Databehandleravtale:** SiteDoc er databehandler — DPA med byggherre (behandlingsansvarlig)
- **Aldri registrer:** Personnummer, GPS-posisjon til person, helsedata, fagforeningstilhørighet

## Arkitektur

Prosjektmodul i hovedappen (`packages/db`) — ikke isolert app. Trenger FK til User, Project, Byggeplass, Faggruppe, Psi.

```
┌─────────────────────────────────────────────────────────────────┐
│                    MANNSKAPSREGISTRERING                          │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │    PSI       │  │  HMS-kort    │  │  Innsjekk/ut         │   │
│  │  Gjennomført?│  │  Gyldig?     │  │  Hvem er her nå?     │   │
│  │  (forutsetn.)│  │  (validering)│  │  (daglig liste)      │   │
│  └──────┬───────┘  └──────┬───────┘  └────────��─┬───────────┘   │
│         │                 │                      │               │
│         └─────────────────┼──────────────────────┘               │
│                           │                                      │
│                           ▼                                      │
│         ┌─────────────────────────────────────┐                 │
│         │         Mannskap-oversikt            │                 │
│         │  Per byggeplass, sanntid             │                 │
│         │  Eksport: §15-liste, PDF, Excel     │                 │
│         └──────────────┬──────────────────────┘                 │
│                        │                                         │
│         ┌──────────────┼──────────────────────┐                 │
│         ▼              ▼                      ▼                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────────────┐          │
│  │   Timer    │ │   Maskin   │ │  Varsling/mønstring │          │
│  │  Arbeids-  │ │  Fører +   │ │  Brannøvelse,      │          │
│  │  dag start │ │  maskin    │ │  evakuering         │          │
│  └────────────┘ └────────────┘ └────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Datamodell

### Mannskapsmedlem — person registrert på prosjektet

```prisma
model Mannskapsmedlem {
  id              String    @id @default(cuid())
  projectId       String    @map("project_id")
  userId          String?   @map("user_id")         // SiteDoc-bruker (null for gjester)
  navn            String                             // §15: påkrevd
  fodselsdato     DateTime  @map("fodselsdato")      // §15: påkrevd (kun dato, ikke personnr)
  hmsKortNr       String?   @map("hms_kort_nr")      // §15: påkrevd (kan mangle midlertidig)
  hmsKortGyldigTil DateTime? @map("hms_kort_gyldig_til")
  telefon         String?                            // Berettiget interesse: HMS-varsling
  epost           String?                            // Berettiget interesse: kommunikasjon
  faggruppeId     String?   @map("faggruppe_id")     // Kobling til faggruppe (arbeidsgiver)
  firmaNavn       String?   @map("firma_navn")       // §15: arbeidsgiver (fritekst for gjester)
  firmaOrgNr      String?   @map("firma_org_nr")     // §15: org.nr
  rolle           String?                            // Stilling/funksjon (valgfri)
  aktiv           Boolean   @default(true)           // Deaktiver ved prosjektslutt
  opprettet       DateTime  @default(now())

  project         Project    @relation(fields: [projectId], references: [id])
  bruker          User?      @relation(fields: [userId], references: [id])
  faggruppe       Faggruppe? @relation(fields: [faggruppeId], references: [id])
  innsjekker      MannskapsInnsjekk[]

  @@unique([projectId, hmsKortNr])    // Én registrering per HMS-kort per prosjekt
  @@index([projectId])
  @@index([userId])
  @@map("mannskap_medlemmer")
}
```

### MannskapsInnsjekk — daglig inn/ut

```prisma
model MannskapsInnsjekk {
  id              String    @id @default(cuid())
  medlemId        String    @map("medlem_id")
  byggeplassId    String    @map("byggeplass_id")
  innsjekkTid     DateTime  @default(now()) @map("innsjekk_tid")
  utsjekkTid      DateTime? @map("utsjekk_tid")      // Null = fortsatt på plassen
  kilde           String    @default("app")           // app | qr | manuell | geofence
  autoUtlogget    Boolean   @default(false) @map("auto_utlogget") // True = 12t auto-utsjekk
  opprettet       DateTime  @default(now())

  medlem          Mannskapsmedlem @relation(fields: [medlemId], references: [id])
  byggeplass      Byggeplass      @relation(fields: [byggeplassId], references: [id])

  @@index([medlemId])
  @@index([byggeplassId, innsjekkTid])
  @@map("mannskap_innsjekker")
}
```

### Relasjoner til eksisterende modeller

```
Mannskapsmedlem
  ├──→ Project (prosjektisolering)
  ├──→ User? (SiteDoc-bruker, null for gjester)
  ├──→ Faggruppe? (arbeidsgiver i prosjektet)
  └��─1:N→ MannskapsInnsjekk
              └──→ Byggeplass (hvor)

PsiSignatur (eksisterende)
  └── hmsKortNr ← kobles til Mannskapsmedlem.hmsKortNr
```

## Komplett flyt — PSI → Mannskap → Innsjekk

### Steg 1: PSI-gjennomføring (forutsetning)

PSI kan gjennomføres i SiteDoc eller i et eksternt system. Prosjektleder konfigurerer dette per byggeplass i PSI-innstillingene:

```
PSI-innstillinger for [Blokk A]:
  ○ PSI gjennomføres i SiteDoc (standard)
  ● PSI gjennomføres i eksternt system
    Systemnavn: [HMSREG                    ]
```

Når eksternt system er valgt:
- PSI-gjennomføring i SiteDoc kreves **ikke** for innsjekk
- Mannskapsregistrering fungerer fortsatt (§15-listen føres i SiteDoc)
- I mannskap-oversikten vises: "PSI: HMSREG" i stedet for grønn hake
- Ansvaret for PSI-dokumentasjon ligger hos det eksterne systemet

**Prisma-felt på Psi-modellen:**
```prisma
// Legg til på eksisterende Psi-modell:
  eksternSystem     String?   @map("ekstern_system")  // null = SiteDoc, "HMSREG", "Infobric" etc.
```

### Steg 2: Mannskapsregistrering (én gang per prosjekt)

Etter godkjent PSI (i SiteDoc eller eksternt) registrerer personen seg i mannskapslisten:

```
Person ankommer byggeplass for første gang:
  1. Scanner QR-kode ved porten (samme URL som PSI: /psi/[prosjektId])
  2. System sjekker: PSI gjennomført?
     → SiteDoc-PSI: sjekk PsiSignatur
     → Eksternt system: hopp over (ansvar ligger hos eksternt system)
     → Ikke gjennomført: "Gjennomfør PSI først" → PSI-flyten
  3. System: "Registrer deg for tilgang til byggeplassen."
  4. Fyller ut:
     - Navn, fødselsdato
     - HMS-kortnummer (eller "har ikke HMS-kort")
     - Firma/arbeidsgiver
     - Telefon, e-post (valgfritt)
  5. Mannskapsmedlem opprettet + innsjekket på byggeplass
```

### Steg 3: Daglig innsjekk — geofence + bekreftelse

Etter førstegangsregistrering skjer daglig innsjekk automatisk via geofence:

```
Appen kjører i bakgrunnen:
  → GPS oppdager at bruker er innenfor byggeplassens område
  → Push-varsel / modal:

  ┌──────────────────────────────────┐
  │  📍 Du er ved Blokk A            │
  │                                  │
  │  Logg inn på byggeplassen?       │
  │                                  │
  │  [Logg inn]          [Ikke nå]   │
  └──────────────────────────────────┘

  → Bruker bekrefter → innsjekket (kilde: "geofence")
  → Synlig i mannskap-oversikt
```

**Utsjekk — tre mekanismer:**

```
1. Geofence: Bruker forlater området
   ┌──────────────────────────────────┐
   │  📍 Du har forlatt Blokk A       │
   │                                  │
   │  Logg ut fra byggeplassen?       │
   │                                  │
   │  [Logg ut]           [Ikke nå]   │
   └──────────────────────────────────┘

2. Manuell: Bruker trykker "Logg ut" i appen

3. Automatisk etter 12 timer:
   → Innsjekk 07:12, ingen utsjekk → 19:12 auto-utsjekk
   → Push-varsel: "Du ble automatisk logget ut fra Blokk A etter 12 timer"
   → MannskapsInnsjekk.autoUtlogget = true
   → Synlig i historikken som auto-utlogget (prosjektleder kan se hvem som glemte)
```

**Aldri** automatisk innsjekk uten bekreftelse — GPS foreslår, brukeren bestemmer.

### Innsjekk-metoder

| Metode | Beskrivelse | Hvem | Kilde |
|--------|-------------|------|-------|
| **Geofence** | App oppdager posisjon → bruker bekrefter | SiteDoc-brukere med app | `geofence` |
| **QR-scan** | Scanner QR-plakat ved porten | Gjester, UE-ansatte | `qr` |
| **App** | Trykker "Logg inn" manuelt i appen | SiteDoc-brukere | `app` |
| **HMS-kortnr** | Taster kortnummer på terminal/nettbrett | Alle | `qr` |
| **Manuell** | Prosjektleder registrerer person | Nødsituasjon, besøkende | `manuell` |

### Geofence — teknisk

Byggeplassens geofence-område utledes fra:
1. **Georefererte tegninger** — tegningens bounding box i lat/lon (beste presisjon)
2. **Byggeplass-adresse** — geocodet til lat/lon + radius (fallback, grovere)

Appen bruker `expo-location` med geofence-monitoring (bakgrunnsposisjon). Batteribruk holdes lav ved å bruke `significantLocationChanges` i stedet for kontinuerlig GPS.

```typescript
// Forenklet — expo-location geofence
Location.startGeofencingAsync("BYGGEPLASS_GEOFENCE", [
  { latitude: 59.907, longitude: 10.757, radius: 200 }, // Blokk A
  { latitude: 59.912, longitude: 10.760, radius: 150 }, // Blokk B
]);
```

## Mannskap-oversikt (UI)

### Sanntidsvisning ��� hvem er her nå?

```
┌─────────────────────────────────────────────────────────────────┐
│  Mannskap                         Byggeplass: [Blokk A ▾]       │
│                                                                  │
│  På plassen nå: 23 personer          [+ Registrer person]       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                  │
│  Filter: [Alle firmaer ▾]  [Søk navn/HMS-nr...]                │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Navn              Firma           HMS-kort   Inn    Ut    │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ Ola Hansen        VVS-Rør AS      NO 1234567 07:12  —    │  │
│  │ Trude Berg        Betong AS       NO 2345678 07:30  —    │  │
│  │ Per Nilsen        Elektro AS      NO 3456789 08:15  —    │  │
│  │ Anna Johansen     Tømrer AS       ⚠ mangler  08:45  —    │  │
│  │ Lars Olsen        VVS-Rør AS      NO 4567890 07:12 15:30 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ⚠ 1 person uten gyldig HMS-kort                                │
│                                                                  │
│  [Eksporter §15-liste]  [Skriv ut PDF]  [Mønstringsliste]      │
└─────────────────────────────────────────────────────────────────┘
```

### Historikk — hvem var her denne uken?

```
┌─────────────────────────────────────────────────────────────────┐
│  Mannskapshistorikk          Uke 16, 2026    [◀ uke 15 | 17 ▶] │
│                                                                  │
│  ┌──────────────┬────┬────┬────┬────┬────┬────────────────────┐ │
│  │ Navn         │ Ma │ Ti │ On │ To │ Fr │ Timer (sum)        │ │
│  ├──────────────┼────┼────┼────┼────┼────┼────────────────────┤ │
│  │ Ola Hansen   │ ✓  │ ✓  │ ✓  │ ✓  │ ✓  │ 5 dager            │ │
│  │ Trude Berg   │ ✓  │ ✓  │ —  │ ✓  │ ✓  │ 4 dager            │ │
│  │ Per Nilsen   │ —  │ ✓  │ ✓  │ ✓  │ —  │ 3 dager            │ │
│  └──────────────┴────┴────┴────┴────┴────┴────────────────────┘ │
│                                                                  │
│  Totalt: 14 unike personer, 58 persondager                       │
└─────────────────────────────────────────────────────────────────┘
```

## §15-liste — eksport (lovpålagt format)

```
┌─────────────────────────────────────────────────────────────────┐
│  ELEKTRONISK OVERSIKTSLISTE — Byggherreforskriften §15           │
│                                                                  │
│  a) Byggeplass:    NRK Bjørvika, Blokk A                        │
│     Adresse:       Operagata 12, 0194 Oslo                       │
│  b) Byggherre:     NRK AS                                        │
│  c-d) Virksomheter:                                              │
│                                                                  │
│  ┌──────────────────────���─┬���─────────────┐                      │
│  │ Virksomhet             │ Org.nr       │                      │
│  ├────────────────────────┼──────────────┤                      │
│  │ VVS-Rør AS             │ 912 345 678  │                      │
│  │ Betong AS              │ 923 456 789  │                      │
│  │ Elektro AS             │ 934 567 890  │                      │
│  └────────────────────────┴──────────────┘                      │
│                                                                  │
│  e) Arbeidstakere på plassen [dato]:                             │
│                                                                  │
│  ┌──────────────────┬────────────┬───────────┬────────────────┐ │
│  │ Navn             │ Fødselsdato│ HMS-kort  │ Arbeidsgiver   │ │
│  ├──────────────────┼────────────┼───────────┼────────────────┤ │
│  │ Ola Hansen       │ 12.03.1985 │ NO 1234567│ VVS-Rør AS     │ │
│  │ Trude Berg       │ 04.09.1990 │ NO 2345678│ Betong AS      │ │
│  │ Per Nilsen       │ 22.11.1978 │ NO 3456789│ Elektro AS     │ │
│  │ Anna Johansen    │ 15.06.1995 │ Søkt*     │ Tømrer AS      │ │
│  └──────────────────┴────────────┴───────────┴────────────────┘ │
│                                                                  │
│  * Arbeidsgiver har dokumentert pågående søknad om HMS-kort      │
│                                                                  │
│  Generert: 17.04.2026 14:32                                     │
│  Oppbevares i 6 måneder etter prosjektslutt.                    │
└─────────────────────────────────────────────────────────────────┘
```

## Kobling til andre moduler

### PSI (eksisterende)

Se "Komplett flyt" over. PSI-gjennomføring (i SiteDoc eller eksternt system) er forutsetning for mannskapsregistrering. HMS-kortnummer synkroniseres mellom PsiSignatur og Mannskapsmedlem.

### Timer (separat — ingen automatisk kobling)

Innsjekk-tidspunkt skal **ikke** brukes som forslag til arbeidstid. Tilstedeværelse på byggeplass ≠ arbeidstid:
- Reisetid fra oppmøtested til byggeplass er ikke arbeidstid (men kan være betalt reisetid)
- Pauser inne i geofence er ikke arbeidstid
- Arbeidstidsordninger varierer mellom firmaer og prosjekter

Timer-modulen står på egne ben. Mannskapsregistrering er HMS/§15, ikke tidsregistrering.

### Maskin (fremtidig)

Fører sjekker inn maskin + seg selv samtidig:
- Person-innsjekk → MannskapsInnsjekk
- Maskin-innsjekk → vehicle_assignments (maskin tilordnet byggeplass)
- Kobling: MannskapsInnsjekk + vehicleId i samme handling

### Varsling / mønstring

Mannskap-oversikten er **mønstringslisten** ved brannøvelse eller ulykke:
- "Hvem er på plassen akkurat nå?" → sanntidsliste
- Eksporter PDF med navn og firma → gi til brannvesen/redning
- Forutsetter at folk faktisk sjekker inn/ut

## Prosjektmodul

```typescript
// packages/shared/src/types/index.ts — PROSJEKT_MODULER
{
  slug: "mannskap",
  navn: "Mannskapsregistrering",
  beskrivelse: "Elektronisk oversiktsliste iht. byggherreforskriften §15. Innsjekk, HMS-kort, mannskap-oversikt.",
  kategori: "funksjon",
  ikon: "Users",
  maler: [],
}
```

Vises i Innstillinger > Produksjon > Moduler. Når aktivert → "Mannskap"-fane i dashbordet.

## API-ruter

| Rute | Type | Auth | Beskrivelse |
|------|------|------|-------------|
| `mannskap.registrer` | mutation | verifiserProsjektmedlem | Registrer ny person på prosjektet |
| `mannskap.oppdater` | mutation | verifiserProsjektmedlem | Oppdater HMS-kort, kontaktinfo |
| `mannskap.hentForProsjekt` | query | verifiserProsjektmedlem | Alle registrerte per prosjekt |
| `mannskap.hentPåPlassen` | query | verifiserProsjektmedlem | Hvem er innsjekket nå (per byggeplass) |
| `mannskap.sjekkInn` | mutation | protectedProcedure | Sjekk inn på byggeplass |
| `mannskap.sjekkUt` | mutation | protectedProcedure | Sjekk ut fra byggeplass |
| `mannskap.hentHistorikk` | query | verifiserProsjektmedlem | Innsjekk-historikk for periode |
| `mannskap.eksporter15Liste` | query | verifiserProsjektmedlem | §15-liste som strukturert data (for PDF) |
| `mannskap.guestSjekkInn` | mutation | public | Gjest sjekker inn via QR (etter PSI) |
| `mannskap.guestSjekkUt` | mutation | public | Gjest sjekker ut |

## Filstruktur

```
apps/web/src/app/dashbord/[prosjektId]/mannskap/     ← mannskap-oversikt
apps/web/src/components/mannskap/                     ← sanntidsliste, historikk, eksport
apps/api/src/routes/mannskap.ts                       ← tRPC-ruter
packages/pdf/src/mannskap.ts                          ← §15-liste PDF
```

## Implementeringsrekkefølge

1. **PSI: ekstern system-felt** — `eksternSystem` på Psi-modellen, UI i PSI-innstillinger
2. **DB-tabeller + modul-registrering** — Mannskapsmedlem, MannskapsInnsjekk + slug i PROSJEKT_MODULER
3. **Registrering + mannskap-oversikt** — liste over registrerte, HMS-kort-status, sanntid
4. **PSI-kobling** — forutsetning-sjekk ved registrering (SiteDoc eller eksternt)
5. **Innsjekk/ut via app og QR** — manuell innsjekk + gjest-innsjekk via QR
6. **Geofence-innsjekk** — expo-location bakgrunnsposisjon, push-forslag, brukerbekreftelse
7. **Auto-utsjekk 12 timer** — cron/timer, push-varsel, flagg i historikk
8. **§15-liste eksport** — PDF/Excel i lovpålagt format
9. **Historikk** — ukesvisning, persondager, statistikk
10. **Auto-sletting GDPR** — cron-jobb: anonymiser data 6 mnd etter prosjektslutt
11. **Kobling til maskin** — fører + maskin innsjekk

## Automatisk sletting (GDPR)

Cron-jobb som kjører daglig:
```
For hvert prosjekt med status "avsluttet":
  Hvis avsluttetDato + 6 måneder < i dag:
    Slett alle MannskapsInnsjekk for prosjektet
    Anonymiser Mannskapsmedlem (fjern navn, fødselsdato, HMS-kort, telefon, e-post)
    Logg sletting i audit trail
```

Anonymisering i stedet for full sletting — beholder aggregerte tall (antall persondager) uten personopplysninger.

## Ikke avklart

- **NFC-støtte for HMS-kort** — fysisk scanning av kortet (krever NFC-hardware på terminal)
- **Integrasjon mot Infobric/HMSREG** — import/eksport av mannskapslister, synkronisering
- **Automatisk varsel ved utløpt HMS-kort** — push til prosjektleder
- **Besøkende uten HMS-kort** — egen gjestekategori med tidsbegrensning?
- **Mønstringsøvelse-modus** — varsle alle innsjekkede, bekreft at alle er gjort rede for
- **Geofence-presisjon** — radius per byggeplass (konfigurerbart?) vs fast 200m
- **Batteribruk** — bakgrunnsposisjon tapper batteri, balanser frekvens vs presisjon
