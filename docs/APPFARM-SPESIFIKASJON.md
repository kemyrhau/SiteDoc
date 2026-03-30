# SiteDoc → Appfarm: Funksjonsspesifikasjon

> Dato: 2026-03-27
> Formål: Gjenoppbygging av utvalgte SiteDoc-moduler i Appfarm
> Kilde: SiteDoc (`/Users/kennethmyrhaug/Documents/Programmering/SiteDoc`)

---

## 1. Oversikt

### Hva som skal bygges

| Modul | Beskrivelse | Prioritet |
|-------|-------------|-----------|
| Dashboard | Prosjektoversikt, statistikk, navigasjon | 1 — Grunnmur |
| Brukere og tilgang | Autentisering, roller, invitasjoner | 1 — Grunnmur |
| Entrepriser og dokumentflyt | Arbeidsflyt mellom UE-er med statusoverganger | 2 — Kjerne |
| Maler (malbygger) | Drag-and-drop skjemabygger med 23 felttyper | 2 — Kjerne |
| Sjekklister + Oppgaver (felles visning) | Registrering og oppfølging i én samlet liste | 3 — Hovedfunksjon |
| 2D Tegninger med georeferering | DWG/PDF-visning, GPS-kalibrering, markører | 4 — Avansert |
| Modulsystem (skall) | Aktiver/deaktiver funksjoner per prosjekt | 5 — Infrastruktur |

### Layout-referanse

Layouten skal ligne HRP sitt interne system Nexus (skjermbilder kommer senere). Generelt prinsipp: profesjonelt, kompakt, funksjonelt — hvert element må rettferdiggjøre sin eksistens.

---

## 2. Datamodell

### 2.1 Brukere og organisasjoner

```
User
├── id                  UUID, primærnøkkel
├── email               Unik, påkrevd
├── name                Valgfri
├── phone               Valgfri
├── image               Avatar-URL
├── role                "user" | "company_admin" | "sitedoc_admin"
├── organizationId      FK → Organization (valgfri)
├── createdAt           Tidsstempel
└── updatedAt           Tidsstempel

Organization
├── id                  UUID
├── name                Firmanavn
├── organizationNumber  Org.nr (norsk)
├── invoiceEmail        Fakturaadresse e-post
├── invoiceAddress      Fakturaadresse
├── logoUrl             Firmalogo
└── createdAt           Tidsstempel
```

### 2.2 Prosjekter og medlemmer

```
Project
├── id                  UUID
├── name                Prosjektnavn (påkrevd)
├── projectNumber       Auto-generert
├── description         Valgfri
├── address             Valgfri
├── status              "active" | "deactivated"
├── organizationId      FK → Organization
├── createdAt           Tidsstempel
└── updatedAt           Tidsstempel

ProjectMember
├── id                  UUID
├── userId              FK → User
├── projectId           FK → Project
├── role                "owner" | "admin" | "member"
├── createdAt           Tidsstempel
└── UNIK(userId, projectId)

MemberEnterprise (kobling bruker ↔ entreprise)
├── id                  UUID
├── projectMemberId     FK → ProjectMember
├── enterpriseId        FK → Enterprise
└── UNIK(projectMemberId, enterpriseId)

En bruker kan tilhøre flere entrepriser i samme prosjekt.
```

### 2.3 Entrepriser

```
Enterprise
├── id                  UUID
├── projectId           FK → Project
├── name                Entreprisenavn (f.eks. "Bygg")
├── enterpriseNumber    Kode (f.eks. "K01")
├── organizationNumber  Org.nr (valgfri)
├── color               Automatisk tildelt fra 32-fargepalett
├── industry            Bransje (Bygg, Elektro, VVS, Rør, Ventilasjon, osv.)
├── companyName         Selskapsnavn (valgfri)
├── ansvarligId         FK → User (ansvarlig person)
├── createdAt           Tidsstempel
└── updatedAt           Tidsstempel

Standard entrepriser (mal ved prosjektopprettelse):
  K00  Byggherre    blue
  K01  Bygg         emerald
  K02  Elektro      amber
  K03  VVS          purple
  K04  Ventilasjon  teal

Fargepalett (32 farger):
  blue, emerald, purple, amber, rose, teal, indigo, orange,
  cyan, lime, fuchsia, sky, violet, red, green, yellow,
  pink, slate, zinc, stone,
  blue-800, emerald-800, purple-800, amber-700, rose-800, teal-800,
  indigo-800, orange-700, cyan-800, lime-700, fuchsia-800, sky-800
```

### 2.4 Grupper og tilgangskontroll

