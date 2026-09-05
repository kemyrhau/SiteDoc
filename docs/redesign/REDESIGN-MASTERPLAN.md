# REDESIGN-MASTERPLAN — SiteDoc (fabel, opprettet 2026-07-12)

> Styringsdokument for hele redesignet. Arbeidsmåte: helhetlig plan her → kodeverifisert nå-rapport per del → detaljert delplan → utførelse (DoD i FABEL-RAMMEVERK.md). Status per sak lever i verifiseringsloggene — denne filen peker, kopierer aldri.

> 🔴 **DENNE FILA ER DEN ENESTE. Cowork vedlikeholder den.**
> **Kenneth-vedtak 2026-08-28:** fabel kan ikke oppdatere denne fila — han leverer
> designnotater, cowork fører dem inn her. **Ikke ta siste versjon og lag en ny fil.**
>
> **Ryddet 2026-08-28:** det fantes **atten** kopier — to i repoet (`MASTERPLAN.md` fra
> 14.08 og denne fra 21.08, som hadde **forgrenet seg**: den gamle bar GR-lukking,
> KP L1-godkjenning, UT-raden og fire backlog-punkter som manglet her) og seksten i
> `Fra fabel/til-repo-*`-mapper. `MASTERPLAN.md` er slettet etter at det unike ble båret
> over. `Fra fabel/` er gitignorert — de kopiene er innboks, ikke versjoner, og skal
> ikke vedlikeholdes.

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
| 6b-x | **Listeflatene: kolonner males oppå hverandre (målt 2026-08-28)** | `packages/ui/src/table.tsx:319` har `tableLayout:"fixed"` + `w-full` **uten `min-width`**, og hverken `<th>` (`:338`) eller `<td>` (`:405`) klipper innhold. 11 av ~18 kolonner har ingen `bredde` → de krymper mot null når flere slås på, og teksten renner ut av cella og males oppå naboen. Horisontal scroll slår aldri inn før brukeren manuelt drar en kolonne. **Kenneth-vedtak 28.08: alternativ A** (default-bredde + `min-width` på tabellen + `truncate`), og *«vi tar det i en større sammenheng»* — **kjøres sammen med kolonnevelgeren** (PR-raden), ikke som egen runde. Ordre: `relay/inbox-tabellbredder.md`. Treffer alle brukere av delt `Table`; mobil-bruk må måles før endring | målt i kode 2026-08-28 |
| 6b | Sjekklister/Oppgaver/HMS/Kontrollplan | **Fase 1 LUKKET 2026-07-16** (fabel-designgodkjent, merget, prod 27.07) · **M-3a del 1+2 LUKKET 2026-07-17** · **Fase 2 (mobil-løft, pilot-kritisk): ordre klar 2026-07-28** (`delplaner/del6b-fase2-ordre.md`, venter relay) · Fase 3 venter mini-nå-rapport MS Project · Kenneth-føring 17.07: bred gjennomgang før videre MalBygger-bygging (`delplaner/gjennomgangsplan-dokumenthandling-utfylling-malbygger.md`). Delplan vedtatt 2026-07-16 (`delplaner/del6b-delplan.md`; Kenneth-vedtak: mobil bygges her, kontrollplan-bro = ønsket funksjon, ambisjon a først). Bug-klasse rutet til develop: `delplaner/del6b-develop-bugordre.md`. Nå-rapport levert (repo-rot) | `verifisering/del6b-verifiseringslogg.md` (opprettes ved fase 1) |
| 7 | Seddel-statusfarger (avvist per rad, mobil↔web-konsistens, «Konflikt»-tilstand) | Fase C-funn mottatt fra cowork; designes ETTER F4-reconciliation | README § K12/K13-koordinering |
| 8 | Dokumentflyt-redesign (begreper, medlemsliste, per-person-rettigheter) | Eget tema — krever dyp nå-rapport først. **To målte funn 2026-08-28 som hører i nå-rapporten, ikke i egne runder:** (a) **ANSVARLIG dupliserer FLYT.** `formaterAnsvarlig` falt tilbake på utførerfaggruppen på utkast — rettet (`eb9cc787`, utkast → oppretteren), men *begrepsproblemet* står: to kolonner svarer nesten på samme spørsmål, og FLYT svarer allerede presist («1. Kenneth Myrhaug»). (b) **Navigasjonen har tre gate-systemer uten forbindende prinsipp** — `kreverGruppemodul` (brukergruppe) · `kreverModul` (prosjekt) · `kreverFirmaModul` (firma), tre sider, tre begreper som alle heter «moduler», mens sju nav-elementer er ugatet. Målt: alle sju er vaktet i datalaget (`bilde.ts:37-38`, `papirkurv.ts:33`) — menyen skjuler altså ting serveren ville tillatt. **Spørsmålet til fabel er skrevet og ligger usendt:** `relay/fabel-nav-gating-modellen.md` — skal navigasjonen ha en tilgangsmodell i det hele tatt, og hva skal 3D gjøre når `kreverGruppemodul` har én bruker igjen? | README § To nøkkelkomponenter |
| 9 | Modul-oppsettswizard (generalisering av timer-onboarding) | Prinsipper vedtatt, fremtidig spor | README § Designprinsipp: wizard |
| 10 | K11 admin-redesign (abonnement/drill-down, Fakturering F20) | Egen fase ETTER kunderettet nav | K-BESLUTNINGER K11 |
| K14 | Søk-utvidelse: admin-flater i søkeregisteret (rolle-gated sitedoc_admin) + alias/synonymer per treff | KØ (Kenneth 2026-07-13: ingen hast) — tas sammen med del 10/K11 admin-fasen, ev. som liten sak etter del 6b | — |
| G2 | Georeferanse-panel v2 + tillegg A (Kartverket-treffliste begge flater) | ✅ **LUKKET 2026-07-15** — designgodkjent, e91f10c4 i prod, Kenneth-verifisert på test | `verifisering/georef-panel-verifiseringslogg.md` |
| N3 | Dokumentflyt-synlighet datamodell (funn fra A-3a-sløyfen) | ✅ **LUKKET 2026-07-19** — del 1+2 merget develop (68f3ddaf), verifisert test 8/8; **i prod 2026-07-27** (develop→main-deployen). Tre saker rutet ut til fabel: G1-mutere (inkl. meny-UX), opprett→usynlig, HMS-synlighet-regel | `verifisering/N3-verifiseringslogg.md` |
| P1 | Nivåsignal firma vs. prosjekt (prod-funn 2026-07-21: firma-/prosjekt-HMS forvekslbare) | **A–C ✅ på develop+prod** (bygget i K3-runden 22.–23.07, commits 6b5fd5a7…51e8cc8f; git-bekreftet 28.07 — ordren var utdatert, Opus B stoppet riktig). **§ 3b kp1 (byttTil-a11y-nøkler) levert 22b3781d, fabel-ordlyd bekreftet 28.07 — cowork merger.** Åpent: § 3b kp2 (⇄-plassering, venter mockup § 2a) · K1+K2 (liten sak, fabel-gatet) · P1d suffiks (repo-sak) · gjennomgående plan øvrige par = egen sak | git-verifisering 2026-07-28 + relay/inbox-fabel.md |
| P2 | Inndata-validering status-handlinger (prod-funn 2026-07-21: Send tilbake/Besvar uten innhold) | Kenneth-vedtatt 2026-07-21 (`delplaner/p2-inndata-validering-vedtak.md`); ordre skrives etter P1-beslutning-sekvensering (cowork) | — |
| K15 | Vedlegg på tillegg-registrering (foto/skann/opplasting, f.eks. kvittering på Overtidsmat) | Ny sak (Kenneth 2026-07-13); krever nå-sjekk: finnes gjenbrukbar opplastings-infra i dagsseddel-domenet? Prioritet ikke satt | — |
| 10a | Firmaorientert admin (1a firmaliste + 1b firmadetalj) | ✅ **Fase 1 LUKKET 2026-07-27** — fabel-designgodkjent, merget, i prod (develop→main 27.07). **Fase 2 (egen ordre, BACKLOG):** Ctrl+K tverrgående admin-prosjektsøk → deretter sletting av global prosjektliste; Activity-skriving fra kjerne-ruter (gjeninnfører «sist aktivitet»-badge). Bevisst utelatt fase 1: sekundær-org-tilknytning; gammel liste = fase 2 | Exit-dok + `docs/claude/historikk-2026-07.md` § Prod-deploy 2026-07-27 (repo) |
| AM | **A. Markussen-funn 2026-08-20 (HASTER, P0 — foran alt annet nytt)** | Kundemøte 20.08 (referat: `til-repo-2026-08-20-1500/docs/redesign/referat-markussen-ordreliste-fabel-2026-08-20.md`). Rekkefølge Kenneth-vedtatt: **(1) Timer-bugs** — splitt dobler timetall i mobil (SQLite synker ikke slettede rader/dagskort), play+dagskort-konflikt, Excel-eksport; **(2) Attestering** — sammenligning per prosjekt/alle ansatte og per ansatt, dag/uke + 40-timers overtidsregel m/varsel til attestant (regelverk i shared); **(3) KP-bugs** — ✅ **MÅLT FIKSET 2026-08-28:** begge ble rettet i `180e9c61` samme dag som møtet (20.08) og er i prod. Markørens destinasjon leses fra markørobjektets egen `sjekklisteId` (`tegninger/page.tsx:980-987`, ikke koordinat/indeks), web og mobil holder KP- og oppgavemarkører i adskilte nøkkelrom (`kp:`-prefiks på mobil), og begge markørtyper har `title` + synlig hover-etikett. Flytt speiler nå til punktet (`sjekkliste.ts:622-629`). **Ikke bestill på nytt.** Restfunn fra målingen → `relay/inbox-kp-speiling.md` (prosjektisolering mangler i speilingen, enveis speiling, latent `?? null`-koersjon, stille mobil-tapp). Opprinnelig meldt som: kart-klikk åpner feil sjekkliste + ingen hover-identitet; flytt av punkt i tegning mister KP-markøren; **(4) Malarkiv** — firma-malarkiv (HMS/sjekkliste/oppgave-maler til nye prosjekter) + sentralt SiteDoc-arkiv å låne fra (designsak først). Gjennomgående kundeinntrykk: «mange klikk» → klikktelling før/etter i DoD på alle fire | referatet (sti over) |
| KP | **Kontrollplan (HASTER, P0)** | ✅ **L1 FABEL-DESIGNGODKJENT 2026-08-14** — alle 5 skjermbilder grønne. 🔴 **Gaten fanget en blokker coworks kodegate ikke så:** `kontrollplanPunktId: z.string().uuid()` mot `KontrollplanPunkt.id = cuid()` → Start-veien var DØD på develop. Fiks + regresjonstest + sweep. **Presedens ført: skjermbilde-gate mot kjørende kode er ikke seremoni.** Avgjørelser: B12 står på 1/4 (ekte kobling; nullstilling ville gjeninnført bugen som datatilstand) · Narvik tom kontrollplan → backlogg («Slett kontrollplan»-mutasjon). Design-observasjon til L2: Status «Pågår» + Sjekkliste «Godkjent» på samme rad beviser avledet kilde, men to statusord forvirrer — avklar om punkt-status skal pensjoneres fra UI. **L1 IKKE i 25-commits-deltaet; egen prod-vei.** Avvik fra skisse: ingen egen `startPunkt` — Start går klient-orkestrert over `sjekkliste.opprett(kontrollplanPunktId)` med atomisk kobling i samme tx. Helhetlig plan vedtatt 2026-08-13 (`til-repo-2026-08-13-1015/KONTROLLPLAN-HELHETSPLAN.md`). Avklart: «frittstående sjekkliste» forkastet — vanlig vei bærer (bestiller = oppretters faggruppe, utfører = punkt.faggruppeId, flyt via `opprettbareFlytIder`). L1: koblePunkt + startPunkt (null nye kolonner — `KontrollplanPunkt.sjekklisteId` finnes, aldri fylt; 13 sjekklister kobles). L2: ✅ **MÅLT LEVERT OG I PROD 2026-08-28** — `KontrollplanPunkt.drawingId/positionX/positionY` står i schemaet, «Vis på tegning» går via `?marker=<punktId>` (`tegninger/page.tsx:137`), tilstandsmerkene finnes (`kontrollplan/TilstandMerke.tsx`, `PunktTilstand` = forfalt/aktuellNaa/pabegynt/planlagt/utenFrist/godkjent), og skillet plan- vs. frittstående er sjekklistefilteret «Hører til planen / Kommer i tillegg». Alle åtte `feat/kontrollplan-*`-brancher er forfedre av `origin/main`, null commits foran develop. ⚠️ Denne raden beskrev L2 som framtidig helt til 28.08 — drift, ikke plan. L3 (egne saker, IKKE startet): aktiv varsling m/scheduler, byggherre-overlevering. Åpent fra L1: «Slett kontrollplan»-mutasjon (Narvik tom plan) · design-observasjon om to statusord på samme rad (fabel) | `verifisering/kontrollplan-verifiseringslogg.md` (opprettes v/L1-exit) |
| GR | Georef-speilfeil 2-punkts (felt-funn Lakselv 2026-08-13) | ✅ **LUKKET 2026-08-13** — fikset (`7dd4df8d`), merget develop (`aa5e3d57`), **i prod `2a9aa182`**. `det = −(a²+b²) < 0` gir korrekt kiralitet; invers reutledet. 461/461 shared-tester grønne; regresjonstest med reelle Lakselv-koordinater verifiserer at pikselside er MOTSATT av GPS-side. Ingen migrering — eksisterende 2-punkts-kalibreringer ble riktige automatisk. Åpen egen sak: UI-hint «2 punkter gir eksakt fit» | — |
| UT | **Utskriftsformer — samlet kravspec (prod-krav 2026-08-13)** | (1) tomme/uutfylte objekter skrives ikke ut · (2) loggen skrives ikke ut og kan ikke velges — vedtaket «logg alltid på, velges ved utskrift» finnes, bryteren ikke · (3) **avsenderfirma mangler** (`header.ts:74-81` bygger personnavn+faggruppe; ingen organisasjon — «Byggeledelse» er faggruppe, ikke rettssubjekt) · (4) flere former per dokumenttype · (5) samleutskrift kompakt + utvidet. Rutes til arkivmal (DG), ikke flere runder på klient-lappen. ⚠️ **Delvis overlappet av printmotor 1–4 (timer-rapport, 27.–28.08)** — punkt 2 og 4 er løst for timer-flaten, ikke for arkivmal. Må reconciles mot DG før ordre | BACKLOG § «Utskriftsformer — samlet kravspec» |
| PR | **Printmotor timer-rapport (nytt spor 2026-08-25, LEVERT)** | ✅ **Fase 1–4 + to oppfølgere i PROD 2026-08-28** (`5dcdeb58`). PDF av rapporten · radvalg m/Type-kolonne · lagrede maler (`EksportOppsett`, config v2 JSONB) · byggherredokument (`mottaker: intern\|ekstern` fjerner status/ID/ansattnr **strukturelt** — personvern, ansattnr er pseudonymiseringsnøkkelen) · detaljvisning på skjerm. 🔴 **Modellen ble snudd 27.08:** malen styrer **skjermen**, eksporten skriver ut det som vises (Kenneth: «dynamisk vise på web → for så å skrive ut det vi ser»). Neste retning: **arkivering framfor nedlasting** — fabel eier designet, hardt premiss er at `Folder.projectId` er påkrevd mens timer-rapporten er en firma-flate. ⚠️ **Åpen rest i BACKLOG:** `landscape`-parameteren er i koden, men pdf-render-containeren er ikke bygget — liggende Fakturagrunnlag virker ikke i prod. Buntet med `page.route`-fiksen i ett gatet steg (samme container, delt med test). **Kolonnevelgeren (ordre `relay/inbox-kolonnevelger.md`) henger her** — den skal ekstrahere «Velg parameter» til en delt komponent og migrere sjekklister + oppgaver til den, så den treffer 6b-flatene like mye som PR | [`../claude/delplaner/printmotor-faser-2026-08-25.md`](../claude/delplaner/printmotor-faser-2026-08-25.md) |
| REG | **Registreringsmodellen — ansatt-livssyklus + firmamal (nytt spor 2026-08-28)** | Utløst av at `prosjekt.opprett` lager et tomt skall (ingen faggrupper, flyt eller maler) og at **avregistrering ikke fantes**: `ProjectMember.periodeSlutt` var inert i begge ender, `OrganizationMember` hadde ingen ansettelsesstatus. ✅ **Fase 1 LEVERT** (`ec986845`): `status` + guard i alle 11 prosjekt-porter + `hentBrukersOrg`-filter (dekker firma-veien inkl. timeføring på én linje). ✅ **Ansattvelger LEVERT** (`07a78858`): firmaets ansatte + avdelinger inn i prosjekt og flytroller — tidligere fantes ingen vei fra «ansatt i firmaet» til «medlem av prosjektet». Fase 2 registrerings-UI · 3 firmamal + onboarding · 4 avdelingsregel. Kenneth-vedtak: `manuell` som firmadefault (endres av firmaet selv). 🔴 **Modulnøkler TATT UT av fase 2 (2026-08-30)** — modulmodellen er ikke avklart («firma kjøper, alle ansatte får» vs. per-ansatt-nøkler; 50-ansatte-problemet). Ligger hos fabel med måling: `docs/claude/modulmodell-utredning-2026-08-30.md`, backlog-post i `BACKLOG.md § 2`. ✅ **Begge er I PROD 2026-08-28 (`ba234fd1`)** — første release som kan frata noen tilgang; deaktivering er manuell og migreringen er additiv med default `aktiv`, så ingen ansatt endret status ved deploy | `designnotat-registreringsmodellen-fabel-2026-08-28.md` |
| ON | **Onboarding — in-app veileder etter prosjektopprettelse** | Planen er fra 2026-05-02 og sier selv at mangelen «blokkerer selvstendig A.Markussen-onboarding». **Kenneth-føring 28.08:** bevisst utsatt til timer og dokumentflyt virket — *«det er ingen vits i å lose noen inn i en flyt som ikke virker»*. Nå er de på plass. ✅ **PANELET ER ALLEREDE BYGGET — målt 2026-08-29.** `[prosjektId]/page.tsx:119-198` rendrer fire steg + modul-steg, lenker til riktige URL-er, markeres fra DB-tilstand via `prosjekt.hentOnboardingStatus` (`prosjekt.ts:207`, ett kallsted `:25`), skjules når alt er oppfylt, i18n-et. Også **UX-problem 1 er løst**: `[prosjektId]/faggrupper` er full CRUD og lenket fra dashbord-kortet. ⚠️ Ordren fra 28.08 antok at ingenting fantes; cowork-gaten samme dag verifiserte hullet i `prosjekt.opprett` men sjekket aldri om konsumenten fantes — `hentOnboardingStatus` er navngitt etter sin bruker, og ett grep ville avslørt den. **Gjenstår:** `harTegning` + delstatus på lokasjonssteget (flagget er `byggeplass.count` og blir grønt uten en eneste tegning). 🔴 Gaten er ikke panelet, men at Kenneth kommer fra tomt prosjekt til sendt sjekkliste **kun via panelets lenker** — den er ikke gått ennå | [`../claude/prosjektoppsett-veileder.md`](../claude/prosjektoppsett-veileder.md) + `designnotat-nytt-prosjekt-innhold-fabel-2026-08-28.md` |
| DG | **Dokumentgenerering / arkiv-PDF (nytt spor 2026-08-21 — leveransen kunden faktisk mottar)** | Prod-funn 20.–21.08 (BHO-002): arkiv-PDF taper innhold stille. Kodeverifisert mot `packages/pdf` 21.08: `felt.ts` returnerer tom streng for `location` og `drawing_position` (tegningsrenderer finnes ferdig i `tegning.ts` men kalles aldri fra arkivstien) + instruksjonstypene (info_text/info_image/video/quiz); **F7**: kommentar/vedlegg festet på repeater-OBJEKT (uten «Legg til rad») faller ut av arkivet — web viser dem. Design vedtatt i `Arkivmal PDF Mockup.dc.html` (rev. 21.08, 14 sider): malobjekt-revisjon alle 26 typer · tegninger i arkivet (drawing_position oversikt+4×detalj, dokumentnivå-lokasjon m/kartpunkt; uten markering utelates seksjonen) · **helside tegningsprint per tegning m/alle markører nummerert mot punktnumrene (D2b, Kenneth-funn 21.08)** · Oppgave-PDF · F7 = egen blokk «Registrert utenfor rader» OVER tabellen (aldri rad 0, aldri utelatt) · knapp renames «Last ned arkiv-PDF»→«Last ned PDF» (splittknapp: Med logg (standard)/Uten logg/Send til) · samlerapport blandet SJ+OPG+HMS · sluttoppgjør-oppgaveliste m/kilde-kolonne. Designnotat: `docs/redesign/designnotat-arkivmal-pdf-fabel-2026-08-21.md`. **D8/D9 (beslutning 21.08, cowork-gatet):** repeater = rader × kolonner, barn-labels styrer begge flater; web-utfylling skal vise barn-labels — MEN malrydding først (4 funn: «_ opus»-notis + tre «-»-labels; 999-navn = Kenneth, inkl. «Beraringsrapport»-stavefeil). Veiledning = `config.helpText` (wiret ende-til-ende, rendres ikke i PDF i dag) + `info_text`; én utskriftsbryter «Ta med veiledningstekster», av som standard. Beslutningsdok: `docs/redesign/beslutning-repeater-label-modell-fabel-2026-08-21.md`. **Krav (Kenneth 21.08): PDF-motoren skal virke for både web og mobil** — alt bygges i delt `packages/pdf`-sti, verifiseres fra begge flater. **Gatet av cowork 21.08; design Kenneth-godkjent 21.08, notat committet develop.** Måling (cowork): `arkivmal/innhold.ts:13` importerer `renderFelt` fra delt `felt.ts` — arkivet har ingen egen feltrenderer; tegningsrendering i felt.ts ville truffet mobil-PDF udesignet → bindende: overstyring i `arkivmal/` (repeater-mønsteret), felt.ts røres ikke. **Ordre D2/D2b skrevet 21.08:** `docs/redesign/ordre-arkivmal-tegning-d2-d2b-fabel-2026-08-21.md` — DoD krever bevis fra BEGGE flater (jf. 24 paritetsavvik: «fiks landet på én flate, aldri portert»). Prioritet: tegning (D2/D2b) FØRST, ubetinget — klient-utskriften fjernet 20.08 (F2, d92ece42) var eneste vei til tegningsutskrift. Deretter F7 — **avklart 21.08: BEF-001-test kjørt, bildene kom med → eksisterende mangel, ikke regresjon; ordre skrevet:** `docs/redesign/ordre-arkivmal-f7-objektniva-fabel-2026-08-21.md`. Så variantene. Kodesporet lever i `docs/claude/dokumentgenerering-plan.md` (F1b–F7) — dette sporet gir det plass i rekkefølgen | mockupen + designnotatet |
| FL | **Prosjekt-livssyklus på firmanivå (målt 2026-08-30)** | Firmalisten `/dashbord/firma/prosjekter` viser status men kan ikke endre den — verken aktivere, deaktivere, avslutte eller arkivere. **Statusmodellen spriker per lag:** DB `String @default("active")` (`schema.prisma:584`) · API tar imot **fire** (`prosjekt.ts:606`, inkl. `deactivated`) · prosjektoppsettet tilbyr **tre** (`oppsett/prosjektoppsett/page.tsx:35-60` — deaktivering er sitedoc-admin-only) · firmalisten **null** (kun visning, og rendrer «archived»/«completed» rått forbi `t()`, `firma/prosjekter/page.tsx:149`). **Konsekvens:** et firma som vil fryse et prosjekt må be SiteDoc om det; arkivering av N avsluttede prosjekter = N sidebesøk innenfra, mens den ene flaten som ser alle N samtidig ikke kan gjøre noe. Strider mot [terminologi.md § 0](../claude/terminologi.md) (firmaet eier prosjektene sine). 🔴 **UTVIDET FUNN 2026-08-30 — verre enn manglende knapper: `Project.status` HÅNDHEVER INGENTING.** Ingen skrivevei i `apps/api` leser den (negativ kontroll: `tilgangskontroll.ts` leser `OrganizationMember.status`, aldri prosjektets; «skrivebeskytt»/`readOnly` finnes ikke i api-et). Samtidig lover UI-et `nb.json:2218` *«Prosjektet er arkivert og skrivebeskyttet»*. **Knappen finnes — den gjør bare ingenting.** Det er en løftebrist mot kunden, ikke en manglende funksjon. Kenneth 2026-08-30: *«vi må ha en løsning for å avslutte et prosjekt!»* → **vedtatt at avslutning er FRYSING, ikke sletting** ([domene-arbeidsflyt.md § BINDENDE VEDTAK 2026-08-30](../claude/domene-arbeidsflyt.md)) — sjekklistene fra et ferdig prosjekt er det kunden skal beholde. Frysing løser samtidig ledd-vernet og «slette flyt med lukkede dokumenter». 🔴 **Designes i prosjekt- vs firma-innstillinger-sesjonen (pkt 7) — ikke som løsordre.** Måling: `relay/fabel-firmanivaaet-mangler-styring.md` | notatet |
| PM | Produktmodell-rearkitektur: prosjekt- → firmaorientert | Utredning levert (`delplaner/firma-produktmodell-utredning-2026-07-26.md`) + 3 Kenneth-beslutninger: firma påkrevd v/onboarding (auto-enmannsfirma) · én «prosjekt»-slug (OrganizationModule, rent eierskapssignal) · 10-grense hengt på modul-eierskap + 30d trialExpiresAt. Byggeordre (§2+3+5) **parkert** til interim-guard + admin lander — **scope-tillegg (cowork-rutet 2026-07-28): funn A fra `dokumentflyt-medlem-analyse-2026-07-28.md`** (flyt-invitasjon lager firma-løse brukere uten gruppe-kobling; fiks = én delt invitasjonsmodal, firma-krevende `medlem.leggTil` + `groupId` i samme transaksjon). Interim: sjekklistegrense gates på firma-tilknytning (`feat/sjekklistegrense-firma`) — låser opp pilot-blokkeren | `delplaner/firma-produktmodell-utredning-2026-07-26.md` |
| **LP** | **lokasjonOmfang nivå 3 — «hele prosjektet»** | Designsak hos fabel. I dag er `byggeplassId = null` tvetydig; gatelys-eksempelet gjelder ett trinn opp. **Liten** — additivt på lokasjonOmfang-sporet levert 04.09. Fakta: [BESTILLING § 2C](til-fabel/BESTILLING-masterplan-2026-09-04.md) | tillegg til lokasjon-ordren (fabel) |
| **EX** | **Eksport og navngiving** — PDF/Excel/CSV fra app OG web, med velge/preview/dele · rename «Arkiv-PDF» → eksport-språk · **«arkiver» reserveres** for fremtidig handling (= PR-sporet) | Designsak hos fabel. Fakta og Kenneth-sitater: [BESTILLING § 2A](til-fabel/BESTILLING-masterplan-2026-09-04.md) | designnotat kommer (fabel) |
| **AG** | **Ansvarsgrensen** — produkttekst om hva SiteDoc leverer vs. hva bedriften eier selv | 🔴 **Teksten skrives av FABEL, gates av Kenneth — aldri cowork eller kodeagent** (juridisk-nær). Plassering avgjøres i notatet. Utløst av eksponeringsregister-korreksjonen: [BESTILLING § 2D](til-fabel/BESTILLING-masterplan-2026-09-04.md) + [domene-arbeidsflyt.md](../claude/domene-arbeidsflyt.md) | designnotat kommer (fabel) |
| **BL** | **Byggeplass-livssyklus** — tilstand/start/slutt/arkivering · velger-skala ved 500 byggeplasser · PSI og mannskap ved avslutning | Designsak hos fabel. Premiss avklart: `Project` ER beholderen, intet nytt nivå. **Sluker to åpne funn:** chip-teksten som lover en avgrensning systemet ikke gjør, og tegninger-hardt/dokumenter-mykt filter — samme scoping-modell. Utredning: [domene-arbeidsflyt.md](../claude/domene-arbeidsflyt.md) | designsak kommer (fabel) |
| **MK** | **NS 3420-malkvalitet (Kenneth-bestilling 05.09, funn A–D)** | Bestilling: `til-fabel/BESTILLING-malkvalitet-2026-09-05.md`. Faktagrunnlag: 12 maler (6 K, 6 F) i seed. **Kenneth-vedtak 05.09 (binder ALLE malordrer): maler bygges av MalBygger-objektene — aldri hardkodet; funksjonsforbedring av objektene er OK** (ført i MALBYGGER.md). ✅ **B+D LEVERT OG MERGET 06.09** (`3c40df3e`): «(AI-utkast)» ut av kundetekst, `verifisert: false` eksplisitt + prod-gate, utkast-badge på malkort begge lånevinduer, F-malene seedet, `kontrollplan.md` renset (`2df3d47d`-runden). ✅ **Trafikklys slanket 28→22px** (`cd3c1f84`), mobil fikk grå «Ikke relevant» for paritet. **A seksjonsstatus:** kollaps fantes (`56cb0cfa`); status-header «X av Y utfylt» levert `6458a704`. 🟡 **C Vei B (betingede grenser) GJENSTÅR** — kostnadsmålt: delt resolver + 4 lesere (kun integer/decimal) + MalBygger-UI (fabel-designsak før ordre); premiss 3 UTSKILT → DG | svar-dokumentene (`docs/redesign/kp-malkvalitet-*`) |
| **SJA** | **SJA-signaturrunder (Kenneth-funn 05.09, P0 — lovpålagt dok kunne ikke dokumentere hvem som signerte)** | Designet ferdig på én kveld: gjenbruk som ramme (én SJA per arbeidsoperasjon, signert per RUNDE — ikke versjoner) · modell `SignaturRunde`+`DokumentDeltaker`+`DokumentSignatur` (vei 2-FK-er m/cascade, frys `antallDeltakere`, ingen kolonne på Checklist/Task) · lås = handling «Avslutt runde», gjenåpning = «Start ny runde» · gjest påkrevd (PSI-mønsteret) · manko først i UI + chip i lista (énspørring) · PDF: gjeldende runde + «Med logg», manko aldri utelatt. ✅ **LEVERT OG MERGET 06.09** (`f5d75571` → `e2e87123`): felttypen `signature_list`, tre tabeller, migrering `20260906000000` **anvendt mot `sitedoc_test`**, MalBygger-guard mot to lister, serverlås mot skriving på avsluttet runde (`5e13c43e`). Delleveranse 2 levert (`5dc04240`): `signature`-feltet bærer `{dataUrl, brukerId, navn, tidspunkt}` med legacy-lesing, delt leser i `@sitedoc/shared` + bevisst PDF-speil. Testdata seedet på test (`SD-DEMO-SJA-0001`). 🔴 **VENTER: fabels skjermbilde-gate — åtte flater, underlag `til-fabel/skjermbilde-underlag-sja-signaturrunder-2026-09-06.md`. Ingenting til prod før den er kjørt.** 🟡 Åpne designspørsmål til gaten: 1-klikks attest uten signaturpad/HMS-kort · medlemsdeltakeres firma vises ikke (`guestCompany` kun på gjest) · om et automatisk værsnapshot i `endreStatus` skal regnes som innhold i låsens forstand | designdok 2015/2130/2300/2345 + nå-rapport `til-fabel/MAALING-sja-signaturmodell-2026-09-05.md` |

