# Filter + sortering — én gjenbrukbar komponent + veileder (fabel designgjennomgang 2026-07-24)

TIL REPO: docs/claude/delplaner/filter-sort-komponent-design.md. Backlog-føring: Kenneth. Blokkerer IKKE A-3b.
Visuell spec for tabellhodet/cellene: `Tabellhode Filterspec.dc.html` (dette prosjektet).

## 1. Kartlagt (målt i kode 2026-07-24)

Tre eksisterende mønstre, delvis overlappende:

| Mønster | Hvor | Hva |
|---|---|---|
| **`Table` (@sitedoc/ui)** | hms/tabeller.tsx (2026-05-28-konvertering) | kolonnefilter, sortering, kolonnebredde-resize, status-snarveier; `KolDef` per kolonne (`sorterbar`/`sorterVerdi`/`filtrerbar`/`filterAlternativer`/`filterSnarveier`); filter-state lokal per instans |
| **`FilterPanel` (MultiComboks + SearchInput)** | components/ui/FilterPanel.tsx — Filter-standard 2026-05-29 | presentasjonell blokk: fritekst-søk + N multi-select-dimensjoner i grid + «Tøm filter»; caller eier state (URL eller lokal) |
| **Toppbar-filtre-standard (2026-05-30)** | flate-toppbarer | plassering/komposisjon av filterblokka over lister |
| + sjekklister-listen (test) | «Velg parameter»-knapp + kolonnefiltre Prefix/Status/Tittelemne/Ansvarlig/Opprettet av/Tidsfrist/Flyt | samme behov, egen wiring |

**Diagnose:** primitivene finnes og er gode — det som mangler er (a) ÉN deklarativ konfig som binder dem sammen (i dag skriver hver flate sin egen `feltMapping`/`filtrerRader`/state-wiring), (b) en veileder som sier hvilket mønster som brukes når, (c) konsistent header-visuell (dagens kolonneheader har kollisjon filterikon/tekst — se § 4).

## 2. Forslag: `ListeKontroll` — deklarativ konfig, tre visninger, én motor

IKKE en fjerde widget — en **konfig + hook** som gjenbruker Table/FilterPanel/MultiComboks:

```ts
type ListeKontrollDef<Rad> = {
  dimensjoner: Array<{
    id: string; label: string;                  // ferdig-oversatt
    hent: (r: Rad) => string | string[];        // én kilde for filter OG sort
    type?: "enum" | "tekst" | "dato" | "person";
    sorterbar?: boolean; filtrerbar?: boolean;
    snarveier?: { label: string; verdier: string[] }[];
  }>;
  fritekst?: (r: Rad) => string;                // hva fritekst-søket treffer
  urlState?: boolean;                            // default true: filtre i URL (delbar/tilbake-knapp)
};
const { rader, filterProps, kolonneProps, sort } = useListeKontroll(def, alleRader);
```

- **Motoren** (`useListeKontroll`): filtrering (samme semantikk som dagens `filtrerRader`), sortering (`localeCompare` nb-NO / dato / tall), fritekst, URL-state (ny — i dag lokal; «spore én instans» og deling krever URL).
- **Visning A — kolonnefiltre:** `kolonneProps` mates rett i `Table`-kolonnene (dagens KolDef-felter genereres fra def-en).
- **Visning B — panel:** `filterProps` mates rett i `FilterPanel` (dimensjoner → MultiComboks).
- **Visning C — toppbar:** samme `filterProps`, toppbar-standardens komposisjon.
- Én def per flate gir alle tre; flaten velger visning etter toppbar-standarden. `unikeVerdier`-bygging flyttes inn i motoren (type `"enum"` auto-bygger options fra radene, med antall).

**Veilederen** (docs/claude/retningslinjer/filter-sort-veileder.md, skrives med ordren): når kolonnefilter vs. panel vs. toppbar; alltid `useListeKontroll`, aldri bespoke `filtrerRader`; URL-state default på; «Tøm filter» obligatorisk synlig ved aktivt filter; teller-badge på dimensjon med valg; nye flater skal ikke innføre nye filter-widgets.

## 3. Første konsument: endringslogg-fanen (flyt-rettighetsmatrisen)

Behov «spore én instans av gangen»: dimensjoner = celle (rolle × fra → til, `enum`), hvem (`person`, fritekst-søkbar), kilde; sort = tid (default nyeste først) + celle; fritekst = hvem/celle. Visning B (panel over loggen — loggen er flat liste, ikke kolonnetabell). URL-state gjør «lenke til akkurat denne cellens historikk» gratis: `?celle=utforer:sent→received`.

## 4. Visuelle funn i sjekklister-listen (Kenneths skjermbilde) — fikses i samme runde

1. **Filterikon kolliderer med headertekst (NR).** Rotårsak: ikonet er absolutt/flytende i headercellen. Spec: header = flex-rad `gap:6px`, `justify-content:space-between`; tekst `white-space:nowrap; overflow:hidden; text-overflow:ellipsis`; ikonet egen flex-item `flex-shrink:0` — kan aldri legge seg oppå teksten. Ikon-tilstand: grå når inaktivt, fylt primærblå + prikk når filter er aktivt i kolonnen.
2. **Tittelemne brekker «KD1 – Utendørsbelegg» over tre linjer med strek alene.** Spec: én tekstblokk, `overflow-wrap:anywhere` + `text-wrap:pretty`, ikke tre stablede spans; prefiks-delen («KD1 –») limes med `white-space:nowrap` på prefiks+strek så streken aldri står alene på linje.
3. **FLYT-kolonnen klippes («A.Marku»).** Spec: min-bredde 120px + `text-overflow:ellipsis` med title-tooltip, ELLER initial-chip (A.M.) med tooltip — fabels innstilling: ellipsis + tooltip (bevarer tekst, Kenneths ønske).
4. **Frisøkfeltet:** «Velg parameter»-knappen erstattes av fast synlig SearchInput (Filter-standard 2026-05-29) over tabellen — treffer på tvers av kolonnene (tittelemne, ansvarlig, opprettet av, nr). Aktive kolonnefiltre vises som chips ved feltet (×-fjerning) + «Tøm filter»; teller («2 av 9») høyrestilt samme rad. Parametervalg ER kolonnefiltrene — egen knapp utgår.
5. **Tomme kolonner (Tidsfrist/Flyt full av «—»)** gjør tabellen bred uten informasjon. Forslag (ikke krav): «—»-celler i lysere grå `#c4c1ba` så data-celler dominerer visuelt.
5. Radhøyde: cellene med tre stablede linjer gir ujevn rytme — etter fiks 2 blir normal rad 2 linjer maks.

## 5. Estimat (til backlog)

- **Fiks § 4 (header-kollisjon + brekking + ellipsis):** liten — CSS/markup i Table-headeren + sjekkliste-cellene, ingen ny arkitektur. Kan gå som egen liten runde straks.
- **`useListeKontroll` + refaktor av én eksisterende flate (HMS eller sjekklister) + veileder:** middels — motoren er i hovedsak flytting av eksisterende logikk (filtrerRader/unikeVerdier/sort) bak én def; URL-state er det eneste nye. ~1 kloss.
- **Endringslogg-fanen som konsument:** liten når motoren finnes (def + FilterPanel-visning).
- Anbefalt rekkefølge: § 4-fiksen nå (synlig kvalitetsløft, null risiko) · motor+veileder som backlog-kloss · endringslogg-konsumenten når motoren lander. Ingenting av dette blokkerer A-3b.
