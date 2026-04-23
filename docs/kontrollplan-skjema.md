# Kontrollplan — Systemskjema

## 1. Datamodell

```
┌────────────────────────────────���────────────────────────────────────┐
│                          PROJECT                                     │
│  (NRK Bjørvika)                                                      │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Byggeplass A │  │ Byggeplass B │  │ Byggeplass C │               │
│  │ (Blokk A)    │  │ (Blokk B)    │  │ (P-hus)      │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                 │                        │
│         ▼                 ��                 ▼                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─���────────────┐               │
│  │KONTROLLPLAN  │  │KONTROLLPLAN  │  │KONTROLLPLAN  │               │
│  │Blokk A       │  │Blokk B       │  │P-hus         │               │
│  │Status: aktiv │  │Status: utkast│  │Status: utkast│               │
│  └──────┬───────┘  └──────────────┘  └──────────────┘               │
│         │                                                            │
│         ├── Tegninger (plantegninger per etasje)                     │
│         ├── Områder (bad 301, branncelle B2) — fra tegning el. uten  │
│         ├── Faggrupper (VVS-Rør, Elektro, Betong)                    │
│         └── Sjekklistemaler (Membran, Graving, Fylling)              │
└──────────────────────────────────────────���──────────────────────��───┘
```

## 2. Kontrollplanpunkt — kjerneenheten

```
┌────────────────────────���────────────────────────────┐
│              KONTROLLPLANPUNKT                        │
│                                                      │
│  ┌─────────────┐   ┌──────────────┐                 │
│  │   OMRÅDE     │   │  SJEKKLISTE- │                 │
│  │   Bad 301    │ × │  MAL         │                 │
│  │  (VALGFRI)   │   │  Membran     │                 ��
│  └─────────────���   └──────────────┘                 │
│         +                                            │
│  ┌─────────────┐   ┌────���─────────┐                 │
│  │  FAGGRUPPE   │   │    FRIST     │                 │
│  │  VVS-Rør AS  │ + │  Uke 18/2026 │                 │
│  └────────���────┘   └──────────────┘                 │
│         +                                            │
│  ┌────��────────┐   ┌──────────────┐                 │
│  │  MILEPÆL     ��   │  AVHENGER AV │                 │
│  │  (valgfri)   │ + │  (valgfri)   │                 │
│  │  "Bad ferdig"│   │  Graving OK  │                 ���
│  └─────────────┘   └────────��─────┘                 │
│                                                      │
│  Status: planlagt → pågår → utført → godkjent       │
│                                                      │
│  Historikk: opprettet | startet | utført |           │
│             godkjent | avvist | endret               │
└──────────���──────────────────────────────────────────┘
```

## 3. To skalaer — lite vs stort prosjekt

```
LITE PROSJEKT (enebolig, rehabilitering)
─────────────────────────────────────────
Ingen tegninger, ingen områder.
Kontrollplan = flat liste med sjekklister + frister.

┌────────────────────────────────────────────────────┐
│  Kontrollplan — Enebolig Furulund                   │
│  Byggeplass: Furulund 12                            │
│                                                     │
│  Sjekkliste              Faggruppe     Frist  Status│
│  ─────────────────────── ──────────── ────── ──────│
│  Membran våtrom          VVS-R��r      uke 18  ⬜   │
│  Flislegging bad         Flis AS      uke 22  🔒   │
│  Branncelle kjeller      Tømrer AS    uke 14  🟡   │
│  El-kontroll             Elektro AS   uke 24  ⬜   │
│  Sluttkontroll           Prosjektled. uke 26  🔒   │
└────────────────────────────────────────────────────┘


STORT PROSJEKT (industribygg, boligblokk)
─────────────────────────────────────────
Tegninger med markerte områder.
Kontrollplan = matrise (områder × maler).

┌────────────────────────────────────────────────────┐
│  Kontrollplan — Blokk A                             │
│  Byggeplass: Blokk A          12/48 godkjent (25%) │
│                                                     │
│  ═══ Grunnarbeid ferdig (uke 22) ════════ 33% ════ │
│                                                     │
│                FB2 Graving  FD2 Fylling  FE1 Grøft │
│  Kjeller A     ✅ uke 16    🟡 uke 18    ⬜ uke 20 │
│  Kjeller B     🟡 uke 18    ⬜ uke 20    🔒 uke 22 │
│  Rampe         ⬜ uke 20    🔒 uke 22              │
│                                                     │
│  ═══ 2. etg bad ferdig (uke 30) ═══════════ 0% ═══│
│                                                     │
│                Membran      Flis         Sluttktr.  │
│  Bad 301       ⬜ uke 24   🔒 uke 27    🔒 uke 30  │
│  Bad 302       ⬜ uke 24   🔒 uke 27    🔒 uke 30  │
│  Bad 303       ⬜ uke 25   🔒 uke 28    ��� uke 30  │
└──��─────────────────────────────────────────────────┘

UI velger automatisk:
  - Har punkter med områder → matrisevisning
  - Ingen områder           → listevisning
```