```
ProjectGroup
├── id                  UUID
├── projectId           FK → Project
├── slug                Unik identifikator (f.eks. "feltarbeid-admin")
├── name                Gruppenavn
├── category            "generelt" | "field" | "brukergrupper"
├── permissions         JSON-array: ["view_field", "checklist_view", "task_view", ...]
├── domains             JSON-array: ["bygg", "hms", "kvalitet"]
├── modules             JSON-array: ["sjekklister", "oppgaver", "tegninger", "3d"]
├── buildingIds         JSON-array eller null (null = alle bygninger)
├── isDefault           Boolean (standardgrupper kan ikke slettes)
└── createdAt           Tidsstempel

GroupEnterprise (begrenser gruppetilgang til spesifikke entrepriser)
├── id                  UUID
├── groupId             FK → ProjectGroup
├── enterpriseId        FK → Enterprise
└── UNIK(groupId, enterpriseId)

Tilgangskontroll — tre lag:
  1. Admin bypass      → ser alt
  2. Direkte entreprise → brukerens entreprise matcher oppretter/svarer
  3. Gruppedomene      → gruppens domene matcher malens domene
     a) Tverrgående (ingen GroupEnterprise) → ser alt i domenet
     b) Begrenset (med GroupEnterprise)     → kun dokumenter for gruppens entrepriser

Tillatelser (permissions-verdier):
  view_field, create_tasks, create_checklists,
  checklist_view, checklist_edit, task_view, task_edit,
  drawing_view, folder_view
```

### 2.5 Dokumentflyt (entreprisearbeidsflyt)

```
Dokumentflyt
├── id                  UUID
├── projectId           FK → Project
├── enterpriseId        FK → Enterprise (standard-entreprise for flyten)
├── name                Navn (f.eks. "Byggherre → Bygg")
├── createdAt           Tidsstempel
└── updatedAt           Tidsstempel

DokumentflytMedlem
├── id                  UUID
├── dokumentflytId      FK → Dokumentflyt
├── enterpriseId        FK → Enterprise (valgfri, gjensidig eksklusiv)
├── projectMemberId     FK → ProjectMember (valgfri, gjensidig eksklusiv)
├── groupId             FK → ProjectGroup (valgfri, gjensidig eksklusiv)
├── rolle               "oppretter" | "svarer"
├── steg                Heltall (1-indeksert, rekkefølge i arbeidsflyten)
└── UNIK(dokumentflytId, enterpriseId, rolle, steg)
    UNIK(dokumentflytId, projectMemberId, rolle, steg)
    UNIK(dokumentflytId, groupId, rolle, steg)

DokumentflytMal (kobling dokumentflyt ↔ rapportmal)
├── id                  UUID
├── dokumentflytId      FK → Dokumentflyt
├── templateId          FK → ReportTemplate
└── UNIK(dokumentflytId, templateId)

Nøkkelprinsipper:
- Medlemmer kan være entrepriser, enkeltpersoner eller grupper
- Steg-nummerering gir sekvensiell arbeidsflyt
- Flere svarere på ulike steg er støttet
- Maler knyttes til dokumentflyt → bestemmer hvilke skjematyper som er tilgjengelige
```

### 2.6 Rapportmaler (malbygger)

```
ReportTemplate
├── id                  UUID
├── projectId           FK → Project
├── name                Malnavn (f.eks. "Befaringsrapport")
├── description         Valgfri
├── prefix              Auto-nummerering (f.eks. "BEF" → BEF-001, BEF-002)
├── category            "oppgave" | "sjekkliste"
├── domain              "bygg" | "hms" | "kvalitet"
├── subjects            JSON-array med forhåndsdefinerte emner (valgfri)
├── showSubject         Boolean (vis emnefeltet)
├── showEnterprise      Boolean (vis entreprisevelger)
├── showLocation        Boolean (vis lokasjonsfelt)
├── showPriority        Boolean (vis prioritet, kun oppgaver)
├── enableChangeLog     Boolean (spor feltendringer)
├── version             Heltall
├── createdAt           Tidsstempel
└── updatedAt           Tidsstempel

ReportObject (felter i malen — hierarkisk)
├── id                  UUID
├── templateId          FK → ReportTemplate
├── parentId            FK → ReportObject (for nestede felt, null = rotfelt)
├── type                Felttype (se 2.6.1)
├── label               Visningsnavn
├── config              JSON — typespesifikk konfigurasjon (se 2.6.2)
├── sortOrder           Heltall — global sortering
├── required            Boolean — obligatorisk felt
├── createdAt           Tidsstempel
└── updatedAt           Tidsstempel

Felthierarki:
  rotfelt (parentId=null) → barn (parentId=rotfelt) → barnebarn (osv.)
  Maks nesting: ubegrenset (praktisk ~3-4 nivåer)
  Sletting av container kaskaderer til alle barn.
```

#### 2.6.1 Felttyper (23 stk)

