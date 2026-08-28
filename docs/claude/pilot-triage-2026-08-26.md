---
tittel: Pilot-triage — hva blokkerer september 2026?
type: triage
status: 🟢 MÅLING KOMPLETT (ingen rekkefølge-anbefaling)
eier: dokgen
opprettet: 2026-08-26
sist_verifisert_mot_kode: 2026-08-26
verifisert_mot: origin/develop (worktree docs/pilot-triage)
---

# Pilot-triage — hva blokkerer september 2026?

## Målestokk

Fra `docs/redesign/REDESIGN-MASTERPLAN.md`: *«enkelhet / selvforklarende navigasjon / timeføring med få klikk + pilotfrist ~sept 2026 (50 ansatte, mobil viktigst).»* Funksjonalitet går foran alt annet.

Den avgjørende kolonnen er **pilot-impact**: *kan 50 ansatte, de fleste på telefon, ta SiteDoc i bruk i september uten at dette er løst?*
- **Blokkerer** — piloten feiler eller skader tillit uten den
- **Skjemmer** — piloten går, men brukeren møter noe pinlig/forvirrende
- **Kan vente** — reell mangel, men ingen merker den på seks uker

Alle 42 åpne 🔴 er verifisert **mot koden på `origin/develop`**, ikke mot postens egen beskrivelse (mye er skrevet før augustarbeidet). Pakke A (§0) er splittet i A1–A7. **Ingen kode er endret.** Ingen rekkefølge-anbefaling — cowork sekvenserer.

## Resultat i tall

| Kategori | Antall | Merknad |
|---|---:|---|
| **Blokkerer** piloten | **1** | Mobil-annotering PNG sprenger rapportstørrelse — én mobil-PR |
| **Skjemmer** | 10 | Mest mobil-nære opprett/oppgave-friksjoner + noen web |
| **Kan vente** | 20 | Reelle mangler, men ingen merker på 6 uker |
| **Løst** siden posten ble skrevet | 14 | Augustarbeidet lukket dem — merkes 🟢 i BACKLOG |
| **❓ ikke verifiserbar** | 3 | Server-env / device-repro / proxy utenfor repo |

Hovedbildet: **piloten er nesten ikke kodeblokkert.** Nesten en tredjedel av 🔴-listen er allerede løst, og den eneste harde blokkereren er en avgrenset mobil-PR. Det tunge arbeidet foran piloten ligger ikke i denne 🔴-listen — det ligger i MASTERPLAN-fasene (del 6b mobil-løft) og i «Skjemmer»-klyngen av mobil-opprettfriksjoner.

---

## 🔴 Blokkerer piloten (1)

| Post | BACKLOG | Fortsatt sann | Størrelse | Hvorfor |
|---|---|---|---|---|
| Mobil-annotering eksporterer 3,4 MB PNG | 772 | Ja | Én runde (mobil-PR) | `annoterings-html.ts:268` eksporterer `toDataURL(png, quality 1)` uten hvit bakgrunn/JPEG; rammer feltbilder fra mobilkamera direkte → rapport for stor for e-post. Nesten all bildeopplasting i prod er mobilkamera. |

## 🟠 Skjemmer piloten (10)

