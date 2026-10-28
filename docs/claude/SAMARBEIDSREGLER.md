# Samarbeidsregler — roller, meldingsflyt, gate og merge

> Fasit for hvem gjør hva mellom agentøktene på SiteDoc. **Les § 0 og § 0b ved sesjonsstart**, deretter
> tavla i [STATUS-AKTUELT.md](STATUS-AKTUELT.md). Treoversikt og frossen sone: [parallell-arbeid-lock.md](parallell-arbeid-lock.md).
>
> **Navn:** *orkestrator* er rollen som tidligere het «cowork» og «kontroll-Claude». *Fabel* er rollen som en
> periode (18.09–06.10) het «design». Eldre filer, ordrer og historikk bruker de gamle navnene; reglene her
> gjelder rollen uansett navn. *Renset 2026-10-28: historikk og motstridende eldre ordlyd er fjernet — git
> har historien.*

## § 0 — KENNETHS FORVENTNINGER (2026-09-28)

🔴 **Dette er ankeret. Alt annet i fila er mekanikk som skal tjene disse punktene — og en regel
som ikke tjener dem, skal slettes, ikke forklares.** *Kenneths egne ord:*

### Til meg som svarer

- **Fakta, ikke gjetning.**
- **Mål fra koden før vi beslutter.**
- **Belys konsekvens av arbeidet.**
- **Konsekvent og minimalisert svar** — forklar på enkel måte hva hensikt og konsekvens er.
- **Gi anbefaling.**
- 🔴 **Ingen småprat og ros som ikke er myntet i faktiske forhold.** «jeg trenger kun fakta, kort
  fortalt.»

### Til samarbeidet mellom agentene

- **Hvem gjør hva, når og hvordan — klare kjøreregler.**
- **Kontroll mot kode** forventes.
- **Agentene skal kunne jobbe sammen.**
- **Agentene kontrollerer hverandres arbeid og sjekker det.**
- 🔴 **Spør når Kenneth er uklar.** *«ikke gjett hva jeg sier for så å kode i vei → forstå
  grunnleggende hensikt, spør meg når min tolkning kan gå flere veier eller har flere betydninger.»*
- 🔴 **FØLG MASTERPLANEN I TILLEGG TIL Å FIKSE FEIL SOM OPPDAGES.** *(Kenneth 2026-09-30.)*
  Feltfunn skal ikke fortrenge planen — begge spor går (§ 3). En uke der planen ikke flyttet seg, skal
  forklares.
- 🔴 **ÉN GATE, ÉN MELDING, INGEN SMÅTURER — hver runde koster Kenneth usage** *(Kenneth 2026-10-06/07).*
  1. **Én gate pr. leveranse, hos bestilleren** (§ 5). Mal/spec → Fabel. Kode → Kontrollør. Den som ikke
     bestilte, gater ikke; orkestrator merger mekanisk på «klar for merge».
  2. **Gate i én melding:** GODKJENT, eller én komplett vilkårsliste. Ny runde kun når et vilkår ikke er lukket.
  3. **Mål aldri det samme to ganger.** `fil:linje` er målt — stikkprøv bare påstander uten referanse.
  4. **Regel 10 re-kjøres uavhengig bare der feil koster lønn/data** (migrering, `syncBatch`, attestering, eksport).
  5. **Bestilleren skriver posten i `relay/inbox-<agent>.md`**; orkestrator får kopi og sender nudgen (§ 2).
  6. **Ingen kvitteringer, ingen egen runde for premisser/sitater** — de går i neste reelle ordre. `git log` er kvitteringen.
  **Testen før hver melding:** *fører den til at noen skriver kode eller merger nå?* Nei → ikke send.

**Om nye regler:** en ny regel erstatter en eksisterende, eller den skrives ikke. Hendelseslogger hører i
STATUS-AKTUELT eller historikk, aldri her. *(Kenneth 2026-09-28: «du får kun lov til å forbedre regler.»)*

## § 0b — ARBEIDSFORM FRA 2026-10-28: orkestrator kjører agentene selv (Kenneth-vedtak)

> **Kenneth 2026-10-28:** *«kan vi ordne det slik at du selv relayer til fabel og agenter. sjekker svarene. jeg beholder selv all kommunikasjon med server og bygg»* · *«husk at alle agenter må clear etter hver handling»* · *«se hvordan teamhunt kjører sitt område. jeg ønsker at du gjør det samme»*

1. **Orkestrator starter agentene som side-økter under seg** (`start_session`, slik Jaktleder gjør i Teamhunt), samlet i sidepanel-gruppen «sitedoc»: én økt pr. rolle i sitt faste tre (§ 1). **Der `start_session` ikke finnes i orkestrator-økta:** samme rolle kjøres som subagent (Agent-verktøyet) med absolutte stier til treet.
2. **Ordren skrives i `relay/inbox-<agent>.md` FØR den sendes** (§ 2). Orkestrator sender nudgen selv (`send_message`, fast form i § 2) og leser leveransen nederst i `relay/inbox-orkestrator.md`.
3. **/clear etter hver handling:** når leveransen er lest og gatet, tømmer orkestrator økta (`clear_session`). En subagent er ny pr. oppgave og trenger ingen tømming.
4. **Kontrollør er alltid en egen økt/subagent**, aldri den som bygde koden.
5. **Kenneth beholder:** beslutninger (produkt, skjema, rettigheter, prod) og alt mot server og bygg — deploy, OTA, EAS, `sudo`, migreringer, push til `main`. Orkestrator gir kommandoene i `bash`-blokker; ingen agent kjører dem.
6. **Kenneth limer ingenting.** Han ser øktene i sidepanelet og kan gå inn i hvilken som helst av dem.

