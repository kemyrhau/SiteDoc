---
name: historikk-2026-11
description: Arkiv fra november 2026. Utdaterte tavle-snapshots og leverte saker flyttet hit fra STATUS-AKTUELT.
sist_verifisert_mot_kode: 2026-11-12
---

# Historikk november 2026

## Tavla og coworks kø, flyttet ordrett fra STATUS-AKTUELT 2026-11-12

Erstattet av ny tavle ført fra måling. Innholdet under er ikke remålt.

### 🔴 TAVLA (arkivert) — hvem sitter hvor

**Eneste skribent: orkestrator** (cowork-rollen utgikk 2026-09-30). 🔴 **Føres FRA MÅLING — `git log
origin/develop`, `git worktree list`, `git branch -r` — aldri fra hukommelse.**

**Sist ført: 2026-09-23 · develop `77308515` ← `docs/design-fjerde-tapte-funksjon` `362521ce` `--no-ff` (OCR som fjerde tapte funksjon; `dwgread`-navn rettet). Non-ff, målt trygt selv: base `6edda731` i develop, `BACKLOG.md` 0 rørt på develop siden basen, `merge-tree` 0 konfliktmarkører. Faktisk endring mot develop = KUN `BACKLOG.md` +19/−3 (2-punkts-diffen viste også STATUS-AKTUELT.md fordi branch-base var før georeferanse-tavla; 3-veis merge beholdt develop-versjonen — verifisert intakt). GATE `--force` (0 cached): db 243 · api 542 · pdf 128 · shared 854 · web 307 · mobil 38 · 7/7 — ALT STILLE. `feat/server-kapabilitetsprobe` `f0e5702d` (designgatet — merges nå) + `fix/pdf-omrade-navn` `b223d036` (venter designs gate) urørt ved skriving.**

**Sist ført: 2026-09-23 · develop `bc311165` ← `feat/server-kapabilitetsprobe` `f0e5702d` `--no-ff` (lesende kapabilitetsprobe + `ny-server-veileder § 7`). Designgatet, ingen vilkår. Docs-commit `58cf2e59` rett før. Mergen la til nøyaktig TO filer: `docker/kapabilitetsprobe.sh` (+466) og `docs/claude/ny-server-veileder.md` (+50). GATE `--force` (0 cached): db 243 · api 542 · pdf 128 · shared 854 · web 307 · mobil 38 · 7/7 — ALT STILLE (proben har ingen testflate). web build exit=0, mobil typecheck exit=0. Hovedtreet ff'et 5634f884 → bc311165 (43 commits), rent.**

**Sist ført: 2026-09-26 · develop `6b803433` ← tre docs-merger `--no-ff` i fast rekkefølge: `docs/design-maalekommando` `0d060146` (tegn-måleregelen — python3 med LC_ALL-alternativ og forbehold) · `docs/claudemd-eslintrc` `b6c67fac` (CLAUDE.md: `apps/web` bruker `.eslintrc.js`; SAMARBEIDSREGLER: merge-tree-funnet) · `docs/design-ordre-fb4-fd3-7b` `9b487c98` (§7b-ordre, ny fil). 🔴 **Merge 1 KONFLIKTERTE i CLAUDE.md** — begge sider hadde skrevet om tegn-måleregelen; `git merge-tree` ga 0 konfliktmarkører for ANDRE gang. Oppløsning stadfestet av cowork på forhånd (designs side gjelder), målt i engangsklon før ordren. **CLAUDE.md = 40 446 tegn** (python3), 514 under taket. GATE `--force`: db 269 · api 624 · pdf 128 · shared 886 · web 327 · mobil 44 · 7/7. Byggeledd hoppet over — alle tre merger er docs-only, 0 kodefiler. `feat/mal-up-deling` + `feat/synlighet-samlet` slettet fra origin (begge ancestors av develop, 0 filer utenfor). `redesign/navigasjon` bevart (Regel 9).**