```
TEKST
  heading           Seksjonsoverskrift (ingen input)
  subtitle          Undertittel
  text_field        Enkel/flerlinjet tekst (config: multiline)

VALG
  list_single       Enkeltvalg — radio/dropdown (config: options[])
  list_multi        Flervalg — avkrysningsbokser (config: options[])
  traffic_light     Statusindikator med 4 faste valg:
                      grønn=Godkjent, gul=Anmerkning, rød=Avvik, grå=Ikke relevant

TALL
  integer           Heltall (config: min, max, unit)
  decimal           Desimaltall (config: min, max, decimals, unit)
  calculation       Beregnet felt, skrivebeskyttet (config: formula)

DATO
  date              Datovelger (YYYY-MM-DD)
  date_time         Dato+tid (YYYY-MM-DD HH:mm)

PERSON/FIRMA
  person            Enkeltperson-velger (config: role)
  persons           Flerperson-velger (config: role, max)
  company           Entreprisevelger (config: role)

FIL
  attachments       Filopplasting (config: maxFiles, acceptedTypes)

SPESIAL
  signature         Digital signatur
  weather           Automatisk værdata (hentes fra ekstern API)
  location          Bygning/tegningsreferanse (auto-satt fra kontekst)
  drawing_position  Markér posisjon på tegning (config: buildingFilter, disciplineFilter)
  repeater          Gjentagende gruppe — aksepterer alltid barn
  bim_property      Egenskap fra BIM/IFC-modell (config: propertyName)
  zone_property     Soneegenskap (config: propertyName)
  room_property     Romegenskap (config: propertyName)
```

#### 2.6.2 Konfigurasjon per felttype

```
Alle felttyper har:
  zone              "topptekst" | "datafelter" (bestemmer plassering i mal)

Tekst:
  text_field        { multiline: boolean }

Valg:
  list_single       { options: string[] eller {value, label}[] }
  list_multi        { options: string[] eller {value, label}[] }
  traffic_light     { options: [4 faste {value, label}-objekter] }

  Betingelseslogikk (for list_single og list_multi):
    conditionActive   Boolean — aktiverer barn-aksept
    conditionValues   string[] — hvilke valg som viser barna

Tall:
  integer           { min, max, unit }
  decimal           { min, max, decimals (standard 2), unit }
  calculation       { formula }

Person/firma:
  person, persons   { role: string (f.eks. "Inspektør") }
  company           { role: string }
  persons           { max: number }

Fil:
  attachments       { maxFiles: number (standard 10), acceptedTypes: string[] }

Tegning:
  drawing_position  { buildingFilter: string|null, disciplineFilter: string|null }
```

#### 2.6.3 Betingelseslogikk (nesting)

```
Kun 3 felttyper aksepterer barn:

  list_single   → kun hvis conditionActive=true
  list_multi    → kun hvis conditionActive=true
  repeater      → alltid

Eksempel:
  list_single "Resultat" (options: ["Godkjent", "Avvik", "Ikke relevant"])
    conditionActive: true
    conditionValues: ["Avvik"]
    └── text_field "Beskrivelse av avvik" (vises kun når "Avvik" er valgt)
    └── attachments "Vedlegg" (vises kun når "Avvik" er valgt)

  repeater "Kontrollpunkter"
    └── text_field "Beskrivelse"
    └── traffic_light "Status"
    └── attachments "Dokumentasjon"
```

#### 2.6.4 Malbygger — drag-and-drop

```
Tre-kolonne layout:
┌──────────────────┬───────────────────────────────┬──────────────────┐
│ Feltpalett (224px)│ Droppsoner (flex)             │ Konfig. (288px)  │
│                  │                               │                  │
│ 7 kategorier:    │ Topptekst-sone                │ Valgt felt:      │
│  Tekst           │ ┌───────────────────────────┐ │  Etikett         │
│  Valg            │ │ [felt] [felt] [felt]      │ │  Påkrevd         │
│  Tall            │ └───────────────────────────┘ │  Hjelpetekst     │
│  Dato            │                               │  Type-spesifikk  │
│  Person          │ Datafelter-sone               │  konfigurasjon   │
│  Fil             │ ┌───────────────────────────┐ │                  │
│  Spesial         │ │ [felt]                    │ │ Betingelse:      │
│                  │ │   └─ [barn] [barn]        │ │  Aktive verdier  │
│ Dra herfra →     │ │ [felt]                    │ │  Legg til/fjern  │
│                  │ │ [repeater]                │ │                  │
│                  │ │   └─ [barn]               │ │                  │
│                  │ └───────────────────────────┘ │                  │
└──────────────────┴───────────────────────────────┴──────────────────┘

Drag-operasjoner:
  1. Fra palett → droppsone: Opprett nytt felt
  2. Innenfor sone: Endre rekkefølge (sortOrder)
  3. Mellom soner: Flytt felt (topptekst ↔ datafelter)
  4. Til container: Sett parentId (bli barn)
  5. Fra container: Fjern parentId (bli rotfelt)

Beskyttelse:
  - Sirkulærreferanse-sjekk før nesting (traverserer opptil 10 nivåer)
  - Brukssjekk før sletting (har sjekklister/oppgaver data i dette feltet?)

Visuell feedback:
  - Blå ramme: betingelses-container (list med conditionActive)
  - Grønn ramme: repeater-container
  - Dra-overlegg med feltikon og etikett
```