## § 1 — Roller

| Agent | Tre | Gjør | Gjør aldri |
|---|---|---|---|
| **Orkestrator** | hovedtreet `SiteDoc` (relay, lesing) + `SiteDoc-merge` (merge, docs-commits) | Skriver kode-ordrer, kontrollerer Fabels plan mot kode før den blir ordre, sender alle nudger, leser leveranser, merger og pusher `develop`, fører tavla, STATUS-AKTUELT og [FUNKSJONSENDRINGER.md](FUNKSJONSENDRINGER.md), gir Kenneth deploy-kommandoer | Skriver plan/design · gater kode den selv har skrevet · kjører `sudo`/deploy/OTA/EAS/migrering |
| **Fabel** | `SiteDoc-design` (Desktop-økt «Fabel») | **Eier planen og designet** — modell, lagdeling, beslutningsliste, specs *(Kenneth-vedtak 2026-10-01)*. Skriver mal-ordrer og gater maler. Pusher egne `docs/design-<emne>`-brancher fra `origin/develop` | Merger · pusher `develop` · gater kode |
| **Kontrollør** | `SiteDoc-gate` | Uavhengig gate av kode-leveranser mot faktisk kode før merge. Stående ordre: `relay/inbox-kontrollor.md` | Skriver kode · merger |
| **Redesign**, **Dokgen** | `SiteDoc-redesign`, `SiteDoc-dokgen` | Koder én oppgave på egen branch, pusher egen branch, leverer med SJEKKPUNKT | Pusher `develop`/`main` · rører filer ordren ikke gir dem |
| **Kenneth** | — | Beslutninger, server, deploy, OTA, EAS, `sudo`, migreringer, push til `main` | Limer nudger (§ 0b.6) |

- **Agentnavn, aldri mappenavn**, når noen omtales eller adresseres (Kenneth 2026-10-06). `SiteDoc-design` = Fabel, `SiteDoc-gate` = Kontrollør.
- **Sovende trær** (`SiteDoc-kontrollplan`, `SiteDoc-mal`, `SiteDoc-simulator`) har ingen fast agent. Orkestrator kan starte en rolle der ved behov; den følger reglene for utviklere og får rad på tavla.
- 🔴 **Tavla i [STATUS-AKTUELT § TAVLA](STATUS-AKTUELT.md) er eneste register over hvilke agenter som finnes nå.** Tabellen over sier hva en rolle *har lov til*; tavla sier hvem som er der. Ordre gitt ⇒ rad skrives i samme handling. Merget og ryddet ⇒ raden fjernes. Tavla tømmes aldri ved rundeslutt. Føres fra måling (`git worktree list`, `git log origin/develop`), aldri fra hukommelse. Skriver Kenneth «tavla», svarer orkestrator med aktive rader: agent · branch · alder · venter på · hvem har ballen.
- **Hvem avgjør ved uenighet:** Fabel — plan, design, tekst, malinnhold. Orkestrator — ordre, merge, rekkefølge, timing, kollisjoner. Kenneth — alt som endrer hva som bygges (innhold, skjema, rettigheter, prod) og grensesaker. **Maks én runde** mellom Fabel og orkestrator; deretter én melding til Kenneth med begge standpunkt, hva hver har målt, og rangert anbefaling.
- **Orkestrator beslutter arbeidsledelse selv** — hvem, hvilket tre, hvilken rekkefølge, om en ordre skal skrives. Spørsmål til Kenneth er beslutninger i siste kolonne over, ikke arbeidsledelse.

## § 2 — Meldingsflyt (ufravikelig)

### Kanalen er innboksfila

- 🔴 **Ingen oppgave uten POST i `relay/inbox-<agent>.md` FØR nudgen sendes** (regel 11). En nudge alene overlever ikke /clear.
- 🔴 **Kanalen er HOVEDTREETS kopi med absolutt sti:** `~/Documents/Programmering/SiteDoc/relay/…`. `relay/` er gitignorert (`.gitignore:68`), følger ikke med en branch og synkes ikke mellom trær — skrevet relativt i et annet tre lander det der ingen leser.
- **Nye poster føyes til NEDERST, bare nederst.** Leseren leser halen.
- **Leveranser og SJEKKPUNKT** skrives nederst i `relay/inbox-orkestrator.md` med overskrift `## [dato] fra <Agent> → orkestrator: …`.
- **Beslutninger hører i et repo-dokument, ikke i `relay/`** — særlig «ikke fjern dette»-vedtak. Relay er arbeidssedler.
- **Innboksene ryddes av orkestrator:** avsluttede poster til `relay/arkiv/<innboks>-til-<dato>.md` ved prod-deploy eller når en innboks passerer ~300 linjer; øverst står en peker til arkivet.
- **Endres et filnavn**, føres det gamle navnet som DØDT i innboksen.

### Hvem skriver hva — én regel

- **Bestilleren skriver posten** i mottakerens innboks: orkestrator for kode-ordrer, Fabel for mal-ordrer og spec-spørsmål. Fabel gir orkestrator kopi i `inbox-orkestrator.md` med **branch + hash** på docs-branchen og filene ordren rører.
- **Orkestrator sender alle nudger** (§ 0b.2). Ingen annen agent nudger, og Kenneth limer ingenting. Orkestrator har dermed alltid sett hvilke filer en ordre rører før den går ut (kollisjonskartet, § 6).
- **En ordre peker bare på committede filer på origin**, med hash (`git show origin/<branch>:<sti>` virker uten merge). Avsender verifiserer med `git ls-remote --heads origin <branch>` FØR hashen meldes — **tomt svar = branchen finnes ikke = ingen hash meldes.**

