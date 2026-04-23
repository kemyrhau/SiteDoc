# Varsling — tverrgående varslingssystem

## Konsept

Tverrgående varslingssystem på **firmanivå** som overvåker frister, utløpsdatoer og servicebehov på tvers av moduler. Firmaadmin konfigurerer hvilke funksjoner som varsles og hvem som mottar varsler. Enkeltbrukere kan slå av varsler for seg selv.

## Kilder

| Kilde | Modul | Hva varsles | Eksempel |
|-------|-------|-------------|----------|
| Kontrollplan-frist | Kontrollplan | Punkt med frist som nærmer seg / er forfalt | "FB2 Graving — Kjeller A: frist uke 20, 2 uker igjen" |
| EU-kontroll | Maskin/utstyr | Kjøretøy med EU-kontroll som utløper | "ZH44186 Volvo V70: EU-kontroll utløper om 45 dager" |
| Service/vedlikehold | Maskin/utstyr | Maskin som nærmer seg service-intervall (km, timer, dato) | "Volvo EC220E: 120 driftstimer til service" |
| Sertifisering | Maskin/utstyr | Utstyr med sertifisering som utløper | "Laser TopCon: kalibrering utløper 15. mai" |

Flere kilder kan legges til: HMS-avvik, sjekkliste-frister, oppgave-frister.

## Arkitektur

### Tre nivåer

```
Firma (Organization)
├── VarslingsRegel[] — hva overvåkes, aktiv/inaktiv
│   ├── Kontrollplan: frist 2 uker før + forfalt
│   ├── EU-kontroll: 3 mnd + 1 mnd + forfalt
│   ├── Service: ved km/timer/dato-grense
│   └── Sertifisering: 1 mnd før utløp
│
├── VarslingsmottakerGruppe[] — hvem får varsler per kilde
│   ├── Kontrollplan → prosjektleder + faggruppe-ansvarlig
│   ├── EU-kontroll → maskinansvarlig + firma-admin
│   └── Service → maskinansvarlig
│
└── BrukerVarslingsPreferanse[] — per bruker
    ├── Globalt av/på
    ├── Per kanal: e-post ✅, push ✅, in-app ✅
    └── Per kilde: kontrollplan ✅, eu-kontroll ❌
```

### Kanaler (prioritert)

1. **In-app** — varselklokke i topplinjen med dropdown (uleste/leste)
2. **E-post** — via Resend (allerede satt opp). Daglig oppsummering eller umiddelbar
3. **Push til mobil** — expo-notifications (fremtidig)

### Oversiktsside

Plassering: **Firmaadministrasjon → Varsling** (firmamodul)

```
┌─────────────────────────────────────────────────────────────┐
│ Varsling                                                     │
│                                                              │
│ Kontrollplan (3 aktive regler)                     [Rediger] │
│   ├── NRK Bjørvika: 5 punkter med frist denne uken          │
│   └── Austadvegen: 2 forfalte                                │
│                                                              │
│ EU-kontroll (12 kjøretøy overvåkes)                [Rediger] │
│   ├── ZH44186 Volvo V70: 45 dager til EU             🟡     │
│   ├── AB12345 VW Crafter: 12 dager til EU            🟠     │
│   └── CD67890 Toyota HiAce: FORFALT                 🔴     │
│                                                              │
│ Service (8 maskiner overvåkes)                     [Rediger] │
│   ├── Volvo EC220E: 120 timer til service            🟡     │
│   └── CAT 320: Service forfalt                      🔴     │
│                                                              │
│ Sertifisering (3 enheter)                          [Rediger] │
│   └── Lasernivå TopCon: utløper 15. mai              🟡     │
│                                                              │
│ Mottakere                                          [Rediger] │
│ 4 brukere mottar varsler, 1 har slått av                     │
│                                                              │
│ Historikk                                    [Vis alle →]    │
│ Siste 24t: 3 e-poster sendt, 7 in-app varsler               │
└─────────────────────────────────────────────────────────────┘
```

### Enhetsnivå — drill down

Klikk "EU-kontroll" → viser alle overvåkede enheter:

```
┌─────────────────────────────────────────────────────────────┐
│ EU-kontroll varsling                               [Tilbake]│
│                                                              │
│ Regler: 3 mnd (gul) → 1 mnd (oransje) → forfalt (rød)     │
│                                                              │
│ ☑ ZH44186  Volvo V70      EU: 15.06.2026  45 dager  🟡    │
│ ☑ AB12345  VW Crafter      EU: 02.05.2026  12 dager  🟠    │
│ ☑ CD67890  Toyota HiAce    EU: FORFALT               🔴    │
│ ☑ EF11111  Ford Transit     EU: 20.09.2026  153 dager 🟢    │
│ ☐ GH22222  Nissan NV400     Deaktivert                      │
│                                                              │
│ [+ Legg til kjøretøy]                   [Fjern avhukede]    │
└─────────────────────────────────────────────────────────────┘
```

Enheter kan deaktiveres (solgt/destruert) uten å slette historikken.