### 2.7 Sjekklister og oppgaver

```
Checklist
├── id                     UUID
├── templateId             FK → ReportTemplate
├── creatorUserId          FK → User
├── creatorEnterpriseId    FK → Enterprise
├── responderEnterpriseId  FK → Enterprise
├── dokumentflytId         FK → Dokumentflyt (valgfri)
├── status                 Statusverdi (se 2.7.1)
├── title                  Tittel
├── number                 Auto-nummerert (per mal-prefix)
├── data                   JSON — utfylte verdier { feltId: verdi }
├── subject                Emne (fra mal eller fritekst)
├── dueDate                Frist (valgfri)
├── buildingId             FK → Building (valgfri)
├── drawingId              FK → Drawing (valgfri)
├── recipientUserId        FK → User (mottaker ved sending)
├── recipientGroupId       FK → ProjectGroup (gruppemottaker)
├── createdAt              Tidsstempel
└── updatedAt              Tidsstempel

Task
├── id                     UUID
├── templateId             FK → ReportTemplate (valgfri)
├── creatorUserId          FK → User
├── creatorEnterpriseId    FK → Enterprise
├── responderEnterpriseId  FK → Enterprise
├── dokumentflytId         FK → Dokumentflyt (valgfri)
├── status                 Statusverdi (se 2.7.1)
├── title                  Tittel
├── description            Beskrivelse (valgfri)
├── subject                Emne
├── number                 Auto-nummerert
├── priority               "low" | "medium" | "high" | "critical"
├── dueDate                Frist (valgfri)
├── drawingId              FK → Drawing (valgfri)
├── positionX              Prosent 0-100 (horisontal pos. på tegning)
├── positionY              Prosent 0-100 (vertikal pos. på tegning)
├── checklistId            FK → Checklist (oppgave knyttet til sjekkliste)
├── checklistFieldId       Felt-ID i sjekkliste (kobling til spesifikt felt)
├── recipientUserId        FK → User
├── recipientGroupId       FK → ProjectGroup
├── data                   JSON — utfylte verdier (valgfri)
├── createdAt              Tidsstempel
└── updatedAt              Tidsstempel

DocumentTransfer (revisjonslogg for statusendringer)
├── id                     UUID
├── checklistId            FK → Checklist (valgfri)
├── taskId                 FK → Task (valgfri)
├── senderId               FK → User
├── recipientUserId        FK → User (valgfri)
├── recipientGroupId       FK → ProjectGroup (valgfri)
├── fromStatus             Forrige status
├── toStatus               Ny status (eller "forwarded")
├── comment                Kommentar/melding (valgfri)
└── createdAt              Tidsstempel

Data-lagring (utfylte verdier):
  data = {
    "felt-uuid-1": "Tekstverdi",
    "felt-uuid-2": ["Valg A", "Valg B"],
    "felt-uuid-3": { "lat": 59.923, "lng": 10.752 },
    "repeater-uuid": [
      { "barn-1": "rad 1", "barn-2": 100 },
      { "barn-1": "rad 2", "barn-2": 200 }
    ]
  }
```

#### 2.7.1 Statusoverganger

```
Gyldige overganger:

  draft        → sent, cancelled
  sent         → received, cancelled
  received     → in_progress, cancelled
  in_progress  → responded, cancelled
  responded    → approved, rejected
  approved     → closed
  rejected     → in_progress, closed
  closed       → (ingen)
  cancelled    → draft

Flytskjema:

  draft ──[send]──► sent ──[auto]──► received ──[start]──► in_progress
    ↑                                                            │
    └──────────────────[cancel]──────────────────────────────────┘
                                                                 │
                                                           [complete]
                                                                 │
                                                             responded
                                                            ╱         ╲
                                                    [approve]       [reject]
                                                        │               │
                                                    approved      in_progress
                                                        │           (ny runde)
                                                      closed

Nøkkelregler:
  - sent → received skjer AUTOMATISK (ingen manuelt "motta"-steg)
  - I utkast (draft) kan entrepriser endres via dropdown
  - Etter sending er entrepriser LÅST
  - Videresending: mottaker oppdateres, status forblir uendret
  - Avvisning sender tilbake til in_progress for revisjon
```

### 2.8 Felles visning: sjekklister + oppgaver