## 4. Moduler-siden — inngang

```
┌────────────────────���────────────────────────────────────────────┐
│  Innstillinger > Produksjon > Moduler                            │
│                                                                  │
│  ┌─────────────────┐ ┌───────���─────────┐ ┌���────────────────┐   │
│  │ ✅ Befarings-    │ │ ✅ HMS-avvik     │ │ ✅ Godkjenning   │   │
│  │ rapport          │ │                 │ │                 │   │
│  │ [Deaktiver]     │ │ [Deaktiver]     │ │ [Deaktiver]     │   │
│  └──��──────────────┘ └─────────────────┘ └─────────��───────┘   │
│                                                                  │
│  ┌─────────────────┐ ┌──────────────���──┐ ┌──��──────────────┐   │
│  │ 📋 Kontrollplan  │ │    3D-visning   │ │    Økonomi      │   │
│  │                  │ ���                 │ │                 │   │
│  │ Stedsbasert      │ │                 │ │                 │   ���
│  │ kvalitetskontroll│ │                 │ │                 │   │
│  │ med sporbarhet   │ │                 │ │                 │   │
│  │                  │ │                 │ │                 ��   │
│  │ [Legg til]       │ │ [Legg til]     │ │ [Legg til]     │   │
│  └───────��─────────┘ └─────────────────┘ └─────────────────┘   │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════  │
│  Etter aktivering:                                               │
│                                                                  │
│  ┌──────────────────────────────────────┐                        │
│  │ ✅ Kontrollplan                ✓ Aktiv│                        │
│  │ 📋                                   │                        │
│  │ Stedsbasert kvalitetskontroll        │                        │
│  │ med sporbarhet.                      │                        │
│  │                                      │                        │
│  │ Byggeplass A — aktiv (12 punkter)    │                        │
│  │ Byggeplass B — ikke opprettet        │                        │
│  │                                      ���                        │
│  │ [Åpne kontrollplan ��]  [Deaktiver]   │                        │
│  └────────────────────────���─────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

## 5. Kontrollplan-siden — hovedvisning (med områder)

```
┌─────────���─────────────────────────��─────────────────────────────┐
│  Kontrollplan                     Byggeplass: [Blokk A ▾]       │
│                                                                  │
│  Status: Aktiv          12/48 godkjent (25%)    [+ Nytt punkt]  │
│  ━━━��━━━━━━━━━━���━━━━━━��━━━━━━━��━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                  │
│  Filter: [Alle faggrupper ▾] [Alle kontrollomr. ▾] [Status ▾]  │
│                                                                  │
│  ═══ Milepæl: Grunnarbeid ferdig (mål: uke 22) ═══════ 33% ═══ │
│                                                                  │
│                   FB2 Graving    FD2 Fylling    FE1 Grøft       │
│  ┌────────────┬──���───────────┬──────────────┬──────────────┐    │
│  │Kjeller A   │ ✅ uke 16     │ 🟡 uke 18    │ ⬜ uke 20    │    │
│  │            │ VVS-Rør      │ Betong AS    │ VVS-Rør      │    │
│  ├────────────┼─────────���────┼──────────────┼───────��──────┤    │
│  │Kjeller B   │ 🟡 uke 18    │ ⬜ uke 20    │ 🔒 uke 22    │    │
│  │            │ VVS-Rør      │ Betong AS    │ VVS-Rør      │    │
│  ├────��───────┼──────────────��──────────────┼──────────────┤    │
│  │Rampe       │ ⬜ uke 20    │ 🔒 uke 22    │              │    │
│  │            │ Maskinf.     │ Betong AS    │              │    │
│  └────────────┴─────��────────┴──────────────��──────────────┘    │
│  Fremdrift:    1/3 (33%)      0/3 (0%)      0/2 (0%)           │
│                                                                  │
│  ═══ Milepæl: 2. etg bad ferdig (mål: uke 30) ═════════ 0% ═══ │
│                                                                  │
│                   Membran       Flis          Sluttkontroll     │
│  ┌─────���──────┬──────────────���──────────────┬──────────────┐    │
│  │Bad 301     │ ⬜ uke 24    │ 🔒 uke 27    │ 🔒 uke 30    │    │
│  │            │ VVS-Rør      │ Flis AS      │ Prosjektled. │    │
│  ├────────���───┼──────────────┼──────��───────┼──────────────┤    │
│  │Bad 302     │ ⬜ uke 24    │ 🔒 uke 27    │ 🔒 uke 30    │    │
│  │            │ VVS-Rør      │ Flis AS      │ Prosjektled. │    │
│  ├─────────���──┼──────────────┼──────────────┼───��──────────┤    │
│  │Bad 303     │ ⬜ uke 25    │ 🔒 uke 28    │ 🔒 uke 30    │    │
│  │            │ VVS-Rør      │ Flis AS      │ Prosjektled. │    │
│  └─────���──────┴────────────���─┴──────────────┴──────────────┘    │
│                                                                  │
│  ═══ Uten milepæl ════���═════════════════════════════════════════ │
│                                                                  │
│                   Branncelle                                     │
│  ┌────────────┬──────────────┐                                  │
│  │Celle B1    │ ✅             │                                  │
│  │Celle B2    │ 🟡             │                                  │
│  │Celle B3    │ ⬜ uke 26     │                                  │
│  └────────────┴──────────────┘                                  │
│                                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ✅ Godkjent  🟡 Pågår  ⬜ Planlagt  🔒 Blokkert  🔴 Forfalt    │
│                                                                  │
│                           [Skriv ut PDF ↓]                      │
└────────���────────────────────��───────────────────────────────────┘
```

## 6. Kontrollplan-siden — listevisning (uten områder)

```
┌���───────────────────────────────────���────────────────────────────┐
│  Kontrollplan                     Byggeplass: [Furulund 12 ���]   │
│                                                                  │
│  Status: Aktiv          1/5 godkjent (20%)      [+ Nytt punkt]  ���
│  ━━━━━━━━━━━━━━━━━━━━━��━━━━━━━━━━━━━��━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
���  │ Sjekkliste            Faggruppe       Frist       Status │   │
│  ├──────────────────────────���───────────────────────────────���   │
│  │ Membran våtrom        VVS-Rør AS     uke 18/2026   ⬜    │   │
│  │ Flislegging bad       Flis AS        uke 22/2026   🔒    │   │
│  │   └ avhenger av: Membran våtrom                          │   │
│  │ Branncelle kjeller    Tømrer AS      uke 14/2026   ✅    │   │
│  │ El-kontroll           Elektro AS     uke 24/2026   ⬜    │   │
│  │ Sluttkontroll         Prosjektled.   uke 26/2026   🔒    │   │
│  │   └ avhenger av: Membran, Flis, El-kontroll              │   │
│  ��─────────────────────────────────────────��────────────────┘   ���
│                                                                  │
│  ℹ️ Tips: Marker områder på tegninger for å få matrisevisning   │
│     med bedre oversikt over fremdrift per lokasjon.              │
│                                                                  │
│                           [Skriv ut PDF ↓]                      │
└────────────��───────────────────────���────────────────────────────���
```

## 7. Opprett punkt — inline flyt

```
┌───────────────────��─────────────────────���───────────────────────┐
│  + Nytt kontrollplanpunkt                               [Lukk]  │
│  ──────────────────────────────────────��──────────────────────── │
│                                                                  │
│  1. Sjekklistemal *                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ [Søk eller velg mal...                              ▾]  │    │
│  │                                                         │    │
│  │  Prosjektets maler:                                     │    │
│  ���    ○ Membran våtrom                                     │    ���
│  │    ○ Branncellekontroll                                 │    │
│  │                                                         │    │
│  │  NS 3420-K (importert):                                 │    │
│  │    ○ KB2 – Jordarbeider                                 │    │
│  │    ○ KD1 – Utendørsbelegg                               │    │
│  │                                                         │    │
│  │  NS 3420-F (importert):                                 │    │
│  │    ● FB2 – Graving                    ← valgt           │    │
│  │    ○ FD2 – Fylling og komprimering                      │    │
│  └──────────────────────────────────��──────────────────────┘    │
│                                                                  ���
│  2. Område (valgfri — kun hvis områder finnes)                   │
│  ┌─────��───────────────────────────────────────────────────┐    │
│  │ [Velg område(r)...                                  ▾]  │    │
│  │                                                         │    │
│  │  Kjeller (tegning: Plantegning U1):                     │    │
│  │    ☑ Kjeller A                                          │    │
│  │    ☑ Kjeller B                                          │    │
│  │    ☐ Rampe                                              │    │
│  │                                                         │    │
��  │  3. etasje (tegning: Plantegning 3. etg):               │    │
│  │    ☐ Bad 301                                            │    │
│  │    ☐ Bad 302                                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│  Feltet vises ikke hvis byggeplassen har 0 områder.              │
│                                                                  │
│  3. Ansvarlig faggruppe *                                        │
│  ���─────────────────────────────────────────────────────────┐    │
│  │ [VVS-Rør AS                                         ▾]  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  4. Frist (valgfri)                                              │
│  ┌──────────────┐  ┌───���──────────┐                             │
│  │ Uke: [18   ] │  │ År: [2026  ] │                             │
│  └──────────���───┘  └──────────────┘                             │
│  ℹ️ Planlegg i uker. En VA-kum: frist = uken arbeidet utføres.  │
│     Et bad over 2 mnd: separate frister per sjekkliste.         │
│                                                                  │
│  5. Milepæl (valgfri)                                            │
│  ┌──────��──────────────────────────────────────────────────┐    │
│  │ [Grunnarbeid ferdig (uke 22)                        ▾]  │    │
│  │  ○ Grunnarbeid ferdig (uke 22)                          ��    │
│  │  ○ 2. etg bad ferdig (uke 30)                           │    │
│  │  ○ Ingen milepæl                                        │    │
│  │  [+ Opprett ny milepæl]                                 │    │
│  └���───────��─────────────────────────────────��──────────────┘    │
│                                                                  │
│  6. Avhenger av (valgfri)                                        │
│  ��───────────────────────────────────────��─────────────────┐    │
│  │ [Ingen avhengighet                                  ▾]  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Forhåndsvisning:                                       │    │
│  ��  Oppretter 2 kontrollplanpunkter:                       │    │
│  │    • Kjeller A × FB2 Graving → VVS-Rør, uke 18/2026    │    │
│  │    • Kjeller B × FB2 Graving → VVS-Rør, uke 18/2026    │    │
│  └────────────────────────────────────────���────────────────┘    │
│                                                                  │
│                              [Avbryt]  [Opprett 2 punkter]      │
└─────────────────────────────────────────────────���───────────────┘
```

## 8. Statusflyt

```
  KONTROLLPLAN                    KONTROLLPLANPUNKT
  ─────────────                   ──────────────────

  ┌─────────┐                     ┌──────────┐
  │ utkast  │ ← opprettet        │ planlagt │ ← opprettet
  └────┬────┘                     └─────┬��───┘
       │ prosjektleder                  │ feltarbeider starter
       │ aktiverer                      │
       ▼                                ▼
  ┌─────────┐                     ┌──────────┐
  │  aktiv  │ ← feltarbeid        │  pågår   │ ← sjekkliste åpnet
  └────┬────┘   kan starte        └─────┬────┘
       │ alle punkter                   │ feltarbeider ferdig
       │ godkjent                       │
       ▼                                ▼
  ┌──────────┐                    ┌─────���────┐
  │ godkjent │ ← sluttrapport    │  utført  │ ← sendt til godkjenning
  └──���─┬─────┘   generert        └─────┬────┘
       │                                │ dokumentflyt godkjenner
       ▼                                │
  ┌─���────────┐                          ▼
  │ arkivert │ ← historikk       ┌─────���────┐
  └──────────┘                   │ godkjent │ ← kontrollert OK
                                 └──────────┘

  Avhengigheter:
  ┌──────────┐    godkjent    ┌─────────���┐
  │ Graving  │ ──────────────→│ Fylling  │ låst opp
  │ ✅        │                │ 🔒 → ⬜   │
  └──────────┘                └──────────┘
