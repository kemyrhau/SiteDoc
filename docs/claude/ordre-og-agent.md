# Ordre og agent — /clear-regelen, ordre-anatomi, fredning, paritet, kjøreregler, exit

> Utskilt ordrett fra [SAMARBEIDSREGLER.md](SAMARBEIDSREGLER.md) (2026-11-26). §-numrene er beholdt; en § som
> ikke står her, står i kjernen [SAMARBEIDSREGLER.md](SAMARBEIDSREGLER.md) eller (regel 9/10, merge-kjeden,
> rydding) i [merge-og-gate.md](merge-og-gate.md).

## § 2 — Meldingsflyt (fortsettelse)

### /clear-REGELEN — agenten skal kunne tømmes når som helst (Kenneth-vedtak 2026-10-14)

Orkestrator tømmer en agent etter hver levert handling ([SAMARBEIDSREGLER](SAMARBEIDSREGLER.md) § 0b.3). Det er bare trygt hvis ingenting bor kun i chatten. **Tilstand som ikke står i en fil eller på origin, finnes ikke.**

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

1. Denne regelen. **3D-web og 3D-mobil:** deretter hele [3d-agent-prinsipper.md](3d-agent-prinsipper.md) (hard grense mot DWG/DXF).
2. Posten nudgen navngir, i egen innboks (søk på overskriften). Finnes den ikke: **STOPP og meld «posten finnes ikke»**.
3. Siste `SJEKKPUNKT <Agent>` i `relay/inbox-orkestrator.md`.
4. `git -C <worktree> status` + `git log -1`. Avviker treet fra sjekkpunktet: **meld avviket før du gjør noe.**

Les ikke hele innboksen. Mangler noe, var posten eller sjekkpunktet dårlig — meld det.

**Innboksfiler:** `inbox-<agent>-<emne>.md` pr. oppdrag (Redesign, Dokgen); `inbox-kontrollor.md` og `inbox-fabel.md` faste. Den gjeldende fila står i nudgen.

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
[0. SPOR + MERKE]          FASIT: Kenneths ordrette ord (bestillingen hans) først, før orkestrators tolkning.
                           Plan/funn · 🔴/🟡 · REPARASJON eller FUNKSJONSENDRING + hjemmel (SAMARBEIDSREGLER § 5).
[1. HVA SOM ER GJORT]      Hasher + hva de gjorde. Hindrer at økta gjentar landet arbeid.
[2. OPPGAVE]               Hva og hvorfor. Data, innlogging, utgangspunkt (branch/hash).
                           `fil:linje` for hvert sted som skal endres, målt av bestilleren, er startpunktet.
                           Agenten søker selv gjennom alle kodeveier som leser eller skriver samme data (web,
                           server, mobil, synk) og lister dem i leveransen før koding. Leser agenten en stor
                           doc, oppgis seksjonen, ikke fila.
[3. UFRAVIKELIG]           Tre + branch + filer den eier + de tre linjene under.
[4. FORVENTET OUTPUT]      DoD. Per funn: hva, hvordan målt, alvorlighet. Mistanker merket separat.
                           UI-retting: skjermbilder fra ekte nettleser på kopi-DB
                           (`pg_dump sitedoc_lokaltest | psql sitedoc_<agent>`; full kommando i
                           lokal-dev.md § 7), ikke bare jsdom; testflaten og `sitedoc_lokaltest`
                           røres ikke.
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
- **Delt logikk navngis** (§ 6b).
- **Verifisering:** navngi **handlingen** som trigger kodeveien, og **hvem** som verifiserer: *et tall eller en regel* → funksjonstest, ingen nettleser · *et utseende* → Kenneth (ikke automatiser et blikk) · *en flyt agenten ikke kan nå* → si det i rapporten («dette kunne jeg ikke se» er en gyldig leveranse). Ber ordren om å finne noe: be om HVOR det ble funnet og HVOR MANGE TRYKK det tok.
- **Bevis agenten kan levere.** Bevis som krever utstyr agenten ikke har, bestilles ikke av den.
- **Mobil:** verifiseres med tester + Kenneth på telefon; simulator kreves ikke. Timing, nett og WebView-livssyklus er ikke verifisert før sett på fysisk enhet (sløyfen er kode → `r` i Metro → telefon, uten byggkvote). Skjermbilder kun når spørsmålet er visuelt — det er bildene som er dyre.

### Tolkning av bestillinger

- 🔴 **«Sjekkliste» betyr ofte «dokument»** (Kenneth 2026-09-04): sier Kenneth «sjekkliste» om en funksjon, gjelder den sjekkliste, oppgave og HMS med mindre noe er spesifikt for én. Tvil → ett spørsmål.
- **Testplan med forventet utfall pr. steg** utledet fra kode før test — ellers har observasjonen ingenting å måles mot. Funn mater både kode og plan.

## § 5 — Funksjoner: fredning og paritet

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

## § 7 — Exit-spørsmålene (ved avsluttet oppdrag)

En rapport svarer på det den lette etter. Ved avsluttet oppdrag (ikke hver småleveranse) svarer agenten i leveransen:

1. **Hva så du som ikke passet i noen kategori?**
2. **Hva forkastet du som støy?** Særlig om en heuristikk ble strammet underveis.
3. **Hvilke filer/flater føltes feil uten at du kunne bevise det?** Merk som mistanke, ikke funn.
4. **Hvilke av funnene dine mistenker du har søsken du ikke rakk?**

Svar merket som usikkerhet er nyttige. En gjetning ført som funn er ikke.
