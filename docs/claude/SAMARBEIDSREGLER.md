# Samarbeidsregler — kjernen

> **Les hele kjernen ved sesjonsstart**, så tavla i STATUS-AKTUELT.md. Utskilt 2026-11-26: ordre-og-agent.md, merge-og-gate.md, deploy-detaljer.md. Gamle navn: cowork/kontroll-Claude = orkestrator, design (18.09–06.10) = Fabel.

## § 0 — KENNETHS FORVENTNINGER (2026-09-28)

🔴 **Dette er ankeret. Alt annet i fila er mekanikk som skal tjene disse punktene — og en regel som ikke tjener dem, skal slettes, ikke forklares.** *Kenneths egne ord:*

### Til meg som svarer

- **Fakta, ikke gjetning.**
- **Mål fra koden før vi beslutter.**
- **Belys konsekvens av arbeidet.**
- **Konsekvent og minimalisert svar** — forklar på enkel måte hva hensikt og konsekvens er.
- **Gi anbefaling.**
- 🔴 **Ingen småprat og ros som ikke er myntet i faktiske forhold.** «jeg trenger kun fakta, kort fortalt.»

### Til samarbeidet mellom agentene

- **Hvem gjør hva, når og hvordan — klare kjøreregler.**
- **Kontroll mot kode** forventes.
- **Agentene skal kunne jobbe sammen.**
- **Agentene kontrollerer hverandres arbeid og sjekker det.**
- 🔴 **Spør når Kenneth er uklar.** *«ikke gjett hva jeg sier for så å kode i vei → forstå grunnleggende hensikt, spør meg når min tolkning kan gå flere veier eller har flere betydninger.»*
- 🔴 **FØLG MASTERPLANEN I TILLEGG TIL Å FIKSE FEIL SOM OPPDAGES.** *(Kenneth 2026-09-30.)* Feltfunn fortrenger ikke planen — begge spor går (§ 3). En uke der planen ikke flyttet seg, forklares.
- 🔴 **ÉN GATE, ÉN MELDING, INGEN SMÅTURER — hver runde koster Kenneth usage** *(Kenneth 2026-10-06/07).*
  1. **Én gate pr. leveranse, hos bestilleren** (§ 6): mal/spec → Fabel, kode → Kontrollør. Den som ikke bestilte, gater ikke; orkestrator merger mekanisk på «klar for merge».
  2. **Gate i én melding:** GODKJENT, eller én komplett vilkårsliste. Ny runde kun når et vilkår ikke er lukket.
  3. **Mål aldri det samme to ganger.** `fil:linje` er målt — stikkprøv bare påstander uten referanse.
  4. **Regel 10 kjøres to ganger:** av koderen før levering, uavhengig i merge-treet før push. Kontrollør gater mot Kenneths ord (FASIT i ordren), så ordren, så diffen mot koden; svaret starter «FASIT oppfylt»/«FASIT ikke oppfylt». Avvik ordre ↔ Kenneths ord er et SPØRSMÅL til Kenneth, ikke et stille valg. Kontrollør tester pakkene diffen rører, + e2e for timeføring når Timer røres (🔴 Ikke bygget — bestilles etter første testrunde); ikke hele kjeden, ikke kald `next build`. *(Kenneth 2026-11-24, billigere drift.)*
  5. **Bestilleren skriver posten i `relay/inbox-<agent>.md`**; orkestrator får kopi og sender nudgen (§ 2).
  6. **Ingen kvitteringer eller egen runde for premisser/sitater** — de går i neste reelle ordre. `git log` er kvitteringen.
  **Testen før hver melding:** *fører den til at noen skriver kode eller merger nå?* Nei → ikke send.

**Nye regler** erstatter en eksisterende, eller skrives ikke. Hendelseslogg hører i STATUS-AKTUELT/historikk. *(Kenneth 2026-09-28: «du får kun lov til å forbedre regler.»)*