```

## 9. Tegningsvisning (fremtidig — polygon-verktøy)

```
┌─────────────────────────────────────────────────────────────���───┐
│  Plantegning 3. etasje — Blokk A              [✏️ Marker område]│
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
���  │    ┌─────────┐  ┌─────────┐  ┌─────────┐                │  │
│  │    │░░░░░░░░░│  │▓▓▓▓▓▓▓▓▓│  │         │                │  │
│  │    │░Bad 301░│  │▓Bad 302▓│  │ Bad 303 │                ��  │
│  │    │░░ ✅ ░░░│  │▓▓ 🟡 ▓▓▓│  │   ⬜    │                ���  │
│  │    │░░░░░░░░░│  │▓▓▓▓▓▓▓▓▓│  ���         │                │  │
│  │    └────��────┘  └─────────┘  └─────────┘                │  │
│  │                                                           │  │
│  │         ┌───────────────────────────────┐                │  │
│  ��         │▓▓▓▓▓▓▓���▓���▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│                │  │
│  │         │▓▓  Branncelle B2  ▓▓▓▓▓▓▓▓▓▓▓│                │  │
│  │         │▓▓       🟡        ▓▓▓▓▓▓▓▓▓▓▓│                │  │
│  │         ��▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│                │  │
│  │         └─���─────────────────────────────���                │  │
│  │                                                           │  │
│  └─────���──────────────────────────��──────────────────────────┘  │
│                                                                  │
│  Farger:  ░░ = Grønn (godkjent)                                 │
│           ▓▓ = Gul (pågår)                                      │
│           blank = Grå (planlagt)                                 │
│                                                                  │
│  Områder opprettes ved å tegne polygon på tegning.               │
│  Kontrollplan henter alle områder for valgt byggeplass.          │
└───────���─────────────────────────────��───────────────────────────┘
```

## 10. DB-relasjoner

```
Project ──1:N──→ Byggeplass ──1:N──→ Kontrollplan (1 per byggeplass)
                      │                     │
                      ├──1:N──→ Tegning     ├──1:N──→ Milepel
                      │                     │
                      └──1:N──→ Område      ├──1:N──→ KontrollplanPunkt
                           (VALGFRI) ▲      │              │
                                     │      │              ├──→ Område? (nullable)
                                     └──────┘              ├──→ ReportTemplate (mal)
                                                           ├──→ Faggruppe
                                                           ├──→ Milepel?
                                                           ├──→ Checklist? (oppstart)
                                                           ├──→ KontrollplanPunkt? (avhengighet)
                                                           └──1:N──→ KontrollplanHistorikk
