# Byggeplass-strategi

**Status:** Planlagt fase, ikke startet. Etablert 2026-04-25 som anker for senere designarbeid.

Byggeplass er førsteklasses begrep i SiteDoc. Mange moduler har eller burde ha valgfri eller obligatorisk byggeplass-relasjon. I dag er bevisstheten ujevnt implementert — noen modeller har eksplisitt `byggeplassId`, andre mangler felt, og noen bruker feil mekanisme (jsonb-array i stedet for FK + koblingstabell).

Denne fasen samler alle byggeplass-relaterte beslutninger til én koordinert designrunde, slik at vi unngår fragmenterte rename- og refactor-runder senere.

## Prinsipp

**Byggeplass er en fysisk lokasjon innenfor et prosjekt.** Et prosjekt kan ha 0, 1 eller flere byggeplasser (`projects` 1:N `byggeplasser`). Mange domenekonsepter henger naturlig på byggeplass-nivå — tegninger, områder, sjekklister, kontrollplan, ferdigattest (SAK10 §14-7) — fordi de er knyttet til fysisk arbeid.

Andre konsepter er prosjekt-nivå og *kan ikke* være byggeplass-spesifikke uten å bryte fundamentet (f.eks. dokumentflyt-konfigurasjon, mappestruktur).

## Etableringsmoment

Byggeplasser etableres **sammen med faggruppe-etablering på prosjekt** — dvs. som del av prosjekt-oppsett før operativt arbeid. Begge er forutsetninger for at sjekklister, oppgaver, kontrollplan, mannskapsregistrering og maskin-tilordning kan opprettes.

Dette gir to konsekvenser:
- Prosjekt-opprettelses-flyten må håndtere begge i samme veiviser
- Brukere bør aldri møte feilmeldingen «mangler byggeplass» midt i operativt arbeid — det må fanges i oppsettsfasen

## Modul-tabell (utkast — bekreft hver rad)

Basert på lesning av modul-dokumentasjon i `docs/claude/` per 2026-04-25. Hver rad er en påstand som krever Kenneth-bekreftelse før den anses som design-grunnlag.

