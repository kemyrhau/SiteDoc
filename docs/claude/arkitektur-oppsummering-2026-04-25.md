# Arkitektur-oppsummering 2026-04-25

Forarbeid før ny chat for DB-opprydning. Faktabasert oversikt over hva som foreligger i kode i dag og hva som er planlagt. Ingen designforslag.

**Kilder:** `packages/db/prisma/schema.prisma`, `packages/db-maskin/prisma/schema.prisma`, `docs/claude/datamodell-arkitektur.md`, `docs/claude/audit-data-2026-04-25.md`, `docs/claude/db-opprydning.md`, `docs/claude/migrering-reporttemplate.md`, `CLAUDE.md`, faktisk lokal sitedoc (`sitedoc` på localhost), kodestruktur i `apps/api`, `apps/web`, `apps/mobile`.

**Merknad:** `docs/claude/timer-input-katalog.md` (referert fra CLAUDE.md sin «Pauset arbeid»-seksjon) finnes IKKE som fil. Listet som «nevnt i diskusjon, ikke spesifisert» i del 3.

---

## Del 1 — Foreligger i dag

### 1.1 Faktisk DB-skjema

**Prisma-modeller totalt:**
- `packages/db`: 47 modeller
- `packages/db-maskin`: 5 modeller (`Equipment`, `EquipmentAssignment`, `ServiceRecord`, `Feilmelding`, `VegvesenKo`) — eget Postgres-skjema `maskin`, ingen FK på tvers

**Avvik mellom Prisma-modellnavn og fysisk tabellnavn (via @@map) — utvalg:**

| Prisma-modell | Prisma `@@map`-verdi | Faktisk DB-tabell (lokal) |
|---|---|---|
| `Faggruppe` | `dokumentflyt_parts` | **`enterprises`** ⚠️ |
| `FaggruppeKobling` | `dokumentflyt_koblinger` | **`member_enterprises`** ⚠️ |
| `GroupFaggruppe` | `group_faggrupper` | **`group_enterprises`** ⚠️ |
| `Organization` | `organizations` | `organizations` ✅ |
| `Project` (uten @@map) | `projects` | `projects` ✅ |
| `ReportTemplate` | `report_templates` | `report_templates` ✅ |
| `Byggeplass` | `byggeplasser` | `byggeplasser` ✅ |

**Avvikene for Faggruppe/FaggruppeKobling/GroupFaggruppe er kritiske:** Prisma-skjemaet sier at tabellene HETER `dokumentflyt_parts` etc., men i lokal sitedoc heter de fortsatt `enterprises` etc. Audit-rapporten 2026-04-25 sa «Prisma har @@map som dekker dette» — det stemmer ikke når @@map-verdiene ikke matcher fysiske tabellnavn (se del 3.3).

**FK-relasjoner — overordnet:**
- 23 modeller har `projectId` med `onDelete: Cascade` — konsistent
- 3 modeller har `organizationId`: `User` (SetNull), `OrganizationIntegration` (Cascade), `OrganizationProject` (Cascade)
- `db-maskin.Equipment.organizationId` har ingen DB-FK (Equipment er i eget Postgres-schema, FK håndheves i app-lag)

**Antall rader i lokal sitedoc (fra audit):**

| Tabell | Rader | Tabell | Rader |
|---|---|---|---|
| `users` | 3 | `enterprises` | 3 |
| `organizations` | 1 | `member_enterprises` | 2 |
| `projects` | 1 (standalone) | `group_enterprises` | 0 |
| `organization_projects` | 0 | `folder_access` | 0 |
| `report_templates` | 2 | `kontrollplan_punkter` | 0 |
| `dokumentflyter` | 3 | `dokumentflyt_medlemmer` | 3 |

### 1.2 Implementerte moduler