```
VIKTIG: I Appfarm-versjonen vises sjekklister og oppgaver i SAMME liste.

I SiteDoc original er disse separate sider:
  /dashbord/[prosjektId]/sjekklister
  /dashbord/[prosjektId]/oppgaver

I Appfarm-versjonen skal de samles:

  ┌─────────────────────────────────────────────────────┐
  │ Filter: [Alle ▾] [Status ▾] [Entreprise ▾] [Mal ▾] │
  ├─────────────────────────────────────────────────────┤
  │ Type │ Nr        │ Tittel       │ Status   │ Frist  │
  │──────│───────────│──────────────│──────────│────────│
  │ 📋   │ BEF-001   │ Fasade nord  │ Sendt    │ 15.apr │
  │ ✅   │ OPP-012   │ Rett betong  │ Pågår    │ 12.apr │
  │ 📋   │ GM-003    │ Godkjenning  │ Utkast   │ —      │
  │ ✅   │ OPP-013   │ Sjekk VVS    │ Mottatt  │ 20.apr │
  └─────────────────────────────────────────────────────┘

  📋 = sjekkliste, ✅ = oppgave

Filteralternativer:
  - Type: Alle / Sjekklister / Oppgaver
  - Status: draft, sent, received, in_progress, responded, approved, rejected, closed
  - Entreprise: velg oppretter- eller svarer-entreprise
  - Mal: velg rapportmal
  - Prioritet (kun oppgaver): lav, medium, høy, kritisk
  - Frist: overdue, denne uke, denne måned

Sortering: Nr, tittel, status, frist, opprettet, oppdatert

Klikk på rad → åpne detalj-visning (skjemautfylling basert på mal)

Denne felles visningen er også planlagt som fremtidig forbedring for SiteDoc.
```

### 2.9 Tegninger

```
Drawing
├── id                  UUID
├── projectId           FK → Project
├── buildingId          FK → Building (valgfri)
├── name                Tegningsnavn
├── drawingNumber       Tegningsnummer (f.eks. "ARK-P-101")
├── discipline          ARK, RIB, RIV, RIE, RIBr, RIG, LARK, RIAku
├── drawingType         plan, snitt, fasade, detalj, oversikt, skjema
├── revision            Revisjonskode ("A", "B", "R01", osv.)
├── version             Internt versjonsnummer (auto-inkrement)
├── status              utkast, delt, under_behandling, godkjent, for_bygging, som_bygget
├── floor               Etasje ("01", "02", "Tak", "U1")
├── scale               Målestokk ("1:50", "1:100")
├── fileUrl             Konvertert fil (/uploads/uuid.svg)
├── fileType            svg, png, dwg, ifc
├── originalFileUrl     Originalfil (DWG før konvertering)
├── coordinateSystem    Koordinatsystem (utm33, ntm6, wgs84)
├── conversionStatus    pending, converting, done, failed
├── conversionError     Feilmelding ved mislykket konvertering
├── geoReference        JSON — georefereringspunkter (se 2.9.1)
├── issuedAt            Utgivelsesdato
├── createdAt           Tidsstempel
└── updatedAt           Tidsstempel

DrawingRevision (versjonshistorikk)
├── id                  UUID
├── drawingId           FK → Drawing
├── revision            Revisjonskode på arkiveringstidspunktet
├── version             Versjonsnummer på arkiveringstidspunktet
├── fileUrl             Sti til arkivert fil
├── uploadedById        FK → User
├── status              Status på arkiveringstidspunktet
├── issuedAt            Utgivelsesdato
└── createdAt           Tidsstempel

Building (bygning/lokasjon)
├── id                  UUID
├── projectId           FK → Project
├── name                Bygningsnavn
├── number              Bygningsnummer
├── address             Adresse (valgfri)
├── gpsLat              Breddegrad (valgfri)
├── gpsLng              Lengdegrad (valgfri)
└── createdAt           Tidsstempel

Filtype-håndtering:
  DWG → konverteres til SVG (via ODA → DXF → SVG-pipeline)
  PDF → konverteres til PNG (via pdftoppm, 200 DPI)
  SVG/PNG/JPG → vises direkte
```

#### 2.9.1 Georeferering

```
GeoReferanse (lagres i Drawing.geoReference som JSON)
├── point1
│   ├── pixel   { x: 0-100, y: 0-100 }     Prosent av tegningsbredde/høyde
│   └── gps     { lat: number, lng: number } WGS84 grader
├── point2
│   ├── pixel   { x, y }
│   └── gps     { lat, lng }
└── ekstraPunkter[]  (valgfritt, 3+ punkter for affin transformasjon)

Transformasjon:
  2 punkter → Similaritetstransformasjon (rotasjon + skalering + translasjon)
  3+ punkter → Affin transformasjon (full 2D-transformasjon, minste kvadraters metode)

Breddegrad-korreksjon:
  cosLat = cos(middelbreddegrad × π/180)
  Nødvendig for Norge (58°-71°N): 1° lengdegrad ≠ 1° breddegrad

Kjerneoperasjoner:
  GPS → Tegning:   Konverter GPS-koordinat til prosent-posisjon på tegning
  Tegning → GPS:   Konverter klikk-posisjon til GPS-koordinat
  Innenfor-sjekk:  Er GPS-punkt innenfor tegningens grenser (10% margin)?
  Kalibreringsfeil: Beregn gjennomsnittlig og maksimal feil i meter

Støttede koordinatformater (for input):
  WGS84 desimal:   59.123456, 10.654321
  WGS84 DMS:       59°7′24.456″N, 10°39′15.876″E
  UTM kompakt:     653849.51,7732794.51@EPSG:25833
  UTM standard:    Nord: 7732794.51 Øst: 653849.51
  UTM-soner:       32, 33, 35, 36 (Norge)
```

