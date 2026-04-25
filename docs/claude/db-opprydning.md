# DB-opprydning — handlingsplan

Aktiv arbeidsstrøm. Timer-modul er satt på pause til DB er ryddet opp. Identifisert via datamodell-audit 2026-04-25 og diskusjon rundt firma-eid vs. prosjekt-eid arkitektur.

**Bakgrunn:** [audit-data-2026-04-25.md](audit-data-2026-04-25.md) + [datamodell-arkitektur.md](datamodell-arkitektur.md)

**Status:** Planlegging. Ingen migreringer kjørt.

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

### 1.1 Faggruppe-rename på fysisk DB-nivå

**Problem:** Prisma-modellene er renamed til `Faggruppe`, `FaggruppeKobling`, `GroupFaggruppe` via `@@map`, men fysiske DB-tabeller heter fortsatt:
- `enterprises` (skal være `dokumentflyt_parts` eller `faggrupper`)
- `member_enterprises` (skal være `dokumentflyt_koblinger`)
- `group_enterprises` (skal være `group_faggrupper`)
- `enterprise_id`-kolonner (skal være `faggruppe_id`)

**Konsekvens:** Direkte SQL-tilgang, dump/restore, og rapportering blir forvirrende. Påvirker ikke kode (Prisma håndterer mapping), men er teknisk gjeld.

**Plan:**
1. Lag Prisma-migrering med `RENAME TABLE` + `RENAME COLUMN` — bevarer all data
2. Fjern `@@map`-direktiver fra Prisma-modeller etter migrering
3. Test på `sitedoc_test` først, deretter prod
4. Deprecated alias-router i tRPC (`trpc.entreprise.*`) kan beholdes til mobil-app er oppdatert

**Risiko:** Lav. Pure rename, ingen data-endring. Krever koordinering med mobil-app for tRPC-router-aliaser.

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

## Foreslått rekkefølge

1. **Faggruppe-rename på fysisk nivå** (1.1) — lav risiko, betaler ned teknisk gjeld
2. **CHECK constraint på dokumentflyt_medlemmer** (1.2) — null risiko
3. **Beslutning ProjectGroup-nivå** (2.1) — design-diskusjon, ingen kode
4. **Beslutning FolderAccess-prioritet** (2.2) — design-diskusjon, ingen kode
5. **Beslutning delt mal-bruk** (2.3) — design-diskusjon, ingen kode
6. **Bygg `OrganizationModule`** (3.2) — første firma-modell, åpner timer-modul
7. **Bygg `OrganizationPartner`** (3.2) — gir grunnlag for `Faggruppe.partnerId`
8. **Resterende firma-modeller** etter modul-prioritet

Etter steg 1–7 kan timer-modul gjenopptas på solid grunnlag.

## Det som IKKE er en del av opprydning

- Eksisterende ReportTemplate-instanser bevares uendret. Mal-promotering bygges som tillegg, ikke refaktor.
- Eksisterende `Faggruppe`-rader bevares — kun rename, ingen logikk-endring.
- Mobil-app trenger ingen oppdatering for opprydningssteg 1.1 og 1.2 (Prisma håndterer abstraksjon).
- `Equipment` og `EquipmentAssignment` (db-maskin) er allerede konsistent firma-eid med loan-pattern. Ingen endring.
