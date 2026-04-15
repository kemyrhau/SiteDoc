# Forretningslogikk

## Entrepriseflyt

Dokumenter (sjekklister/oppgaver) flyter mellom entrepriser:
- Bestiller-entreprise initierer og godkjenner/avviser
- Utfører-entreprise mottar, fyller ut og besvarer
- Alle overganger logges i `document_transfers`
- **I draft-status:** entrepriser kan endres via dropdown. Etter draft → låst
- **Lokasjon:** Alltid redigerbar (drawingId, positionX/Y) unntatt i `closed`/`approved`-status
- **Sentralbord (Flytt dokument):** API-rutene `sjekkliste.flytt` og `oppgave.flytt` beholdes som deprecated. Videresending håndterer nå alt (dokumentflyt-bytte + entreprise-bytte + mottaker)
- **Automatisk fargevalg:** Neste ledige fra `ENTERPRISE_COLORS` (32 farger). Fargevelger kun i redigeringsmodal

**Sletting:**
- Kun `draft`-status. Sjekkliste-sletting blokkeres ved tilknyttede oppgaver
- Kaskade: `documentTransfer` + `image` → dokument
- Mobil: rød "Slett"-knapp i bunnpanel + SQLite-opprydding
- Web sjekkliste: rød knapp i header. Web oppgave: søppelbøtte per rad

## Flerforetagsbrukere

En bruker kan tilhøre flere entrepriser via `MemberEnterprise`. Admin uten tilknytning ser alle.

## Firmaansvarlig

`ProjectMember.erFirmaansvarlig` (Boolean, per prosjekt) — markerer prosjektmedlemmet som firmaansvarlig. Skjold-ikoner i UI: blått = Admin, gult = Firmaansvarlig. Settes via rolle-dropdown i kontakttabellen (Brukere-siden).

**Invitasjonsrettighet:** Firmaansvarlig kan invitere nye brukere via `medlem.leggTil` — kun fra eget firma (`organizationId` må matche), kan ikke opprette admin-brukere. Invitasjonsliste: admin ser alt, firmaansvarlig kun egne, andre → 403. Guard: `verifiserAdminEllerFirmaansvarlig()`.

## Gruppemodulere

`ProjectGroup.modules` (JSON, default `["sjekklister","oppgaver","tegninger","3d"]`) — begrenser hvilke moduler en brukergruppe ser i sidebar. `gruppe.hentMinFlytInfo` returnerer aggregerte `moduler` fra alle brukerens grupper. Admin/registrator/company_admin ser alt. Kun soft enforcement (sidebar) — ingen API 403-sjekk.

## HMS-avvik (gruppebasert flyt)

HMS-oppgaver (maler med `domain: "hms"`) opprettes **uten entreprise** — `bestillerEnterpriseId` og `utforerEnterpriseId` er nullable på Task. Alle prosjektmedlemmer kan rapportere. Auto-rutes til HMS-gruppen (`ProjectGroup` med `domains` inkl. `"hms"`). Maks én HMS-gruppe per prosjekt. Tilgangskontroll via domain-sjekk i lag 3 (`verifiserDokumentTilgang`). Guard: `verifiserProsjektmedlem` (ikke `verifiserEntrepriseTilhorighet`).

## lestAvMottakerVed

`DateTime?` på Task og Checklist. Settes når mottaker (`recipientUserId === ctx.userId`) åpner dokumentet mens status er `sent`. StatusBadge viser «Lest» (i stedet for «Sendt») med tidsstempel-tooltip. Ved «Trekk tilbake» vises advarsel: «Mottaker har allerede lest dette dokumentet».

## Dokumentflyt (erstatter Arbeidsforløp)