| Modul / Entitet | Per byggeplass i dag | Bør være per byggeplass | Status | Begrunnelse |
|---|---|---|---|---|
| Kontrollplan | `Kontrollplan.byggeplassId` ✓ obligatorisk | Ja, obligatorisk | OK | Påstand — bekreft. Ferdigattest utstedes per byggeplass (SAK10 §14-7) — kontrollplan må følge samme nivå |
| Tegning (Drawing) | `byggeplass_id` ✓ | Ja | OK | Påstand — bekreft. Tegninger viser fysisk lokasjon |
| Punktsky (PointCloud) | `byggeplass_id` ✓ | Ja | OK | Påstand — bekreft. Skannet ved spesifikk lokasjon |
| Område (Omrade) | `byggeplass_id` ✓ | Ja | OK | Påstand — bekreft. Sub-inndeling av byggeplass |
| Sjekkliste (Checklist) | `byggeplass_id` ✓ | Ja | OK | Påstand — bekreft. Kontroll utføres på fysisk sted |
| PSI | `Psi.byggeplassId` valgfri | Ja, oftest obligatorisk | OK | Påstand — bekreft. Én PSI per byggeplass+prosjekt; valgfri NULL-håndtering avklares (se § «Åpne prinsipper») |
| FtdKontrakt | `byggeplass_id` valgfri | Ja, valgfri | OK | Påstand — bekreft. Kontrakt kan dekke flere byggeplasser, derfor valgfri |
| EquipmentAssignment (maskin) | `byggeplassId` (én av 3 FK-alternativer per rad) | Ja, valgfri | OK | Påstand — bekreft. Assignment kan være til person, prosjekt eller byggeplass — én FK per rad |
| Mannskap-innsjekk | `Innsjekk.byggeplassId` (planlagt i `db-mannskap`) | Ja, obligatorisk | Skal designes | Påstand — bekreft. `db-mannskap` ikke implementert ennå; modellert med byggeplassId i [mannskap.md](mannskap.md) |
| Brukergruppe (ProjectGroup) | `building_ids` jsonb (feil tilnærming, brukes ikke) | Ja, valgfri (m2m) | Krever refactor | Påstand — bekreft. Feltet er skrevet via mutation men aldri lest. Skal modelleres som FK + koblingstabell. Drop av eksisterende kolonne håndteres her |
| Timer / Dagsseddel | Ingen felt i dag (modul ikke implementert) | Ja, valgfri | Mangler felt | Påstand — bekreft. Mannskap kan jobbe på flere byggeplasser samme dag — dagsseddel-rad eller delrad bør kunne tagges med byggeplass |
| Oppgave (Task) | Ingen direkte `byggeplassId` ✓ verifisert | Ja, valgfri | Mangler felt | **Verifisert mot Prisma.** Task har `drawingId` (indirekte byggeplass via `drawing.byggeplassId`) og `recipientGroupId`, men ingen direkte `byggeplassId`. Sannsynlig oversett i `navnegjennomgang` (som dekket Checklist, ikke Task) |
| Dokumentflyt | Ingen byggeplass-felt på `Dokumentflyt`, `DokumentflytMedlem`, `DokumentflytMal`, `DocumentTransfer` ✓ verifisert | Nei — prosjekt-nivå | OK | **Verifisert mot Prisma.** Dokumentflyt er prosjekt-nivå (via `projectId`), refererer faggruppe (`faggruppeId`), brukes av `Checklist[]` og `Task[]` som dokumenttyper. Byggeplass-konteksten ligger på dokumentene, ikke på flyt-konfigurasjonen |
| Mappe (Folder) | Ingen byggeplass-felt ✓ verifisert | Nei — prosjekt-nivå | OK | **Verifisert mot Prisma.** Folder er prosjekt-nivå (via `projectId`), har hierarki via `parentId` og kan kobles til kontrakt via `kontraktId`. Mappestruktur er logisk organisering, ikke fysisk |
| Bilde (Image) | `gpsLat`/`gpsLng`/`gpsEnabled` ✓ verifisert; ingen byggeplass-FK | Sannsynligvis ikke nødvendig | OK | **Verifisert mot Prisma.** Modell heter `Image`. Kobles til parent via `checklistId`/`taskId` — får dermed indirekte byggeplass når parent har det. Direkte FK er sannsynligvis overflødig: GPS gir lokasjon, parent gir kontekst |
| AI-søk | Ingen | Filtrerbar (ikke nødvendigvis FK) | Skal designes | Påstand — bekreft. Sannsynligvis nok å eksponere byggeplass som filter via eksisterende relasjoner (sjekklister, kontrollplan, FtdKontrakt) |
| Planlegger | Ikke implementert | Ja, obligatorisk | Skal designes | Påstand — bekreft. Bemanning per byggeplass er kjernen i ressursplanlegging |
| Maskin (Equipment selv) | Ingen direkte FK — har `Assignment` | Nei på Equipment, ja på Assignment | OK | Påstand — bekreft. Equipment er firma-eid; byggeplass-tilordning skjer via `EquipmentAssignment` (loan-pattern) |

## Tre åpne arkitektur-prinsipper å beslutte

### Prinsipp A — NULL-betydning

Når en kolonne `byggeplassId` er valgfri (f.eks. på en kontrakt eller dagsseddel), hva betyr `NULL`?

- **A1: NULL = «alle byggeplasser»** — entiteten gjelder hele prosjektet uavhengig av byggeplass
- **A2: NULL = «ikke spesifisert»** — entiteten har ikke fått byggeplass tildelt ennå (semi-utfylt state)
- **A3: NULL = «n/a»** — byggeplass er ikke et meningsfullt begrep for denne entiteten