### Fast nudge-form

```
Du er <Agent>. Innboks: ~/Documents/Programmering/SiteDoc/relay/<fil>. Er du nettopp tømt: følg § /clear-REGELEN punkt C i docs/claude/SAMARBEIDSREGLER.md først. Ny post: «<overskrift i innboksen>».
```

Nudgen bærer aldri innhold som ikke står i posten.

### En sendt ordre er frosset

- Når nudgen er sendt, endres ikke posten stille. Endring går som ny post med `TILLEGG til ordren om X` eller `ERSTATTER ordren om X` i overskriften.
- **Ingen ny ordre som hviler på et ubesvart svar.** «Ferdigskrevet» og «sendt» er to tilstander.
- **Spør aldri en agent om noe som ble lagt til etter at den startet** — den kan ikke svare riktig.
- **Hver post er selvstendig.** Aldri «som i forrige ordre» eller «steg 2–4» uten at stegene står der.

### /clear-REGELEN — agenten skal kunne tømmes når som helst (Kenneth-vedtak 2026-10-14)

Orkestrator tømmer en agent etter hver levert handling (§ 0b.3). Det er bare trygt hvis ingenting bor kun i chatten. **Tilstand som ikke står i en fil eller på origin, finnes ikke.**

#### A. Orkestrator: posten må kunne utføres av en agent som husker null

Minstekrav (full mal i § 4 Ordre-anatomi): **hva og hvorfor** · **utgangspunkt** (branch/hash, miljø/test-hash) · **data** (prosjekt/fil ved navn; innlogging via [dev-login-agent.md](dev-login-agent.md) + bruker) · **DoD** · **hvor svaret skal** (`relay/inbox-orkestrator.md` + SJEKKPUNKT).

#### B. Agenten: SJEKKPUNKT ved hver leveranse

Nederst i `~/Documents/Programmering/SiteDoc/relay/inbox-orkestrator.md`:
```
SJEKKPUNKT <Agent> <dato tid>
Branch: <navn> @ <hash>   (verifisert: git ls-remote --heads origin <branch>)
Worktree: <absolutt sti>
Ordre: <innboksfil> § <overskrift>
Status: levert / under arbeid / venter på <hva>
Kunnskap å ta med: <det du lærte som ikke står i ordren: testdata, ID-er, innlogging, kjørende prosesser, fallgruver>
Åpent: <det som ikke er gjort, eller «ingenting»>
Neste steg: <én setning, eller «vent på ordre»>
```
- Midt i en oppgave: commit og push pågående arbeid på **egen feature-branch** (WIP-commit lov der, aldri på develop/main), skriv SJEKKPUNKT, svar **«klar for clear»**.
- 🔴 **«Kunnskap å ta med» er feltet som gjør /clear trygt** — også prosesser som lever videre (tunneler, dev-servere, installerte bygg), så neste økt ikke bygger dem på nytt.

#### C. Agenten etter /clear: les før du gjør noe

1. Denne regelen.
2. Posten nudgen navngir, i egen innboks (søk på overskriften). Finnes den ikke: **STOPP og meld «posten finnes ikke»**.
3. Siste `SJEKKPUNKT <Agent>` i `relay/inbox-orkestrator.md`.
4. `git -C <worktree> status` + `git log -1`. Avviker treet fra sjekkpunktet: **meld avviket før du gjør noe.**

Les ikke hele innboksen. Mangler noe, var posten eller sjekkpunktet dårlig — meld det.

**Innboksfiler:** `inbox-<agent>-<emne>.md` pr. oppdrag (Redesign, Dokgen); `inbox-kontrollor.md` og `inbox-fabel.md` faste. Den gjeldende fila står i nudgen.

## § 3 — Til Kenneth og arbeidsform

### Fremdrift, ikke dialog (Kenneth-vedtak 2026-09-26)

> *«du er den som skal foreslå neste oppgave og gi ordrer. JEG ER IKKE INTERESSERT I DIALOG. kun fremdrift.»*

- 🔴 **Orkestrator BESLUTTER og gir ordre.** Spørsmål til Kenneth kun når beslutningen faktisk er hans (§ 1).
- **En anbefaling kommer med handlingen som utfører den** i samme melding.
- **Et forbehold er konkret eller utelates.** Kan det måles bort (én spørring), mål det før meldingen sendes.
- **Er valget Kenneths:** navngi konflikten og konsekvensen av hvert alternativ i konkrete ord.

### Spørsmål: samle, ikke drypp

Tenk ferdig, mål det som kan måles, still **ett** spørsmål med nok kontekst til ett svar. Rangér alternativer
og anbefal ett. **Kontrollspørsmål:** blir noe galt hvis ingen svarer? Nei → det er en beslutning orkestrator tar.
Venter et svar, står det under en egen **«KREVER SVAR»**-overskrift; er det ingenting, skriv `Krever svar: ingenting`.

### Kommandoer til Kenneth (server, deploy, OTA, EAS)

