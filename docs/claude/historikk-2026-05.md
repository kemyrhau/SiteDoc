# Historikk mai 2026

Arkivert fra CLAUDE.md § Pågående arbeid 2026-05-12. Alle PR-er under er deployet til prod og verifisert, med unntak av de markert «DEPLOYET TIL TEST».

---

## standardPauseFra — firma-konfigurerbar pause-default — DEPLOYET TIL PROD 2026-05-28 (prod-merge `75a09ccf`, impl `fdd45949`)

Lukker BACKLOG-entry «Pause-vindu default er midtpunkt av rad-intervallet (oppdaget 2026-05-18)». Erstatter midtpunkt-fallback i `togglePause` med firma-konfigurerbar default som respekterer norsk lunsj-konvensjon.

**Schema:** Nytt felt `OrganizationSetting.standardPauseFra String? @map("standard_pause_fra")` (nullable HH:MM, additivt). Migrasjon `20260528200000_add_standard_pause_fra` opprettet manuelt (shadow-DB krever pgvector som ikke er installert lokalt).

**Server (`apps/api/src/routes/organisasjon.ts`):** `hentArbeidstidDefaults.select` utvidet med `standardPauseFra` (mobil-cache). `oppdaterSetting`-Zod-input får `standardPauseFra: union(HH:MM-regex | null).optional()` — `null` nullstiller, ingen verdi = uendret. `hentSetting` returnerer feltet automatisk via Prisma default-select.

**Web UI (`firma/innstillinger/page.tsx`):** `StandardArbeidstidSeksjon` har ny `<input type="time">` for «Pause fra (valgfri)» mellom pause-min og tidsrunding. Tom streng = null = ingen firma-default (fallback til midtpunkt).

**togglePause-logikk (`RedigerRadModal.tsx`):** `standardPauseFra` + `standardPauseMin` hentes fra `setting`-queryen og sendes som props til `KompaktTimerRad`. Ny togglePause-rekkefølge: (1) har pause → fjern; (2) firma-default satt + vinduet `[standardPauseFra, standardPauseFra + standardPauseMin]` ligger innenfor rad-intervallet → bruk default; (3) ellers midtpunkt-fallback.

**Eksempel:** Rad 07:00–15:00 med firma-default 11:30 (30 min) gir 11:30–12:00 (matcher norsk lunsj). Kveldsskift 17:00–22:00 ligger utenfor default-vinduet → midtpunkt-fallback 19:15–19:45.

**Mobil:** Drizzle-kolonne `standardPauseFra` på `organizationSettingLocal` (nullable). Idempotent `PRAGMA table_info` + `ALTER TABLE ... ADD COLUMN` i `migreringer.ts`. `organizationSettingKatalog.refresh` skriver verdien fra server. Mobil-UI bruker IKKE togglePause-mønsteret — pause er sedel-nivå med eksplisitte fra/til-felter. Cache populerer for fremtidig bruk.

**i18n:** 2 nye nøkler (`pauseFra`, `pauseFraHjelp`) i nb + en, auto-oversatt til 13 språk (2439 → 2441).

**Verifisert:** `@sitedoc/api` 0 = 0, `@sitedoc/web` 1 = 1 baseline (vitest), `@sitedoc/mobile` baseline uendret. Prod-merge `75a09ccf` verifisert: `psql sitedoc` viser `organization_settings.standard_pause_fra` eksisterer. HTTP/2 200 på `sitedoc.no/` + `/dashbord/firma/innstillinger`.

**Deploy-disiplin verifisert:** Test-deploy med `&&`-kjeding (ingen pipe-tail), `prisma generate` eksplisitt mellom `migrate deploy` og `pnpm build`, både `sitedoc-test-api` og `sitedoc-test-web` restartet. Prod-deploy samme sekvens. `git checkout develop` etter prod-deploy per ufravikelig regel.

---

## Firma-HMS-dashbord Trinn 1-4 — alle DEPLOYET TIL PROD 2026-05-29

Komplett firma-nivå-HMS-aggregering på tvers av alle firma-prosjekter, levert i to bunker samme dag. Lukker BACKLOG-entry «Firma-nivå HMS-dashboard — aggregering på tvers av prosjekter» (alle 4 trinn ✅ ferdig).

### Trinn 1-3 — prod-merge `526db462` (16 commits)

**Hovedcommits:**
- `93970feb` — Trinn 1 (server-rolle-fundament): `harFirmaHmsTilgang(userId, organizationId)` i `tilgangskontroll.ts` (sitedoc_admin / firma-admin / `firmaRoller.includes("hms_ansvarlig")`), ny `settFirmaHmsAnsvarlig`-mutasjon i `organisasjon.ts` (speil av `settFirmaAdmin`).
- `e56434bf` — Trinn 2 (server-data): `byggHmsSynlighetsFilter` utvidet med firma-HMS-bypass på prosjekt-nivå. Ny `hms.hentFirmaOversikt`-prosedyre med asymmetrisk byggeplass-filter (Task via `drawing.byggeplassId`, Checklist direkte) og statistikk-aggregering (4 KPI-er).
- `8a632248` — Trinn 3 (klient-side): Ny rute `/dashbord/firma/hms/page.tsx` med URL-state for `prosjekt`/`byggeplass`/`tab`, fire faner (Avvik / SJA / RUH / Statistikk), StatistikkPanel med 4 KPI-kort + topp-10 åpne avvik per prosjekt + SJA-frekvens 12-mnd + RUH-rate 12-mnd. HMS-komponenter (`KpiKort`, `MånedSøyler`, `FaggruppeBars`, `AvvikTabell`/`SjaTabell`/`RuhTabell`, format-helpers) refaktorert til `apps/web/src/components/hms/{visning.tsx,tabeller.tsx,types.ts}`. Prosjekt-nivå-HMS-page bruker nå shared-komponentene uten funksjonell endring. Drill-ned navigerer til prosjekt-detalj basert på subdomain. Nav-lenke i `firma/layout.tsx` med ny `kreverHmsTilgang`-gating-felt.

**Etterfølgende fixes + UX-iterasjoner samme dag:**
- `eb5f9969` — fix: hook-order-violation (`tilgjengeligeByggeplasser`-useMemo flyttet over early returns) — løste «client-side exception» som ble synlig først etter clean rebuild.
- `6d601291` — feat: filter-panel redesign — chips erstattet med `MultiComboks` (multi-select-combobox) + `SearchInput`-fritekst øverst.
- `00763bd9` — fix: `MultiComboks` UX — valgte vises som chips under nedtrekksknappen (alltid synlig, X-knapp for å fjerne); søkefelt i dropdown er alltid synlig (ikke gated på >7 options).
- `8b00539a` — refactor: `MultiComboks` ekstrahert til delt komponent `apps/web/src/components/ui/MultiComboks.tsx` + ny § «Filter-standard (vedtatt 2026-05-29)» i CLAUDE.md.

**Også deployet i samme merge:** Oppgave-mobil rettighetsoppfølger (`32dd43ac`), HMS-byggeplass-filter innad i prosjektet (`c3dc62c4`).

### Trinn 4 — prod-merge `eacdb40e` (impl `fd4a5916`)

**Del A — Tildeling av `hms_ansvarlig` i `firma/ansatte/page.tsx`:**
- `RedigerModal` utvidet med ny checkbox-rad under firma-admin-checkbox, med `ShieldAlert`-ikon (grønn) og hjelpetekst. Speiler `settFirmaAdmin`-mønsteret: lokal state `erHmsAnsvarlig` initialisert fra `bruker.firmaRoller`, `settFirmaHmsAnsvarlig.mutateAsync` kalles bare hvis verdien er endret.
- `InviterModal` utvidet på samme måte. `inviterBruker`-input utvidet med `erHmsAnsvarlig?: boolean`; `firmaRoller`-arrayen bygges nå konkatenativt (`firma_admin` og/eller `hms_ansvarlig`).
- Tabellrad viser grønn HMS-ansvarlig-chip ved siden av rolle-chip (kan vises parallelt med firmaadmin-chip).

**Del B — `FirmaHurtigModal` (B1: minimal hurtig-modal):**
- Ny komponent `apps/web/src/components/hms/firma-hurtig-modal.tsx` — status-dropdown (gyldige overganger via `isValidStatusTransition`) + intern kommentar-tekstboks (maks 2000 tegn).
- Ny prosedyre `hms.firmaBehandleAvvik(organizationId, taskId, nyStatus?, kommentar?)` — bypasser flyt-rolle-validering. Tilgang via `harFirmaHmsTilgang`. Verifiserer at oppgaven hører til orgen via `Project.primaryOrganizationId` og at `template.domain === "hms"`. Status-overgang valideres på server med `isValidStatusTransition`. Oppretter `TaskComment` ved kommentar.
- `AvvikTabell` fikk valgfri `onHurtigBehandle`-prop. Når satt vises "Behandle"-knapp i ny kolonne med `e.stopPropagation()` så rad-klikk (drill-ned) ikke utløses. Andre callere uberørt.
- Bevisst begrensning: kun avvik (Task) får hurtig-behandling. SJA/RUH (Checklist) har ikke ChecklistComment-tabell — behandling for dem skjer best via drill-ned. Drill-ned forblir hovedflyt for alle dokumenttyper.

**i18n totalt over hele bunken:** ca. 30 nye nøkler (nb + en) auto-oversatt til 13 språk via `generate.ts`.

**Vedtak om rolle-modell (2026-05-29):** `OrganizationMember.firmaRoller` (eksisterende `String[]`) utvides med `"hms_ansvarlig"`-verdi i stedet for å introdusere en separat `OrganizationGroup`-tabell. Ingen schema-endring. To separate HMS-roller eksisterer side om side: firma-HMS-ansvarlig (denne PR) ser alt på tvers av prosjekter via bypass i `byggHmsSynlighetsFilter`, prosjekt-HMS-ansvarlig (`ProjectGroup` med `domains: ["hms"]`, eksisterende) gir prosjekt-lokal HMS-tilgang. De kan tilhøre ulike personer.

**Deploy-hendelser samme dag:**
- Test-deploy etter Trinn 3 ble truffet av Turbo-cache-bug (`Could not find a production build` + `clientModules`-feil). Løst manuelt: `rm -rf apps/web/.next && pnpm build --force && pm2 restart sitedoc-test-web`. `deploy-test-cron.sh` (server-side) mangler fortsatt `--force`-fiks — kjent issue.
- Klient-side-exception etter første Trinn 3-deploy avdekket hook-order-violation: `tilgjengeligeByggeplasser`-useMemo lå etter 3 early returns. Fix `eb5f9969` flyttet data-ekstraksjon + useMemo over early returns.

**Verifisering:** `@sitedoc/web` + `@sitedoc/api` typecheck grønt på alle 4 trinn. HTTP/2 200 på `sitedoc.no/` + `/dashbord/firma/hms` + `/dashbord/firma/ansatte` etter prod-deploy. Visuell verifisering i nettleser som innlogget bruker gjenstår per «prod-verifisering må alltid gjøres som innlogget bruker»-regel.

---

## utloperVed-fix i admin.hentImpersoneringStatus — DEPLOYET TIL PROD 2026-05-28 (prod-merge `1d432aed`, impl `6d9b5479`)

`hentImpersoneringStatus` returnerte hardkodet `utloperVed: null`. Endret til å slå opp `Session.impersonationExpiresAt` via `ctx.sessionToken` og returnere ISO-streng. Tidlig-return-sjekken utvidet med `!ctx.sessionToken`.

Ingen breaking change — klienten (`ImpersoneringBanner.tsx`) leser ikke `utloperVed` i dag, så returtype-utvidelsen fra `null` til `string | null` har null konsekvens. Forbereder fremtidig polish hvor banner kan vise countdown eller skjules automatisk ved utløp.

Sammenfallende BACKLOG-statusoppdateringer (audit 2026-05-28):
- **Firma-administrasjons-navigasjon strukturell rydding** → ✅ FERDIG. Alle 3 lag i mål: rename (`f3b8bb1a` + `e7168b32`), 100% server-orgId-input (kompetanse `opprett/oppdater/slett` utleder via `verifiserKompetanseSkriveTilgang` per design; vareImport 2/2 — tidligere telle-feil), 10/10 firma-sider bruker `useFirma()`.
- **Vis som bruker (impersonering)** → 🟡 med kun audit-log igjen. Schema, 3 server-prosedyrer, context, UI (`ImperserKnapp` + `ImpersoneringBanner` montert i `dashbord/layout.tsx`), i18n alt på plass. Audit til Activity-tabell krever schema-beslutning (null-projectId eller separat tabell), estimat 1-2t.

**Verifisering:** `@sitedoc/api` typecheck rent. Test-deploy auto-trigget før prod-merge. HTTP/2 200 på `sitedoc.no` + `api.sitedoc.no/health` etter prod-deploy.

---

## i18n maskinAvArbeid kildetekst-forenkling + 2 BACKLOG-drift-fjernelser — DEPLOYET TIL PROD 2026-05-28 (prod-merge `ba1a5056`, impl `f4f1cebb`)

Tredje av topp-3-kandidatene fra audit 2026-05-28.

**Engelsk kildetekst:**
- Før: «Machine hours {{maskin}}h of work hours {{arbeid}}h»
- Nå: «Machine {{maskin}}h / Work {{arbeid}}h»

**Norsk speilet:**
- Før: «Maskintimer {{maskin}}t av arbeidstimer {{arbeid}}t»
- Nå: «Maskin {{maskin}}t / Arbeid {{arbeid}}t»

Kort, klar struktur med universell slash-separator. Auto-oversetting via `generate.ts` produserer nå gramatisk korrekte oversettelser på alle 13 målspråk.

**Prosess:**
1. Forbedret kildetekst i `nb.json` + `en.json`
2. Slettet nøkkelen i 12 språk (`sv`, `lt`, `pl`, `uk`, `ro`, `et`, `fi`, `cs`, `de`, `ru`, `lv`, `sq`) via Node-script
3. Kjørte `generate.ts` uten `--force` (fyller kun manglende nøkler — fr beholdt sin manuelle verdi fra `baa462e1`)
4. Manuell ro-fix: Google Translate hoppet over «Work» → satt til «Lucru»

**Sammenfallende BACKLOG-rydding:**
- «Attestering edit-modus bugs (2026-05-16)» markert som ✅ LØST. Verifisert mot kode: T7-2e (`c480fe8a`, prod-deploy via `86fdb5a3`) fikset Bug 1 (`min-w-[120px]` + clamp `step ≤ 1800`) og Bug 2 (lokal `timerStr`-state, parse ved blur). Entry var hjemløs drift.
- maskinAvArbeid-entry strammet til peker mot denne implementasjonen.

**Deploy-hendelse:** Test-deploy ble truffet av Turbo-cache-bug — `Could not find a production build` + `clientModules`-feil i klient. Løst manuelt: `rm -rf apps/web/.next && pnpm build --force && pm2 restart sitedoc-test-web` (1m47s, 0 cache-hits). Kjent issue dokumentert i CLAUDE.md; rotårsak: `deploy-test-cron.sh` mangler `--force` (server-side, ikke i repo).

**Verifisering:** UI-konsumenten `EcoBucketEdit.tsx:896` er uendret. HTTP/2 200 på prod.

---

## T7-5h — Stille overskriving av manuelt-justert rad.timer — DEPLOYET TIL PROD 2026-05-28 (prod-merge `6fd294d1`, impl `82cd65fa`)

**Bug:** `beregnTimerMedPause` i `apps/web/src/components/attestering/RedigerRadModal.tsx` overskrev `rad.timer` ved hver pause- eller fra/til-endring til `rattid − pauseMin/60`. Hvis arbeider hadde gjort manuell justering (f.eks. lagret 7.0t på en 8t-periode for å trekke 60 min skjult lunsj), forsvant justeringen uten varsel ved første pause-toggle eller fra/til-edit. Bug-rapport i [BACKLOG.md § Stille overskriving](BACKLOG.md), oppdaget 2026-05-18.

**Løsning — Variant A' (smart init + opt-in recompute):**
- Nytt state `manueltJustert: Set<string>` (rad-keys).
- Init-deteksjon i `useEffect`: sammenlign lagret `rad.timer` mot `beregnTimerMedPause(...)`-resultatet ved `sheet.pauseFra/pauseTil`. Avvik > 0.01t flagger raden.
- `settPause` og `KompaktTimerRad`-onChange ved fra/til-endring hopper over flaggede rader. Manuell justering overskrives ikke lenger stille.
- Direkte redigering av timer-feltet (onBlur etter parseFloat) markerer raden som manuelt justert.
- Ny ↻-knapp i sekundær-rad under hovedraden (samme stil-mønster som pause-input-raden, amber-farget) — synlig kun når raden er manuelt justert OG default-beregningen avviker > 0.01t fra lagret. Klikk bytter til default + fjerner flagget. Også koblet til onSlett som rydder settet.

**i18n:** 3 nye nøkler — `timer.rediger.manuellJustering`, `timer.rediger.brukDefault`, `timer.rediger.brukDefaultHint`. Auto-oversatt til 13 språk (2404 → 2407 nøkler).

**Bug-scenario som nå er dekket:**
- Lagret rad 07:00–15:00, timer=7.00 (manuelt trukket 60 min)
- Bruker klikker pause-checkbox → tidligere overskrev timer til 7.5
- Nå: 7.00 beholdes; ↻-knapp tilbyr «Bruk 7.50t» hvis bruker ønsker default-beregningen

**Scope:** Kun web. Mobil-komponenter (`apps/mobile/.../TimerRadModal.tsx`) har separat recompute-logikk og er ikke berørt — egen sub-PR ved behov.

**Verifisering:** Typecheck 1 = 1 baseline (vitest). Test-deploy `82cd65fa` på `test.sitedoc.no` HTTP 200. Prod-deploy `6fd294d1` med Turbo 3 successful / 1m20.947s; `sitedoc.no` + `api.sitedoc.no/health` HTTP/2 200 etter PM2 restart.

**Avhengige tickets fortsatt åpne (BACKLOG):**
- Pause-vindu default = midtpunkt (`OrganizationSetting.standardPauseFra` mangler i schema)
- Multi-rad-overlap pause — ikke håndtert
- `utleie_enhet`-prinsipp i UI

---

## Returnert→pending-reset ved re-send + fr.json pause-drift — DEPLOYET TIL PROD 2026-05-27 (prod-merge `baa462e1`, impl `da0b2aad`)

To uavhengige fixes bundlet i én bunke.

### Returnert→pending-reset ved re-send

**Bug:** `send`-mutationen i `apps/api/src/routes/timer/dagsseddel.ts:931-957` aksepterte både `"draft"` og `"returned"` som inngangs-status, men oppdaterte kun `sheet.status: "sent"` — rader med `attestertStatus: "returnert"` (satt av leder-returnering) forble returnert etter re-send. Det blokkerte attester-mutationen som krever pending («Kun rader med status «pending» kan attesteres», linje 1538).

Returner-kommentaren linje 1729-1731 sa eksplisitt: «Pending-rader på samme sedel forblir pending — håndteres ved re-attestering etter at arbeider sender på nytt.» — design-intensjonen var der, men implementasjonen manglet.

**Fix:** Når `sheet.status === "returned"` ved send, kjør `$transaction` som setter `attestertStatus = "pending"` + nullstiller `attestertAvUserId` + `attestertVed` på alle tre tabeller (sheet_timer, sheet_tillegg, sheet_machines). Audit-spor flyttes til Activity-tabellen (T7-2b3 i BACKLOG). draft → sent-flyten urørt (rader er pending fra opprettelse).

**Backfill-vurdering:** SELECT mot prod-DB:
```sql
SELECT count(*) FROM timer.daily_sheets ds WHERE ds.status = 'sent'
AND (EXISTS (SELECT 1 FROM timer.sheet_timer WHERE sheet_id = ds.id AND attestert_status = 'returnert')
  OR EXISTS (SELECT 1 FROM timer.sheet_tillegg WHERE sheet_id = ds.id AND attestert_status = 'returnert')
  OR EXISTS (SELECT 1 FROM timer.sheet_machines WHERE sheet_id = ds.id AND attestert_status = 'returnert'));
```
Resultat: 0 rader. Ingen migrasjon nødvendig — kode-endring alene.

### fr.json pause-drift

Auto-oversettelses-skriptet (`packages/shared/src/i18n/generate.ts`) hadde produsert «saut/casser/rupture» for engelsk «break» — kontekst-tap (Google Translate forveksler «break» som pause/avbrudd med «break» som hopp/knekke). Fire nøkler rettet i `packages/shared/src/i18n/fr.json`:

| Nøkkel | Før | Etter |
|---|---|---|
| `timer.gruppe.maskinAvArbeid` | Klønete ord-for-ord | «Heures machine {{maskin}}h sur {{arbeid}}h de travail» |
| `timer.rediger.pause.label` | «Casser» | «Pause» |
| `timer.rediger.pause.toggleHint` | «un saut» | «une pause» |
| `timer.rediger.pause.intervall` | «Fenêtre de rupture :» | «Fenêtre de pause :» |

Trivielt manuelt fix — auto-oversettelse-skript ikke kjørt på nytt (de tre andre språkene har eget kontekst, ikke samme drift).

### Verifikasjon

API typecheck 0 nye feil. Ingen schema-endring, ingen mobil. Prod-deploy 2026-05-27 ~20:25 UTC. `sitedoc.no/logg-inn` + `api.sitedoc.no/health` HTTP 200.

Lukker BACKLOG-entries: «Returnert→pending-reset ved `sendTilAttestering`» og «i18n: `pause.toggleHint` (fr) — «saut» i stedet for «pause»».

---

## lagContextStamme-refaktor + B5 maskin-av-arbeid i SeddelKort — DEPLOYET TIL PROD 2026-05-27 (prod-merger `77e6553d` + `f7a836f8`)

To uavhengige UI-/refaktor-PRer deployet samme kveld etter H1-bunken.

### lagContextStamme-refaktor (prod-merge `77e6553d`, commit `ecdc60a4`)

Eliminerer kilden til H1-deploy-hendelsen tidligere samme dag (`29bdded8` web-bygg-feil pga manglende Context-felter). `apps/web/src/app/api/trpc/[...trpc]/route.ts` lagde sin egen Context-instans uten å arve felter fra `apps/api/src/trpc/context.ts:createContext`. Type-skift fanges ikke i API-typecheck og bryter web-bygg ved deploy.

**Løsning:** Ny eksportert `lagContextStamme(input: ContextStammeInput)` i `apps/api/src/trpc/context.ts` bygger felt-stammen (alle Context-felter unntatt `req`/`res` som varierer mellom runtimes). Både Fastify-`createContext` og web-route spreader inn resultatet + legger på runtime-spesifikk `req`/`res`.

Type-skift på Context krever nå endring av enten `ContextStamme`-return-type eller `ContextStammeInput` — TypeScript-kompilatoren tvinger oppdatering av begge kallsteder. H1-hendelsen ville vært fanget av typecheck.

**Auth-utledning forblir bevisst forskjellig:**
- API (Fastify): direkte DB-lookup på sessionToken, støtter både cookie og Bearer
- Web (Next.js): `auth()` fra next-auth + separat impersonering-DB-lookup. Kun cookie-flyt.

Helperen håndterer kun felt-stammen, ikke auth-flyt.

**Cleanup:** Web-routen fjerner ubrukte `prismaMaskin`/`prismaTimer`/`prismaVarelager`-importer (kommer nå fra helper). `prisma`-import beholdt for impersonering-lookuppen.

Ren type-refaktor. Ingen runtime-endring, ingen schema. Typecheck 0 nye feil i begge apper.

### B5 — maskin-av-arbeid-validering i SeddelKort (prod-merge `f7a836f8`, commit `d6f3d914`)

Maskin > arbeidstimer-validering var kun synlig i detalj-siden via `EcoBucketAttest` (`attestering-buckets.tsx:642-656`). I attestering-listen måtte prosjektleder åpne hver sedel for å sjekke om maskinbruken passet arbeidstiden.

**Endringer:**
- `AttesteringRad` (`apps/web/src/app/dashbord/firma/timer/attestering/page.tsx`) og `SeddelKortData` (`apps/web/src/components/attestering/SeddelKort.tsx`) utvidet med `pauseMin: number`. Server returnerer feltet allerede via `...s`-spread i `hentTilAttesteringFirma` — eksplisitt typedef for kompilator-fanging.
- `SeddelKort` beregner `sumMaskin = sedel.maskiner.reduce(...)`, `pauseTimer = sedel.pauseMin / 60`, `maskinOk = sumMaskin <= sedel.totaltimer + pauseTimer + 0.001`, `maskinOver = sumMaskin > 0 && !maskinOk`. Samme invariant som EcoBucketAttest (T.7 2026-05-18 — døgn-utleide maskiner går mens operatør pauser).
- Auto-expand-trigger utvidet: `oransje || harMertid || maskinOver`. Leder ser detaljene umiddelbart ved invariant-brudd. State er ikke låst — bruker kan kollapse manuelt.
- Ny validerings-rad i tabellen under eksisterende sum-rad. Grønn/rød badge gjenbruker i18n-nøkkel `timer.gruppe.maskinAvArbeid` — ingen nye språkfiler.

**Bevisst utelatt:** Indikator i kollapset header. Auto-expand er primær-signal. Vurderes som oppfølger hvis kundefeedback tyder på behov.

Ingen schema-endring, ingen mobil. Typecheck 0 nye feil.

### Deploy-erfaring (positiv kontrast til tidligere H1-hendelse)

Begge bunker deployet med ny `&&`-kjede-bash uten `| tail -5`-pipe (CLAUDE.md-regel `95ff4a07`). Build kjørte rent, PM2 restartet kun etter at hele kjeden lykkes. Ingen fall-tilbake til gammel kode mot nytt schema.

---

## H1 — mobil token-rotasjon ved bruk — DEPLOYET TIL PROD 2026-05-27 (prod-merge `29bdded8` + web-fix `43460d80`)

Siste sikkerhets-audit-funn fra 2026-05-27. Mobil session-token roteres nå ved aktiv bruk hvis token er eldre enn 7 dager, ikke kun ved app-oppstart (`mobilAuth.verifiser`). Reduserer token-eksponering ved lekkasje fra 30 dager worst-case til 7 dager.

### Schema + migrasjon (`20260527200000_session_rotation_tracking`)

To nye felter på `Session`:
- `createdAt DateTime @default(now())` — opprinnelig session-opprettelse, røres aldri etter init
- `lastRotatedAt DateTime @default(now())` — siste rotasjons-tidspunkt, brukes av middleware-terskel

Migrasjons-strategi:
1. `ADD COLUMN` (nullable først)
2. Backfill: `created_at = last_rotated_at = expires - INTERVAL '30 days'` for eksisterende rader (worst-case-antagelse: alle eksisterende sessions ~30 dager gamle)
3. `SET NOT NULL` + `SET DEFAULT CURRENT_TIMESTAMP`

Backfill-konsekvens: alle eksisterende mobil-sessions roteres ved første mutation hvis `expires > now + 7d` (typisk). Helt nye sessions ved deploy får 7 dagers grace.

### Server-arkitektur (commit `0c62231d`)

**`apps/api/src/trpc/context.ts`** — utvidet:
- Skille `tokenKilde: "bearer" | "cookie" | null` basert på om cookie-regex eller `Authorization`-header ga treff
- Mutable `nyttSessionTokenForRespons: { value: string | null }` for middleware → responseMeta-kommunikasjon

**`apps/api/src/trpc/trpc.ts`** — ny `mobilTokenRotasjon`-middleware på `protectedProcedure` (etter rate-limit). Trigger-vilkår (alle må være sanne):
- `type === "mutation"` (queries roterer ikke — for hyppig)
- `ctx.tokenKilde === "bearer"` (web-cookie eies av Auth.js)
- `ctx.sessionToken` satt
- `session.lastRotatedAt < now - 7d`

Race-vern: `UPDATE sessions ... WHERE id = session.id AND session_token = oldToken` — parallelle mutations som begge prøver å rotere får én vinner (idempotent). Rotasjons-feil logges som warning men velter aldri handler-responsen.

**`apps/api/src/server.ts`** — `responseMeta` på `fetchRequestHandler` leser `ctx.nyttSessionTokenForRespons.value` og setter `X-Session-Token`-respons-header når rotasjon skjedde.

**`apps/api/src/routes/mobilAuth.ts`** — `byttToken` setter `createdAt` + `lastRotatedAt` eksplisitt ved Session.create. `verifiser`-rotasjonen ved oppstart oppdaterer nå også `lastRotatedAt`.

### Mobil-klient (commit `0c62231d`)

`apps/mobile/src/lib/trpc.ts` `httpBatchLink` fikk custom `fetch` som leser `X-Session-Token` fra respons-header. Hvis satt: kall `lagreSessionToken(nyttToken)` (SecureStore på native, localStorage på web). Neste request bruker automatisk det nye tokenet via `headers()`-callback. SecureStore-feil svelges stille (gammel token virker inntil neste rotasjon).

### Deploy-hendelse: web-bygg feilet ved første forsøk

`apps/web/src/app/api/trpc/[...trpc]/route.ts` lager egen Context-instans direkte (ikke via `createContext`-helperen). Da Context-typen ble utvidet med `tokenKilde` + `nyttSessionTokenForRespons`, kompilerer `apps/api` fortsatt, men `apps/web#build` feilet:

```
Type '{ ...; sessionToken: string | null; }' is not assignable to
type '{ ...; nyttSessionTokenForRespons: { ... }; ... }'
```

Migrasjonen kjørte først, deretter feilet web-bygg, men PM2 restartet web likevel på gammel kode. DB var på nytt schema i ~25 min mens web kjørte gammel kode. Risiko-vurdering: defaults dekket gammel kode (nye felter har `@default(now())`), så ingen funksjonell regresjon.

**Fix (`4e353118`):** Speil de to nye Context-feltene i web-routen — `tokenKilde: "cookie"` når sessionToken satt, ellers `null`. `nyttSessionTokenForRespons: { value: null }` (aldri brukt på web pga middleware filter). Re-bygg + restart, alt OK.

**Lærdom notert i BACKLOG:** Web-routen lager egen Context istedenfor å bruke delt helper — type-skift på Context kan bryte web-bygg uten å fanges av API-typecheck. Tilleggslærdom: prod-deploy-bash bør feile hard på `pnpm build` exit ≠ 0 og IKKE kjøre PM2 restart. I dag restartet PM2 selv om Turbo rapporterte exit 1.

### Verifikasjon

- API typecheck: 0 nye feil. Mobile typecheck: 12 = 12 baseline.
- Migrasjon kjørt mot prod-DB: `created_at` + `last_rotated_at`-kolonner finnes, eksisterende sessions backfillet.
- `sitedoc.no/logg-inn` + `api.sitedoc.no/health` HTTP 200 etter web-fix.

### Gjenstående oppfølgere

- **Race-handling på mobil ved samtidige mutations:** to parallelle mutations kan begge motta `X-Session-Token`; siste skrivning vinner. Worst case: én 401 + automatisk re-fetch. Dokumentert som akseptert risiko.
- **Device-fingerprint** vurderes som forsterkning senere PR — ikke i denne runden.

---

## Fastify-logger leser cf-connecting-ip + H2 streng invitasjon-match — DEPLOYET TIL PROD 2026-05-27 (prod-merge `b97494cd`)

Oppfølger-bunke etter M1. To uavhengige fikser bundlet i én prod-deploy.

### Fastify-logger leser cf-connecting-ip (commit `8d7646b3`, lav prio)

Custom request-serializer i `apps/api/src/server.ts` brukte `req.ip` direkte. Gjennom Cloudflare Tunnel + cloudflared (WSL2 Mirror Mode) returnerer det server-WAN-IP (`193.90.181.205`), ikke faktisk klient-IP. Rate-limit-koden brukte allerede `hentKlientIp(req)` som leser `cf-connecting-ip` — loggeren var inkonsistent.

**Fix:** Serializer leser nå `cf-connecting-ip`-header først, faller tilbake til `req.ip`. Speiler logikken fra `apps/api/src/utils/rateLimiter.ts:hentKlientIp`. Forbedrer observability uten å røre rate-limit-funksjonalitet.

### H2 — streng case-sensitive invitasjon-match (commit `921024b8`, høy prio, sikkerhet)

Siste lavt-hengende funn fra sikkerhets-audit 2026-05-27. `apps/web/src/auth.ts` signIn-event brukte `email: { equals: user.email, mode: "insensitive" }` ved auto-aksept av invitasjoner. Sårbar mot case-folding-vektor: angriper kunne opprette Google-konto `john@x.com` og auto-akseptere en invitasjon registrert med `JOHN@x.com`.

**Fix i tre lag:**
1. `apps/api/src/routes/medlem.ts:267` — `ProjectInvitation.create({ data: { email: user.email.toLowerCase() } })`
2. `apps/api/src/routes/gruppe.ts:381, 390` — samme normalisering for både `findFirst` pending-sjekk og `create`
3. `apps/web/src/auth.ts:63` — bytt `mode: "insensitive"` → streng `email: user.email.toLowerCase()`

**Backfill:** Prod-DB og test-DB sjekket før implementasjon — 0/5 og 0/10 rader hadde mixed-case e-post. Ingen migrasjon nødvendig; alle eksisterende rader matcher allerede.

**Gjenstår i [BACKLOG](BACKLOG.md):** H1 (mobil session-token rotasjon, ~3t) er siste sikkerhets-audit-funn.

**User.email-normalisering** ikke rørt — krever bredere refaktor av PrismaAdapter + Auth.js OAuth-flyt. Tas som separat oppfølger dersom konkret risiko verifiseres.

**Verifisert:** API + web typecheck 0 nye feil. Prod-deploy 2026-05-27 ~18:00 UTC. `sitedoc.no/logg-inn` + `api.sitedoc.no/health` HTTP 200. Innlogget verifikasjon som Kenneth bekreftet normal render.

---

## M1 — global tRPC-rate-limit + Cloudflare klient-IP — DEPLOYET TIL PROD 2026-05-27 (prod-merge `54885eb2`)

Sikkerhets-audit M1-funn. Implementert i fire trinn over tre commits etter at audit-bunken var deployet til prod.

### Trinn 0 — trustProxy + custom request-serializer (commit `e480b48f` → justering `251d38ad`)

Fastify hadde ingen `trustProxy`-config — alle prod-klienter så ut som `127.0.0.1` fordi cloudflared proxy-er til Fastify lokalt. Forutsetning for at rate-limit per IP gir mening.

**Førstegangs forsøk (`e480b48f`):** `trustProxy: "127.0.0.1"`. Verifisering på test viste at `req.ip` fortsatt var `193.90.181.205` (server-WAN-IP). Rotårsak: cloudflared kjører på Windows-host og treffer Fastify via WSL2 Mirror Mode, så proxy-IP er Windows-host-IP, ikke loopback. Eksplisitt allowlist matchet ikke.

**Korrigering (`251d38ad`):** `trustProxy: true`. Trygt fordi Fastify aldri eksponeres direkte — alltid bak cloudflared. Verifisert at curl med `X-Forwarded-For: 9.9.9.9` gir `remoteAddress: 9.9.9.9` i logger.

**Custom request-serializer:** Logger nå `req.ip` som `remoteAddress` i stedet for TCP-IP. Foreløpig forutsetning for å kunne se klient-IP i logger.

### Trinn 1 — `rateLimiter.ts` utvidet (commit `7a9f172d`)

**Funn:** Selv med `trustProxy: true` viste vanlig prod-trafikk fortsatt `remoteAddress: 193.90.181.205`. Cloudflare Tunnel sender ikke X-Forwarded-For med klient-IP — den bruker `Cf-Connecting-Ip`-header i stedet. Bekreftet med HTTP 403 ved spoofing-forsøk (Cloudflare blokkerer override av sin egen header).

**Endringer:**
- Ny `hentKlientIp(req): string` — prioriterer `cf-connecting-ip`, fallback til `req.ip`, siste fallback `"unknown"`.
- Ny `sjekkRateLimitDetalj(...): { ok, retryAfterSeconds }` for å støtte Retry-After-info.
- `sjekkRateLimit` beholdt som thin wrapper for bakover-kompat (4 eksisterende kallsteder).
- 4 eksisterende kallsteder (`mobilAuth.byttToken`, `invitasjon.validerToken`, `invitasjon.aksepter`, `/upload`) oppdatert til `hentKlientIp(ctx.req)`. Uten dette ville deres rate-limit fortsatt være effektivt globalt.

### Trinn 2 — tRPC-middleware (Variant B — type-aware i `protectedProcedure`)

`apps/api/src/trpc/trpc.ts` utvidet:
- `lagRateLimitMiddleware(bucket, max, windowMs)` — felles helper. Skipper queries via `type !== "mutation"`-sjekk.
- `standardRateLimit` (100/min per userId) lagt inn i `protectedProcedure` direkte via `.use(...)`. Alle 100+ mutations får automatisk beskyttelse uten kallsted-endringer.
- `inviteProcedure` (10/min per userId) — eksport for invite-mutations.
- `opprettProsjektProcedure` (20/min per userId) — eksport for prosjekt-opprettelse.
- Throttle-hendelser logges som strukturert pino-JSON via `ctx.req.log.info({ bucket, userId, path, retryAfterSeconds }, "rate-limit hit")`.

**Variant-valg:** Type-aware middleware i `protectedProcedure` selv (Variant B) i stedet for eksplisitt `rateLimitProtectedProcedure`-wrapper på 100+ kallsteder (Variant A). Mindre overflate, ingen rull-ut, færre måter ting kan glippe.

### Trinn 3 — sensitive mutations bytter prosedyre

- `organisasjon.inviterBruker` → `inviteProcedure`
- `prosjekt.opprett` + `prosjekt.opprettTestprosjekt` → `opprettProsjektProcedure`
- `admin.opprettProsjekt` → `opprettProsjektProcedure`

### Trinn 4 — telemetri

Integrert i middleware. Throttle-hendelser logges som strukturert info-log med `bucket`, `userId`, `path`, `retryAfterSeconds`.

### Verifisering

- `@sitedoc/api` typecheck 0 = 0.
- `apps/web` typecheck 1 = 1 baseline (vitest).
- Prod: `sitedoc.no` HTTP/2 200, `api.sitedoc.no/health` HTTP/2 200 etter deploy 16:43 UTC.

### Kjente begrensninger

- **In-memory bucket per Node-prosess.** PM2 kjører fork-mode (én prosess) → konsistent state. Hvis vi går til cluster-mode, må vi flytte til Redis.
- **Per-userId only, ikke per-IP.** Misbruk fra delt-IP-network (kontor med 50 ansatte bak NAT) er ikke aggregert. Kan utvides ved behov.
- **`req.ip` i Fastify-logger viser fortsatt server-IP** (`193.90.181.205`) i prod-logger fordi serializeren leser `req.ip` direkte, ikke `cf-connecting-ip`. Rate-limit fungerer korrekt (bruker `hentKlientIp`), men logger-debug viser feil IP. Notert som oppfølger.

### Sideeffekter under deploy

Turbo-cache-bugen rammet test-deployet to ganger (trustProxy- og req.ip-iterasjoner) — krevde manuell `pnpm build --force` for å overstyre. Prod-deployen var ren (alltid 0 cached, 3 total). Permanent server-side-fiks av `deploy-test-cron.sh` er fortsatt en oppfølger.

---

## Sikkerhets-audit-bunke — DEPLOYET TIL PROD 2026-05-27 (prod-merge `9ca0257e`)

Audit utført 2026-05-27 (read-only) avdekket 14 funn. Seks ble utbedret i denne bunken: K1, M2, M3, M4 i én commit (`cdaafe32`), H3 i oppfølger (`6ae317c4`), error-håndtering på `/logg-inn` i siste oppfølger (`a1f33b61`). Resten (M1 global tRPC-rate-limit, H1 mobil-token-rotasjon, H2 case-sensitive invitasjon-match) er ikke startet — anbefalt rekkefølge i audit-rapport.

### K1 — `dev-login` fail-secure (kritisk)

`apps/api/src/routes/dev-login.ts:24-28`. `erDevLoginAktiv()` snudd fra `NODE_ENV !== "production"` til `NODE_ENV === "development"`. Forhindrer at hardkodet test-bruker (`kemyrhau@gmail.com` — Kenneth, sitedoc_admin) eksponeres på prod hvis NODE_ENV glipper i deploy (container-restart med ufullstendig env, deploy-skript-feil, ny servernode). Verifisert at prod har `NODE_ENV=production` og routen forblir 404 etter deploy.

### M2 — Prisma raw query trygd (middels)

`apps/api/src/server.ts:107`. `prisma.$executeRawUnsafe(...)` byttet til tagget template literal `prisma.$executeRaw\`...\``. Hardkodet SQL i dag (recovery av stuck embedding-chunks ved server-oppstart), ingen funksjons-endring, men eliminerer fallgruve hvis en senere endring introduserer variabler.

### M3 — Auth.js session maxAge (middels)

`apps/web/src/auth.ts`. Lagt til `session: { strategy: "database", maxAge: 24 * 60 * 60, updateAge: 60 * 60 }`. Web-sesjon utløper etter 24 timer (tidligere Auth.js default 30 dager). updateAge=1t forlenger sesjonen ved aktivitet hver time. **Konsekvens ved deploy:** Alle eksisterende web-sesjoner ble invalidert — Kenneth og andre web-brukere måtte logge inn på nytt. Mobil-sesjoner ikke berørt (eget 30-dagers token via mobilAuth).

### M4 — Fastify-logger redaction (middels)

`apps/api/src/server.ts:17`. Bytt fra `logger: true` til `logger: { redact: ["req.headers.authorization", "req.headers.cookie"] }`. Forhindrer at session-token havner i serverlogger ved feilsituasjoner. Eksisterende logger-volumer bør sjekkes manuelt for kompromiss — ikke gjort.

### H3 — `allowDangerousEmailAccountLinking: false` (høy)

`apps/web/src/auth.ts:26, 34`. Satt til `false` på både Google og Microsoft Entra ID. Tidligere ville en bruker med samme e-post hos begge providers fått kontoene automatisk linket — en kompromittert Google-konto ga full tilgang til Microsoft-kontoens data, eller omvendt.

**Migrasjons-risiko verifisert null** mot prod-DB før commit: 2 accounts totalt (1 google + 1 microsoft-entra-id), 0 brukere med koblet begge providers. Trygt å aktivere uten å miste eksisterende koblinger.

**Microsoft OAuth-status:** ER live i prod (verifisert: `AUTH_MICROSOFT_ENTRA_ID_ID/SECRET/ISSUER` satt i `apps/web/.env`, login-knapp synlig på `/logg-inn` + `/aksepter-invitasjon`).

### Error-håndtering på `/logg-inn` (oppfølger)

`apps/web/src/app/logg-inn/[[...logg-inn]]/page.tsx`. Tidligere viste siden kun login-knapper uten error-feedback — Auth.js-redirect med `?error=OAuthAccountNotLinked` resulterte i stille login-loop. Nå leses `error`-query-param via `useSearchParams()` og warning-banner vises med spesifikk melding for tre kjente Auth.js-feilkoder + generisk fallback:

- `OAuthAccountNotLinked` → «Du har allerede en konto med denne e-posten. Bruk samme innloggingsmetode som første gang.»
- `AccessDenied` → «Tilgang avvist. Prøv igjen eller kontakt support.»
- `OAuthCallback` → «Innlogging feilet midlertidig. Prøv igjen.»
- Ukjent kode → «Innlogging feilet. Prøv igjen.»

4 nye i18n-nøkler under `auth.feil.*` i nb + en, auto-generert til 13 språk (2404 nøkler totalt).

### Microsoft OAuth-verifisering (audit-funn, ikke en endring)

Bekreftet under audit at Microsoft Entra ID-provider ER aktivert i prod. Tidligere antagelse var at det kun var Google + planlagt Microsoft. Etterforskning av `apps/web/.env` på prod-server viste alle tre AUTH_MICROSOFT_ENTRA_ID_*-vars satt og login-knapp synlig i UI.

### Verifisering

- `@sitedoc/api` typecheck 0 = 0.
- `apps/web` typecheck 1 = 1 baseline (vitest). TS2589 på `oppgaver/page.tsx:333` (sett under filter-rensing-deployen) forsvant under denne kjøringen — sannsynlig tsc-cache-issue tidligere.
- Prod: `sitedoc.no` HTTP/2 200, `sitedoc.no/logg-inn` HTTP/2 200, `api.sitedoc.no/health` HTTP/2 200 etter deploy 15:41 UTC.

### Sideeffekt: Turbo-cache-bug rammet test-deploy igjen

Auto-deploy via `deploy-test-cron.sh` resulterte i 500 på test-siden fordi `pnpm build` cache-hittet på `apps/web#build` selv etter `rm -rf apps/web/.next`. Måtte kjøre `pnpm build --force` manuelt for å bypass Turbo-cache. Prod-deployen var ren (0 cached, 3 total) fordi den var første gang serveren bygget commitene. Server-side fiks av `deploy-test-cron.sh` til å bruke `--force` er en oppfølger — skriptet ligger ikke i repoet.

### Gjenstående fra audit-rapport (ikke startet)

- **M1** — global tRPC-rate-limit per `ctx.userId` + per IP. Spesielt på `inviter*`-mutations som potensielt brukes til e-postspam. Estimat ~2t.
- **H1** — mobil-token-rotasjon eller device-binding for å redusere risiko ved token-lekkasje. Estimat ~3t.
- **H2** — case-sensitive invitasjon-match i Auth.js `signIn`-event. Unicode-confusable-bypass mulig i dag. Estimat ~1t.
- Sjekk eksisterende serverlogger for token-lekkasje før M4-fiks (manuell oppfølger).
- Permanent `deploy-test-cron.sh --force`-fiks (server-side, ikke i repo).

---

## Filter-rensing F1 + Tiltak 1 — DEPLOYET TIL PROD 2026-05-27 (prod-merge `8c256f64`, develop-commit `118c9385`)

To handlingsrettede tickets fra status-audit 2026-05-27. Rene UI-/i18n-endringer, ingen schema-endring.

### F1 — `cancelled` lagt til `LUKKET_STATUSER` i HMS-filteret

`apps/web/src/app/dashbord/[prosjektId]/hms/page.tsx:63`. Tidligere ekskluderte både `ÅPEN_STATUSER` og `LUKKET_STATUSER` `cancelled` — avbrutte HMS-dokumenter forsvant fra listen når `visAlle=false`. Fiks: `LUKKET_STATUSER = new Set(["approved", "closed", "cancelled"])`. Avbrutt er en endelig tilstand, semantisk lik closed/approved. KPI-tellingen `apneAvvik` er uendret — vi vil ikke at avbrutte saker skal telle som åpne.

### Tiltak 1 — «Alle åpne»-snarvei i status-kolonnens filter på oppgaver + sjekklister

Ny `filterSnarveier?: { label: string; verdier: string[] }[]`-prop på `KolonneDef<T>` i `packages/ui/src/table.tsx`. `FilterDropdown` rendrer snarvei-knapper rett under «Alle»-knappen, med `border-b`-skille til alternativ-listen. Klikk setter `onChange(verdier.join(","))` og lukker dropdown. Bruker eksisterende multi-select komma-separert filter-mekanisme — ingen server- eller filter-logikk-endring.

Aktivert på status-kolonnen i `oppgaver/page.tsx` og `sjekklister/page.tsx` med snarvei `[{ label: t("status.alleApne"), verdier: ["draft", "sent", "received", "in_progress", "responded"] }]` — 5 åpne statuser, ekskluderer `approved/closed/rejected/cancelled` per backlog-spec.

HMS-siden bruker binær `visAlle`-toggle (annen UX-modell). Etter F1-fiks er den effektivt en «Alle åpne»-toggle — ikke endret.

### Plassering — viktig avgrensning

Snarveien lever i tabell-kolonne-filter (klikk filter-ikon på Status-kolonneoverskriften), IKKE i sidebar. Det finnes ingen sidebar-filter i oppgaver/sjekklister-sidene. Tabellen rendres bare når prosjektet har minst én oppgave/sjekkliste — på tomt prosjekt vises `EmptyState` og filter-mekanismen er ikke synlig. Mulig oppfølger: flytte filter-mekanikken til sidebar/over-tabell-filterpanel slik at snarvei er synlig også i tomtilstand.

### i18n

Ny `status.alleApne` (nb: «Alle åpne», en: «All open»). Auto-generert til 13 målspråk via `pnpm --filter @sitedoc/shared exec tsx src/i18n/generate.ts` (2400 nøkler totalt).

### Verifisering

- `@sitedoc/ui` typecheck 0 = 0.
- `apps/web` typecheck 2 = 2 baseline (TS2589 på `oppgaver/page.tsx:333` ved `trpc.oppgave.opprett.useMutation` + vitest-typedef). TS2589 er pre-eksisterende (bekreftet ved `git stash`-test før commit). 0 nye feil.
- Prod: `sitedoc.no` HTTP/2 200, `api.sitedoc.no/health` HTTP/2 200 etter `pm2 restart` 14:29 UTC.
- HMS-siden lastet korrekt som innlogget bruker (verifisert av Kenneth).

### Refactor-bidrag

Lokal `KolDef`-interface i `oppgaver/page.tsx:553` (tidligere `Parameters<typeof Table<OppgaveRad>>[0]["kolonner"][number]`) for å matche mønsteret i `sjekklister/page.tsx` og redusere risiko for fremtidig TS2589-pump. Fikset ikke den eksisterende TS2589 på linje 333 — den er ubunnet av denne PR-en.

### Sideeffekt under test-deploy

Auto-deploy via `deploy-test-cron.sh` trakk commiten, men Turborepo cache-hittet på `apps/web#build` selv etter manuell `rm -rf apps/web/.next`. Måtte kjøre `pnpm build --force` for å bypass Turbo-cache og få ny `.next`. Prod-deploy var ren rebuild (0 cached) fordi serveren ikke hadde tidligere Turbo-cache for denne commiten.

---

## Innsender-tilgang i verifiserDokumentTilgang — DEPLOYET TIL PROD 2026-05-27 (prod-merge `b3194f1d`, develop-commit `b4e53e17`)

Tetter sikkerhets-gap i `verifiserDokumentTilgang`: brukere som hadde opprettet eller var direkte mottaker av et dokument fikk FORBIDDEN ved direktelenke-oppslag med mindre de også var i en gruppe som dekket dokumentets faggruppe/domain.

### Reelt scenario som drev fiksen

Arbeider oppretter HMS-avvik via mobilen. Etter epost-notifikasjon klikker de URL i e-posten for å se status — får FORBIDDEN selv om de er innsender. Samme bug rammer mottaker som åpner egen oppgave-direktelenke uten gruppe-medlemskap. Oppdaget under HMS-PR-sikkerhetsanalyse 2026-05-27 (BACKLOG § 1 «Innsender-tilgang»).

### Kode-endring (`apps/api/src/trpc/tilgangskontroll.ts`)

- `findUnique` for `bestillerUserId`/`recipientUserId` løftet ut av firmaansvarlig-grenen til en lokal `dokumentParter`-helper-blokk som kjører **én gang** før forgreningene. Firmaansvarlig-grenen gjenbruker resultatet i stedet for eget DB-kall.
- Ny innsender-gren rett etter firmaansvarlig: gir tilgang hvis `bestillerUserId === userId || recipientUserId === userId`.
- Ingen kallsteder endret — alle 17 i `oppgave.ts`/`sjekkliste.ts` sender allerede `dokumentId` + `dokumentType`.

### Slett-sikring

Status-baserte begrensninger håndheves fortsatt av kallernes egne sjekker **etter** `verifiserDokumentTilgang`. Innsender kan slette eget dokument kun i `draft`/`cancelled`-status (eksisterende `if (status !== "draft" && status !== "cancelled")` i `slett`-mutasjonene matcher Kenneths spec direkte — ingen ekstra `tillatInnsender`-flagg trengtes).

### Verifikasjonsgrunnlag før koding

Opus verifiserte tre konkrete punkter Kenneth ba om før implementasjonsbeslutning:

1. **Alle 17 kallsteder** sender allerede `dokumentId` + `dokumentType` → Alternativ A (lookup inne i funksjonen) krevde **0 kallsteder endret**.
2. Backlog-skissens «linje 400»-plassering var upresis — riktig plassering er linje 449 (etter firmaansvarlig-grenen). Lar oss gjenbruke `findUnique`-resultatet.
3. Slett-mutasjonene sjekker allerede status **etter** `verifiserDokumentTilgang` i begge filer (`oppgave.ts:1125` og `sjekkliste.ts:1026`) — eksisterende guard er identisk med Kenneths spec.

### Verifisering

`@sitedoc/api` typecheck 0 feil. Deployet til test 2026-05-27 (uptime 26m etter restart). Prod-deploy `b3194f1d`: 3 builds successful (1m 18s), ingen pending migrasjoner (kun kode-endring), `sitedoc.no` HTTP/2 200, `api.sitedoc.no/health` HTTP/2 200. Visuell verifisering må gjøres som innlogget bruker — opprett HMS-avvik som vanlig prosjektmedlem uten faggruppe-tilgang til malens domain, åpne via direktelenke, bekreft 200 (ikke FORBIDDEN).

### Avgrensninger (utenfor denne fiksen)

- Mutations utover `slett` (`oppdater`, `oppdaterData`, `endreStatus`, `leggTilKommentar`, `forbedreOversettelse`) får nå innsender-tilgang gjennom samme gren. Flow-rolle-håndhevelse (`verifiserFlytRolle`) i `endreStatus` håndterer fortsatt overgangs-rettighetene. Innsender = `bestiller`-rolle i flyt og har derfor flyt-rolle-baserte rettigheter.
- Ingen tilgang basert på `DocumentTransfer.senderId` for vanlige medlemmer — kun via firmaansvarlig-grenen (uendret).

---

## HMS åpen-synlighet + prod-backfill — DEPLOYET TIL PROD 2026-05-27 (prod-merge `c0c00374`, develop-commit `7e17b3c3`)

Avsluttende fiks etter HMS-prosjektvisning-bunken (`69068ba0` + `c1fbc19f`). Adresserer åpen-synlighet-gapet og rydder prod-DB.

### Sikkerhets-analyse som drev fiksen

`verifiserDokumentTilgang` (`apps/api/src/trpc/tilgangskontroll.ts:366`) brukes av `oppgave.hentMedId`, `oppgave.hentKommentarer` og `sjekkliste.hentMedId`. Den evaluerer tilgang via fire lag: admin-bypass, firmaansvarlig-involvering, direkte faggruppe-match, gruppe-domain-match. **Ingen sjekk på `hmsSynlighet`.**

**Konsekvens før fiks:**
- **Privat-synlighet:** Trygt håndhevet implisitt — HMS-dokumenter med null faggrupper er kun synlige for HMS-gruppe-medlemmer (tverrgående domain-tilgang) + admin + firmaansvarlig. ✅
- **Åpen-synlighet:** Brutt — vanlige prosjektmedlemmer blokkert fra åpne HMS-dokumenter selv om malen sier «alle skal se». ❌

### Kode-endring

**`apps/api/src/trpc/tilgangskontroll.ts`:**
- Ny valgfri parameter `templateHmsSynlighet?: string | null` på `verifiserDokumentTilgang`. Eksisterende kall som ikke sender den får uendret oppførsel (privat-default).
- Ny gren rett før FORBIDDEN-kast: `if (templateDomain === "hms" && templateHmsSynlighet === "apen") return;`. Bruker er allerede verifisert som prosjektmedlem ovenfor (linje 395-400), så det er trygt å gi tilgang her.

**`apps/api/src/routes/oppgave.ts`:**
- `hentMedId` (linje 175): sender `oppgave.template?.hmsSynlighet`. Template-include inkluderer feltet automatisk.
- `hentKommentarer` (linje 212): Prisma `select` utvidet med `hmsSynlighet: true` + sender feltet.

**`apps/api/src/routes/sjekkliste.ts`:**
- `hentMedId` (linje 114): sender `sjekkliste.template.hmsSynlighet`.

**Mutations berøres ikke** — `oppdater`, `oppdaterData`, `endreStatus`, `slett`, `byttEier`, `flytt`, `forbedreOversettelse`, `leggTilKommentar`, `hentTilgjengeligeFlyter` beholder eksisterende streng tilgang. Åpen-modellen gjelder kun lesing.

### Prod-backfill kjørt samme dag

`apps/api/scripts/backfill-hms-maler.ts` mot prod (sitedoc-DB). Loopet gjennom alle prosjekter med `hms-avvik`-modul aktiv:

| Prosjekt | Endringer |
|---|---|
| Fredriks testprosjekt | + HMS-gruppe, + HMS-flyt, + HMS/SJA/RUH-maler (full pakke) |
| Testprosjekt | + SJA + RUH-maler, HMS oppdatert |
| 998 Instinniforbotn | + HMS-gruppe (manglet), + HMS-flyt, HMS/SJA/RUH oppdatert til riktig subdomain + hmsSynlighet |

**Final prod-DB-tilstand:**

| Prosjekt | HMS | SJA | RUH |
|---|---|---|---|
| 998 Instinniforbotn | avvik / privat | sja / **apen** ✅ | ruh / privat |
| Fredriks testprosjekt | avvik / privat | sja / apen | ruh / privat |
| Testprosjekt | avvik / privat | sja / apen | ruh / privat |

Den ene eksisterende SJA-sjekklisten på 998 Instinniforbotn er nå korrekt åpen for alle prosjektmedlemmer (datadrift fra PR 1-backfill rettet).

### Sikkerhets-modell etter fiks

- **Privat HMS-dokument (default for avvik + RUH):** Innsender via firmaansvarlig OR HMS-gruppe-medlem OR admin ser. Vanlig prosjektmedlem blokkert via URL-share.
- **Åpen HMS-dokument (default for SJA):** Alle prosjektmedlemmer kan lese via `hentMedId`/`hentKommentarer`. Mutations krever fortsatt HMS-gruppe eller admin.

### Verifisering

- Typecheck `@sitedoc/api`: 0 nye feil
- Prod-deploy: HTTP/2 200 på sitedoc.no + api.sitedoc.no/health
- Migrasjon: ingen pending (sjekk-kun)
- Per CLAUDE.md «Prod-verifisering må alltid gjøres som innlogget bruker» — venter på Kenneths visuelle verifikasjon

### Batchede docs-commits inkludert i samme prod-deploy

- `35d10154` — STATUS + historikk + BACKLOG-oppdatering for HMS-prosjektvisning-bunken
- `985dbfd2` — CLAUDE.md: to nye prod-deploy-regler (prisma generate eksplisitt + migrasjons-backfill-disiplin)
- `674d3a79` — fix-migrasjon for SJA/RUH-prefix subdomain (egen entry i historikk)

### Pre-eksisterende observasjon (ikke HMS-introdusert)

`verifiserDokumentTilgang` har ingen `bestillerUserId === userId`-sjekk for vanlige medlemmer. En arbeider som oppretter et dokument kan ikke åpne det igjen via direkte URL med mindre de er i en gruppe som dekker dokumentets faggruppe/domain. Sannsynligvis et generelt SiteDoc-problem, ikke kun HMS — verifiseres separat hvis kundeobservert.

---

## HMS-prosjektvisning + mal-builder subdomain/synlighet — DEPLOYET TIL PROD 2026-05-26 (prod-merge `69068ba0` + fix `c1fbc19f`)

Komplett HMS-modul redesign på prosjektnivå. Spec: BACKLOG § HMS-modul redesign + § Synlighet per mal. To prod-deploys samme dag — hoved-bunken `69068ba0` + oppfølger-fix `c1fbc19f`.

### Server-endringer

**Schema (`packages/db/prisma/schema.prisma`):**
- `ReportTemplate.subdomain: String?` (avvik | sja | ruh) + `hmsSynlighet: String?` (privat | apen). Nullable — Zod-validering håndhever verdier i API-laget.
- `Checklist.bestillerFaggruppeId` + `utforerFaggruppeId` gjort nullable (speil av Task) for å støtte HMS-sjekklister (SJA/RUH) som auto-rutes til HMS-gruppen uten faggruppe.

**Migrasjoner:**
- `20260526200000_report_template_subdomain_hms_synlighet` — ADD COLUMN subdomain + hms_synlighet + backfill av eksisterende `domain='hms'`-rader til `('avvik', 'privat')`. **Bug**: hardkodet `subdomain='avvik'` på ALLE HMS-maler — traff eksisterende SJA/RUH-maler kunder hadde opprettet manuelt. Rettet via oppfølger-migrasjon.
- `20260526210000_checklist_faggruppe_nullable` — ALTER COLUMN DROP NOT NULL på begge faggruppe-FK på Checklist.
- `20260526220000_fix_hms_subdomain_prefix_match` — Fix-migrasjon: prefix-baserte UPDATEs for SJA og RUH. `hms_synlighet` IKKE endret for å bevare tilgangskontroll på eksisterende dokumenter (1 SJA-sjekkliste fantes på prod 998 Instinniforbotn).

**Nye/utvidede routes:**
- `apps/api/src/routes/hms.ts` — ny router med `hentDokumenter`-prosedyre. Returnerer `{ avvik: Task[], sja: Checklist[], ruh: Checklist[] }`. Bruker explicit `select` (ikke `include`) for å unngå TS2589. Tilgangskontroll: `byggHmsSynlighetsFilter` overlay som filtrerer privat-synlighet (innsender + recipient + HMS-gruppe-medlemmer + admin ser alt).
- `apps/api/src/routes/sjekkliste.ts` — HMS-spesialrute i `opprett` (speil av `oppgave.opprett:313-336`). Faggrupper påkrevd KUN for non-HMS. Helper-fiks i `admin.ts` og `sjekkliste.byttEier` for nullable bestillerFaggruppeId.
- `apps/api/src/routes/oppgave.ts` + `sjekkliste.ts` — `hentForProsjekt` utvidet med valgfri `domain`-filter. Default: ekskluder HMS (de vises på egen HMS-side).
- `apps/api/src/routes/mal.ts` + `oppdaterMal` — aksepterer `subdomain` + `hmsSynlighet`. Shared `createTemplateSchema` utvidet.
- `apps/api/src/routes/modul.ts` — `seedHmsModulOmradet` utvidet med inline backfill (selv-helbredende) som oppretter manglende HMS-maler basert på `PROSJEKT_MODULER`-definisjonen. Mal-create-løkken setter også `subdomain`/`hmsSynlighet`.

**Shared (`packages/shared/src/types/index.ts`):**
- `ModulMal`-interface utvidet med `subdomain?` + `hmsSynlighet?`.
- `PROSJEKT_MODULER.hms-avvik` utvidet med to nye maler:
  - **SJA** (sjekkliste, subdomain="sja", hmsSynlighet="apen", prefix="SJA") — risikovurdering før risikoarbeid. Felter: arbeidsleder, deltakere (persons), identifiserte farer, tiltak, verneutstyr, signatur.
  - **RUH** (sjekkliste, subdomain="ruh", hmsSynlighet="privat", prefix="RUH") — rapport om uønsket hendelse. Felter: type observasjon, beskrivelse, foreslåtte tiltak, vedlegg.
- HMS-avvik-mal utvidet med subdomain="avvik" + hmsSynlighet="privat".

### Klient-endringer

**Ny rute (`apps/web/src/app/dashbord/[prosjektId]/hms/page.tsx`, ~574 linjer):**
- KPI-bånd: 3 kort (åpne avvik, SJA siste 30 dager, RUH siste 30 dager). Amber-fargetone hvis åpne avvik > 0.
- 4 tabs: Avvik / SJA / RUH / Statistikk. Hver tab har antall-badge.
- Filter-toggle: "Vis alle (inkl. lukkede)" — default skjult.
- Ny-dropdown: to-linjes layout med mal-navn (bold) + hjelpetekst (grå). Bredde 320px.
- Tabeller med plain HTML (`@sitedoc/ui` Table-komponent har egen API med kolonner-prop, ikke kompatibelt). Hver rad klikkbar → navigerer til `/oppgaver/<id>` eller `/sjekklister/<id>`.
- Statistikk-fane: 3 SVG-paneler — avvik per måned (søyle, siste 6 mnd), avvik per faggruppe (horisontal bar, topp 5), status-fordeling (stacked bar med legend).
- TS2589-workaround: imperativ tRPC-call via `utils.client.X.mutate()` i stedet for `useMutation`-hook (kombinasjonen av oppgave+sjekkliste-opprett etter recipientGroupId-utvidelse pumpet typegen for dyp).

**Mal-builder (`MalListe.tsx`):**
- Subdomain-radio (Avvik/SJA/RUH) + synlighet-toggle (Privat/Åpen) i HMS-blokk, synlig kun når `erHms === true` og `hms-avvik`-modul er aktiv.
- Default-synlighet auto-settes fra subdomain (privat for avvik/ruh, apen for sja).
- Amber-advarsel ved synlighet-endring i rediger-modus: «Endring av synlighet påvirker også eksisterende dokumenter av denne malen.»
- Eksisterende sjekkliste-detalj-side oppdatert for nullable utforerFaggruppe.

**Sidebar (`HovedSidebar.tsx` + `navigasjon-kontekst.tsx` + `useAktivSeksjon.ts`):**
- Nytt element «HMS» med ShieldAlert-ikon, plassert etter «Oppgaver». Gated på `kreverModul: "hms-avvik"`.
- Seksjon-union utvidet med `"hms"`.

### i18n

35 nye nøkler under `hms.*` + `nav.hms` + 3 hjelpetekst-nøkler (`hms.hjelp.{avvik,sja,ruh}`). Auto-oversatt til 13 språk via `generate.ts` (2361 → 2399 totalt).

### Engangs-backfill

**Test-DB (2026-05-26):** `apps/api/scripts/backfill-hms-maler.ts` kjørt mot test. Begge HMS-aktive prosjekter (Markussen Boligfelt B12 + Test redigert mal Kenneth Myrhaug) fikk SJA + RUH-maler opprettet. Eksisterende HMS-maler fikk oppdatert subdomain via prefix-match.

**Prod-DB (2026-05-26):** Fix-migrasjon `20260526220000` retter SJA/RUH-maler på 998 Instinniforbotn fra feilaktig subdomain='avvik' til riktige verdier. Backfill-script IKKE kjørt på prod ennå — Kenneth har bedt om å vente. Andre prosjekter har fortsatt kun HMS-avvik (testprosjekt).

### Prod-deploy hendelse

Første prod-build feilet på `@sitedoc/api#build` med tre TS-feil — Prisma-klienten på server var ikke regenerert etter pull (`migrate deploy` regenererer ikke automatisk). PM2 hadde i mellomtiden restartet med gammel kode mot ny DB-schema — heldigvis bakover-kompatibelt (kun additive felt + relaxed NULL-constraints). Rettet ved å kjøre `pnpm --filter @sitedoc/db exec prisma generate` eksplisitt før `pnpm build`. Regel skrevet inn i CLAUDE.md (commit `985dbfd2`): «Etter Prisma schema-endring: kjør prisma generate eksplisitt mellom migrate deploy og pnpm build.»

### Verifisering

- Test-DB: HMS-maler korrekt klassifisert med subdomain etter backfill-script. UI verifisert med 4 tabs + dropdown.
- Prod-DB etter fix-migrasjon (2026-05-26): 998 Instinniforbotn SJA → "sja", RUH → "ruh", HMS → "avvik". Testprosjekt HMS → "avvik".
- HTTP/2 200 på sitedoc.no + api.sitedoc.no/health.
- Per CLAUDE.md «Prod-verifisering må alltid gjøres som innlogget bruker» — venter på Kenneths visuelle verifikasjon.

### Batchede docs-commits inkludert i samme prod-deploy

I `69068ba0`: `dffa6358`, `d8b2deec`, `df6fa0e5`, `ce904636`, `3fd8eba3` (dokumentflyt/kontaktliste redesign backlog + HMS-modul-seeding arkivering + STATUS-fixes + HMS-synlighet-oppfølger).

### Avgrensninger

- Backfill-script IKKE kjørt på prod — Kenneth tar beslutning.
- Web DokumentHandlingsmeny redesign for HMS-dokumenter venter på enhet-verifikasjon av mobil-bunken (build #23). Eksisterende oppgave/sjekkliste-detaljsider brukes for HMS-dokumenter i mellomtiden.
- Statistikk-fane er basis-versjon (3 SVG-paneler). Fremtidige utvidelser: eksport (CSV/PDF), per-måned drill-down, alvorlighet-trend.

### Lærdommer i CLAUDE.md (commit `985dbfd2`)

1. **Etter Prisma schema-endring:** Kjør alltid `pnpm --filter @sitedoc/db exec prisma generate` eksplisitt mellom `migrate deploy` og `pnpm build`. `migrate deploy` regenererer ikke klienten automatisk.
2. **Migrasjons-backfill-disiplin:** Aldri hardkode én verdi på alle rader uten diskriminerende WHERE-betingelse. Bruk prefix, navn eller andre felt for korrekt klassifisering.

---

## HMS-modul-seeding + moduler-deaktiver-modal — DEPLOYET TIL PROD 2026-05-26 (prod-merge `dd491081`)

Første steg av HMS-modul redesign (BACKLOG § 1). Når brukeren aktiverer `hms-avvik`-modulen på et prosjekt, seedes nå hele HMS-pakken i samme transaksjon — ikke bare HMS-mal-raden som før. Bygger på planleggings-runden 2026-05-26 (beslutninger låst etter spec-drøfting + kode-grunnlag).

### Server-endringer (`apps/api/src/routes/modul.ts`)

**Ny helper `seedHmsModulOmradet(tx, projectId)` (~85 linjer):**
- **Steg 1 — HMS-gruppe:** `ProjectGroup.findFirst({ where: { projectId, domains: { array_contains: ["hms"] } } })`. Hvis null: opprett med `name="HMS-ansvarlige"`, `slug="hms-ansvarlige"`, `category="field"`, `domains=["hms"]`, `isDefault=true`, permissions kopiert fra `STANDARD_PROJECT_GROUPS.hms-ledere` (`create_tasks`, `create_checklists`, `checklist_edit/view`, `task_edit/view`).
- **Steg 2 — HMS-flyt:** `Dokumentflyt.findFirst({ where: { projectId, maler: { some: { template: { domain: "hms" } } } } })`. Gjenkjenner eksisterende «HMS-avvik»-flyt fra `prosjekt.opprett`-seeding via `DokumentflytMal`-kobling (uten å rename). Hvis null: opprett med `name="HMS"` + null-medlem-bestiller (steg 1, alle FK null = «åpen for alle») + utforer-medlem med `groupId=hmsGruppe.id` (steg 2). Medlemmer opprettes KUN når flyten opprettes nå — eksisterende flyter med faggruppe-medlemmer berøres ikke.
- **Steg 3 — Mal-koblinger:** `findMany` på `ReportTemplate(projectId, domain="hms")`, deretter `DokumentflytMal.upsert` for hver. Idempotent via composite-unique `(dokumentflytId, templateId)`.

**Restrukturert `modul.aktiver`:** Reaktiverings-grenen returnerer ikke lenger tidlig. All logikk (ProjectModule opprettelse/reaktivering, mal-seeding, HMS-seeding) kjører i én transaksjon. Kall `seedHmsModulOmradet(tx, projectId)` etter mal-løkken kun når `moduleSlug === "hms-avvik"`. Idempotens-garantier:
- `ProjectModule.create` skippes hvis raden finnes — status oppdateres til «aktiv» i stedet
- `ReportTemplate.create` skippes hvis prefix finnes (eksisterende mønster)
- `ProjectGroup.create` skippes hvis gruppe med `domains: ["hms"]` finnes
- `Dokumentflyt.create` skippes hvis flyt med HMS-mal-kobling finnes
- `DokumentflytMal.upsert` håndterer kobling-duplikater

### Klient-endring (`apps/web/src/app/dashbord/oppsett/produksjon/moduler/page.tsx`)

Per CLAUDE.md skal slett/deaktiver-operasjoner bruke ekte modal-komponent, ikke native `confirm()`. Linje 228 hadde `if (confirm(...))` — erstattet med:
- Ny state `bekreftDeaktivering: { slug, navn } | null`
- onClick åpner modal istedenfor `confirm()`
- Ny `<Modal>` nederst i komponenten med to-knapp-mønster (Deaktiver med rød hover-styling + Avbryt). Lukker automatisk via `onSuccess` på `deaktiverMutation`.

### i18n

3 nye nøkler under `moduler.deaktiverBekreft*`:
- `Tittel` («Deaktiver modul»)
- `Tekst` («Deaktiver modulen «{{navn}}»?»)
- `Beskrivelse` («Eksisterende maler og data beholdes. Du kan reaktivere modulen senere.»)

Auto-oversatt til 13 språk via `generate.ts` — **2361 nøkler totalt** per språk.

### DB-verifisering på test-DB (2026-05-26)

Etter test-deploy + bruker-aktivering av `hms-avvik` på et test-prosjekt:

```
 name | antall_maler |   rolle   |               group_id
------+--------------+-----------+--------------------------------------
 HMS  |            1 | bestiller | (NULL)
 HMS  |            1 | utforer   | dec1a76e-638b-402d-9589-2dfb7cd20731
```

Bekreftet: HMS-flyt opprettet med `name="HMS"`, 2 medlemmer (bestiller null-medlem + utforer på HMS-gruppen), 1 `DokumentflytMal`-kobling.

### Verifisering

- `apps/api` typecheck 0 = 0 feil
- `apps/web` typecheck 1 = 1 baseline (vitest)
- Test-deploy 2026-05-26 ~18:25 — `test.sitedoc.no` HTTP/2 200
- Prod-deploy 2026-05-26 ~18:40 — `sitedoc.no` + `api.sitedoc.no/health` HTTP/2 200

### Avgrensninger (utenfor denne PR)

- HMS-spesialruten i `oppgave.opprett:313-336` (ProjectGroup-direkte-lookup via `domains: ["hms"]`) er ikke refaktorert. Kjører parallelt med ny `DokumentflytMal`-mekanikk.
- `prosjekt.opprett`-seeding av HMS-flyt med faggruppe-baserte medlemmer er ikke endret. Nye prosjekter får fortsatt «HMS-avvik»-flyt-mønsteret ved opprettelse.
- `sjekkliste.opprett` har fortsatt ingen HMS-spesialrute (kun `oppgave.opprett` har).
- Ingen schema-endring.

### Funn etter prod-deploy

HMS-gruppen og HMS-flyten er deployet og seedes korrekt, men er **usynlig i dokumentflyt-administrasjons-siden**. UI-en grupperer kun på `Faggruppe`-medlemmer (ikke `ProjectGroup`-medlemmer via `groupId`). Lagt til som backlog-entry under [BACKLOG § 2](BACKLOG.md): «Dokumentflyt/kontaktliste redesign — skille faggrupper fra interne grupper» (krever design-runde).

### Batchede docs-commits inkludert i samme prod-deploy

- `a96ab4c6` — arkivering av mal-builder type-radio + HMS-hake prod-deploy
- `9b914a8f` — fjernet feilformulert mal-builder-redesign-entry, lagt Godkjenning-hake som oppfølger

---

## Mal-builder type-radio + HMS-hake — DEPLOYET TIL PROD 2026-05-26 (prod-merge `0278cfb3`, develop-commit `b6a86ca8`)

Første steg av mal-builder redesign (BACKLOG § 1). Erstatter skjult `domain`-dropdown med eksplisitte type-haker + HMS-checkbox i begge mal-modaler. Server-side konverterings-validering hindrer at type endres for maler med eksisterende dokumenter.

**Bakgrunn:** BACKLOG-Q3 spec'et «én samlet mal med type-avkrysning». Planleggings-runden 2026-05-26 låste avgrensning til kun haker i eksisterende opprett/rediger-modaler — ikke sammenslåing av lister, ikke nye ruter. SJA og lignende kombinasjoner (Sjekkliste + HMS) muliggjøres ved at HMS er separat checkbox uavhengig av type-radio.

**Server-endringer (`apps/api/src/routes/mal.ts`):**
- `mal.oppdaterMal` Zod-input utvidet med `category: z.enum(["oppgave", "sjekkliste"]).optional()`. Domain-input beholdt med `["bygg", "hms", "kvalitet"]` for bakover-kompat selv om UI ikke lenger sender kvalitet.
- Konverterings-validering: hvis `input.category !== mal.category`, telles `task.count + checklist.count` for `templateId`. Avvises med klartekst-feilmelding hvis totalt > 0.
- `mal.hentForProsjekt._count` utvidet med `tasks: true` for UI-disablement av type-radio når dokumenter eksisterer.

**Klient (`apps/web/src/app/dashbord/oppsett/produksjon/_components/MalListe.tsx`):**
- Ny `trpc.modul.hentForProsjekt`-query for å sjekke `ProjectModule.hms-avvik`-aktiv-status. HMS-checkbox vises kun hvis modulen er aktiv på prosjektet (eller i rediger-modalen: hvis malen allerede er HMS).
- Opprett-modal: type-radio (Oppgave/Sjekkliste) — disabled, forhåndsvalgt fra `kategori`-prop (oppgavemaler-siden → Oppgave låst). HMS-checkbox under radio med kort beskrivelse. Fagområde-dropdown med Bygg/HMS/Kvalitet fjernet helt — domain styres nå av `erHms ? "hms" : "bygg"`.
- Rediger-modal: ny type-radio (redigerbar) forhåndsutfylt fra `mal.category`. Disabled med forklaring hvis `_count.tasks + _count.checklists > 0`. HMS-checkbox forhåndsutfylt fra `mal.domain === "hms"`, redigerbar. Amber-advarsel under haken når `redigerErHms !== redigerOpprinneligErHms` («Endring av HMS-status endrer tilgangskontroll for eksisterende dokumenter»).

**i18n:** 7 nye nøkler under `maler.*`:
- `type.label`, `type.oppgave`, `type.sjekkliste`
- `hms.hake`, `hms.beskrivelse`, `hms.endringAdvarsel`
- `feilKonvertering` (interpolert med `{{antall}}`)

Auto-oversatt til 13 språk via `generate.ts` — **2 358 nøkler totalt** per språk.

**Doc-oppdatering (`MALBYGGER.md §3`):** Tidligere absolutt-forbud («Type er permanent etter opprettelse») erstattet med dataintegritets-regel: «Type-endring tillatt så lenge ingen dokumenter eksisterer (samme prinsipp som felt-lås §2)». Speil av server-validering.

**Prod-DB-funn 2026-05-26:** `SELECT domain, COUNT(*) FROM report_templates GROUP BY domain` ga `bygg: 8, hms: 4, kvalitet: 0`. «Kvalitet» som domain-valg har ingen runtime-effekt utover å skjule maler for vanlige brukere (per `tilgangskontroll.ts` Lag 3 — ingen standard-gruppe har `domains: ["kvalitet"]`). Trygt fjernet fra UI uten datakonsekvens. Schema-feltet beholdes for bakover-kompat.

**Verifisering:** apps/api typecheck 0 = 0 feil, web 1 = 1 baseline (vitest). Test-deploy 2026-05-26 ~18:48 — `test.sitedoc.no` HTTP/2 200 (krevde manuell `pnpm build` etter pull pga. manglende `.next` etter restart). Prod-deploy 2026-05-26 ~18:57 — `sitedoc.no` + `api.sitedoc.no/health` HTTP/2 200. Build inkluderte 21 filer (404 inn, 22 ut).

**Batchede docs-commits inkludert i samme prod-deploy:**
- `02ca7518` — HMS- og Godkjenning-modul redesign-spec (BACKLOG § 1)
- `04c56d0c` — mal-builder redesign med type-avkrysning (BACKLOG § 1)
- `c171a0c7` — arkiver mal→dokumentflyt-bugfix + flagg develop-foran-main

**Avhengig oppfølger-arbeid (BACKLOG § 1):**
- HMS-modul redesign — komplett HMS-pakke ved aktivering, vil flytte HMS-gating fra `ProjectModule` til `OrganizationModule`
- Godkjenning-modul redesign — TE/Endring/Varsel statusflyt + bruke eksisterende Godkjenning-tabell
- Godkjenning-hake i mal-builder — venter på Godkjenning-modul-design
- Samlet `/maler`-liste (PR 2) — sammenslåing av oppgavemaler/ + sjekklistemaler/ til én side med type-filter

---

## Mal→dokumentflyt-kobling bugfix + UI-terminologi — DEPLOYET TIL PROD 2026-05-25 (prod-merge `ed7675a5`, develop-commit `36c42504`)

Bugfiks i mal-byggeren: `mal.opprett`-mutasjonen destrukturerte `workflowIds` med `_`-prefiks (`const { workflowIds: _workflowIds, ...malData } = input`) og kastet det vekk — UI-valget av dokumentflyter ved mal-opprettelse var en kosmetisk illusjon. Ingen `DokumentflytMal`-rader ble lagret. Resultat: maler opprettet via UI fikk null koblinger, ble usynlige i opprett-modalens flyt-velger, og brukerne måtte koble via dokumentflyt-administrasjon (omvendt vei).

**Server-endringer (`apps/api/src/routes/mal.ts`):**
- `mal.opprett` bruker nå `workflowIds` — wrapped i `$transaction`, oppretter `DokumentflytMal`-rader for hvert flyt-ID.
- `mal.oppdaterMal` aksepterer nytt `workflowIds`-felt (Zod-validert). Replace-on-update via `deleteMany` + `createMany` i transaksjon.
- `mal.hentMedId` + `hentForProsjekt` returnerer nå `dokumentflytMaler: { select: { dokumentflytId: true } }` så rediger-modal kan pre-populere valgte flyter uten ekstra query.

**UI-terminologi (`apps/web/src/app/dashbord/oppsett/produksjon/_components/`):**
- `MalListe.tsx`: feltlabel «Faggruppe» → «Dokumentflyt» i opprett-modal. Amber-advarsel under feltet hvis ingen flyt er valgt («Malen vil ikke være tilgjengelig før den er koblet til minst én dokumentflyt»). Visuell — blokkerer ikke lagring.
- Rediger-modal: nytt dokumentflyt-felt med pre-populering fra eksisterende `mal.dokumentflytMaler`. Separat `FaggruppeTilknytningModal`-instans for rediger-flyt.
- `FaggruppeTilknytningModal.tsx`: modal-tittel «Velg dokumentflyt». Beskrivelse «Velg hvilke dokumentflyter denne {{kategori}}-malen skal kunne brukes med.» Hardkodede norske strenger fjernet, alle via i18n.

**i18n:** 9 nye nøkler under `maler.*` (dokumentflyt, ingenDokumentflytValgt, dokumentflytValgt, ingenDokumentflytAdvarsel, velgDokumentflyt, velgDokumentflytBeskrivelse, ingenFaggrupperIProsjekt, sjekkliste, oppgave). Auto-oversatt til 13 språk via `generate.ts` — 2 351 nøkler totalt.

**Prod-DB-funn ved verifisering 2026-05-26:** 4 av 11 maler i prod manglet flyt-kobling pga. den eksisterende bugen — `Godkjenning` (GM), `KS avvik` (K-avv), `RUH`, `SJA`. Disse beholdes urørt; brukerne kan nå redigere malene via den nye rediger-modalen for å koble dem til en eksisterende flyt. Bugfiksen sikrer at fremtidige opprettelser lagrer koblingen.

**Verifisering:** apps/api typecheck 0 = 0 feil, web 1 = 1 baseline (vitest). Prod-deploy 2026-05-25 22:55 GMT — `sitedoc.no` + `api.sitedoc.no/health` HTTP/2 200. Build inkluderte 21 filer (291 inn, 61 ut) inklusiv en docs-only commit (`0f7ab677`) som la til web-DokumentHandlingsmeny-redesign i backlog.

**Tilhørende oppdagelser ved sporing 2026-05-26 (planlagt arbeid i [BACKLOG.md § 1](BACKLOG.md)):**
- HMS-modul redesign — komplett HMS-pakke ved aktivering
- Godkjenning-modul — TE/Endring/Varsel statusflyt + bruke eksisterende Godkjenning-tabell
- Mal-builder redesign — én samlet mal-builder med type-avkrysning (avhenger av de to over)

---

## Mobil firma-velger + i18n — DEPLOYET TIL PROD 2026-05-24 (prod-merge `fa92528a`, develop merge `a85469f2`)

Multi-firma sitedoc_admin (Kenneth) ser nå et amber-banner på mobil-forsiden («Velg firma — du er medlem av flere firmaer») når ingen firma er valgt. Trykk åpner modal-velger som speiler ProsjektVelger-mønsteret. Vanlig A.Markussen-ansatt (single-firma) får auto-velg ved første lasting og merker ingen UI-endring.

Server-side: ny tRPC-prosedyre `organisasjon.hentMineMedlemskap` returnerer brukerens OrganizationMember-rader (sitedoc_admin får alle kunde-firmaer per webens `hentTilgjengelige`-mønster). Klient-side: `FirmaKontekst` med SecureStore-persistering + `useFirma()`-hook, firma-velger-UI i `mer.tsx`-seksjon + hjem.tsx-banner. Alle 5 mobil-`hentMine`-callsites gated på `valgtFirmaId`. `mer.tsx` og `timer/attestering/index.tsx` ble samtidig forenklet — 22 linjer netto kode-reduksjon fra fjernet «plukk-orgId-fra-første-prosjekt»-logikk (tidligere ikke-deterministisk for multi-firma-brukere).

i18n: 7 nye nøkler × 13 språk auto-oversatt. Manuell QA avdekket at engelsk «Switch» ble feiloversatt som NOUN (elektrisk bryter) i 9/13 språk; løst ved å bytte engelsk kilde til «Change» + manuell rens av 3 gjenstående (pl/cs/uk).

EAS iOS production build #22 (`e8289e0a`) submittert til TestFlight (`6707d04b`) 2026-05-24. Bygget inkluderer også hele mai-bunken (T7-3a/b1/b2/d, T4-d/e, T.5, T7-4a/e) som var sovende på enhet til denne runden. Apple-prosessering pågår; verifisering på enhet kommer. Android-bygg ikke kjørt ennå.

Sub-commits på `feature/mobil-firma-velger`:
1. `99e0b136` — feat(api): `organisasjon.hentMineMedlemskap`
2. `3d0c8c90` — feat(mobile): FirmaKontekst + `useFirma()`-hook
3. `7e82b075` — feat(mobile): firma-velger-UI
4. `f18dda7e` — feat(mobile): hentMine-callsites gated på `valgtFirmaId`
5. `585acc33` — i18n: 13 språk auto-oversatt + 3 manuelle rettelser

---

## Dokumentflyt send-modal redesign — DEPLOYET TIL PROD 2026-05-25 (prod-merge `4968a23c`)

Boks-basert handlingsmeny på mobil-detaljside erstatter forrige ActionSheet-baserte modell. Spec låst i BACKLOG.md § Dokumentflyt send-modal redesign 2026-05-25 (punkt 1-10). Server-Commit 1 + Mobil-Commit 2 + i18n (15 språk) merget til main og deployet i én bunke.

**Server-side (Commit 1, develop `584148b2` → main `4968a23c`):**
- Delt helper i `apps/api/src/trpc/tilgangskontroll.ts`: `finnBrukersBoks`, `hentBrukerProsjektTilgang`, `kanByttFlyt` (124 nye linjer). Spesifisitets-hierarki projectMember > group > faggruppe.
- Ny `oppgave.hentTilgjengeligeFlyter` + speil i `sjekkliste.hentTilgjengeligeFlyter`: returnerer `{ gjeldende, andre[], kanFlytte }` med fulle medlemsdetaljer (`erHovedansvarlig`, `projectMember.user`, `group`, `faggruppe`) for popup-rendring. Filtrert på `templateId` for samme dokumenttype.
- `endreStatus` Lag 1-utvidelse i begge ruter: ny regel `admin/registrator/sitedoc-admin + har-ballen + cross-flyt-medlem`. Erstatter tidligere snevrere kryssfaggruppe-blokk.
- `endreStatus` auto-utleder mottaker ved flyt-bytte fra `erHovedansvarlig=true`-medlem på utforer-rollen i mål-flyten. Klient sender ikke mottaker ved flyt-bytte; server styrer deterministisk.

**Mobil-side (Commit 2, develop `91bc235f`):**
- Ny utility `apps/mobile/src/utils/dokumentflyt-ledd.ts` (`byggLedd`, `Ledd`, `FlytMedlem`). Brukes av både FlytIndikator (topbar, kompakt) og ny `DokumentHandlingsmeny`.
- `FlytIndikator.tsx` refaktorert til å importere fra delt helper — ingen funksjonell endring i topbar-visning.
- `DokumentHandlingsmeny.tsx` full omskriving: fargede flyt-bokser alltid synlig i bunn, trykk åpner popup med medlemsliste + tilgjengelige statushandlinger. Stjerne på `erHovedansvarlig`. Egen `⋯`-meny for admin-handlinger (Lukk, Gjenåpne, Trekk tilbake). Flyt-bytte-dropdown synlig kun for cross-flyt-medlemmer med bekreftelses-modal. Custom RN Modal på iOS og Android (ingen `ActionSheetIOS`/`Alert`). ≤4 bokser én rad, ≥5 to rader.
- Callsites (`oppgave/[id].tsx` + `sjekkliste/[id].tsx`) bytter til `hentTilgjengeligeFlyter`-query. Tidligere props (`alleFaggrupper`, `dokumentflyter`, `flytMedlemmer`, recipient-felter, etc.) erstattet med `tilgjengeligeFlyter` + `minRolle` + `erFirmaAdmin`.

**i18n (develop `495d3a37`):** 7 nye nøkler × 15 språk (1 master + 14 auto-oversatt). 2 342 nøkler totalt.

**EAS iOS production build #23 (`a5e6e2ea`)** bygget mot prod-API, submittert til TestFlight via submission `898599df-aa55-4689-9f2a-cd21b4d26861`. Bygget leverer også de sovende mobil-endringene fra forrige runde (ProsjektKontekst auto-reset ved firma-bytte, `f7322519`).

**Kjente avvik fra spec — observasjoner for enhet-testing, ikke planlagte oppgaver:**
1. **Statusvalg-popup viser samme statuser uansett boks-retning.** Implementasjonen bruker `hentRolleFiltrertHandlinger(status, rolle)` for alle bokser uten å skille på nabo (steg+1), forrige (steg-1), egen eller skip-over. Spec punkt 2 hadde eksempler som «Nabo-boks fra received: [Send hit]», «Nabo-boks fra in_progress: [Send videre] + [Send tilbake]» som antyder retnings-spesifikk filtrering — det ble ikke gjort fordi `isValidStatusTransition` ikke entydig støtter retnings-mapping (eks. `received → sent` er ikke en gyldig overgang). Vurder finjustering etter test på enhet.
2. **Auto-mottaker lander på hovedansvarlig utfører, ikke nødvendigvis brukerens egen boks.** Spec punkt 7 sa «oppgaven lander hos brukerens egen boks i den nye flyten». Server velger i stedet `erHovedansvarlig=true` på utforer-rollen via etablert mønster fra opprettelses-flyten. Hvis brukeren er godkjenner i mål-flyt og hovedansvarlig utforer er en annen person, lander oppgaven hos den hovedansvarlige utføreren — ikke hos brukeren. Funksjonelt OK siden mottakeren er den som forventes å starte arbeidet, men avviker fra spec-formuleringen.
3. **`erFirmaAdmin`-prop bruker prosjekt-admin i stedet for firma-admin.** Mobil-callsite passerer `minFlytInfo?.erAdmin === true` som `erFirmaAdmin`-prop. `minFlytInfo.erAdmin` er ProjectMember.role === "admin" (prosjekt-admin), ikke User.role === "company_admin" eller OrganizationMember.firmaRoller.includes("firma_admin"). Reell firma-admin-sjekk gjøres ikke. Admin-meny vises riktig for prosjektadmin, men firma-admin uten ProjectMember-rad får ikke `⋯`-meny. Rydding-kandidat.
4. **`approved`/`closed`-grå-toning ikke implementert.** Spec'ens «fortsatt åpent»-punkt foreslo grå-toning + trykkbart i approved/closed for «videresend som referanse». Komponenten returnerer i stedet `null` når flyt-data mangler og status ≠ draft — dvs. ingen UI i terminal-tilstand. Bekreftes eller endres i senere iterasjon.

---

## Firma-bytte residual data — DEPLOYET TIL PROD 2026-05-25 (prod-merge `4968a23c`, develop-merger `83ba968e` web + `f7322519` mobil)

Gjennomgang av mobil-appen via TestFlight build #22 (sitedoc_admin) avdekket at byggeplass og prosjektID hang igjen i konteksten etter firma-bytte. Web hadde tilsvarende race-bug. To uavhengige fikser:

1. **Web: `apps/web/src/kontekst/byggeplass-kontekst.tsx`** (impl `1da69d23`, develop-merge `83ba968e`) — ny useEffect med `valgtFirma?.id` som dependency clearer `aktivByggeplass` + `standardTegning` + `aktivTegning` umiddelbart ved firma-bytte. Hindrer at gammel byggeplass-etikett henger igjen i topbar mens ProsjektKontekst auto-resetter prosjektId.

2. **Mobil: `apps/mobile/src/kontekst/ProsjektKontekst.tsx`** (impl `2654b691`, develop-merge `f7322519`) — ny useEffect med `valgtFirmaId` som dependency nullstiller `valgtProsjektId` ved firma-bytte. Skip-first-render-mønster via `useRef` hindrer at persistert valg renses ved app-oppstart. Byggeplass-derivering nullstilles automatisk som cascade. Levert til TestFlight i EAS build #23 (`a5e6e2ea`) submittert som `898599df` samtidig med send-modal-redesign-bunken.

**Sikkerhets-rammen:** UX-bug for sitedoc_admin (admin har bypass server-side i `harProsjektTilgang`). For vanlige brukere ville samme situasjon returnert FORBIDDEN — ingen data-lekkasje.

**Tilhørende backlog-tilføyelser samme dag:**
- «Vis som bruker (impersonering)» (develop `a8f96700`)
- «Dokumentflyt send-modal redesign» — høy prioritet, deployet samme dag (se entry over)

---

## opprettTestprosjekt firma påkrevd — DEPLOYET TIL PROD 2026-05-23 (prod-merge `49171634`, develop merge `ed8fe6fa`, impl `c377f9bb`)

Siste konsistens-rest fra firma-påkrevd-bunken 2026-05-20: `opprettTestprosjekt` var den eneste prosjekt-opprettelse-mutasjonen som fortsatt hadde `organizationId.optional()`. Sitedoc_admin uten OrganizationMember-rad kunne trigge orphan-prosjekt ved «Opprett malprosjekt»-knappen eller «Start gratis prøveperiode» — nøyaktig samme vei som ga de 5 slettede orphans 2026-05-20.

**Server (`apps/api/src/routes/prosjekt.ts:246-323`):**
- `input.organizationId.uuid()` — `.optional()` fjernet (både fra felt og hele input-objektet)
- `valgtOrgId` er nå alltid string — null-vei + else-fallback fjernet, ~15 linjer forenklet til ~10
- `if (valgtOrgId)`-wrap fjernet rundt `projectOrganization.create` + `projectModule.createMany` (alltid truthy)
- Tilgangssjekk beholdt: sitedoc_admin → enhver org, vanlig bruker → kun egen org
- Speiler nå nøyaktig `prosjekt.opprett`-mønsteret (linje 163-243)

**Admin-UI (`apps/web/src/app/dashbord/admin/prosjekter/page.tsx`):**
- `OpprettMalMutation`-stub utvidet med `mutate(input: { organizationId: string })`
- «Opprett malprosjekt»-knapp sender nå `{ organizationId: valgtFirma.id }`
- `disabled` utvidet med `!valgtFirma?.id`

**Kom-i-gang (`apps/web/src/app/dashbord/kom-i-gang/page.tsx`):**
- `useTranslation` lagt til
- `opprettMutation.onSuccess` bruker `_data: unknown` for å unngå TS2589 (samme mønster som `nytt-prosjekt/page.tsx`)
- «Start gratis prøveperiode»-knapp sender `{ organizationId: valgtFirma.id }`
- `disabled` utvidet med `!valgtFirma?.id`
- Amber-banner med `Building2`-ikon vises når `!valgtFirma` — gjenbruker `t("nyttProsjekt.ingenFirma")` (oversatt til alle 15 språk)
- Sitedoc_admin redirectes uansett bort fra siden ved valgt firma (eksisterende `useEffect`) — banneret rammer hovedsakelig vanlige brukere uten OrganizationMember-rad

**Prod-deploy 2026-05-23:** HTTP/2 200 på sitedoc.no etter `pm2 restart sitedoc-web sitedoc-api`. Ingen migrasjon — kun klient + server-Zod. Bunken inkluderte også (siden forrige main-merge `c2792f28`): i18n auto-oversetting 30 nøkler × 13 språk (`072eb64f`), hjelp.flyt-relikvi-slett (`47c55faf`), backlog-oppdateringer (`da870181`, `8b7cf04e`).

**Typecheck:** 0 nye feil. To TS-feil fra Zod-required-endringen (TS2589 i `kom-i-gang/page.tsx` + stub-type-mismatch i `admin/prosjekter/page.tsx`) håndtert med `_data: unknown`-mønster og utvidet stub-signatur.

---

## T7-5f dirty-tracking grønn Lagre-knapp — DEPLOYET TIL PROD 2026-05-23 (prod-merge `c2792f28`, develop merge `b9364e3f`, impl `e7ac0f83` + `f0e1a740`)

Lagre-knappen i attestering-edit-flatene har spec'et grå→grønn-mønster: grå/disabled inntil endring eksisterer, grønn når endringer er klare for lagring. Tidligere: alltid blå/aktiv uavhengig av om noe var endret — bruker fikk ingen visuell signal. Implementert på begge edit-flater for UX-konsistens.

**AttesteringDetalj_Edit (`apps/web/src/components/timer/AttesteringDetalj_Edit.tsx:481`):**
- `disabled={lagre.isPending || !harUlagredeEndringer}` — koblet til eksisterende `harUlagredeEndringer`-memo (linje 296-305 fra T7-2c3, ble tidligere kun brukt til splitt-bekreftelse).
- `className={harUlagredeEndringer ? "!bg-green-600 hover:!bg-green-700 focus:!ring-green-500" : ""}`

**RedigerRadModal (`apps/web/src/components/attestering/RedigerRadModal.tsx:401`):**
- Disabled-logikken fantes fra T7-5d. Lagt til grønn className i ny commit for konsistens med AttesteringDetalj_Edit.
- Samme `!bg-green-600 hover:!bg-green-700 focus:!ring-green-500`-mønster.

**Tailwind `!`-prefix:** Sikrer override mot `Button.varianter.primary.bg-sitedoc-primary`. Speiler mønsteret i CLAUDE.md § Tailwind className-spesifisitet.

**Prod-deploy 2026-05-23:** HTTP/2 200 på sitedoc.no etter `pm2 restart sitedoc-web sitedoc-api`. Ingen migrasjon — kun klient-className. Test-QA bekreftet at grå→grønn-mønster fungerer på begge flater (én sedel hadde pause-checkbox endret fra forrige sesjon, så knappen var grønn ved åpning som forventet).

**Typecheck:** 0 nye feil. Pre-eksisterende `vitest`-import-feil i `import-hjelpere.test.ts` ikke berørt.

---

## Firma påkrevd ved prosjektopprettelse + admin.opprettProsjekt-bugfix — DEPLOYET TIL PROD 2026-05-20 (prod-merge `a5bea017`, develop merge `2435dedd`, impl `30818195` + `9863836e`)

Adresserer at PC-admin og mobil viste ulike prosjekt-lister: PC filtrerer på `primaryOrganizationId = valgtFirma.id`, mobil bruker `prosjekt.hentMine` uten firma-filter. Grunn: 5 av 8 prosjekter i prod-DB var orphaned (`primaryOrganizationId = null`) fordi opprettelse-flyten tillot det. Kenneths beslutning: alle kunder skal være registrert som firma — prosjekter må ha firma-tilknytning ved opprettelse. Eksisterende standalone-prosjekter beholdes (schema fortsatt nullable for bakover-kompat); kun opprettelse-flyten er strammet.

**Prod-DB ryddet (Steg 1):**
- 5 orphans slettet fra `projects`: alle «Testside Kenneth Myrhaug» (SD-20260505-0003 til -0007), opprettet 2026-05-05
- 3 prosjekter gjenstår: Testprosjekt → Kenneths testmiljø, Fredriks testprosjekt → HRP AS, 998 Instinniforbotn → A.Markussen AS
- Ingen reelle brukere berørt

**Zod (`packages/shared/src/validation/index.ts`):**
- `createProjectSchema.organizationId: .uuid()` — fjernet `.optional()`. Kommentar oppdatert.

**Admin-UI (`apps/web/src/app/dashbord/admin/prosjekter/page.tsx`):**
- «Ingen firma»-option fjernet fra firma-dropdown
- Placeholder «Velg firma…» (disabled) som default
- `required`-attribut på `<select>`
- Opprett-knappen disabled inntil firma valgt
- `opprett()` blokkerer mutate hvis `!nyttFirmaId` (defense-in-depth)

**Vanlig nytt-prosjekt (`apps/web/src/app/dashbord/nytt-prosjekt/page.tsx`):**
- `handleSubmit` blokkerer hvis `!valgtFirma?.id`
- Amber varsel-banner vises hvis ingen firma valgt i topbaren
- Opprett-knappen disabled inntil firma valgt
- onSuccess-callback: `_data: unknown` for å unngå TS2589 (utløst av Zod-required)

**Bugfix `admin.opprettProsjekt` (`apps/api/src/routes/admin.ts:229-272`):**
- `input.organizationId.uuid()` — fjernet `.optional()`
- Project.create.data utvidet med `primaryOrganizationId: input.organizationId` (var tidligere utelatt!)
- `if (input.organizationId)`-wrap rundt projectOrganization.create fjernet (alltid truthy)
- Bug-konsekvens før fix: prosjekter opprettet via SiteDoc Admin > Prosjekter ble orphaned i admin-listens primær-filter selv om admin valgte firma. Forklarer hvorfor flere admin-UI-prosjekter manglet på firma-spesifikke views.

**i18n (`packages/shared/src/i18n/{nb,en}.json`):**
- `nyttProsjekt.ingenFirma` — varsel-tekst når firma mangler

**Prod-deploy 2026-05-20:** HTTP/2 200 på sitedoc.no etter `pm2 restart sitedoc-web sitedoc-api`. Ingen migrasjon — kun klient+server-logikk.

**Typecheck:** 0 nye feil. Pre-eksisterende `vitest`-import-feil i `import-hjelpere.test.ts` ikke berørt.

---

## T7-5e attestert-filter — DEPLOYET TIL PROD 2026-05-20 (prod-merge `cc8f0067`, develop merge `e4de5362`, impl `c523323a`)

Attestering-listen får fane-toggle `[Venter på attestering ●N] [Attestert ●M]`. Adresserer at attesterte sedler tidligere forsvant fra listen — bruker mistet oversikt over hva som var attestert denne uka.

**Server (`apps/api/src/routes/timer/dagsseddel.ts`):**
- `hentTilAttesteringFirma` Zod-input utvidet med `status: z.enum(["sent", "accepted"]).optional().default("sent")` — bakover-kompat for mobil og eksisterende klienter.
- Where-clause leser `input.status` i stedet for hardkodet `"sent"`.
- Per-rad-filter `attestertStatus: { not: "erstattet" }` gjelder begge faner — rader med `attestertStatus: "attestert"` slipper gjennom på attestert-fanen.

**Klient (`apps/web/src/app/dashbord/firma/timer/attestering/page.tsx`):**
- Ny `aktivFane: "sent" | "accepted"` state (default "sent").
- TO parallelle queries — samme uke-vindu, ulik status — for å vise badge-tall på begge faner uten å bytte.
- Fane-toggle over uke-navigasjonen med blå understreking på aktiv fane og rund badge-pille.
- `ProsjektGruppe` får `readOnly`-prop — «Attester gruppe (N)»-knapp skjules på attestert-fanen.

**SeddelKort (`apps/web/src/components/attestering/SeddelKort.tsx`):**
- Ny valgfri `readOnly?: boolean`-prop (default `false`).
- Header-knappene ↩ returner, ✓ attester og ⋯-meny skjult i read-only-modus.
- Per-rad-knapper: penn (rediger bucket) og ✂ (splitt rad) skjult for både timer- og maskin-rader.

**i18n (`packages/shared/src/i18n/{nb,en}.json`):**
- `timer.attestering.fane.venter` — "Venter på attestering" / "Pending approval"
- `timer.attestering.fane.attestert` — "Attestert" / "Approved"
- De 11 andre språkene håndteres av auto-oversettings-skriptet ved neste batch.

**Prod-deploy 2026-05-20:** HTTP/2 200 på sitedoc.no etter `pm2 restart sitedoc-web sitedoc-api`. Ingen migrasjon — kun server-zod-input + klient-endringer.

**Typecheck:** 0 nye feil. Pre-eksisterende `vitest`-import-feil i `import-hjelpere.test.ts` ikke berørt.

---

## T7-4g + T7-5d + pause-modell + filter-erstattet + maskin-validering-pause — DEPLOYET TIL PROD 2026-05-19 (prod-merge `f167e72c`)

Attestering UI-rensing + pause-modell + maskin-valideringskorrigering. Adresserer Kenneths klage om at SeddelKort tok for mye plass, modal-i-side føltes hverken-eller, og at pause/maskin-validering ga falske positiver for døgn-utleide maskiner. Migrasjon `20260517220000_add_pause_fra_til` applied i prod (`pause_fra`/`pause_til` TEXT-kolonner på `timer.daily_sheets`). Verifisert som innlogget bruker på A.Markussen AS — attestering-siden laster korrekt.

**Sub-PR-er merget til develop og inkludert i prod-bunken:**
- **T7-4g** (`85a00d22` impl, merge `5c6347d9`) — Kompakt kollapset SeddelKort. Header redusert til én linje (~48px): `[OT] Ola Tømrer · ons 13. mai · 8.00t / 7.50t [↩][✓][⋯][▾]`. Default-expanded ved tilleggHarKrav eller mertid (totaltimer > dagsnorm). Action-rad nederst fjernet. Detalj-lenke i ⋯-menyen. Tilgjengelig via tastatur (Enter/Space, aria-expanded).
- **T7-5d** (`b9a666ce` impl, merge `9727c7f9`) — RedigerRadModal erstatter RedigerSeddelModal. Penn-klikk åpner KUN den prosjekt+ECO-bucken raden tilhører, ikke hele sedelen. Hele-sedel-redigering går til detaljsiden via ⋯-menyen «Rediger». Sticky bucket-header med Lagre/Avbryt. Lagring bygger full `redigerSedelRader`-payload der andre bucker går uendret igjennom. AttesteringDetalj renset for modal-spesifikke props (`onFerdig`/`fullBredde`/`initialModus`) — er igjen ren fullside-komponent. I tråd med fase-0 § T7-5 sammenheng-prinsipp.
- **pause-modell** (`39ec00a3` impl, merge `2e3f23b8`) — Inline pause på timer-rad i RedigerRadModal. Ny `pause_fra`/`pause_til` TEXT-kolonner på `timer.daily_sheets`. pauseMin denormalisert sum, beholdes. Checkbox auto-hukes ved overlap mellom rad.fraTid/tilTid og pauseFra/pauseTil. Klikk lager default 30 min i midten av rad-intervallet. Rad-timer auto-recompute = rattid − pause-fradrag ved overlap. Sheet-level state — endring fra én rad reflekteres på alle overlapp. KompaktMaskinRad får info-rad når maskin overstiger arbeid.
- **filter-erstattet-rader** (`abf44a5a` impl, merge `d4748b6a`) — Server-fix for visnings-duplikater etter rediger. `hentTilAttesteringFirma` og `hentForAttestering` filtrerer nå ut `attestertStatus = "erstattet"` på include/findMany. Tidligere ble erstattet og pending vist sammen i SeddelKort → 2× rader etter hver rediger. Audit-spor i DB beholdes uendret — kun visning filtreres.
- **maskin-validering-pause** (`5a1bd3ef` impl, merge `43307429`) — Invariant utvidet til `sum(maskin) ≤ sum(timer) + pauseMin/60` per (prosjektId, ECO). Bakgrunn: maskin som leies pr. døgn (Heatwork-mønster: `equipment.utleie_enhet='doegn'`) går mens operatør pauser → 9.00t maskin mot 8.50t arbeid var falsk positiv. Maskin som selges pr. time følger operatør og blir naturlig ≤ arbeid (ingen pause-buffer brukes). Server `validerMaskinUnderArbeid` fikk `pauseMin = 0`-parameter, oppdatert i 7 kallesteder (tilfoy/oppdater × timer/maskin, redigerSedelRader, splittRad, syncBatch). Klient: `EcoBucketAttest` får valgfri `pauseMin`-prop, `RedigerRadModal` beregner `pauseTimer` fra `editPauseFra/Til`. AttesteringDetalj sender `sheet.pauseMin`.

**Arkitektur-drøfting 2026-05-17:** Tre alternativer vurdert — (A) patch symptomene, (B) rad-nivå redigering, (C) flat tabell (SmartDok-modellen). Valgt Alt B. Begrunnelse: adresserer rotårsaken (modal-i-side-hack via 3 overstyrings-props), honorerer vedtatt sammenheng-prinsipp, kaster ikke nylig arbeid (T7-4f/4g bevart), renser eksisterende technical debt. Alt C bryter sammenheng-prinsippet (maskin/timer på separate tabellrader). Alt A patcher symptomene uten å løse rotårsaken.

**Pause-modell — utviklet videre 2026-05-18:** Vedtatt MVP-løsning var inline checkbox uten fra/til. Faktisk implementert med fra/til-felter (mer ambisiøst enn MVP) for å støtte døgn-utleide maskiner korrekt. Pause-vindu på sedel-nivå brukes både til timer-fradrag og maskin-invariant-justering. Detaljer i [BACKLOG.md § Pause-modell](BACKLOG.md).

**Kjente begrensninger akseptert ved deploy:**
- **destruktiv recompute:** Når pause endres eller rad fra/til endres, overskrives rad.timer fra råtid − pauseMin. Manuelt justert timer kan gå tapt uten varsel. Vurderes som T7-5h.
- **multi-rad-overlap:** Hvis flere timer-rader overlapper pause-vinduet, trekkes pause fra hver rad isolert. Sjeldent i praksis (typisk én rad per dag).
- **per-rad audit-spor:** `redigerSedelRader` lager nye generasjoner for ALLE pending-rader på sedelen (ikke kun endret bucket). Database vokser med erstattet-rader per rediger-kall. Visnings-fix er deployet; per-rad-mutation-optimalisering er ikke prioritert.

**Verifisering prod (Kenneth, innlogget A.Markussen AS):** Attestering-siden laster korrekt. Uke 21 — ingen sedler venter, det er normalt.

---

## T7-4f + T7-5b + maskin-fra-til + B-fixes — Attestering komplett — DEPLOYET TIL PROD 2026-05-17 (prod-merge `44de2521`)

Komplett redesign av `/dashbord/firma/timer/attestering`-listen + modal-arkitektur + maskin-fra/til + QA-fix-runde B1/B2/B6. Spec låst i [fase-0-beslutninger.md § T7-4f og § T7-5](fase-0-beslutninger.md). Migrasjon `20260517120000_organization_setting_rediger_default_true` (`ALTER COLUMN tillattRedigerVedAttestering SET DEFAULT true`) applied i prod.

**Sub-PR-er merget til develop og inkludert i prod-bunken:**
- T7-4f-bunken (`bd70392e`) — server-beriking + ekstraher attestering-buckets + redesign attestering-liste + SeddelKort kompakt tabell + fritekst/sum/penn-fixes
- T7-4f-splitt-1-klikk (`b8c2f835` → merge `7ee31fa3`) — ✂-ikon per rad åpner SplittRadModal direkte
- T7-5b-1 (`b4e1a3ba` → merge `2a47dceb`) — DB-default `tillattRedigerVedAttestering=true` for nye firma
- T7-5b-2 (`b75a2a4b` → merge `30c20df9`) — `AttesteringDetalj.onFerdig?`-prop (senere fjernet i T7-5d)
- T7-5b-3 (`9b1055f6` → merge `b1ae1516`) — RedigerSeddelModal-wrapper (senere slettet i T7-5d)
- T7-5b-4 (`595ad4b3` → merge `7063cb36`) — SeddelKort penn-klikk åpner modal
- maskin-fra-til (`28a7c89a` → merge `ac7fa72e`) — MaskinRadDialog fra/til-felter
- B1 modal-bredde (`92774103` + `f9dfacf2` + `4fa345f5`) — Modal className + fullBredde-prop (senere ryddet)
- B2 maskinNavn null-safe (`141fc1ab`) — `[merke, modell].filter(Boolean).join(" ")` + internNavn-fallback
- B6 initialModus-prop (`b117cb75`) — direkte edit-modus (senere fjernet i T7-5d)

**Etterfølgende rens i T7-5d** (på develop fra 2026-05-17, ikke i prod ennå): RedigerSeddelModal slettet, AttesteringDetalj renset for modal-spesifikke props (`onFerdig`/`fullBredde`/`initialModus`). Per-rad-redigering via ny RedigerRadModal som åpner kun den prosjekt+ECO-bucken.

**QA-rapport:** [qa-rapport-2026-05-17.md](qa-rapport-2026-05-17.md). B7–B10 ✅.

---

## T7-4f-bunken (opprinnelig develop-deploy) — DEPLOYET TIL TEST 2026-05-17 (develop merge-kjede `99a4ec09..bd70392e`)

Komplett redesign av `/dashbord/firma/timer/attestering`-listen per godkjent mockup v7. Spec låst i [fase-0-beslutninger.md § T7-4f](fase-0-beslutninger.md). På develop og deployet til test — IKKE i prod ennå (avventer T7-4f-splitt-1-klikk + QA).

**Resultat på test:**
- Uke-navigasjon (← Uke X →) med dato-range + «Denne uka»-snarvei
- Filter-pills: Prosjekt / Ansatte / Avdeling (klient-side filter)
- Gruppering per prosjekt med sum + «Attester gruppe (N)»-knapp
- Kompakt sedel-kort med 4-kolonne tabell (Lønnsart | Aktivitet | Fra–til | Timer)
- Avatar (initialer), tilleggskrav-badge, fritekst-beskrivelse (line-clamp-2)
- ECO som blå sub-headers i tabellen («→ Byggherre»)
- Maskin-rader indentert grå under timer-rader (↳ prefiks)
- Tillegg-rader med oransje venstrekant per rad (ingen seksjonsheader)
- Sum-rad nederst høyrejustert i Timer-kolonnen
- Actions under tabellen (Returner / Attester / ⋯), kun Detalj-lenke i header
- Penn-ikon på hover per timer/maskin-rad
- Oransje styling (kant + avatar + attester-knapp) når `tilleggHarKrav=true`

**Sub-PR-er:**
- T7-4f-1 (`434a1293`) — Server: utvid `hentTilAttesteringFirma` med per-rad `project`-join, `tilleggHarKrav`, `dagsnorm`, `redigerTillatt`, ansatt-`avdelingId`
- T7-4f-2 (`4e0bdf9b`) — Refaktor: ekstraher `ProsjektSectionAttest` + `EcoBucketAttest` til `apps/web/src/components/attestering/attestering-buckets.tsx` (1119 → 525 linjer i AttesteringDetalj)
- T7-4f-3 (`101b756f`, merge `791ac396`) — Klient: full redesign av `firma/timer/attestering/page.tsx` (281 → ~600 linjer), uke-nav, filter-pills, gruppering, server-utvidet med `fraOgMed`/`tilOgMed`
- T7-4f-3b (`baac7487`, merge `ac0777d8`) — Ny `SeddelKort.tsx` (~330 linjer) erstatter `ProsjektSectionAttest`-bruk i firma-listen med kompakt tabell-layout
- Fix `df37f4d8` — fjern Tillegg seksjonsheader, oransje venstrekant per rad
- Fix `d0818f91` — sum-rad i Timer-kolonne + penn-ikon + actions under tabell
- Fix `bd70392e` — vis sedel-beskrivelse i kursiv grå tekst (line-clamp-2)

**Tre åpne avklaringer (per spec, ikke i scope):**
1. ECO-flytt skjult i listen via `kanFlytte={false}` (Alt B vedtatt) — T7-4f-4 ikke nødvendig
2. Vareforbruk-rad skjult — `SheetVareforbruk` finnes ikke i db-timer ennå
3. «Mertid uten tilleggskrav»-badge ikke implementert — krever normal-arbeidsdag-grense som data

**Klar for prod:** ja, men venter på T7-4f-splitt-1-klikk (feature/t7-4f-splitt-1-klikk på remote) før samlet prod-deploy.

---

## T7-2c/2d/2e/2f + T7-4a–e (splittRad + prosjekt+ECO-gruppering) — DEPLOYET TIL PROD 2026-05-16 (prod-merge `86fdb5a3`)

Hele bunken samlet i ett prod-deploy etter T.7-vedtak (låst 2026-05-16): maskin er utstyrsbidrag av samme tidsperiode som arbeidstimer, ikke additivt. Dagsseddel grupperes per (`projectId`, `externalCostObjectId`) med maskin som visuell underpost. Server håndhever `sum(maskin) ≤ sum(timer)` per gruppe. Grandfather: kun nye/redigerte rader valideres.

**Sub-PR-er (alle på develop før prod-deploy):**

- **T7-2c1** (`f6b92f70` merge, `53904028` impl) — `splittRad`-mutation i `dagsseddel.ts` med Zod discriminated union på `radType`. Per-tabell `$transaction` (marker original `erstattet` + opprett N nye med `parentRadId`). Sum-validering `Math.abs(diff) < 0.001`. Activity-log med `originalSnapshot` + `nyeSnapshot`. Retroaktiv audit-utvidelse på `redigerSedelRader`.
- **T7-2c2** (`75aa0227` merge, `b2708f22` impl) — `SplittRadModal.tsx` (~410 linjer). Diskriminert props-union, tre-seksjons-layout (Original referanse / Split-rader gjenbruker T7-2b2 Rediger*-komponenter / Gjenstår-indikator grønn/rød/gul). 13 nye i18n-nøkler under `timer.splitt.*` × 15 språk.
- **T7-2c3** (`4bfaacd7` merge, `ebfc269d` impl) — Integrasjon i `AttesteringDetalj_Edit`. Per-rad Splitt-knapp (kun original-rader uten `parentRadId`). `harUlagredeEndringer`-memo + `window.confirm` ved aktive endringer. Cache-resync via sortert ID-streng + useRef-guard. 2 nye i18n-nøkler.
- **T7-2d** (`ad7fc773` merge, `762b89a0` impl) — Per-rad prosjekt-join i `hentForAttestering` (app-layer A.20). `TimerRaderLeder`/`TilleggRaderLeder`/`MaskinRaderLeder` viser prosjektnavn (blå tekst) ved multi-prosjekt-sedler. `tillattRedigerVedAttestering = true` aktivert for Byggleder på test-DB samme dag.
- **T7-2e** (`1383b8eb` merge, `c480fe8a` impl) — Attestering edit-bugfix: tidsfelt `min-w-[120px]` + `step` clampet til 1800 (minutt-selektor alltid vises) + lokal string-state for timer-input (parses ved blur). Løser «fra-tid viser 0:» og «timer-endring fungerer ikke».
- **T7-2f** (`14740e56` direkte til develop) — `SplittRadModal` bredde `max-w-4xl` → `max-w-6xl` + `overflow-x-auto` på rad-container.
- **T7-4a** (`ffde00e5` merge, `f82957d2` impl) — Schema: `SheetMachine.externalCostObjectId String?` (svak FK A.20) + indeks. Migrasjon `20260516140000_t7_4a_machine_eco` (idempotent ALTER ADD COLUMN, ingen backfill). Mobil Drizzle speilet via idempotent ALTER i `migreringer.ts`.
- **T7-4b** (`e3c99bc3` merge, `ff5c90e1` impl) — Server: `validerMaskinUnderArbeid`-helper + `hentRaderForValidering` + `feilMeldingMaskinOverstiger`. Wired inn i 7 mutasjoner (`tilfoyTimerRad`, `oppdaterTimerRad`, `maskin.tilfoy`, `maskin.oppdater`, `redigerSedelRader`, `splittRad` maskin-gren, `syncBatch` per-sedel). ECO-input lagt til på alle maskin-mutasjoner + `hentEndringerSiden`-respons. `MaskinRow`/`MaskinSnapshot` utvidet med ECO.
- **T7-4c** (`38296dd5` merge, `151ca4a8` impl) — Web arbeider-detalj (`/dashbord/timer/[id]`): grupperingsnøkkel endret til `${projectId}|${ecoId ?? ""}`. Ny `EcoGruppe`-komponent (ECO-subheader + indigo-badge «→ Godkjenning byggherre» + arbeidstimer + indentert maskintimer + sum-indikator grønn/rød). `MaskinRadDialog` utvidet med ECO-velger. `defaultEcoId` pre-selekteres ved «+Legg til» i ECO-gruppe. 6 nye i18n-nøkler (`timer.gruppe.*` + `timer.detalj.ukjentEco`) × 15 språk.
- **T7-4d** (`82509083` merge, `b0791470` impl) — Web attestering: `AttesteringDetalj.tsx` + `AttesteringDetalj_Edit.tsx` + `SplittRadModal.tsx` til samme prosjekt+ECO-bucket-mønster. Nye `ProsjektSectionAttest`/`EcoBucketAttest` + `ProsjektSectionEdit`/`EcoBucketEdit`. Eksisterende rad-komponenter (TimerRaderLeder/MaskinRaderLeder/TilleggRaderLeder) gjenbrukt med filtrerte rader. ECO på `MaskinRow`/`RedigerMaskinRadData` + `MaskinRadOriginal`. RedigerMaskinRad fikk ECO-velger på action-rad.
- **T7-4e** (`08a76535` merge, `681d6098` impl) — Mobil: `apps/mobile/app/timer/[id].tsx` bygger ECO-bukets innen hvert prosjekt. Ny `EcoBucket`-komponent (speil av web `EcoGruppe`). `TimerSeksjon`/`MaskinSeksjon` fikk `defaultEcoId` + `visHeader`-props. `MaskinSeksjon` fikk ECO-velger i `MaskinRadModal` + ECO i DB-ops. `UnderprosjektVelgerModal` eksportert fra `TimerSeksjon` for gjenbruk. **Sync-fix:** `timerSync.ts` refererte `externalCostObjectId` kun for timer; maskin-mappingen i både push og pull manglet feltet. Hadde forblitt latent fordi ingen testdata har ECO på maskin enda.

**Verifisering prod 2026-05-16:**
- Migrasjon `20260516140000_t7_4a_machine_eco` applied 19:27:50 i `public._prisma_migrations`
- Kolonne `timer.sheet_machines.external_cost_object_id` finnes i prod
- HTTP/2 200 mot `sitedoc.no` + `api.sitedoc.no/health`
- PM2 `sitedoc-web` + `sitedoc-api` restartet, online

**Mobil:** T7-4e mobil-endringer er sovende på enhet til neste EAS-bygg. Idempotent Drizzle-migrasjon (T7-4a) kjøres ved app-oppstart via DatabaseProvider — ingen brytende endring for eldre klienter.

**Dokumentasjon låst i samme runde:**
- Flytskille arbeidstaker/attestering/Byggherre-godkjenning (T.7-utvidelse låst 2026-05-16) — se [fase-0-beslutninger.md § T.7](fase-0-beslutninger.md)
- Dagsseddel-struktur per (prosjekt, ECO) med maskin som underpost — samme sted
- Maskin-ECO-attestering: timer-attestering uavhengig av Byggherre-godkjenning; sistnevnte håndteres i fremtidig dokumentflyt-modul-kobling (rene visuelle hint i T7-4)

---

**Albansk (sq) lagt til som nytt språk + alle 14 eksisterende språk fullført IMPLEMENTERT på develop 2026-05-08.** Sitedoc støtter nå 15 språk (var 14).

**Albansk (`sq.json`):** 2145 nøkler oversatt fra `en.json` via `google-translate-api-x`. Visningsnavn «Shqip», flagg 🇦🇱. Ingen batch-feil for sq → ingen fallback til engelsk. 16 nøkler er identiske med engelsk verdi (legitime internasjonale ord: Admin, Email, Inbox, Logo, Video, SiteDoc, CSV/Excel-formatnavn).

**Sidegevinst — alle 14 eksisterende språk fullført til 2145-baseline:**
- 6 språk var på 974-baseline (cs, de, et, fi, fr, ro) → fylt ut med ~1171 manglende nøkler hver
- 8 språk var på 2130-baseline (lt, lv, pl, ru, sv, uk + andre) → fylt ut med 15 manglende nøkler hver (drift fra ny dokumentflyt-rename + brukere-rename)
- nb (2145) er sannhetskilden for nøkkel-rekkefølge; en (2148) er kilde for oversettelse
- 4 språk fikk én batch-fallback på 50 nøkler (ro, et, cs, de) — disse 50 er nå på engelsk og må re-oversettes ved senere kjøring

**Endringer:**
- `packages/shared/src/i18n/sq.json` — ny fil
- `packages/shared/src/i18n/index.ts` — sq tilføyd i `STOETTEDE_SPRAAK`
- `packages/shared/src/i18n/generate.ts` — sq tilføyd i `SPRAAK`-array
- `apps/web/src/lib/i18n.ts` + `apps/mobile/src/lib/i18n.ts` — sq importert + lagt til i `oversettelser`-objektet
- 14 eksisterende språkfiler — 7138 nye/oppdaterte oversettelser (1171 × 6 språk + 15 × 8 språk)

**Verifisering:** Web typecheck grønt (kun pre-eksisterende vitest-feil), web build 38.7s, mobil typecheck 12 = 12. Native-speaker-QA på fagtermer anbefalt for spesielt sq, cs, de, et, fi (LLM-kvalitet).

**Klar for test-deploy. Stopp og rapporter etter test-verifisering — prod-deploy avventer eksplisitt grønt lys.**

**Rename `kontakter` → `dokumentflyt` DEPLOYET TIL PROD 2026-05-09** (`4919befc` refactor + `27232541` i18n-verdier + `01e51bcd` deploy.sh-fix). HTTP/2 200 mot sitedoc.no. Lukker semantisk drift: ruta het `kontakter` mens UI allerede sa «Dokumentflyt». Alt nå konsistent.

**Route:** `apps/web/src/app/dashbord/oppsett/produksjon/kontakter/` flyttet til `dokumentflyt/`. Gammel sti er bevart som server-side redirect-stub for bakoverkompatibilitet (eldre bokmerker, eksterne lenker, onboarding-veivisere).

**Lenker (3 stk, ikke 2 som instruksen anslo):** `oppsett/layout.tsx` (sidebar `labelKey: oppsett.dokumentflyt`), `[prosjektId]/page.tsx` (2 hrefs i onboarding-checkpoint-bar). Verifisert via grep.

**i18n (14 språkfiler):** 502 nøkler renamet/duplisert via Node-skript:
- 402 nøkler `kontakter.X` → `dokumentflyt.X` (kun-dokumentflyt-bruk)
- 70 nøkler `kontakter.X` → `brukere.X` (kun-brukere-bruk: epost/telefon/firma/rolle/medlem)
- 28 dupliseringer (begge varianter): `faggrupper` + `grupper` (brukt i begge kontekster) opprettet både som `dokumentflyt.X` og `brukere.X` med samme verdi
- 22 globale: `nav.kontakter` → `nav.dokumentflyt` + `oppsett.kontakter` → `oppsett.dokumentflyt` (× 14 språk)
- `brukere.kontakter` (= "Kontakter"-overskrift på brukere-siden) **beholdt** — semantisk korrekt
- `dokumentflyt.kontakter` (= kolonne-overskrift «Kontakter» på dokumentflyt-siden) opprettet — semantisk korrekt

**Tre komponentfiler oppdatert:** `dokumentflyt/page.tsx` (28 t-kall via sed `"kontakter\.` → `"dokumentflyt.`), `dokumentflyt-komponenter.tsx` (3 t-kall), `brukere/page.tsx` (9 t-kall — 7 unike nøkler), `mobile/(tabs)/mer.tsx` (1 t-kall: `nav.kontakter` → `nav.dokumentflyt`).

**Verifisering:**
- Web grep `kontakter` etter rename: 15 treff (var 55) — alle er enten variabelnavn (`const kontakter`, `kontakterRå`, `KontaktMedlem`) eller semantisk korrekte i18n-nøkler (`brukere.kontakter` + `dokumentflyt.kontakter` for «Kontakter»-overskrifter)
- i18n grep: 24 treff (var 536) — alle er enten verdier («Kontakter», «Contacts», etc.) eller de to bevarte nøklene
- Mobil grep: 0 treff (var 1)
- `pnpm --filter @sitedoc/web typecheck` grønt (kun pre-eksisterende vitest-feil)
- `pnpm build --filter @sitedoc/web` grønt på 54.6s
- Mobil typecheck: 12 = 12 (ingen nye feil)

**Avvik fra instruks (flagget):** (1) Steg 2 sa `oppsett/produksjon/layout.tsx` men korrekt fil var `oppsett/layout.tsx`. (2) Steg 2 sa "2 stk lenker" men det var 3 (1 i layout + 2 i onboarding-checkpoint). (3) `nav.dokumentflyt`-verdiene er fortsatt «Kontakter» / «Contacts» / etc. — ren rename av nøkkel uten verdi-endring per instruks. Mobil-fanen i `(tabs)/mer.tsx` viser dermed fortsatt «Kontakter»-tekst, peker til en placeholder-menyrad uten onPress. Verdi-endring til «Dokumentflyt» er en separat designvurdering — utenfor scope.

**Sjekkliste opprett-modal + mobil rettighet DEPLOYET TIL PROD 2026-05-09** (`4e29c88a`). HTTP/2 200 mot sitedoc.no. To bugs i én PR.

**Bug 1 — Web (`apps/web/src/app/dashbord/[prosjektId]/sjekklister/page.tsx`):** Klikk på mal i opprett-modal gjorde ingenting når innlogget bruker ikke var medlem av noen faggruppe i prosjektet (typisk sitedoc_admin / company_admin uten faggruppe-tilknytning). `handleOpprettFraMal` returnerte stille på `if (!oppretter) return`. Fix: fallback-kjede henter `bestillerFaggruppeId` fra dokumentflytens `oppretter`-medlem når `mineFaggrupper` er tom; synlig feilmelding rendres i Modal hvis hverken brukerens egen faggruppe eller dokumentflytens oppretter-faggruppe finnes. Ny `opprettFeil`-state, `onError`-handler i `opprettMutation`, nullstilles ved Modal-onClose. Server-grensen `verifiserFaggruppeTilhorighet` har admin-bypass for sitedoc_admin og ProjectMember.role="admin" — admin kan trygt sende en hvilken som helst faggruppe-id. Company_admin uten ProjectMember-rad får fortsatt FORBIDDEN (eksisterende svakhet, utenfor scope), men feilen vises nå i UI i stedet for stille død UI.

**Bug 2 — Mobil (`apps/mobile/app/sjekkliste/[id].tsx`):** Sjekkliste i status `"sent"` ble read-only på mobil selv om mottakeren burde hatt redigeringsrett via `harBallen`/`flytRettighet`. `useSjekklisteSkjema(id!)` ble kalt uten `rettighetInput`, så hooken falt tilbake til forenklet status-sjekk (`REDIGERBARE_STATUSER = {"draft","received","in_progress"}`). Fix: speiler web-rettighetsberegningen — ny `trpc.gruppe.hentMineTillatelser`-query, fire useMemo-blokker (`harBallen`, `flytRettighet`, `rettighetInput`; `minRolle` fantes allerede), hook-kall endret til `useSjekklisteSkjema(id!, rettighetInput)`. Ingen endringer i hooken selv — den støtter `rettighetInput` allerede via `utledDokumentRettighet`. Importer utvidet med `beregnHarBallen` + `HarBallenDokument` fra `@sitedoc/shared`.

**i18n:** 1 ny nøkkel `sjekklister.feil.ingenFaggruppe` i nb+en. **Filer:** 4 endret (1 web, 1 mobil, 2 i18n), 0 server, 0 migrasjon. `pnpm --filter @sitedoc/web typecheck` grønt (kun pre-eksisterende vitest-feil i unrelated test). `pnpm build --filter @sitedoc/web` grønt på 36.4s. Mobil typecheck: 12 = 12 (ingen nye feil; pre-eksisterende gjeld dokumentert). **Oppfølger:** `apps/mobile/app/oppgave/[id].tsx` har sannsynligvis identisk Bug 2 (samme mønster med `useOppgaveSkjema(id!)` uten `rettighetInput`) — fikses i neste runde etter at sjekkliste-fixen er verifisert.

**Inviter + rediger firma-bruker IMPLEMENTERT på develop 2026-05-08.** Lukker arkitekturhull på `/dashbord/firma/brukere`: Florian (company_admin hos A.Markussen) kunne tidligere kun endre rolle på eksisterende brukere — kunne ikke invitere nye ansatte til firmaet eller redigere navn/e-post/telefon. Nå har siden «+ Inviter bruker»-knapp øverst og Pencil-ikon per rad (skjult for sitedoc_admin-rader).

**Server:** To nye tRPC-mutations i `apps/api/src/routes/organisasjon.ts`:
- `inviterBruker({ organizationId, navn, email, telefon?, rolle: "user"|"company_admin" })` — gates med `verifiserFirmaAdmin`. Oppretter User direkte (`canLogin=true`, organizationId, role). Bruker logger inn via OAuth (Google/Microsoft) med matchende e-post første gang. Ingen invitasjons-token, ingen e-post sendes (V1). Validering: e-post i samme firma → `CONFLICT` («allerede medlem»), e-post i annet firma → `CONFLICT` («tilhører et annet firma»), orphan-bruker uten organizationId → adopteres inn i firmaet (samme mønster som `medlem.leggTil`).
- `oppdaterBruker({ userId, organizationId, navn?, email?, telefon?, rolle? })` — gates med `verifiserFirmaAdmin`. Validerer at målbruker tilhører eget firma. Blokkerer endring av sitedoc_admin (samme regel som eksisterende `endreRolle`). Blokkerer self-degradering. Sjekker e-post-konflikt mot andre brukere ved e-post-bytte. Bare felt som er sendt blir oppdatert.

**Klient:** `apps/web/src/app/dashbord/firma/brukere/page.tsx` utvidet med to lokale modal-komponenter (`InviterModal` + `RedigerModal`). Header får «+ Inviter bruker»-knapp; tabell får ny kolonne med Pencil-ikon per rad. Begge modaler har 4 felt: Navn, E-post, Telefon, Rolle (radio: Bruker / Firmaadmin). `onSuccess` invaliderer `hentBrukere`. Eksisterende rolle-dropdown og outside-click-handler uendret. Konsistens: Begge modaler bruker samme i18n-nøkkel-prefix (`firma.brukere.inviter.*` for delte felt-labels).

**Rolle-tilgang:** Company_admin kan opprette/redigere både `user` og `company_admin` i eget firma — konsistent med eksisterende `endreRolle` som allerede tillater begge. Ingen ny RBAC-regel.

**i18n:** 14 nye nøkler nb+en under `firma.brukere.*` (knapp, modal-tittel, felt-labels, rolle-radio-labels, lagre/lagrer-tekst, rediger-tittel + iconLabel). Gjenbruker eksisterende `handling.lagre`/`handling.lagrer`/`handling.avbryt`. 4 filer endret (1 server, 1 klient, 2 i18n). Ingen DB-migrasjon. `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (40.5s) grønt. Klar for test-deploy. **Stopp og rapporter etter test-verifisering — prod-deploy avventer eksplisitt grønt lys.**

**Fullstendig i18n-oversettelse uk/ru/pl/lt/lv/sv DEPLOYET TIL PROD 2026-05-08** (`720a23dc` merge — 6 commits: `c4b6f6aa` uk, `b774b1de` ru, `4ddff556` pl, `4c0b8be8` lt, `e952c166` lv, `827e83ea` sv). HTTP/2 200 mot sitedoc.no. i18n-audit 2026-05-08 avdekket at alle 12 ikke-norske/engelske språk hadde EKSAKT 972 nøkler — frosset på historisk baseline mens nb/en vokste til 2129 (54 % drift). 6 prioriterte språk valgt etter byggebransje-relevans: ukrainsk (1), russisk (2), polsk (3), litauisk (4), latvisk (5), svensk (6). Per språk: 1157 manglende nøkler oversatt via `google-translate-api-x` (gratis, ingen API-nøkkel) fra en.json som kilde — bedre presisjon på fagtermer enn nb. Brukte eksisterende `packages/shared/src/i18n/generate.ts`-skript som mal, men patchet til ett språk per kjøring for atomiske commits. LLM-kvalitet — native-speaker-QA på fagtermer (Lønnsart, Faggruppe, Dokumentflyt, etc.) ønskes ved senere språkrunde. **Totalt 6 942 nye oversettelser** (1157 × 6). +7000/-18 linjer i merge. Gjenstår 6 språk på 972-baseline ved behov: cs, de, et, fi, fr, ro.

**i18n-fix 12 språk + hvem-har-ballen-badge mobil DEPLOYET TIL PROD 2026-05-07** (`4ff352a7` merge, `7921f59b` impl). HTTP/2 200 mot sitedoc.no. To-i-én: (1) i18n-fix lukker drift identifisert under mobil-implementasjon — `tabell.venterPaa` + `dashbord.venterPaaTilgangTittel`/`Beskrivelse` fantes kun på nb+en. Lagt til på 12 manglende språk (cs, de, et, fi, fr, lt, lv, pl, ro, ru, sv, uk) med kontekstuelle LLM-oversettelser. Web-versjon (deployet 2026-05-05 via `2e32b867`) hadde vist klartekst-nøkkelen «tabell.venterPaa» til ikke-norske/engelske brukere på sjekkliste/oppgave-detalj — nå rendres badge-tekst korrekt på alle 14 språk. (2) Hvem-har-ballen-badge speilet fra web på mobil `apps/mobile/app/oppgave/[id].tsx` + `apps/mobile/app/sjekkliste/[id].tsx`. Amber View med `recipientGroup.name` vises ved status sent/received/in_progress. Server-respons uendret — `recipientGroup` ble allerede returnert. Mobil-fix venter på EAS Build for å bli aktiv på fysisk enhet. Ingen DB-migrasjon. 14 filer endret (12 i18n + 2 mobil), `+72/-12`. **Pre-eksisterende mobil typecheck-feil (12 stk):** klassifisert som kjent teknisk gjeld — utsatt til separat «mobil typecheck cleanup»-runde. Mine endringer er ikke i feillisten.

**Rolle-dropdown outside-click-fix DEPLOYET TIL PROD 2026-05-07** (`9e264bfa` merge, `6ee229a3` impl). HTTP/2 200 mot sitedoc.no. Lukker bug der rolle-dropdown på `/dashbord/firma/brukere` lukket seg umiddelbart uten at brukeren rakk å velge ny rolle. Document outside-click-handler brukte `mousedown` som fires FØR React's onClick — handler-en kalte `setÅpenMeny(null)` før `setÅpenMeny(b.id)` rakk å åpne menyen. Fix: bytt fra `mousedown` til `click` så React-state oppdateres først. 2 linjer endret i `apps/web/src/app/dashbord/firma/brukere/page.tsx`. Server-tilgangskontroll var allerede korrekt — `endreRolle` bruker `verifiserFirmaAdmin` som godtar både sitedoc_admin og company_admin for eget firma. Verifisert: company_admin kan nå endre roller for andre brukere i eget firma via UI. Sideprodukt: Florians rolle ble satt til `company_admin` direkte i prod-DB via SQL UPDATE før fixen ble deployet, siden dropdown var blokkert.

**«Velg fra firma»-flyt for prosjektmedlemmer DEPLOYET TIL PROD 2026-05-07** (`f27a63dc` merge). HTTP/2 200 mot sitedoc.no. Lukker arkitekturhull: tidligere måtte admin skrive e-posten manuelt selv for brukere som allerede finnes på samme firma som prosjektet. Nå viser «Legg til bruker»-knappen på `/dashbord/oppsett/brukere` to faner — «Velg fra firma» (default, dropdown av eksisterende firma-brukere som ikke er medlemmer ennå) og «Inviter ny e-post» (eksisterende invitasjons-flyt for nye brukere). Ny `medlem.leggTilEksisterende`-prosedyre oppretter ProjectMember direkte uten e-post; ny `medlem.hentLedigeFirmaBrukere`-query filtrerer User-listen på `primaryOrganizationId + canLogin=true + ikke allerede medlem`. Server håndhever same-firma-validering (kan ikke legge til brukere fra andre firmaer). Idempotent: avviser hvis allerede medlem.

**Modul-piller i admin/firmaer + Varelager-bug DEPLOYET TIL PROD 2026-05-07** (`620a85c7` merge). HTTP/2 200 mot sitedoc.no. Slide-over og tabell i `/dashbord/admin/firmaer` viser nå alle 3 firmamoduler (timer, maskin, varelager) som kompakte piller — grønn fyll når aktiv, grå når inaktiv. Tidligere to separate kolonner (Timer + Maskin) er kombinert til én «Moduler»-kolonne med samme pill-stil. Slide-over har én «Firmamoduler»-seksjon istedenfor to store kort. Bug-fix: Varelager-modul vises nå korrekt i admin-vyen — manglet helt før. Skalerbar når flere firmamoduler kommer (kompetanse/fremdrift/planlegger): én linje i `FIRMAMODULER`-arrayet i `apps/web/src/app/dashbord/admin/firmaer/page.tsx`.

**Admin-impersonering DEPLOYET TIL PROD 2026-05-07** (`a3765a97` merge). HTTP/2 200 mot sitedoc.no. Migrasjon `20260507000001_session_impersonering` applied til prod-DB (3 nullable-kolonner + indeks). Sitedoc_admin kan nå klikke «Imperser» per bruker-rad i admin/firmaer slide-over og se appen som denne brukeren — gul banner øverst med «Stopp»-knapp, 1t-utløp, audit-log via console.log. Sikkerhetsregler: forbudt å impersonere andre sitedoc_admins, seg selv, eller deaktivert bruker. Augmented-session-mønster bevarer admin-id i `originalUserId` for fremtidig per-mutation audit-log.

**Lærdom underveis:** UNAUTHORIZED-feil ved første test-runde fordi cookie-lesing brukte Fastify-style `req.headers.cookie`, men tRPC-mutations kjører i Next.js-web-prosessen der `req` er fetch-Request (Web API Headers krever `headers.get("cookie")`). Fix (`910437e3`): eksponer pre-parsed `sessionToken` direkte i tRPC-context — admin.ts bruker `ctx.sessionToken` istedenfor å re-parse cookie. 14 linjer cookie-parsing fjernet fra hver mutation. Lærdom: tRPC-handlers som leser cookies må aldri anta Fastify-spesifikt format.

**Impersonering («view as user») IMPLEMENTERT på develop 2026-05-07.** Klassisk SaaS-admin-funksjon: sitedoc_admin kan logge inn som hvilken som helst ikke-admin-bruker for å se appen som dem (kundestøtte, debugging, onboarding-verifisering). Augmented-session-mønster: `Session.impersonatedUserId` + `originalUserId` + `impersonationExpiresAt` settes på admin sin egen session-rad. tRPC-context bruker `impersonatedUserId` som effektiv userId for autorisering, men bevarer `actualUserId` (admin) for audit-logger.

**Server:**
- Migrasjon `20260507000001_session_impersonering` — 3 nye nullable-kolonner på `sessions` + indeks på `impersonated_user_id`
- `apps/api/src/trpc/context.ts` — utvidet med `actualUserId` + `imperseringAktiv`. `userId` returnerer fortsatt effektiv id (impersonert hvis gyldig, ellers admin).
- `apps/web/src/app/api/trpc/[...trpc]/route.ts` — samme logikk replikert i Next.js-route-context (slår opp session-rad direkte via cookie). Begge gates trygt på `impersonationExpiresAt > new Date()`.
- 3 nye admin-prosedyrer: `hentImpersoneringStatus` (status-query med target-info), `startImpersonering({ targetUserId })` (verifiserer admin via `actualUserId`, blokkerer self-impersonering, blokkerer impersonering av andre `sitedoc_admin`, blokkerer deaktivert bruker, oppdaterer egen session-rad med 1t-utløp), `stoppImpersonering` (nullstiller felter — fungerer selv når impersonering aktiv siden den gates på `actualUserId`). Audit-log: `console.log` med actor + target i MVP.

**Klient:**
- Ny komponent `apps/web/src/components/layout/ImpersoneringBanner.tsx` — global gul banner med ShieldAlert-ikon, viser «Du imperserer Navn (Firma)» + «Stopp»-knapp. Polling hvert 60s + refetchOnWindowFocus. Stopp trigger hard reload til `/dashbord` for å resette tRPC-cache og bringe admin-UI tilbake.
- Banner mountet i `apps/web/src/app/dashbord/layout.tsx` rett under Toppbar — alltid synlig over hele dashbord-treet, inkl. firma- og admin-sider.
- Ny `ImperserKnapp`-komponent i `apps/web/src/app/dashbord/admin/firmaer/page.tsx` — liten knapp ved hver bruker-rad i firma-detalj-slide-over. Skjult for sitedoc_admin-rader (kan ikke impersonere andre admins). Hard reload til `/dashbord` ved suksess.

**Sikkerhetsregler implementert:**
- Kun `sitedoc_admin` kan starte (verifisert via `actualUserId`, ikke effektiv `userId`)
- Kan IKKE impersonere andre `sitedoc_admin` (forhindrer eskalering)
- Kan IKKE impersonere seg selv
- Kan IKKE impersonere deaktivert bruker (canLogin=false)
- Auto-utløp etter 1t — context dropper impersonering når `impersonationExpiresAt < now`
- Banner alltid synlig (mountet i dashbord/layout) — admin kan ikke «glemme» imperseringen

4 nye i18n-nøkler nb+en (`impersonering.banner.*`). 1 ny migrasjon, 2 nye komponenter, 5 modifiserte filer. `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (31.0s) grønt. Klar for test-deploy. **Krever migrasjon på test-DB før test-bruk:** `prisma migrate deploy` kjøres automatisk av deploy-pipelinen, men hvis test-deploy ikke gjør det, må migrasjonen kjøres manuelt før første impersonerings-mutation. **Stopp og rapporter etter test-verifisering — prod-deploy avventer eksplisitt grønt lys.**

**HovedSidebar skjult i firma-kontekst + Tilbake-lenke DEPLOYET TIL PROD 2026-05-06** (`8a184fc8` merge). HTTP/2 200 mot sitedoc.no. Når brukeren er på `/dashbord/firma/*` skjules HovedSidebar via `usePathname()`-sjekk i `dashbord/layout.tsx`; firma-sub-sidebar (280px) er da eneste sidebar. Ny «← Tilbake til dashbord»-lenke (ArrowLeft-ikon) øverst i firma-sidebar-headeren over firmanavnet — peker til `/dashbord` og bringer HovedSidebar tilbake. UX-forenkling: rydder opp i to-sidebar-stablingen som var i firma-administrasjon.

**Fakturering-gating + U5-forkasting DEPLOYET TIL PROD 2026-05-06** (`207a223c` merge). HTTP/2 200 mot sitedoc.no. Fakturering-menyelement i firma-sidebar er nå skjult for `company_admin` — kun `sitedoc_admin` ser det. `NavElement`-typen utvidet med `kreverSitedocAdmin?: boolean`-flagg, render-filter hopper over når flagget er satt og bruker ikke er sitedoc_admin. **Merknad om første forsøk:** Fix-en feilet med «Application error» ved første test-deploy (commit `77939c63`) — krasj viste seg å være deploy-race-condition (HTML/JS-bundle-mismatch under PM2 reload), ikke kode-feil. Cherry-picket samme commit (`eabd34d7`) til develop og verifisert med hard reload uten problem. UX-agenda U5 (byggeplass selvstendig flyt) lukket som **forkastet** — byggeplass-data (geofence, GPS, §15-liste) er prosjekt-bundne, og selvstendig firma-byggeplass ville bli orphan-rad. UX-agenda er nå komplett lukket: B1+B2+B3 deployet, U1-U7 enten implementert eller forkastet.

**Integrasjonsadmin (kryptering) + Brreg-autofyll DEPLOYET TIL PROD 2026-05-06** (`878e90ec` merge). To PR-er sammenslått i én prod-deploy. HTTP/2 200 mot sitedoc.no. SITEDOC_INTEGRATION_KEY satt i begge prod-prosesser (sitedoc-web + sitedoc-api), 64 tegn verifisert. Brreg-autofyll-knappen «Hent fra Brønnøysund» fungerer på `/dashbord/firma/innstillinger` (firma-admin) og `/dashbord/admin/firmaer`-opprett-modal (sitedoc_admin) — autofyller firmanavn fra `data.brreg.no` (åpent API). Type-rename `sentralregisteret` → `reginn` ferdig på prod. UI-tile for Sentralregisteret fjernet fra firma-integrasjons-side; erstattet med «ingen aktive integrasjoner ennå»-melding. AES-256-GCM-kryptering aktiv på `OrganizationIntegration.apiKey` ved opprett/oppdater (admin-CRUD). Reginn-integrasjonen (worker, oppslag) bygges senere når MEF-endepunkter er dokumentert (ref. N2.2.3 i [oppryddings-plan-2026-04-28.md](docs/claude/oppryddings-plan-2026-04-28.md)).

**Brreg-autofyll på orgnr IMPLEMENTERT på develop 2026-05-07.** Firma-oppslag på organisasjonsnummer mot Brønnøysund Enhetsregisteret (`data.brreg.no`, åpent API uten auth). «Hent fra Brønnøysund»-knapp ved orgnr-felt på `/dashbord/firma/innstillinger` (firma-admin) og `/dashbord/admin/firmaer`-opprett-modal (sitedoc_admin). Autofyller firmanavn (alltid) + fakturaadresse (kun firma-innstillinger der adressefeltet finnes).

**Server:** Ny `apps/api/src/services/brreg.ts` med `hentFirmaFraBrreg(orgnr)` og `erGyldigOrgnr(input)` (Modulus-11-validering: vekter 3,2,7,6,5,4,3,2 — kontroll-rest=0 → kontroll=0, rest≠0 → kontroll=11-rest, kontroll=10 → ugyldig). 8s-timeout via AbortController. Returnerer `{ orgnr, navn, orgform, adresse, postnummer, poststed, aktiv }`. `BrregError`-klasse med kodede feiltyper (`UGYLDIG_ORGNR` → tRPC `BAD_REQUEST`, `IKKE_FUNNET` → `NOT_FOUND`, ellers `INTERNAL_SERVER_ERROR`). Ny tRPC-procedure `organisasjon.hentFraBrreg` (protectedProcedure — ingen firma-binding siden Brreg er offentlig, men auth kreves for å ikke være anonym proxy).

**Type-rename `sentralregisteret` → `reginn`:** Avklart med Kenneth at Sentralregisteret-navnet egentlig hører til **Reginn MREG** (`api.sentralregisteret.no` — MEF-utstyrsregister med sakkyndig kontroll), IKKE Brønnøysund. Forrige PR sin Sentralregisteret-tile var feilaktig kategorisert. Type-whitelist i `admin.ts` byttet fra `"sentralregisteret"` til `"reginn"` (clean slate — 0 rader på prod). UI-tile fjernet fra `/dashbord/firma/innstillinger/integrasjoner`. `INTEGRASJON_TYPER` i admin/firmaer-side utvidet med `reginn` (label «Reginn MREG»). Selve Reginn-integrasjonen (worker, oppslag) bygges senere når funksjonelle endepunkter er dokumentert (ref. N2.2.3 i [oppryddings-plan-2026-04-28.md](docs/claude/oppryddings-plan-2026-04-28.md)).

**Klient:** Brreg-knapp (Search-ikon) ved siden av orgnr-input. Disabled hvis orgnr ikke er 9 siffer (UI-validering); server validerer Mod-11 før HTTP-kall. Feilmelding rendres rødt under feltet ved BrregError. `useQuery({ enabled: false })` + manuell `refetch()` slik at oppslag kun skjer ved klikk. 3 nye i18n-nøkler nb+en (`brreg.hent`, `brreg.henter`, `firma.integrasjoner.ingenAktive` — erstatter de 2 fjernede `firma.integrasjoner.sentralregisteret.*`-nøklene).

3 nye filer (brreg.ts service), 5 modifiserte filer. `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (39.2s) grønt. Klar for test-deploy.

**Integrasjonsadmin (kryptering + firma-UI + admin-status) VERIFISERT PÅ TEST 2026-05-07.** Klart for prod-deploy. Test-verifisering: Sentralregisteret-kort viser «Koblet» etter lagring + reload, password-feltet er tomt, «Endre nøkkel»/«Fjern» fungerer, kryptering at-rest verifisert i sitedoc_test-DB.

**Lærdom — env må i begge prosesser:** `SITEDOC_INTEGRATION_KEY` må stå i **både** `sitedoc-web`- og `sitedoc-api`-blokkene i `ecosystem.config.js`, fordi tRPC-mutations som kaller `krypter()` kjører i Next.js-web-prosessen (ikke Fastify-api). Kun api-blokken er ikke nok — feilen «SITEDOC_INTEGRATION_KEY mangler» kastes fra web-prosessen. Lærdom dokumentert i [docs/claude/deploy-detaljer.md § tRPC-mutations env-konsekvens](docs/claude/deploy-detaljer.md). **Prod-deploy-prosedyre:**
1. Generer ny prod-nøkkel: `openssl rand -hex 32` (på prod-server)
2. Legg i begge env-blokker i prod `ecosystem.config.js` (sitedoc-web + sitedoc-api)
3. `pm2 reload ecosystem.config.js --update-env`
4. Merge develop til main + auto-deploy

**Test-nøkkel-rotering:** Test-nøkkelen `1dcd...4fe4` ble eksponert i chat-loggen under feilsøking. Roter på test etter sesjon (lag ny + oppdater begge ecosystem-blokker).

**Integrasjonsadmin (kryptering + firma-UI + admin-status) IMPLEMENTERT på develop 2026-05-07.** Per-firma integrasjons-administrasjon med AES-256-GCM-kryptering av API-nøkler at-rest. Lukker sikkerhetsproblemet at `OrganizationIntegration.apiKey` ble lagret i klartekst. Forutsetning for Sentralregisteret-integrasjon (Brønnøysundregistrene) — første firma-nivå-integrasjon i ny UI-flyt. SmartDok holdes utenfor denne PR per instruks. Vegvesen-strategi: behold env-variabel (12-factor, byttes sjelden), men nytt admin-kort viser konfig-status read-only.

**Krypteringslag:** Ny `packages/db/src/encryption.ts` med AES-256-GCM. 12-byte tilfeldig IV per kryptering, 16-byte authTag, base64-output `iv|authTag|ciphertext`. Master-nøkkel fra `SITEDOC_INTEGRATION_KEY` (64 hex-chars / 32 byte). `verifiserKrypteringsKonfig()` for early-fail ved oppstart. Eksplisitte `krypter()`/`dekrypter()`-kall i routerne (ikke Prisma `$extends` — ville brutt type-systemet i hele monorepo siden extended client mangler `$on`/`$connect` osv. og bryter alle `PrismaClient`-typer). Eksplisitt kall er mer lesbar og unngår type-kaskade.

**Server:** Ny `apps/api/src/routes/firma-integrasjon.ts` med `list`/`lagre`/`slett` — gates med `autoriserAdminForFirma` (sitedoc_admin og company_admin). Type-whitelist `["sentralregisteret"]` i denne PR. Returnerer alltid `harNøkkel: boolean`, aldri klartekst. Eksisterende `admin.ts` opprett/oppdater-mutations utvidet til å kryptere ved lagring + støtter ny type `"sentralregisteret"`. Ny `admin.hentPlatformIntegrasjoner` returnerer Vegvesen + krypteringsnøkkel-status (basert på `process.env`). `firmaIntegrasjon`-router montert på `appRouter`.

**Klient:** Ny side `/dashbord/firma/innstillinger/integrasjoner` med kort-basert UI per integrasjon (Sentralregisteret), status-badge (Koblet/Ikke koblet), `<input type="password">` (alltid tomt ved load — placeholder `••••••••` hvis koblet), Lagre/Endre-nøkkel/Fjern-knapper. Ny side `/dashbord/admin/integrasjoner` med to seksjoner: Platform-nivå (Vegvesen + Krypteringsnøkkel — read-only, viser env-variabel-navn) + Firma-nivå (placeholder-tekst, full admin-vy kommer senere). Sidebar-link `Integrasjoner` (Database-ikon) i begge layouts.

**Test-rens:** `c9a86fa4-...` (proadm testdata på Byggeleder) slettet via SQL før push — gamle klartekst-rader ville feilet dekryptering med ny middleware (eller via fallback-til-null). 0 rader på prod, så ingen prod-migrering nødvendig.

**i18n:** ~24 nye nøkler nb+en under `firma.integrasjoner.*` og `admin.integrasjoner.*`. **`.env.example`:** `VEGVESEN_API_KEY` + `SITEDOC_INTEGRATION_KEY` lagt til med kommentar om generering (`openssl rand -hex 32`).

5 nye filer (encryption.ts + firma-integrasjon.ts + 2 sider + ny mappe), 7 modifiserte filer. `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (35.7s) grønt. **Krever manuell env-oppdatering før test-deploy:** `SITEDOC_INTEGRATION_KEY` må settes på test- og prod-server (`openssl rand -hex 32`). Klar for test-deploy etter env-oppdatering. **Stopp og rapporter etter test-verifisering — prod-deploy avventer eksplisitt grønt lys.**

**B1+B2 KOMPLETT PÅ PROD 2026-05-06.** UX-agenda har nå alle 3 vedtatte beslutninger (B1+B2+B3) deployet til prod. Gjenstående UX-oppgaver: kun U5 (byggeplass selvstendig flyt). U1, U2, U3, U4 (erstattet av B3), U6 og U7 er allerede løst og deployet.

**B2 (onboarding-checkpoint-bar med modul-piller) DEPLOYET TIL PROD 2026-05-06** (`da00d55d` merge). UX-agenda B2 lukket på server- og klient-side, verifisert på test og deployet til prod. HTTP/2 200 mot sitedoc.no. Test-verifisering bekreftet at banneret skjules korrekt når alle synlige steg (inkl. nye modul-piller) er ferdig — prosjekt 998 Instinniforbotn på test har timer+varelager aktivert med alle ferdig-kriterier oppfylt (lønnsart=41, aktivitet=3, vare=57), banner skjult som forventet. Server: `prosjekt.hentOnboardingStatus` utvidet med 6 nye flagg — `timerAktiv/harTimerOppsett`, `maskinAktiv/harMaskinregister`, `varelagerAktiv/harVarekatalog`. Modul-aktivering avledes fra `ProjectModule.status="aktiv"`. Ferdig-kriterier: Timer = `prismaTimer.lonnsart.count > 0 && prismaTimer.aktivitet.count > 0`; Maskin = `prismaMaskin.equipment.count > 0`; Varelager = `prismaVarelager.vare.count > 0`. Tellinger kjøres mot prosjektets `primaryOrganizationId`; standalone prosjekt har alltid modul-flagg = false. Klient: `apps/web/src/app/dashbord/[prosjektId]/page.tsx` bygger steg-array dynamisk — modul-piller legges til via spread bare når aktivert. `alleFerdige`-sjekken bruker kun synlige piller. Lenker peker til firma-sidene (`/dashbord/firma/timer/onboarding`, `/dashbord/maskin`, `/dashbord/firma/varelager`) siden modul-oppsett er firma-nivå-arbeid. Banneret skjules fortsatt for ikke-admin (eksisterende `erAdmin`-sjekk uendret). 3 nye i18n-nøkler nb+en (`onboarding.timerOppsett`, `onboarding.maskinregister`, `onboarding.varekatalog`). 1 server-fil, 1 klient-fil, 2 i18n-filer. `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (36.1s) grønt. Klar for test-deploy. **Stopp og rapporter etter test-verifisering — prod-deploy avventer eksplisitt grønt lys.**

**B1 (ProsjektVelger scope-rader) DEPLOYET TIL PROD 2026-05-06** (`2f22c503` merge). UX-agenda B1 lukket på server- og klient-side, verifisert på test og deployet til prod. HTTP/2 200 mot sitedoc.no. Server: `prosjekt.hentMine` (apps/api/src/routes/prosjekt.ts) endret til medlemskaps-filter uavhengig av rolle — sitedoc_admin og company_admin filtreres nå også på `members.some.userId`. `hentAlle` beholder admin-bypass for «Alle»-scope. Klient: `ProsjektKontekst` (apps/web/src/kontekst/prosjekt-kontekst.tsx) utvidet med `prosjektScope: "alle" | "mine" | "enkelt"`, `mineProsjekter`-liste og `velgScope(scope)`-funksjon. Scope persisteres i ny localStorage-key `sitedoc-prosjekt-scope` (default `"mine"`). URL med prosjektId tvinger `scope="enkelt"`. ProsjektVelger (apps/web/src/components/layout/ProsjektVelger.tsx) viser to scope-rader øverst (LayoutGrid + Star-ikon, telling = N/M) — kun for sitedoc_admin og company_admin. Vanlig user (`role="user"`) får ren prosjektliste som før. Knapp-tekst speiler aktiv scope. `velgScope` nullstiller prosjekt-id og ruter til `/dashbord`. Dashbord-startsiden (`/dashbord/page.tsx`) filtrerer visnings-listen på scope; auto-redirect-logikken bruker fortsatt full prosjektliste (førstegangs-onboarding). Ny tom-state-tekst for «Mine»-scope peker brukeren til «Alle prosjekter». 7 nye i18n-nøkler nb+en (`prosjektVelger.*` + `dashbord.ingenMineProsjekterBeskrivelse`). 1 server-fil, 3 klient-filer, 2 i18n-filer. `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (35.3s) grønt. Klar for test-deploy. **Stopp og rapporter etter test-verifisering — prod-deploy avventer eksplisitt grønt lys.**

**UX-runde 1 (B3+U1+U2+U3+U6+U7) DEPLOYET TIL PROD 2026-05-06.** Tre prod-deploy-merges samme dag bringer 6 UX-vedtatte endringer til prod:

- `c2da3135`: **U3** sidebar tekst-labels (60→200px) + **B3** modul-fargedesign (Alternativ C). Toppbar uendret. Sidebar-aktivt element får 3px border-left + farget ikon når elementet hører til aktiv modul. Palett: prosjekt #378ADD, timer #3B6D11, maskin #854F0B, varelager #1D9E75. Ny `apps/web/src/lib/modul-farger.ts` med UUID-{36}-regex for prosjekt-rute-detect.
- `1781a17a`: **U7** fritekst utstyrstype. Hardkodet `<select>` byttet til `<input type="text">` + `<datalist>`-forslag. Vegvesen-auto-foreslag oppdatert til labelKey-form for å matche datalist.
- `c551063f`: **U1** leder-timer-rapport på firmanivå. Ny `timer.rapport`-router (firmaPeriodeRapport + hentFirmaProsjekterMedTimer + hentFirmaAnsatteMedTimer) gates med `autoriserAdminForFirma`. Ny side `/dashbord/firma/timer/rapport` med periode-velger (4 hurtig-knapper + egendefinert), prosjekt+ansatt-filter, 5-kort sammendrag, sortbar tabell + ekspanderbar detalj (per-dag toggle uke + per-prosjekt). Status-badges per ansatt. ~30 i18n-nøkler. **React #310-fix:** useMemo flyttet før early returns (samme bug-mønster som tidligere økonomi-React310, dokumentert i memory).
- `e4f594fa`: **«Mine timer» flyttet** fra firma-sub-sidebar til HovedSidebar (personlig daglig funksjon, ikke admin). Ny Seksjon-verdi `"mine-timer"`, hovedelement (ikke bunn), timer-grønn aksent. **Global scrollbar-fix:** `<main className="flex-1 overflow-y-auto">` rundt `{children}` i `dashbord/layout.tsx` — fjerner kuttet innhold på sider uten egen scroll-wrapper.
- `31cff7da`: **U2** CSV/Excel-eksport på timer-rapport. Ny `apps/web/src/lib/timer-rapport-eksport.ts` med `eksporterCsv` (semikolon-CSV med UTF-8 BOM) + `eksporterXlsx` (3 ark: Sammendrag/Per prosjekt/Per dag). Lazy-import av exceljs. Filnavn `SiteDoc-timer-{firma-slug}-{fra}-{til}.{csv|xlsx}`. Norsk tallformat (komma som desimal). Respekterer alle filtre. Eksport-knapp med dropdown i header.
- `3dd4371b` (tidligere samme dag): **U6** maskin sitedoc_admin firma-kontekst-fix + Heatwork-seed (5 Equipment-rader for A.Markussen).

A.Markussen-onboarding fullført. UX-agenda har **3 vedtatte beslutninger ferdig (B1+B2+B3)** + **6 åpne oppgaver løst (U1+U2+U3+U6+U7)** + 2 åpne (U4 erstattet av B3, U5 byggeplass-flyt gjenstår). Detaljer i [docs/claude/ux-arkitektur-agenda.md](docs/claude/ux-arkitektur-agenda.md). HTTP/2 200 mot sitedoc.no etter alle deploys.

**Heatwork-seed + U6 maskin firma-kontekst-fix DEPLOYET TIL PROD 2026-05-06** (merge `3dd4371b`). U6 lukket og verifisert: equipment-router har ny `hentMaskinOrgFraInput` + `verifiserMaskinTilgang` med sitedoc_admin-bypass; klient (maskin/page.tsx, maskin/nytt/page.tsx, maskin/[id]/page.tsx) sender `useFirma().valgtFirma?.id`. Sitedoc_admin kan nå administrere maskinregisteret for kunder via UI. Heatwork-seed mot prod (`4488fe17-...`): 3 nye opprettet (7626/7628/7630 — type=Heatwork 3600, erUtleieobjekt=true, utleieEnhet=doegn), 2 eksisterende rettet manuelt i UI (7632 + 7634 — fra SmartDok-import 2026-05-03 hadde feil oppsett, oppdatert til Heatwork 3600/MY35 med erUtleieobjekt=true). Alle 5 Heatwork-utleie-Equipment-rader for A.Markussen ferdig konfigurert. HTTP/2 200 mot sitedoc.no etter restart. Steg 4b er nå fullt lukket på prod inkludert U6-fix og Heatwork-radene.

**Steg 4b Sesjon 3 DEPLOYET TIL PROD 2026-05-06** (merge `37a1fe89` — bringer `420c0464` import-flyt + `5e7aa8d2` seed-script + UX-dok inn på main). Lukker Steg 4b fullt ut på prod. Migrasjon `20260507000001_vare_unique_navn_enhet` applied til prod-DB (Vare unique fra `(orgId, varenummer)` til `(orgId, navn, enhet)`). Seed-kjøring mot A.Markussen (`4488fe17-7490-409f-9c1c-2827f257c54d`) opprettet 7 kategorier + 57 varer på prod-DB. Verifisert mot DB: korrekt fordeling (Grus/pukk/jord 36, Naturstein 8, Diverse 7, Rør og rørdeler 2, Betongstein og elementer 2, Forbruk 1, Deponiavgift 1) + 2 pris-rader (Matjord fra lager Beisfjord m3=100,00 + Samfengt grus m3=80,00). HTTP/2 200 mot sitedoc.no etter PM2-restart. **Gjenstår manuelt på din side:** opprett 6 Heatwork-utleie-Equipment-rader (7626/7628/7630/7632/7634 + HW-vifte) med `erUtleieobjekt=true`, `utleieEnhet=doegn`. Varelager-modul allerede aktivert for A.Markussen per UX-agenda 2026-05-06. UX/arkitektur-gjennomgang KOMPLETT med 3 vedtatte beslutninger (B1 toppbar prosjektvelger, B2 onboarding-checkpoint-bar, B3 modul-fargedesign Alternativ C — sidebar-aksent + ikonfarge, toppbar uendret) i [docs/claude/ux-arkitektur-agenda.md](docs/claude/ux-arkitektur-agenda.md). 4 åpne oppgaver gjenstår (U1 leder-timer-rapport, U2 eksport alle ansatte, U3 sidebar tekst-labels, U5 byggeplass selvstendig flyt — U4 erstattet av B3). B3-implementasjon planlagt som egen frontend-sesjon etter A.Markussen-onboarding er stabilisert. Server: ny utility `apps/api/src/utils/vareforbrukImport.ts` parser SpreadsheetML XML (filtype `Varedetaljer.xls.xls` er XML, ikke binær), normaliserer enheter (Døgn→doegn, m³→m3), beregner SHA-256 fil-hash, filtrerer ut navn=«.» og kategori=«Utleie Heatwork» (Beslutning 3 — opprettes manuelt som Equipment). Ny tRPC-router `vareImport` med `importerForhandsvisning` + `importerBekreft`, montert på `appRouter.vareImport`. `importerBekreft` kjører atomisk `$transaction`: seed nye `VareKategori`-rader først, så `Vare`-rader med `kategoriId`-FK satt. Duplikat-håndtering: DB-duplikater (samme navn+enhet i firma) + fil-interne duplikater hoppes over uten å ruller hele transaksjonen. Klient: ny side `/dashbord/firma/varelager/import` med 4-stegs flyt (drag-and-drop + klikk → forhåndsvisning med kategori-oversikt + Heatwork-advarsel + tabell-preview → bekreft → resultat med egen Heatwork-instruks-boks). «Importer fra SmartDok»-knapp på katalog-siden byttet fra `disabled` til `<Link>` til ny rute. ~50 nye i18n-nøkler under `firma.varelager.import.*` i nb+en. 1 ny migrasjon, 2 nye filer (parser + router), 1 ny side, 4 endrede filer. `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (36.2s) grønt. Klar for test-deploy. **Stopp og rapporter etter test-deploy — Claude verifiserer import-flyten på Byggeleder før prod-deploy.** A.Markussen-import (post-prod): 7 kategorier + 57 varer fra `Varedetaljer.xls.xls` + manuell opprettelse av 6 Heatwork-Equipment-rader.

**Steg 4b Sesjon 2 (Fase 3 + Fase 4) DEPLOYET TIL PROD 2026-05-06** (merge fra develop — impl `da354766` + fix `7d95087f`). Lukker Vareforbruk-modul-bygging på server-siden + web-UI; gjenstår kun Sesjon 3 (Fase 5: import-flyt). Bygger på Sesjon 1 (deployet test 2026-05-06, ikke til prod isolert siden Sesjon 2 leverer komplett produkt). Tre nye tRPC-routere (`vareKategori`, `vare`, `vareforbruk`) montert i `appRouter`. Infrastruktur: `FirmamodulSlug` utvidet til `"timer" | "maskin" | "varelager"`; `organisasjon.settFirmamodul.slug`-enum tar varelager; `services/varelager/moduleGate.ts` ny med `erVarelagerAktivert/krevVarelagerAktivert` (samme mønster som timer/maskin). vareKategori-router: full CRUD med ekte DELETE (FK Restrict mot vare blokkerer slett av kategori med tilknyttede varer). vare-router: list/opprett/oppdater/deaktiver (soft-delete bevarer Vareforbruk-historikk) + kategori-validering (samme firma). vareforbruk-router: list/hentMedId/opprett/oppdater/slett med tilgang-policy (`OrganizationSetting.vareforbrukTilgangDefault` håndhevet — `alle-ansatte`/`kun-prosjektmedlemmer`/`sertifiserte` (sistnevnte = fallback til kun-prosjektmedlemmer)), ECO-validering bruker `timerregistreringApen` som proxy (Beslutning), Vare-firma-validering, dagsseddel-validering, lås på `attestertSnapshot`, Activity-logging best-effort på {opprett,oppdater,slett}. Klient: `/dashbord/firma/varelager` med fane-toggle Varer/Kategorier (5 modaler — opprett/rediger/deaktiver vare + opprett/rediger/slett kategori), `/dashbord/[prosjektId]/vareforbruk` med periode/byggeplass-filter + opprett/rediger/slett-modaler. Sidebar: «Varelager» (Package-ikon) i firma-layout (gates på `aktiveFirmamoduler.includes("varelager")`); «Vareforbruk» i prosjekt-sidebar (gates på `ProjectModule(slug="varelager", status="aktiv")`). `firma/moduler/page.tsx` Varelager-toggle byttet fra «kommer snart» til full toggle. ~80 i18n-nøkler nb+en (firma.varelager.*, vareforbruk.*, nav.vareforbruk, handling.deaktiver). 13 filer endret, 3 nye routere, 1 ny moduleGate, 2 nye sider, 0 nye migrasjoner. `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (36.5s) grønt. Klar for test-deploy. **Stopp og rapporter etter test-verifisering på Byggeleder — Sesjon 3 (Fase 5: import) avventer eksplisitt grønt lys.**

**Steg 4b Sesjon 1 (Fase 1 + Fase 2) inkludert i samme prod-deploy 2026-05-06** (commit `b7127475` + engangsfix-server). Ny `packages/db-varelager`-pakke med 3 modeller (`VareKategori` + `Vare` + `Vareforbruk`) i postgres-schema `varelager`. Migrasjon `20260506000001_init` oppretter schema + 3 tabeller + 8 indekser + 2 ekte FKs (kategori_id RESTRICT, vare_id RESTRICT). Cross-package-FK håndteres som svake String-felt (samme mønster som db-timer/db-maskin). Workspace-deps i `apps/api` + `apps/web`; `prismaVarelager` lagt til i begge tRPC-context-er (Fastify + Next.js route). Beslutning 8 implementert: `VareKategori`-tabell (firma-definert) med valgfri `kontonummer` for ProAdm/Tripletax-eksport; `Vare.kategoriId` (FK) erstatter fritekst-`kategori`. Fase 2: Equipment-utvidelse med 4 nye felter (`erUtleieobjekt: Boolean default false`, `utleieprisPerDogn: Decimal(10,2)?`, `utleieprisPerTime: Decimal(10,2)?`, `utleieEnhet: "doegn"\|"time"?`) + migrasjon `20260506000002_equipment_utleieobjekt` (ALTER TABLE, bakoverkompatibel). `maskin.equipment.oppdater` utvidet med utleie-felter. Klient: ny «Utleie»-seksjon på maskin-detaljside (`/dashbord/maskin/[id]`) med toggle + 2 pris-felter + enhet-velger; read-only-visning viser Ja/Nei + pris/enhet når aktivert. ~8 nye i18n-nøkler under `maskin.utleie.*` (nb+en). Plan-oppdatering pushet som `5aca7c31`. `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (28.3s) grønt. Klar for test-deploy. **Stopp og rapporter etter test-verifisering — Sesjon 2 (Fase 3 + 4) avventer eksplisitt grønt lys.**

**Steg 4b-plan VEDTATT 2026-05-05** — komplett implementasjonsplan i [docs/claude/steg-4b-plan.md](docs/claude/steg-4b-plan.md). Vareforbruk-modul: ny `db-varelager`-pakke, 5 faser ~16t, 3 sesjoner. Generelt prinsipp: alt utleie-utstyr (per time/døgn) registreres i Maskinregisteret med `erUtleieobjekt=true`, ikke i Varekatalogen — gjelder Heatwork (6 enheter), steinsag, Hilti, aggregat osv. på tvers av Equipment-kategorier. 57 varer importeres fra A.Markussen SmartDok-katalog + 6 nye Equipment-rader for Heatwork-utleie. Komplett vareliste i § 13 av plan. Forutsetning Steg 1e ✅ deployet prod 2026-05-05. **Beslutning 8 lagt til 2026-05-06** (`5aca7c31`): `VareKategori`-tabell + `kontonummer`-felt forbereder regnskapseksport.

**admin/prosjekter respekterer FirmaVelger DEPLOYET TIL PROD 2026-05-05** (`0245b265` merge — fix `d9570c7b` + firma-kolonne `6414b9d3`). HTTP/2 200 verifisert mot sitedoc.no. Lukker to issues: (1) `/dashbord/admin/prosjekter` viste alle prosjekter på tvers av firmaer selv når sitedoc_admin hadde valgt et firma; (2) firma-kolonnen viste første partner-rad i stedet for primary firma. Server: `admin.hentAlleProsjekter` får valgfri `organizationId`-input (filtrerer på `primaryOrganizationId`) + `primaryOrganization` i include-blokken. Klient: `useFirma()` sender `valgtFirma?.id`; firma-kolonnen viser `p.primaryOrganization?.name`; header-tittel + empty-state-tekst dynamiske basert på valgt firma. Server: `admin.hentAlleProsjekter` får valgfri `organizationId`-input som filtrerer på `primaryOrganizationId` (samme mønster som `prosjekt.hentAlle` fra Blokk A 2026-05-04). Klient: `useFirma()` brukes til å sende `valgtFirma?.id`; header-tittel + empty-state-tekst dynamiske basert på valgt firma («Alle prosjekter» → firmanavn). 2 filer endret (~7 linjer), ingen migrasjon, ingen i18n. `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (32.7s) grønt. Klar for test-deploy.

**Steg 1e (OrganizationModule erstatter har_*_modul-flagg) DEPLOYET TIL PROD 2026-05-05** (`de044be4` merge — Fase A `9fda0f81` + Fase B `978c1bf4` + Fase C `5f72dc23`). HTTP/2 200 verifisert mot sitedoc.no. Lukker Steg 1e fullt ut + forutsetningen for Steg 4b (Vareforbruk). Generisk `OrganizationModule(organizationId, moduleSlug, status, audit-felter, config)`-tabell erstatter `Organization.har_timer_modul` + `har_maskin_modul`. Skalerbar til kompetanse/fremdrift/varelager uten schema-endring per ny modul. 2 migrasjoner applied til prod-DB. Prod-bakfyll: 2 rader for A.Markussen AS (timer + maskin) — HRP AS og Kenneths testmiljø hadde aldri `har_*_modul=true`, så ingen rader bakfylt for dem (antagelsen om 6 rader fra Fase A-rapporten var feil — 2 er korrekt for prod-state). Klient-API: `Firma.aktiveFirmamoduler: string[]` erstatter boolean-flaggene. 47 callsites migrert. A.4-overstyring dokumentert i `fase-0-beslutninger.md` (peker til Steg 1e med rasjonale: firma uten prosjekter må kunne onboarde lønnsarter).

**Steg 1e Fase C (drop har_*_modul-kolonner) IMPLEMENTERT på develop 2026-05-05.** Lukker Steg 1e fullt ut. OrganizationModule-tabellen er eneste sannhetskilde for firma-master-aktivering. Migrasjon `20260505010000_drop_organization_har_modul_flags` dropper `har_timer_modul` + `har_maskin_modul`-kolonnene. Schema-rens i `packages/db/prisma/schema.prisma`. Dual-write fjernet fra `organisasjon.settFirmamodul` (slipper `flagFelt`-variabel + `tx.organization.update`-kall) og fra `timer/onboarding.aktiverNivaa1` + `aktiverTomKatalog` (slipper `data: { harTimerModul: true }`). `services/{timer,maskin}/moduleGate.ts`-kommentarer renset for `Organization.har_*_modul`-referanser. Klient og mobil uberørt — Fase B migrerte alle lese-callsites og mobil hadde 0 callsites til å begynne med. Forutsetning for Steg 4b (Vareforbruk) lukkes når Fase C deployes til prod. 5 filer endret + 1 ny migrasjon. `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (32.7s) grønt. Klar for test-deploy. **Stopp og rapporter etter test-verifisering — prod-deploy avventer eksplisitt grønt lys.**

**Steg 1e Fase B (callsite-migrering til OrganizationModule) DEPLOYET TIL TEST 2026-05-05** (commit `978c1bf4`).

**Steg 1e Fase A (OrganizationModule-tabell) DEPLOYET TIL TEST 2026-05-05** (commit `9fda0f81`). Bygger på Fase A. Migrerer alle 47 callsites fra `harTimerModul`/`harMaskinModul`-flagg til `aktiveFirmamoduler: string[]`. Server: ny `hentAktiveFirmamoduler`-helper i `apps/api/src/services/firmamodul.ts` brukes av `organisasjon.hentMin/hentMedId/hentTilgjengelige`, `admin.hentAlleOrganisasjoner`, `prosjekt.opprett/opprettTestprosjekt`. `services/timer/moduleGate.ts` + `services/maskin/moduleGate.ts` + `timer/onboarding.status/aktiverNivaa2` leser nå fra `erFirmamodulAktivert`. Klient: `Firma`-typen i `firma-kontekst.tsx` har `aktiveFirmamoduler: string[]` i stedet for `har_*_modul: boolean`. Alle 5 klientfiler (`firma/layout.tsx`, `firma/moduler/page.tsx`, `FirmaVelger.tsx`, `HovedSidebar.tsx`, `admin/firmaer/page.tsx`) bruker nå `aktiveFirmamoduler.includes("timer")`/`includes("maskin")`. Dual-write fra Fase A beholdt — `settFirmamodul` + `timer/onboarding.aktiverNivaa1`/`aktiverTomKatalog` skriver fortsatt til både flagg og OrganizationModule. 9 filer endret, 0 nye migrasjoner, 0 ny i18n. `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (32.6s) grønt. Klar for test-deploy. **Stopp og rapporter etter test-verifisering — Fase C avventer eksplisitt grønt lys.**

**Steg 1e Fase A (OrganizationModule-tabell) DEPLOYET TIL TEST 2026-05-05** (commit `9fda0f81`). Sjette steg i prioritert byggerekkefølge fra [docs/claude/domene-arbeidsflyt.md](docs/claude/domene-arbeidsflyt.md). Erstatter `Organization.har_timer_modul`/`har_maskin_modul`-kolonnene med generisk `OrganizationModule`-tabell. Forutsetning for Steg 4b (Vareforbruk) og skalerbar til kompetanse/fremdrift/varelager uten schema-endring per ny modul. Tre-faset utrulling: **Fase A** (denne, bakoverkompatibel) — tabell opprettet + bakfylt, callsites uendret, dual-write fra `settFirmamodul` + `timer/onboarding.aktiverNivaa1` + `aktiverTomKatalog` til både flagg og ny tabell. **Fase B** — migrér 47 callsites (23 server, 20 klient, 2 schema, 0 mobil) til `aktiveFirmamoduler: string[]`. **Fase C** — drop `har_*_modul`-kolonner. Migrasjon `20260505000001_add_organization_module_fase_a`: CREATE TABLE med audit-felter (`aktivert_ved`, `aktivert_av_user_id`, `deaktivert_ved`, `deaktivert_av_user_id` — String? uten `@relation` per A.3-mønster) + bakfyll fra eksisterende flagg. Schema utvidet (Organization → `organizationModules OrganizationModule[]`). Service: 3 nye helpers i `apps/api/src/services/firmamodul.ts` (`erFirmamodulAktivert`, `skrivOrganizationModuleAktiver`, `skrivOrganizationModuleDeaktiver`). Dokumentasjon: A.4 i `fase-0-beslutninger.md` har peker til Steg 1e med overstyring-rasjonale (firma uten prosjekter trenger eksplisitt aktivering — kan ikke avledes fra ProjectModule alene). Bakfyll-forventning: test-DB 2 rader (Byggeleder), prod-DB 6 rader (A.Markussen + HRP AS + Kenneths testmiljø). 4 filer endret + 1 ny migrasjon. `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (32.4s) grønt. Klar for test-deploy. **Stopp og rapporter etter test-verifisering — Fase B avventer eksplisitt grønt lys.**

**FirmaVelger-kontekst på `kom-i-gang` DEPLOYET TIL PROD 2026-05-05** (`66c2e982` merge, `9a750681` impl). HTTP/2 200 verifisert mot sitedoc.no. Test-verifisert begge redirect-scenarier som Tore SiteDocAdmin før prod-deploy. Lukker regresjon: `prosjekt.opprettTestprosjekt` ignorerte FirmaVelger og brukte alltid innlogget brukers org. Sitedoc_admin med valgt A.Markussen som klikket «Start gratis prøveperiode» fikk prosjektet på Kenneths testmiljø, ikke A.Markussen. Strategi: redirect sitedoc_admin bort fra kom-i-gang (siden er for nye brukere, ikke superadmin) + fix mutation som forsvar i dybden. Server: `opprettTestprosjekt` tar nå valgfri `organizationId`, autoriserer som `prosjekt.opprett` (sitedoc_admin → enhver org). Klient: useEffect i `kom-i-gang/page.tsx` redirecter sitedoc_admin med valgt firma til `/nytt-prosjekt` (info-banner fra Steg 2d), uten valgt firma til `/admin/firmaer` («Opprett firma»-knapp finnes allerede). Vanlig bruker uberørt. 2 filer endret.

**Faggruppe-side-konsolidering DEPLOYET TIL PROD 2026-05-05** (`d62ffa6c` merge, `5942f396` impl). HTTP/2 200 verifisert mot sitedoc.no. Test-verifisert full CRUD som Per Prosjektadmin før prod-deploy. Lukker Tiltak 2 i `navigasjon-arkitektur-analyse-2026-05-03.md` og er forutsetning for selvstendig A.Markussen-onboarding. De to nesten-identiske sidene erstattet med én konsolidert side med full CRUD: `/dashbord/[prosjektId]/faggrupper`. Funn FØR koding: legacy-siden `/dashbord/prosjekter/[id]/faggrupper` hadde kun opprett-Modal i UI (ikke «full CRUD» som statusrapporten påsto) — server-routeren hadde derimot full CRUD fra før. Endringer: ny side med opprett/rediger/slett-modaler (firmanavn + org.nr — ansvarlig/farge/partner i egen runde per Kenneths beslutning); legacy-side hard-slettet; «Faggrupper»-fane fjernet fra `prosjekter/[id]/layout.tsx`; oversiktskort i `prosjekter/[id]/page.tsx` peker til ny rute; 1 ny i18n-nøkkel `faggrupper.bekreftSlett` (nb+en); slett bruker server-feilmelding hvis sjekklister/oppgaver er tilknyttet (per CLAUDE.md UI-regel: ekte Modal, ikke `confirm()`). 4 filer endret, 1 fil + 1 mappe slettet.

**Header-fix per rolle DEPLOYET TIL PROD 2026-05-04** (`e3717a8c` merge, `f78113c5` impl). HTTP/2 200 verifisert mot sitedoc.no. Toppbar-rekkefølge per Kenneths rolle-spec: sitedoc_admin ser FirmaVelger | Prosjekt | Byggeplass | Admin-knapp; company_admin ser firma-fast-link | Prosjekt | Byggeplass; vanlig User.role="user" ser kun Prosjekt | Byggeplass (firma-element skjult). FirmaVelger redirecter til `/dashbord/firma` etter valg slik at sitedoc_admin lander direkte i firma-admin-flyten. Duplisert sitedoc_admin-sjekk i Toppbar fjernet (`erSitedocAdmin` fra useFirma er nå eneste kilde). Endret 3 filer: `firma-kontekst.tsx` (utvidet med `erCompanyAdmin: boolean` utledet fra eksisterende `minBruker.role`), `FirmaVelger.tsx` (router.push etter velgFirma), `Toppbar.tsx` (JSX-omarrangering + rolle-skille). Ingen schema-endring, ingen RBAC-endring, ingen auth-endring — kun UI-rearrangering på eksisterende kontekst-data. Bakgrunn: notert i `427c2659` 2026-05-03 (header-koordinering observert), korrigert hierarki i `b9a826c6` (Prosjekt er firmamodul, ikke toppnivå), fakta-grunnlag i `admin-navigasjon-analyse-2026-05-03.md`.

**P1 Fase 2 (auto-reset av prosjekt ved firma-bytte) DEPLOYET TIL PROD 2026-05-05** (`5674df71` merge, `26cc0326` impl). Lukker P1 fullt ut sammen med Blokk A. Ny `useEffect` i `apps/web/src/kontekst/prosjekt-kontekst.tsx` lytter på `valgtFirma`, `valgtProsjekt` og `lasterValgt`. Hvis et firma er valgt, prosjekt-data er hentet, og `valgtProsjekt.primaryOrganizationId !== valgtFirma.id`, nullstilles localStorage + lokal state + redirect til `/dashbord`. Standalone-prosjekt (primaryOrganizationId=null) regnes som mismatch — konsistent med Blokk A som filtrerer dem ut av ProsjektVelger. Bytte til null-firma (sitedoc_admin fjerner firma-valg) trigger ikke reset (`if (!valgtFirma) return`). Type-utvidelse: `Prosjekt`-interface i klient-konteksten får `primaryOrganizationId: string | null` (server returnerer feltet uendret — ingen server-endring). 1 fil endret.

**Blokk C (P2 — admin/firmaer erKunde-filter + Timer-kolonne) DEPLOYET TIL PROD 2026-05-04** (`e2729849` merge, `261a0c8e` impl). Tredje del av admin-navigasjon-analyse-2026-05-03.md (tiltak #3 i prioritert rekkefølge). Lukker P2: skall-firmaer (Byggherre, Tømrer Hansen, Elektrikker Hansen, Hovedentreprenør) filtreres ut av admin/firmaer-listen via server-side `where: { erKunde: true }` på `admin.hentAlleOrganisasjoner`. Ny Timer-kolonne mellom Integrasjoner og Maskin med Clock-ikon + Ja/Nei-badge (samme stil som Maskin-kolonnen som bruker Truck). Slide-over-detaljpanelet får tilsvarende Timer-modul-status-seksjon FØR Maskin-modul-seksjonen for konsistens. Endret: 2 filer — `apps/api/src/routes/admin.ts` (where-klausul, 2 linjer) + `apps/web/src/app/dashbord/admin/firmaer/page.tsx` (type-utvidelse + tabell-header + FirmaRad-celle + slide-over-seksjon). Type `OrganisasjonRad` utvidet med `harTimerModul: boolean`. Ingen ny i18n (eksisterende kolonne-overskrifter er hardkodet i samme stil). `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` grønt (34.8s). Klar for test-deploy.

**Blokk A (P1 Fase 1 — prosjektliste filtreres på valgt firma) DEPLOYET TIL PROD 2026-05-04** (`12717426` merge, `51d5e3ee` impl). Andre del av admin-navigasjon-analyse-2026-05-03.md (tiltak #2). HTTP/2 200 verifisert mot sitedoc.no. Sitedoc_admin med valgt firma i FirmaVelger ser nå kun prosjekter med matchende `primaryOrganizationId`. Server: `prosjekt.hentMine`+`hentAlle` tar valgfri `organizationId`. Klient: 4 callsites migrert (prosjekt-kontekst, dashbord, prosjekter-listing, timer/mine). Tom-state for sitedoc_admin med valgt firma og 0 prosjekter: «Ingen prosjekter for [firma]. Opprett et prosjekt for å komme i gang.» (1 ny i18n-nøkkel `dashbord.ingenProsjekterForFirmaBeskrivelse` nb+en). Bakfyll test-DB: 2 prosjekter satt til Byggeleder.

**Blokk B (klikkbare prosjektrader på `/dashbord/firma/prosjekter`) DEPLOYET TIL PROD 2026-05-04** (`dbf78bca` merge, `59338895` impl). Tiltak #7 i prioritert rekkefølge. Hele tabellraden navigerer til `/dashbord/[id]` ved klikk; `<Link>` på prosjektnavnet beholdt for cmd/ctrl+click + tastatur-fokus. `onClick` hopper over hvis target er innenfor `<a>`-tag. 1 fil endret (7 linjer). HTTP/2 200 verifisert mot sitedoc.no.

**Merknad:** Header-fix løser KUN rekkefølge + skjul firma-link for vanlig bruker + redirect til firma-admin. De to delfixene fra `427c2659`-notatet er nå begge løst: (1) filtrering av prosjektliste på `primaryOrganizationId` via Blokk A (`12717426`), (2) auto-reset av aktivt prosjekt ved firma-bytte via P1 Fase 2 (`5674df71`).

**Steg 4a (ECO-flytt på attestering) DEPLOYET TIL PROD 2026-05-03** (`da6b34a5` merge, `f98fa7a5` impl). HTTP/2 200 verifisert mot sitedoc.no. Test-deploy krevde manuell trigger (auto-deploy-hooken trigget ikke — andre gang etter Steg 1a, bør undersøkes separat). Test-verifisert som Per Prosjektadmin: leder-detaljsiden åpner sedlen, ECO-velger inline på timer-rader, action-bar med Returner/Attester fungerer. Første del av Steg 4 (dagsseddel-utvidelser) fra prioritert byggerekkefølge. Leder kan nå endre kostnadsbærer (ECO/Underprosjekt) på timer-rader i en innsendt sedel før attestering. Server: ny `timer.dagsseddel.flyttTimerRadEco({ timerRadId, externalCostObjectId | null })`-mutation gates med `krevProsjektLeder`, kun status="sent" tillates, ECO-validering (samme firma+prosjekt, status=aktiv, timerregistreringApen=true). Activity-log (best-effort) skriver `target_type=sheet_timer`, `action=timer.eco-flyttet`, payload `{sheetId, fraEcoId, tilEcoId}`. Ny `hentForAttestering({id})`-query autoriserer på `krevProsjektLeder` (skiller seg fra `hentMedId` som krever eierskap eller sitedoc/company-admin). Klient: ny side `/dashbord/[prosjektId]/timer/attestering/[id]/page.tsx` med leder-detaljvy — header/aktivitet/timer/tillegg/maskin read-only, kun ECO-feltet på timer-rader er redigerbart via inline `<select>` med fjern-X. Action-bar med Returner/Attester. Attestering-tabellen (`page.tsx`) navigerer chevron-knappen til ny [id]-rute (tidligere pekte til ansattens detaljside som ga FORBIDDEN for Per Prosjektadmin). 5 nye i18n-nøkler under `timer.attestering.flyttEco.*` + `timer.attestering.tilbake` + `timer.attestering.detalj.ikkeRedigerbar` (nb+en). `tsc` + `pnpm build --filter @sitedoc/web` grønt (34.5s). Ingen DB-migrasjon. Klar for test-deploy.

**Steg 3 (maskin-import med firma-kontekst) DEPLOYET TIL PROD 2026-05-03** (`33a2b9b4` merge, `e7ddc397` impl). **A.Markussen-maskinimport gjennomført samme dag:** 124 Equipment-rader importert via UI (36 kjøretøy + 50 anleggsmaskin + 38 småutstyr; 36 med regnr, 11 leide). Vegvesen-kø: 36 ventende prioritet=200 ved import-tidspunkt (worker plukker via 60s-polling, ~36 min spredt utfylling). 3a: Server-side erKunde-validering i `maskin.import.importerForhandsvisning` + `importerBekreft` via ny `krevErKundeFirma`-helper i `tilgangskontroll.ts` (FORBIDDEN hvis ikke kunde-firma). Klient-tom-state «Velg et kunde-firma fra toppmenyen» når sitedoc_admin ikke har valgt firma. 3b: Drag-and-drop på opplast-sone med `onDragOver`/`onDragLeave`/`onDrop`-handlere + visuell feedback (border + bg-farge endres ved drag-over). Klikk-funksjonalitet beholdt via label/input-mønster. 1 ny i18n-nøkkel `firma.maskin.import.velgFirma` (nb+en). `tsc` + `pnpm build` grønt. Klar for test-deploy.

**Steg 2 (firma-admin-sider) DEPLOYET TIL PROD 2026-05-03** (`a1463561` merge — samlet 2b+2c+2d). 2a var allerede komplett. /dashbord/firma/moduler (modul-toggles), /dashbord/firma/innstillinger (utvidet med tidssone + 3 tilgang-defaulter), /dashbord/nytt-prosjekt (firma-kontekst + info-banner for sitedoc_admin) live på prod. HTTP/2 200 verifisert.

**Steg 2d (prosjekt fra firma-kontekst) IMPLEMENTERT på develop 2026-05-03.** Server: `createProjectSchema` utvidet med valgfri `organizationId`. `prosjekt.opprett` autoriserer mot bruker-rolle (sitedoc_admin → enhver org; vanlig bruker → kun egen org), bruker valgtOrgId for `Project.primaryOrganizationId` + ProjectOrganization-rad + ProjectModule-sync. `opprettTestprosjekt` setter også `primaryOrganizationId` (manglet før). Klient: `dashbord/nytt-prosjekt/page.tsx` sender `valgtFirma?.id`. Info-banner vises for sitedoc_admin med valgt kunde-firma («Prosjektet opprettes for [firma]»). Slettet orphan-duplikat `dashbord/prosjekter/nytt/`. 1 ny i18n-nøkkel `nyttProsjekt.opprettesFor` (nb+en). Klar for test-deploy. **Steg 2 komplett etter dette — Steg 2a (firma-info) var allerede komplett, 2b/2c/2d nå deployet.**

**Steg 2c (OrganizationSetting-UI) IMPLEMENTERT på develop 2026-05-03.** Utvidelse av `/dashbord/firma/innstillinger`-siden med 4 nye seksjoner: Tidssone (dropdown med 7 europeiske + UTC), Timer-tilgang/Vareforbruk-tilgang/Maskinbruk-tilgang (3 generiske radio-seksjoner med samme verdi-sett: alle-ansatte/kun-prosjektmedlemmer/sertifiserte). Bruker eksisterende `organisasjon.hentSetting`/`oppdaterSetting`-mutations. Generisk `TilgangPolicySeksjon`-komponent unngår dobling av kode for de tre tilgang-feltene. Eksisterende `KompetansePolicySeksjon` beholdt som siste seksjon. ~14 nye i18n-nøkler under `firma.innstillinger.*` (nb+en). `tsc` + `pnpm build` grønt. Klar for test-deploy.

**Steg 2b (firmamodul-styring UI) DEPLOYET TIL TEST 2026-05-03** (`25cd7675`). Verifisert som innlogget Kari Firmaadmin: aktivere/deaktivere Timer/Maskin fungerer end-to-end, ProjectModule-rader synkroniserer korrekt, sidebar oppdateres. Klar for prod (avventer 2c+2d før samlet prod-deploy). Ny side `/dashbord/firma/moduler` med skalerbar modul-konfig (timer + maskin tilgjengelig nå; kompetanse, fremdrift, varelager merket «kommer snart»). Kort-basert UI med toggle-knapp per modul: aktivering = direkte mutation (idempotent), deaktivering = bekreftelses-modal med advarsel. Bruker `organisasjon.settFirmamodul` fra Steg 1c. Ny menyelement «Moduler» (Boxes-ikon) i firma-layout mellom Kompetanse og Timer. SQL-instruks i `admin/firmaer/page.tsx` modal erstattet med peker til ny side. ~22 nye i18n-nøkler under `firma.moduler.*` (nb+en). `tsc` + `pnpm build --filter @sitedoc/web` grønt. Klar for test-deploy. 2c (OrganizationSetting-UI) + 2d (prosjekt fra firma-kontekst) avventer eksplisitt grønt lys etter test-verifisering.

**Steg 1d (ProjectModule final cleanup, forkortet) DEPLOYET TIL PROD 2026-05-03** (`73dcbd1a` merge, `ec0ce969` impl). Migrasjon `20260503020000_drop_project_module_active` — DROP COLUMN `active` fra `project_modules`. Verifisert via grep at 0 kode-callsites bruker feltet før drop. Schema-rens i `schema.prisma`. Unique `(project_id, module_slug)` beholdes uendret — cross-org-aktivering (`(projectId, organizationId, moduleSlug)`-unique) flyttet til Steg 1e som krever distinksjon mellom firmamoduler (timer/maskin) og prosjektmoduler (oversettelse/PSI/kontrollplan etc.) for å være meningsfull. `pnpm typecheck` + `pnpm build --filter @sitedoc/web` grønt. Klar for test-deploy.

**Steg 1c (OrganizationModule-overgang) DEPLOYET TIL PROD 2026-05-03** (`87fb7292` merge, `d581e399` Fase A+B + `6921ffea` mini-Fase C). Tredje steg i prioritert byggerekkefølge fra [docs/claude/domene-arbeidsflyt.md](docs/claude/domene-arbeidsflyt.md). To-nivås modul-aktivering: `Organization.har_*_modul` = firma-master-bryter, `ProjectModule(slug, organizationId, status="aktiv")` = prosjekt-instans. Auto-sync-hooks holder dem konsistente.

**Fase A — datamodell + bakfyll:**
- Migrasjon `20260503010000_steg_1c_module_backfill` — INSERT ProjectModule(slug=timer/maskin, organizationId, status="aktiv") for prosjekter der primary_organization har flagget aktivert. Idempotent via ON CONFLICT. Test+prod: 0 rader nå (Byggeleder/A.Markussen har 0 prosjekter med primary-rolle) — ren no-op safety-net.
- `services/timer/moduleGate.ts` + `services/maskin/moduleGate.ts` — valgfri `projectId`-param. Uten: kun firma-master-bryter. Med: krever begge nivåer.

**Fase B — auto-sync-hooks + klient-migrering:**
- `prosjekt.opprett` + `prosjekt.opprettTestprosjekt`: henter brukerens organizationId + har_*_modul-flagg, oppretter ProjectModule-rader for aktive firmamoduler i samme `$transaction` som ProjectOrganization.
- Ny service-helper `apps/api/src/services/firmamodul.ts` med `syncProjektModulerPaaAktiver/Deaktiver(tx, orgId, slug)` — brukes fra organisasjon-router og timer/onboarding-router for konsistent sync.
- Ny `organisasjon.settFirmamodul({ organizationId, slug, aktiver })` — polymorf mutation. Gates med `verifiserFirmaAdmin`. UI-knapp ikke bygget — Steg 2b.
- `timer/onboarding.aktiverNivaa1` + `aktiverTomKatalog`: refaktorert til `$transaction` med syncProjektModulerPaaAktiver.
- `HovedSidebar`: timer-elementer (`timer` + `timer-attestering`) gates på `aktiveModuler` (ProjectModule.status="aktiv"), ikke firma-flagg. Maskin-bunnelement beholder `harMaskinModul` (global lenke).

**Mini-Fase C — kommentar-rens (lukker Steg 1c):** Drop av `har_*_modul`-kolonner krever full `OrganizationModule`-tabell (firma uten prosjekter trenger flagget for å onboarde lønnsarter — A.Markussen-flow). Den jobben utsatt til **Steg 1e**. Kommentarer i `schema.prisma` + `moduleGate.ts` oppdatert til å beskrive endelig to-nivås-modell, ikke «midlertidig flagg».

**Verifisering:** Test-deploy verifisert som innlogget Kari Firmaadmin (Byggeleder) — opprettet nytt prosjekt → 2 ProjectModule-rader auto-opprettet (timer+maskin, status=aktiv, organization_id=Byggeleder). Auto-deploy-hook triggeret ikke — manuell deploy.

**Eksplisitt utenfor Steg 1c:** **Steg 1d** = drop `active Boolean` på ProjectModule + endre unique til `(projectId, organizationId, moduleSlug)`. **Steg 1e** = `OrganizationModule`-tabell + drop `har_*_modul`-kolonner. Begge dokumentert i [docs/claude/domene-arbeidsflyt.md](docs/claude/domene-arbeidsflyt.md).

**Steg 1b Fase A+B+C (firma-kontekst Lag 1+2+3) DEPLOYET TIL PROD 2026-05-03** (`045a49b7` merge, `f0da8408`+`52040cd3`+`ce72811c` impl). Hele Steg 1b ferdig på prod. Sitedoc_admin kan nå velge et hvilket som helst kunde-firma i FirmaVelger og administrere det fullt ut på alle firma-admin-sider (`/dashbord/firma/*`) + maskin/import. Sub-elementet «Firmainnstillinger» (under prosjekt-sidebar «Prosjekteier») er renamet til «Eier-firma» (nb) / «Owner company» (en). Tre-fasers strategi (A: server-helper + valgfri input → B: klient-migrering → C: orgId påkrevd + rename) — detaljer i [docs/claude/STATUS-AKTUELT.md](docs/claude/STATUS-AKTUELT.md).

**Steg 1b Fase B (firma-kontekst — klient-migrering) IMPLEMENTERT på develop 2026-05-03:** ~10 firma-admin-sider migrert til å sende `useFirma().valgtFirma.id` som `organizationId` til alle queries og mutations. Sider berørt: `firma/page` (oversikt), `firma/avdelinger` (CRUD + 2 dialoger), `firma/brukere` (endreRolle), `firma/innstillinger` (firma-info + KompetansePolicySeksjon), `firma/kompetanse` (matrise + kompetansetyper-CRUD + import-dialog; AnsattKompetanse-CRUD uendret per Fase A-design), `firma/prosjekter`, `firma/timer/{layout,onboarding,lonnsarter,aktiviteter,tillegg}`, `maskin/import`. Mønster: `const { valgtFirma } = useFirma(); const orgId = valgtFirma?.id; useQuery({ organizationId: orgId }, { enabled: !!orgId })`. `firma/page` og `firma/innstillinger` byttet fra `organisasjon.hentMin` til `organisasjon.hentMedId({ id: orgId })` — disse hentet brukerens egen org via session, må nå bruke valgt firma-id. Effekt: sitedoc_admin kan nå velge et firma i FirmaVelger og se det firmaets data på alle undersider. `pnpm build` + `tsc` grønt. Klar for test-deploy. Fase C (innstramning + Prosjekteier-rename) avventer eksplisitt grønt lys etter test-verifisering.

**Steg 1b Fase A (firma-kontekst — server-helper + valgfri input) IMPLEMENTERT på develop 2026-05-03:** Andre steg i prioritert byggerekkefølge fra [docs/claude/domene-arbeidsflyt.md](docs/claude/domene-arbeidsflyt.md). Ny `autoriserAdminForFirma(userId, organizationId)`-helper i `apps/api/src/trpc/tilgangskontroll.ts` (sitedoc_admin → tilgang til ALLE firmaer; company_admin med matchende organizationId → tilgang; ellers FORBIDDEN). Lokale `verifiserFirmaAdmin`-helpers i 9 router-filer (organisasjon, avdeling, kompetanse, kompetansetype, timer/{onboarding,lonnsart,aktivitet,tillegg}, maskin/import) refaktorert til å ta valgfri `inputOrgId` — delegerer til ny helper når input gitt, ellers fallback til `bruker.organizationId` (ingen klient-endring kreves i denne fasen). ~46 endepunkter har fått `organizationId: z.string().uuid().optional()` som input-felt. `pnpm typecheck` + `pnpm build --filter @sitedoc/web` grønt. Klar for test-deploy. Fase B (klient-migrering) + Fase C (innstramning + «Prosjekteier»-rename) avventer eksplisitt grønt lys etter test-verifisering.

**Steg 1a (Organization.erKunde) DEPLOYET TIL PROD 2026-05-03** (`c91d953c` merge, `b69830e7` impl). Første steg i prioritert byggerekkefølge fra [docs/claude/domene-arbeidsflyt.md](docs/claude/domene-arbeidsflyt.md). Lukker Strategi C i «Organization vs OrganizationPartner — fundamentalt skille». Ny `Organization.erKunde Boolean default false` + migrasjon `20260503000001_add_organization_er_kunde` med backfill. Heuristikk: `er_kunde=true` hvis `har_maskin_modul` OR `har_timer_modul` OR finnes `Project.primary_organization_id` OR finnes `Avdeling`. `organization_settings` og `users` droppet (auto-upsert + testdata-misbruk). Backfill-resultat verifisert mot psql: test-DB Byggeleder=true + 4 skall=false (Byggherre/Tømrer Hansen/Elektrikker Hansen/Hovedentreprenør); prod-DB A.Markussen/HRP AS/Kenneths testmiljø=true + 0 skall. `organisasjon.hentTilgjengelige` filtrerer på `erKunde:true` for sitedoc_admin. Test-verifisert som innlogget Tore SiteDocAdmin via Claude (FirmaVelger viser kun Byggeleder).

**Status 2026-05-02:** Fase 0 § E KOMPLETT i prod. Fase 0.5 KOMPLETT i prod. **A.Markussen Timer-modul aktivert i prod 2026-05-02** (UPDATE organizations SET har_timer_modul=true; har_maskin_modul var allerede true). **Onboarding UX-fix Runde 1 (a)+(b)+(c) DEPLOYET TIL PROD 2026-05-02** (`098f7586`): faggrupper-lenke + Pencil-ikon + progress-banner. **SmartDok maskin-import dag 3 fix på develop:** `importerBekreft` filtrerte tidligere bare DB-eksisterende internnumre, men SmartDok-fila har internnummer 7084 på rad 17+99 (fil-internt duplikat). Andre forekomst brakk `(organizationId, internNummer)` unique constraint og rullet tilbake hele transaksjonen. Fix: filtrer både DB-duplikater og fil-interne duplikater FØR `$transaction`. Forhåndsvisning splitter nå `duplikater` i `duplikaterDB` + `duplikaterFilInterne` for diagnostikk. Hoppet-over-grunn skiller mellom «finnes allerede i firmaet» og «duplisert i fila». **SmartDok maskin-import dag 1+2 på develop:** Klient-UI (`/dashbord/maskin/import`) med 4-stegs flyt (opplast .xlsx → forhåndsvis med kategori-fordeling/ansvarlig-match/duplikat-flag → bekreft → resultat). 60 nye i18n-nøkler under `firma.maskin.import.*` + `maskin.importerFraSmartDok` (nb+en). «Importer fra SmartDok»-knapp lagt til i hovedsidens header ved siden av «Legg til». **SmartDok maskin-import dag 1 på develop:** server-side parser (`apps/api/src/utils/maskinImport.ts`) verifisert mot A.Markussen 126-rad Excel — 125 importerbare, 1 testrad filtrert, 36 med gyldig regnr, 11 leide (9XXX), 10 0XXX→null internnummer, 15 unike ansvarlige. Kategori-mapping: regnr→kjøretøy, 7000-7599→kjøretøy, 7600-7699→anleggsmaskin, 7700-7999→småutstyr, 9XXX→anleggsmaskin (eierskap=leid), 0XXX→utled fra 4-sifret prefiks i navn. To nye tRPC-mutations under `maskin.import` (importerForhandsvisning + importerBekreft) gated med firma-admin + krevMaskinAktivert. Atomisk Prisma-transaction oppretter Equipment + EquipmentAnsvarlig (Maskinansvarlig 2) + VegvesenKo prio 200 (lavere enn 100=auto, naturlig spredning via 60s-polling). Umatcha ansvarlig → null + advarsel (ikke blokker). UI bygges dag 2. **Timer-modul Fase 3 — Runde 1A/1B/1C + Runde 2 (mobil offline-sync C1-C8) + Runde 2.5/C9 (aktivitet per rad + sheet_machines + ECO.proAdmType) DEPLOYET TIL PROD 2026-05-02** (`de33aefc`). **Maskin terminologi-rename pensjonert→utgått DEPLOYET TIL PROD** (samme miljø, `03d8c63a`). **Runde 2.6 (mobil maskin-cache + EquipmentVelger) DEPLOYET TIL PROD 2026-05-02** (`03d8c63a`) — server-side klar; mobil får funksjonalitet ved neste EAS Build. **Runde 2.7 (Mine timer-rapport + DagstotalBanner + UkeTotalBanner + ukesoppsummering web) DEPLOYET TIL PROD 2026-05-02** (`05b3bddb`) — ingen server-endring, gjenbruker `timer.dagsseddel.list`; mobil får funksjonalitet ved neste EAS Build. **Timer-attestering rename DEPLOYET TIL PROD 2026-05-02** (`8aa792b2`) — full sweep av URL `/timer/godkjenning` → `/timer/attestering` (med redirect-stub fra gammel sti) + tRPC `kanGodkjenne`/`hentTilGodkjenning` → `kanAttestere`/`hentTilAttestering` (gamle beholdes som @deprecated alias 1 uke per CLAUDE.md API-regel) + sidebar/hooks/navigasjon-kontekst + mobil `sendTilGodkjenning` → `sendTilAttestering` + i18n: 16 nøkler renamet i nb+en (timer.godkjenning.* → timer.attestering.*) + ny `status.tilAttestering` lagt til i alle 14 språk. Følger CLAUDE.md regel «Attestering ≠ Godkjenning» (vedtatt 2026-04-26). EAS Build 19 (`21312857`) klar — alias-ruter sikrer at eldre mobil-builds fortsetter å fungere. Se [docs/claude/dagsseddel-design.md](docs/claude/dagsseddel-design.md) + [fase-0-beslutninger.md C.18](docs/claude/fase-0-beslutninger.md).

---

## Mai 2026 forts. — Timer arkitektur-redesign + OrganizationMember-bunken

Følgende PR-seksjoner ble flyttet hit fra `CLAUDE.md § Pågående arbeid` 2026-05-13 (slankings-PR). Alt under er deployet til prod og arkivert.

### Timer-modul arkitektur-redesign (PR 1A–2C) — DEPLOYET TIL PROD 2026-05-12

T.1–T.6-vedtakene fra 2026-05-11 (se [fase-0-beslutninger.md § T](fase-0-beslutninger.md)): `projectId` flyttet fra `DailySheet` til rad-nivå (`SheetTimer`/`SheetMachine`/`SheetTillegg`). Dagsseddelen eies av arbeider/firma, ikke prosjekt. Bunken levert i 5 PR-er for å overholde to-stegs migration-policy.

- **PR 1A** (`862c70c3`) — Schema-additive + backfill. Nye kolonner nullable, DailySheet.projectId beholdt, backfill-SQL i samme migrasjon. Deployet prod 2026-05-11.
- **PR 1B** (`bba971ba`) — NOT NULL på `sheet_timer.project_id` + `sheet_machines.project_id` + `sheet_tillegg.project_id`. Drop `daily_sheets.project_id`. Ny unique `(user_id, dato)` erstatter `(user_id, project_id, dato)`. Deployet prod 2026-05-12 00:06:53.
- **PR 2A** (`6431873c`) — API-refaktor av `dagsseddel.ts` (33 feil), `rapport.ts` (10 feil), `vareforbruk.ts` (2 feil). Nye input-felter på `tilfoyTimerRad`/`tilfoyTilleggRad`/`maskin.tilfoy` (`projectId` påkrevd, `byggeplassId`/`fraTid`/`tilTid` valgfri). Auth via første rad-fallback i `attester`/`returner`/`hentForAttestering`. Rapport-aggregering per rad i stedet for per sedel. 45 → 0 TS-feil. Deployet prod 2026-05-12.
- **PR 2B** (`8478d4a7`) — Web-klient. 3 modaler i `apps/web/src/app/dashbord/[prosjektId]/timer/[id]/page.tsx` (TimerRad/Tillegg/Maskin) sender nå `projectId: params.prosjektId` via `useParams`. 46 → 0 TS-feil i `apps/web` (eksklusiv pre-eksisterende vitest). Deployet prod 2026-05-12.
- **PR 2C min** (`0700b8ed`) — Mobil. Defensiv `?? ""` på `serverSedel.projectId` i `timerSync.ts` mot at server nå kan returnere `null` (for sedler uten rader). Mobil typecheck uendret fra 12 pre-eksisterende baseline. Full Drizzle-omskriving (per-rad projectId i SQLite + sync-refaktor) utsatt — dokumentert som åpen oppgave i [STATUS-AKTUELT.md § Implementasjonsstatus](STATUS-AKTUELT.md). Deployet prod 2026-05-12.

**Verifisering prod 2026-05-12:**
- HTTP/2 200 mot `sitedoc.no`, `api.sitedoc.no/health` returnerer OK
- `daily_sheets.project_id` DROPPED (0 rows i information_schema)
- `sheet_timer/sheet_machines/sheet_tillegg.project_id` NOT NULL
- Ny unique-index `daily_sheets_user_id_dato_key` finnes
- Migrasjon `20260511220000_timer_schema_redesign_1b` applied 00:06:53
- PM2 `sitedoc-web` (id 47) + `sitedoc-api` (id 39) restartet, uptime 0-2s, restart-teller +1 = 46

**Påvirkning på fremtidig arbeid:** `krevProsjektLeder`-gate er fortsatt per-prosjekt — i `attester`/`returner`/`hentForAttestering` brukes første rad-fallback (`sheet.timer[0]?.projectId`). Full per-rad-attestering (T.3 Alternativ A — leder attesterer kun sine rader, sedel = container uten egen status) er ikke implementert i denne bunken og blir egen PR senere.

### T.7 dagsseddel UI-redesign + #8 sjekklistemaler-kolonner — DEPLOYET TIL PROD 2026-05-12

Samme dag som PR 1A–2C ble også T.7-leveranseplanen startet og første tre etapper deployet. T.7 er definert i [fase-0-beslutninger.md § T.7](fase-0-beslutninger.md) med URL-struktur Alternativ C (tre kontekster: arbeider / prosjektleder / firma-admin) og fire PR-er (T7-0 → T7-3).

- **#8 sjekklistemaler-kolonner** (`3eb7398f` impl + merge `542461e2`) — Fagområde + Antall punkter-kolonner lagt til i `MalListe.tsx`. 4 nye i18n-nøkler i 15 språk. Kundeønske fra A.Markussen.
- **PR T7-0 mobil-refaktor** (`44c03d98` impl + merge `b2a8e8ee`) — `apps/mobile/app/timer/[id].tsx` redusert fra 2084 → 367 linjer. Splittet til `TimerSeksjon`/`TilleggSeksjon`/`MaskinSeksjon` + `types/timer-detalj.ts` + `utils/dato.ts` + `lib/enheter.ts`. Ingen funksjonalitets­endring; mobil typecheck 12 = 12 baseline. Forberedelse for T7-3.
- **PR T7-1a arbeidstid + summering** (`1b668cd9` impl + merge `b2a8e8ee`) — Re-label «Arbeidstid i dag» (lese-vy + rediger-modal) på `apps/web/src/app/dashbord/[prosjektId]/timer/[id]/page.tsx`. Ny utledet `arbeidstidTimer = (endAt − startAt) − pauseMin/60`. Løpende summerings-banner over Send-knappen med farge­koding (grønn/gul/grå) basert på registrerte timer vs. arbeidstid. 3 nye i18n-nøkler i 15 språk.
- **PR T7-1b prosjekt-gruppert dagsseddel + geo-forslag** (`fcff04c1` impl + merge `908a57c1`) — Ny URL-struktur `/dashbord/timer/[id]` og `/dashbord/timer/ny` (firma-kontekst, ikke prosjekt-bundet). Multi-prosjekt-støtte på rad-nivå. Geo-forslag via `navigator.geolocation` + Haversine-avstand mot `Project.lat/lng` med 500m radius. Nye komponenter `ProsjektRadVelger` + `StatusBadge` (flyttet til `@/components/timer/`). Redirect-stubs fra eldre `/dashbord/[prosjektId]/timer/[id]` og `/timer/ny`. 5 nye i18n-nøkler i 15 språk. Bugfix `8ab2e826` på «Åpne»-lenker som ga `/dashbord/undefined/timer/...` (mine-timer + prosjekt-timer-liste).
- **PR T7-2a firma-admin attestering-liste** (`b043d944` impl + merge `f3dbf08b`) — Ny side `/dashbord/firma/timer/attestering` viser sedler på tvers av prosjekter i firmaet. 2 nye server-queries: `timer.dagsseddel.hentTilAttesteringFirma({organizationId})` + `kanAttestereFirma({organizationId})` gates med `autoriserAdminForFirma`. Ny fane «Attestering» i `firma/timer/layout.tsx`. Attestering/retur fortsatt per-sedel (uendret mutation). Fix `55b6c398`: informativ amber-banner-tom-state istedenfor evig spinner når sitedoc_admin ikke har valgt firma. 4 nye i18n-nøkler i 15 språk.

**Verifisering alle deploys:** HTTP/2 200 mot `sitedoc.no` etter hver deploy. PM2 sitedoc-web/api restartet og online. Visuell QA gjennomført av Kenneth på test før hver prod-deploy. Stale `.next`-cache-problem oppdaget to ganger under auto-deploy (PM2 reload trigget før build fullført); løst med manuell `rm -rf apps/web/.next + pnpm build + pm2 restart` på test. Roårsak er deploy-pipeline-svakhet (auto-hook ikke synkronisert med build), ikke kodefeil — separat oppfølgings-oppgave.

**Forventede begrensninger i T7-2a (kommer i T7-2b):**
- «Åpne»-detaljvisning fra firma-attestering-liste bruker eksisterende prosjekt-bundet detalj-side. Firma-admin uten prosjekt-medlemskap får «Prosjektet ble ikke funnet» fra `[prosjektId]/layout.tsx` (forventet — projectId-løs felleskomponent kommer i T7-2b).
- Attestering er fortsatt per-sedel (ikke per-rad). T.3 Alt A (sedel = container uten egen attesterings-status) implementeres i T7-2b.
- Sedler som spenner flere prosjekter viser kun første prosjekts navn i firma-listen.

**T.7-fremdrift:** T7-0 ✅, T7-1a ✅, T7-1b ✅, T7-2a ✅. Gjenstår T7-2b (web attestering — per-rad-attestering + projectId-løs felleskomponent + splitting per T.7-regler) og T7-3 (mobil dagsseddel-redesign etter T7-0-refaktor).

### Ansattnummer i firma-admin bruker-UI IMPLEMENTERT på develop 2026-05-12

`User.ansattnummer`-feltet har vært i schema siden Fase 0, brukt av timer-rapport (`firma/timer/rapport`), attestering-lister (`firma/timer/attestering`, `[prosjektId]/timer/attestering`) og kompetanse-import (matching-nøkkel). Men feltet kunne **ikke settes fra UI** — eneste vei var direkte SQL eller fremtidig HR-import-modul. Denne PR-en lukker hullet ved å legge til ansattnummer-felt i invite- og rediger-modaler for firma-admin.

Server (`apps/api/src/routes/organisasjon.ts`):
- `inviterBruker`: nytt input-felt `ansattnummer: z.string().max(50).optional()`. Settes på `User.create` (ny bruker) og `User.update` (adopsjon av orphan-bruker).
- `oppdaterBruker`: samme input-felt + nullstilling via tom streng (`input.ansattnummer || null`). `select` på respons utvidet med `ansattnummer`.
- `hentBrukere`: `select` utvidet med `ansattnummer` for å støtte default-verdi i rediger-modalen.

Klient (`apps/web/src/app/dashbord/firma/brukere/page.tsx`):
- `BrukerRad`-typen utvidet med `ansattnummer: string | null`.
- `InviterModal`: ny `ansattnummer`-state, input-felt med hjelpetekst plassert etter telefon, sendes med i mutation-payload som `undefined` ved tom verdi.
- `RedigerModal`: default-verdi `bruker.ansattnummer ?? ""`, samme input-felt, sendes alltid med (server håndterer nullstilling).

i18n: 2 nye nøkler nb+en (`firma.brukere.ansattnummer`, `firma.brukere.ansattnummerHjelp`), 13 språk auto-oversatt via `generate.ts`. API+web typecheck 0 nye feil.

### PR O-1 OrganizationMember-tabell DEPLOYET TIL PROD 2026-05-12

Første PR i OrganizationMember-refaktoren (5 PR-er, låst i [fase-0-beslutninger.md § OrganizationMember-refaktor](fase-0-beslutninger.md)). Additiv: ingen eksisterende kode røres. `User.organizationId` + `Organization.users` beholdes for dual-read i O-2.

Schema: Ny `OrganizationMember`-modell (`id`, `userId`, `organizationId`, `ansattRolle String @default("ansatt")`, `firmaRoller String[] @default([])`, `ansattnummer String?`, audit-felter, `@@unique([userId, organizationId])`, Cascade-FK begge ender). Back-relasjoner `organizationMembers OrganizationMember[]` på User og `members OrganizationMember[]` på Organization.

Migrasjon `20260512170000_add_organization_member` applied. Backfill kjørt på test (26 rader) og prod (3 rader). 1:1-match mot `users` med `organization_id`. Prod-deploy via merge `8da92633` + manuell `deploy.sh` (auto-deploy gjelder kun test).

### PR O-5b fjern User.organizationId/ansattnummer i gruppe/medlem/admin/timer-routes DEPLOYET TIL PROD 2026-05-13 (prod-commit `54d917d9`)

Andre sub-PR av O-5. Fjerner alle gjenværende direkte `User.organizationId`- og `User.ansattnummer`-lesinger fra routes (de som ikke fulgte O-5a-mønstret med lokal `hentBrukerOrgId`). Ingen schema-endring, ingen klient-endring. Klargjør for O-5c som dropper `User.organizationId` + `User.ansattnummer` + `OrganizationRole`-tabellen.

Kategori B (4 routes — `User.organizationId`/`User.role` lest direkte for tilgangsbeslutninger):
- `gruppe.ts` `hentMinFlytInfo` (rad 28-58): firma-admin-fallback uten `ProjectMember`-rad. Byttet fra `bruker.role === "company_admin" && bruker.organizationId` til `hentBrukersOrg` + `OrganizationMember.firmaRoller.includes("firma_admin")`-oppslag.
- `medlem.ts` `inviterBruker` (rad 88-135): firmaansvarlig-grenen leste `User.organizationId` to ganger — én for inviterende, én for eksisterende bruker med samme e-post. Begge byttet til `hentBrukersOrg`. Den andre var spesielt subtil: tidligere lest `eksisterendeBruker.organizationId`, nå hentes orgId via `hentBrukersOrg(eksisterendeBruker.id)`.
- `medlem.ts` `leggTilEksisterende` (rad 539): `bruker.organizationId !== prosjekt.primaryOrganizationId`-sjekk byttet til `await hentBrukersOrg(input.userId) !== prosjekt.primaryOrganizationId`. `select` på User-oppslaget rensket — fjernet `organizationId`.
- `admin.ts` `hentAlleOrganisasjoner` (rad 107-136): `include: { users: ... }` (Organization.users back-relasjon) byttet til `include: { members: { select: { user: { select: ... } } } }`. Mapping i respons bygger `users`-feltet fra `members.map((m) => m.user)` — klient-API uberørt. Klient-bytte til `members` kan skje senere som egen kosmetisk PR.

Kategori C (3 filer — `User.ansattnummer` lest direkte):
- `timer/rapport.ts` (rad 95-103 + 272-281): to `User.findMany`-batch-oppslag for ansattnummer-berikelse. Begge nå supplert med `OrganizationMember.findMany({ where: { userId: { in: userIder } }, select: { userId, ansattnummer } })` og merge via `Map<userId, ansattnummer>`. Trygt forutsatt 1:1 (verifisert i prod-sjekk før O-5a).
- `timer/dagsseddel.ts` (rad 673, 716, 791, 878): tre batch-oppslag + ett single-bruker-oppslag (`hentEnkelt`). Batch-stedene følger samme mønster som rapport.ts. Single-stedet bruker `sheet.organizationId` for å gjøre `OrganizationMember.findUnique({ userId_organizationId })`.
- `organisasjon.ts` `oppdaterBruker` (rad 539-554) + `inviterBruker` (rad 411 + 440): fjernet `data.ansattnummer` fra `User.update`/`User.create`. Tidligere O-4b dual-write til User beholdt — nå skrives kun til `OrganizationMember`. Respons fra `oppdaterBruker` bygger `ansattnummer` fra `OrganizationMember.findUnique`-etter-oppdatering. Klient-API uberørt.

Linjer endret: +107 / -51 (netto +56). De fleste filene har netto vekst pga. dual-oppslag-mønster (User-felter + OrganizationMember-felter slått sammen til respons). `timer/dagsseddel.ts` har størst vekst (+40/-12 = +28 linjer) pga. 4 forekomster av samme mønster.

Verifisert: `apps/api` typecheck 0 nye feil. `apps/web` typecheck 0 nye feil (kun pre-eksisterende vitest-typedef-feil i `import-hjelpere.test.ts`). Ingen DB-endring, ingen klient-endring, ingen schema-endring.

### PR O-5a fjern User.organizationId-fallbacks + 8 routes via resolverOrgFraInput DEPLOYET TIL PROD 2026-05-13 (prod-commit `95500003`)

Femte PR i OrganizationMember-refaktoren. Fjerner alle O-5-merkede dual-read-fallbacks i `tilgangskontroll.ts` og refaktorerer 8 routes som hadde lokal `hentBrukerOrgId`-duplikatkode til å bruke nye sentrale hjelpere. Ingen schema-endring, ingen klient-endring.

Prod-konsistens verifisert før implementasjon:
- 0 duplikate e-poster i `users` (prod + test)
- 0 brukere med multiple `OrganizationMember`-rader (prod + test)
- 0 orphan-brukere (User.organizationId satt uten OrganizationMember-rad)

Nye eksporterte hjelpere i `apps/api/src/trpc/tilgangskontroll.ts`:
- `krevBrukersOrg(userId): Promise<string>` — som `hentBrukersOrg`, men kaster FORBIDDEN hvis bruker er org-løs.
- `resolverOrgFraInput(userId, inputOrgId?): Promise<string>` — håndterer sitedoc_admin-bypass + OrganizationMember-validering. Erstatter 8 duplikate `hentBrukerOrgId`-funksjoner i routes.

Kategori D — fallback-grener fjernet i `tilgangskontroll.ts`:
- `hentBrukersOrg`: User.organizationId-fallback fjernet (returnerer null direkte).
- `erFirmaAdmin`: User.role==="company_admin"-fallback fjernet (returnerer false hvis ingen member).
- `verifiserOrganisasjonTilgang`: User.organizationId-fallback fjernet. Kun OrganizationMember-sjekk.
- `autoriserAdminForFirma`: User.role==="company_admin"-fallback fjernet. Bruker `erFirmaAdmin` etter sitedoc_admin-bypass.
- `harOrgRolle`: refaktorert til ett direkte `OrganizationMember.findFirst({ firmaRoller: { has: role } })`-kall (ikke lenger avhengig av User.organizationId).

Kategori D-utvidelse — 3 funksjoner som leste `User.organizationId` direkte byttet til `hentBrukersOrg`:
- `verifiserDokumentTilgang`: firmabruker-sett henter nå via `OrganizationMember.findMany` i stedet for `User.findMany({ organizationId })`.
- `verifiserKompetanseSkriveTilgang`: ctx+mål-org-oppslag via `hentBrukersOrg`. sitedoc_admin-bypass via `User.role` beholdt.
- `verifiserMaskinAnsvarligSkriveTilgang`: cross-org-blokkering via `hentBrukersOrg`. sitedoc_admin-bypass beholdt.

Kategori A — 8 routes refaktorert til `resolverOrgFraInput`/`krevBrukersOrg`:
- `kompetansetype.ts`, `timer/onboarding.ts`, `timer/lonnsart.ts`, `timer/tillegg.ts`, `timer/aktivitet.ts` — bruker `resolverOrgFraInput` (sitedoc_admin + inputOrgId-bypass).
- `eksternKostObjekt.ts`, `timer/dagsseddel.ts` — bruker `krevBrukersOrg` (kort variant uten inputOrgId).
- `maskin/equipment.ts` — refaktorert: `hentBrukerOrg` slettet (bruker `krevBrukersOrg`), `verifiserMaskinTilgang` bruker `hentBrukersOrg`, og en inline Vegvesen-quota-sjekk byttet til `autoriserAdminForFirma`.
- `timer/dagsseddel.ts` `erProsjektLeder` + `hentEgenDagsseddel` + to inline admin-sjekker (rad 165 + rad 1709) byttet fra `User.role==="company_admin" && User.organizationId === X` til `OrganizationMember.firmaRoller.includes("firma_admin")`-oppslag.

Test-fil slettet: `apps/api/src/trpc/tilgangskontroll.test.ts` (16/22 broken siden O-2/O-3a — mocket findFirst der koden bruker findMany, manglet `organizationMember`-mock helt). Integrasjonstester mot test-DB med OrganizationMember-fikstur planlagt etter O-5c.

Linjer endret: +153 lagt til, -637 slettet (netto -484 linjer). Største enkeltreduksjon: 8 × ~25 linjer duplikat `hentBrukerOrgId`-funksjoner erstattet av 2 sentrale hjelpere.

Verifisert: `apps/api` typecheck 0 nye feil. `apps/web` typecheck 0 nye feil (kun pre-eksisterende vitest-typedef-feil i `import-hjelpere.test.ts`). Ingen DB-endring, ingen klient-endring, ingen schema-endring.

### PR O-4b hentBrukere via OrganizationMember + ansatte-rename IMPLEMENTERT på feature/org-member-o4b 2026-05-12

Andre sub-PR av O-4. Bytter routes som leser/skriver `User.ansattnummer` til å gå via `OrganizationMember`, og renamer `firma/brukere` til `firma/ansatte`.

API (`apps/api/src/routes/`):
- `organisasjon.hentBrukere` leser nå via `prisma.organizationMember.findMany` med nested `user`-relasjon. Returnerer ny form med `memberId`, `avdelingId`, `ansattRolle`, `firmaRoller`, `createdAt` i tillegg til gamle User-felter.
- `organisasjon.inviterBruker` opprettholder dual-write: oppretter/oppdaterer både `User`-raden (for legacy `User.ansattnummer` + `User.organizationId`-fallback) og en `OrganizationMember.upsert` med riktig `ansattnummer` + `firmaRoller` (basert på `role === "company_admin"`).
- `organisasjon.oppdaterBruker` speiler `ansattnummer`-endringer til `OrganizationMember` via `updateMany` etter `User.update`.
- `kompetanse.ts` (to blokker): bytter `User.findMany` med `OrganizationMember.findMany` for ansattnummer-matching ved CSV/Excel-import. `name`-feltet ble ikke brukt downstream — fjernet fra select.

Web (`apps/web/src/app/dashbord/firma/`):
- Mappe `brukere/` → `ansatte/` (`git mv`).
- `BrukerRad`-typen i page.tsx utvidet med `createdAt`, `memberId`, `avdelingId`, `ansattRolle`, `firmaRoller`.
- Lenker i `firma/layout.tsx` og `firma/page.tsx` peker nå til `/dashbord/firma/ansatte`.

i18n (15 språk × ~13 nøkler):
- `firma.brukere.*` → `firma.ansatte.*` i alle 15 språkfiler (verdiene/oversettelsene er urørt — kun nøkkel-rename).

Verifisert: `apps/api` typecheck 0 nye feil. `apps/web` typecheck 0 nye feil (etter rydding av stale `.next/types`-cache fra gammel sti). Mobil ikke berørt.

### PR O-4a avdelingId på OrganizationMember IMPLEMENTERT på feature/org-member-o4a 2026-05-12

Første del av O-4 — flytting av felt fra `User` til `OrganizationMember`. Additiv: feltet legges til på OrganizationMember (nullable), backfylles fra `User.avdelingId`. `User.avdelingId` beholdes for dual-read; droppes i O-5.

Schema (`packages/db/prisma/schema.prisma`):
- Nytt felt på `OrganizationMember`: `avdelingId String? @map("avdeling_id")` + relasjon `avdeling Avdeling? @relation(fields: [avdelingId], references: [id], onDelete: SetNull)` + `@@index([avdelingId])`.
- Ny back-relasjon på `Avdeling`: `organizationMembers OrganizationMember[]`.

Migrasjon `20260512200000_o4a_add_member_avdeling`:
- `ALTER TABLE organization_members ADD COLUMN avdeling_id TEXT NULL`
- FK til `avdelinger(id)` med `ON DELETE SET NULL ON UPDATE CASCADE`
- Indeks `organization_members_avdeling_id_idx`

Backfill-script `packages/db/scripts/backfill-org-member-avdeling.ts`: kopierer `User.avdelingId` → `OrganizationMember.avdelingId` for matchende `(userId, organizationId)`. Idempotent.

### PR O-3b routes dual-read organisasjon.ts + prosjekt.ts IMPLEMENTERT på feature/org-member-o3b 2026-05-12

Fortsettelse av OrganizationMember-refaktoren. Erstatter direkte `User.organizationId`-oppslag i tilgangsbeslutninger med dual-read via ny eksportert hjelper.

Ny eksportert hjelper `hentBrukersOrg(userId): Promise<string | null>` i `apps/api/src/trpc/tilgangskontroll.ts`:
- Leser fra `OrganizationMember.findMany`. 1 medlem → returnerer orgId. 0 medlem → fallback til `User.organizationId` (fjernes i O-5). Flere medlem → kaster `BAD_REQUEST` («Bruker tilhører flere firmaer — kontakt support»).
- O-4 introduserer primær-org-flagg når multi-org-modellen formaliseres.

Refaktorerte callsites (alle bytter `bruker.organizationId`-lesing til `hentBrukersOrg`):
- `organisasjon.ts`: `hentTilgjengelige` (firma-velger), `hentMin` (gating «mitt firma»), `endreRolle` (samme-firma-validering på målbruker), `inviterBruker` (adopsjon-flyt — eksisterende User-sjekk), `oppdaterBruker` (samme-firma-validering).
- `prosjekt.ts`: `opprett` og `opprettTestprosjekt` (input-org-tilgangssjekk + default-org-fallback).

Tilgangskontroll-semantikken er uendret — bare datakilden er flyttet. `OrganizationRole`-tabellen og `User.organizationId`-feltet røres ikke (begge droppes i O-5).

### PR O-3a tilgangskontroll + tildelOrgRolle/fjernOrgRolle IMPLEMENTERT på feature/org-member-o3a 2026-05-12

Tredje PR i OrganizationMember-refaktoren (sub-delt: O-3a tilgangskontroll-laget, O-3b modul-routes). Lukker gjenværende inline `company_admin`-sjekker i tilgangskontroll-laget og flytter firma-rolle-skriving fra `OrganizationRole`-tabellen til `OrganizationMember.firmaRoller`.

Ny intern (ikke-eksportert) helper `erFirmaAdmin(userId, organizationId)` i `apps/api/src/trpc/tilgangskontroll.ts`: leser fra `OrganizationMember.firmaRoller.includes("firma_admin")` først, fallback til legacy `User.role === "company_admin" && User.organizationId === organizationId` (fallback fjernes i O-5).

5 funksjoner refaktorert til å bruke `erFirmaAdmin` i stedet for inline `User.role`/`organizationId`-sjekk:
- `verifiserAdmin`, `verifiserProsjektmedlem`, `verifiserAdminEllerFirmaansvarlig` — løkker over `ProjectOrganization`-koblinger for prosjektet og kaller `erFirmaAdmin` per org.
- `verifiserKompetanseSkriveTilgang` (Steg 4) + `verifiserMaskinAnsvarligSkriveTilgang` (Steg 3) — direkte kall mot brukerens / equipment-ets firma.

`organisasjon.tildelOrgRolle`/`fjernOrgRolle` skriver nå til `OrganizationMember.firmaRoller` (fetch → Set-dedup → update). `OrganizationRole`-tabellen røres ikke (droppes i O-5).

### PR O-2 tilgangskontroll dual-read OrganizationMember IMPLEMENTERT på feature/org-member-o2 2026-05-12

Andre PR i OrganizationMember-refaktoren. Refaktorerer 3 funksjoner i `apps/api/src/trpc/tilgangskontroll.ts` til å lese fra `OrganizationMember` først, med fallback til `User.organizationId`/`User.role` (fjernes i O-5).

- `autoriserAdminForFirma`: sjekker `OrganizationMember.firmaRoller.includes("firma_admin")` først. Fallback: `User.role === "company_admin" && User.organizationId === organizationId`. `sitedoc_admin`-bypass bevart.
- `verifiserOrganisasjonTilgang`: sjekker eksistens av `OrganizationMember`-rad først. Fallback: `User.organizationId === organisationId`.
- `harOrgRolle`: leses nå fra `OrganizationMember.firmaRoller` (krever `User.organizationId`-oppslag for å finne riktig medlem). `OrganizationRole`-tabellen leses ikke lenger (0 rader i prod/test, droppes i O-5).

**Ikke endret i denne PR-en:** `verifiserAdmin`, `verifiserProsjektmedlem`, `verifiserAdminEllerFirmaansvarlig`, `verifiserKompetanseSkriveTilgang`, `verifiserMaskinAnsvarligSkriveTilgang` — disse fortsatt prosjekt-baserte og bruker `ProjectMember`. Migreres i O-3 batch-vis.

---

## Timer-modul revisjon — kartlegging 2026-05-11 (arkivert fra STATUS-AKTUELT.md 2026-05-14)

Historisk kartleggings-dokument. Beslutningene som ble tatt her ligger nå låst i [fase-0-beslutninger.md § T (T.1–T.6)](fase-0-beslutninger.md). PR-bunken 1A–2C er deployet til prod 2026-05-11/12.

## Timer-modul revisjon — kartlegging 2026-05-11

Forarbeid før planlegging av større timer-modul-revisjon. Ingen koding — kun faktagrunnlag fra schema, routes og UI-filer.

**🟢 Alle arkitektur-beslutninger låst 2026-05-11** i [fase-0-beslutninger.md § T](fase-0-beslutninger.md) (T.1–T.6). Neste steg: PR 1 schema + migrasjon.

### A — Fra/til per rad (#3) ✅ Avklart

**SheetTimer-modellen** (`packages/db-timer/prisma/schema.prisma:171–195`) har følgende felter:
`id`, `sheetId`, `lonnsartId`, `aktivitetId` (NOT NULL etter C9), `externalCostObjectId` (svak FK), `timer Decimal(6,2)`, `attestertSnapshot Json?`.

**Ingen `fraTid`/`tilTid` på SheetTimer.** Kun antall timer som Decimal(6,2).

**DailySheet-modellen** (`packages/db-timer/prisma/schema.prisma:123–166`) har `startAt DateTime?` og `endAt DateTime?` — dvs. start/slutt **på dag-nivå**, ikke rad-nivå. Også `pauseMin Int @default(0)`.

**UI-filer som redigerer åpen dagsseddel:**
- `apps/web/src/app/dashbord/[prosjektId]/timer/[id]/page.tsx` — DagsseddelDetaljSide (har `isoTidspunktTilHHMM`-helper)
- `apps/web/src/app/dashbord/[prosjektId]/timer/ny/page.tsx` — opprett ny
- `apps/web/src/app/dashbord/timer/mine/page.tsx` — Mine timer-rapport
- `apps/web/src/app/dashbord/[prosjektId]/timer/attestering/[id]/page.tsx` — leder-detalj (read-only + ECO-flytt)
- Mobil: `apps/mobile/app/timer/*` (ikke kartlagt i denne runden)

### B — Dagssum på tvers av prosjekter ✅ Avklart

**JA — finnes.** `timer.dagsseddel.hentDagstotal` i `apps/api/src/routes/timer/dagsseddel.ts:1543`. Tar `userId?` (default = innlogget) + `dato` (ISO YYYY-MM-DD), returnerer sum timer på tvers av prosjekter for én bruker × én dato.

Innebygd C9 2026-05-02 for mobil-bruk («Du har ført Xt i dag på N prosjekter» øverst i ny-dagsseddel-flyten). Multi-sedel per dag er gyldig per unique-constraint `(userId, projectId, dato)`.

**Naturlige sider for visning:**
- Mobil ny-dagsseddel-flyt (bruker den allerede via Runde 2.5/C9)
- `/dashbord/timer/mine` (Mine timer — periode-rapport)
- Mobil ukesoppsummering (Runde 2.7 implementert)
- Leder-attestering-flyt — ville gi kontekst for hvor brukerens øvrige tid er ført

### C — Overtid og lønnsarter (#2) ✅ Avklart

**Lonnsart-typen** (`packages/db-timer/prisma/schema.prisma:22–44`) har `type String` med verdier: `"ordinaer" | "fravaer" | "feriepenger" | "diett"`.

**Overtid finnes IKKE som egen type i Lonnsart.** Overtid er sannsynligvis modellert som **egen `Lonnsart`-rad** med `type="ordinaer"` (f.eks. «Overtid 50 %», «Overtid 100 %»). Verifisering mot seed-data anbefales.

**Auto-fordeling normaltid/overtid** styres av `OrganizationSetting.dagsnorm Decimal @default(7.5)` (kommentar på linje 213: «Dagsnorm i timer per arbeidsdag — auto-fordeling til normaltid/overtid»). Hvordan denne auto-fordelingen kjøres er ikke kartlagt i denne runden — mest sannsynlig i klient-UI eller mutation-handler.

**Ingen 8t/7t-validering** finnes i `apps/api/src/routes/timer/dagsseddel.ts` — `grep "overtid|8t|7t|sommer|vinter"` returnerer tomt fra routes-filer. Validering må bygges fra scratch.

### D — Firminnstilling hele/halve timer ✅ Avklart

**OrganizationSetting** (`packages/db/prisma/schema.prisma:194–229`) har følgende timer-relevante felter:

| Felt | Type | Default | Bruk |
|---|---|---|---|
| `timezone` | String | `Europe/Oslo` | Tidssone for forretningsregler (A.14) |
| `timerTilgangDefault` | String | `alle-ansatte` | Hvem kan registrere timer (default) |
| `dagsnorm` | Decimal(4,2) | `7.5` | Dagsnorm for auto-fordeling overtid |
| `overtidsmatTerskel` | Decimal(4,2) | `9.0` | Terskel for overtidsmat-tillegg |
| `tillattSelvAttestering` | Boolean | `true` | Ansatt kan attestere egen sedel |
| `timerLockEtterDager` | Int? | NULL | Antall dager før låsing (NULL = status styrer) |

**Ingen `heleTimer`/`halveTimer`-felt.** SheetTimer.timer er `Decimal(6,2)` — tillater 0,01 timer presisjon (ned til 36 sekunder).

**Ingen avrundingslogikk** i timer-routes — `grep "rundAv|heleTimer|halveTimer|round|Math.round|fraction"` returnerer tomt fra `apps/api/src/routes/timer/`. Hvis avrunding skal innføres, må det bygges fra scratch (kandidat for OrganizationSetting-felt `tidsrundingMinutter: Int? @default(null)` med 15/30/60-verdier).

### E — Geolokasjon ✅ Avklart

**Project** (`packages/db/prisma/schema.prisma`) har **`latitude Float?` + `longitude Float?`** — prosjekt-koordinater finnes.

**Byggeplass** har **IKKE** koordinater. Kun `address String?`, `name`, `type` (`bygg`/`anlegg`), `status`. Ingen geofence-radius eller polygon.

**Eksisterende GPS-bruk i mobilappen:** `apps/mobile/src/components/OpprettDokumentModal.tsx` bruker `expo-location` for GPS + `erInnenforBounds(latitude, longitude, geo)`-helper for å sjekke om GPS er innenfor en **tegnings georeferanse** (point1.gps + point2.gps). Brukstilfellet er foreslå korrekt tegning ved opprettelse av sjekkliste/oppgave fra felt.

**Ingen geofence-logikk** for byggeplass eller arbeidstidsregistrering. Mannskaps-modulen (planlagt) har geofence-innsjekk i spec, men det er ikke implementert ennå.

### Andre observasjoner

**Dagsseddel-router (`apps/api/src/routes/timer/dagsseddel.ts`)** har følgende mutations/queries:
- `list` (linje 133), `hentMedId` (205), `opprett` (233)
- `hentTilAttestering` (619), `hentTilGodkjenning` (655, alias for backwards compat), `hentForAttestering` (707, leder-detalj-vy)
- `returner` (850), `attester` (882)
- `hentEndringerSiden` (998, mobil offline-sync)
- `hentDagstotal` (1543, cross-prosjekt sum)

**Mangler i dagens timer-modell mtp. revisjons-scope:**
- Fra/til på rad-nivå (#3) — schema-endring
- 8t/7t overtid-validering (#2) — server-logikk
- Redigering av timer-antall under attestering (#4 utvidelse) — server + UI
- Rad-splitting under attestering (#4) — server + UI
- Avrunding/heleTimer-konfig — schema + logikk
- Geofence-basert timer-validering — krever Byggeplass-koordinater

### Konsekvensanalyse — flytt projectId fra DailySheet til SheetTimer (2026-05-11)

**Arkitektur-beslutning (låst):** `DailySheet` skal ikke lenger ha `projectId`. Prosjekttilhørighet flyttes til rad-nivå (SheetTimer/SheetMachine/SheetTillegg/Vareforbruk). Dagsseddelen eies av arbeider/firma, ikke prosjekt.

#### 1. Felter som må fjernes/flyttes på DailySheet

| Felt | Handling | Begrunnelse |
|---|---|---|
| `projectId String` | **Fjernes** | Flyttes til rad-nivå |
| `byggeplassId String?` | **Flyttes til rad** | Byggeplass hører til prosjekt — kan variere per rad |
| `aktivitetId String?` | **Beholdes** som default | C9-vedtak: kanon-eierskap allerede på rad |
| `avdelingId String?` | Drøftes — beholdes? | Avdeling er firma-intern inndeling, ikke prosjekt-knyttet |
| Unique `(userId, projectId, dato)` | **Endres til** `(userId, dato)` | Én sedel per dag per bruker — uavhengig av prosjekt |

#### 2. Nye/endrede felter på rad-tabellene

**SheetTimer:**
- **`projectId String` NOT NULL** (NY) — hver timer-rad knyttes til ett prosjekt
- `byggeplassId String?` (NY) — fra DailySheet
- `externalCostObjectId String?` — finnes allerede (svak FK til ECO i kjernen)
- Vurder: `fraTid String?` + `tilTid String?` (HH:MM) hvis #3 implementeres samtidig

**SheetMachine:**
- **`projectId String` NOT NULL** (NY) — symmetri med SheetTimer
- `byggeplassId String?` (NY)

**SheetTillegg:**
- **`projectId String` NOT NULL** (NY) — symmetri
- Vurder: kanskje noen tillegg er per-sedel (overtidsmat) og noen per-prosjekt — drøftes

**Ny radType-tabell? (drøftes ikke vedtatt):**
- Alternativ A: behold tre separate tabeller (SheetTimer/SheetMachine/SheetTillegg) — alle får `projectId`
- Alternativ B: konsolider til én `SheetLine`-tabell med `type` enum + nullable lonnsartId/vehicleId/tilleggId/vareId
- **Anbefaling:** Alternativ A — minste blast-radius, eksisterende `attestertSnapshot Json` per tabell tillater type-spesifikk pris-snapshot

#### 3. Omfang av projectId-bruk

| Område | Antall forekomster |
|---|---|
| `apps/api/src/routes/timer/` | **45 linjer** (rapport.ts 7, dagsseddel.ts 38) |
| `apps/mobile/app/timer/` + `apps/mobile/src/hooks/` | **47 linjer** |
| **Sum (kartlagte filer)** | **92 linjer** |

**Konklusjon: nærmere 100 enn 50.** Flere steder utenfor disse mappene er ikke kartlagt (web-sider, andre routes som leser timer-data, kontrollpanel-rapporter). Realistisk totaltall: 120–150 endringspunkter.

Hot spots i `apps/api/src/routes/timer/dagsseddel.ts`:
- `erProsjektLeder(userId, projectId)` (linje 43) — autorisasjons-helper
- `krevProsjektLeder(userId, projectId)` (linje 65) — gate
- `opprett` (linje 233) — input har `projectId: z.string().uuid()` påkrevd
- `hentTilAttestering` (linje 619) — filter `projectId: input.projectId`
- `returner` (linje 850) + `attester` (linje 882) — bruker `sheet.projectId` for gate
- `ECO-flytt` (linje 804) — sjekker `eco.projectId !== sheet.projectId`
- Mobil offline-sync (linje 1218, 1305) — bruker `lokal.projectId`

#### 4. Kobling maskin-timer ↔ Equipment

**Finnes.** `SheetMachine.vehicleId` (svak FK String) peker til `Equipment.id` i `db-maskin`-schema. Ingen Prisma `@relation` (cross-package-FK håndteres som svak String per A.3-mønster, etablert mønster i db-timer/db-maskin).

I dag arver `SheetMachine` prosjekttilhørighet via `DailySheet.projectId` (Cascade). Etter endring må `SheetMachine.projectId` settes eksplisitt.

#### 5. Vareforbruk-kobling

**Finnes som egen modell** `Vareforbruk` i `packages/db-varelager/prisma/schema.prisma`:
- `projectId String` (NOT NULL) — **prosjekt er allerede på rad-nivå**
- `byggeplassId String?` — finnes
- `externalCostObjectId String?` — finnes
- `dagsseddelId String?` — svak FK til DailySheet (kan beholdes)
- `attestertSnapshot Json?` — finnes

**Konsekvens:** Vareforbruk passer arkitekturen som hånd i hanske. Ingen schema-endring nødvendig der. Vurder om `dagsseddelId` blir mindre meningsfullt når dagsseddel ikke har prosjekt — den fungerer da som «tilhører hvilken arbeidsdag», ikke «tilhører hvilken prosjekt-dag».

#### 6. Attestering-flyt i dag

**Per `DailySheet`, ikke per rad:**
- `DailySheet.status` (`draft`/`sent`/`returned`/`accepted`) styrer hele sedelen
- `DailySheet.attestertAvUserId` + `attestertVed` lagres på sedel-nivå
- `attester`-mutation gate'er på `krevProsjektLeder(ctx.userId, sheet.projectId)` (linje 895) — leder for sedelens prosjekt attesterer alle rader

**Pris-snapshot per rad finnes allerede** via `attestertSnapshot Json?` på SheetTimer/SheetTillegg/SheetMachine. Det er klart for å flyttes til per-rad-attestering.

**Implikasjon for ny arkitektur:**
- Sedel som spenner flere prosjekter må attesteres av **flere ledere** — én per prosjekt
- Alternativer:
  - **A** — Status flyttes fra DailySheet til per-rad eller per-prosjekt-gruppe. Sedelen er bare en container.
  - **B** — Behold sedel-status, men gjør den til aggregert visning av rad-status (alle rader attestert → sedel = accepted).
  - **C** — Splitt fysisk: én DailySheet per prosjekt. Da blir endringen mindre, men «én sedel for arbeider per dag» går tapt.
- Anbefaling A eller B — ikke C, siden C reverserer hele arkitektur-beslutningen.

#### 7. Migrasjonsplan (skisse, ikke vedtatt)

1. **Schema-endring (bakoverkompatibel fase 1):** Legg til `projectId String?` (nullable) på SheetTimer/SheetMachine/SheetTillegg. Behold `DailySheet.projectId`. Migrasjon kopierer parent-prosjekt til alle rader.
2. **Klient-migrering:** Oppdater alle 92+ callsites til å lese `projectId` fra rad i stedet for sedel. Mutations skriver til rad. Mobil offline-sync må reflektere.
3. **Innstramning (fase 2):** Sett SheetTimer.projectId NOT NULL. Drop `DailySheet.projectId` + endre unique-constraint. Refaktorer `krevProsjektLeder`-gates til å håndtere flere prosjekter per sedel.
4. **Attestering-modell-endring (egen runde):** Vedta A/B per § 6 før innstramning.

#### 8. Avhengigheter mot andre modul-forslag

- **#3 fra/til per rad** — naturlig å gjøre i samme schema-runde (SheetTimer-utvidelse uansett)
- **#4 redigering/splitting ved attestering** — krever per-rad-tankegang; passer godt i § 7 fase 3
- **#2 overtid 8t/7t** — uavhengig (validering ved opprett/edit av rad, ikke knyttet til prosjekt-flytt)
- **#7 rolle-matrise (Prosjektleder/Bas)** — `krevProsjektLeder` refaktoreres uansett — godt tidspunkt å avklare rollesystem først

### Implementasjonsstatus PR 1A → PR 2C (2026-05-11/12)

| PR | Innhold | Status |
|---|---|---|
| **PR 1A** (`862c70c3`) | Schema-additive + backfill (alle kolonner nullable, DailySheet.projectId beholdt) | 🟢 Deployet prod 2026-05-11 |
| **PR 1B** (`bba971ba`) | NOT NULL på rad-tabeller + drop DailySheet.projectId + ny unique `(userId, dato)` | 🟢 Deployet prod 2026-05-12 (00:06:53) |
| **PR 2A** (`6431873c`) | API-refaktor — dagsseddel/rapport/vareforbruk-routes (45 → 0 TS-feil i `apps/api`) | 🟢 Deployet prod 2026-05-12 |
| **PR 2B** (`8478d4a7`) | Web-klient — 3 timer-modaler sender `projectId` fra `useParams` (46 → 0 TS-feil i `apps/web`) | 🟢 Deployet prod 2026-05-12 (PM2-restart bekreftet, restart-teller +1 = 46) |
| **PR 2C min** (`0700b8ed`) | Mobil — defensiv `?? ""` på `serverSedel.projectId` i `timerSync.ts` mot ny server-respons (null for tomme sedler) | 🟢 Deployet prod 2026-05-12 |

**Verifisering prod 2026-05-12:** HTTP/2 200 mot `sitedoc.no`, API health OK. DB-state: `daily_sheets.project_id` DROPPED, `sheet_timer/sheet_machines/sheet_tillegg.project_id` NOT NULL, ny unique `daily_sheets_user_id_dato_key`. PM2 sitedoc-web (id 47) + sitedoc-api (id 39) begge restartet 22:08, uptime 0-2s, restart-teller +1 = 46.

### Åpen oppgave — full Drizzle-schema-omskriving (utsatt)

Mobil-Drizzle-schemaet speiler **gammel** server-modell der `dagsseddel_local.project_id` er NOT NULL på sedel-nivå. Etter T.1/T.2 burde mobil ideelt sett:

1. Gjøre `dagsseddel_local.project_id` nullable (krever SQLite TABLE-recreate-mønster siden ALTER COLUMN DROP NOT NULL ikke støttes direkte)
2. Legge til `project_id` (NOT NULL) + `byggeplass_id` + `fra_tid` + `til_tid` + `attestert_status`/`attestert_av_user_id`/`attestert_ved` på `sheet_timer_local`, `sheet_machine_local`, `sheet_tillegg_local` via idempotente ALTER TABLE
3. Backfill rad-tabellene fra parent `dagsseddel_local.project_id` (samme mønster som C9-migrasjonen for `aktivitet_id`)
4. Oppdatere `timerSync.ts` push-flyt til å sende `projectId` per rad (i tråd med ny API-protokoll fra PR 2A)
5. Oppdatere `app/timer/[id].tsx`, `ny.tsx`, `mine.tsx` for å rendere/redigere projectId per rad

**Hvorfor utsatt:** Mobil typecheck er uendret fra baseline (12 pre-eksisterende feil, alle pre-eksisterende per CLAUDE.md). Eksisterende sync-flyt fungerer fordi mobil sender `lokal.projectId` på sedel-nivå og PR 2A's server propagerer til rader. Full omskriving er en eget runde (1–2 dager) som påvirker offline-sync-strategien og krever mobil-team-koordinering.

**Avhengigheter for å låse opp:** Ny krav fra Sonnet/Kenneth (f.eks. arbeider registrerer timer for flere prosjekter samme dag via mobil) trigger denne omskrivingen.

---


---

## PR-arkiv mai 2026 forts. (arkivert fra STATUS-AKTUELT.md § Pågående arbeid 2026-05-14)

13 PR-seksjoner flyttet hit: detaljerte deploy-rapporter for OrganizationMember-bunken (O-1 → O-5c + O-5b-fix), Timer-arkitektur-redesign (1A–2C), T.7 dagsseddel UI, Ansattnummer i firma-admin, og ansattrolle-UI. Alle er deployet til prod 2026-05-12/13. Kort versjon i [CLAUDE.md § Pågående arbeid](../../CLAUDE.md).

### PR ansattrolle-UI — stilling + firmaRoller synlig+redigerbar i firma/ansatte DEPLOYET TIL PROD 2026-05-13 (prod-commit `3fa34c57`)

**Test-deploy** (develop merge-commit `211cd5de`): auto-deployet. Backfill kjørt mot `sitedoc_test` — 1 OrganizationMember-rad med `User.role = "company_admin"` allerede hadde `firmaRoller = {firma_admin}` (0 oppdatert, 1 hoppet over). Fordeling etter backfill: `{} = 25`, `{firma_admin} = 1`. HTTP 200 verifisert.

**Prod-deploy** (main merge-commit `3fa34c57`): `./deploy.sh` kjørte 1m 41s build, PM2 `sitedoc-web` (id 6) + `sitedoc-api` (id 4) restartet. Backfill mot `sitedoc` — 3 OrganizationMember-rader med `User.role = "company_admin"` hadde alle `firmaRoller = {firma_admin}` fra før (0 oppdatert, 3 hoppet over). Fordeling: `{firma_admin} = 3` (alle medlemmene i prod er firma-admins). HTTP 200 på `sitedoc.no` + `api.sitedoc.no/health` OK. Browser-verifisert av Kenneth: Stilling-kolonne viser «Ansatt» for alle tre, Tilgang-kolonne viser Firmaadmin-badge for alle tre.

**Bekreftet konsistens etter deploy:** Backfill var sikkerhetsventil — prod og test var allerede konsistente (alle eksisterende firma-admins hadde `firmaRoller` korrekt satt). Hullet var teoretisk: hadde noen brukt `endreRolle`-UI-en til å forfremme en bruker etter O-5c-deploy, ville `User.role`-skrivingen ha hatt null effekt på tilgangsbeslutninger siden `erFirmaAdmin` kun leser `firmaRoller`. Nå er `endreRolle`-mutationen slettet og dropdown-en fjernet — fremtidige promoteringer går via `settFirmaAdmin` som skriver direkte til `firmaRoller`.

Oppfølger til O-5-bunken. Lukker konsistens-hullet hvor dagens UI skrev `User.role = "company_admin"` uten å speile til `OrganizationMember.firmaRoller`. Etter O-5c er `firmaRoller` eneste sannhetskilde, men 25/26 OrganizationMember-rader i test hadde fortsatt `firmaRoller = []` fordi `endreRolle`-UI-en bare skrev til legacy `User.role`. Denne PR-en sluker hullet og synliggjør `ansattRolle` + `firmaRoller` i UI-en.

**Backfill-script (`packages/db/scripts/backfill-firma-admin-roller.ts`):**
- Setter `firmaRoller = ["firma_admin"]` for alle OrganizationMember-rader der `User.role === "company_admin"` og rollen ikke allerede er satt
- Idempotent — hopper over rader som allerede har `firma_admin`
- Kjør på test etter deploy: `pnpm --filter @sitedoc/db exec tsx scripts/backfill-firma-admin-roller.ts`

**Server-endringer (`apps/api/src/routes/organisasjon.ts`):**
- **Slettet:** `endreRolle`-mutation (skrev kun til legacy `User.role`)
- **Ny:** `settFirmaAdmin({ userId, organizationId, erAdmin })` — skriver til `OrganizationMember.firmaRoller` (tilfter/fjerner `"firma_admin"` idempotent). Selv-degraderingsbeskyttelse + sitedoc_admin-beskyttelse beholdt
- **Utvidet:** `oppdaterBruker` — fjernet `rolle`-feltet (flyttet til `settFirmaAdmin`), lagt til `ansattRolle: enum("ansatt","bas","prosjektleder","daglig_leder")`. Skriver `ansattRolle` til `OrganizationMember`. Respons utvidet med `ansattRolle` + `firmaRoller`
- **Utvidet:** `inviterBruker` — byttet `rolle: enum` til `erFirmaAdmin: boolean` + ny `ansattRolle: enum`. `User.role` hardcoded til `"user"` for nye brukere. `OrganizationMember` opprettes med `ansattRolle` + `firmaRoller` fra input
- **Refaktorert:** `hentTilgjengelige` — leser nå firma-admin-medlemskap via `OrganizationMember.firmaRoller.includes("firma_admin")` (ikke `User.role === "company_admin"`). Støtter også flere firmaer per bruker (forberedelse for multi-org)

**Web-endringer (`apps/web/src/app/dashbord/firma/ansatte/page.tsx`):**
- Tabell har nå to nye kolonner: «Stilling» (ansattRolle som tekst) og «Tilgang» (Systemadmin / Firmaadmin / Bruker badges basert på `User.role === "sitedoc_admin"` eller `firmaRoller.includes("firma_admin")`)
- Fjernet legacy `endreRolle`-dropdown i tabellen — alle endringer går nå gjennom rediger-modalen
- `RedigerModal`: ny `ansattRolle`-dropdown (4 verdier) + `erFirmaAdmin`-checkbox. Lagre-knappen kaller `oppdaterBruker` først, deretter `settFirmaAdmin` hvis admin-status endres
- `InviterModal`: samme to nye felter, sendes som del av `inviterBruker`-input
- `BrukerRad`-typen uendret — `ansattRolle` + `firmaRoller` var allerede med fra O-4b

**i18n:** 17 nye nøkler i nb/en (stilling-labels × 4, tilgang-badges × 3, kolonneheader × 5, firma-admin-checkbox × 2, tom/uten-navn × 2, stillingLabel × 1). Auto-oversatt til 13 språk via `packages/shared/src/i18n/generate.ts`. Fjernet 3 utdaterte nøkler (`inviter.rolle`, `inviter.rolle.user`, `inviter.rolle.companyAdmin`).

**Verifisert:** `apps/api` typecheck 0 nye feil. `apps/web` typecheck 0 nye feil (kun pre-eksisterende vitest-typedef-feil). Ingen schema-endring.

**Migrasjons-rekkefølge ved deploy:**
1. Push til develop → auto-deploy til test
2. Kjør backfill-script mot test-DB
3. Verifiser i nettleser som innlogget bruker (Kenneth) at firmaadmin-badge, stilling-kolonne, rediger-modal og invitér-modal fungerer
4. Prod-deploy + backfill (når Kenneth godkjenner)

Klar for review — ikke merge før Kenneth verifiserer.

### PR O-5c schema-drop User.organizationId/ansattnummer/avdelingId + OrganizationRole DEPLOYET TIL PROD 2026-05-13 (prod-commit `fe1d703d`, migration applied 22:36:32)

**Siste PR i O-5-bunken.** Dropper tre legacy User-felter fra Prisma-skjemaet + DB, og dropper hele `OrganizationRole`-tabellen. Etter merge + prod-deploy er OrganizationMember-refaktoren komplett.

**Schema-endringer (`packages/db/prisma/schema.prisma`):**
- `User`: fjernet `organizationId String?` + `organization Organization?`-relasjon + `ansattnummer String?` + `avdelingId String?` + `avdeling Avdeling?`-relasjon + `organizationRoles OrganizationRole[]`-relasjon. Composite uniques (`@@unique([email, organizationId])` + `@@unique([phone, organizationId])`) erstattet med `email @unique` direkte på feltet. Indekser `@@index([organizationId])` + `@@index([avdelingId])` fjernet.
- `Organization`: fjernet `users User[]`-back-relasjon + `organizationRoles OrganizationRole[]`-back-relasjon.
- `Avdeling`: fjernet `brukere User[]`-back-relasjon. `organizationMembers OrganizationMember[]` beholdes (lagt til i O-4a).
- `OrganizationRole`-modellen: fjernet komplett.

**Migration `20260513210000_o5c_drop_user_org_fields`:**

```sql
-- Fjern composite uniques
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_organization_id_key";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_phone_organization_id_key";
-- Global email-unique
ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");
-- Dropp tre kolonner + FK + indeks
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_organization_id_fkey";
DROP INDEX IF EXISTS "users_organization_id_idx";
ALTER TABLE "users" DROP COLUMN IF EXISTS "organization_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "ansattnummer";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_avdeling_id_fkey";
DROP INDEX IF EXISTS "users_avdeling_id_idx";
ALTER TABLE "users" DROP COLUMN IF EXISTS "avdeling_id";
-- Dropp OrganizationRole-tabellen (0 rader prod-verifisert)
DROP TABLE IF EXISTS "organization_roles";
```

**Routes-endringer (5 callsites Prisma typecheck avdekket — ikke fanget i grep i O-5a/b/b-fix fordi de brukte `organizationId: true` i select i stedet for å lese feltet eksplisitt):**

| Fil | Funksjon | Endring |
|-----|----------|---------|
| `admin.ts:402-418` | `hentAlleBrukere` (sitedoc_admin) | To-trinns oppslag: User.findMany + OrganizationMember.findMany med organization-include. Klient-respons med `organizationId`/`organization`-felter bygget via map |
| `admin.ts:577-600` | `hentImpersoneringStatus` | Samme to-trinns-pattern. `target.organizationId` + `target.organization.name` bevart |
| `avdeling.ts:42-58` | `hentAlle` | `_count.brukere` → `_count.organizationMembers` med mapping for å bevare `_count.brukere` i klient-respons |
| `avdeling.ts:135-148` | `slett` konflikt-sjekk | `User.count({ avdelingId })` → `OrganizationMember.count({ avdelingId })` |
| `bruker.ts:15-28` | `hentMin` | To-trinns oppslag. Klient-respons med `organizationId` bevart |
| `medlem.ts:17-36` | `hentForProsjekt` | `user`-include endret fra `{ include: { organization } }` til eksplisitt `select`. Organization-relasjon fjernet (0 klient-bruk verifisert). Måtte bruke `select` ikke `user: true` for å unngå TS2589 |

**TS2589-lærdom:** Endring fra `user: { include: { organization } }` til `user: true` triggret TS2589 «Type instantiation is excessively deep» i `MapperPanel.tsx`. `user: true` velger ALLE User-felter inkludert komplette relasjoner i typedefinisjon, mens `user: { select: {...} }` er begrenset til de spesifikke feltene. Mønster å bruke fremover: eksplisitt `select` på `user`-include i tRPC-routes.

**Linjer endret per fil:**

| Fil | + | - | Notat |
|-----|---|---|-------|
| `schema.prisma` | 9 | 56 | -47 (faktisk slett av felt, relasjoner, indekser, modell) |
| `admin.ts` | 25 | 14 | +11 (to-trinns-pattern, lengre kode) |
| `avdeling.ts` | 7 | 3 | +4 |
| `bruker.ts` | 8 | 8 | 0 |
| `medlem.ts` | 10 | 2 | +8 (eksplisitt user-select-liste) |
| `migration.sql` | 27 (ny fil) | — | — |
| **Sum kode** | **59** | **83** | **-24 linjer kode** |

**Verifisert:** `apps/api` typecheck 0 nye feil. `apps/web` typecheck 0 nye feil (kun pre-eksisterende vitest-typedef-feil).

**Verifikasjons-rekkefølge ved deploy:**
1. Push til develop → auto-deploy til test → `prisma migrate deploy` kjører `20260513210000_o5c_drop_user_org_fields` mot `sitedoc_test`.
2. **Manuell browser-verifisering på test som innlogget bruker** før prod-deploy. Spesielt:
   - `/dashbord/firma/ansatte` — listing av ansatte (hentBrukere via OrganizationMember)
   - `/dashbord/firma/kompetanse` — kompetansematrise + opprett kompetanse
   - `/dashbord/firma/avdelinger` — avdeling-liste med `_count.brukere`
   - `/dashbord/admin/firmaer` — sitedoc_admin firma-oversikt
   - `/dashbord/admin/brukere` — sitedoc_admin bruker-oversikt
   - sitedoc_admin-impersonering av kunde-bruker
   - Invitere/oppdatere medlem (OrganizationMember.upsert)
3. Prod-deploy: `prisma migrate deploy` mot `sitedoc`. **Etter migration er kolonnene fjernet permanent — ingen rollback mulig uten DB-backup.**

**Etter prod-deploy: O-5-bunken er komplett.** OrganizationMember er nå eneste sannhetskilde for firma-medlemskap, ansattnummer og avdelingsskap. `User.role` beholdes som system-rolle (kun for `sitedoc_admin`). `User.email` er nå globalt unik (var composite med `organizationId`).

**Konsekvens for fremtidig multi-org:** Composite-unique-pattern er borte. Hvis multi-org skal støttes senere (én User i flere firmaer samtidig), må User.email forbli unik globalt — men OrganizationMember kan ha flere rader per User. `hentBrukersOrg`-helper kaster `BAD_REQUEST` ved multiple OM-rader inntil O-4 introduserer primær-org-flagg. Dette designet er forberedt på multi-org uten datamodell-endring.

Klar for review — ikke merge før Kenneth verifiserer.

### PR O-5b-fix rydd 11 resterende User.organizationId/ansattnummer-treff DEPLOYET TIL PROD 2026-05-13 (prod-commit `fe1d703d`)

Oppfølger til O-5b etter at full-codebase-grep avdekket 11 ytterligere User.organizationId/User.ansattnummer-lesinger eller -skrivinger som ikke ble fanget i O-5b (grep var begrenset til mønstre som `User.organizationId` direkte — treff som `where: { organizationId: orgId }` i `User.findMany`/`User.create`-data ble forbi). Etter denne PR-en er det 0 gjenstående direkte lesinger eller skrivinger av disse feltene i `apps/api/src/`. **O-5c (schema-drop) er nå trygt fra et kode-perspektiv.**

**Fix-er (alle bruker `hentBrukersOrg`/`OrganizationMember`-oppslag):**

| # | Fil:linje | Endring |
|---|-----------|---------|
| 1 | `tilgangskontroll.ts:593-606` | byggTilgangsFilter firmaansvarlig — `User.findMany` → `OrganizationMember.findMany` |
| 2 | `kompetanse.ts:38-50` | hentMatrise brukerliste — User → OrganizationMember med nested user-select |
| 3 | `kompetanse.ts:55-58` | ansattKompetanse-filter — `where: { user: { organizationId } }` → `userId: { in: brukerIder }` |
| 4 | `kompetanse.ts:84-93` | hentForBruker mål-bruker → `OrganizationMember.findUnique({ userId_organizationId })` |
| 5 | `medlem.ts:147-162` | inviterByEmail — fjernet User.organizationId-skriving, lagt til `OrganizationMember.upsert` |
| 6 | `medlem.ts:356-369` | email-konflikt-sjekk innen firma — `User.findFirst({ organizationMembers: { some: { organizationId } } })` |
| 7 | `medlem.ts:526-537` | hentLedigeFirmaBrukere — User → OrganizationMember med user-include |
| 8 | `kompetanse.ts:135-149` | opprett kompetansetype-firma-validering — `hentBrukersOrg(input.userId)` |
| 9 | `maskin/ansvarlig.ts:72-87` | tilfoy cross-org-sjekk — `hentBrukersOrg` + sammenlign med equipment.organizationId |
| 10 | `maskin/import.ts:52-65` | SmartDok-navn-matching — `OrganizationMember.findMany` med user-nested |
| 11 | `maskin/equipment.ts:208-213` | hentMuligeAnsvarlige — `OrganizationMember.findMany` med user-include |

**Bonus-rydding (sluttverifikasjon avdekket to gjenstående SKRIVINGER fra O-5b):**

- `organisasjon.ts:405-413` (`inviterBruker` orphan-adopsjon): fjernet `organizationId: orgId` fra `User.update`-data. `OrganizationMember.upsert` (rad 416) er nå eneste sannhetskilde for firma-medlemskap.
- `organisasjon.ts:431-441` (`inviterBruker` ny-bruker-create): fjernet `organizationId: orgId` fra `User.create`-data. `OrganizationMember.upsert` (rad 444) er nå eneste sannhetskilde.

**Linjer endret per fil:**

| Fil | + | - | Netto |
|-----|---|---|-------|
| `tilgangskontroll.ts` | 6 | 9 | -3 |
| `kompetanse.ts` | 37 | 28 | +9 |
| `medlem.ts` | 40 | 13 | +27 |
| `maskin/ansvarlig.ts` | 4 | 2 | +2 |
| `maskin/equipment.ts` | 4 | 3 | +1 |
| `maskin/import.ts` | 7 | 7 | 0 |
| `organisasjon.ts` | 1 | 3 | -2 |
| **Sum** | **99** | **65** | **+34** |

Netto vekst dominert av `medlem.ts:147-162` der `OrganizationMember.upsert` er ekstra trinn etter `User.create`/`User.update` (separasjon av user-entitet og firma-medlemskap-entitet).

**Verifisert:** `apps/api` typecheck 0 nye feil. `apps/web` typecheck 0 nye feil (kun pre-eksisterende vitest-typedef-feil). Sluttverifikasjon: 0 gjenstående `User.organizationId`-/`User.ansattnummer`-lesinger eller -skrivinger i `apps/api/src/`. Ingen DB-endring, ingen klient-endring, ingen schema-endring.

**Lærdom for prosess:** Min opprinnelige O-5a/O-5b-grep var begrenset til strenger som inkluderte `User.organizationId` direkte (eller `bruker.organizationId`). Grep med `-v "organizationId:"` filtrerte bort `where: { organizationId: ... }`-mønstre. Sluttverifikasjon med utvidet grep (uten `-v "organizationId:"` og kontekstuell sjekk av callsites) er en pålitelig metode før schema-drop — bør gjentas like før O-5c.

**Gjenstår i O-5-bunken:** Kun O-5c (schema-drop av `User.organizationId`, `User.avdelingId`, `User.ansattnummer` + `OrganizationRole`-tabellen + Prisma-relasjoner). Krever én migration. Klient-API uberørt.

Klar for review — ikke merge før Kenneth verifiserer.

### PR O-5b fjern User.organizationId/ansattnummer i gruppe/medlem/admin/timer-routes DEPLOYET TIL PROD 2026-05-13 (prod-commit `54d917d9`)

Andre sub-PR av O-5. Fjerner gjenværende `User.organizationId`- og `User.ansattnummer`-lesinger fra routes som ikke fulgte O-5a-mønstret (lokal `hentBrukerOrgId`). Ingen schema-endring, ingen klient-endring. Forberedelse for O-5c (schema-drop).

**Kategori B — User.organizationId/role lest direkte for tilgangsbeslutninger:**

- **`gruppe.ts hentMinFlytInfo` (rad 28-58)**: Firma-admin-fallback for brukere uten `ProjectMember`-rad. Tidligere: `bruker.role === "company_admin" && bruker.organizationId` → `projectOrganization.findFirst`. Nå: `hentBrukersOrg(ctx.userId)` → `projectOrganization.findFirst` → `OrganizationMember.findUnique({ firmaRoller })` for å verifisere `firma_admin`-rolle. Tre DB-kall i fallback-stien (vs. to før), men logikken er mer korrekt — vi krever nå eksplisitt `firma_admin`-rolle i `firmaRoller`-array, ikke bare `User.role`-flagget.

- **`medlem.ts inviterBruker` (rad 88-135)**: To User.organizationId-lesinger byttet:
  - Inviterende bruker: `User.findUniqueOrThrow({ select: { organizationId } })` → `hentBrukersOrg(ctx.userId)`.
  - Eksisterende bruker med samme e-post: tidligere lest `eksisterendeBruker.organizationId` via `User.findFirst`. Nå hentes orgId for den funne brukeren via `hentBrukersOrg(eksisterendeBruker.id)` — krever to oppslag (User.findFirst på id + OrganizationMember-lookup) i stedet for ett, men korrekt etter O-5c.

- **`medlem.ts leggTilEksisterende` (rad 539)**: `bruker.organizationId !== prosjekt.primaryOrganizationId`-sjekk byttet til `await hentBrukersOrg(input.userId) !== prosjekt.primaryOrganizationId`. `User.findUnique`-select rensket — `organizationId` fjernet.

- **`admin.ts hentAlleOrganisasjoner` (rad 107-136)**: `Organization.users` back-relasjon byttet til `members: { select: { user: { select: ... } } }`. Mapping i respons bygger `users`-feltet manuelt: `members.map((m) => m.user)`. Klient-API uberørt — `apps/web/src/app/dashbord/admin/firmaer/page.tsx` bruker `org.users.length` og `org.users.map` 4 steder og trenger ingen endring. Klient-bytte til direkte `members`-bruk kan skje senere som egen kosmetisk PR. Pattern-bekreftelse: Etter O-5c droppes `Organization.users`-back-relasjonen fra Prisma-skjemaet — denne mappingen isolerer klienten fra det.

**Kategori C — User.ansattnummer lest direkte:**

- **`timer/rapport.ts` (rad 95-103 + 272-281)**: To `User.findMany`-batch-oppslag for ansatt-berikelse i rapport-aggregeringen. Begge nå supplert med:
  ```typescript
  const medlemmer = await prisma.organizationMember.findMany({
    where: { userId: { in: userIder } },
    select: { userId: true, ansattnummer: true },
  });
  const ansattnummerMap = new Map(medlemmer.map((m) => [m.userId, m.ansattnummer]));
  ```
  Trygt forutsatt 1:1 (verifisert i prod-sjekk før O-5a: 0 brukere med multiple OrganizationMember-rader). `User.findMany`-selectet rensket — `ansattnummer` fjernet, `name + email` beholdt.

- **`timer/dagsseddel.ts` (rad 673, 716, 791, 878)**: Tre batch-oppslag (`hentTilAttestering`, `hentTilGodkjenning` deprecated alias, `hentTilAttesteringFirma`) + ett single-bruker-oppslag (`hentEnkelt`). Batch-stedene følger samme mønster som rapport.ts. Single-stedet bruker `sheet.organizationId` for å gjøre `OrganizationMember.findUnique({ userId_organizationId: { userId, organizationId } })` — mer presist enn batch-spørringen siden vi har eksakt org-kontekst.

- **`organisasjon.ts` (rad 411 + 440 + 539-554)**: Skriving rensket — `inviterBruker` skriver ikke lenger `User.ansattnummer` (verken i `User.create` eller `User.update`-adopsjons-grenen). `OrganizationMember.upsert` med `ansattnummer` er nå eneste sannhetskilde. `oppdaterBruker` skriver heller ikke lenger til `User.ansattnummer`; responsen henter `ansattnummer` fra `OrganizationMember.findUnique`-etter-oppdatering. Tidligere O-4b dual-write fjernet til fordel for single-write til OrganizationMember.

**Linjer endret per fil:**

| Fil | + | - | Netto |
|-----|---|---|-------|
| `apps/api/src/routes/gruppe.ts` | 13 | 5 | +8 |
| `apps/api/src/routes/medlem.ts` | 17 | 16 | +1 |
| `apps/api/src/routes/admin.ts` | 13 | 5 | +8 |
| `apps/api/src/routes/organisasjon.ts` | 7 | 9 | -2 |
| `apps/api/src/routes/timer/rapport.ts` | 17 | 4 | +13 |
| `apps/api/src/routes/timer/dagsseddel.ts` | 40 | 12 | +28 |
| **Sum** | **107** | **51** | **+56** |

Netto vekst kommer fra dual-oppslag-mønsteret (User-felter + OrganizationMember-felter merges til respons). Når O-5c dropper `User.ansattnummer` og Prisma-skjemaet ikke lenger har feltet, kan disse oppslagene fortsatt være paret slik — men da uten lenger sannhets-sjekk mot User.

**Verifisert:** `apps/api` typecheck 0 nye feil. `apps/web` typecheck 0 nye feil (kun pre-eksisterende vitest-typedef-feil i `import-hjelpere.test.ts`). Ingen DB-endring, ingen klient-endring, ingen schema-endring.

**Gjenstående i O-5-bunken:** Kun O-5c (schema-drop). Krever to-stegs migration-policy:
1. PR O-5c-1: Fjern `User.organizationId`/`User.avdelingId`/`User.ansattnummer`/`Organization.users`/`Avdeling.users`-relasjonene fra Prisma-skjemaet. Generer migration som setter Drop kolonner. Deploy.
2. (Ingen «steg 2» — siden ingen kode leser feltene lenger etter O-5b, kan dropet skje i én migration. Sletting av `OrganizationRole`-tabellen kan også gjøres samtidig.)

Klar for review — ikke merge før Kenneth verifiserer.

### PR O-5a fjern User.organizationId-fallbacks + 8 routes via resolverOrgFraInput DEPLOYET TIL PROD 2026-05-13 (prod-commit `95500003`)

Femte PR i OrganizationMember-refaktoren. Første sub-PR av O-5 — fjerner alle dual-read-fallbacks fra `tilgangskontroll.ts` og refaktorerer 8 routes som hadde duplikat `hentBrukerOrgId`-kode. Ingen schema-endring, ingen klient-endring. Forberedelse for O-5b (Kategori B+C) og O-5c (schema-drop av `User.organizationId` + `OrganizationRole`-tabellen).

**Prod-konsistens verifisert før implementasjon:**
- 0 duplikate e-poster i `users` (prod + test).
- 0 brukere med flere `OrganizationMember`-rader (prod + test).
- 0 orphan-brukere (User.organizationId satt uten OrganizationMember-rad).
- sitedoc_admin (Kenneth) har ingen OrganizationMember-rad og ingen `users.organization_id` — korrekt cross-tenant tilstand. `User.role`-kolonnen beholdes som system-rolle (droppes ikke i O-5).

**Nye eksporterte hjelpere i `apps/api/src/trpc/tilgangskontroll.ts`:**
- `krevBrukersOrg(userId): Promise<string>` — som `hentBrukersOrg`, men kaster FORBIDDEN hvis bruker er org-løs. Brukes på routes som krever firmatilhørighet uten inputOrgId-bypass.
- `resolverOrgFraInput(userId, inputOrgId?): Promise<string>` — håndterer sitedoc_admin-bypass (returnerer `inputOrgId` direkte for sitedoc_admin) + OrganizationMember-validering for vanlige brukere. Erstatter 8 duplikate lokale `hentBrukerOrgId`-funksjoner i routes.

**Kategori D — fallback-grener fjernet i `tilgangskontroll.ts`:**
- `hentBrukersOrg`: `User.organizationId`-fallback fjernet (returnerer null direkte hvis ingen OrganizationMember).
- `erFirmaAdmin`: `User.role==="company_admin"`-fallback fjernet (returnerer false hvis ingen member har `firma_admin`-rolle).
- `verifiserOrganisasjonTilgang`: `User.organizationId`-fallback fjernet. Kun OrganizationMember-sjekk.
- `autoriserAdminForFirma`: `User.role==="company_admin"`-fallback fjernet. Bruker `erFirmaAdmin` etter sitedoc_admin-bypass.
- `harOrgRolle`: refaktorert til ett direkte `OrganizationMember.findFirst({ firmaRoller: { has: role } })`-kall. Ikke lenger avhengig av `User.organizationId` for å finne riktig member.

**Kategori D-utvidelse — 3 funksjoner som leste `User.organizationId` direkte byttet til `hentBrukersOrg`:**
- `verifiserDokumentTilgang`: firmabruker-sett henter nå via `OrganizationMember.findMany({ where: { organizationId }, select: { userId } })` i stedet for `User.findMany({ where: { organizationId } })`.
- `verifiserKompetanseSkriveTilgang`: ctx- og mål-org-oppslag via `hentBrukersOrg`. sitedoc_admin-bypass via `User.role` beholdt.
- `verifiserMaskinAnsvarligSkriveTilgang`: cross-org-blokkering via `hentBrukersOrg(ctxUserId)`. sitedoc_admin-bypass beholdt.

**Kategori A — 8 routes refaktorert til sentrale hjelpere:**
- Full inputOrgId-variant (`resolverOrgFraInput`): `kompetansetype.ts`, `timer/onboarding.ts`, `timer/lonnsart.ts`, `timer/tillegg.ts`, `timer/aktivitet.ts`.
- Kort variant uten inputOrgId (`krevBrukersOrg`): `eksternKostObjekt.ts`, `timer/dagsseddel.ts`.
- `maskin/equipment.ts`: lokal `hentBrukerOrg` slettet (bruker `krevBrukersOrg`), `verifiserMaskinTilgang` bruker `hentBrukersOrg` i stedet for å lese `User.organizationId` direkte. En inline Vegvesen-quota-sjekk (krevde `company_admin`) byttet til `autoriserAdminForFirma`-kall.
- `timer/dagsseddel.ts`: i tillegg til org-resolution-bytte, `erProsjektLeder` + `hentEgenDagsseddel` + to inline admin-sjekker (linjene 165 + 1709) byttet fra `bruker.role === "company_admin" && bruker.organizationId === X` til `OrganizationMember.firmaRoller.includes("firma_admin")`-oppslag.

**Test-fil slettet:** `apps/api/src/trpc/tilgangskontroll.test.ts` (16/22 tester broken siden O-2/O-3a). Testene mocket `projectOrganization.findFirst` der koden bruker `findMany`, og manglet `organizationMember`-mock helt. Ingen CI-kjøring siden `apps/api/package.json` mangler test-script. Erstattes med integrasjonstester mot test-DB med OrganizationMember-fikstur etter O-5c.

**Linjer endret:** +153 lagt til, -637 slettet (netto -484 linjer). Største reduksjon: 8 × ~25 linjer duplikat `hentBrukerOrgId`-funksjoner erstattet av 2 sentrale hjelpere.

**Verifisert:** `apps/api` typecheck 0 nye feil. `apps/web` typecheck 0 nye feil (kun pre-eksisterende vitest-typedef-feil i `import-hjelpere.test.ts`). Ingen DB-endring, ingen klient-endring, ingen schema-endring.

**Gjenstående i O-5-bunken:**
- O-5b (Kategori B+C): `gruppe.ts`, `medlem.ts`, `admin.ts`, `maskin/ansvarlig.ts` (gjenværende inline `bruker.organizationId`/`company_admin`-sjekker) + 8 steder som leser `User.ansattnummer` i `organisasjon.ts`, `kompetanse.ts`, `timer/rapport.ts`, `timer/dagsseddel.ts` (bytte til `OrganizationMember.ansattnummer`).
- O-5c: schema-drop av `User.organizationId`, `User.avdelingId`, `User.ansattnummer` og `OrganizationRole`-tabellen. Krever to-stegs migration-policy: én PR setter NOT NULL/legger til validering, neste PR (etter prod-deploy) dropper kolonnene.

Klar for review — ikke merge før Kenneth verifiserer.

### PR O-4b hentBrukere via OrganizationMember + ansatte-rename IMPLEMENTERT på feature/org-member-o4b 2026-05-12

Andre sub-PR av O-4. Etter at O-4a la til `avdelingId` på `OrganizationMember`-tabellen, flytter O-4b lese-/skrive-mønstre for `ansattnummer` over fra `User` til `OrganizationMember`, og renamer URL `/dashbord/firma/brukere` til `/dashbord/firma/ansatte`. Dual-write opprettholdes til O-5 dropper `User.ansattnummer` + `User.organizationId`.

**API-endringer (`apps/api/src/routes/`):**

- `organisasjon.hentBrukere` leser via `prisma.organizationMember.findMany` med nested `user`-relasjon. Ny respons-form: legger til `memberId`, `avdelingId`, `ansattRolle`, `firmaRoller`, `createdAt` ved siden av de gamle User-feltene. Sortering på `user.name`.
- `organisasjon.inviterBruker` (create- og adopt-grener): etter `User.create`/`User.update` kjøres `prisma.organizationMember.upsert` med `ansattnummer` + `firmaRoller: input.rolle === "company_admin" ? ["firma_admin"] : []`. Garanterer at alle nye/adopterte brukere har OrganizationMember-rad.
- `organisasjon.oppdaterBruker`: etter `User.update` speiler `ansattnummer`-endringer til `OrganizationMember.updateMany`. Andre felter (`name`, `email`, `phone`, `role`) ligger fortsatt kun på User.
- `kompetanse.ts` (to blokker — `analyserImport` og `bekreftImport`): bytter `prisma.user.findMany` med `prisma.organizationMember.findMany` for matching av ansattnumre. `bruker`-variabel-form (`{ id, ansattnummer }`) bevares ved post-mapping fra members, slik at downstream-kode (`brukere.map((b) => b.id)`, `brukerMap`) er uendret. `name`-feltet (som var i select men ikke brukt downstream) fjernet.

**Web-endringer (`apps/web/src/app/dashbord/firma/`):**

- Mappe rename via `git mv brukere ansatte/`. Hele page-komponenten + helper-komponenter beholdt urørt; kun typen `BrukerRad` utvidet med `createdAt`, `memberId`, `avdelingId`, `ansattRolle`, `firmaRoller` for å matche ny respons fra `hentBrukere`.
- `firma/layout.tsx` linje 30: `href: "/dashbord/firma/brukere"` → `"/dashbord/firma/ansatte"`.
- `firma/page.tsx` linje 66: tilsvarende.
- Ingen 308-redirect implementert. Anchored-lenker andre steder fra (e.g. e-postinvitasjoner) bør sjekkes ved gjenbruk — ingen treff funnet utenfor de tre web-filene.

**i18n:**

- `firma.brukere.tittel` → `firma.ansatte.tittel`
- `firma.brukere.ansattnummer` → `firma.ansatte.ansattnummer`
- `firma.brukere.ansattnummerHjelp` → `firma.ansatte.ansattnummerHjelp`
- `firma.brukere.inviter.knapp` → `firma.ansatte.inviter.knapp`
- `firma.brukere.inviter.tittel` → `firma.ansatte.inviter.tittel`
- `firma.brukere.inviter.beskrivelse` → `firma.ansatte.inviter.beskrivelse`
- `firma.brukere.inviter.navn|.epost|.telefon|.rolle|.rolle.user|.rolle.companyAdmin|.lagrer|.lagre` (8 nøkler)
- `firma.brukere.rediger.tittel` → `firma.ansatte.rediger.tittel`
- `firma.brukere.rediger.iconLabel` → `firma.ansatte.rediger.iconLabel`

Totalt 16 nøkler × 15 språkfiler (nb, en, sv, no-bokmal, da, de, fr, pl, lt, lv, et, fi, cs, ru, sq, uk, ro). **Verdiene/oversettelsene er urørt** — kun nøkkel-rename. Bevisst valg: «Brukere» som synlig label vurderes separat (kan vurderes endret til «Ansatte» i UI-runde uten kode-endring).

**Mobil:** Ikke berørt — ingen `firma/brukere`-eller `firma.brukere.*`-referanser i `apps/mobile/`.

**Verifisert:** `apps/api` typecheck 0 nye feil. `apps/web` typecheck 0 nye feil (etter rydding av stale `.next/types/app/dashbord/firma/brukere/`-cache som er etterlatt av tidligere Next.js-bygg på gammel sti — vil bli ryddet automatisk av neste prod-`next build`).

**Klar for review.** Ikke merge — Kenneth verifiserer kode før godkjenning.

### PR O-4a avdelingId på OrganizationMember IMPLEMENTERT på feature/org-member-o4a 2026-05-12

Første sub-PR av O-4 — flytting av felt fra `User` til `OrganizationMember`. Splittet av schema-størrelse: O-4a tar `avdelingId` (FK med SetNull-relasjon), O-4b vil ta `ansattnummer` (allerede på `OrganizationMember`, men User-feltet leses fortsatt i flere routes), O-4c tar `firma/brukere → firma/ansatte`-rename + UI-skifte mot `OrganizationMember`.

**Schema (`packages/db/prisma/schema.prisma`):**

- `OrganizationMember`: nytt felt `avdelingId String? @map("avdeling_id")` + relasjon `avdeling Avdeling? @relation(fields: [avdelingId], references: [id], onDelete: SetNull)` + `@@index([avdelingId])`.
- `Avdeling`: ny back-relasjon `organizationMembers OrganizationMember[]`.

**Migrasjon `20260512200000_o4a_add_member_avdeling`:**

```sql
ALTER TABLE organization_members ADD COLUMN avdeling_id TEXT NULL;
ALTER TABLE organization_members ADD CONSTRAINT organization_members_avdeling_id_fkey
  FOREIGN KEY (avdeling_id) REFERENCES avdelinger (id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX organization_members_avdeling_id_idx ON organization_members (avdeling_id);
```

**Backfill-script `packages/db/scripts/backfill-org-member-avdeling.ts`:**

Leser `User`-rader med `organizationId != null && avdelingId != null` og kjører `prisma.organizationMember.updateMany({ where: { userId, organizationId }, data: { avdelingId } })`. Idempotent. Kjør på test og prod etter `migrate deploy`.

**Konsekvens:** Etter O-4a er `avdelingId` tilgjengelig på `OrganizationMember` i tillegg til `User`. Dual-read aktiveres når routes oppdateres (planlagt i O-4c sammen med `firma/brukere → firma/ansatte`-rename). `User.avdelingId` beholdes urørt og droppes i O-5.

**Verifisert:** Prisma generate ok, `apps/api` typecheck 0 nye feil. Migrasjon og backfill ikke kjørt mot test/prod ennå — venter på review.

**Klar for review.** Ikke merge — Kenneth verifiserer kode før godkjenning.

### PR O-3b routes dual-read organisasjon.ts + prosjekt.ts IMPLEMENTERT på feature/org-member-o3b 2026-05-12

Fortsettelse av OrganizationMember-refaktoren. O-3a lukket inline `company_admin`-fallbacks i tilgangskontroll-laget; O-3b flytter de gjenstående direkte `User.organizationId`-oppslagene i routes til en ny eksportert hjelper.

**Ny eksportert helper:**

- `hentBrukersOrg(userId): Promise<string | null>` — `OrganizationMember.findMany` først (1 medlem → orgId, flere → `BAD_REQUEST` «kontakt support»), fallback `User.organizationId` (fjernes i O-5). Multi-org-håndtering låses i O-4.

**Refaktorerte callsites:**

`apps/api/src/routes/organisasjon.ts`:
- `hentTilgjengelige` (firma-velger) — `company_admin`-grenen bruker `hentBrukersOrg(ctx.userId)`.
- `hentMin` (gating «mitt firma»-query) — orgId hentes via `hentBrukersOrg`, ingen User.organizationId-oppslag.
- `endreRolle` (samme-firma-validering på målbruker) — `hentBrukersOrg(input.userId)` erstatter `målbruker.organizationId`.
- `inviterBruker` (adopsjon-flyt) — eksisterende User-rad sin org hentes via `hentBrukersOrg(eksisterende.id)`, ikke fra `findFirst select`.
- `oppdaterBruker` (samme-firma-validering) — samme mønster som `endreRolle`.

`apps/api/src/routes/prosjekt.ts`:
- `opprett` — tilgangssjekk på `input.organizationId` + default-org-fallback bruker `hentBrukersOrg(ctx.userId)` i stedet for `bruker.organizationId`.
- `opprettTestprosjekt` — samme mønster.

**Ikke endret:** Kategori B-treff fra scope-kartleggingen (rene data-queries, input-filter, admin-routes som bare leser/skriver `organizationId`-feltet uten å bruke det til en tilgangsavgjørelse). Disse migreres når `User.organizationId` faktisk droppes i O-5. `maskin/equipment.ts`, `timer/dagsseddel.ts`, `vare.ts` ble ikke berørt — deres treff er i hovedsak Kategori B og kan tas i en egen sub-PR hvis tilgangskontroll-mønstre finnes der (krever egen kartlegging).

**Tilgangskontroll-semantikken er uendret** — bare datakilden er flyttet. `OrganizationRole`-tabellen og `User.organizationId`-feltet røres ikke; begge droppes i O-5.

**Verifisert:** `apps/api` typecheck 0 nye feil. Ingen DB-endring. Klar for review — ikke merge før Kenneth verifiserer.

### PR O-3a tilgangskontroll + tildelOrgRolle/fjernOrgRolle IMPLEMENTERT på feature/org-member-o3a 2026-05-12

Tredje PR i OrganizationMember-refaktoren (sub-delt: O-3a tilgangskontroll-laget, O-3b modul-routes). Lukker alle gjenværende inline `company_admin`-sjekker i `apps/api/src/trpc/tilgangskontroll.ts` og flytter firma-rolle-skriving fra `OrganizationRole`-tabellen til `OrganizationMember.firmaRoller`.

**Ny intern helper (ikke eksportert):**

- `erFirmaAdmin(userId, organizationId): Promise<boolean>` — leser fra `OrganizationMember.firmaRoller.includes("firma_admin")` først, fallback til `User.role === "company_admin" && User.organizationId === organizationId`. Fallback fjernes i O-5.

**Refaktorerte funksjoner (5 stk):**

- `verifiserAdmin` — bytter inline company_admin-fallback med løkke over `ProjectOrganization`-koblinger + `erFirmaAdmin`-kall per org. Henter ikke lenger `organizationId` på `User`.
- `verifiserProsjektmedlem` — samme mønster.
- `verifiserAdminEllerFirmaansvarlig` — samme mønster, returnerer `{ erAdmin: true }` ved firma-admin-treff i prosjektets org-koblinger.
- `verifiserKompetanseSkriveTilgang` (Steg 4) — bytter `ctxBruker.role === "company_admin"`-sjekk med `erFirmaAdmin(ctxUserId, ctxBruker.organizationId)`. Cross-org-blokkering (Steg 3) bruker fortsatt `User.organizationId` (samme firma — flyttes i O-4/O-5).
- `verifiserMaskinAnsvarligSkriveTilgang` (Steg 3) — bytter `ctxBruker.role === "company_admin"`-sjekk med `erFirmaAdmin(ctxUserId, equipment.organizationId)`.

**Refaktorerte mutations (organisasjon.ts):**

- `tildelOrgRolle` — skriver til `OrganizationMember.firmaRoller` i stedet for `OrganizationRole.upsert`. Mønster: fetch → `Array.from(new Set([...firmaRoller, role]))` → `update`. Validering: målbruker må ha eksisterende `OrganizationMember`-rad i samme firma (FORBIDDEN ellers). Idempotent.
- `fjernOrgRolle` — skriver til `OrganizationMember.firmaRoller`. Fetch → filter ut rollen → update. Returnerer `{ fjernet: 0 | 1 }` (1 hvis rollen fantes og ble fjernet, 0 ellers). `OrganizationRole`-tabellen røres ikke (droppes i O-5).

**Verifisert:** `apps/api` typecheck 0 nye feil. Ingen DB-endring i denne PR-en. `OrganizationRole`-tabellen står urørt (0 rader i prod/test) til O-5.

**Klar for review.** Ikke merge — Kenneth verifiserer kode før godkjenning. Etter merge: O-3b (modul-routes som leser `User.organizationId` direkte) som neste sub-PR.

### PR O-2 tilgangskontroll dual-read OrganizationMember IMPLEMENTERT på feature/org-member-o2 2026-05-12

Andre PR i OrganizationMember-refaktoren. Refaktorerer `apps/api/src/trpc/tilgangskontroll.ts` til å lese fra `OrganizationMember` først, med fallback til `User.organizationId`/`User.role` (fallback fjernes i O-5).

**Endrede funksjoner (3 stk):**

- **`autoriserAdminForFirma`** (linje 201): `sitedoc_admin`-bypass først (uendret), så ny `prisma.organizationMember.findUnique({ where: { userId_organizationId } })`-sjekk på `firmaRoller.includes("firma_admin")`. Fallback til gammel `User.role === "company_admin" && User.organizationId === organizationId`-sjekk hvis ingen medlem-rad finnes (sikrer at brukere uten bakfylt OrganizationMember-rad ikke låses ute).
- **`verifiserOrganisasjonTilgang`** (linje 165): sjekker eksistens av OrganizationMember-rad først. Fallback: gammel `User.organizationId === organisationId`-sjekk. Ingen rolle-krav — kun medlemskap.
- **`harOrgRolle`** (linje 662): leser nå fra `OrganizationMember.firmaRoller` for brukerens primær-org. Krever `User.organizationId`-oppslag for å finne riktig medlem-rad. `OrganizationRole`-tabellen leses ikke lenger — kommentar dokumenterer at den droppes i O-5 (0 rader i prod/test).

**Ikke endret:**

- `verifiserAdmin`, `verifiserProsjektmedlem`, `verifiserAdminEllerFirmaansvarlig` — prosjekt-baserte (`ProjectMember`), ikke firma-baserte. Bruker `User.role + User.organizationId` for company_admin-fallback inn til prosjektkonteksten.
- `verifiserKompetanseSkriveTilgang`, `verifiserMaskinAnsvarligSkriveTilgang` — modul-spesifikke; migreres i O-3 batch-vis.
- `hentBrukerFaggruppeIder`, `verifiserFaggruppeTilhorighet`, `verifiserDokumentTilgang`, `verifiserFlytRolle`, `byggTilgangsFilter`, `hentBrukerTillatelser`, `verifiserTillatelse`, `krevErKundeFirma`: bruker `User.role` (sitedoc_admin-bypass) eller andre tabeller — ingen `organizationId`-lesing.

**Konsekvens:** Etter O-2 vil firma-admin-ruter (alle som bruker `autoriserAdminForFirma`) støtte både OrganizationMember-medlemmer med `firmaRoller=["firma_admin"]` og legacy `User.role="company_admin"`-brukere. I O-3/O-5 fjernes fallback når alle callsites er migrert.

**Verifisert:** `apps/api` typecheck 0 nye feil. `apps/web` typecheck: kun pre-eksisterende vitest-feil i `mengde/__tests__/import-hjelpere.test.ts`. Ingen DB-endring i denne PR-en.

**Klar for review.** Ikke merge — Kenneth verifiserer kode før godkjenning.

### PR O-1 OrganizationMember-tabell DEPLOYET TIL PROD 2026-05-12

Første PR i OrganizationMember-refaktoren (5 PR-er, låst i [fase-0-beslutninger.md § OrganizationMember-refaktor](fase-0-beslutninger.md)). Skiller system-identitet (`User`) fra HR-relasjon (`OrganizationMember`). Additiv: ingen eksisterende kode røres. `User.organizationId` + `Organization.users` beholdes for dual-read i O-2.

Schema (`packages/db/prisma/schema.prisma`):
- Ny `OrganizationMember`-modell: `id`, `userId`, `organizationId`, `ansattRolle String @default("ansatt")`, `firmaRoller String[] @default([])`, `ansattnummer String?`, audit-felter, `@@unique([userId, organizationId])`, FK Cascade på begge ender.
- Back-relasjon `organizationMembers OrganizationMember[]` på User.
- Back-relasjon `members OrganizationMember[]` på Organization (eksisterende `users User[]` beholdes for dual-read).

Migrasjon (`20260512170000_add_organization_member`):
- Manuell SQL (lokal `migrate dev` brytes av pgvector-extension-mangel på shadow-DB — kjent svakhet i lokal-miljø). SQL er gyldig og applyes via `migrate deploy` på test/prod. Cascade på user_id og organization_id; etablert TEXT/`gen_random_uuid()::TEXT`-mønster.

Backfill-script (`packages/db/scripts/backfill-organization-members.ts`):
- Idempotent upsert per (userId, organizationId). `firmaRoller = ["firma_admin"]` hvis `User.role === "company_admin"`, ellers `[]`. `ansattnummer` kopieres fra User. Kjøres på test etter migrate deploy: `pnpm --filter @sitedoc/db exec tsx scripts/backfill-organization-members.ts`.

**Avvik fra instruks:** `@map("_id")` på `id`-feltet droppet — MongoDB-konvensjon, alle andre modeller i schema bruker bare `id` uten map. Tabell-navnet beholdes som standard `id`.

**Lokal verifisering:** SQL ble forsøkt applyet direkte via psql (omgår shadow-DB) — CREATE TABLE + 3 indekser fungerte; FK-er feilet fordi lokal-DB mangler `users`/`organizations`-tabellene (bevis på «lokal er bak»). Lokal-tabell droppet etterpå — ren tilstand.

**Verifisert:** `apps/api` typecheck 0 nye feil. `apps/web` typecheck: kun pre-eksisterende vitest-feil i `mengde/__tests__/import-hjelpere.test.ts` (CLAUDE.md-dokumentert som kjent gjeld).

**Backfill-resultat:**
- Test (sitedoc_test): 26 rader opprettet — 1:1-match mot `users` med `organization_id IS NOT NULL` (26 = 26). 1 rad med `firma_admin` i `firmaRoller`. 0 med `ansattnummer`.
- Prod (sitedoc): 3 rader opprettet — 1:1-match (3 = 3). Alle 3 med `firma_admin` i `firmaRoller` (A.Markussen-admin, HRP AS-admin, Kenneths testmiljø-admin). 0 med `ansattnummer` (UI for ansattnummer ble deployet i samme merge).

**Deploy-spor:** merge `68b930a5` (develop), merge `8da92633` (main), prod-deploy via manuell `deploy.sh` 2026-05-12 (auto-deploy gjelder kun test).

### Ansattnummer i firma-admin bruker-UI IMPLEMENTERT på develop 2026-05-12

Lukker arkitekturhull: `User.ansattnummer` har vært lest av flere komponenter (timer-rapport, attestering-lister, kompetanse-import) men kunne ikke settes fra UI. Eneste vei i dag var direkte SQL eller en fremtidig HR-import-modul.

Server-endringer (`apps/api/src/routes/organisasjon.ts`):
- `inviterBruker.input` utvidet med `ansattnummer: z.string().max(50).optional()`. `User.create` setter feltet ved ny bruker; `User.update` setter det ved adopsjon av orphan-bruker (eksisterende user med matchende e-post uten `organizationId`).
- `oppdaterBruker.input` utvidet med samme felt. Mutation håndterer nullstilling via tom streng: `input.ansattnummer || null`. Respons-`select` utvidet med `ansattnummer`.
- `hentBrukere.select` utvidet med `ansattnummer` for å støtte default-verdi i `RedigerModal`.

Klient-endringer (`apps/web/src/app/dashbord/firma/brukere/page.tsx`):
- `BrukerRad`-typen utvidet med `ansattnummer: string | null`.
- `InviterModal`: ny lokal state `ansattnummer: ""`, input-felt med liten hjelpetekst plassert etter telefon. Sendes som `undefined` ved tom verdi for å trigge schema-default (null) på server.
- `RedigerModal`: default `bruker.ansattnummer ?? ""`. Felt sendes alltid med — server nullstiller hvis tom.

i18n: 2 nye nøkler nb+en (`firma.brukere.ansattnummer`, `firma.brukere.ansattnummerHjelp`). 13 språk auto-oversatt via `generate.ts`. Totalt 2163 nøkler per språk.

**Bakgrunn:** Per CLAUDE.md vil A.Markussen bruke ansattnummer for å koble timer-rapporter (firma-rapport viser kolonnen, eksport inkluderer den) og kompetanse-import (matching-nøkkel). Manuell SQL-løsning er ikke skalerbar når kunden vil onboarde 50+ ansatte.

**Ikke-scope** (per CLAUDE.md «no half-finished implementations»):
- Prosjekt-medlem-flyt (`apps/api/src/routes/medlem.ts`) tar fortsatt ikke imot ansattnummer ved invitasjon. Brukere som først opprettes via firma-side vil arve feltet ned til prosjekt-medlemskap automatisk. Hvis det viser seg at prosjekt-medlem-invitasjon må kunne sette ansattnummer direkte, åpnes egen PR.
- HR-import-modul forblir planlagt fremtidig arbeid for batch-import fra eksternt system.

Verifisert: `apps/api` + `apps/web` typecheck 0 nye feil. Klar for test-deploy. **Stopp og rapporter etter test-verifisering — prod-deploy avventer eksplisitt grønt lys.**

---

### T.7 dagsseddel UI-redesign + #8 sjekklistemaler-kolonner DEPLOYET TIL PROD 2026-05-12

T.7-leveranseplanen (definert i [fase-0-beslutninger.md § T.7](fase-0-beslutninger.md)) startet samme dag som PR 1A–2C, med URL-struktur Alternativ C (tre kontekster: arbeider `/dashbord/timer/[id]`, prosjektleder `/dashbord/[prosjektId]/timer/attestering`, firma-admin `/dashbord/firma/timer/attestering`) og fire PR-er. Tre etapper deployet samme kveld.

**Kundeønske #8 — Fagområde/Antall punkter-kolonner** (`3eb7398f` impl, merge `542461e2`).

`apps/web/src/app/dashbord/oppsett/produksjon/_components/MalListe.tsx`: to nye kolonner mellom Navn og Prefiks. Datafelter hentes fra eksisterende `mal.hentForProsjekt`-respons (`domain` + `_count.objects`). `MalRad`-typen utvidet med `domain: string`. 4 nye i18n-nøkler nb+en (`tabell.antallPunkter`, `maler.domain.bygg/hms/kvalitet`), 13 språk auto-oversatt via `generate.ts`. Russisk «HSE» ble feilaktig oversatt til «НИУ ВШЭ» (akronym-forveksling) — native-speaker-QA anbefalt. 16 filer endret, +73/-0.

**PR T7-0 — Mobil-refaktor** (`44c03d98` impl, merge `b2a8e8ee`).

`apps/mobile/app/timer/[id].tsx` redusert fra 2084 → 367 linjer. Logikk og UI flyttet ut til tre seksjonskomponenter:
- `apps/mobile/src/components/timer-detalj/TimerSeksjon.tsx` (799 lin) — `TimerRadVis` + `UnderprosjektEtikett` + `TimerRadModal` + `LonnsartVelgerModal` + `AktivitetVelgerModal` + `UnderprosjektVelgerModal`
- `apps/mobile/src/components/timer-detalj/TilleggSeksjon.tsx` (431 lin) — `TilleggRadVis` + `TilleggRadModal` + `TilleggVelgerModal`
- `apps/mobile/src/components/timer-detalj/MaskinSeksjon.tsx` (595 lin) — `MaskinRadVis` + `MaskinRadModal` + `EquipmentVelgerModal` + `EnhetVelgerModal`
- `apps/mobile/src/types/timer-detalj.ts` — 9 Drizzle-typer
- `apps/mobile/src/utils/dato.ts` — `formatNorskDato` + `formatTidspunkt`
- `apps/mobile/src/lib/enheter.ts` — `ENHETER`-konstant

Ingen funksjonalitetsendring. Hovedkomponenten bevarer SQLite-lesing, status-banners, send-til-attestering og slett-flyt. Lokal state i hver seksjon (modal-toggles + rediger-IDer). Mobil typecheck 12 = 12 (samme baseline, alle feil pre-eksisterende i klynge A-D). Forberedelse for T7-3. 7 filer, +1900/-1753.

**PR T7-1a — Arbeidstid + løpende summering** (`1b668cd9` impl, merge `b2a8e8ee`).

`apps/web/src/app/dashbord/[prosjektId]/timer/[id]/page.tsx`:
- Lese-vy: `<dl>`-grid splittet i to. Aktivitet/Beskrivelse i toppen (spann=2), ny seksjon med `<h3>` «Arbeidstid i dag» + underforklaring over startTid/sluttTid/pauseMin.
- Rediger-modal: tilsvarende boks med `<h3>`+beskrivelse rundt de tre arbeidstid-feltene.
- Ny utledet `arbeidstidTimer = (endAt − startAt) − pauseMin/60`. Null hvis start/slutt ikke er satt.
- Ny banner over Send-knappen som viser «X.XXt av Y.YYt registrert» med fargekoding: grønn når registrert ≥ arbeidstid, gul ellers, grå når arbeidstid ikke er satt.

3 nye i18n-nøkler nb+en (`timer.arbeidstidIDag`, `timer.arbeidstidIDagBeskrivelse`, `timer.summering` med `{{registrert}}`/`{{total}}`-placeholders), 13 språk auto-oversatt med placeholders bevart. Web typecheck 0 nye feil. 16 filer, +140/-43.

**PR T7-1b — Prosjekt-gruppert dagsseddel + geo-forslag** (`fcff04c1` impl, merge `908a57c1`).

URL-flytt fra prosjekt-bundet sti til firma-kontekst per T.7 URL-låsning. Sedler kan registreres fra flere prosjekter samme dag.

Nye sider:
- `apps/web/src/app/dashbord/timer/ny/page.tsx` — opprettelse med `ProsjektRadVelger` (lokal, ikke global toppbar-velger) + geo-forslag via `navigator.geolocation`. Haversine-avstand mot `Project.lat/lng`; prosjekt innen 500m forhåndsvelges og merkes «Foreslått basert på posisjon».
- `apps/web/src/app/dashbord/timer/[id]/page.tsx` — detalj med prosjekt-gruppert struktur (1547 lin). Hver gruppe har Timer-/Tillegg-/Maskin-rader for ett prosjekt. Modaler tar `projectId` fra gruppen. ECO-velger via `trpc.eksternKostObjekt.list({ projectId })`. «+ Legg til prosjekt» åpner velger med ledige prosjekter.

Nye komponenter:
- `apps/web/src/components/timer/ProsjektRadVelger.tsx` — søkbar dropdown
- `apps/web/src/components/timer/StatusBadge.tsx` — flyttet fra `[prosjektId]/timer/status-badge.tsx` for delt bruk; 3 import-stier oppdatert

Eldre sider erstattet med redirect-stubs (`apps/web/src/app/dashbord/[prosjektId]/timer/[id]/page.tsx` + `/ny/page.tsx`). 5 nye i18n-nøkler nb+en (`timer.leggTilProsjekt`, `timer.geoForslag`, `timer.ingenGeoForslag`, `timer.feil.ugyldigInput`, `timer.detalj.ingenProsjektGrupper`). Web typecheck 0 nye feil — TS2589 i tRPC-map løst via type-cast til flat `ProsjektRef[]` før `.map()` per CLAUDE.md-mønster. 23 filer, +2111/-1521.

**Bugfix T7-1b — «Åpne»-lenker peker til ny URL** (`8ab2e826`, merge `908a57c1`).

T7-1b ga `/dashbord/undefined/timer/...` i to lister fordi `rad.projectId` på sedel-nivå ble undefined etter T.1. Fix på `apps/web/src/app/dashbord/timer/mine/page.tsx` + `apps/web/src/app/dashbord/[prosjektId]/timer/page.tsx`: begge lenker peker nå direkte til `/dashbord/timer/${rad.id}`. 2 linjer endret.

**PR T7-2a — Firma-admin attestering-liste** (`b043d944` impl, merge `f3dbf08b`).

Firma-admin (eller sitedoc_admin) kan nå se alle innsendte dagssedler i firmaet sitt fra én liste, uavhengig av hvilket prosjekt sedlene er knyttet til. Attestering/retur fortsatt per-sedel (samme atomisk batch som dagens flyt) — per-rad-attestering kommer i PR T7-2b.

Server (`apps/api/src/routes/timer/dagsseddel.ts`):
- Ny query `timer.dagsseddel.hentTilAttesteringFirma({organizationId})` gates med `autoriserAdminForFirma`. Henter sedler med `status="sent"` hvor minst én timer-rad har `projectId` i firmaets prosjekter (`ProjectOrganization`-join). Beriker med ansatt + prosjekt-info.
- Ny query `kanAttestereFirma({organizationId})` for sidebar-gating.
- Eksisterende `attester`/`returner`-mutations gjenbrukes uendret.

Klient:
- Ny side `apps/web/src/app/dashbord/firma/timer/attestering/page.tsx` — tabell med kolonner dato/ansatt/prosjekt/aktivitet/timer/rader/handlinger. «Åpne»-lenke peker fortsatt til prosjekt-bundet detalj-side (`/dashbord/[projectId]/timer/attestering/[id]`).
- `apps/web/src/app/dashbord/firma/timer/layout.tsx` utvidet med ny fane «Attestering».
- `ReturnerDialog` dupliseres fra prosjekt-versjon (samme mutation, ulik cache-invalidering).

3 nye i18n-nøkler nb+en (`firma.timer.fane.attestering`, `firma.timer.attestering`, `firma.timer.attesteringBeskrivelse`). 13 språk auto-oversatt. API+web typecheck 0 nye feil. 18 filer, +394/-1.

**Fix T7-2a — Informativ tom-state istedenfor evig spinner** (`55b6c398`, merge `f3dbf08b`).

`apps/web/src/app/dashbord/firma/timer/attestering/page.tsx`: splittet `if (!orgId || tilgangLaster)` til to separate sjekker. `!orgId` viser amber-banner med peker til toppmeny istedenfor evig Spinner. Ny i18n-nøkkel `firma.timer.attesteringIngenFirma` (nb+en + 13 språk). 16 filer, +25/-1.

**Verifisering alle deploys 2026-05-12:** HTTP/2 200 mot `sitedoc.no` etter hver deploy. PM2 `sitedoc-web` (id 47) + `sitedoc-api` (id 39) restartet etter hver merge — restart-tellere gikk fra 47 til 50 i løpet av dagen. Visuell QA gjennomført av Kenneth på test før hver prod-deploy.

**Stale `.next`-cache-problem (deploy-pipeline-svakhet):** Auto-deploy-hooken trigger `pm2 reload` FØR `pnpm build` er ferdig, som gir gjentatte «Could not find a production build in the '.next' directory»-feil i PM2-error-loggen, og en stale cache som gir client-side exception. Oppdaget to ganger denne dagen (etter T7-1b og T7-2a deploys). Løst med manuell `rm -rf apps/web/.next + pnpm build + pm2 restart` på test. Roårsak er deploy-pipeline-svakhet (auto-hook ikke synkronisert med build), ikke kodefeil. Separat oppfølgings-oppgave.

### Forventede begrensninger i T7-2a — kommer i T7-2b

- «Åpne»-detaljvisning fra firma-attestering-liste bruker eksisterende prosjekt-bundet detalj-side. Firma-admin uten prosjekt-medlemskap på det aktuelle prosjektet får «Prosjektet ble ikke funnet» fra `[prosjektId]/layout.tsx`. ProjectId-løs felleskomponent kommer i T7-2b.
- Attestering er fortsatt per-sedel (ikke per-rad). T.3 Alt A (sedel = container uten egen attesterings-status) implementeres i T7-2b.
- Sedler som spenner flere prosjekter viser kun første prosjekts navn i firma-listen.

### T.7-fremdrift

| PR | Status |
|---|---|
| **PR T7-0** Mobil-refaktor | 🟢 Deployet prod 2026-05-12 (`44c03d98` / merge `b2a8e8ee`) |
| **PR T7-1a** Arbeidstid + summering | 🟢 Deployet prod 2026-05-12 (`1b668cd9` / merge `b2a8e8ee`) |
| **PR T7-1b** Prosjekt-gruppert + geo | 🟢 Deployet prod 2026-05-12 (`fcff04c1` + bugfix `8ab2e826` / merge `908a57c1`) |
| **PR T7-2a** Firma-attestering-liste | 🟢 Deployet prod 2026-05-12 (`b043d944` + fix `55b6c398` / merge `f3dbf08b`) |
| PR T7-2b | 🔴 Ikke startet — per-rad-attestering + projectId-løs felleskomponent + splitting + redigering ved attestering |
| PR T7-3 | 🔴 Ikke startet — mobil dagsseddel-redesign (etter T7-0-refaktor er ferdig) |

---

**Albansk (sq) lagt til + alle 14 eksisterende språk fullført IMPLEMENTERT på develop 2026-05-08.** Sitedoc støtter nå 15 språk. `sq.json` opprettet med 2145 nøkler (visningsnavn «Shqip», flagg 🇦🇱). Som sidegevinst fylte `generate.ts` ut alle manglende nøkler i de 6 språkene på 974-baseline (cs/de/et/fi/fr/ro) og 8 språkene på 2130-baseline — alle 14 eksisterende språk er nå på 2145-nøkler-baseline. Ingen batch-feil for sq, men 4 språk (ro/et/cs/de) fikk én 50-nøkler-batch til engelsk fallback som må re-oversettes ved senere kjøring. 7138 nye/oppdaterte oversettelser totalt. Web typecheck + build grønt, mobil 12 = 12. Native-speaker-QA anbefalt for sq, cs, de, et, fi.

---

**Rename `kontakter` → `dokumentflyt` DEPLOYET TIL PROD 2026-05-09** (`4919befc` refactor + `27232541` i18n-verdier + `01e51bcd` deploy.sh-fix). HTTP/2 200 mot sitedoc.no. Lukker semantisk drift: ruta het `kontakter` mens UI allerede sa «Dokumentflyt» (verdiene `oppsett.kontakter` og `kontakter.tittel` var begge «Dokumentflyt» i nb). Nå er alt konsistent. Route flyttet, gammel sti bevart som server-side redirect-stub. 502 i18n-nøkler restrukturert via Node-skript over 14 språkfiler. Web-grep `kontakter` redusert fra 55 → 15 (kun variabelnavn + semantisk korrekte nøkler igjen), i18n fra 536 → 24, mobil fra 1 → 0. `pnpm --filter @sitedoc/web typecheck` + `pnpm build --filter @sitedoc/web` grønt på 54.6s. Mobil typecheck 12 = 12 (ingen nye feil).

---

**Sjekkliste opprett-modal + mobil rettighet DEPLOYET TIL PROD 2026-05-09** (`4e29c88a`). HTTP/2 200 mot sitedoc.no. To bugs i én PR.

**Bug 1 — Web sjekkliste opprett-modal:** Klikk på mal gjorde ingenting når brukeren ikke var medlem av noen faggruppe (sitedoc_admin / company_admin uten faggruppe-tilknytning). `handleOpprettFraMal` returnerte stille på `if (!oppretter) return`. Fix i `apps/web/src/app/dashbord/[prosjektId]/sjekklister/page.tsx`: fallback-kjede henter `bestillerFaggruppeId` fra dokumentflytens `oppretter`-medlem når `mineFaggrupper` er tom; synlig feilmelding i Modal hvis ingen kandidat finnes. Ny `opprettFeil`-state, `onError`-handler i `opprettMutation`. Server-side `verifiserFaggruppeTilhorighet` har admin-bypass for sitedoc_admin og ProjectMember.role="admin".

**Bug 2 — Mobil sjekkliste read-only:** Sjekkliste i status `"sent"` ble read-only på mobil selv om mottakeren burde hatt redigeringsrett. `useSjekklisteSkjema(id!)` ble kalt uten `rettighetInput`, så hooken falt tilbake til forenklet status-sjekk. Fix i `apps/mobile/app/sjekkliste/[id].tsx`: speiler web-rettighetsberegningen — ny `trpc.gruppe.hentMineTillatelser`-query, useMemo-blokker for `harBallen`/`flytRettighet`/`rettighetInput` (`minRolle` fantes allerede), hook-kall endret til `useSjekklisteSkjema(id!, rettighetInput)`. Ingen endringer i hooken selv.

**i18n:** 1 ny nøkkel `sjekklister.feil.ingenFaggruppe` i nb+en. **Filer:** 4 endret (1 web, 1 mobil, 2 i18n), 0 server, 0 migrasjon. `pnpm --filter @sitedoc/web typecheck` grønt (kun pre-eksisterende vitest-feil i unrelated test). `pnpm build --filter @sitedoc/web` grønt på 36.4s. Mobil typecheck: 12 = 12 (ingen nye feil).

**Oppfølger (egen runde):** `apps/mobile/app/oppgave/[id].tsx` har sannsynligvis identisk Bug 2 — `useOppgaveSkjema(id!)` kalles uten `rettighetInput`. Fikses etter at sjekkliste-fixen er verifisert på test.

---

**EAS Build iOS produksjon godkjent av Apple — TestFlight aktiv 2026-05-08.** Build 1.0.0 (19) er ferdig prosessert i App Store Connect og distribuert til intern testing-gruppe «Team (Expo)». Brukere i gruppen kan nå installere via TestFlight-appen på iPhone.

**Funksjonalitet aktivert i build:**
- **Hvem-har-ballen-badge** på `apps/mobile/app/oppgave/[id].tsx` + `apps/mobile/app/sjekkliste/[id].tsx` — speilet fra web (`2e32b867`). Amber `<View>` med `recipientGroup.name` ved status sent/received/in_progress.
- **Runde 2.5/C9** — aktivitet flyttet fra `DailySheet`-nivå til `SheetTimer.aktivitetId` (per rad), `sheet_machines`-tabell, `ECO.proAdmType`-fritekst.
- **Runde 2.6** — mobil-cache for maskinregister via `apps/mobile/src/services/maskinKatalog.ts` + `EquipmentVelger`-komponent.
- **Runde 2.7** — Mine timer-rapport på mobil med `DagstotalBanner` + `UkeTotalBanner` + ukesoppsummering.
- **Pensjonert→utgått-rename** — terminologi-konsistens mellom web og mobil.
- **Hvem-har-ballen-badge i18n** — alle 14 språk har nå `tabell.venterPaa` (cs/de/et/fi/fr/lt/lv/pl/ro/ru/sv/uk lagt til 2026-05-07).

**Forutsetninger som var live på server før build:**
- `oppgave.hentMedId` + `sjekkliste.hentMedId` returnerer `recipientGroup` (deployet `2e32b867` 2026-05-05)
- Timer Runde 2.5/2.6/2.7 server-side klar (deployet 2026-05-02)

**Distribusjons-detaljer:**
- Build-hash på develop ved EAS-tidspunkt: `7921f59b` (commit `feat: hvem-har-ballen-badge mobil + i18n-fix 12 språk`)
- App Store Connect URL: https://appstoreconnect.apple.com/apps/6760205962/testflight/ios
- Expo-projektet: `kemyrhau/sitedoc`
- Submission ID: `126c444d-38bf-491e-bd8a-eb86d952c31a`

**Ikke i build (utsatt til neste mobil-runde):**
- 12 pre-eksisterende mobil typecheck-feil (klynge A: moduleSlug, klynge B: erstattVedlegg-interface, klynge C: null-handling, klynge D: Drizzle-typer) — TS-tids-feil, ikke runtime-feil. Metro/Hermes stripper typer.
- Leder-attestering på mobil (utsatt fra Runde 2 MVP) — krever ECO-flytt-funksjon (Steg 4a er live på web)
- Vareforbruk på mobil (Steg 4b.5) — krever offline-sync og dagsseddel-integrasjon

**Verifisering på fysisk enhet (Kenneth-oppgave):** Installer build via TestFlight, åpne sjekkliste/oppgave-detalj med innsendt status, verifiser at amber-badge «Venter på: [gruppenavn]» vises korrekt under StatusMerkelapp.

**Gjenstår:**
- 🔄 Mobil typecheck klynge B — `erstattVedlegg`-interface (utsatt til etter TestFlight-verifisering)
- 🔄 i18n: cs, de, et, fi, fr, ro gjenstår (gjøres ved behov)
- 🔄 HW-vifte Equipment — manuelt i `/dashbord/maskin` på A.Markussen

---

**Fullstendig i18n-oversettelse uk/ru/pl/lt/lv/sv DEPLOYET TIL PROD 2026-05-08** (`720a23dc` merge). HTTP/2 200 mot sitedoc.no.

**Bakgrunn — i18n-audit 2026-05-08:**
| Språk | Nøkler før | Nøkler etter |
|---|---:|---:|
| nb (kilde) | 2129 | 2129 |
| en | 2132 | 2132 (uendret) |
| **uk, ru, pl, lt, lv, sv** | 972 hver | **2129 hver** |
| cs, de, et, fi, fr, ro | 972 | 972 (uendret) |

Audit avdekket at alle 12 ikke-nb/en-språk var frosset på en historisk baseline med 972 nøkler, mens nb/en hadde vokst til 2129 (54 % drift). Web-siden viste klartekst-nøkkelen («firma.timer.tittel» osv.) som UI-tekst for alle ikke-norske/engelske brukere på post-baseline-funksjoner.

**Prioritering — 6 språk valgt etter byggebransje-relevans i Norge:**
1. **uk (ukrainsk)** — `c4b6f6aa`
2. **ru (russisk)** — `b774b1de` (russisk-talende ukrainere + andre)
3. **pl (polsk)** — `4ddff556` (størst østeuropeisk gruppe i norsk bygg)
4. **lt (litauisk)** — `4c0b8be8`
5. **lv (latvisk)** — `e952c166`
6. **sv (svensk)** — `827e83ea` (naboland)

**Metode:**
- Eksisterende `packages/shared/src/i18n/generate.ts` brukt som mal
- Patchet til ett språk per kjøring via `SPRAAK`-env-variabel (atomic commits)
- Kilde: `en.json` (mer presis enn nb for fagtermer per CLAUDE.md i18n-policy)
- `google-translate-api-x` (gratis, ingen API-nøkkel) i batcher à 50 med 1.5s pause for rate-limiting
- Per kjøring: 1157 manglende nøkler oversatt → 2129 totalt

**Resultat:**
- 6 atomiske commits (én per språk) på develop
- Merge-commit `720a23dc` til main
- **6 942 nye oversettelser** (1157 × 6)
- Alle 6 JSON-filer validert med `python3 -c "import json; json.load(...)"`
- `+7000/-18` linjer i merge

**Build:** `pnpm build --filter @sitedoc/web` 1m7s på prod-server. `pm2 reload --update-env` reloadet sitedoc-web (47) + sitedoc-api (39). Ingen DB-migrasjon, ingen schema-endring.

**Kvalitetsforbehold:** Google Translate er LLM-kvalitet, ikke profesjonelle oversettelser. Fagtermer (Lønnsart, Faggruppe, Dokumentflyt, Attestering, ECO, etc.) bør verifiseres av native-speakers ved senere språkrunde. For UI-strenger uten fagtermer er Google Translate-kvaliteten generelt god nok for funksjonell forståelse.

**Gjenstår ved behov:** cs, de, et, fi, fr, ro (alle på 972-baseline). Samme metode kan gjentas ved behov — én kommando per språk:
```bash
SPRAAK=cs pnpm exec tsx src/i18n/generate-ett-sprak.ts
```

**Vurdering for fremtid:** Avgjør om disse 6 språkene faktisk brukes av kunder. Hvis ingen — fjern fra build for å redusere bundle-størrelse. Hvis ja — kjør oversettelse på samme måte.

---

**i18n-fix 12 språk + hvem-har-ballen-badge mobil DEPLOYET TIL PROD 2026-05-07** (`4ff352a7` merge, `7921f59b` impl). HTTP/2 200 mot sitedoc.no.

**To uavhengige fix bundlet i én commit:**

**(1) i18n-drift på 12 språk:**
Drift identifisert under mobil-analyse 2026-05-07: `tabell.venterPaa` (brukt av hvem-har-ballen-badge på sjekkliste/oppgave-detalj) + `dashbord.venterPaaTilgangTittel`/`Beskrivelse` (tilgangs-tom-state) fantes kun på `nb.json` + `en.json`. Web-versjon ble deployet 2026-05-05 (`2e32b867`) — siden da har ikke-norske/engelske brukere sett klartekst-nøkkelen «tabell.venterPaa» som badge-tekst, ikke oversatt streng.

**Endring:** Python-script la til 3 nøkler i 12 språkfiler (cs, de, et, fi, fr, lt, lv, pl, ro, ru, sv, uk) med kontekstuelle LLM-oversettelser. Eksempel:
- cs: «Čeká na»
- de: «Wartet auf»
- fr: «En attente de»
- pl: «Oczekuje na»
- ru: «Ожидает»
- sv: «Väntar på»

Native-speaker-bekreftelse ønskes ved senere språkrunde.

**(2) Hvem-har-ballen-badge på mobil:**
Speilet fra web `2e32b867` til mobil. Endret 2 filer (`apps/mobile/app/oppgave/[id].tsx` + `apps/mobile/app/sjekkliste/[id].tsx`) med IIFE-pattern som rendrer amber `<View>` med `recipientGroup.name` ved status sent/received/in_progress. Bruker eksisterende cast-mønster fra FlytIndikator (`(detalj as { recipientGroup?: ... } | undefined)?.recipientGroup`).

**Server-respons uendret:** `oppgave.hentMedId` (linje 133) + `sjekkliste.hentMedId` (linje 84) returnerer allerede `recipientGroup: { id, name }` — feltet ble lagt til av `2e32b867` og brukes på web. Mobil utnytter samme respons.

**Type-status:**
- Web build grønt (29.2s lokalt + 1m9s prod)
- Web typecheck: 1 pre-eksisterende feil (`vitest`-modul-mangling i test-fil) — ikke fra denne commit
- Mobil typecheck: 12 pre-eksisterende feil klassifisert som kjent teknisk gjeld:
  - Klynge A (4 feil) — `moduleSlug` type-mismatch i `hjem.tsx` (Steg 1e-rename)
  - Klynge B (4 feil) — `erstattVedlegg` mangler i `UseOppgaveSkjemaResultat`/`UseSjekklisteSkjemaResultat`-interface
  - Klynge C (2 feil) — null-handling i `mer.tsx` + `psi/[psiId].tsx`
  - Klynge D (2 feil) — Drizzle-typer i `timerSync.ts`
  - Mine endringer er ikke i feillisten. Alle 12 er TS-tidsfeil, ikke runtime-feil — Metro/Hermes stripper typer ved bygg. App fungerer på prod nå med disse feilene. Egen «mobil typecheck cleanup»-runde planlagt etter EAS Build.

**Mobil ikke aktiv før EAS Build:** Server + web er deployet til prod. Mobil-koden venter på `eas build --platform ios --profile production` (Kenneth-oppgave parallellt med dokumentasjon). Build-tid ~15-30 min. Etter `eas submit` lander build-en i App Store Connect → TestFlight intern testing.

**Endrede filer:** 14 (12 i18n-JSON + 2 mobil-tsx), `+72/-12`. Ingen DB-migrasjon.

---

**Rolle-dropdown outside-click-fix DEPLOYET TIL PROD 2026-05-07** (`9e264bfa` merge, `6ee229a3` impl). HTTP/2 200 mot sitedoc.no.

**Bug:** Rolle-dropdown på `/dashbord/firma/brukere` lukket seg umiddelbart når brukeren klikket pillen. Outside-click-handler på document brukte `mousedown` som fires FØR React's onClick — i sekvensen [mousedown → click] kjørte handler-en før setState rakk å åpne menyen, og påfølgende klikk på dropdown-elementene fungerte ikke konsistent.

**Fix:** Bytt document-listener fra `mousedown` til `click` (linje 35-36 i `apps/web/src/app/dashbord/firma/brukere/page.tsx`). Click fires ETTER React's onClick, så React-state oppdateres først og dropdown rendres før outside-click-evaluering kjører. 2 linjer endret (`addEventListener` + `removeEventListener`).

**Server-tilgang allerede korrekt:** `organisasjon.endreRolle` bruker `verifiserFirmaAdmin` som godtar både `sitedoc_admin` (alle firmaer) og `company_admin` (eget firma). Ingen server-endring nødvendig — fix-en var ren UI-bug.

**Sideprodukt — Florians rolle satt via SQL:** Før fixen ble deployet ble Florian Aschwanden (`8e3c7f17-9880-425d-8e6f-41ba437c9047` på A.Markussen `4488fe17-...`) satt til `company_admin` direkte i prod-DB via SQL UPDATE siden UI var blokkert. Verifisert via RETURNING-clause.

**Test-verifisering før prod-deploy:** Kenneth bekreftet på test.sitedoc.no at dropdown åpner seg og forblir åpen, og at company_admin (Florian) kan endre roller for andre brukere i eget firma.

**Build:** `pnpm build --filter @sitedoc/web` 28.2s lokalt + 1m1s på prod-server. `pm2 reload ecosystem.config.js --update-env` reloadet sitedoc-web (47) + sitedoc-api (39).

---

**«Velg fra firma»-flyt DEPLOYET TIL PROD 2026-05-07** (`f27a63dc` merge). HTTP/2 200 mot sitedoc.no. Lukker arkitekturhull i prosjektmedlems-tilføyelse: tidligere ingen UI-vei for å legge til en eksisterende firma-bruker uten å skrive e-posten manuelt.

**Komponenter:**
- `packages/shared/src/validation/index.ts` — nytt `addExistingMemberSchema` (projectId, userId, role, faggruppeIder)
- `apps/api/src/routes/medlem.ts` — 2 nye prosedyrer:
  - `hentLedigeFirmaBrukere({ projectId })` — User-liste filtrert på `primaryOrganizationId === project.primaryOrganizationId` + `canLogin=true` + `id NOT IN existing ProjectMember`
  - `leggTilEksisterende({ projectId, userId, role, faggruppeIder })` — verifiserer same-firma + canLogin, oppretter ProjectMember direkte (ingen e-post). Idempotent: CONFLICT hvis allerede medlem.
- `apps/web/src/app/dashbord/oppsett/brukere/page.tsx` — fane-toggle på «Legg til bruker»-skjemaet:
  - **«Velg fra firma»** (default): dropdown av ledige firma-brukere → klikk «Legg til» kaller `leggTilEksisterende`
  - **«Inviter ny e-post»**: eksisterende invitasjons-skjema uendret
  - Tom-state: «Alle firma-brukere er allerede medlem» når listen er tom
- 6 nye i18n-nøkler nb+en (`brukere.fane.fraFirma`, `brukere.fane.nyEpost`, `brukere.velgFirmaBruker`, `brukere.ingenLedigeFirmaBrukere`, `brukere.leggTil` + endring av `brukere.inviterNy` til «Legg til bruker»)

**Sikkerhet:**
- `leggTilEksisterende` håndhever `user.organizationId === project.primaryOrganizationId` — kan ikke legge til brukere fra andre firmaer
- Avviser deaktiverte brukere (canLogin=false)
- Idempotent: avviser hvis allerede medlem (CONFLICT)
- Gates med `verifiserAdminEllerFirmaansvarlig` (samme som eksisterende `medlem.leggTil`)

`pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (1m18s) grønt på prod-deploy.

---

**Modul-piller i admin/firmaer + Varelager-bug DEPLOYET TIL PROD 2026-05-07** (`620a85c7` merge). HTTP/2 200 mot sitedoc.no.

**Endringer i `apps/web/src/app/dashbord/admin/firmaer/page.tsx`:**
- Ny delt `ModulPiller`-komponent rendrer alle 3 firmamoduler som piller med ikon (Clock/Truck/Package). Aktiv = grønn (bg-green-50, ring), inaktiv = grå (bg-gray-50). To størrelser: `xs` (tabell) og `sm` (slide-over).
- Tabell: Timer + Maskin-kolonner kombinert til én «Moduler»-kolonne. Skalerbar når flere moduler kommer.
- Slide-over: én «Firmamoduler»-seksjon erstatter de to separate Timer-modul + Maskin-modul-kortene. Hint-tekst om `/dashbord/firma/moduler` beholdt nederst.
- **Bug-fix:** Varelager-modul vises nå korrekt — manglet helt i admin-vyen før.

**Skalerbarhet:** Neste modul (kompetanse, fremdrift, planlegger) er én linje i `FIRMAMODULER`-arrayet:
```ts
const FIRMAMODULER = [
  { slug: "timer", label: "Timer", ikon: Clock },
  { slug: "maskin", label: "Maskin", ikon: Truck },
  { slug: "varelager", label: "Varelager", ikon: Package },
] as const;
```

---

**Admin-impersonering DEPLOYET TIL PROD 2026-05-07** (`a3765a97` merge). HTTP/2 200 mot sitedoc.no. Migrasjon `20260507000001_session_impersonering` applied til prod-DB (verifisert via `\d sessions` — `impersonated_user_id`, `original_user_id`, `impersonation_expires_at` på plass). Test-verifisert: Kenneth (sitedoc_admin) klikket «Imperser» på Kari Firmaadmin → gul banner «Du imperserer Kari (Byggeleder)» + admin-meny forsvant + firma-velger viste kun Byggeleder. Stopp-knapp brakte admin-UI tilbake.

**Deploy-prosedyre:**
- Merge `a3765a97` (develop → main)
- `pnpm install --frozen-lockfile` på prod-server (sikrer node_modules)
- `prisma generate` (regenererer klient med nye Session-felter)
- `prisma migrate deploy` (applied `20260507000001_session_impersonering`)
- `pnpm build --filter @sitedoc/web` (1m12s)
- `pm2 reload ecosystem.config.js --update-env`

**Lærdom (dokumenteres i deploy-detaljer.md ved behov):** Første test-runde feilet med UNAUTHORIZED — cookie-lesing brukte Fastify-style `req.headers.cookie`, men tRPC-mutations kjører i Next.js-web-prosessen der `req` er fetch-Request (Web API Headers krever `headers.get("cookie")`). Fix (`910437e3`): eksponer pre-parsed `sessionToken` direkte i tRPC-context. tRPC-handlers som leser cookies må aldri anta Fastify-spesifikt format — bruk ctx-eksponerte verdier istedenfor å re-parse.

**Audit-log MVP:** `console.log` start/stopp i admin-router. Per-mutation logging utsatt til senere PR (krever Activity-tabell-utvidelse med `actorId` + `subjectId`).

---

**Impersonering («view as user») IMPLEMENTERT på develop 2026-05-07.** SaaS-admin-funksjon: sitedoc_admin kan logge inn som hvilken som helst ikke-admin-bruker. Augmented-session-mønster — `Session.impersonatedUserId/originalUserId/impersonationExpiresAt` settes på admin sin egen session-rad. tRPC-context bruker `impersonatedUserId` som effektiv `userId` for autorisering; `actualUserId` bevarer admin for audit.

**Komponenter:**
- Migrasjon `20260507000001_session_impersonering` — 3 nullable-kolonner + indeks
- `apps/api/src/trpc/context.ts` — `actualUserId` + `imperseringAktiv`-flagg
- `apps/web/src/app/api/trpc/[...trpc]/route.ts` — samme logikk i Next.js-route
- `apps/api/src/routes/admin.ts` — 3 nye prosedyrer (`hentImpersoneringStatus`, `startImpersonering`, `stoppImpersonering`)
- `apps/web/src/components/layout/ImpersoneringBanner.tsx` — global gul banner
- `apps/web/src/app/dashbord/layout.tsx` — banner mountet rett under Toppbar
- `apps/web/src/app/dashbord/admin/firmaer/page.tsx` — `ImperserKnapp` per bruker-rad i slide-over

**Sikkerhetsregler:**
- Kun `sitedoc_admin` kan starte (verifisert via `actualUserId`)
- Forbudt: impersonere annen `sitedoc_admin`, seg selv, eller deaktivert bruker
- Auto-utløp 1t — `impersonationExpiresAt > now`-sjekk i context
- Banner alltid synlig på alle dashbord-sider

**Audit-logging (MVP):** `console.log` med actor + target ved start og stopp. Detaljert per-mutation logging utsatt til senere PR.

4 nye i18n-nøkler nb+en (`impersonering.banner.*`). 1 ny migrasjon, 2 nye komponenter, 5 modifiserte filer. `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (31.0s) grønt. Klar for test-deploy.

---

**HovedSidebar skjult i firma-kontekst + Tilbake-lenke DEPLOYET TIL PROD 2026-05-06** (`8a184fc8` merge). HTTP/2 200 mot sitedoc.no.

**Endringer:**
- `apps/web/src/app/dashbord/layout.tsx` — gjort til client-komponent med `usePathname()`. Betingelses-rendring: `{!erFirmaKontekst && <HovedSidebar />}` der `erFirmaKontekst = pathname?.startsWith("/dashbord/firma") ?? false`.
- `apps/web/src/app/dashbord/firma/layout.tsx` — ny «← Tilbake til dashbord»-lenke (ArrowLeft-ikon) plassert øverst i sidebar-header-blokken (over firmanavnet). Peker til `/dashbord` og bringer HovedSidebar tilbake siden URL ikke lenger starter med `/dashbord/firma`. Bredden på firma-sidebar uendret (280px).

**UX-effekt:** I firma-administrasjon hadde brukeren tidligere både HovedSidebar (60-200px) + firma-sidebar (280px) stablet ved siden av hverandre, som spiste 480px-skjermbredde uten ekstra verdi. Nå tar firma-sidebar full sidebar-rolle, og «Tilbake»-lenken gir en eksplisitt vei ut av firma-konteksten.

**Build (1m1s) + pm2 reload --update-env** grønt på prod. HTTP/2 200 verifisert.

---

**Fakturering-gating + U5-forkasting DEPLOYET TIL PROD 2026-05-06** (`207a223c` merge). To små endringer bundlet i én deploy: (1) Fakturering-menyelement i firma-sidebar skjult for `company_admin`, (2) UX-agenda U5 lukket som forkastet. HTTP/2 200 mot sitedoc.no.

**Endring 1 — Fakturering-gating** (`apps/web/src/app/dashbord/firma/layout.tsx`):
- `NavElement`-typen utvidet med `kreverSitedocAdmin?: boolean`
- `Fakturering`-elementet får `kreverSitedocAdmin: true`
- Render-filter: `if (element.kreverSitedocAdmin && !erSitedocAdmin) return false;`
- `erSitedocAdmin` allerede destructured fra `useFirma()` på linje 88

**Endring 2 — U5 forkastet** (`docs/claude/ux-arkitektur-agenda.md`):
- Status `[MANGLER]` → `[FORKASTET 2026-05-06]`
- Begrunnelse: byggeplass-data (geofence, GPS, mannskaps-innsjekk, §15-liste) er prosjekt-bundne. Selvstendig firma-byggeplass ville blitt orphan-rad uten formål. Dagens prosjekt-bundne flyt er korrekt design.

**Lærdom om første forsøk:** Cherry-picket samme commit (`77939c63` → `eabd34d7`) etter en mislykket første test-deploy som ga «Application error» i nettleser. Krasjen viste seg å være deploy-race-condition (HTML/JS-bundle-mismatch under PM2 reload mens browser hadde cached stale assets), ikke logikk-feil i koden. Verifisert ved at hard reload etter deploy var ferdig fungerte uten problem. Diff-en var minimalt invasiv (3 linjer, semantisk trygge), så root-cause-analysen pekte på deploy-overgang som mest sannsynlig årsak. Ingen kode-endring var nødvendig ved andre forsøk — bare ventet til build var bekreftet ferdig før test.

**UX-agenda — endelig status etter denne deployen:**
- ✅ B1 toppbar prosjektvelger Alle/Mine — DEPLOYET (`2f22c503`)
- ✅ B2 onboarding-checkpoint-bar utvidelse — DEPLOYET (`da00d55d`)
- ✅ B3 modul-fargedesign — DEPLOYET (`c2da3135`)
- ✅ U1 leder-timer-rapport — DEPLOYET (`c551063f`)
- ✅ U2 CSV/Excel-eksport — DEPLOYET (`31cff7da`)
- ✅ U3 sidebar tekst-labels — DEPLOYET (`c2da3135`)
- (U4 erstattet av B3)
- ✅ U5 byggeplass selvstendig flyt — FORKASTET (`207a223c`)
- ✅ U6 maskin sitedoc_admin firma-kontekst — DEPLOYET (`3dd4371b`)
- ✅ U7 fritekst utstyrstype — DEPLOYET (`1781a17a`)

UX-agenda er nå komplett lukket. Ingen åpne UX-tråder igjen.

---

**Integrasjonsadmin (AES-256-GCM-kryptering) + Brreg-autofyll DEPLOYET TIL PROD 2026-05-06** (`878e90ec` merge — bringer kryptering-PR `63b50816` + Brreg-PR `e3b8fd5c` + dok-oppdateringer). To uavhengige PR-er bundlet i én prod-deploy etter test-verifisering av begge.

**Pre-deploy:** `SITEDOC_INTEGRATION_KEY` (64 hex-tegn, generert med `openssl rand -hex 32` direkte på prod-server uten å eksponere verdi i chat) lagt til i begge prod-blokker (`sitedoc-web` + `sitedoc-api`) i `~/programmering/sitedoc/ecosystem.config.js`. Idempotent sed-kommando matchet `VEGVESEN_API_KEY`-linja og satte inn etter — fungerte på første forsøk siden lærdom fra test-deploy var dokumentert i [deploy-detaljer.md](deploy-detaljer.md).

**Deploy-trinn:** `git checkout main && git merge --no-ff develop && git push origin main` → `ssh sitedoc git fetch && git reset --hard origin/main && pnpm build --filter @sitedoc/web` (1m15s) → `pm2 reload ecosystem.config.js --update-env` (reload, ikke restart — bevarer ecosystem-binding og leser oppdatert env). Verifisering: HTTP/2 200 mot sitedoc.no + `/proc/PID/environ` på begge prosesser bekrefter SITEDOC_INTEGRATION_KEY satt med 64 tegn.

**Funksjonell status på prod:**
- AES-256-GCM-kryptering aktiv på `OrganizationIntegration.apiKey` (eksisterende admin-CRUD krypterer ved opprett/oppdater, returnerer aldri klartekst, dekrypterer ikke automatisk i admin-vy — `harNøkkel: boolean` er den eksponerte tilstanden).
- `/dashbord/admin/integrasjoner` — sitedoc_admin platform-status: Vegvesen + krypteringsnøkkel-status (read-only via `process.env`-sjekk).
- `/dashbord/firma/innstillinger/integrasjoner` — firma-admin-side. Type-whitelist tom i firma-integrasjons-router; «ingen aktive integrasjoner»-melding vises. Klar for Reginn-PR senere.
- `/dashbord/firma/innstillinger` — Brreg-knapp ved orgnr-felt autofyller navn + fakturaadresse fra `data.brreg.no`. Modulus-11-validering server-side (vekter 3,2,7,6,5,4,3,2 + kontroll). 8s-timeout via AbortController. Kodede feiltyper (UGYLDIG_ORGNR/IKKE_FUNNET/TIMEOUT/NETTVERK/UKJENT) mappet til tRPC-koder.
- `/dashbord/admin/firmaer` opprett-modal — Brreg-knapp autofyller navn (modal har ikke adressefelt).
- `INTEGRASJON_TYPER` i admin/firmaer-side utvidet med `reginn` (label «Reginn MREG»). Forberedelse for når Reginn-API er klart.

**Test-verifisering før prod-deploy 2026-05-07:** Brreg-oppslag mot orgnr `974760673` (Brønnøysundregistrene selv) returnerte «REGISTERENHETEN I BRØNNØYSUND», adresse «Havnegata 48, 8900 BRØNNØYSUND» — autofyll fungerte korrekt.

**Test-rens utført 2026-05-07:** Gammel klartekst-rad `c9a86fa4-...` (proadm testdata på Byggeleder) slettet via SQL før kryptering ble aktivert. Prod hadde 0 rader så ingen migrering der. Test-nøkkelen `1dcd...4fe4` (eksponert i chat-logg under feilsøking) **bør roteres** — Kenneth-oppgave.

**Lærdom dokumentert i [deploy-detaljer.md](deploy-detaljer.md):** SITEDOC_INTEGRATION_KEY må stå i BÅDE web- og api-ecosystem-blokker fordi tRPC-mutations kjører i Next.js-web-prosessen (ikke Fastify-api). Test-deploy 2026-05-07 feilet 1+ time fordi nøkkelen kun lå i api-blokken; ble løst ved å duplisere i web-blokken. Prod-deploy fulgte ny prosedyre på første forsøk uten feil.

---

**Brreg-autofyll IMPLEMENTERT på develop 2026-05-07.** Firma-oppslag på orgnr mot Brønnøysund Enhetsregisteret (`data.brreg.no`). Autofyll-knapp på `/dashbord/firma/innstillinger` og `/dashbord/admin/firmaer`-opprett-modal. Type-whitelist `sentralregisteret` renamet til `reginn` (clean slate — feilaktig kategorisering av forrige PR rettet opp). UI-tile for `sentralregisteret` fjernet fra `/dashbord/firma/innstillinger/integrasjoner`.

**Komponenter:**
- `apps/api/src/services/brreg.ts` — ny service med `hentFirmaFraBrreg` + `erGyldigOrgnr` (Modulus-11). 8s-timeout, kodede feiltyper.
- `apps/api/src/routes/organisasjon.ts` — ny `hentFraBrreg`-procedure (protectedProcedure).
- `apps/api/src/routes/admin.ts` — type-whitelist `sentralregisteret` → `reginn`.
- `apps/api/src/routes/firma-integrasjon.ts` — `FIRMA_TYPER` blir tom liste; routerstruktur beholdes for senere Reginn-PR.
- `apps/web/src/app/dashbord/firma/innstillinger/page.tsx` — Brreg-knapp ved orgnr-felt, autofyller navn + fakturaadresse.
- `apps/web/src/app/dashbord/admin/firmaer/page.tsx` — Brreg-knapp i opprett-firma-modal, autofyller navn. INTEGRASJON_TYPER utvidet med `reginn`.
- `apps/web/src/app/dashbord/firma/innstillinger/integrasjoner/page.tsx` — Sentralregisteret-tile fjernet, erstattet med "ingen aktive integrasjoner ennå"-tekst.

**Begrunnelse for rename:** Brønnøysund (`data.brreg.no` — firma-grunndata, åpent) og Reginn MREG (`api.sentralregisteret.no` — MEF-utstyrsregister, krever nøkkel) er to ulike tjenester. Forrige PR brukte navnet «Sentralregisteret» med Brønnøysund-beskrivelse — det var feilaktig. Korrigert: Brreg = firmaprofil-autofyll (denne PR), Reginn = maskindata (senere PR, ref. N2.2.3 i oppryddings-plan).

3 nye i18n-nøkler nb+en (`brreg.hent`, `brreg.henter`, `firma.integrasjoner.ingenAktive`). 2 fjernede (`firma.integrasjoner.sentralregisteret.*`). `pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (39.2s) grønt. Klar for test-deploy.

---

**Integrasjonsadmin med kryptering IMPLEMENTERT på develop 2026-05-07.** Per-firma integrasjons-administrasjon med AES-256-GCM-kryptering av API-nøkler at-rest. Forutsetning for Sentralregisteret-integrasjon (Brønnøysundregistrene). SmartDok holdes utenfor denne PR.

**Komponenter:**
- `packages/db/src/encryption.ts` — AES-256-GCM utility (`krypter`/`dekrypter`/`verifiserKrypteringsKonfig`). 12-byte IV, 16-byte authTag, base64-output. Master-key fra `SITEDOC_INTEGRATION_KEY` (32 byte hex).
- `apps/api/src/routes/firma-integrasjon.ts` — ny tRPC-router (`list`/`lagre`/`slett`) gates med `autoriserAdminForFirma`. Type-whitelist `["sentralregisteret"]`.
- `apps/api/src/routes/admin.ts` — utvidet: opprett/oppdater krypterer apiKey, ny type `"sentralregisteret"` tillatt, ny `hentPlatformIntegrasjoner` returnerer Vegvesen + krypterings-nøkkel-status.
- `apps/web/src/app/dashbord/firma/innstillinger/integrasjoner/page.tsx` — firma-admin UI med kort-basert design, status-badge, password-felt, Lagre/Endre/Fjern.
- `apps/web/src/app/dashbord/admin/integrasjoner/page.tsx` — sitedoc_admin platform-status (Vegvesen + krypteringsnøkkel read-only).
- Sidebar-links lagt til både firma- og admin-layout.

**Designvalg — eksplisitt vs Prisma `$extends`:** Vurderte `$extends` med `query`-component for transparent kryptering, men dette endret type-en på `prisma`-instansen og brakk type-systemet i hele monorepo (manglende `$on`-metode på utvidet klient bryter funksjoner som tar `PrismaClient`-parameter). Eksplisitt `krypter()`-kall i routerne (kun 2 filer rører `OrganizationIntegration`) er mer lesbar og unngår type-kaskade. Risiko for å glemme krypter-kall mitigeres av at scope er minimalt.

**Test-rens:** `c9a86fa4-ec5b-4959-8631-b3f176f92d50` (proadm testdata på Byggeleder, klartekst) slettet via SQL før push. Prod hadde 0 rader → ingen migrering nødvendig.

**Manuell env-oppdatering kreves før test-deploy:** Sett `SITEDOC_INTEGRATION_KEY` på test- og prod-server. Genereres med `openssl rand -hex 32`. Master-key må aldri rote i git.

**Sentralregisteret-integrasjon konsumerer foreløpig ikke nøkkelen** — denne PR-en lager kun lager-flyten. Faktisk Sentralregister-API-kall (Brønnøysundregistrene) implementeres i egen PR. Vegvesen-policy uendret: env-variabel (`VEGVESEN_API_KEY`), platform-nivå.

`pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (35.7s) grønt. Klar for test-deploy etter env-oppdatering.

---

**UX-runde 2 (B1+B2) DEPLOYET TIL PROD 2026-05-06.** UX-agenda har nå alle 3 vedtatte beslutninger (B1+B2+B3) på prod. Gjenstår kun U5 (byggeplass selvstendig flyt) som åpen UX-oppgave.

| Merge-hash | Innhold | Prod-deploy-tid (CEST) |
|---|---|---|
| `2f22c503` | B1 ProsjektVelger Alle/Mine prosjekter scope | ~16:48 |
| `da00d55d` | B2 onboarding-checkpoint-bar modul-utvidelse | ~17:05 |

**B1** (`2f22c503`): Server: `prosjekt.hentMine` endret til medlemskaps-filter uavhengig av rolle (sitedoc_admin og company_admin filtreres nå også på `members.some.userId`). `hentAlle` beholder admin-bypass for «Alle»-scope.

Klient: ProsjektKontekst utvidet med `prosjektScope: "alle" | "mine" | "enkelt"`, `mineProsjekter`-liste og `velgScope(scope)`-funksjon. Scope persisteres i `localStorage` (`sitedoc-prosjekt-scope`, default `"mine"`). URL med prosjektId tvinger `scope="enkelt"`. ProsjektVelger viser to scope-rader øverst (LayoutGrid + Star-ikon, telling = N/M) — kun for sitedoc_admin og company_admin. Vanlig user (`role="user"`) får ren prosjektliste som før. Knapp-tekst speiler aktiv scope. `velgScope` nullstiller prosjekt-id og ruter til `/dashbord`. Dashbord-startsiden filtrerer visnings-listen på scope; auto-redirect-logikken bruker fortsatt full prosjektliste (førstegangs-onboarding). Ny tom-state-tekst for «Mine»-scope peker brukeren til «Alle prosjekter». 7 nye i18n-nøkler nb+en (`prosjektVelger.*` + `dashbord.ingenMineProsjekterBeskrivelse`).

**B2** (`da00d55d`): Server: `prosjekt.hentOnboardingStatus` utvidet med 6 nye flagg — `timerAktiv/harTimerOppsett`, `maskinAktiv/harMaskinregister`, `varelagerAktiv/harVarekatalog`. Modul-aktivering avledes fra `ProjectModule.status="aktiv"` på prosjektet. Ferdig-kriterier: Timer = `prismaTimer.lonnsart.count > 0 && prismaTimer.aktivitet.count > 0`; Maskin = `prismaMaskin.equipment.count > 0`; Varelager = `prismaVarelager.vare.count > 0`. Tellinger kjøres mot prosjektets `primaryOrganizationId`. Standalone prosjekt (ingen primary org) har alltid modul-flagg = false.

Klient: `apps/web/src/app/dashbord/[prosjektId]/page.tsx` bygger steg-array dynamisk — modul-piller spread-es inn kun når aktivert. `alleFerdige`-sjekken bruker bare synlige piller (skjuler hele banneret når alt er gjort). Lenker peker til firma-sidene (`/dashbord/firma/timer/onboarding`, `/dashbord/maskin`, `/dashbord/firma/varelager`) siden modul-oppsett er firma-nivå-arbeid. Banneret skjules fortsatt for ikke-admin (eksisterende `erAdmin`-sjekk uendret). 3 nye i18n-nøkler nb+en (`onboarding.timerOppsett`, `onboarding.maskinregister`, `onboarding.varekatalog`).

Test-verifisering 2026-05-06 mot prosjekt 998 Instinniforbotn (`f6dcb81f-...` på sitedoc_test): timer + varelager aktivert, alle modul-tellinger > 0 (lonnsart=41, aktivitet=3, vare=57) — banneret skjult som forventet siden alle synlige steg er ferdige. Funksjonell verifisering for ikke-ferdig-tilstand utsatt (kunstig DB-tilbakerulling unødvendig — koden følger samme mønster som eksisterende 4 grunnsteg).

**UX-agenda-status etter UX-runde 2:**
- ✅ B1 toppbar prosjektvelger Alle/Mine — DEPLOYET (`2f22c503`)
- ✅ B2 onboarding-checkpoint-bar utvidelse — DEPLOYET (`da00d55d`)
- ✅ B3 modul-fargedesign — DEPLOYET (`c2da3135`)
- ✅ U1 leder-timer-rapport — DEPLOYET (`c551063f`)
- ✅ U2 CSV/Excel-eksport — DEPLOYET (`31cff7da`)
- ✅ U3 sidebar tekst-labels — DEPLOYET (`c2da3135`)
- (U4 erstattet av B3)
- ⬜ U5 byggeplass selvstendig flyt — gjenstår, krever planleggingsrunde
- ✅ U6 maskin sitedoc_admin firma-kontekst — DEPLOYET (`3dd4371b`)
- ✅ U7 fritekst utstyrstype — DEPLOYET (`1781a17a`)

HTTP/2 200 mot sitedoc.no etter begge deploys.

---

**UX-runde 1 (B3+U1+U2+U3+U6+U7) DEPLOYET TIL PROD 2026-05-06.**

Sammenfatning av 6 UX-vedtatte endringer fra ux-arkitektur-gjennomgang 2026-05-06, deployet i 5 prod-merger samme dag:

| Merge-hash | Innhold | Prod-deploy-tid (CEST) |
|---|---|---|
| `3dd4371b` | U6 maskin sitedoc_admin firma-kontekst-fix + 5 Heatwork-Equipment-rader for A.Markussen | ~13:30 |
| `c2da3135` | U3 sidebar tekst-labels (60→200px) + B3 modul-fargedesign (Alternativ C) | ~14:22 |
| `1781a17a` | U7 fritekst utstyrstype med datalist-forslag | ~14:40 |
| `c551063f` | U1 leder-timer-rapport på firmanivå + React#310-fix | ~14:55 |
| `e4f594fa` | Mine timer flyttet til HovedSidebar + global scrollbar-fix | ~15:30 |
| `31cff7da` | U2 CSV/Excel-eksport på timer-rapport | ~16:03 |

**Detaljer per endring:**

**U3 + B3** (`c2da3135`): HovedSidebar utvidet fra `w-[60px]` (kun ikoner) til `min-w-[200px]` med ikon+tekst-labels. Tooltip-wrapping fjernet. Modul-fargedesign Alternativ C: toppbar uendret (mørkeblå brand), sidebar-aktivt element får 3px border-left + farget ikon KUN når elementet hører til aktiv modul. Ny `apps/web/src/lib/modul-farger.ts` med palett (prosjekt #378ADD, timer #3B6D11, maskin #854F0B, varelager #1D9E75) + `hentAktivModul(pathname)` med UUID-{36}-regex for prosjekt-rute-detect.

**U7** (`1781a17a`): `<select>` for utstyrstype byttet til `<input type="text">` + `<datalist>`-forslag på både nytt-utstyr-side og detalj-side. Server tok allerede fritekst (kun klient-endring). Vegvesen-auto-foreslag oppdatert til labelKey-form (`Personbil`/`Varebil`/etc.) for å matche datalist-verdiene.

**U1** (`c551063f`): Ny tRPC under-router `timer.rapport` med 3 endepunkter:
- `firmaPeriodeRapport({orgId, fra, til, prosjektId?, ansattId?})` — aggregerer DailySheet+SheetTimer+SheetTillegg+SheetMachine på tvers av firmaets prosjekter, returnerer per-ansatt-aggregat med totalTimer, antallSedler, sistRegistrert, statusFordeling, perProsjekt-array, perDag-array
- `hentFirmaProsjekterMedTimer` + `hentFirmaAnsatteMedTimer` for filter-dropdowns
- Alle gates med `autoriserAdminForFirma`

Klient: ny side `/dashbord/firma/timer/rapport` med periode-velger (4 hurtig-knapper «Denne uken / Forrige uke / Denne måned / Forrige måned» + egendefinert), prosjekt+ansatt-filter, 5-kort sammendrag-stripe (Total timer / Ansatte / Sedler / Sent / Attestert), sortbar tabell på 5 kolonner med klikkbar ekspanderbar detaljvisning (per-dag standard + uke-toggle + per-prosjekt sidekol). Status-badges (Kladd/Sent/Attestert) per ansatt. Sidebar-rad «Timer-rapport» i firma-layout under «Timer».

**React #310-fix:** `useMemo` for `sorterteAnsatte` flyttet FØR `if (!orgId)` / `if (!harTimer)` early returns. Samme bug-mønster som tidligere økonomi-React310 (dokumentert i memory). Hooks må kalles i samme rekkefølge hver render.

**Mine timer + scrollbar** (`e4f594fa`):
- «Mine timer»-lenken fjernet fra firma-sub-sidebar — det er en personlig funksjon, ikke admin. Ny Seksjon-verdi `"mine-timer"` i `navigasjon-kontekst.tsx`. Nytt hovedelement i HovedSidebar (BarChart3-ikon, `kreverProsjekt: false`, `kreverFirmaModul: "timer"`, plassert mellom PSI/Søk og Timer for å gruppere timer-flowen). Modul-aksent grønn (B3). `useAktivSeksjon`-hook detekterer `/dashbord/timer/mine` → `"mine-timer"`. Gjenbruker eksisterende i18n-nøkkel `nav.timerMine`.
- Global scrollbar-fix: `<main className="flex-1 overflow-y-auto">` rundt `{children}` i `dashbord/layout.tsx` — fjerner kuttet innhold på sider uten egen scroll-wrapper. `<main>` semantisk riktig (a11y-fordel).

**U2** (`31cff7da`): Ny `apps/web/src/lib/timer-rapport-eksport.ts` med `eksporterCsv` + `eksporterXlsx`. Lazy-import av exceljs (allerede i deps) — unngår bundle-økning. Klient-side bygging fra rapportData (ingen server-roundtrip).

- **CSV:** ett ark, semikolon-separert med UTF-8 BOM for Excel-Windows-kompatibilitet, RFC 4180-quoting
- **Excel (.xlsx):** 3 ark
  1. Sammendrag — én rad per ansatt (Ansatt | Ansattnr | Total timer | Sedler | Sist reg. | Kladd | Sent | Attestert | Per prosjekt)
  2. Per prosjekt — én rad per ansatt × prosjekt
  3. Per dag — én rad per ansatt × dag
- **Filnavn:** `SiteDoc-timer-{firma-slug}-{fra}-{til}.{csv|xlsx}`
- **Norsk tallformat** (komma som desimal). **Respekterer alle filtre** (periode/prosjekt/ansatt) siden eksport bygges fra rapportData som allerede er filtrert.

Eksport-knapp med dropdown (CSV/Excel) i header på rapport-siden. Disabled hvis 0 ansatte. Spinner mens xlsx genereres.

**UX-agenda-status etter denne runden:**
- ✅ B1 toppbar prosjektvelger Alle/Mine — DEPLOYET i UX-runde 2 (`2f22c503`)
- ✅ B2 onboarding-checkpoint-bar utvidelse — DEPLOYET i UX-runde 2 (`da00d55d`)
- ✅ B3 modul-fargedesign — IMPLEMENTERT
- ✅ U1 leder-timer-rapport — IMPLEMENTERT
- ✅ U2 CSV/Excel-eksport — IMPLEMENTERT
- ✅ U3 sidebar tekst-labels — IMPLEMENTERT
- (U4 erstattet av B3)
- ⬜ U5 byggeplass selvstendig flyt — gjenstår, krever planleggingsrunde
- ✅ U6 maskin sitedoc_admin firma-kontekst — IMPLEMENTERT
- ✅ U7 fritekst utstyrstype — IMPLEMENTERT

HTTP/2 200 mot sitedoc.no etter alle deploys.

---

**Heatwork-seed + U6 maskin firma-kontekst-fix DEPLOYET TIL PROD 2026-05-06** (merge `3dd4371b`).

**Prod-deploy fullført:**
- Merge `3dd4371b`: Heatwork-seed-script + U6-fix
- pnpm install + db-maskin generate (ingen migrasjon — kun kode-endringer)
- Web-build 1m16s, sitedoc-api + sitedoc-web restartet
- HTTP/2 200 mot sitedoc.no

**Heatwork-seed mot A.Markussen prod (`4488fe17-...`):**
```
Heatwork-rader: 3 opprettet, 2 eksisterte
```

**DB-tilstand etter seed + manuell rens:**
| internNummer | type | erUtleieobjekt | utleieEnhet | Kilde |
|---|---|---|---|---|
| 7626 | Heatwork 3600 | true | doegn | Seed-script 2026-05-06 |
| 7628 | Heatwork 3600 | true | doegn | Seed-script 2026-05-06 |
| 7630 | Heatwork 3600 | true | doegn | Seed-script 2026-05-06 |
| 7632 | Heatwork 3600 | true | doegn | Manuelt rettet i UI 2026-05-06 |
| 7634 | Heatwork MY35 | true | doegn | Manuelt rettet i UI 2026-05-06 |

Alle 5 Heatwork-utleie-Equipment-rader for A.Markussen ferdig konfigurert.

7632 og 7634 ble opprintet via SmartDok-maskin-import 2026-05-03 før Heatwork-Equipment-utvidelsen var planlagt. Idempotens-sjekken (på `internNummer`) hoppet over dem fordi de allerede fantes — scriptet overskriver ikke eksisterende rader. Brukeren rettet manuelt i UI etter prod-deploy av U6-fix.

**U6-fix:** equipment-router migrert til Steg 1b/2d-mønster. Ny `hentMaskinOrgFraInput` + lokal `verifiserMaskinTilgang` med sitedoc_admin-bypass. Klient sender `useFirma().valgtFirma?.id` med enabled-flagg. Detaljside bruker utstyrets eget orgId for ansvarlig-velger. Tom-state på nytt-utstyr-side hvis ingen firma valgt.

---

**Steg 4b Sesjon 3 DEPLOYET TIL PROD 2026-05-06** (merge `37a1fe89`). Lukker Steg 4b fullt ut.

**Prod-deploy fullført:**
- Merge develop→main: `37a1fe89` (`feat: Steg 4b Sesjon 3 + UX-dokumentasjon`, no-ff)
- Migrasjon `20260507000001_vare_unique_navn_enhet` applied til prod-DB (Vare unique fra `(orgId, varenummer)` til `(orgId, navn, enhet)`)
- Web-build 1m18s, `sitedoc-api` + `sitedoc-web` restartet
- HTTP/2 200 mot sitedoc.no

**Seed-kjøring mot A.Markussen (`4488fe17-7490-409f-9c1c-2827f257c54d`):**
```
Kategorier: 7 opprettet, 0 eksisterte
Varer: 57 opprettet, 0 eksisterte
```

**DB-verifisering (prod):**
- 7 kategorier: Grus/pukk/jord (36), Naturstein (8), Diverse (7), Rør og rørdeler (2), Betongstein og elementer (2), Forbruk (1), Deponiavgift (1) = 57 varer
- 2 pris-rader: Matjord fra lager Beisfjord (m3) = 100,00 og Samfengt grus (m3) = 80,00

**Gjenstår manuelt på Kenneths side:**
- Opprett 6 Heatwork-utleie-Equipment-rader (7626/7628/7630/7632/7634 + HW-vifte) i `/dashbord/maskin` med `erUtleieobjekt=true`, `utleieEnhet=doegn`. Varelager-modul allerede aktivert for A.Markussen per UX-agenda 2026-05-06.

**UX/arkitektur-status:**
- 3 vedtatte beslutninger (B1 toppbar prosjektvelger med Alle/Mine, B2 onboarding-checkpoint-bar utvidelse, B3 modul-fargedesign Alternativ C — sidebar-aksent + ikonfarge, toppbar uendret)
- 4 åpne oppgaver: U1 leder-timer-rapport, U2 eksport alle ansatte (forutsetning for ProAdm), U3 sidebar tekst-labels, U5 byggeplass selvstendig flyt
- U4 erstattet av B3
- B3-implementasjon planlagt som egen frontend-sesjon etter A.Markussen-onboarding er stabilisert
- Detaljer i [ux-arkitektur-agenda.md](ux-arkitektur-agenda.md)

---

**Steg 4b Sesjon 3 — DEPLOYET TIL TEST 2026-05-07** (historikk).

**Status før prod-deploy:**
- Sesjon 3-koden lå på `develop`: `420c0464` (import-flyt) + `5e7aa8d2` (seed-script) + `7241180f` (dok)
- Test-DB hadde migrasjon `20260507000001_vare_unique_navn_enhet` applied; prod-DB hadde den IKKE

**Test-verifisering (Byggeleder, org-id `f1000001-0000-0000-0000-000000000002`):**

Første seed-kjøring:
```
Kategorier: 7 opprettet, 0 eksisterte
Varer: 57 opprettet, 0 eksisterte
```

DB-verifisering: kategorifordeling Grus/pukk/jord (36) + Naturstein (8) + Diverse (7) + Rør og rørdeler (2) + Betongstein og elementer (2) + Forbruk (1) + Deponiavgift (1) = 57 varer. Same-name-multi-enhet fungerer (Betong, Bærelag 0-22, Jernbanepukk, Kabelsand 0-8, Kult 0-250 har 2 rader hver — bekrefter ny `(orgId, navn, enhet)`-constraint).

Idempotens (re-kjøring):
```
Kategorier: 0 opprettet, 7 eksisterte
Varer: 0 opprettet, 57 eksisterte
```

**Strategi-endring:** A.Markussens varekatalog seedes via dedikert script (`packages/db-varelager/prisma/seed-amarkussen.ts`) i stedet for å kjøre import-UI mot prod. Import-UI'et fra `420c0464` beholdes for fremtidige kunder.

**Sesjon 3 venter på følgende før prod-deploy:**

1. ✅ **UX/arkitektur-gjennomgang KOMPLETT 2026-05-06** — beslutninger (B1 toppbar prosjektvelger med Alle/Mine-valg, B2 onboarding-checkpoint-bar utvides med modul-punkter) og 5 åpne oppgaver (U1 leder-timer-rapport, U2 eksport alle ansatte, U3 sidebar tekst-labels, U4 farge-aksent per modul, U5 byggeplass selvstendig flyt) dokumentert i [ux-arkitektur-agenda.md](ux-arkitektur-agenda.md). U1+U2 må prioriteres — forutsetning for ProAdm-eksport.
2. ✅ **A.Markussen firmaprofil KOMPLETT 2026-05-06** — Timer/Maskin/Varelager aktivert i prod, prosjekt «998 Instinniforbotn» opprettet (SD-20260506-0008).
3. **Gjenstår:** prod-deploy av Sesjon 3 (merge `develop` → `main`) → seed-kjøring mot A.Markussen (`pnpm --filter @sitedoc/db-varelager exec tsx prisma/seed-amarkussen.ts`) → manuell opprettelse av 6 Heatwork-utleie-Equipment-rader (Varelager-modul allerede aktivert).

**Forsøk på prod-seed 2026-05-07 ble stoppet** fordi prod-repo er på Sesjon 2 (filen finnes ikke + migrasjonen er ikke applied — varenr-kollisjoner ville rullet transaksjonen på den gamle constraint).

---

**Steg 4b Sesjon 3 — engangs seed-script for A.Markussen IMPLEMENTERT på develop 2026-05-07** (`5e7aa8d2`).

**Strategi-endring:** A.Markussens varekatalog seedes via dedikert script i stedet for å kjøre import-UI mot prod. Import-UI'et fra `420c0464` beholdes for fremtidige kunder.

**Endring:**
- Ny fil `packages/db-varelager/prisma/seed-amarkussen.ts` (219 linjer)
- 7 VareKategori-rader (Grus/pukk/jord, Diverse, Naturstein, Betongstein og elementer, Rør og rørdeler, Deponiavgift, Forbruk) — alle med `kontonummer=null` (fylles manuelt etter seed)
- 57 Vare-rader fordelt: Grus/pukk/jord (36), Diverse (7, «.» utelatt), Naturstein (8), Betongstein og elementer (2), Rør og rørdeler (2), Deponiavgift (1), Forbruk (1)
- 2 pris-rader: «Matjord fra lager Beisfjord» m3=100,00 og «Samfengt grus» m3=80,00
- Idempotent: `findFirst` per rad → opprett hvis null. Re-kjøring oppretter 0 nye rader og overskriver IKKE eksisterende verdier (bevarer manuelle pris-justeringer i UI)
- Default `ORG_ID=4488fe17-7490-409f-9c1c-2827f257c54d` (A.Markussen AS prod). Override via `SEED_ORG_ID`-env for test
- Heatwork-utleie (6 rader) IKKE seedet — opprettes manuelt som Equipment per Beslutning 3 i steg-4b-plan.md

**Kjøring (test-DB først):**
```
SEED_ORG_ID=f1000001-0000-0000-0000-000000000002 \
  pnpm --filter @sitedoc/db-varelager exec tsx prisma/seed-amarkussen.ts
```
(Byggeleder-firma på test-DB.)

**Kjøring (prod):**
```
pnpm --filter @sitedoc/db-varelager exec tsx prisma/seed-amarkussen.ts
```

**Forutsetning:** Varelager-modul må aktiveres for firmaet via UI eller `OrganizationModule(slug="varelager", status="aktiv")` for at radene skal vises. Scriptet sjekker ikke dette — kun datavisnings-forutsetning, ikke data-integritet. Logger påminnelse på slutten.

**Stopp og rapporter etter test-kjøring — Claude verifiserer i UI før prod-kjøring.**

---

**Steg 4b Sesjon 3 (Fase 5 — import-flyt) IMPLEMENTERT på develop 2026-05-07** (`420c0464`). Lukker Steg 4b fullt ut når deployet til prod. Bygger på Sesjon 2 (deployet prod 2026-05-06). Implementerer SmartDok-varekatalog-import for A.Markussen.

**Endringer i Sesjon 3:**

**Migrasjon — Vare unique-constraint:**
- Ny migrasjon `20260507000001_vare_unique_navn_enhet`: dropper `(organizationId, varenummer)`-unique og legger til `(organizationId, navn, enhet)`-unique. Schema-rens i `packages/db-varelager/prisma/schema.prisma`. Bakgrunn: A.Markussens SmartDok-katalog har samme produkt med to enheter (eks. «Pukk 0-120» som både m³ og Tonn med varenummer 31) — den gamle constraint hindret det. Domenet er klart: navn+enhet identifiserer en katalog-vare unikt per firma; varenummer er valgfri ekstern referanse. Eksisterende vare-router CONFLICT-meldinger oppdatert.

**Server — `vareImport`-router (ny):**
- Ny utility `apps/api/src/utils/vareforbrukImport.ts`: `parseSmartDokVarerXml(filinnhold)` parser SpreadsheetML XML (filtype `Varedetaljer.xls.xls` er XML, ikke binær), `normaliserEnhet(verdi)` (Døgn→doegn, m³→m3, etc.), `beregnFilHash(filinnhold)` SHA-256. Filtreringer: navn=«.» → utelat (ugyldig), kategori=«Utleie Heatwork» → utelat (opprettes manuelt som Equipment per Beslutning 3 i steg-4b-plan.md), pris=0 → null (SmartDok 0=ikke satt), internkostnad tom → null. Bruker `fast-xml-parser` (allerede installert).
- Ny router `apps/api/src/routes/vareImport.ts` montert på `appRouter.vareImport`:
  - `importerForhandsvisning({ filInnhold, organizationId })` — parse + duplikat-rapport (DB-duplikater på navn+enhet + fil-interne) + kategori-fordeling (eksisterende vs ny). Ingen DB-skriving.
  - `importerBekreft({ filInnhold, filhash, organizationId })` — fil-hash-sjekk mot forhåndsvisning, atomisk `$transaction`: (1) seed nye `VareKategori`-rader for kategorier som ikke eksisterer, (2) opprett `Vare`-rader med `kategoriId`-FK satt. Activity-log best-effort med samlet rad (`target_type=vare_import`, `action=vare.smartdok-importert`).
- Begge gates med `verifiserFirmaAdminOgVarelager` (samme mønster som vare/vareKategori-routerne) — `autoriserAdminForFirma` + `krevVarelagerAktivert` med `PRECONDITION_FAILED` hvis modul ikke aktiv.

**Klient — ny side `/dashbord/firma/varelager/import`:**
- 4-stegs flyt: opplastning (drag-and-drop + klikk) → forhåndsvisning (sammendrag + kategori-oversikt + advarsler + tabell-preview) → bekreft → resultat. Samme stil som `/dashbord/maskin/import`.
- Filinnhold lastes som tekst (`fil.text()`) siden SpreadsheetML er XML. Aksepterer `.xls` og `.xml`.
- Forhåndsvisning skiller mellom Heatwork-utelatt (med peker til Equipment-internnr fra navnet), ugyldige rader (navn=«.»), DB-duplikater og fil-interne duplikater.
- Resultat-side har egen advarsel-boks for Heatwork-rader med klar instruks om manuell Equipment-opprettelse.
- «Importer fra SmartDok»-knapp på `/dashbord/firma/varelager` byttet fra `disabled` til `<Link>` til ny rute. Ubrukt i18n-nøkkel `firma.varelager.knapp.importKommer` fjernet.

**A.Markussen prod-import — manuell oppfølging etter prod-deploy:**
1. Aktiver Varelager-modul for A.Markussen via `/dashbord/firma/moduler` (sitedoc_admin → A.Markussen i FirmaVelger).
2. Importer `Varedetaljer.xls.xls` via ny rute. Forventet resultat: 7 nye kategorier + 57 varer + 1 ugyldig utelatt + 6 Heatwork utelatt (totalt 64 rader i fila).
3. Manuelt: opprett 6 nye Equipment-rader for Heatwork-enhetene (7626/7628/7630/7632/7634 + HW-vifte) med `kategori=smautstyr`, `erUtleieobjekt=true`, `utleieEnhet=doegn`. Listet i resultat-side med forventet internnummer.

**i18n:** ~50 nye nøkler under `firma.varelager.import.*` i nb+en. Fjernet 1 ubrukt nøkkel.

**Filer endret/nye:**
- 1 ny migrasjon (`20260507000001_vare_unique_navn_enhet`)
- 1 endret: `packages/db-varelager/prisma/schema.prisma` (unique-endring)
- 1 endret: `apps/api/src/routes/vare.ts` (CONFLICT-meldinger oppdatert til navn+enhet)
- 1 ny: `apps/api/src/utils/vareforbrukImport.ts` (parser)
- 1 ny: `apps/api/src/routes/vareImport.ts` (router)
- 1 endret: `apps/api/src/trpc/router.ts` (montering)
- 1 ny: `apps/web/src/app/dashbord/firma/varelager/import/page.tsx` (klient-UI)
- 1 endret: `apps/web/src/app/dashbord/firma/varelager/page.tsx` (knapp aktivert + Link)
- 2 endret: `packages/shared/src/i18n/{nb,en}.json` (i18n-nøkler)

`pnpm --filter @sitedoc/api typecheck` + `pnpm build --filter @sitedoc/web` (36.2s) grønt. Klar for test-deploy.

**Stopp og rapporter etter test-deploy — Claude verifiserer import-flyten på Byggeleder før prod-deploy.**

---

**Steg 4b Sesjon 2 (Fase 3 + Fase 4) DEPLOYET TIL PROD 2026-05-06** (impl `da354766` + fix `7d95087f`). Bygger på Sesjon 1 (Fase 1 + 2) som blir deployet i samme prod-merge (commit `b7127475`). Sesjon 2 leverer tRPC-routere og full klient-UI for Varelager-modulen — verifisert på test som **Tore SiteDocAdmin → Byggeleder**: aktivering fungerer, full CRUD i Varelager + Vareforbruk verifisert, lås på attestert-rader fungerer, FK-Restrict på kategori-slett gir korrekt feilmelding.

**Endringer i Sesjon 2:**

**Fase 3 — tRPC-routere (3 nye + infrastruktur-utvidelser):**
- **Infrastruktur:**
  - `FirmamodulSlug` i `services/firmamodul.ts` utvidet fra `"timer" | "maskin"` til `"timer" | "maskin" | "varelager"`. `syncProjektModulerPaaAktiver/Deaktiver` håndterer nye slug automatisk uten ekstra kode (verifisert).
  - `organisasjon.settFirmamodul.input.slug` Zod-enum utvidet til å tillate `varelager`.
  - Ny `services/varelager/moduleGate.ts` — `erVarelagerAktivert(orgId, projectId?)` + `krevVarelagerAktivert(...)` + `VarelagerModulIkkeAktivertError`. Speiler `services/timer/moduleGate.ts`. To-nivås gating: firma-master + ProjectModule.
- **`vareKategori`-router** (firma-admin): `list`, `opprett`, `oppdater`, `slett`. Gates: `verifiserFirmaAdmin` + `krevVarelagerAktivert` (firma-nivå). Slett er **ekte DELETE** — feiler med CONFLICT (P2003) hvis varer er tilknyttet (FK Restrict).
- **`vare`-router** (firma-admin): `list` (med kategori-filter, søk, kunAktive), `hentMedId`, `opprett`, `oppdater`, `deaktiver` (soft-delete via `aktiv=false` — bevarer Vareforbruk-historikk). Kategori-validering: `kategoriId` må tilhøre samme firma. Unique-konflikt på varenummer mappes til CONFLICT.
- **`vareforbruk`-router** (prosjekt-medlemmer): `list` (filter på periode/byggeplass/dagsseddel/vare; beriker med registrert-av-bruker), `hentMedId`, `opprett`, `oppdater`, `slett`. Gates per endepunkt:
  - `verifiserProsjektmedlem` (eksisterende helper — ProjectMember + sitedoc_admin/company_admin-fallback)
  - `krevVarelagerForProsjekt` (henter `primaryOrganizationId` + krever modul aktiv på ProjectModule-nivå; returnerer orgId)
  - `krevTilgangPolicy` (henter `OrganizationSetting.vareforbrukTilgangDefault`; `alle-ansatte` → kun ProjectMember/company_admin; `kun-prosjektmedlemmer` og `sertifiserte` → krever ekte ProjectMember-rad. Sertifisert-policy får fallback til kun-prosjektmedlemmer i Sesjon 2; reell Kompetansetype-sjekk utsettes)
  - ECO-validering: hvis `externalCostObjectId` gitt — finnes, samme firma+prosjekt, status=aktiv, `timerregistreringApen=true` (proxy per Beslutning)
  - Vare-validering: tilhører samme firma som prosjektets eier-org
  - Dagsseddel-validering: hvis `dagsseddelId` gitt — eksisterer + tilhører samme prosjekt
  - Lås: `attestertSnapshot !== null` → FORBIDDEN på oppdater + slett
- **Activity-logging** (best-effort try/catch) på `vareforbruk.{opprett,oppdater,slett}`: `targetType="vareforbruk"`, `action="vare.registrert|endret|slettet"`, payload med vareId/antall/dagsseddelId. Kategori og Vare-CRUD logges ikke (firma-konfigurasjon).
- **Mount:** `appRouter` får 3 nye toppnivå-routere: `vareKategori`, `vare`, `vareforbruk`.

**Fase 4 — Klient web-UI:**
- **`/dashbord/firma/varelager/page.tsx`** (ny side): fane-toggle «Varer» / «Kategorier» (default Varer). Modul-ikke-aktivert-melding når `!aktiveFirmamoduler.includes("varelager")`. Varer-fane: filter på søk + kategori + inkluder-inaktiv, tabell-kolonner (navn, varenr, kategori, enhet, pris, internkostnad, aktiv-status), header-knapper «Importer fra SmartDok» (deaktivert i Sesjon 2 — peker til Fase 5) og «Legg til vare». 3 modaler: `VareModal` (opprett/rediger med felter inkl. enhet-combobox med 10 forslag via `<datalist>`, kategori-dropdown), `Deaktiver`-bekreftelses-modal. Kategorier-fane: liste med navn/kontonummer/aktiv, 3 modaler: `KategoriModal` (opprett/rediger med kontonummer-felt + hjelpetekst om ProAdm/Tripletax), `Slett`-bekreftelses-modal med server-feilmelding ved FK-konflikt.
- **`/dashbord/firma/moduler/page.tsx`**: Varelager-slug byttet fra `status: "kommer-snart"` til `status: "tilgjengelig"`. Toggle-funksjonalitet (aktivere/deaktivere) virker via eksisterende mønster — `organisasjon.settFirmamodul({ slug: "varelager", aktiver })`.
- **`/dashbord/[prosjektId]/vareforbruk/page.tsx`** (ny side): periode-filter (default siste 30 dager) + byggeplass-filter, tabell-kolonner (dato, vare, antall, enhet, byggeplass, registrert-av, kommentar, attestert-badge, handlinger). Modul-ikke-aktivert-melding hvis tRPC returnerer `PRECONDITION_FAILED`. 2 modaler: `ForbrukModal` (opprett/rediger — vare-velger låst i rediger-modus pga ECO/snapshot-implikasjoner; antall + dato + byggeplass + ECO-dropdown filtrert til aktive ECO-er + kommentar), `Slett`-bekreftelses-modal. Lås-håndtering: rediger/slett-knapper skjult når `erLast===true`.
- **Sidebar — firma:** Ny «Varelager»-lenke (Package-ikon) i `apps/web/src/app/dashbord/firma/layout.tsx` mellom «Mine timer» og «Fakturering» — `kreverFirmaModul: "varelager"` filter henvender til `aktiveFirmamoduler.includes("varelager")`.
- **Sidebar — prosjekt:** Ny «Vareforbruk»-element (Package-ikon) i `HovedSidebar.tsx` etter timer-attestering — `kreverFirmaModul: "varelager"` gates på ProjectModule-status (`harVarelagerPaaProsjekt`). `Seksjon`-typen i `navigasjon-kontekst.tsx` utvidet med `"vareforbruk"`. `useAktivSeksjon`-mappet utvidet med `vareforbruk: "vareforbruk"`.
- **i18n:** ~80 nye nøkler i `nb.json` + `en.json`:
  - `nav.vareforbruk` (1)
  - `handling.deaktiver` (1, manglet før)
  - `firma.varelager.*` (~35: tittel, faner, knapper, kolonner, filter, tom-tilstand, modaler, felter, deaktiver-bekreftelse, modul-ikke-aktivert-melding)
  - `firma.varelager.kategori.*` (~13: tittel, knapp, tom, kolonner, modaler, kontonummer-hjelp, slett-bekreftelse)
  - `vareforbruk.*` (~30: tittel, knapp, kolonner, filter, modaler, felter, lås-badge, slett-bekreftelse, modul-ikke-aktivert-melding)

**Hva Sesjon 2 IKKE leverer:**
- Ingen import-flyt — Sesjon 3 (Fase 5).
- Ingen mobil offline-sync — Steg 4b.5.
- Ingen aktivering av Varelager-modul for noe firma — separat manuell handling etter test-verifisering.
- Ingen sertifiserte-policy-håndhevelse — Kompetansetype får «kreves for vareregistrering»-flagg senere.
- Ingen attestering-flow på Vareforbruk — utsatt (mobil + leder-attestering).
- Ingen dagsseddel-kobling i opprett-modal — mobil registrerer fra dagsseddel-detalj senere.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (36.5s). Build-statistikk viser begge nye sider: `/dashbord/firma/varelager` (4.9 kB) + `/dashbord/[prosjektId]/vareforbruk` (4.09 kB). Ingen DB-migrasjoner i denne sesjonen (alle tabeller ble opprettet i Sesjon 1).

**Auto-deployes til test via cron** etter push. Cron-skriptet ble oppdatert i Sesjon 1 til å kjøre `prisma generate + migrate deploy` for alle 4 db-pakker — denne sesjonen krever ikke noen ny `.env` på server. Claude verifiserer på test som **Tore SiteDocAdmin → Byggeleder** (Beslutning fra forrige tur):
1. `/dashbord/firma/moduler` viser Varelager med toggle-knapp (ikke «kommer snart»). Aktiver Varelager → bekreftelse, sidebar-lenke «Varelager» dukker opp i firma-layout.
2. `/dashbord/firma/varelager` med tom-tilstand. Bytt til Kategorier-fane → opprett kategori «Test» med kontonummer 1900. Bytt tilbake til Varer → opprett vare «Pukk 0-22» enhet `m3` pris 250 kategori «Test». Rediger varen, deaktiver, reaktiver via list (toggle aktiv).
3. Som **Per Prosjektadmin** på et Byggeleder-prosjekt: prosjekt-sidebar viser «Vareforbruk»-ikon. Naviger inn → `/dashbord/[prosjektId]/vareforbruk` viser tom-tilstand. Registrer forbruk «Pukk 0-22» antall 5 — vises i tabell. Slett raden.
4. Slett kategori «Test» som har varer tilknyttet → server-feilmelding «Kategorien har varer tilknyttet og kan ikke slettes». Deaktiver vare først → slett kategori → slett vare.

**Stopp og rapporter etter test-verifisering — Sesjon 3 (Fase 5: import-flyt) avventer eksplisitt grønt lys.**

**Steg 4b Sesjon 1 (Fase 1 + Fase 2) inkludert i samme prod-deploy 2026-05-06** (commit `b7127475`). Verifisert på test før prod-deploy. Forutsetninger lukket (Steg 1e i prod 2026-05-05). Plan-oppdatering 2026-05-06 (`5aca7c31`): Beslutning 8 låst — `VareKategori`-tabell (firma-definert) med valgfri `kontonummer` for ProAdm/Tripletax-eksport; `Vare.kategoriId` (FK) erstatter fritekst-`kategori`. A.Markussens 7 kategorier seedes ved import (Fase 5). Engangsfix på server: `.env` opprettet i `packages/db-varelager`, deploy-cron-skript oppdatert til å håndtere alle 4 db-pakker (generate + migrate deploy).

**Endringer i Sesjon 1:**

**Fase 1 — `packages/db-varelager`-pakke:**
- Ny pakke speilet etter `db-timer`/`db-maskin`: `package.json`, `tsconfig.json`, `.env.example`, `.gitignore`, `src/index.ts` (eksporterer `prismaVarelager` + typer), `prisma/schema.prisma`.
- Schema med 3 modeller i postgres-schema `varelager`:
  - **`VareKategori`** (firma-definert) — `id`, `organizationId` (svak FK), `navn`, `kontonummer?`, `aktiv`, audit-felter. Unique `(organizationId, navn)`.
  - **`Vare`** — `organizationId`, `navn`, `varenummer?`, `enhet`, `pris?`, `internkostnad?`, `kategoriId?` (ekte FK med `onDelete: Restrict`), `aktiv`. Unique `(organizationId, varenummer)`.
  - **`Vareforbruk`** — `dato (Date)`, `projectId`, `byggeplassId?`, `externalCostObjectId?`, `vareId` (ekte FK Restrict), `antall`, `registrertAvUserId`, `kommentar?`, `dagsseddelId?` (svak FK → `daily_sheets`), `attestertSnapshot Json?` (A.7-mønster).
- Migrasjon `20260506000001_init`: CREATE SCHEMA varelager + 3 tabeller + 8 indekser + 2 ekte FKs.
- Cross-package-FK håndteres som svake String-felt uten `@relation` (samme mønster som db-timer/db-maskin).
- Workspace-deps: `@sitedoc/db-varelager: workspace:*` lagt til i `apps/api/package.json` + `apps/web/package.json`.
- `prismaVarelager` lagt til i tRPC-context begge steder (`apps/api/src/trpc/context.ts` + `apps/web/src/app/api/trpc/[...trpc]/route.ts`).
- `pnpm install` + `pnpm --filter @sitedoc/db-varelager exec prisma generate` grønt (Prisma-klient i `node_modules/.prisma/varelager-client`).

**Fase 2 — Equipment-utleie-utvidelse:**
- 4 nye felter på Equipment i `db-maskin/prisma/schema.prisma`:
  - `erUtleieobjekt Boolean default false`
  - `utleieprisPerDogn Decimal(10,2)?`
  - `utleieprisPerTime Decimal(10,2)?`
  - `utleieEnhet String?` («doegn» | «time» — primærenhet for fakturering)
- Migrasjon `20260506000002_equipment_utleieobjekt`: ALTER TABLE ADD COLUMN, bakoverkompatibel.
- tRPC: `maskin.equipment.oppdater` utvidet med 4 nye felter i Zod-schema (spread-mønster i Prisma-update krever ingen ekstra kode).
- Klient (`apps/web/src/app/dashbord/maskin/[id]/page.tsx`):
  - `UtstyrDetalj`-typen + `RedigerInputs`-typen utvidet med utleie-felter.
  - `aktivModal`-union utvidet med `"utleie"`.
  - Ny «Utleie»-seksjon i detaljvyen mellom Småutstyr-info og Notater. Read-only-visning: når `erUtleieobjekt=true` viser Ja/Nei + pris-per-døgn + pris-per-time + primærenhet; når `false` viser kun «Er utleieobjekt: Nei».
  - RedigerModal får ny `felt="utleie"`-seksjon med toggle-checkbox + 2 NumInput-pris-felter + select for utleieEnhet (kun synlig når toggle på).
  - `byggInitielt` får ny case for `"utleie"`.
- ~8 nye i18n-nøkler under `maskin.utleie.*` (nb+en): `seksjon`, `rediger`, `erUtleieobjekt`, `prisPerDogn`, `prisPerTime`, `primaerEnhet`, `enhet.doegn`, `enhet.time`.

**Hva Sesjon 1 IKKE leverer:**
- Ingen tRPC-routes for Vare/Vareforbruk-CRUD — Sesjon 2 (Fase 3).
- Ingen klient-UI for varekatalog eller vareforbruk — Sesjon 2 (Fase 4).
- Ingen import-flyt — Sesjon 3 (Fase 5).
- Ingen `EquipmentRental`-tabell, ingen utleie-transaksjons-flyt — Steg 4d.
- Ingen aktivering av Varelager-modulen for noe firma — separat steg etter Sesjon 2.
- Ingen mobil offline-sync — Steg 4b.5.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (28.3s). Ingen DB-migrasjon kjørt lokalt — test-deploy applier `20260506000001_init` (db-varelager) + `20260506000002_equipment_utleieobjekt` (db-maskin) ved auto-deploy.

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer på test: (1) `psql sitedoc_test -c "\dt varelager.*"` viser `vare_kategorier`, `varer`, `vareforbruk`; (2) `psql sitedoc_test -c "\d maskin.equipment"` viser nye kolonner; (3) som **Per Prosjektadmin** på en Equipment-detaljside — «Utleie»-seksjonen vises med «Er utleieobjekt: Nei», rediger-modalen kan toggles og prisfelter dukker opp/skjules. **Stopp og rapporter etter test-verifisering — Sesjon 2 (Fase 3 + 4) avventer eksplisitt grønt lys.**

**Steg 4b-plan VEDTATT 2026-05-05 — Sesjon 1 implementert 2026-05-06.** Komplett 5-faset plan i [steg-4b-plan.md](steg-4b-plan.md) (komplett A.Markussen-vareliste i § 13). Bygger på C.16 (vedtatt 2026-04-30) + A.Markussen SmartDok-katalog kartlagt 2026-05-05 (64 varer, 8 kategorier, 9 enheter). Sentrale beslutninger: ny `db-varelager`-pakke, **generelt prinsipp om utleie-utstyr** (per time/døgn registreres i Maskinregister med `erUtleieobjekt=true`, ikke i Varekatalog — gjelder Heatwork, steinsag, Hilti, aggregat på tvers av Equipment-kategorier), ECO-kobling på Vareforbruk, fritekst-enhet med forslagsliste, **VareKategori-tabell med kontonummer** (Beslutning 8, 2026-05-06). Importresultat: 57 Vare-rader + 7 VareKategori-rader (alt unntatt Heatwork) + 6 nye Equipment-rader for Heatwork-utleie-enheter. Estimat ~16t over 3 sesjoner. Forutsetning Steg 1e ✅ deployet prod 2026-05-05.

**admin/prosjekter respekterer FirmaVelger DEPLOYET TIL PROD 2026-05-05** (`0245b265` merge — fix `d9570c7b` + firma-kolonne `6414b9d3`). HTTP/2 200 verifisert mot sitedoc.no. Lukker to relaterte issues: (1) siden viste alle prosjekter på tvers av firmaer selv når sitedoc_admin hadde valgt et firma i FirmaVelger; (2) firma-kolonnen viste `projectOrganizations[0]` (første partner-rad) i stedet for primary firma — ga «Hovedentreprenør» på Byggeleder-prosjekter når Hovedentreprenør var partner. Speiler `prosjekt.hentAlle`-filteret fra Blokk A 2026-05-04.

**Endringer:**
- **Server (`apps/api/src/routes/admin.ts`):** `hentAlleProsjekter` får valgfri `organizationId: z.string().uuid().optional()`-input. `findMany`-where filtrerer på `primaryOrganizationId` når input er gitt, ellers ingen filter (samme atferd som før). Sjekkliste/oppgave-tellinger uendret — jobber mot allerede filtrert `prosjektIder`.
- **Klient (`apps/web/src/app/dashbord/admin/prosjekter/page.tsx`):** importerer `useFirma()`, sender `{ organizationId: valgtFirma?.id }` til queryen. Header-tittel + empty-state-tekst byttes dynamisk: «Alle prosjekter» når intet firma valgt → «[Firmanavn]» når firma valgt. Empty-state-beskrivelse blir firmaspesifikk.
- Ingen ny i18n (header er fortsatt hardkodet — i18n-konvertering av admin-vyen er separat opprydningsoppgave).

**Hva endringen IKKE dekker:**
- `prosjekt.hentAlle` røres ikke — har samme filter fra før, brukes andre steder.
- Auto-reset av lokal state ved firma-bytte er ikke relevant her (admin/prosjekter er selvstendig vy uten prosjekt-kontekst).
- i18n-konvertering av admin-vyen er fortsatt åpen.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (32.7s). Ingen DB-migrasjon, ingen i18n.

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer på test som **Tore SiteDocAdmin**: (1) uten firma valgt — `/dashbord/admin/prosjekter` viser «Alle prosjekter (N)» og listen er full; (2) velg Byggeleder i FirmaVelger — header endres til «Byggeleder -Firma (M)» og listen er filtrert til kun Byggeleder-prosjekter; (3) bytt til et firma uten prosjekter — empty-state med firmaspesifikk tekst.

**Steg 1e (OrganizationModule erstatter har_*_modul-flagg) DEPLOYET TIL PROD 2026-05-05** (`de044be4` merge — Fase A `9fda0f81` + Fase B `978c1bf4` + Fase C `5f72dc23`). HTTP/2 200 verifisert mot sitedoc.no. Lukker Steg 1e fullt ut og forutsetningen for Steg 4b (Vareforbruk).

**Prod-deploy verifisert:**
- 2 migrasjoner applied (`20260505000001_add_organization_module_fase_a` + `20260505010000_drop_organization_har_modul_flags`)
- `har_timer_modul` + `har_maskin_modul`-kolonnene droppet fra `organizations` (0 i information_schema)
- Bakfylt: **2 rader** i `organization_modules` for **A.Markussen AS** (timer + maskin, status=aktiv). HRP AS og Kenneths testmiljø hadde erKunde=true men aldri `har_*_modul=true`, så ingen rader bakfylt for dem — antagelsen i Fase A-rapporten om 6 rader var feil. 2 rader er korrekt for prod-state der kun A.Markussen aktivt bruker modulene.
- PM2: sitedoc-web + sitedoc-api restartet, uptime 0s ved verifisering

**Hva Steg 1e leverer:**
- Generisk `OrganizationModule(organizationId, moduleSlug, status, audit-felter, config)`-tabell erstatter `Organization.har_timer_modul` + `har_maskin_modul`
- Skalerbar til kompetanse/fremdrift/varelager uten schema-endring per ny modul
- Audit-spor: `aktivert_ved/aktivert_av_user_id/deaktivert_ved/deaktivert_av_user_id` (String? uten `@relation` per A.3-mønster)
- Klient-API: `Firma.aktiveFirmamoduler: string[]` erstatter de boolean-flaggene
- A.4-overstyring dokumentert i `fase-0-beslutninger.md` (peker til Steg 1e med rasjonale: firma uten prosjekter må kunne onboarde lønnsarter — ikke avledbar fra ProjectModule alene)

**Steg 1e Fase C (drop har_*_modul-kolonner) IMPLEMENTERT på develop 2026-05-05.** Lukker Steg 1e fullt ut. OrganizationModule-tabellen er nå eneste sannhetskilde for firma-master-aktivering — `har_timer_modul` + `har_maskin_modul`-kolonnene droppet fra Organization.

**Endringer i Fase C:**
- **Migrasjon `20260505010000_drop_organization_har_modul_flags`:** `ALTER TABLE organizations DROP COLUMN IF EXISTS har_timer_modul`, samme for `har_maskin_modul`. Idempotent.
- **Schema (`packages/db/prisma/schema.prisma`):** `harMaskinModul` + `harTimerModul`-feltene fjernet fra Organization-modellen. Kommentar oppdatert med peker til Fase C-migrasjonen.
- **Server (`apps/api/src/routes/organisasjon.ts`):** `settFirmamodul`-mutationen mister dual-write — `tx.organization.update({ data: { [flagFelt]: input.aktiver } })` og `flagFelt`-variabelen fjernet. Kun `skrivOrganizationModuleAktiver/Deaktiver` + `syncProjektModulerPaa{Aktiver,Deaktiver}` igjen.
- **Server (`apps/api/src/routes/timer/onboarding.ts`):** `aktiverNivaa1` + `aktiverTomKatalog` mister dual-write — `tx.organization.update({ data: { harTimerModul: true } })` fjernet fra begge.
- **Service-kommentarer:** `services/timer/moduleGate.ts` + `services/maskin/moduleGate.ts` har oppdaterte kommentarer som ikke lenger nevner `Organization.har_*_modul`-flagget.

**Hva Fase C IKKE gjør:**
- Ingen klient-endring — `Firma`-typen i `firma-kontekst.tsx` ble migrert i Fase B og berøres ikke her.
- Ingen API-bakoverkompat-bruddsjekk: feltene ble fjernet fra alle respons-typer i Fase B, så klienter (mobil, eldre web-builds) kan eventuelt få type-mismatch hvis de fortsatt forventer `harTimerModul`/`harMaskinModul`. Mobil sjekk: 0 callsites verifisert i Fase A — ingen risk. Web bygger fra samme commit.
- Ingen i18n-endring.

**Verifisering:** `pnpm --filter @sitedoc/db exec prisma generate` grønt. `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (32.7s).

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer på test: (1) psql `\d organizations` viser at `har_timer_modul` + `har_maskin_modul`-kolonnene er borte; (2) som Kari Firmaadmin — toggle Timer av/på på `/dashbord/firma/moduler` fungerer fortsatt (skriver til OrganizationModule); (3) FirmaVelger viser fortsatt «Maskin · Timer» under Byggeleder; (4) Timer-elementer i prosjekt-sidebar uendret. **Stopp og rapporter etter test-verifisering — Steg 1e er da fullt ut levert. Forutsetter prod-deploy som lukker Steg 4b-blokkeren (Vareforbruk).**

**Steg 1e Fase B (callsite-migrering til OrganizationModule) DEPLOYET TIL TEST 2026-05-05** (commit `978c1bf4`). Verifisert: FirmaVelger viser «Maskin · Timer» under Byggeleder, `/dashbord/firma/moduler` toggle fungerer, Timer-elementer i prosjekt-sidebar uendret. 47 callsites migrert fra `harTimerModul`/`harMaskinModul`-flagg til `aktiveFirmamoduler: string[]`. Lese-veien er nå utelukkende fra OrganizationModule-tabellen, men dual-write til flagg beholdt inntil Fase C dropper kolonnene.

**Steg 1e Fase A (OrganizationModule-tabell + bakfyll + dual-write) IMPLEMENTERT på develop 2026-05-05.** Bygger på Fase A. Migrerer alle 47 callsites fra `harTimerModul`/`harMaskinModul`-flagg til ny `aktiveFirmamoduler: string[]`-modell. Dual-write fra Fase A er beholdt — flaggene oppdateres fortsatt parallelt med OrganizationModule-rader inntil Fase C dropper kolonnene. Lese-veien er nå utelukkende fra OrganizationModule-tabellen.

**Endringer i Fase B:**
- **Service (`apps/api/src/services/firmamodul.ts`):** ny helper `hentAktiveFirmamoduler(organizationId, txClient?)` returnerer `string[]` — alle slugs der `OrganizationModule.status="aktiv"`. Gjenbrukes av `organisasjon.hentMin/hentMedId`, `admin.hentAlleOrganisasjoner`, `prosjekt.opprett/opprettTestprosjekt`. Eksisterende `erFirmamodulAktivert(orgId, slug)` (Fase A) brukes som boolean-sjekk.
- **Server-respons-typer:**
  - `organisasjon.hentTilgjengelige`: returnerer nå `{ id, name, erKunde, aktiveFirmamoduler: string[] }` per firma. Egen N+1-fri batch-spørring mot OrganizationModule berikes etter findMany.
  - `organisasjon.hentMin` + `hentMedId`: beriker Organization-respons med `aktiveFirmamoduler`-felt via Promise.all.
  - `admin.hentAlleOrganisasjoner`: tilsvarende batch-berikning av Organization[]-respons.
- **Server-internal:**
  - `services/timer/moduleGate.ts` + `services/maskin/moduleGate.ts`: leser nå fra `erFirmamodulAktivert` (OrganizationModule) i stedet for `Organization.har_*_modul`-flagg.
  - `prosjekt.opprett` + `opprettTestprosjekt`: bruker `hentAktiveFirmamoduler` i stedet for `select: { harTimerModul, harMaskinModul }`.
  - `timer/onboarding.status` + `aktiverNivaa2`: leser fra `erFirmamodulAktivert`. Returfeltet `harTimerModul: boolean` beholdt på response — feltnavnet er semantisk korrekt for boolean-sjekk i timer-spesifikk klient-kontekst.
- **Klient:**
  - `Firma`-typen i `firma-kontekst.tsx` har nå `aktiveFirmamoduler: string[]` i stedet for `harTimerModul/harMaskinModul: boolean`.
  - `firma/layout.tsx` + `firma/moduler/page.tsx` + `FirmaVelger.tsx` + `HovedSidebar.tsx` + `admin/firmaer/page.tsx`: alle lese-callsites byttet til `aktiveFirmamoduler.includes("timer")`/`includes("maskin")`. Lokale variabelnavn `harTimerModul`/`harMaskinModul` beholdt der det er hjelper-leser (semantisk navngivning, ikke felt-aksess).
  - `firma/timer/layout.tsx` + `firma/timer/onboarding/page.tsx` leser fortsatt `status.harTimerModul` fra `trpc.timer.onboarding.status` — det er en timer-spesifikk respons-felt (ikke fra Firma-typen) og beholdes for semantisk klarhet.

**Hva Fase B IKKE gjør:**
- Ingen drop av `har_*_modul`-kolonner — det skjer i Fase C.
- Skriving til OrganizationModule fra `settFirmamodul` + `timer/onboarding.aktiverNivaa1`/`aktiverTomKatalog` skjer fortsatt som dual-write — gir trygg overgang til Fase C.
- Mobil ikke berørt (0 callsites).

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (32.6s). Ingen DB-migrasjon, ingen i18n.

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer på test: (1) som **Tore SiteDocAdmin** — FirmaVelger viser «Maskin · Timer» under Byggeleder-firma (avledes nå fra `aktiveFirmamoduler` i stedet for flagg); (2) som **Kari Firmaadmin** — `/dashbord/firma/moduler` reflekterer korrekt aktiv-status, deaktiver Timer → reaktiver fungerer end-to-end (dual-write skriver til både flagg og OrganizationModule); (3) Timer-elementer i prosjekt-sidebar gates fortsatt på ProjectModule (ikke flagg) — uendret atferd. **Stopp og rapporter etter test-verifisering — Fase C avventer eksplisitt grønt lys.**

**Steg 1e Fase A (OrganizationModule-tabell + bakfyll + dual-write) DEPLOYET TIL TEST 2026-05-05** (commit `9fda0f81`). Verifisert som innlogget Kari Firmaadmin: deaktiver/reaktiver Timer fungerer ende-til-ende, sidebar oppdateres synkront, bekreftelsesdialog vises ved deaktivering. 2 bakfylte rader for Byggeleder (timer + maskin, status=aktiv) verifisert via psql. Fase A er **bakoverkompatibel** — har_*_modul-flaggene er fortsatt sannhetskilde, OrganizationModule oppdateres parallelt via dual-write. Sjette steg i prioritert byggerekkefølge fra [domene-arbeidsflyt.md](domene-arbeidsflyt.md). Erstatter `Organization.har_timer_modul`/`har_maskin_modul`-kolonnene med generisk `OrganizationModule`-tabell. Skalerbar til flere firmamoduler (kompetanse, fremdrift, varelager) uten schema-endring per ny modul. Forutsetning for Steg 4b (Vareforbruk).

**Tre-faset utrulling (Fase A bakoverkompatibel):**
- **Fase A** (denne): tabell opprettet + bakfylt, callsites uendret, dual-write fra `settFirmamodul` + `timer/onboarding.aktiverNivaa1` + `aktiverTomKatalog` til både flagg og ny tabell.
- **Fase B** (etter test-verifisering): migrér 47 callsites (23 server, 20 klient, 2 schema, 0 mobil) fra `harTimerModul`/`harMaskinModul` til `aktiveFirmamoduler: string[]` på Firma-typen.
- **Fase C** (etter Fase B-verifisering): drop `har_timer_modul` + `har_maskin_modul`-kolonnene fra Organization.

**Endringer i Fase A:**
- **Migrasjon `20260505000001_add_organization_module_fase_a`:** CREATE TABLE `organization_modules` med felter `(id, organization_id, module_slug, status, aktivert_ved, aktivert_av_user_id, deaktivert_ved, deaktivert_av_user_id, config, created_at, updated_at)`. Unique `(organization_id, module_slug)`, index på `(module_slug, status)`. FK til `organizations` med Cascade. `aktivert_av/deaktivert_av_user_id` er String? uten Prisma-`@relation` per A.3-mønster (bevarer audit-spor ved User-sletting). Bakfyll: INSERT-statements som speiler eksisterende `har_*_modul=true` fra Organization-tabellen, `aktivert_ved` settes til `organization.created_at` som beste tilnærming.
- **Schema (`packages/db/prisma/schema.prisma`):** Ny `OrganizationModule`-modell + `organizationModules OrganizationModule[]`-relasjon på Organization. Kommentar over `harMaskinModul`/`harTimerModul`-flaggene oppdatert til å beskrive Fase A-overgang.
- **Service (`apps/api/src/services/firmamodul.ts`):** Tre nye helpers — `erFirmamodulAktivert(orgId, slug)` (read fra ny tabell, klar for Fase B), `skrivOrganizationModuleAktiver(tx, orgId, slug, userId)` (upsert med audit), `skrivOrganizationModuleDeaktiver(tx, orgId, slug, userId)` (soft-delete via deaktivert_ved). Eksisterende `syncProjektModulerPaa{Aktiver,Deaktiver}` (Steg 1c Fase B) uendret.
- **Server (`apps/api/src/routes/organisasjon.ts`):** `settFirmamodul`-mutation utvidet med dual-write — kaller nå `skrivOrganizationModuleAktiver/Deaktiver` i samme `$transaction` som flagget oppdateres og `syncProjektModulerPaaAktiver/Deaktiver` kjøres. `ctx.userId` brukes som `aktivertAvUserId`/`deaktivertAvUserId`.
- **Server (`apps/api/src/routes/timer/onboarding.ts`):** `aktiverNivaa1` + `aktiverTomKatalog` utvidet med dual-write (kaller `skrivOrganizationModuleAktiver` i samme `$transaction`). `aktiverNivaa2` uberørt (krever at modul allerede er aktivert — ingen tilstandsendring).
- **Dokumentasjon (`docs/claude/fase-0-beslutninger.md` § A.4):** Peker til Steg 1e med overstyring-rasjonale lagt til. A.4 ProjectModule-utvidelse for prosjekt-instans-laget består uendret; firma-master-laget flyttes til ny tabell.

**Hva Fase A IKKE gjør:**
- Ingen klient-endring — `Firma`-typen i `firma-kontekst.tsx` beholder `harTimerModul`/`harMaskinModul`. Migreres i Fase B.
- Ingen drop av kolonner — `har_*_modul` er fortsatt sannhetskilde. Droppes i Fase C.
- Ingen Activity-logging av modul-aktivering ennå (audit-feltene på OrganizationModule-tabellen er kun bevegelse-historikk, ikke full event-stream).
- Ingen cross-org ProjectModule-unique — Steg 1e-spec sier dette skal vurderes samtidig, men er utsatt til separat steg per Kenneths beslutning 2026-05-05 (krever firmamodul-vs-prosjektmodul-distinksjon i schema/runtime).

**Verifisering:** `pnpm --filter @sitedoc/db exec prisma generate` grønt. `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (32.4s). Migrasjons-SQL ikke kjørt mot lokal-DB ennå (test+prod auto-deploy applier den).

**Bakfyll-forventning ved deploy:**
- Test-DB: 1 firma med begge flagg (Byggeleder) → 2 OrganizationModule-rader (timer + maskin, status=aktiv).
- Prod-DB: 3 firma med begge flagg (A.Markussen + HRP AS + Kenneths testmiljø) → 6 rader.

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer på test: (1) psql-spørring `SELECT organization_id, module_slug, status, aktivert_ved FROM organization_modules ORDER BY organization_id, module_slug` returnerer 2 rader for Byggeleder; (2) toggle Timer av/på i `/dashbord/firma/moduler` som Kari Firmaadmin → bekreft at både `harTimerModul`-flagg OG `OrganizationModule`-rad oppdateres synkront (psql-verifisering); (3) `aktivertAvUserId`/`deaktivertAvUserId` fylles korrekt med innloggets userId. **Stopp og rapporter etter test-verifisering — Fase B avventer eksplisitt grønt lys.**

**Reginn MREG (2026-05-05):** API-nøkler mottatt. N2.2.3 i oppryddings-plan aktivert. Venter på svar fra Anders (anders@sentralregisteret.no) om funksjonelle endepunkter — kun `/auth/session/get` er dokumentert så langt. Sakkyndig kontroll-felter (`sakkyndigKontrollSist/Frist/Organ/Nr`) kan legges til Equipment-skjema nå uten API. Reginn-worker bygges analogt med Vegvesen-worker. Tekniske rammer dokumenteres i [reginn-mreg-integrasjon.md](reginn-mreg-integrasjon.md) (opprettes separat). Blokkeren «avventer API-tilgang» fra N2.2.3 er fjernet.

**FirmaVelger-kontekst på `kom-i-gang` DEPLOYET TIL PROD 2026-05-05** (`66c2e982` merge, `9a750681` impl). HTTP/2 200 verifisert mot sitedoc.no. Test-verifisert begge redirect-scenarier som Tore SiteDocAdmin før prod-deploy. Sitedoc_admin med valgt firma redirectes til `/dashbord/nytt-prosjekt`, uten valgt firma til `/dashbord/admin/firmaer`. `opprettTestprosjekt` tar nå valgfri `organizationId` med samme autorisering som `prosjekt.opprett`. Vanlig bruker / company_admin uberørt. Lukker en regresjon som ble identifisert under faggruppe-konsolideringssesjonen: `prosjekt.opprettTestprosjekt`-mutationen ignorerte FirmaVelger-kontekst og brukte alltid innlogget brukers `organizationId`. Sitedoc_admin (Kenneth, org=Kenneths testmiljø) som hadde valgt A.Markussen i FirmaVelger og klikket «Start gratis prøveperiode» på `/dashbord/kom-i-gang` fikk prosjektet opprettet på Kenneths testmiljø, ikke A.Markussen. Steg 1b/2d-mønsteret (organizationId-input + sitedoc_admin-autorisering) fanget alle `/dashbord/firma/*`-rutene + `prosjekt.opprett`, men `opprettTestprosjekt` ble glemt fordi den ligger i kom-i-gang-flyten utenfor firma-tre-strukturen.

**Strategi: redirect + fix.** Ikke to flyter på samme side («kom-i-gang» er konseptuelt for nye brukere, ikke superadmin som onboarder kunder; «prøveperiode»-framing er semantisk feil for betalende kunde). I stedet redirectes sitedoc_admin bort, og selve mutationen fixes som forsvar i dybden.

**Endringer:**
- **Server (`apps/api/src/routes/prosjekt.ts`):** `opprettTestprosjekt` får valgfri `organizationId: z.string().uuid().optional()`-input. Speiler `prosjekt.opprett`-autorisering (linje 127-141): sitedoc_admin → enhver org, vanlig bruker → kun egen org, ellers FORBIDDEN. Fallback til `bruker.organizationId` når input ikke gitt. `Project.primaryOrganizationId` + `ProjectOrganization` + `ProjectModule`-rader bruker nå `valgtOrgId` i stedet for `bruker.organizationId`.
- **Klient (`apps/web/src/app/dashbord/kom-i-gang/page.tsx`):** Importerer `useFirma`. Ny `useEffect` lytter på `erSitedocAdmin`, `valgtFirma`, `firmaLaster`. Sitedoc_admin med valgt firma → `router.replace("/dashbord/nytt-prosjekt")` (siden har info-banner for sitedoc_admin fra Steg 2d). Sitedoc_admin uten valgt firma → `router.replace("/dashbord/admin/firmaer")` (kan velge eksisterende eller opprette nytt — «Opprett firma»-knapp finnes allerede). Vanlig bruker / company_admin: ingen redirect. Prøveperiode-mutation sender nå `valgtFirma?.id` som organizationId — defensivt, gjelder også sjeldne tilfeller der vanlig bruker har flere orger.

**Hva endringen IKKE dekker (separate oppgaver):**
- `eksternKostObjekt.ts:22-28` (`hentBrukerOrgId`-helper) faller fortsatt tilbake til `bruker.organizationId`. Read-only ECO-katalog-list — sitedoc_admin med valgt firma ser fortsatt egen ECO-liste, ikke valgt firmas. Mindre alvorlig (ingen skriving). Tas i egen runde hvis det blir aktuelt.
- Slå sammen `kom-i-gang` og `nytt-prosjekt` til én smart side — strukturell endring, ut av scope.
- Onboarding-veileder + prosjektoppsett-veileder (planlagt post-Fase 0) — ikke berørt.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (33.1s). Ingen DB-migrasjon, ingen i18n.

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer som **Tore SiteDocAdmin** på test: (1) velg Byggeleder i FirmaVelger, gå til `/dashbord/kom-i-gang` → forventet auto-redirect til `/dashbord/nytt-prosjekt`; (2) fjern firma-valg via DevTools `localStorage.removeItem("sitedoc-valgt-firma")`, refresh `/dashbord/kom-i-gang` → forventet redirect til `/dashbord/admin/firmaer`; (3) som **Per Prosjektadmin** (vanlig bruker): `/dashbord/kom-i-gang` viser fortsatt feature-kort + prøveperiode-knapp, klikk oppretter prosjekt på Per Prosjektadmins firma (Byggeleder).

**Faggruppe-side-konsolidering DEPLOYET TIL PROD 2026-05-05** (`d62ffa6c` merge, `5942f396` impl). HTTP/2 200 verifisert mot sitedoc.no. Test-verifisert full CRUD (opprett/rediger/slett + bekreftelsesdialog) som Per Prosjektadmin før prod-deploy. Lukker Tiltak 2 i [navigasjon-arkitektur-analyse-2026-05-03.md](navigasjon-arkitektur-analyse-2026-05-03.md) og er forutsetning for selvstendig A.Markussen-onboarding (per [STATUS-AKTUELT.md § Onboarding-veileder](STATUS-AKTUELT.md)). De to nesten-identiske sidene er erstattet med én konsolidert side.

**Funn under verifisering FØR koding:** Statusrapporten beskrev legacy-siden `/dashbord/prosjekter/[id]/faggrupper` som «full CRUD», men kode-verifisering viste at den kun hadde **opprett**-Modal — ingen rediger eller slett i UI. Server-routeren (`apps/api/src/routes/faggruppe.ts`) har full CRUD inkludert `oppdater` og `slett` (sistnevnte med pen feilmelding ved tilknyttede sjekklister/oppgaver). Konsolideringen krevde derfor å bygge rediger og slett som ikke fantes i UI fra før — ikke ren sammenslåing.

**Endringer:**
- **Klient (`apps/web/src/app/dashbord/[prosjektId]/faggrupper/page.tsx`):** Erstattet read-only tabell + «Administrer faggrupper»-lenke med full CRUD: «Ny faggruppe»-header-knapp, rediger-/slett-ikoner per rad i ny handlinger-kolonne. Tre modaler — `OpprettFaggruppeModal` (firmanavn + org.nr), `RedigerFaggruppeModal` (samme felter, prefylt, lokal id-tracking for state-reset ved bytte av rad), `SlettFaggruppeDialog` (ekte modal per CLAUDE.md UI-regel, viser server-feilmelding hvis koblinger blokkerer slett). Alle felter har `t()` for i18n.
- **Slettet:** `apps/web/src/app/dashbord/prosjekter/[id]/faggrupper/page.tsx` (hard delete — ingen redirect-stub, web-URL-er trenger ikke API-bakoverkompat).
- **Nav-rens (`apps/web/src/app/dashbord/prosjekter/[id]/layout.tsx`):** Fjernet «Faggrupper»-fanen fra tab-nav-arrayet. Fanene Oversikt/Maler/Sjekklister/Oppgaver beholdt — opprydding av hele legacy-`prosjekter/[id]`-strukturen er separat oppgave.
- **Kort-href (`apps/web/src/app/dashbord/prosjekter/[id]/page.tsx`):** Faggrupper-oversiktskortet peker nå til `/dashbord/${id}/faggrupper` (ny rute) i stedet for `${basePath}/faggrupper` (slettet).
- **i18n:** 1 ny nøkkel `faggrupper.bekreftSlett` (nb+en — «Slett faggruppen «{{navn}}»? Dette kan ikke angres.»). Gjenbrukte `faggrupper.{nyFaggruppe,redigerFaggruppe,slettFaggruppe,ingenFaggrupper,ingenFaggrupperBeskrivelse,firma,organisasjonsnummer}` + `handling.{opprett,lagre,slett,avbryt,rediger}` + `dashbord.medlemmer` + `nav.{sjekklister,oppgaver}`.

**Hva konsolideringen IKKE dekker (separate oppgaver):**
- Rediger ansvarlig/farge/partner — Kenneth bekreftet at disse tas i egen runde (ut av scope)
- Soft-delete (deaktiver) — server har det, UI bruker hard delete (Kenneths beslutning, server returnerer pen feilmelding ved koblinger)
- Hele `dashbord/prosjekter/[id]/*`-strukturen — kun Faggrupper-fanen fjernet, andre faner og selve oversiktssiden står igjen
- i18n-nøkkel `faggrupper.administrerBeskrivelse` (gammel hjelpetekst på read-only-siden) — er ikke i bruk lenger, kunne fjernes som opprydding

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (31.7s) — ny rute `/dashbord/[prosjektId]/faggrupper` (3.1 kB) kompilert, legacy `/dashbord/prosjekter/[id]/faggrupper` borte fra build-output. Ingen DB-migrasjon, ingen server-endring (router har full CRUD fra før).

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer som **Per Prosjektadmin** på test: (1) opprett ny faggruppe «Test AS» med org.nr → vises i tabell, (2) rediger til «Test AS Endret» → oppdatert i tabell, (3) prøv slette en faggruppe med tilknyttet sjekkliste → får pen feilmelding fra server («Kan ikke slette ... fordi den har X sjekklister tilknyttet»), (4) slett en faggruppe uten koblinger → forsvinner, (5) verifiser at `/dashbord/prosjekter/[prosjektId]/faggrupper` returnerer 404, (6) verifiser at Faggrupper-fanen er borte fra `/dashbord/prosjekter/[prosjektId]`-tab-nav.

**«Hvem har ballen»-badge på dokument-detaljsider IMPLEMENTERT på develop 2026-05-05.** Lukker funn fra STATUS-AKTUELT.md (2026-05-02): «Inne på dokumentet vises kun status — ingen «Venter på X»». Listene hadde badge fra før — kun detalj-sidene manglet. Server: `sjekkliste.hentMedId` + `oppgave.hentMedId` får `recipientGroup: { select: { id, name } }` på toppnivå (var inkludert i `transfers`-relasjonen, men ikke direkte på dokumentet). Klient: badge ved siden av `<StatusBadge />` i header på `[prosjektId]/sjekklister/[sjekklisteId]/page.tsx` og `[prosjektId]/oppgaver/[oppgaveId]/page.tsx`. Synlig kun når status ∈ {sent, received, in_progress} OG `recipientGroup?.name` finnes — speiler liste-vyenes logikk eksakt. Bruker eksisterende i18n-nøkkel `tabell.venterPaa` (allerede i nb+en, ingen ny nøkkel). Sjekkliste-detalj-siden manglet `useTranslation`-import — lagt til. Oppgave-detalj-siden hadde det fra før.

**Hva «Hvem har ballen»-badge IKKE dekker:**
- `recipientUserId`-tilfellet (transfer sendt til konkret person, ikke gruppe). Speiler listene som også kun viser gruppe. Person-tilfellet kan tas senere hvis det blir etterspurt.
- `<FlytIndikator>`-komponenten på detalj-sidene viser allerede flyten — badge er supplement, ikke erstatning.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (27.3s). Ingen DB-migrasjon, ingen ny i18n.

**Auto-deployes til test via cron.** Klar for verifisering. Claude verifiserer på test som **Per Prosjektadmin**: åpne en sjekkliste/oppgave med status=sent eller received → forventet «Venter på: [gruppenavn]»-badge ved siden av status-pill i header.

**P1 Fase 2 (auto-reset av prosjekt ved firma-bytte) DEPLOYET TIL PROD 2026-05-05** (`5674df71` merge, `26cc0326` impl). HTTP/2 200 verifisert. Sitedoc_admin med valgt firma og aktivt prosjekt fra annet firma (eller standalone) får automatisk reset + redirect til `/dashbord`. Type-utvidelse: `Prosjekt`-interface i klient-konteksten får `primaryOrganizationId: string | null`. Lukker P1 fullt ut sammen med Blokk A.

**P1 Fase 2 (auto-reset av prosjekt ved firma-bytte) IMPLEMENTERT på develop 2026-05-05.** Lukker P1 fullt ut sammen med Blokk A. Femte tiltak fra [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md) (tabell-rad #5).

**Atferd per scenario:**
| Scenario | Før | Etter | Atferd |
|---|---|---|---|
| A | Byggeleder + Byggeleder-prosjekt aktivt | Annet firma | **Reset** + redirect til `/dashbord` |
| B | Byggeleder + Byggeleder-prosjekt aktivt | Byggeleder (idempotent) | Ingen reset |
| C | Ingen firma + Byggeleder-prosjekt aktivt | Byggeleder | Ingen reset |
| D | Ingen firma + A.Markussen-prosjekt aktivt | Byggeleder | **Reset** + redirect |
| E | Byggeleder + Byggeleder-prosjekt aktivt | Fjerner firma-valg (null) | Ingen reset |
| F | Standalone-prosjekt aktivt | Et firma valgt | **Reset** + redirect |

**Endring:** `apps/web/src/kontekst/prosjekt-kontekst.tsx`:
- `Prosjekt`-interface utvidet med `primaryOrganizationId: string | null`. Server returnerer feltet uendret (`prosjekt.hentMedId` bruker `findUniqueOrThrow` uten select-klausul, alle toppnivå-felter inkludert) — ingen server-endring.
- Ny `useEffect` lytter på `valgtFirma`, `valgtProsjekt`, `lasterValgt`. Vakt-rekkefølge: `if (!valgtFirma) return` (ingen begrensning ved null-firma) → `if (lasterValgt) return` (vent på data) → `if (!valgtProsjekt) return` → `if (matched) return`. Ved konflikt: `setLagretProsjektId(null) + localStorage.removeItem(STORAGE_KEY) + router.push("/dashbord")`.

**Hva P1 Fase 2 IKKE dekker:**
- URL-deeplink: hvis sitedoc_admin lim-er en `/dashbord/[prosjektId]/...`-URL og prosjektet ikke matcher valgt firma, vil URL-en dominere over localStorage. Reset trigges først når `hentMedId` returnerer prosjektet og useEffect kjører — kort flicker mulig.
- Auto-velg første prosjekt etter reset: brukeren havner på `/dashbord` (ikke automatisk-redirect). Auto-redirect-logikk i `dashbord/page.tsx` håndterer 1-prosjekt-case.
- Auto-reset ved tilgangstap (separat fra firma-bytte-flow).

**Verifisering:** `pnpm build --filter @sitedoc/web` grønt (27.9s). Ingen DB-migrasjon, ingen i18n, ingen server-endring.

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer som **Tore SiteDocAdmin**: (1) scenario A — velg Byggeleder, åpne et Byggeleder-prosjekt, bytt til annet firma → forventet redirect til `/dashbord`; (2) scenario B — bytte Byggeleder→Byggeleder via FirmaVelger → ingen reset; (3) scenario E — fjern firma-valg via DevTools `localStorage.removeItem("sitedoc-valgt-firma")` → ingen reset.

**Auto-deploy-cron implementert 2026-05-05** (`b4a920b1` på develop). Polling-cron `*/2 * * * *` på serveren erstatter manuell SSH-deploy. Script: `~/programmering/deploy-test-cron.sh`. Logg: `~/programmering/logs/deploy-test.log`. Verifisert end-to-end: push `76a2b4c8` → cron 01:14:00 → deploy fullført 01:14:12 (FULL TURBO 437ms build). Idempotent: kjører kun ved diff mellom HEAD og origin/develop. Funnet under undersøkelse: Tidligere «auto-deploy-hook» nevnt i SITEDOC-CLAUDE-VEILEDER.md var dokumentasjons-drift — ingen mekanisme har eksistert til nå (verifisert ved sjekk av lokale + server git-hooks, GitHub Actions, PM2-prosesser, crontab og systemd). Cloudflare Access via tunneled SSH gjorde GitHub Actions-veien mer kompleks enn polling-cron — derfor cron-løsningen.

**Blokk C (P2 — admin/firmaer erKunde-filter + Timer-kolonne) DEPLOYET TIL PROD 2026-05-04** (`e2729849` merge, `261a0c8e` impl). Tredje del av [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md) (tiltak #3 i prioritert tiltak-rekkefølge). Lukker P2-funnet: skall-firmaer blandes ikke lenger med kunde-firmaer i admin-vyen, og Timer-modul-status er synlig på linje med Maskin.

**Endringer:**
- **Server (`apps/api/src/routes/admin.ts`):** `hentAlleOrganisasjoner` får `where: { erKunde: true }` på `findMany`. Ingen klient-endring kreves for filteret. Test-DB: filteret skjuler 4 skall-firmaer (Byggherre, Tømrer Hansen, Elektrikker Hansen, Hovedentreprenør) og viser kun Byggeleder. Prod-DB: viser A.Markussen, HRP AS og Kenneths testmiljø — 0 skall-firmaer å filtrere ut.
- **Klient (`apps/web/src/app/dashbord/admin/firmaer/page.tsx`):**
  - Type `OrganisasjonRad` utvidet med `harTimerModul: boolean`.
  - `Clock`-ikon importert fra lucide-react.
  - Tabell-header: ny `<th>Timer</th>` plassert mellom Integrasjoner og Maskin (matcher rekkefølgen i `firma/moduler`).
  - `FirmaRad`-celle for Timer: speiler Maskin-celle-stilen (Clock-ikon + grønn «Ja» når aktivert, grå «Nei» ellers).
  - Slide-over-detaljpanel: ny Timer-modul-status-seksjon FØR Maskin-modul-status-seksjonen (samme rekkefølge og stil — `Clock`-ikon, Aktivert/Ikke aktivert, peker til `/dashbord/firma/moduler` for endring).
- Ingen ny i18n (eksisterende kolonne-overskrifter på siden er hardkodet i samme stil — i18n-konvertering er separat opprydningsoppgave).

**Hva Blokk C IKKE dekker:**
- Skall-firma-toggle eller debug-vy: skall-firmaer er nå fullstendig usynlige fra admin-vyen. Hvis sitedoc_admin trenger å se dem (debug, opprydning) må de gå via psql.
- Abonnement-status / fakturaoversikt (P5 — egen design-runde, ~1-2 dager).
- Klikk-til-firma-admin (klikke firma → se firmaets prosjekter): slide-over viser allerede prosjekter, men ingen direkte snarvei til `/dashbord/firma/*`-administrasjon. Separat oppgave.
- i18n-konvertering av admin-vyen: hele siden har hardkodet norsk tekst. Ikke i scope for Blokk C.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (34.8s). Ingen DB-migrasjon, ingen i18n.

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer som **Tore SiteDocAdmin** på `/dashbord/admin/firmaer`: (1) listen viser kun Byggeleder (skall-firmaer skjult), (2) Timer-kolonne synlig mellom Integrasjoner og Maskin, (3) Byggeleder viser Ja for både Timer og Maskin (har_timer_modul=true, har_maskin_modul=true), (4) klikk på Byggeleder-rad åpner slide-over med både Timer-modul-seksjon og Maskin-modul-seksjon.

**Blokk A (P1 Fase 1 — prosjektliste filtreres på valgt firma) DEPLOYET TIL PROD 2026-05-04** (`12717426` merge, `51d5e3ee` impl). Andre del av [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md) (tiltak #2). HTTP/2 200 verifisert mot sitedoc.no. Sitedoc_admin med valgt firma i FirmaVelger ser nå kun prosjekter med matchende `primaryOrganizationId`. Server: `prosjekt.hentMine`+`hentAlle` tar valgfri `organizationId`. Klient: 4 callsites migrert (prosjekt-kontekst, dashbord, prosjekter-listing, timer/mine). Tom-state for sitedoc_admin med valgt firma og 0 prosjekter får firmaspesifikk tekst (1 ny i18n-nøkkel `dashbord.ingenProsjekterForFirmaBeskrivelse` nb+en). Bakfyll test-DB: 2 prosjekter satt til Byggeleder. Vanlig bruker / company_admin uberørt — `members.some.userId`-filter beholder isolasjon. Auto-reset av aktivt prosjekt ved firma-bytte er P1 Fase 2 (utsatt).

**Klikkbare prosjektrader på `/dashbord/firma/prosjekter` DEPLOYET TIL PROD 2026-05-04** (`dbf78bca` merge, `59338895` impl). Blokk B fra [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md) (tiltak #7 — quick-win før Blokk A). HTTP/2 200 verifisert mot sitedoc.no. Hele tabellraden navigerer til `/dashbord/[id]` ved klikk; `<Link>` på prosjektnavnet beholdt for cmd/ctrl+click + tastatur-fokus. `onClick` hopper over hvis target er innenfor `<a>`-tag. 1 fil endret (7 linjer).

**Header-fix per rolle DEPLOYET TIL PROD 2026-05-04** (`e3717a8c` merge, `f78113c5` impl). HTTP/2 200 verifisert mot sitedoc.no. Toppbar-rekkefølge per Kenneths rolle-spec av 2026-05-04 (etter korreksjonen 2026-05-03 om at Prosjekt er firmamodul, ikke toppnivå-entitet, dokumentert i [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md)).

**Endringer per rolle:**
| Rolle | Header (venstre → høyre) |
|---|---|
| sitedoc_admin | SiteDoc \| **FirmaVelger** \| Prosjekt \| (Byggeplass) \| Admin-knapp |
| company_admin | SiteDoc \| **Firma-fast-link** \| Prosjekt \| (Byggeplass) |
| user | SiteDoc \| Prosjekt \| (Byggeplass) — ingen firma-element |

**Tre filer endret (ingen schema, ingen RBAC, ingen auth):**
- `apps/web/src/kontekst/firma-kontekst.tsx`: utvidet med `erCompanyAdmin: boolean` (utledet fra eksisterende `minBruker.role`-data, ingen ny query). Brukes av Toppbar for å skille company_admin fra vanlig bruker.
- `apps/web/src/components/layout/FirmaVelger.tsx`: `router.push("/dashbord/firma")` lagt til etter `velgFirma()` slik at sitedoc_admin lander direkte i firma-admin-flyten ved firma-valg.
- `apps/web/src/components/layout/Toppbar.tsx`: JSX-omarrangering — firma-element flyttet FORAN ProsjektVelger for sitedoc_admin og company_admin. Vanlig bruker får ingen firma-link i toppbar lenger (tidligere fikk alle med `organizationId`-tilknytning fast firma-link via `organisasjon`-fallback). Duplisert `erSiteDocAdmin`-sjekk fra `trpc.admin.erAdmin` fjernet — `erSitedocAdmin` fra `useFirma()` er eneste kilde. `organisasjon.hentMin` enables nå kun for `erCompanyAdmin`.

**Test-deploy:** Manuell deploy nødvendig (auto-deploy-hooken trigget ikke — tredje gang i denne sesjonen, bør undersøkes separat).

**Hva header-fix IKKE løser (fortsatt åpne planlagte oppgaver):**
- Filtrering av prosjektliste på `primaryOrganizationId = valgtFirma.id` (P1 Fase 1, ~3-4t)
- Auto-reset av aktivt prosjekt ved firma-bytte (P1 Fase 2, ~2-3t)
- Bakfyll test-DB `primary_organization_id` (5 min, blokkerende for P1)
- admin/firmaer: `erKunde`-filter + Timer-kolonne (P2, ~2t)
- Admin-navigasjon redesign + abonnement-modell (P4+P5, ~1-2 dager)

Header-fix dekker rekkefølge-signalet og redirect-friksjonen, men det reelle hierarki-håndhevet (firma → prosjekter under firma) krever P1-arbeidet som står på vent.

**Cache-invalidering verifisert 2026-05-04:** `apps/web/src/app/dashbord/firma/innstillinger/page.tsx:38-44` invaliderer allerede `hentMedId` + `hentMin` + `hentTilgjengelige` ved oppdater-mutation. Ingen kode-endring nødvendig — sidebar-tittel og FirmaVelger oppdateres korrekt etter firma-info-endring.

**Steg 4a (ECO-flytt på attestering) DEPLOYET TIL PROD 2026-05-03** (`da6b34a5` merge, `f98fa7a5` impl). HTTP/2 200 verifisert mot sitedoc.no. Test-deploy krevde manuell trigger (auto-deploy-hooken trigget ikke — andre gang etter Steg 1a, bør undersøkes separat). Test-verifisert på test.sitedoc.no som Per Prosjektadmin: leder-detaljsiden åpner sedlen, ECO-velger inline på timer-rader, action-bar med Returner/Attester fungerer. Beslutning fra Kenneth/Claude før koding: scope er kun ECO-flytt (samme prosjekt), ikke cross-prosjekt. 4b (Vareforbruk) utsettes til etter Steg 1e (OrganizationModule). 4c (Godkjenning UI) starter nå.

**Endringer:**
- **Server (`apps/api/src/routes/timer/dagsseddel.ts`):**
  - Ny `flyttTimerRadEco({ timerRadId, externalCostObjectId: string | null })`-mutation. Gates med `krevProsjektLeder(ctxUserId, sheet.projectId)`. Status-vakt: kun `sent` tillates (returned er hos ansatten, accepted er låst av snapshot, draft har aldri vært innom leder). ECO-validering hvis ikke null: `slettetVed=null`, `organizationId === sheet.organizationId`, `projectId === sheet.projectId`, `status="aktiv"`, `timerregistreringApen=true`. Activity-log (best-effort try/catch) skriver `target_type=sheet_timer`, `action=timer.eco-flyttet`, payload `{sheetId, fraEcoId, tilEcoId}` — ikke-blokkerende ved feil siden selve flyttingen allerede er committed.
  - Ny `hentForAttestering({id})`-query. Autoriserer på `krevProsjektLeder` i stedet for `hentEgenDagsseddel` (som krever eierskap eller sitedoc_admin/company_admin med matchende org). Beriker med ansatt-info fra kjernen-DB. Løser eksisterende svakhet der Per Prosjektadmin ikke kunne åpne ansattens detaljside fra attestering-tabellen.
- **Klient (`apps/web/src/app/dashbord/[prosjektId]/timer/attestering/[id]/page.tsx`):** Ny dedikert leder-detaljside. Header med dato, prosjektnavn, ansatt-info og StatusBadge. 4 seksjoner: Detaljer (read-only), Timer-rader (ECO-felt redigerbart inline via `<select>` + fjern-X-knapp, øvrige felter read-only), Tillegg (read-only, vises kun hvis rader finnes), Maskin (read-only, vises kun hvis rader finnes). Action-bar nederst med Returner-knapp (åpner kommentar-modal) + Attester-knapp. ReturnerDialog gjenbruker eksisterende returner-mutation fra Runde 1C. Ikke-sent-sedler viser fallback-melding «Sedlen kan ikke endres ({{status}})».
- **Klient (`apps/web/src/app/dashbord/[prosjektId]/timer/attestering/page.tsx`):** Chevron-lenken i tabellraden navigerer nå til `/timer/attestering/${rad.id}` (ny leder-rute) i stedet for `/timer/${rad.id}` (ansattens detaljside). Tidligere lenke ga FORBIDDEN for Per Prosjektadmin (User.role="user" + ProjectMember.role="admin") siden ansattens `hentMedId` kun aksepterer eierskap eller sitedoc_admin/company_admin.
- **i18n:** 5 nye nøkler under `timer.attestering.flyttEco.{etikett,ingenEco,fjernEco}` + `timer.attestering.tilbake` + `timer.attestering.detalj.ikkeRedigerbar` i nb+en.

**Hva 4a IKKE dekker:**
- Cross-prosjekt-flytt (avklart utenfor scope — krever DailySheet-rekonstruksjon pga `(userId, projectId, dato)` UNIQUE).
- Endring av lønnsart/timer/aktivitet/beskrivelse/klokkeslett — er ansattens domene, returneres ved behov.
- Bulk-flytt (én rad om gangen — ingen multi-select).
- Mobil leder-attestering (kun web — Runde 2-godkjent scope).
- Auto-revert ved attestering — snapshot-pattern (A.7) låser uansett.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (34.5s) — ny rute `/dashbord/[prosjektId]/timer/attestering/[id]` (4.71 kB) kompilert. Ingen DB-migrasjon.

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Etter test-deploy skal Claude verifisere som innlogget Per Prosjektadmin (ke.myrhau@gmail.com): (1) åpne sedel fra Ola Tømrer i `/dashbord/[prosjektId]/timer/attestering/[id]`, (2) bytt ECO på en rad og fjern ECO fra annen, (3) attester sedlen og verifiser via psql at `attestertSnapshot` reflekterer nye ECO-verdiene, (4) som Ola Tømrer (vanlig bruker): bekreft at `/attestering/[id]`-ruten returnerer FORBIDDEN.

**Steg 3 (maskin-import med firma-kontekst) DEPLOYET TIL PROD 2026-05-03** (`33a2b9b4` merge, `e7ddc397` impl). HTTP/2 200 verifisert mot `/dashbord/maskin/import` på sitedoc.no.

**A.Markussen-maskinimport gjennomført på prod 2026-05-03.** Kenneth utførte importen via UI som sitedoc_admin med A.Markussen (`4488fe17-7490-409f-9c1c-2827f257c54d`) valgt i FirmaVelger. Verifisert via psql:
- **Equipment-tellinger:** 124 totalt — 36 kjøretøy + 50 anleggsmaskin + 38 småutstyr (matcher SmartDok-undersøkelsens forventning fra 126-rad Excel: 125 importerbare minus 1 testrad → 124)
- **Registreringsnumre:** 36 (alle kjøretøy har gyldig regnr — matcher prosjektert 36)
- **Eierskap leid:** 11 (9XXX-internnumre per A.Markussen-konvensjon)
- **Vegvesen-kø:** 36 rader prioritet=200 opprettet ved import. Ved verifisering: 2 fullført + 34 ventende. Worker plukker én av gangen via 60s-polling — naturlig spredning over ~34 min for resten.

Steg 1+2+3 fra prioritert byggerekkefølge er nå komplett. Gjenstår: Steg 4 (Dagsseddel-utvidelser) som omfatter 4a Timer-admin (flytt prosjekt↔ECO), 4b Vareforbruk (SheetMaterial-tabell), 4c Godkjenning UI (byggherre-flyt). Steg 3 fra prioritert byggerekkefølge — to deler.

**3a — Koble import til FirmaVelger + erKunde-filter:**
- Server: ny `krevErKundeFirma(organizationId)`-helper i `apps/api/src/trpc/tilgangskontroll.ts` som validerer `Organization.erKunde === true` (NOT_FOUND hvis firma ikke finnes; FORBIDDEN hvis erKunde=false). Brukt i lokal `verifiserFirmaAdmin`-helper i `apps/api/src/routes/maskin/import.ts` slik at både `importerForhandsvisning` og `importerBekreft` blokkerer skall-firma-import. Skall-firmaer (byggherre, UE uten SiteDoc-konto) skal ikke kunne være mål for SmartDok-import siden de ikke bruker maskinregisteret.
- Klient: `useFirma()` brukes allerede (fra Steg 1b Fase B-migrering) — ingen endring i denne delen. La til tom-state hvis sitedoc_admin ikke har valgt firma: `{steg === "opplastning" && !orgId && <div>{t("firma.maskin.import.velgFirma")}</div>}` viser «Velg et kunde-firma fra toppmenyen før du kan importere».

**3b — Fil-upload UI klikkbar drag-and-drop:**
- Konvertert fra ren label til label med drag-and-drop-handlere: `onDragOver` (preventDefault + setDrarOver(true)), `onDragLeave` (setDrarOver(false)), `onDrop` (preventDefault + setDrarOver(false) + handleFilValg(e.dataTransfer.files[0])). Ny `drarOver`-state styrer visuell feedback: ved drag-over endres border til `border-sitedoc-primary` og bakgrunn til `bg-blue-50` (sterkere enn hover-statet). UploadCloud-ikonet farges også blått ved drag.
- Klikk-funksjonalitet beholdt via eksisterende label/input-mønster — klikk hvor som helst i sonen åpner filvelger.
- Validering uendret: `accept=".xlsx"` på input + sjekk på filnavn-extension i `handleFilValg`.

**Hva 3 IKKE dekker:**
- Multi-fil-support (én fil av gangen) — ikke etterspurt.
- Andre import-formater (CSV, andre Excel-strukturer) — kun SmartDok-format støttes per nå.
- Validering at filen faktisk er en SmartDok-eksport — fanges i `parseSmartDokXlsx`-parseren downstream.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (34.0s).

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer (1) at sitedoc_admin uten valgt firma ser tom-state, (2) at drag-and-drop med .xlsx fungerer (visuell feedback + opplasting), (3) at FORBIDDEN returneres hvis sitedoc_admin via DevTools sender et skall-firma-orgId (valgfri).

**Steg 2 (firma-admin-sider) DEPLOYET TIL PROD 2026-05-03** (`a1463561` merge — samlet 2b+2c+2d, 2a var allerede komplett). HTTP/2 200 verifisert mot `/dashbord/firma/moduler`, `/dashbord/firma/innstillinger`, `/dashbord/nytt-prosjekt`. Ingen DB-migrasjoner i Steg 2. Funksjonell verifisering på test før prod-deploy: sitedoc_admin (Tore) opprettet prosjekt for Byggeleder via firma-kontekst → primary_organization_id satt korrekt + 2 ProjectModule-rader (timer + maskin, status=aktiv) auto-opprettet.

**Steg 2d (prosjekt fra firma-kontekst) IMPLEMENTERT på develop 2026-05-03.** Tredje og siste del av Steg 2. Server tar nå valgfri `organizationId` i prosjekt-opprettelsen, klient sender valgtFirma.id, og duplikat-fil slettet.

**Endringer:**
- **Server (`apps/api/src/routes/prosjekt.ts`):** `createProjectSchema` utvidet med `organizationId: z.string().uuid().optional()` i `packages/shared/src/validation/index.ts`. `prosjekt.opprett` autoriserer mot bruker-rolle: sitedoc_admin → tilgang til enhver org; ellers krever input.organizationId === bruker.organizationId, eller FORBIDDEN. Falleback: hvis input.organizationId ikke gitt, bruk bruker.organizationId. Den valgte orgId-en brukes for: (1) `Project.primaryOrganizationId` (manglet før Steg 2d — eksisterende prosjekter hadde ProjectOrganization-rad men ikke primaryOrganizationId), (2) ProjectOrganization-rad, (3) ProjectModule-rader for aktive firmamoduler. `opprettTestprosjekt` setter også `primaryOrganizationId` (samme manglende fix). Stripper `organizationId` fra spread-input til Project-data (det er ikke en kolonne på Project-modellen).
- **Klient (`apps/web/src/app/dashbord/nytt-prosjekt/page.tsx`):** importer `useFirma`, sender `valgtFirma?.id` som `organizationId` i mutation. Info-banner (Building2-ikon + blå bakgrunn) vises kun for sitedoc_admin med valgt kunde-firma («Prosjektet opprettes for [firma-navn]. Bytt firma i toppmenyen for å opprette på vegne av et annet firma.»). For vanlige brukere er banneret skjult — de oppretter alltid for sitt eget firma uten valg.
- **Duplikat-rensing:** `apps/web/src/app/dashbord/prosjekter/nytt/page.tsx` slettet. Var orphan-fil — alle 4 lenker i kodebasen pekte til `/dashbord/nytt-prosjekt`. Forskjellen var redirect (`/dashbord/${id}` vs `/dashbord/prosjekter/${id}`); den slettete pekte til legacy-rute som ikke har full subnavigasjon.
- 1 ny i18n-nøkkel `nyttProsjekt.opprettesFor` (nb+en).

**Hva 2d IKKE dekker:**
- Per-bruker-default-firma (hvilket firma settes som valgt i FirmaVelger ved første pålogging) — ikke scope.
- Validering på server-side at det valgte firmaet faktisk er `erKunde:true` — ikke nødvendig nå siden FirmaVelger allerede filtrerer på `erKunde:true`. Men kan legges til senere som ekstra forsvar.
- Legacy-rute `/dashbord/prosjekter/[id]/*` (som har færre undersider enn `/dashbord/[prosjektId]/*`) er ikke ryddet i scope for 2d — separat opprydningsoppgave.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (35.0s).

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer (1) at sitedoc_admin (Tore) kan velge Byggeleder i FirmaVelger og opprette prosjekt med korrekt primaryOrganizationId, (2) at info-banneret vises, (3) at vanlig bruker (Kari Firmaadmin) opprettelse av prosjekt fungerer som før, (4) at ProjectModule-rader auto-opprettes (Steg 1c-flow gjenbrukes). **Steg 2 komplett etter dette — alle 4 sub-oppgaver dekket** (2a allerede komplett før, 2b+2c+2d nå deployet).

**Steg 2c (OrganizationSetting-UI) IMPLEMENTERT på develop 2026-05-03.** Andre del av Steg 2 fra prioritert byggerekkefølge. Utvider `/dashbord/firma/innstillinger`-siden med 4 nye seksjoner som dekker alle gjenværende OrganizationSetting-felter (kompetanse-policy var allerede dekket fra Fase 0.5).

**Endringer:**
- `apps/web/src/app/dashbord/firma/innstillinger/page.tsx`:
  - Ny `TidssoneSeksjon`-komponent: dropdown med 7 tidssoner (Europe/Oslo default + Stockholm/København/Helsinki/Berlin/London/UTC). Bruker `organisasjon.oppdaterSetting`-mutation. Endring lagres umiddelbart ved valg (ingen separat lagre-knapp).
  - Ny generisk `TilgangPolicySeksjon`-komponent: tar `felt`-prop (timerTilgangDefault | vareforbrukTilgangDefault | maskinbrukTilgangDefault) + tittel/beskrivelse-i18n-nøkler. Renderer 3 radio-knapper med samme verdi-sett: `alle-ansatte` / `kun-prosjektmedlemmer` / `sertifiserte` (matcher Zod-enum i `oppdaterSetting`-mutation). Eliminerer dobling av kode for de tre tilgang-feltene som har identisk UI-mønster.
  - Tre `<TilgangPolicySeksjon>`-instanser instansiert med ulike felt: Timer, Vareforbruk, Maskinbruk. Plassering: under firma-info-skjemaet, mellom Tidssone og Kompetanse-policy.
  - `KompetansePolicySeksjon` (eksisterende fra Fase 0.5) beholdt som siste seksjon — har annen verdi-mengde (`firma_admin`/`bruker_egen`/`alle`) så ikke gjenbrukes via `TilgangPolicySeksjon`.
- 14 nye i18n-nøkler under `firma.innstillinger.tidssone.*` + `firma.innstillinger.tilgang{Timer,Vareforbruk,Maskinbruk}.*` + `firma.innstillinger.tilgangVerdi.{alle-ansatte,kun-prosjektmedlemmer,sertifiserte}.*` i nb+en.

**Hva 2c IKKE dekker:**
- Eksisterende `KompetansePolicySeksjon` har hardkodede norske strenger (etablert i Fase 0.5 § 2). Konvertering til i18n er separat opprydningsoppgave — ikke scope for 2c.
- Per-prosjekt-overstyring av disse defaultene er ikke bygget — de er kun «default ved opprettelse av nytt prosjekt» foreløpig. Faktisk respekt-i-runtime av `timerTilgangDefault`/`vareforbrukTilgangDefault`/`maskinbrukTilgangDefault` på prosjekt-nivå er ikke bygget — det blir senere når Vareforbruk-modul + Maskinbruk-flow kommer.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (33.7s).

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer at alle 5 seksjoner (firma-info + tidssone + 3 tilgang + kompetanse-policy) lastes og at endringer persisteres i OrganizationSetting-tabellen.

**Steg 2b (firmamodul-styring UI) DEPLOYET TIL TEST 2026-05-03** (`25cd7675`). Verifisert som innlogget Kari Firmaadmin: aktivere/deaktivere Timer/Maskin fungerer end-to-end, ProjectModule-rader synkroniserer korrekt, sidebar oppdateres. Klar for prod (avventer 2c+2d før samlet prod-deploy). Første del av Steg 2 fra prioritert byggerekkefølge. Ny dedikert side `/dashbord/firma/moduler` for å aktivere/deaktivere firmamoduler — erstatter den manuelle `UPDATE organizations SET har_*_modul = true`-prosedyren som tidligere var dokumentert i `admin/firmaer/page.tsx`-modal.

**Endringer:**
- Ny fil `apps/web/src/app/dashbord/firma/moduler/page.tsx` — skalerbar konfig-tabell (`MODULER`-array) med 5 moduler: timer + maskin (status: `tilgjengelig`), kompetanse + fremdrift + varelager (status: `kommer-snart`). Bare `tilgjengelig`-moduler har funksjonelle toggles.
- Hver kort: ikon (Lucide), navn, beskrivelse, status-badge («Aktivert» grønn / «Kommer snart» grå), Aktiver/Deaktiver-knapp. Aktivering = direkte mutation (idempotent — `settFirmamodul` håndterer både ny aktivering og reaktivering). Deaktivering = `Modal`-bekreftelse fra `@sitedoc/ui` med advarsel («Modulen settes som arkivert på alle prosjekter firmaet er knyttet til. Data slettes ikke — du kan reaktivere senere.»).
- Bruker `useFirma().valgtFirma.harTimerModul`/`harMaskinModul` for status-visning og `organisasjon.settFirmamodul`-mutation fra Steg 1c. Cache-invalidering på `hentTilgjengelige`/`hentMin`/`hentMedId`.
- `apps/web/src/app/dashbord/firma/layout.tsx` — nytt menyelement «Moduler» (Boxes-ikon) plassert mellom Kompetanse og Timer. Synlig for alle firma-admin-brukere uavhengig av modul-status.
- `apps/web/src/app/dashbord/admin/firmaer/page.tsx` — SQL-instruks i firma-detaljmodal erstattet med peker til ny side («Velg firmaet i FirmaVelger og gå til /dashbord/firma/moduler»). Tabellradens harMaskinModul-visning beholdt uendret (oversikts-info, ikke handling).
- ~22 nye i18n-nøkler under `firma.moduler.*` i nb.json + en.json: tittel/beskrivelse/aktiver/deaktiver/aktivert/kommer-snart/dialog-tekster + per-modul navn/beskrivelse for alle 5 moduler.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (34.7s).

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer (1) at sitedoc_admin (Tore) ser den nye «Moduler»-menyelement etter å ha valgt et kunde-firma, (2) at toggle Timer/Maskin off+on virker end-to-end, (3) at deaktivering syncer ProjectModule-rader til `status="arkivert"`, (4) at sidebaren oppdateres når Timer aktiveres/deaktiveres for valgt firma. 2c (OrganizationSetting-UI med tidssone + 3 tilgang-toggles) + 2d (prosjekt fra firma-kontekst, server+klient) avventer grønt lys.

**Steg 1d (ProjectModule final cleanup, forkortet) DEPLOYET TIL PROD 2026-05-03** (`73dcbd1a` merge, `ec0ce969` impl). Migrasjon `20260503020000_drop_project_module_active` applied på sitedoc + sitedoc_test. DB-schema verifisert begge miljøer: `active`-kolonnen borte fra `project_modules`. HTTP/2 200 web, HTTP/2 204 API. Migrasjon `20260503020000_drop_project_module_active` — `ALTER TABLE project_modules DROP COLUMN IF EXISTS active`. Verifisering før drop: grep `\.active` mot apps/api/apps/web/apps/mobile returnerte 0 ProjectModule-relaterte treff (eneste treff er `Project.status`-enum i prosjekt.ts, ulik modell). Schema-rens: `active Boolean`-feltet fjernet fra `ProjectModule`-modellen, kommentar oppdatert til endelig modell. Unique `(project_id, module_slug)` beholdes — cross-org-unique `(projectId, organizationId, moduleSlug)` flyttet til Steg 1e fordi den kun er meningsfull for firmamoduler (timer/maskin), ikke for prosjektmoduler (oversettelse/PSI/kontrollplan/etc. har 14 av 16 callsites og bør forbli én rad per prosjekt). To-stegs migration-policy A.18 oppfylt: `status`-feltet ble lagt til i `20260501000005` (deployet til prod 2026-05-01); denne migrasjonen er steg 2. `pnpm typecheck` + `pnpm build --filter @sitedoc/web` grønt. Klar for test-deploy.

**Steg 1c (OrganizationModule-overgang) DEPLOYET TIL PROD 2026-05-03** (`87fb7292` merge, `d581e399` Fase A+B + `6921ffea` mini-Fase C). Migrasjon `20260503010000_steg_1c_module_backfill` applied på sitedoc + sitedoc_test. Bakfyll-tellinger: 0 rader på begge DB-er (kunde-firma har 0 prosjekter med primary-rolle ennå — auto-sync hooket aktiveres ved første prosjekt-opprettelse). HTTP/2 200 web, HTTP/2 204 API. Test-verifisert som innlogget Kari Firmaadmin før prod-deploy: nytt prosjekt → 2 ProjectModule-rader auto-opprettet (timer+maskin, status=aktiv, organization_id=Byggeleder). Tredje steg i prioritert byggerekkefølge ferdig.

**Mini-Fase C lukker Steg 1c (kommentar-rens, ikke drop):** Drop av `har_*_modul`-kolonner krever en `OrganizationModule`-tabell — firma uten prosjekter trenger flagget for å onboarde lønnsarter (A.Markussen-flow). Den jobben er utsatt til **Steg 1e** (fremtidig). Kommentarer i `schema.prisma` + `moduleGate.ts` oppdatert til endelig to-nivås-modell. Steg 1d (drop `active Boolean` + ny unique på ProjectModule) er uavhengig og påvirkes ikke.

**Fase A — datamodell + bakfyll (server-side, bakoverkompatibel):**
- Migrasjon `20260503010000_steg_1c_module_backfill` — INSERT ProjectModule(slug=timer/maskin, organizationId, status="aktiv") for alle prosjekter der primary_organization har flagget aktivert. Idempotent via `ON CONFLICT (project_id, module_slug) DO NOTHING`. Forhåndsverifisert mot test-DB (Byggeleder: 0 prosjekter med primary-rolle) og prod-DB (A.Markussen: 0 prosjekter) — migrasjonen er ren no-op safety-net nå, og blir aktiv først når kunde-firma kobles til sitt første prosjekt (via Fase B-hooks).
- Service-utvidelse: `erTimerAktivert/krevTimerAktivert` + `erMaskinAktivert/krevMaskinAktivert` tar valgfri `projectId`-param. Uten projectId: kun firma-bredt flagg (bakoverkompatibel — alle eksisterende callsites uendret). Med projectId: krever både firma-flagg OG `ProjectModule.status="aktiv"` for `(projectId, slug, organizationId)`. Error-meldinger differensierer mellom firma-scope og prosjekt-scope.

**Fase B — auto-sync-hooks + klient-migrering:**
- **`prosjekt.opprett`** (`apps/api/src/routes/prosjekt.ts`): refaktorert fra direkte create til `$transaction`. Henter brukerens `organizationId` og firma-flagg (har_timer_modul, har_maskin_modul) før transaction. I transaction: oppretter Project + ProjectOrganization + ProjectModule-rader (createMany med skipDuplicates) for hver aktive firmamodul.
- **`prosjekt.opprettTestprosjekt`**: tilsvarende — etter ProjectOrganization.create i eksisterende transaction, opprettes ProjectModule-rader for aktive firmamoduler.
- **Ny service-helper `apps/api/src/services/firmamodul.ts`** med `syncProjektModulerPaaAktiver(tx, organizationId, slug)` + `syncProjektModulerPaaDeaktiver(tx, organizationId, slug)`. Aktiver-versjonen henter alle prosjekter firmaet er knyttet til (primary OR ProjectOrganization-partner), reaktiverer eksisterende ikke-aktive rader via updateMany, og oppretter nye via createMany med skipDuplicates. Deaktiver-versjonen setter alle aktive rader til status="arkivert" (rader beholdes — historikk bevares).
- **Ny mutation `organisasjon.settFirmamodul({ organizationId, slug: "timer"|"maskin", aktiver: boolean })`**. Polymorf — dekker timer/maskin × aktiver/deaktiver. Setter har_*_modul-flagg + syncer ProjectModule i samme `$transaction`. Gates med `verifiserFirmaAdmin` (sitedoc_admin + firmaets company_admin). UI-knapp ikke bygget ennå — Kenneth/sitedoc_admin kan kalle direkte fra tRPC eller via UI som bygges i Steg 2b (firmamodul-styring under firma-admin).
- **`timer/onboarding.aktiverNivaa1`**: refaktorert til `$transaction` som setter harTimerModul + kaller syncProjektModulerPaaAktiver. Sikrer at ProjectModule-rader genereres når Timer-modul aktiveres for første gang via onboarding-flow (selv uten å bruke settFirmamodul).
- **`timer/onboarding.aktiverTomKatalog`**: tilsvarende refaktor.
- **`HovedSidebar.tsx` migrering**: Timer-elementer (`timer` + `timer-attestering`) i prosjekt-sidebar gates nå på `aktiveModuler.some(m => m.moduleSlug === "timer" && m.status === "aktiv")` (allerede hentet via `trpc.modul.hentForProsjekt`) i stedet for firma-flagg `harTimerModul`. Variabel `harTimerModul` erstattet med `harTimerModulPaaProsjekt`. Maskin-bunnelement (global lenke til `/dashbord/maskin`) beholder `harMaskinModul`-flagget siden bunn-elementet ikke er prosjekt-spesifikk.

**Hva Steg 1c IKKE gjør:**
- Fortsatt cross-org-aktivering på samme prosjekt (UE-firma med Timer-modul på A.Markussens prosjekt) er blokkert av dagens unique `(project_id, module_slug)`. Det åpnes opp i Steg 1d.
- Drop `active Boolean`-kolonne på ProjectModule + endre unique-indeks → Steg 1d (krever CI-grep for `projectId_moduleSlug`).
- Drop `har_timer_modul`/`har_maskin_modul`-kolonner på Organization → Steg 1c Fase C (avventer test-verifisering av Fase B).
- Klient-UI for firmamodul-toggle på `/dashbord/firma/innstillinger` eller egen side → Steg 2b. Mutationen `settFirmamodul` er klar å brukes så snart UI bygges.

**Verifisering:**
- `pnpm --filter @sitedoc/api typecheck` grønt
- `pnpm build --filter @sitedoc/web` grønt (37.2s)

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer (1) at sitedoc_admin (Tore) kan opprette prosjekt for A.Markussen-kontekst og at ProjectModule-rader for timer+maskin opprettes automatisk, (2) at Timer-elementene vises i prosjekt-sidebar når modul er aktiv, og (3) at `settFirmamodul`-mutationen fungerer end-to-end (kall via DevTools eller test-script). Etter verifisering: grønt lys for Fase C (drop midlertidige flagg).

**Steg 1b Fase A+B+C DEPLOYET TIL PROD 2026-05-03** (`045a49b7` merge). Hele Steg 1b komplett. Sitedoc_admin kan nå velge et hvilket som helst kunde-firma i FirmaVelger og se/redigere det firmaets data på alle firma-admin-undersider. Eier-firma-rename live i prod. HTTP 200 verifisert. Innlogget verifisering anbefales for å bekrefte A.Markussen-kunde fortsatt fungerer.

**Steg 1b Fase C (firma-kontekst — innstramning + Eier-firma-rename) IMPLEMENTERT på develop 2026-05-03** — tredje og siste del av tre-fasers strategi. Etter denne fasen er fundamentet for global firma-kontekst komplett.

**Endringer:**
- **Server (9 router-filer):** `verifiserFirmaAdmin`-helper forenklet til thin wrapper rundt `autoriserAdminForFirma`. Fallback-grenen til `bruker.organizationId` droppet — orgId er nå PÅKREVD for alle write-mutationer. Filer: organisasjon, avdeling, kompetanse, kompetansetype (kun write-mutations), timer/{onboarding (kun aktiver*), lonnsart/aktivitet/tillegg (kun opprett/oppdater/deaktiver)}, maskin/import.
- **Read-only ruter beholder fallback:** `timer.{lonnsart,aktivitet,tillegg}.list`, `timer.onboarding.status`, `kompetansetype.hentAlle` har fortsatt `hentBrukerOrgId(userId, inputOrgId?)` — disse brukes fra prosjekt-baserte dagsseddel-sider hvor ansatte skal se sitt eget firmas katalog uten å eksplisitt bytte. Beslutningen er bevisst: ansatte (ikke firma-admin) trenger ikke firma-velger.
- **Klient (~30 callsites):** alle `organizationId: orgId` byttet til `organizationId: orgId!` — non-null assertion. Etablert mønster siden `firma/layout.tsx` gates på `valgtFirma` (ingen children rendres uten valgt firma).
- **Lag 3 — rename:** `oppsett.firmainnstillinger` i14n-nøkkel: nb «Firmainnstillinger» → «Eier-firma», en «Company settings» → «Owner company». H1-overskrift på `/dashbord/oppsett/firma` hardkodet rename til «Eier-firma». Foreldrekategorien «Prosjekteier» (linje 75-78 i `oppsett/layout.tsx`) eksisterte allerede — kun subelementets navn endret for å unngå navnkollisjon. Andre 12 språkfiler beholder eksisterende oversettelse (samme mønster som tidligere terminologi-renames per timer-attestering 2026-05-02).
- **Fix:** `oppsett/firma/page.tsx` `lagre()` får early-return ved `!organisasjon` (orgId må være string, ikke `string | undefined`). Fanget av tsc da fallback ble fjernet.

**Verifisering:**
- `pnpm --filter @sitedoc/api typecheck` grønt
- `pnpm build --filter @sitedoc/web` grønt (27.3s)

**Hva Fase C skiller seg fra Fase A/B:**
- Fase A: bakoverkompatibilitet — orgId valgfri, fallback til bruker
- Fase B: klient sender orgId aktivt
- **Fase C: orgId tvinges — sitedoc_admin må bytte firma eksplisitt for å jobbe i kundens kontekst**

**Klar for test-deploy.** Etter verifisering: prod-deploy lukker Steg 1b helt.

**Beslutning under arbeid:** Sub-elementet «Firmainnstillinger» renames til «Eier-firma» i stedet for «Prosjekteier» (Kenneths foreslag) for å unngå kollisjon med eksisterende parent-kategori «Prosjekteier». Klarere navn — beskriver firma-info knyttet til prosjektets eier.

**Steg 1b Fase B (firma-kontekst — klient-migrering) IMPLEMENTERT på develop 2026-05-03** — andre del av tre-fasers strategi. Bygger på Fase A-server-side-helper. Etter denne fasen kan sitedoc_admin velge et hvilket som helst firma i FirmaVelger og faktisk se det firmaets data på alle firma-admin-undersider.

**Endringer (~10 sider migrert):**
- `firma/page.tsx` (oversikt) — byttet fra `organisasjon.hentMin` til `organisasjon.hentMedId({ id: orgId })`. Tre andre queries (`hentProsjekter`, `hentBrukere`, `hentIntegrasjonerStatus`) sender `{ organizationId: orgId }`.
- `firma/avdelinger/page.tsx` — alle queries/mutations i hovedkomponent + `OpprettAvdelingDialog` + `RedigerAvdelingDialog` har `useFirma()` og sender orgId.
- `firma/brukere/page.tsx` — `hentBrukere` + 2 `endreRolle.mutate`-kall sender orgId.
- `firma/innstillinger/page.tsx` — byttet fra `hentMin` til `hentMedId`. `oppdater` invaliderer både `hentMedId`/`hentMin`/`hentTilgjengelige`. `KompetansePolicySeksjon`-underkomponent har egen `useFirma()`.
- `firma/kompetanse/page.tsx` — `MatriseFane` (hentMatrise + hentSetting), `KompetansetyperFane` (hentAlle + oppdater), `OpprettTypeDialog`, `RedigerTypeDialog`, `SlettTypeDialog`, `ImportFraFilDialog` (forhandsvisning + bekreft). AnsattKompetanse-CRUD (opprett/oppdater/slett) UENDRET — bruker `verifiserKompetanseSkriveTilgang` server-side som utleder orgId fra målbruker.
- `firma/prosjekter/page.tsx` — `hentProsjekter` sender orgId.
- `firma/timer/layout.tsx` — `onboarding.status` sender orgId.
- `firma/timer/onboarding/page.tsx` — `status`-query + 3 mutations (aktiverNivaa1/aktiverNivaa2/aktiverTomKatalog) sender orgId.
- `firma/timer/lonnsarter/page.tsx` — list-query + deaktiver/oppdater + Dialog (opprett/oppdater) sender orgId.
- `firma/timer/aktiviteter/page.tsx` — analog.
- `firma/timer/tillegg/page.tsx` — analog.
- `maskin/import/page.tsx` — `importerForhandsvisning` + `importerBekreft` sender orgId.

**Mønster:** `const { valgtFirma } = useFirma(); const orgId = valgtFirma?.id;` + `useQuery({ organizationId: orgId }, { enabled: !!orgId })` for queries og `mutate({ ...args, organizationId: orgId })` for mutations.

**Beskyttelse:** `firma/layout.tsx` returnerer allerede tom-state hvis `!valgtFirma` (etablert i tidligere commit). Undersider rendres derfor aldri uten valgt firma — `enabled: !!orgId` er en ekstra trygging.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (28.9s, 1 cached).

**Klar for test-deploy.** Stopper og rapporterer før Fase C per Kenneths instruks. Claude verifiserer at sitedoc_admin faktisk kan bytte firma og se annet firmas data.

**Steg 1b Fase A (firma-kontekst — server-helper + valgfri input) IMPLEMENTERT på develop 2026-05-03** — andre steg i prioritert byggerekkefølge fra [domene-arbeidsflyt.md](domene-arbeidsflyt.md). Tre-fasers strategi godkjent av Kenneth: A → B → C med stopp+verifisering mellom hver. Fase A er bakoverkompatibel — alle eksisterende klient-kall fungerer uendret.

**Endringer:**
- Ny `autoriserAdminForFirma(userId, organizationId)`-helper i `apps/api/src/trpc/tilgangskontroll.ts`. Logikk: sitedoc_admin → tilgang til alle firmaer (uavhengig av bruker.organizationId); company_admin med matchende organizationId → tilgang; ellers FORBIDDEN. Skiller seg fra eksisterende `verifiserOrganisasjonTilgang` ved å tillate sitedoc_admin uten matchende org og kreve admin-rolle (ikke bare medlemskap).
- Lokale `verifiserFirmaAdmin`-helpers i 9 router-filer refaktorert til å ta valgfri `inputOrgId`-param. Når gitt: deleger til `autoriserAdminForFirma`. Når ikke gitt: fallback til gammel logikk (`bruker.organizationId`).
- Tilsvarende `hentBrukerOrgId`-helpers (read-only ruter) i kompetansetype, timer/{onboarding,lonnsart,aktivitet,tillegg} fikk samme behandling.
- ~46 endepunkter på tvers av 9 router-filer fikk `organizationId: z.string().uuid().optional()` som input-felt:
  - `organisasjon.ts` (~12): hentMedId/hentProsjekter/hentBrukere/oppdater/leggTilProsjekt/fjernProsjekt/hentIntegrasjonerStatus/endreRolle/tildelOrgRolle/fjernOrgRolle/hentSetting/oppdaterSetting. Lokal `erSiteDocAdmin`-helper fjernet (ubrukt etter konsolidering av oppdater).
  - `avdeling.ts` (4): hentAlle/opprett/oppdater/slett.
  - `kompetanse.ts` (~3 firma-admin-endepunkter): hentMatrise/hentForBruker/importerForhandsvisning/importerBekreft. AnsattKompetanse-CRUD bruker fortsatt `verifiserKompetanseSkriveTilgang` (bruker-mot-bruker-RBAC, ikke firma-admin) — uendret.
  - `kompetansetype.ts` (~5): hentAlle/opprett/oppdater/slett.
  - `timer/onboarding.ts` (4): status/aktiverNivaa1/aktiverNivaa2/aktiverTomKatalog.
  - `timer/lonnsart.ts` (4), `timer/aktivitet.ts` (4), `timer/tillegg.ts` (4): list/opprett/oppdater/deaktiver.
  - `maskin/import.ts` (2): importerForhandsvisning/importerBekreft (via felles `filInputSchema.extend({...})`).
- Verifisering: `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (34s).

**Hva Fase A IKKE gjør:**
- Ingen klient-endring — Fase A er rent server-side bakoverkompatibilitet.
- `organizationId` er valgfri overalt — fallback fungerer som før.
- Sitedoc_admin har fortsatt ikke tilgang til andre firmas data uten at klienten begynner å sende `valgtFirma.id`. Det skjer i Fase B.

**Klar for test-deploy.** Stopper og rapporterer før Fase B per Kenneths instruks.

**Steg 1a (Organization.erKunde) DEPLOYET TIL PROD 2026-05-03** (`c91d953c` merge, `b69830e7` impl) — første steg i prioritert byggerekkefølge fra [domene-arbeidsflyt.md](domene-arbeidsflyt.md). Lukker Strategi C i «Organization vs OrganizationPartner — fundamentalt skille mangler». Ny `Organization.erKunde Boolean default false` + migrasjon `20260503000001_add_organization_er_kunde` med backfill. Heuristikk: `er_kunde=true` hvis `har_maskin_modul` OR `har_timer_modul` OR finnes `Project.primary_organization_id` OR finnes `Avdeling`. `organization_settings` og `users` droppet som signaler (auto-upsert ved første hentSetting-kall + testdata-misbruk: rolle-test-brukere lagt på alle skall-firmaer på test). Backfill-resultat (verifisert via psql etter deploy): test-DB Byggeleder=true + 4 skall=false (Byggherre/Tømrer Hansen/Elektrikker Hansen/Hovedentreprenør); prod-DB A.Markussen/HRP AS/Kenneths testmiljø=true + 0 skall. Server: `organisasjon.hentTilgjengelige` filtrerer på `erKunde:true` for sitedoc_admin (company_admin-grenen uendret). `hentMin` returnerer hele Organization (inkl. `erKunde`). Klient: `Firma`-type i `firma-kontekst.tsx` utvidet med `erKunde:boolean`. Test-verifisert som innlogget Tore SiteDocAdmin via Claude (FirmaVelger viser kun Byggeleder). **Merknad:** Auto-deploy-hook etter push til develop triggert ikke — manuell deploy ble kjørt. Bør undersøkes separat.

**Global firma-kontekst (FirmaVelger i Toppbar) DEPLOYET TIL TEST 2026-05-03** (`a2d45c02` + `9175ab84`) — kun `firma/layout.tsx` følger velgeren, undersider krever Lag 1+2+3 (se planlagte oppgaver).

**Status 2026-05-02:** **Fase 0 § E KOMPLETT i prod**. **Fase 0.5 KOMPLETT i prod**. **Timer-modul Fase 3 — Runde 1A + 1B + 1C DEPLOYET TIL PROD**. **Runde 2 (mobil + offline-sync) C1–C8 KOMPLETT på develop** (merge `1cce62f3` 2026-05-02 sent kveld). C5 visuelt verifisert på iOS Simulator + fysisk mobil etter første test-deploy. **Runde 2 + 2.5 / C9 deployet til prod 2026-05-02** (`de33aefc`). **Maskin terminologi-rename «pensjonert» → «utgaatt» DEPLOYET TIL PROD 2026-05-02** (`03d8c63a` — migrasjon `20260502120000_rename_pensjonert_til_utgaatt` applied på sitedoc + sitedoc_test). **Runde 2.6 mobil maskin-cache DEPLOYET TIL PROD 2026-05-02** (`03d8c63a`). **Runde 2.7 «Mine timer» + DagstotalBanner + UkeTotalBanner + web ukesoppsummering DEPLOYET TIL PROD 2026-05-02** (`05b3bddb`) — ny `/dashbord/timer/mine` (web, 5-perioder + 4 oppsummerings-kort + per aktivitet/status), ny `/timer/mine` (mobil, 3-perioder + 2 pills + aktivitet-aggregering), DagstotalBanner i mobil ny+detalj, web uke-totalsum, sidebar/Mer-tab-link. Ingen DB-migrasjon, ingen server-endring (gjenbruker `timer.dagsseddel.list`). Mobil får funksjonalitet ved neste EAS Build. Se [dagsseddel-design.md](dagsseddel-design.md) + [fase-0-beslutninger.md C.18](fase-0-beslutninger.md).

**Rolle-arkitektur-avklaring DEPLOYET TIL PROD 2026-05-02** (`6f6d3d68`) — `ProjectMember.kanAttestere Boolean` lagt til som kapabilitets-felt. Erstatter mye-omtalt `project_manager`-rolle som kun var i bruk i `dagsseddel.ts` (2 referanser, ingen rader i DB). Backfill: alle `role="admin"` får `kanAttestere=true` ved migrering — verifisert på test-DB (Per Prosjektadmin har `kanAttestere=true`, Ola Tømrer har `false`). CLAUDE.md rolletabell renset for `worker`/`field_user`/`project_manager` (fantasi-verdier som aldri eksisterte i kode/DB). Migrasjon `20260502160000_add_kan_attestere` applied på sitedoc + sitedoc_test. UI: sub-pill «✓ Attestering» under rolle-cellen i prosjekt-medlem-admin (`/dashbord/oppsett/brukere`) + ny `medlem.settKanAttestere`-mutation. Esc-fiks for redigeringsmodus inkludert. Lærdom: `prisma generate` MÅ kjøres FØR `migrate deploy` på server — `pnpm install --frozen-lockfile` regenererer ikke klient-typene.

**Timer-attestering rename DEPLOYET TIL PROD 2026-05-02** (`8aa792b2`) — terminologi-rens for å gjennomføre CLAUDE.md regelen «Attestering ≠ Godkjenning» (vedtatt 2026-04-26). Full sweep:
- **URL:** `/dashbord/[prosjektId]/timer/godkjenning` → `/timer/attestering`. Redirect-stub i gammel rute peker til ny via `redirect()` fra `next/navigation`. Lenker fra utsiden fungerer.
- **tRPC:** `kanGodkjenne` → `kanAttestere`, `hentTilGodkjenning` → `hentTilAttestering`. Gamle prosedyrer beholdes som `@deprecated` alias i 1 uke (fjernes etter 2026-05-09) per CLAUDE.md API-bakoverkompatibilitet-regel.
- **Sidebar/hooks/navigasjon-kontekst:** `id: "timer-godkjenning"` → `"timer-attestering"`, `nav.timerGodkjenning` → `nav.timerAttestering`, useAktivSeksjon-spesialfall, navigasjon-kontekst-type.
- **Mobil:** `sendTilGodkjenning()` → `sendTilAttestering()` + i18n-nøkkel `timer.sendTilGodkjenning` → `timer.sendTilAttestering`.
- **i18n:** 16 nøkler renamet i nb.json + en.json (`timer.godkjenning.*` → `timer.attestering.*`). Norske VERDIER oppdatert: «Godkjenning» → «Attestering», «Godkjenn timer» → «Attester timer», «Send til godkjenning» → «Send til attestering» m.fl. Engelske verdier beholdt («Approval»/«Approve» dekker begge konsepter på engelsk). Ny `status.tilAttestering` lagt til i alle 14 språk (samme verdi som `status.tilGodkjenning` for ikke-nb språk siden distinksjonen er norsk-spesifikk).
- **Verifisert:** `pnpm build --filter @sitedoc/web` grønt; `tsc --noEmit` grønt for api+web (kun pre-eksisterende vitest-typing). Mobile-tsc har bare pre-eksisterende feil ikke relatert til rename.

Status `status.tilGodkjenning` er bevisst beholdt — brukes for sjekkliste/oppgave-flyt og kontrollplan-status (intern aksept ≠ Godkjenning-dokumenttype). **Innlogget bruker-verifisering på test gjenstår** per CLAUDE.md regelen — curl HTTP 200 bekrefter kun server-svar, ikke at sidebar-element/URL-redirect/«Send til attestering»-knapp faktisk virker.

**Fase 0.5-fremdrift (revidert scope etter kode-verifisering 2026-05-01):**
- § 1 Avdeling-tabell + User.avdelingId ✅ (`a90daabd`) — `Avdeling`-modell i `packages/db`, `User.avdelingId String?` med SetNull, migrasjon `20260501000015_add_avdeling`
- § 2 Kompetansetype + AnsattKompetanse + RBAC ✅ — Kompetansetype + AnsattKompetanse-tabeller (per A.28), OrganizationSetting utvidet med `kompetanseRegistreringTilgang` (firma_admin | bruker_egen | alle, default firma_admin), 7-kategori-seed i `packages/shared/src/types/index.ts` (`KOMPETANSE_KATEGORIER` + `KOMPETANSE_REGISTRERING_TILGANG` + `KOMPETANSE_IMPORT_KILDER`), migrasjon `20260501000016_add_kompetanse`. `kompetanse.*` tRPC-rute + UI bygges senere (Fase 0.5 § 6 eller separat). Varsling-integrasjon (90/30/7 dager) bygges separat når varsling-modul er klar.
- § 3 ProjectGroupByggeplass m2m + drop building_ids ✅ — `ProjectGroupByggeplass`-tabell (m2m groupId × byggeplassId, Cascade på begge), drop `ProjectGroup.byggeplassIder` (verifisert dødt felt — kun skrevet i `gruppe.ts:495-503`, aldri lest), refaktor `gruppe.oppdaterByggeplasser`-mutation til `prisma.$transaction([deleteMany, createMany])` mot koblingstabell, semantikk: tom array = alle byggeplasser. Migrasjon `20260501000017_add_project_group_byggeplass`. Prinsipp C-verifisering ferdig (C1 vedtatt).
- § 4 Drop `ProjectGroup.byggeplassIder` ✅ — slått sammen med § 3 (samme migrasjon)
- § 5 Slette-policy for byggeplass ✅ — API: ny `byggeplass.hentSletteSammendrag` (returnerer telleresult per modell, splittet bevares/slettes per cascade-policy fra schema), oppdatert `byggeplass.slett` med `navnBekreftelse`-input (case-insensitive match per Kenneth) + `verifiserAdmin` (strammet fra `verifiserProsjektmedlem`) + TRPCError FORBIDDEN ved mismatch. UI: ny `SletteLokasjonDialog` i `apps/web/src/app/dashbord/oppsett/lokasjoner/page.tsx` (erstatter `confirm()`-prompt) — viser bevares/slettes-seksjoner, tekstinput med navn-bekreftelse, slett-knapp disabled til match. i18n: 17 nye nøkler (nb + en). Cascade-valg utsatt til senere — kun SetNull-default i første versjon. Ingen schema-endringer

**Fase 0.5 KOMPLETT** — deployet til prod 2026-05-01 (merge develop `9fed74a5` → main `f0a515cd`). 3 nye migrasjoner applied (`20260501000015_add_avdeling`, `20260501000016_add_kompetanse`, `20260501000017_add_project_group_byggeplass`).

**Etter-Fase-0.5-arbeid (på develop):**
- Avdeling-UI implementert: ny tRPC-router `avdeling.*` (hentAlle/opprett/oppdater/slett, alle gated med verifiserFirmaAdmin) i `apps/api/src/routes/avdeling.ts`. Slett blokkeres med CONFLICT hvis brukere er tilknyttet. Ny side `/dashbord/firma/avdelinger` med tabell (navn/kode/aktiv-toggle/antall brukere) + opprett/rediger-modaler. Menyelement i firma-layout. 16 nye i18n-nøkler (`firma.avdelinger.*`). Deployet til prod 2026-05-01 (`2799a4d1`).
- Kompetanse-UI Runde 1: ny tRPC-router `kompetansetype.*` (full CRUD, gated firma-admin) + `kompetanse.hentMatrise` + `kompetanse.hentForBruker` (read-only). Ny `organisasjon.hentSetting` + `organisasjon.oppdaterSetting` (upsert, dekker alle 5 OrganizationSetting-felter). Ny `kompetanseStatus()`-utils i shared (gyldig/varsel/utløpt med 90-dagers terskel). Ny side `/dashbord/firma/kompetanse` med to faner: Matrise (read-only, fargemarkering, filter på kategori/avdeling/ansatt-søk) + Kompetansetyper (full CRUD med modal-dialoger). Settings-toggle for `kompetanseRegistreringTilgang` (firma_admin/bruker_egen/alle) i innstillinger-siden. Menyelement «Kompetanse» (Award-ikon) i firma-layout. ~37 nye i18n-nøkler (`firma.kompetanse.*`). Deployet til prod 2026-05-01 (`0965ddf2`).
- Kompetanse-UI Runde 2.5 (develop): CSV/Excel-import. Ny dependency `csv-parse@6.2.1` i `apps/api`. To nye tRPC-mutations (`importerForhandsvisning` + `importerBekreft`) med SHA-256 filHash-validering for å garantere konsistens mellom forhåndsvisning og bekreft. Atomisk-policy ved ukjente ansattnumre (avviser hele importen). Auto-opprett av kompetansetyper (default på). Kolonne-aliaser + DD.MM.YYYY norsk dato + ISO-dato + Excel-dato-serial. ImportFraFilDialog i UI med 4-stegs flyt (opplastning → forhåndsvisning → bekreft → resultat). Hjelpefunksjoner i `apps/api/src/utils/kompetanseImport.ts` (parseCsvFil + parseXlsxFil + beregnFilHash). 30 nye i18n-nøkler (`firma.kompetanse.import.*`). Klar for test-deploy.
- Kompetanse-UI Runde 2: AnsattKompetanse-CRUD via celle-klikk i matrisen. Ny `verifiserKompetanseSkriveTilgang(ctxUserId, malUserId)` i `tilgangskontroll.ts` (Alt A — sitedoc_admin og company_admin bypasser policy; ikke-admin følger `kompetanseRegistreringTilgang`-policy med fallback til `firma_admin` hvis OrganizationSetting mangler). 3 nye mutations i `kompetanse.ts` (opprett/oppdater/slett). UI utvidet: celle-klikk åpner ny `AnsattKompetanseDialog` (read-only header med bruker+type, redigerbare felter for utstedt/utløp/utsteder/sertifikat-nr/notat, klient-validering for utløp<utstedt). Slett via sub-modal (per CLAUDE.md slett-bekreftelse-regel — ikke confirm()). Klikk-tilstand styrt av lokal `kanSkriveKompetanse()` som speiler server-RBAC (UI-bekvemmelighet, server er sannhetskilden). 18 nye i18n-nøkler (`firma.kompetanse.dialog.*`). Klar for test-deploy. **Runde 2.5 utsatt:** CSV/Excel-import (krever `csv-parse`-install).

**Verifiserings-funn 2026-05-01 (mot kode):**
- ❌ `ByggeplassMedlemskap` UTSATT TIL FASE 4 (Mannskap-modul) — eneste forbrukere er innsjekk/utsjekk/geofence/§15-liste, alle Fase 4
- ❌ `EquipmentAnsvarlig.avdelingId` strøket — tabellen finnes ikke i db-maskin (Equipment har direkte `ansvarligUserId`)
- ✅ Prinsipp B (ingen tvungen byggeplass) bekreftet matcher kode 1:1 (kun Kontrollplan krever byggeplass — modul-policy, ikke prosjekt-blokker)
- ✅ Prinsipp C (koblingstabell vs jsonb) bekreftet trygg — `building_ids` skrives i `gruppe.ts:495-503` men leses ALDRI noe sted

**Fase 0 § E (deployet til prod 2026-05-01):** Alle 13 § E-steg implementert (E.9 hoppet per § E). § E-fremdrift: E.1 Activity (`13a746a7`), E.2 OrganizationSetting (`4a155c28`), E.3 ProjectOrganization-rename (`1bff8672`), E.4 primaryOrganizationId (`137eed6f`), E.5 ProjectModule (`d9bfafc4`), E.6 OrganizationPartner (`22a772b6`), E.7 OrganizationTemplate (`7709ea32`), E.8 BibliotekMal + C.17 (`29311756`), E.10 ProjectMember.periodeSlutt (`5b8beef6`), E.11 ExternalCostObject (`9c9dd682`), E.12 Godkjenning (`0622fc35`), E.13 User-utvidelse + B.7 (`37d49872`), E.14 OrganizationRole. Timer/Maskin-revurdering utsatt til etter Fase 0.5-deploy.

**Anker for Fase 0-koding:**
- [fase-0-beslutninger.md](fase-0-beslutninger.md) — **PRIMÆR ANKER** (23 vedtatte + 0 åpne BLOKKERE + 12 anbefalte utvidelser + 13-stegs migrerings-rekkefølge + B.7-utvidelse for multi-identifikator-auth)
- [arkitektur.md](arkitektur.md), [terminologi.md](terminologi.md), [dokumentflyt.md](dokumentflyt.md) — verifiserte fundament-filer (drift mot kode rettet 2026-04-27)
- [smartdok-undersokelse.md](smartdok-undersokelse.md) — empirisk grunnlag fra A.Markussen (UI-research 2026-04-26)
- [arkitektur-syntese.md](arkitektur-syntese.md) — helhetlig produktarkitektur (loan-pattern, modul-arkitektur)
- [timer.md](timer.md) — krever refaktor (enterpriseId → organizationId, Underprosjekt-modell erstattet av ExternalCostObject). **Verifiseres i Timer-revurdering**
- [maskin.md](maskin.md) — krever justering for fase-0-beslutninger (særlig EquipmentAnsvarlig). **Verifiseres i Maskin-revurdering**

**Sentrale arkitektur-funn (oppdatert 2026-04-27 etter komplett verifisering):**
- `ProjectModule` eksisterer (linje 752 i schema, brukt 30+ steder) — utvides med `organizationId` + `status` (3-nivå per A.17), ikke ny tabell
- `Activity` (sentral audit-tabell) finnes ikke — bygges i Fase 0 som første steg
- `OrganizationProject` har eksisterende felter (`id`/`organizationId`/`projectId`/`createdAt` + relasjoner) — renames til `ProjectOrganization` og utvides med `rolle`-felt (NOT blank m:n)
- `date-fns-tz` er ikke installert — krevet for tidssone-håndtering (lukkes implisitt av B.6)
- Cache-invalidation-mønster er ad-hoc (30 kall, ingen sentral policy) — definres i Fase 0, fylles i Fase 3
- Underprosjekt = `ExternalCostObject` (UI-term «Underprosjekt», Prisma-modell `ExternalCostObject` per A.1)
- **Lønnsart-katalog er datadrevet, tre-nivå** (16 lovpålagte + 25 bransje-relevante + kundens egne) — detaljer i [timer.md](timer.md)
- **Avdeling-tabell** bygges i Fase 0.5 (sammen med Byggeplass), ikke Fase 0 (per C.11)
- **Seed-mekanisme** (event-hook `onOrganizationCreated`) etableres tomt i Fase 0; innhold registreres i Fase 3
- **B.7 — Org-bytte-mekanikk:** Modell A (én User per person×firma) vedtatt. `User` får composite `@@unique([email, organizationId])` + `@@unique([phone, organizationId])` (forberedende for fremtidig multi-identifikator-auth). `ProjectMember.userId` cascade endres `Cascade → SetNull`
- **B.6 — Timestamptz-håndtering:** Selektiv migrasjon (medium scope) — 11 felter får `@db.Timestamptz` (timer/audit/godkjenning/PsiSignatur/frist-felter/Invitation), resten av schema beholder `timestamp(3)`

**Maskin-modul (`feature/maskin-db`):** under bygging. **Midlertidig modul-gating implementert 2026-04-30** via `Organization.harMaskinModul`-flagg (default `false`). HovedSidebar skjuler maskin-ikonet for firma uten flagget; eksisterende firma-isolering i maskin-rutene (`verifiserOrganisasjonTilgang`) hindrer cross-tenant-lekkasje. Aktivering per firma: `UPDATE organizations SET har_maskin_modul = true WHERE id = '<id>';`. Erstattes av full `OrganizationModule` + `modulProcedure('maskin')`-gating i Fase 0 per A.4 — den midlertidige kolonnen droppes da.

**Maskin Blokk A + B implementert (2026-05-01) på `develop`:**
- **Blokk A (schema-reconciliation, `de3fb1d0`):** EquipmentAnsvarlig-tabell (m:n for tilleggsansvarlige per A.6 hybrid) + 15 nye Equipment-felt (5 felles: internNavn, eierskap, eksportKode, harSporingsenhet, aarsmodell + 10 materialiserte Vegvesen-kolonner). Migrasjon `20260501131546_blokk_a_schema_reconciliation` deployet til test 2026-05-01.
- **Blokk B (Vegvesen-integrasjon):** Service-lag i `apps/api/src/services/maskin/` (vegvesen-api, vegvesen, vegvesen-worker, moduleGate, equipment) per cross-modul-konvensjon (arkitektur-syntese § 6.1.1). 3 nye tRPC-endepunkter: `hentFraVegvesenForhandsvisning` (synkron mutation, 409 ved duplikat), `opprettMedVegvesen` (Variant A — klient sender bekreftet vegvesenData, server validerer kjennemerke-match), `oppdaterFraVegvesen` (admin-only, kø-basert). VegvesenKo-worker: 60s polling-løkke + 5min watchdog + 15min pause ved 429 + 5 retries. Klient-UI: Vegvesen-flyt aktivert i `nytt/page.tsx` med forhåndsvisning-panel + «fortsett uten Vegvesen-data»-fallback + eierskap-velger (eid/leid/leasing/lant) + årsmodell-felt + kallenavn. Felles `normaliserRegnummer()` i `packages/shared/src/utils/regnummer.ts` brukes i klient-input, Zod-validering og server-sammenligning. ~36 nye i18n-nøkler.
- **Blokk C1 (read-only detaljside + filter-bar + statusendring):** Filter-bar i listevisning med chip-buttons (kategori med count, status, ansvarlig-dropdown, fritekstsøk, vis-pensjonerte-toggle). Klikk på rad navigerer til ny detaljside `/dashbord/maskin/[id]`. Detaljside har 8 seksjoner read-only (generelt, anskaffelse, ansvarlig, kjøretøy-info, EU-kontroll med trafikklys-banner, anleggsmaskin-info, småutstyr-info, notater) + statusendring-modal med pensjonertGrunn-velger og advarsel + Vegvesen-oppdater-knapp (admin-only, polling 10s mot vegvesenKo.hentStatus). Nye API-endepunkter: `equipment.list` med sok-filter, `equipment.antallPerKategori`, `equipment.hentMuligeAnsvarlige`, `bruker.hentMin`. ~50 nye i18n-nøkler.
- **Blokk C2 (modal-redigering + ansvarlig-CRUD):** Detaljside utvidet med rediger-knapper på 5 seksjoner (Generelt, Anskaffelse, Kjøretøy-info, Anleggsmaskin-info, Småutstyr-info) som åpner én generisk `RedigerModal`-komponent. Ansvarlig-seksjonen erstattet med full CRUD: hovedansvarlig kan endres (UserPicker), tilleggsansvarlige listes med periode-start + (×)-fjern-knapp, (+)-knapp åpner LeggTilAnsvarlig-modal. Server-side: ny `verifiserMaskinAnsvarligSkriveTilgang(ctxUserId, equipmentId)` i tilgangskontroll.ts — sitedoc_admin/company_admin/primær-ansvarlig kan endre ansvarlig-felter (per A.6 hybrid). Ny `ansvarlig`-router (`maskin.ansvarlig.list/tilfoy/fjern`) med soft-delete (periodeSlutt = now), cross-org-blokkering, conflict-sjekk. `equipment.oppdater` utvidet med 30+ redigerbare felt (alle Generelt/Anskaffelse/manuelle Kjøretøy-info/Anleggsmaskin-info/Småutstyr-info). Vegvesen-felter overskrives av oppdaterFraVegvesen-flyten — ikke manuelt. ~18 nye i18n-nøkler. **Lukker forutsetning for SmartDok-import.**
- **Type-fix (`77d7bd67`, 2026-05-01):** Build feilet på test for C2 — `Input`-komponenten i RedigerModal returnerer `string | null` via onChange, men `RedigerInputs.type`-feltet er `string | undefined` (påkrevd-felt i `equipment.oppdater`-schema, kan ikke settes null). Lokal `tsc --noEmit` fanget ikke dette fordi local config er mindre strikt enn Next.js-build. Fix: erstattet `<Input v={inn.type}>` med inline `<input>` for type-feltet i Generelt-modalen. **Lærdom for fremtidige bugs:** Next.js-build kjører strengere tsc enn lokal — verifiser alltid med `pnpm build --filter @sitedoc/web` lokalt før test-deploy hvis nye felter med komplekse Optional-typer introduseres.

**Timer-modul Fase 3 STARTET 2026-05-01 (Infrastruktur-commit, på `feature/maskin-db`):**
- **packages/db-timer/-pakke opprettet:** 7 Runde-1-tabeller i postgres-schema `timer` (`lonnsarter`, `aktiviteter`, `tillegg`, `expense_categories`, `daily_sheets`, `sheet_timer`, `sheet_tillegg`). Egen Prisma-klient (`.prisma/timer-client`), cross-package-FK som svake String-felt (samme mønster som db-maskin). Init-migrasjon `20260501200000_init`.
- **Kjernen-utvidelse:** `Organization.harTimerModul Boolean default false` (midlertidig modul-flagg, samme mønster som `harMaskinModul`). `OrganizationSetting` utvidet med 4 felt: `dagsnorm Decimal default 7.5`, `overtidsmatTerskel Decimal default 9.0`, `tillattSelvAttestering Boolean default true`, `timerLockEtterDager Int? null` (Variant A — null = ingen alders-grense, status styrer låsing). Migrasjon `20260501200000_add_timer_modul_og_settings`.
- **Service-lag:** `apps/api/src/services/timer/moduleGate.ts` (`erTimerAktivert` + `krevTimerAktivert` + `TimerModulIkkeAktivertError`). `apps/api/src/services/seed/index.ts` (5 stub-funksjoner for Runde 1A: `seedLonnsartNivaa1/2`, `seedAktiviteter`, `seedTillegg`, `seedExpenseCategories` + samlet `seedTimerForOrganization`).
- **Workspace-deps:** `@sitedoc/db-timer` lagt til i `apps/api/package.json` + `apps/web/package.json`. Krever `pnpm install` før `prisma generate`.
- **Migrasjons-SQL skrevet manuelt** (ikke kjørt mot lokal-DB ennå). Kenneth kjører `pnpm install` + `pnpm --filter @sitedoc/db-timer exec prisma generate` + `pnpm --filter @sitedoc/db-timer exec prisma migrate deploy` + tilsvarende for `@sitedoc/db` mot test før prod.
- **Ikke i denne commit-en:** prototype-sletting (Runde 1B), modulProcedure i tRPC-base, dagsseddel-flyt, leder-attestering, mobil/offline, eksport-adaptere.

**Timer-modul Fase 3 — Runde 1A IMPLEMENTERT 2026-05-01 (`feature/timer-1a`):**
- **tRPC-router `timer.*`:** ny mappe `apps/api/src/routes/timer/` med `onboarding.ts` (status/aktiverNivaa1/aktiverNivaa2/aktiverTomKatalog), `lonnsart.ts` (list/opprett/oppdater/deaktiver), `aktivitet.ts` (analog), `tillegg.ts` (analog), `index.ts`. Registrert i `appRouter`. `prismaTimer` lagt i tRPC-context. RBAC: `verifiserFirmaAdmin` for skrive-mutations, alle ansatte i firma kan lese.
- **Seed-funksjoner med faktisk innhold:** `seedLonnsartNivaa1` (16: Fastlønn, Timelønn, Overtid 50%/100%, sykemelding/permittering/feriepenger osv. per AML/Folketrygdloven/Ferieloven). `seedLonnsartNivaa2` (25: Velferdspermisjon, Reise 7,5–15/15–30/30–45/45–60 km, Diett-pakke, Skifttillegg, Lærling-pakke, Innleid arbeidskraft, Fakturerbar tid m.fl.). `seedAktiviteter` (3: Anleggsarbeid, Maskintimer, Garanti/reklamasjon). `seedTillegg` (3: Overtidsmat, Smusstilleg, Beredskap-vakt). `seedExpenseCategories` (5: Drivstoff, Parkering, Diett, Verktøy, Annet). Alle idempotente — re-kjøring overskriver ikke.
- **Web-sider:** `/dashbord/firma/timer/{onboarding,lonnsarter,aktiviteter,tillegg}/page.tsx` + felles `layout.tsx` (sub-nav) + `page.tsx` (redirect). Onboarding-side har 3 scenarioer (Aktiver Nivå 1, Nivå 1+2, tom katalog). CRUD-tabeller med opprett/rediger-modal og deaktiver/reaktiver-toggle (soft-delete via Restrict-FK på SheetTimer/SheetTillegg/DailySheet). Sidebar-element «Timer» (Clock-ikon) i firma-layout, gates på `harTimerModul`.
- **i18n:** ~85 nye nøkler under `firma.timer.*` (nb+en) + 3 generiske (`ja`, `nei`, `handling.handlinger`).
- **Verifisert:** Lokal `pnpm build --filter @sitedoc/web` grønt — alle 5 timer-ruter kompilert. tRPC-typer eksponert via `appRouter`. Klar for test-deploy.

**Timer-modul Fase 3 — Runde 1B (dagsseddel-flyt) IMPLEMENTERT 2026-05-01 (`feature/timer-1b`):**
- **Slettet prototype:** `apps/web/src/app/dashbord/[prosjektId]/timer/page.tsx` (914 linjer hardkodet demodata) — erstattet av reell implementasjon.
- **tRPC-router `timer.dagsseddel.*`:** ny fil `apps/api/src/routes/timer/dagsseddel.ts` med 12 endepunkter: `list` (filter på projectId/userId/periode/status, kun egne sedler hvis ikke admin), `hentMedId` (full join inkl. timer-rader/tillegg-rader/aktivitet/prosjekt), `opprett` (idempotent via `clientUuid`), `oppdater` (header-felt), `tilfoy/oppdater/fjernTimerRad`, `tilfoy/oppdater/fjernTilleggRad`, `send` (draft → sent, krever ≥1 timer-rad), `slett` (kun draft).
- **Status-livssyklus enforcing:** `draft`/`returned` redigerbar, `sent`/`accepted` låst. `OrganizationSetting.timerLockEtterDager` sjekkes kun for `draft` (null = ingen alders-grense). Cross-org-blokkering via `verifiserProsjektmedlem` på opprett, eierskaps-sjekk via `hentEgenDagsseddel` på alle muteringer.
- **Web-sider under `/dashbord/[prosjektId]/timer/`:** `page.tsx` (liste-side med ISO-uke-velger, status-filter, status-badge), `ny/page.tsx` (opprett-skjema med dato/aktivitet/klokkeslett/pause/beskrivelse, default-aktivitet «Anleggsarbeid» hvis seedet, stabil clientUuid for idempotens), `[id]/page.tsx` (detaljside med 4 seksjoner: header-redigering, timer-rader-CRUD, tillegg-rader-CRUD, send/slett-handlinger). `status-badge.tsx` som delt komponent (Next.js page.tsx kan ikke ha named exports).
- **HovedSidebar Timer-gating:** Timer-element gates på `harTimerModul` (samme mønster som maskin). `kreverFirmaModul: "maskin" | "timer"` utvidet i `SidebarElement`-interface.
- **i18n:** ~50 nye nøkler under `timer.*` (nb+en) — felter, status-typer, kolonneoverskrifter, dialog-titler, feilmeldinger.
- **Verifisert:** `pnpm build --filter @sitedoc/web` grønt — 3 nye `/[prosjektId]/timer/*`-ruter + 5 fra Runde 1A. Type-fix: TS2589 «Type instantiation excessively deep» rettet ved å eksplisitt typee `onError: (e: { message: string })` på alle useMutation-callbacks i detaljsiden (per CLAUDE.md-regel — pre-eksisterende lærdom).
- **Deployet til prod 2026-05-01** (`c1122c2e`). Ingen nye DB-migrasjoner — kun kode.

**Timer-modul Fase 3 — Runde 1C (leder-attestering) IMPLEMENTERT 2026-05-01 (`feature/timer-1c`):**
- **tRPC-router-utvidelse:** 4 nye endepunkter i `dagsseddel.ts`: `hentTilGodkjenning({projectId})` (alle innsendte for prosjektet, beriket med ansatt-info), `kanGodkjenne({projectId})` (boolean — sidebar-gating), `returner({id, kommentar})` (sent → returned, krever ikke-tom kommentar), `attester({id})` (sent → accepted med pris-snapshot per rad og DailySheet.attestertAvUserId/attestertVed). Lokal helper `erProsjektLeder` + `krevProsjektLeder` — sjekker `ProjectMember.role ∈ {admin, project_manager}` eller `sitedoc_admin`/`company_admin` med matchende org.
- **Snapshot-pattern (Fase 0 A.7):** Ved attester kopieres katalog-data inn i `SheetTimer.attestertSnapshot` + `SheetTillegg.attestertSnapshot` JSON-felt: `{lonnsartId/tilleggId, kode, navn, type, prisMotKunde, internkostnad, sats, satsEnhet, attestertVed}`. Decimal-felt serialiseres som strings (toString()) for å bevare presisjon. Atomisk via `prismaTimer.$transaction([...])` — alle rader + status-overgang i én commit.
- **Web-side `/dashbord/[prosjektId]/timer/godkjenning/page.tsx`:** Leder-vy med tabell over innsendte sedler (dato/ansatt/aktivitet/totaltimer/rader-count). Tre actions per rad: åpne (chevron til detaljside), returner (RotateCcw-ikon, åpner kommentar-modal), attester (Check-ikon, direkte mutation). Returner-modal har påkrevd kommentar (min 1 tegn). `kanGodkjenne`-sjekk gir tydelig «ingen tilgang»-melding for ikke-ledere.
- **Detaljside-utvidelse (`[id]/page.tsx`):** To nye banner-seksjoner: returned-banner med leder-kommentar (amber, viser hva som må rettes), accepted-banner med attestert-tidspunkt (grønn). `lederKommentar`-feltet (allerede i schema) brukes som tilbakemeldingskanalen. Ansatt kan redigere returned-sedler og sende på nytt (samme send-mutation, status går returned → sent).
- **Sidebar-utvidelse:** Nytt seksjons-element «timer-godkjenning» (CheckCircle2-ikon) i `Seksjon`-typen + seksjonMap. HovedSidebar gates på `harTimerModul && kanGodkjenne` — usynlig for ikke-ledere. URL-mønster `/dashbord/[prosjektId]/timer/godkjenning` håndteres av useAktivSeksjon (spesialfall etter prosjektId-deler).
- **i18n:** ~17 nye nøkler under `timer.godkjenning.*` + `timer.detalj.{returnertTittel,returnertHjelp,attestertTittel}` + `nav.timerGodkjenning` (nb+en).
- **Verifisert:** `pnpm build --filter @sitedoc/web` grønt — ny ruten `/dashbord/[prosjektId]/timer/godkjenning` + alle eksisterende kompilert. tsc grønt for api+web (kun pre-eksisterende vitest-typing). Klar for test-deploy.

**Timer-modul Fase 3 — Runde 2 (mobil + offline-sync) C1–C5 IMPLEMENTERT 2026-05-01 (`feature/timer-2`, IKKE merget til develop):**
- **Godkjent scope:** kun timer-rader + tillegg-rader (ikke utlegg/maskin), kun ansatts egne sedler på mobil (leder-attestering kun på web), server-wins ved konflikt med tydelig banner.
- **C1 (`8a3c8a9a`) — Drizzle-skjema:** 6 nye SQLite-tabeller i `apps/mobile/src/db/schema.ts`: `dagsseddel_local` (id = clientUuid, sync-atom for hele sedlen), `sheet_timer_local`, `sheet_tillegg_local` (skrive-tabeller med syncStatus pending/synced/conflict) + `lonnsart_local`, `aktivitet_local`, `tillegg_local` (read-only katalog-cache). Idempotente CREATE TABLE IF NOT EXISTS i `migreringer.ts`. Decimal-felt fra Postgres serialiseres som tekst for presisjon, timestamps Unix ms.
- **C2 (`4c89e498`) — Server-side sync-endepunkter:** To nye i `apps/api/src/routes/timer/dagsseddel.ts`: `hentEndringerSiden` (query — pull alle sedler endret etter ISO timestamp, full pull begrenset til siste 90 dager, returnerer sedler med rader serialisert), `syncBatch` (mutation — Array<{clientUuid, ...rader}>, maks 100, per-seddel `prismaTimer.$transaction`, uavhengig resultat per seddel: `ok`/`conflict`/`feilet`, ingen rollback på tvers, klient kan ikke sette status=accepted, rader erstattes via deleteMany+createMany).
- **C3 (`e8f15f1e`) — Sync-motor:** Ny `apps/mobile/src/services/timerSync.ts` med `syncTimer(klient, userId)` som orkestrerer push (pending → server) + pull (siden → server), batches av 100 sedler. Ny `apps/mobile/src/providers/TimerSyncProvider.tsx` etter SpraakProvider — eksponerer `pendingAntall/conflictAntall/sistSynkronisert/syncerNa/sisteFeil` + `triggerSync()`. Auto-trigger ved login + nett-gjenkomst, 30s interval mens app er aktiv + online. Server-wins: conflict overskriver lokal med serverData.
- **C4 (`27598e7a`) — Katalog-cache:** Ny `apps/mobile/src/services/timerKatalog.ts` med `refreshKatalog(klient)` (full nedlasting fra `timer.{lonnsart,aktivitet,tillegg}.list`, atomisk overskriving per type) + synkrone lese-funksjoner (`hentLonnsarterLokalt`/`hentAktiviteterLokalt`/`hentTilleggLokalt`/`finnLonnsartLokalt`/etc.) for offline-trygge UI-velgere. Provider trigger katalog-refresh sammen med syncTimer ved login.
- **C5 (`d2a81fa7`) — UI-liste:** Ny `apps/mobile/app/timer/_layout.tsx` + `index.tsx` (liste over mine dagssedler les fra dagsseddel_local, sortert dato desc, pull-to-refresh, refocus-rerender, FAB → /timer/ny). Ny `TimerStatusMerkelapp.tsx` (status-badge utkast/sendt/returnert/attestert + sync-status-badge) + `TimerSyncStatusBar.tsx` (tynn statusbar: offline/syncerNa/pending/conflict/synced med farger + manuell trigger). Mer-tab utvidet med Timer-rad + badge for pending/conflict.
- **Pre-eksisterende kjent issue:** Mobil tsc har 9 pre-eksisterende feil (oppgave/sjekkliste/PSI/3D/hjem-tab) som ikke er knyttet til timer-2 — Metro bundler kjører uavhengig av tsc. Trpc-import-feil i rapportobjekter ble fikset på develop (`f062c5f2`) før timer-2 — fix vil komme inn naturlig ved senere develop-merge.
- **C5 visuelt verifisert 2026-05-02** på iOS Simulator + fysisk mobil etter test-deploy (`0342b883`). Liste-side viste eksisterende sedler synket fra prod-DB, sync-statusbar fungerer, Mer-tab Timer-rad navigerer korrekt.
- **C6 (`90c73991`) — Opprett-skjema + detaljside:** `apps/mobile/app/timer/ny.tsx` (DateTimePicker + prosjekt-velger via `trpc.prosjekt.hentMine` + aktivitet-velger fra lokal cache med default `Anleggsarbeid` + valgfri beskrivelse → `randomUUID()` clientUuid + insert til `dagsseddel_local` med `syncStatus=pending`). `apps/mobile/app/timer/[id].tsx` (header med dato/aktivitet/status-badge, status-banners for returned/accepted/conflict/pending, timer-rader-seksjon med +/rediger/slett, tillegg-rader-seksjon analog, send-til-attestering-knapp som krever ≥1 timer-rad, slett-knapp med `Alert.alert`-bekreftelse — kun draft). 4 modaler (TimerRadModal, TilleggRadModal, LonnsartVelgerModal, TilleggVelgerModal) inline i [id].tsx leser fra lokal cache med søk når > 7 elementer. Alle endringer markerer `syncStatus=pending` + `sistEndretLokalt` + trigger sync via `TimerSyncProvider`.
- **C7 — i18n + docs:** ~50 nye nøkler under `timer.*` i nb.json + en.json (sync.*, status.utkast/sendt/returnert/attestert, felt.*, tilfoy.*, rediger.*, ingenLonnsarter/Tillegg/TimerRader/TilleggRader, feil.*, bekreftSlett*, sendTilGodkjenning, slettDagsseddel m.fl.). Total: 155 timer-nøkler per språk. CLAUDE.md + STATUS.md + timer.md oppdatert med Runde 2-fremdrift.
- **C8 (`af91dff3`) — Underprosjekt-velger:** Ny `eksternKostObjekt`-router (server) med `list({ projectId? })` for aktive ECO-er filtert på `status="aktiv" + timerregistreringApen=true`. Ny `external_cost_object_local`-tabell + idempotent migrering. `timerKatalog.refreshKatalog` henter ECO-er via Promise.all med catch-fallback (ikke-kritisk hvis router mangler). UnderprosjektVelgerModal i TimerRadModal (filtrerer på prosjekt + søk når > 7). TimerRadVis viser ECO-etikett (proAdmId + kortNavn) under lønnsart. Fjern-X-knapp ved siden av valgt underprosjekt. ~3 nye i18n-nøkler.
- **Merge til develop:** `1cce62f3` 2026-05-02 sent kveld. Inkluderer også OppgaveModal-fix (`ff313e54` — `trpc.arbeidsforlop` → `dokumentflyt`).
- **Test-deploy + prod-deploy utsatt til neste sesjon.** Server-side krever fersk deploy for at C6–C8 skal fungere fra mobil (syncBatch + hentEndringerSiden + dev-login + eksternKostObjekt-router).

**DB-naming-opprydning — ferdig (parkert):**
- Faggruppe-rename gjennomført på test (2026-04-15/16) og prod (2026-04-16) via tre migreringer (`navnegjennomgang`, `enterprise_rename_dokumentflyt_part`, `faggruppe_rename`). Verifisert i [db-naming-audit-2026-04-25.md](db-naming-audit-2026-04-25.md)
- U.1 (`project_groups.building_ids` jsonb) utsatt til Fase 0.5 — drop koordineres med m2m-koblingstabell
- U.2 (FK-constraint-navn fortsatt på engelsk) parkert som lavt-prioritert kosmetikk — tas naturlig ved neste større migrering
- Lokal-DB er bevisst ikke vedlikeholdt; re-seedes fra test ved behov per § «Primærmiljø»

Status og detaljer: [db-opprydning.md](db-opprydning.md).

