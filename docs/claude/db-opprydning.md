# DB-opprydning — handlingsplan

Aktiv arbeidsstrøm. Timer-modul er satt på pause til DB er ryddet opp. Identifisert via datamodell-audit 2026-04-25 og diskusjon rundt firma-eid vs. prosjekt-eid arkitektur.

**Bakgrunn:** [audit-data-2026-04-25.md](audit-data-2026-04-25.md) + [arkitektur.md § Datamodell-prinsipper](arkitektur.md#datamodell-prinsipper) (tidligere datamodell-arkitektur.md, konsolidert 2026-04-27) + [db-naming-audit-2026-04-25.md](db-naming-audit-2026-04-25.md)

**Status (per 2026-04-25):** Faggruppe-rename er **allerede gjennomført på test (2026-04-15/16) og prod (2026-04-16)**. Lokal-DB er ikke vedlikeholdt og brukes ikke som sannhet. Det opprinnelige scope (Prioritet 1.1) er derfor lukket. 4 mindre detaljer gjenstår som diskusjonspunkter.

## Status per 2026-04-25 — etter ny audit

Audit mot alle tre miljøer ([db-naming-audit-2026-04-25.md](db-naming-audit-2026-04-25.md)) bekreftet:

| Område | Test | Prod | Lokal |
|---|---|---|---|
| `enterprises`, `member_enterprises`, `group_enterprises`, `workflows*`, `buildings` | borte (renamed) | borte (renamed) | finnes (utdatert) |
| `dokumentflyt_parts`, `dokumentflyt_koblinger`, `group_faggrupper`, `byggeplasser` | finnes | finnes | mangler |
| Faggruppe-rename-migreringer applied | ✅ 2026-04-15/16 | ✅ 2026-04-16 | ❌ uforsøkt |

**Konsekvens:**
- Prioritet 1.1 er **GJENNOMFØRT** på de miljøene som teller (test og prod).
- Lokal-DB er erklært "ikke vedlikeholdt" — re-seedes fra test ved behov per `CLAUDE.md` § «Primærmiljø».
- Det som faktisk gjenstår er flyttet til [§ Utestående diskusjonspunkter](#utestående-diskusjonspunkter-etter-2026-04-25).

## Avgrensning av denne fasen

Denne fasen omfatter **kun fysiske DB-renames** (tabeller og kolonner). Disse er trygge for alle klienter — verifisert via bakoverkompatibilitet-kartlegging 2026-04-25:
- Mobil-appen har null kode-treff for «enterprise» (verken TypeScript eller native iOS/Android-mapper)
- Web-appen har null treff
- Kun 4 filer i hele kodebasen berøres, alle i `apps/api/` og `packages/db/prisma/`

### IKKE en del av denne fasen

Følgende beholdes uendret i denne fasen, krever separat planlegging mot mobil-versjon:

1. **`senderEnterpriseName` / `recipientEnterpriseName`** på `DocumentTransfer`-modellen — beholdes som «historisk snapshot»-felter (per eksisterende kommentar i `apps/api/src/services/transfer-snapshot.ts`). Disse eksponeres direkte i API-respons til klienter (ingen DTO-lag).

2. **tRPC-alias `entreprise: faggruppeRouter`** i `apps/api/src/trpc/router.ts` — beskytter eldre TestFlight-builds som kan kalle `trpc.entreprise.*`. Beholdes inntil mobil-versjonsstøtte er avklart.

3. **Andre felter eller signaturer som eksponeres i API-respons** og kan ha eldre mobil-konsumenter — krever DTO-lag før rename er trygt.

### Åpent diskusjons-punkt

**Snapshot-feltnavn — gamle eller konsistente?** `senderEnterpriseName` på `DocumentTransfer` er teknisk et historisk øyeblikksbilde (data lagret ved tidspunktet hendelsen skjedde). Argumenter:

- **Behold gammelt navn** (`*EnterpriseName`): markerer at feltet er et øyeblikksbilde fra «entreprise»-tiden, ikke den nåværende terminologien. Sikrer at lesere ikke forveksler snapshot-data med live `Faggruppe.name`.
- **Rename til konsistent** (`*FaggruppeName`): én terminologi i hele kodebasen. Snapshot-naturen kan markeres med kommentar/dokumentasjon i stedet.

Beslutning utsettes — inkluderes i en senere fase sammen med mobil-versjonsstrategi.

## Prioritet 1 — Lavhengende frukt (lav risiko, klar nytte)

### 1.1 Faggruppe-rename på fysisk DB-nivå — ✅ GJENNOMFØRT

**Status:** Applied på test (2026-04-15/16) og prod (2026-04-16) via tre migreringer:
- `20260405180000_navnegjennomgang` (slettet `workflows*`, renamet `buildings` → `byggeplasser`, `creator_*` → `bestiller_*`)
- `20260415180000_enterprise_rename_dokumentflyt_part` (renamet `enterprises`/`member_enterprises`)
- `20260416180000_faggruppe_rename` (renamet alle `enterprise_*`-kolonner til `faggruppe_*`, samt `group_enterprises` → `group_faggrupper`)

Verifisert i [db-naming-audit-2026-04-25.md](db-naming-audit-2026-04-25.md) — gamle tabellnavn er fysisk borte på test og prod, kun snapshot-felt på `document_transfers` gjenstår med "enterprise" i navnet (utenfor scope per neste seksjon).

**Lokal-DB er ikke renamed** — den er 26 migreringer bak kildekoden. Per `CLAUDE.md` § «Primærmiljø» er lokal ikke sannhet og blir re-seedet fra test ved behov. **Ingen handling kreves.**

**`@@map` kan IKKE fjernes** fra Prisma-modellene: konvensjonen er PascalCase modellnavn (`Faggruppe`) og snake_case norsk tabellnavn (`dokumentflyt_parts`) — `@@map` er nødvendig på samme måte som for `Project` → `projects`. Tidligere antagelse om at `@@map` skulle fjernes er forkastet.

### 1.2 CHECK constraint på `dokumentflyt_medlemmer`

**Problem:** Modellen tillater at `enterprise_id`, `group_id` og `project_member_id` settes samtidig på samme rad. Audit viste 0/3 rader med multiple FK satt — trygt å legge til constraint nå.

**Plan:**
```sql
ALTER TABLE dokumentflyt_medlemmer ADD CONSTRAINT dm_exactly_one_fk
  CHECK (
    (CASE WHEN enterprise_id IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN group_id IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN project_member_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  );
```

Wrap i Prisma-migrering med raw SQL.

**Risiko:** Veldig lav. Ingen eksisterende data brytes.

## Prioritet 2 — Krever avklaring før migrering

### 2.1 ProjectGroup — firma- eller prosjekt-nivå?

**Problem:** Ifølge ny arkitektur-modell skal brukergrupper være firma-eide (slik at de kan deles på tvers av prosjekter). I dag er `ProjectGroup` prosjekt-eid (`projectId`).

**Beslutning trengs:**
- (a) Innfør `OrganizationGroup` + loan-pattern, behold `ProjectGroup` som prosjekt-spesifikke
- (b) Migrer eksisterende `ProjectGroup` til `OrganizationGroup`, slett prosjekt-nivå
- (c) Behold som er — gruppene forblir prosjekt-lokale

**Konsekvens av valg:** Påvirker tilgangskontroll, modul-aktivering per gruppe (`ProjectGroup.domains`), og fremtidig planlegger.

**Status:** Ikke besluttet. Diskusjon må gjøres FØR `OrganizationModule` og `OrganizationTemplate` bygges.

### 2.2 FolderAccess prioritet ved konflikt

**Problem:** En bruker kan ha både direkte access og tilgang via gruppe på samme mappe. Hva vinner hvis access-typen er ulik?

**Forslag til regel:**
- **Brukerspesifikk overstyrer gruppe** (eksplisitt slår implisitt)
- **Eksplisitt nektelse vinner over implisitt tillatelse** (krever `denied`-access_type, finnes ikke i dag)

**Status:** 0 rader i `folder_access` per audit. Funksjonen er ikke i aktiv bruk. Regel MÅ defineres før første bruk for å unngå sikkerhetshull.

### 2.3 Delt mal-bruk: Kontrollplan + Dokumentflyt

**Problem:** Samme `ReportTemplate.id` kan refereres fra både `KontrollplanPunkt.sjekklisteMalId` og `DokumentflytMal.templateId`. Audit viste 0/2 maler — teoretisk problem.

**Beslutning trengs:**
- (a) Tillat delt bruk — endringer i mal påvirker begge kontekster (samme «mal-instans»)
- (b) Krev separate maler per kontekst — Kontrollplan og Dokumentflyt får hver sin kopi

**Konsekvens:** Påvirker UI-flyt (kan eksisterende mal velges fra Kontrollplan-konfigurasjon, eller må man opprette ny?). Påvirker mal-promotering til firma-bibliotek.

**Status:** Diskuter før mal-promotering implementeres.

### 2.4 Faggruppe.partnerId

**Problem:** Ny arkitektur foreslår `OrganizationPartner` som firma-bibliotek av faste samarbeidspartnere. `Faggruppe` får valgfri `partnerId` som referanse.

**Status:** `OrganizationPartner` er ikke opprettet. `partnerId`-felt er ikke lagt til. Avhenger av at `OrganizationPartner` bygges først.

## Prioritet 3 — Strukturelle forbedringer (større omfang)

### 3.1 OrganizationProject vs. standalone-prosjekter

**Problem:** Audit viste at eneste prosjekt i dev-DB er standalone (ikke koblet til Organization via `organization_projects`). Designet støtter standalone som permanent tilstand, men:
- Ingen organisasjonstilknytning = ingen firma-modul-aktivering, ingen firma-mal-bibliotek, ingen firma-rapportering
- Når et standalone-prosjekt overføres til Organization: hvor mye historikk følger med?

**Plan:**
- Dokumentere standalone-prosjekt som eksplisitt valgt tilstand (vs. «mangler firma»)
- Lag standalone→Organization-overføringsflyt (krever superadmin + firmaadmin-godkjenning per CLAUDE.md)
- Vurder om eksisterende standalone-prosjekt skal flyttes til en test-Organization

### 3.2 Manglende firma-eide modeller

Følgende mangler helt og må bygges (ikke opprydning, men oppfølging av ny arkitektur):

| Modell | Hvor | Avhengighet |
|---|---|---|
| `OrganizationModule` | `packages/db` | Trengs av timer-modul (knapp-betingelser) |
| `OrganizationTemplate` | `packages/db` | Mal-promotering |
| `OrganizationPartner` | `packages/db` | Faggruppe.partnerId |
| `OrganizationSetting` | `packages/db` | Avdeling av/på, andre firma-instillinger |
| `OrganizationPsiTemplate` | `packages/db` | Valgfri firma-PSI-mal |
| `Avdeling` | `packages/db` | Valgfri firma-instilling |
| `Wage`, `Addition`, `Allowance` | `packages/db-timer` | Timer-modul |
| `Goods`, `GoodsCategory`, `GoodsConsumption` | `packages/db-timer` (eller eget) | Timer-modul, Vareforbruk |
| `Kompetanse`, `UserKompetanse` | `packages/db-mannskap` | Mannskap-modul, AI-ukeplan |
| `Underprosjekt` | `packages/db-timer` | Timer-modul, koblet til Proadm/Godkjenning |

**Disse bygges når relevant modul aktiveres.** Ikke del av opprydning per se, men listet for oversikt.

## Utestående diskusjonspunkter (etter 2026-04-25)

Oppdaget under [db-naming-audit-2026-04-25.md](db-naming-audit-2026-04-25.md). Alle er små og krever beslutning, ikke umiddelbar handling.

### U.1 `project_groups.building_ids` (jsonb) — ⏸️ Utsatt — flyttet til byggeplass-strategi-fase

**Status:** Utsatt 2026-04-25. Skal ikke håndteres som isolert rename-oppgave.

**Beslutning:** Drop kolonnen og erstatt med FK + koblingstabell som del av byggeplass-strategi-fasen.

**Begrunnelse:** jsonb-array er feil tilnærming for m2m-relasjon mellom brukergruppe og byggeplasser — gir ingen referanseintegritet, ingen FK-cascading ved sletting av byggeplass, ingen indekser eller JOINs. Behovet for byggeplass-relasjon på brukergrupper og andre entiteter er reelt, men skal modelleres riktig som del av en koordinert byggeplass-fase, ikke fragmentert som en rename-detalj.

**Faktisk bruksgrad:** Skrives via mutation i `apps/api/src/routes/gruppe.ts`, men leses **aldri** i kodebasen. Test har 1 rad med data, prod har 0. Ingen funksjonell konsekvens av drop.

Detaljer i [byggeplass-strategi.md](byggeplass-strategi.md). Drop håndteres samtidig med koblingstabell-opprettelse — én koordinert migrering.

### U.2 FK-constraint-navn er fortsatt på engelsk

19 relevante FK på test/prod heter fortsatt `*_enterprise_id_fkey`, `*_building_id_fkey` osv., selv om kolonnene de er på heter `faggruppe_id`/`byggeplass_id`. Eksempler: `checklists_creator_enterprise_id_fkey` på `bestiller_faggruppe_id`. Funksjonelt OK, kun lesbarhet i feilmeldinger og psql-output. Skal de renames?

### U.3 `fiks_rolle_utforer` på test — ✅ Avklart 2026-04-25

Ikke et problem — er rolled-back-historikk fra normal `prisma migrate resolve --rolled-back` + ny `migrate deploy`. Begge versjoner av samme migration_name er bevart som audit-trail. DB-tilstanden er verifisert ren på begge servere (kun `bestiller`/`utforer`/`godkjenner`/`registrator` som rolle-verdier, ingen `utfører` med ø, ingen `oppretter`).

Samme pattern gjelder `psi_building`. Begge er feilklassifisert som "FAILED" i forrige versjon av audit-rapporten — se [db-naming-audit-2026-04-25.md § 4.2 og § 4.12](db-naming-audit-2026-04-25.md).

### U.4 `20260424001754_init` på test — ✅ Avklart 2026-04-25

Ikke et problem — er maskin-modulens egen init-migrering (`packages/db-maskin/prisma/migrations/20260424001754_init/migration.sql`). Vil applies på prod via normal merge til main. Detaljer i [db-naming-audit-2026-04-25.md § 4.10](db-naming-audit-2026-04-25.md).

## Foreslått rekkefølge — utdatert

> **Merknad 2026-04-25:** Den opprinnelige rekkefølgen er ikke lenger gyldig. Steg 1 (faggruppe-rename) er gjennomført. Resten av rekkefølgen forblir veiledende, men 1.2 (CHECK constraint) og 2.x-beslutningene er fortsatt åpne.

1. ~~Faggruppe-rename på fysisk nivå (1.1)~~ — ✅ GJENNOMFØRT på test og prod
2. **CHECK constraint på dokumentflyt_medlemmer** (1.2) — fortsatt åpen, null risiko
3. **Beslutning ProjectGroup-nivå** (2.1) — design-diskusjon, ingen kode
4. **Beslutning FolderAccess-prioritet** (2.2) — design-diskusjon, ingen kode
5. **Beslutning delt mal-bruk** (2.3) — design-diskusjon, ingen kode
6. **Bygg `OrganizationModule`** (3.2) — første firma-modell, åpner timer-modul
7. **Bygg `OrganizationPartner`** (3.2) — gir grunnlag for `Faggruppe.partnerId`
8. **Resterende firma-modeller** etter modul-prioritet

Etter steg 2–7 kan timer-modul gjenopptas på solid grunnlag.

## Det som IKKE er en del av opprydning

- Eksisterende ReportTemplate-instanser bevares uendret. Mal-promotering bygges som tillegg, ikke refaktor.
- Eksisterende `Faggruppe`-rader bevares — kun rename, ingen logikk-endring.
- Mobil-app trenger ingen oppdatering for opprydningssteg 1.1 og 1.2 (Prisma håndterer abstraksjon).
- `Equipment` og `EquipmentAssignment` (db-maskin) er allerede konsistent firma-eid med loan-pattern. Ingen endring.
