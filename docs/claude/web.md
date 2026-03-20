# Web — Next.js frontend

## UI-arkitektur

Dalux-inspirert tre-kolonne layout (skjules på mobil < 768px, hamburger-meny i Toppbar):

```
+----------------------------------------------------------+
| TOPPBAR: [SiteDoc] [Prosjektvelger v]     [Bruker v]    |
+------+------------------+--------------------------------+
| IKON | SEKUNDÆRT PANEL  | HOVEDINNHOLD                   |
| 60px | 280px            | Verktøylinje: [Opprett] [...]  |
|      | - Filtre         |                                |
| Dash | - Statusgrupper  | Tabell / Detaljvisning         |
| Sjekk| - Søk            |                                |
| Oppg |                  |                                |
| Maler|                  |                                |
| Tegn |                  |                                |
| Entr |                  |                                |
| Mapp |                  |                                |
| Opps |                  |                                |
+------+------------------+--------------------------------+
```

## Ruter

```
/                                             -> Landingsside (hero, CTA). Innloggede → /dashbord
/logg-inn                                     -> OAuth (klient-side signIn())
/aksepter-invitasjon?token=...                -> Aksepter invitasjon (Server Component)
/personvern                                   -> Personvernerklæring (GDPR)
/utskrift/sjekkliste/[sjekklisteId]           -> PDF-forhåndsvisning (A4)
/dashbord                                     -> Prosjektliste (→ kom-i-gang hvis ingen prosjekter)
/dashbord/kom-i-gang                          -> Velkomstside for nye brukere
/dashbord/nytt-prosjekt                       -> Opprett prosjekt
/dashbord/[prosjektId]                        -> Prosjektoversikt (m/prøveperiode-banner)
/dashbord/[prosjektId]/sjekklister            -> Sjekkliste-tabell
/dashbord/[prosjektId]/sjekklister/[id]       -> Sjekkliste-detalj (utfylling + print)
/dashbord/[prosjektId]/oppgaver               -> Oppgave-tabell
/dashbord/[prosjektId]/oppgaver/[id]          -> Oppgave-detalj
/dashbord/[prosjektId]/maler                  -> Mal-liste
/dashbord/[prosjektId]/maler/[id]             -> Malbygger
/dashbord/[prosjektId]/entrepriser            -> Entreprise-liste
/dashbord/[prosjektId]/mapper                 -> Mapper (read-only, ?mappe=id)
/dashbord/[prosjektId]/tegninger              -> Interaktiv tegningsvisning
/dashbord/[prosjektId]/punktskyer            -> Punktsky-viewer (Potree/Three.js)
/dashbord/[prosjektId]/bilder                 -> Bildegalleri (liste + tegningsvisning)
/dashbord/oppsett                             -> Innstillinger
/dashbord/oppsett/brukere                     -> Brukergrupper, roller
/dashbord/oppsett/brukere/tillatelser         -> Tillatelsesmatrise (read-only)
/dashbord/oppsett/lokasjoner                  -> Lokasjonsliste med georeferanse
/dashbord/oppsett/field                       -> Field-oversikt
/dashbord/oppsett/field/dokumentflyt          -> Dokumentflyt (roller, maler, medlemmer)
/dashbord/oppsett/field/entrepriser           -> Entrepriser med arbeidsforløp (gammel)
/dashbord/oppsett/field/oppgavemaler          -> Oppgavemaler
/dashbord/oppsett/field/sjekklistemaler       -> Sjekklistemaler
/dashbord/oppsett/field/moduler               -> Forhåndsdefinerte mal-pakker
/dashbord/oppsett/field/box                   -> Mappeoppsett
/dashbord/oppsett/prosjektoppsett             -> Prosjektoppsett
/dashbord/oppsett/firma                       -> Firmainnstillinger
/dashbord/admin                               -> SiteDoc-admin (kun sitedoc_admin)
/dashbord/admin/firmaer                       -> Firmaer
/dashbord/admin/prosjekter                    -> Alle prosjekter (m/prøveperiode-kolonner)
/dashbord/admin/testsider                     -> Testsider (prøveprosjekter uten firma, aktive/deaktiverte)
/dashbord/admin/tillatelser                   -> Global tillatelsesmatrise
/dashbord/firma                               -> Firma-admin
/dashbord/firma/prosjekter                    -> Firmaets prosjekter
/dashbord/firma/brukere                       -> Firmaets brukere
/dashbord/firma/fakturering                   -> Fakturering (placeholder)
```