**Sist ført: 2026-09-27 · develop `87038042` ← seks merger `--no-ff` etter `6b803433`: `fix/kb4-hjelpetekst-opsjonsnavn` `acbe1bdf` (bar MK C fase 2 `0eddfdb3` som ancestor — ÉN merge tok begge; db 269→272) · fem docs-merger (`fall-konsistens`, `fjern-graa-r2`, `trekk-graa-ordre`, `endringsvern-blindsone`, `trafikklys-verdisett`). GATE etter kode-mergen: db 272 · api 624 · pdf 128 · shared 886 · web 327 · mobil 44 · 7/7, alle tre byggeledd exit 0. Åtte brancher slettet fra origin i løpet av døgnet; `redesign/navigasjon` bevart (Regel 9). **Urørt ved skriving:** `feat/signert-lenke` `1c5f72a0` (hos design for gate) · `fix/trafikklys-foreldreloes-verdi` `8a3046fa` (returnert til dokgen av coworks gate).**

**Sist ført: 2026-09-27 · develop `68302a94` ← seks merger etter `87038042`. Én av dem er kode: `feat/signert-lenke` `1c5f72a0` (to commits) — **`STANDARD_LEVETID_MS` senket fra 24 t til 15 min**, siste konsumentklasse på `/uploads/`-signaturgaten lukket. Fem er docs (PSI-måling, PSI-domeneregel + nullhull, FB4/FD3-normhenvisning, BACKLOG-leveranser, gate-tall-regelen). GATE på kode-mergen: db 272 · api 623 · pdf 128 · shared 886 · web 331 · mobil 44 · 7/7, tre byggeledd exit 0. **Urørt ved skriving:** `fix/psi-prosjektniva-unik` `05e8aff6` og `fix/trafikklys-foreldreloes-verdi` `2a4e03be`, begge hos design.**

**Sist ført: 2026-09-28 · develop `38567b33` ← ti merger etter `1c432a29`. Kode: `fix/signert-bilde-flere-forsok` `4ef039fd` (1→3 gjenforsøk med backoff, budsjett dekoblet fra lenke-klassen) · `fix/psi-p2002-haandtert` `e0820f46` (stille feil ved PSI nr. 2 lukket) · `feat/trafikklys-verdisett` `ab1efe2c` (rendreren leser `config.options`). GATE på siste: api 634 (+6) · shared 898 · web 349 · pdf 131 · db 277 · mobil 49 · 7/7, tre byggeledd exit 0. Docs: § 0 Kenneths forventninger, septemberarkiveringen, to designordrer. **Origin er ren — kun kjerne + `redesign/navigasjon` (Regel 9).** 🔴 **Prod er `eb9071f2` fra 24.09 — develop er 130+ commits foran med tre umigrerte migreringer og `/uploads/`-gaten som aldri har kjørt utenfor develop.**

**Sist ført: 2026-09-29 · develop `1b7fc87b` ← `feat/web-annotering-og-paritet` `d4c7db3d` (38 filer, +1292/−56) + `fix/forgiftede-vedlegg-urler` `aefb560a` + docs. GATE: shared 921 · web 358 · api 638 · pdf 131 · db 277 · mobil 49 · 7/7, kald web-build uten TS2589. **Test kjører `acdfd750`; alt etter det er udeployet.** 🔴 **Prod er fortsatt `eb9071f2` fra 24.09.**

**Sist ført: 2026-09-29 · develop `230f2b64` ← `fix/annotering-raa-url-og-pil` `0a91dd4a`. Deployet til test (bygget 22:11) og testet av Kenneth. 🔴 **Prod er fortsatt `eb9071f2` fra 24.09.**

**Sist ført: 2026-11-05 · test kjører `e795fd8d` (bygget 19:03, `/version` kontrollert).** Bærer ordre 10 (byggeplass per timer-/maskin-rad i web, merge `6638abd8`) og ordre 11 (HMS-ballen blir hos HMS-gruppa ved deaktivering, merge `616d0248`). Verifisert i nettleser på test: timerad — 0 byggeplasser skjult, 1 satt automatisk, 2+ nedtrekk; toppbar-byggeplass forhåndsvalgt kun i eget prosjekt; prosjektbytte nullstiller; uendret lagring beholder byggeplass; radlinje viser «· navn». HMS — X med «Fra firma» på flytkortet for firma-admin, fjern-modal og fjerning virker, deaktiver-modal viser prosjekter/flytledd (HMS-saklinje kun ved > 0, ikke testet med saker). Testdata etterpå: HMS-rolle og HMS-modul i Agent Bygger bygg slått av igjen; én timerad (7,5 t, Bygg B12) står i kmy sin kladd 07.08.

**STATUS 2026-09-30 (kveld) — ført fra måling: `git worktree list` + ancestor-sjekk på hver hash.**

