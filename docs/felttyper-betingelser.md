# Felttyper: Enkeltvalg, Flervalg og Betingelser

## Oversikt over valgfelt

```
┌─────────────────────────────────────────────────────────────────┐
│  ENKELTVALG (list_single)         FLERVALG (list_multi)         │
│                                                                 │
│  Brukeren velger ÉN verdi         Brukeren velger FLERE verdier │
│                                                                 │
│  ○ Godkjent                       ☐ Bygg                       │
│  ● Avvik         ← valgt          ☑ VVS          ← valgt       │
│  ○ Ikke relevant                  ☑ Elektro      ← valgt       │
│                                   ☐ Brann                       │
│                                                                 │
│  Lagrer: "Avvik"                  Lagrer: ["VVS", "Elektro"]   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Betingelse — samme oppførsel for begge

Betingelse = "Vis barnefelt KUN når brukeren velger bestemte verdier"

Enkeltvalg og Flervalg er **kontainere** — som esker som kan åpnes.
Når brukeren velger en trigger-verdi, åpnes esken og innholdet vises.
Inne i esken kan det ligge flere esker (kontainere med egne betingelser)
som igjen kan åpnes. Ubegrenset nesting — esker i esker i esker.

```
┌─────────────────────────────────────────────────────────────────┐
│  UTEN betingelse                  MED betingelse                │
│                                                                 │
│  Enkeltvalg: Befaring            Enkeltvalg: Befaring           │
│  ○ Ja                            ○ Ja                           │
│  ○ Nei                           ● Nei                          │
│                                   │                             │
│  Tekstfelt: Kommentar            (ingenting vises)              │
│  Trafikklys: Vurdering                                          │
│                                  Enkeltvalg: Befaring           │
│  Alle felt er ALLTID synlige     ● Ja                           │
│  uansett hva brukeren velger.    ○ Nei                          │
│                                   │                             │
│                                   ├── Tekstfelt: Kommentar      │
│                                   └── Trafikklys: Vurdering     │
│                                                                 │
│                                  Barnefelt vises BARE           │
│                                  når "Ja" er valgt.             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Eksempel 1: HMS-befaring (enkeltvalg med betingelse)

### I malbyggeren (PC)

```
DATAFELTER
┌──────────────────────────────────────────────────────────────┐
│ ⠿ ☐  Befaring utført?                           Enkeltvalg  │
│      Alternativer: [Ja, Nei]                                 │
│      ┌─ Vis felter hvis: [Ja] ──────────────────────────┐   │
│      │                                                    │   │
│      │ ⠿ ●  Kontrollresultat                  Trafikklys │   │
│      │ ⠿ Aa Beskrivelse av funn               Tekstfelt  │   │
│      │ ⠿ 📎 Dokumentasjon                     Vedlegg    │   │
│      │ ⠿ ☐  Type avvik                        Enkeltvalg │   │
│      │      Alternativer: [Kritisk, Mindre, Observasjon]  │   │
│      │      ┌─ Vis felter hvis: [Kritisk] ──────────┐    │   │
│      │      │                                        │    │   │
│      │      │ ⠿ Aa Strakstiltak påkrevd   Tekstfelt │    │   │
│      │      │ ⠿ 👤 Ansvarlig              Person    │    │   │
│      │      │ ⠿ 📅 Frist                  Dato      │    │   │
│      │      │                                        │    │   │
│      │      └────────────────────────────────────────┘    │   │
│      │                                                    │   │
│      └────────────────────────────────────────────────────┘   │
│                                                                │
│ ⠿ ✍  Signatur kontrollør                           Signatur  │
└──────────────────────────────────────────────────────────────┘
```

### I mobilappen — steg for steg

**Steg 1:** Brukeren åpner sjekklisten. Bare toppnivå-felt er synlige:

```
┌─────────────────────────────────┐
│  Befaring utført?               │
│  ○ Ja                           │
│  ○ Nei                          │
│                                 │
│  Signatur kontrollør            │
│  [Trykk for å signere]         │
└─────────────────────────────────┘
```

**Steg 2:** Brukeren velger "Ja" → nivå 1-barn vises:

```
┌─────────────────────────────────┐
│  Befaring utført?               │
│  ● Ja                           │
│  ○ Nei                          │
│                                 │
│  ┊ Kontrollresultat             │
│  ┊ 🟢  🟡  🔴  ⚪              │
│  ┊                              │
│  ┊ Beskrivelse av funn          │
│  ┊ [Trykk for å skrive...]     │
│  ┊                              │
│  ┊ Dokumentasjon                │
│  ┊ [Ta bilde] [Velg fil]       │
│  ┊                              │
│  ┊ Type avvik                   │
│  ┊ ○ Kritisk                    │
│  ┊ ○ Mindre                     │
│  ┊ ○ Observasjon                │
│                                 │
│  Signatur kontrollør            │
│  [Trykk for å signere]         │
└─────────────────────────────────┘
```

