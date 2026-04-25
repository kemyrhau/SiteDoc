# Datamodell-arkitektur

To-nivå modell: **firma-eid** (delte ressurser) vs. **prosjekt-eid** (lokal arbeid). Prosjekter «låner» firma-ressurser via etablerte loan-patterns. Transaksjoner (timer, innsjekk, vareforbruk) er bare data — ikke et eget arkitekturnivå.

## Kjerneregler

1. **Eierskap er enten firma eller prosjekt — aldri begge**
2. **Firma-ressurser deles på tvers av prosjekter** via koblings-tabeller
3. **Prosjekt-ressurser kan referere firma-ressurser**, men har sin egen levetid
4. **Transaksjoner registrerer faktisk bruk** og lever som data, ikke separat arkitekturlag
5. **Faggruppe ≠ Firma** — to ulike konsepter, kan referere hverandre, men er aldri det samme

## Firma-eide ressurser

| Ressurs | Status | Modell | Loan-mekanisme til prosjekt |
|---------|--------|--------|------------------------------|
| Brukere/Mennesker | ✅ Finnes | `User.organizationId` | `ProjectMember` |
| Maskiner | ✅ Finnes | `Equipment.organizationId` | `EquipmentAssignment` |
| Bruker-grupper | ✅ Finnes | `Group` | `ProjectGroup`, `ProjectGroupMember` |
| Globale standard-bibliotek | ✅ Finnes | `BibliotekMal` | `ProsjektBibliotekValg` |
| Firma-integrasjoner | ✅ Finnes | `OrganizationIntegration` | n/a (firma-bredt) |
| Firma → prosjekter | ✅ Finnes | `OrganizationProject` | n/a (eierskap) |
| **Firma-mal-bibliotek** | ❌ Mangler | `OrganizationTemplate` | Kopieres til `ReportTemplate` |
| **Faste samarbeidspartnere** | ❌ Mangler | `OrganizationPartner` | Refereres fra `Faggruppe.partnerId` |
| **Firma-modul-aktivering** | ❌ Mangler | `OrganizationModule` | n/a (av/på per firma) |
| **Avdelinger** (valgfritt) | ❌ Mangler | `Avdeling` | `User.avdelingId`, `Project.avdelingId` |
| **Firma-PSI-mal** (valgfritt) | ❌ Mangler | `OrganizationPsiTemplate` | Kopieres ved opprettelse |
| **Lønnsarter / Tillegg / Godtgjørelser** | ❌ Mangler | `Wage`, `Addition`, `Allowance` (i `db-timer`) | Refereres fra timer-dagsseddel |
| **Vareregister** | ❌ Mangler | `Goods`, `GoodsCategory` (i `db-timer` eller eget) | Refereres fra `GoodsConsumption` |
| **Kompetanseregister** | ❌ Mangler | `Kompetanse`, `UserKompetanse` (i `db-mannskap`?) | Brukes av planlegger |

## Prosjekt-eide ressurser

| Ressurs | Status | Modell | Refererer firma-ressurs? |
|---------|--------|--------|--------------------------|
| Prosjekt | ✅ Finnes | `Project` | `Organization` (eier) |
| Byggeplass | ✅ Finnes | `Byggeplass.projectId` | — |
| Faggruppe | ✅ Finnes | `Faggruppe.projectId` | (ny) `partnerId → OrganizationPartner` (valgfri) |
| Prosjekt-mal | ✅ Finnes | `ReportTemplate.projectId` | (ny) `organizationTemplateId` (valgfri) |
| Sjekklister/Oppgaver | ✅ Finnes | `Checklist`, `Task` | `ReportTemplate` |
| Dokumentflyt | ✅ Finnes | `Dokumentflyt`, `DokumentflytMedlem` | `Faggruppe` |
| Kontrollplan per byggeplass | ✅ Finnes | `Kontrollplan.byggeplassId` | `BibliotekMal` (via `ProsjektBibliotekValg`) |
| PSI per byggeplass | ✅ Finnes | `Psi` | (ny) `basedOnTemplate?` til `OrganizationPsiTemplate` |
| Tegninger / 3D / Punktsky | ✅ Finnes | `Drawing`, `PointCloud` | — |
| Folder / Mappestruktur | ✅ Finnes | `Folder`, `FolderAccess` | — |
| **Underprosjekt** | ❌ Mangler | `Underprosjekt.projectId` (i `db-timer`) | Avledet fra Proadm eller `ReportInstance` (Godkjenning) |