```

## 11. Navigasjon

```
Dashbord
├── Sjekklister
├── Oppgaver
├── Tegninger
├── Kontrollplan  ← NY (vises kun når modul er aktivert)
│   ├── [Byggeplass ▾]  ← velger
│   ├── Matrise ELLER liste (avhengig av områder)
│   ├── [+ Nytt punkt]
│   ├── [+ Ny milepæl]
│   └── [Skriv ut PDF ↓]
├── ...
└── Innstillinger
    └── Produksjon
        └── Moduler
            └── Kontrollplan [✅ Aktiv]
                └── [Åpne kontrollplan →]
```

---

## 12. Fristflytting — tre nivåer

### Nivå 1: Enkelt punkt (klikk i matrise)

```
┌──────────────────────────────────────────────────────────────┐
│                   FB2 Graving    FD2 Fylling    FE1 Grøft   │
│  ┌────────────┬──────────────┬──────────────┬──────────────┐│
│  │Kjeller A   │ ✅ uke 16     │ 🟡 uke 18    │ ⬜ uke 20   ││
│  │            │              │ ← klikk      │              ││
│  └────────────┴──────────────┴──────┬───────┴──────────────┘│
│                                     │                        │
│                               ┌─────┴──────┐                │
│                               │ Endre frist │                │
│                               │             │                │
│                               │ Uke: [20 ▾] │                │
│                               │ År:  [2026] │                │
│                               │             │                │
│                               │ [Flytt]     │                │
│                               └─────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