#### 2.9.2 Markører på tegninger

```
Sjekklister og oppgaver kan knyttes til tegninger:
  drawingId       FK til tegning
  positionX       Prosent 0-100 (horisontal)
  positionY       Prosent 0-100 (vertikal)
  (0,0) = øverst venstre, (100,100) = nederst høyre

Markør-visning:
  Farge basert på status:
    Rød    = ubesvart (standard)
    Grønn  = godkjent
    Gul    = under behandling
    Grå    = lukket/arkivert

  Etikett: {malprefix}-{nummer} (f.eks. BEF-001) eller tittel

Plassering:
  Klikkemodus på tegning → klikk = opprett sjekkliste/oppgave på den posisjonen
  Konverterer klikkkoordinater til prosent av containerbredde/høyde

Georeferert visning:
  Sanntids GPS-koordinater vises ved musebevegelse over tegning
  Format: lat, lng med 6 desimaler
```

#### 2.9.3 Tegningsvisning

```
Tegningsviewer:
  Zoom: 0.25x til 50x (musehjul, sentrert på musepeker)
  Pan: Klikk-og-dra (disambiguert fra klikk: >5px bevegelse = pan)
  Modus:
    Plassering: klikk → opprett markør/dokument
    Inspeksjon: klikk på DWG-element → vis lag, type, tekst (debug-info)

  SVG-streker: tykkelse uavhengig av zoom (CSS: stroke-width = 1.5/zoom)

Tegningspanel (sidepanel):
  Hierarki:
    Bygning 1
      ├── Utendørs (georefererte tegninger)
      ├── Etasje 01
      │   ├── Tegning A
      │   └── Tegning B
      ├── Etasje 02
      └── (Ingen etasje)

  Gruppering: tegninger med etasje → gruppert, med georef uten etasje → "Utendørs"
  Stjerne-toggle: sett som standardtegning
  Søk: filtrer på navn, nummer, disiplin
```

### 2.10 Modulsystem (skall)

```
ProjectModule
├── id                  UUID
├── projectId           FK → Project
├── moduleSlug          Unik identifikator (f.eks. "okonomi", "dokumentsok")
├── active              Boolean (standard true)
├── createdAt           Tidsstempel
└── UNIK(projectId, moduleSlug)

Aktivering:
  Når modul aktiveres → registrer slug i ProjectModule-tabellen
  Når modul deaktiveres → sett active=false (bevar data)

Effekt i UI:
  Funksjonsmoduler: vis/skjul sidebar-ikoner og sider
  Oppgave/sjekkliste-moduler: opprett tilhørende maler (med prefix og rapportobjekter)

I Appfarm-versjonen: kun skallet implementeres.
  Ingen forhåndsdefinerte moduler.
  Brukeren kan selv definere moduler med slug og ikon.
  Aktivering/deaktivering per prosjekt via innstillingssiden.
```

### 2.11 Invitasjoner

```
ProjectInvitation
├── id                  UUID
├── email               Mottakers e-post
├── token               Unik, 7 dagers utløp
├── projectId           FK → Project
├── enterpriseId        FK → Enterprise (valgfri)
├── groupId             FK → ProjectGroup (valgfri)
├── invitedByUserId     FK → User
├── role                Rolle i prosjektet
├── status              "pending" | "accepted" | "expired"
├── expiresAt           Utløpsdato (7 dager fra opprettelse)
├── acceptedAt          Akseptert tidspunkt (null til akseptert)
└── createdAt           Tidsstempel

Flyt:
  1. Admin inviterer → ProjectInvitation opprettes, e-post sendes
  2. Mottaker klikker lenke → logges inn via OAuth
  3. Hvis e-post matcher → invitasjon aksepteres automatisk
  4. ProjectMember opprettes, bruker får tilgang
  5. Utløpte invitasjoner kan sendes på nytt
```

---

## 3. Brukergrensesnitt

### 3.1 Overordnet layout