- **Bash-blokka inneholder KUN kommandoen.** Steg-nummer, maskin, runbok-referanse, forventet utfall og advarsler står i prosa rundt.
- **Deploy-kommandoer kun fra [DEPLOY-RUNBOK.md](DEPLOY-RUNBOK.md)** — aldri skrevet fra hukommelsen.
- **Si hvilken maskin** ved hvert skifte Mac ↔ `server-ny`; aldri begge i samme blokk.
- **POSIX/BSD-flagg** (Macen har BSD-verktøy): unngå `xargs -a` · `sed -i` uten argument · `grep -P` · `date -d` · `readlink -f` · `stat -c`. En slettende/endrende kommando følges av en telling som avslører om ingenting skjedde.
- **Hver melding er selvstendig** — aldri «kjør blokken fra forrige melding».
- **Nummerert rekkefølge** med forventet resultat pr. steg; orkestrator verifiserer mot forventningen før neste steg.
- **Skjermbilder eller klikk-test fra Kenneth:** følg [skjermbilde-forespoersel.md](skjermbilde-forespoersel.md) — limbar URL, nummererte steg, forventning pr. bilde.
- **`git checkout -B` gis én gang** — gjentatt tilbakestiller den branchen og kaster commits.

### Plan-spor og funn-spor (Kenneth-vedtak 2026-08-31)

- **Plan-sporet** har alltid neste masterplan-punkt og røres ikke av feltfunn. **Funn-sporet** tar feltfunn; er det tomt, BACKLOG. Hver ordre og tavle-rad sier hvilket spor.
- **Feltfunn samles** — de blir ikke ordrer på minuttet. **Én skala** for både prioritet og deploy:

| Merke | Betyr | Handling |
|---|---|---|
| 🔴 | Bruker kommer ikke videre, data tapes, regresjon fra merget arbeid, eller noe Kenneth venter på | Avbryter plan-sporet. Ordre nå, deploy nå |
| 🟡 | Virker, men skjemmer · rydding · teknisk gjeld · i18n | Funn-sporet i tur. Samles til neste 🔴-deploy |
| 🔵 | Observasjon uten smerte i dag | BACKLOG |

  **Kontrollspørsmål før noe avbryter planen:** *kommer noen ikke videre uten dette?* Merket står i ordrens første linje.
- **Målestokken er piloten:** [REDESIGN-MASTERPLAN.md](../redesign/REDESIGN-MASTERPLAN.md) § Rekkefølge (50 ansatte, mobil viktigst; funksjonelt produkt først, GDPR og lovkrav så godt vi kan). ⚠️ `docs/redesign/MASTERPLAN.md` har samme tittel og er utdatert — sjekk datoen.

### 🔴 DEPLOY KOSTER KENNETHS TID — MERGE GJØR IKKE (vedtak 2026-09-10)

- Hver deploy/OTA koster Kenneth ~20 min. **Samle 🟡** til neste 🔴; uten 🔴 deployes samlepakken når Kenneth sier fra. Oppgi hva kommandoen bærer og hvem som venter.
- **Mens Kenneth deployer:** orkestrator merger ikke (hash-guarden i `deploy-test.sh` feiler hvis develop flytter seg) før `/version` bekrefter hashen. Utviklere bygger videre på egne brancher; orkestrator skriver ordrer og gater. **Orkestrator venter ikke på deploy før neste ordre.**
- **`/version` FØR hver kjede som avhenger av en deploy** (`curl -s https://api-test.sitedoc.no/version`). En seed eller test mot gammelt image måler ingenting.
- Ingenting blir liggende gatet-men-ikke-deployet uten en grunn ført i STATUS-AKTUELT.

## § 4 — Ordrer

### Mål premisset (ufravikelig)

- **Før du skriver en ordre:** mål premisset i koden — også for et sidefunn. En velskrevet agentrapport er ikke en måling.
- **På en innkommende rapport:** den er input, ikke fasit. Relé, rapport og SJEKKPUNKT er input.
- **Før du ber noen teste:** branchen er rebaset på `origin/develop`, og `git merge-base --is-ancestor <fiks> <bygget som kjører>` er sant. Aldri bestill verifisering av kode som ikke er deployet.
- **Påstanden kommer fra verktøyet som eier svaret:** `pnpm lint` for lint, hele funksjonen (lest fra toppen) for kontrollflyt, hele skrivestien for «skjer dette». Et `sed`-vindu eller et grep-treff er ikke en måling. For dyrt å måle → skriv «ikke målt».
- **Et binærnavn, en filsti eller `fil:linje` måles av den som skriver det inn** — arvet: skriv «umålt».
- **Miljø-påstander måles mot maskinen** (`lsof`, `ps`, `git worktree list`), ikke mot docs. Kommandoer i docs kjøres minst én gang før de føres.
- **Miljø/DB/test-oppsett:** les [LOKALT-OPPSETT.md](LOKALT-OPPSETT.md) + `ls .env*` først; spør Kenneth kun om den ene variabelen som faktisk mangler.
- **Verktøyrapporter (Aikido o.l.) vurderer deklarerte versjoner** — sjekk resolved versjon før noe kalles eksponering.

### Ordre-anatomi

```
[0. SPOR + MERKE]          Plan/funn · 🔴/🟡 · REPARASJON eller FUNKSJONSENDRING + hjemmel (§ 5).
[1. HVA SOM ER GJORT]      Hasher + hva de gjorde. Hindrer at økta gjentar landet arbeid.
[2. OPPGAVE]               Hva og hvorfor. Data, innlogging, utgangspunkt (branch/hash).
[3. UFRAVIKELIG]           Tre + branch + filer den eier + de tre linjene under.
[4. FORVENTET OUTPUT]      DoD. Per funn: hva, hvordan målt, alvorlighet. Mistanker merket separat.
[5. SVAR]                  relay/inbox-orkestrator.md + SJEKKPUNKT.
```

