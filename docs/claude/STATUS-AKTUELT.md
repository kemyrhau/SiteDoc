---
name: STATUS-AKTUELT
description: Løpende statusrapport for pågående arbeid, pauset arbeid og planlagte faser. Oppdateres ved hver vesentlig fremdrift.
sist_verifisert_mot_kode: 2026-07-10
---

## EAS-byggteller (kvote ~15/mnd, fri plan — nullstilles den 1.)

> Ordre 1 ([SAMARBEIDSREGLER § Cowork leveranse-ansvar](SAMARBEIDSREGLER.md#cowork-leveranse-ansvar-ordre-2026-07-14)): cowork sporer EAS-bygg her. Ved **12 bygg/mnd** → stopp + sjekk klar-tilstand + flagg i status før nytt bygg fyres. Dato/# bekreftes mot `eas build:list`.

**Juli 2026 — 4 bygg brukt (av ~15), ~11 igjen. Reset 1. aug.** Kilde: `eas build:list --platform ios` (ikke gjetning — forrige teller hadde feil datoer og utelot #37).

| # | Dato | Commit | Profil | Formål |
|---|------|--------|--------|--------|
| 37 | 2026-07-01 | `bc744f82` | production | mobil-MS + F-G |
| 38 | 2026-07-11→13 | `d1b96cd5` | production | F4-serien (identitetsforsoning + attestering-deadlock + synk-robusthet) |
| 39 | 2026-07-13→14 | `cd3efcb5` | production | S-A tombstone + del 6 (F-b/e/f/g) + footer |
| 40 | 2026-07-15 | `43299d03` | production | timer F2/F3/F5 + edge #1 (byggeplass per rad + matpause-bærer). Build `15a47804` → TestFlight |

Terskel 12/mnd ikke nær. **#40-lærdom:** EAS autoIncrement teller mot EAS' egne byggrecords, ikke ASC — første submit feilet på “build number 40 already used” (ASC hadde en 40 EAS ikke kjente). Bygget var intakt; ingen kvote brent på retry.

## 🔵 PROD-LIVE MERKNAD — sidebar-label byttet for ALLE (2026-07-14)

`nav.sok` «Søk»→«Dokumentsøk» + `nav.kontrollplan` «Kontrollplaner»→«Kontrollplan» rendres i gammel `HovedSidebar` (`sidebar-elementer.tsx:131,145`) — **ikke** bak `nyNavigasjon`-flagg. Kilde: `73f88112` (finnbarhet i18n), live i prod via develop→main-deploy **`43299d03`** (2026-07-15). **Pilot-support:** etiketten byttet for ALLE brukere, ikke bare ny-nav — bevisst (unngår label-mismatch på tvers av flagg-tilstand, jf. Lokasjoner/Byggeplasser). `firmaNav.innstillinger`→«Firmaprofil» er derimot INERT i prod (gammel firma-nav hardkoder «Innstillinger»).

## Pågående arbeid (PR-historikk)

> **Maks 3 aktive PR-tråder.** `### Gjenstående` er en samlepost, ikke en tråd, og telles ikke.

> 🎨 **REDESIGN (branch `redesign/navigasjon`, bak `nyNavigasjon`-flagg — av-default, inert i prod):** Steg **ii–vi** (ii hub + funn-1b-fix, iii sidebar + kontekst-chip, s1/v4/v5 polish, vi 2a mobil-tabs + K6/P31 Kontakter) + **K9 URL-kanonisering** er **DEPLOYET til prod 2026-07-07 (`0be103fa`, flagg-inert)** → arkivert til [historikk-2026-07.md § Redesign steg ii–vi](historikk-2026-07.md). K9-redirects live flagg-av; K6/P31 Kontakter = flagg-**PÅ**-nav (ikke synlig flagg-av). Alle steg fabel-designgodkjent. Flagg-test på test via `?nyNav=1`. **Dev-login (agent-testing):** `/dev-login` m/ whitelist + `DEV_LOGIN_SECRET`, gated til test (404 i prod) — se [dev-login-agent.md](dev-login-agent.md). **Steg vii (2c dokumentleser med språkpiller) ✅ LUKKET** (fabel-designgodkjent 2026-07-07, 8/8 fangster mot `06-design.png`, merget develop `8c774368`; sticky språkpille-rad + grønt banner + `+ Oversett` (ny `mappe.oversettDokument`, isActive-guard) + bunn-ark-sammenlign; backend `hentDokumentBlokker` utvidet; token-fiks sitedoc-blue; fangster `docs/redesign/screenshots/2c-simulator-2026-07-07/`). **Restanse-runde ✅ KOMPLETT LUKKET (2026-07-07):** P-a statusprikk ✅ + punkt 4 kildeflagg (variant A «🇳🇴 NB · kilde») ✅ (simulator) + FM5/K2 «Mine timer»→brukermeny+søk («Min side») ✅ + T9 mobil-web-hamburger ✅ (Opus web-verifisert; A1-avvik «Mine timer» i PROSJEKT-sonen fikset via delt `prosjektSoneElementer` `a6f8ab3f`). Merget develop `24083342`→`fa87b2f2`. Ny kommando `/test-redesign-nav` (web-verifisering for Opus web). **🎯 Alt av redesign-nav (steg ii–vii + restanse) er nå bygget + designgodkjent.** **Steg viii (kunderunde mot prod-kopi) — infra reist + runbook komplett (2026-07-08), venter kunde-booking:** egen Docker-stack (`docker-compose.redesign.yml`) web **3500**/api **3501** (portet fra 3400/3401 pga. sendfil-kollisjon på server-ny), DB `sitedoc_redesign` (prod-kopi, sessions nullstilt, `migrate deploy` inkl. `20260707120000_user_ny_navigasjon`), DNS/cloudflared satt, OAuth **prod-apper GJENBRUKT** m/ to nye redirect-URIer (verifisert 2026-07-07) — 🔴 **skal reverseres før steg viii** (egne app-registreringer for redesign + fjern de to redesign-redirect-URIene fra prod-appene), se [BACKLOG § OAuth: redesign holder prods nøkler](BACKLOG.md). Runbook [steg-viii-kunderunde.md](../redesign/steg-viii-kunderunde.md): env-maler + «Nøkler & secrets»-proveniens, demo-innhold-strategi (primær ekte SDS-opplasting — parsing verifisert **in-process i api**, ingen worker; fallback `seed-oversettelse-test.ts`), kjøreliste 1→8 + 2 Runde-3-observasjonspunkter (sidebar-lengde admin / hub-farge-inversjon). **Venter:** kunde-booking + Kenneth-drift (opprett demo-prosjekt m/ `oversettelse`-modul, kjør pre-flight-SQL, last opp SDS). Dev-login **IKKE aktiv på redesign** (verifisert 2026-07-09: `ENABLE_DEV_LOGIN` usatt + `DEV_LOGIN_SECRET` tom → 404). Gjenstår ellers: pilot-plan (flagg → company_admin). Full paritet + T/G: [redesign-paritetssjekkliste.md](redesign-paritetssjekkliste.md). Oppfølgere i BACKLOG (§ Redesign-mobil + § Redesign steg vii/2c): s3 utlogging-redirect, agentprosjekt-innholdsseed, degradert Tegninger, sitedoc-primary web-tokens i mobil, kildespråk≠prosjektspråk-gap, toast stille feil, mappe-cache «Ikke funnet». (~~stale toggle~~ + ~~enhets-lagret flagg~~ → LØST via Plan 2 2026-07-07.) **MS-login mobil lokal dev:** placeholder client-ID + AADSTS50011 test-callback (BACKLOG). **🆕 Plan 2 (bruker-lagret `nyNavigasjon`-flagg) + steg viii-infra MERGET til develop 2026-07-07 (`0d3f21ac`, --no-ff).** `User.nyNavigasjon Boolean?` (additiv migrering `20260707120000_user_ny_navigasjon`) er autoritativ konto-kilde; presedens **aktiv `?nyNav`-URL (flyktig) > konto > persistert lokal > env-default > av** i delt `resolverNyNavigasjon` (@sitedoc/shared, 13/13 test). tRPC `bruker.settNyNavigasjon` + `organisasjon.settNyNavForFirma`/`settNyNavForBruker`; web+mobil hooks (lokal cache per userId → delt-enhet-sikker); admin-knapp `firma/ansatte`. Steg viii-infra: `docker-compose.redesign.yml` + `NEXT_PUBLIC_NY_NAV_DEFAULT` build-arg + [steg-viii-kunderunde.md](../redesign/steg-viii-kunderunde.md). **BACKLOG «stale toggle» + «enhets-lagret flagg» → LØST.** **✅ PLAN 2 SLUTTGODKJENT + LUKKET (fabel, 2026-07-07):** web-bevis a–d grønt (Opus web via Kenneth) + simulator-bevis bestått (brukerbytte uten restart + offline-fallback, `docs/redesign/screenshots/plan2-simulator-2026-07-07/`) + 13/13 presedens-test. SecureStore-kolon-bug fanget + fikset under beviset (`:`→`.`, merge `19f7cdcb`). **Test redeployet = develop** (web-separator-fix `19f7cdcb`, atferds-nøytral). **Gjenstår kun: kunderunde + pilot** (`sitedoc_admin`→`company_admin`) — steg viii-infra REIST 2026-07-08 (reboot/DB-kopi/stack/DNS/OAuth ferdig, se steg viii-avsnittet over); venter kunde-booking + demo-innhold-drift per [steg-viii-kunderunde.md](../redesign/steg-viii-kunderunde.md). **✅ K13 (full sidedekning i globalt søk Ctrl+K) — LUKKET (develop `ffc703df`):** alle navigerbare sider blir søkbare via `useSokRegistry`; ny fjerde søkekilde `dype-sider.tsx` + ren `hub-ruter.ts` (én kilde), tidligere udekkede sider dekket (eierFirma/maskin-import som hub-underlenker, maler/firma-attestering/kom-i-gang som dype sider, begge timer-setup-faner). Dekningstest `sok-dekning.test.ts` (F3-vern): 94 disk-ruter, **0 udekket / 0 orphans**, vitest 2/2. i18n 2 nye nøkler + gjenbruk. Kode komplett + typecheck rent. **Statuskilde: `verifisering/K13-verifiseringslogg.md` (designprosjektet — ikke i dette repoet). Ingen statuskopi her** (statuskilde-regelen: én kilde eier status, resten peker). Loggen sier LUKKET, fabel-designgodkjent 2026-07-11, 8/8 mot fasit; skjermbilder i `docs/claude/skjermbilder-k13/`. Rapport (detaljer, ikke status): [k13-sokdekning-rapport.md](k13-sokdekning-rapport.md). **🆕 Byggeplasser-discoverability (develop, 2026-07-14):** eget hub-kort «Byggeplasser» (prosjekt-seksjon, MapPin, «Byggeplasser, tegninger og geofence») erstatter tidligere anonym chip under Prosjektoppsett-kortet + generell `sokeordKey`-synonymmekanisme i `useSokRegistry` («lokasjoner/tegninger/kart/geofence» → Byggeplasser-treff). To underlenker «Byggeplasser»+«Tegninger» → samme byggeplasser-side (tegning-visning ikke dyplenkbar). Bonus-fiks: treff-`id` → `inn:${kort.id}:${labelKey}` (delt href ga kolliderende React-key). nb+en fylt, 13 nb-fallback (generate frossen); dekningstest 2/2 + typecheck + lint grønt. Fabel design-gate + cowork code-gate godkjent. **🆕 Finnbarhets-revisjon (redesign, 2026-07-14 — tre avgrensede enheter):** (1) **Søkemotor** — ny ren `apps/web/src/lib/sok-match.ts` (`matchScore` skrivefeil-tolerant: eksakt>prefiks>substring>bounded Damerau-Levenshtein; `KJERNE_SYNONYMER`+`synonymerFor` sentralt synonymlag bygd på `sokeordKey`); `useSokRegistry` appender synonymer til norm, `normaliserSok` flyttet til sok-match (én kilde, re-eksport); `SokModal` score-sortert filter. Løser Kenneths null-treff «instill»/«admin»/«adm» + «oppsett»→hub. Test `sok-match.test.ts` 14/14. (2) **Begreps-fikser** (i18n nb+en): `firmaNav.innstillinger`→«Firmaprofil», `nav.sok`→«Dokumentsøk», `nav.kontrollplan`→«Kontrollplan», PSI to labels→én ny `psi.administrerMaler` («Administrer PSI-maler», relikvi `psi.gaaTilOppsett` slettet). (3) **Sidemeny på hub-en — NATIVE variant (Kenneth-godkjent mot mockup 2026-07-15).** Del 3s kort-utledede `InnstillingerNav` **slettet**. I stedet: den EKSISTERENDE native sidemenyen trukket ut av `oppsett/layout.tsx` → gjenbrukbar `OppsettSidemeny.tsx` (uendret utseende/logikk/gating). Brukes nå av BÅDE oppsett-undersidene (byte-identisk — kun refaktorert) OG hub-en (`innstillinger/layout.tsx`, flagg-gated to-panel: sidemeny + kort/søk; flagg-av byte-identisk; skjult <md). Ingen aktiv-markering på hub-roten (ingen `oppsett/*`-href matcher). Divergens (hardkodet `navigasjon`-array vs hub-kort) består → BACKLOG: native sidemeny får delt DATAKILDE senere (ikke ny komponent). **Oppfølgere samme runde:** Byggeplasser-kort +«georeferanse» (beskrivelse+sokeord georeferanse/georeferer/kartfeste); Dokumentflyt-kort +underlenker Faggrupper/Medlemmer + gjensidig KJERNE_SYNONYMER (dokumentflyt↔faggruppe↔medlemmer). i18n-frys løftet 2026-07-09 (regel 3/9) → generate kjøres på develop for 13 språk. **📦 LEVERANSESTATUS (2026-07-15):** søkemotor + begrepsfikser + byggeplasser-kort er **DEPLOYET PROD `43299d03`** — flagg-inert i prod UNNTATT `nav.sok`/`nav.kontrollplan`-labelene (se PROD-LIVE-merknaden øverst). Delt `OppsettSidemeny` + sidebar aktiv-seksjon-fix (`b5aaa27d`) + simulator-doc er **merget develop `85de3ad8`**, test-deployet og **Kenneth-godkjent på test (sjekkliste a–e, 2026-07-15)** — venter prod (neste spor b). Cowork-gate: uttrekket verifisert byte-identisk mot gammel `oppsett/layout.tsx` (kun skall-flytt, null logikk-drift); `[prosjektId]`-substitusjon trygg via `innstillinger-kort.tsx:214`-guarden. **🔴 LIVE (IKKE bak flagg) — per-rad geofence-indikator (2026-07-15):** MapPin-kolonne i begge byggeplasser-tabeller (blå fylt = geofence satt, grå omriss = ikke), klikk → eksisterende geofence-modal med radens data (`apneGeofence(byggeplass)`-refaktor); verktøylinje-knappen fjernet. `byggeplasser/page.tsx` rendres UTEN `nyNavigasjon`-gate → **treffer alle prod-brukere ved neste prod-deploy** (jf. finnbarhets-begrepsfiksene som gikk live fordi HovedSidebar leser samme i18n-kilde). Ren frontend, 2 i18n-nøkler (nb+en); ingen schema/server. PSI-geofence-HÅNDHEVING er derimot parkert (Kenneth-vedtak) → grunnlagsdok [psi-geofence-handhevning-utredning.md](psi-geofence-handhevning-utredning.md). **✅ Test-verifisert + Kenneth-godkjent 2026-07-15** (merget develop `74481b61` + i18n 13 språk `2d3b37e7`; test-deployet — georeferering grønn: pin-status mot faktisk geofence, modal forhåndsutfylt fra raden, lagring treffer riktig byggeplass). Cowork-gate: `harGeofence` krever alle tre feltene (`latitude && longitude && radiusM`) → halvsatt geofence viser grå, ikke blå. **Venter prod** (neste spor b). **Gjenstår separat: GPS-felttest** — om geofencen faktisk *treffer* mot ekte GPS på stedet (krever fysisk oppmøte, se BACKLOG § GPS-felttest).

### ✅ Timer-mobil F2/F3/F5 (feltfunn del-6) — DEPLOYET PROD `43299d03` + EAS #40 (2026-07-15) → arkivert [historikk-2026-07](historikk-2026-07.md#prod-deploy-2026-07-15-prod-merge-43299d03--eas-40--timer-f2f3f5-byggeplass-per-rad--matpause-b%C3%A6rer--finnbarhets-revisjon)

Byggeplass-velger tri-tilstand (F2) + byggeplass per timer-rad (F3) + matpause-bærer per rad (F5) + edge #1 dynamisk minutt-etikett. Prod-migrering `20260714120000_sheet_timer_pause_min` applied på `sitedoc`; mobil i TestFlight via EAS #40. Fasit: [timer-mobil-f2f3f5-spec.md](timer-mobil-f2f3f5-spec.md) · detaljer: [timer.md § F5](timer.md).

### ✅ Del-6-fiksrunde F-b/F-e/F-f/F-g — DEPLOYET PROD `f888fecc` 13.07 + EAS #38 → arkivert [historikk-2026-07](historikk-2026-07.md#prod-deploy-2026-07-13)
> _Deployet — detaljene under er historikk (flyttes/trimmes ved neste rens). Oppsummering + gate-lærdommer i historikk-2026-07._

Fire rotårsaksfikser på branch fra develop `2bbf9169` (ren base, S-A + footer merget). Rutet gjennom cowork-gate (ikke selv-committet).
- **F-b:** `utvidArbeidstidsvindu` (`StartSluttDagKort.tsx`) tar `sluttTidKilde`-param → utvider `endAt` KUN ved bekreftet `"bruker"`-slutt; `system`/`midnatt`-gjett skyver ikke vinduet ut med fabrikkerte tider.
- **F-e:** ny `PAUSE_TERSKEL_TIMER = 5.5` (fast, AML §10-9) + `pauseMinForDag(dagsTotal, standardPauseMin)`; **auto-gen-stien** gater pausefradrag på dagstotal i **`fordelArbeidstidFradrag`** (dag-nivå pause-kilden — re-fiks 2026-07-13 flyttet gaten hit fra `carveArbeidstider`-vinduet) — der 38-min-avviket oppstår. **De interaktive edit-flatene (TimerSeksjon/MaskinSeksjon/web) er ÅPNE** (dag-nivå-modelleringsproblem — se BACKLOG § F-e; flagget ved gate). **⚠️ KJENT BEGRENSNING (pilot):** manuell rad-redigering på en <5,5t-dag trekker fortsatt pause (interaktiv-sti, pre-eksisterende — IKKE regresjon). Fikses i F-e-interaktiv-oppfølgeren (design-gate hos fabel først). Fabels F-e-live-fangst denne runden tester KUN carve-stien.
- **F-f:** `redigerSedelRader` + `RedigerRadModal` fra/til-vakt via delt `finnTidsromKonflikt` (samme som `syncBatch`) + mangler-tid-vakt. `validerSplittFelles` avvist (sum-invariant). Nye i18n-nøkler.
- **F-g:** differensiert «for kort»-melding (`haddeEksisterendeRader` → pre-fylt-variant). Nye i18n-nøkler.
- Typecheck 0 nye feil (shared 9=9, api grønt, web 4=4 vitest-baseline, mobil 11=11). i18n generate → 13 språk.
- **✅ AKSEPT BESTÅTT (live-fangst 2026-07-13, bundle `7ab96531`):** F-b-a (faktiske økt-tider) + F-b-b (skjerming: manuell `bruker`-slutt ikke overskrevet) + F-f-web (fra/til-vakt blokkerer tom Fra, gyldig lagrer) + F-g-a/b (differensiert/gammel melding) + **F-e-carve re-test** (kort dag 42 min → rad 0,75t full varighet uten pause; lang dag 6t → rad 5,5t pause trukket) — alle PASS (simulator + web). **Merket:** F-e-carve hadde AVVIK i første impl (rad-verdi ugatet, gate-glipp fanget av simulator) → re-fiks (`7ab96531`) flyttet gaten til `fordelArbeidstidFradrag`. Skjermbilder for fabel: `docs/claude/skjermbilder-del6-live/`. **Venter fabel design-sign-off (F-g-copy-finpuss + F-b-UX) → del 6 DoD → prod spor b.**

### ✅ hentEndringerSiden «erstattet»-lekkasje (fiks B) — DEPLOYET PROD `f888fecc` 13.07 (2 migreringer kjørt på `sitedoc`) → arkivert [historikk-2026-07](historikk-2026-07.md#prod-deploy-2026-07-13)

**Rot:** mobil-pull `hentEndringerSiden` (`apps/api/src/routes/timer/dagsseddel.ts`) manglet `attestertStatus ≠ "erstattet"`-filteret som alle andre lesere har (aktiv-helper 394/403, web-attestering 1835-1837, `hentForAttestering` 1974) → mobil viste ×N rader (write-only audit-rader fra rediger-mutasjonene). **DB-bevist** (seddel `49a7c839` test = 3 live + 6 «erstattet» timer / 2 live + 4 «erstattet» maskin; web filtrerte og viste 3+2, mobil-pull viste 9+6).

**Fiks B («lagre rett» uten å slette data):**
- **Ny felles tabell `SheetRadHistorikk`** (`packages/db-timer`, migrering `20260713120000_sheet_rad_historikk`, **kun ADD**) — JSON-snapshot + `radType` + `originalRadId` + `parentRadId` + `erstattetVed`. Felles tabell fordi de tre kildetabellene har ulik kolonneform + historikk leses aldri for beregning.
- **Rediger-mutasjonene** (`rediger`-bulk 2804 + `splittRad` 3009): **FLYTTER** originalen til historikk (INSERT snapshot + DELETE hovedtabell i SAMME tx) i stedet for å sette `attestertStatus="erstattet"`. Parent-lenke bevart (ny rad.`parentRadId` → historikk.`originalRadId`).
- **Data-migrering** (i samme migrerings-tx): FLYTTER eksisterende «erstattet»-rader (alle 3 typer) fra hovedtabellene → historikk (INSERT via `to_jsonb(t.*)` + DELETE). **MOVE, aldri hard-delete.**
- **`hentEndringerSiden`** (3487): `not: "erstattet"`-vern på timer/tillegg/maskiner-include (rulleringsvern, no-op etter migrering).
- **`attestertStatus`-kolonnen beholdt** (pending/attestert/returnert brukes fortsatt).

Fiks B: `5c9d2070` (kode + migrering + docs). **DEPLOYET api-test + DB-verifisert** (hovedtabell 3 timer/2 maskin live, 6+4 audit-rader flyttet til `sheet_rad_historikk`). **M-1 PASS** (fresh full pull → 3/2) + **M-2 PASS** (stale enhet → normal delta-sync self-heal → 3/2 uten reinstall). Begge cowork-gatet — hele fiks B (hoved + self-heal) bevist ende-til-ende.

**Oppfølger — self-heal av stale lokal tilstand (M-1-funn, TEST-MIGRERT + M-2 PASS):** M-1 avdekket at eksisterende stale lokal visning (9/6) **ikke** self-healer via delta-pull: hoved-migreringen FLYTTET barn-rader uten å bumpe `daily_sheets.updated_at` (barn-endringer bumper ikke parent — bevisst i koden), så `hentEndringerSiden`-delta (`updatedAt > sistSynk`) tar ikke med de berørte sedlene → arbeideren beholder oppblåst visning til full pull/reinstall. Payroll trygt (server korrekt), kun kosmetisk. **Fiks:** ny migrering `20260713130000_bump_updatedat_erstattede_sedler` — ren `UPDATE daily_sheets SET updated_at = now() WHERE id IN (SELECT DISTINCT sheet_id FROM sheet_rad_historikk)`. Bumper de berørte sedlene → neste delta-pull re-henter → pull-apply (delete-all-local + insert-server) reconciler til 3/2. Self-heal uten reinstall. KUN `updated_at`-bump, ingen skjema-endring, idempotent. **Test-migrert 2026-07-13** (`87af7e5b`; `daily_sheets.updated_at` for `49a7c839` bumpet til migreringstid; **M-2 PASS** bekreftet delta-sync-heal uten reinstall). **Prod (begge migreringene) venter Kenneths go — spor b (full `develop→main` når del 6 m.m. er godkjent).**

### ✅ Del 6 timeføring — DEPLOYET PROD `f888fecc` 13.07 + EAS #38 → arkivert [historikk-2026-07](historikk-2026-07.md#prod-deploy-2026-07-13)

Redesign-Opus del-6-arbeid, isolerte branches fra develop, bak coworks dual-review-gate:
- **del 6 P1–P5** (`feat/del6-timeforing`, merget develop `fa2c47a3` + i18n `5f7e1aa8`): P1 maskin-i-rad (web+mobil, UI-only), P2 arbeider-splitt (`splittRadEier` + delt `validerSplittFelles`, web+mobil lokal Drizzle), P3 hybrid (HjemTimerChip 3 tilstander + kort på timer-flaten), P5/P4c allerede på develop. Web fabel-designgodkjent (`docs/claude/skjermbilder-del6-live/`). **P2-mobil duplikat-bug (S3) fikset** via update-original-id (`443c7b38`).
- **fra/til obligatorisk + GPS-carve** (`fix/timer-fra-til-obligatorisk`, `a0d510a5`+`62cee2dc`, merget develop `032491a0`): se [timer.md](timer.md)-rad. **Vedtak: a2-reversering + reise-unntak.**
- **oppfølgere** (`fix/del6-oppfolgere`, `8515555c`+`9d6a8d82`, venter gate): **F-a** tom dagskort-dag gir også variant B; **F-c** «Økten var for kort»-melding ved 0 carve-rader.
- **F-b «Til kl.»-fiks (design, IKKE kode):** designfila RUNDE 5 + `screenshots/runde5-tilkl-2026-07-13/` — forslag: «Slutt dag» skriver faktiske økt-tider. **Foreslått** sluttTidKilde="bruker"-skjerming (må implementeres — `utvidArbeidstidsvindu` sjekker ikke sluttTidKilde i dag). Venter Kenneth-valg.
- **S-A mobil rad-sletting propagerer ikke (S3) — TOMBSTONE LØST + TEST-VERIFISERT (M-3-reprise PASS), venter prod spor b:** Ny lokal `slettede_rader_local`-tombstone-tabell; fjern-handlerne skriver tombstone atomisk (`db.transaction`); syncBatch-push sender `slettedeIder: {timer,tillegg,maskiner}` (optional, #37-bakoverkompat) → server `deleteMany({ sheetId, id:{in} })` bak samme vakt som payload-replace (KRAV 2); pull-race-guard hopper over re-innsetting av rad med levende tombstone (KRAV 1); tombstones ryddes kun ved server-bekreftet sync (KRAV 3). Gatet `6bed19c3`. **✅ M-3-REPRISE PASS (simulator + server-SQL, IKKE EAS):** slett rad → sync → borte lokalt OG på server (`deleteMany` propagerte, `065dc8f4` borte) + pull re-innsetter ikke. Venter kun prod (spor b). Full design + 3 krav: [BACKLOG § Mobil timer-rad-sletting](BACKLOG.md).

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

### Modul-onboarding-wizard (timer) — IMPLEMENTERT PÅ DEVELOP 2026-07-08 (web-only, venter prod)

Gjør firmamodul-onboarding synlig + veiledet ved aktivering. Bakgrunn: `organisasjon.settFirmamodul` (aktiver=true) flipper kun modul-flagget — **seeder ikke katalog** → timer-brukere traff tomme kataloger (jf. [BACKLOG § Modul-onboarding-veiledning](BACKLOG.md)). Generisk datadrevet modell (ferdig-state utledes fra status-tellinger, aldri lagret steg-posisjon) → maskin/varelager plugges inn senere.

- **TASK 1 (`ea4887a3`)** — modell `apps/web/src/lib/onboarding-wizard.ts` (`OnboardingWizardConfig`, `førsteUfullførteSteg`/`antallGjenstår`/`erOnboardingFullført`) + timer-config (4 steg, `ferdig = count > 0`, status-type fra tRPC `RouterOutputs`).
- **TASK 2 (`97a2912f` + Suspense-build-fix `1730263b`)** — dedikert wizard-side `/dashbord/firma/timer/oppsett` (URL-adresserbare steg `?steg=`, datadrevet gjenopptak). Orkestrerer: steg 1 = `aktiverNivaa1`, steg 2–3 lenker til aktivitet/tillegg-sider, steg 4 = utlegg-state. Oppsett-fane i timer-layout + hjelpetekst (?-ikon).
- **TASK 3 (`34ae939f`)** — modal-inngang i `firma/moduler` (`settFirmamodul.onSuccess` → «{Modul} aktivert. Sett opp nå?») + «Fullfør oppsett ({n} av N)»-indikator på modulkortet (skjules ved fullført). Generisk `MODUL_WIZARD_URL`-oppslag.
- **TASK 4 (docs)** — i18n-sveip (30 nøkler nb+en, 0 relikvier/manglende), hjelpetekst-verifisering, denne STATUS-oppdateringen, sluttverifisering (build 59/59 grønt).

**v1 = web-only** (mobil «oppsett ufullstendig»-visning = egen follow-up). i18n nb+en (generate.ts frossen under redesign → 13 språk faller tilbake til nb). **Konsolidering utsatt** (redirect gammel `onboarding`-fane → wizard + migrering/`aktiverTomKatalog` inn i steg 1) → [BACKLOG § Onboarding-wizard konsolidering](BACKLOG.md). **Gjenstår: prod-deploy** (adresserer også Åpne tråder pkt 1 — tom lønnsart-katalog på prod-firma synliggjøres nå av wizarden).

### Lønnsart/katalog-import (A.Markussen) — KJØRT PÅ PROD 2026-07-10 (etter deploy 373a109f)

Landet på `develop`:
- `c875ee6f` — 6 BACKLOG-rader (lønnsart/kode-funn) + drift-rettinger i `timer.md` og `docker/DOCKER-NOTES.md`.
- `92f15893` — generisk `importerKatalog` (`apps/api/src/services/katalog/`, søk `export async function importerKatalog`) + A.Markussen-fixture (`fixtures/a-markussen.json`) + tRPC `admin.importerTimerKatalog` bak `verifiserSiteDocAdmin`.

**Resultat (prod, 2026-07-10 etter deploy `373a109f`):** `admin.importerTimerKatalog` kjørt mot prod-org (A.Markussen) med `dryRun: false` + `deaktiverUmatchedeLonnsarter: false` (bevisst — Kenneth ville **ikke** auto-deaktivere). Oppsummering: **26 opprettet, 12 oppdatert** (alias-treff festet `kode` til eksisterende rad → ingen dubletter), **0 deaktivert**, stjerne flyttet km→120 (`nullstiltStandardvalg: 1`, `standardKodeSatt: 120`). `dryRun: true` ble kjørt FØRST og bekreftet match-veien før skriving. **14 legacy-rader BEHOLDT aktive** (diett/km/nattillegg/losji/lærlingelønn/velferdsperm./skift-som-lønnsart) — Kenneth sletter manuelt i UI eller i kundesesjon. **Åpent til Florian:** km/diett som utlegg? Skal nattillegg/matpenger/smusstillegg/lærlingelønn fortsatt registreres? → km-stjerna og 0-kode-radene er borte; nivå-1-seed-blokkeren i BACKLOG er lukket.

**Prod-tilstand** (målt 2026-07-09 av Kenneth, ikke egen-verifisert): A.Markussen har 25 lønnsarter, 0 med `kode`, `erStandardvalg` står på `Kilometergodtgjørelse (egen bil)`.

### Gjenstående (åpent, ikke sporet annet sted)

- **EAS Android-bygg + Play Store** — Android-distribusjon står igjen (iOS går via TestFlight/EAS). Ikke sporet i BACKLOG/oppryddings-plan → beholdes her.

_Øvrige tidligere «Gjenstående PRs»-punkter er sporet i sannhetskildene og kollapset hit (2026-07-06):_ T7-5h ([BACKLOG](BACKLOG.md), deployet 2026-05-28) · P-KRITISK-1/-2/-3 ([oppryddings-plan-2026-04-28.md § P-KRITISK](oppryddings-plan-2026-04-28.md); -2/-3 deployet, -1 🔴 åpen) · HMS-prosjektvisning teknisk gjeld ([BACKLOG § HMS-prosjektvisning teknisk gjeld](BACKLOG.md)).

## Kundeønsker — A.Markussen (mottatt 2026-05-06)

12 forbedringsønsker fra kunde. Status per 2026-05-11 etter sjekk mot kode og commits. Legenda: 🟢 fikset · 🟡 delvis · 🔴 ikke startet · ❓ trenger verifikasjon · ⏸️ parkert.

### #1 — Sjekkliste for service koblet til timetall og status 🟡

**Side:** Maskin-detaljer (f.eks. 7634 Heatwork MY35). **Prioritet:** Høy.

Kunden ønsker sjekkliste der timetall kobles til servicestatus, og «neste service» oppdateres automatisk.

**Status:** DB-feltet `nesteServiceTimer` finnes allerede i `packages/db-maskin/prisma/schema.prisma:188`. Mangler: UI-felt på maskin-detaljside, serviceintervall-konfigurasjon, visuell terskel-indikator, sjekkliste med avkrysningsbokser, automatisk oppdatering av neste service basert på driftstimer.

### Firmakalender — T9a/b/c deployet til prod ✅, T9d gjenstår 🟡

T9a/b/c deployet til prod 2026-05-15 (prod merge `ca71cf48`).
Migrasjon `20260515114710_t9_arbeidstidskalender` kjørt 15:03:30.
`/dashbord/firma/kalender` returnerer HTTP 200 i prod.

Gjenstår: **T9d** mobil-cache `arbeidstidskalender_local` (avhenger av
T.4/T.5-implementasjon). SummeringsBanner.tsx (T7-3a) trenger oppdatering
etter T9d for å lese dagsnorm fra kalender-cache i stedet for
`OrganizationSetting.dagsnorm`.

### Topbar firma-kontekst + favoritter — deployet til prod ✅

Deployet til prod 2026-05-15 (prod merge `0bd27466`). Topbar tilpasser seg
pathname: i firma-kontekst (`/dashbord/firma/*`) vises ny «Firma ▾»-velger
istedenfor `ProsjektVelger` + `ByggeplassVelger`. Favoritt-prosjekter og
favoritt-byggeplasser persistert i localStorage med stjernemerking i alle
tre velgere (`ProsjektVelger`, `FirmaKontekstVelger`, `ByggeplassVelger`).
Søkefelt vises ved >7 elementer. 11 nye i18n-nøkler totalt
(`topbar.*` + `byggeplassVelger.*`) auto-oversatt til 13 språk.

**Tidligere § #2 «Validering av overtid basert på arbeidstid»** er konsolidert inn i T.9 — sommer/vinter-modell er nå Variant B (dynamiske perioder i `ArbeidstidsKalender`, ikke scalar-felter). 8t (sommer) / 7t (vinter) ordinær arbeidstid-validering bygges som del av T.9-implementasjon.

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

### #4 — Redigering og splitting av timer ved attestering 🟡 DELVIS LEVERT

**Side:** Attestering.

**Levert 2026-05-14** via T7-2b-bunken:
- ECO-flytt på attestering (Steg 4a, prod-commit `f98fa7a5` 2026-05-03) — leder kan endre kostnadsbærer per rad.
- Per-rad-attestering med felleskomponent AttesteringDetalj (T7-2b1, prod-commit `3234c057`).
- **Edit-modus: firma-admin kan redigere timeantall + ECO + fra/til på alle pending-rader** via `redigerSedelRader`-mutation (T7-2b2, prod-commit `755c542a`). Gated på `OrganizationSetting.tillattRedigerVedAttestering`-toggle (T7-2b3, prod-commit `af4a7deb`) — default false, firma-admin skrur på via `/dashbord/firma/innstillinger`.
- T.5 tidsrunding (prod-commit `ba6ba243` 2026-05-16) avrunder fra/til-input i edit-modus til konfigurert intervall (15/30/60 min).

**Gjenstår:** Rad-splitting (én rad → flere med ulike prosjekt/ECO/lønnsart/fra-til) krever `splittRad`-mutation. Audit-log med før/etter-snapshots per rad (T7-2b2 logger antall + actor; per-rad-snapshots utsatt til egen oppfølger).

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

### #6 — Maskinmodul ikke synlig i prosjekt 998 Instinniforbotn ✅ Lukket 2026-05-12

**Side:** Maskin (prosjekt 998 Instinniforbotn).

✅ **Lukket 2026-05-12 — ikke en bug.** `ProjectModule maskin/aktiv` finnes på prod for prosjekt 998 (`5e8dd794-ab81-47b7-a146-d7384fac3a8a`), og `OrganizationModule maskin/aktiv` finnes for A.Markussen (`4488fe17-...`). Auto-sync fra Steg 1c (`87fb7292`) har gjort jobben sin.

A.Markussen-ansatte (Malin, Silje, Florian — alle `company_admin` med `organization_id = 4488fe17-...` og `can_login=true`) ser Maskin-lenken korrekt i bunnen av HovedSidebar. Kenneth ser den ikke fordi hans bruker har `organization_id = NULL` (superadmin uten firma-tilknytning) — `organisasjon.hentMin` returnerer da `null` og `aktiveFirmamoduler = []`, slik at maskin-bunnelementet filtreres bort i `HovedSidebar.tsx:331`.

**Løsning:** Bytt til brukervisning (impersonering eller logg inn som A.Markussen-ansatt) for å se det kunden ser. Diagnose-verifikasjon utført 2026-05-12 mot prod-DB.

### #7 — Rettighetsmatrise med rolle-styring (Prosjektleder + Bas) 🔴

**Side:** Oppsett – Brukere/Roller.

Ingen treff på `Prosjektleder`/`Bas` som DB-roller. Eksisterende roller: `User.role = sitedoc_admin | company_admin | user` og `ProjectMember.role = admin | member`. Krever ny rolle-modell + matrise-UI som viser tilganger per rolle.

### #8 — Fagområde og oppgaver i sjekklistemaler-listevisning 🟢 LUKKET 2026-05-12

**Side:** Innstillinger – Produksjon – Sjekklistemaler.

Levert via commit `3eb7398f` (impl) + merge `542461e2` (prod) 2026-05-12. Fagområde-kolonne (Bygg/HMS/Kvalitet via `mal.domain`) + Antall punkter-kolonne (`mal._count.objects`) lagt til i `apps/web/src/app/dashbord/oppsett/produksjon/_components/MalListe.tsx`. 4 nye i18n-nøkler i 15 språk. Tabellen har nå 5 kolonner: Navn, Fagområde, Antall punkter, Prefiks, Versjon.

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