## Kontekster og hooks

- `ProsjektKontekst` — Valgt prosjekt fra URL `[prosjektId]`, alle prosjekter, loading
- `BygningKontekst` — Aktiv bygning + `standardTegning` (persistent, localStorage) + `aktivTegning` (visning). Posisjonsvelger: `startPosisjonsvelger(feltId)` → `fullførPosisjonsvelger(resultat)` → `hentOgTømPosisjonsResultat(feltId)`
- `BilderKontekst` — Visningsmodus (liste/tegning), plasseringsmodus (rapportlokasjon/GPS), datofilter, områdevalg
- `NavigasjonKontekst` — Aktiv seksjon + verktøylinje-handlinger
- `useAktivSeksjon()` — Utleder seksjon fra pathname
- `useVerktoylinje(handlinger)` — Registrerer handlinger per side med auto-cleanup
- `useAutoVaer(...)` — Auto-henter værdata fra Open-Meteo

## Layout-komponenter

- `Toppbar` — Klikkbar logo (→ `/`), prosjektvelger, brukermeny, hamburgermeny (mobil). Admin: ShieldCheck-ikon, Firma: Building2-ikon
- `HovedSidebar` — 60px ikonbar (`hidden md:flex`), deaktiverte ikoner uten prosjekt
- `SekundaertPanel` — 280px panel (`hidden md:flex`)
- `Verktoylinje` — Kontekstuell handlingsbar

## Paneler

- `DashbordPanel` — Prosjektliste med søk
- `SjekklisterPanel` — Statusgruppe-filtrering, standard-tegning badge
- `OppgaverPanel` — Status- og prioritetsgrupper
- `MalerPanel` — Malliste med søk
- `EntrepriserPanel` — Entrepriseliste med søk
- `TegningerPanel` — Bygning+tegningstrevisning med etasje-gruppering, stjerne-standard
- `BilderPanel` — Visningsmodus-toggle (liste/tegning) + tegningsvelger med bygning/etasje-tre
- `MapperPanel` — Klikkbar mappestruktur med søk

## Malbygger

Drag-and-drop i `apps/web/src/components/malbygger/`: `MalBygger`, `FeltPalett`, `DropSone`, `DraggbartFelt`, `FeltKonfigurasjon`, `BetingelseBjelke`, `TreprikkMeny`.

- Rekursiv `RekursivtFelt`-rendering med nesting
- Repeater: grønn ramme, uten BetingelseBjelke
- Slett-validering: blokkeres ved bruk (JSONB `?|` operator)
- Rekkefølge: topptekst-sone først, deretter datafelter

## Print-til-PDF

**Print-header** (`PrintHeader`): logo, prosjektnavn, nr, adresse, dato, sjekkliste-tittel, oppretter/svarer, vær.

**Print CSS** (`globals.css`): `@page { margin: 15mm; size: A4; }`, `.print-header`, `.print-skjul`, `.print-vedlegg-fullvisning`.

**PDF-forhåndsvisning** (`/utskrift/sjekkliste/[sjekklisteId]`): A4-visning utenfor dashbord-layout, `RapportObjektVisning` + `FeltVedlegg`.

**Data-attributter:** `data-panel="sekundaert"`, `data-toolbar`.

## Tegningsvisning

Interaktiv visning med musesentrert zoom (0.25x–50x / 25%–5000%):

**SVG-rendering (DWG-konverterte tegninger):**
- Inline SVG via `dangerouslySetInnerHTML` (ikke `<img>` — kreves for zoom-uavhengig strektykkelse)
- Injisert CSS: `stroke-width: calc(1.5 / var(--svg-zoom, 1)) !important` — tynne linjer uansett zoom
- `--svg-zoom` CSS-variabel settes på container via `style={{ "--svg-zoom": zoom }}`
- SVG hentes, width/height fjernes, erstattes med `width="100%" height="auto"`
- Originale `<style>`-blokker fjernes, egen zoom-aware style injiseres