## Transaksjoner — data, ikke arkitekturlag

Disse registrerer faktisk bruk. De er bare tabeller som har FK til både firma- og prosjekt-ressurser.

| Transaksjon | Modell | Felter |
|---|---|---|
| Timeregistrering | `Dagsseddel` (i `db-timer`) | `userId × projectId × dato + maskinId? + lønnsartId + underprosjektId?` |
| Vareforbruk | `GoodsConsumption` (i `db-timer`) | `goodsId × projectId + bruker + mengde + maskinId?` |
| Mannskap-tilstedeværelse | `Innsjekk` (i `db-mannskap`) | `userId × byggeplassId + tid_inn + tid_ut` |
| Maskin på prosjekt | `EquipmentAssignment` (eksisterer) | `equipmentId × projectId + fra + til` |
| Kontrollplan-historikk | `KontrollplanHistorikk` (eksisterer) | `kontrollplanId × user + handling + tid` |

## Loan-pattern — standardisert

Vi har tre eksisterende navnekonvensjoner. Anbefaling:

| Mønster | Bruk | Eksempel |
|---|---|---|
| `*Member` | Bruker-mot-noe (medlemskap, ikke kvantifisert tid) | `ProjectMember`, `ProjectGroupMember` |
| `*Assignment` | Ressurs på noe over en periode | `EquipmentAssignment` |
| `*Valg` | Aktivering av en mal/standard | `ProsjektBibliotekValg` |

Hold disse adskilt — ikke standardisér til ett navn nå (refaktor av eksisterende blir for stort). Bruk passende mønster når nye loan-tabeller bygges.

## Spesielle pattern-regler

### Faggruppe ≠ Firma

`Faggruppe` representerer **én fag-rolle på ett prosjekt**, ikke et firma. Et firma kan ha flere faggrupper på samme prosjekt:

```
OrganizationPartner: { id: 1, name: "Bravida AS", organizationNumber: "123456789" }

Faggruppe på Prosjekt X:
  - { name: "Elektro",     partnerId: 1, color: "yellow" }
  - { name: "Ventilasjon", partnerId: 1, color: "blue"   }
```

`partnerId` er **rent referanse** — styrer ingen logikk. Faggruppe kan også eksistere uten partner (engangskunder, interne faggrupper).

### Mal-promotering (firmaadmin)

Maler eksisterer på to nivåer som speiler hverandre:

```
OrganizationTemplate (firma-master)
       ↓ kopier ned
ReportTemplate.projectId (prosjekt-instans)
       ↑ promote opp (firmaadmin-knapp)
```

- Firmaadmin kan promotere en velfungerende prosjekt-mal til firma-bibliotek
- Ved opprettelse av ny mal i prosjekt: dropdown «Start fra firma-mal»
- Endringer i firma-mal påvirker ikke eksisterende prosjekt-instanser (de er kopier)
- Mulig fremtidig: «oppdater til siste firma-versjon»-knapp på prosjekt-instans

### Mannskap = User + transaksjoner (ikke separat allokering)

`User` er firma-eid og har én sannhet for «hvem er ansatt hos oss». Tilknytning til prosjekt skjer via:

1. **`ProjectMember`** — har tilgang til prosjektet (statisk)
2. **Timer-dagsseddel** — har faktisk jobbet på prosjektet (over tid)
3. **Innsjekk/utsjekk** — har vært fysisk tilstede (per dag)