🔴 **Tre bemannede spor, ikke seks (Kenneth-vedtak 2026-09-30).** Seks trær finnes og skal
stå — et tomt tre koster ingenting og lar en agent startes på sekunder. **Men seks parallelle
produsenter foran én seriell merge gir kø, og kø er der de nye hullene oppstår:** to agenter
som rører samme fil fra ulik vinkel. Det skjedde to ganger 29.–30.09 (tvilling-driften i
`ANNOTERINGS_HTML`, og vaksinen som måtte gjøres nøkkel-agnostisk om).

| Spor | Agent | Worktree | Branch | Tilstand |
|---|---|---|---|---|
| **Plan** | dokgen | `SiteDoc-dokgen` | — (detached) | 🟢 **Ledig. V19.9-A2 MERGET `d16f4521` ← `4f81b7c6` 2026-10-06** (orkestrator-gate). 🟢 **I PROD `7845e9e8`.** Regel 10: typecheck 11/11 · web build 0 · 7/7 --force 22s · api 746 · shared 1097 |
| **Plan** | kontrollplan | `SiteDoc-kontrollplan` | `feat/v17b-soner` (ny) | 🟡 **Ordre skrevet 2026-10-04** — V17-B: soner (db `omrader.geo_polygon` + api + web-modal med geoman) (`relay/inbox-kontrollplan-v17b-soner.md`). V17-A merget `8987843f` — 🟢 **i prod `7845e9e8`**. Geoman målt: peer `leaflet ^1.2` (vi 1.9.4), `KartVelger` bruker Leaflet direkte |
| **Funn** | redesign | `SiteDoc-redesign` | — (ledig) | ✅ `fix/matpause-avkrysning` MERGET `a933898f` (V20 PK2: manuell rad bærer pausen synlig). 16:00 var Kenneths egen redigering. 🟢 **I PROD `7845e9e8` + OTA prod-kanal 2026-10-06.** V20-S/S2/W 🟢 **I PROD `4f7998c7` 2026-10-07** |
| **Måling** | kontrollplan | `SiteDoc-kontrollplan` | `feat/mobil-bilde-selvfornyelse` | 🔴 **Jobber** — krav 3b, siste ledd før Kenneths deploy |
| **Kontroll** | kontrollør | `SiteDoc-design` | ingen — skriver ikke kode | 🟡 **Ordre skrevet, agent ikke startet.** Første oppdrag: gate krav 3b |
| — | mal | `SiteDoc-mal` | — | 🟢 Ledig |
| — | simulator | `SiteDoc-simulator` | — | 🟢 Ledig (`docs/simulator-miljoemaaling` i develop) |
| — | merge | `SiteDoc-merge` | `merge-restart` `85111353` | ⚠️ **Bak develop.** Rollen utgikk — orkestrator merger fra hovedtreet |

🟢 **Alle 11 gatede hasher i `relay/gate-status.md` er verifisert i develop** (`merge-base
--is-ancestor`). **Køen er tom** — ingenting gatet ligger umerget.

> 🟢 **`SiteDoc-design` har `node_modules` og genererte Prisma-klienter** og kan **kjøre**
> suiten, ikke bare lese repoet. Det var slik `tsc`-driften ble sporet til `29b0c9a5` — ved å
> kjøre på begge sider av commiten, ikke ved å resonnere. **Det er også derfor kontrolløren
> bor der:** en gate som ikke kan kjøre noe, kan bare lese.

🔴 **Målt om arbeidsformen, 93 commits siste tre døgn:** 29 `docs` · 21 `fix` · **3 `feat`** ·
38 merger. **Flaskehalsen er ikke produksjonskapasitet — det er runder pr. leveranse.**
`erServerUpload` alene tok tre runder. **Derfor bærer hver ordre nå gate-kriteriene på
forhånd** — kantene gaten kommer til å teste står i ordren, så runde 1 består.

### 🔴 2026-09-29 — KENNETH AVVISER BÆRER-MODELLEN FOR LAGREDE OBJEKTER

> *«URL skal ikke være nok for å hente ut et bilde → vi skal ha en gyldig innlogging → dette
> gjelder alle objekter som lagres og tilhører systemet»*

**Målt:** `hmac.ts:231` (`vurderUploadsFilForesporsel`) er **signatur-kun**. Kommentaren rett
over funksjonen siterer Kenneths krav fra **2026-09-24** — «sjekk om den som henter ut bilder
er innlogget» — og konkluderer likevel med «Ingen sesjons-fallback». 🔴 **Kravet ble lest som
«strammere signatur» i stedet for «innlogging». Dette er andre gang samme krav stilles.**

