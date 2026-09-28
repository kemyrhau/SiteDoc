---
name: historikk-2026-09
description: Arkiv av lukket/deployet arbeid fra september 2026. Flyttet ut av BACKLOG og STATUS-AKTUELT 2026-09-28 per arkiveringsplikten i CLAUDE.md.
---

# Historikk september 2026

**Flyttet hit 2026-09-28 fra BACKLOG.md og STATUS-AKTUELT.md.** Arkiveringsplikten sier at deployet/lukket arbeid ikke skal ligge i de aktive filene; den var ikke utfoert denne maaneden. Ingenting er slettet — alt staar under.


<!-- fra docs/claude/BACKLOG.md -->
## ✅ LUKKET ved remålingen — ikke gjenåpne uten ny måling

| Sak | Bevis |
|---|---|
| **Reise: km-terskel + enhet** | `packages/shared/src/utils/reise.ts:27` (`ReiseEnhet = "minutter" \| "km"`), `:44-57` regelsett, `:86+` `klassifiserReise`. Tester `reise.test.ts:90-119`. Mobil-speiling `db/schema.ts:585-596`. Server `organisasjon.ts:1175,1189`. UI `firma/innstillinger/page.tsx:1206-1257`. Commits `162ef59e`, `d70dbe75` |
| **Reise-lønnsart «Automatisk (navne-match)»** | `reise.ts:36` `REISE_LONNSART_REGEX` (én delt kilde) · tvetydighetsvarsel `organisasjon.ts:1038-1049` · mobil-resolver `services/timerKatalog.ts:266-272` |
| **Mobil-PSI viste «fullført» ved avvist signering** | `apps/mobile/app/psi/[psiId].tsx:196-214` — `await` først, `catch → Alert + return`, `setSeksjonFullfort` først etter bekreftelse. Speiler web `2ee6e343` |
| **Byggeplass redigeres/slettes fra UI** | `oppsett/byggeplasser/page.tsx:879` (`bygning.oppdater`), `:1469` (`slett`), `:1467` (`hentSletteSammendrag`). ⚠️ **2D-tegning-delen av samme post står fortsatt åpen** |
| **Serieopplasting av bilder + rekkefølge** | `apps/mobile/src/services/bilde.ts:259-292` — `allowsMultipleSelection` + `orderedSelection` med dokumentert Android-forbehold |
| **A7 proxy-headers** | `apps/web/next.config.js:4` `poweredByHeader:false`, `:59-80` HSTS + `X-Frame-Options`. Commit `a23719dc` |


<!-- fra docs/claude/BACKLOG.md -->
##### ✅ LEVERT 2026-09-27 — `fix/psi-prosjektniva-unik` @ `f7d872eb` (kontrollplan)

**Kenneth valgte vei 1: utvid den develop-mergede migreringen, ikke ny på toppen** — så det aldri
finnes et vindu der begge garantiene mangler. `DROP INDEX` på `:20`, partiell `CREATE` på `:32`, i
den rekkefølgen. **Én test låser nettopp rekkefølgen**, ikke bare at setningen finnes.

🟢 **Krav (c) oppfylt så langt miljøet tillater, og avgrensningen er meldt i stedet for skjult:** det
finnes ingen nåbar Postgres i `packages/db`-vitest (ingen `DATABASE_URL`), så `psi.opprett` kan ikke
drives ende-til-ende der. Kontrollplan låste **DDL-kontrakten som ER regelen** + premisset
(`byggeplassId` nullable). 🔴 **Det er riktig fordi den partielle indeksen er ENESTE håndhever:**
`psiWhere()` (`psi.ts:8`) er død kode og `psi.opprett` (`:203`) har ingen app-guard. **Oppfølger:
behavioral test i api-harnessen når en test-DB er koblet.** Gate: db 272 → 276 (+4), øvrige stille.

🟢 **TRE FORHÅNDSSJEKKER KJØRT AV KENNETH 2026-09-27 — alle 0 rader:**

| Sjekk | Svar | Betydning |
|---|---|---|
| Er `20260926120000` kjørt i prod `_prisma_migrations`? | **0 rader** | 🟢 Redigeringen av den develop-mergede migreringen var lovlig |
| Prosjekter med 2+ PSI der `byggeplass_id IS NULL` — **prod** | **0 rader** | 🟢 `CREATE UNIQUE INDEX` kan ikke feile på duplikater |
| Samme — **test** | **0 rader** | 🟢 Samme, og test-deploy er trygg |

⚠️ **Den midterste er den som betyr noe:** en `CREATE UNIQUE INDEX` som treffer duplikater ruller
**hele** migreringen tilbake — akkurat slik `20260430120000_add_klasse4_indekser` gjorde i april, og
den ble liggende rullet tilbake i fem måneder uten at noe sa fra. **Sjekken er grunnen til at det
ikke skjer igjen her.**

🔴 **GJENSTÅR: prod-deploy.** Migreringen er kode, ikke tilstand. **Kenneth kjører `migrate deploy`
når han vil** — test er en trygg no-op der (indeksen mangler alt, og `IF NOT EXISTS`/`IF EXISTS`
gjør begge setningene idempotente).


<!-- fra docs/claude/BACKLOG.md -->
#### ✅ LUKKET 2026-09-27 — Stille feil ved PSI nr. 2 — ingen P2002-fangst noe sted (`fix/psi-p2002-haandtert`, kontrollplan)

**Kodeveien var:** knapp `psi/page.tsx:415` → `:447-454` `opprettMut.mutate(...)` → server `psi.ts:203`
`prisma.psi.create`. Ingen forhåndssjekk, ingen P2002-fangst på serveren, ingen `onError` på
`opprettMut`, ingen global tRPC-feil-toast → spinneren stoppet og ingenting skjedde.

🟢 **Fiks levert (samme mønster som `overflate.ts:122-131`):**
- **Server:** `psi.opprett` (`psi.ts`) wrapper `psi.create` i try/catch og kaller ny ren hjelper
  `tolkPsiOpprettFeil` (`psi-feil.ts`). Den skiller de **to** unike indeksene på `e.meta.target`
  (`psi_project_id_building_id_key` → byggeplass-melding · `psi_prosjektniva_unik` → prosjektnivå-melding),
  gir én melding sann for begge ved uklart mål, og **boble en P2002 fra en fremmed indeks opp URØRT**.
- **Klient:** `onError` på `opprettMut` viser meldingen **inline** ved skjemaet (rød rute), ikke toast.
- **i18n:** `psi.konflikt.{byggeplass,prosjektniva,generell}` + `psi.opprettFeil` via `t()` (nb+en+13).
- **Krav (c):** `psi.tolkOpprettFeil.test.ts` — CONFLICT ved byggeplass-brudd, CONFLICT ved
  prosjektnivå-brudd, og **falsk-positiv-vakt** (fremmed P2002 bobler urørt, sammenlignet mot
  original-instansen). Mock av `PrismaClientKnownRequestError` med `meta.target` (ingen test-DB i
  api-harnessen). Mønster + hvorfor: [api.md § P2002 → CONFLICT (psi.opprett)](api.md).


<!-- fra docs/claude/BACKLOG.md -->
### 🟢 LUKKET 2026-09-16 — `apps/mobile` har nå test-runner (vitest) i CI

**Levert i runde mobil-harness (`test/mobil-harness`).** `apps/mobile` har nå `"test": "vitest run"`,
en `vitest.config.ts`, og er automatisk med i `pnpm test` (turbo) fra ROT → kjører i CI i samme
jobb som resten. Målt: `pnpm test` gir 7/7 tasks, mobil-tallet er 9 (6 rene `splittVedMidnatt` +
3 offline-DB mot ekte SQLite). Krav (c) er EKTE oppfylt: den faktiske migrerings-SQL-en kjører mot
sql.js (SQLite-WASM), og en `sjekkliste_feltdata`-rad med tom `sjekkliste_id`/`id` avvises av ekte
NOT NULL-constraint. **Mobil-unntaket i CLAUDE.md § «Stille tomhet» kan nå fjernes av cowork.**

⚠️ **Avvik fra anbefalingen under (begrunnet ved måling):** anbefalt retning var `better-sqlite3`,
men den er en NATIV modul (node-gyp, ABI-følsom) — lokal node er v25, CI node v20, og ulik ABI gir
build-risiko. **sql.js (WASM, ingen native build) er portabel på tvers og fortsatt EKTE SQLite** →
krav (c) oppfylt uten native-risikoen. jest-expo ble ikke valgt: dets fortrinn er RN-komponent-
transforms, som denne runden ikke trenger (kun rent DB-lag + utils), og det ville lagt en andre
runner ved siden av vitest.

<details><summary>Opprinnelig sak (historikk)</summary>

Målt av redesign da han skulle skrive en test ordren krevde: **`apps/mobile` hadde verken
`test`-script, vitest eller jest.** `pnpm test` (turbo) treffer api, pdf, shared og web — mobil er
ikke med, og gate-kommandoene kjører kun typecheck + lint der.

🔴 **En `.test.ts` lagt i mobil ville aldri kjøre — død i CI, verre enn ingen test**, fordi den ser
ut som dekning.

⚠️ **Konsekvens i praksis:** `formaterNummer` måtte flyttes til `@sitedoc/shared` for å kunne
testes i det hele tatt (`412c878a`). **Det er en arkitekturbeslutning tatt av en verktøymangel**,
ikke av hvor koden hører hjemme. Den avveiningen kommer til å gjenta seg.

🔴 **Pilotmålestokken er «50 ansatte, mobil viktigst».** Kvalitetssikringsplanens tre lag
([kvalitetssikring-plan.md](kvalitetssikring-plan.md)) dekker lint, simulator-røykliste og
api-tester — **ingen av dem er enhetstester på mobil-logikk.**

**Ikke ordre.** Å legge inn jest/vitest med RN-preset er reell infra-endring som flytter
baselinen og krever godkjenning. **Kenneth-beslutning.**

🔴 **Eskalert 2026-09-11 — blokkerer fase 2 offline.** Krav (c) i «stille tomhet er forbudt»
(*en test som FEILER når feltet er tomt*) kan derfor ikke oppfylles for noen offline-katalog på
mobil. Første treff: `reise_grensepunkt_local` (runde 75) — wiringen `hentReiseGrensepunkterLokalt
→ løsReiseLonnsartId` står utestet, mens begge ender er dekket (api-test + `shared/reise.test.ts`).

🔴 **Gate:** **offline-runden for oppgaver/HMS (fase 2) skal ikke relayes før denne er lukket.**
Den runden bygger nye kataloger med samme krav, og uten harness gjentas unntaket i stedet for å
bli lukket. Unntaket er ført ved regelen selv i [CLAUDE.md § Stille tomhet er forbudt](../../CLAUDE.md).

🟢 **Anbefalt retning (Kenneth 2026-09-11, valget tas i saken):** **vitest + `better-sqlite3`**,
ikke `jest-expo`. Katalogene er ren SQLite-logikk uten native- eller UI-avhengigheter, og vitest er
den tynneste installasjonen som dekker behovet.

⚠️ **Pakkeinstall i mobilappen krever Kenneths gate** (CLAUDE.md § Spør alltid før du).
**Ikke startet før pilot er i drift.**

</details>


<!-- fra docs/claude/BACKLOG.md -->
### 🟢 LUKKET 2026-09-08 — PSI scroll-gate er IKKE en manglende sikkerhetsgate

⚠️ **Skrevet ned for at ingen skal etterforske dette en tredje gang.**

`harScrolletNed` / `innholdKortNok` står som ubrukte variabler i **både** web
(`app/psi/[prosjektId]/page.tsx:343,374`) og mobil (`app/psi/[psiId].tsx:72,168`).
De settes av scroll-lyttere, men `kanVidere` / `kanGåVidere` leser dem aldri.

🔴 **Det ser ut som et håndhevingshull. Det er det ikke.**

**`547261c4` (2026-04-03):** *«Neste-knapp alltid aktiv for tekst/bilde-seksjoner — Fjerner
scroll-krav for rene innholdsseksjoner. Kun quiz, video og signatur har krav. Gjelder både web og
mobil.»*

🟢 **Kravet ble bevisst fjernet.** Commiten slettet `return harScrolletNed || innholdKortNok;` fra
`kanVidere`. Variablene og lytterne ble stående som rester.
🟢 **Ingen doc i `docs/claude/` beskriver noe lesekrav** — `mannskap.md` nevner quiz, video og
signatur, ikke lesing. **Det eneste belegget peker motsatt vei.**

⚠️ **Coworks feil, ført så den ikke gjentas:** cowork sluttet fra ubrukte variabler til en manglende
sikkerhetsgate og presenterte det for Kenneth som en etterlevelsessak. **Slutning, ikke måling.**

🔴 **Og logikken tåler ikke å slås på igjen som den står:**
- **Web:** høyden sjekkes ÉN gang 100 ms etter seksjonsbytte, uten `ResizeObserver`. Bilder er
  `loading="lazy"` → `scrollHeight` er ofte feil ved måletidspunktet.
- **Mobil:** `innholdKortNok` settes inne i `onScroll`. **En kort, ikke-scrollbar seksjon utløser
  aldri `onScroll`** → arbeideren ville låses ute av en seksjon han ikke kan scrolle.

**Skal «må lese før signering» gjeninnføres, er det et produktvedtak — og robustheten må bygges på
nytt før noe kobles inn.**


<!-- fra docs/claude/BACKLOG.md -->
### 🟢 LUKKET 2026-09-11 — MOBIL-PSI: seksjonen vises fullført selv når serveren avviste signeringen

**Funnet av dokgen 2026-09-09** mens web-varianten ble fikset (`fix/web-psi-signering`).

`apps/mobile/app/psi/[psiId].tsx`:
- `:189` `setSeksjonFullfort(...)` — **kjører før sendingen**
- `:193` `await ...mutateAsync(...)`
- `:199-201` `try/catch` → `Alert`

🟢 **Feilen er synlig på mobil** — arbeideren får beskjed (`Alert`).
🔴 **Men den grønne progresjonen viser seksjonen som fullført likevel**, fordi
`setSeksjonFullfort` alt har kjørt. **Beskjed og skjermbilde sier motsatt ting.**

**Web-varianten ble rettet** i `2ee6e343`: i signaturgrenen markeres seksjonen fullført **kun
etter** serverbekreftelse.

🟢 **LUKKET 2026-09-11 — mobil rettet.** Målt uavhengig to ganger (cowork + kontrollplan,
[backlog-maaling-2026-09-11.md](backlog-maaling-2026-09-11.md) § 220):
`apps/mobile/app/psi/[psiId].tsx:203-213` venter på serverbekreftelse (`await fullforMut.mutateAsync`)
FØR `setSeksjonFullfort`; catch markerer seksjonen **ikke** fullført. Den gamle rekkefølgen
(`setSeksjonFullfort` på `:189`) finnes ikke lenger. Levert via `fix/stille-mutasjoner`.


<!-- fra docs/claude/BACKLOG.md -->
### 🟢 Bilde-registrering ikke idempotent — LEVERT på `fix/bilde-idempotens` (migrering gates av Kenneth)

`bilde.opprettForSjekkliste`/`opprettForOppgave` gjorde blind `prisma.image.create` — samme foto kunne bli to `Image`-rader når køen (`OpplastingsKoProvider`) retriet en opplasting som lyktes server-side men mistet svaret. Sjekklista/PDF-en rammes IKKE (rendres fra `checklist.data`, nøklet på `vedleggId` via `settUrlPaaVedlegg` — idempotent, bekreftet); kun `Image`-tabellen (galleri) fikk to rader.

**Fiks (levert):** `vedleggId String? @unique` på `Image` (migrering `20260908130000_bilde_vedlegg_id_unik`, **skrevet, ikke kjørt** — Kenneth gater), `vedleggId` trådd gjennom `opprettFor*`-input + mobil-køen, og `create → upsert` på `vedleggId`. 🔴 Eksplisitt create-fallback beholdt når `vedleggId` mangler (eldre klienter før EAS-bygget) — fjernes når alle klienter er oppdatert. Test: `apps/api/src/routes/bilde-idempotens.test.ts`.

🟢 **Målekorreksjon (2026-09-08):** den foreslåtte tellingen på `(checklistId/taskId, fileUrl)` gir **~0** — `/upload` mynter nytt `randomUUID`-filnavn per request (`upload.ts:133`), så hvert retry har distinkt `fileUrl`. Duplikater deler `vedleggId` (som ikke var persistert), ikke `fileUrl`. Beste proxy-telling for eksisterende dupes: `(doc_id, file_name, file_size)`. Migrerings-fella (constraint mot skitne data) er dessuten **omgått**: `@unique` på ny nullable kolonne — alle gamle rader er NULL (distinkt i Postgres), så ingen opprydding kreves før constrainten legges på. **Rest (egen, gatet op):** opprydding av eksisterende duplikat-rader i prod — «ALDRI slett eksisterende data», hvilken rad som overlever er ikke opplagt.


<!-- fra docs/claude/BACKLOG.md -->
### ✅ En deaktivert firma-admin beholder admin-rettigheter — LUKKET `fix/firmaadmin-status` 2026-09-08 (`erFirmaAdmin` status-gate)

**Måling (2026-09-08) korrigerte premisset:** de 15 route-lokale `verifiserFirmaAdmin`-wrapperne var IKKE selvstendige kopier — alle delegerte allerede til den delte `autoriserAdminForFirma` (`tilgangskontroll.ts:725`) → module-private `erFirmaAdmin` (`:312`). Kopiklassen var altså i praksis lukket; det fantes ingen 16-veis-uttrekk å gjøre. Den ekte enkeltkilden `erFirmaAdmin` leste `firmaRoller`, ikke `status` — hele hullet på ett sted. **Fiks:** la `status` i `erFirmaAdmin`s select og returnér `false` ved `deaktivert`. Dekker alle 4 interne kallere (`autoriserAdminForFirma`, `erFirmaAdminForProsjekt`, + to maskin-bypass `:1447`/`:1520`) og dermed alle 15 wrappere. `krevAktivAnsettelse` kunne IKKE gjenbrukes direkte (prosjekt-skopet via `primaryOrganizationId`; firma-admin-rutene har kun `organizationId`) — samme status-FAKTA som `hentBrukersOrg` gjenbrukes i stedet. AKTIV admin er uendret. Test: `tilgangskontroll.test.ts` (aktiv slipper, deaktivert-med-rolle nektes, sitedoc_admin kortslutter). Mobil har ingen egne firma-admin-ruter (kaller api). api 335→338.


<!-- fra docs/claude/BACKLOG.md -->
### ✅ Klient-utskrift: attachments-bilder rendres dobbelt, én gang brutt (Kenneth, prod 2026-08-15) — LØST av F2 (2026-08-20)

**Lukket 2026-08-20 (F2 / `feat/f2-fjern-klient-utskrift`).** Dobbeltrenderingen krevde `RapportObjektVisning` sin attachments-gren **og** `FeltVedlegg` samtidig — det skjedde kun i `apps/web/src/app/utskrift/**`, som nå er slettet. Den gjenværende klient-utskrift-flaten `sjekklister/skriv-ut/page.tsx` bruker **ikke** `FeltVedlegg`, så ingen dobbeltrendering gjenstår. (Original beskrivelse under.)

**Observert i prod** (BEF-002, Test prosjekt SiteDoc Røstbakken): over bildene står to **brutte bilde-ikoner** med filnavnene `IMG_1773940614053.jpg` og `IMG_1773943366962.jpg` — og rett under står de samme bildene rendret korrekt.

**Årsak — dobbeltrendering:**
- `RapportObjektVisning.tsx:314-328` (`case "attachments"`) rendrer objektets **`verdi`** som bildegrid
- `FeltVedlegg` i utskriftssiden rendrer feltets **`vedlegg`**

Samme bilder, to kodeveier. Og attachments-veien bygger src med `url.replace("/uploads", "")` (`:325`) — den laster ikke, derfor brutt-ikonet.

**Samme bug som arkivmalens funn 2** («attachments-bilder lå i `verdi`, ikke `vedlegg`», dokgen 08-14), men i klient-utskriften. Syvende utslag av repeater/attachments-modellen — se § «Repeater er systematisk feilbehandlet».

**Konsekvens:** et brutt bilde-ikon i en rapport som går til byggherre. Ikke datatap, men det ser ut som dokumentet mangler noe.

**Fiks:** avgjør hvilken vei som eier bilderenderingen, og fjern den andre. `FeltVedlegg` virker — attachments-casen bør trolig ikke rendre bilder i det hele tatt når vedleggene allerede dekkes.

⚠️ Rører **klient-utskriften**, ikke arkivmalen. Egen ordre; arkivmalen er ferdig og skal erstatte denne veien.


<!-- fra docs/claude/BACKLOG.md -->
### ✅ LØST 2026-08-26 (branch `fix/annotering-bildestorrelse`) — Mobil-annotering eksporterer 3,4 MB PNG — sprenger rapport-størrelsen (Del C, målt 2026-08-13)

> **[løst 2026-08-26]** `annoterings-html.ts:268` → JPEG q0.92 + hvit bakgrunn (var PNG q1). Målt (PIL, representativt 1920×1536-foto): PNG q1 **4516 KB** → JPEG q0.92+hvit **~1000 KB** (~4×). **Kvalitetsvalg begrunnet i strek-lesbarhet:** q0.85 gir 520 KB men nettleseren bruker 4:2:0 chroma-subsampling som gjør 3px-røde-streker uleselige (målt strek-fargefeil 105 mot 11 ved 4:4:4); q≥0.9 flipper til 4:4:4 (skarpe streker). Lesbarhet > filstørrelse (ordren). Multiplier urørt — input er alt ≤1920px komprimert vedlegg (ingen over-oppløsning). Hardkodet `.png`/`image/png` i lagringsstien (`BildeAnnotering.tsx`, `FeltDokumentasjon.tsx`) → `.jpg`/`image/jpeg`. ⚠️ Simulator-verifisering (visuell strek) gjenstår.


> **[triage 2026-08-26]** verifisert åpen — 🔴 BLOKKERER — én runde (mobil-PR): `annoterings-html.ts:268` `toDataURL(png, quality 1)` uten hvit bakgrunn/JPEG; rammer mobilkamera direkte → rapport for stor for e-post.

**Symptom:** Kenneths befaringsrapport (Lakselv Lufthavn, BEF-001) ble **12,8 MB** — for stor til å sende på e-post. Én annotert tegning står for mesteparten.

**Målt årsak:** `apps/mobile/src/components/BildeAnnotering.tsx` (Fabric-canvas i WebView, `apps/mobile/src/assets/annoterings-html.ts`) eksporterer annoteringen som **PNG med alfakanal** — `3,4 MB` der originalen var et `~400 kB` JPEG. PNG av et fotografi + full skjermoppløsning (`1206 × 2082`, mobilskjermens format med transparent marg rundt tegningen) blåser opp filen ~8×.

