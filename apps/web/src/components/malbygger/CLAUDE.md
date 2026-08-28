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

## Rekkefølge-sortering

`sortOrder` er globalt (topptekst først, deretter datafelter). `byggObjektTre()` i `@sitedoc/shared` og alle konsumenter sorterer:
1. Sone: topptekst → 0, datafelter → 1
2. Deretter `sortOrder` innenfor sone

## Opsjon-normalisering

Config `options` kan være strenger (`"Ja"`) eller objekter (`{value: "green", label: "Godkjent"}`). ALL rendering MÅ normalisere.

## Fallgruver

- Fast «Lokasjon»-felt øverst i topptekst (grå, ikke slettbart)
- Blå/grønn ramme KUN i malbyggeren — fjernet fra utfylling, print og mobil
- `harBetingelse(config)` er deprecated — bruk `harForelderObjekt()`
- `sortOrder` MÅ oppdateres globalt ved drag — ellers feil rekkefølge i utfylling/print