**Målt samme runde — gaten er ellers tett:** `server.ts:114` kjører på hver forespørsel,
normaliserer stien før sjekken, ingen localhost-bakvei, ingen intern nøkkel. **En gjettet
adresse gir 401. En sjekkliste kan ikke hentes med en URL.** Eksponeringen er en *signert*
lenke som lekker, i 15 minutter, for én fil.

🟢 **Kenneth aksepterte restrisikoen eksplisitt:** *«15 minutter er ikke et problem → risiko
for tyveri er betydelig redusert til pågående arbeid»*. **Signaturen beholdes som den er —
innlogging legges OPPÅ, ikke i stedet for.** Utløpet skal ikke fjernes.

⚠️ **Cowork leverte én feilmåling i denne saken** og korrigerte den selv: påstod at
PDF-genereringen ville brekke av innloggingskravet. Målt etterpå — `sammenstilling.ts:124-136`
leser filene fra disk og bygger dem inn som data-URI-er i en container uten nett, og passerer
aldri gaten. **Mobilen er den eneste reelle usikkerheten og er første punkt i måleordren.**

Hjemmel ført i [FUNKSJONSENDRINGER.md](FUNKSJONSENDRINGER.md) **før** ordren gikk ut.

### 🔴 2026-09-27 — TRE VARIANTER AV SAMME COWORK-FEIL PÅ ÉN ØKT

**Alle tre kostet merge-agenten en runde, og alle tre ble fanget av ham, ikke av cowork:**

| Formen | Hva som skjedde |
|---|---|
| Ukommittert edit i hovedtreet referert i en ordre | `CLAUDE.md`-editen «forsvant» — cowork committet den til en branch mens merge målte |
| Gate-tall arvet fra en ANNEN branch | `web +7` fra trafikklys-branchen inn i signert-lenke-ordren; faktisk `+4`. Ordren hadde gjort tallet til en gate, så merge brukte en runde på å lete etter tre tester som aldri fantes |
| Hash committet lokalt ETTER at branchen var pushet | Ordren oppga tre hasher, origin hadde to. Gate-tall-regelen landet ikke, selv om merge-commiten nevnte den |

🟢 **Begge regler er nå på develop** ([SAMARBEIDSREGLER](SAMARBEIDSREGLER.md)): forventede gate-tall
kopieres fra leverandørens rapport på **den** branchen ordren gjelder, og **hver hash i en ordre
verifiseres på origin før ordren sendes** — også coworks egne. ⚠️ **Og: be aldri Kenneth pushe en
branch cowork fortsatt skriver på.**

### 🔴 2026-09-26 — `git merge-tree` LØY ANDRE GANG PÅ TO DAGER

**Begge gangene på CLAUDE.md, begge ganger samme mekanikk:** en branch skrevet mot en base der
tegn-/størrelsesregionen så annerledes ut, og `develop` hadde rørt nøyaktig den regionen i
mellomtiden. `git merge-tree <base> develop <branch>` ga **0** begge ganger; ekte merge ga
`CONFLICT (content)` begge ganger.

🟢 **Regelen er nå skrevet inn** ([SAMARBEIDSREGLER § Kollisjonssjekken](SAMARBEIDSREGLER.md)): ekte
prøvemerge i et engangsklon er belegget, `merge-tree` er en proxy som aldri er eneste bevis — og
**cowork stadfester OPPLØSNINGEN i merge-ordren** når prøvemergen konflikter, slik at merge-agenten
ikke tar en redaksjonell avgjørelse i en fil cowork eier. Det ble utført slik i denne runden.

⚠️ **Underliggende årsak, ikke løst:** CLAUDE.md får nå tre–fire editer pr. døgn fra ulike kilder mot
overlappende regioner, og en branch rekker ikke å bli merget før basen er foreldet. **Docs-branchene
som rører CLAUDE.md skal derfor merges samme døgn de gates**, ikke stables.

### 🔴 2026-09-23 — KAPABILITETSPROBEN KJØRTE MOT `server-ny` OG FANT EN FEMTE TAPT FUNKSJON

**Første kjøring mot ekte server. Exit 1, fire KREVES-mangler — cowork forutså to.**

