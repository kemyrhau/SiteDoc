---
name: STATUS-AKTUELT
description: Løpende statusrapport for pågående arbeid, pauset arbeid og planlagte faser. Oppdateres ved hver vesentlig fremdrift.
sist_verifisert_mot_kode: 2026-08-09
---

> 🔴 **OVERTAR DU ORKESTRERINGEN? Les [OVERLEVERING-2026-09-30.md](OVERLEVERING-2026-09-30.md)
> først.** Cowork-flaten fases ut 6. oktober. Fila bærer de fire åpne trådene med hash, hva
> hver venter på, Kenneths beslutninger i hans egne ord, og tre ferske lærdommer om gaten som
> ikke står andre steder ennå. **Uten den må du rekonstruere alt fra `relay/` — som er
> gitignorert og ikke synkes mellom arbeidstrær.**

> 🔴 **TIMER + GPS-KOMPLEKSET ER UNDER PLAN, IKKE UNDER BYGGING (2026-10-01).**
> [timer-gps-helhetsplan.md](timer-gps-helhetsplan.md) — fem lag, 20 hull, ni beslutninger.
> **To ordrer er merket HOLDT** (`inbox-dokgen-byggeplass-origo`,
> `inbox-kontrollplan-bekreft-dagsforslag`). **Kun LAG 0 kan bestilles.**
> ⚠️ **Kenneth 2026-10-01:** *«det er ikke bare å bygge i vei»* — orkestratoren bestilte kode i
> hver runde mens modellen ennå ble formet, og to ordrer motsa hverandre.
> 🟢 **Revidert kveld 2026-10-01:** K1, K6–K9 vedtatt som dagsmodell V1–V14 (§ 4b). K2–K5 åpne.
> **Fabel eier planen, orkestrator gater den** (§ 7b). Origo-ordren kan omskrives til V14 etter gate.
> 🟢 **LAG 0 LEVERT 2026-10-02:** km-tak `89acee95` (api) + beregn/anvend-splitt `a13f4343` (mobil, OTA).
> 🟢 **Lag 0c LEVERT `c78bc14f`** — regel 10 er fire ledd, `turbo run typecheck` gater 10 pakker. ⚠️ **`pnpm install` kreves i alle trær** (`@types/node`).
> 🟢 **LAG 1 KOMPLETT 2026-10-03:** L1-C+L1-A `9d67367a` + L1-B `2e993250`. H21+H22 lukket. Test-deploy `fd92736d` (lag 0 + L1-A/C, migrering `20261002120000` kjørt). 🟢 **`20261002130000_timer_normkilde_pausereferanse` KJØRT** — verifisert av Kenneth i UI 2026-10-03 (firma → innstillinger viser «Dagsnorm-kilde: Fast (7,5 t)» og «Pausen starter fra: Ankomst»). ⚠️ Pull krever `pnpm install` + `prisma generate` ×4. **K10 VEDTATT → V17:** byggeplass-lokasjon = punkt+radius (standard) eller polygon (infrastruktur), én delt gjenkjenning for timer OG PSI; bygges før lag 3/4. 🟢 **K5 vedtatt (mottak med sporbarhet).** 🟡 **LAG 2 BESTILT 2026-10-03** ([timer-gps-lag2-spec.md](timer-gps-lag2-spec.md), gatet; krav på `docs/design-lag2-krav` @ `ed2c9e54` venter merge): L2-A → L2-B ∥ L2-C. Funn: L1-B-etappene lagres ikke på raden, `syncBatch` stripper ukjente felt. 📄 **V17-spec skrevet 2026-10-04** ([v17-geofence-spec.md](v17-geofence-spec.md)) — til gate; bygges før lag 3/4. 📄 **V19-spec skrevet** ([timer-overlapp-pc-mobil-spec.md](timer-overlapp-pc-mobil-spec.md), H25 overlapp PC↔mobil) — til gate.

> 🟢 **PROD-DEPLOY 2026-10-09: `64de37bd`** (main, bygget 00:21Z). Migreringer kjørt mot prod: `20261008120000_tegningsserie`,
> `20261008130000_dwg_layout_kobling`. DB-dump før release: `~/backup/sitedoc-pre-release-20261009.dump` (forutsatt tatt, ikke målt her).
> libredwg verifisert: `dwg2dxf 0.14` i `sitedoc-api` og `sitedoc-web`. 🟢 **OTA prod-kanal** fra `64de37bd`, verifisert på telefon (Mer viser `64de37bd`).
> Innhold: T2 tegningsserie (`19dbc187`) · V20-M pause mobil (`948c564a`) · 90°-lås/referanselinje/snap + polylinje Fullfør/Fortsett
> (`e633d27c`) · DWG-1 libredwg (`732ce826`) · DWG-2 konvertering, måling fra DWG-enheter, layouts, revisjonsliste (`510aa11c`) ·
> DWG retur 1 HATCH/lagfarge/extents/blokk-base (`d0ea3a93`). Detaljer + arkiverte innslag: [historikk-2026-10.md](historikk-2026-10.md).
> ⚠️ **IKKE i prod:** DWG retur 2 (auto-rotasjon, startutsnitt, LEADER) · snap-retur 1 — under arbeid. DWG-3 (georeferanse fire hjørner) ikke levert — se § 2026-09-24 under.

> 🟡 **V20-oppfølgere (åpne):** V21 (overtidsforslag manuell) og V22 (prosjekt·byggeplass på raden, web-paritet) VEDTATT
> 2026-10-06 — egne små ordrer.

# 🔴 TAVLA — hvem sitter hvor

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

## 🔴 Coworks kø — bestilt, ikke skrevet

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

## 📋 STATUSTAVLE — hvem gjør hva nå (vedlikeholdes av cowork, **målt 2026-09-12**)

🔴 **Forrige tavle sto på 11.09 natt gjennom rundene 74–84** — fem agenter, ~15 ordrer, ingenting
ført. **Tredje gang samme drift** (28.08→07.09 · 07.09→11.09 · 11.09→12.09). **Rotårsak målt:
cowork påsto i ~15 t at dokgen arbeidet uten å kjøre `git branch -r` én gang.** Tavla er coworks
ansvar, måles ved sesjonsstart — den er det eneste som overlever en compact
(SAMARBEIDSREGLER `:610`).

**Målt tilstand nå (verifisert mot git 2026-09-12):**

| Hva | Hash | Merknad |
|---|---|---|
| `develop` | **`758a193a`** | Verifisert `= origin/develop` |
| `main` / prod | **`af0093b8`** | 🔴 **Uendret siden 11.09 — 62 commits bak develop** (git-målt, ikke ~45 som meldt). Ingen release planlagt |
| **test** | `758a193a` | Cowork verifiserte med `/version`. ⚠️ Kan ikke git-verifiseres herfra (`/version` gir HTML, ikke SHA); test≠prod bekreftet via ulik CSS-hash |

🟢 **Ingen åpne fjernbranches** — `git branch -r` viser kun `develop`, `main`,
`redesign/navigasjon`, `wip/diag-exif`, `wip/diag-ko-trigger` (de to `wip/`-ene er umerget MED
VILJE, se under).

🟢 **Gate ved siste måling (cowork-tall):** db 2 · api **457** · pdf 120 · shared **796** · web **223**.

### 🔴 Agentregister — målt med `git branch -r` + `git worktree list` 2026-09-12

⚠️ **Cowork kan IKKE måle worktree-HEAD selv.** Et worktree har en `.git`-**fil** med absolutt sti
til `.git/worktrees/<navn>` i hovedtreet — den stien finnes ikke i coworks sandkasse, så `git`
feiler der. **Cowork kan lese FILER i trærne og kjøre `git branch -r` (delte refs), men ikke
HEAD/branch/status per tre. Det må Kenneth (eller merge-agenten i hovedtreet) kjøre:**

```sh
cd ~/Documents/Programmering/SiteDoc && git fetch -q origin && for w in dokgen kontrollplan redesign mal merge simulator; do p=~/Documents/Programmering/SiteDoc-$w; if [ -d "$p" ]; then echo "$w: $(git -C $p rev-parse --short HEAD) [$(git -C $p rev-parse --abbrev-ref HEAD)] · $(git rev-list --count $(git -C $p rev-parse HEAD)..origin/develop) bak · $(git -C $p status --porcelain | wc -l | tr -d ' ') urene"; else echo "$w: MANGLER"; fi; done
```

⚠️ **`prunable` i coworks `git worktree list` er STØY** — det speiler bare at sandkassen ikke når
stien. **Det betyr ikke at treet kan ryddes.**