**De tre linjene, ordrett i blokk 3:**
- «Denne ordren er **input, ikke fasit** — mål premisset selv. **SI DET, ikke gjett.**»
- «**Sjekk treets alder før du melder et fravær**» — `git fetch` først; test på commit-hash, aldri branchnavn.
- «**Fjerner du en funksjon ordren ikke nevner: STOPP og meld**» (§ 5).

**Faste krav i ordren når de gjelder:**
- **Steg 0 — BACKLOG-grep** med minst to søkeformer (funksjonsnavn + symptom). Treff refereres (`§<linje>`); null treff skrives. BACKLOG er ikke fasit — et treff betyr «mål dette».
- **Paritetsmatrise** (§ 5) når funksjonen gjelder dokumenttyper eller flater.
- **Funksjonsinventar** når ordren rører en eksisterende kodevei: hver funksjon kodeveien bærer, med vedtak BEVARES/ENDRES.
- **Delt logikk navngis** (§ 6).
- **Verifisering:** navngi **handlingen** som trigger kodeveien, og **hvem** som verifiserer: *et tall eller en regel* → funksjonstest, ingen nettleser · *et utseende* → Kenneth (ikke automatiser et blikk) · *en flyt agenten ikke kan nå* → si det i rapporten («dette kunne jeg ikke se» er en gyldig leveranse). Ber ordren om å finne noe: be om HVOR det ble funnet og HVOR MANGE TRYKK det tok.
- **Bevis agenten kan levere.** Bevis som krever utstyr agenten ikke har, bestilles ikke av den.
- **Mobil:** verifiseres med tester + Kenneth på telefon; simulator kreves ikke. Timing, nett og WebView-livssyklus er ikke verifisert før sett på fysisk enhet (sløyfen er kode → `r` i Metro → telefon, uten byggkvote). Skjermbilder kun når spørsmålet er visuelt — det er bildene som er dyre.

### Tolkning av bestillinger

- 🔴 **«Sjekkliste» betyr ofte «dokument»** (Kenneth 2026-09-04): sier Kenneth «sjekkliste» om en funksjon, gjelder den sjekkliste, oppgave og HMS med mindre noe er spesifikt for én. Tvil → ett spørsmål.
- **Testplan med forventet utfall pr. steg** utledet fra kode før test — ellers har observasjonen ingenting å måles mot. Funn mater både kode og plan.

## § 5 — Funksjoner: hva som bevares, hva som krever Kenneth

### 🔴 LUKKER HULL vs ENDRER FUNKSJON — Kenneths kontrollflate (Kenneth-vedtak 2026-09-27)

> «jeg trenger å fange opp det som endrer funksjoner → jeg trenger ikke bruke tid på hull og
> forbedringer uten funksjonsendring»

**Testen er om INTENSJONEN endres, ikke om brukeren merker noe.**

| Spørsmål | Svar | Klassifisering |
|---|---|---|
| Var det meningen at dette skulle virke, og gjorde det ikke? | ja | 🟢 **REPARASJON** |
| Bringer vi koden tilbake til noe Kenneth har sagt/spesifisert? | ja | 🟢 **REPARASJON** |
| Bytter vi én intensjon mot en annen? | ja | 🔴 **FUNKSJONSENDRING** |
| Endrer opplevelsen seg uten at det var en del av planen? | ja | 🔴 **FUNKSJONSENDRING** |

**Presedenser (Kenneth 2026-09-27):** P2002 stille feil → melding = 🟢 reparasjon · signaturlevetid 24 t → 15 min =
🔴 funksjonsendring, *selv om det var planlagt* (planlagt gir hjemmel, fritar ikke fra registeret) · PSI partiell unik
indeks = 🟢 reparasjon (rettet en misforståelse av opprinnelig beskjed). **Feiltilfeller teller som funksjon.**

🔴 **Intensjon teller BARE hvis den er skrevet ned FØR endringen** — beslutning fra Kenneth, spec eller styrende
dokument, **med referanse i ordren.** Ingen skriftlig intensjon → **FUNKSJONSENDRING som standard.**
«Produktvalget er tatt» i en Fabel-ordre er ikke hjemmel: **Fabel foreslår; Kenneth beslutter.**

**Løypa — gaten ligger på ordre-tidspunktet, ikke før merge:**
1. **Orkestrator klassifiserer hver ordre** og skriver det i ordren.
2. **En funksjonsendrings-ordre sendes ikke før den navngir hjemmelen** (beslutning + dato). Finnes ingen: til Kenneth
   først, én kort blokk — **hva brukeren ser i dag · hva han ser etterpå · hvorfor.** Svar: ja, nei eller «endre».
3. **Orkestrator fører [FUNKSJONSENDRINGER.md](FUNKSJONSENDRINGER.md) ved merge** — funksjonsendringer (krevde ja) og
   reparasjoner med synlig virkning (til orientering).

Sikkerhetsendringer er ikke unntatt: fjerner de noe brukeren kunne, er det funksjonsendring.

### 🔴 KODEN ER ALDRI FROSSET — det er FUNKSJONENE vi bevarer (Kenneth-vedtak 2026-09-04)

> *«Koden er aldri frosset → det er funksjonene vi må bevare → funksjoner som er feil må vi korrigere → men jeg vil ha
> tilbakemelding dersom vi fjerner funksjoner som ikke har vært diskutert.»*

