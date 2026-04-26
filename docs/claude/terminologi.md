# Terminologi

Sentralt oppslagsverk for SiteDoc-begreper. Begreper sortert alfabetisk innen
hver gruppe. Status «vedtatt, ikke bygget» betyr at definisjonen er låst i
[fase-0-beslutninger.md](fase-0-beslutninger.md), men at koden ikke er
implementert ennå.

## 1. Organisasjon og firma

- **Firma:** Selskapet som eier SiteDoc-kontoen. DB: `Organization`. Eksempel: A.Markussen AS, Veidekke. Eier prosjekter og firmamoduler (timer, maskin, HR, planlegging). Kobling til prosjekter via `OrganizationProject`
- **Firmaadmin:** `User.role = "company_admin"` — administrerer firmaets prosjekter, brukere og firmamoduler. Arver admin-tilgang til alle prosjekter under sin Organization uten ProjectMember-rad
- **OrganizationIntegration:** Per-firma integrasjon mot eksternt system. Type: `proadm` / `hr` / `gps` / `smartdoc`. Lagrer `apiKey` (kryptert), `url`, `config` (JSON), `aktiv`. Unik per (orgId, type)

## 2. Prosjekt og struktur

- **Aktivitet (Activity):** Sentral audit-tabell for alle handlinger som påvirker timer, kostnad eller dokumentflyt-status. **Status: vedtatt, ikke bygget** (Fase 0 A.3)
- **Avdeling:** Firma-intern organisatorisk inndeling — kobles til User, EquipmentAnsvarlig og DailySheet. Distinkt dimensjon fra Byggeplass. **Status: vedtatt, ikke bygget** (Fase 0.5)
- **Byggeplass:** Lokasjon/anlegg i prosjektet. DB: `Byggeplass` (renamet fra `Building`/`Bygning`). Har `number`, `type` (deprecated, default `"bygg"`), `status`
- **Eksternt prosjektnummer:** Kundens/byggeherrens referanse på prosjektet
- **Firmalogo:** Prosjektets logo i print-header (`Project.logo_url`)
- **proAdmId:** UI-vennlig referanse til ProAdm-systemets ID for et underprosjekt. Vises i UI; UUID brukes i alle FK-er. Samme mønster som `kjennemerke` for kjøretøy
- **Produksjon:** Innstillingsseksjon for feltarbeid-oppsett (renamet fra «Feltarbeid»/«Field»)
- **Prosjektgruppe:** Kategori + tillatelser + fagområder + valgfri faggruppe-tilknytning. DB: `ProjectGroup`
- **Prosjektlokasjon:** Valgfri GPS (`Project.latitude`/`longitude`) for kartvisning og værhenting
- **Prosjektnummer:** Format `SD-YYYYMMDD-XXXX` (autogenerert)
- **Underprosjekt:** UI-term for ekstern kostnadsbærer-referanse innenfor et prosjekt — typisk endringsmelding, regningsarbeid eller delkontrakt fra ProAdm. DB-modell: `ExternalCostObject` (presist navn). Samme mønster som `proAdmId` (UI-vennlig) vs UUID (FK). **Status: vedtatt, ikke bygget** (Fase 0 A.1)

## 3. Roller

- **Bestiller (creator):** Faggruppen som initierer en sjekkliste/oppgave (renamet fra «Oppretter»). Dokumentflyt-rolle som angir hvem som har bestilt arbeidet
- **Faggruppe:** Deltaker i dokumentflyt innenfor ett prosjekt. DB-modell: `Faggruppe`, tabellnavn `dokumentflyt_parts` (via @@map). Eksempel: Byggherre, Tømrer, Elektro. Felter: `name`, `color`, `industry`, `companyName`, `faggruppeNummer`. **Bruk faggruppe — entreprise/enterprise er forbudt i ny kode.** Historikk: [entreprise-faggruppe-rapport.md](entreprise-faggruppe-rapport.md)
- **Flerforetagsbruker:** Bruker som tilhører flere faggrupper i samme prosjekt via `FaggruppeKobling(projectMemberId, faggruppeId)`
- **Godkjenner:** Dokumentflyt-rolle som tar endelig beslutning på et dokument. Brukes f.eks. for byggherre-godkjenning av endringsmelding
- **Registrator:** Dokumentflyt-rolle som først registrerer hendelsen (typisk på vegne av andre). Beholder admin-rettigheter på dokumentet selv etter videresending
- **UE (Underentreprenør):** Innleid arbeidskraft fra annet firma. Kan ha `ProjectMember.role = "underentreprenor"` for å skille tilgang fra ordinære medlemmer (ser kun egne timer + tildelte prosjekter, ikke katalog-priser). **Rolle-utvidelse: vedtatt, ikke bygget** (Fase 0 A.9)
- **Utfører (responder):** Faggruppen som mottar og besvarer en sjekkliste/oppgave (renamet fra «Svarer»)

## 4. Brukere