## 🔴 REKKEFØLGE (fabel 2026-09-06) — erstatter blokken under

> **Cowork-avstemt mot kode 2026-09-06.** Fabels leverte rekkefølge var skrevet før
> natten 05/06.09, da åtte merge-runder landet. Punktene under er hans, med målt status.

- ~~**0a. SJA-signaturrunder**~~ ✅ **LEVERT OG MERGET** (`e2e87123`), på test. **Venter kun fabels skjermbilde-gate.**
- ~~**0b. MK B+D malrevisjon**~~ ✅ **LEVERT OG MERGET** (`3c40df3e`). **MK C (Vei B) gjenstår** og trenger MalBygger-UI-design først.
- **0c. DG-tillegg: PDF viser grensekrav** (premiss 3-utskillelsen — arkiv-PDF viser i dag målt verdi uten kravet; snapshot-spørsmålet bor her). 🔴 **Nå øverst i køen** — eneste gjenstående punkt fra fabels egen rekkefølge.

⚠️ **Fabels caveat, gjentatt fordi den gjelder:** hendelser mellom 20.08 og 04.09 som ikke gikk
gjennom fabel er ikke oppdatert i radene hans — særlig DG-status etter HMS-PDF-en 04.09.
**Cowork supplerer ved neste sync.**

