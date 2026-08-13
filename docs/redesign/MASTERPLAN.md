# REDESIGN-MASTERPLAN — SiteDoc (fabel, opprettet 2026-07-12)

> Styringsdokument for hele redesignet. Arbeidsmåte: helhetlig plan her → kodeverifisert nå-rapport per del → detaljert delplan → utførelse (DoD i FABEL-RAMMEVERK.md). Status per sak lever i verifiseringsloggene — denne filen peker, kopierer aldri.

## Målestokk
Alle deler måles mot de tre hensiktene (enkelhet / selvforklarende navigasjon / timeføring med få klikk) + pilotfrist ~sept 2026 (50 ansatte, mobil viktigst).

## Del-oversikt

| # | Del | Status | Kilde/logg |
|---|-----|--------|------------|
| 1 | Navigasjon + innstillinger-hub (steg ii–vii + restanse) | ✅ Lukket, i prod bak flagg | STATUS-AKTUELT (repo) |
| 2 | K13 søkedekning | ✅ Lukket | `verifisering/K13-verifiseringslogg.md` |
| 3 | Generalprøve-funn F1–F5 | ✅ LUKKET 2026-07-12 — allerede-landet på develop, designgodkjent; ingen merge (stale serie) | `verifisering/F1-F5-verifiseringslogg.md` |
| 4 | Kunderunde (steg viii) | ⏸ UTSATT (Kenneth 2026-07-12, moderert): gjennomføres senere; spørsmålene er gode men skal forbedres/tilpasses først. Gjentest steg 2–6 som gate utgår | `docs/redesign/steg-viii-kunderunde.md` (repo) |
| 5 | Runde 3: slank sidebar + kollapsbare soner + amber=FIRMA | ✅ D3–D2 LUKKET 2026-07-12 — live på test, fabel-designgodkjent. Gjenstår: D5 konto-lagring (cowork DDL-gate) | `verifisering/del5-sidebar-verifiseringslogg.md` |
| G | Geofence timer+PSI (ny sak 2026-07-15) | Vedtatt: (1) per-rad GPS-indikator på byggeplasser — **BYGGET + fabel-designgatet 2026-07-15** (redesign f1a5318d, 🔴 LIVE ikke bak flagg — Kenneth-vedtatt; venter cowork-gate → push → test → Kenneths visuelle sjekk); (2) ÉN geofence dekker timer OG PSI (aldri to koordinatfelt). **PARKERT til egen redesign-sesjon:** PSI-håndhevingsnivå (Av/C/B/A, firma-policy, server-autoritativ, fail-open offline/uten-geofence) — grunnlagsdok `docs/claude/psi-geofence-handhevning-utredning.md` (repo, 6af205a8). Sesjonens scope (Kenneth): prosjekt- vs firma-innstillinger helhetlig — research dagens funksjoner + forbedret UI-visning. Beslutningskart: `Geofence Beslutning.dc.html` | — |
| F | Finnbarhets-revisjon (Kenneth-funn 2026-07-14) | **LUKKET 2026-07-15** — søkemotor (skrivefeil-toleranse + synonymlag, 14/14 test), begreps-fikser (Firmaprofil/Dokumentsøk/Kontrollplan/PSI-label; «Dokumentsøk» LIVE flagg-av — Kenneth-vedtatt), NATIVE sidemeny på hub (OppsettSidemeny gjenbrukt, InnstillingerNav slettet — Kenneth-godkjent mot mockup `Innstillinger Mockup.dc.html`), georeferanse+Dokumentflyt-sokeord. Kenneths brukertest GRØNN («mange flere treff»). Sidebar falsk-aktiv-fiks (useAktivSeksjon, 7f75c654). Detaljstatus: STATUS-AKTUELT (repo) | STATUS-AKTUELT (repo) |
| 6 | Timeføring (web + mobil) | **DoD LUKKET 2026-07-13** (design-sign-off F-g/F-b mot skjermbilder; forseglet develop cd3efcb5). Egne saker etter DoD: F-e-interaktiv, P4a, prod-deploy spor b | `verifisering/del6-timeforing-verifiseringslogg.md` |
| 6b | Sjekklister/Oppgaver/HMS/Kontrollplan | **Fase 1 LUKKET 2026-07-16** (fabel-designgodkjent, merget, prod 27.07) · **M-3a del 1+2 LUKKET 2026-07-17** · **Fase 2 (mobil-løft, pilot-kritisk): ordre klar 2026-07-28** (`delplaner/del6b-fase2-ordre.md`, venter relay) · Fase 3 venter mini-nå-rapport MS Project · Kenneth-føring 17.07: bred gjennomgang før videre MalBygger-bygging (`delplaner/gjennomgangsplan-dokumenthandling-utfylling-malbygger.md`). Delplan vedtatt 2026-07-16 (`delplaner/del6b-delplan.md`; Kenneth-vedtak: mobil bygges her, kontrollplan-bro = ønsket funksjon, ambisjon a først). Bug-klasse rutet til develop: `delplaner/del6b-develop-bugordre.md`. Nå-rapport levert (repo-rot) | `verifisering/del6b-verifiseringslogg.md` (opprettes ved fase 1) |
| 7 | Seddel-statusfarger (avvist per rad, mobil↔web-konsistens, «Konflikt»-tilstand) | Fase C-funn mottatt fra cowork; designes ETTER F4-reconciliation | README § K12/K13-koordinering |
| 8 | Dokumentflyt-redesign (begreper, medlemsliste, per-person-rettigheter) | Eget tema — krever dyp nå-rapport først | README § To nøkkelkomponenter |
| 9 | Modul-oppsettswizard (generalisering av timer-onboarding) | Prinsipper vedtatt, fremtidig spor | README § Designprinsipp: wizard |
| 10 | K11 admin-redesign (abonnement/drill-down, Fakturering F20) | Egen fase ETTER kunderettet nav | K-BESLUTNINGER K11 |
| K14 | Søk-utvidelse: admin-flater i søkeregisteret (rolle-gated sitedoc_admin) + alias/synonymer per treff | KØ (Kenneth 2026-07-13: ingen hast) — tas sammen med del 10/K11 admin-fasen, ev. som liten sak etter del 6b | — |
| G2 | Georeferanse-panel v2 + tillegg A (Kartverket-treffliste begge flater) | ✅ **LUKKET 2026-07-15** — designgodkjent, e91f10c4 i prod, Kenneth-verifisert på test | `verifisering/georef-panel-verifiseringslogg.md` |
| N3 | Dokumentflyt-synlighet datamodell (funn fra A-3a-sløyfen) | ✅ **LUKKET 2026-07-19** — del 1+2 merget develop (68f3ddaf), verifisert test 8/8; **i prod 2026-07-27** (develop→main-deployen). Tre saker rutet ut til fabel: G1-mutere (inkl. meny-UX), opprett→usynlig, HMS-synlighet-regel | `verifisering/N3-verifiseringslogg.md` |
| P1 | Nivåsignal firma vs. prosjekt (prod-funn 2026-07-21: firma-/prosjekt-HMS forvekslbare) | **A–C ✅ på develop+prod** (bygget i K3-runden 22.–23.07, commits 6b5fd5a7…51e8cc8f; git-bekreftet 28.07 — ordren var utdatert, Opus B stoppet riktig). **§ 3b kp1 (byttTil-a11y-nøkler) levert 22b3781d, fabel-ordlyd bekreftet 28.07 — cowork merger.** Åpent: § 3b kp2 (⇄-plassering, venter mockup § 2a) · K1+K2 (liten sak, fabel-gatet) · P1d suffiks (repo-sak) · gjennomgående plan øvrige par = egen sak | git-verifisering 2026-07-28 + relay/inbox-fabel.md |
| P2 | Inndata-validering status-handlinger (prod-funn 2026-07-21: Send tilbake/Besvar uten innhold) | Kenneth-vedtatt 2026-07-21 (`delplaner/p2-inndata-validering-vedtak.md`); ordre skrives etter P1-beslutning-sekvensering (cowork) | — |
| K15 | Vedlegg på tillegg-registrering (foto/skann/opplasting, f.eks. kvittering på Overtidsmat) | Ny sak (Kenneth 2026-07-13); krever nå-sjekk: finnes gjenbrukbar opplastings-infra i dagsseddel-domenet? Prioritet ikke satt | — |
| 10a | Firmaorientert admin (1a firmaliste + 1b firmadetalj) | ✅ **Fase 1 LUKKET 2026-07-27** — fabel-designgodkjent, merget, i prod (develop→main 27.07). **Fase 2 (egen ordre, BACKLOG):** Ctrl+K tverrgående admin-prosjektsøk → deretter sletting av global prosjektliste; Activity-skriving fra kjerne-ruter (gjeninnfører «sist aktivitet»-badge). Bevisst utelatt fase 1: sekundær-org-tilknytning; gammel liste = fase 2 | Exit-dok + `docs/claude/historikk-2026-07.md` § Prod-deploy 2026-07-27 (repo) |
| KP | **Kontrollplan (HASTER, P0)** | 🟡 **L1 BYGGET + PUSHET 2026-08-13** (`69df0931`, branch `feat/kontrollplan-startbar`) — venter **fabel skjermbilde-gate + task-walkthrough** før merge. Klikk-budsjett oppfylt: 1 klikk ved én flyt. Cowork-gate godkjent med krav om eksplisitt prosjektsjekk (lagt inn). Avvik fra skisse: ingen egen `startPunkt` — Start går klient-orkestrert over `sjekkliste.opprett(kontrollplanPunktId)` med atomisk kobling i samme tx (unngår duplikat-sjekklister ved delvis feil + duplisering av opprett-veien). Helhetlig plan vedtatt 2026-08-13 ([`kontrollplan-helhetsplan.md`](kontrollplan-helhetsplan.md)). Avklart: «frittstående sjekkliste» forkastet — vanlig vei bærer (bestiller = oppretters faggruppe, utfører = punkt.faggruppeId, flyt via `opprettbareFlytIder`). L1: koblePunkt + startPunkt (null nye kolonner — `KontrollplanPunkt.sjekklisteId` finnes, aldri fylt; 13 sjekklister kobles). L2: drawingId per PUNKT (ulike tegninger: stål/utomhus), «Vis på tegning», skille plan- vs. frittstående sjekklister, passiv fristvarsling ved visning (planlagt/aktuell/forfalt; form=arbeid, farge=hast; én delt hjelper; årsskifte-test). L3 (egne saker): aktiv varsling m/scheduler, byggherre-overlevering. Egen branch fra develop | `verifisering/kontrollplan-verifiseringslogg.md` (opprettes v/L1-exit) |
| GR | Georef-speilfeil 2-punkts (felt-funn Lakselv 2026-08-13) | ✅ **LUKKET 2026-08-13** — fikset av Opus mobilverify (`7dd4df8d`), merget develop (`aa5e3d57`), **i prod `2a9aa182`**. `det = −(a²+b²) < 0` gir korrekt kiralitet; invers reutledet (`M⁻¹ = M/(a²+b²)`, `ie` skiftet fortegn). 461/461 shared-tester grønne. Regresjonstest med reelle Lakselv-koordinater verifiserer at pikselside er MOTSATT av GPS-side (orienterings-reversering), ikke bare avstandstoleranse. Ingen migrering — eksisterende 2-punkts-kalibreringer ble riktige automatisk. Åpen egen sak: UI-hint «2 punkter gir eksakt fit» | [`../claude/delplaner/georef-speilfeil-ordre-2026-08-13.md`](../claude/delplaner/georef-speilfeil-ordre-2026-08-13.md) |
| UT | **Utskriftsformer (prod-krav 2026-08-13)** | 🔴 **NY, samlet kravspec fra Kenneths prod-bruk.** (1) tomme/uutfylte objekter skrives ikke ut · (2) loggen skrives ikke ut og kan ikke velges — vedtaket «logg alltid på, velges ved utskrift» finnes, bryteren ikke · (3) **avsenderfirma mangler** (`header.ts:74-81` bygger `personnavn (faggruppe) → faggruppe`; ingen organisasjon — «Byggeledelse» er faggruppe, ikke rettssubjekt) · (4) flere former per dokumenttype · (5) samleutskrift i to former: kompakt (én linje/rapport) + utvidet (første bilde + emnefelt + status). **Plassutnyttelse:** prod-rapport ble 7 sider der 3–4 holdt — rader er ubrytbare uansett høyde. Rutes til arkivmal (dokgen), ikke flere runder på klient-lappen | BACKLOG § «Utskriftsformer — samlet kravspec» |
| PM | Produktmodell-rearkitektur: prosjekt- → firmaorientert | Utredning levert (`delplaner/firma-produktmodell-utredning-2026-07-26.md`) + 3 Kenneth-beslutninger: firma påkrevd v/onboarding (auto-enmannsfirma) · én «prosjekt»-slug (OrganizationModule, rent eierskapssignal) · 10-grense hengt på modul-eierskap + 30d trialExpiresAt. Byggeordre (§2+3+5) **parkert** til interim-guard + admin lander — **scope-tillegg (cowork-rutet 2026-07-28): funn A fra `dokumentflyt-medlem-analyse-2026-07-28.md`** (flyt-invitasjon lager firma-løse brukere uten gruppe-kobling; fiks = én delt invitasjonsmodal, firma-krevende `medlem.leggTil` + `groupId` i samme transaksjon). Interim: sjekklistegrense gates på firma-tilknytning (`feat/sjekklistegrense-firma`) — låser opp pilot-blokkeren | `delplaner/firma-produktmodell-utredning-2026-07-26.md` |