### Nivå 2: Skyv et område (hele raden)

```
┌──────────────────────────────────────────────────────────────┐
│  Skyv frister for område                                     │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  Område: [Kjeller A ▾]          Forskyv: [+2] uker          │
│                                                              │
│  Berørte punkter:                                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Sjekkliste       Nå        Ny frist                  │   │
│  │ FB2 Graving      uke 16  → uke 18                    │   │
│  │ FD2 Fylling      uke 18  → uke 20                    │   │
│  │ FE1 Grøft        uke 20  → uke 22                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ⚠ FE1 Grøft (uke 22) havner etter milepælen               │
│    «Grunnarbeid ferdig» (mål: uke 22)                       │
│                                                              │
│                            [Avbryt]  [Skyv 3 punkter]       │
└──────────────────────────────────────────────────────────────┘
```

### Nivå 3: Kaskade-flytt (på tvers av områder)

```
┌──────────────────────────────────────────────────────────────┐
│  Kaskade-fristflytting                                       │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  Endring: Kjeller A × FB2 Graving: uke 16 → uke 18 (+2)    │
│                                                              │
│  ⚠ 4 punkter avhenger av dette (direkte og indirekte):      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Punkt                     Nå      → Ny     Type     │   │
│  │                                                      │   │
│  │ Kjeller A:                                           │   │
│  │  FD2 Fylling              uke 18  → uke 20  direkte │   │
│  │  FE1 Grøft               uke 20  → uke 22  via FD2 │   │
│  │                                                      │   │
│  │ Kjeller B:                                           │   │
│  │  FD2 Fylling              uke 20  → uke 22  delt    │   │
│  │  FE1 Grøft               uke 22  → uke 24  via FD2 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ⚠ 2 punkter havner etter milepælen                         │
│    «Grunnarbeid ferdig» (mål: uke 22)                       │
│                                                              │
│  [Kun dette punktet]  [Skyv alle nedstrøms +2 uker]         │
└──────────────────────────────────────────────────────────────┘
```

### Område + kaskade kombinert

