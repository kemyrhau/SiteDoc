---
tittel: GDPR-kartlegging — hvor bor personopplysninger om en ansatt?
type: kartlegging
status: 🟢 MÅLING KOMPLETT (ingen løsning foreslått)
eier: dokgen
opprettet: 2026-08-26
sist_verifisert_mot_kode: 2026-08-26
verifisert_mot:
  - packages/db/prisma/schema.prisma
  - packages/db-timer/prisma/schema.prisma
  - packages/db-maskin/prisma/schema.prisma
  - packages/db-varelager/prisma/schema.prisma
  - apps/api/src/routes/upload.ts
  - apps/api/src/utils/hmac.ts · vedleggSignering.ts · server.ts
  - apps/api/src/routes/bilde.ts · papirkurv.ts · services/papirkurv-sweep.ts
  - apps/api/src/routes/timer/dagsseddel.ts
---

# GDPR-kartlegging — hvor bor personopplysninger om en ansatt?

## Hvorfor denne finnes

Kenneth spurte: *«en ansatt ber om å få slettet alle sine personopplysninger — har vi en løsning?»* Svaret var nei, og det hadde ligget der uten at noen hadde målt hvor ille det er.

Dette dokumentet er **måling, ikke bygging**. Det kartlegger hvor personopplysninger om en ansatt bor, og — for hver forekomst — om den teknisk *kan* fjernes i dag, og hva som *bør* skje med den (slette / anonymisere / bevare). **Ingen løsning foreslås.** Den kommer når vi vet hva vi står overfor.

> 🔴 **Ingen jus er gjettet.** Der oppbevaringsplikt avgjør utfallet, men hjemmel eller periode ikke er kjent, står det **«uavklart — juridisk»**. En kartlegging med ærlige hull er brukbar; en med gjettede lovhenvisninger er farlig. Alle «Bevar»-rader er markert på **kategori-nivå** (timeregistrering, bokføring, HMS/internkontroll har oppbevaringsplikt) — men **eksakt hjemmel + periode er gjennomgående uavklart — juridisk** og må avklares før noen sletteløsning bygges.

## Det viktigste funnet, først

Hele poenget er skillet mellom **«vi har ikke bygget sletting»** og **«vi skal ikke slette dette»**. Målingen viser at det første dominerer totalt:

1. **Det finnes ingen sletteløsning i det hele tatt.** Ingen tRPC-rute, ingen jobb, ingen kodevei tar en `userId` og fjerner/anonymiserer personens data. En sletteforespørsel kan i dag bare oppfylles med manuelle SQL-inngrep på tvers av fire separate database-schemaer + disk.
2. **Fire adskilte databaser.** Persondata er spredt over `packages/db` (kjerne) + tre isolerte modul-schemaer (`db-timer`, `db-maskin`, `db-varelager`) med **egne Prisma-klienter og ingen kryss-FK**. En sletteoperasjon må treffe alle fire — det finnes ingen enkelt `User`-cascade som når modulene (de bruker svake String-FK-er uten `@relation`, som *bevisst overlever* User-sletting).
3. **Disk-filer forlates ved sletting.** Ingen kodevei sletter et bruker-opplastet vedlegg fra disk når DB-raden slettes (målt: `bilde.ts:235`, `papirkurv-sweep.ts:37/45`, `dagsseddel.ts:1655/1878` sletter kun DB-rader). Dette er mekanismen bak de tidligere målte ~560/650 foreldreløse filene.
4. **EXIF/GPS strippes aldri.** Bilder fra mobil lagres som rå bytes med EXIF/GPS intakt (`upload.ts:137`). Posisjon lagres i tillegg som egne DB-kolonner (`Image.gpsLat/gpsLng`, `SheetTilleggVedlegg`/`SheetUtleggVedlegg.gpsLat/gpsLng`).
5. **Én spire av GDPR-infrastruktur finnes — ubrukt.** `Activity`-tabellen har `retainedUntil`, `anonymizedAt` og `actorNavnSnapshot`. Feltene er der; **om en jobb faktisk anonymiserer er ikke verifisert i denne runden** (antatt nei — ingen kjørende jobb funnet).

## Slik leses tabellene

