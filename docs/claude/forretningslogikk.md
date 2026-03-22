# Forretningslogikk

## Entrepriseflyt

Dokumenter (sjekklister/oppgaver) flyter mellom entrepriser:
- Oppretter-entreprise initierer og godkjenner/avviser
- Svar-entreprise mottar, fyller ut og besvarer
- Alle overganger logges i `document_transfers`
- **I draft-status:** entrepriser kan endres via dropdown. Etter draft → låst
- **Automatisk fargevalg:** Neste ledige fra `ENTERPRISE_COLORS` (32 farger). Fargevelger kun i redigeringsmodal

**Sletting:**
- Kun `draft`-status. Sjekkliste-sletting blokkeres ved tilknyttede oppgaver
- Kaskade: `documentTransfer` + `image` → dokument
- Mobil: rød "Slett"-knapp i bunnpanel + SQLite-opprydding
- Web sjekkliste: rød knapp i header. Web oppgave: søppelbøtte per rad

## Flerforetagsbrukere

En bruker kan tilhøre flere entrepriser via `MemberEnterprise`. Admin uten tilknytning ser alle.

## Dokumentflyt (erstatter Arbeidsforløp)

Prosjektomfattende dokumentflyt under Innstillinger > Feltarbeid > Dokumentflyt:
- **Prosjektstyrt:** Dokumentflyt tilhører prosjekt (ikke entreprise)
- **Fleksible roller:** Medlemmer (entrepriser eller personer) med rolle `oppretter` eller `svarer` per steg
- **Modell:** `Dokumentflyt` → `DokumentflytMedlem` (rolle + steg) + `DokumentflytMal` (maltilknytning)
- Sjekklister/oppgaver knyttes via `dokumentflytId` (og bakoverkompatibelt `workflowId`)
- Emne: malen har `subjects`-array → nedtrekksmeny. Uten → fritekst/skjult
- **Planlagt:** HMS-avvik som egen dokumentflyt (alle kan opprette)

### Bakoverkompatibilitet
- Gammel `arbeidsforlop`-router beholdt som alias i tRPC
- Gamle `Workflow`/`WorkflowStepMember`-tabeller beholdt i DB
- Data migrert fra workflows → dokumentflyter via SQL INSERT...SELECT
- Mobilappen bruker fortsatt gammel router inntil oppdatert

## Invitasjonsflyt

1. Admin legger til bruker → `ProjectMember` opprettes
2. Ingen `Account` → `ProjectInvitation` med token (7 dager) → e-post via Resend
3. Akseptlenke → `/aksepter-invitasjon?token=...`
4. OAuth-innlogging → `allowDangerousEmailAccountLinking` → akseptert → redirect

**Personlig melding:** Valgfri tekst (maks 500 tegn) inkluderes i e-posten.
**Resend:** `RESEND_API_KEY` i BÅDE `apps/api/.env` OG `apps/web/.env.local`.

## Prosjektopprettelse og onboarding

- Innlogget bruker blir auto-admin. Firma kobles via `organizationId`
- Ny bruker uten prosjekter → `/dashbord/kom-i-gang`
- Entreprise-siden: veiledningsbanner (inviter → maler → entrepriser)
- **Bransje:** Fritekst med `<datalist>` (ikke låst dropdown)

## Prosjektgrupper

Kategorier: `generelt`, `field`, `brukergrupper`. Standardgrupper:
- **Prosjektadministratorer** — alle tillatelser, alle fagområder
- **Feltarbeid-administratorer** — manage_field, create_tasks/checklists
- **Oppgave- og sjekklisteregistratorer** — create_tasks/checklists
- **Feltarbeid-registrator** — view_field
- **HMS** — create_tasks/checklists

## Modulsystem

Forhåndsdefinerte mal-pakker via Innstillinger > Feltarbeid > Moduler:

| Modul | Slug | Prefix | Kategori |
|-------|------|--------|----------|
| Godkjenning | `godkjenning` | GM | oppgave |
| HMS-avvik | `hms-avvik` | HMS | oppgave |
| Befaringsrapport | `befaringsrapport` | BEF | sjekkliste |

Aktivering oppretter maler+objekter. Deaktivering: soft-delete (`active: false`).

## SiteDoc-administrasjon

Kun `sitedoc_admin`. Ruter: `/dashbord/admin/` med amber aksent.
- Oversikt (statistikk), Firmaer, Prosjekter (m/prøveperiode, slett utløpte), Tillatelser

## Firma-administrasjon

`company_admin` eller `sitedoc_admin`. Ruter: `/dashbord/firma/` med lilla aksent.
- Oversikt, Prosjekter, Brukere, Fakturering

**Brukerroller:** `user` (default), `company_admin` (firmaadmin), `sitedoc_admin` (superadmin)

## Tegninger

Metadata: tegningsnummer, fagdisiplin (ARK/LARK/RIB/RIV/RIE/RIG/RIBr/RIAku), type (plan/snitt/fasade/detalj/oversikt/skjema/montering), revisjon, versjon, status, etasje, målestokk.

Revisjonshistorikk via `drawing_revisions`. Georeferanse med 2 punkter for similaritetstransformasjon.

## Automatisk værhenting

`useAutoVaer` → `trpc.vaer.hentVaerdata` (Open-Meteo, gratis, ingen nøkkel). Auto-fyller temperatur, forhold (WMO→norsk), vind. Kilde: "automatisk"/"manuell".

## Innstillings-sidebar

- **Brukere** — Grupper, roller, medlemmer
- **Lokasjoner** — Samlet lokasjonsliste med redigering/georeferanse
- **Field** — Dokumentflyt, Entrepriser, Oppgavemaler, Sjekklistemaler, Kontrollplan, Mappeoppsett, Moduler
- **Prosjekteiers innstillinger** — Prosjektoppsett
- **Firmainnstillinger** — Firmainformasjon (synlig med tilknyttet firma)

## TODO

- Nedtrekksmeny for eksisterende medlemmer i brukergrupper
- Android-tilpasning for tegningstrykk
- Kvalitetssikring av 23 rapportobjekttyper (mobil)
- TegningPosisjonObjekt (mobil): full tegningsvelger
- Adgangskontroll: tillatelsesbasert opprettelse, arbeidsforløp-begrensning
- Videresending etter draft-status
- TrafikklysObjekt (mobil): grå/"Ikke relevant"
- Dokumentflyt redigeringsmodal (navn, maler, medlemmer)
- HMS-avvik: alle kan opprette
- Lisenssystem: betalingsside
- **DWG-import og konvertering:** Flere forbedringer trengs:
  - DXF-parser feiler på noen filer (ugyldig extents 1e20) → faller tilbake til dwg2SVG uten metadata
  - Blokk-referanser (INSERT) mister lag-tilhørighet ved utfolding
  - Hatch-mønstre (skravur) støttes ikke — bare SOLID-fyll
  - Stor blokk-filtrering (>10k entiteter) kan fjerne viktig innhold
  - Layout-SVGer er identiske kopier av model space — viewport-klipping mangler
  - Re-konvertering av eksisterende tegninger krever manuelt script — bør automatiseres
  - Vurder å lagre DXF-lag/blokk-struktur i databasen for rikere egenskapsvisning

## Modularkitektur (planlagt)

To nye moduler: **Dokumenter** (søk i maler, sjekklister, mappedokumenter) og **Økonomi** (budsjett, A-nota/T-nota).

Felles lag: OCR-tjeneste (fallback), søkemotor (felles `SearchIndex` med `tsvector`), tilgangskontroll.

Tre søke-scopes: Prosjekt (medlemmer), Firma (organisasjonen), SiteDoc (felles innhold).

Se `docs/MIGRERING-FIL-TIL-DATABASE.md` for detaljer.
