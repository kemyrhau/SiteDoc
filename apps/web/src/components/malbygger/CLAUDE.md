# Malbygger — Drag-and-drop med rekursiv nesting

## Oversikt

Dalux-stil malbygger med dnd-kit. 9 komponenter, ~1900 linjer. Tre-kolonne layout: FeltPalett (venstre) → DropSoner (midten) → FeltKonfigurasjon (høyre).

## Komponenthierarki

```
MalBygger (hovedorkestrator)
├── FeltPalett → PalettElement (draggbare 23 felttyper)
├── DropSone (topptekst + datafelter)
│   └── RekursivtFelt (rekursiv)
│       ├── DraggbartFelt (sortable)
│       ├── BetingelseBjelke (betingelses-UI for kontainere)
│       └── RekursivtFelt (barn, rekursivt)
├── FeltKonfigurasjon (høyre panel)
├── DragOverlay_ (visuell feedback)
└── TreprikkMeny (kontekstmeny per felt)
```

## Trebygging (flat → tre)

API returnerer flat array. `byggTre()` i MalBygger:
1. Grupper etter `parentId` (null = rot)
2. Sorter etter sone (`config.zone === "topptekst"` → 0, ellers 1), deretter `sortOrder`
3. Splitt i topptekst-felter og datafelter
4. Rekursivt bygg barn for kontainere

## Kontainer-nesting

**Tre kontainertyper:** `list_single`, `list_multi`, `repeater`

| Type | Aksepterer barn | Betingelse | Visuelt |
|------|----------------|-----------|---------|
| `list_single` | Kun med `conditionActive: true` | BetingelseBjelke med trigger-verdier | Blå ramme |
| `list_multi` | Kun med `conditionActive: true` | BetingelseBjelke med trigger-verdier | Blå ramme |
| `repeater` | Alltid | Ingen betingelse | Grønn ramme |

- Forelder-barn via `report_objects.parent_id` (DB-kolonne, IKKE config JSON)
- `conditionValues: string[]` i config definerer hvilke verdier som viser barnefelt
- Ubegrenset nesting-dybde (eske-i-eske)

## Drag-and-drop logikk

- Felt arver `parentId` ved drop i kontainer
- Felt nullstiller `parentId` ved drag ut av kontainer
- `sortOrder` oppdateres for alle berørte felter
- Nye felter fra paletten: opprett via API, deretter legg inn i treet

## Slett-validering

Sletting av rapportobjekter blokkeres hvis **faktisk innhold** finnes:
1. `mal.sjekkObjektBruk` (klient) og `mal.slettObjekt` (server-guard) deler predikatet
   `harFaktiskInnholdForObjekt` (`mal.ts`) — teller kun sjekklister/oppgaver med FAKTISK
   lagret verdi/kommentar/vedlegg for objektet (eller en etterkommer), i AKTIVE dokumenter
   (`deleted_at IS NULL`). Skjerpet 2026-08-28: `?|` (nøkkel finnes) ga falsk positiv fordi
   klienten auto-lagrer `{verdi:null,kommentar:"",vedlegg:[]}` for hvert felt så snart et
   dokument åpnes; og soft-slettede dokumenter blokkerte i det uendelige. Begge må bruke
   SAMME predikat — ellers sier klienten «ingen bruk», serveren nekter, og optimistisk
   fjerning rulles stille tilbake ved refetch.
2. `SlettBekreftelse`-modal viser berørte dokumenter
3. Slett-knappen skjules helt ved bruk
4. Feiler serverslettingen likevel, vises serverens melding (`malbygger.slettFeiletTittel`
   + `error.message`) i stedet for stille rollback (`slettMutation.onError`)
5. DB CASCADE sletter barn automatisk

**Endringsvern (2026-09-07, samme predikat):** `oppdaterObjekt` og `oppdaterRekkefølge` nekter en
MENINGSBÆRENDE endring på et felt med faktisk innhold — ellers ville et krav-bytte i malen slått
gjennom på alle eksisterende dokumenter (Checklist bærer bare `templateId`, leser `template.objects`
live; ingen malversjon). Kenneth valgte SPERRE, ikke versjonering. Gjelder PER PROSJEKT (firmamaler
KOPIERES, `template_id` er isolert). Meningsbærende = config-endring utenfor `{helpText, placeholder,
multiline, role}` (prøvestein: kan endringen få et signert dokument til å si noe ANNET om hva som ble
kontrollert? `zone` → ja, i sperr) ELLER en `parentId`-flytting (bryter grense-arv). `label`/`required`/
kosmetisk slipper. Delt kjerne `samleEtterkommere` + `tellDokumenterMedInnhold` (gjenbruker
`harFaktiskInnholdForObjekt`) — ETT predikat, tre kallsteder (slett/oppdater/rekkefølge) kan ikke drifte.

## Rekkefølge-sortering

