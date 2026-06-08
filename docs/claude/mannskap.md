---
status: under_arbeid
sist_verifisert_mot_kode: 2026-04-28
sist_endret: 2026-06-08
gjelder_versjon: Fase 4
avhenger_av:
  - arkitektur.md
  - terminologi.md
  - arkitektur-syntese.md
påvirkes_av_beslutninger:
  - A.7
  - A.11
---

# Mannskapsregistrering

> **🟢 Vy i PSI-modulen, ikke separat modul** (per CLAUDE.md § Tre nivåer-anker, korrigert 2026-04-28). PSI utvides i Fase 4 med innsjekk/utsjekk-mekanikk; mannskaps-vyen aggregerer disse tilstedeværelses-dataene per byggeplass. Endelig datamodell designes som del av PSI-utvidelse i Fase 4.

## Formål

Elektronisk oversiktsliste per byggeplass — hvem er på plassen, med hvilket firma, med hvilket HMS-kort. Oppfyller byggherreforskriften §15 og er koblingspunktet mellom PSI, HMS, timer og maskin.

**Primær daglig nytte: katastrofe-mønstring** — vite hvem som er inne på anlegget hvis ulykke/brann/evakuering inntreffer. §15-rapportering til Arbeidstilsynet er den lovpålagte rammen som rammer inn datasamlingen, ikke daglig bruk.

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

Vy i PSI-modulen i hovedappen (`packages/db`) — ikke isolert app, ikke separat modul. PSI-modulen eier tilstedeværelses-data; mannskaps-vyen aggregerer per byggeplass. Trenger FK fra fremtidige PSI-utvidelser til User, Project, Byggeplass, Faggruppe.

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

> **🟢 Datamodell designes i Fase 4** som del av PSI-utvidelse for innsjekk/utsjekk. Tidligere foreslåtte modeller (`Mannskapsmedlem`, `MannskapsInnsjekk` i `packages/db`) er forkastet per memory `feedback_mannskap_er_user`: «User + ProjectMember + innsjekk er nok». Egen `Mannskapsmedlem`-tabell duplisererer User-data og er overflødig. Eksisterende `PsiSignatur`-mønster (userId nullable + guestName/guestCompany/guestPhone i `schema.prisma:1142-1169`) er presedens for hvordan «person på byggeplass» modelleres når det er en blanding av ansatte og ad-hoc gjester.

### Lovpålagte felter (byggherreforskriften §15)

| §15-bokstav | Felt | Plassering (forventet, ikke designet) |
|---|---|---|
| §15 a | Byggeplass-identifikator | `Byggeplass` (Fase 0.5) |
| §15 b | Byggherre-navn + org.nr | `ProjectOrganization` (Fase 0) med `rolle = "byggherre"` |
| §15 c-d | Virksomheter på plassen + org.nr | `ProjectOrganization` med ulike `rolle`-verdier |
| §15 e | Navn | `User.name` (eksisterende) eller guestName-felt på fremtidig tilstedeværelses-tabell |
| §15 e | Fødselsdato | Nytt felt på `User` (krevet av §15) |
| §15 e | HMS-kortnummer | `User.hmsKortNr` (Fase 0 per A.7) |
| §15 e | Arbeidsgiver | Utledet fra `User.organizationId` eller guestCompany-felt |

### Tillegg utenfor §15 (berettiget interesse + dataminimalisering A.11)

- **Telefon** (HMS-varsling, katastrofe-kontakt) — `User.phone` (eksisterende) eller guestPhone-felt
- **E-post** (kommunikasjon) — `User.email` (eksisterende)
- **Faggruppe-tilknytning** — `FaggruppeKobling` (eksisterende)
- **Nasjonalitet** (allmenngjort tariffavtale) — nytt felt på `User` per A.11
- **Arbeidstillatelse + utløpsdato** (utenlandske arbeidere) — nytt felt på `User` per A.11

### Tilstedeværelse-data (innsjekk/utsjekk)

Designes i Fase 4 som del av PSI-modul-utvidelse. Forventet datapunkter: `medlem-referanse` (userId nullable + gjeste-felter per PsiSignatur-mønster), `byggeplass-referanse`, `innsjekkTid`, `utsjekkTid?` (null = fortsatt på plassen), `kilde` (geofence/qr/app/manuell), `autoUtlogget` (boolean for 12t-policy). Eksakt modell-plassering (utvid `PsiSignatur`, ny `PsiTilstedevarelse`-tabell, eller annet) vurderes når Fase 4 starter.

> **🔒 Fra/til feltnivå-isolasjon (anker, 2026-06-08 — § E i [OPPSUMMERING-timer-arkitektur.md](OPPSUMMERING-timer-arkitektur.md)):** Byggherres §15-behov (hvem er på plassen) dekkes av **PSI-tilstedeværelse — aldri av timer/fra-til**. Selv om PSI er prosjekt-scopet, er innsjekk/utsjekk-*tidspunkt* (`innsjekkTid`/`utsjekkTid`) **firma-isolert på feltnivå**: byggherre OG byggherres SHA-KU ser **aggregert §15-tilstedeværelse** (navn/arbeidsgiver/HMS-kort), **ikke klokkeslett**. Faren å unngå: at noen senere dekker byggherres mannskaps-behov ved å lekke timer/fra-til — svaret er alltid PSI-tilstedeværelse. Se også [arkitektur-syntese.md § 3.4](arkitektur-syntese.md) + [terminologi.md § 0](terminologi.md).

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

Per 1D-anker er mannskap-funksjonaliteten en vy i PSI-modulen. PSI eier tilstedeværelses-data (innsjekk/utsjekk-mekanikk designes i Fase 4); mannskaps-vyen aggregerer per byggeplass. PSI-gjennomføring (i SiteDoc eller eksternt system per `eksternSystem`-felt) er forutsetning for førstegangs-tilstedeværelses-registrering. HMS-kortnummer synkroniseres mellom PsiSignatur (snapshot per A.7) og fremtidig tilstedeværelses-modell.

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