**Steg 3:** Brukeren velger "Kritisk" → nivå 2-barn vises:

```
┌─────────────────────────────────┐
│  ...                            │
│  ┊ Type avvik                   │
│  ┊ ● Kritisk                    │
│  ┊ ○ Mindre                     │
│  ┊ ○ Observasjon                │
│  ┊                              │
│  ┊  ┊ Strakstiltak påkrevd      │
│  ┊  ┊ [Trykk for å skrive...]  │
│  ┊  ┊                           │
│  ┊  ┊ Ansvarlig                 │
│  ┊  ┊ [Velg person...]         │
│  ┊  ┊                           │
│  ┊  ┊ Frist                     │
│  ┊  ┊ [Velg dato...]           │
│  ...                            │
└─────────────────────────────────┘
```

**Steg 4:** Brukeren endrer "Kritisk" → "Mindre":
→ Nivå 2-barn (Strakstiltak, Ansvarlig, Frist) forsvinner

**Steg 5:** Brukeren endrer "Ja" → "Nei":
→ ALLE barn forsvinner (nivå 1 + nivå 2)

---

## Eksempel 2: Kvalitetskontroll betong (flervalg med betingelse)

### I malbyggeren (PC)

```
DATAFELTER
┌──────────────────────────────────────────────────────────────┐
│ ⠿ H  Betongarbeider                              Overskrift │
│                                                               │
│ ⠿ ≡  Kontrollerte elementer                      Flervalg   │
│      Alternativer: [Fundament, Vegg, Dekke, Søyle]           │
│      ┌─ Vis felter hvis: [Fundament, Vegg, Dekke, Søyle] ┐  │
│      │                                                     │  │
│      │ ⠿ ●  Resultat                          Trafikklys  │  │
│      │ ⠿ #  Betongfasthet (MPa)               Heltall     │  │
│      │ ⠿ Aa Avvik funnet                       Tekstfelt   │  │
│      │ ⠿ 📎 Bilder                             Vedlegg     │  │
│      │                                                     │  │
│      └─────────────────────────────────────────────────────┘  │
│                                                               │
│ ⠿ %  Temperatur (°C)                             Desimaltall│
│ ⠿ ✍  Signatur                                    Signatur   │
└──────────────────────────────────────────────────────────────┘
```

### I mobilappen

**Ingen elementer valgt:**

```
┌─────────────────────────────────┐
│  Betongarbeider                 │
│                                 │
│  Kontrollerte elementer         │
│  ☐ Fundament                    │
│  ☐ Vegg                         │
│  ☐ Dekke                        │
│  ☐ Søyle                        │
│                                 │
│  Temperatur (°C)                │
│  [0.00]                         │
│                                 │
│  Signatur                       │
│  [Trykk for å signere]         │
└─────────────────────────────────┘
```

**"Fundament" og "Dekke" huket av → barn vises:**

```
┌─────────────────────────────────┐
│  Betongarbeider                 │
│                                 │
│  Kontrollerte elementer         │
│  ☑ Fundament                    │
│  ☐ Vegg                         │
│  ☑ Dekke                        │
│  ☐ Søyle                        │
│                                 │
│  ┊ Resultat                     │
│  ┊ 🟢  🟡  🔴  ⚪              │
│  ┊                              │
│  ┊ Betongfasthet (MPa)          │
│  ┊ [0]                          │
│  ┊                              │
│  ┊ Avvik funnet                 │
│  ┊ [Trykk for å skrive...]     │
│  ┊                              │
│  ┊ Bilder                       │
│  ┊ [Ta bilde] [Velg fil]       │
│                                 │
│  Temperatur (°C)                │
│  [0.00]                         │
└─────────────────────────────────┘
```

**Alle avhuket → barn forsvinner igjen**

---

## Eksempel 3: Eske-i-eske — rekursiv nesting

Prinsippet er som å åpne en eske. Inni esken er det flere esker
med noen ting rundt eskene. Inni de eskene er det enda flere ting.

### I malbyggeren (PC)

```
DATAFELTER
┌──────────────────────────────────────────────────────────────┐
│ ⠿ ☐  Anleggstype                                Enkeltvalg  │
│      Alternativer: [Sterkstrøm, Svakstrøm, Nødstrøm]       │
│      ┌─ Vis felter hvis: [Sterkstrøm, Svakstrøm] ──────┐   │
│      │                                                    │   │
│      │ ⠿ Aa Tavle/Systemnummer                Tekstfelt  │   │
│      │ ⠿ ☐  Kurstype                          Enkeltvalg │   │
│      │      Alternativer: [Lys, Varme, Motor, Stikk]     │   │
│      │      ┌─ Vis felter hvis: [Motor] ────────────┐    │   │
│      │      │                                        │    │   │
│      │      │ ⠿ #  Motoreffekt (kW)      Heltall   │    │   │
│      │      │ ⠿ Aa Verninnstilling        Tekstfelt │    │   │
│      │      │ ⠿ ●  Isolasjonsmåling      Trafikklys │    │   │
│      │      │                                        │    │   │
│      │      └────────────────────────────────────────┘    │   │
│      │                                                    │   │
│      │ ⠿ ●  Generell vurdering            Trafikklys    │   │
│      │ ⠿ 📎 Dokumentasjon                 Vedlegg       │   │
│      │                                                    │   │
│      └────────────────────────────────────────────────────┘   │
│                                                                │
│ ⠿ ✍  Signatur                                    Signatur    │
└──────────────────────────────────────────────────────────────┘
```

