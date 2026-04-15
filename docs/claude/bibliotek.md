# Sjekklistebibliotek

Globalt arkiv med sjekklister basert på NS 3420-standarden. Prosjekter velger maler fra biblioteket — valgte maler importeres som vanlige SjekklisteMaler (ReportTemplate + ReportObjects), fullt redigerbare i malbyggeren.

## Flyt

```
Sentralbibliotek (globalt, kun sitedoc_admin)
  → Prosjekt velger mal (checkbox i BibliotekPanel)
    → ReportTemplate + ReportObjects opprettes i prosjektet
      → Vanlig sjekklistemal — redigerbar i malbygger
        → Valgfritt: kobles til kontrollplan eller dokumentflyt
```

## Datamodell

```
BibliotekStandard  (NS3420-K, NS3420-F, ...)
  └── BibliotekKapittel  (KA, KB, KC, KD, ...)
        └── BibliotekMal  (KB2 – Jordarbeider, KD1 – Utendørsbelegg, ...)
              │  malInnhold: JSON — feltdefinisjoner
              └── ProsjektBibliotekValg  (prosjektId + sjekklisteMalId)
```

### BibliotekMal.malInnhold (JSON)

Array av feltdefinisjoner som konverteres til ReportObjects ved import:

```json
[
  {
    "label": "Underlagskontroll",
    "type": "list_single",
    "zone": "datafelter",
    "fase": "FØR",
    "sortOrder": 1,
    "config": {
      "options": ["Godkjent", "Godkjent med merknad", "Ikke godkjent"],
      "helpText": "KB2 c2: Hardpakket undergrunnsjord skal løses."
    }
  }
]
```

## Regler

### Kun malbygger-objekter

**Alle felt i bibliotek-maler MÅ bruke eksisterende ReportObject-typer.** Ingen egne felttyper. Ved import konverteres malInnhold direkte til ReportObjects — det som ikke er en gyldig type vises som "Ukjent felttype" i sjekklisten.

Gyldige typer for bibliotek-maler:
- `traffic_light` — grønn/gul/rød (har vedlegg innebygd, ALDRI lag separate vedlegg-felt)
- `list_single` — nedtrekksmeny med forhåndsdefinerte valg
- `decimal` — desimaltall med enhet, min, maks, toleranse
- `heading` — seksjonstittel (brukes for FØR/UNDER/ETTER-overskrifter)
- `text_field` — fritekst

**IKKE bruk:** `info_text` (vises som "Ukjent felttype"), `attachments` (redundant — trafikklys har vedlegg), `list_multi`, `integer`.

### Hjelpetekst i config.helpText

NS 3420-referanser og forklaringer legges inn som `helpText` i feltets config — **ALDRI som separate felt**. Hjelpeteksten vises under feltetiketten i malbyggeren og sjekklisten.

God hjelpetekst:
- Refererer til spesifikk paragraf/tabell (f.eks. "Tabell K4", "KB2.2 c1")
- Oppgir konkrete krav og toleranser (f.eks. "maks ±30 mm", "minimum 2 %")
- Er kort og presis — én til to setninger

### Smarte nedtrekksmenyer

Bruk `list_single` med informative valg i stedet for trafikklys der det finnes flere spesifikke utfall. Valgene skal:
- Inkludere kravet i teksten (f.eks. "Grasplen (15 cm vekstjord)")
- Dekke alle relevante scenarier inkludert avvik
- Redusere antall separate felt (ett valg i stedet for flere trafikklys)

### Fase-gruppering

Felt grupperes under FØR/UNDER/ETTER-overskrifter. Importfunksjonen oppretter automatisk `heading`-felt for hver fase. Bruk `fase`-property i malInnhold:
- `"FØR"` — kontroll før utførelse
- `"UNDER"` — kontroll under utførelse
- `"ETTER"` — kontroll etter utførelse

### Kompakte maler

Hold malene korte og effektive. Maks ~10 felt per mal. Foretrekk én nedtrekk med 4 valg fremfor 4 separate trafikklys-felt. Informasjon inn i hjelpetekst, ikke i egne felt.

## Filstruktur