**Tiltak (egen mobil-PR — «Reload:»-plikt + koordinering med simulator-Opus):**
1. Sett hvit bakgrunn på canvasen før eksport: `canvas.backgroundColor = "#ffffff"` (fjerner alfakanal → ingen transparent/svart marg).
2. Eksporter som **JPEG** i stedet for PNG: `canvas.toDataURL({ format: "jpeg", quality: 0.85 })`. Da stemmer MIME med `.jpg`-endelsen som allerede sendes, og størrelsen faller til `400–600 kB`.
3. Send riktig filnavn/endelse fra flyten.

**Mål:** rapport under 5 MB. Mindre bilder gjør også Del D-ventingen kort i praksis — de to hører sammen.

**Merk:** feil MIME (PNG servert som `image/jpeg`) er rettet server-side i samme runde som Del D — se `fix/utskrift-sidebryt-svarte-tegninger` (Content-Type fra magic bytes i `server.ts`, endelse fra magic bytes i `upload.ts`). Det retter de fem eksisterende feilførte filene, men **Del C er det som hindrer at nye annoteringer blir så store**.



<!-- fra docs/claude/BACKLOG.md -->
### ✅ Mobil-typecheck RØD på develop — LØST 2026-07-30 (`fba830da`, branch `fix/mobil-typecheck-groenn`)

`pnpm --filter @sitedoc/mobile typecheck` var rød på ren develop — **11 ekte feil** (måling: 418 rå, men 407 var stale Prisma-gen-artefakter som forsvinner etter `prisma generate` ×4). Ryddet med kun type-korrektheter (ingen funksjonalitet rørt) → **exit 0**:
- `erstattVedlegg` deklarert i `UseOppgaveSkjemaResultat` + `UseSjekklisteSkjemaResultat` (var returnert + destrukturert, manglet kun i interface) — løste 4 feil.
- `hjem.tsx` + `sjekkliste/[id].tsx`: lean klient-cast av tRPC-output (dyp config-Json → TS2589/2345/2352), samme mønster fila alt brukte — 5 feil.
- `psi/[psiId].tsx` tom-tilstand `onLukk` (forslag A, Kenneth-avgjort) — 1 feil.
- `timerSync.ts` `aktivitetId ?? ""` (fullfører dokumentert `projectId ?? ""`-mønster mot `.notNull()`-kolonne, Kenneth-avgjort) — 1 feil (2 linjer).

**Rotårsaken var prosess:** [regel 10](SAMARBEIDSREGLER.md) krevde grønt `@sitedoc/web build` — **web only**. Mobil har aldri vært gatet, så gjelden vokste usett. **Regel 10 er nå utvidet:** mobil-typecheck er blokkerende (exit 0), med `prisma generate` ×4 som eksplisitt forsteg (ellers 400+ falske «any»-feil). Funnet opprinnelig av develop-Opus (negativ kontroll uoppfordret).


<!-- fra docs/claude/BACKLOG.md -->
### ✅ Mal-dualiteten er redundans, ikke to roller (redesign-Opus exit 2026-07-16) — LUKKET `fix/fjern-prosjektmaler` 2026-09-12 (vei b)

**Lukket med vei (b) — flata FJERNET (`fix/fjern-prosjektmaler`, Kenneth-vedtak 2026-09-12 kveld):** `[prosjektId]/maler` (+ `[malId]` + layout + `MalerPanel`) er fjernet og server-redirecter til `oppsett/produksjon/sjekklistemaler`. «Ny mal»-modalen (den stille `category="sjekkliste"`-tvangen) døde med flata. Dashbord-kort, nav-registeret (`dype-sider`/`useAktivSeksjon`) og krysslenken `brukIProsjekt` pekt om/fjernet. Malforvaltning bor nå kun på Oppsett › Produksjon (kategori-splittet, rikere). Aktive sjekklister har egen flate — visningsbehovet var dekket.

> **Rettet fra vei (a):** runde 87 (`feat/hent-fra-arkiv`) lukket denne med vei (a) — rendyrket `[prosjektId]/maler` til lese-og-bruk + reduserte `[malId]` til lesevisning. Kenneth så flata på test og snudde til vei (b) fordi den fortsatt blandet sjekkliste/oppgave/HMS i én liste og ikke gjorde noe Oppsett › Produksjon ikke gjør bedre.

**Mistanke fra den eneste som har sett begge flatene innenfra.** Del6b pkt 4 antok «arbeidsflate vs konfig» og leverte copy + kryss-lenker (`297f5670`). Hans vurdering etter å ha bygget dem: *«et plaster over redundansen, ikke en oppløsning»*.

Begge er prosjekt-scopet `ReportTemplate`-CRUD mot samme `trpc.mal.*`. `[prosjektId]/maler` er en **fattig** CRUD (kun navn + beskrivelse); `oppsett/produksjon/*maler` er den **fulle** (kategori-splittet, MalBygger, bibliotek, faggruppe).

**Cowork korrigerte én del av funnet.** Han antok at maler fra `[prosjektId]/maler` blir **kategoriløse** og faller utenfor de kategori-filtrerte oppsett-visningene. Målt: `category String @default("sjekkliste")` i `schema.prisma` — **ikke nullable**. Prisma påfører defaulten, så de vises i `sjekklistemaler`.

**Reell effekt i stedet:** flata **tvinger stille** `category="sjekkliste"` — den sender `{projectId, name, description}`, ingen category. Vil du lage en oppgavemal der, kan du ikke, og du får ingen tilbakemelding om hvorfor. `MalListe:293` filtrerer på `m.category === kategori`.

**Ekte fiks (utført 2026-09-12 via `fix/fjern-prosjektmaler`):** vei (b) — flata FJERNET med redirect (ikke vei (a); se rettelse i toppen av raden). **Mistanken om `MalBygger.tsx` er målt og avkreftet:** ingen duplisert malbygger-komponent finnes — alle flatene importerer samme `@/components/malbygger`. Redundansens rot var den fattige CRUD-flaten (nå fjernet), ikke byggeren.


<!-- fra docs/claude/BACKLOG.md -->
### ✅ LUKKET — Mobil ser ×N rader: `hentEndringerSiden` manglet «erstattet»-filter

> ✅ **LUKKET 2026-09-07 (cowork-måling).** Posten sto som «venter prod på Kenneths go» i nesten
> to måneder — **men begge commitene er i `main`** (`5c9d2070`, `87af7e5b`, verifisert med
> `merge-base --is-ancestor`), og `migrate deploy` kjører på hver prod-deploy. Filteret står i
> koden i dag (`dagsseddel.ts:4190-4192`, kommentar datert 2026-07-13).
>
> 🔴 **Go-en hadde allerede skjedd — ingen oppdaterte posten.** Dette er AM-1 fra kundemøtet
> 20.08 («splitt dobler timetall i mobil»), og den har stått som åpen P0 for piloten mens den var
> løst. **Sjette foreldede post cowork har fanget 06.–07.09 ved å måle framfor å relaye.**
>
> **Lærdom, samme som de fem andre:** en post som beskriver arbeid som gjenstår, må måles mot
> koden før den brukes — ikke leses som fasit.

**STATUS 2026-07-13 (historikk):** Fiks B implementert + test-verifisert. Commits: `5c9d2070` (filter + `sheet_rad_historikk`-tabell + MOVE-migrering) + `87af7e5b` (self-heal: bump `updated_at` på berørte sedler). **Test-bevis:** DB `49a7c839` = 3+2 live / 10 rader flyttet til historikk (ikke tapt); **M-1 PASS** (fresh full pull → 3/2) + **M-2 PASS** (stale enhet → normal delta-sync self-heal → 3/2 uten reinstall/wipe — self-heal-mekanikken bevist ende-til-ende); self-heal-bump bekreftet (`updated_at` = migreringstid). **Venter kun prod (begge migreringene) på Kenneths eksplisitte go.** Prod har trolig egne «erstattet»-rader som samme migrering rydder + self-healer.

**Rot (kodeverifisert + DB-bekreftet):** rediger-mutasjoner (`dagsseddel.ts:2816`, `3016`) merker overskrevne rader `attestertStatus="erstattet"` (+ `parentRadId`) som audit-spor. HVER leser filtrerer dem bort (`{ not: "erstattet" }`: aktiv-helper `394/403/456`, web-attestering `1835-1837`, hentForAttestering `1974`) — MEN **`hentEndringerSiden` (mobil-pull, `3487`) har `include: { timer: true, tillegg: true, maskiner: true }` UTEN filteret** → mobil trekker live + audit-rader. **DB-bevis** (seddel `49a7c839`, test, `client_uuid 78c106bc`): timer 3 live/9t + 6 «erstattet»/18t; maskin 2 live + 4 «erstattet». Web viser korrekt 3+2 (filtrerer); mobil-fresh-pull viste 9+6 (×3-illusjon). **Ikke** server-korrupsjon, **ikke** pull-reconcile, **ikke** S3. «Erstattet»-radene er **write-only** (grep: aldri positivt lest — ubrukt audit).

**Fare:** `syncBatch.createMany` setter ikke `attestertStatus` (default «pending») → hvis mobil pusher de lekkede radene tilbake, gjenoppstår audit-radene som LIVE → ekte server-korrupsjon + lønnsfeil. Latent (sedelen «sent» + web viser 3 → ikke rundtrippet). Potensielt prod-eksponert: en redigert sedel som delta-pulles til prod-mobil vil vise samme ×N.

**Vedtatt fiks (forener Kenneth-prinsipp «lagre rett» + ufravikelig «ALDRI slett eksisterende data»): B — flytt erstattet-rad til historikk-tabell ved rediger** i `2816`/`3016` (i stedet for å merke «erstattet» og la den ligge i hovedtabellen) → hovedtabell kun live → ingen leser trenger filter, og audit bevares. Migrering FLYTTER eksisterende «erstattet»-rader fra hovedtabellene til historikk (rydder bl.a. denne sedelen til 3+2 live — uten å slette data). `hentEndringerSiden`-filteret legges i SAMME PR som rulleringsvern (no-op etter migrering). **A (hard-slett) forkastet:** bryter «aldri slett data» uten eksplisitt unntak. Test-sedel `49a7c839` beholdes som regresjons-fixtur.


<!-- fra docs/claude/BACKLOG.md -->
### 🟢 LUKKET 2026-09-11 — Papirkurven mangler «Tøm» og masseslett — meldingen ber om en handling som ikke finnes (Kenneth, test 2026-08-18)

> **[LUKKET 2026-09-11]** Levert i `64d25131`: `tomPapirkurv`, `gjenopprettFlere`,
> `slettEndeligFlere` + avkryssing/«velg alle» i web. «Slett mal»-meldingen peker nå på en
> knapp som finnes. Se [backlog-maaling-2026-09-11.md](backlog-maaling-2026-09-11.md).
>
> **[triage 2026-08-26]** verifisert åpen — Skjemmer — noen runder: `papirkurv.ts` kun `slettEndelig({id,type})`; 0 checkbox/tøm i web; `mal.ts:387` ber «Tøm papirkurven først» uten at knappen finnes.

**Målt i koden:** `apps/api/src/routes/papirkurv.ts` har `hentForProsjekt`, `gjenopprett`
og **`slettEndelig` for ett dokument** (`{ id, type }`). Ingen tøm-alt, ingen
masseoperasjon. Web-siden har verken avkryssing eller samlehandling.

**Konsekvens:** Kenneth måtte slette **61 dokumenter én og én, med to klikk hver** — over
120 klikk — for å kunne slette en mal.

**Verre: «Slett mal»-meldingen sier «Tøm papirkurven først»** og antyder dermed en knapp
som ikke eksisterer. Det er ikke bare uklar tekst; det er en instruks produktet ikke kan
oppfylle.

**Bør ha:** «Tøm papirkurv» (med bekreftelse), avkryssing for flerslett, og at
mal-slettingen tilbyr handlingen direkte i stedet for å sende brukeren på leting.

⚠️ Slett-bekreftelse skal bruke ekte modal, ikke `confirm()` — se CLAUDE.md
§ UI-designprinsipper.


<!-- fra docs/claude/BACKLOG.md -->
### ✅ Tilkoblings-utmattelse — DB-kvoter + `connection_limit` UTFØRT 2026-07-09

Delt postgres har `max_connections=100`; adskilte databaser deler samme tak (klynge-nivå). Da redesign-stacken ble reist 2026-07-09 sprakk taket → `psql` avvist, timer-test feilet (maskert på web som «Dagsseddelen finnes ikke»). Bakgrunn + mekanikk + **zombie-rotårsak**: [infrastruktur.md § Delt postgres](infrastruktur.md).

- **Kvoter (utført — SQL):** `ALTER DATABASE sitedoc CONNECTION LIMIT 40;` · `sitedoc_test 25;` · `sitedoc_redesign 20;`. `tromsosalsaklubb` uten kvote (fallback, 0 tilkoblinger).
- **App-side `connection_limit` (utført — seks env-filer):** prod-api 7 (→28 med 4 klienter), prod-web 4, test-api 4 (→16), test-web 3, redesign-api 4 (→16), redesign-web 3 = **70 tak** av 97 brukbare. Kvoten ligger bevisst over app-taket → poolen **køer** (treg) i stedet for at DB **avviser** (ser ødelagt ut).
- **Målt etter:** 24 av 97 (mot 81 før).
- **Rotårsaken var zombie-backends, ikke pool-størrelse** — `connection_limit` alene ville ikke ha stoppet hendelsen. Se de to radene under.


<!-- fra docs/claude/BACKLOG.md -->
### ✅ salsaklubb: eget nett + egen postgres — UTFØRT 2026-07-09

Egen `postgres:16` (`salsaklubb-postgres`, tjenestenavn `postgres` slik at `DATABASE_URL` traff uendret), eget nett `salsanet`, volum `salsa_pgdata`, ingen host-port. Ingress gikk allerede via host-port `127.0.0.1:3200` + cloudflared, ikke via `appnet` → null nedetid. Frigjorde 10 tilkoblinger og fjernet lateral tilgang til SiteDocs postgres/api/ML. `sendfil` var mønsteret.

Sidefunn: salsaklubb hadde ingen volumer; `/app/public/uploads` lå i container-FS. Rebuilden under serverflyttingen 2026-06-10 slettet 68 MB opplastede filer (194 bilagsvedlegg + logo/hero/galleri). Gjenopprettet fra Kenspill, og bind-mount lagt inn. Dokumentert i salsaklubb-repoet (`4ecca74`). Kenspill skal ikke ryddes.

Gjenstår: gammel `tromsosalsaklubb`-DB i den delte klyngen er fallback — droppes kun etter eksplisitt beslutning.


<!-- fra docs/claude/BACKLOG.md -->
### ✅ `pauseBeregning.ts` duplisert (mobil + shared) — DEDUP GJORT develop 2026-07-10 (M2)

Etter bolk (a) fantes pause-beregningen to steder: `packages/shared/src/utils/pauseBeregning.ts`
(kanonisk, web brukte den via `@sitedoc/shared`) og en egen mobil-kopi som `TimerSeksjon.tsx`
importerte lokalt. `tilFraAntall`-grensefeilen (rad starter ved/inne i pausevindu → pausen
hoppes over, ikke lenger invers av `effektiveTimerFraSpenn`) ble fikset i shared (`10622ee3`,
bolk (e)), men mobil-kopien fikk aldri fiksen → reell, målt divergens.

**✅ GJORT (M2, develop 2026-07-10):** Målt divergens først med `diff` — mobil-kopien hadde
`fraMin >= pauseFraMin` der shared har `fraMin >= pauseSlutt`, og manglet
`Math.max(0, pauseFraMin - fraMin)`. Konsekvens: feil pausefradrag når raden startet ved eller
inne i pausevinduet. Eneste konsument var `TimerSeksjon.tsx` (`import { … } from "@sitedoc/shared"`
etter fiksen); den tidligere antakelsen om at `MaskinSeksjon` også importerte kopien var feil —
den henter bare `maskinBucketKapasitet`/`overstigerMaskinTak` fra shared. Importen redigert til
`@sitedoc/shared`, mobil-kopien slettet (0 gjenværende referanser). Metro-oppløsning bevist
(~9 andre `@sitedoc/shared`-importer i mobil). **Mobil-UI via neste EAS-batch.**


<!-- fra docs/claude/BACKLOG.md -->
### ✅ i18n-duplikat: `timer.glemtDag.tittel` — RE-VERIFISERT IKKE-DUPLIKAT 2026-07-06

**Opprinnelig påstand (2026-07-05):** `timer.glemtDag.tittel` skulle finnes to ganger i
`nb.json` (linje 42 «Gjenopprettet dag — estimert» + linje 57 «Glemte du å avslutte?»),
med badge-varianten død.

**Re-verifisert 2026-07-06 mot kode — påstanden er STALE, ingen duplikat:**
`grep '"timer.glemtDag.tittel"' nb.json` gir **ett** treff (linje 87 «Glemte du å avslutte?»);
`en.json` likeså (1 treff). Teksten «Gjenopprettet dag — estimert» finnes ikke lenger noe sted
i språkfilene. Alle 5 `timer.glemtDag.*`-nøkler (`tittel`/`hjelp`/`melding`/`glemte`/`jobberFortsatt`)
er unike og brukt i kode (`StartSluttDagKort.tsx:352`, `timer/[id].tsx:604` m.fl.). Duplikatet ble
ryddet mellom 2026-07-05 og 2026-07-06 (badge-verdien fjernet). **Ingen handling nødvendig.**

> **Sidefunn (egen sak under):** den eneste faktiske dupliserte JSON-nøkkelen i nb+en er
> `sok.placeholder` (to ganger, ulike verdier) — se posten «i18n-duplikat: `sok.placeholder`» rett under.


<!-- fra docs/claude/BACKLOG.md -->
### ✅ i18n-duplikat: `sok.placeholder` — FIKSET 2026-07-06 (develop)

**Var:** `sok.placeholder` fantes to ganger i både `nb.json` og `en.json` (linje 59 «Søk etter
innstillinger og sider …» + linje 827 «Søk i prosjektdokumenter...»). JSON lot den **siste**
(827) vinne → global `SokModal.tsx:114` viste feil placeholder «Søk i prosjektdokumenter...»,
mens doc-søk-siden `dashbord/[prosjektId]/sok/page.tsx:131` var korrekt (tilfeldigvis).

**Fiks (nb+en + én kode-linje):** doc-søk-verdien på linje 827 omdøpt til distinkt nøkkel
**`sok.dokumentPlaceholder`** (flat camelCase — matcher doc-søk-blokkens konvensjon `sok.aiSok`/
`sok.tekstsok`/`sok.skrivInnSokeord`, ikke det nestede `sok.dokumenter.*` som ikke finnes ellers).
`sok/page.tsx:131` peker nå på `sok.dokumentPlaceholder`; `sok.placeholder` (linje 59) beholdt for
global `SokModal`. **`generate.ts` ✅ kjørt 2026-07-09 (`466a921e`)** — 13-språk-gapet lukket (se
i18n-status-raden rett under).


<!-- fra docs/claude/BACKLOG.md -->
### ✅ i18n 13-språk-generering kjørt 2026-07-09 (`466a921e`) — sq-reoversetting + gap lukket

`generate.ts` kjørt på develop etter at i18n-frysen ble løftet (redesign fullt merget —
jf. [parallell-arbeid-lock.md regel 3/9](parallell-arbeid-lock.md)). Resultat: **alle 15 språk
= 2811 nøkler**, 33 manglende nøkler fylt (28 pre-eksisterende gap + de nye timer-paritet-nøklene
`timer.feil.ingenProsjekt`/`timer.detalj.aapnetEksisterende`/`timer.vedlegg.laster`), og
**pauseFra-relikvier ryddet**. Lukker: **13-språk-gapet** (tidligere `generate.ts IKKE kjørt` over)
+ **sq-reoversetting** (sporet i STATUS-AKTUELT tråd 4 — `sq.json` regenerert i samme kjøring).

- **🟡 Gjenstår: manuell QA av fagtermer** i de 13 maskinoversatte språkene — `generate.ts` sier
  selv «kjør manuell QA på fagtermer». Sjekk særlig **dagsseddel, lønnsart, faggruppe, byggeplass**
  (domene-spesifikke termer Google Translate ofte bommer på). Ikke-blokkerende.


<!-- fra docs/claude/BACKLOG.md -->
### 🔴→✅ Prod mangler nivå-1 lønnsart-seed (A.Markussen) — funn 2026-07-09, LØST 2026-07-10

> **[triage 2026-08-26]** 🟢 verifisert LØST — `importerTimerKatalog` kjørt mot prod 2026-07-10 (26 opprettet, stjerne km→`120`); mekanisme + logg bekrefter (prod-DB ikke inspisert herfra).

**✅ LØST 2026-07-10:** `admin.importerTimerKatalog` kjørt mot prod-org (A.Markussen) etter deploy `373a109f` — `dryRun: false` + `deaktiverUmatchedeLonnsarter: false`. Resultat: 26 opprettet, 12 oppdatert (alias festet `kode`, ingen dubletter), 0 deaktivert; rekkefølge-fella håndtert (`nullstiltStandardvalg: 1` → stjerne flyttet km→`120`, `standardKodeSatt: 120`). `dryRun`-tørrkjøring bekreftet match-veien først. Km-stjerna og 0-kode-radene er borte; ordinær timelønn/overtid finnes nå. 14 legacy-rader beholdt aktive (Kenneths valg — ryddes manuelt). Detaljer: [STATUS-AKTUELT § Lønnsart/katalog-import](STATUS-AKTUELT.md). Historikk under, opprinnelig funn bevart:

`seedLonnsartNivaa1` (16 lønnsarter: grunnlønn + overtid + 12 fraværstyper) er aldri kjørt for A.Markussens org. Kun nivå 2 (25 rader) finnes i prod (`seed_nivaa=2`, 0 med `kode`). Ingen ordinær timelønn, ingen `Overtid 50%`/`100%` → arbeider kan ikke føre ordinære timer/overtid med riktig lønnsart, PowerOffice-eksport umulig.

**Rekkefølge er kritisk** — `seedLonnsartNivaa1` setter `erStandardvalg: rad.navn === "Timelønn"` via `createMany` **uten å nullstille andre rader**. Kjøres den mens km har stjerna, får firmaet **to** rader med `er_standardvalg = true` («maks én per org» håndheves kun i `timer.lonnsart.settStandard`, ikke i seeden). Riktig sekvens: (1) fjern stjerna fra `Kilometergodtgjørelse (egen bil)`, (2) opprett/oppdater rader, (3) sett stjerna på riktig ordinær lønnsart — for A.Markussen `120 Timer` (SmartDok-speiling; firmaet har ingen «Timelønn»), generisk «laveste tidbaserte ordinær» for andre firma. Implementeres via generisk `importerKatalog` (`apps/api/src/services/katalog/`) + kunde-fixture + tRPC `admin.importerTimerKatalog` (bak `verifiserSiteDocAdmin`) — idempotent på `kode`, tørrkjøring (`dryRun`) på `sitedoc_test` før prod. Prinsippet «koder aldri i seeden» beholdes: kundedata er fixture, ikke kode.


