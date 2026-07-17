# Malbygger — Arkitekturdokument

Én felles malbygger der bruker velger dokumenttype ved oppstart. Typen bestemmer flyt, låseregler og ruting.

## Grunnprinsipp — type vs modifikator

**Oppgave og Sjekkliste er fundamentalt forskjellige dokumenttyper** med separate tabeller (`Task` vs `Checklist`), ulike låseregler og ulike workflow-mønstre. De skal aldri slås sammen til én liste eller blandes i UI.

**HMS og Godkjenning er modifikatorer** på en mal-type — ikke typer i seg selv. En HMS-mal er enten en HMS-oppgave eller en HMS-sjekkliste. Tilsvarende for Godkjenning når den modulen designes.

Dette prinsippet styrer UI-arkitekturen: mal-administrasjon kan ha to separate lister (oppgavemaler/sjekklistemaler) — det er korrekt. HMS-haken settes på en mal innenfor sin type, ikke som en alternativ type.

Bakgrunn: feilformulert planleggings-utkast 2026-05-26 antydet «én samlet mal-builder» som skulle erstatte de to listene. Det viste seg å være feil scope — Kenneth presiserte at dokumenttypene har grunnleggende forskjellig funksjon og må holdes separate i datamodell, server-routing og UI.

## Dokumenttyper

| Type | Kategori | Flyt | Låseregel | Ruting | Domain |
|------|----------|------|-----------|--------|--------|
| **Sjekkliste** | `sjekkliste` | Toveis | Kan redigeres etter utkast | Standard faggruppeflyt | `bygg` / `kvalitet` |
| **Oppgave** | `oppgave` | Toveis | Låses etter utkast (append-only) | Krever faggruppe-valg | `bygg` |
| **HMS (RUH/SJA)** | `oppgave` | Toveis | Låses etter utkast (append-only) | Auto-ruter til HMS-gruppe | `hms` |
| **Godkjenning** | `oppgave` | Enveis | Låses etter utkast | Bestiller → godkjenner, ingen retur | `bygg` |
| **Timeregistrering** (planlagt) | `sjekkliste` | Toveis (forenklet) | Append-only etter sending | Ansatt → leder, kun utførelse | `bygg` |

### Timeregistrering — planlagt dokumenttype

Egen forelder-objekt-type i malbyggeren slik at timeregistrering kan kobles til **Underprosjekt**.

**Krav:**
- Forelder-objekt «Timeregistrering» som kan inneholde standard malbygger-felter (timer, lønnsart, kommentar, signatur etc.)
- Kobling til Underprosjekt-modell (proadm- eller dokumentflyt-koblet — se [docs/claude/timer.md](docs/claude/timer.md))
- **Forenklet godkjenningsflyt**: kun utførelse, ingen økonomi-diskusjon
  - Skal IKKE inneholde: priser, satser, kostnader, fakturering, beløp, kontraktssum
  - Skal kun inneholde: hva er gjort, antall timer, hvilken aktivitet, kommentar om utførelse
- Sendes til ansatt for bekreftelse/godkjenning (toveis: leder → ansatt → leder)
- Bruker malbyggerens eksisterende felttyper (heading, integer, decimal, list_single, signature, attachments)

**Hvorfor egen type:** Timeregistrering har et separat økonomi-spor (lønn, fakturering) som administreres i Proadm eller annet system. Malbygger-versjonen er kun for utførelses-bekreftelse mellom leder og ansatt. Dette skiller den klart fra Godkjenning-typen som kan inkludere økonomi.

**Avledning fra Godkjenning eller Proadm:** Et Underprosjekt (som timeregistreringen kobles til) opprettes ikke selvstendig. Det avledes alltid fra:
- En **Godkjenning**-dokumentinstans i SiteDoc dokumentflyt (når SiteDoc er kilde), eller
- En endring/varsel/regningsarbeid importert fra **Proadm** (når Proadm er kilde)