| Funn | Tilstand |
|---|---|
| `sitedoc-web` mangler `pdftoppm` + `tesseract` | 🔴 Bekreftet. `sitedoc-api` har begge. Kontrollplans hotfix treffer riktig |
| 🔴 **`SITEDOC_INTEGRATION_KEY` fantes ikke** — lengde 0 i begge containere, 0 treff i alle tre env-filer | ✅ **LUKKET samme dag.** Ny nøkkel i `felles.env`, `INTEGRATION_len=64` verifisert i begge. 0 rader i `organization_integrations` → ingen data tapt. **Femte tapte funksjon fra serverflyttingen** ([BACKLOG](BACKLOG.md)) |
| 🟡 `FIL_SIGNING_SECRET` virksom (64), men duplisert i `api.env`+`web.env` mens `felles.env` var tom | Åpen — `DOCKER-NOTES.md:141` forbyr duplisering. Rotasjons-fella står. **Egen runde; ikke ri med** |
| ⚠️ Probens env-sjekk leste ÉN fil og meldte «MANGLER» | 🟢 Rettet av simulator (`fix/probe-env-sjekk` `fecb3747`) — skiller nå «finnes ikke» fra «ikke her», og melder duplisering som eget `ENV_DRIFT`-avvik som ikke teller mot exit |

🟢 **Proben tjente inn seg selv på første kjøring.** De fire binærmanglene var kjent; den femte var det ikke, og den ville blitt funnet først når en kunde skulle koblet til Proadm.

### 🟡 Feltfunn 2026-09-24 (funn-sporet, ikke blokkerende)

- **Banneret sier «DWG-konvertering feilet» også for PDF-feil** (`apps/web/src/app/dashbord/[prosjektId]/tegninger/page.tsx:883`). Del av grunnen til at PDF-feilen så ut som en DWG-sak. Krever i18n i 15 språk.
- 🔴 **AVKLART OG MÅLT — nedlastede filer får UUID som navn.** Symptomet så ut som en opplastingsfeil (ny tegning listet som `40ae60ab-…`), men opplastingen gjør riktig: `apps/web/src/app/dashbord/oppsett/byggeplasser/page.tsx:310` setter `setMetaNavn(fil.name.replace(/\.[^.]+$/, ""))` — filnavnet uten endelse. **UUID-en VAR filnavnet.** Kenneth lastet fila ned fra prod, og den kom ut som `<uuid>.pdf`.
  **Rotårsak:** `apps/api/src/routes/upload.ts:133` lagrer på disk som `<uuid>.<ext>` (riktig — hindrer kollisjon), men `apps/api/src/server.ts:131` setter `Content-Disposition: inline` **uten `filename=`**. Nettleseren har da ingenting å gå på og bruker siste URL-ledd.
  **Treffer alt en bruker laster ned:** tegning, vedlegg, arkiv-PDF. ⚠️ **Ikke målt:** om alle nedlastingsveier går gjennom `server.ts:131` eller om arkiv-PDF/vedlegg har egne — det avgjør om fiksen er ett eller tre steder.
  ⚠️ **Nær 🔴-grensen:** ingen blokkeres, men et dokument som skal kunne vises til i en tvist, kan ikke hete `40ae60ab-2cd0-46a3-8238-1f9a4bf5ba65.pdf`.

### 🔴 2026-09-24 — DWG-BINÆRER OG GEOREFERANSEFIKS MÅ I SAMME RELEASE

**Designs måling (`docs/design-bind-239-296`):** `dwgKonvertering.ts:980` er det **eneste** stedet som bygger en georeferanse automatisk — PDF-veien gjør det ikke. Autoveien kan ikke kjøre i dag fordi `dwg2dxf`/`dwg2SVG` mangler.

🔴 **Konsekvens: saken har intet levende offer, men en FRIST.** Første DWG som lastes opp etter at binærene er tilbake, får en rotert georeferanse (autoveien setter `point1`+`point2` og aldri `ekstraPunkter`, `dwgKonvertering.ts:979-991`). **Gjenoppretting av binærene og georeferansefiksen skal ligge i samme release — ikke i rekkefølge.**

🟢 **Kenneths manuelt kalibrerte tegninger er IKKE berørt.** Mistenktmengden er auto-georefererte DWG — koordinatfestet av kode, med to punkter koden selv valgte. Manuelle tegninger med ≥3 punkter går til `beregnAffine` (`georeferanse.ts:199-200`) og har aldri vært innom 2-punktssimilariteten.