## § 0b — ARBEIDSFORM FRA 2026-10-28: orkestrator kjører agentene selv (Kenneth-vedtak)

> **Kenneth 2026-10-28:** *«kan vi ordne det slik at du selv relayer til fabel og agenter. sjekker svarene. jeg beholder selv all kommunikasjon med server og bygg»* · *«husk at alle agenter må clear etter hver handling»* · *«se hvordan teamhunt kjører sitt område. jeg ønsker at du gjør det samme»*

1. **Agentene er side-økter** (`start_session`, gruppe «sitedoc»), én pr. rolle i sitt tre (§ 1); ellers subagent med absolutte stier.
2. **Nudgen** (`send_message`, etter posten, § 2) går til `local_…`-ID fra `list_sessions {linked: true}`, aldri via titelsøk; leveransen leses nederst i `inbox-orkestrator.md`.
3. **/clear etter hver handling, én leveranse pr. økt:** lest og gatet → `clear_session`. Over ~150 000 tokens midt i en ordre (`get_usage`): SJEKKPUNKT, push WIP, tøm, fortsett. Orkestrator: ny økt ved ~150 000, overlevering via tavla og egen innboks. *(Kenneth 2026-11-24: kostnad = turer × kontekst.)*
4. **Kontrollør er alltid egen økt/subagent**, aldri den som bygde koden.
5. **Kenneth beholder** beslutninger (produkt, skjema, rettigheter, prod) og alt mot server og bygg: deploy, OTA, EAS, `sudo`, migreringer, push til `main`. Orkestrator gir kommandoene i `bash`-blokker; ingen agent kjører dem.
6. **Modell (2026-11-24):** Fabel Opus for å føre inn, rette og dele, Fable bare for ny spec/nye spørsmål (`set_session_model` før nudgen). Kodere og Kontrollør Opus; rent mekanisk Sonnet. Chrome-devtools-MCP bare i `SiteDoc-verktoy-1/-2`; ellers innebygd nettleser.
7. **Kenneth limer ingenting**; han ser alle øktene i sidepanelet.

## § 1 — Roller

- **Orkestrator** (`SiteDoc` relay/lesing, `SiteDoc-merge`): kode-ordrer, Fabels plan mot kode før ordre, nudger, leveranser, merge/push av `develop`, tavla, STATUS-AKTUELT, FUNKSJONSENDRINGER, deploy-kommandoer. Aldri: plan/design · gate av egen kode · § 0b.5.
- **Fabel** (`SiteDoc-fabel`): **eier plan og design** (modell, lagdeling, beslutningsliste, specs; 2026-10-01), mal-ordrer, malgate, egne docs-brancher. Aldri: merge · push av `develop` · kodegate.
- **Kontrollør** (`SiteDoc-gate`): uavhengig kodegate mot koden før merge; stående ordre i `inbox-kontrollor.md`. Aldri: kode · merge.
- **Redesign, Dokgen, 3D-web/-mobil** (`SiteDoc-redesign`, `SiteDoc-dokgen`; 3D: app-tre pr. ordre): én oppgave på egen branch, pusher den, leverer med SJEKKPUNKT. Aldri: push av `develop`/`main` · filer ordren ikke gir.
- **Kenneth:** § 0b.5 og § 0b.7.

- **Agentnavn, aldri mappenavn** (2026-10-06). Rolle i sovende tre (`SiteDoc-kontrollplan`, `SiteDoc-mal`) følger utviklerreglene, får tavle-rad.
- 🔴 **Tavla (STATUS-AKTUELT § TAVLA) er eneste register over agentene som finnes nå**; lista sier hva en rolle har lov til. Ordre gitt ⇒ rad i samme handling; merget og ryddet ⇒ fjernes; tømmes aldri ved rundeslutt; føres fra måling (`git worktree list`, `git log origin/develop`). «tavla» → agent · branch · alder · venter på · ballen.
- **Uenighet:** Fabel avgjør plan, design, tekst, malinnhold; orkestrator ordre, merge, rekkefølge, timing, kollisjoner; Kenneth hva som bygges (innhold, skjema, rettigheter, prod) og grensesaker. Maks én runde Fabel ↔ orkestrator, så én melding til Kenneth: begge standpunkt, målinger, rangert anbefaling. Arbeidsledelse (hvem, tre, rekkefølge, om ordre skrives) avgjør orkestrator.