```
┌─ Toppbar (48px) ──────────────────────────────────────────────┐
│ [Logo] [Prosjektvelger ▾] [Bygningsvelger ▾]    [👤 Bruker ▾]│
├──┬───────────────────┬────────────────────────────────────────┤
│  │ Sidebar (60px)    │ Hovedinnhold                           │
│  │                   │                                        │
│  │ 📊 Dashboard      │ (Varierer per aktiv seksjon)           │
│  │ 📋 Dokumenter*    │                                        │
│  │ 📐 Tegninger      │ *Dokumenter = felles sjekkliste +      │
│  │ 📁 Mapper         │  oppgave-visning                       │
│  │                   │                                        │
│  │                   │                                        │
│  │                   │                                        │
│  │ ⚙ Innstillinger   │                                        │
└──┴───────────────────┴────────────────────────────────────────┘

Merk: Layout skal tilpasses Nexus-stilen (detaljeres når skjermbilder foreligger).
Sidebar-ikoner er dynamiske — vises kun når relevant modul er aktiv.
```

### 3.2 Dashboard

```
┌───────────────────────────────────────────────────────────┐
│ Velkommen, [Navn]                                         │
├───────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│ │ Prosjekter│ │Sjekklister│ │ Oppgaver │                  │
│ │     3     │ │    12    │ │    8     │                   │
│ └──────────┘ └──────────┘ └──────────┘                   │
├───────────────────────────────────────────────────────────┤
│ Siste prosjekter                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│ │ Prosjekt │ │ Prosjekt │ │ Prosjekt │                   │
│ │ Storgata │ │ Bjørvika │ │ Nydalen  │                   │
│ │ #001     │ │ #002     │ │ #003     │                   │
│ │ Aktiv    │ │ Aktiv    │ │ Aktiv    │                   │
│ └──────────┘ └──────────┘ └──────────┘                   │
└───────────────────────────────────────────────────────────┘

Tom tilstand: Hvis ingen prosjekter → vis "Kom i gang"-side med opprett-knapp.
Klikk prosjektkort → naviger til prosjektdetalj.
```

### 3.3 Innstillingssider

```
Innstillinger (undermeny):
  ├── Brukere og grupper    — Gruppeadministrasjon, medlemmer, invitasjoner
  ├── Entrepriser           — Entrepriseliste, farge, bransje, ansvarlig
  ├── Dokumentflyt          — Arbeidsflyter mellom entrepriser
  ├── Maler                 — Sjekkliste- og oppgavemaler (åpner malbygger)
  ├── Moduler               — Aktiver/deaktiver per prosjekt
  ├── Lokasjoner            — Bygninger med georeferering
  ├── Prosjektoppsett       — Navn, nummer, adresse, logo
  └── Firma                 — Organisasjonsinfo, faktura
```

---

## 4. Forretningsregler

### 4.1 Prosjektisolering

All data er isolert per prosjekt. Ingen data skal lekke mellom prosjekter. Alle spørringer filtrerer på projectId.

### 4.2 Entreprise-endring

- I utkast-status (draft): entrepriser kan endres fritt via dropdown
- Etter sending: entrepriser er LÅST og kan ikke endres

### 4.3 Auto-nummerering

Sjekklister og oppgaver nummereres automatisk per mal-prefix:
- Mal med prefix "BEF" → BEF-001, BEF-002, BEF-003
- Nummeret er sekvensielt innenfor prosjektet per prefix

### 4.4 Sletteregler

- Sjekklister kan kun slettes i utkast-status
- Sjekklister med tilknyttede oppgaver kan IKKE slettes
- Sletting kaskaderer til DocumentTransfer og Image

### 4.5 Videresending

- Dokumenter i status received eller in_progress kan videresendes
- Mottaker oppdateres (recipientUserId/recipientGroupId)
- Status forblir uendret
- DocumentTransfer opprettes med kommentar

### 4.6 E-postvarsling

Varsling sendes ved:
- Sending av dokument (draft → sent)
- Videresending

Innhold: dokumenttype, tittel, nummer, prosjektnavn, avsender, kommentar, lenke.

---

## 5. Autentisering

```
OAuth-leverandører:
  1. Google (standard)
  2. Microsoft Entra ID (valgfri, krever konfigurering)

Sesjonshåndtering:
  - Database-sesjoner (ikke JWT)
  - Kontolinking: samme e-post på tvers av leverandører kobles automatisk

Roller (globalt):
  user           Standard bruker
  company_admin  Firmaadministrator
  sitedoc_admin  Superbruker (SiteDoc-admin)

Roller (per prosjekt):
  owner          Prosjekteier (full tilgang)
  admin          Prosjektadmin (full tilgang)
  member         Vanlig medlem (tilgang via grupper/entrepriser)
```

---

## 6. DWG-konvertering (pipeline)