```
Scenario: Grunnarbeidet i Kjeller A er 2 uker forsinket.

Trinn 1: Bruker velger "Skyv område: Kjeller A, +2 uker"
Trinn 2: System viser 3 punkter i Kjeller A som forskyves
Trinn 3: System oppdager at Kjeller B × FD2 avhenger av
         Kjeller A × FB2 → tilbyr kaskade
Trinn 4: Bruker ser full forhåndsvisning (3 + 2 = 5 punkter)
Trinn 5: Bruker godkjenner → alle forskyves, historikk logges

Alle endringer sporbare:
  "Frist endret uke 18→20. Årsak: Kaskade fra Kjeller A × FB2 Graving"
```

---

## 13. MS Project som datakilde (fremtidig)

```
┌──────────────────────────────────────────────────────────────┐
│  Importer fra fremdriftsplan                          [Lukk] │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  [Last opp .mpp eller .xml]                                  │
│                                                              │
│  ─── eller via AI-assistent: ───                             │
│  "Importer fremdriftsplanen og foreslå kontrollplan"         │
│                                                              │
│  ═══════════════════════════════════════════════════════════  │
│  Etter parsing:                                              │
│                                                              │
│  Funnet 24 aktiviteter med 8 ressurser og 16 avhengigheter. │
│                                                              │
│  Foreslåtte kontrollplanpunkter:                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ☑ Membran 3. etg    → Bad 301-312  VVS-Rør  uke 18│    │
│  │ ☑ Flislegging 3. etg→ Bad 301-312  Flis AS  uke 22│    │
│  │ ☑ Graving kjeller    → Kjeller A   Maskinf. uke 14│    │
│  │ ☑ Fylling kjeller    → Kjeller A   Betong   uke 16│    │
│  │ ☐ Maling fasade      → (ingen mal i prosjektet)   │    │
│  │   ...                                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Mapping:                                                    │
│  MS Project ressurs    → SiteDoc faggruppe                   │
│  MS Project aktivitet  → SiteDoc sjekklistemal               │
│  MS Project WBS-node   → SiteDoc område (foreslått)          │
│  MS Project FS-link    → SiteDoc avhengerAv                  │
│                                                              │
│                    [Avbryt]  [Importer 22 punkter]           │
└──────────────────────────────────────────────────────────────┘
```

---

## 14. PDF — Kontrollplan utskrift

PDF genereres via `@sitedoc/pdf` (samme mønster som sjekkliste/oppgave).
Filter fra UI følger med — filtrert på faggruppe → PDF viser kun den faggruppens punkter.

### Side 1: Forside

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│                         ┌──────────┐                            │
│                         │  LOGO    │                            │
│                         └──────────┘                            │
│                                                                  │
│                    K O N T R O L L P L A N                       │
│                                                                  │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  Prosjekt:        NRK Bjørvika                                   │
│  Byggeplass:      Blokk A                                        │
│  Prosjektnummer:  2026-042                                       │
│  Tiltaksklasse:   3                                              │
│                                                                  │
│  Ansvarlig søker:     Multiconsult AS                            │
│  Prosjektleder:       Ola Hansen                                │
│  Kontrollansvarlig:   Trude Berg                                │
│                                                                  │
│  Status:          Aktiv                                          │
│  Opprettet:       12.02.2026                                    │
│  Sist oppdatert:  17.04.2026                                    │
│  Punkter:         48 (12 godkjent, 8 pågår, 28 planlagt)       │
│                                                                  │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  Generert: 17.04.2026 14:32                                     │
│  SiteDoc — sitedoc.no                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Side 2: Sammendrag

```
┌─────────────────────────────────────────────────────────────────┐
│  Kontrollplan — Blokk A                                   2/8   │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  SAMMENDRAG                                                      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Totalt    │ Godkjent  │ Pågår     │ Planlagt  │ Forfalt │   │
│  │    48     │  12 (25%) │   8 (17%) │  26 (54%) │  2 (4%) │   │
│  └────────────────────────────────��─────────────────────────┘   │
│                                                                  │
│  FREMDRIFT PER KONTROLLOMRÅDE                                    │
│                                                                  │
│  ┌────────────────────┬────────┬───────────┬──────────────────┐ │
│  │ Kontrollområde     │ Totalt │ Godkjent  │ Fremdrift        │ │
│  ├──���─────────────────┼────────┼───────────┼─��────────────────┤ ��
│  │ Fukt               │     12 │      3    │ ████░░░░░░ 25%   │ │
│  │ Brann              │      6 │      2    │ ███░░░░░░░ 33%   │ │
│  │ Konstruksjon       │      8 │      4    │ █████░░░░░ 50%   │ │
│  │ Grunnarbeid        │     14 │      3    │ ██░░░░░░░░ 21%   │ │
│  │ SHA                │      4 │      0    │ ░░░░░░░░░░  0%   │ │
│  │ Generelt           │      4 │      0    │ ░░░░░░░���░░  0%   │ │
│  └────────────────────┴────────┴─��─────────┴────────────────��─┘ │
│                                                                  │
│  MILEPÆLER                                                       │
│                                                                  │
│  ┌────────────────────────────┬──────────┬───────────┬────────┐ │
│  │ Milepæl                    │ Mål      │ Fremdrift │ Status │ │
│  ├────────────────────────────┼──────────┼───────────┼────────┤ │
│  │ Grunnarbeid ferdig         │ Uke 22   │    33%    │ ⚠ Bak  │ │
��  │ 2. etg bad ferdig          │ Uke 30   │     0%    │ I rute │ │
│  └──���─────────────────────────┴──────��───┴───────────┴��───────┘ │
│                                                                  │
│  FORFALT (krever oppfølging)                                     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ • Kjeller B × FE1 Grøft — frist uke 14, nå uke 17      │   ��
│  │   Faggruppe: VVS-Rør AS                                  │   │
│  │ • Rampe × FB2 Graving — frist uke 15, nå uke 17         │   │
│  │   Faggruppe: Maskinf. AS                                  │   │
│  └──���─────────────────────────────────���─────────────────────┘   │
└──────────��──────────────────────────────────────────────────────┘
```

