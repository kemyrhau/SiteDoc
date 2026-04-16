# Rapport: Entreprise vs Faggruppe vs DokumentflytPart

## Problemstilling

Hele kodebasen bruker "enterprise"/"entreprise" som begrep for **faggruppe** (DokumentflytPart). Dette er feil — "entreprise" skal brukes på et høyere nivå (den faktiske kontraktsformen/selskapet), mens det vi i dag kaller "entreprise" egentlig er en **faggruppe** i dokumentflyten.

## Begrepsavklaring

| Begrep | Betydning | Eksempel |
|--------|-----------|---------|
| **Entreprise** (riktig bruk) | Kontraktsform / overordnet nivå | NS 8405 Totalentreprise, NS 8407 |
| **Faggruppe** (DokumentflytPart) | Deltakerrolle i dokumentflyt | Byggherre, Tømrer, Elektro, VVS |
| **Firma** | Det faktiske selskapet | Hansen Tømrer AS, Strøm & Lys AS |

## Omfang

Totalt ~1200+ forekomster fordelt på:

| Lag | Filer | Forekomster |
|-----|-------|-------------|
| Prisma-skjema | 1 | ~40 |
| API (routes + tRPC) | 18 | ~250 |
| Web frontend | 42 | ~260 |
| Shared (typer, validering, utils) | 5 | ~50 |
| i18n (14 språk) | 14 | ~700 |
| Mobil | 8 | ~78 |

---

## 1. DATABASE (Prisma-skjema)

### Kolonner som heter `enterprise_id` men peker til DokumentflytPart

| Modell | Felt | DB-kolonne | Relasjon til |
|--------|------|------------|-------------|
| `DokumentflytKobling` | `enterpriseId` | `enterprise_id` | `DokumentflytPart` |
| `GroupDokumentflytPart` | `enterpriseId` | `enterprise_id` | `DokumentflytPart` |
| `ProjectInvitation` | `enterpriseId` | `enterprise_id` | `DokumentflytPart` |
| `FolderAccess` | `enterpriseId` | `enterprise_id` | `DokumentflytPart` |
| `Dokumentflyt` | `enterpriseId` | `enterprise_id` | `DokumentflytPart` |
| `DokumentflytMedlem` | `enterpriseId` | `enterprise_id` | `DokumentflytPart` |
| `FtdNotaPeriod` | `enterpriseId` | `enterprise_id` | `DokumentflytPart` |
| `Checklist` | `bestillerEnterpriseId` | `bestiller_enterprise_id` | `DokumentflytPart` |
| `Checklist` | `utforerEnterpriseId` | `utforer_enterprise_id` | `DokumentflytPart` |
| `Task` | `bestillerEnterpriseId` | `bestiller_enterprise_id` | `DokumentflytPart` |
| `Task` | `utforerEnterpriseId` | `utforer_enterprise_id` | `DokumentflytPart` |

### Relasjoner med feil navn

| Modell | Relasjonsnavn i skjema | Burde hete |
|--------|----------------------|------------|
| `Checklist` | `bestillerEnterprise` | `bestillerFaggruppe` |
| `Checklist` | `utforerEnterprise` | `utforerFaggruppe` |
| `Task` | `bestillerEnterprise` | `bestillerFaggruppe` |
| `Task` | `utforerEnterprise` | `utforerFaggruppe` |

### Andre enterprise-felt i DokumentflytPart-modellen

| Felt | DB-kolonne | Kommentar |
|------|-----------|---------|
| `enterpriseNumber` | `enterprise_number` | Faggruppens nummer — kan bli `fagGruppeNummer` |

### Tabellnavn

| Modell | @@map | Kommentar |
|--------|-------|---------|
| `GroupDokumentflytPart` | `group_enterprises` | Burde hete `group_faggrupper` el.l. |
| `DokumentflytPart` | `dokumentflyt_parts` | OK — allerede renamed fra `enterprises` |

### Literal streng-verdi

| Modell | Felt | Verdi | Kommentar |
|--------|------|-------|---------|
| `FolderAccess` | `accessType` | `"enterprise"` | Brukes som enum-verdi i kode |
| `ReportTemplate` | `showEnterprise` | boolean | Flagg for å vise faggruppe-felt |

### Snapshot-felt (historikk, ikke FK)

| Modell | Felt | Kommentar |
|--------|------|---------|
| `DocumentTransfer` | `senderEnterpriseName` | Snapshot av avsender-faggruppe |
| `DocumentTransfer` | `recipientEnterpriseName` | Snapshot av mottaker-faggruppe |

---

## 2. API-RUTER

### Router-navn

| Fil | Router | Registrert som | Konsumeres av frontend som |
|-----|--------|---------------|---------------------------|
| `routes/entreprise.ts` | `entrepriseRouter` | `entreprise` | `trpc.entreprise.*` |

### Prosedyrer med entreprise-navn