Den formelle godkjenningen (med økonomi) lever i kilde-systemet. Timeregistrering-malen og det avledede Underprosjektet er det forenklede speilbildet ansatte forholder seg til. Se [docs/claude/timer.md](docs/claude/timer.md#underprosjekt-modell-planlagt-packagesdb-timer) for modell.

## Eksisterende modeller malbyggeren bygger på

### ReportTemplate (`report_templates`)

Sentral mal-modell. Alle dokumenttyper bruker den.

| Felt | Type | Rolle i malbygger |
|------|------|-------------------|
| `category` | `"sjekkliste" \| "oppgave"` | Bestemmer om dokumentet lagres som Checklist eller Task |
| `domain` | `"bygg" \| "hms" \| "kvalitet"` | Styrer tilgangskontroll (lag 3) og HMS-spesialbehandling |
| `prefix` | `string?` | Auto-nummerering (f.eks. `HMS-001`, `GM-003`) |
| `subjects` | `JSON` | Forhåndsdefinerte emner for nedtrekk |
| `showSubject/Enterprise/Location/Priority` | `boolean` | Vis/skjul standardfelter i opprettelsesdialog |
| `enableChangeLog` | `boolean` | Auto-logg feltendringer (kun sjekklister) |

### ReportObject (`report_objects`)

Feltdefinisjon. Flat lagring med `parentId` for hierarki.

| Felt | Rolle |
|------|-------|
| `type` | En av 23 felttyper (se under) |
| `config` | JSON — type-spesifikk konfigurasjon (`options`, grenseverdier, `multiline`, `zone` — se Grenseverdier under) |
| `sortOrder` | Global sorteringsrekkefølge innenfor malen |
| `parentId` | Nesting under `repeater` eller betingede `list_single/list_multi` |
| `required` | Påkrevd for utfylling |
| `translations` | i18n-oversettelser per språk |

### 23 felttyper

| Gruppe | Typer |
|--------|-------|
| Tekst | `heading`, `subtitle`, `text_field`, `info_text` |
| Valg | `list_single`, `list_multi`, `traffic_light`, `quiz` |
| Tall | `integer`, `decimal`, `calculation` |
| Dato | `date`, `date_time` |
| Person/firma | `person`, `persons`, `company` |
| Media | `attachments`, `info_image`, `video` |
| Posisjon | `location`, `drawing_position` |
| BIM | `bim_property`, `zone_property`, `room_property` |
| Signatur | `signature` |
| Vær | `weather` |
| Container | `repeater` (barn), `list_single/multi` (betinget) |

### Grenseverdier på tall-felt (`integer`/`decimal`) — norsk kanonisk (fase M-3a del 2, 2026-07-16)

`config`-nøklene for grenseverdier har **norsk kanonisk form** som skrives fra
MalBygger-editoren (`FeltKonfigurasjon.tsx`), med **engelsk fallback-lesing** for
eldre/seedede maler:

| Semantikk | Kanonisk (skrives) | Fallback (leses også) | Validering |
|-----------|--------------------|-----------------------|------------|
| Nedre grense | `min` | — | verdi < `min` → «under» |
| Øvre grense | `maks` | `max` | verdi > `maks` → «over» |
| Toleransebånd | `toleranse` | — | ⚠️ **BUG:** `abs(verdi)` > `toleranse` → «utenfor_toleranse». Se vedtaket under |
| Desimaler | `desimaler` | `decimals` | input-step |
| Enhet | `enhet` | `unit` | visning |

- **Hvorfor to nøkkelsett:** NS3420-testmalene ble seedet med norske nøkler
  (`packages/db/prisma/seed-bibliotek.ts`: `{ enhet, min, maks, toleranse }`),
  mens defaultConfig/renderne historisk brukte `unit`/`max`. Vedtak 2026-07-16
  (Kenneth): norsk kanonisk + engelsk fallback-les — begge populasjoner rendrer,
  seed røres ikke.
- **Ett lesested:** normaliseringen bor i `@sitedoc/shared` (`utils/grenseSjekk.ts`:
  `normaliserGrense`/`grenseStatus`/`formaterGrense`), gjenbrukt av editor,
  web+mobil-render og validering — som `normaliserOpsjon` gjør for valg-opsjoner.
- **Grenser blokkerer ikke innsending** — et avvik er et gyldig funn. Utfylling
  viser grensen (språknøytralt: ≥ ≤ ±) og markerer verdi utenfor med amber-signal.

### 🟡 VEDTATT, IKKE BYGGET — to grense-typer, gjensidig utelukkende (Kenneth 2026-07-16)

**Buggen som utløste vedtaket:** `grenseSjekk.ts` gjør `Math.abs(verdi) > toleranse`. Målt på test: verdi 10, min 8, maks 12, toleranse 2 → amber på en verdi midt i det gyldige området. Toleranse er et ± **rundt noe**, og referansen finnes ikke i config. Del 2 gjettet at feltet bærer et avvik (da er `abs(verdi) > toleranse` riktig — det er nominell 0). Kenneth bruker det som en måling.

**Kenneths tre begreper** (hans ordlyd, 2026-07-16):

- **Målt verdi** — det den ansatte kontrollerer på byggeplass. Bor i feltet.
- **Nominell verdi** — middelverdi fra NS, med tilhørende toleranser. Følger standarden → malen.
- **Prosjektert verdi** — verdi fra tegning/beskrivelse. **Bygges ikke.**

**Vedtatt modell — et tallfelt er ENTEN område ELLER toleranse:**

- **Område-felt:** config `min` + `maks`. Regel: `verdi < min || verdi > maks`. NS3420: smågatestein **8/12**.
- **Toleranse-felt:** config `nominell` + `toleranse`. Regel: `abs(verdi − nominell) > toleranse`. NS3420: planhet **± 30 mm**.

**Hvorfor gjensidig utelukkende:** Kenneth — *«8/12 beskriver størrelsen på en stein med medium 10 cm; avvik ± blir meningsløst å kombinere»*. **10 ± 2 = 8–12.** De er to notasjoner for én regel, ikke to regler. Kombinert sier de enten det samme to ganger, eller to ting som motsier hverandre.

**`nominell` defaulter til 0** → NS3420-maler seedet med `{enhet: "mm", toleranse: 30}` virker uendret. Seeden røres ikke.

**Prosjektert verdi bygges IKKE.** Malene lages utelukkende på NS3420; avvik fra tegning skrives som tekst og går gjennom avviksbehandling. Bygget vi `prosjektert ?? nominell`, ville `prosjektert` blitt en nøkkel ingen skriver — samme klasse som `traffic_light.options` og `enhet` før del 2.

**Gjenstår å bygge:** ett config-felt (`nominell`), én linje i `grenseSjekk.ts` (`abs(verdi − (nominell ?? 0))`), XOR-bryter i editoren, `formaterGrense` som viser «10 ± 2 cm» mot «8–12 cm». Kenneth valgte «la stå» på test inntil ordren rutes.

## Eksisterende ruter (API)

### mal.ts — CRUD

| Rute | Beskrivelse |
|------|-------------|
| `hentForProsjekt` | Alle maler med objekttellere |
| `hentMedId` | Én mal med alle objekter sortert |
| `opprett` | Ny mal (createTemplateSchema) |
| `oppdaterMal` | Metadataendringer |
| `slettMal` | Slett med kaskade |
| `leggTilObjekt` | Nytt felt med type, config, parentId |
| `oppdaterObjekt` | Felt-endring |
| `oppdaterRekkefølge` | Batch sortOrder + zone + parentId |
| `slettObjekt` | Slett med sjekk for eksisterende data (`sjekkObjektBruk`) |
| `oversettFelter` | On-demand i18n-oversettelse |

### modul.ts — Modulaktivering

Moduler (definert i `PROSJEKT_MODULER`) auto-oppretter maler med forhåndskonfigurerte felter ved aktivering. Eksempel: `hms-avvik`-modulen oppretter HMS-mal med 11 felter (alvorlighetsgrad, beskrivelse, tiltak, trafikklys, signatur).

## Felles logikk vs type-spesifikk logikk

### Felles (uavhengig av dokumenttype)

| Funksjon | Beskrivelse |
|----------|-------------|
| **Feltpalett** | Dra-og-slipp fra 23 felttyper — identisk for alle dokumenttyper |
| **Sonemodell** | Topptekst (zone 0) + Datafelter (zone 1) — alle typer |
| **Hierarki** | `parentId`-nesting, `repeater`-barn, betingede containere — alle typer |
| **Feltkonfigurasjon** | Høyrepanel for label, required, config-opsjoner — alle typer |
| **Sortering** | Global `sortOrder`, dra-for-å-flytte — alle typer |
| **Forhåndsvisning** | Renderer bruker samme `RapportObjektRenderer` — alle typer |
| **Oversettelse** | i18n-felt med `translations`-JSON — alle typer |
| **Dataintegritet** | `sjekkObjektBruk` før sletting — alle typer |

### Type-spesifikk logikk

| Funksjon | Sjekkliste | Oppgave | HMS | Godkjenning |
|----------|------------|---------|-----|-------------|
| **Kategori** | `sjekkliste` | `oppgave` | `oppgave` | `oppgave` |
| **Domain-valg** | `bygg`/`kvalitet` | `bygg` | `hms` (låst) | `bygg` (låst) |
| **Emner** | Valgfritt | Valgfritt | Forhåndsdefinert | Nei |
| **`showEnterprise`** | Ja | Ja | Nei (auto-rutes) | Ja |
| **`showPriority`** | Nei | Ja | Ja | Nei |
| **`enableChangeLog`** | Tilgjengelig | Nei | Nei | Nei |
| **Låseregel** | Felt redigerbare etter sending | Append-only etter sending | Append-only etter sending | Append-only etter sending |
| **Flyt** | Toveis (bestiller ↔ utfører) | Toveis (bestiller ↔ utfører) | Toveis (melder ↔ HMS-gruppe) | Enveis (bestiller → godkjenner) |
| **Statusoverganger** | Standard maskin | Standard maskin | Standard maskin | Begrenset (ingen `rejected → in_progress`) |
| **Standardfelter** | Ingen påkrevde | Ingen påkrevde | Alvorlighetsgrad, Beskrivelse (påkrevd) | Beslutning (påkrevd) |

## Eksisterende sider som erstattes

| Nåværende side | URL | Erstattes av |
|----------------|-----|-------------|
| Sjekklistemaler (liste) | `/oppsett/produksjon/sjekklistemaler` | Felles malliste med typefilter |
| Sjekklistemaler (editor) | `/oppsett/produksjon/sjekklistemaler/[id]` | Felles malbygger |
| Oppgavemaler (liste) | `/oppsett/produksjon/oppgavemaler` | Felles malliste med typefilter |
| Oppgavemaler (editor) | `/oppsett/produksjon/oppgavemaler/[id]` | Felles malbygger |

Nye sider:

| Side | URL | Beskrivelse |
|------|-----|-------------|
| Alle maler | `/oppsett/produksjon/maler` | Felles liste, filter på type |
| Ny mal | `/oppsett/produksjon/maler/ny` | Velg dokumenttype → opprett |
| Rediger mal | `/oppsett/produksjon/maler/[id]` | Felles malbygger, type-kontekst fra malen |

## Malbygger-komponent (eksisterende)

Ligger i `apps/web/src/components/malbygger/` med 9 filer:

| Fil | Ansvar |
|-----|--------|
| `MalBygger.tsx` | Orkestrator (~1900 linjer), dnd-kit, tilstandshåndtering |
| `FeltPalett.tsx` | Venstre panel — 23 draggbare felttyper |
| `DropSone.tsx` | Senterpanel — topptekst + datafelter-soner |
| `DraggbartFelt.tsx` | Sorterbart felt med `useSortable` |
| `FeltKonfigurasjon.tsx` | Høyrepanel — rediger valgt felt |
| `BetingelseBjelke.tsx` | Betingelse-UI for list-containers |
| `DragOverlay_.tsx` | Visuell feedback under drag |
| `TreprikkMeny.tsx` | Kontekstmeny per felt |
| `typer.ts` | Typedefinisjon |

**Bygger allerede for begge kategorier** — ingen endring i kjernelogikken. Endringen er å legge til type-kontekst som styrer:
- Hvilke felt som er standard/påkrevde
- Hvilke metadata-innstillinger som vises
- Validering ved lagring

## Migreringsstrategi

### Eksisterende maler bevares

1. **Ingen database-endring** — `ReportTemplate` og `ReportObject` forblir uendret
2. **Ingen migrering av data** — eksisterende maler beholder sin `category` og `domain`
3. **Gradvis overgang** — nye URL-er aktiveres, gamle redirigerer:
   - `/oppsett/produksjon/sjekklistemaler` → `/oppsett/produksjon/maler?type=sjekkliste`
   - `/oppsett/produksjon/oppgavemaler` → `/oppsett/produksjon/maler?type=oppgave`
   - `/oppsett/produksjon/sjekklistemaler/[id]` → `/oppsett/produksjon/maler/[id]`
   - `/oppsett/produksjon/oppgavemaler/[id]` → `/oppsett/produksjon/maler/[id]`
4. **Gamle sider fjernes** etter verifisering (1 sprint)

### Modulaktiverte maler

Maler opprettet via modulaktivering (`modul.aktiver`) får riktig `category` og `domain` automatisk. Ingen endring nødvendig i modul-definisjoner — de definerer allerede `kategori` og `domain`.

### Dokumentflyt-tilknytning

Dokumentflyt-maler (`dokumentflytMaler`) tilknyttes via `templateId`. Denne relasjonen endres ikke. Malbyggeren viser tilknyttede dokumentflyter i metadata-panelet.

## Beslutninger

### 1. Godkjenningsflyt — ledd-basert retning

Antall ledd i dokumentflyten bestemmer retning:

| Ledd | Retning | Eksempel |
|------|---------|---------|
| 2 | Toveis — kan sende tilbake | Bestiller ↔ Godkjenner |
| 3+ | Enveis — men kan be om dokumentasjon ett ledd tilbake | A → B → C (B kan be A om mer info) |

Ingen per-mal-konfigurasjon av tillatte overganger. Retningen utledes automatisk fra antall ledd. `isValidStatusTransition()` forblir uendret — enveis-begrensningen styres i UI (hvilke knapper som vises) og i `verifiserFlytRolle()`.

### 2. Feltlåsing — dataintegritet

Felter med eksisterende data kan **aldri** fjernes fra malen, uavhengig av dokumenttype. Gjelder sjekkliste, oppgave, HMS og godkjenning likt.

- Eksisterende `sjekkObjektBruk()`-sjekken i API håndhever dette allerede
- Malbygger-UI viser lås-ikon og deaktivert slett-knapp for felter med data
- Felter uten data kan fritt fjernes/flyttes

HMS-standardfelter (Alvorlighetsgrad, Beskrivelse) er ikke hardkodet — admin kan fjerne dem **så lenge ingen dokumenter har brukt dem**.

### 3. Type-endring — tillatt så lenge ingen dokumenter eksisterer (revidert 2026-05-26)

Type kan endres i mal-rediger-modalen så lenge malen ikke har eksisterende dokumenter (Task- eller Checklist-rader). Server validerer i `mal.oppdaterMal` ved å telle `task.count + checklist.count` for malen og avviser konvertering hvis totalt > 0. UI speiler reglen — type-radio er disabled med forklarende tekst når dokumenter eksisterer.

HMS-status (domain "hms" via HMS-hake) kan endres uten begrensning, men UI viser advarsel om at tilgangskontroll for eksisterende dokumenter endres umiddelbart.

Godkjenning forblir spesiell — Godkjenning-modul-redesign vil definere flytregler. Eksisterende doc-tekst i `docs/claude/dokumentflyt.md` om «Godkjenning kan aldri flyttes til en sjekklisteflyt eller oppgaveflyt» beholdes inntil videre som flyt-regel (ikke type-regel).

Tidligere absolutt-forbud erstattet 2026-05-26 etter at felt-lås-prinsippet (§2) ble fastslått som rådende dataintegritets-mekanisme.

### 4. Sidebar — én "Maler"-lenke

Én "Maler"-lenke erstatter separate "Sjekklistemaler" og "Oppgavemaler" i sidebar under Oppsett → Produksjon. Maler-siden har typefilter (faner eller dropdown).

### 5. Feltpalett — sidepanel

Feltpaletten vises som sidepanel (venstre) i malbyggeren. Kan minimeres. Ikke modal. Alle 23 felttyper vises alltid — type-irrelevante felter (f.eks. `enableChangeLog` for oppgaver) er metadata-innstillinger, ikke felttyper i paletten.

### 6. Forhåndsvisning — gjenspeiler låseregler og flyt

Forhåndsvisningen gjenspeiler:
- **Låseregler** basert på dokumenttype: sjekkliste viser redigerbare felt, oppgave viser append-only
- **Flyt-retning** basert på antall ledd: toveis (2 ledd) viser send/send-tilbake-knapper, enveis (3+ ledd) viser kun fremover-knapp
- **Rettighetsbasert UI** per `docs/claude/dokumentflyt.md` seksjon 3: leser/redigerer/admin visning

### 7. Mobil malbygger — web-only (avklart)

Malbyggeren forblir web-only. dnd-kit er web-spesifikk. Mobil-appen viser og fyller ut maler, men redigerer dem ikke.

### 8. Versjonering — aktivert

`ReportTemplate.version` aktiveres med versjonsnotering:
- Ved endring av mal → version inkrementeres
- Eksisterende dokumenter beholder referanse til versjonen de ble opprettet med
- Malbygger viser versjonsnummer og endringshistorikk
