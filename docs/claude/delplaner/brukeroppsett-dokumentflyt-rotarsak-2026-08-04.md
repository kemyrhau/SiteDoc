# Rot-årsak: brukeroppsett ↔ dokumentflyt — fragmentert UI over en sammenhengende datamodell

> Avdekket av Kenneth 2026-08-04 under prod-verifisering av flytmodellen. Dette notatet er
> grunnlaget for det allerede-backloggede **brukeroppsett↔dokumentflyt-redesignet**. Alle
> HMS-funnene (E–H) + terminologi-forvirringen er symptomer på samme rot. Cowork-verifisert mot schema.

## Kjerne-innsikt (Kenneth)

Datamodellen henger sammen. **UI-et surfacer ikke koblingen.** Det er ikke en manglende datamodell — det er en fragmentert, ikke-eksponert UI oppå en modell som egentlig er komplett.

## Tre begreper (schema-verifisert)

| Begrep | Tabell | Hva det er | Hvor det forvaltes |
|---|---|---|---|
| **Gruppe** | `project_groups` | Brukere + modul-tilganger (`permissions`) + **domener** (`bygg`/`hms`/`kvalitet`) | Innstillinger → Brukere |
| **Faggruppe** | `dokumentflyt_parts` | Deltaker i en dokumentflyt | Innstillinger → Produksjon → Dokumentflyt |
| **DokumentflytMedlem** | `dokumentflyt_medlemmer` | Rolle-plass (Registrator/Bestiller/Utfører/Godkjenner) som peker på **Faggruppe ELLER Gruppe ELLER person** | Dokumentflyt-siden |

**Kobling som FINNES i data, men er usynlig i UI:** `GroupFaggruppe` (join-tabell) knytter Gruppe ↔ Faggruppe. `ProjectGroup.domains` avgjør HMS-gruppen. `DokumentflytMedlem` kan referere alle tre.

## Symptomer (alle samme rot)

- **Terminologi:** «Gruppe» (brukere-siden) vs «Faggruppe» (dokumentflyt-siden) = to navn for beslektede ting → forvirrer. Kenneth: «her legger jeg til gruppe — er dette dokumentflyt?»
- **Funn E — HMS uten malvelger + åpne-regel:** HMS opprettes via «+ Meld HMS», ikke den unifiserte velgeren. Kenneth vil ha HMS inn i samme velger + at selv 1 mal viser velger (forvalgt), ikke auto-oppretter.
- **Funn F — HMS status-filter for lite + Lukket forsvinner:** multiselect-nedtrekket er trangt; lukket avvik blir usynlig fordi «Lukket» ikke er valgt/synlig.
- **Funn G — svakt skille HMS/oppgave:** HMS-avvik ER oppgaver under panseret (`/oppgaver/HMS-xxx`) → etter lukking havner man i Oppgaver, ikke HMS.
- **Funn H — HMS-domene kan verken ses eller settes i UI:** server-mutasjonen `gruppe.oppdaterDomener` (`gruppe.ts:469`, admin-only) finnes, men INGEN web-side kaller den. Feilmeldingen «Opprett en gruppe med HMS-domene under Oppsett → Brukere» peker på en knapp som ikke finnes → admin kan ikke gi seg selv HMS-rettigheter.
- **Manglende gruppe-picker ved dokumentflyt-opprett:** ny dokumentflyt gir kun et navnefelt — tilgjengelige grupper/faggrupper hentes ikke inn.
- **HMS-avvik uten handlingsknapp:** «Lesevisning» når du ikke er i HMS-gruppen (sannsynlig korrekt «ikke din ball», men forsterker inkonsistensen).

## Hva redesignet må løse (fabel-input)

1. **Ett koherent oppsett** som eksponerer Gruppe ↔ domener ↔ Faggruppe ↔ Dokumentflyt-kobling, i stedet for tre fragmenterte flater.
2. **Konsistent terminologi** (Gruppe vs Faggruppe — samle eller tydelig skille).
3. **HMS på linje med flytmodellen** (velger, filter, navigasjon, domene-config, handlingsknapper) — HMS skal ikke være et separat spor.
4. **Wire eksisterende server-kapabilitet** (`oppdaterDomener` + `GroupFaggruppe`) inn i UI.

## Status

Redesign-sak (backlog). **Ikke lappet stykkevis.** Rutet til fabel som én arkitektur/UX-gjennomgang. Flytmodellen + Funn A/C/D + v2 er upåvirket og verifisert.