<!-- fra docs/claude/BACKLOG.md -->
### ✅ Org uten standard-lønnsart (③b) — IMPLEMENTERT PÅ DEVELOP 2026-07-05 (web klar for prod, mobil venter EAS-batch)

Data-backfill garanterer nå at hvert firma med ≥1 ordinær lønnsart har en standard (migrering `20260705120000_lonnsart_overtidsnivaa`: foretrekk `Timelønn` seedNivaa=1, ellers laveste-rekkefolge ordinær; kun orgs som mangler standard, NOT EXISTS-guard). Auto-gen gjetter aldri (= B) — standard kommer fra `erStandardvalg`, korrigerbar i firma-konfig. F-G rød banner beholdes for null-ordinære-lønnsarter-tilfellet. Full detalj: [STATUS-AKTUELT § Timer auto-lønnsart ③](STATUS-AKTUELT.md) + [timer.md § Overtid-klassifisering](timer.md). ⚠️ **Presisering 2026-07-09:** backfillen garanterer at feltet er *satt*, ikke *riktig* — Steg 2 velger laveste-`rekkefolge` aktiv `type="ordinaer"` (posisjon, ikke betydning). I prod ga det A.Markussen `Kilometergodtgjørelse (egen bil)` som standard arbeidstime-lønnsart. Se § «Standard-lønnsart plasseres deterministisk feil» over.


<!-- fra docs/claude/BACKLOG.md -->
### ✅ Auto-overtid matchet feil lønnsart på navn (③a) — IMPLEMENTERT PÅ DEVELOP 2026-07-05 (web klar for prod, mobil venter EAS-batch)

Navne-regexen (`/overtid/i && /50/`) erstattet med strukturert `Lonnsart.overtidsnivaa` (Int?, nullable). Overtid velges nå via `velgOvertidLonnsart` (type=ordinaer + `overtidsnivaa`-match, aldri fritekst-navn); lærling-varianter beholdes `overtidsnivaa=null` i backfill → aldri auto-valgt for normal arbeider (kjernen i bugen). Backfill KUN seed-navn (`Overtid 50%`→50, `Overtid 100%`→100, seedNivaa=1); lærling + kunde-importerte (A.Markussens 170/172/175/177) settes manuelt i web admin-UI. Fallback: amber banner når firmaet mangler overtid-lønnsart (aldri feil-match, aldri stille drop). Klassifiserings-regelen isolert i `@sitedoc/shared` [lonnsregel.ts](../../packages/shared/src/utils/lonnsregel.ts) (forward-compat, se § Lønnsregel-konfig under). Full detalj: [timer.md § Overtid-klassifisering](timer.md).


<!-- fra docs/claude/BACKLOG.md -->
### ✅ Geofence-editor uoppdagbar — LØST + DEPLOYET TIL PROD 2026-07-04 (`b1c81629` i `bb5aec05`)

Fanget 2026-06-24: verken Kenneth eller kontroll-Claude fant geofence-editoren i web selv med steg-for-steg. Tre lag feil veivisning i `apps/web/src/app/dashbord/oppsett/byggeplasser/page.tsx`: (1) `bygning.opprett`-suksess kaster brukeren rett inn i fullskjerm tegnings-editor (`setRedigerLokasjonId`, :798) — ser ut som hovedflyten, men geofence er ikke der; (2) geofence-seksjonen ligger nederst i **«Endre navn»**-modalen (:1178–1309), åpnet av knapp med **Copy-ikon** + `t("lokasjoner.endreNavn")` — feil ikon + misvisende label; (3) modalen vises kun etter at en byggeplass er markert, og «Rediger» (blyant) åpner i stedet tegnings-editoren (motsatt av forventning). **Fix:** egen synlig «Geofence/Georeferanse»-handling på markert byggeplass, ikke auto-åpne tegnings-editor ved opprett, rett Copy-ikon/label.

> ✅ Implementert (`b1c81629`, egen synlig «Geofence»-knapp + rett ikon/label + ikke auto-åpne tegnings-editor) + deployet til prod 2026-07-04 (`bb5aec05`). Arkiv: [historikk-2026-07.md](historikk-2026-07.md). **Ny relatert bug oppdaget samtidig — se § Geofence-modal Leaflet under.**


<!-- fra docs/claude/BACKLOG.md -->
### Geofence-modal: Leaflet-kart laster kun hjørne-fliser ✅ DEPLOYET TIL PROD 2026-07-04 (`6178034f` i `0801af38`)

Rotårsak i delt `KartVelger` (native `<dialog>`-Modal → `L.map()` init med 0×0-container ved mount). Fiks: `ResizeObserver` → `invalidateSize()` ved modal-open, `disconnect()` i cleanup. Full detalj: [historikk-2026-07.md § Prod-deploy 2026-07-04 (kveld) PR 2](historikk-2026-07.md).


<!-- fra docs/claude/BACKLOG.md -->
### ✅ «Opprett firma» (sitedoc_admin) fungerer ikke — DEPLOYET TIL PROD 2026-07-04 (`6de25024` i `bb5aec05`)

**Rotårsak (1a):** CREATE↔LISTE-mismatch på `erKunde`. `admin.opprettOrganisasjon` (`admin.ts:156`) satte kun `name`+`organizationNumber` → `erKunde` falt til schema-default `false`, og `hentAlleOrganisasjoner` filtrerer `where: { erKunde: true }` (`admin.ts:109`, bevisst — skiller kundefirma fra skall-/faggruppe-firma). Firmaet *ble* opprettet (DB-rad), men filtrert bort fra lista → så «ut som» det ikke skjedde. Ikke stille server-feil, ikke refetch-bug, ikke deploy-drift (prosedyren er fra 2026-03-07; invalidering verifisert korrekt wiret). **Fiks:** `opprettOrganisasjon` setter nå `erKunde: true`. **(1b) var IKKE bug:** Brønnøysund-knappen er korrekt `disabled` til org.nr er 9 siffer (`firmaer/page.tsx:309`+`:91`); server (`brreg.ts`) fullt wiret — kun dårlig synlighet, adressert med `title`-tooltip (`brreg.hint`). I tillegg lagt `onError`+feilvisning på opprett-mutasjonen (defensiv — stille feil var i seg selv en mangel). #2 «kan ikke opprette prosjekt uten eksisterende firma» er fortsatt **IKKE bug** (firma-påkrevd, låst 2026-05-20, anti-orphan).

**Åpen oppfølger — prod-orphan-opprydding (Kenneths prod-DB-hånd):** Firma opprettet via modalen FØR fiksen er `erKunde: false` → forblir usynlige (fiksen gjelder kun nye). Blanket-backfill forbudt (ekte skall-firma *skal* være `false`). Read-only diagnose-SQL klar (teller `proj_orgs`/`primary_proj`/`avdelinger`/`moduler`/`members` per `erKunde=false`-firma; ekte orphans = alt 0, typisk navn «Sitedoc»). Kjøres mot prod `sitedoc` → Opus verifiserer trygge rader → Kenneth flipper smalt (`erKunde=true` på spesifikk id, blir synlig i UI) eller sletter.


<!-- fra docs/claude/BACKLOG.md -->
### 🔒 SheetMachine.vehicleId org-validert (§2.D) ✅ DEPLOYET TIL PROD 2026-07-04 (`90469dc7` i `0801af38`)

Pre-eksisterende cross-firma-lekkasje-klasse (åpen siden 2026-06-09): `SheetMachine.vehicleId` (maskindrift) ble skrevet uten org-validering. Fiks: `verifiserKjoretoyTilhørerFirma` på alle fem input-baserte skrive-stier (`maskin.tilfoy`/`maskin.oppdater`/`redigerSedelRader`/`splittRad`/`syncBatch`). Full detalj: [historikk-2026-07.md § Prod-deploy 2026-07-04 (kveld) PR 1](historikk-2026-07.md).


<!-- fra docs/claude/BACKLOG.md -->
### 🟢 LUKKET 2026-09-16 — `apps/mobile` test-runner + `splittVedMidnatt` dekket

**Levert i runde mobil-harness.** vitest innført i `apps/mobile` (IKKE flyttet til `@sitedoc/shared`
— hele poenget var at mobil skal kunne teste sin egen kode). `splittVedMidnatt` dekkes nå av
`apps/mobile/src/utils/dagsegment.test.ts` med nøyaktig de spesifiserte casene: **nattskift
19→07 = 5t+7t=12t** · **dagskift** (1 segment) · **degenerert** (slutt ≤ start → ett 0-segment) ·
**fler-døgn** (N segmenter, sum = total). I tillegg dekkes `kappGlemtDagSlutt` (glemt-dag-cap).
Negativ kontroll kjørt (bryt → rød → tilbakestill).

<details><summary>Opprinnelig sak (historikk)</summary>

`apps/mobile` hadde ingen test-runner (verken `test`-script, jest/vitest-config eller `*.test.ts`). Rene, logikk-tunge hjelpere var derfor udekket av automatiserte tester. Konkret fanget ved Slice 4a (2026-06-20): **`splittVedMidnatt`** (`apps/mobile/src/utils/dagsegment.ts`) ble kun manuelt verifisert (tsx-kjøring). Casene som bør dekkes: **nattskift 19→07 = 5t+7t=12t** (sum = reell total), **dagskift** (1 segment, uendret), **degenerert** (slutt ≤ start → ett 0-segment), **fler-døgn** (glemt-dag → N segmenter, sum = total).

</details>


<!-- fra docs/claude/BACKLOG.md -->
### Metro blockList — `.env.eas.local` knekker `expo run:ios` ✅ FIKSET 2026-07-06 (venter dual-review)

`apps/mobile/.env.eas.local` (credential-fil, gitignored) ligger i prosjektroten og overvåkes av Metro (`metro.config.js` har `watchFolders` = hele monorepoet, men **ingen `resolver.blockList`**). Ved `expo run:ios` kan Metro forsøke å bundle/lese fila → bygg-brudd. **Fikset i web-runde s1 (2026-07-06):** `config.resolver.blockList += /\.env\.eas\.local$/` (additivt til Expos defaults) i `metro.config.js`. I arbeidstreet, venter dual-review/commit.


<!-- fra docs/claude/BACKLOG.md -->
### ✅ Navigasjonsredesign — dev-login secrets-oppsett (Kenneth) — UTFØRT 2026-07-06

Dev-login (agent-testing, Nivå A+B) **verifisert grønn i iOS-simulator 2026-07-06**. Secrets satt (aldri i git): (1) `ENABLE_DEV_LOGIN=true` + `DEV_LOGIN_SECRET` i `docker/env/api-test.env`; (2) testbrukere seedet mot `sitedoc_test`; (3) `EXPO_PUBLIC_DEV_LOGIN_SECRET` i lokal `.env` for simulator (EAS-secret for TestFlight-knapp gjenstår, ikke blokkerende). **Simulator-transport:** localhost-port-forward (`ssh -N -L 3301:localhost:3301 server-ny` + `expo prebuild --clean`), IKKE Cloudflare-edge/Tailscale-IP. **Rotårsaks-kjede (3 ledd):** Cloudflare-kant droppet RN-fetch → iOS Local Network-privacy blokkerte private adresser → container kjørte **stale `DEV_LOGIN_SECRET`** (recreate api+web løste siste ledd). Full oppskrift: [dev-login-agent.md § Simulator/lokal dev](dev-login-agent.md) + [DOCKER-NOTES punkt 8](../../docker/DOCKER-NOTES.md). Steg v-retesten (rebuild api+web + `seed-oversettelse-test.ts`) gjenstår separat.


<!-- fra docs/claude/BACKLOG.md -->
### ✅ U-flyt UF-0 PÅ DEVELOP (2026-06-22): duplikat-dagsseddel fikset + helper-konsolidering

- **✅ Duplikat-dagsseddel fra `+ Ny`-skjermen — FIKSET i UF-0.** `lagre()` i `ny.tsx` inserterte tidligere alltid en ny `dagsseddelLocal` med fersk UUID uten `(userId, dato)`-sjekk → server `@@unique([userId, dato])`-kollisjon → sync-stuck (`syncStatus: pending` som aldri lykkes) + tom attestering. **Løst** ved delt `finnEllerOpprettDagsseddel`-helper (`apps/mobile/src/services/dagsseddelOpprett.ts`): `ny.tsx` ruter nå gjennom find-or-open og `router.replace` til eksisterende sedel når dagen finnes (subtil notis + bevart prosjekt-valg via `nyttProsjekt`-param).
- **✅ To-inngangspunkt-konsolidering — GJORT i UF-0.** Begge veier til ny dagsseddel (manuell `+ Ny` og auto-draft via `opprettDagsseddelForSegment`) ruter nå gjennom samme helper: idempotens per `(userId, dato)` + org-backfill (`organizationId = orgId`, ikke `""`) + arbeidstid-prefill ett sted. `opprettDagsseddelForSegment` refaktorert atferdsbevarende (returnerer fremdeles eksisterende uten append — append er UF-1).

- **✅ Tastatur-avoidance — FIKSET 2026-06-22.** Skjemaet skjøv ikke fokusert felt + Lagre-knapp over tastaturet. Løst ved app-standard `KeyboardAvoidingView` + `ScrollView keyboardShouldPersistTaps="handled"` (mønster fra `sjekkliste/[id].tsx`, ingen ny avhengighet) i alle fem skjemaer: TimerRadModal, MaskinRadModal, TilleggRadModal, `ny.tsx`, RedigerArbeidstidModal. + `keyboardShouldPersistTaps` på velger-modalenes FlatList (fjerner dobbelt-trykk-papercut).
- **✅ Lønnsart-på-Ny-skjerm (UX) — AVKLART 2026-06-22.** Forventet oppførsel: lønnsart er et **per-rad**-attributt (én sedel har typisk flere lønnsarter: timelønn + overtid + reise), og `ny.tsx` lager etter UF-0 kun et tomt sedel-skall uten rader. Valgt løsning (Del 2-A): kort grå hint på Ny-skjermen — `timer.lonnsartHint` («Lønnsart velges per timer-rad inne på sedelen») — i stedet for å legge en misvisende «én lønnsart for hele dagen»-velger på opprettelses-steget.
- **🟡 Topp-sum farge-paritet-gap web vs mobil.** Web topp-sum bruker flat `OrganizationSetting.dagsnorm`, mobil bruker sesongjustert `effektiv.dagsnorm` (kalender-cache m/ sommertid-overstyring) → for firmaer med sesong-dagsnorm kan grønn/gul/blå-grensa avvike mellom web og mobil. Krever et server-endepunkt som eksponerer sesongjustert dagsnorm (per org, dato) til web for full paritet.
- **🟡 Sync-gift-isolasjon (fiks A) — oppfølger: 403/FORBIDDEN klassifiseres transient.** `erPermanentFeil` (`timerSync.ts`) regner kun `400` som permanent; `403` (f.eks. hvis Timer-modulen deaktiveres for org-en mid-bruk → `krevTimerAktivert` kaster FORBIDDEN før per-item-loopen) klassifiseres transient → push retry-er hele batchen hver tick uten å komme videre (tick-retry-stall, men ingen datatap). Vurder eget «permanent-uten-quarantine»-spor (stopp tick + synliggjør «sync blokkert: <årsak>» uten å quarantine sedlene).
- **✅ UF-4 (recall) — IMPLEMENTERT 2026-06-22 (server + mobil).** Ny tRPC-mutasjon `timer.dagsseddel.gjenaapneDagsseddel`: eier-only (`hentEgenDagsseddel`), KUN `status="sent"` (`accepted` → tydelig feil «kontakt leder»), `sent→draft` + nullstiller ALLE rad-attestasjoner til `pending` (speiler re-send-etter-retur-mønster; permanent audit i Activity-tabell). Leder-kø (`hentTilAttestering`/`hentTilAttesteringFirma`, filtrerer `status="sent"`) tømmer seg automatisk; race håndtert (leder rekker accept → guard blokkerer recall). Mobil: online-only «Gjenåpne for redigering»-knapp på sent-blokk i `[id].tsx`. **Ingen migrering** (eksisterende enum-verdier). **Krever server-deploy til test for ende-til-ende-verifisering.**


<!-- fra docs/claude/BACKLOG.md -->
### Split-identitet MS-login (web↔mobil) — ✅ DEPLOYET TIL PROD 2026-07-04 (`bb5aec05`)

**Fix A (case-insensitiv `getUserByEmail`) + gate-innstramming (web+mobil) + sak #3 (KMY-duplikat B→A) er deployet og utført.** Full rot-årsak + implementasjon + datafiks arkivert til [historikk-2026-07.md § Prod-deploy 2026-07-04](historikk-2026-07.md). Kort: to `users`-rader for én MS-konto (mobil Graph-`/me.id` vs web id-token-`sub` → ulik `provider_account_id`; + case-sensitiv `getUserByEmail`). Konsolidering utført 2026-07-04 (begge MS-kontoer flyttet til A `f2d473b9`, e-post → `kenneth@sitedoc.no`, B `3a3c6272` arkivert `can_login=false`). Diagnostikk-SQL: `scripts/diag-kmy-web-bug.sql`.

**Gjenstår (åpne oppfølgere):**

**🟡 Sak #4 — normalisér e-post ved skriving (belt-and-suspenders):** Alle skrivestier bør lagre e-post lowercase (mobil `mobilAuth.ts:60` skriver rå Graph-case i dag; web PrismaAdapter likeså). Så lesestier ikke er avhengige av `mode: "insensitive"`. Krever backfill av eksisterende blandet-case-rader (migrering av `users.email`). Slår sammen med den eldre «User.email-normalisering»-oppfølgeren under.

**✅ Sak #5 — firma-ansatte ser eget firma — DEPLOYET TIL PROD 2026-07-04 (`6dbc884a` + PR 4 `179b86f9`, i `0801af38`):** Dobbel-kilde firma-kontekst (`hentMineMedlemskap` beriket + `kanAdministrereFirma`-gating på firma-admin-flater) + maskin opprett/import-gating. Full detalj: [historikk-2026-07.md § Prod-deploy 2026-07-04 (kveld) PR 3-4](historikk-2026-07.md).

**✅ Maskin-velger i dagsseddel-modal — søk + kategori-filter + sortering — IMPLEMENTERT PÅ DEVELOP 2026-07-05 (web klar for prod, mobil venter EAS-batch):** Delt web-komponent `MaskinVelger` (`apps/web/src/components/timer/MaskinVelger.tsx`, `SearchInput` + kategori-chips + sortering brukt-på-seddelen→internNummer→navn) på alle fire callsites + mobil `EquipmentVelgerModal` utvidet med chip-rad + sortering. Full detalj: [STATUS-AKTUELT § Maskin-dagsseddel Del 1+2](STATUS-AKTUELT.md) + [timer.md § Maskin-velger](timer.md).

**✅ Maskin ≤ arbeidstimer-avhengighet — gjort proaktiv (b+disable) — IMPLEMENTERT PÅ DEVELOP 2026-07-05 (web klar for prod, mobil venter EAS-batch):** Inline kapasitet-linje + Lagre-disable i maskin-modalen (web + mobil), drevet av delt regel `packages/shared/src/utils/maskinKapasitet.ts` som serveren `validerMaskinUnderArbeid` nå også delegerer til (null divergens). Full detalj: [timer.md § Maskin ≤ arbeidstimer](timer.md). (Åpent skille `utleie_enhet` time vs døgn — se § lenger ned — er urørt av denne; regelen bruker fortsatt sedel-pause-buffer for alle maskiner.)

**🟡 Gradert tidligere-ansatt-tilgang (framtidig, døra holdes åpen):** Gate-innstrammingen over betyr at en bruker fjernet fra *alle* firma/prosjekt fortsatt beholder **pålogging** via koblet konto (unntak (c)), men mister alt **innhold** (ingen medlemskap → tomme lister). Det er akseptabelt nå. Framtidig Timer-modul-funksjon: gi en org-løs *tidligere ansatt* **scoped** tilgang til egne timer (lønns-/dokumentasjonsbehov etter sluttdato), uten firma/prosjekt-innsyn. Henger på org-isolasjon + Proadm-lønnsflyt — ikke levert av denne PR. Merk: «avvis fjernet-fra-alt» gjelder fortsatt **aldri-innloggede** orphans (ingen koblet konto).


<!-- fra docs/claude/BACKLOG.md -->
### H3 — `allowDangerousEmailAccountLinking` reversert + signIn-guard — ✅ DEPLOYET TIL PROD 2026-06-05

✅ Arkivert til [historikk-2026-06.md § OAuth-innlogging: account-linking + orphan-guard + duplikat-opprydding](historikk-2026-06.md).

**Kort:** `allowDangerousEmailAccountLinking` reversert fra `false` (H3-audit 2026-05-27, prod-merge `9ca0257e`) til `true` (prod-merge `e12355d9`) — lar Google/Microsoft logge inn på samme konto via e-post; trygt fordi begge IdP-er verifiserer e-post-eierskap. Samtidig lagt til en **blokkerende `signIn`-guard** (`f6522a94`) som hindrer uinviterte pålogginger i å opprette tomme orphan-kontoer (a/b/c/d-regler, verifisert på test at `return false` hindrer User-opprettelse).

**Merknad — `User.email` er globalt unik** (`@unique`, ikke composite). `getUserByEmail`-overstyringen bruker `findFirst` med `canLogin=true` + eldste-først for determinisme.

**Mobil-guard** (`91fa7867`, prod-merge `f3a16cef`, 2026-06-05): tilsvarende orphan-guard lagt til i `mobilAuth.byttToken` med samme a/b/c/d-regler → `TRPCError FORBIDDEN` ved ingen match. **Både web- og mobil-OAuth er nå dekket.** (Account-linking på mobil håndteres allerede i `byttToken` via account-koblingen — ikke samme PrismaAdapter-mekanisme som web.)


<!-- fra docs/claude/BACKLOG.md -->
### Sikkerhets-audit 2026-05-27 — alle høy-prio funn lukket ✅

Alle 14 funn fra sikkerhets-audit 2026-05-27 er adressert i prod. Se [historikk-2026-05.md](historikk-2026-05.md) for full arkiv.

| Funn | Prod-merge | Arkiv |
|---|---|---|
| K1 + M2 + M3 + M4 + H3 + error-håndtering | `9ca0257e` | [§ Sikkerhets-audit-bunke](historikk-2026-05.md) |
| M1 (global tRPC-rate-limit) | `54885eb2` | [§ M1](historikk-2026-05.md) |
| H2 (case-sensitive invitasjon-match) + Fastify-logger | `b97494cd` | [§ Fastify-logger + H2](historikk-2026-05.md) |
| H1 (mobil token-rotasjon) | `29bdded8` + fix `43460d80` | [§ H1](historikk-2026-05.md) |