| Kolonne | Betydning |
|---|---|
| **Hvor** | `Modell.felt` eller filsti. |
| **Persondata** | Hva slags opplysning. |
| **Kobling** | `direkte` (FK til `users`) · `svak FK` (String mot `users` uten `@relation` — overlever User-sletting) · `indirekte` (via annen tabell) · `fritekst` (navn kan stå uten FK). |
| **Teknisk i dag** | Måling: finnes en kodevei som fjerner/anonymiserer? Nesten overalt: **ingen**. |
| **Disposisjon** | Foreløpig GDPR-utfall: **Slett** · **Anonymiser** (behold hendelse/aggregat, kutt person-lenke) · **Bevar** (oppbevaringsplikt — hjemmel/periode **uavklart — juridisk**) · **Uavklart — juridisk**. |

Disposisjonen er en **foreløpig innstilling for juridisk gjennomgang**, ikke en beslutning.

---

## 1. Kjerne (`packages/db`) — identitet og konto

| Hvor | Persondata | Kobling | Teknisk i dag | Disposisjon |
|---|---|---|---|---|
| `User.name`, `.email`, `.phone`, `.image` | Navn, e-post, telefon, profil-/portrettbilde | direkte (PK/unique) | Ingen slettevei | **Uavklart — juridisk.** Kan ikke slettes fritt så lenge bevaringspliktige poster (timer/økonomi/HMS) refererer personen → sannsynlig **anonymiser** (behold identifikator for bevart, fjern kontaktdata), men avhenger av oppbevaringsplikt |
| `User.language`, `.tabelloppsett`, `.nyNavigasjon`, `.canLogin`, `.role` | UI-preferanser, rolle, kontostatus | direkte | Ingen slettevei | **Slett** — konto-/preferansedata uten oppbevaringsverdi |
| `User.fodselsdato`, `.nasjonalitet`, `.arbeidstillatelse(+Utloper)` | Fødselsdato, nasjonalitet, arbeidstillatelse | direkte | Ingen slettevei | **Bevar?** — HMS/§15-relatert; nær særlig kategori. **Uavklart — juridisk** |
| `User.hmsKortNr`, `.hmsKortUtloper` | HMS-kortnummer | direkte | Ingen slettevei | **Bevar** — HMS-dokumentasjon. Hjemmel/periode **uavklart — juridisk** |
| `Account.*` (`userId`, `refresh_token`, `access_token`, `id_token`, `providerAccountId`, `scope`, `session_state`) | OAuth-kobling + autentiseringstokens + ekstern person-ID | direkte | `onDelete: Cascade` fra User finnes i schema, men ingen User-slett-rute kaller det | **Slett** — ren autentisering, ingen oppbevaringsverdi |
| `Session.*` (`sessionToken`, `userId`, `impersonatedUserId`, `originalUserId`, tidsstempler) | Sesjons-legitimasjon + innloggingsspor + impersonering | direkte / svak FK | Ingen slettevei (utover utløp) | **Slett** — sesjonsdata |
| `VerificationToken.identifier`, `.token` | E-post + verifiseringstoken | fritekst/e-post | Ingen slettevei (utover utløp) | **Slett** |
| `ImpersonationAudit.adminUserId`, `.targetUserId`, tidsspor | Hvem impersonerte hvem | direkte (@relation) | Ingen slettevei | **Anonymiser** — sikkerhets-audit; behold hendelse, vurder person-lenke. **Uavklart — juridisk** |
| `OrganizationMember.userId`, `.ansattRolle`, `.firmaRoller`, `.ansattnummer`, `.avdelingId` | Ansettelsesforhold (HR): hvem jobber hvor, stilling, ansattnr | direkte | Ingen slettevei | **Bevar?** — ansettelsesforhold + kobling til bevart lønn/timer. **Uavklart — juridisk** |
| `ProjectMember.userId`, `.role`, `.erFirmaansvarlig`, `.kanAttestere`, `.periodeSlutt` | Prosjektdeltakelse + rettigheter | direkte (`SetNull`) | `SetNull` ved User-slett finnes i schema; ingen rute kaller | **Anonymiser** — prosjekthistorikk; **Uavklart — juridisk** om deltakelse må bevares |
| `ProjectInvitation.email`, `.invitedByUserId`, `.token` | Invitert persons e-post (evt. før konto finnes) | fritekst/e-post + direkte | Ingen slettevei | **Slett** — utløpt invitasjon uten oppbevaringsverdi |
| `FolderAccess.userId` | Persons mappe-tilgang | direkte (@relation) | Ingen slettevei | **Slett** — tilgangskonfig |

