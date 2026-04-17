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
  kilde           String    @default("app")           // app | qr | manuell
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

## Innsjekk-flyt

### Førstegangregistrering

```
Person ankommer byggeplass for første gang:
  1. Scanner QR-kode ved porten (samme URL som PSI: /psi/[prosjektId])
  2. System: "Velkommen. Registrer deg for tilgang til byggeplassen."
  3. Fyller ut:
     - Navn, fødselsdato
     - HMS-kortnummer (eller "har ikke HMS-kort")
     - Firma/arbeidsgiver
     - Telefon, e-post (valgfritt)
  4. System sjekker: Har du gjennomført PSI for denne byggeplassen?
     → Nei: Gjennomfør PSI nå (eksisterende flyt)
     → Ja: Gå til innsjekk
  5. Mannskapsmedlem opprettet + innsjekket på byggeplass
```

### Daglig innsjekk (etter førstegang)

```
Person ankommer byggeplass:
  1. Scanner QR / åpner app / taster HMS-kortnr
  2. System gjenkjenner personen
  3. Sjekk:
     - PSI gyldig? (ikke utløpt versjon)
     - HMS-kort registrert?
  4. Innsjekket → synlig i mannskap-oversikt

Person forlater:
  5. Sjekker ut (manuelt) ELLER auto-utsjekk ved midnatt
```

### Innsjekk-metoder

| Metode | Beskrivelse | Hvem |
|--------|-------------|------|
| **QR-scan** | Scanner QR-plakat ved porten → identifiserer seg | Gjester, UE-ansatte |
| **App** | Trykker "Sjekk inn" i SiteDoc-appen | SiteDoc-brukere |
| **HMS-kortnr** | Taster kortnummer på terminal/nettbrett | Alle |
| **Manuell** | Prosjektleder registrerer person | Nødsituasjon, besøkende |

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

PSI-gjennomføring er **forutsetning** for første innsjekk. Flyten:
1. Person registrerer seg (mannskap) → Mannskapsmedlem opprettes
2. System sjekker PsiSignatur for denne personen + byggeplass
3. Ingen signatur → "Gjennomfør PSI først" → PSI-flyten
4. Signatur finnes → innsjekk tillatt

HMS-kortnummer synkroniseres: registrert i mannskap → kopieres til PsiSignatur (eller omvendt, avhengig av hva som skjer først).

### Timer (fremtidig)

Innsjekk-tidspunkt kan brukes som **forslag** til arbeidsstart i dagsseddelen:
- Innsjekket 07:12 → dagsseddel foreslår start 07:00
- Utsjekket 15:30 → dagsseddel foreslår slutt 15:30
- Ikke en erstatning for timer — kun et forslag

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

1. **DB-tabeller + modul-registrering** — Mannskapsmedlem, MannskapsInnsjekk + slug i PROSJEKT_MODULER
2. **Registrering + mannskap-oversikt** — liste over registrerte, HMS-kort-status
3. **Innsjekk/ut** — daglig registrering med sanntidsoversikt
4. **QR-innsjekk for gjester** — utvid PSI-QR til også dekke innsjekk
5. **§15-liste eksport** — PDF/Excel i lovpålagt format
6. **Historikk** — ukesvisning, persondager, statistikk
7. **Kobling til PSI** — forutsetning-sjekk ved innsjekk
8. **Auto-sletting** — cron-jobb: slett data 6 mnd etter prosjektslutt
9. **Kobling til timer** — foreslå arbeidstid basert på innsjekk
10. **Kobling til maskin** — fører + maskin innsjekk

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
- **Integrasjon mot Infobric/HMSREG** — eksisterende mannskapsliste-systemer i bransjen
- **Automatisk varsel ved utløpt HMS-kort** — push til prosjektleder
- **Besøkende uten HMS-kort** — egen gjestekategori med tidsbegrensning?
- **Mønstringsøvelse-modus** — varsle alle innsjekkede, bekreft at alle er gjort rede for