### I mobilappen — eske-metaforen

```
Eske 1: Anleggstype
  Velger "Sterkstrøm" → esken åpnes:
  ┌────────────────────────────────────────┐
  │  Tavle/Systemnummer                    │
  │  Eske 2: Kurstype                      │
  │    Velger "Motor" → esken åpnes:       │
  │    ┌──────────────────────────────┐    │
  │    │  Motoreffekt (kW)            │    │
  │    │  Verninnstilling             │    │
  │    │  Isolasjonsmåling            │    │
  │    └──────────────────────────────┘    │
  │  Generell vurdering                    │
  │  Dokumentasjon                         │
  └────────────────────────────────────────┘
  Signatur
```

---

## Sammenligning: Enkeltvalg vs Flervalg

| Egenskap | Enkeltvalg (list_single) | Flervalg (list_multi) |
|----------|------------------------|-----------------------|
| Valg | Ett alternativ | Flere alternativer |
| Mobil-visning | Radioknapp (●/○) | Avkrysningsboks (☑/☐) |
| Lagret verdi | `"Ja"` (string) | `["Bygg", "VVS"]` (array) |
| Betingelse | Vis barn når valgt verdi matcher | Vis barn når minst én valgt verdi matcher |
| Bruksområde | Ja/Nei, statusvalg, kategorisering | Flere fag, flere kontrollpunkter |
| Kontainer | Kan ha barn med betingelse | Kan ha barn med betingelse |

## Betingelseslogikk

```
ENKELTVALG med betingelse [trigger: "Ja"]
  Bruker velger "Ja"   → "Ja" === trigger  → barn VISES
  Bruker velger "Nei"  → "Nei" ≠ trigger   → barn SKJULT

FLERVALG med betingelse [trigger: "Bygg", "VVS"]
  Bruker huker "Bygg"           → match → barn VISES
  Bruker huker "Elektro"        → ingen match → barn SKJULT
  Bruker huker "Elektro"+"VVS"  → "VVS" matcher → barn VISES
```

---

## Bygge i malbyggeren — steg for steg

### Opprette enkeltvalg med betingelse

```
1. Dra "Enkeltvalg" fra paletten til datafelter-sonen
2. Klikk feltet → skriv etikett (f.eks. "Befaring utført?")
3. Legg til alternativer: "Ja", "Nei" → Lagre
4. Klikk ⋮ (treprikk) → "Tilføy betingelse"
   → Blå bjelke vises: "Vis felter hvis: [Ja] [Velg...]"
5. Dra flere felt inn i den blå gruppen
   (tekstfelt, trafikklys, vedlegg osv.)
6. Et barn-felt som er Enkeltvalg/Flervalg kan selv
   få betingelse via ⋮ → "Tilføy betingelse"
   → Ny blå bjelke inni den eksisterende (eske i eske)
```

### Opprette flervalg med betingelse

```
1. Dra "Flervalg" fra paletten til datafelter-sonen
2. Klikk feltet → skriv etikett (f.eks. "Kontrollerte fag")
3. Legg til alternativer: "Bygg", "VVS", "Elektro" → Lagre
4. Klikk ⋮ → "Tilføy betingelse"
   → "Vis felter hvis: [Bygg] [Velg...]"
   → Klikk "Velg..." for å legge til flere trigger-verdier
5. Dra barnefelt inn i gruppen
```

---

## Praktiske bruksområder i bygging

| Bruksområde | Felttype | Trigger | Barnefelt |
|-------------|----------|---------|-----------|
| Befaring | Enkeltvalg: Ja/Nei | Ja | Trafikklys, funn, bilder |
| Avvikstype | Enkeltvalg: Kritisk/Mindre/Obs | Kritisk | Strakstiltak, ansvarlig, frist |
| Fagkontroll | Flervalg: Bygg/VVS/El/Brann | Alle | Resultat, kommentar per fag |
| Godkjenning | Enkeltvalg: Godkjent/Avvist | Avvist | Begrunnelse, ny frist |
| Værforhold | Enkeltvalg: OK/Ikke OK | Ikke OK | Tiltak, forsinkelsesårsak |