- **canLogin:** `User.canLogin Boolean default true`. False = data-mottaker uten innloggings-tilgang (eldre arbeidere uten smarttelefon, registreres av andre). NextAuth signIn-callback sjekker `canLogin === true`. **Status: vedtatt, ikke bygget** (Fase 0 A.10)
- **HMS-kort:** Obligatorisk identitetskort for alle som jobber på bygge- og anleggsplasser i Norge. Utstedes av Arbeidstilsynet. Kortnummer registreres ved PSI-gjennomføring (`PsiSignatur.hmsKortNr`). «Har ikke HMS-kort»-avkrysning for gjester/besøkende
- **HMS-kort utløpsdato:** `User.hmsKortUtloper date?` — utløpsdato fra HMS-kortet. Tverrgående varsling 90/30/7 dager før utløp. Lovgrunnlag: byggherreforskriften § 15. Utløpt kort blokkerer ikke innlogging — kun varsling. **Status: vedtatt, ikke bygget** (Fase 0 A.11)
- **Invitasjon:** E-post med token (7 dagers utløp), status `pending`/`accepted`/`expired`. DB: `ProjectInvitation`

## 5. Dokumenter og maler

- **Betingelse:** Logikk som styrer synlighet av barnefelt basert på forelderens verdi. Config: `conditionActive`, `conditionValues`
- **Enkeltvalg (`list_single`):** Én verdi. Web: `<select>`. Mobil: radioknapper. Kan være kontainer
- **Etasje-tegning:** Tegning uten `geoReference` — grupperes etter `floor`-felt
- **Flervalg (`list_multi`):** Flere verdier. Web: dropdown+chips. Mobil: avkrysning. Kan være kontainer
- **Kontainer:** Felt som kan inneholde barnefelt. Typer: `list_single`, `list_multi`, `repeater`. Sjekkes via `erKontainerType()` i `@sitedoc/shared`
- **Mal (template):** Gjenbrukbar oppskrift med drag-and-drop, prefiks og versjon. DB: `ReportTemplate`
- **Mapper:** Filstruktur med rekursiv mappestruktur og tilgangskontroll (renamet fra «Box»). DB: `Folder`
- **Mappeadgangskontroll:** `inherit` (arv fra forelder) eller `custom` (egen tilgangsliste). Admin ser alt. DB: `FolderAccess`
- **Oppgave:** Arbeidsoppgave med ansvarlig og frist, påkrevd mal. DB: `Task`. Kan kobles til tegning med posisjon
- **Prefiks:** Kort kode for mal (BHO, S-BET, KBO). Kombineres med løpenummer til `number`
- **Print-til-PDF:** `@media print` CSS + nettleserens «Lagre som PDF». Mobil bruker `@sitedoc/pdf`-pakken
- **Rapportobjekt:** Byggeblokk i en mal. **27 typer** — 23 ordinære (heading, text_field, list_*, decimal, traffic_light, ...) + 4 PSI-typer (info_text, info_image, video, quiz). Metadata i `REPORT_OBJECT_TYPE_META`
- **Repeater:** Kontainer med dupliserbare rader (uten betingelse)
- **Sjekkliste:** Strukturert dokument med rapportobjekter som fylles ut. DB: `Checklist`
- **Tegning:** Prosjekttegning (PDF/DWG/IFC) med versjonering. DB: `Drawing` + `DrawingRevision`
- **Tegningsmarkør:** Posisjon (0–100% X/Y) på tegning for oppgave eller sjekkliste
- **Utomhus-tegning:** Tegning med `geoReference` — GPS auto-plassering i mobilappen

## 6. Dokumentflyt

- **Dokumentflyt:** Rute mellom to faggrupper i et prosjekt med definerte trinn (bestiller → utfører → godkjenner). DB-modell: `Dokumentflyt`, tabellnavn `dokumentflyter`. Erstatter den slettede Workflow-modellen
- **Fagområde (domain):** `"bygg"` / `"hms"` / `"kvalitet"` (default `"bygg"`) — styrer dokumentsynlighet. Maler har `domain`, grupper har `domains` (JSON-array)
- **FaggruppeKobling:** M:n-modell mellom `ProjectMember` og `Faggruppe`. Tabellnavn: `dokumentflyt_koblinger`. Renamet fra `MemberEnterprise`/`DokumentflytKobling` 2026-04-16
- **GroupFaggruppe:** M:n-modell mellom `ProjectGroup` og `Faggruppe`. Tabellnavn: `group_faggrupper`. Begrenser gruppes tilgang til spesifikke faggruppers dokumenter. Renamet fra `GroupEnterprise`/`GroupDokumentflytPart` 2026-04-16
- **Snapshot-pattern:** Felter som fryser data ved en hendelse for å unngå at endringer i kilden påvirker historikk. Eksempler: `document_transfers.senderEnterpriseName` (bevisst ikke renamet — historisk snapshot), `attestertSnapshot.prisMotKunde` på timer-rader, `actorNavnSnapshot` på Activity. Brukt overalt der historisk integritet er kritisk. **Snapshot-felter beholder gamle navn (f.eks. `enterprise_*`) bevisst — de representerer historiske verdier og skal ikke renames selv ved senere terminologi-endringer**
- **Tillatelse (Permission):** Granulære nye: `checklist_edit/view`, `task_edit/view`, `template_manage`, `drawing_manage/view`, `folder_manage/view`, `faggruppe_manage`, `member_manage`. **Gamle aliaser fortsatt aktive** via lese-kompatibilitet i `utvidTillatelser()`: `manage_field`, `create_tasks`, `create_checklists`, `view_field` mappes til granulære i runtime — ikke død kode
- **Tverrgående tilgang:** Gruppe uten faggruppe-tilknytning ser alle dokumenter med matchende fagområde
- **Workflow (forlatt):** Tidligere arbeidsforløp-modell. Slettet april 2026, erstattet av Dokumentflyt. Historikk: [faggruppe-rename-plan.md](faggruppe-rename-plan.md)