| Modul | Prisma | API-rute | Web-UI | Mobil-UI |
|---|---|---|---|---|
| Brukere | `User` (db) | `bruker.ts` | ✅ `/dashbord/oppsett/brukere` (m.m.) | ✅ |
| Organisasjon | `Organization`, `OrganizationProject`, `OrganizationIntegration` | `organisasjon.ts` | ✅ `/dashbord/firma`, `/dashbord/admin` | — |
| Prosjekt | `Project`, `ProjectMember`, `ProjectInvitation`, `ProjectModule` | `prosjekt.ts`, `medlem.ts`, `modul.ts`, `invitasjon.ts` | ✅ `/dashbord/[prosjektId]/...` | ✅ |
| Faggruppe | `Faggruppe`, `FaggruppeKobling`, `GroupFaggruppe` | `faggruppe.ts` | ✅ `/dashbord/[prosjektId]/faggrupper` | ✅ |
| Brukergrupper | `ProjectGroup`, `ProjectGroupMember` | `gruppe.ts` | ✅ (i oppsett) | — |
| Mapper | `Folder`, `FolderAccess` | `mappe.ts` | ✅ `/dashbord/[prosjektId]/mapper` | ✅ |
| Sjekklister | `Checklist`, `ReportTemplate`, `ReportObject` | `sjekkliste.ts`, `mal.ts` | ✅ `/sjekklister`, `/maler` | ✅ |
| Oppgaver | `Task`, `TaskComment` | `oppgave.ts` | ✅ `/oppgaver` | ✅ |
| Dokumentflyt | `Dokumentflyt`, `DokumentflytMedlem`, `DokumentflytMal`, `DocumentTransfer` | `dokumentflyt.ts` | ✅ (i oppsett) | ✅ |
| Tegninger / 3D / Punktsky | `Drawing`, `DrawingRevision`, `PointCloud` | `tegning.ts`, `punktsky.ts` | ✅ `/tegninger`, `/3d-visning`, `/punktskyer`, `/modeller` | ✅ |
| Bilder | `Image` | `bilde.ts` | ✅ `/bilder` | ✅ (kamera) |
| Bibliotek + Kontrollplan | `BibliotekStandard/Kapittel/Mal`, `ProsjektBibliotekValg`, `Kontrollplan`, `KontrollplanPunkt`, `KontrollplanHistorikk`, `Milepel`, `Byggeplass`, `Omrade` | `bibliotek.ts`, `kontrollplan.ts`, `byggeplass.ts`, `omrade.ts` | ✅ `/kontrollplan` | — |
| PSI | `Psi`, `PsiSignatur` | `psi.ts` | ✅ `/psi`, top-level `/psi` (ekstern) | ✅ |
| Økonomi (FTD) | 11 Ftd*-modeller | `kontrakt.ts`, `ftdSok.ts`, `nota-import-router.ts`, `prosesser.ts`, `mengde.ts` | ✅ `/okonomi`, `/dokumentleser` | — |
| AI-søk | (bruker `FtdDocument*`-tabeller) | `aiSok.ts` | ✅ `/sok` | — |
| Værdata | (ingen modell — ekstern API) | `vaer.ts` | ✅ (innebygd i sider) | ✅ |
| Maskin | `Equipment`, `EquipmentAssignment`, `ServiceRecord`, `Feilmelding`, `VegvesenKo` (db-maskin) | `maskin/equipment.ts`, `maskin/index.ts` | ✅ `/dashbord/maskin` (firma-bredt) | — |
| Timer | — | — | ✅ Prototype `/dashbord/[prosjektId]/timer` (hardkodede demodata) | — |
| Mannskap | — | — | — | — |
| Planlegger | — | — | — | — |
| WebSocket | — | `ws.ts` | ✅ (innebygd) | — |
| Auth | `Account`, `Session`, `VerificationToken` | `mobilAuth.ts` | ✅ (NextAuth) | ✅ |
| Admin | (felles) | `admin.ts` | ✅ `/dashbord/admin` | — |

**Bekreftelse:** Timer-modulen har KUN prototype-UI med hardkodede demodata. Ingen Prisma-modeller, ingen API-rute, ingen mobil-UI. Per CLAUDE.md «Timer-prototype — midlertidig plassering»: skal flyttes til `apps/timer/` + `packages/db-timer/` i Fase 3.

### 1.3 Loan-pattern som finnes

Tabeller som binder firma-eid ressurs til prosjekt-eid kontekst:

| Loan-tabell | Pakke | Kobler | Felter (utvalg) | Mønster |
|---|---|---|---|---|
| `OrganizationProject` | `db` | `Organization` ↔ `Project` | `organizationId`, `projectId` | Eierskap (ikke loan) |
| `ProjectMember` | `db` | `User` (firma) → `Project` | `userId`, `projectId`, `role`, `erFirmaansvarlig` | `*Member` |
| `ProjectGroup` | `db` | (kun prosjekt-lokal) | `projectId`, `name`, `domains` (JSON) | n/a — ikke loan |
| `ProjectGroupMember` | `db` | `ProjectMember` → `ProjectGroup` | `projectMemberId`, `groupId`, `isAdmin` | `*Member` |
| `FaggruppeKobling` | `db` | `ProjectMember` → `Faggruppe` | `projectMemberId`, `faggruppeId`, `rolle` | `*Kobling` |
| `GroupFaggruppe` | `db` | `ProjectGroup` ↔ `Faggruppe` | `groupId`, `faggruppeId` | n/a (begrensning, ikke loan) |
| `ProsjektBibliotekValg` | `db` | `BibliotekMal` (global) → `Project` | `prosjektId`, `bibliotekMalId`, `sjekklisteMalId` | `*Valg` |
| `EquipmentAssignment` | `db-maskin` | `Equipment` (firma) → `Project` (referanse i app-lag) | `equipmentId`, `projectId` | `*Assignment` |

**Mønster-konvensjoner i bruk:** `*Member`, `*Kobling`, `*Assignment`, `*Valg`. Ikke standardisert til ett.

### 1.4 Eksisterende firma-konsepter

**Modeller direkte knyttet til Organization:**
- `Organization` — firma-rot (id, name, organizationNumber, invoiceAddress, ehfEnabled, logoUrl)
- `OrganizationIntegration` — type, url, apiKey, config, aktiv (1 unique per `organizationId+type`)
- `OrganizationProject` — kobling til Project (id, organizationId, projectId, unique)
- `User.organizationId` — bruker tilhører firma (SetNull ved firma-sletting)
- `Equipment.organizationId` (db-maskin) — maskin tilhører firma

**Brukergrupper-status:**
- Det finnes IKKE en separat `Group`-modell på firma-nivå
- `ProjectGroup` er prosjekt-lokal (har `projectId`, ikke `organizationId`)
- `GroupFaggruppe`-modellen kobler `ProjectGroup` til `Faggruppe` — også prosjekt-lokalt

**Permanent firma-rot finnes ikke for:** maler (`ReportTemplate`), faggrupper (`Faggruppe`), brukergrupper (`ProjectGroup`), kompetanser, lønnsarter, tillegg, varer, kunder/byggherrer, samarbeidspartnere, modul-aktivering, instillinger, avdelinger.

---

## Del 2 — Planlagt arkitektur

Kilder: `docs/claude/datamodell-arkitektur.md` + `docs/claude/migrering-reporttemplate.md` + `docs/claude/db-opprydning.md`.

### 2.1 To-nivå datamodell-prinsipp

- **Firma-eid:** delte ressurser (én sannhet per firma)
- **Prosjekt-eid:** lokal arbeid på et prosjekt
- **Transaksjoner** (timer, vareforbruk, innsjekk) = vanlige tabeller med FK til både firma og prosjekt — ikke et eget arkitekturlag
- Eierskap er enten firma eller prosjekt — aldri begge
- Prosjekter «låner» firma-ressurser via etablerte `*Member` / `*Assignment` / `*Valg`-patterns
- Faggruppe ≠ Firma (konsept-skille — Bravida = Elektro + Ventilasjon = to faggrupper, ett firma)

### 2.2 Nye firma-eide modeller (må bygges)

| Modell | Pakke | Formål | Status |
|---|---|---|---|
| `OrganizationModule` | `db` | Av/på-aktivering av firmamoduler (timer, maskin, mannskap, planlegger) | Skissert i datamodell-arkitektur.md |
| `OrganizationTemplate` | `db` | Firma-mal-bibliotek for sjekkliste/oppgave/godkjenning | Spec i migrering-reporttemplate.md (full Prisma-modell + API + UI) |
| `OrganizationPartner` | `db` | Faste samarbeidspartnere (UE, byggherrer) som referanse fra Faggruppe | Skissert (felter ikke fullt definert) |
| `OrganizationSetting` | `db` | Firma-instillinger inkl. `bruksAvdelinger` boolean | Skissert (felter ikke fullt definert) |
| `Avdeling` | `db` | Valgfri firma-avdeling (Narvik, Tromsø osv.) | Skissert |
| `OrganizationPsiTemplate` | `db` | Valgfri firma-PSI-mal som starpunkt | Skissert (ingen Prisma-skisse) |
| `Wage`, `Addition`, `Allowance` | `db-timer` | Lønnsarter, tillegg, godtgjørelser | Nevnt — ikke spesifisert (timer-input-katalog.md mangler) |
| `Goods`, `GoodsCategory`, `GoodsLocation` | `db-timer` (eller eget) | Vareregister | Nevnt — ikke spesifisert |
| `Kompetanse`, `UserKompetanse`, `KompetanseType` | `db-mannskap` (planlagt) | Sertifikat-/HMS-kort-register | Nevnt — ikke spesifisert |