Prosjektomfattende dokumentflyt under Innstillinger > Produksjon > Dokumentflyt:
- **Entreprise-tilhørighet:** Dokumentflyt har `enterpriseId` som bestemmer hvilken entreprise den vises under i UI. Settes ved opprettelse via `forvalgtEntrepriseId`
- **4 roller:** `registrator`, `bestiller`, `utforer`, `godkjenner` — valgfrie byggeklosser per flyt. Medlemmer kan være brukergrupper (`groupId` → `ProjectGroup`) eller enkeltpersoner (`projectMemberId`). Dropdown viser kun personer og brukergrupper (ikke entrepriser eller systemgrupper)
- **Tilpassbare rollenavn:** Hvert rolle-steg kan ha egendefinert `label` (f.eks. "Spørsmål" i stedet for "Registrator"). Lagres i `Dokumentflyt.roller` JSONB-felt (format: `{ registrator?: { label }, bestiller?: { label }, utforer?: { label }, godkjenner?: { label } }`)
- **Tre-lags prinsipp:** Kontaktliste (mennesker) → Grupper (rettigheter) → Dokumentflyt (logikk). Dokumentflyt PEKER PÅ grupper/personer, eier dem aldri. FlytBoks er read-only for gruppeinnhold
- **Hovedansvarlig:** `DokumentflytMedlem.erHovedansvarlig` (Boolean) — blå prikk i oppsett-UI. Maks én per steg. Valgfritt. Ved opprettelse av sjekkliste/oppgave auto-settes `recipientUserId`/`recipientGroupId` fra hovedansvarlig. Vises i Ansvarlig-kolonnen i tabellvisning
- **Hovedansvarlig per person i gruppe:** `DokumentflytMedlem.hovedansvarligPersonId` (valgfri referanse til `ProjectMember`) — utpeker en spesifikk person som hovedansvarlig innenfor en gruppe-medlem. Brukes for auto-utledning av mottaker ved opprettelse
- **Grupper vs brukere:** I opprett-modalen velger man «Bruker» (enkeltperson) eller «Gruppe» (brukergruppe/ProjectGroup). Grupper gir lik tilgang til alle gruppemedlemmer
- **Modell:** `Dokumentflyt` (+ `roller` JSON) → `DokumentflytMedlem` (rolle + steg + enterpriseId/projectMemberId/groupId) + `DokumentflytMal` (maltilknytning)
- Sjekklister/oppgaver knyttes via `dokumentflytId` (og bakoverkompatibelt `workflowId`)
- Emne: malen har `subjects`-array → nedtrekksmeny. Uten → fritekst/skjult
- **Mottaker ved «Send»:** Auto-utledes fra dokumentflytens utfører (hovedansvarlig først). Ved videresending kan registratorer (create_checklists/create_tasks) velge entreprise — mottaker utledes fra valgt entreprises dokumentflyt. Lagres i `recipientUserId`/`recipientGroupId` på dokument + `DocumentTransfer`
- **Auto-mottatt:** `sent` → `received` skjer automatisk (ingen manuell "Motta"-klikk). Mottaker ser dokumentet som arbeidsordre umiddelbart
- **Videresending:** Dokumenter i received/in_progress/responded/rejected/approved kan videresendes. Status endres ikke, kun mottaker oppdateres. `toStatus` i transfer = nåværende status. Ved videresending til annen entreprise oppdateres `dokumentflytId` + `utforerEnterpriseId` automatisk (erstatter FlyttDokument-komponenten)
- **Besvar (responded):** Kjede-bevisst — sender automatisk tilbake til forrige avsender via siste `DocumentTransfer.senderId`. Muliggjør kjeder: HE → UE → Arbeider → UE → HE
- **E-postvarsling:** Sendes ved `sent`, `responded`, `approved`, `rejected` og `forwarded` (ikke bare send)
- **Rollebaserte handlingsknapper:** `utledMinRolle()` i `@sitedoc/shared` mapper innlogget bruker → rolle i dokumentflyten. `hentRolleFiltrertHandlinger()` viser kun relevante knapper per rolle. Bestiller: Send/Avbryt/Lukk. Utfører: Besvar/Send tilbake/Videresend. Godkjenner: Godkjenn/Send tilbake/Videresend. Registrator: alle. `null` = lesevisning. API: `gruppe.hentMinFlytInfo` returnerer `projectMemberId`, `entrepriseIder`, `gruppeIder`, `erAdmin`
- **Send tilbake:** Ny statusovergang `in_progress → sent` — utfører sender tilbake til bestiller (auto-mottatt som `received`). `responded → rejected` — godkjenner sender tilbake til utfører
- **Gruppevisning i dropdown:** Bruker-dropdown i dokumentflyt-oppsett viser gruppemedlemskap: «Kenneth Myrhaug · Byggherre, Tømrer»
- **Person-basert tilgangssjekk (Valg B):** Firmamedlemmer ser dokumenter der en person fra firmaet er `bestillerUserId`, `recipientUserId` eller `senderId` (i DocumentTransfer). Erstatter entreprise-basert filtrering for firmaansvarlige
- **Mal-velger per dokumentflyt:** Dokumentflyt har tilknyttede maler via `DokumentflytMal`. Ved opprettelse av oppgave/sjekkliste vises kun maler som tilhører valgt dokumentflyt
- **Videresend-dropdown:** Matcher entreprise + dokumentets mal via `DokumentflytMal`. Én flyt → auto-velg. Flere flyter → flytnavn i parentes (f.eks. «Tømrer (HE → Tømrer - Avvik)»). Mottaker utledes fra utfører-rolle, fallback bestiller → godkjenner
- **Tidslinje-snapshot:** `DocumentTransfer` har snapshot-felt: `senderEnterpriseName`, `recipientEnterpriseName`, `dokumentflytName`, `senderRolle`. Populeres ved statusendring/videresending/flytt. Viser kontekst i tidslinje: «Kenneth (Byggherre) → HE-Leder (Elektro) · Flyt: Elektro–HE · Bestiller»
- **Implementert:** HMS-avvik gruppebasert flyt (se HMS-avvik seksjonen over)
- **Planlagt:** Intern godkjenning (ansatt → fagleder → TE)