**Zoom:**
- Multiplikativ scroll-zoom: `faktor = deltaY > 0 ? 0.8 : 1.25`, `zoom * faktor`
- Musesentrert: beregner musposisjon som brøkdel av scroll-container, justerer scrollLeft/scrollTop etter zoom
- Zoom-nivåer for knapper: [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 20, 50]
- Klikk på prosenttall tilbakestiller til 100%

**Markører og plasseringsmodus:**
- Navigering vs. Plasseringsmodus (crosshair-cursor)
- Klikk → blå markør → opprett-modal (oppgave/sjekkliste)
- Eksisterende markører: røde MapPin fra `oppgave.hentForTegning`
- PDF: iframe med transparent overlay

**IFC-metadata:**
- Klikkbar "IFC"-badge i header viser uttrukket metadata (prosjekt, org, GPS, etasjer, programvare)
- Data fra `Drawing.ifcMetadata` (Json-felt, uttrukket ved opplasting)

## Malliste-UI

Delt `MalListe`-komponent: +Tilføy (dropdown), Rediger, Slett, Søk. Enkeltklikk velger, dobbeltklikk åpner.

## Punktsky-viewer

3D-viewer med Three.js + potree-core for punktskyer (LAS, LAZ, E57, PLY):

**Layout:** Sidepanel (280px, liste med opplasting) + hovedområde (3D-viewer)

**Fargemodus (fallback-rekkefølge):**
1. **Klassifisering** (hvis `hasClassification`): ASPRS-farger per klasse, toggle-panel på høyre side
2. **RGB** (hvis `hasRgb`): Opprinnelige farger fra skanningen
3. **Intensitet**: Gråtoneskala basert på refleksjonsstyrke
4. **Høyde (Z)**: Fargegradient basert på z-verdi (alltid tilgjengelig)

**Klassifiserings-panel:** Viser alle klasser med fargeprøve, navn og estimert antall. Klikk for å toggle synlighet. "Alle"/"Ingen"-knapper.

**Konverteringsstatus:** Polling hvert 3. sekund under konvertering. Viser spinnende ikon i listen og fullskjerm ved valg.

**Avhengigheter:** `three`, `potree-core`, `@types/three`

## Sjekkliste-endringslogg

`enableChangeLog` på mal → server-side diff i `oppdaterData` → `ChecklistChangeLog`-poster. `EndringsloggSeksjon` i detaljsiden.

## Oppgavedialog

Kommentarseksjon med `TaskComment`. `DialogSeksjon` med innlinjet tekstfelt, Enter sender.

## Automatisk værhenting

`useAutoVaer` → `trpc.vaer.hentVaerdata` (Open-Meteo, gratis). Kl. 12:00, kilde: "automatisk"/"manuell".

## Prosjektlokasjon og kartvelger

`KartVelger.tsx`: Leaflet + OpenStreetMap, `dynamic(ssr: false)`. Prosjektoppsett: firmalogo, generell info, kartvelger.

## LokasjonObjekt og TegningPosisjonObjekt

Begge i `SKJULT_I_UTFYLLING` — kun lesemodus/print.
- `location`: Leaflet-kart + adresse
- `drawing_position`: Navigasjonsbasert velger via `BygningKontekst`

## Bildegalleri

Samlet oversikt over alle bilder i prosjektet. To visningsmodus:

**Listevisning (standard):** Alle bilder sortert etter dato (nyeste først), gruppert dato → rapport. GPS-varsel (AlertTriangle) på bilder utenfor alle georefererte tegninger. Datofilter med hurtigvalg.

**Tegningsvisning:** Velg tegning fra sidepanelet, bilder vises som prikker på tegningen. Verktøylinje med:
- Plasseringsmodus: "Rapportlokasjon" (solid blå prikker fra drawingId+positionX/Y) eller "GPS" (stiplet prikker via gpsTilTegning())
- Datoperiode-filter med hurtigvalg
- Områdevalg: dra rektangel for å filtrere bilder i et område
- Zoom (0.25x–3x)

`BildeLightbox`: Fullskjerm overlay med pil-navigering, metadata, rapport-lenke. Escape lukker.

## Mer-meny

⋮-knapp: Prosjektinnstillinger (admin), Skriv ut, Eksporter (TODO).