## Flate-inventar — alle websider, gruppert (fakta: anker-dok 2026-05-03 + K13-inventar 94 ruter)

> Nav-redesignet (del 1–2) ga alle sider ny **inngang** (hub/søk/sidebar). Selve **sidene** er i hovedsak uredesignet — dette inventaret styrer rekkefølgen på side-redesignet. Ingen detalj her; delplan per gruppe når den står for tur.

| Gruppe | Flater (fra ruteinventaret) | Side-status | Del |
|---|---|---|---|
| Timer arbeidsflater | registrering, dagsseddel, attestering, Mine timer, timer-rapport (web + mobil) | Urørt; Fase C-funn påpeker svakheter | **6+7** |
| Innstillinger/oppsett | hub + 14 oppsett- og 10 firma-sider bak hub-kortene | Inngang ny (hub); sidene selv urørte | etter 6 |
| Dokumentflyt-klyngen | dokumentflyt-konfig, faggrupper, kontakter, mapper/mappeoppsett | Kontakter ny (K6); resten urørt — «ulogisk sammensying» | **8** |
| Dokumenter/oversettelse | mapper-tabell, oversettelsespanel, dokumentleser (web + mobil) | Redesignet (2b/2c) ✅ | 1 |
| Sjekklister/Oppgaver/HMS | lister, utfylling, maler, kontrollplan | Urørt | **6b** (etter timer, Kenneth 2026-07-12) |
| Tegninger/3D | tegninger, 3d-visning, tegning-3d, punktskyer | Mobil-tab redesignet (2a); web-konsolidering venter K4 | K4 |
| Maskin/Varelager | register, vedlikehold, import | Urørt | wizard-sporet (9) |
| Firma-flater | oversikt, prosjekter, ansatte, kompetanse, HMS-dashbord, kalender | Urørt (kun ny sidebar-sone) | runde 3 (5) |
| PSI/Mannskap | psi, mannskap, psi-maler | Bygges av develop-sporet — redesignet eier kun nav-plassering | — |
| Admin (sitedoc_admin) | firmaer, prosjekter, tillatelser, testsider | Firmaliste + firmadetalj redesignet (10a, prod 27.07); global prosjektliste slettes i 10a fase 2; resten urørt | **10a** → **10** (K11) |