## Datamodell

```prisma
// I packages/db (delt med maskin via Organization)

model VarslingsRegel {
  id              String   @id @default(cuid())
  organizationId  String   @map("organization_id")
  kilde           String   // kontrollplan | eu_kontroll | service | sertifisering
  aktiv           Boolean  @default(true)
  config          Json     // { dagerFor: [90, 30, 0], intervall: "daglig" | "ukentlig" }
  opprettet       DateTime @default(now())

  organization Organization @relation(...)
  mottakere    VarslingsmottakerGruppe[]

  @@unique([organizationId, kilde])
  @@map("varslings_regler")
}

model VarslingsmottakerGruppe {
  id       String @id @default(cuid())
  regelId  String @map("regel_id")
  userId   String @map("user_id")
  kanal    String @default("epost") // epost | push | begge | in_app

  regel    VarslingsRegel @relation(...)
  bruker   User           @relation(...)

  @@unique([regelId, userId])
  @@map("varslings_mottakere")
}

model VarslingLogg {
  id        String   @id @default(cuid())
  regelId   String   @map("regel_id")
  enhetId   String?  @map("enhet_id")   // punkt-id, utstyr-id, etc.
  enhetType String   @map("enhet_type") // kontrollplan_punkt | equipment
  userId    String   @map("user_id")    // mottaker
  kanal     String                      // epost | push | in_app
  type      String                      // frist_narmer_seg | forfalt | service_paaminnelse
  tittel    String
  melding   String
  sendt     DateTime @default(now())
  lest      Boolean  @default(false)
  lestVed   DateTime? @map("lest_ved")

  @@index([userId, lest])
  @@index([regelId])
  @@map("varsling_logg")
}

model BrukerVarslingsPreferanse {
  id     String  @id @default(cuid())
  userId String  @unique @map("user_id")
  aktiv  Boolean @default(true)    // global av/på
  config Json    @default("{}")    // { kanaler: { epost: true, push: true }, kilder: { kontrollplan: true, eu_kontroll: false } }

  bruker User @relation(...)

  @@map("bruker_varslings_preferanser")
}
```

## Cron-jobb

Daglig kl. 07:00 (norsk tid):

1. Hent alle aktive `VarslingsRegel` med mottakere
2. For hver regel:
   - **Kontrollplan:** Finn punkter med `fristUke/fristAar` innenfor varslingsvinduet
   - **EU-kontroll:** Finn utstyr med `euKontrollDato` innenfor varslingsvinduet
   - **Service:** Finn utstyr med km/timer/dato nær service-grense
   - **Sertifisering:** Finn utstyr med sertifisering som utløper
3. Sjekk `VarslingLogg` — ikke send duplikat for samme enhet+type+dag
4. Sjekk `BrukerVarslingsPreferanse` — respekter brukerens valg
5. Send via valgt kanal (e-post/push/in-app)
6. Logg i `VarslingLogg`

## In-app varselklokke

Topplinjen i web-appen:

```
[🔔 3]  ← rødt tall = uleste varsler
```

Klikk → dropdown:
```
┌──────────────────────────────────────────┐
│ Varsler                     [Merk alle ✓]│
│──────────────────────────────────────────│
│ 🔴 EU-kontroll forfalt                   │
│    Toyota HiAce CD67890                  │
│    i går                                 │
│──────────────────────────────────────────│
│ 🟡 Kontrollplan-frist                    │
│    FB2 Graving — Kjeller A               │
│    frist uke 20, 2 uker igjen            │
│    2 timer siden                         │
│──────────────────────────────────────────│
│ 🟡 Service påminnelse                    │
│    Volvo EC220E: 120 timer til service   │
│    i dag                                 │
└──────────────────────────────────────────┘
```

## Implementeringsrekkefølge

1. DB-tabeller (VarslingsRegel, VarslingsmottakerGruppe, VarslingLogg, BrukerVarslingsPreferanse)
2. tRPC-router: CRUD regler, mottakere, preferanser, hent uleste
3. In-app varselklokke (web) — VarslingLogg-polling
4. E-postvarsling — Resend-integrasjon med daglig cron
5. Oversiktsside i Firmaadministrasjon
6. Enhetsnivå drill-down
7. Brukerpreferanser (innstillinger-side)
8. Push til mobil (fremtidig)

## Forutsetninger

- **Maskin/utstyr-modulen** må bygges først — EU-kontroll, service, sertifisering-data finnes ikke ennå
- **Kontrollplan** er klar — punkter med frister finnes
- **Firmaadministrasjon** er delvis designet — varsling blir en firmamodul
- **Resend** er satt opp — e-postsending fungerer allerede for invitasjoner

## Utstyr-livssyklus

Utstyr legges til → overvåkes → solgt/destruert:
- `equipment.status`: aktiv | inaktiv | solgt | destruert
- Ved statusendring til solgt/destruert: deaktiver varsling, behold historikk
- Oversiktssiden viser kun aktive enheter, med filter for å se inaktive
