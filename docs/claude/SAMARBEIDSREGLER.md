# Samarbeidsregler — roller, meldingsflyt, commit-orden

> Fasit for hvem gjør hva på tvers av Cowork-økter på SiteDoc. Formål:
> unngå kollisjon mellom kode-økter + holde orden på commits. Detaljerte
> kjøreregler i [parallell-arbeid-lock.md]. Les FØR du instruerer en annen økt.

## Roller

| Rolle | Ansvar | Kjører kommandoer | Kode/branch |
|-------|--------|-------------------|-------------|
| **Kenneth** | Eneste som kjører kommandoer (terminal/SSH/sudo). Tar produktbeslutninger (K-saker). Relayer alle meldinger mellom økter. Utfører + beslutter — koder ikke. | **Ja — alt** | — |
| **cowork** | Eier **commit-orden** + tverr-koordinering: merge-rekkefølge, regel 9/10-håndheving, prod-løp, konfliktvakt (frossen sone), BACKLOG, deploy-disiplin. Skriver timer/PSI-kode + gate-verifiserer. Gir Kenneth kommandoer. **Alt som lander på develop/main passerer cowork.** | Nei (gir Kenneth) | pipeline + timer |
| **fabel** | Eier redesignet. Skriver ordre til redesign-Opus (hva kodes, designkrav, akseptkriterier), designgodkjenner mot handoff-spec + skjermbilder (en flagg-på-endring er ikke lukket uten denne), bestiller verifisering fra Opus web. **Rører aldri git-koreografi.** | Nei | redesign-retning |
| **redesign-Opus** | Koder KUN på `redesign/navigasjon`, KUN fabels ordre, `(redesign)`-scope, fullt `next build` før merge, `--no-ff`. Design → fabel; merge-timing → cowork. | Ja (egen branch) | `redesign/navigasjon` |
| **develop-Opus** | Koder timer/PSI m.m. på develop. **Rører ikke frossen sone** (nav/layout-filer). Koordinering → cowork. | Ja (develop-worktree) | `develop` |
| **Opus web** | Verifiserer KUN i nettleser på test.sitedoc.no (inkognito ved behov). Får presise sjekklister fra fabel (design) eller cowork (funksjon). **Rapporterer funn — konkluderer ikke om årsak.** Skriver ikke kode, kjører ikke kommandoer. | Nei | — |
| **simulator-Opus** | Verifiserer på iOS-simulator (Metro @ develop) OG web. Kjører idb/simctl lokalt; leser test-DB via tunnel. Rapporterer observasjoner med kandidatmengde — konkluderer ikke om kode-atferd uten kodeverifisering. Skriver ikke produktkode; docs-endringer rutes via cowork. | Ja (simulator/lokalt) | — |

## Meldingsflyt (ufravikelig)

**Alle ordrer går via Kenneth — han limer, han ser alt. Ingen agent instruerer en annen direkte.**
- fabel → redesign-Opus / Opus web: formuleres ferdig av fabel, Kenneth relayer.
- cowork → develop-Opus / Opus web (funksjon): formuleres ferdig av cowork, Kenneth relayer.
- Kommandoer (git/build/sudo/deploy): formuleres til Kenneth, som kjører.

## Commit-orden — én eier: cowork

All merge-koreografi går gjennom cowork:
- **Rekkefølge:** timer og redesign treffer ikke develop samtidig uten build-gate mellom — én verifisert ting om gangen.
- **Regel 9:** `redesign/navigasjon → develop` alltid `--no-ff` (synlige, revertbare grenser).
- **Regel 10:** ingen merge til develop uten grønt `pnpm --filter @sitedoc/web build` (ikke bare typecheck). **Rører diffen `apps/mobile/`: også `pnpm --filter @sitedoc/mobile typecheck`** — se advarselen under.

  > ⚠️ **Regelen gatet KUN web til 2026-07-16, og mobil råtnet i skyggen.** develop-Opus kjørte negativ kontroll uoppfordret og fant at `@sitedoc/mobile typecheck` er **rød på ren develop** (11 feil, bl.a. `erstattVedlegg` returneres av begge mobil-hookene men er ikke deklarert i interfacene). **Ingen visste**, fordi gaten aldri spurte. Mobil-gjelden må ryddes før gaten kan blokkere på den (🟠 i [BACKLOG](BACKLOG.md)) — inntil da: krev at diffen ikke ØKER feiltallet (baseline-sammenligning, som han gjorde).