### 2.3 Modeller som må endres

| Modell | Endring | Spec |
|---|---|---|
| `ReportTemplate` | Legg til `organizationTemplateId?`, `promotedToFirma` | Full spec i migrering-reporttemplate.md |
| `Faggruppe` | Legg til `partnerId?` (ref til `OrganizationPartner`) | Skissert (verdi rent referanse, styrer ingen logikk) |
| `User` | Legg til `hmsKortNummer?`, `telefonPassord?` (hashet) | Skissert |
| `Psi` | Legg til `basedOnTemplateId?` (ref til `OrganizationPsiTemplate`) | Skissert |
| `Project` (evt.) | Legg til `avdelingId?` | Avhenger av `Avdeling`-implementasjon |

### 2.4 Nye loan-patterns

Ingen nye patterns planlagt. Eksisterende `*Member`, `*Assignment`, `*Valg`-patterns brukes for nye relasjoner. Datamodell-arkitektur.md sier eksplisitt: «Hold disse adskilt — ikke standardisér til ett navn nå (refaktor av eksisterende blir for stort). Bruk passende mønster når nye loan-tabeller bygges.»

---

## Del 3 — Gap mellom nå og planlagt

### 3.1 DB-naming

**Bekreftet:**
- Lokal sitedoc har fortsatt `enterprises`, `member_enterprises`, `group_enterprises`
- Migreringsmapper finnes for rename: `20260415180000_enterprise_rename_dokumentflyt_part` og `20260416180000_faggruppe_rename`
- I lokal sitedoc er ingen rename-migreringer applied (verifisert mot `_prisma_migrations`-tabellen — kun applied: `legg_til_enterprise_id_dokumentflyt`, `legg_til_show_enterprise`, `flerforetagsbrukere_member_enterprise`)
- 89 av 110 migreringsmapper er applied lokalt. 6 har failed. Status for test og prod er IKKE verifisert.

**Konsekvens:** Prisma sier `@@map("dokumentflyt_parts")` — men lokal sitedoc har `enterprises`. Dette er en uoverensstemmelse. Hvordan koden fungerer mot lokal sitedoc er **uavklart** (mulig at lokal ikke kjører appen mot denne DB-en, eller at det skjer noe i Prisma-laget jeg ikke har observert).

### 3.2 Avhengigheter mellom planlagte arbeider

```
DB-naming-opprydning (1.1)
        ↓ må gjøres FØR
   ──────────────────────────────────────────
   ↓                    ↓                   ↓
OrganizationTemplate  OrganizationModule  Andre firma-modeller
(migrering-           (åpner timer-       (Avdeling, Setting,
reporttemplate.md)    modul)              PsiTemplate, etc.)
   ↓
 Faggruppe.partnerId ← OrganizationPartner
   ↓
 Underprosjekt (db-timer) — avhenger av Proadm- eller Godkjenning-kobling
   ↓
 Wage/Addition/Allowance/Goods (db-timer) — avhenger av timer-modul-spesifikasjon
   ↓
 Kompetanse-modeller (db-mannskap) — avhenger av mannskap-modul-spesifikasjon
```

**Uavhengige arbeider** (kan startes uavhengig av rekkefølge):
- CHECK constraint på `dokumentflyt_medlemmer` (db-opprydning 1.2)
- Maskin-modul (allerede bygget — ingen avhengighet)

**Sterkt avhengige arbeider:**
- All ny firma-eid modell-bygging er BLOKKERT av at @@map → fysisk navn-uoverensstemmelsen ryddes (gjør at Prisma-migreringer kan kjøres trygt)

### 3.3 Identifiserte konflikter eller motsigelser

1. **Manglende fil:** `docs/claude/timer-input-katalog.md` referert fra `CLAUDE.md` (Pauset arbeid-seksjon, lagt til 2026-04-25) finnes ikke. Ingen kjent kilde for innholdet — nevnt i diskusjon, ikke spesifisert.