**Sekundære oppfølgere (ikke kode-fix):**
- Sjekk eksisterende serverlogger for token-lekkasje før M4-redaction ble aktivert. Manuell loggevurdering.
- Permanent `deploy-test-cron.sh` → `pnpm build --force`-fiks. Server-side skript, ikke i repo. Rammet 3+ ganger i mai 2026, krever manuell `pnpm build --force` per deploy. Bør prioriteres for å redusere friksjon.
- **User.email-normalisering** (oppstått fra H2 2026-05-27) — PrismaAdapter + Auth.js OAuth-flyt skriver `User.email` med casing fra provider. To brukere med samme lowercase-e-post men ulik case kan eksistere som separate rader pga `@unique` er case-sensitive. **Materialisert 2026-07-04** (split-identitet KMY, se § Split-identitet MS-login over) — Fix A (case-insensitiv `getUserByEmail`) demper leseren, men skrive-normalisering + backfill gjenstår (sak #4 samme sted). Bredere refaktor som krever migrering av `User.email` + adapter-override + verifisering av Google/Microsoft OAuth-flyt.


<!-- fra docs/claude/BACKLOG.md -->
### Refaktor: web-tRPC-route — DEPLOYET TIL PROD 2026-05-27 (prod-merge `77e6553d`)

✅ Implementert via `lagContextStamme`-helper (Alternativ 1). Arkivert til [historikk-2026-05.md § lagContextStamme + B5](historikk-2026-05.md).

**Tilleggsforslag fortsatt åpent:** Server-side `deploy-test-cron.sh` skal feile hard på `pnpm build` exit ≠ 0 og IKKE kjøre `pm2 restart`. CLAUDE.md har regelen (commit `95ff4a07`), men cron-skriptet er server-side og ikke i repo. Krever manuell oppdatering av skriptet på `sitedoc`-serveren.


<!-- fra docs/claude/BACKLOG.md -->
### Mobil hentMineMedlemskap — tom for sitedoc_admin + standalone-brukere — ✅ FIKSET + verifisert (build #29, 2026-06-02)

**Oppdaget 2026-06-01**, fikset + verifisert i TestFlight build #29 2026-06-02. Rotårsak: klienten gatet prosjekt-lasting på valgt firma (`enabled: !!valgtFirmaId`) → 0-firma-/uvalgt-firma-bruker hang på evig «Henter prosjekter…». Fiks: server-fallback (prod-merge `21555a5c`) + klient-fiks (`9e1bbf02`). Arkivert til [historikk-2026-06.md § Mobil hentMineMedlemskap-bug](historikk-2026-06.md).

**To-sporet problem:**
1. **Design-svakhet (bekreftet):** `organisasjon.hentMineMedlemskap` returnerer `[]` for brukere uten OrganizationMember-rad. Rammer brukere invitert via ProjectMember-bare og brukere på standalone-prosjekt. Mobil-flyten gater alle prosjekt-spørringer på `valgtFirmaId` → tom hjem.
2. **Sitedoc_admin runtime-mismatch (ikke avdekket):** Kenneth er sitedoc_admin, server skal returnere 3 firmaer, men klienten ser 0. Token er ferskt, endepunkt deployet, mobil-koden i build #27 = dagens develop. Krever enhets-logger fra build #28.

**Plan:**
1. Server-fiks: utvid `hentMineMedlemskap` til å inkludere `Organization` via `ProjectMember → Project.primaryOrganizationId` når `OrganizationMember.count === 0`. Konkret kode-skisse i STATUS-AKTUELT.
2. Diagnose-logging i `FirmaKontekst.tsx:71-78` (`console.log(firmaerQuery.data/error/isLoading)`) for build #28.
3. Begge endringer i samme PR til develop → server-fiks deployes til prod separat → mobil-bygg #28 til TestFlight.
4. Etter rotårsak avdekket fra enhets-logger: konkret runtime-fiks i oppfølger-PR.

**Bi-funn:** «Ukjent bruker»-meldingen ved utlogging (`mer.tsx:248`, `bruker?.name ?? "Ukjent bruker"`) er forventet kortvarig fallback når `setBruker(null)` rendres før navigation. Ikke en bug.


<!-- fra docs/claude/BACKLOG.md -->
### HMS-modul redesign — DEPLOYET TIL PROD 2026-05-26/27 (prod-merge `69068ba0` + fix `c1fbc19f` + åpen-synlighet `c0c00374`)

✅ **Implementert.** HMS-modul-seeding (`dd491081`) + HMS-prosjektvisning (`69068ba0`) + subdomain-fix (`c1fbc19f`) + åpen-synlighet (`c0c00374`) dekker hele specen + synlighet-oppfølgeren. Detaljer i [historikk-2026-05.md § HMS-prosjektvisning](historikk-2026-05.md) + [§ HMS åpen-synlighet](historikk-2026-05.md).

**Status per del:**
- Modul-seeding: HMS-gruppe + HMS-flyt + mal-koblinger ✅
- SJA + RUH-maler i `PROSJEKT_MODULER` med subdomain/synlighet ✅
- HMS-spesialrute i `sjekkliste.opprett` (speil av `oppgave.opprett`) ✅
- Synlighet per mal (`hmsSynlighet: "privat" | "apen"`) + tilgangskontroll i `hms.hentDokumenter` (privat) og `verifiserDokumentTilgang` (åpen) ✅
- Mal-builder UI for subdomain + synlighet ✅
- HMS-prosjektvisning med KPI + 4 tabs + statistikk ✅
- Sidebar-element gated på `hms-avvik` ✅
- Fix-migrasjon for prefix-baserte subdomains (SJA/RUH som var feilklassifisert som avvik etter PR 1) ✅
- Prod-backfill kjørt for alle 3 HMS-aktive prosjekter ✅

**Gjenstående oppgaver (lav prioritet, eventuelle oppfølgere):**
- Web DokumentHandlingsmeny redesign for HMS-dokumenter — venter på mobil-bunke-verifikasjon (build #23). § 2 «Halvferdige features».
- Backfill-script kjørt på test, **IKKE på prod** — Kenneth tar beslutning. Prosjekter uten manuelt opprettede SJA/RUH-maler får dem KUN ved neste `modul.aktiver`-call eller manuell trigger.
- Statistikk-fane utvidelser (CSV/PDF-eksport, per-måned drill-down) — separat oppfølger ved kundeønske.
- Same-modul-seeding for Avklaring-modul (§ Avklaring-modul nedenfor) — generalisering vurderes ved den implementasjon.


<!-- fra docs/claude/BACKLOG.md -->
### Innsender-tilgang — DEPLOYET TIL PROD 2026-05-27 (prod-merge `b3194f1d`, develop-commit `b4e53e17`)

✅ **Implementert.** `verifiserDokumentTilgang` utvidet med innsender/mottaker-gren rett etter firmaansvarlig (linje 451-460). `findUnique` for `bestillerUserId`/`recipientUserId` løftet til lokal helper, gjenbrukes av firmaansvarlig + innsender. Alle 17 kallsteder uendret. Slett-sikring håndheves fortsatt av `slett`-mutasjonens egen status-sjekk (`status !== "draft" && status !== "cancelled"`). Detaljer i [historikk-2026-05.md § Innsender-tilgang](historikk-2026-05.md).


<!-- fra docs/claude/BACKLOG.md -->
### Firma-nivå HMS-dashboard — aggregering på tvers av prosjekter ✅ FERDIG (alle 4 trinn deployet til prod 2026-05-29, prod-merger `526db462` + `eacdb40e`, arkivert til [historikk-2026-05.md](historikk-2026-05.md))

**Oppdaget 2026-05-29** ved gjennomgang av HMS-arkitekturen. HMS er i dag strikt prosjekt-isolert: én side på `/dashbord/[prosjektId]/hms/` per prosjekt, `verifiserProsjektmedlem`-gating på server, ingen firma-nivå-aggregering. Det finnes ingen ruter under `/dashbord/firma/` som matcher HMS, avvik, SJA eller RUH.

**Mål:** Firma-admin og HMS-ansvarlig skal se HMS-tilstand på tvers av alle firma-prosjektene fra ett sted — statistikk (åpne avvik per prosjekt, gjennomsnittlig saksbehandlingstid, SJA-frekvens, RUH-rate), prioritert handlingsliste (eldste åpne avvik, frister som nærmer seg) og felles behandling (kommentere/godkjenne uten å hoppe inn i hvert prosjekt).

**Skiller seg fra oppgaver/sjekklister:** HMS har juridisk + arbeidsmiljø-dimensjon som krever firma-overblikk (internkontroll-forskriften §5, NS 5814). Oppgaver og sjekklister er strengt prosjekt-brede per design — det er produksjon-/leveranse-styring uten tilsvarende kryss-prosjekt-mandat. HMS skiller seg.

**Filter-krav på firma-nivå:** Brukeren skal kunne filtrere HMS-hendelser på prosjekt og byggeplass. Default er «alle prosjekter, alle byggeplasser» — filter-velgere lar firma-admin/HMS-ansvarlig snevre inn til ett eller flere prosjekter, og videre til byggeplass(er) innenfor de valgte prosjektene. Filter-state gjenspeiles i URL slik at delbar lenke kan peke til «alle åpne HMS-avvik på Byggeplass A i Prosjekt X». Knyttes til samme byggeplass-felter som prosjekt-nivå-filter (asymmetri Task `drawing.byggeplassId` vs Checklist `byggeplassId`).

**Rolle-modell:** To separate HMS-roller:

1. **HMS-ansvarlig på firma-nivå** — ser alle prosjekters HMS-data, kan behandle fra firma-dashbordet. **Finnes ikke i kodebasen i dag.** Krever enten ny `OrganizationGroup`-type (gruppe-basert tilgang på firma-nivå, parallell til `ProjectGroup` på prosjekt-nivå) eller ny rolle på `OrganizationMember` (felt-basert, f.eks. `OrganizationMember.hmsAnsvarlig: boolean` eller utvidelse av eksisterende `role`-enum).
2. **HMS-ansvarlig på prosjekt-nivå** — `ProjectGroup` med `domains: ["hms"]`. Eksisterer allerede og er aktivt brukt i `byggHmsSynlighetsFilter` for å gi utvidet tilgang til private HMS-dokumenter.

De to rollene kan tilhøre ulike personer — firma-HMS-ansvarlig er typisk én sentral person eller HMS-koordinator, prosjekt-HMS-ansvarlig er prosjektspesifikk og kan rotere. Tilgangsmodellen må reflektere at firma-nivå-tilgang ikke automatisk gir prosjekt-nivå-tilgang og omvendt, men firma-HMS-ansvarlig får implisitt lese-tilgang til alle prosjekters HMS-data (eventuell sammenheng med `hmsSynlighet: "privat"` må avklares).

**Avhengighet for implementasjon:** Beslutning om OrganizationGroup vs OrganizationMember-rolle må tas FØR firma-HMS-dashbord bygges, ellers risikerer vi å skrive tilgangskontroll to ganger. **Vedtak 2026-05-29: OrganizationMember.firmaRoller += "hms_ansvarlig"** (utvidelse av eksisterende array, ingen schema-endring). Server-fundament implementert i Trinn 1 (`93970feb`) og Trinn 2 (utvidet `byggHmsSynlighetsFilter` + ny `hms.hentFirmaOversikt`). **Trinn 3** (klient-side: ny side `/dashbord/firma/hms/page.tsx` med filter, URL-state, 4 faner + statistikk-panel, samt refaktor av delte HMS-komponenter til `components/hms/`) implementert 2026-05-29. **Trinn 4** implementert på develop 2026-05-29: (Del A) `RedigerModal` + `InviterModal` i `firma/ansatte/page.tsx` har ny checkbox for `hms_ansvarlig`, grønn chip vises i tabellraden, `inviterBruker`-input utvidet med `erHmsAnsvarlig`; (Del B) ny `FirmaHurtigModal` + `hms.firmaBehandleAvvik`-prosedyre lar HMS-ansvarlig endre status + legge til intern kommentar på avvik direkte fra firma-dashbord uten flyt-rolle-validering. Drill-ned forblir hovedflyt. SJA/RUH får ikke hurtig-modal (ingen ChecklistComment-tabell — drill-ned er primær for dem).

**Konsekvenser for arkitektur:**
- Ny rute `apps/web/src/app/dashbord/firma/hms/` (planlagt under firmamoduler)
- Ny server-prosedyre `firma.hms.aggregerForOrganisasjon` eller `hms.hentFirmaOversikt`, gated på firma-admin / HMS-ansvarlig-rolle
- Behandling fra firma-nivå må navigere ned til prosjekt-detalj eller åpne modal i prosjekt-kontekst — felles vs. prosjekt-isolert tilgangskontroll må avklares
- Aggregering kan gjenbruke `hms.hentDokumenter` per prosjekt med `Promise.all` initialt, server-side aggregering for skala senere (jf. punkt 4 i HMS-prosjektvisning teknisk gjeld)

**Spec-beslutninger 2026-05-29:**

- **Behandling:** Full behandling fra firma-dashbordet — kommentere, statusendring og tildele utfører direkte fra firma-listen uten å forlate dashbordet. Server-prosedyrene som gjør disse handlingene må aksepteres uten prosjekt-kontekst, eller dashbordet kaller eksisterende prosjekt-prosedyrer med projectId hentet fra dokument-raden.
- **Synlighet:** Firma-HMS-ansvarlig ser alle HMS-dokumenter inkl. private (`hmsSynlighet: "privat"`). Likestilt med prosjekt-HMS-ansvarlig i tilgang. `byggHmsSynlighetsFilter` må utvides eller bypass-es når firma-HMS-rolle er aktiv. Tilgang logges som audit-spor.
- **Statistikk-KPI-er** (alle fire valgt):
  1. Åpne avvik per prosjekt (status ≠ closed/approved/cancelled, gruppert per prosjekt)
  2. SJA-frekvens per måned (siste 12 mnd, total + per prosjekt)
  3. RUH-rate per måned + trend (indikerer rapporteringskultur)
  4. Saksbehandlingstid median (dager fra opprettet til closed, per prosjekt + firma-total)

**Avhengighet:** Krever rolle-modell-beslutning (`OrganizationGroup` vs `OrganizationMember`-rolle) før implementasjon. Server-aggregering av statistikk skal være rask nok for firma med 50+ prosjekter — vurderes om Promise.all per prosjekt eller én rå-SQL-query. Fase 7-nivå arbeid; ikke startet.

**Eksisterende referanse:** Fase 7 § «HMS-statistikk på firma-nivå» nevner dette kort — denne entry-en utvider med konkret arkitekturskisse.

#### Vedtak 2026-09-10: firmaadmin arver IKKE HMS-tilgang (LEVERT, `fix/hms-arv-firmaadmin`)

Firma-HMS krever nå eksplisitt `hms_ansvarlig`-rolle. `firma_admin` alene gir **ikke** lenger firma-HMS-tilgang (`harFirmaHmsTilgang`, `tilgangskontroll.ts:401`) — `firma_admin`-grenen er fjernet. `sitedoc_admin`-bypass og prosjektadmin-grenen (`erHmsAdmin:450`) er urørt.

**Bakgrunn:** Kenneth reagerte på at firmaadmin automatisk så private RUH-meldinger (`hms.ts:184`: «innsender + HMS-ansvarlige + admin ser alt»). Han trodde firmaadmin ikke så flyten uten å legge seg til; måling viste at han så innholdet uansett via `firma_admin`-arven.

Kenneth 2026-09-10, ordrett:
> «nei -> firmaadmin setter seg selv som HMS»
> «Mathias skal ikke ha hms -> han er ikke medlem i flyt i dag i noen av prosjektene»
> «HMS -> styres pr prosjekt via HMS kortet -> det er dekket der og det er nok» (prosjektnivået aksepteres urørt)

**Ingen backfill — bevisst.** CLAUDE.md § «Stille tomhet er forbudt» krever normalt backfill; her er den utelatt med vilje. Prod-måling 2026-09-10 av firmaadmins i A.Markussen: Malin, Silje og Florian Aschwanden har `hms_ansvarlig` satt eksplisitt (3 av 4) — valget er allerede tatt av et menneske. Mathias Jensen har den **ikke** og mister firma-HMS-tilgang ved neste prod-deploy; det er tilsiktet («han er ikke medlem i flyt i dag i noen av prosjektene»).

**Firmaadmin som skal se HMS-flyten** setter seg selv som `hms_ansvarlig` via `settFirmaHmsAnsvarlig` på ansatte-siden.


<!-- fra docs/claude/BACKLOG.md -->
#### Vedtak 2026-09-10: firmaadmin arver IKKE HMS-tilgang (LEVERT, `fix/hms-arv-firmaadmin`)

Firma-HMS krever nå eksplisitt `hms_ansvarlig`-rolle. `firma_admin` alene gir **ikke** lenger firma-HMS-tilgang (`harFirmaHmsTilgang`, `tilgangskontroll.ts:401`) — `firma_admin`-grenen er fjernet. `sitedoc_admin`-bypass og prosjektadmin-grenen (`erHmsAdmin:450`) er urørt.

**Bakgrunn:** Kenneth reagerte på at firmaadmin automatisk så private RUH-meldinger (`hms.ts:184`: «innsender + HMS-ansvarlige + admin ser alt»). Han trodde firmaadmin ikke så flyten uten å legge seg til; måling viste at han så innholdet uansett via `firma_admin`-arven.

Kenneth 2026-09-10, ordrett:
> «nei -> firmaadmin setter seg selv som HMS»
> «Mathias skal ikke ha hms -> han er ikke medlem i flyt i dag i noen av prosjektene»
> «HMS -> styres pr prosjekt via HMS kortet -> det er dekket der og det er nok» (prosjektnivået aksepteres urørt)

**Ingen backfill — bevisst.** CLAUDE.md § «Stille tomhet er forbudt» krever normalt backfill; her er den utelatt med vilje. Prod-måling 2026-09-10 av firmaadmins i A.Markussen: Malin, Silje og Florian Aschwanden har `hms_ansvarlig` satt eksplisitt (3 av 4) — valget er allerede tatt av et menneske. Mathias Jensen har den **ikke** og mister firma-HMS-tilgang ved neste prod-deploy; det er tilsiktet («han er ikke medlem i flyt i dag i noen av prosjektene»).

**Firmaadmin som skal se HMS-flyten** setter seg selv som `hms_ansvarlig` via `settFirmaHmsAnsvarlig` på ansatte-siden.


<!-- fra docs/claude/BACKLOG.md -->
### Dokumentflyt send-modal redesign — DEPLOYET TIL PROD 2026-05-25 (prod-merge `4968a23c`)

**Status:** ✅ Implementert og deployet i én bunke (server-Commit 1 `584148b2` + mobil-Commit 2 `91bc235f` + i18n `495d3a37` → develop-merge `88d8299f` → prod-merge `4968a23c`). EAS iOS build #23 (`a5e6e2ea`) submittert til TestFlight (`898599df`). Fire kjente avvik fra spec dokumentert for enhet-testing. Detaljer i [historikk-2026-05.md § Dokumentflyt send-modal redesign](historikk-2026-05.md). Spec under beholdes for referanse til hva som ble låst før implementasjon.

**Oppdaget 2026-05-25** ved gjennomgang av mobilens `DokumentHandlingsmeny.tsx`. Gjelder både oppgave og sjekkliste (samme komponent). Spec låst 2026-05-25, utvidet samme dag.

**Problemet:** Dagens send-modal blander fire konseptuelle kategorier i én flat ActionSheet-liste uten visuell separasjon (flyt-progresjon i aktiv flyt / flyt-bytte til annen flyt / godkjenner-respons / admin-livssyklus). Brukeren mangler kontekst om HVOR de er i flyten. ⚙ brukes som separator for admin, semantisk feil.

**Kjerneinnsikt:** Flyten må visualiseres permanent i detaljsiden med brukerens egen boks markert. Trykk på en boks åpner popup med tilgjengelige STATUSER for den retningen — status er primær-handlingen, ikke et generisk «Send hit».

#### Låst design

1. **Flyt-bokser alltid synlig i detaljsiden** — fargede bokser (`Faggruppe.color`) uten tekst, brukerens boks markert med ring/aktivt-indikator. Bunn-bar erstattes; bokse-raden er den nye primær-handlings-UI-en.
2. **Trykk på boks → popup med tilgjengelige STATUSER** (ikke «Send hit»-knapp). Hver tilgjengelig status er en separat knapp. Eksempler:
   - Nabo-boks fra status `received`: `[Send hit]` (→ `sent` til nabo)
   - Nabo-boks fra status `in_progress`: `[Send videre]` + `[Send tilbake]`
   - Egen boks med status `responded`: `[Godkjenn]` + `[Avvis]` (statusforespørsler — handle på egen ballen)

   Status bærer semantikken; mottaker styres deterministisk av flyt-oppsett. «Send hit»-knappen er fjernet.
3. **Bekreftelses-modal etter status-valg** — «Ønsker du å sende og bytte til [ny status]?» + valgfritt kommentarfelt + Bekreft/Avbryt. To-trinns-flyt: boks → status → bekreft.
4. **Ingen tekst under boksene** — boksnavn vises kun i popup ved trykk. Bevisst minimalisme.
5. **Mottaker styrt av flyt-oppsett** — `recipientUserId`/`recipientGroupId` utledes fra boksens hovedansvarlig-medlem (markert med stjerne i popup'ens medlems-liste). Bruker velger ikke mottaker.
6. **Admin-handlinger bak `⋯`-meny** — Lukk, Gjenåpne, Trekk tilbake skjult under «⋯»-knapp ved siden av bokse-raden. Synlig kun for `minRolle === "registrator"` eller `erFirmaAdmin`. Bryter dagens mønster med ⚙-prefiks.
7. **Flyt-bytte = egen nedtrekksmeny** ved siden av bokse-raden, synlig kun for brukere som er medlem av minst én annen dokumentflyt på samme dokumenttype. Velg flyt → oppgaven flyttes dit og **lander hos brukerens egen boks i den nye flyten** (ikke vilkårlig mottaker). Bekreftelses-modal: «Oppgaven flyttes fra [flyt A] til [flyt B]. Forrige flyt forlates.»
8. **Layout-regler:**
   - ≤4 bokser: én rad
   - ≥5 bokser: to rader med wrap (lese-rekkefølge venstre→høyre, ikke U-form)
   - Pil-konnektor mellom siste på rad 1 og første på rad 2
9. **Skip-over (ikke-nabo-trykk) tillatt** — samme popup-flyt som nabo-trykk. Bekreftelses-modalen i punkt 3 fungerer som safeguard; ingen ekstra mellom-bekreftelse trengs.
10. **Android = custom RN Modal** — ingen `ActionSheetIOS`, ingen plattform-spesifikk `Alert`. Samme komponent på iOS og Android (samme mønster som `FirmaVelger`/`ProsjektVelger`).

#### Fortsatt åpent (detalj-spørsmål, ikke blokkerer implementasjon)

- **`approved`/`closed`-tilstand:** Skal flyt-boksene grå-tones som «lukket flyt» eller forbli trykkbare for «videresend som referanse»? Dagens server flytter oppgaven mellom flyter også fra approved/closed via `forwarded`-mekanisme. Foreslått retning: grå-toning + trykkbart, popup viser tilgjengelige statuser (typisk kun «Send som referanse») med klar advarsel om at oppgaven flyttes over. Avklares ved implementasjon.

#### Tilgangs-utvidelse i samme runde

`endreStatus` server-regel utvides — dagens regel tillater kun `admin`/`registrator` å bytte flyt. Utvides til også å tillate:
- «Har ballen» (`userId === recipientUserId` eller medlem av `recipientGroup`)
- «Cross-flyt-medlem» (medlem av både gammel og ny flyt) — tett knyttet til at flyt-bytte lander på brukerens egen boks i ny flyt

Skip-over-nabo: tillatt for alle med flyt-tilgang. Server validerer ikke retning — det er en UX-konvensjon styrt av bekreftelses-modalen.

#### Berører

- `apps/mobile/src/components/DokumentHandlingsmeny.tsx` — full omskriving til boks-basert komponent med statusvalg-popup
- `apps/mobile/src/components/FlytIndikator.tsx` — sannsynligvis innlemmes i ny komponent (`byggLedd` blir delt helper)
- `apps/api/src/routes/oppgave.ts` — ny `hentTilgjengeligeFlyter`-prosedyre + utvidet `endreStatus`-tilgangs-validering
- `apps/api/src/routes/sjekkliste.ts` — speilet endring
- `packages/shared/src/utils/statusHandlinger.ts` — kilde for tilgjengelige statuser per boks. Mobil bør konsumere `hentRolleFiltrertHandlinger` (i dag dupliserer den logikken lokalt).
- `packages/shared/src/i18n/*` — nye nøkler: bekreftelses-tekst, popup-tittel, flyt-bytte-tekst, admin-meny-elementer
- Server-tilgangskontroll-helper for å sjekke flyt-medlemskap

#### Estimat

Server ~45 min, mobil-UI ~5 timer (oppgave, ny boks-komponent med statusvalg-popup), sjekkliste ~30 min (gjenbruk). I18n auto-oversett. Totalt ~7 timer Opus-arbeid + EAS-bygg.


<!-- fra docs/claude/BACKLOG.md -->
### Kompakt sedel-layout — utnytt skjerm bedre (oppdaget 2026-05-17, ✅ T7-4g 2026-05-17)

**Status:** ✅ Forslag 1 implementert. T7-4g (merge `5c6347d9` på develop) reduserer SeddelKort-header til én linje (~48px) med default-kollapsing. Auto-expand ved tilleggHarKrav eller mertid. Action-rad fjernet. Detaljer i [STATUS-AKTUELT.md § T7-4g](STATUS-AKTUELT.md).

**Gjenstående:**
- Forslag 3 (periode-presets + faner + paginering) — egen oppfølger T7-4h
- Forslag 2 (view-toggle [Kort]/[Tabell]) — vurder etter Forslag 3


<!-- fra docs/claude/BACKLOG.md -->
### B_ny / T7-5f — Lagre-knapp grå→grønn — DEPLOYET TIL PROD 2026-05-23 (prod-merge `c2792f28`, impl `e7ac0f83` + utvidelse `f0e1a740`)

✅ Implementert på både `AttesteringDetalj_Edit.tsx:296-305, 487-499` (`harUlagredeEndringer`-memo + grønn className når dirty) OG `RedigerRadModal`. Tidligere arkiv-commit `be73e2c6`. Entry var hjemløs drift som ikke ble fjernet etter prod-deploy.


<!-- fra docs/claude/BACKLOG.md -->
### T7-5e — Attestert-filter på attestering-listen — DEPLOYET TIL PROD 2026-05-20 (prod-merge `cc8f0067`, impl `c523323a`)

✅ Implementert. Fane-toggle `[Venter ●N] [Attestert ●M]` over uke-navigasjon, to parallelle queries, `readOnly`-prop til SeddelKort + ProsjektGruppe, i18n-nøkler `timer.attestering.fane.{venter,attestert}` i 15 språk. Tidligere arkiv-commit `8aa664cb`. Entry var hjemløs drift som ikke ble fjernet etter prod-deploy.


<!-- fra docs/claude/BACKLOG.md -->
### T7-5h — Stille overskriving av manuelt-justert rad.timer — DEPLOYET TIL PROD 2026-05-28 (prod-merge `6fd294d1`)

✅ Arkivert til [historikk-2026-05.md § T7-5h](historikk-2026-05.md). Scope: kun web. Mobil-komponenter har separat recompute-logikk og er ikke berørt — egen sub-PR ved behov.


<!-- fra docs/claude/BACKLOG.md -->
### Pause-vindu default — DEPLOYET TIL PROD 2026-05-28 ✅ (prod-merge `75a09ccf`, arkivert til [historikk-2026-05.md](historikk-2026-05.md))


<!-- fra docs/claude/BACKLOG.md -->
### B5 — Sum-indikator (maskin-av-arbeid) i SeddelKort — DEPLOYET TIL PROD 2026-05-27 (prod-merge `f7a836f8`)

✅ Implementert. Grønn/rød badge med samme invariant som EcoBucketAttest (inkl. pause-buffer per T.7 2026-05-18). Auto-expand-trigger utvidet med `maskinOver`. Arkivert til [historikk-2026-05.md § lagContextStamme + B5](historikk-2026-05.md).


<!-- fra docs/claude/BACKLOG.md -->
### i18n: pause-drift (fr + de/sv/et) — ✅ DEPLOYET TIL PROD 2026-05-27 (prod-merger `baa462e1` + `d8b60854`)

Auto-oversettings-skriptet forvekslet engelsk «break» (pause) med «break» (knekke/avbryte) på fire språk. Fikset i to runder:

- **fr** (prod-merge `baa462e1`, impl `da0b2aad`): label «Casser» → «Pause», toggleHint «saut» → «pause», intervall «rupture» → «pause», maskinAvArbeid-formulering forbedret. Arkivert til [historikk-2026-05.md § Returnert→pending-reset + fr.json](historikk-2026-05.md).
- **de/sv/et** (prod-merge `d8b60854`, impl `eae412c0`): samme mønster fikset på tysk («Brechen» → «Pause»), svensk («Bryta» → «Paus» + hint «avbrott» → «paus»), estisk («Katkesta» → «Paus»). Audit-funn via pre-compact dokumentasjons-sjekk.


<!-- fra docs/claude/BACKLOG.md -->
### i18n: `timer.gruppe.maskinAvArbeid` — IMPLEMENTERT PÅ DEVELOP 2026-05-28 ✅

Engelsk kildetekst forenklet fra «Machine hours {{maskin}}h of work hours {{arbeid}}h» til «Machine {{maskin}}h / Work {{arbeid}}h» (kort, klar struktur med universell slash-separator). Norsk speilet: «Maskin {{maskin}}t / Arbeid {{arbeid}}t». Nøkkelen slettet i 12 språk og re-generert via `generate.ts` — alle oversettelser nå gramatisk korrekte. ro fikset manuelt (Google Translate hoppet over «Work»; satt til «Lucru»). fr beholdt sin manuelle verdi fra `baa462e1`.


<!-- fra docs/claude/BACKLOG.md -->
### ✅ LØST 2026-08-30 (`fc817801`, merge `661682c5`) — Slettevakter: dokumentflyt vernet i begge ender, faggruppe ikke

Asymmetri mellom to strukturobjekter av samme klasse. Den ene fikk vakt fordi Kenneth ba om
det 2026-08-22; den andre ble aldri nevnt.

| Objekt | Vernet mot | Ikke vernet mot |
|---|---|---|
| `Dokumentflyt.slett` | dokumenter (`tellFlytDokumenter`, lesbar melding) | — medlemmer cascader, men et medlemskap har ingen selvstendig eksistens |
| `Dokumentflyt.fjernMedlem` | aktive dokumenter i flyten | (for bredt — se under) |
| **`Faggruppe.slett`** (`faggruppe.ts`) | sjekklister + oppgaver | 🔴 **medlemmer** (`FaggruppeKobling`, `Cascade`) · 🔴 **flyter** (`Dokumentflyt.faggruppeId`, `SetNull`) |

**Reachbar tilstand:** en faggruppe med medlemmer og flyter, men ingen dokumenter ennå, kan
slettes. Koblingene forsvinner med `Cascade`, flytene mister faggruppen sin med `SetNull` —
stille, begge deler. 🔴 **Det er nøyaktig tilstanden til et nyoppsatt prosjekt**, altså når
noen er mest tilbøyelig til å slette en faggruppe de opprettet feil.

Historisk belegg for at `SetNull`-hullet biter: slett-vern-kommentaren i `dokumentflyt.ts`
noterer *«prod: 1 av 16 sjekklister ER flyt-løs, kan være dette»*.

**LØST:** `faggruppe.slett` teller nå aktive `FaggruppeKobling` (`periodeSlutt: null`, C.13 —
historiske blokkerer ikke) + `Dokumentflyt` med `faggruppeId`, i egen `PRECONDITION_FAILED`-
blokk med samme meldingsform. Sjekkliste-/oppgavetellingen urørt.

**Målt effekt på test:** **én** faggruppe blir nytt blokkert — «Elektro» (april 2026,
6 medlemmer, 2 flyter, null dokumenter). **Ingen vranglås:** begge flytene er tomme, så veien
ut går (fjern koblinger → slett flyter → slett faggruppe).

⚠️ **Kjent skavank, bevisst:** de to vaktene er separate blokker, så en faggruppe med *både*
dokumenter og medlemmer gir to runder friksjon — rydd dokumentene, prøv igjen, bli stoppet av
den andre. Ordren forbød å røre den eksisterende blokka; begge meldingene er sanne hver for
seg. Slås de sammen, gjør det i en runde som eier hele prosedyren.


<!-- fra docs/claude/BACKLOG.md -->
### Doc-drift (timer) — ✅ LØST 2026-06-21

Fra redesign-screening 2026-06-20. Reconciliert timer.md mot faktisk kode.

- ~~**DRIFT-1 — `timer.md:124` PR 2C-status**~~ ✅ Splittet ferdig (per-rad projectId/fraTid/tilTid + timerSync + screens, T7-3b1/T4) vs genuint åpent (`dagsseddel_local.project_id` `.notNull()` + byggeplassId/attestert-felter + NOT NULL + backfill). Status 🔴→🟡.
- ~~**DRIFT-2 — `timer.md:300-366` UX-skisse pre-T.1**~~ ✅ Skrevet om til T.7 per-rad-modell (prosjekt per rad, prosjekt+ECO-gruppert visning).
- ~~**DRIFT-3 — fritekstsøk udokumentert**~~ ✅ Ny subseksjon «Fritekstsøk på velgere» i timer.md (lønnsart/aktivitet/ECO/utstyr nr+navn, terskel > 7).
- ~~**DRIFT-4 — `timer-input-katalog.md` tom plassholder**~~ ✅ SLETTET 2026-06-21 (2 innkommende lenker repointet til timer.md; spec bor kanonisk i timer.md § Datamodell).
- ~~**DRIFT-5 — auto-fordeling T.9-droppet vs OPPSUMMERING**~~ ✅ timer.md klargjort: ingen fordelingsmotor i manuell flyt (T.9 droppet = fasit); eneste Timelønn/Overtid-split skjer i auto-utkast (Slice 3 `genererForslag`). OPPSUMMERING er ikke-registrert arbeidsdok (egen lenke-reconciliering per STATUS).


<!-- fra docs/claude/BACKLOG.md -->
### Slice 3 — auto-utkast MVP (auto-generer draft ved «Slutt dag») ✅ DEVELOP 2026-06-20 (`a79a8fae`)

Mål = v2-mockup (låst 2026-06-20). Forankret i BESLUTNING 1 = Alternativ B (auto-utkast + innsendings-godkjenning, jf. `fase-0` T.8-revisjon over). Ved «Slutt dag» auto-genereres en **draft**-dagsseddel på valgt prosjekt med arbeidstid + reise, med **auto-fyll-banner** og **reise som egen rad**. Arbeider korrigerer + sender (draft→sent = godkjenning). Synlighets-fiks (UX-1) er allerede levert. Senere utvidelser: maskin + multi-prosjekt-auto-deteksjon (krever byggeplass-GPS L2). Ingen kode før beslutnings-detaljene er låst per mockup.

**Innsnevring (verifisert mot kode 2026-06-20):** Selve auto-genereringen er **allerede bygget** — `genererForslag` (`apps/mobile/src/components/StartSluttDagKort.tsx`, fra «Start dag/Slutt dag»-MVP 2026-06-06 + R4; per 4a delt i `genererForslag` + `opprettDagsseddelForSegment`) lager draft på Haversine-prosjekt med arbeidstid (= total − reise, splittet Timelønn/Overtid 50%) + reise-rad (egen lønnsart via `OrganizationSetting.reiseLonnsartId`, navne-match-fallback, gated på terskel + identifisert oppmøtested). Slice 3 sin gjenstående kode er derfor kun **UX-signallaget**: (1) auto-fyll-banner, (2) auto-markør (skille auto-draft fra manuell `ny.tsx`-draft), (3) reise-rad-merking.

**Idempotens (LÅST 2026-06-20, Alt 1):** ved «Slutt dag» — finnes allerede en draft for `(userId, dato)` → naviger til den eksisterende i stedet for å lage ny. Begrunnelse: server håndhever `@@unique([userId, dato])` på `DailySheet` (`db-timer/schema.prisma:164`), så «alltid ny» ville gitt sync-konflikt og «merge» dobbelttellings-risiko. Alt 1 respekterer modellen, unngår duplikat + dobbel-lønn, enklest. *(`@@unique([userId, dato])` per 2026-06-21 på `db-timer/schema.prisma:172` — flyttet av Slice 4b-2 `sluttTidKilde`.)*
- **Edge case (akseptabel MVP-tradeoff):** er den eksisterende draften tom (manuelt opprettet, ingen rader), åpnes den uten auto-fyll → arbeider mister auto-genereringen i det sjeldne tilfellet. Greit for MVP. «Auto-fyll tom eksisterende draft» (skriv auto-rader inn i tom draft) er en mulig senere forfining.


<!-- fra docs/claude/BACKLOG.md -->
### Slice 4 — dag-grense + nattskift + glemt-dag + system-flagg + arbeidstids-varsel ✅ DEPLOYET TIL PROD 2026-06-21 (server; mobil via EAS)

> **Server-deler (migreringer + web-attestering-badges + admin-UI) DEPLOYET TIL PROD 2026-06-21** (prod-merge `32b88bd7`) — arkivert i [historikk-2026-06.md § Slice 1–4 + reisetid R1–R4 + GPS L1](historikk-2026-06.md). **Mobil-delene (auto-utkast, midnatt-splitt, glemt-dag-prompt, badges) er IKKE på arbeidernes telefoner** — krever EAS prod-bygg etter enhetstest (gate, se § Følgesaker etter prod-deploy). Detalj-spec under beholdt for referanse.

> **Slice 4a — midnatt-splitt ✅ DEVELOP 2026-06-20.** Mobil-lokalt, ingen migrering. `genererForslag` (`StartSluttDagKort.tsx`) refaktorert til per-segment via ren `splittVedMidnatt`-helper (`utils/dagsegment.ts`): skift som krysser 00:00 → én draft per kalenderdag, timer summerer til reell total (verifisert: 19:00→07:00 = 5t+7t=12t). **Låst:** pause + reise kun på start-dagen (1a), per-dag Timelønn/Overtid-split beholdt (2), «delt ved midnatt»-merking (lokal nullable `dagsseddel_local.delt_ved_midnatt`, idempotent ALTER) + badge på review-skjerm (`timer.deltMidnatt.*`, 15 språk). Idempotens per dag (eksisterende `(userId,dato)`-sedel beholdes, øvrige opprettes), naviger til start-dagens sedel.
> - **Kjent luke (→ Lag 2/4b):** en glemt «Slutt dag» over flere døgn over-splittes (3 dager → 4 sedler à ~24t). Lag 2 glemt-dag-prompt fanger dette. Inntil 4b: akseptabel (bedre enn dagens ene 72t-sedel; per-dag-tallene er i det minste avgrenset).

**Sub-split (vedtatt 2026-06-20):**
- **4b-1 — Lag 2 glemt-dag-prompt ✅ DEVELOP 2026-06-20.** Mobil-lokalt, ingen migrering. `StartSluttDagKort`: åpen `arbeidsdag_local` med start-dato < i dag → amber-prompt «Glemte du å avslutte?» med «Jeg glemte å avslutte» (gjenoppretting: estimer slutt = firma `standardSluttTid` på start-dagen, `utforSluttDag(overstyrtSluttIso)` uten GPS-ved-slutt → draft arbeider korrigerer) / «Jeg jobber fortsatt» (behold åpen, vis normal «Slutt dag»). Fanger BUG-1 + 4a over-splitt-luken. i18n `timer.glemtDag.*` (15 språk). `sluttTidKilde="system"`-merking påføres i 4b-2.
- **4b-2 — Lag 3 (`sluttTidKilde`) + arbeidstids-varsel ✅ DEVELOP/TEST 2026-06-21 (migrering anvendt + verifisert på `sitedoc_test`):** to additive migreringer anvendt + verifisert 2026-06-21 — `slutt_tid_kilde` (NOT NULL DEFAULT 'bruker') på `timer.daily_sheets` + `arbeidstid_varsel_timer` (NOT NULL DEFAULT 13) på `organization_settings`; gaten traff `sitedoc_test`, begge migreringer «applied», 12/12 rader backfill (0 berørt), upload-regresjon 401 (web-port OK). Ikke prod. to additive migreringer (`db-timer DailySheet.sluttTidKilde @default("bruker")` + `db OrganizationSetting.arbeidstidVarselTimer @default(13)`). Server: felt i `opprett`/`oppdater`/`syncBatch`/`hentEndringerSiden`/`hentForAttestering` + `organisasjon.oppdaterSetting`/`hentSetting`/`hentArbeidstidDefaults`. Mobil: lokal kolonne `dagsseddel_local.slutt_tid_kilde` + ALTER + sync (push/pull) + set-semantikk (`opprettDagsseddelForSegment`: ikke-siste→`"midnatt"`, siste→`"bruker"`/`"system"` via threaded param; reset `"bruker"` ved redigering i `ArbeidstidSeksjon`). Smartere natt-estimat i `gjenopprettGlemtDag` (standardSluttTid ≤ start → start+dagsnorm, `"system"`). Badges (web `AttesteringDetalj` + mobil `AttesteringDetaljMobil`): kontroll-badge ved `sluttTidKilde==="system"` + arbeidstids-varsel når `sum(timer-rader inkl. reise) > arbeidstidVarselTimer` (varsel, ikke blokkering). Admin-UI: terskel-felt i `firma/innstillinger`. i18n 4 nøkler × 15 språk. Typecheck: 0 nye feil. **Gjenstår (ikke-blokkerende):** arbeider-review arbeidstids-badge (eget punkt under) + mobil-distribusjon via EAS. Prod ikke deployet.

**Følgesaker fra Slice 4 (ikke startet):**
- **Arbeider-review arbeidstids-badge (tidlig-varsel) 🟡** — 4b-2 viser arbeidstids-varsel kun i *attestering* (leder-siden). Arbeider bør se samme varsel på review-skjermen (`apps/mobile/app/timer/[id].tsx`) FØR innsending, så lange dager fanges tidlig. Krever `arbeidstidVarselTimer` i mobil-cache (`organizationSettingKatalog` + `organisasjon.hentArbeidstidDefaults`-select — terskelen er ikke cachet i dag) + samme `sum(timer-rader inkl. reise) > terskel`-beregning som attestering. Varsel, ikke blokkering.
- **Arbeider-review system-slutt-badge 🟢 (valgfri)** — tilsvarende «delt ved midnatt»-mønsteret kan en `sluttTidKilde==="system"`-merking vises på arbeider-review (lokal kolonne finnes alt). Lav prio — gjenopprettings-flyten leder arbeider rett til draften uansett.
  - **Edge case fra 4b-1 å håndtere smartere i 4b-2:** glemt-dag-gjenopprettingen estimerer slutt = `standardSluttTid` på start-dagen. Var det egentlig et **nattskift** (start sent på kvelden, `standardSluttTid` < `startAt`) gir estimatet en 0-times draft. 4b-2 bør (a) detektere dette og estimere smartere (f.eks. start + dagsnorm, eller standardSluttTid på NESTE dag → midnatt-splitt), og (b) uansett merke gjenopprettings-slutten `sluttTidKilde="system"` så attestant ser at tiden er gjettet og må sjekkes.

**Låste design-punkter (2026-06-20):** (1) `sluttTidKilde`: midnatt-grense→`"midnatt"` (ingen badge), «Slutt dag»-trykk/manuell→`"bruker"`, glemt-dag-gjenoppretting/maks-varighet→`"system"` (kontroll-badge). (2) Arbeidstids-terskel teller **alle timer-rader inkl. reise** per dagsseddel (kompensert reise = arbeidstid → mer AML-riktig + konservativt). (3) Glemt-dag-gjenoppretting bruker estimert slutt = firma `standardSluttTid` (arbeider korrigerer). (4) Terskel = `Int` (13 default / 16 tariff via samme felt); admin-redigerings-UI = liten følgesak.

Større slice enn 1–3: krever **én server-migrering (gated)** + split-logikk + gjenopprettings-prompt + attesterings-badge → eget bygg i frisk økt. Bygger på Slice 3 («Start/Slutt dag»-flyten + `genererForslag`). Forankret i AML **§ 10-6** (alminnelig/utvidet arbeidstid: 13 t varsel-default, 16 t ved tariff) + **§ 10-8** (11 t døgnhvile). **Prinsipp:** SiteDoc *flagger + registrerer* — juridisk ansvar for arbeidstidsgrenser ligger hos firmaets HMS, ikke i appen.

**Lag 1 — midnatt-SPLITT (ikke klemming):** et skift som krysser 00:00 deles i **én dagsseddel per kalenderdag**; timene summerer til reell total (12 t nattskift fra 19:00 → 5 t på dag 1 + 7 t på dag 2). Ikke klem til én dag, ikke kutt på midnatt-totalen. Reise føres på **start-dagen**. Overtid/tariff-behandling av nattetimene er **regnskaps-scope** (lønnsart-grensen — SiteDoc registrerer rådata, regnskap eier satser/kobling).

**Lag 2 — glemt-dag vs. nattskift (gjenopprettings-prompt):** ved «Start dag» / app-åpning, hvis en arbeidsdag fra en **tidligere dato** fortsatt er åpen (`arbeidsdag_local.status="paagaar"`) → spør arbeider: **«Jobber du fortsatt, eller glemte du å avslutte i går?»**. «Jobber fortsatt» → behold åpen (ekte nattskift/lang vakt → Lag 1 splitt ved avslutning). «Glemte å avslutte» → la arbeider sette riktig slutt-tid (system-flagg, Lag 3). Erstatter dagens manglende maks-varighet-vakt (jf. BUG-1: 165 t fra glemt «Slutt dag»).

**Lag 3 — system-flagg på slutt-tid:** nytt server-felt **`DailySheet.sluttTidKilde: "bruker" | "system" | "midnatt"`** (Prisma-migrering i `db-timer`, **gated** + `/sitedoc_test` foran). Tre verdier (vedtatt 2026-06-20) så **legitim midnatt-splitt ikke utløser kontroll-badge**: `"midnatt"` = start-segmentets `endAt` er en automatisk dag-grense (Slice 4a) — normalt, ingen badge; `"system"` = slutt-tiden er system-*gjettet* (glemt-dag-gjenoppretting/maks-varighet-klamp) → **kontroll-badge i attestering** (ikke arbeider-bekreftet); `"bruker"` = arbeider satte/bekreftet tiden. Settes til `"bruker"` ved **eksplisitt redigering** (nullstiller system/midnatt). Det lokale 4a-feltet `delt_ved_midnatt` mappes til `"midnatt"` på start-segmentet når 4b lander. Speiler 12 t auto-utsjekk-presedensen (`MannskapsInnsjekk.autoUtlogget`, mannskap.md) for timer-domenet.

**Arbeidstids-varsel (samme badge-mekanisme):** ny `OrganizationSetting`-terskel (**default 13 t**, firma kan heve til **16 t** ved tariff). Overskrides **total av alle timer-rader (inkl. reise) på en dagsseddel** terskelen (vedtatt 2026-06-20: inkluder reise — kompensert reise er arbeidstid, og det er konservativt for varsel) → **varsel, ikke blokkering** (arbeider kan fortsatt sende; utførelse låses aldri bak dette). Per kalenderdag/dagsseddel (et midnatt-splittet nattskift trigger normalt ikke siden hver dag < terskel; ekte AML-«døgn» = utenfor MVP). Samme badge i attestering så attestant/HMS ser flagget. To-stegs-migrerings-policy gjelder for både `sluttTidKilde` og terskel-feltet.

**Avhengigheter/rekkefølge:** Lag 1+2 er mobil-lokalt (kan bygges uten server-migrering om system-flagget utsettes), men Lag 3 + arbeidstids-varsel krever server-migreringen → mest sammenhengende å ta hele Slice 4 som ett bygg med migrerings-OK i forkant. Berører `StartSluttDagKort.tsx` (gjenopprettings-prompt + splitt), `genererForslag` (per-dag-splitt), `db-timer/schema.prisma` (`sluttTidKilde` + terskel på `OrganizationSetting`), attestering-UI (badge), mobil-cache (terskel). Modul-avhengighets-regelen: verifiser mot [timer.md](timer.md) + [mannskap.md](mannskap.md) (auto-utsjekk-presedens) før koding.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### 🟢 2026-09-27 — `/uploads/`-SIGNATURGATEN ER LUKKET. 24 t → 15 min

**Lenke-klassen var det siste hullet.** `SignertLenke.tsx` + `useSignertLenkeApner` ruter alle **ni**
kallsteder som åpnet en `/uploads/`-URL. **Mekanismen er sjekk FØR navigering**, ikke blob: en `<a>`
eller `window.open` kan ikke fange en utløpt signatur — nettleseren navigerer og får 401, og det
finnes ingen `onError` å henge seg på. Gyldig → åpne direkte · utløpt/rå → `erUtloptSignatur` →
debouncet tRPC-invalidering → åpne den ferske URL-en, med `#page=N` bevart.

🟢 **Negativ kontroll, målt av cowork:** 0 gjenstående rå `/uploads/`-mønstre i `apps/web/src`.
**Ni kallsteder faktisk rutet — ikke seks filer berørt.**

🟢 **Snubletråden er snudd fra provisorie-vakt til PERMANENT regresjonsvakt.** Fristen 30.11.2026 er
fjernet fordi detektoren er **armert** (`expect(lenkerSelvfornyer()).toBe(true)`): slettes
`SignertLenke.tsx` feiler test 1, heves levetiden feiler test 2 og 3. ⚠️ **Runde 2 fjernet samme
frist mens koblingen var HVILENDE — det var derfor feil da og riktig nå.**

⚠️ **Ett hull består, ført i BACKLOG:** tråden vokter to hardkodede filstier. **En tredje
konsumentklasse ville blitt brutt av 15 min uten at noe fyrer.** Den negative kontrollen er målt én
gang, ikke håndhevet. Design skriver ordren når de to gatene i kø er inne.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ 2026-09-24 — DEPLOYET TIL PROD. `main` `39e14648`. Binærene er tilbake.

**Release-merge `39e14648`** (`develop` `4553aedd` → `main`, `--no-ff`). **450 filer, 54 825 linjer inn, 9 migreringer.** Steg 2-kontrollen (`git diff --stat origin/develop HEAD`) var **tom** — mergen er innholdslik med develop.

🟢 **Verifisert i prod:** `pdftoppm` og `tesseract` finnes nå i **både** `sitedoc-api` og `sitedoc-web`. I går manglet begge i web.

🟢 **Migreringsgjennomgangen før deploy — alle ni lest, ikke arvet:**
- **Ingen `DROP`, ingen `SET NOT NULL`, ingen `DELETE`, ingen `TRUNCATE`.**
- **Fire** `CREATE UNIQUE INDEX` (design pekte på tre — `reise_avstandsgrenser` og `push_token` sto ikke i hans liste). To er på helt nye tomme tabeller. De to andre er på `organization_templates`, **målt til 0 rader på prod** → kan ikke feile.
- Den ene `UPDATE`-en kjører før sin egen CHECK — trygg ved konstruksjon.

🟢 **`main` bar ingenting `develop` manglet.** Av 132 unike commits var 130 merge-commits fra tidligere releaser; de to reelle var docs som alt lå i develop. Diffen fra merge-basen til `main` var tom. **Det gjorde deployen til en kjent størrelse i stedet for et sprang på 522 commits.**

✅ **OTA PUBLISERT samme runde.** Kanal `production`, update group `1e668259-cff1-4aea-b46c-b4974dbc4111`, commit `4553aedd`. **Bundelen målt før publisering: kun `https://api.sitedoc.no`, ingen `api-test`** — steg 2c gjort, ikke hoppet over.

⚠️ **Asterisk etter commit-hashen (`4553aedd*`) — treet var skittent.** Målt: kun `SAMARBEIDSREGLER.md` og `STATUS-AKTUELT.md`, begge coworks ukommiterte docs-editer. **Ingen av dem er i JS-bundelen**, så bundelen bærer `4553aedd`s kode nøyaktig. 🔴 **Men regelen finnes fordi man normalt ikke KAN vite det — cowork skulle fått docs committet før deployen.**

🟢 **Migreringene verifisert etterpå, ikke antatt:** alle ni har `finished_at` 2026-09-24 00:12. 🔴 **Og samme spørring avdekket at `20260430120000_add_klasse4_indekser` har ligget rullet tilbake siden april — 15 indekser mangler i prod, og Prisma prøver den aldri igjen.** Ført i [BACKLOG § 1](BACKLOG.md).

🔴 **GJENSTÅR:** innlogget verifisering på `sitedoc.no` + opplasting av én ny PDF-tegning.

⚠️ **Cowork slo falsk alarm på `/version`:** meldte at `39e14648` «ikke var den nye mergen» uten å slå den opp. Den **var** release-mergen. Samme feilklasse som regelen skrevet dagen før — *spør etter commit-hash og MÅL den*.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ 2026-09-24 — HOTFIX DEPLOYET TIL TEST OG VERIFISERT (forløper til prod-runden over)

**Test-deploy `0968c026`** (`gitSha` verifisert mot `/version`). `pdftoppm` + `tesseract` er nå i **både** `sitedoc-test-api` og `sitedoc-test-web` — de manglet i web før.

🟢 **Kenneth verifiserte ved å laste opp en NY PDF-tegning: den konverteres og rendrer.** Kodeveien var død i går.

🔴 **LÆRDOM — verifiseringsordren var først FEIL, og feilen er coworks.** Cowork ba Kenneth åpne en EKSISTERENDE PDF-tegning. Det beviser ingenting: `pdftoppm` kalles ved **opplasting** (`apps/api/src/routes/tegning.ts:105→258` i `opprett`, og `:582→631` i `rekonverterPdf`) — en alt konvertert tegning rendrer fra det lagrede PNG-et og trenger aldri binæren igjen. Kenneth fanget det selv: *«dette er en pdf tegning → men den har fungert slik hele tiden»*.

⚠️ **Regelen som følger:** en verifiseringsordre skal navngi **hvilken handling som trigger kodeveien**, ikke bare hvilken skjerm man skal se på. Samme klasse som «be aldri om verifisering av kode som ikke er deployet» — her var koden deployet, men handlingen som utløser den fant ikke sted.

🔴 **PROD ER IKKE DEPLOYET.** `pdftoppm` og `tesseract` mangler fortsatt i prod-web. Feilen er live for enhver som laster opp en PDF-tegning på sitedoc.no.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ 2026-09-24 — ANDRE PROD-DEPLOY SAMME DAG. `main` `858f5c45`.

**Release-merge `858f5c45`** (`develop` `bdc27879` → `main`, `--no-ff`). Steg 2-kontrollen tom — innholdslik med develop. Verifisert: `bdc27879` er ancestor av `main`, og `git diff origin/develop origin/main` er tom. **Én migrering: `20260924120000_overflate_tabell`** (CREATE TABLE + partial unique + CHECK på ny tom tabell).

**Hva som gikk ut:** re-konverter-knappen i tegningsbanneret · slettevakt med myke JSON-referanser · type-korrekt banner (PDF sier PDF) · invalidering etter slett og re-konvertering · punktsky steg 1 (A–F) · LAZ-ordren.

🔴 **Formålet: fem PDF-tegninger sto låst i prod siden 2026-09-16** med `spawn pdftoppm ENOENT` — en feil som ikke lenger gjaldt, men som verken kunne repareres eller slettes. `rekonverterPdf` fantes i koden hele tiden **uten en eneste kaller**. ⚠️ `Oversikt Lakselv lufthavn` blir stående — den mangler DWG-konverterer, ikke `pdftoppm`.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ 2026-09-24 — TRE LAG, TRE FIKSER. De fem tegningene er ryddet i prod.

**Kenneth bekreftet: «converter virket».** Fem PDF-tegninger som sto låst siden 2026-09-16 er konvertert.

🔴 **Saken var tre lag av SAMME rotårsak — tRPC kjører in-process i `sitedoc-web`, så alt «api-arbeid» skjer der:**

| # | Lag | Fiks |
|---|---|---|
| 1 | `pdftoppm` manglet i web | `Dockerfile.web` (`8fbf5180`) |
| 2 | `tesseract` manglet i web | samme commit |
| 3 | `uploads` montert **`:ro`** i web — konverteringen kunne ikke SKRIVE | `:ro` fjernet i begge compose-filer (`6be34c67`) |

⚠️ **Ingen av dem var en regresjon. Hvert lag var maskert av det forrige.** Lag 3 kunne ikke sees før lag 1 var borte: først ga flaten `ENOENT`, så — etter hotfixen — skrivefeil. **Fire forsøk før de fem tegningene gikk gjennom.**

🔴 **Coworks egen drift i samme sak:** `:ro`-endringen ble skrevet i hovedtreet og gitt til Kenneth som serverkommando, men **aldri committet**. Serveren hadde fiksen, repoet ikke — og `deploy-prod.sh` rsyncer fra repoet. **Neste deploy ville reverterat den stille.** Fanget av design. Rettet i `6be34c67` + `eb9071f2` (main), uten deploy — serveren var alt riktig.

⚠️ **`main` `eb9071f2` bærer `:ro`-fiksen, IKKE signaturgaten.** Den er bevisst holdt tilbake fra prod.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
## 🟢 2026-09-18 — Service pr. timetall (kundeønske #1) merget. ✅ DEPLOYET TIL TEST 01:12 MED MIGRERING (db-maskin), ingen OTA.

**Én branch, `feat/service-timetall`** (`2926b625`, ren ff fra `fad2e71e` — ingen rebase). **🔴 Første migrering siden push_token:** `20260918120000_service_timetall` (db-maskin). **Verifisert additiv:** 2× `ADD COLUMN` (nullable), 2× CHECK-constraint (>0 eller NULL), 1× CREATE INDEX — **NULL DROP/TRUNCATE/DELETE i hele diffen.** Gate: **`api` 503→511** (+8) · **`pdf` 120→124** (+4) · **`web` 264→270** (+6) · **`integrasjon` 59→61** (+2, CI). `db` 2 · `shared` 824 · `mobil` 13 HELT stille (null mobilfiler rørt). 7/7. i18n: alle 15 filer **4585→4627** (+42/-0, identisk sett).

- 🟢 **Kundeønske #1 levert (pilot-delene):** serviceintervall pr. maskin i maskinens innstillinger · servicelogg med skrivevei til `ServiceRecord` · automatisk fremskriving · terskelvarsel (`service-varsel-niva.ts`) · PDF-utskrift (`packages/pdf/service-rapport.ts`). **Del E (sjekkliste med avkrysning) er UTENFOR pilot-scope** (Kenneth).
- 🟢 **«Neste service» bor BEGGE steder — bevisst, følger husets EU-kontroll-mønster:** `ServiceRecord` bærer **historikk**, ny `Equipment.nesteServiceTimer` bærer **gjeldende tilstand** (denormalisert fra fremskrivingen) — nøyaktig som `Equipment.euKontrollFrist` ligger ved siden av `ServiceRecord type="eu_kontroll"`. **Ikke en ny struktur.**
- 🟢 **BACKLOG-raden var beviselig FEIL og er rettet (i branchen):** premisset sa `nesteServiceTimer` lå på `ServiceRecord` — det gjorde den ikke (lå ingen steder), var **aldri skrevet og aldri lest**, og `ServiceRecord` hadde **ingen produkt-skrivevei**. (Samme feilklasse som «stille tomhet»: en påstått kobling ingen leser hadde.)
- 🟢 **ci.yml-endringen fulgte med og er merget:** integrasjonsjobben migrerte kun `@sitedoc/db`; kontrollplan la til `@sitedoc/db-maskin migrate deploy` fordi den nye `service-timetall.integration.test.ts` rører maskin-Prisma. **Reelt CI-hull, ikke scope-kryp** — flagget av ham, godkjent av cowork.
- ✅ **DEPLOYET TIL TEST 01:12 MED MIGRERING:** `20260918120000_service_timetall` mot `db-maskin` er KJØRT — Service-seksjonen viser data med korrekt fremskriving. (Prod gjenstår — Kenneth gater.)


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### 🟢 LUKKET (var ÅPEN KONFLIKT): SiteDoc-fanen er ULÅST på prosjektnivå — Kenneth-gatet 13.09 kveld

- **Avgjort:** et prosjekt kan hente **direkte** fra SiteDoc-arkivet. v3-låsen utgår. Begrunnelse: en engangsmal for
  ett prosjekt skal ikke måtte innom firmaarkivet først.
- 🔴 **Rettelse (ikke bare lukking):** attribusjonen i `2210` var feil — «ulåst» var **fabels lesning av punkt E**,
  ikke coworks forslag. Coworks forslag gjaldt **kollaps og søk**, aldri tilgang. Ført her så feillesningen ikke
  reproduseres.
- **Ankeret rettet:** `terminologi.md § 0` bar «Lån kun fra nivået rett over — aldri to opp». Snudd der med ⚠️-blokk;
  det gamle vedtaket beholdt synlig under det nye (SAMARBEIDSREGLER: snudd vedtak rettes DER DET STO).


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ LUKKET — frysevedtaket 2026-09-08

> *«vi skal ikke gate til produksjon før den nye ui er ferdig og verifisert på develop»*

**Betingelsen ble oppfylt 09.09** (Kontakter fase 2 merget · Kenneth verifiserte: *«Veldig bra
design»* · fabels godkjenning gitt), **men sto uskrevet til 10.09 kveld.** ⚠️ **Lærdom: en
oppfylt betingelse som ikke føres, holder arbeidet frosset like effektivt som en uoppfylt.**
**Løst ved deployen over.**


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ FUNN 2026-09-05 — malverkstedet finnes allerede: `sitedoc_test`

Kenneth foreslo å gjenåpne Kenspill (legacy) som verksted for malbygging, fordi Opus der hadde fri
DB-tilgang. **Målingen gjorde det unødvendig.**

`sitedoc_test` på server-ny har alt: pgvector, kjørende AI-søk, ingen kundedata — og
**NS 3420 komplett vektorisert**, ti dokumenter fra del A til Z:

```
f: 332 · k: 178 · l: 166 · z: 100 · j: 89 · a: 76 · gu: 57 · 1: 56 · d: 62 · cd: 55
```

⚠️ **Dublett funnet:** `NS 3420 Del K Anleggsgartnerarbeider.pdf` har **0 chunks** — samme
dokument som den vektoriserte `…ns-3420-k_2024_no_001.pdf` (178). Ufarlig, men bør ryddes så
ingen søker i feil kopi.

🔴 **Kenspill er MÅLT UEGNET, ikke bare unødvendig:** kode fra juni (`aed86d0f`, branch `main`),
`bibliotek_maler` = 0, embeddings = 0. Å bruke den ville krevd kodeoppdatering **og**
dataflytting. **Ikke ta den opp igjen.**


<!-- fra docs/claude/STATUS-AKTUELT.md -->
## ✅ ARKIVERT — sikkerhetsfiks signaturgate `/uploads/privat/*` → [historikk-2026-08.md](historikk-2026-08.md)

Funnet, fikset, deployet prod (`0d5d54ee`) og verifisert i drift 2026-08-11. Fire utnyttbare omgåelsesformer (`//`, `/./`, `/../`, `%2e`) ga 200 mot ekte fil; alle gir 401 etter fiks på både test og prod. ⚠️ Gjenstår: innlogget nettleser-verifisering at bilder laster.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ Mobil-Microsoft dropper `User.Read` — ID-token framfor Graph /me (`19a2884e` + flertenant `7aa85094` — **I PROD `69ca9f62`, verifisert på telefon 2026-09-07**)

**Saken:** mobil-MS ba om `User.Read` (Graph → hele Entra-profilen) for å hente e-post/navn/id som
allerede ligger i ID-tokenet. Web ba om minimum (`openid profile email`); mobil var utliggeren.

**Løsning:** mobilen returnerer nå **ID-tokenet** (ikke access-tokenet); api validerer det med `jose`
mot Entras `/common`-JWKS, leser `oid`/`email`/`name` fra claims og **dropper Graph /me helt**.
🔴 **Flertenant:** `iss` valideres mot tokenets eget `tid` (ikke pinnet til vår tenant — det ville
sperret hver kunde som logger inn fra sin egen Entra), `aud` pinnet mot mobil-client-id. jose-feilkode
+ sviktet claim logges (aldri token/verdier). Admission-gaten i `byttToken` verifisert å gjelde
mobil-veien = den reelle grensen for hvem som slipper inn. `providerAccountId = oid` = uendret fra Graph-`id`-veien → **ingen
brutte koblinger** (målt: 3 mobil-MS-kontoer i prod, et rått bytte til OIDC-`sub` hadde gitt dem ny
konto). Scope: `["openid","email","profile"]`. Google urørt (0 mobil-kontoer, ba aldri om ekstra).

**Ny api-avhengighet:** `jose@^6.1.3` (biblioteket Auth.js selv bruker web-side). **Ny api-env
(test først):** `MICROSOFT_MOBILE_CLIENT_ID` (= `234ca0e0-…`) — se
[infrastruktur.md § Env-filer](infrastruktur.md). Ingen issuer-env (flertenant). Ingen migrering.

🔴 **OTA-landmine funnet + rettet i samme runde:** `EXPO_PUBLIC_MICROSOFT_CLIENT_ID` var en
plassholder i `.env.test`/`.env.production` (ekte kun i eas.json). Målt: alle OTA-er siden 04.09
bar plassholderen → MS-innlogging på mobil har vært **død for testerne i en uke**. Uten env-fiksen
ville denne auth-OTA-en brutt innlogging FØR ID-tokenet lages. Ekte (offentlig) client-id lagt inn
i begge `.env`-filer (sporet i git → propagerer til publiseringstreet); re-eksport bekreftet ekte
id i bundelen. Advarsel skrevet i [eas-build-veileder § OTA-logg](eas-build-veileder.md).

🔴 **Azure:** koden trenger ikke lenger `User.Read` — Kenneth fjerner tillatelsen i portalen, men
**FØRST etter at test-innlogging på telefon er verifisert** mot egen eksisterende konto.
🔴 **Leveringsvei:** api-deploy + mobil `eas update` kanal `test`. Gate strengere: ingen prod før
Kenneth har logget inn med MS på mobil mot test og landet på **egen** konto (samme prosjektliste).
Gaten grønt lokalt (api tc · web build · mobil tc · 210 tester · mobil lint 0 err).


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ Arkiv-PDF for oppgave + HMS avvik/RUH — task-innholdsleser (`a2c7edc9` → develop `3c905298`, MERGET 04.09)

> ⚠️ **Merk om lokasjonOmfang-raden som sto her:** den ble erstattet av denne i dokgens commit.
> `feat/lokasjonomfang` (`9a94a249`) er **merget** til develop 04.09 — «Gjelder hele byggeplassen»
> som eksplisitt valg, L9 sticky tegning, `showLocation`-paritetsfiks på oppgavesiden, migrering
> `20260904140000_lokasjon_omfang` anvendt på test. Raden sto som «IKKE merget» i to timer etter
> mergen fordi **cowork ikke oppdaterte tavla** — agenten ryddet den bort med rette.
> 🔴 **Regelen «tavla har én skribent» virker bare hvis den ene skriver.**

**Ordre:** `relay/inbox-arkiv-pdf-oppgave-hms.md`, gatet av cowork 04.09, Kenneth-bestilt. **RUH og avvik er lovpålagt HMS-dokumentasjon som ikke kunne leveres som PDF** — de er `Task`, og `render.ts` kastet for alt annet enn sjekkliste. SJA slapp unna fordi den er `Checklist`. Pilotblokkerer for A.Markussen.

**Én rot, tre dokumenttyper, to flater:** `arkiv.rendr` godtok allerede `type:"oppgave"`; kun task-leseren manglet. Web + mobil kaller samme prosedyre.

**Levert:**
- **Task-innholdsleser (delt kjerne, krav 1):** `sammenstilling.ts` refaktorert til `byggArkivHtmlKjerne(norm)` + tynne `byggSjekkliste…`/`byggOppgave…`-adaptere over en `NormalisertArkivDok`. ~85 % delt (forskjellen liten → delt leser med type-diskriminant, ikke duplikat). Sjekkliste-utskrift **uendret** (151 arkiv-tester + 3 sjekkliste-orkestrator-tester grønne). Gjenbruker kanonisk repeater-traversering (`byggObjektTre`/`samleRepeaterMarkorer`/`byggInnhold`) — ingen tredje traversering.
- **HMS virker, ikke bare oppgave (krav 2):** avvik/RUH (`Task`, `template.domain="hms"`, subdomain avvik/ruh) trenger **ingenting** utover task-leseren — kun standard felttyper, ingen HMS-egne kolonner. Målt funn: status/signatur var sjekkliste-semantisk (`/godkjent/`); task/HMS-terminalen er «Lukket» (`tilStatus==="closed"`). Egen `signaturStrategi`: sjekkliste = Utført/Godkjent · oppgave/HMS = Opprettet/Behandlet.
- **`arkiv.rendr` (krav 3):** enum forblir `"sjekkliste" | "oppgave"` — **ingen egen `"hms"`-type.** Avvik/RUH ER tasks → «oppgave»-grenen dekker dem; domenet ligger på malen og styrer semantikk i leseren. En «hms»-type ville vært en redundant kontraktsendring mobilklienter i drift måtte lære. Tilgangskontroll + activity forgrenet på type (`task`/`checklist` + hmsSynlighet).
- **Begge flater (krav 4):** PDF-nedlasting på web oppgave-side; del-ikon + «Forhåndsvis» + `ArkivPdfForhandsvisning` (WebView) på mobil oppgave-side. Komponenten var allerede type-agnostisk.
- **Krav 5:** `ArkivPdfForhandsvisning` bruker allerede `ModalFlate` (ikke `SafeAreaView` i Modal).

**Paritetsmatrise (etter denne runden):**

| | Web | Mobil-app | Arkiv-PDF |
|---|---|---|---|
| Sjekkliste | ✅ | ✅ | ✅ |
| Oppgave | ✅ (+ PDF-knapp) | ✅ (+ PDF/forhåndsvis) | ✅ (ny task-leser) |
| HMS (avvik/SJA/RUH) | ✅ | ✅ | ✅ (SJA=Checklist fra før · avvik/RUH=task-leser) |

**Målt avvik meldt:** mobil oppgave-detalj viste ingen dokumentlokasjon fra før (kun tegning-chip); ikke rørt utover PDF-knappen (egen sak). **Leveringsvei:** server-PDF + web → prod-deploy; mobil-UI via `eas update`.

**Gate grønn (lokalt):** web build · api+mobil typecheck · mobil lint 0 · api 277/277 · pdf 97/97 · shared 636/636.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ Kø-robusthet — opplastingskøen frøs i stillhet i 18 min (`fix/mobil-batch-opplasting`, MERGET — branch ryddet)

**Avdekket av galleri-flervalg, men er en kø-robusthetssak, ikke en flervalg-sak.** Kenneth batchet 6 bilder i felt; de kom opp i sjekklista og til slutt på server — men det tok 18 min, og INGENTING sa at de var underveis. Målt årsak: `uploadAsync` hadde **ingen timeout**, så en hengende opplasting på tregt byggeplass-nett holdt `prosessererRef` true; 15s-sikkerhetsnettet er guardet på `!prosessererRef.current` og var dermed dødt. Bare reload (som nullstiller `laster_opp`→`venter` via `migreringer.ts:109` + fersk mount) løsnet den. Køen drenerte ikke av seg selv.

**Levert:**
- **Selv-drenering:** timeout (60s) på opplasting (`opplasting.ts`) + klassifisert feil (`OpplastingFeil` nett/hard). Nett/timeout/5xx retrier med backoff UTEN å telle mot `MAKS_FORSOK` (aldri permanent oppgitt på tregt nett); kun hard 4xx teller mot taket. Head-of-line-fri: per-oppføring backoff-kart, en feilende hopper bakover mens andre slipper fram.
- **B — ingen stille sletting:** «fil mangler» → `console.warn`, ikke `log`.
- **D — synlighet:** felt-badge «N vedlegg lastes opp» / «prøver fortsatt» (peker på hvilken rad), + persistent banner ved PDF/Send «kommer med når køen er ferdig». Køen eksponerer `feilendeVedleggIder` + `ventendePerDokument`.
- **A (hygiene, IKKE årsaken):** unikt lagringsnavn `IMG_<ts>_<id8>.jpg` mot filnavn-kollisjon i rask løkke.
- **C:** sekvensiell komprimering (dreper ~42-samtidige-native-kall-spiken) + per-bilde-isolasjon + catch + fremdrift.
- **E:** append-race herdet — `leggTilVedleggIRad` skilt ut til `@sitedoc/shared` (testbar der batch-veien ikke kunne testes før), RepeaterObjekt appender funksjonelt mot forrige state.

**Eget funn ført til BACKLOG:** `bilde.opprettFor*` er ikke idempotent (blind `image.create`, ingen `vedleggId`) → tapt-svar-retry gir duplikat `Image`-rad. Pre-eksisterende; krever DB-migrering + Kenneths godkjenning (med telling FØR unik constraint).

**Gate grønn:** shared 621/621 (inkl. batch-integrasjonstest på ekte `{_radId,felter}`-form), pdf, mobil typecheck + lint 0, web build.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ expo-updates — JS-fikser til telefonen uten nytt bygg (`e498bb14`, MERGET — **OTA I DRIFT fra 04.09**)

**Bakgrunn (målt):** 3. september kostet fem rene JavaScript-funn tre av ~15 månedlige iOS-bygg.
Ingen trengte en ny binær — bare en vei til telefonen (bygg 51 manglet en upushet fiks, preview-bygget
testet en fiks som aldri var merget). Ordre `relay/inbox-expo-updates.md`, gatet av cowork mot kode.

**Levert (`e498bb14`):** `expo-updates ~29.0.20` (SDK 54-matchet, via `expo install`) ·
`runtimeVersion: fingerprint`-policy (ikke `appVersion` — JS kan aldri lande på binær med annet native
lag) · `updates.fallbackToCacheTimeout: 0` + `checkAutomatically: ON_LOAD` (offline-first: starter alltid
fra cachet bundle, henter i bakgrunnen) · én kanal pr. `eas.json`-profil · `VersjonsFooter` viser kjørende
`Updates.updateId`. Datalaget urørt (bundler i egen katalog, ikke `documentDirectory`).

**Gate grønn:** web build · mobil typecheck · mobil lint (0 errors). Kenneth verifiserte fingerprint,
kanaler, offline-oppstart og updateId-visning mot kode 2026-09-03.

**Grensen som avgjør (fra `eas-build-veileder.md § OTA`):** alt som rører native laget (native modul,
`plugins`/`permissions`/`bundleIdentifier`/Info.plist, SDK-bump) krever nytt bygg. Kan OTA-es: ren
JS/TS, komponenter, logikk, styling, i18n. **Trer i kraft først ved ett nytt bygg pr. kanal** — bygg 51
kan ikke motta oppdateringer. Første `eas update` = Kenneths beslutning.

> ⚠️ **VEDTAKET OVER ER SNUDD 2026-09-04 — `fingerprint` er forkastet (`e59bd7e8`, merget `d9ce38c0`).**
> Teksten over står uendret med vilje: den som leser den først skal ikke bygge det forkastede.
>
> **`runtimeVersion` er nå den eksplisitte strengen `"1"`, ikke en policy.**
>
> **Hvorfor:** fingerprint-policyen kostet to feilede bygg (52 og 53) i «Configure expo-updates».
> Bygg 52: `@expo/fingerprint` kunne ikke resolves lokalt → plassholderen `file:fingerprint` (rettet i
> `3aca2d5a`). Bygg 53: begge sider regnet ekte avtrykk, men ulike, og EAS' diff-seksjon var **tom**.
>
> **Målt rotårsak** (`eas fingerprint:generate --json`, cowork 2026-09-04): **42 av 50 kilder i
> avtrykket er pnpm-stier med peer-avhengighetshash i katalognavnet**, f.eks.
> `node_modules/.pnpm/react-native-maps@1.20.1_…_lyl6n7iahbvyhr2rfdmu4zmbky/`. EAS kjører `pnpm install`
> i sitt eget miljø og får ikke identiske stier. **Ikke fiksbart i vår kode.** Kontrollmåling:
> avtrykket var identisk med og uten `apps/mobile/ios/` — det native prosjektet var ikke årsaken.
>
> 🔴 **Prisen, og den er reell:** setningen «fingerprinten endres og OTA-en leveres ikke» gjaldt et
> sikkerhetsnett vi ikke lenger har. Med fingerprint **nektet** EAS å levere til en binær med annet
> native-lag. Med fast streng **leverer** EAS oppdateringen — glemmer vi å bumpe, lander JS-en på en app
> den ikke passer til.
>
> **Derfor: `runtimeVersion` bumpes manuelt («1» → «2» …) ved enhver native-endring før bygg.**
> Sjekklisten med de åtte triggerne står i [eas-build-veileder.md § OTA](eas-build-veileder.md).
> `@expo/fingerprint` er beholdt som avhengighet — nyttig til diagnostikk, ikke lenger til policy.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ ARKIVERT — prod-deploy 2026-08-28 (`ba234fd1`, 26 commits) → [historikk-2026-08.md](historikk-2026-08.md)

Registreringsmodell fase 1 (ansatt-status-guard i 11 porter), ansattvelger + delt `services/ansatt.ts`, fundament ut av gruppemodul, tre slettevakter, deaktivert bruker på dyplenke, død kode (`@xenova`). Verifisert innlogget 28.08. Migrering `20260828120000_organization_member_status` kjørt; `db-timer`/`db-maskin`/`db-varelager` sjekket — ingen ventende.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ ARKIVERT — fjorten spor som lå som «venter gate», men var i prod → [historikk-2026-08.md](historikk-2026-08.md)

Målt mot git 2026-08-28: `git branch -r --no-merged origin/develop` ga **kun `origin/main`**
— ingen branch ventet på merge. Alle fjorten er forfedre av `origin/main`. Prosjektfilter ·
fase 4-oppfølger · DG-sporet (seks merger) · F1 endringslogg · startbar kontrollplan · fem
spor `d4e0d8f1` · arkivmal stage 4 · repeater-markør · oppgave-per-rad · oppgave-arver-flyt ·
slettevern · slett-adminvakt · config-adminvakt · oppgave/flyt-bunt A–G · DG D2 ·
kontekstvelger 1a. Fulltekst per spor i historikken.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ ARKIVERT — printmotor fase 3 + 4 → [historikk-2026-08.md](historikk-2026-08.md)

Sto som «PÅ TEST / Ingen prod». **Målt 2026-08-28: `eddc118b` og `17fd66f6` er begge
forfedre av `5dcdeb58`** — de har vært i prod siden 06:23 den 28.08. `db-timer`-migreringen
`20260827120000_eksport_oppsett` er også kjørt (målt: ingen ventende i noen av de tre
modulpakkene). ⚠️ **Én rest er reell og flyttet til [BACKLOG](BACKLOG.md):** `landscape`-
parameteren er i koden, men pdf-render-containeren er ikke bygget — liggende
Fakturagrunnlag virker ikke ennå. Buntes med `page.route`-fiksen i ett gatet steg.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅✅ ARKIVERT — august-deployene (03.08–06.08) → [historikk-2026-08.md](historikk-2026-08.md)

Fem prod-deployer arkivert med commit-refs, migreringer og verifisering: flytmodellen komplett + effektivitets-runden + mobil M1–M3 (`8b068c73` 03.08) · Funn A + Funn C (`0ac25705` 04.08) · Funn D + opprettvelger v2 + Spor 1 + kontaktside (`5bf25f83` 05.08) · Ordre 1.4 auto-hopp (`8a2f6d9c` 05.08) · Spor 2 HMS komplett (`70d2b752` 06.08).

> ✅ **Mobil-forbehold LØST 2026-08-09:** EAS-bygg **44** er fyrt og levert TestFlight. Mobil detalj-redesign M1–M3 + hele bunt 44 er nå hos testerne. Kenneths fysiske re-test gjenstår. (Bygg 43 ble bygget 08.08 men **aldri sluppet til testere** — 44 erstatter det.)

**Restanser etter deployene (åpne oppfølgere, ikke deprioritert backlog):**

- **Flytmodell:** Playwright pilot-e2e-spec (`feat/flytmodell-5b-uie2e`, remote-rigg) · trekk-tilbake-status-semantikk (fabel, parkert) · bøtte 4 = byggeplass-kontekst arves ikke ved opprett (pilot-funn #2/#3 → fabels kontekst-fra-innlogging-spor).
- **Statusmaskin:** F6-oppfølger (`received→approved` som default) · posisjonsutredning (H1/N-boks, `steg`-feltet finnes) · registrator-steg-1-validering · H2 (utførers venstre-send/tilbake-kant) · besvar=venstre-modellspenningen · § 0 delt-kilde-konsolidering (egen fase).
- **Effektivitet:** **P4c timer** (7→1-2 klikk, arver chip-komponenten) — ikke startet. Øvrige restanser i [BACKLOG](BACKLOG.md).
- **Mobil M1–M3:** #2 inline-kommentar-inngang · #7b liste-filter · #4 bekreft-på-send-vurdering · #5 testdata-flyt m/distinkte personer per ledd.

<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅✅ ARKIVERT — prod-deploy 2026-08-10 (`7f838d80`, 33 commits) → [historikk-2026-08.md](historikk-2026-08.md)

Bunt 44 (mobil, via EAS 44) + web/api-siden + utlegg U3 + firma-admin prosjektopprett + mal-admin-gate + seed-verktøy + firmarolle-vakt Fase 1. Migrering `sheet_machine_timer_id` kjørt på prod. **A.Markussen fikk sine 5 utleggskategorier** — lønnsart 25/19 verifisert uendret.

<details><summary>Detaljer bunt 44 (mobil) — beholdt for sporing mot TestFlight-tilbakemelding</summary>



**Første mobilleveranse til felt siden EAS #40 (15.07).** Alt under er merget til `develop`, i bygg 44 og på TestFlight. **Ikke prod-deployet** (web/api-siden av HMS + utlegg U1 gikk prod `e37621e1` 08.08 — se historikk). Enhetsverifisert av simulator-Opus i tre runder; bevis i `relay/mobilverify-bevis/`.

**Kilder:** Kenneths enhetstest 08.08 (prosjekt 998 Instinniforbotn) → fabels ordre `docs/claude/delplaner/ORDRE-mobil-devicefunn-2026-08-08.md` (Del A–D) + `FABEL-SVAR-cowork-blokk2-mobil-device.md` (A1/B1/B2-godkjenning) + simulator-Opus' egne funn.

| Sak | Innhold | Verifisert |
|---|---|---|
| **fabel Del A** — tegnings-navigasjon | Trykk på tegningsrad åpner tegningen direkte (var: `router.push("/lokasjoner")` uten id → 2+ ekstra trykk). Delt `aapneTegning`-helper + nonce (`ts`) fordi `lokasjoner` er en montert tab-skjerm. «Fortsett der du slapp»-snarvei gjenbruker **eksisterende F1** (`ByggeplassKontekst.settSistTegning`, bygget men aldri wiret) framfor ny SQLite-tabell. Guard via `hentMedId` → slettet/feil prosjekt gir velger-fallback, aldri krasj | ✅ 1-trykk · snarvei etter kald-restart · offline · ugyldig-id-guard · nonce begge veier |
| **fabel Del B pkt 1** — maskin ved redigering | Maskin kunne kun føres ved NY timer-rad ⇒ **auto-utfylt dag ga ingen vei til å føre maskin**. Nå: maskin-seksjon også ved redigering (drop `!eksisterendeRad`-gaten), prefill fra koblet rad. **Additiv nullable `sheetTimerId`** på `SheetMachine` + `sheet_machine_local` (migrering `20260808130000`, svak String-FK, ingen backfill) — bøtte-match på fire felt avvist: integritet i skjemaet, ikke i logikk som kan glemmes. Null-rader har kodekommentar som forklarer hvorfor null er lovlig (stopper framtidig heuristisk backfill) | ✅ ≤2 trykk fra rad · re-rediger gir ÉN maskinrad · sync round-trip · oppgradering over eksisterende lokal data |
| **fabel Del B pkt 2+3** — cache + banner | `refreshMaskinKatalog` fanget pull-feil (`.catch(() => [])`) → destruktiv `delete` med tom liste ⇒ cachen tømte seg selv ved nettglipp, og bare re-login fylte den. Fjernet catchen (symmetri med `refreshKatalog`). Banner «Herav maskin 0.00t» skjules ved maskin = 0 | ✅ cache bevart etter framprovosert pull-feil, uten re-login |
| **Katalog-cache systemisk (funn #3)** | Simulator-Opus sporet rå UUID-er i dagsseddel-raden til **samme bug i fem tjenester til** — `prosjekt`/`byggeplass`/`kalender`/`oppmotested`/`reisetidMatrise` + `timerKatalog`-ECO. Én offline kaldstart tømte samtlige. Alle seks nå symmetriske; `organizationSetting` bevarte allerede (tidlig-retur). ECO-catchen fjernet etter at begrunnelsen ble **verifisert moot** (`krevBrukersOrg` kaster FORBIDDEN på lonnsart før ECO spørres) | ✅ offline kaldstart → navn står, 0 UUID-er · byggeplass-velger ikke tom |
| **fabel Del C + D** | Hjem-innboks maks 3 inline + «Se alle (N)»/«Vis færre» **inline-ekspansjon** (fabels `/boks`-destinasjon avvist — innboksen er sjekklister+oppgaver, `boks.tsx` er mappevisning; ingen samlet skjerm finnes). Byggeplass-velger markerer «· arves fra dagskortet» | ✅ ≤3-grenen live · D live |
| **HMS-listefunn A/B/C** | `slett`/`hmsSendInn`-onSuccess invaliderer nå `hms.hentDokumenter` (lista hang til refresh) · Forkast-dialog bruker `hms.forkast.*` («legges i papirkurven, 90 dager») i stedet for generisk Slett · låst felt viser «—» | ✅ alle tre stier live |
| **Funn #1 + #2** | `TekstfeltObjekt` (delt `text_field`, ALLE sjekkliste-/oppgaveskjemaer) viser «—» i leseModus · «Ingen byggeplass»-valg i sedel-velger, gatet bak `tillatIngen` så global `ByggeplassChip` er upåvirket | ✅ render-verifisert · ✅ live |

**Til bygg 45 (notert, ikke skjult):** Require cycle `TimerSeksjon ↔ MaskinSeksjon ↔ SplittRadModal` (ikke-fatal dev-warning, men undefined-risiko ved endret import-rekkefølge) · A3 tom equipment-cache kun kode-verifisert (tilstanden er vanskeligere å nå etter cache-fiksen) · B3 legitim-tom kun strukturelt bevart (suksess-stien urørt av fiksen) · tegningsbildets render bekreftes først på TestFlight (bilde-host unåbar over SSH-tunnel; bilde-stien er urørt i diffen).

</details>


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ ARKIVERT — HMS 5a+5b + utlegg U1 → [historikk-2026-08.md](historikk-2026-08.md)

Begge prod-deployet `e37621e1` (08.08 kveld) og arkivert med mekanikk, asymmetri-tabell og verifisering. **Utlegg U3 web-registrering — MERGET develop (`aa111b45`), på test.** Mockup 8a+8b. API: `timer.expenseCategory.list` (utledet ordning + kilde per prosjekt) · `dagsseddel.tilfoy/oppdater/fjernUtleggRad` (`ordningVedFoering` stemplet ved insert, `sats` avvist — bæres av `SheetTillegg`) · `*UtleggVedlegg`; `hentMedId` returnerer `utlegg[]`. Web: `LeggTilVelger` (én inngang, to grupper, ordnings-pille som undertekst — aldri et valg), `UtleggRadDialog` (tre radformer + kilde-linje), `RaderUtlegg`. **Tillegg-flyten (sats) er urørt** — samme mutasjon/validering/lagring. **CHECK-constrainten er runtime-bevist på `sitedoc_test` 09.08:** fakturert+beløp avvist · fakturert+NULL godtatt · utlegg+NULL avvist · utlegg+beløp godtatt (alt rullet tilbake). ⚠️ **Før U5** står alle kategorier på `ordning='utlegg'` → flaten viser kun utlegg-formen på ekte data; `fakturert`/`sats` verifiseres via manuelt satt ordning. Navngitte oppfølgere: bro `ExpenseCategory`→lønnsart · utlegg i attesterings-redigering (arbeider-sti-only asymmetri).

**Utlegg gjenstår:** U2 eksport-guard (utsatt — ingen Proadm-eksportmotor i kode) · E2E-verifisering av U3 · U4 mobil · U5 firma-admin overstyring-UI (**firma-admin setter ordning per kategori; default `utlegg`; må advare ved navnekollisjon mellom `Tillegg` og `ExpenseCategory`**) · U6 migrering av feilførte rader (egen gate). **HMS gjenstår:** SJA-Returner + flyt-stripe på web · dedikert mobil-HMS-behandling.

<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ ARKIVERT — append-only-fiks + fase M-3a del 2 → [historikk-2026-08.md](historikk-2026-08.md)

Begge sto som «venter merge». Målt 2026-08-28: `87dc15db` og `2f014f6e` er begge forfedre av
`origin/main` — de har vært i prod siden juli. Restansene deres lå allerede i BACKLOG.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ ARKIVERT — juli-deployene (del 6 timeføring, F2/F3/F5, F-b/F-e/F-f/F-g, `hentEndringerSiden` fiks B) → [historikk-2026-07.md](historikk-2026-07.md)

Alle fire deployet prod 13.–15.07 (`f888fecc`, `43299d03`) + EAS #38/#40. Full detalj flyttet dit 2026-08-20.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### ✅ ARKIVERT — lønnsart/katalog-import A.Markussen (kjørt prod 2026-07-10) → [historikk-2026-07.md](historikk-2026-07.md)


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### Firmakalender — T9a/b/c deployet til prod ✅, T9d gjenstår 🟡

T9a/b/c deployet til prod 2026-05-15 (prod merge `ca71cf48`).
Migrasjon `20260515114710_t9_arbeidstidskalender` kjørt 15:03:30.
`/dashbord/firma/kalender` returnerer HTTP 200 i prod.

Gjenstår: **T9d** mobil-cache `arbeidstidskalender_local` (avhenger av
T.4/T.5-implementasjon). SummeringsBanner.tsx (T7-3a) trenger oppdatering
etter T9d for å lese dagsnorm fra kalender-cache i stedet for
`OrganizationSetting.dagsnorm`.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### Topbar firma-kontekst + favoritter — deployet til prod ✅

Deployet til prod 2026-05-15 (prod merge `0bd27466`). Topbar tilpasser seg
pathname: i firma-kontekst (`/dashbord/firma/*`) vises ny «Firma ▾»-velger
istedenfor `ProsjektVelger` + `ByggeplassVelger`. Favoritt-prosjekter og
favoritt-byggeplasser persistert i localStorage med stjernemerking i alle
tre velgere (`ProsjektVelger`, `FirmaKontekstVelger`, `ByggeplassVelger`).
Søkefelt vises ved >7 elementer. 11 nye i18n-nøkler totalt
(`topbar.*` + `byggeplassVelger.*`) auto-oversatt til 13 språk.

**Tidligere § #2 «Validering av overtid basert på arbeidstid»** er konsolidert inn i T.9 — sommer/vinter-modell er nå Variant B (dynamiske perioder i `ArbeidstidsKalender`, ikke scalar-felter). 8t (sommer) / 7t (vinter) ordinær arbeidstid-validering bygges som del av T.9-implementasjon.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### #3 — Tidspunkt (fra/til) per linje i timeføringen 🟢 LUKKET 2026-05-16

**Side:** Timeføring.

Levert via T.4-bunken (prod-commit `5d36c8b9`) + T.5 tidsrunding (prod-commit `ba6ba243`).
Server-Zod + DB-schema + web-UI + mobil-cache + mobil-UI deployet til prod 2026-05-16.
Mobil-UI aktiveres på enhet ved neste EAS-bygg (server-respons + lokal SQLite-migrasjon
er klare). T.5 leverer i tillegg konfigurerbar tidsrunding (15/30/60/null) — utover
originalt kundeønske. fra<til-validering på mobil via delt `tilErEtterFra`
(`@sitedoc/shared`; `fraErForTil`-helperen erstattet i M3 2026-07-10) + onBlur-runding på web.

**T.4-implementasjons-bunke (planlagt 5 sub-PR-er):**

| Sub-PR | Status | Innhold |
|---|---|---|
| **T4-a** | ✅ Merget til develop 2026-05-16 (merge `5acd2a5d`, impl `cfe51fc5`) | Schema + migrasjon. `OrganizationSetting.standardStartTid/SluttTid/PauseMin` (defaults 07:00/15:00/30) + `ArbeidstidsKalender.standardStartTid?/SluttTid?/pauseMin?` (overstyring for sommertid_start/slutt/halvdag). Additiv migrasjon, ingen breaking. |
| **T4-b** | ✅ Merget til develop 2026-05-16 (merge `9bcfb5b1`, impl `088a1e37`) | `hentEffektivArbeidstid(orgId, dato)`-helper i `apps/api/src/services/timer/arbeidstid.ts` (sommertid-overstyring → firma-default). Hard sommertid-par-validering i kalender opprett/oppdater (`sommertid_start` krever `sommertid_slutt` samme år). |
| **T4-c** | ✅ Deployet til test 2026-05-16 (merge `c02df657`, impl `39c43aa8`) | Server-Zod-utvidelse for de tre T4-a-feltene i `oppdaterSetting` + kalender `opprett`/`oppdater` (+ `validerTidsfelter`-helper). Innstillinger-side: ny `StandardArbeidstidSeksjon`. Kalender-modal: betinget visning av tidsfelter for sommertid_start/slutt/halvdag + klokke-badge i månedsliste. 15 nye i18n-nøkler → 13 språk (2277 totalt). Venter på visuell verifisering før prod-merge. |
| **T4-d** | ✅ Merget til develop + deployet til test 2026-05-16 (merge `7bee1633`, impl `2f7bf42d`) | Mobil Drizzle: `fraTid`/`tilTid` på `sheet_timer_local` + `sheet_machine_local`. Nye lokale tabeller `arbeidstidskalender_local` + `organization_setting_local`. Nye services `kalenderKatalog.ts` (med `hentEffektivArbeidstidLokal`-helper, speil av server) + `organizationSettingKatalog.ts`. TimerSyncProvider utvidet til 2-stegs Promise.all (base-pulls → firma-spesifikke pulls per org-id fra prosjekt-cachen). `timerSync` push/pull utvidet med fraTid/tilTid per timer/maskin-rad. Server: ny medlems-tilgjengelig `organisasjon.hentArbeidstidDefaults` + fraTid/tilTid lagt til i `hentEndringerSiden`-respons-mapping. Typecheck 12 = 12 baseline. Venter på enhet-verifikasjon + prod-merge. |
| **T4-e** | ✅ Merget til develop + deployet til test 2026-05-16 (merge `e992aca3`, impl `cea8f99e`) | Mobil UI. Ny `FraTilTidFelt`-fellekomponent (DateTimePicker mode=time, 2 felter side ved side). Montert i TimerRadModal + MaskinRadModal. Forhåndsutfylling: ny rad uten forrige rader → `hentEffektivArbeidstidLokal(orgId, dato)` (kalender + firma-default). Ny rad med forrige rader → forrige rads tilTid som fraTid. Rediger eksisterende → radens egne verdier. Validering: fraTid < tilTid hvis begge satt (`fraErForTil`-helper — erstattet av delt `tilErEtterFra` i M3 2026-07-10). Lagring til Drizzle med syncStatus=pending. SummeringsBanner: arbeidstidTimer faller tilbake til kalender-dagsnorm hvis sedel.startAt/endAt mangler — UI viser alltid relevant sammenligning. Rad-visning utvidet med `HH:MM–HH:MM`-tekst. 0 nye i18n-nøkler — gjenbruker `timer.felt.startTid/sluttTid` + `timer.feil.sluttForStart`. Typecheck 12 = 12 baseline. Venter på enhet-verifikasjon + prod-merge. |
| **T.5 tidsrunding** | ✅ Deployet til prod 2026-05-16 (merge `c2b2ede1` develop / `ba6ba243` prod, impl `2560f0d5`) | Server: `oppdaterSetting` Zod-input + `hentArbeidstidDefaults` select utvidet med `tidsrundingMinutter`. Validering: `z.union([15, 30, 60, null])`. Web: ny dropdown i `StandardArbeidstidSeksjon` (Ingen/15/30/60). RedigerTimerRad + RedigerMaskinRad: `step={tidsrundingMinutter * 60}` + onBlur-fallback-runding via `apps/web/src/lib/tidsrunding.ts`. AttesteringDetalj_Edit henter `tidsrundingMinutter` fra `hentSetting` og passerer som prop. Mobil-cache: `organization_setting_local.tidsrunding_minutter` (idempotent ALTER) + service skriver feltet. Mobil-UI: ny `apps/mobile/src/utils/tidsrunding.ts` (speil av web). FraTilTidFelt fikk ny `tidsrundingMinutter`-prop + runder onChange-verdi før callback. `minuteInterval` på DateTimePicker for 15/30 hint til pickeren. TimerSeksjon + MaskinSeksjon henter via `hentOrganizationSettingLokalt`. 6 nye i18n-nøkler → 13 språk (2277 → 2283 totalt). Test-QA godkjent. Prod-deploy 2026-05-16: HTTP/2 200 på sitedoc.no + api.sitedoc.no. Mobil-app-bygg via EAS gjenstår — feltet aktiveres på enhet når TestFlight/Play Store-versjonen oppdateres. |

**T.4-bunken komplett på develop + test 2026-05-16:** Alle fem sub-PR-er (a/b/c/d/e) er merget og kjører på `test.sitedoc.no` + `api-test.sitedoc.no` (HTTP/2 200, migrasjoner kjørt i `sitedoc_test`). Neste: (1) Kenneth verifiserer T4-c web-UI + T4-d/e mobil-UI på testbygg (forhåndsutfylling, validering, fra/til-visning på rad). (2) Etter verifikasjon → prod-deploy av hele bunken samtidig (server-migrasjon, web-deploy, mobil-bygg via EAS → TestFlight/Play Store).

**Auto-fordeling normaltid/overtid — besluttet å ikke implementere (2026-05-16).** Var tidligere notert som planlagt avhengighet av T.9-kalender. Kunden registrerer lønnsart manuelt per rad slik som i dag — `Lonnsart`-katalogen (firma-eid) dekker behovet med separate rader for «Ordinær 100», «Overtid 50%», «Overtid 100%» osv. Krever ingen ytterligere arkitektur eller regelmotor.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### #4 — Redigering og splitting av timer ved attestering 🟡 DELVIS LEVERT

**Side:** Attestering.

**Levert 2026-05-14** via T7-2b-bunken:
- ECO-flytt på attestering (Steg 4a, prod-commit `f98fa7a5` 2026-05-03) — leder kan endre kostnadsbærer per rad.
- Per-rad-attestering med felleskomponent AttesteringDetalj (T7-2b1, prod-commit `3234c057`).
- **Edit-modus: firma-admin kan redigere timeantall + ECO + fra/til på alle pending-rader** via `redigerSedelRader`-mutation (T7-2b2, prod-commit `755c542a`). Gated på `OrganizationSetting.tillattRedigerVedAttestering`-toggle (T7-2b3, prod-commit `af4a7deb`) — default false, firma-admin skrur på via `/dashbord/firma/innstillinger`.
- T.5 tidsrunding (prod-commit `ba6ba243` 2026-05-16) avrunder fra/til-input i edit-modus til konfigurert intervall (15/30/60 min).

**Gjenstår:** Rad-splitting (én rad → flere med ulike prosjekt/ECO/lønnsart/fra-til) krever `splittRad`-mutation. Audit-log med før/etter-snapshots per rad (T7-2b2 logger antall + actor; per-rad-snapshots utsatt til egen oppfølger).


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### #6 — Maskinmodul ikke synlig i prosjekt 998 Instinniforbotn ✅ Lukket 2026-05-12

**Side:** Maskin (prosjekt 998 Instinniforbotn).

✅ **Lukket 2026-05-12 — ikke en bug.** `ProjectModule maskin/aktiv` finnes på prod for prosjekt 998 (`5e8dd794-ab81-47b7-a146-d7384fac3a8a`), og `OrganizationModule maskin/aktiv` finnes for A.Markussen (`4488fe17-...`). Auto-sync fra Steg 1c (`87fb7292`) har gjort jobben sin.

A.Markussen-ansatte (Malin, Silje, Florian — alle `company_admin` med `organization_id = 4488fe17-...` og `can_login=true`) ser Maskin-lenken korrekt i bunnen av HovedSidebar. Kenneth ser den ikke fordi hans bruker har `organization_id = NULL` (superadmin uten firma-tilknytning) — `organisasjon.hentMin` returnerer da `null` og `aktiveFirmamoduler = []`, slik at maskin-bunnelementet filtreres bort i `HovedSidebar.tsx:331`.

**Løsning:** Bytt til brukervisning (impersonering eller logg inn som A.Markussen-ansatt) for å se det kunden ser. Diagnose-verifikasjon utført 2026-05-12 mot prod-DB.


<!-- fra docs/claude/STATUS-AKTUELT.md -->
### #8 — Fagområde og oppgaver i sjekklistemaler-listevisning 🟢 LUKKET 2026-05-12

**Side:** Innstillinger – Produksjon – Sjekklistemaler.

Levert via commit `3eb7398f` (impl) + merge `542461e2` (prod) 2026-05-12. Fagområde-kolonne (Bygg/HMS/Kvalitet via `mal.domain`) + Antall punkter-kolonne (`mal._count.objects`) lagt til i `apps/web/src/app/dashbord/oppsett/produksjon/_components/MalListe.tsx`. 4 nye i18n-nøkler i 15 språk. Tabellen har nå 5 kolonner: Navn, Fagområde, Antall punkter, Prefiks, Versjon.

---

# Flyttet fra SAMARBEIDSREGLER.md 2026-09-28 — passering 1

**Regelen er trukket ut og står i SAMARBEIDSREGLER; fortellingen står her, ordrett.** ⚠️ **Hendelsene er fra
august og september 2026 — datoen i filnavnet er når de ble ARKIVERT, ikke når de skjedde.**

### 🔴 FEM LÆRDOMMER FRA DØGNET 2026-09-03/04 — alle med målt belegg

Et døgn med seks feltfunn, seks merger, to feilede bygg og ett vellykket. **Fem av feilene var
coworks, og alle fem har samme form: en påstand ble ført videre uten at kilden ble sjekket.**

#### 1. 🔴 Be ALDRI om verifisering av kode uten å måle hva den inneholder — tre ganger på ett døgn

| Hendelse | Hva cowork ba om | Hva som faktisk var i koden |
|---|---|---|
| Bygg 51 | «test PDF-forhåndsvisningen» | Reload-fiksen `d1333599` lå **pushet, aldri merget** — ikke i bygget |
| Preview-bygg | «test at fiksen virker» | Samme fiks, samme fravær. **Et bygg av kvoten brukt på å bekrefte en fiks som ikke var med** |
| `feat/galleri-flervalg` | «test flervalget» | Branchen var bygget på et fire timer gammelt grunnlag og manglet **alle tre** fiksene fra samme kveld |

Regel 10b sa «mål premisset før du skriver ORDREN». Den var for smal.

🔴 **Utvidet: mål premisset før du ber noen TESTE noe.** Og konkret:
**rebas en branch på `origin/develop` FØR du ber om test.** Én kommando fjerner hele klassen.
Uten den tester noen «to halve verdier» — én med den nye funksjonen og gamle feil, én med
fiksene og uten funksjonen — og bruker en time på å forstå hvorfor.

#### 2. 🔴 Byggnummer, profil OG distribusjon leses fra kilden — cowork tok feil om bygg 51 to ganger på én time

Først: «bygg 51 er ute hos testerne med de seks funnene» (ført i tavla, gjentatt i flere meldinger).
Så, da `eas build:list` viste «internal distribution / preview»: «den nådde aldri testerne».
Så viste App Store Connect **2 installasjoner og 53 økter** på nettopp bygg 51.

**Begge påstandene kom fra hukommelsen om hva som ble *startet*.** Samme feilklasse som 31.08
(«bygg 47 er hos testerne» etter at 48 var fyrt).

**Regelen:** `eas build:list` **og** App Store Connect. Er de uenige — og det var de her — **står
begge målingene i loggen til noen har målt hvorfor.** Ingen velges bort for å få en ryddig fortelling.

#### 3. 🔴 En grønn test mot en datastruktur produksjonen ikke bruker, måler ingenting

**Fire feil av samme klasse sto bak en grønn gate i to døgn:** `bildeNr` uteble i rike repeatere ·
append-racet · opplastings-callbacken som aldri oppdaterte vedleggets URL · endringsloggens
«Kolonne 2».

Alle fire fordi kode itererte `Object.keys(rad)` og forventet flat form, mens produksjonen lagrer
repeater-rader innpakket som `{ _radId, felter }` (rad-id-vedtak 2026-08-22).

🔴 **Og testene var grønne fordi de bygde den FLATE legacy-formen.** De traff aldri
produksjonsformen. Ikke for få tester — tester mot en form som ikke finnes.

**Regelen: produksjonsformen testes FØRST.** Legacy-former beholdes i egen, navngitt
bakoverkompatibilitet-blokk. Skriv én linje i testfila om hvilken form som er produksjonens og
hvorfor. Kanonisk traversering ligger i `@sitedoc/shared/utils/repeaterRad.ts` med tvilling i
`packages/pdf/src/arkivmal/repeaterRad.ts` (dep-regelen tvinger to; **ikke lag en tredje**).

#### 4. 🔴 Simulatoren er ikke telefonen — lag 2 slapp gjennom to ting på ett døgn

**PDF-forhåndsvisningen** ble meldt grønn på simulator og hang på Kenneths iPhone.
**Kø-robusthetsrunden** var kodegjennomgått, gatet og verifisert — og køen leverte likevel ikke
uten `r` på enhet.

Simulatoren er fortsatt riktig port før bygg (den fanget mye), men **en flate som handler om
timing, nett eller WebView-livssyklus er ikke verifisert før den er sett på en fysisk enhet.**

Kenneth satte opp lokal Xcode-signering 03.–04.09 nettopp for dette. Sløyfen er nå:
kode → `r` i Metro → ekte telefon, uten byggkvote. **Bruk den.**

#### 5. 🔴 Mildne aldri et funn til noe mindre enn utfallet brukeren opplever

Tre ganger samme døgn beskrev cowork et funn som mindre enn det var:

- «Badgen viser at vedlegg lastes opp» — sagt om en skjerm der fire bilder var i ferd med å
  forsvinne. Kenneth: *«bare fortsett å forsvare feil.»*
- «Visning, ikke datatap» — fordi radene fantes i SQLite. Kenneth: `r` finnes ikke for en tømrer;
  for brukeren var bildene borte.
- «Du leter på feil sted» — om en byggeplass-chip som returnerte `null` uten feilmelding når
  timer-cachen var tom.

> **Kenneth 2026-09-03:** *«Istedenfor å forsvare tidligere valg og si at jeg leter på feil plass,
> så må man erkjenne at vi endret ikke på riktig plass når enkel logikk ikke fører til målet.»*

🔴 **Akseptkriteriet som følger, og som gjelder hver runde:** en endring er ikke levert før noen
som **ikke vet hva som ble endret** kan finne den. En komponent som finnes i koden er ikke en
endring brukeren har fått. Verifiseringsordrer skal derfor be om **hvor** noe ble funnet og **hvor
mange trykk** det tok — ikke bare om det virker.


### 🔴 `as unknown as` skjuler manglende felt — tre feil på to dager

Mønsteret: en komponent caster et objekt til en type som lover felt objektet ikke har.
Kompilatoren tier, feltet leses som `undefined`, og symptomet dukker opp langt unna.

| Dato | Sted | Symptom |
|---|---|---|
| 08-22 | sjekkliste-siden leste `sjekkliste` (skjema-hook) i stedet for `fullSjekkliste` | dokument-lokasjon arvet ikke |
| 08-23 | oppgave-siden leste omformet objekt uten `drawing`/`positionX` | «LOKASJON Ikke satt» på data som fantes |
| 08-22 | cowork brukte `grep -c "slettFeil"` som bevis; kallet het `setSlettFeil` | tsc-feil nådde Docker-bygget |

**Regel:** når en verdi «forsvinner» uten feilmelding, mistenk casten før logikken. Erstatt
`as unknown as` med en typet hjelper som leser fra den rå kilden — da sier kompilatoren fra
neste gang. Og et grep-treff på null er ikke bevis for fravær; kompilatoren og databasen er
fasit, ikke søkemønsteret.


### 🔴 En kommentar som lover mer enn koden holder — tre ganger på én dag (2026-08-23)

Samme feilform tre ganger, i tre ulike lag:

| Sted | Kommentaren lovet | Koden gjorde |
|---|---|---|
| `opplasting.ts` (mobil) | «`filnavn` bæres som multipart-filnavn så MIME-utledningen og filtype-blokklista fungerer» | `filnavn` ble aldri sendt — kun logget. `uploadAsync` har ingen filnavn-opsjon |
| `dagsseddel.ts` (api) | «KUN beløp + kategorinavn» over et `utlegg`-oppslag | `include` uten `select` → alle skalarfelt, inkl. `kommentar` (`@db.Text`) |
| `SAMARBEIDSREGLER.md` selv | «Kjeden er selv-gatende: feiler typecheck, kjøres verken tester eller deploy» | `cmd \| grep \| tail` returnerer `tail` sin kode — alltid 0 |

**Regelen, formulert av dokgen:** *skriver du «KUN X» i en kommentar, skal konstruksjonen håndheve
X — ikke dokumentere en intensjon.* Prisma: `select`, aldri `include`, når kommentaren avgrenser.
Bash: `set -o pipefail` eller eksplisitt `exit=$?`, aldri en pipe som gate.

**Hvorfor den er farlig og ikke bare slurv:** en kommentar som overdriver leses som en garanti av
neste leser, og da slutter noen å måle. Alle tre tilfellene ble funnet ved måling, ingen ved
lesing. Den sterkeste formen er en garanti ved konstruksjon — som `SheetUtleggVedlegg`, der svak
FK uten `@relation` gjør vedlegg umulig å dra med. Da er kommentaren en observasjon, ikke et løfte.


## Belegg for arbeidsrutinene (utdyper § Arbeidsrutiner for en fersk cowork)

> ⚠️ **Erstattet 2026-08-20:** en tidligere «Statustavle»-seksjon her sa at tavla skulle
> **tømmes ved rundeslutt**. Det ville slettet registeret over hvilke agenter som finnes —
> nøyaktig feilen som gjorde at cowork mistet oversikten uten at Kenneth merket det. Tavla
> er permanent; rader legges til og fjernes per agent. Se
> [§ Statustavla er første handling](#-statustavla-er-første-handling--før-du-sier-noe).

Statusfiler er agentens siste kjente tilstand — ikke sannheten om repoet.
Tre feil på én dag (2026-08-15), alle fra samme rot:

- **«PUSHET» er en påstand.** Verifiser med `git branch -r | grep <branch>`
  **før** merge-kommandoen gis. Cowork ga merge-kommandoen i samme melding som
  nudgen som ba agenten pushe → `not something we can merge`.
- **En `BLOKKERT`-status kan være utløpt.** Sjekk med
  `git merge-base --is-ancestor <sha> develop`. Utlegg stod blokkert i to dager
  og ventet på test-deploy av `ae752b34`, som lå i develop hele tiden. Agenten
  kan ikke se develop; cowork må løsne den.
- **Verifiser agentens kodepåstand mot koden.** «Samme mønster som
  verifiserAdmin» stemte — men det ble bekreftet i
  `trpc/tilgangskontroll.ts` (fire forekomster), ikke antatt.

**Sesjonsstart: `git status` i hovedtreet.** 2026-08-15 lå 481 linjer ucommittet
der — fire fabel-vedtaksdokumenter i `docs/redesign/` og 80 linjer Kenneth-vedtak
i BACKLOG, én `git checkout` unna å forsvinne. Cowork hadde i tillegg bedt
Kenneth lime inn fabel-dokumenter som allerede lå i repoet. **Søk i repoet før
du ber om noe.**

**Sandkasse-fella:** cowork kjører bash i en Linux-sandkasse uten Mac-stiene
montert. `git worktree list` derfra merker **alle** trær `prunable`, også de som
finnes og er i bruk. Ikke bedøm worktree-tilstand derfra.

**`relay/` finnes KUN i hovedtreet (lærdom 2026-08-17).** Mappa er gitignored, så
den følger aldri med til et worktree. En nudge som sier «les `relay/inbox-x.md`»
sender agenten til en sti som ikke kan eksistere der han står. **Gi alltid full
sti:** `~/Documents/Programmering/SiteDoc/relay/inbox-x.md`.

**Aldri commit:** `tests/e2e/*-state.json` (Playwright storage-state med
session-cookies).