| Post | BACKLOG | Fortsatt sann | Størrelse | Hvorfor |
|---|---|---|---|---|
| Slett kommentar in-app (mobil) mangler | 821 | Ja | Noen runder | `Trash2` importeres uten bruk (`oppgave/[id].tsx:27`); ingen slett-kommentar-mutasjon → feilkommentarer kan ikke fjernes på mobil. |
| P4a+ mobil ekte ett-klikk uten modal | 817 | Ja | Egen fase | `oppgave/index.tsx:218` bruker fortsatt `OpprettDokumentModal`; «ett-klikk → detaljskjerm med chips» ikke bygget — treffer pilotens få-klikk-kjerne. |
| Dagsseddel-konflikt: melding uten handling | 1547 | Delvis | Én runde | Sammenslåing er nå automatisk (`forsonSedelIdentitet`, `timerSync.ts:242`), men API sender fortsatt framtidig «dine timer slås sammen» (`dagsseddel.ts:5139`) → mikrotekst feil, ~50 mobilbrukere treffer den. |
| Oppgave direkte `byggeplassId` | 833 | Ja | Egen fase | `Task` (`schema.prisma:1105`) mangler `byggeplassId`; `oppgave.opprett` setter kun `drawingId` → byggeplass-uten-tegning droppes stille. Krever migrering + design. |
| Lokasjon/tegningspunkt — 4 funn | 449 | Delvis | Noen runder | Funn 2/3 åpne (`RapportObjektVisning.tsx:550` 3s-fallback, høyre utsnitt), funn 4 (auto-åpne tegning) ikke bygget; funn 1 delvis. Befaring/print-nært, ikke timeføring. |
| Papirkurv mangler Tøm/masseslett | 1479 | Ja | Noen runder | `papirkurv.ts` har kun `slettEndelig({id})`; 0 checkbox/tøm i web; `mal.ts:387` ber «Tøm papirkurven først» uten at knappen finnes. |
| Byggeplass/tegning kan ikke redigeres/slettes fra UI | 1374 | Delvis | Én runde | Byggeplass-halvdelen løst før posten (`oppsett/byggeplasser/page.tsx` har endre/geofence/slett); rest = 2D-tegning rename/slett uwired (`tegning.oppdater:294`/`slett:570`). |
| Web-utskrift skjuler uutfylte felter | 719 | Ja | Egen fase | `RapportObjektVisning.tsx:42` har `if (tom) return null`; lukkes først når `skriv-ut` går til arkiv-PDF (fase 3b). Byggherre-dokument. |
| Lagre-knapp skjult under scrollkant | 738 | Delvis | Noen runder | `prosjektoppsett` fikk topp-knapp (`:261`) men ikke sticky; `beforeunload`-vakt = 0 filer; øvrige `oppsett/*`-flater ikke kartlagt. |
| Delt substrat visker ut type-skillet | 1083 | Ja | Noen runder | 6 `DISPLAY_TYPER`-def + 4 `REDIGERBARE_STATUSER`/`erSynlig`-kopier, 0 i `@sitedoc/shared`; `oppgave.oppdaterData` uten append-only-vakt = latent korrekthetsrisiko (sjekkliste/oppgave-nær, ikke timer). |

## ⚪ Kan vente (20)