### Bakoverkompatibilitet
- Gammel `arbeidsforlop`-router beholdt som alias i tRPC
- Gamle `Workflow`/`WorkflowStepMember`-tabeller beholdt i DB
- Data migrert fra workflows → dokumentflyter via SQL INSERT...SELECT
- Mobilappen bruker fortsatt gammel router inntil oppdatert

## Dokumenttyper — lik struktur, ulik redigering

Sjekklister og oppgaver har **identisk** UI-struktur (sidebar, tabellvisning, detaljside, statusflyt, entreprise-velger, tidslinje). Forskjellen er kun:

| | Sjekkliste | Oppgave | Godkjenning (planlagt) | SHA-avvik (planlagt) |
|---|---|---|---|---|
| **Redigering** | Ja (endre eksisterende) | Kun tilføye (kommentar, vedlegg, nye verdier) | TBD | TBD |
| **Sletting** | Kun draft | Aldri (unike løpenumre) | TBD | TBD |
| **Flyt** | Entreprise/dokumentflyt | Entreprise/dokumentflyt | Hierarkisk | Gruppebasert |

## Invitasjonsflyt

1. Admin klikker «Inviter ny» i kontakttabellen (sticky header)
2. Fyller ut fornavn, etternavn, e-post, telefon (valgfritt), firma (påkrevd)
3. Firma-dropdown: eksisterende organisasjoner + «+ Nytt firma» (oppretter Organization inline)
4. `medlem.leggTil` → `ProjectMember` opprettes med `organizationId` satt på brukeren
5. Ingen `Account` → `ProjectInvitation` med token (7 dager) → e-post via Resend
6. Akseptlenke → `/aksepter-invitasjon?token=...`
7. OAuth-innlogging → `allowDangerousEmailAccountLinking` → akseptert → redirect
8. **Auto-akseptering:** Ved OAuth-innlogging aksepteres ventende invitasjoner automatisk (events.signIn i auth.ts)

**Personlig melding:** Valgfri tekst (maks 500 tegn) inkluderes i e-posten.
**Resend:** `RESEND_API_KEY` i BÅDE `apps/api/.env` OG `apps/web/.env.local`.

## Prosjektopprettelse og onboarding

- Innlogget bruker blir auto-admin. Firma kobles via `organizationId`
- Ny bruker uten prosjekter → `/dashbord/kom-i-gang`
- Entreprise-siden: veiledningsbanner (inviter → maler → entrepriser)
- **Bransje:** Fritekst med `<datalist>` (ikke låst dropdown)

## Prosjektgrupper

Kategorier: `generelt`, `produksjon`, `brukergrupper`. Standardgrupper:
- **Prosjektadministratorer** — alle tillatelser, alle fagområder
- **Produksjonsadministratorer** — manage_field, create_tasks/checklists
- **Oppgave- og sjekklisteregistratorer** — create_tasks/checklists
- **Produksjonsregistrator** — view_field
- **HMS** — create_tasks/checklists