| Router | Prosedyre | Hva den gjør |
|--------|-----------|-------------|
| `entreprise` | `hentForProsjekt` | Henter faggrupper |
| `entreprise` | `hentMedId` | Henter én faggruppe |
| `entreprise` | `opprett` | Oppretter faggruppe |
| `entreprise` | `oppdater` | Oppdaterer faggruppe |
| `entreprise` | `kopier` | Kopierer faggruppe |
| `entreprise` | `settAnsvarlig` | Setter ansvarlig på faggruppe |
| `entreprise` | `slett` | Sletter faggruppe |
| `medlem` | `hentMineEntrepriser` | Henter brukerens faggrupper |
| `medlem` | `tilknyttEntreprise` | Kobler bruker til faggruppe |
| `medlem` | `fjernFraEntreprise` | Fjerner bruker fra faggruppe |
| `gruppe` | `oppdaterEntrepriser` | Oppdaterer gruppens faggrupper |

### Tilgangskontroll-funksjoner

| Fil | Funksjon |
|-----|----------|
| `tilgangskontroll.ts` | `hentBrukerEntrepriseIder()` |
| `tilgangskontroll.ts` | `byggEntrepriseFilter()` |
| `tilgangskontroll.ts` | `verifiserEntrepriseTilhorighet()` |

### API-filer med forekomster (antall)

| Fil | ~Forekomster |
|-----|-------------|
| `routes/sjekkliste.ts` | 60 |
| `routes/oppgave.ts` | 50 |
| `trpc/tilgangskontroll.ts` | 45 |
| `routes/entreprise.ts` | 25 |
| `routes/medlem.ts` | 20 |
| `routes/gruppe.ts` | 15 |
| `routes/dokumentflyt.ts` | 5 |
| `routes/admin.ts` | 10 |
| `routes/prosjekt.ts` | 10 |
| `services/transfer-snapshot.ts` | 10 |
| `services/folder-tilgang.ts` | 10 |
| `routes/mengde.ts` | 5 |
| `routes/mappe.ts` | 2 |
| `routes/kontrakt.ts` | 1 |
| `routes/mal.ts` | 1 |
| `routes/organisasjon.ts` | 1 |

---

## 3. SHARED-PAKKER

### Typer (`packages/shared/src/types/index.ts`)

| Navn | Type | Kommentar |
|------|------|---------|
| `EnterpriseRole` | Type alias | Alias for `DokumentflytRolle` |
| `EnterpriseIndustry` | Type | Bransjevalg for faggruppe |
| `EnterpriseColor` | Type | Fargekode for faggruppe |
| `StandardEnterprise` | Type | Standard-faggruppe ved prosjektopprettelse |
| `ENTERPRISE_INDUSTRIES` | Konstant | Liste over bransjer |
| `ENTERPRISE_COLORS` | Konstant | Tilgjengelige farger |
| `STANDARD_ENTREPRISER` | Konstant | 5 standard-faggrupper (Byggherre, Bygg, Elektro, VVS, Ventilasjon) |
| `"enterprise_manage"` | Tillatelse | Granulær tillatelse |

### Validering (`packages/shared/src/validation/index.ts`)

| Navn | Type |
|------|------|
| `enterpriseRoleSchema` | Zod-skjema |
| `createEnterpriseSchema` | Zod-skjema |
| `copyEnterpriseSchema` | Zod-skjema |
| `enterpriseId` (i diverse skjemaer) | Zod-felt |
| `enterpriseIds` | Zod-felt |
| `enterpriseNumber` | Zod-felt |

### Utils

| Fil | Funksjon/felt | Forekomster |
|-----|---------------|-------------|
| `utils/flytRolle.ts` | `entrepriseIder`, `enterpriseId` i interfaces | 8 |
| `utils/mappeTilgang.ts` | `enterpriseId`, `entrepriseIder`, `accessType === "enterprise"` | 6 |

### i18n-nøkler (gjelder alle 14 språk)

Nøkkel-prefikser som inneholder "entreprise":
- `entrepriser.*` — ~20 nøkler (nyEntreprise, slettEntreprise, ingenEntrepriser, osv.)
- `kontakter.entrepriser` — tabellheader
- `tabell.entreprise` — kolonnenavn
- `oppsett.entrepriser` — menypunkt
- `dashbord.entrepriser` — dashbord-seksjon
- `hjelp.entrepriseOverskrift` / `hjelp.entrepriseBeskrivelse` — hjelpetekst
- `landing.entrepriseflyt` / `landing.entrepriseflytBeskrivelse` — landingsside
- `produksjon.entreprisetilknytning` — oppsett

---

## 4. WEB FRONTEND

### Sider med `trpc.entreprise.*`-kall