Restanser fra anker-dokumentet som IKKE er tatt (sjekkes mot kode før de køes): rename Firmainnstillinger→Prosjekteier · Box→Mapper-rename · HMS-avvik modul-avklaring · Maskin-plassering · testsider ut av prod. Tas som ryddepunkter i relevante delplaner, ikke som egen del.

## Rekkefølge (justert 2026-07-27 — del 5/6 lukket; firmaorientert spor lagt til)
1. **Del 6b fase 2 — mobil-løft** — ordre klar 2026-07-28 (`delplaner/del6b-fase2-ordre.md`), venter relay (fase 1 lukket 16.07, prod 27.07)
2. **PM interim-guard** — sjekklistegrense på firma-tilknytning (`feat/sjekklistegrense-firma`) — pilot-blokker; deretter PM-byggeordre §2+3+5
3. **10a fase 2** — Ctrl+K admin-prosjektsøk → slette global prosjektliste; Activity-skriving
4. **P2 inndata-validering** — ordre skrives nå (P1 A–C+§3b-kp1 landet; kun ⇄-plassering åpen, blokkerer ikke P2)
5. **Del 7 seddel-statusfarger** — etter F4-reconciliation (cowork gater timing)
6. **Del 8 dokumentflyt** — egen dyp sesjon
7. **Del 9, 10/K11 (+K14), K15** — deretter