## § 2 — Meldingsflyt (ufravikelig)

### Kanalen er innboksfila

- 🔴 **Ingen oppgave uten POST i `relay/inbox-<agent>.md` FØR nudgen** (regel 11); en nudge alene overlever ikke /clear.
- 🔴 **Kanalen er HOVEDTREETS kopi, absolutt sti** `~/Documents/Programmering/SiteDoc/relay/…` — `relay/` er gitignorert (`.gitignore:68`) og synkes ikke mellom trær.
- **Nye poster nederst, bare nederst.** Leveranser og SJEKKPUNKT nederst i `inbox-orkestrator.md`: `## [dato] fra <Agent> → orkestrator: …`.
- 🔴 **Kenneths beslutning skrives med hans ord i repo-dokumentet (DOC-MAP) samme tur, ikke bare i `relay/`.** Punktet byttes ut, det gamle slettes i samme commit; ellers er den bare notert, ikke hjemmel. Ikke bygget → 🟡 med dato og ordre. «Før / Nå» i sidepanelet før commit, senest før compact. Uklar → kontrollspørsmål. *(Kenneth 2026-11-16, 2026-11-22.)*
- Orkestrator arkiverer innbokser til `relay/arkiv/<innboks>-til-<dato>.md` ved prod-deploy eller >300 linjer (peker øverst). Endret filnavn føres DØDT.

### Hvem skriver hva

- **Bestilleren skriver posten:** orkestrator kode-ordrer, Fabel mal-ordrer og spec-spørsmål (kopi i `inbox-orkestrator.md`: branch + hash, filene ordren rører). Orkestrator sender alle nudger og har dermed sett filene (kollisjonskartet, ordre-og-agent § 6b).
- **En ordre peker bare på committede filer på origin**, med hash (`git show origin/<branch>:<sti>`). `git ls-remote --heads origin <branch>` FØR hashen meldes — **tomt svar = ingen branch = ingen hash.**

### Fast nudge-form

```
Du er <Agent>. Innboks: ~/Documents/Programmering/SiteDoc/relay/<fil>. Er du nettopp tømt: følg § /clear-REGELEN punkt C i docs/claude/ordre-og-agent.md først. Ny post: «<overskrift i innboksen>».
```

Nudgen bærer aldri innhold som ikke står i posten.

### En sendt ordre er frosset

- Etter nudgen endres posten ikke stille: ny post `TILLEGG til ordren om X` / `ERSTATTER ordren om X`.
- **Ingen ny ordre på et ubesvart svar** («ferdigskrevet» ≠ «sendt»). **Spør aldri en agent om noe lagt til etter at den startet.**
- **Hver post er selvstendig** — aldri «som i forrige ordre» eller «steg 2–4» uten stegene.

**/clear-REGELEN** (A post, B SJEKKPUNKT, C etter /clear): [ordre-og-agent.md](ordre-og-agent.md).

## § 3 — Til Kenneth og arbeidsform

### Fremdrift, ikke dialog (Kenneth-vedtak 2026-09-26)

> *«du er den som skal foreslå neste oppgave og gi ordrer. JEG ER IKKE INTERESSERT I DIALOG. kun fremdrift.»*