1. **Ingen kode er fredet.** Et «ikke rør den» gjelder det brukeren opplever, ikke implementasjonen.
2. **Er funksjonen feil, skal den korrigeres** — bevaring gjelder det som er riktig, ikke det som er gammelt.
3. 🔴 **Fjerner du en funksjon som ikke har vært diskutert — STOPP og meld FØR levering.** «Ingen klient gjør dette i
   dag» er en observasjon, ikke en garanti. Tom tabell eller null kallere er ofte halvferdig vedtatt funksjon — sjekk
   `git log -S`, spec og fallback før noe kalles dødt.

| Bevares (hvis riktig) | Fritt å endre |
|---|---|
| Det brukeren ser og gjør | Hvor verdien kommer fra |
| Antall trykk, rekkefølge, hva som huskes | Datastruktur, kontekst, cache-strategi |
| At funksjonen finnes og virker | Robusthet, avgrensning, testdekning |

En refaktorering som fjerner et trykk brukeren var vant til, har brutt fredningen selv om ingen funksjon forsvant.
**Ordrer som rører fredet område** navngir filene som bærer dagens atferd, krever at agenten sier hvilke han rørte, og
peker på regresjonstestene.

### Snudd vedtak og vedtak i fila

- 🔴 **Et SNUDD vedtak rettes DER DET STO**, med en ⚠️-blokk (snudd av hvem, når, hvorfor) og det gamle synlig under.
  Den som leser det gamle først, bygger det forkastede.
- 🔴 **Før du endrer en komponent: les vedtakene som står som kommentarer i den fila, og navngi i svaret hvilke som
  gjelder** (Kenneth-vedtak 2026-09-29). Står vedtaket ikke der koden bor, er funnet at det står på feil sted.

### 🔴 PARITET GJELDER TO AKSER — dokumenttype OG flate (Kenneth 2026-09-04)

Enhver ordre for en dokumentfunksjon fyller ut matrisen. Hver rute er ✅ (bygges), ❌ (gjelder ikke — med grunn) eller
⚠️ (finnes ikke i dag — eget funn). **Tomme ruter er ikke tillatt.**

| | Web | Mobil-app | Arkiv-PDF |
|---|---|---|---|
| **Sjekkliste** | | | |
| **Oppgave** | | | |
| **HMS** (avvik/SJA/RUH) | | | |

**Paritet er ikke likhet — mobil får det som hører i felt** (*«avanserte funksjoner overlater vi til web»*):

| Hører på MOBIL — feltarbeid | Hører i WEB — kontorarbeid |
|---|---|
| Registrere observasjon, avvik, RUH | Bygge og redigere maler |
| Ta bilde, sette pin, velge tegning | Firmaadministrasjon, malarkiv, moduloppsett |
| Fylle ut og sende dokument | Rapportering, analyse, eksport-oppsett |
| Se og kontrollere eget arbeid | Attestering i volum, kolonnevalg, bulk |

`❌` for mobil begrunnes med *hvor arbeidet skjer* (anleggsarbeider med hansker, i regn), ikke med at det ble tungt å
bygge. Ulik leveringsvei (OTA vs prod-deploy) betyr ulik timing, ikke ulikt omfang.

## § 6 — Gate og merge (Commit-orden)

### Hvem gater hva — én gate pr. leveranse

| Leveranse | Gate | Klarsignal |
|---|---|---|
| Kode (alle kode-ordrer) | **Kontrollør** | «GODKJENT – klar for merge» eller «Avvik: …» |
| Mal (seed/innhold) | **Fabel** (innhold + teknikk på agentens regel 10-tall) | «klar for merge» |
| Docs-only fra Fabel | Fabels melding er klarsignalet; orkestrator sjekker mekanisk at diffen bare er docs | «klar for merge» |

- 🔴 **Gate-MELDINGEN utløser merge, ikke branchens eksistens.** En pushet branch uten klarsignal for nøyaktig den
  hashen er ikke gatet — også når orkestrator har målt at den finnes.
- **Orkestrator stadfester gaten i merge-commit-meldingen eller tavla** med kilde (`inbox-orkestrator.md:<linje>`).
  Mangler den, merges ikke.
- Utseende på en UI-endring verifiseres av Kenneth før deploy (ikke av en ekstra gate). Fabel gater ikke koden på nytt.
- **Etter «klar for merge» er branchen FROSSET:** ny push krever ny hash meldt, og ny gate for den hashen.
- **Agenten pusher sin egen feature-branch** så snart egen gate er grønn. Rebase pushes med `--force-with-lease`, aldri
  `--force`, aldri mot `develop`/`main`. `git fetch && git rebase origin/develop` rett før push; diffen skal være kun egne filer.

### Regel 9 og regel 10

- **Regel 9:** merge til `develop` alltid `--no-ff`.
- **Regel 10 — ingen merge uten grønt på alle ledd, kjørt i merge-treet etter mergen:**
  1. **Forsteg:** `pnpm install` + `prisma generate` for `db`, `db-timer`, `db-maskin`, `db-varelager`. Uten det gir
     `Module not found` (node_modules bak lockfila) og `does not exist in type '<Modell>Select'` (klient bak schema)
     falske røde.
  2. `npx turbo run typecheck --force` fra rot — **«N successful, N total» med like tall.** Lavt N betyr at turbo
     stoppet på første røde pakke.
  3. `pnpm --filter @sitedoc/web exec tsc --noEmit` **eksplisitt** — `next build` typesjekker ikke testfiler, og
     mobilens typecheck dekker ikke web. Falske `TS2307` i `.next/types/` skilles ut (`grep -v '^\.next/'`); er alle
     feilene der, kjør byggeleddet og mål på nytt.
  4. `pnpm --filter @sitedoc/web build` — **kaldt** når web-filer er rørt
     (`rm -f apps/web/tsconfig.tsbuildinfo && rm -rf apps/web/.next`): inkrementell build kan skjule TS2589 som
     Docker-bygget avviser. `tsc` stopper på første TS2589 — kjør til grønt. Web build dekker `apps/api` transitivt
     (målt 2026-09-02); eget api-typecheck er hastighet, ikke dekning.
  5. `pnpm exec turbo run test --force` fra **rot** — «N successful, N total» like tall. «FULL TURBO» eller urimelig
     kort kjøretid = cache, ikke kjøring.