> Konsolidert: **audit-aktør-FK-er** — `Activity.actorUserId`, og et gjennomgående mønster av `*AvUserId`/`opprettetAvUserId`/`endretAvUserId`/`deletedById`/`settAvUserId`/`bestiltAvUserId` som **svake FK** (String uten `@relation`) på tvers av kjernen (`OrganizationModule`, `EksportJobb`, `OrganizationSeedPolicy`, `ExternalCostObject`, `Checklist`, `Task`, `Kontrollplan`, m.fl.). Disse er **audit-spor** som *bevisst overlever* User-sletting. Disposisjon som gruppe: **Anonymiser** (behold at *en* handling skjedde, kutt person-lenken), med mindre en spesifikk logg er oppbevaringspliktig → **uavklart — juridisk**.

## 2. Kjerne — HMS, tilstedeværelse og kompetanse (høyrisiko)

| Hvor | Persondata | Kobling | Teknisk i dag | Disposisjon |
|---|---|---|---|---|
| `PsiSignatur.signatureData` | **Håndskrevet signatur** (base64/dataURL) | direkte/gjest | Ingen slettevei | **Bevar** — HMS-sikkerhetsinstruks-signering (§15/internkontroll). **Uavklart — juridisk** (periode) |
| `PsiSignatur.userId`, `.guestName`, `.guestCompany`, `.guestPhone`, `.hmsKortNr`, `.data (Json)`, tidsspor | Signatar (ansatt/gjest) + kontakt + HMS-kort | direkte / fritekst | Ingen slettevei | **Bevar** — HMS-dok. Hjemmel/periode **uavklart — juridisk** |
| `PsiTilstedevarelse.userId`, `.guest*`, `.hmsKortNr`, `.innsjekkTid`, `.utsjekkTid`, `.kilde`, `.registrertAvUserId` | **§15 innsjekk/utsjekk-klokkeslett** (sensitivt bevegelses-/arbeidstidsspor), HMS-kort | direkte / svak FK | Ingen slettevei | **Bevar** — mannskapsliste/§15. Hjemmel/periode **uavklart — juridisk** |
| `AnsattKompetanse.userId`, `.sertifikatNr`, `.utstederOrgan`, `.utstedtDato`, `.utloper`, `.importertVia` | **Kompetansematrise** — sertifikat-ID-er (her bor «maskinførerbevis», ikke i db-maskin) | direkte (Cascade) | `onDelete: Cascade` fra kompetansetype; ingen User-slettevei | **Bevar** — kompetansedokumentasjon. **Uavklart — juridisk** |
| `AnsattKompetanse.vedlegg (Json)` | **Sertifikat-/bevis-filer** `[{url, filename, …}]` — kan være scan av bevis/ID | direkte | Ingen slettevei (disk); Json-referanse | **Bevar** — se kompetanse over + Filer på disk (§6) |
| `AnsattKompetanse.notat` | Fritekst | fritekst | Ingen slettevei | **Uavklart — juridisk** (kan bære navn) |

## 3. Kjerne — dokumentflyt, sjekklister, oppgaver, godkjenning

| Hvor | Persondata | Kobling | Teknisk i dag | Disposisjon |
|---|---|---|---|---|
| `Checklist.bestillerUserId`, `.eierUserId`, `.recipientUserId`, `.deletedById`, `.lestAvMottakerVed` | Personer i sjekkliste-flyt + lest-spor | direkte / svak FK | `SetNull` finnes; papirkurv-sweep hard-sletter etter 90 d (kun DB) | **Bevar?** — byggkvalitets-dokumentasjon. **Uavklart — juridisk** |
| `Task.bestillerUserId`, `.eierUserId`, `.recipientUserId`, `.deletedById`, `.lestAvMottakerVed` | Personer i oppgave-flyt | direkte / svak FK | Samme som Checklist | **Bevar?** — **Uavklart — juridisk** |
| `Godkjenning.bestillerUserId`, `.eierUserId`, `.godkjentAvUserId` | Personer i godkjenningsflyt | direkte (@relation) | Ingen slettevei | **Bevar?** — kontraktuell godkjenning. **Uavklart — juridisk** |
| `DocumentTransfer.senderId`, `.recipientUserId`, `.senderRolle` | Avsender/mottaker i dokumentoverføring | direkte (`SetNull`) | Ingen slettevei | **Anonymiser / Bevar?** — **Uavklart — juridisk** |
| `TaskComment.userId`, `PsiSignatur/…` m.fl. | Kommentarforfatter | direkte (@relation) | Ingen slettevei | **Anonymiser** (behold kommentar, kutt forfatter) — **Uavklart — juridisk** hvis fritekst nevner andre |
| `Kontrollplan.godkjentAvId`, `KontrollplanHistorikk.brukerId`, `KontrollplanImport.importertAvId` | Godkjenner + endringshistorikk | direkte (@relation) | Ingen slettevei | **Bevar** — kontrollplan-revisjon. **Uavklart — juridisk** |
| `ChecklistChangeLog.userId`, `TaskChangeLog.userId` (+ `oldValue`/`newValue`) | Hvem endret hvilket felt + gamle/nye verdier | direkte (@relation) | Ingen slettevei | **Anonymiser** — endringslogg; `oldValue`/`newValue` kan bære navn → **uavklart — juridisk** |