Konsekvens: påvirker default-rendering i UI (skal en sjekkliste uten byggeplassId vises på alle byggeplass-faner?), filtrering, og rapport-aggregering. **Bør være konsistent på tvers av moduler.** Anbefaling fra Kenneth: én tolkning som gjelder, ikke per-modul-variasjoner.

### Prinsipp B — Prosjekt uten definerte byggeplasser

Hva skjer for moduler som "skal være per byggeplass" når et prosjekt ikke har opprettet noen byggeplasser ennå?

- **B1: Modulen blokkeres** — bruker tvinges til å opprette byggeplass først
- **B2: Implisitt default-byggeplass** — system oppretter «Hovedplass» automatisk (mister informasjonen om at byggeplass-bevissthet er nødvendig)
- **B3: Modulen åpen, byggeplass valgfri inntil opprettet** — entiteter får `byggeplassId = NULL` og må retroaktivt tilordnes når byggeplasser etableres

Konsekvens: B1 gir reneste data men dårligere onboarding. B2 risikerer at brukere aldri inndeler. B3 krever migreringsverktøy. Henger sammen med **Etableringsmoment**-prinsippet ovenfor.

### Prinsipp C — Datamodell: FK + koblingstabell, ikke jsonb-array

For relasjoner der én entitet kan høre til flere byggeplasser (m2m — f.eks. brukergruppe → byggeplasser):

- **C1: Koblingstabell** (`project_group_byggeplasser` med (groupId, byggeplassId))
- **C2: jsonb-array** med byggeplass-IDer på entiteten (status quo for `project_groups.building_ids`)
- **C3: NULL betyr «alle», kommaliste i tekst-kolonne** (legacy-stil — ikke kandidat)

**Beslutning forventet:** C1. Begrunnelse: gir referanseintegritet (FK-cascading ved sletting av byggeplass), støtter indekser og JOINs, ryddigere SQL-spørringer, samme pattern som andre m2m-relasjoner i basen.

Konsekvens for `project_groups.building_ids`: den dropps og erstattes av koblingstabell som del av denne fasen.

## Avhengigheter

Identifiserte fra modul-dokumentasjonen:

- **Mannskap-modul (`db-mannskap`)** — modellert med `Innsjekk.byggeplassId` ([mannskap.md](mannskap.md)). Må bygges på etablert byggeplass-strategi
- **Timer-modul (`db-timer`)** — modellert uten byggeplass i dag. Dagsseddel-design avklares mot Prinsipp A og B før implementasjon. Se [timer-input-katalog.md](timer-input-katalog.md)
- **Dokumentflyt-utvidelser** — sjekkes om byggeplass-relasjon er nødvendig (utkast-tabell sier nei). Hvis ja: påvirker `Dokumentflyt`/`DokumentflytMedlem`
- **Mobil-app** — innsjekk- og dagsseddel-flyt på mobil må reflektere byggeplass-valget. Mobil-versjonsstøtte må vurderes (TestFlight kan ikke oppdateres umiddelbart)
- **Planlegger** — bygges først etter at timer + mannskap + maskin er på plass. Forutsetter byggeplass-strategi som rammeverk
- **AI-søk** — kan utvides med byggeplass-filter etter at relasjonene er konsistente

## Status

Planlagt fase. Ikke startet. Forutsetter:

1. Bekreftelse av modul-tabellen (markert «Påstand — bekreft» per rad)
2. Beslutning på Prinsipp A, B, C
3. Definisjon av prosjekt-oppsetts-flyt for byggeplass-etablering
4. Plan for dropp + erstatning av `project_groups.building_ids` (se [db-opprydning.md § U.1](db-opprydning.md#u1-projectgroupsbuildingids-jsonb--ikke-renamet))

Etter disse stegene kan implementasjon planlegges per modul i prioritert rekkefølge.