⚠️ **`pdftoppm` + `tesseract` har INGEN slik kobling** og kan deployes fritt. Bindingen gjelder kun DWG.

⚠️ **Målt 2026-10-09:** binærene er nå i prod (`64de37bd`, `dwg2dxf 0.14`), men georeferansefiksen (DWG-3, [tegning-dwg-spec.md](tegning-dwg-spec.md) D7) er ikke levert. Autoveien i `64de37bd` bygger fortsatt kun `point1`+`point2` (`apps/api/src/services/dwgKonvertering.ts:1362-1374`). Bindingen over er dermed brutt — orkestrator/Kenneth vurderer.

### Én branch pushet, ikke merget

| Branch | Hash | Hva | Tilstand |
|---|---|---|---|
| `fix/pdf-omrade-navn` | `b223d036` | dokgen runde 2 — `omradeNavn`/`omradeType` i arkiv-sammenstillingen, begge dokumenttyper. Hans gate: api 542→**546** (+4, nøyaktig hans fire tester), resten stille, 7/7. To tester beviser at slettet område (`onDelete: SetNull`) fortsatt gir nøytral linje, ikke tom streng — for BEGGE dokumenttyper | 🟢 LEVERT, teknisk gate grønn — 🔴 **venter designs gate** |
| `feat/revisjon-originalfil` | *(se orkestrator-inbox)* | dokgen — originalfil arkiveres pr. revisjon (`DrawingRevision.originalFileUrl`, additiv migrering `20261010120000`; kopieres fra `Drawing.originalFileUrl` ved ny opplasting → eldre tegninger beholder originalen ved neste revisjon). Web-revisjonsnedlasting: diskriminator `originalFileUrl ?? (fileUrl hvis ikke .svg)`. + `MANGLER.txt` i zip for filer som mangler på disk (stille-tomhet). Gate: api **858**, web tegning 4/4, typecheck grønt. Funksjonsendring m/ hjemmel (Kenneth 2026-10-10) | 🟢 LEVERT — venter Kontrollørs gate (migrering + tilgang) |

🔴 **DEPLOY-GATE:** `b223d036` SKAL inn før neste test-deploy — ellers skjules `omrade` som valg i lokasjonsvelgeren i den deployen. Arkiv-PDF rendres på forespørsel og er selvhelende, men en EKSPORTERT kopi bærer «Et definert område» for alltid.

🟢 **`wip/cowork-docs-2026-09-23` `6812db25`** — coworks to lokale docs-editer satt til side som navngitt branch (ikke stash: stakken er delt mellom alle worktrees). **Slettes ikke; den er gjenfinningsveien.**

⚠️ **Ikke ryddet:** `feat/server-kapabilitetsprobe` står fortsatt på origin etter merge (fase 4-steget). To eldre WIP-branches lokalt: `wip/diag-exif`, `wip/diag-ko-trigger` — opphav ukjent, ikke målt.

🔴 **Rettet:** tidligere førte jeg `a82baa9d` på proben — riktig hash er `f0e5702d` (to revisjoner siden; `UTSATT`-nivå lagt til). **Lærdom ført i SAMARBEIDSREGLER (§ Meldingsflyt):** et navn/hash/`fil:linje` i en ordre måles av den som skriver det inn, aldri arvet. Rotfeil samme runde: en statusfil ble redigert i hovedtreet som merge-treet eide seks commits lenger fram (SAMARBEIDSREGLER § Kollisjons-sjekk pkt 4).