## 4. Kjerne — fritekst- og Json-brønner (navn uten navnefelt)

Navn kan skjule seg i fritekst der det ikke finnes noe navnefelt. **Ingen av disse har en slettevei, og innhold kan bare bekreftes ved å inspisere faktiske data — schemaet garanterer ikke fravær av navn.** Disposisjon for hele klassen: **Uavklart — juridisk** (krever innholdssøk før sletting/anonymisering kan avgjøres).

| Hvor | Merknad |
|---|---|
| **`Checklist.data (Json)`** (`schema.prisma:1055`) | **Den store brønnen.** Alle sjekklistesvar, feltverdier, per-felt-kommentarer + vedlegg-metadata. Dekker også **avvik / SJA / RUH** — ingen egen tabell; skilt via `ReportTemplate.subdomain` (`:928`), teksten havner her |
| `Checklist.subject`, `.title` | Emne/tittel |
| `Task.description`, `.data (Json)`, `.subject` | Oppgavetekst |
| `TaskComment.content` (`:1469`) | Fri kommentartekst |
| `ReportField.subjects (Json)` (`:930`) | Emnetekster (forhåndsdefinert + skrevet) |
| `Activity.payload (Json)` | Hendelsesdata — kan bære navn/verdier |
| `DocumentTransfer.comment`, `.kostnadSnapshot (Json)`, `.*EnterpriseName` | Forhandlings-/overføringstekst + firmanavn-snapshot |
| `Dokumentflyt.roller (Json)`, `DokumentflytMedlem.ansvarsmerke` | Rollekonfig/merke-etiketter |
| FTD/nota: `FtdNota.beskrivelse`/`eksternNotat`/`importNotat`, `FtdNotaComment.commentText`, `FtdDocumentChunk.chunkText`, `FtdDocumentBlock.content`, `FtdKontrakt.byggherre`/`entreprenor`, `FtdDocument.filename`/`entreprenor` | Kontrakts-/dokumenttekst — full dokumenttekst kan inneholde navn/signaturer |
| `TranslationCache.sourceText`, `.targetText` | Cache av oversatt dokumenttekst |
| `Drawing.originator`, `.description`, `.ifcMetadata (Json)` | Opphav + CAD-metadata (kan bære person-/org-navn) |
| `OrganizationPartner.contactName`/`contactEmail`/`contactPhone`/`notes`, `Faggruppe.companyName`, `Psi.guestMessage`, `ExternalCostObject.kortNavn`/`lukketGrunn` | Eksterne kontaktpersoner + fritekst |

## 5. Moduler — timer, maskin, varelager

> Persondata-tunge og **fysisk atskilt** fra kjernen (egne schema-filer, egne Prisma-klienter, ingen kryss-FK). En sletteoperasjon når **ikke** hit via noen User-cascade.

### 5a. Timer (`db-timer`)