## Prod-deploy 2026-07-27 (develop→main, 81 commits + 2 migreringer)
Mye «ikke prod» ble LIVE: statusmaskin-redesign F0–F6, flytrettigheter H3/H6 + flyt-posisjon-header + byggLedd + flytvisning-fane, e2e-røyksuite, Tooltip v2 + mikrotekst-wiring, tilgangslaget + N3, A-3a handlingsmeny, firmaorientert admin fase 1. Migreringer: F0 soft-delete (additiv) + F3 rejected→in_progress (data). Prod-verifisert innlogget (A.Markussen). Lærdom: migrate-steget først hoppet over → feilende deleted_at-spørringer; fikset med idempotent migrate deploy. Full arkiv m/commit-refs: `docs/claude/historikk-2026-07.md` § Prod-deploy 2026-07-27 (repo). Develop-only rader eldre enn 27.07 skal antas prod med mindre historikk-entryen sier annet.

## Nye backlog-saker (2026-08-13-runden — posisjonsmodell-restansen, kodeverifisert)
- **Steg-inngangen kollapser flyter (P1):** posisjonsmodellen er i prod (03.08, ruting teller ledd — flytFakta.ts:151-212/flytPosisjon.ts), men `steg` kan ikke settes fra noe UI: flytoppsett sender hardkodet `steg={1}` (dokumentflyt/page.tsx:869, 886), standardflyter seedes med steg 1 for begge roller (prosjekt.ts:515, 529) → alle nye flyter får én posisjon. Kun HMS-flyten setter steg eksplisitt. **MÅ fikses SAMMEN med `utledMinRolle`-klientporten** (avviser til «Lesevisning» når faggruppen verken er bestiller/utfører selv om serveren tillater via ballen) — ellers innfører steg-fiksen ny feil.
- **`ansvarsmerke` død kolonne:** vedtak 2026-07-31 (flytmodell-veileder § 2.6, frie boksnavn) er ikke bygget — kolonnen finnes i DokumentflytMedlem men leses aldri (api/web/mobil); visningsmerke avledes fortsatt av rollenavn.
- **Fire-boks-taket:** oppsett-UI lar hver rolle brukes én gang → maks fire flytbokser; strider mot vedtatt posisjons-/frinavnmodell.
- **Død kode-opprydding (ordre levert 2026-08-13,** [`../claude/delplaner/dodkode-opprydding-ordre-2026-08-13.md`](../claude/delplaner/dodkode-opprydding-ordre-2026-08-13.md)**):** `verifiserFlytRolle` + `byggFaggruppeFilter` (null kallsteder, feilinformerte to lesere s.d.), dokumentflyt.md:29 motsier vedtak; sweep i domenet + regel: erstattet funksjon slettes i samme fase.
- UI-hint GeoReferanseEditor: 2-punkts eksakt fit kan ikke avdekke speilfeil — «verifiser med Min posisjon eller legg til 3. punkt».
- **Lokasjon/tegningspunkt — fire funn (prod 2026-08-13):** (1) dokumentsiden viser ikke valgt lokasjon etter lagring, mens utskriften gjør det (manglende query-invalidering) · (2) detaljutsnitt mangler — `RapportObjektVisning.tsx:550-554` har 3 s fallback-timer som setter `klar=true` UTEN detalj; canvas rekker ikke for store flyfoto/PDF · (3) de to bildene skal stå side ved side, innzoomet til høyre · (4) **NYTT KRAV:** tegning skal åpne automatisk ved ny sjekkliste når malen har lokasjonsfelt — velg byggeplassens foretrukne tegning (`Drawing.byggeplassId` finnes; byggeplass kjent fra toppbar), fallback sist brukte.
- **Begrepsforvirring «lokasjon» i malbyggeren:** TRE ulike ting bærer navnet — `ReportTemplate.showLocation` (fast felt, auto fra bygning/tegning, øye-toggle) · `location`-rapportobjekt (ren tekst, prosjektadresse som fallback, `RapportObjektVisning.tsx:384`) · `drawing_position`-rapportobjekt (`:393`, bærer `drawingId` + koordinater). Byggeplass ER lokasjonen: den eier tegningene (`Drawing.byggeplassId`) og har koordinater avledet fra georeferert tegning. Fabels domene — begrepsavklaring før flere felt bygges.
- **Værdata bør hentes fra byggeplassen:** `useAutoVaer.ts:58-64` bruker prosjektets koordinater. `Byggeplass.latitude/longitude` finnes (satt ved georeferering). Fallback-kjede byggeplass → prosjekt. Et prosjekt kan strekke seg over kilometer; for en befaringsrapport er været på byggeplassen dokumentasjon.
- **`persons` skriver ut rå bruker-UUID-er:** `packages/pdf/src/felt.ts:101`. Kenneths prod-rapport viser `74730685-c6dd-…` under «Deltakere» i et dokument som går til byggherre. Dokgen løser det i api-sammenstillingen for arkivmalen (Stage 4-akseptkriterium); `felt.ts` er frossen og trenger egen ordre for dagens utskrift.