| Post | BACKLOG | Fortsatt sann | Størrelse | Hvorfor |
|---|---|---|---|---|
| P1 — Posisjonsmodell-restansen (steg + `utledMinRolle`) | 214 | Ja (helt) | Egen fase | `steg={1}` hardkodet (`dokumentflyt/page.tsx:930,949`), seed `steg:1` begge roller; alle nye flyter kollapser til ett ledd. Bites ikke i timeføring-pilot med 2-ledds flyter; steg + `utledMinRolle` MÅ fikses sammen. |
| Standard-lønnsart plasseres deterministisk feil | 2284 | Ja (design) | Noen runder | Semantisk felt mangler (grep=0), migrering velger laveste-`rekkefolge`; A.Markussens stjerne alt korrigert via import → latent for nye orgs, ikke utløst. |
| Ingen kode-validering før attestering/eksport | 2278 | Ja | Egen fase | Ingen prosedyre sjekker `Lonnsart.kode` før attestering; eksport-modulen den skulle gate finnes ikke → ikke pilot-blokkerende (lønnseksport kjører ikke i sept). |
| Lønnsart-koder mangler i prod → PowerOffice umulig | 2270 | Delvis | Egen fase | Data festet på A.Markussen via import, men **ingen PowerOffice-/lønnseksport-adapter i repoet** (grep=0) → eksport kan uansett ikke kjøres i sept; piloten attesterer uten å eksportere. |
| Arkivmal mockup — 7 avvik | 297 | Delvis | Egen fase | Pkt 2/3/4/5/8 åpne (`Opprettet`-etikett, befaring-dokumenttype kaster, dokumentliste/tabellrapport mangler, værsnapshot live-only); pkt 6 tegningsutsnitt-markør nå bygd. Byggherre-web. |
| Arkiv-PDF seks-funn (BEF-001) | 336 | Delvis | Noen runder | Funn 1 implementert, funn 5 moot (endringslogg ikke i PDF); funn 6-rest (klokkeslett i statusblokk) sann — `formaterDatoKort` kun dato. |
| Repeater systematisk feilbehandlet | 375 | Delvis | Egen fase | Akutte funn fikset (`bilderIFelt` rekurserer dypt, byggherre-JSON-lekkasje moot); mønster-fiksen (modell-rens / delt traversering) består som latent risiko. |
| Utskriftsformer — samlet kravspec | 400 | Delvis | Egen fase | Pkt 2 avklart av D4-vedtak; pkt 4 (varianter per dokumenttype) + 5a/5b (samlerapport kompakt/utvidet) sanne — `byggArkivSamling` slår kun sammen fulle ark. |
| Kontrollplanen frakoblet — `sjekklisteId` + varsling | 510 | Delvis | Egen fase (rest) | Kobling nå bygget begge veier (`kontrollplanKobling.ts`, tiltak 1+2 m/ test); kun fristbasert varsling mangler (ingen scheduler i api). |
| Signerte vedlegg-URL-er i `Checklist.data` | 143 | Delvis | Én runde | Symptom (changelog-støy) fikset; lagringen skriver fortsatt rå `input.data` uten query-strip (`sjekkliste.ts:807`) → akkumulerer, men signering idempotent = usynlig. |
| Malbytte etter opprettelse + sist-brukt server-side | 813 | Ja | Egen fase | `useSistBrukteMal.ts:11` sier kilden er klient-localStorage (interim); `byttMal` finnes kun for psi/kontrollplan. Interim funker. |
| Statusmarkør feil datatype + ingen form | 981 | Delvis | Egen fase | Activity-raden forbedret; konvensjonen uendret (`:53/:73/:76` `(planlagt)`, seks former i én fil) — intern docs-hygiene uten pilot-berøring. |
| CLAUDE.md-runden — fem funn | 1178 | Delvis | Én runde | Funn 1 (størrelse) borte (39 625 B), men uten gate; funn 5 står (`:111` «14 språk ~2500 nøkler», reelt 15/2909). |
| Én mal gir fire representasjoner | 1337 | Ja (🔴❓) | Design + én runde | Åpent designspørsmål til fabel; konkret tilfelle har workaround («Kolonne N»-fallback + navngi felt). |
| Referanse-testprosjekt for agenter | 1404 | Ja | Egen fase | Prosess-/tooling-mangel, ikke kodefeil; `prosjektoppsett-veileder.md` = «Plan (ikke implementert)». Krever engangsoppsett + regel. |
| Ryddesjekk dokumentleser-side | 1623 | Ja | Én runde | `/dashbord/[prosjektId]/dokumentleser/page.tsx` har eneste inbound = unntaksrad i `sok-dekning.test.ts:74`; ellers ulenket → sletting-kandidat. |
| i18n fagterm-QA K13-nøkler | 1619 | Delvis | Én runde | Navngitt `innstillinger.lenke.timerOnboarding` finnes ikke (relikvi); nb/en korrekte, piloten er norsk → påvirker ikke A.Markussen. |
| Tidslinje: kollaps Sendt⇄Mottatt-spam | 825 | Ja | Noen runder | Ingen kollaps-logikk for konsekutive statuspar (web+mobil); rent kosmetisk, historiske loggrader fra alt-fikset bug. |
| A4 Hardkodet Norkart/Webatlas-nøkkel | 38 | Ja | Noen runder | Klartekst `GeoReferanseEditor.tsx:262`; maptile-nøkkel synlig i nettleser uansett, lav sev — bør env-flyttes + roteres (ligger i git-historikk). |
| `scripts/worktree-bootstrap.sh` env-hull | 837 | Ja | Én runde | Skriptet finnes ikke; env-hull for nye worktrees urørt. Ren dev-friksjon, ikke pilot. |

## 🟢 Løst siden posten ble skrevet (14) — merkes i BACKLOG

| Post | BACKLOG | Hva løste den |
|---|---|---|
| A1 DOMPurify på `dangerouslySetInnerHTML` | 32 | Ny `apps/web/src/lib/sanitize.ts` (`rensHtml`/`rensSvg`) wired i alle 4 filer |
| A2 `@fastify/static` path traversal | 34 | Lockfile `9.3.0` + root-lås `server.ts:129` + normaliseringsgate `vurderPrivatFilForesporsel` |
| A3 Next.js-bump | 36 | `next ^14.2.35` + `eslint-config-next ^14.2.35` (verifisert) |
| A5 `defusedxml` i ftd-worker | 40 | Worker ikke deployet (ingen Dockerfile/compose-ref) → ingen live-eksponering |
| A6 `fastapi`/`multipart`-pin i ftd-worker | 42 | Samme worker, ikke deployet |
| `drawing_position` placeholder-felle | 74 | Fullført (ikke fjernet) på web+mobil m/ tester — feltet fyller punkt-på-tegning |
| Utskrift mangler avsenderfirma | 423 | Arkivmalen rendrer `org.name` + org.nr alltid (`ramme.ts:41-49`); gammel `header.ts`-fra→til slettet |
| P0 GPS-prikk speilvendt (2-punkt) | 484 | `7dd4df8d fix(georef)` — `georeferanse.ts:265-282` involutiv invers, akkurat delplanens fiks |
| Dokumentflyt uten registrator | 678 | `validerRegistratorForst` (`dokumentflyt.ts:36`, `c2e236f8`) kaster ved kilde + presis mal-velger-melding |
| `dokument-handlingsmeny-kvittering.test.tsx` feiler | 805 | Grønn nå (3/3); fikset i statusmaskin-redesignet (`f48c8003`/`bdef517f`) |
| `in_progress→sent` recipient-løs no-op | 809 | `in_progress` kollapset helt (Runde-2, `statusHandlinger.ts:20-22`) — transisjonen finnes ikke lenger |
| Fjern suksess-Alert på oppgave-detalj | 829 | Erstattet av M2 autolagret-mikrotekst + `LagreIndikator` (`oppgave/[id].tsx:451-454/590`) |
| syncBatch nedgraderer attestert sedel | 1273 | To vakter: accepted-vakt `dagsseddel.ts:4510-4520` + TOCTOU-fiks `:4854-4878` (updateMany notIn accepted) |
| Prod mangler nivå-1 lønnsart-seed (A.Markussen) | 2254 | `importerTimerKatalog` kjørt mot prod 2026-07-10 (26 opprettet); mekanisme + logg bekrefter |