| Fil | Kall |
|-----|------|
| `oppsett/produksjon/kontakter/page.tsx` | `hentForProsjekt`, `opprett`, `oppdater`, `slett` |
| `oppsett/brukere/page.tsx` | `hentForProsjekt` |
| `oppsett/produksjon/box/page.tsx` | `hentForProsjekt` |
| `prosjekter/[id]/entrepriser/page.tsx` | `hentForProsjekt`, `opprett` |
| `prosjekter/[id]/sjekklister/page.tsx` | `hentForProsjekt` |
| `prosjekter/[id]/oppgaver/page.tsx` | `hentForProsjekt` |
| `[prosjektId]/entrepriser/page.tsx` | `hentForProsjekt` |
| `[prosjektId]/sjekklister/[id]/page.tsx` | `hentForProsjekt` |
| `[prosjektId]/oppgaver/[id]/page.tsx` | `hentForProsjekt` |
| `paneler/EntrepriserPanel.tsx` | `hentForProsjekt` |
| `mengde/entreprise-velger.tsx` | `hentForProsjekt` |
| `rapportobjekter/FirmaObjekt.tsx` | `hentForProsjekt` |
| `_components/EntrepriseTilknytningModal.tsx` | `hentForProsjekt` |

### Komponentfiler med "entreprise" i filnavnet

| Fil |
|-----|
| `apps/web/src/components/paneler/EntrepriserPanel.tsx` |
| `apps/web/src/components/mengde/entreprise-velger.tsx` |
| `apps/web/src/app/dashbord/oppsett/produksjon/_components/EntrepriseTilknytningModal.tsx` |
| `apps/web/src/app/dashbord/oppsett/produksjon/_components/entreprise-farger.ts` |
| `apps/web/src/app/dashbord/prosjekter/[id]/entrepriser/page.tsx` |
| `apps/web/src/app/dashbord/[prosjektId]/entrepriser/page.tsx` |

### URL-ruter med "entrepriser"

| Rute | Kommentar |
|------|---------|
| `/dashbord/prosjekter/[id]/entrepriser` | Faggruppe-side (gammel layout) |
| `/dashbord/[prosjektId]/entrepriser` | Faggruppe-side (ny layout) |

### Filer med flest forekomster (web)

| Fil | ~Forekomster |
|-----|-------------|
| `oppsett/produksjon/kontakter/page.tsx` | 24 |
| `StatusHandlinger.tsx` | 18 |
| `FlytIndikator.tsx` | 17 |
| `oppsett/produksjon/box/page.tsx` | 16 |
| `DokumentHandlingsmeny.tsx` | 15 |
| `[prosjektId]/sjekklister/page.tsx` | 13 |
| `[prosjektId]/oppgaver/page.tsx` | 13 |
| `_components/EntrepriseTilknytningModal.tsx` | 12 |
| `_components/dokumentflyt-komponenter.tsx` | 11 |
| `prosjekter/[id]/entrepriser/page.tsx` | 11 |

---

## 5. MOBIL

### Filer med forekomster

| Fil | ~Forekomster |
|-----|-------------|
| `components/OpprettDokumentModal.tsx` | 37 |
| `components/OppgaveModal.tsx` | 12 |
| `components/DokumentHandlingsmeny.tsx` | 9 |
| `components/FlytIndikator.tsx` | 7 |
| `components/rapportobjekter/FirmaObjekt.tsx` | 4 |
| `app/oppgave/[id].tsx` | 4 |
| `app/sjekkliste/[id].tsx` | 4 |
| `app/(tabs)/hjem.tsx` | 1 |

---

## 6. KJENT FEIL (allerede fikset)

| Fil | Problem | Status |
|-----|---------|--------|
| `routes/dokumentflyt.ts` linje 15 | `enterprise` brukt som Prisma-relasjon i include, men relasjonen heter `dokumentflytPart` | FIKSET (commit b7d9734) |

---

## Risikovurdering ved rename

### Høy risiko (krever migrering + API-bakoverkompatibilitet)
- **DB-kolonner** (`enterprise_id`, `bestiller_enterprise_id`, `utforer_enterprise_id`) — krever SQL-migrering
- **tRPC-routernavn** (`trpc.entreprise.*`) — mobilbrukere kan ikke oppdatere umiddelbart, trenger alias i 1+ uke
- **accessType-verdi** `"enterprise"` i FolderAccess — lagret data i DB

### Middels risiko
- **Prisma-feltnavn** — kan endres i skjema med `@map()` for å beholde DB-kolonner
- **Zod-skjemaer** — må oppdateres sammen med API
- **i18n-nøkler** — 14 språkfiler, ~50 nøkler per fil

### Lav risiko (kun kode-rename, ingen ekstern påvirkning)
- Variabelnavn, kommentarer, funksjonsparametre
- Filnavn og komponentnavn
- URL-ruter (kan redirecte)

---

## Anbefaling

Denne renamen bør gjøres som en **planlagt, trinnvis operasjon** på en feature-branch:

1. **Fase A**: Definer endelig navngivning (faggruppe? faggruppeId? dokumentflytPartId?)
2. **Fase B**: DB-migrering med `RENAME COLUMN` (beholder data)
3. **Fase C**: Prisma-skjema + API med bakoverkompatible aliaser
4. **Fase D**: Frontend + mobil + i18n
5. **Fase E**: Fjern aliaser etter 2 uker