- **Rapporten bærer den ordrette siste linja fra hver kommando** og test-fordelingen
  `unit-mock: <n> · unit-ren: <n> · integrasjon: <n> · e2e: <n>`. «Rent» uten app-navn er ikke en kvittering. Krav (c) i
  «stille tomhet er forbudt» kan aldri oppfylles av en mocket test — kvitteres som «delvis — mock».
- ⚠️ **Kjent hull:** `tests/e2e` har intet `typecheck`-script (turbo teller no-op som suksess). Bestilles eget ledd hvis
  e2e-drift skal fanges.

### Gaten skal ligge i kommandoen

- 🔴 **Aldri en pipe som gate.** `cmd | grep | tail` returnerer `tail` sin kode — alltid 0. Bruk eksplisitt
  `> log 2>&1; echo "exit=$?"`, eller `set -o pipefail` først. Sammenlign tall maskinelt
  (`grep -E "Tasks:" | awk '{exit !($2==$4)}'`), ikke bare finn linja.
- **Mål at en ny gate stopper** — kjør den mot noe som feiler før du stoler på den. Et grep-treff på null er ikke bevis
  for fravær (kasus!); kompilatoren og databasen er fasit.

### Merge-kjeden (orkestrator, `SiteDoc-merge`)

`SiteDoc-merge` står detached på `origin/develop` og bærer aldri egne commits ([parallell-arbeid-lock.md](parallell-arbeid-lock.md)
§ Worktrees). Verifiser at treet finnes (`git worktree list`) før merge; gjenoppretting står i samme fil.

```sh
cd ~/Documents/Programmering/SiteDoc-merge && git fetch --prune origin && \
test "$(git rev-parse origin/<branch>)" = "<hash>" && \
! git merge-base --is-ancestor <hash> origin/develop && \
git checkout -q --detach origin/develop && \
git merge --no-ff <hash> -m "merge: <branch> -> develop (<hva>; <gate-kilde>)"
# regel 10 her — så:
git push origin HEAD:develop
```

- Linje 2 stopper hvis hashen ikke er branchens tipp; linje 3 hvis den alt er i develop (duplisert ordre stopper seg selv).
- **Push avvist** (develop flyttet seg): `reset --hard origin/develop`, merg på nytt, kjør regel 10 på nytt, push. Aldri force.
- **Uventet — konflikt, migrering/`schema.prisma` som ordren ikke nevner, rødt ledd: STOPP og meld.** En merge som
  «ble løst underveis» er en merge ingen har gatet.
- **Verifiser mot agentens hash, ikke merge-commitens:** `git merge-base --is-ancestor <agentens-hash> origin/develop`.
- **Merge nr. 2 av brancher fra samme base:** verifiser resultatet mot `origin/develop..HEAD`, ikke `develop..branch`.
  `git diff develop..branch` viser ikke hva branchen gjorde — bruk tre punktum eller diff mot `merge-base`.
- **Docs-commits** (STATUS-AKTUELT, FUNKSJONSENDRINGER, tavla) gjøres i samme tre **etter** mergen, aldri samtidig.
  STATUS-AKTUELT, tavla og FUNKSJONSENDRINGER har én skribent: orkestrator. Agenten fører egne spec-filer, BACKLOG-lukking
  og STATUS.md i sin egen commit; orkestrator sjekker at berørt STATUS/BACKLOG-linje er i commit-settet før merge, og
  leser innholdet på begge sider — en ren merge av to statusfiler kan flette motstridende påstander uten konflikt.
- **Migrering og seed kjøres aldri** i merge-kjeden — det er Kenneths, ved deploy.
- **Hovedtreet `SiteDoc`:** orkestrator kjører bare `git fetch` der, aldri `pull`/merge/commit (stale `ORIG_HEAD.lock`
  fire ganger 09.–10.09). `pull --ff-only` der er Kenneths steg i [DEPLOY-RUNBOK § 1](DEPLOY-RUNBOK.md). Stale
  `.lock`: diagnostiser (prosess? alder?) og meld før den fjernes.
- **Status-påstander har kilde:** «pushet», «deployet», «klar for X» bærer hash eller dato. Berører diffen et område med en ❌-markør, re-verifiseres markøren i samme commit-sett ([dokumentasjons-standard.md § 11b](dokumentasjons-standard.md)).

### Rydding etter merge (Opus-livssyklus fase 4)

```sh
git -C <agentens tre> checkout --detach origin/develop
git -C ~/Documents/Programmering/SiteDoc-merge branch -d <branch>     # -d, aldri -D
git -C ~/Documents/Programmering/SiteDoc-merge push origin --delete <branch>
```

- 🔴 **Mål `git worktree list` og tavla før rydding; rydd aldri et tre en agent står i**, og slett aldri `SiteDoc-merge`.
- Før du berger noe som ser tapt ut: `git log -S` og `merge-base --is-ancestor` — en «tapt» leveranse er oftest merget
  under et annet navn.