Ingen separat «MannskapAllokering»-tabell trengs. For ekstra innloggingsmetoder utvider vi `User`:

```
User {
  email           // OAuth (eksisterende)
  hmsKortNummer?  // ny: byggekort/HMS-kort
  telefonPassord? // ny: hashet for telefon-login (SmartDok-stil)
  ...
}
```

Eksterne UE-arbeidere håndteres via `Faggruppe` + `Dokumentflyt` (uendret) — UE vedlikeholder egne ansatte.

### Underprosjekt (planlagt, i `db-timer`)

```
Underprosjekt {
  projectId           // hvilket prosjekt
  navn, status

  // Kilde — én av:
  kilde: "proadm" | "sitedoc_godkjenning"
  proadmId, proadmNummer, proadmType  // hvis Proadm
  godkjenningId                        // hvis SiteDoc Godkjenning
}
```

Konfigurasjon per prosjekt: hvilken kilde brukes. Aldri begge samtidig. Se [timer.md](timer.md).

### PSI-mal — valgfri firma-mal

```
OrganizationPsiTemplate?  // valgfri — firma kan ha standard PSI-mal
Psi { byggeplassId, basedOnTemplateId? }  // hver PSI er per byggeplass, kan starte fra firma-mal
```

PSI tilpasses alltid byggeplass — firma-mal er bare startpunkt.

### Avdelinger — valgfri firma-instilling

```
OrganizationSetting { organizationId, bruksAvdelinger: boolean }

Avdeling { organizationId, navn }  // kun aktiv hvis innstilling er på
User.avdelingId?
Project.avdelingId?
```

A.Markussen lar dette være av. Andre kunder kan slå på.

## Hva som fungerer uten tilpasning

✅ `Equipment` (firma-eid med assignment til prosjekt) — perfekt loan-pattern
✅ `BibliotekMal` (globalt) + `ProsjektBibliotekValg` (loan)
✅ `User` + `ProjectMember` (loan-pattern via medlemskap)
✅ `Byggeplass` per prosjekt med `Kontrollplan` per byggeplass
✅ `Organization` med `OrganizationProject` for eierskap-kobling
✅ `OrganizationIntegration` (kan utvides med moduler senere)

## Hva som må bygges

**Nye firma-eide modeller:**
- `OrganizationTemplate` (firma-mal-bibliotek)
- `OrganizationPartner` (faste samarbeidspartnere)
- `OrganizationModule` (modul-aktivering)
- `OrganizationSetting` (firma-instillinger inkl. bruksAvdelinger)
- `Avdeling` (valgfri)
- `OrganizationPsiTemplate` (valgfri firma-PSI-mal)
- `Wage`, `Addition`, `Allowance` (i `db-timer`)
- `Goods`, `GoodsCategory` (i `db-timer` eller separat)
- `Kompetanse`, `UserKompetanse` (i `db-mannskap`)

**Nye prosjekt-eide modeller:**
- `Underprosjekt` (i `db-timer`, avledet fra Proadm/Godkjenning)

**Utvidelser av eksisterende:**
- `User`: `hmsKortNummer?`, `telefonPassord?`
- `Faggruppe`: `partnerId?` (valgfri ref til OrganizationPartner)
- `ReportTemplate`: `organizationTemplateId?`, `promotedToFirma`
- `Psi`: `basedOnTemplateId?`

## Referanser

- [CLAUDE.md](../../CLAUDE.md) — terminologi, modulsystem
- [MALBYGGER.md](../../MALBYGGER.md) — mal-arkitektur
- [timer.md](timer.md) — timer-modul, underprosjekt
- [maskin.md](maskin.md) — maskin-modul
- [mannskap.md](mannskap.md) — mannskap-modul
- [planlegger.md](planlegger.md) — fremdriftsplanlegger med AI-utvidelse