| Hvor | Persondata | Kobling | Teknisk i dag | Disposisjon |
|---|---|---|---|---|
| `DailySheet.userId`, `.registrertAvUserId`, `.attestertAvUserId`, `.dato`, `.startAt`, `.endAt`, `.beskrivelse`, `.lederKommentar` | **Arbeidstid per person** + fritekst-beskrivelse + lederkommentar | svak FK (userId) | `SheetTimer/Tillegg/Machine/Utlegg` cascader fra sedel; men **ingen User-slettevei** når sedelen | **Bevar** — timeregistrering. Oppbevaringsplikt sannsynlig; hjemmel/periode **uavklart — juridisk** |
| `SheetTimer.beskrivelse`, `.attestertAvUserId`, `.timer`, `.fraTid`/`.tilTid` | «Hva jeg gjorde» + attestør + timetall | svak FK | Cascade fra sedel | **Bevar** — se timeregistrering |
| `SheetTillegg.kommentar`, `.attestertAvUserId` | Tillegg-kommentar + attestør | svak FK | Cascade fra sedel | **Bevar** — **uavklart — juridisk** |
| `SheetUtlegg.belop`, `.kommentar`, `.mvaSats` | **Utlegg med beløp** (bokføringsnært) | via sedel | Cascade fra sedel | **Bevar** — bokføring. Hjemmel/periode **uavklart — juridisk** |
| `SheetTilleggVedlegg` / `SheetUtleggVedlegg` — `fileUrl`, `fileName`, **`gpsLat`/`gpsLng`** | **Kvittering-/bilde-vedlegg med GPS** | svak FK | `.delete` sletter kun DB-rad — **disk-fil forlates** (`dagsseddel.ts:1655/1878`) | **Bevar** (kvittering=bokføring). Fil-sletting mangler → se §6. **Uavklart — juridisk** |
| `SheetMachine.attestertAvUserId`, `.timer` | Maskinbruk-attestør | svak FK | Cascade fra sedel | **Anonymiser / Bevar?** — **uavklart — juridisk** |
| `SheetRadHistorikk.snapshot (Json)`, `.erstattetAvUserId` | **Write-only audit** — fryser full rad (inkl. fritekst + attestør) ved rediger | svak FK | Ingen slettevei; write-only | **Bevar** (revisjonsspor) — men fryser persondata permanent. **Uavklart — juridisk** |

### 5b. Maskin (`db-maskin`)

| Hvor | Persondata | Kobling | Teknisk i dag | Disposisjon |
|---|---|---|---|---|
| `Equipment.ansvarligUserId`, `.notater (Text)`, `.bilder (Json)` | Ansvarlig person + fritekst | svak FK | Ingen slettevei | **Anonymiser** (ansvarlig-lenke) — **uavklart — juridisk** |
| `EquipmentAnsvarlig.userId`, `.opprettetAvUserId`, periode | Tilleggsansvarlige + periode | svak FK | Ingen slettevei | **Anonymiser** — driftshistorikk |
| `EquipmentAssignment.userId`, `.utlevertAvUserId`, `.kommentar (Text)` | **Hvem hadde maskinen når** + kommentar | svak FK | Ingen slettevei | **Anonymiser** — operativt; **uavklart — juridisk** |
| `ServiceRecord.utfortAv (Text)`, `.beskrivelse (Text)`, `.registrertAvUserId`, `.vedlegg (Json)` | «Utført av» (**fritekst-navn**) + beskrivelse + registrator + vedlegg | fritekst / svak FK | Ingen slettevei | **Bevar?** — sikkerhets-/servicehistorikk. `utfortAv` er fritekst-navn → **uavklart — juridisk** |
| `Feilmelding.meldtAvUserId`, `.lukketAvUserId`, `.kommentar (Text)`, `.bilder (Json)` | Melder/lukker + fritekst | svak FK | Ingen slettevei | **Anonymiser** — **uavklart — juridisk** |

### 5c. Varelager (`db-varelager`)

| Hvor | Persondata | Kobling | Teknisk i dag | Disposisjon |
|---|---|---|---|---|
| `Vareforbruk.registrertAvUserId`, `.dato`, `.kommentar` | Hvem registrerte forbruk + fritekst | svak FK | Ingen slettevei | **Anonymiser** — prosjekt-kostnadspost; person-lenke lav verdi. **Uavklart — juridisk** hvis økonomibundet |

## 6. Filer på disk

**Én opplastingsrute for alt:** `apps/api/src/routes/upload.ts` (`POST /upload`) — kjerne-bilder, timer-kvitteringer, maskin-service, kompetanse-sertifikater går alle hit.