## Nye backlog-saker (2026-07-27-runden)
- Legacy flyt-løse dokumenter viser handlinger uten flyt-posisjon (fabel-vurdering)
- «Venter på»-chip skal vises for faggruppe (fabel-avgjort)
- Flytvisning header-linjebrekk (kosmetisk)

## Neste konkrete steg (justert 2026-08-13)
0. ✅ **DELVIS LEVERT 2026-08-13.** GR **lukket og i prod**. KP L1 **bygget + pushet** (`69df0931`) — **blokkeres nå av fabels skjermbilde-gate + task-walkthrough**, ikke av kode. Død kode-ordren **ikke startet** (ingen agent tildelt; ren opprydding, kan gå parallelt). Steg-inngang+`utledMinRolle` fortsatt egen sak ETTER KP L1 — de to MÅ fikses sammen, ellers gir steg-fiksen feil «Lesevisning».

   **Prod-leveranse samme dag (`2a9aa182`):** klient-utskrift reparert (bilde-lastegate erstatter 500 ms flat frist · tegningsutsnitt via `data-utskrift-venter`-markør · `print-no-break` per repeater-rad · `noopener` mot frossen opphavsfane), georef-speilfeil, SD-prosjektnummer ut av brukerflater, kontrollplan-revisjon, endringslogg alltid på. **S1 Fase 1b prod-migrering kjørt:** 73 bilder bak signaturgaten, sonde verifisert (4 sti-former → 401), innlogget visning bekreftet. Originaler IKKE slettet — `--slett-gamle` krever at `sitedoc_test` migreres først (delt volum).

   **Neste fra dagens funn:** UT-raden (utskriftsformer) er fabels formvedtak; punkt 1–3 der er arkivmal-arbeid hos dokgen (gatet 2026-08-13: komprimér framfor signerte URL-er · flat tabell framfor matrise · GO på Stage 4).