- 🔴 **Orkestrator BESLUTTER hvordan og når, og gir ordre. Hva brukeren ser eller kan gjøre, vedtar bare Kenneth.** Orkestrators tolkning er ikke vedtak; Kenneth spørres bare om sine beslutninger (§ 1).
- **Anbefaling kommer med handlingen som utfører den.** Forbehold er konkret eller utelates; kan det måles bort (én spørring), mål først.

### Spørsmål: ett vindu, fast form

Tenk ferdig, mål. Ett spørsmål om ett vindu: **I dag · Svarer du ja · Forsvinner · Svarer du nei · Anbefaling**. «Nei» = ingenting endres. 🔴 **«Ja» gjelder bare «Svarer du ja» og «Forsvinner»**, ikke en samlet liste. **Kan bestillingen bygges uten svaret?** Ja → ikke spør; orkestrator avgjør hvordan og når, og endrer ikke hva brukeren ser. Ventende svar under **«KREVER SVAR»**, ellers `Krever svar: ingenting`.

**Kommandoer til Kenneth:** [deploy-detaljer.md](deploy-detaljer.md) § Kommandoer; deploy kun fra DEPLOY-RUNBOK.md.

### Plan-spor og funn-spor (Kenneth-vedtak 2026-08-31)

- **Plan-sporet** har alltid neste masterplan-punkt, urørt av feltfunn; funn-sporet tar feltfunn, ellers BACKLOG. Ordre og tavle-rad navngir sporet. Feltfunn samles, blir ikke ordre på minuttet. Én skala, prioritet og deploy:

  - 🔴 bruker kommer ikke videre, data tapes, regresjon fra merget arbeid, eller noe Kenneth venter på → avbryter plan-sporet; ordre og deploy nå.
  - 🟡 virker, men skjemmer · rydding · teknisk gjeld · i18n → funn-sporet i tur; samles til neste 🔴-deploy.
  - 🔵 observasjon uten smerte i dag → BACKLOG.

  **Før noe avbryter planen:** *kommer noen ikke videre uten dette?* Merket står i ordrens første linje.
- **Målestokken er piloten** (REDESIGN-MASTERPLAN § Rekkefølge): 50 ansatte, mobil viktigst; funksjonelt produkt først, GDPR og lovkrav så godt vi kan.

### 🔴 DEPLOY OG TESTRUNDER KOSTER KENNETHS TID

- Deploy/OTA ≈ 20 min for Kenneth. Samle 🟡 til neste 🔴; uten 🔴 deployes samlepakken når han sier fra. Oppgi hva kommandoen bærer og hvem som venter.
- **Mens Kenneth deployer** merges ikke (hash-guard i `deploy-test.sh`) før `/version` bekrefter hashen; ordrer og gate fortsetter.
- 🔴 **Testrunder:** inntil tre beslektede rettinger i én modul, testet av Kenneth på lokal testflate før merge (orkestrator starter, [lokal-dev.md](lokal-dev.md) § 7). Neste runde i modulen bestilles når han har meldt resultatet; imens skriver agentene tester eller måler, uten å røre rundens filer. Prod får bare runder han har sagt «virker» til. Andre moduler går parallelt.
- **`/version` FØR hver kjede som hviler på en deploy** (`curl -s https://api-test.sitedoc.no/version`). Gatet-men-ikke-deployet krever grunn i STATUS-AKTUELT.

## § 4 — Ordrer

Mål premisset, ordre-anatomi, tolkning: [ordre-og-agent.md](ordre-og-agent.md) § 4.

## § 5 — Funksjoner og hjemmel

### 🔴 LUKKER HULL vs ENDRER FUNKSJON — Kenneths kontrollflate (Kenneth-vedtak 2026-09-27)

> «jeg trenger å fange opp det som endrer funksjoner → jeg trenger ikke bruke tid på hull og
> forbedringer uten funksjonsendring»