- **Worktree per spor:** aldri to økter i samme arbeidstre.
- **Prod:** aldri uten Kenneths eksplisitte ordre; rett branch rsynca; migreringer gated.

> **Design-godkjenning (akseptkriterium):** en redesign-UI-endring (flagg-på) er **ikke lukket** før **fabel har designgodkjent mot skjermbilder** fra Opus web — aldri på typecheck/`next build` alene. Build-gaten (regel 10) sikrer at det *bygger*; design-godkjenningen sikrer at det *ser riktig ut*. Begge kreves.

Så lenge disse holdes vet Kenneth at develop er ren. «Går dette bra?» har én kilde: cowork.

## Cowork leveranse-ansvar (ordre 2026-07-14)

Fire regler skjerper cowork sitt ansvar. Ved motstrid rapporteres de kolliderende reglene til Kenneth **før** endring — løses aldri stille.

1. **Leveranse til prod + EAS.** cowork eier koordineringen av at alle gatede commits/merges/alt faktisk arbeid **når** produksjon og EAS-bygg. Ingenting blir liggende gatet-men-ikke-deployet uten en eksplisitt grunn ført i STATUS-AKTUELT. **EAS-kvote spores i STATUS-AKTUELT § EAS-byggteller** (bygg # + dato, nullstilles den 1. hver måned); ved **12 bygg/mnd** stopper cowork opp + sjekker klar-tilstand + flagger i status før nytt bygg fyres. *(Grense: selve prod-deployen og EAS-fyringen utløses fortsatt kun på Kenneths eksplisitte go — kvote-gaten på EAS består. cowork sikrer klar-tilstand + flagger stopp; Kenneth trykker avtrekkeren.)*
2. **Kommandoformat.** Alle terminalkommandoer som krever Kenneths TTY leveres i strukturert, nummerert rekkefølge — kopierbar blokk, forventet resultat per steg. Kenneth kjører + melder tilbake; cowork verifiserer mot forventningen før neste steg. *(Utvider meldingsflyt-regelen «kommandoer formuleres til Kenneth».)*
3. **Bygg utenfor redesign.** cowork har hovedansvar for alle bygg/leveranser utenfor redesignets domene, samt all merge-timing og deploy. redesign-Opus eier sitt (`redesign/navigasjon`, fabels ordre). *(Skjerper eksisterende cowork-rad «eier resten + merge-timing + deploy».)*
4. **Koden sjekkes alltid.** Gate skjer mot **faktisk kode / git-objekt** — aldri på beskrivelse alene. Verifiser mot koden før beslutning/gate. *(Presisering av en generell gate-regel cowork allerede følger — kode-sjekken er det som avdekker avvik; ikke en ny skjerping.)*

   **Utvidet 2026-07-15 — regelen gjelder mer enn kode.** Fem brudd på én dag, alle samme form: *påstand uten måling*. Hver gang var det en kommando som rettet feilen, aldri resonnementet.
   - **Miljø-påstander måles mot maskinen**, ikke mot docs eller hukommelse. Verktøyene er `lsof`, `ps`, `docker ps`, `git worktree list`, `git merge-base`. «Lokal DB finnes» (fra en stale doc-linje), «ingen postgres finnes» (fra manglende CLI) og «arbeidstreet er prunable» (sandkasse-artefakt) var alle feil — og alle ville kostet en runde hvis de ikke ble målt.
   - **Kommandoer i docs kjøres minst én gang før de føres.** `pnpm dev --filter web` sto i CLAUDE.md § Kommandoer — fila hver økt leser først — og hadde aldri virket (pakken heter `@sitedoc/web`). Ingen hadde prøvd den.
   - **En påstand arvet fra en annen økt er ikke verifisert før den er målt selv.** «Nøkkelen er arvet fra gamle `KoordinatKart`» gikk fra redesigns exit-rapport rett inn i BACKLOG; `git log` motbeviste den på ett sekund (fila finnes ikke i historikken — nøkkelen kom fra en Claude-økt i mars). **Relé, rapport og exit er input, ikke fasit.** Særlig når de er velskrevne.

## Gate-disiplin: docs-delta + lukking ved kilde (2026-07-14)

Tre regler mot dokumentasjons-drift (fabel-relay, Kenneth-godkjent). Formål: docs speiler tilstand i merge-øyeblikket, ikke «etterpå».

1. **Docs-delta i merge-gaten.** Ingen merge til develop uten at berørt STATUS/BACKLOG-linje er i samme commit-sett. Coworks gate-sjekkliste får et fast punkt — «docs-delta til stede? hvilke linjer?» — og svaret føres i gate-rapporten, så fravær er *synlig*, ikke stille. (Gjelder funksjonsendrings-merges; rene rule-/governance-docs-commits er selv sitt delta.)
2. **Lukking skjer der saken står.** Den som lukker en sak (gate PASS, grønn fangst, DoD) fører lukkingen i BACKLOG/STATUS i SAMME melding/commit — aldri «etterpå». En fiks som berører en kjent BACKLOG-post MÅ referere posten; coworks gate sjekker det. (Blocker #2-driften oppsto nettopp fordi F4-2 løste den uten å røre BACKLOG-posten.)
3. **Status-påstander har kilde.** Linjer i STATUS som hevder tilstand («pushet», «deployet», «klar for X») skal bære commit-hash eller dato. En påstand uten kilde behandles som mistenkt stale — det gjør re-utledning billig og drift synlig ved lesing. *(Anvendelse av «presens krever referanse» ([dokumentasjons-standard.md](dokumentasjons-standard.md)) på deploy-tilstand — samme prinsipp, spisset mot STATUS-påstander.)*

4. **Fravær-påstander re-verifiseres ved berøring** (fabel-presisering 2026-07-16). Berører diffen et område som er navngitt i en ❌-markør, skal markøren re-verifiseres eller strykes i SAMME commit-sett. ❌ + dato + hash gjør råten detekterbar, ikke detektert — uten trigger blir rettelsen en stale linje med tidsstempel. Full regel + de fem påstandene dette gjelder i dag: [dokumentasjons-standard.md § 11b](dokumentasjons-standard.md).

**Håndhevelse:** cowork sjekker 1–4 i hver merge-gate (fast punkt i gate-rapporten). fabels exit-protokoll kjører dokumentasjonssync ved hver Opus-exit og verifiserer at 1–2 er fulgt i rundene siden sist — ikke bare at innholdet stemmer.

## Seks-leddssløyfen — vedtatt arbeidsmetode (Kenneth 2026-07-18)

**Kenneth-vedtatt standard for kommende saker.** Kom ut av A-3a/A-3b-runden, som endte i «svært sterke forbedringer» — og belegget er at **de tyngste funnene (N1 perspektiv-status, N3 tre-node-grafen, de syv designbeslutningene) kom fra test-leddene, ikke fra planleggingen.** En plan overlever ikke møtet med kjørende kode og en bruker som klikker; sløyfen fanger det planen ikke kunne vite.

| Ledd | Hvem | Hva |
|---|---|---|
| 1. Plan | fabel | Design/ordre med mål |
| 2. Gate mot kode | **cowork** | Verifiser planens premisser mot kode; ved avvik korrigér planen FØR bygging (REGEL 0 + §11-familien) |
| 3. Kode | Opus | Bygg mot den gatede planen |
| 4. Testplan | **cowork (eierskap)** | Lag testplan med **forventet utfall per steg** utledet fra kode — så avvik kan måles, ikke gjettes |
| 5. Test | web-Opus | Utfør på test, kaptrer skjermbilder + logg, rapportér ordrett |
| 6. Utbedring | fabel + cowork | Funn → korriger kode OG plan; nye funn mater neste sak |

**Testplan-leddet (4) eies av cowork** (fabel-krav): forventet-kolonnen må komme fra kodemåling, ellers har man ingenting å måle observasjonen mot. Se [test-veileder-dokumentflyt-2026-07-18.md](delplaner/test-veileder-dokumentflyt-2026-07-18.md) som referanse-form.

**B-2 og A-3b kjøres etter denne sløyfen** når N3-valget er tatt.

## Tavle-binding — commit-gaten (vedtatt 2026-07-21, etter andre svikt)

> **Livssyklusen under er riktig og beholdes uendret. Dette avsnittet er det som mangler: en mekanisme som gjør at den faktisk kjøres.**
>
> **Andre svikt, samme form (2026-07-21):** fem Opus-økter kjørte samme dag (kode/sak1+spor2+sak2 · mobil/TegningsCapture · web/testing · CI · A-3b). **Null tavle-rader ble skrevet.** Cowork produserte 18 delplan-dokumenter og rørte ikke tavla én gang. Kenneth måtte selv avslutte to økter fordi ingen fulgte opp status, og en exit-synk avdekket sju dokumenter som påsto at merget arbeid var «ikke startet». Dokumentet forutsa nøyaktig dette 2026-07-16: *«En regel uten mekanisme utføres ikke.»* Tavla var mekanismen for fase 1–4, men **ingenting var mekanismen for tavla.**

**Rotårsak:** tavla avhenger av at cowork *husker*. Alt annet som virker i dette repoet er bundet til en commit, der git gjør bruddet synlig.

### De to bindingene

| Binding | Regel | Hvorfor den holder |
|---|---|---|
| **B1 — Ordre ⇒ rad** | En ordrefil i `docs/claude/delplaner/` og dens tavle-rad committes **i SAMME commit**. Ordre uten rad = ufullstendig commit, samme klasse som kode uten docs. | Cowork kan ikke skrive en ordre uten å passere gaten. Ingen ordre = ingen økt. |
| **B2 — Merge ⇒ rad-fjerning + status** | Merge-commiten som lander en økts branch fjerner **i SAMME commit** øktas tavle-rad og oppdaterer ordrefilens `status:`-linje. | Merge er det eneste tidspunktet der en økt beviselig er ferdig, og cowork er alltid den som gjør den. |

**Konsekvens av B2:** de sju stale statusene 2026-07-21 var umulige å produsere. Hver av dem oppsto fordi merge og status-oppdatering var to hendelser, og bare den første skjedde.

### Kenneths kontrollflate — ett ord

Kenneth skriver **«tavla»**. Cowork svarer med aktive rader, hver med: økt · branch · alder i dager · hva den venter på · hvem ballen ligger hos. **Ingen aktive rader = svar «tavla er tom».**

Dette er tiltenkt Kenneths sikkerhetsnett når B1/B2 svikter en tredje gang — ikke hans ansvar å huske. Svikter tavla igjen **med** disse bindingene på plass, er ikke svaret en tredje regel: da er det formen som er feil, og mekanismen skal erstattes, ikke forsterkes.

### Én ting til — økter uten branch

Test-økter (web-Opus, simulator-Opus) leverer rapporter, ikke commits, så B2 utløses aldri for dem. **De lukkes når testplanen de kjører får status «KJØRT»** — samme commit-binding, annen utløser. En testplan uten utfall er en åpen økt.

## Opus-livssyklus — fire faser (vedtatt 2026-07-16)

**Bakgrunn:** regelen om statustavle sto her fra 2026-07-06 og ble aldri utført. 2026-07-16 kostet det nesten en økts arbeid: to økter fikk samme branch-navn (`docs/status-aktuelt-oppbrudd`), og den ene slettet den mens den andre skulle bruke den — ren flaks at rekkefølgen reddet det. Samme kveld fikk to økter samme arbeidstre (`SiteDoc-oppfolgere`), så auditens tre flyttet seg under den mens den kjørte. **En regel uten mekanisme utføres ikke. Tavla er mekanismen — den virker fordi Kenneth ser den, ikke fordi den er en regel.**

| Fase | Hva skjer | Hvem |
|---|---|---|
| **1. ÅPNE** | Rad i tavla **før** økta åpnes: navn · arbeidstre · branch · filer den eier · dato. Ingen to rader deler arbeidstre eller fil. Branch-navn prefikses per spor → kollisjon umulig ved konstruksjon, ikke ved disiplin. **Kjør kollisjons-sjekken under.** | cowork skriver raden, Kenneth åpner |

**Kollisjons-sjekk før hver tavle-rad — fire delte ressurser filoverlapp IKKE fanger** (2026-07-16; de tre første målt før de rakk å koste noe, den fjerde etter at den kostet):

1. **i18n-generatoren.** To økter som begge legger nøkler kjører `generate.ts` mot 13 språk. **Aldri parallelt** — det gir garantert konflikt i 15 filer, ikke i de to de redigerte. Fabel-krav.
2. **`localhost:3100/3001`.** Dev-serveren er ÉN. Trenger to økter kjørende app samtidig, må den ene bruke test — eller vente. (Og en dev-server kan servere fra et helt ANNET tre enn økta tror den tester; sjekk `cwd` på pid-en.)
3. **Delte komponenter bak ulike sider.** Filoverlapp på side-nivå fanger ikke at to sider rendrer samme komponent. Målt eksempel: `sjekklistemaler/[id]` og `oppgavemaler/[id]` bruker begge `MalBygger` — én økt eide sidene, en annen skulle bygge inn i komponenten. Sjekk hva sidene *importerer*, ikke bare hvilke filer de er.
5. **🔴 Kenneths nettleser.** `chrome-devtools-mcp` kjører med `--isolated=false --channel=stable` og `playwright-mcp` med `--extension` — **begge styrer Kenneths faktiske Chrome, ikke en skjult sandkasse.** Navigeringer, cookie-injisering og klikk skjer synlig i vinduet han sitter i.

   **Målt 2026-07-21:** A-3b-Opus kjørte browser-verifisering i den tro at den var isolert. Kenneth meldte «siden blinker veldig fort» — det var Fast Refresh + «Throttling navigation»-loop fra automatiseringen, i hans eget vindu. Økta stoppet, drepte dev-serveren, fant rotårsaken selv og ryddet all testdata.

   **Regel:** en Opus som vil verifisere i nettleser skal **spørre Kenneth først**, og oppgi hvilken URL og hvor mange steg. Foretrekk alltid en isolert render-test (jsdom) når den kan bevise det samme. **To økter kan aldri kjøre browser-automatisering samtidig** — det er én nettleser.

6. **Lokal dev-server (`localhost:3100`/`3001`).** Én instans. Starter en økt den fra sitt worktre, kan Kenneth ha en fane pekt mot en helt annen kodebase enn han tror. Drep alltid serveren etter bruk og meld fra at den er drept.

4. **Statusfilene: `STATUS-AKTUELT.md` · `STATUS.md` · `BACKLOG.md`.** Den mest forutsigbare kollisjonen som finnes, og den manglet på lista til den slo til. **Hver** funksjonsendring MÅ røre dem (CLAUDE.md § Funksjonsendrings-commits) — så to økter som leverer kode kolliderer der per definisjon. **Cowork redigerer dem ikke mens en økt er mid-leveranse.** Må det gjøres, eier cowork oppryddingen i merge-en, ikke Opus.

> ⚠️ **En ren merge er ikke en riktig merge — git fletter tekst, ikke sannhet** (målt 2026-07-16, `2f014f6e`).
>
> Cowork redigerte `STATUS.md`/`BACKLOG.md` mens M-3a del 2 kjørte, og ordren cowork selv skrev sendte del 2 inn i de samme filene. Innholdet var en ekte motsigelse: del 2 skrev «antall uendret 67», cowork skrev «TALLET ER UPÅLITELIG — disk har 76».
>
> `STATUS.md` ga tekstkonflikt — **det var flaks**: begge punktlistene landet på samme linje. Hadde de ligget tre fra hverandre, ville git flettet plettfritt og sendt begge påstandene til `develop`. `BACKLOG.md` fikk nettopp den behandlingen: ren auto-merge, null varsel.
>
> **Konfliktmarkører er ikke gaten.** Les innholdet på begge sider av hver merge som rører en statusfil.
| **2. LEVER** | Commit til feature-branch + `git push -u origin feat/x`. **Aldri push til `develop`.** Meld hash. | Opus |
| **3. EXIT** | Fast spørsmålsrunde — **ikke valgfri**. Se § Exit-runde. | cowork spør, Opus svarer |

> ⚠️ **«Exit» er tvetydig — skriv aldri «exit X» i en aksjonsblokk.** Her betyr EXIT *fase 3* (spørsmålsrunden). I dagligtale betyr det *fase 4* (lukk vinduet). 2026-07-16 skrev cowork «Så exit develop-Opus» øverst med selve exit-teksten nederst; Kenneth var i ferd med å lukke økta **uten** å kjøre runden — og fanget det selv. Bruk «**send exit-runden til X**» (fase 3) og «**lukk X**» (fase 4). Mister vi runden, mister vi det som har gitt mest: den fanget 🔴 4c, Norkart-nøkkelen og tre hull i coworks egne ordrer.
| **4. LUKK** | Merge → **park treet detached** → slett branchen **lokalt OG på origin** → **fjern treet hvis det er utenfor det faste settet** → **kjør inventaret (under)** → fjern raden → lukk vinduet. **En økt er ikke død før raden er borte.** | cowork, så Kenneth |

**Inventaret — én kommando, kjøres ved HVER økt-lukking:**

```sh
cd ~/Documents/Programmering
for d in SiteDoc SiteDoc-deploy SiteDoc-develop SiteDoc-merge; do
  printf "%-18s" "$d"
  printf " branch=%-14s endret=%-4s ikke-i-develop=%s\n" \
    "$(git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null)" \
    "$(git -C "$d" status --porcelain 2>/dev/null | wc -l | tr -d ' ')" \
    "$(git -C "$d" log --oneline origin/develop..HEAD 2>/dev/null | wc -l | tr -d ' ')"
done
git -C SiteDoc worktree list
git -C SiteDoc stash list
```

**Forventet:** fire trær · `endret=0` overalt · ingen stash. **Alt annet er et funn.** Et femte tre, en untracked fil, eller en stash betyr at noe ble opprettet uten at noen vet hva det er.

> ⚠️ **Hvorfor steget finnes: opprettelse er ugatet, sletting er det ikke** (målt 2026-07-17). `CLAUDE.md` sier «spør alltid før du sletter filer eller mapper», og den håndheves strukturelt — Kenneth kjører hver kommando. **Ingen regel finnes for å opprette.** Resultat: åtte arbeidstrær vokste fram, og tre leveranser lå foreldreløse i 5 uker, 6 dager og 5 uker.
>
> **Alle tre ble funnet ved tilfeldighet** — én fordi `git worktree remove` nektet på et dirty tre, én fordi Kenneth spurte hvorfor den ikke var søkbar i Finder, én fordi cowork lette etter noe annet. **Ingen prosess fant noen av dem.** Inventaret er billig og svarer selv; det hadde fanget trærne ved to og en foreldreløs fil etter én økt.

> ⚠️ **«Ingen commits» gjelder kode — aldri leveranser** (fabel-regel 2026-07-17). **Hver økt som produserer en fil, får en git-vei for den i ordren** — docs-branch eller Kenneth-relay. En lese-økt skriver ikke kode; den skriver rapporter, og en rapport som ikke committes finnes ikke for noen andre enn maskinen den ligger på.
>
> **Belegg — tre foreldreløse leveranser funnet på tolv timer, alle fra samme klausul:** fase-M-forarbeidets tre rå-vedlegg (beviskilden matrisen `fd0ee7a2` sto på — untracked i repo-rota) · `plan-testflight-38.md` (22 KB, seks dager, Kenneth spurte selv hvorfor den ikke var søkbar) · `kode-doc-avvik.md` (18 KB, fem uker, funnet **kun** fordi `git worktree remove` nektet på et dirty tre). Ingen av dem gikk tapt — alle tre ble funnet ved tilfeldighet.
>
> **Fase 4 har nå feilet på samme måte to ganger:** 86 merged branches på origin (remote-steget manglet) og seks arbeidstrær utenfor det faste settet (tre-steget manglet). Begge fordi steget var en intensjon i stedet for en linje i sjekklisten. **Det faste tre-settet står i [parallell-arbeid-lock.md](parallell-arbeid-lock.md)** — et femte tre krever en tavle-rad for å eksistere.

**Fase 4-mekanikk (lærdom 2026-07-16 — regelen feilet på første anvendelse):** `git branch -d` **nekter** å slette en branch et arbeidstre holder («cannot delete branch … used by worktree at …»). Treet må frigjøres først, og det kan **ikke** sjekke ut `develop` — `SiteDoc-merge` holder den, og git nekter samme branch i to trær. Riktig sekvens:

```sh
cd <arbeidstre> && git checkout --detach origin/develop
cd ~/Documents/Programmering/SiteDoc-merge
git branch -d <branch>
git push origin --delete <branch>
```

Første linje frigjør branchen. `git branch -d` er **-d, aldri -D** — den skal nekte hvis noe er umerget. Siste linje er **remote-steget**, og det er nytt: fase 4 hadde det aldri, og resultatet var **86 merged feature-branches liggende på origin** da hullet ble målt 2026-07-16. Uten linje 4 vokser de videre.

**Et ledig arbeidstre skal stå detached på `origin/develop`.** Da er branchen fri, treet er klart for neste økt uten oppsett, og fase 1 trenger kun `git checkout -B <ny-branch> origin/develop`.

**Er tavla tom, lever ingen økter.** Det er hele poenget: kontrollflaten er lesbar for Kenneth uten å spørre noen.

> ⚠️ **Regelen feilet på første anvendelse — cowork laget aldri raden** (2026-07-16). M-3a del 2 kjørte en hel kveld, bygde 42 filer og ble merget to ganger mens tavla sa «*(ingen aktive)*». Kenneth kunne lest kontrollflaten sin og konkludert at ingenting kjørte.
>
> **Fase 1 er ikke «lag raden når du rekker det» — den er før vinduet åpnes.** Raden er billigst å skrive i det ordren formuleres; da har cowork allerede arbeidstre, branch og fil-eierskap i hodet. Skrives den ikke da, skrives den aldri: økta leverer, og en tavle-rad for noe som er ferdig føles overflødig — så hullet lukker seg selv uten at noen merker at kontrollflaten var blind imens.
>
> Dette er tredje regel cowork skrev og selv brøt innen 48 timer (STATUS-vedlikehold på egen merge `fd0ee7a2`; kollisjons-sjekken uten statusfilene; tavla). **Mønsteret er ikke at reglene er dårlige — det er at de skrives raskere enn de internaliseres.** En regel uten et sted den tvinges fram er en intensjon.

### Ordre-anatomi — mal, ikke hensikt (vedtatt 2026-07-16)

**Bakgrunn:** ordre-formatet som fanget **fire av coworks ti feil** 2026-07-15/16 fantes kun i coworks hode. Det er Norkart-mønsteret: kanalen finnes, den ble ikke brukt, og kunnskapen dør med økta. En gate kan sjekke en **mal**; den kan ikke sjekke «skriv gode ordrer».

**Coworks ordre-mal — seks blokker, kopierbar:**

```
[1. HVA SOM ER GJORT]      Hasher + hva de gjorde. Hindrer at økta gjentar landet arbeid.
[2. HVA SOM GJENSTÅR]      Den faktiske oppgaven + åpne tråder uten eier.
[3. OPPGAVE / SPØRSMÅL]    Ved exit: de fire spørsmålene ORDRETT (se under), ikke omskrevet.
[4. UFRAVIKELIG]           Arbeidstre + branch + filer den eier (ingen deling!) + de fire linjene under.
[5. FORVENTET OUTPUT]      Per funn: hva, hvordan målt, alvorlighet. Mistanker merket separat.
[6. OPPRYDDING]            Hvem sletter branchen. Vanligvis cowork — økta gjør ingenting.
```

**De fire virksomme linjene — skal stå ORDRETT i ufravikelig-blokka:**

| Linje | Hva den fanget 2026-07-15/16 |
|---|---|
| «Din rapport/ordre er **input, ikke fasit** — mål premisset selv.» | Spor 4 motbeviste D's «mengde er neppe alene» ved måling. Spor A fanget at coworks telling motsa registerets egen regel. |
| «**Sjekk om et banner alt dekker det** før du kaller noe drift.» | Hindret at tre korrekt merkede filer ble «rettet» (`deploy-detaljer:9`, `VEILEDER:125`). |
| «**Kjør negativ kontroll** — tom output kan bety at sjekken er død, ikke at den er grønn.» | Spor 1 og 4 gjorde det uoppfordret. Cowork gikk selv i fella samme kveld. |
| «Er du usikker: **SI DET, ikke gjett.**» | Spor 3 lot UE stå → avdekket at arkitektur-ankeret motsa `schema.prisma:490`. |

**Fabels ordre-mal (redesign-spor)** har samme anatomi og var like udokumentert: *bakgrunn · kodeverifisert · endringer · krav · DoD · eksplisitt utenfor scope*. Fungerende eksempel: **designprosjekt «Sitedoc redesign tips»: `delplaner/georef-panel-v2-ordre.md`** (peker navngir treet per §9 — fila bor ikke i repoet; cowork har ikke lest den, referansen er fabels). Rører fabel formen, oppdateres denne raden.

### Exit-runde — fire spørsmål (ufravikelig)

En Opus' rapport svarer på det den **lette etter**. Exit-runden henter det som ikke hadde en kategori. 2026-07-15/16 fanget den fire funn ingenting annet fant — inkludert 🔴 4c (lønns-nært) og Norkart-nøkkelens ukjente eierskap, som hadde ligget uoppdaget i fire måneder.

1. **Hva så du som ikke passet i noen kategori?** Alt utenfor bøttene dine er usynlig i rapporten.
2. **Hva forkastet du som støy?** Særlig hvis du strammet en heuristikk underveis — hva røk med?
3. **Hvilke filer/flater føltes feil uten at du kunne bevise det?** Merk som mistanke, ikke funn.
4. **Hvilke av funnene dine mistenker du har søsken du ikke rakk?**

Svar merket som usikkerhet er nyttige. En gjetning ført som funn er ikke.

## Statustavle (vedlikeholdes av cowork)

Øverst i STATUS-AKTUELT: rad per aktiv økt. Oppdateres ved rundestart (alle rader) og rundeslutt (tøm) — to commits per runde, ikke per økt.