1. Fabel: 10a exit-dokumentasjon ferdigstilles (denne oppdateringen er del av den)
2. Fabel/Kenneth: relay del 6b **fase 2**-ordre (`delplaner/del6b-fase2-ordre.md`) til redesign. Fase 1 + M-3a del 1+2 er lukket; M-videre bygging gates av gjennomgangsplanen (`delplaner/gjennomgangsplan-dokumenthandling-utfylling-malbygger.md`, Kenneth-føring 17.07)
3. Cowork: PM interim-guard (`feat/sjekklistegrense-firma`) → deretter PM-byggeordre §2+3+5
4. Cowork: gate geofence-indikator f1a5318d+6af205a8 → push → test → Kenneths visuelle sjekk (fortsatt åpen per 27.07)
5. Fabel: vurdere de tre nye backlog-sakene (legacy flyt-løse dokumenter · «Venter på»-chip faggruppe · header-linjebrekk) + N3-utrutede saker (G1-mutere, opprett→usynlig, HMS-synlighet)
6. Fabel/Kenneth: planlegge redesign-sesjon prosjekt- vs firma-innstillinger + API-nøkkel-/integrasjons-UI (Kenneth-vedtak 2026-07-15: Norkart+Google+Microsoft+Vegvesen; sikkerhet trumfer bekvemmelighet — env-nøkler vises kun som status; UI-redigering kun der DB-lagring er trygt, f.eks. tile-nøkler; eierskapsrisiko kun Norkart. Krever nå-rapport: hvilke nøkler finnes, hvor lever de, hva er trygt i DB)
7. Redesign BACKLOG: oppsett/layout.tsx delt DATAKILDE for native sidemeny · F-e-interaktiv (fabel-gate før koding) · del 5 D5 konto-lagring (cowork DDL-gate)

## Vedtak som binder designet
- Amber = FIRMA (inkl. Maskin, Kompetanse, Ansatte), blå = PROSJEKT — låst og kodet i del 5 (runde 3)
- Sidebar = arbeidsflater, konfig = hub-kort (K5)
- K-beslutninger: `design_handoff_navigasjon_redesign/K-BESLUTNINGER.md`