| Agent | Worktree | Tilstand | Spor |
|---|---|---|---|
| **kontrollplan** | `SiteDoc-kontrollplan` | 🔴 **STOPPET** — `fix/kontrollpunkt-laasning` | ⚠️ **Duplikat — skal IKKE gjenopptas.** Låsningen ble løst av dokgen (`44487811`, merget runde 85) mens dokgens arbeid lå upushet og usynlig i `git branch -r`. Cowork bestilte samme fiks her; det var coworks feil, ikke kontrollplans |
| **redesign** | `SiteDoc-redesign` | 🟢 **LEDIG** — `515f0fc0` detached (merget commit) | 🟢 **Tre veier ut MERGET runde 97 (`b5b4a490`):** à jour-tilstand (`malbygger.firmaarkiv.oppdatert`), papirkurv-retur (retur-sti fra `usePathname()`, whitelistet mot open redirect), sperre-lenker (til dokumenter/kontrollplan). `mal.ts` urørt (bygget fra data i lista → api stille). Bevisste valg: mal-filter i papirkurv **avvist** (kolliderer med «Tøm papirkurv»-telling), HMS-lenke **ufiltrert** (lokalt søk, ikke URL-drevet). Tidligere: typefilter på SiteDoc-fanen + rollestyrte bunntekst-lenker **merget runde 94 (`ecd390c6`)**: klient-typefilter (`arkiv-fane-filter.ts`), `kanRedigereFirma`/`kanRedigereSitedoc` fra `autoriserMalTilgang`, forklarende tom-tilstand. `bibliotek.ts` kun `select` (`kategori`/`domene`), ingen serverfilter. api 465→468 (+3 rediger-signal), web 223→228 (+5 typefilter, m/eksklusjons-asserts). 🟢 **Synliggjøring + bekreftelse (#1/#2/#3/#17) MERGET runde 96 (`da23361f`, `c03c2d1a`):** `versjonerBak`/↻ i mallista, sperrelenker, avslutt-bekreftelse, og `OppdaterFraHovedmalModal` på BEGGE prosjekt-↻ (`MalListe.tsx` + `MalBygger.tsx`) — ikke på firma←SiteDoc (`malarkiv/page.tsx` urørt, tilsiktet: bytte der er trygt). api 468→473 (+5, alle i `prosjekt-livssyklus-gate.test.ts`). Scope-avvik godkjent av cowork (mal.ts +5 `copiedFromOrgTemplate`, teller kun i mallista, ingen web-test). 🔴 **Nytt funn IKKE fikset: `faneWhere` (`firmamal.ts:64-77`) mangler negativkontroll — egen runde.** Forrige: fjern Rapportmaler-flata runde 90 (`71202903`) |
| **dokgen** | `SiteDoc-dokgen` | 🟢 **LEDIG** — `04341d18` detached (merget commit) | 🟢 **Avslutt-gaten måler arkivets ferskhet MERGET runde 97 (`62381fc4`, løsning B):** nyeste `updatedAt` på `Checklist`+`Task` (via `template.projectId`, `deletedAt: null`), tre feilveier (`arkivMangler`/`arkivUtlopt`/`arkivForGammelt`), `utloperVed=null`=aldri. 🔴 **Målte coworks `Activity`-premiss FEIL og stoppet:** `sjekkliste.ts`/`oppgave.ts`/`hms.ts` skriver ingen `Activity`-rad → valgte `updatedAt`. api 473→478 (+5). Tidligere: iOS-forhåndsvisning av arkiv-PDF **merget runde 93 (`75d9e70d`)**: `allowingReadAccessToURL` på WKWebView-source (Android-propene var no-op på iOS), `onError`/`onHttpError` → feil-overlay som stopper spinneren, `kilde` fortsatt ren `useMemo([filUri])`. 2 i18n-nøkler. 🟢 **GATE OPPFYLT 13.09: Kenneth bekreftet PDF-forhåndsvisningen virker på fysisk iPhone.** 🟢 **`arkiv.lokalFallback` (foreldreløs, 0 kode-kallere) SLETTET × 15 språk, MERGET runde 96 (`d363ef25`, `b08035ad`).** `shared` stod på 814 gjennom slettingen — ingen test leste nøkkelen. Tidligere: auto-kollaps runde 91 (`758ea071`). 🟢 **Runde 96 var ren i18n → ingen OTA.** |
| **mal-Opus** | `SiteDoc-mal` | 🟢 **LEDIG** — `a66c18f4` detached (merget commit) | KB6 v2 Planting (10 felter/3 faser) **merget runde 93 (`c3a92b7a`)**. 🟢 **Gatet av KENNETH 13.09** («gjennomgått og godkjent … bilder kontrollert mot telefon»), **ikke av fabel** — Kenneth er produkteier, ikke let etter et fabel-svar. 🟢 **NS 4400-tråden lukket som PRINSIPP** (MAL-METODE §7a: NS-standarder refereres med utgave/år, ordlyd gjengis aldri) — KB6 trengte ingen innholdsendring, ikke gjenåpne per mal. create-only bekreftet på merge-resultat. Også: MAL-METODE §7/§7a docs-branch merget samme runde. 🟢 **LEDIG også etter unik-indeks-runden (95, `fe3e2ed6` merget).** 🔴 **`feat/mal-kc31-revisjon` venter fortsatt på Kenneths innholdsgate.** Tidligere: KA7 + KB2 + KB4 v2 (runde 86) |
| **merge-agent** | `SiteDoc-merge` | 🟢 **LEDIG** — `merge-restart` @ develop `b5b4a490` | Runde 97 sist: merget dokgen (`62381fc4`, arkivgate-ferskhet) FØRST, så redesign (`b5b4a490`, tre veier ut) på toppen — i18n-mergen ren, begge nøkkelsett verifisert intakt (dokgen +4, redesign +5 pr. språk), all JSON parser. Gaten verifisert i kode: `updatedAt` på `Checklist`+`Task` (ikke `Activity`), `deletedAt: null`, tre distinkte feilveier, `sitedoc_admin`-nødutgang uendret. `mal.ts` bekreftet IKKE i redesigns diff. api 473→478 (+5 livssyklus-gate), øvrige stille (db 2 · pdf 120 · shared 814 · web 228), kald web-bygg grønn. 🔴 **Web-deploy samles.** 🔴 **Migreringen fra runde 95 (`20260913140000_firmaarkiv_unik_indeks`) venter FORTSATT på Kenneths deploy — prod-dry-run-kravet står under.** 🔴 **OTA-gjeld runde 91 (kollaps) + 93 (iOS-PDF) — én OTA dekker begge.** |
| **simulator** | `SiteDoc-simulator` | ⚠️ **UTE AV DRIFT** — `bc3efdca` detached | Se «To trær som trenger et vedtak» under. Ikke i coworks 12.09-tabell, men treet finnes |
| **deploy** | `SiteDoc-deploy` | 🟢 **LEDIG** — `4d00e94f` detached | Ingen ordre |

🔴 **`SiteDoc-mobil-device` er BORTE** — sto foreldreløs 11.09, er ikke lenger i `git worktree
list`. Fjernet fra registeret.

🟡 **Lærdom (runde 92, KB6 trukket tilbake):** en teknisk ren mal-branch er IKKE klar for merge —
maler har en **innholdsgate hos fabel** i tillegg til kodegaten. Cowork skal ikke bestille merge av
`seed-bibliotek.ts`-runder før fabel har gatet innholdet. KB6 gatet teknisk (create-only, én fil),
men innholdet (NS 4400-detalj i Plantekvalitet) var ikke avklart. *(KB6 senere gatet av Kenneth selv 13.09 og merget runde 93.)*

🔴 **Lærdom (runde 93/94, inbox-overskriving):** cowork overskrev `relay/inbox-merge.md` med en ny ordre
FØR den forrige var meldt ferdig — ordren (rettighetsmatrisen) forsvant uten å ha vært kjørt.
**Regelen som følger: en inbox-fil overskrives ALDRI før forrige ordre er meldt ferdig.** Er den ikke
meldt, er den enten fortsatt aktiv eller tapt — begge krever at cowork spør, ikke skriver over.

🔵 **Rettelser fra runde 93 (ført så de ikke gjentas):** coworks ordre sa «KB6 v2 Grasdekker» —
**KB6 er Planting; Grasdekker er KB4** — og oppga base `652cdbda`, mens faktisk merge-base var `4564d4ed`.
Merge-agenten målte begge og rettet commit-meldingen til «Planting».

### 🔴 Åpne tråder uten eier (målt 12.09)

- 🔴 **`firmamal.ts:64-77` `faneWhere` mangler negativkontroll (åpen etter runde 94):** firmaarkiv-fanens SERVERfilter er aldri bevist med en feil-type-rad. Egen runde — eksisterende flate
- 🔴 **`firmaadmin → SiteDoc-arkiv *les*` uttrykt men ikke wiret (åpen, nå mer aktuell):** cellen finnes i `autoriserMalTilgang`, men kallstedet `bibliotek.hentStandarder` er ikke strammet. Modalen leser arkivet oftere nå (runde 94), så strammingen haster mer. Egen runde
- ~~**Forhåndsvisning + flervalg i papirkurven**~~ — ✅ levert av dokgen + merget runde 85 (`652cdbda`), inkl. slett-vakt på levende kobling som løste låsningen
- **Arkivredigering med versjonering (= redesign steg 3)** — fabels designnotat `arkivredigering-designnotat-fabel-2026-09-12.md` + `MAL-PLAN.md` + KB4-ordre committet `docs/redesign/`/`docs/claude/` (runde 86). 🔴 **Versjonspublisering er egen runde:** ingen versjonsrader for maler finnes i dag (kun tellere — `BibliotekMal.versjon` er `String "1.0"`, `OrganizationTemplate.version` er `Int`). Krever ny tabell etter `DrawingRevision`-mønsteret (`schema.prisma:961-973`) + skjemaendring **Kenneth gater**
- 🟢 **Pilotsjekk «Hent fra arkiv» — DEKKET I UI, DB-måling ikke ført (runde 89):** Kenneth har lånt inn alle seks NS 3420-malene inkl. KD1 i Sitedoc Myrhaugs firmaarkiv, **verifisert i UI.** ⚠️ Sluttmålingen i DB er ikke kjørt skriftlig. Prosjektadmins tapte direkteimport fra NS 3420-biblioteket (tilsiktet vedtak) er dermed dekket i praksis
- 🟢 **`@@unique` på `OrganizationTemplate(organizationId, laantFraBibliotekMalId)` LEVERT + merget runde 95 (`ebda4946`, mal-Opus `fe3e2ed6`):** DB-garantien mot dobbelt-lån er på plass. Duplikatene ryddet av Kenneth på test 13.09 (`DELETE 3`, negativ kontroll `(0 rows)` ×2), så blokkeringen fra runde 88 er opphevet. `@@index([laantFraBibliotekMalId])` beholdt ved siden av (revers-oppslag + `SetNull`-cascade — det sammensatte kan ikke betjene det). Krav (b) i «stille tomhet» oppfylt. 🔴 **KREVER DEPLOY MED MIGRERING** (`20260913140000_firmaarkiv_unik_indeks`, ren `CREATE UNIQUE INDEX` — ingen DELETE/ON CONFLICT, FEILER HØYT på duplikater). Se prod-krav under
- 🔴 **NYTT FUNN (runde 95): integrasjonstester kjøres ikke av CI og har ingen kjørerutine.** Gjelder hele `*.integration.test.ts`-suiten, ikke bare den nye indeks-testen. Målt: `apps/api/package.json:12` har `test:integration` som script · `apps/api/vitest.config.ts:13` ekskluderer `*.integration.test.ts` fra `pnpm test` · `.github/workflows/ci.yml:56` kjører **kun** `pnpm test`. `firmaarkiv-unik-indeks.integration.test.ts` er merket «cowork-gatet», men ingen rutine gater den. mal-Opus kjørte den selv med negativ kontroll (droppet indeksen → rød), så vi VET at den biter i dag — men fra og med merge er den stille. **Samme klasse som «stille tomhet»: en test som aldri kjøres er ikke en vakt.** Eier: ikke tildelt
- 🔴 **PROD-KRAV NESTE RELEASE (runde 95): prod har egen database og kan ha egne duplikater.** `20260913140000_firmaarkiv_unik_indeks` er `CREATE UNIQUE INDEX` og **stopper prod-deployen midt i** (BUILD → MIGRATE feiler høyt) hvis `-d sitedoc` har dobbelt-lånte firmamaler. **Samme dry-run + rydding som ble kjørt mot test 13.09 må kjøres mot `-d sitedoc` FØR migreringen når prod.** Dry-run: `SELECT "organization_id","laant_fra_bibliotek_mal_id",count(*) FROM organization_templates WHERE laant_fra_bibliotek_mal_id IS NOT NULL GROUP BY 1,2 HAVING count(*)>1;` — må gi `(0 rows)` før deploy
- 🔴 **Kundeansvar for NS-verifisering har ingen flate (åpen etter runde 93):** MAL-METODE §7a punkt 5 sier ansvaret skal plasseres «ÉN gang sentralt (bruksvilkår/onboarding/last ned avvik), aldri per sjekkliste». **Den sentrale plasseringen finnes ikke ennå — prinsippet er skrevet, ingen flate håndhever det.** Samme form som «stille tomhet». **Eier: ikke tildelt.**
- ✅ **RETTELSE (runde 93): `arkiv.rendr` STØTTER oppgave** (`arkiv.ts:46` håndterer oppgave eksplisitt, kaster kun når prosjekt-kontekst mangler). Coworks tidligere påstand om at den kaster for oppgave (`arkiv.ts:51`) var utdatert. Sjekkliste + oppgave deler samme `ArkivPdfForhandsvisning`; HMS går gjennom de to skjermene. **Ikke bestill «oppgave-støtte i arkiv.rendr» — den finnes**
- 🔴 **Mobil-rendering av auto-kollaps utestet (åpen etter runde 91):** `apps/mobile/.../UtfyllingSeksjoner.tsx` rørt, men `apps/mobile` har ingen testharness (BACKLOG §153). Sømmen er dekket i `shared` (`seksjoner.test.ts`, 12 tester). Kollaps-oppførselen på mobil er ikke verifisert i app
- 🔴 **Kenneth gater undertittel-nivået visuelt (åpen etter runde 91):** undertittel er nå egen foldbar seksjonsgrense (flat form). Krever test-deploy for visuell godkjenning
- 🔴 **Gammel URL → redirect ikke verifisert ende-til-ende (åpen etter runde 90):** `/dashbord/[prosjektId]/maler` er nå en `redirect()`. `/dashbord/*` er auth-gatet, så uautentisert `curl` fanges av middleware før redirecten — agenten kunne ikke teste e2e. `redirect()` er samme mønster som eksisterende legacy-redirecter i prod, og kald bygg kompilerte sidene, men det er ikke sett virke. **Verifiseres ved neste test-deploy (Kenneth/fabel).**
- 🔴 **Fabels designgate mot «Hent fra arkiv»** — mockupens fire nøkkeltilstander må verifiseres mot flaten. Krever at test er deployet
- 🔵 **Notert: `KD1 – Utendørsbelegg` har `verifisert = f`** — to prosjekter bygger sjekklister på et ikke-verifisert utkast. Ikke rutet
- ⚠️ **Klient-hintet «Allerede lånt» er fane-skopet** (akseptert, runde 88): gjenbruker tabellens liste per fane. **Server-vakten er den fulle gaten på tvers av faner** — hintet er kun UX
- **Bug: `ProsjektBibliotekValg` orphanes** ved firmamal-sletting — verifisert, ikke rutet til agent
- **Prod ligger 62 commits bak develop** — ingen release planlagt
- 🔴 **NYTT FUNN runde 96 (ikke fikset): slett-sperren har en TREDJE grunn — `iKontrollplan`** — som peker til kontrollplanen, ikke papirkurven. De to andre sperregrunnene fikk sperrelenke i denne runden (#3); denne mangler lenke til stedet som opphever den. Egen runde
- 🔴 **NYTT FUNN runde 96 (ikke fikset): papirkurv-lenken mangler mal-filter** — lenken fra slett-sperren peker til papirkurven, men uten filter på malen. Krever `useSearchParams` i `papirkurv/page.tsx` slik at brukeren lander på riktig mals dokumenter. Egen runde
- 🔴 **NYTT FUNN runde 96: den ekte løsningen på ↻-risikoen er diff/merge, ikke full erstatning** (`firmamal.ts:765`, merket «backlog» i koden). Bekreftelsesmodalen (#1-runden) **kjøper tid, den fjerner ikke årsaken** — full objekt-tre-erstatning foreldreløser dokumentdata. Egen større runde
- 🔵 **RETTELSE runde 96: «Avslutt prosjekt»-flaten fantes fra `36dc3029` (06.09).** De tre «neste runde»-kommentarene i `prosjektoppsett/page.tsx`/`EksportSeksjon.tsx` var STALE og er rettet av redesign. **Cowork (og BACKLOG-funn #17) leste kodekommentarer som gjeldende tilstand** — koden er fasit, ikke kommentaren

### 🟢 Trærne har IKKE driftet — målt, ikke antatt

**Spørsmål (Kenneth 11.09): «plutselig er de driftet? bør vi migrere dem?»**

| Måling | Svar |
|---|---|
| `pnpm-lock.yaml` i hovedtreet | **7. september**, uendret i git siden |
| Lockfil i dokgen · kontrollplan · redesign · merge | **7. september — identisk** |
| Urene filer i alle fem trær | **0** |

🟢 **Ingen migrering nødvendig.** Avhengighetene er i takt, trærne er rene, og hver ordre starter
med `git fetch` + ny branch fra `origin/develop`. **`pnpm install` i gate-kommandoen blir en no-op.**
**At et tre står 15 commits bak spiller ingen rolle — det er urene filer som ville vært problemet.**

### ⚠️ To trær som trenger et vedtak

**`SiteDoc-simulator`** — 382 commits bak, lockfil fra **4. september** (eldre enn hovedtreets 7.).
🔴 **Skal den brukes til røykliste, må den oppdateres og `pnpm install` kjøres først** — ellers
måler den en app fra en annen tid. **Som den står, er den ute av drift.**

**`SiteDoc-mobil-device`** — mappa finnes med `node_modules`, `.git`-fila peker på
`.git/worktrees/SiteDoc-mobil-device`, **men treet står IKKE i `git worktree list`.**
🔴 **Registreringen er borte; mappa står igjen som foreldreløs.** Den har **ingen `pnpm-lock.yaml`**.
**Den tar plass og kan forvirre neste cowork. Rydding krever Kenneths ord — cowork sletter ikke.**

### 🔴 PROD-AVBRUDD samme kveld — Entra client secret utløp 3. sept

Microsoft-innlogging på web lå nede i **prod i fire døgn** før noen oppdaget det. **Funnet av en
gate satt av en helt annen grunn.** Ingenting varslet. Full hendelse, de fire lookalike-GUID-ene i
Azure og kontinuitetsrisikoen (begge appregistreringer i en privat tenant, én admin):
[sikkerhet.md](sikkerhet.md).

⚠️ **Gaterekkefølgen «Microsoft først, feiler den stopper alt» var riktig av gale grunner** —
cowork fryktet sin egen PKCE-linje. Den var uskyldig; gaten fanget en utløpt secret i stedet.

### ⚠️ `pnpm lint` kan ikke bli grønn på web — cowork har gatet på et umulig steg

To agenter rapporterte uavhengig at web-lint feiler på **forhåndseksisterende** gjeld på
develop-baselinen, i filer ingen av dem rørte. **Cowork har likevel lagt `pnpm lint` som siste
steg i hver gate-kommando hele dagen.** 🔴 **Et gate-steg som aldri kan passere, lærer agentene å
ignorere gaten.** Tallene spriker (65 mot 107 rapportert) — **selve gjelden er ikke målt.**
Ført i [BACKLOG](BACKLOG.md); lint står ikke som blokkerende steg før baselinen er ren.

🔴 **Sporfordeling (Kenneth-vedtak 2026-08-31, [SAMARBEIDSREGLER § Arbeidsform](SAMARBEIDSREGLER.md)):**
**kontrollplan = PLAN-sporet** (masterplanens neste punkt, røres ikke av feltfunn) ·
**dokgen = FUNN-sporet** (feltfunn, ellers BACKLOG) · **simulator = måling og røykliste**.
Kun 🔴-blokkerere avbryter plan-sporet.

> 🔴 **REGISTERET MÅLES, DET HUSKES IKKE** (Kenneth-krav 2026-09-06). Kjør før hver
> statusrapport og hver ny ordre:
>
> ```sh
> git fetch origin -q --prune && git worktree list && git branch -r
> ```
>
> | Signal | Betyr |
> |---|---|
> | Branch i treet, ingen commits | 🟡 Ordren er TATT, agenten koder |
> | Treet på `develop`/detached | 🟢 Ledig — ordren er ikke tatt |
> | Branch på origin, ikke ancestor av develop | 🟢 Levert, venter merge |
>
> **«Branch finnes i treet» er det eneste målbare signalet på at en agent jobber** — cowork kan
> ikke se agentøkter, bare Kenneth kan. ⚠️ **En ordre er ikke RELAYET før Kenneth har limt den.**
> «Skrevet» og «gitt» er to tilstander, og tavla skiller dem. Cowork påstod agentstatus tre
> ganger 06.09 uten å måle: to ganger sto agentene ledige fordi ordren aldri var relayet, én gang
> var øktene borte.

| Agent | Spor | Worktree (målt) | Tilstand | Neste ordre |
|---|---|---|---|---|
| **merge-agent** | 🟢 **LEDIG** | `SiteDoc-merge` @ `2b235e8a` [merge-restart] | **33 runder.** I synk med develop. Runde 33: to brancher, null filoverlapp, testtall målt api 328→330 · pdf 110→113 (de to api-testene kom fra `tegningsmarkorer.test.ts`, ikke forutsett i coworks ordre men matcher diffen) | **Runde 34:** rebase + merge `feat/innboks-skjerm`, og docs-commit i hovedtreet |
| **dokgen** | 🟡 **I ARBEID** | `SiteDoc-dokgen` @ `8ff106ec` [fix/web-google-state] | `fix/google-doed-implisitt-vei` merget (`24505fbd`). 🔴 **Målte coworks premiss FEIL og meldte imot:** native Google brukte allerede code+PKCE med verifisert `state`. Cowork sluttet fra responsformen; agenten leste `expo-auth-session`s kildekode. Tidligere: byggeplassfilteret (9 kopier → 1, 3 bugger) | 🔴 **`fix/web-google-state`** — Google-tilbyderen i web mangler `state` (`checks ?? ["pkce"]`); Microsoft har linja, Google har den ikke. **Konsollens «SiteDoc» er web-klienten, ikke mobil** |
| **kontrollplan** | 🟡 **ORDRE GITT** | `SiteDoc-kontrollplan` @ `a0048f3b` detached — **6 bak, må oppdateres** | `fix/tegning-forvrengning` merget (`2b235e8a`). 🔴 **Fant at rotårsaken ikke var der cowork pekte:** `preserveAspectRatio="none"` er en no-op i normaltilfellet; strekket oppstår kun når `Drawing.imageWidth/Height` er `null`. Holdt `packages/pdf/src/tegning.ts` urørt → frossen baselinetest grønn | 🔴 **Nå-rapport reisetid** (`na-rapport-reisetid-2026-09-07.md`) — A.Markussen-krav med frist denne måneden. **Måling, ingen kode, ingen branch.** ⚠️ **Derfor gir treet ingen «ordren er tatt»-signal** — den eneste kvitteringen er hans melding |
| **redesign** | 🟡 **ORDRE GITT** | `SiteDoc-redesign` @ `b1bba893` detached | Dedikert innboks-skjerm: hele den aktive lista med søk/filter/sortering. 🔴 **Korrigerte coworks SQLite-antakelse** — sjekkliste/oppgave har ingen SQLite-speiling, kallene er nett-baserte. Gjenbrukte dokgens delte predikat uten utvidelse (ingen femte kopi). ⚠️ **Bygget på develop FØR runde 33** (hans testtall api 328/pdf 110) — må rebases | 🟠 **`fix/oppgave-vedlegg-paritet`** — oppgave sender `file://` rått til server (funn C kun i sjekkliste). **Tre koblede deler**, kan ikke gjøres halvt. *Innboks-skjermen levert og merget (`341cb26f`)* |
| **simulator** | 🟢 **LEDIG** | `SiteDoc-simulator` @ `bc3efdca` detached | — | Ingen |
| **deploy** | 🟢 **LEDIG** | `SiteDoc-deploy` @ `4d00e94f` detached | — | Ingen |
| **fabel** | ⏸ **STOPPET RENT 06.09 ~96 % bruksgrense** | — | **Alle bestillinger besvart, ingen halvferdige leveranser.** Døgnet: SJA-signaturrunder · FL-designlås + tilgangs-revisjon etter Kenneth-overstyring (stoppside, aldri 404) · grensekrav-ordvalg · trafikklys-etiketter · sekvens-frigivelse tatt imot. 🔴 **Åpne poster han peker på til neste økt:** trinn 3-gaten (PDF-atferdstest) · Kenneths gate på AG-systemteksten · FL/timeprosjekt-kost-sjekkene · **Proadm-eksportfila fra A.Markussen** | Neste økt — Kenneth avgjør om han skal fortsette utover grensen |
| ~~fabel (gammel rad)~~ | — | — | **SJA-signaturrunder lukket 06.09** — designlås over fire dokumenter + mockup, ordre skrevet. Alle tre nå-rapport-funn tiltrådt. Tidligere: modulhierarki-notatet komplett 31.08 | **Designgate på skjermbilder** når redesign leverer. Usendt fra cowork: `fabel-nav-gating-modellen.md` · `fabel-eksport-arkivering.md` |

⚠️ **`origin/wip/diag-exif` og `origin/wip/diag-ko-trigger` er umerget MED VILJE** —
`__DEV__`-logging, skal aldri merges. De dukker opp i hver `branch -r`-måling; **ikke tolk dem som
ventende arbeid.**

### 📋 Feltfunn-liste (B — funn samles, blir ikke ordrer på minuttet)

Kenneth melder som før; cowork fører her med alvorlighet. **Kun 🔴 avbryter plan-sporet.**
Kontrollspørsmål: *kommer noen ikke videre uten dette?*

🟠 **FUNN 2026-09-07 (Kenneth, test på enhet) — «Forbered til offline» forbereder bare tegninger.**
Menyvalget i `Mer` dekker **tegninger**. **Oppgaver, sjekklister og HMS er ikke med.**
🟢 **Samsvarer med koden:** redesign målte 07.09 at `sjekkliste/oppgave.hentForProsjekt` er
nett-baserte tRPC-kall, og at SQLite-katalogene dekker timer/maskin/vær/byggeplass — ikke dokumenter.

🔴 **To ting skiller lag her, og de må ikke slås sammen:**
- 🟢 **Opplastingskøen er robust offline** — målt samme kveld: bilde tatt i flymodus nådde serveren
  da telefonen kom på nett. **Den delen holder det den lover.**
- 🔴 **Dokument-TILGANG offline gjør det ikke.** Kenneths test virket fordi dokumentet var **åpnet
  før** han gikk offline. Et dokument han ikke hadde åpnet, ville ikke vært nåbart.

⚠️ **Løftebrist-klassen:** et menyvalg som heter «Forbered til offline» lover mer enn det gjør.
Samme form som `nb.json:2218` («arkivert og skrivebeskyttet»), `hms.ts:207-209` og innboks-pila.
🔴 **CLAUDE.md sier «Mobil-appen MÅ fungere offline» — ufravikelig.** Avviket mellom regel og kode
er reelt og udokumentert til nå.

**Ikke ordre.** Alternativene spenner fra å presisere etiketten (billig, ærlig) til å speile
dokumenter i SQLite (stort, berører sync-modellen). **Kenneth-beslutning, egen sak.**

🟡 **FUNN 2026-09-07 (cowork-måling) — åttende kopiklasse, halvlukket.** Redesign trakk
`formaterNummer` + `MedUtheving` ut til `apps/mobile/src/components/dokumentliste/DokumentRadHjelpere.tsx`
og migrerte `sjekkliste/index.tsx`. **Fire kopier står igjen:** `(tabs)/hjem.tsx:100` ·
`hms/index.tsx:43` · `oppgave/index.tsx:65` · `oppgave/[id].tsx:88`.
🔴 **Dette er nøyaktig formen byggeplassfilteret hadde** — en delt modul opprettet, migreringen
stanset ved første kallsted, og resten driftet fra hverandre til tre av ni var ødelagte.
**Ordren var riktig avgrenset; oppfølgingen er coworks, ikke agentens.** Egen ordre, funn-sporet.

🟢 **LUKKET SAMME DØGN — `a076236f`, ni kopier → én kilde, tre bugger borte.**
`apps/api/src/services/byggeplassFilter.ts` bærer regelen alene. Testen fanget dessuten en stille
atferdsendring uttrekket ville innført (tom streng måtte forbli falsy). **Historikken under står
fordi den forklarer hvorfor gaten trenger å måle mønstre, ikke bare filer.**

🔴 **BYGGEPLASSFILTERET VAR NI KOPIER — TRE AV DEM ØDELAGTE (målt 2026-09-06, dokgen).**
Regelen «et objekt uten byggeplass gjelder der du står» er håndspeilet ni steder i `apps/api`
over **to former**: via tegning (`drawing: { byggeplassId }`, 4 kopier) og direkte
(`byggeplassId`, 5 kopier). 🔴 **Tre av via-tegning-kopiene mangler tredje ledd** —
`oppgave.ts:168`, `hms.ts:213`, `hms.ts:373`. **En oppgave eller RUH på en PROSJEKT-tegning
forsvinner fra lista når en byggeplass velges.**
⚠️ **`hms.ts:207-209` bærer en kommentar som lover oppførselen koden ikke gir** — samme
løftebrist-klasse som Innboks-pila og «arkivert og skrivebeskyttet».
🟢 Ordre skrevet: `relay/inbox-byggeplassfilter-uttrekk.md` (uttrekk 9 → 1, buggene lukkes som
bivirkning, én test på setningen som ikke holdt).
🔴 **Coworks gate sa «bare to steder, ingen klasse» — det var feil.** Cowork lot dokgens måling
av andre BILDE-veier svare på et spørsmål om `drawing:{byggeplassId}`-mønsteret. **Agenten målte,
sa imot, og hadde rett.** Fjerde runde på byggeplass-tilhørighet.

🟢 **LUKKET SAMME DØGN — `d58e080f`.** Fem prosedyrer gates nå på `verifiserProsjektmedlem` via
resolvert `projectId`; `prosesser.ts` slettet og den offentlige flaten finnes ikke lenger.
Detaljer + metode i [`sikkerhet.md`](sikkerhet.md). **Historikken under står fordi den viser hvor
funnet kom fra: bifangst fra en kostnadsmåling ingen hadde bedt om.**

🔴 **FIRMAGRENSEN VAR ÅPEN PÅ FIRE SKRIVEVEIER (målt 2026-09-06, redesign).**
`kontrakt.oppdater`/`kontrakt.slett` og `mengde.lagreNotat`/`mengde.slettPeriode` er
`protectedProcedure` — innlogget, men **uten firma- eller prosjektsjekk**. De gjør
`update({ where: { id } })` rått. **Enhver innlogget SiteDoc-bruker kan endre eller slette et
annet firmas kontrakt hvis han kjenner id-en**, og `slett` nuller `kontraktId` på faggrupper og
dokumenter på veien.
🔴 **Bryter den ufravikelige regelen i CLAUDE.md:** *«Firma-admin ser KUN sitt eget firmas data»*
og *«firma-grense-sjekk ligger ALLTID i server-laget»*.
⚠️ **`POST /prosesser/:documentId` (`server.ts:160`) har ingen autentisering** og er eksponert på
`api.sitedoc.no`. Krever en gyldig UUID for å gjøre noe, så terskelen er høyere — men den er åpen.
🟢 Egen branch `fix/ftd-tenantgrense`, **prioritert foran FL-funksjonen**. Funn skrives til
`sikkerhet.md` i samme commit.
**Funnet som bifangst da redesign målte FL-ordrens guard-kostnad** — ingen lette etter det.

🟡 **ET GLEMT UTKAST SPERRER MALENDRING PERMANENT (Kenneth-funn 2026-09-07).**
Endringsvernet teller dokumenter med faktisk verdi i feltet — **et utkast med verdi er et utfylt
dokument**, som er teknisk riktig etter Kenneths eget vedtak. Men konsekvensen er at en
malforfatter kan låses av **andres uferdige arbeid**, uten vei rundt annet enn å kopiere malen.
⚠️ **Hos A.Markussen med 50 ansatte er dette en sannsynlig tilstand, ikke en teoretisk.**
**Egen beslutning — Kenneth avgjør. Ingen har rørt predikatet.**

🟡 **`antallDokumenterFeilet` vises ikke i eksport-UI (målt 2026-09-07, kontrollplan).**
Feltet finnes ikke i modellen; ny kolonne = migrering. **Men dataen bæres migreringsfritt:** på
status `klar` er feilede = `antallTotalt − antallFerdig`, og begge felt ligger allerede i
`hentForProsjekt`-selecten. **En web-oppfølger på klar-kortet er reelt tre linjer, ingen
api/schema-endring.** Uten den må kunden åpne `manifest.json` for å oppdage at dokumenter manglet.

🟡 **Task har ingen egen `byggeplassId`** — tilhørighet finnes kun via tegningen, og det er
roten til hele asymmetrien over. Å legge feltet på `Task` ville fjernet den, men er **en
migrering på produktets nest mest sentrale tabell rett før pilot**. **Egen beslutning når noen
vil ta den** — ikke smuglet inn i en bugfiks.

🟡 **Innboksen har et HARDT TAK på 10 rader (målt 2026-09-06, redesign-Opus).**
`hjem.tsx:472` — `.slice(0, visAlleInnboks ? 10 : INNBOKS_MAKS)`. Ved 40 aktive dokumenter viser
badgen **40**, «Se alle» folder ut til **10**, og **de resterende 30 er ikke nåbare fra
innboks-seksjonen** — kun via Oppgaver- og Sjekklister-fanene.
🔴 **Seksjonen viser altså et tall den ikke kan liste.** Fra ~11 aktive dokumenter er den
ufullstendig. **Egen innboks-skjerm (variant B) er berettiget** — med søk/filter/sortering fra
dokgens dokumentliste-komponenter (`31002232`), ikke en ny flate uten dem.
⚠️ **Ikke akutt, men ikke hypotetisk.** A.Markussen med 50 ansatte passerer 10 aktive fort.

🔴 **PROSESSFUNN 2026-09-06 — ANDRE GANG: standardgaten mangler `pnpm test`.**
Gate-kjeden i coworks ordrer er `install → prisma generate ×4 → web build → mobil typecheck
→ mobil lint`. **Ingen tester.** Dokgens `e49e8ea3` passerte hele gaten og brakk likevel
`tilbehorVisning.test.ts` — testen forventet `vis: true` for `signature` etter at typen ble
lagt i deny-lista. Merge-agenten fanget det og stoppet før push, men da hadde allerede tre
ledd vært involvert.
**Samme hull som 03.09** (SafeAreaView-importen som lint forbød, men gaten ikke kjørte).
🟢 **Rettet: `pnpm test` fra ROT er nå del av standardgaten i alle nye ordrer.** Samme
kommando CI kjører — kostnaden er ventetid hos agenten, som er billigere enn en runde
gjennom Kenneth.

🟡 **Status-brudd i endringslogg-koalesceringen — bevisst utsatt (2026-09-05).**
Koalesceringen bryter vinduet på tid (10 min) og bruker, **men ikke på statusskifte** — fordi
`endreStatus` ikke skriver noen loggrad, så det finnes intet lagret signal. Det riktige fikset er
`statusEndretAt` på `Checklist` + `Task`, altså **en migrering på produktets to mest sentrale
tabeller, rett før pilot**. Cowork utsatte den bevisst framfor å smugle den inn i en bugfiks.
Eksponering lav: krever samme bruker, samme felt, før OG etter statusskifte, innen ti minutter —
konsekvens er én sammenslått rad, aldri tapt data. **Egen beslutning når noen vil ta den.**
Dokumentert i `apps/api/src/services/endringslogg.ts:27-34`.

🔴 **`seed.ts` PRODUSERER ORPHAN-PROSJEKTER (funn 2026-09-05, redesign-Opus).**
CLAUDE.md-regelen fra 2026-05-20 sier at prosjekt-opprettelse **må** kreve firma. Regelen er
håndhevet i API-mutasjonene, men **hoved-seeden bryter den selv** — den setter ikke
`primaryOrganizationId`. Funnet da `seed:sja` gjorde samme feil og Kenneth ikke fant
demo-prosjektet fra sin firmakontekst på test.
⚠️ **Merk feltnavnet:** `Project.primaryOrganizationId`, **ikke** `organizationId` — firmakontekst
lister på det feltet (`prosjekt.ts:30/56/90`). `ProjectOrganization`-join er kun visning.
**Egen sak, ingen agent tildelt.** `seed:sja` er rettet (`8b3110b8`).

🟡 **Tvilling-paritetstest mangler (dokgen-funn 2026-09-06).** `packages/pdf/src/hjelpere.ts`
speiler `packages/shared/src/utils/signaturVerdi.ts` fordi `@sitedoc/pdf` har dokumenterte
null-avhengigheter. Speilet har peker-kommentar, men **ingen test som fanger drift** — endres
den kanoniske leseren, sier ingenting fra. Gjelder også den eldre `repeaterRad`-tvillingen.
**Fiks: én test som kjører begge implementasjonene på samme inndata og krever likt svar.**
Liten sak — kandidat for kontrollplan eller dokgen.

🟡 **Drift målt 2026-09-05 under SJA-målingen: `TILBEHOR_REN_FJERNING` har FIRE typer i web
og FEM i mobil** (`weather` ekstra på mobil). `RapportObjektRenderer.tsx:59` vs `:47`.
To sett som skal være ett — samme klasse som `IKKE_UTFYLLBARE_FELTTYPER`-driften dokgen fant.
**Fiks = ÉN delt kilde i `@sitedoc/shared`**, og `weather`-avviket avklares mot Kenneth
(er vær-tilbehør bevisst av på mobil, eller glemt?). Egen liten sak — ingen agent tildelt.
⚠️ **Dokgen legger `signature` inn i begge sett nå** — driften vokser til to sett à 5/6 hvis
den ikke lukkes snart.

🔴 **Kenneth 2026-09-03: «fiks alle de feil jeg meldte inn før nytt EAS-bygg → #1-6.»**
Seks funn fra bygg 50. **Byggkvoten gater rekkefølgen** — vi bruker ikke ett av ~15
månedlige iOS-bygg på et halvt sett. To agenter i parallell, ett bygg når begge er merget.

| Funn (bygg 50, 2026-09-03) | Alvorlighet | Status |
|---|---|---|
✅ **ALLE FEM ER PÅ DEVELOP** (`dc454d22`). A/B/D `f9ea2255` (kontrollplan) · C/E `da4d3035` (dokgen) ·
safearea-fiks `dc454d22`. Venter på simulator-røyklisten før EAS-bygg 51.

🔴 **Prosessfunn samme dag — lint er ikke i regel 10.** Bygg 50-E introduserte en `SafeAreaView`-import
som lint-regelen fra 31.08 forbyr eksplisitt («0 padding inne i `<Modal>`»). Gaten kjører `web build` +
`mobile typecheck`, **ikke `pnpm lint`** — så regelen fantes, var riktig, og fanget ingenting.
Lukk/del-knappene i PDF-forhåndsvisningen lå under Dynamic Island. Fanget av dokgen som «preeksisterende
støy», omklassifisert av cowork etter å ha lest regelmeldingen. **Samme mønster som `pnpm test`-fella i
august: en gate ingen har målt er en påstand.** Eget punkt: lint inn i regel 10.

| **#1** Bilder tatt tidligere vises ikke i rapportobjekt-raden — ser ut som datatap | 🔴 blokkerer | ✅ Ordre C → dokgen, merget `da4d3035`. Additiv `settVedleggUrl` + sletting gatet på server ELLER SQLite. ⚠️ Krever **prod-deploy** for full effekt hos testerne |
| **#2** Ingen PDF-kontroll før sending (finnes, men kun som iOS share sheet fra ett ikon) | 🔴 for dette bygget | ✅ «Forhåndsvis PDF» rett over Send-knappen, WebView i appen. Merget `da4d3035` + insett-fiks `dc454d22` |
| **#3** Endringsloggen står åpen i UI (mobil **og** web) og viser rå UUID-er | 🟡 skjemmer | Ordre D → **kontrollplan**. 🔴 **Loggen BEVARES** — skjules bak knapp, lukket som standard, på begge flater (Kenneth 03.09). UUID-visningen er eget funn: mobil bruker allerede delt `ekspanderEndring`, så det er kolonne-oppslaget som bommer |
| **#4** Tegningslista ignorerer valgt byggeplass — kaos ved 30-40 tegninger | 🔴 blokkerer | Ordre B → **kontrollplan** |
| **#5** Byggeplass-velgeren usynlig: chippen leser **timer-modulens** cache (`ByggeplassChip.tsx:26`, `:44`) | 🔴 blokkerer | Ordre A → **kontrollplan** |
| **#6** Bekreftet at enheten kjører bygg 50 (`da0f018`) | — | Ingen feil |

✅ **ALLE SEKS LUKKET OG SIMULATOR-VERIFISERT 2026-09-03** — develop `79540337`, test-API `dc454d22`.
Røyklisten dekket A/B/D/E på `da4d3035`, C og miniatyr-fiksen på `451cbb3a`.

🟢 **Funn #3 «eget funn» (endringsloggen sa ikke HVA som ble endret) løst — branch `fix/endringslogg-innhold`:**
Rot målt: `diffRepeater` (`packages/pdf/src/arkivmal/endringsdiff.ts`) leste `Object.keys` på den innpakkede
rad-formen `{_radId, felter}` i stedet for `.felter` → «Kolonne N» (posisjon, ikke navn) OG tom celle-diff
(«til «Ikke utfylt»» uten «fra»). Ett symptom, én fiks: uttrekk via **kanonisk tvilling** `feltKartFraRad`
(`packages/pdf/src/arkivmal/repeaterRad.ts`, null-dep-tvilling av `@sitedoc/shared/utils/repeaterRad.ts`,
toveis-peker) → riktig kolonnenavn + fra/til på web + mobil + arkiv-PDF samtidig. Bar UUID-verdi (historisk
tegningsreferanse) skjules som «(tegningsreferanse)» i `lesbarVerdi` — aldri rå UUID i et kvalitetsdokument.
Lærdom: repeater-testene traff aldri produksjonsformen (flat legacy) — nå testes `{_radId, felter}` FØRST.
Gate: web build + mobil typecheck grønt, api-arkiv 41 + pdf 90 + shared 7 + web 189. OTA-kandidat (ren JS).
Tidslinje-fletting (mangel 4) skilt ut til fabel — informasjonsarkitektur, egen designbeslutning. Ikke deployet.

🔴 **Simulatoren gjorde noe vi skal gjenta: den lette etter BILDET, ikke etter fravær av feilmelding.**
Miniatyr-fiksen bygger den lokale stien av vedleggets filnavn; hadde navnet ikke matchet fila på disk,
ville den falt stille tilbake til gammel oppførsel — grønt uten å være en fiks. Ordren ba eksplisitt om
å se etter det positive beviset. **Formen bør inn i alle verifiseringsordrer:** si hva som skal SEES,
ikke hva som skal være borte.

✅ **LUKKET 2026-09-04 — filteret var riktig, teksten er feil.** Chippen sier «Viser kun denne
byggeplassen», mens `sjekkliste.ts:185` filtrerer **mykt** (`OR: byggeplassId = null`). Det ble ført
som mistenkelig. **Kenneths domeneforklaring 04.09 avgjør det:** et dokument uten byggeplass gjelder
*hele prosjektet* — altså også denne byggeplassen — og skal være med. Filteret er korrekt.
🟡 **Gjenstår: chip-teksten**, som lover en avgrensning systemet med rett og vilje ikke gjør.
⚠️ **Og et nytt spørsmål:** tegninger filtrerer **hardt**. Sannsynligvis riktig (en tegning hører til
ett sted), men forskjellen er ikke vedtatt noe sted.
Full begrunnelse: [domene-arbeidsflyt.md § byggeplass er et valgfritt oppdelingsnivå](domene-arbeidsflyt.md).

🔴 **NYTT FUNN 2026-09-04 — byggeplasser har TID og ANTALL. Modellen bærer ingen av delene.**

Kenneth, to utsagn samme kveld:
> *«Et prosjekt kan ha flere byggetrinn → prosjektet kan vare i 5 år, med tre forskjellige bygg,
> som starter når det første er ferdig.»*
>
> *«Et prosjekt kan leve i 30 år eller mer — men bestå av mange kortvarige prosjekter som varer en
> uke eller en måned. Kanskje vi må skjule og lukke disse etter behov.»*

**To skalaer.** Byggetrinn = tre enheter over fem år. Rammeavtale/driftskontrakt = **hundrevis av
ukelange enheter i én beholder over tiår.** `Byggeplass` har i dag verken tilstand, start/slutt
eller arkivering.

**Forutsigbart brudd ved stor skala:** byggeplass-velgeren (`ByggeplassChip` + dokumentskjemaer) er
ubrukelig i felt med 500 valg · dokumentlister vokser uten grense · «vis kun aktive» går fra
bekvemmelighet til forutsetning.

✅ **Modellspørsmålet er AVKLART — intet nytt nivå trengs.** Cowork spurte om en ukelang jobb egentlig
var et `Project` med avtalen over. Kenneth: *«En SiteDoc-kunde har prosjektnummer 100 → dette
prosjektet heter «Småprosjekter» → i SiteDoc heter disse byggeplasser.»* `Project` ER beholderen.

🔴 **Da er saken ren: `Byggeplass` mangler LIVSSYKLUS, ikke struktur.** Prosjekt 100 samler
hundrevis av byggeplasser over tiår, og ingen kan avsluttes eller skjules. Det gjør funnet konkret
nok til å bli en ordre — men modellen og UI-et (hva skjer med PSI, mannskapsliste, velgere) hører
til fabel først.

**Fabels domene. Ingen ordre skrevet.** Full utredning:
[domene-arbeidsflyt.md § byggeplass er et valgfritt oppdelingsnivå](domene-arbeidsflyt.md).

> 🔴 **Kenneths kritikk av arbeidsformen, 2026-09-03 — skal stå:**
> *«Istedenfor å forsvare tidligere valg og si at jeg leter på feil plass, så må man erkjenne at
> vi endret ikke på riktig plass når enkel logikk ikke fører til målet.»*
>
> Cowork svarte først at chippen fantes på fem skjermer og at Kenneth hadde åpnet feil kontroll.
> **Målingen ga ham rett:** chippen returnerer `null` uten feilmelding når timer-cachen er tom.
> **Akseptkriteriet som følger:** en runde er ikke levert før noen som *ikke vet hva som er
> endret* kan finne endringen. En komponent som finnes i koden er ikke en endring brukeren har fått.
>
> **Og modellen han beskrev — velg prosjekt + byggeplass på hjem, alt nedstrøms følger — er
> allerede appens modell.** Ti skjermer sender `byggeplassId` fra `ByggeplassKontekst`.
> Tegninger er den ene som meldte seg ut. Vi innfører ingenting; vi tetter.

### 🔴 FUNN 2026-09-05 — PROD har tomt sentralarkiv OG tom dokumentsøk-indeks

🟢 **Arkivdelen LUKKET 2026-10-07:** SiteDoc-arkivet seedet i prod etter DEPLOY-RUNBOK § 8 — 4 standarder / 17 kapitler / 27 maler / 402 objekter (fra 0). ⚠️ Dokumentsøk-indeksen er ikke målt på nytt — den delen står åpen.

Målt i tre miljøer 05.09 mens malverkstedet ble kartlagt:

| Database | Bibliotekmaler | Chunks | Med embedding | Dokumenter |
|---|---|---|---|---|
| **`sitedoc_test`** (server-ny) | 6 | 6 389 | **5 745** | 277 |
| **`sitedoc`** (PROD) | **0** | **0** | **0** | **0** |
| `sitedoc` (Kenspill, legacy) | 0 | — | 0 | — |

🔴 **Logger A.Markussen inn i prod i dag, er «Lån fra SiteDoc-arkivet» TOM, og AI-søket har
ingenting å søke i.** Malarkivet som ble bygget 04.–05.09 (`91e3e5a6`, `2cfdbaea`, `51bad500`) er
en tom hylle i produksjon.

**Ikke en kodefeil:** `seed-bibliotek.ts` er aldri kjørt mot prod, og dokumentene er aldri lastet
opp dit. Men det må lukkes før pilot.

⚠️ **Kan ikke lukkes ved å kjøre seeden som den står** — se § seed-bibliotek under: den sletter
`ProsjektBibliotekValg` og nuller B4-avstamningen. Ordre skrevet
(`relay/inbox-seed-bibliotek-idempotent.md`).

### 🟡 FUNN 2026-09-05 — malarkivet mangler INNHOLD, og feltet for å kvalitetssikre det er dødt

Kenneth lastet opp **NS 3420-kildedokumentene** til prosjektets mappestruktur 05.09 (ti kapitler
som PDF: a, cd, d, f, gu, j, k, l, z, 1 — alle `_2024_`). Det svarer på hvor ekte maler skal komme
fra, men avdekker tre ting som henger sammen:

| | Målt |
|---|---|
| **Sentralarkivet** | 13 maler, alle fra `seed-bibliotek.ts` (håndskrevet) |
| **`BibliotekMal.verifisert`** | 🔴 **Død kolonne.** Finnes i schema med kommentaren *«True når malen er verifisert mot kilde-norm»* — settes ikke i seed, leses ikke i `apps/api` eller `apps/web`. Samme klasse som `ansvarsmerke` |
| **Kilde-normen** | Ligger nå i systemet, men **ingen kobling** til `BibliotekMal` finnes |

🔴 **Malarkivet mangler innhold, ikke funksjonalitet.** AM 4b (`51bad500`) gjorde flaten brukbar
ved hundrevis av maler — vi har tretten, og ingen av dem er merket kontrollert mot normen.

**Spørsmål som hører til fabel, ikke til en kodeordre:**
- Skal maler lages **fra** NS 3420-postene, og i så fall av hvem? Det er domenearbeid — noen må
  avgjøre hvilke felter en sjekkliste for «KB4 Grasdekke» skal ha.
- Kan SiteDocs egen AI-søk/embedding brukes til å foreslå malstruktur fra en NS 3420-post?
  **Ikke utredet — ikke anta at det er lett.**
- Skal `verifisert` tas i bruk, eller strykes som `ansvarsmerke`? En død kolonne som beskriver en
  kvalitetsprosess vi ikke har, lover mer enn systemet holder.
- ✅ **LISENS AVKLART 2026-09-05 (Kenneth) — ikke en blokkerer.**
  > *«Jeg har tilgang hver dag til disse dokumentene og kan lese selv. Vi skal bygge våre egne
  > sjekklister basert på NS 3420. Om jeg gjør det manuelt eller en agent gjør det for meg er det
  > samme. Vi lager ikke en kopi av NS 3420.»*
  >
  > *(Kenneth sa først «tester» og korrigerte til «sjekklister» — **«test» er ikke et
  > SiteDoc-begrep.** Se [terminologi.md](terminologi.md). Malene vi bygger er sjekklistemaler.)*

  🔴 **Den operative regelen for den som bygger maler:** en sjekkliste som **kontrollerer mot** et
  krav er vårt eget verk. En som **gjengir kravteksten** er en kopi.

  | Lov | Ikke lov |
  |---|---|
  | «Kontroller at jordblanding tilfredsstiller NS 3420-K **KB2.1**» + felt for måling og avvik | Å lime inn kravtekst, tabeller eller toleranseverdier ordrett fra standarden |
  | Referere til punktkode som kilde | Gjengi standarden slik at malen erstatter den |

  **Cowork overvurderte dette 04.09** — samme feil som med eksponeringsregisteret (se
  [domene-arbeidsflyt.md § ansvarsgrense](domene-arbeidsflyt.md)). To juridiske hensyn blåst opp
  på to dager. **Mål før du kaller noe en blokkerer.**

⚠️ **Blokkerer ikke piloten i seg selv**, men et malarkiv med tretten maler er ikke et arkiv.
Hører sammen med EX og BL på fabels bord.

### 🔴 FUNN 2026-09-05 — SJA kan ikke dokumentere HVEM som har signert

Kenneth: *«Jeg trodde vi hadde kontroll → Opus sa tidligere at alle 7 arbeiderne kunne signere →
jeg tok det for gitt at vi også dokumenterte at alle 7 hadde signert.»*

**Målt: tre mekanismer, ingen løser det.**

| Mekanisme | Hva den gir |
|---|---|
| `signature`-rapportobjekt (`felt.ts:131`) | **Kun bildet.** Ingen navn, tidspunkt eller identitet — anonym strek |
| Signaturseksjon i arkiv-PDF (`arkivmal/signatur.ts`) | **Maks to navngitte**, og de er dokumentflyt-roller («Utført av»/«Godkjent av») |
| `persons`-felttype (`felt.ts:112`) | Syv navn i en liste — **deltakerliste, ikke signaturer**. ⚠️ Skriver i tillegg ut rå UUID-er (åpent backlog-funn) |

🔴 **Kun ÉN signatur-modell i hele schemaet: `PsiSignatur`.** Ingen deltaker-modell.

**Sannsynlig kilde til misforståelsen:** `persons` lar syv personer legges til. «Syv kan legges
til» og «syv kan signere» ligner hverandre, og grensesnittet skiller dem ikke.

**Konsekvens i felt:** en SHA-koordinator som tar med utskrevet SJA ut på plassen for å
kontrollere at alle har signert, **finner ikke svaret der.**

🟢 **Mønsteret finnes:** `PsiSignatur` (`schema.prisma:1942`) har userId ELLER gjest
(navn/firma/telefon), HMS-kortnr, `completedAt`, unik per person — og
`gjeldende: psiVersion === psi.version`, som **viser om signaturen gjelder dokumentet slik det er
nå.** Kritisk for SJA: endres risikovurderingen, er tidligere signaturer på feil dokument.

**Fabels domene — bestilling sendt 05.09**
([BESTILLING-sja-signaturer](../redesign/til-fabel/BESTILLING-sja-signaturer-2026-09-05.md)).
Ingen ordre skrevet. ⚠️ **Cowork vurderer dette som høyere pilotprioritet enn resten av
malarbeidet** — SJA er lovpålagt, og A.Markussen bruker innleid mannskap.

### 🔴 AVKLART 2026-09-04 — RUH og avvik kan IKKE leveres som PDF (lovpålagt dokumentasjon)

**Målt i `hms.ts:221-269` — hvilken Prisma-modell hver HMS-type faktisk bruker:**

| Dokumenttype | Modell | Arkiv-PDF i dag | Web | Mobil |
|---|---|---|---|---|
| Sjekkliste | `Checklist` | ✅ | ✅ | ✅ |
| HMS **SJA** | `Checklist` | ✅ | ✅ | ✅ |
| **Oppgave** | `Task` | ❌ | ❌ | ❌ |
| **HMS avvik** | `Task` | ❌ | ❌ | ❌ |
| **HMS RUH** | `Task` | ❌ | ❌ | ❌ |

🔴 **RUH og avvik er lovpålagt HMS-dokumentasjon.** At de ikke kan leveres som PDF er en
pilotblokkerer, ikke en skjønnhetsfeil.

**Rotårsaken er ÉN:** `services/arkiv/render.ts:94` kaster for alt annet enn sjekkliste
(«task-innholdsleser mangler»). `arkiv.rendr` godtar allerede `type: "oppgave"` i kontrakten
(`arkiv.ts:51`) — kun leseren mangler.

✅ **Flate-pariteten er derimot allerede på plass.** Web og mobil kaller samme `arkiv.rendr`; begge
har PDF for sjekkliste, begge mangler for task. **Kenneths premiss «web tilbyr et sett utskrifter,
det samme bør gjelde app» er målt — hullet er dokumenttype, ikke flate.** Bygges task-leseren, får
tre dokumenttyper PDF på to flater i samme runde.

*(Web har i tillegg timer-rapportens printmotor. Den er en firmaflate og hører i web —
[feltarbeid-skillet](SAMARBEIDSREGLER.md), Kenneth 04.09.)*

Funnet kom fram fordi dokgen rapporterte et sidefunn i stedet for å la det passere
(lokasjonOmfang-runden, 04.09), og fordi Kenneth samme kveld påpekte at han sier «sjekklister» om
funksjoner som er generelle. Se [SAMARBEIDSREGLER § «sjekkliste» betyr ofte «dokument»](SAMARBEIDSREGLER.md).

### Feltfunn 2026-09-04 (prod-verifisering av `96eebc13`)

Kenneth sammenlignet samme befaringsnotat i mobil, web og arkiv-PDF etter prod-deployen.

| Funn | Alvorlighet | Status |
|---|---|---|
| Web viste ikke bildets opptakstidspunkt — mobil og PDF gjorde. Målt: **null treff på `opptakTidspunkt` i `apps/web`** | 🟡 skjemmer | ✅ Merget `d610acb8`. Gjenbruker `formaterDatoTidPunkt` fra `@sitedoc/pdf` (ingen tredje kopi); `undefined` ⇒ tomt (historiske bilder urørt), `null` ⇒ `felt.opptakTidMangler` (15/15 språk), aldri innleggingstid. **Web — når ikke brukeren via OTA, venter på neste prod-deploy** |
| `RapportObjektVisning.tsx:143` (oppgave-detalj + web-utskrift) viser fortsatt `opprettet` = innleggingstid | 🟡 skjemmer | Samme paritetsbrudd, annen flate med egen vedleggstype uten `opptakTidspunkt`. Ikke ordre — hører sammen med den flatens egen opprydding |
| Arkiv-PDF: overskriften «BILDER» står alene med ~halv side tomrom, bildene rendres på neste side | 🔵 notert | Sidebrekk-regelen holder ikke overskrift og innhold sammen. Rotårsak ikke funnet (dokgen var ikke i arkivmal-layouten og gjettet ikke) |
| Arkiv-PDF: felt vises som `_` med «Ikke utfylt» — etikett mangler eller er tom | 🔵 notert | Rotårsak ikke funnet |
| Bildeteksten i web er satt til **9 px** — PDF og mobil bruker vesentlig større | 🔵 notert | Vurderes visuelt når endringen er på test; justeres hvis den er for smått til å leses før godkjenning |

### Eldre feltfunn

| Funn | Alvorlighet | Status |
|---|---|---|
| Tegningsminne mangler i repeater-raden (fem trykk mot ett) | 🟡 skjemmer | ✅ Merget 01.09 (`5b5f5442`). **Ikke i noe bygg** — verifiseres av røykliste flyt 3 (kostet 7 trykk sist) |
| Endringslogg-støy i oppgave (rå `JSON.stringify` mot sjekklistens `likForDiff`) | 🟡 skjemmer | Ordre klar 01.09, funn-sporet |
| «Lagre» dekkes av tastaturet i dagsseddel (røykliste flyt 9) | 🟡 skjemmer | Ikke ordre |
| «Bekreft»/«Opprett» disabled uten forklaring (røykliste flyt 3, 6) | 🟡 skjemmer | Ikke ordre |
| Ingen lenke mellom firmamoduler og prosjektmoduler | 🟡 skjemmer | ✅ Levert i steg 3 (`97d074b8`) — toveis lenke + grå-under-tak. Gates på test |
| `as unknown as ProjectModuleRad[]` (`oppsett/produksjon/moduler/page.tsx:90`) | 🔵 notert | Fra før steg 3. Mønsteret SAMARBEIDSREGLER flagger — cast som skjuler manglende felt |
| Fototilgang førstegang → app falt til hjemskjerm (én gang, ikke reprodusert) | 🔵 notert | Overvåkes i røyklisten |

🔵 **DEPLOY-RYTME ENDRET (Kenneth 2026-08-29 kveld):** *«Det er ingen vits å deploye nå — vi
kan utvikle mer fra masterplan først. Dette er små endringer som bare koster tid og er
ineffektiv utvikling.»* Åtte test-deployer og to prod-releaser på én dag, flere for
tofils-endringer. **Ny form: brancher merges til develop løpende** (så de ikke råtner — vi så
i dag hva som skjer når 20 innslag blir stående), **men test-deploy skjer når det finnes et
sett verdt å gate.** Cowork eier vurderingen av når settet er stort nok.

✅ **PROD À JOUR 2026-09-04** — **`96eebc13`** (14 commits, 38 filer, +803/−209): EXIF-opptakstid
og -sted på bilder · lesbar endringslogg (kolonnenavn + fra→til, rå UUID skjult) · kanonisk
`repeaterRad`-tvilling. **Ingen migreringer** («No pending migrations to apply»). Api og web
bygget sekvensielt, begge oppe.
⚠️ **Ustemplet deploy** — `/version` svarer `{"gitSha":"dev"}` fordi den lim-klare prod-blokken
manglet `GIT_SHA`/`BUILD_TID`. Rettet i [deploy-detaljer.md § PROD-deploy](deploy-detaljer.md)
samme dag; prod er stemplet fra og med neste deploy.

✅ **OTA I DRIFT fra 2026-09-04** — første `eas update` publisert til kanal `production`,
runtime `1`, commit `cdb53296`, verifisert på Kenneths iPhone mot bygg 54. **JS-fikser koster
ikke lenger byggkvote.** Web måtte tas ut av `platforms` (`app.json`, `2b73ae68`) — `eas update`
kaller eksporten med `--platform=all`, og web-bundelen har to uavhengige feil. Full mekanikk:
[eas-build-veileder.md § OTA](eas-build-veileder.md).

📌 **Historikk:** prod sto på `af49823f` fra 2026-09-02 21:11 (132 commits, 175 filer, +10124/−1272).
Én migrering: `20260830120000_registrering_fase2_prosjekttilgang` (rent additiv, to `ADD COLUMN`).
De tre andre db-pakkene: «No pending». Migreringsgaten verifiserte `sitedoc`, ikke `sitedoc_test`.

**Verifisert som innlogget bruker på A.Markussen-data:** eksisterende sjekklister rendrer uten
«Felttype ikke støttet» (legacy-vernet for `location` holder) · nytt prosjekt fikk **ingen**
automatiske medlemmer under default `manuell` · endringslogg og PDF-tidsstempler stemmer med
veggklokka — **både formatereren og de lagrede øyeblikkene er riktige**, den fryktede
dobbeltforskyvningen finnes ikke.

📱 ✅ **TestFlight-bygg #54 ER UTE** (`d9ce38c0`, 04.09 12:36, 6m 9s, runtime `1` → TestFlight «Processing»).
Bærer alle seks funnene fra bygg 50, PDF-forhåndsvisning som virker, `expo-updates`, galleri-flervalg
med nummerering, kø-robusthet, vedlegg som overlever gjeninngang, og repeater-traverseringen.
**Forutsetning som måtte i prod først:** `settVedleggUrl` (prod-deploy `4eb05f73`) — uten den svarte
serveren 404 og vedlegg nådde aldri dokumentet.

⚠️ **BYGG 51 — to målinger som ikke lar seg forene, og cowork har tatt feil om den TO ganger.**

| Kilde | Hva den viser |
|---|---|
| `eas build:list` (04.09) | #51 = «iOS internal distribution build», profil `preview`, Runtime `None`, Channel `None` |
| App Store Connect → TestFlight (04.09) | #51 står som **«Testing»**, 5 invites, **2 installs, 53 økter** |

**Testerne HAR altså brukt bygg 51.** Cowork påsto først at den var et produksjonsbygg (feil grunnlag),
så at den aldri nådde testerne (også feil — TestFlight viser bruk). **Hvordan et internal
distribution-bygg havnet i TestFlight er ikke forstått, og skal ikke gjettes på.**

🔴 **Lærdommen, som gjelder uansett hvilken av de to som er «riktig»:** cowork førte begge påstandene
fra hukommelsen om hva som ble *startet*, ikke fra en kilde. Samme feilklasse som 31.08 («bygg 47 er hos
testerne» etter at 48 var fyrt). **Byggnummer, profil OG distribusjon leses fra `eas build:list` +
App Store Connect — og når de to er uenige, står begge i loggen til noen har målt hvorfor.**

⚠️ **Foreldet linje under — gjaldt bygg 50:**

📱 ✅ **TestFlight-bygg #50 ER UTE** (`28f117a8`, commit `da0f0181`, 02.09 23:43 → TestFlight 03.09).
Syv mobil-runder, **alle verifisert på simulator FØR bygget** — første gang
[kvalitetssikringsplanens](kvalitetssikring-plan.md) lag 2 fungerte som tenkt.
Se [eas-build-veileder.md § Bygg-logg](eas-build-veileder.md).

**Hva testerne er bedt om å se på:** tegningsminne + repeater-arv (målt 7→4 og 5→0 trykk) ·
«Hele prosjektet»-utveien i byggeplass-chip · språk pl/lt/sq med HMS-kategoriene.

⚠️ **Foreldet linje under — tavla sa `ba234fd1` mens prod faktisk var `3a2f7dc3` (29.08).
En prod-deploy ble aldri ført.**

✅ **PROD À JOUR 2026-09-06 17:15** — `82cd4459`. Verifisert: `/version` → `82cd4459`.
Migreringer: «No pending» (ingen nye siden `ad18df93`). **Innhold:** byggeplass-tilhørighet på
raden · ærlig chip-tekst · mykt tegningsfilter · «bekreftet av» på gjestesignatur · splittet
teller «X signert + Y bekreftet» · fritekst-lokasjon.
🟢 **OTA `c0d556ce`** publisert etter (api-filteret måtte ut først), pluss `42ef3059` tidligere
samme dag (utlogging + byggeplass-velger).

**Forrige prod: `ad18df93`** (2026-09-06 13:40, over tjue merger fra to døgn).
Stempel verifisert: `curl https://api.sitedoc.no/version` → `ad18df93`.
**Tre migreringer anvendt mot prod-DB:** `20260906000000_sja_signaturrunder` ·
`20260906120000_sja_innholdsversjon` · `20260906130000_signatur_bekreftet_av` ·
`20260906140000_lokasjon_fritekst` — alle additive, ingen kolonner slettet.

**Innhold:** SJA-signaturrunder (tre tabeller, felttypen `signature_list`, manko-liste,
serverlås, innholdsversjon per signatur, «bekreftet av» for gjest) · signaturfeltet bærer navn
og tidspunkt · kollapset signaturflate · endringsloggen koalescert + lukket som standard ·
malrevisjon D med utkast-badge · fritekst-lokasjon · delt `TILBEHOR_REN_FJERNING_BASE` ·
paritetsvakt på PDF-tvillingen.

🟢 **OTA publisert samme runde** (`333359a6`, runtime `1`, kanal `production`, update group
`523c0f61`) — rekkefølgen var **prod-deploy FØRST, så OTA**, fordi mobilkoden leser tabeller
som måtte finnes i prod-DB-en først.

⚠️ **Mobilflaten er IKKE verifisert av et menneske ennå.** Expo Go på Kenneths telefon er
SDK 57, prosjektet er SDK 54 — iOS tillater ikke eldre Expo Go, så test mot `sitedoc_test` var
en blindvei. Valgt vei: prod → OTA → verifiser på den ekte appen, med `eas update:rollback` som
nett (minutter, ingen byggkvote). **Risikoen ble vurdert lav fordi `signature_list` er inert i
prod til en mal bruker objektet.**

**Forrige prod: `ba234fd1`** (2026-08-28 16:00, 26 commits). **TestFlight-bygg #46** (`5605775d`)
sendt inn i runden før (`5dcdeb58`).

**Test: `1e259d55`** (deployet 2026-09-05 21:38, verifisert: `/version` → `1e259d55`).
🔴 **Hele SJA-signaturrunde-settet er nå på test** — rundene 2–5 merget 05/06.09: signatur bærer
navn+tidspunkt · kollapset signaturflate · tre nye tabeller + felttypen `signature_list` + PDF +
manko-chip · serverlås mot skriving på avsluttet runde · malrevisjon D · drift-konsolidering.

🟢 **Migreringen `20260906000000_sja_signaturrunder` ANVENDT** mot `sitedoc_test` — første og
eneste gang den har møtt en database. Den var generert offline (`migrate diff`) fordi lokal DB
har historikk-drift og mangler pgvector i shadow-basen; **den gikk gjennom på første forsøk.**
Øvrige tre db-pakker: «No pending».

🟢 **Testdata seedet 21:42** (`SEED_SJA_BRUKER=kemyrhau@gmail.com`): firma **SITEDOC MYRHAUG**,
prosjekt `SD-DEMO-SJA-0001`, SJA «Løft mobilkran — Akse 4». Deltakere: Kenneth (ansvarlig/admin),
Ola Tømrer, Nina Elektriker, gjest Truls Kranfører. Runde 1 avsluttet m/alle fire signert
(`antallDeltakere` frosset), **runde 2 åpen på 1 av 4** — Kenneths egen rad står usignert.
🔴 **Kenneth logger inn som seg selv via OAuth** — ingen demo-bruker kan logge inn.

⚠️ **Første seed-forsøk (21:15) lagde et ORPHAN-prosjekt** uten firma, og brukere uten
OAuth-kobling som aldri kunne logge inn. Rettet i `8b3110b8`; den idempotente `update`-grenen
reparerte raden på stedet. **Cowork gatet branchen, leste seed-fila og sjekket prod-guarden i
stedet for firmaregelen** — gaten sviktet, ikke bare koden.

🔴 **VENTER: fabels skjermbilde-gate.** Underlaget lister åtte flater
(`docs/redesign/til-fabel/skjermbilde-underlag-sja-signaturrunder-2026-09-06.md`).
**Ingenting av dette går til prod før gaten er kjørt.**

**Forrige test: `345de5e3`** (deployet 2026-09-02 11:00). Nytt siden
`d2b9d189`: **REG fase 3 — prosjekttilgang-evaluatoren** (`23a52504`) og **lokasjon-begrepsryddingen**
(`81225a93` — paritetsregel, `location` avviklet fra palett+seeds, repeater arver tegning fra rad
n−1). Migreringer: «No pending» på alle fire.

🔴 **FEM ugatete runder på test nå.** Anbefalt rekkefølge (én handling gater to ting): opprett et
prosjekt → tester **både** prosjekt-veiviserens tekst **og** at evaluatoren ikke slapp inn noen
under default `manuell`. Sett så én ansatt til `alle` → nytt prosjekt → kun han med, som vanlig
medlem. Deretter firma-veiviser, lokasjonsparitet og timer-rapporten.

⚠️ **Foreldet linje under — gjaldt forrige deploy:**

**Test: `d2b9d189`** (deployet 2026-09-02 00:09, verifisert med `/version`). Nytt siden `7b413263`:
**firma-veiviser** + **prosjekt-oppsettveiviser** (masterplanens punkt 1, begge ugatet) og **fem
timer-rapport-funn** fra Kenneths gate (velger i filterraden · innholdsbevisste bredder ·
maskinlinje foldet når `utleieEnhet="time"` · disabled-knapper forklart · «Last ned PDF»).
Migreringer: «No pending» på alle fire.

⚠️ **Foreldet linje under — gjaldt forrige deploy, beholdt til gaten er kjørt:**

**Test: `7b413263`** (deployet 2026-09-01 21:19, verifisert med `/version`). Migreringer:
«No pending» på alle fire pakker — settet har ingen schema-endringer (`db-timer/schema.prisma`
ble kun kommentert om til v3).

**Foran prod, web-synlig:** ANSVARLIG-kolonnen · modulhierarki steg 3 (✅ **gatet av Kenneth
18:30** — familieskillet holder) · endringslogg-speiling i oppgave (⚠️ **ugatet** — loggen vises
ikke i oppgavens UI, kun i arkiv-PDF, se BACKLOG) · **kolonnevelger + tabellbredder** (⚠️ venter
gate).

**Foran prod, kun mobil — når EAS-bygg fyres:** tegningsminne i repeater-raden · «Hele
prosjektet»-utvei i byggeplass-chip · modulgating av Timer-flatene. Fire mobil-endringer
uverifisert på enhet; røyklisten kjøres før bygget.

**Ellers står test og prod på samme innhold.** Alt som lå her som «på test» er live:
registreringsmodell fase 1 (ansatt-status-guard i 11 porter), ansattvelger, fundament ut
av gruppemodul-gatingen, tre slettevakter, deaktivert-på-dyplenke, `@xenova` fjernet.
Detaljer per spor: [historikk-2026-08.md § Prod-deploy 2026-08-28](historikk-2026-08.md).

🔴 **Første release som kan FRATA tilgang.** `OrganizationMember.status` styrer 11
prosjekt-porter. Deaktivering er manuell — ingen ansatt endret status ved deploy
(migreringen er additiv med default `aktiv`). Følg med på A.Markussen: sjekklister,
oppgaver og tegninger dukket samtidig opp for ansatte som ikke så dem før.

🔴 **`deploy-prod.sh` printet migrate-linja for kun `@sitedoc/db`, og etter `up`.** Begge
rettet i skriptet 28.08. Det var den linja som lot `20260811130000_utlegg_ordning_justering`
(`db-timer`) ligge ukjørt i prod i to uker — releasenoten på `a8750601` sa «ingen
migreringer», sant for `packages/db`, usant for `db-timer`. Utleggskategori-siden var
ødelagt i prod hele perioden; ingen meldte fra fordi timer-modulen ikke er i bruk der.
**Regel: spør databasen, ikke diffen** — alle fire pakker, hver gang, FØR `up`. Se
[deploy-detaljer.md](deploy-detaljer.md).

✅ **EAS-bygget er IKKE lenger blokkert (2026-08-27 kl. 22).** Opprett-frysen er lukket
og gatet 3/3 i Release/Fabric (`fix/malvelger-intree`, merget `52495604`).

**Fire runder på samme feilklasse, og den fjerde traff fordi premisset ble motbevist:**
`MalVelger.tsx:50` påsto at Fabric rendrer `<Modal>` inline uten native VC. Simulator
observerte svart pageSheet **med grabber** — en glyf bare UIKit tegner for en presentert
VC. `a29f89b2`, `df86b817` og `d4a76020` fjernet hver sitt nabo-ledd og lot det native
arket stå, fordi kommentaren sa det ikke kunne være kilden. Fiksen var å fjerne arket.
🔴 **D1 («krasj ved sending») fantes aldri som egen sak** — det var denne frysen,
feilaktig tilskrevet send-knappen. Send-flyten er verifisert frisk i både dev og Release.

**Veien til TestFlight er åpen:** merge develop→main → prod-deploy → migrering →
prod-verifisering som innlogget → env-diff (`eas-build-veileder.md`) → EAS
production-bygg → submit. Kvote ~8 igjen, reset 1. sept.

**Gjenstår på mobil, ingen av dem blokkerende:** timer-splitt som omgår server-validering
(lønn-integritet, høyest), papirkurv-guard, tab-bar-oppfølger fra
`relay/inbox-malvelger-intree.md`, og `BackHandler` uverifisert på Android.

**Printmotoren fase 1–4 er levert og på test.** Modellen ble snudd 2026-08-27: malen
styrer **skjermen**, og eksporten skriver ut det som vises. Se
[printmotor-faser-2026-08-25.md](delplaner/printmotor-faser-2026-08-25.md)
§ Retningsrettelse. Neste retning er **arkivering framfor nedlasting** — fabel eier
designet; det harde premisset er at `Folder.projectId` er påkrevd mens timer-rapporten
er en firma-flate.

**✅ TIMER-SPORET LUKKET 2026-08-24.** Fabels designgate på D3 bestått skriftlig:
[gatekvittering-d3-pivot-fabel-2026-08-24.md](../redesign/gatekvittering-d3-pivot-fabel-2026-08-24.md).
Rettecommiten for småfeilene er `5b104725` (verifisert i develop med `merge-base`).
Levert i samme runde: D3-pivotene, norm-kolonne med union-avvik, dagskort-hover med
tillegg/utlegg og tre innganger, URL-båret retur-navigasjon, kollaps/utvid alle,
«Krever vurdering» med auto-utvidede avvikssedler, og fem firma-guarder.

**Lukket 2026-08-23:** `mobil-device`-raden. `feat/mobil-arkiv-pdf` er merget (verifisert med
`merge-base --is-ancestor`); raden sto åpen på arbeid som lå i develop. Samme feilklasse som
utlegg-raden 2026-08-15 — en `❓ ingen status`-rad er ikke bevis for at noe gjenstår.

🔵 **Prod-releasen 2026-08-25 (`a8750601`, 198 commits) tømte etterslepet.** Develop er
nå 60 commits foran igjen — se tavla øverst for gjeldende tall og migrerings-status.
Den gamle 132-advarselen er avløst av den releasen og fjernet 2026-08-27.

**🔓 Frysen på `packages/pdf/src/felt.ts` er opphevet (2026-08-23).** Kontrollplan målte at
fila ligger i mobil-bundlen (Metro tree-shaker ikke barrel-re-eksporter), og konkluderte at
frysen sto. Cowork målte kallveien: null kallsteder i `apps/mobile`, og mobilens eneste
`@sitedoc/pdf`-import (`ekspanderEndring` m.fl. i `arkivmal/endringsdiff.ts`) har ingen kant
inn i `felt.ts`. **Bundlet ≠ kjørt** — død kode som endres, endrer ingenting for noen.
Vedtak ført i [dokumentgenerering-plan.md](dokumentgenerering-plan.md), branch
`docs/felt-frys-opphevet`. Bundle-størrelse er eneste gjenværende kostnad (egen sak).

**🗑️ PROD-DATAFIKS 2026-08-20 — timerader tømt for A.Markussen (før demo).** Ustrukturerte
testdata slettet på Kenneths ordre: 18 `daily_sheets`, 16 `sheet_timer`, 2 `sheet_tillegg`,
4 `sheet_machines`, 2 `sheet_tillegg_vedlegg` (0 utlegg, 0 historikk). Én transaksjon med
`ON_ERROR_STOP=1`; alle tall verifisert mot forhåndstelling. **Backup:**
`server-ny:~/backup/timer-for-sletting-20260820-0753.sql` (54K, hele `timer`-skjemaet).
De to vedleggsfilene flyttet til `~/backup/karantene-timer-20260820/` — **ikke slettet**,
fordi prod og test deler uploads-volum (test-DB verifisert til 0 referanser før flytting).
**Ikke rørt:** lønnsarter, aktiviteter, tilleggskatalog, maskinregister — oppsettet står.

**✅ KP MOBIL TOM-TILSTAND — LIVE-VERIFISERT 2026-08-21 (alle tre grønne).**
iOS-simulator fra `SiteDoc-simulator` mot api-test/`sitedoc_test`. Bevis:
`SiteDoc-simulator/kontrollplan-bevis/` (tre PNG).

| Tilstand | Kontekst | Skjermen viste |
|---|---|---|
| **A** | B12 → sommerfeldtsgt 65 (0 punkter) | «Ingen kontrollpunkter på denne byggeplassen» + trykkbart «Bygg B12 [7] ›» |
| **B** | Agent-testprosjekt → Testområde 1 (0 i hele prosjektet) | «Ingen kontrollpunkter» — ingen liste, ingen bytt-til |
| **C** *(edge)* | B12 → Narvik — **plan finnes, 0 punkter** | Identisk med A |

**Edgen var den som kunne gått galt:** `harPunkter` nøkler på `plan.punkter.length > 0`,
ikke på om planen finnes. En tom plan faller derfor til «ligger på»-grenen, ikke til
B-teksten. Verifisert i kode og live.

**404-degraderingen er verifisert borte** — ved capture svarte
`kontrollplan.andreByggeplasserMedPunkter` 200. Uten deployen ville queryen gitt 404 →
tomt kandidatsett → **A og C ville falskt vist seg som B**. At de viser «ligger på Bygg B12»
beviser at skjermbildene viser koden i drift, ikke feilmodusen. Verdt å huske som mønster:
en feilende query kan degradere til noe som ser ut som riktig oppførsel.

🟡 **Sidefunn å vurdere:** byggeplass-katalogen på mobil er per-firma og refreshes **ved
login** — firma-bytte alene synker den ikke. Verifiseringen krevde frisk innlogging for å få
Testfirma AS' byggeplasser. Om det er bevisst eller en mangel er ikke avklart.

**✅ AM ORDRE 2 STEG 1 LEVERT 2026-08-20** — `feat/am-ordre2-attestering`, 2 commits.
Design: [designnotat-attestering-fabel-2026-08-20.md](../redesign/designnotat-attestering-fabel-2026-08-20.md).
Grunnlag: [na-rapport-attestering-2026-08-20.md](na-rapport-attestering-2026-08-20.md).

- **`e4755aaa` — API-fikser + shared.** `erstattet`-filter i `hentTilAttestering` (+ alias)
  — dobbelttelling var en bug uavhengig av dette designet. Multi-status i
  `hentTilAttesteringFirma` (union, bakoverkompatibel). **`beregnUkenorm`** i shared med
  **injisert** dagsnorm-oppslag (server: `hentEffektivArbeidstid`, mobil: lokal variant) —
  37,5/40 forekommer aldri som literal, overgangsuker regnes blandet. Fallback-konstanten
  samlet til én `STANDARD_ARBEIDSTID_FALLBACK`; Prisma-`@default` forblir literal.
- **`9afc8951` — backstop (B) + snapshot.** `beregnOvertidsgrunnlag` +
  `lesOvertidsgrunnlagFraSnapshot` i shared. Backstoppen er **lese-avledning**, ikke
  persistert kolonne: overtidsgrunnlaget beregnes on-the-fly per sedel fra radenes timer ×
  effektiv dagsnorm (sommertid-bevisst). `attestertSnapshot` utvides **ved attestering**
  med uke-nivå grunnlag → etterprøvbart i ettertid.

🔴 **Vedtaket bak (B):** persistering ved skriving ble avvist fordi den fryser normen på
**feil tidspunkt** — attestanten skal se normen som gjaldt da *han* vurderte, ikke da
arbeideren førte. Systemet har allerede riktig mønster i `attestertSnapshot` (prissnapshot,
Fase 0 A.7), som fylles ved attestering. Fabel endret sitt eget designord («lagrer») da
argumentet ble lagt fram. Se [domene-arbeidsflyt.md](domene-arbeidsflyt.md) —
`lonnsartId` røres aldri av backstoppen; avvik mellom beregnet og valgt er noe attestanten
**ser**, ikke noe systemet retter.

**Tester:** 19/19 i shared, inkl. de to gate-testene — at beregningen aldri muterer input
(`lonnsartId`-invarianten), og at gamle snapshot-former gir `null`, aldri `0` (et `0` ville
sett ut som et faktum). Typecheck 5/5. Ingen migrering.

**Ytelse (målt av dokgen):** lese-avledningen gjør ett `hentEffektivArbeidstid`-kall per
unike dato, uke-scopet → ≤ 7 kall uansett antall rader eller ansatte.

**⏸ STEG 2 (D3-visningene) venter fabels designgate.** Ikke bygget.

**✅ AM ORDRE 1 (timer-bugs) LEVERT 2026-08-20** — `fix/am-ordre1-timer`, 3 commits, merget develop.
Fabels ordreliste: [referat-markussen-ordreliste-fabel-2026-08-20.md](../redesign/referat-markussen-ordreliste-fabel-2026-08-20.md).

- **1a `5eb47e6b` — delete-propagering server→mobil.** Rotårsak: `hentEndringerSiden`
  hadde **ingen delete-kanal**; juli-tombstonen (`slettede_rader_local`) er en lokal
  mobiltabell som kun går mobil→server. Server hard-sletter uten spor, klienten fjernet
  aldri lokale rader som manglet i svaret → splitt doblet timetall, og de 18 slettede
  sedlene levde videre. Fiks: pull-svaret bærer nå et autoritativt id-sett for et
  **eksplisitt intervall**. To vakter i delt, testet `finnSedlerÅSlette`
  (`packages/shared/src/utils/timerSyncSletting.ts`, 9/9): klienten sletter kun innenfor
  serverens uttalte intervall, og rører aldri `pending`/`avvist`.
  **Tombstone-tabell ble avvist** — hver delete-vei måtte da huske å skrive den, samme
  feilklasse som ga oss `steg`-problemet. Ingen migrering.
- **1b `e789ddc4` — play viker for manuell føring** (fabel-gatet regel (a), 2026-08-20).
  Play-genereringen kaller nå samme delte `finnOverlappendeTidsrom` som manuell-veien —
  ikke en kopi. Ved overlapp settes play-raden ikke inn; varselet sier hvilke tidsrom som
  vek og at den manuelle raden er beholdt.
- **1c `668b834f` — eksportfeilen er ikke lenger taus.** `håndterEksport` hadde
  `try/finally` uten `catch`; kast ble stille konsoll-rejection = «virker ikke» uten spor.
  Nå vises `e.message` i rød banner. **`xlsx`-sikkerhetsbyttet er irrelevant her** —
  timer-eksporten bruker allerede `exceljs`; FTD/økonomi er eget spor.

🟡 **ÅPENT på 1c:** det faktiske exceljs-kastet er **ikke pinnet**. Chrome-verktøyet nådde
aldri `document_idle` (presence-WebSocket holder siden «busy»). Vei videre: deploy catch-en
til test, kjør eksporten, les `e.message` i banneret. Server-side-flytt holdes tilbake til
kastet er identifisert.

**DoD klikktelling (fabels krav):** ingen av de tre fiksene endrer klikktall — 1a leser rent
fra lokal SQLite, 1b beholder play på 3 tapp (fjerner kun avvist-risiko), 1c er 2 klikk.
Det er et **funn**, ikke et tomrom: «mange klikk»-inntrykket adresseres i ORDRE 2s
designrunde (dagskort-åpning).

**Reload:** mobil 1a+1b er JS-endringer → Metro-reload i dev. TestFlight krever nytt
EAS-bygg (native uendret, men `@sitedoc/shared`-endringen må inn i bundelen).

**Branch-rydding 2026-08-20:** `fix/pakke-a-sikkerhet` merget + slettet på origin.
`fix/endringslogg-web` merget (`b4159178`) — den var **ikke** overflødig; `ce994756`
(ord-nivå diff, 133/133) hadde ligget ferdig og umerget siden 16.08.

**Venter på Kenneth:**

- **A4 Norkart** — utsatt, dialog tar tid. Kode urørt til ny nøkkel finnes.
- **Browser-verifisering av A1** etter test-deploy: dokument med tabeller rendrer, tegning
  kan inspiseres med hover-highlight. Bommer SVG-profilen, ser man det der.
- **TestFlight bygg 45** — testliste i [testliste-bygg-45.md](testliste-bygg-45.md).
- **Brannmur** — venter på LAN + fysisk konsoll. Ingenting eksponert utenfra (målt).

**Åpne fabel-saker:** repeater-prinsippet · papirkurv-sletterettigheter · mappe-modellens
flyt-spørsmål (punkt 4 i revidert synlighetsvedtak).

⚠️ **Statusfilene i `relay/status/` er utdaterte** (2026-08-20) — `mobil-device` sier
«FERDIG» fra S1-runden, `utlegg` sier «BLOKKERT» på noe som ble merget for en uke siden.
Denne tavla er sannheten; statusfilene oppdateres av agentene selv og drifter.


---

## EAS-byggteller (kvote ~15/mnd, fri plan — nullstilles den 1.)

> Ordre 1 ([SAMARBEIDSREGLER § Cowork leveranse-ansvar](SAMARBEIDSREGLER.md#cowork-leveranse-ansvar-ordre-2026-07-14)): cowork sporer EAS-bygg her. Ved **12 bygg/mnd** → stopp + sjekk klar-tilstand + flagg i status før nytt bygg fyres. Dato/# bekreftes mot `eas build:list`.

🔴 **DENNE TABELLEN ER FJERNET 2026-08-31 — den var et duplikat som drev.**

**Kanonisk byggteller: [eas-build-veileder.md § Bygg-logg](eas-build-veileder.md).**
Ikke før tall her; les dem der, og les dem der fra `eas build:list`.

**Hva som skjedde:** tavla førte kun `production`-byggene og sa «2 brukt, ~13 igjen» for
august. Veilederen var **allerede rettet 28.08** til «12 bygg, 11 tellende, ~4 igjen» — men
cowork leste bare tavla, korrigerte den mot `eas build:list`, og kom til ~3 igjen fordi det
errorede bygget 17.08 ble regnet som brukt. Veilederen visste at det var en CocoaPods 429 fra
EAS-infra som eksplisitt *«does not count towards usage»*.

**To registre for samme tall, og begge tok feil på hver sin måte.** Kenneth 2026-08-30:
*«vi kan aldri duplisere hverken UI eller kode»* — det gjelder tellere også. Tavla peker nå,
og teller ikke.

**Status 2026-08-31: 12 bygg, 11 tellende, ~4 igjen. Reset 1. september.**

**Lærdom 43→44:** to mislykkede fyringsforsøk på 43 brente **null kvote** — begge feilet under credential-validering før byggestart. Første: `~/.zshrc:17` manglet linjeskift mellom to `export`-linjer → `Invalid Apple Team Type: INDIVIDUALexport`. Andre: Apple 403 «This provider does not exist» da de nå korrekt parsede `EXPO_APPLE_*`-variablene ble sendt i stedet for EAS' lagrede credentials. Kvote telles først når bygget faktisk starter.

**Juli 2026 — 4 bygg brukt (av ~15), ~11 igjen.** Kilde: `eas build:list --platform ios` (ikke gjetning — forrige teller hadde feil datoer og utelot #37).

| # | Dato | Commit | Profil | Formål |
|---|------|--------|--------|--------|
| 37 | 2026-07-01 | `bc744f82` | production | mobil-MS + F-G |
| 38 | 2026-07-11→13 | `d1b96cd5` | production | F4-serien (identitetsforsoning + attestering-deadlock + synk-robusthet) |
| 39 | 2026-07-13→14 | `cd3efcb5` | production | S-A tombstone + del 6 (F-b/e/f/g) + footer |
| 40 | 2026-07-15 | `43299d03` | production | timer F2/F3/F5 + edge #1 (byggeplass per rad + matpause-bærer). Build `15a47804` → TestFlight |

Terskel 12/mnd ikke nær. **#40-lærdom:** EAS autoIncrement teller mot EAS' egne byggrecords, ikke ASC — første submit feilet på “build number 40 already used” (ASC hadde en 40 EAS ikke kjente). Bygget var intakt; ingen kvote brent på retry.

## 🔵 PROD-LIVE MERKNAD — sidebar-label byttet for ALLE (2026-07-14)

`nav.sok` «Søk»→«Dokumentsøk» + `nav.kontrollplan` «Kontrollplaner»→«Kontrollplan» rendres i gammel `HovedSidebar` (`sidebar-elementer.tsx:131,145`) — **ikke** bak `nyNavigasjon`-flagg. Kilde: `73f88112` (finnbarhet i18n), live i prod via develop→main-deploy **`43299d03`** (2026-07-15). **Pilot-support:** etiketten byttet for ALLE brukere, ikke bare ny-nav — bevisst (unngår label-mismatch på tvers av flagg-tilstand, jf. Lokasjoner/Byggeplasser). `firmaNav.innstillinger`→«Firmaprofil» er derimot INERT i prod (gammel firma-nav hardkoder «Innstillinger»).

## 🔴 SIKKERHET — flyttet til [sikkerhet.md](sikkerhet.md) (2026-08-28)

Punktet om uautentisert tilgang til sjekkliste-/oppgavebilder sto her med en
overskrift som hadde mistet kroppen sin — innholdet under hadde drevet over til
arkivmal-PDF. Vurderingen, de fire funnene om `/uploads/` og hva som er målt trygt
står nå samlet i [sikkerhet.md](sikkerhet.md). **Ikke dupliser hit.**

> 🟢 **ARKIVMAL I PROD 2026-08-16 (`c0b9f826` + runde 2).** Server-side PDF via Playwright erstatter ikke klient-utskriften ennå, men er komplett i vedtatt form: repeater-bilder i full bredde under egen rad (ikke samlet bakerst), løpenummer «Bilde 07 · 13.08.2026 10:41» lest fra `Vedlegg.bildeNr` med fallback til dokumentrekkefølge, IMG-filnavn og dokument-id ute, side 1-marger rettet (dobbel padding fjernet). **Rendertid 7,46 s på BEF-001** (73 bilder) — Kenneth målte i prod, tallet avblokkerer ytelsesspørsmålet.
>
> **Fabel-vedtak bak dette:** `arkivmal-repeaterbilder-vedtak-fabel-2026-08-15.md` + `arkivpdf-seks-funn-vedtak-fabel-2026-08-16.md`, begge in-repo i `docs/redesign/`. Mockup: `docs/redesign/arkivmal-pdf-mockup/`.
>
> **Gjenstår før klient-utskriften kan fjernes:** endringsloggen er den siste flaten som ikke gir mening for en leser — vær-rader gjentas (nøkkelrekkefølge varierer, ikke reell endring), «5 rader (14 bilder) → 5 rader (14 bilder)» sier ikke hva som endret seg. Samlet runde ligger i `relay/inbox-endringslogg.md` per Kenneths ønske om færre deploys. Sju øvrige saker fra mockup-gjennomgangen er ført i BACKLOG (statusblokk-etiketter, befaring som dokumenttype, to nye utskriftsformer, RUH/HMS, vedlegg-radformat, `bildeNr` i app, værsnapshot).

> 🟢 **LUKKET I PROD 2026-08-15 — målt sum 0.** `audit-sensitive-apen-sti.ts` (read-only, mot prod-DB) viser **null** sensitive fil-referanser på åpen `/uploads/`-sti: timer (tillegg+utlegg), kompetanse, maskin, `Image.file_url` og feltvedlegg i `Checklist`/`Task.data` — alle 0.
>
> **Veien dit, samme dag:** åpen `uploads/` ryddet (104 jpg → 102 slettet: 73 migrerte originaler + 2 foreldreløse + 27 uten referanse, **88 MB**). To rader i `timer.sheet_tillegg_vedlegg` sto igjen på åpen sti og ble migrert med `migrer-sensitive-filer-til-privat.ts --utfor`. Prod-dump før inngrepet: `~/backup/sitedoc-pre-slett-20260815-1251.dump`.
>
> **To hull funnet ved oppryddingen** (branch `fix/s1-feltvedlegg-privat`, merget `160c269a`):
> 1. `apps/mobile/src/components/rapportobjekter/FeltDokumentasjon.tsx:146` kalte `lastOppFil` med tre argumenter → `privat` falt til default `false`. Dette kallet går utenom `OpplastingsKoProvider` (som utleder `privat` korrekt fra id-ene). Steg 4 ville **avvist** disse opplastingene, ikke sikret dem.
> 2. `sheet_utlegg_vedlegg` (U1, 2026-08-08) manglet i alle migreringsscripts — lagt til som Type 4.
>
> **Prosessfunnet er viktigst:** S1 hadde **to** scripts, og bare `migrer-bilder-til-privat.ts` ble kjørt mot prod. `migrer-sensitive-filer-til-privat.ts` dekket timer hele tiden — den ble aldri kjørt. Ingenting fanget det; hullet ble funnet ved en filopprydding, ikke av en gate. Alle 15 kallsteder til `lastOppFil`/`/api/upload` er nå kartlagt (mobil-device punkt 4): de 9 øvrige uten `privat` er prosjektmedia, modeller, punktskyer, mapper og NS3420-import — ikke persondata.
>
> **Gjenstår:** `--rydd-originaler` (venter til test-DB også er migrert) · steg 4 hard validering (etter EAS-adopsjon) · test-miljøet ikke auditert.

## Branch-detaljer — aktive brancher (én rad per branch, ikke per agent)

> Hvem som sitter hvor står i **STATUSTAVLE** øverst. Denne tabellen er detaljnivået: hvilke filer branchen eier, hva som er committet, hva som gjenstår. Rad fjernes når branchen er merget + slettet.

> Kontrollflate for Kenneth ([SAMARBEIDSREGLER § Opus-livssyklus](SAMARBEIDSREGLER.md#opus-livssyklus--fire-faser-vedtatt-2026-07-16)). Rad skrives **før** økta åpnes; fjernes når branchen er merget + slettet. **Tom tavle = ingen aktive økter.** Ingen to rader deler arbeidstre eller fil.

| Økt | Arbeidstre | Branch | Eier filer | Åpnet | Status |
|---|---|---|---|---|---|
| **Malarkiv AM4b (lån-dialog ved skala)** | `SiteDoc-kontrollplan` | `feat/malarkiv-skala` | `apps/api/src/routes/bibliotek.ts` (ny `hentMalInnhold`) · `apps/web/.../firma/malarkiv/page.tsx` (lån-dialog: `LaanFraSentralarkivDialog` + `MalRad` + `FeltForhandsvisning`) · `apps/web/.../malbygger/PalettElement.tsx` (eksporter `felttypeNokler`) · i18n (9 nøkler × 15) | 2026-09-05 | 🟢 **Kodet, pushet (fra develop `a7f112da`).** «Velger ved skala»-mønsteret (L4) i lån-dialogen: **L1** inspiser-før-lån (rad → read-only feltliste, feltnavn+type i rekkefølge gruppert på FØR/UNDER/ETTER slik lån-mutasjonen bygger malen; lån-knapp i preview + på rad) · **L2** kollapsbare kapitler med antall-header, start kollapset >20 maler, kun økt-tilstand (`useState<Set>`, ikke localStorage/DB) · **L3** søk over navn+kode, treff auto-utbrettes, tomt søk → kollaps-tilstand. **🔴 Gate-funn løst (målt):** `hentStandarder` selecter IKKE `malInnhold`; eager-lasting = O(alle felt i hele arkivet) per dialog-åpning → ny **lazy** `bibliotek.hentMalInnhold` henter felt for ÉN mal, kalt først når previewen åpnes. **Ingen delt komponent** (fabel-vedtak 05.09) — BL gjenbruker spesifikasjonen. web build + mobil typecheck + lint (0 errors) + shared 636 grønt, i18n 13-generert. Ingen migrering. **Ingen prod/test-deploy ennå. DoD ÅPEN:** skjermbilder til fabel-gate med seedet arkiv >20 maler (kollapset start, søk, inspiser, lån) + klikk-tall — venter Kenneths test-deploy + >20-seed. |
| **Malarkiv AM4 (bolk 2 UI)** | `SiteDoc-kontrollplan` | `feat/firma-malarkiv-ui` | `apps/api/src/routes/firmamal.ts` (+3 ruter) + `mal.ts` (include) + `modul.ts` (steg 5-seeding) · `apps/web/.../firma/malarkiv/page.tsx` (ny) + `MalBygger.tsx` + `MalListe.tsx` + `firma-nav.tsx` + `firma/layout.tsx` · i18n (57 nøkler × 15) · `docs/claude/migrering-reporttemplate.md` | 2026-09-04 | 🟢 **Bolk 2 committet (fra develop `ca83c9a2`).** Steg 2 (arkivsiden, amber `/dashbord/firma/malarkiv` — rute-avvik fra `/oppsett/firma/*` gatet av Kenneth: den ga prosjekt-sone) + steg 3 (promoter + badges + L6 «Oppdater» i MalBygger) + steg 4 (ny-mal «Fra firmaarkivet» + L2-badges i MalListe) + steg 5 (firmamal-seeding i `modul.aktiver`, additivt, syv inventar-linjer bevart, ingen åttende funksjon). Nye ruter: `kanPromotere`/`listeForProsjekt`/`oppdaterKopiFraHovedmal`. API-typecheck + web build + 189 web-tester + i18n 13-generert grønt. **🔴 L2-nyanse til fabel-gate:** «Erstatter standardmal»-badge er BEREGNET ved visning (ikke lagret). **L8 (full firma-modus i MalBygger) = egen branch `feat/malbygger-firmamodus` etter dette** (Kenneth-vedtak, egen gate). Ingen migrering i denne branchen. Ingen prod/test-deploy ennå. **Venter test-deploy for E2E + skjermbilder til fabel-gate.** |
| **Malarkiv AM4 (bolk 1)** | `SiteDoc-kontrollplan` | `feat/firma-malarkiv` | `packages/db/prisma/schema.prisma` + migrering `20260904120000_malarkiv_hms_kolonner` · `apps/api/src/routes/firmamal.ts` (ny) + `trpc/router.ts` · `docs/claude/migrering-reporttemplate.md` | 2026-09-04 | 🟢 **Bolk 1 committet (fra develop `171995ef`).** Additiv migrering (5 kolonner: `organization_templates.subdomain`/`hms_synlighet`/`standard_for_nye_prosjekter`/`laant_fra_bibliotek_mal_id` (B4, FK SetNull→BibliotekMal) + `report_templates.versjon_av_hovedmal`; kun ADD COLUMN, to-stegs-policy) + `firmamal.*` tRPC-ruter (`list`/`hent`/`opprett`/`oppdater`/`slett`/`promoter`/`kopierTilProsjekt`/`laanFraSentralarkiv`). L5 avstamning via `organizationTemplateId`+`versjonAvHovedmal`; slett→SetNull via schema-FK; firma-admin-gate (L7) på skriv/promoter/lån, prosjektadmin-gate på henting; L9 fane-filter; `config.zone` verbatim i begge kopiretninger. **B4 (Kenneth 04.09): `laanFraSentralarkiv` setter strukturert peker `laantFraBibliotekMalId`, ikke fritekst i description** — avviket fra første rapport lukket i bolk 1 (skjemaet ferdig ⇒ bolk 2 = ren UI). API-typecheck + `@sitedoc/web` build + rot-testsuite (189 web) grønt. Ingen prod, ingen test-deploy ennå. **Bolk 2 (UI, steg 2-5) = egen branch etter test-gate.** |
| **Mobil arkiv-PDF (Fase 1)** | `SiteDoc-mobil-device` | `feat/mobil-arkiv-pdf` | `apps/mobile/app/sjekkliste/[id].tsx` · `packages/shared/src/i18n/*.json` (2 nøkler × 15) · `docs/claude/dokumentgenerering-plan.md` (felt.ts-presisering) | 2026-08-18 | 🟢 **Fase 1 committet — additivt.** Mobil kaller nå `trpc.arkiv.rendr` (server-generert arkiv-PDF, samme motor som web) som **primær** vei: base64 → `cacheDirectory` via `expo-file-system/legacy` → deles med eksisterende `expo-sharing`. Mangel-kontrakt speiler web (`renderTimeout`→«prøv igjen», `manglendeVedlegg`→«N mangler», `komplett`→stille; inline, ingen toast). Offline (`useNettverk`) → «PDF krever tilkobling», mutasjon fyres ikke. Header: primær `Share2`=arkiv + fallback-pill «Lokal» (`Printer`-ikon) = urørt `expo-print`-vei. **`expo-print`-koden røres ikke** (Fase 3, egen gate). **Måling meldt:** `felt.ts` kan IKKE avfryses selv etter Fase 3 (`renderFelt` lever i `arkivmal/innhold.ts` = server-arkiv); det er `byggSjekklisteHtml`-grenen i `sjekkliste.ts` som dør. Én PDF-vei i mobil (kun sjekkliste). Auth = Bearer på tRPC-klienten (bekreftet mot `context.ts`). typecheck mobil grønt, i18n +2×15. **⏳ Venter enhets-verifisering i Fase 2 (EAS-bygg, batches — ikke fyrt).** Ingen migrering. Ingen prod. |
| **App-felt (vær + bildeNr)** | `SiteDoc-mobil-device` | `feat/app-vaer-bildenr` | Sak B: `FeltDokumentasjon.tsx` (web+mobil) · 4 skjema-hooks · `shared/utils/bildeNr.ts`. Sak A: `useAutoVaer.ts` (web+mobil) · mobil-prefyll (2 hooks) · `VaerObjekt.tsx` (mobil) · `providers/VaerKoProvider.tsx` (ny) · `lib/trpc.ts` (vanilla) · `shared/utils/vaer.ts` | 2026-08-16 | 🟢 **Sak B committet** (`ead0179b`, pushet). 🟢 **Sak A committet:** målrettet prefyll-fjerning (kun vær-anker; prod: 1 væranker i Befaringsrapport-malen, 22 datofelter urørt), umiddelbar henting ved satt/endret tidspunkt (time nærmest klokkeslett, delt `byggVaerSnapshot`), offline vær-kø (`VaerKoProvider` — «venter»-markør på feltet ER køen; reconnect-sweep henter for LAGRET tidspunkt via archive-API + vanilla-tRPC), tre UI-tilstander. No-op verifisert (`likForDiff`, `sjekkliste.ts:676`). typecheck web+mobil+shared + 475 shared-tester grønt. 🟢 **(d) PDF-resolve ved finalisering committet (isolert):** ved terminal-transisjon (`endreStatus`, sjekkliste+oppgave) løses «venter»-vær-felt server-side for det LAGREDE tidspunktet (archive-vær) og persisteres i `data` — merkes `hentetIEttertid`; feilet henting → `status:"ikke_registrert"` permanent (`services/vaer-finalisering.ts`, 7 tester). Guard i `oppdaterData` (begge): finalisert dokument dropper vær-felt-skriving stille → vær-køen kan aldri overskrive frosset snapshot. `felt.ts` fallback «Ingen værdata»→«Ikke registrert». Server-side vær-henting ekstrahert til `services/vaer.ts`. typecheck+lint+vitest grønt. 🟢 **Simulator-verifisering BESTÅTT (2026-08-16, iOS-sim mot api-test, orakel via dev-login):** (1) online snapshot for satt tidspunkt — befaringstidspunkt 14.08 kl 20:44 → Vær = 12 °C/overskyet/0.76 m/s/7.9 mm = eksakt archive-fasit for 14.08 kl 20, IKKE i dag (16.08: 14.2 °C/0 mm); (2) `VaerKoProvider`-sweepen — plantet «venter»-markør (lagret tidspunkt 15.08 kl 14) resolvet på ~8 s til 15.4 °C/Lett yr/1.41 m/s/8.1 mm = eksakt fasit for 15.08 kl 14, synket til SQLite + server. Begge resolve-veier hentet for LAGRET tidspunkt, ikke tilkoblingstidspunkt. **⚠️ Forbehold:** simulatoren kan ikke gjøres NetInfo-offline (deler Mac-nettet), så `useAutoVaer` sin offline-**skrivegren** ble ikke trigget av ekte offline — «venter»-markøren ble **plantet** for å kjøre sweepen. Begge resolve-veier er dermed enhet-verifisert; residualet er selve markør-skrivingen (dekket av logikk + at sweepen konsumerte nøyaktig markør-formen). Faithful ekte-offline-test krever ekte enhet i flymodus. **Fil-overlapp med «S1 Fase 1b» på web `FeltDokumentasjon.tsx`.** Ingen migrering. **Ingen prod.** |
| **Modul-onboarding (seed-policy)** | `SiteDoc-mobil-device` | `feat/seed-dispatch-settfirmamodul` (steg 3+4) | `apps/api/src/services/seed/index.ts` · `apps/api/src/routes/organisasjon.ts` · `apps/api/src/routes/timer/onboarding.ts` | 2026-08-11 | 🟢 **Steg 1 (`921a221e`) + steg 2 (`2fde8565`) MERGET develop + test-verifisert**; backfill kjørt prod (1 rad: A.Markussen-lonnsart). **Steg 3+4 (generisk seed-dispatch) diff-klar** (ORDRE blokk 24/25): ny `seedFirmamodulKatalog(slug, org)` kalles fra `settFirmamodul` ETTER kjerne-tx commit (kryss-DB → kan ikke være i tx-en). Per-datatype `try/catch` → `feil[]` (én feilende datatype blokkerer ikke resten); logges tydelig med org+datatype, aldri svelget. `aktiverNivaa1` = tynn inngang (base via dispatch + Nivå 2 kun ved `inkluderNivaa2`); `seedTimerForOrganization` retiret. `aktiverTomKatalog` uendret (kun interne prosjekter, ingen katalog). **maskin + varelager: ingen hook** — begge dokumentert i dispatch-koden (maskin=enums; varelager=firma-definert uten universell default, steg-4b Beslutning 8). 4 nye unit-tester (feil-isolasjon + no-op-moduler). Api-only, ingen migrering, ingen prod. **Steg 5** (onboarding.status 3-verdi + `mangler`-rapportering) egen gate. **Navngitt oppfølger:** `aktiverTomKatalog` bør selv skrive `egen_katalog`-policy-rader; datatype `varekategori` reservert for evt. framtidig varelager-hook. |
| **Firmarolle-konsolidering** | `SiteDoc-mobil-device` | `fase2-firmarolle-enkilde` | `apps/web/src/kontekst/firma-kontekst.tsx` + 7 lesebaner | 2026-08-10 | 🟢 **Fase 1 MERGET develop (`97f55fd5`).** **Fase 2 (én lesekilde) fabel-designgodkjent** (`FABEL-GODKJENNING-fase2-firmarolle.md`) — 8 kode-lesninger → `kanAdministrereFirma`, `erCompanyAdmin` fjernet, `BrukereFane` leser `firmaRoller` direkte. DoD browser-verifisert: Mathias (user + firma_admin) firma-lenke synlig i BEGGE nav. Kode-divergens lukket; data-divergens består (vakten = tripwire). **Venter Kenneths merge.** **Fase 3** (skrivebaner + `admin.ts:455` + avvikling `company_admin` fra `users.role`): **venter stabilitet i prod + migreringsgate hos Kenneth — ikke åpnet.** **Navngitt oppfølger (egen sak):** multi-firma firma-admin — `valgtFirma` settes ikke ved >1 medlemskap (`firma-kontekst.tsx:83-87`) ⇒ all firma-gating dør; krever firma-velger m/lagret valg + `hentBrukersOrg`-primærorg. |
| **Lagringsstatistikk** | `SiteDoc-utlegg` | `feat/lagringsstatistikk` | `packages/shared/.../lagring.ts` (+test) · `apps/api/src/routes/lagring.ts` + `trpc/router.ts` · web `admin/lagring/page.tsx` (+layout-nav) + `firma/fakturering/page.tsx` · i18n · `docs/{api.md}` | 2026-08-11 | 🟢 **Kodet, diff-klar (fra develop).** `lagring.oversikt` (sitedoc-admin: per firma×prosjekt×modell + standalone + foreldreløse) + `lagring.firmaOversikt` (firma-admin, per prosjekt). Aggregering on-demand, cache 1t, ren `aggregerLagring` i shared. **Akse = `primaryOrganizationId` (eierskap)**, divergerer bevisst fra admin.ts/grense. **Foreldreløse bilder (24 % prod) = egen post, aldri fakturerbar; fakturerbart ≠ faktisk diskbruk.** **Dekningsgrad-restpost:** filer uten målt størrelse (`file_size NULL`) per modell, vist når >0 (fakturering krever 100 % dekning). 🔴 **`drawings.file_size` IKKE strammet** — skrivestien lager DWG-layouts uten fileSize (`tegning.ts:187,539`); NOT NULL ville gitt 500. Ingen migrering. shared 455 + api/web tsc + api-lint grønt, i18n-paritet 3457/3457. **Ingen prod.** |
| **Deaktiver-mønster** | `SiteDoc-utlegg` | `feat/deaktiver-monster` | `apps/web/src/components/deaktiver/*` (3 nye) · `expenseCategory.ts` (deaktiver/aktiver) · 4 timer-flater · i18n · `retningslinjer/deaktiver-monster.md` | 2026-08-12 | 🟢 **Kodet, diff-klar (fra develop).** Delte `DeaktiverKnapp`/`VisInaktiveToggle`/`InaktivBadge`; `Power`-ikon overalt, `title=`→`Tooltip` (konsekvenstekst «skjules for nye reg., eksisterende beholder den»), «Vis inaktive (N)», hjelpetekst. Ny `expenseCategory.deaktiver`/`aktiver` (integritet verifisert: `ordningVedFoering` NOT NULL, ingen mellomtilstand). 4 timer-flater hevet. api/web tsc + lint grønt, i18n-paritet 3454/3454. Ingen migrering. **Ingen prod.** |
| **E2E-opprydding** | `SiteDoc-utlegg` | `feat/e2e-opprydding` | `apps/api/src/routes/admin.ts` (`sweepE2EFirmaer`) · `tests/e2e/global-setup.ts` · `apps/api/scripts/roykt-grense.ts` · `tests/e2e/README.md` · `api.md` | 2026-08-12 | 🟢 **Kodet, diff-klar (fra develop).** `admin.sweepE2EFirmaer` (sitedoc_admin + **env-guard `sitedoc_test`**, sletter `E2E%` eldre enn 24t uten prosjekter) kalt av `global-setup` ved oppstart. `roykt-grense` fikset (E2E-prefiks + slett org). **Funn:** playwright-suiten oppretter ingen org; org-søppelet var fra seed-live-bevis (ad-hoc). **🟡 Meldt til cowork:** «Testfirma AS (agent-test)» er et permanent fikstur uten E2E-prefiks — omdøpe (berører seed) eller la stå? Venter cowork-svar. api tsc + lint grønt. Ingen migrering. **Ingen prod.** |
| **Utlegg-ordningsmodell** | `SiteDoc-utlegg` | `feat/utlegg-ordningsmodell` | `packages/shared/src/utils/utleggOrdning.ts` · `apps/api/src/routes/timer/expenseCategory.ts` · `apps/web/.../timer/[id]/page.tsx` · `docs/claude/timer.md` | 2026-08-08 | 🟢 **U1 prod (`e37621e1`). U3 web MERGET develop + E2E GATET** (DB CHECK + API-guarder + 6 browser-bevis mot mockup). U2 utsatt. Neste: U4 mobil (bygg 45) |
| **Utlegg U5 — overstyring-UI** | `SiteDoc-utlegg` | `feat/utlegg-u5-overstyring` | `apps/api/.../timer/expenseCategory.ts` · `apps/web/.../firma/timer/utleggskategorier/page.tsx` · `oppsett/prosjektoppsett/page.tsx` · `timer/[id]/page.tsx` (sats-hint) · i18n | 2026-08-11 | 🟢 **Kodet, diff-klar (fra develop).** Firma-admin `settOrdning` + overstyring-CRUD; ny `firma/timer/utleggskategorier`-fane (ordning per kategori + prosjekt-overstyring + navnekollisjon-varsel + immutabilitets-mikrotekst); prosjektadmin read-only i prosjektoppsett; sats-hint-fiks. Ingen migrering. Build 2/2. **Browser-verifisering venter deploy til test.** Gjør U3 ferdig. **Ingen prod** |
| **Dataeksport (server-side dokumentgenerering)** | `SiteDoc-mobil-device` | `feat/eksport-fase2-filer-csv` (fase 2) | `apps/api/src/services/eksport/{arkiv,filer,csv,felles,eksport-worker}.ts` · `routes/eksport.ts` | 2026-08-11 | 🟢 **Fase 1 (infrastruktur) diff-klar** (blokk 28) — `EksportJobb`-tabell + migrering `20260811160000` + poll-worker + stream-zip + `verifiserKanEksportere`. **Fase 2 (filer + manifest-innhold + CSV) diff-klar** (blokk 28/29): `samleProsjektFiler` henter alle filer for prosjektet (bilder via Checklist/Task→ReportTemplate, tegninger + originaler + revisjoner, FtdDocument, utleggs-/tilleggsvedlegg fra timer-db) → strømmes fra disk til zip m/ dedup; manglende disk-fil markeres i manifest (feller ikke). `byggTimerCsv`/`byggUtleggCsv` = rådata-CSV (`;`, UTF-8 BOM, norsk komma). Manifest binder hver fil til domeneobjektet + `avgrensninger[]`. PointCloud + PDF-dokumenter bevisst utelatt (fase 3). Nedlastings-URL bumpet 10→60 min (Range-requests re-valideres per chunk). **Activity-logging** på `bestill` + `hentNedlastingsUrl` (sistnevnte nå mutation — revisjonspliktig utstedelse) m/ ip/userAgent (plumbet gjennom delt context-stamme, TS-tvunget på api+web+test-harness). 10 unit-tester. Live-smoke: kjerne-DB-veien OK (lokal sandbox mangler timer-tabeller → full end-to-end = Kenneths test-verifisering). **Migrering (fase 1) gates av Kenneth.** **Fase 3** (PDF-renderer, egen container) venter fabels mal-mockup + at fase 1+2 er levert/verifisert. **Ingen prod.** |
| **Utlegg modelljustering** | `SiteDoc-utlegg` | `feat/utlegg-ordning-justering` | `packages/shared/.../utleggOrdning.ts` (+test) · db-timer schema + migrering `20260811130000` · `apps/api/.../expenseCategory.ts` (+`.test.ts`) + `dagsseddel.ts` · web `utleggskategorier/page.tsx` + `timer/[id]/page.tsx` · mobil `UtleggSeksjon.tsx` + `timerSync.ts` + `schema.ts` · i18n · `docs/claude/timer.md` | 2026-08-11 | 🟢 **Kodet, diff-klar (fra develop).** Gate 1: **`sats`→`lonnstillegg`** (homonym-fiks, enum+3 CHECK+delt utledning+UI+i18n) · **`fakturert` ut av valgbare** (enum beholdt for historikk, `SETTBAR_ORDNING_ENUM={utlegg,lonnstillegg}`) · nye `satsbasert`+`muligSkattepliktig` på ExpenseCategory (firma-admin-toggle) · **U5 upsert-test** (samme id, aldri delete+create; fakturert avvist). Migrering: data-rename + 3 CHECK-recreate + 2 kolonner. shared 441 + api/web/mobil tsc + api-lint + 3 upsert-tester grønt, i18n-paritet 3446/3446. **🔴 Migrering gates av Kenneth. U4→prod blokkert til dette er inne.** Gate 2 (`refusjonsKontonummer` på kjerne-`OrganizationSetting`) etter. **Ingen prod** |
| **Utlegg U4 — mobil** | `SiteDoc-utlegg` | `feat/utlegg-u4-mobil` | `apps/api/.../timer/expenseCategory.ts` (`katalogForMobil`) + `dagsseddel.ts` (`syncBatch`/`hentEndringerSiden` utlegg) · `apps/mobile/src/components/timer-detalj/UtleggSeksjon.tsx` (ny) · mobil db/schema+migreringer · `timerKatalog.ts` · `timerSync.ts` · `OpplastingsKoProvider.tsx` · `bildeRegistrering.ts` · `app/timer/[id].tsx` · i18n · `docs/claude/timer.md` | 2026-08-11 | 🟢 **Kodet, diff-klar (fra develop).** Utlegg på mobil (mockup 8c), offline-først, speiler tillegg 1:1. **Ordning utledet aldri valgt; klient stempler `ordningVedFoering`+`foertVed` ved FØRING, server re-utleder ALDRI ved sync** (motsatt av web-stien — bevisst). `createdAt`=klient-`foertVed` (reviderbart; tillegg-hullet ikke kopiert → oppfølger). Kamera-primær, beløp før bilde, Lagre gated på kvittering, ≥44 px. Offline-cache via `katalogForMobil` (5. pull, kaster før sletting). api+mobil tsc + lint grønt, i18n-paritet OK. **Reload: ny build (mobil-JS).** **Simulator-verifisering + koordinering med mobil-device-sporet før merge. Ingen prod** |
| **S1 Fase 1b — bilde-signering** | `SiteDoc-mobil-device` | `feat/s1-fase1b-bilde-signering` (steg 1) | `apps/api/src/utils/vedleggSignering.ts` (+test) · `routes/{bilde,hms,sjekkliste,oppgave}.ts` | 2026-08-12 | 🟢 **Steg 1 (signeringsinfra) diff-klar** — prod-tall inne (union 39 filer, 1 foreldreløs, 10 kun-images, 28 i begge). Ny delt rekursiv `signerVedleggIData`/`signerBilder`/`signerDataRad(er)` signerer bilde-URL ved EMISJON (aldri persistert → `slettMedUrl`s eksakt-match består). Påført display-emisjonene: `bilde.hentForProsjekt` (galleri) + `sjekkliste/oppgave.hentForProsjekt`+`hentMedId` (data+images) + `hms.hentForProsjekt`/`hentFirmaOversikt` + `oppdaterData`. `slettMedUrl` normaliserer query bort (`normaliserFilSti`). 6 unit-tester (rekursjon repeater+attachments, ingen mutasjon). **Nyanse rapportert:** post-migrering finnes ingen åpne URL-er → usignert emisjon = brutt visning (401), ikke lekkasje; status-transisjons-returer (ikke gjengivelses-veier, klient refetcher) venter cowork-avklaring. Incidental: pre-eksisterende ubrukt `erAdmin`→`_erAdmin`. **Steg 2 (opplasting→privat) diff-klar** (branch `feat/s1-fase1b-opplasting-privat`, på steg 1): web felt-vedlegg (`FeltDokumentasjon`+`TegningsModal`) → `?privat=1` (umiddelbar); mobil-kø utvidet til bilder (sjekkliste/oppgave, nytt EAS-bygg); `bilde.opprett*` myk validering (advarsel ved åpen sti, aksepterer begge — server kan ikke skille klientversjon). To-stegs: hard validering (steg 4) etter EAS-adopsjon, TODO i kode. **Steg 3** (migrering, gated — disk-script beskrives+gates før bygging) → **4** (hard validering). **Ingen prod.** |
| **Mal-integritet** | `SiteDoc-utlegg` | `feat/mal-integritet` | `packages/db/prisma/schema.prisma` + migrering `20260810120000` · `apps/api/.../mal.ts` + `bibliotek.ts` · `apps/web/.../MalListe.tsx` · i18n | 2026-08-11 | 🟢 **Kodet, diff-klar (fra develop).** SLETT-VERN: `slettMal`/`slettObjekt` teller dokumenter (aktive+papirkurv) → nekt m/ lesbar melding; `Task.template` SetNull→**Restrict** (DB-backstop). UNIKHET: funksjonelle unik-indekser `(projectId, lower(btrim(navn/prefiks)))`, prefiks partiell eks-PSI; app-validering `opprett`/`oppdaterMal` + auto-ledig i `kopier`/`importerMal`. Build 2/2. **🔴 Migrering FEILER ved dubletter — rydd DB først** (skann: `~/mal-dubletter-skann.sql`; prod REN, test ryddes av Kenneth). Oppfølgere under. **Ingen prod — Kenneth kjører** |
| **Seed manglende firmakatalog** | `SiteDoc-utlegg` | `feat/seed-manglende-katalog` (`966ed8db`) | `apps/api/src/services/seed/index.ts` · `apps/api/src/routes/admin.ts` · `seedManglende.test.ts` · `docs/claude/timer.md` | 2026-08-10 | 🟢 **MERGET develop. Live-bevis grønt på test (begge varianter).** `admin.seedManglendeFirmakatalog` (sitedoc_admin) — idempotent, **kun `expenseCategories`**. Import-org: `egendefinert=3` uendret før/etter seed (importerte lønnsarter urørt). Enhets-testet + live 0→5/re-kjør=hoppet. Ingen migrering. **⏳ Venter prod:** etter develop→prod-deploy, seed A.Markussen (`4488fe17-…`) → `{opprettet:5, hoppet:false}`, lønnsart står på 44. Oppfølgere: **tre-tilstands-guarder** (aldri onboardet→seed / onboardet→hopp / bevisst egen katalog→hopp+ikke ufullstendig — føring Kenneth 2026-08-10, A.Markussen `seed_nivaa=1`=0 er ØNSKET; `onboarding.status` overrapporterer ufullstendig; se timer.md § Onboarding) + settFirmamodul-wiring; prosjektmodul-variant (998/RUH) |
| **Firmarolle Fase 2** | `SiteDoc-mobil-device` | `fase1-firmarolle-vakt` → Fase 2 | `firma-kontekst.tsx` · `Toppbar.tsx` · `BrukereFane.tsx` · `kompetanse` | 2026-08-10 | 🔵 **Fase 1 (vakt) i prod.** Fase 2 = én lesekilde (`kanAdministrereFirma`), 8 kode-lesninger. Fabel-godkjent ordre v2. Fase 3 (migrering) IKKE hastet |
| **Mal-integritet** | `SiteDoc-utlegg` | *(ny branch)* | `mal.ts` · `schema.prisma` | 2026-08-10 | 🔴 **Slett-vern først:** `slettMal` teller ikke dokumenter; `Task.templateId` nullable ⇒ `SetNull` ⇒ foreldreløse oppgaver (0 i prod nå). Så: unikt prefiks+navn per prosjekt (Kenneth-vedtak) |
> **Kjent test-residue (`sitedoc_test`, 2026-08-10) — BEVISST, ikke søppel:** seks navngitte «E2E …»-orger fra seed-live-beviset står igjen (ingen org-slett-prosedyre finnes). Tre er «E2E Tom» (variant 1): `30d46d3d`, `16af5ab1`, `d96d4934`. Tre er «E2E Import» (variant 2, **har importerte lønnsarter uten `seedNivaa`** — nyttig fikstur for framtidig seed-testing): `8c66cd2e`, `2bef5939`, `9301e0e6`. cowork: la dem stå.

**Tavla er tom for aktive kode-økter** (2026-07-24) — hele flyt-sporet + A-3b er merget til develop. `SiteDoc-a3b`-treet kan ryddes (branch merget). Fabel-design + backlog-saker (Tooltip v2, `ListeKontroll`, mobil-wiring, flyt-handlingstekster) er ikke aktive økter.

| **Registrator-fiks** | *(økt kan exit)* | `fix/registrator-rettigheter` | `flytRolle.ts` · `statusHandlinger.ts` · `tilgangskontroll.ts` · `DokumentHandlingsmeny` | 2026-07-21 | **✅ MERGET develop (`cb3ce3d1`).** Fase A+B — registrator ikke lenger superbruker. ⚠️ Åpen rest: `rejected→sent` → handlingsmeny-arbeidet ([registrator-rolleforveksling.md](delplaner/registrator-rolleforveksling.md)) |
| **K1+K2 kontekst** | *(lukket)* | `fix/k1k2-kontekst` (`f28aecfd`) | — | 2026-07-21 | **✅ MERGET (`31c831a8`) + på test.** Lukket |
| **K3 + P1 kontekstvelger** | *(deployet prod)* | `feat/k3-kontekstvelger` (`c34b3859`) | — | 2026-07-23 | **✅ DEPLOYET TIL PROD (develop→main 2026-07-23).** Hele K3-sporet live: trakt + to-linjers topplinje + sidehode + ⇄ + timer-hjem + maskin-kontekst + polish. Arkivert → [historikk-2026-07.md](historikk-2026-07.md). P1 subsumert |

> ✅ **Avgjort (fabel 2026-07-21, alternativ c): A-3b HOLDES til registrator-fiksen har landet.**
>
> **Premisset:** perspektivmatrisens REGISTRATOR-kolonne (`utledPerspektiv` — registrator dominerer ballinnehav) bygger på **dagens** semantikk, der registrator er superbruker. Etter [registrator-fiksen](delplaner/registrator-fiks-ordre.md) er registrator en *deltaker med leserett*.
>
> **Hvorfor (c) og ikke (a)/(b):** (a) ville revidert matrisen mot en semantikk som ikke finnes i kode ennå — brudd på fakta-først. (b) ville deployet en etikett-modell vi **vet** skal endres, til alle pilotbrukere — to deploys og forvirring for null gevinst.
>
> **To føringer:**
> 1. Når registrator-fiksen er landet og verifisert, leverer utførende Opus **oppdatert perspektivmatrise som nå-rapport** (REGISTRATOR-kolonnen mot ny semantikk). **Fabel gater den FØR 1c-wiring starter.** Perspektivet består — «oppretter-som-venter» er et reelt syn — det er **etikettene** som måles på nytt.
> 2. **Del 1a+1b merges ikke til develop** i mellomtiden. Ingen perspektiv-etiketter ut til brukere før matrisen er gatet.
>
> ⚠️ **Presisering:** Del 1a+1b **er pushet** til `feat/a3b-perspektiv` (`535f8d8a`) — det er riktig og trygt, en feature-branch når ingen brukere. Det som holdes tilbake er **mergen til develop**. Arbeidet skal ikke un-pushes.

### 🟢 Flytmatrise-fundament — B-sporet (rettighetsmatrise som config)

Fundamentet under A-3b: statusmaskin (A-laget) + config-substrat (B) før perspektiv-visningen bygges oppå. Kilde: [rettighetsmatrise-config-design.md](delplaner/rettighetsmatrise-config-design.md) + [flytmodell-overgangsmatrise.md § FUNDAMENT-GAP](delplaner/flytmodell-overgangsmatrise.md).

| Kloss | Status | Merge |
|---|---|---|
| **A-laget** — statusmaskin (`rejected→sent` + `closed→draft` inert + i18n) | ✅ MERGET develop | `7571e968` |
| **B Kloss 1** — config-plumbing (`FlytRettighetOverride`/`Logg` + `ROLLE_HANDLINGER_DEFAULTS` + `celleTillatt` override-only-snitt + loader). **Bit-identisk.** | ✅ MERGET develop | `33c32f1f` |
| **B Kloss 2** — adminNiva (**kun sitedoc+prosjekt**, firma-admin droppet — Kenneth-vedtak) + PROSJ.ADMIN-kolonne + matrise-UI (`dashbord/firma/flyt-rettigheter`, sitedoc-gatet) + logg-skriving | ✅ MERGET develop (PR #3) | `a3e2cc66` |
| **B Kloss 2b** — firma-innstilling `autoProsjektAdmin` (medlemskap, ikke flyt-nivå — Kenneth-vedtak) + migrering `20260724120000`. Løser firma-admin ⊇ prosjektadmin via auto-medlemskap ved nye prosjekter | ✅ MERGET develop | `cca3f471` |
| **B Kloss 2c** — matrisen til Admin-flaten (§ 1c) + cellespec-kontrast (§ 2) + i18n × 14 | ✅ MERGET develop | `4d563c89` |
| **B Kloss 2d** — global konfig: dropp `orgId` fra `FlytRettighetOverride`/`Logg` + loader/tRPC/2c-UI (Kenneth-vedtak: én global konfig, ikke per-firma) + migrering `20260724130000` (TRUNCATE + drop orgId) | ✅ MERGET develop | `42b77e0c` |
| **B Kloss 3** — endringslogg-fane + les/rediger-fane (levert som ren visning i Kloss 2 — i praksis dekket) | 🟢 dekket av Kloss 2 | — |
| **A-3b perspektiv-visning** (oppå ferdig fundament) | 🟡 PAUSET — fundament nå komplett, kan gjenopptas | — |

**Ett-klikks-prosjektoppsett-visjonen** (firma-mal per kontorsted/avdeling) er ført i [BACKLOG](BACKLOG.md) — Kloss 2b er første konkrete skive (samme `prosjekt.opprett`-hook + `OrganizationSetting`).

🔴 **Migrerings-avhengighet (Kloss 1+2+2b+2d):** neste test-deploy av develop MÅ kjøre `migrate deploy` mot `sitedoc_test` for alle ventende: (1) `20260723120000_flyt_rettighetsmatrise_config` (opprettet tabellene — alt applied på test). (2) `20260724120000_organization_setting_auto_prosjekt_admin` (`ADD COLUMN auto_prosjekt_admin` — alt applied). (3) `20260724130000_flytmatrise_global_dropp_orgid` — **TRUNCATE begge config-tabellene + dropp `org_id` + ny global unik `(rolle, fra_status, til_status)`.** Idempotent (`IF EXISTS`-guards). ⚠️ TRUNCATE avviker fra to-stegs-policyen — begrunnet (kastbar config, aldri prod); **Kenneth bekrefter tilnærmingen ved `migrate deploy`.** Uten (3) er tRPC/loader/UI orgId-frie mens DB fortsatt har `org_id` NOT NULL → `settRettighet` feiler.

🔵 **Pilot-synlig endring ved neste deploy (Kloss 2):** firma-admin ser ikke lenger admin-handlinger i flyt-menyen (web+mobil). **Ikke kapabilitetstap** — serveren (`verifiserFlytRolle`) avviste dem uansett med «Ikke medlem av prosjektet»; menyen viste et fantom. Føres i pilot-endringsloggen når Kloss 2 deployes.

**Lukket 2026-07-24 (flyt-binding + dedikert HMS-løp, seks merger):** **F1 flyt-binding ved opprettelse** (B1–B4, `a98269ed`) + registrator-innstramming B2b + admin-bypass fjernet (`a7924c59`) — et dokument tilhører alltid nøyaktig én flyt (`dokumentflytId` påkrevd på server i standard-grenen), og **kun registrator-medlem** kan opprette (ingen admin-unntak; admin legger seg selv i flyten). HMS-grenen er flyt-løs by design (vedtak A, Guard 1 avviser innsendt flyt). **Sjekkliste-visning:** dokumentflyt-navn-kolonne + person/faggruppe-ikon i Ansvarlig (`39c6897c`). **CI:** K13 onboarding-redirect unntatt + `docs/**`-paths-filter så rene docs-pushes ikke trigger `test` (`687c71e2`). **Dedikert HMS-svar-løp** (Kenneths «eget dyr»-modell, adskilt fra dokumentflyt/rolle-matrisen): server-Ordre A — egen maskin `sent→responded→closed` + `verifiserHmsHandling` + `erHmsAdmin` (delt kilde m/ `byggHmsSynlighetsFilter`) + fire mutasjoner (`hmsBesvar`/`hmsLukk`/`hmsGjenapne`/`hmsTilfoyInformasjon`) + e-postvarsling (`ad9d2e0c`); web-Ordre B — `HmsHandlingsflate` + `hms.erHmsAdmin`-query + tidslinje-append (`85bc4349`); malbygger-Ordre C — HMS egen malbygger-type (`category="hms"` = malbygger-organisering, `domain="hms"` = runtime; dedikert `hmsmaler`-side + «Meld HMS»-inngang + migrering `20260724140000_hms_category`, `07113b89`); **task-Ordre D** — utvidet HMS-løpet til tasks (RUH/avvik var `category="oppgave"` og kjørte generell statusmaskin; nå opprett=send + de fire HMS-mutasjonene på task-tabellen + `HmsHandlingsflate` på oppgave-detaljsiden, speiler A/B, `50f0a232`). Design: [flyt-binding-design](delplaner/flyt-binding-design-2026-07-24.md) · [hms-dedikert-lop-design](delplaner/hms-dedikert-lop-design-2026-07-24.md) · [flyt-rolle-verifisering](delplaner/flyt-rolle-verifisering-2026-07-24.md). **HMS-løpet er komplett (A+B+C+D) — dekker både checklist (SJA) og task (RUH/avvik).** Klikktest 2026-07-24 avdekket task-gapet (kun checklist var dekket) → Ordre D lukket det. **Gjenstår:** klikktest RUH + HMS-avvik (task) ende-til-ende i Chrome-Opus · HMS-vedlegg til «Tilføy informasjon» (backlog, krever server-endring) · `migrate deploy` ved neste test/prod-deploy (kø: flytmatrise-migreringer + `20260724140000_hms_category`). **Data-hygiene:** prod-maltagging ren (audit 2026-07-24: SJA/RUH/HMS-avvik alle `domain="hms"`); test har én feiltagget «Sikkerhetsinstruks» (PSI, `subdomain="avvik"`) — test-only, ikke prod. F1 (a)–(d) verifisert på test 2026-07-24 (alle positive).

**Ordre E — HMS-oppgave polish (branch `feat/hms-oppgave-polish`, ikke merget):** to bugs fra klikktest 2026-07-24, gatet mot kode. (1) **RUH-ruting** — RUH-radklikk gikk til `/sjekklister/${id}`, men RUH er en task (`category="oppgave"`) → rettet til `/oppgaver/${id}` (`hms/page.tsx`). (2) **`[object Object]` i RUH-kolonnene «Type observasjon» + «Innmelder»** — rot: felt-verdier lagres nestet som `{ verdi, kommentar, vedlegg }` (jf. skjema-hooks + endringslogg `oppgave.oppdaterData`), men `hentDataVerdi` (`components/hms/visning.tsx`) rendret wrapper-objektet direkte. Fikset ved å pakke ut `.verdi` + speile `hentFeltVerdi`-mønsteret (type-aware person/firma/liste + `navneLookup` bruker-ID→navn, bygget fra `medlem.hentForProsjekt` og sendt inn i `RuhTabell`). Bonus: samme rot-fiks fjerner latent `[object Object]` i SJA-/avvik-datakolonner (samme delte funksjon). Web typecheck + test grønt (43/43). **Verifisert i Chrome-Opus 2026-07-25** — begge PASS (RUH-lista lesbar tekst, radklikk → `/oppgaver/`). **Hele HMS-sporet (flyt A–D + polish E) er ferdig og ende-til-ende-verifisert på test** — checklist (SJA) + task (RUH/avvik). **✅ DEPLOYET TIL PROD 2026-07-25** (main `661ba3c2`): F1 + HMS A–E + flytmatrise-fundament (Kloss 1–2d) + A-3b — sekvensielt bygg (ingen OOM, ingen kaskade), alle 4 migreringer anvendt mot `sitedoc` (`20260723120000`/`20260724120000`/`20260724130000` TRUNCATE+dropp-orgid/`20260724140000` HMS-kategori), alle containere Up, verifisert innlogget (sitedoc.no kjører). Backup: `~/backup/sitedoc-predeploy.dump`. **Arkiveringsplikt:** hele denne bunten flyttes til [historikk-2026-07.md](historikk-2026-07.md) ved neste doc-rens.

**Lukket 2026-07-20/21 (seks økter):** N3-fiks synlighet (`fix/n3-flytmedlem-synlighet`) · kode-Opus sak 1 (`fd573b61`) · kode-Opus spor 2 + sak 2 (`cf76d81d`, `ecedb7eb`) · mobil-Opus TegningsCapture (`b15dfe56`) · CI-Opus spor 1 (PR #1+#2) · web-Opus testrunder (sak 1 + sak 2, testplaner merket KJØRT). Alle merget til develop; tilgangslaget deployet prod.

> ⚠️ **Tavla var tom for alle seks mens de kjørte.** Rader ble aldri skrevet, og Kenneth måtte avslutte to økter uten oppfølging. Rettet ved [SAMARBEIDSREGLER § Tavle-binding](SAMARBEIDSREGLER.md#tavle-binding--commit-gaten-vedtatt-2026-07-21): ordre ⇒ rad og merge ⇒ rad-fjerning skjer nå i samme commit.

**Del6b fase 1 lukket 2026-07-16** — fabel-designgodkjent, alle punkter. Merget `f9416424` (pkt 2/3/6) + `297f5670` (pkt 1/4/5). Levert: print-fella borte (`q0–q9` droppet stille 7 av 17) · døde søkebokser koblet · prioritet-rader klikkbare · 4 filter-paradigmer → 2 delte kilder, null regresjon · prosjekt-HMS-defaulten synlig som chips · 35 i18n-nøkler × 14 språk. Statuskilde: `verifisering/del6b-verifiseringslogg.md` (designprosjekt «Sitedoc redesign tips»). Exit-funn i [BACKLOG](BACKLOG.md).

**Doc-oppryddingen 2026-07-15/16 er lukket.** Syv økter, alle merget: statuskilde/lesbarhet-reglene (`8ae0a3ac`) · regel 11 + 11b (`d1c6b4c9`) · tre aktive doc-løgner (`be5307be`) · Type 1-rydding, 13 funn (`fc96fcee`) · negative påstander, F1/F3/F21/F22 (`eab9bb85`) · STATUS-changelog + STATUS-AKTUELT-oppbrudd. Auditens 23 funn: 20 lukket, F15 + F24 + F25 ført i [BACKLOG](BACKLOG.md).

⚠️ **Presedens verdt å beholde (2026-07-16):** to økter fikk samme branch-navn (`docs/status-aktuelt-oppbrudd`) — den ene slettet den mens den andre skulle bruke den; ren flaks at rekkefølgen reddet arbeidet. Og to økter fikk samme arbeidstre (`SiteDoc-oppfolgere`), så auditens tre flyttet seg under den mens den kjørte. Begge var coworks feil ved ordreskriving, og begge er nøyaktig det denne tavla finnes for.

---

**Ikke en ny sårbarhet — dette er S1 Fase 1b, planlagt men ikke bygget.** `server.ts` sier det selv: *«Non-privat `/uploads/*` er uendret i Fase 1 (global gate kommer i Fase 1b).»* Målingen viser at hullet fortsatt står åpent.

**Målt på prod 2026-08-12:**

| plassering | bilder | volum |
|---|---|---|
| `uploads/` (åpen, ingen gate) | **50** | **46 MB** |
| `uploads/privat/` (signatur-gatet) | 0 | 0 |

`curl` mot `https://api.sitedoc.no/uploads/<uuid>.jpg` uten innlogging → **200**.

**Årsak:** `privat=1` sendes kun fra timer-siden (utleggsbilag, `dashbord/timer/[id]/page.tsx:2314,2967`) og mobil `opplasting.ts`. `bilde.ts` — som lagrer alle sjekkliste- og oppgavebilder — laster opp uten flagget. Kvitteringer er altså beskyttet; byggeplassbilder er ikke.

**Alvorlighet, ærlig vurdert:** UUID-er er 128 bit og ikke gjettbare, så ingen kan bla gjennom bildene. Men enhver URL som lekker — e-post, skjermdump, serverlogg, nettleserhistorikk på delt PC — gir permanent uautentisert tilgang til et byggeplassbilde som kan inneholde personer, kjøretøy eller skader. Personvernrelevant.

**Ikke løst av kveldens signaturfiks.** Den lukket omgåelse av gaten på `uploads/privat/*`; dette handler om at bildene aldri legges bak den gaten.

**Retning (ikke besluttet):** enten sende `privat=1` fra `bilde.ts` og signere bildelenker som timer-flaten gjør, eller bygge Fase 1bs globale gate på hele `/uploads/*`. Første er mindre, men flytter ikke eksisterende 50 filer; andre er riktig sluttilstand. Krever beslutning + migrering av eksisterende filstier.

## Pågående arbeid (PR-historikk)

### 🔴 Åpne gater og restanser høstet ut av de arkiverte innslagene

Disse fulgte med innslagene over og ville forsvunnet i arkiveringen. Ingen av dem er kode
som venter på merge — alt er i prod. Det som står igjen er **gater ingen tok**, og
**arbeid som aldri ble startet**.

**Gikk i prod uten gaten som var skrevet:**
- **Dataeksport fase 1+2** — fire verifiseringspunkter sto som «gjenstår før prod»
  (bestill→zip→manifest, `activity_log` m/ip+user-agent, lagringsflatene, innlogget
  bilde-lasting). Deployen skjedde uten dem. **Fase 1 rører filserving** — punkt 4 er den
  som betyr noe.
- **Kontekstvelger 1a** — ventet fabels skjermbilde-designgate + Kenneths D7-bekreftelse
  («premiss enkeltmålt»). Begge står ubesvart, koden er live.
- **Arkivmal stage 4** — fabel-skjermbilde-gate etter test-redeploy, aldri kjørt.

**Venter Kenneth:**
- **Bildeblokken i DG-radkortet** får egen «BILDER»-etikett i feltetikett-stil og leses som
  et femte felt. Anbefalt: innrykk + eierreferanse («Bilder — Posisjon i tegning»).
- **`onDelete: Restrict` som DB-backstop** på dokumentflyt (slettevakten er kun i appen).
  Migrering; må tåle den ene flyt-løse raden.
- **«Oppretter-entreprise»-feltet** — mål om det er et malfelt av type `company`. Er det
  det, fjernes feltet i stedet for at det bygges logikk rundt det.
- **Forkorting av lange tekster i endringsloggen** — anbefaling avventer, ikke bygget.

**Venter fabel:**
- **Mockupsiden «Repeater F7» finnes ikke** — null treff i `arkivmal-pdf-mockup/`. Blokken
  er bygget mot ordrens skriftlige spec. Fabel skylder mockupen eller en bekreftelse på at
  spec-en er fasit.

- **Runtime-verifisering på test** av append-only-fiksen og fase M-3a del 2 (skjermbilder,
  funksjonell) — begge sto som utestående og gikk til prod uten den.
- **Pre-eksisterende TS2589** i `sjekklister/[sjekklisteId]/page.tsx:117` — finnes på ren
  develop, feiler ikke `next build`, men står urørt siden juli.

**Ikke startet:**
- **DG funn 6** — tilbehør-fjerning på `drawing_position`, `location`, repeater-radnivå og
  `date`/`date_time`. Migreringsmålt i prod: kun repeater har data (4 kommentarer + 4
  vedlegg av 13 felt), de tre andre er tomme → ren fjerning.
- **Kontrollplan leveranse 2 + 3** — tegningspunkter + passiv fargevarsling, så aktiv
  scheduler-varsling.
- **Ord-nivå diff i web-endringsloggen** (`fix/endringslogg-web`) — holdes bevisst til
  app-runden.
- **`feat/kontrollplan-revisjon` del 1** — lokal hos en avsluttet Opus, aldri pushet.
  🔴 Verifiser at den finnes før noen planlegger på den.

⚠️ **Verifiseringsgrunnlaget for F7 er borte** — BEF-001, BEF-002 og BHO-002 er slettet.
DoD-en peker nå på et nytt kontrolldokument på dagens mal; bygges malen først, dekker samme
runde både funn 6 og F7s skjermbevis.

**Vedtak som må overleve arkiveringen:** H6 er **revidert, ikke reversert** — «Godkjent er
stoppsted i FLYTEN; Lukk er administrativ exit». Slettevakten er `draft || closed`,
`cancelled` er død status (0 rader i prod), Lukk er kun admin i begge lag.

**Høstet ved arkiveringen 2026-10-06** (innslagene ligger i [historikk-2026-10.md](historikk-2026-10.md)).
⚠️ **Ikke remålt ved flyttingen** — kan være lukket siden; mål før noen planlegger på dem:
- **Georeferanse (23.09):** auto-georeferansen fra DWG er to punkter → rotert. Betingelse før koding:
  mål om `detekterKoordinatSystem(filnavn, extents)` i praksis gjetter fra filnavnet.
- **Dokumentprefiks (22.09):** `JH2` og `KD1` manglet prefiks i mal-velgeren (nummerløse maler, unikhetsvakten gjelder ikke).
- **Kapittel-sortering (20.09):** `bibliotek.ts:37` sorterer kun på `sortering` — tiebreaker `kode` mangler.
- **Område (23.09):** admin-krav på `omrade.opprett` krever at `tegninger/page.tsx:235` + `OpprettPunktDialog.tsx:77`
  skjuler/deaktiverer; stille duplikater ved `omrade.slett` (BACKLOG § 1).
- **Direktehentet prosjektmal (13.09):** ingen ↻-vei — krever avstamningsfelt mot `BibliotekMal` (skjemaendring, Kenneth gater).
- **Åpne saker 10.09:** `hr_ansvarlig` (etter pilot) · `kanRedigere` serverhåndheving · ⓘ-forklaring på kortene ·
  duplikat-forebygging på firmanavn · `byttEier` uten dokumenttilgangssjekk (`oppgave.ts:2088`, `sjekkliste.ts:1924`).
- **Annotering (30.09):** ingen miniatyr etter Ferdig — satt på vent til innloggingsmodellen for `/uploads/` er på plass.
- **Tegning (25.09):** zoom-fiksen mangler visuell bekreftelse på ekte A3-tegning; målestokk «husk + overstyr» er egen runde.
- **Punktsky (24.09):** LAS-avledet overflate skal ikke brukes som volumdokumentasjon før én ekte drone-LAS er kjørt gjennom.
- **Test 02.10:** publisert byggeplass `900512 Røstbakken` mangler punkt → ingen reiseavstand før punkt settes.
- **August-innslag merket «venter Kenneths gate»** (ANSVARLIG-kolonnen `12e34ceb`, faste felt «gatet med funn») gikk i prod uten registrert gate.

### 🎨 Redesign navigasjon (branch `redesign/navigasjon`, bak `nyNavigasjon`-flagg — av-default, inert i prod)

**Aktiv front — steg viii (kunderunde mot prod-kopi) + pilot.** Infra reist + runbook komplett (2026-07-08); venter kunde-booking + Kenneth-drift: opprett demo-prosjekt m/ `oversettelse`-modul, kjør pre-flight-SQL, last opp SDS. Deretter pilot (flagg → `company_admin`).

Egen Docker-stack `docker-compose.redesign.yml` (web 3500 / api 3501), DB `sitedoc_redesign` (prod-kopi). Runbook + env/secrets/demo-strategi: [steg-viii-kunderunde.md](../redesign/steg-viii-kunderunde.md). Dev-login IKKE aktiv på redesign (verifisert 2026-07-09; se [dev-login-agent.md](dev-login-agent.md)). Full paritet + T/G: [redesign-paritetssjekkliste.md](redesign-paritetssjekkliste.md).

**🔴 Blokker før steg viii:** OAuth-redesign gjenbruker prods apper m/ to ekstra redirect-URIer — skal reverseres (egne app-registreringer + fjern URIene fra prod-appene). Kilde: [BACKLOG § OAuth: redesign holder prods nøkler](BACKLOG.md).

**Fullført kode — alt på prod + arkivert (ingen status-/designgodkjenning-kopi her, statuskilde-regelen):**
- Steg ii–vii + K9 URL-kanonisering + K6/P31 Kontakter — prod flagg-inert `0be103fa` (2026-07-07) → [historikk-2026-07.md](historikk-2026-07.md) § Redesign steg ii–vi.
- K13 full søkedekning + restanse-runde (P-a/kildeflagg/FM5/T9) + Plan 2 bruker-lagret flagg — prod flagg-inert (`ffc703df`/`0d3f21ac`, migrering `20260707120000_user_ny_navigasjon`). Presedens `?nyNav`-URL > konto > lokal > env > av i delt `resolverNyNavigasjon` (@sitedoc/shared). Statuskilde K13: designprosjekt «Sitedoc redesign tips» → `verifisering/K13-verifiseringslogg.md`. Detaljer: [k13-sokdekning-rapport.md](k13-sokdekning-rapport.md).
- Finnbarhets-revisjon (søkemotor `sok-match.ts` + begrepsfikser + byggeplasser-kort) — prod `43299d03` (2026-07-15), flagg-inert unntatt `nav.sok`/`nav.kontrollplan`-labels (se PROD-LIVE-merknad øverst) → [historikk-2026-07.md](historikk-2026-07.md).
- Delt `OppsettSidemeny` + sidebar aktiv-seksjon-fix + 🔴 per-rad geofence-indikator (LIVE, ikke bak flagg) — prod `e5859440` (2026-07-15, runde 2) → [historikk-2026-07.md](historikk-2026-07.md).
- Georeferanse-panel v2 + Kartverket-adressesøk (G2), i18n 13 språk `a2a8d5c7` — prod `387d10a2` (2026-07-15, runde 3). Statuskilde: designprosjekt «Sitedoc redesign tips» → `verifisering/georef-panel-verifiseringslogg.md`. Prod-runde: [historikk-2026-07.md](historikk-2026-07.md).

**Åpne oppfølgere (sporet annet sted):** redesign-mobil-restanser + steg vii/2c-leser-funn → [BACKLOG § Redesign-mobil](BACKLOG.md) + [§ Redesign steg vii/2c](BACKLOG.md); GPS-felttest av geofence → [BACKLOG § GPS-felttest](BACKLOG.md); MS-login mobil lokal dev-placeholder → BACKLOG.

### PSI Fase A + Maskin + ③ + timer-paritet — mobil-restanser (web/DB i prod, mobil venter EAS)

Web + DB-migreringer i prod (`80974276`/`0be103fa`); timer-paritet + pause-regler + overlapp/gjenåpne-vakt + nyNav sticky-flag i prod (`224c13f6`, 2026-07-09 → arkivert til [historikk-2026-07.md](historikk-2026-07.md)). **Gjenstår kun mobil-delene**, alle via neste **EAS-batch** (gjeld sporet i BACKLOG, ikke tapt):
- PSI `MannskapInnsjekkKort` inn/ut + dagsseddel-registrering + maskin/③-mobil.
- Timer-paritet mobil: bolk (e) B1–B4, bolk (f) gjenåpne-bekreftelse + `PRECONDITION_FAILED`-mapping, bolk (g) prefill-scope/`fra<til`/0==0 — [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md).
- maskin-vs-maskin-overlapp, `sedel.pauseMin`-avklaring, dagsnorm-varsel-vs-B2, midnatt-wrap-bug, Piece 2 (1b auto-utkast fra/til), maskin-`fra<til` på synk (SYNC-2-funn) — alle i BACKLOG. (`pauseBeregning.ts`-mobil-dedup ✅ M2.)

**Bolk (h) — mobil offline-synk-blokkere (rekkefølge SYNC-1 → SYNC-2 → M2–M7, én commit per steg, alle utsatt til EAS #38):**

> **Verifiseringsnivå (oppdatert 2026-07-10 — Fase 4):** SYNC-1, SYNC-2, M2, M3, M4, M5, M6, M7 statisk verifisert (typecheck/vitest/web-build/objekt-lesing) **+ bolk-(h)-kjernen nå enhets-verifisert** på simulator mot api-test (SSH-tunnel). **Fase 4-resultat:** punkt **1–6 ✅ runtime** (B3/auto-synk 11:00+3→14:30, hele-sedel-prefill, overlapp-speiling, B2-sperre, maskin B1–B3, SYNC-1 offline-avvisning rødt banner). Punkt **7–8 (M4 gjenåpne-koder + M7 Alert) BLOKKERT** av to attestering-bugger funnet under testen: rader forsvinner på mobil etter attestering (🔴 mulig SYNC-2-regresjon) + attestert-sedel-deadlock (🔴 retur-knapp forsvinner ved `accepted`). **Begge er #38-blokkere** til avklart. Se [BACKLOG § Timer web-vs-mobil paritet → Fase 4 simulator-funn](BACKLOG.md).
- **✅ SYNC-1 (develop 2026-07-10):** `syncBatch.ResultatRad` utvidet med `"avvist"` (permanent avvisning: P2002, katalog-mismatch, maskin>arbeid, FORBIDDEN) skilt fra transient `"feilet"`. Mobil gjør `avvist` terminal (forlater pending → retry stopper) med rødt banner i `timer/[id].tsx` + `TimerSyncStatusBar`. Ny lokal `syncStatus="avvist"` (TS-enum, ingen SQLite-migrering). Bakoverkompat: #37 faller til else på `avvist` → beholder pending (dagens oppførsel). Se [BACKLOG § Timer web-vs-mobil paritet → SYNC-1](BACKLOG.md).
- **✅ SYNC-2 (develop 2026-07-10):** overlapp + `fra<til`-regel løftet til `@sitedoc/shared/utils/tidsromValidering.ts` (ren + vitest 44/44); web (`sjekkTimerOverlapp`/`refineFraForTil`) + mobil-synk (`syncBatch` via `finnTidsromKonflikt`, batch-intern) kaller samme regel. Avvisning via `"avvist"`. **+ datatap-fiks:** `syncBatch` persisterer nå `fraTid`/`tilTid` (input + `createMany`, timer + maskin) — før droppet synken dem samtidig som `deleteMany`+`createMany` slettet tider ført på web. Ingen migrering. Se [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md).
- **✅ M2 (develop 2026-07-10):** dedup `pauseBeregning.ts` — mobil-kopien (uten `10622ee3`-grensefiksen, målt) slettet, `TimerSeksjon.tsx` importerer nå fra `@sitedoc/shared`. Ingen mobil-funksjonsendring, kun kilde-samling.
- **✅ M3 (develop 2026-07-10):** klient-side speiling i mobil. `TimerSeksjon` blokkerer lagring ved overlapp (`finnOverlappendeTidsrom` mot **alle timer-rader på sedelen, kryss-bøtte** via ny `alleTimerRader`-prop tråret fra `[id].tsx`; ekskl. redigert rad) + `fra<til` (`tilErEtterFra`); `MaskinSeksjon` får `fra<til`-redirect. Prefill forblir bøtte-scopet (ulikt scope). Duplikat `fraErForTil` slettet — begge kaller delt `@sitedoc/shared`. Ny nøkkel `timer.feil.overlapp` (serverens ordlyd). Ren klient, ingen api/migrering.
- **✅ M4 (develop 2026-07-10):** `gjenaapneDagsseddel`-feil mappes nå på tRPC-**kode**, ikke delstreng. Server (`apps/api/src/routes/timer/dagsseddel.ts`) gir distinkte koder — `CONFLICT` (accepted), `PRECONDITION_FAILED` (attestert rad), `BAD_REQUEST` (annen ikke-sent-status); i tillegg arver mutasjonen `FORBIDDEN`/`NOT_FOUND` fra eierskaps-helperen `hentEgenDagsseddel` (`NOT_FOUND` fikk melding «Dagsseddelen finnes ikke», var tom). **Meldingene på de tre gjenåpne-avvisningene uendret** (web-onError `e.message.includes("godkjent")` uberørt). Mobil (`apps/mobile/app/timer/[id].tsx`): `CONFLICT`→`feilGodkjent`, `PRECONDITION_FAILED`→`laastAttestert`, **enhver annen kode→server-melding** (BAD_REQUEST/FORBIDDEN/NOT_FOUND + fremtidig), **kun fravær av `code`→`feilNett`**. Fikser attestert-vakt + eierskaps-feil vist feilaktig som «Krever nett». Ingen nye i18n-nøkler (`laastAttestert` fantes, brukt av web), ingen SQLite-migrering. **To 🟡-oppfølgere lagt i BACKLOG:** mobil mangler webs proaktive `disabled`-guard (krever SQLite-`attestertStatus` + sync-pull) + `providers/index.tsx` `"UNAUTHORIZED"`-substring (samme feilklasse). Se [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md) + [timer.md § Gjenåpning](timer.md).
- **✅ M5 (develop 2026-07-10):** mobil maskin-modal (`MaskinSeksjon.tsx`) speiler nå webs `MaskinRadDialog` — **B1** (maskin trekker lunsjpause via `effektiveTimerFraSpenn` med `standardPauseMin`, «maskin følger føreren»), **B2** (hard sperre `antall == effektiveTimerFraSpenn` i `lagre()`, `timer.feil.timerAvvik`), **B3** (`timer` init fra prefill-spenn), auto-synk `handterFra/Til/Timer`, **B4-prefill** fra bucketens arbeidsspenn (`defaultTider` leser timer-rader i `(defaultProjectId, defaultEcoId)`). `standardPauseMin`/`pauseEtterTimer` fra `hentOrganizationSettingLokalt`, skiftstart fra `hentEffektivArbeidstidLokal`. **Server:** `syncBatch` validerer nå maskin-`fra<til` (`tilErEtterFra` på `lokal.maskiner`) → `"avvist"` (SYNC-1) — lukker SYNC-2-funnet. Ingen ny i18n, ingen SQLite-migrering. **Docs:** timer.md B2-drift rettet (var «Server-superRefine» — usant) + B1–B4 mobil; ny 🔴 BACKLOG «B2 ikke håndhevet på serveren» (klient-only begge flater); maskin-fra<til-🟡 lukket. Se [timer.md § B1–B4](timer.md) + [mobil.md § Maskin-modal](mobil.md).
- **✅ M6 (develop 2026-07-10):** mobil timer-modal (`TimerSeksjon.tsx`) fikk **B3** (`timer`-init lazy-kaller `effektiveTimerFraSpenn` når `prefillGyldig`; `tilTid` prefylles kun ved gyldig prefill — speiler webs `TimerRadDialog`) + **prefill-scope**: `defaultTider.fra` løftet fra bøtte-scopet siste-rad til **seneste `tilTid` over hele sedelen** (`alleTimerRader`, **maks** via `hhmmTilMin` — ikke array-rekkefølge; fjerner `.reverse().find()`), fallback `effektiv.startTid`. Lukker bolk-(g)-prefill-scope-bulleten (bolk (g) mobil nå KOMPLETT: fra<til M3, overlapp M3, 0==0 allerede vernet, prefill-scope M6). `eksisterendeRader` beholdt for lønnsart/aktivitet-prefill. Ren klient — ingen api, ingen i18n, ingen migrering. **Docs:** timer.md B3 mobil timer ✅; BACKLOG bolk-(g)-rad → 🟢 + usortert-prefill-🟡 avgrenset til maskin-B4 (mobil timer fjernet fra mengden). Se [timer.md § B3](timer.md) + [mobil.md § Timer-modal](mobil.md).
- **✅ M7 (develop 2026-07-10):** bekreftelse før gjenåpning i mobil. `gjenaapne()` (`apps/mobile/app/timer/[id].tsx`) viser nå `Alert.alert(bekreftTittel, bekreftTekst, [avbryt(cancel), bekreftKnapp → utforGjenaapne])`; mutasjons-kroppen (inkl. M4-`onError`, uendret) flyttet til `utforGjenaapne()`. **Ikke** `destructive` — gjenåpning er reversibel. Paritet med webs `<Modal>`-bekreftelse. Gjenbruker webs `bekreft*`-nøkler + `handling.avbryt` (alle nb+en; var web-only). `Alert.alert` er husets bekreftelses-idiom (33/12 — talt 32 i Steg 0 før denne raden selv la til den 33.) og regel-konformt (CLAUDE.md § Slett-bekreftelse treffer webs `confirm()`, ikke RN). Ren klient — ingen api, ingen ny i18n, ingen migrering. **Ny 🟡 BACKLOG:** samle de 33 `Alert.alert` i delt RN-komponent hvis e2e (Detox/Maestro) innføres. **Docs:** timer.md § Gjenåpning, mobil.md. Se [mobil.md § Gjenåpning-bekreftelse](mobil.md).
- **🏁 Bolk (h) FERDIG PÅ DEVELOP + server-delen PROD-DEPLOYET** (SYNC-1 → SYNC-2 → M2–M7, 2026-07-10). **Server-endringene (M4/M5/SYNC i `apps/api`) er live i prod via merge `373a109f`** (arkivert til [historikk-2026-07.md § Prod-deploy 2026-07-10](historikk-2026-07.md)). **Raden holdes AKTIV** fordi mobil-siden (EAS #38) er blokkert av de 2 🔴 Fase-4-funnene (rader-forsvinner-etter-attestering + accepted-deadlock) — se 🧪-raden under. Ingenting nytt startet.
- **🧪 Fase 4 simulator-verifisering (2026-07-10):** kjørt på ekte enhet mot api-test (SSH-tunnel `localhost:3301` → server-ny, dev-login). Punkt 1–6 ✅ runtime; 7–8 blokkert av to attestering-bugger (🔴 rader-forsvinner-etter-attestering + 🔴 accepted-deadlock) → begge #38-blokkere, dokumentert i [BACKLOG § Fase 4 simulator-funn](BACKLOG.md). Prod er deployet (`373a109f`, bolk (h) + M4/M5 + katalog-importer). **#38 IKKE klar** før de to 🔴 er avklart.
- **✅ F4-serien (F4-1/1b/1c/1d/2/2b/3/4) — DEPLOYET TIL PROD 2026-07-11 (`d1b96cd5`):** identitetsforsoning + attestering-deadlock (gjenåpne) + synk-robusthet (touch-parent, projectId-poison, NOT_FOUND-oppslag) + mobil display-fikser. Server/web-delene live i prod; mobil-only (F4-1c dedupe, F4-3 attestert-tittel) ligger i main men når enheter via **EAS #38**. Full detalj + per-rad fil:linje arkivert til [historikk-2026-07.md § Prod-deploy 2026-07-11](historikk-2026-07.md).
- **⚠️ Deploy-rekkefølge — server FØR EAS #38:** `1061dd5a` (M4) og `0b0eb38e` (M5) rører `apps/api/src/routes/timer/dagsseddel.ts` (distinkte tRPC-koder `code: "CONFLICT"`/`"BAD_REQUEST"` + `code: "NOT_FOUND", message: "Dagsseddelen finnes ikke"` + maskin-`fra<til`-vakt `lokal.maskiner.find((m) => !tilErEtterFra(...))`). `8ffb29b0` (M6) og `1d6d616c` (M7) er **mobil-only**. **Server (M4+M5) MÅ prod-deployes FØR #38 når testerne.** Mot gammel server: gjenåpne-avvisningene deler fortsatt `PRECONDITION_FAILED`, så en #38-klient (`timer/[id].tsx` `onError`: `code === "PRECONDITION_FAILED" → laastAttestert`) viser «be leder returnere» for en sedel som faktisk er **godkjent** (`accepted`). Gammel servers meldingsløse `NOT_FOUND` vises som den rå strengen «NOT_FOUND», fordi klienten nå viser `e.message` for ukjente koder (`code != null ? melding`). **Ikke datatap — feil tekst.** Motsatt retning er trygg: gammel klient (#37) mot ny server leser `e.message`, som er uendret.

**Dagsseddel-prod krever `aktiverNivaa1` på prod-firmaet** (lønnsart-katalog seedet) ellers mangler lønnsarter — jf. onboarding-wizard + lønnsart/katalog-import-trådene under. (Redesign steg viii-kontinuitet: se redesign-blokka øverst.)

**Leveransekanal — EAS-bunt #37 / TestFlight (venter Florians funksjonelle device-test):**

Gjeldende TestFlight-bunt (bygg-ID `496b6a63`, commit `bc744f82`, sky-bygget 2026-07-01 da juli-kvoten resatt, status `finished` m/ .ipa). **Kumulativt fra develop** → .ipa inneholder ALL tidligere merget mobil-kode (timer-UX UF-0…UF-4/U1–U3 fra #30-æraen, byggeplass-UX fra #31) + det nye under. Erstatter #30/#31 (juni-kvoten oppbrukt; lokalt bygg = blindvei, se [eas-build-veileder.md](eas-build-veileder.md)). **Ingen schema/server.** A.Markussen-validering av **full timer-UX** skjer via #37 når det er i TestFlight. **Neste bygg = #38, etter bolk (h) (mobil-paritet); #37 er gjeldende TestFlight-bunt til da.**

**Kenneths beslutning (2026-07-10): Florian tester ikke #37 — han venter på #38 (etter bolk (h)).** Grunn (verifisert i kode): en rad serveren avviste ble stående `syncStatus="pending"` og `TimerSyncStatusBar.tsx` viste den som gul spinner → falsk trygghet for tester. **SYNC-1 (develop 2026-07-10) lukker synligheten** — permanent avvisning settes nå til terminal `syncStatus="avvist"` med rødt banner. Rettelsen når først testeren via #38 (SYNC-1 er på develop, ikke i #37s .ipa). Se bolk (h)-punktet over + [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md).

Nytt i #37 (vs #31): **Mobil Microsoft-auth** (code+PKCE, `f8594d1c`) → [BACKLOG § Mobil Microsoft-auth](BACKLOG.md) (Azure-sjekkliste + Florians test der; ikke duplisert her); **F-G glemt-dag 0-fiks** (`c6babc44`, bug — kort start-segment klampes aldri til 0) → [BACKLOG § Org uten standard-lønnsart](BACKLOG.md).

Fra #31 (venter fortsatt device-verifisering via #37):
- **Byggeplass-UX F1–F6** — `ByggeplassKontekst` eneste kilde, header-chip, GPS auto-set + override, timer-default, favoritter (`a46d58e9`/`b2ee5fb4`/`0eb2c9ef`/`d7419e6b`/`7c3ae7e3`) → [BACKLOG § Mobil global byggeplass-UX](BACKLOG.md).
- **F-A glemt-dag-transparens** — `sluttTidKilde="system"`-utkast viser «Estimert slutt … (gjettet)»-banner. Ikke-blokkerende.
- **F-B auto-rundings-fiks** (bug) — auto-genererte timer-rader rundes til firma-tidsrunding-grid (15 min = 0.25 t) på arbeidstimer før normaltid/overtid-splitt (`rundTimerTilNarmeste`); reise urørt.
- **B2+B6 sedel-nivå byggeplass** — `arbeidsdag.byggeplassId` inn i auto-utkast (`dagsseddelOpprett.ts`), ny `ByggeplassVelgerModal` + blå sedel-topp, myk mismatch-advisory (G1: arbeider-valg autoritativt). Server/schema uendret; i18n 3 nøkler × 15 språk. **Parkert (Besl. 6-oppf.):** per-rad byggeplass / «splitt dagen mellom byggeplasser».

**Device-test (via TestFlight #37, alt før submit):** (a) org uten lønnsart → banner (ikke stille 0) · (b) org m/ lønnsart + start 21:33 → ~2.45t-rad dag-1, pause på lengste segment · + chip/GPS/favoritt + glemt-dag-transparens + 15-min-runding. **Før GPS-test:** prod-prosjekt mangler byggeplasser — opprett + geofence på sitedoc.no → Byggeplasser. **Reload:** Expo JS/TS (Fast Refresh). _(Web-sporet geofence-editor A+B + rename C ble deployet til prod 2026-06-24 `a558db2e` → arkivert til [historikk-2026-06.md](historikk-2026-06.md).)_

### Gjenstående (åpent, ikke sporet annet sted)

- **EAS Android-bygg + Play Store** — Android-distribusjon står igjen (iOS går via TestFlight/EAS). Ikke sporet i BACKLOG/oppryddings-plan → beholdes her.

_Øvrige tidligere «Gjenstående PRs»-punkter er sporet i sannhetskildene og kollapset hit (2026-07-06):_ T7-5h ([BACKLOG](BACKLOG.md), deployet 2026-05-28) · P-KRITISK-1/-2/-3 ([oppryddings-plan-2026-04-28.md § P-KRITISK](oppryddings-plan-2026-04-28.md); -2/-3 deployet, -1 🔴 åpen) · HMS-prosjektvisning teknisk gjeld ([BACKLOG § HMS-prosjektvisning teknisk gjeld](BACKLOG.md)).

## Kundeønsker — A.Markussen (mottatt 2026-05-06)

12 forbedringsønsker fra kunde. Status per 2026-05-11 etter sjekk mot kode og commits. Legenda: 🟢 fikset · 🟡 delvis · 🔴 ikke startet · ❓ trenger verifikasjon · ⏸️ parkert.

### #1 — Sjekkliste for service koblet til timetall og status 🟡

**Side:** Maskin-detaljer (f.eks. 7634 Heatwork MY35). **Prioritet:** Høy.

Kunden ønsker sjekkliste der timetall kobles til servicestatus, og «neste service» oppdateres automatisk.

**Status:** DB-feltet `nesteServiceTimer` finnes allerede i `packages/db-maskin/prisma/schema.prisma:188`. Mangler: UI-felt på maskin-detaljside, serviceintervall-konfigurasjon, visuell terskel-indikator, sjekkliste med avkrysningsbokser, automatisk oppdatering av neste service basert på driftstimer.

### #5 — Registrering av HMS-gruppe på brukere ⏸️ PARKERT

**Side:** Oppsett – Brukere.

**Opprinnelig ønske:** Felt for HMS-gruppe på bruker/kontakt-kortet, knyttet til eksisterende gruppe-struktur, filtrerbart i brukerlisten.

**Status (oppdatert 2026-05-11 etter Sonnet-sesjon):** Parkert til prosjektoppsettet er mer modent og avhengighetene er synlige. Tidligere klassifisert som «lav kompleksitet» — feilvurdert.

**Begrunnelse:**
- To separate konsepter eksisterer i dag: `ProjectGroup` (RBAC/tilgang) og `Faggruppe` (dokumentflyt-deltaker). HMS-gruppe må plasseres i en av disse eller bli et tredje konsept — ikke avgjort.
- Standard HMS-gruppen (`hms-ledere`, `category="field"`) har ingen UI for administrasjon i dag — kan ikke redigeres via noen side.
- Brukergruppe-arkitekturen er uavklart: Kenneth vurderer firma-basert gruppering (ansatte/ledere per firma) som fremtidig modell, men ikke låst.

**Beslutning:** Ikke estimer eller planlegg denne nå. Tas opp igjen når prosjektoppsett-design og brukergruppe-arkitektur er låst.

---

### #7 — Rettighetsmatrise med rolle-styring (Prosjektleder + Bas) 🔴

**Side:** Oppsett – Brukere/Roller.

Ingen treff på `Prosjektleder`/`Bas` som DB-roller. Eksisterende roller: `User.role = sitedoc_admin | company_admin | user` og `ProjectMember.role = admin | member`. Krever ny rolle-modell + matrise-UI som viser tilganger per rolle.

### #9 — Justeringer på SJA (signatur/lesetilgang/deltaker) 🔴

**Side:** Innstillinger – Produksjon – Sjekklistemaler – SJA.

Ingen treff på `SJA`/`sja` i kode — SJA er sannsynligvis en konkret sjekklistemal-instans, ikke egen funksjonalitet. Krever utvidet sjekkliste-mekanikk: re-signaturforespørsel, auto-lesetilgang for alle prosjektmedlemmer, selv-påmelding som deltaker.

### #10 — «Flere personer»-feltet på SJA — definere hvem som er valgbare 🔴

**Side:** Innstillinger – Produksjon – Sjekklistemaler – SJA.

Avklare om feltet henter alle firma-ansatte. Krever felt-konfigurasjon for å begrense/definere valgbare personer per SJA-mal.

### #11 — Pushvarsel/SMS til ansattliste 🔴

**Side:** Generelt.

Ingen treff på `pushvarsel`/`sms` i kode. Krever ny varslingstjeneste (SMS-leverandør integrasjon), målgruppe-velger (alle ansatte eller utvalgte grupper), kostnadsavklaring med SiteDoc/leverandør.

### #12 — Oppretting av ny sjekkliste fungerer ikke 🟢 SANNSYNLIGVIS FIKSET

**Side:** Sjekklister (prosjekt 998 Instinniforbotn).

**Status:** Commit `4e29c88a` («fix: sjekkliste opprett-modal stille død») deployet til prod 2026-05-09. Lukket bug der klikk på mal i opprett-modal gjorde ingenting når innlogget bruker ikke var medlem av noen faggruppe (typisk sitedoc_admin/company_admin uten faggruppe-tilknytning) — `handleOpprettFraMal` returnerte stille. Nå: fallback-kjede henter `bestillerFaggruppeId` fra dokumentflytens `oppretter`-medlem, synlig feilmelding i Modal hvis ingen kandidat finnes. Re-test ønskelig fra kunde for å bekrefte at både «Opprett ny sjekkliste» og «+ Ny sjekkliste» nå fungerer i prosjekt 998.

## Kjente bugs

**~~Lokasjon-modal forhåndsvelger ikke når kun ett alternativ finnes (observert 2026-05-02)~~ — LØST.** Verifisert 2026-05-05 at auto-select er implementert i `apps/web/src/components/LokasjonVelger.tsx:66-81` (to useEffect-hooks: én for bygning, én for tegning, begge sjekker `length === 1` og setter valgt verdi). Sannsynligvis lagt til etter den opprinnelige observasjonen. TegningsModal (skjermbilder, ikke samme flyt) auto-velger kun ved `standardTegningId` — bevisst design.


## Pauset, planlagt og fremtidige faser

→ Se [docs/claude/BACKLOG.md](BACKLOG.md) for konsolidert backlog
(teknisk gjeld, halvferdige features, Fase 0.5-7, kundeønsker ikke startet).