**Tidligere ført: 2026-09-23 · develop `861c570e` ← `docs/design-georeferanse-speiling` `6edda731` `--no-ff` (georeferanse-notat + konsolidert BACKLOG). To andre BACKLOG-branches IKKE merget SOM EGNE — `6edda731` er STABLET oppå `docs/design-dwg-backlog` `648a3179` og fletter inn `docs/design-tapte-funksjoner` `b591899f` (via `a1b30efc`), så deres commits kom inn under toppmergen (verifisert: alle tre ###-poster finnes). Å merge kun toppen ga én ren merge; separate merges ville kollidert på `§ 1`. GATE `--force` (0 cached): db 243 · api 542 · pdf 128 · web 307 · shared 854 · mobil 38 · 7/7 — ALT STILLE. Diff = 2 docs-filer + tavla. `fix/pdf-omrade-navn` `b223d036` urørt (ugatet).**

**Tidligere ført: 2026-09-23 · develop `18fec301` ← fire branches `--no-ff`: `feat/omrade-lokasjonsniva` `d4d2a3e3` (steg 2b + migrering m/ CHECK-garanti) + `feat/mal-up-deling` `a2680cf6` (UP1→UP1/UP2/UP3/UO2.1) + `docs/design-up-ordre-retting` `b134f5b8` (UP-ordre begge runder; erstattet uintegrert `97908d78`) + `fix/pdf-omrade-lokasjon` `698c36c8` (arkiv-PDF områdenavn) · GATE (`--force`, 0 cached): db 243 (+32) · api 542 (+6) · pdf 128 (+4) · web 307 (+1) · shared 854 · mobil 38 — shared/mobil STILLE · 7/7 · diff = 41 filer + tavla · slettede fasit-linjer utenfor UP/UO/UM = 0 (verifisert selv) · branch 3-tipp var `b134f5b8`, ikke `97908d78`. 🔴 IKKE GLATT: Prisma-klient i merge-treet var stale mot ny schema → `api#build` feilet TS2353/TS2339 på `omradeId`; regenerert (`pnpm --filter @sitedoc/db generate`), gate grønn på nytt kjøring**

| Agent | Worktree | Branch | Tilstand | Venter på |
|---|---|---|---|---|
| **redesign** | `SiteDoc-redesign` | `erObjektSynlig` levert + merget `3ecbdff2` (`feat/synlighet-samlet`) | ⚪ **LEDIG** | — |
| **dokgen** | `SiteDoc-dokgen` | ordre ferdig — 🟢 **LÅST OPP:** `erObjektSynlig` er nå i develop `3ecbdff2` | ⚪ **LEDIG** — **nudge går etter denne mergen** (ikke startet) | — |
| **mal-Opus** | `SiteDoc-mal` | JH2 v2 merget `9b83b285`. **Malkø i develop `7212f7cb`** (alle Kenneth-gatet): KD1 v3 → **UP1-deling (UP1 rev + UP2/UP3/UO2.1)** → UM1 v2+UM1.1 (hører sammen: UM1 felt 9 peker UM1.1) → PE-skjot → BYGGELEDELSE Del B (4 maler). Fasemåling besvart POSITIV, ført i ordrene | 🔵 **Malkø bestilt — design sender startsignal per ordre** (ikke startet) | Designs startsignal (direkte + linje i `inbox-cowork.md`) |
| **kontrollplan** | `SiteDoc-kontrollplan` | `fix/utilgjengelige-flyter` 🟢 **MERGET** develop (`131dfe7b`, `--no-ff`) — utilgjengelige maler forklarer seg + eksisterende klient-gjetning fjernet. **Reload: OTA** | ⚪ **LEDIG** | — |
| **merge** | `SiteDoc-merge` | `merge-restart` | ⚪ **LEDIG** | — |
| **simulator** | `SiteDoc-simulator` | Xcode 27-oppkobling dokumentert (`feat/simulator-xcode27-oppkobling` `4d7901b1`) 🟢 **MERGET** develop `38333944` | ⚪ **LEDIG** | — |
| **deploy** | — | — | ⚪ **LEDIG** | — |
| **design** (tidligere fabel) | `SiteDoc-design` 🔴 ikke opprettet ennå (Kenneth) | `docs/design-<emne>`-brancher | ⚪ **LEDIG** | plan-sporet (redesign + maler) |

**Tilstander:** ⚪ LEDIG · 🟠 FERDIGSKREVET (ikke relayet) · 🔵 ORDRE GITT · 🟢 LEVERT · 🔴 BLOKKERT

> ✅ **SJA-skjermbildegate — LUKKET 2026-09-17 (etterkontroll, delvis dekket).** SJA-signaturrundene er i prod (release-merge `ad18df93`). Etterkontrollen var en port for avvik, ikke rollback. **Flate 3 (signering på egen rad) er IKKE DEKKET:** demodataen har allerede Kenneths rad signert, og Kenneth vedtok 2026-09-17 «la SJA være» — de radene er BEVIS på at funksjonen virket, ikke støy å nullstille (`packages/db/prisma/reset-sja-runde2.sql`, merket «SKAL IKKE KJØRES»). Skal flate 3 verifiseres senere, seedes et NYTT demo-SJA ved siden av (se [DEPLOY-RUNBOK § 7](DEPLOY-RUNBOK.md#7--seeding-mot-test)). Ordrefil: `docs/redesign/ORDRE-verifisering-sja-skjermbildegate-2026-09-17.md`.

### 🔴 Coworks kø (arkivert) — bestilt, ikke skrevet

| Sak | Utløser | Til |
|---|---|---|
| ✅ **SPERREDE KNAPPER MERGET `b9d8ddec`** (2026-09-19c) — 48 knapper web+mobil, `KnappMedForklaring`, 35 nøkler under `sperret.*`. Fire oppfølgere → BACKLOG § 1. Se datert seksjon under | Ferdig | — |
| ✅ **KM2 MERGET `a59d0e44`** (2026-09-19c) + **KD2 `c1e29dc9`** (19a) — begge via maløypa. Se dater seksjoner under | Ferdig | — |
| 🔵 **KM2 — KD2 er nå inne → mal-Opus kan starte** (han sjekker selv). Går på maløypa (design → mal-Opus direkte). `docs/redesign/ordre-km2-ny-mal-design-2026-09-18.md` (mur av stein i terreng), merget `1056b302`. KM2 bruker generatoren fra KD2 og skal ligge **etter `KD2_MAL`** i `seed-bibliotek.ts`. Normen har ingen utførelseskrav/toleranser for mur → **kontroll mot beskrivelsen, ingen tall** (Kenneth godkjent). Branch `feat/mal-km2` | KD2 inne (nå) | design → mal-Opus |
| **Bundet flyt — UI** | Nå. Kolonne + serversperre er inne (`be2217d1`); radiovalg ved opprettelse, bryter i etterkant, fotnote og `Anchor`-symbol mangler | redesign |
| **Strengharmonisering** — «Sentralarkiv»/«Malarkiv» ut som synlige begreper + kapittel/underkapittel/post | Nå. Har ventet siden 16.09 | mal-Opus |
| ✅ **§7b-RETTING BYGGET + MERGET `5cd113ab`** (2026-09-19e) — KA7, KB2, KB4, KB6 **og KC3.1** rettet, alle version 2. Designgatet på tekstbevis. Lukker den gamle KC3.1-§7b-raden (sto siden 18.09). **Hele NS 3420-K-biblioteket (KA7–KM2) følger nå MAL-METODE §7b — opphavsrettssaken lukket for biblioteket** | Ferdig | — |
| **`hentStandarder`-sikkerhetsrunde** — ingen tilgangsgate. 🟢 Ulåst 15.09 av lese/redigere-aksen | Nå | — |
| **`terminologi.md § 0`** — lese/redigere-aksen i rettighetsmatrisen + kapittel/underkapittel/post | Med sikkerhetsrunden | — |
| **`06-videresend`** — eneste e2e-spec som gjenstår. Var ikke drift: handlingen var fjernet fra menyen | Etter Kenneths visuelle gate av personvalget | dokgen |
| **Tørrkjøring for ↻** — `firmamal.forhandsvisOppdatering`, ~30–40 linjer, gjenbruker `diffObjektTre` | 🔴 Kenneth gater | — |
| **NUL-bytes i `objektkopi.ts`** — fire `\0` som feltskiller gjør fila binær for git og `grep`. Vi måler i den konstant | Med neste kontrollplan-runde | kontrollplan |
| **`data-testid` på begrunnelse-dialogen** (`DokumentHandlingsmeny.tsx:646`) — spec henger i placeholder-tekst | Med neste redesign-runde | redesign |
| **Mobil videresend** — kun person-velger innen egen flyt mangler; flyt-bytte finnes alt | Etter web er gatet | redesign |
| 🔴 **REMÅL MASTERPLANEN MOT KODE** — `arkitektur-syntese.md:48,104,211` sier Fase 2 «mangler»/«bygges». Den ER bygget: `OrganizationTemplate` med objekt-tabell, versjonssporing, soft-delete, `firmamal.promoter`, Malforvaltning. Samme tilstand som BACKLOG hadde 11.09 («seks poster var levert uten at noen førte det»), ett nivå opp | 🔴 Kenneth velger: denne eller A.Markussen-lista først | — |
| **A.Markussen — seks kundeønsker urørt siden 06.05** — servicesjekkliste m/ timetall · rettighetsmatrise Prosjektleder/Bas · tre SJA-justeringer · pushvarsel/SMS. **Piloten starter i september** | 🔴 Kenneth velger | — |

---