🔴 **Merk om vedlikehold (hendelse 2026-09-06):** fabel leverte denne revisjonen som **helfil**,
bygget på en versjon fra ~21.08. Hans fil var **24 kB mot repoets 49 kB** og manglet seks rader
— `6b-x`, `UT`, `PR`, `REG`, `ON`, `FL` — altså all målt status fra 28.–30.08. Hadde cowork
kopiert fila inn, var alt det tapt. **Kun MK, SJA, rekkefølgen og backlog-postene ble flettet
inn.** Regelen i toppen av denne fila står ved lag: fabel leverer notater, cowork fører dem inn.

## Nye backlog-saker (2026-09-05-runden, kodeverifisert)

- ~~**TILBEHOR_REN_FJERNING-divergens**~~ ✅ **LUKKET** (`85c8ecd5`): `TILBEHOR_REN_FJERNING_BASE` i `@sitedoc/shared`, begge renderere leser den. 🟡 **`weather` er IKKE harmonisert** — mobil har den, web ikke; begrunnelsen står i koden og venter Kenneths produktsvar: *skal en værobservasjon kunne bære kommentar og bilde i felt?*
- **«+ Oppgave»-gating per felttype:** fortsatt ikke målt.
- ~~**F-malene aldri seedet + `kontrollplan.md` uten NS 3420-F**~~ ✅ **LUKKET** i MK B+D. (Merk: påstanden om at F manglet i `kontrollplan.md` var **feil** — den sto der hele tiden, `kontrollplan.md:394`. Coworks premiss, målt bort av kontrollplan.)
- **PSI-migrering til felles signaturmodell:** senere sak — `PsiSignatur` røres ikke.