## ❓ Ikke verifiserbar fra repoet (3)

| Post | BACKLOG | Grunn |
|---|---|---|
| A7 Proxy-headers (HSTS/X-Frame) | 44 | Header-hardening hører trolig på Cloudflare/proxy utenfor repoet; `@fastify/cors` origin ER eksplisitt allowlist (`server.ts:92`). Kan vente. |
| Mobil hard-fryser uten `config.zone` | 1517 | Beskrevet mekanisme matcher ikke lenger koden (`grupperMedOverskrift` grupperer på `heading`, zone-sort har trygg `undefined`-fallback), men eksplisitt guard + e2e-fixture mangler → krever device-repro på Release-bygg for å friskmelde. |
| OAuth: redesign holder prods nøkler | 1673 | Server-env (`web.env` vs `web-redesign.env`) + Entra/Google app-registreringer; ikke i repo. Berører ikke mobil timeføring på `sitedoc.no`. Kan vente. |

---

## MASTERPLAN § Rekkefølge — status per punkt

Kodeverifisert av dokgen (fase-nivå; disse er redesign-faser, ikke enkeltbugs).

| Punkt | Fortsatt sann | Pilot | Størrelse | Hvorfor |
|---|---|---|---|---|
| 1. Del 6b fase 2 — mobil-løft | **Premiss utdatert** | (reskopering) | Egen fase | Ordren (28.07) forutsetter sjekkliste-/oppgavelister som FANER; mobil-fanene er hjem/boks/lokasjoner/tegninger/timer-oversikt/mer, og HMS-mobil ER bygget → fabel må reskopere før relay. |
| 2. PM interim-guard | **LØST (bygget)** | — | — | `prosjektGrense.ts` (grense 10, firma-prosjekter grenseløse, admin-bypass) håndhevet i `sjekkliste.ts` + `oppgave.ts`. PM-byggeordre §2+3+5 (fuller) = senere. |
| 3. 10a fase 2 — Ctrl+K admin-søk | Delvis (søk bygget) | Kan vente | Noen runder | Ctrl+K-søkemodal bygget (`sok-modal-kontekst.tsx:29`); «slette global prosjektliste» + Activity-skriving delvis. Admin-web, ikke mobil-pilot. |
| 4. P2 inndata-validering | Ikke kodeverifisert her (P1 A–C i prod) | Kan vente | Noen runder | P1-restansen (steg/`utledMinRolle`) er egen 🔴 (214); P2 er dokumentflyt-web, ikke timeføring. |
| 5. Del 7 — seddel-statusfarger | Ikke kodeverifisert her | — | Egen fase | Timer-nær (kan berøre pilotens timeflate) — trenger egen måling før sekvensering. |
| 6. Del 8 — dokumentflyt | Åpen (egen dyp sesjon) | Kan vente | Egen fase | Dokumentflyt er prosjektleder-web, ikke mobil timeføring. |
| 7. Del 9/10/K11/K15 | Åpne (senere faser) | Kan vente | Egen fase | Redesign-faser uten pilot-kritisk timeføringsberøring. |

## Forbehold

- Verifisert mot **kode på develop**, ikke mot faktiske prod-data. Poster merket «prod-data korrigert» (lønnsart-klyngen) hviler på BACKLOG/STATUS-logg + kodemekanisme, ikke DB-inspeksjon.
- To poster (`config.zone`-frys, OAuth) krever henholdsvis device-repro og server-env-innsyn — begge utenfor en statisk kodegjennomgang.
- MASTERPLAN-punkt 4–7 er fase-nivå og ikke enkeltvis kodeverifisert i denne runden; de er faser cowork sekvenserer, ikke enkeltbugs.