2. **Audit-rapporten vs faktisk Prisma:**
   - Audit sier: «Prisma har @@map som dekker dette» (om enterprises-tabellen)
   - Faktisk: Prisma har `@@map("dokumentflyt_parts")` mens DB har `enterprises`. Dette er en uoverensstemmelse, ikke en dekking.
   - Uavklart: hvordan koden faktisk kjører lokalt mot denne DB-en

3. **Datamodell-arkitektur vs faktisk DB:**
   - Datamodell-arkitektur.md sier «`User` + `ProjectMember` (loan-pattern via medlemskap)» som ✅ Finnes
   - Audit viser: 1 av 3 brukere har `organizationId` satt; eneste prosjekt er standalone (ingen rad i `organization_projects`). Strukturen finnes, bruken er minimal i lokal data.

4. **Migrering-reporttemplate vs db-opprydning:**
   - Migrering-reporttemplate.md beskriver `OrganizationTemplate` med relasjon til `ReportTemplate` (`promotedFromTemplateId`)
   - Db-opprydning.md sier mal-promotering er Prioritet 3 (etter rename-opprydning)
   - Ikke en direkte motsigelse, men avhengighet er tydelig: ReportTemplate-utvidelse forutsetter at rename er ryddet i ReportTemplate-relaterte FK først

5. **CLAUDE.md vs faktisk:**
   - CLAUDE.md sier «Timer planlegges som [isolert app]» (`apps/timer/`)
   - Eksisterende prototype ligger i `apps/web/src/app/dashbord/[prosjektId]/timer/` (per CLAUDE.md «Timer-prototype — midlertidig plassering»)
   - Ikke motsigelse — er eksplisitt midlertidig plassering inntil flytting

6. **Failed migreringer lokalt:** 6 av 95 migreringer har `finished_at IS NULL` (failed eller pågående). Innholdet i de feilede er ikke gjennomgått her. Kan være relatert til hvorfor rename-migreringene ikke har kjørt.

---

## Del 4 — Anbefalt rekkefølge for fremdrift

Basert på `docs/claude/db-opprydning.md` § «Foreslått rekkefølge», justert for funn i del 3.

1. **Verifiser DB-state på alle miljøer** — kjør `_prisma_migrations`-sjekk mot lokal, test (`sitedoc_test`) og prod (`sitedoc`). Avklar om rename-migreringene er applied noen steder (krever SSH og eksplisitt godkjenning per CLAUDE.md task boundary-regel).
2. **Avklar de 6 failed migreringene lokalt** — kan blokkere videre migreringer.
3. **Faggruppe-rename på fysisk DB-nivå** (db-opprydning 1.1) — lokal → test → prod. Bringer Prisma `@@map`-verdier i samsvar med fysiske tabellnavn.
4. **CHECK constraint på `dokumentflyt_medlemmer`** (db-opprydning 1.2) — null risiko, klar nytte.
5. **Designbeslutninger** (db-opprydning 2.1, 2.2, 2.3) — `ProjectGroup`-nivå, `FolderAccess`-prioritet, delt mal-bruk Kontrollplan+Dokumentflyt.
6. **Bygg `OrganizationModule`** — åpner timer-modul-arbeid.
7. **Bygg `OrganizationPartner`** — gir grunnlag for `Faggruppe.partnerId`.
8. **Bygg `OrganizationTemplate`** (migrering-reporttemplate.md) — mal-promotering.
9. **Resterende firma-modeller** etter modul-prioritet (db-timer, db-mannskap når relevant).

Etter steg 1–7 kan timer-modul gjenopptas på solid grunnlag.

---

## Vedlegg — kjernefakta

- **Dato for oppsummering:** 2026-04-25
- **Antall Prisma-modeller:** 47 i `db` + 5 i `db-maskin` = 52 totalt
- **Antall fysiske tabeller i lokal sitedoc:** 50
- **Antall API-ruter (Fastify):** 33 toppnivå + maskin-undermappe
- **Web-UI-sider per prosjekt:** 18 undermapper i `[prosjektId]/`
- **Mobil-UI-tabs:** 4 (`hjem`, `boks`, `lokasjoner`, `mer`)
- **Fail/applied-ratio lokalt i `_prisma_migrations`:** 6 failed / 89 applied (av 110 migreringsmapper i kildekoden)