### Side 3+: Detaljert punktliste (med områder — matrise)

```
┌───────���─────────────────────────────��───────────────────────────┐
│  Kontrollplan — Blokk A                                   3/8   │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  MILEPÆL: Grunnarbeid ferdig (mål: uke 22)                       │
│                                                                  │
│  ┌────────────┬────────────────┬──────────┬────────┬──────────┐ │
│  │ Område     │ Sjekkliste     │Faggruppe │ Frist  │ Status   │ │
│  ├────────────┼────────────────┼──────────┼────────┼──────────┤ │
│  │ Kjeller A  │ FB2 Graving    │ VVS-Rør  │ Uke 16 │ ✅ Godk. │ ��
│  │            │ FD2 Fylling    │ Betong   │ Uke 18 │ 🟡 Pågår │ │
│  │            │ FE1 Grøft     │ VVS-Rør  │ Uke 20 │ ⬜ Planl.│ │
│  ├────────────┼────────��───────┼──────────┼────────┼──────────┤ │
│  ��� Kjeller B  �� FB2 Graving    │ VVS-R��r  │ Uke 18 �� 🟡 Pågår │ │
│  │            │ FD2 Fylling    │ Betong   │ Uke 20 │ ⬜ Planl.│ │
│  │            │ FE1 Grøft     │ VVS-Rør  │ Uke 22 │ 🔒 Blokk.│ │
│  ├─���──────────┼────────────────���──────────┼────────��──────────┤ │
│  │ Rampe      │ FB2 Graving    │ Maskinf. │ Uke 20 │ �� Planl.│ │
│  │            │ FD2 Fylling    │ Betong   │ Uke 22 │ 🔒 Blokk.│ │
│  └────────────┴────────────────┴──��───────┴─��──────┴──────────┘ │
│                                                                  │
│  MILEPÆL: 2. etg bad ferdig (m��l: uke 30)                       │
│                                                                  │
│  ┌────────────┬────────────────┬──────────┬────────┬──────────┐ │
│  │ Område     │ Sjekkliste     │Faggruppe │ Frist  │ Status   │ │
│  ��──���─────────┼────────────────┼──────────┼────���───┼──────────┤ │
│  │ Bad 301    │ Membran        │ VVS-Rør  │ Uke 24 │ ⬜ Planl.│ │
│  │            │ Flislegging    │ Flis AS  │ Uke 27 │ 🔒 Blokk.│ │
│  │            │ Sluttkontroll  │ Prosj.l. │ Uke 30 │ 🔒 Blokk.│ │
│  ├────────────┼────────────────┼──────────��────────┼──────────┤ │
│  │ Bad 302    │ Membran        │ VVS-Rør  │ Uke 24 │ ⬜ Planl.��� │
│  │            │ Flislegging    │ Flis AS  ��� Uke 27 │ 🔒 Blokk.│ │
│  │            │ Sluttkontroll  │ Prosj.l. │ Uke 30 │ 🔒 Blokk.│ │
│  └────────────┴────────────────┴─���────────┴────────┴──────────┘ │
│                                                                  │
│  Avhengigheter i denne milepælen:                                │
│  Membran → Flislegging → Sluttkontroll                           │
└─────��───────────────────────────────��───────────────────────────┘
```

### Alternativ side 3: Detaljert punktliste (uten områder — enkel liste)