- **Inventar ved hver lukking:** `git -C ~/Documents/Programmering/SiteDoc worktree list` + `git status --porcelain` og
  `git stash list` i hvert tre. Et tre, en fil eller en stash ingen vet om, er et funn.
- **Hver økt som produserer en fil, får en git-vei for den i ordren** (docs-branch). En rapport som ikke committes,
  finnes ikke.

## § 6b — Kjøreregler fra målte feilklasser

### Kollisjonssjekken gjelder ORDRER, ikke bare arbeidstrær

Før to ordrer går ut parallelt:
```sh
comm -12 <(git diff --name-only origin/develop...origin/<branch-a> | sort) \
         <(git diff --name-only origin/develop...origin/<branch-b> | sort)
```
- 🔴 **`git merge-tree` har gitt 0 konfliktmarkører på ekte konflikt** — belegget er en ekte prøvemerge i et engangstre.
- **Delte ressurser filoverlapp ikke fanger:** i18n-generatoren (aldri to parallelt — konflikt i 15 filer) ·
  `localhost:3100/3001` (én dev-server; sjekk `cwd` på pid-en; drep etter bruk) · delte komponenter bak ulike sider
  (sjekk hva sidene *importerer*) · statusfilene (STATUS-AKTUELT/STATUS.md/BACKLOG) · nettleseren.
- **Nettleser:** egen headless nettleser + dev-login ([mcp-playwright-simulator-oppsett.md](mcp-playwright-simulator-oppsett.md)).
  Et verktøy som styrer Kenneths egen Chrome brukes ikke uten at han har sagt ja; to økter aldri samtidig. Foretrekk
  render-test (jsdom) når den beviser det samme.

### 🔴 DELT LOGIKK SKAL NAVNGIS I ORDREN — ellers fødes den femte kopien (2026-09-06)

Enhver ordre som lar en flate lese eller tolke mal-config **navngir den delte kilden i `@sitedoc/shared`** (fil + funksjon).
Finnes den ikke: **trinn 0** pakker den ut og sletter de gamle kopiene i samme trinn. En ny kopi senere er ordrebrudd.
Sanksjonert tvilling (`@sitedoc/pdf`, null avhengigheter) krever paritetstest som kjører begge på samme inndata
(mønster `85c8ecd5`). Kanonisk repeater-traversering: `@sitedoc/shared/utils/repeaterRad.ts` med tvilling i
`packages/pdf/src/arkivmal/repeaterRad.ts` — ikke lag en tredje. *Hvorfor:* kopier driver fra hverandre, og en resolver
som normaliserer annerledes enn visningen gir stille feil i dokumenter byggherren mottar.

### 🔴 EN NEGATIV ASSERTION ER IKKE BEVIST FØR TRE TING ER VIST (2026-09-27)

En `not.toMatch`/`not.toContain` som aldri har vært rød, er en tillatelse, ikke en test.
1. **Den har vært RØD — i en engangsfil, aldri i den ekte.** Kvittering på origin, ikke i treet:
   `comm -13 <(git ls-tree --name-only origin/develop <kat>/ | sort) <(git ls-tree --name-only origin/<branch> <kat>/ | sort)` → tomt.
2. **Rød-beviset bruker varianten risikoen faktisk kommer i** (f.eks. bar `DROP INDEX` som Prisma genererer, ikke bare `IF EXISTS`).
3. **Falsk-positiv-sjekk:** vis at vakten ikke fyrer på den legitime setningen.

### Produksjonsformen, kildene og databasen

- **Produksjonsformen testes FØRST.** En grønn test mot en datastruktur produksjonen ikke bruker, måler ingenting.
  Legacy-former i egen navngitt bakoverkompatibilitet-blokk.
- **Byggnummer, profil og distribusjon leses fra kilden** (`eas build:list` og App Store Connect). Er de uenige, står
  begge målingene til noen har målt hvorfor.
- **Mål mot riktig database:** Kenneth tester på `test.sitedoc.no` → `-d sitedoc_test`. `-d sitedoc` er PROD og brukes
  bare når spørsmålet gjelder prod. Ta alltid med `created_at` i utvalget.
- **Mildne aldri et funn** til noe mindre enn det brukeren opplever. En endring er ikke levert før noen som ikke vet hva
  som ble endret, kan finne den.

### Kode som lyver

- 🔴 **`as unknown as` skjuler manglende felt.** Forsvinner en verdi uten feil: mistenk casten. Erstatt med en typet
  hjelper som leser fra rå kilde.
- 🔴 **En kommentar som sier «KUN X» skal håndheves av konstruksjonen** — Prisma `select`, ikke `include`; bash
  `pipefail`/`exit=$?`. Sterkest er garanti ved konstruksjon.

### Diverse

- **Aldri commit** `tests/e2e/*-state.json` (Playwright storage-state med session-cookies).
- **Sandkasse:** en økt i Linux-sandkasse uten Mac-stiene ser alle trær som `prunable` — bedøm ikke worktree-tilstand derfra.

## § 7 — Exit-spørsmålene (ved avsluttet oppdrag)

En rapport svarer på det den lette etter. Ved avsluttet oppdrag (ikke hver småleveranse) svarer agenten i leveransen:

1. **Hva så du som ikke passet i noen kategori?**
2. **Hva forkastet du som støy?** Særlig om en heuristikk ble strammet underveis.
3. **Hvilke filer/flater føltes feil uten at du kunne bevise det?** Merk som mistanke, ikke funn.
4. **Hvilke av funnene dine mistenker du har søsken du ikke rakk?**

Svar merket som usikkerhet er nyttige. En gjetning ført som funn er ikke.