```
Konverteringssteg for DWG-filer:

  DWG-fil
    │
    ▼
  ODA File Converter (xvfb for headless)
    │ DWG → DXF
    ▼
  DXF Parser (dxf-parser)
    │ DXF → SVG
    │
    │ Prosessering:
    │  - Utfold INSERT-blokker rekursivt (maks 5 nivåer, maks 500k entities)
    │  - Koordinatsystem-deteksjon fra $EXTMIN/$EXTMAX
    │  - Persentil-basert outlier-filtrering (1.-99. persentil)
    │  - Fargepresjon: DXF indeksfarger → HSL
    │  - B-spline evaluering (De Boors algoritme)
    │  - Stroke-width CSS for zoom-uavhengige linjer
    ▼
  SVG-fil
    │ Lagres som /uploads/uuid.svg
    │ Drawing.conversionStatus = "done"
    ▼
  Klar for visning

  Timeout: 5 minutter per fil
  Retry: tegning.provKonverteringIgjen ved feil
  Layout-håndtering: hver DWG-layout → separat Drawing-rad

For PDF-filer:
  PDF → pdftoppm → PNG (200 DPI)

MERK: DWG-konvertering krever server-side verktøy (ODA/libredwg).
      I Appfarm må dette løses via ekstern tjeneste/API eller manuell
      SVG/PNG-opplasting som alternativ.
```

---

## 7. Appfarm-spesifikke vurderinger

### 7.1 Hva Appfarm håndterer nativt

- Autentisering (OAuth, brukeradministrasjon)
- Database og datamodell (visuell oppsett)
- UI-bygging (drag-and-drop)
- Tilgangskontroll (rollebasert)
- E-postvarsling
- Fillagring og opplasting
- Responsivt design

### 7.2 Hva som kan være utfordrende

| Funksjon | Utfordring | Mulig løsning |
|----------|-----------|----------------|
| Malbygger (drag-and-drop) | Kompleks nesting med betingelseslogikk | Appfarms egne form-builder-features, eller forenklet versjon |
| DWG-konvertering | Krever server-side verktøy | Ekstern API-tjeneste, eller kun PDF/SVG/PNG-støtte |
| Georeferering | Matematisk transformasjon | Custom JavaScript-logikk i Appfarm |
| SVG-visning med zoom | Zoom-uavhengige streker | Custom webkomponent eller iframe |
| Betingelseslogikk i skjemaer | Dynamisk vis/skjul basert på verdier | Appfarms betinget visning |
| Repeater-felt i skjemaer | Gjentakende radgrupper | Appfarms array/repeater-støtte |

### 7.3 Forenklingsmuligheter

- **Tegninger**: Start med kun PDF/PNG-opplasting (dropp DWG-konvertering initialt)
- **Malbygger**: Bruk Appfarms innebygde form-builder hvis den støtter nesting
- **Georeferering**: Kan være fase 2 — start med enkel tegningsvisning uten GPS
- **Betingelseslogikk**: Start med enkel vis/skjul — utvid til full nesting senere

### 7.4 Implementeringsrekkefølge for Appfarm

```
Fase 1: Grunnmur
  ├── Datamodell (alle tabeller)
  ├── Autentisering (OAuth)
  ├── Dashboard + prosjektoversikt
  ├── Bruker- og gruppeadministrasjon
  └── Entrepriser

Fase 2: Kjernefunksjonalitet
  ├── Rapportmaler (malbygger)
  ├── Dokumentflyt (arbeidsflyter)
  ├── Sjekklister + oppgaver (felles liste)
  └── Statusoverganger + revisjonslogg

Fase 3: Tegninger
  ├── Filopplasting (PDF/PNG først)
  ├── Tegningsvisning med zoom/pan
  ├── Markører (sjekklister/oppgaver på tegning)
  └── Georeferering (GPS-kalibrering)

Fase 4: Avansert
  ├── DWG-konvertering (ekstern tjeneste)
  ├── Modulsystem
  ├── E-postvarsling
  └── Revisjonshistorikk for tegninger
```

---

## 8. Referanser

| Ressurs | Plassering |
|---------|------------|
| SiteDoc kildekode | `/Users/kennethmyrhaug/Documents/Programmering/SiteDoc` |
| Database-skjema | `packages/db/prisma/schema.prisma` |
| API-routere | `apps/api/src/routes/` |
| Tilgangskontroll | `apps/api/src/trpc/tilgangskontroll.ts` |
| Felttyper og moduler | `packages/shared/src/types/index.ts` |
| Statusoverganger | `packages/shared/src/utils/index.ts` |
| Malbygger-komponenter | `apps/web/src/components/malbygger/` |
| Tegningsvisning | `apps/web/src/app/dashbord/[prosjektId]/tegninger/` |
| Georefereringslogikk | `packages/shared/src/utils/georeferanse.ts` |
| Forretningslogikk | `docs/claude/forretningslogikk.md` |
| Arkitektur | `docs/claude/arkitektur.md` |
| Web UI-detaljer | `docs/claude/web.md` |