```
┌──────────────���──────────────────────────────────────────────────┐
│  Kontrollplan — Furulund 12                                3/4   │
│  ─��────────────────────────────────────────────��──────────────── │
│                                                                  │
│  KONTROLLPUNKTER                                                 │
│                                                                  │
│  ┌────┬──────────────────┬──────────────┬────────┬────────────┐ │
│  │ Nr │ Sjekkliste       │ Faggruppe    │ Frist  │ Status     │ │
│  ├──���─┼──────────────────┼──────────────┼──────��─┼────────────┤ │
│  │  1 │ Branncelle kjell.│ Tømrer AS    │ Uke 14 │ ✅ Godkjent│ │
│  │  2 │ Membran våtrom   │ VVS-Rør AS   │ Uke 18 │ ⬜ Planlagt│ │
│  │  3 │ Flislegging bad  │ Flis AS      │ Uke 22 │ 🔒 Blokkert│ │
│  │  4 │ El-kontroll      │ Elektro AS   │ Uke 24 │ ⬜ Planlagt│ │
│  │  5 │ Sluttkontroll    │ Prosjektled. │ Uke 26 │ 🔒 Blokkert│ ��
│  └────┴──────────────────┴────────────��─┴────────┴────────────┘ │
│                                                                  │
│  Avhengigheter:                                                  │
│  Nr 3 (Flislegging) avhenger av Nr 2 (Membran)                  │
│  Nr 5 (Sluttkontroll) avhenger av Nr 2, 3, 4                    │
└───────────────────────────────────��─────────────────────────────┘
```

### Siste side: Kontrollerklæring (SAK10 §14-7)

```
┌─────────��───────────────────────────────────────────────────────┐
│  Kontrollplan — Blokk A                                   8/8   │
│  ─────────���──────────────────────���────────────────────────────── │
│                                                                  │
│  KONTROLLERKLÆRING                                               │
│  I henhold til SAK10 §14-7                                       │
│                                                                  │
│  Prosjekt:     NRK Bjørvika                                     │
│  Byggeplass:   Blokk A                                          │
│  Tiltaksklasse: 3                                                │
│                                                                  │
│  ─────────────────────────────────────────────────────────────── ���
│                                                                  │
│  Undertegnede bekrefter at kontroll er gjennomført i henhold     │
│  til kontrollplanen for følgende kontrollområder:                │
│                                                                  │
│  ┌────────────────────┬──────────┬────────────┬───────────────┐ │
│  │ Kontrollområde     │ Punkter  │ Godkjent   │ Åpne avvik   │ │
��  ├─���──────────────────┼──────────┼────────────┼───────────────┤ │
│  │ Fukt               │      12  │     12     │      0        │ │
���  │ Brann              │       6  │      6     │      0        │ │
│  │ Konstruksjon       │       8  │      8     │      0        │ │
│  �� Grunnarbeid        │      14  │     14     │      0        │ │
���  │ SHA                │       4  │      4     │      0        │ │
│  │ Generelt           │       4  │      4     │      0        │ │
│  ���────────────────────┼──────────┼────────────���───────────────┤ │
│  │ TOTALT             │      48  │     48     │      0        │ │
│  └──────��─────────────┴─��────────┴─────────��──┴───────────────┘ │
│                                                                  │
│  Avvik:                                                          │
│  ☑ Alle avvik er lukket                                         │
│  ☐ Åpne avvik: se vedlegg                                       │
│                                                                  │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  Ansvarlig kontrollerende:                                       │
│                                                                  │
│  Dato: _______________    Signatur: _________________________   │
│                                                                  │
│  Navn:  Trude Berg        Foretak:  Multiconsult AS              │
│                                                                  │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  Ansvarlig prosjekterende:                                       │
│                                                                  │
│  Dato: _______________    Signatur: _________________________   │
│                                                                  │
│  Navn:  Per Olsen         Foretak:  COWI AS                      │
│                                                                  │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  Generert fra SiteDoc 17.04.2026 14:32                           │
│  Dokumentet er elektronisk generert og signert.                  │
└──────���──────────────────────────────────────────────────────────┘
```

### PDF-oppsett — teknisk

```
Genereres via @sitedoc/pdf (byggKontrollplanHtml):
  - Samme mønster som sjekkliste/oppgave PDF
  - HTML-streng → browser print / expo-print
  - Utskriftsinnstillinger fra prosjekt (logo, prosjektnummer)

Sider:
  1. Forside (prosjektinfo, ansvarlige, status)
  2. Sammendrag (fremdrift per kontrollområde, milepæler, forfalt)
  3–N. Punktliste gruppert etter milepæl
       Med områder: tabell med område-kolonne
       Uten områder: enkel nummerert liste
  N+1. Kontrollerklæring (SAK10 §14-7) — kun ved status "godkjent"

Filter fra UI følger med:
  - Filtrert på faggruppe → PDF viser kun den faggrupens punkter
  - Filtrert på kontrollområde → PDF viser kun det området
  - Brukes for fagrapporter og delrapporter
```