```
packages/db/prisma/
├── schema.prisma                    # BibliotekStandard, BibliotekKapittel, BibliotekMal, ProsjektBibliotekValg
├── seed-bibliotek.ts                # NS 3420-K seed-data (kjør: npx tsx prisma/seed-bibliotek.ts)
└── migrations/20260415200000_.../   # Migrering

apps/api/src/routes/
└── bibliotek.ts                     # tRPC-ruter: hentStandarder, hentProsjektValg, importerMal, fjernValg

apps/web/src/
├── components/bibliotek/
│   └── BibliotekPanel.tsx           # Slide-over panel for prosjekt-import (brukes fra sjekklistemaler)
└── app/dashbord/oppsett/produksjon/
    └── _components/MalListe.tsx     # "Hent fra bibliotek"-knapp i dropdown
```

## API-ruter (bibliotek.ts)

| Rute | Type | Auth | Beskrivelse |
|------|------|------|-------------|
| `hentStandarder` | query | protectedProcedure | Alle standarder med kapitler og maler |
| `hentProsjektValg` | query | verifiserProsjektmedlem | Hvilke maler prosjektet har importert |
| `importerMal` | mutation | verifiserProsjektmedlem | Importer mal → ReportTemplate + ReportObjects |
| `fjernValg` | mutation | verifiserProsjektmedlem | Fjern importert mal fra prosjekt |

## Import-logikk (importerMal)

1. Hent BibliotekMal med malInnhold JSON
2. Opprett ReportTemplate (name, description med NS-referanse, category=sjekkliste, domain=kvalitet)
3. Grupper felt etter fase (FØR/UNDER/ETTER)
4. For hver fase: opprett heading-felt + alle felt i fasen som ReportObjects
5. Opprett ProsjektBibliotekValg med referanse til ny mal
6. Mal er nå redigerbar i malbyggeren — brukeren kan tilpasse fritt

## Admin-side (planlagt)

`/admin/bibliotek` — kun sitedoc_admin:
- Venstre: trestruktur med standarder → kapitler → maler
- Høyre: malredigering med feltliste
- Per felt: type (dropdown), etikett, hjelpetekst, fase, config (options/enhet/min/maks)
- CRUD for standarder, kapitler, maler
- Drag-and-drop rekkefølge på felt

## Seed-data

NS 3420-K:2024 Anleggsgartnerarbeider med 4 kapitler og 6 maler:

| Kapittel | Mal | Felt | Nøkkelkrav |
|----------|-----|------|------------|
| KA | KA7 – Gjenbruk | 4 | Sortering, dokumentasjon, rengjøring |
| KB | KB2 – Jordarbeider | 10 | Tabell K4 lagtykkelser, steinstørrelse, komprimering |
| KB | KB4 – Grasdekke | 7 | Markdekningsgrad ≥95 %, fall ≥2 % |
| KB | KB6 – Planting | 8 | NS 4400, rothalsen over jord (KB6.1 c1) |
| KC | KC3.1 – Oppstøtting | 4 | Støttetype, bindmateriale, 1-sesong kontroll |
| KD | KD1 – Utendørsbelegg | 7 | Tabell K11 fall, Tabell K12 planhet ±3 mm |

## NS 3420-standarder i databasen (oppslag)

Følgende NS 3420-dokumenter er lastet opp og indeksert i FTD-dokumentdatabasen. Disse kan brukes som kilde for krav, toleranser og referanser når nye bibliotek-maler opprettes. Søk i chunks via `ftdSok.nsStandardSok` eller `ftdSok.sokDokumenter`.

| Fil | Del | Innhold |
|-----|-----|---------|
| ns-3420-1_2024 | Del 1 | Fellesbestemmelser |
| ns-3420-a_2024 | Del A | Rigg, drift og nedrigging |
| ns-3420-cd_2024 | Del CD | Betongarbeider, stål og aluminium |
| ns-3420-d_2024 | Del D | Stålkonstruksjoner |
| ns-3420-f_2024 | Del F | Grunnarbeider, graving, sprengning |
| ns-3420-gu_2024 | Del GU | Murarbeider, puss, flislegging |
| ns-3420-j_2024 | Del J | Tømrerarbeider |
| ns-3420-k_2024 | Del K | Anleggsgartnerarbeider |
| ns-3420-l_2024 | Del L | Malerarbeider, belegg, tapet |
| ns-3420-z_2024 | Del Z | Drift og vedlikehold |

**Bruk ved malutvikling:** Søk etter spesifikke krav (f.eks. "Tabell K4", "toleranse", "planhet") i chunked dokumentdata for å finne presise toleranser og kontrollkrav til hjelpetekstene.
