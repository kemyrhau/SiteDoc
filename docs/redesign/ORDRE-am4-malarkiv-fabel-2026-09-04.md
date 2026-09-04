# ORDRE AM 4 — Malarkiv (firma + SiteDoc) — fabel 2026-09-04

**Til:** redesign-Opus (relayes av Kenneth). **Branch:** egen fra develop.
**Grunnlag:** `docs/redesign/designnotat-malarkiv-fabel-2026-09-04.md` (B1–B3 Kenneth-vedtatt 04.09) + `docs/claude/migrering-reporttemplate.md` + mockup `Malarkiv Mockup.dc.html` (designprosjektet — layoutene A–D er godkjent retning).
**Kvalitetskrav:** rotårsak, delte kilder, verifiser mot faktisk kode før hvert steg. Mål før du bygger — rapportér avvik fra premissene under FØR koding.

## Designlås (Kenneth-vedtatt — avvik = STOPP + forslag, aldri «bygde annerledes»)

- **L1 (B1):** ved prefix-kollisjon i seeding VINNER firmamalen over standardmalen fra PROSJEKT_MODULER.
- **L2 (B1-synlighet, Kenneth-akseptkriterium):** erstatningen skal være SYNLIG — aldri stille. Den seedede prosjektmalen viser at den erstattet en standardmal (f.eks. beskrivelse/badge «Erstatter standardmal BEF — fra firmaarkivet»), og seeding-resultatet er sporbart uten å vite hva som ble endret. Foreslå konkret mekanisme til fabel-gate hvis mockupens D-oppsummering ikke er tilstrekkelig.
- **L3 (B2):** SiteDoc-lånevei fase 1 er KUN sentralt→firmaarkiv (kopi m/avstamning). Dagens NS 3420→prosjekt-flyt (ProsjektBibliotekValg/BibliotekPanel) røres ikke.
- **L4 (B3):** HMS er med fra start — `subdomain` + `hmsSynlighet` legges additivt på OrganizationTemplate.
- **L5:** kopi med avstamning, aldri referanse. `organizationTemplateId` beholdes som peker; SetNull ved sletting av firmamal (schema-semantikk finnes).
- **L6:** versjonering er manuell — badge «X versjoner bak» + «Oppdater»-knapp; ALDRI auto-sync til prosjekter. Diff/merge ved lokal endring = backlog, bygges ikke nå.
- **L7:** eierskap: firma-admin (samme `OrganizationMember.firmaRoller`-mønster som `timer/eksportOppsett.ts`) oppretter/redigerer/sletter/promoterer; alle prosjektadmin kan hente ned.
- **L8:** firmamal-redigering GJENBRUKER MalBygger-komponenten i firma-modus — ingen parallell malbygger.
- **L9:** tre-liste-prinsippet (MALBYGGER.md): sjekkliste/oppgave/HMS blandes aldri i én liste — faner per kategori på arkivsiden.
- **L10:** konfliktregel (migrering-reporttemplate.md § Konflikt-regel): alternativ 2 (kategori-skille) legges til grunn; audit delt-bruk i prod-DB rapporteres før merge.

Utfører kvitterer «designavvik: ingen» eller lister forslag som venter vedtak.

## DB-migrering — FORHÅNDSGODKJENT av Kenneth 04.09

Konsekvensen av B3 var forelagt før vedtak. Ikke stopp for godkjenning. Kravet består: to-stegs migrasjons-policy, **kun ADD COLUMN, ingen DROP, ingen NOT NULL i steg 1.** Nye kolonner: `organization_templates.subdomain`, `organization_templates.hms_synlighet`, `organization_templates.standard_for_nye_prosjekter` (boolean default false), `report_templates.versjon_av_hovedmal` (int default 1).

## Byggerekkefølge

1. **Migrering** (over) + `firmamal.*` tRPC-ruter: `list`, `hent`, `opprett`, `oppdater`, `slett`, `promoter` (ReportTemplate→OrganizationTemplate m/objekter+translations), `kopierTilProsjekt` (motsatt vei, setter avstamning + versjonAvHovedmal), `laanFraSentralarkiv` (BibliotekMal→OrganizationTemplate, L3). Tilgang per L7.
2. **Firma-arkivsiden** `/dashbord/oppsett/firma/malarkiv` (mockup A): FIRMA-sone (amber), tre faner (L9), rader m/versjon, bruk-teller, «Standard for nye prosjekter»-toggle, «Lån fra SiteDoc-arkivet», «+ Ny firmamal». Redigering per L8.
3. **Promotering i malbygger** (mockup B): «Send til firmaarkiv» (kun firma-admin) + badges «I firmaarkivet» / «Basert på firmamal: … (X versjoner bak)» + manuell «Oppdater» (L6).
4. **Ny mal-dialog** (mockup C): tre kilder — Tom / Fra firmaarkivet / Fra SiteDoc-arkivet (siste = eksisterende flyt, urørt).
5. **Seeding-veien** (mockup D): ved modulaktivering/prosjektopprett seedes firmaets flaggede maler FØRST, deretter PROSJEKT_MODULER-hull, idempotent på prefix; L1 + L2. Ingen dialog, 0 ekstra klikk (kontekst-default).

## Funksjonsinventar — modul.ts-seedingen (rørt komponent, hver linje avgjøres)

Målt `apps/api/src/routes/modul.ts:254–316` (aktiver-mutasjonen):

| Dagens atferd | Vedtak |
|---|---|
| Auto-aktivering av avhengige moduler (`modulDef.krever`) | BEVART uendret |
| Idempotent mal-seed på `prefix` (finnes → skip) | BEVART — utvides: firmamal sjekkes FØR standardmal (L1) |
| Mal opprettes m/category/domain/subdomain/hmsSynlighet/subjects | BEVART — firmamal-kopi setter samme felt + avstamning |
| ReportObject.createMany m/config fra malDef | BEVART — kopi fra OrganizationTemplateObject må bevare `config.zone` på hvert objekt (🔴 STYRENDE-regelen i MALBYGGER.md — felt uten zone hard-fryser mobil) |
| HMS-spesialseed `seedHmsModulOmradet` (gruppe/flyt/koblinger) | BEVART uendret — firmamal-seed skal ikke duplisere den |
| Reaktivering kjører seed-løkkene på nytt (idempotent) | BEVART — også for firmamaler |
| Deaktiver beholder maler | BEVART |

`translations` kopieres med i begge retninger (promoter/kopierTilProsjekt).

## Klikk-budsjett (DoD — rapportér faktiske tall ved levering)

- Nytt prosjekt med firmamaler: **0 ekstra interaksjoner**
- Hente firmamal i eksisterende prosjekt: **≤ 3 klikk**
- Promotere prosjektmal: **≤ 2 klikk** (ingen bekreftelsesdialog — angring = slett i arkivet, kopiene består)
- Alle nye modaler/flater: synlig Avbryt-utvei (avbrytbarhets-regelen)

## Verifisering (DoD)

1. Build grønn (`pnpm --filter @sitedoc/web build`)
2. Zone-spørringen fra MALBYGGER.md mot alle kopierte maler → null rader uten `config.zone`
3. Ende-til-ende på test: promoter → lån fra sentralarkiv → flagg standard → opprett prosjekt → verifiser L1+L2 synlig + mobil åpner et seedet dokument uten frys (Release-relevant, jf. zone-regelen)
4. Skjermbilder til fabel-designgate (aldri lukket på build alene)
5. Exit-protokoll a–d + dok-sync (migrering-reporttemplate.md § Status oppdateres til «delvis implementert» med hva)

**Designavvik-kvittering + avstemming mot faktisk kode i første rapport.**