## 7. Status og handlinger

- **Attestering:** Arbeider får lønn for registrert tid. Hører til **Timer-modulen** — mobil-UI, lønnseksport. Felter: `attestertAvUserId`, `attestertVed`, `attestertSnapshot`. **Aldri bland med Godkjenning.** (Fase 0 A.8 — ufravikelig terminologi)
- **Godkjenning:** Entreprenør får byggherre til å godta kostnad. Hører til **Dokumentflyt-modulen** — utvidet dokumenttype med `bestillerFaggruppeId`/`utforerFaggruppeId`/`status`/`dokumentflytId`. **Status: modell vedtatt, ikke bygget** (Fase 0 A.2 og A.8)
- **Statusovergang:** Validert via `isValidStatusTransition()` i `@sitedoc/shared`. Sekvens: `draft → sent → received → in_progress → responded → approved | rejected → closed`. `cancelled` er irreversibel terminal status

## 8. PSI og opplæring

- **Instruksjonsbilde (`info_image`):** Bilde med valgfri caption. Config: `imageUrl`, `caption`
- **Lesetekst (`info_text`):** Ikke-redigerbar tekst for instruksjoner. Config: `content`
- **PSI (Prosjektspesifikk Sikkerhetsinstruks):** Personlig sikkerhetsgjennomgang som alle arbeidere må fullføre. Bygges i malbygger, gjennomføres via QR. Inneholder lesetekst, bilder, video, quiz og signatur. Kategori `"psi"` (ikke `"sjekkliste"`). DB: `Psi` + `PsiSignatur`
- **Quiz (`quiz`):** Flervalg med riktig svar. Config: `question`, `options[]`, `correctIndex`
- **RUH (Rapport om Uønsket Hendelse):** Avviksrapport for HMS-hendelser på byggeplass. Refereres i PSI-innhold som del av sikkerhetsopplæringen
- **Video (`video`):** Video-avspilling (WebView). Config: `url`

## 9. UI-mønstre

- **Adaptive nedtrekksmenyer:** Mobil-UI-mønster for fritekst-felt der brukeren registrerer fritt valgte verdier (material, kategori, etiketter, leverandør). Første gang: tekstinput. Etter 3+ bruk: foreslås som dropdown. Etter 7+ elementer: søkefelt øverst. Bruker kan skjule forslag. Lærer naturlig — krever ingen forhåndskonfigurering. Regel i [CLAUDE.md § UI-designprinsipper](../../CLAUDE.md#ui-designprinsipper)

## 10. Oversettelse

- **forbedreOversettelse:** Admin kan manuelt redigere eller re-oversette med bedre motor (DeepL)
- **Kildespråk (`sourceLanguage`):** Prosjektets hovedspråk. Settes av firma i Prosjektoppsett
- **Lag 1 (UI-oversettelse):** i18next-basert, automatisk basert på `User.language`
- **Lag 2 (Mal→arbeider):** On-demand 🌐-knapp. Oversetter feltlabels/hjelpetekst til arbeiderens språk
- **Lag 3 (Arbeider→firma):** Auto-oversetter fritekst ved lagring. Original bevares i `.original`
- **Målspråk (`languages`):** Språk dokumenter oversettes til. Per mappe via arv (`languageMode`)
- **Språkarv (`languageMode`):** `"inherit"` arver fra forelder-mappe, `"custom"` har egne målspråk
- **Språkdeteksjon:** Auto-detektering av dokumentspråk via ordfrekvens (~60 ord/språk, 14 språk)
- **TranslationCache:** SHA-256 hash-basert cache for oversettelser. Unngår gjentatte API-kall

## 11. Geografi

- **Automatisk værhenting:** Open-Meteo basert på koordinater + dato
- **Georeferanse:** 2 referansepunkter (pixel ↔ GPS) for similaritetstransformasjon. Lagres som `Drawing.geoReference` JSON
- **Similaritetstransformasjon:** 2D-mapping mellom tegningskoordinater og GPS
- **WMO-værkode:** Standard for værforhold som tall → norsk tekst