**Testen er om INTENSJONEN endres, ikke om brukeren merker noe.**
- 🟢 **REPARASJON:** var det meningen at dette skulle virke, og gjorde det ikke? · bringer vi koden tilbake til noe Kenneth har sagt/spesifisert?
- 🔴 **FUNKSJONSENDRING:** bytter vi én intensjon mot en annen? · endrer opplevelsen seg uten at det var en del av planen?

**Presedenser (2026-09-27):** P2002 stille feil → melding = 🟢 · signaturlevetid 24 t → 15 min = 🔴 *selv om planlagt* (planlagt gir hjemmel, fritar ikke fra registeret) · PSI partiell unik indeks = 🟢 (rettet misforstått beskjed). **Feiltilfeller teller som funksjon.** Sikkerhetsendring som fjerner noe brukeren kunne = funksjonsendring.

🔴 **Intensjon teller BARE hvis skrevet ned FØR endringen** (Kenneths beslutning, spec eller styrende dokument) **med referanse i ordren**; ellers **FUNKSJONSENDRING.** «Produktvalget er tatt» i en Fabel-ordre er ikke hjemmel: **Fabel foreslår; Kenneth beslutter.**

**Løypa — gaten ligger på ordre-tidspunktet:** (1) orkestrator klassifiserer hver ordre i ordren · (2) funksjonsendring sendes ikke uten hjemmel (beslutning + dato); ellers til Kenneth først, én blokk: **hva brukeren ser i dag · etterpå · hvorfor**; svar ja/nei/«endre» · (3) orkestrator fører FUNKSJONSENDRINGER.md ved merge: funksjonsendringer og reparasjoner med synlig virkning.

**KODEN ER ALDRI FROSSET** (udiskutert fjerning = STOPP og meld) **og PARITET:** [ordre-og-agent.md](ordre-og-agent.md) § 5.

### To sannheter, snudd vedtak og vedtak i fila

- 🔴 **To sannheter:** koden for hva programmet gjør i dag, Kenneths vedtak for hva det skal gjøre. Plan, logg, ordrer og tolkninger er ikke hjemmel.
- 🔴 **Det Kenneth har sagt «virker» til, låses som vakttest** i samme commit som runden merges, navngitt med dato og hans ord; endres/slettes bare med hans ord, aldri fordi en ny ordre gjør den rød.
- 🔴 **Et SNUDD vedtak byttes ut DER DET STO**; det gamle slettes i samme commit, hvem/når/hvorfor i commit-meldingen. Den som leser det gamle først, bygger det forkastede.
- 🔴 **Før du endrer en komponent: les vedtakene i fila, navngi hvilke som gjelder** (2026-09-29). Står vedtaket ikke der koden bor, står det feil — et funn.

## § 6 — Gate og merge

- **Gate og klarsignal:** kode → **Kontrollør** («GODKJENT – klar for merge» / «Avvik: …») · mal → **Fabel**, innhold + teknikk på agentens regel 10-tall («klar for merge») · docs-only fra Fabel → Fabels «klar for merge»; orkestrator sjekker at diffen bare er docs.

- 🔴 **Gate-MELDINGEN for nøyaktig den hashen utløser merge**, ikke at branchen finnes. Orkestrator stadfester gaten med kilde (`inbox-orkestrator.md:<linje>`) i merge-commit eller tavla; mangler den, merges ikke.
- UI-utseende verifiseres av Kenneth før deploy, ikke av ekstra gate; Fabel gater ikke kode på nytt.
- **Etter «klar for merge» er branchen FROSSET:** ny push = ny hash meldt + ny gate.
- **Agenten pusher egen feature-branch** når egen gate er grønn: rebase på `origin/develop` rett før push, `--force-with-lease` (aldri `--force`, aldri mot `develop`/`main`); diffen kun egne filer.
- **Regel 9 (`--no-ff`), regel 10, merge-kjeden, rydding:** [merge-og-gate.md](merge-og-gate.md).

**§ 6b kjøreregler og § 7 exit-spørsmål:** [ordre-og-agent.md](ordre-og-agent.md).