`sortOrder` er globalt (topptekst først, deretter datafelter). `byggObjektTre()` i `@sitedoc/shared` og alle konsumenter sorterer:
1. Sone: topptekst → 0, datafelter → 1
2. Deretter `sortOrder` innenfor sone

## Opsjon-normalisering

Config `options` kan være strenger (`"Ja"`) eller objekter (`{value: "green", label: "Godkjent"}`). ALL rendering MÅ normalisere. `normaliserOpsjon` bor i `@sitedoc/shared` (trinn 0-flytting 2026-09-06).

## Grense-konfig (integer/decimal) — `GrenseKonfig` i `FeltKonfigurasjon.tsx`

Grenseresolver-ordre trinn 2. Erstatter de fire frie tallfeltene med **kravtype i klarspråk**
(nedtrekk «Krav til verdien»: Ingen krav / Minst / Høyst / Mellom / Innenfor ±) — aldri symboler.
Kun tallene kravtypen trenger vises (2 for «Mellom», 1 ellers). Skriver `config.kravType`
(`minst|hoyst|mellom|toleranse`); eldre maler uten nøkkel utledes av `lesKravType` (ingen backfill).

- **Live kvitteringslinje** (hvit boks): «Vises som «≤ 10 mm» — avvik når målt verdi er over 10.»
  Symbolformen bygges av `formaterGrenseKrav` — forfatteren skriver aldri symbolet.
- **Vei B — «Grensen avhenger av et valg»:** checkbox (disabled uten kandidater) → styrende-felt-
  nedtrekk (`list_single` i samme kontekst, lavere sortOrder) → varianttabell. Skriver
  `config.styrendeFeltId` + `config.grenseVarianter: [{valg,min?,maks?,toleranse?}]`. Kolonner
  følger kravtype. **Satt vs. arvet skilles på FORM, ikke tekstfarge** (fabel-vedtak 06.09 etter
  Kenneth-testkjøring — `avviksvedtak-grensevariant-tabell-fabel-2026-09-06.md`): satt celle =
  blå kant + fet tall + ✕ (nullstiller → arv); arvet celle = stiplet grå kant, tom, med
  standardens symbolform som grå kursiv placeholder («≤ 10»). Ingen forhåndsutfylling — arv er
  fravær av nøkkel i data. **Intro-linje** (lys blå boks) læres bort FØR tabellen. **«Ellers
  (standard)»** er tekstlinje UNDER tabellen, ikke en rad. **Foreldreløse varianter** (omdøpt/
  slettet opsjon) blir stående som amber linje med Fjern — aldri stille sletting. Vei B har egen
  kvitteringslinje: «valg: krav · … · ellers krav».
- Resolveren `løsGrense` (`@sitedoc/shared`) er eneste inngang; utfylling (web+mobil Heltall/Desimal)
  får styrende felts verdi via `forelderVerdi`-prop. Mockup: `docs/redesign/mockups/MalBygger Grensevarianter Mockup.dc.html`.
- **Avviksfelt-utløser (trinn 3 del C):** et tallfelt kan bli kontainer med utløser «utenfor krav»
  i stedet for en verdiliste. Bryter i `GrenseKonfig` («Vis felt ved verdi utenfor krav», vises når
  det finnes et krav) → `handleSettUtenforKrav` setter `config.conditionActive` + `config.conditionType
  = "utenfor_krav"` (av → `handleFjernBetingelse`, frigjør barn). Ny `conditionType` (default fravær =
  `"verdi"` = dagens verdimatch); ingen migrering. `akseptererBarn` slapp alt tallfelt gjennom
  (spør kun `conditionActive`). `DropSone` viser en amber statisk bjelke (ikke verdi-chip-`BetingelseBjelke`)
  når `conditionType === "utenfor_krav"`. Synlighet evalueres i alle fire hooks via delt
  `utenforKravOppfylt` (`grenseStatus(...) ≠ ok`). Én utløser, retningen er tilstand. Avviksfeltene
  (Årsak/Tiltak) er vanlige barn-malobjekter. Beregnet avvik vises i utfylling (`byggAvvikLinje`) og
  arkiv-PDF (`grenseSnapshot.avvikTekst`). Mockup: `docs/redesign/mockups/Avviksfelt Mockup.dc.html`.
- **Avvik fra mockup (meldt):** mockupen skjuler enhet ved «Ingen krav»; her beholdes enhet alltid
  så et måltall uten krav ikke mister enheten. Avviksfelt-utløseren (panel C i mockup) er trinn 3.

## Fallgruver

- Fast «Lokasjon»-felt øverst i topptekst (grå, ikke slettbart)
- Blå/grønn ramme KUN i malbyggeren — fjernet fra utfylling, print og mobil
- `harBetingelse(config)` er deprecated — bruk `harForelderObjekt()`
- `sortOrder` MÅ oppdateres globalt ved drag — ellers feil rekkefølge i utfylling/print