## Modulsystem

Forhåndsdefinerte mal-pakker via Innstillinger > Produksjon > Moduler:

| Modul | Slug | Prefix | Kategori |
|-------|------|--------|----------|
| Godkjenning | `godkjenning` | GM | oppgave |
| HMS-avvik | `hms-avvik` | HMS | oppgave |
| Befaringsrapport | `befaringsrapport` | BEF | sjekkliste |
| 3D-visning | `3d-visning` | — | funksjon |

Aktivering oppretter maler+objekter. Deaktivering: soft-delete (`active: false`). Moduler med kategori `funksjon` aktiverer/deaktiverer funksjoner (f.eks. 3D-visning i sidebar) uten å opprette maler.

## SiteDoc-administrasjon

Kun `sitedoc_admin`. Ruter: `/dashbord/admin/` med amber aksent.
- Oversikt (statistikk), Firmaer, Prosjekter (m/prøveperiode, slett utløpte), Tillatelser

## Firma-administrasjon

`company_admin` eller `sitedoc_admin`. Ruter: `/dashbord/firma/` med lilla aksent.
- Oversikt, Prosjekter, Brukere, Fakturering

**Brukerroller:** `user` (default), `company_admin` (firmaadmin), `sitedoc_admin` (superadmin)

## Tegninger

Metadata: tegningsnummer, fagdisiplin (ARK/LARK/RIB/RIV/RIE/RIG/RIBr/RIAku), type (plan/snitt/fasade/detalj/oversikt/skjema/montering), revisjon, versjon, status, etasje, målestokk.

Revisjonshistorikk via `drawing_revisions`. Georeferanse med 2+ punkter: 2 punkter → similaritetstransformasjon, 3+ punkter → affin transformasjon med `ekstraPunkter`-array. `beregnKalibreringsFeil()` viser nøyaktighet i meter.

## Automatisk værhenting

`useAutoVaer` → `trpc.vaer.hentVaerdata` (Open-Meteo, gratis, ingen nøkkel). Auto-fyller temperatur, forhold (WMO→norsk), vind. Kilde: "automatisk"/"manuell".

## Innstillings-sidebar

- **Brukere** — Grupper, roller, medlemmer. Kontakttabell er eneste visning (ingen toggle). Sticky header med filter. Modul-badges i gruppeoverskrifter. Firmaansvarlig settes via rolle-dropdown. Skjold-ikoner: blått=Admin, gult=Firmaansvarlig
- **Lokasjoner** — Samlet lokasjonsliste med redigering/georeferanse
- **Produksjon** — Dokumentflyt, Entrepriser, Oppgavemaler, Sjekklistemaler, Kontrollplan, Mapper, Moduler (tidligere «Field»/«Feltarbeid»). Gammel entreprise-side og gruppevisning fjernet. Dokumentflyt (ikke Kontakter) i sidebar
- **Prosjekteiers innstillinger** — Prosjektoppsett
- **Firmainnstillinger** — Firmainformasjon (synlig med tilknyttet firma)

## Statusflyt — komplett

```
draft → sent → received → in_progress → responded → approved → closed
                                                   → rejected → in_progress (ny runde)
                                                               → closed (kun registrator)
Alle unntatt responded/approved/rejected/closed → cancelled (avvist)
cancelled → draft (gjenåpne)
```

| Fra | Til | Knapp | Mottaker | E-post |
|-----|-----|-------|----------|--------|
| draft | sent→received | Send | Auto fra dokumentflyt | ✓ |
| received | in_progress | Start arbeid | Uendret | — |
| received | forwarded | Videresend | Velges i dropdown | ✓ |
| in_progress | responded | Besvar | Auto tilbake til forrige avsender | ✓ |
| in_progress | forwarded | Videresend | Velges | ✓ |
| responded | approved | Godkjenn | Uendret | ✓ |
| responded | rejected | Avvis | Uendret | ✓ |
| rejected | in_progress | Start arbeid igjen | Uendret | — |
| rejected | closed | Lukk (kun registrator) | — | — |
| approved | closed | Lukk | — | — |
| \* | cancelled | Avvis | Uendret | — |
| cancelled | draft | Gjenåpne | — | — |