| Forhold | Måling | Konsekvens for sletting |
|---|---|---|
| **Skriving** | `createWriteStream` + `pipeline` (`upload.ts:137`); filnavn = `randomUUID()` + endelse; rot `uploads/`, privat `uploads/privat/` | Fil-innhold er ikke bundet til `userId` — kobling går kun via DB-radens `fileUrl` |
| **Offentlig vs privat** | Styres av klientens `?privat=1` (`:131`, `:135`) — **serveren avgjør ikke sensitivitet selv** | Feilflagget bilde havner i offentlig, ugated katalog. Privat serveres HMAC-signert (`hmac.ts:56`, `vedleggSignering.ts`); offentlig serveres ugated i Fase 1 |
| **EXIF / GPS** | **Fjernes ALDRI.** Rå bytes lagres uendret; `sharp` brukes kun på tegninger (`tegning.ts`) + PDF-import — ikke på foto-stien | Mobilbilder bærer EXIF/GPS på disk *i tillegg til* egne `gpsLat/gpsLng`-kolonner (`bilde.ts:141-162`) |
| **Sletting fra disk** | **Ingen kodevei sletter et bruker-vedlegg fra disk.** Alle slettestier er kun DB: `bilde.ts:235`, `papirkurv.ts:176/180`, `papirkurv-sweep.ts:37/45` (90-dagers hard-slett), `dagsseddel.ts:1655/1878`. `unlink`/`rm` finnes kun for temp/avviste filer (`upload.ts:141/147`, konverterings-temp) | **Hver sletting av en fil-bærende rad forlater filen på disk.** Mekanismen bak ~560/650 foreldreløse filer. En sletteforespørsel kan ikke oppfylles uten en egen disk-oppryddingsvei |

Disposisjon filer: **Følger den refererende raden** (kvittering/sertifikat → Bevar; foto i sjekkliste → som Checklist). **Foreldreløse filer** (uten DB-referanse) har ingen oppbevaringsgrunn, men er samtidig ikke koblet til noen person via kode — de må ryddes ved fil-scan, ikke ved sletteforespørsel. **Uavklart — juridisk** for kvittering/sertifikat-scans (bokføring/HMS).

---

## Åpne juridiske spørsmål (må avklares før løsning bygges)

Ingen av disse er besvart her — de er **uavklart — juridisk** og listet så en jurist kan ta dem samlet:

1. **Timeregistrering** — oppbevaringsplikt (hjemmel + periode)? Antatt bokføring/arbeidsmiljø, ikke bekreftet.
2. **Utlegg/beløp/kvitteringer** — bokføringslovens oppbevaringstid gjelder antatt, men periode + hva som kan anonymiseres kontra bevares er ikke fastslått.
3. **HMS-dokumentasjon** — §15 tilstedeværelse, PSI-signaturer, HMS-kort, kompetansebevis: oppbevaringsplikt (hjemmel + periode)?
4. **Kjerneidentitet ved bevart data** — kan `User.name`/`.email` slettes/anonymiseres når bevaringspliktige timer/økonomi-poster fortsatt må attribueres til personen? (Dette er kjernedilemmaet i «slett alt om meg».)
5. **Audit-spor** — kan `Activity`/endringslogger/impersonering anonymiseres fritt, eller er noen av dem selv oppbevaringspliktige?
6. **Fritekst-innhold** — der navn kan stå i `Checklist.data`/kommentarer/dokumenttekst uten FK: krever sletting/anonymisering innholdssøk, og hvem bærer ansvaret for at det er fullstendig?
7. **Særlige kategorier** — `User.nasjonalitet`/`.arbeidstillatelse`/`.fodselsdato`: behandlingsgrunnlag + oppbevaring?

## Dekningsforbehold

- Kartlagt mot **schema + kodeveier**, ikke mot faktiske data. For hvert fritekst-/Json-felt merket som mulig navn-bærer kan reelt innhold kun bekreftes ved å inspisere produksjonsdata.
- **Fødselsnummer/personnummer finnes ikke** i noe schema (ingen `fnr`/`personnr`/`ssn`/`nationalId`-felt). `User.fodselsdato` er det nærmeste.
- Målingen dekker de fire database-schemaene + fillagringen. Eksterne integrasjoner (`OrganizationIntegration.config` — HR/GPS-mapping) og evt. tredjeparts-lagring (Resend e-post, OAuth-leverandører) er **ikke** kartlagt her.
