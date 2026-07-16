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

## Opus-livssyklus — fire faser (vedtatt 2026-07-16)

**Bakgrunn:** regelen om statustavle sto her fra 2026-07-06 og ble aldri utført. 2026-07-16 kostet det nesten en økts arbeid: to økter fikk samme branch-navn (`docs/status-aktuelt-oppbrudd`), og den ene slettet den mens den andre skulle bruke den — ren flaks at rekkefølgen reddet det. Samme kveld fikk to økter samme arbeidstre (`SiteDoc-oppfolgere`), så auditens tre flyttet seg under den mens den kjørte. **En regel uten mekanisme utføres ikke. Tavla er mekanismen — den virker fordi Kenneth ser den, ikke fordi den er en regel.**

| Fase | Hva skjer | Hvem |
|---|---|---|
| **1. ÅPNE** | Rad i tavla **før** økta åpnes: navn · arbeidstre · branch · filer den eier · dato. Ingen to rader deler arbeidstre eller fil. Branch-navn prefikses per spor → kollisjon umulig ved konstruksjon, ikke ved disiplin. | cowork skriver raden, Kenneth åpner |
| **2. LEVER** | Commit til feature-branch (ikke push). Meld hash. | Opus |
| **3. EXIT** | Fast spørsmålsrunde — **ikke valgfri**. Se § Exit-runde. | cowork spør, Opus svarer |

> ⚠️ **«Exit» er tvetydig — skriv aldri «exit X» i en aksjonsblokk.** Her betyr EXIT *fase 3* (spørsmålsrunden). I dagligtale betyr det *fase 4* (lukk vinduet). 2026-07-16 skrev cowork «Så exit develop-Opus» øverst med selve exit-teksten nederst; Kenneth var i ferd med å lukke økta **uten** å kjøre runden — og fanget det selv. Bruk «**send exit-runden til X**» (fase 3) og «**lukk X**» (fase 4). Mister vi runden, mister vi det som har gitt mest: den fanget 🔴 4c, Norkart-nøkkelen og tre hull i coworks egne ordrer.
| **4. LUKK** | Merge → **park treet detached** → slett branchen → fjern raden → lukk vinduet. **En økt er ikke død før raden er borte.** | cowork, så Kenneth |

**Fase 4-mekanikk (lærdom 2026-07-16 — regelen feilet på første anvendelse):** `git branch -d` **nekter** å slette en branch et arbeidstre holder («cannot delete branch … used by worktree at …»). Treet må frigjøres først, og det kan **ikke** sjekke ut `develop` — `SiteDoc-merge` holder den, og git nekter samme branch i to trær. Riktig sekvens:

```sh
cd <arbeidstre> && git checkout --detach origin/develop   # frigjør branchen
cd ~/Documents/Programmering/SiteDoc-merge
git branch -d <branch>                                    # -d, aldri -D: nekter umerget
```

**Et ledig arbeidstre skal stå detached på `origin/develop`.** Da er branchen fri, treet er klart for neste økt uten oppsett, og fase 1 trenger kun `git checkout -B <ny-branch> origin/develop`.

**Er tavla tom, lever ingen økter.** Det er hele poenget: kontrollflaten er lesbar for Kenneth uten å spørre noen.

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