## Rekkefølge (fabel 2026-09-05) — historikk

> Bygger på [§ AVSTEMT MOT KODE 2026-09-04](#-avstemt-mot-kode-2026-09-04--fem-av-åtte-punkter-var-allerede-levert).
> Alt er design-først; køen til kodeagentene fylles i denne rekkefølgen.
>
> 🔴 **OTA er priset inn.** I drift fra 04.09: mobilarbeid i JS koster ikke lenger byggkvote.
> **Derfor designes alle brukervendte saker for web + mobil SAMTIDIG — aldri «web først, mobil
> senere».**

1. **LP — «hele prosjektet»-omfang.** Først fordi den rir på det ferske lokasjonOmfang-sporet
   (samme utfører-kontekst, samme testmatrise utvides) og lukker siste null-tvetydighet mens
   modellen er varm.
2. **EX — eksport-designsak.** Størst pilot-verdi: PDF-en er leveransen kunden faktisk mottar, og
   eksport fra app er nettopp blitt billig (OTA + delt `packages/pdf`). **To ledd:** navnevedtaket
   først (låser språket før flere flater bygger på «arkiv») → så flaten (velge/preview/dele,
   web+mobil i SAMME ordre). PR-sporets «arkivering framfor nedlasting» folder inn som
   navnereservasjon; egen bygging fortsatt nedprioritert (timer-flaten ubrukt, målt 27.08).
3. **AG — ansvarsgrense-notatet.** Parallelt med EX (blokkerer ingen kode). Foran BL fordi piloten
   møter HMS-flatene fra dag én.
4. **BL — byggeplass-livssyklus.** Designsak med kodeverifisert nå-rapport først (Byggeplass-
   modellens faktiske felter + alle velger-/filter-lesere). **Første reelle bruk av det reserverte
   «arkiver»-ordet — derfor ETTER navnevedtaket, aldri før.**
5. **AM 2 attestering / 40-timers** — nedprioritert med målt begrunnelse (se «Ikke prioritert
   nå»-avsnittet under). Re-vurderes når piloten fører timer.
6. **Restkø uendret:** PM interim-guard → 10a fase 2 · P2 · Del 7 · Del 8 · Del 9, 10/K11 (+K14),
   K15. Begrunnelsene står i rekkefølge-teksten under.

**Fabels egen kø:** tidslinje + endringslogg-fletting (én kronologisk logg) tas som del av
EX-designsaken **hvis** loggvalget «Med logg / Uten logg» berører samme utskriftsflate — ellers
egen sak etter BL.

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

## 🔴 AVSTEMT MOT KODE 2026-09-04 — fem av åtte punkter var allerede levert

Cowork målte hvert punkt i rekkefølgen under mot `develop` (`655c948b`). **Rekkefølgen var
opptil fem uker bak koden.** Listen under er rettet; den gamle teksten står uendret så
begrunnelsene ikke går tapt.

| Punkt | Påstand i planen | Målt |
|---|---|---|
| 1. ON onboarding | «neste steg» | ✅ **LEVERT** `c48e6d44` + `b32326a8` — `firmaOnboardingWizard`, `organisasjon.hentOnboardingStatus` |
| 2. REG fase 2–3 | gjenstår | ✅ **LEVERT** `578e2b67` (fase 2) + `23a52504` (`prosjektTilgangEvaluator.ts`) |
| 3. AM 2 attestering | P0 | ❌ **IKKE BYGGET** — grep «40-timers» → 0 treff, negativ kontroll bestått |
| 3. AM 3 KP-bugs | fikset 28.08 | ✅ **LEVERT** `180e9c61`; restfunnene i `inbox-kp-speiling.md` også levert (`b987d793`) |
| 3. AM 4 malarkiv | P0 | ✅ **BOLK 1+2 PÅ TEST 04.09** (`91e3e5a6` + `2cfdbaea`) — **venter fabel-designgate (DoD pkt 3): skjermbilder fra test.** Designsak levert 2026-09-04 ([designnotat-malarkiv](designnotat-malarkiv-fabel-2026-09-04.md)) — venter Kenneth-gate på mockup (B1–B3) før ordre. **Funn: `OrganizationTemplate`-datamodellen finnes allerede** (`schema.prisma:1038`, steg 1 av `migrering-reporttemplate.md` bygget, delvis i bruk i `mal.ts` + `kontrollplanKobling.ts`) — det som mangler er API, UI og seeding. Mindre sak enn antatt |
| 4. DG arkiv-PDF | gjenstår | ✅ **TOMT** — D2/D2b levert 21.08, F7 lukket 04.09, layoutfunn merget `655c948b` |
| 6. Del 6b fase 2 | «ordre 28.07, aldri relayet» | ✅ **LEVERT `ee7d4e3e` — samme DAG ordren ble skrevet.** Filter, opprett-vei, HMS-mobil, kontrollplan-lese. Sto som åpen i fem uker |
| 6b-x tabellbredder · PR kolonnevelger | «henger» | ✅ **LEVERT** `7b413263` + `d394bdde` |
| 7. PM interim-guard | gjenstår | ⚠️ **IKKE MÅLT** — ikke anta noe |

🔴 **Konsekvensen for køen:** det som faktisk gjenstår og som kan ordres til en kodeagent **uten
fabel-design først, er ingenting.** AM 4 er en designsak; AM 2 er timer-arbeid som linje under
nedprioriterer med målt begrunnelse. **Neste flaskehals er fabel, ikke koding.**

⚠️ **Lærdom, ikke bokføring.** Kenneth 31.08: *«Nå er vi mer opptatt av hva som er gjort enn å
lukke oppgaver i masterplanen.»* Denne målingen viser hvorfor det er vanskelig: en agent som
leverte og ble avsluttet, etterlot ingen spor i planen. **Cowork brukte tre målerunder 04.09 på
å oppdage at tre «åpne» ordrer var utført.** Fase 4 i Opus-livssyklusen skal lukke dette — raden
fjernes ved merge — men den fanger ikke masterplanens egne linjer. Avstemming mot kode hører
inn ved hver merge som lukker et planpunkt, ikke som en egen øvelse hver femte uke.

## ~~Rekkefølge (justert 2026-08-28)~~ — ERSTATTET 2026-09-05

> ⚠️ **Gjeldende rekkefølge står i [§ REKKEFØLGE (fabel 2026-09-05)](#-rekkefølge-fabel-2026-09-05--erstatter-punktlisten-under).**
> Punktlisten under er beholdt fordi **begrunnelsene** fortsatt gjelder for restkøen (punkt 5–8),
> og fordi den forklarer hvorfor ting ble prioritert som de ble. **Punkt 1, 2, 4 og 6 var levert
> allerede da den ble skrevet** — se avstemmingen over. Ikke plukk oppgaver herfra.

**Målestokken er piloten (~sept 2026).** Pilot-triagen 26.08 gikk gjennom alle 42 åpne
🔴 og fant **én** blokkerer — mobil-annotering som eksporterte 3,4 MB PNG. Den ligger i
TestFlight-bygg #46 (28.08). **Det som står igjen er «skjemmer», ikke «stopper».**

1. **ON onboarding-veileder** — ordre skrevet 28.08. Et nyopprettet prosjekt er i dag et
   tomt skall uten vei videre; det er pilotens første møte med produktet
2. **REG fase 2–3** — registrerings-UI, så firmamal + onboarding-automatikk. Fase 3 er
   det som gjør `manuell` tilgangsregel billig nok til å leve med
3. **AM 2–4** — attestering (sammenligning + 40-timers regel), KP-bugs, malarkiv.
   ⚠️ AM 1 (timer-bugs) er **delvis dekket** av mobil D-serien 26.–28.08 (D3
   aktivitetsfordeling, sync-teller, dagsseddel-konflikt) — **må reconciles mot
   referatet før ordre skrives**, ikke antas løst
4. **DG arkiv-PDF** — F7 + tegningsutskrift (stille datatap i kundeleveranse). Merk
   overlappet med UT og PR: printmotoren løste utskriftsformer for timer-flaten, ikke
   for arkivmal
5. **PR arkivering** — venter fabels designnotat om arkiv framfor nedlasting
6. **Del 6b fase 2 — mobil-løft** — ordre fra 2026-07-28, aldri relayet
7. **PM interim-guard** → PM-byggeordre §2+3+5
8. **10a fase 2 · P2 · Del 7 · Del 8 · Del 9, 10/K11 (+K14), K15** — deretter

**Ikke prioritert nå, med grunn:** mer timer-arbeid. Målt 27.08 hadde prod **null
attesterte sedler** — timer-modulen er ikke i bruk der ennå. Vi bygde eksport i to dager
for en flate ingen har tatt i bruk. Det var riktig (eksporten er det som gjør timer
nyttig), men neste runde bør gå til noe piloten faktisk møter.

## Prod-deploy 2026-07-27 (develop→main, 81 commits + 2 migreringer)
Mye «ikke prod» ble LIVE: statusmaskin-redesign F0–F6, flytrettigheter H3/H6 + flyt-posisjon-header + byggLedd + flytvisning-fane, e2e-røyksuite, Tooltip v2 + mikrotekst-wiring, tilgangslaget + N3, A-3a handlingsmeny, firmaorientert admin fase 1. Migreringer: F0 soft-delete (additiv) + F3 rejected→in_progress (data). Prod-verifisert innlogget (A.Markussen). Lærdom: migrate-steget først hoppet over → feilende deleted_at-spørringer; fikset med idempotent migrate deploy. Full arkiv m/commit-refs: `docs/claude/historikk-2026-07.md` § Prod-deploy 2026-07-27 (repo). Develop-only rader eldre enn 27.07 skal antas prod med mindre historikk-entryen sier annet.

## Nye backlog-saker (2026-08-13-runden — posisjonsmodell-restansen, kodeverifisert)
- **Steg-inngangen kollapser flyter (P1):** posisjonsmodellen er i prod (03.08, ruting teller ledd — flytFakta.ts:151-212/flytPosisjon.ts), men `steg` kan ikke settes fra noe UI: flytoppsett sender hardkodet `steg={1}` (dokumentflyt/page.tsx:869, 886), standardflyter seedes med steg 1 for begge roller (prosjekt.ts:515, 529) → alle nye flyter får én posisjon. Kun HMS-flyten setter steg eksplisitt. **MÅ fikses SAMMEN med `utledMinRolle`-klientporten** (avviser til «Lesevisning» når faggruppen verken er bestiller/utfører selv om serveren tillater via ballen) — ellers innfører steg-fiksen ny feil.
- **`ansvarsmerke` død kolonne:** vedtak 2026-07-31 (flytmodell-veileder § 2.6, frie boksnavn) er ikke bygget — kolonnen finnes i DokumentflytMedlem men leses aldri (api/web/mobil); visningsmerke avledes fortsatt av rollenavn.
- **Fire-boks-taket:** oppsett-UI lar hver rolle brukes én gang → maks fire flytbokser; strider mot vedtatt posisjons-/frinavnmodell.
- **Død kode-opprydding (ordre levert 2026-08-13,** `til-repo-2026-08-13-1015/ORDRE-dodkode-opprydding.md`**):** `verifiserFlytRolle` + `byggFaggruppeFilter` (null kallsteder, feilinformerte to lesere s.d.), dokumentflyt.md:29 motsier vedtak; sweep i domenet + regel: erstattet funksjon slettes i samme fase.
- UI-hint GeoReferanseEditor: 2-punkts eksakt fit kan ikke avdekke speilfeil — «verifiser med Min posisjon eller legg til 3. punkt».
- 🔴 **«Ingen lokasjon» finnes ikke som et valg (Kenneth-funn 2026-08-29).** `positionX`/
  `positionY` er null både når lokasjon *ikke er satt ennå* og når rapporten *bevisst gjelder
  hele byggeplassen*. Kenneth: *«dersom lokasjonsvelger alltid velges, da tar jeg bort
  muligheten å ikke ha med lokasjon i en rapport — noen ganger er det nyttig, da rapporten kan
  gjelde byggeplassen.»* Funnet stoppet ordren `relay/inbox-lokasjon-autoapne.md` (auto-åpne
  tegning ved manglende markering) — den er ⛔ ON HOLD til modellen er avklart, ellers ber
  systemet om en pin på dokumenter som ikke skal ha en. **Hører sammen med punktet under: dette
  er samme rot.** Fabels domene — begrepsavklaring før mer bygges.
- ✅ **AVKLART 2026-09-04 — vedtaksforslag levert:** [designnotat-lokasjonsmodellen](designnotat-lokasjonsmodellen-fabel-2026-09-04.md). Begrepssett (dokumentlokasjon / lokasjonstekst / feltpin / lokasjonsbryter) + nytt felt `lokasjonOmfang: "punkt" | "byggeplass" | null`. **Låser opp `inbox-lokasjon-autoapne.md`.**
  🔴 **Coworks premiss «rendres ubetinget» var STALE — verifisert av cowork 04.09:** sjekkliste-detalj gater allerede på `showLocation` (`dashbord/[prosjektId]/sjekklister/[sjekklisteId]/page.tsx:873-874`, `!== false`). **Oppgavesiden mangler gaten** — null treff på `showLocation` utenfor sjekkliste-detalj og malbyggeren. Paritetsfiks hører i ordren.
- **Begrepsforvirring «lokasjon» i malbyggeren:** TRE ulike ting bærer navnet — `ReportTemplate.showLocation` (fast felt, auto fra bygning/tegning) · `location`-rapportobjekt (ren tekst, prosjektadresse som fallback) · `drawing_position`-rapportobjekt (bærer `drawingId` + koordinater). Byggeplass ER lokasjonen: den eier tegningene (`Drawing.byggeplassId`) og har koordinater fra georeferert tegning. Fabels domene — begrepsavklaring før flere felt bygges.
- **Lokasjon/tegningspunkt — fire funn (prod 2026-08-13):** (1) dokumentsiden viser ikke valgt lokasjon etter lagring, mens utskriften gjør det (manglende query-invalidering) · (2) detaljutsnitt mangler — `RapportObjektVisning.tsx:550-554` har 3 s fallback-timer som setter `klar=true` UTEN detalj · (3) de to bildene skal stå side ved side, innzoomet til høyre · (4) tegning skal åpne automatisk ved ny sjekkliste når malen har lokasjonsfelt.
- **Værdata bør hentes fra byggeplassen:** `useAutoVaer.ts:58-64` bruker prosjektets koordinater. `Byggeplass.latitude/longitude` finnes. Et prosjekt kan strekke seg over kilometer; for en befaringsrapport er været på byggeplassen dokumentasjon.
- **`persons` skriver ut rå bruker-UUID-er:** `packages/pdf/src/felt.ts:101` — Kenneths prod-rapport viste `74730685-c6dd-…` under «Deltakere» i et dokument som gikk til byggherre.

## Nye backlog-saker (2026-07-27-runden)
- Legacy flyt-løse dokumenter viser handlinger uten flyt-posisjon (fabel-vurdering)
- «Venter på»-chip skal vises for faggruppe (fabel-avgjort)
- Flytvisning header-linjebrekk (kosmetisk)

## Prod-deploy 2026-08-28 (develop→main `5dcdeb58`, 60 commits + 2 migreringer)
Printmotor fase 1–4 m/oppfølgere · prosjektfilter-fiksen (rapporten lakk rader fra andre
prosjekter inn i fakturagrunnlaget — feil prosjekts timer til byggherre) · detaljvisning
på skjerm · mobil H8/H1/annotering-JPEG/D3/D4 + opprett-frysen. **TestFlight-bygg #46**
(`5605775d`) sendt samme runde. Prod-verifisert innlogget.

🔴 **Lærdom som endret deploy-rutinen:** `db-timer`-migreringen fra 11.08 var **aldri
kjørt mot prod** — releasenoten på `a8750601` sa «ingen migreringer», sant for
`packages/db` og usant for `db-timer`. Utleggskategori-siden var ødelagt i prod i to uker;
ingen meldte fra fordi timer ikke er i bruk der. **Ny regel: `migrate deploy` kjøres for
alle fire db-pakker ved hver deploy — ikke utledes fra diffen.**
([deploy-detaljer.md](../claude/deploy-detaljer.md))

## Prod-deploy 2026-08-28 nr. 2 (develop→main `ba234fd1`, 26 commits + 1 migrering)
Andre prod-deploy samme dag. REG fase 1 (ansatt-status-guard i 11 porter) · ansattvelger ·
fundament ut av gruppemodul-gatingen · tre slettevakter · deaktivert-på-dyplenke ·
`@xenova` fjernet. Migrering `20260828120000_organization_member_status` (additiv, default
`aktiv`). Prod-verifisert innlogget. Full arkiv m/commit-refs per spor:
`docs/claude/historikk-2026-08.md` § Prod-deploy 2026-08-28.

🔴 **Lærdom 1 — `deploy-prod.sh` lærte bort feil regel.** Skriptet printet migrate-linja
for kun `@sitedoc/db`, kommentert ut som «kun ved migreringer», og **etter** `up`. Det var
den linja som lot `db-timer`-migreringen ligge ukjørt i to uker. Rettet 28.08: alle fire
pakker, alltid, og **før** `up` — ny kode mot gammelt skjema gir 500 i vinduet mellom.
Regelen fantes allerede i [deploy-detaljer.md](../claude/deploy-detaljer.md); det som
manglet var at verktøyet håndhevet den.

🔴 **Lærdom 2 — statusfiler påsto «venter gate» om arbeid som var i prod.** Målt 28.08:
`git branch -r --no-merged origin/develop` returnerte **kun `origin/main`** — ingen branch
ventet på merge. Likevel sto rundt 20 innslag i STATUS-AKTUELT som «PÅ BRANCH, venter
Kenneths gate / Ingen prod», blant dem prosjektfilter-fiksen og printmotor 3+4. Samme
feilform tre ganger på én dag. Linje 100 i denne fila har halve regelen fra 27.07
(«develop-only rader eldre enn 27.07 skal antas prod»); den er nå generell:
**tilstand måles mot git, ikke leses av en statuslinje.**

## 📊 Lukket denne uken

🔴 **Tallet som gjør drift synlig.** Føres av cowork ved hver merge som lukker et
masterplan-punkt. Er linjen tom en hel uke, kjører vi reaktivt uten å vite det.

| Uke | Lukket | Merget totalt | Kommentar |
|---|---|---|---|
| 30.–31.08 | **3** — REG fase 2 · O12 · modul-resolver | 9 | Seks av ni var feltfunn, en regresjon vi selv innførte, og opprydding. Utløste [arbeidsform-vedtaket](../claude/SAMARBEIDSREGLER.md) om plan-spor vs funn-spor |
| 01.09 | **5** — modulhierarki steg 3 (flatespeiling, gatet på test) · steg 4 (dok-sync) · mobil modulgating · kvalitetssikring **lag 3** (api i CI-gaten) · flateparitet-vedtaket | 6 | 🟢 **Første dag der plan-sporet vant.** Fem av seks merger lukket planarbeid; kun én var feltfunn (🔴 mobilen skjulte dokumenter via et byggeplass-filter uten av-knapp). Motsatt fordeling av 31.08 — arbeidsformen virket etter én dag. **Modulhierarkiet er lukket på web og mobil**; underbrytere + unntaksliste gjenstår som egne runder. **`apps/api` gater nå CI** (27 filer, 269 tester) etter å ha vært usynlig for pipelinen |

## Neste konkrete steg (justert 2026-08-28)
1. ✅ **Registrerings-sporet er gatet og i prod** (`ba234fd1`, 28.08) — deaktivering,
   tilgangstap og reaktivering verifisert av Kenneth på test før release
2. ✅ **ON-ordren er omskrevet og frigitt 2026-09-01** — `relay/inbox-firma-onboarding.md`,
   branch `feat/firma-onboarding`. ⛔-en er hevet: firmanivået den ventet på ble avklart da
   modulhierarkiet ble lukket samme dag (steg 2–4 + mobil modulgating).

   **Ny måling snudde ordren i vår favør:** den generiske veiviser-modellen finnes allerede
   (`apps/web/src/lib/onboarding-wizard.ts:17-59` — `OnboardingSteg<TStatus>`,
   `OnboardingWizardConfig<TStatus>`, `førsteUfullførteSteg`, `erOnboardingFullført`), skrevet
   for gjenbruk. Timer-veiviseren er den fungerende instansen. Oppgaven er derfor å plugge inn
   en firma-config + status-query + side — ikke å bygge onboarding.

   🔴 **Fella ordren fencer:** `count() > 0` er feil ferdig-predikat på firmanivå.
   `OrganizationSeedPolicy` (`schema.prisma:148-164`) finnes fordi «aldri onboardet» og «har
   bevisst egen katalog» er identiske i data.

   ~~⛔ Gammel tekst (beholdt så begrunnelsen ikke går tapt): ON-ordren skal IKKE relayes slik
   den står (cowork 2026-08-30) — den bygde på at onboarding-panelet manglet; målingen viser at
   det finnes og konsumeres (`[prosjektId]/page.tsx:119-214`). Cowork gatet ordren uten å greppe
   etter panelets konsument.~~
3. **Relay fabel-notatene som ligger usendt:** arkivering framfor nedlasting (PR-sporet) ·
   `fabel-nav-gating-modellen.md` · `fabel-eksport-arkivering.md` ·
   `fabel-o12-gating-avvik.md` (2026-08-30) · `fabel-firmanivaaet-mangler-styring.md` (2026-08-30)
4. **Reconciler AM 1 mot referatet** før AM 2–4 ordres — mobil D-serien dekket deler av
   timer-buggene, og å ordre det på nytt ville vært en runde bortkastet
5. **Sikkerhet, pakke D:** `page.route`-abort i pdf-render (én linje, egen gatet deploy —
   containeren deles med test). 🔵 Tre andre punkter venter bevisst på serverflyttingen
   ~okt 2026, som lukker dem gratis — men **flyttingen må bære dem**, ellers gjenskapes
   det flate nettet på ny maskin ([sikkerhet.md](../claude/sikkerhet.md))
6. Fabel: de tre backlog-sakene fra 27.07 + N3-utrutede saker (G1-mutere,
   opprett→usynlig, HMS-synlighet)
7. Fabel/Kenneth: redesign-sesjon prosjekt- vs firma-innstillinger + API-nøkkel-UI
   (Kenneth-vedtak 2026-07-15: sikkerhet trumfer bekvemmelighet — env-nøkler vises kun
   som status; UI-redigering kun der DB-lagring er trygt. Krever nå-rapport)

   🔴 **Scope utvidet 2026-08-30 (fabel) — sesjonen omfatter nå også:**
   - **FL — prosjekt-livssyklus på firmanivå** (se FL-raden i del-oversikten). Coworks
     spørsmål «hører livssyklusen hjemme i firmalisten, i prosjektoppsettet, eller begge?»
     og «skal `deactivated` i det hele tatt være en kundekontroll?» besvares her.
   - **Firmanivå-onboarding.** ON-panelet svarer «hva mangler i *dette prosjektet*»
     (`prosjekt.hentOnboardingStatus`, `prosjekt.ts:207-277` — ren konfigurasjonsstatus for
     ett prosjekt). Et nytt firma spør «hva gjør jeg nå». `kom-i-gang` besvarer det, men er
     **kun nåbar via redirect fra `/dashbord` ved null prosjekter** (`dashbord/page.tsx:64`)
     — «arbeidsflate uten nav-hjem» så snart firmaet har ett prosjekt (`dype-sider.tsx:4,27`).
     Henger på **K8 (UTSATT**, 1a-huben notert som naturlig hjem): sesjonen avgjør om
     `kom-i-gang` får nav-hjem nå, eller om K8 gjenåpnes.

   **Designnotat kommer fra sesjonen, ikke før.** Cowork skriver ingen ordre på FL eller
   firmanivå-onboarding i mellomtiden.
8. Redesign BACKLOG: `oppsett/layout.tsx` delt DATAKILDE for native sidemeny ·
   F-e-interaktiv (fabel-gate før koding) · del 5 D5 konto-lagring (cowork DDL-gate) ·
   geofence-indikator `f1a5318d`+`6af205a8` (åpen siden 27.07)

## Vedtak som binder designet
- 🔴 **Sjekklister, Oppgaver og Tegninger er FUNDAMENT — aldri tilvalg** (Kenneth
  2026-08-28): *«sjekklister og oppgaver skal alltid være en del av prosjekt — uten dette
  faller grunnlaget bort. Tegninger er også automatisk en del av grunnlaget. 3D skal være
  ekstra feature.»* Kodet i `sidebar-elementer.tsx` (`ba234fd1`): `kreverGruppemodul`
  fjernet fra de tre, **3D beholder sin**. ⚠️ Merk at `redesign-handoff.md:57` lister
  `kreverGruppemodul` under «sidebar-funksjoner som må overleve» — den føringen er
  overstyrt her, ikke brutt i vanvare. Konsekvens: gate-systemet har én bruker igjen,
  som er en av grunnene til spørsmålet i del 8.
- Amber = FIRMA (inkl. Maskin, Kompetanse, Ansatte), blå = PROSJEKT — låst og kodet i del 5 (runde 3)
- Sidebar = arbeidsflater, konfig = hub-kort (K5)
- K-beslutninger: `design_handoff_navigasjon_redesign/K-BESLUTNINGER.md`