**Sidebar:** `rejected` og `cancelled` slått sammen som én "Avvist"-rad.

### Kjede-eksempel (NS 8407)

```
HE oppretter → Send → 🔵 UE-ansvarlig (received)
UE-ansvarlig → Videresend → Arbeider (received)
Arbeider → Start arbeid (in_progress) → Besvar → auto til UE-ansvarlig (responded)
UE-ansvarlig → Videresend → HE (responded)
HE → Godkjenn/Avvis
```

## Kontaktliste

Innstillinger > Produksjon > Kontakter — komplett administrasjon av dokumentflyter og kontakter:

- **Utvidbar tabell:** Entreprise → dokumentflyter med visuell flyt (Bestiller → Utfører → Godkjenner)
- **LeggTilMedlemDropdown:** Legg til grupper eller enkeltpersoner i FlytBoks. Gjenbruker dokumentflyt-komponent
- **Klikkbar ansvarlig-prikk (●):** Per DokumentflytMedlem, setter `erHovedansvarlig`
- **Gruppeansvarlig (blå prikk):** Per gruppemedlem i utvidet gruppe, toggle `isAdmin`
- **Visuelt skille:** Grupper øverst, stiplet linje, enkeltpersoner under med gruppetag (· Byggherre)
- **Fjern:** X på gruppemedlemmer (fjerner fra gruppe), X på grupper (fjerner fra flyt), X på enkeltpersoner (fjerner fra flyt)
- **Rediger dokumentflyt:** Klikk tittel → inline redigering + slett-knapp i redigeringsmodus
- **Ny dokumentflyt:** Stiplet knapp per entreprise
- **Kontraktsform-uavhengig:** Samme system for NS 8405/8406/8407

### Brukersiden — kontakttabell

- **Eneste visning** under Brukere (ingen toggle mellom grupper og kontakter)
- **Gruppert etter brukergruppe** med klikkbare overskrifter (expand/collapse) og modul-badges
- **Sticky header** med filter
- **Kolonnefiltre:** Søk + dropdown for rolle, entreprise, gruppe
- **Kompakt badge-visning:** Første verdi + "+N" for entrepriser og grupper
- **Firmaansvarlig:** Settes via rolle-dropdown (Admin/Firmaansvarlig/Medlem)
- **Skjold-ikoner:** Blått = Admin, gult = Firmaansvarlig

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
- **DWG-import og datautvinning:** Dagens konvertering mister vesentlig innhold og metadata. Må forbedres for å hente ut alt som ligger i DWG-filen:
  - **Manglende innhold:** Hele seksjoner kan forsvinne (f.eks. Ålesund-tegningen mangler geometri pga. ugyldig DXF extents 1e20 → 0 SVG-elementer → fallback til dwg2SVG som gir enklere SVG uten metadata)
  - **Manglende metadata:** DWG-filer inneholder rik metadata (blokk-attributter, egendefinerte egenskaper, xdata, lagbeskrivelser, blokk-hierarki) som ikke trekkes ut i dag
  - Blokk-referanser (INSERT) mister lag-tilhørighet og attributt-data ved utfolding
  - Hatch-mønstre (skravur) støttes ikke — bare SOLID-fyll
  - Stor blokk-filtrering (>10k entiteter) kan fjerne viktig innhold
  - Layout-SVGer er identiske kopier av model space — viewport-klipping mangler
  - **Mål:** DWG-import bør hente ut like mye informasjon som profesjonelle DWG-viewere (AutoCAD, DWG TrueView) — lag, blokk-attributter, egenskaper, dimensjoner, referanser
  - Vurder alternativ DXF-parser eller direkte DWG-lesing (Open Design Alliance SDK) for bedre datautvinning
  - Re-konvertering av eksisterende tegninger bør automatiseres

## Modularkitektur (planlagt)

To nye moduler: **Dokumenter** (søk i maler, sjekklister, mappedokumenter) og **Økonomi** (budsjett, A-nota/T-nota).

Felles lag: OCR-tjeneste (fallback), søkemotor (felles `SearchIndex` med `tsvector`), tilgangskontroll.

Tre søke-scopes: Prosjekt (medlemmer), Firma (organisasjonen), SiteDoc (felles innhold).

Se `docs/MIGRERING-FIL-TIL-DATABASE.md` for detaljer.
